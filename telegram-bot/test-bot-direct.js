#!/usr/bin/env node
/**
 * Direct Bot Testing - Test bot commands without webhooks
 */

const TelegramBot = require('node-telegram-bot-api');

// Bot configuration
const TOKEN = '7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0';
const TEST_CHAT_ID = 123456789; // Test chat ID

// Create bot instance for testing
const bot = new TelegramBot(TOKEN, { polling: false });

// Test commands to verify
const TEST_COMMANDS = [
  '/start',
  '/help', 
  '/status',
  '/generate Bitcoin analysis',
  '/automation',
  '/accounts',
  '/analytics'
];

async function testBotDirectly() {
  console.log('🧪 DIRECT BOT TESTING');
  console.log('='.repeat(50));
  
  try {
    // Test bot connection
    const botInfo = await bot.getMe();
    console.log('✅ Bot connected successfully:');
    console.log(`   ID: ${botInfo.id}`);
    console.log(`   Username: @${botInfo.username}`);
    console.log(`   Name: ${botInfo.first_name}`);
    
    // Test sending a message
    console.log('\n📤 Testing message sending...');
    const testMessage = await bot.sendMessage(TEST_CHAT_ID, '🧪 Bot test message - please ignore');
    console.log('✅ Message sent successfully:', testMessage.message_id);
    
    // Test command processing by simulating message handling
    console.log('\n🔧 Testing command processing...');
    
    // Import the command handler
    const { BotCommandHandler } = require('./dist/handlers/commandHandler');
    const { UserService } = require('./dist/services/userService');
    const { AnalyticsService } = require('./dist/services/analyticsService');
    const { AutomationService } = require('./dist/services/automationService');
    const { ContentGenerationService } = require('./dist/services/contentGenerationService');
    const { NotificationService } = require('./dist/services/notificationService');
    
    // Initialize services
    const userService = new UserService();
    const analyticsService = new AnalyticsService();
    const contentGenerationService = new ContentGenerationService();
    const notificationService = new NotificationService(bot);
    const automationService = new AutomationService(userService, contentGenerationService);
    
    const commandHandler = new BotCommandHandler(
      bot,
      userService,
      analyticsService,
      automationService,
      contentGenerationService,
      notificationService
    );
    
    // Test each command
    let passedCommands = 0;
    let failedCommands = 0;
    
    for (const command of TEST_COMMANDS) {
      try {
        console.log(`\n🧪 Testing: ${command}`);
        
        // Create mock message
        const mockMessage = {
          message_id: Date.now(),
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
        console.log(`   ✅ PASSED - Command processed successfully`);
        passedCommands++;
        
      } catch (error) {
        console.log(`   ❌ FAILED - ${error.message}`);
        failedCommands++;
      }
    }
    
    // Results summary
    console.log('\n📊 DIRECT TEST RESULTS:');
    console.log('='.repeat(50));
    console.log(`Total Commands: ${TEST_COMMANDS.length}`);
    console.log(`✅ Passed: ${passedCommands}`);
    console.log(`❌ Failed: ${failedCommands}`);
    console.log(`📈 Success Rate: ${((passedCommands / TEST_COMMANDS.length) * 100).toFixed(1)}%`);
    
    if (passedCommands === TEST_COMMANDS.length) {
      console.log('\n🎉 ALL COMMANDS WORKING! Bot is fully functional.');
    } else {
      console.log('\n⚠️  Some commands need fixes. Check error messages above.');
    }
    
  } catch (error) {
    console.error('❌ Bot test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testBotDirectly()
    .then(() => {
      console.log('\n✅ Direct bot testing completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testBotDirectly };
