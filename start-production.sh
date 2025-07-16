#!/bin/bash
# Production startup script for X Marketing Platform

set -e

echo "🚀 Starting X Marketing Platform Production Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_status "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    print_status "Docker Compose is available"
}

# Function to create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    mkdir -p logs/backend
    mkdir -p logs/postgres
    mkdir -p logs/redis
    mkdir -p database
    print_status "Directories created"
}

# Function to generate environment file if it doesn't exist
create_env_file() {
    if [ ! -f .env ]; then
        print_info "Creating .env file..."
        cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://postgres:password@postgres:5432/x_marketing_platform
POSTGRES_DB=x_marketing_platform
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# Application Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:3000

# Security Configuration
JWT_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
LOG_LEVEL=info

# External Services
LLM_SERVICE_URL=http://llm-service:3003
EOF
        print_status ".env file created with secure random secrets"
    else
        print_status ".env file already exists"
    fi
}

# Function to build and start services
start_services() {
    print_info "Building and starting services..."
    
    # Stop any existing containers
    docker-compose down --remove-orphans
    
    # Build and start core services (postgres, redis, backend)
    print_info "Starting core services (PostgreSQL, Redis, Backend)..."
    docker-compose up -d postgres redis
    
    # Wait for databases to be ready
    print_info "Waiting for databases to be ready..."
    sleep 10
    
    # Check PostgreSQL health
    local postgres_ready=false
    local redis_ready=false
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose exec -T postgres pg_isready -U postgres -d x_marketing_platform > /dev/null 2>&1; then
            postgres_ready=true
            break
        fi
        print_info "PostgreSQL not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ "$postgres_ready" = true ]; then
        print_status "PostgreSQL is ready"
    else
        print_error "PostgreSQL failed to start after $max_attempts attempts"
        exit 1
    fi
    
    # Check Redis health
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            redis_ready=true
            break
        fi
        print_info "Redis not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ "$redis_ready" = true ]; then
        print_status "Redis is ready"
    else
        print_error "Redis failed to start after $max_attempts attempts"
        exit 1
    fi
    
    # Start backend service
    print_info "Starting backend service..."
    docker-compose up -d backend
    
    # Wait for backend to be ready
    print_info "Waiting for backend to be ready..."
    sleep 15
    
    local backend_ready=false
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/health/live > /dev/null 2>&1; then
            backend_ready=true
            break
        fi
        print_info "Backend not ready yet (attempt $attempt/$max_attempts)..."
        sleep 3
        attempt=$((attempt + 1))
    done
    
    if [ "$backend_ready" = true ]; then
        print_status "Backend is ready"
    else
        print_error "Backend failed to start after $max_attempts attempts"
        docker-compose logs backend
        exit 1
    fi
}

# Function to run health checks
run_health_checks() {
    print_info "Running comprehensive health checks..."
    
    # Test backend health
    if curl -f http://localhost:3001/health/live > /dev/null 2>&1; then
        print_status "Backend health check passed"
    else
        print_error "Backend health check failed"
        return 1
    fi
    
    # Test metrics endpoint
    if curl -f http://localhost:3001/metrics > /dev/null 2>&1; then
        print_status "Metrics endpoint accessible"
    else
        print_warning "Metrics endpoint not accessible"
    fi
    
    # Test database connectivity
    if docker-compose exec -T postgres psql -U postgres -d x_marketing_platform -c "SELECT 1;" > /dev/null 2>&1; then
        print_status "Database connectivity verified"
    else
        print_error "Database connectivity failed"
        return 1
    fi
    
    # Test Redis connectivity
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_status "Redis connectivity verified"
    else
        print_error "Redis connectivity failed"
        return 1
    fi
    
    return 0
}

# Function to show service status
show_status() {
    echo ""
    echo "🎯 Service Status:"
    echo "=================="
    docker-compose ps
    
    echo ""
    echo "🌐 Available Endpoints:"
    echo "======================"
    echo "Backend API:      http://localhost:3001"
    echo "Health Check:     http://localhost:3001/health/live"
    echo "Metrics:          http://localhost:3001/metrics"
    echo "Prometheus:       http://localhost:3001/metrics/prometheus"
    echo "PostgreSQL:       localhost:5432"
    echo "Redis:            localhost:6379"
    
    echo ""
    echo "📊 Quick Health Check:"
    echo "====================="
    if run_health_checks; then
        print_status "All services are healthy!"
    else
        print_warning "Some services may have issues. Check logs with: docker-compose logs"
    fi
}

# Main execution
main() {
    echo "Starting production environment setup..."
    
    check_docker
    check_docker_compose
    create_directories
    create_env_file
    start_services
    show_status
    
    echo ""
    print_status "🎉 X Marketing Platform is now running in production mode!"
    echo ""
    echo "To stop the services, run: docker-compose down"
    echo "To view logs, run: docker-compose logs -f [service_name]"
    echo "To restart a service, run: docker-compose restart [service_name]"
}

# Run main function
main "$@"
