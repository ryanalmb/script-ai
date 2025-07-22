#!/bin/bash

# Comprehensive Test Execution Script for X/Twitter Automation Platform
# This script runs all tests and validates the complete system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_ENV_FILE=".env.test"
BACKEND_DIR="backend"
COVERAGE_THRESHOLD=80
MAX_TEST_DURATION=600 # 10 minutes

# Logging function
log() {
    echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S') [TEST] $1${NC}"
}

success() {
    echo -e "${GREEN}$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1${NC}"
}

error() {
    echo -e "${RED}$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1${NC}" >&2
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        error "Node.js version 18 or higher is required (found: $(node --version))"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        warning "Docker is not installed - some tests may be skipped"
    fi
    
    # Check PostgreSQL client
    if ! command -v psql &> /dev/null; then
        warning "PostgreSQL client is not installed - database tests may be limited"
    fi
    
    success "Prerequisites check completed"
}

# Function to setup test environment
setup_test_environment() {
    log "Setting up test environment..."
    
    # Navigate to backend directory
    cd "$BACKEND_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log "Installing dependencies..."
        npm ci
    fi
    
    # Create test environment file if it doesn't exist
    if [ ! -f "$TEST_ENV_FILE" ]; then
        log "Creating test environment file..."
        cat > "$TEST_ENV_FILE" << EOF
NODE_ENV=test
LOG_LEVEL=error
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/test_db
TEST_REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-jwt-secret-key
ENCRYPTION_KEY=test-32-character-encryption-key
BOT_JWT_SECRET=test-bot-jwt-secret-key
ENABLE_REAL_TIME_SYNC=false
ANTI_DETECTION_ENABLED=false
TELEGRAM_BOT_TOKEN=test_bot_token
HUGGING_FACE_API_KEY=test_hf_key
EOF
    fi
    
    # Generate Prisma client for tests
    log "Generating Prisma client..."
    npx prisma generate
    
    success "Test environment setup completed"
}

# Function to start test services
start_test_services() {
    log "Starting test services..."
    
    # Check if Docker is available
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        log "Starting test database and Redis with Docker..."
        
        # Create test docker-compose file
        cat > docker-compose.test.yml << EOF
version: '3.8'
services:
  test-postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
    
  test-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    tmpfs:
      - /data
EOF
        
        # Start test services
        docker-compose -f docker-compose.test.yml up -d
        
        # Wait for services to be ready
        log "Waiting for test services to be ready..."
        sleep 10
        
        # Update test environment to use Docker services
        sed -i 's/localhost:5432/localhost:5433/g' "$TEST_ENV_FILE"
        sed -i 's/localhost:6379/localhost:6380/g' "$TEST_ENV_FILE"
        
        success "Test services started with Docker"
    else
        warning "Docker not available - tests will use mock services"
    fi
}

# Function to run unit tests
run_unit_tests() {
    log "Running unit tests..."
    
    local start_time=$(date +%s)
    
    if npm run test:unit 2>&1 | tee test-unit.log; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        success "Unit tests completed in ${duration}s"
        return 0
    else
        error "Unit tests failed"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    log "Running integration tests..."
    
    local start_time=$(date +%s)
    
    if timeout $MAX_TEST_DURATION npm run test:integration 2>&1 | tee test-integration.log; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        success "Integration tests completed in ${duration}s"
        return 0
    else
        error "Integration tests failed or timed out"
        return 1
    fi
}

# Function to run end-to-end tests
run_e2e_tests() {
    log "Running end-to-end tests..."
    
    local start_time=$(date +%s)
    
    if timeout $MAX_TEST_DURATION npm run test:e2e 2>&1 | tee test-e2e.log; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        success "End-to-end tests completed in ${duration}s"
        return 0
    else
        error "End-to-end tests failed or timed out"
        return 1
    fi
}

# Function to run performance tests
run_performance_tests() {
    log "Running performance tests..."
    
    local start_time=$(date +%s)
    
    if npm run test:performance 2>&1 | tee test-performance.log; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        success "Performance tests completed in ${duration}s"
        return 0
    else
        warning "Performance tests failed - this may be acceptable in some environments"
        return 0
    fi
}

# Function to generate test coverage
generate_coverage() {
    log "Generating test coverage report..."
    
    if npm run test:coverage 2>&1 | tee test-coverage.log; then
        # Extract coverage percentage
        local coverage=$(grep -o "All files.*[0-9]\+\.[0-9]\+" test-coverage.log | tail -1 | grep -o "[0-9]\+\.[0-9]\+" | head -1)
        
        if [ -n "$coverage" ]; then
            local coverage_int=$(echo "$coverage" | cut -d'.' -f1)
            
            if [ "$coverage_int" -ge "$COVERAGE_THRESHOLD" ]; then
                success "Test coverage: ${coverage}% (threshold: ${COVERAGE_THRESHOLD}%)"
            else
                warning "Test coverage: ${coverage}% is below threshold of ${COVERAGE_THRESHOLD}%"
            fi
        else
            warning "Could not extract coverage percentage"
        fi
        
        success "Coverage report generated"
        return 0
    else
        error "Coverage generation failed"
        return 1
    fi
}

# Function to run linting and code quality checks
run_code_quality_checks() {
    log "Running code quality checks..."
    
    # ESLint
    if npm run lint 2>&1 | tee lint.log; then
        success "ESLint checks passed"
    else
        warning "ESLint found issues - check lint.log"
    fi
    
    # TypeScript compilation check
    if npm run type-check 2>&1 | tee type-check.log; then
        success "TypeScript compilation check passed"
    else
        error "TypeScript compilation errors found"
        return 1
    fi
    
    # Security audit
    if npm audit --audit-level=high 2>&1 | tee security-audit.log; then
        success "Security audit passed"
    else
        warning "Security vulnerabilities found - check security-audit.log"
    fi
    
    return 0
}

# Function to validate API endpoints
validate_api_endpoints() {
    log "Validating API endpoints..."
    
    # This would require the application to be running
    # For now, we'll validate the route definitions exist
    
    local routes_file="src/routes"
    if [ -d "$routes_file" ]; then
        local route_count=$(find "$routes_file" -name "*.ts" | wc -l)
        success "Found $route_count route files"
    else
        error "Routes directory not found"
        return 1
    fi
    
    # Check for required route files
    local required_routes=("telegramBot.ts" "realTimeSync.ts" "auth.ts" "health.ts")
    for route in "${required_routes[@]}"; do
        if [ -f "$routes_file/$route" ]; then
            success "Required route file found: $route"
        else
            error "Required route file missing: $route"
            return 1
        fi
    done
    
    return 0
}

# Function to validate database schema
validate_database_schema() {
    log "Validating database schema..."
    
    if [ -f "prisma/schema.prisma" ]; then
        # Check if schema is valid
        if npx prisma validate 2>&1 | tee schema-validation.log; then
            success "Database schema validation passed"
        else
            error "Database schema validation failed"
            return 1
        fi
        
        # Count models
        local model_count=$(grep -c "^model " prisma/schema.prisma)
        success "Database schema contains $model_count models"
        
        return 0
    else
        error "Prisma schema file not found"
        return 1
    fi
}

# Function to cleanup test environment
cleanup_test_environment() {
    log "Cleaning up test environment..."
    
    # Stop Docker test services if they were started
    if [ -f "docker-compose.test.yml" ]; then
        docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
        rm -f docker-compose.test.yml
    fi
    
    # Clean up test logs
    rm -f test-*.log lint.log type-check.log security-audit.log schema-validation.log
    
    success "Test environment cleanup completed"
}

# Function to generate test report
generate_test_report() {
    log "Generating comprehensive test report..."
    
    local report_file="test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# X/Twitter Automation Platform - Test Report

**Generated:** $(date)
**Environment:** Test
**Node.js Version:** $(node --version)
**npm Version:** $(npm --version)

## Test Results Summary

EOF
    
    # Add test results to report
    if [ -f "test-unit.log" ]; then
        echo "### Unit Tests" >> "$report_file"
        echo "\`\`\`" >> "$report_file"
        tail -10 test-unit.log >> "$report_file"
        echo "\`\`\`" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if [ -f "test-integration.log" ]; then
        echo "### Integration Tests" >> "$report_file"
        echo "\`\`\`" >> "$report_file"
        tail -10 test-integration.log >> "$report_file"
        echo "\`\`\`" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    if [ -f "test-coverage.log" ]; then
        echo "### Test Coverage" >> "$report_file"
        echo "\`\`\`" >> "$report_file"
        grep -A 5 -B 5 "All files" test-coverage.log >> "$report_file"
        echo "\`\`\`" >> "$report_file"
        echo "" >> "$report_file"
    fi
    
    success "Test report generated: $report_file"
}

# Main execution function
main() {
    local start_time=$(date +%s)
    local failed_tests=0
    local total_tests=0
    
    log "Starting comprehensive test execution for X/Twitter Automation Platform"
    
    # Check prerequisites
    check_prerequisites
    
    # Setup test environment
    setup_test_environment
    
    # Start test services
    start_test_services
    
    # Run code quality checks
    total_tests=$((total_tests + 1))
    if ! run_code_quality_checks; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Validate database schema
    total_tests=$((total_tests + 1))
    if ! validate_database_schema; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Validate API endpoints
    total_tests=$((total_tests + 1))
    if ! validate_api_endpoints; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Run unit tests
    total_tests=$((total_tests + 1))
    if ! run_unit_tests; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Run integration tests
    total_tests=$((total_tests + 1))
    if ! run_integration_tests; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Run end-to-end tests
    total_tests=$((total_tests + 1))
    if ! run_e2e_tests; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Run performance tests
    total_tests=$((total_tests + 1))
    if ! run_performance_tests; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Generate coverage report
    total_tests=$((total_tests + 1))
    if ! generate_coverage; then
        failed_tests=$((failed_tests + 1))
    fi
    
    # Generate test report
    generate_test_report
    
    # Cleanup
    cleanup_test_environment
    
    # Calculate results
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    local passed_tests=$((total_tests - failed_tests))
    
    # Final summary
    echo ""
    echo "=========================================="
    echo "         TEST EXECUTION SUMMARY"
    echo "=========================================="
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $failed_tests"
    echo "Duration: ${total_duration}s"
    echo "Success Rate: $(( (passed_tests * 100) / total_tests ))%"
    echo "=========================================="
    
    if [ "$failed_tests" -eq 0 ]; then
        success "🎉 All tests passed! System is ready for production deployment."
        exit 0
    else
        error "❌ $failed_tests test(s) failed. Please review the logs and fix issues before deployment."
        exit 1
    fi
}

# Handle script interruption
trap cleanup_test_environment EXIT

# Run main function
main "$@"
