/**
 * Enterprise System Integration Tests
 * 
 * Comprehensive tests for the enterprise-grade platform:
 * - Real PostgreSQL with all system tables
 * - Service orchestration and discovery
 * - Inter-service communication
 * - Health monitoring and recovery
 * - Performance and reliability
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { serviceManager } from '../services/serviceManager';
import { connectionManager } from '../config/connectionManager';
import { logger } from '../utils/logger';

// Set enterprise mode for tests
process.env.ENTERPRISE_MODE = 'true';
process.env.USE_TESTCONTAINERS = 'true';
process.env.NODE_ENV = 'test';

describe('Enterprise System Integration', () => {
  let orchestrator: any;

  beforeAll(async () => {
    logger.info('🧪 Starting Enterprise System Integration Tests...');
    
    // Initialize service manager in enterprise mode
    await serviceManager.initialize();
    
    // Get enterprise orchestrator
    orchestrator = serviceManager.getEnterpriseOrchestrator();
    expect(orchestrator).toBeDefined();

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
  }, 120000); // 2 minutes timeout for container startup

  afterAll(async () => {
    logger.info('🧹 Cleaning up Enterprise System Integration Tests...');
    await serviceManager.shutdown();
  }, 60000);

  describe('Enterprise Database Manager', () => {
    test('should initialize with real PostgreSQL', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      expect(dbManager).toBeDefined();

      // Test database connection
      const health = await dbManager.performHealthCheck();
      expect(health.postgres).toBe(true);
      expect(health.redis).toBe(true);
    });

    test('should have all PostgreSQL system tables', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      
      // Test system tables that pg-mem doesn't have
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
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });

    test('should support PostgreSQL functions', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      
      // Test PostgreSQL functions that pg-mem doesn't support
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
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      }
    });

    test('should provide comprehensive metrics', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      const metrics = dbManager.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.postgres).toBeDefined();
      expect(metrics.redis).toBeDefined();

      // PostgreSQL metrics
      expect(typeof metrics.postgres.totalConnections).toBe('number');
      expect(typeof metrics.postgres.activeConnections).toBe('number');
      expect(typeof metrics.postgres.queryCount).toBe('number');

      // Redis metrics
      expect(typeof metrics.redis.connectedClients).toBe('number');
      expect(typeof metrics.redis.usedMemory).toBe('number');
    });

    test('should handle transactions properly', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      const client = await dbManager.getPostgresClient();

      try {
        await client.query('BEGIN');
        
        // Create test table
        await client.query(`
          CREATE TEMPORARY TABLE test_transaction (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100)
          )
        `);

        // Insert test data
        await client.query('INSERT INTO test_transaction (name) VALUES ($1)', ['test']);
        
        // Verify data exists
        const result = await client.query('SELECT * FROM test_transaction WHERE name = $1', ['test']);
        expect(result.rows.length).toBe(1);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  });

  describe('Service Orchestration', () => {
    test('should register all core services', async () => {
      const registry = orchestrator.getServiceRegistry();
      
      const expectedServices = ['backend-api', 'frontend-app', 'telegram-bot', 'llm-service'];
      
      for (const serviceName of expectedServices) {
        expect(registry[serviceName]).toBeDefined();
        expect(registry[serviceName].config).toBeDefined();
        expect(registry[serviceName].status).toBeDefined();
      }
    });

    test('should perform health checks', async () => {
      const systemHealth = await orchestrator.getSystemHealth();
      
      expect(systemHealth).toBeDefined();
      expect(systemHealth.overall).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(systemHealth.overall);
      expect(systemHealth.services).toBeDefined();
      expect(systemHealth.database).toBeDefined();
    });

    test('should handle service dependencies', async () => {
      const registry = orchestrator.getServiceRegistry();
      
      // Frontend should depend on backend
      const frontend = registry['frontend-app'];
      expect(frontend.config.dependencies).toContain('backend-api');
      
      // Bot should depend on backend
      const bot = registry['telegram-bot'];
      expect(bot.config.dependencies).toContain('backend-api');
      
      // LLM service should depend on backend
      const llm = registry['llm-service'];
      expect(llm.config.dependencies).toContain('backend-api');
    });

    test('should support inter-service communication', async () => {
      // This would test actual service calls when services are running
      // For now, we test the mechanism exists
      expect(typeof orchestrator.callService).toBe('function');
    });
  });

  describe('Connection Manager Integration', () => {
    test('should use enterprise database manager', async () => {
      await connectionManager.initialize();
      
      // Test query execution through connection manager
      const result = await connectionManager.executeQuery('SELECT 1 as test');
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].test).toBe(1);
    });

    test('should handle complex queries', async () => {
      // Test complex query that requires real PostgreSQL
      const query = `
        SELECT 
          schemaname,
          tablename,
          attname,
          typename,
          attnum
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

      const result = await connectionManager.executeQuery(query);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should provide performance metrics', async () => {
      const metrics = await connectionManager.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.database).toBeDefined();
      expect(typeof metrics.database.connectionCount).toBe('number');
      expect(typeof metrics.database.totalQueries).toBe('number');
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent queries', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      
      // Execute multiple queries concurrently
      const promises = Array.from({ length: 10 }, (_, i) => 
        dbManager.executeQuery('SELECT $1 as query_id', [i])
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(10);
      results.forEach((result, index) => {
        expect(result[0].query_id).toBe(index);
      });
    });

    test('should maintain connection pool health', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      
      // Execute many queries to test pool management
      for (let i = 0; i < 50; i++) {
        const result = await dbManager.executeQuery('SELECT $1 as iteration', [i]);
        expect(result[0].iteration).toBe(i);
      }

      // Check that pool is still healthy
      const health = await dbManager.performHealthCheck();
      expect(health.postgres).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      
      // Test invalid query
      await expect(
        dbManager.executeQuery('SELECT * FROM non_existent_table')
      ).rejects.toThrow();

      // Verify system is still healthy after error
      const health = await dbManager.performHealthCheck();
      expect(health.postgres).toBe(true);
    });

    test('should provide real-time metrics', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      
      // Get initial metrics
      const initialMetrics = dbManager.getMetrics();
      const initialQueryCount = initialMetrics.postgres.queryCount;
      
      // Execute some queries
      await dbManager.executeQuery('SELECT 1');
      await dbManager.executeQuery('SELECT 2');
      await dbManager.executeQuery('SELECT 3');
      
      // Get updated metrics
      const updatedMetrics = dbManager.getMetrics();
      const updatedQueryCount = updatedMetrics.postgres.queryCount;
      
      // Query count should have increased
      expect(updatedQueryCount).toBeGreaterThan(initialQueryCount);
    });
  });

  describe('Enterprise Features', () => {
    test('should support database extensions', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      
      // Test that extensions are available
      const extensions = await dbManager.executeQuery(`
        SELECT extname FROM pg_extension 
        WHERE extname IN ('uuid-ossp', 'pg_stat_statements', 'pg_trgm')
      `);
      
      expect(extensions.length).toBeGreaterThan(0);
    });

    test('should provide connection information', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      const connectionInfo = dbManager.getConnectionInfo();
      
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo.postgres).toBeDefined();
      expect(connectionInfo.redis).toBeDefined();
      
      expect(connectionInfo.postgres.host).toBeDefined();
      expect(connectionInfo.postgres.port).toBeDefined();
      expect(connectionInfo.postgres.database).toBeDefined();
    });

    test('should support Redis operations', async () => {
      const dbManager = orchestrator.getDatabaseManager();
      const redis = dbManager.getRedisClient();
      
      // Test Redis operations
      await redis.set('test:key', 'test:value');
      const value = await redis.get('test:key');
      expect(value).toBe('test:value');
      
      // Test Redis data structures
      await redis.lpush('test:list', 'item1', 'item2', 'item3');
      const listLength = await redis.llen('test:list');
      expect(listLength).toBe(3);
      
      // Cleanup
      await redis.del('test:key', 'test:list');
    });
  });
});
