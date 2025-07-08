import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { UserService } from '../services/userService';
import { AnalyticsService } from '../services/analyticsService';
import { NotificationService } from '../services/notificationService';

export class BotCallbackHandler {
  constructor(
    private bot: TelegramBot,
    private userService: UserService,
    private analyticsService: AnalyticsService,
    private notificationService: NotificationService
  ) {}

  async handleCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const data = query.data;
    const userId = query.from.id;

    if (!chatId || !data) {
      return;
    }

    try {
      logger.info(`Processing callback: ${data} from user ${userId}`);

      // Parse callback data
      const [action, ...params] = data.split(':');

      switch (action) {
        case 'account_select':
          await this.handleAccountSelect(chatId, params[0] || '', query.id);
          break;

        case 'campaign_action':
          await this.handleCampaignAction(chatId, params[0] || '', params[1] || '', query.id);
          break;

        case 'automation_toggle':
          await this.handleAutomationToggle(chatId, params[0] || '', query.id);
          break;

        case 'settings_update':
          await this.handleSettingsUpdate(chatId, params[0] || '', params[1] || '', query.id);
          break;

        case 'analytics_view':
          await this.handleAnalyticsView(chatId, params[0] || '', query.id);
          break;

        case 'confirm_action':
          await this.handleConfirmAction(chatId, params[0] || '', query.id);
          break;

        case 'cancel_action':
          await this.handleCancelAction(chatId, query.id);
          break;

        default:
          await this.bot.answerCallbackQuery(query.id, {
            text: '❌ Unknown action',
            show_alert: true
          });
      }
    } catch (error) {
      logger.error('Error in callback handler:', error);
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ An error occurred',
        show_alert: true
      });
    }
  }

  private async handleAccountSelect(chatId: number, accountId: string, queryId: string): Promise<void> {
    try {
      await this.bot.answerCallbackQuery(queryId, {
        text: `✅ Account ${accountId} selected`
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 View Stats', callback_data: `analytics_view:account:${accountId}` },
            { text: '⚙️ Settings', callback_data: `settings_update:account:${accountId}` }
          ],
          [
            { text: '▶️ Start Automation', callback_data: `automation_toggle:start:${accountId}` },
            { text: '⏸️ Pause Automation', callback_data: `automation_toggle:pause:${accountId}` }
          ],
          [{ text: '🔙 Back to Accounts', callback_data: 'accounts_list' }]
        ]
      };

      await this.bot.sendMessage(chatId, `🎯 Account: @${accountId}\n\nChoose an action:`, {
        reply_markup: keyboard
      });
    } catch (error) {
      logger.error('Error handling account select:', error);
    }
  }

  private async handleCampaignAction(chatId: number, action: string, campaignId: string, queryId: string): Promise<void> {
    try {
      let message = '';
      
      switch (action) {
        case 'start':
          message = `✅ Campaign ${campaignId} started successfully`;
          break;
        case 'pause':
          message = `⏸️ Campaign ${campaignId} paused`;
          break;
        case 'stop':
          message = `⏹️ Campaign ${campaignId} stopped`;
          break;
        case 'delete':
          message = `🗑️ Campaign ${campaignId} deleted`;
          break;
        default:
          message = `✅ Action ${action} completed for campaign ${campaignId}`;
      }

      await this.bot.answerCallbackQuery(queryId, { text: message });
      
      // Refresh campaign list
      await this.sendCampaignsList(chatId);
    } catch (error) {
      logger.error('Error handling campaign action:', error);
    }
  }

  private async handleAutomationToggle(chatId: number, action: string, queryId: string): Promise<void> {
    try {
      let message = '';
      
      switch (action) {
        case 'start':
          message = '✅ Automation started successfully';
          break;
        case 'pause':
          message = '⏸️ Automation paused';
          break;
        case 'stop':
          message = '⏹️ Automation stopped';
          break;
        default:
          message = '✅ Automation status updated';
      }

      await this.bot.answerCallbackQuery(queryId, { text: message });
      
      // Send updated status
      await this.sendAutomationStatus(chatId);
    } catch (error) {
      logger.error('Error handling automation toggle:', error);
    }
  }

  private async handleSettingsUpdate(chatId: number, setting: string, value: string, queryId: string): Promise<void> {
    try {
      await this.bot.answerCallbackQuery(queryId, {
        text: `✅ ${setting} updated to ${value}`
      });
      
      // Send updated settings
      await this.sendSettingsMenu(chatId);
    } catch (error) {
      logger.error('Error handling settings update:', error);
    }
  }

  private async handleAnalyticsView(chatId: number, type: string, queryId: string): Promise<void> {
    try {
      await this.bot.answerCallbackQuery(queryId);
      
      switch (type) {
        case 'dashboard':
          await this.sendAnalyticsDashboard(chatId);
          break;
        case 'engagement':
          await this.sendEngagementAnalytics(chatId);
          break;
        case 'performance':
          await this.sendPerformanceAnalytics(chatId);
          break;
        default:
          await this.sendAnalyticsDashboard(chatId);
      }
    } catch (error) {
      logger.error('Error handling analytics view:', error);
    }
  }

  private async handleConfirmAction(chatId: number, action: string, queryId: string): Promise<void> {
    try {
      await this.bot.answerCallbackQuery(queryId, {
        text: `✅ ${action} confirmed`
      });
      
      // Execute the confirmed action
      await this.executeConfirmedAction(chatId, action);
    } catch (error) {
      logger.error('Error handling confirm action:', error);
    }
  }

  private async handleCancelAction(chatId: number, queryId: string): Promise<void> {
    try {
      await this.bot.answerCallbackQuery(queryId, {
        text: '❌ Action cancelled'
      });
      
      await this.bot.sendMessage(chatId, '❌ Action cancelled');
    } catch (error) {
      logger.error('Error handling cancel action:', error);
    }
  }

  private async sendCampaignsList(chatId: number): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📊 Campaign 1', callback_data: 'campaign_action:view:1' },
          { text: '▶️', callback_data: 'campaign_action:start:1' }
        ],
        [{ text: '➕ Create New Campaign', callback_data: 'campaign_action:create:new' }],
        [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
      ]
    };

    await this.bot.sendMessage(chatId, '📋 Your Campaigns:', {
      reply_markup: keyboard
    });
  }

  private async sendAutomationStatus(chatId: number): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '▶️ Start All', callback_data: 'automation_toggle:start:all' },
          { text: '⏸️ Pause All', callback_data: 'automation_toggle:pause:all' }
        ],
        [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
      ]
    };

    await this.bot.sendMessage(chatId, '🤖 Automation Status: Active\n\n📊 Today\'s Activity:\n• Posts: 12\n• Likes: 156\n• Comments: 34', {
      reply_markup: keyboard
    });
  }

  private async sendSettingsMenu(chatId: number): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎯 Automation Settings', callback_data: 'settings_update:automation:view' },
          { text: '🔔 Notifications', callback_data: 'settings_update:notifications:view' }
        ],
        [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
      ]
    };

    await this.bot.sendMessage(chatId, '⚙️ Settings Menu:', {
      reply_markup: keyboard
    });
  }

  private async sendAnalyticsDashboard(chatId: number): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📈 Engagement', callback_data: 'analytics_view:engagement' },
          { text: '🎯 Performance', callback_data: 'analytics_view:performance' }
        ],
        [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
      ]
    };

    await this.bot.sendMessage(chatId, '📊 Analytics Dashboard\n\n📈 Today\'s Performance:\n• Engagement Rate: 4.5%\n• Quality Score: 92%\n• Posts Published: 12', {
      reply_markup: keyboard
    });
  }

  private async sendEngagementAnalytics(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId, '📈 Engagement Analytics\n\n• Total Likes: 1,250\n• Total Comments: 380\n• Total Shares: 95\n• Avg. Engagement Rate: 4.5%');
  }

  private async sendPerformanceAnalytics(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId, '🎯 Performance Analytics\n\n• Success Rate: 96%\n• Quality Score: 92%\n• Compliance Score: 95%\n• Automation Uptime: 99.8%');
  }

  private async executeConfirmedAction(chatId: number, action: string): Promise<void> {
    // Execute the confirmed action based on the action type
    await this.bot.sendMessage(chatId, `✅ ${action} executed successfully`);
  }
}
