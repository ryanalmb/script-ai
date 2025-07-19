/**
 * Security Testing - 2025 Edition
 * Enterprise-grade security testing:
 * - SQL injection prevention
 * - XSS attack prevention
 * - CSRF protection validation
 * - Authentication bypass attempts
 * - Authorization testing
 * - Input validation security
 * - Rate limiting security
 * - Data exposure prevention
 */

import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestUtils, TestUtils } from '../utils/testUtils';
import { getUserFactory } from '../factories/userFactory';
import app from '../../src/index';

describe('Security Testing', () => {
  let testUtils: TestUtils;
  let prisma: PrismaClient;
  let userFactory: any;

  beforeAll(async () => {
    const { TEST_STATE } = global as any;
    prisma = TEST_STATE.prisma;
    
    testUtils = createTestUtils({
      prisma,
      app: app as Express,
      redis: TEST_STATE.redis
    });

    userFactory = getUserFactory(prisma);
  });

  beforeEach(async () => {
    await testUtils.cleanDatabase();
    await testUtils.seedTestData();
  });

  afterEach(async () => {
    await testUtils.cleanupCreatedRecords();
  });

  afterAll(async () => {
    await testUtils.cleanup();
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in login endpoint', async () => {
      const sqlInjectionPayloads = [
        "admin'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users WHERE '1'='1",
        "'; INSERT INTO users (email, role) VALUES ('hacker@evil.com', 'ADMIN'); --",
        "' OR 1=1 --",
        "admin'/**/OR/**/1=1/**/--",
        "' OR 'x'='x",
        "1' OR '1'='1' /*",
        "' OR 1=1#",
        "') OR ('1'='1"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await testUtils.makeRequest('POST', '/api/users/login', {
          body: {
            email: payload,
            password: 'password'
          }
        });

        // Should not cause server error or expose database structure
        expect(response.status).not.toBe(500);
        expect(response.body.error?.message).not.toMatch(/sql|database|syntax|query/i);
        expect(response.body.error?.details).not.toMatch(/sql|database|syntax|query/i);
        
        // Should return proper authentication error
        if (response.status === 401) {
          expect(response.body).toHaveValidErrorFormat();
          expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
        }
      }
    });

    it('should prevent SQL injection in search endpoints', async () => {
      const testUser = await userFactory.create();
      const authToken = await testUtils.authenticateUser(testUser.id);

      const sqlInjectionPayloads = [
        "'; DROP TABLE campaigns; --",
        "' UNION SELECT password FROM users --",
        "' OR 1=1 --",
        "test'; UPDATE users SET role='ADMIN' WHERE id='" + testUser.id + "'; --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await testUtils.makeRequest('GET', '/api/campaigns', {
          auth: authToken,
          query: { search: payload }
        });

        // Should not cause server error
        expect(response.status).not.toBe(500);
        expect(response.body.error?.message).not.toMatch(/sql|database|syntax|query/i);
        
        // Should return normal search results or validation error
        expect([200, 400]).toContain(response.status);
      }

      // Verify user role wasn't changed
      const userCheck = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      expect(userCheck?.role).toBe(testUser.role);
    });
  });

  describe('XSS Attack Prevention', () => {
    it('should prevent XSS in user registration', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "';alert('XSS');//",
        "<iframe src='javascript:alert(\"XSS\")'></iframe>",
        "<body onload=alert('XSS')>",
        "<input onfocus=alert('XSS') autofocus>",
        "<select onfocus=alert('XSS') autofocus>",
        "<textarea onfocus=alert('XSS') autofocus>"
      ];

      for (const payload of xssPayloads) {
        const response = await testUtils.makeRequest('POST', '/api/users/register', {
          body: {
            email: 'test@example.com',
            username: 'testuser',
            password: 'SecurePassword123!',
            firstName: payload,
            lastName: 'User'
          }
        });

        if (response.status === 201) {
          // If registration succeeds, ensure XSS payload is sanitized
          expect(response.body.data.user.firstName).not.toContain('<script>');
          expect(response.body.data.user.firstName).not.toContain('javascript:');
          expect(response.body.data.user.firstName).not.toContain('onerror');
          expect(response.body.data.user.firstName).not.toContain('onload');
          expect(response.body.data.user.firstName).not.toContain('alert(');
        } else {
          // Should return validation error for malicious input
          expect(response.status).toBe(400);
          expect(response.body).toHaveValidErrorFormat();
        }
      }
    });

    it('should prevent XSS in campaign content', async () => {
      const testUser = await userFactory.create();
      const authToken = await testUtils.authenticateUser(testUser.id);

      const xssPayloads = testUtils.generateXSSPayloads();

      for (const payload of xssPayloads) {
        const response = await testUtils.makeRequest('POST', '/api/campaigns', {
          auth: authToken,
          body: {
            name: payload,
            description: `Campaign with XSS payload: ${payload}`
          }
        });

        if (response.status === 201) {
          // If creation succeeds, ensure XSS payload is sanitized
          expect(response.body.data.name).not.toContain('<script>');
          expect(response.body.data.name).not.toContain('javascript:');
          expect(response.body.data.description).not.toContain('<script>');
          expect(response.body.data.description).not.toContain('javascript:');
        } else {
          // Should return validation error
          expect(response.status).toBe(400);
          expect(response.body).toHaveValidErrorFormat();
        }
      }
    });
  });

  describe('Authentication Security', () => {
    it('should prevent authentication bypass attempts', async () => {
      const bypassAttempts = [
        // Missing token
        { headers: {} },
        // Invalid token format
        { headers: { 'Authorization': 'Bearer invalid-token' } },
        // Malformed JWT
        { headers: { 'Authorization': 'Bearer not.a.jwt' } },
        // Empty token
        { headers: { 'Authorization': 'Bearer ' } },
        // Wrong auth scheme
        { headers: { 'Authorization': 'Basic dGVzdDp0ZXN0' } },
        // Expired token (simulated)
        { headers: { 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1MTYyMzkwMjJ9.invalid' } }
      ];

      for (const attempt of bypassAttempts) {
        const response = await testUtils.makeRequest('GET', '/api/users/profile', {
          headers: attempt.headers
        });

        expect(response.status).toBe(401);
        expect(response.body).toHaveValidErrorFormat();
        expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
        expect(response.body.error.retryable).toBe(false);
      }
    });

    it('should prevent privilege escalation', async () => {
      const regularUser = await userFactory.create({ role: 'USER' });
      const authToken = await testUtils.authenticateUser(regularUser.id);

      // Attempt to access admin endpoints
      const adminEndpoints = [
        { method: 'GET', path: '/api/admin/users' },
        { method: 'POST', path: '/api/admin/users/promote' },
        { method: 'DELETE', path: '/api/admin/users/123' },
        { method: 'GET', path: '/api/admin/analytics' },
        { method: 'POST', path: '/api/admin/system/maintenance' }
      ];

      for (const endpoint of adminEndpoints) {
        const response = await testUtils.makeRequest(endpoint.method as any, endpoint.path, {
          auth: authToken
        });

        expect(response.status).toBe(403);
        expect(response.body).toHaveValidErrorFormat();
        expect(response.body.error.type).toBe('AUTHORIZATION_ERROR');
      }
    });

    it('should enforce session security', async () => {
      const testUser = await userFactory.create();
      
      // Login to get token
      const loginResponse = await testUtils.makeRequest('POST', '/api/users/login', {
        body: {
          email: testUser.email,
          password: testUser.plainPassword
        }
      });

      const token = loginResponse.body.data.token;

      // Use token successfully
      const profileResponse = await testUtils.makeRequest('GET', '/api/users/profile', {
        auth: token
      });
      expect(profileResponse.status).toBe(200);

      // Logout
      const logoutResponse = await testUtils.makeRequest('POST', '/api/users/logout', {
        auth: token
      });
      expect(logoutResponse.status).toBe(200);

      // Token should be invalidated after logout
      const afterLogoutResponse = await testUtils.makeRequest('GET', '/api/users/profile', {
        auth: token
      });
      expect(afterLogoutResponse.status).toBe(401);
    });
  });

  describe('Authorization Security', () => {
    it('should enforce resource ownership', async () => {
      const user1 = await userFactory.create();
      const user2 = await userFactory.create();
      const user1Token = await testUtils.authenticateUser(user1.id);
      const user2Token = await testUtils.authenticateUser(user2.id);

      // User 1 creates a campaign
      const campaignResponse = await testUtils.makeRequest('POST', '/api/campaigns', {
        auth: user1Token,
        body: {
          name: 'User 1 Campaign',
          description: 'Private campaign'
        }
      });

      const campaignId = campaignResponse.body.data.id;

      // User 2 should not be able to access User 1's campaign
      const unauthorizedAccess = await testUtils.makeRequest('GET', `/api/campaigns/${campaignId}`, {
        auth: user2Token
      });

      expect(unauthorizedAccess.status).toBe(403);
      expect(unauthorizedAccess.body).toHaveValidErrorFormat();
      expect(unauthorizedAccess.body.error.type).toBe('AUTHORIZATION_ERROR');

      // User 2 should not be able to modify User 1's campaign
      const unauthorizedModify = await testUtils.makeRequest('PUT', `/api/campaigns/${campaignId}`, {
        auth: user2Token,
        body: { name: 'Hacked Campaign' }
      });

      expect(unauthorizedModify.status).toBe(403);
      expect(unauthorizedModify.body).toHaveValidErrorFormat();

      // User 2 should not be able to delete User 1's campaign
      const unauthorizedDelete = await testUtils.makeRequest('DELETE', `/api/campaigns/${campaignId}`, {
        auth: user2Token
      });

      expect(unauthorizedDelete.status).toBe(403);
      expect(unauthorizedDelete.body).toHaveValidErrorFormat();
    });
  });

  describe('Input Validation Security', () => {
    it('should validate and sanitize all inputs', async () => {
      const testUser = await userFactory.create();
      const authToken = await testUtils.authenticateUser(testUser.id);

      const maliciousInputs = [
        // Oversized inputs
        { name: 'A'.repeat(10000), description: 'Normal description' },
        // Special characters
        { name: '../../etc/passwd', description: 'Path traversal attempt' },
        // Null bytes
        { name: 'Campaign\x00Name', description: 'Null byte injection' },
        // Unicode attacks
        { name: 'Campaign\u202eName', description: 'Unicode direction override' },
        // Control characters
        { name: 'Campaign\r\nName', description: 'CRLF injection attempt' }
      ];

      for (const input of maliciousInputs) {
        const response = await testUtils.makeRequest('POST', '/api/campaigns', {
          auth: authToken,
          body: input
        });

        // Should either reject with validation error or sanitize input
        if (response.status === 201) {
          // If accepted, ensure input is sanitized
          expect(response.body.data.name).not.toContain('\x00');
          expect(response.body.data.name).not.toContain('\r\n');
          expect(response.body.data.name.length).toBeLessThan(1000);
        } else {
          expect(response.status).toBe(400);
          expect(response.body).toHaveValidErrorFormat();
          expect(response.body.error.type).toBe('VALIDATION_ERROR');
        }
      }
    });

    it('should prevent file upload attacks', async () => {
      const testUser = await userFactory.create();
      const authToken = await testUtils.authenticateUser(testUser.id);

      const maliciousFiles = [
        // Executable file
        { filename: 'malware.exe', content: 'MZ\x90\x00' },
        // Script file
        { filename: 'script.php', content: '<?php system($_GET["cmd"]); ?>' },
        // Path traversal
        { filename: '../../../etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash' },
        // Null byte injection
        { filename: 'image.jpg\x00.php', content: '<?php echo "hacked"; ?>' }
      ];

      for (const file of maliciousFiles) {
        const response = await testUtils.makeRequest('POST', '/api/users/avatar', {
          auth: authToken,
          body: {
            filename: file.filename,
            content: Buffer.from(file.content).toString('base64')
          }
        });

        // Should reject malicious files
        expect(response.status).toBe(400);
        expect(response.body).toHaveValidErrorFormat();
        expect(response.body.error.type).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent brute force attacks on login', async () => {
      const testUser = await userFactory.create();
      const attempts = [];

      // Make many failed login attempts
      for (let i = 0; i < 20; i++) {
        const attempt = testUtils.makeRequest('POST', '/api/users/login', {
          body: {
            email: testUser.email,
            password: 'wrongpassword'
          }
        });
        attempts.push(attempt);
      }

      const responses = await Promise.all(attempts);
      
      // Should start rate limiting after several attempts
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper format
      rateLimitedResponses.forEach(response => {
        expect(response.body).toHaveValidErrorFormat();
        expect(response.body.error.type).toBe('RATE_LIMIT_ERROR');
        expect(response.body.error.retryAfter).toBeGreaterThan(0);
      });
    });

    it('should prevent API abuse through rate limiting', async () => {
      const testUser = await userFactory.create();
      const authToken = await testUtils.authenticateUser(testUser.id);

      // Make many requests quickly
      const requests = [];
      for (let i = 0; i < 100; i++) {
        const request = testUtils.makeRequest('GET', '/api/users/profile', {
          auth: authToken
        });
        requests.push(request);
      }

      const responses = await Promise.all(requests);
      
      // Should rate limit excessive requests
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      // Some requests should still succeed
      const successfulCount = responses.filter(r => r.status === 200).length;
      expect(successfulCount).toBeGreaterThan(0);
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose sensitive data in responses', async () => {
      const testUser = await userFactory.create();
      const authToken = await testUtils.authenticateUser(testUser.id);

      const response = await testUtils.makeRequest('GET', '/api/users/profile', {
        auth: authToken
      });

      expect(response.status).toBe(200);
      
      // Should not expose sensitive fields
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.passwordHash).toBeUndefined();
      expect(response.body.data.salt).toBeUndefined();
      expect(response.body.data.resetToken).toBeUndefined();
      expect(response.body.data.verificationToken).toBeUndefined();
    });

    it('should not expose internal system information in errors', async () => {
      // Trigger various error conditions
      const errorTests = [
        { path: '/api/nonexistent', expectedStatus: 404 },
        { path: '/api/users/profile', headers: {}, expectedStatus: 401 },
        { path: '/api/campaigns/invalid-id', auth: 'invalid-token', expectedStatus: 401 }
      ];

      for (const test of errorTests) {
        const response = await testUtils.makeRequest('GET', test.path, {
          headers: test.headers,
          auth: test.auth
        });

        expect(response.status).toBe(test.expectedStatus);
        
        if (response.body.error) {
          // Should not expose internal paths, stack traces, or system info
          expect(response.body.error.message).not.toMatch(/\/src\/|\/node_modules\/|Error:/);
          expect(response.body.error.stack).toBeUndefined();
          expect(response.body.error.details).not.toMatch(/database|connection|internal/i);
        }
      }
    });
  });

  describe('Security Headers', () => {
    it('should include all required security headers', async () => {
      const response = await testUtils.makeRequest('GET', '/api/health');

      expect(response).toHaveSecureHeaders();
      
      // Additional security header checks
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });
});
