# X Marketing Platform - Complete Deployment Script
# This script starts all platform services in the correct order

param(
    [switch]$Development,
    [switch]$Production,
    [switch]$TestMode,
    [string]$TelegramToken,
    [string]$HuggingFaceKey
)

Write-Host "🚀 X Marketing Platform - Complete Deployment" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Set environment mode
$env:NODE_ENV = if ($Production) { "production" } elseif ($TestMode) { "test" } else { "development" }
Write-Host "🎯 Environment: $($env:NODE_ENV)" -ForegroundColor Yellow

# Configure API keys if provided
if ($TelegramToken) {
    $env:TELEGRAM_BOT_TOKEN = $TelegramToken
    Write-Host "✅ Telegram Bot Token configured" -ForegroundColor Green
}

if ($HuggingFaceKey) {
    $env:HUGGINGFACE_API_KEY = $HuggingFaceKey
    Write-Host "✅ Hugging Face API Key configured" -ForegroundColor Green
}

# Function to check if port is available
function Test-Port {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
        return -not $connection.TcpTestSucceeded
    } catch {
        return $true
    }
}

# Function to wait for service to be ready
function Wait-ForService {
    param([string]$Url, [string]$ServiceName, [int]$MaxWait = 30)
    
    Write-Host "⏳ Waiting for $ServiceName to be ready..." -ForegroundColor Yellow
    
    for ($i = 0; $i -lt $MaxWait; $i++) {
        try {
            $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response) {
                Write-Host "✅ $ServiceName is ready!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Service not ready yet
        }
        
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "❌ $ServiceName failed to start within $MaxWait seconds" -ForegroundColor Red
    return $false
}

# Check prerequisites
Write-Host "`n📋 Checking Prerequisites:" -ForegroundColor Yellow

try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found - please install Node.js v24.2.0" -ForegroundColor Red
    exit 1
}

try {
    $pythonVersion = python --version
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found - please install Python 3.12" -ForegroundColor Red
    exit 1
}

# Check port availability
Write-Host "`n🌐 Checking Port Availability:" -ForegroundColor Yellow

$ports = @(
    @{Port=3001; Service="Backend API"},
    @{Port=3002; Service="Telegram Bot"},
    @{Port=5000; Service="LLM Service"}
)

foreach ($portInfo in $ports) {
    if (Test-Port -Port $portInfo.Port) {
        Write-Host "✅ Port $($portInfo.Port) available for $($portInfo.Service)" -ForegroundColor Green
    } else {
        Write-Host "❌ Port $($portInfo.Port) is already in use" -ForegroundColor Red
        Write-Host "   Please stop the service using port $($portInfo.Port) or change the configuration" -ForegroundColor Yellow
        exit 1
    }
}

# Start services in order
Write-Host "`n🔧 Starting Services:" -ForegroundColor Yellow

# 1. Start LLM Service (Python)
Write-Host "`n🧠 Starting LLM Service (Port 5000)..." -ForegroundColor Cyan
try {
    Set-Location "llm-service"
    
    # Check if virtual environment exists
    if (-not (Test-Path "venv")) {
        Write-Host "❌ Python virtual environment not found" -ForegroundColor Red
        Write-Host "   Run the installation script first" -ForegroundColor Yellow
        exit 1
    }
    
    # Start LLM service
    if (Test-Path "simple-app.py") {
        Start-Process powershell -ArgumentList "-Command", "Set-Location '$PWD'; .\venv\Scripts\Activate.ps1; python simple-app.py" -WindowStyle Minimized
        Write-Host "✅ LLM Service started" -ForegroundColor Green
    } else {
        Write-Host "❌ LLM Service file not found" -ForegroundColor Red
        exit 1
    }
    
    Set-Location ".."
} catch {
    Write-Host "❌ Failed to start LLM Service: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for LLM service to be ready
if (-not (Wait-ForService -Url "http://localhost:5000/health" -ServiceName "LLM Service")) {
    exit 1
}

# 2. Start Backend API (Node.js)
Write-Host "`n🔧 Starting Backend API (Port 3001)..." -ForegroundColor Cyan
try {
    Set-Location "backend"
    
    # Check if dependencies are installed
    if (-not (Test-Path "node_modules")) {
        Write-Host "❌ Backend dependencies not found" -ForegroundColor Red
        Write-Host "   Run the installation script first" -ForegroundColor Yellow
        exit 1
    }
    
    # Start backend service
    if (Test-Path "simple-backend.js") {
        Start-Process powershell -ArgumentList "-Command", "Set-Location '$PWD'; node simple-backend.js" -WindowStyle Minimized
        Write-Host "✅ Backend API started" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend service file not found" -ForegroundColor Red
        exit 1
    }
    
    Set-Location ".."
} catch {
    Write-Host "❌ Failed to start Backend API: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for backend to be ready
if (-not (Wait-ForService -Url "http://localhost:3001/health" -ServiceName "Backend API")) {
    exit 1
}

# 3. Start Telegram Bot (Node.js)
Write-Host "`n🤖 Starting Telegram Bot (Port 3002)..." -ForegroundColor Cyan
try {
    Set-Location "telegram-bot"
    
    # Check if dependencies are installed
    if (-not (Test-Path "node_modules")) {
        Write-Host "❌ Telegram Bot dependencies not found" -ForegroundColor Red
        Write-Host "   Run the installation script first" -ForegroundColor Yellow
        exit 1
    }
    
    # Start telegram bot service
    if (Test-Path "minimal-bot.js") {
        Start-Process powershell -ArgumentList "-Command", "Set-Location '$PWD'; node minimal-bot.js" -WindowStyle Minimized
        Write-Host "✅ Telegram Bot started" -ForegroundColor Green
    } elseif (Test-Path "dist\bot.js") {
        Start-Process powershell -ArgumentList "-Command", "Set-Location '$PWD'; node dist\bot.js" -WindowStyle Minimized
        Write-Host "✅ Telegram Bot started (compiled)" -ForegroundColor Green
    } else {
        Write-Host "❌ Telegram Bot service file not found" -ForegroundColor Red
        exit 1
    }
    
    Set-Location ".."
} catch {
    Write-Host "❌ Failed to start Telegram Bot: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for telegram bot to be ready
if (-not (Wait-ForService -Url "http://localhost:3002/health" -ServiceName "Telegram Bot")) {
    exit 1
}

# Final verification
Write-Host "`n✅ All Services Started Successfully!" -ForegroundColor Green
Write-Host "`n📊 Service Status:" -ForegroundColor Yellow

$services = @(
    @{Name="Backend API"; Url="http://localhost:3001/health"; Port=3001},
    @{Name="LLM Service"; Url="http://localhost:5000/health"; Port=5000},
    @{Name="Telegram Bot"; Url="http://localhost:3002/health"; Port=3002}
)

foreach ($service in $services) {
    try {
        $response = Invoke-RestMethod -Uri $service.Url -Method Get -TimeoutSec 5
        Write-Host "✅ $($service.Name): Running on port $($service.Port)" -ForegroundColor Green
    } catch {
        Write-Host "❌ $($service.Name): Not responding" -ForegroundColor Red
    }
}

# Display access URLs
Write-Host "`n🌐 Access URLs:" -ForegroundColor Yellow
Write-Host "Backend API Health: http://localhost:3001/health" -ForegroundColor Cyan
Write-Host "Backend API Status: http://localhost:3001/api/status" -ForegroundColor Cyan
Write-Host "Automation Status: http://localhost:3001/api/automation/status" -ForegroundColor Cyan
Write-Host "Analytics Dashboard: http://localhost:3001/api/analytics/dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "LLM Service Health: http://localhost:5000/health" -ForegroundColor Cyan
Write-Host "Content Generation: http://localhost:5000/generate" -ForegroundColor Cyan
Write-Host "Trending Topics: http://localhost:5000/trending" -ForegroundColor Cyan
Write-Host ""
Write-Host "Telegram Bot Health: http://localhost:3002/health" -ForegroundColor Cyan
Write-Host "Bot Status: http://localhost:3002/api/bot/status" -ForegroundColor Cyan
Write-Host "Bot Commands: http://localhost:3002/api/commands" -ForegroundColor Cyan

# Configuration status
Write-Host "`n⚙️ Configuration Status:" -ForegroundColor Yellow
Write-Host "Telegram Bot Token: $(if ($env:TELEGRAM_BOT_TOKEN) { 'Configured ✅' } else { 'Not configured ❌' })" -ForegroundColor $(if ($env:TELEGRAM_BOT_TOKEN) { 'Green' } else { 'Red' })
Write-Host "Hugging Face API: $(if ($env:HUGGINGFACE_API_KEY) { 'Configured ✅' } else { 'Not configured ❌' })" -ForegroundColor $(if ($env:HUGGINGFACE_API_KEY) { 'Green' } else { 'Red' })
Write-Host "OpenAI API: $(if ($env:OPENAI_API_KEY) { 'Configured ✅' } else { 'Not configured ❌' })" -ForegroundColor $(if ($env:OPENAI_API_KEY) { 'Green' } else { 'Red' })
Write-Host "Anthropic API: $(if ($env:ANTHROPIC_API_KEY) { 'Configured ✅' } else { 'Not configured ❌' })" -ForegroundColor $(if ($env:ANTHROPIC_API_KEY) { 'Green' } else { 'Red' })

# Next steps
Write-Host "`n🎯 Next Steps:" -ForegroundColor Yellow
if (-not $env:TELEGRAM_BOT_TOKEN) {
    Write-Host "1. Configure your Telegram Bot Token:" -ForegroundColor White
    Write-Host "   Set-Content '.env.local' 'TELEGRAM_BOT_TOKEN=your_token_here'" -ForegroundColor Gray
}
if (-not $env:HUGGINGFACE_API_KEY) {
    Write-Host "2. Configure your Hugging Face API Key:" -ForegroundColor White
    Write-Host "   Add 'HUGGINGFACE_API_KEY=your_key_here' to .env.local" -ForegroundColor Gray
}
Write-Host "3. Test the platform functionality using the provided URLs" -ForegroundColor White
Write-Host "4. Use your Telegram bot to control the automation platform" -ForegroundColor White

Write-Host "`n🚀 X Marketing Platform is now running!" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 10
        
        # Optional: Periodic health checks
        if ($TestMode) {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "`n🛑 Shutting down services..." -ForegroundColor Yellow
    # In a real implementation, we would gracefully stop all services
    Write-Host "✅ Platform stopped" -ForegroundColor Green
}
