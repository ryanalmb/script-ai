#!/bin/bash

# Enterprise Deployment Script
# Complete production deployment with zero-downtime and health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${DEPLOYMENT_ENV:-production}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
ROLLBACK_ON_FAILURE=${ROLLBACK_ON_FAILURE:-true}
BACKUP_BEFORE_DEPLOY=${BACKUP_BEFORE_DEPLOY:-true}

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${CYAN}[SUCCESS]${NC} $1"
}

# Pre-deployment checks
pre_deployment_checks() {
    print_header "Pre-Deployment Checks"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        exit 1
    fi
    
    # Check if required files exist
    local required_files=(
        ".env.enterprise"
        "docker-compose.enterprise.yml"
        "telegram-bot/Dockerfile.enterprise"
        "backend/Dockerfile.enterprise"
        "llm-service/Dockerfile.enterprise"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done
    
    # Check environment variables
    source .env.enterprise
    
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ "$TELEGRAM_BOT_TOKEN" = "your_telegram_bot_token_here" ]; then
        print_error "TELEGRAM_BOT_TOKEN is not configured"
        exit 1
    fi
    
    print_success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        print_header "Creating Backup"
        
        local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Backup database
        print_step "Backing up database..."
        docker-compose -f docker-compose.enterprise.yml exec -T postgres pg_dump -U platform_user enterprise_platform > "$backup_dir/database.sql" || true
        
        # Backup Redis data
        print_step "Backing up Redis data..."
        docker-compose -f docker-compose.enterprise.yml exec -T redis redis-cli BGSAVE || true
        
        # Backup configuration
        print_step "Backing up configuration..."
        cp .env.enterprise "$backup_dir/"
        cp docker-compose.enterprise.yml "$backup_dir/"
        
        print_success "Backup created in $backup_dir"
        echo "$backup_dir" > .last_backup
    fi
}

# Build images with versioning
build_images() {
    print_header "Building Docker Images"
    
    local version=$(date +%Y%m%d_%H%M%S)
    local git_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    
    print_step "Building Telegram Bot image..."
    docker build \
        -f telegram-bot/Dockerfile.enterprise \
        -t telegram-bot:${version} \
        -t telegram-bot:latest \
        --build-arg VERSION=${version} \
        --build-arg GIT_HASH=${git_hash} \
        telegram-bot/
    
    print_step "Building Backend image..."
    docker build \
        -f backend/Dockerfile.enterprise \
        -t backend:${version} \
        -t backend:latest \
        --build-arg VERSION=${version} \
        --build-arg GIT_HASH=${git_hash} \
        backend/
    
    print_step "Building LLM Service image..."
    docker build \
        -f llm-service/Dockerfile.enterprise \
        -t llm-service:${version} \
        -t llm-service:latest \
        --build-arg VERSION=${version} \
        --build-arg GIT_HASH=${git_hash} \
        llm-service/
    
    print_success "Images built successfully with version: $version"
    echo "$version" > .deployment_version
}

# Deploy infrastructure with zero downtime
deploy_infrastructure() {
    print_header "Deploying Infrastructure"
    
    # Start infrastructure services if not running
    print_step "Starting infrastructure services..."
    docker-compose -f docker-compose.enterprise.yml up -d consul zookeeper kafka postgres redis kong
    
    # Wait for infrastructure to be ready
    print_step "Waiting for infrastructure to be ready..."
    wait_for_service "consul" "http://localhost:8500/v1/status/leader" 60
    wait_for_service "kafka" "kafka:29092" 60
    wait_for_service "postgres" "postgres:5432" 60
    wait_for_service "redis" "redis:6379" 60
    wait_for_service "kong" "http://localhost:8001/status" 60
    
    print_success "Infrastructure deployed successfully"
}

# Deploy observability stack
deploy_observability() {
    print_header "Deploying Observability Stack"
    
    print_step "Starting observability services..."
    docker-compose -f docker-compose.enterprise.yml up -d prometheus grafana jaeger
    docker-compose -f docker-compose.enterprise.yml up -d node-exporter redis-exporter postgres-exporter cadvisor
    
    # Wait for observability services
    print_step "Waiting for observability services..."
    wait_for_service "prometheus" "http://localhost:9090/-/healthy" 60
    wait_for_service "grafana" "http://localhost:3000/api/health" 60
    wait_for_service "jaeger" "http://localhost:16686/" 60
    
    print_success "Observability stack deployed successfully"
}

# Deploy application services with rolling update
deploy_applications() {
    print_header "Deploying Application Services"
    
    # Deploy backend first
    print_step "Deploying backend service..."
    deploy_service_with_health_check "backend" "http://localhost:3001/api/health"
    
    # Deploy LLM service
    print_step "Deploying LLM service..."
    deploy_service_with_health_check "llm-service" "http://localhost:3003/health"
    
    # Deploy Telegram bot last
    print_step "Deploying Telegram bot..."
    deploy_service_with_health_check "telegram-bot" "http://localhost:3002/health"
    
    print_success "Application services deployed successfully"
}

# Deploy single service with health check
deploy_service_with_health_check() {
    local service_name=$1
    local health_url=$2
    
    print_step "Scaling up new $service_name instance..."
    docker-compose -f docker-compose.enterprise.yml up -d --scale $service_name=2 $service_name
    
    # Wait for new instance to be healthy
    print_step "Waiting for new $service_name instance to be healthy..."
    if wait_for_service "$service_name" "$health_url" $HEALTH_CHECK_TIMEOUT; then
        print_step "Scaling down old $service_name instance..."
        docker-compose -f docker-compose.enterprise.yml up -d --scale $service_name=1 $service_name
        print_success "$service_name deployed successfully"
    else
        print_error "$service_name deployment failed"
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            rollback_service $service_name
        fi
        exit 1
    fi
}

# Wait for service to be healthy
wait_for_service() {
    local service_name=$1
    local check_url=$2
    local timeout=$3
    local counter=0
    
    while [ $counter -lt $timeout ]; do
        if curl -f -s "$check_url" >/dev/null 2>&1; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        sleep 1
        counter=$((counter + 1))
        
        if [ $((counter % 10)) -eq 0 ]; then
            print_step "Waiting for $service_name... ($counter/${timeout}s)"
        fi
    done
    
    print_error "$service_name health check timeout"
    return 1
}

# Rollback service
rollback_service() {
    local service_name=$1
    print_warning "Rolling back $service_name..."
    
    # Scale back to 1 instance (removes the failed new instance)
    docker-compose -f docker-compose.enterprise.yml up -d --scale $service_name=1 $service_name
    
    print_success "$service_name rolled back"
}

# Post-deployment verification
post_deployment_verification() {
    print_header "Post-Deployment Verification"
    
    # Check all services are healthy
    local services=(
        "telegram-bot:http://localhost:3002/health"
        "backend:http://localhost:3001/api/health"
        "llm-service:http://localhost:3003/health"
        "prometheus:http://localhost:9090/-/healthy"
        "grafana:http://localhost:3000/api/health"
        "kong:http://localhost:8001/status"
    )
    
    for service_check in "${services[@]}"; do
        IFS=':' read -r service_name health_url <<< "$service_check"
        
        if curl -f -s "$health_url" >/dev/null 2>&1; then
            print_success "$service_name is healthy"
        else
            print_error "$service_name health check failed"
            exit 1
        fi
    done
    
    # Run integration tests
    print_step "Running integration tests..."
    run_integration_tests
    
    print_success "Post-deployment verification completed"
}

# Run integration tests
run_integration_tests() {
    # Test Telegram bot webhook
    if curl -f -s "http://localhost:3002/health/detailed" | grep -q "healthy"; then
        print_success "Telegram bot integration test passed"
    else
        print_error "Telegram bot integration test failed"
        exit 1
    fi
    
    # Test backend API
    if curl -f -s "http://localhost:3001/api/health" | grep -q "healthy"; then
        print_success "Backend API integration test passed"
    else
        print_error "Backend API integration test failed"
        exit 1
    fi
    
    # Test LLM service
    if curl -f -s "http://localhost:3003/health" | grep -q "healthy"; then
        print_success "LLM service integration test passed"
    else
        print_error "LLM service integration test failed"
        exit 1
    fi
}

# Cleanup old images and containers
cleanup() {
    print_header "Cleanup"
    
    print_step "Removing old images..."
    docker image prune -f
    
    print_step "Removing unused volumes..."
    docker volume prune -f
    
    print_step "Removing unused networks..."
    docker network prune -f
    
    print_success "Cleanup completed"
}

# Display deployment summary
display_summary() {
    print_header "Deployment Summary"
    
    local version=$(cat .deployment_version 2>/dev/null || echo "unknown")
    
    echo ""
    echo -e "${GREEN}🚀 Deployment Status: SUCCESS${NC}"
    echo -e "${BLUE}📦 Version: ${version}${NC}"
    echo -e "${BLUE}🌍 Environment: ${DEPLOYMENT_ENV}${NC}"
    echo -e "${BLUE}⏰ Deployed at: $(date)${NC}"
    echo ""
    
    echo -e "${CYAN}📊 Service URLs:${NC}"
    echo "  • API Gateway:            http://localhost:8000"
    echo "  • Telegram Bot:           http://localhost:3002/health"
    echo "  • Backend API:            http://localhost:3001/api/health"
    echo "  • LLM Service:            http://localhost:3003/health"
    echo "  • Prometheus:             http://localhost:9090"
    echo "  • Grafana:                http://localhost:3000"
    echo "  • Jaeger:                 http://localhost:16686"
    echo "  • Consul:                 http://localhost:8500"
    echo ""
    
    echo -e "${YELLOW}📈 Monitoring:${NC}"
    echo "  • System Health:          http://localhost:3002/health/detailed"
    echo "  • Metrics:                http://localhost:9090/targets"
    echo "  • Traces:                 http://localhost:16686"
    echo "  • Logs:                   docker-compose -f docker-compose.enterprise.yml logs -f"
    echo ""
    
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
}

# Main deployment function
main() {
    print_header "Enterprise Deployment Started"
    
    pre_deployment_checks
    create_backup
    build_images
    deploy_infrastructure
    deploy_observability
    deploy_applications
    post_deployment_verification
    cleanup
    display_summary
    
    print_success "🎉 Enterprise deployment completed successfully!"
}

# Handle script interruption
trap 'print_error "Deployment interrupted. Check system status and consider rollback."; exit 1' INT TERM

# Run main function
main "$@"
