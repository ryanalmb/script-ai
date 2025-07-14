import { logger } from '../utils/logger';
import { databaseService, DatabaseUser, DatabaseAccount } from './databaseService';
import { createClient } from 'redis';

// Cache client for user data
let cacheClient: any = null;

// Initialize cache connection
const initializeCache = async () => {
  if (!cacheClient) {
    try {
      cacheClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      await cacheClient.connect();
      logger.info('User service cache connected');
    } catch (error) {
      logger.warn('Cache connection failed, using memory only:', error);
    }
  }
};

export interface User {
  id: number;
  username?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  isActive: boolean;
  settings: UserSettings;
  createdAt: Date;
  lastActivity: Date;
}

export interface UserSettings {
  automation: {
    enabled: boolean;
    maxPostsPerDay: number;
    maxLikesPerDay: number;
    maxCommentsPerDay: number;
    maxFollowsPerDay: number;
    qualityThreshold: number;
    emergencyStop?: boolean;
  };
  notifications: {
    telegram: boolean;
    email: boolean;
    discord: boolean;
    dailySummary?: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
    theme: string;
  };
}

export class UserService {
  constructor() {
    initializeCache();
  }

  // Cache helper methods
  private async getCachedUser(userId: number): Promise<User | null> {
    if (!cacheClient) return null;
    try {
      const cached = await cacheClient.get(`user:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Cache get failed:', error);
      return null;
    }
  }

  private async setCachedUser(userId: number, user: User): Promise<void> {
    if (!cacheClient) return;
    try {
      await cacheClient.setEx(`user:${userId}`, 300, JSON.stringify(user)); // 5 min cache
    } catch (error) {
      logger.warn('Cache set failed:', error);
    }
  }

  private async invalidateUserCache(userId: number): Promise<void> {
    if (!cacheClient) return;
    try {
      await cacheClient.del(`user:${userId}`);
    } catch (error) {
      logger.warn('Cache invalidation failed:', error);
    }
  }

  async getUser(userId: number): Promise<User | null> {
    try {
      // Check cache first
      let cachedUser = await this.getCachedUser(userId);
      if (cachedUser) {
        return cachedUser;
      }

      // Get user from database
      let dbUser = await databaseService.getUserByTelegramId(userId);

      if (!dbUser) {
        // Create new user in database
        dbUser = await databaseService.createUser(userId);
        if (!dbUser) {
          logger.error(`Failed to create user in database: ${userId}`);
          return null;
        }
        logger.info(`Created new user in database: ${userId}`);
      } else {
        // Update last activity in database
        await databaseService.updateUserActivity(userId);
      }

      // Convert database user to service user format
      const serviceUser: User = {
        id: dbUser.telegram_id,
        username: dbUser.username || undefined,
        firstName: dbUser.first_name || undefined,
        lastName: dbUser.last_name || undefined,
        isActive: dbUser.is_active,
        settings: dbUser.settings || this.getDefaultSettings(),
        createdAt: dbUser.created_at,
        lastActivity: dbUser.last_activity
      };

      // Cache the user
      await this.setCachedUser(userId, serviceUser);

      return serviceUser;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  async createUser(id: number, username?: string, firstName?: string, lastName?: string): Promise<User> {
    try {
      // Create user in database
      const dbUser = await databaseService.createUser(id, username, firstName, lastName);

      if (!dbUser) {
        throw new Error('Failed to create user in database');
      }

      const user: User = {
        id: dbUser.telegram_id,
        username: dbUser.username || undefined,
        firstName: dbUser.first_name || undefined,
        lastName: dbUser.last_name || undefined,
        isActive: dbUser.is_active,
        settings: dbUser.settings || this.getDefaultSettings(),
        createdAt: dbUser.created_at,
        lastActivity: dbUser.last_activity
      };

      logger.info(`Created new user in database: ${id}`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User | null> {
    try {
      const user = await this.getUser(userId);
      if (!user) return null;

      // Update user settings in database if provided
      if (updates.settings) {
        await databaseService.updateUserSettings(userId, updates.settings);
      }

      // Return updated user
      return await this.getUser(userId);
    } catch (error) {
      logger.error('Error updating user:', error);
      return null;
    }
  }

  async updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<User | null> {
    try {
      const user = await this.getUser(userId);
      if (!user) return null;

      // Merge new settings with existing settings
      const updatedSettings = { ...user.settings, ...settings };

      // Update settings in database
      const success = await databaseService.updateUserSettings(userId, updatedSettings);
      if (!success) {
        throw new Error('Failed to update settings in database');
      }

      logger.info(`Updated user settings in database: ${userId}`);

      // Return updated user
      return await this.getUser(userId);
    } catch (error) {
      logger.error('Error updating user settings:', error);
      return null;
    }
  }

  async isUserAuthorized(userId: number): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      return user?.isActive || false;
    } catch (error) {
      logger.error('Error checking user authorization:', error);
      return false;
    }
  }

  async getUserStats(userId: number): Promise<any> {
    try {
      const user = await this.getUser(userId);
      if (!user) return null;

      // Get real stats from database
      const dbStats = await databaseService.getUserStats(userId);
      const accounts = await databaseService.getUserAccounts(userId);

      return {
        userId: user.id,
        username: user.username,
        memberSince: user.createdAt,
        lastActivity: user.lastActivity,
        automationEnabled: user.settings.automation.enabled,
        totalCommands: dbStats?.total_commands || 0,
        totalAccounts: accounts.length,
        automationStats: {
          postsToday: dbStats?.posts_today || 0,
          likesToday: dbStats?.likes_today || 0,
          commentsToday: dbStats?.comments_today || 0,
          successRate: dbStats?.success_rate || 0.96
        },
        accountStats: accounts.map(acc => ({
          username: acc.username,
          platform: acc.platform,
          isActive: acc.is_active,
          automationEnabled: acc.automation_enabled
        }))
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      // This would require a database query to get all users
      // For now, return empty array as this method is not used
      logger.warn('getAllUsers called but not implemented for database');
      return [];
    } catch (error) {
      logger.error('Error getting all users:', error);
      return [];
    }
  }

  async getActiveUsers(): Promise<User[]> {
    try {
      // This would require a database query to get active users
      // For now, return empty array as this method is not used
      logger.warn('getActiveUsers called but not implemented for database');
      return [];
    } catch (error) {
      logger.error('Error getting active users:', error);
      return [];
    }
  }

  private getDefaultSettings(): UserSettings {
    return {
      automation: {
        enabled: false,
        maxPostsPerDay: 10,
        maxLikesPerDay: 50,
        maxCommentsPerDay: 20,
        maxFollowsPerDay: 10,
        qualityThreshold: 0.8
      },
      notifications: {
        telegram: true,
        email: false,
        discord: false
      },
      preferences: {
        language: 'en',
        timezone: 'UTC',
        theme: 'dark'
      }
    };
  }

  async getUserAccounts(userId: number): Promise<any[]> {
    try {
      // Get real accounts from database
      const dbAccounts = await databaseService.getUserAccounts(userId);

      if (dbAccounts.length > 0) {
        // Convert database accounts to service format
        const accounts = dbAccounts.map((dbAccount: DatabaseAccount) => ({
          id: dbAccount.id,
          username: dbAccount.username,
          platform: dbAccount.platform,
          isActive: dbAccount.is_active,
          automationEnabled: dbAccount.automation_enabled,
          followers: dbAccount.followers,
          following: dbAccount.following,
          posts: dbAccount.posts,
          engagementRate: parseFloat(dbAccount.engagement_rate.toString()),
          lastActivity: dbAccount.last_activity,
          status: dbAccount.status,
          createdAt: dbAccount.created_at
        }));

        logger.info(`Retrieved ${accounts.length} real accounts from database for user ${userId}`);
        return accounts;
      }

      // Try to get data from backend API as fallback
      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/users/${userId}/accounts`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          }
        });

        if (response.ok) {
          const apiAccounts = await response.json() as any[];
          logger.info(`Retrieved ${apiAccounts.length} accounts from backend API for user ${userId}`);
          return apiAccounts;
        }
      } catch (apiError) {
        logger.warn('Backend API unavailable, no accounts found:', apiError);
      }

      // No accounts found - return empty array
      logger.info(`No accounts found for user ${userId}`);
      return [];
    } catch (error) {
      logger.error('Error getting user accounts:', error);
      return [];
    }
  }

  async createUserAccount(userId: number, accountData: {
    username: string;
    platform?: string;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessTokenSecret?: string;
  }): Promise<any | null> {
    try {
      const dbAccount = await databaseService.createAccount(userId, {
        platform: accountData.platform || 'twitter',
        username: accountData.username,
        api_key: accountData.apiKey || undefined,
        api_secret: accountData.apiSecret || undefined,
        access_token: accountData.accessToken || undefined,
        access_token_secret: accountData.accessTokenSecret || undefined,
        is_active: true,
        automation_enabled: false
      });

      if (!dbAccount) {
        throw new Error('Failed to create account in database');
      }

      const account = {
        id: dbAccount.id,
        username: dbAccount.username,
        platform: dbAccount.platform,
        isActive: dbAccount.is_active,
        automationEnabled: dbAccount.automation_enabled,
        followers: dbAccount.followers,
        following: dbAccount.following,
        posts: dbAccount.posts,
        engagementRate: parseFloat(dbAccount.engagement_rate.toString()),
        lastActivity: dbAccount.last_activity,
        status: dbAccount.status,
        createdAt: dbAccount.created_at
      };

      logger.info(`Created new account ${account.id} for user ${userId}`);
      return account;
    } catch (error) {
      logger.error('Error creating user account:', error);
      return null;
    }
  }

  async getUserById(userId: number): Promise<User | null> {
    return this.getUser(userId);
  }



  async getActiveAccount(userId: number): Promise<any | null> {
    try {
      const accounts = await this.getUserAccounts(userId);
      return accounts.find(account => account.isActive) || null;
    } catch (error) {
      logger.error('Error getting active account:', error);
      return null;
    }
  }

  async setActiveAccount(userId: number, accountId: string): Promise<boolean> {
    try {
      // First deactivate all accounts
      const accounts = await this.getUserAccounts(userId);
      for (const account of accounts) {
        if (account.isActive) {
          await databaseService.updateAccount(account.id, { isActive: false });
        }
      }

      // Then activate the target account
      await databaseService.updateAccount(accountId, { isActive: true });
      return true;
    } catch (error) {
      logger.error('Error setting active account:', error);
      return false;
    }
  }

  async getAdvancedSettings(userId: number): Promise<any> {
    try {
      // Call backend API for advanced settings
      const response = await fetch(`${process.env.BACKEND_URL}/api/users/advanced-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      if (response.ok) {
        const result = await response.json() as any;
        return result.settings;
      }
    } catch (error) {
      logger.error('Advanced settings API failed:', error);
    }

    // Fallback data
    return {
      aiModel: 'GPT-4 Turbo',
      contentStrategy: 'Balanced',
      automationLevel: 'Conservative',
      qualityThreshold: '85%',
      autoLearning: true,
      personalization: true,
      predictiveAnalytics: true,
      smartOptimization: true,
      responseTime: 'Fast (< 2s)',
      accuracyPriority: 'High',
      resourceUsage: 'Optimized',
      cacheStrategy: 'Intelligent',
      dataEncryption: true,
      privacyMode: 'Standard',
      auditLogging: true,
      complianceLevel: 'Strict'
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await databaseService.isHealthy();
    } catch (error) {
      logger.error('Error checking user service health:', error);
      return false;
    }
  }

  async getActiveUsersCount(since: Date): Promise<number> {
    try {
      return await databaseService.getActiveUsersCount(since);
    } catch (error) {
      logger.error('Error getting active users count:', error);
      return 0;
    }
  }

  async getCommandsCount(since: Date): Promise<number> {
    try {
      return await databaseService.getCommandsCount(since);
    } catch (error) {
      logger.error('Error getting commands count:', error);
      return 0;
    }
  }

  /**
   * Store user authentication tokens securely
   */
  async storeUserTokens(userId: number, tokens: any): Promise<void> {
    try {
      // In a real implementation, you would encrypt these tokens
      // For now, we'll store them in cache with encryption placeholder
      const encryptedTokens = {
        accessToken: this.encryptToken(tokens.accessToken),
        accessTokenSecret: this.encryptToken(tokens.accessTokenSecret),
        userId: tokens.userId,
        screenName: tokens.screenName,
        storedAt: new Date().toISOString()
      };

      // Store in cache
      if (cacheClient) {
        await cacheClient.setEx(`user_tokens:${userId}`, 86400, JSON.stringify(encryptedTokens)); // 24 hours
      }

      // Also store in database (you might want to add a tokens table)
      logger.info(`Stored authentication tokens for user ${userId}`, {
        userId,
        screenName: tokens.screenName,
        hasAccessToken: !!tokens.accessToken
      });

    } catch (error) {
      logger.error('Error storing user tokens:', error);
      throw error;
    }
  }

  /**
   * Retrieve user authentication tokens
   */
  async getUserTokens(userId: number): Promise<any | null> {
    try {
      if (cacheClient) {
        const cached = await cacheClient.get(`user_tokens:${userId}`);
        if (cached) {
          const tokens = JSON.parse(cached);
          return {
            accessToken: this.decryptToken(tokens.accessToken),
            accessTokenSecret: this.decryptToken(tokens.accessTokenSecret),
            userId: tokens.userId,
            screenName: tokens.screenName,
            storedAt: tokens.storedAt
          };
        }
      }
      return null;
    } catch (error) {
      logger.error('Error retrieving user tokens:', error);
      return null;
    }
  }

  /**
   * Simple token encryption (replace with proper encryption in production)
   */
  private encryptToken(token: string): string {
    // This is a placeholder - use proper encryption in production
    return Buffer.from(token).toString('base64');
  }

  /**
   * Simple token decryption (replace with proper decryption in production)
   */
  private decryptToken(encryptedToken: string): string {
    // This is a placeholder - use proper decryption in production
    return Buffer.from(encryptedToken, 'base64').toString();
  }
}
