/**
 * Global Rate Limit Coordinator Validation Test Suite
 * Validates the implementation without full initialization
 */

// Set test environment before any imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-that-is-at-least-32-characters-long-for-testing';

import {
  GlobalRateLimitCoordinator,
  RateLimitAction,
  RateLimitPriority,
  AccountType,
  DEFAULT_RATE_LIMITS,
  ACCOUNT_TYPE_MODIFIERS,
  REDIS_LUA_SCRIPTS
} from '../src/services/globalRateLimitCoordinator';
import { TwikitConfigManager } from '../src/config/twikit';

// Mock dependencies
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../src/lib/cache', () => ({
  cacheManager: {
    getRedisClient: jest.fn(() => ({
      ping: jest.fn().mockResolvedValue('PONG'),
      script: jest.fn().mockResolvedValue('sha123'),
      evalsha: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      zadd: jest.fn(),
      zrevrank: jest.fn(),
      zrem: jest.fn(),
      zcard: jest.fn().mockResolvedValue(0),
      xadd: jest.fn(),
      expire: jest.fn(),
      xrange: jest.fn().mockResolvedValue([]),
      publish: jest.fn(),
      duplicate: jest.fn(() => ({
        subscribe: jest.fn(),
        on: jest.fn()
      })),
      on: jest.fn(),
      pipeline: jest.fn(() => ({
        xadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([])
      }))
    }))
  }
}));

describe('GlobalRateLimitCoordinator - Validation Tests', () => {
  let configManager: TwikitConfigManager;

  beforeAll(() => {
    configManager = TwikitConfigManager.getInstance();
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
  });

  describe('Default Rate Limits Validation', () => {
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

  describe('Redis Lua Scripts Validation', () => {
    it('should have all required Lua scripts defined', () => {
      const expectedScripts = [
        'checkAndIncrement',
        'getStatus', 
        'acquireLock',
        'releaseLock'
      ];

      for (const scriptName of expectedScripts) {
        expect(REDIS_LUA_SCRIPTS[scriptName]).toBeDefined();
        expect(typeof REDIS_LUA_SCRIPTS[scriptName]).toBe('string');
        expect(REDIS_LUA_SCRIPTS[scriptName].length).toBeGreaterThan(0);
      }
    });

    it('should have valid Lua script syntax', () => {
      for (const [scriptName, scriptContent] of Object.entries(REDIS_LUA_SCRIPTS)) {
        // Basic syntax validation
        expect(scriptContent).toContain('local');
        expect(scriptContent).toContain('redis.call');
        expect(scriptContent).toContain('return');
      }
    });
  });

  describe('Class Structure Validation', () => {
    it('should create coordinator instance without initialization', () => {
      const coordinator = new GlobalRateLimitCoordinator(configManager);
      
      expect(coordinator).toBeDefined();
      expect(coordinator.getInstanceInfo).toBeDefined();
      expect(coordinator.checkRateLimit).toBeDefined();
      expect(coordinator.updateAccountType).toBeDefined();
      expect(coordinator.updateAccountHealth).toBeDefined();
      expect(coordinator.setCustomRateLimits).toBeDefined();
      expect(coordinator.checkActionAllowed).toBeDefined();
      expect(coordinator.startAccountWarming).toBeDefined();
      expect(coordinator.coordinateWithProxy).toBeDefined();
      expect(coordinator.emergencyOverride).toBeDefined();
      expect(coordinator.getAccountStatistics).toBeDefined();
      expect(coordinator.getGlobalStatistics).toBeDefined();
      expect(coordinator.healthCheck).toBeDefined();
      expect(coordinator.acquireDistributedLock).toBeDefined();
      expect(coordinator.releaseDistributedLock).toBeDefined();
      expect(coordinator.shutdown).toBeDefined();
    });

    it('should provide instance information before initialization', () => {
      const coordinator = new GlobalRateLimitCoordinator(configManager);
      const info = coordinator.getInstanceInfo();
      
      expect(info).toHaveProperty('instanceId');
      expect(info).toHaveProperty('initialized');
      expect(info).toHaveProperty('profilesLoaded');
      expect(info).toHaveProperty('activeQueues');
      expect(info).toHaveProperty('distributedLocks');
      expect(info).toHaveProperty('analyticsBufferSize');
      
      expect(info.initialized).toBe(false);
      expect(typeof info.instanceId).toBe('string');
      expect(info.instanceId.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Integration Validation', () => {
    it('should integrate with TwikitConfigManager', () => {
      const config = configManager.getRateLimitConfig();
      
      expect(config).toBeDefined();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('distributedCoordination');
      expect(config).toHaveProperty('queueProcessingInterval');
      expect(config).toHaveProperty('analyticsFlushInterval');
      expect(config).toHaveProperty('profileCacheTtl');
      expect(config).toHaveProperty('lockTtl');
      expect(config).toHaveProperty('defaultAccountType');
      expect(config).toHaveProperty('warmupDurationDays');
    });

    it('should have valid configuration values', () => {
      const config = configManager.getRateLimitConfig();
      
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.distributedCoordination).toBe('boolean');
      expect(typeof config.queueProcessingInterval).toBe('number');
      expect(typeof config.analyticsFlushInterval).toBe('number');
      expect(typeof config.profileCacheTtl).toBe('number');
      expect(typeof config.lockTtl).toBe('number');
      expect(typeof config.defaultAccountType).toBe('string');
      expect(typeof config.warmupDurationDays).toBe('number');
      
      expect(config.queueProcessingInterval).toBeGreaterThan(0);
      expect(config.analyticsFlushInterval).toBeGreaterThan(0);
      expect(config.profileCacheTtl).toBeGreaterThan(0);
      expect(config.lockTtl).toBeGreaterThan(0);
      expect(config.warmupDurationDays).toBeGreaterThan(0);
    });
  });

  describe('Implementation Completeness', () => {
    it('should have all required exports', () => {
      expect(GlobalRateLimitCoordinator).toBeDefined();
      expect(RateLimitAction).toBeDefined();
      expect(RateLimitPriority).toBeDefined();
      expect(AccountType).toBeDefined();
      expect(DEFAULT_RATE_LIMITS).toBeDefined();
      expect(ACCOUNT_TYPE_MODIFIERS).toBeDefined();
      expect(REDIS_LUA_SCRIPTS).toBeDefined();
    });

    it('should have comprehensive rate limit coverage', () => {
      // Verify that all common X/Twitter actions are covered
      const criticalActions = [
        RateLimitAction.POST_TWEET,
        RateLimitAction.LIKE_TWEET,
        RateLimitAction.RETWEET,
        RateLimitAction.FOLLOW_USER,
        RateLimitAction.SEND_DM
      ];

      for (const action of criticalActions) {
        const configs = DEFAULT_RATE_LIMITS[action];
        expect(configs.length).toBeGreaterThanOrEqual(2); // At least 2 time windows
        
        // Should have at least one short-term and one long-term limit
        const hasShortTerm = configs.some(c => c.window.includes('m'));
        const hasLongTerm = configs.some(c => c.window.includes('h') || c.window.includes('d'));
        
        expect(hasShortTerm).toBe(true);
        expect(hasLongTerm).toBe(true);
      }
    });
  });
});
