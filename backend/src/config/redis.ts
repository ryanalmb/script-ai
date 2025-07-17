import { createClient, RedisClientType } from 'redis';
import { Redis, Cluster } from 'ioredis';
import { logger } from '../utils/logger';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { EventEmitter } from 'events';

// Enterprise Redis interfaces
interface RedisMetrics {
  operations: number;
  hits: number;
  misses: number;
  errors: number;
  averageResponseTime: number;
  memoryUsage: number;
  connectedClients: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  evictedKeys: number;
}

interface RedisClusterNode {
  host: string;
  port: number;
  role?: 'master' | 'slave';
  status?: 'connected' | 'disconnected' | 'connecting';
}

interface RedisConfiguration {
  url: string;
  cluster: {
    enabled: boolean;
    nodes: RedisClusterNode[];
    options: any;
  };
  sentinel: {
    enabled: boolean;
    sentinels: Array<{ host: string; port: number }>;
    name: string;
  };
  performance: {
    enablePipelining: boolean;
    enableCompression: boolean;
    maxMemoryPolicy: string;
    keyPrefix: string;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    slowLogThreshold: number;
  };
}

/**
 * Enterprise Redis Manager - 2025 Edition
 * Advanced Redis management with clustering, monitoring, and performance optimization
 */
export class EnterpriseRedisManager extends EventEmitter {
  private static instance: EnterpriseRedisManager;
  private redisClient: Redis | null = null;
  private redisCluster: Cluster | null = null;
  private configuration: RedisConfiguration = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: [],
      options: {}
    },
    sentinel: {
      enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
      sentinels: [],
      name: process.env.REDIS_SENTINEL_NAME || 'mymaster'
    },
    performance: {
      enablePipelining: process.env.REDIS_ENABLE_PIPELINING !== 'false',
      enableCompression: process.env.REDIS_ENABLE_COMPRESSION === 'true',
      maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'x-marketing:'
    },
    monitoring: {
      enableMetrics: process.env.REDIS_ENABLE_METRICS !== 'false',
      metricsInterval: parseInt(process.env.REDIS_METRICS_INTERVAL || '60000'),
      slowLogThreshold: parseInt(process.env.REDIS_SLOW_LOG_THRESHOLD || '10000')
    }
  };
  private metrics: RedisMetrics = {
    operations: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    connectedClients: 0,
    keyspaceHits: 0,
    keyspaceMisses: 0,
    evictedKeys: 0
  };
  private metricsInterval: NodeJS.Timeout | null = null;
  private tracer = trace.getTracer('enterprise-redis-manager', '1.0.0');
  private isInitialized = false;

  constructor() {
    super();
    this.initializeConfiguration();
    this.initializeMetrics();
  }

  static getInstance(): EnterpriseRedisManager {
    if (!EnterpriseRedisManager.instance) {
      EnterpriseRedisManager.instance = new EnterpriseRedisManager();
    }
    return EnterpriseRedisManager.instance;
  }

  /**
   * Initialize enterprise Redis configuration
   */
  private initializeConfiguration(): void {
    this.configuration = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      cluster: {
        enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
        nodes: this.parseClusterNodes(process.env.REDIS_CLUSTER_NODES || ''),
        options: {
          enableReadyCheck: true,
          redisOptions: {
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keepAlive: 30000,
            connectTimeout: 10000,
            commandTimeout: 5000,
            enableAutoPipelining: true,
            family: 4
          }
        }
      },
      sentinel: {
        enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
        sentinels: this.parseSentinels(process.env.REDIS_SENTINELS || ''),
        name: process.env.REDIS_SENTINEL_NAME || 'mymaster'
      },
      performance: {
        enablePipelining: process.env.REDIS_ENABLE_PIPELINING !== 'false',
        enableCompression: process.env.REDIS_ENABLE_COMPRESSION === 'true',
        maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'x-marketing:'
      },
      monitoring: {
        enableMetrics: process.env.REDIS_ENABLE_METRICS !== 'false',
        metricsInterval: parseInt(process.env.REDIS_METRICS_INTERVAL || '60000'),
        slowLogThreshold: parseInt(process.env.REDIS_SLOW_LOG_THRESHOLD || '10000')
      }
    };
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    this.metrics = {
      operations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      connectedClients: 0,
      keyspaceHits: 0,
      keyspaceMisses: 0,
      evictedKeys: 0
    };
  }

  /**
   * Parse cluster nodes from environment variable
   */
  private parseClusterNodes(nodesString: string): RedisClusterNode[] {
    if (!nodesString) {
      return [{ host: 'localhost', port: 6379 }];
    }

    return nodesString.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return {
        host: host || 'localhost',
        port: parseInt(port || '6379') || 6379
      };
    });
  }

  /**
   * Parse sentinel nodes from environment variable
   */
  private parseSentinels(sentinelsString: string): Array<{ host: string; port: number }> {
    if (!sentinelsString) {
      return [];
    }

    return sentinelsString.split(',').map(sentinel => {
      const [host, port] = sentinel.trim().split(':');
      return {
        host: host || 'localhost',
        port: parseInt(port || '26379') || 26379
      };
    });
  }

  /**
   * Initialize enterprise Redis connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enterprise Redis Manager already initialized');
      return;
    }

    const span = this.tracer.startSpan('redis_manager_initialize', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🚀 Initializing Enterprise Redis Manager...');

      if (this.configuration.cluster.enabled) {
        await this.initializeCluster();
      } else if (this.configuration.sentinel.enabled) {
        await this.initializeSentinel();
      } else {
        await this.initializeStandalone();
      }

      // Start metrics collection
      if (this.configuration.monitoring.enableMetrics) {
        this.startMetricsCollection();
      }

      this.isInitialized = true;
      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('✅ Enterprise Redis Manager initialized successfully');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Failed to initialize Enterprise Redis Manager:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize Redis cluster
   */
  private async initializeCluster(): Promise<void> {
    logger.info('🔄 Initializing Redis Cluster...');

    this.redisCluster = new Cluster(
      this.configuration.cluster.nodes,
      this.configuration.cluster.options
    );

    this.setupClusterEventListeners();

    // Test cluster connection
    await this.redisCluster.ping();
    logger.info('✅ Redis Cluster connected successfully');
  }

  /**
   * Initialize Redis with Sentinel
   */
  private async initializeSentinel(): Promise<void> {
    logger.info('🔄 Initializing Redis with Sentinel...');

    this.redisClient = new Redis({
      sentinels: this.configuration.sentinel.sentinels,
      name: this.configuration.sentinel.name,
      ...this.configuration.cluster.options.redisOptions
    });

    this.setupStandaloneEventListeners();

    // Test sentinel connection
    await this.redisClient.ping();
    logger.info('✅ Redis Sentinel connected successfully');
  }

  /**
   * Initialize standalone Redis
   */
  private async initializeStandalone(): Promise<void> {
    logger.info('🔄 Initializing Standalone Redis...');

    this.redisClient = new Redis(this.configuration.url, {
      ...this.configuration.cluster.options.redisOptions,
      keyPrefix: this.configuration.performance.keyPrefix
    });

    this.setupStandaloneEventListeners();

    // Test standalone connection
    await this.redisClient.ping();
    logger.info('✅ Standalone Redis connected successfully');
  }

  /**
   * Setup event listeners for cluster
   */
  private setupClusterEventListeners(): void {
    if (!this.redisCluster) return;

    this.redisCluster.on('connect', () => {
      logger.info('✅ Redis Cluster connected');
      this.emit('cluster:connected');
    });

    this.redisCluster.on('ready', () => {
      logger.info('🚀 Redis Cluster ready');
      this.emit('cluster:ready');
    });

    this.redisCluster.on('error', (error) => {
      logger.error('❌ Redis Cluster error:', error);
      this.metrics.errors++;
      this.emit('cluster:error', error);
    });

    this.redisCluster.on('close', () => {
      logger.warn('🔌 Redis Cluster connection closed');
      this.emit('cluster:closed');
    });

    this.redisCluster.on('reconnecting', () => {
      logger.info('🔄 Redis Cluster reconnecting...');
      this.emit('cluster:reconnecting');
    });

    this.redisCluster.on('node error', (error, node) => {
      logger.error(`❌ Redis Cluster node error (${node.host}:${node.port}):`, error);
      this.emit('cluster:node_error', error, node);
    });
  }

  /**
   * Setup event listeners for standalone/sentinel
   */
  private setupStandaloneEventListeners(): void {
    if (!this.redisClient) return;

    this.redisClient.on('connect', () => {
      logger.info('✅ Redis connected');
      this.emit('redis:connected');
    });

    this.redisClient.on('ready', () => {
      logger.info('🚀 Redis ready');
      this.emit('redis:ready');
    });

    this.redisClient.on('error', (error) => {
      logger.error('❌ Redis error:', error);
      this.metrics.errors++;
      this.emit('redis:error', error);
    });

    this.redisClient.on('close', () => {
      logger.warn('🔌 Redis connection closed');
      this.emit('redis:closed');
    });

    this.redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
      this.emit('redis:reconnecting');
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.configuration.monitoring.metricsInterval);

    logger.info(`📊 Redis metrics collection started (interval: ${this.configuration.monitoring.metricsInterval}ms)`);
  }

  /**
   * Collect Redis metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const client = this.getActiveClient();
      if (!client) return;

      const info = await client.info('stats');
      const memory = await client.info('memory');
      const clients = await client.info('clients');

      // Parse info strings
      const stats = this.parseRedisInfo(info);
      const memoryInfo = this.parseRedisInfo(memory);
      const clientsInfo = this.parseRedisInfo(clients);

      // Update metrics
      this.metrics.keyspaceHits = parseInt(stats.keyspace_hits || '0');
      this.metrics.keyspaceMisses = parseInt(stats.keyspace_misses || '0');
      this.metrics.evictedKeys = parseInt(stats.evicted_keys || '0');
      this.metrics.memoryUsage = parseInt(memoryInfo.used_memory || '0');
      this.metrics.connectedClients = parseInt(clientsInfo.connected_clients || '0');

      // Calculate hit rate
      const totalKeyspaceOps = this.metrics.keyspaceHits + this.metrics.keyspaceMisses;
      if (totalKeyspaceOps > 0) {
        const hitRate = (this.metrics.keyspaceHits / totalKeyspaceOps) * 100;
        this.metrics.hits = hitRate;
        this.metrics.misses = 100 - hitRate;
      }

    } catch (error) {
      logger.warn('Failed to collect Redis metrics:', error);
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value !== undefined) {
          result[key] = value;
        }
      }
    });
    return result;
  }

  /**
   * Get active Redis client (cluster or standalone)
   */
  private getActiveClient(): Redis | Cluster | null {
    if (this.redisCluster) {
      return this.redisCluster;
    }
    return this.redisClient;
  }

  /**
   * Enterprise cache operations with intelligent routing
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const span = this.tracer.startSpan('redis_set', {
      kind: SpanKind.CLIENT,
      attributes: {
        'redis.key': key,
        'redis.ttl': ttl || 0
      }
    });

    const startTime = Date.now();

    try {
      const client = this.getActiveClient();
      if (!client) {
        throw new Error('No Redis client available');
      }

      const serializedValue = JSON.stringify(value);
      const fullKey = this.configuration.performance.keyPrefix + key;

      let result: string;
      if (ttl) {
        result = await client.setex(fullKey, ttl, serializedValue);
      } else {
        result = await client.set(fullKey, serializedValue);
      }

      this.metrics.operations++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      span.setAttributes({
        'redis.success': result === 'OK',
        'redis.response_time': responseTime
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return result === 'OK';

    } catch (error) {
      this.metrics.errors++;
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Redis SET operation failed:', error);
      return false;
    } finally {
      span.end();
    }
  }

  /**
   * Enterprise get operation with metrics tracking
   */
  async get<T>(key: string): Promise<T | null> {
    const span = this.tracer.startSpan('redis_get', {
      kind: SpanKind.CLIENT,
      attributes: {
        'redis.key': key
      }
    });

    const startTime = Date.now();

    try {
      const client = this.getActiveClient();
      if (!client) {
        throw new Error('No Redis client available');
      }

      const fullKey = this.configuration.performance.keyPrefix + key;
      const result = await client.get(fullKey);

      this.metrics.operations++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      if (result) {
        this.metrics.hits++;
        span.setAttributes({ 'redis.hit': true });
        return JSON.parse(result);
      } else {
        this.metrics.misses++;
        span.setAttributes({ 'redis.hit': false });
        return null;
      }

    } catch (error) {
      this.metrics.errors++;
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Redis GET operation failed:', error);
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.operations === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (this.metrics.operations - 1) + responseTime) / this.metrics.operations;
    }
  }

  /**
   * Delete key with metrics tracking
   */
  async del(key: string): Promise<boolean> {
    const span = this.tracer.startSpan('redis_del', {
      kind: SpanKind.CLIENT,
      attributes: { 'redis.key': key }
    });

    try {
      const client = this.getActiveClient();
      if (!client) {
        throw new Error('No Redis client available');
      }

      const fullKey = this.configuration.performance.keyPrefix + key;
      const result = await client.del(fullKey);

      this.metrics.operations++;
      span.setStatus({ code: SpanStatusCode.OK });

      return result > 0;

    } catch (error) {
      this.metrics.errors++;
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Redis DEL operation failed:', error);
      return false;
    } finally {
      span.end();
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = this.getActiveClient();
      if (!client) return false;

      const fullKey = this.configuration.performance.keyPrefix + key;
      const result = await client.exists(fullKey);

      this.metrics.operations++;
      return result > 0;

    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis EXISTS operation failed:', error);
      return false;
    }
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const client = this.getActiveClient();
      if (!client) return false;

      const fullKey = this.configuration.performance.keyPrefix + key;
      const result = await client.expire(fullKey, seconds);

      this.metrics.operations++;
      return result === 1;

    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis EXPIRE operation failed:', error);
      return false;
    }
  }

  /**
   * Get multiple keys at once (pipeline operation)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const span = this.tracer.startSpan('redis_mget', {
      kind: SpanKind.CLIENT,
      attributes: {
        'redis.keys_count': keys.length
      }
    });

    try {
      const client = this.getActiveClient();
      if (!client) {
        throw new Error('No Redis client available');
      }

      const fullKeys = keys.map(key => this.configuration.performance.keyPrefix + key);
      const results = await client.mget(...fullKeys);

      this.metrics.operations++;
      span.setStatus({ code: SpanStatusCode.OK });

      return results.map(result => result ? JSON.parse(result) : null);

    } catch (error) {
      this.metrics.errors++;
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Redis MGET operation failed:', error);
      return keys.map(() => null);
    } finally {
      span.end();
    }
  }

  /**
   * Get Redis metrics
   */
  getMetrics(): RedisMetrics {
    return { ...this.metrics };
  }

  /**
   * Get Redis configuration
   */
  getConfiguration(): RedisConfiguration {
    return { ...this.configuration };
  }

  /**
   * Check if Redis is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const client = this.getActiveClient();
      if (!client) return false;

      await client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis | Cluster | null {
    return this.getActiveClient();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down Enterprise Redis Manager...');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    const shutdownTasks = [];

    if (this.redisClient) {
      shutdownTasks.push(this.redisClient.disconnect());
    }

    if (this.redisCluster) {
      shutdownTasks.push(this.redisCluster.disconnect());
    }

    await Promise.allSettled(shutdownTasks);

    this.isInitialized = false;
    logger.info('✅ Enterprise Redis Manager shutdown completed');
  }
}

// Export singleton instance and backward compatibility functions
export const enterpriseRedisManager = EnterpriseRedisManager.getInstance();

// Backward compatibility exports
export const createRedisClient = () => {
  logger.warn('createRedisClient is deprecated. Use enterpriseRedisManager instead.');
  return enterpriseRedisManager.getClient();
};

export const connectRedis = async (): Promise<void> => {
  await enterpriseRedisManager.initialize();
};

export const getRedisClient = () => {
  return enterpriseRedisManager.getClient();
};

export const getRedisClientStrict = () => {
  const client = enterpriseRedisManager.getClient();
  if (!client) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return client;
};

export const closeRedisConnection = async (): Promise<void> => {
  await enterpriseRedisManager.shutdown();
};

/**
 * Enterprise Cache Service - Enhanced version using Enterprise Redis Manager
 * Provides backward compatibility while leveraging enterprise features
 */
export class CacheService {
  private memoryCache = new Map<string, { value: any; expires: number }>();
  private redisManager = enterpriseRedisManager;

  constructor() {
    // Enterprise Redis Manager handles initialization
  }

  /**
   * Set cache with TTL and enterprise features
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      // Try enterprise Redis first
      const success = await this.redisManager.set(key, value, ttlSeconds);

      if (success) {
        logger.debug(`Enterprise cache set: ${key} (TTL: ${ttlSeconds}s)`);
        return;
      }

      // Fallback to memory cache
      const expires = Date.now() + (ttlSeconds * 1000);
      this.memoryCache.set(key, { value, expires });
      logger.debug(`Memory cache fallback set: ${key} (TTL: ${ttlSeconds}s)`);

    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      // Fallback to memory cache on any error
      const expires = Date.now() + (ttlSeconds * 1000);
      this.memoryCache.set(key, { value, expires });
      logger.debug(`Memory cache error fallback for key: ${key}`);
    }
  }

  /**
   * Get cache with enterprise features and memory fallback
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try enterprise Redis first
      const value = await this.redisManager.get<T>(key);

      if (value !== null) {
        logger.debug(`Enterprise cache hit: ${key}`);
        return value;
      }

      // Check memory cache fallback
      const cached = this.memoryCache.get(key);
      if (!cached) {
        logger.debug(`Cache miss: ${key}`);
        return null;
      }

      if (Date.now() > cached.expires) {
        this.memoryCache.delete(key);
        logger.debug(`Memory cache expired: ${key}`);
        return null;
      }

      logger.debug(`Memory cache hit: ${key}`);
      return cached.value as T;

    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      // Fallback to memory cache on any error
      const cached = this.memoryCache.get(key);
      if (cached && Date.now() <= cached.expires) {
        return cached.value as T;
      }
      return null;
    }
  }

  /**
   * Delete cache with enterprise features
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redisManager.del(key);
      this.memoryCache.delete(key); // Also remove from memory cache
      logger.debug(`Enterprise cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      // Still try to remove from memory cache
      this.memoryCache.delete(key);
    }
  }

  /**
   * Check if key exists with enterprise features
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redisManager.exists(key);
      if (exists) return true;

      // Check memory cache fallback
      const cached = this.memoryCache.get(key);
      return cached ? Date.now() <= cached.expires : false;
    } catch (error) {
      logger.error(`Cache exists check error for key ${key}:`, error);
      // Check memory cache fallback
      const cached = this.memoryCache.get(key);
      return cached ? Date.now() <= cached.expires : false;
    }
  }

  /**
   * Set TTL for existing key with enterprise features
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redisManager.expire(key, ttlSeconds);

      // Update memory cache TTL if exists
      const cached = this.memoryCache.get(key);
      if (cached) {
        cached.expires = Date.now() + (ttlSeconds * 1000);
        this.memoryCache.set(key, cached);
      }

      logger.debug(`Enterprise cache TTL set: ${key} (${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
    }
  }

  /**
   * Get multiple keys with enterprise features
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redisManager.mget<T>(keys);
      logger.debug(`Enterprise cache mget: ${keys.length} keys`);
      return values;
    } catch (error) {
      logger.error(`Cache mget error for keys ${keys.join(', ')}:`, error);

      // Fallback to individual memory cache lookups
      return keys.map(key => {
        const cached = this.memoryCache.get(key);
        if (cached && Date.now() <= cached.expires) {
          return cached.value as T;
        }
        return null;
      });
    }
  }

  /**
   * Set multiple keys with enterprise features
   */
  async mset(keyValuePairs: Record<string, any>, ttlSeconds: number = 3600): Promise<void> {
    try {
      // Use enterprise Redis for bulk operations
      const client = this.redisManager.getClient();
      if (!client) {
        // Fallback to individual memory cache sets
        for (const [key, value] of Object.entries(keyValuePairs)) {
          const expires = Date.now() + (ttlSeconds * 1000);
          this.memoryCache.set(key, { value, expires });
        }
        logger.debug(`Memory cache mset: ${Object.keys(keyValuePairs).join(', ')} (TTL: ${ttlSeconds}s)`);
        return;
      }

      // Use pipeline for efficient bulk operations
      const pipeline = client.pipeline();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const fullKey = this.redisManager.getConfiguration().performance.keyPrefix + key;
        const serializedValue = JSON.stringify(value);
        pipeline.setex(fullKey, ttlSeconds, serializedValue);
      }

      await pipeline.exec();
      logger.debug(`Enterprise cache mset: ${Object.keys(keyValuePairs).join(', ')} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error(`Cache mset error:`, error);
      // Fallback to memory cache
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const expires = Date.now() + (ttlSeconds * 1000);
        this.memoryCache.set(key, { value, expires });
      }
    }
  }

  /**
   * Get cache metrics from enterprise Redis manager
   */
  getMetrics() {
    return this.redisManager.getMetrics();
  }

  /**
   * Check if Redis is healthy
   */
  async isHealthy(): Promise<boolean> {
    return await this.redisManager.isHealthy();
  }

  /**
   * Clear memory cache (for testing/debugging)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    logger.debug('Memory cache cleared');
  }

}

// Export singleton instance for backward compatibility
export const cacheService = new CacheService();

// Default export for backward compatibility
export default enterpriseRedisManager;
