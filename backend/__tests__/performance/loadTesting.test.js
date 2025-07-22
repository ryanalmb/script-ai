"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testUtils_1 = require("../utils/testUtils");
const userFactory_1 = require("../factories/userFactory");
const campaignFactory_1 = require("../factories/campaignFactory");
const index_1 = __importDefault(require("../../src/index"));
describe('Load Testing', () => {
    let testUtils;
    let prisma;
    let userFactory;
    let campaignFactory;
    beforeAll(async () => {
        const { TEST_STATE } = global;
        prisma = TEST_STATE.prisma;
        testUtils = (0, testUtils_1.createTestUtils)({
            prisma,
            app: index_1.default,
            redis: TEST_STATE.redis
        });
        userFactory = (0, userFactory_1.getUserFactory)(prisma);
        campaignFactory = (0, campaignFactory_1.getCampaignFactory)(prisma);
    });
    beforeEach(async () => {
        await testUtils.cleanDatabase();
        await testUtils.seedTestData();
    });
    afterEach(async () => {
        await testUtils.cleanupCreatedRecords();
    });
    afterAll(async () => {
        await testUtils.cleanup();
    });
    describe('API Endpoint Load Testing', () => {
        it('should handle high load on user authentication endpoint', async () => {
            const testUser = await userFactory.create();
            const performanceResult = await testUtils.performanceTest(async () => {
                await testUtils.makeRequest('POST', '/api/users/login', {
                    body: {
                        email: testUser.email,
                        password: testUser.plainPassword
                    }
                });
            }, {
                iterations: 200,
                concurrency: 20,
                warmupIterations: 10
            });
            expect(performanceResult.averageResponseTime).toBeLessThan(300);
            expect(performanceResult.p95ResponseTime).toBeLessThan(500);
            expect(performanceResult.p99ResponseTime).toBeLessThan(1000);
            expect(performanceResult.throughput).toBeGreaterThan(50);
            expect(performanceResult.errorRate).toBeLessThan(0.01);
            expect(performanceResult.memoryUsage.heapUsed).toBeLessThan(50 * 1024 * 1024);
            console.log('Authentication Load Test Results:', {
                averageResponseTime: `${performanceResult.averageResponseTime}ms`,
                p95ResponseTime: `${performanceResult.p95ResponseTime}ms`,
                p99ResponseTime: `${performanceResult.p99ResponseTime}ms`,
                throughput: `${performanceResult.throughput.toFixed(2)} req/sec`,
                errorRate: `${(performanceResult.errorRate * 100).toFixed(2)}%`,
                memoryIncrease: `${Math.round(performanceResult.memoryUsage.heapUsed / 1024 / 1024)}MB`
            });
        });
        it('should handle high load on campaign creation endpoint', async () => {
            const testUser = await userFactory.create();
            const authToken = await testUtils.authenticateUser(testUser.id);
            let campaignCounter = 0;
            const performanceResult = await testUtils.performanceTest(async () => {
                await testUtils.makeRequest('POST', '/api/campaigns', {
                    auth: authToken,
                    body: {
                        name: `Load Test Campaign ${campaignCounter++}`,
                        description: 'Campaign created during load testing',
                        settings: {
                            budget: 1000,
                            duration: 30,
                            platforms: ['twitter', 'facebook']
                        }
                    }
                });
            }, {
                iterations: 100,
                concurrency: 10,
                warmupIterations: 5
            });
            expect(performanceResult.averageResponseTime).toBeLessThan(500);
            expect(performanceResult.p95ResponseTime).toBeLessThan(1000);
            expect(performanceResult.p99ResponseTime).toBeLessThan(2000);
            expect(performanceResult.throughput).toBeGreaterThan(20);
            expect(performanceResult.errorRate).toBeLessThan(0.05);
            console.log('Campaign Creation Load Test Results:', {
                averageResponseTime: `${performanceResult.averageResponseTime}ms`,
                p95ResponseTime: `${performanceResult.p95ResponseTime}ms`,
                throughput: `${performanceResult.throughput.toFixed(2)} req/sec`,
                errorRate: `${(performanceResult.errorRate * 100).toFixed(2)}%`
            });
            const campaignCount = await prisma.campaign.count({
                where: { userId: testUser.id }
            });
            expect(campaignCount).toBeGreaterThan(90);
        });
        it('should handle high load on dashboard endpoint with complex queries', async () => {
            const testUser = await userFactory.create({
                withCampaigns: 10,
                withPosts: 50,
                withAnalytics: true
            });
            const authToken = await testUtils.authenticateUser(testUser.id);
            const performanceResult = await testUtils.performanceTest(async () => {
                await testUtils.makeRequest('GET', '/api/users/dashboard', {
                    auth: authToken,
                    query: {
                        include: 'campaigns,posts,analytics',
                        timeframe: '30d'
                    }
                });
            }, {
                iterations: 150,
                concurrency: 15,
                warmupIterations: 10
            });
            expect(performanceResult.averageResponseTime).toBeLessThan(400);
            expect(performanceResult.p95ResponseTime).toBeLessThan(800);
            expect(performanceResult.p99ResponseTime).toBeLessThan(1500);
            expect(performanceResult.throughput).toBeGreaterThan(30);
            expect(performanceResult.errorRate).toBe(0);
            console.log('Dashboard Load Test Results:', {
                averageResponseTime: `${performanceResult.averageResponseTime}ms`,
                p95ResponseTime: `${performanceResult.p95ResponseTime}ms`,
                throughput: `${performanceResult.throughput.toFixed(2)} req/sec`
            });
        });
    });
    describe('Database Performance Testing', () => {
        it('should handle concurrent database operations efficiently', async () => {
            const users = await userFactory.createMany(20);
            const performanceResult = await testUtils.performanceTest(async () => {
                const randomUser = users[Math.floor(Math.random() * users.length)];
                const operations = [
                    () => prisma.user.findUnique({ where: { id: randomUser.id } }),
                    () => prisma.campaign.create({
                        data: {
                            name: `DB Test Campaign ${Date.now()}`,
                            description: 'Database performance test campaign',
                            userId: randomUser.id,
                            status: 'DRAFT',
                            settings: {},
                            metrics: {}
                        }
                    }),
                    () => prisma.user.update({
                        where: { id: randomUser.id },
                        data: { updatedAt: new Date() }
                    }),
                    () => prisma.campaign.findMany({
                        where: { userId: randomUser.id },
                        include: { posts: true },
                        take: 10
                    })
                ];
                const randomOperation = operations[Math.floor(Math.random() * operations.length)];
                await randomOperation();
            }, {
                iterations: 300,
                concurrency: 25,
                warmupIterations: 20
            });
            expect(performanceResult.averageResponseTime).toBeLessThan(100);
            expect(performanceResult.p95ResponseTime).toBeLessThan(200);
            expect(performanceResult.p99ResponseTime).toBeLessThan(500);
            expect(performanceResult.throughput).toBeGreaterThan(100);
            expect(performanceResult.errorRate).toBeLessThan(0.01);
            console.log('Database Performance Test Results:', {
                averageResponseTime: `${performanceResult.averageResponseTime}ms`,
                p95ResponseTime: `${performanceResult.p95ResponseTime}ms`,
                throughput: `${performanceResult.throughput.toFixed(2)} ops/sec`,
                errorRate: `${(performanceResult.errorRate * 100).toFixed(2)}%`
            });
        });
        it('should handle large dataset queries efficiently', async () => {
            const users = await userFactory.createMany(50);
            const campaigns = [];
            for (const user of users) {
                const userCampaigns = await campaignFactory.createMany(20, { userId: user.id });
                campaigns.push(...userCampaigns);
            }
            console.log(`Created ${users.length} users and ${campaigns.length} campaigns for large dataset test`);
            const performanceResult = await testUtils.performanceTest(async () => {
                await prisma.campaign.findMany({
                    where: {
                        status: 'ACTIVE',
                        createdAt: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    },
                    include: {
                        user: {
                            select: { id: true, username: true, email: true }
                        },
                        posts: {
                            take: 5,
                            orderBy: { createdAt: 'desc' }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                });
            }, {
                iterations: 50,
                concurrency: 5,
                warmupIterations: 5
            });
            expect(performanceResult.averageResponseTime).toBeLessThan(300);
            expect(performanceResult.p95ResponseTime).toBeLessThan(600);
            expect(performanceResult.errorRate).toBe(0);
            console.log('Large Dataset Query Results:', {
                averageResponseTime: `${performanceResult.averageResponseTime}ms`,
                p95ResponseTime: `${performanceResult.p95ResponseTime}ms`,
                datasetSize: `${users.length} users, ${campaigns.length} campaigns`
            });
        });
    });
    describe('Cache Performance Testing', () => {
        it('should demonstrate cache performance benefits', async () => {
            const testUser = await userFactory.create({
                withCampaigns: 5,
                withPosts: 25
            });
            const authToken = await testUtils.authenticateUser(testUser.id);
            const noCacheResult = await testUtils.performanceTest(async () => {
                await testUtils.makeRequest('GET', '/api/users/dashboard', {
                    auth: authToken,
                    headers: { 'Cache-Control': 'no-cache' }
                });
            }, {
                iterations: 20,
                concurrency: 1,
                warmupIterations: 2
            });
            const withCacheResult = await testUtils.performanceTest(async () => {
                await testUtils.makeRequest('GET', '/api/users/dashboard', {
                    auth: authToken
                });
            }, {
                iterations: 50,
                concurrency: 5,
                warmupIterations: 5
            });
            expect(withCacheResult.averageResponseTime).toBeLessThan(noCacheResult.averageResponseTime * 0.5);
            expect(withCacheResult.throughput).toBeGreaterThan(noCacheResult.throughput * 1.5);
            console.log('Cache Performance Comparison:', {
                noCacheAverage: `${noCacheResult.averageResponseTime}ms`,
                withCacheAverage: `${withCacheResult.averageResponseTime}ms`,
                improvement: `${((noCacheResult.averageResponseTime - withCacheResult.averageResponseTime) / noCacheResult.averageResponseTime * 100).toFixed(1)}%`,
                noCacheThroughput: `${noCacheResult.throughput.toFixed(2)} req/sec`,
                withCacheThroughput: `${withCacheResult.throughput.toFixed(2)} req/sec`
            });
        });
    });
    describe('Memory Usage and Leak Testing', () => {
        it('should maintain stable memory usage under sustained load', async () => {
            const testUser = await userFactory.create();
            const authToken = await testUtils.authenticateUser(testUser.id);
            const initialMemory = process.memoryUsage();
            let campaignCounter = 0;
            const performanceResult = await testUtils.performanceTest(async () => {
                const operations = [
                    () => testUtils.makeRequest('GET', '/api/users/profile', { auth: authToken }),
                    () => testUtils.makeRequest('POST', '/api/campaigns', {
                        auth: authToken,
                        body: {
                            name: `Memory Test Campaign ${campaignCounter++}`,
                            description: 'Memory test campaign'
                        }
                    }),
                    () => testUtils.makeRequest('GET', '/api/users/dashboard', { auth: authToken })
                ];
                const randomOp = operations[Math.floor(Math.random() * operations.length)];
                await randomOp();
            }, {
                iterations: 500,
                concurrency: 10,
                warmupIterations: 50
            });
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
            expect(memoryIncreaseMB).toBeLessThan(100);
            expect(performanceResult.errorRate).toBeLessThan(0.02);
            console.log('Memory Usage Test Results:', {
                initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
                finalMemory: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
                memoryIncrease: `${memoryIncreaseMB.toFixed(2)}MB`,
                operationsCompleted: 500,
                averageResponseTime: `${performanceResult.averageResponseTime}ms`,
                errorRate: `${(performanceResult.errorRate * 100).toFixed(2)}%`
            });
            if (global.gc) {
                global.gc();
                const afterGCMemory = process.memoryUsage();
                const gcReclaimed = finalMemory.heapUsed - afterGCMemory.heapUsed;
                console.log('Memory reclaimed by GC:', `${Math.round(gcReclaimed / 1024 / 1024)}MB`);
            }
        });
    });
    describe('Stress Testing', () => {
        it('should handle extreme load gracefully', async () => {
            const users = await userFactory.createMany(10);
            const authTokens = await Promise.all(users.map(user => testUtils.authenticateUser(user.id)));
            let requestCounter = 0;
            const stressResult = await testUtils.performanceTest(async () => {
                const randomUser = Math.floor(Math.random() * users.length);
                const authToken = authTokens[randomUser];
                const operations = [
                    () => testUtils.makeRequest('GET', '/api/users/profile', { auth: authToken }),
                    () => testUtils.makeRequest('GET', '/api/users/dashboard', { auth: authToken }),
                    () => testUtils.makeRequest('POST', '/api/campaigns', {
                        auth: authToken,
                        body: {
                            name: `Stress Test Campaign ${requestCounter++}`,
                            description: 'High load stress test'
                        }
                    }),
                    () => testUtils.makeRequest('GET', '/api/campaigns', { auth: authToken })
                ];
                const randomOp = operations[Math.floor(Math.random() * operations.length)];
                await randomOp();
            }, {
                iterations: 1000,
                concurrency: 50,
                warmupIterations: 100
            });
            expect(stressResult.averageResponseTime).toBeLessThan(2000);
            expect(stressResult.errorRate).toBeLessThan(0.1);
            expect(stressResult.throughput).toBeGreaterThan(20);
            console.log('Stress Test Results:', {
                averageResponseTime: `${stressResult.averageResponseTime}ms`,
                p95ResponseTime: `${stressResult.p95ResponseTime}ms`,
                p99ResponseTime: `${stressResult.p99ResponseTime}ms`,
                throughput: `${stressResult.throughput.toFixed(2)} req/sec`,
                errorRate: `${(stressResult.errorRate * 100).toFixed(2)}%`,
                concurrency: 50,
                totalRequests: 1000
            });
            const healthCheckResponse = await testUtils.makeRequest('GET', '/api/health');
            expect(healthCheckResponse.status).toBe(200);
        });
    });
});
//# sourceMappingURL=loadTesting.test.js.map