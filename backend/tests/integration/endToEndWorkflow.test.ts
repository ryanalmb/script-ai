import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { 
  testApp,
  testPrisma,
  testServer,
  testAntiDetectionCoordinator,
  createTestUser,
  createTestXAccount,
  createTestCampaign,
  generateTestJWT,
  TestPerformanceMonitor,
  waitForAsync
} from '../setup/testSetup';
import { EnterpriseRealTimeSyncCoordinator } from '../../src/services/realTimeSync/realTimeSyncCoordinator';
import { RealXApiClient } from '../../src/services/realXApiClient';
import { logger } from '../../src/utils/logger';

describe('End-to-End Workflow Integration Tests', () => {
  let testUser: any;
  let testAccount: any;
  let testCampaign: any;
  let authToken: string;
  let botToken: string;
  let realTimeSyncCoordinator: EnterpriseRealTimeSyncCoordinator;
  let performanceMonitor: TestPerformanceMonitor;

  beforeEach(async () => {
    performanceMonitor = new TestPerformanceMonitor();
    
    // Create comprehensive test data
    testUser = await createTestUser({
      email: 'e2e@example.com',
      password: 'testpassword',
      role: 'admin'
    });

    testAccount = await createTestXAccount({
      userId: testUser.id,
      username: 'e2etestaccount',
      isActive: true
    });

    testCampaign = await createTestCampaign({
      name: 'E2E Test Campaign',
      type: 'engagement',
      status: 'active',
      accountIds: [testAccount.id],
      createdBy: testUser.id
    });

    // Generate authentication tokens
    authToken = generateTestJWT(testUser.id, testUser.role);
    
    // Create test bot
    const testBot = await testPrisma.telegramBot.create({
      data: {
        id: 'e2e_test_bot',
        name: 'E2E Test Bot',
        telegramBotId: '987654321',
        telegramUsername: 'e2etestbot',
        botToken: 'e2e_test_bot_token',
        permissions: ['basic_access', 'post_tweets', 'manage_campaigns', 'view_analytics'],
        rateLimit: 100,
        isActive: true,
        metadata: { testBot: true }
      }
    });

    botToken = `Bot ${testBot.botToken}`;

    // Initialize real-time sync coordinator
    realTimeSyncCoordinator = new EnterpriseRealTimeSyncCoordinator(
      testServer,
      testAntiDetectionCoordinator,
      {
        accountSync: { enabled: true, intervalSeconds: 10, batchSize: 5, retryAttempts: 2 },
        analyticsCollection: { enabled: true, bufferSize: 100, flushIntervalSeconds: 5, rateLimitPerMinute: 60 },
        campaignTracking: { enabled: true, trackingIntervalSeconds: 30, analyticsIntervalSeconds: 60, performanceThresholds: { minEngagementRate: 0.01, minQualityScore: 0.5, maxRiskScore: 0.5 } },
        webSocket: { enabled: true, maxConnections: 100, messageQueueSize: 50, broadcastIntervalSeconds: 10 },
        dataIntegrity: { enabled: true, validationIntervalSeconds: 30, retentionCheckIntervalSeconds: 120, qualityThreshold: 0.7 }
      }
    );
    
    performanceMonitor.checkpoint('setup_complete');
  });

  describe('Complete Tweet Automation Workflow', () => {
    it('should execute full tweet automation workflow', async () => {
      // Step 1: Post tweet via Telegram bot
      const tweetData = {
        accountId: testAccount.id,
        text: 'E2E test tweet with automation workflow',
        scheduledFor: null,
        mediaUrls: []
      };

      const tweetResponse = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send(tweetData)
        .expect(200);

      expect(tweetResponse.body.success).toBe(true);
      const tweetId = tweetResponse.body.data.tweetId;
      
      performanceMonitor.checkpoint('tweet_posted');

      // Step 2: Verify tweet stored in database
      const storedTweet = await testPrisma.tweet.findFirst({
        where: { id: tweetId }
      });
      
      expect(storedTweet).toBeDefined();
      expect(storedTweet?.text).toBe(tweetData.text);
      expect(storedTweet?.status).toBe('posted');
      
      performanceMonitor.checkpoint('tweet_verified');

      // Step 3: Simulate engagement on the tweet
      const engagementData = {
        accountId: testAccount.id,
        targetId: tweetId,
        action: 'like'
      };

      const engagementResponse = await request(testApp)
        .post('/api/telegram-bot/engagement')
        .set('Authorization', botToken)
        .send(engagementData)
        .expect(200);

      expect(engagementResponse.body.success).toBe(true);
      
      performanceMonitor.checkpoint('engagement_performed');

      // Step 4: Wait for real-time sync to process
      await waitForAsync(2000);

      // Step 5: Verify automation performance was recorded
      const performanceMetrics = await testPrisma.automationPerformanceMetrics.findFirst({
        where: {
          accountId: testAccount.id,
          actionType: 'like'
        }
      });

      expect(performanceMetrics).toBeDefined();
      expect(performanceMetrics?.status).toBe('success');
      
      performanceMonitor.checkpoint('performance_recorded');

      // Step 6: Check analytics via API
      const analyticsResponse = await request(testApp)
        .get('/api/telegram-bot/analytics')
        .query({
          accountIds: [testAccount.id],
          timeframe: 1
        })
        .set('Authorization', botToken)
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.summary).toBeDefined();
      
      performanceMonitor.checkpoint('analytics_retrieved');

      // Step 7: Verify real-time sync health
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      expect(healthStatus.overall).toMatch(/^(healthy|warning)$/);
      
      performanceMonitor.checkpoint('sync_health_verified');

      logger.info('✅ Complete tweet automation workflow test passed');
    });

    it('should handle workflow with scheduled tweets', async () => {
      const scheduledTime = new Date(Date.now() + 30 * 1000); // 30 seconds from now
      
      // Step 1: Schedule tweet
      const scheduleResponse = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send({
          accountId: testAccount.id,
          text: 'Scheduled E2E test tweet',
          scheduledFor: scheduledTime.toISOString(),
          mediaUrls: []
        })
        .expect(200);

      expect(scheduleResponse.body.success).toBe(true);
      expect(scheduleResponse.body.data.status).toBe('scheduled');
      
      const tweetId = scheduleResponse.body.data.tweetId;
      
      performanceMonitor.checkpoint('tweet_scheduled');

      // Step 2: Verify scheduled tweet in database
      const scheduledTweet = await testPrisma.tweet.findFirst({
        where: { id: tweetId }
      });

      expect(scheduledTweet).toBeDefined();
      expect(scheduledTweet?.status).toBe('scheduled');
      expect(scheduledTweet?.scheduledFor).toBeDefined();
      
      performanceMonitor.checkpoint('schedule_verified');

      // Step 3: Wait for scheduled time (in real implementation, this would be handled by scheduler)
      await waitForAsync(1000);

      // Step 4: Simulate scheduler processing (update status to posted)
      await testPrisma.tweet.update({
        where: { id: tweetId },
        data: { 
          status: 'posted',
          postedAt: new Date()
        }
      });

      // Step 5: Verify tweet was "posted"
      const postedTweet = await testPrisma.tweet.findFirst({
        where: { id: tweetId }
      });

      expect(postedTweet?.status).toBe('posted');
      expect(postedTweet?.postedAt).toBeDefined();
      
      performanceMonitor.checkpoint('scheduled_tweet_posted');

      logger.info('✅ Scheduled tweet workflow test passed');
    });
  });

  describe('Campaign Management Workflow', () => {
    it('should execute complete campaign lifecycle', async () => {
      // Step 1: Create campaign via bot
      const campaignData = {
        name: 'E2E Campaign Lifecycle Test',
        type: 'growth',
        accountIds: [testAccount.id],
        targetMetrics: {
          followersGrowth: 50,
          engagementRate: 0.03
        },
        budgetLimits: {
          maxDailySpend: 25.00
        },
        duration: 7
      };

      const createResponse = await request(testApp)
        .post('/api/telegram-bot/campaign')
        .set('Authorization', botToken)
        .send(campaignData)
        .expect(200);

      expect(createResponse.body.success).toBe(true);
      const campaignId = createResponse.body.data.campaignId;
      
      performanceMonitor.checkpoint('campaign_created');

      // Step 2: Verify campaign in database
      const storedCampaign = await testPrisma.campaign.findFirst({
        where: { id: campaignId }
      });

      expect(storedCampaign).toBeDefined();
      expect(storedCampaign?.name).toBe(campaignData.name);
      expect(storedCampaign?.status).toBe('active');
      
      performanceMonitor.checkpoint('campaign_verified');

      // Step 3: Simulate campaign activities (tweets, engagements)
      const activities = [
        { action: 'tweet', text: 'Campaign tweet 1' },
        { action: 'tweet', text: 'Campaign tweet 2' },
        { action: 'engagement', targetId: 'user_123', type: 'follow' },
        { action: 'engagement', targetId: 'tweet_456', type: 'like' }
      ];

      for (const activity of activities) {
        if (activity.action === 'tweet') {
          await request(testApp)
            .post('/api/telegram-bot/tweet')
            .set('Authorization', botToken)
            .send({
              accountId: testAccount.id,
              text: activity.text,
              scheduledFor: null,
              mediaUrls: []
            })
            .expect(200);
        } else if (activity.action === 'engagement') {
          await request(testApp)
            .post('/api/telegram-bot/engagement')
            .set('Authorization', botToken)
            .send({
              accountId: testAccount.id,
              targetId: activity.targetId,
              action: activity.type
            })
            .expect(200);
        }
        
        await waitForAsync(100); // Small delay between activities
      }
      
      performanceMonitor.checkpoint('campaign_activities_completed');

      // Step 4: Create campaign performance metrics
      await testPrisma.campaignPerformanceMetrics.create({
        data: {
          id: 'e2e_campaign_perf_1',
          campaignId,
          timestamp: new Date(),
          accountId: testAccount.id,
          totalReach: 2500,
          totalImpressions: 5000,
          totalEngagements: 125,
          totalFollowersGained: 15,
          totalFollowersLost: 2,
          totalTweets: 2,
          totalLikes: 75,
          totalRetweets: 30,
          totalReplies: 20,
          totalMentions: 5,
          engagementRate: 0.05,
          growthRate: 0.013,
          conversionRate: 0.006,
          costPerEngagement: 0.20,
          costPerFollower: 1.67,
          roi: 0.18,
          qualityScore: 0.82,
          complianceScore: 0.95,
          riskScore: 0.08,
          participationRate: 1.0,
          contentPerformance: {},
          audienceInsights: {},
          competitorComparison: {},
          abTestResults: {}
        }
      });
      
      performanceMonitor.checkpoint('performance_metrics_created');

      // Step 5: Check campaign analytics
      const analyticsResponse = await request(testApp)
        .get('/api/telegram-bot/analytics')
        .query({
          campaignIds: [campaignId],
          timeframe: 24
        })
        .set('Authorization', botToken)
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.summary).toBeDefined();
      
      performanceMonitor.checkpoint('campaign_analytics_retrieved');

      // Step 6: List campaigns to verify it appears
      const campaignsResponse = await request(testApp)
        .get('/api/telegram-bot/campaigns')
        .set('Authorization', botToken)
        .expect(200);

      expect(campaignsResponse.body.success).toBe(true);
      const campaignInList = campaignsResponse.body.data.campaigns.find(
        (c: any) => c.id === campaignId
      );
      expect(campaignInList).toBeDefined();
      
      performanceMonitor.checkpoint('campaign_listed');

      logger.info('✅ Complete campaign lifecycle test passed');
    });
  });

  describe('Real-Time Data Flow Workflow', () => {
    it('should demonstrate real-time data synchronization', async () => {
      // Step 1: Create initial account metrics
      const initialMetrics = await testPrisma.accountMetrics.create({
        data: {
          id: 'e2e_initial_metrics',
          accountId: testAccount.id,
          timestamp: new Date(),
          followersCount: 1000,
          followingCount: 500,
          tweetsCount: 100,
          isVerified: false,
          isProtected: false,
          engagementRate: 0.04,
          growthRate: 0.01,
          deltaFollowers: 0,
          deltaFollowing: 0,
          deltaTweets: 0,
          syncSource: 'initial',
          dataQuality: 1.0
        }
      });
      
      performanceMonitor.checkpoint('initial_metrics_created');

      // Step 2: Force sync via bot API
      const syncResponse = await request(testApp)
        .post('/api/telegram-bot/sync')
        .set('Authorization', botToken)
        .send({
          accountIds: [testAccount.id],
          syncType: 'metrics'
        })
        .expect(200);

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.data.summary.total).toBe(1);
      
      performanceMonitor.checkpoint('sync_triggered');

      // Step 3: Wait for sync processing
      await waitForAsync(3000);

      // Step 4: Verify sync log was created
      const syncLogs = await testPrisma.accountSyncLog.findMany({
        where: { accountId: testAccount.id },
        orderBy: { startTime: 'desc' },
        take: 1
      });

      expect(syncLogs.length).toBeGreaterThan(0);
      expect(syncLogs[0].syncType).toBe('metrics');
      
      performanceMonitor.checkpoint('sync_log_verified');

      // Step 5: Create updated metrics to simulate real-time changes
      const updatedMetrics = await testPrisma.accountMetrics.create({
        data: {
          id: 'e2e_updated_metrics',
          accountId: testAccount.id,
          timestamp: new Date(),
          followersCount: 1025, // +25 followers
          followingCount: 505,   // +5 following
          tweetsCount: 103,      // +3 tweets
          isVerified: false,
          isProtected: false,
          engagementRate: 0.045, // Improved engagement
          growthRate: 0.025,     // Improved growth
          deltaFollowers: 25,
          deltaFollowing: 5,
          deltaTweets: 3,
          syncSource: 'realtime',
          dataQuality: 1.0
        }
      });
      
      performanceMonitor.checkpoint('updated_metrics_created');

      // Step 6: Check analytics to see updated data
      const analyticsResponse = await request(testApp)
        .get('/api/telegram-bot/analytics')
        .query({
          accountIds: [testAccount.id],
          timeframe: 1
        })
        .set('Authorization', botToken)
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.summary.totalFollowersGained).toBe(25);
      expect(analyticsResponse.body.data.summary.totalTweets).toBe(3);
      
      performanceMonitor.checkpoint('realtime_analytics_verified');

      // Step 7: Verify real-time sync system health
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      expect(healthStatus.overall).toMatch(/^(healthy|warning)$/);
      expect(healthStatus.components.accountSync.status).toMatch(/^(healthy|warning)$/);
      expect(healthStatus.components.analyticsCollection.status).toMatch(/^(healthy|warning)$/);
      
      performanceMonitor.checkpoint('sync_system_health_verified');

      logger.info('✅ Real-time data flow workflow test passed');
    });
  });

  describe('Anti-Detection Integration Workflow', () => {
    it('should demonstrate anti-detection measures in automation', async () => {
      // Step 1: Create anti-detection profile
      const profile = await testAntiDetectionCoordinator.createAntiDetectionProfile(
        testAccount.id,
        {
          riskLevel: 'medium',
          proxyType: 'residential',
          fingerprintRotation: 'session',
          behaviorPattern: 'conservative',
          geoLocation: 'US'
        }
      );

      expect(profile).toBeDefined();
      expect(profile.accountId).toBe(testAccount.id);
      
      performanceMonitor.checkpoint('anti_detection_profile_created');

      // Step 2: Perform multiple actions with anti-detection
      const actions = [
        { action: 'like', targetId: 'tweet_1' },
        { action: 'like', targetId: 'tweet_2' },
        { action: 'follow', targetId: 'user_1' },
        { action: 'like', targetId: 'tweet_3' },
        { action: 'retweet', targetId: 'tweet_4' }
      ];

      for (const action of actions) {
        const response = await request(testApp)
          .post('/api/telegram-bot/engagement')
          .set('Authorization', botToken)
          .send({
            accountId: testAccount.id,
            targetId: action.targetId,
            action: action.action
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        
        // Wait between actions to simulate human behavior
        await waitForAsync(1000 + Math.random() * 2000); // 1-3 seconds
      }
      
      performanceMonitor.checkpoint('anti_detection_actions_completed');

      // Step 3: Verify automation performance metrics include anti-detection data
      const performanceMetrics = await testPrisma.automationPerformanceMetrics.findMany({
        where: { accountId: testAccount.id },
        orderBy: { timestamp: 'desc' },
        take: 5
      });

      expect(performanceMetrics.length).toBe(5);
      
      // Verify anti-detection measures were applied
      performanceMetrics.forEach(metric => {
        expect(metric.detectionRisk).toBeLessThan(0.5); // Should be low risk
        expect(metric.qualityScore).toBeGreaterThan(0.7); // Should be high quality
        expect(metric.executionTime).toBeGreaterThan(500); // Should have realistic timing
      });
      
      performanceMonitor.checkpoint('anti_detection_metrics_verified');

      // Step 4: Check anti-detection statistics
      const antiDetectionStats = testAntiDetectionCoordinator.getAntiDetectionStatistics();
      expect(antiDetectionStats.profiles.active).toBeGreaterThan(0);
      expect(antiDetectionStats.systemHealth).toBeDefined();
      
      performanceMonitor.checkpoint('anti_detection_stats_verified');

      logger.info('✅ Anti-detection integration workflow test passed');
    });
  });

  describe('Error Recovery and Resilience Workflow', () => {
    it('should demonstrate system resilience under error conditions', async () => {
      // Step 1: Attempt action with invalid account
      const invalidResponse = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send({
          accountId: 'invalid_account_id',
          text: 'This should fail',
          scheduledFor: null,
          mediaUrls: []
        })
        .expect(404);

      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.botResponse.type).toBe('error');
      
      performanceMonitor.checkpoint('error_handling_verified');

      // Step 2: Verify system continues to work after error
      const validResponse = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send({
          accountId: testAccount.id,
          text: 'This should succeed after error',
          scheduledFor: null,
          mediaUrls: []
        })
        .expect(200);

      expect(validResponse.body.success).toBe(true);
      
      performanceMonitor.checkpoint('recovery_verified');

      // Step 3: Test rate limiting recovery
      // Make requests up to rate limit
      const rapidRequests = [];
      for (let i = 0; i < 65; i++) {
        rapidRequests.push(
          request(testApp)
            .get('/api/telegram-bot/status')
            .set('Authorization', botToken)
        );
      }

      const rapidResponses = await Promise.all(rapidRequests);
      const rateLimitedCount = rapidResponses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
      
      performanceMonitor.checkpoint('rate_limiting_verified');

      // Step 4: Wait for rate limit reset and verify recovery
      await waitForAsync(2000);

      const recoveryResponse = await request(testApp)
        .get('/api/telegram-bot/status')
        .set('Authorization', botToken)
        .expect(200);

      expect(recoveryResponse.body.success).toBe(true);
      
      performanceMonitor.checkpoint('rate_limit_recovery_verified');

      logger.info('✅ Error recovery and resilience workflow test passed');
    });
  });

  describe('Performance and Scalability Workflow', () => {
    it('should demonstrate system performance under load', async () => {
      // Step 1: Create multiple test accounts
      const accounts = [];
      for (let i = 0; i < 5; i++) {
        const account = await createTestXAccount({
          userId: testUser.id,
          username: `perftest${i}`,
          isActive: true
        });
        accounts.push(account);
      }
      
      performanceMonitor.checkpoint('test_accounts_created');

      // Step 2: Perform concurrent operations
      const concurrentOperations = [];
      
      // Tweet operations
      for (const account of accounts) {
        concurrentOperations.push(
          request(testApp)
            .post('/api/telegram-bot/tweet')
            .set('Authorization', botToken)
            .send({
              accountId: account.id,
              text: `Performance test tweet for ${account.username}`,
              scheduledFor: null,
              mediaUrls: []
            })
        );
      }

      // Analytics operations
      for (const account of accounts) {
        concurrentOperations.push(
          request(testApp)
            .get('/api/telegram-bot/analytics')
            .query({ accountIds: [account.id], timeframe: 1 })
            .set('Authorization', botToken)
        );
      }

      // Sync operations
      concurrentOperations.push(
        request(testApp)
          .post('/api/telegram-bot/sync')
          .set('Authorization', botToken)
          .send({
            accountIds: accounts.map(a => a.id),
            syncType: 'metrics'
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentOperations);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const successfulOperations = results.filter(r => r.status < 400).length;
      
      expect(successfulOperations).toBeGreaterThan(concurrentOperations.length * 0.8); // 80% success rate
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      performanceMonitor.checkpoint('concurrent_operations_completed');

      // Step 3: Verify system health after load
      const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
      expect(healthStatus.overall).toMatch(/^(healthy|warning)$/);
      
      performanceMonitor.checkpoint('post_load_health_verified');

      logger.info(`✅ Performance test passed: ${successfulOperations}/${concurrentOperations.length} operations successful in ${totalTime}ms`);
    });
  });

  afterEach(async () => {
    const results = performanceMonitor.getResults();
    logger.info('End-to-end workflow test performance results:', results);
    
    // Verify overall test performance
    expect(results.totalTime).toBeLessThan(120000); // Test should complete within 2 minutes
    
    // Cleanup
    if (realTimeSyncCoordinator) {
      await realTimeSyncCoordinator.shutdown();
    }
  });
});
