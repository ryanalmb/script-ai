// Enhanced Rate Limiting Configuration
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'redis';

const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// General API rate limiting
export const generalLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:general:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication endpoints - stricter limits
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true,
});

// Content generation - moderate limits
export const contentLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:content:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 content generations per hour
  message: {
    error: 'Content generation limit exceeded, please try again later.',
    retryAfter: '1 hour'
  },
});

// X API operations - very strict limits to comply with X API
export const xApiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:xapi:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Conservative limit for X API operations
  message: {
    error: 'X API rate limit exceeded, please wait before making more requests.',
    retryAfter: '15 minutes'
  },
});

// User-specific rate limiting (by user ID)
export const createUserLimiter = (maxRequests: number, windowMs: number) => {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:user:'
    }),
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      // Use user ID from JWT token
      return req.user?.id || req.ip;
    },
    message: {
      error: 'User rate limit exceeded, please slow down your requests.',
      retryAfter: Math.ceil(windowMs / 1000 / 60) + ' minutes'
    },
  });
};

// Export configured limiters
export const userContentLimiter = createUserLimiter(100, 60 * 60 * 1000); // 100 per hour
export const userPostLimiter = createUserLimiter(20, 60 * 60 * 1000); // 20 posts per hour
