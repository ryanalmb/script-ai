// Node.js Monitoring Instrumentation
// Observability Excellence for X/Twitter Automation Platform

const promClient = require('prom-client');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const Sentry = require('@sentry/node');
const { Integrations } = require('@sentry/tracing');

// Create a Registry
const register = new promClient.Registry();

// Prometheus metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['service'],
  registers: [register]
});

const databaseConnections = new promClient.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['database', 'service'],
  registers: [register]
});

const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table', 'service'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const redisOperations = new promClient.Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status', 'service'],
  registers: [register]
});

const redisOperationDuration = new promClient.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

// Web Vitals metrics (frontend only)
const webVitalsFCP = new promClient.Histogram({
  name: 'web_vitals_fcp_seconds',
  help: 'First Contentful Paint in seconds',
  buckets: [0.5, 1, 1.5, 2, 3, 5],
  registers: [register]
});

const webVitalsLCP = new promClient.Histogram({
  name: 'web_vitals_lcp_seconds',
  help: 'Largest Contentful Paint in seconds',
  buckets: [1, 2, 2.5, 3, 4, 5],
  registers: [register]
});

const webVitalsFID = new promClient.Histogram({
  name: 'web_vitals_fid_seconds',
  help: 'First Input Delay in seconds',
  buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 1],
  registers: [register]
});

const webVitalsCLS = new promClient.Gauge({
  name: 'web_vitals_cls',
  help: 'Cumulative Layout Shift',
  registers: [register]
});

// Telegram Bot specific metrics
const telegramMessagesReceived = new promClient.Counter({
  name: 'telegram_messages_received_total',
  help: 'Total number of Telegram messages received',
  labelNames: ['chat_type', 'message_type', 'service'],
  registers: [register]
});

const telegramMessagesSent = new promClient.Counter({
  name: 'telegram_messages_sent_total',
  help: 'Total number of Telegram messages sent',
  labelNames: ['chat_type', 'status', 'service'],
  registers: [register]
});

const telegramCommandDuration = new promClient.Histogram({
  name: 'telegram_command_duration_seconds',
  help: 'Duration of Telegram command processing',
  labelNames: ['command', 'service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

const telegramWebhookLatency = new promClient.Histogram({
  name: 'telegram_webhook_latency_seconds',
  help: 'Latency of Telegram webhook responses',
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [register]
});

// Business metrics
const userSessions = new promClient.Gauge({
  name: 'user_sessions_active',
  help: 'Number of active user sessions',
  labelNames: ['service'],
  registers: [register]
});

const featureUsage = new promClient.Counter({
  name: 'feature_usage_total',
  help: 'Total feature usage count',
  labelNames: ['feature', 'user_type', 'service'],
  registers: [register]
});

const errorsByType = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors by type',
  labelNames: ['error_type', 'severity', 'service'],
  registers: [register]
});

function setupMonitoring(serviceName = 'unknown') {
  console.log(`🔍 Setting up monitoring instrumentation for ${serviceName}...`);
  
  // Setup OpenTelemetry
  const sdk = new NodeSDK({
    serviceName: serviceName,
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable file system instrumentation for performance
      },
    })],
    traceExporter: new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    }),
    metricExporter: new PrometheusExporter({
      port: parseInt(process.env.METRICS_PORT) || 9090,
      endpoint: '/metrics',
    }),
    resource: {
      'service.name': serviceName,
      'service.version': process.env.SERVICE_VERSION || '1.0.0',
      'deployment.environment': process.env.NODE_ENV || 'production',
    },
  });
  
  sdk.start();
  
  // Setup Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Integrations.BrowserTracing(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: global.app }),
    ],
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.1,
    environment: process.env.NODE_ENV || 'production',
    beforeSend(event) {
      // Filter out health check and metrics endpoints
      if (event.request?.url?.includes('/health') || 
          event.request?.url?.includes('/metrics') ||
          event.request?.url?.includes('/ready')) {
        return null;
      }
      return event;
    },
  });
  
  // Collect default metrics
  promClient.collectDefaultMetrics({ 
    register,
    prefix: `${serviceName}_`,
    labels: { service: serviceName }
  });
  
  console.log(`✅ Monitoring instrumentation setup complete for ${serviceName}`);
  
  return { 
    register, 
    metrics: { 
      httpRequestsTotal, 
      httpRequestDuration, 
      activeConnections,
      databaseConnections,
      databaseQueryDuration,
      redisOperations,
      redisOperationDuration,
      telegramMessagesReceived,
      telegramMessagesSent,
      telegramCommandDuration,
      telegramWebhookLatency,
      userSessions,
      featureUsage,
      errorsByType
    } 
  };
}

function recordRequestMetrics(method, route, statusCode, duration, serviceName = 'unknown') {
  httpRequestsTotal.labels(method, route, statusCode, serviceName).inc();
  httpRequestDuration.labels(method, route, serviceName).observe(duration);
}

function recordDatabaseMetrics(queryType, table, duration, serviceName = 'unknown') {
  databaseQueryDuration.labels(queryType, table, serviceName).observe(duration);
}

function recordRedisMetrics(operation, status, duration, serviceName = 'unknown') {
  redisOperations.labels(operation, status, serviceName).inc();
  if (duration !== undefined) {
    redisOperationDuration.labels(operation, serviceName).observe(duration);
  }
}

function recordTelegramMetrics(type, data, serviceName = 'telegram-bot') {
  switch (type) {
    case 'message_received':
      telegramMessagesReceived.labels(data.chatType, data.messageType, serviceName).inc();
      break;
    case 'message_sent':
      telegramMessagesSent.labels(data.chatType, data.status, serviceName).inc();
      break;
    case 'command_duration':
      telegramCommandDuration.labels(data.command, serviceName).observe(data.duration);
      break;
    case 'webhook_latency':
      telegramWebhookLatency.labels(serviceName).observe(data.latency);
      break;
  }
}

function recordWebVitals(fcp, lcp, fid, cls) {
  if (fcp) webVitalsFCP.observe(fcp / 1000); // Convert to seconds
  if (lcp) webVitalsLCP.observe(lcp / 1000);
  if (fid) webVitalsFID.observe(fid / 1000);
  if (cls !== undefined) webVitalsCLS.set(cls);
}

function recordBusinessMetrics(type, data, serviceName = 'unknown') {
  switch (type) {
    case 'user_session':
      userSessions.labels(serviceName).set(data.count);
      break;
    case 'feature_usage':
      featureUsage.labels(data.feature, data.userType, serviceName).inc();
      break;
    case 'error':
      errorsByType.labels(data.errorType, data.severity, serviceName).inc();
      break;
  }
}

function recordActiveConnections(count, serviceName = 'unknown') {
  activeConnections.labels(serviceName).set(count);
}

function recordDatabaseConnections(database, count, serviceName = 'unknown') {
  databaseConnections.labels(database, serviceName).set(count);
}

// Express middleware for automatic request tracking
function createRequestTrackingMiddleware(serviceName = 'unknown') {
  return (req, res, next) => {
    const start = Date.now();
    
    // Skip health checks and metrics endpoints
    if (req.path === '/health' || req.path === '/metrics' || req.path === '/ready') {
      return next();
    }
    
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      recordRequestMetrics(req.method, req.route?.path || req.path, res.statusCode, duration, serviceName);
    });
    
    next();
  };
}

// Error tracking middleware
function createErrorTrackingMiddleware(serviceName = 'unknown') {
  return (err, req, res, next) => {
    // Record error metrics
    const errorType = err.name || 'UnknownError';
    const severity = err.statusCode >= 500 ? 'error' : 'warning';
    
    recordBusinessMetrics('error', { errorType, severity }, serviceName);
    
    // Send to Sentry
    Sentry.captureException(err, {
      tags: {
        service: serviceName,
        endpoint: req.path,
        method: req.method,
      },
      extra: {
        body: req.body,
        query: req.query,
        params: req.params,
      },
    });
    
    next(err);
  };
}

// Health check endpoint
function createHealthCheckEndpoint() {
  return (req, res) => {
    const healthCheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
    };
    
    try {
      res.status(200).json(healthCheck);
    } catch (error) {
      healthCheck.message = error.message;
      res.status(503).json(healthCheck);
    }
  };
}

// Readiness check endpoint
function createReadinessCheckEndpoint() {
  return async (req, res) => {
    const checks = {
      database: false,
      redis: false,
      external_services: false,
    };
    
    try {
      // Add actual health checks here
      // checks.database = await checkDatabaseConnection();
      // checks.redis = await checkRedisConnection();
      // checks.external_services = await checkExternalServices();
      
      // For now, assume all are healthy
      checks.database = true;
      checks.redis = true;
      checks.external_services = true;
      
      const allHealthy = Object.values(checks).every(check => check === true);
      
      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'not ready',
        checks,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error.message,
        checks,
        timestamp: Date.now(),
      });
    }
  };
}

// Graceful shutdown handler
function setupGracefulShutdown() {
  const gracefulShutdown = (signal) => {
    console.log(`🛑 Received ${signal}. Starting graceful shutdown...`);
    
    // Close Sentry
    Sentry.close(2000).then(() => {
      console.log('✅ Sentry closed');
    });
    
    // Additional cleanup can be added here
    
    process.exit(0);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = {
  setupMonitoring,
  recordRequestMetrics,
  recordDatabaseMetrics,
  recordRedisMetrics,
  recordTelegramMetrics,
  recordWebVitals,
  recordBusinessMetrics,
  recordActiveConnections,
  recordDatabaseConnections,
  createRequestTrackingMiddleware,
  createErrorTrackingMiddleware,
  createHealthCheckEndpoint,
  createReadinessCheckEndpoint,
  setupGracefulShutdown,
  register
};
