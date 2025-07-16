import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { connectionManager } from '../config/connectionManager';
import { circuitBreakerRegistry } from './circuitBreaker';

interface DegradationConfig {
  enableFallbacks: boolean;
  cacheTimeout: number;
  maxRetries: number;
  fallbackResponses: Record<string, any>;
}

interface ServiceStatus {
  database: boolean;
  redis: boolean;
  xApi: boolean;
  llmService: boolean;
}

class GracefulDegradationManager {
  private static instance: GracefulDegradationManager;
  private config: DegradationConfig;
  private fallbackCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private serviceStatus: ServiceStatus = {
    database: true,
    redis: true,
    xApi: true,
    llmService: true
  };

  private constructor() {
    this.config = {
      enableFallbacks: process.env.ENABLE_FALLBACKS !== 'false',
      cacheTimeout: parseInt(process.env.FALLBACK_CACHE_TIMEOUT || '300000'), // 5 minutes
      maxRetries: parseInt(process.env.MAX_FALLBACK_RETRIES || '3'),
      fallbackResponses: this.initializeFallbackResponses()
    };

    this.monitorServices();
  }

  public static getInstance(): GracefulDegradationManager {
    if (!GracefulDegradationManager.instance) {
      GracefulDegradationManager.instance = new GracefulDegradationManager();
    }
    return GracefulDegradationManager.instance;
  }

  private initializeFallbackResponses(): Record<string, any> {
    return {
      '/api/campaigns': {
        success: true,
        campaigns: [],
        message: 'Service temporarily unavailable - showing cached data',
        degraded: true
      },
      '/api/accounts': {
        success: true,
        accounts: [],
        message: 'Service temporarily unavailable - showing cached data',
        degraded: true
      },
      '/api/analytics': {
        success: true,
        analytics: {
          totalPosts: 0,
          totalLikes: 0,
          totalFollowers: 0,
          engagementRate: 0
        },
        message: 'Analytics service temporarily unavailable',
        degraded: true
      },
      '/api/content/generate': {
        success: false,
        error: 'Content generation service temporarily unavailable',
        fallback: 'Please try again later or create content manually',
        degraded: true
      }
    };
  }

  private monitorServices(): void {
    // Monitor connection manager events
    connectionManager.on('database:error', () => {
      this.serviceStatus.database = false;
      logger.warn('Database service marked as degraded');
    });

    connectionManager.on('database:connected', () => {
      this.serviceStatus.database = true;
      logger.info('Database service restored');
    });

    connectionManager.on('redis:error', () => {
      this.serviceStatus.redis = false;
      logger.warn('Redis service marked as degraded');
    });

    connectionManager.on('redis:connected', () => {
      this.serviceStatus.redis = true;
      logger.info('Redis service restored');
    });

    // Monitor circuit breakers
    const xApiBreaker = circuitBreakerRegistry.getOrCreate('x-api');
    const llmBreaker = circuitBreakerRegistry.getOrCreate('llm-service');

    xApiBreaker.on('stateChange', (state) => {
      this.serviceStatus.xApi = state === 'CLOSED';
      logger.info(`X API service status: ${state}`);
    });

    llmBreaker.on('stateChange', (state) => {
      this.serviceStatus.llmService = state === 'CLOSED';
      logger.info(`LLM service status: ${state}`);
    });
  }

  public async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackKey: string,
    options: {
      cacheTtl?: number;
      useCache?: boolean;
      fallbackData?: any;
    } = {}
  ): Promise<T> {
    const { cacheTtl = this.config.cacheTimeout, useCache = true, fallbackData } = options;

    try {
      // Try primary operation
      const result = await operation();
      
      // Cache successful result if caching is enabled
      if (useCache && this.serviceStatus.redis) {
        this.setCachedData(fallbackKey, result, cacheTtl);
      }
      
      return result;
    } catch (error) {
      logger.warn(`Primary operation failed for ${fallbackKey}, attempting fallback:`, error);
      
      if (!this.config.enableFallbacks) {
        throw error;
      }

      // Try to get cached data
      if (useCache) {
        const cachedData = this.getCachedData(fallbackKey);
        if (cachedData) {
          logger.info(`Returning cached data for ${fallbackKey}`);
          return { ...cachedData, degraded: true } as T;
        }
      }

      // Use provided fallback data
      if (fallbackData) {
        logger.info(`Using provided fallback data for ${fallbackKey}`);
        return { ...fallbackData, degraded: true } as T;
      }

      // Use configured fallback response
      const configuredFallback = this.config.fallbackResponses[fallbackKey];
      if (configuredFallback) {
        logger.info(`Using configured fallback for ${fallbackKey}`);
        return configuredFallback as T;
      }

      // If no fallback available, throw original error
      throw error;
    }
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    try {
      this.fallbackCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });
    } catch (error) {
      logger.error('Failed to cache fallback data:', error);
    }
  }

  private getCachedData(key: string): any | null {
    try {
      const cached = this.fallbackCache.get(key);
      if (!cached) return null;

      const isExpired = Date.now() - cached.timestamp > cached.ttl;
      if (isExpired) {
        this.fallbackCache.delete(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      logger.error('Failed to retrieve cached data:', error);
      return null;
    }
  }

  public getServiceStatus(): ServiceStatus {
    return { ...this.serviceStatus };
  }

  public isServiceHealthy(service: keyof ServiceStatus): boolean {
    return this.serviceStatus[service];
  }

  public getDegradationLevel(): 'healthy' | 'degraded' | 'critical' {
    const healthyServices = Object.values(this.serviceStatus).filter(Boolean).length;
    const totalServices = Object.keys(this.serviceStatus).length;
    const healthPercentage = healthyServices / totalServices;

    if (healthPercentage >= 0.8) return 'healthy';
    if (healthPercentage >= 0.5) return 'degraded';
    return 'critical';
  }

  public clearCache(): void {
    this.fallbackCache.clear();
    logger.info('Fallback cache cleared');
  }
}

export const gracefulDegradationManager = GracefulDegradationManager.getInstance();

// Middleware for automatic fallback handling
export function createDegradationMiddleware(fallbackKey?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = fallbackKey || req.path;
    
    // Add degradation utilities to request
    (req as any).degradation = {
      executeWithFallback: (operation: () => Promise<any>, options?: any) =>
        gracefulDegradationManager.executeWithFallback(operation, key, options),
      
      getServiceStatus: () => gracefulDegradationManager.getServiceStatus(),
      
      isServiceHealthy: (service: keyof ServiceStatus) =>
        gracefulDegradationManager.isServiceHealthy(service),
      
      getDegradationLevel: () => gracefulDegradationManager.getDegradationLevel()
    };

    // Add degradation headers to response
    const degradationLevel = gracefulDegradationManager.getDegradationLevel();
    if (degradationLevel !== 'healthy') {
      res.setHeader('X-Service-Degradation', degradationLevel);
      res.setHeader('X-Service-Status', JSON.stringify(gracefulDegradationManager.getServiceStatus()));
    }

    next();
  };
}

// Database operation with fallback
export async function withDatabaseFallback<T>(
  operation: () => Promise<T>,
  fallbackKey: string,
  fallbackData?: T
): Promise<T> {
  return gracefulDegradationManager.executeWithFallback(
    operation,
    `db:${fallbackKey}`,
    { fallbackData, useCache: false } // Don't cache DB operations
  );
}

// Redis operation with fallback
export async function withRedisFallback<T>(
  operation: () => Promise<T>,
  fallbackKey: string,
  fallbackData?: T
): Promise<T> {
  return gracefulDegradationManager.executeWithFallback(
    operation,
    `redis:${fallbackKey}`,
    { fallbackData, useCache: false }
  );
}

// Redis timeout wrapper
export async function withRedisTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 5000,
  operationName: string = 'redis operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(`Redis timeout: ${operationName} exceeded ${timeoutMs}ms`);
      (error as any).code = 'REDIS_TIMEOUT';
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

// X API operation with fallback
export async function withXApiFallback<T>(
  operation: () => Promise<T>,
  fallbackKey: string,
  fallbackData?: T
): Promise<T> {
  return gracefulDegradationManager.executeWithFallback(
    operation,
    `xapi:${fallbackKey}`,
    { fallbackData, cacheTtl: 60000 } // Cache for 1 minute
  );
}

// LLM operation with fallback
export async function withLLMFallback<T>(
  operation: () => Promise<T>,
  fallbackKey: string,
  fallbackData?: T
): Promise<T> {
  return gracefulDegradationManager.executeWithFallback(
    operation,
    `llm:${fallbackKey}`,
    { fallbackData, cacheTtl: 300000 } // Cache for 5 minutes
  );
}

// Utility to check if request should use degraded mode
export function shouldUseDegradedMode(req: Request): boolean {
  const degradationLevel = gracefulDegradationManager.getDegradationLevel();
  return degradationLevel !== 'healthy';
}

// Utility to add degradation info to response
export function addDegradationInfo(res: Response, data: any): any {
  const degradationLevel = gracefulDegradationManager.getDegradationLevel();
  
  if (degradationLevel !== 'healthy') {
    return {
      ...data,
      degraded: true,
      degradationLevel,
      serviceStatus: gracefulDegradationManager.getServiceStatus(),
      message: data.message || 'Service operating in degraded mode'
    };
  }
  
  return data;
}
