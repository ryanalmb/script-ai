"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const serviceManager_1 = require("../../src/services/serviceManager");
const connectionManager_1 = require("../../src/config/connectionManager");
const logger_1 = require("../../src/utils/logger");
process.env.ENTERPRISE_MODE = 'true';
process.env.USE_TESTCONTAINERS = 'true';
process.env.NODE_ENV = 'test';
(0, globals_1.describe)('Enterprise System Integration', () => {
    let orchestrator;
    (0, globals_1.beforeAll)(async () => {
        logger_1.logger.info('🧪 Starting Enterprise System Integration Tests...');
        await serviceManager_1.serviceManager.initialize();
        orchestrator = serviceManager_1.serviceManager.getEnterpriseOrchestrator();
        (0, globals_1.expect)(orchestrator).toBeDefined();
        await new Promise(resolve => setTimeout(resolve, 5000));
    }, 120000);
    (0, globals_1.afterAll)(async () => {
        logger_1.logger.info('🧹 Cleaning up Enterprise System Integration Tests...');
        await serviceManager_1.serviceManager.shutdown();
    }, 60000);
    (0, globals_1.describe)('Enterprise Database Manager', () => {
        (0, globals_1.test)('should initialize with real PostgreSQL', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            (0, globals_1.expect)(dbManager).toBeDefined();
            const health = await dbManager.performHealthCheck();
            (0, globals_1.expect)(health.postgres).toBe(true);
            (0, globals_1.expect)(health.redis).toBe(true);
        });
        (0, globals_1.test)('should have all PostgreSQL system tables', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const systemTables = [
                'pg_stat_activity',
                'pg_stat_database',
                'pg_stat_user_tables',
                'pg_stat_statements',
                'pg_database',
                'information_schema.tables'
            ];
            for (const table of systemTables) {
                const result = await dbManager.executeQuery(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
                (0, globals_1.expect)(result).toBeDefined();
                (0, globals_1.expect)(Array.isArray(result)).toBe(true);
            }
        });
        (0, globals_1.test)('should support PostgreSQL functions', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const functions = [
                'SELECT current_database()',
                'SELECT version()',
                'SELECT pg_database_size(current_database())',
                'SELECT pg_size_pretty(pg_database_size(current_database()))',
                'SELECT current_timestamp',
                'SELECT extract(epoch from now())',
            ];
            for (const func of functions) {
                const result = await dbManager.executeQuery(func);
                (0, globals_1.expect)(result).toBeDefined();
                (0, globals_1.expect)(result.length).toBeGreaterThan(0);
            }
        });
        (0, globals_1.test)('should provide comprehensive metrics', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const metrics = dbManager.getMetrics();
            (0, globals_1.expect)(metrics).toBeDefined();
            (0, globals_1.expect)(metrics.postgres).toBeDefined();
            (0, globals_1.expect)(metrics.redis).toBeDefined();
            (0, globals_1.expect)(typeof metrics.postgres.totalConnections).toBe('number');
            (0, globals_1.expect)(typeof metrics.postgres.activeConnections).toBe('number');
            (0, globals_1.expect)(typeof metrics.postgres.queryCount).toBe('number');
            (0, globals_1.expect)(typeof metrics.redis.connectedClients).toBe('number');
            (0, globals_1.expect)(typeof metrics.redis.usedMemory).toBe('number');
        });
        (0, globals_1.test)('should handle transactions properly', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const client = await dbManager.getPostgresClient();
            try {
                await client.query('BEGIN');
                await client.query(`
          CREATE TEMPORARY TABLE test_transaction (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100)
          )
        `);
                await client.query('INSERT INTO test_transaction (name) VALUES ($1)', ['test']);
                const result = await client.query('SELECT * FROM test_transaction WHERE name = $1', ['test']);
                (0, globals_1.expect)(result.rows.length).toBe(1);
                await client.query('COMMIT');
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        });
    });
    (0, globals_1.describe)('Service Orchestration', () => {
        (0, globals_1.test)('should register all core services', async () => {
            const registry = orchestrator.getServiceRegistry();
            const expectedServices = ['backend-api', 'frontend-app', 'telegram-bot', 'llm-service'];
            for (const serviceName of expectedServices) {
                (0, globals_1.expect)(registry[serviceName]).toBeDefined();
                (0, globals_1.expect)(registry[serviceName].config).toBeDefined();
                (0, globals_1.expect)(registry[serviceName].status).toBeDefined();
            }
        });
        (0, globals_1.test)('should perform health checks', async () => {
            const systemHealth = await orchestrator.getSystemHealth();
            (0, globals_1.expect)(systemHealth).toBeDefined();
            (0, globals_1.expect)(systemHealth.overall).toBeDefined();
            (0, globals_1.expect)(['healthy', 'degraded', 'unhealthy']).toContain(systemHealth.overall);
            (0, globals_1.expect)(systemHealth.services).toBeDefined();
            (0, globals_1.expect)(systemHealth.database).toBeDefined();
        });
        (0, globals_1.test)('should handle service dependencies', async () => {
            const registry = orchestrator.getServiceRegistry();
            const frontend = registry['frontend-app'];
            (0, globals_1.expect)(frontend.config.dependencies).toContain('backend-api');
            const bot = registry['telegram-bot'];
            (0, globals_1.expect)(bot.config.dependencies).toContain('backend-api');
            const llm = registry['llm-service'];
            (0, globals_1.expect)(llm.config.dependencies).toContain('backend-api');
        });
        (0, globals_1.test)('should support inter-service communication', async () => {
            (0, globals_1.expect)(typeof orchestrator.callService).toBe('function');
        });
    });
    (0, globals_1.describe)('Connection Manager Integration', () => {
        (0, globals_1.test)('should use enterprise database manager', async () => {
            await connectionManager_1.connectionManager.initialize();
            const result = await connectionManager_1.connectionManager.executeQuery('SELECT 1 as test');
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.length).toBe(1);
            (0, globals_1.expect)(result[0].test).toBe(1);
        });
        (0, globals_1.test)('should handle complex queries', async () => {
            const query = `
        SELECT
          n.nspname as schema_name,
          c.relname as table_name,
          a.attname as column_name,
          t.typname as type_name,
          a.attnum as column_number
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
        WHERE n.nspname = 'information_schema'
        AND c.relname = 'tables'
        AND a.attnum > 0
        AND NOT a.attisdropped
        ORDER BY a.attnum
        LIMIT 5
      `;
            const result = await connectionManager_1.connectionManager.executeQuery(query);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(Array.isArray(result)).toBe(true);
        });
        (0, globals_1.test)('should provide performance metrics', async () => {
            const result = await connectionManager_1.connectionManager.executeQuery('SELECT current_timestamp');
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.length).toBe(1);
            const dbManager = orchestrator.getDatabaseManager();
            const metrics = dbManager.getMetrics();
            (0, globals_1.expect)(metrics).toBeDefined();
            (0, globals_1.expect)(metrics.postgres).toBeDefined();
            (0, globals_1.expect)(typeof metrics.postgres.queryCount).toBe('number');
        });
    });
    (0, globals_1.describe)('Performance and Reliability', () => {
        (0, globals_1.test)('should handle concurrent queries', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const promises = Array.from({ length: 10 }, (_, i) => dbManager.executeQuery('SELECT $1 as query_id', [i]));
            const results = await Promise.all(promises);
            (0, globals_1.expect)(results.length).toBe(10);
            results.forEach((result, index) => {
                (0, globals_1.expect)(parseInt(result[0].query_id)).toBe(index);
            });
        });
        (0, globals_1.test)('should maintain connection pool health', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            for (let i = 0; i < 50; i++) {
                const result = await dbManager.executeQuery('SELECT $1 as iteration', [i]);
                (0, globals_1.expect)(parseInt(result[0].iteration)).toBe(i);
            }
            const health = await dbManager.performHealthCheck();
            (0, globals_1.expect)(health.postgres).toBe(true);
        });
        (0, globals_1.test)('should handle errors gracefully', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            await (0, globals_1.expect)(dbManager.executeQuery('SELECT * FROM non_existent_table')).rejects.toThrow();
            const health = await dbManager.performHealthCheck();
            (0, globals_1.expect)(health.postgres).toBe(true);
        });
        (0, globals_1.test)('should provide real-time metrics', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const initialMetrics = dbManager.getMetrics();
            const initialQueryCount = initialMetrics.postgres.queryCount;
            await dbManager.executeQuery('SELECT 1');
            await dbManager.executeQuery('SELECT 2');
            await dbManager.executeQuery('SELECT 3');
            const updatedMetrics = dbManager.getMetrics();
            const updatedQueryCount = updatedMetrics.postgres.queryCount;
            (0, globals_1.expect)(updatedQueryCount).toBeGreaterThan(initialQueryCount);
        });
    });
    (0, globals_1.describe)('Enterprise Features', () => {
        (0, globals_1.test)('should support database extensions', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const extensions = await dbManager.executeQuery(`
        SELECT extname FROM pg_extension 
        WHERE extname IN ('uuid-ossp', 'pg_stat_statements', 'pg_trgm')
      `);
            (0, globals_1.expect)(extensions.length).toBeGreaterThan(0);
        });
        (0, globals_1.test)('should provide connection information', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const connectionInfo = dbManager.getConnectionInfo();
            (0, globals_1.expect)(connectionInfo).toBeDefined();
            (0, globals_1.expect)(connectionInfo.postgres).toBeDefined();
            (0, globals_1.expect)(connectionInfo.redis).toBeDefined();
            (0, globals_1.expect)(connectionInfo.postgres.host).toBeDefined();
            (0, globals_1.expect)(connectionInfo.postgres.port).toBeDefined();
            (0, globals_1.expect)(connectionInfo.postgres.database).toBeDefined();
        });
        (0, globals_1.test)('should support Redis operations', async () => {
            const dbManager = orchestrator.getDatabaseManager();
            const redis = dbManager.getRedisClient();
            await redis.set('test:key', 'test:value');
            const value = await redis.get('test:key');
            (0, globals_1.expect)(value).toBe('test:value');
            await redis.lpush('test:list', 'item1', 'item2', 'item3');
            const listLength = await redis.llen('test:list');
            (0, globals_1.expect)(listLength).toBe(3);
            await redis.del('test:key', 'test:list');
        });
    });
});
//# sourceMappingURL=enterprise.test.js.map