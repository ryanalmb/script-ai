# Service Testing API Guide

This guide shows you how to start all services and test them with real X/Twitter credentials.

## 🚀 Starting All Services

### Method 1: Using the Service Startup Script (Recommended)
```bash
cd backend
node scripts/startServices.js
```

### Method 2: Using NPM Scripts
```bash
cd backend
npm run start:services
# OR for development mode with all services
npm run start:services:dev
```

### Method 3: Manual Start with Environment Variables
```bash
cd backend
ENABLE_ALL_SERVICES=true SERVICE_STARTUP_MODE=comprehensive npm run dev
```

## 📋 What Happens When Services Start

1. **Service Initialization**: All 25+ services are initialized in the correct order
2. **Health Checks**: Each service is validated and status is reported
3. **API Server**: Express server starts on port 3001 (default)
4. **Service Routing**: CoreBackendController is ready to route requests
5. **Ready for Testing**: All endpoints are available for testing with real credentials

## 🌐 Available API Endpoints

### Service Status
```bash
# Check overall service health
GET http://localhost:3001/api/service-test/status

# Initialize services manually (if needed)
POST http://localhost:3001/api/service-test/initialize
```

### Account Management
```bash
# Add X/Twitter account for testing
POST http://localhost:3001/api/service-test/accounts/add
Content-Type: application/json
{
  "username": "your_twitter_username",
  "password": "your_twitter_password",
  "email": "your_email@example.com",
  "telegramUserId": 123456789
}

# Get account health status
GET http://localhost:3001/api/service-test/accounts/health/{accountId}

# Get user's accounts
GET http://localhost:3001/api/service-test/accounts/user/{telegramUserId}
```

### Content Testing
```bash
# Analyze content safety
POST http://localhost:3001/api/service-test/content/analyze
Content-Type: application/json
{
  "content": "Your tweet content here",
  "contentType": "TWEET"
}

# Validate campaign content
POST http://localhost:3001/api/service-test/content/validate-campaign
Content-Type: application/json
{
  "content": [
    {
      "content": "Tweet 1 content",
      "contentType": "TWEET"
    },
    {
      "content": "Tweet 2 content", 
      "contentType": "TWEET"
    }
  ],
  "campaignContext": {
    "campaignId": "test-campaign-1",
    "targetAudience": "general"
  }
}
```

### Analytics Testing
```bash
# Get analytics data
GET http://localhost:3001/api/service-test/analytics/data/{accountId}?startDate=2024-01-01&endDate=2024-01-31

# Track custom event
POST http://localhost:3001/api/service-test/analytics/track
Content-Type: application/json
{
  "eventType": "tweet_posted",
  "eventData": {
    "accountId": "account-123",
    "tweetId": "tweet-456",
    "content": "Test tweet"
  }
}
```

### Rate Limiting Testing
```bash
# Check rate limit for specific action
GET http://localhost:3001/api/service-test/rate-limit/check/{accountId}/TWEET

# Get overall rate limit status
GET http://localhost:3001/api/service-test/rate-limit/status/{accountId}
```

### Authentication Testing
```bash
# Generate auth tokens
POST http://localhost:3001/api/service-test/auth/tokens
Content-Type: application/json
{
  "userId": "user-123"
}

# Validate auth token
POST http://localhost:3001/api/service-test/auth/validate
Content-Type: application/json
{
  "token": "your-jwt-token-here"
}
```

## 🧪 Testing with Real X/Twitter Credentials

### Step 1: Start Services
```bash
cd backend
node scripts/startServices.js
```

### Step 2: Add Your X Account
```bash
curl -X POST http://localhost:3001/api/service-test/accounts/add \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_actual_twitter_username",
    "password": "your_actual_twitter_password", 
    "email": "your_email@example.com",
    "telegramUserId": 123456789
  }'
```

### Step 3: Test Content Analysis
```bash
curl -X POST http://localhost:3001/api/service-test/content/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello world! This is a test tweet.",
    "contentType": "TWEET"
  }'
```

### Step 4: Check Account Health
```bash
curl http://localhost:3001/api/service-test/accounts/health/{accountId}
```

### Step 5: Test Rate Limiting
```bash
curl http://localhost:3001/api/service-test/rate-limit/check/{accountId}/TWEET
```

## 📊 Expected Service Status Response

When you call `/api/service-test/status`, you should see:

```json
{
  "success": true,
  "data": {
    "status": "initialized",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "uptime": 45230,
    "services": [
      {
        "name": "accountSimulatorService",
        "status": "healthy",
        "available": true
      },
      {
        "name": "advancedCacheManager", 
        "status": "healthy",
        "available": true
      },
      // ... all other services
    ]
  }
}
```

## 🔧 Service Categories Being Tested

1. **Core Backend Services** (7 services)
   - Account Simulator Service
   - Advanced Cache Manager
   - Analytics Service
   - Content Safety Filter
   - Correlation Manager
   - Database Monitor
   - Disaster Recovery Service

2. **Twikit Integration Services** (4 services)
   - Anti-Detection Service
   - Campaign Orchestrator
   - Account Health Monitor
   - Enhanced API Client

3. **Account & Automation Services** (3 services)
   - Compliance Audit Service
   - Compliance Integration Service
   - Emergency Stop System

4. **Anti-Detection Sub-Services** (3 services)
   - Enterprise Anti-Detection Manager
   - Global Rate Limit Coordinator
   - Intelligent Retry Engine

5. **Specialized Sub-Services** (4 services)
   - Enterprise Auth Service
   - Enterprise Database Manager
   - Enterprise Python Process Manager
   - Enterprise Service Orchestrator

6. **Real-Time Sync Services** (2 services)
   - Enterprise Service Registry
   - Error Analytics Platform

7. **Microservices** (2+ services)
   - Intelligent Retry Manager
   - Additional specialized services

## 🛑 Stopping Services

To stop all services, simply press `Ctrl+C` in the terminal where services are running.

## 🔍 Monitoring and Logs

While services are running, you can monitor:

- **Console Logs**: Real-time service logs in the terminal
- **Health Endpoint**: `http://localhost:3001/health`
- **Metrics Endpoint**: `http://localhost:3001/metrics`
- **Service Status**: `http://localhost:3001/api/service-test/status`

## 🐛 Troubleshooting

### Services Won't Start
1. Check that ports are available (especially 3001)
2. Ensure dependencies are installed: `npm install`
3. Check environment variables are set correctly
4. Look at console logs for specific error messages

### API Calls Failing
1. Verify services are running: `GET /api/service-test/status`
2. Check request format matches examples above
3. Ensure Content-Type headers are set correctly
4. Check console logs for error details

### Account Addition Fails
1. Verify X/Twitter credentials are correct
2. Check that the account isn't already added
3. Ensure telegramUserId is a valid number
4. Check rate limiting isn't blocking requests

## 🎯 Next Steps

Once services are running and you've tested with your X credentials:

1. **Test All Service Categories**: Try endpoints for each service type
2. **Load Testing**: Send multiple requests to test performance
3. **Error Scenarios**: Test with invalid data to verify error handling
4. **Integration Testing**: Test workflows that use multiple services
5. **Real Automation**: Use the services for actual X/Twitter automation

The services are now ready for comprehensive testing with your real X/Twitter account credentials!
