#!/usr/bin/env node
/**
 * Twikit Comprehensive Test Runner
 * Executes all Twikit tests and generates detailed reports
 */

import { runTwikitComprehensiveTests } from '../tests/twikitComprehensiveTest';
import { logger } from '../utils/logger';

async function main() {
  console.log('🚀 Starting Twikit Comprehensive Test Suite...\n');
  
  try {
    const summary = await runTwikitComprehensiveTests();
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('🎉 TWIKIT COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log(`📊 Overall Results:`);
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   ✅ Passed: ${summary.passed}`);
    console.log(`   ❌ Failed: ${summary.failed}`);
    console.log(`   ⏭️  Skipped: ${summary.skipped}`);
    console.log(`   💥 Errors: ${summary.errors}`);
    console.log(`   📈 Success Rate: ${summary.successRate.toFixed(2)}%`);
    console.log(`   ⏱️  Duration: ${(summary.duration / 1000).toFixed(2)} seconds`);
    
    console.log(`\n📋 Category Breakdown:`);
    for (const [category, results] of Object.entries(summary.categoryResults)) {
      const status = results.successRate >= 90 ? '✅' : 
                    results.successRate >= 70 ? '⚠️' : '❌';
      console.log(`   ${status} ${category}: ${results.passed}/${results.total} (${results.successRate.toFixed(1)}%)`);
    }
    
    // Overall assessment
    console.log('\n🎯 Assessment:');
    if (summary.successRate >= 90) {
      console.log('   ✅ EXCELLENT: All major Twikit features are working correctly!');
      console.log('   🚀 The platform is ready for production deployment.');
    } else if (summary.successRate >= 70) {
      console.log('   ⚠️  GOOD: Most Twikit features are working with some minor issues.');
      console.log('   🔧 Review failed tests and address any critical issues.');
    } else if (summary.successRate >= 50) {
      console.log('   ⚠️  PARTIAL: Some Twikit features are working but significant issues exist.');
      console.log('   🛠️  Requires investigation and fixes before production use.');
    } else {
      console.log('   ❌ CRITICAL: Major issues detected with Twikit integration.');
      console.log('   🚨 Immediate attention required - not ready for production.');
    }
    
    console.log('\n📄 Detailed test report has been generated in the reports directory.');
    console.log('='.repeat(80));
    
    // Exit with appropriate code
    process.exit(summary.successRate >= 70 ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR: Test suite execution failed!');
    console.error('Error:', error);
    logger.error('Twikit test suite execution failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { main as runTwikitTestSuite };
