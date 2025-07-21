# Post Management Service

Enterprise-grade post management microservice for the X Marketing Platform. Handles post scheduling, publishing, performance tracking, and real-time analytics with comprehensive enterprise features and Twitter API integration.

## Features

- **Post Scheduling**: Advanced scheduling with timezone support and optimal timing analysis
- **Publishing Management**: Real-time post publishing with retry logic and failure handling
- **Performance Tracking**: Comprehensive analytics and engagement metrics
- **Queue Management**: Priority-based post queue with batch processing
- **Twitter API Integration**: Full Twitter API v2 integration with rate limiting
- **Enterprise Integration**: Kafka event publishing, Consul service discovery, Redis caching
- **Monitoring & Observability**: Prometheus metrics, Jaeger tracing, structured logging
- **Real-time Analytics**: Live performance tracking and audience insights

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Kafka (optional, can be disabled)
- Twitter API credentials (optional for development)

### Installation

1. Clone the repository and navigate to the service directory:
```bash
cd services/post-management-service
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment template and configure:
```bash
cp .env.template .env.local
# Edit .env.local with your configuration
```

4. Generate Prisma client:
```bash
npx prisma generate
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

6. Start the service:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Environment Configuration

Copy `.env.template` to `.env.local` and configure the following required variables:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens (min 32 characters)
- `JWT_REFRESH_SECRET`: Secret key for refresh tokens (min 32 characters)

Optional Twitter API configuration:
- `TWITTER_CONSUMER_KEY`: Twitter API consumer key
- `TWITTER_CONSUMER_SECRET`: Twitter API consumer secret
- `TWITTER_BEARER_TOKEN`: Twitter API bearer token

See `.env.template` for all available configuration options.

## API Endpoints

### Post Scheduling
- `POST /api/posts/:postId/schedule` - Schedule a post for publishing
- `GET /api/posts/:userId/scheduled` - Get scheduled posts (with filters)
- `DELETE /api/posts/:postId/schedule` - Cancel scheduled post

### Post Publishing
- `POST /api/posts/:postId/publish` - Publish post immediately or from queue

### Analytics & Performance
- `GET /api/posts/:postId/metrics` - Get post performance metrics
- `GET /api/posts/:postId/analytics` - Get comprehensive post analytics
- `GET /api/posts/:userId/stats` - Get user post statistics

### Health & Monitoring
- `GET /health` - Health check with detailed metrics
- `GET /ready` - Readiness check
- `GET /info` - Service information

## Post Scheduling

### Schedule a Post

```bash
POST /api/posts/:postId/schedule
Content-Type: application/json

{
  "userId": "user-123",
  "scheduledFor": "2024-01-15T14:30:00Z",
  "timezone": "America/New_York",
  "priority": "high"
}
```

### Get Scheduled Posts

```bash
GET /api/posts/user-123/scheduled?limit=20&offset=0&fromDate=2024-01-01&toDate=2024-01-31
```

### Cancel Scheduled Post

```bash
DELETE /api/posts/post-456/schedule
Content-Type: application/json

{
  "userId": "user-123"
}
```

## Post Publishing

### Publish Post

```bash
POST /api/posts/post-456/publish
Content-Type: application/json

{
  "userId": "user-123",
  "accountId": "account-789",
  "immediatePublish": true,
  "overrideSchedule": false
}
```

## Docker Support

### Build Image
```bash
docker build -t x-marketing/post-management-service .
```

### Run with Docker Compose
```bash
# From services directory
docker-compose up post-management-service
```

## Kubernetes Deployment

Deploy to Kubernetes using the provided manifests:

```bash
kubectl apply -f k8s/post-management/
```

## Development

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run type-check` - TypeScript type checking

### Project Structure
```
src/
├── config/          # Configuration management
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

## Enterprise Features

### Post Scheduling
- **Optimal Timing**: AI-powered optimal posting time analysis
- **Timezone Support**: Multi-timezone scheduling with automatic conversion
- **Priority Queues**: Priority-based post scheduling (urgent, high, normal, low)
- **Batch Processing**: Efficient batch processing of scheduled posts
- **Conflict Resolution**: Automatic handling of scheduling conflicts

### Publishing Management
- **Real-time Publishing**: Immediate post publishing with Twitter API integration
- **Retry Logic**: Automatic retry with exponential backoff for failed posts
- **Rate Limiting**: Intelligent rate limiting to respect Twitter API limits
- **Queue Management**: Advanced queue management with dead letter queues
- **Status Tracking**: Real-time post status tracking and updates

### Performance Analytics
- **Engagement Metrics**: Comprehensive engagement tracking (likes, retweets, replies)
- **Audience Analytics**: Detailed audience demographics and behavior analysis
- **Performance Insights**: AI-powered insights and recommendations
- **Comparative Analysis**: Performance comparison against account and industry averages
- **Real-time Updates**: Live metrics updates with configurable intervals

### Twitter API Integration
- **API v2 Support**: Full Twitter API v2 integration with latest features
- **Rate Limit Management**: Intelligent rate limit handling and queuing
- **Error Handling**: Comprehensive error handling for all Twitter API responses
- **Webhook Support**: Real-time webhook integration for instant updates
- **Media Support**: Full support for images, videos, and GIFs

### Security & Compliance
- **Content Validation**: Automated content validation and safety checks
- **Spam Detection**: Advanced spam and inappropriate content detection
- **Account Safety**: Account health monitoring and suspension detection
- **Audit Logging**: Comprehensive audit trail for all operations
- **Data Privacy**: GDPR-compliant data handling and retention

## Monitoring

The service exposes metrics on port 9095 (configurable) for Prometheus scraping:

- Post scheduling and publishing metrics
- Twitter API usage and rate limits
- Queue performance and processing times
- Analytics update frequencies
- System resource metrics

Distributed tracing is available via Jaeger integration.

## Event Publishing

The service publishes events to Kafka for integration with other services:

- `post.scheduled` - Post scheduled for publishing
- `post.published` - Post successfully published
- `post.failed` - Post publishing failed
- `post.cancelled` - Scheduled post cancelled
- `post.metrics_updated` - Post metrics updated
- `post.queue_added` - Post added to publishing queue
- `post.queue_processed` - Post processed from queue
- `optimal_timing.analyzed` - Optimal timing analysis completed
- `rate_limit.reached` - Twitter API rate limit reached
- `account.suspended` - Account suspension detected

## Performance Optimization

### Caching Strategy
- Redis for frequently accessed post data
- Metrics caching with configurable TTL
- Queue state caching for faster processing

### Batch Processing
- Bulk post operations
- Batch metrics updates
- Scheduled post processing in batches

### Resource Management
- Connection pooling for database and external APIs
- Rate limiting for API endpoints
- Memory optimization for large datasets

## Twitter API Integration

### Rate Limiting
- Intelligent rate limit detection and handling
- Automatic queuing when limits are reached
- Priority-based processing when limits reset

### Error Handling
- Comprehensive error mapping for all Twitter API responses
- Automatic retry for transient errors
- Dead letter queue for permanently failed posts

### Webhook Integration
- Real-time webhook processing for instant updates
- Automatic metrics updates from webhook events
- Event correlation and deduplication

## Scheduling Intelligence

### Optimal Timing Analysis
- Historical performance analysis
- Audience activity pattern detection
- AI-powered optimal timing recommendations
- Timezone-aware scheduling optimization

### Conflict Resolution
- Automatic detection of scheduling conflicts
- Intelligent rescheduling suggestions
- Minimum interval enforcement
- Maximum posts per hour/day limits

## Analytics & Insights

### Performance Metrics
- Engagement rates and trends
- Reach and impression analytics
- Click-through rates and conversions
- Audience growth and retention

### Comparative Analysis
- Account performance benchmarking
- Industry standard comparisons
- Campaign performance analysis
- Historical trend analysis

### AI-Powered Insights
- Content performance predictions
- Audience behavior analysis
- Optimal content recommendations
- Trend detection and alerts

## Contributing

1. Follow TypeScript strict mode requirements
2. Maintain test coverage above 80%
3. Use structured logging with correlation IDs
4. Follow enterprise security practices
5. Update documentation for API changes

## License

Proprietary - X Marketing Platform Team
