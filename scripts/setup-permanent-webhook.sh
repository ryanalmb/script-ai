#!/bin/bash

# Enterprise Permanent Webhook Setup Script
# Comprehensive webhook configuration with SSL, domain validation, and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
WEBHOOK_DOMAIN=${WEBHOOK_DOMAIN:-""}
CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-""}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-""}
WEBHOOK_PATH="/webhook/telegram"
WEBHOOK_PORT=${WEBHOOK_PORT:-3002}
SSL_CHECK_TIMEOUT=30

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${CYAN}[SUCCESS]${NC} $1"
}

# Load environment variables
load_environment() {
    if [ -f ".env.enterprise" ]; then
        source .env.enterprise
        print_status "Loaded enterprise environment configuration"
    else
        print_error ".env.enterprise file not found"
        exit 1
    fi
    
    # Override with script parameters if provided
    TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-$1}
    WEBHOOK_DOMAIN=${WEBHOOK_DOMAIN:-$2}
    CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-$3}
}

# Validate prerequisites
validate_prerequisites() {
    print_header "Validating Prerequisites"
    
    # Check required tools
    local required_tools=("curl" "openssl" "docker" "docker-compose")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "$tool is required but not installed"
            exit 1
        fi
    done
    print_status "✓ Required tools available"
    
    # Check Telegram bot token
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ "$TELEGRAM_BOT_TOKEN" = "your_telegram_bot_token_here" ]; then
        print_error "TELEGRAM_BOT_TOKEN is required"
        print_error "Set it in .env.enterprise or pass as first argument"
        exit 1
    fi
    print_status "✓ Telegram bot token configured"
    
    # Validate bot token format
    if [[ ! "$TELEGRAM_BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
        print_error "Invalid Telegram bot token format"
        exit 1
    fi
    print_status "✓ Bot token format valid"
}

# Test Telegram API connectivity
test_telegram_api() {
    print_step "Testing Telegram API connectivity..."
    
    local api_url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
    local response=$(curl -s -w "%{http_code}" -o /tmp/telegram_test.json "$api_url")
    local http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        local bot_username=$(cat /tmp/telegram_test.json | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        print_success "Telegram API connected successfully"
        print_status "Bot username: @$bot_username"
        rm -f /tmp/telegram_test.json
    else
        print_error "Telegram API connection failed (HTTP $http_code)"
        cat /tmp/telegram_test.json 2>/dev/null || true
        rm -f /tmp/telegram_test.json
        exit 1
    fi
}

# Setup Cloudflare Tunnel
setup_cloudflare_tunnel() {
    if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ] && [ "$CLOUDFLARE_TUNNEL_TOKEN" != "your_cloudflare_tunnel_token_here" ]; then
        print_header "Setting up Cloudflare Tunnel"
        
        print_step "Starting Cloudflare Tunnel..."
        
        # Create cloudflared configuration
        cat > cloudflared-config.yml << EOF
tunnel: $CLOUDFLARE_TUNNEL_TOKEN
credentials-file: /etc/cloudflared/cert.pem

ingress:
  - hostname: $WEBHOOK_DOMAIN
    service: http://telegram-bot:$WEBHOOK_PORT
  - service: http_status:404
EOF
        
        # Start cloudflared container
        docker run -d \
            --name cloudflared-webhook \
            --network enterprise-network \
            -v $(pwd)/cloudflared-config.yml:/etc/cloudflared/config.yml \
            cloudflare/cloudflared:latest \
            tunnel --config /etc/cloudflared/config.yml run
        
        # Wait for tunnel to establish
        print_step "Waiting for tunnel to establish..."
        sleep 10
        
        # Test tunnel connectivity
        if test_webhook_url "https://$WEBHOOK_DOMAIN$WEBHOOK_PATH"; then
            print_success "Cloudflare Tunnel established successfully"
            echo "https://$WEBHOOK_DOMAIN$WEBHOOK_PATH" > .webhook_url
        else
            print_error "Cloudflare Tunnel setup failed"
            docker logs cloudflared-webhook
            exit 1
        fi
    else
        print_warning "Cloudflare Tunnel token not configured, skipping tunnel setup"
    fi
}

# Setup custom domain webhook
setup_custom_domain() {
    if [ -n "$WEBHOOK_DOMAIN" ] && [ "$WEBHOOK_DOMAIN" != "your-domain.com" ]; then
        print_header "Setting up Custom Domain Webhook"
        
        local webhook_url="https://$WEBHOOK_DOMAIN$WEBHOOK_PATH"
        
        print_step "Validating domain: $WEBHOOK_DOMAIN"
        
        # Check DNS resolution
        if ! nslookup "$WEBHOOK_DOMAIN" >/dev/null 2>&1; then
            print_error "Domain $WEBHOOK_DOMAIN does not resolve"
            exit 1
        fi
        print_status "✓ Domain resolves correctly"
        
        # Check SSL certificate
        print_step "Checking SSL certificate..."
        if check_ssl_certificate "$WEBHOOK_DOMAIN"; then
            print_status "✓ SSL certificate valid"
        else
            print_error "SSL certificate invalid or expired"
            exit 1
        fi
        
        # Test webhook endpoint
        if test_webhook_url "$webhook_url"; then
            print_success "Custom domain webhook configured successfully"
            echo "$webhook_url" > .webhook_url
        else
            print_error "Custom domain webhook test failed"
            exit 1
        fi
    else
        print_warning "Custom domain not configured"
    fi
}

# Setup ngrok for development
setup_ngrok_webhook() {
    print_header "Setting up ngrok Development Webhook"
    
    if ! command -v ngrok &> /dev/null; then
        print_error "ngrok is not installed"
        print_error "Install from: https://ngrok.com/download"
        exit 1
    fi
    
    print_step "Starting ngrok tunnel..."
    
    # Kill any existing ngrok processes
    pkill -f ngrok || true
    sleep 2
    
    # Start ngrok in background
    ngrok http $WEBHOOK_PORT --log=stdout > ngrok.log 2>&1 &
    local ngrok_pid=$!
    
    # Wait for ngrok to start
    print_step "Waiting for ngrok to establish tunnel..."
    sleep 5
    
    # Get ngrok URL
    local ngrok_url=""
    for i in {1..10}; do
        ngrok_url=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok\.io' | head -1)
        if [ -n "$ngrok_url" ]; then
            break
        fi
        sleep 1
    done
    
    if [ -z "$ngrok_url" ]; then
        print_error "Failed to get ngrok URL"
        kill $ngrok_pid 2>/dev/null || true
        cat ngrok.log
        exit 1
    fi
    
    local webhook_url="${ngrok_url}${WEBHOOK_PATH}"
    
    # Test webhook endpoint
    if test_webhook_url "$webhook_url"; then
        print_success "ngrok webhook configured successfully"
        print_status "Webhook URL: $webhook_url"
        echo "$webhook_url" > .webhook_url
        echo "$ngrok_pid" > .ngrok_pid
    else
        print_error "ngrok webhook test failed"
        kill $ngrok_pid 2>/dev/null || true
        exit 1
    fi
}

# Check SSL certificate
check_ssl_certificate() {
    local domain=$1
    local cert_info
    
    cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local not_after=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
        local expiry_date=$(date -d "$not_after" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$not_after" +%s 2>/dev/null)
        local current_date=$(date +%s)
        
        if [ "$expiry_date" -gt "$current_date" ]; then
            local days_until_expiry=$(( (expiry_date - current_date) / 86400 ))
            print_status "SSL certificate expires in $days_until_expiry days"
            return 0
        else
            print_error "SSL certificate has expired"
            return 1
        fi
    else
        print_error "Failed to retrieve SSL certificate"
        return 1
    fi
}

# Test webhook URL
test_webhook_url() {
    local webhook_url=$1
    local max_attempts=5
    local attempt=1
    
    print_step "Testing webhook URL: $webhook_url"
    
    while [ $attempt -le $max_attempts ]; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null -X POST \
            -H "Content-Type: application/json" \
            -d '{"test": true}' \
            "$webhook_url" 2>/dev/null)
        
        if [ "$response" = "200" ] || [ "$response" = "404" ] || [ "$response" = "405" ]; then
            print_status "✓ Webhook URL is reachable (HTTP $response)"
            return 0
        fi
        
        print_warning "Attempt $attempt/$max_attempts failed (HTTP $response)"
        attempt=$((attempt + 1))
        sleep 2
    done
    
    print_error "Webhook URL is not reachable after $max_attempts attempts"
    return 1
}

# Set Telegram webhook
set_telegram_webhook() {
    local webhook_url=$(cat .webhook_url 2>/dev/null)
    
    if [ -z "$webhook_url" ]; then
        print_error "No webhook URL available"
        exit 1
    fi
    
    print_header "Setting Telegram Webhook"
    print_step "Setting webhook URL: $webhook_url"
    
    local api_url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
    local response=$(curl -s -X POST "$api_url" \
        -H "Content-Type: application/json" \
        -d "{
            \"url\": \"$webhook_url\",
            \"allowed_updates\": [\"message\", \"callback_query\", \"inline_query\"],
            \"drop_pending_updates\": true,
            \"max_connections\": 100
        }")
    
    local success=$(echo "$response" | grep -o '"ok":true' || echo "")
    
    if [ -n "$success" ]; then
        print_success "Telegram webhook set successfully"
        print_status "Webhook URL: $webhook_url"
        
        # Save webhook configuration
        cat > .webhook_config << EOF
WEBHOOK_URL=$webhook_url
WEBHOOK_SET_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
EOF
        
    else
        print_error "Failed to set Telegram webhook"
        echo "Response: $response"
        exit 1
    fi
}

# Verify webhook setup
verify_webhook_setup() {
    print_header "Verifying Webhook Setup"
    
    print_step "Getting webhook info from Telegram..."
    
    local api_url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
    local response=$(curl -s "$api_url")
    
    local webhook_url=$(echo "$response" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    local pending_updates=$(echo "$response" | grep -o '"pending_update_count":[0-9]*' | cut -d':' -f2)
    local last_error=$(echo "$response" | grep -o '"last_error_message":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$webhook_url" ]; then
        print_success "Webhook is active"
        print_status "URL: $webhook_url"
        print_status "Pending updates: ${pending_updates:-0}"
        
        if [ -n "$last_error" ]; then
            print_warning "Last error: $last_error"
        fi
    else
        print_error "No webhook is set"
        echo "Full response: $response"
        exit 1
    fi
}

# Start monitoring
start_monitoring() {
    print_header "Starting Webhook Monitoring"
    
    # Create monitoring script
    cat > webhook-monitor.sh << 'EOF'
#!/bin/bash

WEBHOOK_URL=$(cat .webhook_url 2>/dev/null)
CHECK_INTERVAL=60

if [ -z "$WEBHOOK_URL" ]; then
    echo "No webhook URL found"
    exit 1
fi

echo "Starting webhook monitoring for: $WEBHOOK_URL"
echo "Check interval: ${CHECK_INTERVAL}s"

while true; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    response=$(curl -s -w "%{http_code}" -o /dev/null -X POST \
        -H "Content-Type: application/json" \
        -d '{"test": true}' \
        "$WEBHOOK_URL" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "404" ] || [ "$response" = "405" ]; then
        echo "[$timestamp] ✓ Webhook healthy (HTTP $response)"
    else
        echo "[$timestamp] ✗ Webhook unhealthy (HTTP $response)"
    fi
    
    sleep $CHECK_INTERVAL
done
EOF
    
    chmod +x webhook-monitor.sh
    
    print_status "Webhook monitoring script created: webhook-monitor.sh"
    print_status "Run './webhook-monitor.sh' to start monitoring"
}

# Cleanup function
cleanup() {
    print_header "Cleanup"
    
    # Stop ngrok if running
    if [ -f ".ngrok_pid" ]; then
        local ngrok_pid=$(cat .ngrok_pid)
        kill $ngrok_pid 2>/dev/null || true
        rm -f .ngrok_pid
        print_status "ngrok process stopped"
    fi
    
    # Stop cloudflared if running
    docker stop cloudflared-webhook 2>/dev/null || true
    docker rm cloudflared-webhook 2>/dev/null || true
    
    # Clean up temporary files
    rm -f ngrok.log cloudflared-config.yml /tmp/telegram_test.json
}

# Display setup summary
display_summary() {
    print_header "Webhook Setup Summary"
    
    local webhook_url=$(cat .webhook_url 2>/dev/null)
    
    echo ""
    echo -e "${GREEN}🎉 Webhook Setup Completed Successfully!${NC}"
    echo ""
    echo -e "${BLUE}📊 Configuration:${NC}"
    echo "  • Webhook URL:     $webhook_url"
    echo "  • Bot Token:       ${TELEGRAM_BOT_TOKEN:0:10}...${TELEGRAM_BOT_TOKEN: -10}"
    echo "  • Setup Time:      $(date)"
    echo ""
    
    echo -e "${CYAN}🔧 Management Commands:${NC}"
    echo "  • Monitor webhook: ./webhook-monitor.sh"
    echo "  • Check status:    curl -s https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
    echo "  • Delete webhook:  curl -s https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
    echo ""
    
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo "  1. Start the enterprise system: ./start-enterprise.sh"
    echo "  2. Test the webhook by sending a message to your bot"
    echo "  3. Monitor webhook health using the monitoring script"
    echo "  4. Check logs: docker-compose -f docker-compose.enterprise.yml logs -f telegram-bot"
    echo ""
}

# Main function
main() {
    print_header "Enterprise Permanent Webhook Setup"
    
    # Handle script arguments
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Usage: $0 [BOT_TOKEN] [DOMAIN] [CLOUDFLARE_TOKEN]"
        echo ""
        echo "Environment variables (or .env.enterprise):"
        echo "  TELEGRAM_BOT_TOKEN     - Your Telegram bot token"
        echo "  WEBHOOK_DOMAIN         - Your domain name (optional)"
        echo "  CLOUDFLARE_TUNNEL_TOKEN - Cloudflare tunnel token (optional)"
        echo ""
        echo "Examples:"
        echo "  $0  # Use environment variables"
        echo "  $0 123456:ABC-DEF your-domain.com"
        echo "  $0 123456:ABC-DEF your-domain.com cf-tunnel-token"
        exit 0
    fi
    
    # Load configuration
    load_environment "$@"
    
    # Setup trap for cleanup
    trap cleanup EXIT
    
    # Run setup steps
    validate_prerequisites
    test_telegram_api
    
    # Try webhook setup methods in order of preference
    if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ] && [ "$CLOUDFLARE_TUNNEL_TOKEN" != "your_cloudflare_tunnel_token_here" ]; then
        setup_cloudflare_tunnel
    elif [ -n "$WEBHOOK_DOMAIN" ] && [ "$WEBHOOK_DOMAIN" != "your-domain.com" ]; then
        setup_custom_domain
    else
        setup_ngrok_webhook
    fi
    
    # Set webhook and verify
    set_telegram_webhook
    verify_webhook_setup
    start_monitoring
    display_summary
    
    print_success "🚀 Enterprise webhook setup completed successfully!"
}

# Handle script interruption
trap 'print_error "Setup interrupted. Run cleanup manually if needed."; exit 1' INT TERM

# Run main function
main "$@"
