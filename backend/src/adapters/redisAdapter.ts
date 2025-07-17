/**
 * Redis Adapter - 2025 Edition
 * Unified interface for both ioredis and redis package clients
 * Handles embedded and external Redis connections seamlessly
 */

import Redis, { Cluster } from 'ioredis';
import { logger } from '../utils/logger';

export type UnifiedRedisClient = Redis | Cluster | any;

export interface RedisAdapter {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  flushdb(): Promise<string>;
  info(section?: string): Promise<string>;
  isConnected(): boolean;
  getStatus(): string;
  disconnect(): Promise<void>;
}

/**
 * Unified Redis Adapter that works with both ioredis and redis package clients
 */
export class UnifiedRedisAdapter implements RedisAdapter {
  private client: UnifiedRedisClient;
  private clientType: 'ioredis' | 'redis';

  constructor(client: UnifiedRedisClient) {
    this.client = client;
    this.clientType = this.detectClientType(client);
  }

  private detectClientType(client: UnifiedRedisClient): 'ioredis' | 'redis' {
    // ioredis clients have a 'status' property
    if ('status' in client) {
      return 'ioredis';
    }
    // redis package clients don't have status property
    return 'redis';
  }

  async ping(): Promise<string> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).ping();
      } else {
        return await (this.client as any).ping();
      }
    } catch (error: any) {
      logger.error('Redis ping failed:', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).get(key);
      } else {
        return await (this.client as any).get(key);
      }
    } catch (error: any) {
      logger.error(`Redis get failed for key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: string): Promise<string | null> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).set(key, value);
      } else {
        await (this.client as any).set(key, value);
        return 'OK';
      }
    } catch (error: any) {
      logger.error(`Redis set failed for key ${key}:`, error);
      throw error;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<string | null> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).setex(key, seconds, value);
      } else {
        // redis package uses setEx (capital E)
        await (this.client as any).setEx(key, seconds, value);
        return 'OK';
      }
    } catch (error: any) {
      logger.error(`Redis setex failed for key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).del(key);
      } else {
        return await (this.client as any).del(key);
      }
    } catch (error: any) {
      logger.error(`Redis del failed for key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).exists(key);
      } else {
        return await (this.client as any).exists(key);
      }
    } catch (error: any) {
      logger.error(`Redis exists failed for key ${key}:`, error);
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).expire(key, seconds);
      } else {
        return await (this.client as any).expire(key, seconds);
      }
    } catch (error: any) {
      logger.error(`Redis expire failed for key ${key}:`, error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).ttl(key);
      } else {
        return await (this.client as any).ttl(key);
      }
    } catch (error: any) {
      logger.error(`Redis ttl failed for key ${key}:`, error);
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).keys(pattern);
      } else {
        return await (this.client as any).keys(pattern);
      }
    } catch (error: any) {
      logger.error(`Redis keys failed for pattern ${pattern}:`, error);
      throw error;
    }
  }

  async flushdb(): Promise<string> {
    try {
      if (this.clientType === 'ioredis') {
        return await (this.client as Redis | Cluster).flushdb();
      } else {
        await (this.client as any).flushDb();
        return 'OK';
      }
    } catch (error: any) {
      logger.error('Redis flushdb failed:', error);
      throw error;
    }
  }

  async info(section?: string): Promise<string> {
    try {
      if (this.clientType === 'ioredis') {
        if (section) {
          return await (this.client as Redis | Cluster).info(section);
        } else {
          return await (this.client as Redis | Cluster).info();
        }
      } else {
        if (section) {
          return await (this.client as any).info(section);
        } else {
          return await (this.client as any).info();
        }
      }
    } catch (error: any) {
      logger.error('Redis info failed:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    try {
      if (this.clientType === 'ioredis') {
        const ioredisClient = this.client as Redis | Cluster;
        return ioredisClient.status === 'ready';
      } else {
        // redis package clients are connected if they exist and haven't been disconnected
        return this.client !== null;
      }
    } catch (error: any) {
      logger.error('Redis isConnected check failed:', error);
      return false;
    }
  }

  getStatus(): string {
    try {
      if (this.clientType === 'ioredis') {
        const ioredisClient = this.client as Redis | Cluster;
        return ioredisClient.status;
      } else {
        // redis package doesn't have status, return connected/disconnected
        return this.client ? 'connected' : 'disconnected';
      }
    } catch (error: any) {
      logger.error('Redis getStatus failed:', error);
      return 'error';
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.clientType === 'ioredis') {
        await (this.client as Redis | Cluster).disconnect();
      } else {
        await (this.client as any).disconnect();
      }
    } catch (error: any) {
      logger.error('Redis disconnect failed:', error);
      throw error;
    }
  }

  /**
   * Get the underlying client for advanced operations
   */
  getUnderlyingClient(): UnifiedRedisClient {
    return this.client;
  }

  /**
   * Get client type
   */
  getClientType(): 'ioredis' | 'redis' {
    return this.clientType;
  }
}

/**
 * Factory function to create a unified Redis adapter
 */
export function createRedisAdapter(client: UnifiedRedisClient): UnifiedRedisAdapter {
  return new UnifiedRedisAdapter(client);
}

/**
 * Type guard to check if client is ioredis
 */
export function isIoRedisClient(client: UnifiedRedisClient): client is Redis | Cluster {
  return 'status' in client;
}

/**
 * Type guard to check if client is redis package client
 */
export function isRedisPackageClient(client: UnifiedRedisClient): client is any {
  return !('status' in client);
}
