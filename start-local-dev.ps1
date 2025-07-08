# X Marketing Platform - Complete Local Development Startup Script
# This script starts all services for local development

Write-Host "🚀 Starting X Marketing Platform - Local Development Environment" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

# Check if Docker is running
Write-Host "🔍 Checking Docker status..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is available
Write-Host "🔍 Checking Docker Compose..." -ForegroundColor Yellow
try {
    docker-compose version | Out-Null
    Write-Host "✅ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not available. Please install Docker Compose." -ForegroundColor Red
    exit 1
}

# Create environment file if it doesn't exist
Write-Host "🔧 Setting up environment..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "📝 Creating .env.local file..." -ForegroundColor Yellow
    @"
# X Marketing Platform - Local Development Environment
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/x_marketing_automation
REDIS_URL=redis://localhost:6379
JWT_SECRET=local-development-jwt-secret-key-32-chars-long
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
LLM_SERVICE_URL=http://localhost:3003
TELEGRAM_BOT_URL=http://localhost:3002

# API Keys (Demo values for local development)
X_API_KEY=demo-x-api-key
X_API_SECRET=demo-x-api-secret
X_BEARER_TOKEN=demo-x-bearer-token
HUGGINGFACE_API_KEY=demo-huggingface-key
TELEGRAM_BOT_TOKEN=demo-telegram-token
OPENAI_API_KEY=demo-openai-key
ANTHROPIC_API_KEY=demo-anthropic-key

# Service Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=10
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
AUTOMATION_MODE=true
ENABLE_ANALYTICS=true
ENABLE_CORS=true
MAX_REQUEST_SIZE=10mb
CACHE_TTL=3600
TRUST_PROXY=false

# LLM Service Configuration
FLASK_ENV=development
FLASK_DEBUG=1
ENABLE_CACHING=true
MAX_TOKENS=2048
TEMPERATURE=0.7

# Telegram Bot Configuration
WEBHOOK_URL=http://localhost:3002/webhook
ENABLE_POLLING=true
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "✅ Created .env.local file" -ForegroundColor Green
} else {
    Write-Host "✅ .env.local file already exists" -ForegroundColor Green
}

# Stop any existing containers
Write-Host "🛑 Stopping any existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down --remove-orphans

# Pull latest images
Write-Host "📥 Pulling latest images..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml pull

# Build and start services
Write-Host "🏗️ Building and starting services..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml up --build -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service health
Write-Host "🏥 Checking service health..." -ForegroundColor Yellow

$services = @(
    @{Name="PostgreSQL"; Url="http://localhost:5432"; Port=5432},
    @{Name="Redis"; Url="http://localhost:6379"; Port=6379},
    @{Name="Backend API"; Url="http://localhost:3001/health"; Port=3001},
    @{Name="Frontend"; Url="http://localhost:3000"; Port=3000},
    @{Name="Telegram Bot"; Url="http://localhost:3002/health"; Port=3002},
    @{Name="LLM Service"; Url="http://localhost:3003/health"; Port=3003}
)

foreach ($service in $services) {
    Write-Host "  Checking $($service.Name)..." -ForegroundColor Cyan
    try {
        if ($service.Name -eq "PostgreSQL" -or $service.Name -eq "Redis") {
            # Check if port is open
            $connection = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue
            if ($connection.TcpTestSucceeded) {
                Write-Host "    ✅ $($service.Name) is running" -ForegroundColor Green
            } else {
                Write-Host "    ❌ $($service.Name) is not responding" -ForegroundColor Red
            }
        } else {
            # Check HTTP endpoint
            $response = Invoke-WebRequest -Uri $service.Url -TimeoutSec 10 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "    ✅ $($service.Name) is healthy" -ForegroundColor Green
            } else {
                Write-Host "    ⚠️ $($service.Name) responded with status $($response.StatusCode)" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "    ❌ $($service.Name) is not responding" -ForegroundColor Red
    }
}

# Show service URLs
Write-Host ""
Write-Host "🌐 Service URLs:" -ForegroundColor Green
Write-Host "  Frontend Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend API: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  API Documentation: http://localhost:3001/docs" -ForegroundColor Cyan
Write-Host "  Telegram Bot: http://localhost:3002" -ForegroundColor Cyan
Write-Host "  LLM Service: http://localhost:3003" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432" -ForegroundColor Cyan
Write-Host "  Redis: localhost:6379" -ForegroundColor Cyan

Write-Host ""
Write-Host "📋 Quick Commands:" -ForegroundColor Green
Write-Host "  View logs: docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor Cyan
Write-Host "  Stop services: docker-compose -f docker-compose.dev.yml down" -ForegroundColor Cyan
Write-Host "  Restart service: docker-compose -f docker-compose.dev.yml restart <service>" -ForegroundColor Cyan
Write-Host "  View service status: docker-compose -f docker-compose.dev.yml ps" -ForegroundColor Cyan

Write-Host ""
Write-Host "🎯 Test the Natural Language Campaign Feature:" -ForegroundColor Green
Write-Host "  1. Open Telegram and find your bot" -ForegroundColor Cyan
Write-Host "  2. Send: /create_campaign I want to promote my crypto course to young investors" -ForegroundColor Cyan
Write-Host "  3. Watch the AI create a complete campaign automatically!" -ForegroundColor Cyan

Write-Host ""
Write-Host "🚀 X Marketing Platform is now running locally!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
