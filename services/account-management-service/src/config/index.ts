/**
 * Enterprise Account Management Service - Configuration Management
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
  PORT: Joi.number().port().default(3012),
  HOST: Joi.string().default('localhost'),
  
  // Database configuration
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().min(1).max(100).default(10),
  DATABASE_TIMEOUT: Joi.number().min(1000).default(30000),
  
  // Redis configuration
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: Joi.string().default('account-mgmt:'),
  
  // Kafka configuration
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: Joi.string().default('account-management-service'),
  KAFKA_GROUP_ID: Joi.string().default('account-management-group'),
  DISABLE_KAFKA: Joi.boolean().default(false),
  
  // Consul configuration
  CONSUL_HOST: Joi.string().default('localhost'),
  CONSUL_PORT: Joi.number().port().default(8500),
  CONSUL_SERVICE_NAME: Joi.string().default('account-management-service'),
  DISABLE_CONSUL: Joi.boolean().default(false),
  
  // Twitter API configuration
  TWITTER_CONSUMER_KEY: Joi.string().default('not-available-regional-restrictions'),
  TWITTER_CONSUMER_SECRET: Joi.string().default('not-available-regional-restrictions'),
  TWITTER_CALLBACK_URL: Joi.string().default('http://localhost:3012/oauth/callback'),
  
  // JWT configuration (for service-to-service communication)
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  ACCOUNT_RATE_LIMIT_MAX: Joi.number().default(20), // 20 account operations per window
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(9092),
  ENABLE_TRACING: Joi.boolean().default(true),
  JAEGER_ENDPOINT: Joi.string().default('http://localhost:14268/api/traces'),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  
  // Service discovery
  SERVICE_VERSION: Joi.string().default('1.0.0'),
  SERVICE_TAGS: Joi.string().default('account-management,oauth,twitter,microservice'),
  
  // Health checks
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000), // 30 seconds
  HEALTH_CHECK_TIMEOUT: Joi.number().default(5000), // 5 seconds
  
  // Enterprise features
  ENTERPRISE_MODE: Joi.boolean().default(true),
  ENABLE_AUDIT_LOGGING: Joi.boolean().default(true),
  ENABLE_SECURITY_MONITORING: Joi.boolean().default(true),
  
  // Account management specific
  MAX_ACCOUNTS_PER_USER: Joi.number().default(5),
  ACCOUNT_HEALTH_CHECK_INTERVAL: Joi.number().default(300000), // 5 minutes
  OAUTH_SESSION_TIMEOUT: Joi.number().default(600000), // 10 minutes
  
  // External services
  USER_MANAGEMENT_SERVICE_URL: Joi.string().default('http://localhost:3011'),
  BACKEND_SERVICE_URL: Joi.string().default('http://localhost:3001'),
  LLM_SERVICE_URL: Joi.string().default('http://localhost:3003'),
  TELEGRAM_BOT_URL: Joi.string().default('http://localhost:3002')
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
  name: 'account-management-service',
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
    callbackUrl: envVars.TWITTER_CALLBACK_URL
  }
};

// Additional configuration exports
export const securityConfig = {
  rateLimiting: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    accountMaxRequests: envVars.ACCOUNT_RATE_LIMIT_MAX
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

export const accountConfig = {
  maxAccountsPerUser: envVars.MAX_ACCOUNTS_PER_USER,
  healthCheckInterval: envVars.ACCOUNT_HEALTH_CHECK_INTERVAL,
  oauthSessionTimeout: envVars.OAUTH_SESSION_TIMEOUT
};

export const externalServices = {
  userManagement: envVars.USER_MANAGEMENT_SERVICE_URL,
  backend: envVars.BACKEND_SERVICE_URL,
  llm: envVars.LLM_SERVICE_URL,
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
