#!/usr/bin/env node

/**
 * Quick Service Test Script
 * 
 * A simple Node.js script to quickly test the Service Routing Pattern
 * without requiring TypeScript compilation.
 */

const { spawn } = require('child_process');
const path = require('path');

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
  console.log(colorize('🧪 Service Routing Pattern - Quick Test', 'bright'));
  console.log(colorize('='.repeat(80), 'cyan'));
  console.log('');
}

function printHelp() {
  console.log(`
${colorize('Usage:', 'bright')} node test-services-quick.js [command]

${colorize('Commands:', 'bright')}
  health          Quick health check
  status          Check service status
  basic           Run basic functionality tests (default)
  routing         Test service routing pattern
  integration     Test service integration
  all             Run all test scenarios

${colorize('Examples:', 'bright')}
  node test-services-quick.js
  node test-services-quick.js health
  node test-services-quick.js routing
  node test-services-quick.js all
`);
}

async function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(colorize(`🚀 Running: ${command} ${args.join(' ')}`, 'blue'));
    console.log('');
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkPrerequisites() {
  console.log(colorize('🔍 Checking prerequisites...', 'yellow'));
  
  try {
    // Check if ts-node is available
    await runCommand('npx', ['ts-node', '--version']);
    console.log(colorize('✅ ts-node is available', 'green'));
    
    // Check if test files exist
    const fs = require('fs');
    const testFile = path.join(__dirname, 'tests', 'serviceRouting', 'runTests.ts');
    
    if (!fs.existsSync(testFile)) {
      throw new Error('Test files not found. Please ensure the test files are in the correct location.');
    }
    
    console.log(colorize('✅ Test files found', 'green'));
    console.log('');
    
    return true;
  } catch (error) {
    console.error(colorize('❌ Prerequisites check failed:', 'red'), error.message);
    console.log('');
    console.log(colorize('💡 To fix this:', 'yellow'));
    console.log('  1. Make sure you\'re in the backend directory');
    console.log('  2. Run: npm install');
    console.log('  3. Ensure TypeScript and ts-node are installed');
    console.log('');
    return false;
  }
}

async function runTest(scenario = 'basic') {
  try {
    const testCommand = 'npx';
    const testArgs = ['ts-node', 'tests/serviceRouting/runTests.ts'];
    
    if (scenario !== 'basic') {
      testArgs.push(scenario);
    }
    
    await runCommand(testCommand, testArgs);
    
    console.log('');
    console.log(colorize('✅ Test completed successfully!', 'green'));
    
  } catch (error) {
    console.log('');
    console.error(colorize('❌ Test failed:', 'red'), error.message);
    console.log('');
    console.log(colorize('💡 Troubleshooting tips:', 'yellow'));
    console.log('  1. Check that all dependencies are installed: npm install');
    console.log('  2. Verify TypeScript compilation: npm run build');
    console.log('  3. Check the test logs above for specific errors');
    console.log('  4. Try running a health check first: node test-services-quick.js health');
    console.log('');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'basic';
  
  printHeader();
  
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  
  // Check prerequisites
  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) {
    process.exit(1);
  }
  
  // Map commands to test scenarios
  const commandMap = {
    'health': '--health',
    'status': '--status',
    'basic': 'basic',
    'routing': 'routing',
    'integration': 'integration',
    'all': 'all'
  };
  
  const scenario = commandMap[command];
  if (!scenario) {
    console.error(colorize(`❌ Unknown command: ${command}`, 'red'));
    console.log('');
    printHelp();
    process.exit(1);
  }
  
  console.log(colorize(`🎯 Running ${command} test scenario...`, 'magenta'));
  console.log('');
  
  await runTest(scenario);
  
  console.log('');
  console.log(colorize('🎉 All done!', 'green'));
  console.log('');
  console.log(colorize('📚 For more options, see:', 'cyan'));
  console.log('  • tests/serviceRouting/README.md');
  console.log('  • npm run test:services --help');
  console.log('');
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(colorize('❌ Uncaught exception:', 'red'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('❌ Unhandled rejection at:', 'red'), promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error(colorize('❌ Fatal error:', 'red'), error);
    process.exit(1);
  });
}
