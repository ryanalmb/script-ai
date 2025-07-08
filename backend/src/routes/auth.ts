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
  const isPasswordValid = await bcrypt.compare(password, user.password);
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
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
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

export default router;
