/**
 * Enterprise User Management Service - Main Entry Point
 * Comprehensive microservice with enterprise-grade infrastructure integration
 */

// IMPORTANT: Module alias must be imported first
import './moduleAlias';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config, securityConfig, validateConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { databaseService } from '@/services/database';
import { eventService } from '@/services/eventService';
import { authService } from '@/services/authService';
import { HealthCheck } from '@/types';

// Validate configuration on startup
validateConfig();

class UserManagementService {
  private app: express.Application;
  private server: any;
  private isShuttingDown: boolean = false;

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

    // CORS configuration
    this.app.use(cors({
      origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

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

    // Correlation ID middleware
    this.app.use((req, res, next) => {
      const correlationId = req.headers['x-correlation-id'] as string || 
                           req.headers['correlation-id'] as string ||
                           `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      (req as any).correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);
      next();
    });

    // Request timing middleware
    this.app.use((req, res, next) => {
      const timer = createTimer(`http_${req.method.toLowerCase()}_${req.path}`);
      
      res.on('finish', () => {
        const duration = timer.end();
        log.httpRequest(
          req.method,
          req.path,
          res.statusCode,
          duration,
          { correlationId: (req as any).correlationId }
        );
      });
      
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (_req, res) => {
      try {
        const healthCheck = await this.getHealthCheck();
        const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthCheck);
      } catch (error) {
        log.error('Health check failed', {
          operation: 'health_check',
          error: error as Error
        });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: 'Health check failed'
        });
      }
    });

    // Ready check endpoint
    this.app.get('/ready', async (_req, res) => {
      try {
        const isReady = await this.isServiceReady();
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
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      });
    });

    // Authentication routes
    this.app.post('/auth/register', async (req, res) => {
      try {
        const correlationId = (req as any).correlationId;
        const result = await authService.register(req.body, correlationId);
        res.status(201).json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
          correlationId
        });
      } catch (error) {
        log.error('Registration failed', {
          operation: 'auth_register',
          correlationId: (req as any).correlationId,
          error: error as Error
        });
        res.status(400).json({
          success: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    this.app.post('/auth/login', async (req, res) => {
      try {
        const correlationId = (req as any).correlationId;
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');
        
        const result = await authService.login(req.body, ipAddress, userAgent, correlationId);
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
          correlationId
        });
      } catch (error) {
        log.error('Login failed', {
          operation: 'auth_login',
          correlationId: (req as any).correlationId,
          error: error as Error
        });
        res.status(401).json({
          success: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    this.app.post('/auth/refresh', async (req, res) => {
      try {
        const correlationId = (req as any).correlationId;
        const { refreshToken } = req.body;
        
        const result = await authService.refreshToken(refreshToken, correlationId);
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
          correlationId
        });
      } catch (error) {
        log.error('Token refresh failed', {
          operation: 'auth_refresh',
          correlationId: (req as any).correlationId,
          error: error as Error
        });
        res.status(401).json({
          success: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
          correlationId: (req as any).correlationId
        });
      }
    });

    this.app.post('/auth/logout', async (req, res) => {
      try {
        const correlationId = (req as any).correlationId;
        const { refreshToken } = req.body;
        
        await authService.logout(refreshToken, correlationId);
        res.json({
          success: true,
          message: 'Logged out successfully',
          timestamp: new Date().toISOString(),
          correlationId
        });
      } catch (error) {
        log.error('Logout failed', {
          operation: 'auth_logout',
          correlationId: (req as any).correlationId,
          error: error as Error
        });
        res.status(400).json({
          success: false,
          error: (error as Error).message,
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
        operation: 'unhandled_error',
        correlationId,
        error,
        metadata: {
          method: req.method,
          path: req.path,
          body: req.body,
          query: req.query,
          headers: req.headers
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
        error
      });

      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled promise rejection', {
        operation: 'unhandled_rejection',
        error: reason as Error,
        metadata: { promise: promise.toString() }
      });

      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      log.info('Received SIGTERM signal', {
        operation: 'shutdown_signal'
      });
      this.gracefulShutdown('SIGTERM');
    });

    // Handle SIGINT
    process.on('SIGINT', () => {
      log.info('Received SIGINT signal', {
        operation: 'shutdown_signal'
      });
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * Get comprehensive health check
   */
  private async getHealthCheck(): Promise<HealthCheck> {

    try {
      // Check database health
      const databaseHealthy = await databaseService.healthCheck();

      // Check event service health
      const eventServiceHealthy = await eventService.healthCheck();

      // Determine overall status
      const allHealthy = databaseHealthy && eventServiceHealthy;
      const status = allHealthy ? 'healthy' : 'unhealthy';

      return {
        status,
        timestamp: new Date(),
        checks: {
          database: databaseHealthy,
          redis: true, // TODO: Implement Redis health check
          kafka: eventServiceHealthy,
          consul: true // TODO: Implement Consul health check
        },
        metrics: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
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
          consul: false
        },
        metrics: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      };
    }
  }

  /**
   * Check if service is ready to accept requests
   */
  private async isServiceReady(): Promise<boolean> {
    try {
      // Check if database is connected
      if (!databaseService.isConnectedToDatabase()) {
        return false;
      }

      // Check if event service is connected (if not disabled)
      const eventStatus = eventService.getConnectionStatus();
      if (!eventStatus.isDisabled && !eventStatus.isConnected) {
        return false;
      }

      return true;
    } catch (error) {
      log.error('Service readiness check failed', {
        operation: 'readiness_check',
        error: error as Error
      });
      return false;
    }
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    const timer = createTimer('service_startup');

    try {
      log.info('Starting User Management Service', {
        operation: 'service_startup',
        metadata: {
          name: config.name,
          version: config.version,
          environment: config.environment,
          port: config.port
        }
      });

      // Connect to database
      log.info('Connecting to database...', { operation: 'service_startup' });
      await databaseService.connect();

      // Connect to event service
      log.info('Connecting to event service...', { operation: 'service_startup' });
      await eventService.connect();

      // Start HTTP server
      this.server = this.app.listen(config.port, config.host, () => {
        const duration = timer.end();

        log.info('User Management Service started successfully', {
          operation: 'service_startup',
          duration,
          metadata: {
            host: config.host,
            port: config.port,
            environment: config.environment
          }
        });
      });

      // Handle server errors
      this.server.on('error', (error: Error) => {
        log.error('Server error', {
          operation: 'server_error',
          error
        });
      });

    } catch (error) {
      timer.end();
      log.error('Failed to start User Management Service', {
        operation: 'service_startup',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      log.warn('Shutdown already in progress', {
        operation: 'graceful_shutdown',
        metadata: { signal }
      });
      return;
    }

    this.isShuttingDown = true;
    const timer = createTimer('service_shutdown');

    log.info('Starting graceful shutdown', {
      operation: 'graceful_shutdown',
      metadata: { signal }
    });

    try {
      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          log.info('HTTP server closed', { operation: 'graceful_shutdown' });
        });
      }

      // Disconnect from event service
      await eventService.disconnect();

      // Disconnect from database
      await databaseService.disconnect();

      const duration = timer.end();

      log.info('Graceful shutdown completed', {
        operation: 'graceful_shutdown',
        duration,
        metadata: { signal }
      });

      process.exit(0);

    } catch (error) {
      timer.end();
      log.error('Error during graceful shutdown', {
        operation: 'graceful_shutdown',
        error: error as Error,
        metadata: { signal }
      });
      process.exit(1);
    }
  }
}

// Create and start the service
const userManagementService = new UserManagementService();

// Start the service
userManagementService.start().catch((error) => {
  log.error('Failed to start User Management Service', {
    operation: 'service_startup',
    error
  });
  process.exit(1);
});

export default userManagementService;
