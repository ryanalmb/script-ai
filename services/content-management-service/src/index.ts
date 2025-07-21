/**
 * Enterprise Content Management Service - Main Entry Point
 * Comprehensive microservice for content creation, media management, and AI generation
 */

// IMPORTANT: Module alias must be imported first
import './moduleAlias';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { config, securityConfig, validateConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { databaseService } from '@/services/database';
import { eventService } from '@/services/eventService';
import { contentService } from '@/services/contentService';
import { HealthCheck } from '@/types';

class ContentManagementService {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration - integrate with existing backend
    this.app.use(cors({
      origin: [
        process.env['FRONTEND_URL'] || 'http://localhost:3000',
        process.env['BACKEND_SERVICE_URL'] || 'http://localhost:3001',
        'http://localhost:3011', // User Management Service
        'http://localhost:3012', // Account Management Service
        'http://localhost:3013'  // Campaign Management Service
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          log.info(message.trim(), { operation: 'http_request' });
        }
      }
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: securityConfig.rateLimiting.windowMs,
      max: securityConfig.rateLimiting.maxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        log.security('Rate limit exceeded', {
          severity: 'medium',
          eventType: 'rate_limit_exceeded',
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          metadata: { path: req.path, method: req.method }
        });
        res.status(429).json({
          error: 'Too many requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }
    });

    this.app.use(limiter);

    // Content-specific rate limiting
    const contentLimiter = rateLimit({
      windowMs: securityConfig.rateLimiting.windowMs,
      max: securityConfig.rateLimiting.contentMaxRequests,
      keyGenerator: (req) => {
        // Use user ID from JWT token if available
        const userId = (req as any).user?.id || req.ip;
        return `content_ops:${userId}`;
      },
      message: {
        error: 'Too many content operations, please try again later.',
        code: 'CONTENT_RATE_LIMIT_EXCEEDED'
      }
    });

    this.app.use('/api/content', contentLimiter);
    this.app.use('/api/media', contentLimiter);
    this.app.use('/api/templates', contentLimiter);

    // Correlation ID middleware
    this.app.use((req, _res, next) => {
      const correlationId = req.headers['x-correlation-id'] as string || 
                           req.headers['correlation-id'] as string ||
                           `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      (req as any).correlationId = correlationId;
      next();
    });

    // Request timing middleware
    this.app.use((req, _res, next) => {
      (req as any).startTime = Date.now();
      next();
    });

    // File upload middleware
    const upload = multer({
      dest: 'uploads/',
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 10
      },
      fileFilter: (_req, file, cb) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/mpeg',
          'video/quicktime'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'));
        }
      }
    });

    this.app.use('/api/media/upload', upload.array('files', 10));
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (_req, res) => {
      try {
        const health = await this.getHealthCheck();
        const status = health.status === 'healthy' ? 200 : 503;
        res.status(status).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: (error as Error).message
        });
      }
    });

    // Ready check endpoint
    this.app.get('/ready', async (_req, res) => {
      try {
        const isReady = await this.checkReadiness();
        if (isReady) {
          res.status(200).json({ status: 'ready', timestamp: new Date() });
        } else {
          res.status(503).json({ status: 'not ready', timestamp: new Date() });
        }
      } catch (error) {
        res.status(503).json({ status: 'not ready', timestamp: new Date(), error: (error as Error).message });
      }
    });

    // Service info endpoint
    this.app.get('/info', (_req, res) => {
      res.json({
        name: config.name,
        version: config.version,
        environment: config.environment,
        uptime: process.uptime(),
        timestamp: new Date()
      });
    });

    // Content management endpoints
    this.app.post('/api/content', async (req, res) => {
      try {
        const { userId, ...contentData } = req.body;
        const correlationId = (req as any).correlationId;

        if (!userId) {
          return res.status(400).json({
            success: false,
            error: 'User ID is required',
            code: 'MISSING_USER_ID'
          });
        }

        const content = await contentService.createContent(userId, contentData, correlationId);
        
        return res.status(201).json({
          success: true,
          data: content,
          timestamp: new Date().toISOString(),
          correlationId
        });

      } catch (error) {
        log.error('Content creation failed', {
          operation: 'create_content_endpoint',
          correlationId: (req as any).correlationId,
          error: error as Error
        });

        return res.status(500).json({
          success: false,
          error: (error as Error).message,
          code: 'CONTENT_CREATION_FAILED',
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    this.app.get('/api/content/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const { status, type, campaignId, limit, offset } = req.query;
        const correlationId = (req as any).correlationId;

        const filters = {
          status: status as any,
          type: type as any,
          campaignId: campaignId as string,
          limit: limit ? parseInt(limit as string) : undefined,
          offset: offset ? parseInt(offset as string) : undefined
        };

        const result = await contentService.getUserContent(userId, filters, correlationId);

        return res.json({
          success: true,
          data: result.content,
          pagination: {
            total: result.total,
            limit: filters.limit || 50,
            offset: filters.offset || 0
          },
          timestamp: new Date().toISOString(),
          correlationId
        });

      } catch (error) {
        log.error('Failed to get user content', {
          operation: 'get_content_endpoint',
          correlationId: (req as any).correlationId,
          error: error as Error
        });

        return res.status(500).json({
          success: false,
          error: (error as Error).message,
          code: 'GET_CONTENT_FAILED',
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    this.app.get('/api/content/:userId/:contentId', async (req, res) => {
      try {
        const { userId, contentId } = req.params;
        const correlationId = (req as any).correlationId;

        const content = await contentService.getContent(contentId, userId, correlationId);

        if (!content) {
          return res.status(404).json({
            success: false,
            error: 'Content not found',
            code: 'CONTENT_NOT_FOUND',
            timestamp: new Date().toISOString(),
            correlationId
          });
        }

        return res.json({
          success: true,
          data: content,
          timestamp: new Date().toISOString(),
          correlationId
        });

      } catch (error) {
        log.error('Failed to get content', {
          operation: 'get_content_endpoint',
          correlationId: (req as any).correlationId,
          error: error as Error
        });

        return res.status(500).json({
          success: false,
          error: (error as Error).message,
          code: 'GET_CONTENT_FAILED',
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    this.app.put('/api/content/:userId/:contentId', async (req, res) => {
      try {
        const { userId, contentId } = req.params;
        const updates = req.body;
        const correlationId = (req as any).correlationId;

        const content = await contentService.updateContent(contentId, userId, updates, correlationId);

        return res.json({
          success: true,
          data: content,
          timestamp: new Date().toISOString(),
          correlationId
        });

      } catch (error) {
        log.error('Failed to update content', {
          operation: 'update_content_endpoint',
          correlationId: (req as any).correlationId,
          error: error as Error
        });

        return res.status(500).json({
          success: false,
          error: (error as Error).message,
          code: 'UPDATE_CONTENT_FAILED',
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    // AI content generation endpoint
    this.app.post('/api/content/generate', async (req, res) => {
      try {
        const { userId, ...generationRequest } = req.body;
        const correlationId = (req as any).correlationId;

        if (!userId) {
          return res.status(400).json({
            success: false,
            error: 'User ID is required',
            code: 'MISSING_USER_ID'
          });
        }

        const generatedContent = await contentService.generateContent(userId, generationRequest, correlationId);

        return res.json({
          success: true,
          data: generatedContent,
          timestamp: new Date().toISOString(),
          correlationId
        });

      } catch (error) {
        log.error('Failed to generate content', {
          operation: 'generate_content_endpoint',
          correlationId: (req as any).correlationId,
          error: error as Error
        });

        return res.status(500).json({
          success: false,
          error: (error as Error).message,
          code: 'CONTENT_GENERATION_FAILED',
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    // Content statistics endpoint
    this.app.get('/api/content/:userId/stats', async (req, res) => {
      try {
        const { userId } = req.params;
        const correlationId = (req as any).correlationId;

        const stats = await contentService.getContentStats(userId, correlationId);

        return res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString(),
          correlationId
        });

      } catch (error) {
        log.error('Failed to get content statistics', {
          operation: 'get_content_stats_endpoint',
          correlationId: (req as any).correlationId,
          error: error as Error
        });

        return res.status(500).json({
          success: false,
          error: (error as Error).message,
          code: 'GET_CONTENT_STATS_FAILED',
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const correlationId = (req as any).correlationId;

      log.error('Unhandled error in request', {
        operation: 'global_error_handler',
        correlationId,
        error: error as Error,
        metadata: {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        correlationId
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      log.error('Uncaught exception', {
        operation: 'uncaught_exception',
        error: error as Error
      });

      // Graceful shutdown
      this.shutdown().then(() => {
        process.exit(1);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled promise rejection', {
        operation: 'unhandled_rejection',
        error: reason as Error,
        metadata: { promise: promise.toString() }
      });
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      log.info('SIGTERM received, starting graceful shutdown', {
        operation: 'sigterm_handler'
      });
      this.shutdown();
    });

    // Handle SIGINT
    process.on('SIGINT', () => {
      log.info('SIGINT received, starting graceful shutdown', {
        operation: 'sigint_handler'
      });
      this.shutdown();
    });
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    const timer = createTimer('service_startup');

    try {
      log.info('Starting Content Management Service', {
        operation: 'service_startup',
        metadata: {
          name: config.name,
          version: config.version,
          environment: config.environment,
          port: config.port
        }
      });

      // Validate configuration
      validateConfig();

      // Connect to database
      log.info('Connecting to database...', { operation: 'service_startup' });
      await databaseService.connect();

      // Connect to event service (Kafka)
      log.info('Connecting to event service...', { operation: 'service_startup' });
      await eventService.connect();

      // Start HTTP server
      this.server = this.app.listen(config.port, config.host, () => {
        const duration = timer.end();

        log.info('Content Management Service started successfully', {
          operation: 'service_startup',
          duration,
          metadata: {
            host: config.host,
            port: config.port,
            environment: config.environment
          }
        });
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      timer.end();
      log.error('Failed to start Content Management Service', {
        operation: 'service_startup',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = () => {
      log.info('Starting graceful shutdown...', {
        operation: 'graceful_shutdown'
      });

      this.shutdown().then(() => {
        log.info('Graceful shutdown completed', {
          operation: 'graceful_shutdown'
        });
        process.exit(0);
      }).catch((error) => {
        log.error('Error during graceful shutdown', {
          operation: 'graceful_shutdown',
          error: error as Error
        });
        process.exit(1);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    const timer = createTimer('service_shutdown');

    try {
      log.info('Shutting down Content Management Service...', {
        operation: 'service_shutdown'
      });

      // Stop accepting new connections
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            log.info('HTTP server closed', { operation: 'service_shutdown' });
            resolve();
          });
        });
      }

      // Disconnect from event service
      try {
        await eventService.disconnect();
        log.info('Disconnected from event service', { operation: 'service_shutdown' });
      } catch (error) {
        log.warn('Error disconnecting from event service', {
          operation: 'service_shutdown',
          error: error as Error
        });
      }

      // Disconnect from database
      try {
        await databaseService.disconnect();
        log.info('Disconnected from database', { operation: 'service_shutdown' });
      } catch (error) {
        log.warn('Error disconnecting from database', {
          operation: 'service_shutdown',
          error: error as Error
        });
      }

      const duration = timer.end();

      log.info('Content Management Service shutdown completed', {
        operation: 'service_shutdown',
        duration
      });

    } catch (error) {
      timer.end();
      log.error('Error during service shutdown', {
        operation: 'service_shutdown',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get comprehensive health check
   */
  private async getHealthCheck(): Promise<HealthCheck> {
    try {
      const checks = {
        database: await databaseService.healthCheck(),
        redis: true, // Would implement Redis health check
        kafka: await eventService.healthCheck(),
        consul: true, // Would implement Consul health check
        llm: this.checkLLMServiceHealth(),
        storage: true // Would implement storage health check
      };

      const allHealthy = Object.values(checks).every(check => check === true);
      const status = allHealthy ? 'healthy' : 'unhealthy';

      // Get database metrics
      const dbMetrics = await databaseService.getMetrics();

      return {
        status,
        timestamp: new Date(),
        checks,
        metrics: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          totalContent: dbMetrics.contentCount,
          totalMedia: dbMetrics.mediaCount,
          totalTemplates: dbMetrics.templateCount,
          processingQueue: 0 // Would implement queue monitoring
        }
      };
    } catch (error) {
      log.error('Health check failed', {
        operation: 'health_check',
        error: error as Error
      });

      return {
        status: 'unhealthy',
        timestamp: new Date(),
        checks: {
          database: false,
          redis: false,
          kafka: false,
          consul: false,
          llm: false,
          storage: false
        },
        metrics: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          totalContent: 0,
          totalMedia: 0,
          totalTemplates: 0,
          processingQueue: 0
        }
      };
    }
  }

  /**
   * Check readiness
   */
  private async checkReadiness(): Promise<boolean> {
    try {
      const dbHealthy = await databaseService.healthCheck();
      const kafkaHealthy = await eventService.healthCheck();

      return dbHealthy && kafkaHealthy;
    } catch (error) {
      log.error('Readiness check failed', {
        operation: 'readiness_check',
        error: error as Error
      });
      return false;
    }
  }

  /**
   * Check LLM service health
   */
  private checkLLMServiceHealth(): boolean {
    // Simple check - would implement actual LLM service health check
    return config.llm.serviceUrl !== 'http://localhost:3003';
  }
}

// Create and start the service
const service = new ContentManagementService();

// Start the service
service.start().catch((error) => {
  log.error('Failed to start Content Management Service', {
    operation: 'service_startup',
    error: error as Error
  });
  process.exit(1);
});

// Export for testing
export { ContentManagementService };
