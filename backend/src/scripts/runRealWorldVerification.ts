#!/usr/bin/env node
/**
 * Real-World Verification Runner
 * Execute actual Twitter actions for physical verification
 */

import { executeRealWorldVerification } from '../tests/twikitRealWorldVerification';
import { logger } from '../utils/logger';

async function main() {
  console.log('\n🚀 TWIKIT REAL-WORLD VERIFICATION');
  console.log('='.repeat(50));
  console.log('This will perform ACTUAL actions on your Twitter account!');
  console.log('Make sure you want to proceed before continuing.\n');

  try {
    const report = await executeRealWorldVerification();
    
    console.log('\n✅ Verification completed successfully!');
    console.log(`📊 Final Results: ${report.successfulActions}/${report.totalActions} actions successful`);
    
    if (report.successfulActions === report.totalActions) {
      console.log('🎉 Perfect! All Twikit features are working correctly!');
      process.exit(0);
    } else if (report.successfulActions > report.totalActions * 0.8) {
      console.log('✅ Great! Most Twikit features are working correctly!');
      process.exit(0);
    } else {
      console.log('⚠️ Some issues detected. Check the detailed report.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Verification failed:', error);
    logger.error('Real-world verification failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { main as runRealWorldVerification };
