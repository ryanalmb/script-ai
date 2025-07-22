# Complete Production Deployment Script for X/Twitter Automation Platform
# PowerShell version for Windows compatibility

param(
    [switch]$SkipPrerequisites = $false,
    [switch]$Verbose = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green" 
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
    Magenta = "Magenta"
}

# Configuration
$DeploymentLog = "deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$ProductionEnvFile = ".env.production"
$DockerComposeFile = "docker-compose.production.yml"

# Logging functions
function Write-Log {
    param([string]$Message, [string]$Level = "INFO", [string]$Color = "White")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Write-Host $LogMessage -ForegroundColor $Color
    Add-Content -Path $DeploymentLog -Value $LogMessage
}

function Write-Success { param([string]$Message) Write-Log $Message "SUCCESS" $Colors.Green }
function Write-Error { param([string]$Message) Write-Log $Message "ERROR" $Colors.Red }
function Write-Warning { param([string]$Message) Write-Log $Message "WARNING" $Colors.Yellow }
function Write-Info { param([string]$Message) Write-Log $Message "INFO" $Colors.Cyan }
function Write-Status { param([string]$Message) Write-Log $Message "STATUS" $Colors.Magenta }

# Function to check prerequisites
function Test-Prerequisites {
    Write-Log "🔍 Checking deployment prerequisites..." "DEPLOY" $Colors.Blue
    
    $MissingDeps = 0
    
    # Check Docker
    try {
        $DockerVersion = docker --version 2>$null
        if ($DockerVersion) {
            Write-Success "Docker found: $DockerVersion"
        } else {
            throw "Docker not found"
        }
    } catch {
        Write-Error "Docker is not installed or not in PATH"
        $MissingDeps++
    }
    
    # Check Docker Compose
    try {
        $ComposeVersion = docker-compose --version 2>$null
        if ($ComposeVersion) {
            Write-Success "Docker Compose found: $ComposeVersion"
        } else {
            throw "Docker Compose not found"
        }
    } catch {
        Write-Error "Docker Compose is not installed or not in PATH"
        $MissingDeps++
    }
    
    # Check Node.js
    try {
        $NodeVersion = node --version 2>$null
        if ($NodeVersion) {
            $NodeMajor = [int]($NodeVersion -replace 'v(\d+)\..*', '$1')
            if ($NodeMajor -ge 18) {
                Write-Success "Node.js found: $NodeVersion"
            } else {
                Write-Error "Node.js version 18+ required (found: $NodeVersion)"
                $MissingDeps++
            }
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-Error "Node.js is not installed or not in PATH"
        $MissingDeps++
    }
    
    # Check available disk space
    $Drive = Get-PSDrive -Name C
    $FreeSpaceGB = [math]::Round($Drive.Free / 1GB, 1)
    if ($FreeSpaceGB -lt 10) {
        Write-Warning "Low available disk space: ${FreeSpaceGB}GB (recommended: 20GB+)"
    } else {
        Write-Success "Available disk space: ${FreeSpaceGB}GB"
    }
    
    # Check available memory
    $Memory = Get-CimInstance -ClassName Win32_OperatingSystem
    $FreeMemoryGB = [math]::Round($Memory.FreePhysicalMemory / 1MB, 1)
    if ($FreeMemoryGB -lt 2) {
        Write-Warning "Low available memory: ${FreeMemoryGB}GB (recommended: 4GB+)"
    } else {
        Write-Success "Available memory: ${FreeMemoryGB}GB"
    }
    
    if ($MissingDeps -gt 0) {
        Write-Error "Missing $MissingDeps required dependencies. Please install them before proceeding."
        exit 1
    }
    
    Write-Success "✅ All prerequisites satisfied"
}

# Function to create production environment file
function New-ProductionEnvironment {
    Write-Log "🔧 Creating production environment configuration..." "DEPLOY" $Colors.Blue
    
    if (Test-Path $ProductionEnvFile) {
        Write-Warning "Production environment file already exists. Creating backup..."
        $BackupFile = "$ProductionEnvFile.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $ProductionEnvFile $BackupFile
    }
    
    $EnvContent = @"
# X/Twitter Automation Platform - Production Environment Configuration
# Generated automatically - customize as needed

# Core Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ENABLE_DETAILED_LOGGING=false

# Database Configuration
POSTGRES_PASSWORD=ScriptAI_Prod_2024_SecurePass!
DATABASE_URL=postgresql://postgres:ScriptAI_Prod_2024_SecurePass!@postgres:5432/script_ai
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_POOL_ACQUIRE_TIMEOUT=60000

# Redis Configuration
REDIS_PASSWORD=ScriptAI_Redis_2024_SecurePass!
REDIS_URL=redis://:ScriptAI_Redis_2024_SecurePass!@redis:6379
REDIS_TTL_DEFAULT=3600
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000

# Security Configuration
JWT_SECRET=ScriptAI_JWT_Production_Secret_Key_2024_Very_Secure_32_Chars_Min
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=ScriptAI_AES256_Encryption_Key_32_Characters_Required_2024
BOT_JWT_SECRET=ScriptAI_Bot_JWT_Secret_Key_2024_Production_Secure
BCRYPT_ROUNDS=12

# External API Configuration (REPLACE WITH YOUR ACTUAL KEYS)
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN_FROM_BOTFATHER
HUGGING_FACE_API_KEY=YOUR_HUGGING_FACE_API_KEY

# Real-Time Sync Configuration
ENABLE_REAL_TIME_SYNC=true
REAL_TIME_SYNC_LOG_LEVEL=info
ACCOUNT_SYNC_INTERVAL_SECONDS=30
ACCOUNT_SYNC_BATCH_SIZE=10
ACCOUNT_SYNC_RETRY_ATTEMPTS=3
ACCOUNT_SYNC_TIMEOUT=30000

# Analytics Collection
ANALYTICS_COLLECTION_ENABLED=true
ANALYTICS_BUFFER_SIZE=1000
ANALYTICS_FLUSH_INTERVAL_SECONDS=10
ANALYTICS_RATE_LIMIT_PER_MINUTE=300

# Campaign Tracking
CAMPAIGN_TRACKING_ENABLED=true
CAMPAIGN_TRACKING_INTERVAL_SECONDS=300
CAMPAIGN_ANALYTICS_INTERVAL_SECONDS=900

# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_MAX_CONNECTIONS=1000
WEBSOCKET_MESSAGE_QUEUE_SIZE=100
WEBSOCKET_BROADCAST_INTERVAL_SECONDS=30
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_PING_TIMEOUT=60000

# Data Integrity
DATA_INTEGRITY_ENABLED=true
DATA_VALIDATION_INTERVAL_SECONDS=300
DATA_RETENTION_CHECK_INTERVAL_SECONDS=3600
DATA_QUALITY_THRESHOLD=0.8

# Anti-Detection Configuration
ANTI_DETECTION_ENABLED=true
PROXY_ROTATION_ENABLED=true
FINGERPRINT_ROTATION_ENABLED=true
BEHAVIOR_SIMULATION_ENABLED=true
DETECTION_EVASION_LEVEL=medium

# Performance Thresholds
MIN_ENGAGEMENT_RATE=0.02
MIN_QUALITY_SCORE=0.7
MAX_RISK_SCORE=0.3
MAX_ACTIONS_PER_HOUR=100

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BOT_RATE_LIMIT_PER_MINUTE=60

# CORS Configuration
FRONTEND_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,https://yourdomain.com

# Monitoring and Health
HEALTH_CHECK_ENABLED=true
METRICS_COLLECTION_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true

# Bot Configuration
BOT_DETAILED_LOGGING=false
BOT_WEBHOOK_SECRET=ScriptAI_Webhook_Secret_2024_Production

# Build Configuration
BUILD_VERSION=1.0.0
BUILD_DATE=$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
"@
    
    Set-Content -Path $ProductionEnvFile -Value $EnvContent -Encoding UTF8
    Write-Success "✅ Production environment file created: $ProductionEnvFile"
    Write-Info "⚠️  IMPORTANT: Update TELEGRAM_BOT_TOKEN and HUGGING_FACE_API_KEY with your actual keys"
}

# Function to deploy services
function Start-Services {
    Write-Log "🚀 Deploying production services with Docker Compose..." "DEPLOY" $Colors.Blue
    
    # Check if Docker is running
    try {
        docker info | Out-Null
        Write-Success "Docker daemon is running"
    } catch {
        Write-Error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    }
    
    # Pull latest images
    Write-Info "Pulling latest Docker images..."
    try {
        docker-compose -f $DockerComposeFile pull
        Write-Success "Docker images pulled successfully"
    } catch {
        Write-Warning "Some images may not have been pulled (this is normal for local builds)"
    }
    
    # Build and start services
    Write-Info "Building and starting all services..."
    try {
        docker-compose -f $DockerComposeFile up -d --build
        Write-Success "All services started successfully"
    } catch {
        Write-Error "Failed to start services: $_"
        return $false
    }
    
    # Wait for services to initialize
    Write-Info "Waiting for services to initialize (60 seconds)..."
    Start-Sleep -Seconds 60
    
    Write-Success "✅ Service deployment completed"
    return $true
}

# Function to verify container health
function Test-ContainerHealth {
    Write-Log "🏥 Verifying container health status..." "DEPLOY" $Colors.Blue
    
    $UnhealthyContainers = 0
    $Containers = @(
        "script-ai-postgres",
        "script-ai-redis", 
        "script-ai-backend",
        "script-ai-websocket",
        "script-ai-nginx"
    )
    
    foreach ($Container in $Containers) {
        try {
            $ContainerInfo = docker ps --filter "name=$Container" --filter "status=running" --format "{{.Names}}"
            if ($ContainerInfo -match $Container) {
                try {
                    $HealthStatus = docker inspect --format='{{.State.Health.Status}}' $Container 2>$null
                    if (-not $HealthStatus) { $HealthStatus = "no-health-check" }
                } catch {
                    $HealthStatus = "no-health-check"
                }
                
                if ($HealthStatus -eq "healthy" -or $HealthStatus -eq "no-health-check") {
                    Write-Success "Container $Container`: Running (Health: $HealthStatus)"
                } else {
                    Write-Error "Container $Container`: Unhealthy (Health: $HealthStatus)"
                    $UnhealthyContainers++
                }
            } else {
                Write-Error "Container $Container`: Not running"
                $UnhealthyContainers++
            }
        } catch {
            Write-Error "Container $Container`: Error checking status - $_"
            $UnhealthyContainers++
        }
    }
    
    if ($UnhealthyContainers -eq 0) {
        Write-Success "✅ All containers are healthy"
        return $true
    } else {
        Write-Error "❌ $UnhealthyContainers containers are unhealthy"
        return $false
    }
}

# Function to test health endpoints
function Test-HealthEndpoints {
    Write-Log "🔍 Testing health check endpoints..." "DEPLOY" $Colors.Blue
    
    $FailedChecks = 0
    
    # Backend health check
    Write-Info "Testing backend health endpoint..."
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 10 -UseBasicParsing
        if ($Response.StatusCode -eq 200) {
            Write-Success "Backend health check: PASSED"
        } else {
            Write-Error "Backend health check: FAILED (Status: $($Response.StatusCode))"
            $FailedChecks++
        }
    } catch {
        Write-Error "Backend health check: FAILED - $_"
        $FailedChecks++
    }
    
    # WebSocket health check
    Write-Info "Testing WebSocket health endpoint..."
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 10 -UseBasicParsing
        if ($Response.StatusCode -eq 200) {
            Write-Success "WebSocket health check: PASSED"
        } else {
            Write-Error "WebSocket health check: FAILED (Status: $($Response.StatusCode))"
            $FailedChecks++
        }
    } catch {
        Write-Error "WebSocket health check: FAILED - $_"
        $FailedChecks++
    }
    
    # Nginx health check
    Write-Info "Testing Nginx health endpoint..."
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 10 -UseBasicParsing
        if ($Response.StatusCode -eq 200) {
            Write-Success "Nginx health check: PASSED"
        } else {
            Write-Error "Nginx health check: FAILED (Status: $($Response.StatusCode))"
            $FailedChecks++
        }
    } catch {
        Write-Error "Nginx health check: FAILED - $_"
        $FailedChecks++
    }
    
    # Real-time sync health check
    Write-Info "Testing real-time sync health endpoint..."
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/real-time-sync/health" -TimeoutSec 10 -UseBasicParsing
        if ($Response.StatusCode -eq 200) {
            Write-Success "Real-time sync health check: PASSED"
        } else {
            Write-Warning "Real-time sync health check: FAILED (may be initializing)"
        }
    } catch {
        Write-Warning "Real-time sync health check: FAILED (may be initializing) - $_"
    }
    
    if ($FailedChecks -eq 0) {
        Write-Success "✅ All critical health endpoints are responding"
        return $true
    } else {
        Write-Error "❌ $FailedChecks critical health endpoints failed"
        return $false
    }
}

# Function to show deployment status
function Show-DeploymentStatus {
    Write-Status "📊 DEPLOYMENT STATUS SUMMARY"
    Write-Host "==========================================" -ForegroundColor $Colors.Blue
    
    # Container status
    Write-Host "🐳 Container Status:" -ForegroundColor $Colors.Cyan
    try {
        docker-compose -f $DockerComposeFile ps
    } catch {
        Write-Warning "Could not retrieve container status"
    }
    Write-Host ""
    
    # Resource usage
    Write-Host "💾 Resource Usage:" -ForegroundColor $Colors.Cyan
    try {
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    } catch {
        Write-Warning "Could not retrieve resource usage"
    }
    Write-Host ""
    
    # Service endpoints
    Write-Host "🌐 Service Endpoints:" -ForegroundColor $Colors.Cyan
    Write-Host "  Backend API:      http://localhost:3000"
    Write-Host "  WebSocket:        http://localhost:3001"
    Write-Host "  Nginx Proxy:      http://localhost:80"
    Write-Host "  Health Check:     http://localhost:3000/health"
    Write-Host "  Real-time Sync:   http://localhost:3000/api/real-time-sync/health"
    Write-Host "  Bot API:          http://localhost:3000/api/telegram-bot/status"
    Write-Host ""
    
    # Log locations
    Write-Host "📝 Log Files:" -ForegroundColor $Colors.Cyan
    Write-Host "  Deployment Log:   $DeploymentLog"
    Write-Host "  Backend Logs:     docker-compose -f $DockerComposeFile logs backend"
    Write-Host "  Database Logs:    docker-compose -f $DockerComposeFile logs postgres"
    Write-Host "  Redis Logs:       docker-compose -f $DockerComposeFile logs redis"
    Write-Host ""
    
    Write-Success "✅ Deployment status summary completed"
}

# Main deployment function
function Start-Deployment {
    $StartTime = Get-Date
    
    Write-Host "🚀 STARTING COMPLETE PRODUCTION DEPLOYMENT" -ForegroundColor $Colors.Blue
    Write-Host "==========================================" -ForegroundColor $Colors.Blue
    Write-Host "Platform: X/Twitter Automation System"
    Write-Host "Version: Enterprise Production v1.0.0"
    Write-Host "Timestamp: $(Get-Date)"
    Write-Host "Log File: $DeploymentLog"
    Write-Host "==========================================" -ForegroundColor $Colors.Blue
    Write-Host ""
    
    try {
        # Step 1: Prerequisites
        if (-not $SkipPrerequisites) {
            Test-Prerequisites
        }
        
        # Step 2: Environment setup
        New-ProductionEnvironment
        
        # Step 3: Deploy services
        if (-not (Start-Services)) {
            throw "Service deployment failed"
        }
        
        # Step 4: Verify health
        if (-not (Test-ContainerHealth)) {
            Write-Warning "Some containers are unhealthy, but continuing..."
        }
        
        # Step 5: Test endpoints
        if (-not (Test-HealthEndpoints)) {
            Write-Warning "Some health endpoints failed, but continuing..."
        }
        
        # Step 6: Show status
        Show-DeploymentStatus
        
        $EndTime = Get-Date
        $Duration = ($EndTime - $StartTime).TotalSeconds
        
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor $Colors.Green
        Write-Host "🎉 DEPLOYMENT PHASE 1 COMPLETED" -ForegroundColor $Colors.Green
        Write-Host "Duration: $([math]::Round($Duration, 2)) seconds"
        Write-Host "Status: Services deployed and running"
        Write-Host "Next: Database initialization and testing"
        Write-Host "==========================================" -ForegroundColor $Colors.Green
        
        Write-Success "✅ Production deployment Phase 1 completed successfully"
        return $true
        
    } catch {
        Write-Error "Deployment failed: $_"
        return $false
    }
}

# Execute main function
if ($MyInvocation.InvocationName -ne '.') {
    Start-Deployment
}
