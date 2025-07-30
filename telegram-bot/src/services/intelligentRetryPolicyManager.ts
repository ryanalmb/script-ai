/**
 * Intelligent Retry Policy Manager - Success Criteria Implementation
 * 
 * Implements adaptive retry policies to achieve >95% success rate for all service calls.
 * Uses machine learning-inspired algorithms to optimize retry strategies based on
 * service characteristics, error patterns, and historical performance data.
 * 
 * Key Features:
 * - Adaptive retry policies based on service behavior and error patterns
 * - Success rate tracking and optimization (target >95%)
 * - Intelligent backoff strategies with jitter and circuit breaker integration
 * - Service-specific retry configurations with dynamic adjustment
 * - Error classification and retry decision making
 * - Performance metrics and success rate analytics
 */

import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// Retry Policy Types
export interface RetryPolicy {
  serviceName: string;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  circuitBreakerIntegration: boolean;
  retryableErrors: string[];
  nonRetryableErrors: string[];
  adaptiveAdjustment: boolean;
  successRateTarget: number;
}

export interface RetryAttempt {
  attemptId: string;
  serviceName: string;
  endpoint: string;
  attemptNumber: number;
  maxRetries: number;
  delay: number;
  error?: Error;
  success: boolean;
  responseTime: number;
  timestamp: Date;
}

export interface ServiceRetryMetrics {
  serviceName: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  retriedAttempts: number;
  successRate: number;
  averageRetries: number;
  averageResponseTime: number;
  errorPatterns: Map<string, number>;
  lastUpdated: Date;
  policy: RetryPolicy;
}

export interface RetryDecision {
  shouldRetry: boolean;
  delay: number;
  reason: string;
  adjustedPolicy?: Partial<RetryPolicy>;
}

/**
 * Intelligent Retry Policy Manager - Main Implementation
 */
export class IntelligentRetryPolicyManager extends EventEmitter {
  private retryPolicies = new Map<string, RetryPolicy>();
  private retryMetrics = new Map<string, ServiceRetryMetrics>();
  private retryHistory = new Map<string, RetryAttempt[]>();
  
  // Optimization intervals
  private policyOptimizationInterval: NodeJS.Timeout | null = null;
  private metricsAnalysisInterval: NodeJS.Timeout | null = null;
  
  private isInitialized = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize the intelligent retry policy manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Intelligent Retry Policy Manager already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Intelligent Retry Policy Manager...');

      // Initialize default retry policies
      this.initializeDefaultPolicies();

      // Start policy optimization
      this.startPolicyOptimization();

      // Start metrics analysis
      this.startMetricsAnalysis();

      this.isInitialized = true;
      this.emit('manager:initialized');

      logger.info('✅ Intelligent Retry Policy Manager initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Intelligent Retry Policy Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize default retry policies for different service types
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies: RetryPolicy[] = [
      {
        serviceName: 'twikit-session-manager',
        maxRetries: 5,
        baseDelay: 100,
        maxDelay: 2000,
        backoffMultiplier: 2,
        jitterEnabled: true,
        circuitBreakerIntegration: true,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'RATE_LIMIT'],
        nonRetryableErrors: ['UNAUTHORIZED', 'FORBIDDEN', 'BAD_REQUEST'],
        adaptiveAdjustment: true,
        successRateTarget: 95
      },
      {
        serviceName: 'global-rate-limit-coordinator',
        maxRetries: 3,
        baseDelay: 200,
        maxDelay: 1000,
        backoffMultiplier: 1.5,
        jitterEnabled: true,
        circuitBreakerIntegration: true,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'RATE_LIMIT'],
        nonRetryableErrors: ['UNAUTHORIZED', 'FORBIDDEN'],
        adaptiveAdjustment: true,
        successRateTarget: 98
      },
      {
        serviceName: 'llm-service',
        maxRetries: 4,
        baseDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 2.5,
        jitterEnabled: true,
        circuitBreakerIntegration: true,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'MODEL_OVERLOADED', 'RATE_LIMIT'],
        nonRetryableErrors: ['UNAUTHORIZED', 'INVALID_INPUT', 'CONTENT_POLICY'],
        adaptiveAdjustment: true,
        successRateTarget: 90
      },
      {
        serviceName: 'default',
        maxRetries: 3,
        baseDelay: 200,
        maxDelay: 2000,
        backoffMultiplier: 2,
        jitterEnabled: true,
        circuitBreakerIntegration: true,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
        nonRetryableErrors: ['UNAUTHORIZED', 'FORBIDDEN', 'BAD_REQUEST'],
        adaptiveAdjustment: true,
        successRateTarget: 95
      }
    ];

    for (const policy of defaultPolicies) {
      this.retryPolicies.set(policy.serviceName, policy);
      
      // Initialize metrics
      this.retryMetrics.set(policy.serviceName, {
        serviceName: policy.serviceName,
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        retriedAttempts: 0,
        successRate: 100,
        averageRetries: 0,
        averageResponseTime: 0,
        errorPatterns: new Map(),
        lastUpdated: new Date(),
        policy
      });
    }

    logger.info(`📋 Initialized ${defaultPolicies.length} default retry policies`);
  }

  /**
   * Get retry policy for service
   */
  getRetryPolicy(serviceName: string): RetryPolicy {
    return this.retryPolicies.get(serviceName) || this.retryPolicies.get('default')!;
  }

  /**
   * Make retry decision based on error and service characteristics
   */
  async makeRetryDecision(
    serviceName: string,
    _endpoint: string,
    error: Error,
    attemptNumber: number,
    responseTime: number
  ): Promise<RetryDecision> {
    const policy = this.getRetryPolicy(serviceName);
    const metrics = this.retryMetrics.get(serviceName);

    // Check if we've exceeded max retries
    if (attemptNumber >= policy.maxRetries) {
      return {
        shouldRetry: false,
        delay: 0,
        reason: 'Maximum retries exceeded'
      };
    }

    // Check if error is retryable
    const errorType = this.classifyError(error);
    if (policy.nonRetryableErrors.includes(errorType)) {
      return {
        shouldRetry: false,
        delay: 0,
        reason: `Non-retryable error: ${errorType}`
      };
    }

    if (!policy.retryableErrors.includes(errorType) && errorType !== 'UNKNOWN') {
      return {
        shouldRetry: false,
        delay: 0,
        reason: `Error not in retryable list: ${errorType}`
      };
    }

    // Calculate delay with intelligent backoff
    const delay = this.calculateIntelligentDelay(policy, attemptNumber, metrics, responseTime);

    // Check if delay exceeds maximum
    if (delay > policy.maxDelay) {
      return {
        shouldRetry: false,
        delay: 0,
        reason: 'Calculated delay exceeds maximum'
      };
    }

    // Adaptive policy adjustment
    let adjustedPolicy: Partial<RetryPolicy> | undefined;
    if (policy.adaptiveAdjustment && metrics) {
      adjustedPolicy = this.calculatePolicyAdjustment(policy, metrics, errorType);
    }

    const decision: any = {
      shouldRetry: true,
      delay,
      reason: `Retryable error: ${errorType}`
    };

    if (adjustedPolicy) {
      decision.adjustedPolicy = adjustedPolicy;
    }

    return decision;
  }

  /**
   * Record retry attempt for metrics and learning
   */
  async recordRetryAttempt(
    serviceName: string,
    endpoint: string,
    attemptNumber: number,
    maxRetries: number,
    delay: number,
    error: Error | null,
    success: boolean,
    responseTime: number
  ): Promise<void> {
    const attemptId = `${serviceName}_${endpoint}_${Date.now()}_${attemptNumber}`;
    
    const attempt: any = {
      attemptId,
      serviceName,
      endpoint,
      attemptNumber,
      maxRetries,
      delay,
      success,
      responseTime,
      timestamp: new Date()
    };

    if (error) {
      attempt.error = error;
    }

    // Store in history
    let history = this.retryHistory.get(serviceName) || [];
    history.push(attempt);
    if (history.length > 1000) history = history.slice(-1000); // Keep last 1000 attempts
    this.retryHistory.set(serviceName, history);

    // Update metrics
    await this.updateRetryMetrics(serviceName, attempt);

    // Emit attempt recorded event
    this.emit('attempt:recorded', attempt);
  }

  /**
   * Update retry metrics for service
   */
  private async updateRetryMetrics(serviceName: string, attempt: RetryAttempt): Promise<void> {
    let metrics = this.retryMetrics.get(serviceName);
    if (!metrics) {
      const policy = this.getRetryPolicy(serviceName);
      metrics = {
        serviceName,
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        retriedAttempts: 0,
        successRate: 100,
        averageRetries: 0,
        averageResponseTime: 0,
        errorPatterns: new Map(),
        lastUpdated: new Date(),
        policy
      };
    }

    // Update counters
    metrics.totalAttempts++;
    
    if (attempt.success) {
      metrics.successfulAttempts++;
    } else {
      metrics.failedAttempts++;
      
      // Track error patterns
      if (attempt.error) {
        const errorType = this.classifyError(attempt.error);
        const currentCount = metrics.errorPatterns.get(errorType) || 0;
        metrics.errorPatterns.set(errorType, currentCount + 1);
      }
    }

    if (attempt.attemptNumber > 1) {
      metrics.retriedAttempts++;
    }

    // Calculate success rate
    metrics.successRate = (metrics.successfulAttempts / metrics.totalAttempts) * 100;

    // Calculate average retries (for successful requests)
    const history = this.retryHistory.get(serviceName) || [];
    const successfulRequests = history.filter(h => h.success);
    if (successfulRequests.length > 0) {
      metrics.averageRetries = successfulRequests.reduce((sum, h) => sum + h.attemptNumber, 0) / successfulRequests.length;
    }

    // Calculate average response time
    const recentAttempts = history.slice(-100); // Last 100 attempts
    if (recentAttempts.length > 0) {
      metrics.averageResponseTime = recentAttempts.reduce((sum, h) => sum + h.responseTime, 0) / recentAttempts.length;
    }

    metrics.lastUpdated = new Date();
    this.retryMetrics.set(serviceName, metrics);

    // Emit metrics update
    this.emit('metrics:updated', metrics);

    // Check if success rate is below target
    if (metrics.successRate < metrics.policy.successRateTarget) {
      this.emit('success_rate:below_target', {
        serviceName,
        currentRate: metrics.successRate,
        targetRate: metrics.policy.successRateTarget
      });
    }
  }

  /**
   * Classify error for retry decision making
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (message.includes('econnrefused') || name.includes('econnrefused')) return 'ECONNREFUSED';
    if (message.includes('etimedout') || name.includes('etimedout')) return 'ETIMEDOUT';
    if (message.includes('enotfound') || name.includes('enotfound')) return 'ENOTFOUND';
    if (message.includes('econnreset') || name.includes('econnreset')) return 'ECONNRESET';

    // HTTP errors
    if (message.includes('401') || message.includes('unauthorized')) return 'UNAUTHORIZED';
    if (message.includes('403') || message.includes('forbidden')) return 'FORBIDDEN';
    if (message.includes('400') || message.includes('bad request')) return 'BAD_REQUEST';
    if (message.includes('429') || message.includes('rate limit')) return 'RATE_LIMIT';
    if (message.includes('500') || message.includes('internal server')) return 'INTERNAL_SERVER_ERROR';
    if (message.includes('502') || message.includes('bad gateway')) return 'BAD_GATEWAY';
    if (message.includes('503') || message.includes('service unavailable')) return 'SERVICE_UNAVAILABLE';
    if (message.includes('504') || message.includes('gateway timeout')) return 'GATEWAY_TIMEOUT';

    // Service-specific errors
    if (message.includes('model overloaded') || message.includes('capacity')) return 'MODEL_OVERLOADED';
    if (message.includes('content policy') || message.includes('content filter')) return 'CONTENT_POLICY';
    if (message.includes('invalid input') || message.includes('validation')) return 'INVALID_INPUT';

    return 'UNKNOWN';
  }

  /**
   * Calculate intelligent delay with adaptive backoff
   */
  private calculateIntelligentDelay(
    policy: RetryPolicy,
    attemptNumber: number,
    metrics: ServiceRetryMetrics | undefined,
    _responseTime: number
  ): number {
    // Base exponential backoff
    let delay = policy.baseDelay * Math.pow(policy.backoffMultiplier, attemptNumber - 1);

    // Adaptive adjustment based on service performance
    if (metrics && policy.adaptiveAdjustment) {
      // If service is slow, increase delay
      if (metrics.averageResponseTime > 1000) {
        delay *= 1.5;
      }
      
      // If success rate is low, increase delay more aggressively
      if (metrics.successRate < 80) {
        delay *= 2;
      } else if (metrics.successRate < 90) {
        delay *= 1.3;
      }
    }

    // Add jitter to prevent thundering herd
    if (policy.jitterEnabled) {
      const jitter = Math.random() * 0.3; // ±30% jitter
      delay = delay * (1 + jitter - 0.15);
    }

    // Ensure delay doesn't exceed maximum
    delay = Math.min(delay, policy.maxDelay);

    return Math.round(delay);
  }

  /**
   * Calculate policy adjustment based on performance
   */
  private calculatePolicyAdjustment(
    policy: RetryPolicy,
    metrics: ServiceRetryMetrics,
    errorType: string
  ): Partial<RetryPolicy> {
    const adjustments: Partial<RetryPolicy> = {};

    // If success rate is below target, increase retries
    if (metrics.successRate < policy.successRateTarget) {
      if (metrics.successRate < 85) {
        adjustments.maxRetries = Math.min(policy.maxRetries + 2, 8);
      } else if (metrics.successRate < 90) {
        adjustments.maxRetries = Math.min(policy.maxRetries + 1, 6);
      }
    }

    // If average response time is high, adjust delays
    if (metrics.averageResponseTime > 2000) {
      adjustments.baseDelay = Math.min(policy.baseDelay * 1.5, 1000);
      adjustments.maxDelay = Math.min(policy.maxDelay * 1.5, 10000);
    }

    // Adjust based on error patterns
    const errorCount = metrics.errorPatterns.get(errorType) || 0;
    const errorRate = errorCount / metrics.totalAttempts;

    if (errorRate > 0.3) { // High error rate for this error type
      if (errorType === 'RATE_LIMIT') {
        adjustments.baseDelay = Math.min(policy.baseDelay * 2, 2000);
        adjustments.backoffMultiplier = Math.min(policy.backoffMultiplier * 1.2, 3);
      } else if (errorType === 'SERVICE_UNAVAILABLE') {
        adjustments.maxRetries = Math.min(policy.maxRetries + 1, 6);
        adjustments.baseDelay = Math.min(policy.baseDelay * 1.5, 1000);
      }
    }

    return adjustments;
  }

  /**
   * Start policy optimization
   */
  private startPolicyOptimization(): void {
    this.policyOptimizationInterval = setInterval(async () => {
      try {
        await this.optimizeRetryPolicies();
      } catch (error) {
        logger.error('Policy optimization failed:', error);
      }
    }, 300000); // Every 5 minutes

    logger.info('🔧 Policy optimization started');
  }

  /**
   * Optimize retry policies based on performance data
   */
  private async optimizeRetryPolicies(): Promise<void> {
    for (const [serviceName, metrics] of Array.from(this.retryMetrics.entries())) {
      const policy = this.retryPolicies.get(serviceName);
      if (!policy || !policy.adaptiveAdjustment) continue;

      let policyChanged = false;
      const newPolicy = { ...policy };

      // Optimize based on success rate
      if (metrics.successRate < policy.successRateTarget) {
        if (metrics.successRate < 85) {
          newPolicy.maxRetries = Math.min(policy.maxRetries + 1, 8);
          newPolicy.baseDelay = Math.min(policy.baseDelay * 1.2, 1000);
          policyChanged = true;
        } else if (metrics.successRate < 90) {
          newPolicy.maxRetries = Math.min(policy.maxRetries + 1, 6);
          policyChanged = true;
        }
      } else if (metrics.successRate > policy.successRateTarget + 2) {
        // If success rate is well above target, we can be more aggressive
        if (metrics.averageRetries > 2) {
          newPolicy.maxRetries = Math.max(policy.maxRetries - 1, 2);
          policyChanged = true;
        }
      }

      // Optimize based on response time patterns
      if (metrics.averageResponseTime > 2000) {
        newPolicy.baseDelay = Math.min(policy.baseDelay * 1.3, 1000);
        newPolicy.maxDelay = Math.min(policy.maxDelay * 1.3, 8000);
        policyChanged = true;
      } else if (metrics.averageResponseTime < 500) {
        newPolicy.baseDelay = Math.max(policy.baseDelay * 0.9, 50);
        policyChanged = true;
      }

      // Apply optimizations
      if (policyChanged) {
        this.retryPolicies.set(serviceName, newPolicy);
        metrics.policy = newPolicy;

        logger.info(`🔧 Optimized retry policy for ${serviceName}:`, {
          maxRetries: `${policy.maxRetries} → ${newPolicy.maxRetries}`,
          baseDelay: `${policy.baseDelay} → ${newPolicy.baseDelay}`,
          successRate: `${metrics.successRate.toFixed(1)}%`
        });

        this.emit('policy:optimized', {
          serviceName,
          oldPolicy: policy,
          newPolicy,
          metrics
        });
      }
    }
  }

  /**
   * Start metrics analysis
   */
  private startMetricsAnalysis(): void {
    this.metricsAnalysisInterval = setInterval(async () => {
      try {
        await this.analyzeRetryMetrics();
      } catch (error) {
        logger.error('Metrics analysis failed:', error);
      }
    }, 60000); // Every minute

    logger.info('📊 Metrics analysis started');
  }

  /**
   * Analyze retry metrics and identify patterns
   */
  private async analyzeRetryMetrics(): Promise<void> {
    const analysis = {
      totalServices: this.retryMetrics.size,
      servicesAboveTarget: 0,
      servicesBelowTarget: 0,
      averageSuccessRate: 0,
      averageRetries: 0,
      commonErrors: new Map<string, number>(),
      recommendations: [] as string[]
    };

    let totalSuccessRate = 0;
    let totalRetries = 0;

    for (const [serviceName, metrics] of Array.from(this.retryMetrics.entries())) {
      totalSuccessRate += metrics.successRate;
      totalRetries += metrics.averageRetries;

      if (metrics.successRate >= metrics.policy.successRateTarget) {
        analysis.servicesAboveTarget++;
      } else {
        analysis.servicesBelowTarget++;
        analysis.recommendations.push(`Improve ${serviceName}: ${metrics.successRate.toFixed(1)}% success rate`);
      }

      // Aggregate error patterns
      for (const [errorType, count] of metrics.errorPatterns.entries()) {
        const currentCount = analysis.commonErrors.get(errorType) || 0;
        analysis.commonErrors.set(errorType, currentCount + count);
      }
    }

    analysis.averageSuccessRate = totalSuccessRate / analysis.totalServices;
    analysis.averageRetries = totalRetries / analysis.totalServices;

    // Generate recommendations
    if (analysis.averageSuccessRate < 95) {
      analysis.recommendations.push('Overall success rate below 95% - consider system-wide optimizations');
    }

    if (analysis.averageRetries > 2) {
      analysis.recommendations.push('High average retry count - investigate service stability');
    }

    // Identify most common errors
    const sortedErrors = Array.from(analysis.commonErrors.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    for (const [errorType, count] of sortedErrors) {
      if (count > 10) {
        analysis.recommendations.push(`Address common error: ${errorType} (${count} occurrences)`);
      }
    }

    this.emit('analysis:completed', analysis);

    // Log summary
    logger.info(`📊 Retry Analysis: ${analysis.servicesAboveTarget}/${analysis.totalServices} services meet targets (${analysis.averageSuccessRate.toFixed(1)}% avg success rate)`);
  }

  /**
   * Get retry metrics for service
   */
  getRetryMetrics(serviceName: string): ServiceRetryMetrics | undefined {
    return this.retryMetrics.get(serviceName);
  }

  /**
   * Get all retry metrics
   */
  getAllRetryMetrics(): Map<string, ServiceRetryMetrics> {
    return new Map(this.retryMetrics);
  }

  /**
   * Get retry policy manager status
   */
  async getManagerStatus(): Promise<{
    initialized: boolean;
    totalPolicies: number;
    totalServices: number;
    averageSuccessRate: number;
    servicesAboveTarget: number;
    servicesBelowTarget: number;
    recommendations: string[];
  }> {
    let totalSuccessRate = 0;
    let servicesAboveTarget = 0;
    let servicesBelowTarget = 0;
    const recommendations: string[] = [];

    for (const [serviceName, metrics] of Array.from(this.retryMetrics.entries())) {
      totalSuccessRate += metrics.successRate;

      if (metrics.successRate >= metrics.policy.successRateTarget) {
        servicesAboveTarget++;
      } else {
        servicesBelowTarget++;
        recommendations.push(`${serviceName}: ${metrics.successRate.toFixed(1)}% (target: ${metrics.policy.successRateTarget}%)`);
      }
    }

    const averageSuccessRate = this.retryMetrics.size > 0 ? totalSuccessRate / this.retryMetrics.size : 100;

    return {
      initialized: this.isInitialized,
      totalPolicies: this.retryPolicies.size,
      totalServices: this.retryMetrics.size,
      averageSuccessRate,
      servicesAboveTarget,
      servicesBelowTarget,
      recommendations
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('attempt:recorded', (attempt: RetryAttempt) => {
      if (!attempt.success && attempt.attemptNumber >= attempt.maxRetries) {
        logger.warn(`❌ Final retry failed for ${attempt.serviceName}:${attempt.endpoint} after ${attempt.attemptNumber} attempts`);
      }
    });

    this.on('success_rate:below_target', (data) => {
      logger.warn(`⚠️ Success rate below target for ${data.serviceName}: ${data.currentRate.toFixed(1)}% (target: ${data.targetRate}%)`);
    });

    this.on('policy:optimized', (data) => {
      logger.info(`🔧 Policy optimized for ${data.serviceName} - Success rate: ${data.metrics.successRate.toFixed(1)}%`);
    });

    this.on('analysis:completed', (analysis) => {
      if (analysis.servicesBelowTarget > 0) {
        logger.warn(`📊 ${analysis.servicesBelowTarget} services below success rate targets`);
      } else {
        logger.info(`✅ All services meeting success rate targets (${analysis.averageSuccessRate.toFixed(1)}% average)`);
      }
    });
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.policyOptimizationInterval) {
      clearInterval(this.policyOptimizationInterval);
      this.policyOptimizationInterval = null;
    }

    if (this.metricsAnalysisInterval) {
      clearInterval(this.metricsAnalysisInterval);
      this.metricsAnalysisInterval = null;
    }

    this.retryPolicies.clear();
    this.retryMetrics.clear();
    this.retryHistory.clear();
    this.isInitialized = false;

    this.emit('manager:destroyed');
    logger.info('🧹 Intelligent Retry Policy Manager destroyed');
  }
}

// Export singleton instance
export const intelligentRetryPolicyManager = new IntelligentRetryPolicyManager();
