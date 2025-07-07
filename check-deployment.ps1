# X Marketing Platform - Comprehensive Deployment Status Check
# This script checks the status of all platform components

Write-Host "🚀 X Marketing Platform - Deployment Status Check" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray

# Check Node.js and npm versions
Write-Host "`n📦 System Requirements:" -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
}

try {
    $npmVersion = npm --version
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found" -ForegroundColor Red
}

try {
    $pythonVersion = python --version
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found" -ForegroundColor Red
}

# Check Backend Status
Write-Host "`n🔧 Backend Service:" -ForegroundColor Yellow
$backendPath = "backend"
if (Test-Path $backendPath) {
    Write-Host "✅ Backend directory exists" -ForegroundColor Green
    
    if (Test-Path "$backendPath\package.json") {
        Write-Host "✅ Backend package.json exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend package.json missing" -ForegroundColor Red
    }
    
    if (Test-Path "$backendPath\node_modules") {
        $moduleCount = (Get-ChildItem "$backendPath\node_modules" -Directory).Count
        if ($moduleCount -gt 0) {
            Write-Host "✅ Backend dependencies installed ($moduleCount modules)" -ForegroundColor Green
        } else {
            Write-Host "❌ Backend dependencies not installed" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Backend node_modules missing" -ForegroundColor Red
    }
    
    if (Test-Path "$backendPath\dist") {
        Write-Host "✅ Backend compiled (dist folder exists)" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend not compiled" -ForegroundColor Red
    }
    
    if (Test-Path "$backendPath\.env.local") {
        Write-Host "✅ Backend environment file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend environment file missing" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Backend directory not found" -ForegroundColor Red
}

# Check Telegram Bot Status
Write-Host "`n🤖 Telegram Bot Service:" -ForegroundColor Yellow
$telegramPath = "telegram-bot"
if (Test-Path $telegramPath) {
    Write-Host "✅ Telegram bot directory exists" -ForegroundColor Green
    
    if (Test-Path "$telegramPath\package.json") {
        Write-Host "✅ Telegram bot package.json exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Telegram bot package.json missing" -ForegroundColor Red
    }
    
    if (Test-Path "$telegramPath\node_modules") {
        $moduleCount = (Get-ChildItem "$telegramPath\node_modules" -Directory).Count
        if ($moduleCount -gt 0) {
            Write-Host "✅ Telegram bot dependencies installed ($moduleCount modules)" -ForegroundColor Green
        } else {
            Write-Host "❌ Telegram bot dependencies not installed" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Telegram bot node_modules missing" -ForegroundColor Red
    }
    
    if (Test-Path "$telegramPath\dist") {
        Write-Host "✅ Telegram bot compiled (dist folder exists)" -ForegroundColor Green
    } else {
        Write-Host "❌ Telegram bot not compiled" -ForegroundColor Red
    }
    
    if (Test-Path "$telegramPath\.env.local") {
        Write-Host "✅ Telegram bot environment file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Telegram bot environment file missing" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Telegram bot directory not found" -ForegroundColor Red
}

# Check LLM Service Status
Write-Host "`n🧠 LLM Service:" -ForegroundColor Yellow
$llmPath = "llm-service"
if (Test-Path $llmPath) {
    Write-Host "✅ LLM service directory exists" -ForegroundColor Green
    
    if (Test-Path "$llmPath\requirements.txt") {
        Write-Host "✅ LLM service requirements.txt exists" -ForegroundColor Green
    } else {
        Write-Host "❌ LLM service requirements.txt missing" -ForegroundColor Red
    }
    
    if (Test-Path "$llmPath\venv") {
        Write-Host "✅ LLM service virtual environment exists" -ForegroundColor Green
    } else {
        Write-Host "❌ LLM service virtual environment missing" -ForegroundColor Red
    }
    
    if (Test-Path "$llmPath\app.py") {
        Write-Host "✅ LLM service main application exists" -ForegroundColor Green
    } else {
        Write-Host "❌ LLM service main application missing" -ForegroundColor Red
    }
    
    if (Test-Path "$llmPath\.env") {
        Write-Host "✅ LLM service environment file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ LLM service environment file missing" -ForegroundColor Red
    }
} else {
    Write-Host "❌ LLM service directory not found" -ForegroundColor Red
}

# Check Configuration Files
Write-Host "`n⚙️ Configuration:" -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "✅ Main environment file exists" -ForegroundColor Green
} else {
    Write-Host "❌ Main environment file missing" -ForegroundColor Red
}

# Check for running processes
Write-Host "`n🔄 Running Services:" -ForegroundColor Yellow
try {
    $processes = Get-Process | Where-Object { $_.ProcessName -like "*node*" -or $_.ProcessName -like "*python*" }
    if ($processes.Count -gt 0) {
        Write-Host "✅ Found $($processes.Count) Node.js/Python processes running" -ForegroundColor Green
        foreach ($proc in $processes) {
            Write-Host "  - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ No Node.js/Python processes found" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error checking running processes" -ForegroundColor Red
}

# Check network ports
Write-Host "`n🌐 Network Ports:" -ForegroundColor Yellow
$ports = @(3001, 3002, 5000)
foreach ($port in $ports) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "✅ Port $port is open" -ForegroundColor Green
        } else {
            Write-Host "❌ Port $port is closed" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Port $port check failed" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n📊 Deployment Summary:" -ForegroundColor Yellow
Write-Host "Backend API: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Telegram Bot: http://localhost:3002" -ForegroundColor Cyan
Write-Host "LLM Service: http://localhost:5000" -ForegroundColor Cyan
Write-Host "`nHealth Checks:" -ForegroundColor Yellow
Write-Host "Backend Health: http://localhost:3001/health" -ForegroundColor Cyan
Write-Host "Backend API Status: http://localhost:3001/api/status" -ForegroundColor Cyan
Write-Host "Telegram Bot Health: http://localhost:3002/health" -ForegroundColor Cyan

Write-Host "`n🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure your Telegram Bot Token in .env.local" -ForegroundColor White
Write-Host "2. Configure your Hugging Face API Key in .env.local" -ForegroundColor White
Write-Host "3. Start all services using the deployment script" -ForegroundColor White
Write-Host "4. Test the platform functionality" -ForegroundColor White

Write-Host "`n✅ Deployment check completed!" -ForegroundColor Green
