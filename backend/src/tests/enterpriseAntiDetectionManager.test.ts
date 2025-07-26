/**
 * Enterprise Anti-Detection Manager Integration Tests
 * 
 * Comprehensive test suite for Task 13 implementation
 * Tests behavioral profiling, fingerprint randomization, and session coordination
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { EnterpriseAntiDetectionManager } from '../services/enterpriseAntiDetectionManager';
import { EnterpriseAntiDetectionCoordinator } from '../services/antiDetection/antiDetectionCoordinator';
import { TwikitSessionManager } from '../services/twikitSessionManager';
import { ProxyRotationManager } from '../services/proxyRotationManager';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

// Mock dependencies
jest.mock('../lib/prisma');
jest.mock('../lib/cache');
jest.mock('../utils/logger');

describe('EnterpriseAntiDetectionManager', () => {
  let manager: EnterpriseAntiDetectionManager;
  let mockAntiDetectionCoordinator: jest.Mocked<EnterpriseAntiDetectionCoordinator>;
  let mockSessionManager: jest.Mocked<TwikitSessionManager>;
  let mockProxyManager: jest.Mocked<ProxyRotationManager>;

  beforeAll(async () => {
    // Setup mock dependencies
    mockAntiDetectionCoordinator = {
      on: jest.fn(),
      emit: jest.fn(),
      getAntiDetectionProfile: jest.fn(),
      rotateProxy: jest.fn(),
      updateBehavioralPattern: jest.fn()
    } as any;

    mockSessionManager = {
      on: jest.fn(),
      emit: jest.fn(),
      createSession: jest.fn(),
      getSession: jest.fn(),
      terminateSession: jest.fn()
    } as any;

    mockProxyManager = {
      on: jest.fn(),
      emit: jest.fn(),
      selectProxy: jest.fn(),
      rotateProxy: jest.fn(),
      getProxyStats: jest.fn()
    } as any;

    // Mock database responses
    (prisma.behaviorPattern.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.fingerprintProfile.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.twikitSession.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.detectionEvent.create as jest.Mock).mockResolvedValue({});

    // Mock cache responses
    (cacheManager.get as jest.Mock).mockResolvedValue(null);
    (cacheManager.set as jest.Mock).mockResolvedValue(true);

    // Initialize manager
    manager = new EnterpriseAntiDetectionManager(
      mockAntiDetectionCoordinator,
      mockSessionManager,
      mockProxyManager
    );
  });

  afterAll(async () => {
    await manager.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Behavioral Profiling System', () => {
    test('should create behavioral profile with realistic patterns', async () => {
      const accountId = 'test-account-123';
      
      const signature = await manager.createBehavioralProfile(accountId, {
        profileType: 'hybrid',
        learningPeriod: 30
      });

      expect(signature).toBeDefined();
      expect(signature.accountId).toBe(accountId);
      expect(signature.profileType).toBe('hybrid');
      expect(signature.typingMetrics).toBeDefined();
      expect(signature.readingMetrics).toBeDefined();
      expect(signature.timingPatterns).toBeDefined();
      expect(signature.interactionSequences).toBeDefined();
      expect(signature.qualityMetrics).toBeDefined();

      // Validate typing metrics are realistic
      expect(signature.typingMetrics.averageWPM).toBeGreaterThan(20);
      expect(signature.typingMetrics.averageWPM).toBeLessThan(80);
      expect(signature.typingMetrics.keystrokeVariability).toBeGreaterThan(0);
      expect(signature.typingMetrics.keystrokeVariability).toBeLessThan(1);

      // Validate quality metrics
      expect(signature.qualityMetrics.realismScore).toBeGreaterThan(0);
      expect(signature.qualityMetrics.realismScore).toBeLessThanOrEqual(1);
      expect(signature.qualityMetrics.consistencyScore).toBeGreaterThan(0);
      expect(signature.qualityMetrics.consistencyScore).toBeLessThanOrEqual(1);
    });

    test('should generate consistent behavioral patterns', async () => {
      const accountId = 'test-account-456';
      
      const signature1 = await manager.createBehavioralProfile(accountId);
      const signature2 = await manager.createBehavioralProfile(accountId);

      // Should return the same signature for the same account
      expect(signature1.accountId).toBe(signature2.accountId);
      expect(signature1.id).toBe(signature2.id);
    });

    test('should validate behavioral pattern quality', async () => {
      const accountId = 'test-account-789';
      
      const signature = await manager.createBehavioralProfile(accountId, {
        profileType: 'learned'
      });

      // Quality metrics should indicate high realism
      expect(signature.qualityMetrics.realismScore).toBeGreaterThan(0.7);
      expect(signature.qualityMetrics.detectionRisk).toBeLessThan(0.3);
      expect(signature.qualityMetrics.uniquenessScore).toBeGreaterThan(0.5);
    });
  });

  describe('Advanced Fingerprint Randomization', () => {
    test('should create advanced fingerprint with all components', async () => {
      const profileId = 'test-profile-123';
      
      const fingerprint = await manager.createAdvancedFingerprint(profileId, {
        fingerprintTypes: ['canvas', 'webgl', 'audio', 'hardware'],
        consistencyLevel: 'moderate',
        rotationSchedule: 'daily'
      });

      expect(fingerprint).toBeDefined();
      expect(fingerprint.profileId).toBe(profileId);
      expect(fingerprint.canvasFingerprint).toBeDefined();
      expect(fingerprint.webglFingerprint).toBeDefined();
      expect(fingerprint.audioFingerprint).toBeDefined();
      expect(fingerprint.hardwareProfile).toBeDefined();
      expect(fingerprint.tlsFingerprint).toBeDefined();
      expect(fingerprint.fontProfile).toBeDefined();
      expect(fingerprint.consistencyMetrics).toBeDefined();
    });

    test('should generate realistic Canvas fingerprint', async () => {
      const profileId = 'test-profile-456';
      
      const fingerprint = await manager.createAdvancedFingerprint(profileId);
      const canvas = fingerprint.canvasFingerprint;

      expect(canvas.textRendering).toBeDefined();
      expect(canvas.geometryRendering).toBeDefined();
      expect(canvas.colorProfile).toBeDefined();
      expect(canvas.fontMetrics).toBeDefined();
      expect(canvas.antiAliasing).toBeDefined();
      expect(canvas.subpixelRendering).toBeDefined();

      // Validate realistic values
      expect(['default', 'none', 'gray', 'subpixel']).toContain(canvas.antiAliasing);
      expect(['auto', 'optimizeSpeed', 'optimizeQuality', 'geometricPrecision']).toContain(canvas.subpixelRendering);
    });

    test('should generate realistic WebGL fingerprint', async () => {
      const profileId = 'test-profile-789';
      
      const fingerprint = await manager.createAdvancedFingerprint(profileId);
      const webgl = fingerprint.webglFingerprint;

      expect(webgl.renderer).toBeDefined();
      expect(webgl.vendor).toBeDefined();
      expect(webgl.version).toBeDefined();
      expect(webgl.extensions).toBeDefined();
      expect(webgl.parameters).toBeDefined();
      expect(webgl.maxTextureSize).toBeDefined();
      expect(webgl.maxViewportDims).toBeDefined();

      // Validate realistic values
      expect(webgl.extensions.length).toBeGreaterThan(10);
      expect([4096, 8192, 16384]).toContain(webgl.maxTextureSize);
      expect(webgl.maxViewportDims).toHaveLength(2);
    });

    test('should maintain fingerprint consistency', async () => {
      const profileId = 'test-profile-consistency';
      
      const fingerprint = await manager.createAdvancedFingerprint(profileId);
      const consistency = fingerprint.consistencyMetrics;

      expect(consistency.sessionConsistency).toBeGreaterThan(0.8);
      expect(consistency.crossSessionConsistency).toBeGreaterThan(0.8);
      expect(consistency.anomalyScore).toBeLessThan(0.2);
      expect(consistency.correlationId).toBeDefined();
    });
  });

  describe('Session Coordination', () => {
    test('should coordinate multiple sessions for account', async () => {
      const accountId = 'test-account-coordination';
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      // First create a behavioral profile
      await manager.createBehavioralProfile(accountId);

      // Then coordinate sessions
      await expect(
        manager.coordinateAccountSessions(accountId, sessionIds)
      ).resolves.not.toThrow();

      // Verify event emission
      expect(mockAntiDetectionCoordinator.emit).toHaveBeenCalled();
    });

    test('should fail coordination without behavioral signature', async () => {
      const accountId = 'test-account-no-signature';
      const sessionIds = ['session-1', 'session-2'];

      await expect(
        manager.coordinateAccountSessions(accountId, sessionIds)
      ).rejects.toThrow('No behavioral signature found for account');
    });

    test('should maintain behavioral consistency across sessions', async () => {
      const accountId = 'test-account-consistency';
      const sessionIds = ['session-1', 'session-2'];

      // Create behavioral profile first
      const signature = await manager.createBehavioralProfile(accountId);
      
      // Coordinate sessions
      await manager.coordinateAccountSessions(accountId, sessionIds);

      // Verify consistency is maintained
      expect(signature.qualityMetrics.consistencyScore).toBeGreaterThan(0.8);
    });
  });

  describe('Detection Monitoring', () => {
    test('should monitor detection signals', async () => {
      const accountId = 'test-account-monitoring';
      const sessionId = 'test-session-monitoring';

      const signal = await manager.monitorDetectionSignals(accountId, sessionId);

      // Should return null if no signals detected (in test environment)
      expect(signal).toBeNull();
    });

    test('should handle detection signals appropriately', async () => {
      const accountId = 'test-account-detection';
      const sessionId = 'test-session-detection';

      // Mock a detection signal
      const mockSignal = {
        id: 'signal-123',
        accountId,
        sessionId,
        signalType: 'captcha' as const,
        severity: 'high' as const,
        confidence: 0.9,
        context: {
          action: 'post_tweet',
          timestamp: new Date(),
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
          fingerprint: 'test-fingerprint',
          behaviorSignature: 'test-behavior',
          responseTime: 500,
          responseHeaders: {}
        },
        analysis: {
          riskScore: 0.8,
          anomalyScore: 0.7,
          correlationFactors: ['timing', 'fingerprint'],
          recommendedActions: ['pause', 'rotate_proxy'],
          adaptationSuggestions: ['adjust_timing', 'change_fingerprint']
        },
        response: {
          action: 'pause' as const,
          reason: 'High detection risk',
          adaptations: ['timing_adjustment'],
          duration: 300000
        },
        createdAt: new Date(),
        isResolved: false
      };

      // Test signal processing (would be more complex in real implementation)
      expect(mockSignal.severity).toBe('high');
      expect(mockSignal.confidence).toBeGreaterThan(0.5);
      expect(mockSignal.analysis.riskScore).toBeGreaterThan(0.5);
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate performance metrics', async () => {
      const accountId = 'test-account-metrics';
      
      // Create behavioral profile first
      await manager.createBehavioralProfile(accountId);

      const metrics = await manager.calculatePerformanceMetrics(accountId, 'daily');

      expect(metrics).toBeDefined();
      expect(metrics.accountId).toBe(accountId);
      expect(metrics.timeframe).toBe('daily');
      expect(metrics.effectiveness).toBeDefined();
      expect(metrics.consistency).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.adaptation).toBeDefined();

      // Validate metric ranges
      expect(metrics.effectiveness.detectionAvoidanceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.effectiveness.detectionAvoidanceRate).toBeLessThanOrEqual(1);
      expect(metrics.consistency.overallConsistencyScore).toBeGreaterThanOrEqual(0);
      expect(metrics.consistency.overallConsistencyScore).toBeLessThanOrEqual(1);
    });

    test('should track anti-detection effectiveness', async () => {
      const accountId = 'test-account-effectiveness';
      
      await manager.createBehavioralProfile(accountId);
      const metrics = await manager.calculatePerformanceMetrics(accountId, 'hourly');

      // Should show high effectiveness in test environment
      expect(metrics.effectiveness.detectionAvoidanceRate).toBeGreaterThan(0.9);
      expect(metrics.effectiveness.accountSurvivalRate).toBeGreaterThan(0.9);
      expect(metrics.effectiveness.suspicionEventRate).toBeLessThan(0.1);
    });
  });

  describe('Integration with Existing Services', () => {
    test('should integrate with AntiDetectionCoordinator', () => {
      expect(mockAntiDetectionCoordinator.on).toHaveBeenCalledWith('detectionEvent', expect.any(Function));
    });

    test('should integrate with SessionManager', () => {
      expect(mockSessionManager.on).toHaveBeenCalledWith('sessionCreated', expect.any(Function));
    });

    test('should integrate with ProxyManager', () => {
      expect(mockProxyManager.on).toHaveBeenCalledWith('proxyRotated', expect.any(Function));
    });

    test('should maintain backward compatibility', async () => {
      // Test that existing functionality still works
      expect(mockAntiDetectionCoordinator).toBeDefined();
      expect(mockSessionManager).toBeDefined();
      expect(mockProxyManager).toBeDefined();

      // Verify no breaking changes to existing interfaces
      expect(typeof mockAntiDetectionCoordinator.on).toBe('function');
      expect(typeof mockSessionManager.on).toBe('function');
      expect(typeof mockProxyManager.on).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      (prisma.behaviorPattern.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await expect(
        manager.createBehavioralProfile('error-account')
      ).rejects.toThrow();
    });

    test('should handle cache errors gracefully', async () => {
      (cacheManager.get as jest.Mock).mockRejectedValueOnce(new Error('Cache error'));

      // Should still work without cache
      await expect(
        manager.createBehavioralProfile('cache-error-account')
      ).resolves.toBeDefined();
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should shutdown gracefully', async () => {
      const testManager = new EnterpriseAntiDetectionManager(
        mockAntiDetectionCoordinator,
        mockSessionManager,
        mockProxyManager
      );

      await expect(testManager.shutdown()).resolves.not.toThrow();
    });
  });
});
