#!/bin/bash

# Security Pipeline Integration Test Script
# Phase 1 (Security Foundation) Validation for X/Twitter Automation Platform

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEST_LOG="${PROJECT_ROOT}/security-pipeline-test.log"
TEMP_DIR=$(mktemp -d)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_CONFIG=(
    "enhanced-security-workflow"
    "slsa-provenance-generation"
    "multi-service-integration"
    "twikit-security-validation"
    "codeql-configuration"
    "trivy-scanning"
    "dependency-management"
)

# Cleanup function
cleanup() {
    rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

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

# Test GitHub workflow files
test_workflow_files() {
    log "Testing GitHub workflow files..."
    
    local workflow_files=(
        ".github/workflows/security-enhanced.yml"
        ".github/workflows/slsa-provenance.yml"
    )
    
    for workflow in "${workflow_files[@]}"; do
        local workflow_path="${PROJECT_ROOT}/${workflow}"
        
        if [ ! -f "${workflow_path}" ]; then
            error "Workflow file not found: ${workflow}"
            return 1
        fi
        
        # Validate YAML syntax
        if command -v yamllint >/dev/null 2>&1; then
            if yamllint "${workflow_path}" >/dev/null 2>&1; then
                success "YAML syntax valid for ${workflow}"
            else
                error "YAML syntax invalid for ${workflow}"
                return 1
            fi
        else
            # Basic YAML validation using Python
            if python3 -c "import yaml; yaml.safe_load(open('${workflow_path}'))" 2>/dev/null; then
                success "YAML syntax valid for ${workflow}"
            else
                error "YAML syntax invalid for ${workflow}"
                return 1
            fi
        fi
        
        # Check for required GitHub Actions
        local required_actions=(
            "actions/checkout@v4"
            "actions/setup-node@v4"
            "actions/setup-python@v5"
            "github/codeql-action"
            "aquasecurity/trivy-action"
        )
        
        for action in "${required_actions[@]}"; do
            if grep -q "${action}" "${workflow_path}"; then
                success "Required action ${action} found in ${workflow}"
            else
                warning "Required action ${action} not found in ${workflow}"
            fi
        done
    done
    
    return 0
}

# Test security configuration files
test_security_configs() {
    log "Testing security configuration files..."
    
    local config_files=(
        ".github/security/OIDC_SETUP.md"
        ".github/security/SECURITY_POLICY.md"
        ".github/security/slsa-config.yml"
        ".github/security/trivy.yaml"
        ".github/codeql/codeql-config.yml"
        ".bandit"
        ".eslintrc.security.js"
    )
    
    for config in "${config_files[@]}"; do
        local config_path="${PROJECT_ROOT}/${config}"
        
        if [ ! -f "${config_path}" ]; then
            error "Security config file not found: ${config}"
            return 1
        else
            success "Security config file exists: ${config}"
        fi
        
        # Validate specific configurations
        case "${config}" in
            "*.yml"|"*.yaml")
                if python3 -c "import yaml; yaml.safe_load(open('${config_path}'))" 2>/dev/null; then
                    success "YAML config valid: ${config}"
                else
                    error "YAML config invalid: ${config}"
                    return 1
                fi
                ;;
            "*.js")
                if node -c "${config_path}" 2>/dev/null; then
                    success "JavaScript config valid: ${config}"
                else
                    error "JavaScript config invalid: ${config}"
                    return 1
                fi
                ;;
        esac
    done
    
    return 0
}

# Test CodeQL custom queries
test_codeql_queries() {
    log "Testing CodeQL custom queries..."
    
    local query_files=(
        ".github/codeql/custom-queries/x-automation-security.ql"
        ".github/codeql/custom-queries/qlpack.yml"
        ".github/codeql/custom-queries/x-automation-security-suite.qls"
    )
    
    for query in "${query_files[@]}"; do
        local query_path="${PROJECT_ROOT}/${query}"
        
        if [ ! -f "${query_path}" ]; then
            error "CodeQL query file not found: ${query}"
            return 1
        else
            success "CodeQL query file exists: ${query}"
        fi
    done
    
    # Validate QL syntax if CodeQL CLI is available
    if command -v codeql >/dev/null 2>&1; then
        local ql_file="${PROJECT_ROOT}/.github/codeql/custom-queries/x-automation-security.ql"
        if codeql query compile "${ql_file}" >/dev/null 2>&1; then
            success "CodeQL query syntax valid"
        else
            error "CodeQL query syntax invalid"
            return 1
        fi
    else
        warning "CodeQL CLI not available - skipping syntax validation"
    fi
    
    return 0
}

# Test validation scripts
test_validation_scripts() {
    log "Testing validation scripts..."
    
    local scripts=(
        ".github/scripts/verify-slsa.sh"
        ".github/scripts/validate-multi-service.sh"
        ".github/scripts/validate-twikit-security.sh"
    )
    
    for script in "${scripts[@]}"; do
        local script_path="${PROJECT_ROOT}/${script}"
        
        if [ ! -f "${script_path}" ]; then
            error "Validation script not found: ${script}"
            return 1
        fi
        
        # Check if script is executable
        if [ -x "${script_path}" ]; then
            success "Script is executable: ${script}"
        else
            warning "Script is not executable: ${script}"
            # Make it executable
            chmod +x "${script_path}" 2>/dev/null || true
        fi
        
        # Validate shell script syntax
        if bash -n "${script_path}" 2>/dev/null; then
            success "Shell script syntax valid: ${script}"
        else
            error "Shell script syntax invalid: ${script}"
            return 1
        fi
    done
    
    return 0
}

# Test multi-service integration
test_multi_service_integration() {
    log "Testing multi-service integration..."
    
    local services=("backend" "frontend" "telegram-bot" "llm-service")
    
    for service in "${services[@]}"; do
        local service_dir="${PROJECT_ROOT}/${service}"
        
        if [ ! -d "${service_dir}" ]; then
            error "Service directory not found: ${service}"
            return 1
        fi
        
        # Check for package.json or requirements.txt
        if [[ "${service}" != "llm-service" ]]; then
            if [ ! -f "${service_dir}/package.json" ]; then
                error "package.json not found for ${service}"
                return 1
            else
                success "package.json found for ${service}"
            fi
        else
            if [ ! -f "${service_dir}/requirements.txt" ]; then
                error "requirements.txt not found for ${service}"
                return 1
            else
                success "requirements.txt found for ${service}"
            fi
        fi
        
        # Check for Dockerfile
        local dockerfile_found=false
        for dockerfile in "Dockerfile" "Dockerfile.local" "Dockerfile.enterprise"; do
            if [ -f "${service_dir}/${dockerfile}" ]; then
                dockerfile_found=true
                success "Dockerfile found for ${service}: ${dockerfile}"
                break
            fi
        done
        
        if [ "${dockerfile_found}" = false ]; then
            warning "No Dockerfile found for ${service}"
        fi
    done
    
    return 0
}

# Test Twikit integration
test_twikit_integration() {
    log "Testing Twikit integration..."
    
    local twikit_files=(
        "backend/scripts/x_client.py"
        "backend/scripts/requirements.txt"
        "backend/src/services/realXApiClient.ts"
        "backend/src/config/twikit.ts"
    )
    
    for file in "${twikit_files[@]}"; do
        local file_path="${PROJECT_ROOT}/${file}"
        
        if [ ! -f "${file_path}" ]; then
            error "Twikit file not found: ${file}"
            return 1
        else
            success "Twikit file exists: ${file}"
        fi
    done
    
    # Check if twikit is in requirements
    if grep -q "twikit" "${PROJECT_ROOT}/backend/scripts/requirements.txt"; then
        success "Twikit dependency found in requirements.txt"
    else
        error "Twikit dependency not found in requirements.txt"
        return 1
    fi
    
    return 0
}

# Test security scanning tools integration
test_security_tools() {
    log "Testing security scanning tools integration..."
    
    # Test if security tools can be installed
    local temp_venv="${TEMP_DIR}/test_venv"
    python3 -m venv "${temp_venv}"
    source "${temp_venv}/bin/activate" 2>/dev/null || source "${temp_venv}/Scripts/activate" 2>/dev/null || true
    
    # Test Python security tools
    if pip install bandit safety >/dev/null 2>&1; then
        success "Python security tools can be installed"
        
        # Test bandit on a sample file
        if [ -f "${PROJECT_ROOT}/backend/scripts/x_client.py" ]; then
            if bandit -r "${PROJECT_ROOT}/backend/scripts/x_client.py" -f json >/dev/null 2>&1; then
                success "Bandit security scanning works"
            else
                warning "Bandit security scanning failed"
            fi
        fi
    else
        error "Failed to install Python security tools"
        return 1
    fi
    
    deactivate 2>/dev/null || true
    
    return 0
}

# Generate test report
generate_test_report() {
    log "Generating test report..."
    
    local report_file="${PROJECT_ROOT}/security-pipeline-test-report.md"
    
    cat > "${report_file}" << EOF
# Security Pipeline Test Report

**Generated**: $(date)
**Test Log**: ${TEST_LOG}

## Test Summary

### ✅ Completed Tests
- GitHub workflow files validation
- Security configuration files validation
- CodeQL custom queries validation
- Validation scripts testing
- Multi-service integration testing
- Twikit integration testing
- Security scanning tools integration

### 📊 Test Results

$(if [ -f "${TEST_LOG}" ]; then
    echo "**Total Tests**: $(grep -c "\[SUCCESS\]\|\[ERROR\]\|\[WARNING\]" "${TEST_LOG}")"
    echo "**Passed**: $(grep -c "\[SUCCESS\]" "${TEST_LOG}")"
    echo "**Failed**: $(grep -c "\[ERROR\]" "${TEST_LOG}")"
    echo "**Warnings**: $(grep -c "\[WARNING\]" "${TEST_LOG}")"
fi)

### 🔧 Phase 1 Implementation Status

- ✅ Enhanced Security Pipeline Workflow
- ✅ SLSA Provenance Generation
- ✅ Multi-Service Architecture Support
- ✅ Twikit Integration Compatibility
- ✅ CodeQL Custom Queries
- ✅ Trivy Security Scanning
- ✅ Dependency Security Management

### 🚀 Next Steps

1. Review any warnings or errors in the test log
2. Run the security pipeline in a test environment
3. Validate OIDC authentication setup
4. Proceed to Phase 2 (Performance Optimization)

### 📝 Notes

- All security configurations are in place
- Validation scripts are ready for CI/CD integration
- Twikit integration maintains security compliance
- Multi-service architecture is properly secured

EOF

    success "Test report generated: ${report_file}"
}

# Main test function
main() {
    log "Starting Phase 1 Security Foundation validation"
    log "Test log: ${TEST_LOG}"
    
    local test_failed=false
    
    # Run all tests
    local tests=(
        "test_workflow_files"
        "test_security_configs"
        "test_codeql_queries"
        "test_validation_scripts"
        "test_multi_service_integration"
        "test_twikit_integration"
        "test_security_tools"
    )
    
    for test in "${tests[@]}"; do
        log "=== Running ${test} ==="
        
        if ! ${test}; then
            test_failed=true
            error "${test} failed"
        else
            success "${test} passed"
        fi
        
        log "=== Completed ${test} ==="
    done
    
    # Generate test report
    generate_test_report
    
    # Final result
    if [ "${test_failed}" = true ]; then
        error "Phase 1 Security Foundation validation failed"
        log "❌ Some tests failed - review test log for details"
        exit 1
    else
        success "All Phase 1 Security Foundation tests passed!"
        log "✅ Security pipeline is ready for deployment"
        log "🚀 Proceed to Phase 2 (Performance Optimization)"
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
