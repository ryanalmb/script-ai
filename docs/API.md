# X Marketing Platform - API Documentation

## Overview

The X Marketing Platform provides RESTful APIs for managing social media automation, content generation, and analytics. All APIs use JSON for request and response bodies.

## Base URLs

- **Backend API**: `http://localhost:3001/api`
- **LLM Service**: `http://localhost:3003`
- **Production**: Replace localhost with your domain

## Authentication

### JWT Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### API Key Authentication

Some endpoints support API key authentication:

```http
X-API-Key: <your_api_key>
```

## Backend API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "username": "username",
    "role": "USER",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt_refresh_token"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
Content-Type: application/json

{
  "refreshToken": "jwt_refresh_token"
}
```

### Account Management

#### List X Accounts
```http
GET /api/accounts
Authorization: Bearer <token>
```

**Response:**
```json
{
  "accounts": [
    {
      "id": "account_id",
      "username": "twitter_username",
      "displayName": "Display Name",
      "accountId": "twitter_account_id",
      "isActive": true,
      "isVerified": false,
      "isSuspended": false,
      "followersCount": 1000,
      "followingCount": 500,
      "tweetsCount": 2000,
      "lastActivity": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

#### Add X Account
```http
POST /api/accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "twitter_username",
  "accessToken": "twitter_access_token",
  "accessTokenSecret": "twitter_access_token_secret",
  "displayName": "Display Name",
  "proxyId": "proxy_id"
}
```

#### Get Single Account
```http
GET /api/accounts/:id
Authorization: Bearer <token>
```

#### Update Account
```http
PUT /api/accounts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "New Display Name",
  "isActive": true,
  "proxyId": "new_proxy_id"
}
```

#### Delete Account
```http
DELETE /api/accounts/:id
Authorization: Bearer <token>
```

### Campaign Management

#### List Campaigns
```http
GET /api/campaigns
Authorization: Bearer <token>
```

#### Create Campaign
```http
POST /api/campaigns
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Campaign Name",
  "description": "Campaign description",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.000Z",
  "settings": {
    "targetAudience": "crypto",
    "postFrequency": "daily",
    "contentTypes": ["text", "image"]
  }
}
```

#### Get Campaign
```http
GET /api/campaigns/:id
Authorization: Bearer <token>
```

#### Update Campaign
```http
PUT /api/campaigns/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Campaign Name",
  "status": "ACTIVE"
}
```

#### Delete Campaign
```http
DELETE /api/campaigns/:id
Authorization: Bearer <token>
```

### Automation Management

#### List Automations
```http
GET /api/automations
Authorization: Bearer <token>
```

#### Create Automation
```http
POST /api/automations
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "account_id",
  "campaignId": "campaign_id",
  "type": "POST_CONTENT",
  "config": {
    "contentTemplate": "Check out this crypto trend: {trend}",
    "hashtags": ["#crypto", "#trading"],
    "postTimes": ["09:00", "15:00", "21:00"]
  },
  "schedule": {
    "type": "cron",
    "expression": "0 9,15,21 * * *"
  }
}
```

#### Update Automation
```http
PUT /api/automations/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ACTIVE",
  "config": {
    "postTimes": ["10:00", "16:00", "22:00"]
  }
}
```

### Post Management

#### List Posts
```http
GET /api/posts
Authorization: Bearer <token>
Query Parameters:
- accountId: Filter by account
- campaignId: Filter by campaign
- status: Filter by status (DRAFT, SCHEDULED, PUBLISHED)
- limit: Number of posts to return
- offset: Pagination offset
```

#### Create Post
```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "account_id",
  "campaignId": "campaign_id",
  "content": "Post content here #crypto #trading",
  "mediaUrls": ["https://example.com/image.jpg"],
  "scheduledFor": "2024-01-01T12:00:00.000Z"
}
```

#### Update Post
```http
PUT /api/posts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated post content",
  "scheduledFor": "2024-01-01T13:00:00.000Z"
}
```

#### Publish Post
```http
POST /api/posts/:id/publish
Authorization: Bearer <token>
```

### Analytics

#### Get Account Analytics
```http
GET /api/analytics/accounts/:accountId
Authorization: Bearer <token>
Query Parameters:
- startDate: Start date (ISO 8601)
- endDate: End date (ISO 8601)
- metrics: Comma-separated metrics (followers,engagement,reach)
```

**Response:**
```json
{
  "account": {
    "id": "account_id",
    "username": "twitter_username"
  },
  "period": {
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.000Z"
  },
  "metrics": {
    "followersGrowth": {
      "current": 1500,
      "previous": 1000,
      "change": 500,
      "changePercent": 50
    },
    "engagement": {
      "totalLikes": 5000,
      "totalRetweets": 1000,
      "totalReplies": 500,
      "engagementRate": 0.065
    },
    "reach": {
      "totalImpressions": 100000,
      "uniqueViews": 75000
    }
  },
  "timeline": [
    {
      "date": "2024-01-01",
      "followers": 1000,
      "likes": 150,
      "retweets": 30,
      "replies": 15
    }
  ]
}
```

#### Get Campaign Analytics
```http
GET /api/analytics/campaigns/:campaignId
Authorization: Bearer <token>
```

#### Get Overall Analytics
```http
GET /api/analytics/overview
Authorization: Bearer <token>
```

## LLM Service Endpoints

### Content Generation

#### Generate Text Content
```http
POST /generate/text
Content-Type: application/json

{
  "prompt": "Create a tweet about Bitcoin reaching new highs",
  "content_type": "crypto",
  "tone": "excited",
  "max_length": 280,
  "include_hashtags": true,
  "include_emojis": true,
  "target_audience": "crypto_traders"
}
```

**Response:**
```json
{
  "content": "🚀 Bitcoin just hit a new all-time high! The crypto market is on fire right now. Time to HODL strong! 💎🙌 #Bitcoin #Crypto #ATH #HODL",
  "metadata": {
    "length": 125,
    "hashtags": ["#Bitcoin", "#Crypto", "#ATH", "#HODL"],
    "emojis": ["🚀", "💎", "🙌"],
    "sentiment": "positive",
    "confidence": 0.95
  },
  "compliance": {
    "status": "approved",
    "warnings": [],
    "suggestions": []
  }
}
```

#### Generate Image
```http
POST /generate/image
Content-Type: application/json

{
  "prompt": "Bitcoin price chart going up with golden coins",
  "style": "modern",
  "size": "1024x1024",
  "quality": "high"
}
```

**Response:**
```json
{
  "url": "https://example.com/generated-image.jpg",
  "metadata": {
    "size": "1024x1024",
    "format": "JPEG",
    "style": "modern",
    "generation_time": 5.2
  }
}
```

### Analysis Services

#### Analyze Sentiment
```http
POST /analyze/sentiment
Content-Type: application/json

{
  "text": "Bitcoin is going to the moon! Best investment ever!"
}
```

**Response:**
```json
{
  "sentiment": "positive",
  "confidence": 0.92,
  "scores": {
    "positive": 0.92,
    "neutral": 0.06,
    "negative": 0.02
  },
  "emotions": {
    "joy": 0.85,
    "excitement": 0.78,
    "confidence": 0.65
  }
}
```

#### Analyze Trends
```http
POST /analyze/trends
Content-Type: application/json

{
  "category": "crypto",
  "region": "global",
  "timeframe": "24h"
}
```

**Response:**
```json
{
  "trends": [
    {
      "keyword": "Bitcoin",
      "volume": 150000,
      "sentiment": "positive",
      "change": "+25%",
      "related_hashtags": ["#BTC", "#Bitcoin", "#Crypto"]
    },
    {
      "keyword": "Ethereum",
      "volume": 120000,
      "sentiment": "neutral",
      "change": "+10%",
      "related_hashtags": ["#ETH", "#Ethereum", "#DeFi"]
    }
  ],
  "updated_at": "2024-01-01T12:00:00.000Z"
}
```

#### Check Compliance
```http
POST /check/compliance
Content-Type: application/json

{
  "content": "Buy this crypto now! Guaranteed 1000% returns!",
  "platform": "twitter",
  "content_type": "text"
}
```

**Response:**
```json
{
  "status": "rejected",
  "violations": [
    {
      "type": "financial_advice",
      "severity": "high",
      "message": "Content contains unauthorized financial advice"
    },
    {
      "type": "unrealistic_claims",
      "severity": "high",
      "message": "Guaranteed returns claims are prohibited"
    }
  ],
  "suggestions": [
    "Remove guarantee language",
    "Add disclaimer about investment risks",
    "Focus on educational content instead"
  ]
}
```

## Error Responses

All APIs return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid request data
- `AUTHENTICATION_REQUIRED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Rate Limits

### Backend API
- General endpoints: 1000 requests/hour
- Authentication: 100 requests/hour
- Account operations: 500 requests/hour

### LLM Service
- Text generation: 50 requests/minute
- Image generation: 20 requests/minute
- Video generation: 5 requests/minute
- Analysis: 100 requests/minute

## Webhooks

### Account Status Updates
```http
POST /webhooks/account-status
Content-Type: application/json

{
  "event": "account.suspended",
  "account_id": "account_id",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "reason": "Policy violation",
    "suspension_type": "temporary"
  }
}
```

### Campaign Events
```http
POST /webhooks/campaign-events
Content-Type: application/json

{
  "event": "campaign.completed",
  "campaign_id": "campaign_id",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "posts_published": 50,
    "total_engagement": 5000
  }
}
```

## SDKs and Libraries

### JavaScript/Node.js
```javascript
import { XMarketingClient } from 'x-marketing-sdk';

const client = new XMarketingClient({
  apiUrl: 'http://localhost:3001',
  apiKey: 'your_api_key'
});

// Generate content
const content = await client.generateText({
  prompt: 'Create a crypto tweet',
  contentType: 'crypto'
});
```

### Python
```python
from x_marketing import XMarketingClient

client = XMarketingClient(
    api_url='http://localhost:3001',
    api_key='your_api_key'
)

# Generate content
content = client.generate_text(
    prompt='Create a crypto tweet',
    content_type='crypto'
)
```

## Testing

Use the provided Postman collection or test with curl:

```bash
# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test content generation
curl -X POST http://localhost:3003/generate/text \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a crypto tweet","content_type":"crypto"}'
```
