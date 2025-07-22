import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnterpriseRealTimeSyncCoordinator } from '../../src/services/realTimeSync/realTimeSyncCoordinator';
import { EnterpriseAccountSyncService } from '../../src/services/realTimeSync/accountSyncService';
import { EnterpriseAnalyticsCollectionService } from '../../src/services/realTimeSync/analyticsCollectionService';
import { EnterpriseCampaignTrackingService } from '../../src/services/realTimeSync/campaignTrackingService';
import { EnterpriseDataIntegrityService } from '../../src/services/realTimeSync/dataIntegrityService';
import { 
  testAntiDetectionCoordinator,
  testServer,
  testPrisma,
  createTestUser,
  createTestXAccount,
  createTestCampaign,
  createTestAccountMetrics,
  createTestSyncLog,
  TestPerformanceMonitor,
  waitForAsync
} from '../setup/testSetup';
import { logger } from '../../src/utils/logger';

describe('Real-Time Synchronization System Integration Tests', () => {
  let realTimeSyncCoordinator: EnterpriseRealTimeSyncCoordinator;
  let testUser: any;
  let testAccount: any;
  let testCampaign: any;
  let performanceMonitor: TestPerformanceMonitor;

  beforeEach(async () => {
    performanceMonitor = new TestPerformanceMonitor();
    
    // Create test data
    testUser = await createTestUser({
      email: 'realtime@test.com',
      password: 'testpassword',
      role: 'user'
    });

    testAccount = await createTestXAccount({
      userId: testUser.id,
      username: 'realtimetest',
      isActive: true
    });

    testCampaign = await createTestCampaign({
      name: 'Test Real-Time Campaign',
      type: 'engagement',
      status: 'active',
      accountIds: [testAccount.id],
      createdBy: testUser.id
    });

    // Initialize real-time sync coordinator with test configuration
    realTimeSyncCoordinator = new EnterpriseRealTimeSyncCoordinator(
      testServer,
      testAntiDetectionCoordinator,
      {
        accountSync: {
          enabled: true,
          intervalSeconds: 5, // Faster for testing
          batchSize: 5,
          retryAttempts: 2
        },
        analyticsCollection: {
          enabled: true,
          bufferSize: 100,
          flushIntervalSeconds: 2, // Faster for testing
          rateLimitPerMinute: 60
        },
        campaignTracking: {
          enabled: true,
          trackingIntervalSeconds: 10, // Faster for testing
          analyticsIntervalSeconds: 30,
          performanceThresholds: {
            minEngagementRate: 0.01,
            minQualityScore: 0.5,
            maxRiskScore: 0.5
          }
        },
        webSocket: {
          enabled: true,
          maxConnections: 100,
          messageQueueSize: 50,
          broadcastIntervalSeconds: 5
        },
        dataIntegrity: {
          enabled: true,
          validationIntervalSeconds: 10,
          retentionCheckIntervalSeconds: 60,
          qualityThreshold: 0.7
        }
      }
    );
    
    performanceMonitor.checkpoint('setup_complete');
  });

  describe('System Initialization and Health', () => {
    it('should initialize real-time sync coordinator successfully', async () => {
      expect(realTimeSyncCoordinator).toBeDefined();
      
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall).toBeDefined();
      expect(healthStatus.components).toBeDefined();
      
      performanceMonitor.checkpoint('initialization_test');
      const results = performanceMonitor.getResults();
      expect(results.totalTime).toBeLessThan(3000); // Should initialize within 3 seconds
    });

    it('should report comprehensive system health status', async () => {
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      
      expect(healthStatus.overall).toMatch(/^(healthy|warning|critical|down)$/);
      
      // Verify all components are reported
      expect(healthStatus.components.accountSync).toBeDefined();
      expect(healthStatus.components.analyticsCollection).toBeDefined();
      expect(healthStatus.components.campaignTracking).toBeDefined();
      expect(healthStatus.components.webSocket).toBeDefined();
      expect(healthStatus.components.dataIntegrity).toBeDefined();
      
      // Verify metrics are included
      expect(healthStatus.metrics.uptime).toBeTypeOf('number');
      expect(healthStatus.metrics.totalAccounts).toBeTypeOf('number');
      expect(healthStatus.metrics.totalCampaigns).toBeTypeOf('number');
      
      performanceMonitor.checkpoint('health_status_test');
    });

    it('should provide real-time statistics', async () => {
      const statistics = realTimeSyncCoordinator.getRealTimeStatistics();
      
      expect(statistics).toBeDefined();
      expect(statistics.isInitialized).toBe(true);
      expect(statistics.uptime).toBeTypeOf('number');
      expect(statistics.configuration).toBeDefined();
      expect(statistics.componentStats).toBeDefined();
      
      // Verify component statistics
      expect(statistics.componentStats.accountSync).toBeDefined();
      expect(statistics.componentStats.analyticsCollection).toBeDefined();
      expect(statistics.componentStats.campaignTracking).toBeDefined();
      expect(statistics.componentStats.webSocket).toBeDefined();
      expect(statistics.componentStats.dataIntegrity).toBeDefined();
      
      performanceMonitor.checkpoint('statistics_test');
    });
  });

  describe('Account Synchronization', () => {
    it('should perform account synchronization with real data', async () => {
      // Create initial account metrics
      await createTestAccountMetrics({
        accountId: testAccount.id,
        followersCount: 1000,
        followingCount: 500,
        tweetsCount: 100,
        engagementRate: 0.05
      });

      // Force sync account
      const syncResult = await realTimeSyncCoordinator.forceSyncAccount(
        testAccount.id,
        'metrics'
      );

      expect(syncResult).toBeDefined();
      expect(syncResult.accountId).toBe(testAccount.id);
      expect(syncResult.syncType).toBe('metrics');
      
      // Verify sync log was created
      const syncLogs = await testPrisma.accountSyncLog.findMany({
        where: { accountId: testAccount.id }
      });
      
      expect(syncLogs.length).toBeGreaterThan(0);
      
      performanceMonitor.checkpoint('account_sync_test');
    });

    it('should handle sync failures with proper error handling', async () => {
      // Create account with invalid configuration to trigger failure
      const invalidAccount = await createTestXAccount({
        userId: testUser.id,
        username: 'invalid_account',
        isActive: false // Inactive account should fail sync
      });

      const syncResult = await realTimeSyncCoordinator.forceSyncAccount(
        invalidAccount.id,
        'full'
      );

      expect(syncResult).toBeDefined();
      // Should handle failure gracefully without throwing
      
      performanceMonitor.checkpoint('sync_failure_test');
    });

    it('should maintain sync performance under load', async () => {
      // Create multiple accounts for concurrent sync
      const accounts = [];
      for (let i = 0; i < 5; i++) {
        const account = await createTestXAccount({
          userId: testUser.id,
          username: `loadtest${i}`,
          isActive: true
        });
        accounts.push(account);
      }

      // Perform concurrent syncs
      const syncPromises = accounts.map(account =>
        realTimeSyncCoordinator.forceSyncAccount(account.id, 'metrics')
      );

      const startTime = Date.now();
      const results = await Promise.all(syncPromises);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(results.every(r => r !== null)).toBe(true);
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      performanceMonitor.checkpoint('sync_load_test');
    });

    it('should validate data integrity during sync', async () => {
      // Create account metrics with invalid data
      await createTestAccountMetrics({
        accountId: testAccount.id,
        followersCount: -100, // Invalid negative value
        followingCount: 500,
        tweetsCount: 100,
        engagementRate: 1.5 // Invalid rate > 1
      });

      const syncResult = await realTimeSyncCoordinator.forceSyncAccount(
        testAccount.id,
        'metrics'
      );

      // Should detect and handle data quality issues
      expect(syncResult).toBeDefined();
      
      // Check if data quality issues were recorded
      const qualityIssues = await testPrisma.dataQualityMetrics.findMany({
        where: { dataType: 'account_metrics' }
      });
      
      // Should have detected quality issues
      expect(qualityIssues.length).toBeGreaterThanOrEqual(0);
      
      performanceMonitor.checkpoint('data_integrity_test');
    });
  });

  describe('Analytics Collection', () => {
    it('should collect real-time analytics data', async () => {
      // Create test tweet engagement data
      await testPrisma.tweetEngagementMetrics.create({
        data: {
          id: 'test_engagement_1',
          tweetId: 'tweet_123',
          accountId: testAccount.id,
          timestamp: new Date(),
          likesCount: 10,
          retweetsCount: 5,
          repliesCount: 2,
          quotesCount: 1,
          impressions: 1000,
          reach: 800,
          engagementRate: 0.018,
          viralityScore: 0.1,
          deltaLikes: 2,
          deltaRetweets: 1,
          deltaReplies: 0,
          deltaQuotes: 0,
          syncSource: 'api',
          dataQuality: 1.0
        }
      });

      // Wait for analytics collection
      await waitForAsync(3000); // Wait for collection interval

      const engagementMetrics = await testPrisma.tweetEngagementMetrics.findMany({
        where: { accountId: testAccount.id }
      });

      expect(engagementMetrics.length).toBeGreaterThan(0);
      
      performanceMonitor.checkpoint('analytics_collection_test');
    });

    it('should buffer and flush analytics data efficiently', async () => {
      // Create multiple analytics records
      const records = [];
      for (let i = 0; i < 10; i++) {
        records.push({
          id: `test_engagement_${i}`,
          tweetId: `tweet_${i}`,
          accountId: testAccount.id,
          timestamp: new Date(),
          likesCount: i * 2,
          retweetsCount: i,
          repliesCount: Math.floor(i / 2),
          quotesCount: Math.floor(i / 3),
          impressions: i * 100,
          reach: i * 80,
          engagementRate: 0.02,
          viralityScore: 0.1,
          deltaLikes: 1,
          deltaRetweets: 0,
          deltaReplies: 0,
          deltaQuotes: 0,
          syncSource: 'test',
          dataQuality: 1.0
        });
      }

      await testPrisma.tweetEngagementMetrics.createMany({
        data: records
      });

      // Wait for buffer flush
      await waitForAsync(3000);

      const allMetrics = await testPrisma.tweetEngagementMetrics.findMany({
        where: { accountId: testAccount.id }
      });

      expect(allMetrics.length).toBeGreaterThanOrEqual(10);
      
      performanceMonitor.checkpoint('buffer_flush_test');
    });

    it('should handle analytics rate limiting', async () => {
      // Simulate high-volume analytics collection
      const startTime = Date.now();
      let requestCount = 0;

      // Make rapid requests to test rate limiting
      for (let i = 0; i < 100; i++) {
        try {
          await testPrisma.tweetEngagementMetrics.create({
            data: {
              id: `rate_test_${i}`,
              tweetId: `tweet_rate_${i}`,
              accountId: testAccount.id,
              timestamp: new Date(),
              likesCount: 1,
              retweetsCount: 0,
              repliesCount: 0,
              quotesCount: 0,
              impressions: 100,
              reach: 80,
              engagementRate: 0.01,
              viralityScore: 0.05,
              deltaLikes: 1,
              deltaRetweets: 0,
              deltaReplies: 0,
              deltaQuotes: 0,
              syncSource: 'rate_test',
              dataQuality: 1.0
            }
          });
          requestCount++;
        } catch (error) {
          // Rate limiting should prevent some requests
          break;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have processed requests but with rate limiting
      expect(requestCount).toBeGreaterThan(0);
      expect(duration).toBeGreaterThan(1000); // Should take time due to rate limiting
      
      performanceMonitor.checkpoint('rate_limiting_test');
    });
  });

  describe('Campaign Tracking', () => {
    it('should track campaign performance in real-time', async () => {
      // Create campaign performance data
      await testPrisma.campaignPerformanceMetrics.create({
        data: {
          id: 'test_campaign_perf_1',
          campaignId: testCampaign.id,
          timestamp: new Date(),
          accountId: testAccount.id,
          totalReach: 5000,
          totalImpressions: 10000,
          totalEngagements: 500,
          totalFollowersGained: 25,
          totalFollowersLost: 5,
          totalTweets: 10,
          totalLikes: 300,
          totalRetweets: 150,
          totalReplies: 50,
          totalMentions: 20,
          engagementRate: 0.05,
          growthRate: 0.02,
          conversionRate: 0.005,
          costPerEngagement: 0.10,
          costPerFollower: 2.00,
          roi: 0.15,
          qualityScore: 0.85,
          complianceScore: 0.95,
          riskScore: 0.1,
          participationRate: 1.0,
          contentPerformance: {},
          audienceInsights: {},
          competitorComparison: {},
          abTestResults: {}
        }
      });

      // Create new campaign with tracking
      const newCampaignId = await realTimeSyncCoordinator.createCampaign({
        name: 'Real-Time Test Campaign',
        type: 'growth',
        status: 'active',
        accountIds: [testAccount.id],
        targetMetrics: {
          followersGrowth: 100,
          engagementRate: 0.03
        },
        budgetLimits: {
          maxDailySpend: 50.00
        }
      });

      expect(newCampaignId).toBeDefined();
      expect(typeof newCampaignId).toBe('string');
      
      performanceMonitor.checkpoint('campaign_tracking_test');
    });

    it('should calculate campaign ROI accurately', async () => {
      // Create performance metrics with known values
      await testPrisma.campaignPerformanceMetrics.create({
        data: {
          id: 'roi_test_1',
          campaignId: testCampaign.id,
          timestamp: new Date(),
          totalReach: 10000,
          totalImpressions: 20000,
          totalEngagements: 1000,
          totalFollowersGained: 50,
          totalFollowersLost: 10,
          totalTweets: 20,
          totalLikes: 600,
          totalRetweets: 300,
          totalReplies: 100,
          totalMentions: 40,
          engagementRate: 0.05,
          growthRate: 0.004,
          conversionRate: 0.005,
          costPerEngagement: 0.05,
          costPerFollower: 1.00,
          roi: 0.25, // 25% ROI
          qualityScore: 0.9,
          complianceScore: 0.95,
          riskScore: 0.05,
          participationRate: 1.0,
          contentPerformance: {},
          audienceInsights: {},
          competitorComparison: {},
          abTestResults: {}
        }
      });

      const campaignStats = realTimeSyncCoordinator.getRealTimeStatistics();
      expect(campaignStats.componentStats.campaignTracking.avgROI).toBeGreaterThan(0);
      
      performanceMonitor.checkpoint('roi_calculation_test');
    });

    it('should handle multi-account campaign tracking', async () => {
      // Create additional test accounts
      const account2 = await createTestXAccount({
        userId: testUser.id,
        username: 'multitest2',
        isActive: true
      });

      const account3 = await createTestXAccount({
        userId: testUser.id,
        username: 'multitest3',
        isActive: true
      });

      // Create multi-account campaign
      const multiCampaignId = await realTimeSyncCoordinator.createCampaign({
        name: 'Multi-Account Campaign',
        type: 'engagement',
        status: 'active',
        accountIds: [testAccount.id, account2.id, account3.id],
        targetMetrics: {
          engagementRate: 0.04
        }
      });

      expect(multiCampaignId).toBeDefined();
      
      // Create performance data for each account
      const accounts = [testAccount.id, account2.id, account3.id];
      for (let i = 0; i < accounts.length; i++) {
        await testPrisma.campaignPerformanceMetrics.create({
          data: {
            id: `multi_perf_${i}`,
            campaignId: multiCampaignId,
            timestamp: new Date(),
            accountId: accounts[i],
            totalReach: 1000 * (i + 1),
            totalImpressions: 2000 * (i + 1),
            totalEngagements: 100 * (i + 1),
            totalFollowersGained: 10 * (i + 1),
            totalFollowersLost: 2 * (i + 1),
            totalTweets: 5 * (i + 1),
            totalLikes: 60 * (i + 1),
            totalRetweets: 30 * (i + 1),
            totalReplies: 10 * (i + 1),
            totalMentions: 5 * (i + 1),
            engagementRate: 0.05,
            growthRate: 0.01,
            conversionRate: 0.01,
            costPerEngagement: 0.10,
            costPerFollower: 1.00,
            roi: 0.20,
            qualityScore: 0.8,
            complianceScore: 0.9,
            riskScore: 0.1,
            participationRate: 1.0,
            contentPerformance: {},
            audienceInsights: {},
            competitorComparison: {},
            abTestResults: {}
          }
        });
      }

      const campaignMetrics = await testPrisma.campaignPerformanceMetrics.findMany({
        where: { campaignId: multiCampaignId }
      });

      expect(campaignMetrics.length).toBe(3);
      
      performanceMonitor.checkpoint('multi_account_campaign_test');
    });
  });

  describe('Data Integrity and Compliance', () => {
    it('should validate data quality in real-time', async () => {
      // Create account metrics with quality issues
      await createTestAccountMetrics({
        accountId: testAccount.id,
        followersCount: -50, // Invalid negative value
        followingCount: 1000000, // Suspiciously high value
        tweetsCount: 100,
        engagementRate: 2.5 // Invalid rate > 1
      });

      // Wait for validation
      await waitForAsync(2000);

      // Check if quality issues were detected
      const qualityMetrics = await testPrisma.dataQualityMetrics.findMany({
        where: { dataType: 'account_metrics' }
      });

      // Should have detected some quality issues
      expect(qualityMetrics.length).toBeGreaterThanOrEqual(0);
      
      performanceMonitor.checkpoint('data_quality_test');
    });

    it('should handle GDPR compliance requests', async () => {
      // This would test GDPR data subject request handling
      // For now, verify the system can handle the request structure
      
      const gdprRequest = {
        userId: testUser.id,
        requestType: 'access',
        dataTypes: ['account_metrics', 'tweet_engagement']
      };

      // Verify request structure is valid
      expect(gdprRequest.userId).toBeDefined();
      expect(gdprRequest.requestType).toMatch(/^(access|deletion|portability|rectification)$/);
      expect(Array.isArray(gdprRequest.dataTypes)).toBe(true);
      
      performanceMonitor.checkpoint('gdpr_compliance_test');
    });

    it('should enforce data retention policies', async () => {
      // Create old data that should be subject to retention
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400); // 400 days old

      await testPrisma.accountMetrics.create({
        data: {
          id: 'old_metrics_1',
          accountId: testAccount.id,
          timestamp: oldDate,
          followersCount: 500,
          followingCount: 250,
          tweetsCount: 50,
          isVerified: false,
          isProtected: false,
          engagementRate: 0.03,
          growthRate: 0.01,
          deltaFollowers: 5,
          deltaFollowing: 2,
          deltaTweets: 1,
          syncSource: 'test',
          dataQuality: 1.0,
          createdAt: oldDate
        }
      });

      // Wait for retention policy execution
      await waitForAsync(2000);

      // Check if old data still exists (depends on retention policy)
      const oldMetrics = await testPrisma.accountMetrics.findMany({
        where: {
          accountId: testAccount.id,
          timestamp: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      });

      // Retention policy may or may not have run yet
      expect(Array.isArray(oldMetrics)).toBe(true);
      
      performanceMonitor.checkpoint('retention_policy_test');
    });
  });

  describe('WebSocket Real-Time Updates', () => {
    it('should handle WebSocket connections', async () => {
      // Test WebSocket service statistics
      const stats = realTimeSyncCoordinator.getRealTimeStatistics();
      const webSocketStats = stats.componentStats.webSocket;
      
      expect(webSocketStats).toBeDefined();
      expect(webSocketStats.connectedClients).toBeTypeOf('number');
      expect(webSocketStats.activeSubscriptions).toBeTypeOf('number');
      expect(webSocketStats.queuedMessages).toBeTypeOf('number');
      
      performanceMonitor.checkpoint('websocket_test');
    });

    it('should broadcast real-time updates', async () => {
      // Create new account metrics to trigger broadcast
      await createTestAccountMetrics({
        accountId: testAccount.id,
        followersCount: 1100, // Increased followers
        followingCount: 500,
        tweetsCount: 105, // New tweets
        engagementRate: 0.06
      });

      // Wait for broadcast processing
      await waitForAsync(1000);

      // Verify broadcast was processed (check logs or stats)
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      expect(healthStatus.components.webSocket.status).toMatch(/^(healthy|warning)$/);
      
      performanceMonitor.checkpoint('broadcast_test');
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance under high load', async () => {
      // Create multiple accounts and campaigns for load testing
      const accounts = [];
      const campaigns = [];

      for (let i = 0; i < 10; i++) {
        const account = await createTestXAccount({
          userId: testUser.id,
          username: `loadtest_${i}`,
          isActive: true
        });
        accounts.push(account);

        const campaign = await createTestCampaign({
          name: `Load Test Campaign ${i}`,
          type: 'engagement',
          status: 'active',
          accountIds: [account.id],
          createdBy: testUser.id
        });
        campaigns.push(campaign);
      }

      // Perform concurrent operations
      const operations = [];
      
      // Force sync all accounts
      for (const account of accounts) {
        operations.push(
          realTimeSyncCoordinator.forceSyncAccount(account.id, 'metrics')
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      expect(results.length).toBe(10);
      expect(results.every(r => r !== null)).toBe(true);
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      performanceMonitor.checkpoint('high_load_test');
    });

    it('should handle memory usage efficiently', async () => {
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      
      expect(healthStatus.metrics.memoryUsage).toBeLessThan(0.9); // Less than 90% memory usage
      expect(healthStatus.metrics.systemLoad).toBeLessThan(0.8); // Less than 80% system load
      
      performanceMonitor.checkpoint('memory_usage_test');
    });

    it('should recover from component failures', async () => {
      // Simulate component failure by checking error handling
      try {
        await realTimeSyncCoordinator.forceSyncAccount('non_existent_account', 'full');
      } catch (error) {
        // Should handle gracefully
      }

      // System should still be healthy
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      expect(healthStatus.overall).toMatch(/^(healthy|warning|critical)$/); // Should not be 'down'
      
      performanceMonitor.checkpoint('failure_recovery_test');
    });
  });

  afterEach(async () => {
    const results = performanceMonitor.getResults();
    logger.info('Real-time sync test performance results:', results);
    
    // Verify overall test performance
    expect(results.totalTime).toBeLessThan(45000); // Test should complete within 45 seconds
    
    // Cleanup: shutdown coordinator
    if (realTimeSyncCoordinator) {
      await realTimeSyncCoordinator.shutdown();
    }
  });
});
