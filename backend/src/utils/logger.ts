import winston from 'winston';
import path from 'path';

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
import fs from 'fs';
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
