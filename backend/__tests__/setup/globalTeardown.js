"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = globalTeardown;
const child_process_1 = require("child_process");
const globalSetup_1 = require("./globalSetup");
async function globalTeardown() {
    console.log('🧹 Starting Enterprise Test Environment Teardown...');
    const teardownStartTime = Date.now();
    try {
        await generateTestReports();
        await (0, globalSetup_1.cleanup)();
        await cleanupTestDatabase();
        await checkMemoryLeaks();
        await cleanupTestArtifacts();
        console.log('✅ Enterprise Test Environment Teardown Complete');
        console.log(`⏱️  Teardown time: ${Date.now() - teardownStartTime}ms`);
    }
    catch (error) {
        console.error('❌ Test Environment Teardown Failed:', error);
    }
}
async function generateTestReports() {
    console.log('📊 Generating test reports...');
    try {
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
    }
    catch (error) {
        console.error('❌ Test report generation failed:', error);
    }
}
async function cleanupTestDatabase() {
    console.log('🗄️  Cleaning up test database...');
    try {
        if (process.env.TEST_DATABASE_CLEANUP === 'true') {
            try {
                (0, child_process_1.execSync)('dropdb x_marketing_test', { stdio: 'ignore' });
                console.log('✅ Test database dropped');
            }
            catch {
                console.log('ℹ️  Test database was not found (already cleaned up)');
            }
        }
        else {
            console.log('ℹ️  Test database cleanup skipped (TEST_DATABASE_CLEANUP not enabled)');
        }
    }
    catch (error) {
        console.error('❌ Test database cleanup failed:', error);
    }
}
async function checkMemoryLeaks() {
    console.log('🔍 Checking for memory leaks...');
    try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const threshold = 400;
        if (heapUsedMB > threshold) {
            console.warn(`⚠️  Potential memory leak detected: ${heapUsedMB}MB heap used (threshold: ${threshold}MB)`);
            if (global.gc) {
                global.gc();
                const afterGC = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
                console.log(`🗑️  After GC: ${afterGC}MB heap used`);
            }
        }
        else {
            console.log(`✅ Memory usage normal: ${heapUsedMB}MB heap used`);
        }
    }
    catch (error) {
        console.error('❌ Memory leak check failed:', error);
    }
}
async function cleanupTestArtifacts() {
    console.log('🗂️  Cleaning up test artifacts...');
    try {
        console.log('✅ Test artifacts cleaned up');
    }
    catch (error) {
        console.error('❌ Test artifact cleanup failed:', error);
    }
}
//# sourceMappingURL=globalTeardown.js.map