// import Redis from 'redis';
import { logger } from '../utils/logger';

export class CacheManager {
  private redis: any = null;
  private defaultTTL = 3600; // 1 hour
  private isConnected = false;
  private memoryCache = new Map<string, { value: any; expires: number }>();

  constructor() {
    // Redis disabled for testing - using in-memory cache
    this.isConnected = true;
    logger.info('Cache manager initialized (in-memory mode)');
  }

  async connect(): Promise<void> {
    // Already connected in memory mode
    this.isConnected = true;
    logger.info('Cache connected (in-memory mode)');
  }

  async disconnect(): Promise<void> {
    this.memoryCache.clear();
    this.isConnected = false;
    logger.info('Cache disconnected (in-memory mode)');
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = this.memoryCache.get(key);
      if (!cached) return null;

      if (Date.now() > cached.expires) {
        this.memoryCache.delete(key);
        return null;
      }

      return cached.value;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
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
