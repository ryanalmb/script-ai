#!/usr/bin/env node

/**
 * Test Execution Script for Service Routing Pattern
 * 
 * Main entry point for running comprehensive service tests.
 * Usage: npm run test:services [scenario]
 */

import { ServiceTestRunner } from './serviceTestRunner';
import { testScenarios } from './testConfig';

// ============================================================================
// COMMAND LINE INTERFACE
// ============================================================================

interface TestOptions {
  scenario?: string;
  verbose?: boolean;
  timeout?: number;
  services?: string[];
}

function parseCommandLineArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--scenario':
      case '-s':
        options.scenario = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[++i]);
        break;
      case '--services':
        options.services = args[++i]?.split(',');
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!options.scenario && !arg.startsWith('-')) {
          options.scenario = arg;
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
🧪 Service Routing Pattern Test Runner

Usage: npm run test:services [options] [scenario]

Options:
  -s, --scenario <name>    Run specific test scenario (basic, routing, errorHandling, performance, integration)
  -v, --verbose           Enable verbose output
  -t, --timeout <ms>      Set test timeout in milliseconds
  --services <list>       Test only specific services (comma-separated)
  -h, --help              Show this help message

Scenarios:
  basic                   Test basic service functionality (default)
  routing                 Test service routing pattern
  errorHandling          Test error handling and graceful degradation
  performance            Test service performance under load
  integration            Test inter-service communication
  all                    Run all test scenarios

Examples:
  npm run test:services                    # Run basic tests
  npm run test:services routing            # Run routing tests
  npm run test:services --verbose          # Run with verbose output
  npm run test:services --services cache,auth  # Test specific services
  npm run test:services all --timeout 120000   # Run all tests with 2min timeout
`);
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function runTests(options: TestOptions): Promise<void> {
  const runner = new ServiceTestRunner();
  
  try {
    console.log('🚀 Starting Service Routing Pattern Tests');
    console.log('='.repeat(80));
    
    if (options.verbose) {
      console.log('📋 Test Configuration:');
      console.log(`  Scenario: ${options.scenario || 'basic'}`);
      console.log(`  Timeout: ${options.timeout || 60000}ms`);
      console.log(`  Services: ${options.services?.join(', ') || 'all'}`);
      console.log('');
    }

    // Set timeout if specified
    if (options.timeout) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Tests timed out after ${options.timeout}ms`)), options.timeout);
      });
      
      await Promise.race([
        runTestScenario(runner, options),
        timeoutPromise
      ]);
    } else {
      await runTestScenario(runner, options);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

async function runTestScenario(runner: ServiceTestRunner, options: TestOptions): Promise<void> {
  const scenario = options.scenario || 'basic';
  
  if (scenario === 'all') {
    // Run all scenarios
    for (const [scenarioName, scenarioConfig] of Object.entries(testScenarios)) {
      console.log(`\n🎯 Running ${scenarioConfig.name}...`);
      console.log(`   ${scenarioConfig.description}`);
      console.log('-'.repeat(80));
      
      await runner.runAllTests();
      
      console.log(`\n✅ ${scenarioConfig.name} completed\n`);
    }
  } else if (testScenarios[scenario as keyof typeof testScenarios]) {
    // Run specific scenario
    const scenarioConfig = testScenarios[scenario as keyof typeof testScenarios];
    console.log(`\n🎯 Running ${scenarioConfig.name}...`);
    console.log(`   ${scenarioConfig.description}`);
    console.log('-'.repeat(80));
    
    await runner.runAllTests();
  } else {
    throw new Error(`Unknown test scenario: ${scenario}. Available scenarios: ${Object.keys(testScenarios).join(', ')}, all`);
  }
}

// ============================================================================
// HEALTH CHECK UTILITIES
// ============================================================================

export async function quickHealthCheck(): Promise<boolean> {
  console.log('🏥 Running quick health check...');
  
  const runner = new ServiceTestRunner();
  
  try {
    const initialized = await runner.initializeController();
    if (!initialized) {
      console.log('❌ Controller initialization failed');
      return false;
    }
    
    console.log('✅ Controller initialized successfully');
    console.log('✅ Quick health check passed');
    return true;
    
  } catch (error) {
    console.error('❌ Quick health check failed:', error);
    return false;
  } finally {
    await runner.cleanup();
  }
}

export async function serviceStatus(): Promise<void> {
  console.log('📊 Checking service status...');
  
  const runner = new ServiceTestRunner();
  
  try {
    const initialized = await runner.initializeController();
    if (!initialized) {
      console.log('❌ Controller not available');
      return;
    }
    
    // Get basic status of each service
    console.log('\n📋 Service Status:');
    console.log('-'.repeat(50));
    
    const services = [
      'accountSimulatorService',
      'advancedCacheManager',
      'analyticsService',
      'contentSafetyFilter',
      'globalRateLimitCoordinator',
      'enterpriseAuthService'
    ];
    
    for (const serviceName of services) {
      try {
        const serviceProperty = (runner as any).getServicePropertyName(serviceName);
        const service = (runner as any).controller[serviceProperty];
        const status = service ? '✅ Available' : '❌ Not Available';
        console.log(`  ${serviceName.padEnd(30)} ${status}`);
      } catch (error) {
        console.log(`  ${serviceName.padEnd(30)} ❌ Error`);
      }
    }
    
  } catch (error) {
    console.error('❌ Service status check failed:', error);
  } finally {
    await runner.cleanup();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  const options = parseCommandLineArgs();
  
  // Handle special commands
  if (process.argv.includes('--health')) {
    await quickHealthCheck();
    return;
  }
  
  if (process.argv.includes('--status')) {
    await serviceStatus();
    return;
  }
  
  // Run tests
  await runTests(options);
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { ServiceTestRunner, runTests, quickHealthCheck, serviceStatus };
