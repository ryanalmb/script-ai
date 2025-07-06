#!/usr/bin/env node

/**
 * Local Setup Script for X Marketing Platform
 * Automates the local development environment setup
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const readline = require('readline');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt user for input
 */
function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

/**
 * Log with color
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if command exists
 */
async function commandExists(command) {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check prerequisites
 */
async function checkPrerequisites() {
  log('\n🔍 Checking Prerequisites...', 'cyan');
  
  const requirements = [
    { name: 'Node.js', command: 'node', version: '--version', minVersion: '18.0.0' },
    { name: 'npm', command: 'npm', version: '--version', minVersion: '8.0.0' },
    { name: 'Python', command: 'python3', version: '--version', minVersion: '3.9.0' },
    { name: 'PostgreSQL', command: 'psql', version: '--version', minVersion: '12.0.0' },
    { name: 'Redis', command: 'redis-cli', version: '--version', minVersion: '6.0.0' },
    { name: 'Git', command: 'git', version: '--version', minVersion: '2.0.0' }
  ];

  const missing = [];
  
  for (const req of requirements) {
    const exists = await commandExists(req.command);
    if (exists) {
      try {
        const { stdout } = await execAsync(`${req.command} ${req.version}`);
        log(`✅ ${req.name}: ${stdout.trim()}`, 'green');
      } catch (error) {
        log(`⚠️  ${req.name}: Installed but version check failed`, 'yellow');
      }
    } else {
      log(`❌ ${req.name}: Not found`, 'red');
      missing.push(req.name);
    }
  }

  if (missing.length > 0) {
    log(`\n❌ Missing prerequisites: ${missing.join(', ')}`, 'red');
    log('Please install the missing software and run this script again.', 'red');
    return false;
  }

  log('\n✅ All prerequisites satisfied!', 'green');
  return true;
}

/**
 * Setup database
 */
async function setupDatabase() {
  log('\n🗄️  Setting up PostgreSQL database...', 'cyan');

  try {
    // Check if database exists
    try {
      await execAsync('psql -h localhost -U x_marketing_user -d x_marketing_platform -c "SELECT 1;"');
      log('✅ Database already exists and is accessible', 'green');
      return true;
    } catch {
      // Database doesn't exist, create it
    }

    log('Creating database and user...', 'blue');
    
    const createDbScript = `
      CREATE DATABASE x_marketing_platform;
      CREATE USER x_marketing_user WITH PASSWORD 'secure_password_123';
      GRANT ALL PRIVILEGES ON DATABASE x_marketing_platform TO x_marketing_user;
      ALTER USER x_marketing_user CREATEDB;
    `;

    // Try to create database as postgres user
    await execAsync(`sudo -u postgres psql -c "${createDbScript}"`);
    log('✅ Database and user created successfully', 'green');
    
    return true;
  } catch (error) {
    log(`❌ Database setup failed: ${error.message}`, 'red');
    log('Please ensure PostgreSQL is running and you have admin access.', 'yellow');
    return false;
  }
}

/**
 * Setup Redis
 */
async function setupRedis() {
  log('\n🔄 Setting up Redis...', 'cyan');

  try {
    const { stdout } = await execAsync('redis-cli ping');
    if (stdout.trim() === 'PONG') {
      log('✅ Redis is running and accessible', 'green');
      return true;
    }
  } catch (error) {
    log('❌ Redis is not running. Please start Redis service.', 'red');
    log('Try: sudo systemctl start redis-server', 'yellow');
    return false;
  }
}

/**
 * Install dependencies
 */
async function installDependencies() {
  log('\n📦 Installing dependencies...', 'cyan');

  const services = ['backend', 'frontend', 'telegram-bot'];
  
  for (const service of services) {
    log(`Installing ${service} dependencies...`, 'blue');
    try {
      await execAsync(`cd ${service} && npm install`);
      log(`✅ ${service} dependencies installed`, 'green');
    } catch (error) {
      log(`❌ Failed to install ${service} dependencies: ${error.message}`, 'red');
      return false;
    }
  }

  // Install Python dependencies
  log('Installing LLM service dependencies...', 'blue');
  try {
    await execAsync('cd llm-service && pip install -r requirements.txt');
    log('✅ LLM service dependencies installed', 'green');
  } catch (error) {
    log(`❌ Failed to install LLM service dependencies: ${error.message}`, 'red');
    return false;
  }

  return true;
}

/**
 * Setup environment files
 */
async function setupEnvironment() {
  log('\n⚙️  Setting up environment configuration...', 'cyan');

  // Get user input for API keys
  log('\nPlease provide your API credentials:', 'yellow');
  
  const xApiKey = await prompt('X API Key (optional for testing): ');
  const xApiSecret = await prompt('X API Secret (optional for testing): ');
  const telegramToken = await prompt('Telegram Bot Token (optional for testing): ');
  const huggingFaceKey = await prompt('Hugging Face API Key (optional): ');

  // Generate secure secrets
  const generateSecret = () => require('crypto').randomBytes(32).toString('hex');
  
  const jwtSecret = generateSecret();
  const jwtRefreshSecret = generateSecret();
  const encryptionKey = generateSecret();

  // Backend environment
  const backendEnv = `
# Database
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
ENCRYPTION_KEY=${encryptionKey}

# X API
X_API_KEY=${xApiKey}
X_API_SECRET=${xApiSecret}
X_BEARER_TOKEN=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=${telegramToken}
TELEGRAM_WEBHOOK_URL=http://localhost:3002/webhook

# LLM Services
OLLAMA_HOST=http://localhost:11434
HUGGINGFACE_API_KEY=${huggingFaceKey}

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
LLM_SERVICE_URL=http://localhost:3003
TELEGRAM_BOT_URL=http://localhost:3002

# Environment
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Advanced Features
ENABLE_ADVANCED_FEATURES=true
ENABLE_CLUSTERING=false
COMPLIANCE_STRICT_MODE=true

# Development Limits
MAX_ACCOUNTS_PER_USER=50
MAX_DAILY_ACTIONS_PER_ACCOUNT=200
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
`.trim();

  // Frontend environment
  const frontendEnv = `
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=X Marketing Platform (Local)
NEXT_PUBLIC_ENVIRONMENT=development
NODE_ENV=development
`.trim();

  // LLM service environment
  const llmEnv = `
FLASK_ENV=development
FLASK_DEBUG=true
PORT=3003
OLLAMA_HOST=http://localhost:11434
HUGGINGFACE_API_KEY=${huggingFaceKey}
LOG_LEVEL=debug
`.trim();

  // Telegram bot environment
  const telegramEnv = `
TELEGRAM_BOT_TOKEN=${telegramToken}
TELEGRAM_WEBHOOK_URL=http://localhost:3002/webhook
BACKEND_URL=http://localhost:3001
DATABASE_URL=postgresql://x_marketing_user:secure_password_123@localhost:5432/x_marketing_platform
NODE_ENV=development
PORT=3002
LOG_LEVEL=debug
ENABLE_ADVANCED_FEATURES=true
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

/**
 * Setup database schema
 */
async function setupDatabaseSchema() {
  log('\n🏗️  Setting up database schema...', 'cyan');

  try {
    log('Generating Prisma client...', 'blue');
    await execAsync('cd backend && npx prisma generate');
    
    log('Pushing database schema...', 'blue');
    await execAsync('cd backend && npx prisma db push');
    
    log('Seeding database...', 'blue');
    await execAsync('cd backend && npx prisma db seed');
    
    log('✅ Database schema setup completed', 'green');
    return true;
  } catch (error) {
    log(`❌ Database schema setup failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Setup Ollama
 */
async function setupOllama() {
  log('\n🧠 Setting up Ollama (optional)...', 'cyan');

  const setupOllamaChoice = await prompt('Do you want to setup Ollama for local LLM? (y/n): ');
  
  if (setupOllamaChoice.toLowerCase() !== 'y') {
    log('⏭️  Skipping Ollama setup', 'yellow');
    return true;
  }

  try {
    // Check if Ollama is installed
    const ollamaExists = await commandExists('ollama');
    
    if (!ollamaExists) {
      log('Installing Ollama...', 'blue');
      await execAsync('curl -fsSL https://ollama.ai/install.sh | sh');
    }

    log('Starting Ollama service...', 'blue');
    // Start Ollama in background
    spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
    
    // Wait a bit for service to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    log('Pulling LLM models...', 'blue');
    await execAsync('ollama pull llama2');
    
    log('✅ Ollama setup completed', 'green');
    return true;
  } catch (error) {
    log(`⚠️  Ollama setup failed: ${error.message}`, 'yellow');
    log('You can set it up manually later if needed.', 'yellow');
    return true; // Non-critical
  }
}

/**
 * Create logs directories
 */
async function createLogDirectories() {
  log('\n📁 Creating log directories...', 'cyan');

  const logDirs = [
    'logs',
    'backend/logs',
    'frontend/logs',
    'telegram-bot/logs',
    'llm-service/logs'
  ];

  for (const dir of logDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log(`✅ Created ${dir}`, 'green');
      }
    } catch (error) {
      log(`❌ Failed to create ${dir}: ${error.message}`, 'red');
    }
  }
}

/**
 * Main setup function
 */
async function runSetup() {
  log('🚀 X Marketing Platform - Local Setup', 'cyan');
  log('=====================================\n', 'cyan');

  try {
    // Check prerequisites
    const prereqsOk = await checkPrerequisites();
    if (!prereqsOk) {
      process.exit(1);
    }

    // Setup database
    const dbOk = await setupDatabase();
    if (!dbOk) {
      process.exit(1);
    }

    // Setup Redis
    const redisOk = await setupRedis();
    if (!redisOk) {
      process.exit(1);
    }

    // Install dependencies
    const depsOk = await installDependencies();
    if (!depsOk) {
      process.exit(1);
    }

    // Setup environment
    const envOk = await setupEnvironment();
    if (!envOk) {
      process.exit(1);
    }

    // Create log directories
    await createLogDirectories();

    // Setup database schema
    const schemaOk = await setupDatabaseSchema();
    if (!schemaOk) {
      process.exit(1);
    }

    // Setup Ollama (optional)
    await setupOllama();

    // Success message
    log('\n🎉 Setup completed successfully!', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Start all services: npm run dev', 'blue');
    log('2. Run health check: npm run health:check', 'blue');
    log('3. Open frontend: http://localhost:3000', 'blue');
    log('4. Check API docs: http://localhost:3001/api-docs', 'blue');
    log('5. Database GUI: npm run db:studio', 'blue');

  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  runSetup();
}

module.exports = { runSetup };
