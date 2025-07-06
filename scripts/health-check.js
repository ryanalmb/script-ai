#!/usr/bin/env node

/**
 * Health Check Script for X Marketing Platform
 * Tests all services and their connectivity
 */

const http = require('http');
const https = require('https');
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

// Service configurations
const services = [
  {
    name: 'Backend API',
    url: 'http://localhost:3001/health',
    timeout: 5000,
    critical: true
  },
  {
    name: 'Frontend',
    url: 'http://localhost:3000',
    timeout: 5000,
    critical: true
  },
  {
    name: 'Telegram Bot',
    url: 'http://localhost:3002/health',
    timeout: 5000,
    critical: true
  },
  {
    name: 'LLM Service',
    url: 'http://localhost:3003/health',
    timeout: 10000,
    critical: false
  },
  {
    name: 'Ollama',
    url: 'http://localhost:11434/api/tags',
    timeout: 10000,
    critical: false
  }
];

// Database and cache checks
const infraChecks = [
  {
    name: 'PostgreSQL',
    command: 'pg_isready -h localhost -p 5432 -U x_marketing_user',
    critical: true
  },
  {
    name: 'Redis',
    command: 'redis-cli -h localhost -p 6379 ping',
    critical: true
  }
];

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
  });
}

/**
 * Check service health
 */
async function checkService(service) {
  try {
    console.log(`${colors.blue}Checking ${service.name}...${colors.reset}`);
    
    const response = await makeRequest(service.url, service.timeout);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`${colors.green}✅ ${service.name}: OK (${response.statusCode})${colors.reset}`);
      return { name: service.name, status: 'OK', critical: service.critical };
    } else {
      console.log(`${colors.yellow}⚠️  ${service.name}: Warning (${response.statusCode})${colors.reset}`);
      return { name: service.name, status: 'WARNING', critical: service.critical };
    }
  } catch (error) {
    console.log(`${colors.red}❌ ${service.name}: Failed - ${error.message}${colors.reset}`);
    return { name: service.name, status: 'FAILED', error: error.message, critical: service.critical };
  }
}

/**
 * Check infrastructure
 */
async function checkInfrastructure(check) {
  try {
    console.log(`${colors.blue}Checking ${check.name}...${colors.reset}`);
    
    const { stdout, stderr } = await execAsync(check.command);
    
    if (stdout.includes('accepting connections') || stdout.includes('PONG') || !stderr) {
      console.log(`${colors.green}✅ ${check.name}: OK${colors.reset}`);
      return { name: check.name, status: 'OK', critical: check.critical };
    } else {
      console.log(`${colors.yellow}⚠️  ${check.name}: Warning${colors.reset}`);
      return { name: check.name, status: 'WARNING', critical: check.critical };
    }
  } catch (error) {
    console.log(`${colors.red}❌ ${check.name}: Failed - ${error.message}${colors.reset}`);
    return { name: check.name, status: 'FAILED', error: error.message, critical: check.critical };
  }
}

/**
 * Test API endpoints
 */
async function testAPIEndpoints() {
  console.log(`\n${colors.cyan}${colors.bright}Testing API Endpoints...${colors.reset}`);
  
  const endpoints = [
    {
      name: 'Health Check',
      url: 'http://localhost:3001/health',
      method: 'GET'
    },
    {
      name: 'API Info',
      url: 'http://localhost:3001/api',
      method: 'GET'
    },
    {
      name: 'Auth Endpoints',
      url: 'http://localhost:3001/api/auth',
      method: 'GET'
    }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(endpoint.url);
      if (response.statusCode < 500) {
        console.log(`${colors.green}✅ ${endpoint.name}: Accessible${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ ${endpoint.name}: Server Error (${response.statusCode})${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ ${endpoint.name}: Failed - ${error.message}${colors.reset}`);
    }
  }
}

/**
 * Test database connectivity
 */
async function testDatabaseConnectivity() {
  console.log(`\n${colors.cyan}${colors.bright}Testing Database Connectivity...${colors.reset}`);
  
  try {
    // Test with a simple Node.js script
    const testScript = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: 'postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform'
          }
        }
      });
      
      prisma.$connect()
        .then(() => {
          console.log('Database connected successfully');
          return prisma.user.count();
        })
        .then(count => {
          console.log('User count:', count);
          process.exit(0);
        })
        .catch(err => {
          console.error('Database connection failed:', err.message);
          process.exit(1);
        });
    `;
    
    const { stdout, stderr } = await execAsync(`cd backend && node -e "${testScript}"`);
    
    if (stdout.includes('Database connected successfully')) {
      console.log(`${colors.green}✅ Database: Connected and accessible${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Database: Connection issues${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Database: Failed - ${error.message}${colors.reset}`);
  }
}

/**
 * Test LLM service functionality
 */
async function testLLMService() {
  console.log(`\n${colors.cyan}${colors.bright}Testing LLM Service...${colors.reset}`);
  
  try {
    // Test Ollama
    const ollamaResponse = await makeRequest('http://localhost:11434/api/tags', 10000);
    if (ollamaResponse.statusCode === 200) {
      console.log(`${colors.green}✅ Ollama: Available${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Ollama: Not available - ${error.message}${colors.reset}`);
  }

  try {
    // Test LLM service health
    const llmResponse = await makeRequest('http://localhost:3003/health', 5000);
    if (llmResponse.statusCode === 200) {
      console.log(`${colors.green}✅ LLM Service: Running${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ LLM Service: Failed - ${error.message}${colors.reset}`);
  }
}

/**
 * Main health check function
 */
async function runHealthCheck() {
  console.log(`${colors.cyan}${colors.bright}🏥 X Marketing Platform - Health Check${colors.reset}`);
  console.log(`${colors.cyan}===========================================${colors.reset}\n`);

  const results = [];

  // Check infrastructure
  console.log(`${colors.magenta}${colors.bright}Infrastructure Checks:${colors.reset}`);
  for (const check of infraChecks) {
    const result = await checkInfrastructure(check);
    results.push(result);
  }

  console.log('');

  // Check services
  console.log(`${colors.magenta}${colors.bright}Service Checks:${colors.reset}`);
  for (const service of services) {
    const result = await checkService(service);
    results.push(result);
  }

  // Additional tests
  await testAPIEndpoints();
  await testDatabaseConnectivity();
  await testLLMService();

  // Summary
  console.log(`\n${colors.cyan}${colors.bright}Health Check Summary:${colors.reset}`);
  console.log(`${colors.cyan}=====================${colors.reset}`);

  const passed = results.filter(r => r.status === 'OK').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const criticalFailed = results.filter(r => r.status === 'FAILED' && r.critical).length;

  console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Warnings: ${warnings}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);

  if (criticalFailed > 0) {
    console.log(`\n${colors.red}${colors.bright}❌ CRITICAL: ${criticalFailed} critical services failed!${colors.reset}`);
    console.log(`${colors.red}Platform may not function properly.${colors.reset}`);
    process.exit(1);
  } else if (failed > 0) {
    console.log(`\n${colors.yellow}${colors.bright}⚠️  WARNING: ${failed} non-critical services failed.${colors.reset}`);
    console.log(`${colors.yellow}Some features may not be available.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.green}${colors.bright}🎉 ALL SYSTEMS OPERATIONAL!${colors.reset}`);
    console.log(`${colors.green}Platform is ready for use.${colors.reset}`);
    process.exit(0);
  }
}

// Run health check if called directly
if (require.main === module) {
  runHealthCheck().catch(error => {
    console.error(`${colors.red}Health check failed:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { runHealthCheck, checkService, checkInfrastructure };
