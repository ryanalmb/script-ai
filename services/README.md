# X Marketing Platform - Microservices

Enterprise-grade microservices architecture for the X Marketing Platform. This directory contains all microservices that power the platform's core functionality.

## Architecture Overview

The X Marketing Platform is built using a microservices architecture with the following services:

### Core Services

1. **User Management Service** (Port 3011)
   - Authentication & Authorization
   - User lifecycle management
   - Security features & audit logging

2. **Account Management Service** (Port 3012)
   - X/Twitter OAuth integration
   - Account health monitoring
   - Rate limit management

3. **Campaign Management Service** (Port 3013)
   - Campaign lifecycle management
   - Automation & scheduling
   - Performance analytics

4. **Post Management Service** (Port 3014) - *Coming Soon*
   - Content creation & scheduling
   - Media management
   - Publishing automation

5. **Analytics Service** (Port 3015) - *Coming Soon*
   - Performance tracking
   - Reporting & insights
   - Data aggregation

### Infrastructure Services

- **PostgreSQL** (Port 5432) - Primary database
- **Redis** (Port 6379) - Caching & session storage
- **Kafka** (Port 9092) - Event streaming
- **Consul** (Port 8500) - Service discovery
- **Jaeger** (Port 16686) - Distributed tracing
- **Prometheus** (Port 9090) - Metrics collection
- **Grafana** (Port 3000) - Monitoring dashboards

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Development Setup

1. **Clone and setup environment:**
```bash
git clone <repository-url>
cd services
```

2. **Start infrastructure services:**
```bash
docker-compose up -d postgres redis kafka consul
```

3. **Setup each service:**
```bash
# User Management Service
cd user-management-service
cp .env.template .env.local
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Account Management Service
cd ../account-management-service
cp .env.template .env.local
npm install
npx prisma generate
npm run dev

# Campaign Management Service
cd ../campaign-management-service
cp .env.template .env.local
npm install
npx prisma generate
npm run dev
```

### Production Deployment

#### Docker Compose
```bash
# Start all services
docker-compose up -d

# Scale specific services
docker-compose up -d --scale user-management-service=3
```

#### Kubernetes
```bash
# Deploy infrastructure
kubectl apply -f k8s/infrastructure/

# Deploy services
kubectl apply -f k8s/user-management/
kubectl apply -f k8s/account-management/
kubectl apply -f k8s/campaign-management/
```

## Service Communication

### Event-Driven Architecture

Services communicate through Kafka events:

```
User Management → Account Management → Campaign Management
     ↓                    ↓                      ↓
   Events            OAuth Events         Campaign Events
```

### API Gateway Pattern

All external traffic routes through the main backend service (Port 3001) which acts as an API gateway.

### Service Discovery

Services register with Consul for automatic discovery and health monitoring.

## Configuration Management

Each service uses environment-based configuration:

1. **Copy template:** `cp .env.template .env.local`
2. **Configure required variables:**
   - Database connections
   - JWT secrets
   - External API keys
3. **Optional features:**
   - Monitoring & tracing
   - Email/SMS providers
   - Social login

## Monitoring & Observability

### Metrics Collection
- **Prometheus** scrapes metrics from all services
- **Grafana** provides visualization dashboards
- Custom business metrics for each service

### Distributed Tracing
- **Jaeger** traces requests across services
- Correlation IDs for request tracking
- Performance bottleneck identification

### Logging
- Structured JSON logging
- Centralized log aggregation
- Security event monitoring

### Health Checks
- `/health` - Service health status
- `/ready` - Readiness for traffic
- `/metrics` - Prometheus metrics

## Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Service-to-service authentication

### Rate Limiting
- Per-service rate limiting
- User-specific limits
- IP-based protection

### Audit Logging
- All user actions logged
- Security event monitoring
- Compliance reporting

### Data Protection
- Encrypted data at rest
- Secure communication (TLS)
- PII data handling

## Development Guidelines

### Code Standards
- TypeScript strict mode enabled
- ESLint + Prettier configuration
- 80%+ test coverage requirement

### API Design
- RESTful API principles
- Consistent error handling
- OpenAPI/Swagger documentation

### Database
- Prisma ORM for type safety
- Database migrations
- Connection pooling

### Testing
- Unit tests with Jest
- Integration tests
- End-to-end testing

## Deployment Strategies

### Blue-Green Deployment
- Zero-downtime deployments
- Automatic rollback capability
- Health check validation

### Canary Releases
- Gradual traffic shifting
- A/B testing support
- Risk mitigation

### Auto-scaling
- Horizontal pod autoscaling
- Resource-based scaling
- Custom metrics scaling

## Troubleshooting

### Common Issues

1. **Service won't start:**
   - Check environment variables
   - Verify database connectivity
   - Review service logs

2. **Database connection errors:**
   - Verify PostgreSQL is running
   - Check connection string format
   - Ensure database exists

3. **Kafka connection issues:**
   - Verify Kafka is running
   - Check broker configuration
   - Review topic creation

### Debug Commands

```bash
# Check service health
curl http://localhost:3011/health

# View service logs
docker-compose logs user-management-service

# Check Kafka topics
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Database connection test
docker exec postgres pg_isready -U postgres
```

## Performance Optimization

### Database
- Connection pooling
- Query optimization
- Index management
- Read replicas

### Caching
- Redis for session storage
- Application-level caching
- CDN for static assets

### Load Balancing
- Service load balancing
- Database load balancing
- Geographic distribution

## Contributing

1. Follow the established patterns
2. Maintain strict TypeScript compliance
3. Add comprehensive tests
4. Update documentation
5. Follow security best practices

## Support

For technical support or questions:
- Review service-specific README files
- Check monitoring dashboards
- Review application logs
- Contact the development team

## License

Proprietary - X Marketing Platform Team
