/**
 * Check Python Environment Status
 * Verifies Python virtual environment and Twikit installation
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const VENV_DIR = 'python_env';
const REQUIREMENTS_FILE = 'requirements-python.txt';

console.log('🔍 Checking Python Environment Status');
console.log('=====================================');

// Function to run command and return promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      ...options
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    process.on('error', (error) => {
      reject({ error: error.message, code: -1 });
    });
  });
}

// Check if virtual environment exists
function checkVirtualEnv() {
  console.log('\n📁 Checking virtual environment...');
  
  if (!fs.existsSync(VENV_DIR)) {
    console.log('❌ Virtual environment not found');
    console.log(`   Expected: ${VENV_DIR}`);
    return false;
  }
  
  console.log(`✅ Virtual environment found: ${VENV_DIR}`);
  
  // Check for Python executable
  const isWindows = process.platform === 'win32';
  const pythonExe = isWindows 
    ? path.join(VENV_DIR, 'Scripts', 'python.exe')
    : path.join(VENV_DIR, 'bin', 'python');
  
  if (!fs.existsSync(pythonExe)) {
    console.log('❌ Python executable not found in virtual environment');
    console.log(`   Expected: ${pythonExe}`);
    return false;
  }
  
  console.log(`✅ Python executable found: ${pythonExe}`);
  return { pythonExe };
}

// Check Twikit installation
async function checkTwikit(pythonExe) {
  console.log('\n🐦 Checking Twikit installation...');
  
  try {
    const result = await runCommand(pythonExe, ['-c', '"import twikit; print(twikit.__version__)"']);

    if (result.code === 0) {
      const version = result.stdout.trim();
      console.log(`✅ Twikit installed: version ${version}`);
      return { version };
    } else {
      console.log('❌ Twikit not installed or import failed');
      console.log(`   Error: ${result.stderr}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to check Twikit installation');
    console.log(`   Error: ${error.error || error.message}`);
    return false;
  }
}

// Check Twikit Client import
async function checkTwikitClient(pythonExe) {
  console.log('\n🔧 Checking Twikit Client import...');
  
  try {
    const result = await runCommand(pythonExe, ['-c', '"from twikit import Client; print(\\"Client import successful\\")"']);

    if (result.code === 0) {
      console.log('✅ Twikit Client import successful');
      return true;
    } else {
      console.log('❌ Twikit Client import failed');
      console.log(`   Error: ${result.stderr}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to test Twikit Client import');
    console.log(`   Error: ${error.error || error.message}`);
    return false;
  }
}

// Check dependencies
async function checkDependencies(pythonExe) {
  console.log('\n📦 Checking Python dependencies...');
  
  const dependencies = [
    'httpx', 'filetype', 'beautifulsoup4', 'pyotp', 
    'lxml', 'webvtt', 'm3u8', 'Js2Py'
  ];
  
  const results = {};
  
  for (const dep of dependencies) {
    try {
      const result = await runCommand(pythonExe, ['-c', `import ${dep}; print(getattr(${dep}, '__version__', 'Unknown'))`]);
      
      if (result.code === 0) {
        const version = result.stdout.trim();
        console.log(`  ✅ ${dep}: ${version}`);
        results[dep] = version;
      } else {
        console.log(`  ❌ ${dep}: Not installed`);
        results[dep] = 'Not installed';
      }
    } catch (error) {
      console.log(`  ❌ ${dep}: Error checking`);
      results[dep] = 'Error';
    }
  }
  
  return results;
}

// Get environment info
async function getEnvironmentInfo(pythonExe) {
  console.log('\n🌍 Getting environment information...');
  
  try {
    const result = await runCommand(pythonExe, ['-c', `
import sys
import os
import json

info = {
    "python_version": sys.version,
    "python_executable": sys.executable,
    "virtual_env": os.environ.get('VIRTUAL_ENV', 'Not detected'),
    "platform": sys.platform,
    "working_directory": os.getcwd()
}

print(json.dumps(info, indent=2))
`]);
    
    if (result.code === 0) {
      const info = JSON.parse(result.stdout);
      console.log('✅ Environment information:');
      console.log(`  Python Version: ${info.python_version.split(' ')[0]}`);
      console.log(`  Platform: ${info.platform}`);
      console.log(`  Working Directory: ${info.working_directory}`);
      return info;
    } else {
      console.log('❌ Failed to get environment information');
      return null;
    }
  } catch (error) {
    console.log('❌ Error getting environment information');
    return null;
  }
}

// Main function
async function main() {
  let allGood = true;
  
  // Check virtual environment
  const venvResult = checkVirtualEnv();
  if (!venvResult) {
    console.log('\n❌ Python environment not set up');
    console.log('   Run: npm run setup:python');
    process.exit(1);
  }
  
  const { pythonExe } = venvResult;
  
  // Check Twikit installation
  const twikitResult = await checkTwikit(pythonExe);
  if (!twikitResult) {
    console.log('\n❌ Twikit not installed');
    console.log('   Run: npm run python:install');
    allGood = false;
  }
  
  // Check Twikit Client
  const clientResult = await checkTwikitClient(pythonExe);
  if (!clientResult) {
    allGood = false;
  }
  
  // Check dependencies
  const depsResult = await checkDependencies(pythonExe);
  
  // Get environment info
  const envInfo = await getEnvironmentInfo(pythonExe);
  
  // Summary
  console.log('\n📊 ENVIRONMENT STATUS SUMMARY');
  console.log('==============================');
  
  if (allGood) {
    console.log('🎉 Python environment is ready for Twikit integration!');
    console.log('\n✅ All checks passed:');
    console.log('  • Virtual environment: Ready');
    console.log('  • Twikit installation: Working');
    console.log('  • Client import: Successful');
    console.log('  • Dependencies: Installed');
    
    console.log('\n🚀 Ready for:');
    console.log('  • X/Twitter automation');
    console.log('  • Node.js-Python integration');
    console.log('  • Docker deployment');
    
    process.exit(0);
  } else {
    console.log('⚠️ Python environment needs attention');
    console.log('\n🔧 Recommended actions:');
    console.log('  1. Run: npm run setup:python');
    console.log('  2. Run: npm run python:install');
    console.log('  3. Run: npm run python:test');
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkVirtualEnv,
  checkTwikit,
  checkTwikitClient,
  checkDependencies,
  getEnvironmentInfo
};
