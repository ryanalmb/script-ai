import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createServer } from 'http';
import express from 'express';
import { logger } from '../../src/utils/logger';
import { EnterpriseAntiDetectionCoordinator } from '../../src/services/antiDetection/antiDetectionCoordinator';
import { EnterpriseRealTimeSyncCoordinator } from '../../src/services/realTimeSync/realTimeSyncCoordinator';

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// Global test instances
export let testPrisma: PrismaClient;
export let testRedis: Redis;
export let testApp: express.Application;
export let testServer: any;
export let testAntiDetectionCoordinator: EnterpriseAntiDetectionCoordinator;
export let testRealTimeSyncCoordinator: EnterpriseRealTimeSyncCoordinator;

// Test data cleanup tracking
const testDataCleanup: {
  users: string[];
  accounts: string[];
  campaigns: string[];
  tweets: string[];
  syncLogs: string[];
} = {
  users: [],
  accounts: [],
  campaigns: [],
  tweets: [],
  syncLogs: []
};

/**
 * Global test setup - runs once before all tests
 */
beforeAll(async () => {
  try {
    logger.info('🔧 Setting up test environment...');
    
    // Initialize test database
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL
        }
      },
      log: ['error']
    });

    // Test database connection
    await testPrisma.$connect();
    logger.info('✅ Test database connected');

    // Initialize test Redis
    testRedis = new Redis(TEST_REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    await testRedis.connect();
    logger.info('✅ Test Redis connected');

    // Initialize test Express app
    testApp = express();
    testApp.use(express.json());
    testApp.use(express.urlencoded({ extended: true }));

    // Create HTTP server for WebSocket testing
    testServer = createServer(testApp);

    // Initialize anti-detection coordinator for testing
    testAntiDetectionCoordinator = new EnterpriseAntiDetectionCoordinator();
    logger.info('✅ Test anti-detection coordinator initialized');

    // Initialize real-time sync coordinator for testing
    testRealTimeSyncCoordinator = new EnterpriseRealTimeSyncCoordinator(
      testServer,
      testAntiDetectionCoordinator,
      {
        accountSync: { enabled: false, intervalSeconds: 30, batchSize: 5, retryAttempts: 2 },
        analyticsCollection: { enabled: false, bufferSize: 100, flushIntervalSeconds: 5, rateLimitPerMinute: 60 },
        campaignTracking: { enabled: false, trackingIntervalSeconds: 60, analyticsIntervalSeconds: 120, performanceThresholds: { minEngagementRate: 0.01, minQualityScore: 0.5, maxRiskScore: 0.5 } },
        webSocket: { enabled: false, maxConnections: 100, messageQueueSize: 50, broadcastIntervalSeconds: 10 },
        dataIntegrity: { enabled: false, validationIntervalSeconds: 60, retentionCheckIntervalSeconds: 300, qualityThreshold: 0.7 }
      }
    );
    logger.info('✅ Test real-time sync coordinator initialized');

    // Start test server
    await new Promise<void>((resolve) => {
      testServer.listen(0, () => {
        const port = testServer.address()?.port;
        logger.info(`✅ Test server started on port ${port}`);
        resolve();
      });
    });

    // Clean test database
    await cleanTestDatabase();
    
    logger.info('✅ Test environment setup complete');
  } catch (error) {
    logger.error('❌ Test setup failed:', error);
    throw error;
  }
});

/**
 * Global test cleanup - runs once after all tests
 */
afterAll(async () => {
  try {
    logger.info('🧹 Cleaning up test environment...');
    
    // Shutdown services
    if (testRealTimeSyncCoordinator) {
      await testRealTimeSyncCoordinator.shutdown();
    }
    
    if (testAntiDetectionCoordinator) {
      await testAntiDetectionCoordinator.shutdown();
    }

    // Close test server
    if (testServer) {
      await new Promise<void>((resolve) => {
        testServer.close(() => {
          logger.info('✅ Test server closed');
          resolve();
        });
      });
    }

    // Clean test database
    await cleanTestDatabase();

    // Disconnect from databases
    if (testPrisma) {
      await testPrisma.$disconnect();
      logger.info('✅ Test database disconnected');
    }

    if (testRedis) {
      await testRedis.disconnect();
      logger.info('✅ Test Redis disconnected');
    }

    logger.info('✅ Test environment cleanup complete');
  } catch (error) {
    logger.error('❌ Test cleanup failed:', error);
  }
});

/**
 * Test cleanup - runs before each test
 */
beforeEach(async () => {
  try {
    // Clear Redis test data
    await testRedis.flushdb();
    
    // Reset test data tracking
    testDataCleanup.users = [];
    testDataCleanup.accounts = [];
    testDataCleanup.campaigns = [];
    testDataCleanup.tweets = [];
    testDataCleanup.syncLogs = [];
  } catch (error) {
    logger.error('Test beforeEach cleanup failed:', error);
  }
});

/**
 * Test cleanup - runs after each test
 */
afterEach(async () => {
  try {
    // Clean up test data created during the test
    await cleanupTestData();
  } catch (error) {
    logger.error('Test afterEach cleanup failed:', error);
  }
});

/**
 * Clean test database
 */
async function cleanTestDatabase(): Promise<void> {
  try {
    // Delete in reverse dependency order
    await testPrisma.realTimeAlert.deleteMany({});
    await testPrisma.dataQualityMetrics.deleteMany({});
    await testPrisma.campaignPerformanceMetrics.deleteMany({});
    await testPrisma.campaign.deleteMany({});
    await testPrisma.behavioralAnalytics.deleteMany({});
    await testPrisma.fingerprintPerformanceMetrics.deleteMany({});
    await testPrisma.proxyPerformanceMetrics.deleteMany({});
    await testPrisma.automationPerformanceMetrics.deleteMany({});
    await testPrisma.tweetEngagementMetrics.deleteMany({});
    await testPrisma.accountHealthStatus.deleteMany({});
    await testPrisma.accountMetrics.deleteMany({});
    await testPrisma.accountSyncLog.deleteMany({});
    await testPrisma.syncConfiguration.deleteMany({});
    await testPrisma.antiDetectionAuditLog.deleteMany({});
    await testPrisma.detectionEvent.deleteMany({});
    await testPrisma.antiDetectionProfile.deleteMany({});
    await testPrisma.behaviorSession.deleteMany({});
    await testPrisma.behaviorPattern.deleteMany({});
    await testPrisma.fingerprintProfile.deleteMany({});
    await testPrisma.browserFingerprint.deleteMany({});
    await testPrisma.proxySession.deleteMany({});
    await testPrisma.proxyPoolAssignment.deleteMany({});
    await testPrisma.proxyPool.deleteMany({});
    await testPrisma.proxy.deleteMany({});
    await testPrisma.tweet.deleteMany({});
    await testPrisma.xAccount.deleteMany({});
    await testPrisma.user.deleteMany({});

    logger.debug('Test database cleaned');
  } catch (error) {
    logger.error('Failed to clean test database:', error);
    throw error;
  }
}

/**
 * Clean up test data created during tests
 */
async function cleanupTestData(): Promise<void> {
  try {
    // Clean up in reverse dependency order
    if (testDataCleanup.syncLogs.length > 0) {
      await testPrisma.accountSyncLog.deleteMany({
        where: { id: { in: testDataCleanup.syncLogs } }
      });
    }

    if (testDataCleanup.tweets.length > 0) {
      await testPrisma.tweet.deleteMany({
        where: { id: { in: testDataCleanup.tweets } }
      });
    }

    if (testDataCleanup.campaigns.length > 0) {
      await testPrisma.campaign.deleteMany({
        where: { id: { in: testDataCleanup.campaigns } }
      });
    }

    if (testDataCleanup.accounts.length > 0) {
      await testPrisma.xAccount.deleteMany({
        where: { id: { in: testDataCleanup.accounts } }
      });
    }

    if (testDataCleanup.users.length > 0) {
      await testPrisma.user.deleteMany({
        where: { id: { in: testDataCleanup.users } }
      });
    }

    logger.debug('Test data cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup test data:', error);
  }
}

/**
 * Create test user
 */
export async function createTestUser(userData: {
  email: string;
  password: string;
  role?: string;
}): Promise<any> {
  try {
    const user = await testPrisma.user.create({
      data: {
        id: `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: userData.email,
        password: userData.password, // In real app, this would be hashed
        role: userData.role || 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    testDataCleanup.users.push(user.id);
    return user;
  } catch (error) {
    logger.error('Failed to create test user:', error);
    throw error;
  }
}

/**
 * Create test X account
 */
export async function createTestXAccount(accountData: {
  userId: string;
  username: string;
  isActive?: boolean;
}): Promise<any> {
  try {
    const account = await testPrisma.xAccount.create({
      data: {
        id: `test_account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: accountData.userId,
        username: accountData.username,
        isActive: accountData.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    testDataCleanup.accounts.push(account.id);
    return account;
  } catch (error) {
    logger.error('Failed to create test X account:', error);
    throw error;
  }
}

/**
 * Create test campaign
 */
export async function createTestCampaign(campaignData: {
  name: string;
  type: string;
  status?: string;
  accountIds?: string[];
  createdBy?: string;
}): Promise<any> {
  try {
    const campaign = await testPrisma.campaign.create({
      data: {
        id: `test_campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: campaignData.name,
        description: `Test campaign: ${campaignData.name}`,
        type: campaignData.type,
        status: campaignData.status || 'draft',
        accountIds: campaignData.accountIds || [],
        targetMetrics: {},
        budgetLimits: {},
        contentStrategy: {},
        automationRules: {},
        complianceSettings: {},
        createdBy: campaignData.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    testDataCleanup.campaigns.push(campaign.id);
    return campaign;
  } catch (error) {
    logger.error('Failed to create test campaign:', error);
    throw error;
  }
}

/**
 * Create test tweet
 */
export async function createTestTweet(tweetData: {
  accountId: string;
  text: string;
  status?: string;
}): Promise<any> {
  try {
    const tweet = await testPrisma.tweet.create({
      data: {
        id: `test_tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        accountId: tweetData.accountId,
        text: tweetData.text,
        status: tweetData.status || 'posted',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    testDataCleanup.tweets.push(tweet.id);
    return tweet;
  } catch (error) {
    logger.error('Failed to create test tweet:', error);
    throw error;
  }
}

/**
 * Create test account metrics
 */
export async function createTestAccountMetrics(metricsData: {
  accountId: string;
  followersCount?: number;
  followingCount?: number;
  tweetsCount?: number;
  engagementRate?: number;
}): Promise<any> {
  try {
    const metrics = await testPrisma.accountMetrics.create({
      data: {
        id: `test_metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        accountId: metricsData.accountId,
        timestamp: new Date(),
        followersCount: metricsData.followersCount || 1000,
        followingCount: metricsData.followingCount || 500,
        tweetsCount: metricsData.tweetsCount || 100,
        isVerified: false,
        isProtected: false,
        engagementRate: metricsData.engagementRate || 0.05,
        growthRate: 0.02,
        deltaFollowers: 10,
        deltaFollowing: 5,
        deltaTweets: 2,
        syncSource: 'test',
        dataQuality: 1.0,
        createdAt: new Date()
      }
    });

    return metrics;
  } catch (error) {
    logger.error('Failed to create test account metrics:', error);
    throw error;
  }
}

/**
 * Create test sync log
 */
export async function createTestSyncLog(syncData: {
  accountId: string;
  syncType: string;
  status: string;
  duration?: number;
}): Promise<any> {
  try {
    const syncLog = await testPrisma.accountSyncLog.create({
      data: {
        id: `test_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        accountId: syncData.accountId,
        syncType: syncData.syncType,
        status: syncData.status,
        startTime: new Date(),
        endTime: new Date(),
        duration: syncData.duration || 1000,
        recordsProcessed: 1,
        recordsUpdated: 1,
        recordsInserted: 0,
        recordsDeleted: 0,
        errorCount: 0,
        errorDetails: {},
        conflictsDetected: 0,
        conflictsResolved: 0,
        dataSnapshot: {},
        syncVersion: 1,
        metadata: {},
        createdAt: new Date()
      }
    });

    testDataCleanup.syncLogs.push(syncLog.id);
    return syncLog;
  } catch (error) {
    logger.error('Failed to create test sync log:', error);
    throw error;
  }
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate test JWT token
 */
export function generateTestJWT(userId: string, role: string = 'user'): string {
  // This would use the actual JWT signing logic
  // For testing, return a mock token
  return `test_jwt_${userId}_${role}_${Date.now()}`;
}

/**
 * Mock X API responses
 */
export const mockXApiResponses = {
  getUserProfile: (username: string) => ({
    id: `user_${username}`,
    username,
    displayName: `Test User ${username}`,
    followersCount: 1000,
    followingCount: 500,
    tweetsCount: 100,
    verified: false,
    protected: false,
    profileImageUrl: 'https://example.com/avatar.jpg',
    bio: 'Test user bio'
  }),

  getTweetById: (tweetId: string) => ({
    id: tweetId,
    text: 'Test tweet content',
    authorId: 'test_user',
    createdAt: new Date(),
    metrics: {
      likes: 10,
      retweets: 5,
      replies: 2,
      quotes: 1
    },
    impressions: 1000,
    reach: 800
  }),

  postTweet: (text: string) => ({
    id: `tweet_${Date.now()}`,
    text,
    authorId: 'test_user',
    createdAt: new Date(),
    metrics: {
      likes: 0,
      retweets: 0,
      replies: 0,
      quotes: 0
    }
  }),

  likeTweet: (tweetId: string) => ({
    success: true,
    tweetId,
    action: 'liked',
    timestamp: new Date()
  }),

  followUser: (userId: string) => ({
    success: true,
    userId,
    action: 'followed',
    timestamp: new Date()
  })
};

/**
 * Test environment validation
 */
export async function validateTestEnvironment(): Promise<boolean> {
  try {
    // Test database connection
    await testPrisma.$queryRaw`SELECT 1`;
    
    // Test Redis connection
    await testRedis.ping();
    
    // Test server is running
    if (!testServer.listening) {
      throw new Error('Test server is not running');
    }

    logger.info('✅ Test environment validation passed');
    return true;
  } catch (error) {
    logger.error('❌ Test environment validation failed:', error);
    return false;
  }
}

/**
 * Performance monitoring for tests
 */
export class TestPerformanceMonitor {
  private startTime: number;
  private checkpoints: { name: string; time: number }[] = [];

  constructor() {
    this.startTime = Date.now();
  }

  checkpoint(name: string): void {
    this.checkpoints.push({
      name,
      time: Date.now() - this.startTime
    });
  }

  getResults(): { totalTime: number; checkpoints: { name: string; time: number; delta: number }[] } {
    const totalTime = Date.now() - this.startTime;
    const results = this.checkpoints.map((checkpoint, index) => ({
      name: checkpoint.name,
      time: checkpoint.time,
      delta: index > 0 ? checkpoint.time - this.checkpoints[index - 1].time : checkpoint.time
    }));

    return { totalTime, checkpoints: results };
  }
}

// Export test configuration
export const testConfig = {
  database: {
    url: TEST_DATABASE_URL,
    maxConnections: 5
  },
  redis: {
    url: TEST_REDIS_URL,
    db: 1
  },
  server: {
    timeout: 5000,
    maxConnections: 10
  },
  performance: {
    maxTestDuration: 30000, // 30 seconds
    maxSyncDuration: 5000,  // 5 seconds
    maxApiResponseTime: 2000 // 2 seconds
  }
};
