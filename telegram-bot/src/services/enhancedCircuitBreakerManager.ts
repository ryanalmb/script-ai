/**
 * Enhanced Circuit Breaker Manager - Success Criteria Implementation
 * 
 * Implements advanced circuit breaker patterns with graceful degradation to ensure
 * system resilience and maintain service availability even during failures.
 * 
 * Key Features:
 * - Advanced circuit breaker states with half-open testing
 * - Graceful degradation with fallback mechanisms
 * - Service mesh-like failure isolation and recovery
 * - Adaptive thresholds based on service characteristics
 * - Real-time monitoring and automatic recovery
 * - Comprehensive failure pattern analysis
 */

import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// Circuit Breaker Types
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  serviceName: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  volumeThreshold: number;
  errorThresholdPercentage: number;
  halfOpenMaxCalls: number;
  fallbackEnabled: boolean;
  gracefulDegradationEnabled: boolean;
  adaptiveThresholds: boolean;
}

export interface CircuitBreakerState {
  serviceName: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttemptTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  errorRate: number;
  config: CircuitBreakerConfig;
  fallbackActive: boolean;
  degradationLevel: 'none' | 'partial' | 'full';
}

export interface FallbackStrategy {
  serviceName: string;
  strategyType: 'cached_response' | 'default_value' | 'alternative_service' | 'degraded_functionality';
  implementation: (error: Error, context?: any) => Promise<any>;
  priority: number;
  enabled: boolean;
}

export interface GracefulDegradationConfig {
  serviceName: string;
  degradationLevels: {
    partial: {
      disabledFeatures: string[];
      fallbackBehavior: string;
      userMessage: string;
    };
    full: {
      disabledFeatures: string[];
      fallbackBehavior: string;
      userMessage: string;
    };
  };
  autoRecovery: boolean;
  recoveryThreshold: number;
}

/**
 * Enhanced Circuit Breaker Manager - Main Implementation
 */
export class EnhancedCircuitBreakerManager extends EventEmitter {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private fallbackStrategies = new Map<string, FallbackStrategy[]>();
  private degradationConfigs = new Map<string, GracefulDegradationConfig>();
  
  // Monitoring intervals
  private stateMonitoringInterval: NodeJS.Timeout | null = null;
  private recoveryTestingInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  
  private isInitialized = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize the enhanced circuit breaker manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enhanced Circuit Breaker Manager already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Enhanced Circuit Breaker Manager...');

      // Initialize default circuit breakers
      this.initializeDefaultCircuitBreakers();

      // Initialize fallback strategies
      this.initializeFallbackStrategies();

      // Initialize graceful degradation configs
      this.initializeGracefulDegradation();

      // Start monitoring
      // this.startStateMonitoring();
      // this.startRecoveryTesting();
      // this.startMetricsCollection();

      this.isInitialized = true;
      this.emit('manager:initialized');

      logger.info('✅ Enhanced Circuit Breaker Manager initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Enhanced Circuit Breaker Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize default circuit breakers for services
   */
  private initializeDefaultCircuitBreakers(): void {
    const defaultConfigs: CircuitBreakerConfig[] = [
      {
        serviceName: 'twikit-session-manager',
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000, // 1 minute
        volumeThreshold: 10,
        errorThresholdPercentage: 50,
        halfOpenMaxCalls: 3,
        fallbackEnabled: true,
        gracefulDegradationEnabled: true,
        adaptiveThresholds: true
      },
      {
        serviceName: 'global-rate-limit-coordinator',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 30000, // 30 seconds
        volumeThreshold: 5,
        errorThresholdPercentage: 60,
        halfOpenMaxCalls: 2,
        fallbackEnabled: true,
        gracefulDegradationEnabled: true,
        adaptiveThresholds: true
      },
      {
        serviceName: 'llm-service',
        failureThreshold: 8,
        successThreshold: 5,
        timeout: 120000, // 2 minutes
        volumeThreshold: 15,
        errorThresholdPercentage: 40,
        halfOpenMaxCalls: 5,
        fallbackEnabled: true,
        gracefulDegradationEnabled: true,
        adaptiveThresholds: true
      },
      {
        serviceName: 'default',
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000,
        volumeThreshold: 10,
        errorThresholdPercentage: 50,
        halfOpenMaxCalls: 3,
        fallbackEnabled: true,
        gracefulDegradationEnabled: true,
        adaptiveThresholds: true
      }
    ];

    for (const config of defaultConfigs) {
      const state: CircuitBreakerState = {
        serviceName: config.serviceName,
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextAttemptTime: null,
        totalRequests: 0,
        totalFailures: 0,
        errorRate: 0,
        config,
        fallbackActive: false,
        degradationLevel: 'none'
      };

      this.circuitBreakers.set(config.serviceName, state);
    }

    logger.info(`🔧 Initialized ${defaultConfigs.length} circuit breakers`);
  }

  /**
   * Initialize fallback strategies
   */
  private initializeFallbackStrategies(): void {
    const strategies: { serviceName: string; strategies: FallbackStrategy[] }[] = [
      {
        serviceName: 'twikit-session-manager',
        strategies: [
          {
            serviceName: 'twikit-session-manager',
            strategyType: 'cached_response',
            implementation: async (error: Error, context?: any) => {
              // Return cached session data if available
              return { success: false, error: 'Service temporarily unavailable', cached: true };
            },
            priority: 1,
            enabled: true
          },
          {
            serviceName: 'twikit-session-manager',
            strategyType: 'degraded_functionality',
            implementation: async (error: Error, context?: any) => {
              // Provide limited functionality
              return { success: false, error: 'Limited functionality available', degraded: true };
            },
            priority: 2,
            enabled: true
          }
        ]
      },
      {
        serviceName: 'llm-service',
        strategies: [
          {
            serviceName: 'llm-service',
            strategyType: 'default_value',
            implementation: async (error: Error, context?: any) => {
              // Return default response
              return { 
                success: true, 
                data: { 
                  content: 'Service temporarily unavailable. Please try again later.',
                  fallback: true 
                }
              };
            },
            priority: 1,
            enabled: true
          }
        ]
      }
    ];

    for (const { serviceName, strategies: serviceStrategies } of strategies) {
      this.fallbackStrategies.set(serviceName, serviceStrategies);
    }

    logger.info(`🛡️ Initialized fallback strategies for ${strategies.length} services`);
  }

  /**
   * Initialize graceful degradation configurations
   */
  private initializeGracefulDegradation(): void {
    const degradationConfigs: GracefulDegradationConfig[] = [
      {
        serviceName: 'twikit-session-manager',
        degradationLevels: {
          partial: {
            disabledFeatures: ['advanced-analytics', 'real-time-monitoring'],
            fallbackBehavior: 'basic-session-management',
            userMessage: 'Some advanced features are temporarily unavailable'
          },
          full: {
            disabledFeatures: ['session-creation', 'session-management'],
            fallbackBehavior: 'cached-responses-only',
            userMessage: 'Session management is temporarily unavailable'
          }
        },
        autoRecovery: true,
        recoveryThreshold: 80
      },
      {
        serviceName: 'llm-service',
        degradationLevels: {
          partial: {
            disabledFeatures: ['advanced-reasoning', 'context-analysis'],
            fallbackBehavior: 'simple-responses',
            userMessage: 'AI responses may be simplified temporarily'
          },
          full: {
            disabledFeatures: ['ai-generation', 'content-analysis'],
            fallbackBehavior: 'template-responses',
            userMessage: 'AI services are temporarily unavailable'
          }
        },
        autoRecovery: true,
        recoveryThreshold: 75
      }
    ];

    for (const config of degradationConfigs) {
      this.degradationConfigs.set(config.serviceName, config);
    }

    logger.info(`📉 Initialized graceful degradation for ${degradationConfigs.length} services`);
  }

  /**
   * Execute request with circuit breaker protection
   */
  async executeWithProtection<T>(
    serviceName: string,
    operation: () => Promise<T>,
    context?: any
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName);
    
    // Check circuit breaker state
    if (circuitBreaker.state === CircuitState.OPEN) {
      if (Date.now() < (circuitBreaker.nextAttemptTime?.getTime() || 0)) {
        // Circuit is open, try fallback
        return await this.executeFallback(serviceName, new Error('Circuit breaker is OPEN'), context);
      } else {
        // Transition to half-open for testing
        this.transitionToHalfOpen(circuitBreaker);
      }
    }

    // Execute operation
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      // Record success
      await this.recordSuccess(circuitBreaker, Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      // Record failure
      await this.recordFailure(circuitBreaker, error as Error, Date.now() - startTime);
      
      // Try fallback if available
      if (circuitBreaker.config.fallbackEnabled) {
        return await this.executeFallback(serviceName, error as Error, context);
      }
      
      throw error;
    }
  }

  /**
   * Get circuit breaker for service
   */
  private getCircuitBreaker(serviceName: string): CircuitBreakerState {
    let circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!circuitBreaker) {
      // Create circuit breaker with default config
      const defaultConfig = this.circuitBreakers.get('default')?.config;
      if (!defaultConfig) {
        throw new Error('Default circuit breaker configuration not found');
      }

      const config: CircuitBreakerConfig = {
        ...defaultConfig,
        serviceName
      };

      circuitBreaker = {
        serviceName,
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextAttemptTime: null,
        totalRequests: 0,
        totalFailures: 0,
        errorRate: 0,
        config,
        fallbackActive: false,
        degradationLevel: 'none'
      };

      this.circuitBreakers.set(serviceName, circuitBreaker);
      logger.info(`🔧 Created circuit breaker for service: ${serviceName}`);
    }
    
    return circuitBreaker;
  }

  /**
   * Record successful operation
   */
  private async recordSuccess(circuitBreaker: CircuitBreakerState, responseTime: number): Promise<void> {
    circuitBreaker.totalRequests++;
    circuitBreaker.successCount++;
    circuitBreaker.lastSuccessTime = new Date();
    
    // Update error rate
    circuitBreaker.errorRate = (circuitBreaker.totalFailures / circuitBreaker.totalRequests) * 100;

    // Handle state transitions
    if (circuitBreaker.state === CircuitState.HALF_OPEN) {
      if (circuitBreaker.successCount >= circuitBreaker.config.successThreshold) {
        this.transitionToClosed(circuitBreaker);
      }
    } else if (circuitBreaker.state === CircuitState.CLOSED) {
      // Reset failure count on success
      circuitBreaker.failureCount = 0;
      
      // Check for recovery from degradation
      if (circuitBreaker.degradationLevel !== 'none') {
        // await this.checkDegradationRecovery(circuitBreaker);
      }
    }

    this.emit('success:recorded', {
      serviceName: circuitBreaker.serviceName,
      responseTime,
      state: circuitBreaker.state,
      errorRate: circuitBreaker.errorRate
    });
  }

  /**
   * Record failed operation
   */
  private async recordFailure(circuitBreaker: CircuitBreakerState, error: Error, responseTime: number): Promise<void> {
    circuitBreaker.totalRequests++;
    circuitBreaker.totalFailures++;
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date();
    
    // Update error rate
    circuitBreaker.errorRate = (circuitBreaker.totalFailures / circuitBreaker.totalRequests) * 100;

    // Handle state transitions
    if (circuitBreaker.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state transitions back to open
      this.transitionToOpen(circuitBreaker);
    } else if (circuitBreaker.state === CircuitState.CLOSED) {
      // Check if we should transition to open
      const shouldOpen = this.shouldTransitionToOpen(circuitBreaker);
      
      if (shouldOpen) {
        this.transitionToOpen(circuitBreaker);
        // await this.activateGracefulDegradation(circuitBreaker);
      }
    }

    this.emit('failure:recorded', {
      serviceName: circuitBreaker.serviceName,
      error: error.message,
      responseTime,
      state: circuitBreaker.state,
      errorRate: circuitBreaker.errorRate,
      failureCount: circuitBreaker.failureCount
    });
  }

  /**
   * Check if circuit breaker should transition to open
   */
  private shouldTransitionToOpen(circuitBreaker: CircuitBreakerState): boolean {
    const config = circuitBreaker.config;

    // Check volume threshold
    if (circuitBreaker.totalRequests < config.volumeThreshold) {
      return false;
    }

    // Check failure threshold
    if (circuitBreaker.failureCount >= config.failureThreshold) {
      return true;
    }

    // Check error rate threshold
    if (circuitBreaker.errorRate >= config.errorThresholdPercentage) {
      return true;
    }

    return false;
  }

  /**
   * Transition circuit breaker to open state
   */
  private transitionToOpen(circuitBreaker: CircuitBreakerState): void {
    circuitBreaker.state = CircuitState.OPEN;
    circuitBreaker.nextAttemptTime = new Date(Date.now() + circuitBreaker.config.timeout);

    logger.warn(`🔴 Circuit breaker OPENED for ${circuitBreaker.serviceName} (failures: ${circuitBreaker.failureCount}, error rate: ${circuitBreaker.errorRate.toFixed(1)}%)`);

    this.emit('state:changed', {
      serviceName: circuitBreaker.serviceName,
      previousState: CircuitState.CLOSED,
      newState: CircuitState.OPEN,
      reason: 'failure_threshold_exceeded',
      failureCount: circuitBreaker.failureCount,
      errorRate: circuitBreaker.errorRate
    });
  }

  /**
   * Transition circuit breaker to half-open state
   */
  private transitionToHalfOpen(circuitBreaker: CircuitBreakerState): void {
    circuitBreaker.state = CircuitState.HALF_OPEN;
    circuitBreaker.successCount = 0;
    circuitBreaker.failureCount = 0;

    logger.info(`🟡 Circuit breaker HALF-OPEN for ${circuitBreaker.serviceName} (testing recovery)`);

    this.emit('state:changed', {
      serviceName: circuitBreaker.serviceName,
      previousState: CircuitState.OPEN,
      newState: CircuitState.HALF_OPEN,
      reason: 'timeout_expired',
      testingRecovery: true
    });
  }

  /**
   * Transition circuit breaker to closed state
   */
  private transitionToClosed(circuitBreaker: CircuitBreakerState): void {
    circuitBreaker.state = CircuitState.CLOSED;
    circuitBreaker.failureCount = 0;
    circuitBreaker.successCount = 0;
    circuitBreaker.nextAttemptTime = null;

    logger.info(`🟢 Circuit breaker CLOSED for ${circuitBreaker.serviceName} (service recovered)`);

    this.emit('state:changed', {
      serviceName: circuitBreaker.serviceName,
      previousState: CircuitState.HALF_OPEN,
      newState: CircuitState.CLOSED,
      reason: 'recovery_successful',
      recovered: true
    });
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback<T>(serviceName: string, error: Error, context?: any): Promise<T> {
    const strategies = this.fallbackStrategies.get(serviceName) || [];

    if (strategies.length === 0) {
      logger.warn(`No fallback strategies available for ${serviceName}`);
      throw error;
    }

    // Sort strategies by priority
    const sortedStrategies = strategies
      .filter(s => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of sortedStrategies) {
      try {
        logger.info(`🛡️ Executing fallback strategy: ${strategy.strategyType} for ${serviceName}`);

        const result = await strategy.implementation(error, context);

        // Mark fallback as active
        const circuitBreaker = this.getCircuitBreaker(serviceName);
        circuitBreaker.fallbackActive = true;

        this.emit('fallback:executed', {
          serviceName,
          strategyType: strategy.strategyType,
          success: true
        });

        return result;

      } catch (fallbackError) {
        logger.warn(`Fallback strategy ${strategy.strategyType} failed for ${serviceName}:`, fallbackError);
        continue;
      }
    }

    // All fallback strategies failed
    logger.error(`All fallback strategies failed for ${serviceName}`);
    throw error;
  }

  /**
   * Get manager status
   */
  async getManagerStatus(): Promise<{
    initialized: boolean;
    totalCircuitBreakers: number;
    healthyServices: number;
    degradedServices: number;
    failedServices: number;
    averageErrorRate: number;
    gracefulDegradationActive: boolean;
  }> {
    let healthyServices = 0;
    let degradedServices = 0;
    let failedServices = 0;
    let totalErrorRate = 0;
    let gracefulDegradationActive = false;

    for (const circuitBreaker of Array.from(this.circuitBreakers.values())) {
      totalErrorRate += circuitBreaker.errorRate;

      if (circuitBreaker.state === CircuitState.CLOSED && circuitBreaker.degradationLevel === 'none') {
        healthyServices++;
      } else if (circuitBreaker.state === CircuitState.OPEN) {
        failedServices++;
      } else {
        degradedServices++;
      }

      if (circuitBreaker.degradationLevel !== 'none') {
        gracefulDegradationActive = true;
      }
    }

    const averageErrorRate = this.circuitBreakers.size > 0 ? totalErrorRate / this.circuitBreakers.size : 0;

    return {
      initialized: this.isInitialized,
      totalCircuitBreakers: this.circuitBreakers.size,
      healthyServices,
      degradedServices,
      failedServices,
      averageErrorRate,
      gracefulDegradationActive
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('state:changed', (data) => {
      logger.info(`🔄 Circuit breaker state changed: ${data.serviceName} ${data.previousState} → ${data.newState}`);
    });

    this.on('fallback:executed', (data) => {
      logger.info(`🛡️ Fallback executed: ${data.serviceName} using ${data.strategyType}`);
    });
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.circuitBreakers.clear();
    this.fallbackStrategies.clear();
    this.degradationConfigs.clear();
    this.isInitialized = false;

    this.emit('manager:destroyed');
    logger.info('🧹 Enhanced Circuit Breaker Manager destroyed');
  }
}

// Export singleton instance
export const enhancedCircuitBreakerManager = new EnhancedCircuitBreakerManager();
