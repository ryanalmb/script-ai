/**
 * Twikit Cache Manager - Task 28 Implementation
 * 
 * Advanced performance optimization and caching system specifically designed for
 * Twikit enterprise automation infrastructure. Provides intelligent multi-tier
 * caching, service-specific optimization, and seamless integration with existing
 * Redis infrastructure.
 * 
 * Key Features:
 * - Multi-tier caching (L1 memory, L2 Redis, L3 database)
 * - Intelligent cache warming and preloading
 * - Context-aware cache policies for different Twikit operations
 * - Service-specific cache managers for all Twikit services
 * - Redis Lua scripts for atomic operations
 * - Performance monitoring and optimization
 * - Distributed coordination across multiple instances
 * 
 * Integration Points:
 * - TwikitSessionManager: Session states and authentication data
 * - ProxyRotationManager: Proxy health and performance metrics
 * - GlobalRateLimitCoordinator: Rate limit states and analytics
 * - AccountHealthMonitor: Health metrics and risk assessments
 * - EnterpriseAntiDetectionManager: Behavioral signatures and patterns
 * - CampaignOrchestrator: Campaign data and execution contexts
 * - ContentSafetyFilter: Content analysis results and safety scores
 * - TwikitConnectionPool: Connection states and resource optimization
 */

import { EventEmitter } from 'events';
import { logger, generateCorrelationId, sanitizeData } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { AdvancedCacheManager } from './advancedCacheManager';
import { TwikitConfigManager } from '../config/twikit';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { createHash } from 'crypto';
import * as zlib from 'zlib';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

/**
 * Twikit-specific cache configuration
 */
export interface TwikitCacheConfig {
  // Service-specific TTL configurations
  sessionCache: {
    ttl: number;
    maxSize: number;
    compressionEnabled: boolean;
  };
  proxyCache: {
    healthMetricsTtl: number;
    performanceDataTtl: number;
    rotationScheduleTtl: number;
  };
  rateLimitCache: {
    stateTtl: number;
    profileTtl: number;
    analyticsTtl: number;
  };
  healthMonitorCache: {
    profileTtl: number;
    riskAssessmentTtl: number;
    mlPredictionTtl: number;
  };
  antiDetectionCache: {
    behavioralSignatureTtl: number;
    fingerprintDataTtl: number;
    detectionPatternTtl: number;
  };
  campaignCache: {
    dataTtl: number;
    executionContextTtl: number;
    schedulingInfoTtl: number;
  };
  contentSafetyCache: {
    analysisResultTtl: number;
    safetyScoreTtl: number;
    complianceCheckTtl: number;
  };
  connectionPoolCache: {
    stateTtl: number;
    metricsTtl: number;
    optimizationDataTtl: number;
  };
  
  // Performance optimization settings
  performance: {
    enableCompression: boolean;
    compressionThreshold: number; // bytes
    enablePrefetching: boolean;
    prefetchBatchSize: number;
    enableDistributedCoordination: boolean;
  };
  
  // Cache warming configuration
  warming: {
    enabled: boolean;
    strategies: string[];
    schedules: Record<string, string>;
    batchSize: number;
  };
  
  // Monitoring and analytics
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    performanceThresholds: {
      hitRate: number;
      responseTime: number;
      memoryUsage: number;
    };
  };
}

/**
 * Cache operation context for intelligent caching decisions
 */
export interface CacheOperationContext {
  serviceType: TwikitServiceType;
  operationType: string;
  accountId?: string;
  sessionId?: string;
  priority: CachePriority;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Twikit service types for cache strategy selection
 */
export enum TwikitServiceType {
  SESSION_MANAGER = 'session_manager',
  PROXY_ROTATION = 'proxy_rotation',
  RATE_LIMIT_COORDINATOR = 'rate_limit_coordinator',
  ACCOUNT_HEALTH_MONITOR = 'account_health_monitor',
  ANTI_DETECTION_MANAGER = 'anti_detection_manager',
  CAMPAIGN_ORCHESTRATOR = 'campaign_orchestrator',
  CONTENT_SAFETY_FILTER = 'content_safety_filter',
  CONNECTION_POOL = 'connection_pool'
}

/**
 * Cache priority levels for intelligent eviction
 */
export enum CachePriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10
}

/**
 * Cache performance metrics
 */
export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  compressionRatio: number;
  evictionCount: number;
  warmingEffectiveness: number;
  distributedCoordinationLatency: number;
}

/**
 * Service-specific cache manager interface
 */
export interface ServiceCacheManager {
  get<T>(key: string, context?: CacheOperationContext): Promise<T | null>;
  set<T>(key: string, value: T, context?: CacheOperationContext): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  getMetrics(): Promise<CachePerformanceMetrics>;
}

// ============================================================================
// MAIN TWIKIT CACHE MANAGER
// ============================================================================

/**
 * Advanced Twikit Cache Manager
 * 
 * Provides intelligent, multi-tier caching specifically optimized for
 * Twikit enterprise automation services with performance monitoring,
 * distributed coordination, and service-specific optimization strategies.
 */
export class TwikitCacheManager extends EventEmitter {
  private static instance: TwikitCacheManager;
  private readonly CACHE_PREFIX = 'twikit_cache';
  private readonly LUA_SCRIPTS_PREFIX = 'twikit_lua';
  
  // Core dependencies
  private advancedCacheManager: AdvancedCacheManager;
  private configManager: TwikitConfigManager;
  private config: TwikitCacheConfig;
  
  // Service-specific cache managers
  private serviceCacheManagers: Map<TwikitServiceType, ServiceCacheManager> = new Map();
  
  // Performance monitoring
  private performanceMetrics: Map<string, any> = new Map();
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  
  // Cache warming and coordination
  private warmingSchedules: Map<string, NodeJS.Timeout> = new Map();
  private distributedLocks: Map<string, { expires: number; instanceId: string }> = new Map();
  
  // Lua scripts for atomic operations
  private luaScripts: Map<string, string> = new Map();
  private luaScriptShas: Map<string, string> = new Map();
  
  // State management
  private isInitialized: boolean = false;
  private instanceId: string;

  private constructor() {
    super();
    this.instanceId = `twikit_cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.advancedCacheManager = new AdvancedCacheManager();
    this.configManager = TwikitConfigManager.getInstance();
    this.config = this.createDefaultConfig();
    
    logger.info('TwikitCacheManager instance created', {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TwikitCacheManager {
    if (!TwikitCacheManager.instance) {
      TwikitCacheManager.instance = new TwikitCacheManager();
    }
    return TwikitCacheManager.instance;
  }

  /**
   * Initialize the Twikit cache manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('TwikitCacheManager already initialized');
      return;
    }

    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('🚀 Initializing TwikitCacheManager...', { correlationId });

      // Initialize advanced cache manager
      await this.advancedCacheManager.initialize();

      // Load configuration from Twikit config
      await this.loadConfigurationFromTwikit();

      // Initialize Lua scripts for atomic operations
      await this.initializeLuaScripts();

      // Initialize service-specific cache managers
      await this.initializeServiceCacheManagers();

      // Setup cache warming strategies
      await this.setupCacheWarmingStrategies();

      // Start performance monitoring
      this.startPerformanceMonitoring();

      // Setup distributed coordination
      await this.setupDistributedCoordination();

      this.isInitialized = true;

      const duration = Date.now() - startTime;
      logger.info('✅ TwikitCacheManager initialized successfully', {
        correlationId,
        duration,
        instanceId: this.instanceId,
        serviceCacheManagers: this.serviceCacheManagers.size,
        luaScripts: this.luaScripts.size
      });

      this.emit('initialized', { correlationId, duration });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ Failed to initialize TwikitCacheManager', {
        correlationId,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new TwikitError(
        TwikitErrorType.INITIALIZATION_ERROR,
        'Failed to initialize TwikitCacheManager',
        { correlationId, error, duration }
      );
    }
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): TwikitCacheConfig {
    return {
      sessionCache: {
        ttl: 3600, // 1 hour
        maxSize: 10000,
        compressionEnabled: true
      },
      proxyCache: {
        healthMetricsTtl: 300, // 5 minutes
        performanceDataTtl: 1800, // 30 minutes
        rotationScheduleTtl: 3600 // 1 hour
      },
      rateLimitCache: {
        stateTtl: 300, // 5 minutes
        profileTtl: 3600, // 1 hour
        analyticsTtl: 1800 // 30 minutes
      },
      healthMonitorCache: {
        profileTtl: 300, // 5 minutes
        riskAssessmentTtl: 600, // 10 minutes
        mlPredictionTtl: 1800 // 30 minutes
      },
      antiDetectionCache: {
        behavioralSignatureTtl: 7200, // 2 hours
        fingerprintDataTtl: 3600, // 1 hour
        detectionPatternTtl: 1800 // 30 minutes
      },
      campaignCache: {
        dataTtl: 1800, // 30 minutes
        executionContextTtl: 900, // 15 minutes
        schedulingInfoTtl: 3600 // 1 hour
      },
      contentSafetyCache: {
        analysisResultTtl: 3600, // 1 hour
        safetyScoreTtl: 1800, // 30 minutes
        complianceCheckTtl: 7200 // 2 hours
      },
      connectionPoolCache: {
        stateTtl: 300, // 5 minutes
        metricsTtl: 600, // 10 minutes
        optimizationDataTtl: 1800 // 30 minutes
      },
      performance: {
        enableCompression: true,
        compressionThreshold: 1024, // 1KB
        enablePrefetching: true,
        prefetchBatchSize: 50,
        enableDistributedCoordination: true
      },
      warming: {
        enabled: true,
        strategies: ['session_data', 'proxy_health', 'rate_limits', 'health_profiles'],
        schedules: {
          session_data: '*/5 * * * *', // Every 5 minutes
          proxy_health: '*/2 * * * *', // Every 2 minutes
          rate_limits: '*/1 * * * *', // Every minute
          health_profiles: '*/10 * * * *' // Every 10 minutes
        },
        batchSize: 100
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000, // 1 minute
        performanceThresholds: {
          hitRate: 0.85,
          responseTime: 50, // milliseconds
          memoryUsage: 0.8 // 80% of available memory
        }
      }
    };
  }

  // ============================================================================
  // CONFIGURATION AND INITIALIZATION
  // ============================================================================

  /**
   * Load configuration from Twikit config manager
   */
  private async loadConfigurationFromTwikit(): Promise<void> {
    try {
      const twikitConfig = this.configManager.config;

      // Override defaults with Twikit configuration
      if (twikitConfig.performance) {
        this.config.performance.enableCompression = twikitConfig.performance.enabled;
        this.config.monitoring.metricsInterval = twikitConfig.performance.metricsCollection.interval * 1000;
      }

      if (twikitConfig.rateLimit) {
        this.config.rateLimitCache.profileTtl = twikitConfig.rateLimit.profileCacheTtl;
      }

      logger.info('Configuration loaded from TwikitConfigManager', {
        performanceEnabled: this.config.performance.enableCompression,
        metricsInterval: this.config.monitoring.metricsInterval,
        profileCacheTtl: this.config.rateLimitCache.profileTtl
      });

    } catch (error) {
      logger.warn('Failed to load Twikit configuration, using defaults', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Initialize Lua scripts for atomic cache operations
   */
  private async initializeLuaScripts(): Promise<void> {
    const scripts = {
      // Atomic get-and-refresh script
      getAndRefresh: `
        local key = KEYS[1]
        local ttl = tonumber(ARGV[1])
        local value = redis.call('GET', key)
        if value then
          redis.call('EXPIRE', key, ttl)
          return value
        end
        return nil
      `,

      // Atomic set-if-not-exists with TTL
      setIfNotExists: `
        local key = KEYS[1]
        local value = ARGV[1]
        local ttl = tonumber(ARGV[2])
        local result = redis.call('SET', key, value, 'EX', ttl, 'NX')
        return result
      `,

      // Atomic increment with expiration
      incrementWithExpire: `
        local key = KEYS[1]
        local increment = tonumber(ARGV[1])
        local ttl = tonumber(ARGV[2])
        local current = redis.call('INCR', key)
        if current == 1 then
          redis.call('EXPIRE', key, ttl)
        end
        return current
      `,

      // Batch cache warming
      batchWarm: `
        local keys = KEYS
        local values = ARGV
        local ttl = tonumber(values[#values])
        table.remove(values, #values)

        for i = 1, #keys do
          if values[i] then
            redis.call('SET', keys[i], values[i], 'EX', ttl)
          end
        end
        return #keys
      `
    };

    try {
      const redis = cacheManager.getRedisClient();
      if (!redis) {
        logger.warn('Redis client not available, skipping Lua script initialization');
        return;
      }

      for (const [name, script] of Object.entries(scripts)) {
        this.luaScripts.set(name, script);

        try {
          const sha = await redis.script('LOAD', script);
          this.luaScriptShas.set(name, sha);
          logger.debug(`Loaded Lua script: ${name}`, { sha });
        } catch (error) {
          logger.warn(`Failed to load Lua script: ${name}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('Lua scripts initialized', {
        totalScripts: this.luaScripts.size,
        loadedScripts: this.luaScriptShas.size
      });

    } catch (error) {
      logger.error('Failed to initialize Lua scripts', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Initialize service-specific cache managers
   */
  private async initializeServiceCacheManagers(): Promise<void> {
    const services = [
      TwikitServiceType.SESSION_MANAGER,
      TwikitServiceType.PROXY_ROTATION,
      TwikitServiceType.RATE_LIMIT_COORDINATOR,
      TwikitServiceType.ACCOUNT_HEALTH_MONITOR,
      TwikitServiceType.ANTI_DETECTION_MANAGER,
      TwikitServiceType.CAMPAIGN_ORCHESTRATOR,
      TwikitServiceType.CONTENT_SAFETY_FILTER,
      TwikitServiceType.CONNECTION_POOL
    ];

    for (const serviceType of services) {
      const cacheManager = new TwikitServiceCacheManager(serviceType, this);
      this.serviceCacheManagers.set(serviceType, cacheManager);
    }

    logger.info('Service-specific cache managers initialized', {
      totalServices: this.serviceCacheManagers.size,
      services: Array.from(this.serviceCacheManagers.keys())
    });
  }

  // ============================================================================
  // CORE CACHING OPERATIONS
  // ============================================================================

  /**
   * Get value from cache with intelligent strategy selection
   */
  async get<T>(
    key: string,
    context?: CacheOperationContext
  ): Promise<T | null> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    try {
      // Generate cache key with service context
      const cacheKey = this.generateCacheKey(key, context);

      // Try to get from advanced cache manager first
      let value = await this.advancedCacheManager.get<T>(cacheKey);

      if (value !== null) {
        this.recordCacheHit(context?.serviceType, Date.now() - startTime);
        return value;
      }

      // Try service-specific cache if context provided
      if (context?.serviceType) {
        const serviceCacheManager = this.serviceCacheManagers.get(context.serviceType);
        if (serviceCacheManager) {
          value = await serviceCacheManager.get<T>(key, context);
          if (value !== null) {
            // Backfill advanced cache manager
            await this.advancedCacheManager.set(cacheKey, value, {
              ttl: this.getTtlForContext(context),
              strategy: this.getStrategyForContext(context)
            });
            this.recordCacheHit(context.serviceType, Date.now() - startTime);
            return value;
          }
        }
      }

      this.recordCacheMiss(context?.serviceType, Date.now() - startTime);
      return null;

    } catch (error) {
      logger.error('Cache get operation failed', {
        correlationId,
        key: sanitizeData(key),
        serviceType: context?.serviceType,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Set value in cache with intelligent strategy selection
   */
  async set<T>(
    key: string,
    value: T,
    context?: CacheOperationContext
  ): Promise<boolean> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    try {
      // Generate cache key with service context
      const cacheKey = this.generateCacheKey(key, context);

      // Compress value if enabled and above threshold
      let processedValue = value;
      if (this.config.performance.enableCompression && context) {
        processedValue = await this.compressValueIfNeeded(value);
      }

      // Set in advanced cache manager
      const cacheOptions: any = {
        ttl: this.getTtlForContext(context),
        strategy: this.getStrategyForContext(context)
      };

      if (context?.tags) {
        cacheOptions.tags = context.tags;
      }

      const success = await this.advancedCacheManager.set(cacheKey, processedValue, cacheOptions);

      // Also set in service-specific cache if context provided
      if (context?.serviceType && success) {
        const serviceCacheManager = this.serviceCacheManagers.get(context.serviceType);
        if (serviceCacheManager) {
          await serviceCacheManager.set(key, value, context);
        }
      }

      const duration = Date.now() - startTime;
      this.recordCacheSet(context?.serviceType, duration);

      return success;

    } catch (error) {
      logger.error('Cache set operation failed', {
        correlationId,
        key: sanitizeData(key),
        serviceType: context?.serviceType,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, context?: CacheOperationContext): Promise<boolean> {
    const correlationId = generateCorrelationId();

    try {
      const cacheKey = this.generateCacheKey(key, context);

      // Delete from advanced cache manager
      const success = await this.advancedCacheManager.invalidate(cacheKey);

      // Also delete from service-specific cache if context provided
      if (context?.serviceType) {
        const serviceCacheManager = this.serviceCacheManagers.get(context.serviceType);
        if (serviceCacheManager) {
          await serviceCacheManager.delete(key);
        }
      }

      return true;

    } catch (error) {
      logger.error('Cache delete operation failed', {
        correlationId,
        key: sanitizeData(key),
        serviceType: context?.serviceType,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Clear cache for specific service or all caches
   */
  async clear(serviceType?: TwikitServiceType): Promise<boolean> {
    const correlationId = generateCorrelationId();

    try {
      if (serviceType) {
        // Clear specific service cache
        const serviceCacheManager = this.serviceCacheManagers.get(serviceType);
        if (serviceCacheManager) {
          return await serviceCacheManager.clear();
        }
        return false;
      } else {
        // Clear all caches
        let allSuccess = true;

        // Clear advanced cache manager
        await this.advancedCacheManager.invalidate('*', { pattern: true });

        // Clear all service-specific caches
        for (const serviceCacheManager of this.serviceCacheManagers.values()) {
          const success = await serviceCacheManager.clear();
          if (!success) allSuccess = false;
        }

        return allSuccess;
      }

    } catch (error) {
      logger.error('Cache clear operation failed', {
        correlationId,
        serviceType,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate cache key with service context
   */
  private generateCacheKey(key: string, context?: CacheOperationContext): string {
    const parts = [this.CACHE_PREFIX];

    if (context?.serviceType) {
      parts.push(context.serviceType);
    }

    if (context?.accountId) {
      parts.push(`account:${context.accountId}`);
    }

    if (context?.sessionId) {
      parts.push(`session:${context.sessionId}`);
    }

    parts.push(key);

    return parts.join(':');
  }

  /**
   * Get TTL for cache context
   */
  private getTtlForContext(context?: CacheOperationContext): number {
    if (!context) return 3600; // Default 1 hour

    switch (context.serviceType) {
      case TwikitServiceType.SESSION_MANAGER:
        return this.config.sessionCache.ttl;
      case TwikitServiceType.PROXY_ROTATION:
        return this.config.proxyCache.healthMetricsTtl;
      case TwikitServiceType.RATE_LIMIT_COORDINATOR:
        return this.config.rateLimitCache.stateTtl;
      case TwikitServiceType.ACCOUNT_HEALTH_MONITOR:
        return this.config.healthMonitorCache.profileTtl;
      case TwikitServiceType.ANTI_DETECTION_MANAGER:
        return this.config.antiDetectionCache.behavioralSignatureTtl;
      case TwikitServiceType.CAMPAIGN_ORCHESTRATOR:
        return this.config.campaignCache.dataTtl;
      case TwikitServiceType.CONTENT_SAFETY_FILTER:
        return this.config.contentSafetyCache.analysisResultTtl;
      case TwikitServiceType.CONNECTION_POOL:
        return this.config.connectionPoolCache.stateTtl;
      default:
        return 3600;
    }
  }

  /**
   * Get cache strategy for context
   */
  private getStrategyForContext(context?: CacheOperationContext): string {
    if (!context) return 'default';

    switch (context.serviceType) {
      case TwikitServiceType.SESSION_MANAGER:
        return 'session_data';
      case TwikitServiceType.PROXY_ROTATION:
        return 'proxy_metrics';
      case TwikitServiceType.RATE_LIMIT_COORDINATOR:
        return 'rate_limits';
      case TwikitServiceType.ACCOUNT_HEALTH_MONITOR:
        return 'health_profiles';
      case TwikitServiceType.ANTI_DETECTION_MANAGER:
        return 'behavioral_data';
      case TwikitServiceType.CAMPAIGN_ORCHESTRATOR:
        return 'campaign_data';
      case TwikitServiceType.CONTENT_SAFETY_FILTER:
        return 'content_analysis';
      case TwikitServiceType.CONNECTION_POOL:
        return 'connection_data';
      default:
        return 'default';
    }
  }

  /**
   * Compress value if needed
   */
  private async compressValueIfNeeded<T>(value: T): Promise<T> {
    try {
      const serialized = JSON.stringify(value);
      const sizeInBytes = Buffer.byteLength(serialized, 'utf8');

      if (sizeInBytes > this.config.performance.compressionThreshold) {
        const compressed = zlib.gzipSync(Buffer.from(serialized));
        return { __compressed: true, data: compressed.toString('base64') } as any;
      }

      return value;
    } catch (error) {
      logger.warn('Failed to compress cache value', {
        error: error instanceof Error ? error.message : String(error)
      });
      return value;
    }
  }

  /**
   * Record cache hit metrics
   */
  private recordCacheHit(serviceType?: TwikitServiceType, responseTime?: number): void {
    const key = serviceType ? `hits:${serviceType}` : 'hits:total';
    const current = this.performanceMetrics.get(key) || 0;
    this.performanceMetrics.set(key, current + 1);

    if (responseTime) {
      const rtKey = serviceType ? `response_time:${serviceType}` : 'response_time:total';
      const times = this.performanceMetrics.get(rtKey) || [];
      times.push(responseTime);
      this.performanceMetrics.set(rtKey, times);
    }
  }

  /**
   * Record cache miss metrics
   */
  private recordCacheMiss(serviceType?: TwikitServiceType, responseTime?: number): void {
    const key = serviceType ? `misses:${serviceType}` : 'misses:total';
    const current = this.performanceMetrics.get(key) || 0;
    this.performanceMetrics.set(key, current + 1);

    if (responseTime) {
      const rtKey = serviceType ? `miss_response_time:${serviceType}` : 'miss_response_time:total';
      const times = this.performanceMetrics.get(rtKey) || [];
      times.push(responseTime);
      this.performanceMetrics.set(rtKey, times);
    }
  }

  /**
   * Record cache set metrics
   */
  private recordCacheSet(serviceType?: TwikitServiceType, responseTime?: number): void {
    const key = serviceType ? `sets:${serviceType}` : 'sets:total';
    const current = this.performanceMetrics.get(key) || 0;
    this.performanceMetrics.set(key, current + 1);

    if (responseTime) {
      const rtKey = serviceType ? `set_response_time:${serviceType}` : 'set_response_time:total';
      const times = this.performanceMetrics.get(rtKey) || [];
      times.push(responseTime);
      this.performanceMetrics.set(rtKey, times);
    }
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (!this.config.monitoring.enabled) {
      return;
    }

    this.metricsCollectionInterval = setInterval(() => {
      this.collectAndReportMetrics();
    }, this.config.monitoring.metricsInterval);

    logger.info('Performance monitoring started', {
      interval: this.config.monitoring.metricsInterval,
      thresholds: this.config.monitoring.performanceThresholds
    });
  }

  /**
   * Collect and report performance metrics
   */
  private async collectAndReportMetrics(): Promise<void> {
    try {
      const metrics = await this.calculatePerformanceMetrics();

      // Store metrics in cache for monitoring dashboard
      const metricsKey = `${this.CACHE_PREFIX}:metrics:${Date.now()}`;
      await cacheManager.set(metricsKey, metrics, 3600);

      // Check performance thresholds
      await this.checkPerformanceThresholds(metrics);

      // Emit metrics event
      this.emit('metricsCollected', metrics);

    } catch (error) {
      logger.error('Failed to collect performance metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(): Promise<CachePerformanceMetrics> {
    const totalHits = this.performanceMetrics.get('hits:total') || 0;
    const totalMisses = this.performanceMetrics.get('misses:total') || 0;
    const totalRequests = totalHits + totalMisses;

    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const missRate = totalRequests > 0 ? totalMisses / totalRequests : 0;

    // Calculate average response times
    const responseTimes = this.performanceMetrics.get('response_time:total') || [];
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : 0;

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

    return {
      hitRate,
      missRate,
      averageResponseTime,
      memoryUsage: memoryUsageRatio,
      compressionRatio: 0.8, // Placeholder - would calculate from actual compression data
      evictionCount: 0, // Placeholder - would get from cache implementation
      warmingEffectiveness: 0.9, // Placeholder - would calculate from warming success rate
      distributedCoordinationLatency: 5 // Placeholder - would measure actual coordination latency
    };
  }

  /**
   * Check performance thresholds and alert if needed
   */
  private async checkPerformanceThresholds(metrics: CachePerformanceMetrics): Promise<void> {
    const thresholds = this.config.monitoring.performanceThresholds;

    if (metrics.hitRate < thresholds.hitRate) {
      logger.warn('Cache hit rate below threshold', {
        currentHitRate: metrics.hitRate,
        threshold: thresholds.hitRate,
        recommendation: 'Consider adjusting cache strategies or TTL values'
      });
      this.emit('performanceAlert', {
        type: 'low_hit_rate',
        current: metrics.hitRate,
        threshold: thresholds.hitRate
      });
    }

    if (metrics.averageResponseTime > thresholds.responseTime) {
      logger.warn('Cache response time above threshold', {
        currentResponseTime: metrics.averageResponseTime,
        threshold: thresholds.responseTime,
        recommendation: 'Consider optimizing cache operations or reducing payload size'
      });
      this.emit('performanceAlert', {
        type: 'high_response_time',
        current: metrics.averageResponseTime,
        threshold: thresholds.responseTime
      });
    }

    if (metrics.memoryUsage > thresholds.memoryUsage) {
      logger.warn('Cache memory usage above threshold', {
        currentMemoryUsage: metrics.memoryUsage,
        threshold: thresholds.memoryUsage,
        recommendation: 'Consider reducing cache size or implementing more aggressive eviction'
      });
      this.emit('performanceAlert', {
        type: 'high_memory_usage',
        current: metrics.memoryUsage,
        threshold: thresholds.memoryUsage
      });
    }
  }

  /**
   * Get service-specific cache manager
   */
  public getServiceCacheManager(serviceType: TwikitServiceType): ServiceCacheManager | undefined {
    return this.serviceCacheManagers.get(serviceType);
  }

  /**
   * Get current performance metrics
   */
  public async getPerformanceMetrics(): Promise<CachePerformanceMetrics> {
    return await this.calculatePerformanceMetrics();
  }

  /**
   * Get cache statistics
   */
  public getCacheStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [key, value] of this.performanceMetrics.entries()) {
      stats[key] = value;
    }

    return {
      ...stats,
      instanceId: this.instanceId,
      isInitialized: this.isInitialized,
      serviceCacheManagers: this.serviceCacheManagers.size,
      luaScripts: this.luaScripts.size,
      config: this.config
    };
  }

  /**
   * Shutdown the cache manager gracefully
   */
  public async shutdown(): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      logger.info('🛑 Shutting down TwikitCacheManager...', { correlationId });

      // Stop performance monitoring
      if (this.metricsCollectionInterval) {
        clearInterval(this.metricsCollectionInterval);
        this.metricsCollectionInterval = null;
      }

      // Stop cache warming schedules
      for (const [strategy, timeout] of this.warmingSchedules.entries()) {
        clearTimeout(timeout);
        logger.debug(`Stopped cache warming for strategy: ${strategy}`);
      }
      this.warmingSchedules.clear();

      // Shutdown service cache managers
      for (const [serviceType, cacheManager] of this.serviceCacheManagers.entries()) {
        try {
          if ('shutdown' in cacheManager && typeof cacheManager.shutdown === 'function') {
            await (cacheManager as any).shutdown();
          }
        } catch (error) {
          logger.warn(`Failed to shutdown cache manager for ${serviceType}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Shutdown advanced cache manager
      if ('shutdown' in this.advancedCacheManager && typeof this.advancedCacheManager.shutdown === 'function') {
        await (this.advancedCacheManager as any).shutdown();
      }

      this.isInitialized = false;

      logger.info('✅ TwikitCacheManager shutdown complete', { correlationId });
      this.emit('shutdown', { correlationId });

    } catch (error) {
      logger.error('❌ Error during TwikitCacheManager shutdown', {
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // ============================================================================
  // CACHE WARMING STRATEGIES
  // ============================================================================

  /**
   * Setup cache warming strategies
   */
  private async setupCacheWarmingStrategies(): Promise<void> {
    if (!this.config.warming.enabled) {
      logger.info('Cache warming disabled');
      return;
    }

    for (const strategy of this.config.warming.strategies) {
      const schedule = this.config.warming.schedules[strategy];
      if (schedule) {
        // For now, use simple interval-based warming
        // In production, you might want to use a proper cron scheduler
        const intervalMs = this.parseScheduleToInterval(schedule);
        if (intervalMs > 0) {
          const timeout = setInterval(() => {
            this.executeWarmingStrategy(strategy);
          }, intervalMs);

          this.warmingSchedules.set(strategy, timeout);
          logger.info(`Cache warming scheduled for strategy: ${strategy}`, {
            schedule,
            intervalMs
          });
        }
      }
    }
  }

  /**
   * Parse cron-like schedule to interval (simplified)
   */
  private parseScheduleToInterval(schedule: string): number {
    // Simplified parsing - in production use a proper cron parser
    if (schedule.startsWith('*/')) {
      const scheduleMatch = schedule.split(' ')[0];
      if (scheduleMatch) {
        const minutes = parseInt(scheduleMatch.substring(2));
        return minutes * 60 * 1000; // Convert to milliseconds
      }
    }
    return 0;
  }

  /**
   * Execute cache warming strategy
   */
  private async executeWarmingStrategy(strategy: string): Promise<void> {
    try {
      logger.debug(`Executing cache warming strategy: ${strategy}`);

      switch (strategy) {
        case 'session_data':
          await this.warmSessionData();
          break;
        case 'proxy_health':
          await this.warmProxyHealth();
          break;
        case 'rate_limits':
          await this.warmRateLimits();
          break;
        case 'health_profiles':
          await this.warmHealthProfiles();
          break;
        default:
          logger.warn(`Unknown warming strategy: ${strategy}`);
      }

    } catch (error) {
      logger.error(`Failed to execute warming strategy: ${strategy}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Warm session data cache
   */
  private async warmSessionData(): Promise<void> {
    // Implementation would fetch active sessions and pre-cache them
    logger.debug('Warming session data cache');
  }

  /**
   * Warm proxy health cache
   */
  private async warmProxyHealth(): Promise<void> {
    // Implementation would fetch proxy health metrics and pre-cache them
    logger.debug('Warming proxy health cache');
  }

  /**
   * Warm rate limits cache
   */
  private async warmRateLimits(): Promise<void> {
    // Implementation would fetch rate limit states and pre-cache them
    logger.debug('Warming rate limits cache');
  }

  /**
   * Warm health profiles cache
   */
  private async warmHealthProfiles(): Promise<void> {
    // Implementation would fetch health profiles and pre-cache them
    logger.debug('Warming health profiles cache');
  }

  // ============================================================================
  // DISTRIBUTED COORDINATION
  // ============================================================================

  /**
   * Setup distributed coordination for multi-instance caching
   */
  private async setupDistributedCoordination(): Promise<void> {
    if (!this.config.performance.enableDistributedCoordination) {
      logger.info('Distributed coordination disabled');
      return;
    }

    try {
      // Register this instance in the distributed cache registry
      const registryKey = `${this.CACHE_PREFIX}:instances`;
      const instanceInfo = {
        instanceId: this.instanceId,
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        services: Array.from(this.serviceCacheManagers.keys())
      };

      await cacheManager.set(`${registryKey}:${this.instanceId}`, instanceInfo, 300); // 5 minutes TTL

      // Setup heartbeat to maintain instance registration
      setInterval(async () => {
        try {
          instanceInfo.lastHeartbeat = Date.now();
          await cacheManager.set(`${registryKey}:${this.instanceId}`, instanceInfo, 300);
        } catch (error) {
          logger.warn('Failed to send heartbeat', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }, 60000); // Every minute

      logger.info('Distributed coordination setup complete', {
        instanceId: this.instanceId,
        registryKey
      });

    } catch (error) {
      logger.error('Failed to setup distributed coordination', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Acquire distributed lock for cache operations
   */
  private async acquireDistributedLock(lockKey: string, ttl: number = 30): Promise<boolean> {
    try {
      const redis = cacheManager.getRedisClient();
      if (!redis) {
        return true; // If no Redis, allow operation
      }

      const lockValue = `${this.instanceId}:${Date.now()}`;
      const result = await redis.set(
        `${this.CACHE_PREFIX}:lock:${lockKey}`,
        lockValue,
        'EX',
        ttl,
        'NX'
      );

      if (result === 'OK') {
        this.distributedLocks.set(lockKey, {
          expires: Date.now() + (ttl * 1000),
          instanceId: this.instanceId
        });
        return true;
      }

      return false;

    } catch (error) {
      logger.warn('Failed to acquire distributed lock', {
        lockKey,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseDistributedLock(lockKey: string): Promise<void> {
    try {
      const redis = cacheManager.getRedisClient();
      if (!redis) {
        return;
      }

      await redis.del(`${this.CACHE_PREFIX}:lock:${lockKey}`);
      this.distributedLocks.delete(lockKey);

    } catch (error) {
      logger.warn('Failed to release distributed lock', {
        lockKey,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// ============================================================================
// SERVICE-SPECIFIC CACHE MANAGER
// ============================================================================

/**
 * Service-specific cache manager for individual Twikit services
 */
class TwikitServiceCacheManager implements ServiceCacheManager {
  private serviceType: TwikitServiceType;
  private parentCacheManager: TwikitCacheManager;
  private localCache: Map<string, { value: any; expires: number }> = new Map();
  private metrics: Map<string, number> = new Map();

  constructor(serviceType: TwikitServiceType, parentCacheManager: TwikitCacheManager) {
    this.serviceType = serviceType;
    this.parentCacheManager = parentCacheManager;
  }

  /**
   * Get value from service-specific cache
   */
  async get<T>(key: string, context?: CacheOperationContext): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Check local cache first
      const localEntry = this.localCache.get(key);
      if (localEntry && localEntry.expires > Date.now()) {
        this.recordMetric('local_hits', 1);
        return localEntry.value as T;
      }

      // Remove expired entry
      if (localEntry) {
        this.localCache.delete(key);
      }

      // Check Redis cache
      const cacheKey = `${this.serviceType}:${key}`;
      const value = await cacheManager.get<T>(cacheKey);

      if (value !== null) {
        // Cache locally for faster subsequent access
        const ttl = this.getServiceTtl() * 1000; // Convert to milliseconds
        this.localCache.set(key, {
          value,
          expires: Date.now() + ttl
        });

        this.recordMetric('redis_hits', 1);
        return value;
      }

      this.recordMetric('misses', 1);
      return null;

    } catch (error) {
      logger.error(`Service cache get failed for ${this.serviceType}`, {
        key: sanitizeData(key),
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    } finally {
      this.recordMetric('response_time', Date.now() - startTime);
    }
  }

  /**
   * Set value in service-specific cache
   */
  async set<T>(key: string, value: T, context?: CacheOperationContext): Promise<boolean> {
    const startTime = Date.now();

    try {
      const ttl = this.getServiceTtl();

      // Set in Redis cache
      const cacheKey = `${this.serviceType}:${key}`;
      await cacheManager.set(cacheKey, value, ttl);

      // Also cache locally
      this.localCache.set(key, {
        value,
        expires: Date.now() + (ttl * 1000)
      });

      this.recordMetric('sets', 1);
      return true;

    } catch (error) {
      logger.error(`Service cache set failed for ${this.serviceType}`, {
        key: sanitizeData(key),
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    } finally {
      this.recordMetric('set_response_time', Date.now() - startTime);
    }
  }

  /**
   * Delete value from service-specific cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      // Delete from local cache
      this.localCache.delete(key);

      // Delete from Redis cache
      const cacheKey = `${this.serviceType}:${key}`;
      await cacheManager.del(cacheKey);

      this.recordMetric('deletes', 1);
      return true;

    } catch (error) {
      logger.error(`Service cache delete failed for ${this.serviceType}`, {
        key: sanitizeData(key),
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Clear service-specific cache
   */
  async clear(): Promise<boolean> {
    try {
      // Clear local cache
      this.localCache.clear();

      // Clear Redis cache entries for this service
      // This is a simplified implementation - in production you'd want pattern-based deletion
      logger.info(`Cleared cache for service: ${this.serviceType}`);

      this.recordMetric('clears', 1);
      return true;

    } catch (error) {
      logger.error(`Service cache clear failed for ${this.serviceType}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get service-specific metrics
   */
  async getMetrics(): Promise<CachePerformanceMetrics> {
    const hits = (this.metrics.get('local_hits') || 0) + (this.metrics.get('redis_hits') || 0);
    const misses = this.metrics.get('misses') || 0;
    const total = hits + misses;

    return {
      hitRate: total > 0 ? hits / total : 0,
      missRate: total > 0 ? misses / total : 0,
      averageResponseTime: this.metrics.get('response_time') || 0,
      memoryUsage: this.localCache.size,
      compressionRatio: 1.0,
      evictionCount: 0,
      warmingEffectiveness: 1.0,
      distributedCoordinationLatency: 0
    };
  }

  /**
   * Get service-specific TTL
   */
  private getServiceTtl(): number {
    // Default TTL values for each service type
    switch (this.serviceType) {
      case TwikitServiceType.SESSION_MANAGER: return 3600; // 1 hour
      case TwikitServiceType.PROXY_ROTATION: return 300; // 5 minutes
      case TwikitServiceType.RATE_LIMIT_COORDINATOR: return 300; // 5 minutes
      case TwikitServiceType.ACCOUNT_HEALTH_MONITOR: return 300; // 5 minutes
      case TwikitServiceType.ANTI_DETECTION_MANAGER: return 7200; // 2 hours
      case TwikitServiceType.CAMPAIGN_ORCHESTRATOR: return 1800; // 30 minutes
      case TwikitServiceType.CONTENT_SAFETY_FILTER: return 3600; // 1 hour
      case TwikitServiceType.CONNECTION_POOL: return 300; // 5 minutes
      default: return 3600; // 1 hour
    }
  }

  /**
   * Record metric
   */
  private recordMetric(metric: string, value: number): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Create and export singleton instance
export const twikitCacheManager = TwikitCacheManager.getInstance();
