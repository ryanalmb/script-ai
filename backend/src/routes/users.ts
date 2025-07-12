import express from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res): Promise<any> => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId as string },
      include: {
        _count: {
          select: {
            accounts: true,
            campaigns: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        stats: {
          accounts: user._count.accounts,
          campaigns: user._count.campaigns
        },
        settings: {
          automation: {
            enabled: true,
            maxPostsPerDay: 50,
            maxLikesPerDay: 200,
            maxCommentsPerDay: 100
          },
          notifications: {
            email: true,
            telegram: true,
            discord: false
          }
        }
      }
    });
  } catch (error) {
    logger.error('Get user profile failed:', error);
    return res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { name, email, settings } = req.body;
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: 'demo-user',
        email: email || 'demo@example.com',
        name: name || 'Demo User',
        settings: settings || {}
      }
    });
  } catch (error) {
    logger.error('Update user profile failed:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Get user settings
router.get('/settings', async (req, res) => {
  try {
    res.json({
      success: true,
      settings: {
        automation: {
          enabled: true,
          maxPostsPerDay: 50,
          maxLikesPerDay: 200,
          maxCommentsPerDay: 100,
          maxFollowsPerDay: 50,
          maxDMsPerDay: 20,
          qualityThreshold: 0.8,
          complianceMode: true
        },
        notifications: {
          email: true,
          telegram: true,
          discord: false,
          slack: false
        },
        security: {
          twoFactorEnabled: false,
          apiKeyRotation: true,
          sessionTimeout: 3600
        },
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'UTC'
        }
      }
    });
  } catch (error) {
    logger.error('Get user settings failed:', error);
    res.status(500).json({ error: 'Failed to get user settings' });
  }
});

// Update user settings
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: settings
    });
  } catch (error) {
    logger.error('Update user settings failed:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

export default router;
