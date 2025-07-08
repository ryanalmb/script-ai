import { Router, Request, Response } from 'express';
import { checkDatabaseConnection, getDatabaseMetrics } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { logger } from '../utils/logger';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    external_apis: ServiceHealth;
  };
  metrics?: {
    database: any;
    memory: NodeJS.MemoryUsage;
    cpu: any;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

/**
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Check database health
    const dbStartTime = Date.now();
    const dbHealthy = await checkDatabaseConnection();
    const dbResponseTime = Date.now() - dbStartTime;

    // Check cache health
    const cacheStartTime = Date.now();
    const cacheHealthy = await cacheManager.healthCheck();
    const cacheResponseTime = Date.now() - cacheStartTime;

    // Check external APIs (simplified)
    const externalApiHealth = await checkExternalApis();

    // Determine overall status
    const allServicesHealthy = dbHealthy && cacheHealthy && externalApiHealth.status === 'healthy';
    const anyServiceDegraded = !dbHealthy || !cacheHealthy || externalApiHealth.status === 'degraded';
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (allServicesHealthy) {
      overallStatus = 'healthy';
    } else if (anyServiceDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          responseTime: dbResponseTime,
          lastCheck: new Date().toISOString(),
          ...(dbHealthy ? {} : { error: 'Database connection failed' })
        },
        cache: {
          status: cacheHealthy ? 'healthy' : 'unhealthy',
          responseTime: cacheResponseTime,
          lastCheck: new Date().toISOString(),
          ...(cacheHealthy ? {} : { error: 'Cache connection failed' })
        },
        external_apis: externalApiHealth
      }
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      error: 'Health check system error',
      services: {
        database: { status: 'unknown', lastCheck: new Date().toISOString() },
        cache: { status: 'unknown', lastCheck: new Date().toISOString() },
        external_apis: { status: 'unknown', lastCheck: new Date().toISOString() }
      }
    });
  }
});

/**
 * Detailed health check with metrics
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    // Get basic health (simplified for detailed endpoint)
    const basicHealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    };

    // Add detailed metrics
    const dbMetrics = await getDatabaseMetrics();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const detailedHealth = {
      ...basicHealthResponse,
      metrics: {
        database: dbMetrics,
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          arrayBuffers: `${Math.round(memoryUsage.arrayBuffers / 1024 / 1024)}MB`
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        process: {
          pid: process.pid,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version
        }
      }
    };

    res.json(detailedHealth);

  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Detailed health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if application is ready to serve traffic
    const dbHealthy = await checkDatabaseConnection();
    const cacheHealthy = await cacheManager.healthCheck();

    if (dbHealthy && cacheHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        issues: {
          database: dbHealthy ? 'ok' : 'not ready',
          cache: cacheHealthy ? 'ok' : 'not ready'
        }
      });
    }

  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe for Kubernetes
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Check external API health
 */
async function checkExternalApis(): Promise<ServiceHealth> {
  try {
    // Check X API availability (simplified)
    const xApiHealthy = process.env.X_API_KEY && process.env.X_API_SECRET;
    
    // Check other external services
    const huggingFaceHealthy = process.env.HUGGINGFACE_API_KEY;
    
    if (xApiHealthy && huggingFaceHealthy) {
      return {
        status: 'healthy',
        lastCheck: new Date().toISOString()
      };
    } else if (xApiHealthy || huggingFaceHealthy) {
      return {
        status: 'degraded',
        lastCheck: new Date().toISOString(),
        error: 'Some external APIs not configured'
      };
    } else {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        error: 'External APIs not configured'
      };
    }

  } catch (error) {
    return {
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      error: 'External API check failed'
    };
  }
}

export default router;
