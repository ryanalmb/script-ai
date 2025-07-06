#!/bin/bash

# X Marketing Platform - Environment Configuration Script
# This script helps set up environment variables for free hosting deployment

set -e

echo "🚀 X Marketing Platform - Environment Configuration"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    echo -e "${BLUE}$prompt${NC}"
    if [ -n "$default" ]; then
        echo -e "${YELLOW}Default: $default${NC}"
    fi
    read -p "> " input
    
    if [ -z "$input" ] && [ -n "$default" ]; then
        input="$default"
    fi
    
    eval "$var_name='$input'"
}

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

echo -e "${GREEN}Setting up environment configuration...${NC}\n"

# Database Configuration
echo -e "${BLUE}📊 Database Configuration (Supabase)${NC}"
prompt_with_default "Enter your Supabase project URL:" "https://your-project.supabase.co" SUPABASE_URL
prompt_with_default "Enter your Supabase anon key:" "" SUPABASE_ANON_KEY
prompt_with_default "Enter your Supabase service role key:" "" SUPABASE_SERVICE_ROLE_KEY

# Construct DATABASE_URL
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.${SUPABASE_URL#https://}.co:5432/postgres"

echo ""

# Redis Configuration
echo -e "${BLUE}🔄 Redis Configuration (Upstash)${NC}"
prompt_with_default "Enter your Upstash Redis REST URL:" "https://your-redis.upstash.io" UPSTASH_REDIS_REST_URL
prompt_with_default "Enter your Upstash Redis REST token:" "" UPSTASH_REDIS_REST_TOKEN

echo ""

# Security Configuration
echo -e "${BLUE}🔐 Security Configuration${NC}"
echo "Generating secure secrets..."

JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)
ENCRYPTION_KEY=$(generate_secret)

echo -e "${GREEN}✅ Generated JWT_SECRET: $JWT_SECRET${NC}"
echo -e "${GREEN}✅ Generated JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET${NC}"
echo -e "${GREEN}✅ Generated ENCRYPTION_KEY: $ENCRYPTION_KEY${NC}"

echo ""

# X API Configuration
echo -e "${BLUE}🐦 X (Twitter) API Configuration${NC}"
prompt_with_default "Enter your X API Key:" "" X_API_KEY
prompt_with_default "Enter your X API Secret:" "" X_API_SECRET
prompt_with_default "Enter your X Bearer Token:" "" X_BEARER_TOKEN
prompt_with_default "Enter your X Access Token:" "" X_ACCESS_TOKEN
prompt_with_default "Enter your X Access Token Secret:" "" X_ACCESS_TOKEN_SECRET

echo ""

# Telegram Configuration
echo -e "${BLUE}📱 Telegram Bot Configuration${NC}"
prompt_with_default "Enter your Telegram Bot Token:" "" TELEGRAM_BOT_TOKEN

echo ""

# LLM Services Configuration
echo -e "${BLUE}🧠 LLM Services Configuration${NC}"
prompt_with_default "Enter your Hugging Face API Key (optional):" "" HUGGINGFACE_API_KEY

echo ""

# Deployment URLs
echo -e "${BLUE}🌐 Deployment URLs${NC}"
prompt_with_default "Enter your frontend domain:" "your-app.vercel.app" FRONTEND_DOMAIN
prompt_with_default "Enter your backend domain:" "your-backend.railway.app" BACKEND_DOMAIN
prompt_with_default "Enter your LLM service domain:" "your-llm.onrender.com" LLM_DOMAIN
prompt_with_default "Enter your Telegram bot domain:" "your-bot.railway.app" BOT_DOMAIN

# Construct URLs
FRONTEND_URL="https://$FRONTEND_DOMAIN"
BACKEND_URL="https://$BACKEND_DOMAIN"
LLM_SERVICE_URL="https://$LLM_DOMAIN"
TELEGRAM_BOT_URL="https://$BOT_DOMAIN"
TELEGRAM_WEBHOOK_URL="$TELEGRAM_BOT_URL/webhook"

echo ""

# Monitoring Configuration
echo -e "${BLUE}📊 Monitoring Configuration (Optional)${NC}"
prompt_with_default "Enter your Grafana API Key (optional):" "" GRAFANA_API_KEY

echo ""

# Generate environment files
echo -e "${GREEN}📝 Generating environment configuration files...${NC}"

# Backend .env
cat > .env.backend << EOF
# Database Configuration
DATABASE_URL=$DATABASE_URL
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Redis Configuration
REDIS_URL=redis://default:$UPSTASH_REDIS_REST_TOKEN@\${UPSTASH_REDIS_REST_URL#https://}:6379
UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN

# Security
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# X API
X_API_KEY=$X_API_KEY
X_API_SECRET=$X_API_SECRET
X_BEARER_TOKEN=$X_BEARER_TOKEN
X_ACCESS_TOKEN=$X_ACCESS_TOKEN
X_ACCESS_TOKEN_SECRET=$X_ACCESS_TOKEN_SECRET

# Telegram
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_URL=$TELEGRAM_WEBHOOK_URL

# LLM Services
OLLAMA_HOST=$LLM_SERVICE_URL
HUGGINGFACE_API_KEY=$HUGGINGFACE_API_KEY

# Application URLs
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$BACKEND_URL
LLM_SERVICE_URL=$LLM_SERVICE_URL

# Environment
NODE_ENV=production
PORT=3001

# Monitoring
LOG_LEVEL=info
METRICS_COLLECTION_ENABLED=true
GRAFANA_API_KEY=$GRAFANA_API_KEY

# Advanced Features
ENABLE_ADVANCED_FEATURES=true
ENABLE_CLUSTERING=false
ENABLE_PROXY_ROTATION=true
COMPLIANCE_STRICT_MODE=true

# Performance Limits (Free Tier Optimized)
MAX_ACCOUNTS_PER_USER=25
MAX_DAILY_ACTIONS_PER_ACCOUNT=150
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CACHE_TTL_SECONDS=3600
DB_CONNECTION_POOL_SIZE=5
REDIS_CONNECTION_POOL_SIZE=3
MAX_CONCURRENT_REQUESTS=10
EOF

# Frontend .env
cat > .env.frontend << EOF
# Public Environment Variables (Safe for client-side)
NEXT_PUBLIC_API_URL=$BACKEND_URL
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_NAME=X Marketing Platform
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=production

# Build Configuration
NODE_ENV=production
NEXTJS_EXPERIMENTAL_FEATURES=true
EOF

# LLM Service .env
cat > .env.llm << EOF
# LLM Service Configuration
FLASK_ENV=production
PORT=3003

# API Keys
HUGGINGFACE_API_KEY=$HUGGINGFACE_API_KEY

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODELS=llama2,codellama

# Performance
MAX_WORKERS=2
TIMEOUT_SECONDS=30
MAX_CONTENT_LENGTH=1048576

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
EOF

# Telegram Bot .env
cat > .env.telegram << EOF
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_URL=$TELEGRAM_WEBHOOK_URL

# Backend API
BACKEND_URL=$BACKEND_URL

# Database
DATABASE_URL=$DATABASE_URL

# Environment
NODE_ENV=production
PORT=3002

# Features
ENABLE_ADVANCED_FEATURES=true
ENABLE_INLINE_QUERIES=true
ENABLE_CALLBACK_QUERIES=true

# Performance
MAX_CONCURRENT_UPDATES=10
WEBHOOK_TIMEOUT=30
EOF

# Railway deployment configuration
cat > railway.toml << EOF
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[environments.production]
variables = {}
EOF

# Render deployment configuration
cat > render.yaml << EOF
services:
  - type: web
    name: x-marketing-llm-service
    env: python
    region: oregon
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: python app.py
    envVars:
      - key: FLASK_ENV
        value: production
      - key: PORT
        value: 3003
      - key: HUGGINGFACE_API_KEY
        sync: false
EOF

# Vercel deployment configuration
cat > vercel.json << EOF
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "$BACKEND_URL/api/\$1"
    }
  ]
}
EOF

echo ""
echo -e "${GREEN}✅ Environment configuration completed!${NC}"
echo ""
echo -e "${YELLOW}📁 Generated files:${NC}"
echo "  - .env.backend (for Railway backend deployment)"
echo "  - .env.frontend (for Vercel frontend deployment)"
echo "  - .env.llm (for Render LLM service deployment)"
echo "  - .env.telegram (for Railway Telegram bot deployment)"
echo "  - railway.toml (Railway configuration)"
echo "  - render.yaml (Render configuration)"
echo "  - vercel.json (Vercel configuration)"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Copy the appropriate .env file to each service directory"
echo "2. Set environment variables in your hosting platforms"
echo "3. Deploy each service using the deployment guide"
echo "4. Test all services and verify connectivity"
echo ""
echo -e "${RED}⚠️  Security Note:${NC}"
echo "Keep your .env files secure and never commit them to version control!"
echo "Add .env* to your .gitignore file."
echo ""
echo -e "${GREEN}🚀 Ready for deployment!${NC}"
