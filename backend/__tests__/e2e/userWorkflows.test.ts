/**
 * User Workflows End-to-End Tests - 2025 Edition
 * Comprehensive testing of complete user journeys:
 * - User registration to campaign creation workflow
 * - Authentication and authorization flows
 * - Cross-service integration testing
 * - Error handling and recovery scenarios
 * - Performance and reliability testing
 * - Real-world usage patterns
 */

import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestUtils, TestUtils } from '../utils/testUtils';
import { getUserFactory } from '../factories/userFactory';
import { getCampaignFactory } from '../factories/campaignFactory';
import app from '../../src/index';

describe('User Workflows E2E Tests', () => {
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

  describe('Complete User Registration to Campaign Creation Workflow', () => {
    it('should complete full user journey from registration to campaign creation', async () => {
      // Step 1: User Registration
      const registrationData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User'
      };

      const registrationResponse = await testUtils.makeRequest('POST', '/api/users/register', {
        body: registrationData,
        expectStatus: 201
      });

      expect(registrationResponse.body).toBeValidApiResponse();
      expect(registrationResponse.body).toHaveCorrelationId();
      
      const { user, token } = registrationResponse.body.data;
      const correlationId = registrationResponse.body.metadata?.correlationId;

      // Step 2: Email Verification (simulated)
      const verificationResponse = await testUtils.makeRequest('POST', '/api/users/verify-email', {
        body: { token: 'simulated-verification-token', userId: user.id },
        auth: token,
        expectStatus: 200
      });

      expect(verificationResponse.body).toBeValidApiResponse();
      expect(verificationResponse.body).toHaveCorrelationId();

      // Step 3: Profile Update
      const profileUpdateData = {
        bio: 'Marketing professional passionate about digital campaigns',
        timezone: 'America/New_York',
        preferences: {
          notifications: {
            email: true,
            push: true,
            telegram: false
          },
          privacy: {
            profilePublic: true,
            analyticsSharing: true
          }
        }
      };

      const profileResponse = await testUtils.makeRequest('PUT', '/api/users/profile', {
        auth: token,
        body: profileUpdateData,
        expectStatus: 200
      });

      expect(profileResponse.body).toBeValidApiResponse();
      expect(profileResponse.body).toHaveCorrelationId();

      // Step 4: Create First Campaign
      const campaignData = {
        name: 'My First Marketing Campaign',
        description: 'A test campaign to validate the platform',
        settings: {
          budget: 1000,
          duration: 30,
          targetAudience: {
            ageRange: '25-35',
            interests: ['technology', 'marketing'],
            locations: ['United States']
          },
          platforms: ['twitter', 'facebook', 'linkedin']
        }
      };

      const campaignResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: token,
        body: campaignData,
        expectStatus: 201
      });

      expect(campaignResponse.body).toBeValidApiResponse();
      expect(campaignResponse.body).toHaveCorrelationId();
      
      const campaign = campaignResponse.body.data;
      expect(campaign.userId).toBe(user.id);
      expect(campaign.status).toBe('DRAFT');

      // Step 5: Create Campaign Content
      const postData = {
        content: 'Exciting news! Check out our latest product launch. #innovation #technology',
        platform: 'twitter',
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        campaignId: campaign.id
      };

      const postResponse = await testUtils.makeRequest('POST', '/api/posts', {
        auth: token,
        body: postData,
        expectStatus: 201
      });

      expect(postResponse.body).toBeValidApiResponse();
      expect(postResponse.body).toHaveCorrelationId();

      // Step 6: Activate Campaign
      const activationResponse = await testUtils.makeRequest('PATCH', `/api/campaigns/${campaign.id}/status`, {
        auth: token,
        body: { status: 'ACTIVE' },
        expectStatus: 200
      });

      expect(activationResponse.body).toBeValidApiResponse();
      expect(activationResponse.body.data.status).toBe('ACTIVE');

      // Step 7: Verify Campaign Analytics
      const analyticsResponse = await testUtils.makeRequest('GET', `/api/campaigns/${campaign.id}/analytics`, {
        auth: token,
        expectStatus: 200
      });

      expect(analyticsResponse.body).toBeValidApiResponse();
      expect(analyticsResponse.body.data).toHaveValidMetrics();

      // Step 8: Get User Dashboard
      const dashboardResponse = await testUtils.makeRequest('GET', '/api/users/dashboard', {
        auth: token,
        expectStatus: 200
      });

      expect(dashboardResponse.body).toBeValidApiResponse();
      expect(dashboardResponse.body.data.campaigns).toHaveLength(1);
      expect(dashboardResponse.body.data.posts).toHaveLength(1);

      // Verify all data exists in database
      await expect(null).toExistInDatabase('user', { id: user.id, emailVerified: true });
      await expect(null).toExistInDatabase('campaign', { id: campaign.id, status: 'ACTIVE' });
      await expect(null).toExistInDatabase('post', { campaignId: campaign.id });

      // Verify correlation ID consistency across requests
      const allResponses = [
        registrationResponse,
        verificationResponse,
        profileResponse,
        campaignResponse,
        postResponse,
        activationResponse,
        analyticsResponse,
        dashboardResponse
      ];

      // Each response should have a correlation ID
      allResponses.forEach(response => {
        expect(response.body).toHaveCorrelationId();
      });
    });

    it('should handle workflow interruption and recovery', async () => {
      // Step 1: Start user registration
      const registrationData = {
        email: 'interrupted@example.com',
        username: 'interrupted',
        password: 'SecurePassword123!'
      };

      const registrationResponse = await testUtils.makeRequest('POST', '/api/users/register', {
        body: registrationData,
        expectStatus: 201
      });

      const { user, token } = registrationResponse.body.data;

      // Step 2: Simulate network error during campaign creation
      testUtils.simulateNetworkError();

      const campaignResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: token,
        body: {
          name: 'Failed Campaign',
          description: 'This should fail due to network error'
        }
      });

      expect(campaignResponse.status).toBeGreaterThanOrEqual(500);

      // Step 3: Restore network and retry
      testUtils.restoreExternalServices();

      const retryResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: token,
        body: {
          name: 'Successful Campaign',
          description: 'This should succeed after network recovery'
        },
        expectStatus: 201
      });

      expect(retryResponse.body).toBeValidApiResponse();
      expect(retryResponse.body.data.userId).toBe(user.id);

      // Verify user and campaign exist
      await expect(null).toExistInDatabase('user', { id: user.id });
      await expect(null).toExistInDatabase('campaign', { userId: user.id, name: 'Successful Campaign' });
    });
  });

  describe('Multi-User Collaboration Workflow', () => {
    it('should support team collaboration on campaigns', async () => {
      // Create team owner
      const owner = await userFactory.createAdmin();
      const ownerToken = await testUtils.authenticateUser(owner.id);

      // Create team members
      const member1 = await userFactory.create();
      const member2 = await userFactory.create();
      const member1Token = await testUtils.authenticateUser(member1.id);
      const member2Token = await testUtils.authenticateUser(member2.id);

      // Owner creates a team campaign
      const campaignResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: ownerToken,
        body: {
          name: 'Team Collaboration Campaign',
          description: 'A campaign for team collaboration testing',
          settings: {
            collaborators: [member1.id, member2.id],
            permissions: {
              [member1.id]: ['read', 'write'],
              [member2.id]: ['read']
            }
          }
        },
        expectStatus: 201
      });

      const campaign = campaignResponse.body.data;

      // Member 1 (with write access) adds content
      const post1Response = await testUtils.makeRequest('POST', '/api/posts', {
        auth: member1Token,
        body: {
          content: 'Content created by team member 1',
          platform: 'twitter',
          campaignId: campaign.id
        },
        expectStatus: 201
      });

      expect(post1Response.body).toBeValidApiResponse();

      // Member 2 (read-only) tries to add content - should fail
      const post2Response = await testUtils.makeRequest('POST', '/api/posts', {
        auth: member2Token,
        body: {
          content: 'Content created by team member 2',
          platform: 'facebook',
          campaignId: campaign.id
        },
        expectStatus: 403
      });

      expect(post2Response.body).toHaveValidErrorFormat();
      expect(post2Response.body.error.type).toBe('AUTHORIZATION_ERROR');

      // Member 2 can view campaign
      const viewResponse = await testUtils.makeRequest('GET', `/api/campaigns/${campaign.id}`, {
        auth: member2Token,
        expectStatus: 200
      });

      expect(viewResponse.body).toBeValidApiResponse();
      expect(viewResponse.body.data.id).toBe(campaign.id);

      // Owner can view all activity
      const activityResponse = await testUtils.makeRequest('GET', `/api/campaigns/${campaign.id}/activity`, {
        auth: ownerToken,
        expectStatus: 200
      });

      expect(activityResponse.body).toBeValidApiResponse();
      expect(activityResponse.body.data.activities).toHaveLength(2); // Campaign creation + post creation
    });
  });

  describe('Cross-Service Integration Workflow', () => {
    it('should integrate with Telegram bot for campaign management', async () => {
      // Create user with Telegram integration
      const user = await userFactory.createWithTelegram();
      const authToken = await testUtils.authenticateUser(user.id);

      // Create campaign via API
      const campaignResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: authToken,
        body: {
          name: 'Telegram Integrated Campaign',
          description: 'Campaign managed via Telegram bot',
          settings: {
            telegramNotifications: true,
            autoPost: true
          }
        },
        expectStatus: 201
      });

      const campaign = campaignResponse.body.data;

      // Simulate Telegram bot webhook for campaign update
      const telegramWebhookResponse = await testUtils.makeRequest('POST', '/api/webhooks/telegram', {
        body: {
          message: {
            from: { id: user.telegramId },
            text: `/campaign_status ${campaign.id}`,
            chat: { id: user.telegramId }
          }
        },
        expectStatus: 200
      });

      expect(telegramWebhookResponse.body).toBeValidApiResponse();

      // Verify campaign status was retrieved
      const statusResponse = await testUtils.makeRequest('GET', `/api/campaigns/${campaign.id}`, {
        auth: authToken,
        expectStatus: 200
      });

      expect(statusResponse.body).toBeValidApiResponse();
      expect(statusResponse.body.data.id).toBe(campaign.id);
    });

    it('should integrate with LLM service for content generation', async () => {
      const user = await userFactory.create();
      const authToken = await testUtils.authenticateUser(user.id);

      // Mock LLM service responses
      testUtils.mockExternalService('llm-service', {
        '/generate-content': {
          content: 'AI-generated marketing content for your campaign',
          suggestions: ['#marketing', '#AI', '#automation'],
          sentiment: 'positive',
          readabilityScore: 85
        }
      });

      // Create campaign
      const campaignResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: authToken,
        body: {
          name: 'AI-Powered Campaign',
          description: 'Campaign using AI-generated content'
        },
        expectStatus: 201
      });

      const campaign = campaignResponse.body.data;

      // Generate content using LLM service
      const contentResponse = await testUtils.makeRequest('POST', '/api/content/generate', {
        auth: authToken,
        body: {
          campaignId: campaign.id,
          platform: 'twitter',
          tone: 'professional',
          keywords: ['innovation', 'technology']
        },
        expectStatus: 200
      });

      expect(contentResponse.body).toBeValidApiResponse();
      expect(contentResponse.body.data.content).toContain('AI-generated');
      expect(contentResponse.body.data.suggestions).toContain('#marketing');

      // Create post with AI-generated content
      const postResponse = await testUtils.makeRequest('POST', '/api/posts', {
        auth: authToken,
        body: {
          content: contentResponse.body.data.content,
          platform: 'twitter',
          campaignId: campaign.id,
          metadata: {
            aiGenerated: true,
            sentiment: contentResponse.body.data.sentiment
          }
        },
        expectStatus: 201
      });

      expect(postResponse.body).toBeValidApiResponse();
      expect(postResponse.body.data.metadata.aiGenerated).toBe(true);

      // Verify integration tracking
      await expect(null).toExistInDatabase('post', {
        campaignId: campaign.id,
        content: contentResponse.body.data.content
      });
    });
  });

  describe('Error Recovery and Resilience Workflow', () => {
    it('should handle database connection failures gracefully', async () => {
      const user = await userFactory.create();
      const authToken = await testUtils.authenticateUser(user.id);

      // Simulate database error
      testUtils.simulateDatabaseError();

      const campaignResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: authToken,
        body: {
          name: 'Database Error Campaign',
          description: 'This should handle database errors gracefully'
        }
      });

      expect(campaignResponse.status).toBeGreaterThanOrEqual(500);
      expect(campaignResponse.body).toHaveValidErrorFormat();
      expect(campaignResponse.body.error.type).toBe('DATABASE_ERROR');
      expect(campaignResponse.body.error.retryable).toBe(true);

      // Restore database and retry
      testUtils.restoreDatabase();

      const retryResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: authToken,
        body: {
          name: 'Successful Campaign After Recovery',
          description: 'This should succeed after database recovery'
        },
        expectStatus: 201
      });

      expect(retryResponse.body).toBeValidApiResponse();
      expect(retryResponse.body.data.name).toBe('Successful Campaign After Recovery');
    });

    it('should handle rate limiting gracefully', async () => {
      const user = await userFactory.create();
      const authToken = await testUtils.authenticateUser(user.id);

      // Make many requests quickly to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const promise = testUtils.makeRequest('GET', '/api/users/profile', {
          auth: authToken
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper format
      rateLimitedResponses.forEach(response => {
        expect(response.body).toHaveValidErrorFormat();
        expect(response.body.error.type).toBe('RATE_LIMIT_ERROR');
        expect(response.body.error.retryable).toBe(true);
        expect(response.body.error.retryAfter).toBeGreaterThan(0);
      });

      // Wait for rate limit to reset
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Subsequent request should succeed
      const finalResponse = await testUtils.makeRequest('GET', '/api/users/profile', {
        auth: authToken,
        expectStatus: 200
      });

      expect(finalResponse.body).toBeValidApiResponse();
    });
  });

  describe('Performance and Scalability Workflow', () => {
    it('should handle high-volume user operations efficiently', async () => {
      const users = await userFactory.createMany(10);
      const authTokens = await Promise.all(
        users.map(user => testUtils.authenticateUser(user.id))
      );

      // Each user creates multiple campaigns concurrently
      const campaignPromises = [];
      for (let i = 0; i < users.length; i++) {
        for (let j = 0; j < 5; j++) {
          const promise = testUtils.makeRequest('POST', '/api/campaigns', {
            auth: authTokens[i],
            body: {
              name: `User ${i} Campaign ${j}`,
              description: `Campaign ${j} for user ${i}`
            }
          });
          campaignPromises.push(promise);
        }
      }

      const startTime = Date.now();
      const campaignResponses = await Promise.all(campaignPromises);
      const totalTime = Date.now() - startTime;

      // All campaigns should be created successfully
      campaignResponses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toBeValidApiResponse();
      });

      // Should complete within reasonable time (50 campaigns in < 10 seconds)
      expect(totalTime).toBeLessThan(10000);

      // Verify all campaigns exist in database
      const campaignCount = await prisma.campaign.count();
      expect(campaignCount).toBe(50);

      // Test concurrent reads
      const readPromises = users.map(user => 
        testUtils.makeRequest('GET', '/api/users/dashboard', {
          auth: authTokens[users.indexOf(user)]
        })
      );

      const readStartTime = Date.now();
      const readResponses = await Promise.all(readPromises);
      const readTime = Date.now() - readStartTime;

      readResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toBeValidApiResponse();
        expect(response.body.data.campaigns).toHaveLength(5);
      });

      // Concurrent reads should be fast
      expect(readTime).toBeLessThan(3000);
    });
  });
});
