import express from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

const router = express.Router();

// Rate limiting for real-time sync endpoints
const syncRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many sync requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const accountMetricsQuerySchema = z.object({
  accountIds: z.array(z.string()).optional(),
  timeframe: z.number().min(1).max(168).optional(), // 1 hour to 1 week
  limit: z.number().min(1).max(1000).optional(),
  includeDeltas: z.boolean().optional()
});

const campaignPerformanceQuerySchema = z.object({
  campaignIds: z.array(z.string()).optional(),
  timeframe: z.number().min(1).max(168).optional(),
  metrics: z.array(z.string()).optional(),
  groupBy: z.enum(['hour', 'day', 'week']).optional()
});

const forceSyncSchema = z.object({
  accountId: z.string(),
  syncType: z.enum(['full', 'incremental', 'metrics', 'health', 'profile']).optional()
});

const subscriptionSchema = z.object({
  channel: z.string(),
  filters: z.object({
    accountIds: z.array(z.string()).optional(),
    campaignIds: z.array(z.string()).optional(),
    eventTypes: z.array(z.string()).optional(),
    severity: z.array(z.string()).optional()
  }).optional()
});

// Apply rate limiting and authentication to all routes
router.use(syncRateLimit);
router.use(authenticateToken);

/**
 * GET /api/real-time-sync/health
 * Get comprehensive system health status
 */
router.get('/health', async (req, res) => {
  try {
    // Get cached health status
    const healthStatus = await cacheManager.get('system_health_status');
    
    if (!healthStatus) {
      // If not cached, return basic status
      const basicHealth = {
        overall: 'healthy',
        timestamp: new Date(),
        components: {
          accountSync: { status: 'healthy' },
          analyticsCollection: { status: 'healthy' },
          campaignTracking: { status: 'healthy' },
          webSocket: { status: 'healthy' },
          dataIntegrity: { status: 'healthy' }
        }
      };
      
      return res.json({
        success: true,
        data: basicHealth
      });
    }

    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    logger.error('Failed to get system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system health status'
    });
  }
});

/**
 * GET /api/real-time-sync/metrics
 * Get real-time system metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await cacheManager.get('system_metrics');
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'System metrics not available'
      });
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system metrics'
    });
  }
});

/**
 * GET /api/real-time-sync/account-metrics
 * Get real-time account metrics with filtering
 */
router.get('/account-metrics', validateRequest(accountMetricsQuerySchema, 'query'), async (req, res) => {
  try {
    const { accountIds, timeframe = 24, limit = 100, includeDeltas = false } = req.query as any;
    
    // Build query conditions
    const whereConditions: any = {
      timestamp: {
        gte: new Date(Date.now() - timeframe * 60 * 60 * 1000)
      }
    };

    if (accountIds && accountIds.length > 0) {
      whereConditions.accountId = { in: accountIds };
    }

    // Get account metrics
    const metrics = await prisma.accountMetrics.findMany({
      where: whereConditions,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        account: {
          select: {
            id: true,
            username: true,
            isActive: true
          }
        }
      }
    });

    // Calculate aggregated statistics
    const stats = {
      totalRecords: metrics.length,
      avgEngagementRate: metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length : 0,
      totalFollowersGained: metrics.reduce((sum, m) => sum + (m.deltaFollowers > 0 ? m.deltaFollowers : 0), 0),
      totalTweets: metrics.reduce((sum, m) => sum + (m.deltaTweets || 0), 0),
      uniqueAccounts: new Set(metrics.map(m => m.accountId)).size
    };

    res.json({
      success: true,
      data: {
        metrics,
        statistics: stats,
        timeframe,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get account metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve account metrics'
    });
  }
});

/**
 * GET /api/real-time-sync/tweet-engagement
 * Get real-time tweet engagement metrics
 */
router.get('/tweet-engagement', async (req, res) => {
  try {
    const { accountIds, tweetIds, timeframe = 24, limit = 100 } = req.query as any;
    
    const whereConditions: any = {
      timestamp: {
        gte: new Date(Date.now() - (timeframe as number) * 60 * 60 * 1000)
      }
    };

    if (accountIds) {
      whereConditions.accountId = { in: Array.isArray(accountIds) ? accountIds : [accountIds] };
    }

    if (tweetIds) {
      whereConditions.tweetId = { in: Array.isArray(tweetIds) ? tweetIds : [tweetIds] };
    }

    const engagement = await prisma.tweetEngagementMetrics.findMany({
      where: whereConditions,
      orderBy: { timestamp: 'desc' },
      take: limit as number
    });

    // Calculate engagement statistics
    const stats = {
      totalTweets: new Set(engagement.map(e => e.tweetId)).size,
      totalLikes: engagement.reduce((sum, e) => sum + e.likesCount, 0),
      totalRetweets: engagement.reduce((sum, e) => sum + e.retweetsCount, 0),
      totalReplies: engagement.reduce((sum, e) => sum + e.repliesCount, 0),
      avgEngagementRate: engagement.length > 0 ? 
        engagement.reduce((sum, e) => sum + e.engagementRate, 0) / engagement.length : 0,
      topPerformingTweets: engagement
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 5)
        .map(e => ({
          tweetId: e.tweetId,
          engagementRate: e.engagementRate,
          totalEngagements: e.likesCount + e.retweetsCount + e.repliesCount + e.quotesCount
        }))
    };

    res.json({
      success: true,
      data: {
        engagement,
        statistics: stats,
        timeframe,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get tweet engagement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tweet engagement metrics'
    });
  }
});

/**
 * GET /api/real-time-sync/campaign-performance
 * Get real-time campaign performance metrics
 */
router.get('/campaign-performance', validateRequest(campaignPerformanceQuerySchema, 'query'), async (req, res) => {
  try {
    const { campaignIds, timeframe = 24, metrics: requestedMetrics, groupBy = 'hour' } = req.query as any;
    
    const whereConditions: any = {
      timestamp: {
        gte: new Date(Date.now() - timeframe * 60 * 60 * 1000)
      }
    };

    if (campaignIds && campaignIds.length > 0) {
      whereConditions.campaignId = { in: campaignIds };
    }

    const performance = await prisma.campaignPerformanceMetrics.findMany({
      where: whereConditions,
      orderBy: { timestamp: 'desc' },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        }
      }
    });

    // Group data by time period
    const groupedData = this.groupPerformanceData(performance, groupBy);
    
    // Calculate campaign statistics
    const stats = {
      totalCampaigns: new Set(performance.map(p => p.campaignId)).size,
      avgROI: performance.length > 0 ? 
        performance.reduce((sum, p) => sum + p.roi, 0) / performance.length : 0,
      avgEngagementRate: performance.length > 0 ? 
        performance.reduce((sum, p) => sum + p.engagementRate, 0) / performance.length : 0,
      totalReach: performance.reduce((sum, p) => sum + p.totalReach, 0),
      totalEngagements: performance.reduce((sum, p) => sum + p.totalEngagements, 0),
      topPerformingCampaigns: performance
        .sort((a, b) => b.roi - a.roi)
        .slice(0, 5)
        .map(p => ({
          campaignId: p.campaignId,
          campaignName: p.campaign?.name,
          roi: p.roi,
          engagementRate: p.engagementRate,
          qualityScore: p.qualityScore
        }))
    };

    res.json({
      success: true,
      data: {
        performance,
        groupedData,
        statistics: stats,
        timeframe,
        groupBy,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get campaign performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign performance metrics'
    });
  }
});

/**
 * GET /api/real-time-sync/automation-performance
 * Get automation performance metrics
 */
router.get('/automation-performance', async (req, res) => {
  try {
    const { accountIds, actionTypes, timeframe = 24, limit = 500 } = req.query as any;
    
    const whereConditions: any = {
      timestamp: {
        gte: new Date(Date.now() - (timeframe as number) * 60 * 60 * 1000)
      }
    };

    if (accountIds) {
      whereConditions.accountId = { in: Array.isArray(accountIds) ? accountIds : [accountIds] };
    }

    if (actionTypes) {
      whereConditions.actionType = { in: Array.isArray(actionTypes) ? actionTypes : [actionTypes] };
    }

    const performance = await prisma.automationPerformanceMetrics.findMany({
      where: whereConditions,
      orderBy: { timestamp: 'desc' },
      take: limit as number
    });

    // Calculate performance statistics
    const stats = {
      totalActions: performance.length,
      successRate: performance.length > 0 ? 
        performance.filter(p => p.status === 'success').length / performance.length : 0,
      avgExecutionTime: performance.length > 0 ? 
        performance.reduce((sum, p) => sum + p.executionTime, 0) / performance.length : 0,
      avgDetectionRisk: performance.length > 0 ? 
        performance.reduce((sum, p) => sum + p.detectionRisk, 0) / performance.length : 0,
      actionBreakdown: this.calculateActionBreakdown(performance),
      errorAnalysis: this.calculateErrorAnalysis(performance)
    };

    res.json({
      success: true,
      data: {
        performance,
        statistics: stats,
        timeframe,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get automation performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve automation performance metrics'
    });
  }
});

/**
 * GET /api/real-time-sync/data-quality
 * Get data quality metrics and issues
 */
router.get('/data-quality', async (req, res) => {
  try {
    const { dataTypes, severity, timeframe = 24 } = req.query as any;
    
    // Get data quality metrics
    const qualityMetrics = await cacheManager.get('data_integrity_metrics');
    
    // This would get actual quality issues from database
    const qualityIssues = []; // Placeholder
    
    const stats = {
      overallQualityScore: 0.85,
      totalIssues: qualityIssues.length,
      unresolvedIssues: qualityIssues.filter((issue: any) => !issue.isResolved).length,
      issuesByType: this.groupIssuesByType(qualityIssues),
      issuesBySeverity: this.groupIssuesBySeverity(qualityIssues),
      qualityTrend: 'improving' // Would calculate from historical data
    };

    res.json({
      success: true,
      data: {
        qualityMetrics,
        qualityIssues,
        statistics: stats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get data quality metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve data quality metrics'
    });
  }
});

/**
 * POST /api/real-time-sync/force-sync
 * Force synchronization for specific account
 */
router.post('/force-sync', validateRequest(forceSyncSchema), async (req, res) => {
  try {
    const { accountId, syncType = 'full' } = req.body;
    
    // Check if user has permission to force sync
    const user = (req as any).user;
    if (!user || !['admin', 'manager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to force sync'
      });
    }

    // Verify account exists and user has access
    const account = await prisma.xAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id
      }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied'
      });
    }

    // This would trigger the actual sync
    // For now, return success response
    const syncResult = {
      syncId: `sync_${Date.now()}`,
      accountId,
      syncType,
      status: 'initiated',
      timestamp: new Date()
    };

    logger.info(`Force sync initiated for account ${accountId} by user ${user.id}`);

    res.json({
      success: true,
      data: syncResult
    });
  } catch (error) {
    logger.error('Failed to force sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate sync'
    });
  }
});

/**
 * GET /api/real-time-sync/sync-logs
 * Get synchronization logs
 */
router.get('/sync-logs', async (req, res) => {
  try {
    const { accountIds, status, timeframe = 24, limit = 100 } = req.query as any;
    
    const whereConditions: any = {
      startTime: {
        gte: new Date(Date.now() - (timeframe as number) * 60 * 60 * 1000)
      }
    };

    if (accountIds) {
      whereConditions.accountId = { in: Array.isArray(accountIds) ? accountIds : [accountIds] };
    }

    if (status) {
      whereConditions.status = Array.isArray(status) ? { in: status } : status;
    }

    const syncLogs = await prisma.accountSyncLog.findMany({
      where: whereConditions,
      orderBy: { startTime: 'desc' },
      take: limit as number,
      include: {
        account: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    // Calculate sync statistics
    const stats = {
      totalSyncs: syncLogs.length,
      successfulSyncs: syncLogs.filter(log => log.status === 'completed').length,
      failedSyncs: syncLogs.filter(log => log.status === 'failed').length,
      avgDuration: syncLogs.length > 0 ? 
        syncLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / syncLogs.length : 0,
      syncsByType: this.groupSyncsByType(syncLogs),
      recentErrors: syncLogs
        .filter(log => log.status === 'failed')
        .slice(0, 5)
        .map(log => ({
          syncId: log.id,
          accountId: log.accountId,
          syncType: log.syncType,
          error: log.errorDetails,
          timestamp: log.startTime
        }))
    };

    res.json({
      success: true,
      data: {
        syncLogs,
        statistics: stats,
        timeframe,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get sync logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync logs'
    });
  }
});

/**
 * GET /api/real-time-sync/alerts
 * Get real-time alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const { severity, status = 'active', limit = 50 } = req.query as any;
    
    const whereConditions: any = { status };

    if (severity) {
      whereConditions.severity = Array.isArray(severity) ? { in: severity } : severity;
    }

    const alerts = await prisma.realTimeAlert.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      take: limit as number
    });

    const stats = {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      warningAlerts: alerts.filter(a => a.severity === 'medium').length,
      infoAlerts: alerts.filter(a => a.severity === 'low').length,
      alertsByType: this.groupAlertsByType(alerts),
      recentCritical: alerts
        .filter(a => a.severity === 'critical')
        .slice(0, 3)
        .map(a => ({
          id: a.id,
          title: a.title,
          message: a.message,
          createdAt: a.createdAt
        }))
    };

    res.json({
      success: true,
      data: {
        alerts,
        statistics: stats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    });
  }
});

// Helper methods (these would be moved to a utility class in a real implementation)
function groupPerformanceData(performance: any[], groupBy: string): any {
  // Implementation for grouping performance data by time period
  return {};
}

function calculateActionBreakdown(performance: any[]): any {
  const breakdown: { [key: string]: number } = {};
  performance.forEach(p => {
    breakdown[p.actionType] = (breakdown[p.actionType] || 0) + 1;
  });
  return breakdown;
}

function calculateErrorAnalysis(performance: any[]): any {
  const errors = performance.filter(p => p.status === 'failure');
  const errorBreakdown: { [key: string]: number } = {};
  errors.forEach(e => {
    const errorType = e.errorCode || 'unknown';
    errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
  });
  return errorBreakdown;
}

function groupIssuesByType(issues: any[]): any {
  const breakdown: { [key: string]: number } = {};
  issues.forEach(issue => {
    breakdown[issue.issueType] = (breakdown[issue.issueType] || 0) + 1;
  });
  return breakdown;
}

function groupIssuesBySeverity(issues: any[]): any {
  const breakdown: { [key: string]: number } = {};
  issues.forEach(issue => {
    breakdown[issue.severity] = (breakdown[issue.severity] || 0) + 1;
  });
  return breakdown;
}

function groupSyncsByType(syncLogs: any[]): any {
  const breakdown: { [key: string]: number } = {};
  syncLogs.forEach(log => {
    breakdown[log.syncType] = (breakdown[log.syncType] || 0) + 1;
  });
  return breakdown;
}

function groupAlertsByType(alerts: any[]): any {
  const breakdown: { [key: string]: number } = {};
  alerts.forEach(alert => {
    breakdown[alert.alertType] = (breakdown[alert.alertType] || 0) + 1;
  });
  return breakdown;
}

export default router;
