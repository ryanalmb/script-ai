import { BaseHandler, CommandHandler, HandlerServices } from '../base/BaseHandler';
import { logger } from '../../utils/logger';
import { databaseService } from '../../services/databaseService';

export class AccountHandler extends BaseHandler implements CommandHandler {
  constructor(services: HandlerServices) {
    super(services);
  }

  canHandle(command: string): boolean {
    const { cmd } = this.parseCommand(command);
    return ['/accounts', '/add_account', '/addaccount', '/account_status', '/switch_account', '/switchaccount'].includes(cmd);
  }

  async handle(chatId: number, command: string, user: any): Promise<void> {
    const { cmd, args } = this.parseCommand(command);

    // Authentication disabled for testing - direct access allowed

    try {
      switch (cmd) {
        case '/accounts':
          await this.handleAccountsCommand(chatId, user);
          break;
        case '/add_account':
        case '/addaccount':
          await this.handleAddAccountCommand(chatId, user);
          break;
        case '/account_status':
          await this.handleAccountStatusCommand(chatId, user);
          break;
        case '/switch_account':
        case '/switchaccount':
          await this.handleSwitchAccountCommand(chatId, user, args);
          break;
        default:
          await this.sendErrorMessage(chatId, '❓ Unknown account command.');
      }
    } catch (error) {
      await this.handleError(error, chatId, 'Account command');
    }
  }

  private async handleAccountsCommand(chatId: number, user: any): Promise<void> {
    const loadingMessage = await this.sendLoadingMessage(chatId, '👥 Loading accounts...');

    try {
      // Check authentication first
      if (!user || !user.accessToken) {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `🔐 **Authentication Required**\n\nPlease authenticate first to view your accounts.\n\n**Get Started:**\n• Use /auth to authenticate\n• Then use /accounts to view your X accounts\n\n💡 Authentication is required for account management.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Get user accounts from backend API
      let accounts: any[] = [];
      try {
        const response = await fetch(`${process.env.BACKEND_URL}/api/accounts`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data: any = await response.json();
          accounts = data.accounts || [];
        } else {
          logger.error('Failed to fetch accounts from backend:', response.status);
          accounts = [];
        }
      } catch (error) {
        logger.error('Failed to get accounts from backend:', error);
        accounts = [];
      }

      if (!accounts || accounts.length === 0) {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `👥 **No X Accounts Connected**\n\n🔗 You haven't connected any X accounts yet.\n\n**Get Started:**\n• Use /addaccount to connect your first X account\n• Follow the secure authentication process\n• Start automating your X presence!\n\n💡 **Need Help?**\nUse /help for detailed instructions.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const accountsMessage = `
👥 **Connected X Accounts**

${accounts.map((account: any, index: number) => `
**${index + 1}. @${account.username}** ${account.isActive ? '🟢' : '⚪'}
• Followers: ${this.formatNumber(account.followers || 0)}
• Following: ${this.formatNumber(account.following || 0)}
• Status: ${account.status || 'Active'}
• Connected: ${account.connectedAt ? new Date(account.connectedAt).toLocaleDateString() : 'Unknown'}
• Automation: ${account.automationEnabled ? '✅ Enabled' : '⏸️ Paused'}
`).join('\n')}

**📊 Account Summary:**
• Total Accounts: ${accounts.length}
• Active Accounts: ${accounts.filter((a: any) => a.isActive).length}
• Total Followers: ${this.formatNumber(accounts.reduce((sum: number, a: any) => sum + (a.followers || 0), 0))}
• Automation Status: ${accounts.filter((a: any) => a.automationEnabled).length}/${accounts.length} enabled

**💡 Tips:**
• Switch between accounts with /switch_account
• Check individual status with /account_status
• Add more accounts with /add_account
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '➕ Add Account', callback_data: 'add_new_account' },
          { text: '🔄 Switch Account', callback_data: 'switch_account_menu' }
        ],
        [
          { text: '📊 Account Status', callback_data: 'view_account_status' },
          { text: '⚙️ Manage Accounts', callback_data: 'manage_accounts_menu' }
        ],
        [
          { text: '🔄 Refresh', callback_data: 'refresh_accounts' }
        ]
      ]);

      await this.editMessage(chatId, loadingMessage.message_id, accountsMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      await this.trackEvent(chatId, 'accounts_viewed', {
        account_count: accounts.length,
        timestamp: new Date()
      });

    } catch (error) {
      await this.handleError(error, chatId, 'Accounts loading');
    }
  }

  private async handleAddAccountCommand(chatId: number, user: any): Promise<void> {
    // Check if user is authenticated first
    if (!user || !user.accessToken) {
      await this.bot.sendMessage(chatId, `
🔐 **Authentication Required**

You need to authenticate first before adding X accounts.

**Get Started:**
• Use /auth to authenticate with Telegram
• Then return here to add your X accounts

**Why authenticate?**
• Secure account management
• Personal data protection
• Access to all features
      `, { parse_mode: 'Markdown' });
      return;
    }

    const addAccountMessage = `
➕ **Add New X Account**

**📋 How to connect your X account:**

**Step 1:** Prepare your X credentials
• X username or email
• X password or app password
• Two-factor authentication code (if enabled)

**Step 2:** Choose connection method
• **Manual Entry:** Enter credentials directly
• **OAuth Flow:** Secure browser-based login
• **API Keys:** For developers (advanced)

**Step 3:** Verification & Setup
• Test connection to X
• Configure automation preferences
• Set posting schedules

**🛡️ Security Features:**
• End-to-end encryption
• Secure token storage
• Revoke access anytime
• No plain text passwords

**📊 Account Limits:**
• Free Plan: 1 X account
• Premium Plan: 5 X accounts
• Enterprise: Unlimited accounts

Ready to connect your X account?
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🔐 Start OAuth Flow', callback_data: 'start_oauth_flow' },
        { text: '✍️ Manual Entry', callback_data: 'manual_account_entry' }
      ],
      [
        { text: '🔧 API Keys Setup', callback_data: 'api_keys_setup' },
        { text: '❓ Connection Help', callback_data: 'connection_help' }
      ],
      [
        { text: '📋 View My Limits', callback_data: 'view_account_limits' },
        { text: '🔙 Back to Accounts', callback_data: 'back_to_accounts' }
      ]
    ]);

    await this.bot.sendMessage(chatId, addAccountMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    await this.trackEvent(chatId, 'add_account_viewed');
  }

  private async handleAccountStatusCommand(chatId: number, user: any): Promise<void> {
    const loadingMessage = await this.sendLoadingMessage(chatId, '📊 Checking account status...');

    try {
      // Check authentication first
      if (!user || !user.accessToken) {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `🔐 **Authentication Required**\n\nPlease authenticate first to view account status.\n\n**Get Started:**\n• Use /auth to authenticate\n• Then use /account_status to view your active account status`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Get current active account from backend API
      let currentAccount;
      try {
        const response = await fetch(`${process.env.BACKEND_URL}/api/accounts/active`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data: any = await response.json();
          currentAccount = data.account;
        } else if (response.status === 404) {
          currentAccount = null;
        } else {
          throw new Error(`Failed to get active account: ${response.status}`);
        }
      } catch (error) {
        logger.error('Failed to get active account:', error);
        currentAccount = null;
      }

      if (!currentAccount) {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `📊 **No Active Account**\n\n🔗 You don't have an active X account set.\n\n**Get Started:**\n• Use /addaccount to connect your X account\n• Use /accounts to view connected accounts\n• Use /switchaccount to set an active account\n\n💡 Connect an account to see detailed status information.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const statusMessage = `
📊 **Account Status Report**

**Current Account:** @${currentAccount.username}
**Status:** ${currentAccount.isActive ? '✅ Active' : '⏸️ Inactive'}
**Plan:** ${user.plan || 'Free'}
**Connected:** ${currentAccount.connectedAt ? new Date(currentAccount.connectedAt).toLocaleDateString() : 'Unknown'}

**📈 Account Health:**
• API Status: ${currentAccount.apiStatus || '✅ Connected'}
• Rate Limits: ${currentAccount.rateLimitStatus || '✅ Normal'}
• Automation: ${currentAccount.automationEnabled ? '✅ Active' : '⏸️ Paused'}
• Last Activity: ${currentAccount.lastActivity || '2 minutes ago'}

**📊 Current Metrics:**
• Followers: ${this.formatNumber(currentAccount.followers || 0)}
• Following: ${this.formatNumber(currentAccount.following || 0)}
• Tweets Today: ${currentAccount.tweetsToday || 0}
• Engagement Rate: ${(currentAccount.engagementRate * 100 || 4.2).toFixed(1)}%

**🤖 Automation Status:**
• Like Automation: ${this.getAutomationStatus('like')}
• Comment Automation: ${this.getAutomationStatus('comment')}
• Follow Automation: ${this.getAutomationStatus('follow')}
• Retweet Automation: ${this.getAutomationStatus('retweet')}

**⚠️ Alerts:**
${this.getAccountAlerts(currentAccount)}

**📅 Last Updated:** ${new Date().toLocaleString()}
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '🔄 Refresh Status', callback_data: 'refresh_account_status' },
          { text: '⚙️ Account Settings', callback_data: 'account_settings' }
        ],
        [
          { text: '🤖 Automation Config', callback_data: 'automation_config' },
          { text: '📊 Detailed Report', callback_data: 'detailed_account_report' }
        ],
        [
          { text: '🔄 Switch Account', callback_data: 'switch_account_menu' }
        ]
      ]);

      await this.editMessage(chatId, loadingMessage.message_id, statusMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      await this.trackEvent(chatId, 'account_status_viewed');

    } catch (error) {
      await this.handleError(error, chatId, 'Account status check');
    }
  }

  private async handleSwitchAccountCommand(chatId: number, user: any, args: string[]): Promise<void> {
    // Check authentication first
    if (!user || !user.accessToken) {
      await this.bot.sendMessage(chatId, `
🔐 **Authentication Required**

Please authenticate first to switch accounts.

**Get Started:**
• Use /auth to authenticate
• Then use /switchaccount to switch between your X accounts
      `, { parse_mode: 'Markdown' });
      return;
    }

    const accountIndex = args[0];

    if (!accountIndex) {
      // Show account selection menu
      await this.showAccountSwitchMenu(chatId, user);
      return;
    }

    const loadingMessage = await this.sendLoadingMessage(chatId, '🔄 Switching account...');

    try {
      // Get accounts from backend API
      let accounts: any[] = [];
      try {
        const response = await fetch(`${process.env.BACKEND_URL}/api/accounts`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data: any = await response.json();
          accounts = data.accounts || [];
        } else {
          logger.error('Failed to fetch accounts for switching:', response.status);
          accounts = [];
        }
      } catch (error) {
        logger.error('Failed to get accounts for switching:', error);
        accounts = [];
      }

      const targetIndex = parseInt(accountIndex) - 1;

      if (targetIndex < 0 || targetIndex >= accounts.length) {
        await this.editMessage(chatId, loadingMessage.message_id,
          `❌ Invalid account number. Please use a number between 1 and ${accounts.length}.`
        );
        return;
      }

      const targetAccount = accounts[targetIndex];

      // Switch to the target account via backend API
      try {
        const response = await fetch(`${process.env.BACKEND_URL}/api/accounts/${targetAccount.id}/activate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to switch account: ${response.status}`);
        }
      } catch (error) {
        logger.error('Failed to switch account via backend:', error);
        await this.editMessage(chatId, loadingMessage.message_id,
          `❌ **Account Switch Failed**\n\nUnable to switch to @${targetAccount.username}.\n\n**Possible Issues:**\n• Account connection lost\n• Backend service unavailable\n• Invalid account status\n\nPlease try again or contact support.`
        );
        return;
      }
      
      const successMessage = `
✅ **Account Switched Successfully!**

**Now Active:** @${targetAccount.username}
**Followers:** ${this.formatNumber(targetAccount.followers || 0)}
**Status:** ${targetAccount.status || 'Active'}

**🤖 Automation Status:**
• Automation: ${targetAccount.automationEnabled ? '✅ Enabled' : '⏸️ Disabled'}
• All settings preserved
• Ready for use

**💡 Next Steps:**
• Check automation status: /automation
• View performance: /dashboard
• Configure settings: /settings

You can now use all features with this account!
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '📊 View Dashboard', callback_data: 'view_dashboard' },
          { text: '🤖 Check Automation', callback_data: 'automation_dashboard' }
        ],
        [
          { text: '⚙️ Account Settings', callback_data: 'account_settings' },
          { text: '👥 All Accounts', callback_data: 'view_all_accounts' }
        ]
      ]);

      await this.editMessage(chatId, loadingMessage.message_id, successMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      await this.trackEvent(chatId, 'account_switched', {
        from_account: user.activeAccount?.username,
        to_account: targetAccount.username
      });

    } catch (error) {
      await this.handleError(error, chatId, 'Account switching');
    }
  }

  private async showAccountSwitchMenu(chatId: number, user: any): Promise<void> {
    const loadingMessage = await this.sendLoadingMessage(chatId, '🔄 Loading account options...');

    try {
      // Get accounts with fallback
      let accounts;
      try {
        accounts = await this.userService.getUserAccounts(user?.id || chatId);
      } catch (error) {
        logger.error('Failed to get accounts for switching:', error);
        accounts = [];
      }

      if (!accounts || accounts.length <= 1) {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `🔄 **Account Switching Unavailable**\n\n${accounts.length === 0 ? 'No accounts connected.' : 'Only one account connected.'}\n\n**To switch accounts:**\n• Connect multiple X accounts using /auth\n• Each account needs separate authentication\n\n💡 Use /add_account to connect additional accounts.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const switchMessage = `
🔄 **Switch X Account**

**Available Accounts:**

${accounts.map((account: any, index: number) => `
**${index + 1}. @${account.username}** ${account.isActive ? '🟢 (Current)' : '⚪'}
• Followers: ${this.formatNumber(account.followers || 0)}
• Status: ${account.status || 'Active'}
• Automation: ${account.automationEnabled ? '✅' : '⏸️'}
`).join('\n')}

**How to switch:**
• Use buttons below for quick switch
• Or use: \`/switch_account [number]\`
• Example: \`/switch_account 2\`

**💡 Note:** All automation settings are preserved per account.
      `;

      // Create keyboard with account options
      const accountButtons = accounts.map((account: any, index: number) => [
        { 
          text: `${index + 1}. @${account.username} ${account.isActive ? '🟢' : ''}`, 
          callback_data: `switch_to_account_${index + 1}` 
        }
      ]);

      const keyboard = this.createInlineKeyboard([
        ...accountButtons,
        [
          { text: '➕ Add New Account', callback_data: 'add_new_account' },
          { text: '👥 Manage Accounts', callback_data: 'manage_accounts_menu' }
        ]
      ]);

      await this.editMessage(chatId, loadingMessage.message_id, switchMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      await this.handleError(error, chatId, 'Account switch menu');
    }
  }

  private getAutomationStatus(type: string): string {
    // Mock automation status - replace with actual service call
    const statuses = ['🟢 Active', '⏸️ Paused', '🔴 Stopped'];
    return statuses[Math.floor(Math.random() * statuses.length)] || '❓ Unknown';
  }

  private getAccountAlerts(account: any): string {
    // Mock alerts - replace with actual alert system
    const alerts = [
      '• No alerts - account healthy',
      '• Rate limit approaching (80% used)',
      '• Unusual activity detected',
      '• API quota low (15% remaining)'
    ];

    return alerts[Math.floor(Math.random() * alerts.length)] || '• No alerts - account healthy';
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }


}
