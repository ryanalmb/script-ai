import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { gracefulDegradationManager } from './gracefulDegradation';
import { timeoutMonitor } from './timeoutHandler';
import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime/library';
import { EnterpriseErrorClass, ErrorFactory, ErrorUtils, ErrorType } from '../errors/enterpriseErrorFramework';
import { correlationManager } from '../services/correlationManager';
import { errorAnalyticsPlatform } from '../services/errorAnalyticsPlatform';
import { intelligentRetryEngine } from '../services/intelligentRetryEngine';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Enhanced error classification
export const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  CONFLICT: 'CONFLICT_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  DATABASE: 'DATABASE_ERROR',
  EXTERNAL_API: 'EXTERNAL_API_ERROR',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
  CIRCUIT_BREAKER: 'CIRCUIT_BREAKER_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  CONNECTION: 'CONNECTION_ERROR',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED_ERROR',
  BUSINESS_LOGIC: 'BUSINESS_LOGIC_ERROR'
} as const;

export interface EnhancedError extends Error {
  statusCode?: number;
  code?: string;
  type?: string;
  details?: any;
  retryable?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  originalError?: Error;
}

interface ErrorStats {
  count: number;
  lastOccurrence: Date;
  firstOccurrence: Date;
  averageResponseTime: number;
  statusCodes: Record<number, number>;
}

class EnhancedErrorHandler {
  private static instance: EnhancedErrorHandler;
  private errorStats = new Map<string, ErrorStats>();
  private alertThresholds = {
    errorRate: 0.05, // 5% error rate
    consecutiveErrors: 10,
    criticalErrorsPerMinute: 5,
    timeoutThreshold: 30000 // 30 seconds
  };

  public static getInstance(): EnhancedErrorHandler {
    if (!EnhancedErrorHandler.instance) {
      EnhancedErrorHandler.instance = new EnhancedErrorHandler();
    }
    return EnhancedErrorHandler.instance;
  }

  public classifyError(error: any, operation?: string): EnterpriseErrorClass {
    // If already an enterprise error, return as-is
    if (error instanceof EnterpriseErrorClass) {
      return error;
    }

    // Convert to enterprise error
    const enterpriseError = ErrorUtils.toEnterpriseError(error, operation);

    // Set correlation context
    const correlationId = correlationManager.getCorrelationId();
    const userId = correlationManager.getUserId();

    if (correlationId) {
      ErrorFactory.setContext({
        correlationId,
        ...(userId ? { userId } : {}),
        service: process.env.SERVICE_NAME || 'backend'
      });
    }

    // Create enhanced error object
    const enhancedError = enterpriseError as any;

    // Prisma/Database errors
    if (error instanceof PrismaClientKnownRequestError) {
      enhancedError.type = ERROR_TYPES.DATABASE;
      enhancedError.code = error.code;
      enhancedError.statusCode = this.mapPrismaErrorToStatus(error.code);
      enhancedError.retryable = this.isPrismaErrorRetryable(error.code);
      enhancedError.severity = this.getPrismaErrorSeverity(error.code);
    } else if (error instanceof PrismaClientUnknownRequestError) {
      enhancedError.type = ERROR_TYPES.DATABASE;
      enhancedError.statusCode = 500;
      enhancedError.severity = 'high';
      enhancedError.retryable = true;
    }
    
    // Timeout errors
    else if (error.code === 'REQUEST_TIMEOUT' || error.code === 'DATABASE_TIMEOUT' || 
             error.code === 'REDIS_TIMEOUT' || error.code === 'HTTP_TIMEOUT') {
      enhancedError.type = ERROR_TYPES.TIMEOUT;
      enhancedError.statusCode = 408;
      enhancedError.retryable = true;
      enhancedError.severity = 'medium';
    }
    
    // Circuit breaker errors
    else if (error.code === 'CIRCUIT_BREAKER_OPEN') {
      enhancedError.type = ERROR_TYPES.CIRCUIT_BREAKER;
      enhancedError.statusCode = 503;
      enhancedError.retryable = true;
      enhancedError.severity = 'high';
    }
    
    // Connection errors
    else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || 
             error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      enhancedError.type = ERROR_TYPES.CONNECTION;
      enhancedError.statusCode = 503;
      enhancedError.retryable = true;
      enhancedError.severity = 'high';
    }
    
    // Rate limiting errors
    else if (error.code === 'RATE_LIMIT_EXCEEDED' || error.code === 'TOO_MANY_REQUESTS') {
      enhancedError.type = ERROR_TYPES.RATE_LIMIT;
      enhancedError.statusCode = 429;
      enhancedError.retryable = true;
      enhancedError.severity = 'low';
    }
    
    // Authentication errors
    else if (error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_EXPIRED' || 
             error.code === 'AUTH_REQUIRED') {
      enhancedError.type = ERROR_TYPES.AUTHENTICATION;
      enhancedError.statusCode = 401;
      enhancedError.retryable = false;
      enhancedError.severity = 'medium';
    }
    
    // Authorization errors
    else if (error.code === 'INSUFFICIENT_PERMISSIONS' || error.code === 'FORBIDDEN') {
      enhancedError.type = ERROR_TYPES.AUTHORIZATION;
      enhancedError.statusCode = 403;
      enhancedError.retryable = false;
      enhancedError.severity = 'medium';
    }
    
    // Validation errors
    else if (error.code === 'VALIDATION_ERROR' || error.name === 'ValidationError') {
      enhancedError.type = ERROR_TYPES.VALIDATION;
      enhancedError.statusCode = 400;
      enhancedError.retryable = false;
      enhancedError.severity = 'low';
    }
    
    // Not found errors
    else if (error.code === 'NOT_FOUND' || error.statusCode === 404) {
      enhancedError.type = ERROR_TYPES.NOT_FOUND;
      enhancedError.statusCode = 404;
      enhancedError.retryable = false;
      enhancedError.severity = 'low';
    }
    
    // Default to internal server error
    else {
      enhancedError.type = ERROR_TYPES.INTERNAL;
      enhancedError.statusCode = error.statusCode || 500;
      enhancedError.retryable = true;
      enhancedError.severity = 'high';
    }

    return enhancedError;
  }

  private mapPrismaErrorToStatus(code: string): number {
    const statusMap: Record<string, number> = {
      'P2002': 409, // Unique constraint violation
      'P2025': 404, // Record not found
      'P2003': 400, // Foreign key constraint violation
      'P2004': 400, // Constraint violation
      'P1001': 503, // Can't reach database server
      'P1002': 408, // Database server timeout
      'P1008': 503, // Operations timed out
      'P1017': 404  // Server has closed the connection
    };
    return statusMap[code] || 500;
  }

  private isPrismaErrorRetryable(code: string): boolean {
    const retryableCodes = ['P1001', 'P1002', 'P1008', 'P1017'];
    return retryableCodes.includes(code);
  }

  private getPrismaErrorSeverity(code: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'P2002': 'low',    // Unique constraint
      'P2025': 'low',    // Record not found
      'P2003': 'medium', // Foreign key constraint
      'P1001': 'high',   // Can't reach database
      'P1002': 'medium', // Database timeout
      'P1008': 'high',   // Operations timed out
      'P1017': 'critical' // Connection closed
    };
    return severityMap[code] || 'medium';
  }

  public recordError(error: EnhancedError, req: Request): void {
    const errorKey = `${error.type}:${error.code || 'unknown'}`;
    const stats = this.errorStats.get(errorKey) || {
      count: 0,
      lastOccurrence: new Date(),
      firstOccurrence: new Date(),
      averageResponseTime: 0,
      statusCodes: {}
    };

    stats.count++;
    stats.lastOccurrence = new Date();
    stats.statusCodes[error.statusCode || 500] = (stats.statusCodes[error.statusCode || 500] || 0) + 1;

    this.errorStats.set(errorKey, stats);

    // Record timeout if applicable
    if (error.type === ERROR_TYPES.TIMEOUT) {
      timeoutMonitor.recordTimeout(error.code || 'unknown', error.details?.timeout || 0);
    }

    // Log error with context
    const logContext = {
      errorType: error.type,
      errorCode: error.code,
      statusCode: error.statusCode,
      severity: error.severity,
      retryable: error.retryable,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      requestId: (req as any).requestId,
      degradationLevel: gracefulDegradationManager.getDegradationLevel(),
      ...error.context
    };

    if (error.severity === 'critical') {
      logger.error('Critical error occurred:', error, logContext);
    } else if (error.severity === 'high') {
      logger.error('High severity error:', error, logContext);
    } else if (error.severity === 'medium') {
      logger.warn('Medium severity error:', error, logContext);
    } else {
      logger.info('Low severity error:', error, logContext);
    }
  }

  public createErrorResponse(error: EnhancedError, req: Request): any {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const degradationLevel = gracefulDegradationManager.getDegradationLevel();

    const baseResponse = {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      type: error.type,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId
    };

    // Add degradation info if system is degraded
    if (degradationLevel !== 'healthy') {
      (baseResponse as any).degraded = true;
      (baseResponse as any).degradationLevel = degradationLevel;
      (baseResponse as any).serviceStatus = gracefulDegradationManager.getServiceStatus();
    }

    // Add retry information for retryable errors
    if (error.retryable) {
      (baseResponse as any).retryable = true;
      (baseResponse as any).retryAfter = this.calculateRetryAfter(error);
    }

    // Add development details
    if (isDevelopment) {
      (baseResponse as any).details = error.details;
      (baseResponse as any).stack = error.stack;
      (baseResponse as any).originalError = error.originalError?.message;
    }

    // Add specific error details based on type
    if (error.type === ERROR_TYPES.VALIDATION && error.details) {
      (baseResponse as any).validationErrors = error.details;
    }

    if (error.type === ERROR_TYPES.RATE_LIMIT) {
      (baseResponse as any).retryAfter = error.details?.retryAfter || 60;
    }

    return baseResponse;
  }

  private calculateRetryAfter(error: EnhancedError): number {
    switch (error.type) {
      case ERROR_TYPES.RATE_LIMIT:
        return error.details?.retryAfter || 60;
      case ERROR_TYPES.CIRCUIT_BREAKER:
        return error.details?.retryAfter || 30;
      case ERROR_TYPES.TIMEOUT:
        return 5;
      case ERROR_TYPES.CONNECTION:
        return 10;
      default:
        return 30;
    }
  }

  public getErrorStats(): Record<string, ErrorStats> {
    const stats: Record<string, ErrorStats> = {};
    for (const [key, value] of this.errorStats) {
      stats[key] = { ...value };
    }
    return stats;
  }

  public resetStats(): void {
    this.errorStats.clear();
  }
}

export const enhancedErrorHandler = EnhancedErrorHandler.getInstance();

// Main error handling middleware
export function createEnhancedErrorMiddleware() {
  return async (error: any, req: Request, res: Response, next: NextFunction): Promise<void> => {
    const span = trace.getActiveSpan();

    try {
      // Skip if response already sent
      if (res.headersSent) {
        return next(error);
      }

      // Get operation name from request
      const operation = `${req.method} ${req.path}`;

      // Classify and enhance the error using enterprise framework
      const enterpriseError = enhancedErrorHandler.classifyError(error, operation);

      // Record error in analytics platform
      errorAnalyticsPlatform.recordError(enterpriseError, {
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers as Record<string, string>,
          body: req.body,
          params: req.params,
          query: req.query as Record<string, any>
        },
        user: {
          id: (req as any).user?.id,
          email: (req as any).user?.email,
          role: (req as any).user?.role
        },
        system: {
          hostname: process.env.HOSTNAME,
          pid: process.pid,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      });

      // Record error statistics (legacy)
      enhancedErrorHandler.recordError(enterpriseError as any, req);

      // Create enterprise error response
      const errorResponse = enterpriseError.toHttpResponse();

      // Set correlation headers
      const correlationHeaders = correlationManager.createOutgoingHeaders();
      Object.entries(correlationHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Set appropriate headers
      res.setHeader('Content-Type', 'application/json');
      if (enterpriseError.retryable && enterpriseError.retryAfter) {
        res.setHeader('Retry-After', enterpriseError.retryAfter.toString());
      }

      // Add OpenTelemetry span information
      if (span) {
        span.recordException(enterpriseError);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: enterpriseError.message
        });
        span.setAttributes({
          'error.type': enterpriseError.type,
          'error.code': enterpriseError.code,
          'error.severity': enterpriseError.severity,
          'error.retryable': enterpriseError.retryable
        });
      }

      // Determine HTTP status code
      const statusCode = mapErrorTypeToHttpStatus(enterpriseError.type);

      // Send enterprise error response
      res.status(statusCode).json(errorResponse);

    } catch (handlingError) {
      // Fallback error handling
      logger.error('Error in error handling middleware:', handlingError);

      if (span) {
        span.recordException(handlingError as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Error handling failed'
        });
      }

      // Send basic error response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            id: 'error_handling_failed',
            correlationId: correlationManager.getCorrelationId() || 'unknown',
            type: 'SYSTEM_ERROR',
            code: 'SYS_001',
            message: 'An error occurred while processing the error',
            retryable: false,
            timestamp: new Date().toISOString()
          }
        });
      }
    }
  };
}

/**
 * Map enterprise error types to HTTP status codes
 */
function mapErrorTypeToHttpStatus(errorType: ErrorType): number {
  const statusMap: Record<ErrorType, number> = {
    [ErrorType.VALIDATION_ERROR]: 400,
    [ErrorType.AUTHENTICATION_ERROR]: 401,
    [ErrorType.AUTHORIZATION_ERROR]: 403,
    [ErrorType.RESOURCE_NOT_FOUND]: 404,
    [ErrorType.RESOURCE_CONFLICT]: 409,
    [ErrorType.RATE_LIMIT_ERROR]: 429,
    [ErrorType.QUOTA_EXCEEDED_ERROR]: 429,
    [ErrorType.THROTTLING_ERROR]: 429,
    [ErrorType.DATABASE_ERROR]: 500,
    [ErrorType.SYSTEM_ERROR]: 500,
    [ErrorType.EXTERNAL_API_ERROR]: 502,
    [ErrorType.THIRD_PARTY_ERROR]: 502,
    [ErrorType.INTEGRATION_ERROR]: 502,
    [ErrorType.NETWORK_ERROR]: 503,
    [ErrorType.TIMEOUT_ERROR]: 504,
    [ErrorType.RESOURCE_EXHAUSTED]: 503,
    [ErrorType.CONFIGURATION_ERROR]: 500,
    [ErrorType.ENVIRONMENT_ERROR]: 500,
    [ErrorType.DEPENDENCY_ERROR]: 503,
    [ErrorType.BUSINESS_RULE_ERROR]: 422,
    [ErrorType.WORKFLOW_ERROR]: 422,
    [ErrorType.STATE_ERROR]: 409,
    [ErrorType.TOKEN_ERROR]: 401,
    [ErrorType.PERMISSION_ERROR]: 403,
    [ErrorType.MEMORY_ERROR]: 503,
    [ErrorType.TWIKIT_AUTHENTICATION_ERROR]: 401,
    [ErrorType.TWIKIT_AUTHENTICATION_FAILED]: 401,
    [ErrorType.TWIKIT_AUTHENTICATION_REQUIRED]: 401,
    [ErrorType.TWIKIT_ACCOUNT_LOCKED]: 403,
    [ErrorType.TWIKIT_ACCOUNT_SUSPENDED]: 403,
    [ErrorType.TWIKIT_SESSION_ERROR]: 500,
    [ErrorType.TWIKIT_SESSION_CREATION_FAILED]: 500,
    [ErrorType.TWIKIT_CONTENT_QUALITY_ERROR]: 422,
    [ErrorType.TWIKIT_CIRCUIT_BREAKER_OPEN]: 503,
    [ErrorType.TWIKIT_PROXY_ERROR]: 502,
    [ErrorType.TWIKIT_RATE_LIMIT_EXCEEDED]: 429,
    [ErrorType.TWIKIT_ACTION_FAILED]: 500,
    [ErrorType.TWIKIT_SCRIPT_EXECUTION_ERROR]: 500,
    [ErrorType.TWIKIT_TIMEOUT_ERROR]: 504,
    [ErrorType.TWIKIT_UNKNOWN_ERROR]: 500,

    // Additional Twikit HTTP Status Mappings
    [ErrorType.TWIKIT_ACCOUNT_RESTRICTED]: 403,
    [ErrorType.TWIKIT_INVALID_CREDENTIALS]: 401,
    [ErrorType.TWIKIT_TWO_FACTOR_REQUIRED]: 401,
    [ErrorType.TWIKIT_SESSION_EXPIRED]: 401,
    [ErrorType.TWIKIT_SESSION_INVALID]: 401,
    [ErrorType.TWIKIT_SESSION_LIMIT_EXCEEDED]: 429,
    [ErrorType.TWIKIT_CONTENT_TOO_LONG]: 422,
    [ErrorType.TWIKIT_CONTENT_DUPLICATE]: 409,
    [ErrorType.TWIKIT_CONTENT_SPAM_DETECTED]: 422,
    [ErrorType.TWIKIT_CONTENT_POLICY_VIOLATION]: 422,
    [ErrorType.TWIKIT_MEDIA_UPLOAD_FAILED]: 500,
    [ErrorType.TWIKIT_MEDIA_FORMAT_UNSUPPORTED]: 422,
    [ErrorType.TWIKIT_RATE_LIMIT_TWEET]: 429,
    [ErrorType.TWIKIT_RATE_LIMIT_FOLLOW]: 429,
    [ErrorType.TWIKIT_RATE_LIMIT_LIKE]: 429,
    [ErrorType.TWIKIT_RATE_LIMIT_RETWEET]: 429,
    [ErrorType.TWIKIT_RATE_LIMIT_DM]: 429,
    [ErrorType.TWIKIT_RATE_LIMIT_SEARCH]: 429,
    [ErrorType.TWIKIT_PROXY_CONNECTION_FAILED]: 502,
    [ErrorType.TWIKIT_PROXY_AUTHENTICATION_FAILED]: 502,
    [ErrorType.TWIKIT_PROXY_TIMEOUT]: 504,
    [ErrorType.TWIKIT_PROXY_BLOCKED]: 502,
    [ErrorType.TWIKIT_NETWORK_ERROR]: 502,
    [ErrorType.TWIKIT_CONNECTION_TIMEOUT]: 504,
    [ErrorType.TWIKIT_DNS_RESOLUTION_FAILED]: 502,
    [ErrorType.TWIKIT_TWEET_CREATION_FAILED]: 500,
    [ErrorType.TWIKIT_TWEET_DELETION_FAILED]: 500,
    [ErrorType.TWIKIT_FOLLOW_ACTION_FAILED]: 500,
    [ErrorType.TWIKIT_UNFOLLOW_ACTION_FAILED]: 500,
    [ErrorType.TWIKIT_LIKE_ACTION_FAILED]: 500,
    [ErrorType.TWIKIT_UNLIKE_ACTION_FAILED]: 500,
    [ErrorType.TWIKIT_RETWEET_ACTION_FAILED]: 500,
    [ErrorType.TWIKIT_UNRETWEET_ACTION_FAILED]: 500,
    [ErrorType.TWIKIT_DM_SEND_FAILED]: 500,
    [ErrorType.TWIKIT_SEARCH_FAILED]: 500,
    [ErrorType.TWIKIT_PROFILE_UPDATE_FAILED]: 500,
    [ErrorType.TWIKIT_PYTHON_PROCESS_ERROR]: 500,
    [ErrorType.TWIKIT_PYTHON_IMPORT_ERROR]: 500,
    [ErrorType.TWIKIT_CONFIGURATION_ERROR]: 500,
    [ErrorType.TWIKIT_DETECTION_RISK_HIGH]: 403,
    [ErrorType.TWIKIT_CAPTCHA_REQUIRED]: 403,
    [ErrorType.TWIKIT_SUSPICIOUS_ACTIVITY]: 403,
    [ErrorType.TWIKIT_FINGERPRINT_MISMATCH]: 403,
    [ErrorType.TWIKIT_BEHAVIOR_ANOMALY]: 403,
    [ErrorType.TWIKIT_INTERNAL_ERROR]: 500,
    [ErrorType.TWIKIT_VALIDATION_ERROR]: 422
  };

  return statusMap[errorType] || 500;
}
