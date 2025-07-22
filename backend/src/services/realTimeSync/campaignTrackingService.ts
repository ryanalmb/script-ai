import { logger } from '../../utils/logger';
import { prisma } from '../../lib/prisma';
import { cacheManager } from '../../lib/cache';
import crypto from 'crypto';

export interface CampaignConfiguration {
  id: string;
  name: string;
  type: 'growth' | 'engagement' | 'content' | 'research' | 'testing';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  startDate: Date;
  endDate: Date;
  accountIds: string[];
  targetMetrics: {
    followersGrowth?: number;
    engagementRate?: number;
    reachTarget?: number;
    conversionRate?: number;
    qualityScore?: number;
  };
  budgetLimits: {
    maxCostPerEngagement?: number;
    maxCostPerFollower?: number;
    maxDailySpend?: number;
    totalBudget?: number;
  };
  contentStrategy: {
    postingFrequency?: number;
    contentTypes?: string[];
    hashtags?: string[];
    targetAudience?: string[];
  };
  automationRules: {
    likingEnabled?: boolean;
    followingEnabled?: boolean;
    commentingEnabled?: boolean;
    dmEnabled?: boolean;
    maxActionsPerDay?: number;
  };
}

export interface CampaignPerformanceData {
  campaignId: string;
  timestamp: Date;
  accountId?: string;
  totalReach: number;
  totalImpressions: number;
  totalEngagements: number;
  totalFollowersGained: number;
  totalFollowersLost: number;
  totalTweets: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalMentions: number;
  engagementRate: number;
  growthRate: number;
  conversionRate: number;
  costPerEngagement: number;
  costPerFollower: number;
  roi: number;
  qualityScore: number;
  complianceScore: number;
  riskScore: number;
  participationRate: number;
}

export interface CampaignAnalytics {
  campaignId: string;
  timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly';
  metrics: {
    performance: CampaignPerformanceData[];
    trends: {
      engagementTrend: number;
      growthTrend: number;
      qualityTrend: number;
      riskTrend: number;
    };
    comparisons: {
      previousPeriod: number;
      benchmark: number;
      target: number;
    };
    insights: {
      topPerformingAccounts: string[];
      bestPerformingContent: string[];
      audienceInsights: any;
      competitorComparison: any;
    };
  };
}

export interface ABTestConfiguration {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  testType: 'content' | 'timing' | 'audience' | 'strategy';
  variants: {
    id: string;
    name: string;
    configuration: any;
    accountIds: string[];
    allocation: number; // percentage
  }[];
  metrics: string[];
  duration: number; // days
  confidenceLevel: number; // 0.95 for 95%
  status: 'draft' | 'running' | 'completed' | 'cancelled';
}

/**
 * Enterprise Campaign Performance Tracking Service
 * Tracks multi-account campaign metrics, ROI, and real-time performance
 */
export class EnterpriseCampaignTrackingService {
  private activeCampaigns: Map<string, CampaignConfiguration> = new Map();
  private trackingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private performanceBuffers: Map<string, CampaignPerformanceData[]> = new Map();
  private abTests: Map<string, ABTestConfiguration> = new Map();
  private analyticsCache: Map<string, CampaignAnalytics> = new Map();

  constructor() {
    this.initializeCampaignTracking();
  }

  /**
   * Initialize campaign tracking service
   */
  private async initializeCampaignTracking(): Promise<void> {
    try {
      logger.info('🔧 Initializing Enterprise Campaign Tracking Service...');
      
      await this.loadActiveCampaigns();
      await this.loadABTests();
      await this.setupPerformanceBuffers();
      await this.startTrackingIntervals();
      
      logger.info('✅ Enterprise Campaign Tracking Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise Campaign Tracking Service:', error);
      throw new Error(`Campaign Tracking Service initialization failed: ${error}`);
    }
  }

  /**
   * Load active campaigns from database
   */
  private async loadActiveCampaigns(): Promise<void> {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: { 
          status: { in: ['active', 'paused'] }
        }
      });

      for (const campaign of campaigns) {
        const config: CampaignConfiguration = {
          id: campaign.id,
          name: campaign.name,
          type: campaign.type as any,
          status: campaign.status as any,
          startDate: campaign.startDate || new Date(),
          endDate: campaign.endDate || new Date(),
          accountIds: campaign.accountIds || [],
          targetMetrics: campaign.targetMetrics as any || {},
          budgetLimits: campaign.budgetLimits as any || {},
          contentStrategy: campaign.contentStrategy as any || {},
          automationRules: campaign.automationRules as any || {}
        };

        this.activeCampaigns.set(campaign.id, config);
      }

      logger.info(`Loaded ${this.activeCampaigns.size} active campaigns`);
    } catch (error) {
      logger.error('Failed to load active campaigns:', error);
      throw error;
    }
  }

  /**
   * Load A/B tests from database
   */
  private async loadABTests(): Promise<void> {
    try {
      // This would load A/B test configurations from database
      // For now, initialize empty map
      logger.info('A/B tests loaded');
    } catch (error) {
      logger.error('Failed to load A/B tests:', error);
      throw error;
    }
  }

  /**
   * Setup performance buffers for each campaign
   */
  private async setupPerformanceBuffers(): Promise<void> {
    try {
      for (const campaignId of this.activeCampaigns.keys()) {
        this.performanceBuffers.set(campaignId, []);
      }

      logger.info('Performance buffers initialized for all campaigns');
    } catch (error) {
      logger.error('Failed to setup performance buffers:', error);
      throw error;
    }
  }

  /**
   * Start tracking intervals for all campaigns
   */
  private async startTrackingIntervals(): Promise<void> {
    try {
      for (const [campaignId, campaign] of this.activeCampaigns) {
        if (campaign.status === 'active') {
          // Track performance every 5 minutes
          const interval = setInterval(async () => {
            await this.trackCampaignPerformance(campaignId);
          }, 5 * 60 * 1000);

          this.trackingIntervals.set(campaignId, interval);
        }
      }

      // Flush performance data every minute
      const flushInterval = setInterval(async () => {
        await this.flushPerformanceBuffers();
      }, 60 * 1000);
      this.trackingIntervals.set('flush', flushInterval);

      // Generate analytics every 15 minutes
      const analyticsInterval = setInterval(async () => {
        await this.generateCampaignAnalytics();
      }, 15 * 60 * 1000);
      this.trackingIntervals.set('analytics', analyticsInterval);

      logger.info(`Started tracking intervals for ${this.trackingIntervals.size - 2} campaigns`);
    } catch (error) {
      logger.error('Failed to start tracking intervals:', error);
      throw error;
    }
  }

  /**
   * Track campaign performance
   */
  private async trackCampaignPerformance(campaignId: string): Promise<void> {
    try {
      const campaign = this.activeCampaigns.get(campaignId);
      if (!campaign) {
        logger.warn(`Campaign ${campaignId} not found for performance tracking`);
        return;
      }

      // Collect metrics for each account in the campaign
      const accountMetrics = await this.collectAccountMetrics(campaign.accountIds);
      
      // Calculate campaign-level aggregated metrics
      const aggregatedMetrics = await this.aggregateCampaignMetrics(campaignId, accountMetrics);
      
      // Calculate ROI and performance scores
      const performanceData = await this.calculateCampaignPerformance(campaignId, aggregatedMetrics);
      
      // Add to buffer
      this.addToPerformanceBuffer(campaignId, performanceData);

      logger.debug(`Tracked performance for campaign ${campaignId}`);
    } catch (error) {
      logger.error(`Failed to track performance for campaign ${campaignId}:`, error);
    }
  }

  /**
   * Collect metrics for campaign accounts
   */
  private async collectAccountMetrics(accountIds: string[]): Promise<any[]> {
    try {
      const metrics = [];

      for (const accountId of accountIds) {
        // Get latest account metrics
        const accountMetrics = await prisma.accountMetrics.findFirst({
          where: { accountId },
          orderBy: { timestamp: 'desc' }
        });

        if (accountMetrics) {
          // Get engagement metrics for recent tweets
          const engagementMetrics = await prisma.tweetEngagementMetrics.findMany({
            where: { 
              accountId,
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          });

          // Get automation performance
          const automationMetrics = await prisma.automationPerformanceMetrics.findMany({
            where: {
              accountId,
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          });

          metrics.push({
            accountId,
            accountMetrics,
            engagementMetrics,
            automationMetrics
          });
        }
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to collect account metrics:', error);
      return [];
    }
  }

  /**
   * Aggregate campaign metrics from account data
   */
  private async aggregateCampaignMetrics(campaignId: string, accountMetrics: any[]): Promise<any> {
    try {
      let totalReach = 0;
      let totalImpressions = 0;
      let totalEngagements = 0;
      let totalFollowersGained = 0;
      let totalFollowersLost = 0;
      let totalTweets = 0;
      let totalLikes = 0;
      let totalRetweets = 0;
      let totalReplies = 0;
      let totalMentions = 0;

      for (const account of accountMetrics) {
        // Aggregate account metrics
        if (account.accountMetrics) {
          totalFollowersGained += account.accountMetrics.deltaFollowers > 0 ? account.accountMetrics.deltaFollowers : 0;
          totalFollowersLost += account.accountMetrics.deltaFollowers < 0 ? Math.abs(account.accountMetrics.deltaFollowers) : 0;
          totalTweets += account.accountMetrics.deltaTweets || 0;
        }

        // Aggregate engagement metrics
        for (const engagement of account.engagementMetrics || []) {
          totalImpressions += engagement.impressions || 0;
          totalEngagements += engagement.likesCount + engagement.retweetsCount + 
                            engagement.repliesCount + engagement.quotesCount;
          totalLikes += engagement.likesCount;
          totalRetweets += engagement.retweetsCount;
          totalReplies += engagement.repliesCount;
        }

        // Calculate reach (unique impressions estimate)
        totalReach += Math.max(totalImpressions * 0.7, totalFollowersGained); // Estimate
      }

      return {
        totalReach,
        totalImpressions,
        totalEngagements,
        totalFollowersGained,
        totalFollowersLost,
        totalTweets,
        totalLikes,
        totalRetweets,
        totalReplies,
        totalMentions,
        participatingAccounts: accountMetrics.length
      };
    } catch (error) {
      logger.error('Failed to aggregate campaign metrics:', error);
      return {};
    }
  }

  /**
   * Calculate campaign performance metrics
   */
  private async calculateCampaignPerformance(campaignId: string, aggregatedMetrics: any): Promise<CampaignPerformanceData> {
    try {
      const campaign = this.activeCampaigns.get(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Calculate rates and scores
      const engagementRate = aggregatedMetrics.totalImpressions > 0 ? 
        aggregatedMetrics.totalEngagements / aggregatedMetrics.totalImpressions : 0;
      
      const growthRate = campaign.accountIds.length > 0 ? 
        aggregatedMetrics.totalFollowersGained / campaign.accountIds.length : 0;
      
      const conversionRate = aggregatedMetrics.totalEngagements > 0 ? 
        aggregatedMetrics.totalFollowersGained / aggregatedMetrics.totalEngagements : 0;

      // Calculate costs (would be based on actual spending data)
      const estimatedCost = this.estimateCampaignCost(campaignId, aggregatedMetrics);
      const costPerEngagement = aggregatedMetrics.totalEngagements > 0 ? 
        estimatedCost / aggregatedMetrics.totalEngagements : 0;
      const costPerFollower = aggregatedMetrics.totalFollowersGained > 0 ? 
        estimatedCost / aggregatedMetrics.totalFollowersGained : 0;

      // Calculate ROI
      const estimatedValue = this.estimateCampaignValue(campaignId, aggregatedMetrics);
      const roi = estimatedCost > 0 ? (estimatedValue - estimatedCost) / estimatedCost : 0;

      // Calculate quality and compliance scores
      const qualityScore = await this.calculateQualityScore(campaignId, aggregatedMetrics);
      const complianceScore = await this.calculateComplianceScore(campaignId);
      const riskScore = await this.calculateRiskScore(campaignId);

      // Calculate participation rate
      const participationRate = campaign.accountIds.length > 0 ? 
        aggregatedMetrics.participatingAccounts / campaign.accountIds.length : 0;

      return {
        campaignId,
        timestamp: new Date(),
        totalReach: aggregatedMetrics.totalReach,
        totalImpressions: aggregatedMetrics.totalImpressions,
        totalEngagements: aggregatedMetrics.totalEngagements,
        totalFollowersGained: aggregatedMetrics.totalFollowersGained,
        totalFollowersLost: aggregatedMetrics.totalFollowersLost,
        totalTweets: aggregatedMetrics.totalTweets,
        totalLikes: aggregatedMetrics.totalLikes,
        totalRetweets: aggregatedMetrics.totalRetweets,
        totalReplies: aggregatedMetrics.totalReplies,
        totalMentions: aggregatedMetrics.totalMentions,
        engagementRate,
        growthRate,
        conversionRate,
        costPerEngagement,
        costPerFollower,
        roi,
        qualityScore,
        complianceScore,
        riskScore,
        participationRate
      };
    } catch (error) {
      logger.error(`Failed to calculate campaign performance for ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Estimate campaign cost
   */
  private estimateCampaignCost(campaignId: string, metrics: any): number {
    try {
      // This would calculate actual costs based on:
      // - Proxy costs
      // - API usage costs
      // - Infrastructure costs
      // - Time-based costs
      
      // For now, return estimated cost based on activity
      const baseCost = 0.01; // $0.01 per action
      const totalActions = metrics.totalTweets + metrics.totalLikes + 
                          metrics.totalRetweets + metrics.totalReplies;
      
      return totalActions * baseCost;
    } catch (error) {
      logger.error('Failed to estimate campaign cost:', error);
      return 0;
    }
  }

  /**
   * Estimate campaign value
   */
  private estimateCampaignValue(campaignId: string, metrics: any): number {
    try {
      // This would calculate value based on:
      // - Follower value
      // - Engagement value
      // - Reach value
      // - Conversion value
      
      const followerValue = 0.50; // $0.50 per follower
      const engagementValue = 0.05; // $0.05 per engagement
      
      return (metrics.totalFollowersGained * followerValue) + 
             (metrics.totalEngagements * engagementValue);
    } catch (error) {
      logger.error('Failed to estimate campaign value:', error);
      return 0;
    }
  }

  /**
   * Calculate quality score
   */
  private async calculateQualityScore(campaignId: string, metrics: any): Promise<number> {
    try {
      // Quality score based on:
      // - Engagement quality
      // - Content quality
      // - Audience quality
      // - Automation quality
      
      let qualityScore = 0.8; // Base score
      
      // Adjust based on engagement rate
      const engagementRate = metrics.totalImpressions > 0 ? 
        metrics.totalEngagements / metrics.totalImpressions : 0;
      
      if (engagementRate > 0.05) qualityScore += 0.1;
      if (engagementRate > 0.10) qualityScore += 0.1;
      
      return Math.min(qualityScore, 1.0);
    } catch (error) {
      logger.error('Failed to calculate quality score:', error);
      return 0.5;
    }
  }

  /**
   * Calculate compliance score
   */
  private async calculateComplianceScore(campaignId: string): Promise<number> {
    try {
      // Check for compliance violations
      const violations = await prisma.detectionEvent.count({
        where: {
          accountId: { in: this.activeCampaigns.get(campaignId)?.accountIds || [] },
          type: { in: ['suspension', 'rate_limit', 'unusual_activity'] },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      // Base compliance score
      let complianceScore = 1.0;
      
      // Reduce score for violations
      complianceScore -= violations * 0.1;
      
      return Math.max(complianceScore, 0);
    } catch (error) {
      logger.error('Failed to calculate compliance score:', error);
      return 0.5;
    }
  }

  /**
   * Calculate risk score
   */
  private async calculateRiskScore(campaignId: string): Promise<number> {
    try {
      // Risk factors:
      // - Detection events
      // - Account health
      // - Automation aggressiveness
      // - Compliance violations
      
      let riskScore = 0.1; // Base risk
      
      // Check recent detection events
      const detectionEvents = await prisma.detectionEvent.count({
        where: {
          accountId: { in: this.activeCampaigns.get(campaignId)?.accountIds || [] },
          severity: { in: ['high', 'critical'] },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      riskScore += detectionEvents * 0.1;
      
      return Math.min(riskScore, 1.0);
    } catch (error) {
      logger.error('Failed to calculate risk score:', error);
      return 0.5;
    }
  }

  /**
   * Add performance data to buffer
   */
  private addToPerformanceBuffer(campaignId: string, performanceData: CampaignPerformanceData): void {
    try {
      const buffer = this.performanceBuffers.get(campaignId) || [];
      buffer.push(performanceData);
      
      // Limit buffer size
      if (buffer.length > 100) {
        buffer.shift(); // Remove oldest entry
      }
      
      this.performanceBuffers.set(campaignId, buffer);
    } catch (error) {
      logger.error(`Failed to add performance data to buffer for campaign ${campaignId}:`, error);
    }
  }

  /**
   * Flush performance buffers to database
   */
  private async flushPerformanceBuffers(): Promise<void> {
    try {
      for (const [campaignId, buffer] of this.performanceBuffers) {
        if (buffer.length === 0) continue;

        try {
          const records = buffer.map(data => ({
            id: crypto.randomUUID(),
            campaignId: data.campaignId,
            timestamp: data.timestamp,
            accountId: data.accountId,
            totalReach: data.totalReach,
            totalImpressions: data.totalImpressions,
            totalEngagements: data.totalEngagements,
            totalFollowersGained: data.totalFollowersGained,
            totalFollowersLost: data.totalFollowersLost,
            totalTweets: data.totalTweets,
            totalLikes: data.totalLikes,
            totalRetweets: data.totalRetweets,
            totalReplies: data.totalReplies,
            totalMentions: data.totalMentions,
            engagementRate: data.engagementRate,
            growthRate: data.growthRate,
            conversionRate: data.conversionRate,
            costPerEngagement: data.costPerEngagement,
            costPerFollower: data.costPerFollower,
            roi: data.roi,
            qualityScore: data.qualityScore,
            complianceScore: data.complianceScore,
            riskScore: data.riskScore,
            participationRate: data.participationRate,
            contentPerformance: {},
            audienceInsights: {},
            competitorComparison: {},
            abTestResults: {}
          }));

          await prisma.campaignPerformanceMetrics.createMany({
            data: records,
            skipDuplicates: true
          });

          // Clear buffer after successful flush
          this.performanceBuffers.set(campaignId, []);
          
          logger.debug(`Flushed ${records.length} performance records for campaign ${campaignId}`);
        } catch (error) {
          logger.error(`Failed to flush performance buffer for campaign ${campaignId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to flush performance buffers:', error);
    }
  }

  /**
   * Generate campaign analytics
   */
  private async generateCampaignAnalytics(): Promise<void> {
    try {
      for (const campaignId of this.activeCampaigns.keys()) {
        const analytics = await this.calculateCampaignAnalytics(campaignId);
        this.analyticsCache.set(campaignId, analytics);
      }

      logger.debug('Generated analytics for all active campaigns');
    } catch (error) {
      logger.error('Failed to generate campaign analytics:', error);
    }
  }

  /**
   * Calculate campaign analytics
   */
  private async calculateCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    try {
      // Get recent performance data
      const performanceData = await prisma.campaignPerformanceMetrics.findMany({
        where: { 
          campaignId,
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      // Calculate trends
      const trends = this.calculateTrends(performanceData);
      
      // Calculate comparisons
      const comparisons = await this.calculateComparisons(campaignId, performanceData);
      
      // Generate insights
      const insights = await this.generateInsights(campaignId, performanceData);

      return {
        campaignId,
        timeframe: 'daily',
        metrics: {
          performance: performanceData as any,
          trends,
          comparisons,
          insights
        }
      };
    } catch (error) {
      logger.error(`Failed to calculate analytics for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(performanceData: any[]): any {
    try {
      if (performanceData.length < 2) {
        return {
          engagementTrend: 0,
          growthTrend: 0,
          qualityTrend: 0,
          riskTrend: 0
        };
      }

      const recent = performanceData.slice(0, Math.floor(performanceData.length / 2));
      const older = performanceData.slice(Math.floor(performanceData.length / 2));

      const recentAvg = {
        engagement: recent.reduce((sum, d) => sum + d.engagementRate, 0) / recent.length,
        growth: recent.reduce((sum, d) => sum + d.growthRate, 0) / recent.length,
        quality: recent.reduce((sum, d) => sum + d.qualityScore, 0) / recent.length,
        risk: recent.reduce((sum, d) => sum + d.riskScore, 0) / recent.length
      };

      const olderAvg = {
        engagement: older.reduce((sum, d) => sum + d.engagementRate, 0) / older.length,
        growth: older.reduce((sum, d) => sum + d.growthRate, 0) / older.length,
        quality: older.reduce((sum, d) => sum + d.qualityScore, 0) / older.length,
        risk: older.reduce((sum, d) => sum + d.riskScore, 0) / older.length
      };

      return {
        engagementTrend: olderAvg.engagement > 0 ? (recentAvg.engagement - olderAvg.engagement) / olderAvg.engagement : 0,
        growthTrend: olderAvg.growth > 0 ? (recentAvg.growth - olderAvg.growth) / olderAvg.growth : 0,
        qualityTrend: olderAvg.quality > 0 ? (recentAvg.quality - olderAvg.quality) / olderAvg.quality : 0,
        riskTrend: olderAvg.risk > 0 ? (recentAvg.risk - olderAvg.risk) / olderAvg.risk : 0
      };
    } catch (error) {
      logger.error('Failed to calculate trends:', error);
      return { engagementTrend: 0, growthTrend: 0, qualityTrend: 0, riskTrend: 0 };
    }
  }

  /**
   * Calculate performance comparisons
   */
  private async calculateComparisons(campaignId: string, performanceData: any[]): Promise<any> {
    try {
      // This would compare against:
      // - Previous period performance
      // - Industry benchmarks
      // - Target metrics
      
      return {
        previousPeriod: 0.05, // 5% improvement
        benchmark: -0.02, // 2% below benchmark
        target: 0.8 // 80% of target achieved
      };
    } catch (error) {
      logger.error('Failed to calculate comparisons:', error);
      return { previousPeriod: 0, benchmark: 0, target: 0 };
    }
  }

  /**
   * Generate campaign insights
   */
  private async generateInsights(campaignId: string, performanceData: any[]): Promise<any> {
    try {
      const campaign = this.activeCampaigns.get(campaignId);
      if (!campaign) return {};

      // Find top performing accounts
      const accountPerformance = await this.getAccountPerformance(campaign.accountIds);
      const topPerformingAccounts = accountPerformance
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 3)
        .map(a => a.accountId);

      return {
        topPerformingAccounts,
        bestPerformingContent: [], // Would analyze content performance
        audienceInsights: {}, // Would analyze audience data
        competitorComparison: {} // Would compare against competitors
      };
    } catch (error) {
      logger.error('Failed to generate insights:', error);
      return {};
    }
  }

  /**
   * Get account performance data
   */
  private async getAccountPerformance(accountIds: string[]): Promise<any[]> {
    try {
      const performance = [];

      for (const accountId of accountIds) {
        const metrics = await prisma.accountMetrics.findFirst({
          where: { accountId },
          orderBy: { timestamp: 'desc' }
        });

        if (metrics) {
          performance.push({
            accountId,
            engagementRate: metrics.engagementRate,
            growthRate: metrics.growthRate,
            followersCount: metrics.followersCount
          });
        }
      }

      return performance;
    } catch (error) {
      logger.error('Failed to get account performance:', error);
      return [];
    }
  }

  /**
   * Create new campaign
   */
  async createCampaign(config: Omit<CampaignConfiguration, 'id'>): Promise<string> {
    try {
      const campaignId = crypto.randomUUID();
      
      // Store in database
      await prisma.campaign.create({
        data: {
          id: campaignId,
          name: config.name,
          description: '',
          type: config.type,
          status: config.status,
          startDate: config.startDate,
          endDate: config.endDate,
          targetMetrics: config.targetMetrics,
          budgetLimits: config.budgetLimits,
          accountIds: config.accountIds,
          contentStrategy: config.contentStrategy,
          automationRules: config.automationRules,
          complianceSettings: {}
        }
      });

      // Add to active campaigns
      const fullConfig: CampaignConfiguration = { id: campaignId, ...config };
      this.activeCampaigns.set(campaignId, fullConfig);
      
      // Setup tracking if campaign is active
      if (config.status === 'active') {
        this.performanceBuffers.set(campaignId, []);
        
        const interval = setInterval(async () => {
          await this.trackCampaignPerformance(campaignId);
        }, 5 * 60 * 1000);
        
        this.trackingIntervals.set(campaignId, interval);
      }

      logger.info(`Created campaign ${campaignId}: ${config.name}`);
      return campaignId;
    } catch (error) {
      logger.error('Failed to create campaign:', error);
      throw error;
    }
  }

  /**
   * Get campaign analytics
   */
  getCampaignAnalytics(campaignId: string): CampaignAnalytics | null {
    return this.analyticsCache.get(campaignId) || null;
  }

  /**
   * Get campaign statistics
   */
  getCampaignStatistics(): {
    totalCampaigns: number;
    activeCampaigns: number;
    pausedCampaigns: number;
    totalAccounts: number;
    avgROI: number;
    avgQualityScore: number;
  } {
    const campaigns = Array.from(this.activeCampaigns.values());
    const activeCampaigns = campaigns.filter(c => c.status === 'active');
    const pausedCampaigns = campaigns.filter(c => c.status === 'paused');
    const totalAccounts = new Set(campaigns.flatMap(c => c.accountIds)).size;

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns.length,
      pausedCampaigns: pausedCampaigns.length,
      totalAccounts,
      avgROI: 0.15, // Would be calculated from recent performance data
      avgQualityScore: 0.85 // Would be calculated from recent performance data
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down Enterprise Campaign Tracking Service...');
      
      // Clear all intervals
      for (const interval of this.trackingIntervals.values()) {
        clearInterval(interval);
      }
      
      // Flush remaining data
      await this.flushPerformanceBuffers();
      
      // Clear maps
      this.activeCampaigns.clear();
      this.trackingIntervals.clear();
      this.performanceBuffers.clear();
      this.abTests.clear();
      this.analyticsCache.clear();
      
      logger.info('✅ Enterprise Campaign Tracking Service shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown campaign tracking service:', error);
    }
  }
}
