#!/bin/bash
# Simple production startup script for X Marketing Platform

set -e

echo "🚀 Starting X Marketing Platform (Simple Mode)"
echo "=============================================="

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

# Function to clean up existing containers
cleanup_containers() {
    print_info "Cleaning up existing containers..."
    docker rm -f postgres-xmarketing redis-xmarketing backend-xmarketing 2>/dev/null || true
    docker network rm xmarketing-network 2>/dev/null || true
    print_status "Cleanup completed"
}

# Function to create Docker network
create_network() {
    print_info "Creating Docker network..."
    docker network create xmarketing-network 2>/dev/null || true
    print_status "Network created"
}

# Function to start PostgreSQL
start_postgres() {
    print_info "Starting PostgreSQL..."
    docker run -d \
        --name postgres-xmarketing \
        --network xmarketing-network \
        -p 5432:5432 \
        -e POSTGRES_DB=x_marketing_platform \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=password \
        -v postgres_data:/var/lib/postgresql/data \
        postgres:15-alpine
    
    # Wait for PostgreSQL to be ready
    print_info "Waiting for PostgreSQL to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec postgres-xmarketing pg_isready -U postgres -d x_marketing_platform > /dev/null 2>&1; then
            print_status "PostgreSQL is ready!"
            return 0
        fi
        print_info "PostgreSQL not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "PostgreSQL failed to start after $max_attempts attempts"
    return 1
}

# Function to start Redis
start_redis() {
    print_info "Starting Redis..."
    docker run -d \
        --name redis-xmarketing \
        --network xmarketing-network \
        -p 6379:6379 \
        -v redis_data:/data \
        redis:7-alpine redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    
    # Wait for Redis to be ready
    print_info "Waiting for Redis to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec redis-xmarketing redis-cli ping > /dev/null 2>&1; then
            print_status "Redis is ready!"
            return 0
        fi
        print_info "Redis not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Redis failed to start after $max_attempts attempts"
    return 1
}

# Function to start backend
start_backend() {
    print_info "Building and starting backend..."
    
    # Build the backend first
    cd backend
    npm run build
    cd ..
    
    # Start backend container
    docker run -d \
        --name backend-xmarketing \
        --network xmarketing-network \
        -p 3001:3001 \
        -e NODE_ENV=production \
        -e DATABASE_URL=postgresql://postgres:password@postgres-xmarketing:5432/x_marketing_platform \
        -e REDIS_URL=redis://redis-xmarketing:6379 \
        -e JWT_SECRET=your-super-secret-jwt-key \
        -e CSRF_SECRET=your-csrf-secret-key \
        -v $(pwd)/backend:/app \
        -w /app \
        node:18-alpine sh -c "npm install && npm start"
    
    # Wait for backend to be ready
    print_info "Waiting for backend to be ready..."
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/health/live > /dev/null 2>&1; then
            print_status "Backend is ready!"
            return 0
        fi
        print_info "Backend not ready yet (attempt $attempt/$max_attempts)..."
        sleep 3
        attempt=$((attempt + 1))
    done
    
    print_error "Backend failed to start after $max_attempts attempts"
    docker logs backend-xmarketing
    return 1
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
    
    return 0
}

# Function to show service status
show_status() {
    echo ""
    echo "🎯 Service Status:"
    echo "=================="
    echo "PostgreSQL: $(docker ps --filter name=postgres-xmarketing --format 'table {{.Status}}')"
    echo "Redis:      $(docker ps --filter name=redis-xmarketing --format 'table {{.Status}}')"
    echo "Backend:    $(docker ps --filter name=backend-xmarketing --format 'table {{.Status}}')"
    
    echo ""
    echo "🌐 Available Endpoints:"
    echo "======================"
    echo "Backend API:      http://localhost:3001"
    echo "Health Check:     http://localhost:3001/health/live"
    echo "Metrics:          http://localhost:3001/metrics"
    echo "PostgreSQL:       localhost:5432"
    echo "Redis:            localhost:6379"
    
    echo ""
    echo "📊 Quick Health Check:"
    echo "====================="
    if run_health_checks; then
        print_status "All services are healthy!"
    else
        print_warning "Some services may have issues. Check logs with: docker logs [container_name]"
    fi
}

# Main execution
main() {
    echo "Starting production environment setup..."
    
    check_docker
    cleanup_containers
    create_network
    
    if start_postgres && start_redis && start_backend; then
        show_status
        echo ""
        print_status "🎉 X Marketing Platform is now running!"
        echo ""
        echo "To stop the services, run: docker rm -f postgres-xmarketing redis-xmarketing backend-xmarketing"
        echo "To view logs, run: docker logs [container_name]"
    else
        print_error "Failed to start all services"
        exit 1
    fi
}

# Run main function
main "$@"
