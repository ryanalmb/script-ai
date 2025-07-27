/**
 * Intelligent Retry and Backoff Strategies for Twikit Services
 * 
 * Provides sophisticated retry logic with exponential backoff algorithms and circuit breaker patterns
 * that enhance all existing Twikit services with intelligent failure recovery, context-aware retry
 * strategies, and enterprise-grade resilience mechanisms.
 * 
 * Features:
 * - Context-aware retry logic for different services and operations
 * - Adaptive exponential backoff with jitter and service health consideration
 * - Circuit breaker patterns with cascading failure prevention
 * - Distributed retry coordination across services
 * - Campaign-aware retry policies with priority-based allocation
 * - Comprehensive retry performance analytics and optimization
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { cacheManager } from '../lib/cache';
import { prisma } from '../lib/prisma';
import { 
  EnterpriseErrorClass, 
  ErrorType, 
  ErrorCategory, 
  RecoveryStrategy, 
  TwikitErrorType, 
  TwikitError 
} from '../errors/enterpriseErrorFramework';
import { IntelligentRetryEngine } from './intelligentRetryEngine';
import { TwikitConnectionPool, ConnectionPriority } from './twikitConnectionPool';
import { CampaignOrchestrator } from './campaignOrchestrator';
import { AdvancedAnalyticsService } from './analyticsService';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface ContextAwareRetryConfig {
  // Service Context
  serviceType: 'session_manager' | 'connection_pool' | 'campaign_orchestrator' | 'analytics' | 'content_safety' | 'websocket' | 'automation';
  operationType: string;
  accountId?: string;
  campaignId?: string;
  priority?: ConnectionPriority;
  
  // Retry Strategy
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffStrategy: 'exponential' | 'linear' | 'adaptive' | 'decorrelated';
  jitterType?: 'none' | 'full' | 'equal' | 'decorrelated';
  
  // Adaptive Configuration
  enableAdaptiveBackoff?: boolean;
  successRateThreshold?: number;
  adaptationFactor?: number;
  learningWindow?: number;
  
  // Circuit Breaker
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  circuitBreakerHalfOpenMaxCalls?: number;
  
  // Resource Management
  enableResourceAwareRetry?: boolean;
  maxConcurrentRetries?: number;
  retryBudgetPerMinute?: number;
  retryBudgetPerHour?: number;

  // Cross-Service Coordination
  enableDistributedCoordination?: boolean;
  coordinationKey?: string;
  respectGlobalBackpressure?: boolean;

  // Performance Monitoring
  enablePerformanceTracking?: boolean;
  trackRetryEffectiveness?: boolean;
  enableOptimizationSuggestions?: boolean;
}

export interface RetryContext {
  correlationId: string;
  serviceType: string;
  operationType: string;
  accountId: string;
  campaignId: string | undefined;
  priority: ConnectionPriority;
  
  // Execution Context
  startTime: Date;
  currentAttempt: number;
  totalAttempts: number;
  lastError?: Error;
  
  // Service State
  serviceHealth: ServiceHealthMetrics;
  connectionPoolState: ConnectionPoolState | undefined;
  campaignState: CampaignState | undefined;
  
  // Performance Context
  averageSuccessRate: number;
  recentFailureRate: number;
  systemLoad: number;
  
  // Coordination Context
  globalBackpressure: boolean;
  distributedRetryCount: number;
  coordinatedDelay: number;
}

export interface ServiceHealthMetrics {
  serviceType: string;
  healthScore: number; // 0-100
  successRate: number; // 0-1
  averageResponseTime: number;
  errorRate: number; // 0-1
  lastHealthCheck: Date;
  
  // Resource Metrics
  cpuUtilization: number; // 0-100
  memoryUtilization: number; // 0-100
  activeConnections: number;
  queueLength: number;
  
  // Circuit Breaker State
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  circuitBreakerFailureCount: number;
  circuitBreakerLastFailure?: Date;
}

export interface ConnectionPoolState {
  totalConnections: number;
  availableConnections: number;
  queuedRequests: number;
  averageAcquisitionTime: number;
  poolUtilization: number; // 0-1
  scalingInProgress: boolean;
}

export interface CampaignState {
  campaignId: string;
  status: string;
  priority: ConnectionPriority;
  resourceAllocation: number; // 0-1
  successRate: number; // 0-1
  remainingActions: number;
  estimatedCompletion: Date;
}

export interface AdaptiveBackoffResult {
  delay: number;
  strategy: string;
  confidence: number;
  reasoning: string[];
  adaptations: string[];
}

export interface CircuitBreakerState {
  serviceKey: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  halfOpenAttempts: number;
  successCount: number;
  
  // Performance Metrics
  totalRequests: number;
  totalFailures: number;
  averageResponseTime: number;
  lastStateChange: Date;
}

export interface RetryPerformanceMetrics {
  serviceType: string;
  operationType: string;
  
  // Retry Statistics
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  retrySuccessRate: number;
  
  // Timing Metrics
  averageRetryDelay: number;
  totalRetryTime: number;
  averageTimeToSuccess: number;
  
  // Backoff Effectiveness
  backoffStrategy: string;
  averageBackoffDelay: number;
  backoffEffectiveness: number; // 0-1
  
  // Circuit Breaker Metrics
  circuitBreakerTrips: number;
  circuitBreakerRecoveries: number;
  averageCircuitOpenTime: number;
  
  // Resource Impact
  resourceUtilizationImpact: number;
  concurrentRetryPeak: number;
  retryBudgetUtilization: number;
  
  // Optimization Metrics
  optimizationOpportunities: string[];
  recommendedAdjustments: Record<string, any>;
  
  timestamp: Date;
}

export interface DistributedRetryCoordination {
  coordinationKey: string;
  totalInstances: number;
  activeRetries: number;
  globalBackpressure: boolean;
  coordinatedDelay: number;
  lastCoordination: Date;
  
  // Load Distribution
  instanceRetryLoad: Record<string, number>;
  recommendedDistribution: Record<string, number>;
  
  // Global Metrics
  globalSuccessRate: number;
  globalFailureRate: number;
  globalAverageDelay: number;
}

// ============================================================================
// ADAPTIVE BACKOFF CALCULATOR
// ============================================================================

export class AdaptiveBackoffCalculator {
  private performanceHistory: Map<string, Array<{ timestamp: Date; success: boolean; delay: number; responseTime: number }>> = new Map();
  private readonly maxHistorySize = 100;

  /**
   * Calculate adaptive backoff delay based on service health and historical performance
   */
  calculateAdaptiveBackoff(
    config: ContextAwareRetryConfig,
    context: RetryContext,
    baseDelay: number
  ): AdaptiveBackoffResult {
    const serviceKey = `${context.serviceType}:${context.operationType}`;
    const history = this.performanceHistory.get(serviceKey) || [];
    
    let adaptedDelay = baseDelay;
    const reasoning: string[] = [];
    const adaptations: string[] = [];
    let confidence = 0.5;

    // Base exponential backoff
    if (config.backoffStrategy === 'exponential') {
      adaptedDelay = baseDelay * Math.pow(2, context.currentAttempt - 1);
      reasoning.push(`Exponential backoff: ${baseDelay} * 2^${context.currentAttempt - 1}`);
    } else if (config.backoffStrategy === 'linear') {
      adaptedDelay = baseDelay * context.currentAttempt;
      reasoning.push(`Linear backoff: ${baseDelay} * ${context.currentAttempt}`);
    }

    // Apply adaptive adjustments
    if (config.enableAdaptiveBackoff && history.length >= 5) {
      const learningWindow = config.learningWindow || 10;
      const successRateThreshold = config.successRateThreshold || 0.7;
      const adaptationFactor = config.adaptationFactor || 0.5;

      const recentHistory = history.slice(-learningWindow);
      const recentSuccessRate = recentHistory.filter(h => h.success).length / recentHistory.length;
      const averageResponseTime = recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length;

      // Adjust based on success rate
      if (recentSuccessRate < successRateThreshold) {
        const adjustment = 1 + (adaptationFactor * (successRateThreshold - recentSuccessRate));
        adaptedDelay *= adjustment;
        adaptations.push(`Success rate adjustment: ${adjustment.toFixed(2)}x (rate: ${(recentSuccessRate * 100).toFixed(1)}%)`);
        confidence += 0.2;
      }

      // Adjust based on response time
      if (averageResponseTime > 5000) { // 5 seconds threshold
        const timeoutAdjustment = 1 + (averageResponseTime / 10000); // Scale with response time
        adaptedDelay *= timeoutAdjustment;
        adaptations.push(`Response time adjustment: ${timeoutAdjustment.toFixed(2)}x (avg: ${averageResponseTime.toFixed(0)}ms)`);
        confidence += 0.1;
      }
    }

    // Service health adjustments
    if (context.serviceHealth.healthScore < 70) {
      const healthAdjustment = 1 + ((100 - context.serviceHealth.healthScore) / 100);
      adaptedDelay *= healthAdjustment;
      adaptations.push(`Service health adjustment: ${healthAdjustment.toFixed(2)}x (health: ${context.serviceHealth.healthScore})`);
      confidence += 0.2;
    }

    // System load adjustments
    if (context.systemLoad > 0.8) {
      const loadAdjustment = 1 + (context.systemLoad - 0.8) * 2;
      adaptedDelay *= loadAdjustment;
      adaptations.push(`System load adjustment: ${loadAdjustment.toFixed(2)}x (load: ${(context.systemLoad * 100).toFixed(1)}%)`);
      confidence += 0.1;
    }

    // Campaign priority adjustments
    if (context.campaignId && context.priority >= ConnectionPriority.HIGH) {
      const priorityAdjustment = 0.7; // Reduce delay for high-priority campaigns
      adaptedDelay *= priorityAdjustment;
      adaptations.push(`High priority campaign adjustment: ${priorityAdjustment}x`);
      confidence += 0.1;
    }

    // Connection pool state adjustments
    if (context.connectionPoolState && context.connectionPoolState.poolUtilization > 0.9) {
      const poolAdjustment = 1 + (context.connectionPoolState.poolUtilization - 0.9) * 5;
      adaptedDelay *= poolAdjustment;
      adaptations.push(`Connection pool congestion adjustment: ${poolAdjustment.toFixed(2)}x`);
      confidence += 0.1;
    }

    // Apply jitter
    const jitterType = config.jitterType || 'none';
    adaptedDelay = this.applyJitter(adaptedDelay, jitterType);
    reasoning.push(`Jitter applied: ${jitterType}`);

    // Ensure within bounds
    adaptedDelay = Math.max(config.baseDelay, Math.min(adaptedDelay, config.maxDelay));
    reasoning.push(`Bounded to: ${config.baseDelay}ms - ${config.maxDelay}ms`);

    // Determine strategy used
    let strategy: string = config.backoffStrategy;
    if (adaptations.length > 0) {
      strategy = `adaptive_${config.backoffStrategy}`;
      confidence = Math.min(1.0, confidence);
    }

    return {
      delay: Math.round(adaptedDelay),
      strategy,
      confidence,
      reasoning,
      adaptations
    };
  }

  /**
   * Apply jitter to delay
   */
  private applyJitter(delay: number, jitterType: string): number {
    switch (jitterType) {
      case 'full':
        return Math.random() * delay;
      
      case 'equal':
        return delay * 0.5 + Math.random() * delay * 0.5;
      
      case 'decorrelated':
        // Decorrelated jitter: delay = random(base_delay, previous_delay * 3)
        return Math.random() * delay * 3;
      
      case 'none':
      default:
        return delay;
    }
  }

  /**
   * Record performance data for adaptive learning
   */
  recordPerformance(
    serviceType: string,
    operationType: string,
    success: boolean,
    delay: number,
    responseTime: number
  ): void {
    const serviceKey = `${serviceType}:${operationType}`;
    
    if (!this.performanceHistory.has(serviceKey)) {
      this.performanceHistory.set(serviceKey, []);
    }
    
    const history = this.performanceHistory.get(serviceKey)!;
    history.push({
      timestamp: new Date(),
      success,
      delay,
      responseTime
    });
    
    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  /**
   * Get performance statistics for a service
   */
  getPerformanceStats(serviceType: string, operationType: string): {
    totalAttempts: number;
    successRate: number;
    averageDelay: number;
    averageResponseTime: number;
    recentTrend: 'improving' | 'degrading' | 'stable';
  } {
    const serviceKey = `${serviceType}:${operationType}`;
    const history = this.performanceHistory.get(serviceKey) || [];
    
    if (history.length === 0) {
      return {
        totalAttempts: 0,
        successRate: 0,
        averageDelay: 0,
        averageResponseTime: 0,
        recentTrend: 'stable'
      };
    }
    
    const totalAttempts = history.length;
    const successRate = history.filter(h => h.success).length / totalAttempts;
    const averageDelay = history.reduce((sum, h) => sum + h.delay, 0) / totalAttempts;
    const averageResponseTime = history.reduce((sum, h) => sum + h.responseTime, 0) / totalAttempts;
    
    // Determine trend
    let recentTrend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (history.length >= 10) {
      const firstHalf = history.slice(0, Math.floor(history.length / 2));
      const secondHalf = history.slice(Math.floor(history.length / 2));
      
      const firstHalfSuccessRate = firstHalf.filter(h => h.success).length / firstHalf.length;
      const secondHalfSuccessRate = secondHalf.filter(h => h.success).length / secondHalf.length;
      
      if (secondHalfSuccessRate > firstHalfSuccessRate + 0.1) {
        recentTrend = 'improving';
      } else if (secondHalfSuccessRate < firstHalfSuccessRate - 0.1) {
        recentTrend = 'degrading';
      }
    }
    
    return {
      totalAttempts,
      successRate,
      averageDelay,
      averageResponseTime,
      recentTrend
    };
  }
}

// ============================================================================
// ENHANCED CIRCUIT BREAKER
// ============================================================================

export class EnhancedCircuitBreaker {
  private circuitStates: Map<string, CircuitBreakerState> = new Map();
  private redis: Redis;

  constructor() {
    this.redis = cacheManager as any;
  }

  /**
   * Check if circuit breaker allows execution
   */
  async canExecute(serviceKey: string, config: ContextAwareRetryConfig): Promise<boolean> {
    if (!config.enableCircuitBreaker) {
      return true;
    }

    const state = await this.getCircuitState(serviceKey);
    const now = new Date();

    switch (state.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (state.nextAttemptTime && now >= state.nextAttemptTime) {
          // Transition to half-open
          await this.transitionToHalfOpen(serviceKey);
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return state.halfOpenAttempts < (config.circuitBreakerHalfOpenMaxCalls || 3);

      default:
        return true;
    }
  }

  /**
   * Record execution result
   */
  async recordResult(
    serviceKey: string,
    config: ContextAwareRetryConfig,
    success: boolean,
    responseTime: number
  ): Promise<void> {
    if (!config.enableCircuitBreaker) {
      return;
    }

    const state = await this.getCircuitState(serviceKey);
    const now = new Date();

    // Update metrics
    state.totalRequests++;
    state.averageResponseTime = (state.averageResponseTime * (state.totalRequests - 1) + responseTime) / state.totalRequests;

    if (success) {
      state.successCount++;

      if (state.state === 'HALF_OPEN') {
        state.halfOpenAttempts++;

        // Check if we should close the circuit
        if (state.halfOpenAttempts >= (config.circuitBreakerHalfOpenMaxCalls || 3)) {
          await this.transitionToClosed(serviceKey);
        }
      }
    } else {
      state.failureCount++;
      state.totalFailures++;
      state.lastFailureTime = now;

      if (state.state === 'HALF_OPEN') {
        // Failure in half-open state, go back to open
        await this.transitionToOpen(serviceKey, config);
      } else if (state.state === 'CLOSED') {
        // Check if we should open the circuit
        if (state.failureCount >= (config.circuitBreakerThreshold || 5)) {
          await this.transitionToOpen(serviceKey, config);
        }
      }
    }

    await this.saveCircuitState(serviceKey, state);
  }

  /**
   * Get circuit breaker state
   */
  private async getCircuitState(serviceKey: string): Promise<CircuitBreakerState> {
    // Try to get from local cache first
    let state = this.circuitStates.get(serviceKey);

    if (!state) {
      // Try to get from Redis for distributed coordination
      try {
        const redisState = await this.redis.get(`circuit_breaker:${serviceKey}`);
        if (redisState) {
          state = JSON.parse(redisState);
          // Convert date strings back to Date objects
          if (state!.lastFailureTime) state!.lastFailureTime = new Date(state!.lastFailureTime);
          if (state!.nextAttemptTime) state!.nextAttemptTime = new Date(state!.nextAttemptTime);
          if (state!.lastStateChange) state!.lastStateChange = new Date(state!.lastStateChange);
        }
      } catch (error) {
        logger.warn(`Failed to get circuit breaker state from Redis: ${error}`);
      }
    }

    if (!state) {
      // Create new state
      state = {
        serviceKey,
        state: 'CLOSED',
        failureCount: 0,
        halfOpenAttempts: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
        averageResponseTime: 0,
        lastStateChange: new Date()
      };
    }

    this.circuitStates.set(serviceKey, state);
    return state;
  }

  /**
   * Save circuit breaker state
   */
  private async saveCircuitState(serviceKey: string, state: CircuitBreakerState): Promise<void> {
    this.circuitStates.set(serviceKey, state);

    // Save to Redis for distributed coordination
    try {
      await this.redis.setex(
        `circuit_breaker:${serviceKey}`,
        300, // 5 minutes TTL
        JSON.stringify(state)
      );
    } catch (error) {
      logger.warn(`Failed to save circuit breaker state to Redis: ${error}`);
    }
  }

  /**
   * Transition to open state
   */
  private async transitionToOpen(serviceKey: string, config: ContextAwareRetryConfig): Promise<void> {
    const state = await this.getCircuitState(serviceKey);
    const now = new Date();

    state.state = 'OPEN';
    state.lastStateChange = now;
    state.nextAttemptTime = new Date(now.getTime() + (config.circuitBreakerTimeout || 60000));
    state.failureCount = 0; // Reset for next cycle

    await this.saveCircuitState(serviceKey, state);

    logger.warn(`Circuit breaker opened for ${serviceKey}`, {
      serviceKey,
      totalFailures: state.totalFailures,
      nextAttemptTime: state.nextAttemptTime
    });
  }

  /**
   * Transition to half-open state
   */
  private async transitionToHalfOpen(serviceKey: string): Promise<void> {
    const state = await this.getCircuitState(serviceKey);

    state.state = 'HALF_OPEN';
    state.lastStateChange = new Date();
    state.halfOpenAttempts = 0;
    delete state.nextAttemptTime;

    await this.saveCircuitState(serviceKey, state);

    logger.info(`Circuit breaker transitioned to half-open for ${serviceKey}`, {
      serviceKey
    });
  }

  /**
   * Transition to closed state
   */
  private async transitionToClosed(serviceKey: string): Promise<void> {
    const state = await this.getCircuitState(serviceKey);

    state.state = 'CLOSED';
    state.lastStateChange = new Date();
    state.failureCount = 0;
    state.halfOpenAttempts = 0;
    delete state.nextAttemptTime;

    await this.saveCircuitState(serviceKey, state);

    logger.info(`Circuit breaker closed for ${serviceKey}`, {
      serviceKey,
      successCount: state.successCount
    });
  }

  /**
   * Get circuit breaker metrics
   */
  async getCircuitMetrics(serviceKey: string): Promise<CircuitBreakerState | null> {
    try {
      return await this.getCircuitState(serviceKey);
    } catch (error) {
      logger.error(`Failed to get circuit metrics for ${serviceKey}: ${error}`);
      return null;
    }
  }

  /**
   * Reset circuit breaker
   */
  async resetCircuit(serviceKey: string): Promise<void> {
    const state = await this.getCircuitState(serviceKey);

    state.state = 'CLOSED';
    state.failureCount = 0;
    state.halfOpenAttempts = 0;
    state.successCount = 0;
    state.lastStateChange = new Date();
    delete state.lastFailureTime;
    delete state.nextAttemptTime;

    await this.saveCircuitState(serviceKey, state);

    logger.info(`Circuit breaker reset for ${serviceKey}`, { serviceKey });
  }

  /**
   * Get all circuit breaker states
   */
  async getAllCircuitStates(): Promise<Record<string, CircuitBreakerState>> {
    const states: Record<string, CircuitBreakerState> = {};

    // Get from local cache
    for (const [key, state] of this.circuitStates) {
      states[key] = state;
    }

    // Get additional states from Redis
    try {
      const keys = await this.redis.keys('circuit_breaker:*');
      for (const key of keys) {
        const serviceKey = key.replace('circuit_breaker:', '');
        if (!states[serviceKey]) {
          const redisState = await this.redis.get(key);
          if (redisState) {
            const state = JSON.parse(redisState);
            // Convert date strings back to Date objects
            if (state.lastFailureTime) state.lastFailureTime = new Date(state.lastFailureTime);
            if (state.nextAttemptTime) state.nextAttemptTime = new Date(state.nextAttemptTime);
            if (state.lastStateChange) state.lastStateChange = new Date(state.lastStateChange);
            states[serviceKey] = state;
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to get circuit states from Redis: ${error}`);
    }

    return states;
  }
}

// ============================================================================
// DISTRIBUTED RETRY COORDINATOR
// ============================================================================

export class DistributedRetryCoordinator {
  private redis: Redis;
  private instanceId: string;
  private coordinationInterval?: NodeJS.Timeout;

  constructor() {
    this.redis = cacheManager as any;
    this.instanceId = `instance_${process.pid}_${Date.now()}`;
  }

  /**
   * Initialize distributed coordination
   */
  async initialize(): Promise<void> {
    // Register this instance
    await this.registerInstance();

    // Start coordination monitoring
    this.coordinationInterval = setInterval(() => {
      this.updateCoordination();
    }, 30000); // Update every 30 seconds

    logger.info('Distributed retry coordinator initialized', {
      instanceId: this.instanceId
    });
  }

  /**
   * Check if retry should be coordinated
   */
  async shouldCoordinateRetry(
    coordinationKey: string,
    config: ContextAwareRetryConfig
  ): Promise<{ allowed: boolean; coordinatedDelay: number; reasoning: string }> {
    if (!config.enableDistributedCoordination) {
      return { allowed: true, coordinatedDelay: 0, reasoning: 'Coordination disabled' };
    }

    try {
      const coordination = await this.getCoordination(coordinationKey);

      // Check global backpressure
      if (config.respectGlobalBackpressure && coordination.globalBackpressure) {
        return {
          allowed: false,
          coordinatedDelay: coordination.coordinatedDelay,
          reasoning: 'Global backpressure active'
        };
      }

      // Check retry budget
      const instanceRetryCount = coordination.instanceRetryLoad[this.instanceId] || 0;
      const totalRetries = Object.values(coordination.instanceRetryLoad).reduce((sum, count) => sum + count, 0);

      if (totalRetries >= (config.retryBudgetPerMinute || 100)) {
        return {
          allowed: false,
          coordinatedDelay: 60000, // Wait 1 minute
          reasoning: 'Global retry budget exceeded'
        };
      }

      // Calculate coordinated delay based on load distribution
      const averageLoad = totalRetries / coordination.totalInstances;
      const instanceLoad = instanceRetryCount / averageLoad;

      let coordinatedDelay = 0;
      if (instanceLoad > 1.5) {
        coordinatedDelay = Math.min(5000, instanceLoad * 1000); // Up to 5 seconds
      }

      return {
        allowed: true,
        coordinatedDelay,
        reasoning: `Instance load: ${instanceLoad.toFixed(2)}x average`
      };

    } catch (error) {
      logger.warn(`Failed to coordinate retry: ${error}`);
      return { allowed: true, coordinatedDelay: 0, reasoning: 'Coordination failed, allowing retry' };
    }
  }

  /**
   * Record retry attempt
   */
  async recordRetryAttempt(coordinationKey: string, success: boolean): Promise<void> {
    try {
      const coordination = await this.getCoordination(coordinationKey);

      // Update instance retry count
      coordination.instanceRetryLoad[this.instanceId] = (coordination.instanceRetryLoad[this.instanceId] || 0) + 1;
      coordination.activeRetries++;

      // Update global metrics
      if (success) {
        coordination.globalSuccessRate = (coordination.globalSuccessRate * 0.9) + (1 * 0.1);
      } else {
        coordination.globalFailureRate = (coordination.globalFailureRate * 0.9) + (1 * 0.1);
      }

      coordination.lastCoordination = new Date();

      await this.saveCoordination(coordinationKey, coordination);

    } catch (error) {
      logger.warn(`Failed to record retry attempt: ${error}`);
    }
  }

  /**
   * Get coordination state
   */
  private async getCoordination(coordinationKey: string): Promise<DistributedRetryCoordination> {
    try {
      const redisKey = `retry_coordination:${coordinationKey}`;
      const data = await this.redis.get(redisKey);

      if (data) {
        const coordination = JSON.parse(data);
        coordination.lastCoordination = new Date(coordination.lastCoordination);
        return coordination;
      }
    } catch (error) {
      logger.warn(`Failed to get coordination state: ${error}`);
    }

    // Return default coordination state
    return {
      coordinationKey,
      totalInstances: 1,
      activeRetries: 0,
      globalBackpressure: false,
      coordinatedDelay: 0,
      lastCoordination: new Date(),
      instanceRetryLoad: {},
      recommendedDistribution: {},
      globalSuccessRate: 0.5,
      globalFailureRate: 0.5,
      globalAverageDelay: 1000
    };
  }

  /**
   * Save coordination state
   */
  private async saveCoordination(coordinationKey: string, coordination: DistributedRetryCoordination): Promise<void> {
    try {
      const redisKey = `retry_coordination:${coordinationKey}`;
      await this.redis.setex(redisKey, 300, JSON.stringify(coordination)); // 5 minutes TTL
    } catch (error) {
      logger.warn(`Failed to save coordination state: ${error}`);
    }
  }

  /**
   * Register this instance
   */
  private async registerInstance(): Promise<void> {
    try {
      const instanceKey = `retry_instance:${this.instanceId}`;
      await this.redis.setex(instanceKey, 60, JSON.stringify({
        instanceId: this.instanceId,
        registeredAt: new Date(),
        lastHeartbeat: new Date()
      }));
    } catch (error) {
      logger.warn(`Failed to register instance: ${error}`);
    }
  }

  /**
   * Update coordination state
   */
  private async updateCoordination(): Promise<void> {
    try {
      // Update heartbeat
      await this.registerInstance();

      // Clean up expired instances
      await this.cleanupExpiredInstances();

    } catch (error) {
      logger.warn(`Failed to update coordination: ${error}`);
    }
  }

  /**
   * Cleanup expired instances
   */
  private async cleanupExpiredInstances(): Promise<void> {
    try {
      const instanceKeys = await this.redis.keys('retry_instance:*');
      const expiredInstances: string[] = [];

      for (const key of instanceKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const instance = JSON.parse(data);
          const lastHeartbeat = new Date(instance.lastHeartbeat);
          const now = new Date();

          if (now.getTime() - lastHeartbeat.getTime() > 120000) { // 2 minutes
            expiredInstances.push(instance.instanceId);
            await this.redis.del(key);
          }
        }
      }

      if (expiredInstances.length > 0) {
        logger.info(`Cleaned up ${expiredInstances.length} expired instances`, {
          expiredInstances
        });
      }

    } catch (error) {
      logger.warn(`Failed to cleanup expired instances: ${error}`);
    }
  }

  /**
   * Shutdown coordination
   */
  async shutdown(): Promise<void> {
    if (this.coordinationInterval) {
      clearInterval(this.coordinationInterval);
    }

    try {
      // Unregister instance
      const instanceKey = `retry_instance:${this.instanceId}`;
      await this.redis.del(instanceKey);

      logger.info('Distributed retry coordinator shutdown', {
        instanceId: this.instanceId
      });
    } catch (error) {
      logger.warn(`Failed to shutdown coordinator: ${error}`);
    }
  }
}

// ============================================================================
// SERVICE HEALTH MONITOR
// ============================================================================

export class ServiceHealthMonitor {
  private healthMetrics: Map<string, ServiceHealthMetrics> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private redis: Redis;

  constructor() {
    this.redis = cacheManager as any;
  }

  /**
   * Initialize health monitoring
   */
  initialize(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateHealthMetrics();
    }, 30000); // Update every 30 seconds

    logger.info('Service health monitor initialized');
  }

  /**
   * Get service health metrics
   */
  async getServiceHealth(serviceType: string): Promise<ServiceHealthMetrics> {
    let metrics = this.healthMetrics.get(serviceType);

    if (!metrics) {
      // Try to get from Redis
      try {
        const redisData = await this.redis.get(`service_health:${serviceType}`);
        if (redisData) {
          metrics = JSON.parse(redisData);
          metrics!.lastHealthCheck = new Date(metrics!.lastHealthCheck);
          this.healthMetrics.set(serviceType, metrics!);
        }
      } catch (error) {
        logger.warn(`Failed to get service health from Redis: ${error}`);
      }
    }

    if (!metrics) {
      // Create default metrics
      metrics = {
        serviceType,
        healthScore: 100,
        successRate: 1.0,
        averageResponseTime: 1000,
        errorRate: 0,
        lastHealthCheck: new Date(),
        cpuUtilization: 50,
        memoryUtilization: 50,
        activeConnections: 0,
        queueLength: 0,
        circuitBreakerState: 'CLOSED',
        circuitBreakerFailureCount: 0
      };

      this.healthMetrics.set(serviceType, metrics);
    }

    return metrics;
  }

  /**
   * Update service health metrics
   */
  async updateServiceHealth(
    serviceType: string,
    updates: Partial<ServiceHealthMetrics>
  ): Promise<void> {
    const metrics = await this.getServiceHealth(serviceType);

    // Apply updates
    Object.assign(metrics, updates);
    metrics.lastHealthCheck = new Date();

    // Calculate health score
    metrics.healthScore = this.calculateHealthScore(metrics);

    // Save to cache and Redis
    this.healthMetrics.set(serviceType, metrics);

    try {
      await this.redis.setex(
        `service_health:${serviceType}`,
        300, // 5 minutes TTL
        JSON.stringify(metrics)
      );
    } catch (error) {
      logger.warn(`Failed to save service health to Redis: ${error}`);
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(metrics: ServiceHealthMetrics): number {
    let score = 100;

    // Success rate impact (40% weight)
    score -= (1 - metrics.successRate) * 40;

    // Error rate impact (20% weight)
    score -= metrics.errorRate * 20;

    // Response time impact (20% weight)
    if (metrics.averageResponseTime > 5000) {
      score -= Math.min(20, (metrics.averageResponseTime - 5000) / 1000 * 5);
    }

    // Resource utilization impact (10% weight)
    if (metrics.cpuUtilization > 80) {
      score -= (metrics.cpuUtilization - 80) / 20 * 10;
    }

    if (metrics.memoryUtilization > 80) {
      score -= (metrics.memoryUtilization - 80) / 20 * 10;
    }

    // Circuit breaker impact (10% weight)
    if (metrics.circuitBreakerState === 'OPEN') {
      score -= 10;
    } else if (metrics.circuitBreakerState === 'HALF_OPEN') {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update health metrics for all services
   */
  private async updateHealthMetrics(): Promise<void> {
    try {
      // This would typically collect metrics from various sources
      // For now, we'll update based on available data

      for (const [serviceType, metrics] of this.healthMetrics) {
        // Simulate health metric updates
        // In a real implementation, this would collect actual metrics

        // Age the metrics slightly to simulate degradation over time
        if (Date.now() - metrics.lastHealthCheck.getTime() > 60000) {
          metrics.healthScore = Math.max(0, metrics.healthScore - 1);
        }

        await this.updateServiceHealth(serviceType, {});
      }

    } catch (error) {
      logger.error(`Failed to update health metrics: ${error}`);
    }
  }

  /**
   * Get all service health metrics
   */
  getAllServiceHealth(): Record<string, ServiceHealthMetrics> {
    const allMetrics: Record<string, ServiceHealthMetrics> = {};

    for (const [serviceType, metrics] of this.healthMetrics) {
      allMetrics[serviceType] = { ...metrics };
    }

    return allMetrics;
  }

  /**
   * Shutdown health monitoring
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    logger.info('Service health monitor shutdown');
  }
}

// ============================================================================
// MAIN INTELLIGENT RETRY MANAGER
// ============================================================================

/**
 * Intelligent Retry Manager
 *
 * Orchestrates sophisticated retry logic with exponential backoff algorithms and circuit breaker patterns
 * that enhance all existing Twikit services with intelligent failure recovery.
 */
export class IntelligentRetryManager extends EventEmitter {
  private backoffCalculator: AdaptiveBackoffCalculator;
  private circuitBreaker: EnhancedCircuitBreaker;
  private distributedCoordinator: DistributedRetryCoordinator;
  private healthMonitor: ServiceHealthMonitor;
  private baseRetryEngine: IntelligentRetryEngine;

  // Integration services
  private connectionPool: TwikitConnectionPool | undefined;
  private campaignOrchestrator: CampaignOrchestrator | undefined;
  private analyticsService: AdvancedAnalyticsService | undefined;

  // Performance tracking
  private performanceMetrics: Map<string, RetryPerformanceMetrics> = new Map();
  private isInitialized: boolean = false;

  constructor(
    integrations?: {
      connectionPool?: TwikitConnectionPool;
      campaignOrchestrator?: CampaignOrchestrator;
      analyticsService?: AdvancedAnalyticsService;
    }
  ) {
    super();

    this.backoffCalculator = new AdaptiveBackoffCalculator();
    this.circuitBreaker = new EnhancedCircuitBreaker();
    this.distributedCoordinator = new DistributedRetryCoordinator();
    this.healthMonitor = new ServiceHealthMonitor();
    this.baseRetryEngine = new IntelligentRetryEngine();

    // Set up integrations
    this.connectionPool = integrations?.connectionPool;
    this.campaignOrchestrator = integrations?.campaignOrchestrator;
    this.analyticsService = integrations?.analyticsService;

    logger.info('IntelligentRetryManager created');
  }

  /**
   * Initialize the retry manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('IntelligentRetryManager already initialized');
      return;
    }

    try {
      logger.info('Initializing IntelligentRetryManager...');

      // Initialize components
      await this.distributedCoordinator.initialize();
      this.healthMonitor.initialize();

      // Setup integration event handlers
      this.setupIntegrationHandlers();

      this.isInitialized = true;

      logger.info('IntelligentRetryManager initialized successfully');
      this.emit('initialized');

    } catch (error) {
      logger.error('Failed to initialize IntelligentRetryManager:', error);
      throw error;
    }
  }

  /**
   * Execute operation with intelligent retry
   */
  async executeWithIntelligentRetry<T>(
    operation: () => Promise<T>,
    config: ContextAwareRetryConfig,
    context?: Partial<RetryContext>
  ): Promise<T> {
    const correlationId = context?.correlationId || `retry_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    // Build complete retry context
    const retryContext = await this.buildRetryContext(config, context, correlationId);

    // Check circuit breaker
    const serviceKey = `${config.serviceType}:${config.operationType}`;
    const canExecute = await this.circuitBreaker.canExecute(serviceKey, config);

    if (!canExecute) {
      const circuitState = await this.circuitBreaker.getCircuitMetrics(serviceKey);
      throw new TwikitError(
        TwikitErrorType.ACTION_FAILED,
        `Service circuit breaker is open: ${serviceKey}`,
        {
          serviceKey,
          circuitState: circuitState?.state,
          nextAttemptTime: circuitState?.nextAttemptTime
        }
      );
    }

    // Check distributed coordination
    const coordinationKey = config.coordinationKey || serviceKey;
    const coordinationResult = await this.distributedCoordinator.shouldCoordinateRetry(coordinationKey, config);

    if (!coordinationResult.allowed) {
      throw new TwikitError(
        TwikitErrorType.RATE_LIMIT_EXCEEDED,
        `Retry coordination blocked: ${coordinationResult.reasoning}`,
        { coordinationKey, reasoning: coordinationResult.reasoning }
      );
    }

    // Apply coordinated delay if needed
    if (coordinationResult.coordinatedDelay > 0) {
      await this.sleep(coordinationResult.coordinatedDelay);
    }

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < config.maxAttempts) {
      attempt++;
      retryContext.currentAttempt = attempt;

      const attemptStartTime = Date.now();

      try {
        // Execute the operation
        const result = await operation();

        // Record success
        const responseTime = Date.now() - attemptStartTime;
        await this.recordSuccess(serviceKey, config, retryContext, responseTime);

        // Update performance metrics
        this.updatePerformanceMetrics(config, retryContext, true, responseTime);

        logger.debug(`Operation succeeded on attempt ${attempt}`, {
          correlationId,
          serviceKey,
          attempt,
          responseTime
        });

        this.emit('retrySuccess', {
          correlationId,
          serviceKey,
          attempt,
          responseTime,
          config
        });

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const responseTime = Date.now() - attemptStartTime;

        // Record failure
        await this.recordFailure(serviceKey, config, retryContext, lastError, responseTime);

        // Check if error is retryable
        const isRetryable = this.isErrorRetryable(lastError, config);

        if (!isRetryable || attempt >= config.maxAttempts) {
          // Update performance metrics for final failure
          this.updatePerformanceMetrics(config, retryContext, false, responseTime);

          logger.error(`Operation failed after ${attempt} attempts`, {
            correlationId,
            serviceKey,
            attempt,
            error: lastError.message,
            isRetryable
          });

          this.emit('retryFailed', {
            correlationId,
            serviceKey,
            attempt,
            error: lastError,
            config
          });

          break;
        }

        // Calculate adaptive backoff delay
        const backoffResult = this.backoffCalculator.calculateAdaptiveBackoff(
          config,
          retryContext,
          config.baseDelay
        );

        logger.info(`Retrying operation after failure`, {
          correlationId,
          serviceKey,
          attempt,
          nextAttempt: attempt + 1,
          delay: backoffResult.delay,
          strategy: backoffResult.strategy,
          reasoning: backoffResult.reasoning,
          error: lastError.message
        });

        this.emit('retryAttempt', {
          correlationId,
          serviceKey,
          attempt,
          delay: backoffResult.delay,
          error: lastError,
          config
        });

        // Wait before retry
        if (backoffResult.delay > 0) {
          await this.sleep(backoffResult.delay);
        }

        // Update retry context for next attempt
        retryContext.lastError = lastError;
        retryContext.serviceHealth = await this.healthMonitor.getServiceHealth(config.serviceType);
      }
    }

    // All attempts failed
    const totalTime = Date.now() - startTime;

    // Record distributed retry attempt
    await this.distributedCoordinator.recordRetryAttempt(coordinationKey, false);

    // Update performance metrics for final failure
    this.updatePerformanceMetrics(config, retryContext, false, totalTime);

    logger.error(`All retry attempts failed`, {
      correlationId,
      serviceKey,
      totalAttempts: attempt,
      totalTime,
      finalError: lastError?.message
    });

    // Throw the last error
    throw lastError || new TwikitError(
      TwikitErrorType.ACTION_FAILED,
      `Operation failed after ${attempt} attempts`,
      { correlationId, serviceKey, totalAttempts: attempt }
    );
  }

  /**
   * Build complete retry context
   */
  private async buildRetryContext(
    config: ContextAwareRetryConfig,
    partialContext?: Partial<RetryContext>,
    correlationId?: string
  ): Promise<RetryContext> {
    const serviceHealth = await this.healthMonitor.getServiceHealth(config.serviceType);

    // Get connection pool state if available
    let connectionPoolState: ConnectionPoolState | undefined;
    if (this.connectionPool) {
      const poolStatus = this.connectionPool.getPoolStatus();
      const poolMetrics = this.connectionPool.getMetrics();

      connectionPoolState = {
        totalConnections: poolStatus.totalConnections,
        availableConnections: poolStatus.availableConnections,
        queuedRequests: poolStatus.queuedRequests,
        averageAcquisitionTime: poolMetrics.averageAcquisitionTime,
        poolUtilization: poolStatus.totalConnections > 0
          ? (poolStatus.totalConnections - poolStatus.availableConnections) / poolStatus.totalConnections
          : 0,
        scalingInProgress: false // Would be determined by actual pool state
      };
    }

    // Get campaign state if available
    let campaignState: CampaignState | undefined;
    if (config.campaignId && this.campaignOrchestrator) {
      // Would get actual campaign state from orchestrator
      campaignState = {
        campaignId: config.campaignId,
        status: 'ACTIVE',
        priority: config.priority || ConnectionPriority.NORMAL,
        resourceAllocation: 0.5,
        successRate: 0.8,
        remainingActions: 100,
        estimatedCompletion: new Date(Date.now() + 3600000)
      };
    }

    return {
      correlationId: correlationId || `retry_${Date.now()}`,
      serviceType: config.serviceType,
      operationType: config.operationType,
      accountId: config.accountId || '',
      campaignId: config.campaignId,
      priority: config.priority || ConnectionPriority.NORMAL,

      startTime: new Date(),
      currentAttempt: 0,
      totalAttempts: config.maxAttempts,

      serviceHealth,
      connectionPoolState,
      campaignState,

      averageSuccessRate: serviceHealth.successRate,
      recentFailureRate: serviceHealth.errorRate,
      systemLoad: Math.max(serviceHealth.cpuUtilization, serviceHealth.memoryUtilization) / 100,

      globalBackpressure: false,
      distributedRetryCount: 0,
      coordinatedDelay: 0,

      ...partialContext
    };
  }

  /**
   * Setup integration event handlers
   */
  private setupIntegrationHandlers(): void {
    // Campaign Orchestrator integration
    if (this.campaignOrchestrator) {
      this.campaignOrchestrator.on('campaignStarted', (data: any) => {
        this.handleCampaignStarted(data);
      });

      this.campaignOrchestrator.on('campaignPriorityChanged', (data: any) => {
        this.handleCampaignPriorityChanged(data);
      });
    }

    // Analytics Service integration
    if (this.analyticsService) {
      // Send retry metrics to analytics service
      this.on('retrySuccess', (data: any) => {
        // Note: Analytics service integration would be implemented here
        logger.debug('Retry success metrics sent to analytics', data);
      });

      this.on('retryFailed', (data: any) => {
        // Note: Analytics service integration would be implemented here
        logger.debug('Retry failure metrics sent to analytics', data);
      });
    }
  }

  /**
   * Handle campaign started event
   */
  private async handleCampaignStarted(data: any): Promise<void> {
    try {
      const { campaignId, priority } = data;

      // Update service health for campaign-related services
      await this.healthMonitor.updateServiceHealth('campaign_orchestrator', {
        activeConnections: (await this.healthMonitor.getServiceHealth('campaign_orchestrator')).activeConnections + 1
      });

      logger.info(`Campaign started, updating retry policies`, {
        campaignId,
        priority
      });

    } catch (error) {
      logger.error(`Failed to handle campaign started event:`, error);
    }
  }

  /**
   * Handle campaign priority changed event
   */
  private async handleCampaignPriorityChanged(data: any): Promise<void> {
    try {
      const { campaignId, newPriority } = data;

      logger.info(`Campaign priority changed`, {
        campaignId,
        newPriority
      });

    } catch (error) {
      logger.error(`Failed to handle campaign priority change:`, error);
    }
  }

  /**
   * Record successful operation
   */
  private async recordSuccess(
    serviceKey: string,
    config: ContextAwareRetryConfig,
    _context: RetryContext,
    responseTime: number
  ): Promise<void> {
    try {
      // Record in circuit breaker
      await this.circuitBreaker.recordResult(serviceKey, config, true, responseTime);

      // Record in backoff calculator
      this.backoffCalculator.recordPerformance(
        config.serviceType,
        config.operationType,
        true,
        0, // No delay for successful operation
        responseTime
      );

      // Record in distributed coordinator
      const coordinationKey = config.coordinationKey || serviceKey;
      await this.distributedCoordinator.recordRetryAttempt(coordinationKey, true);

      // Update service health
      await this.healthMonitor.updateServiceHealth(config.serviceType, {
        successRate: Math.min(1.0, (await this.healthMonitor.getServiceHealth(config.serviceType)).successRate + 0.01),
        averageResponseTime: responseTime
      });

    } catch (error) {
      logger.warn(`Failed to record success: ${error}`);
    }
  }

  /**
   * Record failed operation
   */
  private async recordFailure(
    serviceKey: string,
    config: ContextAwareRetryConfig,
    _context: RetryContext,
    _error: Error,
    responseTime: number
  ): Promise<void> {
    try {
      // Record in circuit breaker
      await this.circuitBreaker.recordResult(serviceKey, config, false, responseTime);

      // Record in backoff calculator
      this.backoffCalculator.recordPerformance(
        config.serviceType,
        config.operationType,
        false,
        config.baseDelay,
        responseTime
      );

      // Update service health
      const currentHealth = await this.healthMonitor.getServiceHealth(config.serviceType);
      await this.healthMonitor.updateServiceHealth(config.serviceType, {
        errorRate: Math.min(1.0, currentHealth.errorRate + 0.01),
        successRate: Math.max(0.0, currentHealth.successRate - 0.01)
      });

    } catch (recordError) {
      logger.warn(`Failed to record failure: ${recordError}`);
    }
  }

  /**
   * Check if error is retryable
   */
  private isErrorRetryable(error: Error, _config: ContextAwareRetryConfig): boolean {
    // Use existing error classification from base retry engine
    if (this.baseRetryEngine && typeof (this.baseRetryEngine as any).isRetryableError === 'function') {
      return (this.baseRetryEngine as any).isRetryableError(error);
    }

    // Fallback logic
    const errorMessage = error.message.toLowerCase();

    // Non-retryable errors
    if (errorMessage.includes('authentication') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('not found')) {
      return false;
    }

    // Retryable errors
    if (errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('service unavailable')) {
      return true;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(
    config: ContextAwareRetryConfig,
    context: RetryContext,
    success: boolean,
    responseTime: number
  ): void {
    const metricsKey = `${config.serviceType}:${config.operationType}`;

    let metrics = this.performanceMetrics.get(metricsKey);
    if (!metrics) {
      metrics = {
        serviceType: config.serviceType,
        operationType: config.operationType,
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        retrySuccessRate: 0,
        averageRetryDelay: 0,
        totalRetryTime: 0,
        averageTimeToSuccess: 0,
        backoffStrategy: config.backoffStrategy,
        averageBackoffDelay: config.baseDelay,
        backoffEffectiveness: 0.5,
        circuitBreakerTrips: 0,
        circuitBreakerRecoveries: 0,
        averageCircuitOpenTime: 0,
        resourceUtilizationImpact: 0,
        concurrentRetryPeak: 0,
        retryBudgetUtilization: 0,
        optimizationOpportunities: [],
        recommendedAdjustments: {},
        timestamp: new Date()
      };
    }

    // Update metrics
    if (context.currentAttempt > 1) {
      metrics.totalRetries++;
      if (success) {
        metrics.successfulRetries++;
      } else {
        metrics.failedRetries++;
      }

      metrics.retrySuccessRate = metrics.successfulRetries / metrics.totalRetries;
      metrics.averageTimeToSuccess = (metrics.averageTimeToSuccess + responseTime) / 2;
    }

    metrics.timestamp = new Date();
    this.performanceMetrics.set(metricsKey, metrics);
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry performance metrics
   */
  getPerformanceMetrics(serviceType?: string, operationType?: string): Record<string, RetryPerformanceMetrics> {
    const result: Record<string, RetryPerformanceMetrics> = {};

    for (const [key, metrics] of this.performanceMetrics) {
      if (serviceType && !key.startsWith(serviceType)) continue;
      if (operationType && !key.includes(operationType)) continue;

      result[key] = { ...metrics };
    }

    return result;
  }

  /**
   * Get circuit breaker states
   */
  async getCircuitBreakerStates(): Promise<Record<string, CircuitBreakerState>> {
    return await this.circuitBreaker.getAllCircuitStates();
  }

  /**
   * Get service health metrics
   */
  getServiceHealthMetrics(): Record<string, ServiceHealthMetrics> {
    return this.healthMonitor.getAllServiceHealth();
  }

  /**
   * Reset circuit breaker for service
   */
  async resetCircuitBreaker(serviceKey: string): Promise<void> {
    await this.circuitBreaker.resetCircuit(serviceKey);

    logger.info(`Circuit breaker reset for ${serviceKey}`, { serviceKey });

    this.emit('circuitBreakerReset', { serviceKey });
  }

  /**
   * Shutdown the retry manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down IntelligentRetryManager...');

    try {
      // Shutdown components
      await this.distributedCoordinator.shutdown();
      this.healthMonitor.shutdown();

      this.isInitialized = false;

      logger.info('IntelligentRetryManager shutdown completed');
      this.emit('shutdown');

    } catch (error) {
      logger.error('Error during IntelligentRetryManager shutdown:', error);
      throw error;
    }
  }
}

// ============================================================================
// DEFAULT RETRY CONFIGURATIONS
// ============================================================================

export const DEFAULT_RETRY_CONFIGS: Record<string, ContextAwareRetryConfig> = {
  session_manager: {
    serviceType: 'session_manager',
    operationType: 'default',
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffStrategy: 'exponential',
    jitterType: 'full',
    enableAdaptiveBackoff: true,
    successRateThreshold: 0.7,
    adaptationFactor: 0.5,
    learningWindow: 10,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    circuitBreakerHalfOpenMaxCalls: 3,
    enableResourceAwareRetry: true,
    maxConcurrentRetries: 10,
    retryBudgetPerMinute: 100,
    retryBudgetPerHour: 1000,
    enableDistributedCoordination: true,
    respectGlobalBackpressure: true,
    enablePerformanceTracking: true,
    trackRetryEffectiveness: true,
    enableOptimizationSuggestions: true
  },

  connection_pool: {
    serviceType: 'connection_pool',
    operationType: 'acquire_connection',
    maxAttempts: 5,
    baseDelay: 500,
    maxDelay: 10000,
    backoffStrategy: 'adaptive',
    jitterType: 'equal',
    enableAdaptiveBackoff: true,
    successRateThreshold: 0.8,
    adaptationFactor: 0.3,
    learningWindow: 20,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 10,
    circuitBreakerTimeout: 30000,
    circuitBreakerHalfOpenMaxCalls: 5,
    enableResourceAwareRetry: true,
    maxConcurrentRetries: 20,
    retryBudgetPerMinute: 200,
    retryBudgetPerHour: 2000,
    enableDistributedCoordination: true,
    respectGlobalBackpressure: true,
    enablePerformanceTracking: true,
    trackRetryEffectiveness: true,
    enableOptimizationSuggestions: true
  },

  campaign_orchestrator: {
    serviceType: 'campaign_orchestrator',
    operationType: 'execute_action',
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffStrategy: 'exponential',
    jitterType: 'decorrelated',
    enableAdaptiveBackoff: true,
    successRateThreshold: 0.6,
    adaptationFactor: 0.7,
    learningWindow: 15,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 3,
    circuitBreakerTimeout: 120000,
    circuitBreakerHalfOpenMaxCalls: 2,
    enableResourceAwareRetry: true,
    maxConcurrentRetries: 5,
    retryBudgetPerMinute: 50,
    retryBudgetPerHour: 500,
    enableDistributedCoordination: true,
    respectGlobalBackpressure: false, // Campaigns may need to override backpressure
    enablePerformanceTracking: true,
    trackRetryEffectiveness: true,
    enableOptimizationSuggestions: true
  }
};

// ============================================================================
// EXPORTS AND SINGLETON
// ============================================================================

// Singleton instance
export const intelligentRetryManager = new IntelligentRetryManager();
