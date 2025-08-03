#!/usr/bin/env node

/**
 * Quick Proxy Setup Script
 * This script helps users quickly set up proxy services for the X Marketing Platform
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function copyFile(source, destination) {
  try {
    fs.copyFileSync(source, destination);
    return true;
  } catch (error) {
    logError(`Failed to copy ${source} to ${destination}: ${error.message}`);
    return false;
  }
}

function runCommand(command, cwd = process.cwd()) {
  try {
    log(`Running: ${command}`, 'cyan');
    const output = execSync(command, { 
      cwd, 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

function setupEnvironmentFile() {
  logStep(1, 'Setting up environment configuration');
  
  const backendDir = path.join(__dirname, '..', 'backend');
  const envPath = path.join(backendDir, '.env');
  const envExamplePath = path.join(backendDir, '.env.example');
  const proxyExamplePath = path.join(__dirname, '..', '.env.proxy.example');
  
  // Check if .env already exists
  if (checkFileExists(envPath)) {
    logWarning('.env file already exists. Backing up to .env.backup');
    copyFile(envPath, path.join(backendDir, '.env.backup'));
  }
  
  // Copy .env.example to .env if it doesn't exist
  if (!checkFileExists(envPath) && checkFileExists(envExamplePath)) {
    if (copyFile(envExamplePath, envPath)) {
      logSuccess('Created .env from .env.example');
    } else {
      return false;
    }
  }
  
  // Append proxy configuration if proxy example exists
  if (checkFileExists(proxyExamplePath)) {
    try {
      const proxyConfig = fs.readFileSync(proxyExamplePath, 'utf8');
      const currentEnv = fs.readFileSync(envPath, 'utf8');
      
      // Check if proxy config is already in .env
      if (!currentEnv.includes('TWIKIT_ENABLE_PROXY_ROTATION')) {
        fs.appendFileSync(envPath, '\n\n' + proxyConfig);
        logSuccess('Added proxy configuration to .env');
      } else {
        logWarning('Proxy configuration already exists in .env');
      }
    } catch (error) {
      logError(`Failed to append proxy configuration: ${error.message}`);
      return false;
    }
  }
  
  return true;
}

function installDependencies() {
  logStep(2, 'Installing dependencies');
  
  const backendDir = path.join(__dirname, '..', 'backend');
  
  // Check if node_modules exists
  if (!checkFileExists(path.join(backendDir, 'node_modules'))) {
    log('Installing backend dependencies...', 'cyan');
    const result = runCommand('npm install', backendDir);
    
    if (result.success) {
      logSuccess('Backend dependencies installed');
    } else {
      logError('Failed to install backend dependencies');
      log(result.error, 'red');
      return false;
    }
  } else {
    logSuccess('Backend dependencies already installed');
  }
  
  return true;
}

function setupDatabase() {
  logStep(3, 'Setting up database');
  
  const backendDir = path.join(__dirname, '..', 'backend');
  
  // Generate Prisma client
  log('Generating Prisma client...', 'cyan');
  let result = runCommand('npm run db:generate', backendDir);
  
  if (result.success) {
    logSuccess('Prisma client generated');
  } else {
    logError('Failed to generate Prisma client');
    log(result.error, 'red');
    return false;
  }
  
  // Run migrations
  log('Running database migrations...', 'cyan');
  result = runCommand('npm run db:migrate', backendDir);
  
  if (result.success) {
    logSuccess('Database migrations completed');
  } else {
    logWarning('Database migrations failed - this is normal if database is not running');
    log('You can run migrations later with: npm run db:migrate', 'yellow');
  }
  
  return true;
}

function setupProxyServices() {
  logStep(4, 'Setting up proxy services');
  
  const backendDir = path.join(__dirname, '..', 'backend');
  
  // Build TypeScript files first
  log('Building TypeScript files...', 'cyan');
  let result = runCommand('npm run build', backendDir);
  
  if (!result.success) {
    logWarning('TypeScript build failed, trying to run setup anyway...');
  }
  
  // Run proxy setup
  log('Running proxy setup...', 'cyan');
  result = runCommand('npm run proxy:setup', backendDir);
  
  if (result.success) {
    logSuccess('Proxy services setup completed');
    log(result.output, 'cyan');
  } else {
    logWarning('Proxy setup encountered issues');
    log(result.output, 'yellow');
    log('This is normal if no proxy providers are configured', 'yellow');
  }
  
  return true;
}

function displayNextSteps() {
  logHeader('🎉 SETUP COMPLETED!');
  
  log('\n📋 Next Steps:', 'bright');
  log('1. Configure your proxy providers in backend/.env:', 'cyan');
  log('   - Set TWIKIT_RESIDENTIAL_PROXY_ENABLED=true', 'cyan');
  log('   - Add your proxy URLs and credentials', 'cyan');
  log('   - See .env.proxy.example for detailed configuration', 'cyan');
  
  log('\n2. Start the database services:', 'cyan');
  log('   cd backend && npm run services:start', 'cyan');
  
  log('\n3. Run database migrations:', 'cyan');
  log('   cd backend && npm run db:migrate', 'cyan');
  
  log('\n4. Test proxy configuration:', 'cyan');
  log('   cd backend && npm run proxy:test', 'cyan');
  
  log('\n5. Start the backend server:', 'cyan');
  log('   cd backend && npm run dev', 'cyan');
  
  log('\n📚 Documentation:', 'bright');
  log('- Proxy Configuration: .env.proxy.example', 'cyan');
  log('- Setup Guide: README.md', 'cyan');
  log('- API Documentation: backend/docs/', 'cyan');
  
  log('\n🔧 Troubleshooting:', 'bright');
  log('- Check logs in backend/logs/', 'cyan');
  log('- Verify database connection', 'cyan');
  log('- Test proxy connectivity', 'cyan');
  log('- Check environment variables', 'cyan');
  
  log('\n💡 Tips:', 'bright');
  log('- Use residential proxies for best anti-detection', 'cyan');
  log('- Start with demo proxies for testing', 'cyan');
  log('- Monitor proxy performance regularly', 'cyan');
  log('- Keep proxy credentials secure', 'cyan');
}

async function main() {
  logHeader('🚀 X MARKETING PLATFORM - PROXY SETUP');
  
  log('This script will set up proxy services for the X Marketing Platform', 'cyan');
  log('It will configure environment files, install dependencies, and initialize proxy services', 'cyan');
  
  try {
    // Step 1: Setup environment file
    if (!setupEnvironmentFile()) {
      logError('Environment setup failed');
      process.exit(1);
    }
    
    // Step 2: Install dependencies
    if (!installDependencies()) {
      logError('Dependency installation failed');
      process.exit(1);
    }
    
    // Step 3: Setup database
    if (!setupDatabase()) {
      logError('Database setup failed');
      process.exit(1);
    }
    
    // Step 4: Setup proxy services
    if (!setupProxyServices()) {
      logError('Proxy services setup failed');
      process.exit(1);
    }
    
    // Display next steps
    displayNextSteps();
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  main();
}

module.exports = { main };
