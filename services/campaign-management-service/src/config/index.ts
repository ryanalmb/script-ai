/**
 * Enterprise Campaign Management Service - Configuration Management
 * Comprehensive configuration system with validation and environment support
 */

import dotenv from 'dotenv';
import Joi from 'joi';
import { ServiceConfig } from '@/types';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration schema validation
const configSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3013),
  HOST: Joi.string().default('localhost'),
  
  // Database configuration
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().min(1).max(100).default(10),
  DATABASE_TIMEOUT: Joi.number().min(1000).default(30000),
  
  // Redis configuration
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: Joi.string().default('campaign-mgmt:'),
  
  // Kafka configuration
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: Joi.string().default('campaign-management-service'),
  KAFKA_GROUP_ID: Joi.string().default('campaign-management-group'),
  DISABLE_KAFKA: Joi.boolean().default(false),
  
  // Consul configuration
  CONSUL_HOST: Joi.string().default('localhost'),
  CONSUL_PORT: Joi.number().port().default(8500),
  CONSUL_SERVICE_NAME: Joi.string().default('campaign-management-service'),
  DISABLE_CONSUL: Joi.boolean().default(false),
  
  // LLM Service configuration
  LLM_SERVICE_URL: Joi.string().default('http://localhost:3003'),
  LLM_API_KEY: Joi.string().default('not-configured'),
  LLM_MODEL: Joi.string().default('gpt-3.5-turbo'),
  
  // JWT configuration (for service-to-service communication)
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  CAMPAIGN_RATE_LIMIT_MAX: Joi.number().default(50), // 50 campaign operations per window
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(9093),
  ENABLE_TRACING: Joi.boolean().default(true),
  JAEGER_ENDPOINT: Joi.string().default('http://localhost:14268/api/traces'),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  
  // Service discovery
  SERVICE_VERSION: Joi.string().default('1.0.0'),
  SERVICE_TAGS: Joi.string().default('campaign-management,automation,scheduling,microservice'),
  
  // Health checks
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000), // 30 seconds
  HEALTH_CHECK_TIMEOUT: Joi.number().default(5000), // 5 seconds
  
  // Enterprise features
  ENTERPRISE_MODE: Joi.boolean().default(true),
  ENABLE_AUDIT_LOGGING: Joi.boolean().default(true),
  ENABLE_SECURITY_MONITORING: Joi.boolean().default(true),
  
  // Campaign management specific
  MAX_CAMPAIGNS_PER_USER: Joi.number().default(10),
  MAX_POSTS_PER_CAMPAIGN: Joi.number().default(1000),
  MAX_AUTOMATIONS_PER_CAMPAIGN: Joi.number().default(20),
  SCHEDULER_INTERVAL: Joi.number().default(60000), // 1 minute
  CONTENT_GENERATION_TIMEOUT: Joi.number().default(30000), // 30 seconds
  
  // External services
  USER_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3011'),
  ACCOUNT_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3012'),
  BACKEND_SERVICE_URL: Joi.string().default('http://localhost:3001'),
  TELEGRAM_BOT_URL: Joi.string().default('http://localhost:3002'),
  
  // Automation settings
  MAX_CONCURRENT_AUTOMATIONS: Joi.number().default(100),
  AUTOMATION_RETRY_ATTEMPTS: Joi.number().default(3),
  AUTOMATION_RETRY_DELAY: Joi.number().default(300000), // 5 minutes
  
  // Content settings
  MAX_CONTENT_LENGTH: Joi.number().default(280), // Twitter character limit
  MAX_MEDIA_SIZE: Joi.number().default(5242880), // 5MB
  SUPPORTED_MEDIA_TYPES: Joi.string().default('image/jpeg,image/png,image/gif,video/mp4'),
  
  // Safety settings
  RATE_LIMIT_SAFETY_MARGIN: Joi.number().default(0.8), // Use 80% of rate limits
  SPAM_DETECTION_THRESHOLD: Joi.number().default(0.7),
  CONTENT_MODERATION_ENABLED: Joi.boolean().default(true),
  
  // Performance settings
  BATCH_SIZE: Joi.number().default(100),
  PARALLEL_PROCESSING_LIMIT: Joi.number().default(10),
  CACHE_TTL: Joi.number().default(3600), // 1 hour
  
  // Notification settings
  WEBHOOK_TIMEOUT: Joi.number().default(10000), // 10 seconds
  EMAIL_NOTIFICATIONS_ENABLED: Joi.boolean().default(false),
  SLACK_WEBHOOK_URL: Joi.string().allow('').default(''),
  
  // Analytics settings
  ANALYTICS_RETENTION_DAYS: Joi.number().default(90),
  METRICS_AGGREGATION_INTERVAL: Joi.number().default(3600000), // 1 hour
  REAL_TIME_ANALYTICS_ENABLED: Joi.boolean().default(true)
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
  name: 'campaign-management-service',
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
  
  llm: {
    serviceUrl: envVars.LLM_SERVICE_URL,
    apiKey: envVars.LLM_API_KEY,
    model: envVars.LLM_MODEL
  }
};

// Additional configuration exports
export const securityConfig = {
  rateLimiting: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    campaignMaxRequests: envVars.CAMPAIGN_RATE_LIMIT_MAX
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

export const campaignConfig = {
  maxCampaignsPerUser: envVars.MAX_CAMPAIGNS_PER_USER,
  maxPostsPerCampaign: envVars.MAX_POSTS_PER_CAMPAIGN,
  maxAutomationsPerCampaign: envVars.MAX_AUTOMATIONS_PER_CAMPAIGN,
  schedulerInterval: envVars.SCHEDULER_INTERVAL,
  contentGenerationTimeout: envVars.CONTENT_GENERATION_TIMEOUT
};

export const automationConfig = {
  maxConcurrentAutomations: envVars.MAX_CONCURRENT_AUTOMATIONS,
  retryAttempts: envVars.AUTOMATION_RETRY_ATTEMPTS,
  retryDelay: envVars.AUTOMATION_RETRY_DELAY
};

export const contentConfig = {
  maxContentLength: envVars.MAX_CONTENT_LENGTH,
  maxMediaSize: envVars.MAX_MEDIA_SIZE,
  supportedMediaTypes: envVars.SUPPORTED_MEDIA_TYPES.split(','),
  moderationEnabled: envVars.CONTENT_MODERATION_ENABLED
};

export const safetyConfig = {
  rateLimitSafetyMargin: envVars.RATE_LIMIT_SAFETY_MARGIN,
  spamDetectionThreshold: envVars.SPAM_DETECTION_THRESHOLD
};

export const performanceConfig = {
  batchSize: envVars.BATCH_SIZE,
  parallelProcessingLimit: envVars.PARALLEL_PROCESSING_LIMIT,
  cacheTtl: envVars.CACHE_TTL
};

export const notificationConfig = {
  webhookTimeout: envVars.WEBHOOK_TIMEOUT,
  emailEnabled: envVars.EMAIL_NOTIFICATIONS_ENABLED,
  slackWebhookUrl: envVars.SLACK_WEBHOOK_URL
};

export const analyticsConfig = {
  retentionDays: envVars.ANALYTICS_RETENTION_DAYS,
  aggregationInterval: envVars.METRICS_AGGREGATION_INTERVAL,
  realTimeEnabled: envVars.REAL_TIME_ANALYTICS_ENABLED
};

export const externalServices = {
  userManagement: envVars.USER_MANAGEMENT_SERVICE_URL,
  accountManagement: envVars.ACCOUNT_MANAGEMENT_SERVICE_URL,
  backend: envVars.BACKEND_SERVICE_URL,
  telegram: envVars.TELEGRAM_BOT_URL,
  llm: envVars.LLM_SERVICE_URL
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
