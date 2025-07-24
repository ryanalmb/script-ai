# Twikit Python Dependencies Installation Script (PowerShell)
# This script sets up Python virtual environment and installs Twikit with all dependencies

param(
    [switch]$Force,
    [string]$PythonVersion = "3.8"
)

# Configuration
$VenvDir = "python_env"
$RequirementsFile = "requirements-python.txt"

Write-Host "🐍 Twikit Python Dependencies Installation" -ForegroundColor Blue
Write-Host "==============================================" -ForegroundColor Blue

# Function to check if command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to get Python version
function Get-PythonVersion {
    try {
        $version = & python --version 2>$null
        if ($version -match "Python (\d+\.\d+)") {
            return $matches[1]
        }
        return "0.0"
    }
    catch {
        return "0.0"
    }
}

# Check if Python is available
Write-Host "📋 Checking Python installation..." -ForegroundColor Yellow
if (-not (Test-Command "python")) {
    Write-Host "❌ Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8 or higher from https://python.org" -ForegroundColor Red
    Write-Host "Make sure to check 'Add Python to PATH' during installation" -ForegroundColor Red
    exit 1
}

$currentVersion = Get-PythonVersion
Write-Host "✅ Python $currentVersion found" -ForegroundColor Green

# Check if version is sufficient
try {
    $versionCheck = & python -c 'import sys; exit(0 if sys.version_info >= (3, 8) else 1)' 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Python 3.8+ required, found $currentVersion" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Unable to verify Python version" -ForegroundColor Red
    exit 1
}

# Check if pip is available
if (-not (Test-Command "pip")) {
    Write-Host "❌ pip is not installed" -ForegroundColor Red
    Write-Host "Please install pip: python -m ensurepip --upgrade" -ForegroundColor Red
    exit 1
}

Write-Host "✅ pip found" -ForegroundColor Green

# Remove existing virtual environment if Force is specified
if ($Force -and (Test-Path $VenvDir)) {
    Write-Host "⚠️ Removing existing virtual environment..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $VenvDir
}

# Create virtual environment
Write-Host "🏗️ Setting up Python virtual environment..." -ForegroundColor Yellow
if (Test-Path $VenvDir) {
    Write-Host "⚠️ Virtual environment already exists. Use -Force to recreate." -ForegroundColor Yellow
} else {
    & python -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Virtual environment created: $VenvDir" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "🔄 Activating virtual environment..." -ForegroundColor Yellow
$activateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    & $activateScript
    Write-Host "✅ Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to find activation script" -ForegroundColor Red
    exit 1
}

# Upgrade pip in virtual environment
Write-Host "⬆️ Upgrading pip..." -ForegroundColor Yellow
& python -m pip install --upgrade pip

# Create requirements file for Twikit
Write-Host "📝 Creating Python requirements file..." -ForegroundColor Yellow
$requirementsContent = @"
# Twikit and its dependencies
twikit>=2.3.0

# Core dependencies (explicitly listed for version control)
httpx[socks]>=0.24.0
filetype>=1.2.0
beautifulsoup4>=4.11.0
pyotp>=2.8.0
lxml>=4.9.0
webvtt-py>=0.4.6
m3u8>=3.5.0
Js2Py-3.13>=3.13.0

# Additional utilities for Node.js integration
python-dotenv>=1.0.0
asyncio-mqtt>=0.13.0
aiofiles>=23.0.0
pydantic>=2.0.0
"@

$requirementsContent | Out-File -FilePath $RequirementsFile -Encoding UTF8
Write-Host "✅ Requirements file created: $RequirementsFile" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing Twikit and dependencies..." -ForegroundColor Yellow
& pip install -r $RequirementsFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Verify installation
Write-Host "🔍 Verifying Twikit installation..." -ForegroundColor Yellow
$verificationScript = @"
import twikit
import sys
print(f'✅ Twikit {twikit.__version__} installed successfully')
print(f'✅ Python {sys.version.split()[0]}')

# Test basic imports
try:
    from twikit import Client
    print('✅ Twikit Client import successful')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
"@

$verificationScript | & python
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Twikit verification failed" -ForegroundColor Red
    exit 1
}

# Create activation script for Node.js (PowerShell)
Write-Host "📜 Creating activation scripts..." -ForegroundColor Yellow
$activationScript = @"
# Activation script for Twikit Python environment (PowerShell)
# Usage: .\activate-python-env.ps1

`$ScriptDir = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$VenvDir = Join-Path `$ScriptDir "$VenvDir"

if (Test-Path `$VenvDir) {
    `$activateScript = Join-Path `$VenvDir "Scripts\Activate.ps1"
    if (Test-Path `$activateScript) {
        & `$activateScript
        Write-Host "🐍 Python virtual environment activated" -ForegroundColor Green
        $twikitVersion = & python -c 'import twikit; print(twikit.__version__)'
        Write-Host "📦 Twikit version: $twikitVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Activation script not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Virtual environment not found at `$VenvDir" -ForegroundColor Red
    Write-Host "Run: npm run setup:python" -ForegroundColor Yellow
    exit 1
}
"@

$activationScript | Out-File -FilePath "activate-python-env.ps1" -Encoding UTF8

# Create batch file for compatibility
$batchScript = @"
@echo off
REM Activation script for Twikit Python environment (Windows)
REM Usage: activate-python-env.bat

set SCRIPT_DIR=%~dp0
set VENV_DIR=%SCRIPT_DIR%$VenvDir

if exist "%VENV_DIR%" (
    call "%VENV_DIR%\Scripts\activate.bat"
    echo 🐍 Python virtual environment activated
    python -c "import twikit; print('📦 Twikit version:', twikit.__version__)"
) else (
    echo ❌ Virtual environment not found at %VENV_DIR%
    echo Run: npm run setup:python
    exit /b 1
)
"@

$batchScript | Out-File -FilePath "activate-python-env.bat" -Encoding ASCII

# Create Python environment info script
$envInfoScript = @"
#!/usr/bin/env python3
"""
Python Environment Information Script
Provides detailed information about the Twikit installation
"""

import sys
import os
import json
from pathlib import Path

def get_env_info():
    """Get comprehensive environment information"""
    try:
        import twikit
        twikit_version = twikit.__version__
        twikit_path = twikit.__file__
    except ImportError:
        twikit_version = "Not installed"
        twikit_path = "N/A"
    
    info = {
        "python_version": sys.version,
        "python_executable": sys.executable,
        "virtual_env": os.environ.get('VIRTUAL_ENV', 'Not in virtual environment'),
        "twikit_version": twikit_version,
        "twikit_path": twikit_path,
        "working_directory": str(Path.cwd()),
        "dependencies": {}
    }
    
    # Check key dependencies
    dependencies = [
        'httpx', 'filetype', 'beautifulsoup4', 'pyotp', 
        'lxml', 'webvtt', 'm3u8', 'Js2Py'
    ]
    
    for dep in dependencies:
        try:
            module = __import__(dep)
            version = getattr(module, '__version__', 'Unknown')
            info["dependencies"][dep] = version
        except ImportError:
            info["dependencies"][dep] = "Not installed"
    
    return info

if __name__ == "__main__":
    env_info = get_env_info()
    print(json.dumps(env_info, indent=2))
"@

$envInfoScript | Out-File -FilePath "python-env-info.py" -Encoding UTF8

Write-Host "🎉 Twikit Python environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Blue
Write-Host "  ✅ Virtual environment: $VenvDir" -ForegroundColor Green
Write-Host "  ✅ Requirements file: $RequirementsFile" -ForegroundColor Green
Write-Host "  ✅ PowerShell script: activate-python-env.ps1" -ForegroundColor Green
Write-Host "  ✅ Batch script: activate-python-env.bat" -ForegroundColor Green
Write-Host "  ✅ Environment info: python-env-info.py" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test: .\activate-python-env.ps1; python python-env-info.py" -ForegroundColor White
Write-Host "  2. Integrate with Node.js using child_process" -ForegroundColor White
Write-Host "  3. Configure Docker for multi-runtime support" -ForegroundColor White
Write-Host ""
Write-Host "✨ Ready for Twikit integration!" -ForegroundColor Green
