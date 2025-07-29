/**
 * Jest Configuration for Twikit Testing Suite - Task 31
 * 
 * Comprehensive Jest configuration for all Twikit tests including:
 * - Unit tests for individual services
 * - Integration tests for service interactions
 * - Load tests for performance validation
 * - End-to-end tests for complete workflows
 * - Test utilities and mocking configuration
 */

const path = require('path');

module.exports = {
  // Test environment configuration
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: path.resolve(__dirname, '../../../'),
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/twikit/**/*.test.ts',
    '<rootDir>/tests/twikit/**/*.spec.ts'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/'
  ],
  
  // TypeScript configuration
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
          esModuleInterop: true,
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true
        }
      }
    }]
  },
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@twikit/(.*)$': '<rootDir>/tests/twikit/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/twikit/setup/testSetup.ts'
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/tests/twikit/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/twikit/setup/globalTeardown.ts',
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/twikit',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/twikitSessionManager.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/twikitSecurityManager.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/twikitCacheManager.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/services/twikit*.ts',
    'src/utils/*.ts',
    'src/lib/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  
  // Test timeout configuration
  testTimeout: 60000, // 60 seconds for comprehensive tests
  
  // Verbose output
  verbose: true,
  
  // Error handling
  bail: false, // Continue running tests even if some fail
  
  // Test result processor
  testResultsProcessor: '<rootDir>/tests/twikit/utils/testResultsProcessor.js',
  
  // Custom reporters
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: '<rootDir>/coverage/twikit/html-report',
      filename: 'twikit-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Twikit Test Report',
      logoImgPath: undefined,
      inlineSource: false
    }],
    ['jest-junit', {
      outputDirectory: '<rootDir>/coverage/twikit',
      outputName: 'twikit-junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],
  
  // Test categories configuration
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/twikit/unit/**/*.test.ts'],
      testTimeout: 30000
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/twikit/integration/**/*.test.ts'],
      testTimeout: 45000
    },
    {
      displayName: 'Load Tests',
      testMatch: ['<rootDir>/tests/twikit/load/**/*.test.ts'],
      testTimeout: 120000 // 2 minutes for load tests
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/tests/twikit/e2e/**/*.test.ts'],
      testTimeout: 180000 // 3 minutes for E2E tests
    }
  ],
  
  // Environment variables for testing
  setupFiles: [
    '<rootDir>/tests/twikit/setup/envSetup.ts'
  ],
  
  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  
  // Watch mode configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Test sequencing
  maxWorkers: '50%', // Use 50% of available CPU cores
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/twikit',
  
  // Error reporting
  errorOnDeprecated: true,
  
  // Test filtering
  testNamePattern: undefined, // Can be set via CLI
  
  // Snapshot configuration
  updateSnapshot: false, // Set to true when updating snapshots
  
  // Custom matchers and utilities
  setupFilesAfterEnv: [
    '<rootDir>/tests/twikit/setup/testSetup.ts',
    '<rootDir>/tests/twikit/setup/customMatchers.ts'
  ]
};
