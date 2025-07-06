# X Marketing Platform - Local Development Setup

## 🎯 **Overview**

This guide will help you set up the complete X Marketing Platform locally for development and testing, including all advanced features.

## 📋 **Prerequisites**

### **Required Software**
- **Node.js** 18+ (with npm)
- **Python** 3.9+
- **PostgreSQL** 14+
- **Redis** 6+
- **Docker** (optional, for containerized setup)
- **Git**

### **Installation Commands**

#### **macOS (using Homebrew)**
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required software
brew install node python postgresql redis git
brew install --cask docker

# Start services
brew services start postgresql
brew services start redis
```

#### **Ubuntu/Debian**
```bash
# Update package list
sudo apt update

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.9+
sudo apt install python3 python3-pip python3-venv

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Docker
sudo apt install docker.io docker-compose

# Start services
sudo systemctl start postgresql
sudo systemctl start redis-server
sudo systemctl enable postgresql
sudo systemctl enable redis-server
```

#### **Windows**
```powershell
# Install using Chocolatey (install Chocolatey first if needed)
choco install nodejs python postgresql redis-64 git docker-desktop

# Or download and install manually:
# - Node.js: https://nodejs.org/
# - Python: https://python.org/
# - PostgreSQL: https://postgresql.org/
# - Redis: https://redis.io/
# - Docker: https://docker.com/
```

## 🗄️ **Database Setup**

### **1. PostgreSQL Configuration**

#### **Create Database and User**
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE x_marketing_platform;
CREATE USER x_marketing_user WITH PASSWORD 'secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE x_marketing_platform TO x_marketing_user;
ALTER USER x_marketing_user CREATEDB;
\q
```

#### **Test Connection**
```bash
psql -h localhost -U x_marketing_user -d x_marketing_platform
```

### **2. Redis Configuration**

#### **Test Redis Connection**
```bash
redis-cli ping
# Should return: PONG
```

#### **Configure Redis (if needed)**
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Ensure these settings:
# bind 127.0.0.1
# port 6379
# requirepass your_redis_password (optional for local)

# Restart Redis
sudo systemctl restart redis-server
```

## 🚀 **Project Setup**

### **1. Clone and Setup Repository**

```bash
# Clone the repository
git clone <your-repository-url>
cd x-marketing-platform

# Install dependencies for all services
npm run install:all

# Or install manually for each service:
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd telegram-bot && npm install && cd ..
cd llm-service && pip install -r requirements.txt && cd ..
```

### **2. Environment Configuration**

#### **Create Local Environment Files**

**Backend (.env.local)**
```bash
# Database
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets (generate secure ones)
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars-local
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-min-32-chars-local
ENCRYPTION_KEY=your-32-character-encryption-key-local

# X API (use your actual credentials)
X_API_KEY=your-x-api-key
X_API_SECRET=your-x-api-secret
X_BEARER_TOKEN=your-x-bearer-token
X_ACCESS_TOKEN=your-x-access-token
X_ACCESS_TOKEN_SECRET=your-x-access-token-secret

# Telegram
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_URL=http://localhost:3002/webhook

# LLM Services
OLLAMA_HOST=http://localhost:11434
HUGGINGFACE_API_KEY=your-huggingface-api-key

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
LLM_SERVICE_URL=http://localhost:3003
TELEGRAM_BOT_URL=http://localhost:3002

# Environment
NODE_ENV=development
PORT=3001

# Development Settings
LOG_LEVEL=debug
ENABLE_CORS=true
ENABLE_SWAGGER=true

# Advanced Features
ENABLE_ADVANCED_FEATURES=true
ENABLE_CLUSTERING=false
ENABLE_PROXY_ROTATION=true
COMPLIANCE_STRICT_MODE=true

# Development Limits
MAX_ACCOUNTS_PER_USER=50
MAX_DAILY_ACTIONS_PER_ACCOUNT=200
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

**Frontend (.env.local)**
```bash
# Public Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=X Marketing Platform (Local)
NEXT_PUBLIC_APP_VERSION=1.0.0-dev
NEXT_PUBLIC_ENVIRONMENT=development

# Development
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
```

**LLM Service (.env.local)**
```bash
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=true
PORT=3003

# API Keys
HUGGINGFACE_API_KEY=your-huggingface-api-key

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODELS=llama2,codellama

# Development Settings
LOG_LEVEL=debug
ENABLE_CORS=true
MAX_WORKERS=1
TIMEOUT_SECONDS=60
```

**Telegram Bot (.env.local)**
```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_URL=http://localhost:3002/webhook

# Backend API
BACKEND_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform

# Development
NODE_ENV=development
PORT=3002
LOG_LEVEL=debug

# Features
ENABLE_ADVANCED_FEATURES=true
ENABLE_POLLING=true
WEBHOOK_ENABLED=false
```

### **3. Database Schema Setup**

```bash
# Navigate to backend directory
cd backend

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Seed database with initial data
npx prisma db seed

# View database in Prisma Studio (optional)
npx prisma studio
```

## 🔧 **Service Configuration**

### **1. Ollama Setup (for Local LLM)**

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# In another terminal, pull models
ollama pull llama2
ollama pull codellama

# Test Ollama
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "Hello, world!",
  "stream": false
}'
```

### **2. Telegram Bot Setup**

```bash
# Create a new bot with @BotFather on Telegram
# 1. Message @BotFather on Telegram
# 2. Send /newbot
# 3. Follow instructions to get your bot token
# 4. Add the token to your .env.local file

# Test bot token
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
```

## 🚀 **Running the Platform**

### **Option 1: Manual Start (Recommended for Development)**

```bash
# Terminal 1: Start Backend API
cd backend
npm run dev

# Terminal 2: Start Frontend
cd frontend
npm run dev

# Terminal 3: Start LLM Service
cd llm-service
python app.py

# Terminal 4: Start Telegram Bot
cd telegram-bot
npm run dev

# Terminal 5: Monitor logs (optional)
tail -f backend/logs/app.log
```

### **Option 2: Docker Compose (Alternative)**

```bash
# Create docker-compose.local.yml
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f
```

### **Option 3: Process Manager (PM2)**

```bash
# Install PM2 globally
npm install -g pm2

# Start all services
npm run start:all

# Monitor services
pm2 monit

# View logs
pm2 logs

# Stop all services
pm2 stop all
```

## 🧪 **Testing the Setup**

### **1. Health Checks**

```bash
# Test Backend API
curl http://localhost:3001/health

# Test Frontend
curl http://localhost:3000

# Test LLM Service
curl http://localhost:3003/health

# Test Telegram Bot
curl http://localhost:3002/health
```

### **2. Database Connection Test**

```bash
# Test database connection
cd backend
npm run test:db

# Or manually test
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.count().then(count => {
  console.log('Database connected! User count:', count);
  process.exit(0);
}).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
"
```

### **3. Redis Connection Test**

```bash
# Test Redis connection
redis-cli ping

# Test from Node.js
node -e "
const redis = require('redis');
const client = redis.createClient();
client.on('connect', () => {
  console.log('Redis connected!');
  process.exit(0);
});
client.on('error', (err) => {
  console.error('Redis connection failed:', err);
  process.exit(1);
});
"
```

### **4. API Integration Test**

```bash
# Test user registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "securepassword123"
  }'

# Test user login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

### **5. Advanced Features Test**

```bash
# Test content generation
curl -X POST http://localhost:3003/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a crypto market analysis post",
    "model": "llama2",
    "max_tokens": 280
  }'

# Test Telegram bot
# Send /start to your bot on Telegram
```

## 📊 **Development Tools**

### **1. Database Management**

```bash
# Prisma Studio (Database GUI)
cd backend
npx prisma studio
# Opens at http://localhost:5555

# pgAdmin (PostgreSQL GUI)
# Install and connect to localhost:5432
```

### **2. API Documentation**

```bash
# Swagger UI (when backend is running)
# Visit: http://localhost:3001/api-docs
```

### **3. Monitoring and Debugging**

```bash
# Backend logs
tail -f backend/logs/app.log

# Frontend development
# Next.js dev server provides hot reload and error overlay

# LLM Service logs
# Check terminal where Python app is running

# Telegram Bot logs
tail -f telegram-bot/logs/bot.log
```

## 🔧 **Troubleshooting**

### **Common Issues**

1. **Port Already in Use**
```bash
# Find process using port
lsof -i :3001
# Kill process
kill -9 <PID>
```

2. **Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
# Restart if needed
sudo systemctl restart postgresql
```

3. **Redis Connection Failed**
```bash
# Check Redis status
sudo systemctl status redis-server
# Restart if needed
sudo systemctl restart redis-server
```

4. **Ollama Not Responding**
```bash
# Check Ollama process
ps aux | grep ollama
# Restart Ollama
ollama serve
```

5. **Permission Errors**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
# Or use nvm for Node.js management
```

## 🚀 **Next Steps**

Once everything is running locally:

1. **Test Core Features**: User registration, account management, basic automation
2. **Test Advanced Features**: Content generation, engagement strategies, analytics
3. **Test Telegram Bot**: All commands and workflows
4. **Performance Testing**: Load testing with multiple accounts
5. **Integration Testing**: End-to-end workflows

## 📝 **Development Workflow**

```bash
# Daily development routine
1. git pull origin main
2. npm run install:all (if dependencies changed)
3. npx prisma db push (if schema changed)
4. npm run start:all
5. Run tests: npm run test:all
6. Make changes and test
7. git add . && git commit -m "description"
8. git push origin feature-branch
```

This local setup provides a complete development environment with all features enabled for testing and development.
