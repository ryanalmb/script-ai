import TelegramBot = require('node-telegram-bot-api');
import { BaseHandler, HandlerServices } from '../base/BaseHandler';
import { logger } from '../../utils/logger';
import { BackendIntegrationService } from '../../services/backendIntegrationService';

export class SimulateHandler extends BaseHandler {
  private backendService: BackendIntegrationService;

  constructor(services: HandlerServices, backendService: BackendIntegrationService) {
    super(services);
    this.backendService = backendService;
  }

  /**
   * Handle /simulate command
   */
  async handleSimulateCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) {
      await this.bot.sendMessage(chatId, '❌ Unable to identify user.');
      return;
    }

    try {
      logger.info('Simulate command received', { userId, chatId });

      const simulateMessage = `
🎭 **Account Simulator**

Create comprehensive test accounts to explore all platform features without real X credentials.

**Available Account Types:**

🧑‍💼 **Personal Account**
• Realistic follower counts (1K-50K)
• Personal content simulation
• Standard engagement rates
• Individual user features

🏢 **Business Account**
• Professional metrics (5K-200K followers)
• Business content templates
• Analytics dashboard access
• Marketing tools simulation

🎨 **Creator Account**
• High engagement simulation (10K-1M followers)
• Content monetization features
• Creator analytics
• Brand partnership tools

🏛️ **Government Account**
• Official account features
• Public communication tools
• Verified status simulation
• Policy announcement templates

**Account Tiers:**
• 🥉 **Basic** - Standard features
• 🥈 **Premium** - Enhanced analytics
• 🥇 **Premium Plus** - Advanced tools
• 💎 **Enterprise** - Full feature access

**Activity Levels:**
• 📉 **Low** - Minimal activity simulation
• 📊 **Medium** - Regular activity patterns
• 📈 **High** - Active engagement simulation
• 🚀 **Viral** - High-impact content simulation

Choose your simulation type:
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '🧑‍💼 Personal Account', callback_data: 'simulate_personal' },
          { text: '🏢 Business Account', callback_data: 'simulate_business' }
        ],
        [
          { text: '🎨 Creator Account', callback_data: 'simulate_creator' },
          { text: '🏛️ Government Account', callback_data: 'simulate_government' }
        ],
        [
          { text: '⚙️ Custom Configuration', callback_data: 'simulate_custom' }
        ],
        [
          { text: '📊 View Existing Accounts', callback_data: 'simulate_view_accounts' },
          { text: '🗑️ Delete Accounts', callback_data: 'simulate_delete_accounts' }
        ],
        [
          { text: '❓ Help & Examples', callback_data: 'simulate_help' },
          { text: '❌ Cancel', callback_data: 'cancel_simulate' }
        ]
      ]);

      await this.bot.sendMessage(chatId, simulateMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      logger.error('Error handling simulate command:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to load simulator. Please try again.');
    }
  }

  /**
   * Handle simulate callback queries
   */
  async handleSimulateCallback(query: TelegramBot.CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (!chatId || !data) return;

    try {
      await this.bot.answerCallbackQuery(query.id);

      switch (data) {
        case 'simulate_personal':
          await this.handlePersonalAccountSimulation(chatId, userId);
          break;
        case 'simulate_business':
          await this.handleBusinessAccountSimulation(chatId, userId);
          break;
        case 'simulate_creator':
          await this.handleCreatorAccountSimulation(chatId, userId);
          break;
        case 'simulate_government':
          await this.handleGovernmentAccountSimulation(chatId, userId);
          break;
        case 'simulate_custom':
          await this.handleCustomSimulation(chatId, userId);
          break;
        case 'simulate_view_accounts':
          await this.handleViewAccounts(chatId, userId);
          break;
        case 'simulate_delete_accounts':
          await this.handleDeleteAccounts(chatId, userId);
          break;
        case 'simulate_help':
          await this.handleSimulateHelp(chatId, userId);
          break;
        case 'simulate_back_main':
          await this.handleSimulateCommand({ chat: { id: chatId }, from: { id: userId } } as any);
          break;
        case 'cancel_simulate':
          await this.handleCancelSimulate(chatId);
          break;
        default:
          if (data.startsWith('simulate_tier_')) {
            await this.handleTierSelection(chatId, userId, data);
          } else if (data.startsWith('simulate_activity_')) {
            await this.handleActivitySelection(chatId, userId, data);
          } else if (data.startsWith('simulate_create_')) {
            await this.handleCreateAccount(chatId, userId, data);
          } else if (data.startsWith('simulate_delete_')) {
            await this.handleDeleteSpecificAccount(chatId, userId, data);
          } else if (data.startsWith('simulate_activity_back_')) {
            await this.handleActivityBackButton(chatId, userId, data);
          } else if (data.startsWith('simulate_tier_back_')) {
            await this.handleTierBackButton(chatId, userId, data);
          } else {
            // Handle direct account type navigation
            const accountTypes = ['personal', 'business', 'creator', 'government'];
            const accountType = data.replace('simulate_', '');
            if (accountTypes.includes(accountType)) {
              await this.handleAccountTypeSelection(chatId, userId, accountType);
            }
          }
          break;
      }

    } catch (error) {
      logger.error('Error handling simulate callback:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  /**
   * Handle personal account simulation
   */
  private async handlePersonalAccountSimulation(chatId: number, userId: number): Promise<void> {
    const message = `
🧑‍💼 **Personal Account Simulation**

Creating a realistic personal X account with:

**Features Included:**
• ✅ Realistic follower count (1K-50K)
• ✅ Personal bio and profile
• ✅ Tweet history simulation
• ✅ Engagement metrics
• ✅ Direct message simulation
• ✅ Notification system
• ✅ Privacy settings
• ✅ Content scheduling
• ✅ Analytics dashboard

**Select Account Tier:**
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🥉 Basic (1K-5K followers)', callback_data: 'simulate_tier_personal_basic' },
        { text: '🥈 Premium (5K-15K followers)', callback_data: 'simulate_tier_personal_premium' }
      ],
      [
        { text: '🥇 Premium Plus (15K-35K followers)', callback_data: 'simulate_tier_personal_premium_plus' },
        { text: '💎 Enterprise (35K-50K followers)', callback_data: 'simulate_tier_personal_enterprise' }
      ],
      [
        { text: '🔙 Back to Main Menu', callback_data: 'simulate_back_main' }
      ]
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle business account simulation
   */
  private async handleBusinessAccountSimulation(chatId: number, userId: number): Promise<void> {
    const message = `
🏢 **Business Account Simulation**

Creating a professional business X account with:

**Enterprise Features:**
• ✅ Business profile verification
• ✅ Advanced analytics dashboard
• ✅ Marketing campaign tools
• ✅ Customer service features
• ✅ Brand monitoring
• ✅ Team collaboration tools
• ✅ Advertising simulation
• ✅ Lead generation tools
• ✅ API access simulation
• ✅ Webhook integrations

**Select Business Tier:**
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🥉 Basic Business (5K-25K)', callback_data: 'simulate_tier_business_basic' },
        { text: '🥈 Premium Business (25K-75K)', callback_data: 'simulate_tier_business_premium' }
      ],
      [
        { text: '🥇 Premium Plus (75K-150K)', callback_data: 'simulate_tier_business_premium_plus' },
        { text: '💎 Enterprise (150K-500K)', callback_data: 'simulate_tier_business_enterprise' }
      ],
      [
        { text: '🔙 Back to Main Menu', callback_data: 'simulate_back_main' }
      ]
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle creator account simulation
   */
  private async handleCreatorAccountSimulation(chatId: number, userId: number): Promise<void> {
    const message = `
🎨 **Creator Account Simulation**

Creating a high-engagement creator account with:

**Creator Features:**
• ✅ Monetization tools simulation
• ✅ Super Follows functionality
• ✅ Spaces hosting capabilities
• ✅ Creator analytics
• ✅ Brand partnership tools
• ✅ Content scheduling
• ✅ Audience insights
• ✅ Revenue tracking
• ✅ Community building tools
• ✅ Cross-platform integration

**Select Creator Tier:**
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🥉 Emerging (10K-50K)', callback_data: 'simulate_tier_creator_basic' },
        { text: '🥈 Growing (50K-200K)', callback_data: 'simulate_tier_creator_premium' }
      ],
      [
        { text: '🥇 Established (200K-500K)', callback_data: 'simulate_tier_creator_premium_plus' },
        { text: '💎 Influencer (500K-2M)', callback_data: 'simulate_tier_creator_enterprise' }
      ],
      [
        { text: '🔙 Back to Main Menu', callback_data: 'simulate_back_main' }
      ]
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle tier selection
   */
  private async handleTierSelection(chatId: number, userId: number, data: string): Promise<void> {
    const parts = data.split('_'); // simulate_tier_accountType_tier
    const accountType = parts[2] || 'personal';
    const tier = parts[3] || 'basic';

    const message = `
⚡ **Activity Level Selection**

Choose the activity level for your ${accountType} account:

**📉 Low Activity**
• Minimal daily posts (1-3 per day)
• Basic engagement simulation
• Standard response times
• Suitable for testing basic features

**📊 Medium Activity**
• Regular posting schedule (5-10 per day)
• Moderate engagement rates
• Realistic interaction patterns
• Balanced feature testing

**📈 High Activity**
• Active posting (15-25 per day)
• High engagement simulation
• Quick response times
• Comprehensive feature testing

**🚀 Viral Activity**
• Trending content simulation
• Massive engagement spikes
• Viral metrics simulation
• Stress testing capabilities

Select activity level:
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '📉 Low Activity', callback_data: `simulate_activity_${accountType}_${tier}_low` },
        { text: '📊 Medium Activity', callback_data: `simulate_activity_${accountType}_${tier}_medium` }
      ],
      [
        { text: '📈 High Activity', callback_data: `simulate_activity_${accountType}_${tier}_high` },
        { text: '🚀 Viral Activity', callback_data: `simulate_activity_${accountType}_${tier}_viral` }
      ],
      [
        { text: '🔙 Back to Account Types', callback_data: `simulate_back_main` }
      ]
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle activity level selection
   */
  private async handleActivitySelection(chatId: number, userId: number, data: string): Promise<void> {
    const parts = data.split('_'); // simulate_activity_accountType_tier_activity
    const accountType = parts[2] || 'personal';
    const tier = parts[3] || 'basic';
    const activity = parts[4] || 'medium';

    const message = `
🎭 **Account Creation Summary**

**Account Type:** ${this.formatAccountType(accountType)}
**Tier:** ${this.formatTier(tier)}
**Activity Level:** ${this.formatActivity(activity)}

**This will create:**
• Realistic profile with bio and images
• ${this.getFollowerRange(accountType, tier)} followers
• Complete tweet history (last 30 days)
• Engagement metrics and analytics
• Direct message conversations
• Notification history
• API response simulation
• Rate limiting simulation
• Error handling simulation

**Features Available:**
${this.getFeatureList(accountType, tier)}

Ready to create your simulated account?
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '✅ Create Account', callback_data: `simulate_create_${accountType}_${tier}_${activity}` }
      ],
      [
        { text: '🔙 Back to Activity Selection', callback_data: `simulate_tier_${accountType}_${tier}` },
        { text: '❌ Cancel', callback_data: 'cancel_simulate' }
      ]
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle account creation
   */
  private async handleCreateAccount(chatId: number, userId: number, data: string): Promise<void> {
    const parts = data.split('_'); // simulate_create_accountType_tier_activity
    const accountType = parts[2] || 'personal';
    const tier = parts[3] || 'basic';
    const activity = parts[4] || 'medium';

    // Show loading message
    const loadingMsg = await this.bot.sendMessage(chatId, '🎭 Creating your simulated account...\n\n⏳ This may take a few moments...');

    try {
      logger.info('Creating simulated account via bot', {
        userId,
        accountType,
        tier,
        activity,
        verified: tier === 'enterprise'
      });

      // Create simulated account via backend
      const response = await this.backendService.createSimulatedAccount({
        telegramUserId: userId,
        accountType,
        tier,
        activityLevel: activity,
        verified: tier === 'enterprise'
      });

      // Extract account data from response
      const accountData = response.account || response;

      logger.info('Simulated account created successfully via bot', {
        accountId: accountData.id,
        username: accountData.profile?.username,
        responseType: typeof response,
        hasAccount: !!response.account
      });

      // Delete loading message safely
      try {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (deleteError) {
        logger.warn('Failed to delete loading message (message may not exist)', {
          messageId: loadingMsg.message_id,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError)
        });
      }

      const successMessage = `
🎉 **Account Created Successfully!**

**Account Details:**
• **Username:** @${accountData.profile.username}
• **Display Name:** ${accountData.profile.displayName}
• **Account Type:** ${this.formatAccountType(accountType)}
• **Tier:** ${this.formatTier(tier)}
• **Followers:** ${accountData.profile.followersCount.toLocaleString()}
• **Following:** ${accountData.profile.followingCount.toLocaleString()}
• **Tweets:** ${accountData.profile.tweetsCount.toLocaleString()}
• **Status:** ${accountData.status === 'verified' ? '✅ Verified' : '🟢 Active'}

**Available Features:**
${this.getFeatureList(accountType, tier)}

**Next Steps:**
• Use this account to test all platform features
• Access analytics and metrics
• Test content creation and scheduling
• Simulate API interactions
• Practice with engagement tools

Your simulated account is now ready for comprehensive testing!
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '📊 View Account Details', callback_data: `simulate_view_${accountData.id}` },
          { text: '🧪 Test Features', callback_data: `simulate_test_${accountData.id}` }
        ],
        [
          { text: '➕ Create Another Account', callback_data: 'simulate_back_main' },
          { text: '✅ Done', callback_data: 'cancel_simulate' }
        ]
      ]);

      await this.bot.sendMessage(chatId, successMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      logger.info('Simulated account created successfully', {
        userId,
        accountId: accountData.id,
        accountType,
        tier,
        activity
      });

    } catch (error) {
      // Delete loading message safely
      try {
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);
      } catch (deleteError) {
        logger.warn('Failed to delete loading message (message may not exist)', {
          messageId: loadingMsg.message_id,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError)
        });
      }

      logger.error('Failed to create simulated account via bot:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        accountType,
        tier,
        activity
      });

      const errorMessage = `
❌ **Account Creation Failed**

Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}

This might be due to:
• Backend service unavailable
• Database connection issues
• Rate limiting
• Invalid configuration
• Network connectivity issues

Please try again in a few moments.
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '🔄 Try Again', callback_data: `simulate_create_${accountType}_${tier}_${activity}` },
          { text: '🔙 Back to Menu', callback_data: 'simulate_back_main' }
        ]
      ]);

      await this.bot.sendMessage(chatId, errorMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  }

  /**
   * Handle viewing existing accounts
   */
  private async handleViewAccounts(chatId: number, userId: number): Promise<void> {
    try {
      const accounts = await this.backendService.getSimulatedAccounts(userId);

      if (accounts.length === 0) {
        const message = `
📭 **No Simulated Accounts**

You don't have any simulated accounts yet.

Create your first simulated account to start testing platform features!
        `;

        const keyboard = this.createInlineKeyboard([
          [
            { text: '➕ Create First Account', callback_data: 'simulate_back_main' }
          ]
        ]);

        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        return;
      }

      let message = `📊 **Your Simulated Accounts** (${accounts.length})\n\n`;

      accounts.forEach((account, index) => {
        const statusIcon = account.status === 'verified' ? '✅' :
                          account.status === 'active' ? '🟢' :
                          account.status === 'suspended' ? '🔴' : '🟡';

        message += `**${index + 1}. @${account.profile.username}**\n`;
        message += `• Type: ${this.formatAccountType(account.profile.accountType)}\n`;
        message += `• Tier: ${this.formatTier(account.profile.tier)}\n`;
        message += `• Followers: ${account.profile.followersCount.toLocaleString()}\n`;
        message += `• Status: ${statusIcon} ${account.status}\n`;
        message += `• Created: ${new Date(account.createdAt).toLocaleDateString()}\n\n`;
      });

      const keyboard = this.createInlineKeyboard([
        [
          { text: '🗑️ Delete Accounts', callback_data: 'simulate_delete_accounts' },
          { text: '➕ Create New Account', callback_data: 'simulate_back_main' }
        ],
        [
          { text: '✅ Done', callback_data: 'cancel_simulate' }
        ]
      ]);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      logger.error('Failed to retrieve simulated accounts:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to retrieve accounts. Please try again.');
    }
  }

  /**
   * Handle deleting accounts
   */
  private async handleDeleteAccounts(chatId: number, userId: number): Promise<void> {
    try {
      const accounts = await this.backendService.getSimulatedAccounts(userId);

      if (accounts.length === 0) {
        await this.bot.sendMessage(chatId, '📭 No accounts to delete.');
        return;
      }

      const message = `
🗑️ **Delete Simulated Accounts**

Select accounts to delete:

⚠️ **Warning:** This action cannot be undone!
      `;

      const buttons = accounts.map(account => [{
        text: `🗑️ @${account.profile.username} (${account.profile.followersCount.toLocaleString()} followers)`,
        callback_data: `simulate_delete_${account.id}`
      }]);

      buttons.push([
        { text: '🗑️ Delete All Accounts', callback_data: 'simulate_delete_all' },
        { text: '❌ Cancel', callback_data: 'simulate_view_accounts' }
      ]);

      const keyboard = this.createInlineKeyboard(buttons);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      logger.error('Failed to load accounts for deletion:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to load accounts. Please try again.');
    }
  }

  /**
   * Handle simulate help
   */
  private async handleSimulateHelp(chatId: number, userId: number): Promise<void> {
    const helpMessage = `
❓ **Account Simulator Help**

**What is Account Simulation?**
The Account Simulator creates realistic X accounts for testing all platform features without requiring real X API credentials.

**Account Types:**

🧑‍💼 **Personal**
• Individual user simulation
• Personal content patterns
• Standard engagement rates
• Privacy-focused features

🏢 **Business**
• Professional account features
• Marketing tools access
• Business analytics
• Customer service tools

🎨 **Creator**
• High engagement simulation
• Monetization features
• Creator analytics
• Brand partnership tools

🏛️ **Government**
• Official account status
• Public communication tools
• Verified status
• Policy announcement features

**Tiers:**
• 🥉 **Basic** - Standard features
• 🥈 **Premium** - Enhanced analytics
• 🥇 **Premium Plus** - Advanced tools
• 💎 **Enterprise** - Full access

**Activity Levels:**
• 📉 **Low** - 1-3 posts/day
• 📊 **Medium** - 5-10 posts/day
• 📈 **High** - 15-25 posts/day
• 🚀 **Viral** - Trending simulation

**Features Simulated:**
• ✅ Realistic follower/following counts
• ✅ Tweet history and engagement
• ✅ Direct messages
• ✅ Notifications
• ✅ Analytics dashboard
• ✅ API responses
• ✅ Rate limiting
• ✅ Error handling
• ✅ Content scheduling
• ✅ Media uploads

**Use Cases:**
• Testing bot functionality
• Learning platform features
• Development and debugging
• Training and demonstrations
• Feature exploration

Need more help? Contact support!
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🎭 Create Account', callback_data: 'simulate_back_main' },
        { text: '📊 View Examples', callback_data: 'simulate_examples' }
      ],
      [
        { text: '✅ Got It', callback_data: 'cancel_simulate' }
      ]
    ]);

    await this.bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle cancel simulate
   */
  private async handleCancelSimulate(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId, '✅ Account simulation cancelled.');
  }

  // Helper methods
  private formatAccountType(type: string): string {
    const types: { [key: string]: string } = {
      personal: '🧑‍💼 Personal',
      business: '🏢 Business',
      creator: '🎨 Creator',
      government: '🏛️ Government'
    };
    return types[type] || type;
  }

  private formatTier(tier: string): string {
    const tiers: { [key: string]: string } = {
      basic: '🥉 Basic',
      premium: '🥈 Premium',
      premium_plus: '🥇 Premium Plus',
      enterprise: '💎 Enterprise'
    };
    return tiers[tier] || tier;
  }

  private formatActivity(activity: string): string {
    const activities: { [key: string]: string } = {
      low: '📉 Low Activity',
      medium: '📊 Medium Activity',
      high: '📈 High Activity',
      viral: '🚀 Viral Activity'
    };
    return activities[activity] || activity;
  }

  private getFollowerRange(accountType: string, tier: string): string {
    const ranges: { [key: string]: { [key: string]: string } } = {
      personal: {
        basic: '1K-5K',
        premium: '5K-15K',
        premium_plus: '15K-35K',
        enterprise: '35K-50K'
      },
      business: {
        basic: '5K-25K',
        premium: '25K-75K',
        premium_plus: '75K-150K',
        enterprise: '150K-500K'
      },
      creator: {
        basic: '10K-50K',
        premium: '50K-200K',
        premium_plus: '200K-500K',
        enterprise: '500K-2M'
      },
      government: {
        basic: '5K-25K',
        premium: '25K-100K',
        premium_plus: '100K-500K',
        enterprise: '500K+'
      }
    };

    const accountRanges = ranges[accountType];
    return accountRanges ? (accountRanges[tier] || '1K-10K') : '1K-10K';
  }

  private getFeatureList(accountType: string, tier: string): string {
    const baseFeatures = [
      '• ✅ Profile management',
      '• ✅ Tweet creation and scheduling',
      '• ✅ Engagement tracking',
      '• ✅ Direct messaging',
      '• ✅ Notification system'
    ];

    const tierFeatures: { [key: string]: string[] } = {
      basic: [],
      premium: [
        '• ✅ Advanced analytics',
        '• ✅ Content insights'
      ],
      premium_plus: [
        '• ✅ Advanced analytics',
        '• ✅ Content insights',
        '• ✅ Audience demographics',
        '• ✅ Performance tracking'
      ],
      enterprise: [
        '• ✅ Advanced analytics',
        '• ✅ Content insights',
        '• ✅ Audience demographics',
        '• ✅ Performance tracking',
        '• ✅ API access simulation',
        '• ✅ Webhook integration',
        '• ✅ Team collaboration',
        '• ✅ Custom reporting'
      ]
    };

    const typeFeatures: { [key: string]: string[] } = {
      business: [
        '• ✅ Business analytics',
        '• ✅ Lead generation',
        '• ✅ Customer service tools'
      ],
      creator: [
        '• ✅ Monetization tools',
        '• ✅ Creator analytics',
        '• ✅ Brand partnerships'
      ],
      government: [
        '• ✅ Official verification',
        '• ✅ Public communication',
        '• ✅ Policy announcements'
      ]
    };

    const features = [
      ...baseFeatures,
      ...(tierFeatures[tier] || []),
      ...(typeFeatures[accountType] || [])
    ];

    return features.join('\n');
  }

  /**
   * Handle custom simulation
   */
  private async handleCustomSimulation(chatId: number, userId: number): Promise<void> {
    const message = `
⚙️ **Custom Account Configuration**

Create a fully customized simulated account with specific parameters:

**Customization Options:**
• 🎭 Account type and tier
• 📊 Specific follower counts
• 📈 Custom engagement rates
• 🎨 Profile customization
• 📅 Account age simulation
• 🌍 Geographic targeting
• 📱 Device usage patterns
• 🎯 Interest targeting

**Advanced Features:**
• 🔧 API response customization
• ⚡ Rate limiting configuration
• 🚨 Error simulation settings
• 📊 Custom analytics data
• 🎪 Viral content simulation
• 🤖 Bot interaction patterns

This feature allows you to create highly specific test scenarios for comprehensive platform testing.

Ready to configure your custom account?
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🎯 Start Custom Config', callback_data: 'simulate_custom_start' }
      ],
      [
        { text: '📋 Use Template', callback_data: 'simulate_custom_template' },
        { text: '🔙 Back to Main Menu', callback_data: 'simulate_back_main' }
      ]
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle government account simulation
   */
  private async handleGovernmentAccountSimulation(chatId: number, userId: number): Promise<void> {
    const message = `
🏛️ **Government Account Simulation**

Creating an official government account with:

**Official Features:**
• ✅ Verified government status
• ✅ Official communication tools
• ✅ Public announcement system
• ✅ Emergency alert capabilities
• ✅ Policy update distribution
• ✅ Citizen engagement tools
• ✅ Transparency reporting
• ✅ Multi-language support
• ✅ Accessibility features
• ✅ Archive management

**Select Government Level:**
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🏛️ Local Government (5K-25K)', callback_data: 'simulate_tier_government_basic' },
        { text: '🏢 State/Regional (25K-100K)', callback_data: 'simulate_tier_government_premium' }
      ],
      [
        { text: '🏛️ Federal Agency (100K-500K)', callback_data: 'simulate_tier_government_premium_plus' },
        { text: '🌍 International (500K+)', callback_data: 'simulate_tier_government_enterprise' }
      ],
      [
        { text: '🔙 Back to Main Menu', callback_data: 'simulate_back_main' }
      ]
    ]);

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  /**
   * Handle deleting a specific account
   */
  private async handleDeleteSpecificAccount(chatId: number, userId: number, data: string): Promise<void> {
    const accountId = data.replace('simulate_delete_', '');

    try {
      const deleted = await this.backendService.deleteSimulatedAccount(accountId, userId);

      if (deleted) {
        await this.bot.sendMessage(chatId, '✅ Account deleted successfully.');
      } else {
        await this.bot.sendMessage(chatId, '❌ Failed to delete account or account not found.');
      }
    } catch (error) {
      logger.error('Failed to delete specific account:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred while deleting the account.');
    }
  }

  /**
   * Handle activity back button
   */
  private async handleActivityBackButton(chatId: number, userId: number, data: string): Promise<void> {
    // Parse: simulate_activity_back_accountType_tier
    const parts = data.split('_');
    const accountType = parts[3] || 'personal';
    const tier = parts[4] || 'basic';

    // Go back to activity selection for the account type and tier
    await this.handleActivitySelection(chatId, userId, `simulate_activity_${accountType}_${tier}_medium`);
  }

  /**
   * Handle tier back button
   */
  private async handleTierBackButton(chatId: number, userId: number, data: string): Promise<void> {
    // Parse: simulate_tier_back_accountType
    const parts = data.split('_');
    const accountType = parts[3] || 'personal';

    // Go back to account type selection
    await this.handleAccountTypeSelection(chatId, userId, accountType);
  }

  /**
   * Handle account type selection (unified method)
   */
  private async handleAccountTypeSelection(chatId: number, userId: number, accountType: string): Promise<void> {
    switch (accountType) {
      case 'personal':
        await this.handlePersonalAccountSimulation(chatId, userId);
        break;
      case 'business':
        await this.handleBusinessAccountSimulation(chatId, userId);
        break;
      case 'creator':
        await this.handleCreatorAccountSimulation(chatId, userId);
        break;
      case 'government':
        await this.handleGovernmentAccountSimulation(chatId, userId);
        break;
      default:
        await this.handleSimulateCommand({ chat: { id: chatId }, from: { id: userId } } as any);
        break;
    }
  }
}
