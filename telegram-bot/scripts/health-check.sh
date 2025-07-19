#!/bin/bash
# Health check script for Telegram Bot service

set -e

# Configuration
HEALTH_URL="http://localhost:3002/health"
TIMEOUT=10
MAX_RETRIES=3

# Function to check health
check_health() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo "Health check attempt $attempt/$MAX_RETRIES..."
        
        if curl -f -s --max-time $TIMEOUT "$HEALTH_URL" >/dev/null 2>&1; then
            echo "✓ Service is healthy"
            return 0
        fi
        
        echo "✗ Health check failed (attempt $attempt)"
        attempt=$((attempt + 1))
        
        if [ $attempt -le $MAX_RETRIES ]; then
            sleep 2
        fi
    done
    
    echo "✗ Service is unhealthy after $MAX_RETRIES attempts"
    return 1
}

# Run health check
check_health
