#!/bin/bash

# Test Environment Setup Script
# Testing Excellence for X/Twitter Automation Platform

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEST_LOG="${PROJECT_ROOT}/test-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Services
SERVICES=("backend" "frontend" "telegram-bot" "llm-service")

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${TEST_LOG}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${TEST_LOG}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${TEST_LOG}"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${TEST_LOG}"
}

# Help function
show_help() {
    cat << EOF
Test Environment Setup Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  setup-all              Setup test environment for all services
  setup-service <name>   Setup test environment for specific service
  setup-databases        Setup test databases (PostgreSQL, Redis)
  setup-browsers         Setup browsers for E2E testing
  setup-security-tools   Setup security testing tools
  cleanup                Cleanup test environment
  validate               Validate test environment setup

Options:
  --service <name>       Target specific service
  --skip-deps           Skip dependency installation
  --skip-databases      Skip database setup
  --verbose             Enable verbose output

Examples:
  $0 setup-all
  $0 setup-service backend
  $0 setup-databases
  $0 cleanup

EOF
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    SERVICE=""
    SKIP_DEPS=false
    SKIP_DATABASES=false
    VERBOSE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            setup-all|setup-service|setup-databases|setup-browsers|setup-security-tools|cleanup|validate)
                COMMAND="$1"
                if [[ "$1" == "setup-service" ]] && [[ $# -gt 1 ]] && [[ ! "$2" =~ ^-- ]]; then
                    SERVICE="$2"
                    shift
                fi
                ;;
            --service)
                SERVICE="$2"
                shift
                ;;
            --skip-deps)
                SKIP_DEPS=true
                ;;
            --skip-databases)
                SKIP_DATABASES=true
                ;;
            --verbose)
                VERBOSE=true
                ;;
            help|--help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
        shift
    done
}

# Setup test databases
setup_test_databases() {
    log "Setting up test databases..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        error "Docker is required for test database setup"
        return 1
    fi
    
    # Stop existing test containers
    docker stop postgres-test redis-test 2>/dev/null || true
    docker rm postgres-test redis-test 2>/dev/null || true
    
    # Start PostgreSQL test database
    log "Starting PostgreSQL test database..."
    docker run -d \
        --name postgres-test \
        -e POSTGRES_PASSWORD=testpass \
        -e POSTGRES_USER=testuser \
        -e POSTGRES_DB=testdb \
        -p 5432:5432 \
        --health-cmd="pg_isready -U testuser -d testdb" \
        --health-interval=10s \
        --health-timeout=5s \
        --health-retries=5 \
        postgres:15-alpine
    
    # Start Redis test database
    log "Starting Redis test database..."
    docker run -d \
        --name redis-test \
        -p 6379:6379 \
        --health-cmd="redis-cli ping" \
        --health-interval=10s \
        --health-timeout=5s \
        --health-retries=5 \
        redis:7-alpine
    
    # Wait for databases to be ready
    log "Waiting for databases to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec postgres-test pg_isready -U testuser -d testdb >/dev/null 2>&1 && \
           docker exec redis-test redis-cli ping >/dev/null 2>&1; then
            success "Test databases are ready"
            return 0
        fi
        
        log "Waiting for databases... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error "Test databases failed to start within timeout"
    return 1
}

# Setup test environment for a specific service
setup_service_tests() {
    local service="$1"
    
    log "Setting up test environment for service: $service"
    
    if [ ! -d "$PROJECT_ROOT/$service" ]; then
        error "Service directory not found: $service"
        return 1
    fi
    
    cd "$PROJECT_ROOT/$service"
    
    case "$service" in
        "backend"|"frontend"|"telegram-bot")
            setup_nodejs_service_tests "$service"
            ;;
        "llm-service")
            setup_python_service_tests "$service"
            ;;
        *)
            error "Unknown service: $service"
            return 1
            ;;
    esac
}

# Setup Node.js service tests
setup_nodejs_service_tests() {
    local service="$1"
    
    log "Setting up Node.js test environment for $service..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        error "package.json not found in $service directory"
        return 1
    fi
    
    # Install dependencies if not skipped
    if [ "$SKIP_DEPS" = false ]; then
        log "Installing dependencies for $service..."
        npm ci --prefer-offline --no-audit --no-fund
    fi
    
    # Install test-specific dependencies
    log "Installing test dependencies for $service..."
    
    # Common test dependencies
    npm install --save-dev \
        jest \
        @jest/globals \
        jest-environment-node \
        supertest \
        @testing-library/jest-dom \
        jest-coverage-badges \
        cross-env
    
    # Service-specific test dependencies
    case "$service" in
        "backend")
            npm install --save-dev \
                @pact-foundation/pact \
                @pact-foundation/pact-node \
                jest-pact \
                testcontainers \
                @testcontainers/postgresql \
                @testcontainers/redis
            ;;
        "frontend")
            npm install --save-dev \
                @testing-library/react \
                @testing-library/user-event \
                @playwright/test \
                playwright \
                @axe-core/playwright \
                lighthouse \
                puppeteer \
                jest-environment-jsdom
            ;;
        "telegram-bot")
            npm install --save-dev \
                nock \
                @testcontainers/redis \
                telegraf-test
            ;;
    esac
    
    # Create test directories
    log "Creating test directory structure for $service..."
    mkdir -p tests/{unit,integration,e2e,setup,fixtures,factories}
    
    # Create Jest configuration
    create_jest_config "$service"
    
    # Create test setup files
    create_test_setup_files "$service"
    
    # Create sample test files
    create_sample_tests "$service"
    
    success "Node.js test environment setup completed for $service"
}

# Setup Python service tests
setup_python_service_tests() {
    local service="$1"
    
    log "Setting up Python test environment for $service..."
    
    # Check if requirements.txt exists
    if [ ! -f "requirements.txt" ]; then
        error "requirements.txt not found in $service directory"
        return 1
    fi
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        log "Creating virtual environment for $service..."
        python -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies if not skipped
    if [ "$SKIP_DEPS" = false ]; then
        log "Installing dependencies for $service..."
        pip install -r requirements.txt
    fi
    
    # Install test-specific dependencies
    log "Installing test dependencies for $service..."
    pip install \
        pytest \
        pytest-cov \
        pytest-asyncio \
        pytest-mock \
        httpx \
        factory-boy \
        responses \
        locust \
        coverage[toml] \
        testcontainers
    
    # Create test directories
    log "Creating test directory structure for $service..."
    mkdir -p tests/{unit,integration,twikit,performance,fixtures,factories}
    
    # Create pytest configuration
    create_pytest_config "$service"
    
    # Create test setup files
    create_python_test_setup_files "$service"
    
    # Create sample test files
    create_python_sample_tests "$service"
    
    success "Python test environment setup completed for $service"
}

# Create Jest configuration
create_jest_config() {
    local service="$1"
    
    log "Creating Jest configuration for $service..."
    
    cat > jest.config.js << EOF
module.exports = {
  testEnvironment: '$([ "$service" = "frontend" ] && echo "jsdom" || echo "node")',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/config/**',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 95,
      statements: 95
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  testTimeout: 30000,
  maxWorkers: 4,
  verbose: true,
  bail: false,
  forceExit: true,
  detectOpenHandles: true
};
EOF
    
    success "Jest configuration created for $service"
}

# Create pytest configuration
create_pytest_config() {
    local service="$1"
    
    log "Creating pytest configuration for $service..."
    
    cat > pytest.ini << EOF
[tool:pytest]
testpaths = tests
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
addopts = 
    --strict-markers
    --strict-config
    --verbose
    --tb=short
    --cov=src
    --cov-report=term-missing
    --cov-report=html
    --cov-report=xml
    --cov-fail-under=95
    --maxfail=5
    --asyncio-mode=auto
markers =
    unit: Unit tests
    integration: Integration tests
    twikit: Twikit-specific tests
    performance: Performance tests
    slow: Slow-running tests
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
EOF
    
    # Create pyproject.toml for coverage configuration
    cat > pyproject.toml << EOF
[tool.coverage.run]
source = ["src"]
omit = [
    "*/tests/*",
    "*/venv/*",
    "*/migrations/*",
    "*/config/*"
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:"
]
EOF
    
    success "Pytest configuration created for $service"
}

# Create test setup files for Node.js services
create_test_setup_files() {
    local service="$1"
    
    log "Creating test setup files for $service..."
    
    # Jest setup file
    cat > tests/setup/jest.setup.js << 'EOF'
// Jest setup file
const { TextEncoder, TextDecoder } = require('util');

// Global test setup
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/testdb';
process.env.REDIS_URL = 'redis://localhost:6379/0';
process.env.JWT_SECRET = 'test-jwt-secret';

// Global test timeout
jest.setTimeout(30000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});
EOF
    
    # Integration test setup
    cat > tests/setup/integration.js << 'EOF'
// Integration test setup
const { GenericContainer } = require('testcontainers');

let postgresContainer;
let redisContainer;

beforeAll(async () => {
  // Start test containers
  postgresContainer = await new GenericContainer('postgres:15-alpine')
    .withEnvironment({
      POSTGRES_PASSWORD: 'testpass',
      POSTGRES_USER: 'testuser',
      POSTGRES_DB: 'testdb'
    })
    .withExposedPorts(5432)
    .start();
    
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();
    
  // Update environment variables
  process.env.DATABASE_URL = `postgresql://testuser:testpass@localhost:${postgresContainer.getMappedPort(5432)}/testdb`;
  process.env.REDIS_URL = `redis://localhost:${redisContainer.getMappedPort(6379)}/0`;
});

afterAll(async () => {
  // Stop test containers
  if (postgresContainer) {
    await postgresContainer.stop();
  }
  if (redisContainer) {
    await redisContainer.stop();
  }
});
EOF
    
    success "Test setup files created for $service"
}

# Create test setup files for Python services
create_python_test_setup_files() {
    local service="$1"
    
    log "Creating Python test setup files for $service..."
    
    # Pytest conftest.py
    cat > tests/conftest.py << 'EOF'
import pytest
import asyncio
import os
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

# Set test environment
os.environ['ENVIRONMENT'] = 'test'
os.environ['DATABASE_URL'] = 'postgresql://testuser:testpass@localhost:5432/testdb'
os.environ['REDIS_URL'] = 'redis://localhost:6379/0'

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def postgres_container():
    """Start PostgreSQL container for testing."""
    with PostgresContainer("postgres:15-alpine") as postgres:
        yield postgres

@pytest.fixture(scope="session")
def redis_container():
    """Start Redis container for testing."""
    with RedisContainer("redis:7-alpine") as redis:
        yield redis

@pytest.fixture(autouse=True)
def setup_test_environment(postgres_container, redis_container):
    """Setup test environment with database connections."""
    # Update environment variables with container URLs
    os.environ['DATABASE_URL'] = postgres_container.get_connection_url()
    os.environ['REDIS_URL'] = redis_container.get_connection_url()
    
    yield
    
    # Cleanup after test
    # Add any cleanup logic here
EOF
    
    success "Python test setup files created for $service"
}

# Create sample test files
create_sample_tests() {
    local service="$1"
    
    log "Creating sample test files for $service..."
    
    # Unit test sample
    cat > tests/unit/sample.test.js << 'EOF'
// Sample unit test
describe('Sample Unit Tests', () => {
  test('should pass basic test', () => {
    expect(true).toBe(true);
  });
  
  test('should test async function', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
EOF
    
    # Integration test sample
    cat > tests/integration/sample.test.js << 'EOF'
// Sample integration test
const request = require('supertest');

describe('Sample Integration Tests', () => {
  test('should test API endpoint', async () => {
    // This would test actual API endpoints
    expect(true).toBe(true);
  });
});
EOF
    
    success "Sample test files created for $service"
}

# Create Python sample test files
create_python_sample_tests() {
    local service="$1"
    
    log "Creating Python sample test files for $service..."
    
    # Unit test sample
    cat > tests/unit/test_sample.py << 'EOF'
"""Sample unit tests."""
import pytest

class TestSample:
    """Sample test class."""
    
    def test_basic_assertion(self):
        """Test basic assertion."""
        assert True is True
        
    @pytest.mark.asyncio
    async def test_async_function(self):
        """Test async function."""
        result = await self._async_helper()
        assert result == "test"
        
    async def _async_helper(self):
        """Helper async function."""
        return "test"
EOF
    
    # Integration test sample
    cat > tests/integration/test_sample.py << 'EOF'
"""Sample integration tests."""
import pytest
import httpx

class TestIntegration:
    """Sample integration test class."""
    
    @pytest.mark.asyncio
    async def test_api_endpoint(self):
        """Test API endpoint."""
        # This would test actual API endpoints
        assert True is True
EOF
    
    success "Python sample test files created for $service"
}

# Setup browsers for E2E testing
setup_browsers() {
    log "Setting up browsers for E2E testing..."
    
    # Install Playwright browsers
    if command -v npx &> /dev/null; then
        npx playwright install chromium firefox webkit
        success "Playwright browsers installed"
    else
        warning "npx not found, skipping Playwright browser installation"
    fi
    
    # Install Chrome for Lighthouse
    if command -v google-chrome &> /dev/null; then
        success "Chrome already installed"
    else
        log "Installing Chrome for Lighthouse testing..."
        # Chrome installation would be platform-specific
        warning "Chrome installation skipped - install manually if needed"
    fi
}

# Setup security testing tools
setup_security_tools() {
    log "Setting up security testing tools..."
    
    # Install Snyk
    if command -v npm &> /dev/null; then
        npm install -g snyk
        success "Snyk installed"
    fi
    
    # Install Semgrep
    if command -v pip &> /dev/null; then
        pip install semgrep
        success "Semgrep installed"
    fi
    
    # Install Bandit for Python
    if command -v pip &> /dev/null; then
        pip install bandit
        success "Bandit installed"
    fi
}

# Cleanup test environment
cleanup_test_environment() {
    log "Cleaning up test environment..."
    
    # Stop and remove test containers
    docker stop postgres-test redis-test 2>/dev/null || true
    docker rm postgres-test redis-test 2>/dev/null || true
    
    # Remove test artifacts
    find "$PROJECT_ROOT" -name "coverage" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$PROJECT_ROOT" -name "test-results" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$PROJECT_ROOT" -name ".nyc_output" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$PROJECT_ROOT" -name "htmlcov" -type d -exec rm -rf {} + 2>/dev/null || true
    
    success "Test environment cleanup completed"
}

# Validate test environment
validate_test_environment() {
    log "Validating test environment setup..."
    
    local validation_errors=0
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        validation_errors=$((validation_errors + 1))
    else
        success "Docker is available"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        validation_errors=$((validation_errors + 1))
    else
        success "Node.js is available: $(node --version)"
    fi
    
    # Check Python
    if ! command -v python &> /dev/null; then
        error "Python is not installed"
        validation_errors=$((validation_errors + 1))
    else
        success "Python is available: $(python --version)"
    fi
    
    # Check test databases
    if docker ps | grep -q postgres-test; then
        success "PostgreSQL test database is running"
    else
        warning "PostgreSQL test database is not running"
    fi
    
    if docker ps | grep -q redis-test; then
        success "Redis test database is running"
    else
        warning "Redis test database is not running"
    fi
    
    # Validate service test setups
    for service in "${SERVICES[@]}"; do
        if [ -d "$PROJECT_ROOT/$service" ]; then
            log "Validating $service test setup..."
            
            cd "$PROJECT_ROOT/$service"
            
            if [ "$service" = "llm-service" ]; then
                # Python service validation
                if [ -f "pytest.ini" ]; then
                    success "$service: pytest configuration found"
                else
                    error "$service: pytest configuration missing"
                    validation_errors=$((validation_errors + 1))
                fi
            else
                # Node.js service validation
                if [ -f "jest.config.js" ]; then
                    success "$service: Jest configuration found"
                else
                    error "$service: Jest configuration missing"
                    validation_errors=$((validation_errors + 1))
                fi
            fi
            
            if [ -d "tests" ]; then
                success "$service: test directory found"
            else
                error "$service: test directory missing"
                validation_errors=$((validation_errors + 1))
            fi
        fi
    done
    
    # Summary
    if [ $validation_errors -eq 0 ]; then
        success "Test environment validation passed"
        return 0
    else
        error "Test environment validation failed with $validation_errors error(s)"
        return 1
    fi
}

# Main function
main() {
    log "Starting test environment setup"
    log "Command: ${COMMAND:-none}"
    
    case "${COMMAND:-}" in
        "setup-all")
            if [ "$SKIP_DATABASES" = false ]; then
                setup_test_databases
            fi
            
            for service in "${SERVICES[@]}"; do
                setup_service_tests "$service"
            done
            
            setup_browsers
            setup_security_tools
            ;;
        "setup-service")
            if [ -z "$SERVICE" ]; then
                error "Service name required for setup-service command"
                show_help
                exit 1
            fi
            setup_service_tests "$SERVICE"
            ;;
        "setup-databases")
            setup_test_databases
            ;;
        "setup-browsers")
            setup_browsers
            ;;
        "setup-security-tools")
            setup_security_tools
            ;;
        "cleanup")
            cleanup_test_environment
            ;;
        "validate")
            validate_test_environment
            ;;
        "")
            show_help
            ;;
        *)
            error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Parse arguments and run main function
parse_args "$@"
main
