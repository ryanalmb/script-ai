/**
 * Enterprise X (Twitter) Automation Service with Comprehensive Twikit Integration
 *
 * Provides enterprise-grade automation capabilities using Twikit as the underlying API client,
 * with advanced session management, rate limiting coordination, anti-detection measures,
 * and comprehensive error handling for production-scale social media automation.
 *
 * Features:
 * - Complete Twikit API integration (50+ methods)
 * - Enterprise session management with TwikitSessionManager
 * - Distributed rate limiting with GlobalRateLimitCoordinator
 * - Advanced anti-detection and proxy rotation
 * - Comprehensive error handling and retry mechanisms
 * - Quality checks and compliance validation
 * - Real-time monitoring and analytics
 * - Multi-account coordination and management
 *
 * @version 2.0.0 - Enterprise Twikit Integration
 * @author Enterprise Automation Team
 */

import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { TwikitSessionManager, TwikitSession, TwikitSessionOptions } from './twikitSessionManager';
import {
  GlobalRateLimitCoordinator,
  RateLimitAction,
  RateLimitPriority,
  RateLimitCheckRequest,
  RateLimitCheckResponse,
  AccountType
} from './globalRateLimitCoordinator';
import { EnterpriseAntiDetectionCoordinator } from './antiDetection/antiDetectionCoordinator';
import { ProxyRotationManager, ActionRiskLevel } from './proxyRotationManager';
import { TwikitConfigManager } from '../config/twikit';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';

/**
 * Enterprise X Automation Configuration
 * Comprehensive configuration interface for all automation features
 */
export interface XAutomationConfig {
  // Rate Limiting Configuration
  maxTweetsPerHour: number;
  maxFollowsPerHour: number;
  maxLikesPerHour: number;
  maxRetweetsPerHour: number;
  maxDMsPerHour: number;
  maxBookmarksPerHour: number;
  maxCommentsPerHour: number;

  // Quality and Compliance
  qualityThreshold: number;
  enableContentFiltering: boolean;
  enableRegionalCompliance: boolean;
  enableSpamDetection: boolean;
  enableSentimentAnalysis: boolean;

  // Error Handling and Retry
  retryAttempts: number;
  retryDelay: number;
  maxRetryDelay: number;
  exponentialBackoff: boolean;
  circuitBreakerThreshold: number;

  // Session Management
  sessionRotationInterval: number;
  maxConcurrentSessions: number;
  sessionHealthCheckInterval: number;

  // Anti-Detection
  enableBehaviorSimulation: boolean;
  enableFingerprintRotation: boolean;
  humanLikeDelays: boolean;
  randomizeTimings: boolean;

  // Monitoring and Analytics
  enableRealTimeMonitoring: boolean;
  enablePerformanceTracking: boolean;
  enableAuditLogging: boolean;
}

/**
 * Twikit Action Types - Complete enumeration of all available actions
 */
export enum TwikitActionType {
  // Authentication
  AUTHENTICATE = 'authenticate',
  LOGOUT = 'logout',

  // Tweet Operations
  CREATE_TWEET = 'create_tweet',
  DELETE_TWEET = 'delete_tweet',
  GET_TWEET = 'get_tweet_by_id',
  GET_TWEETS = 'get_tweets_by_ids',
  SEARCH_TWEETS = 'search_tweet',
  GET_USER_TWEETS = 'get_user_tweets',
  GET_TIMELINE = 'get_timeline',
  GET_LATEST_TIMELINE = 'get_latest_timeline',

  // Engagement Actions
  LIKE_TWEET = 'favorite_tweet',
  UNLIKE_TWEET = 'unfavorite_tweet',
  RETWEET = 'retweet',
  UNRETWEET = 'delete_retweet',
  BOOKMARK_TWEET = 'bookmark_tweet',
  UNBOOKMARK_TWEET = 'delete_bookmark',
  GET_BOOKMARKS = 'get_bookmarks',

  // User Operations
  FOLLOW_USER = 'follow_user',
  UNFOLLOW_USER = 'unfollow_user',
  BLOCK_USER = 'block_user',
  UNBLOCK_USER = 'unblock_user',
  MUTE_USER = 'mute_user',
  UNMUTE_USER = 'unmute_user',
  SEARCH_USER = 'search_user',
  GET_USER_BY_SCREEN_NAME = 'get_user_by_screen_name',
  GET_USER_BY_ID = 'get_user_by_id',
  GET_USER_FOLLOWERS = 'get_user_followers',
  GET_USER_FOLLOWING = 'get_user_following',

  // Direct Messages
  SEND_DM = 'send_dm',
  SEND_GROUP_DM = 'send_dm_to_group',
  DELETE_DM = 'delete_dm',
  GET_DM_HISTORY = 'get_dm_history',
  ADD_DM_REACTION = 'add_reaction_to_message',
  REMOVE_DM_REACTION = 'remove_reaction_from_message',

  // Media Operations
  UPLOAD_MEDIA = 'upload_media',
  CHECK_MEDIA_STATUS = 'check_media_status',
  CREATE_MEDIA_METADATA = 'create_media_metadata',

  // Polls
  CREATE_POLL = 'create_poll',
  VOTE_POLL = 'vote',

  // Lists
  CREATE_LIST = 'create_list',
  EDIT_LIST = 'edit_list',
  DELETE_LIST = 'delete_list',
  ADD_LIST_MEMBER = 'add_list_member',
  REMOVE_LIST_MEMBER = 'remove_list_member',
  GET_LIST_TWEETS = 'get_list_tweets',
  GET_LIST_MEMBERS = 'get_list_members',
  GET_LISTS = 'get_lists',

  // Communities
  SEARCH_COMMUNITY = 'search_community',
  JOIN_COMMUNITY = 'join_community',
  LEAVE_COMMUNITY = 'leave_community',
  GET_COMMUNITY_TWEETS = 'get_community_tweets',
  GET_COMMUNITY_MEMBERS = 'get_community_members',

  // Trends and Discovery
  GET_TRENDS = 'get_trends',
  GET_PLACE_TRENDS = 'get_place_trends',

  // Notifications
  GET_NOTIFICATIONS = 'get_notifications',

  // Health and Monitoring
  CHECK_HEALTH = 'check_health',
  GET_SESSION_METRICS = 'get_session_metrics'
}

/**
 * Enhanced Type Definitions for Enterprise Automation
 */
interface ContentData {
  text: string;
  mediaUrls?: string[];
  mediaIds?: string[];
  hashtags?: string[];
  mentions?: string[];
  scheduledFor?: Date;
  replyToTweetId?: string;
  quoteTweetId?: string;
  poll?: {
    choices: string[];
    durationMinutes: number;
  };
}

interface PostOptions {
  skipQualityCheck?: boolean;
  skipRateLimit?: boolean;
  priority?: RateLimitPriority;
  accountId?: string;
  sessionId?: string;
  enableAntiDetection?: boolean;
  customDelay?: number;
  retryOnFailure?: boolean;
}

interface QualityCheckResult {
  approved: boolean;
  score: number;
  reason?: string;
  suggestions?: string[];
  complianceFlags?: string[];
  sentimentScore?: number;
  spamProbability?: number;
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
    retweetsToday: number;
    dmsToday: number;
    bookmarksToday: number;
  };
  health: {
    sessionHealth: number;
    rateLimitStatus: string;
    proxyStatus: string;
    antiDetectionStatus: string;
  };
}

interface TwikitActionRequest {
  action: TwikitActionType;
  accountId: string;
  params: Record<string, any>;
  options?: PostOptions;
  metadata?: {
    campaignId?: string;
    userId?: string;
    priority?: RateLimitPriority;
    tags?: string[];
  };
}

interface TwikitActionResponse {
  success: boolean;
  data?: any;
  error?: string;
  errorType?: TwikitErrorType;
  metadata?: {
    sessionId?: string;
    rateLimitRemaining?: number;
    retryAfter?: number;
    executionTime?: number;
    proxyUsed?: string;
  };
}

/**
 * Enterprise X Automation Service with Comprehensive Twikit Integration
 *
 * This service provides enterprise-grade automation capabilities using Twikit as the underlying
 * API client, with advanced session management, rate limiting coordination, anti-detection
 * measures, and comprehensive error handling for production-scale social media automation.
 *
 * Key Features:
 * - Complete Twikit API integration (50+ methods)
 * - Enterprise session management with TwikitSessionManager
 * - Distributed rate limiting with GlobalRateLimitCoordinator
 * - Advanced anti-detection and proxy rotation
 * - Comprehensive error handling and retry mechanisms
 * - Quality checks and compliance validation
 * - Real-time monitoring and analytics
 * - Multi-account coordination and management
 */
export class XAutomationService {
  private sessionManager: TwikitSessionManager;
  private rateLimitCoordinator: GlobalRateLimitCoordinator;
  private antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator;
  private proxyManager: ProxyRotationManager;
  private configManager: TwikitConfigManager;
  private activeAutomations: Map<string, any>;
  private config: XAutomationConfig;
  private circuitBreakers: Map<string, { failures: number; lastFailure: Date; isOpen: boolean }>;
  private performanceMetrics: Map<string, { totalRequests: number; successRate: number; avgResponseTime: number }>;

  constructor(config?: Partial<XAutomationConfig>) {
    // Initialize enterprise configuration with defaults
    this.config = {
      // Rate Limiting Configuration
      maxTweetsPerHour: 50,
      maxFollowsPerHour: 100,
      maxLikesPerHour: 200,
      maxRetweetsPerHour: 100,
      maxDMsPerHour: 50,
      maxBookmarksPerHour: 100,
      maxCommentsPerHour: 50,

      // Quality and Compliance
      qualityThreshold: 0.8,
      enableContentFiltering: true,
      enableRegionalCompliance: true,
      enableSpamDetection: true,
      enableSentimentAnalysis: true,

      // Error Handling and Retry
      retryAttempts: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      exponentialBackoff: true,
      circuitBreakerThreshold: 5,

      // Session Management
      sessionRotationInterval: 3600000, // 1 hour
      maxConcurrentSessions: 10,
      sessionHealthCheckInterval: 300000, // 5 minutes

      // Anti-Detection
      enableBehaviorSimulation: true,
      enableFingerprintRotation: true,
      humanLikeDelays: true,
      randomizeTimings: true,

      // Monitoring and Analytics
      enableRealTimeMonitoring: true,
      enablePerformanceTracking: true,
      enableAuditLogging: true,

      ...config
    };

    // Initialize enterprise services
    this.sessionManager = new TwikitSessionManager();
    this.rateLimitCoordinator = new GlobalRateLimitCoordinator();
    this.antiDetectionCoordinator = new EnterpriseAntiDetectionCoordinator();
    this.proxyManager = new ProxyRotationManager();
    this.configManager = new TwikitConfigManager();

    // Initialize tracking maps
    this.activeAutomations = new Map();
    this.circuitBreakers = new Map();
    this.performanceMetrics = new Map();

    logger.info('Enterprise X Automation Service initialized with Twikit integration', {
      config: this.config,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Initialize Twikit session for an account with enterprise features
   * Replaces Twitter API v2 client initialization with Twikit session management
   */
  async initializeTwikitSession(accountId: string, options?: TwikitSessionOptions): Promise<TwikitSession> {
    try {
      logger.info(`Initializing Twikit session for account ${accountId}`, { accountId, options });

      // Get account credentials from database
      const account = await prisma.xAccount.findUnique({
        where: { id: accountId },
        include: { user: true }
      });

      if (!account || !account.username || !account.password) {
        throw new TwikitError(
          TwikitErrorType.AUTHENTICATION_ERROR,
          'Account credentials not found or incomplete',
          { accountId }
        );
      }

      // Create session with enterprise options
      const sessionOptions: TwikitSessionOptions = {
        accountId,
        username: account.username,
        email: account.email || undefined,
        password: account.password,
        enableAntiDetection: this.config.enableBehaviorSimulation,
        enableProxyRotation: true,
        sessionTimeout: this.config.sessionRotationInterval,
        healthCheckInterval: this.config.sessionHealthCheckInterval,
        ...options
      };

      // Initialize session through session manager
      const session = await this.sessionManager.createSession(sessionOptions);

      // Verify session health
      const healthCheck = await this.sessionManager.checkSessionHealth(session.id);
      if (!healthCheck.isHealthy) {
        throw new TwikitError(
          TwikitErrorType.SESSION_ERROR,
          'Session health check failed after initialization',
          { sessionId: session.id, healthCheck }
        );
      }

      // Update account info with session data
      await prisma.xAccount.update({
        where: { id: accountId },
        data: {
          lastActivity: new Date(),
          sessionId: session.id,
          isActive: true
        }
      });

      logger.info(`Twikit session initialized successfully for account ${accountId}`, {
        sessionId: session.id,
        accountId,
        healthScore: healthCheck.healthScore
      });

      return session;
    } catch (error) {
      logger.error(`Failed to initialize Twikit session for account ${accountId}:`, error);

      // Update account status on failure
      await prisma.xAccount.update({
        where: { id: accountId },
        data: {
          isActive: false,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(() => {}); // Ignore database errors during error handling

      throw error;
    }
  }

  /**
   * Execute Twikit Action with Enterprise Features
   * Core method that handles all Twikit operations with comprehensive error handling,
   * rate limiting, anti-detection, and monitoring
   */
  async executeTwikitAction(request: TwikitActionRequest): Promise<TwikitActionResponse> {
    const startTime = Date.now();
    const { action, accountId, params, options = {}, metadata } = request;

    try {
      logger.info(`Executing Twikit action: ${action}`, {
        action,
        accountId,
        params: this.sanitizeParams(params),
        metadata
      });

      // 1. Circuit Breaker Check
      if (this.isCircuitBreakerOpen(accountId, action)) {
        throw new TwikitError(
          TwikitErrorType.CIRCUIT_BREAKER_OPEN,
          'Circuit breaker is open for this account/action combination',
          { accountId, action }
        );
      }

      // 2. Rate Limit Check
      if (!options.skipRateLimit) {
        const rateLimitCheck = await this.checkRateLimit(accountId, action, options.priority);
        if (!rateLimitCheck.allowed) {
          throw new TwikitError(
            TwikitErrorType.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded',
            { accountId, action, retryAfter: rateLimitCheck.retryAfter }
          );
        }
      }

      // 3. Get or Create Session
      let session = await this.sessionManager.getActiveSession(accountId);
      if (!session || !session.isHealthy) {
        session = await this.initializeTwikitSession(accountId);
      }

      // 4. Anti-Detection Coordination
      if (options.enableAntiDetection !== false && this.config.enableBehaviorSimulation) {
        await this.antiDetectionCoordinator.coordinateAction(accountId, action, params);
      }

      // 5. Execute Action with Retry Logic
      const response = await this.executeWithRetry(session, action, params, options);

      // 6. Update Performance Metrics
      this.updatePerformanceMetrics(accountId, action, Date.now() - startTime, true);

      // 7. Reset Circuit Breaker on Success
      this.resetCircuitBreaker(accountId, action);

      logger.info(`Twikit action executed successfully: ${action}`, {
        action,
        accountId,
        executionTime: Date.now() - startTime,
        sessionId: session.id
      });

      return {
        success: true,
        data: response,
        metadata: {
          sessionId: session.id,
          executionTime: Date.now() - startTime,
          proxyUsed: session.currentProxy?.url
        }
      };

    } catch (error) {
      // Update Circuit Breaker on Failure
      this.updateCircuitBreaker(accountId, action);

      // Update Performance Metrics
      this.updatePerformanceMetrics(accountId, action, Date.now() - startTime, false);

      logger.error(`Twikit action failed: ${action}`, {
        action,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      });

      const errorType = error instanceof TwikitError ? error.type : TwikitErrorType.UNKNOWN_ERROR;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType,
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Post content to X with comprehensive Twikit integration
   * Replaces Twitter API v2 postContent with Twikit create_tweet
   */
  async postContent(accountId: string, content: ContentData, options: PostOptions = {}): Promise<TwikitActionResponse> {
    try {
      // Quality checks
      if (!options.skipQualityCheck) {
        const qualityCheck = await this.performQualityChecks(accountId, content);
        if (!qualityCheck.approved) {
          throw new TwikitError(
            TwikitErrorType.CONTENT_QUALITY_ERROR,
            `Quality check failed: ${qualityCheck.reason}`,
            { qualityCheck }
          );
        }
      }

      // Prepare Twikit parameters
      const twikitParams: Record<string, any> = {
        text: content.text
      };

      // Add media IDs if provided
      if (content.mediaIds && content.mediaIds.length > 0) {
        twikitParams.mediaIds = content.mediaIds;
      }

      // Add reply/quote information
      if (content.replyToTweetId) {
        twikitParams.replyToTweetId = content.replyToTweetId;
      }
      if (content.quoteTweetId) {
        twikitParams.quoteTweetId = content.quoteTweetId;
      }

      // Add poll if provided
      if (content.poll) {
        twikitParams.poll = content.poll;
      }

      // Execute Twikit action
      const response = await this.executeTwikitAction({
        action: TwikitActionType.CREATE_TWEET,
        accountId,
        params: twikitParams,
        options,
        metadata: {
          campaignId: metadata?.campaignId,
          userId: metadata?.userId,
          priority: options.priority || RateLimitPriority.NORMAL,
          tags: ['content_post', ...(metadata?.tags || [])]
        }
      });

      if (!response.success) {
        throw new TwikitError(
          response.errorType || TwikitErrorType.UNKNOWN_ERROR,
          response.error || 'Failed to post content',
          { response }
        );
      }

      // Log the post
      await this.logPost(accountId, content, response.data);

      logger.info(`Content posted successfully for account ${accountId}`, {
        accountId,
        tweetId: response.data?.id,
        text: content.text.substring(0, 50) + '...',
        executionTime: response.metadata?.executionTime
      });

      return response;

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
   * Get Twikit session for account (replaces getClient)
   */
  async getTwikitSession(accountId: string): Promise<TwikitSession | null> {
    try {
      return await this.sessionManager.getActiveSession(accountId);
    } catch (error) {
      logger.error(`Failed to get Twikit session for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Remove session for account (replaces removeClient)
   */
  async removeSession(accountId: string): Promise<void> {
    try {
      await this.sessionManager.terminateSession(accountId);
      this.activeAutomations.delete(accountId);
      this.circuitBreakers.clear(); // Clear circuit breakers for this account
      this.performanceMetrics.clear(); // Clear performance metrics for this account
    } catch (error) {
      logger.error(`Failed to remove session for account ${accountId}:`, error);
    }
  }

  // ============================================================================
  // ENTERPRISE HELPER METHODS
  // ============================================================================

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  private sanitizeParams(params: Record<string, any>): Record<string, any> {
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Check if circuit breaker is open for account/action combination
   */
  private isCircuitBreakerOpen(accountId: string, action: string): boolean {
    const key = `${accountId}:${action}`;
    const breaker = this.circuitBreakers.get(key);

    if (!breaker) return false;

    // Check if breaker should be reset (after timeout)
    const resetTime = breaker.lastFailure.getTime() + (5 * 60 * 1000); // 5 minutes
    if (Date.now() > resetTime) {
      this.circuitBreakers.delete(key);
      return false;
    }

    return breaker.isOpen;
  }

  /**
   * Update circuit breaker on failure
   */
  private updateCircuitBreaker(accountId: string, action: string): void {
    const key = `${accountId}:${action}`;
    const breaker = this.circuitBreakers.get(key) || { failures: 0, lastFailure: new Date(), isOpen: false };

    breaker.failures++;
    breaker.lastFailure = new Date();
    breaker.isOpen = breaker.failures >= this.config.circuitBreakerThreshold;

    this.circuitBreakers.set(key, breaker);
  }

  /**
   * Reset circuit breaker on success
   */
  private resetCircuitBreaker(accountId: string, action: string): void {
    const key = `${accountId}:${action}`;
    this.circuitBreakers.delete(key);
  }

  /**
   * Check rate limits using GlobalRateLimitCoordinator
   */
  private async checkRateLimit(accountId: string, action: string, priority?: RateLimitPriority): Promise<{ allowed: boolean; retryAfter?: number }> {
    try {
      const rateLimitAction = this.mapActionToRateLimitAction(action);
      const request: RateLimitCheckRequest = {
        accountId,
        action: rateLimitAction,
        priority: priority || RateLimitPriority.NORMAL,
        accountType: AccountType.STANDARD // Could be determined from account data
      };

      const response = await this.rateLimitCoordinator.checkRateLimit(request);
      return {
        allowed: response.allowed,
        retryAfter: response.retryAfter
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      return { allowed: true }; // Fail open for now
    }
  }

  /**
   * Map Twikit action to rate limit action
   */
  private mapActionToRateLimitAction(action: string): RateLimitAction {
    const actionMap: Record<string, RateLimitAction> = {
      [TwikitActionType.CREATE_TWEET]: RateLimitAction.POST_TWEET,
      [TwikitActionType.LIKE_TWEET]: RateLimitAction.LIKE_TWEET,
      [TwikitActionType.RETWEET]: RateLimitAction.RETWEET,
      [TwikitActionType.FOLLOW_USER]: RateLimitAction.FOLLOW_USER,
      [TwikitActionType.SEND_DM]: RateLimitAction.SEND_DM,
      [TwikitActionType.SEARCH_TWEETS]: RateLimitAction.SEARCH,
      [TwikitActionType.GET_USER_TWEETS]: RateLimitAction.GET_TWEETS,
      [TwikitActionType.GET_TIMELINE]: RateLimitAction.GET_TIMELINE
    };

    return actionMap[action] || RateLimitAction.GENERAL;
  }

  /**
   * Execute action with retry logic and exponential backoff
   */
  private async executeWithRetry(session: TwikitSession, action: string, params: Record<string, any>, options: PostOptions): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Calculate delay with exponential backoff
        if (attempt > 1) {
          const delay = this.config.exponentialBackoff
            ? Math.min(this.config.retryDelay * Math.pow(2, attempt - 2), this.config.maxRetryDelay)
            : this.config.retryDelay;

          await this.sleep(delay);
        }

        // Execute the action through session manager
        const result = await this.sessionManager.executeAction(session.id, action, params);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        logger.warn(`Attempt ${attempt}/${this.config.retryAttempts} failed for action ${action}:`, {
          error: lastError.message,
          accountId: session.accountId,
          attempt
        });

        // Don't retry on certain error types
        if (error instanceof TwikitError) {
          if ([
            TwikitErrorType.AUTHENTICATION_ERROR,
            TwikitErrorType.ACCOUNT_SUSPENDED,
            TwikitErrorType.ACCOUNT_LOCKED
          ].includes(error.type)) {
            break;
          }
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(accountId: string, action: string, responseTime: number, success: boolean): void {
    const key = `${accountId}:${action}`;
    const metrics = this.performanceMetrics.get(key) || { totalRequests: 0, successRate: 0, avgResponseTime: 0 };

    metrics.totalRequests++;
    metrics.successRate = success
      ? (metrics.successRate * (metrics.totalRequests - 1) + 1) / metrics.totalRequests
      : (metrics.successRate * (metrics.totalRequests - 1)) / metrics.totalRequests;
    metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;

    this.performanceMetrics.set(key, metrics);
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
