# User Management Service

Enterprise-grade user management microservice for the X Marketing Platform. Handles authentication, authorization, user lifecycle management, and security features.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Lifecycle Management**: Registration, profile management, account verification
- **Security Features**: Rate limiting, account lockout, audit logging, security monitoring
- **Enterprise Integration**: Kafka event publishing, Consul service discovery, Redis caching
- **Monitoring & Observability**: Prometheus metrics, Jaeger tracing, structured logging
- **Multi-factor Authentication**: Email and SMS verification support
- **Social Login**: Google and GitHub OAuth integration

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Kafka (optional, can be disabled)

### Installation

1. Clone the repository and navigate to the service directory:
```bash
cd services/user-management-service
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

See `.env.template` for all available configuration options.

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - User logout
- `POST /auth/verify-email` - Email verification
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `DELETE /api/users/profile` - Delete user account
- `POST /api/users/change-password` - Change password
- `GET /api/users/:userId` - Get user by ID (admin only)

### Health & Monitoring
- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /metrics` - Prometheus metrics
- `GET /info` - Service information

## Docker Support

### Build Image
```bash
docker build -t x-marketing/user-management-service .
```

### Run with Docker Compose
```bash
# From services directory
docker-compose up user-management-service
```

## Kubernetes Deployment

Deploy to Kubernetes using the provided manifests:

```bash
kubectl apply -f k8s/user-management/
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

## Security Features

- **Rate Limiting**: Configurable rate limits per endpoint
- **Account Lockout**: Automatic lockout after failed login attempts
- **Password Policy**: Configurable password complexity requirements
- **Audit Logging**: Comprehensive audit trail for all user actions
- **Security Monitoring**: Real-time security event detection
- **JWT Security**: Secure token generation and validation

## Monitoring

The service exposes metrics on port 9091 (configurable) for Prometheus scraping:

- HTTP request metrics
- Database operation metrics
- Authentication metrics
- Business logic metrics
- System resource metrics

Distributed tracing is available via Jaeger integration.

## Event Publishing

The service publishes events to Kafka for integration with other services:

- `user.registered` - User registration completed
- `user.login` - User login event
- `user.logout` - User logout event
- `user.updated` - User profile updated
- `user.deleted` - User account deleted
- `user.verified` - Email verification completed

## Contributing

1. Follow TypeScript strict mode requirements
2. Maintain test coverage above 80%
3. Use structured logging with correlation IDs
4. Follow enterprise security practices
5. Update documentation for API changes

## License

Proprietary - X Marketing Platform Team
