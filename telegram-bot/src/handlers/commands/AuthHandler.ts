import { BaseHandler, CommandHandler, HandlerServices } from '../base/BaseHandler';
import { logger } from '../../utils/logger';

export class AuthHandler extends BaseHandler implements CommandHandler {
  constructor(services: HandlerServices) {
    super(services);
  }

  canHandle(command: string): boolean {
    const { cmd } = this.parseCommand(command);
    return ['/start', '/auth', '/help'].includes(cmd);
  }

  async handle(chatId: number, command: string, user: any): Promise<void> {
    const { cmd, args } = this.parseCommand(command);

    try {
      switch (cmd) {
        case '/start':
          await this.handleStartCommand(chatId);
          break;
        case '/auth':
          await this.handleAuthCommand(chatId, args[0] || '');
          break;
        case '/help':
          await this.handleHelpCommand(chatId);
          break;
        default:
          await this.sendErrorMessage(chatId, '❓ Unknown authentication command.');
      }
    } catch (error) {
      await this.handleError(error, chatId, 'Authentication command');
    }
  }

  private async handleStartCommand(chatId: number): Promise<void> {
    const welcomeMessage = `
🚀 **Welcome to X Marketing Platform Bot!**

Your complete solution for X (Twitter) automation and marketing.

**🎯 What you can do:**
• Generate AI-powered content
• Automate likes, comments, and follows
• Schedule posts and campaigns
• Analyze performance and trends
• Manage multiple accounts safely

**🔐 Get Started:**
1. Use /auth to connect your X account
2. Explore features with /help
3. Start automating with /automation

**💡 Quick Actions:**
• /generate <topic> - Create content
• /dashboard - View analytics
• /automation - Start automation

Ready to grow your X presence? Let's begin! 🚀
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🔐 Connect X Account', callback_data: 'auth_start' },
        { text: '📚 View Tutorial', callback_data: 'tutorial_start' }
      ],
      [
        { text: '🎨 Quick Generate', callback_data: 'quick_generate' },
        { text: '📊 Dashboard', callback_data: 'dashboard_menu' }
      ],
      [
        { text: '⚙️ Settings', callback_data: 'settings_menu' },
        { text: '🆘 Support', callback_data: 'support_menu' }
      ]
    ]);

    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    await this.trackEvent(chatId, 'bot_started');
  }

  private async handleAuthCommand(chatId: number, token: string): Promise<void> {
    if (!token) {
      const authMessage = `
🔐 **X Account Authentication**

To connect your X account, you need an authentication token.

**How to get your token:**
1. Visit our secure auth portal
2. Login with your X account
3. Copy the generated token
4. Use: \`/auth YOUR_TOKEN\`

**Security Note:**
• Tokens are encrypted and secure
• We never store your X password
• You can revoke access anytime

Need help? Use /support for assistance.
      `;

      const keyboard = this.createInlineKeyboard([
        [{ text: '🌐 Get Auth Token', callback_data: 'get_auth_token' }],
        [{ text: '❓ Need Help?', callback_data: 'auth_help' }]
      ]);

      await this.bot.sendMessage(chatId, authMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      return;
    }

    const loadingMessage = await this.sendLoadingMessage(chatId, '🔐 Authenticating with X...');

    try {
      // Call backend authentication service
      const response = await fetch(`${process.env.BACKEND_URL}/api/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: chatId,
          auth_token: token
        })
      });

      const result = await response.json() as any;

      if (response.ok && result.success) {
        // Store user authentication
        try {
          logger.info(`User ${chatId} authenticated successfully with X account: ${result.xUsername}`);
        } catch (userError) {
          logger.error('Failed to store user data:', userError);
        }

        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `✅ **Authentication Successful!**\n\n🎉 Welcome ${result.xUsername || 'User'}!\n\n**Your account is now connected:**\n• X Account: @${result.xUsername || 'unknown'}\n• Access Level: ${result.plan || 'Free'}\n• Status: Active\n\n🚀 You can now use all platform features!`,
          { parse_mode: 'Markdown' }
        );

        await this.trackEvent(chatId, 'user_authenticated', {
          x_username: result.xUsername,
          plan: result.plan
        });
      } else {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          '❌ **Authentication Failed**\n\nInvalid token or authentication error.\n\nPlease check your token and try again.',
          { parse_mode: 'Markdown' }
        );
      }

    } catch (authError) {
      await this.editMessage(
        chatId,
        loadingMessage.message_id,
        '❌ **Authentication Error**\n\nUnable to connect to authentication service.\n\nPlease try again in a few moments or contact support.',
        { parse_mode: 'Markdown' }
      );
    }
  }

  private async handleHelpCommand(chatId: number): Promise<void> {
    const helpMessage = `
🚀 **X Marketing Platform - Complete Control Center**

**🔐 Authentication & Setup:**
/auth - Authenticate with the platform
/logout - Logout from the platform
/setup - Complete platform setup guide

**📊 Account Management:**
/accounts - View and manage X accounts
/add_account - Add new X account
/account_status - Check account health
/switch_account - Switch active account

**🎨 Content Creation:**
/generate <topic> - Generate AI content
/image <prompt> - Generate images
/analyze <text> - Analyze content sentiment
/variations <text> - Get content variations
/optimize <text> - Optimize existing content

**🤖 Automation Control:**
/automation - Main automation dashboard
/start_auto - Start automation
/stop_auto - Stop automation
/auto_config - Configure automation
/auto_status - Check automation status

**📈 Analytics & Insights:**
/dashboard - Main analytics dashboard
/performance - Performance metrics
/trends - Trending topics analysis
/competitors - Competitor analysis
/reports - Generate reports
/analytics - Detailed analytics
/analytics_pro - Advanced analytics

**🛡️ Quality & Compliance:**
/quality_check <text> - Check content quality
/compliance - Compliance monitoring
/safety_status - Account safety status
/rate_limits - Check rate limit status

**⚙️ Advanced Features:**
/advanced - Advanced features menu
/settings - Comprehensive settings
/notifications - Notification preferences
/export - Export data and reports
/backup - Backup configurations

**🆘 Support & Help:**
/help - This help menu
/support - Contact support
/status - Platform status
/version - Bot version info

**🎯 Quick Actions:**
/quick_post <text> - Post immediately
/quick_schedule <time> <text> - Schedule post
/emergency_stop - Emergency stop all automation

Use any command to get started! 🚀
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🎨 Content Creation', callback_data: 'help_content' },
        { text: '🤖 Automation', callback_data: 'help_automation' }
      ],
      [
        { text: '📊 Analytics', callback_data: 'help_analytics' },
        { text: '⚙️ Settings', callback_data: 'help_settings' }
      ],
      [
        { text: '🆘 Get Support', callback_data: 'contact_support' }
      ]
    ]);

    await this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    await this.trackEvent(chatId, 'help_viewed');
  }
}
