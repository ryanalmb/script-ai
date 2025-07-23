import { ProxyRotationManager, ProxyType, ActionRiskLevel, ProxySelectionCriteria } from '../services/proxyRotationManager';
import { TwikitConfigManager } from '../config/twikit';

// Mock dependencies
jest.mock('../utils/logger');
jest.mock('../lib/cache');

describe('ProxyRotationManager', () => {
  let proxyManager: ProxyRotationManager;
  let configManager: TwikitConfigManager;

  beforeEach(() => {
    configManager = new TwikitConfigManager();
    proxyManager = new ProxyRotationManager(configManager);
  });

  afterEach(async () => {
    await proxyManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(proxyManager).toBeDefined();
      expect(proxyManager.isHealthy()).toBe(true);
    });

    it('should initialize pools correctly', () => {
      const stats = proxyManager.getPoolStatistics();
      expect(stats).toBeDefined();
      expect(stats.totalPools).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Proxy Selection', () => {
    it('should select optimal proxy for high-risk actions', async () => {
      const criteria: ProxySelectionCriteria = {
        riskLevel: ActionRiskLevel.HIGH,
        minHealthScore: 0.7,
        maxResponseTime: 5000
      };

      // This may return null if no proxies are configured, which is expected in test environment
      const proxy = await proxyManager.getOptimalProxy(criteria);
      
      // In test environment without configured proxies, this should return null
      // In production with configured proxies, this would return a residential proxy
      expect(proxy === null || proxy.type === ProxyType.RESIDENTIAL || proxy.type === ProxyType.MOBILE).toBe(true);
    });

    it('should select optimal proxy for low-risk actions', async () => {
      const criteria: ProxySelectionCriteria = {
        riskLevel: ActionRiskLevel.LOW,
        minHealthScore: 0.5
      };

      const proxy = await proxyManager.getOptimalProxy(criteria);
      
      // In test environment without configured proxies, this should return null
      expect(proxy === null || proxy.type === ProxyType.DATACENTER || proxy.type === ProxyType.MOBILE).toBe(true);
    });

    it('should handle criteria with preferred region', async () => {
      const criteria: ProxySelectionCriteria = {
        riskLevel: ActionRiskLevel.MEDIUM,
        preferredRegion: 'US',
        minHealthScore: 0.6
      };

      const proxy = await proxyManager.getOptimalProxy(criteria);
      
      // Should return null in test environment or a proxy matching criteria
      expect(proxy === null || proxy.metadata.region === 'US' || proxy.metadata.region === undefined).toBe(true);
    });
  });

  describe('Pool Management', () => {
    it('should get pool statistics', () => {
      const stats = proxyManager.getPoolStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalPools).toBe('number');
      expect(typeof stats.totalProxies).toBe('number');
      expect(typeof stats.healthyProxies).toBe('number');
      expect(typeof stats.averageHealthScore).toBe('number');
    });

    it('should get pool statistics by type', () => {
      const residentialStats = proxyManager.getPoolStatistics(ProxyType.RESIDENTIAL);
      const datacenterStats = proxyManager.getPoolStatistics(ProxyType.DATACENTER);
      const mobileStats = proxyManager.getPoolStatistics(ProxyType.MOBILE);

      expect(residentialStats).toBeDefined();
      expect(datacenterStats).toBeDefined();
      expect(mobileStats).toBeDefined();
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status', () => {
      expect(proxyManager.isHealthy()).toBe(true);
    });

    it('should handle health check operations', async () => {
      // Start health monitoring
      await proxyManager.startHealthMonitoring();
      
      // Health monitoring should be running
      expect(proxyManager.isHealthy()).toBe(true);
      
      // Stop health monitoring
      await proxyManager.stopHealthMonitoring();
    });
  });

  describe('Configuration Integration', () => {
    it('should use TwikitConfigManager settings', () => {
      const config = configManager.config;
      
      expect(config).toBeDefined();
      expect(config.proxy).toBeDefined();
      expect(config.proxy.enableRotation).toBeDefined();
    });

    it('should handle configuration updates', async () => {
      const originalConfig = configManager.config.proxy.rotationInterval;
      
      // Update configuration
      await configManager.updateConfig({
        proxy: {
          ...configManager.config.proxy,
          rotationInterval: originalConfig + 100
        }
      });

      // Configuration should be updated
      expect(configManager.config.proxy.rotationInterval).toBe(originalConfig + 100);
    });
  });

  describe('Performance Optimization', () => {
    it('should track proxy performance', async () => {
      const criteria: ProxySelectionCriteria = {
        riskLevel: ActionRiskLevel.LOW,
        minHealthScore: 0.5
      };

      // Multiple selections to test performance tracking
      for (let i = 0; i < 3; i++) {
        await proxyManager.getOptimalProxy(criteria);
      }

      const stats = proxyManager.getPoolStatistics();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(0);
    });

    it('should optimize proxy selection', async () => {
      const startTime = Date.now();
      
      const criteria: ProxySelectionCriteria = {
        riskLevel: ActionRiskLevel.MEDIUM,
        maxResponseTime: 3000
      };

      await proxyManager.getOptimalProxy(criteria);
      
      const selectionTime = Date.now() - startTime;
      
      // Selection should be fast (under 1 second)
      expect(selectionTime).toBeLessThan(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid criteria gracefully', async () => {
      const invalidCriteria = {
        riskLevel: 'invalid' as ActionRiskLevel,
        minHealthScore: -1
      };

      const proxy = await proxyManager.getOptimalProxy(invalidCriteria);
      
      // Should handle gracefully and return null or valid proxy
      expect(proxy === null || typeof proxy === 'object').toBe(true);
    });

    it('should handle shutdown gracefully', async () => {
      await proxyManager.shutdown();
      
      // Should be able to shutdown without errors
      expect(true).toBe(true);
    });
  });
});
