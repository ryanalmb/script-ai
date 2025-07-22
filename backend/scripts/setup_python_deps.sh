#!/bin/bash

# Setup script for Python dependencies required for X/Twitter automation
# This script installs twikit and other required Python packages

set -e

echo "🐍 Setting up Python dependencies for X/Twitter automation..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "📋 Python version: $PYTHON_VERSION"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3."
    exit 1
fi

# Create virtual environment if it doesn't exist
VENV_DIR="$(dirname "$0")/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "🔧 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📦 Installing Python dependencies..."
pip install -r "$(dirname "$0")/requirements.txt"

# Verify installation
echo "✅ Verifying twikit installation..."
python3 -c "import twikit; print(f'twikit version: {twikit.__version__}')" || {
    echo "❌ Failed to import twikit. Installation may have failed."
    exit 1
}

echo "✅ Python dependencies installed successfully!"
echo ""
echo "📝 To use the Python environment in your Node.js application:"
echo "   - The virtual environment is located at: $VENV_DIR"
echo "   - To activate manually: source $VENV_DIR/bin/activate"
echo "   - Python executable: $VENV_DIR/bin/python"
echo ""
echo "🚀 You can now use the real X/Twitter automation features!"
