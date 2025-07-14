import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Enhanced Helmet configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for some frameworks
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://api.twitter.com", 
        "https://api.x.com",
        "https://upload.twitter.com",
        "wss:"
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API usage
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // permissionsPolicy: {
  //   features: {
  //     camera: [],
  //     microphone: [],
  //     geolocation: [],
  //     payment: [],
  //     usb: [],
  //   },
  // },
});

// Rate limiting for general API requests
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Progressive delay for repeated requests
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // Allow 5 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
});

// Advanced rate limiter using Redis for distributed systems
const advancedRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_advanced',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if limit exceeded
});

export const advancedRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    await advancedRateLimiter.consume(key);
    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: secs
    });
  }
};

// Request size limiting middleware
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      logger.warn('Request size limit exceeded', {
        contentLength,
        maxBytes,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize,
        code: 'REQUEST_TOO_LARGE'
      }) as any;
    }
    
    next();
  };
};

// IP Filtering middleware
export class IPFilter {
  private static whitelist: Set<string> = new Set();
  private static blacklist: Set<string> = new Set();

  static addToWhitelist(ip: string): void {
    this.whitelist.add(ip);
    logger.info('IP added to whitelist', { ip });
  }

  static addToBlacklist(ip: string): void {
    this.blacklist.add(ip);
    logger.info('IP added to blacklist', { ip });
  }

  static removeFromWhitelist(ip: string): void {
    this.whitelist.delete(ip);
    logger.info('IP removed from whitelist', { ip });
  }

  static removeFromBlacklist(ip: string): void {
    this.blacklist.delete(ip);
    logger.info('IP removed from blacklist', { ip });
  }

  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip || req.connection.remoteAddress || '';
      
      // Check blacklist first
      if (this.blacklist.has(clientIP)) {
        logger.warn('Blocked request from blacklisted IP', { 
          ip: clientIP,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
        });
        
        res.status(403).json({
          error: 'Access denied',
          code: 'IP_BLACKLISTED'
        });
        return;
      }

      // If whitelist is not empty, check if IP is whitelisted
      if (this.whitelist.size > 0 && !this.whitelist.has(clientIP)) {
        logger.warn('Blocked request from non-whitelisted IP', { 
          ip: clientIP,
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
        });
        
        res.status(403).json({
          error: 'Access denied',
          code: 'IP_NOT_WHITELISTED'
        });
        return;
      }

      next();
    };
  }
}

// Security logging and monitoring middleware
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,  // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /exec\s*\(/i, // Code execution
    /eval\s*\(/i, // Code evaluation
    /javascript:/i, // JavaScript protocol
    /vbscript:/i, // VBScript protocol
    /data:text\/html/i, // Data URI XSS
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
  });

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(requestData) || pattern.test(req.url)
  );

  if (isSuspicious) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      body: req.body,
      query: req.query,
      suspiciousContent: requestData.substring(0, 500), // Limit logged content
    });
  }

  // Log all authentication attempts
  if (req.path.includes('/auth/') || req.path.includes('/login')) {
    logger.info('Authentication attempt', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  }

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log failed requests
    if (res.statusCode >= 400) {
      logger.warn('HTTP error response', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
      });
    }

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
      });
    }
  });

  next();
};

// Helper function to parse size strings
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1] || '0');
  const unit = match[2] || 'b';
  
  return Math.floor(value * (units[unit] || 1));
}

// Export security middleware stack
export const securityMiddleware = [
  securityHeaders,
  securityLogger,
  requestSizeLimit('10mb'),
  IPFilter.middleware(),
];

// export { IPFilter }; // Already exported above
