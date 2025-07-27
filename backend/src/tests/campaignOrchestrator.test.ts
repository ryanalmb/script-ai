/**
 * Campaign Orchestrator Integration Tests
 *
 * Comprehensive test suite for multi-account campaign orchestration
 * Task 19 of 36-stage Twikit Implementation
 *
 * MOVED TO: backend/__tests__/campaignOrchestrator.test.ts
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Redis } from 'ioredis';
import { 
  CampaignOrchestrator,
  CampaignOrchestrationStatus,
  ContentDistributionStrategy,
  CampaignPriority,
  CampaignAccount,
  CampaignContent,
  CampaignSchedule
} from '../services/campaignOrchestrator';
import { ActionRiskLevel } from '../services/proxyRotationManager';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { logger } from '../utils/logger';

// Mock dependencies
jest.mock('../lib/prisma');
jest.mock('../lib/cache');
jest.mock('../utils/logger');

describe('CampaignOrchestrator Integration Tests', () => {
  let orchestrator: CampaignOrchestrator;
  let mockRedis: jest.Mocked<Redis>;
  let testAccounts: CampaignAccount[];
  let testContent: CampaignContent[];
  let testSchedule: CampaignSchedule;

  beforeAll(async () => {
    // Setup mock Redis
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      subscribe: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      publish: jest.fn().mockResolvedValue(1),
      hset: jest.fn().mockResolvedValue(1),
      zadd: jest.fn().mockResolvedValue(1)
    } as any;

    (cacheManager.getClient as jest.Mock).mockReturnValue(mockRedis);

    // Initialize orchestrator
    orchestrator = new CampaignOrchestrator({
      redisClient: mockRedis,
      maxConcurrentCampaigns: 5,
      enableRealTimeMonitoring: true
    });

    await orchestrator.initialize();
  });

  afterAll(async () => {
    await orchestrator.shutdown?.();
  });

  beforeEach(() => {
    // Setup test data
    testAccounts = [
      {
        accountId: 'acc_1',
        username: 'test_user_1',
        role: 'PRIMARY',
        weight: 1.0,
        healthScore: 0.9,
        riskLevel: ActionRiskLevel.LOW,
        lastActivity: new Date(Date.now() - 60000), // 1 minute ago
        isActive: true
      },
      {
        accountId: 'acc_2',
        username: 'test_user_2',
        role: 'AMPLIFIER',
        weight: 0.8,
        healthScore: 0.85,
        riskLevel: ActionRiskLevel.MEDIUM,
        lastActivity: new Date(Date.now() - 120000), // 2 minutes ago
        isActive: true
      },
      {
        accountId: 'acc_3',
        username: 'test_user_3',
        role: 'SUPPORT',
        weight: 0.6,
        healthScore: 0.8,
        riskLevel: ActionRiskLevel.LOW,
        lastActivity: new Date(Date.now() - 300000), // 5 minutes ago
        isActive: true
      }
    ];

    testContent = [
      {
        id: 'content_1',
        type: 'TWEET',
        content: 'Test tweet content 1',
        priority: CampaignPriority.NORMAL,
        variations: ['Test tweet variation 1a', 'Test tweet variation 1b']
      },
      {
        id: 'content_2',
        type: 'TWEET',
        content: 'Test tweet content 2',
        priority: CampaignPriority.HIGH
      },
      {
        id: 'content_3',
        type: 'LIKE',
        content: '',
        targetAccounts: ['target_tweet_1'],
        priority: CampaignPriority.LOW
      }
    ];

    testSchedule = {
      startTime: new Date(Date.now() + 60000), // 1 minute from now
      endTime: new Date(Date.now() + 3600000), // 1 hour from now
      timezone: 'UTC',
      distributionStrategy: ContentDistributionStrategy.ORGANIC_SPREAD,
      intervalBetweenActions: {
        min: 30, // 30 seconds
        max: 300 // 5 minutes
      },
      adaptiveScheduling: true
    };

    // Mock Prisma responses
    (prisma.xAccount.findUnique as jest.Mock).mockImplementation((args) => {
      const accountId = args.where.id;
      return Promise.resolve({
        id: accountId,
        username: `user_${accountId}`,
        isActive: true,
        isSuspended: false
      });
    });

    (prisma.campaign.update as jest.Mock).mockResolvedValue({
      id: 'test_campaign_1',
      name: 'Test Campaign',
      status: 'ACTIVE'
    });

    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Campaign Creation and Validation', () => {
    it('should create a campaign orchestration plan successfully', async () => {
      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_1',
        testAccounts,
        testContent,
        testSchedule,
        {
          name: 'Test Campaign Orchestration',
          description: 'Test campaign for integration testing',
          priority: CampaignPriority.NORMAL,
          createdBy: 'test_user'
        }
      );

      expect(plan).toBeDefined();
      expect(plan.campaignId).toBe('test_campaign_1');
      expect(plan.name).toBe('Test Campaign Orchestration');
      expect(plan.status).toBe(CampaignOrchestrationStatus.PLANNING);
      expect(plan.accounts).toHaveLength(3);
      expect(plan.content).toHaveLength(3);
      expect(plan.antiDetectionConfig.enableBehavioralVariation).toBe(true);
    });

    it('should validate account health and filter unhealthy accounts', async () => {
      // Mock account health check to return poor health for one account
      const mockAccountHealthMonitor = {
        getAccountHealth: jest.fn()
          .mockResolvedValueOnce({ overallScore: 0.9, isSuspended: false })
          .mockResolvedValueOnce({ overallScore: 0.5, isSuspended: false }) // Poor health
          .mockResolvedValueOnce({ overallScore: 0.8, isSuspended: false })
      };

      (orchestrator as any).accountHealthMonitor = mockAccountHealthMonitor;

      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_2',
        testAccounts,
        testContent,
        testSchedule,
        {
          name: 'Test Campaign with Health Filtering',
          createdBy: 'test_user'
        }
      );

      expect(plan.accounts).toHaveLength(2); // One account filtered out
      expect(mockAccountHealthMonitor.getAccountHealth).toHaveBeenCalledTimes(3);
    });

    it('should reject campaign with no healthy accounts', async () => {
      const mockAccountHealthMonitor = {
        getAccountHealth: jest.fn().mockResolvedValue({ overallScore: 0.3, isSuspended: false })
      };

      (orchestrator as any).accountHealthMonitor = mockAccountHealthMonitor;

      await expect(
        orchestrator.createCampaignOrchestration(
          'test_campaign_3',
          testAccounts,
          testContent,
          testSchedule,
          {
            name: 'Test Campaign with No Healthy Accounts',
            createdBy: 'test_user'
          }
        )
      ).rejects.toThrow('No healthy accounts available for campaign execution');
    });

    it('should validate campaign inputs correctly', async () => {
      // Test empty accounts
      await expect(
        orchestrator.createCampaignOrchestration(
          'test_campaign_4',
          [],
          testContent,
          testSchedule,
          {
            name: 'Test Campaign with Empty Accounts',
            createdBy: 'test_user'
          }
        )
      ).rejects.toThrow('No accounts provided for campaign');

      // Test empty content
      await expect(
        orchestrator.createCampaignOrchestration(
          'test_campaign_5',
          testAccounts,
          [],
          testSchedule,
          {
            name: 'Test Campaign with Empty Content',
            createdBy: 'test_user'
          }
        )
      ).rejects.toThrow('No content provided for campaign');

      // Test past start time
      const pastSchedule = {
        ...testSchedule,
        startTime: new Date(Date.now() - 60000) // 1 minute ago
      };

      await expect(
        orchestrator.createCampaignOrchestration(
          'test_campaign_6',
          testAccounts,
          testContent,
          pastSchedule,
          {
            name: 'Test Campaign with Past Start Time',
            createdBy: 'test_user'
          }
        )
      ).rejects.toThrow('Campaign start time must be in the future');
    });
  });

  describe('Content Distribution Strategies', () => {
    it('should optimize sequential distribution correctly', async () => {
      const sequentialSchedule = {
        ...testSchedule,
        distributionStrategy: ContentDistributionStrategy.SEQUENTIAL
      };

      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_sequential',
        testAccounts,
        testContent,
        sequentialSchedule,
        {
          name: 'Sequential Distribution Test',
          createdBy: 'test_user'
        }
      );

      // Verify content is scheduled sequentially
      const scheduledTimes = plan.content
        .map(c => c.scheduledFor?.getTime() || 0)
        .sort((a, b) => a - b);

      for (let i = 1; i < scheduledTimes.length; i++) {
        expect(scheduledTimes[i]).toBeGreaterThan(scheduledTimes[i - 1]);
      }

      // Verify each content item has a target account
      plan.content.forEach(content => {
        expect(content.targetAccounts).toBeDefined();
        expect(content.targetAccounts!.length).toBe(1);
      });
    });

    it('should optimize cascade distribution with role-based ordering', async () => {
      const cascadeSchedule = {
        ...testSchedule,
        distributionStrategy: ContentDistributionStrategy.CASCADE
      };

      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_cascade',
        testAccounts,
        testContent,
        cascadeSchedule,
        {
          name: 'Cascade Distribution Test',
          createdBy: 'test_user'
        }
      );

      // Verify cascade timing (PRIMARY accounts should go first)
      const primaryAccountContent = plan.content.filter(c => 
        c.targetAccounts?.includes('acc_1') // PRIMARY account
      );
      const amplifierAccountContent = plan.content.filter(c => 
        c.targetAccounts?.includes('acc_2') // AMPLIFIER account
      );

      if (primaryAccountContent.length > 0 && amplifierAccountContent.length > 0) {
        const primaryTime = primaryAccountContent[0].scheduledFor?.getTime() || 0;
        const amplifierTime = amplifierAccountContent[0].scheduledFor?.getTime() || 0;
        expect(amplifierTime).toBeGreaterThanOrEqual(primaryTime);
      }
    });

    it('should optimize stealth distribution with maximum spacing', async () => {
      const stealthSchedule = {
        ...testSchedule,
        distributionStrategy: ContentDistributionStrategy.STEALTH
      };

      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_stealth',
        testAccounts,
        testContent,
        stealthSchedule,
        {
          name: 'Stealth Distribution Test',
          createdBy: 'test_user'
        }
      );

      // Verify large gaps between actions (stealth mode)
      const scheduledTimes = plan.content
        .map(c => c.scheduledFor?.getTime() || 0)
        .sort((a, b) => a - b);

      for (let i = 1; i < scheduledTimes.length; i++) {
        const gap = scheduledTimes[i] - scheduledTimes[i - 1];
        expect(gap).toBeGreaterThanOrEqual(60 * 60 * 1000); // At least 1 hour gap
      }
    });
  });

  describe('Campaign Execution and Monitoring', () => {
    it('should start campaign execution successfully', async () => {
      // Create a campaign first
      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_execution',
        testAccounts,
        testContent,
        testSchedule,
        {
          name: 'Execution Test Campaign',
          createdBy: 'test_user'
        }
      );

      // Mock the required methods
      const mockValidateCampaignCanStart = jest.fn().mockResolvedValue(undefined);
      const mockExecutePreparationPhase = jest.fn().mockResolvedValue(undefined);
      const mockExecuteExecutionPhase = jest.fn().mockResolvedValue(undefined);

      (orchestrator as any).validateCampaignCanStart = mockValidateCampaignCanStart;
      (orchestrator as any).executePreparationPhase = mockExecutePreparationPhase;
      (orchestrator as any).executeExecutionPhase = mockExecuteExecutionPhase;

      await orchestrator.startCampaignExecution(plan.id);

      expect(mockValidateCampaignCanStart).toHaveBeenCalledWith(plan);
      expect(mockExecutePreparationPhase).toHaveBeenCalled();
      expect(mockExecuteExecutionPhase).toHaveBeenCalled();

      // Verify campaign is now active
      const status = await orchestrator.getCampaignStatus(plan.id);
      expect(status.status).toBe(CampaignOrchestrationStatus.ACTIVE);
    });

    it('should pause and resume campaigns correctly', async () => {
      // Create and start a campaign
      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_pause_resume',
        testAccounts,
        testContent,
        testSchedule,
        {
          name: 'Pause Resume Test Campaign',
          createdBy: 'test_user'
        }
      );

      // Mock required methods
      (orchestrator as any).validateCampaignCanStart = jest.fn().mockResolvedValue(undefined);
      (orchestrator as any).executePreparationPhase = jest.fn().mockResolvedValue(undefined);
      (orchestrator as any).executeExecutionPhase = jest.fn().mockResolvedValue(undefined);

      await orchestrator.startCampaignExecution(plan.id);

      // Pause the campaign
      await orchestrator.pauseCampaign(plan.id);
      let status = await orchestrator.getCampaignStatus(plan.id);
      expect(status.status).toBe(CampaignOrchestrationStatus.PAUSED);

      // Resume the campaign
      await orchestrator.resumeCampaign(plan.id);
      status = await orchestrator.getCampaignStatus(plan.id);
      expect(status.status).toBe(CampaignOrchestrationStatus.ACTIVE);
    });

    it('should handle emergency stop correctly', async () => {
      // Create and start a campaign
      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_emergency_stop',
        testAccounts,
        testContent,
        testSchedule,
        {
          name: 'Emergency Stop Test Campaign',
          createdBy: 'test_user'
        }
      );

      // Mock required methods
      (orchestrator as any).validateCampaignCanStart = jest.fn().mockResolvedValue(undefined);
      (orchestrator as any).executePreparationPhase = jest.fn().mockResolvedValue(undefined);
      (orchestrator as any).executeExecutionPhase = jest.fn().mockResolvedValue(undefined);

      await orchestrator.startCampaignExecution(plan.id);

      // Trigger emergency stop
      await orchestrator.emergencyStopCampaign(plan.id, {
        reason: 'TEST_EMERGENCY_STOP',
        triggeredBy: 'test'
      });

      const status = await orchestrator.getCampaignStatus(plan.id);
      expect(status.status).toBe(CampaignOrchestrationStatus.FAILED);
    });
  });

  describe('Anti-Detection and Rate Limiting Integration', () => {
    it('should apply anti-detection delays correctly', async () => {
      const calculateDelay = (orchestrator as any).calculateAntiDetectionDelay;
      
      // Test different risk levels
      const lowRiskDelay = calculateDelay(30, 300, ActionRiskLevel.LOW, 'TWEET');
      const highRiskDelay = calculateDelay(30, 300, ActionRiskLevel.HIGH, 'TWEET');
      
      expect(highRiskDelay).toBeGreaterThan(lowRiskDelay);
      
      // Test different action types
      const tweetDelay = calculateDelay(30, 300, ActionRiskLevel.MEDIUM, 'TWEET');
      const followDelay = calculateDelay(30, 300, ActionRiskLevel.MEDIUM, 'FOLLOW');
      
      expect(followDelay).toBeGreaterThan(tweetDelay);
    });

    it('should integrate with rate limiting coordinator', async () => {
      const mockRateLimitCoordinator = {
        checkActionAllowed: jest.fn().mockResolvedValue({
          allowed: true,
          waitTime: 0
        })
      };

      (orchestrator as any).rateLimitCoordinator = mockRateLimitCoordinator;

      // Create a campaign and simulate action execution
      const plan = await orchestrator.createCampaignOrchestration(
        'test_campaign_rate_limiting',
        testAccounts,
        testContent,
        testSchedule,
        {
          name: 'Rate Limiting Test Campaign',
          createdBy: 'test_user'
        }
      );

      // Mock execution context
      const context = {
        orchestrationPlan: plan,
        currentPhase: 'EXECUTION' as const,
        activeActions: new Map(),
        scheduledActions: [],
        metrics: {
          startTime: new Date(),
          actionsCompleted: 0,
          actionsRemaining: testContent.length,
          estimatedCompletion: new Date(),
          currentThroughput: 0
        }
      };

      // Mock other required services
      (orchestrator as any).accountHealthMonitor = {
        getAccountHealth: jest.fn().mockResolvedValue({
          overallScore: 0.9,
          isSuspended: false
        })
      };

      (orchestrator as any).xAutomationService = {
        createTweet: jest.fn().mockResolvedValue({ success: true, tweetId: 'test_tweet_1' })
      };

      // Execute a content action
      await (orchestrator as any).executeContentAction(testContent[0], context);

      expect(mockRateLimitCoordinator.checkActionAllowed).toHaveBeenCalledWith(
        'acc_1',
        'TWEET',
        expect.any(Number)
      );
    });
  });
});
