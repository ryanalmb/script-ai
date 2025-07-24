#!/bin/bash

# Twikit Python Dependencies Installation Script
# This script sets up Python virtual environment and installs Twikit with all dependencies

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VENV_DIR="python_env"
PYTHON_VERSION="3.8"
REQUIREMENTS_FILE="requirements-python.txt"

echo -e "${BLUE}🐍 Twikit Python Dependencies Installation${NC}"
echo "=============================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get Python version
get_python_version() {
    python3 --version 2>/dev/null | cut -d' ' -f2 | cut -d'.' -f1,2 || echo "0.0"
}

# Check if Python 3.8+ is available
echo -e "${YELLOW}📋 Checking Python installation...${NC}"
if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    echo "Please install Python 3.8 or higher:"
    echo "  - Windows: Download from https://python.org"
    echo "  - Ubuntu/Debian: sudo apt install python3 python3-pip python3-venv"
    echo "  - macOS: brew install python3"
    exit 1
fi

CURRENT_PYTHON_VERSION=$(get_python_version)
echo -e "${GREEN}✅ Python ${CURRENT_PYTHON_VERSION} found${NC}"

# Check if version is sufficient
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
    echo -e "${RED}❌ Python 3.8+ required, found ${CURRENT_PYTHON_VERSION}${NC}"
    exit 1
fi

# Check if pip is available
if ! command_exists pip3; then
    echo -e "${RED}❌ pip3 is not installed${NC}"
    echo "Please install pip3:"
    echo "  - Ubuntu/Debian: sudo apt install python3-pip"
    echo "  - Other systems: python3 -m ensurepip --upgrade"
    exit 1
fi

echo -e "${GREEN}✅ pip3 found${NC}"

# Create virtual environment
echo -e "${YELLOW}🏗️ Setting up Python virtual environment...${NC}"
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}⚠️ Virtual environment already exists, removing...${NC}"
    rm -rf "$VENV_DIR"
fi

python3 -m venv "$VENV_DIR"
echo -e "${GREEN}✅ Virtual environment created: ${VENV_DIR}${NC}"

# Activate virtual environment
echo -e "${YELLOW}🔄 Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate" || source "$VENV_DIR/Scripts/activate" 2>/dev/null || {
    echo -e "${RED}❌ Failed to activate virtual environment${NC}"
    exit 1
}

echo -e "${GREEN}✅ Virtual environment activated${NC}"

# Upgrade pip in virtual environment
echo -e "${YELLOW}⬆️ Upgrading pip...${NC}"
python -m pip install --upgrade pip

# Create requirements file for Twikit
echo -e "${YELLOW}📝 Creating Python requirements file...${NC}"
cat > "$REQUIREMENTS_FILE" << EOF
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
EOF

echo -e "${GREEN}✅ Requirements file created: ${REQUIREMENTS_FILE}${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing Twikit and dependencies...${NC}"
pip install -r "$REQUIREMENTS_FILE"

# Verify installation
echo -e "${YELLOW}🔍 Verifying Twikit installation...${NC}"
python -c "
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
"

# Create activation script for Node.js
echo -e "${YELLOW}📜 Creating activation script...${NC}"
cat > "activate-python-env.sh" << EOF
#!/bin/bash
# Activation script for Twikit Python environment
# Usage: source activate-python-env.sh

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="\$SCRIPT_DIR/$VENV_DIR"

if [ -d "\$VENV_DIR" ]; then
    source "\$VENV_DIR/bin/activate" 2>/dev/null || source "\$VENV_DIR/Scripts/activate" 2>/dev/null
    echo "🐍 Python virtual environment activated"
    echo "📦 Twikit version: \$(python -c 'import twikit; print(twikit.__version__)')"
else
    echo "❌ Virtual environment not found at \$VENV_DIR"
    echo "Run: npm run setup:python"
    exit 1
fi
EOF

chmod +x "activate-python-env.sh"

# Create Windows batch file
cat > "activate-python-env.bat" << EOF
@echo off
REM Activation script for Twikit Python environment (Windows)
REM Usage: activate-python-env.bat

set SCRIPT_DIR=%~dp0
set VENV_DIR=%SCRIPT_DIR%$VENV_DIR

if exist "%VENV_DIR%" (
    call "%VENV_DIR%\Scripts\activate.bat"
    echo 🐍 Python virtual environment activated
    python -c "import twikit; print('📦 Twikit version:', twikit.__version__)"
) else (
    echo ❌ Virtual environment not found at %VENV_DIR%
    echo Run: npm run setup:python
    exit /b 1
)
EOF

# Create Python environment info script
cat > "python-env-info.py" << EOF
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
EOF

chmod +x "python-env-info.py"

echo -e "${GREEN}🎉 Twikit Python environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "  ✅ Virtual environment: ${VENV_DIR}"
echo -e "  ✅ Requirements file: ${REQUIREMENTS_FILE}"
echo -e "  ✅ Activation script: activate-python-env.sh"
echo -e "  ✅ Windows script: activate-python-env.bat"
echo -e "  ✅ Environment info: python-env-info.py"
echo ""
echo -e "${YELLOW}🚀 Next steps:${NC}"
echo -e "  1. Test: source activate-python-env.sh && python python-env-info.py"
echo -e "  2. Integrate with Node.js using child_process"
echo -e "  3. Configure Docker for multi-runtime support"
echo ""
echo -e "${GREEN}✨ Ready for Twikit integration!${NC}"
