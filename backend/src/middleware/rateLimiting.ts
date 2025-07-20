import rateLimit from 'express-rate-limit';
// import RedisStore from 'rate-limit-redis';
// import Redis from 'redis';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Redis client for rate limiting (disabled for testing)
// const redis = Redis.createClient({
//   url: process.env.REDIS_URL || 'redis://localhost:6379',
// });

// redis.on('error', (err) => {
//   logger.error('Redis rate limiting error:', err);
// });

// redis.on('connect', () => {
//   logger.info('Redis rate limiting connected');
// });

// Initialize Redis connection
// redis.connect().catch(err => {
//   logger.error('Failed to connect Redis for rate limiting:', err);
// });

// General API rate limiting
export const generalLimiter = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.sendCommand(args),
  //   prefix: 'rl:general:'
  // }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }

    // Skip rate limiting for authenticated services
    const serviceAuth = req.headers['x-service-auth'];
    const authHeader = req.headers.authorization;
    const serviceToken = process.env.SERVICE_TOKEN || process.env.JWT_SECRET;

    if (serviceAuth && authHeader && serviceToken) {
      try {
        const token = authHeader.replace('Bearer ', '');
        // Verify service token matches
        if (token === serviceToken && ['telegram-bot', 'llm-service', 'frontend'].includes(serviceAuth as string)) {
          return true; // Skip rate limiting for authenticated services
        }
      } catch (error) {
        // Continue with rate limiting if token verification fails
      }
    }

    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  },
});

// Authentication endpoints - stricter limits
export const authLimiter = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.sendCommand(args),
  //   prefix: 'rl:auth:'
  // }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true,
  skip: (req) => {
    // Skip rate limiting for authenticated services
    const serviceAuth = req.headers['x-service-auth'];
    const authHeader = req.headers.authorization;
    const serviceToken = process.env.SERVICE_TOKEN || process.env.JWT_SECRET;

    if (serviceAuth && authHeader && serviceToken) {
      try {
        const token = authHeader.replace('Bearer ', '');
        // Verify service token matches
        if (token === serviceToken && ['telegram-bot', 'llm-service', 'frontend'].includes(serviceAuth as string)) {
          return true; // Skip rate limiting for authenticated services
        }
      } catch (error) {
        // Continue with rate limiting if token verification fails
      }
    }

    return false;
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    });
  },
});

// Content generation - moderate limits
export const contentLimiter = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.sendCommand(args),
  //   prefix: 'rl:content:'
  // }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 content generations per hour
  message: {
    error: 'Content generation limit exceeded, please try again later.',
    retryAfter: '1 hour',
    code: 'CONTENT_RATE_LIMIT_EXCEEDED'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Content generation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      error: 'Content generation limit exceeded, please try again later.',
      retryAfter: '1 hour',
      code: 'CONTENT_RATE_LIMIT_EXCEEDED'
    });
  },
});

// X API operations - very strict limits to comply with X API
export const xApiLimiter = rateLimit({
  // store: new RedisStore({
  //   sendCommand: (...args: string[]) => redis.sendCommand(args),
  //   prefix: 'rl:xapi:'
  // }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Conservative limit for X API operations
  message: {
    error: 'X API rate limit exceeded, please wait before making more requests.',
    retryAfter: '15 minutes',
    code: 'X_API_RATE_LIMIT_EXCEEDED'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('X API rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(429).json({
      error: 'X API rate limit exceeded, please wait before making more requests.',
      retryAfter: '15 minutes',
      code: 'X_API_RATE_LIMIT_EXCEEDED'
    });
  },
});

// User-specific rate limiting (by user ID)
export const createUserLimiter = (maxRequests: number, windowMs: number) => {
  return rateLimit({
    // store: new RedisStore({
    //   sendCommand: (...args: string[]) => redis.sendCommand(args),
    //   prefix: 'rl:user:'
    // }),
    windowMs,
    max: maxRequests,
    keyGenerator: (req: any) => {
      // Use user ID from JWT token
      return req.user?.id || req.ip;
    },
    message: {
      error: 'User rate limit exceeded, please slow down your requests.',
      retryAfter: Math.ceil(windowMs / 1000 / 60) + ' minutes',
      code: 'USER_RATE_LIMIT_EXCEEDED'
    },
    handler: (req: Request, res: Response) => {
      logger.warn('User rate limit exceeded', {
        ip: req.ip,
        userId: (req as any).user?.id,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(429).json({
        error: 'User rate limit exceeded, please slow down your requests.',
        retryAfter: Math.ceil(windowMs / 1000 / 60) + ' minutes',
        code: 'USER_RATE_LIMIT_EXCEEDED'
      });
    },
  });
};

// Export configured limiters
export const userContentLimiter = createUserLimiter(100, 60 * 60 * 1000); // 100 per hour
export const userPostLimiter = createUserLimiter(20, 60 * 60 * 1000); // 20 posts per hour

// Cleanup function for graceful shutdown
export const cleanupRateLimiting = async () => {
  try {
    // await redis.disconnect();
    logger.info('Redis rate limiting disconnected (disabled for testing)');
  } catch (error) {
    logger.error('Error disconnecting Redis rate limiting:', error);
  }
};
