import { logger } from '../utils/logger';
import { connectionManager } from '../config/connectionManager';
import { redisCircuitBreaker } from '../middleware/circuitBreaker';
import { withRedisTimeout, withRedisFallback } from '../middleware/gracefulDegradation';

export class CacheManager {
  private redis: any = null;
  private defaultTTL = 3600; // 1 hour
  private isConnected = false;
  private memoryCache = new Map<string, { value: any; expires: number }>();

  constructor() {
    logger.info('Cache manager initialized with Redis fallback to in-memory');
  }

  async connect(): Promise<void> {
    // Check if Redis is disabled
    if (process.env.DISABLE_REDIS === 'true') {
      logger.warn('⚠️ Redis is disabled via DISABLE_REDIS environment variable, using in-memory cache only');
      this.isConnected = true; // Still connected, just using memory
      return;
    }

    const maxRetries = 10;
    const baseDelay = 500;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait for connection manager to be ready
        await new Promise(resolve => setTimeout(resolve, attempt * 200));

        // Try to get Redis connection from connection manager
        const redisClient = connectionManager.getRedisIfAvailable();
        if (redisClient) {
          try {
            // Test the connection with timeout
            await Promise.race([
              redisClient.ping(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Redis ping timeout')), 3000)
              )
            ]);

            this.redis = redisClient;
            this.isConnected = true;
            logger.info('Cache connected to Redis successfully via connection manager');
            return;
          } catch (pingError: any) {
            logger.warn(`Connection manager Redis ping failed: ${pingError.message}`);
          }
        } else {
          logger.warn('Connection manager Redis not ready yet');
        }

        // If connection manager Redis not ready, try direct connection
        const { createRedisClient } = await import('../config/redis');
        const directRedis = createRedisClient();

        // Wait for connection and test
        if (directRedis) {
          await Promise.race([
            directRedis.connect(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
            )
          ]);

          await directRedis.ping();
        }
        this.redis = directRedis;
        this.isConnected = true;
        logger.info('Cache connected to Redis directly');
        return;

      } catch (error: any) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 5000);
        logger.warn(`Cache Redis connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt === maxRetries) {
          logger.warn('Redis not available after all retries, using in-memory cache fallback');
          this.isConnected = true; // Still connected, just using memory
          return;
        }

        logger.info(`Retrying cache Redis connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async disconnect(): Promise<void> {
    this.memoryCache.clear();
    this.isConnected = false;
    logger.info('Cache disconnected (in-memory mode)');
  }

  // Enhanced cache methods with Redis fallback
  async get<T>(key: string): Promise<T | null> {
    return await withRedisFallback(
      async () => {
        if (this.redis) {
          return await redisCircuitBreaker.execute(async () => {
            return await withRedisTimeout(
              async () => {
                const value = await this.redis.get(key);
                return value ? JSON.parse(value) : null;
              },
              5000,
              `cache:get:${key}`
            );
          });
        }
        throw new Error('Redis not available');
      },
      `cache:get:${key}`,
      this.getFromMemoryCache(key)
    );
  }

  private getFromMemoryCache<T>(key: string): T | null {
    try {
      const cached = this.memoryCache.get(key);
      if (!cached) return null;

      if (Date.now() > cached.expires) {
        this.memoryCache.delete(key);
        return null;
      }

      return cached.value;
    } catch (error) {
      logger.error('Memory cache get error:', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      const expires = Date.now() + (ttl * 1000);
      this.memoryCache.set(key, { value, expires });
    } catch (error) {
      logger.error('Cache set error:', { key, ttl, error });
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // In-memory implementation
      this.memoryCache.delete(key);
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // In-memory implementation
      return this.memoryCache.has(key);
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  // User session caching
  async cacheUserSession(userId: string, sessionData: any): Promise<void> {
    const key = `session:${userId}`;
    await this.set(key, sessionData, 86400); // 24 hours
  }

  async getUserSession(userId: string): Promise<any> {
    const key = `session:${userId}`;
    return await this.get(key);
  }

  async invalidateUserSession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await this.del(key);
  }

  // Analytics caching
  async cacheAnalytics(accountId: string, period: string, data: any): Promise<void> {
    const key = `analytics:${accountId}:${period}`;
    await this.set(key, data, 1800); // 30 minutes
  }

  async getAnalytics(accountId: string, period: string): Promise<any> {
    const key = `analytics:${accountId}:${period}`;
    return await this.get(key);
  }

  // Content template caching
  async cacheContentTemplates(category: string, templates: any[]): Promise<void> {
    const key = `templates:${category}`;
    await this.set(key, templates, 7200); // 2 hours
  }

  async getContentTemplates(category: string): Promise<any[]> {
    const key = `templates:${category}`;
    return await this.get(key) || [];
  }

  // Trending hashtags caching
  async cacheTrendingHashtags(hashtags: any[]): Promise<void> {
    const key = 'trending:hashtags';
    await this.set(key, hashtags, 900); // 15 minutes
  }

  async getTrendingHashtags(): Promise<any[]> {
    const key = 'trending:hashtags';
    return await this.get(key) || [];
  }

  // Rate limiting cache
  async incrementRateLimit(key: string, windowMs: number): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(windowMs / 1000));
      }
      return current;
    } catch (error) {
      logger.error('Rate limit increment error:', { key, error });
      return 0;
    }
  }

  // Cache warming strategies
  async warmCache(): Promise<void> {
    logger.info('Starting cache warming...');
    
    try {
      // Warm content templates
      const categories = ['crypto', 'finance', 'general', 'news'];
      for (const category of categories) {
        // This would typically fetch from database
        // await this.cacheContentTemplates(category, templates);
      }

      // Warm trending hashtags
      // await this.cacheTrendingHashtags(trendingData);

      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed:', error);
    }
  }

  // Cache invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // In-memory implementation - simple pattern matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const keysToDelete = Array.from(this.memoryCache.keys()).filter(key => regex.test(key));
      keysToDelete.forEach(key => this.memoryCache.delete(key));
    } catch (error) {
      logger.error('Pattern invalidation error:', { pattern, error });
    }
  }

  // Bulk operations
  async mget(keys: string[]): Promise<(any | null)[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // In-memory implementation
      return keys.map(key => {
        const cached = this.memoryCache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expires) {
          this.memoryCache.delete(key);
          return null;
        }

        return cached.value;
      });
    } catch (error) {
      logger.error('Bulk get error:', { keys, error });
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Array<{key: string, value: any, ttl?: number}>): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // In-memory implementation
      keyValuePairs.forEach(({key, value, ttl = this.defaultTTL}) => {
        const expires = Date.now() + (ttl * 1000);
        this.memoryCache.set(key, { value, expires });
      });
    } catch (error) {
      logger.error('Bulk set error:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // In-memory implementation - always healthy
      return true;
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Get the Redis client instance for advanced operations
   */
  getRedisClient(): any {
    return this.redis;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Cache middleware for Express
export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: any, res: any, next: any) => {
    const key = `cache:${req.method}:${req.originalUrl}`;
    
    try {
      const cached = await cacheManager.get(key);
      if (cached) {
        return res.json(cached);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data: any) {
        cacheManager.set(key, data, ttl);
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};


