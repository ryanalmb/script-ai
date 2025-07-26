import * as winston from 'winston';
import * as path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: any) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create logs directory if it doesn't exist
import * as fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export { logger };

// Helper functions for structured logging
export const logUserActivity = (userId: string, action: string, details?: any) => {
  logger.info('User activity', {
    userId,
    action,
    details,
    timestamp: new Date().toISOString(),
  });
};

export const logApiCall = (method: string, url: string, statusCode: number, responseTime: number, userId?: string) => {
  logger.http('API call', {
    method,
    url,
    statusCode,
    responseTime,
    userId,
    timestamp: new Date().toISOString(),
  });
};

export const logXApiCall = (endpoint: string, method: string, statusCode: number, accountId?: string) => {
  logger.info('X API call', {
    endpoint,
    method,
    statusCode,
    accountId,
    timestamp: new Date().toISOString(),
  });
};

export const logAutomationEvent = (automationId: string, event: string, details?: any) => {
  logger.info('Automation event', {
    automationId,
    event,
    details,
    timestamp: new Date().toISOString(),
  });
};

export const logSecurityEvent = (event: string, details: any, severity: 'low' | 'medium' | 'high' = 'medium') => {
  const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  
  logger[logLevel]('Security event', {
    event,
    details,
    severity,
    timestamp: new Date().toISOString(),
  });
};

export const logPerformanceMetric = (metric: string, value: number, unit: string, context?: any) => {
  logger.info('Performance metric', {
    metric,
    value,
    unit,
    context,
    timestamp: new Date().toISOString(),
  });
};

export const logError = (error: Error, context?: any) => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
};

export const logDatabaseQuery = (query: string, duration: number, recordCount?: number) => {
  logger.debug('Database query', {
    query,
    duration,
    recordCount,
    timestamp: new Date().toISOString(),
  });
};

export const logCacheOperation = (operation: 'hit' | 'miss' | 'set' | 'delete', key: string, ttl?: number) => {
  logger.debug('Cache operation', {
    operation,
    key,
    ttl,
    timestamp: new Date().toISOString(),
  });
};

// ============================================================================
// ENHANCED TWIKIT-SPECIFIC LOGGING FUNCTIONS
// ============================================================================

/**
 * Generate correlation ID for distributed tracing
 */
export const generateCorrelationId = (): string => {
  return `twikit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Sanitize sensitive data from objects
 */
export const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'auth', 'authorization',
    'cookie', 'session', 'credentials', 'apiKey', 'accessToken',
    'refreshToken', 'privateKey', 'clientSecret'
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
};

/**
 * Log Twikit action with comprehensive context
 */
export const logTwikitAction = (
  action: string,
  accountId: string,
  params: any,
  result: 'success' | 'failure' | 'retry',
  context: {
    correlationId?: string;
    sessionId?: string;
    proxyId?: string;
    duration?: number;
    attempt?: number;
    error?: Error;
    metadata?: Record<string, any>;
  } = {}
) => {
  const logLevel = result === 'failure' ? 'error' : result === 'retry' ? 'warn' : 'info';
  const correlationId = context.correlationId || generateCorrelationId();

  logger[logLevel]('Twikit action', {
    action,
    accountId,
    result,
    correlationId,
    sessionId: context.sessionId,
    proxyId: context.proxyId,
    duration: context.duration,
    attempt: context.attempt,
    params: sanitizeData(params),
    error: context.error ? {
      message: context.error.message,
      name: context.error.name,
      stack: context.error.stack
    } : undefined,
    metadata: context.metadata,
    timestamp: new Date().toISOString(),
  });

  return correlationId;
};

/**
 * Log Twikit session events
 */
export const logTwikitSession = (
  event: 'created' | 'destroyed' | 'authenticated' | 'failed' | 'health_check',
  sessionId: string,
  accountId: string,
  context: {
    correlationId?: string;
    proxyId?: string;
    duration?: number;
    error?: Error;
    healthScore?: number;
    metadata?: Record<string, any>;
  } = {}
) => {
  const logLevel = event === 'failed' ? 'error' : event === 'health_check' ? 'debug' : 'info';

  logger[logLevel]('Twikit session', {
    event,
    sessionId,
    accountId,
    correlationId: context.correlationId || generateCorrelationId(),
    proxyId: context.proxyId,
    duration: context.duration,
    healthScore: context.healthScore,
    error: context.error ? {
      message: context.error.message,
      name: context.error.name,
      type: (context.error as any).type || 'unknown'
    } : undefined,
    metadata: context.metadata,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log rate limiting events
 */
export const logRateLimit = (
  event: 'allowed' | 'blocked' | 'queued' | 'reset',
  action: string,
  accountId: string,
  context: {
    correlationId?: string;
    remaining?: number;
    resetTime?: Date;
    retryAfter?: number;
    priority?: string;
    queuePosition?: number;
  } = {}
) => {
  const logLevel = event === 'blocked' ? 'warn' : 'info';

  logger[logLevel]('Rate limit', {
    event,
    action,
    accountId,
    correlationId: context.correlationId || generateCorrelationId(),
    remaining: context.remaining,
    resetTime: context.resetTime?.toISOString(),
    retryAfter: context.retryAfter,
    priority: context.priority,
    queuePosition: context.queuePosition,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log proxy rotation events
 */
export const logProxyRotation = (
  event: 'rotated' | 'failed' | 'health_check',
  sessionId: string,
  context: {
    correlationId?: string;
    oldProxyId?: string;
    newProxyId?: string;
    reason?: string;
    healthScore?: number;
    error?: Error;
  } = {}
) => {
  const logLevel = event === 'failed' ? 'error' : 'info';

  logger[logLevel]('Proxy rotation', {
    event,
    sessionId,
    correlationId: context.correlationId || generateCorrelationId(),
    oldProxyId: context.oldProxyId,
    newProxyId: context.newProxyId,
    reason: context.reason,
    healthScore: context.healthScore,
    error: context.error ? {
      message: context.error.message,
      name: context.error.name
    } : undefined,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log performance metrics for Twikit operations
 */
export const logTwikitPerformance = (
  operation: string,
  accountId: string,
  metrics: {
    duration: number;
    success: boolean;
    retryCount?: number;
    queueTime?: number;
    networkTime?: number;
    processingTime?: number;
    correlationId?: string;
  }
) => {
  logger.info('Twikit performance', {
    operation,
    accountId,
    correlationId: metrics.correlationId || generateCorrelationId(),
    duration: metrics.duration,
    success: metrics.success,
    retryCount: metrics.retryCount || 0,
    queueTime: metrics.queueTime,
    networkTime: metrics.networkTime,
    processingTime: metrics.processingTime,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log circuit breaker events
 */
export const logCircuitBreaker = (
  event: 'opened' | 'closed' | 'half_open' | 'trip',
  service: string,
  context: {
    correlationId?: string;
    accountId?: string;
    failureCount?: number;
    threshold?: number;
    timeout?: number;
    error?: Error;
  } = {}
) => {
  const logLevel = event === 'opened' || event === 'trip' ? 'warn' : 'info';

  logger[logLevel]('Circuit breaker', {
    event,
    service,
    correlationId: context.correlationId || generateCorrelationId(),
    accountId: context.accountId,
    failureCount: context.failureCount,
    threshold: context.threshold,
    timeout: context.timeout,
    error: context.error ? {
      message: context.error.message,
      name: context.error.name
    } : undefined,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log audit trail for compliance
 */
export const logAuditTrail = (
  action: string,
  userId: string,
  accountId: string,
  details: {
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string;
    result: 'success' | 'failure';
    resourceId?: string;
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
  }
) => {
  logger.info('Audit trail', {
    action,
    userId,
    accountId,
    correlationId: details.correlationId || generateCorrelationId(),
    ipAddress: details.ipAddress,
    userAgent: details.userAgent,
    result: details.result,
    resourceId: details.resourceId,
    changes: sanitizeData(details.changes),
    metadata: details.metadata,
    timestamp: new Date().toISOString(),
  });
};
