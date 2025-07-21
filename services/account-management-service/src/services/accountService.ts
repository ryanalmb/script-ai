/**
 * Enterprise Account Management Service - Core Account Service
 * Comprehensive X/Twitter account management with OAuth, health monitoring, and enterprise features
 */

import { PrismaClient } from '@prisma/client';
import { TwitterApi } from 'twitter-api-v2';
import OAuth from 'oauth';
import { config, accountConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { eventService } from './eventService';
import { databaseService } from './database';
import {
  XAccount,
  XAccountStatus,
  XAccountStatusEnum,
  ConnectAccountRequest,
  UpdateAccountRequest,
  AccountSettings,
  AccountHealth,
  OAuthSession,
  OAuthCallbackRequest,
  TwitterUserProfile,
  AccountEventType
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

class AccountService {
  private get prisma(): PrismaClient {
    return databaseService.getClient();
  }

  private oauth: OAuth.OAuth;
  private oauthSessions: Map<string, OAuthSession> = new Map();

  constructor() {
    // Initialize OAuth client for Twitter
    this.oauth = new OAuth.OAuth(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      config.twitter.consumerKey,
      config.twitter.consumerSecret,
      '1.0A',
      config.twitter.callbackUrl,
      'HMAC-SHA1'
    );

    // Setup periodic cleanup of expired OAuth sessions
    setInterval(() => {
      this.cleanupExpiredOAuthSessions();
    }, 60000); // Every minute

    log.info('Account service initialized', {
      operation: 'account_service_init',
      metadata: {
        maxAccountsPerUser: accountConfig.maxAccountsPerUser,
        healthCheckInterval: accountConfig.healthCheckInterval,
        oauthSessionTimeout: accountConfig.oauthSessionTimeout
      }
    });
  }

  /**
   * Initiate OAuth flow for connecting a Twitter account
   */
  async initiateOAuth(
    userId: string,
    correlationId?: string | undefined
  ): Promise<{ authUrl: string; sessionId: string }> {
    const timer = createTimer('oauth_initiate');

    try {
      log.oauth('Initiating OAuth flow', {
        correlationId: correlationId || undefined,
        userId,
        oauthStep: 'initiate',
        provider: 'twitter'
      });

      // Check if user has reached account limit
      const existingAccounts = await this.prisma.xAccount.count({
        where: { userId, status: { not: XAccountStatusEnum.DISCONNECTED } }
      });

      if (existingAccounts >= accountConfig.maxAccountsPerUser) {
        throw new Error(`User has reached maximum account limit of ${accountConfig.maxAccountsPerUser}`);
      }

      // Get request token from Twitter
      const { requestToken, requestTokenSecret } = await this.getRequestToken();

      // Create OAuth session
      const sessionId = uuidv4();
      const session: OAuthSession = {
        sessionId,
        userId,
        requestToken,
        requestTokenSecret,
        callbackUrl: config.twitter.callbackUrl,
        expiresAt: new Date(Date.now() + accountConfig.oauthSessionTimeout),
        createdAt: new Date()
      };

      this.oauthSessions.set(sessionId, session);

      // Generate authorization URL
      const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${requestToken}`;

      const duration = timer.end();

      // Publish OAuth initiated event
      await eventService.publishAccountEvent(
        AccountEventType.OAUTH_INITIATED,
        userId,
        'pending',
        { sessionId, authUrl },
        correlationId
      );

      log.oauth('OAuth flow initiated successfully', {
        correlationId: correlationId || undefined,
        userId,
        oauthStep: 'initiated',
        provider: 'twitter',
        duration,
        metadata: { sessionId }
      });

      return { authUrl, sessionId };

    } catch (error) {
      timer.end();
      log.error('Failed to initiate OAuth flow', {
        operation: 'oauth_initiate',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Complete OAuth flow and connect account
   */
  async completeOAuth(
    callbackData: OAuthCallbackRequest,
    correlationId?: string | undefined
  ): Promise<XAccount> {
    const timer = createTimer('oauth_complete');

    try {
      const { oauthToken, oauthVerifier, sessionId } = callbackData;

      log.oauth('Completing OAuth flow', {
        correlationId: correlationId || undefined,
        oauthStep: 'complete',
        provider: 'twitter',
        metadata: { sessionId, oauthToken }
      });

      // Get OAuth session
      const session = this.oauthSessions.get(sessionId);
      if (!session) {
        throw new Error('Invalid or expired OAuth session');
      }

      if (session.expiresAt < new Date()) {
        this.oauthSessions.delete(sessionId);
        throw new Error('OAuth session has expired');
      }

      if (session.requestToken !== oauthToken) {
        throw new Error('OAuth token mismatch');
      }

      // Get access token from Twitter
      const { accessToken, accessTokenSecret } = await this.getAccessToken(
        session.requestToken,
        session.requestTokenSecret,
        oauthVerifier
      );

      // Get user profile from Twitter
      const userProfile = await this.getTwitterUserProfile(accessToken, accessTokenSecret);

      // Create account connection request
      const connectRequest: ConnectAccountRequest = {
        userId: session.userId,
        oauthToken: accessToken,
        oauthTokenSecret: accessTokenSecret,
        screenName: userProfile.screenName,
        displayName: userProfile.name,
        profileImageUrl: userProfile.profileImageUrl
      };

      // Connect the account
      const account = await this.connectAccount(connectRequest, correlationId);

      // Clean up OAuth session
      this.oauthSessions.delete(sessionId);

      const duration = timer.end();

      // Publish OAuth completed event
      await eventService.publishAccountEvent(
        AccountEventType.OAUTH_COMPLETED,
        session.userId,
        account.id,
        { 
          screenName: userProfile.screenName,
          displayName: userProfile.name,
          followersCount: userProfile.followersCount
        },
        correlationId
      );

      log.oauth('OAuth flow completed successfully', {
        correlationId: correlationId || undefined,
        userId: session.userId,
        accountId: account.id,
        oauthStep: 'completed',
        provider: 'twitter',
        duration,
        metadata: { screenName: userProfile.screenName }
      });

      return account;

    } catch (error) {
      timer.end();
      log.error('Failed to complete OAuth flow', {
        operation: 'oauth_complete',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { sessionId: callbackData.sessionId }
      });

      // Publish OAuth failed event
      if (callbackData.sessionId) {
        const session = this.oauthSessions.get(callbackData.sessionId);
        if (session) {
          await eventService.publishAccountEvent(
            AccountEventType.OAUTH_FAILED,
            session.userId,
            'failed',
            { error: (error as Error).message },
            correlationId
          );
        }
      }

      throw error;
    }
  }

  /**
   * Connect a Twitter account
   */
  async connectAccount(
    request: ConnectAccountRequest,
    correlationId?: string | undefined
  ): Promise<XAccount> {
    const timer = createTimer('account_connect');

    try {
      const { userId, oauthToken, oauthTokenSecret, screenName, displayName, profileImageUrl } = request;

      log.account('Connecting Twitter account', '', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'account_connect',
        metadata: { screenName, displayName }
      });

      // Check if account is already connected
      const existingAccount = await this.prisma.xAccount.findFirst({
        where: { 
          screenName,
          status: { not: XAccountStatusEnum.DISCONNECTED }
        }
      });

      if (existingAccount) {
        throw new Error(`Account @${screenName} is already connected`);
      }

      // Create default account settings
      const defaultSettings: AccountSettings = {
        autoPost: false,
        autoLike: false,
        autoRetweet: false,
        autoFollow: false,
        maxPostsPerDay: 10,
        maxLikesPerDay: 50,
        maxRetweetsPerDay: 20,
        maxFollowsPerDay: 10,
        workingHours: {
          start: '09:00',
          end: '17:00',
          timezone: 'UTC'
        },
        contentFilters: [],
        blacklistedKeywords: [],
        whitelistedDomains: []
      };

      // Create account record
      const account = await this.prisma.xAccount.create({
        data: {
          id: uuidv4(),
          userId,
          screenName,
          displayName: displayName || null,
          profileImageUrl: profileImageUrl || null,
          oauthToken,
          oauthTokenSecret,
          status: XAccountStatusEnum.ACTIVE,
          settings: JSON.stringify(defaultSettings),
          isActive: true,
          lastHealthCheck: new Date(),
          rateLimitResetAt: new Date(),
          apiCallsToday: 0,
          errorsToday: 0
        }
      });

      const duration = timer.end();

      // Publish account connected event
      await eventService.publishAccountEvent(
        AccountEventType.ACCOUNT_CONNECTED,
        userId,
        account.id,
        {
          screenName,
          displayName,
          profileImageUrl,
          settings: defaultSettings
        },
        correlationId
      );

      log.audit('Twitter account connected successfully', {
        correlationId: correlationId || undefined,
        userId,
        accountId: account.id,
        action: 'account_connect',
        resource: 'xaccount',
        duration,
        metadata: { screenName, displayName }
      });

      return account;

    } catch (error) {
      timer.end();
      log.error('Failed to connect Twitter account', {
        operation: 'account_connect',
        correlationId: correlationId || undefined,
        userId: request.userId,
        error: error as Error,
        metadata: { screenName: request.screenName }
      });
      throw error;
    }
  }

  /**
   * Disconnect a Twitter account
   */
  async disconnectAccount(
    accountId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<void> {
    const timer = createTimer('account_disconnect');

    try {
      log.account('Disconnecting Twitter account', accountId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'account_disconnect'
      });

      // Get account
      const account = await this.prisma.xAccount.findFirst({
        where: { id: accountId, userId }
      });

      if (!account) {
        throw new Error('Account not found or access denied');
      }

      // Update account status
      await this.prisma.xAccount.update({
        where: { id: accountId },
        data: {
          status: XAccountStatusEnum.DISCONNECTED,
          isActive: false,
          disconnectedAt: new Date()
        }
      });

      const duration = timer.end();

      // Publish account disconnected event
      await eventService.publishAccountEvent(
        AccountEventType.ACCOUNT_DISCONNECTED,
        userId,
        accountId,
        { screenName: account.screenName },
        correlationId
      );

      log.audit('Twitter account disconnected successfully', {
        correlationId: correlationId || undefined,
        userId,
        accountId,
        action: 'account_disconnect',
        resource: 'xaccount',
        duration,
        metadata: { screenName: account.screenName }
      });

    } catch (error) {
      timer.end();
      log.error('Failed to disconnect Twitter account', {
        operation: 'account_disconnect',
        correlationId: correlationId || undefined,
        userId,
        accountId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Update account settings
   */
  async updateAccount(
    accountId: string,
    userId: string,
    updates: UpdateAccountRequest,
    correlationId?: string | undefined
  ): Promise<XAccount> {
    const timer = createTimer('account_update');

    try {
      log.account('Updating Twitter account', accountId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'account_update',
        metadata: { updates }
      });

      // Get existing account
      const existingAccount = await this.prisma.xAccount.findFirst({
        where: { id: accountId, userId }
      });

      if (!existingAccount) {
        throw new Error('Account not found or access denied');
      }

      // Prepare update data
      const updateData: any = {};
      
      if (updates.displayName !== undefined) {
        updateData.displayName = updates.displayName;
      }
      
      if (updates.profileImageUrl !== undefined) {
        updateData.profileImageUrl = updates.profileImageUrl;
      }
      
      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive;
      }
      
      if (updates.settings !== undefined) {
        updateData.settings = JSON.stringify(updates.settings);
      }

      // Update account
      const updatedAccount = await this.prisma.xAccount.update({
        where: { id: accountId },
        data: updateData
      });

      const duration = timer.end();

      // Publish account updated event
      await eventService.publishAccountEvent(
        AccountEventType.ACCOUNT_UPDATED,
        userId,
        accountId,
        { updates },
        correlationId
      );

      log.audit('Twitter account updated successfully', {
        correlationId: correlationId || undefined,
        userId,
        accountId,
        action: 'account_update',
        resource: 'xaccount',
        duration,
        metadata: { updates }
      });

      return updatedAccount;

    } catch (error) {
      timer.end();
      log.error('Failed to update Twitter account', {
        operation: 'account_update',
        correlationId: correlationId || undefined,
        userId,
        accountId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get user's accounts
   */
  async getUserAccounts(
    userId: string,
    correlationId?: string | undefined
  ): Promise<XAccount[]> {
    const timer = createTimer('get_user_accounts');

    try {
      log.debug('Getting user accounts', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'get_user_accounts'
      });

      const accounts = await this.prisma.xAccount.findMany({
        where: {
          userId,
          status: { not: XAccountStatusEnum.DISCONNECTED }
        },
        orderBy: { createdAt: 'desc' }
      });

      timer.end();

      return accounts;

    } catch (error) {
      timer.end();
      log.error('Failed to get user accounts', {
        operation: 'get_user_accounts',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get account by ID
   */
  async getAccount(
    accountId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<XAccount | null> {
    const timer = createTimer('get_account');

    try {
      log.debug('Getting account', {
        correlationId: correlationId || undefined,
        userId,
        accountId,
        operation: 'get_account'
      });

      const account = await this.prisma.xAccount.findFirst({
        where: { id: accountId, userId }
      });

      timer.end();

      return account;

    } catch (error) {
      timer.end();
      log.error('Failed to get account', {
        operation: 'get_account',
        correlationId: correlationId || undefined,
        userId,
        accountId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Check account health
   */
  async checkAccountHealth(
    accountId: string,
    correlationId?: string | undefined
  ): Promise<AccountHealth> {
    const timer = createTimer('account_health_check');

    try {
      log.debug('Checking account health', {
        correlationId: correlationId || undefined,
        accountId,
        operation: 'account_health_check'
      });

      // Get account
      const account = await this.prisma.xAccount.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      // Create Twitter API client
      const twitterClient = new TwitterApi({
        appKey: config.twitter.consumerKey,
        appSecret: config.twitter.consumerSecret,
        accessToken: account.oauthToken,
        accessSecret: account.oauthTokenSecret
      });

      // Check rate limit status
      const rateLimitStatus = await this.checkRateLimit(twitterClient);

      // Calculate suspension risk based on various factors
      const suspensionRisk = this.calculateSuspensionRisk(account, rateLimitStatus);

      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(account);

      // Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(accountId);

      const health: AccountHealth = {
        accountId,
        status: account.status as XAccountStatus,
        lastActiveAt: account.lastActiveAt || new Date(),
        rateLimitStatus,
        apiErrors: account.errorsToday || 0,
        suspensionRisk,
        complianceScore,
        performanceMetrics
      };

      // Update last health check
      await this.prisma.xAccount.update({
        where: { id: accountId },
        data: { lastHealthCheck: new Date() }
      });

      const duration = timer.end();

      // Publish health check event
      await eventService.publishAccountEvent(
        AccountEventType.ACCOUNT_HEALTH_CHECK,
        account.userId,
        accountId,
        { health },
        correlationId
      );

      log.account('Account health check completed', accountId, {
        correlationId: correlationId || undefined,
        operation: 'account_health_check',
        duration,
        metadata: {
          status: health.status,
          suspensionRisk: health.suspensionRisk,
          complianceScore: health.complianceScore
        }
      });

      return health;

    } catch (error) {
      timer.end();
      log.error('Failed to check account health', {
        operation: 'account_health_check',
        correlationId: correlationId || undefined,
        accountId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get request token from Twitter OAuth
   */
  private async getRequestToken(): Promise<{ requestToken: string; requestTokenSecret: string }> {
    return new Promise((resolve, reject) => {
      this.oauth.getOAuthRequestToken((error, oauthToken, oauthTokenSecret) => {
        if (error) {
          reject(new Error(`Failed to get request token: ${(error as any).message || 'Unknown error'}`));
        } else {
          resolve({
            requestToken: oauthToken || '',
            requestTokenSecret: oauthTokenSecret || ''
          });
        }
      });
    });
  }

  /**
   * Get access token from Twitter OAuth
   */
  private async getAccessToken(
    requestToken: string,
    requestTokenSecret: string,
    verifier: string
  ): Promise<{ accessToken: string; accessTokenSecret: string }> {
    return new Promise((resolve, reject) => {
      this.oauth.getOAuthAccessToken(
        requestToken,
        requestTokenSecret,
        verifier,
        (error, oauthAccessToken, oauthAccessTokenSecret) => {
          if (error) {
            reject(new Error(`Failed to get access token: ${(error as any).message || 'Unknown error'}`));
          } else {
            resolve({
              accessToken: oauthAccessToken || '',
              accessTokenSecret: oauthAccessTokenSecret || ''
            });
          }
        }
      );
    });
  }

  /**
   * Get Twitter user profile
   */
  private async getTwitterUserProfile(
    accessToken: string,
    accessTokenSecret: string
  ): Promise<TwitterUserProfile> {
    try {
      const twitterClient = new TwitterApi({
        appKey: config.twitter.consumerKey,
        appSecret: config.twitter.consumerSecret,
        accessToken,
        accessSecret: accessTokenSecret
      });

      const user = await twitterClient.v1.verifyCredentials();

      return {
        id: user.id_str,
        screenName: user.screen_name,
        name: user.name,
        description: user.description || '',
        profileImageUrl: user.profile_image_url_https,
        followersCount: user.followers_count,
        followingCount: user.friends_count,
        statusesCount: user.statuses_count,
        verified: user.verified,
        protected: user.protected,
        createdAt: new Date(user.created_at)
      };
    } catch (error) {
      log.error('Failed to get Twitter user profile', {
        operation: 'get_twitter_profile',
        error: error as Error
      });
      throw new Error('Failed to retrieve Twitter user profile');
    }
  }

  /**
   * Check rate limit status
   */
  private async checkRateLimit(_twitterClient: TwitterApi): Promise<{
    remaining: number;
    resetAt: Date;
    limit: number;
  }> {
    try {
      // For now, return mock data since Twitter API v2 rate limiting is different
      // In a real implementation, you would check the actual rate limits
      return {
        remaining: 100,
        resetAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        limit: 300
      };
    } catch (error) {
      log.warn('Failed to check rate limit status', {
        operation: 'check_rate_limit',
        error: error as Error
      });

      return {
        remaining: 0,
        resetAt: new Date(),
        limit: 0
      };
    }
  }

  /**
   * Calculate suspension risk
   */
  private calculateSuspensionRisk(
    account: XAccount,
    rateLimitStatus: { remaining: number; resetAt: Date; limit: number }
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Factor in API errors
    if (account.errorsToday && account.errorsToday > 10) riskScore += 2;
    else if (account.errorsToday && account.errorsToday > 5) riskScore += 1;

    // Factor in rate limit usage
    const rateLimitUsage = 1 - (rateLimitStatus.remaining / rateLimitStatus.limit);
    if (rateLimitUsage > 0.9) riskScore += 2;
    else if (rateLimitUsage > 0.7) riskScore += 1;

    // Factor in account age and activity
    const accountAge = Date.now() - (account.createdAt?.getTime() || 0);
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) riskScore += 1;

    if (riskScore >= 4) return 'critical';
    if (riskScore >= 3) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(account: XAccount): number {
    let score = 100;

    // Deduct points for errors
    if (account.errorsToday) {
      score -= Math.min(account.errorsToday * 2, 20);
    }

    // Deduct points for high API usage
    if (account.apiCallsToday && account.apiCallsToday > 1000) {
      score -= 10;
    }

    // Add points for account age
    const accountAge = Date.now() - (account.createdAt?.getTime() || 0);
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 90) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(_accountId: string): Promise<{
    postsToday: number;
    likesToday: number;
    retweetsToday: number;
    followsToday: number;
    engagementRate: number;
  }> {
    // This would typically query analytics data
    // For now, return mock data
    return {
      postsToday: 0,
      likesToday: 0,
      retweetsToday: 0,
      followsToday: 0,
      engagementRate: 0
    };
  }

  /**
   * Clean up expired OAuth sessions
   */
  private cleanupExpiredOAuthSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.oauthSessions.entries()) {
      if (session.expiresAt < now) {
        this.oauthSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.debug('Cleaned up expired OAuth sessions', {
        operation: 'oauth_cleanup',
        metadata: { cleanedCount, remainingCount: this.oauthSessions.size }
      });
    }
  }
}

// Create and export singleton instance
export const accountService = new AccountService();

// Export the class for testing
export { AccountService };
