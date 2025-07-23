/**
 * Enterprise RealXApiClient Integration Test
 * Tests the enhanced RealXApiClient with comprehensive Twikit integration
 */

import { RealXApiClient, XAccountCredentials } from '../src/services/realXApiClient';
import { TwikitSessionManager } from '../src/services/twikitSessionManager';
import { ProxyRotationManager } from '../src/services/proxyRotationManager';
import { TwikitConfigManager } from '../src/config/twikit';
import { TwikitError, TwikitErrorType } from '../src/errors/enterpriseErrorFramework';

// Mock dependencies
jest.mock('../src/utils/logger');
jest.mock('../src/lib/cache');
jest.mock('../src/lib/prisma');

describe('RealXApiClient Enterprise Integration', () => {
  let realXApiClient: RealXApiClient;
  let credentials: XAccountCredentials;
  const accountId = 'test-enterprise-account';

  beforeEach(() => {
    credentials = {
      username: 'test_user',
      email: 'test@example.com',
      password: 'test_password'
    };

    realXApiClient = new RealXApiClient(accountId, credentials);
  });

  afterEach(async () => {
    await realXApiClient.cleanup();
  });

  describe('Enterprise Infrastructure Integration', () => {
    it('should initialize with enterprise Twikit infrastructure', () => {
      expect(realXApiClient).toBeDefined();
      
      // Check that enterprise components are initialized
      const metrics = realXApiClient.getSessionMetrics();
      expect(metrics.accountId).toBe(accountId);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.sessionActive).toBe(false);
    });

    it('should provide session metrics', () => {
      const metrics = realXApiClient.getSessionMetrics();
      
      expect(metrics).toHaveProperty('sessionId');
      expect(metrics).toHaveProperty('accountId');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('lastActivity');
      expect(metrics).toHaveProperty('currentProxy');
      expect(metrics).toHaveProperty('sessionActive');
      
      expect(metrics.accountId).toBe(accountId);
      expect(typeof metrics.successRate).toBe('number');
    });

    it('should provide proxy statistics', () => {
      const proxyStats = realXApiClient.getProxyStatistics();
      
      expect(proxyStats).toHaveProperty('totalProxies');
      expect(proxyStats).toHaveProperty('activeProxies');
      expect(proxyStats).toHaveProperty('healthyProxies');
      expect(proxyStats).toHaveProperty('totalRequests');
      expect(proxyStats).toHaveProperty('successfulRequests');
      expect(proxyStats).toHaveProperty('averageResponseTime');
      
      expect(typeof proxyStats.totalProxies).toBe('number');
      expect(typeof proxyStats.successRate).toBe('number');
    });
  });

  describe('Session Management', () => {
    it('should handle session refresh', async () => {
      const refreshResult = await realXApiClient.refreshSession();
      
      // In test environment without actual credentials, this should return false
      // In production with valid credentials, this would return true
      expect(typeof refreshResult).toBe('boolean');
    });

    it('should handle cleanup gracefully', async () => {
      await expect(realXApiClient.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw TwikitError for authentication required', async () => {
      // Try to perform action without authentication
      await expect(realXApiClient.postTweet({ text: 'Test tweet' }))
        .rejects
        .toThrow(TwikitError);
      
      try {
        await realXApiClient.postTweet({ text: 'Test tweet' });
      } catch (error) {
        expect(error).toBeInstanceOf(TwikitError);
        expect((error as TwikitError).code).toBe(TwikitErrorType.AUTHENTICATION_REQUIRED);
      }
    });

    it('should throw TwikitError for like tweet without authentication', async () => {
      await expect(realXApiClient.likeTweet('123456789'))
        .rejects
        .toThrow(TwikitError);
    });

    it('should throw TwikitError for follow user without authentication', async () => {
      await expect(realXApiClient.followUser('test_user'))
        .rejects
        .toThrow(TwikitError);
    });

    it('should throw TwikitError for send DM without authentication', async () => {
      await expect(realXApiClient.sendDirectMessage('test_user', 'Hello'))
        .rejects
        .toThrow(TwikitError);
    });
  });

  describe('Account Health Check', () => {
    it('should check account health', async () => {
      const healthResult = await realXApiClient.checkAccountHealth();
      
      expect(healthResult).toHaveProperty('healthy');
      expect(healthResult).toHaveProperty('status');
      expect(healthResult).toHaveProperty('message');
      
      expect(typeof healthResult.healthy).toBe('boolean');
      expect(typeof healthResult.status).toBe('string');
    });
  });

  describe('Search and Profile Operations', () => {
    it('should handle search tweets without authentication gracefully', async () => {
      await expect(realXApiClient.searchTweets('test query'))
        .rejects
        .toThrow(TwikitError);
    });

    it('should handle get user profile without authentication gracefully', async () => {
      await expect(realXApiClient.getUserProfile('test_user'))
        .rejects
        .toThrow(TwikitError);
    });

    it('should handle get tweet by ID without authentication gracefully', async () => {
      await expect(realXApiClient.getTweetById('123456789'))
        .rejects
        .toThrow(TwikitError);
    });
  });

  describe('Configuration Integration', () => {
    it('should use TwikitConfigManager settings', () => {
      const configManager = TwikitConfigManager.getInstance();
      const config = configManager.config;
      
      expect(config).toBeDefined();
      expect(config.proxy).toBeDefined();
      expect(config.session).toBeDefined();
      expect(config.antiDetection).toBeDefined();
      expect(config.retry).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics correctly', () => {
      const initialMetrics = realXApiClient.getSessionMetrics();
      
      expect(initialMetrics.totalRequests).toBe(0);
      expect(initialMetrics.successfulRequests).toBe(0);
      expect(initialMetrics.failedRequests).toBe(0);
      expect(initialMetrics.averageResponseTime).toBe(0);
      expect(initialMetrics.lastActivity).toBeNull();
    });

    it('should provide proxy statistics', () => {
      const proxyStats = realXApiClient.getProxyStatistics();
      
      // Should return valid statistics structure
      expect(typeof proxyStats.totalProxies).toBe('number');
      expect(typeof proxyStats.activeProxies).toBe('number');
      expect(typeof proxyStats.healthyProxies).toBe('number');
      expect(proxyStats.totalProxies).toBeGreaterThanOrEqual(0);
      expect(proxyStats.activeProxies).toBeGreaterThanOrEqual(0);
      expect(proxyStats.healthyProxies).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain all original method signatures', () => {
      // Verify all original methods exist
      expect(typeof realXApiClient.authenticate).toBe('function');
      expect(typeof realXApiClient.postTweet).toBe('function');
      expect(typeof realXApiClient.likeTweet).toBe('function');
      expect(typeof realXApiClient.followUser).toBe('function');
      expect(typeof realXApiClient.unfollowUser).toBe('function');
      expect(typeof realXApiClient.retweetTweet).toBe('function');
      expect(typeof realXApiClient.replyToTweet).toBe('function');
      expect(typeof realXApiClient.getTweetById).toBe('function');
      expect(typeof realXApiClient.sendDirectMessage).toBe('function');
      expect(typeof realXApiClient.searchTweets).toBe('function');
      expect(typeof realXApiClient.getUserProfile).toBe('function');
      expect(typeof realXApiClient.checkAccountHealth).toBe('function');
    });

    it('should provide new enterprise methods', () => {
      // Verify new enterprise methods exist
      expect(typeof realXApiClient.getSessionMetrics).toBe('function');
      expect(typeof realXApiClient.getProxyStatistics).toBe('function');
      expect(typeof realXApiClient.cleanup).toBe('function');
      expect(typeof realXApiClient.refreshSession).toBe('function');
    });
  });
});
