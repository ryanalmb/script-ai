import { logger } from '../../utils/logger';
import { prisma } from '../../lib/prisma';
import { cacheManager } from '../../lib/cache';
import { RealXApiClient } from '../realXApiClient';
import { EnterpriseAntiDetectionCoordinator } from '../antiDetection/antiDetectionCoordinator';
import crypto from 'crypto';

export interface TweetEngagementData {
  tweetId: string;
  accountId: string;
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
  quotesCount: number;
  impressions?: number;
  reach?: number;
  engagementRate: number;
  viralityScore: number;
  sentimentScore?: number;
}

export interface AutomationPerformanceData {
  accountId: string;
  actionType: string;
  actionCategory: 'posting' | 'engagement' | 'following' | 'messaging' | 'analytics';
  status: 'success' | 'failure' | 'partial' | 'skipped' | 'retried';
  executionTime: number;
  responseTime?: number;
  retryCount: number;
  errorCode?: string;
  errorMessage?: string;
  detectionRisk: number;
  qualityScore: number;
  proxyId?: string;
  fingerprintId?: string;
  behaviorPatternId?: string;
  sessionId?: string;
  campaignId?: string;
}

export interface ProxyPerformanceData {
  proxyId: string;
  accountId?: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  timeoutCount: number;
  errorCount: number;
  detectionEvents: number;
  successRate: number;
  reliabilityScore: number;
  performanceScore: number;
}

export interface BehavioralAnalyticsData {
  accountId: string;
  sessionId?: string;
  actionType: string;
  actionTiming: number;
  sessionDuration?: number;
  actionsInSession: number;
  errorRate: number;
  hesitationEvents: number;
  correctionEvents: number;
  pauseEvents: number;
  humanLikenessScore: number;
  patternConsistency: number;
  anomalyScore: number;
  behaviorPattern?: string;
}

/**
 * Enterprise Live Analytics Data Collection Service
 * Collects real-time engagement metrics, automation performance, and behavioral analytics
 */
export class EnterpriseAnalyticsCollectionService {
  private collectionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private dataBuffers: Map<string, any[]> = new Map();
  private rateLimiters: Map<string, any> = new Map();
  private antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator;
  private xClients: Map<string, RealXApiClient> = new Map();
  private isCollecting: boolean = false;

  constructor(antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator) {
    this.antiDetectionCoordinator = antiDetectionCoordinator;
    this.initializeAnalyticsCollection();
  }

  /**
   * Initialize analytics collection service
   */
  private async initializeAnalyticsCollection(): Promise<void> {
    try {
      logger.info('🔧 Initializing Enterprise Analytics Collection Service...');
      
      await this.loadXClients();
      await this.setupDataBuffers();
      await this.setupRateLimiters();
      await this.startCollectionIntervals();
      
      this.isCollecting = true;
      logger.info('✅ Enterprise Analytics Collection Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise Analytics Collection Service:', error);
      throw new Error(`Analytics Collection Service initialization failed: ${error}`);
    }
  }

  /**
   * Load X API clients for data collection
   */
  private async loadXClients(): Promise<void> {
    try {
      const accounts = await prisma.xAccount.findMany({
        where: { isActive: true },
        include: { user: true }
      });

      for (const account of accounts) {
        if (account.username && account.user.email) {
          const credentials = {
            username: account.username,
            email: account.user.email,
            password: '' // Securely retrieved
          };

          const client = new RealXApiClient(
            account.id,
            credentials,
            this.antiDetectionCoordinator
          );

          this.xClients.set(account.id, client);
        }
      }

      logger.info(`Loaded ${this.xClients.size} X API clients for analytics collection`);
    } catch (error) {
      logger.error('Failed to load X clients for analytics:', error);
      throw error;
    }
  }

  /**
   * Setup data buffers for batch processing
   */
  private async setupDataBuffers(): Promise<void> {
    try {
      const bufferTypes = [
        'tweet_engagement',
        'automation_performance',
        'proxy_performance',
        'fingerprint_performance',
        'behavioral_analytics'
      ];

      for (const bufferType of bufferTypes) {
        this.dataBuffers.set(bufferType, []);
      }

      logger.info('Data buffers initialized for analytics collection');
    } catch (error) {
      logger.error('Failed to setup data buffers:', error);
      throw error;
    }
  }

  /**
   * Setup rate limiters for API calls
   */
  private async setupRateLimiters(): Promise<void> {
    try {
      const rateLimitConfig = {
        tweetEngagement: { limit: 300, window: 900000 }, // 300 requests per 15 minutes
        userMetrics: { limit: 75, window: 900000 }, // 75 requests per 15 minutes
        search: { limit: 180, window: 900000 } // 180 requests per 15 minutes
      };

      for (const [type, config] of Object.entries(rateLimitConfig)) {
        this.rateLimiters.set(type, {
          requests: 0,
          resetTime: Date.now() + config.window,
          limit: config.limit,
          window: config.window
        });
      }

      logger.info('Rate limiters configured for analytics collection');
    } catch (error) {
      logger.error('Failed to setup rate limiters:', error);
      throw error;
    }
  }

  /**
   * Start collection intervals
   */
  private async startCollectionIntervals(): Promise<void> {
    try {
      // Tweet engagement collection - every 5 minutes
      const tweetEngagementInterval = setInterval(async () => {
        await this.collectTweetEngagementMetrics();
      }, 5 * 60 * 1000);
      this.collectionIntervals.set('tweet_engagement', tweetEngagementInterval);

      // Automation performance collection - every 1 minute
      const automationPerformanceInterval = setInterval(async () => {
        await this.collectAutomationPerformanceMetrics();
      }, 60 * 1000);
      this.collectionIntervals.set('automation_performance', automationPerformanceInterval);

      // Proxy performance collection - every 2 minutes
      const proxyPerformanceInterval = setInterval(async () => {
        await this.collectProxyPerformanceMetrics();
      }, 2 * 60 * 1000);
      this.collectionIntervals.set('proxy_performance', proxyPerformanceInterval);

      // Behavioral analytics collection - every 30 seconds
      const behavioralAnalyticsInterval = setInterval(async () => {
        await this.collectBehavioralAnalytics();
      }, 30 * 1000);
      this.collectionIntervals.set('behavioral_analytics', behavioralAnalyticsInterval);

      // Data buffer flush - every 10 seconds
      const bufferFlushInterval = setInterval(async () => {
        await this.flushDataBuffers();
      }, 10 * 1000);
      this.collectionIntervals.set('buffer_flush', bufferFlushInterval);

      logger.info(`Started ${this.collectionIntervals.size} collection intervals`);
    } catch (error) {
      logger.error('Failed to start collection intervals:', error);
      throw error;
    }
  }

  /**
   * Collect tweet engagement metrics
   */
  private async collectTweetEngagementMetrics(): Promise<void> {
    try {
      if (!this.checkRateLimit('tweetEngagement')) {
        logger.debug('Rate limit exceeded for tweet engagement collection');
        return;
      }

      // Get recent tweets that need engagement tracking
      const recentTweets = await prisma.tweet.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        include: { account: true },
        take: 50 // Limit to avoid rate limits
      });

      for (const tweet of recentTweets) {
        try {
          const client = this.xClients.get(tweet.accountId);
          if (!client) continue;

          // Get current engagement metrics from X API
          const tweetData = await client.getTweetById(tweet.id);
          if (!tweetData) continue;

          // Get previous metrics for comparison
          const previousMetrics = await this.getPreviousTweetMetrics(tweet.id);

          // Calculate deltas and rates
          const deltaLikes = previousMetrics ? 
            tweetData.metrics.likes - previousMetrics.likesCount : tweetData.metrics.likes;
          const deltaRetweets = previousMetrics ? 
            tweetData.metrics.retweets - previousMetrics.retweetsCount : tweetData.metrics.retweets;
          const deltaReplies = previousMetrics ? 
            tweetData.metrics.replies - previousMetrics.repliesCount : tweetData.metrics.replies;
          const deltaQuotes = previousMetrics ? 
            tweetData.metrics.quotes - previousMetrics.quotesCount : tweetData.metrics.quotes;

          const totalEngagements = tweetData.metrics.likes + tweetData.metrics.retweets + 
                                 tweetData.metrics.replies + tweetData.metrics.quotes;
          const engagementRate = totalEngagements > 0 ? totalEngagements / (tweetData.impressions || 1000) : 0;
          const viralityScore = this.calculateViralityScore(tweetData.metrics);

          const engagementData: TweetEngagementData = {
            tweetId: tweet.id,
            accountId: tweet.accountId,
            likesCount: tweetData.metrics.likes,
            retweetsCount: tweetData.metrics.retweets,
            repliesCount: tweetData.metrics.replies,
            quotesCount: tweetData.metrics.quotes,
            impressions: tweetData.impressions,
            reach: tweetData.reach,
            engagementRate,
            viralityScore,
            sentimentScore: await this.calculateSentimentScore(tweetData.text)
          };

          // Add to buffer for batch processing
          this.addToBuffer('tweet_engagement', {
            ...engagementData,
            deltaLikes,
            deltaRetweets,
            deltaReplies,
            deltaQuotes,
            timestamp: new Date()
          });

          // Update rate limiter
          this.updateRateLimit('tweetEngagement');

        } catch (error) {
          logger.error(`Failed to collect engagement metrics for tweet ${tweet.id}:`, error);
        }
      }

      logger.debug(`Collected engagement metrics for ${recentTweets.length} tweets`);
    } catch (error) {
      logger.error('Failed to collect tweet engagement metrics:', error);
    }
  }

  /**
   * Collect automation performance metrics
   */
  private async collectAutomationPerformanceMetrics(): Promise<void> {
    try {
      // Get recent automation actions from cache or database
      const recentActions = await this.getRecentAutomationActions();

      for (const action of recentActions) {
        const performanceData: AutomationPerformanceData = {
          accountId: action.accountId,
          actionType: action.actionType,
          actionCategory: this.categorizeAction(action.actionType),
          status: action.status,
          executionTime: action.executionTime,
          responseTime: action.responseTime,
          retryCount: action.retryCount || 0,
          errorCode: action.errorCode,
          errorMessage: action.errorMessage,
          detectionRisk: action.detectionRisk || 0,
          qualityScore: action.qualityScore || 1,
          proxyId: action.proxyId,
          fingerprintId: action.fingerprintId,
          behaviorPatternId: action.behaviorPatternId,
          sessionId: action.sessionId,
          campaignId: action.campaignId
        };

        this.addToBuffer('automation_performance', {
          ...performanceData,
          timestamp: new Date()
        });
      }

      logger.debug(`Collected performance metrics for ${recentActions.length} automation actions`);
    } catch (error) {
      logger.error('Failed to collect automation performance metrics:', error);
    }
  }

  /**
   * Collect proxy performance metrics
   */
  private async collectProxyPerformanceMetrics(): Promise<void> {
    try {
      // Get proxy performance data from anti-detection coordinator
      const proxyStats = this.antiDetectionCoordinator.getAntiDetectionStatistics();
      
      if (proxyStats.systemHealth.proxies) {
        const proxyData = proxyStats.systemHealth.proxies;
        
        for (const [proxyId, stats] of Object.entries(proxyData.byType || {})) {
          const performanceData: ProxyPerformanceData = {
            proxyId,
            requestCount: stats.requests || 0,
            successCount: stats.successes || 0,
            failureCount: stats.failures || 0,
            avgResponseTime: stats.avgResponseTime || 0,
            minResponseTime: stats.minResponseTime || 0,
            maxResponseTime: stats.maxResponseTime || 0,
            timeoutCount: stats.timeouts || 0,
            errorCount: stats.errors || 0,
            detectionEvents: stats.detectionEvents || 0,
            successRate: stats.successRate || 0,
            reliabilityScore: stats.reliabilityScore || 0,
            performanceScore: stats.performanceScore || 0
          };

          this.addToBuffer('proxy_performance', {
            ...performanceData,
            timestamp: new Date()
          });
        }
      }

      logger.debug('Collected proxy performance metrics');
    } catch (error) {
      logger.error('Failed to collect proxy performance metrics:', error);
    }
  }

  /**
   * Collect behavioral analytics
   */
  private async collectBehavioralAnalytics(): Promise<void> {
    try {
      // Get behavioral data from behavior simulator
      const behaviorStats = this.antiDetectionCoordinator.getAntiDetectionStatistics();
      
      if (behaviorStats.systemHealth.behavior) {
        const behaviorData = behaviorStats.systemHealth.behavior;
        
        // Process active sessions
        for (const sessionId of Object.keys(behaviorData.activeSessions || {})) {
          const sessionData = behaviorData.activeSessions[sessionId];
          
          const analyticsData: BehavioralAnalyticsData = {
            accountId: sessionData.accountId,
            sessionId,
            actionType: sessionData.lastActionType || 'unknown',
            actionTiming: sessionData.lastActionTiming || 0,
            sessionDuration: sessionData.duration || 0,
            actionsInSession: sessionData.actionsCount || 0,
            errorRate: sessionData.errorRate || 0,
            hesitationEvents: sessionData.hesitationEvents || 0,
            correctionEvents: sessionData.correctionEvents || 0,
            pauseEvents: sessionData.pauseEvents || 0,
            humanLikenessScore: sessionData.humanLikenessScore || 1,
            patternConsistency: sessionData.patternConsistency || 1,
            anomalyScore: sessionData.anomalyScore || 0,
            behaviorPattern: sessionData.patternId
          };

          this.addToBuffer('behavioral_analytics', {
            ...analyticsData,
            timestamp: new Date()
          });
        }
      }

      logger.debug('Collected behavioral analytics');
    } catch (error) {
      logger.error('Failed to collect behavioral analytics:', error);
    }
  }

  /**
   * Flush data buffers to database
   */
  private async flushDataBuffers(): Promise<void> {
    try {
      for (const [bufferType, buffer] of this.dataBuffers) {
        if (buffer.length === 0) continue;

        try {
          await this.flushSpecificBuffer(bufferType, buffer);
          this.dataBuffers.set(bufferType, []); // Clear buffer after successful flush
        } catch (error) {
          logger.error(`Failed to flush ${bufferType} buffer:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to flush data buffers:', error);
    }
  }

  /**
   * Flush specific buffer to database
   */
  private async flushSpecificBuffer(bufferType: string, buffer: any[]): Promise<void> {
    try {
      switch (bufferType) {
        case 'tweet_engagement':
          await this.flushTweetEngagementBuffer(buffer);
          break;
        case 'automation_performance':
          await this.flushAutomationPerformanceBuffer(buffer);
          break;
        case 'proxy_performance':
          await this.flushProxyPerformanceBuffer(buffer);
          break;
        case 'behavioral_analytics':
          await this.flushBehavioralAnalyticsBuffer(buffer);
          break;
        default:
          logger.warn(`Unknown buffer type: ${bufferType}`);
      }
    } catch (error) {
      logger.error(`Failed to flush ${bufferType} buffer:`, error);
      throw error;
    }
  }

  /**
   * Flush tweet engagement buffer
   */
  private async flushTweetEngagementBuffer(buffer: any[]): Promise<void> {
    try {
      const records = buffer.map(data => ({
        id: crypto.randomUUID(),
        tweetId: data.tweetId,
        accountId: data.accountId,
        timestamp: data.timestamp,
        likesCount: data.likesCount,
        retweetsCount: data.retweetsCount,
        repliesCount: data.repliesCount,
        quotesCount: data.quotesCount,
        impressions: data.impressions,
        reach: data.reach,
        engagementRate: data.engagementRate,
        viralityScore: data.viralityScore,
        sentimentScore: data.sentimentScore,
        deltaLikes: data.deltaLikes,
        deltaRetweets: data.deltaRetweets,
        deltaReplies: data.deltaReplies,
        deltaQuotes: data.deltaQuotes,
        syncSource: 'api',
        dataQuality: 1.0
      }));

      await prisma.tweetEngagementMetrics.createMany({
        data: records,
        skipDuplicates: true
      });

      logger.debug(`Flushed ${records.length} tweet engagement records`);
    } catch (error) {
      logger.error('Failed to flush tweet engagement buffer:', error);
      throw error;
    }
  }

  /**
   * Flush automation performance buffer
   */
  private async flushAutomationPerformanceBuffer(buffer: any[]): Promise<void> {
    try {
      const records = buffer.map(data => ({
        id: crypto.randomUUID(),
        accountId: data.accountId,
        timestamp: data.timestamp,
        actionType: data.actionType,
        actionCategory: data.actionCategory,
        status: data.status,
        executionTime: data.executionTime,
        responseTime: data.responseTime,
        retryCount: data.retryCount,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        detectionRisk: data.detectionRisk,
        qualityScore: data.qualityScore,
        proxyId: data.proxyId,
        fingerprintId: data.fingerprintId,
        behaviorPatternId: data.behaviorPatternId,
        sessionId: data.sessionId,
        campaignId: data.campaignId,
        targetData: {},
        resultData: {},
        contextData: {},
        performanceMetrics: {}
      }));

      await prisma.automationPerformanceMetrics.createMany({
        data: records,
        skipDuplicates: true
      });

      logger.debug(`Flushed ${records.length} automation performance records`);
    } catch (error) {
      logger.error('Failed to flush automation performance buffer:', error);
      throw error;
    }
  }

  /**
   * Flush proxy performance buffer
   */
  private async flushProxyPerformanceBuffer(buffer: any[]): Promise<void> {
    try {
      const records = buffer.map(data => ({
        id: crypto.randomUUID(),
        proxyId: data.proxyId,
        timestamp: data.timestamp,
        accountId: data.accountId,
        requestCount: data.requestCount,
        successCount: data.successCount,
        failureCount: data.failureCount,
        avgResponseTime: data.avgResponseTime,
        minResponseTime: data.minResponseTime,
        maxResponseTime: data.maxResponseTime,
        timeoutCount: data.timeoutCount,
        errorCount: data.errorCount,
        detectionEvents: data.detectionEvents,
        successRate: data.successRate,
        reliabilityScore: data.reliabilityScore,
        performanceScore: data.performanceScore,
        geoConsistency: 1.0,
        bandwidthUsed: 0,
        connectionErrors: {},
        httpStatusCodes: {},
        geolocationData: {},
        qualityMetrics: {}
      }));

      await prisma.proxyPerformanceMetrics.createMany({
        data: records,
        skipDuplicates: true
      });

      logger.debug(`Flushed ${records.length} proxy performance records`);
    } catch (error) {
      logger.error('Failed to flush proxy performance buffer:', error);
      throw error;
    }
  }

  /**
   * Flush behavioral analytics buffer
   */
  private async flushBehavioralAnalyticsBuffer(buffer: any[]): Promise<void> {
    try {
      const records = buffer.map(data => ({
        id: crypto.randomUUID(),
        accountId: data.accountId,
        sessionId: data.sessionId,
        timestamp: data.timestamp,
        actionType: data.actionType,
        actionTiming: data.actionTiming,
        sessionDuration: data.sessionDuration,
        actionsInSession: data.actionsInSession,
        errorRate: data.errorRate,
        hesitationEvents: data.hesitationEvents,
        correctionEvents: data.correctionEvents,
        pauseEvents: data.pauseEvents,
        humanLikenessScore: data.humanLikenessScore,
        patternConsistency: data.patternConsistency,
        anomalyScore: data.anomalyScore,
        timingDistribution: {},
        behaviorPattern: data.behaviorPattern,
        contextFactors: {},
        qualityMetrics: {}
      }));

      await prisma.behavioralAnalytics.createMany({
        data: records,
        skipDuplicates: true
      });

      logger.debug(`Flushed ${records.length} behavioral analytics records`);
    } catch (error) {
      logger.error('Failed to flush behavioral analytics buffer:', error);
      throw error;
    }
  }

  /**
   * Add data to buffer
   */
  private addToBuffer(bufferType: string, data: any): void {
    try {
      const buffer = this.dataBuffers.get(bufferType) || [];
      buffer.push(data);
      
      // Limit buffer size to prevent memory issues
      if (buffer.length > 1000) {
        buffer.shift(); // Remove oldest entry
      }
      
      this.dataBuffers.set(bufferType, buffer);
    } catch (error) {
      logger.error(`Failed to add data to ${bufferType} buffer:`, error);
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(type: string): boolean {
    try {
      const rateLimiter = this.rateLimiters.get(type);
      if (!rateLimiter) return true;

      const now = Date.now();
      
      // Reset if window has passed
      if (now >= rateLimiter.resetTime) {
        rateLimiter.requests = 0;
        rateLimiter.resetTime = now + rateLimiter.window;
      }

      return rateLimiter.requests < rateLimiter.limit;
    } catch (error) {
      logger.error(`Rate limit check failed for ${type}:`, error);
      return false;
    }
  }

  /**
   * Update rate limit counter
   */
  private updateRateLimit(type: string): void {
    try {
      const rateLimiter = this.rateLimiters.get(type);
      if (rateLimiter) {
        rateLimiter.requests++;
      }
    } catch (error) {
      logger.error(`Failed to update rate limit for ${type}:`, error);
    }
  }

  /**
   * Get previous tweet metrics
   */
  private async getPreviousTweetMetrics(tweetId: string): Promise<any> {
    try {
      return await prisma.tweetEngagementMetrics.findFirst({
        where: { tweetId },
        orderBy: { timestamp: 'desc' }
      });
    } catch (error) {
      logger.error('Failed to get previous tweet metrics:', error);
      return null;
    }
  }

  /**
   * Get recent automation actions
   */
  private async getRecentAutomationActions(): Promise<any[]> {
    try {
      // This would get recent actions from cache or database
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Failed to get recent automation actions:', error);
      return [];
    }
  }

  /**
   * Categorize action type
   */
  private categorizeAction(actionType: string): 'posting' | 'engagement' | 'following' | 'messaging' | 'analytics' {
    const categories = {
      'post_tweet': 'posting',
      'like_tweet': 'engagement',
      'retweet': 'engagement',
      'reply': 'engagement',
      'follow_user': 'following',
      'unfollow_user': 'following',
      'send_dm': 'messaging',
      'search_tweets': 'analytics'
    };

    return categories[actionType] || 'analytics';
  }

  /**
   * Calculate virality score
   */
  private calculateViralityScore(metrics: any): number {
    try {
      const totalEngagements = metrics.likes + metrics.retweets + metrics.replies + metrics.quotes;
      const retweetWeight = metrics.retweets * 2; // Retweets have higher virality impact
      const viralityScore = (totalEngagements + retweetWeight) / Math.max(metrics.impressions || 1000, 1);
      return Math.min(viralityScore, 1); // Cap at 1
    } catch (error) {
      logger.error('Failed to calculate virality score:', error);
      return 0;
    }
  }

  /**
   * Calculate sentiment score
   */
  private async calculateSentimentScore(text: string): Promise<number> {
    try {
      // This would use a sentiment analysis service
      // For now, return neutral sentiment
      return 0;
    } catch (error) {
      logger.error('Failed to calculate sentiment score:', error);
      return 0;
    }
  }

  /**
   * Get analytics statistics
   */
  getAnalyticsStatistics(): {
    isCollecting: boolean;
    collectionIntervals: number;
    bufferSizes: { [key: string]: number };
    rateLimitStatus: { [key: string]: any };
    totalRecordsCollected: number;
  } {
    const bufferSizes: { [key: string]: number } = {};
    for (const [type, buffer] of this.dataBuffers) {
      bufferSizes[type] = buffer.length;
    }

    const rateLimitStatus: { [key: string]: any } = {};
    for (const [type, limiter] of this.rateLimiters) {
      rateLimitStatus[type] = {
        requests: limiter.requests,
        limit: limiter.limit,
        resetTime: new Date(limiter.resetTime)
      };
    }

    return {
      isCollecting: this.isCollecting,
      collectionIntervals: this.collectionIntervals.size,
      bufferSizes,
      rateLimitStatus,
      totalRecordsCollected: Object.values(bufferSizes).reduce((sum, size) => sum + size, 0)
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down Enterprise Analytics Collection Service...');
      
      this.isCollecting = false;
      
      // Clear all intervals
      for (const interval of this.collectionIntervals.values()) {
        clearInterval(interval);
      }
      
      // Flush remaining data
      await this.flushDataBuffers();
      
      // Clear maps
      this.collectionIntervals.clear();
      this.dataBuffers.clear();
      this.rateLimiters.clear();
      this.xClients.clear();
      
      logger.info('✅ Enterprise Analytics Collection Service shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown analytics collection service:', error);
    }
  }
}
