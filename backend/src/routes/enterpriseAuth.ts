import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { EnterpriseAuthService } from '../services/enterpriseAuthService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();
const authService = new EnterpriseAuthService();

// Enhanced login with risk assessment and MFA
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('mfaToken').optional().isLength({ min: 6, max: 6 }),
  body('rememberMe').optional().isBoolean()
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email, password, mfaToken, rememberMe } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.password || !await authService.verifyPassword(password, user.password)) {
      // Log failed attempt
      if (user) {
        await authService.logSecurityEvent({
          userId: user.id,
          event: 'LOGIN_FAILED',
          ipAddress,
          userAgent,
          timestamp: new Date(),
          success: false,
          metadata: { reason: 'invalid_credentials' }
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      await authService.logSecurityEvent({
        userId: user.id,
        event: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        timestamp: new Date(),
        success: false,
        metadata: { reason: 'account_disabled' }
      });

      return res.status(401).json({
        success: false,
        error: 'Account is disabled'
      });
    }

    // Assess login risk
    const riskAssessment = await authService.assessLoginRisk(user.id, ipAddress, userAgent);

    // Check if MFA is required
    if (riskAssessment.requiresMFA) {
      if (!mfaToken) {
        return res.status(200).json({
          success: false,
          requiresMFA: true,
          riskLevel: riskAssessment.riskLevel,
          message: 'MFA token required'
        });
      }

      // Verify MFA token
      const isMFAValid = await authService.verifyMFA(user.id, mfaToken);
      if (!isMFAValid) {
        await authService.logSecurityEvent({
          userId: user.id,
          event: 'MFA_FAILED',
          ipAddress,
          userAgent,
          timestamp: new Date(),
          success: false
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid MFA token'
        });
      }
    }

    // Generate session and tokens
    const sessionId = authService.generateSessionId();
    const tokens = await authService.generateTokens(user.id, sessionId);

    // Log successful login
    await authService.logSecurityEvent({
      userId: user.id,
      event: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success: true,
      metadata: { 
        riskLevel: riskAssessment.riskLevel,
        mfaUsed: !!mfaToken
      }
    });

    // Set secure cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 7 days or 1 day
    };

    res.cookie('accessToken', tokens.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 minutes
    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        mfaEnabled: user.mfaEnabled
      },
      tokens,
      riskLevel: riskAssessment.riskLevel
    });

  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}));

// Setup MFA
router.post('/mfa/setup', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const mfaSetup = await authService.setupMFA(userId);

    await authService.logSecurityEvent({
      userId,
      event: 'MFA_SETUP_INITIATED',
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent') || '',
      timestamp: new Date(),
      success: true
    });

    return res.json({
      success: true,
      qrCode: mfaSetup.qrCode,
      backupCodes: mfaSetup.backupCodes,
      message: 'Scan the QR code with your authenticator app and verify with a token to enable MFA'
    });

  } catch (error) {
    logger.error('MFA setup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to setup MFA'
    });
  }
}));

// Enable MFA
router.post('/mfa/enable', [
  authMiddleware,
  body('token').isLength({ min: 6, max: 6 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const userId = req.user!.id;
    const { token } = req.body;

    await authService.enableMFA(userId, token);

    return res.json({
      success: true,
      message: 'MFA enabled successfully'
    });

  } catch (error) {
    logger.error('MFA enable error:', error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enable MFA'
    });
  }
}));

// Disable MFA
router.post('/mfa/disable', [
  authMiddleware,
  body('password').isLength({ min: 8 }),
  body('token').isLength({ min: 6, max: 6 })
], asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const userId = req.user!.id;
    const { password, token } = req.body;

    // Verify password
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password || !await authService.verifyPassword(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Verify MFA token
    const isMFAValid = await authService.verifyMFA(userId, token);
    if (!isMFAValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid MFA token'
      });
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: []
      }
    });

    await authService.logSecurityEvent({
      userId,
      event: 'MFA_DISABLED',
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent') || '',
      timestamp: new Date(),
      success: true
    });

    return res.json({
      success: true,
      message: 'MFA disabled successfully'
    });

  } catch (error) {
    logger.error('MFA disable error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to disable MFA'
    });
  }
}));

// Get security events
router.get('/security/events', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const events = await prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        event: true,
        ipAddress: true,
        location: true,
        success: true,
        timestamp: true
      }
    });

    const total = await prisma.securityEvent.count({
      where: { userId }
    });

    return res.json({
      success: true,
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Security events error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch security events'
    });
  }
}));

// Logout (invalidate session)
router.post('/logout', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    await authService.logSecurityEvent({
      userId,
      event: 'LOGOUT',
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent') || '',
      timestamp: new Date(),
      success: true
    });

    return res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to logout'
    });
  }
}));

// Register new user with enterprise security
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email, username, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await authService.hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: 'USER',
        isActive: true
      }
    });

    // Log registration
    await authService.logSecurityEvent({
      userId: user.id,
      event: 'USER_REGISTERED',
      ipAddress,
      userAgent,
      timestamp: new Date(),
      success: true
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
}));

export default router;
