# X Marketing Platform - Deployment Guide

## Overview

This guide covers deploying the X Marketing Platform to production environments using Docker, cloud services, and traditional server setups.

## Deployment Options

### 1. Docker Compose (Recommended for Small-Medium Scale)
### 2. Kubernetes (Recommended for Large Scale)
### 3. Cloud Services (AWS, GCP, Azure)
### 4. Traditional Server Setup

## Prerequisites

- Domain name with SSL certificate
- Database server (PostgreSQL 13+)
- Redis server (6+)
- Container orchestration platform (optional)
- Monitoring and logging infrastructure

## Docker Compose Deployment

### 1. Prepare Environment

```bash
# Clone repository
git clone <repository-url>
cd x-marketing-platform

# Create production environment file
cp .env.example .env.production
```

### 2. Configure Environment Variables

Edit `.env.production`:

```env
# Production Configuration
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://api.your-domain.com

# Database (Use managed database service)
DATABASE_URL=postgresql://user:pass@db-host:5432/x_marketing
REDIS_URL=redis://redis-host:6379

# Security (Generate strong secrets)
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-min-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key-here

# X API Credentials
X_API_KEY=your-production-x-api-key
X_API_SECRET=your-production-x-api-secret
X_BEARER_TOKEN=your-production-bearer-token

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-production-bot-token
TELEGRAM_WEBHOOK_URL=https://your-domain.com

# External Services
OLLAMA_HOST=https://ollama.your-domain.com
HUGGINGFACE_API_KEY=your-hf-api-key

# Monitoring
LOG_LEVEL=info
METRICS_COLLECTION_ENABLED=true
```

### 3. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.your-domain.com
    restart: unless-stopped

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - redis
    restart: unless-stopped

  # Telegram Bot
  telegram-bot:
    build:
      context: ./telegram-bot
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - backend
    restart: unless-stopped

  # LLM Service
  llm-service:
    build:
      context: ./llm-service
      dockerfile: Dockerfile.prod
    environment:
      - FLASK_ENV=production
    env_file:
      - .env.production
    restart: unless-stopped

  # Automation Engine
  automation-engine:
    build:
      context: ./automation-engine
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - backend
      - llm-service
    restart: unless-stopped

  # Redis (Use managed service in production)
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

### 4. Deploy

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Kubernetes Deployment

### 1. Prepare Kubernetes Manifests

Create `k8s/` directory with manifests:

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: x-marketing-platform

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: x-marketing-platform
data:
  NODE_ENV: "production"
  FRONTEND_URL: "https://your-domain.com"
  BACKEND_URL: "https://api.your-domain.com"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: x-marketing-platform
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@db-host:5432/x_marketing"
  JWT_SECRET: "your-jwt-secret"
  X_API_KEY: "your-x-api-key"
  TELEGRAM_BOT_TOKEN: "your-bot-token"
```

### 2. Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n x-marketing-platform

# Check services
kubectl get services -n x-marketing-platform
```

## Cloud Service Deployment

### AWS Deployment

#### Using AWS ECS with Fargate

1. **Create ECS Cluster**
```bash
aws ecs create-cluster --cluster-name x-marketing-platform
```

2. **Create Task Definitions**
```json
{
  "family": "x-marketing-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-registry/x-marketing-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-url"
        }
      ]
    }
  ]
}
```

3. **Create Services**
```bash
aws ecs create-service \
  --cluster x-marketing-platform \
  --service-name backend \
  --task-definition x-marketing-backend \
  --desired-count 2 \
  --launch-type FARGATE
```

#### Using AWS Lambda (Serverless)

For specific components that can run serverless:

```yaml
# serverless.yml
service: x-marketing-platform

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    NODE_ENV: production
    DATABASE_URL: ${env:DATABASE_URL}

functions:
  api:
    handler: backend/dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

  telegram-webhook:
    handler: telegram-bot/dist/lambda.handler
    events:
      - http:
          path: /webhook/{token}
          method: POST

  content-generator:
    handler: llm-service/lambda_handler.handler
    timeout: 30
    events:
      - http:
          path: /generate/{proxy+}
          method: ANY
```

### Google Cloud Platform

#### Using Cloud Run

```bash
# Build and push images
gcloud builds submit --tag gcr.io/PROJECT-ID/x-marketing-backend backend/

# Deploy services
gcloud run deploy x-marketing-backend \
  --image gcr.io/PROJECT-ID/x-marketing-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Microsoft Azure

#### Using Container Instances

```bash
# Create resource group
az group create --name x-marketing-rg --location eastus

# Deploy container group
az container create \
  --resource-group x-marketing-rg \
  --name x-marketing-platform \
  --image your-registry/x-marketing-backend:latest \
  --dns-name-label x-marketing \
  --ports 80
```

## Database Setup

### Managed Database Services

#### AWS RDS
```bash
aws rds create-db-instance \
  --db-instance-identifier x-marketing-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password SecurePassword123 \
  --allocated-storage 20
```

#### Google Cloud SQL
```bash
gcloud sql instances create x-marketing-db \
  --database-version=POSTGRES_13 \
  --tier=db-f1-micro \
  --region=us-central1
```

### Database Migration

```bash
# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

## SSL Certificate Setup

### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Using Cloud Provider SSL

#### AWS Certificate Manager
```bash
aws acm request-certificate \
  --domain-name your-domain.com \
  --subject-alternative-names api.your-domain.com \
  --validation-method DNS
```

## Monitoring and Logging

### Application Monitoring

#### Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  grafana_data:
```

#### ELK Stack for Logging

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.15.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:7.15.0
    volumes:
      - ./logging/logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: docker.elastic.co/kibana/kibana:7.15.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

## Security Hardening

### Network Security

```nginx
# nginx security headers
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
add_header Content-Security-Policy "default-src 'self'";
```

### Container Security

```dockerfile
# Use non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Remove unnecessary packages
RUN apk del .build-deps
```

## Backup and Recovery

### Database Backups

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > /backups/db_backup_$DATE.sql
aws s3 cp /backups/db_backup_$DATE.sql s3://your-backup-bucket/
```

### Application Backups

```bash
# Backup configuration and data
tar -czf app_backup_$(date +%Y%m%d).tar.gz \
  .env.production \
  uploads/ \
  logs/ \
  config/
```

## Performance Optimization

### CDN Setup

#### CloudFlare
1. Add domain to CloudFlare
2. Configure DNS records
3. Enable caching rules
4. Set up SSL/TLS

#### AWS CloudFront
```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

### Caching Strategy

```nginx
# Static assets caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# API response caching
location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key $request_uri;
}
```

## Health Checks and Monitoring

### Application Health Checks

```typescript
// health-check.ts
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      external_apis: await checkExternalAPIs()
    }
  };
  
  res.json(health);
});
```

### Monitoring Alerts

```yaml
# alertmanager.yml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://telegram-bot:3002/alerts'
```

## Troubleshooting

### Common Deployment Issues

1. **Container startup failures**
   - Check environment variables
   - Verify image builds
   - Review container logs

2. **Database connection issues**
   - Verify connection strings
   - Check network connectivity
   - Confirm credentials

3. **SSL certificate problems**
   - Verify domain ownership
   - Check certificate validity
   - Review proxy configuration

### Debugging Tools

```bash
# Container debugging
docker exec -it container_name /bin/sh

# Kubernetes debugging
kubectl describe pod pod_name
kubectl logs pod_name -f

# Network debugging
curl -I https://your-domain.com/health
```

## Maintenance

### Regular Maintenance Tasks

1. **Weekly:**
   - Review application logs
   - Check system metrics
   - Update dependencies

2. **Monthly:**
   - Security updates
   - Performance optimization
   - Backup verification

3. **Quarterly:**
   - Security audits
   - Disaster recovery testing
   - Capacity planning

### Update Procedures

```bash
# Rolling update with zero downtime
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --no-deps service_name
```

## Conclusion

This deployment guide provides comprehensive instructions for deploying the X Marketing Platform in production environments. Choose the deployment method that best fits your scale, budget, and technical requirements.

For additional support during deployment, contact our technical team or refer to the troubleshooting section.
