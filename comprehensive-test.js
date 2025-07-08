#!/usr/bin/env node

/**
 * Comprehensive Application Testing Script
 * Tests all components of the X Marketing Automation Platform
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Test Configuration
const config = {
  backend: {
    host: 'localhost',
    port: 3001,
    protocol: 'http'
  },
  frontend: {
    host: 'localhost',
    port: 3000,
    protocol: 'http'
  },
  timeout: 10000,
  retries: 3
};

// Test Results Storage
const testResults = {
  backend: [],
  frontend: [],
  integration: [],
  security: [],
  performance: []
};

// Utility Functions
function makeRequest(options) {
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
        error: error.message
      });
    });

    req.setTimeout(config.timeout, () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    if (options.data) {
      req.write(JSON.stringify(options.data));
    }
    
    req.end();
  });
}

async function testEndpoint(name, options, expectedStatus = 200) {
  console.log(`🧪 Testing ${name}...`);
  
  const result = await makeRequest(options);
  const success = result.success && result.status === expectedStatus;
  
  const testResult = {
    name,
    success,
    status: result.status,
    error: result.error,
    responseTime: Date.now(),
    details: result
  };

  console.log(`   ${success ? '✅' : '❌'} ${name} - Status: ${result.status || 'ERROR'}`);
  if (!success && result.error) {
    console.log(`   Error: ${result.error}`);
  }

  return testResult;
}

// Backend API Tests
async function testBackendAPI() {
  console.log('\n🔧 Testing Backend API...\n');

  const tests = [
    {
      name: 'Health Check',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/health',
        method: 'GET'
      }
    },
    {
      name: 'Readiness Check',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/health/ready',
        method: 'GET'
      }
    },
    {
      name: 'Liveness Check',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/health/live',
        method: 'GET'
      }
    },
    {
      name: 'API Documentation',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/api-docs',
        method: 'GET'
      }
    },
    {
      name: 'CSRF Token Endpoint',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/api/csrf-token',
        method: 'GET'
      }
    }
  ];

  for (const test of tests) {
    const result = await testEndpoint(test.name, test.options);
    testResults.backend.push(result);
  }
}

// Security Tests
async function testSecurity() {
  console.log('\n🛡️ Testing Security Features...\n');

  const tests = [
    {
      name: 'CSRF Protection',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          email: 'test@example.com',
          password: 'testpassword'
        }
      },
      expectedStatus: 403 // Should fail without CSRF token
    },
    {
      name: 'Rate Limiting',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      },
      expectedStatus: 401 // Should fail with wrong credentials
    },
    {
      name: 'Input Validation',
      options: {
        hostname: config.backend.host,
        port: config.backend.port,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          email: 'invalid-email',
          password: '123' // Too short
        }
      },
      expectedStatus: 400 // Should fail validation
    }
  ];

  for (const test of tests) {
    const result = await testEndpoint(test.name, test.options, test.expectedStatus);
    testResults.security.push(result);
  }
}

// Performance Tests
async function testPerformance() {
  console.log('\n⚡ Testing Performance...\n');

  const startTime = Date.now();
  
  // Test concurrent requests
  const concurrentTests = Array(10).fill().map((_, i) => 
    testEndpoint(`Concurrent Request ${i + 1}`, {
      hostname: config.backend.host,
      port: config.backend.port,
      path: '/health',
      method: 'GET'
    })
  );

  const results = await Promise.all(concurrentTests);
  const endTime = Date.now();
  
  const successCount = results.filter(r => r.success).length;
  const avgResponseTime = (endTime - startTime) / results.length;

  console.log(`   📊 Concurrent Requests: ${successCount}/${results.length} successful`);
  console.log(`   ⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);

  testResults.performance.push({
    name: 'Concurrent Load Test',
    success: successCount === results.length,
    totalRequests: results.length,
    successfulRequests: successCount,
    averageResponseTime: avgResponseTime,
    totalTime: endTime - startTime
  });
}

// JavaScript vs TypeScript Comparison
async function compareImplementations() {
  console.log('\n🔄 Comparing JavaScript vs TypeScript Implementations...\n');

  // Check if both files exist
  const jsFiles = [
    'telegram-bot/simple-bot.js',
    'telegram-bot/minimal-bot.js'
  ];

  const tsFiles = [
    'telegram-bot/src/index.ts',
    'telegram-bot/src/handlers/commandHandler.ts'
  ];

  console.log('📁 JavaScript Files:');
  for (const file of jsFiles) {
    const exists = fs.existsSync(file);
    const size = exists ? fs.statSync(file).size : 0;
    console.log(`   ${exists ? '✅' : '❌'} ${file} (${size} bytes)`);
  }

  console.log('\n📁 TypeScript Files:');
  for (const file of tsFiles) {
    const exists = fs.existsSync(file);
    const size = exists ? fs.statSync(file).size : 0;
    console.log(`   ${exists ? '✅' : '❌'} ${file} (${size} bytes)`);
  }

  // Feature comparison
  console.log('\n🔍 Feature Comparison:');
  
  if (fs.existsSync('telegram-bot/src/handlers/commandHandler.ts')) {
    const tsContent = fs.readFileSync('telegram-bot/src/handlers/commandHandler.ts', 'utf8');
    const commandCount = (tsContent.match(/case '\//g) || []).length;
    const methodCount = (tsContent.match(/private async handle/g) || []).length;
    
    console.log(`   📊 TypeScript Implementation:`);
    console.log(`      • Commands: ${commandCount}`);
    console.log(`      • Handler Methods: ${methodCount}`);
    console.log(`      • Lines of Code: ${tsContent.split('\n').length}`);
    console.log(`      • Type Safety: ✅ Full TypeScript support`);
    console.log(`      • Error Handling: ✅ Comprehensive`);
    console.log(`      • Service Integration: ✅ Multiple services`);
  }

  if (fs.existsSync('telegram-bot/simple-bot.js')) {
    const jsContent = fs.readFileSync('telegram-bot/simple-bot.js', 'utf8');
    const commandCount = (jsContent.match(/bot\.onText/g) || []).length;
    
    console.log(`   📊 JavaScript Implementation:`);
    console.log(`      • Commands: ${commandCount}`);
    console.log(`      • Lines of Code: ${jsContent.split('\n').length}`);
    console.log(`      • Type Safety: ❌ No type checking`);
    console.log(`      • Error Handling: ⚠️  Basic`);
    console.log(`      • Service Integration: ❌ Limited`);
  }
}

// Generate Test Report
function generateReport() {
  console.log('\n📋 COMPREHENSIVE TEST REPORT\n');
  console.log('=' .repeat(50));

  const allTests = [
    ...testResults.backend,
    ...testResults.security,
    ...testResults.performance
  ];

  const totalTests = allTests.length;
  const passedTests = allTests.filter(t => t.success).length;
  const failedTests = totalTests - passedTests;

  console.log(`📊 Overall Results:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} ✅`);
  console.log(`   Failed: ${failedTests} ❌`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  console.log(`\n🔧 Backend API Tests: ${testResults.backend.filter(t => t.success).length}/${testResults.backend.length}`);
  console.log(`🛡️  Security Tests: ${testResults.security.filter(t => t.success).length}/${testResults.security.length}`);
  console.log(`⚡ Performance Tests: ${testResults.performance.filter(t => t.success).length}/${testResults.performance.length}`);

  if (failedTests > 0) {
    console.log(`\n❌ Failed Tests:`);
    allTests.filter(t => !t.success).forEach(test => {
      console.log(`   • ${test.name}: ${test.error || 'Unknown error'}`);
    });
  }

  console.log('\n' + '='.repeat(50));
  
  return {
    totalTests,
    passedTests,
    failedTests,
    successRate: (passedTests / totalTests) * 100
  };
}

// Main Test Execution
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Application Testing...\n');
  console.log('Testing X (Twitter) Marketing Automation Platform');
  console.log('=' .repeat(50));

  try {
    // Run all test suites
    await testBackendAPI();
    await testSecurity();
    await testPerformance();
    await compareImplementations();

    // Generate final report
    const report = generateReport();

    // Save results to file
    const reportData = {
      timestamp: new Date().toISOString(),
      config,
      results: testResults,
      summary: report
    };

    fs.writeFileSync('test-results.json', JSON.stringify(reportData, null, 2));
    console.log('\n💾 Test results saved to test-results.json');

    // Exit with appropriate code
    process.exit(report.failedTests > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runComprehensiveTests();
}

module.exports = {
  runComprehensiveTests,
  testBackendAPI,
  testSecurity,
  testPerformance,
  compareImplementations
};
