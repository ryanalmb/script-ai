#!/bin/bash
# Production startup script with robust initialization

set -e

echo "🚀 Starting X Marketing Platform Backend..."

# Function to wait for service with timeout
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local timeout=${4:-60}
    
    echo "⏳ Waiting for $service_name ($host:$port)..."
    
    local count=0
    while ! nc -z "$host" "$port"; do
        if [ $count -ge $timeout ]; then
            echo "❌ Timeout waiting for $service_name"
            exit 1
        fi
        echo "   $service_name not ready, waiting... ($count/$timeout)"
        sleep 1
        count=$((count + 1))
    done
    
    echo "✅ $service_name is ready!"
}

# Function to test database connection
test_database() {
    echo "🔍 Testing database connection..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if PGPASSWORD=password psql -h postgres -U postgres -d x_marketing_platform -c "SELECT 1;" > /dev/null 2>&1; then
            echo "✅ Database connection successful!"
            return 0
        fi
        
        echo "   Database connection attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Database connection failed after $max_attempts attempts"
    exit 1
}

# Function to test Redis connection
test_redis() {
    echo "🔍 Testing Redis connection..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if redis-cli -h redis -p 6379 ping > /dev/null 2>&1; then
            echo "✅ Redis connection successful!"
            return 0
        fi
        
        echo "   Redis connection attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Redis connection failed after $max_attempts attempts"
    exit 1
}

# Wait for services to be available
wait_for_service "postgres" "5432" "PostgreSQL" 60
wait_for_service "redis" "6379" "Redis" 30

# Test actual connections
test_database
test_redis

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy || {
    echo "⚠️  Migration failed, attempting to generate and apply..."
    npx prisma generate
    npx prisma db push --force-reset
}

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start the application
echo "🎯 Starting application..."
exec node dist/index.js
