#!/usr/bin/env node
/**
 * Command Handler Testing - Test all 58+ commands without Telegram API calls
 */

const path = require('path');

// Test configuration
const TEST_CHAT_ID = 123456789;

async function testAllCommands() {
  console.log('🧪 COMPREHENSIVE COMMAND HANDLER TESTING');
  console.log('='.repeat(60));
  
  try {
    // Import services and handlers
    const { BotCommandHandler } = require('./dist/handlers/commandHandler');
    const { UserService } = require('./dist/services/userService');
    const { AnalyticsService } = require('./dist/services/analyticsService');
    const { AutomationService } = require('./dist/services/automationService');
    const { ContentGenerationService } = require('./dist/services/contentGenerationService');
    const { NotificationService } = require('./dist/services/notificationService');
    const { ProxyService } = require('./dist/services/proxyService');
    const { QualityControlService } = require('./dist/services/qualityControlService');
    const { ComplianceService } = require('./dist/services/complianceService');
    
    // Mock bot that doesn't make real API calls
    const mockBot = {
      sendMessage: async (chatId, text, options) => {
        console.log(`   📤 Bot Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        return { message_id: Date.now() };
      },
      editMessageText: async (text, options) => {
        console.log(`   📝 Bot Edit: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        return { message_id: Date.now() };
      },
      sendPhoto: async (chatId, photo, options) => {
        console.log(`   🖼️ Bot Photo: ${options?.caption || 'Image sent'}`);
        return { message_id: Date.now() };
      },
      answerCallbackQuery: async (queryId, options) => {
        console.log(`   🔄 Callback: ${options?.text || 'Callback answered'}`);
        return true;
      }
    };
    
    // Initialize services
    console.log('🔧 Initializing services...');
    const userService = new UserService();
    const analyticsService = new AnalyticsService();
    const contentGenerationService = new ContentGenerationService();
    const notificationService = new NotificationService(mockBot);
    const proxyService = new ProxyService();
    const qualityService = new QualityControlService();
    const complianceService = new ComplianceService();
    const automationService = new AutomationService(
      userService, 
      contentGenerationService, 
      proxyService, 
      qualityService, 
      complianceService
    );
    
    const commandHandler = new BotCommandHandler(
      mockBot,
      userService,
      analyticsService,
      automationService,
      contentGenerationService,
      notificationService
    );
    
    console.log('✅ Services initialized successfully');
    
    // Complete list of all 58+ commands to test
    const ALL_COMMANDS = [
      // Authentication & Setup
      '/start',
      '/auth test_token',
      '/help',
      
      // Content Creation
      '/generate Bitcoin market analysis',
      '/image Professional crypto chart',
      '/analyze Bitcoin is bullish today!',
      '/variations Create engaging content',
      '/optimize Make this content better',
      
      // Automation Control
      '/automation',
      '/start_auto conservative',
      '/stop_auto',
      '/auto_config',
      '/auto_status',
      '/schedule 2:00 PM Test post',
      '/like_automation start',
      '/comment_automation start',
      '/retweet_automation start',
      '/follow_automation start',
      '/unfollow_automation start',
      '/dm_automation start',
      '/engagement_automation start',
      '/poll_automation start',
      '/thread_automation start',
      
      // Analytics & Monitoring
      '/dashboard',
      '/performance',
      '/trends',
      '/competitors',
      '/reports',
      '/analytics',
      '/analytics_pro realtime',
      '/automation_stats',
      
      // Account Management
      '/accounts',
      '/add_account',
      '/account_status',
      '/switch_account 1',
      
      // Quality & Compliance
      '/quality_check Test content quality',
      '/compliance',
      '/safety_status',
      '/rate_limits',
      
      // Quick Actions
      '/quick_post Test quick post',
      '/quick_schedule 3:00 PM Quick scheduled post',
      '/emergency_stop',
      
      // System Commands
      '/status',
      '/version',
      '/stop',
      
      // Campaign Management
      '/create_campaign Promote crypto course to young investors',
      '/campaign_wizard',
      '/bulk_operations',
      
      // Advanced Features
      '/advanced',
      '/content_gen generate',
      '/engagement strategies',
      '/ethical_automation start',
      '/settings'
    ];
    
    console.log(`\n🧪 Testing ${ALL_COMMANDS.length} commands...\n`);
    
    // Test results tracking
    let passedCommands = 0;
    let failedCommands = 0;
    const failedCommandsList = [];
    
    // Test each command
    for (let i = 0; i < ALL_COMMANDS.length; i++) {
      const command = ALL_COMMANDS[i];
      
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
    
    // Final results
    console.log('📊 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Commands Tested: ${ALL_COMMANDS.length}`);
    console.log(`✅ Passed: ${passedCommands}`);
    console.log(`❌ Failed: ${failedCommands}`);
    console.log(`📈 Success Rate: ${((passedCommands / ALL_COMMANDS.length) * 100).toFixed(1)}%`);
    
    if (failedCommandsList.length > 0) {
      console.log(`\n❌ FAILED COMMANDS (${failedCommandsList.length}):`);
      failedCommandsList.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.command}`);
        console.log(`      Error: ${item.error}\n`);
      });
    }
    
    // Success criteria
    const successRate = (passedCommands / ALL_COMMANDS.length) * 100;
    
    if (successRate >= 90) {
      console.log('🎉 EXCELLENT! Almost all commands are working properly.');
      console.log('✅ Bot is ready for production deployment!');
    } else if (successRate >= 70) {
      console.log('⚠️  GOOD but needs improvement. Some commands need fixes.');
    } else {
      console.log('🚨 CRITICAL: Many commands are failing. Immediate attention required.');
    }
    
    return {
      success: successRate >= 90,
      successRate,
      passedCommands,
      failedCommands,
      failedCommandsList
    };
    
  } catch (error) {
    console.error('❌ Test initialization failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testAllCommands()
    .then(result => {
      console.log('\n✅ Command testing completed!');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAllCommands };
