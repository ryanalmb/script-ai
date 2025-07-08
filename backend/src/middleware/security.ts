import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

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
