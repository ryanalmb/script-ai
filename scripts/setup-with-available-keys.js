#!/usr/bin/env node

/**
 * Setup Script with Available API Keys
 * Configures the X Marketing Platform with Telegram and Hugging Face integration
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');

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

// Available API credentials
const AVAILABLE_CREDENTIALS = {
  TELEGRAM_BOT_TOKEN: '7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0',
  HUGGINGFACE_API_KEY: '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'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

async function createEnvironmentFiles() {
  log('\n⚙️  Creating environment configuration files...', 'cyan');

  // Generate secure secrets
  const jwtSecret = generateSecret();
  const jwtRefreshSecret = generateSecret();
  const encryptionKey = generateSecret();

  // Backend environment
  const backendEnv = `
# Database
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
ENCRYPTION_KEY=${encryptionKey}

# X API (Not Available - Regional Restrictions)
X_API_KEY=not-available-regional-restrictions
X_API_SECRET=not-available-regional-restrictions
X_BEARER_TOKEN=not-available-regional-restrictions
X_ACCESS_TOKEN=not-available-regional-restrictions
X_ACCESS_TOKEN_SECRET=not-available-regional-restrictions

# Telegram (Available)
TELEGRAM_BOT_TOKEN=${AVAILABLE_CREDENTIALS.TELEGRAM_BOT_TOKEN}
TELEGRAM_WEBHOOK_URL=http://localhost:3002/webhook

# LLM Services (Available)
OLLAMA_HOST=http://localhost:11434
HUGGINGFACE_API_KEY=${AVAILABLE_CREDENTIALS.HUGGINGFACE_API_KEY}

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
LLM_SERVICE_URL=http://localhost:3003
TELEGRAM_BOT_URL=http://localhost:3002

# Environment
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Features (Content Creation Mode)
ENABLE_ADVANCED_FEATURES=true
ENABLE_HUGGINGFACE_INTEGRATION=true
ENABLE_BROWSER_ASSISTANT=true
ENABLE_CONTENT_GENERATION=true
COMPLIANCE_STRICT_MODE=true

# Content Creation Mode Settings
CONTENT_CREATION_MODE=true
MANUAL_POSTING_MODE=true
X_API_AVAILABLE=false

# Performance (Development)
MAX_ACCOUNTS_PER_USER=50
MAX_DAILY_ACTIONS_PER_ACCOUNT=200
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
`.trim();

  // Frontend environment
  const frontendEnv = `
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=X Marketing Platform (Content Creation Mode)
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_CONTENT_CREATION_MODE=true
NEXT_PUBLIC_X_API_AVAILABLE=false
NODE_ENV=development
`.trim();

  // LLM service environment
  const llmEnv = `
FLASK_ENV=development
FLASK_DEBUG=true
PORT=3003

# Hugging Face (Available)
HUGGINGFACE_API_KEY=${AVAILABLE_CREDENTIALS.HUGGINGFACE_API_KEY}

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODELS=llama2,codellama,mistral

# Features
ENABLE_HUGGINGFACE_INTEGRATION=true
ENABLE_MULTIMODAL_CONTENT=true
ENABLE_SENTIMENT_ANALYSIS=true
ENABLE_CONTENT_OPTIMIZATION=true

# Performance
MAX_WORKERS=2
TIMEOUT_SECONDS=60
LOG_LEVEL=debug
`.trim();

  // Telegram bot environment
  const telegramEnv = `
# Telegram (Available)
TELEGRAM_BOT_TOKEN=${AVAILABLE_CREDENTIALS.TELEGRAM_BOT_TOKEN}
TELEGRAM_WEBHOOK_URL=http://localhost:3002/webhook

# Backend API
BACKEND_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform

# Environment
NODE_ENV=development
PORT=3002
LOG_LEVEL=debug

# Features
ENABLE_ADVANCED_FEATURES=true
ENABLE_CONTENT_CREATION_MODE=true
ENABLE_POLLING=true
WEBHOOK_ENABLED=false

# Content Creation Mode
X_API_AVAILABLE=false
MANUAL_POSTING_MODE=true
`.trim();

  // Write environment files
  try {
    fs.writeFileSync('backend/.env.local', backendEnv);
    fs.writeFileSync('frontend/.env.local', frontendEnv);
    fs.writeFileSync('llm-service/.env.local', llmEnv);
    fs.writeFileSync('telegram-bot/.env.local', telegramEnv);
    
    log('✅ Environment files created successfully', 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to create environment files: ${error.message}`, 'red');
    return false;
  }
}

async function setupContentCreationMode() {
  log('\n🎨 Setting up Content Creation Mode...', 'cyan');

  // Create content creation mode configuration
  const contentModeConfig = {
    mode: 'content_creation',
    features: {
      content_generation: true,
      sentiment_analysis: true,
      image_generation: true,
      browser_assistant: true,
      telegram_integration: true,
      manual_posting: true,
      x_api_integration: false,
      automated_posting: false
    },
    available_services: {
      huggingface: true,
      telegram: true,
      ollama: false, // Will be detected at runtime
      x_api: false
    },
    compliance: {
      strict_mode: true,
      content_filtering: true,
      manual_approval_required: true,
      rate_limiting: true
    },
    ui_adaptations: {
      hide_x_api_features: true,
      show_manual_posting_guides: true,
      emphasize_content_creation: true,
      show_browser_assistant: true
    }
  };

  try {
    fs.writeFileSync('config/content-creation-mode.json', JSON.stringify(contentModeConfig, null, 2));
    log('✅ Content Creation Mode configured', 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to configure Content Creation Mode: ${error.message}`, 'red');
    return false;
  }
}

async function testAvailableServices() {
  log('\n🧪 Testing available services...', 'cyan');

  const tests = [];

  // Test Telegram Bot
  log('Testing Telegram Bot API...', 'blue');
  try {
    const { stdout } = await execAsync(`curl -s "https://api.telegram.org/bot${AVAILABLE_CREDENTIALS.TELEGRAM_BOT_TOKEN}/getMe"`);
    const response = JSON.parse(stdout);
    
    if (response.ok) {
      log(`✅ Telegram Bot: ${response.result.first_name} (@${response.result.username})`, 'green');
      tests.push({ service: 'telegram', status: 'success', details: response.result });
    } else {
      log('❌ Telegram Bot: Invalid token', 'red');
      tests.push({ service: 'telegram', status: 'failed', error: 'Invalid token' });
    }
  } catch (error) {
    log(`❌ Telegram Bot: ${error.message}`, 'red');
    tests.push({ service: 'telegram', status: 'failed', error: error.message });
  }

  // Test Hugging Face API
  log('Testing Hugging Face API...', 'blue');
  try {
    const { stdout } = await execAsync(`curl -s -H "Authorization: Bearer ${AVAILABLE_CREDENTIALS.HUGGINGFACE_API_KEY}" "https://api-inference.huggingface.co/models/gpt2"`);
    
    if (!stdout.includes('error')) {
      log('✅ Hugging Face API: Valid and accessible', 'green');
      tests.push({ service: 'huggingface', status: 'success' });
    } else {
      log('❌ Hugging Face API: Access denied', 'red');
      tests.push({ service: 'huggingface', status: 'failed', error: 'Access denied' });
    }
  } catch (error) {
    log(`❌ Hugging Face API: ${error.message}`, 'red');
    tests.push({ service: 'huggingface', status: 'failed', error: error.message });
  }

  return tests;
}

async function createStartupScript() {
  log('\n📝 Creating startup script...', 'cyan');

  const startupScript = `#!/bin/bash

# X Marketing Platform - Content Creation Mode Startup Script

echo "🚀 Starting X Marketing Platform in Content Creation Mode..."

# Check if all services are ready
echo "📋 Checking prerequisites..."

# Check PostgreSQL
if ! pg_isready -h localhost -p 5432 -U x_marketing_user > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start it first."
    echo "   sudo systemctl start postgresql"
    exit 1
fi

# Check Redis
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis is not running. Please start it first."
    echo "   sudo systemctl start redis-server"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Start services in Content Creation Mode
echo "🎨 Starting Content Creation Mode services..."

# Start Backend API
echo "Starting Backend API..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start LLM Service with Hugging Face integration
echo "Starting LLM Service with Hugging Face..."
cd ../llm-service && python app.py &
LLM_PID=$!

# Wait a moment for LLM service to start
sleep 3

# Start Telegram Bot
echo "Starting Telegram Bot..."
cd ../telegram-bot && npm run dev &
TELEGRAM_PID=$!

# Wait a moment for telegram bot to start
sleep 3

# Start Frontend
echo "Starting Frontend Dashboard..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 X Marketing Platform started in Content Creation Mode!"
echo ""
echo "📊 Available Services:"
echo "   • Frontend Dashboard: http://localhost:3000"
echo "   • Backend API: http://localhost:3001"
echo "   • LLM Service: http://localhost:3003"
echo "   • Telegram Bot: Active and listening"
echo ""
echo "🎨 Content Creation Features:"
echo "   • AI-powered content generation (Hugging Face)"
echo "   • Sentiment analysis and optimization"
echo "   • Browser assistant for manual posting"
echo "   • Telegram bot for notifications and control"
echo "   • Image generation capabilities"
echo ""
echo "📝 Usage:"
echo "   1. Open http://localhost:3000 for the dashboard"
echo "   2. Generate content using AI tools"
echo "   3. Use browser assistant for posting"
echo "   4. Control via Telegram bot"
echo ""
echo "⚠️  Note: X/Twitter API not available due to regional restrictions"
echo "   Platform operates in manual posting mode with content assistance"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'echo "Stopping services..."; kill $BACKEND_PID $LLM_PID $TELEGRAM_PID $FRONTEND_PID; exit' INT
wait
`;

  try {
    fs.writeFileSync('start-content-creation-mode.sh', startupScript);
    await execAsync('chmod +x start-content-creation-mode.sh');
    log('✅ Startup script created', 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to create startup script: ${error.message}`, 'red');
    return false;
  }
}

async function displaySetupSummary(testResults) {
  log('\n🎯 Setup Summary', 'cyan');
  log('================', 'cyan');

  log('\n✅ Available Services:', 'green');
  testResults.forEach(test => {
    if (test.status === 'success') {
      log(`   • ${test.service}: Working`, 'green');
    }
  });

  log('\n❌ Unavailable Services:', 'red');
  log('   • X/Twitter API: Regional restrictions', 'red');
  testResults.forEach(test => {
    if (test.status === 'failed') {
      log(`   • ${test.service}: ${test.error}`, 'red');
    }
  });

  log('\n🎨 Platform Mode: Content Creation Mode', 'yellow');
  log('   • Focus on high-quality content generation', 'yellow');
  log('   • Manual posting with AI assistance', 'yellow');
  log('   • Full compliance with platform terms', 'yellow');

  log('\n🚀 Next Steps:', 'blue');
  log('   1. Run: ./start-content-creation-mode.sh', 'blue');
  log('   2. Open: http://localhost:3000', 'blue');
  log('   3. Test content generation features', 'blue');
  log('   4. Install browser assistant extension', 'blue');
  log('   5. Configure Telegram bot commands', 'blue');

  log('\n📚 Documentation:', 'magenta');
  log('   • Content Creation Guide: docs/CONTENT_CREATION_MODE.md', 'magenta');
  log('   • Browser Assistant: browser-assistant/README.md', 'magenta');
  log('   • Telegram Bot Commands: telegram-bot/COMMANDS.md', 'magenta');
}

async function main() {
  log('🎨 X Marketing Platform - Content Creation Mode Setup', 'cyan');
  log('====================================================', 'cyan');

  log('\n📋 Configuration:', 'yellow');
  log('   • Telegram Bot: Available ✅', 'green');
  log('   • Hugging Face API: Available ✅', 'green');
  log('   • X/Twitter API: Not Available ❌', 'red');
  log('   • Mode: Content Creation with Manual Posting', 'yellow');

  try {
    // Create environment files
    const envSuccess = await createEnvironmentFiles();
    if (!envSuccess) {
      process.exit(1);
    }

    // Setup content creation mode
    const modeSuccess = await setupContentCreationMode();
    if (!modeSuccess) {
      process.exit(1);
    }

    // Test available services
    const testResults = await testAvailableServices();

    // Create startup script
    const scriptSuccess = await createStartupScript();
    if (!scriptSuccess) {
      process.exit(1);
    }

    // Display summary
    await displaySetupSummary(testResults);

    log('\n🎉 Setup completed successfully!', 'green');
    log('Ready to start in Content Creation Mode.', 'green');

  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
