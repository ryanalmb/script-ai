// Legacy command handler - now using modular approach
// This file is kept for backward compatibility
// The new modular handlers are in the NewCommandHandler

import TelegramBot from 'node-telegram-bot-api';
import { UserService } from '../services/userService';
import { AnalyticsService } from '../services/analyticsService';
import { NotificationService } from '../services/notificationService';
import { AutomationService } from '../services/automationService';
import { ContentGenerationService } from '../services/contentGenerationService';
import { NewCommandHandler } from './NewCommandHandler';
import { logger } from '../utils/logger';

export class BotCommandHandler {
  private newHandler: NewCommandHandler;

  constructor(
    bot: TelegramBot,
    userService: UserService,
    analyticsService: AnalyticsService,
    automationService: AutomationService,
    contentService: ContentGenerationService,
    notificationService: NotificationService
  ) {
    // Initialize the new modular command handler
    this.newHandler = new NewCommandHandler(
      bot,
      userService,
      analyticsService,
      automationService,
      contentService,
      notificationService
    );
  }

  async handleMessage(msg: TelegramBot.Message): Promise<void> {
    // Delegate to the new modular handler
    return this.newHandler.handleMessage(msg);
  }

  // Expose methods for backward compatibility
  public getAllCommands(): string[] {
    return this.newHandler.getAllCommands();
  }

  public async getCommandStats(): Promise<any> {
    return this.newHandler.getCommandStats();
  }
}
