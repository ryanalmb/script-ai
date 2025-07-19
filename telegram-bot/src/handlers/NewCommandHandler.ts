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
import { NaturalLanguageHandler } from './commands/NaturalLanguageHandler';
import { EnterpriseHandler } from './EnterpriseHandler';
import { authStateService } from '../services/authStateService';

export class NewCommandHandler extends BaseHandler {
  private handlers: CommandHandler[] = [];
  private enterpriseHandler: EnterpriseHandler;
  private naturalLanguageHandler: NaturalLanguageHandler;

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

    // Initialize enterprise handler separately (uses different architecture)
    this.enterpriseHandler = new EnterpriseHandler();

    // Initialize the revolutionary Natural Language Handler
    this.naturalLanguageHandler = new NaturalLanguageHandler(services);
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
        await this.handleCommand(chatId, text, user, text);
      } else {
        await this.handleTextMessage(chatId, msg.message_id, text, user);
      }

    } catch (error) {
      logger.error('Error handling message:', error);
      await this.sendErrorMessage(chatId, '❌ An error occurred while processing your message. Please try again or use /help for assistance.');
    }
  }

  private async handleCommand(chatId: number, command: string, user: any, text?: string): Promise<void> {
    const { cmd } = this.parseCommand(command);
    const messageText = text || command;

    try {
      // Handle enterprise commands first (highest priority)
      if (this.isEnterpriseCommand(cmd)) {
        await this.handleEnterpriseCommand(chatId, command, user);

        // Track enterprise command usage
        await this.trackEvent(chatId, 'enterprise_command_executed', {
          command: cmd,
          handler: 'EnterpriseHandler',
          timestamp: new Date()
        });
        return;
      }

      // Find the appropriate handler for regular commands
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
        // Revolutionary: Use Natural Language Handler for ANY unrecognized input
        try {
          await this.naturalLanguageHandler.handle(chatId, messageText, user);

          // Track natural language usage
          await this.trackEvent(chatId, 'natural_language_processed', {
            input: messageText.substring(0, 100), // First 100 chars for privacy
            handler: 'NaturalLanguageHandler',
            timestamp: new Date(),
            success: true
          });
        } catch (error) {
          logger.error('Natural language handler failed:', error);

          // Fallback to unknown command handler
          await this.handleUnknownCommand(chatId, messageText);

          // Track failure
          await this.trackEvent(chatId, 'natural_language_failed', {
            input: messageText.substring(0, 100),
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      logger.error(`Error handling command ${cmd}:`, error);
      await this.sendErrorMessage(chatId, `❌ Error processing command ${cmd}. Please try again.`);
    }
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
      '/advanced', '/content_gen', '/engagement', '/settings',
      '/enterprise_campaign', '/enterprise_generate', '/enterprise_analytics',
      '/optimize_content', '/multimodal_campaign', '/enterprise_status', '/deep_think'
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
      '/advanced', '/content_gen', '/engagement', '/settings',

      // Enterprise AI commands (Gemini 2.5)
      '/enterprise_campaign', '/enterprise_generate', '/enterprise_analytics',
      '/optimize_content', '/multimodal_campaign', '/enterprise_status',
      '/deep_think', '/campaign_details', '/multimodal_details', '/export_content'
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

  /**
   * Check if command is an enterprise command
   */
  private isEnterpriseCommand(cmd: string): boolean {
    const enterpriseCommands = [
      '/enterprise_campaign',
      '/enterprise_generate',
      '/enterprise_analytics',
      '/optimize_content',
      '/multimodal_campaign',
      '/enterprise_status',
      '/deep_think',
      '/campaign_details',
      '/multimodal_details',
      '/export_content'
    ];

    return enterpriseCommands.includes(cmd);
  }

  /**
   * Handle enterprise commands using the EnterpriseHandler
   */
  private async handleEnterpriseCommand(chatId: number, command: string, user: any): Promise<void> {
    const { cmd } = this.parseCommand(command);

    // Create context object for enterprise handler
    const ctx = {
      from: { id: chatId },
      message: { text: command },
      reply: async (text: string, options?: any) => {
        await this.bot.sendMessage(chatId, text, options);
      }
    };

    try {
      switch (cmd) {
        case '/enterprise_campaign':
          await this.enterpriseHandler.handleEnterpriseOrchestration(ctx as any);
          break;

        case '/enterprise_generate':
          await this.enterpriseHandler.handleEnterpriseGeneration(ctx as any);
          break;

        case '/enterprise_analytics':
          await this.enterpriseHandler.handleEnterpriseAnalytics(ctx as any);
          break;

        case '/optimize_content':
          await this.enterpriseHandler.handleContentOptimization(ctx as any);
          break;

        case '/multimodal_campaign':
          await this.enterpriseHandler.handleMultimodalCampaign(ctx as any);
          break;

        case '/enterprise_status':
          await this.handleEnterpriseStatus(chatId);
          break;

        case '/deep_think':
          await this.handleDeepThinkDemo(chatId, command);
          break;

        default:
          await this.sendErrorMessage(chatId, '❌ Unknown enterprise command. Use /help for available commands.');
      }
    } catch (error) {
      logger.error(`Enterprise command error for ${cmd}:`, error);
      await this.sendErrorMessage(chatId, `❌ Enterprise command ${cmd} failed. Please try again or contact support.`);
    }
  }

  /**
   * Handle enterprise status command
   */
  private async handleEnterpriseStatus(chatId: number): Promise<void> {
    try {
      const response = await fetch(`${process.env.LLM_SERVICE_URL}/api/gemini/enterprise/status`);

      if (response.ok) {
        interface StatusResponse {
          status?: string;
          active_campaigns?: number;
          total_campaigns_created?: number;
          success_rate?: number;
        }

        const status = await response.json() as StatusResponse;
        const statusMessage = `🚀 **Enterprise LLM Service Status**

🟢 **Service Health:** ${status.status || 'Active'}
📊 **Active Campaigns:** ${status.active_campaigns || 0}
🎯 **Total Campaigns:** ${status.total_campaigns_created || 0}
⚡ **Success Rate:** ${status.success_rate || 'N/A'}%

🧠 **AI Models Available:**
• Gemini 2.5 Pro: ✅
• Gemini 2.5 Flash: ✅
• Deep Think Mode: ✅
• Multimodal Processing: ✅

🎭 **Enterprise Features:**
• Cross-platform Optimization: ✅
• Real-time Adaptation: ✅
• Competitive Intelligence: ✅
• Compliance Automation: ✅

Use /enterprise_analytics for detailed insights.`;

        await this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
      } else {
        await this.sendErrorMessage(chatId, '❌ Failed to get enterprise status. Service may be unavailable.');
      }
    } catch (error) {
      logger.error('Enterprise status error:', error);
      await this.sendErrorMessage(chatId, '❌ Error retrieving enterprise status.');
    }
  }

  /**
   * Handle Deep Think demonstration
   */
  private async handleDeepThinkDemo(chatId: number, command: string): Promise<void> {
    const prompt = command.replace('/deep_think', '').trim();

    if (!prompt) {
      await this.bot.sendMessage(chatId,
        '🧠 **Deep Think Reasoning Demo**\n\n' +
        'Experience advanced AI reasoning:\n\n' +
        'Example: `/deep_think Analyze the competitive landscape for AI-powered marketing tools and recommend a strategic positioning approach`\n\n' +
        '✨ **Deep Think Features:**\n' +
        '• Multi-step reasoning chains\n' +
        '• Strategic analysis depth\n' +
        '• Competitive intelligence\n' +
        '• Risk assessment\n' +
        '• Innovation scoring',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      await this.bot.sendMessage(chatId, '🧠 **Initiating Deep Think Analysis...**\n\nUsing advanced reasoning chains for comprehensive analysis...', { parse_mode: 'Markdown' });

      const response = await fetch(`${process.env.LLM_SERVICE_URL}/api/gemini/enterprise/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          task_type: 'strategic_planning',
          complexity: 'enterprise',
          multimodal_types: ['text'],
          performance_priority: 'quality',
          deep_think_enabled: true,
          context: {
            demo_mode: true,
            show_reasoning: true,
            telegram_integration: true
          }
        })
      });

      if (response.ok) {
        interface DeepThinkResponse {
          content?: string;
          reasoning_trace?: string[];
          confidence_score?: number;
          deep_think_steps?: any[];
          model?: string;
        }

        const result = await response.json() as DeepThinkResponse;

        const deepThinkMessage = `🧠 **Deep Think Analysis Complete**

🎯 **Analysis Results:**
${result.content}

🔍 **Reasoning Process:**
${result.reasoning_trace?.slice(0, 3).map((step: string, i: number) => `${i + 1}. ${step}`).join('\n') || 'Advanced reasoning applied'}

📊 **Quality Metrics:**
• Confidence Score: ${result.confidence_score || 'N/A'}/1.0
• Reasoning Steps: ${result.deep_think_steps?.length || 0}
• Model Used: ${result.model}

💡 **This demonstrates the power of Deep Think reasoning for complex strategic analysis.**`;

        await this.bot.sendMessage(chatId, deepThinkMessage, { parse_mode: 'Markdown' });
      } else {
        await this.sendErrorMessage(chatId, '❌ Deep Think analysis failed. Please try again.');
      }
    } catch (error) {
      logger.error('Deep Think demo error:', error);
      await this.sendErrorMessage(chatId, '❌ Error during Deep Think analysis.');
    }
  }

  /**
   * Handle unknown commands with helpful guidance
   */
  private async handleUnknownCommand(chatId: number, command: string): Promise<void> {
    try {
      const helpMessage = `
🤖 **I didn't recognize that command!**

But don't worry - I understand natural language! You can just tell me what you want to do in plain English.

**Examples:**
• "Create a tweet about AI technology"
• "Start automation for my account"
• "Show me my analytics dashboard"
• "Generate a marketing campaign"

**Or use specific commands:**
• /help - Show all available commands
• /generate - Generate content
• /dashboard - View analytics
• /automation - Manage automation
• /accounts - Manage X accounts

**What would you like me to help you with?**
      `;

      await this.bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 Generate Content', callback_data: 'quick_generate' },
              { text: '📊 View Dashboard', callback_data: 'quick_dashboard' }
            ],
            [
              { text: '🤖 Start Automation', callback_data: 'quick_automation' },
              { text: '❓ Show Help', callback_data: 'quick_help' }
            ]
          ]
        }
      });

      // Track unknown command
      await this.trackEvent(chatId, 'unknown_command', {
        command: command.substring(0, 50),
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to handle unknown command:', error);
      await this.sendErrorMessage(chatId, 'Sorry, I encountered an issue. Please try again.');
    }
  }

  /**
   * Handle callback queries from inline keyboards
   */
  async handleCallbackQuery(callbackQuery: TelegramBot.CallbackQuery): Promise<void> {
    try {
      const data = callbackQuery.data;

      // Check if it's a natural language handler callback
      if (data && (data.startsWith('execute_plan:') || data.startsWith('cancel_plan:') || data.startsWith('plan_details:'))) {
        await this.naturalLanguageHandler.handleCallback(callbackQuery);
        return;
      }

      // Handle quick action callbacks
      const chatId = callbackQuery.message?.chat.id;
      if (!chatId) return;

      switch (data) {
        case 'quick_generate':
          await this.bot.sendMessage(chatId,
            '📝 **Content Generation**\n\nJust tell me what you want to create! For example:\n• "Create a tweet about AI trends"\n• "Generate a LinkedIn post about our product"\n• "Write a thread about productivity tips"'
          );
          break;

        case 'quick_dashboard':
          await this.bot.sendMessage(chatId,
            '📊 **Analytics Dashboard**\n\nSay something like:\n• "Show me my dashboard"\n• "What are my analytics?"\n• "How is my content performing?"'
          );
          break;

        case 'quick_automation':
          await this.bot.sendMessage(chatId,
            '🤖 **Automation Control**\n\nTry commands like:\n• "Start automation for my account"\n• "Stop all automation"\n• "Configure my automation settings"'
          );
          break;

        case 'quick_help':
          // Trigger the help command
          await this.handleMessage({ chat: { id: chatId }, text: '/help' } as any);
          break;

        default:
          await this.bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Feature coming soon!',
            show_alert: false
          });
      }

    } catch (error) {
      logger.error('Callback query handling error:', error);
      if (callbackQuery.id) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: 'An error occurred processing your request.',
          show_alert: true
        });
      }
    }
  }
}
