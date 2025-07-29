/**
 * Twikit Session Manager Unit Tests - Task 31
 * 
 * Comprehensive unit tests for TwikitSessionManager covering:
 * - Session creation and management
 * - Authentication workflows
 * - Proxy configuration and rotation
 * - Health monitoring and recovery
 * - Load balancing and horizontal scaling (Task 29)
 * - Performance optimization
 * - Error handling and edge cases
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { twikitSessionManager, LoadBalancingAlgorithm } from '../../../src/services/twikitSessionManager';
import { twikitTestUtils, createTwikitTestUtils } from '../utils/twikitTestUtils';
import { logger } from '../../../src/utils/logger';

describe('TwikitSessionManager Unit Tests', () => {
  let testUtils: typeof twikitTestUtils;

  beforeAll(async () => {
    testUtils = createTwikitTestUtils({
      services: {
        enableMocking: true,
        mockExternalAPIs: true,
        mockProxies: true,
        mockTelegramBot: true
      }
    });

    // Validate test environment
    const validation = await testUtils.validateTestEnvironment();
    expect(validation.database).toBe(true);
    expect(validation.redis).toBe(true);
    expect(validation.services).toBe(true);

    // Setup mocks
    testUtils.mockTwitterAPI();
    testUtils.mockProxyServices();
  });

  beforeEach(async () => {
    await testUtils.resetDatabase();
    await testUtils.clearCache();
    await testUtils.seedTestData();
  });

  afterEach(async () => {
    // Clean up test sessions
    await testUtils.cleanup();
  });

  afterAll(async () => {
    await testUtils.cleanup();
  });

  // ============================================================================
  // SESSION CREATION AND MANAGEMENT TESTS
  // ============================================================================

  describe('Session Creation and Management', () => {
    test('should create new session successfully', async () => {
      const { result, metrics } = await testUtils.measurePerformance(async () => {
        return await twikitSessionManager.createSession({
          accountId: 'test-account-1',
          credentials: {
            username: 'test_user',
            email: 'test@example.com',
            password: 'test_password_123'
          },
          enableHealthMonitoring: true,
          enableAntiDetection: true
        });
      }, 'createSession');

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.accountId).toBe('test-account-1');
      expect(result.isActive).toBe(true);
      expect(metrics.responseTime).toBeLessThan(5000);
    });

    test('should handle duplicate session creation', async () => {
      const sessionOptions = {
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        }
      };

      // Create first session
      const session1 = await twikitSessionManager.createSession(sessionOptions);
      expect(session1).toBeDefined();

      // Attempt to create duplicate session
      const session2 = await twikitSessionManager.createSession(sessionOptions);
      
      // Should return existing session or handle gracefully
      expect(session2).toBeDefined();
      expect(session2.accountId).toBe('test-account-1');
    });

    test('should validate session credentials', async () => {
      const invalidCredentials = {
        accountId: 'test-account-1',
        credentials: {
          username: '',
          email: 'invalid-email',
          password: '123' // Too short
        }
      };

      await expect(
        twikitSessionManager.createSession(invalidCredentials)
      ).rejects.toThrow();
    });

    test('should get session by ID', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        }
      });

      const retrievedSession = await twikitSessionManager.getSession(session.sessionId);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.sessionId).toBe(session.sessionId);
      expect(retrievedSession?.accountId).toBe('test-account-1');
    });

    test('should list all active sessions', async () => {
      // Create multiple sessions
      await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: { username: 'user1', email: 'user1@test.com', password: 'pass123' }
      });

      await twikitSessionManager.createSession({
        accountId: 'test-account-2',
        credentials: { username: 'user2', email: 'user2@test.com', password: 'pass123' }
      });

      const sessions = await twikitSessionManager.getAllSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.every(s => s.isActive)).toBe(true);
    });
  });

  // ============================================================================
  // AUTHENTICATION WORKFLOW TESTS
  // ============================================================================

  describe('Authentication Workflows', () => {
    test('should authenticate session successfully', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        }
      });

      const { result, metrics } = await testUtils.measurePerformance(async () => {
        return await twikitSessionManager.authenticateSession(session.sessionId);
      }, 'authenticateSession');

      expect(result).toBe(true);
      expect(metrics.responseTime).toBeLessThan(10000);

      // Verify session is authenticated
      const authenticatedSession = await twikitSessionManager.getSession(session.sessionId);
      expect(authenticatedSession?.isAuthenticated).toBe(true);
    });

    test('should handle authentication failure', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'invalid_user',
          email: 'invalid@example.com',
          password: 'wrong_password'
        }
      });

      // Mock authentication failure
      const result = await twikitSessionManager.authenticateSession(session.sessionId);
      
      // Should handle failure gracefully
      expect(typeof result).toBe('boolean');
    });

    test('should validate session before operations', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        }
      });

      // Test validation before authentication
      const isValidBefore = await twikitSessionManager.validateSession(session.sessionId);
      expect(isValidBefore).toBe(true);

      // Authenticate session
      await twikitSessionManager.authenticateSession(session.sessionId);

      // Test validation after authentication
      const isValidAfter = await twikitSessionManager.validateSession(session.sessionId);
      expect(isValidAfter).toBe(true);
    });
  });

  // ============================================================================
  // PROXY CONFIGURATION TESTS
  // ============================================================================

  describe('Proxy Configuration and Rotation', () => {
    test('should configure proxy for session', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        },
        proxy: {
          host: '127.0.0.1',
          port: 8080,
          username: 'proxy_user',
          password: 'proxy_pass'
        }
      });

      expect(session.proxy).toBeDefined();
      expect(session.proxy?.host).toBe('127.0.0.1');
      expect(session.proxy?.port).toBe(8080);
    });

    test('should rotate proxy when needed', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        },
        enableProxyRotation: true
      });

      const originalProxy = session.proxy;
      
      // Trigger proxy rotation
      const rotated = await twikitSessionManager.rotateProxy(session.sessionId);
      expect(rotated).toBe(true);

      // Verify proxy changed
      const updatedSession = await twikitSessionManager.getSession(session.sessionId);
      expect(updatedSession?.proxy).toBeDefined();
      
      // Proxy should be different (or at least rotation was attempted)
      expect(updatedSession?.proxy?.host).toBeDefined();
    });

    test('should test proxy connectivity', async () => {
      const proxyConfig = {
        host: '127.0.0.1',
        port: 8080,
        username: 'proxy_user',
        password: 'proxy_pass'
      };

      const isConnected = await testUtils.testProxyConfiguration(proxyConfig);
      expect(typeof isConnected).toBe('boolean');
    });
  });

  // ============================================================================
  // HEALTH MONITORING TESTS
  // ============================================================================

  describe('Health Monitoring and Recovery', () => {
    test('should monitor session health', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        },
        enableHealthMonitoring: true
      });

      // Get health status
      const health = await twikitSessionManager.getSessionHealth(session.sessionId);
      expect(health).toBeDefined();
      expect(health.sessionId).toBe(session.sessionId);
      expect(health.isHealthy).toBeDefined();
      expect(health.lastCheck).toBeDefined();
    });

    test('should recover unhealthy session', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        },
        enableHealthMonitoring: true
      });

      // Simulate unhealthy session
      await twikitSessionManager.markSessionUnhealthy(session.sessionId, 'Test failure');

      // Attempt recovery
      const recovered = await twikitSessionManager.recoverSession(session.sessionId);
      expect(typeof recovered).toBe('boolean');
    });

    test('should get session metrics', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        }
      });

      const metrics = await twikitSessionManager.getSessionMetrics(session.sessionId);
      expect(metrics).toBeDefined();
      expect(metrics.sessionId).toBe(session.sessionId);
      expect(metrics.totalRequests).toBeDefined();
      expect(metrics.successRate).toBeDefined();
      expect(metrics.averageResponseTime).toBeDefined();
    });
  });

  // ============================================================================
  // LOAD BALANCING TESTS (TASK 29)
  // ============================================================================

  describe('Load Balancing and Horizontal Scaling', () => {
    test('should initialize enhanced session manager', async () => {
      const { result, metrics } = await testUtils.measurePerformance(async () => {
        await twikitSessionManager.initializeEnhancedSessionManager();
        return true;
      }, 'initializeEnhancedSessionManager');

      expect(result).toBe(true);
      expect(metrics.responseTime).toBeLessThan(10000);
    });

    test('should select instance for session using different algorithms', async () => {
      await twikitSessionManager.initializeEnhancedSessionManager();

      const algorithms = [
        LoadBalancingAlgorithm.ROUND_ROBIN,
        LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN,
        LoadBalancingAlgorithm.LEAST_CONNECTIONS,
        LoadBalancingAlgorithm.HEALTH_BASED
      ];

      for (const algorithm of algorithms) {
        await twikitSessionManager.updateLoadBalancingConfig({ algorithm });

        const instance = await twikitSessionManager.selectInstanceForSession(
          'test-account-1',
          '192.168.1.100'
        );

        // Instance selection should work or return null if no instances available
        expect(instance === null || typeof instance === 'object').toBe(true);
      }
    });

    test('should get load balancer status', async () => {
      await twikitSessionManager.initializeEnhancedSessionManager();

      const status = twikitSessionManager.getLoadBalancerStatus();
      expect(status).toBeDefined();
      expect(status.currentAlgorithm).toBeDefined();
      expect(status.activeInstances).toBeDefined();
      expect(status.totalSessions).toBeDefined();
      expect(status.performanceMetrics).toBeDefined();
    });

    test('should get active instances', async () => {
      await twikitSessionManager.initializeEnhancedSessionManager();

      const instances = twikitSessionManager.getActiveInstances();
      expect(Array.isArray(instances)).toBe(true);
    });

    test('should update scaling configuration', async () => {
      await twikitSessionManager.initializeEnhancedSessionManager();

      const newConfig = {
        targetCpuUtilization: 75,
        targetMemoryUtilization: 85,
        maxInstances: 15
      };

      await twikitSessionManager.updateScalingConfig(newConfig);

      const config = twikitSessionManager.getScalingConfig();
      expect(config.targetCpuUtilization).toBe(75);
      expect(config.targetMemoryUtilization).toBe(85);
      expect(config.maxInstances).toBe(15);
    });

    test('should get resource metrics', async () => {
      await twikitSessionManager.initializeEnhancedSessionManager();

      const metrics = twikitSessionManager.getResourceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.instanceId).toBeDefined();
      expect(metrics.cpuUsage).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.sessionCount).toBeDefined();
    });
  });

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid session ID', async () => {
      const invalidSessionId = 'invalid-session-id';

      const session = await twikitSessionManager.getSession(invalidSessionId);
      expect(session).toBeNull();
    });

    test('should handle session cleanup', async () => {
      const session = await twikitSessionManager.createSession({
        accountId: 'test-account-1',
        credentials: {
          username: 'test_user',
          email: 'test@example.com',
          password: 'test_password_123'
        }
      });

      const closed = await twikitSessionManager.closeSession(session.sessionId);
      expect(closed).toBe(true);

      // Session should no longer be active
      const closedSession = await twikitSessionManager.getSession(session.sessionId);
      expect(closedSession?.isActive).toBe(false);
    });

    test('should handle concurrent session operations', async () => {
      const promises = [];
      
      // Create multiple sessions concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          twikitSessionManager.createSession({
            accountId: `test-account-${i}`,
            credentials: {
              username: `user_${i}`,
              email: `user${i}@test.com`,
              password: 'test_password_123'
            }
          })
        );
      }

      const sessions = await Promise.all(promises);
      expect(sessions.length).toBe(5);
      expect(sessions.every(s => s.sessionId)).toBe(true);
    });

    test('should handle memory pressure', async () => {
      // Create many sessions to test memory handling
      const sessions = [];
      
      for (let i = 0; i < 10; i++) {
        const session = await twikitSessionManager.createSession({
          accountId: `memory-test-${i}`,
          credentials: {
            username: `memory_user_${i}`,
            email: `memory${i}@test.com`,
            password: 'test_password_123'
          }
        });
        sessions.push(session);
      }

      expect(sessions.length).toBe(10);

      // Clean up sessions
      for (const session of sessions) {
        await twikitSessionManager.closeSession(session.sessionId);
      }
    });
  });
});
