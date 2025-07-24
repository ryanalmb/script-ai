# PowerShell Script for Twikit Docker Database Setup
# Comprehensive setup with Docker Desktop management and strict error checking

param(
    [switch]$Reset,
    [switch]$SkipSeed,
    [switch]$Verbose
)

# Set strict error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
}

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
    throw $Message
}

function Test-DockerDesktop {
    Write-Log "Checking Docker Desktop status..." "Blue"
    
    try {
        # Check if Docker Desktop process is running
        $dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
        if (-not $dockerProcess) {
            Write-Warning "Docker Desktop is not running"
            return $false
        }
        
        # Test Docker daemon connectivity
        $dockerInfo = docker info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Docker daemon is not responding"
            return $false
        }
        
        Write-Success "Docker Desktop is running and responsive"
        return $true
    }
    catch {
        Write-Warning "Error checking Docker Desktop: $($_.Exception.Message)"
        return $false
    }
}

function Start-DockerDesktop {
    Write-Log "Starting Docker Desktop..." "Blue"
    
    # Find Docker Desktop executable
    $dockerPaths = @(
        "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "${env:LOCALAPPDATA}\Programs\Docker\Docker\Docker Desktop.exe"
    )
    
    $dockerExe = $null
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            $dockerExe = $path
            break
        }
    }
    
    if (-not $dockerExe) {
        Write-Error "Docker Desktop executable not found. Please install Docker Desktop."
    }
    
    # Start Docker Desktop
    Write-Log "Starting Docker Desktop from: $dockerExe" "Cyan"
    Start-Process -FilePath $dockerExe -WindowStyle Hidden
    
    # Wait for Docker Desktop to start
    Write-Log "Waiting for Docker Desktop to start..." "Yellow"
    $maxAttempts = 60
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        Start-Sleep -Seconds 5
        
        if (Test-DockerDesktop) {
            Write-Success "Docker Desktop started successfully"
            return $true
        }
        
        Write-Log "Waiting for Docker Desktop... ($attempt/$maxAttempts)" "Yellow"
        $attempt++
    }
    
    Write-Error "Docker Desktop failed to start within timeout"
}

function Test-DockerCompose {
    Write-Log "Validating docker-compose configuration..." "Blue"
    
    if (-not (Test-Path "docker-compose.yml")) {
        Write-Error "docker-compose.yml not found in current directory"
    }
    
    try {
        $composeConfig = docker-compose config 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Invalid docker-compose.yml configuration: $composeConfig"
        }
        
        Write-Success "Docker Compose configuration is valid"
        return $true
    }
    catch {
        Write-Error "Error validating docker-compose configuration: $($_.Exception.Message)"
    }
}

function Stop-ExistingContainers {
    Write-Log "Stopping existing containers..." "Blue"
    
    try {
        docker-compose down --volumes --remove-orphans 2>$null
        docker volume prune -f 2>$null
        Write-Success "Existing containers stopped and cleaned up"
    }
    catch {
        Write-Warning "Error during cleanup: $($_.Exception.Message)"
    }
}

function Start-DatabaseServices {
    Write-Log "Starting PostgreSQL and Redis services..." "Blue"
    
    try {
        # Start database services
        docker-compose up -d postgres redis pgadmin redis-commander
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start database services"
        }
        
        # Wait for services to be healthy
        Write-Log "Waiting for services to be healthy..." "Yellow"
        $maxAttempts = 60
        $attempt = 1
        
        while ($attempt -le $maxAttempts) {
            Start-Sleep -Seconds 5
            
            $postgresStatus = docker-compose ps postgres | Select-String "healthy"
            $redisStatus = docker-compose ps redis | Select-String "healthy"
            
            if ($postgresStatus -and $redisStatus) {
                Write-Success "Database services are healthy"
                return $true
            }
            
            Write-Log "Waiting for services to be healthy... ($attempt/$maxAttempts)" "Yellow"
            $attempt++
        }
        
        Write-Error "Database services failed to become healthy within timeout"
    }
    catch {
        Write-Error "Error starting database services: $($_.Exception.Message)"
    }
}

function Test-DatabaseConnectivity {
    Write-Log "Testing database connectivity..." "Blue"
    
    try {
        # Test PostgreSQL
        $pgTest = docker exec postgres-xmarketing pg_isready -U postgres -d x_marketing_platform 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "PostgreSQL connection test failed"
        }
        Write-Success "PostgreSQL connection verified"
        
        # Test Redis
        $redisTest = docker exec redis-xmarketing redis-cli ping 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Redis connection test failed"
        }
        Write-Success "Redis connection verified"
        
        return $true
    }
    catch {
        Write-Error "Database connectivity test failed: $($_.Exception.Message)"
    }
}

function Invoke-DatabaseMigrations {
    Write-Log "Running database migrations..." "Blue"
    
    try {
        # Build migrator service
        docker-compose --profile migration build db-migrator
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build migration service"
        }
        
        # Run migrations
        $env:RESET_DB = if ($Reset) { "true" } else { "false" }
        $env:SKIP_SEED = if ($SkipSeed) { "true" } else { "false" }
        $env:RUN_TESTS = "true"
        
        docker-compose --profile migration run --rm db-migrator
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Database migration failed"
        }
        
        Write-Success "Database migrations completed successfully"
        return $true
    }
    catch {
        Write-Error "Migration process failed: $($_.Exception.Message)"
    }
}

function Test-SchemaValidation {
    Write-Log "Validating Twikit schema..." "Blue"
    
    try {
        # Test critical tables exist
        $criticalTables = @(
            "twikit_sessions",
            "twikit_accounts",
            "proxy_pools",
            "rate_limit_events",
            "interaction_logs",
            "content_queue",
            "system_health"
        )
        
        foreach ($table in $criticalTables) {
            $tableTest = docker exec postgres-xmarketing psql -U postgres -d x_marketing_platform -c "SELECT 1 FROM $table LIMIT 1;" 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Critical table $table is missing or inaccessible"
            }
            Write-Success "Table $table exists and is accessible"
        }
        
        # Test extensions
        $extensionTest = docker exec postgres-xmarketing psql -U postgres -d x_marketing_platform -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin');" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "PostgreSQL extensions test failed"
        }
        Write-Success "PostgreSQL extensions verified"
        
        return $true
    }
    catch {
        Write-Error "Schema validation failed: $($_.Exception.Message)"
    }
}

function Test-RedisIntegration {
    Write-Log "Testing Redis integration..." "Blue"
    
    try {
        # Test basic Redis operations
        $testKey = "twikit:test:$(Get-Date -Format 'yyyyMMddHHmmss')"
        docker exec redis-xmarketing redis-cli set $testKey "test_value" EX 60 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Redis SET operation failed"
        }
        
        docker exec redis-xmarketing redis-cli get $testKey 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Redis GET operation failed"
        }
        
        # Test Lua script capability
        docker exec redis-xmarketing redis-cli eval "return redis.call('ping')" 0 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Redis Lua script test failed"
        }
        
        Write-Success "Redis integration tests passed"
        return $true
    }
    catch {
        Write-Error "Redis integration test failed: $($_.Exception.Message)"
    }
}

function Show-ServiceInformation {
    Write-Log "Database services are ready!" "Green"
    
    Write-Host ""
    Write-Host "🐘 PostgreSQL Database:" -ForegroundColor Cyan
    Write-Host "   Host: localhost"
    Write-Host "   Port: 5432"
    Write-Host "   Database: x_marketing_platform"
    Write-Host "   Username: postgres"
    Write-Host "   Password: postgres_secure_2024"
    Write-Host "   Connection URL: postgresql://postgres:postgres_secure_2024@localhost:5432/x_marketing_platform"
    Write-Host ""
    
    Write-Host "🔴 Redis Cache:" -ForegroundColor Red
    Write-Host "   Host: localhost"
    Write-Host "   Port: 6379"
    Write-Host "   Connection URL: redis://localhost:6379"
    Write-Host ""
    
    Write-Host "🔧 Management Tools:" -ForegroundColor Yellow
    Write-Host "   pgAdmin: http://localhost:8080"
    Write-Host "     Email: admin@twikit.local"
    Write-Host "     Password: admin_secure_2024"
    Write-Host ""
    Write-Host "   Redis Commander: http://localhost:8081"
    Write-Host "     Username: admin"
    Write-Host "     Password: admin_secure_2024"
    Write-Host ""
    
    Write-Host "📊 Service Status:" -ForegroundColor Magenta
    docker-compose ps
    Write-Host ""
}

function New-EnvironmentFile {
    Write-Log "Creating environment configuration..." "Blue"
    
    $envContent = @"
# Docker Database Configuration for Twikit Integration
DATABASE_URL=postgresql://postgres:postgres_secure_2024@localhost:5432/x_marketing_platform
REDIS_URL=redis://localhost:6379

# Database Configuration
POSTGRES_DB=x_marketing_platform
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_secure_2024

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Security (change in production)
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Twikit Configuration
TWIKIT_DEBUG=true
TWIKIT_RATE_LIMIT_ENABLED=true
TWIKIT_ANALYTICS_ENABLED=true

# Generated on: $(Get-Date)
"@
    
    $envContent | Out-File -FilePath ".env.docker" -Encoding UTF8
    Write-Success "Environment file created: .env.docker"
}

# Main execution function
function Main {
    Write-Host ""
    Write-Host "🚀 Twikit Docker Database Setup and Testing" -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        # Ensure Docker Desktop is running
        if (-not (Test-DockerDesktop)) {
            Start-DockerDesktop
        }
        
        # Validate configuration
        Test-DockerCompose
        
        # Setup process
        Stop-ExistingContainers
        Start-DatabaseServices
        Test-DatabaseConnectivity
        Invoke-DatabaseMigrations
        
        # Validation process
        Test-SchemaValidation
        Test-RedisIntegration
        
        # Finalization
        New-EnvironmentFile
        Show-ServiceInformation
        
        Write-Host ""
        Write-Success "🎉 Twikit Docker database setup completed successfully!"
        Write-Host ""
        Write-Host "📋 Next Steps:" -ForegroundColor Yellow
        Write-Host "   1. Use the connection information above to connect your applications"
        Write-Host "   2. Access pgAdmin at http://localhost:8080 for database management"
        Write-Host "   3. Access Redis Commander at http://localhost:8081 for Redis monitoring"
        Write-Host "   4. Run 'docker-compose logs -f' to monitor service logs"
        Write-Host "   5. Run 'docker-compose down' to stop all services when done"
        Write-Host ""
        
        return $true
    }
    catch {
        Write-Error "Setup failed: $($_.Exception.Message)"
        return $false
    }
}

# Execute main function
if ($MyInvocation.InvocationName -ne '.') {
    $result = Main
    if (-not $result) {
        exit 1
    }
}
