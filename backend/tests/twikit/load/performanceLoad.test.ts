/**
 * Twikit Performance Load Tests - Task 31
 * 
 * Comprehensive load testing for all Twikit services covering:
 * - Session management under high load
 * - Security operations performance testing
 * - Cache performance and throughput testing
 * - Load balancing efficiency testing
 * - Memory and CPU usage validation
 * - Concurrent user simulation
 * - Stress testing and breaking point analysis
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { twikitSessionManager } from '../../../src/services/twikitSessionManager';
import { twikitSecurityManager } from '../../../src/services/twikitSecurityManager';
import { twikitCacheManager } from '../../../src/services/twikitCacheManager';
import { twikitTestUtils, createTwikitTestUtils, TwikitLoadTestConfig } from '../utils/twikitTestUtils';
import { logger } from '../../../src/utils/logger';

describe('Twikit Performance Load Tests', () => {
  let testUtils: typeof twikitTestUtils;

  beforeAll(async () => {
    testUtils = createTwikitTestUtils({
      performance: {
        enableProfiling: true,
        memoryThreshold: 500 * 1024 * 1024, // 500MB for load testing
        responseTimeThreshold: 10000 // 10 seconds for load testing
      },
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

    // Setup mocks for load testing
    testUtils.mockTwitterAPI();
    testUtils.mockProxyServices();
    testUtils.mockTelegramAPI();
    testUtils.mockLLMServices();

    // Initialize services for load testing
    await twikitSecurityManager.initializeSecurityManager();
    await twikitSessionManager.initializeEnhancedSessionManager();
  });

  beforeEach(async () => {
    await testUtils.clearCache();
  });

  afterEach(async () => {
    // Clean up after each test to prevent memory leaks
    await testUtils.cleanup();
  });

  afterAll(async () => {
    await testUtils.cleanup();
  });

  // ============================================================================
  // SESSION MANAGEMENT LOAD TESTS
  // ============================================================================

  describe('Session Management Load Tests', () => {
    test('should handle high concurrent session creation', async () => {
      const loadTestConfig: TwikitLoadTestConfig = {
        concurrentUsers: 20,
        duration: 30, // 30 seconds
        rampUpTime: 5,
        operations: [
          {
            name: 'create_session',
            weight: 100,
            operation: async () => {
              const randomId = Math.floor(Math.random() * 10000);
              return await twikitSessionManager.createSession({
                accountId: `load-test-account-${randomId}`,
                credentials: {
                  username: `load_user_${randomId}`,
                  email: `load${randomId}@test.com`,
                  password: 'load_test_password_123'
                },
                enableHealthMonitoring: true
              });
            }
          }
        ],
        thresholds: {
          maxResponseTime: 5000,
          maxErrorRate: 5,
          minThroughput: 2
        }
      };

      const results = await testUtils.runLoadTest(loadTestConfig);
      
      expect(results.success).toBe(true);
      expect(results.metrics.errorRate).toBeLessThan(5);
      expect(results.metrics.averageResponseTime).toBeLessThan(5000);
      expect(results.metrics.throughput).toBeGreaterThan(2);

      logger.info('Session creation load test results', results.metrics);
    });

    test('should handle mixed session operations under load', async () => {
      // Pre-create some sessions for operations
      const preSessions = [];
      for (let i = 0; i < 10; i++) {
        const session = await twikitSessionManager.createSession({
          accountId: `pre-session-${i}`,
          credentials: {
            username: `pre_user_${i}`,
            email: `pre${i}@test.com`,
            password: 'pre_password_123'
          }
        });
        preSessions.push(session);
      }

      const loadTestConfig: TwikitLoadTestConfig = {
        concurrentUsers: 15,
        duration: 25,
        rampUpTime: 3,
        operations: [
          {
            name: 'create_session',
            weight: 30,
            operation: async () => {
              const randomId = Math.floor(Math.random() * 10000);
              return await twikitSessionManager.createSession({
                accountId: `mixed-load-${randomId}`,
                credentials: {
                  username: `mixed_user_${randomId}`,
                  email: `mixed${randomId}@test.com`,
                  password: 'mixed_password_123'
                }
              });
            }
          },
          {
            name: 'authenticate_session',
            weight: 25,
            operation: async () => {
              const randomSession = preSessions[Math.floor(Math.random() * preSessions.length)];
              return await twikitSessionManager.authenticateSession(randomSession.sessionId);
            }
          },
          {
            name: 'get_session',
            weight: 25,
            operation: async () => {
              const randomSession = preSessions[Math.floor(Math.random() * preSessions.length)];
              return await twikitSessionManager.getSession(randomSession.sessionId);
            }
          },
          {
            name: 'get_session_health',
            weight: 20,
            operation: async () => {
              const randomSession = preSessions[Math.floor(Math.random() * preSessions.length)];
              return await twikitSessionManager.getSessionHealth(randomSession.sessionId);
            }
          }
        ],
        thresholds: {
          maxResponseTime: 3000,
          maxErrorRate: 3,
          minThroughput: 3
        }
      };

      const results = await testUtils.runLoadTest(loadTestConfig);
      
      expect(results.success).toBe(true);
      expect(results.metrics.errorRate).toBeLessThan(3);
      expect(results.metrics.throughput).toBeGreaterThan(3);

      logger.info('Mixed session operations load test results', results.metrics);
    });

    test('should maintain performance with session cleanup', async () => {
      const { result: cleanupResults, metrics } = await testUtils.measurePerformance(async () => {
        const sessions = [];
        
        // Create many sessions
        for (let i = 0; i < 50; i++) {
          const session = await twikitSessionManager.createSession({
            accountId: `cleanup-test-${i}`,
            credentials: {
              username: `cleanup_user_${i}`,
              email: `cleanup${i}@test.com`,
              password: 'cleanup_password_123'
            }
          });
          sessions.push(session);
        }

        // Close all sessions
        const closePromises = sessions.map(session => 
          twikitSessionManager.closeSession(session.sessionId)
        );
        
        const closeResults = await Promise.all(closePromises);
        
        return {
          sessionsCreated: sessions.length,
          sessionsClosed: closeResults.filter(Boolean).length
        };
      }, 'sessionCleanupLoad');

      expect(cleanupResults.sessionsCreated).toBe(50);
      expect(cleanupResults.sessionsClosed).toBe(50);
      expect(metrics.responseTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  // ============================================================================
  // SECURITY OPERATIONS LOAD TESTS
  // ============================================================================

  describe('Security Operations Load Tests', () => {
    test('should handle high-volume encryption operations', async () => {
      const loadTestConfig: TwikitLoadTestConfig = {
        concurrentUsers: 25,
        duration: 20,
        rampUpTime: 3,
        operations: [
          {
            name: 'encrypt_decrypt_cycle',
            weight: 100,
            operation: async () => {
              const testData = `Load test encryption data ${Math.random()} ${Date.now()}`;
              const encrypted = await twikitSecurityManager.encryptData(testData);
              const decrypted = await twikitSecurityManager.decryptData(encrypted);
              return decrypted.toString('utf8') === testData;
            }
          }
        ],
        thresholds: {
          maxResponseTime: 2000,
          maxErrorRate: 2,
          minThroughput: 5
        }
      };

      const results = await testUtils.runLoadTest(loadTestConfig);
      
      expect(results.success).toBe(true);
      expect(results.metrics.errorRate).toBeLessThan(2);
      expect(results.metrics.averageResponseTime).toBeLessThan(2000);
      expect(results.metrics.throughput).toBeGreaterThan(5);

      logger.info('Encryption load test results', results.metrics);
    });

    test('should handle concurrent credential operations', async () => {
      const loadTestConfig: TwikitLoadTestConfig = {
        concurrentUsers: 15,
        duration: 25,
        rampUpTime: 4,
        operations: [
          {
            name: 'store_credential',
            weight: 40,
            operation: async () => {
              const randomId = Math.floor(Math.random() * 100000);
              return await twikitSecurityManager.storeCredential(
                `load_test_key_${randomId}`,
                `load_test_value_${randomId}_${Date.now()}`,
                'api_key',
                { service: 'load_test', environment: 'test' }
              );
            }
          },
          {
            name: 'retrieve_credential',
            weight: 40,
            operation: async () => {
              // Store a credential first, then retrieve it
              const randomId = Math.floor(Math.random() * 100000);
              const credentialId = await twikitSecurityManager.storeCredential(
                `retrieve_test_${randomId}`,
                `retrieve_value_${randomId}`,
                'api_key',
                { service: 'load_test' }
              );
              
              return await twikitSecurityManager.retrieveCredential(
                credentialId,
                'load_test',
                'load_test_user'
              );
            }
          },
          {
            name: 'get_vault_status',
            weight: 20,
            operation: async () => {
              return twikitSecurityManager.getCredentialVaultStatus();
            }
          }
        ],
        thresholds: {
          maxResponseTime: 3000,
          maxErrorRate: 3,
          minThroughput: 3
        }
      };

      const results = await testUtils.runLoadTest(loadTestConfig);
      
      expect(results.success).toBe(true);
      expect(results.metrics.errorRate).toBeLessThan(3);
      expect(results.metrics.throughput).toBeGreaterThan(3);

      logger.info('Credential operations load test results', results.metrics);
    });

    test('should maintain security event logging performance', async () => {
      const loadTestConfig: TwikitLoadTestConfig = {
        concurrentUsers: 20,
        duration: 15,
        rampUpTime: 2,
        operations: [
          {
            name: 'log_security_event',
            weight: 100,
            operation: async () => {
              const eventTypes = ['auth_success', 'auth_failure', 'credential_access', 'security_violation'];
              const severities = ['low', 'medium', 'high'];
              
              return await twikitSecurityManager.logSecurityEvent({
                type: eventTypes[Math.floor(Math.random() * eventTypes.length)] as any,
                severity: severities[Math.floor(Math.random() * severities.length)] as any,
                source: {
                  service: 'load_test_service',
                  instance: `load_test_instance_${Math.floor(Math.random() * 10)}`,
                  user: `load_test_user_${Math.floor(Math.random() * 100)}`,
                  ip: `192.168.1.${Math.floor(Math.random() * 255)}`
                },
                details: {
                  description: `Load test security event ${Date.now()}`,
                  data: { loadTest: true, timestamp: Date.now() }
                }
              });
            }
          }
        ],
        thresholds: {
          maxResponseTime: 1000,
          maxErrorRate: 1,
          minThroughput: 10
        }
      };

      const results = await testUtils.runLoadTest(loadTestConfig);
      
      expect(results.success).toBe(true);
      expect(results.metrics.errorRate).toBeLessThan(1);
      expect(results.metrics.averageResponseTime).toBeLessThan(1000);
      expect(results.metrics.throughput).toBeGreaterThan(10);

      // Verify events were logged
      const events = twikitSecurityManager.getSecurityEvents(100);
      expect(events.length).toBeGreaterThan(50);

      logger.info('Security event logging load test results', results.metrics);
    });
  });

  // ============================================================================
  // CACHE PERFORMANCE LOAD TESTS
  // ============================================================================

  describe('Cache Performance Load Tests', () => {
    test('should handle high-throughput cache operations', async () => {
      const loadTestConfig: TwikitLoadTestConfig = {
        concurrentUsers: 30,
        duration: 20,
        rampUpTime: 3,
        operations: [
          {
            name: 'cache_set',
            weight: 40,
            operation: async () => {
              const key = `load_test_cache_${Math.random()}_${Date.now()}`;
              const value = {
                data: `Cache load test data ${Math.random()}`,
                timestamp: Date.now(),
                metadata: { test: true, iteration: Math.floor(Math.random() * 1000) }
              };
              
              return await twikitCacheManager.set(key, value, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'load_test',
                priority: 'MEDIUM',
                tags: ['load', 'test', 'performance']
              });
            }
          },
          {
            name: 'cache_get',
            weight: 40,
            operation: async () => {
              // Set a value first, then get it
              const key = `get_test_${Math.random()}`;
              const value = { test: true, timestamp: Date.now() };
              
              await twikitCacheManager.set(key, value, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'load_test_get',
                priority: 'HIGH',
                tags: ['get', 'test']
              });
              
              return await twikitCacheManager.get(key, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'load_test_retrieve',
                priority: 'HIGH',
                tags: ['get', 'test']
              });
            }
          },
          {
            name: 'cache_delete',
            weight: 20,
            operation: async () => {
              const key = `delete_test_${Math.random()}`;
              const value = { test: true };
              
              await twikitCacheManager.set(key, value, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'load_test_delete',
                priority: 'LOW',
                tags: ['delete', 'test']
              });
              
              return await twikitCacheManager.delete(key, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'load_test_delete_op',
                tags: ['delete', 'test']
              });
            }
          }
        ],
        thresholds: {
          maxResponseTime: 500,
          maxErrorRate: 1,
          minThroughput: 20
        }
      };

      const results = await testUtils.runLoadTest(loadTestConfig);
      
      expect(results.success).toBe(true);
      expect(results.metrics.errorRate).toBeLessThan(1);
      expect(results.metrics.averageResponseTime).toBeLessThan(500);
      expect(results.metrics.throughput).toBeGreaterThan(20);

      logger.info('Cache operations load test results', results.metrics);
    });

    test('should handle large data caching efficiently', async () => {
      const { result: largeDataResults, metrics } = await testUtils.measurePerformance(async () => {
        const operations = [];
        
        // Test different data sizes
        const dataSizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
        
        for (const size of dataSizes) {
          const largeData = 'x'.repeat(size);
          const key = `large_data_${size}_${Date.now()}`;
          
          const startTime = Date.now();
          
          await twikitCacheManager.set(key, largeData, {
            serviceType: 'SESSION_MANAGER',
            operationType: 'large_data_test',
            priority: 'LOW',
            tags: ['large', 'data', `size_${size}`]
          });
          
          const retrieved = await twikitCacheManager.get(key, {
            serviceType: 'SESSION_MANAGER',
            operationType: 'large_data_retrieve',
            priority: 'LOW',
            tags: ['large', 'data', `size_${size}`]
          });
          
          const endTime = Date.now();
          
          operations.push({
            size,
            duration: endTime - startTime,
            success: retrieved === largeData
          });
        }
        
        return operations;
      }, 'largeDataCaching');

      expect(largeDataResults.length).toBe(4);
      expect(largeDataResults.every(op => op.success)).toBe(true);
      expect(largeDataResults.every(op => op.duration < 5000)).toBe(true); // Each operation under 5 seconds
      expect(metrics.responseTime).toBeLessThan(20000); // Total under 20 seconds

      logger.info('Large data caching results', { operations: largeDataResults, totalTime: metrics.responseTime });
    });
  });

  // ============================================================================
  // INTEGRATED LOAD TESTS
  // ============================================================================

  describe('Integrated System Load Tests', () => {
    test('should handle full system load with all services', async () => {
      const loadTestConfig: TwikitLoadTestConfig = {
        concurrentUsers: 20,
        duration: 30,
        rampUpTime: 5,
        operations: [
          {
            name: 'full_session_workflow',
            weight: 25,
            operation: async () => {
              const randomId = Math.floor(Math.random() * 10000);
              
              // Create session
              const session = await twikitSessionManager.createSession({
                accountId: `full-load-${randomId}`,
                credentials: {
                  username: `full_user_${randomId}`,
                  email: `full${randomId}@test.com`,
                  password: 'full_password_123'
                }
              });
              
              // Authenticate
              await twikitSessionManager.authenticateSession(session.sessionId);
              
              // Close session
              await twikitSessionManager.closeSession(session.sessionId);
              
              return session.sessionId;
            }
          },
          {
            name: 'security_operations',
            weight: 25,
            operation: async () => {
              const randomId = Math.floor(Math.random() * 10000);
              const testData = `Security load test ${randomId}`;
              
              // Encrypt data
              const encrypted = await twikitSecurityManager.encryptData(testData);
              
              // Store credential
              const credentialId = await twikitSecurityManager.storeCredential(
                `security_load_${randomId}`,
                `security_value_${randomId}`,
                'api_key',
                { service: 'security_load_test' }
              );
              
              // Retrieve credential
              await twikitSecurityManager.retrieveCredential(
                credentialId,
                'security_load_test',
                'security_load_user'
              );
              
              return encrypted.data;
            }
          },
          {
            name: 'cache_operations',
            weight: 25,
            operation: async () => {
              const randomId = Math.floor(Math.random() * 10000);
              const key = `cache_load_${randomId}`;
              const value = { loadTest: true, id: randomId, timestamp: Date.now() };
              
              // Set cache
              await twikitCacheManager.set(key, value, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'integrated_load_test',
                priority: 'MEDIUM',
                tags: ['integrated', 'load']
              });
              
              // Get cache
              const retrieved = await twikitCacheManager.get(key, {
                serviceType: 'SESSION_MANAGER',
                operationType: 'integrated_load_retrieve',
                priority: 'MEDIUM',
                tags: ['integrated', 'load']
              });
              
              return retrieved?.id === randomId;
            }
          },
          {
            name: 'monitoring_operations',
            weight: 25,
            operation: async () => {
              // Log security event
              await twikitSecurityManager.logSecurityEvent({
                type: 'auth_success',
                severity: 'low',
                source: {
                  service: 'integrated_load_test',
                  instance: `load_instance_${Math.floor(Math.random() * 10)}`
                },
                details: {
                  description: 'Integrated load test event',
                  data: { loadTest: true, timestamp: Date.now() }
                }
              });
              
              // Get load balancer status
              const status = twikitSessionManager.getLoadBalancerStatus();
              
              return status.totalSessions >= 0;
            }
          }
        ],
        thresholds: {
          maxResponseTime: 8000,
          maxErrorRate: 5,
          minThroughput: 2
        }
      };

      const results = await testUtils.runLoadTest(loadTestConfig);
      
      expect(results.success).toBe(true);
      expect(results.metrics.errorRate).toBeLessThan(5);
      expect(results.metrics.averageResponseTime).toBeLessThan(8000);
      expect(results.metrics.throughput).toBeGreaterThan(2);

      logger.info('Integrated system load test results', results.metrics);

      // Verify system state after load test
      const finalMetrics = testUtils.getTestMetricsSummary();
      expect(finalMetrics.totalTests).toBeGreaterThan(100);
      expect(finalMetrics.totalErrors).toBeLessThan(finalMetrics.totalTests * 0.05); // Less than 5% error rate
    });

    test('should recover gracefully from high load', async () => {
      // Apply extreme load
      const extremeLoadConfig: TwikitLoadTestConfig = {
        concurrentUsers: 50,
        duration: 10,
        rampUpTime: 1,
        operations: [
          {
            name: 'extreme_load_operation',
            weight: 100,
            operation: async () => {
              const operations = await Promise.all([
                twikitSessionManager.createSession({
                  accountId: `extreme-${Math.random()}`,
                  credentials: {
                    username: `extreme_user_${Math.random()}`,
                    email: `extreme${Math.random()}@test.com`,
                    password: 'extreme_password'
                  }
                }),
                twikitSecurityManager.encryptData(`Extreme load data ${Math.random()}`),
                twikitCacheManager.set(`extreme_${Math.random()}`, { extreme: true }, {
                  serviceType: 'SESSION_MANAGER',
                  operationType: 'extreme_load',
                  priority: 'LOW',
                  tags: ['extreme']
                })
              ]);
              
              return operations.length === 3;
            }
          }
        ],
        thresholds: {
          maxResponseTime: 15000,
          maxErrorRate: 20, // Allow higher error rate for extreme load
          minThroughput: 1
        }
      };

      const extremeResults = await testUtils.runLoadTest(extremeLoadConfig);
      
      // System should handle extreme load or fail gracefully
      expect(extremeResults.metrics.errorRate).toBeLessThan(50); // Should not completely fail
      
      // Wait for system recovery
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test normal operations after extreme load
      const session = await twikitSessionManager.createSession({
        accountId: 'recovery-test-account',
        credentials: {
          username: 'recovery_user',
          email: 'recovery@test.com',
          password: 'recovery_password'
        }
      });
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      
      logger.info('System recovery test completed', {
        extremeLoadResults: extremeResults.metrics,
        recoverySuccessful: !!session.sessionId
      });
    });
  });
});
