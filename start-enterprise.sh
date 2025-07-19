#!/bin/bash

# Enterprise Telegram Bot Startup Script
# This script starts the complete enterprise-grade system with all components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if Docker and Docker Compose are installed
check_dependencies() {
    print_header "Checking Dependencies"
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "✓ Docker is installed"
    print_status "✓ Docker Compose is installed"
}

# Check environment variables
check_environment() {
    print_header "Checking Environment Configuration"
    
    if [ ! -f ".env.enterprise" ]; then
        print_warning ".env.enterprise file not found. Creating from template..."
        cp .env.enterprise.template .env.enterprise 2>/dev/null || true
    fi
    
    # Check critical environment variables
    source .env.enterprise

    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ "$TELEGRAM_BOT_TOKEN" = "your_telegram_bot_token_here" ]; then
        print_error "TELEGRAM_BOT_TOKEN is not set in .env.enterprise"
        print_error "Please set your Telegram bot token before starting the system"
        exit 1
    fi

    # Validate bot token format
    if [[ ! "$TELEGRAM_BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
        print_error "Invalid Telegram bot token format"
        exit 1
    fi

    if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
        print_warning "GEMINI_API_KEY is not set. LLM features will be limited."
    fi

    if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ] || [ "$CLOUDFLARE_TUNNEL_TOKEN" = "your_cloudflare_tunnel_token_here" ]; then
        print_warning "CLOUDFLARE_TUNNEL_TOKEN is not set. Webhook will not be available."
    fi

    if [ -z "$WEBHOOK_DOMAIN" ] || [ "$WEBHOOK_DOMAIN" = "your-domain.com" ]; then
        print_warning "WEBHOOK_DOMAIN is not set. Using localhost for development."
        export WEBHOOK_DOMAIN="localhost"
    fi
    
    print_status "✓ Environment configuration checked"
}

# Create necessary directories
create_directories() {
    print_header "Creating Directories"

    mkdir -p logs
    mkdir -p data/postgres
    mkdir -p data/redis
    mkdir -p data/kafka
    mkdir -p data/prometheus
    mkdir -p data/grafana
    mkdir -p data/jaeger
    mkdir -p data/consul
    mkdir -p data/certbot/conf
    mkdir -p data/certbot/www
    mkdir -p data/certbot/logs
    mkdir -p data/nginx/cache
    mkdir -p data/elasticsearch
    mkdir -p data/fluentd/backup
    mkdir -p data/backup
    mkdir -p scripts

    # Set proper permissions
    chmod 755 data/certbot/www
    chmod 700 data/certbot/conf

    print_status "✓ Directories created"
}

# Build Docker images
build_images() {
    print_header "Building Docker Images"
    
    print_status "Building Telegram Bot image..."
    docker build -f telegram-bot/Dockerfile.enterprise -t telegram-bot:enterprise telegram-bot/
    
    print_status "Building Backend image..."
    docker build -f backend/Dockerfile.enterprise -t backend:enterprise backend/
    
    print_status "Building LLM Service image..."
    docker build -f llm-service/Dockerfile.enterprise -t llm-service:enterprise llm-service/
    
    print_status "✓ Docker images built successfully"
}

# Start infrastructure services
start_infrastructure() {
    print_header "Starting Infrastructure Services"
    
    print_status "Starting Consul (Service Discovery)..."
    docker-compose -f docker-compose.enterprise.yml up -d consul
    
    print_status "Starting Kafka (Event Streaming)..."
    docker-compose -f docker-compose.enterprise.yml up -d zookeeper kafka schema-registry
    
    print_status "Starting PostgreSQL (Database)..."
    docker-compose -f docker-compose.enterprise.yml up -d postgres
    
    print_status "Starting Redis (Cache)..."
    docker-compose -f docker-compose.enterprise.yml up -d redis
    
    print_status "Starting Kong (API Gateway)..."
    docker-compose -f docker-compose.enterprise.yml up -d kong
    
    print_status "✓ Infrastructure services started"
}

# Start observability stack
start_observability() {
    print_header "Starting Observability Stack"
    
    print_status "Starting Prometheus (Metrics)..."
    docker-compose -f docker-compose.enterprise.yml up -d prometheus
    
    print_status "Starting Grafana (Dashboards)..."
    docker-compose -f docker-compose.enterprise.yml up -d grafana
    
    print_status "Starting Jaeger (Tracing)..."
    docker-compose -f docker-compose.enterprise.yml up -d jaeger
    
    print_status "Starting Exporters..."
    docker-compose -f docker-compose.enterprise.yml up -d node-exporter redis-exporter postgres-exporter cadvisor
    
    print_status "✓ Observability stack started"
}

# Start application services
start_applications() {
    print_header "Starting Application Services"
    
    print_status "Starting Backend Service..."
    docker-compose -f docker-compose.enterprise.yml up -d backend
    
    print_status "Starting LLM Service..."
    docker-compose -f docker-compose.enterprise.yml up -d llm-service
    
    print_status "Starting Telegram Bot..."
    docker-compose -f docker-compose.enterprise.yml up -d telegram-bot
    
    print_status "✓ Application services started"
}

# Setup webhook configuration
setup_webhook() {
    print_header "Setting up Webhook Configuration"

    # Run the webhook setup script
    if [ -f "scripts/setup-permanent-webhook.sh" ]; then
        print_status "Running webhook setup script..."
        ./scripts/setup-permanent-webhook.sh "$TELEGRAM_BOT_TOKEN" "$WEBHOOK_DOMAIN" "$CLOUDFLARE_TUNNEL_TOKEN"

        if [ $? -eq 0 ]; then
            print_status "✓ Webhook configured successfully"
        else
            print_warning "Webhook setup failed, continuing with basic configuration"
        fi
    else
        print_warning "Webhook setup script not found, using basic configuration"
    fi
}

# Start Cloudflare Tunnel if configured
start_tunnel() {
    if [ ! -z "$CLOUDFLARE_TUNNEL_TOKEN" ] && [ "$CLOUDFLARE_TUNNEL_TOKEN" != "your_cloudflare_tunnel_token_here" ]; then
        print_header "Starting Cloudflare Tunnel"

        print_status "Starting Cloudflare Tunnel for webhook..."
        docker-compose -f docker-compose.enterprise.yml --profile tunnel up -d cloudflared

        print_status "✓ Cloudflare Tunnel started"
    else
        print_warning "Cloudflare Tunnel not configured. Skipping..."
    fi
}

# Start SSL and proxy services
start_ssl_proxy() {
    if [ "$WEBHOOK_DOMAIN" != "localhost" ] && [ "$WEBHOOK_DOMAIN" != "your-domain.com" ]; then
        print_header "Starting SSL and Proxy Services"

        print_status "Generating DH parameters for SSL..."
        if [ ! -f "data/ssl/dhparam.pem" ]; then
            mkdir -p data/ssl
            openssl dhparam -out data/ssl/dhparam.pem 2048 2>/dev/null || print_warning "Failed to generate DH parameters"
        fi

        print_status "Starting SSL certificate manager..."
        docker-compose -f docker-compose.enterprise.yml --profile ssl up -d certbot

        print_status "Starting Nginx reverse proxy..."
        docker-compose -f docker-compose.enterprise.yml --profile proxy up -d nginx

        print_status "✓ SSL and proxy services started"
    else
        print_warning "SSL and proxy services not configured for localhost"
    fi
}

# Start additional enterprise services
start_additional_services() {
    print_header "Starting Additional Enterprise Services"

    print_status "Starting log aggregation services..."
    docker-compose -f docker-compose.enterprise.yml --profile logging up -d fluentd elasticsearch kibana

    print_status "Starting monitoring services..."
    docker-compose -f docker-compose.enterprise.yml --profile monitoring up -d webhook-monitor

    print_status "Starting management services..."
    docker-compose -f docker-compose.enterprise.yml --profile management up -d kafka-ui

    print_status "✓ Additional enterprise services started"
}

# Wait for services to be healthy
wait_for_services() {
    print_header "Waiting for Services to be Ready"

    print_status "Waiting for infrastructure services..."
    sleep 30

    print_status "Waiting for application services..."
    sleep 20

    # Check service health with retries
    check_service_health() {
        local service_name=$1
        local health_url=$2
        local max_attempts=5
        local attempt=1

        while [ $attempt -le $max_attempts ]; do
            if curl -f -s "$health_url" >/dev/null 2>&1; then
                print_status "✓ $service_name is healthy"
                return 0
            fi

            if [ $attempt -eq $max_attempts ]; then
                print_warning "$service_name health check failed after $max_attempts attempts"
                return 1
            fi

            sleep 5
            attempt=$((attempt + 1))
        done
    }

    print_status "Checking service health..."

    # Check core services
    check_service_health "Kong API Gateway" "http://localhost:8001/status"
    check_service_health "Consul" "http://localhost:8500/v1/status/leader"
    check_service_health "Prometheus" "http://localhost:9090/-/healthy"
    check_service_health "Grafana" "http://localhost:3000/api/health"
    check_service_health "Telegram Bot" "http://localhost:3002/health"
    check_service_health "Backend API" "http://localhost:3001/api/health"
    check_service_health "LLM Service" "http://localhost:3003/health"

    # Check additional services
    check_service_health "Jaeger" "http://localhost:16686/"
    check_service_health "Kafka UI" "http://localhost:8080/"

    print_status "✓ Service health checks completed"
}

# Display service URLs and information
display_info() {
    print_header "Enterprise System Started Successfully"
    
    echo ""
    echo -e "${GREEN}🚀 System Status:${NC}"
    echo "  ✓ All services are running"
    echo "  ✓ Enterprise infrastructure deployed"
    echo "  ✓ Observability stack active"
    echo ""
    
    echo -e "${BLUE}📊 Service URLs:${NC}"
    echo "  • API Gateway (Kong):     http://localhost:8000"
    echo "  • Kong Admin:             http://localhost:8001"
    echo "  • Consul UI:              http://localhost:8500"
    echo "  • Prometheus:             http://localhost:9090"
    echo "  • Grafana:                http://localhost:3000 (admin/admin)"
    echo "  • Jaeger UI:              http://localhost:16686"
    echo "  • Kafka UI:               http://localhost:8080"
    echo "  • Kibana (Logs):          http://localhost:5601"
    echo "  • Elasticsearch:          http://localhost:9200"
    echo "  • Telegram Bot Health:    http://localhost:3002/health"
    echo "  • Backend Health:         http://localhost:3001/api/health"
    echo "  • LLM Service Health:     http://localhost:3003/health"

    if [ "$WEBHOOK_DOMAIN" != "localhost" ]; then
        echo "  • Webhook URL:            https://$WEBHOOK_DOMAIN/webhook/telegram"
        echo "  • SSL Status:             https://$WEBHOOK_DOMAIN"
    fi
    echo ""
    
    echo -e "${YELLOW}📈 Metrics Endpoints:${NC}"
    echo "  • Telegram Bot Metrics:   http://localhost:9091/metrics"
    echo "  • Backend Metrics:        http://localhost:9092/metrics"
    echo "  • LLM Service Metrics:    http://localhost:9093/metrics"
    echo "  • Node Exporter:          http://localhost:9100/metrics"
    echo "  • Redis Exporter:         http://localhost:9121/metrics"
    echo "  • Postgres Exporter:      http://localhost:9187/metrics"
    echo ""
    
    echo -e "${GREEN}🔧 Management Commands:${NC}"
    echo "  • View logs:              docker-compose -f docker-compose.enterprise.yml logs -f [service]"
    echo "  • Stop system:            ./stop-enterprise.sh"
    echo "  • Restart service:        docker-compose -f docker-compose.enterprise.yml restart [service]"
    echo "  • Scale service:          docker-compose -f docker-compose.enterprise.yml up -d --scale [service]=N"
    echo ""
    
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "  • Health Checks:          http://localhost:3002/health/detailed"
    echo "  • API Documentation:      http://localhost:8000/docs"
    echo "  • System Metrics:         http://localhost:9090/targets"
    echo ""
}

# Main execution
main() {
    print_header "Enterprise Telegram Bot System Startup"
    
    # Load environment variables
    if [ -f ".env.enterprise" ]; then
        source .env.enterprise
    fi
    
    check_dependencies
    check_environment
    create_directories
    build_images
    start_infrastructure
    start_observability
    start_applications
    setup_webhook
    start_tunnel
    start_ssl_proxy
    start_additional_services
    wait_for_services
    display_info
    
    print_status "🎉 Enterprise system startup completed successfully!"
    print_status "Monitor the system using the URLs provided above."
}

# Handle script interruption
trap 'print_error "Startup interrupted. Run ./stop-enterprise.sh to clean up."; exit 1' INT TERM

# Run main function
main "$@"
