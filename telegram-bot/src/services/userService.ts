import { logger } from '../utils/logger';

export interface User {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
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
  };
  notifications: {
    telegram: boolean;
    email: boolean;
    discord: boolean;
  };
  preferences: {
    language: string;
    timezone: string;
    theme: string;
  };
}

export class UserService {
  private users: Map<number, User> = new Map();

  async getUser(userId: number): Promise<User | null> {
    try {
      let user = this.users.get(userId);
      
      if (!user) {
        // Create new user with default settings
        user = {
          id: userId,
          isActive: true,
          settings: this.getDefaultSettings(),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        this.users.set(userId, user);
        logger.info(`Created new user: ${userId}`);
      } else {
        // Update last activity
        user.lastActivity = new Date();
      }
      
      return user;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User | null> {
    try {
      const user = await this.getUser(userId);
      if (!user) return null;

      Object.assign(user, updates);
      this.users.set(userId, user);
      
      logger.info(`Updated user: ${userId}`);
      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      return null;
    }
  }

  async updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<User | null> {
    try {
      const user = await this.getUser(userId);
      if (!user) return null;

      user.settings = { ...user.settings, ...settings };
      this.users.set(userId, user);
      
      logger.info(`Updated user settings: ${userId}`);
      return user;
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

      return {
        userId: user.id,
        username: user.username,
        memberSince: user.createdAt,
        lastActivity: user.lastActivity,
        automationEnabled: user.settings.automation.enabled,
        totalCommands: 0, // Would be tracked in real implementation
        automationStats: {
          postsToday: 0,
          likesToday: 0,
          commentsToday: 0,
          successRate: 0.96
        }
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return Array.from(this.users.values());
    } catch (error) {
      logger.error('Error getting all users:', error);
      return [];
    }
  }

  async getActiveUsers(): Promise<User[]> {
    try {
      return Array.from(this.users.values()).filter(user => user.isActive);
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
}
