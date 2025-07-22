#!/bin/sh

# Backend Health Check Script
# This script performs comprehensive health checks for the backend service

set -e

# Configuration
HOST="localhost"
PORT="3000"
TIMEOUT="10"
MAX_RETRIES="3"
RETRY_DELAY="2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [HEALTHCHECK] $1"
}

# Error function
error() {
    echo "${RED}$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1${NC}" >&2
}

# Success function
success() {
    echo "${GREEN}$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1${NC}"
}

# Warning function
warning() {
    echo "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1${NC}"
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local endpoint="$1"
    local expected_status="$2"
    local description="$3"
    
    log "Checking $description at $endpoint"
    
    local response
    local status_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        --max-time "$TIMEOUT" \
        --connect-timeout 5 \
        "http://$HOST:$PORT$endpoint" 2>/dev/null || echo "HTTPSTATUS:000")
    
    status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$status_code" = "$expected_status" ]; then
        success "$description check passed (HTTP $status_code)"
        return 0
    else
        error "$description check failed (HTTP $status_code, expected $expected_status)"
        return 1
    fi
}

# Function to check database connectivity
check_database() {
    log "Checking database connectivity"
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" \
        "http://$HOST:$PORT/health/database" 2>/dev/null || echo "")
    
    if echo "$response" | grep -q '"status":"healthy"'; then
        success "Database connectivity check passed"
        return 0
    else
        error "Database connectivity check failed"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    log "Checking Redis connectivity"
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" \
        "http://$HOST:$PORT/health/redis" 2>/dev/null || echo "")
    
    if echo "$response" | grep -q '"status":"healthy"'; then
        success "Redis connectivity check passed"
        return 0
    else
        error "Redis connectivity check failed"
        return 1
    fi
}

# Function to check real-time sync system
check_realtime_sync() {
    log "Checking real-time sync system"
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" \
        "http://$HOST:$PORT/api/real-time-sync/health" 2>/dev/null || echo "")
    
    if echo "$response" | grep -q '"success":true'; then
        success "Real-time sync system check passed"
        return 0
    else
        warning "Real-time sync system check failed (may be disabled)"
        return 0  # Don't fail health check if sync is disabled
    fi
}

# Function to check memory usage
check_memory_usage() {
    log "Checking memory usage"
    
    local memory_usage
    memory_usage=$(ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -p $$ | tail -n +2 | awk '{print $4}' | head -1)
    
    if [ -n "$memory_usage" ]; then
        local memory_threshold=90
        if [ "$(echo "$memory_usage > $memory_threshold" | bc 2>/dev/null || echo 0)" = "1" ]; then
            warning "High memory usage detected: ${memory_usage}%"
        else
            success "Memory usage check passed: ${memory_usage}%"
        fi
    else
        warning "Could not determine memory usage"
    fi
    
    return 0
}

# Function to check disk space
check_disk_space() {
    log "Checking disk space"
    
    local disk_usage
    disk_usage=$(df /app 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ -n "$disk_usage" ]; then
        local disk_threshold=90
        if [ "$disk_usage" -gt "$disk_threshold" ]; then
            warning "High disk usage detected: ${disk_usage}%"
        else
            success "Disk space check passed: ${disk_usage}% used"
        fi
    else
        warning "Could not determine disk usage"
    fi
    
    return 0
}

# Function to check process health
check_process_health() {
    log "Checking process health"
    
    # Check if the main process is running
    if pgrep -f "node.*server.js" > /dev/null; then
        success "Main process is running"
    else
        error "Main process is not running"
        return 1
    fi
    
    # Check for zombie processes
    local zombie_count
    zombie_count=$(ps aux | awk '$8 ~ /^Z/ { count++ } END { print count+0 }')
    
    if [ "$zombie_count" -gt 0 ]; then
        warning "Found $zombie_count zombie processes"
    else
        success "No zombie processes found"
    fi
    
    return 0
}

# Main health check function
main() {
    log "Starting comprehensive health check"
    
    local failed_checks=0
    local total_checks=0
    
    # Basic HTTP health check
    total_checks=$((total_checks + 1))
    if ! check_http_endpoint "/health" "200" "Basic health endpoint"; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Database connectivity check
    total_checks=$((total_checks + 1))
    if ! check_database; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Redis connectivity check
    total_checks=$((total_checks + 1))
    if ! check_redis; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Real-time sync system check
    total_checks=$((total_checks + 1))
    if ! check_realtime_sync; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Process health check
    total_checks=$((total_checks + 1))
    if ! check_process_health; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Resource usage checks (non-critical)
    check_memory_usage
    check_disk_space
    
    # Summary
    log "Health check completed: $((total_checks - failed_checks))/$total_checks checks passed"
    
    if [ "$failed_checks" -eq 0 ]; then
        success "All critical health checks passed"
        exit 0
    else
        error "$failed_checks critical health checks failed"
        exit 1
    fi
}

# Retry mechanism
retry_count=0
while [ $retry_count -lt $MAX_RETRIES ]; do
    if main; then
        exit 0
    fi
    
    retry_count=$((retry_count + 1))
    if [ $retry_count -lt $MAX_RETRIES ]; then
        warning "Health check failed, retrying in $RETRY_DELAY seconds (attempt $retry_count/$MAX_RETRIES)"
        sleep $RETRY_DELAY
    fi
done

error "Health check failed after $MAX_RETRIES attempts"
exit 1
