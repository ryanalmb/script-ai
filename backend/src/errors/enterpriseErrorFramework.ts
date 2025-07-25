/**
 * Enterprise Error Framework - 2025 Edition
 * Comprehensive error handling system with:
 * - Unified error classification and standardization
 * - Distributed tracing with correlation IDs
 * - Intelligent retry strategies and circuit breakers
 * - Error analytics and monitoring integration
 * - Automated recovery mechanisms
 * - Cross-service error correlation
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// Enterprise Error Types and Classifications
export enum ErrorType {
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
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',

  // Twikit-specific Errors - Authentication
  TWIKIT_AUTHENTICATION_ERROR = 'TWIKIT_AUTHENTICATION_ERROR',
  TWIKIT_AUTHENTICATION_FAILED = 'TWIKIT_AUTHENTICATION_FAILED',
  TWIKIT_AUTHENTICATION_REQUIRED = 'TWIKIT_AUTHENTICATION_REQUIRED',
  TWIKIT_ACCOUNT_LOCKED = 'TWIKIT_ACCOUNT_LOCKED',
  TWIKIT_ACCOUNT_SUSPENDED = 'TWIKIT_ACCOUNT_SUSPENDED',
  TWIKIT_ACCOUNT_RESTRICTED = 'TWIKIT_ACCOUNT_RESTRICTED',
  TWIKIT_INVALID_CREDENTIALS = 'TWIKIT_INVALID_CREDENTIALS',
  TWIKIT_TWO_FACTOR_REQUIRED = 'TWIKIT_TWO_FACTOR_REQUIRED',

  // Twikit-specific Errors - Session
  TWIKIT_SESSION_ERROR = 'TWIKIT_SESSION_ERROR',
  TWIKIT_SESSION_CREATION_FAILED = 'TWIKIT_SESSION_CREATION_FAILED',
  TWIKIT_SESSION_EXPIRED = 'TWIKIT_SESSION_EXPIRED',
  TWIKIT_SESSION_INVALID = 'TWIKIT_SESSION_INVALID',
  TWIKIT_SESSION_LIMIT_EXCEEDED = 'TWIKIT_SESSION_LIMIT_EXCEEDED',

  // Twikit-specific Errors - Content
  TWIKIT_CONTENT_QUALITY_ERROR = 'TWIKIT_CONTENT_QUALITY_ERROR',
  TWIKIT_CONTENT_TOO_LONG = 'TWIKIT_CONTENT_TOO_LONG',
  TWIKIT_CONTENT_DUPLICATE = 'TWIKIT_CONTENT_DUPLICATE',
  TWIKIT_CONTENT_SPAM_DETECTED = 'TWIKIT_CONTENT_SPAM_DETECTED',
  TWIKIT_CONTENT_POLICY_VIOLATION = 'TWIKIT_CONTENT_POLICY_VIOLATION',
  TWIKIT_MEDIA_UPLOAD_FAILED = 'TWIKIT_MEDIA_UPLOAD_FAILED',
  TWIKIT_MEDIA_FORMAT_UNSUPPORTED = 'TWIKIT_MEDIA_FORMAT_UNSUPPORTED',

  // Twikit-specific Errors - Rate Limiting
  TWIKIT_RATE_LIMIT_EXCEEDED = 'TWIKIT_RATE_LIMIT_EXCEEDED',
  TWIKIT_RATE_LIMIT_TWEET = 'TWIKIT_RATE_LIMIT_TWEET',
  TWIKIT_RATE_LIMIT_FOLLOW = 'TWIKIT_RATE_LIMIT_FOLLOW',
  TWIKIT_RATE_LIMIT_LIKE = 'TWIKIT_RATE_LIMIT_LIKE',
  TWIKIT_RATE_LIMIT_RETWEET = 'TWIKIT_RATE_LIMIT_RETWEET',
  TWIKIT_RATE_LIMIT_DM = 'TWIKIT_RATE_LIMIT_DM',
  TWIKIT_RATE_LIMIT_SEARCH = 'TWIKIT_RATE_LIMIT_SEARCH',

  // Twikit-specific Errors - Network & Proxy
  TWIKIT_PROXY_ERROR = 'TWIKIT_PROXY_ERROR',
  TWIKIT_PROXY_CONNECTION_FAILED = 'TWIKIT_PROXY_CONNECTION_FAILED',
  TWIKIT_PROXY_AUTHENTICATION_FAILED = 'TWIKIT_PROXY_AUTHENTICATION_FAILED',
  TWIKIT_PROXY_TIMEOUT = 'TWIKIT_PROXY_TIMEOUT',
  TWIKIT_PROXY_BLOCKED = 'TWIKIT_PROXY_BLOCKED',
  TWIKIT_NETWORK_ERROR = 'TWIKIT_NETWORK_ERROR',
  TWIKIT_CONNECTION_TIMEOUT = 'TWIKIT_CONNECTION_TIMEOUT',
  TWIKIT_DNS_RESOLUTION_FAILED = 'TWIKIT_DNS_RESOLUTION_FAILED',

  // Twikit-specific Errors - Actions
  TWIKIT_TWEET_CREATION_FAILED = 'TWIKIT_TWEET_CREATION_FAILED',
  TWIKIT_TWEET_DELETION_FAILED = 'TWIKIT_TWEET_DELETION_FAILED',
  TWIKIT_FOLLOW_ACTION_FAILED = 'TWIKIT_FOLLOW_ACTION_FAILED',
  TWIKIT_UNFOLLOW_ACTION_FAILED = 'TWIKIT_UNFOLLOW_ACTION_FAILED',
  TWIKIT_LIKE_ACTION_FAILED = 'TWIKIT_LIKE_ACTION_FAILED',
  TWIKIT_UNLIKE_ACTION_FAILED = 'TWIKIT_UNLIKE_ACTION_FAILED',
  TWIKIT_RETWEET_ACTION_FAILED = 'TWIKIT_RETWEET_ACTION_FAILED',
  TWIKIT_UNRETWEET_ACTION_FAILED = 'TWIKIT_UNRETWEET_ACTION_FAILED',
  TWIKIT_DM_SEND_FAILED = 'TWIKIT_DM_SEND_FAILED',
  TWIKIT_SEARCH_FAILED = 'TWIKIT_SEARCH_FAILED',
  TWIKIT_PROFILE_UPDATE_FAILED = 'TWIKIT_PROFILE_UPDATE_FAILED',

  // Twikit-specific Errors - System
  TWIKIT_CIRCUIT_BREAKER_OPEN = 'TWIKIT_CIRCUIT_BREAKER_OPEN',
  TWIKIT_ACTION_FAILED = 'TWIKIT_ACTION_FAILED',
  TWIKIT_SCRIPT_EXECUTION_ERROR = 'TWIKIT_SCRIPT_EXECUTION_ERROR',
  TWIKIT_TIMEOUT_ERROR = 'TWIKIT_TIMEOUT_ERROR',
  TWIKIT_PYTHON_PROCESS_ERROR = 'TWIKIT_PYTHON_PROCESS_ERROR',
  TWIKIT_PYTHON_IMPORT_ERROR = 'TWIKIT_PYTHON_IMPORT_ERROR',
  TWIKIT_CONFIGURATION_ERROR = 'TWIKIT_CONFIGURATION_ERROR',

  // Twikit-specific Errors - Anti-Detection
  TWIKIT_DETECTION_RISK_HIGH = 'TWIKIT_DETECTION_RISK_HIGH',
  TWIKIT_CAPTCHA_REQUIRED = 'TWIKIT_CAPTCHA_REQUIRED',
  TWIKIT_SUSPICIOUS_ACTIVITY = 'TWIKIT_SUSPICIOUS_ACTIVITY',
  TWIKIT_FINGERPRINT_MISMATCH = 'TWIKIT_FINGERPRINT_MISMATCH',
  TWIKIT_BEHAVIOR_ANOMALY = 'TWIKIT_BEHAVIOR_ANOMALY',

  // Twikit-specific Errors - Generic
  TWIKIT_UNKNOWN_ERROR = 'TWIKIT_UNKNOWN_ERROR',
  TWIKIT_INTERNAL_ERROR = 'TWIKIT_INTERNAL_ERROR',
  TWIKIT_VALIDATION_ERROR = 'TWIKIT_VALIDATION_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ErrorCategory {
  TRANSIENT = 'TRANSIENT',        // Temporary errors that may resolve
  PERMANENT = 'PERMANENT',        // Errors that won't resolve without intervention
  BUSINESS = 'BUSINESS',          // Business logic violations
  SECURITY = 'SECURITY',          // Security-related errors
  PERFORMANCE = 'PERFORMANCE',    // Performance-related errors
  INFRASTRUCTURE = 'INFRASTRUCTURE' // Infrastructure/system errors
}

export enum RecoveryStrategy {
  RETRY = 'RETRY',
  FALLBACK = 'FALLBACK',
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
  GRACEFUL_DEGRADATION = 'GRACEFUL_DEGRADATION',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION',
  IGNORE = 'IGNORE'
}

// Enterprise Error Interface
export interface EnterpriseError {
  // Core Error Information
  id: string;                     // Unique error identifier
  correlationId: string;          // Distributed tracing correlation ID
  type: ErrorType;               // Error type classification
  category: ErrorCategory;       // Error category
  severity: ErrorSeverity;       // Error severity level
  
  // Error Details
  code: string;                  // Machine-readable error code
  message: string;               // Human-readable error message
  details?: any;                 // Additional error details
  cause?: Error;                 // Original error cause
  
  // Context Information
  service: string;               // Service where error occurred
  operation: string;             // Operation that failed
  userId?: string;               // User ID if applicable
  sessionId?: string;            // Session ID if applicable
  
  // Timing Information
  timestamp: Date;               // When error occurred
  duration?: number;             // Operation duration before failure
  
  // Recovery Information
  retryable: boolean;            // Whether error is retryable
  recoveryStrategy: RecoveryStrategy; // Recommended recovery strategy
  retryAfter?: number;           // Suggested retry delay (seconds)
  maxRetries?: number;           // Maximum retry attempts
  
  // Tracing Information
  traceId?: string;              // OpenTelemetry trace ID
  spanId?: string;               // OpenTelemetry span ID
  parentSpanId?: string;         // Parent span ID
  
  // Metadata
  metadata?: Record<string, any>; // Additional metadata
  tags?: string[];               // Error tags for categorization
  fingerprint?: string;          // Error fingerprint for deduplication
  
  // Resolution Information
  resolved?: boolean;            // Whether error has been resolved
  resolvedAt?: Date;             // When error was resolved
  resolution?: string;           // How error was resolved
}

// Error Context for Enhanced Debugging
export interface ErrorContext {
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
    query?: Record<string, any>;
  };
  response?: {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: any;
  };
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
  system?: {
    hostname?: string;
    pid?: number;
    memory?: NodeJS.MemoryUsage;
    uptime?: number;
  };
  performance?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
    memoryUsage?: number;
  };
}

// Error Metrics for Analytics
export interface ErrorMetrics {
  count: number;
  rate: number;
  averageDuration: number;
  p95Duration: number;
  p99Duration: number;
  successRate: number;
  retryRate: number;
  recoveryRate: number;
}

/**
 * Enterprise Error Class
 */
export class EnterpriseErrorClass extends Error implements EnterpriseError {
  public readonly id: string;
  public readonly correlationId: string;
  public readonly type: ErrorType;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly details?: any;
  public readonly cause?: Error;
  public readonly service: string;
  public readonly operation: string;
  public readonly userId?: string;
  public readonly sessionId?: string;
  public readonly timestamp: Date;
  public readonly duration?: number;
  public readonly retryable: boolean;
  public readonly recoveryStrategy: RecoveryStrategy;
  public readonly retryAfter?: number;
  public readonly maxRetries?: number;
  public readonly traceId?: string;
  public readonly spanId?: string;
  public readonly parentSpanId?: string;
  public readonly metadata?: Record<string, any>;
  public readonly tags?: string[];
  public readonly fingerprint?: string;
  public resolved?: boolean;
  public resolvedAt?: Date;
  public resolution?: string;

  constructor(config: Partial<EnterpriseError> & { message: string; type: ErrorType }) {
    super(config.message);

    this.name = 'EnterpriseError';
    this.id = config.id || this.generateErrorId();
    this.correlationId = config.correlationId || this.generateCorrelationId();
    this.type = config.type;
    this.category = config.category || this.inferCategory(config.type);
    this.severity = config.severity || this.inferSeverity(config.type);
    this.code = config.code || this.generateErrorCode(config.type);
    this.retryable = config.retryable ?? this.inferRetryable(config.type);
    this.recoveryStrategy = config.recoveryStrategy || this.inferRecoveryStrategy(config.type);
    this.service = config.service || process.env.SERVICE_NAME || 'unknown';
    this.operation = config.operation || 'unknown';
    this.timestamp = config.timestamp || new Date();
    this.fingerprint = config.fingerprint || this.generateFingerprint();
    this.resolved = config.resolved || false;

    // Optional properties - only set if provided
    if (config.details !== undefined) {
      this.details = config.details;
    }
    if (config.cause !== undefined) {
      this.cause = config.cause;
    }
    if (config.userId !== undefined) {
      this.userId = config.userId;
    }
    if (config.sessionId !== undefined) {
      this.sessionId = config.sessionId;
    }
    if (config.duration !== undefined) {
      this.duration = config.duration;
    }
    if (config.retryAfter !== undefined) {
      this.retryAfter = config.retryAfter;
    }
    if (config.maxRetries !== undefined) {
      this.maxRetries = config.maxRetries;
    }
    if (config.traceId !== undefined) {
      this.traceId = config.traceId;
    } else {
      const currentTraceId = this.getCurrentTraceId();
      if (currentTraceId) {
        this.traceId = currentTraceId;
      }
    }
    if (config.spanId !== undefined) {
      this.spanId = config.spanId;
    } else {
      const currentSpanId = this.getCurrentSpanId();
      if (currentSpanId) {
        this.spanId = currentSpanId;
      }
    }
    if (config.parentSpanId !== undefined) {
      this.parentSpanId = config.parentSpanId;
    }
    if (config.metadata !== undefined) {
      this.metadata = config.metadata;
    }
    if (config.tags !== undefined) {
      this.tags = config.tags;
    }
    if (config.resolvedAt !== undefined) {
      this.resolvedAt = config.resolvedAt;
    }
    if (config.resolution !== undefined) {
      this.resolution = config.resolution;
    }

    // Capture stack trace
    Error.captureStackTrace(this, EnterpriseErrorClass);
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID for distributed tracing
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Infer error category from type
   */
  private inferCategory(type: ErrorType): ErrorCategory {
    const categoryMap: Record<ErrorType, ErrorCategory> = {
      [ErrorType.SYSTEM_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.DATABASE_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.NETWORK_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorType.TIMEOUT_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorType.MEMORY_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.VALIDATION_ERROR]: ErrorCategory.BUSINESS,
      [ErrorType.BUSINESS_RULE_ERROR]: ErrorCategory.BUSINESS,
      [ErrorType.WORKFLOW_ERROR]: ErrorCategory.BUSINESS,
      [ErrorType.STATE_ERROR]: ErrorCategory.BUSINESS,
      [ErrorType.AUTHENTICATION_ERROR]: ErrorCategory.SECURITY,
      [ErrorType.AUTHORIZATION_ERROR]: ErrorCategory.SECURITY,
      [ErrorType.TOKEN_ERROR]: ErrorCategory.SECURITY,
      [ErrorType.PERMISSION_ERROR]: ErrorCategory.SECURITY,
      [ErrorType.EXTERNAL_API_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorType.THIRD_PARTY_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorType.INTEGRATION_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.RATE_LIMIT_ERROR]: ErrorCategory.PERFORMANCE,
      [ErrorType.QUOTA_EXCEEDED_ERROR]: ErrorCategory.PERFORMANCE,
      [ErrorType.THROTTLING_ERROR]: ErrorCategory.PERFORMANCE,
      [ErrorType.RESOURCE_NOT_FOUND]: ErrorCategory.BUSINESS,
      [ErrorType.RESOURCE_CONFLICT]: ErrorCategory.BUSINESS,
      [ErrorType.RESOURCE_EXHAUSTED]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.CONFIGURATION_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.ENVIRONMENT_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.DEPENDENCY_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_AUTHENTICATION_ERROR]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_AUTHENTICATION_FAILED]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_AUTHENTICATION_REQUIRED]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_ACCOUNT_LOCKED]: ErrorCategory.PERMANENT,
      [ErrorType.TWIKIT_ACCOUNT_SUSPENDED]: ErrorCategory.PERMANENT,
      [ErrorType.TWIKIT_SESSION_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_SESSION_CREATION_FAILED]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_CONTENT_QUALITY_ERROR]: ErrorCategory.BUSINESS,
      [ErrorType.TWIKIT_CIRCUIT_BREAKER_OPEN]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_PROXY_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_RATE_LIMIT_EXCEEDED]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_ACTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_SCRIPT_EXECUTION_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_TIMEOUT_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_UNKNOWN_ERROR]: ErrorCategory.TRANSIENT,

      // Additional Twikit Error Categories
      [ErrorType.TWIKIT_ACCOUNT_RESTRICTED]: ErrorCategory.PERMANENT,
      [ErrorType.TWIKIT_INVALID_CREDENTIALS]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_TWO_FACTOR_REQUIRED]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_SESSION_EXPIRED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_SESSION_INVALID]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_SESSION_LIMIT_EXCEEDED]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_CONTENT_TOO_LONG]: ErrorCategory.BUSINESS,
      [ErrorType.TWIKIT_CONTENT_DUPLICATE]: ErrorCategory.BUSINESS,
      [ErrorType.TWIKIT_CONTENT_SPAM_DETECTED]: ErrorCategory.BUSINESS,
      [ErrorType.TWIKIT_CONTENT_POLICY_VIOLATION]: ErrorCategory.PERMANENT,
      [ErrorType.TWIKIT_MEDIA_UPLOAD_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_MEDIA_FORMAT_UNSUPPORTED]: ErrorCategory.BUSINESS,
      [ErrorType.TWIKIT_RATE_LIMIT_TWEET]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_RATE_LIMIT_FOLLOW]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_RATE_LIMIT_LIKE]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_RATE_LIMIT_RETWEET]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_RATE_LIMIT_DM]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_RATE_LIMIT_SEARCH]: ErrorCategory.PERFORMANCE,
      [ErrorType.TWIKIT_PROXY_CONNECTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_PROXY_AUTHENTICATION_FAILED]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_PROXY_TIMEOUT]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_PROXY_BLOCKED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_NETWORK_ERROR]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_CONNECTION_TIMEOUT]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_DNS_RESOLUTION_FAILED]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_TWEET_CREATION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_TWEET_DELETION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_FOLLOW_ACTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_UNFOLLOW_ACTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_LIKE_ACTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_UNLIKE_ACTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_RETWEET_ACTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_UNRETWEET_ACTION_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_DM_SEND_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_SEARCH_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_PROFILE_UPDATE_FAILED]: ErrorCategory.TRANSIENT,
      [ErrorType.TWIKIT_PYTHON_PROCESS_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_PYTHON_IMPORT_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_CONFIGURATION_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_DETECTION_RISK_HIGH]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_CAPTCHA_REQUIRED]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_SUSPICIOUS_ACTIVITY]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_FINGERPRINT_MISMATCH]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_BEHAVIOR_ANOMALY]: ErrorCategory.SECURITY,
      [ErrorType.TWIKIT_INTERNAL_ERROR]: ErrorCategory.INFRASTRUCTURE,
      [ErrorType.TWIKIT_VALIDATION_ERROR]: ErrorCategory.BUSINESS
    };
    
    return categoryMap[type] || ErrorCategory.INFRASTRUCTURE;
  }

  /**
   * Infer error severity from type
   */
  private inferSeverity(type: ErrorType): ErrorSeverity {
    const severityMap: Record<ErrorType, ErrorSeverity> = {
      [ErrorType.SYSTEM_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorType.DATABASE_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.MEMORY_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorType.VALIDATION_ERROR]: ErrorSeverity.LOW,
      [ErrorType.BUSINESS_RULE_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.WORKFLOW_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.STATE_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.AUTHORIZATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.TOKEN_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.PERMISSION_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.EXTERNAL_API_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.THIRD_PARTY_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.INTEGRATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.RATE_LIMIT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.QUOTA_EXCEEDED_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.THROTTLING_ERROR]: ErrorSeverity.LOW,
      [ErrorType.RESOURCE_NOT_FOUND]: ErrorSeverity.LOW,
      [ErrorType.RESOURCE_CONFLICT]: ErrorSeverity.MEDIUM,
      [ErrorType.RESOURCE_EXHAUSTED]: ErrorSeverity.HIGH,
      [ErrorType.CONFIGURATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.ENVIRONMENT_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.DEPENDENCY_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_AUTHENTICATION_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_AUTHENTICATION_FAILED]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_AUTHENTICATION_REQUIRED]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_ACCOUNT_LOCKED]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_ACCOUNT_SUSPENDED]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_SESSION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_SESSION_CREATION_FAILED]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_CONTENT_QUALITY_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_CIRCUIT_BREAKER_OPEN]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_PROXY_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_RATE_LIMIT_EXCEEDED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_ACTION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_SCRIPT_EXECUTION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_UNKNOWN_ERROR]: ErrorSeverity.MEDIUM,

      // Additional Twikit Error Severities
      [ErrorType.TWIKIT_ACCOUNT_RESTRICTED]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_INVALID_CREDENTIALS]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_TWO_FACTOR_REQUIRED]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_SESSION_EXPIRED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_SESSION_INVALID]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_SESSION_LIMIT_EXCEEDED]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_CONTENT_TOO_LONG]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_CONTENT_DUPLICATE]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_CONTENT_SPAM_DETECTED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_CONTENT_POLICY_VIOLATION]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_MEDIA_UPLOAD_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_MEDIA_FORMAT_UNSUPPORTED]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_RATE_LIMIT_TWEET]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_RATE_LIMIT_FOLLOW]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_RATE_LIMIT_LIKE]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_RATE_LIMIT_RETWEET]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_RATE_LIMIT_DM]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_RATE_LIMIT_SEARCH]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_PROXY_CONNECTION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_PROXY_AUTHENTICATION_FAILED]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_PROXY_TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_PROXY_BLOCKED]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_CONNECTION_TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_DNS_RESOLUTION_FAILED]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_TWEET_CREATION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_TWEET_DELETION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_FOLLOW_ACTION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_UNFOLLOW_ACTION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_LIKE_ACTION_FAILED]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_UNLIKE_ACTION_FAILED]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_RETWEET_ACTION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_UNRETWEET_ACTION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_DM_SEND_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_SEARCH_FAILED]: ErrorSeverity.LOW,
      [ErrorType.TWIKIT_PROFILE_UPDATE_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.TWIKIT_PYTHON_PROCESS_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_PYTHON_IMPORT_ERROR]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_CONFIGURATION_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_DETECTION_RISK_HIGH]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_CAPTCHA_REQUIRED]: ErrorSeverity.CRITICAL,
      [ErrorType.TWIKIT_SUSPICIOUS_ACTIVITY]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_FINGERPRINT_MISMATCH]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_BEHAVIOR_ANOMALY]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_INTERNAL_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.TWIKIT_VALIDATION_ERROR]: ErrorSeverity.MEDIUM
    };
    
    return severityMap[type] || ErrorSeverity.MEDIUM;
  }

  /**
   * Generate machine-readable error code
   */
  private generateErrorCode(type: ErrorType): string {
    const codeMap: Record<ErrorType, string> = {
      [ErrorType.SYSTEM_ERROR]: 'SYS_001',
      [ErrorType.DATABASE_ERROR]: 'DB_001',
      [ErrorType.NETWORK_ERROR]: 'NET_001',
      [ErrorType.TIMEOUT_ERROR]: 'TMO_001',
      [ErrorType.MEMORY_ERROR]: 'MEM_001',
      [ErrorType.VALIDATION_ERROR]: 'VAL_001',
      [ErrorType.BUSINESS_RULE_ERROR]: 'BIZ_001',
      [ErrorType.WORKFLOW_ERROR]: 'WFL_001',
      [ErrorType.STATE_ERROR]: 'STA_001',
      [ErrorType.AUTHENTICATION_ERROR]: 'AUTH_001',
      [ErrorType.AUTHORIZATION_ERROR]: 'AUTHZ_001',
      [ErrorType.TOKEN_ERROR]: 'TOK_001',
      [ErrorType.PERMISSION_ERROR]: 'PERM_001',
      [ErrorType.EXTERNAL_API_ERROR]: 'EXT_001',
      [ErrorType.THIRD_PARTY_ERROR]: 'TP_001',
      [ErrorType.INTEGRATION_ERROR]: 'INT_001',
      [ErrorType.RATE_LIMIT_ERROR]: 'RATE_001',
      [ErrorType.QUOTA_EXCEEDED_ERROR]: 'QUOTA_001',
      [ErrorType.THROTTLING_ERROR]: 'THROT_001',
      [ErrorType.RESOURCE_NOT_FOUND]: 'RES_404',
      [ErrorType.RESOURCE_CONFLICT]: 'RES_409',
      [ErrorType.RESOURCE_EXHAUSTED]: 'RES_503',
      [ErrorType.CONFIGURATION_ERROR]: 'CFG_001',
      [ErrorType.ENVIRONMENT_ERROR]: 'ENV_001',
      [ErrorType.DEPENDENCY_ERROR]: 'DEP_001',
      [ErrorType.TWIKIT_AUTHENTICATION_ERROR]: 'TWIKIT_AUTH_000',
      [ErrorType.TWIKIT_AUTHENTICATION_FAILED]: 'TWIKIT_AUTH_001',
      [ErrorType.TWIKIT_AUTHENTICATION_REQUIRED]: 'TWIKIT_AUTH_002',
      [ErrorType.TWIKIT_ACCOUNT_LOCKED]: 'TWIKIT_ACC_002',
      [ErrorType.TWIKIT_ACCOUNT_SUSPENDED]: 'TWIKIT_ACC_001',
      [ErrorType.TWIKIT_SESSION_ERROR]: 'TWIKIT_SES_000',
      [ErrorType.TWIKIT_SESSION_CREATION_FAILED]: 'TWIKIT_SES_001',
      [ErrorType.TWIKIT_CONTENT_QUALITY_ERROR]: 'TWIKIT_QUA_001',
      [ErrorType.TWIKIT_CIRCUIT_BREAKER_OPEN]: 'TWIKIT_CB_001',
      [ErrorType.TWIKIT_PROXY_ERROR]: 'TWIKIT_PRX_001',
      [ErrorType.TWIKIT_RATE_LIMIT_EXCEEDED]: 'TWIKIT_RATE_001',
      [ErrorType.TWIKIT_ACTION_FAILED]: 'TWIKIT_ACT_001',
      [ErrorType.TWIKIT_SCRIPT_EXECUTION_ERROR]: 'TWIKIT_SCR_001',
      [ErrorType.TWIKIT_TIMEOUT_ERROR]: 'TWIKIT_TMO_001',
      [ErrorType.TWIKIT_UNKNOWN_ERROR]: 'TWIKIT_UNK_001',

      // Additional Twikit Error Codes
      [ErrorType.TWIKIT_ACCOUNT_RESTRICTED]: 'TWIKIT_ACC_003',
      [ErrorType.TWIKIT_INVALID_CREDENTIALS]: 'TWIKIT_AUTH_003',
      [ErrorType.TWIKIT_TWO_FACTOR_REQUIRED]: 'TWIKIT_AUTH_004',
      [ErrorType.TWIKIT_SESSION_EXPIRED]: 'TWIKIT_SES_002',
      [ErrorType.TWIKIT_SESSION_INVALID]: 'TWIKIT_SES_003',
      [ErrorType.TWIKIT_SESSION_LIMIT_EXCEEDED]: 'TWIKIT_SES_004',
      [ErrorType.TWIKIT_CONTENT_TOO_LONG]: 'TWIKIT_CNT_001',
      [ErrorType.TWIKIT_CONTENT_DUPLICATE]: 'TWIKIT_CNT_002',
      [ErrorType.TWIKIT_CONTENT_SPAM_DETECTED]: 'TWIKIT_CNT_003',
      [ErrorType.TWIKIT_CONTENT_POLICY_VIOLATION]: 'TWIKIT_CNT_004',
      [ErrorType.TWIKIT_MEDIA_UPLOAD_FAILED]: 'TWIKIT_MED_001',
      [ErrorType.TWIKIT_MEDIA_FORMAT_UNSUPPORTED]: 'TWIKIT_MED_002',
      [ErrorType.TWIKIT_RATE_LIMIT_TWEET]: 'TWIKIT_RATE_002',
      [ErrorType.TWIKIT_RATE_LIMIT_FOLLOW]: 'TWIKIT_RATE_003',
      [ErrorType.TWIKIT_RATE_LIMIT_LIKE]: 'TWIKIT_RATE_004',
      [ErrorType.TWIKIT_RATE_LIMIT_RETWEET]: 'TWIKIT_RATE_005',
      [ErrorType.TWIKIT_RATE_LIMIT_DM]: 'TWIKIT_RATE_006',
      [ErrorType.TWIKIT_RATE_LIMIT_SEARCH]: 'TWIKIT_RATE_007',
      [ErrorType.TWIKIT_PROXY_CONNECTION_FAILED]: 'TWIKIT_PRX_002',
      [ErrorType.TWIKIT_PROXY_AUTHENTICATION_FAILED]: 'TWIKIT_PRX_003',
      [ErrorType.TWIKIT_PROXY_TIMEOUT]: 'TWIKIT_PRX_004',
      [ErrorType.TWIKIT_PROXY_BLOCKED]: 'TWIKIT_PRX_005',
      [ErrorType.TWIKIT_NETWORK_ERROR]: 'TWIKIT_NET_001',
      [ErrorType.TWIKIT_CONNECTION_TIMEOUT]: 'TWIKIT_NET_002',
      [ErrorType.TWIKIT_DNS_RESOLUTION_FAILED]: 'TWIKIT_NET_003',
      [ErrorType.TWIKIT_TWEET_CREATION_FAILED]: 'TWIKIT_TWE_001',
      [ErrorType.TWIKIT_TWEET_DELETION_FAILED]: 'TWIKIT_TWE_002',
      [ErrorType.TWIKIT_FOLLOW_ACTION_FAILED]: 'TWIKIT_FOL_001',
      [ErrorType.TWIKIT_UNFOLLOW_ACTION_FAILED]: 'TWIKIT_FOL_002',
      [ErrorType.TWIKIT_LIKE_ACTION_FAILED]: 'TWIKIT_LIK_001',
      [ErrorType.TWIKIT_UNLIKE_ACTION_FAILED]: 'TWIKIT_LIK_002',
      [ErrorType.TWIKIT_RETWEET_ACTION_FAILED]: 'TWIKIT_RET_001',
      [ErrorType.TWIKIT_UNRETWEET_ACTION_FAILED]: 'TWIKIT_RET_002',
      [ErrorType.TWIKIT_DM_SEND_FAILED]: 'TWIKIT_DM_001',
      [ErrorType.TWIKIT_SEARCH_FAILED]: 'TWIKIT_SEA_001',
      [ErrorType.TWIKIT_PROFILE_UPDATE_FAILED]: 'TWIKIT_PRO_001',
      [ErrorType.TWIKIT_PYTHON_PROCESS_ERROR]: 'TWIKIT_PYT_001',
      [ErrorType.TWIKIT_PYTHON_IMPORT_ERROR]: 'TWIKIT_PYT_002',
      [ErrorType.TWIKIT_CONFIGURATION_ERROR]: 'TWIKIT_CFG_001',
      [ErrorType.TWIKIT_DETECTION_RISK_HIGH]: 'TWIKIT_DET_001',
      [ErrorType.TWIKIT_CAPTCHA_REQUIRED]: 'TWIKIT_DET_002',
      [ErrorType.TWIKIT_SUSPICIOUS_ACTIVITY]: 'TWIKIT_DET_003',
      [ErrorType.TWIKIT_FINGERPRINT_MISMATCH]: 'TWIKIT_DET_004',
      [ErrorType.TWIKIT_BEHAVIOR_ANOMALY]: 'TWIKIT_DET_005',
      [ErrorType.TWIKIT_INTERNAL_ERROR]: 'TWIKIT_INT_001',
      [ErrorType.TWIKIT_VALIDATION_ERROR]: 'TWIKIT_VAL_001'
    };

    return codeMap[type] || 'UNK_001';
  }

  /**
   * Infer if error is retryable
   */
  private inferRetryable(type: ErrorType): boolean {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.DATABASE_ERROR,
      ErrorType.EXTERNAL_API_ERROR,
      ErrorType.THIRD_PARTY_ERROR,
      ErrorType.RATE_LIMIT_ERROR,
      ErrorType.THROTTLING_ERROR,
      ErrorType.RESOURCE_EXHAUSTED
    ];

    return retryableTypes.includes(type);
  }

  /**
   * Infer recovery strategy
   */
  private inferRecoveryStrategy(type: ErrorType): RecoveryStrategy {
    const strategyMap: Record<ErrorType, RecoveryStrategy> = {
      [ErrorType.SYSTEM_ERROR]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.DATABASE_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.NETWORK_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TIMEOUT_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.MEMORY_ERROR]: RecoveryStrategy.GRACEFUL_DEGRADATION,
      [ErrorType.VALIDATION_ERROR]: RecoveryStrategy.IGNORE,
      [ErrorType.BUSINESS_RULE_ERROR]: RecoveryStrategy.IGNORE,
      [ErrorType.WORKFLOW_ERROR]: RecoveryStrategy.FALLBACK,
      [ErrorType.STATE_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.AUTHENTICATION_ERROR]: RecoveryStrategy.IGNORE,
      [ErrorType.AUTHORIZATION_ERROR]: RecoveryStrategy.IGNORE,
      [ErrorType.TOKEN_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.PERMISSION_ERROR]: RecoveryStrategy.IGNORE,
      [ErrorType.EXTERNAL_API_ERROR]: RecoveryStrategy.CIRCUIT_BREAKER,
      [ErrorType.THIRD_PARTY_ERROR]: RecoveryStrategy.FALLBACK,
      [ErrorType.INTEGRATION_ERROR]: RecoveryStrategy.CIRCUIT_BREAKER,
      [ErrorType.RATE_LIMIT_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.QUOTA_EXCEEDED_ERROR]: RecoveryStrategy.GRACEFUL_DEGRADATION,
      [ErrorType.THROTTLING_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.RESOURCE_NOT_FOUND]: RecoveryStrategy.IGNORE,
      [ErrorType.RESOURCE_CONFLICT]: RecoveryStrategy.RETRY,
      [ErrorType.RESOURCE_EXHAUSTED]: RecoveryStrategy.GRACEFUL_DEGRADATION,
      [ErrorType.CONFIGURATION_ERROR]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.ENVIRONMENT_ERROR]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.DEPENDENCY_ERROR]: RecoveryStrategy.CIRCUIT_BREAKER,
      [ErrorType.TWIKIT_AUTHENTICATION_ERROR]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_AUTHENTICATION_FAILED]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_AUTHENTICATION_REQUIRED]: RecoveryStrategy.IGNORE,
      [ErrorType.TWIKIT_ACCOUNT_LOCKED]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_ACCOUNT_SUSPENDED]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_SESSION_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_SESSION_CREATION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_CONTENT_QUALITY_ERROR]: RecoveryStrategy.IGNORE,
      [ErrorType.TWIKIT_CIRCUIT_BREAKER_OPEN]: RecoveryStrategy.CIRCUIT_BREAKER,
      [ErrorType.TWIKIT_PROXY_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_RATE_LIMIT_EXCEEDED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_ACTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_SCRIPT_EXECUTION_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_TIMEOUT_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_UNKNOWN_ERROR]: RecoveryStrategy.RETRY,

      // Additional Twikit Recovery Strategies
      [ErrorType.TWIKIT_ACCOUNT_RESTRICTED]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_INVALID_CREDENTIALS]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_TWO_FACTOR_REQUIRED]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_SESSION_EXPIRED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_SESSION_INVALID]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_SESSION_LIMIT_EXCEEDED]: RecoveryStrategy.CIRCUIT_BREAKER,
      [ErrorType.TWIKIT_CONTENT_TOO_LONG]: RecoveryStrategy.IGNORE,
      [ErrorType.TWIKIT_CONTENT_DUPLICATE]: RecoveryStrategy.IGNORE,
      [ErrorType.TWIKIT_CONTENT_SPAM_DETECTED]: RecoveryStrategy.IGNORE,
      [ErrorType.TWIKIT_CONTENT_POLICY_VIOLATION]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_MEDIA_UPLOAD_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_MEDIA_FORMAT_UNSUPPORTED]: RecoveryStrategy.IGNORE,
      [ErrorType.TWIKIT_RATE_LIMIT_TWEET]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_RATE_LIMIT_FOLLOW]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_RATE_LIMIT_LIKE]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_RATE_LIMIT_RETWEET]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_RATE_LIMIT_DM]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_RATE_LIMIT_SEARCH]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_PROXY_CONNECTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_PROXY_AUTHENTICATION_FAILED]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_PROXY_TIMEOUT]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_PROXY_BLOCKED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_NETWORK_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_CONNECTION_TIMEOUT]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_DNS_RESOLUTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_TWEET_CREATION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_TWEET_DELETION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_FOLLOW_ACTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_UNFOLLOW_ACTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_LIKE_ACTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_UNLIKE_ACTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_RETWEET_ACTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_UNRETWEET_ACTION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_DM_SEND_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_SEARCH_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_PROFILE_UPDATE_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_PYTHON_PROCESS_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_PYTHON_IMPORT_ERROR]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_CONFIGURATION_ERROR]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_DETECTION_RISK_HIGH]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_CAPTCHA_REQUIRED]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_SUSPICIOUS_ACTIVITY]: RecoveryStrategy.MANUAL_INTERVENTION,
      [ErrorType.TWIKIT_FINGERPRINT_MISMATCH]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_BEHAVIOR_ANOMALY]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_INTERNAL_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.TWIKIT_VALIDATION_ERROR]: RecoveryStrategy.IGNORE
    };

    return strategyMap[type] || RecoveryStrategy.MANUAL_INTERVENTION;
  }

  /**
   * Get current trace ID from OpenTelemetry
   */
  private getCurrentTraceId(): string | undefined {
    try {
      const span = trace.getActiveSpan();
      return span?.spanContext().traceId;
    } catch {
      return undefined;
    }
  }

  /**
   * Get current span ID from OpenTelemetry
   */
  private getCurrentSpanId(): string | undefined {
    try {
      const span = trace.getActiveSpan();
      return span?.spanContext().spanId;
    } catch {
      return undefined;
    }
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateFingerprint(): string {
    const components = [
      this.type,
      this.service,
      this.operation,
      this.code,
      this.message.substring(0, 100), // First 100 chars of message
      JSON.stringify(this.details || {}) // Include details for uniqueness
    ];

    // Use crypto hash for better uniqueness
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(components.join('|'));
    const fingerprint = hash.digest('hex').substring(0, 16);

    // Debug logging for fingerprint generation (disabled)
    // if (process.env.NODE_ENV === 'test') {
    //   console.log('Fingerprint components:', components);
    //   console.log('Generated fingerprint:', fingerprint);
    // }

    return fingerprint;
  }

  /**
   * Convert error to JSON for serialization
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      correlationId: this.correlationId,
      type: this.type,
      category: this.category,
      severity: this.severity,
      code: this.code,
      message: this.message,
      service: this.service,
      operation: this.operation,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      recoveryStrategy: this.recoveryStrategy,
      fingerprint: this.fingerprint,
      resolved: this.resolved,
      ...(this.details !== undefined && { details: this.details }),
      ...(this.userId !== undefined && { userId: this.userId }),
      ...(this.sessionId !== undefined && { sessionId: this.sessionId }),
      ...(this.duration !== undefined && { duration: this.duration }),
      ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
      ...(this.maxRetries !== undefined && { maxRetries: this.maxRetries }),
      ...(this.traceId !== undefined && { traceId: this.traceId }),
      ...(this.spanId !== undefined && { spanId: this.spanId }),
      ...(this.parentSpanId !== undefined && { parentSpanId: this.parentSpanId }),
      ...(this.metadata !== undefined && { metadata: this.metadata }),
      ...(this.tags !== undefined && { tags: this.tags }),
      ...(this.resolvedAt !== undefined && { resolvedAt: this.resolvedAt.toISOString() }),
      ...(this.resolution !== undefined && { resolution: this.resolution }),
      stack: this.stack
    };
  }

  /**
   * Convert error to standardized HTTP response format
   */
  toHttpResponse(): {
    success: false;
    error: {
      id: string;
      correlationId: string;
      type: string;
      code: string;
      message: string;
      details?: any;
      retryable: boolean;
      retryAfter?: number;
      timestamp: string;
      traceId?: string;
    };
  } {
    return {
      success: false,
      error: {
        id: this.id,
        correlationId: this.correlationId,
        type: this.type,
        code: this.code,
        message: this.message,
        details: this.details,
        retryable: this.retryable,
        ...(this.retryAfter && { retryAfter: this.retryAfter }),
        timestamp: this.timestamp.toISOString(),
        ...(this.traceId && { traceId: this.traceId })
      }
    };
  }

  /**
   * Mark error as resolved
   */
  resolve(resolution: string): void {
    this.resolved = true;
    this.resolvedAt = new Date();
    this.resolution = resolution;
  }

  /**
   * Create child error with same correlation context
   */
  createChild(config: Partial<EnterpriseError> & { message: string; type: ErrorType }): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      ...config,
      correlationId: this.correlationId,
      ...(this.spanId && { parentSpanId: this.spanId }),
      service: config.service || this.service,
      ...(config.userId || this.userId ? { userId: config.userId || this.userId } : {}),
      ...(config.sessionId || this.sessionId ? { sessionId: config.sessionId || this.sessionId } : {})
    });
  }
}

/**
 * Enterprise Error Factory for creating standardized errors
 */
export class ErrorFactory {
  private static correlationId: string | null = null;
  private static userId: string | null = null;
  private static sessionId: string | null = null;
  private static service: string = process.env.SERVICE_NAME || 'unknown';

  /**
   * Set correlation context for all subsequent errors
   */
  static setContext(context: {
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    service?: string;
  }): void {
    if (context.correlationId) this.correlationId = context.correlationId;
    if (context.userId) this.userId = context.userId;
    if (context.sessionId) this.sessionId = context.sessionId;
    if (context.service) this.service = context.service;
  }

  /**
   * Clear correlation context
   */
  static clearContext(): void {
    this.correlationId = null;
    this.userId = null;
    this.sessionId = null;
    this.service = process.env.SERVICE_NAME || 'unknown';
  }

  /**
   * Create system error
   */
  static createSystemError(message: string, details?: any, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.SYSTEM_ERROR,
      message,
      details,
      operation: operation || 'system_operation',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create database error
   */
  static createDatabaseError(message: string, details?: any, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.DATABASE_ERROR,
      message,
      details,
      operation: operation || 'database_operation',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create validation error
   */
  static createValidationError(message: string, details?: any, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.VALIDATION_ERROR,
      message,
      details,
      operation: operation || 'validation',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create authentication error
   */
  static createAuthenticationError(message: string, details?: any, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.AUTHENTICATION_ERROR,
      message,
      details,
      operation: operation || 'authentication',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create authorization error
   */
  static createAuthorizationError(message: string, details?: any, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.AUTHORIZATION_ERROR,
      message,
      details,
      operation: operation || 'authorization',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create external API error
   */
  static createExternalApiError(message: string, details?: any, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.EXTERNAL_API_ERROR,
      message,
      details,
      operation: operation || 'external_api_call',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create rate limit error
   */
  static createRateLimitError(message: string, retryAfter?: number, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.RATE_LIMIT_ERROR,
      message,
      ...(retryAfter !== undefined && { retryAfter }),
      operation: operation || 'rate_limited_operation',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create resource not found error
   */
  static createNotFoundError(resource: string, id?: string, operation?: string): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.RESOURCE_NOT_FOUND,
      message: `${resource}${id ? ` with ID ${id}` : ''} not found`,
      details: { resource, ...(id !== undefined && { id }) },
      operation: operation || 'resource_lookup',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Create timeout error
   */
  static createTimeoutError(operation: string, timeout: number, details?: any): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type: ErrorType.TIMEOUT_ERROR,
      message: `Operation ${operation} timed out after ${timeout}ms`,
      details: { timeout, ...details },
      operation,
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }

  /**
   * Wrap existing error with enterprise error
   */
  static wrapError(error: Error, type: ErrorType, operation?: string, details?: any): EnterpriseErrorClass {
    return new EnterpriseErrorClass({
      type,
      message: error.message,
      cause: error,
      details,
      operation: operation || 'unknown_operation',
      ...(this.correlationId && { correlationId: this.correlationId }),
      ...(this.userId && { userId: this.userId }),
      ...(this.sessionId && { sessionId: this.sessionId }),
      service: this.service
    });
  }
}

/**
 * Error Utilities
 */
export class ErrorUtils {
  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error | EnterpriseError): boolean {
    if (error instanceof EnterpriseErrorClass) {
      return error.retryable;
    }

    // Check common retryable error patterns
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

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Extract correlation ID from error
   */
  static getCorrelationId(error: Error | EnterpriseError): string | undefined {
    if (error instanceof EnterpriseErrorClass) {
      return error.correlationId;
    }
    return undefined;
  }

  /**
   * Check if error is of specific type
   */
  static isErrorType(error: Error | EnterpriseError, type: ErrorType): boolean {
    if (error instanceof EnterpriseErrorClass) {
      return error.type === type;
    }
    return false;
  }

  /**
   * Get error severity
   */
  static getSeverity(error: Error | EnterpriseError): ErrorSeverity {
    if (error instanceof EnterpriseErrorClass) {
      return error.severity;
    }
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Convert any error to enterprise error
   */
  static toEnterpriseError(error: Error, operation?: string): EnterpriseErrorClass {
    if (error instanceof EnterpriseErrorClass) {
      return error;
    }

    // Try to infer error type from message
    const message = error.message.toLowerCase();
    let type = ErrorType.SYSTEM_ERROR;

    if (message.includes('validation') || message.includes('invalid')) {
      type = ErrorType.VALIDATION_ERROR;
    } else if (message.includes('auth') || message.includes('unauthorized')) {
      type = ErrorType.AUTHENTICATION_ERROR;
    } else if (message.includes('permission') || message.includes('forbidden')) {
      type = ErrorType.AUTHORIZATION_ERROR;
    } else if (message.includes('not found') || message.includes('404')) {
      type = ErrorType.RESOURCE_NOT_FOUND;
    } else if (message.includes('timeout')) {
      type = ErrorType.TIMEOUT_ERROR;
    } else if (message.includes('network') || message.includes('connection')) {
      type = ErrorType.NETWORK_ERROR;
    } else if (message.includes('database') || message.includes('sql')) {
      type = ErrorType.DATABASE_ERROR;
    }

    return ErrorFactory.wrapError(error, type, operation);
  }
}

/**
 * Twikit-specific Error Types with Granular Categories
 */
export enum TwikitErrorType {
  // Authentication Errors
  AUTHENTICATION_ERROR = 'TWIKIT_AUTHENTICATION_ERROR',
  AUTHENTICATION_FAILED = 'TWIKIT_AUTHENTICATION_FAILED',
  AUTHENTICATION_REQUIRED = 'TWIKIT_AUTHENTICATION_REQUIRED',
  ACCOUNT_LOCKED = 'TWIKIT_ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED = 'TWIKIT_ACCOUNT_SUSPENDED',
  ACCOUNT_RESTRICTED = 'TWIKIT_ACCOUNT_RESTRICTED',
  INVALID_CREDENTIALS = 'TWIKIT_INVALID_CREDENTIALS',
  TWO_FACTOR_REQUIRED = 'TWIKIT_TWO_FACTOR_REQUIRED',

  // Session Errors
  SESSION_ERROR = 'TWIKIT_SESSION_ERROR',
  SESSION_CREATION_FAILED = 'TWIKIT_SESSION_CREATION_FAILED',
  SESSION_EXPIRED = 'TWIKIT_SESSION_EXPIRED',
  SESSION_INVALID = 'TWIKIT_SESSION_INVALID',
  SESSION_LIMIT_EXCEEDED = 'TWIKIT_SESSION_LIMIT_EXCEEDED',

  // Content Errors
  CONTENT_QUALITY_ERROR = 'TWIKIT_CONTENT_QUALITY_ERROR',
  CONTENT_TOO_LONG = 'TWIKIT_CONTENT_TOO_LONG',
  CONTENT_DUPLICATE = 'TWIKIT_CONTENT_DUPLICATE',
  CONTENT_SPAM_DETECTED = 'TWIKIT_CONTENT_SPAM_DETECTED',
  CONTENT_POLICY_VIOLATION = 'TWIKIT_CONTENT_POLICY_VIOLATION',
  MEDIA_UPLOAD_FAILED = 'TWIKIT_MEDIA_UPLOAD_FAILED',
  MEDIA_FORMAT_UNSUPPORTED = 'TWIKIT_MEDIA_FORMAT_UNSUPPORTED',

  // Rate Limiting Errors
  RATE_LIMIT_EXCEEDED = 'TWIKIT_RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_TWEET = 'TWIKIT_RATE_LIMIT_TWEET',
  RATE_LIMIT_FOLLOW = 'TWIKIT_RATE_LIMIT_FOLLOW',
  RATE_LIMIT_LIKE = 'TWIKIT_RATE_LIMIT_LIKE',
  RATE_LIMIT_RETWEET = 'TWIKIT_RATE_LIMIT_RETWEET',
  RATE_LIMIT_DM = 'TWIKIT_RATE_LIMIT_DM',
  RATE_LIMIT_SEARCH = 'TWIKIT_RATE_LIMIT_SEARCH',

  // Network & Proxy Errors
  PROXY_ERROR = 'TWIKIT_PROXY_ERROR',
  PROXY_CONNECTION_FAILED = 'TWIKIT_PROXY_CONNECTION_FAILED',
  PROXY_AUTHENTICATION_FAILED = 'TWIKIT_PROXY_AUTHENTICATION_FAILED',
  PROXY_TIMEOUT = 'TWIKIT_PROXY_TIMEOUT',
  PROXY_BLOCKED = 'TWIKIT_PROXY_BLOCKED',
  NETWORK_ERROR = 'TWIKIT_NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'TWIKIT_CONNECTION_TIMEOUT',
  DNS_RESOLUTION_FAILED = 'TWIKIT_DNS_RESOLUTION_FAILED',

  // Action-Specific Errors
  TWEET_CREATION_FAILED = 'TWIKIT_TWEET_CREATION_FAILED',
  TWEET_DELETION_FAILED = 'TWIKIT_TWEET_DELETION_FAILED',
  FOLLOW_ACTION_FAILED = 'TWIKIT_FOLLOW_ACTION_FAILED',
  UNFOLLOW_ACTION_FAILED = 'TWIKIT_UNFOLLOW_ACTION_FAILED',
  LIKE_ACTION_FAILED = 'TWIKIT_LIKE_ACTION_FAILED',
  UNLIKE_ACTION_FAILED = 'TWIKIT_UNLIKE_ACTION_FAILED',
  RETWEET_ACTION_FAILED = 'TWIKIT_RETWEET_ACTION_FAILED',
  UNRETWEET_ACTION_FAILED = 'TWIKIT_UNRETWEET_ACTION_FAILED',
  DM_SEND_FAILED = 'TWIKIT_DM_SEND_FAILED',
  SEARCH_FAILED = 'TWIKIT_SEARCH_FAILED',
  PROFILE_UPDATE_FAILED = 'TWIKIT_PROFILE_UPDATE_FAILED',

  // System & Infrastructure Errors
  CIRCUIT_BREAKER_OPEN = 'TWIKIT_CIRCUIT_BREAKER_OPEN',
  ACTION_FAILED = 'TWIKIT_ACTION_FAILED',
  SCRIPT_EXECUTION_ERROR = 'TWIKIT_SCRIPT_EXECUTION_ERROR',
  TIMEOUT_ERROR = 'TWIKIT_TIMEOUT_ERROR',
  PYTHON_PROCESS_ERROR = 'TWIKIT_PYTHON_PROCESS_ERROR',
  PYTHON_IMPORT_ERROR = 'TWIKIT_PYTHON_IMPORT_ERROR',
  CONFIGURATION_ERROR = 'TWIKIT_CONFIGURATION_ERROR',

  // Anti-Detection Errors
  DETECTION_RISK_HIGH = 'TWIKIT_DETECTION_RISK_HIGH',
  CAPTCHA_REQUIRED = 'TWIKIT_CAPTCHA_REQUIRED',
  SUSPICIOUS_ACTIVITY = 'TWIKIT_SUSPICIOUS_ACTIVITY',
  FINGERPRINT_MISMATCH = 'TWIKIT_FINGERPRINT_MISMATCH',
  BEHAVIOR_ANOMALY = 'TWIKIT_BEHAVIOR_ANOMALY',

  // Generic Errors
  UNKNOWN_ERROR = 'TWIKIT_UNKNOWN_ERROR',
  INTERNAL_ERROR = 'TWIKIT_INTERNAL_ERROR',
  VALIDATION_ERROR = 'TWIKIT_VALIDATION_ERROR'
}

/**
 * Twikit-specific Error Class
 */
export class TwikitError extends EnterpriseErrorClass {
  constructor(
    type: TwikitErrorType,
    message: string,
    details?: any,
    cause?: Error
  ) {
    // Map TwikitErrorType to ErrorType - Complete mapping for all error types
    const errorTypeMap: Record<TwikitErrorType, ErrorType> = {
      // Authentication Errors
      [TwikitErrorType.AUTHENTICATION_ERROR]: ErrorType.TWIKIT_AUTHENTICATION_ERROR,
      [TwikitErrorType.AUTHENTICATION_FAILED]: ErrorType.TWIKIT_AUTHENTICATION_FAILED,
      [TwikitErrorType.AUTHENTICATION_REQUIRED]: ErrorType.TWIKIT_AUTHENTICATION_REQUIRED,
      [TwikitErrorType.ACCOUNT_LOCKED]: ErrorType.TWIKIT_ACCOUNT_LOCKED,
      [TwikitErrorType.ACCOUNT_SUSPENDED]: ErrorType.TWIKIT_ACCOUNT_SUSPENDED,
      [TwikitErrorType.ACCOUNT_RESTRICTED]: ErrorType.TWIKIT_ACCOUNT_RESTRICTED,
      [TwikitErrorType.INVALID_CREDENTIALS]: ErrorType.TWIKIT_INVALID_CREDENTIALS,
      [TwikitErrorType.TWO_FACTOR_REQUIRED]: ErrorType.TWIKIT_TWO_FACTOR_REQUIRED,

      // Session Errors
      [TwikitErrorType.SESSION_ERROR]: ErrorType.TWIKIT_SESSION_ERROR,
      [TwikitErrorType.SESSION_CREATION_FAILED]: ErrorType.TWIKIT_SESSION_CREATION_FAILED,
      [TwikitErrorType.SESSION_EXPIRED]: ErrorType.TWIKIT_SESSION_EXPIRED,
      [TwikitErrorType.SESSION_INVALID]: ErrorType.TWIKIT_SESSION_INVALID,
      [TwikitErrorType.SESSION_LIMIT_EXCEEDED]: ErrorType.TWIKIT_SESSION_LIMIT_EXCEEDED,

      // Content Errors
      [TwikitErrorType.CONTENT_QUALITY_ERROR]: ErrorType.TWIKIT_CONTENT_QUALITY_ERROR,
      [TwikitErrorType.CONTENT_TOO_LONG]: ErrorType.TWIKIT_CONTENT_TOO_LONG,
      [TwikitErrorType.CONTENT_DUPLICATE]: ErrorType.TWIKIT_CONTENT_DUPLICATE,
      [TwikitErrorType.CONTENT_SPAM_DETECTED]: ErrorType.TWIKIT_CONTENT_SPAM_DETECTED,
      [TwikitErrorType.CONTENT_POLICY_VIOLATION]: ErrorType.TWIKIT_CONTENT_POLICY_VIOLATION,
      [TwikitErrorType.MEDIA_UPLOAD_FAILED]: ErrorType.TWIKIT_MEDIA_UPLOAD_FAILED,
      [TwikitErrorType.MEDIA_FORMAT_UNSUPPORTED]: ErrorType.TWIKIT_MEDIA_FORMAT_UNSUPPORTED,

      // Rate Limiting Errors
      [TwikitErrorType.RATE_LIMIT_EXCEEDED]: ErrorType.TWIKIT_RATE_LIMIT_EXCEEDED,
      [TwikitErrorType.RATE_LIMIT_TWEET]: ErrorType.TWIKIT_RATE_LIMIT_TWEET,
      [TwikitErrorType.RATE_LIMIT_FOLLOW]: ErrorType.TWIKIT_RATE_LIMIT_FOLLOW,
      [TwikitErrorType.RATE_LIMIT_LIKE]: ErrorType.TWIKIT_RATE_LIMIT_LIKE,
      [TwikitErrorType.RATE_LIMIT_RETWEET]: ErrorType.TWIKIT_RATE_LIMIT_RETWEET,
      [TwikitErrorType.RATE_LIMIT_DM]: ErrorType.TWIKIT_RATE_LIMIT_DM,
      [TwikitErrorType.RATE_LIMIT_SEARCH]: ErrorType.TWIKIT_RATE_LIMIT_SEARCH,

      // Network & Proxy Errors
      [TwikitErrorType.PROXY_ERROR]: ErrorType.TWIKIT_PROXY_ERROR,
      [TwikitErrorType.PROXY_CONNECTION_FAILED]: ErrorType.TWIKIT_PROXY_CONNECTION_FAILED,
      [TwikitErrorType.PROXY_AUTHENTICATION_FAILED]: ErrorType.TWIKIT_PROXY_AUTHENTICATION_FAILED,
      [TwikitErrorType.PROXY_TIMEOUT]: ErrorType.TWIKIT_PROXY_TIMEOUT,
      [TwikitErrorType.PROXY_BLOCKED]: ErrorType.TWIKIT_PROXY_BLOCKED,
      [TwikitErrorType.NETWORK_ERROR]: ErrorType.TWIKIT_NETWORK_ERROR,
      [TwikitErrorType.CONNECTION_TIMEOUT]: ErrorType.TWIKIT_CONNECTION_TIMEOUT,
      [TwikitErrorType.DNS_RESOLUTION_FAILED]: ErrorType.TWIKIT_DNS_RESOLUTION_FAILED,

      // Action-Specific Errors
      [TwikitErrorType.TWEET_CREATION_FAILED]: ErrorType.TWIKIT_TWEET_CREATION_FAILED,
      [TwikitErrorType.TWEET_DELETION_FAILED]: ErrorType.TWIKIT_TWEET_DELETION_FAILED,
      [TwikitErrorType.FOLLOW_ACTION_FAILED]: ErrorType.TWIKIT_FOLLOW_ACTION_FAILED,
      [TwikitErrorType.UNFOLLOW_ACTION_FAILED]: ErrorType.TWIKIT_UNFOLLOW_ACTION_FAILED,
      [TwikitErrorType.LIKE_ACTION_FAILED]: ErrorType.TWIKIT_LIKE_ACTION_FAILED,
      [TwikitErrorType.UNLIKE_ACTION_FAILED]: ErrorType.TWIKIT_UNLIKE_ACTION_FAILED,
      [TwikitErrorType.RETWEET_ACTION_FAILED]: ErrorType.TWIKIT_RETWEET_ACTION_FAILED,
      [TwikitErrorType.UNRETWEET_ACTION_FAILED]: ErrorType.TWIKIT_UNRETWEET_ACTION_FAILED,
      [TwikitErrorType.DM_SEND_FAILED]: ErrorType.TWIKIT_DM_SEND_FAILED,
      [TwikitErrorType.SEARCH_FAILED]: ErrorType.TWIKIT_SEARCH_FAILED,
      [TwikitErrorType.PROFILE_UPDATE_FAILED]: ErrorType.TWIKIT_PROFILE_UPDATE_FAILED,

      // System & Infrastructure Errors
      [TwikitErrorType.CIRCUIT_BREAKER_OPEN]: ErrorType.TWIKIT_CIRCUIT_BREAKER_OPEN,
      [TwikitErrorType.ACTION_FAILED]: ErrorType.TWIKIT_ACTION_FAILED,
      [TwikitErrorType.SCRIPT_EXECUTION_ERROR]: ErrorType.TWIKIT_SCRIPT_EXECUTION_ERROR,
      [TwikitErrorType.TIMEOUT_ERROR]: ErrorType.TWIKIT_TIMEOUT_ERROR,
      [TwikitErrorType.PYTHON_PROCESS_ERROR]: ErrorType.TWIKIT_PYTHON_PROCESS_ERROR,
      [TwikitErrorType.PYTHON_IMPORT_ERROR]: ErrorType.TWIKIT_PYTHON_IMPORT_ERROR,
      [TwikitErrorType.CONFIGURATION_ERROR]: ErrorType.TWIKIT_CONFIGURATION_ERROR,

      // Anti-Detection Errors
      [TwikitErrorType.DETECTION_RISK_HIGH]: ErrorType.TWIKIT_DETECTION_RISK_HIGH,
      [TwikitErrorType.CAPTCHA_REQUIRED]: ErrorType.TWIKIT_CAPTCHA_REQUIRED,
      [TwikitErrorType.SUSPICIOUS_ACTIVITY]: ErrorType.TWIKIT_SUSPICIOUS_ACTIVITY,
      [TwikitErrorType.FINGERPRINT_MISMATCH]: ErrorType.TWIKIT_FINGERPRINT_MISMATCH,
      [TwikitErrorType.BEHAVIOR_ANOMALY]: ErrorType.TWIKIT_BEHAVIOR_ANOMALY,

      // Generic Errors
      [TwikitErrorType.UNKNOWN_ERROR]: ErrorType.TWIKIT_UNKNOWN_ERROR,
      [TwikitErrorType.INTERNAL_ERROR]: ErrorType.TWIKIT_INTERNAL_ERROR,
      [TwikitErrorType.VALIDATION_ERROR]: ErrorType.TWIKIT_VALIDATION_ERROR
    };

    // Determine severity based on error type
    let severity = ErrorSeverity.MEDIUM;
    if (type === TwikitErrorType.ACCOUNT_SUSPENDED ||
        type === TwikitErrorType.ACCOUNT_LOCKED ||
        type === TwikitErrorType.AUTHENTICATION_FAILED ||
        type === TwikitErrorType.AUTHENTICATION_ERROR) {
      severity = ErrorSeverity.CRITICAL;
    } else if (type === TwikitErrorType.RATE_LIMIT_EXCEEDED ||
               type === TwikitErrorType.PROXY_ERROR ||
               type === TwikitErrorType.CIRCUIT_BREAKER_OPEN ||
               type === TwikitErrorType.SESSION_ERROR) {
      severity = ErrorSeverity.HIGH;
    }

    // Determine category
    let category = ErrorCategory.TRANSIENT;
    if (type === TwikitErrorType.ACCOUNT_SUSPENDED ||
        type === TwikitErrorType.ACCOUNT_LOCKED ||
        type === TwikitErrorType.AUTHENTICATION_FAILED ||
        type === TwikitErrorType.AUTHENTICATION_ERROR ||
        type === TwikitErrorType.CONTENT_QUALITY_ERROR) {
      category = ErrorCategory.PERMANENT;
    }

    super({
      type: errorTypeMap[type],
      code: type,
      message,
      details,
      ...(cause && { cause }),
      severity,
      category,
      service: 'twikit',
      operation: details?.action || 'unknown_twikit_operation',
      retryable: category === ErrorCategory.TRANSIENT,
      recoveryStrategy: category === ErrorCategory.TRANSIENT ? RecoveryStrategy.RETRY : RecoveryStrategy.MANUAL_INTERVENTION
    });
  }
}
