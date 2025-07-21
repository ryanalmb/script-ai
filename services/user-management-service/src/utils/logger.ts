/**
 * Enterprise User Management Service - Logging System
 * Comprehensive logging with structured output, correlation IDs, and enterprise features
 */

import winston from 'winston';
import { loggingConfig, serviceInfo, enterpriseConfig } from '@/config';

// Custom log levels for enterprise logging
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    audit: 3,
    security: 4,
    debug: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    audit: 'blue',
    security: 'magenta',
    debug: 'gray'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info: any) => {
    const logEntry: Record<string, any> = {
      timestamp: info['timestamp'],
      level: info.level,
      service: serviceInfo.name,
      version: serviceInfo.version,
      environment: serviceInfo.environment,
      message: info.message
    };

    // Add optional fields if they exist
    const correlationId = info['correlationId'];
    const userId = info['userId'];
    const operation = info['operation'];
    const duration = info['duration'];
    const metadata = info['metadata'];
    const error = info['error'];

    if (correlationId) logEntry['correlationId'] = correlationId;
    if (userId) logEntry['userId'] = userId;
    if (operation) logEntry['operation'] = operation;
    if (duration) logEntry['duration'] = duration;
    if (metadata) logEntry['metadata'] = metadata;
    if (error) {
      const errorObj = error as Error;
      logEntry['error'] = {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack
      };
    }

    return JSON.stringify(logEntry);
  })
);

// Simple format for development
const simpleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf((info: any) => {
    const correlationIdValue = info['correlationId'];
    const userIdValue = info['userId'];
    const operationValue = info['operation'];
    const timestampValue = info['timestamp'];

    const correlationId = correlationIdValue ? `[${correlationIdValue}]` : '';
    const userId = userIdValue ? `[user:${userIdValue}]` : '';
    const operation = operationValue ? `[${operationValue}]` : '';

    return `${timestampValue} ${info.level}: ${correlationId}${userId}${operation} ${info.message}`;
  })
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: loggingConfig.format === 'json' ? structuredFormat : simpleFormat
  })
];

// Add file transports for production
if (serviceInfo.environment === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: structuredFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: structuredFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  );

  // Add audit log for enterprise mode
  if (enterpriseConfig.auditLogging) {
    transports.push(
      new winston.transports.File({
        filename: 'logs/audit.log',
        level: 'audit',
        format: structuredFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 20
      })
    );
  }

  // Add security log for enterprise mode
  if (enterpriseConfig.securityMonitoring) {
    transports.push(
      new winston.transports.File({
        filename: 'logs/security.log',
        level: 'security',
        format: structuredFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 30
      })
    );
  }
}

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: loggingConfig.level,
  format: structuredFormat,
  transports,
  exitOnError: false
});

// Enhanced logging interface
interface LogContext {
  correlationId?: string | undefined;
  userId?: string | undefined;
  operation?: string | undefined;
  duration?: number | undefined;
  metadata?: Record<string, any> | undefined;
  error?: Error | undefined;
}

class EnterpriseLogger {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  error(message: string, context?: LogContext): void {
    this.logger.error(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }

  // Enterprise-specific logging methods
  audit(message: string, context: LogContext & { action: string; resource: string }): void {
    const auditContext: any = {
      ...context,
      auditType: 'user_action',
      timestamp: new Date().toISOString()
    };
    this.logger.log('audit', message, auditContext);
  }

  security(message: string, context: LogContext & {
    severity: 'low' | 'medium' | 'high' | 'critical';
    eventType: string;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): void {
    const securityContext: any = {
      ...context,
      securityEvent: true,
      timestamp: new Date().toISOString()
    };
    this.logger.log('security', message, securityContext);
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext | undefined): void {
    const perfContext: any = {
      ...context,
      operation,
      duration,
      performanceMetric: true
    };
    this.info(`Operation completed: ${operation}`, perfContext);
  }

  // Business event logging
  business(event: string, context: LogContext & { eventData: Record<string, any> }): void {
    const businessContext: any = {
      ...context,
      businessEvent: true,
      event
    };
    this.info(`Business event: ${event}`, businessContext);
  }

  // HTTP request logging
  httpRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext | undefined): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    const httpContext: any = {
      ...context,
      httpRequest: true,
      method,
      url,
      statusCode,
      duration
    };
    this.logger.log(level, `${method} ${url} ${statusCode}`, httpContext);
  }

  // Database operation logging
  database(operation: string, table: string, duration: number, context?: LogContext | undefined): void {
    const dbContext: any = {
      ...context,
      databaseOperation: true,
      operation,
      table,
      duration
    };
    this.debug(`Database operation: ${operation} on ${table}`, dbContext);
  }

  // External service logging
  externalService(service: string, operation: string, success: boolean, duration: number, context?: LogContext | undefined): void {
    const level = success ? 'info' : 'warn';
    const serviceContext: any = {
      ...context,
      externalService: true,
      service,
      operation,
      success,
      duration
    };
    this.logger.log(level, `External service call: ${service}.${operation}`, serviceContext);
  }

  // Event publishing logging
  eventPublished(eventType: string, eventId: string, context?: LogContext | undefined): void {
    const eventContext: any = {
      ...context,
      eventPublished: true,
      eventType,
      eventId
    };
    this.info(`Event published: ${eventType}`, eventContext);
  }

  // Event consumption logging
  eventConsumed(eventType: string, eventId: string, success: boolean, context?: LogContext | undefined): void {
    const level = success ? 'info' : 'error';
    const consumeContext: any = {
      ...context,
      eventConsumed: true,
      eventType,
      eventId,
      success
    };
    this.logger.log(level, `Event consumed: ${eventType}`, consumeContext);
  }

  // Service health logging
  health(component: string, status: 'healthy' | 'unhealthy' | 'degraded', context?: LogContext | undefined): void {
    const level = status === 'healthy' ? 'info' : 'warn';
    const healthContext: any = {
      ...context,
      healthCheck: true,
      component,
      status
    };
    this.logger.log(level, `Health check: ${component} is ${status}`, healthContext);
  }

  // Create child logger with context
  child(context: LogContext): EnterpriseLogger {
    const childLogger = this.logger.child(context);
    return new EnterpriseLogger(childLogger);
  }
}

// Create and export enterprise logger instance
export const log = new EnterpriseLogger(logger);

// Export logger for direct winston access if needed
export { logger as winstonLogger };

// Export types
export type { LogContext };

// Utility function to create operation timer
export function createTimer(operation: string, context?: LogContext) {
  const start = Date.now();
  
  return {
    end: () => {
      const duration = Date.now() - start;
      log.performance(operation, duration, context);
      return duration;
    }
  };
}

// Utility function to log async operations
export async function logAsyncOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const timer = createTimer(operation, context);
  
  try {
    log.debug(`Starting operation: ${operation}`, context);
    const result = await fn();
    timer.end();
    log.debug(`Completed operation: ${operation}`, context);
    return result;
  } catch (error) {
    timer.end();
    log.error(`Failed operation: ${operation}`, { ...context, error: error as Error });
    throw error;
  }
}
