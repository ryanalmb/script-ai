import express from 'express';
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

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

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

// CSRF token provider for safe methods
app.use(csrfTokenProvider);

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  const cacheHealthy = await cacheManager.healthCheck();

  const health = {
    status: dbHealthy && cacheHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      cache: cacheHealthy ? 'healthy' : 'unhealthy',
    },
  };

  res.status(health.status === 'OK' ? 200 : 503).json(health);
});

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
app.use('/api/webhooks', webhookRoutes); // No auth for webhooks

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(errorHandler);

// Enhanced graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
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

// Start server with enhanced initialization
async function startServer() {
  try {
    // Initialize database connection
    const dbHealthy = await checkDatabaseConnection();
    if (dbHealthy) {
      logger.info('Database connection verified');
    } else {
      logger.warn('Database connection failed, continuing without database for testing');
    }

    // Initialize Redis (with graceful fallback)
    try {
      await connectRedis();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.warn('Redis connection failed, continuing with in-memory cache:', error);
    }

    // Initialize cache
    await cacheManager.connect();
    logger.info('Cache connected successfully');

    // Warm cache with initial data
    await cacheManager.warmCache();
    logger.info('Cache warming completed');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
      logger.info(`🔒 Security enhancements: ENABLED`);
      logger.info(`⚡ Performance optimizations: ENABLED`);
    });

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
