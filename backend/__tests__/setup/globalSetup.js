"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_STATE = exports.TEST_CONFIG = void 0;
exports.default = globalSetup;
exports.cleanup = cleanup;
const dotenv_1 = require("dotenv");
const child_process_1 = require("child_process");
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
(0, dotenv_1.config)({ path: '.env.test' });
exports.TEST_CONFIG = {
    database: {
        url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/x_marketing_test',
        resetBetweenTests: true,
        seedData: true
    },
    redis: {
        host: process.env.TEST_REDIS_HOST || 'localhost',
        port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
        db: parseInt(process.env.TEST_REDIS_DB || '1'),
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
        memoryThreshold: 100 * 1024 * 1024,
        responseTimeThreshold: 1000
    }
};
exports.TEST_STATE = {
    prisma: null,
    redis: null,
    testStartTime: 0,
    testData: new Map(),
    cleanupTasks: []
};
async function globalSetup() {
    console.log('🚀 Starting Enterprise Test Environment Setup...');
    exports.TEST_STATE.testStartTime = Date.now();
    try {
        await setupTestDatabase();
        await setupTestRedis();
        setupEnvironmentVariables();
        await initializeTestUtilities();
        setupPerformanceMonitoring();
        console.log('✅ Enterprise Test Environment Setup Complete');
        console.log(`⏱️  Setup time: ${Date.now() - exports.TEST_STATE.testStartTime}ms`);
    }
    catch (error) {
        console.error('❌ Test Environment Setup Failed:', error);
        await cleanup();
        throw error;
    }
}
async function setupTestDatabase() {
    console.log('📊 Setting up test database...');
    try {
        try {
            (0, child_process_1.execSync)('createdb x_marketing_test', { stdio: 'ignore' });
        }
        catch {
        }
        exports.TEST_STATE.prisma = new client_1.PrismaClient({
            datasources: {
                db: {
                    url: exports.TEST_CONFIG.database.url
                }
            },
            log: process.env.TEST_DB_LOGGING === 'true' ? ['query', 'info', 'warn', 'error'] : []
        });
        await exports.TEST_STATE.prisma.$connect();
        console.log('🔄 Running database migrations...');
        (0, child_process_1.execSync)('npx prisma migrate deploy', {
            env: { ...process.env, DATABASE_URL: exports.TEST_CONFIG.database.url },
            stdio: 'pipe'
        });
        if (exports.TEST_CONFIG.database.seedData) {
            console.log('🌱 Seeding test data...');
            await seedTestData();
        }
        console.log('✅ Test database setup complete');
    }
    catch (error) {
        console.error('❌ Test database setup failed:', error);
        throw error;
    }
}
async function setupTestRedis() {
    console.log('🔴 Setting up test Redis...');
    try {
        exports.TEST_STATE.redis = new ioredis_1.default({
            host: exports.TEST_CONFIG.redis.host,
            port: exports.TEST_CONFIG.redis.port,
            db: exports.TEST_CONFIG.redis.db,
            keyPrefix: exports.TEST_CONFIG.redis.keyPrefix,
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });
        await exports.TEST_STATE.redis.connect();
        if (exports.TEST_CONFIG.redis.flushOnStart) {
            await exports.TEST_STATE.redis.flushdb();
        }
        console.log('✅ Test Redis setup complete');
    }
    catch (error) {
        console.error('❌ Test Redis setup failed:', error);
        console.warn('⚠️  Continuing without Redis (some tests may be skipped)');
    }
}
function setupEnvironmentVariables() {
    console.log('🔧 Setting up test environment variables...');
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = exports.TEST_CONFIG.database.url;
    process.env.REDIS_URL = `redis://${exports.TEST_CONFIG.redis.host}:${exports.TEST_CONFIG.redis.port}/${exports.TEST_CONFIG.redis.db}`;
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
    process.env.RATE_LIMIT_ENABLED = 'false';
    process.env.TELEMETRY_ENABLED = 'false';
    process.env.EXTERNAL_API_TIMEOUT = '5000';
    process.env.LOG_LEVEL = 'error';
    process.env.LLM_SERVICE_URL = `http://${exports.TEST_CONFIG.services.llm.host}:${exports.TEST_CONFIG.services.llm.port}`;
    process.env.TELEGRAM_BOT_URL = `http://${exports.TEST_CONFIG.services.telegram.host}:${exports.TEST_CONFIG.services.telegram.port}`;
    console.log('✅ Test environment variables configured');
}
async function initializeTestUtilities() {
    console.log('🛠️  Initializing test utilities...');
    await initializeTestDataFactories();
    setupTestHelpers();
    await initializeMockServices();
    console.log('✅ Test utilities initialized');
}
async function initializeTestDataFactories() {
    console.log('📦 Test data factories initialized');
}
function setupTestHelpers() {
    global.TEST_CONFIG = exports.TEST_CONFIG;
    global.TEST_STATE = exports.TEST_STATE;
}
async function initializeMockServices() {
    if (exports.TEST_CONFIG.services.llm.mockResponses) {
    }
    if (exports.TEST_CONFIG.services.telegram.mockBot) {
    }
}
function setupPerformanceMonitoring() {
    if (exports.TEST_CONFIG.performance.enableProfiling) {
        console.log('📈 Performance monitoring enabled for tests');
        const memoryMonitor = setInterval(() => {
            const memUsage = process.memoryUsage();
            if (memUsage.heapUsed > exports.TEST_CONFIG.performance.memoryThreshold) {
                console.warn(`⚠️  High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
            }
        }, 5000);
        exports.TEST_STATE.cleanupTasks.push(async () => {
            clearInterval(memoryMonitor);
        });
    }
}
async function seedTestData() {
    if (!exports.TEST_STATE.prisma)
        return;
    try {
        const testUser = await exports.TEST_STATE.prisma.user.upsert({
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
        await exports.TEST_STATE.prisma.campaign.upsert({
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
        exports.TEST_STATE.testData.set('testUser', testUser);
        console.log('✅ Test data seeded successfully');
    }
    catch (error) {
        console.error('❌ Test data seeding failed:', error);
        throw error;
    }
}
async function cleanup() {
    console.log('🧹 Cleaning up test environment...');
    for (const task of exports.TEST_STATE.cleanupTasks) {
        try {
            await task();
        }
        catch (error) {
            console.error('Cleanup task failed:', error);
        }
    }
    if (exports.TEST_STATE.prisma) {
        await exports.TEST_STATE.prisma.$disconnect();
    }
    if (exports.TEST_STATE.redis) {
        await exports.TEST_STATE.redis.quit();
    }
    try {
        const { CorrelationManager } = await Promise.resolve().then(() => __importStar(require('../../src/services/correlationManager')));
        CorrelationManager.resetInstance();
    }
    catch (error) {
        console.warn('Failed to cleanup correlation manager:', error);
    }
    console.log('✅ Test environment cleanup complete');
}
//# sourceMappingURL=globalSetup.js.map