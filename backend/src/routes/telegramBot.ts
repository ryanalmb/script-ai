import express from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { authenticateBot } from '../middleware/botAuth';
import { validateRequest } from '../middleware/validation';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getRealTimeSyncCoordinator } from '../services/realTimeSync';
import { RealXApiClient } from '../services/realXApiClient';
import { EnterpriseAntiDetectionCoordinator } from '../services/antiDetection/antiDetectionCoordinator';

const router = express.Router();

// Rate limiting for Telegram bot endpoints
const botRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each bot to 60 requests per minute
  message: { success: false, error: 'Rate limit exceeded for bot requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas for bot requests
const postTweetSchema = z.object({
  accountId: z.string(),
  text: z.string().min(1).max(280),
  scheduledFor: z.string().datetime().optional(),
  mediaUrls: z.array(z.string().url()).optional()
});

const engagementActionSchema = z.object({
  accountId: z.string(),
  targetId: z.string(), // Tweet ID or User ID
  action: z.enum(['like', 'retweet', 'reply', 'follow', 'unfollow']),
  content: z.string().optional() // For replies
});

const campaignActionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['growth', 'engagement', 'content', 'research']),
  accountIds: z.array(z.string()),
  targetMetrics: z.object({
    followersGrowth: z.number().optional(),
    engagementRate: z.number().optional(),
    reachTarget: z.number().optional()
  }).optional(),
  budgetLimits: z.object({
    maxDailySpend: z.number().optional(),
    totalBudget: z.number().optional()
  }).optional(),
  duration: z.number().optional() // Duration in days
});

const analyticsQuerySchema = z.object({
  accountIds: z.array(z.string()).optional(),
  campaignIds: z.array(z.string()).optional(),
  timeframe: z.number().min(1).max(168).optional(), // 1 hour to 1 week
  metrics: z.array(z.string()).optional()
});

// Apply rate limiting and bot authentication to all routes
router.use(botRateLimit);
router.use(authenticateBot);

/**
 * POST /api/telegram-bot/tweet
 * Post a tweet through the bot
 */
router.post('/tweet', validateRequest(postTweetSchema), async (req, res) => {
  try {
    const { accountId, text, scheduledFor, mediaUrls } = req.body;
    const botId = (req as any).botId;

    logger.info(`Bot ${botId} requesting tweet post for account ${accountId}`);

    // Verify account access
    const account = await prisma.xAccount.findFirst({
      where: { 
        id: accountId,
        isActive: true
      },
      include: { user: true }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or inactive',
        botResponse: {
          type: 'error',
          message: '❌ Account not found or inactive. Please check the account ID.',
          showKeyboard: true
        }
      });
    }

    // Get anti-detection coordinator
    const antiDetectionCoordinator = new EnterpriseAntiDetectionCoordinator();
    
    // Initialize X API client
    const xApiClient = new RealXApiClient(
      accountId,
      {
        username: account.username,
        email: account.user.email,
        password: '' // Would be retrieved securely
      },
      antiDetectionCoordinator
    );

    // Post tweet with anti-detection measures
    const result = await xApiClient.postTweet(text, {
      mediaUrls,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined
    });

    if (result.success) {
      // Store tweet in database
      const tweet = await prisma.tweet.create({
        data: {
          id: result.tweetId,
          accountId,
          text,
          status: scheduledFor ? 'scheduled' : 'posted',
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          postedAt: scheduledFor ? null : new Date(),
          mediaUrls: mediaUrls || [],
          metadata: {
            botId,
            antiDetectionUsed: true,
            qualityScore: result.qualityScore || 1.0
          }
        }
      });

      // Broadcast real-time update
      const realTimeSyncCoordinator = getRealTimeSyncCoordinator();
      if (realTimeSyncCoordinator) {
        await realTimeSyncCoordinator.broadcastRealTimeEvent(
          'automation_events',
          'tweet_posted',
          {
            accountId,
            tweetId: result.tweetId,
            text,
            timestamp: new Date()
          }
        );
      }

      res.json({
        success: true,
        data: {
          tweetId: result.tweetId,
          text,
          status: tweet.status,
          postedAt: tweet.postedAt,
          scheduledFor: tweet.scheduledFor
        },
        botResponse: {
          type: 'success',
          message: `✅ Tweet posted successfully!\n\n📝 Text: "${text}"\n🆔 Tweet ID: ${result.tweetId}\n⏰ Posted: ${new Date().toLocaleString()}`,
          showKeyboard: true,
          inlineKeyboard: [
            [
              { text: '📊 View Analytics', callback_data: `analytics_${accountId}` },
              { text: '🔄 Post Another', callback_data: 'post_tweet' }
            ]
          ]
        }
      });

      logger.info(`Tweet posted successfully by bot ${botId}: ${result.tweetId}`);
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        botResponse: {
          type: 'error',
          message: `❌ Failed to post tweet: ${result.error}`,
          showKeyboard: true
        }
      });
    }
  } catch (error) {
    logger.error('Bot tweet posting failed:', error);
    res.status(500).json({
      success: false,
      error: 'Tweet posting failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred while posting the tweet. Please try again.',
        showKeyboard: true
      }
    });
  }
});

/**
 * POST /api/telegram-bot/engagement
 * Perform engagement actions (like, retweet, follow, etc.)
 */
router.post('/engagement', validateRequest(engagementActionSchema), async (req, res) => {
  try {
    const { accountId, targetId, action, content } = req.body;
    const botId = (req as any).botId;

    logger.info(`Bot ${botId} requesting ${action} action for account ${accountId}`);

    // Verify account access
    const account = await prisma.xAccount.findFirst({
      where: { 
        id: accountId,
        isActive: true
      },
      include: { user: true }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or inactive',
        botResponse: {
          type: 'error',
          message: '❌ Account not found or inactive.',
          showKeyboard: true
        }
      });
    }

    // Get anti-detection coordinator
    const antiDetectionCoordinator = new EnterpriseAntiDetectionCoordinator();
    
    // Initialize X API client
    const xApiClient = new RealXApiClient(
      accountId,
      {
        username: account.username,
        email: account.user.email,
        password: '' // Would be retrieved securely
      },
      antiDetectionCoordinator
    );

    let result: any;
    let actionDescription = '';

    // Perform the requested action
    switch (action) {
      case 'like':
        result = await xApiClient.likeTweet(targetId);
        actionDescription = 'liked tweet';
        break;
      case 'retweet':
        result = await xApiClient.retweetTweet(targetId);
        actionDescription = 'retweeted';
        break;
      case 'reply':
        if (!content) {
          return res.status(400).json({
            success: false,
            error: 'Reply content is required',
            botResponse: {
              type: 'error',
              message: '❌ Reply content is required for reply actions.',
              showKeyboard: true
            }
          });
        }
        result = await xApiClient.replyToTweet(targetId, content);
        actionDescription = 'replied to tweet';
        break;
      case 'follow':
        result = await xApiClient.followUser(targetId);
        actionDescription = 'followed user';
        break;
      case 'unfollow':
        result = await xApiClient.unfollowUser(targetId);
        actionDescription = 'unfollowed user';
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action',
          botResponse: {
            type: 'error',
            message: '❌ Invalid action specified.',
            showKeyboard: true
          }
        });
    }

    if (result.success) {
      // Record automation performance
      await prisma.automationPerformanceMetrics.create({
        data: {
          id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          accountId,
          timestamp: new Date(),
          actionType: action,
          actionCategory: action === 'follow' || action === 'unfollow' ? 'following' : 'engagement',
          status: 'success',
          executionTime: result.executionTime || 1000,
          responseTime: result.responseTime || 500,
          retryCount: 0,
          detectionRisk: result.detectionRisk || 0.1,
          qualityScore: result.qualityScore || 0.9,
          proxyId: result.proxyId,
          fingerprintId: result.fingerprintId,
          behaviorPatternId: result.behaviorPatternId,
          sessionId: result.sessionId,
          targetData: { targetId, content },
          resultData: result,
          contextData: { botId },
          performanceMetrics: {
            executionTime: result.executionTime,
            responseTime: result.responseTime
          }
        }
      });

      // Broadcast real-time update
      const realTimeSyncCoordinator = getRealTimeSyncCoordinator();
      if (realTimeSyncCoordinator) {
        await realTimeSyncCoordinator.broadcastRealTimeEvent(
          'automation_events',
          'engagement_action',
          {
            accountId,
            action,
            targetId,
            timestamp: new Date()
          }
        );
      }

      res.json({
        success: true,
        data: {
          action,
          targetId,
          result: result.data
        },
        botResponse: {
          type: 'success',
          message: `✅ Successfully ${actionDescription}!\n\n🎯 Target: ${targetId}\n⏰ Time: ${new Date().toLocaleString()}`,
          showKeyboard: true,
          inlineKeyboard: [
            [
              { text: '📊 View Analytics', callback_data: `analytics_${accountId}` },
              { text: '🔄 More Actions', callback_data: 'engagement_menu' }
            ]
          ]
        }
      });

      logger.info(`Engagement action completed by bot ${botId}: ${action} on ${targetId}`);
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        botResponse: {
          type: 'error',
          message: `❌ Failed to ${action}: ${result.error}`,
          showKeyboard: true
        }
      });
    }
  } catch (error) {
    logger.error('Bot engagement action failed:', error);
    res.status(500).json({
      success: false,
      error: 'Engagement action failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred while performing the action. Please try again.',
        showKeyboard: true
      }
    });
  }
});

/**
 * POST /api/telegram-bot/campaign
 * Create and manage campaigns
 */
router.post('/campaign', validateRequest(campaignActionSchema), async (req, res) => {
  try {
    const { name, type, accountIds, targetMetrics, budgetLimits, duration } = req.body;
    const botId = (req as any).botId;

    logger.info(`Bot ${botId} creating campaign: ${name}`);

    // Verify all accounts exist and are active
    const accounts = await prisma.xAccount.findMany({
      where: {
        id: { in: accountIds },
        isActive: true
      }
    });

    if (accounts.length !== accountIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some accounts not found or inactive',
        botResponse: {
          type: 'error',
          message: '❌ Some accounts were not found or are inactive. Please check account IDs.',
          showKeyboard: true
        }
      });
    }

    // Calculate end date if duration is provided
    const endDate = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        id: `bot_campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description: `Campaign created via Telegram bot ${botId}`,
        type,
        status: 'active',
        startDate: new Date(),
        endDate,
        accountIds,
        targetMetrics: targetMetrics || {},
        budgetLimits: budgetLimits || {},
        contentStrategy: {},
        automationRules: {
          likingEnabled: true,
          followingEnabled: true,
          commentingEnabled: false,
          dmEnabled: false,
          maxActionsPerDay: 100
        },
        complianceSettings: {
          respectRateLimits: true,
          useAntiDetection: true,
          qualityThreshold: 0.8
        },
        createdBy: botId,
        metadata: {
          createdViaBot: true,
          botId
        }
      }
    });

    // Start campaign tracking
    const realTimeSyncCoordinator = getRealTimeSyncCoordinator();
    if (realTimeSyncCoordinator) {
      await realTimeSyncCoordinator.createCampaign({
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        accountIds: campaign.accountIds,
        targetMetrics: campaign.targetMetrics,
        budgetLimits: campaign.budgetLimits,
        contentStrategy: campaign.contentStrategy,
        automationRules: campaign.automationRules
      });
    }

    res.json({
      success: true,
      data: {
        campaignId: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        accountCount: accountIds.length,
        startDate: campaign.startDate,
        endDate: campaign.endDate
      },
      botResponse: {
        type: 'success',
        message: `✅ Campaign "${name}" created successfully!\n\n📊 Type: ${type}\n👥 Accounts: ${accountIds.length}\n📅 Start: ${campaign.startDate.toLocaleDateString()}\n${endDate ? `📅 End: ${endDate.toLocaleDateString()}` : '♾️ No end date'}\n\n🚀 Campaign is now active and tracking performance!`,
        showKeyboard: true,
        inlineKeyboard: [
          [
            { text: '📈 View Performance', callback_data: `campaign_${campaign.id}` },
            { text: '⚙️ Manage Campaign', callback_data: `manage_${campaign.id}` }
          ],
          [
            { text: '📋 All Campaigns', callback_data: 'list_campaigns' }
          ]
        ]
      }
    });

    logger.info(`Campaign created by bot ${botId}: ${campaign.id}`);
  } catch (error) {
    logger.error('Bot campaign creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Campaign creation failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred while creating the campaign. Please try again.',
        showKeyboard: true
      }
    });
  }
});

/**
 * GET /api/telegram-bot/analytics
 * Get analytics data formatted for bot display
 */
router.get('/analytics', validateRequest(analyticsQuerySchema, 'query'), async (req, res) => {
  try {
    const { accountIds, campaignIds, timeframe = 24, metrics } = req.query as any;
    const botId = (req as any).botId;

    logger.info(`Bot ${botId} requesting analytics`);

    // Build analytics query
    const whereConditions: any = {
      timestamp: {
        gte: new Date(Date.now() - timeframe * 60 * 60 * 1000)
      }
    };

    if (accountIds && accountIds.length > 0) {
      whereConditions.accountId = { in: accountIds };
    }

    // Get account metrics
    const accountMetrics = await prisma.accountMetrics.findMany({
      where: whereConditions,
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: {
        account: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    // Get campaign performance if requested
    let campaignPerformance = [];
    if (campaignIds && campaignIds.length > 0) {
      campaignPerformance = await prisma.campaignPerformanceMetrics.findMany({
        where: {
          campaignId: { in: campaignIds },
          timestamp: {
            gte: new Date(Date.now() - timeframe * 60 * 60 * 1000)
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 20,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        }
      });
    }

    // Calculate summary statistics
    const totalFollowersGained = accountMetrics.reduce((sum, m) => 
      sum + (m.deltaFollowers > 0 ? m.deltaFollowers : 0), 0);
    const totalTweets = accountMetrics.reduce((sum, m) => sum + (m.deltaTweets || 0), 0);
    const avgEngagementRate = accountMetrics.length > 0 ? 
      accountMetrics.reduce((sum, m) => sum + m.engagementRate, 0) / accountMetrics.length : 0;

    // Format for bot display
    const summary = {
      timeframe: `${timeframe} hours`,
      accounts: accountMetrics.length > 0 ? [...new Set(accountMetrics.map(m => m.account.username))].join(', ') : 'None',
      totalFollowersGained,
      totalTweets,
      avgEngagementRate: (avgEngagementRate * 100).toFixed(2) + '%',
      campaigns: campaignPerformance.length
    };

    // Create bot-friendly message
    let message = `📊 Analytics Summary (${summary.timeframe})\n\n`;
    message += `👥 Accounts: ${summary.accounts}\n`;
    message += `📈 Followers Gained: +${summary.totalFollowersGained}\n`;
    message += `📝 Tweets Posted: ${summary.totalTweets}\n`;
    message += `💫 Avg Engagement: ${summary.avgEngagementRate}\n`;
    if (summary.campaigns > 0) {
      message += `🎯 Active Campaigns: ${summary.campaigns}\n`;
    }

    // Add top performing accounts
    if (accountMetrics.length > 0) {
      const topAccounts = accountMetrics
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 3);
      
      message += `\n🏆 Top Performers:\n`;
      topAccounts.forEach((account, index) => {
        message += `${index + 1}. @${account.account.username} - ${(account.engagementRate * 100).toFixed(1)}%\n`;
      });
    }

    res.json({
      success: true,
      data: {
        summary,
        accountMetrics: accountMetrics.slice(0, 10), // Limit for bot display
        campaignPerformance: campaignPerformance.slice(0, 5),
        timeframe
      },
      botResponse: {
        type: 'analytics',
        message,
        showKeyboard: true,
        inlineKeyboard: [
          [
            { text: '📊 Detailed View', callback_data: 'detailed_analytics' },
            { text: '📈 Charts', callback_data: 'analytics_charts' }
          ],
          [
            { text: '🔄 Refresh', callback_data: 'refresh_analytics' },
            { text: '⚙️ Settings', callback_data: 'analytics_settings' }
          ]
        ]
      }
    });

    logger.info(`Analytics provided to bot ${botId}`);
  } catch (error) {
    logger.error('Bot analytics request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Analytics request failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred while fetching analytics. Please try again.',
        showKeyboard: true
      }
    });
  }
});

/**
 * GET /api/telegram-bot/accounts
 * Get user's X accounts
 */
router.get('/accounts', async (req, res) => {
  try {
    const botId = (req as any).botId;
    const { status = 'active' } = req.query;

    logger.info(`Bot ${botId} requesting accounts list`);

    // Get accounts (in a real implementation, you'd filter by user)
    const accounts = await prisma.xAccount.findMany({
      where: {
        isActive: status === 'active'
      },
      select: {
        id: true,
        username: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { username: 'asc' },
      take: 20
    });

    // Get recent metrics for each account
    const accountsWithMetrics = await Promise.all(
      accounts.map(async (account) => {
        const latestMetrics = await prisma.accountMetrics.findFirst({
          where: { accountId: account.id },
          orderBy: { timestamp: 'desc' }
        });

        return {
          ...account,
          metrics: latestMetrics ? {
            followersCount: latestMetrics.followersCount,
            followingCount: latestMetrics.followingCount,
            tweetsCount: latestMetrics.tweetsCount,
            engagementRate: latestMetrics.engagementRate,
            lastUpdated: latestMetrics.timestamp
          } : null
        };
      })
    );

    // Format for bot display
    let message = `👥 Your X Accounts (${accounts.length})\n\n`;
    
    if (accounts.length === 0) {
      message += '❌ No accounts found. Please add accounts first.';
    } else {
      accountsWithMetrics.forEach((account, index) => {
        message += `${index + 1}. @${account.username}\n`;
        if (account.metrics) {
          message += `   👥 ${account.metrics.followersCount} followers\n`;
          message += `   💫 ${(account.metrics.engagementRate * 100).toFixed(1)}% engagement\n`;
        }
        message += `   📅 Added: ${account.createdAt.toLocaleDateString()}\n\n`;
      });
    }

    res.json({
      success: true,
      data: {
        accounts: accountsWithMetrics,
        total: accounts.length
      },
      botResponse: {
        type: 'accounts_list',
        message,
        showKeyboard: true,
        inlineKeyboard: accounts.length > 0 ? [
          [
            { text: '📊 View Analytics', callback_data: 'account_analytics' },
            { text: '🔄 Sync All', callback_data: 'sync_all_accounts' }
          ],
          [
            { text: '➕ Add Account', callback_data: 'add_account' },
            { text: '⚙️ Manage', callback_data: 'manage_accounts' }
          ]
        ] : [
          [
            { text: '➕ Add Account', callback_data: 'add_account' }
          ]
        ]
      }
    });

    logger.info(`Accounts list provided to bot ${botId}: ${accounts.length} accounts`);
  } catch (error) {
    logger.error('Bot accounts request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Accounts request failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred while fetching accounts. Please try again.',
        showKeyboard: true
      }
    });
  }
});

/**
 * GET /api/telegram-bot/campaigns
 * Get user's campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const botId = (req as any).botId;
    const { status = 'active' } = req.query;

    logger.info(`Bot ${botId} requesting campaigns list`);

    const campaigns = await prisma.campaign.findMany({
      where: {
        status: status as string
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        accountIds: true,
        targetMetrics: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get recent performance for each campaign
    const campaignsWithPerformance = await Promise.all(
      campaigns.map(async (campaign) => {
        const latestPerformance = await prisma.campaignPerformanceMetrics.findFirst({
          where: { campaignId: campaign.id },
          orderBy: { timestamp: 'desc' }
        });

        return {
          ...campaign,
          performance: latestPerformance ? {
            roi: latestPerformance.roi,
            engagementRate: latestPerformance.engagementRate,
            totalReach: latestPerformance.totalReach,
            qualityScore: latestPerformance.qualityScore,
            lastUpdated: latestPerformance.timestamp
          } : null
        };
      })
    );

    // Format for bot display
    let message = `🎯 Your Campaigns (${campaigns.length})\n\n`;
    
    if (campaigns.length === 0) {
      message += '❌ No campaigns found. Create your first campaign!';
    } else {
      campaignsWithPerformance.forEach((campaign, index) => {
        message += `${index + 1}. ${campaign.name}\n`;
        message += `   📊 Type: ${campaign.type}\n`;
        message += `   👥 Accounts: ${campaign.accountIds.length}\n`;
        if (campaign.performance) {
          message += `   💰 ROI: ${(campaign.performance.roi * 100).toFixed(1)}%\n`;
          message += `   📈 Reach: ${campaign.performance.totalReach.toLocaleString()}\n`;
        }
        message += `   📅 Started: ${campaign.startDate.toLocaleDateString()}\n\n`;
      });
    }

    res.json({
      success: true,
      data: {
        campaigns: campaignsWithPerformance,
        total: campaigns.length
      },
      botResponse: {
        type: 'campaigns_list',
        message,
        showKeyboard: true,
        inlineKeyboard: campaigns.length > 0 ? [
          [
            { text: '📈 View Performance', callback_data: 'campaign_performance' },
            { text: '⚙️ Manage', callback_data: 'manage_campaigns' }
          ],
          [
            { text: '➕ New Campaign', callback_data: 'create_campaign' },
            { text: '🔄 Refresh', callback_data: 'refresh_campaigns' }
          ]
        ] : [
          [
            { text: '➕ Create Campaign', callback_data: 'create_campaign' }
          ]
        ]
      }
    });

    logger.info(`Campaigns list provided to bot ${botId}: ${campaigns.length} campaigns`);
  } catch (error) {
    logger.error('Bot campaigns request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Campaigns request failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred while fetching campaigns. Please try again.',
        showKeyboard: true
      }
    });
  }
});

/**
 * POST /api/telegram-bot/sync
 * Force sync accounts
 */
router.post('/sync', async (req, res) => {
  try {
    const { accountIds, syncType = 'metrics' } = req.body;
    const botId = (req as any).botId;

    logger.info(`Bot ${botId} requesting sync for accounts: ${accountIds}`);

    const realTimeSyncCoordinator = getRealTimeSyncCoordinator();
    if (!realTimeSyncCoordinator) {
      return res.status(503).json({
        success: false,
        error: 'Real-time sync service unavailable',
        botResponse: {
          type: 'error',
          message: '❌ Sync service is currently unavailable. Please try again later.',
          showKeyboard: true
        }
      });
    }

    // Force sync for each account
    const syncResults = [];
    for (const accountId of accountIds) {
      try {
        const result = await realTimeSyncCoordinator.forceSyncAccount(accountId, syncType);
        syncResults.push({
          accountId,
          success: true,
          result
        });
      } catch (error) {
        syncResults.push({
          accountId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = syncResults.filter(r => r.success).length;
    const failureCount = syncResults.length - successCount;

    let message = `🔄 Sync Results\n\n`;
    message += `✅ Successful: ${successCount}\n`;
    if (failureCount > 0) {
      message += `❌ Failed: ${failureCount}\n`;
    }
    message += `⏰ Completed: ${new Date().toLocaleString()}\n\n`;

    if (successCount > 0) {
      message += `📊 Successfully synced accounts will show updated metrics shortly.`;
    }

    res.json({
      success: true,
      data: {
        syncResults,
        summary: {
          total: syncResults.length,
          successful: successCount,
          failed: failureCount
        }
      },
      botResponse: {
        type: 'sync_results',
        message,
        showKeyboard: true,
        inlineKeyboard: [
          [
            { text: '📊 View Analytics', callback_data: 'view_analytics' },
            { text: '🔄 Sync Again', callback_data: 'sync_accounts' }
          ]
        ]
      }
    });

    logger.info(`Sync completed by bot ${botId}: ${successCount}/${syncResults.length} successful`);
  } catch (error) {
    logger.error('Bot sync request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Sync request failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred during sync. Please try again.',
        showKeyboard: true
      }
    });
  }
});

/**
 * GET /api/telegram-bot/status
 * Get system status for bot
 */
router.get('/status', async (req, res) => {
  try {
    const botId = (req as any).botId;

    logger.info(`Bot ${botId} requesting system status`);

    const realTimeSyncCoordinator = getRealTimeSyncCoordinator();
    let systemHealth = null;
    
    if (realTimeSyncCoordinator) {
      systemHealth = await realTimeSyncCoordinator.getSystemHealthStatus();
    }

    // Get basic statistics
    const totalAccounts = await prisma.xAccount.count({ where: { isActive: true } });
    const totalCampaigns = await prisma.campaign.count({ where: { status: 'active' } });
    const recentAlerts = await prisma.realTimeAlert.count({
      where: {
        status: 'active',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    const status = systemHealth?.overall || 'unknown';
    const statusEmoji = {
      healthy: '🟢',
      warning: '🟡',
      critical: '🔴',
      down: '⚫',
      unknown: '⚪'
    }[status];

    let message = `${statusEmoji} System Status: ${status.toUpperCase()}\n\n`;
    message += `👥 Active Accounts: ${totalAccounts}\n`;
    message += `🎯 Active Campaigns: ${totalCampaigns}\n`;
    message += `⚠️ Active Alerts: ${recentAlerts}\n`;
    
    if (systemHealth) {
      message += `⏱️ Uptime: ${Math.floor(systemHealth.metrics.uptime / 1000 / 60)} minutes\n`;
      message += `💾 Memory Usage: ${(systemHealth.metrics.memoryUsage * 100).toFixed(1)}%\n`;
    }

    message += `\n🔄 Last Updated: ${new Date().toLocaleString()}`;

    res.json({
      success: true,
      data: {
        status,
        systemHealth,
        statistics: {
          totalAccounts,
          totalCampaigns,
          recentAlerts
        }
      },
      botResponse: {
        type: 'system_status',
        message,
        showKeyboard: true,
        inlineKeyboard: [
          [
            { text: '🔄 Refresh', callback_data: 'refresh_status' },
            { text: '📊 Detailed View', callback_data: 'detailed_status' }
          ],
          [
            { text: '⚠️ View Alerts', callback_data: 'view_alerts' },
            { text: '📈 Performance', callback_data: 'system_performance' }
          ]
        ]
      }
    });

    logger.info(`System status provided to bot ${botId}: ${status}`);
  } catch (error) {
    logger.error('Bot status request failed:', error);
    res.status(500).json({
      success: false,
      error: 'Status request failed',
      botResponse: {
        type: 'error',
        message: '❌ An error occurred while fetching system status. Please try again.',
        showKeyboard: true
      }
    });
  }
});

export default router;
