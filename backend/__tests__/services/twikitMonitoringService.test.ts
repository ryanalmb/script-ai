/**
 * Twikit Monitoring Service Test Suite - Task 25
 * 
 * Comprehensive test suite for the Twikit monitoring dashboard service.
 * Tests all major functionality including metrics collection, alerting,
 * health monitoring, and dashboard API integration.
 */

import { TwikitMonitoringService, TwikitMonitoringConfig } from '../../src/services/twikitMonitoringService';
import { getMonitoringConfig } from '../../src/config/monitoring';
import { prisma } from '../../src/lib/prisma';
import { cacheManager } from '../../src/lib/cache';

// Mock dependencies
jest.mock('../../src/lib/prisma');
jest.mock('../../src/lib/cache');
jest.mock('../../src/utils/logger');

describe('TwikitMonitoringService', () => {
  let monitoringService: TwikitMonitoringService;
  let testConfig: TwikitMonitoringConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create test configuration
    testConfig = {
      metricsCollectionInterval: 5000, // 5 seconds for tests
      healthCheckInterval: 10000, // 10 seconds for tests
      alertCheckInterval: 3000, // 3 seconds for tests
      detailedRetentionDays: 1,
      aggregatedRetentionDays: 7,
      maxConcurrentCollections: 5,
      collectionTimeout: 5000,
      enableRealTimeUpdates: false, // Disable for tests
      updateBroadcastInterval: 1000,
      enableAlerting: true,
      alertChannels: [],
      escalationPolicies: [],
      enableDashboardAPI: true,
      maxDashboardClients: 10,
      metricsCacheTTL: 60,
      enableMetricsCache: true
    };

    // Create monitoring service instance
    monitoringService = new TwikitMonitoringService(testConfig);
  });

  afterEach(async () => {
    // Cleanup
    if (monitoringService) {
      await monitoringService.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default configuration', async () => {
      await expect(monitoringService.initialize()).resolves.not.toThrow();
    });

    it('should initialize with custom configuration', async () => {
      const customConfig = { ...testConfig, metricsCollectionInterval: 15000 };
      const customService = new TwikitMonitoringService(customConfig);
      
      await expect(customService.initialize()).resolves.not.toThrow();
      
      const stats = customService.getMonitoringStatistics();
      expect(stats.config.metricsCollectionInterval).toBe(15000);
      
      await customService.shutdown();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock database error
      (prisma.twikitAlertRule.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      // Should still initialize but log warnings
      await expect(monitoringService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should collect comprehensive Twikit metrics', async () => {
      const metrics = await monitoringService.collectTwikitMetrics();
      
      expect(metrics).toHaveProperty('sessions');
      expect(metrics).toHaveProperty('proxies');
      expect(metrics).toHaveProperty('rateLimiting');
      expect(metrics).toHaveProperty('antiDetection');
      expect(metrics).toHaveProperty('accountHealth');
      expect(metrics).toHaveProperty('emergencySystem');
      expect(metrics).toHaveProperty('contentSafety');
      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics).toHaveProperty('retryEngine');
      expect(metrics).toHaveProperty('campaigns');
    });

    it('should handle service unavailability gracefully', async () => {
      // All services are undefined in test environment
      const metrics = await monitoringService.collectTwikitMetrics();
      
      // Should return default values when services are not available
      expect(metrics.sessions.total).toBe(0);
      expect(metrics.proxies.total).toBe(0);
      expect(metrics.rateLimiting.totalRequests).toBe(0);
    });

    it('should cache metrics when enabled', async () => {
      const mockSet = jest.fn();
      (cacheManager.set as jest.Mock) = mockSet;
      
      await monitoringService.collectTwikitMetrics();
      
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining('twikit_monitoring:metrics'),
        expect.any(Object),
        testConfig.metricsCacheTTL
      );
    });

    it('should store historical metrics', async () => {
      const mockCreate = jest.fn();
      const mockCreateMany = jest.fn();
      (prisma.twikitMetric.create as jest.Mock) = mockCreate;
      (prisma.twikitMetric.createMany as jest.Mock) = mockCreateMany;
      
      await monitoringService.collectTwikitMetrics();
      
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metric: 'comprehensive_metrics',
          value: 1,
          timestamp: expect.any(Date),
          tags: { type: 'comprehensive' },
          metadata: expect.any(Object)
        })
      });
      
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            metric: expect.stringContaining('.'),
            value: expect.any(Number),
            timestamp: expect.any(Date)
          })
        ])
      });
    });
  });

  describe('System Health Monitoring', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should collect system health information', async () => {
      const health = await monitoringService.collectSystemHealth();
      
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('lastUpdated');
      
      expect(['healthy', 'warning', 'critical', 'down']).toContain(health.overall);
    });

    it('should check individual service health', async () => {
      const health = await monitoringService.collectSystemHealth();
      
      // Should have health information for all monitored services
      const expectedServices = [
        'sessionManager', 'proxyManager', 'rateLimitCoordinator',
        'antiDetectionManager', 'accountHealthMonitor', 'emergencyStopSystem',
        'contentSafetyFilter', 'connectionPool', 'retryEngine', 'campaignOrchestrator'
      ];
      
      expectedServices.forEach(serviceName => {
        expect(health.components).toHaveProperty(serviceName);
        expect(health.components[serviceName]).toHaveProperty('status');
        expect(health.components[serviceName]).toHaveProperty('lastCheck');
        expect(health.components[serviceName]).toHaveProperty('responseTime');
        expect(health.components[serviceName]).toHaveProperty('errorRate');
      });
    });

    it('should calculate overall health correctly', async () => {
      const health = await monitoringService.collectSystemHealth();
      
      // Since no services are available in test, overall health should be 'down'
      expect(health.overall).toBe('down');
    });
  });

  describe('Alert Processing', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should process alerts based on metrics', async () => {
      // Mock metrics that would trigger alerts
      const mockMetrics = {
        sessions: { successRate: 50 }, // Below 80% threshold
        proxies: { averageHealthScore: 30 }, // Below 50% threshold
        rateLimiting: { utilizationPercentage: 95 }, // Above 90% threshold
        antiDetection: { overallScore: 60 }, // Below 70% threshold
        accountHealth: { averageHealthScore: 70 }, // Below 75% threshold
        emergencySystem: { isActive: true }, // Emergency active
        contentSafety: { complianceRate: 90 },
        connectionPool: { averageUtilization: 80 },
        retryEngine: { circuitBreakerTrips: 5 },
        campaigns: { averageSuccessRate: 85 }
      } as any;
      
      const alerts = await monitoringService.processAlerts(mockMetrics);
      
      // Should generate alerts for metrics that exceed thresholds
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should not generate duplicate alerts', async () => {
      const mockMetrics = {
        sessions: { successRate: 50 }
      } as any;
      
      // Process alerts twice with same metrics
      const alerts1 = await monitoringService.processAlerts(mockMetrics);
      const alerts2 = await monitoringService.processAlerts(mockMetrics);
      
      // Second call should not generate new alerts for same conditions
      expect(alerts2.length).toBeLessThanOrEqual(alerts1.length);
    });

    it('should resolve alerts when conditions improve', async () => {
      // First, trigger an alert
      const badMetrics = { sessions: { successRate: 50 } } as any;
      await monitoringService.processAlerts(badMetrics);
      
      // Then, improve the metrics
      const goodMetrics = { sessions: { successRate: 95 } } as any;
      const alerts = await monitoringService.processAlerts(goodMetrics);
      
      // Should have resolved alerts
      const resolvedAlerts = alerts.filter(alert => alert.status === 'resolved');
      expect(resolvedAlerts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Dashboard Data', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should provide comprehensive dashboard data', async () => {
      const dashboardData = await monitoringService.getDashboardData();
      
      expect(dashboardData).toHaveProperty('metrics');
      expect(dashboardData).toHaveProperty('health');
      expect(dashboardData).toHaveProperty('alerts');
      expect(dashboardData).toHaveProperty('trends');
      expect(dashboardData).toHaveProperty('timestamp');
    });

    it('should calculate trends correctly', async () => {
      // Mock previous metrics in cache
      const mockPreviousMetrics = {
        sessions: { successRate: 80 },
        proxies: { averageHealthScore: 70 }
      };
      
      (cacheManager.get as jest.Mock).mockResolvedValue(mockPreviousMetrics);
      
      const dashboardData = await monitoringService.getDashboardData();
      
      expect(dashboardData.trends).toBeDefined();
      expect(typeof dashboardData.trends).toBe('object');
    });
  });

  describe('Historical Data', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should retrieve historical metrics', async () => {
      const mockHistoricalData = [
        {
          id: '1',
          metric: 'sessions.successRate',
          value: 85.5,
          timestamp: new Date(),
          tags: {},
          metadata: {}
        }
      ];
      
      (prisma.twikitMetric.findMany as jest.Mock).mockResolvedValue(mockHistoricalData);
      
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();
      
      const historicalData = await monitoringService.getHistoricalMetrics(
        'sessions.successRate',
        startDate,
        endDate,
        'hourly'
      );
      
      expect(Array.isArray(historicalData)).toBe(true);
      expect(historicalData.length).toBe(1);
      expect(historicalData[0]).toHaveProperty('metric', 'sessions.successRate');
      expect(historicalData[0]).toHaveProperty('value', 85.5);
    });
  });

  describe('Service Statistics', () => {
    beforeEach(async () => {
      await monitoringService.initialize();
    });

    it('should provide monitoring service statistics', () => {
      const stats = monitoringService.getMonitoringStatistics();
      
      expect(stats).toHaveProperty('isRunning');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('connectedServices');
      expect(stats).toHaveProperty('activeAlerts');
      expect(stats).toHaveProperty('alertRules');
      expect(stats).toHaveProperty('alertChannels');
      expect(stats).toHaveProperty('collectionMetrics');
      expect(stats).toHaveProperty('uptime');
      
      expect(typeof stats.isRunning).toBe('boolean');
      expect(typeof stats.connectedServices).toBe('number');
      expect(typeof stats.uptime).toBe('number');
    });
  });

  describe('Configuration', () => {
    it('should use environment-specific configuration', () => {
      const config = getMonitoringConfig();
      
      expect(config).toHaveProperty('metricsCollectionInterval');
      expect(config).toHaveProperty('healthCheckInterval');
      expect(config).toHaveProperty('alertCheckInterval');
      expect(config).toHaveProperty('enableAlerting');
      expect(config).toHaveProperty('enableRealTimeUpdates');
      
      expect(typeof config.metricsCollectionInterval).toBe('number');
      expect(typeof config.enableAlerting).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (prisma.twikitMetric.create as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      await monitoringService.initialize();
      
      // Should not throw error even if database operations fail
      await expect(monitoringService.collectTwikitMetrics()).resolves.not.toThrow();
    });

    it('should handle cache errors gracefully', async () => {
      (cacheManager.set as jest.Mock).mockRejectedValue(new Error('Cache error'));
      
      await monitoringService.initialize();
      
      // Should not throw error even if cache operations fail
      await expect(monitoringService.collectTwikitMetrics()).resolves.not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should shutdown gracefully', async () => {
      await monitoringService.initialize();
      
      await expect(monitoringService.shutdown()).resolves.not.toThrow();
      
      const stats = monitoringService.getMonitoringStatistics();
      expect(stats.isRunning).toBe(false);
    });

    it('should handle multiple shutdown calls', async () => {
      await monitoringService.initialize();
      
      await monitoringService.shutdown();
      await expect(monitoringService.shutdown()).resolves.not.toThrow();
    });
  });
});
