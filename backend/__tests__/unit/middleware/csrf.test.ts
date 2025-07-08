import { Request, Response, NextFunction } from 'express';
import { CSRFProtection, DoubleSubmitCSRF } from '../../../src/middleware/csrf';
import { 
  createMockRequest, 
  createMockResponse, 
  createMockNext 
} from '../../setup';

describe('CSRF Protection Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
    
    // Clear any existing tokens
    (CSRFProtection as any).tokens.clear();
  });

  describe('CSRFProtection', () => {
    describe('generateToken', () => {
      it('should generate a valid token', () => {
        const sessionId = 'test-session-id';
        const token = CSRFProtection.generateToken(sessionId);
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes * 2 (hex)
      });

      it('should generate different tokens for different sessions', () => {
        const token1 = CSRFProtection.generateToken('session-1');
        const token2 = CSRFProtection.generateToken('session-2');
        
        expect(token1).not.toBe(token2);
      });
    });

    describe('validateToken', () => {
      it('should validate a correct token', () => {
        const sessionId = 'test-session-id';
        const token = CSRFProtection.generateToken(sessionId);
        
        const isValid = CSRFProtection.validateToken(sessionId, token);
        expect(isValid).toBe(true);
      });

      it('should reject an incorrect token', () => {
        const sessionId = 'test-session-id';
        CSRFProtection.generateToken(sessionId);
        
        const isValid = CSRFProtection.validateToken(sessionId, 'wrong-token');
        expect(isValid).toBe(false);
      });

      it('should reject token for non-existent session', () => {
        const isValid = CSRFProtection.validateToken('non-existent', 'any-token');
        expect(isValid).toBe(false);
      });

      it('should reject expired token', () => {
        const sessionId = 'test-session-id';
        const token = CSRFProtection.generateToken(sessionId);
        
        // Mock expired token by manipulating the internal tokens map
        const tokensMap = (CSRFProtection as any).tokens;
        const tokenData = tokensMap.get(sessionId);
        tokenData.expires = Date.now() - 1000; // Expired 1 second ago
        tokensMap.set(sessionId, tokenData);
        
        const isValid = CSRFProtection.validateToken(sessionId, token);
        expect(isValid).toBe(false);
      });
    });

    describe('middleware', () => {
      const middleware = CSRFProtection.middleware();

      it('should skip CSRF protection for GET requests', () => {
        req.method = 'GET';
        
        middleware(req as Request, res as Response, next);
        
        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should skip CSRF protection for HEAD requests', () => {
        req.method = 'HEAD';
        
        middleware(req as Request, res as Response, next);
        
        expect(next).toHaveBeenCalledWith();
      });

      it('should skip CSRF protection for OPTIONS requests', () => {
        req.method = 'OPTIONS';
        
        middleware(req as Request, res as Response, next);
        
        expect(next).toHaveBeenCalledWith();
      });

      it('should require CSRF token for POST requests', () => {
        req.method = 'POST';
        req.session = { id: 'test-session' };
        req.headers = {};
        req.body = {};
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: 'CSRF token required',
          code: 'CSRF_TOKEN_MISSING'
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should accept valid CSRF token in header', () => {
        const sessionId = 'test-session';
        const token = CSRFProtection.generateToken(sessionId);
        
        req.method = 'POST';
        req.session = { id: sessionId };
        req.headers = { 'x-csrf-token': token };
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should accept valid CSRF token in body', () => {
        const sessionId = 'test-session';
        const token = CSRFProtection.generateToken(sessionId);
        
        req.method = 'POST';
        req.session = { id: sessionId };
        req.headers = {};
        req.body = { _csrf: token };
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(next).toHaveBeenCalledWith();
      });

      it('should reject invalid CSRF token', () => {
        const sessionId = 'test-session';
        CSRFProtection.generateToken(sessionId);
        
        req.method = 'POST';
        req.session = { id: sessionId };
        req.headers = { 'x-csrf-token': 'invalid-token' };
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID'
        });
      });

      it('should use IP address as fallback session ID', () => {
        const token = CSRFProtection.generateToken('127.0.0.1');
        
        req.method = 'POST';
        (req as any).session = undefined;
        req.headers = { 'x-csrf-token': token };
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(next).toHaveBeenCalledWith();
      });
    });

    describe('tokenProvider', () => {
      const middleware = CSRFProtection.tokenProvider();

      it('should provide CSRF token in response header', () => {
        req.session = { id: 'test-session' };
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
        expect(res.locals?.csrfToken).toBeDefined();
        expect(next).toHaveBeenCalledWith();
      });

      it('should use IP as fallback for session ID', () => {
        (req as any).session = undefined;
        Object.defineProperty(req, 'ip', { value: '192.168.1.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
        expect(res.locals?.csrfToken).toBeDefined();
      });
    });

    describe('refreshToken', () => {
      it('should generate new token and remove old one', () => {
        const sessionId = 'test-session';
        const oldToken = CSRFProtection.generateToken(sessionId);
        
        const newToken = CSRFProtection.refreshToken(sessionId);
        
        expect(newToken).toBeDefined();
        expect(newToken).not.toBe(oldToken);
        expect(CSRFProtection.validateToken(sessionId, oldToken)).toBe(false);
        expect(CSRFProtection.validateToken(sessionId, newToken)).toBe(true);
      });
    });

    describe('revokeToken', () => {
      it('should remove token for session', () => {
        const sessionId = 'test-session';
        const token = CSRFProtection.generateToken(sessionId);
        
        expect(CSRFProtection.validateToken(sessionId, token)).toBe(true);
        
        CSRFProtection.revokeToken(sessionId);
        
        expect(CSRFProtection.validateToken(sessionId, token)).toBe(false);
      });
    });
  });

  describe('DoubleSubmitCSRF', () => {
    describe('generateToken', () => {
      it('should generate a valid token', () => {
        const token = DoubleSubmitCSRF.generateToken();
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes * 2 (hex)
      });

      it('should generate different tokens each time', () => {
        const token1 = DoubleSubmitCSRF.generateToken();
        const token2 = DoubleSubmitCSRF.generateToken();
        
        expect(token1).not.toBe(token2);
      });
    });

    describe('middleware', () => {
      const middleware = DoubleSubmitCSRF.middleware();

      it('should set CSRF cookie for GET requests', () => {
        req.method = 'GET';
        
        middleware(req as Request, res as Response, next);
        
        expect(res.cookie).toHaveBeenCalledWith(
          'csrf-token',
          expect.any(String),
          expect.objectContaining({
            httpOnly: false,
            secure: false, // NODE_ENV is test
            sameSite: 'strict',
            maxAge: 3600000
          })
        );
        expect(next).toHaveBeenCalledWith();
      });

      it('should require matching tokens for POST requests', () => {
        const token = 'test-token';
        
        req.method = 'POST';
        req.cookies = { 'csrf-token': token };
        req.headers = { 'x-csrf-token': token };
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(next).toHaveBeenCalledWith();
      });

      it('should reject mismatched tokens', () => {
        req.method = 'POST';
        req.cookies = { 'csrf-token': 'cookie-token' };
        req.headers = { 'x-csrf-token': 'header-token' };
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: 'CSRF protection failed - token mismatch',
          code: 'CSRF_TOKEN_MISMATCH'
        });
      });

      it('should reject missing tokens', () => {
        req.method = 'POST';
        req.cookies = {};
        req.headers = {};
        Object.defineProperty(req, 'ip', { value: '127.0.0.1', writable: true });
        
        middleware(req as Request, res as Response, next);
        
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: 'CSRF protection failed - tokens missing',
          code: 'CSRF_TOKENS_MISSING'
        });
      });
    });
  });
});
