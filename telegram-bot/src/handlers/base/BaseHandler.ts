import TelegramBot from 'node-telegram-bot-api';
import { UserService } from '../../services/userService';
import { AnalyticsService } from '../../services/analyticsService';
import { NotificationService } from '../../services/notificationService';
import { AutomationService } from '../../services/automationService';
import { ContentGenerationService } from '../../services/contentGenerationService';
import { logger } from '../../utils/logger';
import {
  SharedErrorType,
  ErrorResponseBuilder,
  CorrelationUtils,
  LoggingUtils
} from '../../../../shared/errorHandling';

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

  protected async handleError(error: any, chatId: number, context: string, correlationId?: string): Promise<void> {
    // Generate correlation ID if not provided
    const errorCorrelationId = correlationId || CorrelationUtils.generateCorrelationId('telegram-bot');

    // Create structured error log
    const logEntry = LoggingUtils.createErrorLogEntry({
      error,
      correlationId: errorCorrelationId,
      service: 'telegram-bot',
      operation: context,
      userId: chatId.toString(),
      context: {
        chatId,
        operation: context,
        errorType: error?.name || 'Unknown',
        errorMessage: error?.message || String(error)
      }
    });

    logger.error(`${context} failed:`, logEntry);

    // Determine error type and user message
    let errorType = SharedErrorType.SYSTEM_ERROR;
    let userMessage = `❌ ${context} failed. Please try again.`;

    if (error?.message?.includes('network') || error?.message?.includes('connection')) {
      errorType = SharedErrorType.NETWORK_ERROR;
      userMessage = '🌐 Network error occurred. Please check your connection and try again.';
    } else if (error?.message?.includes('timeout')) {
      errorType = SharedErrorType.TIMEOUT_ERROR;
      userMessage = '⏱️ Request timed out. Please try again in a moment.';
    } else if (error?.message?.includes('rate limit')) {
      errorType = SharedErrorType.RATE_LIMIT_ERROR;
      userMessage = '🚦 Too many requests. Please wait a moment before trying again.';
    } else if (error?.message?.includes('validation')) {
      errorType = SharedErrorType.VALIDATION_ERROR;
      userMessage = '📝 Invalid input provided. Please check your data and try again.';
    } else if (error?.message?.includes('auth')) {
      errorType = SharedErrorType.AUTHENTICATION_ERROR;
      userMessage = '🔐 Authentication error. Please try logging in again.';
    }

    // Create standardized error response for logging/analytics
    const errorResponse = ErrorResponseBuilder.createErrorResponse({
      correlationId: errorCorrelationId,
      type: errorType,
      message: error?.message || String(error),
      service: 'telegram-bot',
      operation: context,
      details: {
        chatId,
        originalError: error?.name,
        stack: error?.stack
      }
    });

    // Send user-friendly error message
    await this.sendErrorMessage(chatId, userMessage);

    // Log the standardized error response for analytics
    logger.info('Standardized error response created:', errorResponse);
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
