import express, { Request, Response } from 'express';
const { body, validationResult, param } = require('express-validator');

// Extended Request interface
interface ExtendedRequest extends Request {
  body: any;
  ip: string | undefined;
}
import { PrismaClient } from '@prisma/client';
import { asyncHandler, handleValidationError, handleNotFoundError } from '../middleware/errorHandler';
import { logger, logUserActivity } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import { XApiClient } from '../services/xApiClient';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

// Validation rules
const addAccountValidation = [
  body('username').isLength({ min: 1, max: 15 }).withMessage('Username must be 1-15 characters'),
  body('accessToken').notEmpty().withMessage('Access token is required'),
  body('accessTokenSecret').notEmpty().withMessage('Access token secret is required'),
  body('displayName').optional().isLength({ max: 50 }).withMessage('Display name must be max 50 characters'),
  body('proxyId').optional().isUUID().withMessage('Invalid proxy ID'),
];

const updateAccountValidation = [
  body('displayName').optional().isLength({ max: 50 }).withMessage('Display name must be max 50 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('proxyId').optional().isUUID().withMessage('Invalid proxy ID'),
];

// Encryption helper
const encrypt = (text: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0] || '', 'hex');
  const encrypted = parts[1] || '';
  
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Get all accounts for user
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accounts = await prisma.xAccount.findMany({
    where: {
      userId: req.user!.id,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      accountId: true,
      isActive: true,
      isVerified: true,
      isSuspended: true,
      suspensionReason: true,
      followersCount: true,
      followingCount: true,
      tweetsCount: true,
      likesCount: true,
      lastActivity: true,
      createdAt: true,
      updatedAt: true,
      proxy: {
        select: {
          id: true,
          host: true,
          port: true,
          type: true,
          isActive: true,
        },
      },
      _count: {
        select: {
          posts: true,
          automations: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    accounts,
    total: accounts.length,
  });
}));

// Get active account
router.get('/active', async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const activeAccount = await prisma.xAccount.findFirst({
      where: {
        userId: userId,
        isActive: true
      }
    });

    if (!activeAccount) {
      return res.status(404).json({
        success: false,
        error: 'No active account found'
      });
    }

    return res.json({
      success: true,
      account: {
        id: activeAccount.id,
        username: activeAccount.username,
        displayName: activeAccount.displayName,
        isActive: activeAccount.isActive,
        followers: activeAccount.followersCount,
        following: activeAccount.followingCount,
        status: 'Active',
        connectedAt: activeAccount.createdAt,
        lastActivity: activeAccount.lastActivity,
        automationEnabled: true, // Default for now
        apiStatus: '✅ Connected',
        rateLimitStatus: '✅ Normal',
        engagementRate: 0.042 // Mock data for now
      }
    });
  } catch (error) {
    logger.error('Get active account failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get active account'
    });
  }
});

// Get single account
router.get('/:id', param('id').isUUID(), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleValidationError(errors.array());
  }

  const account = await prisma.xAccount.findFirst({
    where: {
      id: req.params.id || '',
      userId: req.user!.id,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      phone: true,
      accountId: true,
      isActive: true,
      isVerified: true,
      isSuspended: true,
      suspensionReason: true,
      followersCount: true,
      followingCount: true,
      tweetsCount: true,
      likesCount: true,
      lastActivity: true,
      createdAt: true,
      updatedAt: true,
      proxy: {
        select: {
          id: true,
          host: true,
          port: true,
          type: true,
          isActive: true,
        },
      },
      fingerprint: {
        select: {
          id: true,
          userAgent: true,
          viewport: true,
          timezone: true,
          language: true,
          platform: true,
        },
      },
      _count: {
        select: {
          posts: true,
          automations: true,
          analytics: true,
        },
      },
    },
  });

  if (!account) {
    throw handleNotFoundError('Account');
  }

  res.json({ account });
}));

// Add new account
router.post('/', addAccountValidation, asyncHandler(async (req: AuthenticatedRequest & { body: any }, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleValidationError(errors.array());
  }

  const { username, accessToken, accessTokenSecret, displayName, proxyId } = req.body;

  // Check if account already exists
  const existingAccount = await prisma.xAccount.findFirst({
    where: {
      OR: [
        { username },
        { userId: req.user!.id, username },
      ],
    },
  });

  if (existingAccount) {
    return res.status(409).json({
      error: 'Account with this username already exists',
      code: 'ACCOUNT_EXISTS',
    });
  }

  // Verify account with X API
  try {
    const xApiClient = new XApiClient({
      apiKey: process.env.X_API_KEY!,
      apiSecret: process.env.X_API_SECRET!,
      accessToken,
      accessTokenSecret,
      bearerToken: process.env.X_BEARER_TOKEN || '',
    });

    const userInfo = await xApiClient.getCurrentUser();

    // Create account
    const account = await prisma.xAccount.create({
      data: {
        userId: req.user!.id,
        username,
        displayName: displayName || userInfo.name,
        accountId: userInfo.id,
        accessToken: encrypt(accessToken),
        accessTokenSecret: encrypt(accessTokenSecret),
        isVerified: userInfo.verified,
        followersCount: userInfo.public_metrics.followers_count,
        followingCount: userInfo.public_metrics.following_count,
        tweetsCount: userInfo.public_metrics.tweet_count,
        proxyId,
        lastActivity: new Date(),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        accountId: true,
        isActive: true,
        isVerified: true,
        followersCount: true,
        followingCount: true,
        tweetsCount: true,
        createdAt: true,
      },
    });

    // Log activity
    logUserActivity(req.user!.id, 'ACCOUNT_ADDED', {
      accountId: account.id,
      username: account.username,
    });

    return res.status(201).json({
      message: 'Account added successfully',
      account,
    });
  } catch (error) {
    logger.error('Failed to verify X account:', error);
    return res.status(400).json({
      error: 'Failed to verify account credentials',
      code: 'INVALID_CREDENTIALS',
    });
  }
}));

// Update account
router.put('/:id', param('id').isUUID(), updateAccountValidation, asyncHandler(async (req: AuthenticatedRequest & { body: any }, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleValidationError(errors.array());
  }

  const { displayName, isActive, proxyId } = req.body;

  const account = await prisma.xAccount.findFirst({
    where: {
      id: req.params.id || '',
      userId: req.user!.id,
    },
  });

  if (!account) {
    throw handleNotFoundError('Account');
  }

  const updatedAccount = await prisma.xAccount.update({
    where: {
      id: req.params.id || '',
    },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(isActive !== undefined && { isActive }),
      ...(proxyId !== undefined && { proxyId }),
      updatedAt: new Date(),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      isActive: true,
      proxyId: true,
      updatedAt: true,
    },
  });

  // Log activity
  logUserActivity(req.user!.id, 'ACCOUNT_UPDATED', {
    accountId: updatedAccount.id,
    changes: { displayName, isActive, proxyId },
  });

  res.json({
    message: 'Account updated successfully',
    account: updatedAccount,
  });
}));

// Delete account
router.delete('/:id', param('id').isUUID(), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw handleValidationError(errors.array());
  }

  const account = await prisma.xAccount.findFirst({
    where: {
      id: req.params.id || '',
      userId: req.user!.id,
    },
  });

  if (!account) {
    throw handleNotFoundError('Account');
  }

  await prisma.xAccount.delete({
    where: {
      id: req.params.id || '',
    },
  });

  // Log activity
  logUserActivity(req.user!.id, 'ACCOUNT_DELETED', {
    accountId: account.id,
    username: account.username,
  });

  res.json({
    message: 'Account deleted successfully',
  });
}));

// Activate account (set as active)
router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify the account belongs to the user
    const account = await prisma.xAccount.findFirst({
      where: {
        id: id,
        userId: userId
      }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Deactivate all other accounts for this user
    await prisma.xAccount.updateMany({
      where: {
        userId: userId
      },
      data: {
        isActive: false
      }
    });

    // Activate the target account
    const updatedAccount = await prisma.xAccount.update({
      where: { id },
      data: {
        isActive: true,
        lastActivity: new Date()
      }
    });

    return res.json({
      success: true,
      message: 'Account activated successfully',
      account: {
        id: updatedAccount.id,
        username: updatedAccount.username,
        displayName: updatedAccount.displayName,
        isActive: updatedAccount.isActive,
        followers: updatedAccount.followersCount,
        following: updatedAccount.followingCount,
        status: 'Active',
        connectedAt: updatedAccount.createdAt,
        automationEnabled: true // Default for now
      }
    });
  } catch (error) {
    logger.error('Account activation failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to activate account'
    });
  }
});

export default router;
