// Comprehensive Caching Strategy Implementation
import Redis from 'redis';
import { logger } from '../utils/logger';

export class CacheManager {
  private redis: Redis.RedisClientType;
  private defaultTTL = 3600; // 1 hour

  constructor() {
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused');
          return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    this.redis.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.redis.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
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
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(windowMs / 1000));
      }
      return current;
    } catch (error) {
      logger.error('Rate limit increment error:', error);
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
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      logger.error('Pattern invalidation error:', error);
    }
  }

  // Bulk operations
  async mget(keys: string[]): Promise<(any | null)[]> {
    try {
      const values = await this.redis.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Bulk get error:', error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Array<{key: string, value: any, ttl?: number}>): Promise<void> {
    try {
      const pipeline = this.redis.multi();
      
      keyValuePairs.forEach(({key, value, ttl = this.defaultTTL}) => {
        pipeline.setEx(key, ttl, JSON.stringify(value));
      });
      
      await pipeline.exec();
    } catch (error) {
      logger.error('Bulk set error:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
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
