/**
 * Enterprise Configuration Management
 * 
 * Centralizes all configuration management with environment variable support,
 * validation, and type safety for all enterprise services.
 */

import { z } from 'zod';
import { logger } from '../utils/logger';

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

/**
 * X Automation Configuration Schema
 */
const XAutomationConfigSchema = z.object({
  // Rate Limiting Configuration
  rateLimits: z.object({
    maxTweetsPerHour: z.number().min(1).max(1000).default(50),
    maxFollowsPerHour: z.number().min(1).max(1000).default(100),
    maxLikesPerHour: z.number().min(1).max(2000).default(200),
    maxRetweetsPerHour: z.number().min(1).max(1000).default(100),
    maxDMsPerHour: z.number().min(1).max(500).default(50),
    maxBookmarksPerHour: z.number().min(1).max(1000).default(100),
    maxCommentsPerHour: z.number().min(1).max(500).default(50),
  }),

  // Quality and Compliance
  quality: z.object({
    qualityThreshold: z.number().min(0).max(1).default(0.8),
    enableContentFiltering: z.boolean().default(true),
    enableRegionalCompliance: z.boolean().default(true),
    enableSpamDetection: z.boolean().default(true),
    enableSentimentAnalysis: z.boolean().default(true),
  }),

  // Error Handling and Retry
  retry: z.object({
    retryAttempts: z.number().min(1).max(10).default(3),
    retryDelay: z.number().min(100).max(10000).default(1000),
    maxRetryDelay: z.number().min(1000).max(60000).default(30000),
    exponentialBackoff: z.boolean().default(true),
    circuitBreakerThreshold: z.number().min(1).max(20).default(5),
  }),

  // Behavioral Simulation
  behavior: z.object({
    enableBehaviorSimulation: z.boolean().default(true),
    enableHumanLikeDelays: z.boolean().default(true),
    enableRandomization: z.boolean().default(true),
    randomizationFactor: z.number().min(0).max(1).default(0.3),
    enableTypingSimulation: z.boolean().default(true),
    enableMouseMovement: z.boolean().default(true),
  }),

  // Performance and Monitoring
  performance: z.object({
    enablePerformanceMonitoring: z.boolean().default(true),
    enableDetailedLogging: z.boolean().default(true),
    enableMetricsCollection: z.boolean().default(true),
    metricsRetentionDays: z.number().min(1).max(365).default(30),
  }),

  // Security and Compliance
  security: z.object({
    enableAuditLogging: z.boolean().default(true),
    enableComplianceChecks: z.boolean().default(true),
    enableContentValidation: z.boolean().default(true),
    maxConcurrentSessions: z.number().min(1).max(100).default(10),
  })
});

/**
 * Global Rate Limit Configuration Schema
 */
const GlobalRateLimitConfigSchema = z.object({
  // Default Rate Limits
  defaultLimits: z.object({
    postTweet: z.object({
      perMinute: z.number().min(1).max(10).default(1),
      perHour: z.number().min(1).max(100).default(10),
      perDay: z.number().min(1).max(500).default(50),
      burstLimit: z.number().min(1).max(20).default(3),
    }),
    likeTweet: z.object({
      perMinute: z.number().min(1).max(50).default(5),
      perHour: z.number().min(1).max(500).default(50),
      perDay: z.number().min(1).max(2000).default(200),
      burstLimit: z.number().min(1).max(100).default(10),
    }),
    followUser: z.object({
      perMinute: z.number().min(1).max(20).default(2),
      perHour: z.number().min(1).max(200).default(20),
      perDay: z.number().min(1).max(1000).default(100),
      burstLimit: z.number().min(1).max(50).default(5),
    }),
    retweetTweet: z.object({
      perMinute: z.number().min(1).max(20).default(2),
      perHour: z.number().min(1).max(200).default(20),
      perDay: z.number().min(1).max(1000).default(100),
      burstLimit: z.number().min(1).max(50).default(5),
    }),
    sendDM: z.object({
      perMinute: z.number().min(1).max(10).default(1),
      perHour: z.number().min(1).max(100).default(10),
      perDay: z.number().min(1).max(500).default(50),
      burstLimit: z.number().min(1).max(20).default(2),
    }),
  }),

  // Account Type Modifiers
  accountTypeModifiers: z.object({
    new: z.number().min(0.1).max(2).default(0.5),
    standard: z.number().min(0.1).max(2).default(1.0),
    verified: z.number().min(0.1).max(2).default(1.5),
    premium: z.number().min(0.1).max(2).default(2.0),
    enterprise: z.number().min(0.1).max(2).default(3.0),
  }),

  // Queue Configuration
  queue: z.object({
    processInterval: z.number().min(10).max(1000).default(100),
    maxQueueSize: z.number().min(100).max(10000).default(1000),
    priorityLevels: z.number().min(3).max(10).default(5),
    timeoutSeconds: z.number().min(1).max(300).default(60),
  }),

  // Analytics Configuration
  analytics: z.object({
    enabled: z.boolean().default(true),
    flushInterval: z.number().min(1000).max(60000).default(5000),
    retentionDays: z.number().min(1).max(365).default(30),
    enableDetailedMetrics: z.boolean().default(true),
  }),

  // Distributed Coordination
  coordination: z.object({
    enabled: z.boolean().default(true),
    lockTtl: z.number().min(1000).max(60000).default(10000),
    profileCacheTtl: z.number().min(300).max(86400).default(3600),
    healthCheckInterval: z.number().min(5000).max(300000).default(30000),
  })
});

/**
 * Emergency Stop Configuration Schema
 */
const EmergencyStopConfigSchema = z.object({
  // Detection Configuration
  detection: z.object({
    triggerDetectionInterval: z.number().min(1000).max(60000).default(5000),
    healthMonitoringInterval: z.number().min(5000).max(300000).default(10000),
    maxConcurrentStops: z.number().min(1).max(50).default(10),
  }),

  // Stop Configuration
  stop: z.object({
    immediateStopTimeout: z.number().min(1000).max(30000).default(5000),
    gracefulStopTimeout: z.number().min(10000).max(300000).default(60000),
    autoRecoveryEnabled: z.boolean().default(true),
    recoveryValidationTimeout: z.number().min(10000).max(300000).default(30000),
  }),

  // Monitoring Configuration
  monitoring: z.object({
    postRecoveryMonitoringDuration: z.number().min(60000).max(1800000).default(300000),
    enableNotifications: z.boolean().default(true),
    enableDetailedLogging: z.boolean().default(true),
    retainEventHistory: z.number().min(1).max(365).default(30),
  }),

  // Resource Limits
  resources: z.object({
    maxMemoryUsage: z.number().min(100 * 1024 * 1024).max(2 * 1024 * 1024 * 1024).default(512 * 1024 * 1024),
    maxCpuUsage: z.number().min(10).max(100).default(80),
    maxDiskUsage: z.number().min(10).max(100).default(85),
  })
});

/**
 * Python Process Management Configuration Schema
 */
const PythonProcessConfigSchema = z.object({
  // Pool Configuration
  pool: z.object({
    maxPoolSize: z.number().min(1).max(100).default(20),
    minPoolSize: z.number().min(1).max(50).default(5),
    processTimeout: z.number().min(5000).max(300000).default(30000),
    maxIdleTime: z.number().min(60000).max(1800000).default(300000),
  }),

  // Health Configuration
  health: z.object({
    healthCheckInterval: z.number().min(10000).max(600000).default(60000),
    maxRetries: z.number().min(1).max(10).default(3),
    gracefulShutdownTimeout: z.number().min(5000).max(60000).default(10000),
    maxErrorCount: z.number().min(1).max(20).default(5),
  }),

  // Performance Configuration
  performance: z.object({
    enableConnectionReuse: z.boolean().default(true),
    enableProcessPooling: z.boolean().default(true),
    enableLifecycleManagement: z.boolean().default(true),
    enableResourceMonitoring: z.boolean().default(true),
  })
});

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export type XAutomationConfig = z.infer<typeof XAutomationConfigSchema>;
export type GlobalRateLimitConfig = z.infer<typeof GlobalRateLimitConfigSchema>;
export type EmergencyStopConfig = z.infer<typeof EmergencyStopConfigSchema>;
export type PythonProcessConfig = z.infer<typeof PythonProcessConfigSchema>;

// ============================================================================
// ENVIRONMENT VARIABLE MAPPING
// ============================================================================

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): {
  xAutomation: Partial<XAutomationConfig>;
  globalRateLimit: Partial<GlobalRateLimitConfig>;
  emergencyStop: Partial<EmergencyStopConfig>;
  pythonProcess: Partial<PythonProcessConfig>;
} {
  return {
    xAutomation: {
      rateLimits: {
        maxTweetsPerHour: process.env.X_AUTOMATION_MAX_TWEETS_PER_HOUR ? parseInt(process.env.X_AUTOMATION_MAX_TWEETS_PER_HOUR) : 10,
        maxFollowsPerHour: process.env.X_AUTOMATION_MAX_FOLLOWS_PER_HOUR ? parseInt(process.env.X_AUTOMATION_MAX_FOLLOWS_PER_HOUR) : 20,
        maxLikesPerHour: process.env.X_AUTOMATION_MAX_LIKES_PER_HOUR ? parseInt(process.env.X_AUTOMATION_MAX_LIKES_PER_HOUR) : 50,
        maxRetweetsPerHour: process.env.X_AUTOMATION_MAX_RETWEETS_PER_HOUR ? parseInt(process.env.X_AUTOMATION_MAX_RETWEETS_PER_HOUR) : 15,
        maxDMsPerHour: process.env.X_AUTOMATION_MAX_DMS_PER_HOUR ? parseInt(process.env.X_AUTOMATION_MAX_DMS_PER_HOUR) : 5,
        maxBookmarksPerHour: process.env.X_AUTOMATION_MAX_BOOKMARKS_PER_HOUR ? parseInt(process.env.X_AUTOMATION_MAX_BOOKMARKS_PER_HOUR) : 30,
        maxCommentsPerHour: process.env.X_AUTOMATION_MAX_COMMENTS_PER_HOUR ? parseInt(process.env.X_AUTOMATION_MAX_COMMENTS_PER_HOUR) : 25,
      },
      quality: {
        qualityThreshold: process.env.X_AUTOMATION_QUALITY_THRESHOLD ? parseFloat(process.env.X_AUTOMATION_QUALITY_THRESHOLD) : 0.7,
        enableContentFiltering: process.env.X_AUTOMATION_ENABLE_CONTENT_FILTERING ? process.env.X_AUTOMATION_ENABLE_CONTENT_FILTERING === 'true' : true,
        enableRegionalCompliance: process.env.X_AUTOMATION_ENABLE_REGIONAL_COMPLIANCE ? process.env.X_AUTOMATION_ENABLE_REGIONAL_COMPLIANCE === 'true' : true,
        enableSpamDetection: process.env.X_AUTOMATION_ENABLE_SPAM_DETECTION ? process.env.X_AUTOMATION_ENABLE_SPAM_DETECTION === 'true' : true,
        enableSentimentAnalysis: process.env.X_AUTOMATION_ENABLE_SENTIMENT_ANALYSIS ? process.env.X_AUTOMATION_ENABLE_SENTIMENT_ANALYSIS === 'true' : false,
      },
      retry: {
        retryAttempts: process.env.X_AUTOMATION_RETRY_ATTEMPTS ? parseInt(process.env.X_AUTOMATION_RETRY_ATTEMPTS) : 3,
        retryDelay: process.env.X_AUTOMATION_RETRY_DELAY ? parseInt(process.env.X_AUTOMATION_RETRY_DELAY) : 1000,
        maxRetryDelay: process.env.X_AUTOMATION_MAX_RETRY_DELAY ? parseInt(process.env.X_AUTOMATION_MAX_RETRY_DELAY) : 10000,
        exponentialBackoff: process.env.X_AUTOMATION_EXPONENTIAL_BACKOFF ? process.env.X_AUTOMATION_EXPONENTIAL_BACKOFF === 'true' : true,
        circuitBreakerThreshold: process.env.X_AUTOMATION_CIRCUIT_BREAKER_THRESHOLD ? parseInt(process.env.X_AUTOMATION_CIRCUIT_BREAKER_THRESHOLD) : 5,
      }
    },

    globalRateLimit: {
      defaultLimits: {
        postTweet: {
          perMinute: process.env.RATE_LIMIT_POST_TWEET_PER_MINUTE ? parseInt(process.env.RATE_LIMIT_POST_TWEET_PER_MINUTE) : 1,
          perHour: process.env.RATE_LIMIT_POST_TWEET_PER_HOUR ? parseInt(process.env.RATE_LIMIT_POST_TWEET_PER_HOUR) : 10,
          perDay: process.env.RATE_LIMIT_POST_TWEET_PER_DAY ? parseInt(process.env.RATE_LIMIT_POST_TWEET_PER_DAY) : 50,
          burstLimit: process.env.RATE_LIMIT_POST_TWEET_BURST ? parseInt(process.env.RATE_LIMIT_POST_TWEET_BURST) : 3,
        },
        likeTweet: {
          perMinute: process.env.RATE_LIMIT_LIKE_TWEET_PER_MINUTE ? parseInt(process.env.RATE_LIMIT_LIKE_TWEET_PER_MINUTE) : 5,
          perHour: process.env.RATE_LIMIT_LIKE_TWEET_PER_HOUR ? parseInt(process.env.RATE_LIMIT_LIKE_TWEET_PER_HOUR) : 50,
          perDay: process.env.RATE_LIMIT_LIKE_TWEET_PER_DAY ? parseInt(process.env.RATE_LIMIT_LIKE_TWEET_PER_DAY) : 200,
          burstLimit: process.env.RATE_LIMIT_LIKE_TWEET_BURST ? parseInt(process.env.RATE_LIMIT_LIKE_TWEET_BURST) : 10,
        },
        followUser: {
          perMinute: process.env.RATE_LIMIT_FOLLOW_USER_PER_MINUTE ? parseInt(process.env.RATE_LIMIT_FOLLOW_USER_PER_MINUTE) : 2,
          perHour: process.env.RATE_LIMIT_FOLLOW_USER_PER_HOUR ? parseInt(process.env.RATE_LIMIT_FOLLOW_USER_PER_HOUR) : 20,
          perDay: process.env.RATE_LIMIT_FOLLOW_USER_PER_DAY ? parseInt(process.env.RATE_LIMIT_FOLLOW_USER_PER_DAY) : 100,
          burstLimit: process.env.RATE_LIMIT_FOLLOW_USER_BURST ? parseInt(process.env.RATE_LIMIT_FOLLOW_USER_BURST) : 5,
        },
        retweetTweet: {
          perMinute: process.env.RATE_LIMIT_RETWEET_TWEET_PER_MINUTE ? parseInt(process.env.RATE_LIMIT_RETWEET_TWEET_PER_MINUTE) : 3,
          perHour: process.env.RATE_LIMIT_RETWEET_TWEET_PER_HOUR ? parseInt(process.env.RATE_LIMIT_RETWEET_TWEET_PER_HOUR) : 15,
          perDay: process.env.RATE_LIMIT_RETWEET_TWEET_PER_DAY ? parseInt(process.env.RATE_LIMIT_RETWEET_TWEET_PER_DAY) : 75,
          burstLimit: process.env.RATE_LIMIT_RETWEET_TWEET_BURST ? parseInt(process.env.RATE_LIMIT_RETWEET_TWEET_BURST) : 5,
        },
        sendDM: {
          perMinute: process.env.RATE_LIMIT_SEND_DM_PER_MINUTE ? parseInt(process.env.RATE_LIMIT_SEND_DM_PER_MINUTE) : 1,
          perHour: process.env.RATE_LIMIT_SEND_DM_PER_HOUR ? parseInt(process.env.RATE_LIMIT_SEND_DM_PER_HOUR) : 5,
          perDay: process.env.RATE_LIMIT_SEND_DM_PER_DAY ? parseInt(process.env.RATE_LIMIT_SEND_DM_PER_DAY) : 20,
          burstLimit: process.env.RATE_LIMIT_SEND_DM_BURST ? parseInt(process.env.RATE_LIMIT_SEND_DM_BURST) : 2,
        }
      },
      queue: {
        processInterval: process.env.RATE_LIMIT_QUEUE_PROCESS_INTERVAL ? parseInt(process.env.RATE_LIMIT_QUEUE_PROCESS_INTERVAL) : 1000,
        maxQueueSize: process.env.RATE_LIMIT_MAX_QUEUE_SIZE ? parseInt(process.env.RATE_LIMIT_MAX_QUEUE_SIZE) : 10000,
        timeoutSeconds: process.env.RATE_LIMIT_TIMEOUT_SECONDS ? parseInt(process.env.RATE_LIMIT_TIMEOUT_SECONDS) : 300,
        priorityLevels: 5,
      }
    },

    emergencyStop: {
      detection: {
        triggerDetectionInterval: process.env.EMERGENCY_STOP_TRIGGER_DETECTION_INTERVAL ? parseInt(process.env.EMERGENCY_STOP_TRIGGER_DETECTION_INTERVAL) : 5000,
        healthMonitoringInterval: process.env.EMERGENCY_STOP_HEALTH_MONITORING_INTERVAL ? parseInt(process.env.EMERGENCY_STOP_HEALTH_MONITORING_INTERVAL) : 10000,
        maxConcurrentStops: process.env.EMERGENCY_STOP_MAX_CONCURRENT_STOPS ? parseInt(process.env.EMERGENCY_STOP_MAX_CONCURRENT_STOPS) : 5,
      },
      stop: {
        immediateStopTimeout: process.env.EMERGENCY_STOP_IMMEDIATE_TIMEOUT ? parseInt(process.env.EMERGENCY_STOP_IMMEDIATE_TIMEOUT) : 5000,
        gracefulStopTimeout: process.env.EMERGENCY_STOP_GRACEFUL_TIMEOUT ? parseInt(process.env.EMERGENCY_STOP_GRACEFUL_TIMEOUT) : 30000,
        autoRecoveryEnabled: process.env.EMERGENCY_STOP_AUTO_RECOVERY ? process.env.EMERGENCY_STOP_AUTO_RECOVERY === 'true' : true,
        recoveryValidationTimeout: 30000,
      }
    },

    pythonProcess: {
      pool: {
        maxPoolSize: process.env.PYTHON_PROCESS_MAX_POOL_SIZE ? parseInt(process.env.PYTHON_PROCESS_MAX_POOL_SIZE) : 10,
        minPoolSize: process.env.PYTHON_PROCESS_MIN_POOL_SIZE ? parseInt(process.env.PYTHON_PROCESS_MIN_POOL_SIZE) : 2,
        processTimeout: process.env.PYTHON_PROCESS_TIMEOUT ? parseInt(process.env.PYTHON_PROCESS_TIMEOUT) : 30000,
        maxIdleTime: process.env.PYTHON_PROCESS_MAX_IDLE_TIME ? parseInt(process.env.PYTHON_PROCESS_MAX_IDLE_TIME) : 300000,
      },
      health: {
        healthCheckInterval: process.env.PYTHON_PROCESS_HEALTH_CHECK_INTERVAL ? parseInt(process.env.PYTHON_PROCESS_HEALTH_CHECK_INTERVAL) : 30000,
        maxRetries: process.env.PYTHON_PROCESS_MAX_RETRIES ? parseInt(process.env.PYTHON_PROCESS_MAX_RETRIES) : 3,
        gracefulShutdownTimeout: process.env.PYTHON_PROCESS_GRACEFUL_SHUTDOWN_TIMEOUT ? parseInt(process.env.PYTHON_PROCESS_GRACEFUL_SHUTDOWN_TIMEOUT) : 10000,
        maxErrorCount: 5,
      }
    }
  };
}

// ============================================================================
// CONFIGURATION MANAGER
// ============================================================================

/**
 * Enterprise Configuration Manager
 */
export class EnterpriseConfigManager {
  private static instance: EnterpriseConfigManager;
  
  public readonly xAutomation: XAutomationConfig;
  public readonly globalRateLimit: GlobalRateLimitConfig;
  public readonly emergencyStop: EmergencyStopConfig;
  public readonly pythonProcess: PythonProcessConfig;

  private constructor() {
    const envConfig = loadConfigFromEnv();

    try {
      // Validate and merge configurations
      this.xAutomation = XAutomationConfigSchema.parse(envConfig.xAutomation);
      this.globalRateLimit = GlobalRateLimitConfigSchema.parse(envConfig.globalRateLimit);
      this.emergencyStop = EmergencyStopConfigSchema.parse(envConfig.emergencyStop);
      this.pythonProcess = PythonProcessConfigSchema.parse(envConfig.pythonProcess);

      logger.info('Enterprise configuration loaded successfully', {
        xAutomationConfig: Object.keys(this.xAutomation).length,
        globalRateLimitConfig: Object.keys(this.globalRateLimit).length,
        emergencyStopConfig: Object.keys(this.emergencyStop).length,
        pythonProcessConfig: Object.keys(this.pythonProcess).length
      });

    } catch (error) {
      logger.error('Failed to load enterprise configuration:', error);
      throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static getInstance(): EnterpriseConfigManager {
    if (!EnterpriseConfigManager.instance) {
      EnterpriseConfigManager.instance = new EnterpriseConfigManager();
    }
    return EnterpriseConfigManager.instance;
  }

  /**
   * Get configuration for specific service
   */
  getXAutomationConfig(): XAutomationConfig {
    return this.xAutomation;
  }

  getGlobalRateLimitConfig(): GlobalRateLimitConfig {
    return this.globalRateLimit;
  }

  getEmergencyStopConfig(): EmergencyStopConfig {
    return this.emergencyStop;
  }

  getPythonProcessConfig(): PythonProcessConfig {
    return this.pythonProcess;
  }

  /**
   * Validate configuration at runtime
   */
  validateConfiguration(): boolean {
    try {
      XAutomationConfigSchema.parse(this.xAutomation);
      GlobalRateLimitConfigSchema.parse(this.globalRateLimit);
      EmergencyStopConfigSchema.parse(this.emergencyStop);
      PythonProcessConfigSchema.parse(this.pythonProcess);
      return true;
    } catch (error) {
      logger.error('Configuration validation failed:', error);
      return false;
    }
  }

  /**
   * Get configuration summary for monitoring
   */
  getConfigurationSummary(): Record<string, any> {
    return {
      xAutomation: {
        maxTweetsPerHour: this.xAutomation.rateLimits.maxTweetsPerHour,
        qualityThreshold: this.xAutomation.quality.qualityThreshold,
        retryAttempts: this.xAutomation.retry.retryAttempts,
        behaviorSimulation: this.xAutomation.behavior.enableBehaviorSimulation
      },
      globalRateLimit: {
        postTweetPerHour: this.globalRateLimit.defaultLimits.postTweet.perHour,
        queueProcessInterval: this.globalRateLimit.queue.processInterval,
        analyticsEnabled: this.globalRateLimit.analytics.enabled
      },
      emergencyStop: {
        autoRecoveryEnabled: this.emergencyStop.stop.autoRecoveryEnabled,
        maxConcurrentStops: this.emergencyStop.detection.maxConcurrentStops,
        gracefulStopTimeout: this.emergencyStop.stop.gracefulStopTimeout
      },
      pythonProcess: {
        maxPoolSize: this.pythonProcess.pool.maxPoolSize,
        minPoolSize: this.pythonProcess.pool.minPoolSize,
        connectionReuse: this.pythonProcess.performance.enableConnectionReuse
      }
    };
  }
}

// Export singleton instance
export const enterpriseConfig = EnterpriseConfigManager.getInstance();
