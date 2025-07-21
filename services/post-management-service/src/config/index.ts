/**
 * Enterprise Post Management Service - Configuration Management
 * Comprehensive configuration system with validation and backend integration
 */

import dotenv from 'dotenv';
import Joi from 'joi';
import { ServiceConfig } from '@/types';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration schema validation
const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3015),
  HOST: Joi.string().default('localhost'),
  
  // Database configuration
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().min(1).max(100).default(10),
  DATABASE_TIMEOUT: Joi.number().min(1000).default(30000),
  
  // Redis configuration
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: Joi.string().default('post-mgmt:'),
  
  // Kafka configuration
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: Joi.string().default('post-management-service'),
  KAFKA_GROUP_ID: Joi.string().default('post-management-group'),
  DISABLE_KAFKA: Joi.boolean().default(false),
  
  // Consul configuration
  CONSUL_HOST: Joi.string().default('localhost'),
  CONSUL_PORT: Joi.number().port().default(8500),
  CONSUL_SERVICE_NAME: Joi.string().default('post-management-service'),
  DISABLE_CONSUL: Joi.boolean().default(false),
  
  // Twitter API configuration
  TWITTER_CONSUMER_KEY: Joi.string().default('not-available-regional-restrictions'),
  TWITTER_CONSUMER_SECRET: Joi.string().default('not-available-regional-restrictions'),
  TWITTER_BEARER_TOKEN: Joi.string().default('not-available-regional-restrictions'),
  TWITTER_API_VERSION: Joi.string().valid('v1.1', 'v2').default('v2'),
  TWITTER_RATE_LIMIT_BUFFER: Joi.number().min(0).max(1).default(0.8),
  
  // JWT configuration (for service-to-service communication)
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  POST_RATE_LIMIT_MAX: Joi.number().default(50), // 50 post operations per window
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(9095),
  ENABLE_TRACING: Joi.boolean().default(true),
  JAEGER_ENDPOINT: Joi.string().default('http://localhost:14268/api/traces'),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  
  // Service discovery
  SERVICE_VERSION: Joi.string().default('1.0.0'),
  SERVICE_TAGS: Joi.string().default('post-management,scheduling,publishing,analytics,microservice'),
  
  // Health checks
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000), // 30 seconds
  HEALTH_CHECK_TIMEOUT: Joi.number().default(5000), // 5 seconds
  
  // Enterprise features
  ENTERPRISE_MODE: Joi.boolean().default(true),
  ENABLE_AUDIT_LOGGING: Joi.boolean().default(true),
  ENABLE_SECURITY_MONITORING: Joi.boolean().default(true),
  
  // Post management specific
  MAX_POSTS_PER_USER: Joi.number().default(10000),
  MAX_SCHEDULED_POSTS: Joi.number().default(1000),
  POST_QUEUE_BATCH_SIZE: Joi.number().default(10),
  POST_PROCESSING_TIMEOUT: Joi.number().default(30000), // 30 seconds
  SCHEDULER_INTERVAL: Joi.number().default(60000), // 1 minute
  
  // External services (Backend integration)
  BACKEND_SERVICE_URL: Joi.string().default('http://localhost:3001'),
  USER_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3011'),
  ACCOUNT_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3012'),
  CAMPAIGN_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3013'),
  CONTENT_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3014'),
  TELEGRAM_BOT_URL: Joi.string().default('http://localhost:3002'),
  
  // Scheduling settings
  ENABLE_OPTIMAL_TIMING: Joi.boolean().default(true),
  OPTIMAL_TIMING_ANALYSIS_INTERVAL: Joi.number().default(86400000), // 24 hours
  MIN_POST_INTERVAL: Joi.number().default(300000), // 5 minutes
  MAX_POSTS_PER_HOUR: Joi.number().default(12),
  MAX_POSTS_PER_DAY: Joi.number().default(100),
  
  // Publishing settings
  ENABLE_AUTO_RETRY: Joi.boolean().default(true),
  MAX_RETRY_ATTEMPTS: Joi.number().default(3),
  RETRY_DELAY_BASE: Joi.number().default(60000), // 1 minute
  RETRY_DELAY_MULTIPLIER: Joi.number().default(2),
  
  // Analytics settings
  ENABLE_REAL_TIME_ANALYTICS: Joi.boolean().default(true),
  ANALYTICS_UPDATE_INTERVAL: Joi.number().default(300000), // 5 minutes
  METRICS_RETENTION_DAYS: Joi.number().default(90),
  ENABLE_PERFORMANCE_TRACKING: Joi.boolean().default(true),
  
  // Queue management
  QUEUE_PROCESSING_INTERVAL: Joi.number().default(30000), // 30 seconds
  QUEUE_MAX_SIZE: Joi.number().default(10000),
  QUEUE_PRIORITY_LEVELS: Joi.number().default(4),
  DEAD_LETTER_QUEUE_ENABLED: Joi.boolean().default(true),
  
  // Performance settings
  BATCH_SIZE: Joi.number().default(50),
  PARALLEL_PROCESSING_LIMIT: Joi.number().default(5),
  CACHE_TTL: Joi.number().default(3600), // 1 hour
  METRICS_CACHE_TTL: Joi.number().default(300), // 5 minutes
  
  // Security settings
  ENABLE_CONTENT_VALIDATION: Joi.boolean().default(true),
  ENABLE_SPAM_DETECTION: Joi.boolean().default(true),
  ENABLE_RATE_LIMIT_PROTECTION: Joi.boolean().default(true),
  ENABLE_ACCOUNT_SAFETY_CHECKS: Joi.boolean().default(true),
  
  // Notification settings
  WEBHOOK_TIMEOUT: Joi.number().default(10000), // 10 seconds
  EMAIL_NOTIFICATIONS_ENABLED: Joi.boolean().default(false),
  SLACK_WEBHOOK_URL: Joi.string().allow('').default(''),
  DISCORD_WEBHOOK_URL: Joi.string().allow('').default(''),
  
  // Backup and recovery
  ENABLE_QUEUE_PERSISTENCE: Joi.boolean().default(true),
  BACKUP_INTERVAL_HOURS: Joi.number().default(6),
  ENABLE_DISASTER_RECOVERY: Joi.boolean().default(true),
  
  // Feature flags
  ENABLE_THREAD_POSTING: Joi.boolean().default(true),
  ENABLE_MEDIA_POSTING: Joi.boolean().default(true),
  ENABLE_POLL_POSTING: Joi.boolean().default(true),
  ENABLE_QUOTE_TWEETS: Joi.boolean().default(true),
  ENABLE_REPLY_POSTING: Joi.boolean().default(true)
});

// Validate configuration
const { error, value: envVars } = configSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true
});

if (error) {
  throw new Error(`Configuration validation error: ${error.message}`);
}

// Create typed configuration object
export const config: ServiceConfig = {
  name: 'post-management-service',
  version: envVars.SERVICE_VERSION,
  port: envVars.PORT,
  host: envVars.HOST,
  environment: envVars.NODE_ENV,
  
  database: {
    url: envVars.DATABASE_URL,
    poolSize: envVars.DATABASE_POOL_SIZE,
    timeout: envVars.DATABASE_TIMEOUT
  },
  
  redis: {
    url: envVars.REDIS_URL,
    keyPrefix: envVars.REDIS_KEY_PREFIX
  },
  
  kafka: {
    brokers: envVars.KAFKA_BROKERS.split(','),
    clientId: envVars.KAFKA_CLIENT_ID,
    groupId: envVars.KAFKA_GROUP_ID
  },
  
  consul: {
    host: envVars.CONSUL_HOST,
    port: envVars.CONSUL_PORT,
    serviceName: envVars.CONSUL_SERVICE_NAME
  },
  
  twitter: {
    consumerKey: envVars.TWITTER_CONSUMER_KEY,
    consumerSecret: envVars.TWITTER_CONSUMER_SECRET,
    rateLimitBuffer: envVars.TWITTER_RATE_LIMIT_BUFFER
  }
};

// Additional configuration exports
export const securityConfig = {
  rateLimiting: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    postMaxRequests: envVars.POST_RATE_LIMIT_MAX
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET
  }
};

export const monitoringConfig = {
  enableMetrics: envVars.ENABLE_METRICS,
  metricsPort: envVars.METRICS_PORT,
  enableTracing: envVars.ENABLE_TRACING,
  jaegerEndpoint: envVars.JAEGER_ENDPOINT,
  healthCheck: {
    interval: envVars.HEALTH_CHECK_INTERVAL,
    timeout: envVars.HEALTH_CHECK_TIMEOUT
  }
};

export const loggingConfig = {
  level: envVars.LOG_LEVEL,
  format: envVars.LOG_FORMAT
};

export const enterpriseConfig = {
  mode: envVars.ENTERPRISE_MODE,
  auditLogging: envVars.ENABLE_AUDIT_LOGGING,
  securityMonitoring: envVars.ENABLE_SECURITY_MONITORING
};

export const serviceDiscoveryConfig = {
  tags: envVars.SERVICE_TAGS.split(','),
  disableKafka: envVars.DISABLE_KAFKA,
  disableConsul: envVars.DISABLE_CONSUL
};

export const postConfig = {
  maxPostsPerUser: envVars.MAX_POSTS_PER_USER,
  maxScheduledPosts: envVars.MAX_SCHEDULED_POSTS,
  queueBatchSize: envVars.POST_QUEUE_BATCH_SIZE,
  processingTimeout: envVars.POST_PROCESSING_TIMEOUT,
  schedulerInterval: envVars.SCHEDULER_INTERVAL
};

export const twitterConfig = {
  consumerKey: envVars.TWITTER_CONSUMER_KEY,
  consumerSecret: envVars.TWITTER_CONSUMER_SECRET,
  bearerToken: envVars.TWITTER_BEARER_TOKEN,
  apiVersion: envVars.TWITTER_API_VERSION,
  rateLimitBuffer: envVars.TWITTER_RATE_LIMIT_BUFFER
};

export const schedulingConfig = {
  enableOptimalTiming: envVars.ENABLE_OPTIMAL_TIMING,
  optimalTimingAnalysisInterval: envVars.OPTIMAL_TIMING_ANALYSIS_INTERVAL,
  minPostInterval: envVars.MIN_POST_INTERVAL,
  maxPostsPerHour: envVars.MAX_POSTS_PER_HOUR,
  maxPostsPerDay: envVars.MAX_POSTS_PER_DAY
};

export const publishingConfig = {
  enableAutoRetry: envVars.ENABLE_AUTO_RETRY,
  maxRetryAttempts: envVars.MAX_RETRY_ATTEMPTS,
  retryDelayBase: envVars.RETRY_DELAY_BASE,
  retryDelayMultiplier: envVars.RETRY_DELAY_MULTIPLIER
};

export const analyticsConfig = {
  enableRealTime: envVars.ENABLE_REAL_TIME_ANALYTICS,
  updateInterval: envVars.ANALYTICS_UPDATE_INTERVAL,
  retentionDays: envVars.METRICS_RETENTION_DAYS,
  enablePerformanceTracking: envVars.ENABLE_PERFORMANCE_TRACKING
};

export const queueConfig = {
  processingInterval: envVars.QUEUE_PROCESSING_INTERVAL,
  maxSize: envVars.QUEUE_MAX_SIZE,
  priorityLevels: envVars.QUEUE_PRIORITY_LEVELS,
  deadLetterQueueEnabled: envVars.DEAD_LETTER_QUEUE_ENABLED
};

export const performanceConfig = {
  batchSize: envVars.BATCH_SIZE,
  parallelProcessingLimit: envVars.PARALLEL_PROCESSING_LIMIT,
  cacheTtl: envVars.CACHE_TTL,
  metricsCacheTtl: envVars.METRICS_CACHE_TTL
};

export const featureFlags = {
  threadPosting: envVars.ENABLE_THREAD_POSTING,
  mediaPosting: envVars.ENABLE_MEDIA_POSTING,
  pollPosting: envVars.ENABLE_POLL_POSTING,
  quoteTweets: envVars.ENABLE_QUOTE_TWEETS,
  replyPosting: envVars.ENABLE_REPLY_POSTING
};

export const externalServices = {
  backend: envVars.BACKEND_SERVICE_URL,
  userManagement: envVars.USER_MANAGEMENT_SERVICE_URL,
  accountManagement: envVars.ACCOUNT_MANAGEMENT_SERVICE_URL,
  campaignManagement: envVars.CAMPAIGN_MANAGEMENT_SERVICE_URL,
  contentManagement: envVars.CONTENT_MANAGEMENT_SERVICE_URL,
  telegram: envVars.TELEGRAM_BOT_URL
};

// Configuration validation helper
export function validateConfig(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Environment helpers
export const isDevelopment = config.environment === 'development';
export const isProduction = config.environment === 'production';
export const isTest = config.environment === 'test';

// Service information
export const serviceInfo = {
  name: config.name,
  version: config.version,
  environment: config.environment,
  port: config.port,
  startTime: new Date(),
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch
};

// Export default configuration
export default config;
