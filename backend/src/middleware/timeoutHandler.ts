import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface TimeoutOptions {
  timeout: number;
  message?: string;
  code?: string;
}

interface TimeoutRequest extends Request {
  timedOut?: boolean;
  startTime?: number;
}

// Global timeout middleware
export function createTimeoutMiddleware(options: TimeoutOptions) {
  const { timeout, message = 'Request timeout', code = 'REQUEST_TIMEOUT' } = options;

  return (req: TimeoutRequest, res: Response, next: NextFunction): void => {
    req.startTime = Date.now();
    req.timedOut = false;

    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        req.timedOut = true;
        logger.warn(`Request timeout after ${timeout}ms: ${req.method} ${req.path}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          duration: timeout
        });

        res.status(408).json({
          error: message,
          code,
          timeout: timeout,
          path: req.path,
          method: req.method
        });
      }
    }, timeout);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeoutId);
      
      if (req.startTime && !req.timedOut) {
        const duration = Date.now() - req.startTime;
        if (duration > timeout * 0.8) { // Log slow requests (80% of timeout)
          logger.warn(`Slow request detected: ${req.method} ${req.path}`, {
            duration,
            threshold: timeout * 0.8,
            ip: req.ip
          });
        }
      }
    });

    res.on('close', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
}

// Database operation timeout wrapper
export async function withDatabaseTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 30000,
  operationName: string = 'database operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`Database timeout: ${operationName} exceeded ${timeoutMs}ms`);
      (error as any).code = 'DATABASE_TIMEOUT';
      (error as any).timeout = timeoutMs;
      (error as any).operation = operationName;
      logger.error('Database operation timeout:', { operationName, timeoutMs });
      reject(error);
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// Redis operation timeout wrapper
export async function withRedisTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 5000,
  operationName: string = 'redis operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`Redis timeout: ${operationName} exceeded ${timeoutMs}ms`);
      (error as any).code = 'REDIS_TIMEOUT';
      (error as any).timeout = timeoutMs;
      (error as any).operation = operationName;
      logger.error('Redis operation timeout:', { operationName, timeoutMs });
      reject(error);
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// HTTP request timeout wrapper
export async function withHttpTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  operationName: string = 'http request'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`HTTP timeout: ${operationName} exceeded ${timeoutMs}ms`);
      (error as any).code = 'HTTP_TIMEOUT';
      (error as any).timeout = timeoutMs;
      (error as any).operation = operationName;
      logger.error('HTTP operation timeout:', { operationName, timeoutMs });
      reject(error);
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// LLM service timeout wrapper
export async function withLLMTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 60000,
  operationName: string = 'llm operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`LLM timeout: ${operationName} exceeded ${timeoutMs}ms`);
      (error as any).code = 'LLM_TIMEOUT';
      (error as any).timeout = timeoutMs;
      (error as any).operation = operationName;
      logger.error('LLM operation timeout:', { operationName, timeoutMs });
      reject(error);
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// Generic timeout wrapper with retry
export async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  options: {
    timeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
    operationName: string;
    shouldRetry?: (error: any) => boolean;
  }
): Promise<T> {
  const { timeoutMs, maxRetries, retryDelayMs, operationName, shouldRetry } = options;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      if (attempt === 1) {
        return await withHttpTimeout(operation, timeoutMs, operationName);
      } else {
        logger.info(`Retrying ${operationName} (attempt ${attempt}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt - 1)));
        return await withHttpTimeout(operation, timeoutMs, operationName);
      }
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries + 1) {
        logger.error(`${operationName} failed after ${maxRetries + 1} attempts:`, error);
        break;
      }
      
      if (shouldRetry && !shouldRetry(error)) {
        logger.error(`${operationName} failed with non-retryable error:`, error);
        break;
      }
      
      logger.warn(`${operationName} attempt ${attempt} failed, retrying...`, {
        error: error instanceof Error ? error.message : String(error),
        nextRetryIn: retryDelayMs * attempt
      });
    }
  }
  
  throw lastError;
}

// Timeout configurations for different operations
export const TIMEOUT_CONFIGS = {
  API_REQUEST: 30000,      // 30 seconds for API requests
  DATABASE_QUERY: 30000,   // 30 seconds for database queries
  REDIS_OPERATION: 5000,   // 5 seconds for Redis operations
  HTTP_REQUEST: 10000,     // 10 seconds for HTTP requests
  LLM_REQUEST: 60000,      // 60 seconds for LLM requests
  FILE_UPLOAD: 120000,     // 2 minutes for file uploads
  BULK_OPERATION: 300000   // 5 minutes for bulk operations
};

// Default timeout middleware for all routes
export const defaultTimeoutMiddleware = createTimeoutMiddleware({
  timeout: TIMEOUT_CONFIGS.API_REQUEST,
  message: 'Request timeout - please try again',
  code: 'REQUEST_TIMEOUT'
});

// Specific timeout middleware for different route types
export const databaseTimeoutMiddleware = createTimeoutMiddleware({
  timeout: TIMEOUT_CONFIGS.DATABASE_QUERY,
  message: 'Database operation timeout',
  code: 'DATABASE_TIMEOUT'
});

export const uploadTimeoutMiddleware = createTimeoutMiddleware({
  timeout: TIMEOUT_CONFIGS.FILE_UPLOAD,
  message: 'File upload timeout',
  code: 'UPLOAD_TIMEOUT'
});

export const bulkTimeoutMiddleware = createTimeoutMiddleware({
  timeout: TIMEOUT_CONFIGS.BULK_OPERATION,
  message: 'Bulk operation timeout',
  code: 'BULK_TIMEOUT'
});

// Timeout monitoring
class TimeoutMonitor {
  private static instance: TimeoutMonitor;
  private timeoutStats = new Map<string, {
    count: number;
    lastOccurrence: Date;
    averageDuration: number;
  }>();

  public static getInstance(): TimeoutMonitor {
    if (!TimeoutMonitor.instance) {
      TimeoutMonitor.instance = new TimeoutMonitor();
    }
    return TimeoutMonitor.instance;
  }

  public recordTimeout(operation: string, duration: number): void {
    const stats = this.timeoutStats.get(operation) || {
      count: 0,
      lastOccurrence: new Date(),
      averageDuration: 0
    };

    stats.count++;
    stats.lastOccurrence = new Date();
    stats.averageDuration = (stats.averageDuration * (stats.count - 1) + duration) / stats.count;

    this.timeoutStats.set(operation, stats);

    // Log if timeout frequency is high
    if (stats.count > 10 && stats.count % 10 === 0) {
      logger.warn(`High timeout frequency detected for ${operation}:`, {
        count: stats.count,
        averageDuration: stats.averageDuration,
        lastOccurrence: stats.lastOccurrence
      });
    }
  }

  public getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [operation, data] of this.timeoutStats) {
      stats[operation] = { ...data };
    }
    return stats;
  }

  public reset(): void {
    this.timeoutStats.clear();
  }
}

export const timeoutMonitor = TimeoutMonitor.getInstance();
