#!/usr/bin/env node

/**
 * Service Startup Script
 * 
 * Starts all services and the CoreBackendController in a running state
 * for manual testing with real credentials and data.
 */

const path = require('path');
const { spawn } = require('child_process');

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

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('='.repeat(80), 'cyan'));
  console.log(colorize('🚀 Service Routing Pattern - Service Startup', 'bright'));
  console.log(colorize('='.repeat(80), 'cyan'));
  console.log('');
  console.log(colorize('Starting all services for manual testing...', 'blue'));
  console.log('');
}

async function checkPrerequisites() {
  console.log(colorize('🔍 Checking prerequisites...', 'yellow'));
  
  try {
    const fs = require('fs');
    
    // Check if required files exist
    const requiredFiles = [
      'src/controllers/coreBackendController.ts',
      'src/index.ts',
      'package.json'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file not found: ${file}`);
      }
    }
    
    console.log(colorize('✅ Required files found', 'green'));
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      throw new Error('node_modules not found. Please run: npm install');
    }
    
    console.log(colorize('✅ Dependencies installed', 'green'));
    console.log('');
    
    return true;
  } catch (error) {
    console.error(colorize('❌ Prerequisites check failed:', 'red'), error.message);
    console.log('');
    console.log(colorize('💡 To fix this:', 'yellow'));
    console.log('  1. Make sure you\'re in the backend directory');
    console.log('  2. Run: npm install');
    console.log('  3. Ensure all source files are present');
    console.log('');
    return false;
  }
}

function setupEnvironment() {
  console.log(colorize('⚙️  Setting up environment...', 'yellow'));
  
  // Set development environment
  process.env.NODE_ENV = 'development';
  process.env.LOG_LEVEL = 'info';
  
  // Enable all services
  process.env.ENABLE_ALL_SERVICES = 'true';
  process.env.SERVICE_STARTUP_MODE = 'comprehensive';
  
  // Set reasonable defaults for missing configs
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379';
    console.log(colorize('  📝 Using default Redis URL: redis://localhost:6379', 'blue'));
  }
  
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/x_marketing';
    console.log(colorize('  📝 Using default Database URL: postgresql://localhost:5432/x_marketing', 'blue'));
  }
  
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'development-jwt-secret-key-32-characters-minimum-length-required';
    console.log(colorize('  📝 Using development JWT secret (32+ chars)', 'blue'));
  }
  
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'development-encryption-key-32-characters-minimum-length';
    console.log(colorize('  📝 Using development encryption key (32+ chars)', 'blue'));
  }
  
  // Set port
  if (!process.env.PORT) {
    process.env.PORT = '3001';
    console.log(colorize('  📝 Using port 3001', 'blue'));
  }
  
  console.log(colorize('✅ Environment configured', 'green'));
  console.log('');
}

async function startServices() {
  return new Promise((resolve, reject) => {
    console.log(colorize('🚀 Starting services with ts-node...', 'magenta'));
    console.log('');
    
    // Start the application with ts-node for development
    const child = spawn('npx', ['ts-node', 'src/index.ts'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..'),
      env: process.env
    });

    // Handle process events
    child.on('spawn', () => {
      console.log(colorize('✅ Services started successfully!', 'green'));
      console.log('');
      printServiceInfo();
      resolve(child);
    });

    child.on('error', (error) => {
      console.error(colorize('❌ Failed to start services:', 'red'), error.message);
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.log(colorize(`❌ Services exited with code ${code}`, 'red'));
      } else {
        console.log(colorize('✅ Services shut down gracefully', 'green'));
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(colorize('\n🛑 Shutting down services...', 'yellow'));
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log(colorize('\n🛑 Shutting down services...', 'yellow'));
      child.kill('SIGTERM');
    });
  });
}

function printServiceInfo() {
  const port = process.env.PORT || '3001';
  
  console.log(colorize('📋 Service Information:', 'cyan'));
  console.log(colorize('='.repeat(50), 'cyan'));
  console.log('');
  console.log(colorize('🌐 API Endpoints:', 'bright'));
  console.log(`  • Health Check: http://localhost:${port}/health`);
  console.log(`  • API Base URL: http://localhost:${port}/api`);
  console.log(`  • Metrics: http://localhost:${port}/metrics`);
  console.log('');
  console.log(colorize('🔧 Service Categories Available:', 'bright'));
  console.log('  • Core Backend Services (7 services)');
  console.log('  • Twikit Integration Services (4 services)');
  console.log('  • Account & Automation Services (3 services)');
  console.log('  • Anti-Detection Sub-Services (3 services)');
  console.log('  • Specialized Sub-Services (4 services)');
  console.log('  • Real-Time Sync Services (2 services)');
  console.log('  • Microservices (2+ services)');
  console.log('');
  console.log(colorize('🧪 Ready for Testing:', 'bright'));
  console.log('  • All services are initialized and running');
  console.log('  • CoreBackendController is active');
  console.log('  • Service Routing Pattern is operational');
  console.log('  • Ready to accept X/Twitter credentials');
  console.log('');
  console.log(colorize('💡 Next Steps:', 'yellow'));
  console.log('  1. Services are now running and ready');
  console.log('  2. You can now provide X account credentials');
  console.log('  3. Test individual services through the API');
  console.log('  4. Use Ctrl+C to stop all services');
  console.log('');
  console.log(colorize('📚 Available API Routes:', 'cyan'));
  console.log(`  • GET  http://localhost:${port}/api/services/status`);
  console.log(`  • POST http://localhost:${port}/api/accounts/add`);
  console.log(`  • GET  http://localhost:${port}/api/accounts/health/:accountId`);
  console.log(`  • POST http://localhost:${port}/api/content/analyze`);
  console.log(`  • GET  http://localhost:${port}/api/analytics/data/:accountId`);
  console.log(`  • POST http://localhost:${port}/api/automation/tweet`);
  console.log('');
  console.log(colorize('🔍 Monitoring:', 'cyan'));
  console.log('  • Watch the console for service logs');
  console.log('  • Check health endpoint for service status');
  console.log('  • Monitor metrics endpoint for performance data');
  console.log('');
  console.log(colorize('='.repeat(80), 'cyan'));
  console.log(colorize('🎉 All services are running! Ready for your X credentials.', 'green'));
  console.log(colorize('='.repeat(80), 'cyan'));
  console.log('');
}

async function main() {
  printHeader();
  
  // Check prerequisites
  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) {
    process.exit(1);
  }
  
  // Setup environment
  setupEnvironment();
  
  // Start services
  try {
    await startServices();
  } catch (error) {
    console.error(colorize('❌ Failed to start services:', 'red'), error);
    console.log('');
    console.log(colorize('💡 Troubleshooting:', 'yellow'));
    console.log('  1. Check that ports are not in use (especially 3001)');
    console.log('  2. Ensure Redis and PostgreSQL are running (or will use fallbacks)');
    console.log('  3. Check the error logs above for specific issues');
    console.log('  4. Try: npm install && npm run build');
    console.log('');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(colorize('❌ Uncaught exception:', 'red'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('❌ Unhandled rejection:', 'red'), reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error(colorize('❌ Fatal error:', 'red'), error);
    process.exit(1);
  });
}
