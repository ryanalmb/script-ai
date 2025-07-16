#!/bin/bash
# Production Entrypoint Script for LLM Service
# Comprehensive startup with health checks and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Environment validation
validate_environment() {
    log "Validating environment variables..."
    
    local required_vars=(
        "GEMINI_API_KEY"
        "POSTGRES_HOST"
        "POSTGRES_DB"
        "POSTGRES_USER"
        "POSTGRES_PASSWORD"
        "REDIS_HOST"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    success "Environment validation passed"
}

# Database connectivity check
check_database() {
    log "Checking database connectivity..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if python -c "
import psycopg2
import os
try:
    conn = psycopg2.connect(
        host=os.environ['POSTGRES_HOST'],
        database=os.environ['POSTGRES_DB'],
        user=os.environ['POSTGRES_USER'],
        password=os.environ['POSTGRES_PASSWORD'],
        port=os.environ.get('POSTGRES_PORT', 5432),
        connect_timeout=5
    )
    conn.close()
    print('Database connection successful')
    exit(0)
except Exception as e:
    print(f'Database connection failed: {e}')
    exit(1)
" 2>/dev/null; then
            success "Database connection established"
            return 0
        fi
        
        warn "Database connection attempt $attempt/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    error "Failed to connect to database after $max_attempts attempts"
    exit 1
}

# Redis connectivity check
check_redis() {
    log "Checking Redis connectivity..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if python -c "
import redis
import os
try:
    r = redis.Redis(
        host=os.environ['REDIS_HOST'],
        port=int(os.environ.get('REDIS_PORT', 6379)),
        password=os.environ.get('REDIS_PASSWORD'),
        socket_connect_timeout=5,
        socket_timeout=5
    )
    r.ping()
    print('Redis connection successful')
    exit(0)
except Exception as e:
    print(f'Redis connection failed: {e}')
    exit(1)
" 2>/dev/null; then
            success "Redis connection established"
            return 0
        fi
        
        warn "Redis connection attempt $attempt/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    error "Failed to connect to Redis after $max_attempts attempts"
    exit 1
}

# Gemini API check
check_gemini_api() {
    log "Checking Gemini API connectivity..."
    
    if python -c "
import os
import requests
try:
    api_key = os.environ['GEMINI_API_KEY']
    url = f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}'
    response = requests.get(url, timeout=10)
    if response.status_code == 200:
        print('Gemini API connection successful')
        exit(0)
    else:
        print(f'Gemini API returned status code: {response.status_code}')
        exit(1)
except Exception as e:
    print(f'Gemini API connection failed: {e}')
    exit(1)
" 2>/dev/null; then
        success "Gemini API connection verified"
    else
        warn "Gemini API check failed, but continuing startup..."
    fi
}

# Initialize logging directory
setup_logging() {
    log "Setting up logging..."
    
    mkdir -p /app/logs
    touch /app/logs/application.log
    touch /app/logs/error.log
    touch /app/logs/access.log
    
    # Set proper permissions
    chmod 644 /app/logs/*.log
    
    success "Logging setup complete"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    if [[ -f "alembic.ini" ]]; then
        python -m alembic upgrade head
        success "Database migrations completed"
    else
        warn "No alembic.ini found, skipping migrations"
    fi
}

# Warm up the application
warmup_application() {
    log "Warming up application..."
    
    # Pre-import heavy modules
    python -c "
import asyncio
import aiohttp
import fastapi
import uvicorn
print('Core modules imported successfully')
" 2>/dev/null
    
    success "Application warmup complete"
}

# Start monitoring
start_monitoring() {
    log "Starting monitoring services..."
    
    # Start Prometheus metrics endpoint in background
    if [[ "${MONITORING_ENABLED:-true}" == "true" ]]; then
        python -c "
from prometheus_client import start_http_server
import os
port = int(os.environ.get('METRICS_PORT', 9090))
start_http_server(port)
print(f'Metrics server started on port {port}')
" &
        
        success "Monitoring services started"
    else
        log "Monitoring disabled"
    fi
}

# Health check function
health_check() {
    log "Performing initial health check..."
    
    # Wait for application to start
    sleep 5
    
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:3005/health >/dev/null 2>&1; then
            success "Health check passed"
            return 0
        fi
        
        warn "Health check attempt $attempt/$max_attempts failed, retrying in 3 seconds..."
        sleep 3
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

# Signal handlers for graceful shutdown
cleanup() {
    log "Received shutdown signal, cleaning up..."
    
    # Kill background processes
    jobs -p | xargs -r kill
    
    # Additional cleanup if needed
    
    success "Cleanup complete"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Main execution
main() {
    log "Starting X Marketing Platform LLM Service..."
    log "Environment: ${NODE_ENV:-development}"
    log "Version: ${VERSION:-unknown}"
    
    # Run all checks
    validate_environment
    setup_logging
    check_database
    check_redis
    check_gemini_api
    run_migrations
    warmup_application
    start_monitoring
    
    success "All startup checks passed, starting application..."
    
    # Start the application based on environment
    if [[ "${NODE_ENV}" == "production" ]]; then
        log "Starting production server with Gunicorn..."
        exec gunicorn fastapi_app:app \
            --worker-class uvicorn.workers.UvicornWorker \
            --workers ${WORKERS:-4} \
            --bind 0.0.0.0:3005 \
            --timeout ${TIMEOUT:-120} \
            --keep-alive ${KEEP_ALIVE:-5} \
            --max-requests ${MAX_REQUESTS:-1000} \
            --max-requests-jitter ${MAX_REQUESTS_JITTER:-100} \
            --preload \
            --access-logfile /app/logs/access.log \
            --error-logfile /app/logs/error.log \
            --log-level ${LOG_LEVEL:-info} \
            --capture-output
    else
        log "Starting development server with Uvicorn..."
        exec uvicorn fastapi_app:app \
            --host 0.0.0.0 \
            --port 3005 \
            --log-level ${LOG_LEVEL:-info} \
            --access-log \
            --reload
    fi
}

# Execute main function
main "$@"
