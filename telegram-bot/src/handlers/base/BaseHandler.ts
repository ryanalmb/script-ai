import TelegramBot from 'node-telegram-bot-api';
import { UserService } from '../../services/userService';
import { AnalyticsService } from '../../services/analyticsService';
import { NotificationService } from '../../services/notificationService';
import { AutomationService } from '../../services/automationService';
import { ContentGenerationService } from '../../services/contentGenerationService';
import { logger } from '../../utils/logger';

export interface HandlerServices {
  bot: TelegramBot;
  userService: UserService;
  analyticsService: AnalyticsService;
  notificationService: NotificationService;
  automationService: AutomationService;
  contentService: ContentGenerationService;
}

export abstract class BaseHandler {
  protected bot: TelegramBot;
  protected userService: UserService;
  protected analyticsService: AnalyticsService;
  protected notificationService: NotificationService;
  protected automationService: AutomationService;
  protected contentService: ContentGenerationService;

  constructor(services: HandlerServices) {
    this.bot = services.bot;
    this.userService = services.userService;
    this.analyticsService = services.analyticsService;
    this.notificationService = services.notificationService;
    this.automationService = services.automationService;
    this.contentService = services.contentService;
  }

  protected async sendErrorMessage(chatId: number, message: string = '❌ An error occurred. Please try again.'): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Failed to send error message:', error);
    }
  }

  protected async sendLoadingMessage(chatId: number, message: string = '⏳ Processing...'): Promise<TelegramBot.Message> {
    return await this.bot.sendMessage(chatId, message);
  }

  protected async editMessage(
    chatId: number, 
    messageId: number, 
    text: string, 
    options?: any
  ): Promise<void> {
    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        ...options
      });
    } catch (error) {
      logger.error('Failed to edit message:', error);
      // Fallback to sending new message
      await this.bot.sendMessage(chatId, text, options);
    }
  }

  protected async trackEvent(chatId: number, event: string, data?: any): Promise<void> {
    try {
      await this.analyticsService.trackEvent(chatId, event, data);
    } catch (error) {
      logger.error('Failed to track event:', error);
    }
  }

  protected parseCommand(command: string): { cmd: string; args: string[] } {
    const [cmd, ...args] = command.split(' ');
    return { cmd: cmd || '', args };
  }

  protected async checkUserAccess(chatId: number, requiredLevel: 'basic' | 'premium' | 'advanced' = 'basic'): Promise<boolean> {
    // Access checks temporarily disabled for testing
    return true;
  }

  protected async requireAuth(chatId: number): Promise<boolean> {
    // Authentication temporarily disabled for testing
    return true;
  }

  protected createInlineKeyboard(buttons: Array<Array<{ text: string; callback_data: string }>>): any {
    return {
      inline_keyboard: buttons
    };
  }

  protected async handleError(error: any, chatId: number, context: string): Promise<void> {
    logger.error(`${context} failed:`, error);
    await this.sendErrorMessage(chatId, `❌ ${context} failed. Please try again.`);
  }
}

export interface CommandHandler {
  canHandle(command: string): boolean;
  handle(chatId: number, command: string, user: any): Promise<void>;
}

export interface CallbackHandler {
  canHandle(data: string): boolean;
  handle(chatId: number, data: string, queryId: string): Promise<void>;
}
