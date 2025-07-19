import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

// Redis client instance
let redisClient: any | null = null;

// Enhanced Redis configuration for production
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
  enableAutoPipelining: true,
  enableReadyCheck: true,
  family: 4
};

// Create Redis client
export const createRedisClient = (): any => {
  const client = createClient(redisConfig);

  // Event listeners
  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (error) => {
    logger.error('Redis client error:', error);
  });

  client.on('end', () => {
    logger.info('Redis client connection ended');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });

  return client;
};

// Initialize Redis connection
export const connectRedis = async (): Promise<void> => {
  try {
    if (!redisClient) {
      redisClient = createRedisClient();
    }

    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    // Test connection
    await redisClient.ping();
    logger.info('Redis connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

// Get Redis client (safe version that doesn't throw)
export const getRedisClient = (): any => {
  return redisClient; // Return null if not initialized
};

// Get Redis client (throws if not initialized - for backward compatibility)
export const getRedisClientStrict = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

// Close Redis connection
export const closeRedisConnection = async (): Promise<void> => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
    throw error;
  }
};

// Cache helper functions
export class CacheService {
  private client: any | null = null;
  private memoryCache = new Map<string, { value: any; expires: number }>();

  constructor() {
    // Lazy initialization - don't initialize in constructor
    this.client = null;
  }

  private async ensureConnection(): Promise<void> {
    if (!this.client && redisClient) {
      this.client = redisClient;
    }
  }

  // Set cache with TTL
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.ensureConnection();
      if (this.client) {
        const serializedValue = JSON.stringify(value);
        await this.client.setEx(key, ttlSeconds, serializedValue);
        logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
      } else {
        // Fallback to memory cache
        const expires = Date.now() + (ttlSeconds * 1000);
        this.memoryCache.set(key, { value, expires });
        logger.debug(`Memory cache set: ${key} (TTL: ${ttlSeconds}s)`);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      // Fallback to memory cache on Redis error
      const expires = Date.now() + (ttlSeconds * 1000);
      this.memoryCache.set(key, { value, expires });
      logger.debug(`Fallback to memory cache for key: ${key}`);
    }
  }

  // Get cache
  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnection();
      if (this.client) {
        const value = await this.client.get(key);
        if (value === null) {
          logger.debug(`Cache miss: ${key}`);
          return null;
        }
        logger.debug(`Cache hit: ${key}`);
        return JSON.parse(value) as T;
      } else {
        // Fallback to memory cache
        const cached = this.memoryCache.get(key);
        if (!cached) {
          logger.debug(`Memory cache miss: ${key}`);
          return null;
        }

        if (Date.now() > cached.expires) {
          this.memoryCache.delete(key);
          logger.debug(`Memory cache expired: ${key}`);
          return null;
        }

        logger.debug(`Memory cache hit: ${key}`);
        return cached.value as T;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      // Fallback to memory cache on Redis error
      const cached = this.memoryCache.get(key);
      if (cached && Date.now() <= cached.expires) {
        return cached.value as T;
      }
      return null;
    }
  }

  // Delete cache
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      throw error;
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists check error for key ${key}:`, error);
      return false;
    }
  }

  // Set TTL for existing key
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.expire(key, ttlSeconds);
      logger.debug(`Cache TTL set: ${key} (${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      throw error;
    }
  }

  // Get multiple keys
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      return values.map((value: any) => value ? JSON.parse(value) as T : null);
    } catch (error) {
      logger.error(`Cache mget error for keys ${keys.join(', ')}:`, error);
      return keys.map(() => null);
    }
  }

  // Set multiple keys
  async mset(keyValuePairs: Record<string, any>, ttlSeconds: number = 3600): Promise<void> {
    try {
      const pipeline = this.client.multi();
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        pipeline.setEx(key, ttlSeconds, serializedValue);
      }
      
      await pipeline.exec();
      logger.debug(`Cache mset: ${Object.keys(keyValuePairs).join(', ')} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache mset error:`, error);
      throw error;
    }
  }

  // Increment counter
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      const result = await this.client.incrBy(key, by);
      logger.debug(`Cache increment: ${key} by ${by} = ${result}`);
      return result;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      throw error;
    }
  }

  // Add to set
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      const result = await this.client.sAdd(key, members);
      logger.debug(`Cache sadd: ${key} added ${members.length} members`);
      return result;
    } catch (error) {
      logger.error(`Cache sadd error for key ${key}:`, error);
      throw error;
    }
  }

  // Get set members
  async smembers(key: string): Promise<string[]> {
    try {
      const result = await this.client.sMembers(key);
      logger.debug(`Cache smembers: ${key} has ${result.length} members`);
      return result;
    } catch (error) {
      logger.error(`Cache smembers error for key ${key}:`, error);
      return [];
    }
  }

  // Remove from set
  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      const result = await this.client.sRem(key, members);
      logger.debug(`Cache srem: ${key} removed ${members.length} members`);
      return result;
    } catch (error) {
      logger.error(`Cache srem error for key ${key}:`, error);
      throw error;
    }
  }

  // Clear all cache (use with caution)
  async flushAll(): Promise<void> {
    try {
      await this.client.flushAll();
      logger.warn('Cache flushed all keys');
    } catch (error) {
      logger.error('Cache flush all error:', error);
      throw error;
    }
  }
}

// Rate limiting helper
export class RateLimiter {
  private client: RedisClientType;

  constructor() {
    this.client = getRedisClient();
  }

  // Check and increment rate limit
  async checkLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const pipeline = this.client.multi();
      const now = Date.now();
      const windowStart = now - (windowSeconds * 1000);

      // Remove old entries
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // Count current entries
      pipeline.zCard(key);
      
      // Add current request
      pipeline.zAdd(key, { score: now, value: now.toString() });
      
      // Set expiry
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      const currentCount = (results?.[1] as number) || 0;
      
      const allowed = currentCount < limit;
      const remaining = Math.max(0, limit - currentCount - 1);
      const resetTime = now + (windowSeconds * 1000);

      return { allowed, remaining, resetTime };
    } catch (error) {
      logger.error(`Rate limit check error for key ${key}:`, error);
      // Allow request on error to prevent blocking
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + (windowSeconds * 1000) };
    }
  }
}

export default redisClient;
