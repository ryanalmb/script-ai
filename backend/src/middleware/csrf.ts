import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Extend Request interface to include session
declare module 'express-serve-static-core' {
  interface Request {
    session?: {
      id?: string;
    };
  }
}

// CSRF Protection Implementation
export class CSRFProtection {
  private static tokens = new Map<string, { token: string; expires: number }>();
  private static readonly TOKEN_EXPIRY = 3600000; // 1 hour

  static generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + this.TOKEN_EXPIRY;
    
    this.tokens.set(sessionId, { token, expires });
    
    // Clean up expired tokens periodically
    this.cleanupExpiredTokens();
    
    return token;
  }

  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored) {
      logger.warn('CSRF token not found for session', { sessionId });
      return false;
    }
    
    if (Date.now() > stored.expires) {
      this.tokens.delete(sessionId);
      logger.warn('CSRF token expired', { sessionId });
      return false;
    }
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(stored.token),
        Buffer.from(token)
      );
    } catch (error) {
      logger.warn('CSRF token comparison failed', { sessionId, error });
      return false;
    }
  }

  static refreshToken(sessionId: string): string {
    // Remove old token and generate new one
    this.tokens.delete(sessionId);
    return this.generateToken(sessionId);
  }

  static revokeToken(sessionId: string): void {
    this.tokens.delete(sessionId);
  }

  private static cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, tokenData] of this.tokens.entries()) {
      if (now > tokenData.expires) {
        this.tokens.delete(sessionId);
      }
    }
  }

  // Middleware for CSRF protection
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF protection for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const sessionId = req.session?.id || req.ip;
      const token = req.headers['x-csrf-token'] as string || req.body._csrf;

      if (!token) {
        logger.warn('CSRF token missing', {
          sessionId,
          method: req.method,
          path: req.path,
          ip: req.ip,
        });
        
        return res.status(403).json({
          error: 'CSRF token required',
          code: 'CSRF_TOKEN_MISSING'
        }) as any;
      }

      if (!this.validateToken(sessionId || '', token)) {
        logger.warn('CSRF token validation failed', {
          sessionId,
          method: req.method,
          path: req.path,
          ip: req.ip,
        });
        
        return res.status(403).json({
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID'
        }) as any;
      }

      next();
    };
  }

  // Middleware to provide CSRF token to client
  static tokenProvider() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sessionId = req.session?.id || req.ip;
      const token = this.generateToken(sessionId || '');
      
      // Add token to response headers
      res.setHeader('X-CSRF-Token', token);
      
      // Also make it available in locals for template rendering
      res.locals.csrfToken = token;
      
      next();
    };
  }
}

// Double Submit Cookie Pattern (Alternative CSRF protection)
export class DoubleSubmitCSRF {
  private static readonly COOKIE_NAME = 'csrf-token';
  private static readonly HEADER_NAME = 'x-csrf-token';

  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF protection for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        // For safe methods, set the CSRF token cookie
        const token = this.generateToken();
        res.cookie(this.COOKIE_NAME, token, {
          httpOnly: false, // Client needs to read this for CSRF protection
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 3600000, // 1 hour
        });
        return next();
      }

      const cookieToken = req.cookies[this.COOKIE_NAME];
      const headerToken = req.headers[this.HEADER_NAME] as string || req.body._csrf;

      if (!cookieToken || !headerToken) {
        logger.warn('CSRF double submit tokens missing', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          hasCookie: !!cookieToken,
          hasHeader: !!headerToken,
        });
        
        return res.status(403).json({
          error: 'CSRF protection failed - tokens missing',
          code: 'CSRF_TOKENS_MISSING'
        });
      }

      try {
        if (!crypto.timingSafeEqual(
          Buffer.from(cookieToken),
          Buffer.from(headerToken)
        )) {
          logger.warn('CSRF double submit tokens mismatch', {
            method: req.method,
            path: req.path,
            ip: req.ip,
          });
          
          return res.status(403).json({
            error: 'CSRF protection failed - token mismatch',
            code: 'CSRF_TOKEN_MISMATCH'
          });
        }
      } catch (error) {
        logger.warn('CSRF token comparison error', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          error,
        });
        
        return res.status(403).json({
          error: 'CSRF protection failed - invalid tokens',
          code: 'CSRF_TOKENS_INVALID'
        });
      }

      next();
    };
  }
}

// Export the preferred CSRF protection method
export const csrfProtection = CSRFProtection.middleware();
export const csrfTokenProvider = CSRFProtection.tokenProvider();
