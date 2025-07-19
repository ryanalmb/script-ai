#!/usr/bin/env node

/**
 * Enterprise Test Runner - 2025 Edition
 * Comprehensive test execution and reporting:
 * - Multi-environment test execution
 * - Parallel test running with resource management
 * - Real-time progress reporting
 * - Test result aggregation and analysis
 * - Performance benchmarking
 * - Quality gate enforcement
 * - CI/CD integration support
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test runner configuration
const config = {
  testTypes: ['unit', 'integration', 'e2e', 'performance', 'security'],
  parallel: {
    unit: true,
    integration: false,
    e2e: false,
    performance: false,
    security: false
  },
  timeouts: {
    unit: 30000,
    integration: 60000,
    e2e: 120000,
    performance: 300000,
    security: 180000
  },
  coverage: {
    threshold: {
      global: 85,
      functions: 85,
      lines: 85,
      statements: 85,
      branches: 85
    }
  },
  qualityGates: {
    maxFailures: 0,
    minCoverage: 85,
    maxResponseTime: 1000,
    maxMemoryUsage: 100 * 1024 * 1024 // 100MB
  }
};

// Test results storage
const results = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    coverage: 0
  },
  testTypes: {},
  qualityGates: {
    passed: true,
    failures: []
  }
};

/**
 * Main test runner function
 */
async function runTests() {
  console.log('🚀 Starting Enterprise Test Suite - 2025 Edition');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Setup test environment
    await setupTestEnvironment();
    
    // Parse command line arguments
    const args = parseArguments();
    
    // Determine which tests to run
    const testTypes = args.types || config.testTypes;
    
    // Run tests
    for (const testType of testTypes) {
      if (args.parallel && config.parallel[testType]) {
        await runTestsParallel(testType, args);
      } else {
        await runTestsSequential(testType, args);
      }
    }
    
    // Generate reports
    await generateReports(args);
    
    // Check quality gates
    await checkQualityGates();
    
    // Cleanup
    await cleanup();
    
    const totalTime = Date.now() - startTime;
    results.summary.duration = totalTime;
    
    // Print final summary
    printFinalSummary();
    
    // Exit with appropriate code
    process.exit(results.qualityGates.passed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

/**
 * Setup test environment
 */
async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  // Check dependencies
  await checkDependencies();
  
  // Setup test database
  await setupTestDatabase();
  
  // Setup test Redis
  await setupTestRedis();
  
  // Clear previous test artifacts
  await clearTestArtifacts();
  
  console.log('✅ Test environment ready');
}

/**
 * Check required dependencies
 */
async function checkDependencies() {
  const dependencies = ['node', 'npm', 'psql', 'redis-cli'];
  
  for (const dep of dependencies) {
    try {
      await execAsync(`which ${dep}`);
    } catch (error) {
      throw new Error(`Required dependency not found: ${dep}`);
    }
  }
}

/**
 * Setup test database
 */
async function setupTestDatabase() {
  try {
    // Create test database
    await execAsync('createdb x_marketing_test 2>/dev/null || true');
    
    // Run migrations
    await execAsync('DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy');
    
    console.log('📊 Test database ready');
  } catch (error) {
    console.warn('⚠️  Database setup warning:', error.message);
  }
}

/**
 * Setup test Redis
 */
async function setupTestRedis() {
  try {
    // Flush test Redis database
    await execAsync('redis-cli -n 1 flushdb 2>/dev/null || true');
    
    console.log('🔴 Test Redis ready');
  } catch (error) {
    console.warn('⚠️  Redis setup warning:', error.message);
  }
}

/**
 * Clear test artifacts
 */
async function clearTestArtifacts() {
  const artifactPaths = [
    'coverage',
    'test-results',
    'performance-reports',
    'security-reports'
  ];
  
  for (const artifactPath of artifactPaths) {
    try {
      await execAsync(`rm -rf ${artifactPath}`);
    } catch (error) {
      // Ignore errors for non-existent paths
    }
  }
}

/**
 * Run tests sequentially
 */
async function runTestsSequential(testType, args) {
  console.log(`\n🧪 Running ${testType} tests...`);
  
  const startTime = Date.now();
  
  try {
    const command = buildTestCommand(testType, args);
    const result = await execAsync(command);
    
    const duration = Date.now() - startTime;
    
    results.testTypes[testType] = {
      status: 'passed',
      duration,
      output: result.stdout
    };
    
    console.log(`✅ ${testType} tests completed in ${duration}ms`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    results.testTypes[testType] = {
      status: 'failed',
      duration,
      error: error.message,
      output: error.stdout || error.stderr
    };
    
    console.log(`❌ ${testType} tests failed in ${duration}ms`);
    
    if (!args.continueOnFailure) {
      throw error;
    }
  }
}

/**
 * Run tests in parallel
 */
async function runTestsParallel(testType, args) {
  console.log(`\n🧪 Running ${testType} tests in parallel...`);
  
  const startTime = Date.now();
  const workers = args.workers || os.cpus().length;
  
  try {
    const command = buildTestCommand(testType, args, { parallel: true, workers });
    const result = await execAsync(command);
    
    const duration = Date.now() - startTime;
    
    results.testTypes[testType] = {
      status: 'passed',
      duration,
      output: result.stdout
    };
    
    console.log(`✅ ${testType} tests completed in ${duration}ms (${workers} workers)`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    results.testTypes[testType] = {
      status: 'failed',
      duration,
      error: error.message,
      output: error.stdout || error.stderr
    };
    
    console.log(`❌ ${testType} tests failed in ${duration}ms`);
    
    if (!args.continueOnFailure) {
      throw error;
    }
  }
}

/**
 * Build test command
 */
function buildTestCommand(testType, args, options = {}) {
  let command = `TEST_TYPE=${testType} jest --testPathPattern=${testType}`;
  
  // Add coverage for unit tests
  if (testType === 'unit') {
    command += ' --coverage';
  }
  
  // Add run in band for integration/e2e tests
  if (['integration', 'e2e', 'performance', 'security'].includes(testType)) {
    command += ' --runInBand';
  }
  
  // Add force exit for e2e and performance tests
  if (['e2e', 'performance'].includes(testType)) {
    command += ' --forceExit';
  }
  
  // Add timeout
  if (config.timeouts[testType]) {
    command += ` --testTimeout=${config.timeouts[testType]}`;
  }
  
  // Add parallel options
  if (options.parallel && options.workers) {
    command += ` --maxWorkers=${options.workers}`;
  }
  
  // Add verbose if requested
  if (args.verbose) {
    command += ' --verbose';
  }
  
  // Add specific test pattern if provided
  if (args.pattern) {
    command += ` --testNamePattern="${args.pattern}"`;
  }
  
  return command;
}

/**
 * Generate test reports
 */
async function generateReports(args) {
  console.log('\n📊 Generating test reports...');
  
  // Generate coverage report
  if (args.coverage !== false) {
    await generateCoverageReport();
  }
  
  // Generate performance report
  if (results.testTypes.performance) {
    await generatePerformanceReport();
  }
  
  // Generate security report
  if (results.testTypes.security) {
    await generateSecurityReport();
  }
  
  // Generate summary report
  await generateSummaryReport();
  
  console.log('✅ Reports generated');
}

/**
 * Generate coverage report
 */
async function generateCoverageReport() {
  try {
    await execAsync('npm run test:coverage:detailed');
    console.log('📈 Coverage report generated');
  } catch (error) {
    console.warn('⚠️  Coverage report generation failed:', error.message);
  }
}

/**
 * Generate performance report
 */
async function generatePerformanceReport() {
  const report = {
    timestamp: new Date().toISOString(),
    testType: 'performance',
    results: results.testTypes.performance,
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: os.totalmem(),
      node: process.version
    }
  };
  
  fs.writeFileSync('performance-report.json', JSON.stringify(report, null, 2));
  console.log('🚀 Performance report generated');
}

/**
 * Generate security report
 */
async function generateSecurityReport() {
  const report = {
    timestamp: new Date().toISOString(),
    testType: 'security',
    results: results.testTypes.security,
    vulnerabilities: [],
    recommendations: []
  };
  
  fs.writeFileSync('security-report.json', JSON.stringify(report, null, 2));
  console.log('🔒 Security report generated');
}

/**
 * Generate summary report
 */
async function generateSummaryReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: results.summary,
    testTypes: results.testTypes,
    qualityGates: results.qualityGates,
    environment: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch()
    }
  };
  
  fs.writeFileSync('test-summary.json', JSON.stringify(report, null, 2));
  console.log('📋 Summary report generated');
}

/**
 * Check quality gates
 */
async function checkQualityGates() {
  console.log('\n🚪 Checking quality gates...');
  
  // Check test failures
  const failedTests = Object.values(results.testTypes).filter(t => t.status === 'failed');
  if (failedTests.length > config.qualityGates.maxFailures) {
    results.qualityGates.passed = false;
    results.qualityGates.failures.push(`Too many test failures: ${failedTests.length}`);
  }
  
  // Check coverage (if available)
  try {
    const coverageData = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
    const totalCoverage = coverageData.total.lines.pct;
    
    if (totalCoverage < config.qualityGates.minCoverage) {
      results.qualityGates.passed = false;
      results.qualityGates.failures.push(`Coverage below threshold: ${totalCoverage}% < ${config.qualityGates.minCoverage}%`);
    }
    
    results.summary.coverage = totalCoverage;
  } catch (error) {
    console.warn('⚠️  Could not read coverage data');
  }
  
  if (results.qualityGates.passed) {
    console.log('✅ All quality gates passed');
  } else {
    console.log('❌ Quality gates failed:');
    results.qualityGates.failures.forEach(failure => {
      console.log(`  - ${failure}`);
    });
  }
}

/**
 * Cleanup test environment
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  
  try {
    // Cleanup test database (if enabled)
    if (process.env.TEST_DATABASE_CLEANUP === 'true') {
      await execAsync('dropdb x_marketing_test 2>/dev/null || true');
    }
    
    // Cleanup test Redis
    await execAsync('redis-cli -n 1 flushdb 2>/dev/null || true');
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.warn('⚠️  Cleanup warning:', error.message);
  }
}

/**
 * Print final summary
 */
function printFinalSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST EXECUTION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`Total Duration: ${results.summary.duration}ms`);
  console.log(`Coverage: ${results.summary.coverage}%`);
  console.log(`Quality Gates: ${results.qualityGates.passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  console.log('\nTest Types:');
  Object.entries(results.testTypes).forEach(([type, result]) => {
    const status = result.status === 'passed' ? '✅' : '❌';
    console.log(`  ${status} ${type}: ${result.duration}ms`);
  });
  
  if (!results.qualityGates.passed) {
    console.log('\nQuality Gate Failures:');
    results.qualityGates.failures.forEach(failure => {
      console.log(`  ❌ ${failure}`);
    });
  }
  
  console.log('='.repeat(60));
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {
    types: null,
    parallel: false,
    verbose: false,
    coverage: true,
    continueOnFailure: false,
    workers: null,
    pattern: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--types':
        parsed.types = args[++i].split(',');
        break;
      case '--parallel':
        parsed.parallel = true;
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      case '--no-coverage':
        parsed.coverage = false;
        break;
      case '--continue-on-failure':
        parsed.continueOnFailure = true;
        break;
      case '--workers':
        parsed.workers = parseInt(args[++i]);
        break;
      case '--pattern':
        parsed.pattern = args[++i];
        break;
    }
  }
  
  return parsed;
}

/**
 * Execute command asynchronously
 */
function execAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Run the test suite
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTests, config, results };
