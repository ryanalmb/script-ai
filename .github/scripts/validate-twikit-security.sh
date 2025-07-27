#!/bin/bash

# Twikit Integration Security Validation Script
# For X/Twitter Automation Platform - Enterprise Security Compliance

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VALIDATION_LOG="${PROJECT_ROOT}/twikit-security-validation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Twikit-related files and directories
TWIKIT_FILES=(
    "backend/scripts/x_client.py"
    "backend/scripts/setup-twikit.js"
    "backend/src/services/realXApiClient.ts"
    "backend/src/config/twikit.ts"
    "backend/src/services/twikitSessionManager.ts"
    "backend/src/services/proxyRotationManager.ts"
    "backend/scripts/requirements.txt"
)

TWIKIT_DIRS=(
    "backend/scripts"
    "backend/data/cookies"
    "backend/src/services"
    "backend/src/config"
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

# Validate Twikit installation and dependencies
validate_twikit_dependencies() {
    log "Validating Twikit dependencies..."
    
    # Check if requirements.txt exists
    local requirements_file="${PROJECT_ROOT}/backend/scripts/requirements.txt"
    if [ ! -f "${requirements_file}" ]; then
        error "Twikit requirements.txt not found: ${requirements_file}"
        return 1
    fi
    
    # Check if twikit is in requirements
    if grep -q "twikit" "${requirements_file}"; then
        success "Twikit dependency found in requirements.txt"
    else
        error "Twikit dependency not found in requirements.txt"
        return 1
    fi
    
    # Check for security-related Python packages
    local security_packages=("cryptography" "requests" "aiofiles")
    for package in "${security_packages[@]}"; do
        if grep -q "${package}" "${requirements_file}"; then
            success "Security package ${package} found in requirements"
        else
            warning "Security package ${package} not found in requirements"
        fi
    done
    
    return 0
}

# Validate session management security
validate_session_security() {
    log "Validating Twikit session management security..."
    
    local session_manager="${PROJECT_ROOT}/backend/src/services/twikitSessionManager.ts"
    if [ ! -f "${session_manager}" ]; then
        error "Twikit session manager not found: ${session_manager}"
        return 1
    fi
    
    # Check for secure session storage
    if grep -q "encrypt\|cipher\|crypto" "${session_manager}"; then
        success "Session encryption detected in session manager"
    else
        warning "No session encryption detected in session manager"
    fi
    
    # Check for session timeout handling
    if grep -q "timeout\|expire\|ttl" "${session_manager}"; then
        success "Session timeout handling detected"
    else
        warning "No session timeout handling detected"
    fi
    
    # Check for secure cookie handling
    if grep -q "httpOnly\|secure\|sameSite" "${session_manager}"; then
        success "Secure cookie attributes detected"
    else
        warning "No secure cookie attributes detected"
    fi
    
    # Validate Python client session security
    local python_client="${PROJECT_ROOT}/backend/scripts/x_client.py"
    if [ -f "${python_client}" ]; then
        log "Validating Python client session security..."
        
        # Check for secure session persistence
        if grep -q "save_cookies" "${python_client}" && grep -q "encrypt\|cipher" "${python_client}"; then
            success "Secure session persistence detected in Python client"
        elif grep -q "save_cookies" "${python_client}"; then
            error "Insecure session persistence detected in Python client"
            return 1
        else
            warning "No session persistence detected in Python client"
        fi
    fi
    
    return 0
}

# Validate anti-detection measures
validate_anti_detection() {
    log "Validating Twikit anti-detection measures..."
    
    local anti_detection_files=(
        "backend/src/services/proxyRotationManager.ts"
        "backend/src/config/twikit.ts"
        "backend/scripts/x_client.py"
    )
    
    local anti_detection_patterns=(
        "user[_-]?agent"
        "proxy"
        "rotation"
        "fingerprint"
        "stealth"
        "behavioral"
        "human[_-]?like"
        "detection"
    )
    
    local detection_measures_found=0
    
    for file in "${anti_detection_files[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            log "Checking anti-detection measures in ${file}..."
            
            for pattern in "${anti_detection_patterns[@]}"; do
                if grep -i -q "${pattern}" "${file_path}"; then
                    success "Anti-detection pattern '${pattern}' found in ${file}"
                    ((detection_measures_found++))
                fi
            done
        fi
    done
    
    if [ ${detection_measures_found} -ge 5 ]; then
        success "Comprehensive anti-detection measures detected"
    elif [ ${detection_measures_found} -ge 3 ]; then
        warning "Basic anti-detection measures detected - consider enhancing"
    else
        error "Insufficient anti-detection measures detected"
        return 1
    fi
    
    # Check for proxy rotation implementation
    local proxy_manager="${PROJECT_ROOT}/backend/src/services/proxyRotationManager.ts"
    if [ -f "${proxy_manager}" ]; then
        if grep -q "rotateProxy\|switchProxy" "${proxy_manager}"; then
            success "Proxy rotation functionality detected"
        else
            warning "No proxy rotation functionality detected"
        fi
        
        # Check for proxy health monitoring
        if grep -q "health\|monitor\|check" "${proxy_manager}"; then
            success "Proxy health monitoring detected"
        else
            warning "No proxy health monitoring detected"
        fi
    fi
    
    return 0
}

# Validate rate limiting implementation
validate_rate_limiting() {
    log "Validating Twikit rate limiting implementation..."
    
    local rate_limit_files=(
        "backend/src/config/twikit.ts"
        "backend/src/services/globalRateLimitCoordinator.ts"
        "backend/scripts/x_client.py"
    )
    
    local rate_limit_patterns=(
        "rate[_-]?limit"
        "throttle"
        "delay"
        "sleep"
        "wait"
        "queue"
        "backoff"
    )
    
    local rate_limiting_found=false
    
    for file in "${rate_limit_files[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            log "Checking rate limiting in ${file}..."
            
            for pattern in "${rate_limit_patterns[@]}"; do
                if grep -i -q "${pattern}" "${file_path}"; then
                    success "Rate limiting pattern '${pattern}' found in ${file}"
                    rate_limiting_found=true
                fi
            done
        fi
    done
    
    if [ "${rate_limiting_found}" = true ]; then
        success "Rate limiting implementation detected"
    else
        error "No rate limiting implementation detected"
        return 1
    fi
    
    # Check for distributed rate limiting
    if grep -r -q "redis\|distributed" "${PROJECT_ROOT}/backend/src/services/" --include="*rateLim*"; then
        success "Distributed rate limiting detected"
    else
        warning "No distributed rate limiting detected"
    fi
    
    # Validate rate limit configuration
    local twikit_config="${PROJECT_ROOT}/backend/src/config/twikit.ts"
    if [ -f "${twikit_config}" ]; then
        if grep -q "actionLimits\|rateLimitConfig" "${twikit_config}"; then
            success "Rate limit configuration detected"
        else
            warning "No rate limit configuration detected"
        fi
    fi
    
    return 0
}

# Validate credential security
validate_credential_security() {
    log "Validating Twikit credential security..."
    
    # Check for hardcoded credentials
    local credential_patterns=(
        "password.*=.*['\"][^'\"]{3,}['\"]"
        "api[_-]?key.*=.*['\"][^'\"]{10,}['\"]"
        "secret.*=.*['\"][^'\"]{10,}['\"]"
        "token.*=.*['\"][^'\"]{10,}['\"]"
    )
    
    local hardcoded_found=false
    
    for file in "${TWIKIT_FILES[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            for pattern in "${credential_patterns[@]}"; do
                if grep -i -E "${pattern}" "${file_path}" | grep -v "test\|example\|placeholder"; then
                    error "Potential hardcoded credential found in ${file}"
                    hardcoded_found=true
                fi
            done
        fi
    done
    
    if [ "${hardcoded_found}" = true ]; then
        error "Hardcoded credentials detected - security violation"
        return 1
    else
        success "No hardcoded credentials detected"
    fi
    
    # Check for environment variable usage
    local env_usage_found=false
    for file in "${TWIKIT_FILES[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            if grep -q "process\.env\|os\.environ\|getenv" "${file_path}"; then
                success "Environment variable usage detected in ${file}"
                env_usage_found=true
            fi
        fi
    done
    
    if [ "${env_usage_found}" = false ]; then
        warning "No environment variable usage detected for credentials"
    fi
    
    return 0
}

# Validate error handling and logging
validate_error_handling() {
    log "Validating Twikit error handling and logging..."
    
    local error_handling_patterns=(
        "try.*catch\|except"
        "error.*handling"
        "logger\|logging"
        "throw\|raise"
        "retry\|attempt"
    )
    
    local error_handling_found=false
    
    for file in "${TWIKIT_FILES[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            for pattern in "${error_handling_patterns[@]}"; do
                if grep -i -q "${pattern}" "${file_path}"; then
                    success "Error handling pattern '${pattern}' found in ${file}"
                    error_handling_found=true
                    break
                fi
            done
        fi
    done
    
    if [ "${error_handling_found}" = false ]; then
        warning "Limited error handling detected"
    fi
    
    # Check for secure logging (no sensitive data)
    local sensitive_logging=false
    for file in "${TWIKIT_FILES[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            if grep -i "log.*password\|log.*secret\|log.*token" "${file_path}"; then
                error "Sensitive data logging detected in ${file}"
                sensitive_logging=true
            fi
        fi
    done
    
    if [ "${sensitive_logging}" = false ]; then
        success "No sensitive data logging detected"
    else
        return 1
    fi
    
    return 0
}

# Validate network security
validate_network_security() {
    log "Validating Twikit network security..."
    
    # Check for HTTPS usage
    local insecure_http=false
    for file in "${TWIKIT_FILES[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            if grep -q "http://(?!localhost\|127\.0\.0\.1)" "${file_path}"; then
                warning "Insecure HTTP usage detected in ${file}"
                insecure_http=true
            fi
        fi
    done
    
    if [ "${insecure_http}" = false ]; then
        success "No insecure HTTP usage detected"
    fi
    
    # Check for SSL/TLS configuration
    local ssl_config_found=false
    for file in "${TWIKIT_FILES[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        if [ -f "${file_path}" ]; then
            if grep -q "ssl\|tls\|https\|verify" "${file_path}"; then
                success "SSL/TLS configuration detected in ${file}"
                ssl_config_found=true
            fi
        fi
    done
    
    if [ "${ssl_config_found}" = false ]; then
        warning "No explicit SSL/TLS configuration detected"
    fi
    
    return 0
}

# Main validation function
main() {
    log "Starting Twikit integration security validation"
    log "Validation log: ${VALIDATION_LOG}"
    
    local validation_failed=false
    
    # Run all validation checks
    local validations=(
        "validate_twikit_dependencies"
        "validate_session_security"
        "validate_anti_detection"
        "validate_rate_limiting"
        "validate_credential_security"
        "validate_error_handling"
        "validate_network_security"
    )
    
    for validation in "${validations[@]}"; do
        log "=== Running ${validation} ==="
        
        if ! ${validation}; then
            validation_failed=true
            error "${validation} failed"
        else
            success "${validation} passed"
        fi
        
        log "=== Completed ${validation} ==="
    done
    
    # Generate validation summary
    log "=== Twikit Security Validation Summary ==="
    log "Files validated: ${#TWIKIT_FILES[@]}"
    log "Directories checked: ${#TWIKIT_DIRS[@]}"
    log "Validation log: ${VALIDATION_LOG}"
    
    if [ "${validation_failed}" = true ]; then
        error "Twikit integration security validation failed"
        log "❌ Security issues detected - review and fix before deployment"
        exit 1
    else
        success "All Twikit integration security validations passed!"
        log "✅ Twikit integration is secure and ready for production"
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
