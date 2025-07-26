/**
 * Account Health Monitor Service Tests - Task 15
 * 
 * Comprehensive test suite for the AccountHealthMonitor service
 * Tests health monitoring, risk detection, and preventive measures
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { AccountHealthMonitor, HealthMetrics, SuspensionRiskFactors, PreventiveMeasure } from '../services/accountHealthMonitor';
import { TwikitSessionManager } from '../services/twikitSessionManager';
import { EnterpriseAntiDetectionManager } from '../services/enterpriseAntiDetectionManager';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

// Mock dependencies
jest.mock('../lib/prisma');
jest.mock('../lib/cache');
jest.mock('../utils/logger');

describe('AccountHealthMonitor', () => {
  let healthMonitor: AccountHealthMonitor;
  let mockSessionManager: jest.Mocked<TwikitSessionManager>;
  let mockAntiDetectionManager: jest.Mocked<EnterpriseAntiDetectionManager>;
  let mockBehavioralEngine: any;

  beforeAll(async () => {
    // Setup mock dependencies
    mockSessionManager = {
      on: jest.fn(),
      emit: jest.fn(),
      getSessionMetrics: jest.fn(),
      adjustDelays: jest.fn(),
      pauseSession: jest.fn(),
      emergencyStop: jest.fn()
    } as any;

    mockAntiDetectionManager = {
      on: jest.fn(),
      emit: jest.fn(),
      calculatePerformanceMetrics: jest.fn(),
      rotateProxy: jest.fn()
    } as any;

    mockBehavioralEngine = {
      on: jest.fn(),
      get_performance_report: jest.fn(),
      adjustBehavior: jest.fn()
    };

    // Mock database responses
    (prisma.accountHealthStatus.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.accountHealthStatus.upsert as jest.Mock).mockResolvedValue({});
    (prisma.twikitAccount.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-account',
      createdAt: new Date(Date.now() - 86400000 * 30), // 30 days old
      isVerified: false
    });
    (prisma.antiDetectionAuditLog.create as jest.Mock).mockResolvedValue({});

    // Mock cache responses
    (cacheManager.get as jest.Mock).mockResolvedValue(null);
    (cacheManager.set as jest.Mock).mockResolvedValue(true);

    // Initialize health monitor
    healthMonitor = new AccountHealthMonitor(
      mockSessionManager,
      mockAntiDetectionManager,
      mockBehavioralEngine
    );

    await healthMonitor.initialize();
  });

  afterAll(async () => {
    await healthMonitor.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(healthMonitor).toBeDefined();
      expect(mockSessionManager.on).toHaveBeenCalledWith('sessionCreated', expect.any(Function));
      expect(mockSessionManager.on).toHaveBeenCalledWith('sessionTerminated', expect.any(Function));
      expect(mockSessionManager.on).toHaveBeenCalledWith('sessionError', expect.any(Function));
    });

    test('should setup service integrations', () => {
      expect(mockAntiDetectionManager.on).toHaveBeenCalledWith('detectionEvent', expect.any(Function));
      expect(mockAntiDetectionManager.on).toHaveBeenCalledWith('riskLevelChanged', expect.any(Function));
    });

    test('should load existing health profiles from database', async () => {
      expect(prisma.accountHealthStatus.findMany).toHaveBeenCalled();
    });
  });

  describe('Account Health Monitoring', () => {
    test('should add account to monitoring', async () => {
      const accountId = 'test-account-123';
      
      await healthMonitor.addAccountToMonitoring(accountId);
      
      // Verify account was added
      const dashboard = await healthMonitor.getHealthDashboard();
      expect(dashboard.summary.totalAccounts).toBeGreaterThan(0);
      
      // Verify database persistence
      expect(prisma.accountHealthStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId },
          update: expect.any(Object),
          create: expect.any(Object)
        })
      );
    });

    test('should perform comprehensive health assessment', async () => {
      const accountId = 'test-account-456';
      
      // Setup mock responses
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        successRate: 0.95,
        totalRequests: 100,
        failedRequests: 5,
        authenticationAttempts: 2,
        engagementRate: 0.08,
        proxyMetrics: {
          averageResponseTime: 1500,
          successRate: 0.98,
          ipReputationScore: 0.8
        }
      });

      mockAntiDetectionManager.calculatePerformanceMetrics.mockResolvedValue({
        detectionAvoidanceRate: 0.92,
        detectionEvents: [],
        detectionRisk: 0.15
      });

      mockBehavioralEngine.get_performance_report.mockResolvedValue({
        behavioral_consistency_score: 0.88,
        human_like_classification: 0.91,
        usage_count: 10
      });

      // Add account and perform assessment
      await healthMonitor.addAccountToMonitoring(accountId);
      const healthMetrics = await healthMonitor.performHealthAssessment(accountId);

      // Validate health metrics
      expect(healthMetrics).toBeDefined();
      expect(healthMetrics.overallHealthScore).toBeGreaterThan(0);
      expect(healthMetrics.overallHealthScore).toBeLessThanOrEqual(100);
      expect(healthMetrics.suspensionRiskScore).toBeGreaterThanOrEqual(0);
      expect(healthMetrics.suspensionRiskScore).toBeLessThanOrEqual(100);
      expect(healthMetrics.authenticationSuccessRate).toBeGreaterThan(90);
      expect(healthMetrics.behavioralConsistency).toBeGreaterThan(80);
    });

    test('should calculate realistic health scores', async () => {
      const accountId = 'test-account-789';
      
      // Setup mock responses with poor metrics
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        successRate: 0.60, // Poor success rate
        totalRequests: 100,
        failedRequests: 40,
        authenticationAttempts: 8, // Many auth attempts
        rateLimitHits: 5, // Frequent rate limit hits
        engagementRate: 0.5, // Unrealistic engagement rate
        errorCount: 15
      });

      mockAntiDetectionManager.calculatePerformanceMetrics.mockResolvedValue({
        detectionAvoidanceRate: 0.70,
        detectionEvents: [
          { timestamp: new Date(), detectionType: 'CAPTCHA' },
          { timestamp: new Date(), detectionType: 'RATE_LIMIT' }
        ],
        detectionRisk: 0.8
      });

      mockBehavioralEngine.get_performance_report.mockResolvedValue({
        behavioral_consistency_score: 0.45, // Poor consistency
        human_like_classification: 0.55,
        usage_count: 3
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      const healthMetrics = await healthMonitor.performHealthAssessment(accountId);

      // Should have low health scores due to poor metrics
      expect(healthMetrics.overallHealthScore).toBeLessThan(70);
      expect(healthMetrics.suspensionRiskScore).toBeGreaterThan(30);
      expect(healthMetrics.authenticationSuccessRate).toBeLessThan(80);
      expect(healthMetrics.rateLimitCompliance).toBeLessThan(80);
    });
  });

  describe('Risk Detection and Assessment', () => {
    test('should detect high suspension risk', async () => {
      const accountId = 'test-high-risk-account';
      
      // Setup high-risk scenario
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        successRate: 0.50,
        authFailures: 5,
        rateLimitHits: 8,
        activitySpike: true,
        policyViolations: 2,
        ipReputationScore: 0.3
      });

      mockAntiDetectionManager.calculatePerformanceMetrics.mockResolvedValue({
        detectionAvoidanceRate: 0.60,
        detectionRisk: 0.9,
        detectionEvents: [
          { timestamp: new Date(), detectionType: 'ACCOUNT_SUSPENSION' }
        ]
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      const healthMetrics = await healthMonitor.performHealthAssessment(accountId);

      // Should detect high risk
      expect(healthMetrics.suspensionRiskScore).toBeGreaterThan(70);
      expect(healthMetrics.overallHealthScore).toBeLessThan(50);
    });

    test('should identify specific risk factors', async () => {
      const accountId = 'test-risk-factors-account';
      
      // Setup specific risk factors
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        authFailures: 3, // Authentication failures
        rateLimitHits: 6, // Frequent rate limits
        engagementRate: 0.8, // Unusual engagement
        activitySpike: true // Rapid activity increase
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      await healthMonitor.performHealthAssessment(accountId);

      const dashboard = await healthMonitor.getHealthDashboard();
      const account = dashboard.accounts.find(a => a.accountId === accountId);
      
      expect(account).toBeDefined();
      expect(account!.riskScore).toBeGreaterThan(50);
    });
  });

  describe('Preventive Measures System', () => {
    test('should trigger preventive measures based on risk thresholds', async () => {
      const accountId = 'test-preventive-measures';
      
      // Setup scenario that should trigger throttling
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        successRate: 0.40, // Very poor success rate
        rateLimitHits: 10,
        authFailures: 6
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      await healthMonitor.performHealthAssessment(accountId);

      // Should have triggered preventive measures
      expect(mockSessionManager.adjustDelays).toHaveBeenCalled();
    });

    test('should escalate preventive measures appropriately', async () => {
      const accountId = 'test-escalation';
      
      // Setup critical risk scenario
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        successRate: 0.20, // Critical success rate
        authFailures: 10,
        rateLimitHits: 15,
        policyViolations: 3
      });

      mockAntiDetectionManager.calculatePerformanceMetrics.mockResolvedValue({
        detectionRisk: 0.95 // Very high detection risk
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      await healthMonitor.performHealthAssessment(accountId);

      // Should trigger emergency stop
      expect(mockSessionManager.emergencyStop).toHaveBeenCalledWith(accountId);
    });

    test('should execute different types of preventive measures', async () => {
      const accountId = 'test-measure-types';
      
      // Test delay increase measure
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        rateLimitHits: 4 // Moderate risk
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      await healthMonitor.performHealthAssessment(accountId);

      expect(mockSessionManager.adjustDelays).toHaveBeenCalledWith(
        accountId,
        expect.objectContaining({
          delayMultiplier: expect.any(Number)
        })
      );
    });
  });

  describe('Alert Management', () => {
    test('should create alerts for health degradation', async () => {
      const accountId = 'test-alerts';
      
      // Setup scenario that should trigger alerts
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        successRate: 0.45 // Below critical threshold
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      await healthMonitor.performHealthAssessment(accountId);

      // Should have created alert in database
      expect(prisma.antiDetectionAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: expect.stringContaining('HEALTH_ALERT')
          })
        })
      );
    });

    test('should provide recommended actions in alerts', async () => {
      const accountId = 'test-recommendations';
      
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        authFailures: 5,
        rateLimitHits: 8
      });

      await healthMonitor.addAccountToMonitoring(accountId);
      await healthMonitor.performHealthAssessment(accountId);

      // Verify alert was created with recommendations
      const createCall = (prisma.antiDetectionAuditLog.create as jest.Mock).mock.calls.find(
        call => call[0].data.action.includes('HEALTH_ALERT')
      );
      
      expect(createCall).toBeDefined();
      expect(createCall[0].data.details.recommendedActions).toContain('Check authentication credentials');
    });
  });

  describe('Performance and Integration', () => {
    test('should maintain low latency for health checks', async () => {
      const accountId = 'test-performance';
      
      const startTime = Date.now();
      await healthMonitor.addAccountToMonitoring(accountId);
      await healthMonitor.performHealthAssessment(accountId);
      const endTime = Date.now();
      
      const latency = endTime - startTime;
      expect(latency).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle service integration failures gracefully', async () => {
      const accountId = 'test-integration-failure';
      
      // Mock service failures
      mockSessionManager.getSessionMetrics.mockRejectedValue(new Error('Service unavailable'));
      mockAntiDetectionManager.calculatePerformanceMetrics.mockRejectedValue(new Error('Service error'));
      
      await healthMonitor.addAccountToMonitoring(accountId);
      
      // Should not throw error and should provide fallback assessment
      await expect(healthMonitor.performHealthAssessment(accountId)).resolves.toBeDefined();
    });

    test('should provide comprehensive health dashboard', async () => {
      const dashboard = await healthMonitor.getHealthDashboard();
      
      expect(dashboard).toHaveProperty('summary');
      expect(dashboard).toHaveProperty('accounts');
      expect(dashboard).toHaveProperty('systemMetrics');
      
      expect(dashboard.summary).toHaveProperty('totalAccounts');
      expect(dashboard.summary).toHaveProperty('healthyAccounts');
      expect(dashboard.summary).toHaveProperty('warningAccounts');
      expect(dashboard.summary).toHaveProperty('criticalAccounts');
      expect(dashboard.summary).toHaveProperty('averageHealthScore');
      expect(dashboard.summary).toHaveProperty('averageRiskScore');
      
      expect(dashboard.systemMetrics).toHaveProperty('totalHealthChecks');
      expect(dashboard.systemMetrics).toHaveProperty('averageCheckLatency');
    });
  });

  describe('Data Persistence and Caching', () => {
    test('should persist health profiles to database', async () => {
      const accountId = 'test-persistence';
      
      await healthMonitor.addAccountToMonitoring(accountId);
      
      expect(prisma.accountHealthStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId },
          update: expect.objectContaining({
            status: expect.any(String),
            healthMetrics: expect.any(String),
            riskAssessment: expect.any(String)
          }),
          create: expect.objectContaining({
            accountId,
            status: expect.any(String),
            healthMetrics: expect.any(String),
            riskAssessment: expect.any(String)
          })
        })
      );
    });

    test('should cache health profiles for performance', async () => {
      const accountId = 'test-caching';
      
      await healthMonitor.addAccountToMonitoring(accountId);
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('account_health:profiles'),
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('Event Handling', () => {
    test('should handle session events from TwikitSessionManager', async () => {
      const accountId = 'test-session-events';
      await healthMonitor.addAccountToMonitoring(accountId);
      
      // Simulate session error event
      const sessionErrorHandler = mockSessionManager.on.mock.calls.find(
        call => call[0] === 'sessionError'
      )?.[1];
      
      expect(sessionErrorHandler).toBeDefined();
      
      // Should not throw when handling event
      await expect(sessionErrorHandler({ accountId, error: 'Test error' })).resolves.toBeUndefined();
    });

    test('should handle detection events from EnterpriseAntiDetectionManager', async () => {
      const accountId = 'test-detection-events';
      await healthMonitor.addAccountToMonitoring(accountId);
      
      // Simulate detection event
      const detectionEventHandler = mockAntiDetectionManager.on.mock.calls.find(
        call => call[0] === 'detectionEvent'
      )?.[1];
      
      expect(detectionEventHandler).toBeDefined();
      
      // Should handle detection event and trigger assessment
      await detectionEventHandler({
        accountId,
        detectionType: 'CAPTCHA',
        severity: 'high'
      });
      
      // Should have triggered health assessment
      expect(mockSessionManager.getSessionMetrics).toHaveBeenCalled();
    });
  });
});
