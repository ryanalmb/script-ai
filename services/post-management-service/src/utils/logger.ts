/**
 * Enterprise Post Management Service - Structured Logging System
 * Comprehensive logging with post-specific context and backend integration
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
  winston.format.printf(({ timestamp, level, message, service, version, environment, operation, correlationId, userId, postId, accountId, campaignId, error, metadata, ...rest }) => {
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
    
    // Add post management specific context
    if (postId) logEntry.postId = postId;
    if (accountId) logEntry.accountId = accountId;
    if (campaignId) logEntry.campaignId = campaignId;
    
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
  winston.format.printf(({ timestamp, level, message, operation, correlationId, userId, postId }) => {
    let logMessage = `${timestamp} [${level}] ${message}`;
    
    if (operation) logMessage += ` | operation=${operation}`;
    if (correlationId) logMessage += ` | correlationId=${correlationId}`;
    if (userId) logMessage += ` | userId=${userId}`;
    if (postId) logMessage += ` | postId=${postId}`;
    
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

// Enhanced logging interface with post management context
interface PostLogContext {
  correlationId?: string | undefined;
  userId?: string | undefined;
  postId?: string | undefined;
  accountId?: string | undefined;
  campaignId?: string | undefined;
  operation?: string | undefined;
  duration?: number | undefined;
  metadata?: Record<string, any> | undefined;
  error?: Error | undefined;
}

interface SecurityLogContext extends PostLogContext {
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventType: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

interface BusinessLogContext extends PostLogContext {
  eventData: Record<string, any>;
}

interface AuditLogContext extends PostLogContext {
  action: string;
  resource: string;
  changes?: Record<string, any> | undefined;
}

// Enhanced logging methods
export const log = {
  // Standard logging methods
  error: (message: string, context?: PostLogContext) => {
    logger.error(message, context);
  },

  warn: (message: string, context?: PostLogContext) => {
    logger.warn(message, context);
  },

  info: (message: string, context?: PostLogContext) => {
    logger.info(message, context);
  },

  debug: (message: string, context?: PostLogContext) => {
    logger.debug(message, context);
  },

  // Post management specific logging
  post: (message: string, postId: string, context?: PostLogContext) => {
    logger.info(message, { ...context, postId, operation: context?.operation || 'post_operation' });
  },

  account: (message: string, accountId: string, context?: PostLogContext) => {
    logger.info(message, { ...context, accountId, operation: context?.operation || 'account_operation' });
  },

  campaign: (message: string, campaignId: string, context?: PostLogContext) => {
    logger.info(message, { ...context, campaignId, operation: context?.operation || 'campaign_operation' });
  },

  // Post scheduling and publishing logging
  scheduling: (message: string, context?: PostLogContext & { 
    scheduledFor?: Date | undefined;
    priority?: string | undefined;
    queuePosition?: number | undefined;
  }) => {
    logger.info(message, { ...context, operation: context?.operation || 'post_scheduling' });
  },

  publishing: (message: string, context?: PostLogContext & { 
    platform?: string | undefined;
    publishResult?: string | undefined;
    retryAttempt?: number | undefined;
  }) => {
    logger.info(message, { ...context, operation: context?.operation || 'post_publishing' });
  },

  // Analytics and metrics logging
  analytics: (message: string, context?: PostLogContext & { 
    metricsType?: string | undefined;
    dataPoints?: number | undefined;
    timeRange?: string | undefined;
  }) => {
    logger.info(message, { ...context, operation: context?.operation || 'analytics' });
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
  eventPublished: (eventType: string, eventId: string, context?: PostLogContext) => {
    logger.info(`Event published: ${eventType}`, {
      ...context,
      eventType,
      eventId,
      operation: 'event_published'
    });
  },

  eventConsumed: (eventType: string, eventId: string, success: boolean, context?: PostLogContext) => {
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
  performance: (message: string, duration: number, context?: PostLogContext) => {
    logger.info(message, {
      ...context,
      duration,
      operation: context?.operation || 'performance_metric'
    });
  },

  // Database operation logging
  database: (message: string, context?: PostLogContext & {
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
  externalService: (message: string, context?: PostLogContext & {
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

  // Twitter API specific logging
  twitterApi: (message: string, context?: PostLogContext & {
    endpoint?: string | undefined;
    rateLimitRemaining?: number | undefined;
    rateLimitReset?: Date | undefined;
    tweetId?: string | undefined;
  }) => {
    logger.info(message, {
      ...context,
      operation: context?.operation || 'twitter_api_call'
    });
  },

  // Queue operation logging
  queue: (message: string, context?: PostLogContext & {
    queueName?: string | undefined;
    queueSize?: number | undefined;
    priority?: string | undefined;
    processingTime?: number | undefined;
  }) => {
    logger.info(message, {
      ...context,
      operation: context?.operation || 'queue_operation'
    });
  },

  // Rate limiting logging
  rateLimit: (message: string, context?: PostLogContext & {
    limit?: number | undefined;
    remaining?: number | undefined;
    resetTime?: Date | undefined;
    service?: string | undefined;
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
