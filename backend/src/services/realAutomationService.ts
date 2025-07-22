import { RealXApiClient, XTweetData } from './realXApiClient';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

export interface AutomationConfig {
  accountId: string;
  enabled: boolean;
  features: {
    posting: boolean;
    liking: boolean;
    commenting: boolean;
    following: boolean;
    dm: boolean;
    polls: boolean;
    threads: boolean;
  };
  limits: {
    postsPerDay: number;
    likesPerDay: number;
    commentsPerDay: number;
    followsPerDay: number;
    dmsPerDay: number;
    pollsPerWeek: number;
    threadsPerWeek: number;
  };
  schedule: {
    active: boolean;
    timezone: string;
    intervals: {
      posting: number; // minutes between posts
      engagement: number; // minutes between likes/comments
      following: number; // minutes between follows
    };
    activeHours: {
      start: string; // "09:00"
      end: string; // "21:00"
    };
  };
  targeting: {
    keywords: string[];
    hashtags: string[];
    users: string[];
    excludeKeywords: string[];
  };
  safety: {
    pauseOnSuspicion: boolean;
    respectRateLimits: boolean;
    humanLikeDelays: boolean;
    randomization: number; // 0-1 factor for randomizing timing
    emergencyStop: boolean;
  };
}

export interface AutomationStats {
  accountId: string;
  today: {
    posts: number;
    likes: number;
    comments: number;
    follows: number;
    dms: number;
    polls: number;
    threads: number;
  };
  total: {
    posts: number;
    likes: number;
    comments: number;
    follows: number;
    dms: number;
    polls: number;
    threads: number;
  };
  lastAction: Date | null;
  nextAction: Date | null;
  errors: number;
  successRate: number;
}

/**
 * Real Automation Service that replaces mock automation
 * Uses RealXApiClient for actual X/Twitter operations
 */
export class RealAutomationService {
  private automations: Map<string, AutomationConfig> = new Map();
  private stats: Map<string, AutomationStats> = new Map();
  private clients: Map<string, RealXApiClient> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.loadAutomationsFromDatabase();
  }

  /**
   * Load automation configurations from database
   */
  private async loadAutomationsFromDatabase(): Promise<void> {
    try {
      const accounts = await prisma.xAccount.findMany({
        where: { isActive: true },
        include: { user: true }
      });

      for (const account of accounts) {
        if (account.accessToken && account.accessTokenSecret) {
          // Create default automation config
          const config: AutomationConfig = {
            accountId: account.id,
            enabled: false, // Start disabled by default
            features: {
              posting: false,
              liking: true,
              commenting: false,
              following: false,
              dm: false,
              polls: false,
              threads: false
            },
            limits: {
              postsPerDay: 5,
              likesPerDay: 50,
              commentsPerDay: 10,
              followsPerDay: 20,
              dmsPerDay: 5,
              pollsPerWeek: 2,
              threadsPerWeek: 1
            },
            schedule: {
              active: true,
              timezone: 'UTC',
              intervals: {
                posting: 120, // 2 hours
                engagement: 15, // 15 minutes
                following: 60 // 1 hour
              },
              activeHours: {
                start: '09:00',
                end: '21:00'
              }
            },
            targeting: {
              keywords: ['crypto', 'bitcoin', 'blockchain'],
              hashtags: ['#crypto', '#bitcoin', '#web3'],
              users: [],
              excludeKeywords: ['scam', 'spam']
            },
            safety: {
              pauseOnSuspicion: true,
              respectRateLimits: true,
              humanLikeDelays: true,
              randomization: 0.3,
              emergencyStop: false
            }
          };

          this.automations.set(account.id, config);
          this.initializeStats(account.id);

          // Initialize X client
          const client = new RealXApiClient(account.id, {
            username: account.username,
            email: account.user.email || '',
            password: '' // This would need to be stored securely
          });

          this.clients.set(account.id, client);
        }
      }

      logger.info(`Loaded ${this.automations.size} automation configurations`);
    } catch (error) {
      logger.error('Failed to load automations from database:', error);
    }
  }

  /**
   * Initialize stats for an account
   */
  private initializeStats(accountId: string): void {
    const stats: AutomationStats = {
      accountId,
      today: {
        posts: 0,
        likes: 0,
        comments: 0,
        follows: 0,
        dms: 0,
        polls: 0,
        threads: 0
      },
      total: {
        posts: 0,
        likes: 0,
        comments: 0,
        follows: 0,
        dms: 0,
        polls: 0,
        threads: 0
      },
      lastAction: null,
      nextAction: null,
      errors: 0,
      successRate: 1.0
    };

    this.stats.set(accountId, stats);
  }

  /**
   * Start automation for an account
   */
  async startAutomation(accountId: string): Promise<boolean> {
    try {
      const config = this.automations.get(accountId);
      if (!config) {
        logger.error(`No automation config found for account ${accountId}`);
        return false;
      }

      const client = this.clients.get(accountId);
      if (!client) {
        logger.error(`No X client found for account ${accountId}`);
        return false;
      }

      // Authenticate the client
      const authenticated = await client.authenticate();
      if (!authenticated) {
        logger.error(`Failed to authenticate account ${accountId}`);
        return false;
      }

      // Enable automation
      config.enabled = true;
      this.automations.set(accountId, config);

      // Start automation cycle
      this.startAutomationCycle(accountId);

      logger.info(`Started automation for account ${accountId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start automation for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Stop automation for an account
   */
  async stopAutomation(accountId: string): Promise<boolean> {
    try {
      const config = this.automations.get(accountId);
      if (config) {
        config.enabled = false;
        this.automations.set(accountId, config);
      }

      // Clear interval
      const interval = this.intervals.get(accountId);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(accountId);
      }

      logger.info(`Stopped automation for account ${accountId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop automation for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Start automation cycle for an account
   */
  private startAutomationCycle(accountId: string): void {
    const config = this.automations.get(accountId);
    if (!config || !config.enabled) return;

    // Run automation every minute to check if actions should be performed
    const interval = setInterval(async () => {
      await this.executeAutomationCycle(accountId);
    }, 60000); // Check every minute

    this.intervals.set(accountId, interval);
  }

  /**
   * Execute automation cycle for an account
   */
  private async executeAutomationCycle(accountId: string): Promise<void> {
    try {
      const config = this.automations.get(accountId);
      const stats = this.stats.get(accountId);
      const client = this.clients.get(accountId);

      if (!config || !stats || !client || !config.enabled) return;

      // Check if within active hours
      if (!this.isWithinActiveHours(config.schedule)) {
        return;
      }

      // Check if emergency stop is enabled
      if (config.safety.emergencyStop) {
        logger.warn(`Emergency stop enabled for account ${accountId}`);
        return;
      }

      // Check account health
      const health = await client.checkAccountHealth();
      if (!health.healthy) {
        logger.warn(`Account ${accountId} is not healthy: ${health.message}`);
        if (config.safety.pauseOnSuspicion) {
          config.enabled = false;
          return;
        }
      }

      // Check daily limits
      if (!this.checkDailyLimits(config, stats)) {
        return;
      }

      // Execute automation actions
      await this.executeAutomationActions(accountId, config, stats, client);

    } catch (error) {
      logger.error(`Error in automation cycle for account ${accountId}:`, error);
      this.incrementErrorCount(accountId);
    }
  }

  /**
   * Execute automation actions
   */
  private async executeAutomationActions(
    accountId: string,
    config: AutomationConfig,
    stats: AutomationStats,
    client: RealXApiClient
  ): Promise<void> {
    const now = new Date();
    
    // Check if enough time has passed since last action
    if (stats.lastAction) {
      const timeSinceLastAction = now.getTime() - stats.lastAction.getTime();
      const minInterval = config.schedule.intervals.engagement * 60000; // Convert to milliseconds
      
      if (timeSinceLastAction < minInterval) {
        return; // Too soon for next action
      }
    }

    // Determine which actions to perform based on configuration and limits
    const availableActions = [];

    if (config.features.liking && stats.today.likes < config.limits.likesPerDay) {
      availableActions.push('like');
    }

    if (config.features.following && stats.today.follows < config.limits.followsPerDay) {
      availableActions.push('follow');
    }

    if (config.features.posting && stats.today.posts < config.limits.postsPerDay) {
      availableActions.push('post');
    }

    if (availableActions.length === 0) {
      return; // No actions available
    }

    // Select random action
    const action = availableActions[Math.floor(Math.random() * availableActions.length)];

    // Execute the action
    let success = false;
    
    try {
      switch (action) {
        case 'like':
          success = await this.performLikeAction(client, config);
          if (success) stats.today.likes++;
          break;
        
        case 'follow':
          success = await this.performFollowAction(client, config);
          if (success) stats.today.follows++;
          break;
        
        case 'post':
          success = await this.performPostAction(client, config);
          if (success) stats.today.posts++;
          break;
      }

      if (success) {
        stats.lastAction = now;
        stats.nextAction = new Date(now.getTime() + this.getRandomizedInterval(config));
        this.updateSuccessRate(accountId, true);
      } else {
        this.updateSuccessRate(accountId, false);
      }

      // Update stats in memory
      this.stats.set(accountId, stats);

    } catch (error) {
      logger.error(`Error executing ${action} action for account ${accountId}:`, error);
      this.updateSuccessRate(accountId, false);
    }
  }

  /**
   * Perform like action
   */
  private async performLikeAction(client: RealXApiClient, config: AutomationConfig): Promise<boolean> {
    try {
      // Search for tweets to like based on targeting keywords
      const query = config.targeting.keywords.join(' OR ');
      const searchResult = await client.searchTweets(query, 10);
      
      if (searchResult.tweets.length === 0) {
        return false;
      }

      // Select random tweet
      const tweet = searchResult.tweets[Math.floor(Math.random() * searchResult.tweets.length)];
      
      // Like the tweet
      return await client.likeTweet(tweet.id);
    } catch (error) {
      logger.error('Error performing like action:', error);
      return false;
    }
  }

  /**
   * Perform follow action
   */
  private async performFollowAction(client: RealXApiClient, config: AutomationConfig): Promise<boolean> {
    try {
      // Search for users to follow based on targeting
      const query = config.targeting.keywords[0] || 'crypto';
      const searchResult = await client.searchTweets(query, 5);
      
      if (searchResult.tweets.length === 0) {
        return false;
      }

      // Select random tweet author to follow
      const tweet = searchResult.tweets[Math.floor(Math.random() * searchResult.tweets.length)];
      
      // Follow the user
      return await client.followUser(tweet.authorId);
    } catch (error) {
      logger.error('Error performing follow action:', error);
      return false;
    }
  }

  /**
   * Perform post action
   */
  private async performPostAction(client: RealXApiClient, config: AutomationConfig): Promise<boolean> {
    try {
      // Generate content based on targeting keywords
      const keyword = config.targeting.keywords[Math.floor(Math.random() * config.targeting.keywords.length)];
      const hashtag = config.targeting.hashtags[Math.floor(Math.random() * config.targeting.hashtags.length)];
      
      const tweetText = `Interesting developments in ${keyword} today! ${hashtag} #automation`;
      
      const tweetData: XTweetData = {
        text: tweetText
      };

      const result = await client.postTweet(tweetData);
      return result !== null;
    } catch (error) {
      logger.error('Error performing post action:', error);
      return false;
    }
  }

  /**
   * Check if current time is within active hours
   */
  private isWithinActiveHours(schedule: AutomationConfig['schedule']): boolean {
    if (!schedule.active) return true;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = schedule.activeHours.start.split(':').map(Number);
    const [endHour, endMinute] = schedule.activeHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Check daily limits
   */
  private checkDailyLimits(config: AutomationConfig, stats: AutomationStats): boolean {
    return (
      stats.today.posts < config.limits.postsPerDay &&
      stats.today.likes < config.limits.likesPerDay &&
      stats.today.follows < config.limits.followsPerDay
    );
  }

  /**
   * Get randomized interval for next action
   */
  private getRandomizedInterval(config: AutomationConfig): number {
    const baseInterval = config.schedule.intervals.engagement * 60000; // Convert to milliseconds
    const randomFactor = 1 + (Math.random() - 0.5) * 2 * config.safety.randomization;
    return Math.floor(baseInterval * randomFactor);
  }

  /**
   * Update success rate for an account
   */
  private updateSuccessRate(accountId: string, success: boolean): void {
    const stats = this.stats.get(accountId);
    if (!stats) return;

    if (success) {
      stats.successRate = Math.min(1.0, stats.successRate + 0.01);
    } else {
      stats.errors++;
      stats.successRate = Math.max(0.0, stats.successRate - 0.05);
    }

    this.stats.set(accountId, stats);
  }

  /**
   * Increment error count
   */
  private incrementErrorCount(accountId: string): void {
    const stats = this.stats.get(accountId);
    if (stats) {
      stats.errors++;
      this.stats.set(accountId, stats);
    }
  }

  /**
   * Get automation status for an account
   */
  getAutomationStatus(accountId: string): { config: AutomationConfig | null; stats: AutomationStats | null } {
    return {
      config: this.automations.get(accountId) || null,
      stats: this.stats.get(accountId) || null
    };
  }

  /**
   * Get all automation statuses
   */
  getAllAutomationStatuses(): Array<{ accountId: string; config: AutomationConfig; stats: AutomationStats }> {
    const results = [];
    
    for (const [accountId, config] of this.automations) {
      const stats = this.stats.get(accountId);
      if (stats) {
        results.push({ accountId, config, stats });
      }
    }

    return results;
  }

  /**
   * Update automation configuration
   */
  updateAutomationConfig(accountId: string, updates: Partial<AutomationConfig>): boolean {
    const config = this.automations.get(accountId);
    if (!config) return false;

    const updatedConfig = { ...config, ...updates };
    this.automations.set(accountId, updatedConfig);
    
    logger.info(`Updated automation config for account ${accountId}`);
    return true;
  }
}
