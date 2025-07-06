#!/usr/bin/env node

/**
 * Local Integration Testing Script
 * Tests all platform features and integrations locally
 */

const http = require('http');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Make HTTP request
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            headers: res.headers
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test user authentication flow
 */
async function testAuthFlow() {
  log('\n🔐 Testing Authentication Flow...', 'cyan');

  const testUser = {
    email: `test_${Date.now()}@example.com`,
    username: `testuser_${Date.now()}`,
    password: 'SecurePassword123!'
  };

  try {
    // Test user registration
    log('Testing user registration...', 'blue');
    const registerResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, testUser);

    if (registerResponse.statusCode === 201) {
      log('✅ User registration successful', 'green');
    } else {
      log(`❌ User registration failed: ${registerResponse.statusCode}`, 'red');
      return false;
    }

    // Test user login
    log('Testing user login...', 'blue');
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: testUser.email,
      password: testUser.password
    });

    if (loginResponse.statusCode === 200 && loginResponse.data.token) {
      log('✅ User login successful', 'green');
      return loginResponse.data.token;
    } else {
      log(`❌ User login failed: ${loginResponse.statusCode}`, 'red');
      return false;
    }

  } catch (error) {
    log(`❌ Auth flow test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test X account management
 */
async function testAccountManagement(authToken) {
  log('\n📱 Testing X Account Management...', 'cyan');

  const testAccount = {
    username: 'test_x_account',
    displayName: 'Test X Account',
    accessToken: 'test_access_token',
    accessTokenSecret: 'test_access_token_secret'
  };

  try {
    // Test adding X account
    log('Testing X account addition...', 'blue');
    const addAccountResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/accounts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, testAccount);

    if (addAccountResponse.statusCode === 201) {
      log('✅ X account addition successful', 'green');
      return addAccountResponse.data.id;
    } else {
      log(`❌ X account addition failed: ${addAccountResponse.statusCode}`, 'red');
      return false;
    }

  } catch (error) {
    log(`❌ Account management test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test content generation
 */
async function testContentGeneration() {
  log('\n🧠 Testing Content Generation...', 'cyan');

  try {
    // Test LLM service health
    log('Testing LLM service health...', 'blue');
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3003,
      path: '/health',
      method: 'GET'
    });

    if (healthResponse.statusCode === 200) {
      log('✅ LLM service is healthy', 'green');
    } else {
      log('⚠️  LLM service health check failed', 'yellow');
    }

    // Test content generation
    log('Testing content generation...', 'blue');
    const generateResponse = await makeRequest({
      hostname: 'localhost',
      port: 3003,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      prompt: 'Generate a short crypto market analysis tweet',
      model: 'test',
      max_tokens: 280
    });

    if (generateResponse.statusCode === 200) {
      log('✅ Content generation successful', 'green');
      log(`Generated: ${generateResponse.data.content || 'Test content'}`, 'blue');
      return true;
    } else {
      log(`⚠️  Content generation failed: ${generateResponse.statusCode}`, 'yellow');
      return false;
    }

  } catch (error) {
    log(`⚠️  Content generation test failed: ${error.message}`, 'yellow');
    return false;
  }
}

/**
 * Test campaign management
 */
async function testCampaignManagement(authToken, accountId) {
  log('\n📊 Testing Campaign Management...', 'cyan');

  const testCampaign = {
    name: 'Test Campaign',
    description: 'Test campaign for integration testing',
    settings: {
      postFrequency: 'daily',
      contentType: 'mixed'
    }
  };

  try {
    // Test campaign creation
    log('Testing campaign creation...', 'blue');
    const createResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/campaigns',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, testCampaign);

    if (createResponse.statusCode === 201) {
      log('✅ Campaign creation successful', 'green');
      return createResponse.data.id;
    } else {
      log(`❌ Campaign creation failed: ${createResponse.statusCode}`, 'red');
      return false;
    }

  } catch (error) {
    log(`❌ Campaign management test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test automation features
 */
async function testAutomationFeatures(authToken, accountId) {
  log('\n🤖 Testing Automation Features...', 'cyan');

  const testAutomation = {
    type: 'content_posting',
    config: {
      frequency: 'daily',
      time: '09:00',
      contentType: 'generated'
    },
    schedule: {
      enabled: true,
      timezone: 'UTC'
    }
  };

  try {
    // Test automation creation
    log('Testing automation creation...', 'blue');
    const createResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/accounts/${accountId}/automations`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, testAutomation);

    if (createResponse.statusCode === 201) {
      log('✅ Automation creation successful', 'green');
      return createResponse.data.id;
    } else {
      log(`❌ Automation creation failed: ${createResponse.statusCode}`, 'red');
      return false;
    }

  } catch (error) {
    log(`❌ Automation test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test advanced features
 */
async function testAdvancedFeatures(authToken, accountId) {
  log('\n🚀 Testing Advanced Features...', 'cyan');

  try {
    // Test analytics endpoint
    log('Testing analytics...', 'blue');
    const analyticsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/accounts/${accountId}/analytics`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (analyticsResponse.statusCode === 200) {
      log('✅ Analytics endpoint working', 'green');
    } else {
      log(`⚠️  Analytics endpoint failed: ${analyticsResponse.statusCode}`, 'yellow');
    }

    // Test compliance monitoring
    log('Testing compliance monitoring...', 'blue');
    const complianceResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/accounts/${accountId}/compliance`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (complianceResponse.statusCode === 200) {
      log('✅ Compliance monitoring working', 'green');
    } else {
      log(`⚠️  Compliance monitoring failed: ${complianceResponse.statusCode}`, 'yellow');
    }

    return true;

  } catch (error) {
    log(`⚠️  Advanced features test failed: ${error.message}`, 'yellow');
    return false;
  }
}

/**
 * Test Telegram bot
 */
async function testTelegramBot() {
  log('\n📱 Testing Telegram Bot...', 'cyan');

  try {
    // Test bot health
    log('Testing Telegram bot health...', 'blue');
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/health',
      method: 'GET'
    });

    if (healthResponse.statusCode === 200) {
      log('✅ Telegram bot is healthy', 'green');
    } else {
      log(`⚠️  Telegram bot health check failed: ${healthResponse.statusCode}`, 'yellow');
    }

    // Test webhook endpoint
    log('Testing webhook endpoint...', 'blue');
    const webhookResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      message: {
        chat: { id: 123456789 },
        text: '/start'
      }
    });

    if (webhookResponse.statusCode === 200) {
      log('✅ Webhook endpoint working', 'green');
    } else {
      log(`⚠️  Webhook endpoint failed: ${webhookResponse.statusCode}`, 'yellow');
    }

    return true;

  } catch (error) {
    log(`⚠️  Telegram bot test failed: ${error.message}`, 'yellow');
    return false;
  }
}

/**
 * Test database operations
 */
async function testDatabaseOperations() {
  log('\n🗄️  Testing Database Operations...', 'cyan');

  try {
    // Test database connection and basic operations
    log('Testing database connection...', 'blue');
    
    const testScript = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      async function test() {
        try {
          await prisma.$connect();
          const userCount = await prisma.user.count();
          console.log('Database connected. User count:', userCount);
          
          // Test creating and deleting a test record
          const testUser = await prisma.user.create({
            data: {
              email: 'test_db_${Date.now()}@example.com',
              username: 'test_db_user_${Date.now()}',
              passwordHash: 'test_hash'
            }
          });
          
          await prisma.user.delete({
            where: { id: testUser.id }
          });
          
          console.log('Database operations successful');
          await prisma.$disconnect();
          process.exit(0);
        } catch (error) {
          console.error('Database test failed:', error.message);
          process.exit(1);
        }
      }
      
      test();
    `;

    const { stdout, stderr } = await execAsync(`cd backend && node -e "${testScript}"`);
    
    if (stdout.includes('Database operations successful')) {
      log('✅ Database operations working', 'green');
      return true;
    } else {
      log(`❌ Database operations failed: ${stderr}`, 'red');
      return false;
    }

  } catch (error) {
    log(`❌ Database test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test Redis operations
 */
async function testRedisOperations() {
  log('\n🔄 Testing Redis Operations...', 'cyan');

  try {
    // Test Redis connection and operations
    log('Testing Redis connection...', 'blue');
    
    const { stdout } = await execAsync('redis-cli ping');
    if (stdout.trim() === 'PONG') {
      log('✅ Redis connection working', 'green');
    } else {
      log('❌ Redis connection failed', 'red');
      return false;
    }

    // Test Redis operations
    log('Testing Redis operations...', 'blue');
    await execAsync('redis-cli set test_key "test_value"');
    const { stdout: getValue } = await execAsync('redis-cli get test_key');
    await execAsync('redis-cli del test_key');

    if (getValue.trim() === '"test_value"') {
      log('✅ Redis operations working', 'green');
      return true;
    } else {
      log('❌ Redis operations failed', 'red');
      return false;
    }

  } catch (error) {
    log(`❌ Redis test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Main integration test function
 */
async function runIntegrationTests() {
  log('🧪 X Marketing Platform - Integration Tests', 'cyan');
  log('============================================\n', 'cyan');

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // Test database operations
  const dbTest = await testDatabaseOperations();
  dbTest ? results.passed++ : results.failed++;

  // Test Redis operations
  const redisTest = await testRedisOperations();
  redisTest ? results.passed++ : results.failed++;

  // Test authentication flow
  const authToken = await testAuthFlow();
  authToken ? results.passed++ : results.failed++;

  if (!authToken) {
    log('\n❌ Cannot continue tests without authentication', 'red');
    return;
  }

  // Test account management
  const accountId = await testAccountManagement(authToken);
  accountId ? results.passed++ : results.failed++;

  // Test content generation
  const contentTest = await testContentGeneration();
  contentTest ? results.passed++ : results.warnings++;

  // Test campaign management
  if (accountId) {
    const campaignTest = await testCampaignManagement(authToken, accountId);
    campaignTest ? results.passed++ : results.failed++;

    // Test automation features
    const automationTest = await testAutomationFeatures(authToken, accountId);
    automationTest ? results.passed++ : results.failed++;

    // Test advanced features
    const advancedTest = await testAdvancedFeatures(authToken, accountId);
    advancedTest ? results.passed++ : results.warnings++;
  }

  // Test Telegram bot
  const telegramTest = await testTelegramBot();
  telegramTest ? results.passed++ : results.warnings++;

  // Summary
  log('\n📊 Integration Test Summary:', 'cyan');
  log('===========================', 'cyan');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`⚠️  Warnings: ${results.warnings}`, 'yellow');

  if (results.failed === 0) {
    log('\n🎉 All critical tests passed!', 'green');
    log('Platform is ready for use.', 'green');
  } else {
    log(`\n❌ ${results.failed} critical tests failed.`, 'red');
    log('Please fix the issues before proceeding.', 'red');
  }

  if (results.warnings > 0) {
    log(`\n⚠️  ${results.warnings} non-critical features have issues.`, 'yellow');
    log('Some advanced features may not work properly.', 'yellow');
  }
}

// Run tests if called directly
if (require.main === module) {
  runIntegrationTests().catch(error => {
    log(`Integration tests failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runIntegrationTests };
