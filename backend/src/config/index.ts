/**
 * Centralized Configuration Management
 * Exports all configuration modules and provides a unified config object
 */

import { env, config as environmentConfig } from './environment';
import { twikitConfig } from './twikit';
import { logger } from '../utils/logger';

// Re-export individual config modules
export { environmentConfig as environment };
export { twikitConfig };
export * from './database';
export * from './redis';
export * from './telemetry';

/**
 * Unified configuration object
 */
export const config = {
  // Environment configuration
  env: env.NODE_ENV,
  port: env.PORT,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',

  // Database configuration
  database: environmentConfig.database,

  // Redis configuration
  redis: environmentConfig.redis,

  // JWT configuration
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN
  },

  // X/Twitter API configuration
  twitter: environmentConfig.externalServices.x,

  // External services
  services: {
    huggingface: environmentConfig.externalServices.huggingFace,
    telegram: environmentConfig.externalServices.telegram
  },

  // Frontend configuration
  frontend: {
    url: env.FRONTEND_URL
  },

  // Rate limiting
  rateLimit: environmentConfig.rateLimiting,

  // Security
  security: environmentConfig.security,

  // Performance
  performance: environmentConfig.performance,

  // Features
  features: environmentConfig.features,

  // Logging
  logging: environmentConfig.logging,

  // Twikit configuration (from environment config)
  twikit: environmentConfig.twikit
};

/**
 * Validate configuration on startup
 */
export function validateConfiguration(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Validate JWT secret length
  if (config.jwt.secret.length < 32) {
    logger.warn('JWT_SECRET should be at least 32 characters long for security');
  }

  // Validate database URL format
  if (!config.database.url.startsWith('postgresql://')) {
    logger.warn('DATABASE_URL should be a PostgreSQL connection string');
  }

  // Validate Redis URL format
  if (!config.redis.url.startsWith('redis://')) {
    logger.warn('REDIS_URL should be a Redis connection string');
  }

  logger.info('Configuration validation completed successfully');
}

/**
 * Get configuration for specific environment
 */
export function getEnvironmentConfig(env: string = config.env) {
  const baseConfig = { ...config };
  
  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        logging: {
          ...baseConfig.logging,
          level: 'debug'
        }
      };
      
    case 'production':
      return {
        ...baseConfig,
        database: {
          ...baseConfig.database,
          ssl: true
        },
        logging: {
          ...baseConfig.logging,
          level: 'info'
        }
      };
      
    case 'test':
      return {
        ...baseConfig,
        database: {
          ...baseConfig.database,
          url: baseConfig.database.url.replace(/\/[^\/]+$/, '/test_db')
        },
        logging: {
          ...baseConfig.logging,
          level: 'error'
        }
      };
      
    default:
      return baseConfig;
  }
}

/**
 * Configuration health check
 */
export function configHealthCheck(): {
  healthy: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check critical configurations
  if (!config.database.url) {
    issues.push('Database URL not configured');
  }

  if (!config.redis.url) {
    issues.push('Redis URL not configured');
  }

  if (!config.jwt.secret) {
    issues.push('JWT secret not configured');
  }

  // Check optional but recommended configurations
  if (!config.services.huggingface.apiKey) {
    warnings.push('Hugging Face API key not configured - AI features may not work');
  }

  if (!config.services.telegram.botToken) {
    warnings.push('Telegram bot token not configured - bot features may not work');
  }

  if (!config.twitter.apiKey || !config.twitter.apiSecret) {
    warnings.push('Twitter API credentials not configured - Twitter features may not work');
  }

  // Check Twikit proxy configuration
  const enabledProxyPools = twikitConfig.getEnabledProxyPools();
  if (enabledProxyPools.length === 0) {
    warnings.push('No proxy pools configured for Twikit - may impact automation reliability');
  }

  return {
    healthy: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Export configuration summary for debugging
 */
export function getConfigSummary() {
  return {
    environment: config.env,
    database: {
      configured: !!config.database.url,
      ssl: config.database.ssl
    },
    redis: {
      configured: !!config.redis.url,
      ttl: env.CACHE_TTL
    },
    services: {
      huggingface: !!config.services.huggingface.apiKey,
      telegram: !!config.services.telegram.botToken,
      twitter: !!(config.twitter.apiKey && config.twitter.apiSecret)
    },
    twikit: {
      proxyRotation: config.twikit.proxy.enableRotation,
      enabledProxyPools: twikitConfig.getEnabledProxyPools().length,
      antiDetection: config.twikit.antiDetection.enabled,
      maxConcurrentSessions: config.twikit.session.maxConcurrentSessions
    },
    features: config.features,
    security: {
      bcryptRounds: config.security.bcryptRounds,
      trustProxy: config.security.trustProxy
    }
  };
}

// Validate configuration on module load
try {
  validateConfiguration();
} catch (error) {
  logger.error('Configuration validation failed:', error);
  // Don't throw in production to allow graceful degradation
  if (config.env !== 'production') {
    throw error;
  }
}
