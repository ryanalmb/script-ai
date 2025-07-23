import { z } from 'zod';
import { logger } from '../utils/logger';

// Environment validation schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // X (Twitter) API
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  
  // External Services
  HUGGINGFACE_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  
  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  
  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.string().transform(Boolean).default('true'),
  
  // Features
  AUTOMATION_MODE: z.string().transform(Boolean).default('false'),
  ENABLE_ANALYTICS: z.string().transform(Boolean).default('true'),
  
  // Performance
  MAX_REQUEST_SIZE: z.string().default('10mb'),
  CACHE_TTL: z.string().transform(Number).default('3600'), // 1 hour
  
  // Development
  ENABLE_CORS: z.string().transform(Boolean).default('true'),
  TRUST_PROXY: z.string().transform(Boolean).default('false'),

  // Twikit Proxy Configuration
  TWIKIT_ENABLE_PROXY_ROTATION: z.string().transform(Boolean).default('true'),
  TWIKIT_PROXY_ROTATION_INTERVAL: z.string().transform(Number).default('300'),
  TWIKIT_PROXY_HEALTH_CHECK_INTERVAL: z.string().transform(Number).default('60'),
  TWIKIT_PROXY_MAX_FAILURES: z.string().transform(Number).default('5'),
  TWIKIT_PROXY_HEALTH_CHECK_TIMEOUT: z.string().transform(Number).default('10'),

  // Residential Proxy Pool
  TWIKIT_RESIDENTIAL_PROXY_URLS: z.string().default(''),
  TWIKIT_RESIDENTIAL_PROXY_USERNAME: z.string().default(''),
  TWIKIT_RESIDENTIAL_PROXY_PASSWORD: z.string().default(''),
  TWIKIT_RESIDENTIAL_PROXY_ENABLED: z.string().transform(Boolean).default('false'),

  // Datacenter Proxy Pool
  TWIKIT_DATACENTER_PROXY_URLS: z.string().default(''),
  TWIKIT_DATACENTER_PROXY_USERNAME: z.string().default(''),
  TWIKIT_DATACENTER_PROXY_PASSWORD: z.string().default(''),
  TWIKIT_DATACENTER_PROXY_ENABLED: z.string().transform(Boolean).default('false'),

  // Mobile Proxy Pool
  TWIKIT_MOBILE_PROXY_URLS: z.string().default(''),
  TWIKIT_MOBILE_PROXY_USERNAME: z.string().default(''),
  TWIKIT_MOBILE_PROXY_PASSWORD: z.string().default(''),
  TWIKIT_MOBILE_PROXY_ENABLED: z.string().transform(Boolean).default('false'),

  // Proxy Health Check Endpoints
  TWIKIT_PROXY_HEALTH_CHECK_URLS: z.string().default('https://httpbin.org/ip,https://api.ipify.org?format=json,https://ifconfig.me/ip'),

  // Anti-Detection Configuration
  TWIKIT_ENABLE_ANTI_DETECTION: z.string().transform(Boolean).default('true'),
  TWIKIT_SESSION_DURATION_MIN: z.string().transform(Number).default('1800'),
  TWIKIT_SESSION_DURATION_MAX: z.string().transform(Number).default('7200'),
  TWIKIT_ACTION_DELAY_MIN: z.string().transform(Number).default('1'),
  TWIKIT_ACTION_DELAY_MAX: z.string().transform(Number).default('5'),
  TWIKIT_BEHAVIOR_PROFILE: z.enum(['conservative', 'moderate', 'active']).default('moderate'),

  // Session Management
  TWIKIT_MAX_CONCURRENT_SESSIONS: z.string().transform(Number).default('50'),
  TWIKIT_SESSION_CLEANUP_INTERVAL: z.string().transform(Number).default('1800'),
  TWIKIT_SESSION_HEALTH_CHECK_INTERVAL: z.string().transform(Number).default('300'),
  TWIKIT_ENABLE_SESSION_PERSISTENCE: z.string().transform(Boolean).default('true'),

  // Retry Configuration
  TWIKIT_MAX_RETRIES: z.string().transform(Number).default('3'),
  TWIKIT_RETRY_BASE_DELAY: z.string().transform(Number).default('1'),
  TWIKIT_RETRY_MAX_DELAY: z.string().transform(Number).default('60'),
  TWIKIT_RETRY_EXPONENTIAL_BASE: z.string().transform(Number).default('2'),
  TWIKIT_RETRY_ENABLE_JITTER: z.string().transform(Boolean).default('true'),

  // Rate Limiting Configuration
  TWIKIT_ENABLE_RATE_LIMITING: z.string().transform(Boolean).default('true'),
  TWIKIT_ENABLE_DISTRIBUTED_COORDINATION: z.string().transform(Boolean).default('true'),
  TWIKIT_RATE_LIMIT_QUEUE_INTERVAL: z.string().transform(Number).default('100'),
  TWIKIT_RATE_LIMIT_ANALYTICS_INTERVAL: z.string().transform(Number).default('5000'),
  TWIKIT_RATE_LIMIT_PROFILE_CACHE_TTL: z.string().transform(Number).default('3600'),
  TWIKIT_RATE_LIMIT_LOCK_TTL: z.string().transform(Number).default('10000'),
  TWIKIT_RATE_LIMIT_DEFAULT_ACCOUNT_TYPE: z.string().default('standard'),
  TWIKIT_RATE_LIMIT_WARMUP_DURATION_DAYS: z.string().transform(Number).default('30'),
});

// Environment configuration type
export type Environment = z.infer<typeof envSchema>;

// Validate and export environment configuration
function validateEnvironment(): Environment {
  try {
    const env = envSchema.parse(process.env);
    
    // Additional validation for production
    if (env.NODE_ENV === 'production') {
      validateProductionEnvironment(env);
    }
    
    logger.info('Environment configuration validated successfully', {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
      automationMode: env.AUTOMATION_MODE,
      enableAnalytics: env.ENABLE_ANALYTICS
    });
    
    return env;
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Environment validation failed:', {
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          received: 'code' in err ? err.code : 'unknown'
        }))
      });
      
      throw new Error(`Environment validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    
    throw error;
  }
}

// Additional validation for production environment
function validateProductionEnvironment(env: Environment): void {
  const requiredForProduction = [
    'X_API_KEY',
    'X_API_SECRET',
    'X_BEARER_TOKEN'
  ];
  
  const missing = requiredForProduction.filter(key => !env[key as keyof Environment]);
  
  if (missing.length > 0) {
    logger.warn('Production environment missing optional configurations:', {
      missing,
      note: 'Some features may not work properly'
    });
  }
  
  // Security checks for production
  if (env.JWT_SECRET.length < 64) {
    logger.warn('JWT secret should be at least 64 characters in production');
  }
  
  if (env.BCRYPT_ROUNDS < 12) {
    logger.warn('BCrypt rounds should be at least 12 in production');
  }
  
  if (env.LOG_LEVEL === 'debug') {
    logger.warn('Debug logging enabled in production - consider changing to info or warn');
  }

  // Validate Twikit proxy configuration for production
  validateTwikitProxyConfiguration(env);
}

// Validate Twikit proxy configuration
function validateTwikitProxyConfiguration(env: Environment): void {
  const proxyPools = [
    { name: 'residential', enabled: env.TWIKIT_RESIDENTIAL_PROXY_ENABLED, urls: env.TWIKIT_RESIDENTIAL_PROXY_URLS },
    { name: 'datacenter', enabled: env.TWIKIT_DATACENTER_PROXY_ENABLED, urls: env.TWIKIT_DATACENTER_PROXY_URLS },
    { name: 'mobile', enabled: env.TWIKIT_MOBILE_PROXY_ENABLED, urls: env.TWIKIT_MOBILE_PROXY_URLS }
  ];

  const enabledPools = proxyPools.filter(pool => pool.enabled);

  if (env.TWIKIT_ENABLE_PROXY_ROTATION && enabledPools.length === 0) {
    logger.warn('Proxy rotation is enabled but no proxy pools are configured');
  }

  // Validate proxy URLs format
  for (const pool of enabledPools) {
    if (!pool.urls || pool.urls.trim() === '') {
      logger.warn(`${pool.name} proxy pool is enabled but no URLs are configured`);
      continue;
    }

    const urls = pool.urls.split(',').map(url => url.trim()).filter(Boolean);
    for (const url of urls) {
      try {
        new URL(url);
      } catch (error) {
        logger.warn(`Invalid proxy URL in ${pool.name} pool: ${url}`);
      }
    }
  }

  // Validate health check URLs
  const healthCheckUrls = env.TWIKIT_PROXY_HEALTH_CHECK_URLS.split(',').map(url => url.trim()).filter(Boolean);
  for (const url of healthCheckUrls) {
    try {
      new URL(url);
    } catch (error) {
      logger.warn(`Invalid health check URL: ${url}`);
    }
  }

  // Validate session configuration
  if (env.TWIKIT_SESSION_DURATION_MIN >= env.TWIKIT_SESSION_DURATION_MAX) {
    logger.warn('Session duration minimum should be less than maximum');
  }

  if (env.TWIKIT_ACTION_DELAY_MIN >= env.TWIKIT_ACTION_DELAY_MAX) {
    logger.warn('Action delay minimum should be less than maximum');
  }

  // Validate retry configuration
  if (env.TWIKIT_RETRY_BASE_DELAY >= env.TWIKIT_RETRY_MAX_DELAY) {
    logger.warn('Retry base delay should be less than maximum delay');
  }

  if (env.TWIKIT_RETRY_EXPONENTIAL_BASE <= 1) {
    logger.warn('Retry exponential base should be greater than 1');
  }

  logger.info('Twikit proxy configuration validated', {
    proxyRotationEnabled: env.TWIKIT_ENABLE_PROXY_ROTATION,
    enabledProxyPools: enabledPools.map(p => p.name),
    antiDetectionEnabled: env.TWIKIT_ENABLE_ANTI_DETECTION,
    maxConcurrentSessions: env.TWIKIT_MAX_CONCURRENT_SESSIONS
  });
}

// Export validated environment
export const env = validateEnvironment();

// Environment-specific configurations
export const config = {
  // Database configuration
  database: {
    url: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production',
    connectionLimit: env.NODE_ENV === 'production' ? 20 : 5,
  },
  
  // Redis configuration
  redis: {
    url: env.REDIS_URL,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  },
  
  // Security configuration
  security: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    bcryptRounds: env.BCRYPT_ROUNDS,
    trustProxy: env.TRUST_PROXY,
  },
  
  // Rate limiting configuration
  rateLimiting: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  
  // CORS configuration
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With'
    ],
  },
  
  // Logging configuration
  logging: {
    level: env.LOG_LEVEL,
    enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
    format: env.NODE_ENV === 'production' ? 'json' : 'simple',
  },
  
  // Feature flags
  features: {
    automationMode: env.AUTOMATION_MODE,
    enableAnalytics: env.ENABLE_ANALYTICS,
    enableCors: env.ENABLE_CORS,
  },
  
  // Performance configuration
  performance: {
    maxRequestSize: env.MAX_REQUEST_SIZE,
    cacheTtl: env.CACHE_TTL,
    compressionLevel: env.NODE_ENV === 'production' ? 6 : 1,
  },
  
  // External services
  externalServices: {
    x: {
      apiKey: env.X_API_KEY,
      apiSecret: env.X_API_SECRET,
      bearerToken: env.X_BEARER_TOKEN,
    },
    huggingFace: {
      apiKey: env.HUGGINGFACE_API_KEY,
    },
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
    },
  },

  // Twikit Configuration
  twikit: {
    // Proxy Configuration
    proxy: {
      enableRotation: env.TWIKIT_ENABLE_PROXY_ROTATION,
      rotationInterval: env.TWIKIT_PROXY_ROTATION_INTERVAL,
      healthCheckInterval: env.TWIKIT_PROXY_HEALTH_CHECK_INTERVAL,
      maxFailures: env.TWIKIT_PROXY_MAX_FAILURES,
      healthCheckTimeout: env.TWIKIT_PROXY_HEALTH_CHECK_TIMEOUT,
      healthCheckUrls: env.TWIKIT_PROXY_HEALTH_CHECK_URLS.split(',').map(url => url.trim()).filter(Boolean),

      // Proxy Pools
      pools: {
        residential: {
          enabled: env.TWIKIT_RESIDENTIAL_PROXY_ENABLED,
          urls: env.TWIKIT_RESIDENTIAL_PROXY_URLS.split(',').map(url => url.trim()).filter(Boolean),
          ...(env.TWIKIT_RESIDENTIAL_PROXY_USERNAME && { username: env.TWIKIT_RESIDENTIAL_PROXY_USERNAME }),
          ...(env.TWIKIT_RESIDENTIAL_PROXY_PASSWORD && { password: env.TWIKIT_RESIDENTIAL_PROXY_PASSWORD }),
        },
        datacenter: {
          enabled: env.TWIKIT_DATACENTER_PROXY_ENABLED,
          urls: env.TWIKIT_DATACENTER_PROXY_URLS.split(',').map(url => url.trim()).filter(Boolean),
          ...(env.TWIKIT_DATACENTER_PROXY_USERNAME && { username: env.TWIKIT_DATACENTER_PROXY_USERNAME }),
          ...(env.TWIKIT_DATACENTER_PROXY_PASSWORD && { password: env.TWIKIT_DATACENTER_PROXY_PASSWORD }),
        },
        mobile: {
          enabled: env.TWIKIT_MOBILE_PROXY_ENABLED,
          urls: env.TWIKIT_MOBILE_PROXY_URLS.split(',').map(url => url.trim()).filter(Boolean),
          ...(env.TWIKIT_MOBILE_PROXY_USERNAME && { username: env.TWIKIT_MOBILE_PROXY_USERNAME }),
          ...(env.TWIKIT_MOBILE_PROXY_PASSWORD && { password: env.TWIKIT_MOBILE_PROXY_PASSWORD }),
        },
      },
    },

    // Anti-Detection Configuration
    antiDetection: {
      enabled: env.TWIKIT_ENABLE_ANTI_DETECTION,
      sessionDuration: {
        min: env.TWIKIT_SESSION_DURATION_MIN,
        max: env.TWIKIT_SESSION_DURATION_MAX,
      },
      actionDelay: {
        min: env.TWIKIT_ACTION_DELAY_MIN,
        max: env.TWIKIT_ACTION_DELAY_MAX,
      },
      behaviorProfile: env.TWIKIT_BEHAVIOR_PROFILE,
    },

    // Session Management
    session: {
      maxConcurrentSessions: env.TWIKIT_MAX_CONCURRENT_SESSIONS,
      cleanupInterval: env.TWIKIT_SESSION_CLEANUP_INTERVAL,
      healthCheckInterval: env.TWIKIT_SESSION_HEALTH_CHECK_INTERVAL,
      enablePersistence: env.TWIKIT_ENABLE_SESSION_PERSISTENCE,
    },

    // Retry Configuration
    retry: {
      maxRetries: env.TWIKIT_MAX_RETRIES,
      baseDelay: env.TWIKIT_RETRY_BASE_DELAY,
      maxDelay: env.TWIKIT_RETRY_MAX_DELAY,
      exponentialBase: env.TWIKIT_RETRY_EXPONENTIAL_BASE,
      enableJitter: env.TWIKIT_RETRY_ENABLE_JITTER,
    },

    // Rate Limiting Configuration
    rateLimit: {
      enabled: env.TWIKIT_ENABLE_RATE_LIMITING,
      distributedCoordination: env.TWIKIT_ENABLE_DISTRIBUTED_COORDINATION,
      queueProcessingInterval: env.TWIKIT_RATE_LIMIT_QUEUE_INTERVAL,
      analyticsFlushInterval: env.TWIKIT_RATE_LIMIT_ANALYTICS_INTERVAL,
      profileCacheTtl: env.TWIKIT_RATE_LIMIT_PROFILE_CACHE_TTL,
      lockTtl: env.TWIKIT_RATE_LIMIT_LOCK_TTL,
      defaultAccountType: env.TWIKIT_RATE_LIMIT_DEFAULT_ACCOUNT_TYPE as 'new' | 'standard' | 'verified' | 'premium' | 'enterprise',
      warmupDurationDays: env.TWIKIT_RATE_LIMIT_WARMUP_DURATION_DAYS,
    },
  },
};

// Helper functions
export const isDevelopment = () => env.NODE_ENV === 'development';
export const isProduction = () => env.NODE_ENV === 'production';
export const isTest = () => env.NODE_ENV === 'test';
export const isStaging = () => env.NODE_ENV === 'staging';

// Export individual environment variables for backward compatibility
export const {
  NODE_ENV,
  PORT,
  DATABASE_URL,
  REDIS_URL,
  JWT_SECRET,
  FRONTEND_URL,
} = env;
