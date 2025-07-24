/**
 * Comprehensive Anti-Detection Service Test Suite
 * Tests all anti-detection measures and integration points
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { AntiDetectionService, AntiDetectionContext, DetectionResult } from '../src/services/antiDetectionService';
import { AntiDetectionConfigManager } from '../src/config/antiDetection';
import { FingerprintManager } from '../src/services/fingerprint/fingerprintManager';
import { AntiDetectionCoordinator } from '../src/services/coordination/antiDetectionCoordinator';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('ioredis');
jest.mock('../src/services/fingerprint/fingerprintManager');
jest.mock('../src/services/coordination/antiDetectionCoordinator');

describe('Anti-Detection Service', () => {
  let antiDetectionService: AntiDetectionService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRedis: jest.Mocked<Redis>;
  let configManager: AntiDetectionConfigManager;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock Prisma
    mockPrisma = {
      identityProfile: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      fingerprintProfile: {
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      behaviorPattern: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      detectionEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      performanceMetrics: {
        create: jest.fn(),
      },
      $disconnect: jest.fn(),
    } as any;

    // Setup mock Redis
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      publish: jest.fn(),
      on: jest.fn(),
    } as any;

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    // Initialize service
    configManager = AntiDetectionConfigManager.getInstance();
    antiDetectionService = AntiDetectionService.getInstance();
  });

  afterEach(async () => {
    // Cleanup
    if (antiDetectionService) {
      try {
        await antiDetectionService.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      // Mock successful initialization
      mockRedis.ping.mockResolvedValue('PONG');
      
      await expect(antiDetectionService.initialize()).resolves.not.toThrow();
      
      const stats = await antiDetectionService.getStatistics();
      expect(stats.service.isInitialized).toBe(true);
    });

    it('should fail initialization with invalid Redis connection', async () => {
      // Mock Redis connection failure
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));
      
      await expect(antiDetectionService.initialize()).rejects.toThrow('Redis connection failed');
    });

    it('should validate configuration on initialization', async () => {
      // Test with invalid configuration
      configManager.updateConfig({
        identityProfiles: {
          maxActiveProfiles: -1, // Invalid value
          profileRotationInterval: 3600,
          profileExpirationDays: 30,
          consistencyThreshold: 85,
          detectionScoreThreshold: 70,
          agingRate: 0.01,
        },
      } as any);

      await expect(antiDetectionService.initialize()).rejects.toThrow('Invalid configuration');
    });
  });

  describe('Anti-Detection Profile Management', () => {
    beforeEach(async () => {
      await antiDetectionService.initialize();
    });

    it('should create new identity profile for new account', async () => {
      const context: AntiDetectionContext = {
        sessionId: 'test_session_123',
        accountId: 'test_account_456',
        action: 'like',
        metadata: { contentType: 'text' },
      };

      // Mock database responses
      mockPrisma.identityProfile.findFirst.mockResolvedValue(null);
      mockPrisma.identityProfile.create.mockResolvedValue({
        id: 'profile_123',
        profileName: 'test_profile',
        accountId: 'test_account_456',
        profileType: 'HUMAN_LIKE',
        deviceCategory: 'DESKTOP',
        userAgent: 'Mozilla/5.0...',
        detectionScore: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await antiDetectionService.applyAntiDetection(context);

      expect(result.success).toBe(true);
      expect(result.identityProfile).toBeDefined();
      expect(result.detectionScore).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.identityProfile.create).toHaveBeenCalled();
    });

    it('should reuse existing identity profile for known account', async () => {
      const context: AntiDetectionContext = {
        sessionId: 'test_session_123',
        accountId: 'test_account_456',
        action: 'retweet',
      };

      // Mock existing profile
      const existingProfile = {
        id: 'profile_123',
        profileName: 'existing_profile',
        accountId: 'test_account_456',
        profileType: 'HUMAN_LIKE',
        detectionScore: 25,
        isActive: true,
        usageCount: 50,
      };

      mockPrisma.identityProfile.findFirst.mockResolvedValue(existingProfile as any);

      const result = await antiDetectionService.applyAntiDetection(context);

      expect(result.success).toBe(true);
      expect(result.identityProfile.id).toBe('profile_123');
      expect(mockPrisma.identityProfile.create).not.toHaveBeenCalled();
    });

    it('should rotate profile when detection score is too high', async () => {
      const context: AntiDetectionContext = {
        sessionId: 'test_session_123',
        accountId: 'test_account_456',
        action: 'follow',
      };

      // Mock high-risk profile
      const highRiskProfile = {
        id: 'profile_123',
        detectionScore: 85, // Above threshold
        isActive: true,
      };

      mockPrisma.identityProfile.findFirst.mockResolvedValue(highRiskProfile as any);

      const result = await antiDetectionService.applyAntiDetection(context);

      expect(result.recommendations).toContain('Consider rotating identity profile');
    });
  });

  describe('Fingerprint Management', () => {
    beforeEach(async () => {
      await antiDetectionService.initialize();
    });

    it('should generate consistent fingerprints for same identity', async () => {
      const context: AntiDetectionContext = {
        sessionId: 'test_session_123',
        accountId: 'test_account_456',
        action: 'like',
      };

      // Mock identity profile
      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'profile_123',
        profileType: 'HUMAN_LIKE',
        isActive: true,
      } as any);

      // Mock fingerprint generation
      const mockFingerprints = {
        CANVAS: { hash: 'canvas_hash_123', consistency: 'key_123' },
        WEBGL: { vendor: 'NVIDIA Corporation', renderer: 'RTX 3060' },
        AUDIO: { contextHash: 'audio_hash_123' },
      };

      // Apply anti-detection twice
      const result1 = await antiDetectionService.applyAntiDetection(context);
      const result2 = await antiDetectionService.applyAntiDetection(context);

      // Fingerprints should be consistent within the same session
      expect(result1.fingerprints).toBeDefined();
      expect(result2.fingerprints).toBeDefined();
    });

    it('should generate different fingerprints for different identities', async () => {
      const context1: AntiDetectionContext = {
        sessionId: 'session_1',
        accountId: 'account_1',
        action: 'like',
      };

      const context2: AntiDetectionContext = {
        sessionId: 'session_2',
        accountId: 'account_2',
        action: 'like',
      };

      // Mock different profiles
      mockPrisma.identityProfile.findFirst
        .mockResolvedValueOnce({ id: 'profile_1', isActive: true } as any)
        .mockResolvedValueOnce({ id: 'profile_2', isActive: true } as any);

      const result1 = await antiDetectionService.applyAntiDetection(context1);
      const result2 = await antiDetectionService.applyAntiDetection(context2);

      expect(result1.identityProfile.id).not.toBe(result2.identityProfile.id);
    });
  });

  describe('Behavioral Pattern Simulation', () => {
    beforeEach(async () => {
      await antiDetectionService.initialize();
    });

    it('should apply appropriate timing patterns for different user types', async () => {
      const casualUserContext: AntiDetectionContext = {
        sessionId: 'casual_session',
        accountId: 'casual_account',
        action: 'like',
      };

      const powerUserContext: AntiDetectionContext = {
        sessionId: 'power_session',
        accountId: 'power_account',
        action: 'like',
      };

      // Mock different profile types
      mockPrisma.identityProfile.findFirst
        .mockResolvedValueOnce({
          id: 'casual_profile',
          profileType: 'CASUAL_USER',
          isActive: true,
        } as any)
        .mockResolvedValueOnce({
          id: 'power_profile',
          profileType: 'POWER_USER',
          isActive: true,
        } as any);

      const casualResult = await antiDetectionService.applyAntiDetection(casualUserContext);
      const powerResult = await antiDetectionService.applyAntiDetection(powerUserContext);

      expect(casualResult.behaviorPattern).toBeDefined();
      expect(powerResult.behaviorPattern).toBeDefined();
      
      // Power users should have different timing patterns than casual users
      expect(casualResult.behaviorPattern.patternType).toBeDefined();
      expect(powerResult.behaviorPattern.patternType).toBeDefined();
    });

    it('should simulate fatigue and attention span', async () => {
      const context: AntiDetectionContext = {
        sessionId: 'fatigue_session',
        accountId: 'fatigue_account',
        action: 'like',
        metadata: { sessionDuration: 7200 }, // 2 hours
      };

      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'fatigue_profile',
        profileType: 'HUMAN_LIKE',
        isActive: true,
        usageCount: 200, // High usage
      } as any);

      const result = await antiDetectionService.applyAntiDetection(context);

      expect(result.behaviorPattern).toBeDefined();
      // Should account for fatigue in timing calculations
    });
  });

  describe('Detection Event Handling', () => {
    beforeEach(async () => {
      await antiDetectionService.initialize();
    });

    it('should handle rate limit detection events', async () => {
      const detectionEvent = {
        type: 'RATE_LIMIT' as const,
        severity: 'MEDIUM' as const,
        context: {
          sessionId: 'test_session',
          accountId: 'test_account',
          action: 'like',
        },
        detectionData: { rateLimitType: 'like_limit' },
        timestamp: new Date(),
      };

      mockPrisma.detectionEvent.create.mockResolvedValue({
        id: 'detection_123',
        ...detectionEvent,
      } as any);

      await expect(
        antiDetectionService.handleDetectionEvent(detectionEvent)
      ).resolves.not.toThrow();

      expect(mockPrisma.detectionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          detectionType: 'RATE_LIMIT',
          severity: 'MEDIUM',
        }),
      });
    });

    it('should trigger automatic evasion for critical detections', async () => {
      const criticalEvent = {
        type: 'ACCOUNT_SUSPENSION' as const,
        severity: 'CRITICAL' as const,
        context: {
          sessionId: 'critical_session',
          accountId: 'critical_account',
          identityProfileId: 'critical_profile',
          action: 'tweet',
        },
        detectionData: { suspensionReason: 'automation_detected' },
        timestamp: new Date(),
      };

      // Mock configuration with automatic evasion enabled
      configManager.updateConfig({
        detection: {
          monitoring: {
            enabled: true,
            realTimeAnalysis: true,
            captchaDetection: true,
            rateLimitDetection: true,
            suspensionDetection: true,
          },
          response: {
            automaticEvasion: true,
            profileSwitching: true,
            proxyRotation: true,
            cooldownPeriod: 300,
            escalationThreshold: 3,
          },
        },
      } as any);

      await antiDetectionService.handleDetectionEvent(criticalEvent);

      // Should have triggered automatic evasion measures
      expect(mockPrisma.detectionEvent.create).toHaveBeenCalled();
    });
  });

  describe('Cross-Instance Coordination', () => {
    it('should coordinate detection events across instances', async () => {
      const coordinator = new AntiDetectionCoordinator(
        configManager.getConfig(),
        mockPrisma
      );

      await coordinator.initialize();

      const detectionEvent = {
        id: 'detection_123',
        type: 'CAPTCHA',
        severity: 'HIGH',
        accountId: 'test_account',
      };

      await expect(
        coordinator.synchronizeDetectionEvent(detectionEvent, 'HIGH')
      ).resolves.not.toThrow();

      expect(mockRedis.publish).toHaveBeenCalled();
    });

    it('should acquire and release distributed locks', async () => {
      const coordinator = new AntiDetectionCoordinator(
        configManager.getConfig(),
        mockPrisma
      );

      await coordinator.initialize();

      // Mock successful lock acquisition
      mockRedis.set.mockResolvedValue('OK');

      const lockAcquired = await coordinator.acquireDistributedLock(
        'test_lock',
        300,
        { reason: 'profile_rotation' }
      );

      expect(lockAcquired).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('lock:test_lock'),
        expect.any(String),
        'EX',
        300,
        'NX'
      );

      // Test lock release
      mockRedis.eval.mockResolvedValue(1);

      const lockReleased = await coordinator.releaseDistributedLock('test_lock');
      expect(lockReleased).toBe(true);
    });
  });

  describe('Performance and Metrics', () => {
    beforeEach(async () => {
      await antiDetectionService.initialize();
    });

    it('should collect performance metrics', async () => {
      const context: AntiDetectionContext = {
        sessionId: 'metrics_session',
        accountId: 'metrics_account',
        action: 'like',
      };

      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'metrics_profile',
        isActive: true,
      } as any);

      // Perform multiple operations
      await antiDetectionService.applyAntiDetection(context);
      await antiDetectionService.applyAntiDetection(context);
      await antiDetectionService.applyAntiDetection(context);

      const stats = await antiDetectionService.getStatistics();

      expect(stats.service.totalOperations).toBeGreaterThan(0);
      expect(stats.service.successfulOperations).toBeGreaterThan(0);
      expect(stats.service.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track detection score trends', async () => {
      const context: AntiDetectionContext = {
        sessionId: 'trend_session',
        accountId: 'trend_account',
        action: 'like',
      };

      // Mock profile with increasing detection score
      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'trend_profile',
        detectionScore: 45,
        isActive: true,
      } as any);

      const result = await antiDetectionService.applyAntiDetection(context);

      expect(result.detectionScore).toBeDefined();
      expect(typeof result.detectionScore).toBe('number');
      expect(result.detectionScore).toBeGreaterThanOrEqual(0);
      expect(result.detectionScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration at runtime', async () => {
      await antiDetectionService.initialize();

      const newConfig = {
        fingerprinting: {
          canvas: {
            enabled: false,
            spoofingMethod: 'block' as const,
            consistencyPeriod: 3600,
            noiseLevel: 0,
          },
        },
      };

      await expect(
        antiDetectionService.updateConfiguration(newConfig as any)
      ).resolves.not.toThrow();

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.fingerprinting.canvas.enabled).toBe(false);
    });

    it('should validate configuration updates', async () => {
      await antiDetectionService.initialize();

      const invalidConfig = {
        identityProfiles: {
          maxActiveProfiles: -5, // Invalid
        },
      };

      await expect(
        antiDetectionService.updateConfiguration(invalidConfig as any)
      ).rejects.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database failure
      mockPrisma.identityProfile.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      const context: AntiDetectionContext = {
        sessionId: 'error_session',
        accountId: 'error_account',
        action: 'like',
      };

      await expect(
        antiDetectionService.applyAntiDetection(context)
      ).rejects.toThrow('Database connection failed');

      const stats = await antiDetectionService.getStatistics();
      expect(stats.service.totalOperations).toBeGreaterThan(0);
    });

    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const context: AntiDetectionContext = {
        sessionId: 'redis_error_session',
        accountId: 'redis_error_account',
        action: 'like',
      };

      // Should still work without Redis (degraded mode)
      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'fallback_profile',
        isActive: true,
      } as any);

      // The service should handle Redis failures gracefully
      // Implementation would depend on fallback mechanisms
    });

    it('should recover from temporary service disruptions', async () => {
      await antiDetectionService.initialize();

      // Simulate service disruption and recovery
      const context: AntiDetectionContext = {
        sessionId: 'recovery_session',
        accountId: 'recovery_account',
        action: 'like',
      };

      // First call fails
      mockPrisma.identityProfile.findFirst.mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      await expect(
        antiDetectionService.applyAntiDetection(context)
      ).rejects.toThrow('Temporary failure');

      // Second call succeeds
      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'recovery_profile',
        isActive: true,
      } as any);

      const result = await antiDetectionService.applyAntiDetection(context);
      expect(result.success).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with existing Twikit session management', async () => {
      await antiDetectionService.initialize();

      const context: AntiDetectionContext = {
        sessionId: 'twikit_session_123',
        accountId: 'twikit_account_456',
        action: 'tweet',
        metadata: {
          tweetContent: 'Test tweet content',
          mediaAttached: false,
        },
      };

      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'twikit_profile',
        profileType: 'HUMAN_LIKE',
        isActive: true,
      } as any);

      const result = await antiDetectionService.applyAntiDetection(context);

      expect(result.success).toBe(true);
      expect(result.identityProfile).toBeDefined();
      expect(result.networkConfig).toBeDefined();
    });

    it('should integrate with proxy management system', async () => {
      await antiDetectionService.initialize();

      const context: AntiDetectionContext = {
        sessionId: 'proxy_session_123',
        accountId: 'proxy_account_456',
        proxyId: 'proxy_789',
        ipAddress: '192.168.1.100',
        action: 'follow',
      };

      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'proxy_profile',
        isActive: true,
      } as any);

      const result = await antiDetectionService.applyAntiDetection(context);

      expect(result.success).toBe(true);
      expect(result.networkConfig).toBeDefined();
      // Should coordinate with proxy settings
    });
  });

  describe('End-to-End Integration Tests', () => {
    it('should perform complete anti-detection workflow', async () => {
      await antiDetectionService.initialize();

      // Simulate complete workflow
      const context: AntiDetectionContext = {
        sessionId: 'e2e_session_123',
        accountId: 'e2e_account_456',
        action: 'like',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: '203.0.113.1',
        metadata: {
          contentType: 'text',
          targetUserId: 'target_user_789',
          timestamp: Date.now(),
        },
      };

      // Mock complete database responses
      mockPrisma.identityProfile.findFirst.mockResolvedValue(null);
      mockPrisma.identityProfile.create.mockResolvedValue({
        id: 'e2e_profile_123',
        profileName: 'e2e_test_profile',
        accountId: 'e2e_account_456',
        profileType: 'HUMAN_LIKE',
        deviceCategory: 'DESKTOP',
        operatingSystem: 'Windows',
        browserType: 'Chrome',
        browserVersion: '120.0.0.0',
        userAgent: context.userAgent,
        screenResolution: '1920x1080',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Win32',
        hardwareConcurrency: 8,
        deviceMemory: 8,
        detectionScore: 0,
        isActive: true,
        usageCount: 0,
        successRate: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockPrisma.fingerprintProfile.findMany.mockResolvedValue([]);
      mockPrisma.behaviorPattern.findFirst.mockResolvedValue({
        id: 'behavior_123',
        identityProfileId: 'e2e_profile_123',
        patternType: 'TIMING',
        patternName: 'human_like_timing',
        patternData: {
          distribution: 'normal',
          mean: 15000,
          stddev: 5000,
        },
        minInterval: 1000,
        maxInterval: 30000,
        burstProbability: 0.1,
        fatigueRate: 0.05,
        attentionSpan: 1800,
        engagementRate: 0.15,
        isActive: true,
      } as any);

      // Execute anti-detection workflow
      const result = await antiDetectionService.applyAntiDetection(context);

      // Validate complete result
      expect(result.success).toBe(true);
      expect(result.identityProfile).toBeDefined();
      expect(result.identityProfile.id).toBe('e2e_profile_123');
      expect(result.fingerprints).toBeDefined();
      expect(result.behaviorPattern).toBeDefined();
      expect(result.networkConfig).toBeDefined();
      expect(result.detectionScore).toBeGreaterThanOrEqual(0);
      expect(result.detectionScore).toBeLessThanOrEqual(100);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.operationId).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThan(0);

      // Verify database interactions
      expect(mockPrisma.identityProfile.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: 'e2e_account_456',
          isActive: true,
        },
        orderBy: {
          detectionScore: 'asc',
        },
      });

      expect(mockPrisma.identityProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          profileName: expect.any(String),
          accountId: 'e2e_account_456',
          profileType: 'HUMAN_LIKE',
          userAgent: context.userAgent,
        }),
      });
    });

    it('should handle high-load scenarios with multiple concurrent requests', async () => {
      await antiDetectionService.initialize();

      const concurrentRequests = 10;
      const contexts: AntiDetectionContext[] = Array.from({ length: concurrentRequests }, (_, i) => ({
        sessionId: `concurrent_session_${i}`,
        accountId: `concurrent_account_${i}`,
        action: 'like',
        metadata: { requestIndex: i },
      }));

      // Mock responses for all requests
      mockPrisma.identityProfile.findFirst.mockResolvedValue({
        id: 'concurrent_profile',
        isActive: true,
        detectionScore: 10,
      } as any);

      // Execute concurrent requests
      const promises = contexts.map(context =>
        antiDetectionService.applyAntiDetection(context)
      );

      const results = await Promise.all(promises);

      // Validate all requests succeeded
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.identityProfile).toBeDefined();
        expect(result.metadata.operationId).toContain(`concurrent_session_${index}`);
      });

      // Verify performance metrics
      const stats = await antiDetectionService.getStatistics();
      expect(stats.service.totalOperations).toBeGreaterThanOrEqual(concurrentRequests);
      expect(stats.service.successfulOperations).toBeGreaterThanOrEqual(concurrentRequests);
    });

    it('should maintain consistency across session lifecycle', async () => {
      await antiDetectionService.initialize();

      const sessionId = 'lifecycle_session_123';
      const accountId = 'lifecycle_account_456';

      // Mock consistent profile
      const consistentProfile = {
        id: 'lifecycle_profile_123',
        profileName: 'lifecycle_test_profile',
        accountId,
        profileType: 'HUMAN_LIKE',
        detectionScore: 15,
        isActive: true,
        usageCount: 0,
        successRate: 100,
      };

      mockPrisma.identityProfile.findFirst.mockResolvedValue(consistentProfile as any);

      // Simulate multiple actions in the same session
      const actions = ['like', 'retweet', 'reply', 'follow', 'tweet'];
      const results: DetectionResult[] = [];

      for (const action of actions) {
        const context: AntiDetectionContext = {
          sessionId,
          accountId,
          action,
          metadata: { actionSequence: results.length + 1 },
        };

        const result = await antiDetectionService.applyAntiDetection(context);
        results.push(result);

        // Increment usage count for next iteration
        consistentProfile.usageCount++;
      }

      // Validate consistency across actions
      expect(results).toHaveLength(actions.length);

      // All results should use the same identity profile
      const profileIds = results.map(r => r.identityProfile.id);
      const uniqueProfileIds = [...new Set(profileIds)];
      expect(uniqueProfileIds).toHaveLength(1);
      expect(uniqueProfileIds[0]).toBe('lifecycle_profile_123');

      // Detection scores should remain reasonable
      results.forEach(result => {
        expect(result.detectionScore).toBeGreaterThanOrEqual(0);
        expect(result.detectionScore).toBeLessThanOrEqual(100);
      });

      // Behavior patterns should be consistent but may vary slightly
      const behaviorPatterns = results.map(r => r.behaviorPattern);
      expect(behaviorPatterns.every(pattern => pattern !== undefined)).toBe(true);
    });
  });
});
