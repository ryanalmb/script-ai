Write-Host "Starting Backend in Enterprise Mode..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if we're in the correct directory
if (-not (Test-Path "backend\dist\index.js")) {
    Write-Host "Error: backend\dist\index.js not found!" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to backend directory
Set-Location backend

Write-Host "Setting environment variables..." -ForegroundColor Yellow
$env:ENTERPRISE_MODE = "true"
$env:TELEGRAM_BOT_TOKEN = "7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0"
$env:NODE_ENV = "production"
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/x_marketing_platform"
$env:REDIS_URL = "redis://localhost:6379"

Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "ENTERPRISE_MODE: $env:ENTERPRISE_MODE" -ForegroundColor White
Write-Host "NODE_ENV: $env:NODE_ENV" -ForegroundColor White
Write-Host "DATABASE_URL: $env:DATABASE_URL" -ForegroundColor White
Write-Host "REDIS_URL: $env:REDIS_URL" -ForegroundColor White
Write-Host "TELEGRAM_BOT_TOKEN: 7848656841:AAF***[HIDDEN]" -ForegroundColor White

Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Green
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "Running: node dist/index.js" -ForegroundColor Gray

try {
    node dist/index.js
} catch {
    Write-Host "Error starting backend: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Backend server stopped with exit code: $LASTEXITCODE" -ForegroundColor Yellow
Read-Host "Press Enter to exit"
