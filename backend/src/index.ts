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

// Load environment variables
dotenv.config({ path: '.env.local' });

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

// Rate limiting
app.use(generalLimiter);

// Graceful degradation middleware
app.use(createDegradationMiddleware());

// CSRF token provider for safe methods
app.use(csrfTokenProvider);

// Enhanced health and metrics endpoints
app.use('/health', createHealthRoutes());
app.use('/metrics', createMetricsRoutes());

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

// Enhanced graceful shutdown with production components
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    // Cleanup metrics collector
    metricsCollector.destroy();
    logger.info('Metrics collector cleaned up');

    // Close database connections
    await disconnectDatabase();
    logger.info('Database disconnected');

    // Close cache connections
    await cacheManager.disconnect();
    logger.info('Cache disconnected');

    // Cleanup rate limiting
    await cleanupRateLimiting();
    logger.info('Rate limiting cleanup completed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server with production-ready initialization
async function startServer() {
  try {
    // Initialize connection manager (handles database and Redis with pooling)
    await connectionManager.initialize();
    logger.info('Connection manager initialized successfully');

    // Wait for connections to stabilize before initializing cache
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Initialize cache manager after connection manager is fully ready
    await cacheManager.connect();
    logger.info('Cache connected successfully');

    // Warm cache with initial data
    await cacheManager.warmCache();
    logger.info('Cache warming completed');

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
