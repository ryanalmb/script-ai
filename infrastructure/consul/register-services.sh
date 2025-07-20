#!/bin/bash

# Consul Service Registration Script
# This script registers all enterprise services with Consul

set -e

CONSUL_HOST=${CONSUL_HOST:-consul}
CONSUL_PORT=${CONSUL_PORT:-8500}
CONSUL_URL="http://${CONSUL_HOST}:${CONSUL_PORT}"

echo "Waiting for Consul to be ready..."
until curl -f "${CONSUL_URL}/v1/status/leader" >/dev/null 2>&1; do
    echo "Consul not ready, waiting..."
    sleep 2
done

echo "Consul is ready. Registering services..."

# Register Backend Service
curl -X PUT "${CONSUL_URL}/v1/agent/service/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ID": "backend-service",
    "Name": "backend",
    "Tags": ["api", "backend", "x-marketing"],
    "Address": "backend",
    "Port": 3001,
    "Meta": {
      "version": "1.0.0",
      "environment": "enterprise"
    },
    "Check": {
      "HTTP": "http://backend:3001/health",
      "Interval": "10s",
      "Timeout": "3s",
      "DeregisterCriticalServiceAfter": "30s"
    }
  }'

echo "✓ Backend service registered"

# Register Telegram Bot Service
curl -X PUT "${CONSUL_URL}/v1/agent/service/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ID": "telegram-bot-service",
    "Name": "telegram-bot",
    "Tags": ["bot", "telegram", "messaging"],
    "Address": "telegram-bot",
    "Port": 3002,
    "Meta": {
      "version": "1.0.0",
      "environment": "enterprise"
    },
    "Check": {
      "HTTP": "http://telegram-bot:3002/health",
      "Interval": "10s",
      "Timeout": "3s",
      "DeregisterCriticalServiceAfter": "30s"
    }
  }'

echo "✓ Telegram Bot service registered"

# Register LLM Service
curl -X PUT "${CONSUL_URL}/v1/agent/service/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ID": "llm-service",
    "Name": "llm-service",
    "Tags": ["ai", "llm", "content-generation"],
    "Address": "llm-service",
    "Port": 3003,
    "Meta": {
      "version": "1.0.0",
      "environment": "enterprise"
    },
    "Check": {
      "HTTP": "http://llm-service:3003/health",
      "Interval": "10s",
      "Timeout": "3s",
      "DeregisterCriticalServiceAfter": "30s"
    }
  }'

echo "✓ LLM service registered"

# Register PostgreSQL Service
curl -X PUT "${CONSUL_URL}/v1/agent/service/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ID": "postgres-service",
    "Name": "postgres",
    "Tags": ["database", "postgresql"],
    "Address": "postgres",
    "Port": 5432,
    "Meta": {
      "version": "15",
      "environment": "enterprise"
    },
    "Check": {
      "TCP": "postgres:5432",
      "Interval": "10s",
      "Timeout": "3s",
      "DeregisterCriticalServiceAfter": "30s"
    }
  }'

echo "✓ PostgreSQL service registered"

# Register Redis Service
curl -X PUT "${CONSUL_URL}/v1/agent/service/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ID": "redis-service",
    "Name": "redis",
    "Tags": ["cache", "redis"],
    "Address": "redis",
    "Port": 6379,
    "Meta": {
      "version": "7",
      "environment": "enterprise"
    },
    "Check": {
      "TCP": "redis:6379",
      "Interval": "10s",
      "Timeout": "3s",
      "DeregisterCriticalServiceAfter": "30s"
    }
  }'

echo "✓ Redis service registered"

# Register Kafka Service
curl -X PUT "${CONSUL_URL}/v1/agent/service/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ID": "kafka-service",
    "Name": "kafka",
    "Tags": ["messaging", "kafka", "event-streaming"],
    "Address": "kafka",
    "Port": 9092,
    "Meta": {
      "version": "7.4.0",
      "environment": "enterprise"
    },
    "Check": {
      "TCP": "kafka:9092",
      "Interval": "10s",
      "Timeout": "3s",
      "DeregisterCriticalServiceAfter": "30s"
    }
  }'

echo "✓ Kafka service registered"

echo "All services registered successfully with Consul!"

# List registered services
echo "Current registered services:"
curl -s "${CONSUL_URL}/v1/agent/services" | jq '.'
