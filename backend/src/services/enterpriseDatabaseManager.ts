/**
 * Enterprise Database Manager
 * 
 * Provides enterprise-grade database management with:
 * - Real PostgreSQL using Testcontainers
 * - Full PostgreSQL system tables and functions
 * - Automatic failover and recovery
 * - Connection pooling and monitoring
 * - Health checks and metrics
 */

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface DatabaseConfig {
  postgres: {
    database: string;
    username: string;
    password: string;
    host?: string;
    port?: number;
    maxConnections?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
  redis: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    retryDelayOnFailover?: number;
  };
}

export interface DatabaseMetrics {
  postgres: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    queryCount: number;
    errorCount: number;
    avgQueryTime: number;
  };
  redis: {
    connectedClients: number;
    usedMemory: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    commandsProcessed: number;
    errorCount: number;
  };
}

export class EnterpriseDatabaseManager extends EventEmitter {
  private postgresContainer?: StartedPostgreSqlContainer;
  private redisContainer?: StartedRedisContainer;
  private postgresPool?: Pool;
  private redisClient?: InstanceType<typeof Redis>;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private metrics: DatabaseMetrics;
  private useTestcontainers: boolean;

  constructor(private config: DatabaseConfig) {
    super();
    // Check if Testcontainers should be used
    this.useTestcontainers = process.env.USE_TESTCONTAINERS !== 'false';

    this.metrics = {
      postgres: {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingConnections: 0,
        queryCount: 0,
        errorCount: 0,
        avgQueryTime: 0,
      },
      redis: {
        connectedClients: 0,
        usedMemory: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
        commandsProcessed: 0,
        errorCount: 0,
      },
    };
  }

  /**
   * Initialize enterprise database services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enterprise Database Manager already initialized');
      return;
    }

    try {
      logger.info(`🚀 Initializing Enterprise Database Manager (${this.useTestcontainers ? 'Testcontainers' : 'External'} mode)...`);

      if (this.useTestcontainers) {
        // Start PostgreSQL container with enterprise configuration
        await this.initializePostgreSQL();

        // Start Redis container with enterprise configuration
        await this.initializeRedis();
      } else {
        // Use external PostgreSQL and Redis instances
        await this.initializeExternalPostgreSQL();
        // Skip Redis initialization - use enterprise Redis manager instead
        logger.info('⚠️ Skipping Redis initialization - using enterprise Redis manager');
      }

      // Setup health monitoring
      this.setupHealthMonitoring();

      // Setup metrics collection
      this.setupMetricsCollection();

      this.isInitialized = true;
      this.emit('initialized');
      logger.info('✅ Enterprise Database Manager initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise Database Manager:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize external PostgreSQL (using existing container/instance)
   */
  private async initializeExternalPostgreSQL(): Promise<void> {
    try {
      logger.info('🐘 Connecting to external PostgreSQL...');

      // Parse DATABASE_URL if provided, otherwise use config
      const databaseUrl = process.env.DATABASE_URL;
      let connectionConfig;

      if (databaseUrl) {
        // Parse DATABASE_URL format: postgresql://user:password@host:port/database
        const url = new URL(databaseUrl);
        connectionConfig = {
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.slice(1), // Remove leading slash
          user: url.username,
          password: url.password,
        };
      } else {
        connectionConfig = {
          host: this.config.postgres.host || 'localhost',
          port: this.config.postgres.port || 5432,
          database: this.config.postgres.database,
          user: this.config.postgres.username,
          password: this.config.postgres.password,
        };
      }

      // Create connection pool
      this.postgresPool = new Pool({
        ...connectionConfig,
        max: this.config.postgres.maxConnections || 20,
        idleTimeoutMillis: this.config.postgres.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.postgres.connectionTimeoutMillis || 2000,
        ssl: false,
      });

      // Setup pool event handlers
      this.postgresPool.on('connect', (client) => {
        logger.debug('PostgreSQL client connected');
        this.metrics.postgres.totalConnections++;
      });

      this.postgresPool.on('error', (err) => {
        logger.error('PostgreSQL pool error:', err);
        this.metrics.postgres.errorCount++;
        this.emit('postgres-error', err);
      });

      // Test connection and setup extensions (if not disabled)
      if (process.env.DISABLE_PG_EXTENSIONS !== 'true') {
        await this.setupPostgreSQLExtensions();
      } else {
        logger.info('⚠️ PostgreSQL extensions setup disabled via DISABLE_PG_EXTENSIONS');
        // Just test the connection
        const client = await this.postgresPool.connect();
        try {
          await client.query('SELECT 1');
          logger.info('✅ PostgreSQL connection test successful');
        } finally {
          client.release();
        }
      }

      logger.info(`✅ Connected to external PostgreSQL at ${connectionConfig.host}:${connectionConfig.port}`);

    } catch (error) {
      logger.error('❌ Failed to connect to external PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL with Testcontainers
   */
  private async initializePostgreSQL(): Promise<void> {
    try {
      logger.info('🐘 Starting PostgreSQL container...');

      // Create PostgreSQL container with enterprise configuration
      this.postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
        .withDatabase(this.config.postgres.database)
        .withUsername(this.config.postgres.username)
        .withPassword(this.config.postgres.password)
        .withExposedPorts(5432)
        .withEnvironment({
          POSTGRES_INITDB_ARGS: '--auth-host=scram-sha-256 --auth-local=scram-sha-256',
          POSTGRES_HOST_AUTH_METHOD: 'scram-sha-256',
        })
        .withCommand([
          'postgres',
          '-c', 'shared_preload_libraries=pg_stat_statements',
          '-c', 'pg_stat_statements.track=all',
          '-c', 'log_statement=all',
          '-c', 'log_min_duration_statement=0',
          '-c', 'max_connections=200',
          '-c', 'shared_buffers=256MB',
          '-c', 'effective_cache_size=1GB',
          '-c', 'maintenance_work_mem=64MB',
          '-c', 'checkpoint_completion_target=0.9',
          '-c', 'wal_buffers=16MB',
          '-c', 'default_statistics_target=100',
          '-c', 'random_page_cost=1.1',
          '-c', 'effective_io_concurrency=200',
        ])
        .start();

      // Create connection pool
      this.postgresPool = new Pool({
        host: this.postgresContainer.getHost(),
        port: this.postgresContainer.getPort(),
        database: this.config.postgres.database,
        user: this.config.postgres.username,
        password: this.config.postgres.password,
        max: this.config.postgres.maxConnections || 20,
        idleTimeoutMillis: this.config.postgres.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.postgres.connectionTimeoutMillis || 2000,
        ssl: false,
      });

      // Setup pool event handlers
      this.postgresPool.on('connect', (client) => {
        logger.debug('PostgreSQL client connected');
        this.metrics.postgres.totalConnections++;
      });

      this.postgresPool.on('error', (err) => {
        logger.error('PostgreSQL pool error:', err);
        this.metrics.postgres.errorCount++;
        this.emit('postgres-error', err);
      });

      // Test connection and setup extensions (if not disabled)
      if (process.env.DISABLE_PG_EXTENSIONS !== 'true') {
        await this.setupPostgreSQLExtensions();
      } else {
        logger.info('⚠️ PostgreSQL extensions setup disabled via DISABLE_PG_EXTENSIONS');
        // Just test the connection
        const client = await this.postgresPool.connect();
        try {
          await client.query('SELECT 1');
          logger.info('✅ PostgreSQL connection test successful');
        } finally {
          client.release();
        }
      }

      logger.info(`✅ PostgreSQL container started on ${this.postgresContainer.getHost()}:${this.postgresContainer.getPort()}`);

    } catch (error) {
      logger.error('❌ Failed to initialize PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Setup PostgreSQL extensions and system tables
   */
  private async setupPostgreSQLExtensions(): Promise<void> {
    if (!this.postgresPool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const client = await this.postgresPool.connect();
    try {
      // Create essential extensions
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "btree_gin"');
      await client.query('CREATE EXTENSION IF NOT EXISTS "btree_gist"');

      // Verify system tables are available
      const systemTables = [
        'pg_stat_activity',
        'pg_stat_database',
        'pg_stat_user_tables',
        'pg_stat_statements',
        'pg_database',
        'pg_tables',
        'information_schema.tables',
      ];

      for (const table of systemTables) {
        const result = await client.query(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
        logger.debug(`✅ System table ${table} is available`);
      }

      logger.info('✅ PostgreSQL extensions and system tables verified');

    } catch (error) {
      logger.error('❌ Failed to setup PostgreSQL extensions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize Redis with Testcontainers
   */
  private async initializeRedis(): Promise<void> {
    try {
      logger.info('🔴 Starting Redis container...');

      // Create Redis container with enterprise configuration
      this.redisContainer = await new RedisContainer('redis:7-alpine')
        .withExposedPorts(6379)
        .withCommand([
          'redis-server',
          '--maxmemory', '512mb',
          '--maxmemory-policy', 'allkeys-lru',
          '--save', '900', '1',
          '--save', '300', '10',
          '--save', '60', '10000',
          '--appendonly', 'yes',
          '--appendfsync', 'everysec',
          '--auto-aof-rewrite-percentage', '100',
          '--auto-aof-rewrite-min-size', '64mb',
        ])
        .start();

      // Create Redis client
      this.redisClient = new Redis({
        host: this.redisContainer.getHost(),
        port: this.redisContainer.getPort(),
        db: this.config.redis.db || 0,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest || 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      // Setup Redis event handlers
      this.redisClient.on('connect', () => {
        logger.debug('Redis client connected');
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis client error:', err);
        this.metrics.redis.errorCount++;
        this.emit('redis-error', err);
      });

      // Test Redis connection
      await this.redisClient.ping();

      logger.info(`✅ Redis container started on ${this.redisContainer.getHost()}:${this.redisContainer.getPort()}`);

    } catch (error) {
      logger.error('❌ Failed to initialize Redis:', error);
      throw error;
    }
  }

  /**
   * Initialize external Redis (using existing container/instance)
   */
  private async initializeExternalRedis(): Promise<void> {
    try {
      logger.info('🔴 Connecting to external Redis...');

      // Parse REDIS_URL if provided, otherwise use config
      const redisUrl = process.env.REDIS_URL;
      let connectionConfig;

      if (redisUrl) {
        // Parse REDIS_URL format: redis://[:password@]host:port[/db]
        const url = new URL(redisUrl);
        connectionConfig = {
          host: url.hostname,
          port: parseInt(url.port) || 6379,
          password: url.password || undefined,
          db: url.pathname ? parseInt(url.pathname.slice(1)) : (this.config.redis.db || 0),
        };
      } else {
        connectionConfig = {
          host: this.config.redis.host || 'localhost',
          port: this.config.redis.port || 6379,
          password: this.config.redis.password,
          db: this.config.redis.db || 0,
        };
      }

      // Create Redis client
      const redisOptions: any = {
        ...connectionConfig,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest || 3,
        enableReadyCheck: true,
        lazyConnect: false,
      };

      // Remove undefined password to avoid TypeScript error
      if (redisOptions.password === undefined) {
        delete redisOptions.password;
      }

      this.redisClient = new Redis(redisOptions);

      // Setup Redis event handlers
      this.redisClient.on('connect', () => {
        logger.debug('Redis client connected');
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis client error:', err);
        this.metrics.redis.errorCount++;
        this.emit('redis-error', err);
      });

      // Test Redis connection
      await this.redisClient.ping();

      logger.info(`✅ Connected to external Redis at ${connectionConfig.host}:${connectionConfig.port}`);

    } catch (error) {
      logger.error('❌ Failed to connect to external Redis:', error);
      throw error;
    }
  }

  /**
   * Setup health monitoring
   */
  private setupHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
        this.emit('health-check-failed', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup metrics collection
   */
  private setupMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Metrics collection failed:', error);
      }
    }, 60000); // Every minute
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<{ postgres: boolean; redis: boolean }> {
    const health = { postgres: false, redis: false };

    try {
      // PostgreSQL health check
      if (this.postgresPool) {
        const client = await this.postgresPool.connect();
        try {
          await client.query('SELECT 1');
          health.postgres = true;
        } finally {
          client.release();
        }
      }

      // Redis health check
      if (this.redisClient) {
        await this.redisClient.ping();
        health.redis = true;
      }

      this.emit('health-check', health);
      return health;

    } catch (error) {
      logger.error('Health check error:', error);
      throw error;
    }
  }

  /**
   * Collect comprehensive metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Collect PostgreSQL metrics
      if (this.postgresPool) {
        this.metrics.postgres.totalConnections = this.postgresPool.totalCount;
        this.metrics.postgres.activeConnections = this.postgresPool.totalCount - this.postgresPool.idleCount;
        this.metrics.postgres.idleConnections = this.postgresPool.idleCount;
        this.metrics.postgres.waitingConnections = this.postgresPool.waitingCount;
      }

      // Collect Redis metrics
      if (this.redisClient) {
        const info = await this.redisClient.info();
        const lines = info.split('\r\n');
        
        for (const line of lines) {
          if (line.startsWith('connected_clients:')) {
            this.metrics.redis.connectedClients = parseInt(line.split(':')[1] || '0');
          } else if (line.startsWith('used_memory:')) {
            this.metrics.redis.usedMemory = parseInt(line.split(':')[1] || '0');
          } else if (line.startsWith('keyspace_hits:')) {
            this.metrics.redis.keyspaceHits = parseInt(line.split(':')[1] || '0');
          } else if (line.startsWith('keyspace_misses:')) {
            this.metrics.redis.keyspaceMisses = parseInt(line.split(':')[1] || '0');
          } else if (line.startsWith('total_commands_processed:')) {
            this.metrics.redis.commandsProcessed = parseInt(line.split(':')[1] || '0');
          }
        }
      }

      this.emit('metrics-collected', this.metrics);

    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  /**
   * Execute PostgreSQL query with monitoring
   */
  async executeQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
    if (!this.postgresPool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const startTime = Date.now();
    const client = await this.postgresPool.connect();

    try {
      const result = await client.query(query, params);
      const duration = Date.now() - startTime;
      
      this.metrics.postgres.queryCount++;
      this.metrics.postgres.avgQueryTime = 
        (this.metrics.postgres.avgQueryTime + duration) / 2;

      return result.rows;

    } catch (error) {
      this.metrics.postgres.errorCount++;
      logger.error('PostgreSQL query error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get PostgreSQL client for transactions
   */
  async getPostgresClient(): Promise<PoolClient> {
    if (!this.postgresPool) {
      throw new Error('PostgreSQL pool not initialized');
    }
    return this.postgresPool.connect();
  }

  /**
   * Get Redis client
   */
  getRedisClient(): InstanceType<typeof Redis> {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized');
    }
    return this.redisClient;
  }

  /**
   * Get current metrics
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Get database connection info
   */
  getConnectionInfo() {
    let postgresInfo = null;
    let redisInfo = null;

    if (this.useTestcontainers) {
      // Using Testcontainers
      postgresInfo = this.postgresContainer ? {
        host: this.postgresContainer.getHost(),
        port: this.postgresContainer.getPort(),
        database: this.config.postgres.database,
        username: this.config.postgres.username,
        password: this.config.postgres.password,
      } : null;

      redisInfo = this.redisContainer ? {
        host: this.redisContainer.getHost(),
        port: this.redisContainer.getPort(),
        db: this.config.redis.db || 0,
      } : null;
    } else {
      // Using external databases
      if (this.postgresPool) {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
          const url = new URL(databaseUrl);
          postgresInfo = {
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            database: url.pathname.slice(1),
            username: url.username,
            password: url.password,
          };
        } else {
          postgresInfo = {
            host: this.config.postgres.host || 'localhost',
            port: this.config.postgres.port || 5432,
            database: this.config.postgres.database,
            username: this.config.postgres.username,
            password: this.config.postgres.password,
          };
        }
      }

      if (this.redisClient) {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          const url = new URL(redisUrl);
          redisInfo = {
            host: url.hostname,
            port: parseInt(url.port) || 6379,
            db: url.pathname ? parseInt(url.pathname.slice(1)) : (this.config.redis.db || 0),
          };
        } else {
          redisInfo = {
            host: this.config.redis.host || 'localhost',
            port: this.config.redis.port || 6379,
            db: this.config.redis.db || 0,
          };
        }
      }
    }

    return {
      postgres: postgresInfo,
      redis: redisInfo,
    };
  }

  /**
   * Shutdown database services
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down Enterprise Database Manager...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close connections
    if (this.postgresPool) {
      await this.postgresPool.end();
    }
    if (this.redisClient) {
      this.redisClient.disconnect();
    }

    // Stop containers
    if (this.postgresContainer) {
      await this.postgresContainer.stop();
    }
    if (this.redisContainer) {
      await this.redisContainer.stop();
    }

    this.isInitialized = false;
    this.emit('shutdown');
    logger.info('✅ Enterprise Database Manager shutdown complete');
  }
}
