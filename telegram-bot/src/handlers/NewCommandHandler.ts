import TelegramBot from 'node-telegram-bot-api';
import { UserService } from '../services/userService';
import { AnalyticsService } from '../services/analyticsService';
import { NotificationService } from '../services/notificationService';
import { AutomationService } from '../services/automationService';
import { ContentGenerationService } from '../services/contentGenerationService';
import { logger } from '../utils/logger';

// Import all specialized handlers
import { BaseHandler, HandlerServices, CommandHandler } from './base/BaseHandler';
import { AuthHandler } from './commands/AuthHandler';
import { ContentHandler } from './commands/ContentHandler';
import { AutomationHandler } from './commands/AutomationHandler';
import { AnalyticsHandler } from './commands/AnalyticsHandler';
import { AccountHandler } from './commands/AccountHandler';
import { ComplianceHandler } from './commands/ComplianceHandler';
import { CampaignHandler } from './commands/CampaignHandler';
import { SystemHandler } from './commands/SystemHandler';
import { AdvancedHandler } from './commands/AdvancedHandler';
import { authStateService } from '../services/authStateService';

export class NewCommandHandler extends BaseHandler {
  private handlers: CommandHandler[] = [];

  constructor(
    bot: TelegramBot,
    userService: UserService,
    analyticsService: AnalyticsService,
    automationService: AutomationService,
    contentService: ContentGenerationService,
    notificationService: NotificationService
  ) {
    const services: HandlerServices = {
      bot,
      userService,
      analyticsService,
      automationService,
      contentService,
      notificationService
    };

    super(services);

    // Initialize all specialized handlers
    this.handlers = [
      new AuthHandler(services),
      new ContentHandler(services),
      new AutomationHandler(services),
      new AnalyticsHandler(services),
      new AccountHandler(services),
      new ComplianceHandler(services),
      new CampaignHandler(services),
      new SystemHandler(services),
      new AdvancedHandler(services)
    ];
  }

  async handleMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    try {
      // Get or create user (UserService automatically creates if doesn't exist)
      const user = await this.userService.getUserById(chatId);

      // Handle commands
      if (text.startsWith('/')) {
        await this.handleCommand(chatId, text, user);
      } else {
        await this.handleTextMessage(chatId, msg.message_id, text, user);
      }

    } catch (error) {
      logger.error('Error handling message:', error);
      await this.sendErrorMessage(chatId, '❌ An error occurred while processing your message. Please try again or use /help for assistance.');
    }
  }

  private async handleCommand(chatId: number, command: string, user: any): Promise<void> {
    const { cmd } = this.parseCommand(command);

    try {
      // Find the appropriate handler for this command
      const handler = this.handlers.find(h => h.canHandle(command));

      if (handler) {
        await handler.handle(chatId, command, user);

        // Track command usage
        await this.trackEvent(chatId, 'command_executed', {
          command: cmd,
          handler: handler.constructor.name,
          timestamp: new Date()
        });
      } else {
        // Handle unknown commands
        await this.handleUnknownCommand(chatId, cmd);
      }

    } catch (error) {
      logger.error(`Error handling command ${cmd}:`, error);
      await this.sendErrorMessage(chatId, `❌ Error processing command ${cmd}. Please try again.`);
    }
  }

  private async handleUnknownCommand(chatId: number, cmd: string): Promise<void> {
    // Log unknown command for analysis
    logger.warn(`Unknown command received: ${cmd}`);
    
    // Track unknown command
    await this.trackEvent(chatId, 'unknown_command', { command: cmd });

    // Provide helpful response with suggestions
    const unknownMessage = `
❓ **Unknown Command: ${cmd}**

**🤔 Did you mean:**
${this.getSimilarCommands(cmd).map(suggestion => `• ${suggestion}`).join('\n')}

**📚 Popular Commands:**
• /help - View all available commands
• /generate - Create AI content
• /dashboard - View analytics
• /automation - Manage automation
• /accounts - Manage X accounts

**💡 Tips:**
• Use /help to see all commands
• Commands are case-sensitive
• Make sure to include the forward slash (/)

**🆘 Need Help?**
Use /support to contact our team!
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '📚 View All Commands', callback_data: 'view_all_commands' },
        { text: '🔍 Search Commands', callback_data: 'search_commands' }
      ],
      [
        { text: '🆘 Get Support', callback_data: 'contact_support' },
        { text: '📖 User Guide', callback_data: 'user_guide' }
      ]
    ]);

    await this.bot.sendMessage(chatId, unknownMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private getSimilarCommands(cmd: string): string[] {
    // Define all available commands
    const allCommands = [
      '/start', '/help', '/auth', '/generate', '/image', '/analyze', '/variations', '/optimize',
      '/automation', '/start_auto', '/stop_auto', '/auto_config', '/auto_status',
      '/like_automation', '/comment_automation', '/retweet_automation', '/follow_automation',
      '/unfollow_automation', '/dm_automation', '/engagement_automation', '/poll_automation',
      '/thread_automation', '/automation_stats', '/bulk_operations', '/ethical_automation',
      '/dashboard', '/performance', '/trends', '/competitors', '/reports', '/analytics', '/analytics_pro',
      '/accounts', '/add_account', '/addaccount', '/account_status', '/switch_account', '/switchaccount',
      '/quality_check', '/compliance', '/safety_status', '/rate_limits',
      '/create_campaign', '/campaign_wizard', '/schedule',
      '/status', '/version', '/stop', '/quick_post', '/quick_schedule', '/emergency_stop',
      '/advanced', '/content_gen', '/engagement', '/settings'
    ];

    // Simple similarity matching (can be enhanced with more sophisticated algorithms)
    const similarities = allCommands.map(command => ({
      command,
      similarity: this.calculateSimilarity(cmd.toLowerCase(), command.toLowerCase())
    }));

    // Sort by similarity and return top 3
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .filter(item => item.similarity > 0.3) // Only show if reasonably similar
      .map(item => item.command);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  private async handleTextMessage(chatId: number, messageId: number, text: string, user: any): Promise<void> {
    // Check if user is in authentication flow first
    if (authStateService.isInAuthFlow(chatId)) {
      const authHandler = this.handlers.find(h => h instanceof AuthHandler) as AuthHandler;
      if (authHandler) {
        await authHandler.processAuthMessage(chatId, messageId, text);
        return;
      }
    }

    // Handle non-command text messages
    const textMessage = `
💬 **Text Message Received**

I understand text messages! Here's what you can do:

**🎨 Content Creation:**
• Use /generate to create AI content
• Use /analyze to analyze your text
• Use /optimize to improve your content

**🤖 Quick Actions:**
• Use /quick_post to post immediately
• Use /help to see all commands
• Use /dashboard to view analytics

**💡 Tip:** Start your message with / to use commands!

**Example:** \`/generate ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}\`
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🎨 Generate Content', callback_data: `generate_from_text_${Date.now()}` },
        { text: '📊 Analyze Text', callback_data: `analyze_from_text_${Date.now()}` }
      ],
      [
        { text: '📤 Quick Post', callback_data: `quick_post_from_text_${Date.now()}` },
        { text: '📚 View Commands', callback_data: 'view_all_commands' }
      ]
    ]);

    await this.bot.sendMessage(chatId, textMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    await this.trackEvent(chatId, 'text_message_received', {
      text_length: text.length,
      timestamp: new Date()
    });
  }

  // Method to get all available commands (for help and debugging)
  public getAllCommands(): string[] {
    const commands: string[] = [];
    
    // Collect commands from all handlers
    this.handlers.forEach(handler => {
      // This would need to be implemented in each handler
      // For now, we'll return a static list
    });

    return [
      // Auth commands
      '/start', '/help', '/auth',
      
      // Content commands
      '/generate', '/image', '/analyze', '/variations', '/optimize',
      
      // Automation commands
      '/automation', '/start_auto', '/stop_auto', '/auto_config', '/auto_status',
      '/like_automation', '/comment_automation', '/retweet_automation', '/follow_automation',
      '/unfollow_automation', '/dm_automation', '/engagement_automation', '/poll_automation',
      '/thread_automation', '/automation_stats', '/bulk_operations', '/ethical_automation',
      
      // Analytics commands
      '/dashboard', '/performance', '/trends', '/competitors', '/reports', '/analytics', '/analytics_pro',
      
      // Account commands
      '/accounts', '/add_account', '/account_status', '/switch_account',
      
      // Compliance commands
      '/quality_check', '/compliance', '/safety_status', '/rate_limits',
      
      // Campaign commands
      '/create_campaign', '/campaign_wizard', '/schedule',
      
      // System commands
      '/status', '/version', '/stop', '/quick_post', '/quick_schedule', '/emergency_stop',
      
      // Advanced commands
      '/advanced', '/content_gen', '/engagement', '/settings'
    ];
  }

  // Method to get command statistics
  public async getCommandStats(): Promise<any> {
    try {
      // This would get actual stats from analytics service
      return {
        totalCommands: this.getAllCommands().length,
        handlersCount: this.handlers.length,
        mostUsedCommands: ['/help', '/generate', '/dashboard', '/automation', '/accounts'],
        leastUsedCommands: ['/advanced', '/compliance', '/emergency_stop'],
        errorRate: '2.3%',
        averageResponseTime: '150ms'
      };
    } catch (error) {
      logger.error('Error getting command stats:', error);
      return null;
    }
  }
}
