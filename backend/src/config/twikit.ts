import { config } from './environment';
import {
  logger,
  logAuditTrail,
  generateCorrelationId,
  sanitizeData
} from '../utils/logger';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { cacheManager } from '../lib/cache';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';

// ============================================================================
// COMPREHENSIVE CONFIGURATION INTERFACES
// ============================================================================

/**
 * Environment-specific configuration profiles
 */
type ConfigEnvironment = 'development' | 'staging' | 'production' | 'testing';

/**
 * Account types for rate limiting and behavior customization
 */
type AccountType = 'new' | 'standard' | 'verified' | 'premium' | 'enterprise';

/**
 * Behavior profiles for anti-detection
 */
type BehaviorProfile = 'conservative' | 'moderate' | 'active' | 'aggressive';

/**
 * Proxy pool configuration with enhanced features
 */
interface ProxyPoolConfig {
  enabled: boolean;
  urls: string[];
  username?: string;
  password?: string;
  priority: number; // 1-10, higher = preferred
  maxConcurrentConnections: number;
  healthThreshold: number; // 0-1, minimum health score
  rotationStrategy: 'round_robin' | 'random' | 'health_based' | 'geographic';
  geographicRegions?: string[]; // ['US', 'EU', 'ASIA']
  costPerRequest?: number; // For cost optimization
}

/**
 * Enhanced proxy configuration with intelligent rotation
 */
interface ProxyConfig {
  enableRotation: boolean;
  rotationInterval: number; // seconds
  healthCheckInterval: number; // seconds
  maxFailures: number;
  healthCheckTimeout: number; // seconds
  healthCheckUrls: string[];
  failoverStrategy: 'immediate' | 'gradual' | 'circuit_breaker';
  loadBalancing: {
    algorithm: 'round_robin' | 'least_connections' | 'weighted' | 'ip_hash';
    weights?: Record<string, number>; // pool_name -> weight
  };
  pools: {
    residential: ProxyPoolConfig;
    datacenter: ProxyPoolConfig;
    mobile: ProxyPoolConfig;
  };
  // Advanced features
  stickySession: {
    enabled: boolean;
    duration: number; // seconds to maintain same proxy for account
  };
  geographicDistribution: {
    enabled: boolean;
    preferredRegions: string[];
    avoidRegions: string[];
  };
  costOptimization: {
    enabled: boolean;
    maxCostPerHour: number;
    preferLowerCost: boolean;
  };
}

/**
 * Comprehensive anti-detection configuration
 */
interface AntiDetectionConfig {
  enabled: boolean;
  behaviorProfile: BehaviorProfile;

  // Session management
  sessionDuration: {
    min: number; // seconds
    max: number; // seconds
  };

  // Action timing
  actionDelay: {
    min: number; // seconds
    max: number; // seconds
  };

  // Human-like patterns
  humanBehavior: {
    enabled: boolean;
    mouseMovements: boolean;
    scrollPatterns: boolean;
    readingPauses: boolean;
    typingSpeed: {
      min: number; // chars per minute
      max: number; // chars per minute
    };
  };

  // Fingerprint management
  fingerprinting: {
    enabled: boolean;
    rotationInterval: number; // hours
    userAgentRotation: boolean;
    viewportRandomization: boolean;
    timezoneRandomization: boolean;
    languageRandomization: boolean;
    canvasFingerprintSpoofing: boolean;
  };

  // Detection risk management
  riskManagement: {
    maxRiskScore: number; // 0-1, pause actions if exceeded
    cooldownPeriod: number; // seconds to wait when risk is high
    riskFactors: {
      rapidActions: number; // weight 0-1
      unusualPatterns: number; // weight 0-1
      proxyChanges: number; // weight 0-1
      accountAge: number; // weight 0-1
    };
  };

  // Behavioral patterns
  patterns: {
    dailyActiveHours: {
      start: number; // hour 0-23
      end: number; // hour 0-23
    };
    weeklyPattern: {
      activeDays: number[]; // 0-6, Sunday=0
      intensity: Record<string, number>; // day -> activity level 0-1
    };
    actionSequences: {
      enabled: boolean;
      maxConsecutiveActions: number;
      breakDuration: {
        min: number; // seconds
        max: number; // seconds
      };
    };
  };
}

/**
 * Enhanced session management configuration
 */
interface SessionConfig {
  maxConcurrentSessions: number;
  cleanupInterval: number; // seconds
  healthCheckInterval: number; // seconds
  enablePersistence: boolean;

  // Session lifecycle
  lifecycle: {
    maxIdleTime: number; // seconds before session is considered idle
    maxLifetime: number; // seconds before forced session recreation
    gracefulShutdownTimeout: number; // seconds to wait for graceful shutdown
  };

  // Session pooling
  pooling: {
    enabled: boolean;
    minPoolSize: number;
    maxPoolSize: number;
    warmupSessions: number; // pre-created sessions
  };

  // Session recovery
  recovery: {
    enabled: boolean;
    maxRecoveryAttempts: number;
    recoveryDelay: number; // seconds between recovery attempts
    backupSessionsEnabled: boolean;
  };

  // Performance optimization
  performance: {
    enableSessionReuse: boolean;
    sessionAffinityEnabled: boolean; // stick account to session
    loadBalancing: 'round_robin' | 'least_used' | 'random';
  };

  // Monitoring
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number; // seconds
    alertThresholds: {
      highMemoryUsage: number; // MB
      lowSuccessRate: number; // 0-1
      highErrorRate: number; // 0-1
    };
  };
}

/**
 * Enhanced retry configuration with intelligent strategies
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  exponentialBase: number;
  enableJitter: boolean;

  // Action-specific retry strategies
  actionStrategies: {
    [actionType: string]: {
      maxRetries: number;
      baseDelay: number;
      maxDelay: number;
      backoffStrategy: 'exponential' | 'linear' | 'fixed';
      retryableErrors: string[]; // Error types that should trigger retry
      nonRetryableErrors: string[]; // Error types that should not retry
    };
  };

  // Circuit breaker integration
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number; // failures before opening circuit
    resetTimeout: number; // milliseconds before attempting reset
    monitoringWindow: number; // milliseconds to track failures
  };

  // Retry budgets to prevent infinite loops
  budgets: {
    enabled: boolean;
    maxRetriesPerMinute: number;
    maxRetriesPerHour: number;
    budgetResetInterval: number; // milliseconds
  };

  // Adaptive retry logic
  adaptive: {
    enabled: boolean;
    successRateThreshold: number; // 0-1, adjust delays based on success rate
    adjustmentFactor: number; // multiplier for delay adjustments
    learningWindow: number; // number of attempts to consider for adaptation
  };
}

/**
 * Comprehensive rate limiting configuration
 */
interface RateLimitConfig {
  enabled: boolean;
  distributedCoordination: boolean;
  queueProcessingInterval: number; // milliseconds
  analyticsFlushInterval: number; // milliseconds
  profileCacheTtl: number; // seconds
  lockTtl: number; // seconds
  defaultAccountType: AccountType;
  warmupDurationDays: number;

  // Action-specific rate limits
  actionLimits: {
    [actionType: string]: {
      [accountType in AccountType]: Array<{
        window: string; // '1m', '1h', '1d', etc.
        limit: number;
        burstLimit?: number;
        priority?: number; // 1-10, higher = more important
      }>;
    };
  };

  // Dynamic rate limiting
  dynamic: {
    enabled: boolean;
    adjustmentFactor: number; // 0-1, how much to adjust based on success rate
    minSuccessRate: number; // 0-1, minimum success rate before reducing limits
    maxSuccessRate: number; // 0-1, success rate to increase limits
    adjustmentInterval: number; // seconds between adjustments
  };

  // Account-specific overrides
  customLimits?: {
    [accountId: string]: {
      [action: string]: Array<{
        window: string;
        limit: number;
        burstLimit?: number;
        priority?: number;
      }>;
    };
  };

  // Queue management
  queueManagement: {
    maxQueueSize: number;
    priorityQueues: boolean;
    queueTimeout: number; // seconds
    deadLetterQueue: {
      enabled: boolean;
      maxRetries: number;
      retentionPeriod: number; // seconds
    };
  };

  // Rate limit enforcement
  enforcement: {
    strategy: 'strict' | 'lenient' | 'adaptive';
    gracePeriod: number; // seconds of grace period for new accounts
    penaltyMultiplier: number; // multiplier for rate limits after violations
    penaltyDuration: number; // seconds to apply penalty
  };
}

/**
 * Performance monitoring configuration
 */
interface PerformanceConfig {
  enabled: boolean;
  metricsCollection: {
    interval: number; // seconds
    retentionPeriod: number; // seconds
    aggregationWindow: number; // seconds
  };
  alerting: {
    enabled: boolean;
    thresholds: {
      responseTime: number; // milliseconds
      errorRate: number; // 0-1
      successRate: number; // 0-1
      queueDepth: number; // number of queued requests
    };
  };
  autoTuning: {
    enabled: boolean;
    adjustmentInterval: number; // seconds
    maxAdjustmentPercent: number; // 0-1
    learningPeriod: number; // seconds
  };
}

/**
 * A/B testing configuration
 */
interface ABTestingConfig {
  enabled: boolean;
  experiments: {
    [experimentName: string]: {
      enabled: boolean;
      trafficSplit: number; // 0-1, percentage of traffic for this variant
      configuration: Partial<TwikitConfig>;
      metrics: string[]; // metrics to track for this experiment
      duration: number; // seconds
    };
  };
}

/**
 * Security configuration
 */
interface SecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationInterval: number; // seconds
  };
  accessControl: {
    enabled: boolean;
    allowedIPs: string[];
    blockedIPs: string[];
    rateLimitByIP: boolean;
  };
  auditLogging: {
    enabled: boolean;
    logLevel: 'minimal' | 'standard' | 'detailed';
    retentionPeriod: number; // seconds
  };
}

/**
 * Main Twikit configuration interface
 */
interface TwikitConfig {
  // Core configurations
  proxy: ProxyConfig;
  antiDetection: AntiDetectionConfig;
  session: SessionConfig;
  retry: RetryConfig;
  rateLimit: RateLimitConfig;

  // Advanced configurations
  performance: PerformanceConfig;
  abTesting: ABTestingConfig;
  security: SecurityConfig;

  // Environment and metadata
  environment: ConfigEnvironment;
  version: string;
  lastUpdated: Date;

  // Feature flags
  features: {
    [featureName: string]: boolean;
  };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Zod schema for configuration validation
 */
const ProxyPoolConfigSchema = z.object({
  enabled: z.boolean(),
  urls: z.array(z.string().url()),
  username: z.string().optional(),
  password: z.string().optional(),
  priority: z.number().min(1).max(10).default(5),
  maxConcurrentConnections: z.number().min(1).default(10),
  healthThreshold: z.number().min(0).max(1).default(0.8),
  rotationStrategy: z.enum(['round_robin', 'random', 'health_based', 'geographic']).default('health_based'),
  geographicRegions: z.array(z.string()).optional(),
  costPerRequest: z.number().min(0).optional()
});

const TwikitConfigSchema = z.object({
  proxy: z.object({
    enableRotation: z.boolean(),
    rotationInterval: z.number().min(1),
    healthCheckInterval: z.number().min(1),
    maxFailures: z.number().min(1),
    healthCheckTimeout: z.number().min(1),
    healthCheckUrls: z.array(z.string().url()),
    failoverStrategy: z.enum(['immediate', 'gradual', 'circuit_breaker']).default('gradual'),
    loadBalancing: z.object({
      algorithm: z.enum(['round_robin', 'least_connections', 'weighted', 'ip_hash']).default('round_robin'),
      weights: z.record(z.number()).optional()
    }),
    pools: z.object({
      residential: ProxyPoolConfigSchema,
      datacenter: ProxyPoolConfigSchema,
      mobile: ProxyPoolConfigSchema
    }),
    stickySession: z.object({
      enabled: z.boolean().default(false),
      duration: z.number().min(1).default(3600)
    }),
    geographicDistribution: z.object({
      enabled: z.boolean().default(false),
      preferredRegions: z.array(z.string()).default([]),
      avoidRegions: z.array(z.string()).default([])
    }),
    costOptimization: z.object({
      enabled: z.boolean().default(false),
      maxCostPerHour: z.number().min(0).default(100),
      preferLowerCost: z.boolean().default(true)
    })
  })
  // Additional schema validation will be added in subsequent chunks
});

// ============================================================================
// ENHANCED CONFIGURATION MANAGER
// ============================================================================

/**
 * Enterprise-grade Twikit configuration manager with hot-reload,
 * validation, A/B testing, and comprehensive monitoring capabilities
 */
class TwikitConfigManager extends EventEmitter {
  private static instance: TwikitConfigManager;
  private _config: TwikitConfig;
  private _configHistory: Array<{ timestamp: Date; config: TwikitConfig; correlationId: string }> = [];
  private _abTestingActive: Map<string, any> = new Map();
  private _performanceMetrics: Map<string, any> = new Map();
  private _hotReloadEnabled: boolean = true;
  private _configWatchers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    super();
    this._config = this.createDefaultConfig();
    this.initializeFromEnvironment();
    this.validateConfiguration();
    this.setupHotReload();
    this.startPerformanceMonitoring();
  }

  public static getInstance(): TwikitConfigManager {
    if (!TwikitConfigManager.instance) {
      TwikitConfigManager.instance = new TwikitConfigManager();
    }
    return TwikitConfigManager.instance;
  }

  // ============================================================================
  // CORE CONFIGURATION METHODS
  // ============================================================================

  /**
   * Create default configuration with sensible defaults
   */
  private createDefaultConfig(): TwikitConfig {
    return {
      proxy: {
        enableRotation: true,
        rotationInterval: 300,
        healthCheckInterval: 60,
        maxFailures: 5,
        healthCheckTimeout: 10,
        healthCheckUrls: ['https://httpbin.org/ip', 'https://api.ipify.org?format=json'],
        failoverStrategy: 'gradual',
        loadBalancing: {
          algorithm: 'round_robin',
          weights: {}
        },
        pools: {
          residential: {
            enabled: false,
            urls: [],
            priority: 8,
            maxConcurrentConnections: 10,
            healthThreshold: 0.8,
            rotationStrategy: 'health_based'
          },
          datacenter: {
            enabled: false,
            urls: [],
            priority: 5,
            maxConcurrentConnections: 20,
            healthThreshold: 0.7,
            rotationStrategy: 'round_robin'
          },
          mobile: {
            enabled: false,
            urls: [],
            priority: 9,
            maxConcurrentConnections: 5,
            healthThreshold: 0.9,
            rotationStrategy: 'health_based'
          }
        },
        stickySession: {
          enabled: false,
          duration: 3600
        },
        geographicDistribution: {
          enabled: false,
          preferredRegions: [],
          avoidRegions: []
        },
        costOptimization: {
          enabled: false,
          maxCostPerHour: 100,
          preferLowerCost: true
        }
      },
      antiDetection: {
        enabled: true,
        behaviorProfile: 'moderate',
        sessionDuration: { min: 1800, max: 7200 },
        actionDelay: { min: 1, max: 5 },
        humanBehavior: {
          enabled: true,
          mouseMovements: true,
          scrollPatterns: true,
          readingPauses: true,
          typingSpeed: { min: 200, max: 400 }
        },
        fingerprinting: {
          enabled: true,
          rotationInterval: 24,
          userAgentRotation: true,
          viewportRandomization: true,
          timezoneRandomization: false,
          languageRandomization: false,
          canvasFingerprintSpoofing: true
        },
        riskManagement: {
          maxRiskScore: 0.7,
          cooldownPeriod: 1800,
          riskFactors: {
            rapidActions: 0.3,
            unusualPatterns: 0.2,
            proxyChanges: 0.1,
            accountAge: 0.4
          }
        },
        patterns: {
          dailyActiveHours: { start: 8, end: 22 },
          weeklyPattern: {
            activeDays: [1, 2, 3, 4, 5],
            intensity: { '1': 0.8, '2': 0.9, '3': 0.9, '4': 0.9, '5': 0.7 }
          },
          actionSequences: {
            enabled: true,
            maxConsecutiveActions: 5,
            breakDuration: { min: 30, max: 300 }
          }
        }
      },
      session: {
        maxConcurrentSessions: 50,
        cleanupInterval: 1800,
        healthCheckInterval: 300,
        enablePersistence: true,
        lifecycle: {
          maxIdleTime: 3600,
          maxLifetime: 86400,
          gracefulShutdownTimeout: 30
        },
        pooling: {
          enabled: true,
          minPoolSize: 5,
          maxPoolSize: 100,
          warmupSessions: 10
        },
        recovery: {
          enabled: true,
          maxRecoveryAttempts: 3,
          recoveryDelay: 60,
          backupSessionsEnabled: true
        },
        performance: {
          enableSessionReuse: true,
          sessionAffinityEnabled: true,
          loadBalancing: 'least_used'
        },
        monitoring: {
          enableMetrics: true,
          metricsInterval: 60,
          alertThresholds: {
            highMemoryUsage: 512,
            lowSuccessRate: 0.8,
            highErrorRate: 0.1
          }
        }
      },
      retry: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        exponentialBase: 2,
        enableJitter: true,
        actionStrategies: {},
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          resetTimeout: 60000,
          monitoringWindow: 300000
        },
        budgets: {
          enabled: true,
          maxRetriesPerMinute: 100,
          maxRetriesPerHour: 1000,
          budgetResetInterval: 60000
        },
        adaptive: {
          enabled: true,
          successRateThreshold: 0.8,
          adjustmentFactor: 1.2,
          learningWindow: 100
        }
      },
      rateLimit: {
        enabled: true,
        distributedCoordination: true,
        queueProcessingInterval: 1000,
        analyticsFlushInterval: 60000,
        profileCacheTtl: 3600,
        lockTtl: 300,
        defaultAccountType: 'standard',
        warmupDurationDays: 7,
        actionLimits: {},
        dynamic: {
          enabled: true,
          adjustmentFactor: 0.1,
          minSuccessRate: 0.7,
          maxSuccessRate: 0.95,
          adjustmentInterval: 300
        },
        queueManagement: {
          maxQueueSize: 10000,
          priorityQueues: true,
          queueTimeout: 300,
          deadLetterQueue: {
            enabled: true,
            maxRetries: 3,
            retentionPeriod: 86400
          }
        },
        enforcement: {
          strategy: 'adaptive',
          gracePeriod: 86400,
          penaltyMultiplier: 2,
          penaltyDuration: 3600
        }
      },
      performance: {
        enabled: true,
        metricsCollection: {
          interval: 60,
          retentionPeriod: 604800,
          aggregationWindow: 300
        },
        alerting: {
          enabled: true,
          thresholds: {
            responseTime: 5000,
            errorRate: 0.05,
            successRate: 0.95,
            queueDepth: 1000
          }
        },
        autoTuning: {
          enabled: false,
          adjustmentInterval: 3600,
          maxAdjustmentPercent: 0.2,
          learningPeriod: 86400
        }
      },
      abTesting: {
        enabled: false,
        experiments: {}
      },
      security: {
        encryption: {
          enabled: true,
          algorithm: 'aes-256-gcm',
          keyRotationInterval: 86400
        },
        accessControl: {
          enabled: true,
          allowedIPs: [],
          blockedIPs: [],
          rateLimitByIP: true
        },
        auditLogging: {
          enabled: true,
          logLevel: 'standard',
          retentionPeriod: 2592000
        }
      },
      environment: 'development',
      version: '1.0.0',
      lastUpdated: new Date(),
      features: {
        hotReload: true,
        abTesting: false,
        autoTuning: false,
        advancedMetrics: true
      }
    };
  }

  /**
   * Initialize configuration from environment variables
   */
  private initializeFromEnvironment(): void {
    try {
      const correlationId = generateCorrelationId();

      // Import environment config dynamically to avoid circular dependency
      const envConfig = require('./environment').config;

      // Merge environment configuration with defaults
      if (envConfig.twikit) {
        this._config = this.deepMerge(this._config, envConfig.twikit);
      }

      // Set environment-specific settings
      this._config.environment = (process.env.NODE_ENV as ConfigEnvironment) || 'development';
      this._config.lastUpdated = new Date();

      // Log configuration initialization
      logAuditTrail('config_initialized', 'system', 'twikit_config', {
        correlationId,
        result: 'success',
        metadata: {
          environment: this._config.environment,
          version: this._config.version,
          featuresEnabled: Object.keys(this._config.features).filter(f => this._config.features[f])
        }
      });

    } catch (error) {
      logger.error('Failed to initialize Twikit configuration from environment:', error);
      throw new TwikitError(
        TwikitErrorType.CONFIGURATION_ERROR,
        'Failed to initialize configuration from environment',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Setup hot-reload functionality for configuration updates
   */
  private setupHotReload(): void {
    if (!this._hotReloadEnabled || this._config.environment === 'production') {
      return;
    }

    try {
      // Watch for configuration file changes
      const fs = require('fs');
      const path = require('path');

      const configPath = path.join(__dirname, 'environment.ts');

      if (fs.existsSync(configPath)) {
        const watcher = fs.watchFile(configPath, { interval: 1000 }, () => {
          this.reloadConfiguration();
        });

        this._configWatchers.set('environment', watcher);
        logger.info('Hot-reload enabled for Twikit configuration');
      }
    } catch (error) {
      logger.warn('Failed to setup configuration hot-reload:', error);
    }
  }

  /**
   * Start performance monitoring for configuration system
   */
  private startPerformanceMonitoring(): void {
    if (!this._config.performance.enabled) {
      return;
    }

    const interval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, this._config.performance.metricsCollection.interval * 1000);

    this._configWatchers.set('performance', interval);
    logger.info('Performance monitoring started for Twikit configuration');
  }

  /**
   * Deep merge two configuration objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  public get config(): TwikitConfig {
    return this._config;
  }

  /**
   * Hot-reload configuration from environment
   */
  public async reloadConfiguration(): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      logger.info('Reloading Twikit configuration...', { correlationId });

      // Clear require cache for environment config
      const envPath = require.resolve('./environment');
      delete require.cache[envPath];

      // Reload configuration
      const oldConfig = { ...this._config };
      this.initializeFromEnvironment();
      this.validateConfiguration();

      // Store in history
      this._configHistory.push({
        timestamp: new Date(),
        config: oldConfig,
        correlationId
      });

      // Keep only last 10 configurations in history
      if (this._configHistory.length > 10) {
        this._configHistory.shift();
      }

      // Emit configuration change event
      this.emit('configurationReloaded', {
        correlationId,
        oldConfig: sanitizeData(oldConfig),
        newConfig: sanitizeData(this._config)
      });

      // Log audit trail
      logAuditTrail('config_reloaded', 'system', 'twikit_config', {
        correlationId,
        result: 'success',
        metadata: {
          environment: this._config.environment,
          changesDetected: this.detectConfigChanges(oldConfig, this._config)
        }
      });

      logger.info('Twikit configuration reloaded successfully', { correlationId });

    } catch (error) {
      logger.error('Failed to reload Twikit configuration:', error);

      logAuditTrail('config_reload_failed', 'system', 'twikit_config', {
        correlationId,
        result: 'failure',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw new TwikitError(
        TwikitErrorType.CONFIGURATION_ERROR,
        'Failed to reload configuration',
        { correlationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Collect performance metrics for the configuration system
   */
  private collectPerformanceMetrics(): void {
    try {
      const metrics = {
        timestamp: new Date(),
        configLookups: this._performanceMetrics.get('lookups') || 0,
        configUpdates: this._performanceMetrics.get('updates') || 0,
        validationTime: this._performanceMetrics.get('validationTime') || 0,
        memoryUsage: process.memoryUsage(),
        activeExperiments: this._abTestingActive.size,
        configHistorySize: this._configHistory.length
      };

      // Store metrics in cache for monitoring
      cacheManager.set(`twikit:config:metrics:${Date.now()}`, metrics, 3600);

      // Reset counters
      this._performanceMetrics.clear();

    } catch (error) {
      logger.warn('Failed to collect configuration performance metrics:', error);
    }
  }

  /**
   * Detect changes between two configurations
   */
  private detectConfigChanges(oldConfig: TwikitConfig, newConfig: TwikitConfig): string[] {
    const changes: string[] = [];

    const compareObjects = (obj1: any, obj2: any, path: string = '') => {
      for (const key in obj1) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
          compareObjects(obj1[key], obj2[key], currentPath);
        } else if (obj1[key] !== obj2[key]) {
          changes.push(currentPath);
        }
      }
    };

    compareObjects(oldConfig, newConfig);
    return changes;
  }

  /**
   * Update configuration with comprehensive validation and audit logging
   */
  public async updateConfig(updates: Partial<TwikitConfig>, userId?: string): Promise<void> {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      // Increment performance counter
      this._performanceMetrics.set('updates', (this._performanceMetrics.get('updates') || 0) + 1);

      // Validate updates
      const validationStart = Date.now();
      await this.validateConfigUpdates(updates);
      this._performanceMetrics.set('validationTime', Date.now() - validationStart);

      // Store current config in history
      this._configHistory.push({
        timestamp: new Date(),
        config: { ...this._config },
        correlationId
      });

      // Apply updates with deep merge
      const oldConfig = { ...this._config };
      this._config = this.deepMerge(this._config, updates);
      this._config.lastUpdated = new Date();

      // Validate final configuration
      this.validateConfiguration();

      // Emit configuration change event
      this.emit('configurationUpdated', {
        correlationId,
        userId,
        oldConfig: sanitizeData(oldConfig),
        newConfig: sanitizeData(this._config),
        updates: sanitizeData(updates)
      });

      // Log audit trail
      logAuditTrail('config_updated', userId || 'system', 'twikit_config', {
        correlationId,
        result: 'success',
        metadata: {
          updateKeys: Object.keys(updates),
          environment: this._config.environment,
          executionTime: Date.now() - startTime
        }
      });

      logger.info('Twikit configuration updated successfully', {
        correlationId,
        userId,
        updateKeys: Object.keys(updates),
        executionTime: Date.now() - startTime
      });

    } catch (error) {
      logAuditTrail('config_update_failed', userId || 'system', 'twikit_config', {
        correlationId,
        result: 'failure',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          updateKeys: Object.keys(updates),
          executionTime: Date.now() - startTime
        }
      });

      logger.error('Failed to update Twikit configuration:', error);
      throw error;
    }
  }

  /**
   * Validate configuration updates before applying
   */
  private async validateConfigUpdates(updates: Partial<TwikitConfig>): Promise<void> {
    try {
      // Use Zod schema for validation (partial validation for updates)
      // This is a simplified validation - full schema would be more comprehensive

      if (updates.proxy) {
        if (updates.proxy.rotationInterval && updates.proxy.rotationInterval < 1) {
          throw new Error('Proxy rotation interval must be at least 1 second');
        }

        if (updates.proxy.maxFailures && updates.proxy.maxFailures < 1) {
          throw new Error('Max failures must be at least 1');
        }
      }

      if (updates.antiDetection) {
        if (updates.antiDetection.sessionDuration) {
          const { min, max } = updates.antiDetection.sessionDuration;
          if (min && max && min >= max) {
            throw new Error('Session duration minimum must be less than maximum');
          }
        }
      }

      if (updates.rateLimit) {
        if (updates.rateLimit.queueProcessingInterval && updates.rateLimit.queueProcessingInterval < 100) {
          throw new Error('Queue processing interval must be at least 100ms');
        }
      }

    } catch (error) {
      throw new TwikitError(
        TwikitErrorType.VALIDATION_ERROR,
        `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { updates }
      );
    }
  }

  /**
   * Get proxy configuration for a specific pool type
   */
  public getProxyPoolConfig(poolType: 'residential' | 'datacenter' | 'mobile'): ProxyPoolConfig {
    this._performanceMetrics.set('lookups', (this._performanceMetrics.get('lookups') || 0) + 1);
    return this._config.proxy.pools[poolType];
  }

  /**
   * Get all enabled proxy pools
   */
  public getEnabledProxyPools(): Array<{ type: string; config: ProxyPoolConfig }> {
    const pools = [];
    
    for (const [type, poolConfig] of Object.entries(this._config.proxy.pools)) {
      if (poolConfig.enabled && poolConfig.urls.length > 0) {
        pools.push({ type, config: poolConfig });
      }
    }
    
    return pools;
  }

  /**
   * Check if proxy rotation is enabled and configured
   */
  public isProxyRotationEnabled(): boolean {
    return this._config.proxy.enableRotation && this.getEnabledProxyPools().length > 0;
  }

  /**
   * Get session configuration with runtime adjustments
   */
  public getSessionConfig(): SessionConfig {
    return {
      ...this._config.session,
      // Adjust max concurrent sessions based on available proxy pools
      maxConcurrentSessions: this.isProxyRotationEnabled() 
        ? this._config.session.maxConcurrentSessions 
        : Math.min(this._config.session.maxConcurrentSessions, 10)
    };
  }

  /**
   * Get anti-detection configuration with randomization
   */
  public getAntiDetectionConfig(): AntiDetectionConfig & {
    randomSessionDuration: () => number;
    randomActionDelay: () => number;
  } {
    const baseConfig = this._config.antiDetection;
    
    return {
      ...baseConfig,
      randomSessionDuration: () => {
        const min = baseConfig.sessionDuration.min;
        const max = baseConfig.sessionDuration.max;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
      randomActionDelay: () => {
        const min = baseConfig.actionDelay.min;
        const max = baseConfig.actionDelay.max;
        return Math.random() * (max - min) + min;
      }
    };
  }

  /**
   * Get retry configuration with context-aware adjustments
   */
  public getRetryConfig(actionType?: string): RetryConfig {
    const baseConfig = this._config.retry;
    
    // Adjust retry configuration based on action type
    if (actionType === 'authenticate') {
      return {
        ...baseConfig,
        maxRetries: Math.min(baseConfig.maxRetries + 2, 5), // More retries for auth
        baseDelay: baseConfig.baseDelay * 2 // Longer delays for auth
      };
    }
    
    if (actionType === 'post_tweet' || actionType === 'follow_user') {
      return {
        ...baseConfig,
        maxRetries: Math.max(baseConfig.maxRetries - 1, 1), // Fewer retries for risky actions
        baseDelay: baseConfig.baseDelay * 1.5 // Longer delays for risky actions
      };
    }
    
    return baseConfig;
  }



  /**
   * Enhanced configuration validation with comprehensive checks
   */
  private validateConfiguration(): void {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate proxy configuration
      if (this._config.proxy.enableRotation) {
        const enabledPools = this.getEnabledProxyPools();
        if (enabledPools.length === 0) {
          errors.push('Proxy rotation is enabled but no proxy pools are configured');
        }

        // Validate proxy pool priorities
        enabledPools.forEach(pool => {
          if (pool.config.priority < 1 || pool.config.priority > 10) {
            warnings.push(`Proxy pool ${pool.type} has invalid priority: ${pool.config.priority}`);
          }
        });
      }

      // Validate anti-detection configuration
      const antiDetection = this._config.antiDetection;
      if (antiDetection.sessionDuration.min >= antiDetection.sessionDuration.max) {
        errors.push('Session duration minimum must be less than maximum');
      }

      if (antiDetection.actionDelay.min >= antiDetection.actionDelay.max) {
        errors.push('Action delay minimum must be less than maximum');
      }

      if (antiDetection.riskManagement.maxRiskScore < 0 || antiDetection.riskManagement.maxRiskScore > 1) {
        errors.push('Risk management max risk score must be between 0 and 1');
      }

      // Validate session configuration
      const session = this._config.session;
      if (session.maxConcurrentSessions < 1) {
        errors.push('Max concurrent sessions must be at least 1');
      }

      if (session.pooling.enabled && session.pooling.minPoolSize > session.pooling.maxPoolSize) {
        errors.push('Session pool minimum size cannot be greater than maximum size');
      }

      // Validate retry configuration
      const retry = this._config.retry;
      if (retry.baseDelay >= retry.maxDelay) {
        errors.push('Retry base delay must be less than maximum delay');
      }

      if (retry.exponentialBase <= 1) {
        errors.push('Retry exponential base must be greater than 1');
      }

      if (retry.circuitBreaker.enabled && retry.circuitBreaker.failureThreshold < 1) {
        errors.push('Circuit breaker failure threshold must be at least 1');
      }

      // Validate rate limiting configuration
      const rateLimit = this._config.rateLimit;
      if (rateLimit.queueProcessingInterval < 100) {
        warnings.push('Queue processing interval below 100ms may cause high CPU usage');
      }

      if (rateLimit.queueManagement.maxQueueSize < 100) {
        warnings.push('Small queue size may cause request drops under high load');
      }

      // Validate performance configuration
      if (this._config.performance.enabled) {
        if (this._config.performance.metricsCollection.interval < 10) {
          warnings.push('Very frequent metrics collection may impact performance');
        }
      }

      // Log validation results
      if (errors.length > 0) {
        logger.error('Twikit configuration validation errors:', { errors });
        throw new TwikitError(
          TwikitErrorType.VALIDATION_ERROR,
          `Configuration validation failed: ${errors.join(', ')}`,
          { errors, warnings }
        );
      }

      if (warnings.length > 0) {
        logger.warn('Twikit configuration validation warnings:', { warnings });
      }

    } catch (error) {
      if (error instanceof TwikitError) {
        throw error;
      }

      throw new TwikitError(
        TwikitErrorType.VALIDATION_ERROR,
        'Configuration validation failed with unexpected error',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // ============================================================================
  // A/B TESTING AND EXPERIMENTATION
  // ============================================================================

  /**
   * Start an A/B test experiment
   */
  public async startExperiment(
    experimentName: string,
    variants: Record<string, Partial<TwikitConfig>>,
    trafficSplit: Record<string, number>,
    duration: number,
    userId?: string
  ): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      if (!this._config.abTesting.enabled) {
        throw new Error('A/B testing is not enabled');
      }

      // Validate traffic split adds up to 1.0
      const totalSplit = Object.values(trafficSplit).reduce((sum, split) => sum + split, 0);
      if (Math.abs(totalSplit - 1.0) > 0.001) {
        throw new Error('Traffic split must add up to 1.0');
      }

      // Create experiment configuration
      const experiment = {
        enabled: true,
        variants: Object.entries(variants).map(([name, config]) => ({
          name,
          trafficSplit: trafficSplit[name] || 0,
          configuration: config,
          metrics: ['success_rate', 'response_time', 'error_rate'],
          duration
        })),
        startTime: new Date(),
        endTime: new Date(Date.now() + duration * 1000)
      };

      // Store experiment
      this._config.abTesting.experiments[experimentName] = experiment as any;
      this._abTestingActive.set(experimentName, experiment);

      // Log experiment start
      logAuditTrail('experiment_started', userId || 'system', 'twikit_config', {
        correlationId,
        result: 'success',
        resourceId: experimentName,
        metadata: {
          variants: Object.keys(variants),
          duration,
          trafficSplit
        }
      });

      logger.info('A/B test experiment started', {
        correlationId,
        experimentName,
        variants: Object.keys(variants),
        duration
      });

      // Schedule experiment end
      setTimeout(() => {
        this.endExperiment(experimentName, userId);
      }, duration * 1000);

    } catch (error) {
      logAuditTrail('experiment_start_failed', userId || 'system', 'twikit_config', {
        correlationId,
        result: 'failure',
        resourceId: experimentName,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw new TwikitError(
        TwikitErrorType.CONFIGURATION_ERROR,
        `Failed to start experiment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { experimentName, correlationId }
      );
    }
  }

  /**
   * End an A/B test experiment
   */
  public async endExperiment(experimentName: string, userId?: string): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      const experiment = this._abTestingActive.get(experimentName);
      if (!experiment) {
        throw new Error(`Experiment ${experimentName} not found`);
      }

      // Disable experiment
      if (this._config.abTesting.experiments[experimentName]) {
        this._config.abTesting.experiments[experimentName].enabled = false;
      }

      this._abTestingActive.delete(experimentName);

      // Log experiment end
      logAuditTrail('experiment_ended', userId || 'system', 'twikit_config', {
        correlationId,
        result: 'success',
        resourceId: experimentName,
        metadata: {
          duration: Date.now() - experiment.startTime.getTime(),
          variants: experiment.variants.map((v: any) => v.name)
        }
      });

      logger.info('A/B test experiment ended', {
        correlationId,
        experimentName
      });

    } catch (error) {
      throw new TwikitError(
        TwikitErrorType.CONFIGURATION_ERROR,
        `Failed to end experiment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { experimentName, correlationId }
      );
    }
  }

  /**
   * Get configuration variant for A/B testing
   */
  public getConfigurationVariant(accountId: string): TwikitConfig {
    // If no experiments are active, return default config
    if (this._abTestingActive.size === 0) {
      return this._config;
    }

    // Simple hash-based assignment for consistent variant selection
    const hash = this.hashString(accountId);
    let variantConfig = { ...this._config };

    for (const [, experiment] of this._abTestingActive) {
      const variants = (experiment as any).variants;
      let cumulativeSplit = 0;

      for (const variant of variants) {
        cumulativeSplit += variant.trafficSplit;
        if (hash <= cumulativeSplit) {
          // Apply variant configuration
          variantConfig = this.deepMerge(variantConfig, variant.configuration);
          break;
        }
      }
    }

    return variantConfig;
  }

  /**
   * Simple string hashing for consistent A/B test assignment
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  // ============================================================================
  // ENHANCED CONFIGURATION GETTERS
  // ============================================================================

  /**
   * Get comprehensive configuration summary for monitoring and logging
   */
  public getConfigSummary(): object {
    const enabledPools = this.getEnabledProxyPools();

    return {
      // Basic configuration
      environment: this._config.environment,
      version: this._config.version,
      lastUpdated: this._config.lastUpdated,

      // Proxy configuration
      proxyRotationEnabled: this.isProxyRotationEnabled(),
      enabledProxyPools: enabledPools.map(p => p.type),
      totalProxyUrls: enabledPools.reduce((sum, p) => sum + p.config.urls.length, 0),
      proxyFailoverStrategy: this._config.proxy.failoverStrategy,

      // Anti-detection configuration
      antiDetectionEnabled: this._config.antiDetection.enabled,
      behaviorProfile: this._config.antiDetection.behaviorProfile,
      fingerprintingEnabled: this._config.antiDetection.fingerprinting.enabled,
      riskManagementEnabled: this._config.antiDetection.riskManagement.maxRiskScore < 1,

      // Session configuration
      maxConcurrentSessions: this._config.session.maxConcurrentSessions,
      sessionPersistenceEnabled: this._config.session.enablePersistence,
      sessionPoolingEnabled: this._config.session.pooling.enabled,
      sessionRecoveryEnabled: this._config.session.recovery.enabled,

      // Rate limiting configuration
      rateLimitingEnabled: this._config.rateLimit.enabled,
      distributedCoordinationEnabled: this._config.rateLimit.distributedCoordination,
      dynamicRateLimitingEnabled: this._config.rateLimit.dynamic.enabled,
      defaultAccountType: this._config.rateLimit.defaultAccountType,

      // Performance and monitoring
      performanceMonitoringEnabled: this._config.performance.enabled,
      autoTuningEnabled: this._config.performance.autoTuning.enabled,

      // A/B testing
      abTestingEnabled: this._config.abTesting.enabled,
      activeExperiments: this._abTestingActive.size,

      // Feature flags
      enabledFeatures: Object.keys(this._config.features).filter(f => this._config.features[f]),

      // System metrics
      configHistorySize: this._configHistory.length,
      hotReloadEnabled: this._hotReloadEnabled
    };
  }

  /**
   * Get environment-specific configuration
   */
  public getEnvironmentConfig(): Partial<TwikitConfig> {
    const envOverrides: Partial<TwikitConfig> = {};

    switch (this._config.environment) {
      case 'development':
        envOverrides.performance = {
          ...this._config.performance,
          autoTuning: { ...this._config.performance.autoTuning, enabled: false }
        };
        envOverrides.security = {
          ...this._config.security,
          auditLogging: { ...this._config.security.auditLogging, logLevel: 'detailed' }
        };
        break;

      case 'staging':
        envOverrides.abTesting = {
          ...this._config.abTesting,
          enabled: true
        };
        break;

      case 'production':
        envOverrides.performance = {
          ...this._config.performance,
          autoTuning: { ...this._config.performance.autoTuning, enabled: true }
        };
        envOverrides.security = {
          ...this._config.security,
          encryption: { ...this._config.security.encryption, enabled: true }
        };
        break;
    }

    return envOverrides;
  }

  /**
   * Get action-specific configuration with intelligent defaults
   */
  public getActionConfig(actionType: string, accountType: AccountType = 'standard'): {
    rateLimit: any;
    retry: RetryConfig;
    antiDetection: Partial<AntiDetectionConfig>;
  } {
    this._performanceMetrics.set('lookups', (this._performanceMetrics.get('lookups') || 0) + 1);

    // Get base configurations
    const baseRetry = this.getRetryConfig(actionType);
    const baseRateLimit = this._config.rateLimit.actionLimits[actionType]?.[accountType] || [];

    // Action-specific anti-detection adjustments
    let antiDetectionAdjustments: Partial<AntiDetectionConfig> = {};

    switch (actionType) {
      case 'post_tweet':
      case 'follow_user':
        // High-risk actions need more conservative settings
        antiDetectionAdjustments = {
          actionDelay: {
            min: this._config.antiDetection.actionDelay.min * 2,
            max: this._config.antiDetection.actionDelay.max * 2
          }
        };
        break;

      case 'like_tweet':
      case 'search':
        // Low-risk actions can be more aggressive
        antiDetectionAdjustments = {
          actionDelay: {
            min: this._config.antiDetection.actionDelay.min * 0.5,
            max: this._config.antiDetection.actionDelay.max * 0.5
          }
        };
        break;
    }

    return {
      rateLimit: baseRateLimit,
      retry: baseRetry,
      antiDetection: antiDetectionAdjustments
    };
  }

  /**
   * Get configuration for specific account with personalization
   */
  public getAccountConfig(accountId: string): TwikitConfig {
    this._performanceMetrics.set('lookups', (this._performanceMetrics.get('lookups') || 0) + 1);

    // Start with A/B testing variant if applicable
    let accountConfig = this.getConfigurationVariant(accountId);

    // Apply custom rate limits if they exist
    const customLimits = this.getCustomRateLimits(accountId);
    if (customLimits) {
      accountConfig = {
        ...accountConfig,
        rateLimit: {
          ...accountConfig.rateLimit,
          customLimits: {
            ...accountConfig.rateLimit.customLimits,
            [accountId]: customLimits
          }
        }
      };
    }

    return accountConfig;
  }

  /**
   * Export configuration for Python client
   */
  public exportForPythonClient(): object {
    return {
      proxyConfigs: this.getEnabledProxyPools().flatMap(pool => 
        pool.config.urls.map(url => ({
          url,
          type: pool.type,
          username: pool.config.username,
          password: pool.config.password,
          healthScore: 1.0
        }))
      ),
      sessionConfig: {
        userAgent: '', // Will be randomized by Python client
        viewportSize: [1920, 1080],
        timezone: 'UTC',
        language: 'en-US',
        behaviorProfile: this._config.antiDetection.behaviorProfile,
        sessionDuration: this.getAntiDetectionConfig().randomSessionDuration()
      },
      retryConfig: {
        maxRetries: this._config.retry.maxRetries,
        baseDelay: this._config.retry.baseDelay,
        maxDelay: this._config.retry.maxDelay,
        exponentialBase: this._config.retry.exponentialBase,
        jitter: this._config.retry.enableJitter
      }
    };
  }

  /**
   * Get rate limiting configuration
   */
  public getRateLimitConfig(): RateLimitConfig {
    return this._config.rateLimit;
  }

  /**
   * Get custom rate limits for a specific account
   */
  public getCustomRateLimits(accountId: string): any {
    return this._config.rateLimit.customLimits?.[accountId] || null;
  }

  /**
   * Set custom rate limits for an account
   */
  public setCustomRateLimits(accountId: string, limits: any): void {
    if (!this._config.rateLimit.customLimits) {
      this._config.rateLimit.customLimits = {};
    }
    this._config.rateLimit.customLimits[accountId] = limits;
    logger.info(`Set custom rate limits for account: ${accountId}`);
  }

  /**
   * Remove custom rate limits for an account
   */
  public removeCustomRateLimits(accountId: string): void {
    if (this._config.rateLimit.customLimits) {
      delete this._config.rateLimit.customLimits[accountId];
      logger.info(`Removed custom rate limits for account: ${accountId}`);
    }
  }

  /**
   * Check if rate limiting is enabled
   */
  public isRateLimitingEnabled(): boolean {
    return this._config.rateLimit.enabled;
  }

  /**
   * Check if distributed coordination is enabled
   */
  public isDistributedCoordinationEnabled(): boolean {
    return this._config.rateLimit.distributedCoordination;
  }

  // ============================================================================
  // PERFORMANCE AND MONITORING
  // ============================================================================

  /**
   * Get performance metrics for the configuration system
   */
  public getPerformanceMetrics(): Record<string, any> {
    return {
      configLookups: this._performanceMetrics.get('lookups') || 0,
      configUpdates: this._performanceMetrics.get('updates') || 0,
      averageValidationTime: this._performanceMetrics.get('validationTime') || 0,
      activeExperiments: this._abTestingActive.size,
      configHistorySize: this._configHistory.length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Get configuration change history
   */
  public getConfigHistory(limit: number = 10): Array<{
    timestamp: Date;
    correlationId: string;
    changes: string[];
  }> {
    return this._configHistory
      .slice(-limit)
      .map((entry, index) => ({
        timestamp: entry.timestamp,
        correlationId: entry.correlationId,
        changes: index > 0 && this._configHistory[index - 1]
          ? this.detectConfigChanges(this._configHistory[index - 1]!.config, entry.config)
          : ['initial_configuration']
      }));
  }

  /**
   * Health check for configuration system
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    metrics: Record<string, any>;
  }> {
    const checks = {
      configurationValid: true,
      hotReloadFunctional: this._hotReloadEnabled,
      performanceMonitoringActive: this._config.performance.enabled,
      abTestingFunctional: this._config.abTesting.enabled,
      cacheAccessible: true
    };

    try {
      // Test configuration validation
      this.validateConfiguration();
    } catch (error) {
      checks.configurationValid = false;
    }

    try {
      // Test cache accessibility
      await cacheManager.set('twikit:config:health', 'ok', 10);
      await cacheManager.get('twikit:config:health');
    } catch (error) {
      checks.cacheAccessible = false;
    }

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.values(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks * 0.7) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      metrics: this.getPerformanceMetrics()
    };
  }

  /**
   * Cleanup resources and shutdown gracefully
   */
  public async shutdown(): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      logger.info('Shutting down Twikit configuration manager...', { correlationId });

      // Clear all watchers
      for (const [name, watcher] of this._configWatchers) {
        if (typeof watcher === 'object' && 'close' in watcher) {
          (watcher as any).close();
        } else {
          clearInterval(watcher as NodeJS.Timeout);
        }
      }
      this._configWatchers.clear();

      // End all active experiments
      for (const experimentName of this._abTestingActive.keys()) {
        await this.endExperiment(experimentName, 'system');
      }

      // Clear performance metrics
      this._performanceMetrics.clear();

      // Log shutdown
      logAuditTrail('config_manager_shutdown', 'system', 'twikit_config', {
        correlationId,
        result: 'success',
        metadata: {
          configHistorySize: this._configHistory.length,
          activeExperiments: this._abTestingActive.size
        }
      });

      logger.info('Twikit configuration manager shutdown complete', { correlationId });

    } catch (error) {
      logger.error('Error during configuration manager shutdown:', error);
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE AND EXPORTS
// ============================================================================

// Singleton instance
export const twikitConfig = TwikitConfigManager.getInstance();

// Export individual configurations for convenience and backward compatibility
export const proxyConfig = twikitConfig.config.proxy;
export const antiDetectionConfig = twikitConfig.config.antiDetection;
export const sessionConfig = twikitConfig.config.session;
export const retryConfig = twikitConfig.config.retry;
export const rateLimitConfig = twikitConfig.config.rateLimit;

// Export enhanced configuration getters
export const getProxyConfig = () => twikitConfig.config.proxy;
export const getAntiDetectionConfig = () => twikitConfig.getAntiDetectionConfig();
export const getSessionConfig = () => twikitConfig.getSessionConfig();
export const getRetryConfig = (actionType?: string) => twikitConfig.getRetryConfig(actionType);
export const getRateLimitConfig = () => twikitConfig.getRateLimitConfig();

// Export configuration manager for advanced usage
export { TwikitConfigManager };

// Export types for external usage
export type {
  TwikitConfig,
  ProxyConfig,
  ProxyPoolConfig,
  AntiDetectionConfig,
  SessionConfig,
  RetryConfig,
  RateLimitConfig,
  PerformanceConfig,
  ABTestingConfig,
  SecurityConfig,
  ConfigEnvironment,
  AccountType,
  BehaviorProfile
};


