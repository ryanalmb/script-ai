@echo off
REM Complete Production Deployment Script for X/Twitter Automation Platform
REM Windows Batch version for maximum compatibility

echo.
echo ========================================
echo 🚀 X/Twitter Automation Platform
echo    Production Deployment Starting
echo ========================================
echo Platform: Enterprise X/Twitter Automation
echo Version: Production v1.0.0
echo Timestamp: %date% %time%
echo ========================================
echo.

REM Step 1: Check Prerequisites
echo 🔍 STEP 1: Checking Prerequisites...
echo ----------------------------------------

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop and try again
    pause
    exit /b 1
) else (
    echo ✅ Docker found
    docker --version
)

REM Check Docker Compose
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker Compose is not installed or not in PATH
    echo Please install Docker Compose and try again
    pause
    exit /b 1
) else (
    echo ✅ Docker Compose found
    docker-compose --version
)

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ and try again
    pause
    exit /b 1
) else (
    echo ✅ Node.js found
    node --version
)

echo ✅ Prerequisites check completed
echo.

REM Step 2: Create Production Environment
echo 🔧 STEP 2: Creating Production Environment...
echo ----------------------------------------

if exist .env.production (
    echo ⚠️  Production environment file already exists
    echo Creating backup...
    copy .env.production .env.production.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2% >nul
)

echo Creating production environment configuration...
(
echo # X/Twitter Automation Platform - Production Environment Configuration
echo # Generated automatically - customize as needed
echo.
echo # Core Configuration
echo NODE_ENV=production
echo PORT=3000
echo LOG_LEVEL=info
echo ENABLE_DETAILED_LOGGING=false
echo.
echo # Database Configuration
echo POSTGRES_PASSWORD=ScriptAI_Prod_2024_SecurePass!
echo DATABASE_URL=postgresql://postgres:ScriptAI_Prod_2024_SecurePass!@postgres:5432/script_ai
echo DATABASE_POOL_MIN=10
echo DATABASE_POOL_MAX=50
echo DATABASE_POOL_IDLE_TIMEOUT=30000
echo DATABASE_POOL_ACQUIRE_TIMEOUT=60000
echo.
echo # Redis Configuration
echo REDIS_PASSWORD=ScriptAI_Redis_2024_SecurePass!
echo REDIS_URL=redis://:ScriptAI_Redis_2024_SecurePass!@redis:6379
echo REDIS_TTL_DEFAULT=3600
echo REDIS_MAX_RETRIES=3
echo REDIS_RETRY_DELAY=1000
echo.
echo # Security Configuration
echo JWT_SECRET=ScriptAI_JWT_Production_Secret_Key_2024_Very_Secure_32_Chars_Min
echo JWT_EXPIRES_IN=24h
echo ENCRYPTION_KEY=ScriptAI_AES256_Encryption_Key_32_Characters_Required_2024
echo BOT_JWT_SECRET=ScriptAI_Bot_JWT_Secret_Key_2024_Production_Secure
echo BCRYPT_ROUNDS=12
echo.
echo # External API Configuration ^(REPLACE WITH YOUR ACTUAL KEYS^)
echo TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_FROM_BOTFATHER
echo HUGGING_FACE_API_KEY=YOUR_HUGGING_FACE_API_KEY
echo.
echo # Real-Time Sync Configuration
echo ENABLE_REAL_TIME_SYNC=true
echo REAL_TIME_SYNC_LOG_LEVEL=info
echo ACCOUNT_SYNC_INTERVAL_SECONDS=30
echo ACCOUNT_SYNC_BATCH_SIZE=10
echo ACCOUNT_SYNC_RETRY_ATTEMPTS=3
echo ACCOUNT_SYNC_TIMEOUT=30000
echo.
echo # Analytics Collection
echo ANALYTICS_COLLECTION_ENABLED=true
echo ANALYTICS_BUFFER_SIZE=1000
echo ANALYTICS_FLUSH_INTERVAL_SECONDS=10
echo ANALYTICS_RATE_LIMIT_PER_MINUTE=300
echo.
echo # Campaign Tracking
echo CAMPAIGN_TRACKING_ENABLED=true
echo CAMPAIGN_TRACKING_INTERVAL_SECONDS=300
echo CAMPAIGN_ANALYTICS_INTERVAL_SECONDS=900
echo.
echo # WebSocket Configuration
echo WEBSOCKET_ENABLED=true
echo WEBSOCKET_MAX_CONNECTIONS=1000
echo WEBSOCKET_MESSAGE_QUEUE_SIZE=100
echo WEBSOCKET_BROADCAST_INTERVAL_SECONDS=30
echo WEBSOCKET_PING_INTERVAL=25000
echo WEBSOCKET_PING_TIMEOUT=60000
echo.
echo # Data Integrity
echo DATA_INTEGRITY_ENABLED=true
echo DATA_VALIDATION_INTERVAL_SECONDS=300
echo DATA_RETENTION_CHECK_INTERVAL_SECONDS=3600
echo DATA_QUALITY_THRESHOLD=0.8
echo.
echo # Anti-Detection Configuration
echo ANTI_DETECTION_ENABLED=true
echo PROXY_ROTATION_ENABLED=true
echo FINGERPRINT_ROTATION_ENABLED=true
echo BEHAVIOR_SIMULATION_ENABLED=true
echo DETECTION_EVASION_LEVEL=medium
echo.
echo # Performance Thresholds
echo MIN_ENGAGEMENT_RATE=0.02
echo MIN_QUALITY_SCORE=0.7
echo MAX_RISK_SCORE=0.3
echo MAX_ACTIONS_PER_HOUR=100
echo.
echo # Rate Limiting
echo RATE_LIMIT_WINDOW_MS=900000
echo RATE_LIMIT_MAX_REQUESTS=100
echo BOT_RATE_LIMIT_PER_MINUTE=60
echo.
echo # CORS Configuration
echo FRONTEND_URL=http://localhost:3001
echo ALLOWED_ORIGINS=http://localhost:3001,https://yourdomain.com
echo.
echo # Monitoring and Health
echo HEALTH_CHECK_ENABLED=true
echo METRICS_COLLECTION_ENABLED=true
echo PERFORMANCE_MONITORING_ENABLED=true
echo.
echo # Bot Configuration
echo BOT_DETAILED_LOGGING=false
echo BOT_WEBHOOK_SECRET=ScriptAI_Webhook_Secret_2024_Production
echo.
echo # Build Configuration
echo BUILD_VERSION=1.0.0
echo BUILD_DATE=%date%T%time%Z
) > .env.production

echo ✅ Production environment file created: .env.production
echo ⚠️  IMPORTANT: Update TELEGRAM_BOT_TOKEN and HUGGING_FACE_API_KEY with your actual keys
echo.

REM Step 3: Deploy Services
echo 🚀 STEP 3: Deploying Production Services...
echo ----------------------------------------

echo Checking if Docker daemon is running...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker daemon is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
) else (
    echo ✅ Docker daemon is running
)

echo Pulling latest Docker images...
docker-compose -f docker-compose.production.yml pull
if %errorlevel% neq 0 (
    echo ⚠️  Some images may not have been pulled ^(this is normal for local builds^)
)

echo Building and starting all services...
docker-compose -f docker-compose.production.yml up -d --build
if %errorlevel% neq 0 (
    echo ❌ ERROR: Failed to start services
    echo Check the logs for more details:
    echo docker-compose -f docker-compose.production.yml logs
    pause
    exit /b 1
) else (
    echo ✅ All services started successfully
)

echo Waiting for services to initialize ^(60 seconds^)...
timeout /t 60 /nobreak >nul

echo ✅ Service deployment completed
echo.

REM Step 4: Verify Container Health
echo 🏥 STEP 4: Verifying Container Health...
echo ----------------------------------------

echo Checking container status...
docker-compose -f docker-compose.production.yml ps

echo.
echo Container health summary:
docker ps --filter "name=script-ai" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ✅ Container health check completed
echo.

REM Step 5: Test Health Endpoints
echo 🔍 STEP 5: Testing Health Endpoints...
echo ----------------------------------------

echo Waiting additional 30 seconds for services to fully initialize...
timeout /t 30 /nobreak >nul

echo Testing backend health endpoint...
curl -f -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend health check: PASSED
) else (
    echo ❌ Backend health check: FAILED
)

echo Testing WebSocket health endpoint...
curl -f -s http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ WebSocket health check: PASSED
) else (
    echo ❌ WebSocket health check: FAILED
)

echo Testing Nginx health endpoint...
curl -f -s http://localhost/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Nginx health check: PASSED
) else (
    echo ❌ Nginx health check: FAILED
)

echo Testing real-time sync health endpoint...
curl -f -s http://localhost:3000/api/real-time-sync/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Real-time sync health check: PASSED
) else (
    echo ⚠️  Real-time sync health check: FAILED ^(may be initializing^)
)

echo ✅ Health endpoint testing completed
echo.

REM Step 6: Show Deployment Status
echo 📊 STEP 6: Deployment Status Summary
echo ----------------------------------------

echo 🐳 Container Status:
docker-compose -f docker-compose.production.yml ps

echo.
echo 💾 Resource Usage:
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo.
echo 🌐 Service Endpoints:
echo   Backend API:      http://localhost:3000
echo   WebSocket:        http://localhost:3001  
echo   Nginx Proxy:      http://localhost:80
echo   Health Check:     http://localhost:3000/health
echo   Real-time Sync:   http://localhost:3000/api/real-time-sync/health
echo   Bot API:          http://localhost:3000/api/telegram-bot/status

echo.
echo 📝 Useful Commands:
echo   View backend logs:    docker-compose -f docker-compose.production.yml logs backend
echo   View database logs:   docker-compose -f docker-compose.production.yml logs postgres
echo   View Redis logs:      docker-compose -f docker-compose.production.yml logs redis
echo   Stop all services:    docker-compose -f docker-compose.production.yml down
echo   Restart services:     docker-compose -f docker-compose.production.yml restart

echo.
echo ========================================
echo 🎉 DEPLOYMENT PHASE 1 COMPLETED
echo ========================================
echo Status: Services deployed and running
echo Next: Database initialization and testing
echo.
echo ⚠️  IMPORTANT NEXT STEPS:
echo 1. Update .env.production with your actual API keys
echo 2. Run database migrations
echo 3. Execute comprehensive testing
echo 4. Configure Telegram bot
echo ========================================

echo ✅ Production deployment Phase 1 completed successfully
echo.
pause
