import { TwikitConfigManager } from '../../config/twikit';

/**
 * Test suite for Twikit Configuration
 */
describe('TwikitConfigManager', () => {
  let configManager: TwikitConfigManager;

  beforeEach(() => {
    configManager = TwikitConfigManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TwikitConfigManager.getInstance();
      const instance2 = TwikitConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Proxy Configuration', () => {
    it('should provide proxy pool configurations', () => {
      const residentialConfig = configManager.getProxyPoolConfig('residential');
      const datacenterConfig = configManager.getProxyPoolConfig('datacenter');
      const mobileConfig = configManager.getProxyPoolConfig('mobile');
      
      expect(residentialConfig).toBeDefined();
      expect(datacenterConfig).toBeDefined();
      expect(mobileConfig).toBeDefined();
      
      expect(typeof residentialConfig.enabled).toBe('boolean');
      expect(Array.isArray(residentialConfig.urls)).toBe(true);
    });

    it('should return enabled proxy pools only', () => {
      const enabledPools = configManager.getEnabledProxyPools();
      
      expect(Array.isArray(enabledPools)).toBe(true);
      
      // All returned pools should be enabled and have URLs
      enabledPools.forEach(pool => {
        expect(pool.config.enabled).toBe(true);
        expect(pool.config.urls.length).toBeGreaterThan(0);
        expect(['residential', 'datacenter', 'mobile']).toContain(pool.type);
      });
    });

    it('should correctly determine if proxy rotation is enabled', () => {
      const isEnabled = configManager.isProxyRotationEnabled();
      
      expect(typeof isEnabled).toBe('boolean');
      
      // If enabled, there should be at least one enabled proxy pool
      if (isEnabled) {
        const enabledPools = configManager.getEnabledProxyPools();
        expect(enabledPools.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Session Configuration', () => {
    it('should provide session configuration', () => {
      const sessionConfig = configManager.getSessionConfig();
      
      expect(sessionConfig).toBeDefined();
      expect(typeof sessionConfig.maxConcurrentSessions).toBe('number');
      expect(typeof sessionConfig.cleanupInterval).toBe('number');
      expect(typeof sessionConfig.healthCheckInterval).toBe('number');
      expect(typeof sessionConfig.enablePersistence).toBe('boolean');
      
      expect(sessionConfig.maxConcurrentSessions).toBeGreaterThan(0);
      expect(sessionConfig.cleanupInterval).toBeGreaterThan(0);
      expect(sessionConfig.healthCheckInterval).toBeGreaterThan(0);
    });

    it('should adjust max concurrent sessions based on proxy availability', () => {
      const sessionConfig = configManager.getSessionConfig();
      const isProxyEnabled = configManager.isProxyRotationEnabled();
      
      if (!isProxyEnabled) {
        expect(sessionConfig.maxConcurrentSessions).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Anti-Detection Configuration', () => {
    it('should provide anti-detection configuration with randomization', () => {
      const antiDetectionConfig = configManager.getAntiDetectionConfig();
      
      expect(antiDetectionConfig).toBeDefined();
      expect(typeof antiDetectionConfig.enabled).toBe('boolean');
      expect(typeof antiDetectionConfig.sessionDuration.min).toBe('number');
      expect(typeof antiDetectionConfig.sessionDuration.max).toBe('number');
      expect(typeof antiDetectionConfig.actionDelay.min).toBe('number');
      expect(typeof antiDetectionConfig.actionDelay.max).toBe('number');
      expect(['conservative', 'moderate', 'active']).toContain(antiDetectionConfig.behaviorProfile);
      
      // Test randomization functions
      expect(typeof antiDetectionConfig.randomSessionDuration).toBe('function');
      expect(typeof antiDetectionConfig.randomActionDelay).toBe('function');
      
      const randomDuration = antiDetectionConfig.randomSessionDuration();
      const randomDelay = antiDetectionConfig.randomActionDelay();
      
      expect(randomDuration).toBeGreaterThanOrEqual(antiDetectionConfig.sessionDuration.min);
      expect(randomDuration).toBeLessThanOrEqual(antiDetectionConfig.sessionDuration.max);
      expect(randomDelay).toBeGreaterThanOrEqual(antiDetectionConfig.actionDelay.min);
      expect(randomDelay).toBeLessThanOrEqual(antiDetectionConfig.actionDelay.max);
    });
  });

  describe('Retry Configuration', () => {
    it('should provide retry configuration', () => {
      const retryConfig = configManager.getRetryConfig();
      
      expect(retryConfig).toBeDefined();
      expect(typeof retryConfig.maxRetries).toBe('number');
      expect(typeof retryConfig.baseDelay).toBe('number');
      expect(typeof retryConfig.maxDelay).toBe('number');
      expect(typeof retryConfig.exponentialBase).toBe('number');
      expect(typeof retryConfig.enableJitter).toBe('boolean');
      
      expect(retryConfig.maxRetries).toBeGreaterThan(0);
      expect(retryConfig.baseDelay).toBeGreaterThan(0);
      expect(retryConfig.maxDelay).toBeGreaterThan(retryConfig.baseDelay);
      expect(retryConfig.exponentialBase).toBeGreaterThan(1);
    });

    it('should adjust retry configuration based on action type', () => {
      const defaultConfig = configManager.getRetryConfig();
      const authConfig = configManager.getRetryConfig('authenticate');
      const postConfig = configManager.getRetryConfig('post_tweet');
      const followConfig = configManager.getRetryConfig('follow_user');
      
      // Authentication should have more retries and longer delays
      expect(authConfig.maxRetries).toBeGreaterThanOrEqual(defaultConfig.maxRetries);
      expect(authConfig.baseDelay).toBeGreaterThan(defaultConfig.baseDelay);
      
      // Risky actions should have fewer retries
      expect(postConfig.maxRetries).toBeLessThanOrEqual(defaultConfig.maxRetries);
      expect(followConfig.maxRetries).toBeLessThanOrEqual(defaultConfig.maxRetries);
    });
  });

  describe('Configuration Export', () => {
    it('should export configuration for Python client', () => {
      const pythonConfig = configManager.exportForPythonClient();
      
      expect(pythonConfig).toBeDefined();
      expect(pythonConfig).toHaveProperty('proxyConfigs');
      expect(pythonConfig).toHaveProperty('sessionConfig');
      expect(pythonConfig).toHaveProperty('retryConfig');
      
      const { proxyConfigs, sessionConfig, retryConfig } = pythonConfig as any;
      
      // Validate proxy configs
      expect(Array.isArray(proxyConfigs)).toBe(true);
      proxyConfigs.forEach((proxy: any) => {
        expect(proxy).toHaveProperty('url');
        expect(proxy).toHaveProperty('type');
        expect(proxy).toHaveProperty('healthScore');
        expect(['residential', 'datacenter', 'mobile']).toContain(proxy.type);
      });
      
      // Validate session config
      expect(sessionConfig).toHaveProperty('behaviorProfile');
      expect(sessionConfig).toHaveProperty('sessionDuration');
      expect(['conservative', 'moderate', 'active']).toContain(sessionConfig.behaviorProfile);
      
      // Validate retry config
      expect(retryConfig).toHaveProperty('maxRetries');
      expect(retryConfig).toHaveProperty('baseDelay');
      expect(retryConfig).toHaveProperty('maxDelay');
      expect(retryConfig).toHaveProperty('exponentialBase');
      expect(retryConfig).toHaveProperty('jitter');
    });

    it('should provide configuration summary', () => {
      const summary = configManager.getConfigSummary();
      
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('proxyRotationEnabled');
      expect(summary).toHaveProperty('enabledProxyPools');
      expect(summary).toHaveProperty('totalProxyUrls');
      expect(summary).toHaveProperty('antiDetectionEnabled');
      expect(summary).toHaveProperty('maxConcurrentSessions');
      expect(summary).toHaveProperty('sessionPersistenceEnabled');
      expect(summary).toHaveProperty('behaviorProfile');
      
      const typedSummary = summary as any;
      expect(typeof typedSummary.proxyRotationEnabled).toBe('boolean');
      expect(Array.isArray(typedSummary.enabledProxyPools)).toBe(true);
      expect(typeof typedSummary.totalProxyUrls).toBe('number');
      expect(typeof typedSummary.antiDetectionEnabled).toBe('boolean');
      expect(typeof typedSummary.maxConcurrentSessions).toBe('number');
      expect(typeof typedSummary.sessionPersistenceEnabled).toBe('boolean');
      expect(['conservative', 'moderate', 'active']).toContain(typedSummary.behaviorProfile);
    });
  });

  describe('Configuration Updates', () => {
    it('should allow runtime configuration updates', () => {
      const originalConfig = configManager.config;
      
      const updates = {
        session: {
          maxConcurrentSessions: 25,
          cleanupInterval: 900,
          healthCheckInterval: 150,
          enablePersistence: false
        }
      };
      
      configManager.updateConfig(updates);
      
      const updatedConfig = configManager.config;
      expect(updatedConfig.session.maxConcurrentSessions).toBe(25);
      expect(updatedConfig.session.cleanupInterval).toBe(900);
      expect(updatedConfig.session.healthCheckInterval).toBe(150);
      expect(updatedConfig.session.enablePersistence).toBe(false);
      
      // Other configurations should remain unchanged
      expect(updatedConfig.proxy).toEqual(originalConfig.proxy);
      expect(updatedConfig.antiDetection).toEqual(originalConfig.antiDetection);
      expect(updatedConfig.retry).toEqual(originalConfig.retry);
    });
  });
});

/**
 * Integration test for configuration validation
 */
describe('Twikit Configuration Integration', () => {
  it('should validate environment configuration', () => {
    // This test ensures that the environment configuration is properly loaded
    const configManager = TwikitConfigManager.getInstance();
    const config = configManager.config;
    
    expect(config).toBeDefined();
    expect(config.proxy).toBeDefined();
    expect(config.antiDetection).toBeDefined();
    expect(config.session).toBeDefined();
    expect(config.retry).toBeDefined();
  });

  it('should handle missing proxy configuration gracefully', () => {
    const configManager = TwikitConfigManager.getInstance();
    
    // Should not throw even if no proxies are configured
    expect(() => {
      configManager.getEnabledProxyPools();
      configManager.isProxyRotationEnabled();
      configManager.exportForPythonClient();
    }).not.toThrow();
  });
});

export { TwikitConfigManager };
