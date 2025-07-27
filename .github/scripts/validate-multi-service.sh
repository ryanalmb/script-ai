#!/bin/bash

# Multi-Service Architecture Validation Script
# For X/Twitter Automation Platform Security Pipeline Integration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VALIDATION_LOG="${PROJECT_ROOT}/multi-service-validation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Services configuration
declare -A SERVICES=(
    ["backend"]="Node.js TypeScript Express API"
    ["frontend"]="Next.js React TypeScript"
    ["telegram-bot"]="Node.js TypeScript Telegram Bot"
    ["llm-service"]="Python Flask/FastAPI LLM Service"
)

declare -A SERVICE_PORTS=(
    ["backend"]="3001"
    ["frontend"]="3000"
    ["telegram-bot"]="3002"
    ["llm-service"]="3003"
)

declare -A SERVICE_BUILD_COMMANDS=(
    ["backend"]="npm run build"
    ["frontend"]="npm run build"
    ["telegram-bot"]="npm run build"
    ["llm-service"]="python -m py_compile app.py"
)

declare -A SERVICE_TEST_COMMANDS=(
    ["backend"]="npm run test:ci"
    ["frontend"]="npm run test:coverage"
    ["telegram-bot"]="npm test"
    ["llm-service"]="python -m pytest tests/ -v"
)

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${VALIDATION_LOG}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${VALIDATION_LOG}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${VALIDATION_LOG}"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${VALIDATION_LOG}"
}

# Validate service structure
validate_service_structure() {
    local service="$1"
    local service_dir="${PROJECT_ROOT}/${service}"
    
    log "Validating structure for ${service}..."
    
    # Check if service directory exists
    if [ ! -d "${service_dir}" ]; then
        error "Service directory not found: ${service_dir}"
        return 1
    fi
    
    # Check package.json for Node.js services
    if [[ "${service}" != "llm-service" ]]; then
        if [ ! -f "${service_dir}/package.json" ]; then
            error "package.json not found for ${service}"
            return 1
        fi
        
        # Validate required scripts
        local required_scripts=("build" "start" "test")
        for script in "${required_scripts[@]}"; do
            if ! jq -e ".scripts.${script}" "${service_dir}/package.json" >/dev/null 2>&1; then
                warning "Missing script '${script}' in ${service}/package.json"
            fi
        done
    fi
    
    # Check requirements.txt for Python service
    if [[ "${service}" == "llm-service" ]]; then
        if [ ! -f "${service_dir}/requirements.txt" ]; then
            error "requirements.txt not found for ${service}"
            return 1
        fi
    fi
    
    # Check Dockerfile existence
    local dockerfiles=("Dockerfile" "Dockerfile.local" "Dockerfile.enterprise" "Dockerfile.production")
    local dockerfile_found=false
    
    for dockerfile in "${dockerfiles[@]}"; do
        if [ -f "${service_dir}/${dockerfile}" ]; then
            dockerfile_found=true
            break
        fi
    done
    
    if [ "${dockerfile_found}" = false ]; then
        warning "No Dockerfile found for ${service}"
    fi
    
    success "Structure validation passed for ${service}"
    return 0
}

# Validate service dependencies
validate_service_dependencies() {
    local service="$1"
    local service_dir="${PROJECT_ROOT}/${service}"
    
    log "Validating dependencies for ${service}..."
    
    cd "${service_dir}"
    
    if [[ "${service}" != "llm-service" ]]; then
        # Node.js dependency validation
        if [ ! -f "package-lock.json" ]; then
            warning "package-lock.json not found for ${service} - running npm install"
            npm install
        fi
        
        # Check for security vulnerabilities
        log "Running npm audit for ${service}..."
        if npm audit --audit-level=moderate; then
            success "No moderate+ vulnerabilities found in ${service}"
        else
            warning "Vulnerabilities detected in ${service} - check npm audit output"
        fi
        
        # Validate TypeScript configuration
        if [ -f "tsconfig.json" ]; then
            log "Validating TypeScript configuration for ${service}..."
            if npx tsc --noEmit; then
                success "TypeScript validation passed for ${service}"
            else
                error "TypeScript validation failed for ${service}"
                return 1
            fi
        fi
    else
        # Python dependency validation
        log "Validating Python dependencies for ${service}..."
        if pip check; then
            success "Python dependencies are consistent for ${service}"
        else
            warning "Python dependency conflicts detected for ${service}"
        fi
        
        # Check for security vulnerabilities in Python packages
        if command -v safety >/dev/null 2>&1; then
            log "Running safety check for ${service}..."
            if safety check; then
                success "No known vulnerabilities in Python packages for ${service}"
            else
                warning "Vulnerabilities detected in Python packages for ${service}"
            fi
        fi
    fi
    
    cd "${PROJECT_ROOT}"
    return 0
}

# Validate service build process
validate_service_build() {
    local service="$1"
    local service_dir="${PROJECT_ROOT}/${service}"
    local build_command="${SERVICE_BUILD_COMMANDS[$service]}"
    
    log "Validating build process for ${service}..."
    
    cd "${service_dir}"
    
    # Clean previous builds
    if [[ "${service}" != "llm-service" ]]; then
        rm -rf dist/ build/ .next/
    else
        find . -name "*.pyc" -delete
        find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    fi
    
    # Run build command
    log "Running build command: ${build_command}"
    if eval "${build_command}"; then
        success "Build successful for ${service}"
        
        # Validate build artifacts
        if [[ "${service}" == "frontend" ]]; then
            if [ -d ".next" ]; then
                success "Next.js build artifacts found for ${service}"
            else
                error "Next.js build artifacts missing for ${service}"
                return 1
            fi
        elif [[ "${service}" != "llm-service" ]]; then
            if [ -d "dist" ]; then
                success "Build artifacts found for ${service}"
            else
                error "Build artifacts missing for ${service}"
                return 1
            fi
        fi
    else
        error "Build failed for ${service}"
        return 1
    fi
    
    cd "${PROJECT_ROOT}"
    return 0
}

# Validate service security configuration
validate_service_security() {
    local service="$1"
    local service_dir="${PROJECT_ROOT}/${service}"
    
    log "Validating security configuration for ${service}..."
    
    # Check for hardcoded secrets
    log "Scanning for hardcoded secrets in ${service}..."
    local secret_patterns=(
        "api[_-]?key.*=.*['\"][^'\"]{10,}['\"]"
        "secret.*=.*['\"][^'\"]{10,}['\"]"
        "token.*=.*['\"][^'\"]{10,}['\"]"
        "password.*=.*['\"][^'\"]{3,}['\"]"
    )
    
    local secrets_found=false
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -i -E "${pattern}" "${service_dir}/src" "${service_dir}/*.py" 2>/dev/null | grep -v test | grep -v example; then
            secrets_found=true
        fi
    done
    
    if [ "${secrets_found}" = true ]; then
        error "Potential hardcoded secrets found in ${service}"
        return 1
    else
        success "No hardcoded secrets detected in ${service}"
    fi
    
    # Check for secure HTTP usage
    log "Checking for insecure HTTP usage in ${service}..."
    if grep -r -i "http://(?!localhost|127\.0\.0\.1)" "${service_dir}/src" "${service_dir}/*.py" 2>/dev/null | grep -v test; then
        warning "Insecure HTTP usage detected in ${service}"
    else
        success "No insecure HTTP usage detected in ${service}"
    fi
    
    # Service-specific security checks
    case "${service}" in
        "backend")
            # Check for SQL injection protection
            if grep -r -i "prisma\|query" "${service_dir}/src" | grep -v "prisma\." | grep -v "\.query(" | grep "\+" >/dev/null 2>&1; then
                warning "Potential SQL injection risk in ${service}"
            fi
            ;;
        "telegram-bot")
            # Check for command injection protection
            if grep -r -i "exec\|eval" "${service_dir}/src" | grep -v "test" >/dev/null 2>&1; then
                warning "Potential command injection risk in ${service}"
            fi
            ;;
        "llm-service")
            # Check for secure session handling
            if grep -r -i "save_cookies" "${service_dir}" | grep -v "encrypt" >/dev/null 2>&1; then
                warning "Potentially insecure session handling in ${service}"
            fi
            ;;
    esac
    
    return 0
}

# Validate inter-service communication
validate_inter_service_communication() {
    log "Validating inter-service communication..."
    
    # Check service discovery configuration
    local services_config_files=(
        "docker-compose.yml"
        "docker-compose.local.yml"
        "docker-compose.enterprise.yml"
    )
    
    for config_file in "${services_config_files[@]}"; do
        if [ -f "${PROJECT_ROOT}/${config_file}" ]; then
            log "Checking service configuration in ${config_file}..."
            
            # Validate that all services are defined
            for service in "${!SERVICES[@]}"; do
                if grep -q "${service}:" "${PROJECT_ROOT}/${config_file}"; then
                    success "Service ${service} found in ${config_file}"
                else
                    warning "Service ${service} not found in ${config_file}"
                fi
            done
            
            # Check for proper networking
            if grep -q "networks:" "${PROJECT_ROOT}/${config_file}"; then
                success "Network configuration found in ${config_file}"
            else
                warning "No network configuration found in ${config_file}"
            fi
        fi
    done
    
    # Validate environment variable consistency
    log "Validating environment variable consistency..."
    local env_files=(
        ".env.example"
        "backend/.env.example"
        "frontend/.env.example"
        "telegram-bot/.env.example"
        "llm-service/.env.example"
    )
    
    for env_file in "${env_files[@]}"; do
        if [ -f "${PROJECT_ROOT}/${env_file}" ]; then
            log "Checking environment variables in ${env_file}..."
            
            # Check for required variables
            local required_vars=("DATABASE_URL" "REDIS_URL" "JWT_SECRET")
            for var in "${required_vars[@]}"; do
                if grep -q "^${var}=" "${PROJECT_ROOT}/${env_file}"; then
                    success "Required variable ${var} found in ${env_file}"
                else
                    warning "Required variable ${var} not found in ${env_file}"
                fi
            done
        fi
    done
    
    return 0
}

# Main validation function
main() {
    log "Starting multi-service architecture validation"
    log "Validation log: ${VALIDATION_LOG}"
    
    local validation_failed=false
    
    # Validate each service
    for service in "${!SERVICES[@]}"; do
        log "=== Validating ${service} (${SERVICES[$service]}) ==="
        
        if ! validate_service_structure "${service}"; then
            validation_failed=true
        fi
        
        if ! validate_service_dependencies "${service}"; then
            validation_failed=true
        fi
        
        if ! validate_service_build "${service}"; then
            validation_failed=true
        fi
        
        if ! validate_service_security "${service}"; then
            validation_failed=true
        fi
        
        log "=== Completed validation for ${service} ==="
    done
    
    # Validate inter-service communication
    if ! validate_inter_service_communication; then
        validation_failed=true
    fi
    
    # Generate validation summary
    log "=== Validation Summary ==="
    log "Services validated: ${!SERVICES[*]}"
    log "Validation log: ${VALIDATION_LOG}"
    
    if [ "${validation_failed}" = true ]; then
        error "Multi-service architecture validation failed"
        exit 1
    else
        success "All multi-service architecture validations passed!"
        log "Multi-service architecture is ready for security pipeline integration"
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
