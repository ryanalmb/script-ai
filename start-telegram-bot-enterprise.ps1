Write-Host "Starting Telegram Bot in Enterprise Mode..." -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

# Check if we're in the correct directory
if (-not (Test-Path "telegram-bot\package.json")) {
    Write-Host "Error: telegram-bot\package.json not found!" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to telegram-bot directory
Set-Location telegram-bot

Write-Host "Setting environment variables..." -ForegroundColor Yellow
$env:ENTERPRISE_MODE = "true"
$env:TELEGRAM_BOT_TOKEN = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
$env:NODE_ENV = "production"
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/x_marketing_platform"
$env:REDIS_URL = "redis://localhost:6379"
$env:BACKEND_URL = "http://localhost:3001"

Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "ENTERPRISE_MODE: $env:ENTERPRISE_MODE" -ForegroundColor White
Write-Host "NODE_ENV: $env:NODE_ENV" -ForegroundColor White
Write-Host "DATABASE_URL: $env:DATABASE_URL" -ForegroundColor White
Write-Host "REDIS_URL: $env:REDIS_URL" -ForegroundColor White
Write-Host "BACKEND_URL: $env:BACKEND_URL" -ForegroundColor White
Write-Host "TELEGRAM_BOT_TOKEN: 7848656841:AAF***[HIDDEN]" -ForegroundColor White

Write-Host ""
Write-Host "Starting Telegram bot..." -ForegroundColor Green
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "Running: npm run dev" -ForegroundColor Gray

try {
    npm run dev
} catch {
    Write-Host "Error starting Telegram bot: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Telegram bot stopped with exit code: $LASTEXITCODE" -ForegroundColor Yellow
Read-Host "Press Enter to exit"
