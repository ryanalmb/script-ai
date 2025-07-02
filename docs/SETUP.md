# X Marketing Platform - Setup Guide

## Prerequisites

- Node.js 18+ and npm 9+
- Python 3.9+
- PostgreSQL 13+
- Redis 6+
- Docker and Docker Compose (optional)

## Quick Start with Docker

1. **Clone the repository**
```bash
git clone <repository-url>
cd x-marketing-platform
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start with Docker Compose**
```bash
docker-compose up -d
```

4. **Access the application**
- Frontend Dashboard: http://localhost:3000
- Backend API: http://localhost:3001
- Telegram Bot: http://localhost:3002
- LLM Service: http://localhost:3003

## Manual Setup

### 1. Database Setup

**PostgreSQL:**
```bash
# Create database
createdb x_marketing

# Set connection string in .env
DATABASE_URL="postgresql://username:password@localhost:5432/x_marketing"
```

**Redis:**
```bash
# Start Redis server
redis-server

# Set connection string in .env
REDIS_URL="redis://localhost:6379"
```

### 2. Backend Setup

```bash
cd backend
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start development server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm run dev
```

### 4. Telegram Bot Setup

```bash
cd telegram-bot
npm install

# Start development server
npm run dev
```

### 5. LLM Service Setup

```bash
cd llm-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start development server
python app.py
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following:

#### Database Configuration
```env
DATABASE_URL="postgresql://user:password@localhost:5432/x_marketing"
REDIS_URL="redis://localhost:6379"
```

#### X API Configuration
```env
X_API_KEY="your_api_key"
X_API_SECRET="your_api_secret"
X_BEARER_TOKEN="your_bearer_token"
X_ACCESS_TOKEN="your_access_token"
X_ACCESS_TOKEN_SECRET="your_access_token_secret"
```

#### Telegram Bot Configuration
```env
TELEGRAM_BOT_TOKEN="your_bot_token"
```

#### LLM Configuration
```env
OLLAMA_HOST="http://localhost:11434"
HUGGINGFACE_API_KEY="your_hf_key"
```

#### Security Configuration
```env
JWT_SECRET="your_jwt_secret_min_32_chars"
ENCRYPTION_KEY="your_32_char_encryption_key"
```

### X API Setup

1. **Create X Developer Account**
   - Go to https://developer.twitter.com/
   - Apply for developer access
   - Create a new app

2. **Get API Keys**
   - API Key and Secret
   - Bearer Token
   - Access Token and Secret (for user authentication)

3. **Set Permissions**
   - Read and Write permissions required
   - Direct Messages permission (optional)

### Telegram Bot Setup

1. **Create Bot**
   - Message @BotFather on Telegram
   - Use `/newbot` command
   - Get bot token

2. **Set Webhook (Production)**
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://yourdomain.com/webhook/<TOKEN>"}'
```

### Ollama Setup (Local LLM)

1. **Install Ollama**
```bash
# Linux/macOS
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

2. **Pull Models**
```bash
# Pull recommended models
ollama pull llama2
ollama pull codellama
ollama pull mistral
```

3. **Start Ollama Server**
```bash
ollama serve
```

## Database Schema

The application uses Prisma ORM with PostgreSQL. Key tables:

- `users` - User accounts and authentication
- `x_accounts` - X (Twitter) account credentials
- `campaigns` - Marketing campaigns
- `automations` - Automation rules and schedules
- `posts` - Generated and scheduled posts
- `analytics` - Performance metrics
- `proxies` - Proxy configurations
- `fingerprints` - Browser fingerprints

## API Documentation

### Backend API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/accounts` - List X accounts
- `POST /api/accounts` - Add X account
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/analytics` - Get analytics data

### LLM Service Endpoints

- `POST /generate/text` - Generate text content
- `POST /generate/image` - Generate images
- `POST /analyze/sentiment` - Analyze sentiment
- `POST /analyze/trends` - Analyze trends
- `POST /check/compliance` - Check compliance

### Telegram Bot Commands

- `/start` - Initialize bot
- `/accounts` - Manage accounts
- `/campaigns` - Manage campaigns
- `/analytics` - View analytics
- `/settings` - Bot settings
- `/stop` - Emergency stop

## Security Considerations

### Data Protection
- All sensitive data is encrypted at rest
- API tokens are encrypted using AES-256
- Database connections use SSL
- JWT tokens for authentication

### Rate Limiting
- API endpoints have rate limits
- X API calls are throttled
- Redis-based rate limiting

### Proxy Management
- Rotating proxy support
- IP whitelisting
- Proxy health monitoring

### Account Safety
- Gradual activity ramping
- Human-like behavior patterns
- Account health monitoring
- Suspension detection

## Monitoring and Logging

### Application Logs
- Structured logging with Winston
- Log levels: error, warn, info, debug
- Log rotation and archival

### Metrics Collection
- Performance metrics
- API response times
- Error rates
- User activity

### Health Checks
- Database connectivity
- Redis connectivity
- External API status
- Service health endpoints

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify connection string
   - Check firewall settings

2. **X API Authentication Failed**
   - Verify API keys are correct
   - Check API permissions
   - Ensure tokens haven't expired

3. **Telegram Bot Not Responding**
   - Verify bot token
   - Check webhook configuration
   - Review bot logs

4. **LLM Service Errors**
   - Check Ollama is running
   - Verify model availability
   - Check Python dependencies

### Debug Mode

Enable debug mode for detailed logging:

```env
NODE_ENV=development
DEBUG_MODE=true
LOG_LEVEL=debug
```

### Log Locations

- Backend: `backend/logs/`
- Telegram Bot: `telegram-bot/logs/`
- LLM Service: `llm-service/logs/`

## Performance Optimization

### Database Optimization
- Connection pooling
- Query optimization
- Index management
- Regular maintenance

### Caching Strategy
- Redis caching
- API response caching
- Static asset caching
- CDN integration

### Load Balancing
- Multiple backend instances
- Database read replicas
- Redis clustering
- Proxy load balancing

## Backup and Recovery

### Database Backups
```bash
# Automated daily backups
pg_dump x_marketing > backup_$(date +%Y%m%d).sql
```

### Configuration Backups
- Environment variables
- API keys (encrypted)
- Database schemas
- Application configs

### Disaster Recovery
- Database restoration procedures
- Service restart procedures
- Data migration scripts
- Rollback procedures

## Support

For technical support:
1. Check the troubleshooting section
2. Review application logs
3. Create an issue on GitHub
4. Join the Telegram support group

## Legal Compliance

⚠️ **Important**: Ensure compliance with:
- X (Twitter) Terms of Service
- Local data protection laws (GDPR, CCPA)
- Marketing regulations (FTC guidelines)
- Platform-specific policies

Always use this platform responsibly and ethically.
