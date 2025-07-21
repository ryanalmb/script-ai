#!/bin/bash

# User Management Service - Startup Script
# Enterprise microservice startup with comprehensive error checking

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local host=${3:-localhost}
    
    if nc -z $host $port 2>/dev/null; then
        log_success "$service_name is running on $host:$port"
        return 0
    else
        log_error "$service_name is not running on $host:$port"
        return 1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local host=${3:-localhost}
    local timeout=${4:-30}
    
    log_info "Waiting for $service_name to be ready on $host:$port..."
    
    local count=0
    while [ $count -lt $timeout ]; do
        if nc -z $host $port 2>/dev/null; then
            log_success "$service_name is ready!"
            return 0
        fi
        
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    echo ""
    log_error "$service_name failed to start within $timeout seconds"
    return 1
}

# Main startup function
main() {
    log_info "Starting User Management Service..."
    
    # Check if we're in the correct directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Please run this script from the user-management-service directory."
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 20+ to continue."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js version 20+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    log_success "Node.js version: $(node -v)"
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            log_error "Failed to install dependencies"
            exit 1
        fi
        log_success "Dependencies installed successfully"
    fi
    
    # Check if environment file exists
    if [ ! -f ".env.local" ]; then
        log_warning ".env.local not found. Creating from template..."
        if [ -f ".env.template" ]; then
            cp .env.template .env.local
            log_info "Please configure .env.local with your settings"
        else
            log_error "No environment template found"
            exit 1
        fi
    fi
    
    # Load environment variables
    if [ -f ".env.local" ]; then
        export $(cat .env.local | grep -v '^#' | xargs)
    fi
    
    # Check required environment variables
    REQUIRED_VARS=(
        "DATABASE_URL"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_success "Environment configuration validated"
    
    # Check database connectivity
    log_info "Checking database connectivity..."
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
        if ! check_service "PostgreSQL" $DB_PORT $DB_HOST; then
            log_error "Database is not accessible. Please ensure PostgreSQL is running."
            exit 1
        fi
    else
        log_warning "Could not parse database connection details from DATABASE_URL"
    fi
    
    # Check Redis connectivity (if not disabled)
    if [ "$DISABLE_REDIS" != "true" ]; then
        log_info "Checking Redis connectivity..."
        REDIS_HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\([^:]*\):.*/\1/p')
        REDIS_PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\).*/\1/p')
        
        if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
            if ! check_service "Redis" $REDIS_PORT $REDIS_HOST; then
                log_warning "Redis is not accessible. Some features may be limited."
            fi
        fi
    fi
    
    # Check Kafka connectivity (if not disabled)
    if [ "$DISABLE_KAFKA" != "true" ]; then
        log_info "Checking Kafka connectivity..."
        KAFKA_HOST=$(echo $KAFKA_BROKERS | cut -d':' -f1)
        KAFKA_PORT=$(echo $KAFKA_BROKERS | cut -d':' -f2)
        
        if [ -n "$KAFKA_HOST" ] && [ -n "$KAFKA_PORT" ]; then
            if ! check_service "Kafka" $KAFKA_PORT $KAFKA_HOST; then
                log_warning "Kafka is not accessible. Event publishing will be disabled."
            fi
        fi
    fi
    
    # Build TypeScript if needed
    if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
        log_info "Building TypeScript..."
        npm run build
        if [ $? -ne 0 ]; then
            log_error "TypeScript build failed"
            exit 1
        fi
        log_success "TypeScript build completed"
    fi
    
    # Start the service
    log_info "Starting User Management Service on port $PORT..."
    
    if [ "$NODE_ENV" = "development" ]; then
        log_info "Starting in development mode with hot reload..."
        npm run dev
    else
        log_info "Starting in production mode..."
        npm start
    fi
}

# Handle script interruption
trap 'log_info "Shutting down..."; exit 0' INT TERM

# Run main function
main "$@"
