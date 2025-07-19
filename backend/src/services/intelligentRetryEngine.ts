/**
 * Intelligent Retry Engine - 2025 Edition
 * Enterprise-grade retry patterns with:
 * - Exponential backoff with jitter
 * - Circuit breaker integration
 * - Adaptive retry strategies
 * - Dead letter queue support
 * - Retry analytics and optimization
 * - Context-aware retry decisions
 */

import { EventEmitter } from 'events';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { EnterpriseErrorClass, ErrorType, ErrorCategory, RecoveryStrategy } from '../errors/enterpriseErrorFramework';
import { correlationManager } from './correlationManager';

// Retry Strategy Configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterType: 'none' | 'full' | 'equal' | 'decorrelated';
  jitterAmount: number;
  timeoutMultiplier: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  retryableErrors: ErrorType[];
  nonRetryableErrors: ErrorType[];
  customRetryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  onSuccess?: (attempt: number, totalTime: number) => void;
  onFailure?: (error: Error, attempts: number, totalTime: number) => void;
}

// Circuit Breaker State
export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

// Retry Attempt Information
export interface RetryAttempt {
  attemptNumber: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: Error;
  success: boolean;
  delay: number;
  circuitBreakerState: string;
  correlationId?: string;
}

// Retry Operation Result
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: RetryAttempt[];
  totalTime: number;
  finalCircuitBreakerState: CircuitBreakerState;
  correlationId?: string;
}

// Dead Letter Queue Entry
export interface DeadLetterEntry {
  id: string;
  correlationId: string;
  operation: string;
  originalError: Error;
  attempts: RetryAttempt[];
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * Intelligent Retry Engine
 */
export class IntelligentRetryEngine extends EventEmitter {
  private static instance: IntelligentRetryEngine;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private deadLetterQueue: DeadLetterEntry[] = [];
  private retryMetrics = new Map<string, {
    totalAttempts: number;
    successfulRetries: number;
    failedRetries: number;
    averageAttempts: number;
    averageDelay: number;
    circuitBreakerTrips: number;
  }>();
  private tracer = trace.getTracer('intelligent-retry-engine', '1.0.0');

  // Default retry configurations for different error types
  private defaultConfigs = new Map<ErrorType, Partial<RetryConfig>>([
    [ErrorType.NETWORK_ERROR, {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterType: 'full',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5
    }],
    [ErrorType.TIMEOUT_ERROR, {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 20000,
      backoffMultiplier: 1.5,
      jitterType: 'equal',
      timeoutMultiplier: 1.5
    }],
    [ErrorType.EXTERNAL_API_ERROR, {
      maxAttempts: 4,
      baseDelay: 1500,
      maxDelay: 60000,
      backoffMultiplier: 2.5,
      jitterType: 'decorrelated',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 3
    }],
    [ErrorType.RATE_LIMIT_ERROR, {
      maxAttempts: 10,
      baseDelay: 5000,
      maxDelay: 300000,
      backoffMultiplier: 1.2,
      jitterType: 'none'
    }],
    [ErrorType.DATABASE_ERROR, {
      maxAttempts: 3,
      baseDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterType: 'full',
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5
    }]
  ]);

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  static getInstance(): IntelligentRetryEngine {
    if (!IntelligentRetryEngine.instance) {
      IntelligentRetryEngine.instance = new IntelligentRetryEngine();
    }
    return IntelligentRetryEngine.instance;
  }

  /**
   * Execute operation with intelligent retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const span = this.tracer.startSpan(`retry_operation_${operationName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'retry.operation': operationName,
        'retry.max_attempts': config?.maxAttempts || 3
      }
    });

    const correlationId = correlationManager.getCorrelationId();
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    
    // Merge with default configuration
    const finalConfig = this.mergeConfig(config);
    
    // Check circuit breaker
    const circuitBreakerKey = operationName;
    if (finalConfig.enableCircuitBreaker && this.isCircuitBreakerOpen(circuitBreakerKey)) {
      const error = new EnterpriseErrorClass({
        type: ErrorType.EXTERNAL_API_ERROR,
        message: `Circuit breaker is open for operation: ${operationName}`,
        operation: operationName,
        correlationId: correlationId || ''
      });
      
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      
      return {
        success: false,
        error,
        attempts: [],
        totalTime: Date.now() - startTime,
        finalCircuitBreakerState: this.getCircuitBreakerState(circuitBreakerKey),
        correlationId: correlationId || ''
      };
    }

    let lastError: Error | undefined;
    let result: T | undefined;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      const attemptStartTime = Date.now();
      const circuitBreakerState = this.getCircuitBreakerState(circuitBreakerKey);
      
      try {
        // Execute operation
        result = await operation();
        
        const attemptEndTime = Date.now();
        const attemptInfo: RetryAttempt = {
          attemptNumber: attempt,
          startTime: attemptStartTime,
          endTime: attemptEndTime,
          duration: attemptEndTime - attemptStartTime,
          success: true,
          delay: 0,
          circuitBreakerState: circuitBreakerState.state,
          correlationId: correlationId || ''
        };
        
        attempts.push(attemptInfo);
        
        // Record success in circuit breaker
        if (finalConfig.enableCircuitBreaker) {
          this.recordCircuitBreakerSuccess(circuitBreakerKey);
        }
        
        // Record metrics
        this.recordRetryMetrics(operationName, attempt, true);
        
        // Call success callback
        if (finalConfig.onSuccess) {
          finalConfig.onSuccess(attempt, Date.now() - startTime);
        }
        
        span.setAttributes({
          'retry.attempts': attempt,
          'retry.success': true,
          'retry.total_time': Date.now() - startTime
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        
        this.emit('retry:success', operationName, attempt, result);
        
        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime,
          finalCircuitBreakerState: this.getCircuitBreakerState(circuitBreakerKey),
          correlationId: correlationId || ''
        };
        
      } catch (error) {
        lastError = error as Error;
        const attemptEndTime = Date.now();
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError, finalConfig);
        const delay = attempt < finalConfig.maxAttempts && isRetryable ? 
          this.calculateDelay(attempt, finalConfig) : 0;
        
        const attemptInfo: RetryAttempt = {
          attemptNumber: attempt,
          startTime: attemptStartTime,
          endTime: attemptEndTime,
          duration: attemptEndTime - attemptStartTime,
          error: lastError,
          success: false,
          delay,
          circuitBreakerState: circuitBreakerState.state,
          correlationId: correlationId || ''
        };
        
        attempts.push(attemptInfo);
        
        // Record failure in circuit breaker
        if (finalConfig.enableCircuitBreaker) {
          this.recordCircuitBreakerFailure(circuitBreakerKey);
        }
        
        // Check if we should retry
        if (attempt >= finalConfig.maxAttempts || !isRetryable) {
          break;
        }
        
        // Call retry callback
        if (finalConfig.onRetry) {
          finalConfig.onRetry(lastError, attempt, delay);
        }
        
        this.emit('retry:attempt', operationName, attempt, lastError, delay);
        
        // Wait before retry
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }
    
    // All attempts failed
    this.recordRetryMetrics(operationName, attempts.length, false);
    
    // Add to dead letter queue if configured
    this.addToDeadLetterQueue(operationName, lastError!, attempts, correlationId);
    
    // Call failure callback
    if (finalConfig.onFailure && lastError) {
      finalConfig.onFailure(lastError, attempts.length, Date.now() - startTime);
    }
    
    span.setAttributes({
      'retry.attempts': attempts.length,
      'retry.success': false,
      'retry.total_time': Date.now() - startTime
    });
    span.recordException(lastError!);
    span.setStatus({ code: SpanStatusCode.ERROR, message: lastError!.message });
    span.end();
    
    this.emit('retry:failed', operationName, attempts.length, lastError);
    
    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts,
      totalTime: Date.now() - startTime,
      finalCircuitBreakerState: this.getCircuitBreakerState(circuitBreakerKey),
      correlationId: correlationId || ''
    };
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config?: Partial<RetryConfig>): RetryConfig {
    const defaultConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterType: 'full',
      jitterAmount: 0.1,
      timeoutMultiplier: 1,
      enableCircuitBreaker: false,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      retryableErrors: [
        ErrorType.NETWORK_ERROR,
        ErrorType.TIMEOUT_ERROR,
        ErrorType.EXTERNAL_API_ERROR,
        ErrorType.RATE_LIMIT_ERROR,
        ErrorType.THROTTLING_ERROR,
        ErrorType.RESOURCE_EXHAUSTED
      ],
      nonRetryableErrors: [
        ErrorType.AUTHENTICATION_ERROR,
        ErrorType.AUTHORIZATION_ERROR,
        ErrorType.VALIDATION_ERROR,
        ErrorType.RESOURCE_NOT_FOUND,
        ErrorType.BUSINESS_RULE_ERROR
      ]
    };

    return { ...defaultConfig, ...config };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error, config: RetryConfig): boolean {
    // Check custom retry condition first
    if (config.customRetryCondition) {
      return config.customRetryCondition(error, 0);
    }

    // Check if it's an enterprise error
    if (error instanceof EnterpriseErrorClass) {
      // Check non-retryable errors first
      if (config.nonRetryableErrors.includes(error.type)) {
        return false;
      }

      // Check retryable errors
      if (config.retryableErrors.includes(error.type)) {
        return true;
      }

      // Use error's retryable property
      return error.retryable;
    }

    // For non-enterprise errors, check common patterns
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /rate limit/i,
      /throttle/i,
      /503/,
      /502/,
      /504/,
      /ECONNRESET/,
      /ENOTFOUND/,
      /ECONNREFUSED/
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Calculate delay with jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    );

    // Apply jitter
    switch (config.jitterType) {
      case 'full':
        delay = Math.random() * delay;
        break;
      case 'equal':
        delay = delay * 0.5 + Math.random() * delay * 0.5;
        break;
      case 'decorrelated':
        delay = Math.random() * (delay * 3);
        break;
      case 'none':
      default:
        // No jitter
        break;
    }

    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker state
   */
  private getCircuitBreakerState(key: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextAttemptTime: null,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0
      });
    }

    return this.circuitBreakers.get(key)!;
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.getCircuitBreakerState(key);

    if (state.state === 'OPEN') {
      // Check if timeout has passed
      if (state.nextAttemptTime && Date.now() >= state.nextAttemptTime) {
        state.state = 'HALF_OPEN';
        this.emit('circuit_breaker:half_open', key);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(key: string): void {
    const state = this.getCircuitBreakerState(key);
    state.successCount++;
    state.totalSuccesses++;
    state.totalRequests++;
    state.lastSuccessTime = Date.now();

    if (state.state === 'HALF_OPEN') {
      state.state = 'CLOSED';
      state.failureCount = 0;
      this.emit('circuit_breaker:closed', key);
    }
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(key: string): void {
    const state = this.getCircuitBreakerState(key);
    state.failureCount++;
    state.totalFailures++;
    state.totalRequests++;
    state.lastFailureTime = Date.now();

    // Check if we should open the circuit breaker
    const config = this.mergeConfig();
    if (state.failureCount >= config.circuitBreakerThreshold) {
      state.state = 'OPEN';
      state.nextAttemptTime = Date.now() + config.circuitBreakerTimeout;
      this.recordMetric(key, 'circuitBreakerTrips', 1);
      this.emit('circuit_breaker:opened', key, state);
    }
  }

  /**
   * Record retry metrics
   */
  private recordRetryMetrics(operation: string, attempts: number, success: boolean): void {
    if (!this.retryMetrics.has(operation)) {
      this.retryMetrics.set(operation, {
        totalAttempts: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageAttempts: 0,
        averageDelay: 0,
        circuitBreakerTrips: 0
      });
    }

    const metrics = this.retryMetrics.get(operation)!;
    metrics.totalAttempts += attempts;

    if (success) {
      metrics.successfulRetries++;
    } else {
      metrics.failedRetries++;
    }

    // Update average attempts
    const totalOperations = metrics.successfulRetries + metrics.failedRetries;
    metrics.averageAttempts = metrics.totalAttempts / totalOperations;
  }

  /**
   * Record specific metric
   */
  private recordMetric(operation: string, metric: string, value: number): void {
    if (!this.retryMetrics.has(operation)) {
      this.recordRetryMetrics(operation, 0, true);
    }

    const metrics = this.retryMetrics.get(operation)!;
    (metrics as any)[metric] += value;
  }

  /**
   * Add to dead letter queue
   */
  private addToDeadLetterQueue(
    operation: string,
    error: Error,
    attempts: RetryAttempt[],
    correlationId?: string
  ): void {
    const entry: DeadLetterEntry = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      correlationId: correlationId || 'unknown',
      operation,
      originalError: error,
      attempts,
      timestamp: new Date(),
      metadata: {
        totalAttempts: attempts.length,
        totalTime: attempts.reduce((sum, attempt) => sum + (attempt.duration || 0), 0),
        errorType: error instanceof EnterpriseErrorClass ? error.type : 'unknown'
      }
    };

    this.deadLetterQueue.push(entry);

    // Limit dead letter queue size
    const maxSize = parseInt(process.env.DEAD_LETTER_QUEUE_MAX_SIZE || '1000');
    if (this.deadLetterQueue.length > maxSize) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-maxSize);
    }

    this.emit('dead_letter:added', entry);
  }

  /**
   * Get retry metrics
   */
  getRetryMetrics(operation?: string): Map<string, any> | any {
    if (operation) {
      return this.retryMetrics.get(operation);
    }
    return this.retryMetrics;
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key: string): void {
    const state = this.getCircuitBreakerState(key);
    state.state = 'CLOSED';
    state.failureCount = 0;
    state.successCount = 0;
    state.nextAttemptTime = null;
    this.emit('circuit_breaker:reset', key);
  }

  /**
   * Setup cleanup interval
   */
  private setupCleanupInterval(): void {
    const cleanupInterval = parseInt(process.env.RETRY_CLEANUP_INTERVAL || '3600000'); // 1 hour

    setInterval(() => {
      this.cleanupOldEntries();
    }, cleanupInterval);
  }

  /**
   * Cleanup old dead letter queue entries
   */
  private cleanupOldEntries(): void {
    const maxAge = parseInt(process.env.DEAD_LETTER_MAX_AGE || '86400000'); // 24 hours
    const now = Date.now();

    const initialLength = this.deadLetterQueue.length;
    this.deadLetterQueue = this.deadLetterQueue.filter(
      entry => now - entry.timestamp.getTime() < maxAge
    );

    const cleanedCount = initialLength - this.deadLetterQueue.length;
    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} old dead letter queue entries`);
      this.emit('dead_letter:cleaned', cleanedCount);
    }
  }
}

// Export singleton instance
export const intelligentRetryEngine = IntelligentRetryEngine.getInstance();
