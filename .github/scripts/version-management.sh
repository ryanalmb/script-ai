#!/bin/bash

# Version Management and Rollback Decision System
# Phase 3: Advanced CI/CD Features - Automated Rollback Capability

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION_LOG="${PROJECT_ROOT}/version-management.log"
VERSION_DB="${PROJECT_ROOT}/versions.db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Services
SERVICES=("backend" "frontend" "telegram-bot" "llm-service")
ENVIRONMENTS=("development" "staging" "production")

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${VERSION_LOG}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${VERSION_LOG}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${VERSION_LOG}"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${VERSION_LOG}"
}

# Help function
show_help() {
    cat << EOF
Version Management and Rollback Decision System

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  record <service> <env> <version>    Record a new deployment version
  get-current <service> <env>         Get current deployed version
  get-previous <service> <env>        Get previous stable version
  list-versions <service> <env>       List all versions for service/environment
  mark-stable <service> <env> <ver>   Mark a version as stable
  mark-failed <service> <env> <ver>   Mark a version as failed
  rollback-decision <service> <env>   Make rollback decision based on criteria
  cleanup-versions <service> <env>    Cleanup old version records
  export-history                     Export version history
  import-history <file>               Import version history

Options:
  --reason <text>        Reason for version change
  --metadata <json>      Additional metadata
  --force                Force operation without confirmation
  --dry-run              Show what would be done
  --verbose              Enable verbose output

Examples:
  $0 record backend production v1.2.3 --reason "Bug fixes"
  $0 get-previous llm-service staging
  $0 rollback-decision frontend production
  $0 mark-failed backend production v1.2.2 --reason "High error rate"

EOF
}

# Initialize version database
init_version_db() {
    if [ ! -f "$VERSION_DB" ]; then
        log "Initializing version database: $VERSION_DB"
        
        # Create version database header
        cat > "$VERSION_DB" << EOF
# Version Management Database
# Format: timestamp|service|environment|version|status|reason|metadata
# Status: deployed, stable, failed, rolled_back
EOF
        
        success "Version database initialized"
    fi
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    SERVICE=""
    ENVIRONMENT=""
    VERSION=""
    REASON=""
    METADATA=""
    FORCE=false
    DRY_RUN=false
    VERBOSE=false
    IMPORT_FILE=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            record|get-current|get-previous|list-versions|mark-stable|mark-failed|rollback-decision|cleanup-versions)
                COMMAND="$1"
                if [[ $# -gt 1 ]] && [[ ! "$2" =~ ^-- ]]; then
                    SERVICE="$2"
                    shift
                    if [[ $# -gt 1 ]] && [[ ! "$2" =~ ^-- ]]; then
                        ENVIRONMENT="$2"
                        shift
                        if [[ $# -gt 1 ]] && [[ ! "$2" =~ ^-- ]]; then
                            VERSION="$2"
                            shift
                        fi
                    fi
                fi
                ;;
            export-history)
                COMMAND="$1"
                ;;
            import-history)
                COMMAND="$1"
                if [[ $# -gt 1 ]] && [[ ! "$2" =~ ^-- ]]; then
                    IMPORT_FILE="$2"
                    shift
                fi
                ;;
            --reason)
                REASON="$2"
                shift
                ;;
            --metadata)
                METADATA="$2"
                shift
                ;;
            --force)
                FORCE=true
                ;;
            --dry-run)
                DRY_RUN=true
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

# Validate service and environment
validate_inputs() {
    local service="$1"
    local environment="$2"
    
    if [[ ! " ${SERVICES[*]} " =~ " ${service} " ]]; then
        error "Invalid service: $service"
        error "Available services: ${SERVICES[*]}"
        return 1
    fi
    
    if [[ ! " ${ENVIRONMENTS[*]} " =~ " ${environment} " ]]; then
        error "Invalid environment: $environment"
        error "Available environments: ${ENVIRONMENTS[*]}"
        return 1
    fi
    
    return 0
}

# Record a new deployment version
record_version() {
    local service="$1"
    local environment="$2"
    local version="$3"
    local reason="${4:-Deployment}"
    local metadata="${5:-{}}"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    log "Recording version for $service ($environment): $version"
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would record version $version for $service ($environment)"
        return 0
    fi
    
    # Create version record
    local timestamp=$(date -Iseconds)
    local record="$timestamp|$service|$environment|$version|deployed|$reason|$metadata"
    
    echo "$record" >> "$VERSION_DB"
    
    success "Version recorded: $service ($environment) -> $version"
    
    if [ "$VERBOSE" = true ]; then
        log "Record details:"
        log "  Timestamp: $timestamp"
        log "  Service: $service"
        log "  Environment: $environment"
        log "  Version: $version"
        log "  Status: deployed"
        log "  Reason: $reason"
        log "  Metadata: $metadata"
    fi
}

# Get current deployed version
get_current_version() {
    local service="$1"
    local environment="$2"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    # Find the most recent deployed version
    local current_version
    current_version=$(grep "^[^#]" "$VERSION_DB" | \
                     grep "|$service|$environment|" | \
                     grep "|deployed|" | \
                     tail -1 | \
                     cut -d'|' -f4)
    
    if [ -n "$current_version" ]; then
        echo "$current_version"
        if [ "$VERBOSE" = true ]; then
            log "Current version for $service ($environment): $current_version"
        fi
    else
        error "No current version found for $service ($environment)"
        return 1
    fi
}

# Get previous stable version
get_previous_version() {
    local service="$1"
    local environment="$2"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    # Find the most recent stable version (excluding current deployed)
    local current_version
    current_version=$(get_current_version "$service" "$environment" 2>/dev/null || echo "")
    
    local previous_version
    previous_version=$(grep "^[^#]" "$VERSION_DB" | \
                      grep "|$service|$environment|" | \
                      grep "|stable|" | \
                      if [ -n "$current_version" ]; then
                          grep -v "|$current_version|"
                      else
                          cat
                      fi | \
                      tail -1 | \
                      cut -d'|' -f4)
    
    if [ -n "$previous_version" ]; then
        echo "$previous_version"
        if [ "$VERBOSE" = true ]; then
            log "Previous stable version for $service ($environment): $previous_version"
        fi
    else
        error "No previous stable version found for $service ($environment)"
        return 1
    fi
}

# List all versions for a service/environment
list_versions() {
    local service="$1"
    local environment="$2"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    log "Version history for $service ($environment):"
    
    echo
    printf "%-20s %-15s %-10s %-20s %s\n" "Timestamp" "Version" "Status" "Reason" "Metadata"
    printf "%-20s %-15s %-10s %-20s %s\n" "--------------------" "---------------" "----------" "--------------------" "--------"
    
    grep "^[^#]" "$VERSION_DB" | \
    grep "|$service|$environment|" | \
    while IFS='|' read -r timestamp svc env version status reason metadata; do
        printf "%-20s %-15s %-10s %-20s %s\n" \
               "$(date -d "$timestamp" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$timestamp")" \
               "$version" \
               "$status" \
               "$reason" \
               "$metadata"
    done
    
    echo
}

# Mark a version as stable
mark_stable() {
    local service="$1"
    local environment="$2"
    local version="$3"
    local reason="${4:-Stability confirmed}"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    log "Marking version as stable: $service ($environment) $version"
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would mark $version as stable for $service ($environment)"
        return 0
    fi
    
    # Create stable version record
    local timestamp=$(date -Iseconds)
    local metadata='{"marked_stable_at":"'$timestamp'"}'
    local record="$timestamp|$service|$environment|$version|stable|$reason|$metadata"
    
    echo "$record" >> "$VERSION_DB"
    
    success "Version marked as stable: $service ($environment) -> $version"
}

# Mark a version as failed
mark_failed() {
    local service="$1"
    local environment="$2"
    local version="$3"
    local reason="${4:-Deployment failure}"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    log "Marking version as failed: $service ($environment) $version"
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would mark $version as failed for $service ($environment)"
        return 0
    fi
    
    # Create failed version record
    local timestamp=$(date -Iseconds)
    local metadata='{"marked_failed_at":"'$timestamp'"}'
    local record="$timestamp|$service|$environment|$version|failed|$reason|$metadata"
    
    echo "$record" >> "$VERSION_DB"
    
    success "Version marked as failed: $service ($environment) -> $version"
}

# Make rollback decision based on criteria
rollback_decision() {
    local service="$1"
    local environment="$2"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    log "Making rollback decision for $service ($environment)"
    
    # Get current and previous versions
    local current_version
    current_version=$(get_current_version "$service" "$environment" 2>/dev/null || echo "")
    
    local previous_version
    previous_version=$(get_previous_version "$service" "$environment" 2>/dev/null || echo "")
    
    if [ -z "$current_version" ]; then
        error "Cannot make rollback decision: no current version found"
        return 1
    fi
    
    if [ -z "$previous_version" ]; then
        error "Cannot make rollback decision: no previous stable version found"
        return 1
    fi
    
    log "Current version: $current_version"
    log "Previous stable version: $previous_version"
    
    # Analyze version history and failure patterns
    local recent_failures
    recent_failures=$(grep "^[^#]" "$VERSION_DB" | \
                     grep "|$service|$environment|" | \
                     grep "|failed|" | \
                     tail -5 | \
                     wc -l)
    
    local current_version_age
    current_version_age=$(grep "^[^#]" "$VERSION_DB" | \
                         grep "|$service|$environment|$current_version|deployed|" | \
                         tail -1 | \
                         cut -d'|' -f1)
    
    if [ -n "$current_version_age" ]; then
        local age_seconds
        age_seconds=$(( $(date +%s) - $(date -d "$current_version_age" +%s 2>/dev/null || echo "0") ))
        local age_minutes=$((age_seconds / 60))
    else
        local age_minutes=0
    fi
    
    # Decision criteria
    local rollback_recommended=false
    local decision_reasons=()
    
    # Criteria 1: Recent failure history
    if [ $recent_failures -ge 3 ]; then
        rollback_recommended=true
        decision_reasons+=("High recent failure rate: $recent_failures failures in recent history")
    fi
    
    # Criteria 2: Version age (if very new, might be unstable)
    if [ $age_minutes -lt 10 ]; then
        decision_reasons+=("Version is very new: ${age_minutes} minutes old")
    fi
    
    # Criteria 3: Environment-specific criteria
    case "$environment" in
        "production")
            # Stricter criteria for production
            if [ $recent_failures -ge 2 ]; then
                rollback_recommended=true
                decision_reasons+=("Production environment: lower failure tolerance")
            fi
            ;;
        "staging")
            # Moderate criteria for staging
            if [ $recent_failures -ge 4 ]; then
                rollback_recommended=true
                decision_reasons+=("Staging environment: moderate failure tolerance")
            fi
            ;;
    esac
    
    # Criteria 4: Service-specific criteria
    case "$service" in
        "llm-service")
            # Special consideration for Twikit integration
            local twikit_failures
            twikit_failures=$(grep "^[^#]" "$VERSION_DB" | \
                             grep "|$service|$environment|" | \
                             grep "twikit" | \
                             grep "|failed|" | \
                             tail -3 | \
                             wc -l)
            
            if [ $twikit_failures -ge 2 ]; then
                rollback_recommended=true
                decision_reasons+=("Twikit integration failures: $twikit_failures")
            fi
            ;;
        "telegram-bot")
            # Critical service - lower tolerance
            if [ $recent_failures -ge 1 ]; then
                rollback_recommended=true
                decision_reasons+=("Critical service: telegram-bot has low failure tolerance")
            fi
            ;;
    esac
    
    # Generate decision report
    echo
    echo "🔍 ROLLBACK DECISION ANALYSIS"
    echo "=============================="
    echo "Service: $service"
    echo "Environment: $environment"
    echo "Current Version: $current_version"
    echo "Previous Stable Version: $previous_version"
    echo "Current Version Age: ${age_minutes} minutes"
    echo "Recent Failures: $recent_failures"
    echo
    
    if [ "$rollback_recommended" = true ]; then
        echo "🚨 RECOMMENDATION: ROLLBACK RECOMMENDED"
        echo
        echo "Reasons:"
        for reason in "${decision_reasons[@]}"; do
            echo "  - $reason"
        done
        echo
        echo "Recommended Action:"
        echo "  1. Initiate rollback to version: $previous_version"
        echo "  2. Mark current version as failed"
        echo "  3. Investigate issues before next deployment"
        
        # Create rollback decision record
        local timestamp=$(date -Iseconds)
        local metadata='{"decision":"rollback_recommended","reasons":["'$(IFS='","'; echo "${decision_reasons[*]}")'"]}' 
        local record="$timestamp|$service|$environment|$current_version|rollback_recommended|Automated decision|$metadata"
        
        if [ "$DRY_RUN" = false ]; then
            echo "$record" >> "$VERSION_DB"
        fi
        
        return 0  # Rollback recommended
    else
        echo "✅ RECOMMENDATION: CONTINUE WITH CURRENT VERSION"
        echo
        echo "Analysis:"
        for reason in "${decision_reasons[@]}"; do
            echo "  - $reason"
        done
        echo "  - No critical issues detected"
        echo "  - Current version appears stable"
        
        return 1  # No rollback needed
    fi
}

# Cleanup old version records
cleanup_versions() {
    local service="$1"
    local environment="$2"
    local keep_days="${3:-30}"
    
    if ! validate_inputs "$service" "$environment"; then
        return 1
    fi
    
    log "Cleaning up old version records for $service ($environment)"
    log "Keeping records from last $keep_days days"
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would cleanup old version records"
        return 0
    fi
    
    # Calculate cutoff date
    local cutoff_date
    cutoff_date=$(date -d "$keep_days days ago" -Iseconds)
    
    # Create backup
    cp "$VERSION_DB" "${VERSION_DB}.backup.$(date +%Y%m%d-%H%M%S)"
    
    # Filter out old records
    local temp_file=$(mktemp)
    
    # Keep header and recent records
    grep "^#" "$VERSION_DB" > "$temp_file"
    grep "^[^#]" "$VERSION_DB" | \
    while IFS='|' read -r timestamp svc env version status reason metadata; do
        if [[ "$timestamp" > "$cutoff_date" ]] || [[ "$svc" != "$service" ]] || [[ "$env" != "$environment" ]]; then
            echo "$timestamp|$svc|$env|$version|$status|$reason|$metadata" >> "$temp_file"
        fi
    done
    
    mv "$temp_file" "$VERSION_DB"
    
    success "Version cleanup completed for $service ($environment)"
}

# Export version history
export_history() {
    local export_file="${1:-version-history-$(date +%Y%m%d-%H%M%S).csv}"
    
    log "Exporting version history to: $export_file"
    
    # Create CSV header
    echo "timestamp,service,environment,version,status,reason,metadata" > "$export_file"
    
    # Export data
    grep "^[^#]" "$VERSION_DB" | tr '|' ',' >> "$export_file"
    
    success "Version history exported to: $export_file"
}

# Import version history
import_history() {
    local import_file="$1"
    
    if [ ! -f "$import_file" ]; then
        error "Import file not found: $import_file"
        return 1
    fi
    
    log "Importing version history from: $import_file"
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would import version history from $import_file"
        return 0
    fi
    
    # Create backup
    cp "$VERSION_DB" "${VERSION_DB}.backup.$(date +%Y%m%d-%H%M%S)"
    
    # Import data (skip header)
    tail -n +2 "$import_file" | tr ',' '|' >> "$VERSION_DB"
    
    success "Version history imported from: $import_file"
}

# Main function
main() {
    log "Starting version management"
    log "Command: ${COMMAND:-none}"
    
    # Initialize database
    init_version_db
    
    case "${COMMAND:-}" in
        "record")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ] || [ -z "$VERSION" ]; then
                error "Service, environment, and version required for record command"
                show_help
                exit 1
            fi
            record_version "$SERVICE" "$ENVIRONMENT" "$VERSION" "$REASON" "$METADATA"
            ;;
        "get-current")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ]; then
                error "Service and environment required for get-current command"
                show_help
                exit 1
            fi
            get_current_version "$SERVICE" "$ENVIRONMENT"
            ;;
        "get-previous")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ]; then
                error "Service and environment required for get-previous command"
                show_help
                exit 1
            fi
            get_previous_version "$SERVICE" "$ENVIRONMENT"
            ;;
        "list-versions")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ]; then
                error "Service and environment required for list-versions command"
                show_help
                exit 1
            fi
            list_versions "$SERVICE" "$ENVIRONMENT"
            ;;
        "mark-stable")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ] || [ -z "$VERSION" ]; then
                error "Service, environment, and version required for mark-stable command"
                show_help
                exit 1
            fi
            mark_stable "$SERVICE" "$ENVIRONMENT" "$VERSION" "$REASON"
            ;;
        "mark-failed")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ] || [ -z "$VERSION" ]; then
                error "Service, environment, and version required for mark-failed command"
                show_help
                exit 1
            fi
            mark_failed "$SERVICE" "$ENVIRONMENT" "$VERSION" "$REASON"
            ;;
        "rollback-decision")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ]; then
                error "Service and environment required for rollback-decision command"
                show_help
                exit 1
            fi
            rollback_decision "$SERVICE" "$ENVIRONMENT"
            ;;
        "cleanup-versions")
            if [ -z "$SERVICE" ] || [ -z "$ENVIRONMENT" ]; then
                error "Service and environment required for cleanup-versions command"
                show_help
                exit 1
            fi
            cleanup_versions "$SERVICE" "$ENVIRONMENT"
            ;;
        "export-history")
            export_history
            ;;
        "import-history")
            if [ -z "$IMPORT_FILE" ]; then
                error "Import file required for import-history command"
                show_help
                exit 1
            fi
            import_history "$IMPORT_FILE"
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
