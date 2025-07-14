import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { backendIntegration, ContentTemplate, GeneratedContent, AnalyticsData } from './backendIntegrationService';
import { enhancedUserService, EnhancedUserProfile } from './enhancedUserService';
import { extractUserProfile } from '../utils/userDataUtils';

export interface BotIntegrationConfig {
  enableAnalytics: boolean;
  enableContentGeneration: boolean;
  enableTemplates: boolean;
  enableUserSync: boolean;
  syncInterval: number;
}

export interface ContentGenerationRequest {
  telegramUserId: number;
  prompt: string;
  type: 'post' | 'thread' | 'reply' | 'bio' | 'hashtags';
  options?: {
    tone?: 'professional' | 'casual' | 'humorous' | 'serious';
    length?: 'short' | 'medium' | 'long';
    includeHashtags?: boolean;
    includeEmojis?: boolean;
    platform?: 'twitter' | 'linkedin' | 'instagram';
  };
}

export interface AnalyticsRequest {
  telegramUserId: number;
  period: '1d' | '7d' | '30d' | '90d';
  metrics?: string[];
}

export class BotBackendIntegration {
  private bot: TelegramBot;
  private config: BotIntegrationConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor(bot: TelegramBot, config: Partial<BotIntegrationConfig> = {}) {
    this.bot = bot;
    this.config = {
      enableAnalytics: true,
      enableContentGeneration: true,
      enableTemplates: true,
      enableUserSync: true,
      syncInterval: 300000, // 5 minutes
      ...config
    };
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    try {
      // Check backend health
      const isHealthy = await backendIntegration.checkHealth();
      if (!isHealthy) {
        logger.warn('Backend is not healthy, some features may be limited');
      }

      // Start periodic sync if enabled
      if (this.config.enableUserSync) {
        this.startPeriodicSync();
      }

      this.isInitialized = true;
      logger.info('Bot-Backend integration initialized', {
        config: this.config,
        backendHealthy: isHealthy
      });
    } catch (error) {
      logger.error('Failed to initialize bot-backend integration:', error);
      throw error;
    }
  }

  /**
   * Handle user interaction and sync with backend
   */
  async handleUserInteraction(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Update user activity
      await enhancedUserService.updateUserActivity(telegramUserId, action, metadata);

      // Log to backend if analytics enabled
      if (this.config.enableAnalytics) {
        const token = await enhancedUserService.getBackendToken(telegramUserId);
        await backendIntegration.logActivity(telegramUserId, action, metadata, token || undefined);
      }
    } catch (error) {
      logger.error('Failed to handle user interaction:', error);
    }
  }

  /**
   * Generate content using backend AI
   */
  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent | null> {
    try {
      if (!this.config.enableContentGeneration) {
        logger.warn('Content generation is disabled');
        return null;
      }

      const token = await enhancedUserService.getBackendToken(request.telegramUserId);
      
      const content = await backendIntegration.generateContent(
        request.prompt,
        request.type,
        request.options || {},
        token || undefined
      );

      if (content) {
        // Log the generation activity
        await this.handleUserInteraction(request.telegramUserId, 'content_generated', {
          type: request.type,
          prompt: request.prompt.substring(0, 100), // Log first 100 chars
          contentId: content.id
        });
      }

      return content;
    } catch (error) {
      logger.error('Failed to generate content:', error);
      return null;
    }
  }

  /**
   * Get content templates
   */
  async getContentTemplates(
    telegramUserId: number,
    category?: string
  ): Promise<ContentTemplate[]> {
    try {
      if (!this.config.enableTemplates) {
        logger.warn('Templates are disabled');
        return [];
      }

      const token = await enhancedUserService.getBackendToken(telegramUserId);
      
      const templates = await backendIntegration.getContentTemplates(
        category,
        token || undefined
      );

      // Log template access
      await this.handleUserInteraction(telegramUserId, 'templates_accessed', {
        category,
        count: templates.length
      });

      return templates;
    } catch (error) {
      logger.error('Failed to get content templates:', error);
      return [];
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(request: AnalyticsRequest): Promise<AnalyticsData | null> {
    try {
      if (!this.config.enableAnalytics) {
        logger.warn('Analytics are disabled');
        return null;
      }

      const token = await enhancedUserService.getBackendToken(request.telegramUserId);
      
      const analytics = await backendIntegration.getAnalytics(
        request.telegramUserId,
        request.period,
        token || undefined
      );

      if (analytics) {
        // Log analytics access
        await this.handleUserInteraction(request.telegramUserId, 'analytics_viewed', {
          period: request.period,
          metrics: request.metrics
        });
      }

      return analytics;
    } catch (error) {
      logger.error('Failed to get user analytics:', error);
      return null;
    }
  }

  /**
   * Sync user data with backend
   */
  async syncUserData(telegramUserId: number): Promise<boolean> {
    try {
      const user = await enhancedUserService.getEnhancedUserProfile(telegramUserId);
      if (!user) {
        logger.warn('User not found for sync', { telegramUserId });
        return false;
      }

      // Update backend with latest user data
      const token = await enhancedUserService.getBackendToken(telegramUserId);
      if (!token) {
        logger.warn('No backend token for user sync', { telegramUserId });
        return false;
      }

      const profileData = extractUserProfile(user);

      const success = await backendIntegration.updateUserProfile(
        telegramUserId,
        profileData,
        token
      );

      if (success) {
        logger.debug('User data synced successfully', { telegramUserId });
      }

      return success;
    } catch (error) {
      logger.error('Failed to sync user data:', error);
      return false;
    }
  }

  /**
   * Send notification via Telegram
   */
  async sendNotification(
    telegramUserId: number,
    message: string,
    options: {
      type?: 'info' | 'warning' | 'error' | 'success';
      buttons?: Array<{ text: string; callback_data: string }>;
      silent?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      const emoji = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅'
      }[options.type || 'info'];

      const formattedMessage = `${emoji} ${message}`;

      const messageOptions: any = {
        parse_mode: 'Markdown'
      };

      if (options.buttons && options.buttons.length > 0) {
        messageOptions.reply_markup = {
          inline_keyboard: [options.buttons]
        };
      }

      if (options.silent) {
        messageOptions.disable_notification = true;
      }

      await this.bot.sendMessage(telegramUserId, formattedMessage, messageOptions);

      // Log notification
      await this.handleUserInteraction(telegramUserId, 'notification_sent', {
        type: options.type,
        hasButtons: !!options.buttons?.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Handle authentication success
   */
  async handleAuthenticationSuccess(
    telegramUserId: number,
    tokens: {
      accessToken: string;
      accessTokenSecret: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
    userInfo: {
      username: string;
      displayName: string;
      verified: boolean;
      followerCount?: number;
      followingCount?: number;
    }
  ): Promise<void> {
    try {
      // Store tokens
      await enhancedUserService.storeUserTokens(telegramUserId, tokens);

      // Log authentication success
      await this.handleUserInteraction(telegramUserId, 'authentication_success', {
        platform: 'twitter',
        username: userInfo.username,
        verified: userInfo.verified,
        followerCount: userInfo.followerCount
      });

      // Send success notification
      await this.sendNotification(
        telegramUserId,
        `🎉 Successfully authenticated as @${userInfo.username}!\n\n` +
        `✅ Verified: ${userInfo.verified ? 'Yes' : 'No'}\n` +
        `👥 Followers: ${userInfo.followerCount?.toLocaleString() || 'N/A'}\n\n` +
        `You can now use all platform features!`,
        {
          type: 'success',
          buttons: [
            { text: '📊 View Dashboard', callback_data: 'dashboard_main' },
            { text: '🎨 Create Content', callback_data: 'content_generate' }
          ]
        }
      );
    } catch (error) {
      logger.error('Failed to handle authentication success:', error);
    }
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    backendHealthy: boolean;
    config: BotIntegrationConfig;
    userCount: number;
  } {
    return {
      initialized: this.isInitialized,
      backendHealthy: backendIntegration.getHealthStatus(),
      config: this.config,
      userCount: 0 // Could be implemented to track active users
    };
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        // Sync health check
        const isHealthy = await backendIntegration.checkHealth();
        if (!isHealthy) {
          logger.warn('Backend health check failed during periodic sync');
          return;
        }

        logger.debug('Periodic sync completed');
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, this.config.syncInterval);

    logger.info('Periodic sync started', { interval: this.config.syncInterval });
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Periodic sync stopped');
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicSync();
    backendIntegration.destroy();
    this.isInitialized = false;
    logger.info('Bot-Backend integration destroyed');
  }
}

// Export for use in bot initialization
// export { BotBackendIntegration }; // Already exported above
