#!/bin/bash

# X Marketing Platform - Webhook Monitoring Script
# Monitors webhook health and automatically switches to backup solutions

set -e

# Configuration
WEBHOOK_URL="https://creativity-ec-titled-producer.trycloudflare.com"
HEALTH_ENDPOINT="$WEBHOOK_URL/health"
TELEGRAM_WEBHOOK="$WEBHOOK_URL/webhook/telegram"
CHECK_INTERVAL=30  # seconds
MAX_FAILURES=3
LOG_FILE="logs/webhook-monitor.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
failure_count=0
last_status="unknown"

# Create logs directory
mkdir -p logs

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Print colored status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check webhook health
check_webhook_health() {
    local start_time=$(date +%s%3N)
    
    # Test health endpoint
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
    
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [ "$http_code" = "200" ]; then
        if [ "$last_status" != "healthy" ]; then
            print_status "SUCCESS" "Webhook is healthy (${response_time}ms)"
            log "INFO" "Webhook health restored - HTTP $http_code, Response time: ${response_time}ms"
        fi
        last_status="healthy"
        failure_count=0
        return 0
    else
        print_status "ERROR" "Webhook health check failed - HTTP $http_code (${response_time}ms)"
        log "ERROR" "Webhook health check failed - HTTP $http_code, Response time: ${response_time}ms"
        last_status="unhealthy"
        ((failure_count++))
        return 1
    fi
}

# Test webhook endpoint
test_webhook_endpoint() {
    local test_payload='{"message":{"chat":{"id":999999},"text":"health_check"}}'
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$test_payload" \
        "$TELEGRAM_WEBHOOK" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        print_status "SUCCESS" "Webhook endpoint test passed"
        log "INFO" "Webhook endpoint test successful - HTTP $http_code"
        return 0
    else
        print_status "ERROR" "Webhook endpoint test failed - HTTP $http_code"
        log "ERROR" "Webhook endpoint test failed - HTTP $http_code"
        return 1
    fi
}

# Get Telegram webhook info
get_telegram_webhook_info() {
    if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
        print_status "WARNING" "TELEGRAM_BOT_TOKEN not set, skipping Telegram webhook info"
        return 1
    fi
    
    local webhook_info=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local url=$(echo "$webhook_info" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
        local pending_count=$(echo "$webhook_info" | grep -o '"pending_update_count":[0-9]*' | cut -d':' -f2)
        local last_error=$(echo "$webhook_info" | grep -o '"last_error_message":"[^"]*"' | cut -d'"' -f4)
        
        print_status "INFO" "Telegram webhook URL: $url"
        print_status "INFO" "Pending updates: $pending_count"
        
        if [ "$last_error" != "" ] && [ "$last_error" != "null" ]; then
            print_status "WARNING" "Last error: $last_error"
            log "WARNING" "Telegram webhook error: $last_error"
        fi
        
        return 0
    else
        print_status "ERROR" "Failed to get Telegram webhook info"
        return 1
    fi
}

# Start backup solutions
start_backup_solutions() {
    print_status "WARNING" "Starting backup webhook solutions..."
    log "WARNING" "Primary webhook failed $MAX_FAILURES times, starting backup solutions"
    
    # Try to start ngrok as backup
    if command -v ngrok &> /dev/null; then
        print_status "INFO" "Starting ngrok backup tunnel..."
        nohup ngrok http 3002 > logs/ngrok.log 2>&1 &
        sleep 5
        
        # Get ngrok URL
        local ngrok_url=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
        
        if [ "$ngrok_url" != "" ]; then
            print_status "SUCCESS" "ngrok backup started: $ngrok_url"
            log "INFO" "ngrok backup tunnel started: $ngrok_url/webhook/telegram"
            
            # Update webhook to ngrok
            if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
                curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
                    -d "url=$ngrok_url/webhook/telegram" \
                    -d "allowed_updates=[\"message\",\"callback_query\",\"inline_query\"]" > /dev/null
                print_status "SUCCESS" "Telegram webhook updated to ngrok backup"
                log "INFO" "Telegram webhook switched to ngrok backup: $ngrok_url/webhook/telegram"
            fi
        else
            print_status "ERROR" "Failed to start ngrok backup"
        fi
    else
        print_status "WARNING" "ngrok not available for backup"
    fi
}

# Restart Cloudflare tunnel
restart_cloudflare_tunnel() {
    print_status "INFO" "Attempting to restart Cloudflare tunnel..."
    log "INFO" "Restarting Cloudflare tunnel"
    
    # Kill existing cloudflared processes
    pkill -f cloudflared || true
    sleep 2
    
    # Start new tunnel
    nohup cloudflared tunnel --url http://localhost:3002 > logs/cloudflared.log 2>&1 &
    sleep 10
    
    # Check if new tunnel is working
    if check_webhook_health; then
        print_status "SUCCESS" "Cloudflare tunnel restarted successfully"
        log "INFO" "Cloudflare tunnel restart successful"
        return 0
    else
        print_status "ERROR" "Cloudflare tunnel restart failed"
        log "ERROR" "Cloudflare tunnel restart failed"
        return 1
    fi
}

# Main monitoring loop
monitor_webhook() {
    print_status "INFO" "Starting webhook monitoring..."
    print_status "INFO" "Webhook URL: $WEBHOOK_URL"
    print_status "INFO" "Check interval: ${CHECK_INTERVAL}s"
    print_status "INFO" "Max failures before backup: $MAX_FAILURES"
    echo
    
    log "INFO" "Webhook monitoring started - URL: $WEBHOOK_URL, Interval: ${CHECK_INTERVAL}s"
    
    while true; do
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        echo "[$timestamp] Checking webhook health..."
        
        if check_webhook_health; then
            # Also test the webhook endpoint
            test_webhook_endpoint
            
            # Get Telegram webhook info periodically
            if [ $(($(date +%s) % 300)) -eq 0 ]; then  # Every 5 minutes
                get_telegram_webhook_info
            fi
        else
            if [ $failure_count -ge $MAX_FAILURES ]; then
                print_status "ERROR" "Webhook failed $failure_count times, taking action..."
                
                # Try to restart Cloudflare tunnel first
                if restart_cloudflare_tunnel; then
                    failure_count=0
                else
                    # If restart fails, start backup solutions
                    start_backup_solutions
                    failure_count=0
                fi
            else
                print_status "WARNING" "Webhook failure $failure_count/$MAX_FAILURES"
            fi
        fi
        
        echo "----------------------------------------"
        sleep $CHECK_INTERVAL
    done
}

# Signal handlers
cleanup() {
    print_status "INFO" "Stopping webhook monitoring..."
    log "INFO" "Webhook monitoring stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Load environment variables
if [ -f "telegram-bot/.env.local" ]; then
    export $(grep -v '^#' telegram-bot/.env.local | xargs)
fi

# Start monitoring
monitor_webhook
