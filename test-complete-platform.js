#!/usr/bin/env node
/**
 * Complete X Marketing Platform Testing Suite
 * Tests all services and features including natural language campaign creation
 */

const http = require('http');
const https = require('https');
const fs = require('fs');

console.log('🚀 Starting Complete X Marketing Platform Testing...\n');

// Test configuration
const services = {
  backend: { host: 'localhost', port: 3001, protocol: 'http' },
  frontend: { host: 'localhost', port: 3000, protocol: 'http' },
  telegramBot: { host: 'localhost', port: 3002, protocol: 'http' },
  llmService: { host: 'localhost', port: 3003, protocol: 'http' }
};

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve) => {
    const client = options.protocol === 'https' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = data ? JSON.parse(data) : {};
          resolve({
            success: true,
            status: res.statusCode,
            headers: res.headers,
            data: response,
            rawData: data
          });
        } catch (error) {
          resolve({
            success: true,
            status: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        status: 'ERROR'
      });
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Test functions
async function testBackendAPI() {
  console.log('🔧 Testing Backend API...\n');
  
  const tests = [
    {
      name: 'Health Check',
      path: '/health',
      method: 'GET'
    },
    {
      name: 'API Documentation',
      path: '/docs',
      method: 'GET'
    },
    {
      name: 'Campaigns List',
      path: '/api/campaigns',
      method: 'GET'
    },
    {
      name: 'Natural Language Campaign Creation',
      path: '/api/campaigns/ai-create',
      method: 'POST',
      data: JSON.stringify({
        user_prompt: "Create a 7-day crypto education campaign targeting young investors",
        user_id: "test-user-123"
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  ];

  const results = [];
  
  for (const test of tests) {
    console.log(`🧪 Testing ${test.name}...`);
    
    const options = {
      hostname: services.backend.host,
      port: services.backend.port,
      path: test.path,
      method: test.method,
      protocol: services.backend.protocol,
      headers: test.headers || {}
    };

    const result = await makeRequest(options, test.data);
    const success = result.success && result.status >= 200 && result.status < 400;
    
    console.log(`   ${success ? '✅' : '❌'} ${test.name} - Status: ${result.status}`);
    
    if (test.name === 'Natural Language Campaign Creation' && success) {
      console.log(`   📊 Campaign ID: ${result.data?.campaign_id || 'N/A'}`);
      console.log(`   🎯 Objective: ${result.data?.campaign?.plan?.objective || 'N/A'}`);
    }
    
    results.push({ name: test.name, success, status: result.status, data: result.data });
  }
  
  return results;
}

async function testLLMService() {
  console.log('\n🧠 Testing LLM Service...\n');
  
  const tests = [
    {
      name: 'Health Check',
      path: '/health',
      method: 'GET'
    },
    {
      name: 'Campaign Orchestration',
      path: '/api/orchestrate/campaign',
      method: 'POST',
      data: JSON.stringify({
        user_prompt: "I want to build a personal brand as a blockchain developer",
        user_id: "test-user-456",
        platform: "twitter"
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Content Generation',
      path: '/generate/text',
      method: 'POST',
      data: JSON.stringify({
        topic: "Bitcoin market analysis",
        tone: "professional",
        type: "tweet",
        platform: "twitter"
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  ];

  const results = [];
  
  for (const test of tests) {
    console.log(`🧪 Testing ${test.name}...`);
    
    const options = {
      hostname: services.llmService.host,
      port: services.llmService.port,
      path: test.path,
      method: test.method,
      protocol: services.llmService.protocol,
      headers: test.headers || {}
    };

    const result = await makeRequest(options, test.data);
    const success = result.success && result.status >= 200 && result.status < 400;
    
    console.log(`   ${success ? '✅' : '❌'} ${test.name} - Status: ${result.status}`);
    
    if (test.name === 'Campaign Orchestration' && success) {
      console.log(`   🎯 Campaign Created: ${result.data?.success ? 'Yes' : 'No'}`);
      console.log(`   📝 Content Pieces: ${result.data?.campaign?.content?.length || 0}`);
    }
    
    results.push({ name: test.name, success, status: result.status, data: result.data });
  }
  
  return results;
}

async function testTelegramBot() {
  console.log('\n🤖 Testing Telegram Bot Service...\n');
  
  const tests = [
    {
      name: 'Health Check',
      path: '/health',
      method: 'GET'
    },
    {
      name: 'Bot Status',
      path: '/status',
      method: 'GET'
    }
  ];

  const results = [];
  
  for (const test of tests) {
    console.log(`🧪 Testing ${test.name}...`);
    
    const options = {
      hostname: services.telegramBot.host,
      port: services.telegramBot.port,
      path: test.path,
      method: test.method,
      protocol: services.telegramBot.protocol
    };

    const result = await makeRequest(options);
    const success = result.success && result.status >= 200 && result.status < 400;
    
    console.log(`   ${success ? '✅' : '❌'} ${test.name} - Status: ${result.status}`);
    
    results.push({ name: test.name, success, status: result.status });
  }
  
  return results;
}

async function testFrontend() {
  console.log('\n🌐 Testing Frontend...\n');
  
  const tests = [
    {
      name: 'Homepage',
      path: '/',
      method: 'GET'
    }
  ];

  const results = [];
  
  for (const test of tests) {
    console.log(`🧪 Testing ${test.name}...`);
    
    const options = {
      hostname: services.frontend.host,
      port: services.frontend.port,
      path: test.path,
      method: test.method,
      protocol: services.frontend.protocol
    };

    const result = await makeRequest(options);
    const success = result.success && result.status >= 200 && result.status < 400;
    
    console.log(`   ${success ? '✅' : '❌'} ${test.name} - Status: ${result.status}`);
    
    results.push({ name: test.name, success, status: result.status });
  }
  
  return results;
}

// Main test execution
async function runCompleteTests() {
  const startTime = Date.now();
  
  console.log('Testing X (Twitter) Marketing Automation Platform');
  console.log('==================================================\n');

  // Run all tests
  const backendResults = await testBackendAPI();
  const llmResults = await testLLMService();
  const telegramResults = await testTelegramBot();
  const frontendResults = await testFrontend();

  // Calculate results
  const allResults = [...backendResults, ...llmResults, ...telegramResults, ...frontendResults];
  const totalTests = allResults.length;
  const passedTests = allResults.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);

  // Generate report
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n📋 COMPLETE PLATFORM TEST REPORT');
  console.log('==================================================');
  console.log(`📊 Overall Results:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} ✅`);
  console.log(`   Failed: ${failedTests} ❌`);
  console.log(`   Success Rate: ${successRate}%`);
  console.log(`   Duration: ${duration}s`);

  console.log(`\n🔧 Backend API Tests: ${backendResults.filter(r => r.success).length}/${backendResults.length}`);
  console.log(`🧠 LLM Service Tests: ${llmResults.filter(r => r.success).length}/${llmResults.length}`);
  console.log(`🤖 Telegram Bot Tests: ${telegramResults.filter(r => r.success).length}/${telegramResults.length}`);
  console.log(`🌐 Frontend Tests: ${frontendResults.filter(r => r.success).length}/${frontendResults.length}`);

  // Show failed tests
  const failedTestsList = allResults.filter(r => !r.success);
  if (failedTestsList.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    failedTestsList.forEach(test => {
      console.log(`   • ${test.name}: ${test.status || 'Unknown error'}`);
    });
  }

  // Feature validation
  console.log('\n🎯 Feature Validation:');
  const naturalLanguageCampaign = allResults.find(r => r.name === 'Natural Language Campaign Creation');
  const campaignOrchestration = allResults.find(r => r.name === 'Campaign Orchestration');
  
  console.log(`   • Natural Language Campaigns: ${naturalLanguageCampaign?.success ? '✅ Working' : '❌ Failed'}`);
  console.log(`   • AI Content Generation: ${campaignOrchestration?.success ? '✅ Working' : '❌ Failed'}`);
  console.log(`   • Multi-Service Integration: ${passedTests >= 6 ? '✅ Working' : '❌ Partial'}`);

  console.log('\n==================================================');

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    duration: duration,
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: successRate
    },
    results: allResults,
    services: {
      backend: backendResults,
      llmService: llmResults,
      telegramBot: telegramResults,
      frontend: frontendResults
    }
  };

  fs.writeFileSync('complete-test-results.json', JSON.stringify(report, null, 2));
  console.log('💾 Complete test results saved to complete-test-results.json');
}

// Run the tests
runCompleteTests().catch(console.error);
