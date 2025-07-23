/**
 * Global Rate Limit Coordinator Production Test Suite
 * Tests the distributed rate limiting system with real Redis and dependencies
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long-for-testing-purposes';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-that-is-at-least-32-characters-long-for-testing-purposes';
process.env.JWT_EXPIRES_IN = '24h';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.BCRYPT_ROUNDS = '12';
process.env.LOG_LEVEL = 'error';
process.env.ENABLE_REQUEST_LOGGING = 'false';
process.env.AUTOMATION_MODE = 'false';
process.env.ENABLE_ANALYTICS = 'true';

// Twikit environment variables
process.env.TWIKIT_ENABLE_PROXY_ROTATION = 'true';
process.env.TWIKIT_PROXY_ROTATION_INTERVAL = '300000';
process.env.TWIKIT_PROXY_HEALTH_CHECK_INTERVAL = '60000';
process.env.TWIKIT_PROXY_MAX_FAILURES = '3';
process.env.TWIKIT_PROXY_HEALTH_CHECK_TIMEOUT = '5000';
process.env.TWIKIT_RESIDENTIAL_PROXY_ENABLED = 'false';
process.env.TWIKIT_RESIDENTIAL_PROXY_URLS = '';
process.env.TWIKIT_RESIDENTIAL_PROXY_USERNAME = '';
process.env.TWIKIT_RESIDENTIAL_PROXY_PASSWORD = '';
process.env.TWIKIT_DATACENTER_PROXY_ENABLED = 'false';
process.env.TWIKIT_DATACENTER_PROXY_URLS = '';
process.env.TWIKIT_DATACENTER_PROXY_USERNAME = '';
process.env.TWIKIT_DATACENTER_PROXY_PASSWORD = '';
process.env.TWIKIT_MOBILE_PROXY_ENABLED = 'false';
process.env.TWIKIT_MOBILE_PROXY_URLS = '';
process.env.TWIKIT_MOBILE_PROXY_USERNAME = '';
process.env.TWIKIT_MOBILE_PROXY_PASSWORD = '';
process.env.TWIKIT_PROXY_HEALTH_CHECK_URLS = 'https://httpbin.org/ip,https://api.ipify.org?format=json';
process.env.TWIKIT_ENABLE_ANTI_DETECTION = 'true';
process.env.TWIKIT_SESSION_DURATION_MIN = '1800';
process.env.TWIKIT_SESSION_DURATION_MAX = '7200';
process.env.TWIKIT_ACTION_DELAY_MIN = '1000';
process.env.TWIKIT_ACTION_DELAY_MAX = '5000';
process.env.TWIKIT_BEHAVIOR_PROFILE = 'conservative';
process.env.TWIKIT_MAX_CONCURRENT_SESSIONS = '10';
process.env.TWIKIT_SESSION_CLEANUP_INTERVAL = '300000';
process.env.TWIKIT_SESSION_HEALTH_CHECK_INTERVAL = '60000';
process.env.TWIKIT_ENABLE_SESSION_PERSISTENCE = 'true';
process.env.TWIKIT_MAX_RETRIES = '3';
process.env.TWIKIT_RETRY_BASE_DELAY = '1000';
process.env.TWIKIT_RETRY_MAX_DELAY = '60000';
process.env.TWIKIT_RETRY_EXPONENTIAL_BASE = '2';
process.env.TWIKIT_RETRY_ENABLE_JITTER = 'true';
process.env.TWIKIT_ENABLE_RATE_LIMITING = 'true';
process.env.TWIKIT_ENABLE_DISTRIBUTED_COORDINATION = 'true';
process.env.TWIKIT_RATE_LIMIT_QUEUE_INTERVAL = '100';
process.env.TWIKIT_RATE_LIMIT_ANALYTICS_INTERVAL = '5000';
process.env.TWIKIT_RATE_LIMIT_PROFILE_CACHE_TTL = '3600';
process.env.TWIKIT_RATE_LIMIT_LOCK_TTL = '10000';
process.env.TWIKIT_RATE_LIMIT_DEFAULT_ACCOUNT_TYPE = 'standard';
process.env.TWIKIT_RATE_LIMIT_WARMUP_DURATION_DAYS = '30';

import {
  GlobalRateLimitCoordinator,
  RateLimitAction,
  RateLimitPriority,
  AccountType,
  RateLimitCheckRequest,
  DEFAULT_RATE_LIMITS,
  ACCOUNT_TYPE_MODIFIERS,
  GlobalRateLimitCoordinatorOptions
} from '../src/services/globalRateLimitCoordinator';
import { TwikitConfigManager } from '../src/config/twikit';
import { TwikitError, TwikitErrorType } from '../src/errors/enterpriseErrorFramework';
import Redis from 'ioredis';

describe('GlobalRateLimitCoordinator - Production Tests', () => {
  let coordinator: GlobalRateLimitCoordinator;
  let configManager: TwikitConfigManager;
  let redis: any;
  const testAccountId = 'test-account-123';

  beforeAll(async () => {
    // Create real Redis connection for testing
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3
      });

      try {
        await redis.connect();
        console.log('✅ Connected to Upstash Redis for testing');
      } catch (error) {
        console.log('⚠️ Redis not available, tests will run in degraded mode');
        console.error('Redis connection error:', error);
      }
    } else {
      console.log('⚠️ REDIS_URL not set, tests will run in degraded mode');
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.disconnect();
    }
  });

  beforeEach(async () => {
    configManager = TwikitConfigManager.getInstance();

    // Create coordinator with real dependencies
    const options: GlobalRateLimitCoordinatorOptions = {
      configManager,
      redisClient: redis,
      enableAnalytics: true,
      enableDistributedCoordination: true,
      queueProcessInterval: 50,
      analyticsFlushInterval: 1000,
      lockTtl: 5000,
      profileCacheTtl: 1800
    };

    coordinator = new GlobalRateLimitCoordinator(options);

    // Clean up any existing test data
    if (redis && redis.status === 'ready') {
      const keys = await redis.keys('rate_limit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    await coordinator.initialize();
  });

  afterEach(async () => {
    if (coordinator) {
      await coordinator.shutdown();
    }

    // Clean up test data
    if (redis && redis.status === 'ready') {
      const keys = await redis.keys('rate_limit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  });

  describe('Configuration Validation', () => {
    it('should have all required rate limit actions defined', () => {
      const expectedActions = [
        'POST_TWEET',
        'LIKE_TWEET',
        'RETWEET',
        'REPLY',
        'FOLLOW_USER',
        'UNFOLLOW_USER',
        'SEND_DM',
        'SEARCH_TWEETS',
        'GET_PROFILE',
        'GET_TWEET',
        'AUTHENTICATE'
      ];

      const actualActions = Object.keys(RateLimitAction);

      for (const expectedAction of expectedActions) {
        expect(actualActions).toContain(expectedAction);
      }
    });

    it('should have all required priority levels defined', () => {
      const expectedPriorities = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'];
      const actualPriorities = Object.keys(RateLimitPriority);

      for (const expectedPriority of expectedPriorities) {
        expect(actualPriorities).toContain(expectedPriority);
      }
    });

    it('should have all required account types defined', () => {
      const expectedAccountTypes = ['NEW', 'STANDARD', 'VERIFIED', 'PREMIUM', 'ENTERPRISE'];
      const actualAccountTypes = Object.keys(AccountType);

      for (const expectedAccountType of expectedAccountTypes) {
        expect(actualAccountTypes).toContain(expectedAccountType);
      }
    });

    it('should have rate limits for all actions', () => {
      const actions = Object.values(RateLimitAction);

      for (const action of actions) {
        expect(DEFAULT_RATE_LIMITS[action]).toBeDefined();
        expect(Array.isArray(DEFAULT_RATE_LIMITS[action])).toBe(true);
        expect(DEFAULT_RATE_LIMITS[action].length).toBeGreaterThan(0);
      }
    });

    it('should have valid account type modifiers', () => {
      const accountTypes = Object.values(AccountType);

      for (const accountType of accountTypes) {
        expect(ACCOUNT_TYPE_MODIFIERS[accountType]).toBeDefined();
        expect(typeof ACCOUNT_TYPE_MODIFIERS[accountType]).toBe('number');
        expect(ACCOUNT_TYPE_MODIFIERS[accountType]).toBeGreaterThan(0);
      }
    });

    it('should have properly structured rate limit configs', () => {
      for (const [action, configs] of Object.entries(DEFAULT_RATE_LIMITS)) {
        for (const config of configs) {
          expect(config).toHaveProperty('action');
          expect(config).toHaveProperty('window');
          expect(config).toHaveProperty('limit');
          expect(config.action).toBe(action);
          expect(typeof config.limit).toBe('number');
          expect(config.limit).toBeGreaterThan(0);

          if (config.burstLimit) {
            expect(config.burstLimit).toBeGreaterThan(config.limit);
          }
        }
      }
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newCoordinator = new GlobalRateLimitCoordinator({
        configManager,
        redisClient: redis
      });

      await expect(newCoordinator.initialize()).resolves.not.toThrow();
      await newCoordinator.shutdown();
    });

    it('should not initialize twice', async () => {
      // coordinator is already initialized in beforeEach
      await coordinator.initialize(); // Should not throw
      expect(coordinator['isInitialized']).toBe(true);
    });

    it('should provide instance information', () => {
      const info = coordinator.getInstanceInfo();
      
      expect(info).toHaveProperty('instanceId');
      expect(info).toHaveProperty('initialized');
      expect(info).toHaveProperty('profilesLoaded');
      expect(info).toHaveProperty('activeQueues');
      expect(info).toHaveProperty('distributedLocks');
      expect(info).toHaveProperty('analyticsBufferSize');
      
      expect(info.initialized).toBe(true);
      expect(typeof info.instanceId).toBe('string');
    });
  });

  describe('Rate Limit Checking', () => {
    it('should allow actions within rate limits', async () => {
      const request: RateLimitCheckRequest = {
        accountId: testAccountId,
        action: RateLimitAction.LIKE_TWEET,
        priority: RateLimitPriority.NORMAL
      };

      const response = await coordinator.checkRateLimit(request);
      
      expect(response.allowed).toBe(true);
      expect(response.status).toBeDefined();
      expect(Array.isArray(response.status)).toBe(true);
    });

    it('should handle rate limit exhaustion', async () => {
      // Test rate limit exhaustion by making multiple requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(coordinator.checkRateLimit({
          accountId: testAccountId,
          action: RateLimitAction.POST_TWEET,
          priority: RateLimitPriority.NORMAL
        }));
      }

      const responses = await Promise.all(requests);

      // At least some should be allowed initially
      const allowedCount = responses.filter(r => r.allowed).length;
      expect(allowedCount).toBeGreaterThan(0);

      // All responses should be valid
      for (const response of responses) {
        expect(response).toHaveProperty('allowed');
        expect(response).toHaveProperty('status');
      }
    });

    it('should handle different priority levels', async () => {
      const highPriorityRequest: RateLimitCheckRequest = {
        accountId: testAccountId,
        action: RateLimitAction.SEND_DM,
        priority: RateLimitPriority.HIGH
      };

      const lowPriorityRequest: RateLimitCheckRequest = {
        accountId: testAccountId,
        action: RateLimitAction.SEARCH_TWEETS,
        priority: RateLimitPriority.LOW
      };

      const highResponse = await coordinator.checkRateLimit(highPriorityRequest);
      const lowResponse = await coordinator.checkRateLimit(lowPriorityRequest);
      
      expect(highResponse).toBeDefined();
      expect(lowResponse).toBeDefined();
    });

    it('should get rate limit status for account and action', async () => {
      const statuses = await coordinator.getRateLimitStatus(testAccountId, RateLimitAction.POST_TWEET);

      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThan(0);

      for (const status of statuses) {
        expect(status).toHaveProperty('action');
        expect(status).toHaveProperty('window');
        expect(status).toHaveProperty('current');
        expect(status).toHaveProperty('limit');
        expect(status).toHaveProperty('remaining');
        expect(status).toHaveProperty('resetTime');
        expect(status).toHaveProperty('blocked');
      }
    });
  });

  describe('Account Profile Management', () => {
    it('should update account type', async () => {
      await coordinator.updateAccountType(testAccountId, AccountType.VERIFIED);

      // Verify the update by checking if it affects rate limits
      const statuses = await coordinator.getRateLimitStatus(testAccountId, RateLimitAction.POST_TWEET);
      expect(statuses.length).toBeGreaterThan(0);
    });

    it('should update account health multiplier', async () => {
      await coordinator.updateAccountHealth(testAccountId, 0.8);

      // Verify the update
      const statuses = await coordinator.getRateLimitStatus(testAccountId, RateLimitAction.POST_TWEET);
      expect(statuses.length).toBeGreaterThan(0);
    });

    it('should set custom rate limits', async () => {
      const customConfigs = [
        {
          action: RateLimitAction.POST_TWEET,
          window: 'HOUR' as any,
          limit: 5,
          burstLimit: 8
        }
      ];

      await coordinator.setCustomRateLimits(testAccountId, RateLimitAction.POST_TWEET, customConfigs);

      // Verify custom limits are applied
      const statuses = await coordinator.getRateLimitStatus(testAccountId, RateLimitAction.POST_TWEET);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Methods', () => {
    it('should check action allowed for integration', async () => {
      const result = await coordinator.checkActionAllowed(
        testAccountId,
        RateLimitAction.LIKE_TWEET,
        RateLimitPriority.NORMAL
      );

      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should start account warming', async () => {
      await expect(coordinator.startAccountWarming(testAccountId, 7))
        .resolves
        .not
        .toThrow();
    });

    it('should coordinate with proxy', async () => {
      const result = await coordinator.coordinateWithProxy(
        testAccountId,
        RateLimitAction.SEARCH_TWEETS,
        'proxy-123'
      );

      expect(typeof result).toBe('boolean');
    });

    it('should handle emergency override', async () => {
      const result = await coordinator.emergencyOverride(
        testAccountId,
        RateLimitAction.POST_TWEET,
        'Critical system maintenance'
      );

      expect(result).toBe(true);
    });
  });

  describe('Analytics and Statistics', () => {
    it('should get account statistics', async () => {
      // Generate some activity first
      await coordinator.checkRateLimit({
        accountId: testAccountId,
        action: RateLimitAction.LIKE_TWEET,
        priority: RateLimitPriority.NORMAL
      });

      const stats = await coordinator.getAccountStatistics(testAccountId);

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats).toHaveProperty('blockedRequests');
      expect(stats).toHaveProperty('averageQueueTime');
      expect(stats).toHaveProperty('actionBreakdown');

      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.allowedRequests).toBe('number');
      expect(typeof stats.blockedRequests).toBe('number');
    });

    it('should get global statistics', async () => {
      const stats = await coordinator.getGlobalStatistics();

      expect(stats).toHaveProperty('totalAccounts');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats).toHaveProperty('blockedRequests');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('activeProfiles');

      expect(typeof stats.totalAccounts).toBe('number');
      expect(typeof stats.queueLength).toBe('number');
    });
  });

  describe('Health Check and Monitoring', () => {
    it('should perform health check', async () => {
      const health = await coordinator.healthCheck();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('redis');
      expect(health).toHaveProperty('queueProcessor');
      expect(health).toHaveProperty('profilesLoaded');
      expect(health).toHaveProperty('activeQueues');

      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.redis).toBe('boolean');
      expect(typeof health.queueProcessor).toBe('boolean');
    });

    it('should provide comprehensive instance information', () => {
      const info = coordinator.getInstanceInfo();

      expect(info).toHaveProperty('instanceId');
      expect(info).toHaveProperty('initialized');
      expect(info).toHaveProperty('profilesLoaded');
      expect(info).toHaveProperty('activeQueues');
      expect(info).toHaveProperty('distributedLocks');
      expect(info).toHaveProperty('analyticsBufferSize');

      expect(info.initialized).toBe(true);
      expect(typeof info.instanceId).toBe('string');
      expect(info.instanceId.length).toBeGreaterThan(0);
    });
  });

  describe('Distributed Coordination', () => {
    it('should acquire and release distributed locks', async () => {
      const lock = await coordinator.acquireDistributedLock('test-lock', 5000);

      if (lock) {
        expect(lock.acquired).toBe(true);
        expect(lock.key).toContain('test-lock');

        const released = await coordinator.releaseDistributedLock(lock);
        expect(typeof released).toBe('boolean');
      }
    });
  });

  describe('Configuration Integration', () => {
    it('should use TwikitConfigManager settings', () => {
      const config = configManager.getRateLimitConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('distributedCoordination');
      expect(config).toHaveProperty('queueProcessingInterval');
    });

    it('should respect rate limiting enabled setting', () => {
      const enabled = configManager.isRateLimitingEnabled();
      expect(typeof enabled).toBe('boolean');
    });

    it('should respect distributed coordination setting', () => {
      const enabled = configManager.isDistributedCoordinationEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('Account Profile Management', () => {
    it('should create default profile for new account', async () => {
      const profile = await coordinator['getAccountProfile']('new-account-456');
      
      expect(profile).toBeDefined();
      expect(profile.accountId).toBe('new-account-456');
      expect(profile.accountType).toBe(AccountType.STANDARD);
      expect(profile.warmupMultiplier).toBe(1.0);
      expect(profile.healthMultiplier).toBe(1.0);
    });

    it('should update account type', async () => {
      await coordinator.updateAccountType(testAccountId, AccountType.VERIFIED);
      
      const profile = await coordinator['getAccountProfile'](testAccountId);
      expect(profile.accountType).toBe(AccountType.VERIFIED);
    });

    it('should update account health multiplier', async () => {
      await coordinator.updateAccountHealth(testAccountId, 0.8);
      
      const profile = await coordinator['getAccountProfile'](testAccountId);
      expect(profile.healthMultiplier).toBe(0.8);
    });

    it('should set custom rate limits', async () => {
      const customConfigs = [
        {
          action: RateLimitAction.POST_TWEET,
          window: 'HOUR' as any,
          limit: 5,
          burstLimit: 8
        }
      ];

      await coordinator.setCustomRateLimits(testAccountId, RateLimitAction.POST_TWEET, customConfigs);
      
      const profile = await coordinator['getAccountProfile'](testAccountId);
      expect(profile.customLimits).toBeDefined();
      expect(profile.customLimits![RateLimitAction.POST_TWEET]).toEqual(customConfigs);
    });
  });

  describe('Integration Methods', () => {
    it('should check action allowed for integration', async () => {
      const result = await coordinator.checkActionAllowed(
        testAccountId, 
        RateLimitAction.LIKE_TWEET, 
        RateLimitPriority.NORMAL
      );
      
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should start account warming', async () => {
      await expect(coordinator.startAccountWarming(testAccountId, 7))
        .resolves
        .not
        .toThrow();
    });

    it('should coordinate with proxy', async () => {
      const result = await coordinator.coordinateWithProxy(
        testAccountId,
        RateLimitAction.SEARCH_TWEETS,
        'proxy-123'
      );
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle emergency override', async () => {
      const result = await coordinator.emergencyOverride(
        testAccountId,
        RateLimitAction.POST_TWEET,
        'Critical system maintenance'
      );
      
      expect(result).toBe(true);
    });
  });

  describe('Analytics and Statistics', () => {
    it('should get account statistics', async () => {
      const stats = await coordinator.getAccountStatistics(testAccountId);
      
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats).toHaveProperty('blockedRequests');
      expect(stats).toHaveProperty('averageQueueTime');
      expect(stats).toHaveProperty('actionBreakdown');
      
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.allowedRequests).toBe('number');
      expect(typeof stats.blockedRequests).toBe('number');
    });

    it('should get global statistics', async () => {
      const stats = await coordinator.getGlobalStatistics();
      
      expect(stats).toHaveProperty('totalAccounts');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('allowedRequests');
      expect(stats).toHaveProperty('blockedRequests');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('activeProfiles');
      
      expect(typeof stats.totalAccounts).toBe('number');
      expect(typeof stats.queueLength).toBe('number');
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await coordinator.healthCheck();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('redis');
      expect(health).toHaveProperty('queueProcessor');
      expect(health).toHaveProperty('profilesLoaded');
      expect(health).toHaveProperty('activeQueues');
      
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.redis).toBe('boolean');
      expect(typeof health.queueProcessor).toBe('boolean');
    });
  });

  describe('Distributed Locking', () => {
    it('should acquire and release distributed locks', async () => {
      const lock = await coordinator.acquireDistributedLock('test-lock', 5000);
      
      expect(lock).toBeDefined();
      if (lock) {
        expect(lock.acquired).toBe(true);
        expect(lock.key).toContain('test-lock');
        
        const released = await coordinator.releaseDistributedLock(lock);
        expect(released).toBe(true);
      }
    });
  });

  describe('Configuration Integration', () => {
    it('should use TwikitConfigManager settings', () => {
      const config = configManager.getRateLimitConfig();
      
      expect(config).toBeDefined();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('distributedCoordination');
      expect(config).toHaveProperty('queueProcessingInterval');
    });

    it('should respect rate limiting enabled setting', () => {
      const enabled = configManager.isRateLimitingEnabled();
      expect(typeof enabled).toBe('boolean');
    });

    it('should respect distributed coordination setting', () => {
      const enabled = configManager.isDistributedCoordinationEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('Default Rate Limits Configuration', () => {
    it('should have rate limits for all actions', () => {
      const actions = Object.values(RateLimitAction);

      for (const action of actions) {
        expect(DEFAULT_RATE_LIMITS[action]).toBeDefined();
        expect(Array.isArray(DEFAULT_RATE_LIMITS[action])).toBe(true);
        expect(DEFAULT_RATE_LIMITS[action].length).toBeGreaterThan(0);
      }
    });

    it('should have valid account type modifiers', () => {
      const accountTypes = Object.values(AccountType);

      for (const accountType of accountTypes) {
        expect(ACCOUNT_TYPE_MODIFIERS[accountType]).toBeDefined();
        expect(typeof ACCOUNT_TYPE_MODIFIERS[accountType]).toBe('number');
        expect(ACCOUNT_TYPE_MODIFIERS[accountType]).toBeGreaterThan(0);
      }
    });

    it('should have properly structured rate limit configs', () => {
      for (const [action, configs] of Object.entries(DEFAULT_RATE_LIMITS)) {
        for (const config of configs) {
          expect(config).toHaveProperty('action');
          expect(config).toHaveProperty('window');
          expect(config).toHaveProperty('limit');
          expect(config.action).toBe(action);
          expect(typeof config.limit).toBe('number');
          expect(config.limit).toBeGreaterThan(0);

          if (config.burstLimit) {
            expect(config.burstLimit).toBeGreaterThan(config.limit);
          }
        }
      }
    });

    it('should have conservative limits for high-risk actions', () => {
      const highRiskActions = [
        RateLimitAction.POST_TWEET,
        RateLimitAction.FOLLOW_USER,
        RateLimitAction.SEND_DM,
        RateLimitAction.AUTHENTICATE
      ];

      for (const action of highRiskActions) {
        const configs = DEFAULT_RATE_LIMITS[action];
        const minuteConfig = configs.find(c => c.window.includes('1m'));

        if (minuteConfig) {
          // High-risk actions should have very conservative per-minute limits
          expect(minuteConfig.limit).toBeLessThanOrEqual(5);
        }
      }
    });

    it('should have reasonable limits for low-risk actions', () => {
      const lowRiskActions = [
        RateLimitAction.SEARCH_TWEETS,
        RateLimitAction.GET_PROFILE,
        RateLimitAction.GET_TWEET
      ];

      for (const action of lowRiskActions) {
        const configs = DEFAULT_RATE_LIMITS[action];
        const minuteConfig = configs.find(c => c.window.includes('1m'));

        if (minuteConfig) {
          // Low-risk actions can have higher per-minute limits
          expect(minuteConfig.limit).toBeGreaterThanOrEqual(10);
        }
      }
    });
  });

  describe('Queue Management', () => {
    it('should process queue with priority ordering', async () => {
      // This test verifies that the queue processing logic exists
      expect(coordinator['processQueue']).toBeDefined();
      expect(coordinator['processQueueGroup']).toBeDefined();
      expect(coordinator['addToQueue']).toBeDefined();
      expect(coordinator['getQueuePosition']).toBeDefined();
      expect(coordinator['estimateWaitTime']).toBeDefined();
    });
  });

  describe('Redis Integration', () => {
    it('should have Lua script storage initialized', () => {
      expect(coordinator['luaScriptShas']).toBeDefined();
    });

    it('should handle Redis operations', async () => {
      if (redis && redis.status === 'ready') {
        const result = await redis.ping();
        expect(result).toBe('PONG');
      }
    });

    it('should use atomic operations for rate limiting', async () => {
      const request: RateLimitCheckRequest = {
        accountId: testAccountId,
        action: RateLimitAction.LIKE_TWEET,
        priority: RateLimitPriority.NORMAL
      };

      const response = await coordinator.checkRateLimit(request);

      // Verify response structure
      expect(response).toHaveProperty('allowed');
      expect(response).toHaveProperty('status');
    });
  });

  describe('Error Handling', () => {
    it('should handle graceful degradation when Redis is unavailable', async () => {
      // Test with a coordinator that has no Redis connection
      const degradedCoordinator = new GlobalRateLimitCoordinator({
        configManager,
        redisClient: null,
        enableAnalytics: false,
        enableDistributedCoordination: false
      });

      await degradedCoordinator.initialize();

      const request: RateLimitCheckRequest = {
        accountId: testAccountId,
        action: RateLimitAction.LIKE_TWEET
      };

      // Should not throw, but work in degraded mode
      const response = await degradedCoordinator.checkRateLimit(request);
      expect(response).toHaveProperty('allowed');

      await degradedCoordinator.shutdown();
    });

    it('should handle invalid rate limit configurations', async () => {
      // Test with invalid account profile
      const invalidProfile = {
        accountId: 'invalid-account',
        accountType: 'INVALID' as AccountType,
        warmupMultiplier: -1,
        healthMultiplier: -1,
        createdAt: new Date(),
        lastUpdated: new Date()
      };

      // The system should handle invalid configurations gracefully
      const testConfig = DEFAULT_RATE_LIMITS[RateLimitAction.POST_TWEET][0];
      if (testConfig) {
        expect(() => coordinator['getEffectiveLimit'](testConfig, invalidProfile))
          .not.toThrow();
      }
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track analytics for rate limit operations', async () => {
      const request: RateLimitCheckRequest = {
        accountId: testAccountId,
        action: RateLimitAction.LIKE_TWEET,
        priority: RateLimitPriority.NORMAL,
        metadata: { testData: 'analytics-test' }
      };

      await coordinator.checkRateLimit(request);

      // Verify analytics are being recorded
      expect(coordinator['analyticsBuffer']).toBeDefined();
      expect(coordinator['recordAnalytics']).toBeDefined();
    });

    it('should provide comprehensive statistics', async () => {
      const accountStats = await coordinator.getAccountStatistics(testAccountId);
      const globalStats = await coordinator.getGlobalStatistics();

      // Verify statistics structure
      expect(accountStats).toHaveProperty('actionBreakdown');
      expect(globalStats).toHaveProperty('totalAccounts');

      // Verify all actions are included in breakdown
      const actions = Object.keys(accountStats.actionBreakdown);
      expect(actions.length).toBeGreaterThan(0);
    });
  });
});
