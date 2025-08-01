@echo off
echo Starting PostgreSQL and Redis containers...
echo ============================================

echo Checking Docker status...
docker --version
if %ERRORLEVEL% neq 0 (
    echo Error: Docker is not running or not installed!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo.
echo Creating log directories...
if not exist "logs" mkdir logs
if not exist "logs\postgres" mkdir logs\postgres
if not exist "logs\redis" mkdir logs\redis

echo.
echo Starting containers with Docker Compose...
docker-compose -f docker-compose.batch-compatible.yml up -d postgres redis

if %ERRORLEVEL% neq 0 (
    echo Error: Failed to start containers!
    echo Please check Docker Desktop is running and try again.
    pause
    exit /b 1
)

echo.
echo Waiting for containers to be ready...
timeout /t 10 /nobreak

echo.
echo Checking container status...
docker ps

echo.
echo Testing PostgreSQL connection...
docker exec postgres-batch-compatible pg_isready -U postgres -d x_marketing_platform

echo.
echo Testing Redis connection...
docker exec redis-batch-compatible redis-cli ping

echo.
echo Containers are ready!
echo PostgreSQL: localhost:5432 (user: postgres, password: password, database: x_marketing_platform)
echo Redis: localhost:6379
echo pgAdmin: http://localhost:8080 (admin@batch.local / admin)
echo Redis Commander: http://localhost:8081 (admin / admin)

echo.
echo You can now run the backend and Telegram bot batch files.
pause
