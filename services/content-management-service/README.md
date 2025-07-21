# Content Management Service

Enterprise-grade content management microservice for the X Marketing Platform. Handles content creation, AI generation, media processing, and template management with comprehensive enterprise features.

## Features

- **Content Lifecycle Management**: Create, update, publish, schedule, and delete content
- **AI Content Generation**: Intelligent content creation with LLM integration
- **Media Processing**: Image and video processing with metadata extraction
- **Template Management**: Reusable content templates with variables and customization
- **Enterprise Integration**: Kafka event publishing, Consul service discovery, Redis caching
- **Monitoring & Observability**: Prometheus metrics, Jaeger tracing, structured logging
- **Content Moderation**: Automated content filtering and compliance checking
- **Multi-format Support**: Support for tweets, threads, articles, and various content types

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Kafka (optional, can be disabled)

### Installation

1. Clone the repository and navigate to the service directory:
```bash
cd services/content-management-service
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
- `LLM_SERVICE_URL`: URL for AI content generation service

See `.env.template` for all available configuration options.

## API Endpoints

### Content Management
- `POST /api/content` - Create new content
- `GET /api/content/:userId` - Get user's content (with filters)
- `GET /api/content/:userId/:contentId` - Get specific content
- `PUT /api/content/:userId/:contentId` - Update content
- `DELETE /api/content/:userId/:contentId` - Delete content
- `POST /api/content/:userId/:contentId/publish` - Publish content
- `POST /api/content/:userId/:contentId/schedule` - Schedule content

### AI Content Generation
- `POST /api/content/generate` - Generate content using AI
- `POST /api/content/enhance` - Enhance existing content with AI
- `POST /api/content/suggest` - Get content suggestions

### Media Management
- `POST /api/media/upload` - Upload media files
- `GET /api/media/:userId` - Get user's media
- `DELETE /api/media/:mediaId` - Delete media
- `POST /api/media/:mediaId/process` - Process media (resize, optimize)

### Template Management
- `POST /api/templates` - Create content template
- `GET /api/templates` - Get available templates
- `POST /api/templates/:templateId/use` - Use template to create content

### Analytics & Statistics
- `GET /api/content/:userId/stats` - Get content statistics
- `GET /api/content/:contentId/analytics` - Get content performance analytics

### Health & Monitoring
- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics
- `GET /info` - Service information

## Docker Support

### Build Image
```bash
docker build -t x-marketing/content-management-service .
```

### Run with Docker Compose
```bash
# From services directory
docker-compose up content-management-service
```

## Kubernetes Deployment

Deploy to Kubernetes using the provided manifests:

```bash
kubectl apply -f k8s/content-management/
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

### Content Management
- **Multi-format Support**: Tweets, threads, articles, posts
- **Scheduling**: Advanced scheduling with timezone support
- **Versioning**: Content version control and history
- **Approval Workflows**: Multi-stage content approval process

### AI Integration
- **Content Generation**: AI-powered content creation
- **Enhancement**: Improve existing content with AI
- **Optimization**: SEO and engagement optimization
- **Personalization**: Audience-specific content adaptation

### Media Processing
- **Image Processing**: Resize, crop, optimize, watermark
- **Video Processing**: Transcoding, thumbnail generation
- **Metadata Extraction**: EXIF data, content analysis
- **Content Moderation**: Automated inappropriate content detection

### Security & Compliance
- **Content Filtering**: Spam and inappropriate content detection
- **Brand Safety**: Ensure content aligns with brand guidelines
- **Compliance Checking**: Regulatory compliance validation
- **Audit Logging**: Comprehensive audit trail

## Monitoring

The service exposes metrics on port 9094 (configurable) for Prometheus scraping:

- Content creation and publishing metrics
- AI generation usage and costs
- Media processing performance
- Template usage statistics
- System resource metrics

Distributed tracing is available via Jaeger integration.

## Event Publishing

The service publishes events to Kafka for integration with other services:

- `content.created` - New content created
- `content.updated` - Content modified
- `content.published` - Content published
- `content.scheduled` - Content scheduled
- `content.deleted` - Content deleted
- `ai.content_generated` - AI content generated
- `media.uploaded` - Media file uploaded
- `template.used` - Template used for content creation

## Performance Optimization

### Caching Strategy
- Redis for frequently accessed content
- Media file caching with CDN integration
- Template caching for faster content creation

### Batch Processing
- Bulk content operations
- Batch media processing
- Scheduled content publishing

### Resource Management
- Connection pooling for database
- Rate limiting for API endpoints
- Memory optimization for large files

## Contributing

1. Follow TypeScript strict mode requirements
2. Maintain test coverage above 80%
3. Use structured logging with correlation IDs
4. Follow enterprise security practices
5. Update documentation for API changes

## License

Proprietary - X Marketing Platform Team
