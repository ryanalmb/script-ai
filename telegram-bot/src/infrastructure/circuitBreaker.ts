/**
 * Enterprise Circuit Breaker Implementation
 * Provides resilience patterns to prevent cascade failures
 */

import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedErrors: string[];
  name: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  nextAttempt: number;
  lastFailureTime?: number | undefined;
  lastSuccessTime?: number | undefined;
}

export class EnterpriseCircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private requests: number = 0;
  private nextAttempt: number = 0;
  private lastFailureTime?: number | undefined;
  private lastSuccessTime?: number | undefined;
  private config: CircuitBreakerConfig;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    
    this.config = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
      name: 'default',
      ...config
    };

    this.startMonitoring();
    
    logger.info('Circuit breaker initialized', {
      name: this.config.name,
      config: this.config
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        logger.debug('Circuit breaker is OPEN, rejecting request', {
          name: this.config.name,
          nextAttempt: new Date(this.nextAttempt).toISOString()
        });
        
        if (fallback) {
          logger.debug('Executing fallback function', { name: this.config.name });
          return await fallback();
        }
        
        throw new Error(`Circuit breaker is OPEN for ${this.config.name}`);
      } else {
        // Transition to HALF_OPEN
        this.state = CircuitState.HALF_OPEN;
        this.emit('stateChange', { 
          name: this.config.name, 
          state: this.state,
          previousState: CircuitState.OPEN
        });
        
        logger.info('Circuit breaker transitioned to HALF_OPEN', {
          name: this.config.name
        });
      }
    }

    this.requests++;
    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Circuit breaker timeout')), this.config.timeout)
        )
      ]);

      this.onSuccess();
      
      const duration = Date.now() - startTime;
      logger.debug('Circuit breaker request succeeded', {
        name: this.config.name,
        duration,
        state: this.state
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(error as Error);
      
      logger.warn('Circuit breaker request failed', {
        name: this.config.name,
        error: (error as Error).message,
        duration,
        state: this.state,
        failures: this.failures
      });

      // Try fallback if available
      if (fallback) {
        logger.debug('Executing fallback function after failure', {
          name: this.config.name,
          state: this.state
        });
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      nextAttempt: this.nextAttempt,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    const previousState = this.state;
    
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;

    this.emit('reset', { 
      name: this.config.name,
      previousState
    });

    logger.info('Circuit breaker reset', {
      name: this.config.name,
      previousState
    });
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen(): void {
    const previousState = this.state;
    
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.resetTimeout;

    this.emit('stateChange', {
      name: this.config.name,
      state: this.state,
      previousState,
      forced: true
    });

    logger.warn('Circuit breaker forced to OPEN state', {
      name: this.config.name,
      previousState
    });
  }

  /**
   * Force circuit breaker to CLOSED state
   */
  forceClosed(): void {
    const previousState = this.state;
    
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.nextAttempt = 0;

    this.emit('stateChange', {
      name: this.config.name,
      state: this.state,
      previousState,
      forced: true
    });

    logger.info('Circuit breaker forced to CLOSED state', {
      name: this.config.name,
      previousState
    });
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED || 
           (this.state === CircuitState.HALF_OPEN && this.successes > 0);
  }

  /**
   * Get failure rate
   */
  getFailureRate(): number {
    if (this.requests === 0) return 0;
    return this.failures / this.requests;
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.requests === 0) return 0;
    return this.successes / this.requests;
  }

  /**
   * Shutdown circuit breaker
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.removeAllListeners();
    
    logger.info('Circuit breaker shutdown', {
      name: this.config.name
    });
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        // Transition to CLOSED
        const previousState = this.state;
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.nextAttempt = 0;

        this.emit('stateChange', {
          name: this.config.name,
          state: this.state,
          previousState
        });

        logger.info('Circuit breaker transitioned to CLOSED', {
          name: this.config.name,
          successes: this.successes
        });
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    // Check if this is an expected error that should trigger the circuit breaker
    const isExpectedError = this.config.expectedErrors.some(expectedError => 
      error.message.includes(expectedError) || error.name.includes(expectedError)
    );

    if (!isExpectedError && !error.message.includes('timeout')) {
      // Don't count unexpected errors towards circuit breaker
      logger.debug('Ignoring unexpected error for circuit breaker', {
        name: this.config.name,
        error: error.message
      });
      return;
    }

    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Transition back to OPEN
      const previousState = this.state;
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.resetTimeout;

      this.emit('stateChange', {
        name: this.config.name,
        state: this.state,
        previousState
      });

      logger.warn('Circuit breaker transitioned back to OPEN from HALF_OPEN', {
        name: this.config.name,
        error: error.message
      });

    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures >= this.config.failureThreshold) {
        // Transition to OPEN
        const previousState = this.state;
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.config.resetTimeout;

        this.emit('stateChange', {
          name: this.config.name,
          state: this.state,
          previousState
        });

        logger.warn('Circuit breaker transitioned to OPEN', {
          name: this.config.name,
          failures: this.failures,
          threshold: this.config.failureThreshold
        });
      }
    }
  }

  /**
   * Start monitoring and periodic cleanup
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      // Reset counters periodically to prevent stale data
      const now = Date.now();
      const monitoringPeriod = this.config.monitoringPeriod;

      // Reset counters if no recent activity
      if (this.lastSuccessTime && (now - this.lastSuccessTime) > monitoringPeriod * 2) {
        this.successes = Math.max(0, this.successes - 1);
      }

      if (this.lastFailureTime && (now - this.lastFailureTime) > monitoringPeriod * 2) {
        this.failures = Math.max(0, this.failures - 1);
      }

      // Emit metrics
      this.emit('metrics', {
        name: this.config.name,
        stats: this.getStats(),
        failureRate: this.getFailureRate(),
        successRate: this.getSuccessRate()
      });

    }, this.config.monitoringPeriod);
  }
}

/**
 * Circuit Breaker Manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, EnterpriseCircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): EnterpriseCircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new EnterpriseCircuitBreaker({
        ...config,
        name
      });
      
      this.circuitBreakers.set(name, circuitBreaker);
      
      // Forward events
      circuitBreaker.on('stateChange', (event) => {
        logger.info('Circuit breaker state changed', event);
      });
      
      circuitBreaker.on('reset', (event) => {
        logger.info('Circuit breaker reset', event);
      });
    }

    return this.circuitBreakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  /**
   * Shutdown all circuit breakers
   */
  shutdown(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.shutdown();
    }
    
    this.circuitBreakers.clear();
  }
}

// Singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();
