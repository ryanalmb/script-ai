"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = exports.waitFor = exports.createTestUtils = exports.TestUtils = void 0;
const supertest_1 = __importDefault(require("supertest"));
const faker_1 = require("@faker-js/faker");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class TestUtils {
    constructor(config) {
        this.createdRecords = new Map();
        this.prisma = config.prisma;
        this.app = config.app;
        this.redis = config.redis;
    }
    async cleanDatabase() {
        const tablenames = await this.prisma.$queryRaw `
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;
        const tables = tablenames
            .map(({ tablename }) => tablename)
            .filter(name => name !== '_prisma_migrations')
            .map(name => `"public"."${name}"`)
            .join(', ');
        try {
            await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
        }
        catch (error) {
            console.log({ error });
        }
    }
    async resetDatabase() {
        await this.cleanDatabase();
        const sequences = await this.prisma.$queryRaw `
      SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'
    `;
        for (const { sequence_name } of sequences) {
            await this.prisma.$executeRawUnsafe(`ALTER SEQUENCE "${sequence_name}" RESTART WITH 1;`);
        }
    }
    async seedTestData() {
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
    trackCreatedRecord(table, id) {
        if (!this.createdRecords.has(table)) {
            this.createdRecords.set(table, []);
        }
        this.createdRecords.get(table).push(id);
    }
    async cleanupCreatedRecords() {
        const tables = Array.from(this.createdRecords.keys()).reverse();
        for (const table of tables) {
            const ids = this.createdRecords.get(table) || [];
            if (ids.length > 0) {
                try {
                    await this.prisma[table].deleteMany({
                        where: { id: { in: ids } }
                    });
                }
                catch (error) {
                    console.warn(`Failed to cleanup ${table}:`, error);
                }
            }
        }
        this.createdRecords.clear();
    }
    async makeRequest(method, path, options = {}) {
        if (!this.app) {
            throw new Error('Express app not configured for API testing');
        }
        const startTime = Date.now();
        let req = (0, supertest_1.default)(this.app)[method.toLowerCase()](path);
        if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                req = req.set(key, value);
            });
        }
        if (options.auth) {
            req = req.set('Authorization', `Bearer ${options.auth}`);
        }
        if (options.query) {
            req = req.query(options.query);
        }
        if (options.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            req = req.send(options.body);
        }
        const response = await req;
        const responseTime = Date.now() - startTime;
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
    async authenticateUser(userId) {
        const token = jsonwebtoken_1.default.sign({ userId, role: 'USER' }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
        return token;
    }
    async authenticateAdmin() {
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
        const token = jsonwebtoken_1.default.sign({ userId: adminUser.id, role: 'ADMIN' }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
        return token;
    }
    async performanceTest(testFunction, options = {}) {
        const iterations = options.iterations || 100;
        const concurrency = options.concurrency || 1;
        const warmupIterations = options.warmupIterations || 10;
        for (let i = 0; i < warmupIterations; i++) {
            await testFunction();
        }
        const responseTimes = [];
        const errors = [];
        const startTime = Date.now();
        const initialMemory = process.memoryUsage();
        const batches = Math.ceil(iterations / concurrency);
        for (let batch = 0; batch < batches; batch++) {
            const batchPromises = [];
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
        responseTimes.sort((a, b) => a - b);
        const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
        const minResponseTime = responseTimes[0] || 0;
        const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
        const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
        const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
        const throughput = (iterations / totalTime) * 1000;
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
    mockExternalService(serviceName, responses) {
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockImplementation((url, options) => {
            const urlString = url.toString();
            for (const [pattern, response] of Object.entries(responses)) {
                if (urlString.includes(pattern)) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve(response),
                        text: () => Promise.resolve(JSON.stringify(response))
                    });
                }
            }
            return originalFetch(url, options);
        });
    }
    restoreExternalServices() {
        if (jest.isMockFunction(global.fetch)) {
            global.fetch.mockRestore();
        }
    }
    simulateNetworkError() {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    }
    simulateTimeoutError(delay = 5000) {
        global.fetch = jest.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), delay)));
    }
    simulateDatabaseError() {
        const originalQuery = this.prisma.$queryRaw;
        this.prisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Database connection error'));
    }
    restoreDatabase() {
        if (jest.isMockFunction(this.prisma.$queryRaw)) {
            this.prisma.$queryRaw.mockRestore();
        }
    }
    async clearCache() {
        if (this.redis) {
            await this.redis.flushdb();
        }
    }
    async setCacheValue(key, value, ttl) {
        if (this.redis) {
            const serializedValue = JSON.stringify(value);
            if (ttl) {
                await this.redis.setex(key, ttl, serializedValue);
            }
            else {
                await this.redis.set(key, serializedValue);
            }
        }
    }
    async getCacheValue(key) {
        if (this.redis) {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        }
        return null;
    }
    generateSQLInjectionPayloads() {
        return [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --",
            "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
            "' OR 1=1 --"
        ];
    }
    generateXSSPayloads() {
        return [
            "<script>alert('XSS')</script>",
            "javascript:alert('XSS')",
            "<img src=x onerror=alert('XSS')>",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//"
        ];
    }
    generateCSRFToken() {
        return faker_1.faker.string.alphanumeric(32);
    }
    generateRandomData(type) {
        switch (type) {
            case 'email':
                return faker_1.faker.internet.email();
            case 'username':
                return faker_1.faker.internet.userName();
            case 'password':
                return faker_1.faker.internet.password(12);
            case 'phone':
                return faker_1.faker.phone.number();
            case 'url':
                return faker_1.faker.internet.url();
            default:
                return faker_1.faker.lorem.word();
        }
    }
    generateLargePayload(sizeInMB) {
        const sizeInBytes = sizeInMB * 1024 * 1024;
        const chunkSize = 1024;
        let payload = '';
        while (payload.length < sizeInBytes) {
            payload += faker_1.faker.lorem.text().repeat(chunkSize / 100);
        }
        return payload.substring(0, sizeInBytes);
    }
    async cleanup() {
        await this.cleanupCreatedRecords();
        await this.clearCache();
        this.restoreExternalServices();
        this.restoreDatabase();
    }
}
exports.TestUtils = TestUtils;
const createTestUtils = (config) => {
    return new TestUtils(config);
};
exports.createTestUtils = createTestUtils;
const waitFor = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.waitFor = waitFor;
const retry = async (fn, maxAttempts = 3, delay = 1000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await (0, exports.waitFor)(delay);
            }
        }
    }
    throw lastError;
};
exports.retry = retry;
//# sourceMappingURL=testUtils.js.map