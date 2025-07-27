#!/bin/bash

# SLSA Provenance Verification Script
# For X/Twitter Automation Platform - Enterprise Security

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERIFICATION_LOG="${PROJECT_ROOT}/slsa-verification.log"
TEMP_DIR=$(mktemp -d)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${VERIFICATION_LOG}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${VERIFICATION_LOG}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${VERIFICATION_LOG}"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${VERIFICATION_LOG}"
}

# Cleanup function
cleanup() {
    rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

# Check if required tools are installed
check_tools() {
    log "Checking required tools..."
    
    local tools=("slsa-verifier" "cosign" "syft" "jq" "curl")
    local missing_tools=()
    
    for tool in "${tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            missing_tools+=("${tool}")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
        log "Installing missing tools..."
        install_tools "${missing_tools[@]}"
    else
        success "All required tools are installed"
    fi
}

# Install missing tools
install_tools() {
    local tools=("$@")
    
    for tool in "${tools[@]}"; do
        case "${tool}" in
            "slsa-verifier")
                log "Installing SLSA verifier..."
                curl -sSLO https://github.com/slsa-framework/slsa-verifier/releases/latest/download/slsa-verifier-linux-amd64
                chmod +x slsa-verifier-linux-amd64
                sudo mv slsa-verifier-linux-amd64 /usr/local/bin/slsa-verifier
                ;;
            "cosign")
                log "Installing Cosign..."
                curl -sSLO https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
                chmod +x cosign-linux-amd64
                sudo mv cosign-linux-amd64 /usr/local/bin/cosign
                ;;
            "syft")
                log "Installing Syft..."
                curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
                ;;
            "jq")
                log "Installing jq..."
                sudo apt-get update && sudo apt-get install -y jq
                ;;
            *)
                warning "Don't know how to install ${tool}"
                ;;
        esac
    done
}

# Verify SLSA provenance for an artifact
verify_artifact_provenance() {
    local artifact_path="$1"
    local provenance_path="$2"
    local source_uri="$3"
    local source_tag="$4"
    
    log "Verifying SLSA provenance for $(basename "${artifact_path}")..."
    
    if [ ! -f "${artifact_path}" ]; then
        error "Artifact not found: ${artifact_path}"
        return 1
    fi
    
    if [ ! -f "${provenance_path}" ]; then
        error "Provenance not found: ${provenance_path}"
        return 1
    fi
    
    # Verify with SLSA verifier
    if slsa-verifier verify-artifact \
        --provenance-path "${provenance_path}" \
        --source-uri "${source_uri}" \
        --source-tag "${source_tag}" \
        "${artifact_path}"; then
        success "SLSA provenance verified for $(basename "${artifact_path}")"
        return 0
    else
        error "SLSA provenance verification failed for $(basename "${artifact_path}")"
        return 1
    fi
}

# Verify container image provenance
verify_container_provenance() {
    local image_name="$1"
    local image_tag="$2"
    
    log "Verifying container image provenance for ${image_name}:${image_tag}..."
    
    # Get image digest
    local image_digest
    image_digest=$(cosign triangulate "${image_name}:${image_tag}" 2>/dev/null || echo "")
    
    if [ -z "${image_digest}" ]; then
        error "Could not get image digest for ${image_name}:${image_tag}"
        return 1
    fi
    
    # Verify signature
    if cosign verify "${image_name}@${image_digest}" \
        --certificate-identity-regexp="https://github.com/.*/.github/workflows/.*" \
        --certificate-oidc-issuer="https://token.actions.githubusercontent.com"; then
        success "Container signature verified for ${image_name}:${image_tag}"
    else
        error "Container signature verification failed for ${image_name}:${image_tag}"
        return 1
    fi
    
    # Verify attestation
    if cosign verify-attestation "${image_name}@${image_digest}" \
        --type slsaprovenance \
        --certificate-identity-regexp="https://github.com/.*/.github/workflows/.*" \
        --certificate-oidc-issuer="https://token.actions.githubusercontent.com"; then
        success "Container attestation verified for ${image_name}:${image_tag}"
    else
        error "Container attestation verification failed for ${image_name}:${image_tag}"
        return 1
    fi
}

# Generate SBOM for verification
generate_sbom() {
    local artifact_path="$1"
    local sbom_path="$2"
    
    log "Generating SBOM for $(basename "${artifact_path}")..."
    
    if syft "${artifact_path}" -o spdx-json > "${sbom_path}"; then
        success "SBOM generated for $(basename "${artifact_path}")"
        return 0
    else
        error "SBOM generation failed for $(basename "${artifact_path}")"
        return 1
    fi
}

# Verify X/Twitter automation specific security
verify_x_automation_security() {
    local artifact_path="$1"
    
    log "Verifying X/Twitter automation security for $(basename "${artifact_path}")..."
    
    # Extract and analyze artifact
    local extract_dir="${TEMP_DIR}/$(basename "${artifact_path}" .tar.gz)"
    mkdir -p "${extract_dir}"
    
    if tar -xzf "${artifact_path}" -C "${extract_dir}"; then
        log "Artifact extracted for security analysis"
    else
        error "Failed to extract artifact for security analysis"
        return 1
    fi
    
    # Check for hardcoded credentials
    log "Checking for hardcoded credentials..."
    if grep -r -i -E "(api[_-]?key|api[_-]?secret|bearer[_-]?token|telegram.*bot.*token)" "${extract_dir}" --include="*.js" --include="*.ts" --include="*.py" 2>/dev/null; then
        error "Potential hardcoded credentials found in artifact"
        return 1
    else
        success "No hardcoded credentials detected"
    fi
    
    # Check for secure session handling (Twikit specific)
    if [[ "$(basename "${artifact_path}")" == *"backend"* ]] || [[ "$(basename "${artifact_path}")" == *"llm"* ]]; then
        log "Checking Twikit session security..."
        if grep -r -i "save_cookies" "${extract_dir}" --include="*.py" 2>/dev/null | grep -v -i "encrypt"; then
            warning "Potentially insecure session storage detected"
        else
            success "Secure session handling verified"
        fi
    fi
    
    # Check for rate limiting implementation
    log "Checking rate limiting implementation..."
    if grep -r -i -E "(sleep|delay|wait|throttle|rate.*limit)" "${extract_dir}" --include="*.js" --include="*.ts" --include="*.py" 2>/dev/null; then
        success "Rate limiting implementation detected"
    else
        warning "Rate limiting implementation not clearly detected"
    fi
    
    return 0
}

# Main verification function
main() {
    log "Starting SLSA provenance verification for X/Twitter Automation Platform"
    log "Verification log: ${VERIFICATION_LOG}"
    
    # Check tools
    check_tools
    
    # Configuration
    local source_uri="${GITHUB_REPOSITORY:-github.com/user/x-marketing-platform}"
    local source_tag="${GITHUB_REF_NAME:-main}"
    local registry="${REGISTRY:-ghcr.io}"
    local image_name="${IMAGE_NAME:-${source_uri}}"
    
    # Services to verify
    local services=("backend" "frontend" "telegram-bot" "llm-service")
    local verification_failed=false
    
    log "Verifying artifacts for services: ${services[*]}"
    log "Source URI: ${source_uri}"
    log "Source tag: ${source_tag}"
    
    # Verify build artifacts
    for service in "${services[@]}"; do
        local artifact_path="${service}-build.tar.gz"
        local provenance_path="${artifact_path}.intoto.jsonl"
        
        if [ -f "${artifact_path}" ] && [ -f "${provenance_path}" ]; then
            if ! verify_artifact_provenance "${artifact_path}" "${provenance_path}" "${source_uri}" "${source_tag}"; then
                verification_failed=true
            fi
            
            # Generate and verify SBOM
            local sbom_path="${TEMP_DIR}/${service}-sbom.json"
            if generate_sbom "${artifact_path}" "${sbom_path}"; then
                log "SBOM generated: ${sbom_path}"
            fi
            
            # Verify X/Twitter automation specific security
            if ! verify_x_automation_security "${artifact_path}"; then
                verification_failed=true
            fi
        else
            warning "Artifact or provenance not found for ${service}"
        fi
    done
    
    # Verify container images if available
    for service in "${services[@]}"; do
        local image="${registry}/${image_name}-${service}"
        local tag="${GITHUB_SHA:-latest}"
        
        if docker image inspect "${image}:${tag}" &>/dev/null; then
            if ! verify_container_provenance "${image}" "${tag}"; then
                verification_failed=true
            fi
        else
            log "Container image not found locally: ${image}:${tag}"
        fi
    done
    
    # Final result
    if [ "${verification_failed}" = true ]; then
        error "SLSA provenance verification failed for one or more artifacts"
        exit 1
    else
        success "All SLSA provenance verifications passed successfully!"
        log "Verification completed successfully"
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
