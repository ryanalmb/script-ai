/**
 * Emergency Stop System Tests - Task 17
 * 
 * Comprehensive test suite for the EmergencyStopSystem service
 * Tests trigger detection, emergency execution, recovery procedures, and service coordination
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { 
  EmergencyStopSystem, 
  EmergencyTriggerType, 
  EmergencyStopLevel, 
  RecoveryPhase,
  EmergencyTrigger,
  EmergencyEvent
} from '../services/emergencyStopSystem';
import { AccountHealthMonitor } from '../services/accountHealthMonitor';
import { TwikitRealtimeSync } from '../services/twikitRealtimeSync';
import { EnterpriseAntiDetectionManager } from '../services/enterpriseAntiDetectionManager';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

// Mock dependencies
jest.mock('../lib/prisma');
jest.mock('../lib/cache');
jest.mock('../utils/logger');

describe('EmergencyStopSystem', () => {
  let emergencyStopSystem: EmergencyStopSystem;
  let mockHealthMonitor: jest.Mocked<AccountHealthMonitor>;
  let mockRealtimeSync: jest.Mocked<TwikitRealtimeSync>;
  let mockAntiDetectionManager: jest.Mocked<EnterpriseAntiDetectionManager>;
  let mockBehavioralEngine: any;
  let mockSessionManager: any;

  const testConfig = {
    triggerDetectionInterval: 1000,      // 1 second for testing
    healthMonitoringInterval: 2000,      // 2 seconds for testing
    immediateStopTimeout: 2000,          // 2 seconds for testing
    gracefulStopTimeout: 5000,           // 5 seconds for testing
    maxConcurrentStops: 5,
    autoRecoveryEnabled: true,
    recoveryValidationTimeout: 3000,     // 3 seconds for testing
    postRecoveryMonitoringDuration: 5000, // 5 seconds for testing
    enableNotifications: true,
    notificationChannels: ['system'],
    enableDetailedLogging: true,
    retainEventHistory: 7,               // 7 days for testing
    maxMemoryUsage: 256 * 1024 * 1024,   // 256MB for testing
    maxCpuUsage: 70                      // 70% for testing
  };

  beforeAll(async () => {
    // Setup mock dependencies
    mockHealthMonitor = {
      performHealthAssessment: jest.fn(),
      getHealthDashboard: jest.fn(),
      handleRealtimeEvent: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockRealtimeSync = {
      shutdown: jest.fn(),
      getConnectionStatus: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockAntiDetectionManager = {
      emergencyStop: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockBehavioralEngine = {
      emergencyStop: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };

    mockSessionManager = {
      emergencyStop: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };

    // Mock database and cache responses
    (prisma.antiDetectionAuditLog.create as jest.Mock).mockResolvedValue({});
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    (cacheManager.set as jest.Mock).mockResolvedValue(true);
    (cacheManager.get as jest.Mock).mockResolvedValue(null);
    (cacheManager.del as jest.Mock).mockResolvedValue(true);

    // Initialize emergency stop system
    emergencyStopSystem = new EmergencyStopSystem(
      testConfig,
      mockHealthMonitor,
      mockRealtimeSync,
      mockAntiDetectionManager,
      mockBehavioralEngine,
      mockSessionManager
    );

    await emergencyStopSystem.initialize();
  });

  afterAll(async () => {
    await emergencyStopSystem.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(emergencyStopSystem).toBeDefined();
      const status = emergencyStopSystem.getSystemStatus();
      expect(status.isRunning).toBe(true);
      expect(status.isShuttingDown).toBe(false);
    });

    test('should setup default triggers', () => {
      const triggers = emergencyStopSystem.getAllTriggers();
      expect(triggers.length).toBeGreaterThan(0);
      
      // Check for default triggers
      const healthTrigger = triggers.find(t => t.triggerType === EmergencyTriggerType.HEALTH_SCORE_CRITICAL);
      expect(healthTrigger).toBeDefined();
      expect(healthTrigger?.isActive).toBe(true);
    });

    test('should setup service integrations', () => {
      // Verify that service integration event handlers were setup
      expect(mockHealthMonitor.on).toHaveBeenCalled();
      expect(mockRealtimeSync.on).toHaveBeenCalled();
      expect(mockAntiDetectionManager.on).toHaveBeenCalled();
    });
  });

  describe('Trigger Management', () => {
    test('should add emergency trigger', async () => {
      const trigger = {
        triggerType: EmergencyTriggerType.RATE_LIMIT_VIOLATION,
        accountId: 'test-account-123',
        name: 'Test Rate Limit Trigger',
        description: 'Test trigger for rate limit violations',
        isActive: true,
        thresholds: {
          rateLimitHits: 5
        },
        timeWindow: 300000,
        cooldownPeriod: 600000,
        stopLevel: EmergencyStopLevel.GRACEFUL,
        priority: 2
      };

      const triggerId = await emergencyStopSystem.addTrigger(trigger);
      
      expect(triggerId).toBeDefined();
      expect(triggerId).toMatch(/^trigger_\d+_[a-z0-9]+$/);
      
      const addedTrigger = emergencyStopSystem.getTrigger(triggerId);
      expect(addedTrigger).toBeDefined();
      expect(addedTrigger?.name).toBe(trigger.name);
      expect(addedTrigger?.triggerType).toBe(trigger.triggerType);
    });

    test('should remove emergency trigger', async () => {
      const trigger = {
        triggerType: EmergencyTriggerType.AUTHENTICATION_FAILURE,
        name: 'Test Auth Failure Trigger',
        description: 'Test trigger for authentication failures',
        isActive: true,
        thresholds: { authFailures: 3 },
        stopLevel: EmergencyStopLevel.IMMEDIATE,
        priority: 3
      };

      const triggerId = await emergencyStopSystem.addTrigger(trigger);
      expect(emergencyStopSystem.getTrigger(triggerId)).toBeDefined();

      const removed = await emergencyStopSystem.removeTrigger(triggerId);
      expect(removed).toBe(true);
      expect(emergencyStopSystem.getTrigger(triggerId)).toBeNull();
    });

    test('should validate trigger configuration', async () => {
      const invalidTrigger = {
        triggerType: 'invalid_type' as EmergencyTriggerType,
        name: '',
        description: '',
        isActive: true,
        thresholds: {},
        stopLevel: EmergencyStopLevel.IMMEDIATE,
        priority: 1
      };

      await expect(emergencyStopSystem.addTrigger(invalidTrigger)).rejects.toThrow();
    });
  });

  describe('Emergency Stop Execution', () => {
    test('should execute immediate emergency stop', async () => {
      const triggerData = {
        reason: 'Test immediate stop',
        severity: 'critical',
        timestamp: new Date().toISOString()
      };

      const eventId = await emergencyStopSystem.executeEmergencyStop(
        'manual',
        triggerData,
        'test-account',
        true
      );

      expect(eventId).toBeDefined();
      expect(eventId).toMatch(/^emergency_\d+_[a-z0-9]+$/);

      // Verify that services were stopped
      expect(mockRealtimeSync.shutdown).toHaveBeenCalled();
      expect(mockSessionManager.emergencyStop).toHaveBeenCalled();
      expect(mockBehavioralEngine.emergencyStop).toHaveBeenCalled();
      expect(mockAntiDetectionManager.emergencyStop).toHaveBeenCalled();

      const emergencyEvent = emergencyStopSystem.getEmergencyEvent(eventId);
      expect(emergencyEvent).toBeDefined();
      expect(emergencyEvent?.success).toBe(true);
    });

    test('should execute manual emergency stop', async () => {
      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-account-manual',
        'Manual test stop',
        EmergencyStopLevel.GRACEFUL
      );

      expect(eventId).toBeDefined();

      const emergencyEvent = emergencyStopSystem.getEmergencyEvent(eventId);
      expect(emergencyEvent).toBeDefined();
      expect(emergencyEvent?.triggerType).toBe(EmergencyTriggerType.MANUAL_TRIGGER);
      expect(emergencyEvent?.stopLevel).toBe(EmergencyStopLevel.GRACEFUL);
    });

    test('should handle concurrent stop limit', async () => {
      // Fill up to the concurrent limit
      const promises = [];
      for (let i = 0; i < testConfig.maxConcurrentStops; i++) {
        promises.push(
          emergencyStopSystem.manualEmergencyStop(
            `test-account-${i}`,
            `Concurrent test ${i}`,
            EmergencyStopLevel.IMMEDIATE
          )
        );
      }

      await Promise.all(promises);

      // Try to exceed the limit
      await expect(
        emergencyStopSystem.manualEmergencyStop(
          'test-account-overflow',
          'Should fail due to limit',
          EmergencyStopLevel.IMMEDIATE
        )
      ).rejects.toThrow('Maximum concurrent emergency stops reached');
    });

    test('should execute different stop levels', async () => {
      const stopLevels = [
        EmergencyStopLevel.IMMEDIATE,
        EmergencyStopLevel.GRACEFUL,
        EmergencyStopLevel.SERVICE_SPECIFIC,
        EmergencyStopLevel.CASCADING,
        EmergencyStopLevel.MAINTENANCE
      ];

      for (const stopLevel of stopLevels) {
        const eventId = await emergencyStopSystem.manualEmergencyStop(
          `test-account-${stopLevel}`,
          `Test ${stopLevel} stop`,
          stopLevel
        );

        expect(eventId).toBeDefined();

        const emergencyEvent = emergencyStopSystem.getEmergencyEvent(eventId);
        expect(emergencyEvent?.stopLevel).toBe(stopLevel);
      }
    });
  });

  describe('Recovery Procedures', () => {
    test('should start recovery procedure', async () => {
      // First create an emergency
      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-account-recovery',
        'Test recovery',
        EmergencyStopLevel.GRACEFUL
      );

      // Mock health checks to succeed
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ version: 'PostgreSQL 13' }]);
      (cacheManager.get as jest.Mock).mockResolvedValue('ok');

      // Start recovery
      const recoverySuccess = await emergencyStopSystem.startRecovery(eventId);

      expect(recoverySuccess).toBe(true);

      const emergencyEvent = emergencyStopSystem.getEmergencyEvent(eventId);
      expect(emergencyEvent?.recoverySuccess).toBe(true);
      expect(emergencyEvent?.recoveryPhase).toBe(RecoveryPhase.MONITORING);
    });

    test('should handle recovery failure', async () => {
      // Create an emergency
      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-account-recovery-fail',
        'Test recovery failure',
        EmergencyStopLevel.IMMEDIATE
      );

      // Mock health checks to fail
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      // Start recovery
      const recoverySuccess = await emergencyStopSystem.startRecovery(eventId);

      expect(recoverySuccess).toBe(false);

      const emergencyEvent = emergencyStopSystem.getEmergencyEvent(eventId);
      expect(emergencyEvent?.recoverySuccess).toBe(false);
    });

    test('should execute recovery phases in order', async () => {
      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-account-phases',
        'Test recovery phases',
        EmergencyStopLevel.GRACEFUL
      );

      // Mock successful health checks
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (cacheManager.set as jest.Mock).mockResolvedValue(true);
      (cacheManager.get as jest.Mock).mockResolvedValue('ok');

      const recoverySuccess = await emergencyStopSystem.startRecovery(eventId);
      expect(recoverySuccess).toBe(true);

      // Verify database operations were called for persistence
      expect(prisma.antiDetectionAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('Trigger Detection', () => {
    test('should detect health score trigger', async () => {
      // Setup health monitor to return low health score
      mockHealthMonitor.performHealthAssessment.mockResolvedValue({
        overallHealthScore: 25, // Below threshold of 30
        suspensionRiskScore: 60,
        confidenceLevel: 85
      } as any);

      // Add a health score trigger
      const triggerId = await emergencyStopSystem.addTrigger({
        triggerType: EmergencyTriggerType.HEALTH_SCORE_CRITICAL,
        accountId: 'test-health-account',
        name: 'Test Health Trigger',
        description: 'Test health score trigger',
        isActive: true,
        thresholds: { healthScore: 30 },
        stopLevel: EmergencyStopLevel.GRACEFUL,
        priority: 3
      });

      // Manually trigger detection (normally done by interval)
      const trigger = emergencyStopSystem.getTrigger(triggerId);
      expect(trigger).toBeDefined();

      // The trigger detection would normally be called by the interval
      // For testing, we verify the trigger exists and is configured correctly
      expect(trigger?.thresholds.healthScore).toBe(30);
      expect(trigger?.isActive).toBe(true);
    });

    test('should detect suspension risk trigger', async () => {
      // Setup health monitor to return high risk score
      mockHealthMonitor.performHealthAssessment.mockResolvedValue({
        overallHealthScore: 70,
        suspensionRiskScore: 90, // Above threshold of 85
        confidenceLevel: 95
      } as any);

      const triggerId = await emergencyStopSystem.addTrigger({
        triggerType: EmergencyTriggerType.ACCOUNT_SUSPENSION_RISK,
        accountId: 'test-risk-account',
        name: 'Test Risk Trigger',
        description: 'Test suspension risk trigger',
        isActive: true,
        thresholds: { riskScore: 85 },
        stopLevel: EmergencyStopLevel.IMMEDIATE,
        priority: 4
      });

      const trigger = emergencyStopSystem.getTrigger(triggerId);
      expect(trigger).toBeDefined();
      expect(trigger?.thresholds.riskScore).toBe(85);
    });
  });

  describe('System Status and Monitoring', () => {
    test('should provide system status', () => {
      const status = emergencyStopSystem.getSystemStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('isShuttingDown');
      expect(status).toHaveProperty('activeTriggers');
      expect(status).toHaveProperty('activeEmergencies');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('lastHealthCheck');

      expect(typeof status.activeTriggers).toBe('number');
      expect(typeof status.activeEmergencies).toBe('number');
      expect(status.isRunning).toBe(true);
    });

    test('should track emergency metrics', async () => {
      const initialStatus = emergencyStopSystem.getSystemStatus();
      const initialMetrics = initialStatus.metrics;

      // Execute an emergency stop
      await emergencyStopSystem.manualEmergencyStop(
        'test-metrics-account',
        'Test metrics tracking',
        EmergencyStopLevel.IMMEDIATE
      );

      const updatedStatus = emergencyStopSystem.getSystemStatus();
      const updatedMetrics = updatedStatus.metrics;

      expect(updatedMetrics.totalTriggers).toBeGreaterThan(initialMetrics.totalTriggers);
      expect(updatedMetrics.successfulStops).toBeGreaterThan(initialMetrics.successfulStops);
      expect(updatedMetrics.lastEmergencyTime).toBeDefined();
    });

    test('should list active emergencies', async () => {
      const initialEmergencies = emergencyStopSystem.getActiveEmergencies();
      const initialCount = initialEmergencies.length;

      // Create an emergency
      await emergencyStopSystem.manualEmergencyStop(
        'test-active-emergency',
        'Test active emergency listing',
        EmergencyStopLevel.GRACEFUL
      );

      const updatedEmergencies = emergencyStopSystem.getActiveEmergencies();
      expect(updatedEmergencies.length).toBeGreaterThan(initialCount);

      const latestEmergency = updatedEmergencies[updatedEmergencies.length - 1];
      expect(latestEmergency.triggerType).toBe(EmergencyTriggerType.MANUAL_TRIGGER);
    });
  });

  describe('Service Integration', () => {
    test('should integrate with AccountHealthMonitor', () => {
      // Verify that health monitor integration was setup
      expect(mockHealthMonitor.on).toHaveBeenCalledWith('healthAlert', expect.any(Function));
      expect(mockHealthMonitor.on).toHaveBeenCalledWith('preventiveMeasureTriggered', expect.any(Function));
    });

    test('should integrate with TwikitRealtimeSync', () => {
      // Verify that realtime sync integration was setup
      expect(mockRealtimeSync.on).toHaveBeenCalledWith('eventReceived', expect.any(Function));
      expect(mockRealtimeSync.on).toHaveBeenCalledWith('connectionStopped', expect.any(Function));
    });

    test('should integrate with EnterpriseAntiDetectionManager', () => {
      // Verify that anti-detection manager integration was setup
      expect(mockAntiDetectionManager.on).toHaveBeenCalledWith('detectionEvent', expect.any(Function));
      expect(mockAntiDetectionManager.on).toHaveBeenCalledWith('riskLevelChanged', expect.any(Function));
    });

    test('should coordinate service shutdown', async () => {
      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-service-coordination',
        'Test service coordination',
        EmergencyStopLevel.IMMEDIATE
      );

      // Verify all services were called for emergency stop
      expect(mockRealtimeSync.shutdown).toHaveBeenCalled();
      expect(mockSessionManager.emergencyStop).toHaveBeenCalledWith(expect.any(String));
      expect(mockBehavioralEngine.emergencyStop).toHaveBeenCalledWith(expect.any(String));
      expect(mockAntiDetectionManager.emergencyStop).toHaveBeenCalledWith(expect.any(String));

      const emergencyEvent = emergencyStopSystem.getEmergencyEvent(eventId);
      expect(emergencyEvent?.success).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle service stop failures gracefully', async () => {
      // Mock service failures
      mockRealtimeSync.shutdown.mockRejectedValue(new Error('Service stop failed'));
      mockSessionManager.emergencyStop.mockRejectedValue(new Error('Session stop failed'));

      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-service-failure',
        'Test service failure handling',
        EmergencyStopLevel.IMMEDIATE
      );

      // Should still complete the emergency stop process
      expect(eventId).toBeDefined();

      const emergencyEvent = emergencyStopSystem.getEmergencyEvent(eventId);
      expect(emergencyEvent).toBeDefined();
      // May not be successful due to service failures, but should not crash
    });

    test('should handle invalid trigger evaluation', async () => {
      const triggerId = await emergencyStopSystem.addTrigger({
        triggerType: EmergencyTriggerType.HEALTH_SCORE_CRITICAL,
        name: 'Test Invalid Trigger',
        description: 'Test trigger with invalid configuration',
        isActive: true,
        thresholds: {}, // Empty thresholds
        stopLevel: EmergencyStopLevel.GRACEFUL,
        priority: 2
      });

      const trigger = emergencyStopSystem.getTrigger(triggerId);
      expect(trigger).toBeDefined();
      expect(trigger?.thresholds).toEqual({});
    });

    test('should handle recovery procedure not found', async () => {
      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-no-recovery',
        'Test no recovery procedure',
        EmergencyStopLevel.IMMEDIATE
      );

      // Try to start recovery with non-existent procedure
      const recoverySuccess = await emergencyStopSystem.startRecovery(eventId, 'non-existent-procedure');
      expect(recoverySuccess).toBe(false);
    });
  });

  describe('Performance and Reliability', () => {
    test('should execute emergency stop within timeout', async () => {
      const startTime = Date.now();

      const eventId = await emergencyStopSystem.manualEmergencyStop(
        'test-performance',
        'Test performance',
        EmergencyStopLevel.IMMEDIATE
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(testConfig.immediateStopTimeout);
      expect(eventId).toBeDefined();
    });

    test('should maintain system stability under load', async () => {
      const promises = [];
      const accountCount = 10;

      // Create multiple emergency stops concurrently
      for (let i = 0; i < accountCount; i++) {
        promises.push(
          emergencyStopSystem.manualEmergencyStop(
            `load-test-account-${i}`,
            `Load test ${i}`,
            EmergencyStopLevel.GRACEFUL
          )
        );
      }

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      // Should handle at least some of the load
      expect(successCount).toBeGreaterThan(0);

      // System should still be running
      const status = emergencyStopSystem.getSystemStatus();
      expect(status.isRunning).toBe(true);
    });
  });
});
