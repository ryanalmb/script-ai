# 🔧 **PHASE 2: DATABASE ARCHITECTURE - ENVIRONMENT VARIABLES**

## **ENTERPRISE DATABASE CONFIGURATION**

### **Connection Pool Settings**
```bash
# Database connection pool configuration
DB_POOL_MIN=5                           # Minimum connections in pool
DB_POOL_MAX=20                          # Maximum connections in pool
DB_IDLE_TIMEOUT=30000                   # Idle connection timeout (ms)
DB_CONNECTION_TIMEOUT=10000             # Connection timeout (ms)
DB_STATEMENT_TIMEOUT=30000              # Statement timeout (ms)
DB_QUERY_TIMEOUT=30000                  # Query timeout (ms)
DB_KEEP_ALIVE=true                      # Enable TCP keep-alive
DB_KEEP_ALIVE_DELAY=10000               # Keep-alive initial delay (ms)

# Read replica configuration
ENABLE_READ_REPLICAS=false              # Enable read replica support
READ_REPLICA_URLS=                      # Comma-separated read replica URLs
```

### **Database Monitoring**
```bash
# Database monitoring configuration
DB_MONITORING_INTERVAL=30000            # Monitoring interval (ms)
DB_SLOW_QUERY_THRESHOLD=1000            # Slow query threshold (ms)
DB_MAX_SLOW_QUERIES=100                 # Max slow queries to track
DB_MAX_ALERTS=1000                      # Max alerts to store

# Performance thresholds
DB_CONNECTION_THRESHOLD=0.8             # Connection utilization threshold (80%)
DB_SLOW_QUERY_RATE_THRESHOLD=0.05       # Slow query rate threshold (5%)
DB_CACHE_HIT_RATIO_THRESHOLD=0.95       # Cache hit ratio threshold (95%)
DB_DISK_USAGE_THRESHOLD=0.85            # Disk usage threshold (85%)
DB_MEMORY_USAGE_THRESHOLD=0.9           # Memory usage threshold (90%)

# Alerting configuration
DB_ALERTING_ENABLED=true                # Enable database alerting
DB_ALERTING_INTERVAL=60000              # Alerting check interval (ms)
DB_ALERT_WEBHOOK_URL=                   # Webhook URL for alerts
DB_ALERT_EMAIL_ENABLED=false            # Enable email alerts
```

### **Query Optimization**
```bash
# Query optimization settings
ENABLE_QUERY_LOGGING=false              # Enable query logging
SLOW_QUERY_THRESHOLD=1000               # Slow query threshold (ms)
ENABLE_DB_METRICS=true                  # Enable database metrics collection
```

## **ENTERPRISE REDIS CONFIGURATION**

### **Redis Cluster Settings**
```bash
# Redis cluster configuration
REDIS_CLUSTER_ENABLED=false             # Enable Redis cluster mode
REDIS_CLUSTER_NODES=localhost:6379      # Comma-separated cluster nodes (host:port)
REDIS_PASSWORD=                         # Redis password
REDIS_DB=0                              # Redis database number

# Redis Sentinel configuration
REDIS_SENTINEL_ENABLED=false            # Enable Redis Sentinel
REDIS_SENTINELS=                        # Comma-separated sentinel nodes
REDIS_SENTINEL_NAME=mymaster            # Sentinel master name
```

### **Redis Performance**
```bash
# Redis performance settings
REDIS_ENABLE_PIPELINING=true            # Enable Redis pipelining
REDIS_ENABLE_COMPRESSION=false          # Enable data compression
REDIS_MAX_MEMORY_POLICY=allkeys-lru     # Memory eviction policy
REDIS_KEY_PREFIX=x-marketing:           # Key prefix for namespacing

# Redis monitoring
REDIS_ENABLE_METRICS=true               # Enable Redis metrics
REDIS_METRICS_INTERVAL=60000            # Metrics collection interval (ms)
REDIS_SLOW_LOG_THRESHOLD=10000          # Slow log threshold (microseconds)
```

## **ADVANCED CACHE CONFIGURATION**

### **L1 Cache (Memory)**
```bash
# L1 cache configuration
L1_CACHE_MAX_SIZE=10000                 # Maximum entries in L1 cache
L1_CACHE_TTL=300000                     # L1 cache TTL (ms) - 5 minutes
L1_CACHE_UPDATE_AGE=true                # Update age on cache access
L1_CACHE_ALLOW_STALE=false              # Allow stale cache entries
```

### **L2 Cache (Redis)**
```bash
# L2 cache configuration
L2_CACHE_TTL=3600                       # L2 cache TTL (seconds) - 1 hour
L2_CACHE_PREFIX=x-marketing:cache:      # L2 cache key prefix
L2_CACHE_COMPRESSION=false              # Enable L2 cache compression
L2_CACHE_CLUSTER=false                  # Use Redis cluster for L2
```

### **L3 Cache (Database)**
```bash
# L3 cache configuration
L3_CACHE_TABLE=cache_entries            # L3 cache table name
L3_CACHE_MAX_ENTRIES=1000000            # Maximum L3 cache entries
L3_CACHE_CLEANUP_INTERVAL=3600000       # L3 cleanup interval (ms) - 1 hour
```

### **Cache Warming**
```bash
# Cache warming configuration
CACHE_WARMING_ENABLED=true              # Enable cache warming
CACHE_WARMING_STRATEGIES=user_profiles,campaign_data,analytics  # Warming strategies

# Cache warming schedules (cron-like intervals in ms)
CACHE_WARM_USER_PROFILES=21600000       # User profiles warming (6 hours)
CACHE_WARM_CAMPAIGNS=14400000           # Campaign data warming (4 hours)
CACHE_WARM_ANALYTICS=7200000            # Analytics warming (2 hours)
```

### **Cache Analytics**
```bash
# Cache analytics configuration
CACHE_ANALYTICS_ENABLED=true           # Enable cache analytics
CACHE_METRICS_INTERVAL=60000           # Cache metrics interval (ms)

# Performance thresholds
L1_HIT_RATE_THRESHOLD=0.8              # L1 hit rate threshold (80%)
L2_HIT_RATE_THRESHOLD=0.7              # L2 hit rate threshold (70%)
CACHE_RESPONSE_TIME_THRESHOLD=10       # Cache response time threshold (ms)
```

## **OPENTELEMETRY CONFIGURATION**

### **Tracing Configuration**
```bash
# OpenTelemetry configuration
SERVICE_NAME=x-marketing-backend        # Service name for tracing
SERVICE_VERSION=1.0.0                  # Service version
NODE_ENV=development                    # Environment (development/production)

# Jaeger configuration
OTEL_JAEGER_EXPORTER=true              # Enable Jaeger exporter
JAEGER_ENDPOINT=http://localhost:14268/api/traces  # Jaeger endpoint

# Prometheus configuration
OTEL_PROMETHEUS_EXPORTER=true          # Enable Prometheus exporter
PROMETHEUS_PORT=9090                   # Prometheus metrics port

# Tracing settings
OTEL_CONSOLE_EXPORTER=false            # Enable console exporter (dev only)
OTEL_SAMPLE_RATE=0.1                   # Trace sampling rate (10%)
```

## **SERVICE REGISTRY CONFIGURATION**

### **Health Monitoring**
```bash
# Service registry configuration
HEALTH_CHECK_INTERVAL=30000            # Health check interval (ms)
METRICS_COLLECTION_INTERVAL=60000      # Metrics collection interval (ms)

# Service URLs
LLM_SERVICE_URL=http://localhost:3003  # LLM service URL
TELEGRAM_BOT_URL=http://localhost:3002 # Telegram bot URL
FRONTEND_URL=http://localhost:3000     # Frontend URL
```

## **EXAMPLE .env.local FILE**

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/x_marketing
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_MONITORING_INTERVAL=30000
DB_SLOW_QUERY_THRESHOLD=1000
ENABLE_DB_METRICS=true

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_CLUSTER_ENABLED=false
REDIS_ENABLE_METRICS=true
REDIS_KEY_PREFIX=x-marketing:

# Cache Configuration
L1_CACHE_MAX_SIZE=10000
L2_CACHE_TTL=3600
CACHE_WARMING_ENABLED=true
CACHE_ANALYTICS_ENABLED=true

# OpenTelemetry Configuration
OTEL_JAEGER_EXPORTER=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_PROMETHEUS_EXPORTER=true
PROMETHEUS_PORT=9090
OTEL_SAMPLE_RATE=0.1

# Service Registry
HEALTH_CHECK_INTERVAL=30000
LLM_SERVICE_URL=http://localhost:3003
TELEGRAM_BOT_URL=http://localhost:3002
FRONTEND_URL=http://localhost:3000

# Monitoring and Alerting
DB_ALERTING_ENABLED=true
DB_ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts
```

## **PRODUCTION RECOMMENDATIONS**

### **High-Performance Settings**
```bash
# Production database settings
DB_POOL_MAX=50                         # Increase for high load
DB_SLOW_QUERY_THRESHOLD=500            # Stricter threshold
DB_CONNECTION_THRESHOLD=0.7            # Lower threshold for alerts

# Production cache settings
L1_CACHE_MAX_SIZE=50000               # Larger memory cache
L2_CACHE_TTL=7200                     # Longer Redis TTL
CACHE_WARMING_ENABLED=true            # Essential for production

# Production monitoring
OTEL_SAMPLE_RATE=0.01                 # Lower sampling for performance
DB_MONITORING_INTERVAL=15000          # More frequent monitoring
CACHE_METRICS_INTERVAL=30000          # More frequent cache metrics
```

### **Security Settings**
```bash
# Production security
REDIS_PASSWORD=your-secure-redis-password
DB_ALERT_EMAIL_ENABLED=true
DB_ALERTING_ENABLED=true
OTEL_CONSOLE_EXPORTER=false           # Disable in production
```

## **MONITORING ENDPOINTS**

After configuration, these endpoints will be available:

- **Database Metrics**: `GET /api/database/metrics`
- **Slow Queries**: `GET /api/database/slow-queries`
- **Database Alerts**: `GET /api/database/alerts`
- **Query Optimizations**: `GET /api/database/optimizations`
- **Cache Metrics**: `GET /api/cache/metrics`
- **Cache Invalidation**: `POST /api/cache/invalidate`
- **Service Status**: `GET /api/services/status`
- **Prometheus Metrics**: `GET /metrics`
- **Jaeger UI**: `http://localhost:16686` (if Jaeger is running)

## **TROUBLESHOOTING**

### **Common Issues**
1. **High Memory Usage**: Reduce `L1_CACHE_MAX_SIZE`
2. **Slow Queries**: Lower `DB_SLOW_QUERY_THRESHOLD`
3. **Connection Pool Exhaustion**: Increase `DB_POOL_MAX`
4. **Cache Misses**: Enable `CACHE_WARMING_ENABLED`
5. **Redis Connection Issues**: Check `REDIS_CLUSTER_ENABLED` settings
