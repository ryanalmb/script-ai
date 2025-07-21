/**
 * Enterprise Content Management Service - Structured Logging System
 * Comprehensive logging with content-specific context and backend integration
 */

import winston from 'winston';
import { config, loggingConfig, enterpriseConfig } from '@/config';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

winston.addColors(logColors);

// Create formatters
const jsonFormatter = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, version, environment, operation, correlationId, userId, contentId, mediaId, templateId, error, metadata, ...rest }) => {
    const logEntry: any = {
      timestamp,
      level,
      service: service || config.name,
      version: version || config.version,
      environment: environment || config.environment,
      message
    };

    // Add operation context
    if (operation) logEntry.operation = operation;
    if (correlationId) logEntry.correlationId = correlationId;
    
    // Add user context
    if (userId) logEntry.userId = userId;
    
    // Add content management specific context
    if (contentId) logEntry.contentId = contentId;
    if (mediaId) logEntry.mediaId = mediaId;
    if (templateId) logEntry.templateId = templateId;
    
    // Add error details
    if (error && typeof error === 'object' && 'name' in error && 'message' in error) {
      logEntry.error = {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      };
    }
    
    // Add metadata
    if (metadata) logEntry.metadata = metadata;
    
    // Add any additional fields
    Object.keys(rest).forEach(key => {
      if (rest[key] !== undefined) {
        logEntry[key] = rest[key];
      }
    });

    return JSON.stringify(logEntry);
  })
);

const simpleFormatter = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, operation, correlationId, userId, contentId }) => {
    let logMessage = `${timestamp} [${level}] ${message}`;
    
    if (operation) logMessage += ` | operation=${operation}`;
    if (correlationId) logMessage += ` | correlationId=${correlationId}`;
    if (userId) logMessage += ` | userId=${userId}`;
    if (contentId) logMessage += ` | contentId=${contentId}`;
    
    return logMessage;
  })
);

// Create transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: loggingConfig.format === 'json' ? jsonFormatter : simpleFormatter
  })
];

// Add file transports for production
if (config.environment === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormatter,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFormatter,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: loggingConfig.level,
  transports,
  exitOnError: false,
  defaultMeta: {
    service: config.name,
    version: config.version,
    environment: config.environment
  }
});

// Performance timer utility
export function createTimer(_operation: string): { end: () => number } {
  const start = Date.now();
  return {
    end: () => {
      const duration = Date.now() - start;
      return duration;
    }
  };
}

// Enhanced logging interface with content management context
interface ContentLogContext {
  correlationId?: string | undefined;
  userId?: string | undefined;
  contentId?: string | undefined;
  mediaId?: string | undefined;
  templateId?: string | undefined;
  operation?: string | undefined;
  duration?: number | undefined;
  metadata?: Record<string, any> | undefined;
  error?: Error | undefined;
}

interface SecurityLogContext extends ContentLogContext {
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventType: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

interface BusinessLogContext extends ContentLogContext {
  eventData: Record<string, any>;
}

interface AuditLogContext extends ContentLogContext {
  action: string;
  resource: string;
  changes?: Record<string, any> | undefined;
}



// Enhanced logging methods
export const log = {
  // Standard logging methods
  error: (message: string, context?: ContentLogContext) => {
    logger.error(message, context);
  },

  warn: (message: string, context?: ContentLogContext) => {
    logger.warn(message, context);
  },

  info: (message: string, context?: ContentLogContext) => {
    logger.info(message, context);
  },

  debug: (message: string, context?: ContentLogContext) => {
    logger.debug(message, context);
  },

  // Content management specific logging
  content: (message: string, contentId: string, context?: ContentLogContext) => {
    logger.info(message, { ...context, contentId, operation: context?.operation || 'content_operation' });
  },

  media: (message: string, mediaId: string, context?: ContentLogContext) => {
    logger.info(message, { ...context, mediaId, operation: context?.operation || 'media_operation' });
  },

  template: (message: string, templateId: string, context?: ContentLogContext) => {
    logger.info(message, { ...context, templateId, operation: context?.operation || 'template_operation' });
  },

  // AI content generation logging
  aiGeneration: (message: string, context?: ContentLogContext & { 
    model?: string | undefined;
    tokensUsed?: number | undefined;
    cost?: number | undefined;
    prompt?: string | undefined;
  }) => {
    logger.info(message, { ...context, operation: context?.operation || 'ai_generation' });
  },

  // Security logging
  security: (message: string, context: SecurityLogContext) => {
    if (enterpriseConfig.securityMonitoring) {
      logger.warn(message, { 
        ...context, 
        operation: context.operation || 'security_event',
        securityEvent: true 
      });
    }
  },

  // Business event logging
  business: (message: string, context: BusinessLogContext) => {
    logger.info(message, { 
      ...context, 
      operation: context.operation || 'business_event',
      businessEvent: true 
    });
  },

  // Audit logging
  audit: (message: string, context: AuditLogContext) => {
    if (enterpriseConfig.auditLogging) {
      logger.info(message, { 
        ...context, 
        operation: context.operation || 'audit_event',
        auditEvent: true 
      });
    }
  },

  // Event publishing/consuming logging
  eventPublished: (eventType: string, eventId: string, context?: ContentLogContext) => {
    logger.info(`Event published: ${eventType}`, {
      ...context,
      eventType,
      eventId,
      operation: 'event_published'
    });
  },

  eventConsumed: (eventType: string, eventId: string, success: boolean, context?: ContentLogContext) => {
    const level = success ? 'info' : 'error';
    const message = `Event consumed: ${eventType} - ${success ? 'success' : 'failed'}`;
    
    logger[level](message, {
      ...context,
      eventType,
      eventId,
      success,
      operation: 'event_consumed'
    });
  },

  // Performance logging
  performance: (message: string, duration: number, context?: ContentLogContext) => {
    logger.info(message, {
      ...context,
      duration,
      operation: context?.operation || 'performance_metric'
    });
  },

  // Database operation logging
  database: (message: string, context?: ContentLogContext & {
    query?: string | undefined;
    params?: any[] | undefined;
    rowCount?: number | undefined;
  }) => {
    logger.debug(message, {
      ...context,
      operation: context?.operation || 'database_operation'
    });
  },

  // External service call logging
  externalService: (message: string, context?: ContentLogContext & {
    service?: string | undefined;
    endpoint?: string | undefined;
    method?: string | undefined;
    statusCode?: number | undefined;
    responseTime?: number | undefined;
  }) => {
    logger.info(message, {
      ...context,
      operation: context?.operation || 'external_service_call'
    });
  },

  // Content processing logging
  processing: (message: string, context?: ContentLogContext & {
    processingType?: 'image' | 'video' | 'text' | 'ai' | undefined;
    inputSize?: number | undefined;
    outputSize?: number | undefined;
    processingTime?: number | undefined;
  }) => {
    logger.info(message, {
      ...context,
      operation: context?.operation || 'content_processing'
    });
  },

  // Validation logging
  validation: (message: string, context?: ContentLogContext & {
    validationType?: string | undefined;
    errors?: string[] | undefined;
    isValid?: boolean | undefined;
  }) => {
    const level = context?.isValid === false ? 'warn' : 'debug';
    logger[level](message, {
      ...context,
      operation: context?.operation || 'validation'
    });
  },

  // Cache operation logging
  cache: (message: string, context?: ContentLogContext & {
    cacheKey?: string | undefined;
    hit?: boolean | undefined;
    ttl?: number | undefined;
  }) => {
    logger.debug(message, {
      ...context,
      operation: context?.operation || 'cache_operation'
    });
  },

  // Rate limiting logging
  rateLimit: (message: string, context?: ContentLogContext & {
    limit?: number | undefined;
    remaining?: number | undefined;
    resetTime?: Date | undefined;
  }) => {
    logger.warn(message, {
      ...context,
      operation: context?.operation || 'rate_limit'
    });
  }
};

// Export logger instance for direct use if needed
export { logger };

// Export default
export default log;
