@echo off
echo Starting Backend in Enterprise Mode...
echo =====================================

echo Checking if we're in the correct directory...
if not exist "backend\dist\index.js" (
    echo Error: backend\dist\index.js not found!
    echo Current directory: %CD%
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

cd backend

echo Setting environment variables...
set ENTERPRISE_MODE=true
set TELEGRAM_BOT_TOKEN=7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0
set NODE_ENV=production
set DATABASE_URL=postgresql://postgres:password@localhost:5432/x_marketing_platform
set REDIS_URL=redis://localhost:6379

echo Environment variables set:
echo ENTERPRISE_MODE=%ENTERPRISE_MODE%
echo NODE_ENV=%NODE_ENV%
echo DATABASE_URL=%DATABASE_URL%
echo REDIS_URL=%REDIS_URL%
echo TELEGRAM_BOT_TOKEN=7848656841:AAF***[HIDDEN]

echo.
echo Starting backend server...
echo Current directory: %CD%
echo Running: node dist/index.js
node dist/index.js

echo.
echo Backend server stopped with exit code: %ERRORLEVEL%
pause
