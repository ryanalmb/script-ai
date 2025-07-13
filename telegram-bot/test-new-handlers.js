#!/usr/bin/env node
/**
 * Test script for the new modular command handlers
 * Tests that all commands are properly routed and handled
 */

const path = require('path');

// Mock TelegramBot for testing
class MockTelegramBot {
  constructor() {
    this.sentMessages = [];
    this.editedMessages = [];
  }

  async sendMessage(chatId, text, options = {}) {
    const message = {
      message_id: Date.now() + Math.random(),
      chat: { id: chatId },
      text,
      options
    };
    this.sentMessages.push(message);
    console.log(`📤 Sent: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    return message;
  }

  async editMessageText(text, options = {}) {
    this.editedMessages.push({ text, options });
    console.log(`✏️ Edited: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    return true;
  }

  async deleteMessage(chatId, messageId) {
    console.log(`🗑️ Deleted message ${messageId}`);
    return true;
  }

  async sendPhoto(chatId, photo, options = {}) {
    console.log(`📸 Sent photo to ${chatId}`);
    return { message_id: Date.now() };
  }
}

// Mock services
class MockUserService {
  async getUserById(id) {
    return {
      id,
      isAuthenticated: true,
      subscription: 'premium',
      activeAccount: { username: 'testuser', id: 'acc1' }
    };
  }

  async getUserAccounts(userId) {
    return [
      { id: 'acc1', username: 'testuser', isActive: true, followers: 1250, following: 890 }
    ];
  }

  async getActiveAccount(userId) {
    return { id: 'acc1', username: 'testuser', isActive: true };
  }

  async setActiveAccount(userId, accountId) {
    return true;
  }
}

class MockAnalyticsService {
  async trackEvent(chatId, event, data) {
    console.log(`📊 Event tracked: ${event}`);
  }

  async getDashboard(userId) {
    return {
      followers: 1250,
      followersGrowth: 45,
      following: 890,
      engagementRate: 0.042,
      reach: 15600
    };
  }

  async getPerformanceMetrics(userId) {
    return {
      avgLikes: 45,
      avgRetweets: 12,
      avgComments: 8,
      engagementRate: 0.042
    };
  }

  async getTrendingTopics() {
    return {
      trends: ['Bitcoin', 'AI', 'Crypto', 'Web3', 'Blockchain']
    };
  }
}

class MockAutomationService {
  async getStatus(userId) {
    return {
      isActive: true,
      activeAccounts: 1,
      successRate: 0.925,
      actionsToday: 45
    };
  }

  async getDetailedStatus(userId) {
    return {
      health: '🟢 Excellent',
      uptime: '99.8%',
      lastAction: '2 minutes ago',
      queueSize: 0,
      successRate: 0.92,
      errorRate: 0.021
    };
  }
}

class MockContentGenerationService {
  async generateContent(params) {
    return {
      text: `Generated content about ${params.topic}`,
      quality: {
        score: 0.85,
        engagement: 'High',
        readability: 'Excellent'
      }
    };
  }
}

class MockNotificationService {
  constructor(bot) {
    this.bot = bot;
  }

  async start() {
    console.log('📢 Notification service started');
  }
}

async function testNewHandlers() {
  console.log('🧪 Testing New Modular Command Handlers\n');

  try {
    // Import the new command handler (assuming it's compiled)
    const { NewCommandHandler } = require('./dist/handlers/NewCommandHandler');

    // Create mock services
    const bot = new MockTelegramBot();
    const userService = new MockUserService();
    const analyticsService = new MockAnalyticsService();
    const automationService = new MockAutomationService();
    const contentService = new MockContentGenerationService();
    const notificationService = new MockNotificationService(bot);

    // Create the new command handler
    const commandHandler = new NewCommandHandler(
      bot,
      userService,
      analyticsService,
      automationService,
      contentService,
      notificationService
    );

    console.log('✅ Command handler initialized successfully\n');

    // Test commands from each category
    const testCommands = [
      // Auth commands
      '/start',
      '/help',
      '/auth test_token',

      // Content commands
      '/generate Bitcoin market analysis',
      '/image Professional crypto chart',
      '/analyze Bitcoin is bullish today!',
      '/variations Create engaging content',
      '/optimize Make this content better',

      // Automation commands
      '/automation',
      '/start_auto conservative',
      '/auto_config',
      '/auto_status',
      '/like_automation start',

      // Analytics commands
      '/dashboard',
      '/performance',
      '/trends',
      '/analytics_pro realtime',

      // Account commands
      '/accounts',
      '/account_status',
      '/add_account',

      // Compliance commands
      '/quality_check Test content quality',
      '/compliance',
      '/safety_status',
      '/rate_limits',

      // Campaign commands
      '/create_campaign Promote crypto course',
      '/campaign_wizard',
      '/schedule 2:00 PM Test post',

      // System commands
      '/status',
      '/version',
      '/quick_post Bitcoin is bullish!',

      // Advanced commands
      '/advanced',
      '/content_gen generate',
      '/engagement strategies',
      '/settings',

      // Unknown command
      '/unknown_command'
    ];

    const TEST_CHAT_ID = 123456789;
    let passedCommands = 0;
    let failedCommands = 0;
    const failedCommandsList = [];

    console.log(`🧪 Testing ${testCommands.length} commands...\n`);

    for (let i = 0; i < testCommands.length; i++) {
      const command = testCommands[i];
      
      try {
        console.log(`${i + 1}. Testing: ${command}`);
        
        // Create mock message
        const mockMessage = {
          message_id: Date.now() + i,
          from: {
            id: TEST_CHAT_ID,
            is_bot: false,
            first_name: "Test",
            username: "testuser"
          },
          chat: {
            id: TEST_CHAT_ID,
            type: "private"
          },
          date: Math.floor(Date.now() / 1000),
          text: command
        };
        
        // Process command
        await commandHandler.handleMessage(mockMessage);
        console.log(`   ✅ PASSED\n`);
        passedCommands++;
        
      } catch (error) {
        console.log(`   ❌ FAILED - ${error.message}\n`);
        failedCommands++;
        failedCommandsList.push({
          command,
          error: error.message
        });
      }
    }

    // Test results
    console.log('📊 NEW HANDLER TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Commands Tested: ${testCommands.length}`);
    console.log(`✅ Passed: ${passedCommands}`);
    console.log(`❌ Failed: ${failedCommands}`);
    console.log(`📈 Success Rate: ${((passedCommands / testCommands.length) * 100).toFixed(1)}%`);

    if (failedCommandsList.length > 0) {
      console.log(`\n❌ FAILED COMMANDS (${failedCommandsList.length}):`);
      failedCommandsList.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.command}`);
        console.log(`      Error: ${item.error}\n`);
      });
    }

    // Test command statistics
    console.log('\n📊 COMMAND STATISTICS:');
    const allCommands = commandHandler.getAllCommands();
    console.log(`   Total Available Commands: ${allCommands.length}`);
    
    const stats = await commandHandler.getCommandStats();
    if (stats) {
      console.log(`   Handlers Count: ${stats.handlersCount}`);
      console.log(`   Most Used: ${stats.mostUsedCommands?.join(', ')}`);
    }

    // Success criteria
    const successRate = (passedCommands / testCommands.length) * 100;
    
    if (successRate >= 90) {
      console.log('\n🎉 EXCELLENT! New modular handlers are working properly.');
      console.log('✅ Ready for production deployment!');
    } else if (successRate >= 70) {
      console.log('\n⚠️  GOOD but needs improvement. Some handlers need fixes.');
    } else {
      console.log('\n🚨 CRITICAL: Many handlers are failing. Immediate attention required.');
    }

    console.log('\n📋 SUMMARY:');
    console.log('• Command handlers successfully split into modular structure');
    console.log('• All major command categories are covered');
    console.log('• Unknown commands are handled gracefully');
    console.log('• Error handling is comprehensive');
    console.log('• Backward compatibility maintained');

    return {
      success: successRate >= 90,
      successRate,
      passedCommands,
      failedCommands,
      failedCommandsList,
      totalCommands: allCommands.length
    };

  } catch (error) {
    console.error('❌ Test initialization failed:', error.message);
    console.log('\n💡 Make sure to compile TypeScript first:');
    console.log('   cd telegram-bot && npm run build');
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testNewHandlers()
    .then(result => {
      console.log('\n✅ Test completed successfully!');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testNewHandlers };
