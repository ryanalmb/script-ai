/**
 * Twikit Test Setup - Task 31
 * 
 * Global test setup configuration for all Twikit tests.
 * Configures test environment, mocks, utilities, and common test patterns.
 */

import { jest } from '@jest/globals';
import { config } from 'dotenv';
import { logger } from '../../../src/utils/logger';

// Load test environment variables
config({ path: '.env.test' });

// ============================================================================
// GLOBAL TEST CONFIGURATION
// ============================================================================

// Increase timeout for comprehensive tests
jest.setTimeout(60000);

// Mock console methods to reduce noise during testing
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging during tests
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/twikit_test';
process.env.TEST_REDIS_HOST = process.env.TEST_REDIS_HOST || 'localhost';
process.env.TEST_REDIS_PORT = process.env.TEST_REDIS_PORT || '6379';
process.env.TEST_REDIS_DB = process.env.TEST_REDIS_DB || '1';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock external HTTP requests
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} }))
  })),
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  patch: jest.fn(() => Promise.resolve({ data: {} }))
}));

// Mock file system operations for security
jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Promise.resolve(Buffer.from('mock file content'))),
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  access: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({ isFile: () => true, isDirectory: () => false })),
  readdir: jest.fn(() => Promise.resolve(['mock-file.txt']))
}));

// Mock crypto for consistent testing
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    randomUUID: jest.fn(() => 'mock-uuid-12345'),
    randomBytes: jest.fn((size: number) => Buffer.alloc(size, 'a')),
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'mock-hash-digest')
    })),
    createCipher: jest.fn(() => ({
      update: jest.fn(() => Buffer.from('encrypted')),
      final: jest.fn(() => Buffer.from('final')),
      setAAD: jest.fn(),
      getAuthTag: jest.fn(() => Buffer.from('auth-tag'))
    })),
    createDecipher: jest.fn(() => ({
      update: jest.fn(() => Buffer.from('decrypted')),
      final: jest.fn(() => Buffer.from('final')),
      setAuthTag: jest.fn(),
      setAAD: jest.fn()
    })),
    pbkdf2Sync: jest.fn(() => Buffer.from('derived-key')),
    scryptSync: jest.fn(() => Buffer.from('scrypt-key'))
  };
});

// ============================================================================
// GLOBAL TEST UTILITIES
// ============================================================================

/**
 * Global test utilities available in all tests
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidUUID(): R;
      toBeEncrypted(): R;
      toHaveValidTimestamp(): R;
    }
  }
  
  var testUtils: {
    generateMockCredentials: () => any;
    generateMockSession: () => any;
    generateMockSecurityEvent: () => any;
    createMockProxy: () => any;
    waitFor: (condition: () => boolean | Promise<boolean>, timeout?: number) => Promise<void>;
    sleep: (ms: number) => Promise<void>;
  };
}

// Global test utilities
global.testUtils = {
  /**
   * Generate mock credentials for testing
   */
  generateMockCredentials: () => ({
    username: `test_user_${Math.random().toString(36).substr(2, 9)}`,
    email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
    password: `test_password_${Math.random().toString(36).substr(2, 9)}`
  }),

  /**
   * Generate mock session data
   */
  generateMockSession: () => ({
    sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
    accountId: `account_${Math.random().toString(36).substr(2, 9)}`,
    isActive: true,
    isAuthenticated: false,
    createdAt: new Date(),
    lastActivity: new Date()
  }),

  /**
   * Generate mock security event
   */
  generateMockSecurityEvent: () => ({
    type: 'auth_success',
    severity: 'low',
    source: {
      service: 'test_service',
      instance: 'test_instance',
      user: 'test_user'
    },
    details: {
      description: 'Mock security event for testing',
      data: { test: true, timestamp: Date.now() }
    }
  }),

  /**
   * Create mock proxy configuration
   */
  createMockProxy: () => ({
    host: '127.0.0.1',
    port: 8080 + Math.floor(Math.random() * 100),
    username: `proxy_user_${Math.random().toString(36).substr(2, 5)}`,
    password: `proxy_pass_${Math.random().toString(36).substr(2, 5)}`
  }),

  /**
   * Wait for a condition to be true
   */
  waitFor: async (condition: () => boolean | Promise<boolean>, timeout: number = 5000): Promise<void> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Sleep for specified milliseconds
   */
  sleep: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process during tests
});

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Performance monitoring for tests
 */
let testStartTime: number;
let testMemoryUsage: NodeJS.MemoryUsage;

beforeEach(() => {
  testStartTime = Date.now();
  testMemoryUsage = process.memoryUsage();
});

afterEach(() => {
  const testDuration = Date.now() - testStartTime;
  const currentMemoryUsage = process.memoryUsage();
  const memoryDelta = currentMemoryUsage.heapUsed - testMemoryUsage.heapUsed;
  
  // Log performance warnings for slow tests
  if (testDuration > 10000) { // 10 seconds
    console.warn(`Slow test detected: ${testDuration}ms`);
  }
  
  // Log memory warnings for memory-intensive tests
  if (memoryDelta > 50 * 1024 * 1024) { // 50MB
    console.warn(`High memory usage detected: ${Math.round(memoryDelta / 1024 / 1024)}MB`);
  }
});

// ============================================================================
// TEST CATEGORIES
// ============================================================================

/**
 * Test category helpers
 */
export const testCategories = {
  unit: (name: string, fn: () => void) => {
    describe(`[UNIT] ${name}`, fn);
  },
  
  integration: (name: string, fn: () => void) => {
    describe(`[INTEGRATION] ${name}`, fn);
  },
  
  load: (name: string, fn: () => void) => {
    describe(`[LOAD] ${name}`, fn);
  },
  
  e2e: (name: string, fn: () => void) => {
    describe(`[E2E] ${name}`, fn);
  },
  
  security: (name: string, fn: () => void) => {
    describe(`[SECURITY] ${name}`, fn);
  }
};

// ============================================================================
// CLEANUP
// ============================================================================

// Global cleanup after all tests
afterAll(async () => {
  // Restore console
  global.console = originalConsole;
  
  // Clear all timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Export test utilities for use in test files
export { testUtils } from './testUtils';
export { createTwikitTestUtils } from '../utils/twikitTestUtils';

// Log test setup completion
logger.info('Twikit test setup completed', {
  environment: process.env.NODE_ENV,
  databaseUrl: process.env.TEST_DATABASE_URL ? 'configured' : 'not configured',
  redisHost: process.env.TEST_REDIS_HOST,
  logLevel: process.env.LOG_LEVEL
});
