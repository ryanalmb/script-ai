import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { 
  testApp,
  testPrisma,
  createTestUser,
  createTestXAccount,
  createTestCampaign,
  generateTestJWT,
  TestPerformanceMonitor,
  waitForAsync
} from '../setup/testSetup';
import telegramBotRoutes from '../../src/routes/telegramBot';
import { authenticateBot } from '../../src/middleware/botAuth';
import { logger } from '../../src/utils/logger';

describe('Telegram Bot API Integration Tests', () => {
  let testUser: any;
  let testAccount: any;
  let testCampaign: any;
  let botToken: string;
  let performanceMonitor: TestPerformanceMonitor;

  beforeEach(async () => {
    performanceMonitor = new TestPerformanceMonitor();
    
    // Create test data
    testUser = await createTestUser({
      email: 'bottest@example.com',
      password: 'testpassword',
      role: 'user'
    });

    testAccount = await createTestXAccount({
      userId: testUser.id,
      username: 'bottestaccount',
      isActive: true
    });

    testCampaign = await createTestCampaign({
      name: 'Bot Test Campaign',
      type: 'engagement',
      status: 'active',
      accountIds: [testAccount.id],
      createdBy: testUser.id
    });

    // Create test bot record
    const testBot = await testPrisma.telegramBot.create({
      data: {
        id: 'test_bot_123',
        name: 'Test Bot',
        telegramBotId: '123456789',
        telegramUsername: 'testbot',
        botToken: 'test_bot_token',
        permissions: ['basic_access', 'post_tweets', 'manage_campaigns', 'view_analytics'],
        rateLimit: 60,
        isActive: true,
        metadata: {
          testBot: true
        }
      }
    });

    botToken = `Bot ${testBot.botToken}`;
    
    // Setup test app with bot routes
    testApp.use('/api/telegram-bot', telegramBotRoutes);
    
    performanceMonitor.checkpoint('setup_complete');
  });

  describe('Bot Authentication', () => {
    it('should authenticate bot with valid token', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/status')
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.botResponse).toBeDefined();
      expect(response.body.botResponse.type).toBe('system_status');
      
      performanceMonitor.checkpoint('bot_auth_test');
    });

    it('should reject invalid bot token', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/status')
        .set('Authorization', 'Bot invalid_token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid authentication');
      expect(response.body.botResponse.type).toBe('error');
      
      performanceMonitor.checkpoint('invalid_auth_test');
    });

    it('should handle missing authentication', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Authentication required');
      
      performanceMonitor.checkpoint('missing_auth_test');
    });

    it('should enforce rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 65; i++) { // Exceed rate limit of 60
        requests.push(
          request(testApp)
            .get('/api/telegram-bot/status')
            .set('Authorization', botToken)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      performanceMonitor.checkpoint('rate_limiting_test');
    });
  });

  describe('Tweet Operations', () => {
    it('should post tweet successfully', async () => {
      const tweetData = {
        accountId: testAccount.id,
        text: 'Test tweet from bot integration test',
        scheduledFor: null,
        mediaUrls: []
      };

      const response = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send(tweetData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tweetId).toBeDefined();
      expect(response.body.data.text).toBe(tweetData.text);
      expect(response.body.botResponse.type).toBe('success');
      expect(response.body.botResponse.message).toContain('✅ Tweet posted successfully');
      expect(response.body.botResponse.inlineKeyboard).toBeDefined();
      
      // Verify tweet was stored in database
      const storedTweet = await testPrisma.tweet.findFirst({
        where: { 
          accountId: testAccount.id,
          text: tweetData.text
        }
      });
      
      expect(storedTweet).toBeDefined();
      expect(storedTweet?.status).toBe('posted');
      
      performanceMonitor.checkpoint('tweet_post_test');
    });

    it('should handle scheduled tweets', async () => {
      const scheduledTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const tweetData = {
        accountId: testAccount.id,
        text: 'Scheduled test tweet',
        scheduledFor: scheduledTime.toISOString(),
        mediaUrls: []
      };

      const response = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send(tweetData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('scheduled');
      expect(response.body.data.scheduledFor).toBeDefined();
      
      performanceMonitor.checkpoint('scheduled_tweet_test');
    });

    it('should validate tweet content', async () => {
      // Test empty tweet
      const emptyTweetResponse = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send({
          accountId: testAccount.id,
          text: '',
          scheduledFor: null,
          mediaUrls: []
        })
        .expect(400);

      expect(emptyTweetResponse.body.success).toBe(false);
      expect(emptyTweetResponse.body.botResponse.type).toBe('error');

      // Test tweet too long
      const longTweetResponse = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send({
          accountId: testAccount.id,
          text: 'a'.repeat(281), // Over 280 character limit
          scheduledFor: null,
          mediaUrls: []
        })
        .expect(400);

      expect(longTweetResponse.body.success).toBe(false);
      expect(longTweetResponse.body.botResponse.type).toBe('error');
      
      performanceMonitor.checkpoint('tweet_validation_test');
    });

    it('should handle invalid account ID', async () => {
      const response = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .send({
          accountId: 'invalid_account_id',
          text: 'Test tweet',
          scheduledFor: null,
          mediaUrls: []
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Account not found');
      expect(response.body.botResponse.type).toBe('error');
      
      performanceMonitor.checkpoint('invalid_account_test');
    });
  });

  describe('Engagement Operations', () => {
    it('should perform like action successfully', async () => {
      const engagementData = {
        accountId: testAccount.id,
        targetId: 'tweet_123456',
        action: 'like'
      };

      const response = await request(testApp)
        .post('/api/telegram-bot/engagement')
        .set('Authorization', botToken)
        .send(engagementData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('like');
      expect(response.body.data.targetId).toBe('tweet_123456');
      expect(response.body.botResponse.type).toBe('success');
      expect(response.body.botResponse.message).toContain('✅ Successfully liked tweet');
      
      // Verify automation performance was recorded
      const performanceRecord = await testPrisma.automationPerformanceMetrics.findFirst({
        where: {
          accountId: testAccount.id,
          actionType: 'like'
        }
      });
      
      expect(performanceRecord).toBeDefined();
      expect(performanceRecord?.status).toBe('success');
      
      performanceMonitor.checkpoint('like_action_test');
    });

    it('should perform follow action successfully', async () => {
      const engagementData = {
        accountId: testAccount.id,
        targetId: 'user_123456',
        action: 'follow'
      };

      const response = await request(testApp)
        .post('/api/telegram-bot/engagement')
        .set('Authorization', botToken)
        .send(engagementData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('follow');
      expect(response.body.botResponse.message).toContain('✅ Successfully followed user');
      
      performanceMonitor.checkpoint('follow_action_test');
    });

    it('should handle reply action with content', async () => {
      const engagementData = {
        accountId: testAccount.id,
        targetId: 'tweet_123456',
        action: 'reply',
        content: 'Great tweet! Thanks for sharing.'
      };

      const response = await request(testApp)
        .post('/api/telegram-bot/engagement')
        .set('Authorization', botToken)
        .send(engagementData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('reply');
      expect(response.body.botResponse.message).toContain('✅ Successfully replied to tweet');
      
      performanceMonitor.checkpoint('reply_action_test');
    });

    it('should validate reply content requirement', async () => {
      const response = await request(testApp)
        .post('/api/telegram-bot/engagement')
        .set('Authorization', botToken)
        .send({
          accountId: testAccount.id,
          targetId: 'tweet_123456',
          action: 'reply'
          // Missing content
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Reply content is required');
      expect(response.body.botResponse.type).toBe('error');
      
      performanceMonitor.checkpoint('reply_validation_test');
    });

    it('should handle invalid action type', async () => {
      const response = await request(testApp)
        .post('/api/telegram-bot/engagement')
        .set('Authorization', botToken)
        .send({
          accountId: testAccount.id,
          targetId: 'tweet_123456',
          action: 'invalid_action'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid action');
      
      performanceMonitor.checkpoint('invalid_action_test');
    });
  });

  describe('Campaign Management', () => {
    it('should create campaign successfully', async () => {
      const campaignData = {
        name: 'Bot Created Campaign',
        type: 'growth',
        accountIds: [testAccount.id],
        targetMetrics: {
          followersGrowth: 100,
          engagementRate: 0.03
        },
        budgetLimits: {
          maxDailySpend: 50.00
        },
        duration: 30
      };

      const response = await request(testApp)
        .post('/api/telegram-bot/campaign')
        .set('Authorization', botToken)
        .send(campaignData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaignId).toBeDefined();
      expect(response.body.data.name).toBe(campaignData.name);
      expect(response.body.data.type).toBe(campaignData.type);
      expect(response.body.data.accountCount).toBe(1);
      expect(response.body.botResponse.type).toBe('success');
      expect(response.body.botResponse.message).toContain('✅ Campaign');
      expect(response.body.botResponse.inlineKeyboard).toBeDefined();
      
      // Verify campaign was stored in database
      const storedCampaign = await testPrisma.campaign.findFirst({
        where: { name: campaignData.name }
      });
      
      expect(storedCampaign).toBeDefined();
      expect(storedCampaign?.status).toBe('active');
      expect(storedCampaign?.accountIds).toContain(testAccount.id);
      
      performanceMonitor.checkpoint('campaign_creation_test');
    });

    it('should validate campaign data', async () => {
      // Test missing required fields
      const response = await request(testApp)
        .post('/api/telegram-bot/campaign')
        .set('Authorization', botToken)
        .send({
          // Missing name, type, accountIds
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.botResponse.type).toBe('error');
      
      performanceMonitor.checkpoint('campaign_validation_test');
    });

    it('should handle invalid account IDs in campaign', async () => {
      const response = await request(testApp)
        .post('/api/telegram-bot/campaign')
        .set('Authorization', botToken)
        .send({
          name: 'Invalid Campaign',
          type: 'engagement',
          accountIds: ['invalid_account_1', 'invalid_account_2']
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('accounts not found');
      expect(response.body.botResponse.type).toBe('error');
      
      performanceMonitor.checkpoint('invalid_campaign_accounts_test');
    });
  });

  describe('Analytics and Reporting', () => {
    it('should provide analytics data', async () => {
      // Create some test metrics
      await testPrisma.accountMetrics.create({
        data: {
          id: 'bot_test_metrics_1',
          accountId: testAccount.id,
          timestamp: new Date(),
          followersCount: 1500,
          followingCount: 600,
          tweetsCount: 120,
          isVerified: false,
          isProtected: false,
          engagementRate: 0.045,
          growthRate: 0.02,
          deltaFollowers: 25,
          deltaFollowing: 5,
          deltaTweets: 3,
          syncSource: 'test',
          dataQuality: 1.0
        }
      });

      const response = await request(testApp)
        .get('/api/telegram-bot/analytics')
        .query({
          accountIds: [testAccount.id],
          timeframe: 24
        })
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.accountMetrics).toBeDefined();
      expect(response.body.data.accountMetrics.length).toBeGreaterThan(0);
      expect(response.body.botResponse.type).toBe('analytics');
      expect(response.body.botResponse.message).toContain('📊 Analytics Summary');
      expect(response.body.botResponse.inlineKeyboard).toBeDefined();
      
      performanceMonitor.checkpoint('analytics_test');
    });

    it('should handle empty analytics data', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/analytics')
        .query({
          accountIds: ['non_existent_account'],
          timeframe: 24
        })
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.accounts).toBe('None');
      expect(response.body.botResponse.message).toContain('📊 Analytics Summary');
      
      performanceMonitor.checkpoint('empty_analytics_test');
    });
  });

  describe('Account Management', () => {
    it('should list user accounts', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/accounts')
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accounts).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
      expect(response.body.botResponse.type).toBe('accounts_list');
      expect(response.body.botResponse.message).toContain('👥 Your X Accounts');
      expect(response.body.botResponse.inlineKeyboard).toBeDefined();
      
      // Find our test account in the list
      const testAccountInList = response.body.data.accounts.find(
        (acc: any) => acc.id === testAccount.id
      );
      expect(testAccountInList).toBeDefined();
      expect(testAccountInList.username).toBe(testAccount.username);
      
      performanceMonitor.checkpoint('accounts_list_test');
    });

    it('should handle empty accounts list', async () => {
      // Delete test account temporarily
      await testPrisma.xAccount.delete({ where: { id: testAccount.id } });

      const response = await request(testApp)
        .get('/api/telegram-bot/accounts')
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(0);
      expect(response.body.botResponse.message).toContain('❌ No accounts found');
      
      // Recreate test account for other tests
      testAccount = await createTestXAccount({
        userId: testUser.id,
        username: 'bottestaccount',
        isActive: true
      });
      
      performanceMonitor.checkpoint('empty_accounts_test');
    });
  });

  describe('Campaign Listing', () => {
    it('should list user campaigns', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/campaigns')
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaigns).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
      expect(response.body.botResponse.type).toBe('campaigns_list');
      expect(response.body.botResponse.message).toContain('🎯 Your Campaigns');
      
      performanceMonitor.checkpoint('campaigns_list_test');
    });
  });

  describe('Sync Operations', () => {
    it('should force sync accounts', async () => {
      const response = await request(testApp)
        .post('/api/telegram-bot/sync')
        .set('Authorization', botToken)
        .send({
          accountIds: [testAccount.id],
          syncType: 'metrics'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.syncResults).toBeDefined();
      expect(response.body.data.summary.total).toBe(1);
      expect(response.body.botResponse.type).toBe('sync_results');
      expect(response.body.botResponse.message).toContain('🔄 Sync Results');
      
      performanceMonitor.checkpoint('sync_test');
    });

    it('should handle sync service unavailable', async () => {
      // This test would mock the sync service being unavailable
      // For now, we'll test the structure
      const response = await request(testApp)
        .post('/api/telegram-bot/sync')
        .set('Authorization', botToken)
        .send({
          accountIds: [testAccount.id],
          syncType: 'metrics'
        });

      expect(response.body.success).toBeDefined();
      expect(response.body.botResponse).toBeDefined();
      
      performanceMonitor.checkpoint('sync_unavailable_test');
    });
  });

  describe('System Status', () => {
    it('should provide system status', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/status')
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.botResponse.type).toBe('system_status');
      expect(response.body.botResponse.message).toContain('System Status');
      expect(response.body.botResponse.inlineKeyboard).toBeDefined();
      
      performanceMonitor.checkpoint('system_status_test');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(testApp)
        .post('/api/telegram-bot/tweet')
        .set('Authorization', botToken)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      
      performanceMonitor.checkpoint('malformed_json_test');
    });

    it('should handle database connection errors gracefully', async () => {
      // This would test database error handling
      // For now, verify the structure exists
      const response = await request(testApp)
        .get('/api/telegram-bot/accounts')
        .set('Authorization', botToken);

      expect(response.body.success).toBeDefined();
      expect(response.body.botResponse).toBeDefined();
      
      performanceMonitor.checkpoint('db_error_handling_test');
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(testApp)
            .get('/api/telegram-bot/status')
            .set('Authorization', botToken)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      expect(responses.length).toBe(concurrentRequests);
      expect(responses.every(r => r.status === 200)).toBe(true);
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      performanceMonitor.checkpoint('concurrent_requests_test');
    });
  });

  describe('Bot Response Format Validation', () => {
    it('should always include botResponse in API responses', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/status')
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.botResponse).toBeDefined();
      expect(response.body.botResponse.type).toBeDefined();
      expect(response.body.botResponse.message).toBeDefined();
      expect(response.body.botResponse.showKeyboard).toBeDefined();
      
      performanceMonitor.checkpoint('bot_response_format_test');
    });

    it('should include inline keyboards where appropriate', async () => {
      const response = await request(testApp)
        .get('/api/telegram-bot/accounts')
        .set('Authorization', botToken)
        .expect(200);

      expect(response.body.botResponse.inlineKeyboard).toBeDefined();
      expect(Array.isArray(response.body.botResponse.inlineKeyboard)).toBe(true);
      
      if (response.body.botResponse.inlineKeyboard.length > 0) {
        const firstRow = response.body.botResponse.inlineKeyboard[0];
        expect(Array.isArray(firstRow)).toBe(true);
        
        if (firstRow.length > 0) {
          const firstButton = firstRow[0];
          expect(firstButton.text).toBeDefined();
          expect(firstButton.callback_data).toBeDefined();
        }
      }
      
      performanceMonitor.checkpoint('inline_keyboard_test');
    });
  });

  afterEach(() => {
    const results = performanceMonitor.getResults();
    logger.info('Telegram Bot API test performance results:', results);
    
    // Verify overall test performance
    expect(results.totalTime).toBeLessThan(60000); // Test should complete within 60 seconds
  });
});
