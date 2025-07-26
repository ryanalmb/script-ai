import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TwikitConfigManager } from '../config/twikit';
import { cacheManager } from '../lib/cache';

// Mock dependencies
jest.mock('../lib/cache');
jest.mock('../utils/logger');

describe('TwikitConfigManager', () => {
  let configManager: TwikitConfigManager;

  beforeEach(() => {
    // Reset singleton instance for testing
    (TwikitConfigManager as any).instance = undefined;
    configManager = TwikitConfigManager.getInstance();
  });

  afterEach(async () => {
    await configManager.shutdown();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TwikitConfigManager.getInstance();
      const instance2 = TwikitConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration Management', () => {
    it('should provide default configuration', () => {
      const config = configManager.config;
      expect(config).toBeDefined();
      expect(config.environment).toBeDefined();
      expect(config.proxy).toBeDefined();
      expect(config.antiDetection).toBeDefined();
      expect(config.session).toBeDefined();
      expect(config.retry).toBeDefined();
      expect(config.rateLimit).toBeDefined();
    });

    it('should update configuration with validation', async () => {
      const updates = {
        proxy: {
          rotationInterval: 600
        }
      };

      await configManager.updateConfig(updates, 'test-user');
      expect(configManager.config.proxy.rotationInterval).toBe(600);
    });

    it('should reject invalid configuration updates', async () => {
      const invalidUpdates = {
        proxy: {
          rotationInterval: -1 // Invalid value
        }
      };

      await expect(configManager.updateConfig(invalidUpdates, 'test-user'))
        .rejects.toThrow();
    });
  });

  describe('Proxy Configuration', () => {
    it('should get proxy pool configuration', () => {
      const residentialConfig = configManager.getProxyPoolConfig('residential');
      expect(residentialConfig).toBeDefined();
      expect(residentialConfig.enabled).toBeDefined();
      expect(residentialConfig.urls).toBeInstanceOf(Array);
    });

    it('should identify enabled proxy pools', () => {
      const enabledPools = configManager.getEnabledProxyPools();
      expect(enabledPools).toBeInstanceOf(Array);
    });

    it('should check proxy rotation status', () => {
      const isEnabled = configManager.isProxyRotationEnabled();
      expect(typeof isEnabled).toBe('boolean');
    });
  });

  describe('Anti-Detection Configuration', () => {
    it('should provide randomized session duration', () => {
      const antiDetectionConfig = configManager.getAntiDetectionConfig();
      expect(antiDetectionConfig.randomSessionDuration).toBeInstanceOf(Function);
      
      const duration1 = antiDetectionConfig.randomSessionDuration();
      const duration2 = antiDetectionConfig.randomSessionDuration();
      
      expect(typeof duration1).toBe('number');
      expect(typeof duration2).toBe('number');
      expect(duration1).toBeGreaterThan(0);
      expect(duration2).toBeGreaterThan(0);
    });

    it('should provide randomized action delay', () => {
      const antiDetectionConfig = configManager.getAntiDetectionConfig();
      expect(antiDetectionConfig.randomActionDelay).toBeInstanceOf(Function);
      
      const delay = antiDetectionConfig.randomActionDelay();
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe('Session Configuration', () => {
    it('should adjust session config based on proxy availability', () => {
      const sessionConfig = configManager.getSessionConfig();
      expect(sessionConfig).toBeDefined();
      expect(sessionConfig.maxConcurrentSessions).toBeGreaterThan(0);
    });
  });

  describe('Retry Configuration', () => {
    it('should provide context-aware retry configuration', () => {
      const authRetryConfig = configManager.getRetryConfig('authenticate');
      const tweetRetryConfig = configManager.getRetryConfig('post_tweet');
      const defaultRetryConfig = configManager.getRetryConfig();

      expect(authRetryConfig.maxRetries).toBeGreaterThanOrEqual(defaultRetryConfig.maxRetries);
      expect(tweetRetryConfig.maxRetries).toBeLessThanOrEqual(defaultRetryConfig.maxRetries);
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should manage custom rate limits', () => {
      const accountId = 'test-account-123';
      const customLimits = {
        'post_tweet': [{ window: '1h', limit: 10 }]
      };

      configManager.setCustomRateLimits(accountId, customLimits);
      const retrievedLimits = configManager.getCustomRateLimits(accountId);
      
      expect(retrievedLimits).toEqual(customLimits);

      configManager.removeCustomRateLimits(accountId);
      const removedLimits = configManager.getCustomRateLimits(accountId);
      
      expect(removedLimits).toBeNull();
    });
  });

  describe('A/B Testing', () => {
    it('should start and end experiments', async () => {
      // Enable A/B testing
      await configManager.updateConfig({
        abTesting: { enabled: true, experiments: {} }
      });

      const variants = {
        control: {},
        variant_a: {
          proxy: { rotationInterval: 300 }
        }
      };

      const trafficSplit = {
        control: 0.5,
        variant_a: 0.5
      };

      await configManager.startExperiment(
        'test-experiment',
        variants,
        trafficSplit,
        3600, // 1 hour
        'test-user'
      );

      // Verify experiment is active
      const variantConfig = configManager.getConfigurationVariant('test-account');
      expect(variantConfig).toBeDefined();

      await configManager.endExperiment('test-experiment', 'test-user');
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect performance metrics', () => {
      // Trigger some operations to generate metrics
      configManager.getProxyPoolConfig('residential');
      configManager.getSessionConfig();
      configManager.getRetryConfig();

      const metrics = configManager.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.configLookups).toBeGreaterThan(0);
    });

    it('should provide configuration history', () => {
      const history = configManager.getConfigHistory(5);
      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const healthStatus = await configManager.healthCheck();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthStatus.checks).toBeDefined();
      expect(healthStatus.metrics).toBeDefined();
    });
  });

  describe('Configuration Summary', () => {
    it('should provide comprehensive configuration summary', () => {
      const summary = configManager.getConfigSummary();
      
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('environment');
      expect(summary).toHaveProperty('version');
      expect(summary).toHaveProperty('proxyRotationEnabled');
      expect(summary).toHaveProperty('antiDetectionEnabled');
      expect(summary).toHaveProperty('maxConcurrentSessions');
      expect(summary).toHaveProperty('rateLimitingEnabled');
    });
  });

  describe('Action-Specific Configuration', () => {
    it('should provide action-specific configuration', () => {
      const tweetConfig = configManager.getActionConfig('post_tweet', 'standard');
      const likeConfig = configManager.getActionConfig('like_tweet', 'premium');
      
      expect(tweetConfig).toBeDefined();
      expect(tweetConfig.rateLimit).toBeDefined();
      expect(tweetConfig.retry).toBeDefined();
      expect(tweetConfig.antiDetection).toBeDefined();
      
      expect(likeConfig).toBeDefined();
      expect(likeConfig.rateLimit).toBeDefined();
      expect(likeConfig.retry).toBeDefined();
      expect(likeConfig.antiDetection).toBeDefined();
    });
  });

  describe('Account-Specific Configuration', () => {
    it('should provide account-specific configuration', () => {
      const accountId = 'test-account-456';
      const accountConfig = configManager.getAccountConfig(accountId);
      
      expect(accountConfig).toBeDefined();
      expect(accountConfig.proxy).toBeDefined();
      expect(accountConfig.antiDetection).toBeDefined();
      expect(accountConfig.session).toBeDefined();
      expect(accountConfig.retry).toBeDefined();
      expect(accountConfig.rateLimit).toBeDefined();
    });
  });
});
