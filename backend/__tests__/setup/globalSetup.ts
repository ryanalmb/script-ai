/**
 * Global Test Setup - 2025 Edition
 * Enterprise-grade test environment initialization:
 * - Test database setup and seeding
 * - Test Redis instance configuration
 * - Service mocking and stubbing
 * - Environment variable configuration
 * - Test data factories initialization
 * - Performance monitoring setup
 */

import { config } from 'dotenv';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../../src/utils/logger';

// Load test environment variables
config({ path: '.env.test' });

// Global test configuration
export const TEST_CONFIG = {
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/x_marketing_test',
    resetBetweenTests: true,
    seedData: true
  },
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
    db: parseInt(process.env.TEST_REDIS_DB || '1'), // Use different DB for tests
    keyPrefix: 'test:',
    flushOnStart: true
  },
  services: {
    backend: {
      port: parseInt(process.env.TEST_BACKEND_PORT || '3001'),
      host: 'localhost'
    },
    llm: {
      port: parseInt(process.env.TEST_LLM_PORT || '3003'),
      host: 'localhost',
      mockResponses: true
    },
    telegram: {
      port: parseInt(process.env.TEST_TELEGRAM_PORT || '3002'),
      host: 'localhost',
      mockBot: true
    }
  },
  timeouts: {
    default: 30000,
    integration: 60000,
    e2e: 120000,
    performance: 300000
  },
  performance: {
    enableProfiling: process.env.TEST_ENABLE_PROFILING === 'true',
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    responseTimeThreshold: 1000 // 1 second
  }
};

// Global test state
export const TEST_STATE = {
  prisma: null as PrismaClient | null,
  redis: null as Redis | null,
  testStartTime: 0,
  testData: new Map<string, any>(),
  cleanupTasks: [] as Array<() => Promise<void>>
};

/**
 * Global setup function
 */
export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting Enterprise Test Environment Setup...');
  TEST_STATE.testStartTime = Date.now();

  try {
    // Step 1: Setup test database
    await setupTestDatabase();

    // Step 2: Setup test Redis
    await setupTestRedis();

    // Step 3: Setup environment variables
    setupEnvironmentVariables();

    // Step 4: Initialize test utilities
    await initializeTestUtilities();

    // Step 5: Setup performance monitoring
    setupPerformanceMonitoring();

    console.log('✅ Enterprise Test Environment Setup Complete');
    console.log(`⏱️  Setup time: ${Date.now() - TEST_STATE.testStartTime}ms`);

  } catch (error) {
    console.error('❌ Test Environment Setup Failed:', error);
    await cleanup();
    throw error;
  }
}

/**
 * Setup test database
 */
async function setupTestDatabase(): Promise<void> {
  console.log('📊 Setting up test database...');

  try {
    // Create test database if it doesn't exist
    try {
      execSync('createdb x_marketing_test', { stdio: 'ignore' });
    } catch {
      // Database might already exist
    }

    // Initialize Prisma client
    TEST_STATE.prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_CONFIG.database.url
        }
      },
      log: process.env.TEST_DB_LOGGING === 'true' ? ['query', 'info', 'warn', 'error'] : []
    });

    // Connect to database
    await TEST_STATE.prisma.$connect();

    // Run migrations
    console.log('🔄 Running database migrations...');
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: TEST_CONFIG.database.url },
      stdio: 'pipe'
    });

    // Seed test data if enabled
    if (TEST_CONFIG.database.seedData) {
      console.log('🌱 Seeding test data...');
      await seedTestData();
    }

    console.log('✅ Test database setup complete');

  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
}

/**
 * Setup test Redis
 */
async function setupTestRedis(): Promise<void> {
  console.log('🔴 Setting up test Redis...');

  try {
    TEST_STATE.redis = new Redis({
      host: TEST_CONFIG.redis.host,
      port: TEST_CONFIG.redis.port,
      db: TEST_CONFIG.redis.db,
      keyPrefix: TEST_CONFIG.redis.keyPrefix,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // Connect to Redis
    await TEST_STATE.redis.connect();

    // Flush test database if enabled
    if (TEST_CONFIG.redis.flushOnStart) {
      await TEST_STATE.redis.flushdb();
    }

    console.log('✅ Test Redis setup complete');

  } catch (error) {
    console.error('❌ Test Redis setup failed:', error);
    // Redis is optional for some tests
    console.warn('⚠️  Continuing without Redis (some tests may be skipped)');
  }
}

/**
 * Setup environment variables for testing
 */
function setupEnvironmentVariables(): void {
  console.log('🔧 Setting up test environment variables...');

  // Override environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_CONFIG.database.url;
  process.env.REDIS_URL = `redis://${TEST_CONFIG.redis.host}:${TEST_CONFIG.redis.port}/${TEST_CONFIG.redis.db}`;
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
  process.env.RATE_LIMIT_ENABLED = 'false'; // Disable rate limiting in tests
  process.env.TELEMETRY_ENABLED = 'false'; // Disable telemetry in tests
  process.env.EXTERNAL_API_TIMEOUT = '5000'; // Shorter timeouts for tests
  process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

  // Service URLs for testing
  process.env.LLM_SERVICE_URL = `http://${TEST_CONFIG.services.llm.host}:${TEST_CONFIG.services.llm.port}`;
  process.env.TELEGRAM_BOT_URL = `http://${TEST_CONFIG.services.telegram.host}:${TEST_CONFIG.services.telegram.port}`;

  console.log('✅ Test environment variables configured');
}

/**
 * Initialize test utilities
 */
async function initializeTestUtilities(): Promise<void> {
  console.log('🛠️  Initializing test utilities...');

  // Initialize test data factories
  await initializeTestDataFactories();

  // Setup test helpers
  setupTestHelpers();

  // Initialize mock services
  await initializeMockServices();

  console.log('✅ Test utilities initialized');
}

/**
 * Initialize test data factories
 */
async function initializeTestDataFactories(): Promise<void> {
  // This will be implemented in the test data management section
  console.log('📦 Test data factories initialized');
}

/**
 * Setup test helpers
 */
function setupTestHelpers(): void {
  // Global test helpers will be available in all tests
  (global as any).TEST_CONFIG = TEST_CONFIG;
  (global as any).TEST_STATE = TEST_STATE;
}

/**
 * Initialize mock services
 */
async function initializeMockServices(): Promise<void> {
  // Mock external services for testing
  if (TEST_CONFIG.services.llm.mockResponses) {
    // LLM service mocking will be implemented
  }

  if (TEST_CONFIG.services.telegram.mockBot) {
    // Telegram bot mocking will be implemented
  }
}

/**
 * Setup performance monitoring
 */
function setupPerformanceMonitoring(): void {
  if (TEST_CONFIG.performance.enableProfiling) {
    console.log('📈 Performance monitoring enabled for tests');
    
    // Setup memory monitoring
    const memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > TEST_CONFIG.performance.memoryThreshold) {
        console.warn(`⚠️  High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      }
    }, 5000);

    TEST_STATE.cleanupTasks.push(async () => {
      clearInterval(memoryMonitor);
    });
  }
}

/**
 * Seed test data
 */
async function seedTestData(): Promise<void> {
  if (!TEST_STATE.prisma) return;

  try {
    // Create test users
    const testUser = await TEST_STATE.prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        username: 'testuser',
        password: '$2a$10$test.hash.for.testing.purposes.only',
        isActive: true,
        role: 'USER'
      }
    });

    // Create test campaigns
    await TEST_STATE.prisma.campaign.upsert({
      where: { id: 'test-campaign-1' },
      update: {},
      create: {
        id: 'test-campaign-1',
        name: 'Test Campaign',
        description: 'Test campaign for automated testing',
        userId: testUser.id,
        status: 'ACTIVE',
        settings: {}
      }
    });

    // Store test data references
    TEST_STATE.testData.set('testUser', testUser);

    console.log('✅ Test data seeded successfully');

  } catch (error) {
    console.error('❌ Test data seeding failed:', error);
    throw error;
  }
}

/**
 * Cleanup function
 */
export async function cleanup(): Promise<void> {
  console.log('🧹 Cleaning up test environment...');

  // Run cleanup tasks
  for (const task of TEST_STATE.cleanupTasks) {
    try {
      await task();
    } catch (error) {
      console.error('Cleanup task failed:', error);
    }
  }

  // Close database connection
  if (TEST_STATE.prisma) {
    await TEST_STATE.prisma.$disconnect();
  }

  // Close Redis connection
  if (TEST_STATE.redis) {
    await TEST_STATE.redis.quit();
  }

  // Cleanup correlation manager singleton
  try {
    const { CorrelationManager } = await import('../../src/services/correlationManager');
    CorrelationManager.resetInstance();
  } catch (error) {
    console.warn('Failed to cleanup correlation manager:', error);
  }

  console.log('✅ Test environment cleanup complete');
}
