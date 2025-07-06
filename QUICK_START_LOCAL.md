# 🚀 X Marketing Platform - Quick Start Guide (Local)

## ⚡ **One-Command Setup**

```bash
# Clone and setup everything automatically
git clone <your-repository-url>
cd x-marketing-platform
chmod +x scripts/setup-local.js
node scripts/setup-local.js
```

## 🏃‍♂️ **Quick Start (5 Minutes)**

### **1. Prerequisites Check**
```bash
# Verify you have the required software
node --version    # Should be 18+
npm --version     # Should be 8+
python3 --version # Should be 3.9+
psql --version    # Should be 12+
redis-cli --version # Should be 6+
```

### **2. Install & Setup**
```bash
# Install all dependencies
npm run install:all

# Setup database and environment
npm run setup:local

# Setup database schema
npm run db:setup
```

### **3. Start All Services**
```bash
# Option 1: Start all services with one command
npm run dev

# Option 2: Use PM2 for better process management
npm run start:all

# Option 3: Use Docker (if you prefer containers)
npm run docker:up
```

### **4. Verify Everything Works**
```bash
# Run health check
npm run health:check

# Run integration tests
npm run test:integration
```

### **5. Access the Platform**
- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api-docs
- **Telegram Bot**: http://localhost:3002
- **LLM Service**: http://localhost:3003
- **Database GUI**: http://localhost:5555 (run `npm run db:studio`)

## 🔧 **Manual Setup (If Automated Setup Fails)**

### **Step 1: Database Setup**
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database
sudo -u postgres psql -c "
  CREATE DATABASE x_marketing_platform;
  CREATE USER x_marketing_user WITH PASSWORD 'secure_password_123';
  GRANT ALL PRIVILEGES ON DATABASE x_marketing_platform TO x_marketing_user;
  ALTER USER x_marketing_user CREATEDB;
"

# Test connection
psql -h localhost -U x_marketing_user -d x_marketing_platform -c "SELECT 1;"
```

### **Step 2: Redis Setup**
```bash
# Start Redis
sudo systemctl start redis-server

# Test connection
redis-cli ping  # Should return PONG
```

### **Step 3: Environment Configuration**
Create these files with your actual API keys:

**backend/.env.local**
```bash
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars-local
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-min-32-chars-local
ENCRYPTION_KEY=your-32-character-encryption-key-local
X_API_KEY=your-x-api-key
X_API_SECRET=your-x-api-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
HUGGINGFACE_API_KEY=your-huggingface-api-key
NODE_ENV=development
PORT=3001
ENABLE_ADVANCED_FEATURES=true
```

**frontend/.env.local**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=X Marketing Platform (Local)
NODE_ENV=development
```

**telegram-bot/.env.local**
```bash
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
BACKEND_URL=http://localhost:3001
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform
NODE_ENV=development
PORT=3002
```

**llm-service/.env.local**
```bash
FLASK_ENV=development
PORT=3003
HUGGINGFACE_API_KEY=your-huggingface-api-key
OLLAMA_HOST=http://localhost:11434
```

### **Step 4: Install Dependencies**
```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# Telegram Bot
cd telegram-bot && npm install && cd ..

# LLM Service
cd llm-service && pip install -r requirements.txt && cd ..
```

### **Step 5: Database Schema**
```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
cd ..
```

### **Step 6: Start Services**
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Telegram Bot
cd telegram-bot && npm run dev

# Terminal 4: LLM Service
cd llm-service && python app.py
```

## 🧪 **Testing Your Setup**

### **Basic Health Check**
```bash
# Test all services
curl http://localhost:3001/health  # Backend
curl http://localhost:3000         # Frontend
curl http://localhost:3002/health  # Telegram Bot
curl http://localhost:3003/health  # LLM Service
```

### **Test User Registration**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "securepassword123"
  }'
```

### **Test Content Generation**
```bash
curl -X POST http://localhost:3003/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a crypto market analysis tweet",
    "model": "test",
    "max_tokens": 280
  }'
```

### **Test Telegram Bot**
1. Message your bot on Telegram with `/start`
2. Check the logs: `tail -f telegram-bot/logs/bot.log`

## 🔍 **Troubleshooting**

### **Common Issues**

**Port Already in Use**
```bash
# Find and kill process using port
lsof -i :3001
kill -9 <PID>
```

**Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Check if database exists
psql -h localhost -U x_marketing_user -l
```

**Redis Connection Failed**
```bash
# Check Redis status
sudo systemctl status redis-server
sudo systemctl restart redis-server
```

**Permission Errors**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Fix file permissions
chmod +x scripts/*.js
```

**Prisma Issues**
```bash
# Reset database
cd backend
npx prisma db push --force-reset
npx prisma generate
npx prisma db seed
```

### **Service-Specific Issues**

**Backend Issues**
```bash
# Check logs
tail -f backend/logs/app.log

# Restart with debug
cd backend
DEBUG=* npm run dev
```

**Frontend Issues**
```bash
# Clear Next.js cache
cd frontend
rm -rf .next
npm run dev
```

**LLM Service Issues**
```bash
# Check Python dependencies
cd llm-service
pip install -r requirements.txt

# Test Ollama
curl http://localhost:11434/api/tags
```

## 📊 **Development Tools**

### **Database Management**
```bash
# Prisma Studio (GUI)
npm run db:studio

# Direct database access
psql -h localhost -U x_marketing_user -d x_marketing_platform
```

### **API Testing**
- **Swagger UI**: http://localhost:3001/api-docs
- **Postman Collection**: Import from `docs/postman-collection.json`

### **Monitoring**
```bash
# Process monitoring
npm run monit

# View logs
npm run logs

# System resources
htop
```

### **Code Quality**
```bash
# Run linting
npm run lint:all

# Run tests
npm run test:all

# Security audit
npm run security:audit
```

## 🚀 **Next Steps**

Once everything is running locally:

1. **Explore the Dashboard**: http://localhost:3000
2. **Test API Endpoints**: http://localhost:3001/api-docs
3. **Configure Telegram Bot**: Add your bot token and test commands
4. **Test Advanced Features**: Try content generation and automation
5. **Review Logs**: Check all service logs for any warnings
6. **Run Full Tests**: `npm run test:integration`

## 📝 **Development Workflow**

```bash
# Daily development routine
git pull origin main
npm run install:all  # If dependencies changed
npm run db:migrate   # If schema changed
npm run dev          # Start all services
npm run test:all     # Run tests
# Make your changes
npm run lint:all     # Check code quality
git add . && git commit -m "Your changes"
git push origin feature-branch
```

## 🎯 **Ready for Production?**

Once local testing is complete:
1. Follow the deployment guide: `deployment/FREE_HOSTING_DEPLOYMENT_GUIDE.md`
2. Use the environment configuration script: `deployment/environment-config.sh`
3. Deploy to free hosting services as documented

**Your X Marketing Platform is now ready for local development and testing!** 🎉
