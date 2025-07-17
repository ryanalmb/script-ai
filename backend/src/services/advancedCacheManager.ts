/**
 * Advanced Cache Manager - 2025 Edition
 * Multi-level intelligent caching with enterprise features:
 * - L1: In-memory cache (fastest)
 * - L2: Redis cache (fast, persistent)
 * - L3: Database cache (persistent, queryable)
 * - Intelligent cache invalidation
 * - Cache warming and preloading
 * - Performance analytics and optimization
 */

import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import { enterpriseRedisManager } from '../config/redis';
import { connectionManager } from '../config/connectionManager';
import { logger } from '../utils/logger';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

interface CacheConfig {
  l1: {
    maxSize: number;
    ttl: number;
    updateAgeOnGet: boolean;
    allowStale: boolean;
  };
  l2: {
    defaultTtl: number;
    keyPrefix: string;
    enableCompression: boolean;
    enableCluster: boolean;
  };
  l3: {
    tableName: string;
    maxEntries: number;
    cleanupInterval: number;
  };
  warming: {
    enabled: boolean;
    strategies: string[];
    schedules: Record<string, string>;
  };
  analytics: {
    enabled: boolean;
    metricsInterval: number;
    performanceThresholds: {
      l1HitRate: number;
      l2HitRate: number;
      avgResponseTime: number;
    };
  };
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  metadata?: Record<string, any>;
}

interface CacheMetrics {
  l1: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
  };
  l2: {
    hits: number;
    misses: number;
    hitRate: number;
    operations: number;
    errors: number;
    avgResponseTime: number;
  };
  l3: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    cleanups: number;
  };
  overall: {
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    avgResponseTime: number;
    throughput: number;
  };
}

interface CacheStrategy {
  name: string;
  priority: number;
  condition: (key: string, value: any) => boolean;
  ttl: number;
  tags: string[];
  preload?: boolean;
}

/**
 * Advanced Multi-Level Cache Manager
 */
export class AdvancedCacheManager extends EventEmitter {
  private static instance: AdvancedCacheManager;
  private config: CacheConfig;
  private l1Cache: LRUCache<string, CacheEntry<any>>;
  private metrics: CacheMetrics;
  private strategies = new Map<string, CacheStrategy>();
  private warmingTasks = new Map<string, NodeJS.Timeout>();
  private metricsInterval: NodeJS.Timeout | null = null;
  private tracer = trace.getTracer('advanced-cache-manager', '1.0.0');
  private isInitialized = false;

  constructor() {
    super();

    // Initialize configuration with defaults
    this.config = {
      l1: {
        maxSize: parseInt(process.env.CACHE_L1_MAX_SIZE || '1000'),
        ttl: parseInt(process.env.CACHE_L1_TTL || '300000'), // 5 minutes
        updateAgeOnGet: true,
        updateAgeOnHas: false
      },
      l2: {
        enabled: process.env.CACHE_L2_ENABLED !== 'false',
        keyPrefix: process.env.CACHE_L2_PREFIX || 'l2:',
        ttl: parseInt(process.env.CACHE_L2_TTL || '3600000'), // 1 hour
        compression: process.env.CACHE_L2_COMPRESSION === 'true'
      },
      warming: {
        enabled: process.env.CACHE_WARMING_ENABLED === 'true',
        schedules: {},
        batchSize: parseInt(process.env.CACHE_WARMING_BATCH_SIZE || '100')
      },
      invalidation: {
        enabled: process.env.CACHE_INVALIDATION_ENABLED !== 'false',
        patterns: [],
        cascading: process.env.CACHE_CASCADING_INVALIDATION === 'true'
      },
      monitoring: {
        enabled: process.env.CACHE_MONITORING_ENABLED !== 'false',
        metricsInterval: parseInt(process.env.CACHE_METRICS_INTERVAL || '60000'),
        alertThresholds: {
          hitRateBelow: parseFloat(process.env.CACHE_HIT_RATE_THRESHOLD || '0.8'),
          errorRateAbove: parseFloat(process.env.CACHE_ERROR_RATE_THRESHOLD || '0.05'),
          latencyAbove: parseInt(process.env.CACHE_LATENCY_THRESHOLD || '100')
        }
      }
    };

    // Initialize L1 cache
    this.l1Cache = new LRUCache({
      max: this.config.l1.maxSize,
      ttl: this.config.l1.ttl,
      updateAgeOnGet: this.config.l1.updateAgeOnGet,
      updateAgeOnHas: this.config.l1.updateAgeOnHas
    });

    // Initialize metrics
    this.metrics = {
      l1: { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0, evictions: 0 },
      l2: { hits: 0, misses: 0, sets: 0, deletes: 0, size: 0, evictions: 0 },
      operations: { total: 0, errors: 0, averageLatency: 0 },
      hitRates: { l1: 0, l2: 0, overall: 0 },
      memory: { l1Usage: 0, l2Usage: 0, totalUsage: 0 },
      performance: { averageGetTime: 0, averageSetTime: 0, averageDeleteTime: 0 }
    };
    this.initializeConfiguration();
    this.initializeMetrics();
    this.initializeL1Cache();
    this.setupCacheStrategies();
  }

  static getInstance(): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager();
    }
    return AdvancedCacheManager.instance;
  }

  /**
   * Initialize enterprise cache configuration
   */
  private initializeConfiguration(): void {
    this.config = {
      l1: {
        maxSize: parseInt(process.env.L1_CACHE_MAX_SIZE || '10000'),
        ttl: parseInt(process.env.L1_CACHE_TTL || '300000'), // 5 minutes
        updateAgeOnGet: process.env.L1_CACHE_UPDATE_AGE !== 'false',
        allowStale: process.env.L1_CACHE_ALLOW_STALE === 'true'
      },
      l2: {
        defaultTtl: parseInt(process.env.L2_CACHE_TTL || '3600'), // 1 hour
        keyPrefix: process.env.L2_CACHE_PREFIX || 'x-marketing:cache:',
        enableCompression: process.env.L2_CACHE_COMPRESSION === 'true',
        enableCluster: process.env.L2_CACHE_CLUSTER === 'true'
      },
      l3: {
        tableName: process.env.L3_CACHE_TABLE || 'cache_entries',
        maxEntries: parseInt(process.env.L3_CACHE_MAX_ENTRIES || '1000000'),
        cleanupInterval: parseInt(process.env.L3_CACHE_CLEANUP_INTERVAL || '3600000') // 1 hour
      },
      warming: {
        enabled: process.env.CACHE_WARMING_ENABLED !== 'false',
        strategies: (process.env.CACHE_WARMING_STRATEGIES || 'user_profiles,campaign_data,analytics').split(','),
        schedules: {
          user_profiles: process.env.CACHE_WARM_USER_PROFILES || '0 */6 * * *', // Every 6 hours
          campaign_data: process.env.CACHE_WARM_CAMPAIGNS || '0 */4 * * *', // Every 4 hours
          analytics: process.env.CACHE_WARM_ANALYTICS || '0 */2 * * *' // Every 2 hours
        }
      },
      analytics: {
        enabled: process.env.CACHE_ANALYTICS_ENABLED !== 'false',
        metricsInterval: parseInt(process.env.CACHE_METRICS_INTERVAL || '60000'), // 1 minute
        performanceThresholds: {
          l1HitRate: parseFloat(process.env.L1_HIT_RATE_THRESHOLD || '0.8'),
          l2HitRate: parseFloat(process.env.L2_HIT_RATE_THRESHOLD || '0.7'),
          avgResponseTime: parseFloat(process.env.CACHE_RESPONSE_TIME_THRESHOLD || '10')
        }
      }
    };
  }

  /**
   * Initialize cache metrics tracking
   */
  private initializeMetrics(): void {
    this.metrics = {
      l1: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        maxSize: this.config.l1.maxSize,
        evictions: 0
      },
      l2: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        operations: 0,
        errors: 0,
        avgResponseTime: 0
      },
      l3: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        cleanups: 0
      },
      overall: {
        totalHits: 0,
        totalMisses: 0,
        overallHitRate: 0,
        avgResponseTime: 0,
        throughput: 0
      }
    };
  }

  /**
   * Initialize L1 (in-memory) cache
   */
  private initializeL1Cache(): void {
    this.l1Cache = new LRUCache<string, CacheEntry<any>>({
      max: this.config.l1.maxSize,
      ttl: this.config.l1.ttl,
      updateAgeOnGet: this.config.l1.updateAgeOnGet,
      allowStale: this.config.l1.allowStale,
      dispose: (value, key) => {
        this.metrics.l1.evictions++;
        this.emit('l1:eviction', key, value);
      }
    });

    logger.info(`🚀 L1 Cache initialized (max: ${this.config.l1.maxSize}, ttl: ${this.config.l1.ttl}ms)`);
  }

  /**
   * Setup intelligent cache strategies
   */
  private setupCacheStrategies(): void {
    // User profile strategy - high priority, long TTL
    this.strategies.set('user_profiles', {
      name: 'user_profiles',
      priority: 9,
      condition: (key: string) => key.startsWith('user:') || key.includes('profile'),
      ttl: 3600, // 1 hour
      tags: ['user', 'profile'],
      preload: true
    });

    // Campaign data strategy - medium priority, medium TTL
    this.strategies.set('campaign_data', {
      name: 'campaign_data',
      priority: 7,
      condition: (key: string) => key.startsWith('campaign:') || key.includes('campaign'),
      ttl: 1800, // 30 minutes
      tags: ['campaign', 'data'],
      preload: true
    });

    // Analytics strategy - low priority, short TTL
    this.strategies.set('analytics', {
      name: 'analytics',
      priority: 5,
      condition: (key: string) => key.startsWith('analytics:') || key.includes('metrics'),
      ttl: 300, // 5 minutes
      tags: ['analytics', 'metrics'],
      preload: false
    });

    // Session data strategy - high priority, short TTL
    this.strategies.set('session_data', {
      name: 'session_data',
      priority: 8,
      condition: (key: string) => key.startsWith('session:') || key.includes('auth'),
      ttl: 900, // 15 minutes
      tags: ['session', 'auth'],
      preload: false
    });

    // API response strategy - medium priority, medium TTL
    this.strategies.set('api_responses', {
      name: 'api_responses',
      priority: 6,
      condition: (key: string) => key.startsWith('api:') || key.includes('response'),
      ttl: 600, // 10 minutes
      tags: ['api', 'response'],
      preload: false
    });

    logger.info(`✅ ${this.strategies.size} cache strategies configured`);
  }

  /**
   * Initialize the advanced cache manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Advanced Cache Manager already initialized');
      return;
    }

    const span = this.tracer.startSpan('cache_manager_initialize', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🚀 Initializing Advanced Cache Manager...');

      // Ensure Redis is initialized
      if (!await enterpriseRedisManager.isHealthy()) {
        logger.warn('Redis not available, cache will operate in degraded mode');
      }

      // Initialize L3 cache table if needed
      await this.initializeL3Cache();

      // Start metrics collection
      if (this.config.analytics.enabled) {
        this.startMetricsCollection();
      }

      // Start cache warming if enabled
      if (this.config.warming.enabled) {
        this.startCacheWarming();
      }

      this.isInitialized = true;
      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('✅ Advanced Cache Manager initialized successfully');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Failed to initialize Advanced Cache Manager:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get value from multi-level cache
   */
  async get<T>(key: string, options?: { skipL1?: boolean; skipL2?: boolean; skipL3?: boolean }): Promise<T | null> {
    const span = this.tracer.startSpan('cache_get', {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.key': key,
        'cache.skip_l1': options?.skipL1 || false,
        'cache.skip_l2': options?.skipL2 || false,
        'cache.skip_l3': options?.skipL3 || false
      }
    });

    const startTime = Date.now();

    try {
      // Try L1 cache first (fastest)
      if (!options?.skipL1) {
        const l1Result = this.l1Cache.get(key);
        if (l1Result && !this.isExpired(l1Result)) {
          l1Result.accessCount++;
          l1Result.lastAccessed = Date.now();
          this.metrics.l1.hits++;
          this.metrics.overall.totalHits++;

          span.setAttributes({
            'cache.hit': true,
            'cache.level': 'L1',
            'cache.response_time': Date.now() - startTime
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return l1Result.value;
        } else {
          this.metrics.l1.misses++;
        }
      }

      // Try L2 cache (Redis)
      if (!options?.skipL2) {
        const l2Result = await this.getFromL2<T>(key);
        if (l2Result !== null) {
          // Store in L1 for faster future access
          if (!options?.skipL1) {
            this.setInL1(key, l2Result);
          }

          this.metrics.l2.hits++;
          this.metrics.overall.totalHits++;

          span.setAttributes({
            'cache.hit': true,
            'cache.level': 'L2',
            'cache.response_time': Date.now() - startTime
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return l2Result;
        } else {
          this.metrics.l2.misses++;
        }
      }

      // Try L3 cache (Database)
      if (!options?.skipL3) {
        const l3Result = await this.getFromL3<T>(key);
        if (l3Result !== null) {
          // Store in L2 and L1 for faster future access
          if (!options?.skipL2) {
            await this.setInL2(key, l3Result);
          }
          if (!options?.skipL1) {
            this.setInL1(key, l3Result);
          }

          this.metrics.l3.hits++;
          this.metrics.overall.totalHits++;

          span.setAttributes({
            'cache.hit': true,
            'cache.level': 'L3',
            'cache.response_time': Date.now() - startTime
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return l3Result;
        } else {
          this.metrics.l3.misses++;
        }
      }

      // Cache miss at all levels
      this.metrics.overall.totalMisses++;

      span.setAttributes({
        'cache.hit': false,
        'cache.response_time': Date.now() - startTime
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return null;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    } finally {
      span.end();
      this.updateMetrics(Date.now() - startTime);
    }
  }

  /**
   * Set value in multi-level cache with intelligent strategy selection
   */
  async set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
      strategy?: string;
      skipL1?: boolean;
      skipL2?: boolean;
      skipL3?: boolean;
    }
  ): Promise<boolean> {
    const span = this.tracer.startSpan('cache_set', {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.key': key,
        'cache.strategy': options?.strategy || 'auto',
        'cache.ttl': options?.ttl || 0
      }
    });

    try {
      // Determine cache strategy
      const strategy = options?.strategy ?
        this.strategies.get(options.strategy) :
        this.selectStrategy(key, value);

      const ttl = options?.ttl || strategy?.ttl || this.config.l2.defaultTtl;
      const tags = options?.tags || strategy?.tags || [];

      // Set in L1 cache
      if (!options?.skipL1) {
        this.setInL1(key, value, ttl, tags);
      }

      // Set in L2 cache (Redis)
      if (!options?.skipL2) {
        await this.setInL2(key, value, ttl, tags);
      }

      // Set in L3 cache (Database) for high-priority items
      if (!options?.skipL3 && strategy && strategy.priority >= 7) {
        await this.setInL3(key, value, ttl, tags);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      this.emit('cache:set', key, value, strategy?.name);

      return true;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    } finally {
      span.end();
    }
  }

  /**
   * Get value from L2 cache (Redis)
   */
  private async getFromL2<T>(key: string): Promise<T | null> {
    try {
      const redisKey = this.config.l2.keyPrefix + key;
      const result = await enterpriseRedisManager.get<CacheEntry<T>>(redisKey);

      if (result && !this.isExpired(result)) {
        this.metrics.l2.operations++;
        return result.value;
      }

      return null;
    } catch (error) {
      this.metrics.l2.errors++;
      logger.warn(`L2 cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in L2 cache (Redis)
   */
  private async setInL2<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    try {
      const redisKey = this.config.l2.keyPrefix + key;
      const cacheEntry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.l2.defaultTtl,
        accessCount: 0,
        lastAccessed: Date.now(),
        tags: tags || []
      };

      await enterpriseRedisManager.set(redisKey, cacheEntry, ttl);
      this.metrics.l2.operations++;
    } catch (error) {
      this.metrics.l2.errors++;
      logger.warn(`L2 cache set error for key ${key}:`, error);
    }
  }

  /**
   * Get value from L3 cache (Database)
   */
  private async getFromL3<T>(key: string): Promise<T | null> {
    try {
      const query = `
        SELECT value, timestamp, ttl, access_count, last_accessed, tags
        FROM ${this.config.l3.tableName}
        WHERE key = $1 AND (timestamp + (ttl * 1000)) > $2
      `;

      const result = await connectionManager.executeQuery<any[]>(query, [key, Date.now()]);

      if (result && result.length > 0) {
        const row = result[0];
        const cacheEntry: CacheEntry<T> = {
          value: JSON.parse(row.value),
          timestamp: row.timestamp,
          ttl: row.ttl,
          accessCount: row.access_count,
          lastAccessed: row.last_accessed,
          tags: row.tags || []
        };

        // Update access count
        await this.updateL3AccessCount(key);

        return cacheEntry.value;
      }

      return null;
    } catch (error) {
      logger.warn(`L3 cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in L3 cache (Database)
   */
  private async setInL3<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    try {
      const query = `
        INSERT INTO ${this.config.l3.tableName}
        (key, value, timestamp, ttl, access_count, last_accessed, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          timestamp = EXCLUDED.timestamp,
          ttl = EXCLUDED.ttl,
          last_accessed = EXCLUDED.last_accessed,
          tags = EXCLUDED.tags
      `;

      await connectionManager.executeQuery(query, [
        key,
        JSON.stringify(value),
        Date.now(),
        ttl || this.config.l2.defaultTtl,
        0,
        Date.now(),
        tags || []
      ]);

    } catch (error) {
      logger.warn(`L3 cache set error for key ${key}:`, error);
    }
  }

  /**
   * Set value in L1 cache (Memory)
   */
  private setInL1<T>(key: string, value: T, ttl?: number, tags?: string[]): void {
    const cacheEntry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.l1.ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      tags: tags || []
    };

    this.l1Cache.set(key, cacheEntry);
    this.metrics.l1.size = this.l1Cache.size;
  }

  /**
   * Update L3 cache access count
   */
  private async updateL3AccessCount(key: string): Promise<void> {
    try {
      const query = `
        UPDATE ${this.config.l3.tableName}
        SET access_count = access_count + 1, last_accessed = $1
        WHERE key = $2
      `;

      await connectionManager.executeQuery(query, [Date.now(), key]);
    } catch (error) {
      // Non-critical error, don't throw
      logger.debug(`Failed to update L3 access count for key ${key}:`, error);
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() > (entry.timestamp + (entry.ttl * 1000));
  }

  /**
   * Select appropriate cache strategy for key/value
   */
  private selectStrategy(key: string, value: any): CacheStrategy | undefined {
    for (const strategy of this.strategies.values()) {
      if (strategy.condition(key, value)) {
        return strategy;
      }
    }
    return undefined;
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(responseTime: number): void {
    // Update overall metrics
    this.metrics.overall.avgResponseTime =
      (this.metrics.overall.avgResponseTime + responseTime) / 2;

    // Update hit rates
    const l1Total = this.metrics.l1.hits + this.metrics.l1.misses;
    this.metrics.l1.hitRate = l1Total > 0 ? (this.metrics.l1.hits / l1Total) * 100 : 0;

    const l2Total = this.metrics.l2.hits + this.metrics.l2.misses;
    this.metrics.l2.hitRate = l2Total > 0 ? (this.metrics.l2.hits / l2Total) * 100 : 0;

    const l3Total = this.metrics.l3.hits + this.metrics.l3.misses;
    this.metrics.l3.hitRate = l3Total > 0 ? (this.metrics.l3.hits / l3Total) * 100 : 0;

    const overallTotal = this.metrics.overall.totalHits + this.metrics.overall.totalMisses;
    this.metrics.overall.overallHitRate = overallTotal > 0 ?
      (this.metrics.overall.totalHits / overallTotal) * 100 : 0;
  }

  /**
   * Initialize L3 cache table
   */
  private async initializeL3Cache(): Promise<void> {
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${this.config.l3.tableName} (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          ttl INTEGER NOT NULL,
          access_count INTEGER DEFAULT 0,
          last_accessed BIGINT NOT NULL,
          tags TEXT[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_cache_entries_timestamp ON ${this.config.l3.tableName} (timestamp);
        CREATE INDEX IF NOT EXISTS idx_cache_entries_ttl ON ${this.config.l3.tableName} (ttl);
        CREATE INDEX IF NOT EXISTS idx_cache_entries_tags ON ${this.config.l3.tableName} USING GIN (tags);
        CREATE INDEX IF NOT EXISTS idx_cache_entries_access_count ON ${this.config.l3.tableName} (access_count);
      `;

      await connectionManager.executeQuery(createTableQuery);
      logger.info('✅ L3 cache table initialized');
    } catch (error) {
      logger.error('Failed to initialize L3 cache table:', error);
      throw error;
    }
  }

  /**
   * Start cache warming processes
   */
  private startCacheWarming(): void {
    for (const strategyName of this.config.warming.strategies) {
      const strategy = this.strategies.get(strategyName);
      if (strategy && strategy.preload) {
        this.scheduleWarmingTask(strategyName);
      }
    }

    logger.info(`🔥 Cache warming started for ${this.config.warming.strategies.length} strategies`);
  }

  /**
   * Schedule cache warming task
   */
  private scheduleWarmingTask(strategyName: string): void {
    // For now, use simple interval-based warming
    // In production, you'd use a proper cron scheduler
    const schedule = this.config.warming.schedules[strategyName];
    if (!schedule) {
      logger.warn(`No warming schedule found for strategy: ${strategyName}`);
      return;
    }
    const interval = this.parseScheduleToInterval(schedule);

    const task = setInterval(async () => {
      await this.executeWarmingStrategy(strategyName);
    }, interval);

    this.warmingTasks.set(strategyName, task);
  }

  /**
   * Execute cache warming strategy
   */
  private async executeWarmingStrategy(strategyName: string): Promise<void> {
    const span = this.tracer.startSpan(`cache_warming_${strategyName}`, {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info(`🔥 Executing cache warming strategy: ${strategyName}`);

      switch (strategyName) {
        case 'user_profiles':
          await this.warmUserProfiles();
          break;
        case 'campaign_data':
          await this.warmCampaignData();
          break;
        case 'analytics':
          await this.warmAnalytics();
          break;
        default:
          logger.warn(`Unknown warming strategy: ${strategyName}`);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      this.emit('cache:warming_completed', strategyName);

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error(`Cache warming failed for strategy ${strategyName}:`, error);
    } finally {
      span.end();
    }
  }

  /**
   * Warm user profiles cache
   */
  private async warmUserProfiles(): Promise<void> {
    try {
      // Get active users from last 30 days
      const query = `
        SELECT id, email, username, telegram_id
        FROM users
        WHERE is_active = true
        AND updated_at > NOW() - INTERVAL '30 days'
        ORDER BY updated_at DESC
        LIMIT 1000
      `;

      const users = await connectionManager.executeQuery<any[]>(query);

      for (const user of users || []) {
        const cacheKey = `user:profile:${user.id}`;
        await this.set(cacheKey, user, {
          strategy: 'user_profiles',
          ttl: 3600
        });
      }

      logger.info(`🔥 Warmed ${users?.length || 0} user profiles`);
    } catch (error) {
      logger.error('Failed to warm user profiles:', error);
    }
  }

  /**
   * Warm campaign data cache
   */
  private async warmCampaignData(): Promise<void> {
    try {
      // Get active campaigns
      const query = `
        SELECT c.*, u.username as user_username
        FROM campaigns c
        JOIN users u ON c.user_id = u.id
        WHERE c.status IN ('ACTIVE', 'SCHEDULED')
        ORDER BY c.updated_at DESC
        LIMIT 500
      `;

      const campaigns = await connectionManager.executeQuery<any[]>(query);

      for (const campaign of campaigns || []) {
        const cacheKey = `campaign:data:${campaign.id}`;
        await this.set(cacheKey, campaign, {
          strategy: 'campaign_data',
          ttl: 1800
        });
      }

      logger.info(`🔥 Warmed ${campaigns?.length || 0} campaigns`);
    } catch (error) {
      logger.error('Failed to warm campaign data:', error);
    }
  }

  /**
   * Warm analytics cache
   */
  private async warmAnalytics(): Promise<void> {
    try {
      // Get recent analytics data
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total_events,
          COUNT(DISTINCT user_id) as unique_users
        FROM analytics
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      const analytics = await connectionManager.executeQuery<any[]>(query);

      for (const row of analytics || []) {
        const cacheKey = `analytics:daily:${row.date}`;
        await this.set(cacheKey, row, {
          strategy: 'analytics',
          ttl: 300
        });
      }

      logger.info(`🔥 Warmed ${analytics?.length || 0} analytics entries`);
    } catch (error) {
      logger.error('Failed to warm analytics:', error);
    }
  }

  /**
   * Parse schedule string to interval (simplified)
   */
  private parseScheduleToInterval(schedule: string): number {
    // Simple mapping for demo - in production use proper cron parser
    const scheduleMap: Record<string, number> = {
      '0 */6 * * *': 6 * 60 * 60 * 1000, // 6 hours
      '0 */4 * * *': 4 * 60 * 60 * 1000, // 4 hours
      '0 */2 * * *': 2 * 60 * 60 * 1000, // 2 hours
    };

    return scheduleMap[schedule] || 60 * 60 * 1000; // Default 1 hour
  }

  /**
   * Invalidate cache by key or pattern
   */
  async invalidate(keyOrPattern: string, options?: { pattern?: boolean; tags?: string[] }): Promise<number> {
    const span = this.tracer.startSpan('cache_invalidate', {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.key_pattern': keyOrPattern,
        'cache.is_pattern': options?.pattern || false
      }
    });

    let invalidatedCount = 0;

    try {
      if (options?.pattern) {
        // Pattern-based invalidation
        invalidatedCount = await this.invalidateByPattern(keyOrPattern);
      } else if (options?.tags && options.tags.length > 0) {
        // Tag-based invalidation
        invalidatedCount = await this.invalidateByTags(options.tags);
      } else {
        // Single key invalidation
        invalidatedCount = await this.invalidateSingleKey(keyOrPattern);
      }

      span.setAttributes({ 'cache.invalidated_count': invalidatedCount });
      span.setStatus({ code: SpanStatusCode.OK });

      this.emit('cache:invalidated', keyOrPattern, invalidatedCount);
      return invalidatedCount;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error(`Cache invalidation failed for ${keyOrPattern}:`, error);
      return 0;
    } finally {
      span.end();
    }
  }

  /**
   * Invalidate single key from all cache levels
   */
  private async invalidateSingleKey(key: string): Promise<number> {
    let count = 0;

    // L1 cache
    if (this.l1Cache.has(key)) {
      this.l1Cache.delete(key);
      count++;
    }

    // L2 cache
    try {
      const redisKey = this.config.l2.keyPrefix + key;
      const deleted = await enterpriseRedisManager.del(redisKey);
      if (deleted) count++;
    } catch (error) {
      logger.warn(`Failed to invalidate L2 cache for key ${key}:`, error);
    }

    // L3 cache
    try {
      const query = `DELETE FROM ${this.config.l3.tableName} WHERE key = $1`;
      await connectionManager.executeQuery(query, [key]);
      count++;
    } catch (error) {
      logger.warn(`Failed to invalidate L3 cache for key ${key}:`, error);
    }

    return count;
  }

  /**
   * Invalidate by pattern
   */
  private async invalidateByPattern(pattern: string): Promise<number> {
    let count = 0;

    // L1 cache pattern matching
    for (const key of this.l1Cache.keys()) {
      if (this.matchesPattern(key, pattern)) {
        this.l1Cache.delete(key);
        count++;
      }
    }

    // L2 cache pattern matching (Redis)
    try {
      const redisClient = enterpriseRedisManager.getClient();
      if (redisClient) {
        const redisPattern = this.config.l2.keyPrefix + pattern;
        const keys = await redisClient.keys(redisPattern);

        if (keys.length > 0) {
          await redisClient.del(...keys);
          count += keys.length;
        }
      }
    } catch (error) {
      logger.warn(`Failed to invalidate L2 cache by pattern ${pattern}:`, error);
    }

    // L3 cache pattern matching
    try {
      const query = `DELETE FROM ${this.config.l3.tableName} WHERE key LIKE $1`;
      await connectionManager.executeQuery(query, [pattern.replace('*', '%')]);
      count++;
    } catch (error) {
      logger.warn(`Failed to invalidate L3 cache by pattern ${pattern}:`, error);
    }

    return count;
  }

  /**
   * Invalidate by tags
   */
  private async invalidateByTags(tags: string[]): Promise<number> {
    let count = 0;

    // L1 cache tag matching
    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.l1Cache.delete(key);
        count++;
      }
    }

    // L3 cache tag matching
    try {
      const query = `DELETE FROM ${this.config.l3.tableName} WHERE tags && $1`;
      await connectionManager.executeQuery(query, [tags]);
      count++;
    } catch (error) {
      logger.warn(`Failed to invalidate L3 cache by tags ${tags.join(', ')}:`, error);
    }

    return count;
  }

  /**
   * Simple pattern matching
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(key);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectAndEmitMetrics();
    }, this.config.analytics.metricsInterval);

    logger.info(`📊 Cache metrics collection started (interval: ${this.config.analytics.metricsInterval}ms)`);
  }

  /**
   * Collect and emit metrics
   */
  private collectAndEmitMetrics(): void {
    // Update L1 cache size
    this.metrics.l1.size = this.l1Cache.size;

    // Calculate throughput
    const totalOperations = this.metrics.l1.hits + this.metrics.l1.misses +
                           this.metrics.l2.operations + this.metrics.l3.hits + this.metrics.l3.misses;
    this.metrics.overall.throughput = totalOperations / (this.config.analytics.metricsInterval / 1000);

    // Check performance thresholds
    this.checkPerformanceThresholds();

    // Emit metrics event
    this.emit('cache:metrics', this.metrics);

    // Log metrics periodically
    if (Date.now() % (5 * 60 * 1000) < this.config.analytics.metricsInterval) { // Every 5 minutes
      this.logMetrics();
    }
  }

  /**
   * Check performance thresholds and emit warnings
   */
  private checkPerformanceThresholds(): void {
    const thresholds = this.config.analytics.performanceThresholds;

    if (this.metrics.l1.hitRate < thresholds.l1HitRate * 100) {
      this.emit('cache:performance_warning', 'l1_hit_rate_low', this.metrics.l1.hitRate);
    }

    if (this.metrics.l2.hitRate < thresholds.l2HitRate * 100) {
      this.emit('cache:performance_warning', 'l2_hit_rate_low', this.metrics.l2.hitRate);
    }

    if (this.metrics.overall.avgResponseTime > thresholds.avgResponseTime) {
      this.emit('cache:performance_warning', 'response_time_high', this.metrics.overall.avgResponseTime);
    }
  }

  /**
   * Log cache metrics
   */
  private logMetrics(): void {
    logger.info('📊 Cache Metrics:', {
      l1: {
        hitRate: `${this.metrics.l1.hitRate.toFixed(2)}%`,
        size: `${this.metrics.l1.size}/${this.metrics.l1.maxSize}`,
        evictions: this.metrics.l1.evictions
      },
      l2: {
        hitRate: `${this.metrics.l2.hitRate.toFixed(2)}%`,
        operations: this.metrics.l2.operations,
        errors: this.metrics.l2.errors
      },
      l3: {
        hitRate: `${this.metrics.l3.hitRate.toFixed(2)}%`,
        size: this.metrics.l3.size
      },
      overall: {
        hitRate: `${this.metrics.overall.overallHitRate.toFixed(2)}%`,
        avgResponseTime: `${this.metrics.overall.avgResponseTime.toFixed(2)}ms`,
        throughput: `${this.metrics.overall.throughput.toFixed(2)} ops/sec`
      }
    });
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache configuration
   */
  getConfiguration(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    const span = this.tracer.startSpan('cache_clear_all', {
      kind: SpanKind.INTERNAL
    });

    try {
      // Clear L1 cache
      this.l1Cache.clear();

      // Clear L2 cache (Redis)
      const redisClient = enterpriseRedisManager.getClient();
      if (redisClient) {
        const pattern = this.config.l2.keyPrefix + '*';
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }

      // Clear L3 cache
      const query = `TRUNCATE TABLE ${this.config.l3.tableName}`;
      await connectionManager.executeQuery(query);

      // Reset metrics
      this.initializeMetrics();

      span.setStatus({ code: SpanStatusCode.OK });
      this.emit('cache:cleared_all');

      logger.info('🧹 All cache levels cleared');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Failed to clear all caches:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down Advanced Cache Manager...');

    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Stop warming tasks
    for (const task of this.warmingTasks.values()) {
      clearInterval(task);
    }
    this.warmingTasks.clear();

    // Clear L1 cache
    this.l1Cache.clear();

    this.isInitialized = false;
    this.emit('cache:shutdown');

    logger.info('✅ Advanced Cache Manager shutdown completed');
  }
}

// Export singleton instance
export const advancedCacheManager = AdvancedCacheManager.getInstance();
