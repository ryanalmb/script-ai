@echo off
echo Starting Telegram Bot in Enterprise Mode...
echo ==========================================

cd telegram-bot

set ENTERPRISE_MODE=true
set TELEGRAM_BOT_TOKEN=7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0
set NODE_ENV=production
set DATABASE_URL=postgresql://postgres:password@localhost:5432/x_marketing_platform
set REDIS_URL=redis://localhost:6379
set BACKEND_URL=http://localhost:3001

echo Environment variables set:
echo ENTERPRISE_MODE=%ENTERPRISE_MODE%
echo NODE_ENV=%NODE_ENV%
echo DATABASE_URL=%DATABASE_URL%
echo REDIS_URL=%REDIS_URL%
echo BACKEND_URL=%BACKEND_URL%
echo TELEGRAM_BOT_TOKEN=7848656841:AAF***[HIDDEN]

echo.
echo Starting Telegram bot...
npm run dev

pause
