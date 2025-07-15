import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const { body, validationResult } = require('express-validator');

// Extended Request interface
interface ExtendedRequest extends Request {
  body: any;
  ip: string | undefined;
}
import { PrismaClient } from '@prisma/client';
import { asyncHandler, handleValidationError } from '../middleware/errorHandler';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger, logUserActivity, logSecurityEvent } from '../utils/logger';
import { CacheService } from '../config/redis';
import { xOAuthService } from '../services/xOAuthService';

const router = express.Router();
const prisma = new PrismaClient();
const cache = new CacheService();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).withMessage('New password must be at least 8 characters with uppercase, lowercase, number, and special character'),
];

// Generate JWT tokens
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Register new user
router.post('/register', registerValidation, asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleValidationError(errors.array());
  }

  const { email, username, password } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username },
      ],
    },
  });

  if (existingUser) {
    logSecurityEvent('Registration attempt with existing credentials', {
      email,
      username,
      ip: req.ip,
    }, 'medium');

    return res.status(409).json({
      error: 'User with this email or username already exists',
      code: 'USER_EXISTS',
    });
  }

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Store refresh token
  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Log activity
  logUserActivity(user.id, 'USER_REGISTERED', {
    email: user.email,
    username: user.username,
  });

  return res.status(201).json({
    message: 'User registered successfully',
    user,
    tokens: {
      accessToken,
      refreshToken,
    },
  });
}));

// Login user
router.post('/login', loginValidation, asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleValidationError(errors.array());
  }

  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      role: true,
      isActive: true,
    },
  });

  if (!user) {
    logSecurityEvent('Login attempt with non-existent email', {
      email,
      ip: req.ip,
    }, 'medium');

    return res.status(401).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
    });
  }

  if (!user.isActive) {
    logSecurityEvent('Login attempt with deactivated account', {
      userId: user.id,
      email,
      ip: req.ip,
    }, 'high');

    return res.status(401).json({
      error: 'Account deactivated',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password || '');
  if (!isPasswordValid) {
    logSecurityEvent('Login attempt with invalid password', {
      userId: user.id,
      email,
      ip: req.ip,
    }, 'high');

    return res.status(401).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
    });
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // Store refresh token
  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Log activity
  logUserActivity(user.id, 'USER_LOGIN', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  const { password: _, ...userWithoutPassword } = user;

  return res.json({
    message: 'Login successful',
    user: userWithoutPassword,
    tokens: {
      accessToken,
      refreshToken,
    },
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      error: 'Refresh token required',
      code: 'MISSING_REFRESH_TOKEN',
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

    // Find session
    const session = await prisma.userSession.findUnique({
      where: { refreshToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    if (!session.user.isActive) {
      return res.status(401).json({
        error: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Generate new tokens
    const tokens = generateTokens(session.user.id);

    // Update session with new refresh token
    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Log activity
    logUserActivity(session.user.id, 'TOKEN_REFRESHED');

    return res.json({
      message: 'Token refreshed successfully',
      tokens,
    });
  } catch (error) {
    logSecurityEvent('Invalid refresh token attempt', {
      refreshToken: refreshToken.substring(0, 20) + '...',
      ip: req.ip,
    }, 'high');

    return res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN',
    });
  }
}));

// Logout
router.post('/logout', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Delete specific session
    await prisma.userSession.deleteMany({
      where: {
        userId: req.user!.id,
        refreshToken,
      },
    });
  } else {
    // Delete all sessions for user
    await prisma.userSession.deleteMany({
      where: {
        userId: req.user!.id,
      },
    });
  }

  // Log activity
  logUserActivity(req.user!.id, 'USER_LOGOUT');

  return res.json({
    message: 'Logout successful',
  });
}));

// Change password
router.post('/change-password', authMiddleware, changePasswordValidation, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleValidationError(errors.array());
  }

  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND',
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password || '');
  if (!isCurrentPasswordValid) {
    logSecurityEvent('Password change attempt with invalid current password', {
      userId: user.id,
      ip: req.ip,
    }, 'high');

    return res.status(401).json({
      error: 'Current password is incorrect',
      code: 'INVALID_CURRENT_PASSWORD',
    });
  }

  // Hash new password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedNewPassword },
  });

  // Invalidate all sessions except current one
  await prisma.userSession.deleteMany({
    where: {
      userId: user.id,
    },
  });

  // Log activity
  logUserActivity(user.id, 'PASSWORD_CHANGED');

  return res.json({
    message: 'Password changed successfully',
  });
}));

// Get current user profile
router.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          accounts: true,
          campaigns: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND',
    });
  }

  return res.json({
    user,
  });
}));

// Telegram authentication endpoint
router.post('/telegram', asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { telegram_id, auth_token } = req.body;

  if (!telegram_id || !auth_token) {
    return res.status(400).json({
      success: false,
      error: 'Telegram ID and auth token are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    // For now, we'll create a simple authentication flow
    // In a real implementation, you would validate the auth_token against your X API

    // Check if user already exists with this telegram_id
    let user = await prisma.user.findFirst({
      where: {
        // We'll store telegram_id in username for now, or create a separate telegram_users table
        username: `telegram_${telegram_id}`
      }
    });

    if (!user) {
      // Create new user for this Telegram ID
      user = await prisma.user.create({
        data: {
          email: `telegram_${telegram_id}@temp.local`,
          username: `telegram_${telegram_id}`,
          password: await bcrypt.hash(auth_token, 12), // Use auth_token as password for now
        }
      });

      logUserActivity(user.id, 'TELEGRAM_USER_CREATED', {
        telegram_id,
        created_via: 'telegram_bot'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log activity
    logUserActivity(user.id, 'TELEGRAM_LOGIN', {
      telegram_id,
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: 'Authentication successful',
      xUsername: user.username,
      plan: 'Free',
      tokens: {
        accessToken,
        refreshToken,
      },
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      }
    });

  } catch (error) {
    logger.error('Telegram authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}));

// X OAuth 2.0 Routes

// Start OAuth flow
router.post('/x/oauth/start', asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { telegram_user_id } = req.body;

  if (!telegram_user_id) {
    return res.status(400).json({
      success: false,
      error: 'Telegram user ID is required',
      code: 'MISSING_TELEGRAM_USER_ID'
    });
  }

  try {
    if (!xOAuthService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'X API OAuth is not configured. Please contact administrator.',
        code: 'OAUTH_NOT_CONFIGURED'
      });
    }

    const { authUrl, sessionId } = await xOAuthService.startOAuthFlow(telegram_user_id, req);

    logUserActivity(telegram_user_id, 'OAUTH_FLOW_STARTED', {
      sessionId,
      ip: req.ip
    });

    return res.json({
      success: true,
      authUrl,
      sessionId,
      message: 'OAuth flow started successfully'
    });

  } catch (error) {
    logger.error('OAuth start failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start OAuth flow',
      code: 'OAUTH_START_FAILED'
    });
  }
}));

// OAuth callback handler
router.get('/x/callback', asyncHandler(async (req: Request, res: Response) => {
  const { oauth_token, oauth_verifier, denied } = req.query;

  // Handle user denial
  if (denied) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/denied`);
  }

  if (!oauth_token || !oauth_verifier) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>❌ OAuth Error</h2>
          <p>Missing required OAuth parameters</p>
          <p>Please try the authentication process again.</p>
        </body>
      </html>
    `);
  }

  try {
    const result = await xOAuthService.handleCallback(
      oauth_token as string,
      oauth_verifier as string,
      req
    );

    if (result.success && result.tokens) {
      // Success page
      return res.send(`
        <html>
          <head>
            <title>Authentication Successful</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .success { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
              .success h2 { color: #1DA1F2; margin-bottom: 20px; }
              .token { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 20px 0; }
              .close-btn { background: #1DA1F2; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="success">
              <h2>✅ Authentication Successful!</h2>
              <p>Your X account <strong>@${result.tokens.screenName}</strong> has been successfully connected.</p>
              <p>You can now return to the Telegram bot to continue.</p>
              <div class="token">
                <strong>Session ID:</strong> ${result.sessionId}
              </div>
              <button class="close-btn" onclick="window.close()">Close Window</button>
            </div>
            <script>
              // Auto-close after 5 seconds
              setTimeout(() => window.close(), 5000);
            </script>
          </body>
        </html>
      `);
    } else {
      // Error page
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>❌ Authentication Failed</h2>
            <p>${result.error || 'Unknown error occurred'}</p>
            <p>Please try the authentication process again.</p>
            <button onclick="window.close()">Close Window</button>
          </body>
        </html>
      `);
    }

  } catch (error) {
    logger.error('OAuth callback error:', error);
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>❌ Server Error</h2>
          <p>An error occurred during authentication</p>
          <p>Please try again later.</p>
          <button onclick="window.close()">Close Window</button>
        </body>
      </html>
    `);
  }
}));

// Check OAuth session status
router.get('/x/oauth/status/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Session ID is required',
      code: 'MISSING_SESSION_ID'
    });
  }

  try {
    const session = await xOAuthService.getSessionStatus(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        state: session.state,
        expiresAt: session.expiresAt,
        telegramUserId: session.telegramUserId
      }
    });

  } catch (error) {
    logger.error('OAuth status check failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check session status',
      code: 'STATUS_CHECK_FAILED'
    });
  }
}));

// Enterprise Security Monitoring Endpoints

// Get OAuth security metrics (Admin only)
router.get('/x/oauth/security/metrics', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Check if user has admin privileges (implement your admin check logic)
  const isAdmin = req.user?.role === 'admin' || req.user?.email?.includes('admin');

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'INSUFFICIENT_PRIVILEGES'
    });
  }

  try {
    const metrics = xOAuthService.getSecurityMetrics();

    return res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get OAuth security metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve security metrics',
      code: 'METRICS_RETRIEVAL_FAILED'
    });
  }
}));

// Revoke OAuth session (Admin only)
router.post('/x/oauth/security/revoke/:sessionId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId } = req.params;
  const { reason } = req.body;

  // Check if user has admin privileges
  const isAdmin = req.user?.role === 'admin' || req.user?.email?.includes('admin');

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'INSUFFICIENT_PRIVILEGES'
    });
  }

  if (!sessionId || !reason) {
    return res.status(400).json({
      success: false,
      error: 'Session ID and reason are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const revoked = await xOAuthService.revokeSession(sessionId, reason);

    if (revoked) {
      return res.json({
        success: true,
        message: 'Session revoked successfully',
        sessionId,
        reason
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

  } catch (error) {
    logger.error('Failed to revoke OAuth session:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke session',
      code: 'REVOCATION_FAILED'
    });
  }
}));

// Development Helper Endpoints (Development Only)

// Clear rate limits for development
router.post('/x/oauth/dev/clear-rate-limits', asyncHandler(async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Development endpoints not available in production',
      code: 'PRODUCTION_MODE'
    });
  }

  try {
    const { telegram_user_id, ip_address } = req.body;

    if (telegram_user_id) {
      // Clear rate limit for specific user
      const cleared = xOAuthService.clearRateLimit(telegram_user_id, ip_address);
      return res.json({
        success: true,
        message: cleared ? 'Rate limit cleared for user' : 'No rate limit found for user',
        telegram_user_id,
        ip_address
      });
    } else {
      // Clear all rate limits
      const cleared = xOAuthService.clearAllRateLimits();
      return res.json({
        success: true,
        message: 'All rate limits cleared',
        cleared
      });
    }

  } catch (error) {
    logger.error('Failed to clear rate limits:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear rate limits',
      code: 'CLEAR_FAILED'
    });
  }
}));

export default router;
