import { Request, Response, NextFunction, Router } from 'express';
import { logger } from '../utils/logger';
import { connectionManager } from '../config/connectionManager';
import { circuitBreakerRegistry } from './circuitBreaker';
import { timeoutMonitor } from './timeoutHandler';
import { cacheManager } from '../lib/cache';
import os from 'os';
import { performance } from 'perf_hooks';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: ServiceHealth;
  system: SystemHealth;
  performance: PerformanceMetrics;
  circuitBreakers: Record<string, any>;
  errors: string[];
}

interface ServiceHealth {
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    lastCheck: string;
    error?: string;
  };
  redis: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    lastCheck: string;
    error?: string;
  };
  xApi: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    lastCheck: string;
    error?: string;
  };
  llmService: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    lastCheck: string;
    error?: string;
  };
}

interface SystemHealth {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    available: number;
    total: number;
    percentage: number;
  };
}

interface PerformanceMetrics {
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  queueLength: number;
}

class HealthMonitor {
  private static instance: HealthMonitor;
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private activeConnections = 0;
  private readonly maxResponseTimeHistory = 1000;

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = performance.now();
      this.requestCount++;
      this.activeConnections++;

      res.on('finish', () => {
        const responseTime = performance.now() - startTime;
        this.recordResponseTime(responseTime);
        this.activeConnections--;

        if (res.statusCode >= 400) {
          this.errorCount++;
        }
      });

      next();
    };
  }

  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
  }

  public async getHealthStatus(): Promise<HealthStatus> {
    const services = await this.checkServices();
    const system = this.getSystemHealth();
    const performance = this.getPerformanceMetrics();
    const circuitBreakers = circuitBreakerRegistry.getAllStats();

    const errors: string[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Determine overall status based on CRITICAL services only
    // LLM service is optional and doesn't affect core health
    const criticalServices = ['database', 'redis', 'xApi'] as const;
    const criticalServiceStatuses = criticalServices.map(name => (services as any)[name]?.status).filter(Boolean);

    if (criticalServiceStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
      errors.push('One or more critical services are unhealthy');
    } else if (criticalServiceStatuses.includes('degraded')) {
      overallStatus = 'degraded';
      errors.push('One or more critical services are degraded');
    }

    // Add warning for optional services
    if ((services as any).llmService?.status === 'unhealthy') {
      errors.push('LLM service unavailable (non-critical)');
    }

    // Check system resources
    if (system.memory.percentage > 90) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      errors.push('High memory usage detected');
    }

    if (system.cpu.usage > 80) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      errors.push('High CPU usage detected');
    }

    // Check performance metrics
    if (performance.errorRate > 0.1) { // 10% error rate
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      errors.push('High error rate detected');
    }

    if (performance.averageResponseTime > 5000) { // 5 second average
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      errors.push('High response times detected');
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      system,
      performance,
      circuitBreakers,
      errors
    };
  }

  private async checkServices(): Promise<ServiceHealth> {
    const services: ServiceHealth = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      xApi: await this.checkXApi(),
      llmService: await this.checkLLMService()
    };

    return services;
  }

  private async checkDatabase(): Promise<ServiceHealth['database']> {
    const startTime = performance.now();
    try {
      const prisma = connectionManager.getPrisma();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = performance.now() - startTime;

      return {
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth['redis']> {
    const startTime = performance.now();
    try {
      // Check cache manager Redis status first (primary indicator)
      const cacheHealthy = await cacheManager.healthCheck();

      if (cacheHealthy) {
        // Cache manager has Redis working, that's what matters
        const responseTime = performance.now() - startTime;
        return {
          status: responseTime > 500 ? 'degraded' : 'healthy',
          responseTime,
          lastCheck: new Date().toISOString()
        };
      }

      // Fallback: check connection manager Redis
      const redis = connectionManager.getRedisIfAvailable();
      if (redis) {
        await redis.ping();
        const responseTime = performance.now() - startTime;
        return {
          status: responseTime > 500 ? 'degraded' : 'healthy',
          responseTime,
          lastCheck: new Date().toISOString()
        };
      }

      throw new Error('Redis not available in cache or connection manager');
    } catch (error: any) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkXApi(): Promise<ServiceHealth['xApi']> {
    const startTime = performance.now();
    try {
      // Simple check - you might want to implement actual X API health check
      const responseTime = performance.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private async checkLLMService(): Promise<ServiceHealth['llmService']> {
    const startTime = performance.now();
    try {
      // Check if LLM service is reachable
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${process.env.LLM_SERVICE_URL || 'http://localhost:3003'}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const responseTime = performance.now() - startTime;
      
      return {
        status: response.ok ? (responseTime > 2000 ? 'degraded' : 'healthy') : 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  private getSystemHealth(): SystemHealth {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
        loadAverage: os.loadavg()
      },
      disk: {
        available: 0, // Would need additional library to get disk usage
        total: 0,
        percentage: 0
      }
    };
  }

  private getPerformanceMetrics(): PerformanceMetrics {
    const uptime = (Date.now() - this.startTime) / 1000;
    const requestsPerSecond = this.requestCount / uptime;
    const errorRate = this.errorCount / this.requestCount || 0;
    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;

    return {
      requestsPerSecond,
      averageResponseTime,
      errorRate,
      activeConnections: this.activeConnections,
      queueLength: 0 // Would need to implement queue monitoring
    };
  }

  public reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.startTime = Date.now();
  }
}

export const healthMonitor = HealthMonitor.getInstance();

// Health check endpoints
export function createHealthRoutes() {
  const express = require('express');
  const router = express.Router();

  // Detailed health check - comprehensive status
  router.get('/', async (req: Request, res: Response) => {
    try {
      const health = await healthMonitor.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Liveness probe - basic health check
  router.get('/live', async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Readiness probe - comprehensive health check
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const health = await healthMonitor.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Detailed health information
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await healthMonitor.getHealthStatus();
      res.json(health);
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      res.status(500).json({
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}
