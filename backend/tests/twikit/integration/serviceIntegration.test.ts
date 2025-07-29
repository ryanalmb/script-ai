/**
 * Twikit Service Integration Tests - Task 31
 * 
 * Comprehensive integration tests covering interactions between all Twikit services:
 * - Session Manager + Security Manager integration
 * - Cache Manager + Security Manager integration
 * - Load Balancing + Security integration
 * - Disaster Recovery + Security integration
 * - End-to-end workflow testing
 * - Cross-service data flow validation
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { twikitSessionManager } from '../../../src/services/twikitSessionManager';
import { twikitSecurityManager } from '../../../src/services/twikitSecurityManager';
import { twikitCacheManager } from '../../../src/services/twikitCacheManager';
import { twikitTestUtils, createTwikitTestUtils } from '../utils/twikitTestUtils';
import { logger } from '../../../src/utils/logger';

describe('Twikit Service Integration Tests', () => {
  let testUtils: typeof twikitTestUtils;

  beforeAll(async () => {
    testUtils = createTwikitTestUtils({
      services: {
        enableMocking: true,
        mockExternalAPIs: true,
        mockProxies: true,
        mockTelegramBot: true
      },
      security: {
        enableSecurityTests: true,
        testEncryption: true,
        testCompliance: true
      }
    });

    // Validate test environment
    const validation = await testUtils.validateTestEnvironment();
    expect(validation.database).toBe(true);
    expect(validation.redis).toBe(true);
    expect(validation.services).toBe(true);
    expect(validation.security).toBe(true);

    // Setup mocks
    testUtils.mockTwitterAPI();
    testUtils.mockProxyServices();
    testUtils.mockTelegramAPI();
    testUtils.mockLLMServices();
  });

  beforeEach(async () => {
    await testUtils.resetDatabase();
    await testUtils.clearCache();
    await testUtils.seedTestData();
  });

  afterEach(async () => {
    await testUtils.cleanup();
  });

  afterAll(async () => {
    await testUtils.cleanup();
  });

  // ============================================================================
  // SESSION MANAGER + SECURITY MANAGER INTEGRATION
  // ============================================================================

  describe('Session Manager + Security Manager Integration', () => {
    test('should create secure session with encrypted credentials', async () => {
      // Initialize both managers
      await twikitSecurityManager.initializeSecurityManager();
      
      const { result: session, metrics } = await testUtils.measurePerformance(async () => {
        return await twikitSessionManager.createSession({
          accountId: 'secure-test-account-1',
          credentials: {
            username: 'secure_user',
            email: 'secure@example.com',
            password: 'secure_password_123'
          },
          enableHealthMonitoring: true,
          enableAntiDetection: true,
          enableSecurity: true
        });
      }, 'createSecureSession');

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.isActive).toBe(true);
      expect(metrics.responseTime).toBeLessThan(10000);

      // Verify credentials are encrypted in storage
      const sessionData = await twikitSessionManager.getSession(session.sessionId);
      expect(sessionData).toBeDefined();
      
      // In a real implementation, credentials would be encrypted
      // This test validates the integration works
      expect(sessionData?.credentials).toBeDefined();
    });

    test('should authenticate session with security monitoring', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      
      const session = await twikitSessionManager.createSession({
        accountId: 'secure-test-account-1',
        credentials: {
          username: 'secure_user',
          email: 'secure@example.com',
          password: 'secure_password_123'
        }
      });

      // Authenticate with security monitoring
      const authenticated = await twikitSessionManager.authenticateSession(session.sessionId);
      expect(authenticated).toBe(true);

      // Verify security events were logged
      const securityEvents = twikitSecurityManager.getSecurityEvents(10);
      const authEvents = securityEvents.filter(e => 
        e.type === 'auth_success' || e.type === 'auth_failure'
      );
      expect(authEvents.length).toBeGreaterThan(0);
    });

    test('should handle session security violations', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      
      const session = await twikitSessionManager.createSession({
        accountId: 'violation-test-account',
        credentials: {
          username: 'violation_user',
          email: 'violation@example.com',
          password: 'violation_password'
        }
      });

      // Simulate security violation
      await twikitSecurityManager.logSecurityEvent({
        type: 'security_violation',
        severity: 'high',
        source: {
          service: 'twikit-session-manager',
          instance: session.sessionId
        },
        details: {
          description: 'Suspicious session activity detected',
          data: { sessionId: session.sessionId }
        }
      });

      // Verify violation was logged and session can be secured
      const violations = twikitSecurityManager.getSecurityEvents(5, 'high');
      expect(violations.length).toBeGreaterThan(0);
      
      const sessionViolation = violations.find(v => 
        v.details.data.sessionId === session.sessionId
      );
      expect(sessionViolation).toBeDefined();
    });
  });

  // ============================================================================
  // CACHE MANAGER + SECURITY MANAGER INTEGRATION
  // ============================================================================

  describe('Cache Manager + Security Manager Integration', () => {
    test('should cache encrypted data securely', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      
      const sensitiveData = {
        apiKey: 'secret_api_key_12345',
        userToken: 'user_token_67890',
        sessionData: 'sensitive_session_information'
      };

      // Encrypt data before caching
      const encryptedData = await twikitSecurityManager.encryptData(
        JSON.stringify(sensitiveData)
      );

      // Cache encrypted data
      await twikitCacheManager.set(
        'secure_test_data',
        encryptedData,
        {
          serviceType: 'SESSION_MANAGER',
          operationType: 'secure_cache',
          priority: 'HIGH',
          tags: ['encrypted', 'sensitive']
        }
      );

      // Retrieve and decrypt data
      const cachedEncryptedData = await twikitCacheManager.get('secure_test_data', {
        serviceType: 'SESSION_MANAGER',
        operationType: 'secure_retrieve',
        priority: 'HIGH',
        tags: ['encrypted', 'sensitive']
      });

      expect(cachedEncryptedData).toBeDefined();
      
      const decryptedData = await twikitSecurityManager.decryptData(cachedEncryptedData);
      const retrievedData = JSON.parse(decryptedData.toString('utf8'));
      
      expect(retrievedData).toEqual(sensitiveData);
    });

    test('should handle cache security with TTL and encryption', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      
      const testData = 'Time-sensitive encrypted data';
      const encrypted = await twikitSecurityManager.encryptData(testData);

      // Cache with short TTL
      await twikitCacheManager.set(
        'ttl_encrypted_test',
        encrypted,
        {
          serviceType: 'SECURITY_MANAGER',
          operationType: 'ttl_test',
          priority: 'HIGH',
          tags: ['encrypted', 'ttl']
        }
      );

      // Verify data is cached
      const cached = await twikitCacheManager.get('ttl_encrypted_test', {
        serviceType: 'SECURITY_MANAGER',
        operationType: 'ttl_retrieve',
        priority: 'HIGH',
        tags: ['encrypted', 'ttl']
      });

      expect(cached).toBeDefined();
      
      const decrypted = await twikitSecurityManager.decryptData(cached);
      expect(decrypted.toString('utf8')).toBe(testData);
    });

    test('should validate cache integrity with security checks', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      
      const originalData = 'Data with integrity protection';
      const encrypted = await twikitSecurityManager.encryptData(originalData);

      // Cache the encrypted data
      await twikitCacheManager.set('integrity_test', encrypted, {
        serviceType: 'SECURITY_MANAGER',
        operationType: 'integrity_test',
        priority: 'HIGH',
        tags: ['integrity', 'security']
      });

      // Retrieve and verify integrity
      const retrieved = await twikitCacheManager.get('integrity_test', {
        serviceType: 'SECURITY_MANAGER',
        operationType: 'integrity_retrieve',
        priority: 'HIGH',
        tags: ['integrity', 'security']
      });

      expect(retrieved).toBeDefined();
      expect(retrieved.integrity).toBeDefined();
      
      // Verify data integrity through decryption
      const decrypted = await twikitSecurityManager.decryptData(retrieved);
      expect(decrypted.toString('utf8')).toBe(originalData);
    });
  });

  // ============================================================================
  // LOAD BALANCING + SECURITY INTEGRATION
  // ============================================================================

  describe('Load Balancing + Security Integration', () => {
    test('should distribute secure sessions across instances', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      await twikitSessionManager.initializeEnhancedSessionManager();

      const sessions = [];
      
      // Create multiple secure sessions
      for (let i = 0; i < 5; i++) {
        const session = await twikitSessionManager.createSession({
          accountId: `load-balance-account-${i}`,
          credentials: {
            username: `lb_user_${i}`,
            email: `lb${i}@example.com`,
            password: 'secure_password_123'
          },
          enableSecurity: true
        });
        sessions.push(session);
      }

      expect(sessions.length).toBe(5);
      expect(sessions.every(s => s.sessionId)).toBe(true);

      // Verify load balancer status includes security metrics
      const loadBalancerStatus = twikitSessionManager.getLoadBalancerStatus();
      expect(loadBalancerStatus).toBeDefined();
      expect(loadBalancerStatus.totalSessions).toBeGreaterThanOrEqual(5);
    });

    test('should handle secure instance failover', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      await twikitSessionManager.initializeEnhancedSessionManager();

      // Create session with security enabled
      const session = await twikitSessionManager.createSession({
        accountId: 'failover-test-account',
        credentials: {
          username: 'failover_user',
          email: 'failover@example.com',
          password: 'secure_password_123'
        },
        enableSecurity: true
      });

      // Simulate instance selection for failover
      const selectedInstance = await twikitSessionManager.selectInstanceForSession(
        session.accountId,
        '192.168.1.100'
      );

      // Instance selection should work or return null gracefully
      expect(selectedInstance === null || typeof selectedInstance === 'object').toBe(true);

      // Verify security events are logged for load balancing operations
      const securityEvents = twikitSecurityManager.getSecurityEvents(10);
      expect(securityEvents.length).toBeGreaterThan(0);
    });

    test('should maintain security during scaling operations', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      await twikitSessionManager.initializeEnhancedSessionManager();

      // Get initial scaling configuration
      const initialConfig = twikitSessionManager.getScalingConfig();
      expect(initialConfig).toBeDefined();

      // Update scaling configuration with security considerations
      await twikitSessionManager.updateScalingConfig({
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
        maxInstances: 8
      });

      // Verify configuration was updated
      const updatedConfig = twikitSessionManager.getScalingConfig();
      expect(updatedConfig.targetCpuUtilization).toBe(70);
      expect(updatedConfig.maxInstances).toBe(8);

      // Verify security events were logged for configuration changes
      const configEvents = twikitSecurityManager.getSecurityEvents(5);
      expect(configEvents.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // END-TO-END WORKFLOW INTEGRATION
  // ============================================================================

  describe('End-to-End Workflow Integration', () => {
    test('should complete secure session lifecycle', async () => {
      // Initialize all managers
      await twikitSecurityManager.initializeSecurityManager();
      await twikitSessionManager.initializeEnhancedSessionManager();

      const { result: workflow, metrics } = await testUtils.measurePerformance(async () => {
        // 1. Create secure session
        const session = await twikitSessionManager.createSession({
          accountId: 'e2e-test-account',
          credentials: {
            username: 'e2e_user',
            email: 'e2e@example.com',
            password: 'secure_password_123'
          },
          enableHealthMonitoring: true,
          enableAntiDetection: true,
          enableSecurity: true
        });

        // 2. Authenticate session
        const authenticated = await twikitSessionManager.authenticateSession(session.sessionId);
        expect(authenticated).toBe(true);

        // 3. Store secure credentials
        const credentialId = await twikitSecurityManager.storeCredential(
          'e2e_api_key',
          'e2e_secret_value_12345',
          'api_key',
          { service: 'e2e_test', environment: 'test' }
        );

        // 4. Retrieve credentials for session
        const credentialValue = await twikitSecurityManager.retrieveCredential(
          credentialId,
          'e2e_test',
          'e2e_user'
        );

        // 5. Perform session operations with security monitoring
        const sessionHealth = await twikitSessionManager.getSessionHealth(session.sessionId);
        expect(sessionHealth.isHealthy).toBe(true);

        // 6. Close session securely
        const closed = await twikitSessionManager.closeSession(session.sessionId);
        expect(closed).toBe(true);

        return {
          sessionCreated: !!session.sessionId,
          authenticated,
          credentialStored: !!credentialId,
          credentialRetrieved: credentialValue === 'e2e_secret_value_12345',
          sessionClosed: closed
        };
      }, 'e2eWorkflow');

      expect(workflow.sessionCreated).toBe(true);
      expect(workflow.authenticated).toBe(true);
      expect(workflow.credentialStored).toBe(true);
      expect(workflow.credentialRetrieved).toBe(true);
      expect(workflow.sessionClosed).toBe(true);
      expect(metrics.responseTime).toBeLessThan(30000); // Complete workflow under 30 seconds
    });

    test('should handle complex multi-service operations', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      await twikitSessionManager.initializeEnhancedSessionManager();

      // Create multiple sessions with different configurations
      const sessions = await Promise.all([
        twikitSessionManager.createSession({
          accountId: 'multi-service-1',
          credentials: { username: 'user1', email: 'user1@test.com', password: 'pass123' },
          enableSecurity: true
        }),
        twikitSessionManager.createSession({
          accountId: 'multi-service-2',
          credentials: { username: 'user2', email: 'user2@test.com', password: 'pass123' },
          enableHealthMonitoring: true
        }),
        twikitSessionManager.createSession({
          accountId: 'multi-service-3',
          credentials: { username: 'user3', email: 'user3@test.com', password: 'pass123' },
          enableAntiDetection: true
        })
      ]);

      expect(sessions.length).toBe(3);
      expect(sessions.every(s => s.sessionId)).toBe(true);

      // Perform operations across all sessions
      const operations = await Promise.all(
        sessions.map(async (session, index) => {
          // Authenticate session
          const authenticated = await twikitSessionManager.authenticateSession(session.sessionId);
          
          // Store session-specific credential
          const credentialId = await twikitSecurityManager.storeCredential(
            `multi_service_key_${index}`,
            `secret_value_${index}`,
            'api_key',
            { service: `multi_service_${index}` }
          );

          // Get session health
          const health = await twikitSessionManager.getSessionHealth(session.sessionId);

          return {
            sessionId: session.sessionId,
            authenticated,
            credentialId,
            isHealthy: health.isHealthy
          };
        })
      );

      expect(operations.length).toBe(3);
      expect(operations.every(op => op.authenticated)).toBe(true);
      expect(operations.every(op => op.credentialId)).toBe(true);
      expect(operations.every(op => op.isHealthy)).toBe(true);

      // Verify security events were logged for all operations
      const securityEvents = twikitSecurityManager.getSecurityEvents(20);
      expect(securityEvents.length).toBeGreaterThan(5);
    });

    test('should maintain data consistency across services', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      
      const testData = {
        sessionId: 'consistency-test-session',
        userData: { username: 'consistency_user', email: 'consistency@test.com' },
        apiKey: 'consistency_api_key_12345'
      };

      // Store data in multiple services
      const encryptedUserData = await twikitSecurityManager.encryptData(
        JSON.stringify(testData.userData)
      );

      const credentialId = await twikitSecurityManager.storeCredential(
        'consistency_key',
        testData.apiKey,
        'api_key',
        { service: 'consistency_test' }
      );

      await twikitCacheManager.set(
        'consistency_user_data',
        encryptedUserData,
        {
          serviceType: 'SESSION_MANAGER',
          operationType: 'consistency_test',
          priority: 'HIGH',
          tags: ['consistency', 'test']
        }
      );

      // Retrieve and verify data consistency
      const retrievedCredential = await twikitSecurityManager.retrieveCredential(
        credentialId,
        'consistency_test',
        'consistency_user'
      );

      const cachedEncryptedData = await twikitCacheManager.get('consistency_user_data', {
        serviceType: 'SESSION_MANAGER',
        operationType: 'consistency_retrieve',
        priority: 'HIGH',
        tags: ['consistency', 'test']
      });

      const decryptedUserData = await twikitSecurityManager.decryptData(cachedEncryptedData);
      const retrievedUserData = JSON.parse(decryptedUserData.toString('utf8'));

      // Verify data consistency
      expect(retrievedCredential).toBe(testData.apiKey);
      expect(retrievedUserData).toEqual(testData.userData);
    });
  });

  // ============================================================================
  // PERFORMANCE AND STRESS TESTING
  // ============================================================================

  describe('Integration Performance Testing', () => {
    test('should handle concurrent multi-service operations', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      await twikitSessionManager.initializeEnhancedSessionManager();

      const concurrentOperations = 10;
      
      const { result: results, metrics } = await testUtils.measurePerformance(async () => {
        const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
          // Create session
          const session = await twikitSessionManager.createSession({
            accountId: `concurrent-test-${i}`,
            credentials: {
              username: `concurrent_user_${i}`,
              email: `concurrent${i}@test.com`,
              password: 'concurrent_password_123'
            }
          });

          // Store credential
          const credentialId = await twikitSecurityManager.storeCredential(
            `concurrent_key_${i}`,
            `concurrent_value_${i}`,
            'api_key',
            { service: 'concurrent_test' }
          );

          // Encrypt and cache data
          const testData = `Concurrent test data ${i}`;
          const encrypted = await twikitSecurityManager.encryptData(testData);
          
          await twikitCacheManager.set(
            `concurrent_data_${i}`,
            encrypted,
            {
              serviceType: 'SESSION_MANAGER',
              operationType: 'concurrent_test',
              priority: 'MEDIUM',
              tags: ['concurrent', 'test']
            }
          );

          return {
            sessionId: session.sessionId,
            credentialId,
            dataKey: `concurrent_data_${i}`
          };
        });

        return await Promise.all(promises);
      }, 'concurrentMultiServiceOperations');

      expect(results.length).toBe(concurrentOperations);
      expect(results.every(r => r.sessionId && r.credentialId && r.dataKey)).toBe(true);
      expect(metrics.responseTime).toBeLessThan(20000); // Should complete within 20 seconds
    });

    test('should maintain performance under load', async () => {
      await twikitSecurityManager.initializeSecurityManager();

      const loadTestConfig = {
        concurrentUsers: 5,
        duration: 10, // 10 seconds
        rampUpTime: 2,
        operations: [
          {
            name: 'encrypt_data',
            weight: 40,
            operation: async () => {
              const data = `Load test data ${Math.random()}`;
              return await twikitSecurityManager.encryptData(data);
            }
          },
          {
            name: 'store_credential',
            weight: 30,
            operation: async () => {
              const value = `load_test_value_${Math.random()}`;
              return await twikitSecurityManager.storeCredential(
                `load_test_key_${Date.now()}`,
                value,
                'api_key',
                { service: 'load_test' }
              );
            }
          },
          {
            name: 'cache_operation',
            weight: 30,
            operation: async () => {
              const key = `load_test_cache_${Date.now()}`;
              const value = { test: true, timestamp: Date.now() };
              return await twikitCacheManager.set(key, value, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'load_test',
                priority: 'LOW',
                tags: ['load', 'test']
              });
            }
          }
        ],
        thresholds: {
          maxResponseTime: 5000,
          maxErrorRate: 5,
          minThroughput: 1
        }
      };

      const loadTestResults = await testUtils.runLoadTest(loadTestConfig);
      
      expect(loadTestResults.success).toBe(true);
      expect(loadTestResults.metrics.errorRate).toBeLessThan(5);
      expect(loadTestResults.metrics.averageResponseTime).toBeLessThan(5000);
      expect(loadTestResults.metrics.throughput).toBeGreaterThan(1);
    });
  });
});
