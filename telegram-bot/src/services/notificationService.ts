import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';

export interface NotificationConfig {
  userId: number;
  enabled: boolean;
  types: {
    automation: boolean;
    errors: boolean;
    performance: boolean;
    campaigns: boolean;
    system: boolean;
  };
}

export class NotificationService {
  private notifications: Map<number, NotificationConfig> = new Map();
  private isStarted = false;

  constructor(private bot: TelegramBot) {}

  async start(): Promise<void> {
    if (this.isStarted) return;

    try {
      // Start periodic notifications
      this.startPeriodicNotifications();
      this.isStarted = true;
      logger.info('Notification service started');
    } catch (error) {
      logger.error('Error starting notification service:', error);
    }
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    logger.info('Notification service stopped');
  }

  async enableNotifications(userId: number, types?: Partial<NotificationConfig['types']>): Promise<void> {
    try {
      const config: NotificationConfig = {
        userId,
        enabled: true,
        types: {
          automation: true,
          errors: true,
          performance: true,
          campaigns: true,
          system: true,
          ...types
        }
      };

      this.notifications.set(userId, config);
      logger.info(`Notifications enabled for user ${userId}`);
    } catch (error) {
      logger.error('Error enabling notifications:', error);
    }
  }

  async disableNotifications(userId: number): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (config) {
        config.enabled = false;
        this.notifications.set(userId, config);
      }
      logger.info(`Notifications disabled for user ${userId}`);
    } catch (error) {
      logger.error('Error disabling notifications:', error);
    }
  }

  async sendAutomationNotification(userId: number, message: string, data?: any): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (!config?.enabled || !config.types.automation) return;

      await this.bot.sendMessage(userId, `🤖 Automation Update\n\n${message}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending automation notification:', error);
    }
  }

  async sendErrorNotification(userId: number, error: string, details?: any): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (!config?.enabled || !config.types.errors) return;

      await this.bot.sendMessage(userId, `❌ Error Alert\n\n${error}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending error notification:', error);
    }
  }

  async sendPerformanceNotification(userId: number, message: string, stats?: any): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (!config?.enabled || !config.types.performance) return;

      await this.bot.sendMessage(userId, `📊 Performance Update\n\n${message}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending performance notification:', error);
    }
  }

  async sendCampaignNotification(userId: number, message: string, campaignData?: any): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (!config?.enabled || !config.types.campaigns) return;

      await this.bot.sendMessage(userId, `🎯 Campaign Update\n\n${message}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending campaign notification:', error);
    }
  }

  async sendSystemNotification(userId: number, message: string, systemData?: any): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (!config?.enabled || !config.types.system) return;

      await this.bot.sendMessage(userId, `⚙️ System Update\n\n${message}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending system notification:', error);
    }
  }

  async broadcastNotification(message: string, type: keyof NotificationConfig['types'] = 'system'): Promise<void> {
    try {
      const enabledUsers = Array.from(this.notifications.values())
        .filter(config => config.enabled && config.types[type]);

      for (const config of enabledUsers) {
        try {
          await this.bot.sendMessage(config.userId, `📢 Broadcast\n\n${message}`, {
            parse_mode: 'Markdown'
          });
        } catch (error) {
          logger.error(`Error sending broadcast to user ${config.userId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error broadcasting notification:', error);
    }
  }

  async sendDailySummary(userId: number): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (!config?.enabled || !config.types.performance) return;

      const summary = `📊 Daily Summary\n\n` +
        `🎯 Posts Published: 12\n` +
        `👍 Likes Generated: 156\n` +
        `💬 Comments Made: 34\n` +
        `👥 New Followers: 8\n` +
        `📈 Engagement Rate: 4.5%\n` +
        `⭐ Quality Score: 92%\n\n` +
        `🤖 Automation Status: Active\n` +
        `✅ Success Rate: 96%\n` +
        `⚠️ Errors Today: 2`;

      await this.bot.sendMessage(userId, summary, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending daily summary:', error);
    }
  }

  async sendWeeklySummary(userId: number): Promise<void> {
    try {
      const config = this.notifications.get(userId);
      if (!config?.enabled || !config.types.performance) return;

      const summary = `📊 Weekly Summary\n\n` +
        `🎯 Total Posts: 84\n` +
        `👍 Total Likes: 1,092\n` +
        `💬 Total Comments: 238\n` +
        `👥 New Followers: 56\n` +
        `📈 Avg Engagement Rate: 4.3%\n` +
        `⭐ Avg Quality Score: 91%\n\n` +
        `🏆 Best Performing Post: "Bitcoin analysis thread"\n` +
        `📅 Optimal Posting Time: 2:30 PM EST\n` +
        `🔥 Top Hashtags: #crypto #bitcoin #trading`;

      await this.bot.sendMessage(userId, summary, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('Error sending weekly summary:', error);
    }
  }

  private startPeriodicNotifications(): void {
    // Send daily summaries at 9 AM
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        this.sendDailySummariesToAll();
      }
    }, 60000); // Check every minute

    // Send weekly summaries on Mondays at 9 AM
    setInterval(() => {
      const now = new Date();
      if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
        this.sendWeeklySummariesToAll();
      }
    }, 60000); // Check every minute
  }

  private async sendDailySummariesToAll(): Promise<void> {
    const enabledUsers = Array.from(this.notifications.values())
      .filter(config => config.enabled && config.types.performance);

    for (const config of enabledUsers) {
      try {
        await this.sendDailySummary(config.userId);
      } catch (error) {
        logger.error(`Error sending daily summary to user ${config.userId}:`, error);
      }
    }
  }

  private async sendWeeklySummariesToAll(): Promise<void> {
    const enabledUsers = Array.from(this.notifications.values())
      .filter(config => config.enabled && config.types.performance);

    for (const config of enabledUsers) {
      try {
        await this.sendWeeklySummary(config.userId);
      } catch (error) {
        logger.error(`Error sending weekly summary to user ${config.userId}:`, error);
      }
    }
  }
}
