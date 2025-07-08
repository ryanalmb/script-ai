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
