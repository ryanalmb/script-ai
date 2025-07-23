import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { EnterpriseAntiDetectionCoordinator } from './antiDetection/antiDetectionCoordinator';
import { TwikitSessionManager, TwikitSession, TwikitSessionOptions } from './twikitSessionManager';
import { ProxyRotationManager, ActionRiskLevel, ProxySelectionCriteria, ProxyEndpoint } from './proxyRotationManager';
import { TwikitConfigManager } from '../config/twikit';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';

export interface XAccountCredentials {
  username: string;
  email: string;
  password: string;
  cookiesFile?: string;
}

export interface XTweetData {
  text: string;
  mediaIds?: string[];
  replyToTweetId?: string;
  quoteTweetId?: string;
}

export interface XUserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  verified: boolean;
  protected: boolean;
  profileImageUrl: string;
}

export interface XTweet {
  id: string;
  text: string;
  authorId: string;
  createdAt: Date;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
  };
}

export interface XSearchResult {
  tweets: XTweet[];
  nextToken?: string;
}

/**
 * Enterprise Real X/Twitter API Client using Twikit with advanced session management,
 * proxy rotation, and anti-detection measures
 */
export class RealXApiClient {
  private pythonScriptPath: string;
  private cookiesDir: string;
  private accountId: string;
  private credentials: XAccountCredentials;
  private isAuthenticated: boolean = false;
  private antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator | null = null;

  // Enterprise Twikit Infrastructure
  private sessionManager: TwikitSessionManager;
  private proxyManager: ProxyRotationManager;
  private configManager: TwikitConfigManager;
  private currentSession: TwikitSession | null = null;
  private currentProxy: ProxyEndpoint | null = null;
  private connectionPool: Map<string, any> = new Map();
  private sessionMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastActivity: Date | null;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastActivity: null
  };

  constructor(accountId: string, credentials: XAccountCredentials, antiDetectionCoordinator?: EnterpriseAntiDetectionCoordinator) {
    this.accountId = accountId;
    this.credentials = credentials;
    this.antiDetectionCoordinator = antiDetectionCoordinator || null;
    this.pythonScriptPath = path.join(__dirname, '../../scripts/x_client.py');
    this.cookiesDir = path.join(__dirname, '../../data/cookies');

    // Initialize enterprise Twikit infrastructure
    this.configManager = TwikitConfigManager.getInstance();
    this.sessionManager = new TwikitSessionManager();
    this.proxyManager = new ProxyRotationManager(this.configManager);

    // Ensure cookies directory exists
    this.ensureCookiesDir();

    logger.info(`Initialized RealXApiClient with enterprise Twikit infrastructure for account: ${accountId}`);
  }

  private async ensureCookiesDir(): Promise<void> {
    try {
      if (!existsSync(this.cookiesDir)) {
        await mkdir(this.cookiesDir, { recursive: true });
      }
    } catch (error) {
      logger.error('Failed to create cookies directory:', error);
    }
  }

  /**
   * Initialize or reuse Twikit session with enterprise session management
   */
  private async ensureSession(): Promise<TwikitSession> {
    if (this.currentSession && this.currentSession.isActive) {
      logger.debug(`Reusing existing session for account ${this.accountId}`);
      return this.currentSession;
    }

    try {
      // Check if session already exists in session manager
      const existingSession = this.sessionManager.getSession(this.accountId);
      if (existingSession && existingSession.isActive) {
        this.currentSession = existingSession;
        logger.info(`Reused existing Twikit session for account ${this.accountId}`);
        return existingSession;
      }

      // Create new session with enterprise configuration
      const sessionOptions: TwikitSessionOptions = {
        accountId: this.accountId,
        credentials: this.credentials,
        cookiesFile: path.join(this.cookiesDir, `${this.accountId}_cookies.json`),
        enableHealthMonitoring: true,
        enableAntiDetection: true,
        enableSessionPersistence: this.configManager.config.session.enablePersistence,
        maxRetries: this.configManager.config.retry.maxRetries
      };

      this.currentSession = await this.sessionManager.createSession(sessionOptions);
      logger.info(`Created new Twikit session for account ${this.accountId}: ${this.currentSession.sessionId}`);

      return this.currentSession;
    } catch (error) {
      logger.error(`Failed to ensure session for account ${this.accountId}:`, error);
      throw new TwikitError(
        TwikitErrorType.SESSION_CREATION_FAILED,
        `Failed to create session for account ${this.accountId}`,
        { accountId: this.accountId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get optimal proxy for action with risk-based selection
   */
  private async getOptimalProxy(actionType: string, riskLevel: ActionRiskLevel): Promise<ProxyEndpoint | null> {
    try {
      const criteria: ProxySelectionCriteria = {
        actionType,
        riskLevel,
        accountId: this.accountId,
        minHealthScore: 0.7,
        maxResponseTime: 5000
      };

      const proxy = await this.proxyManager.getOptimalProxy(criteria);

      if (proxy) {
        this.currentProxy = proxy;
        logger.debug(`Selected ${proxy.type} proxy for ${actionType} action: ${proxy.id}`);
      } else {
        logger.warn(`No suitable proxy found for ${actionType} action with risk level ${riskLevel}`);
      }

      return proxy;
    } catch (error) {
      logger.error(`Failed to get optimal proxy for ${actionType}:`, error);
      return null;
    }
  }

  /**
   * Execute action with enterprise session management, proxy rotation, and anti-detection
   */
  private async executeWithEnterpriseInfrastructure(action: string, params: any = {}, riskLevel: ActionRiskLevel = ActionRiskLevel.MEDIUM): Promise<any> {
    const startTime = Date.now();
    this.sessionMetrics.totalRequests++;

    try {
      // Ensure we have an active session
      const session = await this.ensureSession();

      // Get optimal proxy for this action
      const proxy = await this.getOptimalProxy(action, riskLevel);

      // Process through anti-detection coordinator if available
      if (this.antiDetectionCoordinator) {
        const antiDetectionResult = await this.antiDetectionCoordinator.processActionWithAntiDetection(
          this.accountId,
          action,
          params,
          {
            riskLevel: riskLevel === ActionRiskLevel.HIGH ? 'high' :
                      riskLevel === ActionRiskLevel.MEDIUM ? 'medium' : 'low',
            retryOnFailure: true
          }
        );

        if (!antiDetectionResult.success) {
          logger.warn(`Anti-detection coordinator blocked action ${action} for account ${this.accountId}`);
          this.sessionMetrics.failedRequests++;
          return {
            success: false,
            error: 'Action blocked by anti-detection system',
            recommendations: antiDetectionResult.recommendations
          };
        }
      }

      // Execute with enterprise infrastructure
      const scriptParams = {
        ...params,
        accountId: this.accountId,
        credentials: this.credentials,
        cookiesFile: session.options.cookiesFile || path.join(this.cookiesDir, `${this.accountId}_cookies.json`),
        sessionId: session.sessionId,
        proxy: proxy ? {
          url: proxy.url,
          type: proxy.type,
          username: proxy.username,
          password: proxy.password
        } : null,
        antiDetectionContext: {
          sessionId: session.sessionId,
          fingerprint: session.fingerprint,
          behaviorProfile: this.configManager.config.antiDetection.behaviorProfile
        }
      };

      const result = await this.executeEnhancedPythonScript(action, scriptParams);

      // Update metrics and proxy performance
      const responseTime = Date.now() - startTime;
      this.sessionMetrics.averageResponseTime =
        (this.sessionMetrics.averageResponseTime * (this.sessionMetrics.totalRequests - 1) + responseTime) /
        this.sessionMetrics.totalRequests;
      this.sessionMetrics.lastActivity = new Date();

      if (result.success) {
        this.sessionMetrics.successfulRequests++;

        // Update proxy metrics on success
        if (proxy) {
          await this.proxyManager.updateProxyMetrics(proxy.id, true, responseTime);
        }

        // Update session metrics
        session.metrics.totalRequests++;
        session.metrics.successfulRequests++;
        session.metrics.lastActivity = new Date();

      } else {
        this.sessionMetrics.failedRequests++;

        // Update proxy metrics on failure
        if (proxy) {
          await this.proxyManager.updateProxyMetrics(proxy.id, false, responseTime);
        }

        session.metrics.failedRequests++;
      }

      return result;

    } catch (error) {
      this.sessionMetrics.failedRequests++;
      const responseTime = Date.now() - startTime;

      // Update proxy metrics on error
      if (this.currentProxy) {
        await this.proxyManager.updateProxyMetrics(this.currentProxy.id, false, responseTime);
      }

      logger.error(`Enterprise infrastructure execution failed for action ${action}:`, error);

      // Throw specific Twikit error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('authentication')) {
        throw new TwikitError(TwikitErrorType.AUTHENTICATION_FAILED, errorMessage, { action, accountId: this.accountId });
      } else if (errorMessage.includes('rate limit')) {
        throw new TwikitError(TwikitErrorType.RATE_LIMIT_EXCEEDED, errorMessage, { action, accountId: this.accountId });
      } else if (errorMessage.includes('proxy')) {
        throw new TwikitError(TwikitErrorType.PROXY_ERROR, errorMessage, { action, accountId: this.accountId });
      } else {
        throw new TwikitError(TwikitErrorType.UNKNOWN_ERROR, errorMessage, { action, accountId: this.accountId });
      }
    }
  }

  /**
   * Execute Python script with enhanced connection pooling and session reuse
   */
  private async executeEnhancedPythonScript(action: string, params: any = {}): Promise<any> {
    const connectionKey = `${this.accountId}_${params.sessionId}`;

    return new Promise((resolve, reject) => {
      const scriptParams = {
        ...params,
        accountId: this.accountId,
        credentials: this.credentials,
        cookiesFile: path.join(this.cookiesDir, `${this.accountId}_cookies.json`),
        connectionPoolKey: connectionKey,
        reuseConnection: this.connectionPool.has(connectionKey)
      };

      logger.debug(`Executing Python script for action: ${action}`, {
        accountId: this.accountId,
        sessionId: params.sessionId,
        proxyType: params.proxy?.type,
        reuseConnection: scriptParams.reuseConnection
      });

      const pythonProcess = spawn('python', [
        this.pythonScriptPath,
        action,
        JSON.stringify(scriptParams)
      ], {
        env: {
          ...process.env,
          PYTHONPATH: path.join(__dirname, '../../scripts'),
          TWIKIT_SESSION_POOL: 'enabled',
          TWIKIT_CONNECTION_REUSE: scriptParams.reuseConnection ? 'true' : 'false'
        }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);

            // Update connection pool if successful
            if (result.success && result.connectionInfo) {
              this.connectionPool.set(connectionKey, {
                lastUsed: new Date(),
                connectionInfo: result.connectionInfo,
                sessionId: params.sessionId
              });
            }

            resolve(result);
          } catch (error) {
            logger.error('Failed to parse Python script output:', stdout);
            reject(new TwikitError(
              TwikitErrorType.SCRIPT_EXECUTION_ERROR,
              'Invalid JSON response from Python script',
              { action, stdout: stdout.substring(0, 500) }
            ));
          }
        } else {
          logger.error('Python script failed:', stderr);

          // Clean up connection pool entry on failure
          if (this.connectionPool.has(connectionKey)) {
            this.connectionPool.delete(connectionKey);
          }

          // Determine error type based on stderr content
          let errorType = TwikitErrorType.SCRIPT_EXECUTION_ERROR;
          if (stderr.includes('authentication') || stderr.includes('login')) {
            errorType = TwikitErrorType.AUTHENTICATION_FAILED;
          } else if (stderr.includes('rate limit') || stderr.includes('429')) {
            errorType = TwikitErrorType.RATE_LIMIT_EXCEEDED;
          } else if (stderr.includes('proxy') || stderr.includes('connection')) {
            errorType = TwikitErrorType.PROXY_ERROR;
          } else if (stderr.includes('suspended') || stderr.includes('locked')) {
            errorType = TwikitErrorType.ACCOUNT_SUSPENDED;
          }

          reject(new TwikitError(
            errorType,
            `Python script failed with code ${code}`,
            { action, stderr: stderr.substring(0, 500), code }
          ));
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error('Failed to spawn Python process:', error);
        reject(new TwikitError(
          TwikitErrorType.SCRIPT_EXECUTION_ERROR,
          'Failed to spawn Python process',
          { action, error: error.message }
        ));
      });

      // Set timeout for long-running operations
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new TwikitError(
          TwikitErrorType.TIMEOUT_ERROR,
          'Python script execution timeout',
          { action, timeout: 30000 }
        ));
      }, 30000);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Legacy Python script execution for backward compatibility
   */
  private async executePythonScript(action: string, params: any = {}): Promise<any> {
    logger.warn(`Using legacy Python script execution for action: ${action}. Consider upgrading to enterprise infrastructure.`);

    // Use enhanced script execution but without session management
    const enhancedParams = {
      ...params,
      accountId: this.accountId,
      credentials: this.credentials,
      cookiesFile: path.join(this.cookiesDir, `${this.accountId}_cookies.json`),
      legacyMode: true
    };

    return this.executeEnhancedPythonScript(action, enhancedParams);
  }

  /**
   * Authenticate with X using enterprise session management and proxy rotation
   */
  async authenticate(): Promise<boolean> {
    try {
      logger.info(`Authenticating X account with enterprise infrastructure: ${this.credentials.username}`);

      // Ensure session is created (this will create a new session if needed)
      const session = await this.ensureSession();

      // Authentication is a critical operation - use residential proxy
      const result = await this.executeWithEnterpriseInfrastructure('authenticate', {
        username: this.credentials.username,
        email: this.credentials.email,
        password: this.credentials.password
      }, ActionRiskLevel.CRITICAL);

      if (result.success) {
        this.isAuthenticated = true;
        session.isAuthenticated = true;
        session.metrics.authenticationAttempts++;

        logger.info(`Successfully authenticated X account with enterprise infrastructure: ${this.credentials.username}`);

        // Store authentication status in database
        await this.updateAccountStatus('authenticated');

        // Cache authentication status
        await cacheManager.set(
          `auth_status_${this.accountId}`,
          { authenticated: true, timestamp: new Date() },
          3600 // 1 hour
        );

        return true;
      } else {
        logger.error(`Authentication failed for ${this.credentials.username}:`, result.error);
        session.isAuthenticated = false;
        await this.updateAccountStatus('authentication_failed');

        // Handle specific authentication errors
        if (result.error.includes('suspended') || result.error.includes('locked')) {
          await this.updateAccountStatus('suspended');
          throw new TwikitError(
            TwikitErrorType.ACCOUNT_SUSPENDED,
            `Account ${this.credentials.username} is suspended or locked`,
            { accountId: this.accountId }
          );
        }

        return false;
      }
    } catch (error) {
      logger.error('Authentication error:', error);
      await this.updateAccountStatus('authentication_error');

      if (error instanceof TwikitError) {
        throw error;
      }

      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_FAILED,
        `Authentication failed for account ${this.credentials.username}`,
        { accountId: this.accountId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Post a tweet with enterprise session management and proxy rotation
   */
  async postTweet(tweetData: XTweetData): Promise<XTweet | null> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Posting tweet with enterprise infrastructure for account ${this.accountId}:`, tweetData.text.substring(0, 50));

      // Posting is a high-risk operation - use residential proxy
      const result = await this.executeWithEnterpriseInfrastructure('post_tweet', {
        text: tweetData.text,
        mediaIds: tweetData.mediaIds || [],
        replyToTweetId: tweetData.replyToTweetId,
        quoteTweetId: tweetData.quoteTweetId
      }, ActionRiskLevel.HIGH);

      if (result.success && result.tweet) {
        const tweet: XTweet = {
          id: result.tweet.id,
          text: result.tweet.text,
          authorId: result.tweet.author_id,
          createdAt: new Date(result.tweet.created_at),
          metrics: {
            likes: result.tweet.metrics?.likes || 0,
            retweets: result.tweet.metrics?.retweets || 0,
            replies: result.tweet.metrics?.replies || 0,
            quotes: result.tweet.metrics?.quotes || 0
          }
        };

        // Store tweet in database
        await this.storeTweetInDatabase(tweet);

        // Update session metrics
        if (this.currentSession) {
          this.currentSession.metrics.actionCount++;
        }

        // Log action for analytics
        await this.logAction('post_tweet', {
          tweetId: tweet.id,
          text: tweetData.text.substring(0, 100),
          proxy: this.currentProxy?.type,
          sessionId: this.currentSession?.sessionId
        });

        logger.info(`Successfully posted tweet ${tweet.id} using enterprise infrastructure`);
        return tweet;
      } else {
        logger.error('Failed to post tweet:', result.error);

        // Handle specific posting errors
        if (result.error.includes('rate limit')) {
          throw new TwikitError(
            TwikitErrorType.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded for posting',
            { accountId: this.accountId, action: 'post_tweet' }
          );
        }

        return null;
      }
    } catch (error) {
      logger.error('Error posting tweet:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      throw new TwikitError(
        TwikitErrorType.ACTION_FAILED,
        'Failed to post tweet',
        { accountId: this.accountId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Like a tweet with enterprise session management and proxy rotation
   */
  async likeTweet(tweetId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Liking tweet ${tweetId} with enterprise infrastructure for account ${this.accountId}`);

      // Liking is a medium-risk operation - can use mobile or datacenter proxy
      const result = await this.executeWithEnterpriseInfrastructure('like_tweet', {
        tweetId
      }, ActionRiskLevel.MEDIUM);

      if (result.success) {
        // Update session metrics
        if (this.currentSession) {
          this.currentSession.metrics.actionCount++;
        }

        await this.logAction('like', {
          tweetId,
          proxy: this.currentProxy?.type,
          sessionId: this.currentSession?.sessionId
        });

        logger.info(`Successfully liked tweet ${tweetId} using enterprise infrastructure`);
        return true;
      } else {
        logger.error(`Failed to like tweet ${tweetId}:`, result.error);

        // Handle specific like errors
        if (result.error.includes('rate limit')) {
          throw new TwikitError(
            TwikitErrorType.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded for liking',
            { accountId: this.accountId, action: 'like_tweet', tweetId }
          );
        }

        return false;
      }
    } catch (error) {
      logger.error('Error liking tweet:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Follow a user with enterprise session management and proxy rotation
   */
  async followUser(userId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Following user ${userId} with enterprise infrastructure for account ${this.accountId}`);

      // Following is a high-risk operation - use residential proxy
      const result = await this.executeWithEnterpriseInfrastructure('follow_user', {
        userId
      }, ActionRiskLevel.HIGH);

      if (result.success) {
        // Update session metrics
        if (this.currentSession) {
          this.currentSession.metrics.actionCount++;
        }

        await this.logAction('follow', {
          userId,
          proxy: this.currentProxy?.type,
          sessionId: this.currentSession?.sessionId
        });

        logger.info(`Successfully followed user ${userId} using enterprise infrastructure`);
        return true;
      } else {
        logger.error(`Failed to follow user ${userId}:`, result.error);

        // Handle specific follow errors
        if (result.error.includes('rate limit')) {
          throw new TwikitError(
            TwikitErrorType.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded for following',
            { accountId: this.accountId, action: 'follow_user', userId }
          );
        }

        return false;
      }
    } catch (error) {
      logger.error('Error following user:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Unfollow a user with enterprise session management and proxy rotation
   */
  async unfollowUser(userId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Unfollowing user ${userId} with enterprise infrastructure for account ${this.accountId}`);

      // Unfollowing is a medium-risk operation
      const result = await this.executeWithEnterpriseInfrastructure('unfollow_user', {
        userId
      }, ActionRiskLevel.MEDIUM);

      if (result.success) {
        // Update session metrics
        if (this.currentSession) {
          this.currentSession.metrics.actionCount++;
        }

        await this.logAction('unfollow', {
          userId,
          proxy: this.currentProxy?.type,
          sessionId: this.currentSession?.sessionId
        });

        logger.info(`Successfully unfollowed user ${userId} using enterprise infrastructure`);
        return true;
      } else {
        logger.warn(`Failed to unfollow user ${userId}: ${result.error}`);
        return false;
      }
    } catch (error) {
      logger.error('Error unfollowing user:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Retweet a tweet with enterprise session management and proxy rotation
   */
  async retweetTweet(tweetId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Retweeting tweet ${tweetId} with enterprise infrastructure for account ${this.accountId}`);

      // Retweeting is a medium-risk operation
      const result = await this.executeWithEnterpriseInfrastructure('retweet', {
        tweetId
      }, ActionRiskLevel.MEDIUM);

      if (result.success) {
        // Update session metrics
        if (this.currentSession) {
          this.currentSession.metrics.actionCount++;
        }

        await this.logAction('retweet', {
          tweetId,
          proxy: this.currentProxy?.type,
          sessionId: this.currentSession?.sessionId
        });

        logger.info(`Successfully retweeted tweet ${tweetId} using enterprise infrastructure`);
        return true;
      } else {
        logger.warn(`Failed to retweet tweet ${tweetId}: ${result.error}`);

        if (result.error.includes('rate limit')) {
          throw new TwikitError(
            TwikitErrorType.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded for retweeting',
            { accountId: this.accountId, action: 'retweet', tweetId }
          );
        }

        return false;
      }
    } catch (error) {
      logger.error('Error retweeting tweet:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Reply to a tweet with enterprise session management and proxy rotation
   */
  async replyToTweet(tweetId: string, content: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Replying to tweet ${tweetId} with enterprise infrastructure for account ${this.accountId}`);

      // Replying is a high-risk operation - use residential proxy
      const result = await this.executeWithEnterpriseInfrastructure('reply_to_tweet', {
        tweetId,
        content
      }, ActionRiskLevel.HIGH);

      if (result.success) {
        // Update session metrics
        if (this.currentSession) {
          this.currentSession.metrics.actionCount++;
        }

        await this.logAction('reply', {
          tweetId,
          content: content.substring(0, 100),
          proxy: this.currentProxy?.type,
          sessionId: this.currentSession?.sessionId
        });

        logger.info(`Successfully replied to tweet ${tweetId} using enterprise infrastructure`);
        return true;
      } else {
        logger.warn(`Failed to reply to tweet ${tweetId}: ${result.error}`);

        if (result.error.includes('rate limit')) {
          throw new TwikitError(
            TwikitErrorType.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded for replying',
            { accountId: this.accountId, action: 'reply_to_tweet', tweetId }
          );
        }

        return false;
      }
    } catch (error) {
      logger.error('Error replying to tweet:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Get tweet by ID with enterprise session management and proxy rotation
   */
  async getTweetById(tweetId: string): Promise<any> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Getting tweet ${tweetId} with enterprise infrastructure for account ${this.accountId}`);

      // Getting tweet is a low-risk operation - can use datacenter proxy
      const result = await this.executeWithEnterpriseInfrastructure('get_tweet', {
        tweetId
      }, ActionRiskLevel.LOW);

      if (result.success) {
        logger.info(`Successfully retrieved tweet ${tweetId} using enterprise infrastructure`);
        return result.data;
      } else {
        logger.warn(`Failed to get tweet ${tweetId}: ${result.error}`);
        return null;
      }
    } catch (error) {
      logger.error('Error getting tweet:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return null;
    }
  }

  /**
   * Send direct message with enterprise session management and proxy rotation
   */
  async sendDirectMessage(userId: string, text: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Sending DM to user ${userId} with enterprise infrastructure for account ${this.accountId}`);

      // Sending DM is a critical operation - use residential proxy
      const result = await this.executeWithEnterpriseInfrastructure('send_dm', {
        userId,
        text
      }, ActionRiskLevel.CRITICAL);

      if (result.success) {
        // Update session metrics
        if (this.currentSession) {
          this.currentSession.metrics.actionCount++;
        }

        await this.logAction('dm', {
          userId,
          text: text.substring(0, 50),
          proxy: this.currentProxy?.type,
          sessionId: this.currentSession?.sessionId
        });

        logger.info(`Successfully sent DM to user ${userId} using enterprise infrastructure`);
        return true;
      } else {
        logger.error(`Failed to send DM to user ${userId}:`, result.error);

        if (result.error.includes('rate limit')) {
          throw new TwikitError(
            TwikitErrorType.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded for sending DM',
            { accountId: this.accountId, action: 'send_dm', userId }
          );
        }

        return false;
      }
    } catch (error) {
      logger.error('Error sending DM:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Search tweets with enterprise session management and proxy rotation
   */
  async searchTweets(query: string, count: number = 20): Promise<XSearchResult> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Searching tweets for query: ${query} with enterprise infrastructure`);

      // Searching is a low-risk operation - can use datacenter proxy
      const result = await this.executeWithEnterpriseInfrastructure('search_tweets', {
        query,
        count
      }, ActionRiskLevel.LOW);

      if (result.success && result.tweets) {
        const tweets: XTweet[] = result.tweets.map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          createdAt: new Date(tweet.created_at),
          metrics: {
            likes: tweet.metrics?.likes || 0,
            retweets: tweet.metrics?.retweets || 0,
            replies: tweet.metrics?.replies || 0,
            quotes: tweet.metrics?.quotes || 0
          }
        }));

        // Cache search results for performance
        await cacheManager.set(
          `search_${this.accountId}_${Buffer.from(query).toString('base64')}`,
          { tweets, nextToken: result.nextToken },
          300 // 5 minutes
        );

        logger.info(`Successfully searched tweets for query: ${query} using enterprise infrastructure`);
        return {
          tweets,
          nextToken: result.nextToken
        };
      } else {
        logger.error('Failed to search tweets:', result.error);
        return { tweets: [] };
      }
    } catch (error) {
      logger.error('Error searching tweets:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return { tweets: [] };
    }
  }

  /**
   * Get user profile with enterprise session management and proxy rotation
   */
  async getUserProfile(username: string): Promise<XUserProfile | null> {
    if (!this.isAuthenticated) {
      throw new TwikitError(
        TwikitErrorType.AUTHENTICATION_REQUIRED,
        'Account not authenticated',
        { accountId: this.accountId }
      );
    }

    try {
      logger.info(`Getting profile for user: ${username} with enterprise infrastructure`);

      // Check cache first
      const cacheKey = `profile_${username}`;
      const cachedProfile = await cacheManager.get(cacheKey) as XUserProfile | null;
      if (cachedProfile) {
        logger.debug(`Retrieved cached profile for user: ${username}`);
        return cachedProfile;
      }

      // Getting profile is a low-risk operation - can use datacenter proxy
      const result = await this.executeWithEnterpriseInfrastructure('get_user_profile', {
        username
      }, ActionRiskLevel.LOW);

      if (result.success && result.user) {
        const profile: XUserProfile = {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.display_name,
          bio: result.user.bio || '',
          followersCount: result.user.followers_count || 0,
          followingCount: result.user.following_count || 0,
          tweetsCount: result.user.tweets_count || 0,
          verified: result.user.verified || false,
          protected: result.user.protected || false,
          profileImageUrl: result.user.profile_image_url || ''
        };

        // Cache profile for 10 minutes
        await cacheManager.set(cacheKey, profile, 600);

        logger.info(`Successfully retrieved profile for user: ${username} using enterprise infrastructure`);
        return profile;
      } else {
        logger.error(`Failed to get profile for user ${username}:`, result.error);
        return null;
      }
    } catch (error) {
      logger.error('Error getting user profile:', error);

      if (error instanceof TwikitError) {
        throw error;
      }

      return null;
    }
  }

  /**
   * Update account status in database
   */
  private async updateAccountStatus(status: string): Promise<void> {
    try {
      await prisma.xAccount.update({
        where: { id: this.accountId },
        data: { 
          status,
          lastActivity: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to update account status:', error);
    }
  }

  /**
   * Store tweet in database
   */
  private async storeTweetInDatabase(tweet: XTweet): Promise<void> {
    try {
      await prisma.post.create({
        data: {
          id: tweet.id,
          accountId: this.accountId,
          content: tweet.text,
          tweetId: tweet.id,
          status: 'PUBLISHED',
          // Store analytics metrics in the metrics JSON field
          analytics: {
            create: {
              metrics: {
                likes: tweet.metrics.likes,
                retweets: tweet.metrics.retweets,
                replies: tweet.metrics.replies,
                quotes: tweet.metrics.quotes
              }
            }
          },
          createdAt: tweet.createdAt
        }
      });
    } catch (error) {
      logger.error('Failed to store tweet in database:', error);
    }
  }

  /**
   * Log action for analytics
   */
  private async logAction(action: string, data: any): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationId: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          accountId: this.accountId,
          action,
          status: 'SUCCESS',
          message: `Action ${action} completed successfully`,
          details: data
        }
      });
    } catch (error) {
      logger.error('Failed to log action:', error);
    }
  }

  /**
   * Check if account is healthy (not suspended/limited) with enterprise infrastructure
   */
  async checkAccountHealth(): Promise<{ healthy: boolean; status: string; message?: string }> {
    try {
      // Health check is a low-risk operation
      const result = await this.executeWithEnterpriseInfrastructure('check_health', {}, ActionRiskLevel.LOW);

      if (result.success) {
        return {
          healthy: result.healthy,
          status: result.status,
          message: result.message
        };
      } else {
        return {
          healthy: false,
          status: 'error',
          message: result.error
        };
      }
    } catch (error) {
      logger.error('Error checking account health:', error);
      return {
        healthy: false,
        status: 'error',
        message: 'Failed to check account health'
      };
    }
  }

  /**
   * Get session metrics and statistics
   */
  getSessionMetrics(): {
    sessionId: string | null;
    accountId: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageResponseTime: number;
    lastActivity: Date | null;
    currentProxy: string | null;
    sessionActive: boolean;
  } {
    return {
      sessionId: this.currentSession?.sessionId || null,
      accountId: this.accountId,
      totalRequests: this.sessionMetrics.totalRequests,
      successfulRequests: this.sessionMetrics.successfulRequests,
      failedRequests: this.sessionMetrics.failedRequests,
      successRate: this.sessionMetrics.totalRequests > 0 ?
        (this.sessionMetrics.successfulRequests / this.sessionMetrics.totalRequests) * 100 : 0,
      averageResponseTime: this.sessionMetrics.averageResponseTime,
      lastActivity: this.sessionMetrics.lastActivity,
      currentProxy: this.currentProxy?.type || null,
      sessionActive: this.currentSession?.isActive || false
    };
  }

  /**
   * Get proxy manager statistics
   */
  getProxyStatistics() {
    return this.proxyManager.getUsageStatistics();
  }

  /**
   * Cleanup resources and close connections
   */
  async cleanup(): Promise<void> {
    try {
      logger.info(`Cleaning up RealXApiClient resources for account: ${this.accountId}`);

      // Clear connection pool
      this.connectionPool.clear();

      // Destroy session if exists
      if (this.currentSession) {
        await this.sessionManager.destroySession(this.accountId);
        this.currentSession = null;
      }

      // Stop proxy manager
      await this.proxyManager.stop();

      logger.info(`Successfully cleaned up RealXApiClient resources for account: ${this.accountId}`);
    } catch (error) {
      logger.error(`Error cleaning up RealXApiClient resources:`, error);
    }
  }

  /**
   * Force session refresh (useful for handling authentication issues)
   */
  async refreshSession(): Promise<boolean> {
    try {
      logger.info(`Refreshing session for account: ${this.accountId}`);

      // Destroy current session
      if (this.currentSession) {
        await this.sessionManager.destroySession(this.accountId);
        this.currentSession = null;
      }

      // Clear authentication status
      this.isAuthenticated = false;

      // Clear connection pool
      this.connectionPool.clear();

      // Re-authenticate
      return await this.authenticate();
    } catch (error) {
      logger.error(`Error refreshing session for account ${this.accountId}:`, error);
      return false;
    }
  }
}
