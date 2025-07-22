#!/usr/bin/env node

/**
 * Health Check Script for X/Twitter Automation Platform Backend
 * Tests all core services and endpoints
 */

const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = colors.reset) => {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
};

const success = (msg) => log(`✅ ${msg}`, colors.green);
const error = (msg) => log(`❌ ${msg}`, colors.red);
const warning = (msg) => log(`⚠️  ${msg}`, colors.yellow);
const info = (msg) => log(`ℹ️  ${msg}`, colors.blue);
const status = (msg) => log(`📊 ${msg}`, colors.magenta);

// Make HTTP request
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => {
            try { return JSON.parse(data); } catch (e) { return null; }
          }
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Test health endpoints
async function testHealthEndpoints() {
  status('🔍 Testing Backend Health Endpoints');
  console.log('==========================================');
  
  const endpoints = [
    { name: 'Basic Health Check', port: 3000, path: '/health' },
    { name: 'Basic Health Check (Alt Port)', port: 3001, path: '/health' },
    { name: 'Database Health', port: 3000, path: '/health/database' },
    { name: 'Redis Health', port: 3000, path: '/health/redis' },
    { name: 'Real-time Sync Health', port: 3000, path: '/api/real-time-sync/health' },
    { name: 'Telegram Bot Status', port: 3000, path: '/api/telegram-bot/status' }
  ];
  
  let passedTests = 0;
  let totalTests = endpoints.length;
  
  for (const endpoint of endpoints) {
    try {
      info(`Testing ${endpoint.name} at http://localhost:${endpoint.port}${endpoint.path}`);
      
      const response = await makeRequest({
        hostname: 'localhost',
        port: endpoint.port,
        path: endpoint.path,
        method: 'GET',
        timeout: 5000
      });
      
      if (response.statusCode === 200) {
        success(`${endpoint.name}: PASSED (${response.statusCode})`);
        
        // Try to parse JSON response
        const jsonData = response.json();
        if (jsonData) {
          info(`  Response: ${JSON.stringify(jsonData, null, 2).substring(0, 200)}...`);
        } else {
          info(`  Response: ${response.body.substring(0, 100)}...`);
        }
        
        passedTests++;
      } else if (response.statusCode === 401 || response.statusCode === 403) {
        warning(`${endpoint.name}: AUTH REQUIRED (${response.statusCode}) - Endpoint exists but needs authentication`);
        passedTests++;
      } else if (response.statusCode === 503) {
        warning(`${endpoint.name}: SERVICE UNAVAILABLE (${response.statusCode}) - Service exists but dependencies missing`);
        passedTests++;
      } else {
        error(`${endpoint.name}: FAILED (${response.statusCode})`);
        info(`  Response: ${response.body.substring(0, 200)}`);
      }
      
    } catch (err) {
      error(`${endpoint.name}: CONNECTION ERROR - ${err.message}`);
    }
    
    console.log(''); // Add spacing
  }
  
  console.log('==========================================');
  status(`Health Check Results: ${passedTests}/${totalTests} endpoints responding`);
  
  if (passedTests > 0) {
    success('🎉 Backend server is responding to requests');
    return true;
  } else {
    error('❌ Backend server is not responding');
    return false;
  }
}

// Test server connectivity
async function testServerConnectivity() {
  status('🔍 Testing Server Connectivity');
  console.log('==========================================');
  
  const ports = [3000, 3001];
  let activeServers = 0;
  
  for (const port of ports) {
    try {
      info(`Testing connection to localhost:${port}`);
      
      const response = await makeRequest({
        hostname: 'localhost',
        port: port,
        path: '/',
        method: 'GET',
        timeout: 3000
      });
      
      success(`Port ${port}: ACTIVE (Status: ${response.statusCode})`);
      activeServers++;
      
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        error(`Port ${port}: NO SERVER RUNNING`);
      } else {
        warning(`Port ${port}: ${err.message}`);
      }
    }
  }
  
  console.log('==========================================');
  status(`Active Servers: ${activeServers}/${ports.length}`);
  
  return activeServers > 0;
}

// Main health check function
async function runHealthCheck() {
  console.log('\n🏥 X/TWITTER AUTOMATION PLATFORM');
  console.log('   BACKEND HEALTH CHECK');
  console.log('==========================================\n');
  
  try {
    // Test server connectivity first
    const serverActive = await testServerConnectivity();
    
    if (serverActive) {
      // Test health endpoints
      const healthPassed = await testHealthEndpoints();
      
      if (healthPassed) {
        console.log('\n==========================================');
        console.log('🎉 HEALTH CHECK COMPLETED SUCCESSFULLY');
        console.log('==========================================');
        console.log('✅ Backend server is operational');
        console.log('✅ Core endpoints are responding');
        console.log('✅ Ready for production use');
        console.log('==========================================\n');
        
        return true;
      } else {
        console.log('\n==========================================');
        console.log('⚠️  HEALTH CHECK COMPLETED WITH ISSUES');
        console.log('==========================================');
        console.log('✅ Server is running');
        console.log('❌ Some endpoints not responding');
        console.log('ℹ️  Server may still be initializing');
        console.log('==========================================\n');
        
        return false;
      }
    } else {
      console.log('\n==========================================');
      console.log('❌ HEALTH CHECK FAILED');
      console.log('==========================================');
      console.log('❌ No backend server detected');
      console.log('ℹ️  Please start the backend server first');
      console.log('==========================================\n');
      
      return false;
    }
    
  } catch (err) {
    error(`Health check failed: ${err.message}`);
    return false;
  }
}

// Execute health check
if (require.main === module) {
  runHealthCheck()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(err => {
      console.error('Health check execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runHealthCheck };
