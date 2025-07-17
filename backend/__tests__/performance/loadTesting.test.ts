/**
 * Load Testing - 2025 Edition
 * Enterprise-grade performance testing:
 * - API endpoint load testing
 * - Database performance testing
 * - Cache performance validation
 * - Memory usage monitoring
 * - Concurrent user simulation
 * - Stress testing scenarios
 */

import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestUtils, TestUtils } from '../utils/testUtils';
import { getUserFactory } from '../factories/userFactory';
import { getCampaignFactory } from '../factories/campaignFactory';
import app from '../../src/index';

describe('Load Testing', () => {
  let testUtils: TestUtils;
  let prisma: PrismaClient;
  let userFactory: any;
  let campaignFactory: any;

  beforeAll(async () => {
    const { TEST_STATE } = global as any;
    prisma = TEST_STATE.prisma;
    
    testUtils = createTestUtils({
      prisma,
      app: app as Express,
      redis: TEST_STATE.redis
    });

    userFactory = getUserFactory(prisma);
    campaignFactory = getCampaignFactory(prisma);
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
      // Create test user
      const testUser = await userFactory.create();

      const performanceResult = await testUtils.performanceTest(
        async () => {
          await testUtils.makeRequest('POST', '/api/users/login', {
            body: {
              email: testUser.email,
              password: testUser.plainPassword
            }
          });
        },
        {
          iterations: 200,
          concurrency: 20,
          warmupIterations: 10
        }
      );

      // Performance assertions
      expect(performanceResult.averageResponseTime).toBeLessThan(300); // 300ms average
      expect(performanceResult.p95ResponseTime).toBeLessThan(500); // 500ms P95
      expect(performanceResult.p99ResponseTime).toBeLessThan(1000); // 1s P99
      expect(performanceResult.throughput).toBeGreaterThan(50); // >50 req/sec
      expect(performanceResult.errorRate).toBeLessThan(0.01); // <1% error rate

      // Memory usage should be reasonable
      expect(performanceResult.memoryUsage.heapUsed).toBeLessThan(50 * 1024 * 1024); // <50MB increase

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
      // Create test user and authenticate
      const testUser = await userFactory.create();
      const authToken = await testUtils.authenticateUser(testUser.id);

      let campaignCounter = 0;

      const performanceResult = await testUtils.performanceTest(
        async () => {
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
        },
        {
          iterations: 100,
          concurrency: 10,
          warmupIterations: 5
        }
      );

      // Performance assertions for write operations
      expect(performanceResult.averageResponseTime).toBeLessThan(500); // 500ms average
      expect(performanceResult.p95ResponseTime).toBeLessThan(1000); // 1s P95
      expect(performanceResult.p99ResponseTime).toBeLessThan(2000); // 2s P99
      expect(performanceResult.throughput).toBeGreaterThan(20); // >20 req/sec
      expect(performanceResult.errorRate).toBeLessThan(0.05); // <5% error rate

      console.log('Campaign Creation Load Test Results:', {
        averageResponseTime: `${performanceResult.averageResponseTime}ms`,
        p95ResponseTime: `${performanceResult.p95ResponseTime}ms`,
        throughput: `${performanceResult.throughput.toFixed(2)} req/sec`,
        errorRate: `${(performanceResult.errorRate * 100).toFixed(2)}%`
      });

      // Verify campaigns were created
      const campaignCount = await prisma.campaign.count({
        where: { userId: testUser.id }
      });
      expect(campaignCount).toBeGreaterThan(90); // Allow for some failures
    });

    it('should handle high load on dashboard endpoint with complex queries', async () => {
      // Create user with campaigns and posts
      const testUser = await userFactory.create({
        withCampaigns: 10,
        withPosts: 50,
        withAnalytics: true
      });
      const authToken = await testUtils.authenticateUser(testUser.id);

      const performanceResult = await testUtils.performanceTest(
        async () => {
          await testUtils.makeRequest('GET', '/api/users/dashboard', {
            auth: authToken,
            query: {
              include: 'campaigns,posts,analytics',
              timeframe: '30d'
            }
          });
        },
        {
          iterations: 150,
          concurrency: 15,
          warmupIterations: 10
        }
      );

      // Performance assertions for complex read operations
      expect(performanceResult.averageResponseTime).toBeLessThan(400); // 400ms average
      expect(performanceResult.p95ResponseTime).toBeLessThan(800); // 800ms P95
      expect(performanceResult.p99ResponseTime).toBeLessThan(1500); // 1.5s P99
      expect(performanceResult.throughput).toBeGreaterThan(30); // >30 req/sec
      expect(performanceResult.errorRate).toBe(0); // No errors expected for reads

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

      const performanceResult = await testUtils.performanceTest(
        async () => {
          const randomUser = users[Math.floor(Math.random() * users.length)];
          
          // Simulate mixed database operations
          const operations = [
            // Read operation
            () => prisma.user.findUnique({ where: { id: randomUser.id } }),
            // Write operation
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
            // Update operation
            () => prisma.user.update({
              where: { id: randomUser.id },
              data: { updatedAt: new Date() }
            }),
            // Complex query
            () => prisma.campaign.findMany({
              where: { userId: randomUser.id },
              include: { posts: true },
              take: 10
            })
          ];

          const randomOperation = operations[Math.floor(Math.random() * operations.length)];
          await randomOperation();
        },
        {
          iterations: 300,
          concurrency: 25,
          warmupIterations: 20
        }
      );

      // Database performance assertions
      expect(performanceResult.averageResponseTime).toBeLessThan(100); // 100ms average for DB ops
      expect(performanceResult.p95ResponseTime).toBeLessThan(200); // 200ms P95
      expect(performanceResult.p99ResponseTime).toBeLessThan(500); // 500ms P99
      expect(performanceResult.throughput).toBeGreaterThan(100); // >100 ops/sec
      expect(performanceResult.errorRate).toBeLessThan(0.01); // <1% error rate

      console.log('Database Performance Test Results:', {
        averageResponseTime: `${performanceResult.averageResponseTime}ms`,
        p95ResponseTime: `${performanceResult.p95ResponseTime}ms`,
        throughput: `${performanceResult.throughput.toFixed(2)} ops/sec`,
        errorRate: `${(performanceResult.errorRate * 100).toFixed(2)}%`
      });
    });

    it('should handle large dataset queries efficiently', async () => {
      // Create large dataset
      const users = await userFactory.createMany(50);
      const campaigns = [];
      
      for (const user of users) {
        const userCampaigns = await campaignFactory.createMany(20, { userId: user.id });
        campaigns.push(...userCampaigns);
      }

      console.log(`Created ${users.length} users and ${campaigns.length} campaigns for large dataset test`);

      const performanceResult = await testUtils.performanceTest(
        async () => {
          // Complex aggregation query
          await prisma.campaign.findMany({
            where: {
              status: 'ACTIVE',
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
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
        },
        {
          iterations: 50,
          concurrency: 5,
          warmupIterations: 5
        }
      );

      // Large dataset query performance
      expect(performanceResult.averageResponseTime).toBeLessThan(300); // 300ms average
      expect(performanceResult.p95ResponseTime).toBeLessThan(600); // 600ms P95
      expect(performanceResult.errorRate).toBe(0); // No errors

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

      // Test without cache (first request)
      const noCacheResult = await testUtils.performanceTest(
        async () => {
          await testUtils.makeRequest('GET', '/api/users/dashboard', {
            auth: authToken,
            headers: { 'Cache-Control': 'no-cache' }
          });
        },
        {
          iterations: 20,
          concurrency: 1,
          warmupIterations: 2
        }
      );

      // Test with cache (subsequent requests)
      const withCacheResult = await testUtils.performanceTest(
        async () => {
          await testUtils.makeRequest('GET', '/api/users/dashboard', {
            auth: authToken
          });
        },
        {
          iterations: 50,
          concurrency: 5,
          warmupIterations: 5
        }
      );

      // Cache should provide significant performance improvement
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

      // Run sustained load for memory testing
      const performanceResult = await testUtils.performanceTest(
        async () => {
          // Mix of operations to simulate real usage
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
        },
        {
          iterations: 500,
          concurrency: 10,
          warmupIterations: 50
        }
      );

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Memory usage should be reasonable
      expect(memoryIncreaseMB).toBeLessThan(100); // <100MB increase
      expect(performanceResult.errorRate).toBeLessThan(0.02); // <2% error rate

      console.log('Memory Usage Test Results:', {
        initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        finalMemory: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
        memoryIncrease: `${memoryIncreaseMB.toFixed(2)}MB`,
        operationsCompleted: 500,
        averageResponseTime: `${performanceResult.averageResponseTime}ms`,
        errorRate: `${(performanceResult.errorRate * 100).toFixed(2)}%`
      });

      // Force garbage collection if available
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
      const authTokens = await Promise.all(
        users.map(user => testUtils.authenticateUser(user.id))
      );

      let requestCounter = 0;

      const stressResult = await testUtils.performanceTest(
        async () => {
          const randomUser = Math.floor(Math.random() * users.length);
          const authToken = authTokens[randomUser];

          // High-intensity mixed operations
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
        },
        {
          iterations: 1000,
          concurrency: 50, // High concurrency
          warmupIterations: 100
        }
      );

      // Under stress, some degradation is acceptable but system should remain stable
      expect(stressResult.averageResponseTime).toBeLessThan(2000); // 2s average under stress
      expect(stressResult.errorRate).toBeLessThan(0.1); // <10% error rate under stress
      expect(stressResult.throughput).toBeGreaterThan(20); // >20 req/sec under stress

      console.log('Stress Test Results:', {
        averageResponseTime: `${stressResult.averageResponseTime}ms`,
        p95ResponseTime: `${stressResult.p95ResponseTime}ms`,
        p99ResponseTime: `${stressResult.p99ResponseTime}ms`,
        throughput: `${stressResult.throughput.toFixed(2)} req/sec`,
        errorRate: `${(stressResult.errorRate * 100).toFixed(2)}%`,
        concurrency: 50,
        totalRequests: 1000
      });

      // System should still be responsive after stress test
      const healthCheckResponse = await testUtils.makeRequest('GET', '/api/health');
      expect(healthCheckResponse.status).toBe(200);
    });
  });
});
