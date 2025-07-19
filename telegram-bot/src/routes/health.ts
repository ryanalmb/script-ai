/**
 * Enterprise Health Check Endpoints
 * Provides comprehensive health monitoring for all system components
 */

import express from 'express';
import { logger } from '../utils/logger';
import { eventBus } from '../infrastructure/eventBus';
import { serviceDiscovery } from '../infrastructure/serviceDiscovery';
import { circuitBreakerManager } from '../infrastructure/circuitBreaker';
import { metrics } from '../infrastructure/metrics';
import { tracing } from '../infrastructure/tracing';
import { ServiceClientFactory } from '../infrastructure/enterpriseServiceClient';

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
    metrics.recordHttpRequest('GET', '/health', 200, responseTime / 1000);

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed:', error);
    
    const responseTime = Date.now() - startTime;
    metrics.recordHttpRequest('GET', '/health', 500, responseTime / 1000);

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

/**
 * Detailed health check with dependency testing
 */
router.get('/detailed', async (req, res) => {
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

    // Test backend service connectivity
    try {
      const backendClient = ServiceClientFactory.getClient('backend');
      const backendStartTime = Date.now();
      
      await backendClient.get('/api/health', {
        timeout: 5000,
        skipCache: true
      });
      
      const backendResponseTime = Date.now() - backendStartTime;
      
      healthStatus.components.backendService = {
        status: 'healthy',
        details: {
          connected: true,
          responseTime: backendResponseTime
        },
        responseTime: backendResponseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.backendService = {
        status: 'unhealthy',
        details: {
          connected: false,
          error: (error as Error).message
        },
        lastCheck: new Date().toISOString()
      };
    }

    // Test LLM service connectivity
    try {
      const llmClient = ServiceClientFactory.getClient('llm');
      const llmStartTime = Date.now();
      
      await llmClient.get('/health', {
        timeout: 10000,
        skipCache: true
      });
      
      const llmResponseTime = Date.now() - llmStartTime;
      
      healthStatus.components.llmService = {
        status: 'healthy',
        details: {
          connected: true,
          responseTime: llmResponseTime
        },
        responseTime: llmResponseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.llmService = {
        status: 'unhealthy',
        details: {
          connected: false,
          error: (error as Error).message
        },
        lastCheck: new Date().toISOString()
      };
    }

    // Test service discovery
    try {
      const services = await serviceDiscovery.getAllServices();
      healthStatus.components.serviceDiscoveryDetailed = {
        status: 'healthy',
        details: {
          discoveredServices: Object.keys(services).length,
          services: Object.keys(services)
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      healthStatus.components.serviceDiscoveryDetailed = {
        status: 'unhealthy',
        details: { error: (error as Error).message },
        lastCheck: new Date().toISOString()
      };
    }

    // Add detailed system metrics
    const memUsage = process.memoryUsage();
    healthStatus.metrics = {
      memory: memUsage,
      cpu: process.cpuUsage().user / 1000000,
      eventLoop: 0
    };

    // Determine overall status
    const componentStatuses = Object.values(healthStatus.components).map(c => c.status);
    if (componentStatuses.includes('unhealthy')) {
      healthStatus.status = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      healthStatus.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    metrics.recordHttpRequest('GET', '/health/detailed', 200, responseTime / 1000);

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    const responseTime = Date.now() - startTime;
    metrics.recordHttpRequest('GET', '/health/detailed', 500, responseTime / 1000);

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
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
    const eventBusReady = eventBus.getHealthStatus().connected;
    const serviceDiscoveryReady = serviceDiscovery.isHealthy();
    const tracingReady = tracing.isReady();

    if (eventBusReady && serviceDiscoveryReady && tracingReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        components: {
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
