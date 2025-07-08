import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { cacheManager } from '../lib/cache';

// Metrics collection interface
interface Metrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    averageResponseTime: number;
  };
  endpoints: Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    lastAccessed: Date;
  }>;
  errors: Array<{
    timestamp: Date;
    path: string;
    method: string;
    statusCode: number;
    error: string;
    userAgent?: string;
    ip?: string;
  }>;
  performance: {
    slowRequests: Array<{
      timestamp: Date;
      path: string;
      method: string;
      duration: number;
      ip?: string;
    }>;
  };
}

// Global metrics store
const metrics: Metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    averageResponseTime: 0
  },
  endpoints: new Map(),
  errors: [],
  performance: {
    slowRequests: []
  }
};

// Configuration
const SLOW_REQUEST_THRESHOLD = 5000; // 5 seconds
const MAX_ERROR_HISTORY = 100;
const MAX_SLOW_REQUEST_HISTORY = 50;
const METRICS_CACHE_TTL = 300; // 5 minutes

/**
 * Request monitoring middleware
 */
export const requestMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;

  // Track request start
  metrics.requests.total++;

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Update metrics
    updateRequestMetrics(endpoint, duration, statusCode, req);

    // Log slow requests
    if (duration > SLOW_REQUEST_THRESHOLD) {
      logSlowRequest(req, duration);
    }

    // Log errors
    if (statusCode >= 400) {
      logErrorRequest(req, statusCode, duration);
    }

    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Update request metrics
 */
function updateRequestMetrics(endpoint: string, duration: number, statusCode: number, req: Request) {
  // Update global metrics
  if (statusCode < 400) {
    metrics.requests.success++;
  } else {
    metrics.requests.errors++;
  }

  // Update average response time
  const totalRequests = metrics.requests.total;
  const currentAvg = metrics.requests.averageResponseTime;
  metrics.requests.averageResponseTime = ((currentAvg * (totalRequests - 1)) + duration) / totalRequests;

  // Update endpoint-specific metrics
  const endpointMetrics = metrics.endpoints.get(endpoint) || {
    count: 0,
    totalTime: 0,
    errors: 0,
    lastAccessed: new Date()
  };

  endpointMetrics.count++;
  endpointMetrics.totalTime += duration;
  endpointMetrics.lastAccessed = new Date();

  if (statusCode >= 400) {
    endpointMetrics.errors++;
  }

  metrics.endpoints.set(endpoint, endpointMetrics);

  // Cache metrics for external monitoring
  cacheMetrics();
}

/**
 * Log slow requests
 */
function logSlowRequest(req: Request, duration: number) {
  const slowRequest = {
    timestamp: new Date(),
    path: req.path,
    method: req.method,
    duration,
    ip: req.ip || 'unknown'
  };

  metrics.performance.slowRequests.push(slowRequest);

  // Keep only recent slow requests
  if (metrics.performance.slowRequests.length > MAX_SLOW_REQUEST_HISTORY) {
    metrics.performance.slowRequests.shift();
  }

  logger.warn('Slow request detected', {
    path: req.path,
    method: req.method,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Alert if too many slow requests
  const recentSlowRequests = metrics.performance.slowRequests.filter(
    r => Date.now() - r.timestamp.getTime() < 300000 // Last 5 minutes
  );

  if (recentSlowRequests.length > 10) {
    logger.error('High number of slow requests detected', {
      count: recentSlowRequests.length,
      threshold: '5 minutes',
      averageDuration: recentSlowRequests.reduce((sum, r) => sum + r.duration, 0) / recentSlowRequests.length
    });
  }
}

/**
 * Log error requests
 */
function logErrorRequest(req: Request, statusCode: number, duration: number) {
  const errorEntry = {
    timestamp: new Date(),
    path: req.path,
    method: req.method,
    statusCode,
    error: `HTTP ${statusCode}`,
    userAgent: req.get('User-Agent') || 'unknown',
    ip: req.ip || 'unknown'
  };

  metrics.errors.push(errorEntry);

  // Keep only recent errors
  if (metrics.errors.length > MAX_ERROR_HISTORY) {
    metrics.errors.shift();
  }

  // Log based on severity
  if (statusCode >= 500) {
    logger.error('Server error', {
      path: req.path,
      method: req.method,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  } else if (statusCode >= 400) {
    logger.warn('Client error', {
      path: req.path,
      method: req.method,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  }

  // Alert on high error rates
  const recentErrors = metrics.errors.filter(
    e => Date.now() - e.timestamp.getTime() < 300000 // Last 5 minutes
  );

  const errorRate = recentErrors.length / metrics.requests.total;
  if (errorRate > 0.1) { // More than 10% error rate
    logger.error('High error rate detected', {
      errorRate: `${(errorRate * 100).toFixed(2)}%`,
      recentErrors: recentErrors.length,
      totalRequests: metrics.requests.total
    });
  }
}

/**
 * Cache metrics for external monitoring
 */
async function cacheMetrics() {
  try {
    const metricsSnapshot = {
      timestamp: new Date().toISOString(),
      requests: metrics.requests,
      endpoints: Object.fromEntries(metrics.endpoints),
      recentErrors: metrics.errors.slice(-10), // Last 10 errors
      recentSlowRequests: metrics.performance.slowRequests.slice(-10) // Last 10 slow requests
    };

    await cacheManager.set('application:metrics', metricsSnapshot, METRICS_CACHE_TTL);
  } catch (error) {
    logger.error('Failed to cache metrics:', error);
  }
}

/**
 * Get current metrics
 */
export function getMetrics() {
  return {
    ...metrics,
    endpoints: Object.fromEntries(metrics.endpoints)
  };
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics() {
  metrics.requests = {
    total: 0,
    success: 0,
    errors: 0,
    averageResponseTime: 0
  };
  metrics.endpoints.clear();
  metrics.errors = [];
  metrics.performance.slowRequests = [];
}

/**
 * Memory monitoring
 */
export function getMemoryMetrics() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
    heapUsedPercentage: Math.round((usage.heapUsed / usage.heapTotal) * 100)
  };
}

/**
 * System monitoring
 */
export function getSystemMetrics() {
  return {
    uptime: process.uptime(),
    cpuUsage: process.cpuUsage(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    pid: process.pid
  };
}

/**
 * Alert system
 */
export class AlertManager {
  private static alerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }> = [];

  static createAlert(type: 'error' | 'warning' | 'info', message: string) {
    const alert = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);

    // Log alert
    logger[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info']('Alert created', {
      alertId: alert.id,
      type: alert.type,
      message: alert.message
    });

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    return alert.id;
  }

  static resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info('Alert resolved', { alertId, message: alert.message });
    }
  }

  static getActiveAlerts() {
    return this.alerts.filter(a => !a.resolved);
  }

  static getAllAlerts() {
    return this.alerts;
  }
}

/**
 * Metrics endpoint middleware
 */
export const metricsEndpoint = (req: Request, res: Response) => {
  const metrics = getMetrics();
  const memory = getMemoryMetrics();
  const system = getSystemMetrics();
  const alerts = AlertManager.getActiveAlerts();

  res.json({
    timestamp: new Date().toISOString(),
    metrics,
    memory,
    system,
    alerts,
    health: {
      status: alerts.filter(a => a.type === 'error').length > 0 ? 'unhealthy' : 'healthy',
      activeAlerts: alerts.length
    }
  });
};
