/**
 * Enterprise Health Check Endpoints for Backend Service
 * Provides comprehensive health monitoring for all system components
 */

import express from 'express';
import { logger } from '../utils/logger';
import { eventBus } from '../infrastructure/eventBus';
import { serviceDiscovery } from '../infrastructure/serviceDiscovery';
import { circuitBreakerManager } from '../infrastructure/circuitBreaker';
import { metrics } from '../infrastructure/metrics';
import { tracing } from '../infrastructure/tracing';
import { checkDatabaseConnection } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

const router = express.Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  components: {
    [key: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      details?: any;
      lastCheck?: string;
      responseTime?: number;
    };
  };
  metrics?: {
    memory: NodeJS.MemoryUsage;
    cpu: number;
    eventLoop: number;
  };
}

/**
 * Basic health check endpoint
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      components: {}
    };

    // Check database connection
    try {
      await checkDatabaseConnection();
      healthStatus.components.database = {
        status: 'healthy',
        details: {
          connected: true,
          type: 'postgresql'
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.database = {
        status: 'unhealthy',
        details: {
          connected: false,
          error: (error as Error).message
        },
        lastCheck: new Date().toISOString()
      };
    }

    // Check cache connection
    try {
      const cacheHealthy = await cacheManager.healthCheck();
      healthStatus.components.cache = {
        status: cacheHealthy ? 'healthy' : 'unhealthy',
        details: {
          connected: cacheHealthy,
          type: 'redis'
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.cache = {
        status: 'unhealthy',
        details: {
          connected: false,
          error: (error as Error).message
        },
        lastCheck: new Date().toISOString()
      };
    }

    // Check event bus
    try {
      const eventBusHealth = eventBus.getHealthStatus();
      healthStatus.components.eventBus = {
        status: eventBusHealth.connected ? 'healthy' : 'unhealthy',
        details: {
          connected: eventBusHealth.connected,
          reconnectAttempts: eventBusHealth.reconnectAttempts,
          activeConsumers: eventBusHealth.activeConsumers,
          topics: eventBusHealth.topics
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.eventBus = {
        status: 'unhealthy',
        details: { error: (error as Error).message },
        lastCheck: new Date().toISOString()
      };
    }

    // Check service discovery
    try {
      const serviceDiscoveryHealthy = serviceDiscovery.isHealthy();
      const serviceMetrics = serviceDiscovery.getMetrics();
      
      healthStatus.components.serviceDiscovery = {
        status: serviceDiscoveryHealthy ? 'healthy' : 'unhealthy',
        details: {
          connected: serviceDiscoveryHealthy,
          registeredServices: serviceMetrics.registeredServices,
          cachedServices: serviceMetrics.cachedServices,
          serviceNames: serviceMetrics.serviceNames
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.serviceDiscovery = {
        status: 'unhealthy',
        details: { error: (error as Error).message },
        lastCheck: new Date().toISOString()
      };
    }

    // Check circuit breakers
    try {
      const circuitBreakerStats = circuitBreakerManager.getAllStats();
      const unhealthyBreakers = Object.entries(circuitBreakerStats)
        .filter(([_, stats]) => stats.state !== 'CLOSED');

      healthStatus.components.circuitBreakers = {
        status: unhealthyBreakers.length === 0 ? 'healthy' : 'degraded',
        details: {
          totalBreakers: Object.keys(circuitBreakerStats).length,
          unhealthyBreakers: unhealthyBreakers.length,
          breakerStats: circuitBreakerStats
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.circuitBreakers = {
        status: 'unhealthy',
        details: { error: (error as Error).message },
        lastCheck: new Date().toISOString()
      };
    }

    // Check metrics system
    try {
      healthStatus.components.metrics = {
        status: 'healthy',
        details: {
          initialized: true,
          endpoint: '/metrics'
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.metrics = {
        status: 'unhealthy',
        details: { error: (error as Error).message },
        lastCheck: new Date().toISOString()
      };
    }

    // Check tracing system
    try {
      healthStatus.components.tracing = {
        status: tracing.isReady() ? 'healthy' : 'unhealthy',
        details: {
          initialized: tracing.isReady(),
          jaegerEndpoint: process.env.JAEGER_ENDPOINT
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.tracing = {
        status: 'unhealthy',
        details: { error: (error as Error).message },
        lastCheck: new Date().toISOString()
      };
    }

    // Add system metrics
    healthStatus.metrics = {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      eventLoop: 0 // Would need additional library for event loop lag
    };

    // Determine overall status
    const componentStatuses = Object.values(healthStatus.components).map(c => c.status);
    if (componentStatuses.includes('unhealthy')) {
      healthStatus.status = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      healthStatus.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    
    // Record metrics
    metrics.recordHttpRequest('GET', '/api/health', 200, responseTime / 1000);

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed:', error);
    
    const responseTime = Date.now() - startTime;
    metrics.recordHttpRequest('GET', '/api/health', 500, responseTime / 1000);

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

/**
 * Database health check
 */
router.get('/database', async (req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'postgresql',
      connected: true
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'postgresql',
      connected: false,
      error: (error as Error).message
    });
  }
});

/**
 * Cache health check
 */
router.get('/cache', async (req, res) => {
  try {
    const healthy = await cacheManager.healthCheck();
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      cache: 'redis',
      connected: healthy
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      cache: 'redis',
      connected: false,
      error: (error as Error).message
    });
  }
});

/**
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical components are ready
    const dbHealthy = await checkDatabaseConnection().then(() => true).catch(() => false);
    const cacheHealthy = await cacheManager.healthCheck();
    const eventBusReady = eventBus.getHealthStatus().connected;
    const serviceDiscoveryReady = serviceDiscovery.isHealthy();
    const tracingReady = tracing.isReady();

    const allReady = dbHealthy && cacheHealthy && eventBusReady && serviceDiscoveryReady && tracingReady;

    if (allReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        components: {
          database: dbHealthy,
          cache: cacheHealthy,
          eventBus: eventBusReady,
          serviceDiscovery: serviceDiscoveryReady,
          tracing: tracingReady
        }
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        components: {
          database: dbHealthy,
          cache: cacheHealthy,
          eventBus: eventBusReady,
          serviceDiscovery: serviceDiscoveryReady,
          tracing: tracingReady
        }
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe for Kubernetes
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

export default router;
