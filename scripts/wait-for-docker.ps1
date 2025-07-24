# Wait for Docker Desktop to be ready
param(
    [int]$TimeoutMinutes = 5
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

Write-Status "Waiting for Docker Desktop to be ready..." "Cyan"

$maxAttempts = $TimeoutMinutes * 12  # Check every 5 seconds
$attempt = 1

while ($attempt -le $maxAttempts) {
    try {
        # Test Docker daemon connectivity
        $null = docker info 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Docker Desktop is ready!" "Green"
            exit 0
        }
    }
    catch {
        # Continue waiting
    }
    
    Write-Status "Waiting for Docker Desktop... ($attempt/$maxAttempts)" "Yellow"
    Start-Sleep -Seconds 5
    $attempt++
}

Write-Status "Docker Desktop failed to start within $TimeoutMinutes minutes" "Red"
exit 1
