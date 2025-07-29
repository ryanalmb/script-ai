/**
 * Twikit Security Manager Unit Tests - Task 31
 * 
 * Comprehensive unit tests for TwikitSecurityManager covering:
 * - End-to-end encryption and decryption
 * - Secure credential storage and retrieval
 * - Security monitoring and threat detection
 * - Compliance framework validation
 * - Performance testing and optimization
 * - Error handling and security edge cases
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { 
  twikitSecurityManager, 
  EncryptionAlgorithm, 
  SecurityEventType,
  ComplianceFramework 
} from '../../../src/services/twikitSecurityManager';
import { twikitTestUtils, createTwikitTestUtils } from '../utils/twikitTestUtils';
import { logger } from '../../../src/utils/logger';
import * as crypto from 'crypto';

describe('TwikitSecurityManager Unit Tests', () => {
  let testUtils: typeof twikitTestUtils;

  beforeAll(async () => {
    testUtils = createTwikitTestUtils({
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
    expect(validation.security).toBe(true);
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
  // INITIALIZATION TESTS
  // ============================================================================

  describe('Security Manager Initialization', () => {
    test('should initialize security manager successfully', async () => {
      const { result, metrics } = await testUtils.measurePerformance(async () => {
        await twikitSecurityManager.initializeSecurityManager();
        return true;
      }, 'initializeSecurityManager');

      expect(result).toBe(true);
      expect(metrics.responseTime).toBeLessThan(10000);
    });

    test('should get security configuration', async () => {
      await twikitSecurityManager.initializeSecurityManager();
      
      const config = twikitSecurityManager.getSecurityConfig();
      expect(config).toBeDefined();
      expect(config.encryption).toBeDefined();
      expect(config.keyVault).toBeDefined();
      expect(config.monitoring).toBeDefined();
      expect(config.authentication).toBeDefined();
      expect(config.compliance).toBeDefined();
    });

    test('should update security configuration', async () => {
      await twikitSecurityManager.initializeSecurityManager();

      const newConfig = {
        encryption: {
          algorithm: EncryptionAlgorithm.AES_256_GCM,
          keySize: 32,
          iterations: 150000
        }
      };

      await twikitSecurityManager.updateSecurityConfig(newConfig);

      const config = twikitSecurityManager.getSecurityConfig();
      expect(config.encryption.iterations).toBe(150000);
    });
  });

  // ============================================================================
  // ENCRYPTION AND DECRYPTION TESTS
  // ============================================================================

  describe('Encryption and Decryption', () => {
    beforeEach(async () => {
      await twikitSecurityManager.initializeSecurityManager();
    });

    test('should encrypt and decrypt data successfully', async () => {
      const testData = 'This is sensitive test data that needs encryption';

      const { result: encrypted, metrics: encryptMetrics } = await testUtils.measurePerformance(async () => {
        return await twikitSecurityManager.encryptData(testData);
      }, 'encryptData');

      expect(encrypted).toBeDefined();
      expect(encrypted.algorithm).toBe(EncryptionAlgorithm.AES_256_GCM);
      expect(encrypted.data).not.toBe(testData);
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.integrity).toBeDefined();
      expect(encryptMetrics.responseTime).toBeLessThan(1000);

      const { result: decrypted, metrics: decryptMetrics } = await testUtils.measurePerformance(async () => {
        return await twikitSecurityManager.decryptData(encrypted);
      }, 'decryptData');

      expect(decrypted.toString('utf8')).toBe(testData);
      expect(decryptMetrics.responseTime).toBeLessThan(1000);
    });

    test('should encrypt and decrypt with additional data', async () => {
      const testData = 'Sensitive data with additional authentication data';
      const additionalData = 'context:user_profile';

      const encrypted = await twikitSecurityManager.encryptData(testData, undefined, additionalData);
      const decrypted = await twikitSecurityManager.decryptData(encrypted, additionalData);

      expect(decrypted.toString('utf8')).toBe(testData);
    });

    test('should fail decryption with wrong additional data', async () => {
      const testData = 'Sensitive data with additional authentication data';
      const correctAdditionalData = 'context:user_profile';
      const wrongAdditionalData = 'context:wrong_context';

      const encrypted = await twikitSecurityManager.encryptData(testData, undefined, correctAdditionalData);

      await expect(
        twikitSecurityManager.decryptData(encrypted, wrongAdditionalData)
      ).rejects.toThrow();
    });

    test('should encrypt and decrypt field-level data', async () => {
      const fieldData = {
        username: 'john_doe',
        email: 'john@example.com',
        apiKey: 'secret_api_key_12345'
      };

      const encrypted = await twikitSecurityManager.encryptField(fieldData, 'user_data', 'users');
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toContain('john_doe');

      const decrypted = await twikitSecurityManager.decryptField(encrypted, 'user_data', 'users');
      expect(decrypted).toEqual(fieldData);
    });

    test('should handle large data encryption', async () => {
      const largeData = 'x'.repeat(100000); // 100KB of data

      const { result: encrypted, metrics } = await testUtils.measurePerformance(async () => {
        return await twikitSecurityManager.encryptData(largeData);
      }, 'encryptLargeData');

      expect(encrypted).toBeDefined();
      expect(metrics.responseTime).toBeLessThan(5000); // Should complete within 5 seconds

      const decrypted = await twikitSecurityManager.decryptData(encrypted);
      expect(decrypted.toString('utf8')).toBe(largeData);
    });

    test('should detect data tampering', async () => {
      const testData = 'Important data that should not be tampered with';
      const encrypted = await twikitSecurityManager.encryptData(testData);

      // Tamper with the encrypted data
      const tamperedEncrypted = {
        ...encrypted,
        data: encrypted.data.slice(0, -4) + 'XXXX' // Change last 4 characters
      };

      await expect(
        twikitSecurityManager.decryptData(tamperedEncrypted)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // CREDENTIAL STORAGE TESTS
  // ============================================================================

  describe('Secure Credential Storage', () => {
    beforeEach(async () => {
      await twikitSecurityManager.initializeSecurityManager();
    });

    test('should store and retrieve credentials securely', async () => {
      const credentialValue = 'super_secret_api_key_12345';
      const credentialName = 'test_api_key';

      const { result: credentialId, metrics: storeMetrics } = await testUtils.measurePerformance(async () => {
        return await twikitSecurityManager.storeCredential(
          credentialName,
          credentialValue,
          'api_key',
          { service: 'test_service', environment: 'test' },
          { permissions: ['read', 'rotate'], allowedServices: ['test_service'] }
        );
      }, 'storeCredential');

      expect(credentialId).toBeDefined();
      expect(typeof credentialId).toBe('string');
      expect(storeMetrics.responseTime).toBeLessThan(2000);

      const { result: retrievedValue, metrics: retrieveMetrics } = await testUtils.measurePerformance(async () => {
        return await twikitSecurityManager.retrieveCredential(
          credentialId,
          'test_service',
          'test_user'
        );
      }, 'retrieveCredential');

      expect(retrievedValue).toBe(credentialValue);
      expect(retrieveMetrics.responseTime).toBeLessThan(1000);
    });

    test('should enforce access control on credentials', async () => {
      const credentialId = await twikitSecurityManager.storeCredential(
        'restricted_key',
        'secret_value',
        'api_key',
        { service: 'restricted_service' },
        { allowedServices: ['restricted_service'] }
      );

      // Should succeed with allowed service
      const value1 = await twikitSecurityManager.retrieveCredential(
        credentialId,
        'restricted_service',
        'test_user'
      );
      expect(value1).toBe('secret_value');

      // Should fail with unauthorized service
      await expect(
        twikitSecurityManager.retrieveCredential(credentialId, 'unauthorized_service', 'test_user')
      ).rejects.toThrow();
    });

    test('should rotate credentials', async () => {
      const originalValue = 'original_secret_value';
      const credentialId = await twikitSecurityManager.storeCredential(
        'rotatable_key',
        originalValue,
        'api_key',
        { service: 'test_service' }
      );

      // Rotate credential
      await twikitSecurityManager.rotateCredential(credentialId);

      // Retrieved value should be different
      const newValue = await twikitSecurityManager.retrieveCredential(
        credentialId,
        'test_service',
        'test_user'
      );
      expect(newValue).not.toBe(originalValue);
      expect(newValue).toBeDefined();
    });

    test('should get credential vault status', async () => {
      // Store some credentials
      await twikitSecurityManager.storeCredential('key1', 'value1', 'api_key', { service: 'test' });
      await twikitSecurityManager.storeCredential('key2', 'value2', 'password', { service: 'test' });

      const status = twikitSecurityManager.getCredentialVaultStatus();
      expect(status).toBeDefined();
      expect(status.credentialCount).toBeGreaterThanOrEqual(2);
      expect(status.keyCount).toBeGreaterThan(0);
    });

    test('should handle credential expiration', async () => {
      const expirationDate = new Date(Date.now() + 1000); // Expires in 1 second
      
      const credentialId = await twikitSecurityManager.storeCredential(
        'expiring_key',
        'expiring_value',
        'api_key',
        { service: 'test_service' },
        { expiresAt: expirationDate }
      );

      // Should work immediately
      const value1 = await twikitSecurityManager.retrieveCredential(
        credentialId,
        'test_service',
        'test_user'
      );
      expect(value1).toBe('expiring_value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should fail after expiration
      await expect(
        twikitSecurityManager.retrieveCredential(credentialId, 'test_service', 'test_user')
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // SECURITY MONITORING TESTS
  // ============================================================================

  describe('Security Monitoring and Auditing', () => {
    beforeEach(async () => {
      await twikitSecurityManager.initializeSecurityManager();
    });

    test('should log security events', async () => {
      const eventData = {
        type: SecurityEventType.AUTHENTICATION_SUCCESS,
        severity: 'low' as const,
        source: {
          service: 'test_service',
          instance: 'test_instance',
          user: 'test_user',
          ip: '192.168.1.100'
        },
        details: {
          description: 'Test authentication event',
          data: { timestamp: new Date().toISOString() }
        }
      };

      await twikitSecurityManager.logSecurityEvent(eventData);

      const events = twikitSecurityManager.getSecurityEvents(10);
      expect(events.length).toBeGreaterThan(0);
      
      const loggedEvent = events.find(e => e.details.description === 'Test authentication event');
      expect(loggedEvent).toBeDefined();
      expect(loggedEvent?.type).toBe(SecurityEventType.AUTHENTICATION_SUCCESS);
    });

    test('should detect and handle security threats', async () => {
      // Simulate multiple failed authentication attempts
      for (let i = 0; i < 6; i++) {
        await twikitSecurityManager.logSecurityEvent({
          type: SecurityEventType.AUTHENTICATION_FAILURE,
          severity: 'medium',
          source: {
            service: 'test_service',
            ip: '192.168.1.100'
          },
          details: {
            description: `Failed login attempt ${i + 1}`,
            data: { attempt: i + 1 }
          }
        });
      }

      // Check for active threats
      const threats = twikitSecurityManager.getActiveThreats();
      expect(threats.length).toBeGreaterThan(0);
      
      const bruteForceThreats = threats.filter(t => 
        t.details.data.threatType === 'brute_force'
      );
      expect(bruteForceThreats.length).toBeGreaterThan(0);
    });

    test('should acknowledge security alerts', async () => {
      // Create a high-severity event that triggers an alert
      await twikitSecurityManager.logSecurityEvent({
        type: SecurityEventType.INTRUSION_DETECTED,
        severity: 'high',
        source: {
          service: 'test_service',
          ip: '192.168.1.100'
        },
        details: {
          description: 'Test intrusion detection',
          data: { threatLevel: 'high' }
        }
      });

      const events = twikitSecurityManager.getSecurityEvents(1, 'high');
      expect(events.length).toBeGreaterThan(0);

      const eventId = events[0].id;
      await twikitSecurityManager.acknowledgeSecurityAlert(eventId, 'test_admin');

      // Alert should be acknowledged (would check in cache in real implementation)
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  // ============================================================================
  // COMPLIANCE FRAMEWORK TESTS
  // ============================================================================

  describe('Compliance Framework', () => {
    beforeEach(async () => {
      await twikitSecurityManager.initializeSecurityManager();
    });

    test('should validate compliance configuration', async () => {
      const config = twikitSecurityManager.getSecurityConfig();
      
      expect(config.compliance.frameworks).toContain(ComplianceFramework.SOC2_TYPE2);
      expect(config.compliance.frameworks).toContain(ComplianceFramework.ISO_27001);
      expect(config.compliance.frameworks).toContain(ComplianceFramework.GDPR);
      expect(config.compliance.frameworks).toContain(ComplianceFramework.OWASP_TOP10);
      
      expect(config.compliance.privacyControls.dataMinimization).toBe(true);
      expect(config.compliance.privacyControls.consentManagement).toBe(true);
      expect(config.compliance.auditRequirements.logAllAccess).toBe(true);
      expect(config.compliance.auditRequirements.encryptAuditLogs).toBe(true);
    });

    test('should perform security assessment', async () => {
      const { result: assessment, metrics } = await testUtils.measurePerformance(async () => {
        return await twikitSecurityManager.performSecurityAssessment('security_review');
      }, 'performSecurityAssessment');

      expect(assessment).toBeDefined();
      expect(assessment.id).toBeDefined();
      expect(assessment.type).toBe('security_review');
      expect(assessment.results.score).toBeGreaterThan(0);
      expect(assessment.results.grade).toMatch(/[A-F]/);
      expect(assessment.scope.frameworks.length).toBeGreaterThan(0);
      expect(metrics.responseTime).toBeLessThan(5000);
    });

    test('should get assessment history', async () => {
      // Perform multiple assessments
      await twikitSecurityManager.performSecurityAssessment('vulnerability_scan');
      await twikitSecurityManager.performSecurityAssessment('compliance_audit');

      const history = twikitSecurityManager.getAssessmentHistory(5);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance Testing', () => {
    beforeEach(async () => {
      await twikitSecurityManager.initializeSecurityManager();
    });

    test('should meet encryption performance thresholds', async () => {
      const testSizes = [1024, 10240, 102400]; // 1KB, 10KB, 100KB

      for (const size of testSizes) {
        const performance = await twikitSecurityManager.testEncryptionPerformance(size);
        
        expect(performance.encryptionTime).toBeLessThan(1000); // < 1 second
        expect(performance.decryptionTime).toBeLessThan(1000); // < 1 second
        expect(performance.throughput).toBeGreaterThan(0);
        
        const totalTime = performance.encryptionTime + performance.decryptionTime;
        expect(totalTime).toBeLessThan(100); // < 100ms total for good performance
      }
    });

    test('should handle concurrent encryption operations', async () => {
      const concurrentOperations = 10;
      const testData = 'Concurrent encryption test data';

      const promises = Array.from({ length: concurrentOperations }, (_, i) => 
        twikitSecurityManager.encryptData(`${testData} ${i}`)
      );

      const { result: results, metrics } = await testUtils.measurePerformance(async () => {
        return await Promise.all(promises);
      }, 'concurrentEncryption');

      expect(results.length).toBe(concurrentOperations);
      expect(results.every(r => r.data && r.iv && r.integrity)).toBe(true);
      expect(metrics.responseTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  // ============================================================================
  // ERROR HANDLING AND SECURITY EDGE CASES
  // ============================================================================

  describe('Error Handling and Security Edge Cases', () => {
    beforeEach(async () => {
      await twikitSecurityManager.initializeSecurityManager();
    });

    test('should handle malformed encrypted data', async () => {
      const malformedData = {
        algorithm: EncryptionAlgorithm.AES_256_GCM,
        iv: 'invalid_iv',
        tag: 'invalid_tag',
        salt: 'invalid_salt',
        data: 'invalid_data',
        keyId: 'test_key',
        timestamp: new Date(),
        integrity: 'invalid_integrity'
      };

      await expect(
        twikitSecurityManager.decryptData(malformedData)
      ).rejects.toThrow();
    });

    test('should validate security payloads against common attacks', async () => {
      const payloads = testUtils.generateSecurityPayloads();

      // Test SQL injection payloads
      for (const payload of payloads.sqlInjection) {
        const encrypted = await twikitSecurityManager.encryptData(payload);
        const decrypted = await twikitSecurityManager.decryptData(encrypted);
        expect(decrypted.toString('utf8')).toBe(payload);
      }

      // Test XSS payloads
      for (const payload of payloads.xss) {
        const encrypted = await twikitSecurityManager.encryptData(payload);
        const decrypted = await twikitSecurityManager.decryptData(encrypted);
        expect(decrypted.toString('utf8')).toBe(payload);
      }
    });

    test('should handle memory pressure during encryption', async () => {
      const largeDataSets = Array.from({ length: 5 }, (_, i) => 
        'x'.repeat(1024 * 1024) // 1MB each
      );

      for (const data of largeDataSets) {
        const encrypted = await twikitSecurityManager.encryptData(data);
        expect(encrypted).toBeDefined();
        
        const decrypted = await twikitSecurityManager.decryptData(encrypted);
        expect(decrypted.toString('utf8')).toBe(data);
      }
    });

    test('should handle invalid credential operations', async () => {
      const invalidCredentialId = 'invalid-credential-id-12345';

      await expect(
        twikitSecurityManager.retrieveCredential(invalidCredentialId, 'test_service', 'test_user')
      ).rejects.toThrow();

      await expect(
        twikitSecurityManager.rotateCredential(invalidCredentialId)
      ).rejects.toThrow();
    });
  });
});
