/**
 * Test Utilities - 2025 Edition
 * Enterprise-grade testing utilities:
 * - Database helpers and cleanup
 * - API testing utilities
 * - Mock service management
 * - Performance testing helpers
 * - Security testing utilities
 * - Error simulation helpers
 */

import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import request from 'supertest';
import { faker } from '@faker-js/faker';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

// Test utilities configuration
export interface TestUtilsConfig {
  prisma: PrismaClient;
  app?: Express;
  redis?: Redis;
}

// API test response interface
export interface ApiTestResponse {
  status: number;
  body: any;
  headers: any;
  correlationId?: string;
  traceId?: string;
  responseTime: number;
}

// Performance test result interface
export interface PerformanceTestResult {
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
}

/**
 * Enterprise Test Utilities
 */
export class TestUtils {
  private prisma: PrismaClient;
  private app?: Express;
  private redis?: Redis;
  private createdRecords: Map<string, string[]> = new Map();

  constructor(config: TestUtilsConfig) {
    this.prisma = config.prisma;
    this.app = config.app;
    this.redis = config.redis;
  }

  /**
   * Database Utilities
   */
  async cleanDatabase(): Promise<void> {
    const tablenames = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter(name => name !== '_prisma_migrations')
      .map(name => `"public"."${name}"`)
      .join(', ');

    try {
      await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch (error) {
      console.log({ error });
    }
  }

  async resetDatabase(): Promise<void> {
    await this.cleanDatabase();
    
    // Reset sequences
    const sequences = await this.prisma.$queryRaw<Array<{ sequence_name: string }>>`
      SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'
    `;

    for (const { sequence_name } of sequences) {
      await this.prisma.$executeRawUnsafe(`ALTER SEQUENCE "${sequence_name}" RESTART WITH 1;`);
    }
  }

  async seedTestData(): Promise<void> {
    // Create basic test data
    const testUser = await this.prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        password: '$2a$10$test.hash.for.testing.purposes.only',
        isActive: true,
        emailVerified: true
      }
    });

    this.trackCreatedRecord('user', testUser.id);
  }

  trackCreatedRecord(table: string, id: string): void {
    if (!this.createdRecords.has(table)) {
      this.createdRecords.set(table, []);
    }
    this.createdRecords.get(table)!.push(id);
  }

  async cleanupCreatedRecords(): Promise<void> {
    // Clean up in reverse order to handle foreign key constraints
    const tables = Array.from(this.createdRecords.keys()).reverse();
    
    for (const table of tables) {
      const ids = this.createdRecords.get(table) || [];
      if (ids.length > 0) {
        try {
          await (this.prisma as any)[table].deleteMany({
            where: { id: { in: ids } }
          });
        } catch (error) {
          console.warn(`Failed to cleanup ${table}:`, error);
        }
      }
    }
    
    this.createdRecords.clear();
  }

  /**
   * API Testing Utilities
   */
  async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      query?: Record<string, string>;
      auth?: string;
      expectStatus?: number;
    } = {}
  ): Promise<ApiTestResponse> {
    if (!this.app) {
      throw new Error('Express app not configured for API testing');
    }

    const startTime = Date.now();
    let req = request(this.app)[method.toLowerCase() as 'get'](path);

    // Add headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        req = req.set(key, value);
      });
    }

    // Add auth
    if (options.auth) {
      req = req.set('Authorization', `Bearer ${options.auth}`);
    }

    // Add query parameters
    if (options.query) {
      req = req.query(options.query);
    }

    // Add body for POST/PUT/PATCH
    if (options.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      req = req.send(options.body);
    }

    const response = await req;
    const responseTime = Date.now() - startTime;

    // Validate expected status if provided
    if (options.expectStatus && response.status !== options.expectStatus) {
      throw new Error(`Expected status ${options.expectStatus}, got ${response.status}`);
    }

    return {
      status: response.status,
      body: response.body,
      headers: response.headers,
      correlationId: response.headers['x-correlation-id'],
      traceId: response.headers['x-trace-id'],
      responseTime
    };
  }

  async authenticateUser(userId: string): Promise<string> {
    const token = jwt.sign(
      { userId, role: 'USER' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    return token;
  }

  async authenticateAdmin(): Promise<string> {
    const adminUser = await this.prisma.user.create({
      data: {
        email: `admin-${Date.now()}@example.com`,
        username: `admin${Date.now()}`,
        password: '$2a$10$test.hash.for.testing.purposes.only',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true
      }
    });

    this.trackCreatedRecord('user', adminUser.id);

    const token = jwt.sign(
      { userId: adminUser.id, role: 'ADMIN' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    return token;
  }

  /**
   * Performance Testing Utilities
   */
  async performanceTest(
    testFunction: () => Promise<any>,
    options: {
      iterations?: number;
      concurrency?: number;
      warmupIterations?: number;
    } = {}
  ): Promise<PerformanceTestResult> {
    const iterations = options.iterations || 100;
    const concurrency = options.concurrency || 1;
    const warmupIterations = options.warmupIterations || 10;

    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await testFunction();
    }

    const responseTimes: number[] = [];
    const errors: number[] = [];
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    // Run tests
    const batches = Math.ceil(iterations / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<any>[] = [];
      const batchSize = Math.min(concurrency, iterations - batch * concurrency);
      
      for (let i = 0; i < batchSize; i++) {
        const testStart = Date.now();
        const promise = testFunction()
          .then(() => {
            responseTimes.push(Date.now() - testStart);
          })
          .catch(() => {
            errors.push(Date.now() - testStart);
          });
        
        batchPromises.push(promise);
      }
      
      await Promise.all(batchPromises);
    }

    const totalTime = Date.now() - startTime;
    const finalMemory = process.memoryUsage();

    // Calculate statistics
    responseTimes.sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const minResponseTime = responseTimes[0] || 0;
    const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
    const throughput = (iterations / totalTime) * 1000; // requests per second
    const errorRate = errors.length / iterations;

    return {
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      throughput,
      errorRate,
      memoryUsage: {
        rss: finalMemory.rss - initialMemory.rss,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        external: finalMemory.external - initialMemory.external,
        arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers
      }
    };
  }

  /**
   * Mock Service Utilities
   */
  mockExternalService(serviceName: string, responses: Record<string, any>): void {
    // Mock HTTP requests to external services
    const originalFetch = global.fetch;
    
    global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
      const urlString = url.toString();
      
      for (const [pattern, response] of Object.entries(responses)) {
        if (urlString.includes(pattern)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(response),
            text: () => Promise.resolve(JSON.stringify(response))
          } as Response);
        }
      }
      
      // Fallback to original fetch for unmocked requests
      return originalFetch(url, options);
    });
  }

  restoreExternalServices(): void {
    if (jest.isMockFunction(global.fetch)) {
      (global.fetch as jest.Mock).mockRestore();
    }
  }

  /**
   * Error Simulation Utilities
   */
  simulateNetworkError(): void {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
  }

  simulateTimeoutError(delay: number = 5000): void {
    global.fetch = jest.fn().mockImplementation(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), delay)
      )
    );
  }

  simulateDatabaseError(): void {
    const originalQuery = this.prisma.$queryRaw;
    this.prisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Database connection error'));
  }

  restoreDatabase(): void {
    if (jest.isMockFunction(this.prisma.$queryRaw)) {
      (this.prisma.$queryRaw as jest.Mock).mockRestore();
    }
  }

  /**
   * Cache Testing Utilities
   */
  async clearCache(): Promise<void> {
    if (this.redis) {
      await this.redis.flushdb();
    }
  }

  async setCacheValue(key: string, value: any, ttl?: number): Promise<void> {
    if (this.redis) {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
    }
  }

  async getCacheValue(key: string): Promise<any> {
    if (this.redis) {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    }
    return null;
  }

  /**
   * Security Testing Utilities
   */
  generateSQLInjectionPayloads(): string[] {
    return [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
      "' OR 1=1 --"
    ];
  }

  generateXSSPayloads(): string[] {
    return [
      "<script>alert('XSS')</script>",
      "javascript:alert('XSS')",
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "';alert('XSS');//"
    ];
  }

  generateCSRFToken(): string {
    return faker.string.alphanumeric(32);
  }

  /**
   * Data Generation Utilities
   */
  generateRandomData(type: 'email' | 'username' | 'password' | 'phone' | 'url'): string {
    switch (type) {
      case 'email':
        return faker.internet.email();
      case 'username':
        return faker.internet.userName();
      case 'password':
        return faker.internet.password(12);
      case 'phone':
        return faker.phone.number();
      case 'url':
        return faker.internet.url();
      default:
        return faker.lorem.word();
    }
  }

  generateLargePayload(sizeInMB: number): string {
    const sizeInBytes = sizeInMB * 1024 * 1024;
    const chunkSize = 1024;
    let payload = '';
    
    while (payload.length < sizeInBytes) {
      payload += faker.lorem.text().repeat(chunkSize / 100);
    }
    
    return payload.substring(0, sizeInBytes);
  }

  /**
   * Cleanup utilities
   */
  async cleanup(): Promise<void> {
    await this.cleanupCreatedRecords();
    await this.clearCache();
    this.restoreExternalServices();
    this.restoreDatabase();
  }
}

// Export utility functions
export const createTestUtils = (config: TestUtilsConfig): TestUtils => {
  return new TestUtils(config);
};

export const waitFor = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await waitFor(delay);
      }
    }
  }
  
  throw lastError!;
};
