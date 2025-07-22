#!/bin/bash

# Complete Production Deployment Script for X/Twitter Automation Platform
# This script executes a comprehensive production deployment with testing and validation

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
DEPLOYMENT_LOG="deployment-$(date +%Y%m%d-%H%M%S).log"
PRODUCTION_ENV_FILE=".env.production"
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
TEST_SCRIPT="scripts/run-comprehensive-tests.sh"

# Logging functions
log() {
    echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S') [DEPLOY] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

success() {
    echo -e "${GREEN}$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

warning() {
    echo -e "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

info() {
    echo -e "${CYAN}$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

status() {
    echo -e "${PURPLE}$(date '+%Y-%m-%d %H:%M:%S') [STATUS] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

# Function to check prerequisites
check_prerequisites() {
    log "🔍 Checking deployment prerequisites..."
    
    local missing_deps=0
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        missing_deps=$((missing_deps + 1))
    else
        success "Docker found: $(docker --version)"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        missing_deps=$((missing_deps + 1))
    else
        success "Docker Compose found: $(docker-compose --version)"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        missing_deps=$((missing_deps + 1))
    else
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            error "Node.js version 18+ required (found: $(node --version))"
            missing_deps=$((missing_deps + 1))
        else
            success "Node.js found: $(node --version)"
        fi
    fi
    
    # Check available resources
    local available_memory=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
    if (( $(echo "$available_memory < 2.0" | bc -l) )); then
        warning "Low available memory: ${available_memory}GB (recommended: 4GB+)"
    else
        success "Available memory: ${available_memory}GB"
    fi
    
    local available_disk=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$available_disk" -lt 10 ]; then
        warning "Low available disk space: ${available_disk}GB (recommended: 20GB+)"
    else
        success "Available disk space: ${available_disk}GB"
    fi
    
    if [ "$missing_deps" -gt 0 ]; then
        error "Missing $missing_deps required dependencies. Please install them before proceeding."
        exit 1
    fi
    
    success "✅ All prerequisites satisfied"
}

# Function to create production environment file
create_production_environment() {
    log "🔧 Creating production environment configuration..."
    
    if [ -f "$PRODUCTION_ENV_FILE" ]; then
        warning "Production environment file already exists. Creating backup..."
        cp "$PRODUCTION_ENV_FILE" "${PRODUCTION_ENV_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
    fi
    
    cat > "$PRODUCTION_ENV_FILE" << 'EOF'
# X/Twitter Automation Platform - Production Environment Configuration
# Generated automatically - customize as needed

# Core Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ENABLE_DETAILED_LOGGING=false

# Database Configuration
POSTGRES_PASSWORD=ScriptAI_Prod_2024_SecurePass!
DATABASE_URL=postgresql://postgres:ScriptAI_Prod_2024_SecurePass!@postgres:5432/script_ai
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_POOL_ACQUIRE_TIMEOUT=60000

# Redis Configuration
REDIS_PASSWORD=ScriptAI_Redis_2024_SecurePass!
REDIS_URL=redis://:ScriptAI_Redis_2024_SecurePass!@redis:6379
REDIS_TTL_DEFAULT=3600
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000

# Security Configuration
JWT_SECRET=ScriptAI_JWT_Production_Secret_Key_2024_Very_Secure_32_Chars_Min
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=ScriptAI_AES256_Encryption_Key_32_Characters_Required_2024
BOT_JWT_SECRET=ScriptAI_Bot_JWT_Secret_Key_2024_Production_Secure
BCRYPT_ROUNDS=12

# External API Configuration (REPLACE WITH YOUR ACTUAL KEYS)
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_FROM_BOTFATHER
HUGGING_FACE_API_KEY=YOUR_HUGGING_FACE_API_KEY

# Real-Time Sync Configuration
ENABLE_REAL_TIME_SYNC=true
REAL_TIME_SYNC_LOG_LEVEL=info

# Account Synchronization
ACCOUNT_SYNC_INTERVAL_SECONDS=30
ACCOUNT_SYNC_BATCH_SIZE=10
ACCOUNT_SYNC_RETRY_ATTEMPTS=3
ACCOUNT_SYNC_TIMEOUT=30000

# Analytics Collection
ANALYTICS_COLLECTION_ENABLED=true
ANALYTICS_BUFFER_SIZE=1000
ANALYTICS_FLUSH_INTERVAL_SECONDS=10
ANALYTICS_RATE_LIMIT_PER_MINUTE=300

# Campaign Tracking
CAMPAIGN_TRACKING_ENABLED=true
CAMPAIGN_TRACKING_INTERVAL_SECONDS=300
CAMPAIGN_ANALYTICS_INTERVAL_SECONDS=900

# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_MAX_CONNECTIONS=1000
WEBSOCKET_MESSAGE_QUEUE_SIZE=100
WEBSOCKET_BROADCAST_INTERVAL_SECONDS=30
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_PING_TIMEOUT=60000

# Data Integrity
DATA_INTEGRITY_ENABLED=true
DATA_VALIDATION_INTERVAL_SECONDS=300
DATA_RETENTION_CHECK_INTERVAL_SECONDS=3600
DATA_QUALITY_THRESHOLD=0.8

# Anti-Detection Configuration
ANTI_DETECTION_ENABLED=true
PROXY_ROTATION_ENABLED=true
FINGERPRINT_ROTATION_ENABLED=true
BEHAVIOR_SIMULATION_ENABLED=true
DETECTION_EVASION_LEVEL=medium

# Performance Thresholds
MIN_ENGAGEMENT_RATE=0.02
MIN_QUALITY_SCORE=0.7
MAX_RISK_SCORE=0.3
MAX_ACTIONS_PER_HOUR=100

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BOT_RATE_LIMIT_PER_MINUTE=60

# CORS Configuration
FRONTEND_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,https://yourdomain.com

# Monitoring and Health
HEALTH_CHECK_ENABLED=true
METRICS_COLLECTION_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true

# Bot Configuration
BOT_DETAILED_LOGGING=false
BOT_WEBHOOK_SECRET=ScriptAI_Webhook_Secret_2024_Production

# Build Configuration
BUILD_VERSION=1.0.0
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
    
    success "✅ Production environment file created: $PRODUCTION_ENV_FILE"
    info "⚠️  IMPORTANT: Update TELEGRAM_BOT_TOKEN and HUGGING_FACE_API_KEY with your actual keys"
}

# Function to deploy services
deploy_services() {
    log "🚀 Deploying production services with Docker Compose..."
    
    # Pull latest images
    info "Pulling latest Docker images..."
    if docker-compose -f "$DOCKER_COMPOSE_FILE" pull; then
        success "Docker images pulled successfully"
    else
        warning "Some images may not have been pulled (this is normal for local builds)"
    fi
    
    # Build and start services
    info "Building and starting all services..."
    if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d --build; then
        success "All services started successfully"
    else
        error "Failed to start services"
        return 1
    fi
    
    # Wait for services to initialize
    info "Waiting for services to initialize (60 seconds)..."
    sleep 60
    
    success "✅ Service deployment completed"
}

# Function to verify container health
verify_container_health() {
    log "🏥 Verifying container health status..."
    
    local unhealthy_containers=0
    local containers=(
        "script-ai-postgres"
        "script-ai-redis" 
        "script-ai-backend"
        "script-ai-websocket"
        "script-ai-nginx"
    )
    
    for container in "${containers[@]}"; do
        if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
            local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-health-check")
            
            if [ "$health_status" = "healthy" ] || [ "$health_status" = "no-health-check" ]; then
                success "Container $container: Running (Health: $health_status)"
            else
                error "Container $container: Unhealthy (Health: $health_status)"
                unhealthy_containers=$((unhealthy_containers + 1))
            fi
        else
            error "Container $container: Not running"
            unhealthy_containers=$((unhealthy_containers + 1))
        fi
    done
    
    if [ "$unhealthy_containers" -eq 0 ]; then
        success "✅ All containers are healthy"
        return 0
    else
        error "❌ $unhealthy_containers containers are unhealthy"
        return 1
    fi
}

# Function to test health endpoints
test_health_endpoints() {
    log "🔍 Testing health check endpoints..."
    
    local failed_checks=0
    
    # Backend health check
    info "Testing backend health endpoint..."
    if curl -f -s http://localhost:3000/health > /dev/null; then
        success "Backend health check: PASSED"
    else
        error "Backend health check: FAILED"
        failed_checks=$((failed_checks + 1))
    fi
    
    # WebSocket health check
    info "Testing WebSocket health endpoint..."
    if curl -f -s http://localhost:3001/health > /dev/null; then
        success "WebSocket health check: PASSED"
    else
        error "WebSocket health check: FAILED"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Nginx health check
    info "Testing Nginx health endpoint..."
    if curl -f -s http://localhost/health > /dev/null; then
        success "Nginx health check: PASSED"
    else
        error "Nginx health check: FAILED"
        failed_checks=$((failed_checks + 1))
    fi
    
    # Real-time sync health check
    info "Testing real-time sync health endpoint..."
    if curl -f -s http://localhost:3000/api/real-time-sync/health > /dev/null; then
        success "Real-time sync health check: PASSED"
    else
        warning "Real-time sync health check: FAILED (may be initializing)"
    fi
    
    if [ "$failed_checks" -eq 0 ]; then
        success "✅ All health endpoints are responding"
        return 0
    else
        error "❌ $failed_checks health endpoints failed"
        return 1
    fi
}

# Function to show deployment status
show_deployment_status() {
    status "📊 DEPLOYMENT STATUS SUMMARY"
    echo "=========================================="
    
    # Container status
    echo "🐳 Container Status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    echo ""
    
    # Resource usage
    echo "💾 Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""
    
    # Service endpoints
    echo "🌐 Service Endpoints:"
    echo "  Backend API:      http://localhost:3000"
    echo "  WebSocket:        http://localhost:3001"
    echo "  Nginx Proxy:      http://localhost:80"
    echo "  Health Check:     http://localhost:3000/health"
    echo "  Real-time Sync:   http://localhost:3000/api/real-time-sync/health"
    echo "  Bot API:          http://localhost:3000/api/telegram-bot/status"
    echo ""
    
    # Log locations
    echo "📝 Log Files:"
    echo "  Deployment Log:   $DEPLOYMENT_LOG"
    echo "  Backend Logs:     docker-compose -f $DOCKER_COMPOSE_FILE logs backend"
    echo "  Database Logs:    docker-compose -f $DOCKER_COMPOSE_FILE logs postgres"
    echo "  Redis Logs:       docker-compose -f $DOCKER_COMPOSE_FILE logs redis"
    echo ""
    
    success "✅ Deployment status summary completed"
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    echo "🚀 STARTING COMPLETE PRODUCTION DEPLOYMENT"
    echo "=========================================="
    echo "Platform: X/Twitter Automation System"
    echo "Version: Enterprise Production v1.0.0"
    echo "Timestamp: $(date)"
    echo "Log File: $DEPLOYMENT_LOG"
    echo "=========================================="
    echo ""
    
    # Step 1: Prerequisites
    check_prerequisites
    
    # Step 2: Environment setup
    create_production_environment
    
    # Step 3: Deploy services
    deploy_services
    
    # Step 4: Verify health
    verify_container_health
    
    # Step 5: Test endpoints
    test_health_endpoints
    
    # Step 6: Show status
    show_deployment_status
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "=========================================="
    echo "🎉 DEPLOYMENT PHASE 1 COMPLETED"
    echo "Duration: ${duration} seconds"
    echo "Status: Services deployed and running"
    echo "Next: Database initialization and testing"
    echo "=========================================="
    
    success "✅ Production deployment Phase 1 completed successfully"
}

# Execute main function
main "$@"
