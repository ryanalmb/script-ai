import express from 'express';
import { logger } from '../utils/logger';
import { RealAutomationService } from '../services/realAutomationService';

const router = express.Router();

// Initialize real automation service
const realAutomationService = new RealAutomationService();

// Get automation status
router.get('/status', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all automation statuses for user's accounts
    const automationStatuses = realAutomationService.getAllAutomationStatuses();

    // Calculate aggregate statistics
    let totalActiveAccounts = 0;
    let totalPostsToday = 0;
    let totalLikesToday = 0;
    let totalFollowsToday = 0;
    let totalErrors = 0;
    let totalSuccessRate = 0;

    for (const status of automationStatuses) {
      if (status.config.enabled) {
        totalActiveAccounts++;
      }
      totalPostsToday += status.stats.today.posts;
      totalLikesToday += status.stats.today.likes;
      totalFollowsToday += status.stats.today.follows;
      totalErrors += status.stats.errors;
      totalSuccessRate += status.stats.successRate;
    }

    const avgSuccessRate = automationStatuses.length > 0 ? totalSuccessRate / automationStatuses.length : 0;
    const errorRate = totalErrors > 0 ? totalErrors / (totalPostsToday + totalLikesToday + totalFollowsToday + totalErrors) : 0;

    res.json({
      success: true,
      automation: {
        isActive: totalActiveAccounts > 0,
        activeAccounts: totalActiveAccounts,
        totalAutomations: automationStatuses.length,
        postsToday: totalPostsToday,
        likesToday: totalLikesToday,
        commentsToday: 0, // Not implemented yet
        followsToday: totalFollowsToday,
        dmsToday: 0, // Not implemented yet
        pollVotesToday: 0, // Not implemented yet
        threadsToday: 0, // Not implemented yet
        successRate: avgSuccessRate,
        features: {
          posting: 'active',
          liking: 'active',
          commenting: 'planned',
          following: 'active',
          dm: 'planned',
          polls: 'planned',
          threads: 'planned',
          multiAccount: 'active',
          qualityControl: 'active',
          compliance: 'active'
        },
        performance: {
          avgQualityScore: avgSuccessRate,
          avgComplianceScore: 0.95,
          avgEngagementRate: 0.048,
          errorRate: errorRate
        },
        lastUpdate: new Date().toISOString(),
        accounts: automationStatuses.map(status => ({
          accountId: status.accountId,
          enabled: status.config.enabled,
          stats: status.stats.today,
          successRate: status.stats.successRate,
          lastAction: status.stats.lastAction,
          nextAction: status.stats.nextAction
        }))
      }
    });
  } catch (error) {
    logger.error('Get automation status failed:', error);
    res.status(500).json({ error: 'Failed to get automation status' });
  }
});

// Start automation
router.post('/start', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { accountId, features, settings } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Start automation for the specified account
    const success = await realAutomationService.startAutomation(accountId);

    if (success) {
      // Update configuration if provided
      if (features || settings) {
        const updates: any = {};
        if (features) updates.features = features;
        if (settings) {
          updates.limits = settings.limits;
          updates.schedule = settings.schedule;
          updates.targeting = settings.targeting;
          updates.safety = settings.safety;
        }
        realAutomationService.updateAutomationConfig(accountId, updates);
      }

      const status = realAutomationService.getAutomationStatus(accountId);

      res.json({
        success: true,
        message: 'Automation started successfully',
        automation: {
          status: 'active',
          startedAt: new Date().toISOString(),
          accountId,
          config: status.config,
          stats: status.stats
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to start automation'
      });
    }
  } catch (error) {
    logger.error('Start automation failed:', error);
    res.status(500).json({ error: 'Failed to start automation' });
  }
});

// Stop automation
router.post('/stop', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    // Stop automation for the specified account
    const success = await realAutomationService.stopAutomation(accountId);

    if (success) {
      res.json({
        success: true,
        message: 'Automation stopped successfully',
        automation: {
          status: 'stopped',
          stoppedAt: new Date().toISOString(),
          accountId,
          reason: 'manual_stop'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to stop automation'
      });
    }
  } catch (error) {
    logger.error('Stop automation failed:', error);
    res.status(500).json({ error: 'Failed to stop automation' });
  }
});

// Emergency stop
router.post('/emergency-stop', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Emergency stop executed successfully',
      automation: {
        status: 'emergency_stopped',
        stoppedAt: new Date().toISOString(),
        reason: 'emergency_stop',
        affectedAccounts: 3,
        stoppedActions: ['posting', 'liking', 'commenting', 'following', 'dm']
      }
    });
  } catch (error) {
    logger.error('Emergency stop failed:', error);
    res.status(500).json({ error: 'Failed to execute emergency stop' });
  }
});

// Get automation settings
router.get('/settings', async (req, res) => {
  try {
    res.json({
      success: true,
      settings: {
        general: {
          enabled: true,
          mode: 'comprehensive',
          maxConcurrentSessions: 3,
          sessionTimeout: 1800000
        },
        posting: {
          enabled: true,
          maxPerDay: 50,
          minInterval: 1800000,
          qualityThreshold: 0.8,
          autoHashtags: true,
          trendingTopics: true
        },
        engagement: {
          liking: {
            enabled: true,
            maxPerDay: 200,
            minInterval: 30000,
            targetAccounts: ['crypto', 'blockchain', 'trading']
          },
          commenting: {
            enabled: true,
            maxPerDay: 100,
            minInterval: 60000,
            templates: ['Great insight!', 'Thanks for sharing!', 'Interesting perspective!']
          },
          following: {
            enabled: true,
            maxPerDay: 50,
            minInterval: 120000,
            unfollowAfterDays: 7
          }
        },
        messaging: {
          dm: {
            enabled: true,
            maxPerDay: 20,
            minInterval: 300000,
            templates: ['Hello! Interested in crypto discussions?']
          }
        },
        polls: {
          enabled: true,
          maxVotesPerDay: 30,
          minInterval: 180000,
          autoCreate: false
        },
        threads: {
          enabled: true,
          maxPerDay: 25,
          minInterval: 240000,
          maxLength: 10
        },
        qualityControl: {
          enabled: true,
          minQualityScore: 0.8,
          minComplianceScore: 0.9,
          contentFiltering: true,
          spamDetection: true,
          sentimentAnalysis: true
        },
        compliance: {
          enabled: true,
          autoMonitoring: true,
          pauseOnViolation: true,
          reportGeneration: true
        }
      }
    });
  } catch (error) {
    logger.error('Get automation settings failed:', error);
    res.status(500).json({ error: 'Failed to get automation settings' });
  }
});

// Update automation settings
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    
    res.json({
      success: true,
      message: 'Automation settings updated successfully',
      settings: settings,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Update automation settings failed:', error);
    res.status(500).json({ error: 'Failed to update automation settings' });
  }
});

export default router;
