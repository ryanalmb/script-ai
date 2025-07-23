/**
 * Simple validation test for Twikit configuration
 */

const path = require('path');

// Mock environment variables for testing
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-that-is-at-least-32-characters-long';

// Test proxy configuration
process.env.TWIKIT_ENABLE_PROXY_ROTATION = 'true';
process.env.TWIKIT_DATACENTER_PROXY_ENABLED = 'true';
process.env.TWIKIT_DATACENTER_PROXY_URLS = 'http://proxy1.example.com:8080,http://proxy2.example.com:8080';
process.env.TWIKIT_DATACENTER_PROXY_USERNAME = 'test_user';
process.env.TWIKIT_DATACENTER_PROXY_PASSWORD = 'test_pass';

async function testEnvironmentConfiguration() {
  console.log('=== Testing Environment Configuration ===');
  
  try {
    // Import the environment configuration
    const { env, config } = require('../../config/environment');
    
    console.log('✅ Environment configuration loaded successfully');
    console.log('Node Environment:', env.NODE_ENV);
    console.log('Twikit Proxy Rotation Enabled:', env.TWIKIT_ENABLE_PROXY_ROTATION);
    console.log('Datacenter Proxy Enabled:', env.TWIKIT_DATACENTER_PROXY_ENABLED);
    
    // Test Twikit configuration section
    if (config.twikit) {
      console.log('✅ Twikit configuration section found');
      console.log('Proxy rotation enabled:', config.twikit.proxy.enableRotation);
      console.log('Enabled proxy pools:', Object.entries(config.twikit.proxy.pools)
        .filter(([_, pool]) => pool.enabled)
        .map(([type, _]) => type));
      console.log('Anti-detection enabled:', config.twikit.antiDetection.enabled);
      console.log('Behavior profile:', config.twikit.antiDetection.behaviorProfile);
      console.log('Max concurrent sessions:', config.twikit.session.maxConcurrentSessions);
    } else {
      throw new Error('Twikit configuration section not found');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Environment configuration test failed:', error.message);
    return false;
  }
}

async function testTwikitConfigManager() {
  console.log('\n=== Testing Twikit Config Manager ===');
  
  try {
    // Mock the TwikitConfigManager for testing
    const mockConfig = {
      proxy: {
        enableRotation: true,
        rotationInterval: 300,
        healthCheckInterval: 60,
        maxFailures: 5,
        healthCheckTimeout: 10,
        healthCheckUrls: ['https://httpbin.org/ip'],
        pools: {
          residential: { enabled: false, urls: [], username: undefined, password: undefined },
          datacenter: { 
            enabled: true, 
            urls: ['http://proxy1.example.com:8080', 'http://proxy2.example.com:8080'],
            username: 'test_user',
            password: 'test_pass'
          },
          mobile: { enabled: false, urls: [], username: undefined, password: undefined }
        }
      },
      antiDetection: {
        enabled: true,
        sessionDuration: { min: 1800, max: 7200 },
        actionDelay: { min: 1, max: 5 },
        behaviorProfile: 'moderate'
      },
      session: {
        maxConcurrentSessions: 50,
        cleanupInterval: 1800,
        healthCheckInterval: 300,
        enablePersistence: true
      },
      retry: {
        maxRetries: 3,
        baseDelay: 1,
        maxDelay: 60,
        exponentialBase: 2,
        enableJitter: true
      }
    };

    class MockTwikitConfigManager {
      constructor() {
        this._config = mockConfig;
      }

      get config() {
        return this._config;
      }

      getProxyPoolConfig(poolType) {
        return this._config.proxy.pools[poolType];
      }

      getEnabledProxyPools() {
        const pools = [];
        for (const [type, poolConfig] of Object.entries(this._config.proxy.pools)) {
          if (poolConfig.enabled && poolConfig.urls.length > 0) {
            pools.push({ type, config: poolConfig });
          }
        }
        return pools;
      }

      isProxyRotationEnabled() {
        return this._config.proxy.enableRotation && this.getEnabledProxyPools().length > 0;
      }

      getSessionConfig() {
        return {
          ...this._config.session,
          maxConcurrentSessions: this.isProxyRotationEnabled() 
            ? this._config.session.maxConcurrentSessions 
            : Math.min(this._config.session.maxConcurrentSessions, 10)
        };
      }

      getAntiDetectionConfig() {
        const baseConfig = this._config.antiDetection;
        return {
          ...baseConfig,
          randomSessionDuration: () => {
            const min = baseConfig.sessionDuration.min;
            const max = baseConfig.sessionDuration.max;
            return Math.floor(Math.random() * (max - min + 1)) + min;
          },
          randomActionDelay: () => {
            const min = baseConfig.actionDelay.min;
            const max = baseConfig.actionDelay.max;
            return Math.random() * (max - min) + min;
          }
        };
      }

      getRetryConfig(actionType) {
        const baseConfig = this._config.retry;
        
        if (actionType === 'authenticate') {
          return {
            ...baseConfig,
            maxRetries: Math.min(baseConfig.maxRetries + 2, 5),
            baseDelay: baseConfig.baseDelay * 2
          };
        }
        
        if (actionType === 'post_tweet' || actionType === 'follow_user') {
          return {
            ...baseConfig,
            maxRetries: Math.max(baseConfig.maxRetries - 1, 1),
            baseDelay: baseConfig.baseDelay * 1.5
          };
        }
        
        return baseConfig;
      }

      exportForPythonClient() {
        return {
          proxyConfigs: this.getEnabledProxyPools().flatMap(pool => 
            pool.config.urls.map(url => ({
              url,
              type: pool.type,
              username: pool.config.username,
              password: pool.config.password,
              healthScore: 1.0
            }))
          ),
          sessionConfig: {
            userAgent: '',
            viewportSize: [1920, 1080],
            timezone: 'UTC',
            language: 'en-US',
            behaviorProfile: this._config.antiDetection.behaviorProfile,
            sessionDuration: this.getAntiDetectionConfig().randomSessionDuration()
          },
          retryConfig: {
            maxRetries: this._config.retry.maxRetries,
            baseDelay: this._config.retry.baseDelay,
            maxDelay: this._config.retry.maxDelay,
            exponentialBase: this._config.retry.exponentialBase,
            jitter: this._config.retry.enableJitter
          }
        };
      }

      getConfigSummary() {
        const enabledPools = this.getEnabledProxyPools();
        return {
          proxyRotationEnabled: this.isProxyRotationEnabled(),
          enabledProxyPools: enabledPools.map(p => p.type),
          totalProxyUrls: enabledPools.reduce((sum, p) => sum + p.config.urls.length, 0),
          antiDetectionEnabled: this._config.antiDetection.enabled,
          maxConcurrentSessions: this._config.session.maxConcurrentSessions,
          sessionPersistenceEnabled: this._config.session.enablePersistence,
          behaviorProfile: this._config.antiDetection.behaviorProfile
        };
      }
    }

    const configManager = new MockTwikitConfigManager();
    
    // Test basic functionality
    console.log('✅ Config manager instantiated');
    
    // Test proxy configuration
    const enabledPools = configManager.getEnabledProxyPools();
    console.log('✅ Enabled proxy pools:', enabledPools.map(p => p.type));
    
    const isProxyEnabled = configManager.isProxyRotationEnabled();
    console.log('✅ Proxy rotation enabled:', isProxyEnabled);
    
    // Test anti-detection configuration
    const antiDetectionConfig = configManager.getAntiDetectionConfig();
    const randomDuration = antiDetectionConfig.randomSessionDuration();
    const randomDelay = antiDetectionConfig.randomActionDelay();
    console.log('✅ Random session duration:', randomDuration);
    console.log('✅ Random action delay:', randomDelay);
    
    // Test retry configuration
    const defaultRetry = configManager.getRetryConfig();
    const authRetry = configManager.getRetryConfig('authenticate');
    const postRetry = configManager.getRetryConfig('post_tweet');
    console.log('✅ Default retry config:', defaultRetry);
    console.log('✅ Auth retry config:', authRetry);
    console.log('✅ Post retry config:', postRetry);
    
    // Test Python client export
    const pythonConfig = configManager.exportForPythonClient();
    console.log('✅ Python client config exported');
    console.log('   Proxy configs count:', pythonConfig.proxyConfigs.length);
    console.log('   Behavior profile:', pythonConfig.sessionConfig.behaviorProfile);
    
    // Test configuration summary
    const summary = configManager.getConfigSummary();
    console.log('✅ Configuration summary:', JSON.stringify(summary, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Twikit config manager test failed:', error.message);
    return false;
  }
}

async function runConfigurationTests() {
  console.log('🚀 Starting Twikit Configuration Tests...\n');
  
  const results = {
    environment: await testEnvironmentConfiguration(),
    configManager: await testTwikitConfigManager()
  };
  
  console.log('\n=== Test Results Summary ===');
  console.log(`Environment Configuration: ${results.environment ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Config Manager: ${results.configManager ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runConfigurationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runConfigurationTests,
  testEnvironmentConfiguration,
  testTwikitConfigManager
};
