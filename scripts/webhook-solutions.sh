#!/bin/bash

# X Marketing Platform - Free Permanent Webhook Solutions
# This script sets up multiple free webhook alternatives

set -e

echo "🚀 Setting up free permanent webhook solutions..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if required tools are installed
check_requirements() {
    print_info "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed"
        exit 1
    fi
    
    print_status "Requirements check passed"
}

# Solution 1: Cloudflare Tunnel Setup
setup_cloudflare_tunnel() {
    print_info "Setting up Cloudflare Tunnel..."
    
    # Check if cloudflared is installed
    if ! command -v cloudflared &> /dev/null; then
        print_warning "Installing Cloudflare Tunnel..."
        
        # Install cloudflared based on OS
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
            sudo dpkg -i cloudflared-linux-amd64.deb
            rm cloudflared-linux-amd64.deb
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            brew install cloudflared
        else
            print_error "Unsupported OS for automatic cloudflared installation"
            print_info "Please install cloudflared manually from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
            return 1
        fi
    fi
    
    print_status "Cloudflare Tunnel is ready"
    print_info "To use: cloudflared tunnel --url http://localhost:3002"
}

# Solution 2: Railway Setup
setup_railway() {
    print_info "Setting up Railway configuration..."
    
    # Create railway.json if it doesn't exist
    if [ ! -f "railway.json" ]; then
        cat > railway.json << EOF
{
  "\$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF
        print_status "Created railway.json configuration"
    fi
    
    # Create Dockerfile for Railway
    if [ ! -f "Dockerfile" ]; then
        cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application
CMD ["npm", "start"]
EOF
        print_status "Created Dockerfile for Railway"
    fi
    
    print_status "Railway configuration ready"
    print_info "Deploy with: railway deploy"
}

# Solution 3: Render Setup
setup_render() {
    print_info "Setting up Render configuration..."
    
    # Create render.yaml
    if [ ! -f "render.yaml" ]; then
        cat > render.yaml << EOF
services:
  - type: web
    name: x-marketing-telegram-bot
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3002
    autoDeploy: false
EOF
        print_status "Created render.yaml configuration"
    fi
    
    print_status "Render configuration ready"
    print_info "Connect your GitHub repo to Render for deployment"
}

# Solution 4: Vercel Serverless Setup
setup_vercel() {
    print_info "Setting up Vercel serverless webhook..."
    
    # Create vercel.json
    if [ ! -f "vercel.json" ]; then
        cat > vercel.json << EOF
{
  "version": 2,
  "builds": [
    {
      "src": "api/webhook.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/webhook/telegram",
      "dest": "/api/webhook"
    },
    {
      "src": "/health",
      "dest": "/api/health"
    }
  ],
  "env": {
    "TELEGRAM_BOT_TOKEN": "@telegram_bot_token"
  }
}
EOF
        print_status "Created vercel.json configuration"
    fi
    
    # Create API directory
    mkdir -p api
    
    # Create webhook handler
    if [ ! -f "api/webhook.js" ]; then
        cat > api/webhook.js << 'EOF'
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    
    // Process the update
    await bot.processUpdate(update);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
EOF
        print_status "Created Vercel webhook handler"
    fi
    
    # Create health check
    if [ ! -f "api/health.js" ]; then
        cat > api/health.js << 'EOF'
export default function handler(req, res) {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Telegram Bot Webhook',
    platform: 'Vercel'
  });
}
EOF
        print_status "Created Vercel health check"
    fi
    
    print_status "Vercel configuration ready"
    print_info "Deploy with: vercel --prod"
}

# Solution 5: ngrok Setup (Backup)
setup_ngrok() {
    print_info "Setting up ngrok as backup solution..."
    
    # Check if ngrok is installed
    if ! command -v ngrok &> /dev/null; then
        print_warning "ngrok not found. Installing..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
            echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
            sudo apt update && sudo apt install ngrok
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            brew install ngrok/ngrok/ngrok
        else
            print_error "Please install ngrok manually from: https://ngrok.com/download"
            return 1
        fi
    fi
    
    print_status "ngrok is ready"
    print_info "To use: ngrok http 3002"
}

# Main execution
main() {
    print_info "🚀 X Marketing Platform - Webhook Solutions Setup"
    echo
    
    check_requirements
    echo
    
    print_info "Setting up multiple webhook solutions for redundancy..."
    echo
    
    setup_cloudflare_tunnel
    echo
    
    setup_railway
    echo
    
    setup_render
    echo
    
    setup_vercel
    echo
    
    setup_ngrok
    echo
    
    print_status "🎉 All webhook solutions configured!"
    echo
    
    print_info "📋 Next Steps:"
    echo "1. Choose your preferred solution:"
    echo "   • Cloudflare Tunnel (Recommended): cloudflared tunnel --url http://localhost:3002"
    echo "   • Railway: railway deploy"
    echo "   • Render: Connect GitHub repo"
    echo "   • Vercel: vercel --prod"
    echo "   • ngrok (Backup): ngrok http 3002"
    echo
    echo "2. Update TELEGRAM_WEBHOOK_URL in .env.local"
    echo "3. Run: node scripts/setup-webhook.js set <new-webhook-url>"
    echo "4. Test with: npm test"
    echo
    
    print_warning "💡 Pro Tip: Set up multiple solutions for maximum uptime!"
}

# Run main function
main "$@"
