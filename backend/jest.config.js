/**
 * Enterprise Jest Configuration - 2025 Edition
 * Comprehensive testing setup with:
 * - Multi-environment testing (unit, integration, e2e)
 * - Advanced coverage reporting
 * - Performance testing integration
 * - Database testing support
 * - Parallel test execution
 * - Custom matchers and utilities
 */

const { pathsToModuleNameMapper } = require('ts-jest');

const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/__tests__/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        types: ['jest', 'node', 'supertest'],
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
  },
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup/globalSetup.ts',
    '<rootDir>/__tests__/setup/customMatchers.ts'
  ],
  globalSetup: '<rootDir>/__tests__/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/__tests__/setup/globalTeardown.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/*.config.ts',
    '!src/migrations/**',
    '!src/seeds/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'cobertura'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/middleware/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  detectLeaks: true,
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',
  logHeapUsage: true,
  errorOnDeprecated: true
};

// Environment-specific configurations
const environments = {
  unit: {
    ...baseConfig,
    testMatch: [
      '**/__tests__/unit/**/*.test.ts',
      '**/__tests__/unit/**/*.spec.ts'
    ],
    testEnvironment: 'node',
    displayName: 'Unit Tests',
    collectCoverage: true
  },

  integration: {
    ...baseConfig,
    testMatch: [
      '**/__tests__/integration/**/*.test.ts',
      '**/__tests__/integration/**/*.spec.ts'
    ],
    testEnvironment: 'node',
    displayName: 'Integration Tests',
    setupFilesAfterEnv: [
      ...baseConfig.setupFilesAfterEnv,
      '<rootDir>/__tests__/setup/integrationSetup.ts'
    ],
    testTimeout: 60000,
    collectCoverage: false
  },

  e2e: {
    ...baseConfig,
    testMatch: [
      '**/__tests__/e2e/**/*.test.ts',
      '**/__tests__/e2e/**/*.spec.ts'
    ],
    testEnvironment: 'node',
    displayName: 'End-to-End Tests',
    setupFilesAfterEnv: [
      ...baseConfig.setupFilesAfterEnv,
      '<rootDir>/__tests__/setup/e2eSetup.ts'
    ],
    testTimeout: 120000,
    maxWorkers: 1, // E2E tests run sequentially
    collectCoverage: false
  },

  performance: {
    ...baseConfig,
    testMatch: [
      '**/__tests__/performance/**/*.test.ts',
      '**/__tests__/performance/**/*.spec.ts'
    ],
    testEnvironment: 'node',
    displayName: 'Performance Tests',
    testTimeout: 300000, // 5 minutes for performance tests
    maxWorkers: 1,
    collectCoverage: false
  },

  security: {
    ...baseConfig,
    testMatch: [
      '**/__tests__/security/**/*.test.ts',
      '**/__tests__/security/**/*.spec.ts'
    ],
    testEnvironment: 'node',
    displayName: 'Security Tests',
    testTimeout: 180000, // 3 minutes for security tests
    collectCoverage: false
  }
};

// Export configuration based on environment
const testType = process.env.TEST_TYPE || 'unit';
module.exports = environments[testType] || baseConfig;
