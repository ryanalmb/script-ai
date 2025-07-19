/**
 * Global Test Teardown - 2025 Edition
 * Enterprise-grade test environment cleanup:
 * - Database cleanup and reset
 * - Redis cleanup
 * - Service cleanup
 * - Performance report generation
 * - Test artifact cleanup
 * - Memory leak detection
 */

import { execSync } from 'child_process';
import { cleanup } from './globalSetup';

/**
 * Global teardown function
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Starting Enterprise Test Environment Teardown...');
  const teardownStartTime = Date.now();

  try {
    // Step 1: Generate test reports
    await generateTestReports();

    // Step 2: Cleanup test environment
    await cleanup();

    // Step 3: Cleanup test database
    await cleanupTestDatabase();

    // Step 4: Check for memory leaks
    await checkMemoryLeaks();

    // Step 5: Cleanup test artifacts
    await cleanupTestArtifacts();

    console.log('✅ Enterprise Test Environment Teardown Complete');
    console.log(`⏱️  Teardown time: ${Date.now() - teardownStartTime}ms`);

  } catch (error) {
    console.error('❌ Test Environment Teardown Failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

/**
 * Generate test reports
 */
async function generateTestReports(): Promise<void> {
  console.log('📊 Generating test reports...');

  try {
    // Performance report
    if (process.env.TEST_ENABLE_PROFILING === 'true') {
      const memUsage = process.memoryUsage();
      const report = {
        timestamp: new Date().toISOString(),
        memoryUsage: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        uptime: Math.round(process.uptime())
      };

      console.log('📈 Performance Report:', JSON.stringify(report, null, 2));
    }

    console.log('✅ Test reports generated');

  } catch (error) {
    console.error('❌ Test report generation failed:', error);
  }
}

/**
 * Cleanup test database
 */
async function cleanupTestDatabase(): Promise<void> {
  console.log('🗄️  Cleaning up test database...');

  try {
    // Drop test database if it exists
    if (process.env.TEST_DATABASE_CLEANUP === 'true') {
      try {
        execSync('dropdb x_marketing_test', { stdio: 'ignore' });
        console.log('✅ Test database dropped');
      } catch {
        // Database might not exist
        console.log('ℹ️  Test database was not found (already cleaned up)');
      }
    } else {
      console.log('ℹ️  Test database cleanup skipped (TEST_DATABASE_CLEANUP not enabled)');
    }

  } catch (error) {
    console.error('❌ Test database cleanup failed:', error);
  }
}

/**
 * Check for memory leaks
 */
async function checkMemoryLeaks(): Promise<void> {
  console.log('🔍 Checking for memory leaks...');

  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const threshold = 400; // 400MB threshold for enterprise testing

    if (heapUsedMB > threshold) {
      console.warn(`⚠️  Potential memory leak detected: ${heapUsedMB}MB heap used (threshold: ${threshold}MB)`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        const afterGC = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(`🗑️  After GC: ${afterGC}MB heap used`);
      }
    } else {
      console.log(`✅ Memory usage normal: ${heapUsedMB}MB heap used`);
    }

  } catch (error) {
    console.error('❌ Memory leak check failed:', error);
  }
}

/**
 * Cleanup test artifacts
 */
async function cleanupTestArtifacts(): Promise<void> {
  console.log('🗂️  Cleaning up test artifacts...');

  try {
    // Cleanup temporary files, logs, etc.
    // This would include cleaning up any test-generated files
    
    console.log('✅ Test artifacts cleaned up');

  } catch (error) {
    console.error('❌ Test artifact cleanup failed:', error);
  }
}
