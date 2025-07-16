#!/usr/bin/env node

/**
 * X Marketing Platform - Webhook Solutions Test Suite
 * Tests all webhook solutions and provides recommendations
 */

const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`)
};

class WebhookTester {
  constructor() {
    this.results = {
      solutions: [],
      recommendations: [],
      bestSolution: null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test Cloudflare Tunnel
   */
  async testCloudflareeTunnel() {
    log.test('Testing Cloudflare Tunnel...');
    
    const result = {
      name: 'Cloudflare Tunnel',
      available: false,
      permanent: true,
      free: true,
      reliable: true,
      setup_complexity: 'Easy',
      pros: [
        'Enterprise-grade infrastructure',
        'No bandwidth limits',
        'Built-in DDoS protection',
        'Permanent URLs',
        '100% free forever'
      ],
      cons: [
        'Requires Cloudflare account',
        'Command-line setup'
      ],
      score: 0
    };

    try {
      // Check if cloudflared is available
      const { stdout } = await this.execCommand('which cloudflared');
      if (stdout.trim()) {
        result.available = true;
        result.score = 95;
        log.success('Cloudflare Tunnel is available');
      } else {
        result.score = 90; // Still high score as it's easily installable
        log.warning('Cloudflared not installed but easily installable');
      }
    } catch (error) {
      result.score = 90;
      log.warning('Cloudflared not found but can be installed');
    }

    this.results.solutions.push(result);
    return result;
  }

  /**
   * Test Railway
   */
  async testRailway() {
    log.test('Testing Railway...');
    
    const result = {
      name: 'Railway',
      available: true,
      permanent: true,
      free: true, // $5/month credit
      reliable: true,
      setup_complexity: 'Medium',
      pros: [
        'Auto-deployment from Git',
        'Built-in monitoring',
        'Permanent URLs',
        'Good free tier'
      ],
      cons: [
        'Limited free credits',
        'Requires GitHub integration'
      ],
      score: 85
    };

    try {
      // Test Railway API availability
      const response = await axios.get('https://railway.app', { timeout: 5000 });
      if (response.status === 200) {
        log.success('Railway is accessible');
      }
    } catch (error) {
      result.score = 80;
      log.warning('Railway accessibility test failed');
    }

    this.results.solutions.push(result);
    return result;
  }

  /**
   * Test Render
   */
  async testRender() {
    log.test('Testing Render...');
    
    const result = {
      name: 'Render',
      available: true,
      permanent: true,
      free: true,
      reliable: true,
      setup_complexity: 'Medium',
      pros: [
        'Good free tier',
        'Auto-deployment',
        'SSL included',
        'Easy setup'
      ],
      cons: [
        'Free tier limitations',
        'Cold starts'
      ],
      score: 80
    };

    try {
      const response = await axios.get('https://render.com', { timeout: 5000 });
      if (response.status === 200) {
        log.success('Render is accessible');
      }
    } catch (error) {
      result.score = 75;
      log.warning('Render accessibility test failed');
    }

    this.results.solutions.push(result);
    return result;
  }

  /**
   * Test Vercel
   */
  async testVercel() {
    log.test('Testing Vercel...');
    
    const result = {
      name: 'Vercel',
      available: true,
      permanent: true,
      free: true,
      reliable: true,
      setup_complexity: 'Easy',
      pros: [
        'Generous free tier',
        'Edge network',
        'Perfect for serverless',
        'Easy deployment'
      ],
      cons: [
        'Serverless limitations',
        'Function timeout limits'
      ],
      score: 85
    };

    try {
      // Check if vercel CLI is available
      const { stdout } = await this.execCommand('which vercel');
      if (stdout.trim()) {
        result.score = 90;
        log.success('Vercel CLI is available');
      } else {
        log.info('Vercel CLI not installed but easily installable');
      }
    } catch (error) {
      log.info('Vercel CLI not found');
    }

    this.results.solutions.push(result);
    return result;
  }

  /**
   * Test ngrok
   */
  async testNgrok() {
    log.test('Testing ngrok...');
    
    const result = {
      name: 'ngrok',
      available: false,
      permanent: false, // Free tier has limitations
      free: true, // With limitations
      reliable: true,
      setup_complexity: 'Easy',
      pros: [
        'Quick setup',
        'Good for development',
        'Instant tunnels'
      ],
      cons: [
        'Free tier limitations',
        'URLs change on restart',
        'Rate limits'
      ],
      score: 60
    };

    try {
      const { stdout } = await this.execCommand('which ngrok');
      if (stdout.trim()) {
        result.available = true;
        result.score = 65;
        log.success('ngrok is available');
      } else {
        log.warning('ngrok not installed');
      }
    } catch (error) {
      log.warning('ngrok not found');
    }

    this.results.solutions.push(result);
    return result;
  }

  /**
   * Test current webhook status
   */
  async testCurrentWebhook() {
    log.test('Testing current webhook status...');
    
    const envPath = path.join(process.cwd(), 'telegram-bot', '.env.local');
    let webhookUrl = null;
    
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/TELEGRAM_WEBHOOK_URL=(.+)/);
      if (match) {
        webhookUrl = match[1].trim();
      }
    } catch (error) {
      log.error('Could not read .env.local file');
      return null;
    }

    if (!webhookUrl) {
      log.warning('No webhook URL configured');
      return null;
    }

    log.info(`Testing webhook: ${webhookUrl}`);

    try {
      const response = await axios.get(webhookUrl.replace('/webhook/telegram', '/health'), {
        timeout: 10000
      });
      
      if (response.status === 200) {
        log.success('Current webhook is healthy');
        return { status: 'healthy', url: webhookUrl };
      } else {
        log.warning(`Current webhook returned status: ${response.status}`);
        return { status: 'degraded', url: webhookUrl };
      }
    } catch (error) {
      log.error(`Current webhook is down: ${error.message}`);
      return { status: 'down', url: webhookUrl };
    }
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    log.info('Generating recommendations...');
    
    // Sort solutions by score
    const sortedSolutions = this.results.solutions.sort((a, b) => b.score - a.score);
    this.results.bestSolution = sortedSolutions[0];

    // Generate recommendations
    const recommendations = [];

    // Primary recommendation
    recommendations.push(`🏆 RECOMMENDED: ${this.results.bestSolution.name} (Score: ${this.results.bestSolution.score}/100)`);
    
    // Setup recommendations
    if (this.results.bestSolution.name === 'Cloudflare Tunnel') {
      recommendations.push('📋 Setup: Run ./scripts/webhook-solutions.sh to install Cloudflare Tunnel');
      recommendations.push('🚀 Start: cloudflared tunnel --url http://localhost:3002');
    } else if (this.results.bestSolution.name === 'Vercel') {
      recommendations.push('📋 Setup: npm install -g vercel && vercel login');
      recommendations.push('🚀 Deploy: vercel --prod');
    }

    // Backup recommendations
    const backupSolutions = sortedSolutions.slice(1, 3);
    recommendations.push(`🔄 BACKUP OPTIONS: ${backupSolutions.map(s => s.name).join(', ')}`);

    // Multi-solution strategy
    recommendations.push('💡 PRO TIP: Set up multiple solutions for maximum uptime');
    recommendations.push('🔧 Use WebhookMonitorService for automatic failover');

    this.results.recommendations = recommendations;
  }

  /**
   * Execute command
   */
  execCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    log.info('🚀 Starting webhook solutions test suite...\n');

    // Test current webhook
    const currentStatus = await this.testCurrentWebhook();
    console.log();

    // Test all solutions
    await this.testCloudflareeTunnel();
    await this.testRailway();
    await this.testRender();
    await this.testVercel();
    await this.testNgrok();

    console.log();
    this.generateRecommendations();

    // Display results
    this.displayResults(currentStatus);
  }

  /**
   * Display test results
   */
  displayResults(currentStatus) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 WEBHOOK SOLUTIONS TEST RESULTS');
    console.log('='.repeat(60));

    // Current status
    if (currentStatus) {
      const statusColor = currentStatus.status === 'healthy' ? colors.green : 
                         currentStatus.status === 'degraded' ? colors.yellow : colors.red;
      console.log(`\n🔍 Current Webhook Status: ${statusColor}${currentStatus.status.toUpperCase()}${colors.reset}`);
      console.log(`   URL: ${currentStatus.url}`);
    }

    // Solutions ranking
    console.log('\n🏆 SOLUTIONS RANKING:');
    this.results.solutions
      .sort((a, b) => b.score - a.score)
      .forEach((solution, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        const scoreColor = solution.score >= 90 ? colors.green : 
                          solution.score >= 80 ? colors.yellow : colors.red;
        
        console.log(`${medal} ${solution.name}: ${scoreColor}${solution.score}/100${colors.reset}`);
        console.log(`   Free: ${solution.free ? '✅' : '❌'} | Permanent: ${solution.permanent ? '✅' : '❌'} | Available: ${solution.available ? '✅' : '❌'}`);
      });

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    this.results.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });

    // Next steps
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Run: ./scripts/webhook-solutions.sh');
    console.log('   2. Choose and set up your preferred solution');
    console.log('   3. Update TELEGRAM_WEBHOOK_URL in .env.local');
    console.log('   4. Run: node scripts/setup-webhook.js set <new-url>');
    console.log('   5. Test: npm test');

    console.log('\n' + '='.repeat(60));
    
    // Save results to file
    const resultsPath = path.join(process.cwd(), 'webhook-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    log.success(`Results saved to: ${resultsPath}`);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new WebhookTester();
  tester.runAllTests().catch(error => {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = WebhookTester;
