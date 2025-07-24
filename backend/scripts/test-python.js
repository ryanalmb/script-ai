/**
 * Test Python Installation and Twikit Setup
 * Node.js script to verify Python environment and install Twikit
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const VENV_DIR = 'python_env';
const REQUIREMENTS_FILE = 'requirements-python.txt';

console.log('🐍 Testing Python Installation and Twikit Setup');
console.log('================================================');

// Function to run command and return promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Running: ${command} ${args.join(' ')}`);
    
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
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject({ stdout, stderr, code });
      }
    });

    process.on('error', (error) => {
      reject({ error: error.message, code: -1 });
    });
  });
}

// Function to check Python installation
async function checkPython() {
  console.log('\n📋 Checking Python installation...');
  
  try {
    const result = await runCommand('python', ['--version']);
    console.log(`✅ Python found: ${result.stdout.trim()}`);
    
    // Check if version is 3.8+
    const versionMatch = result.stdout.match(/Python (\d+)\.(\d+)/);
    if (versionMatch) {
      const major = parseInt(versionMatch[1]);
      const minor = parseInt(versionMatch[2]);
      
      if (major >= 3 && minor >= 8) {
        console.log('✅ Python version is sufficient (3.8+)');
        return true;
      } else {
        console.log(`❌ Python 3.8+ required, found ${major}.${minor}`);
        return false;
      }
    }
  } catch (error) {
    console.log('❌ Python not found or not accessible');
    console.log('Please install Python 3.8+ from https://python.org');
    return false;
  }
}

// Function to check pip
async function checkPip() {
  console.log('\n📦 Checking pip installation...');
  
  try {
    const result = await runCommand('pip', ['--version']);
    console.log(`✅ pip found: ${result.stdout.trim()}`);
    return true;
  } catch (error) {
    console.log('❌ pip not found');
    return false;
  }
}

// Function to create virtual environment
async function createVirtualEnv() {
  console.log('\n🏗️ Creating Python virtual environment...');
  
  // Remove existing environment if it exists
  if (fs.existsSync(VENV_DIR)) {
    console.log('⚠️ Removing existing virtual environment...');
    fs.rmSync(VENV_DIR, { recursive: true, force: true });
  }
  
  try {
    await runCommand('python', ['-m', 'venv', VENV_DIR]);
    console.log(`✅ Virtual environment created: ${VENV_DIR}`);
    return true;
  } catch (error) {
    console.log('❌ Failed to create virtual environment');
    console.log(error.stderr || error.error);
    return false;
  }
}

// Function to create requirements file
function createRequirementsFile() {
  console.log('\n📝 Creating requirements file...');
  
  const requirements = `# Twikit and its dependencies
twikit>=2.3.0

# Core dependencies
httpx[socks]>=0.24.0
filetype>=1.2.0
beautifulsoup4>=4.11.0
pyotp>=2.8.0
lxml>=4.9.0
webvtt-py>=0.4.6
m3u8>=3.5.0
Js2Py>=0.74

# Additional utilities for Node.js integration
python-dotenv>=1.0.0
aiofiles>=23.0.0
pydantic>=2.0.0
`;

  fs.writeFileSync(REQUIREMENTS_FILE, requirements);
  console.log(`✅ Requirements file created: ${REQUIREMENTS_FILE}`);
}

// Function to install dependencies
async function installDependencies() {
  console.log('\n📦 Installing Twikit and dependencies...');
  
  // Determine the correct python executable path
  const isWindows = process.platform === 'win32';
  const pythonExe = isWindows 
    ? path.join(VENV_DIR, 'Scripts', 'python.exe')
    : path.join(VENV_DIR, 'bin', 'python');
  
  const pipExe = isWindows 
    ? path.join(VENV_DIR, 'Scripts', 'pip.exe')
    : path.join(VENV_DIR, 'bin', 'pip');

  try {
    // Upgrade pip first
    console.log('⬆️ Upgrading pip...');
    await runCommand(pythonExe, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    
    // Install requirements
    console.log('📦 Installing requirements...');
    await runCommand(pipExe, ['install', '-r', REQUIREMENTS_FILE]);
    
    console.log('✅ Dependencies installed successfully');
    return { pythonExe, pipExe };
  } catch (error) {
    console.log('❌ Failed to install dependencies');
    console.log(error.stderr || error.error);
    return null;
  }
}

// Function to verify Twikit installation
async function verifyTwikit(pythonExe) {
  console.log('\n🔍 Verifying Twikit installation...');

  // Create a temporary Python script for verification
  const testScriptContent = `import sys
import twikit
from twikit import Client

print(f"[OK] Twikit {twikit.__version__} installed successfully")
print(f"[OK] Python {sys.version.split()[0]}")
print("[OK] Twikit Client import successful")
`;

  const testScriptPath = 'verify_twikit.py';
  fs.writeFileSync(testScriptPath, testScriptContent);

  try {
    const result = await runCommand(pythonExe, [testScriptPath]);
    console.log(result.stdout);

    // Clean up
    fs.unlinkSync(testScriptPath);
    return true;
  } catch (error) {
    console.log('❌ Twikit verification failed');
    console.log(error.stderr || error.stdout);

    // Clean up
    if (fs.existsSync(testScriptPath)) {
      fs.unlinkSync(testScriptPath);
    }
    return false;
  }
}

// Main function
async function main() {
  try {
    // Check Python
    const pythonOk = await checkPython();
    if (!pythonOk) {
      process.exit(1);
    }

    // Check pip
    const pipOk = await checkPip();
    if (!pipOk) {
      process.exit(1);
    }

    // Create virtual environment
    const venvOk = await createVirtualEnv();
    if (!venvOk) {
      process.exit(1);
    }

    // Create requirements file
    createRequirementsFile();

    // Install dependencies
    const installResult = await installDependencies();
    if (!installResult) {
      process.exit(1);
    }

    // Verify installation
    const verifyOk = await verifyTwikit(installResult.pythonExe);
    if (!verifyOk) {
      process.exit(1);
    }

    console.log('\n🎉 Twikit setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`  ✅ Virtual environment: ${VENV_DIR}`);
    console.log(`  ✅ Requirements file: ${REQUIREMENTS_FILE}`);
    console.log(`  ✅ Python executable: ${installResult.pythonExe}`);
    console.log(`  ✅ Pip executable: ${installResult.pipExe}`);
    
    console.log('\n🚀 Next steps:');
    console.log('  1. Integrate with Node.js backend');
    console.log('  2. Create Twikit wrapper service');
    console.log('  3. Configure Docker support');
    
    console.log('\n✨ Ready for X/Twitter automation!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runCommand,
  checkPython,
  checkPip,
  createVirtualEnv,
  installDependencies,
  verifyTwikit
};
