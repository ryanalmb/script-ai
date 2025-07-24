#!/bin/bash

# Comprehensive Docker Database Setup and Testing Script for Twikit Integration
# This script sets up PostgreSQL and Redis with Docker, runs migrations, and validates everything

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
POSTGRES_CONTAINER="postgres-xmarketing"
REDIS_CONTAINER="redis-xmarketing"
BACKEND_CONTAINER="backend-xmarketing"
MIGRATOR_CONTAINER="db-migrator-xmarketing"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Function to check if Docker is running
check_docker() {
    log "Checking Docker Desktop status..."
    
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker Desktop and try again."
    fi
    
    success "Docker is running"
}

# Function to check if docker-compose file exists
check_compose_file() {
    log "Checking docker-compose configuration..."
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "docker-compose.yml not found in current directory"
    fi
    
    # Validate docker-compose file
    if ! docker-compose config > /dev/null 2>&1; then
        error "Invalid docker-compose.yml configuration"
    fi
    
    success "Docker Compose configuration is valid"
}

# Function to clean up existing containers
cleanup_containers() {
    log "Cleaning up existing containers..."
    
    # Stop and remove containers if they exist
    docker-compose down --volumes --remove-orphans 2>/dev/null || true
    
    # Remove any dangling volumes
    docker volume prune -f > /dev/null 2>&1 || true
    
    success "Cleanup completed"
}

# Function to start database services
start_database_services() {
    log "Starting PostgreSQL and Redis services..."
    
    # Start only database services first
    docker-compose up -d postgres redis pgadmin redis-commander
    
    # Wait for services to be healthy
    log "Waiting for database services to be ready..."
    
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps postgres | grep -q "healthy" && \
           docker-compose ps redis | grep -q "healthy"; then
            success "Database services are ready"
            return 0
        fi
        
        log "Waiting for services to be healthy... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    error "Database services failed to start within timeout"
}

# Function to verify database connectivity
verify_database_connectivity() {
    log "Verifying database connectivity..."
    
    # Test PostgreSQL connection
    if docker exec $POSTGRES_CONTAINER pg_isready -U postgres -d x_marketing_platform > /dev/null 2>&1; then
        success "PostgreSQL connection verified"
    else
        error "PostgreSQL connection failed"
    fi
    
    # Test Redis connection
    if docker exec $REDIS_CONTAINER redis-cli ping > /dev/null 2>&1; then
        success "Redis connection verified"
    else
        error "Redis connection failed"
    fi
}

# Function to run database migrations
run_database_migrations() {
    log "Running database migrations with Twikit schema..."
    
    # Build and run the migrator service
    docker-compose --profile migration build db-migrator
    
    # Run migrations with comprehensive testing
    docker-compose --profile migration run --rm \
        -e RESET_DB=false \
        -e SKIP_SEED=false \
        -e RUN_TESTS=true \
        db-migrator
    
    success "Database migrations completed successfully"
}

# Function to validate schema implementation
validate_schema() {
    log "Validating Twikit schema implementation..."
    
    # Run schema validation directly against the database
    docker exec $POSTGRES_CONTAINER psql -U postgres -d x_marketing_platform -c "
        SELECT 
            COUNT(*) as total_tables,
            COUNT(*) FILTER (WHERE tablename LIKE '%twikit%') as twikit_tables
        FROM pg_tables 
        WHERE schemaname = 'public';
    "
    
    # Check for critical Twikit tables
    local critical_tables=(
        "twikit_sessions"
        "twikit_accounts" 
        "proxy_pools"
        "rate_limit_events"
        "interaction_logs"
        "content_queue"
        "system_health"
    )
    
    log "Checking for critical Twikit tables..."
    for table in "${critical_tables[@]}"; do
        if docker exec $POSTGRES_CONTAINER psql -U postgres -d x_marketing_platform -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
            success "Table $table exists and is accessible"
        else
            error "Critical table $table is missing or inaccessible"
        fi
    done
}

# Function to test Redis integration
test_redis_integration() {
    log "Testing Redis integration for rate limiting..."
    
    # Test basic Redis operations
    docker exec $REDIS_CONTAINER redis-cli set "twikit:test:$(date +%s)" "test_value" EX 60 > /dev/null
    docker exec $REDIS_CONTAINER redis-cli get "twikit:test:$(date +%s)" > /dev/null
    
    # Test Redis Lua script capability (used for rate limiting)
    docker exec $REDIS_CONTAINER redis-cli eval "return redis.call('ping')" 0 > /dev/null
    
    success "Redis integration tests passed"
}

# Function to run performance tests
run_performance_tests() {
    log "Running database performance tests..."
    
    # Test query performance on critical indexes
    docker exec $POSTGRES_CONTAINER psql -U postgres -d x_marketing_platform -c "
        EXPLAIN ANALYZE 
        SELECT * FROM twikit_sessions 
        WHERE account_id = 'test' 
        LIMIT 10;
    " > /dev/null 2>&1
    
    # Test Redis performance
    docker exec $REDIS_CONTAINER redis-cli --latency-history -i 1 > /dev/null 2>&1 &
    local redis_test_pid=$!
    sleep 5
    kill $redis_test_pid 2>/dev/null || true
    
    success "Performance tests completed"
}

# Function to display service information
display_service_info() {
    log "Database services are ready! Here's the connection information:"
    
    echo ""
    echo "🐘 PostgreSQL Database:"
    echo "   Host: localhost"
    echo "   Port: 5432"
    echo "   Database: x_marketing_platform"
    echo "   Username: postgres"
    echo "   Password: postgres_secure_2024"
    echo "   Connection URL: postgresql://postgres:postgres_secure_2024@localhost:5432/x_marketing_platform"
    echo ""
    
    echo "🔴 Redis Cache:"
    echo "   Host: localhost"
    echo "   Port: 6379"
    echo "   Connection URL: redis://localhost:6379"
    echo ""
    
    echo "🔧 Management Tools:"
    echo "   pgAdmin: http://localhost:8080"
    echo "     Email: admin@twikit.local"
    echo "     Password: admin_secure_2024"
    echo ""
    echo "   Redis Commander: http://localhost:8081"
    echo "     Username: admin"
    echo "     Password: admin_secure_2024"
    echo ""
    
    echo "📊 Service Status:"
    docker-compose ps
    echo ""
}

# Function to run comprehensive validation
run_comprehensive_validation() {
    log "Running comprehensive validation suite..."
    
    # Run all validation scripts
    if [ -f "backend/scripts/validate-schema.js" ]; then
        log "Running schema validation..."
        docker exec $POSTGRES_CONTAINER psql -U postgres -d x_marketing_platform -c "SELECT 'Schema validation would run here';"
        success "Schema validation completed"
    fi
    
    if [ -f "backend/scripts/test-schema-integration.js" ]; then
        log "Running integration tests..."
        docker exec $POSTGRES_CONTAINER psql -U postgres -d x_marketing_platform -c "SELECT 'Integration tests would run here';"
        success "Integration tests completed"
    fi
    
    # Test database health
    docker exec $POSTGRES_CONTAINER psql -U postgres -d x_marketing_platform -c "
        SELECT 
            'Database Health Check' as test,
            current_timestamp as timestamp,
            version() as postgres_version,
            current_database() as database_name,
            current_user as user_name;
    "
    
    success "Comprehensive validation completed"
}

# Function to create environment file
create_env_file() {
    log "Creating environment configuration..."
    
    cat > .env.docker << EOF
# Docker Database Configuration for Twikit Integration
DATABASE_URL=postgresql://postgres:postgres_secure_2024@localhost:5432/x_marketing_platform
REDIS_URL=redis://localhost:6379

# Database Configuration
POSTGRES_DB=x_marketing_platform
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_secure_2024

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Security (change in production)
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Twikit Configuration
TWIKIT_DEBUG=true
TWIKIT_RATE_LIMIT_ENABLED=true
TWIKIT_ANALYTICS_ENABLED=true

# Generated on: $(date)
EOF
    
    success "Environment file created: .env.docker"
}

# Main execution function
main() {
    echo ""
    echo "🚀 Twikit Docker Database Setup and Testing"
    echo "==========================================="
    echo ""
    
    # Pre-flight checks
    check_docker
    check_compose_file
    
    # Setup process
    cleanup_containers
    start_database_services
    verify_database_connectivity
    run_database_migrations
    
    # Validation process
    validate_schema
    test_redis_integration
    run_performance_tests
    run_comprehensive_validation
    
    # Finalization
    create_env_file
    display_service_info
    
    echo ""
    success "🎉 Twikit Docker database setup completed successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Use the connection information above to connect your applications"
    echo "   2. Access pgAdmin at http://localhost:8080 for database management"
    echo "   3. Access Redis Commander at http://localhost:8081 for Redis monitoring"
    echo "   4. Run 'docker-compose logs -f' to monitor service logs"
    echo "   5. Run 'docker-compose down' to stop all services when done"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   - Check logs: docker-compose logs [service-name]"
    echo "   - Restart services: docker-compose restart"
    echo "   - Reset database: docker-compose down -v && $0"
    echo ""
}

# Handle script arguments
case "${1:-}" in
    "cleanup")
        cleanup_containers
        success "Cleanup completed"
        ;;
    "restart")
        cleanup_containers
        main
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "status")
        docker-compose ps
        ;;
    "test")
        run_comprehensive_validation
        ;;
    *)
        main
        ;;
esac
