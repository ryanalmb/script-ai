import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
  name: string;
}

interface CircuitBreakerStats {
  failures: number;
  successes: number;
  requests: number;
  state: CircuitState;
  lastFailureTime?: Date | undefined;
  lastSuccessTime?: Date | undefined;
  nextAttempt?: Date | undefined;
}

class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private requests = 0;
  private lastFailureTime: Date | undefined = undefined;
  private lastSuccessTime: Date | undefined = undefined;
  private nextAttempt: Date | undefined = undefined;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    super();
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 300000, // 5 minutes
      expectedErrors: options.expectedErrors || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
      name: options.name
    };

    // Reset stats periodically
    setInterval(() => {
      this.resetStats();
    }, this.options.monitoringPeriod);
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`Circuit breaker ${this.options.name} moved to HALF_OPEN state`);
        this.emit('stateChange', CircuitState.HALF_OPEN);
      } else {
        const error = new Error(`Circuit breaker ${this.options.name} is OPEN`);
        (error as any).code = 'CIRCUIT_BREAKER_OPEN';
        throw error;
      }
    }

    this.requests++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failures = 0;
      logger.info(`Circuit breaker ${this.options.name} moved to CLOSED state`);
      this.emit('stateChange', CircuitState.CLOSED);
    }
  }

  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = new Date();

    // Only count expected errors towards circuit breaker
    const isExpectedError = this.options.expectedErrors?.some(expectedError => 
      error.code === expectedError || 
      error.message?.includes(expectedError) ||
      error.name === expectedError
    );

    if (!isExpectedError) {
      return; // Don't trigger circuit breaker for unexpected errors
    }

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
      logger.warn(`Circuit breaker ${this.options.name} moved to OPEN state after ${this.failures} failures`);
      this.emit('stateChange', CircuitState.OPEN);
    }
  }

  private canAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  private resetStats(): void {
    if (this.state === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
      this.requests = 0;
    }
  }

  public getStats(): CircuitBreakerStats {
    return {
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt
    };
  }

  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttempt = undefined;
    logger.info(`Circuit breaker ${this.options.name} manually reset`);
    this.emit('stateChange', CircuitState.CLOSED);
  }
}

// Circuit breaker registry
class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers = new Map<string, CircuitBreaker>();

  public static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  public getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({
        name,
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 300000,
        ...options
      });

      breaker.on('stateChange', (state) => {
        logger.info(`Circuit breaker ${name} state changed to ${state}`);
      });

      this.breakers.set(name, breaker);
    }

    return this.breakers.get(name)!;
  }

  public getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  public resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();

// Middleware factory for circuit breaker
export function createCircuitBreakerMiddleware(
  name: string, 
  options?: Partial<CircuitBreakerOptions>
) {
  const breaker = circuitBreakerRegistry.getOrCreate(name, options);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await breaker.execute(async () => {
        return new Promise<void>((resolve, reject) => {
          const originalSend = res.send;
          const originalJson = res.json;
          const originalStatus = res.status;

          let statusCode = 200;

          // Override status method to capture status code
          res.status = function(code: number) {
            statusCode = code;
            return originalStatus.call(this, code);
          };

          // Override send methods to detect failures
          res.send = function(body: any) {
            if (statusCode >= 500) {
              const error = new Error(`HTTP ${statusCode}`);
              (error as any).code = 'HTTP_ERROR';
              reject(error);
            } else {
              resolve();
            }
            return originalSend.call(this, body);
          };

          res.json = function(body: any) {
            if (statusCode >= 500) {
              const error = new Error(`HTTP ${statusCode}`);
              (error as any).code = 'HTTP_ERROR';
              reject(error);
            } else {
              resolve();
            }
            return originalJson.call(this, body);
          };

          next();
        });
      });
    } catch (error: any) {
      if (error.code === 'CIRCUIT_BREAKER_OPEN') {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          code: 'CIRCUIT_BREAKER_OPEN',
          retryAfter: Math.ceil((breaker.getStats().nextAttempt?.getTime() || 0 - Date.now()) / 1000)
        });
        return;
      }
      next(error);
    }
  };
}

// Service-specific circuit breakers
export const databaseCircuitBreaker = circuitBreakerRegistry.getOrCreate('database', {
  failureThreshold: 3,
  resetTimeout: 30000,
  expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'P1001', 'P1017']
});

export const redisCircuitBreaker = circuitBreakerRegistry.getOrCreate('redis', {
  failureThreshold: 5,
  resetTimeout: 15000,
  expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']
});

export const xApiCircuitBreaker = circuitBreakerRegistry.getOrCreate('x-api', {
  failureThreshold: 10,
  resetTimeout: 120000,
  expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'RATE_LIMIT_EXCEEDED', 'API_ERROR']
});

export const llmCircuitBreaker = circuitBreakerRegistry.getOrCreate('llm-service', {
  failureThreshold: 5,
  resetTimeout: 60000,
  expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'MODEL_OVERLOADED']
});

export { CircuitBreaker };
