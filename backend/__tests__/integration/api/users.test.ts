/**
 * Users API Integration Tests - 2025 Edition
 * Comprehensive testing of user management endpoints:
 * - User registration and authentication
 * - Profile management and updates
 * - User preferences and settings
 * - Error handling and validation
 * - Security and authorization
 * - Performance and rate limiting
 */

import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestUtils, TestUtils } from '../../utils/testUtils';
import { getUserFactory } from '../../factories/userFactory';
import app from '../../../src/index';

describe('Users API Integration Tests', () => {
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

  describe('POST /api/users/register', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User'
      };

      const response = await testUtils.makeRequest('POST', '/api/users/register', {
        body: userData,
        expectStatus: 201
      });

      expect(response.body).toBeValidApiResponse();
      expect(response.body).toHaveValidSuccessFormat();
      expect(response.body).toHaveCorrelationId();
      expect(response.body.data.user).toMatchObject({
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        isActive: true,
        emailVerified: false
      });
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).toHaveValidJWT();

      // Verify user exists in database
      await expect(null).toExistInDatabase('user', { email: userData.email });
    });

    it('should validate required fields', async () => {
      const testCases = [
        { field: 'email', data: { username: 'test', password: 'password' } },
        { field: 'username', data: { email: 'test@example.com', password: 'password' } },
        { field: 'password', data: { email: 'test@example.com', username: 'test' } }
      ];

      for (const testCase of testCases) {
        const response = await testUtils.makeRequest('POST', '/api/users/register', {
          body: testCase.data,
          expectStatus: 400
        });

        expect(response.body).toBeValidApiResponse();
        expect(response.body).toHaveValidErrorFormat();
        expect(response.body).toHaveCorrelationId();
        expect(response.body.error.type).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain(testCase.field);
      }
    });

    it('should prevent duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        username: 'user1',
        password: 'SecurePassword123!'
      };

      // First registration should succeed
      await testUtils.makeRequest('POST', '/api/users/register', {
        body: userData,
        expectStatus: 201
      });

      // Second registration with same email should fail
      const response = await testUtils.makeRequest('POST', '/api/users/register', {
        body: { ...userData, username: 'user2' },
        expectStatus: 409
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('RESOURCE_CONFLICT');
      expect(response.body.error.message).toContain('email');
    });

    it('should prevent duplicate username registration', async () => {
      const userData = {
        email: 'user1@example.com',
        username: 'duplicateuser',
        password: 'SecurePassword123!'
      };

      // First registration should succeed
      await testUtils.makeRequest('POST', '/api/users/register', {
        body: userData,
        expectStatus: 201
      });

      // Second registration with same username should fail
      const response = await testUtils.makeRequest('POST', '/api/users/register', {
        body: { ...userData, email: 'user2@example.com' },
        expectStatus: 409
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('RESOURCE_CONFLICT');
      expect(response.body.error.message).toContain('username');
    });

    it('should validate password strength', async () => {
      const weakPasswords = [
        'weak',
        '12345678',
        'password',
        'PASSWORD',
        'Password',
        '12345678'
      ];

      for (const password of weakPasswords) {
        const response = await testUtils.makeRequest('POST', '/api/users/register', {
          body: {
            email: `test-${Date.now()}@example.com`,
            username: `test-${Date.now()}`,
            password
          },
          expectStatus: 400
        });

        expect(response.body).toHaveValidErrorFormat();
        expect(response.body.error.type).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('password');
      }
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..user@example.com'
      ];

      for (const email of invalidEmails) {
        const response = await testUtils.makeRequest('POST', '/api/users/register', {
          body: {
            email,
            username: `test-${Date.now()}`,
            password: 'SecurePassword123!'
          },
          expectStatus: 400
        });

        expect(response.body).toHaveValidErrorFormat();
        expect(response.body.error.type).toBe('VALIDATION_ERROR');
        expect(response.body.error.message).toContain('email');
      }
    });

    it('should respond within performance threshold', async () => {
      const userData = {
        email: 'performance@example.com',
        username: 'performanceuser',
        password: 'SecurePassword123!'
      };

      const requestPromise = testUtils.makeRequest('POST', '/api/users/register', {
        body: userData
      });

      await expect(requestPromise).toRespondWithin(2000); // 2 seconds
    });
  });

  describe('POST /api/users/login', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await userFactory.create({
        customData: {
          email: 'testuser@example.com',
          username: 'testuser'
        }
      });
    });

    it('should login with valid credentials', async () => {
      const response = await testUtils.makeRequest('POST', '/api/users/login', {
        body: {
          email: testUser.email,
          password: testUser.plainPassword
        },
        expectStatus: 200
      });

      expect(response.body).toBeValidApiResponse();
      expect(response.body).toHaveValidSuccessFormat();
      expect(response.body).toHaveCorrelationId();
      expect(response.body.data.user).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        username: testUser.username
      });
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).toHaveValidJWT();
    });

    it('should login with username instead of email', async () => {
      const response = await testUtils.makeRequest('POST', '/api/users/login', {
        body: {
          username: testUser.username,
          password: testUser.plainPassword
        },
        expectStatus: 200
      });

      expect(response.body).toBeValidApiResponse();
      expect(response.body.data.user.id).toBe(testUser.id);
    });

    it('should reject invalid credentials', async () => {
      const response = await testUtils.makeRequest('POST', '/api/users/login', {
        body: {
          email: testUser.email,
          password: 'wrongpassword'
        },
        expectStatus: 401
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.retryable).toBe(false);
    });

    it('should reject login for non-existent user', async () => {
      const response = await testUtils.makeRequest('POST', '/api/users/login', {
        body: {
          email: 'nonexistent@example.com',
          password: 'password'
        },
        expectStatus: 401
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should reject login for inactive user', async () => {
      const inactiveUser = await userFactory.create({
        isActive: false,
        customData: {
          email: 'inactive@example.com'
        }
      });

      const response = await testUtils.makeRequest('POST', '/api/users/login', {
        body: {
          email: inactiveUser.email,
          password: inactiveUser.plainPassword
        },
        expectStatus: 401
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toContain('inactive');
    });
  });

  describe('GET /api/users/profile', () => {
    let testUser: any;
    let authToken: string;

    beforeEach(async () => {
      testUser = await userFactory.create();
      authToken = await testUtils.authenticateUser(testUser.id);
    });

    it('should get user profile with valid token', async () => {
      const response = await testUtils.makeRequest('GET', '/api/users/profile', {
        auth: authToken,
        expectStatus: 200
      });

      expect(response.body).toBeValidApiResponse();
      expect(response.body).toHaveValidSuccessFormat();
      expect(response.body).toHaveCorrelationId();
      expect(response.body.data).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        username: testUser.username,
        firstName: testUser.firstName,
        lastName: testUser.lastName
      });
      expect(response.body.data.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await testUtils.makeRequest('GET', '/api/users/profile', {
        expectStatus: 401
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should reject request with invalid token', async () => {
      const response = await testUtils.makeRequest('GET', '/api/users/profile', {
        auth: 'invalid-token',
        expectStatus: 401
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('PUT /api/users/profile', () => {
    let testUser: any;
    let authToken: string;

    beforeEach(async () => {
      testUser = await userFactory.create();
      authToken = await testUtils.authenticateUser(testUser.id);
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'Updated bio',
        timezone: 'America/New_York'
      };

      const response = await testUtils.makeRequest('PUT', '/api/users/profile', {
        auth: authToken,
        body: updateData,
        expectStatus: 200
      });

      expect(response.body).toBeValidApiResponse();
      expect(response.body).toHaveValidSuccessFormat();
      expect(response.body.data).toMatchObject(updateData);

      // Verify update in database
      await expect(null).toExistInDatabase('user', {
        id: testUser.id,
        firstName: 'Updated',
        lastName: 'Name'
      });
    });

    it('should validate update data', async () => {
      const invalidData = {
        email: 'invalid-email-format',
        firstName: '', // Empty string should be invalid
        timezone: 'Invalid/Timezone'
      };

      const response = await testUtils.makeRequest('PUT', '/api/users/profile', {
        auth: authToken,
        body: invalidData,
        expectStatus: 400
      });

      expect(response.body).toHaveValidErrorFormat();
      expect(response.body.error.type).toBe('VALIDATION_ERROR');
    });

    it('should not allow updating protected fields', async () => {
      const protectedData = {
        id: 'new-id',
        role: 'ADMIN',
        emailVerified: true,
        createdAt: new Date().toISOString()
      };

      const response = await testUtils.makeRequest('PUT', '/api/users/profile', {
        auth: authToken,
        body: protectedData,
        expectStatus: 200
      });

      // Should succeed but ignore protected fields
      expect(response.body).toBeValidApiResponse();
      
      // Verify protected fields weren't changed
      await expect(null).toExistInDatabase('user', {
        id: testUser.id,
        role: testUser.role,
        emailVerified: testUser.emailVerified
      });
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection in login', async () => {
      const sqlInjectionPayloads = testUtils.generateSQLInjectionPayloads();

      for (const payload of sqlInjectionPayloads) {
        const response = await testUtils.makeRequest('POST', '/api/users/login', {
          body: {
            email: payload,
            password: 'password'
          }
        });

        // Should not cause server error or expose database structure
        expect(response.status).not.toBe(500);
        expect(response.body.error?.message).not.toContain('SQL');
        expect(response.body.error?.message).not.toContain('database');
      }
    });

    it('should prevent XSS in user registration', async () => {
      const xssPayloads = testUtils.generateXSSPayloads();

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

        // Should either reject or sanitize the input
        if (response.status === 201) {
          expect(response.body.data.user.firstName).not.toContain('<script>');
          expect(response.body.data.user.firstName).not.toContain('javascript:');
        }
      }
    });

    it('should have secure headers', async () => {
      const response = await testUtils.makeRequest('GET', '/api/users/profile', {
        auth: await testUtils.authenticateUser((await userFactory.create()).id)
      });

      expect(response).toHaveSecureHeaders();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent user registrations', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = testUtils.makeRequest('POST', '/api/users/register', {
          body: {
            email: `concurrent-${i}@example.com`,
            username: `concurrent${i}`,
            password: 'SecurePassword123!'
          }
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toBeValidApiResponse();
      });

      // Verify all users were created
      for (let i = 0; i < concurrentRequests; i++) {
        await expect(null).toExistInDatabase('user', {
          email: `concurrent-${i}@example.com`
        });
      }
    });

    it('should maintain performance under load', async () => {
      const testUser = await userFactory.create();

      const performanceResult = await testUtils.performanceTest(
        async () => {
          await testUtils.makeRequest('POST', '/api/users/login', {
            body: {
              email: testUser.email,
              password: testUser.plainPassword
            }
          });
        },
        {
          iterations: 50,
          concurrency: 5
        }
      );

      expect(performanceResult.averageResponseTime).toBeLessThan(500); // 500ms average
      expect(performanceResult.p95ResponseTime).toBeLessThan(1000); // 1s P95
      expect(performanceResult.errorRate).toBe(0); // No errors
      expect(performanceResult.throughput).toBeGreaterThan(10); // >10 req/sec
    });
  });
});
