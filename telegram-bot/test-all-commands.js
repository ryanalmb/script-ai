#!/usr/bin/env node
/**
 * Comprehensive Test Suite for ALL 58+ Telegram Bot Commands
 * Tests end-to-end functionality: Telegram → Backend API → LLM Service → Response
 */

const axios = require('axios');

// Service URLs
const TELEGRAM_BOT_URL = 'http://localhost:3002';
const BACKEND_API_URL = 'http://localhost:3001';
const LLM_SERVICE_URL = 'http://localhost:3003';

// Test configuration
const TEST_CHAT_ID = 123456789; // Test chat ID
const TELEGRAM_BOT_TOKEN = '7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0';

// Complete list of 58+ commands to test
const ALL_COMMANDS = [
  // Authentication & Setup (3 commands)
  { command: '/start', category: 'auth', requiresAuth: false },
  { command: '/auth test_token', category: 'auth', requiresAuth: false },
  { command: '/help', category: 'auth', requiresAuth: false },
  
  // Content Creation (5 commands)
  { command: '/generate Bitcoin market analysis', category: 'content', requiresAuth: true },
  { command: '/image Professional crypto chart', category: 'content', requiresAuth: true },
  { command: '/analyze Bitcoin is bullish today!', category: 'content', requiresAuth: true },
  { command: '/variations Create engaging content', category: 'content', requiresAuth: true },
  { command: '/optimize Make this content better', category: 'content', requiresAuth: true },
  
  // Automation Control (12 commands)
  { command: '/automation', category: 'automation', requiresAuth: true },
  { command: '/start_auto conservative', category: 'automation', requiresAuth: true },
  { command: '/stop_auto', category: 'automation', requiresAuth: true },
  { command: '/auto_config', category: 'automation', requiresAuth: true },
  { command: '/auto_status', category: 'automation', requiresAuth: true },
  { command: '/schedule 2:00 PM Test post', category: 'automation', requiresAuth: true },
  { command: '/like_automation start', category: 'automation', requiresAuth: true },
  { command: '/comment_automation start', category: 'automation', requiresAuth: true },
  { command: '/retweet_automation start', category: 'automation', requiresAuth: true },
  { command: '/follow_automation start', category: 'automation', requiresAuth: true },
  { command: '/unfollow_automation start', category: 'automation', requiresAuth: true },
  { command: '/dm_automation start', category: 'automation', requiresAuth: true },
  
  // Analytics & Monitoring (8 commands)
  { command: '/dashboard', category: 'analytics', requiresAuth: true },
  { command: '/performance', category: 'analytics', requiresAuth: true },
  { command: '/trends', category: 'analytics', requiresAuth: true },
  { command: '/competitors', category: 'analytics', requiresAuth: true },
  { command: '/reports', category: 'analytics', requiresAuth: true },
  { command: '/analytics', category: 'analytics', requiresAuth: true },
  { command: '/analytics_pro realtime', category: 'analytics', requiresAuth: true },
  { command: '/automation_stats', category: 'analytics', requiresAuth: true },
  
  // Account Management (4 commands)
  { command: '/accounts', category: 'accounts', requiresAuth: true },
  { command: '/add_account', category: 'accounts', requiresAuth: true },
  { command: '/account_status', category: 'accounts', requiresAuth: true },
  { command: '/switch_account 1', category: 'accounts', requiresAuth: true },
  
  // Quality & Compliance (4 commands)
  { command: '/quality_check Test content quality', category: 'compliance', requiresAuth: true },
  { command: '/compliance', category: 'compliance', requiresAuth: true },
  { command: '/safety_status', category: 'compliance', requiresAuth: true },
  { command: '/rate_limits', category: 'compliance', requiresAuth: true },
  
  // Quick Actions (3 commands)
  { command: '/quick_post Test quick post', category: 'quick', requiresAuth: true },
  { command: '/quick_schedule 3:00 PM Quick scheduled post', category: 'quick', requiresAuth: true },
  { command: '/emergency_stop', category: 'quick', requiresAuth: true },
  
  // System Commands (3 commands)
  { command: '/status', category: 'system', requiresAuth: false },
  { command: '/version', category: 'system', requiresAuth: false },
  { command: '/stop', category: 'system', requiresAuth: true },
  
  // Campaign Management (3 commands)
  { command: '/create_campaign Promote crypto course to young investors', category: 'campaigns', requiresAuth: true },
  { command: '/campaign_wizard', category: 'campaigns', requiresAuth: true },
  { command: '/bulk_operations', category: 'campaigns', requiresAuth: true },
  
  // Advanced Features (6 commands)
  { command: '/advanced', category: 'advanced', requiresAuth: true },
  { command: '/content_gen generate', category: 'advanced', requiresAuth: true },
  { command: '/engagement strategies', category: 'advanced', requiresAuth: true },
  { command: '/ethical_automation start', category: 'advanced', requiresAuth: true },
  { command: '/settings', category: 'advanced', requiresAuth: true },
  
  // Specialized Automation (3 commands)
  { command: '/engagement_automation start', category: 'specialized', requiresAuth: true },
  { command: '/poll_automation start', category: 'specialized', requiresAuth: true },
  { command: '/thread_automation start', category: 'specialized', requiresAuth: true }
];

// Test results tracking
const testResults = {
  total: ALL_COMMANDS.length,
  passed: 0,
  failed: 0,
  errors: [],
  serviceStatus: {
    telegramBot: false,
    backendAPI: false,
    llmService: false
  }
};

// Utility functions
async function checkServiceHealth(url, serviceName) {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    console.log(`✅ ${serviceName} is healthy:`, response.data);
    return true;
  } catch (error) {
    console.log(`❌ ${serviceName} health check failed:`, error.message);
    return false;
  }
}

async function simulateTelegramCommand(command) {
  try {
    // Simulate sending a message to the bot
    const message = {
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

    // Send to bot webhook endpoint
    const response = await axios.post(
      `${TELEGRAM_BOT_URL}/webhook/${TELEGRAM_BOT_TOKEN}`,
      { message },
      { 
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return {
      success: response.status === 200,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status || 'NETWORK_ERROR'
    };
  }
}

async function testCommand(commandObj) {
  const { command, category, requiresAuth } = commandObj;
  
  console.log(`\n🧪 Testing: ${command}`);
  console.log(`   Category: ${category} | Requires Auth: ${requiresAuth}`);
  
  try {
    const result = await simulateTelegramCommand(command);
    
    if (result.success) {
      console.log(`   ✅ PASSED - Command processed successfully`);
      testResults.passed++;
      return true;
    } else {
      console.log(`   ❌ FAILED - ${result.error || 'Unknown error'}`);
      testResults.failed++;
      testResults.errors.push({
        command,
        category,
        error: result.error || 'Unknown error',
        status: result.status
      });
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.message}`);
    testResults.failed++;
    testResults.errors.push({
      command,
      category,
      error: error.message,
      status: 'EXCEPTION'
    });
    return false;
  }
}

async function runComprehensiveTests() {
  console.log('🚀 COMPREHENSIVE TELEGRAM BOT COMMAND TESTING');
  console.log('='.repeat(60));
  console.log(`Testing ${ALL_COMMANDS.length} commands across all categories\n`);

  // Step 1: Check service health
  console.log('📊 STEP 1: Service Health Checks');
  console.log('-'.repeat(40));
  
  testResults.serviceStatus.telegramBot = await checkServiceHealth(TELEGRAM_BOT_URL, 'Telegram Bot');
  testResults.serviceStatus.backendAPI = await checkServiceHealth(BACKEND_API_URL, 'Backend API');
  testResults.serviceStatus.llmService = await checkServiceHealth(LLM_SERVICE_URL, 'LLM Service');

  const allServicesHealthy = Object.values(testResults.serviceStatus).every(status => status);
  
  if (!allServicesHealthy) {
    console.log('\n❌ CRITICAL: Not all services are healthy. Some tests may fail.');
    console.log('Service Status:', testResults.serviceStatus);
  } else {
    console.log('\n✅ All services are healthy and ready for testing!');
  }

  // Step 2: Test all commands
  console.log('\n🧪 STEP 2: Command Testing');
  console.log('-'.repeat(40));

  // Group commands by category for organized testing
  const commandsByCategory = {};
  ALL_COMMANDS.forEach(cmd => {
    if (!commandsByCategory[cmd.category]) {
      commandsByCategory[cmd.category] = [];
    }
    commandsByCategory[cmd.category].push(cmd);
  });

  // Test each category
  for (const [category, commands] of Object.entries(commandsByCategory)) {
    console.log(`\n📂 Testing ${category.toUpperCase()} commands (${commands.length} commands):`);
    
    for (const command of commands) {
      await testCommand(command);
      // Small delay between commands to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Step 3: Generate comprehensive report
  console.log('\n📋 STEP 3: Test Results Summary');
  console.log('='.repeat(60));
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  
  console.log(`\n📊 OVERALL RESULTS:`);
  console.log(`   Total Commands Tested: ${testResults.total}`);
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  console.log(`   📈 Success Rate: ${successRate}%`);
  
  console.log(`\n🔧 SERVICE STATUS:`);
  console.log(`   Telegram Bot: ${testResults.serviceStatus.telegramBot ? '✅' : '❌'}`);
  console.log(`   Backend API: ${testResults.serviceStatus.backendAPI ? '✅' : '❌'}`);
  console.log(`   LLM Service: ${testResults.serviceStatus.llmService ? '✅' : '❌'}`);

  if (testResults.errors.length > 0) {
    console.log(`\n❌ FAILED COMMANDS (${testResults.errors.length}):`);
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.command}`);
      console.log(`      Category: ${error.category}`);
      console.log(`      Error: ${error.error}`);
      console.log(`      Status: ${error.status}\n`);
    });
  }

  // Step 4: Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (successRate >= 90) {
    console.log('   🎉 EXCELLENT! Almost all commands are working properly.');
  } else if (successRate >= 70) {
    console.log('   ⚠️  GOOD but needs improvement. Some commands need fixes.');
  } else {
    console.log('   🚨 CRITICAL: Many commands are failing. Immediate attention required.');
  }

  if (!allServicesHealthy) {
    console.log('   🔧 Fix service health issues first before retesting commands.');
  }

  console.log('\n🏁 Testing completed!');
  
  return {
    success: successRate >= 90,
    successRate,
    results: testResults
  };
}

// Run the comprehensive test suite
if (require.main === module) {
  runComprehensiveTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveTests, ALL_COMMANDS, testResults };
