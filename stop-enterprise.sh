#!/bin/bash

# Enterprise Telegram Bot Stop Script
# This script gracefully stops the complete enterprise-grade system

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

# Stop application services first
stop_applications() {
    print_header "Stopping Application Services"
    
    print_status "Stopping Telegram Bot..."
    docker-compose -f docker-compose.enterprise.yml stop telegram-bot || true
    
    print_status "Stopping Backend Service..."
    docker-compose -f docker-compose.enterprise.yml stop backend || true
    
    print_status "Stopping LLM Service..."
    docker-compose -f docker-compose.enterprise.yml stop llm-service || true
    
    print_status "✓ Application services stopped"
}

# Stop Cloudflare Tunnel
stop_tunnel() {
    print_header "Stopping Cloudflare Tunnel"
    
    print_status "Stopping Cloudflare Tunnel..."
    docker-compose -f docker-compose.enterprise.yml stop cloudflared || true
    
    print_status "✓ Cloudflare Tunnel stopped"
}

# Stop observability stack
stop_observability() {
    print_header "Stopping Observability Stack"
    
    print_status "Stopping Exporters..."
    docker-compose -f docker-compose.enterprise.yml stop node-exporter redis-exporter postgres-exporter cadvisor || true
    
    print_status "Stopping Jaeger..."
    docker-compose -f docker-compose.enterprise.yml stop jaeger || true
    
    print_status "Stopping Grafana..."
    docker-compose -f docker-compose.enterprise.yml stop grafana || true
    
    print_status "Stopping Prometheus..."
    docker-compose -f docker-compose.enterprise.yml stop prometheus || true
    
    print_status "✓ Observability stack stopped"
}

# Stop infrastructure services
stop_infrastructure() {
    print_header "Stopping Infrastructure Services"
    
    print_status "Stopping Kong API Gateway..."
    docker-compose -f docker-compose.enterprise.yml stop kong || true
    
    print_status "Stopping Redis..."
    docker-compose -f docker-compose.enterprise.yml stop redis || true
    
    print_status "Stopping PostgreSQL..."
    docker-compose -f docker-compose.enterprise.yml stop postgres || true
    
    print_status "Stopping Kafka components..."
    docker-compose -f docker-compose.enterprise.yml stop kafka-ui kafka-connect schema-registry kafka || true
    
    print_status "Stopping Zookeeper..."
    docker-compose -f docker-compose.enterprise.yml stop zookeeper || true
    
    print_status "Stopping Consul..."
    docker-compose -f docker-compose.enterprise.yml stop consul || true
    
    print_status "✓ Infrastructure services stopped"
}

# Remove containers (optional)
remove_containers() {
    if [ "$1" = "--remove" ] || [ "$1" = "-r" ]; then
        print_header "Removing Containers"
        
        print_status "Removing all containers..."
        docker-compose -f docker-compose.enterprise.yml down
        
        print_status "✓ Containers removed"
    fi
}

# Clean up volumes (optional)
clean_volumes() {
    if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
        print_header "Cleaning Volumes"
        
        print_warning "This will remove all data including databases, logs, and metrics!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Removing volumes..."
            docker-compose -f docker-compose.enterprise.yml down -v
            
            print_status "Removing local data directories..."
            rm -rf data/ || true
            rm -rf logs/ || true
            
            print_status "✓ Volumes and data cleaned"
        else
            print_status "Volume cleanup cancelled"
        fi
    fi
}

# Clean up images (optional)
clean_images() {
    if [ "$1" = "--clean-images" ] || [ "$1" = "-ci" ]; then
        print_header "Cleaning Images"
        
        print_status "Removing enterprise images..."
        docker rmi telegram-bot:enterprise backend:enterprise llm-service:enterprise || true
        
        print_status "Removing unused images..."
        docker image prune -f || true
        
        print_status "✓ Images cleaned"
    fi
}

# Show system status
show_status() {
    print_header "System Status"
    
    print_status "Checking running containers..."
    
    # Check if any enterprise containers are still running
    RUNNING_CONTAINERS=$(docker-compose -f docker-compose.enterprise.yml ps --services --filter "status=running" 2>/dev/null || echo "")
    
    if [ -z "$RUNNING_CONTAINERS" ]; then
        print_status "✓ All enterprise services are stopped"
    else
        print_warning "Some services are still running:"
        echo "$RUNNING_CONTAINERS"
    fi
    
    # Show resource usage
    print_status "Docker resource usage:"
    docker system df || true
}

# Display help
show_help() {
    echo "Enterprise Telegram Bot Stop Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -r, --remove        Remove containers after stopping"
    echo "  -c, --clean         Clean all volumes and data (DESTRUCTIVE)"
    echo "  -ci, --clean-images Clean Docker images"
    echo "  -f, --force         Force stop without confirmation"
    echo "  -s, --status        Show system status only"
    echo ""
    echo "Examples:"
    echo "  $0                  Stop all services gracefully"
    echo "  $0 --remove         Stop and remove containers"
    echo "  $0 --clean          Stop, remove containers, and clean all data"
    echo "  $0 --status         Show current system status"
    echo ""
}

# Force stop all containers
force_stop() {
    print_header "Force Stopping All Services"
    
    print_status "Force stopping all containers..."
    docker-compose -f docker-compose.enterprise.yml kill || true
    
    print_status "Removing containers..."
    docker-compose -f docker-compose.enterprise.yml down || true
    
    print_status "✓ Force stop completed"
}

# Main execution
main() {
    local REMOVE_CONTAINERS=false
    local CLEAN_VOLUMES=false
    local CLEAN_IMAGES=false
    local FORCE_STOP=false
    local STATUS_ONLY=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -r|--remove)
                REMOVE_CONTAINERS=true
                shift
                ;;
            -c|--clean)
                CLEAN_VOLUMES=true
                REMOVE_CONTAINERS=true
                shift
                ;;
            -ci|--clean-images)
                CLEAN_IMAGES=true
                shift
                ;;
            -f|--force)
                FORCE_STOP=true
                shift
                ;;
            -s|--status)
                STATUS_ONLY=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_header "Enterprise Telegram Bot System Shutdown"
    
    # If status only, show status and exit
    if [ "$STATUS_ONLY" = true ]; then
        show_status
        exit 0
    fi
    
    # If force stop, do it and exit
    if [ "$FORCE_STOP" = true ]; then
        force_stop
        exit 0
    fi
    
    # Normal graceful shutdown
    print_status "Starting graceful shutdown..."
    
    stop_applications
    stop_tunnel
    stop_observability
    stop_infrastructure
    
    if [ "$REMOVE_CONTAINERS" = true ]; then
        remove_containers --remove
    fi
    
    if [ "$CLEAN_VOLUMES" = true ]; then
        clean_volumes --clean
    fi
    
    if [ "$CLEAN_IMAGES" = true ]; then
        clean_images --clean-images
    fi
    
    show_status
    
    print_status "🛑 Enterprise system shutdown completed successfully!"
    
    if [ "$REMOVE_CONTAINERS" = false ]; then
        print_status "💡 Tip: Use './stop-enterprise.sh --remove' to also remove containers"
        print_status "💡 Tip: Use './start-enterprise.sh' to restart the system"
    fi
}

# Handle script interruption
trap 'print_error "Shutdown interrupted."; exit 1' INT TERM

# Run main function
main "$@"
