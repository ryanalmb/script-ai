/**
 * Advanced Proxy Manager Tests - Task 18 Implementation
 * 
 * Comprehensive test suite for the enhanced ProxyRotationManager with intelligent selection,
 * performance tracking, and automated optimization algorithms.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { 
  ProxyRotationManager,
  ProxyType,
  ActionRiskLevel,
  ProxyPerformanceClass,
  ProxyRiskLevel,
  OptimizationStrategy,
  ProxySelectionCriteria,
  ProxySelectionResult,
  ProxyOptimizationResult
} from '../services/proxyRotationManager';
import { TwikitConfigManager } from '../config/twikit';
import { cacheManager } from '../lib/cache';

// Mock dependencies
jest.mock('../lib/cache');
jest.mock('../utils/logger');

describe('Advanced Proxy Manager - Task 18', () => {
  let proxyManager: ProxyRotationManager;
  let mockConfigManager: TwikitConfigManager;
  let mockEmergencyStopSystem: any;
  let mockAccountHealthMonitor: any;
  let mockAntiDetectionManager: any;

  const testConfig = {
    proxy: {
      enabled: true,
      rotationInterval: 30,
      healthCheckInterval: 60,
      maxFailures: 3,
      pools: {
        residential: {
          enabled: true,
          urls: [
            'http://residential1.proxy.com:8080',
            'http://residential2.proxy.com:8080',
            'http://residential3.proxy.com:8080'
          ],
          username: 'test_user',
          password: 'test_pass'
        },
        datacenter: {
          enabled: true,
          urls: [
            'http://datacenter1.proxy.com:8080',
            'http://datacenter2.proxy.com:8080'
          ]
        },
        mobile: {
          enabled: true,
          urls: [
            'http://mobile1.proxy.com:8080'
          ]
        }
      }
    }
  };

  beforeAll(async () => {
    // Setup mock config manager
    mockConfigManager = {
      config: testConfig,
      updateConfig: jest.fn(),
      getConfig: jest.fn().mockReturnValue(testConfig)
    } as any;

    // Setup mock service dependencies
    mockEmergencyStopSystem = {
      manualEmergencyStop: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };

    mockAccountHealthMonitor = {
      on: jest.fn(),
      emit: jest.fn()
    };

    mockAntiDetectionManager = {
      on: jest.fn(),
      emit: jest.fn()
    };

    // Mock cache responses
    (cacheManager.set as jest.Mock).mockResolvedValue(true);
    (cacheManager.get as jest.Mock).mockResolvedValue(null);
    (cacheManager.del as jest.Mock).mockResolvedValue(true);

    // Initialize proxy manager with advanced features
    proxyManager = new ProxyRotationManager(
      mockConfigManager,
      mockEmergencyStopSystem,
      mockAccountHealthMonitor,
      mockAntiDetectionManager
    );

    await proxyManager.start();
  });

  afterAll(async () => {
    await proxyManager.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Intelligent Proxy Selection', () => {
    test('should select optimal proxy with advanced criteria', async () => {
      const criteria: ProxySelectionCriteria = {
        actionType: 'post_tweet',
        riskLevel: ActionRiskLevel.HIGH,
        accountId: 'test-account-123',
        preferredRegion: 'North America',
        maxRiskScore: 50,
        requiredPerformanceClass: ProxyPerformanceClass.HIGH,
        optimizationStrategy: OptimizationStrategy.PERFORMANCE_FIRST,
        geographicConstraints: {
          allowedCountries: ['US', 'CA'],
          preferredTimezones: ['America/New_York', 'America/Toronto']
        },
        performanceRequirements: {
          maxLatency: 2000,
          minUptime: 95,
          requiresLowDetectionRisk: true
        }
      };

      const result = await proxyManager.getProxyByCriteria(criteria);

      expect(result).toBeDefined();
      expect(result.selectionTime).toBeLessThan(50); // <50ms requirement
      expect(result.selectionReason).toContain('Intelligent selection');
      
      if (result.proxy) {
        expect(result.proxy.riskScore).toBeLessThanOrEqual(50);
        expect(result.proxy.isActive).toBe(true);
        expect(result.proxy.healthScore).toBeGreaterThan(0.3);
      }

      expect(result.riskAssessment).toBeDefined();
      expect(result.performancePrediction).toBeDefined();
      expect(result.optimizationRecommendations).toBeDefined();
    });

    test('should handle risk-based selection strategy', async () => {
      const criteria: ProxySelectionCriteria = {
        actionType: 'authenticate',
        riskLevel: ActionRiskLevel.CRITICAL,
        accountId: 'critical-account',
        optimizationStrategy: OptimizationStrategy.RISK_MINIMIZATION,
        maxRiskScore: 30
      };

      const result = await proxyManager.getProxyByCriteria(criteria);

      expect(result).toBeDefined();
      if (result.proxy) {
        expect(result.proxy.riskScore).toBeLessThanOrEqual(30);
        expect(result.riskAssessment.overallRisk).not.toBe(ProxyRiskLevel.CRITICAL);
      }
    });

    test('should provide alternative proxies when available', async () => {
      const criteria: ProxySelectionCriteria = {
        actionType: 'like_tweet',
        riskLevel: ActionRiskLevel.MEDIUM,
        accountId: 'test-account'
      };

      const result = await proxyManager.getProxyByCriteria(criteria);

      expect(result).toBeDefined();
      expect(result.alternativeProxies).toBeDefined();
      expect(Array.isArray(result.alternativeProxies)).toBe(true);
    });

    test('should handle geographic constraints', async () => {
      const criteria: ProxySelectionCriteria = {
        actionType: 'search',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'geo-test-account',
        geographicConstraints: {
          allowedCountries: ['US'],
          blockedCountries: ['CN', 'RU']
        }
      };

      const result = await proxyManager.getProxyByCriteria(criteria);

      expect(result).toBeDefined();
      if (result.proxy) {
        expect(['US', 'Unknown']).toContain(result.proxy.geographicData.country);
      }
    });
  });

  describe('Performance Tracking and Metrics', () => {
    test('should record advanced proxy usage metrics', async () => {
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'metrics-test'
      });

      expect(proxy).toBeDefined();
      
      if (proxy) {
        // Record usage with advanced metrics
        await proxyManager.recordProxyUsage(
          proxy.id,
          true,
          1500, // 1.5s response time
          undefined,
          1024 * 1024, // 1MB transferred
          'api_call',
          'metrics-test-account'
        );

        // Verify metrics were updated
        expect(proxy.totalRequests).toBeGreaterThan(0);
        expect(proxy.performanceMetrics.latency.average).toBeGreaterThan(0);
        expect(proxy.bandwidthUtilization.totalBytesTransferred).toBeGreaterThan(0);
        expect(proxy.optimizationData.learningData.trainingDataPoints).toBeGreaterThan(0);
      }
    });

    test('should update performance class based on metrics', async () => {
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'performance-test'
      });

      expect(proxy).toBeDefined();
      
      if (proxy) {
        const initialClass = proxy.performanceClass;
        
        // Record multiple successful requests with good performance
        for (let i = 0; i < 10; i++) {
          await proxyManager.recordProxyUsage(
            proxy.id,
            true,
            500, // Fast response
            undefined,
            1024 * 512, // 512KB
            'fast_request'
          );
        }

        // Performance class should improve or stay the same
        expect([
          ProxyPerformanceClass.PREMIUM,
          ProxyPerformanceClass.HIGH,
          ProxyPerformanceClass.STANDARD
        ]).toContain(proxy.performanceClass);
      }
    });

    test('should track bandwidth utilization', async () => {
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'bandwidth-test'
      });

      expect(proxy).toBeDefined();
      
      if (proxy) {
        const initialBytes = proxy.bandwidthUtilization.totalBytesTransferred;
        
        await proxyManager.recordProxyUsage(
          proxy.id,
          true,
          1000,
          undefined,
          2 * 1024 * 1024 // 2MB
        );

        expect(proxy.bandwidthUtilization.totalBytesTransferred).toBeGreaterThan(initialBytes);
        expect(proxy.bandwidthUtilization.averageBandwidthUsage).toBeGreaterThan(0);
      }
    });
  });

  describe('Automated Optimization', () => {
    test('should run automated optimization', async () => {
      const result = await proxyManager.forceOptimization();

      expect(result).toBeDefined();
      expect(result.optimizedProxies).toBeDefined();
      expect(result.retiredProxies).toBeDefined();
      expect(result.performanceImprovement).toBeGreaterThanOrEqual(0);
      expect(result.riskReduction).toBeGreaterThanOrEqual(0);
      expect(result.recommendations).toBeDefined();
      expect(result.nextOptimizationTime).toBeDefined();
    });

    test('should trigger manual optimization with strategy', async () => {
      const result = await proxyManager.triggerManualOptimization(
        OptimizationStrategy.PERFORMANCE_FIRST
      );

      expect(result).toBeDefined();
      expect(result.performanceImprovement).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    test('should optimize specific proxies', async () => {
      const allProxies = proxyManager.getAllProxies();
      const targetProxyIds = allProxies.slice(0, 2).map(p => p.id);

      const result = await proxyManager.triggerManualOptimization(
        OptimizationStrategy.BALANCED,
        targetProxyIds
      );

      expect(result).toBeDefined();
      expect(result.optimizedProxies.length).toBeLessThanOrEqual(targetProxyIds.length);
    });
  });

  describe('Risk Assessment and Management', () => {
    test('should assess proxy risk accurately', async () => {
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'risk-test'
      });

      expect(proxy).toBeDefined();
      
      if (proxy) {
        const riskAssessment = proxyManager.getProxyRiskAssessment(proxy.id);
        
        expect(riskAssessment).toBeDefined();
        expect(riskAssessment?.riskScore).toBeGreaterThanOrEqual(0);
        expect(riskAssessment?.riskScore).toBeLessThanOrEqual(100);
        expect(riskAssessment?.overallRisk).toBeDefined();
        expect(riskAssessment?.confidenceLevel).toBeGreaterThanOrEqual(0);
      }
    });

    test('should update proxy risk score manually', async () => {
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'risk-update-test'
      });

      expect(proxy).toBeDefined();
      
      if (proxy) {
        const initialRiskScore = proxy.riskScore;
        const newRiskScore = 75;
        
        const success = await proxyManager.updateProxyRiskScore(
          proxy.id,
          newRiskScore,
          'Test risk score update'
        );

        expect(success).toBe(true);
        expect(proxy.riskScore).toBe(newRiskScore);
        expect(proxy.detectionHistory.length).toBeGreaterThan(0);
        
        const latestDetection = proxy.detectionHistory[proxy.detectionHistory.length - 1];
        expect(latestDetection.type).toBe('manual_adjustment');
      }
    });

    test('should handle detection events', async () => {
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'detection-test'
      });

      expect(proxy).toBeDefined();
      
      if (proxy) {
        const initialRiskScore = proxy.riskScore;
        
        // Simulate detection event
        const detectionEvent = {
          type: 'captcha',
          severity: 'high',
          proxyId: proxy.id,
          accountId: 'detection-test-account',
          details: { reason: 'Captcha challenge detected' }
        };

        // This would normally be called by the anti-detection manager
        await (proxyManager as any).handleDetectionEvent(detectionEvent);

        expect(proxy.riskScore).toBeGreaterThan(initialRiskScore);
        expect(proxy.detectionHistory.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Analytics and Reporting', () => {
    test('should provide comprehensive proxy analytics', async () => {
      const analytics = await proxyManager.getProxyAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.overview).toBeDefined();
      expect(analytics.overview.totalProxies).toBeGreaterThan(0);
      expect(analytics.overview.averageHealthScore).toBeGreaterThanOrEqual(0);
      expect(analytics.overview.averageRiskScore).toBeGreaterThanOrEqual(0);
      
      expect(analytics.performanceDistribution).toBeDefined();
      expect(analytics.riskDistribution).toBeDefined();
      expect(analytics.geographicDistribution).toBeDefined();
      expect(analytics.topPerformers).toBeDefined();
      expect(analytics.underperformers).toBeDefined();
      expect(analytics.optimizationRecommendations).toBeDefined();
    });

    test('should generate performance predictions', async () => {
      const predictions = await proxyManager.getProxyPerformancePredictions();

      expect(predictions).toBeDefined();
      expect(predictions.size).toBeGreaterThan(0);

      for (const [proxyId, prediction] of predictions) {
        expect(typeof proxyId).toBe('string');
        expect(prediction.expectedLatency).toBeGreaterThan(0);
        expect(prediction.expectedThroughput).toBeGreaterThan(0);
        expect(prediction.expectedSuccessRate).toBeGreaterThanOrEqual(0);
        expect(prediction.expectedSuccessRate).toBeLessThanOrEqual(100);
        expect(prediction.confidenceLevel).toBeGreaterThanOrEqual(0);
        expect(prediction.confidenceLevel).toBeLessThanOrEqual(100);
        expect(Array.isArray(prediction.riskFactors)).toBe(true);
        expect(Array.isArray(prediction.recommendations)).toBe(true);
      }
    });

    test('should provide selection metrics', () => {
      const metrics = proxyManager.getSelectionMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.metrics).toBeDefined();
      expect(metrics.metrics.totalSelections).toBeGreaterThanOrEqual(0);
      expect(metrics.metrics.successfulSelections).toBeGreaterThanOrEqual(0);
      expect(metrics.metrics.averageSelectionTime).toBeGreaterThanOrEqual(0);
      
      expect(metrics.systemHealth).toBeDefined();
      expect(metrics.systemHealth.overallHealth).toBeGreaterThanOrEqual(0);
      expect(metrics.systemHealth.overallHealth).toBeLessThanOrEqual(100);
      expect(Array.isArray(metrics.systemHealth.criticalIssues)).toBe(true);
      expect(Array.isArray(metrics.systemHealth.recommendations)).toBe(true);
    });

    test('should provide proxy performance history', async () => {
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'history-test'
      });

      expect(proxy).toBeDefined();
      
      if (proxy) {
        const history = await proxyManager.getProxyPerformanceHistory(proxy.id);
        
        expect(history).toBeDefined();
        expect(history?.proxy).toBeDefined();
        expect(history?.performanceHistory).toBeDefined();
        expect(Array.isArray(history?.performanceHistory)).toBe(true);
        expect(history?.trends).toBeDefined();
        
        if (history && history.performanceHistory.length > 0) {
          const dataPoint = history.performanceHistory[0];
          expect(dataPoint.timestamp).toBeDefined();
          expect(dataPoint.latency).toBeGreaterThan(0);
          expect(dataPoint.throughput).toBeGreaterThan(0);
          expect(dataPoint.successRate).toBeGreaterThanOrEqual(0);
          expect(dataPoint.healthScore).toBeGreaterThanOrEqual(0);
          expect(dataPoint.riskScore).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Service Integration', () => {
    test('should integrate with emergency stop system', async () => {
      // Verify emergency stop system integration
      expect(mockEmergencyStopSystem.on).toHaveBeenCalledWith(
        'emergencyStarted',
        expect.any(Function)
      );
    });

    test('should integrate with account health monitor', async () => {
      // Verify account health monitor integration
      expect(mockAccountHealthMonitor.on).toHaveBeenCalledWith(
        'healthAlert',
        expect.any(Function)
      );
    });

    test('should integrate with anti-detection manager', async () => {
      // Verify anti-detection manager integration
      expect(mockAntiDetectionManager.on).toHaveBeenCalledWith(
        'detectionEvent',
        expect.any(Function)
      );
    });

    test('should handle emergency stop events', async () => {
      const emergencyEvent = {
        eventId: 'emergency-123',
        triggerType: 'PROXY_FAILURE_CASCADE',
        affectedProxies: ['proxy-1', 'proxy-2']
      };

      // Simulate emergency stop event
      await (proxyManager as any).handleEmergencyStop(emergencyEvent);

      // Verify proxy pools were disabled
      const pools = (proxyManager as any).pools;
      for (const pool of pools.values()) {
        expect(pool.isEnabled).toBe(false);
      }
    });
  });

  describe('Performance and Reliability', () => {
    test('should meet proxy selection time requirements', async () => {
      const startTime = Date.now();
      
      const proxy = await proxyManager.getOptimalProxy({
        actionType: 'performance_test',
        riskLevel: ActionRiskLevel.MEDIUM,
        accountId: 'performance-test'
      });
      
      const selectionTime = Date.now() - startTime;
      
      expect(selectionTime).toBeLessThan(50); // <50ms requirement
      expect(proxy).toBeDefined();
    });

    test('should handle high-volume proxy operations', async () => {
      const promises = [];
      const operationCount = 50;

      // Create multiple concurrent proxy selection operations
      for (let i = 0; i < operationCount; i++) {
        promises.push(
          proxyManager.getOptimalProxy({
            actionType: `load_test_${i}`,
            riskLevel: ActionRiskLevel.LOW,
            accountId: `load-test-account-${i}`
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      // Should handle at least 80% of operations successfully
      expect(successCount).toBeGreaterThan(operationCount * 0.8);
    });

    test('should maintain performance under optimization load', async () => {
      // Start optimization
      const optimizationPromise = proxyManager.forceOptimization();
      
      // Perform proxy selections during optimization
      const selectionPromises = [];
      for (let i = 0; i < 10; i++) {
        selectionPromises.push(
          proxyManager.getOptimalProxy({
            actionType: `concurrent_test_${i}`,
            riskLevel: ActionRiskLevel.MEDIUM,
            accountId: `concurrent-test-${i}`
          })
        );
      }

      // Wait for both optimization and selections
      const [optimizationResult, ...selectionResults] = await Promise.all([
        optimizationPromise,
        ...selectionPromises
      ]);

      expect(optimizationResult).toBeDefined();
      expect(selectionResults.filter(r => r !== null).length).toBeGreaterThan(5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle proxy not found scenarios', async () => {
      const riskAssessment = proxyManager.getProxyRiskAssessment('non-existent-proxy');
      expect(riskAssessment).toBeNull();

      const updateSuccess = await proxyManager.updateProxyRiskScore(
        'non-existent-proxy',
        50,
        'Test update'
      );
      expect(updateSuccess).toBe(false);
    });

    test('should handle empty proxy pools gracefully', async () => {
      // Disable all proxy pools
      const pools = (proxyManager as any).pools;
      for (const pool of pools.values()) {
        pool.isEnabled = false;
      }

      const result = await proxyManager.getProxyByCriteria({
        actionType: 'test',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'empty-pool-test'
      });

      expect(result.proxy).toBeNull();
      expect(result.selectionReason).toContain('No candidate proxies available');

      // Re-enable pools for other tests
      for (const pool of pools.values()) {
        pool.isEnabled = true;
      }
    });

    test('should handle invalid optimization parameters', async () => {
      await expect(
        proxyManager.triggerManualOptimization(
          'invalid_strategy' as OptimizationStrategy
        )
      ).rejects.toThrow();
    });
  });
});
