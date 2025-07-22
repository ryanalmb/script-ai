#!/bin/sh

# WebSocket Service Health Check Script
# This script performs health checks specifically for the WebSocket service

set -e

# Configuration
HOST="localhost"
PORT="3001"
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
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WS-HEALTHCHECK] $1"
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

# Function to check WebSocket server status
check_websocket_server() {
    log "Checking WebSocket server status"
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" \
        "http://$HOST:$PORT/health" 2>/dev/null || echo "")
    
    if echo "$response" | grep -q "healthy"; then
        success "WebSocket server status check passed"
        return 0
    else
        error "WebSocket server status check failed"
        return 1
    fi
}

# Function to check Socket.IO endpoint
check_socketio_endpoint() {
    log "Checking Socket.IO endpoint"
    
    local response
    local status_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        --max-time "$TIMEOUT" \
        --connect-timeout 5 \
        "http://$HOST:$PORT/socket.io/" 2>/dev/null || echo "HTTPSTATUS:000")
    
    status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    # Socket.IO typically returns 400 for GET requests to the base endpoint
    if [ "$status_code" = "400" ] || [ "$status_code" = "200" ]; then
        success "Socket.IO endpoint check passed (HTTP $status_code)"
        return 0
    else
        error "Socket.IO endpoint check failed (HTTP $status_code)"
        return 1
    fi
}

# Function to check WebSocket process
check_websocket_process() {
    log "Checking WebSocket process"
    
    # Check if the WebSocket process is running
    if pgrep -f "node.*websocket-server.js" > /dev/null; then
        success "WebSocket process is running"
        return 0
    else
        error "WebSocket process is not running"
        return 1
    fi
}

# Function to check memory usage
check_memory_usage() {
    log "Checking memory usage"
    
    local memory_usage
    memory_usage=$(ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -p $$ | tail -n +2 | awk '{print $4}' | head -1)
    
    if [ -n "$memory_usage" ]; then
        local memory_threshold=80
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

# Function to check connection count (if available)
check_connection_count() {
    log "Checking WebSocket connection count"
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" \
        "http://$HOST:$PORT/stats" 2>/dev/null || echo "")
    
    if echo "$response" | grep -q "connections"; then
        local connections
        connections=$(echo "$response" | grep -o '"connections":[0-9]*' | cut -d: -f2)
        
        if [ -n "$connections" ]; then
            success "WebSocket connections: $connections"
            
            # Check if connection count is reasonable
            local max_connections=1000
            if [ "$connections" -gt "$max_connections" ]; then
                warning "High connection count: $connections (max: $max_connections)"
            fi
        fi
    else
        warning "Could not retrieve connection statistics"
    fi
    
    return 0
}

# Function to check port availability
check_port_availability() {
    log "Checking port availability"
    
    if netstat -ln 2>/dev/null | grep -q ":$PORT "; then
        success "Port $PORT is listening"
        return 0
    elif ss -ln 2>/dev/null | grep -q ":$PORT "; then
        success "Port $PORT is listening"
        return 0
    else
        error "Port $PORT is not listening"
        return 1
    fi
}

# Main health check function
main() {
    log "Starting WebSocket service health check"
    
    local failed_checks=0
    local total_checks=0
    
    # Port availability check
    total_checks=$((total_checks + 1))
    if ! check_port_availability; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Process check
    total_checks=$((total_checks + 1))
    if ! check_websocket_process; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Basic HTTP health check
    total_checks=$((total_checks + 1))
    if ! check_websocket_server; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Socket.IO endpoint check
    total_checks=$((total_checks + 1))
    if ! check_socketio_endpoint; then
        failed_checks=$((failed_checks + 1))
    fi
    
    # Non-critical checks
    check_memory_usage
    check_connection_count
    
    # Summary
    log "WebSocket health check completed: $((total_checks - failed_checks))/$total_checks checks passed"
    
    if [ "$failed_checks" -eq 0 ]; then
        success "All critical WebSocket health checks passed"
        exit 0
    else
        error "$failed_checks critical WebSocket health checks failed"
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
        warning "WebSocket health check failed, retrying in $RETRY_DELAY seconds (attempt $retry_count/$MAX_RETRIES)"
        sleep $RETRY_DELAY
    fi
done

error "WebSocket health check failed after $MAX_RETRIES attempts"
exit 1
