/**
 * X (Twitter) Automation Service
 * Handles quality-focused automation with regional compliance
 */

import { TwitterApi, TweetV2PostTweetResult, UserV2 } from 'twitter-api-v2';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

// Type definitions
interface ContentData {
  text: string;
  mediaUrls?: string[];
  hashtags?: string[];
  mentions?: string[];
  scheduledFor?: Date;
}

interface PostOptions {
  skipQualityCheck?: boolean;
  skipRateLimit?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

interface QualityCheckResult {
  approved: boolean;
  score: number;
  reason?: string;
  suggestions?: string[];
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

interface AutomationStatus {
  isActive: boolean;
  activeFeatures: string[];
  lastActivity: Date;
  stats: {
    postsToday: number;
    likesToday: number;
    commentsToday: number;
    followsToday: number;
  };
}

interface QualityThresholds {
  minQualityScore: number;
  minComplianceScore: number;
  maxPostsPerHour: number;
  maxPostsPerDay: number;
  minTimeBetweenPosts: number;
}

export class XAutomationService {
  private clients: Map<string, TwitterApi>;
  private activeAutomations: Map<string, any>;
  private qualityThresholds: QualityThresholds;

  constructor() {
    this.clients = new Map(); // Store Twitter clients for each account
    this.activeAutomations = new Map(); // Track active automation tasks
    this.qualityThresholds = {
      minQualityScore: 0.8,
      minComplianceScore: 0.9,
      maxPostsPerHour: 5,
      maxPostsPerDay: 50,
      minTimeBetweenPosts: 15 * 60 * 1000 // 15 minutes
    };
  }

  /**
   * Initialize Twitter client for an account
   */
  async initializeClient(accountId: string): Promise<TwitterApi> {
    try {
      const account = await prisma.xAccount.findUnique({
        where: { id: accountId },
        include: { user: true }
      });

      if (!account || !account.accessToken || !account.accessTokenSecret) {
        throw new Error('Account credentials not found');
      }

      const client = new TwitterApi({
        appKey: process.env.X_API_KEY!,
        appSecret: process.env.X_API_SECRET!,
        accessToken: account.accessToken,
        accessSecret: account.accessTokenSecret,
      });

      // Verify credentials
      const userResult = await client.v2.me();
      const user = userResult.data;
      
      // Update account info
      await prisma.xAccount.update({
        where: { id: accountId },
        data: {
          username: user.username,
          displayName: user.name,
          isVerified: user.verified || false,
          lastActivity: new Date()
        }
      });

      this.clients.set(accountId, client);
      logger.info(`Twitter client initialized for account ${accountId}`);
      
      return client;
    } catch (error) {
      logger.error(`Failed to initialize Twitter client for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Post content to X with quality checks
   */
  async postContent(accountId: string, content: ContentData, options: PostOptions = {}): Promise<TweetV2PostTweetResult> {
    try {
      // Get or initialize client
      let client = this.clients.get(accountId);
      if (!client) {
        client = await this.initializeClient(accountId);
      }

      // Quality and rate limiting checks
      if (!options.skipQualityCheck) {
        const qualityCheck = await this.performQualityChecks(accountId, content);
        if (!qualityCheck.approved) {
          throw new Error(`Quality check failed: ${qualityCheck.reason}`);
        }
      }

      // Rate limiting check
      if (!options.skipRateLimit) {
        const rateLimitCheck = await this.checkRateLimits(accountId);
        if (!rateLimitCheck.allowed) {
          throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
        }
      }

      // Prepare tweet data
      const tweetData: any = {
        text: content.text
      };

      // Add media if provided
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        // Handle media upload (simplified for this example)
        logger.info('Media upload not implemented in this version');
      }

      // Post the tweet
      const result = await client.v2.tweet(tweetData);

      // Log the post
      await this.logPost(accountId, content, result);

      // Update rate limiting cache
      await this.updateRateLimitCache(accountId);

      logger.info(`Content posted successfully for account ${accountId}`, {
        accountId,
        tweetId: result.data.id,
        text: content.text.substring(0, 50) + '...'
      });

      return result;

    } catch (error) {
      logger.error(`Failed to post content for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Perform quality checks on content
   */
  private async performQualityChecks(accountId: string, content: ContentData): Promise<QualityCheckResult> {
    try {
      let score = 1.0;
      const suggestions: string[] = [];

      // Check content length
      if (content.text.length < 10) {
        score -= 0.3;
        suggestions.push('Content is too short');
      }

      if (content.text.length > 280) {
        return {
          approved: false,
          score: 0,
          reason: 'Content exceeds 280 characters',
          suggestions: ['Shorten the content to fit Twitter\'s character limit']
        };
      }

      // Check for spam indicators
      const spamIndicators = ['!!!', 'URGENT', 'CLICK NOW', 'FREE MONEY'];
      const hasSpamIndicators = spamIndicators.some(indicator => 
        content.text.toUpperCase().includes(indicator)
      );

      if (hasSpamIndicators) {
        score -= 0.4;
        suggestions.push('Content contains potential spam indicators');
      }

      // Check hashtag count
      const hashtagCount = (content.hashtags || []).length;
      if (hashtagCount > 5) {
        score -= 0.2;
        suggestions.push('Too many hashtags (recommended: 1-3)');
      }

      // Check for appropriate content
      const inappropriateWords = ['hate', 'violence', 'scam'];
      const hasInappropriateContent = inappropriateWords.some(word => 
        content.text.toLowerCase().includes(word)
      );

      if (hasInappropriateContent) {
        return {
          approved: false,
          score: 0,
          reason: 'Content contains inappropriate language',
          suggestions: ['Remove inappropriate language']
        };
      }

      const approved = score >= this.qualityThresholds.minQualityScore;

      const result: QualityCheckResult = {
        approved,
        score,
      };

      if (!approved) {
        result.reason = 'Quality score below threshold';
      }

      if (suggestions.length > 0) {
        result.suggestions = suggestions;
      }

      return result;

    } catch (error) {
      logger.error('Quality check failed:', error);
      return {
        approved: false,
        score: 0,
        reason: 'Quality check system error'
      };
    }
  }

  /**
   * Check rate limits for account
   */
  private async checkRateLimits(accountId: string): Promise<RateLimitResult> {
    try {
      const now = new Date();
      const hourKey = `rate_limit:${accountId}:${now.getHours()}`;
      const dayKey = `rate_limit:${accountId}:${now.toDateString()}`;

      // Get current counts from cache
      const hourlyCount = await cacheManager.get<number>(hourKey) || 0;
      const dailyCount = await cacheManager.get<number>(dayKey) || 0;

      // Check hourly limit
      if (hourlyCount >= this.qualityThresholds.maxPostsPerHour) {
        return {
          allowed: false,
          reason: 'Hourly post limit exceeded',
          retryAfter: 3600 - (now.getMinutes() * 60 + now.getSeconds())
        };
      }

      // Check daily limit
      if (dailyCount >= this.qualityThresholds.maxPostsPerDay) {
        return {
          allowed: false,
          reason: 'Daily post limit exceeded',
          retryAfter: 86400 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())
        };
      }

      // Check minimum time between posts
      const lastPostKey = `last_post:${accountId}`;
      const lastPostTime = await cacheManager.get<number>(lastPostKey);
      
      if (lastPostTime && (now.getTime() - lastPostTime) < this.qualityThresholds.minTimeBetweenPosts) {
        return {
          allowed: false,
          reason: 'Minimum time between posts not met',
          retryAfter: Math.ceil((this.qualityThresholds.minTimeBetweenPosts - (now.getTime() - lastPostTime)) / 1000)
        };
      }

      return { allowed: true };

    } catch (error) {
      logger.error('Rate limit check failed:', error);
      return {
        allowed: false,
        reason: 'Rate limit check system error'
      };
    }
  }

  /**
   * Update rate limiting cache after posting
   */
  private async updateRateLimitCache(accountId: string): Promise<void> {
    try {
      const now = new Date();
      const hourKey = `rate_limit:${accountId}:${now.getHours()}`;
      const dayKey = `rate_limit:${accountId}:${now.toDateString()}`;
      const lastPostKey = `last_post:${accountId}`;

      // Increment counters
      await cacheManager.incrementRateLimit(hourKey, 3600000); // 1 hour
      await cacheManager.incrementRateLimit(dayKey, 86400000); // 24 hours
      
      // Update last post time
      await cacheManager.set(lastPostKey, now.getTime(), 86400); // 24 hours

    } catch (error) {
      logger.error('Failed to update rate limit cache:', error);
    }
  }

  /**
   * Log post to database
   */
  private async logPost(accountId: string, content: ContentData, result: TweetV2PostTweetResult): Promise<void> {
    try {
      await prisma.post.create({
        data: {
          accountId,
          content: content.text,
          mediaUrls: content.mediaUrls || [],
          hashtags: content.hashtags || [],
          mentions: content.mentions || [],
          status: 'PUBLISHED',
          tweetId: result.data.id,
          publishedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to log post to database:', error);
    }
  }

  /**
   * Get account automation status
   */
  async getAccountStatus(accountId: string): Promise<AutomationStatus | null> {
    try {
      // This would typically fetch from database or cache
      // For now, return a mock status
      return {
        isActive: this.activeAutomations.has(accountId),
        activeFeatures: [],
        lastActivity: new Date(),
        stats: {
          postsToday: 0,
          likesToday: 0,
          commentsToday: 0,
          followsToday: 0
        }
      };
    } catch (error) {
      logger.error('Failed to get account status:', error);
      return null;
    }
  }

  /**
   * Update settings for account
   */
  async updateSettings(accountId: string, settings: any): Promise<void> {
    try {
      // Store settings in cache or database
      await cacheManager.set(`settings:${accountId}`, settings, 86400);
      logger.info(`Settings updated for account ${accountId}`);
    } catch (error) {
      logger.error('Failed to update settings:', error);
    }
  }

  /**
   * Stop all automation for account
   */
  async stopAllAutomation(accountId: string): Promise<void> {
    try {
      this.activeAutomations.delete(accountId);
      logger.info(`All automation stopped for account ${accountId}`);
    } catch (error) {
      logger.error('Failed to stop automation:', error);
    }
  }

  /**
   * Get Twitter client for account
   */
  getClient(accountId: string): TwitterApi | undefined {
    return this.clients.get(accountId);
  }

  /**
   * Remove client for account
   */
  removeClient(accountId: string): void {
    this.clients.delete(accountId);
    this.activeAutomations.delete(accountId);
  }
}
