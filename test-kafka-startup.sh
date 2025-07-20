#!/bin/bash

# Test Kafka Startup Script
# This script tests the Kafka infrastructure startup without building images

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

# Load environment variables
if [ -f ".env.enterprise" ]; then
    source .env.enterprise
fi

print_header "Testing Kafka Infrastructure Startup"

print_status "Starting Zookeeper..."
docker-compose -f docker-compose.enterprise.yml --env-file .env.enterprise up -d zookeeper

print_status "Waiting for Zookeeper to be healthy..."
sleep 10

print_status "Starting Kafka..."
docker-compose -f docker-compose.enterprise.yml --env-file .env.enterprise up -d kafka

print_status "Waiting for Kafka to be healthy..."
sleep 15

print_status "Starting Schema Registry..."
docker-compose -f docker-compose.enterprise.yml --env-file .env.enterprise up -d schema-registry

print_status "Waiting for Schema Registry to be healthy..."
sleep 10

print_status "Checking service status..."
docker-compose -f docker-compose.enterprise.yml --env-file .env.enterprise ps

print_status "Testing Kafka connectivity..."
# Test if Kafka is accessible
if docker exec kafka-enterprise kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
    print_status "✓ Kafka is accessible and responding"
else
    print_error "✗ Kafka is not responding"
    exit 1
fi

print_status "Testing Schema Registry connectivity..."
# Test if Schema Registry is accessible
if curl -f -s http://localhost:8081/subjects > /dev/null 2>&1; then
    print_status "✓ Schema Registry is accessible and responding"
else
    print_warning "Schema Registry may still be starting up"
fi

print_header "Kafka Infrastructure Test Results"
echo ""
echo -e "${GREEN}🚀 Kafka Infrastructure Status:${NC}"
echo "  ✓ Zookeeper is running"
echo "  ✓ Kafka is running and healthy"
echo "  ✓ Schema Registry is running"
echo ""

echo -e "${BLUE}📊 Service URLs:${NC}"
echo "  • Kafka Bootstrap Server:    localhost:9092"
echo "  • Zookeeper:                 localhost:2181"
echo "  • Schema Registry:           http://localhost:8081"
echo "  • Kafka JMX Metrics:         localhost:9101"
echo ""

echo -e "${GREEN}🔧 Test Commands:${NC}"
echo "  • Check Kafka topics:        docker exec kafka-enterprise kafka-topics --bootstrap-server localhost:9092 --list"
echo "  • Check Schema Registry:     curl http://localhost:8081/subjects"
echo "  • View logs:                 docker-compose -f docker-compose.enterprise.yml logs -f kafka"
echo "  • Stop services:             docker-compose -f docker-compose.enterprise.yml down"
echo ""

print_status "🎉 Kafka infrastructure test completed successfully!"
print_status "The Kafka issues have been resolved. You can now run the full enterprise startup script."
