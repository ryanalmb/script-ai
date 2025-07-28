import express, { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { cacheManager } from './lib/cache';
import { checkDatabaseConnection, disconnectDatabase } from './lib/prisma';
import { connectRedis } from './config/redis';
import { serviceManager } from './services/serviceManager';

// Enterprise Infrastructure Imports
import { eventBus } from './infrastructure/eventBus';
import { serviceDiscovery } from './infrastructure/serviceDiscovery';
import { circuitBreakerManager } from './infrastructure/circuitBreaker';
import { metrics } from './infrastructure/metrics';
import { tracing } from './infrastructure/tracing';

// Production-ready hardening middleware
import { connectionManager } from './config/connectionManager';
import { createCircuitBreakerMiddleware } from './middleware/circuitBreaker';
import { defaultTimeoutMiddleware } from './middleware/timeoutHandler';
import { healthMonitor, createHealthRoutes } from './middleware/healthMonitor';
import { createDegradationMiddleware } from './middleware/gracefulDegradation';
import { createEnhancedErrorMiddleware } from './middleware/enhancedErrorHandler';
import { metricsCollector, createMetricsRoutes } from './middleware/metricsCollector';

// Enhanced security middleware
import {
  securityMiddleware,
  securityLogger,
  requestSizeLimit
} from './middleware/security';
import {
  generalLimiter,
  authLimiter,
  contentLimiter,
  cleanupRateLimiting
} from './middleware/rateLimiting';
import {
  sanitizeInput,
  validateSchema
} from './middleware/validation';
import {
  csrfProtection,
  csrfTokenProvider
} from './middleware/csrf';

// Routes
import authRoutes from './routes/auth';
import enterpriseAuthRoutes from './routes/enterpriseAuth';
import telegramAuthRoutes from './routes/telegramAuth';
import userRoutes from './routes/users';
import accountRoutes from './routes/accounts';
import campaignRoutes from './routes/campaigns';
import automationRoutes from './routes/automations';
import postRoutes from './routes/posts';
import analyticsRoutes from './routes/analytics';
import contentRoutes from './routes/content';
import webhookRoutes from './routes/webhooks';
import enterpriseRoutes from './routes/enterprise';
import simulateRoutes from './routes/simulate';
import enterpriseHealthRoutes from './routes/enterpriseHealth';
import monitoringRoutes from './routes/monitoring';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Enterprise infrastructure imports
import { telemetryManager, initializeTelemetry, tracingMiddleware } from './config/telemetry';
import { enterpriseServiceRegistry } from './services/enterpriseServiceRegistry';
import { enhancedApiClient } from './services/enhancedApiClient';
import { advancedCacheManager } from './services/advancedCacheManager';
import { databaseMonitor } from './services/databaseMonitor';
import { enterpriseRedisManager } from './config/redis';
import { correlationManager } from './services/correlationManager';
import { intelligentRetryEngine } from './services/intelligentRetryEngine';
import { errorAnalyticsPlatform } from './services/errorAnalyticsPlatform';
import { ErrorFactory } from './errors/enterpriseErrorFramework';
import { initializeMonitoringService } from './services/monitoringServiceInitializer';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Production monitoring and metrics (must be early)
app.use(metricsCollector.middleware());
app.use(healthMonitor.middleware());

// Timeout handling (must be early in middleware stack)
app.use(defaultTimeoutMiddleware);

// Enhanced security middleware stack
app.use(securityMiddleware);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With'
  ],
}));

// Cookie parser for CSRF tokens
app.use(cookieParser());

// Request size limiting
app.use(requestSizeLimit('10mb'));

// Rate limiting with enhanced configuration
app.use(generalLimiter);

// Body parsing middleware with enhanced security
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Input sanitization
app.use(sanitizeInput);

// Compression
app.use(compression());

// Enhanced security logging
app.use(securityLogger);

// Enterprise tracing middleware (must be early in the chain)
app.use(tracingMiddleware());

// Enterprise correlation middleware (must be early for request tracking)
app.use(correlationManager.createExpressMiddleware());

// Graceful degradation middleware
app.use(createDegradationMiddleware());

// CSRF token provider for safe methods
app.use(csrfTokenProvider);

// Enhanced health and metrics endpoints
app.use('/health', createHealthRoutes());
app.use('/api/health', enterpriseHealthRoutes); // Enterprise health checks
app.use('/metrics', createMetricsRoutes());

// Enterprise service registry status endpoint
app.get('/api/services/status', async (req: Request, res: Response) => {
  try {
    const registryStatus = await enterpriseServiceRegistry.getRegistryStatus();
    res.json({
      success: true,
      data: registryStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get service registry status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service registry status',
      timestamp: new Date().toISOString()
    });
  }
});

// Enterprise database monitoring endpoints
app.get('/api/database/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = databaseMonitor.getMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get database metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database metrics',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/database/slow-queries', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const slowQueries = databaseMonitor.getSlowQueries(limit);
    res.json({
      success: true,
      data: slowQueries,
      count: slowQueries.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get slow queries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get slow queries',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/database/alerts', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const alerts = databaseMonitor.getAlerts(limit);
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get database alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database alerts',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/database/optimizations', async (req: Request, res: Response) => {
  try {
    const optimizations = databaseMonitor.getOptimizations();
    res.json({
      success: true,
      data: optimizations,
      count: optimizations.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get optimization suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get optimization suggestions',
      timestamp: new Date().toISOString()
    });
  }
});

// Enterprise cache management endpoints
app.get('/api/cache/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = advancedCacheManager.getMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get cache metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache metrics',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { key, pattern, tags } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Key is required',
        timestamp: new Date().toISOString()
      });
    }

    const invalidatedCount = await advancedCacheManager.invalidate(key, {
      pattern: pattern === true,
      tags: tags || []
    });

    return res.json({
      success: true,
      data: { invalidatedCount },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to invalidate cache:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      timestamp: new Date().toISOString()
    });
  }
});

// Circuit breakers for critical API routes
app.use('/api/auth', createCircuitBreakerMiddleware('auth', { failureThreshold: 3 }));
app.use('/api/accounts', createCircuitBreakerMiddleware('accounts', { failureThreshold: 5 }));
app.use('/api/campaigns', createCircuitBreakerMiddleware('campaigns', { failureThreshold: 5 }));
app.use('/api/content', createCircuitBreakerMiddleware('content', { failureThreshold: 10 }));

// API routes with enhanced security
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/enterprise-auth', authLimiter, enterpriseAuthRoutes);
app.use('/auth', telegramAuthRoutes);
app.use('/api/users', authMiddleware, csrfProtection, userRoutes);
app.use('/api/accounts', authMiddleware, csrfProtection, accountRoutes);
app.use('/api/campaigns', authMiddleware, csrfProtection, campaignRoutes);
app.use('/api/automations', authMiddleware, csrfProtection, automationRoutes);
app.use('/api/posts', authMiddleware, csrfProtection, postRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes); // Read-only, no CSRF needed
app.use('/api/content', authMiddleware, contentLimiter, csrfProtection, contentRoutes);
app.use('/api/enterprise', enterpriseRoutes); // Enterprise AI features - no auth for testing
app.use('/api/simulate', simulateRoutes); // Account simulation - no auth for testing
app.use('/api/webhooks', webhookRoutes); // No auth for webhooks
app.use('/api/monitoring', monitoringRoutes); // Twikit monitoring dashboard - Task 25

// Enterprise error analytics endpoints
app.get('/api/errors/events', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const events = errorAnalyticsPlatform.getErrorEvents(limit);
    res.json({
      success: true,
      data: events,
      count: events.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get error events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get error events',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/errors/patterns', async (req: Request, res: Response) => {
  try {
    const patterns = errorAnalyticsPlatform.getErrorPatterns();
    res.json({
      success: true,
      data: patterns,
      count: patterns.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get error patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get error patterns',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/errors/insights', async (req: Request, res: Response) => {
  try {
    const severity = req.query.severity as string;
    const insights = errorAnalyticsPlatform.getErrorInsights(severity);
    res.json({
      success: true,
      data: insights,
      count: insights.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get error insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get error insights',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/errors/metrics', async (req: Request, res: Response) => {
  try {
    const timeframe = parseInt(req.query.timeframe as string);
    const metrics = timeframe ?
      errorAnalyticsPlatform.getRealTimeMetrics(timeframe) :
      errorAnalyticsPlatform.getCachedMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get error metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get error metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler for unmatched routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling middleware (must be last)
app.use(createEnhancedErrorMiddleware());

// Enhanced graceful shutdown with enterprise components
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    // Phase 1: Stop accepting new requests and cleanup enterprise services
    // Shutdown Twikit monitoring service - Task 25
    try {
      const { shutdownMonitoringService } = await import('./services/monitoringServiceInitializer');
      await shutdownMonitoringService();
      logger.info('✅ Twikit monitoring service shutdown completed');
    } catch (error) {
      logger.warn('⚠️ Twikit monitoring service shutdown failed:', error);
    }

    await errorAnalyticsPlatform.shutdown();
    logger.info('✅ Error analytics platform shutdown completed');

    await databaseMonitor.shutdown();
    logger.info('✅ Database monitor shutdown completed');

    await advancedCacheManager.shutdown();
    logger.info('✅ Advanced cache manager shutdown completed');

    await enterpriseServiceRegistry.destroy();
    logger.info('✅ Enterprise service registry destroyed');

    await enterpriseRedisManager.shutdown();
    logger.info('✅ Enterprise Redis manager shutdown completed');

    await telemetryManager.shutdown();
    logger.info('✅ Telemetry shutdown completed');

    // Shutdown enterprise infrastructure
    await eventBus.shutdown();
    logger.info('✓ Event bus shutdown');

    await serviceDiscovery.shutdown();
    logger.info('✓ Service discovery shutdown');

    await metrics.shutdown();
    logger.info('✓ Metrics server shutdown');

    await tracing.shutdown();
    logger.info('✓ Distributed tracing shutdown');

    circuitBreakerManager.shutdown();
    logger.info('✓ Circuit breakers shutdown');

    // Phase 1.5: Shutdown Service Manager (PostgreSQL, Redis, etc.)
    await serviceManager.shutdown();
    logger.info('✅ Service Manager shutdown completed');

    // Phase 2: Cleanup metrics collector
    metricsCollector.destroy();
    logger.info('✅ Metrics collector cleaned up');

    // Phase 3: Close database connections
    await disconnectDatabase();
    logger.info('✅ Database disconnected');

    // Phase 4: Close legacy cache connections
    await cacheManager.disconnect();
    logger.info('✅ Legacy cache disconnected');

    // Phase 5: Cleanup rate limiting
    await cleanupRateLimiting();
    logger.info('✅ Rate limiting cleanup completed');

    logger.info('🎉 Enterprise graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize Enterprise Infrastructure
async function initializeEnterpriseInfrastructure() {
  try {
    logger.info('Initializing Enterprise Infrastructure...');

    // Initialize distributed tracing first
    await tracing.initialize();
    logger.info('✓ Distributed tracing initialized');

    // Initialize metrics collection
    const metricsPort = parseInt(process.env.METRICS_PORT || '9092');
    await metrics.initialize(metricsPort);
    logger.info('✓ Metrics collection initialized');

    // Initialize service discovery
    await serviceDiscovery.initialize();
    logger.info('✓ Service discovery initialized');

    // Register this service
    await serviceDiscovery.registerService({
      id: 'backend-service',
      name: 'backend',
      address: process.env.SERVICE_HOST || 'backend',
      port: parseInt(process.env.PORT || '3001'),
      tags: ['backend', 'api', 'enterprise', 'v1.0.0'],
      meta: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        team: 'platform',
        service_type: 'api',
        database: 'postgresql'
      },
      check: {
        http: `http://${process.env.SERVICE_HOST || 'backend'}:${process.env.PORT || '3001'}/api/health`,
        interval: '10s',
        timeout: '5s',
        deregisterCriticalServiceAfter: '30s'
      }
    });
    logger.info('✓ Service registered with discovery');

    // Initialize event bus (optional for debugging)
    if (process.env.DISABLE_KAFKA !== 'true') {
      try {
        await eventBus.initialize();
        logger.info('✓ Event bus initialized');
      } catch (error) {
        logger.warn('⚠️ Event bus initialization failed, continuing without Kafka:', error);
      }
    } else {
      logger.warn('⚠️ Kafka is disabled via DISABLE_KAFKA environment variable');
    }

    // Setup event subscriptions (optional for debugging)
    if (process.env.DISABLE_KAFKA !== 'true') {
      try {
        await setupEventSubscriptions();
        logger.info('✓ Event subscriptions configured');
      } catch (error) {
        logger.warn('⚠️ Event subscriptions setup failed, continuing without event subscriptions:', error);
      }
    }

    logger.info('Enterprise Infrastructure initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize Enterprise Infrastructure:', error);
    throw error;
  }
}

// Setup event subscriptions
async function setupEventSubscriptions() {
  // Subscribe to telegram events
  await eventBus.subscribe('telegram.message', async (event: any) => {
    logger.info('Telegram message event received', { userId: event.userId });
  });

  // Subscribe to content events
  await eventBus.subscribe('content.generated', async (event: any) => {
    logger.info('Content generated event received', {
      userId: event.userId,
      contentType: event.contentType
    });
  });

  // Subscribe to system events
  await eventBus.subscribe('system.error', async (event: any) => {
    logger.error('System error event received', {
      service: event.service,
      severity: event.severity
    });
  });
}

// Start server with enterprise-grade initialization
async function startServer() {
  try {
    logger.info('🚀 Starting Enterprise X Marketing Platform Backend (v2)...');

    // Phase 0: Initialize and start all required services (PostgreSQL, Redis, etc.)
    logger.info('🔧 Initializing Service Manager...');
    await serviceManager.initialize();
    logger.info('✅ Service Manager initialized');

    // Update DATABASE_URL with enterprise database connection details
    if (serviceManager.isEnterpriseMode()) {
      logger.info('🔍 Checking enterprise database connection details...');
      const enterpriseOrchestrator = serviceManager.getEnterpriseOrchestrator();
      logger.info(`🔍 Enterprise orchestrator: ${enterpriseOrchestrator ? 'found' : 'not found'}`);

      if (enterpriseOrchestrator) {
        try {
          const enterpriseDbManager = enterpriseOrchestrator.getDatabaseManager();
          logger.info(`🔍 Enterprise DB manager: ${enterpriseDbManager ? 'found' : 'not found'}`);

          if (enterpriseDbManager) {
            const connectionInfo = enterpriseDbManager.getConnectionInfo();
            logger.info(`🔍 Connection info: ${JSON.stringify(connectionInfo)}`);

            if (connectionInfo && connectionInfo.postgres) {
              const { host, port, database, username, password } = connectionInfo.postgres;
              const newDatabaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}`;
              process.env.DATABASE_URL = newDatabaseUrl;
              logger.info(`✅ DATABASE_URL updated for enterprise PostgreSQL: ${host}:${port}`);
              logger.info(`✅ New DATABASE_URL: ${newDatabaseUrl}`);
            } else {
              logger.warn('⚠️ No PostgreSQL connection info available');
            }
          }
        } catch (error) {
          logger.error('❌ Error accessing enterprise database manager:', error);
        }
      }
    }

    logger.info('🚀 Starting all required services (non-blocking)...');
    // Start services in background to avoid blocking main server startup
    serviceManager.startAllServices().catch(error => {
      logger.error('❌ Error starting services:', error);
    });
    logger.info('✅ Service startup initiated (running in background)');

    logger.info('⏳ Waiting for services to be ready...');
    await serviceManager.waitForServices(120000); // 2 minutes timeout
    logger.info('✅ All services are ready');

    // Phase 1: Initialize telemetry and observability
    await initializeTelemetry({
      serviceName: 'x-marketing-backend',
      serviceVersion: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
    logger.info('✅ Telemetry initialized');

    // Phase 1.5: Initialize Enterprise Infrastructure
    await initializeEnterpriseInfrastructure();
    logger.info('✅ Enterprise Infrastructure initialized');

    // Phase 2: Initialize connection manager (handles database and Redis with pooling)
    await connectionManager.initialize();
    logger.info('✅ Connection manager initialized successfully');

    // Phase 3: Initialize enterprise Redis manager
    await enterpriseRedisManager.initialize();
    logger.info('✅ Enterprise Redis manager initialized');

    // Phase 4: Initialize enterprise service registry
    await enterpriseServiceRegistry.initialize();
    logger.info('✅ Enterprise service registry initialized');

    // Phase 5: Initialize advanced cache manager
    await advancedCacheManager.initialize();
    logger.info('✅ Advanced cache manager initialized');

    // Phase 6: Initialize database monitor
    await databaseMonitor.initialize();
    logger.info('✅ Database monitor initialized');

    // Phase 7: Initialize error analytics platform
    await errorAnalyticsPlatform.initialize();
    logger.info('✅ Error analytics platform initialized');

    // Phase 8: Initialize Twikit monitoring service - Task 25
    try {
      const monitoringService = await initializeMonitoringService();
      app.locals.monitoringService = monitoringService;
      logger.info('✅ Twikit monitoring service initialized');
    } catch (error) {
      logger.warn('⚠️ Twikit monitoring service initialization failed, continuing without monitoring:', error);
    }

    // Phase 9: Set enterprise error context
    ErrorFactory.setContext({
      service: process.env.SERVICE_NAME || 'backend'
    });
    logger.info('✅ Enterprise error framework configured');

    // Wait for connections to stabilize before initializing legacy cache
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Phase 7: Initialize legacy cache manager for backward compatibility
    await cacheManager.connect();
    logger.info('✅ Legacy cache connected successfully');

    // Warm cache with initial data
    await cacheManager.warmCache();
    logger.info('✅ Cache warming completed');

    // Start HTTP server with production configuration
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Production server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
      logger.info(`🔒 Security enhancements: ENABLED`);
      logger.info(`⚡ Performance optimizations: ENABLED`);
      logger.info(`🛡️ Circuit breakers: ACTIVE`);
      logger.info(`📈 Metrics collection: ACTIVE`);
      logger.info(`🏥 Health monitoring: ACTIVE`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health/ready`);
      logger.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
    });

    // Configure server timeouts for production
    server.timeout = 30000; // 30 seconds
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
