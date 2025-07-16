import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string | undefined;
  ip?: string | undefined;
  userId?: string | undefined;
  contentLength?: number | undefined;
  errorType?: string | undefined;
}

interface SystemMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
  };
  response: {
    averageTime: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errors: {
    total: number;
    rate: number; // error rate percentage
    byType: Record<string, number>;
    byStatus: Record<number, number>;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

class MetricsCollector extends EventEmitter {
  private static instance: MetricsCollector;
  private metrics: RequestMetrics[] = [];
  private readonly maxMetricsHistory = 10000;
  private readonly metricsWindow = 300000; // 5 minutes
  private startTime = Date.now();
  private intervalId?: NodeJS.Timeout;

  private constructor() {
    super();
    this.startPeriodicCleanup();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = performance.now();
      const timestamp = new Date();

      // Generate unique request ID
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      (req as any).requestId = requestId;

      res.on('finish', () => {
        const responseTime = performance.now() - startTime;
        
        const metric: RequestMetrics = {
          method: req.method,
          path: this.normalizePath(req.path),
          statusCode: res.statusCode,
          responseTime,
          timestamp,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: (req as any).user?.id,
          contentLength: parseInt(res.get('Content-Length') || '0'),
          errorType: res.statusCode >= 400 ? this.getErrorType(res.statusCode) : undefined
        };

        this.recordMetric(metric);
      });

      next();
    };
  }

  private normalizePath(path: string): string {
    // Replace IDs and UUIDs with placeholders for better grouping
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token');
  }

  private getErrorType(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown';
  }

  private recordMetric(metric: RequestMetrics): void {
    this.metrics.push(metric);
    
    // Emit metric event for real-time monitoring
    this.emit('metric', metric);
    
    // Emit alerts for critical metrics
    if (metric.statusCode >= 500) {
      this.emit('server_error', metric);
    }
    
    if (metric.responseTime > 10000) { // 10 seconds
      this.emit('slow_request', metric);
    }

    // Maintain metrics history size
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  public getMetrics(timeWindow?: number): SystemMetrics {
    const windowMs = timeWindow || this.metricsWindow;
    const cutoffTime = new Date(Date.now() - windowMs);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    if (recentMetrics.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalRequests = recentMetrics.length;
    const successfulRequests = recentMetrics.filter(m => m.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const timeWindowSeconds = windowMs / 1000;

    // Response time calculations
    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    const p50Index = Math.floor(responseTimes.length * 0.5);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Error analysis
    const errorsByType: Record<string, number> = {};
    const errorsByStatus: Record<number, number> = {};
    
    recentMetrics.filter(m => m.statusCode >= 400).forEach(m => {
      if (m.errorType) {
        errorsByType[m.errorType] = (errorsByType[m.errorType] || 0) + 1;
      }
      errorsByStatus[m.statusCode] = (errorsByStatus[m.statusCode] || 0) + 1;
    });

    return {
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        rate: totalRequests / timeWindowSeconds
      },
      response: {
        averageTime: averageResponseTime,
        p50: responseTimes[p50Index] || 0,
        p95: responseTimes[p95Index] || 0,
        p99: responseTimes[p99Index] || 0
      },
      errors: {
        total: failedRequests,
        rate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
        byType: errorsByType,
        byStatus: errorsByStatus
      },
      system: {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }

  private getEmptyMetrics(): SystemMetrics {
    return {
      requests: { total: 0, successful: 0, failed: 0, rate: 0 },
      response: { averageTime: 0, p50: 0, p95: 0, p99: 0 },
      errors: { total: 0, rate: 0, byType: {}, byStatus: {} },
      system: {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }

  public getEndpointMetrics(timeWindow?: number): Record<string, any> {
    const windowMs = timeWindow || this.metricsWindow;
    const cutoffTime = new Date(Date.now() - windowMs);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    const endpointStats: Record<string, any> = {};

    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.path}`;
      
      if (!endpointStats[key]) {
        endpointStats[key] = {
          requests: 0,
          errors: 0,
          totalResponseTime: 0,
          responseTimes: [],
          statusCodes: {}
        };
      }

      const stats = endpointStats[key];
      stats.requests++;
      stats.totalResponseTime += metric.responseTime;
      stats.responseTimes.push(metric.responseTime);
      stats.statusCodes[metric.statusCode] = (stats.statusCodes[metric.statusCode] || 0) + 1;
      
      if (metric.statusCode >= 400) {
        stats.errors++;
      }
    });

    // Calculate derived metrics
    Object.keys(endpointStats).forEach(key => {
      const stats = endpointStats[key];
      stats.averageResponseTime = stats.totalResponseTime / stats.requests;
      stats.errorRate = (stats.errors / stats.requests) * 100;
      
      // Calculate percentiles
      const sortedTimes = stats.responseTimes.sort((a: number, b: number) => a - b);
      stats.p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
      stats.p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
      stats.p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
      
      // Clean up raw data
      delete stats.totalResponseTime;
      delete stats.responseTimes;
    });

    return endpointStats;
  }

  public getSlowestEndpoints(limit = 10, timeWindow?: number): Array<{endpoint: string, averageTime: number, requests: number}> {
    const endpointMetrics = this.getEndpointMetrics(timeWindow);
    
    return Object.entries(endpointMetrics)
      .map(([endpoint, stats]: [string, any]) => ({
        endpoint,
        averageTime: stats.averageResponseTime,
        requests: stats.requests
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, limit);
  }

  public getErrorProneEndpoints(limit = 10, timeWindow?: number): Array<{endpoint: string, errorRate: number, errors: number}> {
    const endpointMetrics = this.getEndpointMetrics(timeWindow);
    
    return Object.entries(endpointMetrics)
      .map(([endpoint, stats]: [string, any]) => ({
        endpoint,
        errorRate: stats.errorRate,
        errors: stats.errors
      }))
      .filter(item => item.errors > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  private startPeriodicCleanup(): void {
    this.intervalId = setInterval(() => {
      const cutoffTime = new Date(Date.now() - this.metricsWindow * 2); // Keep 2x window for safety
      this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
      
      // Emit periodic metrics
      this.emit('periodic_metrics', this.getMetrics());
    }, 60000); // Clean up every minute
  }

  public exportPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const endpointMetrics = this.getEndpointMetrics();
    
    let output = '';
    
    // Request metrics
    output += `# HELP http_requests_total Total number of HTTP requests\n`;
    output += `# TYPE http_requests_total counter\n`;
    output += `http_requests_total{status="success"} ${metrics.requests.successful}\n`;
    output += `http_requests_total{status="error"} ${metrics.requests.failed}\n`;
    
    // Response time metrics
    output += `# HELP http_request_duration_seconds HTTP request duration in seconds\n`;
    output += `# TYPE http_request_duration_seconds histogram\n`;
    output += `http_request_duration_seconds_sum ${metrics.response.averageTime / 1000}\n`;
    output += `http_request_duration_seconds_count ${metrics.requests.total}\n`;
    
    // Error rate
    output += `# HELP http_error_rate HTTP error rate percentage\n`;
    output += `# TYPE http_error_rate gauge\n`;
    output += `http_error_rate ${metrics.errors.rate}\n`;
    
    // System metrics
    output += `# HELP process_uptime_seconds Process uptime in seconds\n`;
    output += `# TYPE process_uptime_seconds gauge\n`;
    output += `process_uptime_seconds ${metrics.system.uptime / 1000}\n`;
    
    output += `# HELP process_memory_usage_bytes Process memory usage in bytes\n`;
    output += `# TYPE process_memory_usage_bytes gauge\n`;
    output += `process_memory_usage_bytes{type="rss"} ${metrics.system.memoryUsage.rss}\n`;
    output += `process_memory_usage_bytes{type="heapUsed"} ${metrics.system.memoryUsage.heapUsed}\n`;
    output += `process_memory_usage_bytes{type="heapTotal"} ${metrics.system.memoryUsage.heapTotal}\n`;
    
    return output;
  }

  public reset(): void {
    this.metrics = [];
    this.startTime = Date.now();
  }

  public destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.removeAllListeners();
  }
}

export const metricsCollector = MetricsCollector.getInstance();

// Metrics endpoint middleware
export function createMetricsRoutes() {
  const express = require('express');
  const router = express.Router();

  // JSON metrics endpoint
  router.get('/', (req: Request, res: Response) => {
    const timeWindow = req.query.window ? parseInt(req.query.window as string) : undefined;
    const metrics = metricsCollector.getMetrics(timeWindow);
    res.json(metrics);
  });

  // Prometheus metrics endpoint
  router.get('/prometheus', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(metricsCollector.exportPrometheusMetrics());
  });

  // Endpoint-specific metrics
  router.get('/endpoints', (req: Request, res: Response) => {
    const timeWindow = req.query.window ? parseInt(req.query.window as string) : undefined;
    const endpointMetrics = metricsCollector.getEndpointMetrics(timeWindow);
    res.json(endpointMetrics);
  });

  // Slowest endpoints
  router.get('/slow', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const timeWindow = req.query.window ? parseInt(req.query.window as string) : undefined;
    const slowEndpoints = metricsCollector.getSlowestEndpoints(limit, timeWindow);
    res.json(slowEndpoints);
  });

  // Error-prone endpoints
  router.get('/errors', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const timeWindow = req.query.window ? parseInt(req.query.window as string) : undefined;
    const errorEndpoints = metricsCollector.getErrorProneEndpoints(limit, timeWindow);
    res.json(errorEndpoints);
  });

  return router;
}
