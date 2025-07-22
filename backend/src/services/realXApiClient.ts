import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { EnterpriseAntiDetectionCoordinator } from './antiDetection/antiDetectionCoordinator';

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
 * Real X/Twitter API Client using twikit Python library
 * This replaces the mock accountSimulatorService with actual X functionality
 */
export class RealXApiClient {
  private pythonScriptPath: string;
  private cookiesDir: string;
  private accountId: string;
  private credentials: XAccountCredentials;
  private isAuthenticated: boolean = false;
  private antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator | null = null;
  private currentSession: any = null;

  constructor(accountId: string, credentials: XAccountCredentials, antiDetectionCoordinator?: EnterpriseAntiDetectionCoordinator) {
    this.accountId = accountId;
    this.credentials = credentials;
    this.antiDetectionCoordinator = antiDetectionCoordinator || null;
    this.pythonScriptPath = path.join(__dirname, '../../scripts/x_client.py');
    this.cookiesDir = path.join(__dirname, '../../data/cookies');

    // Ensure cookies directory exists
    this.ensureCookiesDir();
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
   * Execute action with comprehensive anti-detection measures
   */
  private async executeWithAntiDetection(action: string, params: any = {}): Promise<any> {
    try {
      if (this.antiDetectionCoordinator && this.currentSession) {
        // Process action through anti-detection coordinator
        const result = await this.antiDetectionCoordinator.processActionWithAntiDetection(
          this.accountId,
          action,
          params,
          {
            riskLevel: 'medium',
            retryOnFailure: true
          }
        );

        if (result.success) {
          // Execute the actual Python script with anti-detection context
          const scriptParams = {
            ...params,
            accountId: this.accountId,
            credentials: this.credentials,
            cookiesFile: path.join(this.cookiesDir, `${this.accountId}_cookies.json`),
            antiDetectionContext: {
              proxy: this.currentSession.proxy,
              fingerprint: this.currentSession.fingerprint,
              sessionId: this.currentSession.sessionId
            }
          };

          return await this.executePythonScript(action, scriptParams);
        } else {
          logger.warn(`Anti-detection coordinator blocked action ${action} for account ${this.accountId}`);
          return {
            success: false,
            error: 'Action blocked by anti-detection system',
            recommendations: result.recommendations
          };
        }
      } else {
        // Fallback to direct execution without anti-detection
        return await this.executePythonScript(action, params);
      }
    } catch (error) {
      logger.error(`Anti-detection execution failed for action ${action}:`, error);
      throw error;
    }
  }

  /**
   * Execute Python script with twikit
   */
  private async executePythonScript(action: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptParams = {
        ...params,
        accountId: this.accountId,
        credentials: this.credentials,
        cookiesFile: path.join(this.cookiesDir, `${this.accountId}_cookies.json`)
      };

      const pythonProcess = spawn('python', [
        this.pythonScriptPath,
        action,
        JSON.stringify(scriptParams)
      ]);

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
            resolve(result);
          } catch (error) {
            logger.error('Failed to parse Python script output:', stdout);
            reject(new Error('Invalid JSON response from Python script'));
          }
        } else {
          logger.error('Python script failed:', stderr);
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error('Failed to spawn Python process:', error);
        reject(error);
      });
    });
  }

  /**
   * Authenticate with X using credentials and anti-detection measures
   */
  async authenticate(): Promise<boolean> {
    try {
      logger.info(`Authenticating X account: ${this.credentials.username}`);

      // Initialize anti-detection session if coordinator is available
      if (this.antiDetectionCoordinator && !this.currentSession) {
        try {
          this.currentSession = await this.antiDetectionCoordinator.createAntiDetectionSession(
            this.accountId,
            {
              riskLevel: 'medium',
              sessionDuration: 3600, // 1 hour
              actions: ['authenticate', 'posting', 'liking', 'following']
            }
          );
          logger.info(`Created anti-detection session for account ${this.accountId}`);
        } catch (error) {
          logger.warn(`Failed to create anti-detection session: ${error}`);
          // Continue without anti-detection if it fails
        }
      }

      const result = await this.executeWithAntiDetection('authenticate', {
        username: this.credentials.username,
        email: this.credentials.email,
        password: this.credentials.password
      });

      if (result.success) {
        this.isAuthenticated = true;
        logger.info(`Successfully authenticated X account: ${this.credentials.username}`);

        // Store authentication status in database
        await this.updateAccountStatus('authenticated');

        return true;
      } else {
        logger.error(`Authentication failed for ${this.credentials.username}:`, result.error);
        await this.updateAccountStatus('authentication_failed');
        return false;
      }
    } catch (error) {
      logger.error('Authentication error:', error);
      await this.updateAccountStatus('authentication_error');
      return false;
    }
  }

  /**
   * Post a tweet with anti-detection measures
   */
  async postTweet(tweetData: XTweetData): Promise<XTweet | null> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Posting tweet for account ${this.accountId}:`, tweetData.text.substring(0, 50));

      const result = await this.executeWithAntiDetection('post_tweet', {
        text: tweetData.text,
        mediaIds: tweetData.mediaIds || [],
        replyToTweetId: tweetData.replyToTweetId,
        quoteTweetId: tweetData.quoteTweetId
      });

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

        logger.info(`Successfully posted tweet ${tweet.id}`);
        return tweet;
      } else {
        logger.error('Failed to post tweet:', result.error);
        return null;
      }
    } catch (error) {
      logger.error('Error posting tweet:', error);
      throw error;
    }
  }

  /**
   * Like a tweet with anti-detection measures
   */
  async likeTweet(tweetId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Liking tweet ${tweetId} for account ${this.accountId}`);

      const result = await this.executeWithAntiDetection('like_tweet', {
        tweetId
      });

      if (result.success) {
        logger.info(`Successfully liked tweet ${tweetId}`);
        await this.logAction('like', { tweetId });
        return true;
      } else {
        logger.error(`Failed to like tweet ${tweetId}:`, result.error);
        return false;
      }
    } catch (error) {
      logger.error('Error liking tweet:', error);
      return false;
    }
  }

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Following user ${userId} for account ${this.accountId}`);
      
      const result = await this.executePythonScript('follow_user', {
        userId
      });

      if (result.success) {
        logger.info(`Successfully followed user ${userId}`);
        await this.logAction('follow', { userId });
        return true;
      } else {
        logger.error(`Failed to follow user ${userId}:`, result.error);
        return false;
      }
    } catch (error) {
      logger.error('Error following user:', error);
      return false;
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(userId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Unfollowing user ${userId} for account ${this.accountId}`);

      const result = await this.executePythonScript('unfollow_user', {
        userId
      });

      if (result.success) {
        logger.info(`Successfully unfollowed user ${userId}`);
        await this.logAction('unfollow', { userId });
        return true;
      } else {
        logger.warn(`Failed to unfollow user ${userId}: ${result.error}`);
        return false;
      }
    } catch (error) {
      logger.error('Error unfollowing user:', error);
      return false;
    }
  }

  /**
   * Retweet a tweet
   */
  async retweetTweet(tweetId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Retweeting tweet ${tweetId} for account ${this.accountId}`);

      const result = await this.executePythonScript('retweet', {
        tweetId
      });

      if (result.success) {
        logger.info(`Successfully retweeted tweet ${tweetId}`);
        await this.logAction('retweet', { tweetId });
        return true;
      } else {
        logger.warn(`Failed to retweet tweet ${tweetId}: ${result.error}`);
        return false;
      }
    } catch (error) {
      logger.error('Error retweeting tweet:', error);
      return false;
    }
  }

  /**
   * Reply to a tweet
   */
  async replyToTweet(tweetId: string, content: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Replying to tweet ${tweetId} for account ${this.accountId}`);

      const result = await this.executePythonScript('reply_to_tweet', {
        tweetId,
        content
      });

      if (result.success) {
        logger.info(`Successfully replied to tweet ${tweetId}`);
        await this.logAction('reply', { tweetId, content });
        return true;
      } else {
        logger.warn(`Failed to reply to tweet ${tweetId}: ${result.error}`);
        return false;
      }
    } catch (error) {
      logger.error('Error replying to tweet:', error);
      return false;
    }
  }

  /**
   * Get tweet by ID
   */
  async getTweetById(tweetId: string): Promise<any> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Getting tweet ${tweetId} for account ${this.accountId}`);

      const result = await this.executePythonScript('get_tweet', {
        tweetId
      });

      if (result.success) {
        logger.info(`Successfully retrieved tweet ${tweetId}`);
        return result.data;
      } else {
        logger.warn(`Failed to get tweet ${tweetId}: ${result.error}`);
        return null;
      }
    } catch (error) {
      logger.error('Error getting tweet:', error);
      return null;
    }
  }

  /**
   * Send direct message
   */
  async sendDirectMessage(userId: string, text: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Sending DM to user ${userId} for account ${this.accountId}`);
      
      const result = await this.executePythonScript('send_dm', {
        userId,
        text
      });

      if (result.success) {
        logger.info(`Successfully sent DM to user ${userId}`);
        await this.logAction('dm', { userId, text: text.substring(0, 50) });
        return true;
      } else {
        logger.error(`Failed to send DM to user ${userId}:`, result.error);
        return false;
      }
    } catch (error) {
      logger.error('Error sending DM:', error);
      return false;
    }
  }

  /**
   * Search tweets
   */
  async searchTweets(query: string, count: number = 20): Promise<XSearchResult> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Searching tweets for query: ${query}`);
      
      const result = await this.executePythonScript('search_tweets', {
        query,
        count
      });

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
      return { tweets: [] };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(username: string): Promise<XUserProfile | null> {
    if (!this.isAuthenticated) {
      throw new Error('Account not authenticated');
    }

    try {
      logger.info(`Getting profile for user: ${username}`);
      
      const result = await this.executePythonScript('get_user_profile', {
        username
      });

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

        return profile;
      } else {
        logger.error(`Failed to get profile for user ${username}:`, result.error);
        return null;
      }
    } catch (error) {
      logger.error('Error getting user profile:', error);
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
          content: tweet.text,
          xPostId: tweet.id,
          status: 'PUBLISHED',
          analytics: {
            likes: tweet.metrics.likes,
            retweets: tweet.metrics.retweets,
            replies: tweet.metrics.replies,
            quotes: tweet.metrics.quotes
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
          accountId: this.accountId,
          action,
          data,
          timestamp: new Date(),
          success: true
        }
      });
    } catch (error) {
      logger.error('Failed to log action:', error);
    }
  }

  /**
   * Check if account is healthy (not suspended/limited)
   */
  async checkAccountHealth(): Promise<{ healthy: boolean; status: string; message?: string }> {
    try {
      const result = await this.executePythonScript('check_health');
      
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
}
