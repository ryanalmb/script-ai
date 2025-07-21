/**
 * Enterprise Content Management Service - Configuration Management
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
  PORT: Joi.number().port().default(3014),
  HOST: Joi.string().default('localhost'),
  
  // Database configuration
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().min(1).max(100).default(10),
  DATABASE_TIMEOUT: Joi.number().min(1000).default(30000),
  
  // Redis configuration
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: Joi.string().default('content-mgmt:'),
  
  // Kafka configuration
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: Joi.string().default('content-management-service'),
  KAFKA_GROUP_ID: Joi.string().default('content-management-group'),
  DISABLE_KAFKA: Joi.boolean().default(false),
  
  // Consul configuration
  CONSUL_HOST: Joi.string().default('localhost'),
  CONSUL_PORT: Joi.number().port().default(8500),
  CONSUL_SERVICE_NAME: Joi.string().default('content-management-service'),
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
  CONTENT_RATE_LIMIT_MAX: Joi.number().default(30), // 30 content operations per window
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(9094),
  ENABLE_TRACING: Joi.boolean().default(true),
  JAEGER_ENDPOINT: Joi.string().default('http://localhost:14268/api/traces'),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  
  // Service discovery
  SERVICE_VERSION: Joi.string().default('1.0.0'),
  SERVICE_TAGS: Joi.string().default('content-management,media-processing,ai-generation,microservice'),
  
  // Health checks
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000), // 30 seconds
  HEALTH_CHECK_TIMEOUT: Joi.number().default(5000), // 5 seconds
  
  // Enterprise features
  ENTERPRISE_MODE: Joi.boolean().default(true),
  ENABLE_AUDIT_LOGGING: Joi.boolean().default(true),
  ENABLE_SECURITY_MONITORING: Joi.boolean().default(true),
  
  // Content management specific
  MAX_CONTENT_PER_USER: Joi.number().default(1000),
  MAX_MEDIA_SIZE: Joi.number().default(52428800), // 50MB
  MAX_MEDIA_PER_CONTENT: Joi.number().default(10),
  CONTENT_PROCESSING_TIMEOUT: Joi.number().default(60000), // 1 minute
  AI_GENERATION_TIMEOUT: Joi.number().default(30000), // 30 seconds
  
  // Storage configuration
  STORAGE_PROVIDER: Joi.string().valid('local', 's3', 'gcs', 'azure').default('local'),
  STORAGE_BUCKET: Joi.string().allow('').default('x-marketing-content'),
  STORAGE_REGION: Joi.string().allow('').default('us-east-1'),
  STORAGE_ACCESS_KEY: Joi.string().allow('').default(''),
  STORAGE_SECRET_KEY: Joi.string().allow('').default(''),
  STORAGE_ENDPOINT: Joi.string().allow('').default(''),
  STORAGE_LOCAL_PATH: Joi.string().default('./uploads'),
  
  // External services (Backend integration)
  BACKEND_SERVICE_URL: Joi.string().default('http://localhost:3001'),
  USER_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3011'),
  ACCOUNT_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3012'),
  CAMPAIGN_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3013'),
  TELEGRAM_BOT_URL: Joi.string().default('http://localhost:3002'),
  
  // Media processing
  IMAGE_PROCESSING_ENABLED: Joi.boolean().default(true),
  VIDEO_PROCESSING_ENABLED: Joi.boolean().default(false),
  FACE_DETECTION_ENABLED: Joi.boolean().default(false),
  OBJECT_DETECTION_ENABLED: Joi.boolean().default(false),
  TEXT_EXTRACTION_ENABLED: Joi.boolean().default(true),
  CONTENT_MODERATION_ENABLED: Joi.boolean().default(true),
  
  // AI content generation
  AI_CONTENT_GENERATION_ENABLED: Joi.boolean().default(true),
  AI_DEFAULT_MODEL: Joi.string().default('gpt-3.5-turbo'),
  AI_DEFAULT_TEMPERATURE: Joi.number().min(0).max(2).default(0.7),
  AI_DEFAULT_MAX_TOKENS: Joi.number().default(500),
  AI_COST_TRACKING_ENABLED: Joi.boolean().default(true),
  
  // Content moderation
  CONTENT_MODERATION_STRICT: Joi.boolean().default(true),
  AUTO_APPROVE_CONTENT: Joi.boolean().default(false),
  REQUIRE_MANUAL_APPROVAL: Joi.boolean().default(true),
  SPAM_DETECTION_ENABLED: Joi.boolean().default(true),
  PROFANITY_FILTER_ENABLED: Joi.boolean().default(true),
  
  // Template management
  MAX_TEMPLATES_PER_USER: Joi.number().default(100),
  TEMPLATE_VERSIONING_ENABLED: Joi.boolean().default(true),
  PUBLIC_TEMPLATES_ENABLED: Joi.boolean().default(true),
  TEMPLATE_SHARING_ENABLED: Joi.boolean().default(true),
  
  // Performance settings
  BATCH_SIZE: Joi.number().default(50),
  PARALLEL_PROCESSING_LIMIT: Joi.number().default(5),
  CACHE_TTL: Joi.number().default(3600), // 1 hour
  MEDIA_CACHE_TTL: Joi.number().default(86400), // 24 hours
  
  // Security settings
  UPLOAD_VIRUS_SCANNING: Joi.boolean().default(false),
  CONTENT_ENCRYPTION: Joi.boolean().default(false),
  WATERMARK_ENABLED: Joi.boolean().default(false),
  DRM_PROTECTION: Joi.boolean().default(false),
  
  // Analytics settings
  ANALYTICS_ENABLED: Joi.boolean().default(true),
  ANALYTICS_RETENTION_DAYS: Joi.number().default(90),
  REAL_TIME_ANALYTICS: Joi.boolean().default(true),
  CONTENT_INSIGHTS_ENABLED: Joi.boolean().default(true),
  
  // Notification settings
  WEBHOOK_TIMEOUT: Joi.number().default(10000), // 10 seconds
  EMAIL_NOTIFICATIONS_ENABLED: Joi.boolean().default(false),
  SLACK_WEBHOOK_URL: Joi.string().allow('').default(''),
  DISCORD_WEBHOOK_URL: Joi.string().allow('').default(''),
  
  // Backup and archival
  AUTO_BACKUP_ENABLED: Joi.boolean().default(false),
  BACKUP_INTERVAL_HOURS: Joi.number().default(24),
  ARCHIVE_OLD_CONTENT: Joi.boolean().default(false),
  ARCHIVE_AFTER_DAYS: Joi.number().default(365)
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
  name: 'content-management-service',
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
  },
  
  storage: {
    provider: envVars.STORAGE_PROVIDER,
    bucket: envVars.STORAGE_BUCKET || undefined,
    region: envVars.STORAGE_REGION || undefined,
    accessKey: envVars.STORAGE_ACCESS_KEY || undefined,
    secretKey: envVars.STORAGE_SECRET_KEY || undefined,
    endpoint: envVars.STORAGE_ENDPOINT || undefined
  }
};

// Additional configuration exports
export const securityConfig = {
  rateLimiting: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    contentMaxRequests: envVars.CONTENT_RATE_LIMIT_MAX
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

export const contentConfig = {
  maxContentPerUser: envVars.MAX_CONTENT_PER_USER,
  maxMediaSize: envVars.MAX_MEDIA_SIZE,
  maxMediaPerContent: envVars.MAX_MEDIA_PER_CONTENT,
  processingTimeout: envVars.CONTENT_PROCESSING_TIMEOUT,
  aiGenerationTimeout: envVars.AI_GENERATION_TIMEOUT
};

export const storageConfig = {
  provider: envVars.STORAGE_PROVIDER,
  bucket: envVars.STORAGE_BUCKET,
  region: envVars.STORAGE_REGION,
  accessKey: envVars.STORAGE_ACCESS_KEY,
  secretKey: envVars.STORAGE_SECRET_KEY,
  endpoint: envVars.STORAGE_ENDPOINT,
  localPath: envVars.STORAGE_LOCAL_PATH
};

export const mediaConfig = {
  imageProcessing: envVars.IMAGE_PROCESSING_ENABLED,
  videoProcessing: envVars.VIDEO_PROCESSING_ENABLED,
  faceDetection: envVars.FACE_DETECTION_ENABLED,
  objectDetection: envVars.OBJECT_DETECTION_ENABLED,
  textExtraction: envVars.TEXT_EXTRACTION_ENABLED,
  contentModeration: envVars.CONTENT_MODERATION_ENABLED
};

export const aiConfig = {
  enabled: envVars.AI_CONTENT_GENERATION_ENABLED,
  defaultModel: envVars.AI_DEFAULT_MODEL,
  defaultTemperature: envVars.AI_DEFAULT_TEMPERATURE,
  defaultMaxTokens: envVars.AI_DEFAULT_MAX_TOKENS,
  costTracking: envVars.AI_COST_TRACKING_ENABLED
};

export const moderationConfig = {
  strict: envVars.CONTENT_MODERATION_STRICT,
  autoApprove: envVars.AUTO_APPROVE_CONTENT,
  requireManualApproval: envVars.REQUIRE_MANUAL_APPROVAL,
  spamDetection: envVars.SPAM_DETECTION_ENABLED,
  profanityFilter: envVars.PROFANITY_FILTER_ENABLED
};

export const templateConfig = {
  maxTemplatesPerUser: envVars.MAX_TEMPLATES_PER_USER,
  versioningEnabled: envVars.TEMPLATE_VERSIONING_ENABLED,
  publicTemplatesEnabled: envVars.PUBLIC_TEMPLATES_ENABLED,
  sharingEnabled: envVars.TEMPLATE_SHARING_ENABLED
};

export const performanceConfig = {
  batchSize: envVars.BATCH_SIZE,
  parallelProcessingLimit: envVars.PARALLEL_PROCESSING_LIMIT,
  cacheTtl: envVars.CACHE_TTL,
  mediaCacheTtl: envVars.MEDIA_CACHE_TTL
};

export const analyticsConfig = {
  enabled: envVars.ANALYTICS_ENABLED,
  retentionDays: envVars.ANALYTICS_RETENTION_DAYS,
  realTime: envVars.REAL_TIME_ANALYTICS,
  contentInsights: envVars.CONTENT_INSIGHTS_ENABLED
};

export const externalServices = {
  backend: envVars.BACKEND_SERVICE_URL,
  userManagement: envVars.USER_MANAGEMENT_SERVICE_URL,
  accountManagement: envVars.ACCOUNT_MANAGEMENT_SERVICE_URL,
  campaignManagement: envVars.CAMPAIGN_MANAGEMENT_SERVICE_URL,
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
