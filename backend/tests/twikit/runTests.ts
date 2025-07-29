/**
 * Twikit Test Runner - Task 31
 * 
 * Comprehensive test runner for all Twikit testing suites.
 * Provides organized test execution with reporting and metrics.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../../src/utils/logger';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

interface TestSuite {
  name: string;
  description: string;
  pattern: string;
  timeout: number;
  parallel: boolean;
  coverage: boolean;
}

interface TestRunOptions {
  suites?: string[];
  coverage?: boolean;
  watch?: boolean;
  verbose?: boolean;
  bail?: boolean;
  updateSnapshots?: boolean;
  maxWorkers?: string;
  testNamePattern?: string;
}

interface TestResults {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

// ============================================================================
// TEST SUITES CONFIGURATION
// ============================================================================

const TEST_SUITES: Record<string, TestSuite> = {
  unit: {
    name: 'Unit Tests',
    description: 'Individual service and component tests',
    pattern: 'tests/twikit/unit/**/*.test.ts',
    timeout: 30000,
    parallel: true,
    coverage: true
  },
  
  integration: {
    name: 'Integration Tests',
    description: 'Service interaction and integration tests',
    pattern: 'tests/twikit/integration/**/*.test.ts',
    timeout: 45000,
    parallel: true,
    coverage: true
  },
  
  load: {
    name: 'Load Tests',
    description: 'Performance and load testing',
    pattern: 'tests/twikit/load/**/*.test.ts',
    timeout: 120000,
    parallel: false,
    coverage: false
  },
  
  e2e: {
    name: 'End-to-End Tests',
    description: 'Complete workflow and user journey tests',
    pattern: 'tests/twikit/e2e/**/*.test.ts',
    timeout: 180000,
    parallel: false,
    coverage: false
  },
  
  security: {
    name: 'Security Tests',
    description: 'Security validation and compliance tests',
    pattern: 'tests/twikit/**/*.security.test.ts',
    timeout: 60000,
    parallel: true,
    coverage: true
  },
  
  all: {
    name: 'All Tests',
    description: 'Complete test suite execution',
    pattern: 'tests/twikit/**/*.test.ts',
    timeout: 300000,
    parallel: true,
    coverage: true
  }
};

// ============================================================================
// TEST RUNNER CLASS
// ============================================================================

export class TwikitTestRunner {
  private results: TestResults[] = [];
  private startTime: number = 0;
  private totalDuration: number = 0;

  /**
   * Run specified test suites
   */
  async runTests(options: TestRunOptions = {}): Promise<void> {
    this.startTime = Date.now();
    
    console.log('\n🧪 Twikit Comprehensive Testing Suite - Task 31\n');
    console.log('=' .repeat(60));
    
    const suitesToRun = options.suites || ['all'];
    
    for (const suiteKey of suitesToRun) {
      const suite = TEST_SUITES[suiteKey];
      if (!suite) {
        console.error(`❌ Unknown test suite: ${suiteKey}`);
        continue;
      }
      
      console.log(`\n📋 Running ${suite.name}`);
      console.log(`📝 ${suite.description}`);
      console.log('-'.repeat(40));
      
      const result = await this.runTestSuite(suite, options);
      this.results.push(result);
    }
    
    this.totalDuration = Date.now() - this.startTime;
    await this.generateReport();
  }

  /**
   * Run individual test suite
   */
  private async runTestSuite(suite: TestSuite, options: TestRunOptions): Promise<TestResults> {
    const startTime = Date.now();
    
    const jestArgs = [
      '--config', path.join(__dirname, 'jest.config.js'),
      '--testPathPattern', suite.pattern,
      '--testTimeout', suite.timeout.toString()
    ];

    // Add optional arguments
    if (options.coverage && suite.coverage) {
      jestArgs.push('--coverage');
    }
    
    if (options.verbose) {
      jestArgs.push('--verbose');
    }
    
    if (options.bail) {
      jestArgs.push('--bail');
    }
    
    if (options.updateSnapshots) {
      jestArgs.push('--updateSnapshot');
    }
    
    if (options.maxWorkers) {
      jestArgs.push('--maxWorkers', options.maxWorkers);
    } else if (!suite.parallel) {
      jestArgs.push('--maxWorkers', '1');
    }
    
    if (options.testNamePattern) {
      jestArgs.push('--testNamePattern', options.testNamePattern);
    }
    
    if (options.watch) {
      jestArgs.push('--watch');
    }

    // Add JSON reporter for parsing results
    jestArgs.push('--json', '--outputFile', `test-results-${suite.name.toLowerCase().replace(/\s+/g, '-')}.json`);

    try {
      const result = await this.executeJest(jestArgs);
      const duration = Date.now() - startTime;
      
      // Parse Jest results
      const testResults = await this.parseJestResults(suite.name.toLowerCase().replace(/\s+/g, '-'));
      
      console.log(`✅ ${suite.name} completed in ${duration}ms`);
      console.log(`   📊 Passed: ${testResults.passed}, Failed: ${testResults.failed}, Skipped: ${testResults.skipped}`);
      
      return {
        suite: suite.name,
        passed: testResults.passed,
        failed: testResults.failed,
        skipped: testResults.skipped,
        duration,
        coverage: testResults.coverage
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${suite.name} failed after ${duration}ms`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        coverage: undefined
      };
    }
  }

  /**
   * Execute Jest with specified arguments
   */
  private async executeJest(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', ...args], {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../../../')
      });

      jest.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Jest exited with code ${code}`));
        }
      });

      jest.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse Jest JSON results
   */
  private async parseJestResults(suiteName: string): Promise<{
    passed: number;
    failed: number;
    skipped: number;
    coverage?: any;
  }> {
    try {
      const resultsPath = path.join(__dirname, '../../../', `test-results-${suiteName}.json`);
      const resultsData = await fs.readFile(resultsPath, 'utf8');
      const results = JSON.parse(resultsData);
      
      // Clean up results file
      await fs.unlink(resultsPath).catch(() => {});
      
      return {
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
        skipped: results.numPendingTests || 0,
        coverage: results.coverageMap
      };
    } catch (error) {
      console.warn(`⚠️ Could not parse Jest results for ${suiteName}`);
      return { passed: 0, failed: 0, skipped: 0 };
    }
  }

  /**
   * Generate comprehensive test report
   */
  private async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TWIKIT TESTING SUITE REPORT');
    console.log('='.repeat(60));
    
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const totalTests = totalPassed + totalFailed + totalSkipped;
    
    console.log(`\n📈 Overall Results:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);
    console.log(`   ⏭️ Skipped: ${totalSkipped} (${((totalSkipped / totalTests) * 100).toFixed(1)}%)`);
    console.log(`   ⏱️ Total Duration: ${(this.totalDuration / 1000).toFixed(2)}s`);
    
    console.log(`\n📋 Suite Breakdown:`);
    for (const result of this.results) {
      const suiteTotal = result.passed + result.failed + result.skipped;
      const successRate = suiteTotal > 0 ? ((result.passed / suiteTotal) * 100).toFixed(1) : '0.0';
      
      console.log(`   ${result.suite}:`);
      console.log(`     ✅ ${result.passed} passed, ❌ ${result.failed} failed, ⏭️ ${result.skipped} skipped`);
      console.log(`     📊 Success Rate: ${successRate}%`);
      console.log(`     ⏱️ Duration: ${(result.duration / 1000).toFixed(2)}s`);
      
      if (result.coverage) {
        console.log(`     📈 Coverage: Lines ${result.coverage.lines}%, Functions ${result.coverage.functions}%`);
      }
    }
    
    // Generate recommendations
    console.log(`\n💡 Recommendations:`);
    
    if (totalFailed > 0) {
      console.log(`   🔧 Fix ${totalFailed} failing test${totalFailed > 1 ? 's' : ''}`);
    }
    
    if (totalSkipped > 0) {
      console.log(`   ⚡ Review ${totalSkipped} skipped test${totalSkipped > 1 ? 's' : ''}`);
    }
    
    const avgDuration = this.totalDuration / this.results.length;
    if (avgDuration > 30000) {
      console.log(`   🚀 Consider optimizing test performance (avg: ${(avgDuration / 1000).toFixed(2)}s per suite)`);
    }
    
    if (totalFailed === 0 && totalSkipped === 0) {
      console.log(`   🎉 All tests passing! Great work!`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Save detailed report
    await this.saveDetailedReport();
  }

  /**
   * Save detailed report to file
   */
  private async saveDetailedReport(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: this.totalDuration,
      summary: {
        totalTests: this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0),
        passed: this.results.reduce((sum, r) => sum + r.passed, 0),
        failed: this.results.reduce((sum, r) => sum + r.failed, 0),
        skipped: this.results.reduce((sum, r) => sum + r.skipped, 0)
      },
      suites: this.results
    };
    
    const reportPath = path.join(__dirname, '../../../coverage/twikit/test-report.json');
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.warn(`⚠️ Could not save detailed report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs(): TestRunOptions {
  const args = process.argv.slice(2);
  const options: TestRunOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--suites':
        options.suites = args[++i]?.split(',') || ['all'];
        break;
      case '--coverage':
        options.coverage = true;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--bail':
        options.bail = true;
        break;
      case '--update-snapshots':
        options.updateSnapshots = true;
        break;
      case '--max-workers':
        options.maxWorkers = args[++i];
        break;
      case '--test-name-pattern':
        options.testNamePattern = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
🧪 Twikit Test Runner - Task 31

Usage: npm run test:twikit [options]

Options:
  --suites <suites>           Comma-separated list of test suites to run
                              Available: unit,integration,load,e2e,security,all
                              Default: all
  
  --coverage                  Generate code coverage report
  --watch                     Watch mode for continuous testing
  --verbose                   Verbose output
  --bail                      Stop on first test failure
  --update-snapshots          Update Jest snapshots
  --max-workers <number>      Maximum number of worker processes
  --test-name-pattern <regex> Run tests matching pattern
  --help                      Show this help message

Examples:
  npm run test:twikit                           # Run all tests
  npm run test:twikit -- --suites unit,integration  # Run specific suites
  npm run test:twikit -- --coverage            # Run with coverage
  npm run test:twikit -- --watch               # Watch mode
  npm run test:twikit -- --verbose --bail      # Verbose with bail
`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  try {
    const options = parseArgs();
    const runner = new TwikitTestRunner();
    await runner.runTests(options);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { TwikitTestRunner, TEST_SUITES };
