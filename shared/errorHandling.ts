/**
 * Shared Error Handling Utilities - 2025 Edition
 * Cross-service error handling standardization:
 * - Unified error response formats
 * - Correlation ID propagation
 * - Service-specific error adapters
 * - Error logging standardization
 * - Retry strategy coordination
 */

// Shared Error Types (consistent across all services)
export enum SharedErrorType {
  // System Errors
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  
  // Business Logic Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BUSINESS_RULE_ERROR = 'BUSINESS_RULE_ERROR',
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',
  STATE_ERROR = 'STATE_ERROR',
  
  // Authentication & Authorization
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  TOKEN_ERROR = 'TOKEN_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  
  // External Service Errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  THIRD_PARTY_ERROR = 'THIRD_PARTY_ERROR',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  
  // Rate Limiting & Throttling
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  QUOTA_EXCEEDED_ERROR = 'QUOTA_EXCEEDED_ERROR',
  THROTTLING_ERROR = 'THROTTLING_ERROR',
  
  // Resource Errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  
  // Configuration & Environment
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR'
}

export enum SharedErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum SharedErrorCategory {
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  BUSINESS = 'BUSINESS',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE',
  INFRASTRUCTURE = 'INFRASTRUCTURE'
}

// Standardized Error Response Format
export interface StandardErrorResponse {
  success: false;
  error: {
    id: string;
    correlationId: string;
    type: SharedErrorType;
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
    retryAfter?: number;
    timestamp: string;
    traceId?: string;
    service: string;
    operation?: string;
  };
}

// Standardized Success Response Format
export interface StandardSuccessResponse<T = any> {
  success: true;
  data: T;
  metadata?: {
    correlationId: string;
    timestamp: string;
    service: string;
    operation?: string;
    traceId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

// Correlation Headers
export interface CorrelationHeaders {
  'X-Correlation-ID': string;
  'X-Request-ID'?: string;
  'X-Trace-ID'?: string;
  'X-Span-ID'?: string;
  'X-User-ID'?: string;
  'X-Session-ID'?: string;
  'X-Source-Service'?: string;
}

/**
 * Error Response Builder
 */
export class ErrorResponseBuilder {
  /**
   * Create standardized error response
   */
  static createErrorResponse(config: {
    id?: string;
    correlationId: string;
    type: SharedErrorType;
    code?: string;
    message: string;
    details?: any;
    retryable?: boolean;
    retryAfter?: number;
    traceId?: string;
    service: string;
    operation?: string;
  }): StandardErrorResponse {
    return {
      success: false,
      error: {
        id: config.id || `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        correlationId: config.correlationId,
        type: config.type,
        code: config.code || this.generateErrorCode(config.type),
        message: config.message,
        details: config.details,
        retryable: config.retryable ?? this.isRetryableByDefault(config.type),
        retryAfter: config.retryAfter,
        timestamp: new Date().toISOString(),
        traceId: config.traceId,
        service: config.service,
        operation: config.operation
      }
    };
  }

  /**
   * Create standardized success response
   */
  static createSuccessResponse<T>(
    data: T,
    metadata?: {
      correlationId: string;
      service: string;
      operation?: string;
      traceId?: string;
      pagination?: any;
    }
  ): StandardSuccessResponse<T> {
    return {
      success: true,
      data,
      metadata: metadata ? {
        ...metadata,
        timestamp: new Date().toISOString()
      } : undefined
    };
  }

  /**
   * Generate error code from type
   */
  private static generateErrorCode(type: SharedErrorType): string {
    const codeMap: Record<SharedErrorType, string> = {
      [SharedErrorType.SYSTEM_ERROR]: 'SYS_001',
      [SharedErrorType.DATABASE_ERROR]: 'DB_001',
      [SharedErrorType.NETWORK_ERROR]: 'NET_001',
      [SharedErrorType.TIMEOUT_ERROR]: 'TMO_001',
      [SharedErrorType.MEMORY_ERROR]: 'MEM_001',
      [SharedErrorType.VALIDATION_ERROR]: 'VAL_001',
      [SharedErrorType.BUSINESS_RULE_ERROR]: 'BIZ_001',
      [SharedErrorType.WORKFLOW_ERROR]: 'WFL_001',
      [SharedErrorType.STATE_ERROR]: 'STA_001',
      [SharedErrorType.AUTHENTICATION_ERROR]: 'AUTH_001',
      [SharedErrorType.AUTHORIZATION_ERROR]: 'AUTHZ_001',
      [SharedErrorType.TOKEN_ERROR]: 'TOK_001',
      [SharedErrorType.PERMISSION_ERROR]: 'PERM_001',
      [SharedErrorType.EXTERNAL_API_ERROR]: 'EXT_001',
      [SharedErrorType.THIRD_PARTY_ERROR]: 'TP_001',
      [SharedErrorType.INTEGRATION_ERROR]: 'INT_001',
      [SharedErrorType.RATE_LIMIT_ERROR]: 'RATE_001',
      [SharedErrorType.QUOTA_EXCEEDED_ERROR]: 'QUOTA_001',
      [SharedErrorType.THROTTLING_ERROR]: 'THROT_001',
      [SharedErrorType.RESOURCE_NOT_FOUND]: 'RES_404',
      [SharedErrorType.RESOURCE_CONFLICT]: 'RES_409',
      [SharedErrorType.RESOURCE_EXHAUSTED]: 'RES_503',
      [SharedErrorType.CONFIGURATION_ERROR]: 'CFG_001',
      [SharedErrorType.ENVIRONMENT_ERROR]: 'ENV_001',
      [SharedErrorType.DEPENDENCY_ERROR]: 'DEP_001'
    };
    
    return codeMap[type] || 'UNK_001';
  }

  /**
   * Check if error type is retryable by default
   */
  private static isRetryableByDefault(type: SharedErrorType): boolean {
    const retryableTypes = [
      SharedErrorType.NETWORK_ERROR,
      SharedErrorType.TIMEOUT_ERROR,
      SharedErrorType.EXTERNAL_API_ERROR,
      SharedErrorType.THIRD_PARTY_ERROR,
      SharedErrorType.RATE_LIMIT_ERROR,
      SharedErrorType.THROTTLING_ERROR,
      SharedErrorType.RESOURCE_EXHAUSTED,
      SharedErrorType.DATABASE_ERROR
    ];
    
    return retryableTypes.includes(type);
  }
}

/**
 * Correlation Utilities
 */
export class CorrelationUtils {
  /**
   * Generate correlation ID
   */
  static generateCorrelationId(service?: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const servicePrefix = service?.substr(0, 3) || 'unk';
    return `${servicePrefix}_${timestamp}_${random}`;
  }

  /**
   * Extract correlation ID from headers
   */
  static extractCorrelationId(headers: Record<string, string | string[] | undefined>): string | undefined {
    const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'];
    return Array.isArray(correlationId) ? correlationId[0] : correlationId;
  }

  /**
   * Extract trace ID from headers
   */
  static extractTraceId(headers: Record<string, string | string[] | undefined>): string | undefined {
    const traceId = headers['x-trace-id'] || headers['X-Trace-ID'];
    return Array.isArray(traceId) ? traceId[0] : traceId;
  }

  /**
   * Create correlation headers for outgoing requests
   */
  static createCorrelationHeaders(config: {
    correlationId: string;
    requestId?: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    sessionId?: string;
    sourceService: string;
  }): CorrelationHeaders {
    const headers: CorrelationHeaders = {
      'X-Correlation-ID': config.correlationId,
      'X-Source-Service': config.sourceService
    };

    if (config.requestId) headers['X-Request-ID'] = config.requestId;
    if (config.traceId) headers['X-Trace-ID'] = config.traceId;
    if (config.spanId) headers['X-Span-ID'] = config.spanId;
    if (config.userId) headers['X-User-ID'] = config.userId;
    if (config.sessionId) headers['X-Session-ID'] = config.sessionId;

    return headers;
  }
}

/**
 * Retry Utilities
 */
export class RetryUtils {
  /**
   * Calculate exponential backoff delay
   */
  static calculateBackoffDelay(
    attempt: number,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
    multiplier: number = 2,
    jitter: boolean = true
  ): number {
    let delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
    
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5); // Add 0-50% jitter
    }
    
    return Math.floor(delay);
  }

  /**
   * Check if error should be retried
   */
  static shouldRetry(error: any, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) {
      return false;
    }

    // Check if error has retry information
    if (typeof error === 'object' && error !== null) {
      if ('retryable' in error) {
        return error.retryable === true;
      }
      
      if ('type' in error) {
        return ErrorResponseBuilder['isRetryableByDefault'](error.type);
      }
    }

    // Check common retry patterns
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /rate limit/i,
      /throttle/i,
      /503/,
      /502/,
      /504/
    ];

    const errorMessage = error?.message || String(error);
    return retryablePatterns.some(pattern => pattern.test(errorMessage));
  }
}

/**
 * Logging Utilities
 */
export class LoggingUtils {
  /**
   * Create structured log entry for errors
   */
  static createErrorLogEntry(config: {
    error: any;
    correlationId?: string;
    traceId?: string;
    service: string;
    operation?: string;
    userId?: string;
    context?: Record<string, any>;
  }): Record<string, any> {
    return {
      level: 'error',
      timestamp: new Date().toISOString(),
      service: config.service,
      operation: config.operation,
      correlationId: config.correlationId,
      traceId: config.traceId,
      userId: config.userId,
      error: {
        name: config.error?.name,
        message: config.error?.message,
        type: config.error?.type,
        code: config.error?.code,
        stack: config.error?.stack
      },
      context: config.context
    };
  }

  /**
   * Create structured log entry for operations
   */
  static createOperationLogEntry(config: {
    level: 'info' | 'warn' | 'debug';
    message: string;
    correlationId?: string;
    traceId?: string;
    service: string;
    operation?: string;
    userId?: string;
    duration?: number;
    context?: Record<string, any>;
  }): Record<string, any> {
    return {
      level: config.level,
      timestamp: new Date().toISOString(),
      message: config.message,
      service: config.service,
      operation: config.operation,
      correlationId: config.correlationId,
      traceId: config.traceId,
      userId: config.userId,
      duration: config.duration,
      context: config.context
    };
  }
}
