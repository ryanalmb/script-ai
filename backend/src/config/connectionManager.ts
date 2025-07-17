import { PrismaClient } from '@prisma/client';
import Redis, { Cluster } from 'ioredis';
import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { prisma } from '../lib/prisma';
import { createRedisClient } from '../config/redis';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Enterprise database interfaces
interface DatabaseMetrics {
  connectionCount: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  errorCount: number;
  lastError?: string;
  uptime: number;
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionCount: number;
  memoryUsage: number;
  keyCount: number;
  operationsPerSecond: number;
}

interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeout: number;
  queryTimeout: number;
  keepAlive: boolean;
  keepAliveInitialDelayMillis: number;
}

interface RedisClusterConfig {
  enableCluster: boolean;
  nodes: Array<{ host: string; port: number }>;
  clusterOptions: {
    enableReadyCheck: boolean;
    redisOptions: {
      password?: string;
      db?: number;
    };
  };
}

interface DatabaseConfig {
  url: string;
  poolConfig: ConnectionPoolConfig;
  enableReadReplicas: boolean;
  readReplicaUrls: string[];
  enableQueryLogging: boolean;
  slowQueryThreshold: number;
  enableMetrics: boolean;
}

interface ConnectionHealth {
  database: boolean;
  redis: boolean;
  redisCluster: boolean;
  readReplicas: boolean;
  lastCheck: Date;
  errors: string[];
  metrics: {
    database: DatabaseMetrics;
    cache: CacheMetrics;
  };
}

class ConnectionManager extends EventEmitter {
  private static instance: ConnectionManager;
  private prisma: PrismaClient | null = null;
  private redis: Redis | Cluster | null = null;
  private pgPool: Pool | null = null;
  private healthStatus: ConnectionHealth = {
    database: false,
    redis: false,
    redisCluster: false,
    readReplicas: false,
    lastCheck: new Date(),
    errors: [],
    metrics: {
      database: {
        connectionCount: 0,
        activeConnections: 0,
        idleConnections: 0,
        totalQueries: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        errorCount: 0,
        uptime: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionCount: 0,
        memoryUsage: 0,
        keyCount: 0,
        operationsPerSecond: 0
      }
    }
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = {
    database: 0,
    redis: 0,
    redisCluster: 0,
    readReplicas: 0
  };
  private readonly maxReconnectAttempts = 10;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  // Enterprise additions
  private redisCluster: Cluster | null = null;
  private readReplicaPools: Pool[] = [];

  // Enterprise configuration
  private databaseConfig: DatabaseConfig = {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/x_marketing',
    poolConfig: {
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      keepAlive: process.env.DB_KEEP_ALIVE !== 'false',
      keepAliveInitialDelayMillis: parseInt(process.env.DB_KEEP_ALIVE_DELAY || '10000')
    },
    enableReadReplicas: process.env.ENABLE_READ_REPLICAS === 'true',
    readReplicaUrls: (process.env.READ_REPLICA_URLS || '').split(',').filter(Boolean),
    enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
    enableMetrics: process.env.ENABLE_DB_METRICS !== 'false'
  };
  private redisClusterConfig: RedisClusterConfig = {
    enableCluster: process.env.REDIS_CLUSTER_ENABLED === 'true',
    nodes: this.parseRedisNodes(process.env.REDIS_CLUSTER_NODES || 'localhost:6379'),
    clusterOptions: {
      enableReadyCheck: true,
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    }
  };

  // Performance monitoring
  private queryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    totalQueryTime: 0,
    errorCount: 0,
    lastError: null as string | null
  };

  private cacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    operations: 0,
    startTime: Date.now()
  };

  // Distributed tracing
  private tracer = trace.getTracer('connection-manager', '1.0.0');

  private constructor() {
    super();
    this.initializeConfigurations();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize enterprise configurations
   */
  private initializeConfigurations(): void {
    this.databaseConfig = {
      url: process.env.DATABASE_URL!,
      poolConfig: {
        min: parseInt(process.env.DB_POOL_MIN || '5'),
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
        statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
        queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
        keepAlive: process.env.DB_KEEP_ALIVE !== 'false',
        keepAliveInitialDelayMillis: parseInt(process.env.DB_KEEP_ALIVE_DELAY || '10000')
      },
      enableReadReplicas: process.env.ENABLE_READ_REPLICAS === 'true',
      readReplicaUrls: (process.env.READ_REPLICA_URLS || '').split(',').filter(Boolean),
      enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
      enableMetrics: process.env.ENABLE_DB_METRICS !== 'false'
    };

    this.redisClusterConfig = {
      enableCluster: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: this.parseRedisNodes(process.env.REDIS_CLUSTER_NODES || ''),
      clusterOptions: {
        enableReadyCheck: true,
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0')
        }
      }
    };
  }

  /**
   * Parse Redis cluster nodes from environment variable
   */
  private parseRedisNodes(nodesString: string): Array<{ host: string; port: number }> {
    if (!nodesString) {
      return [{ host: 'localhost', port: 6379 }];
    }

    return nodesString.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return {
        host: host || 'localhost',
        port: parseInt(port || '6379') || 6379
      };
    });
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public async initialize(): Promise<void> {
    const span = this.tracer.startSpan('connection_manager_initialize', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🚀 Initializing Enterprise Connection Manager...');

      // Use existing Prisma instance instead of creating new one
      this.prisma = prisma;

      // Initialize services with proper error handling
      const initializationTasks = [
        this.initializeDatabase(),
        this.initializeRedis(),
        this.initializePostgresPool()
      ];

      // Add enterprise features if enabled
      if (this.redisClusterConfig.enableCluster) {
        initializationTasks.push(this.initializeRedisCluster());
      }

      if (this.databaseConfig.enableReadReplicas) {
        initializationTasks.push(this.initializeReadReplicas());
      }

      const results = await Promise.allSettled(initializationTasks);

      // Log initialization results
      const serviceNames = ['Database', 'Redis', 'PostgreSQL Pool'];
      if (this.redisClusterConfig.enableCluster) serviceNames.push('Redis Cluster');
      if (this.databaseConfig.enableReadReplicas) serviceNames.push('Read Replicas');

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          logger.info(`✅ ${serviceNames[index]} initialized successfully`);
        } else {
          logger.error(`❌ ${serviceNames[index]} initialization failed:`, result.reason);
        }
      });

      // Start enterprise monitoring
      this.startHealthChecks();
      this.startMetricsCollection();

      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('🎉 Enterprise Connection Manager initialized successfully');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Failed to initialize Enterprise Connection Manager:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize Redis Cluster for enterprise caching
   */
  private async initializeRedisCluster(): Promise<void> {
    const span = this.tracer.startSpan('initialize_redis_cluster', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🔄 Initializing Redis Cluster...');

      this.redisCluster = new Cluster(
        this.redisClusterConfig.nodes,
        this.redisClusterConfig.clusterOptions
      );

      // Set up event listeners
      this.redisCluster.on('connect', () => {
        logger.info('✅ Redis Cluster connected');
        this.healthStatus.redisCluster = true;
        this.emit('redis_cluster:connected');
      });

      this.redisCluster.on('error', (error) => {
        logger.error('❌ Redis Cluster error:', error);
        this.healthStatus.redisCluster = false;
        this.emit('redis_cluster:error', error);
      });

      this.redisCluster.on('ready', () => {
        logger.info('🚀 Redis Cluster ready');
      });

      // Test cluster connection
      await this.redisCluster.ping();

      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('✅ Redis Cluster initialized successfully');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Redis Cluster initialization failed:', error);
      this.healthStatus.redisCluster = false;
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize read replica connections for enhanced performance
   */
  private async initializeReadReplicas(): Promise<void> {
    const span = this.tracer.startSpan('initialize_read_replicas', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🔄 Initializing Read Replicas...');

      for (const replicaUrl of this.databaseConfig.readReplicaUrls) {
        const replicaPool = new Pool({
          connectionString: replicaUrl,
          ...this.databaseConfig.poolConfig
        });

        // Test replica connection
        const client = await replicaPool.connect();
        await client.query('SELECT 1');
        client.release();

        this.readReplicaPools.push(replicaPool);
        logger.info(`✅ Read replica connected: ${replicaUrl.split('@')[1]}`);
      }

      this.healthStatus.readReplicas = this.readReplicaPools.length > 0;

      span.setStatus({ code: SpanStatusCode.OK });
      logger.info(`✅ ${this.readReplicaPools.length} Read Replicas initialized successfully`);

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Read Replicas initialization failed:', error);
      this.healthStatus.readReplicas = false;
      throw error;
    } finally {
      span.end();
    }
  }

  private async initializeDatabase(): Promise<void> {
    const maxRetries = 10;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use existing Prisma instance - test connection with timeout
        await Promise.race([
          this.prisma!.$connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database connection timeout')), 10000)
          )
        ]);

        await this.prisma!.$queryRaw`SELECT 1`;

        this.healthStatus.database = true;
        this.reconnectAttempts.database = 0;
        logger.info('Database connection established');
        this.emit('database:connected');
        return;

      } catch (error: any) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
        logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt === maxRetries) {
          logger.error('Database initialization failed after all retries');
          this.healthStatus.database = false;
          this.healthStatus.errors.push(`Database: ${error.message}`);
          this.scheduleReconnect('database');
          throw error;
        }

        logger.info(`Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async initializeRedis(): Promise<void> {
    const maxRetries = 10;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use existing Redis client creation logic
        this.redis = createRedisClient();

        if (this.redis) {
          this.redis.on('connect', () => {
            logger.info('Redis connection established');
            this.healthStatus.redis = true;
            this.reconnectAttempts.redis = 0;
            this.emit('redis:connected');
          });

          this.redis.on('error', (error: any) => {
            logger.error('Redis connection error:', error);
            this.healthStatus.redis = false;
            this.healthStatus.errors.push(`Redis: ${error}`);
            this.emit('redis:error', error);
          });

          this.redis.on('close', () => {
            logger.warn('Redis connection closed');
            this.healthStatus.redis = false;
            this.scheduleReconnect('redis');
          });

          // Test connection with timeout
          await Promise.race([
            Promise.all([this.redis.connect(), this.redis.ping()]),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
            )
          ]);

          this.healthStatus.redis = true;
          this.reconnectAttempts.redis = 0;
          logger.info('Redis service restored');
          return;
        }

      } catch (error: any) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
        logger.warn(`Redis connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt === maxRetries) {
          logger.error('Redis initialization failed after all retries');
          this.healthStatus.redis = false;
          this.healthStatus.errors.push(`Redis: ${error.message}`);
          this.scheduleReconnect('redis');
          throw error;
        }

        logger.info(`Retrying Redis connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async initializePostgresPool(): Promise<void> {
    try {
      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20, // Maximum number of clients in the pool
        min: 5,  // Minimum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000,
        query_timeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      });

      this.pgPool.on('error', (error: any) => {
        logger.error('PostgreSQL pool error:', error);
      });

      // Test pool connection
      const client = await this.pgPool.connect();
      await client.query('SELECT 1');
      client.release();

      logger.info('PostgreSQL connection pool established');

    } catch (error) {
      logger.error('PostgreSQL pool initialization failed:', error);
      this.healthStatus.errors.push(`PostgreSQL Pool: ${error}`);
    }
  }

  private scheduleReconnect(service: 'database' | 'redis'): void {
    const attempts = this.reconnectAttempts[service];
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts reached for ${service}`);
      this.emit(`${service}:max_attempts_reached`);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff, max 30s
    this.reconnectAttempts[service]++;

    setTimeout(async () => {
      logger.info(`Attempting to reconnect ${service} (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
      
      if (service === 'database') {
        await this.initializeDatabase();
      } else if (service === 'redis') {
        await this.initializeRedis();
      }
    }, delay);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckIntervalMs);

    // Initial health check
    setTimeout(() => this.performHealthCheck(), 1000);
  }

  /**
   * Start enterprise metrics collection
   */
  private startMetricsCollection(): void {
    const metricsInterval = parseInt(process.env.METRICS_COLLECTION_INTERVAL || '60000');

    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, metricsInterval);

    logger.info(`📊 Metrics collection started (interval: ${metricsInterval}ms)`);
  }

  /**
   * Collect comprehensive database and cache metrics
   */
  private async collectMetrics(): Promise<void> {
    const span = this.tracer.startSpan('collect_metrics', {
      kind: SpanKind.INTERNAL
    });

    try {
      // Collect database metrics
      if (this.pgPool) {
        this.healthStatus.metrics.database = {
          connectionCount: this.pgPool.totalCount,
          activeConnections: this.pgPool.totalCount - this.pgPool.idleCount,
          idleConnections: this.pgPool.idleCount,
          totalQueries: this.queryMetrics.totalQueries,
          slowQueries: this.queryMetrics.slowQueries,
          averageQueryTime: this.queryMetrics.totalQueries > 0
            ? this.queryMetrics.totalQueryTime / this.queryMetrics.totalQueries
            : 0,
          errorCount: this.queryMetrics.errorCount,
          lastError: this.queryMetrics.lastError || undefined,
          uptime: Date.now() - this.cacheMetrics.startTime
        };
      }

      // Collect cache metrics
      if (this.redis) {
        const info = await this.redis.info('stats');
        const keyspaceInfo = await this.redis.info('keyspace');

        // Parse Redis info
        const stats = this.parseRedisInfo(info);
        const keyspace = this.parseRedisInfo(keyspaceInfo);

        const totalOps = this.cacheMetrics.hits + this.cacheMetrics.misses;
        const uptime = (Date.now() - this.cacheMetrics.startTime) / 1000;

        this.healthStatus.metrics.cache = {
          hitRate: totalOps > 0 ? (this.cacheMetrics.hits / totalOps) * 100 : 0,
          missRate: totalOps > 0 ? (this.cacheMetrics.misses / totalOps) * 100 : 0,
          evictionCount: parseInt(stats.evicted_keys || '0'),
          memoryUsage: parseInt(stats.used_memory || '0'),
          keyCount: this.extractKeyCount(keyspace),
          operationsPerSecond: uptime > 0 ? this.cacheMetrics.operations / uptime : 0
        };
      }

      span.setStatus({ code: SpanStatusCode.OK });

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.warn('Failed to collect metrics:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value !== undefined) {
          result[key] = value;
        }
      }
    });
    return result;
  }

  /**
   * Extract key count from Redis keyspace info
   */
  private extractKeyCount(keyspace: Record<string, string>): number {
    let totalKeys = 0;
    Object.values(keyspace).forEach(value => {
      const match = value.match(/keys=(\d+)/);
      if (match && match[1]) {
        totalKeys += parseInt(match[1]);
      }
    });
    return totalKeys;
  }

  private async performHealthCheck(): Promise<void> {
    const errors: string[] = [];
    
    // Check database
    try {
      if (this.prisma) {
        await this.prisma.$queryRaw`SELECT 1`;
        this.healthStatus.database = true;
      } else {
        this.healthStatus.database = false;
        errors.push('Database: Prisma client not initialized');
      }
    } catch (error) {
      this.healthStatus.database = false;
      errors.push(`Database: ${error}`);
      this.scheduleReconnect('database');
    }

    // Check Redis
    try {
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.ping();
        this.healthStatus.redis = true;
      } else {
        this.healthStatus.redis = false;
        errors.push('Redis: Connection not ready');
      }
    } catch (error) {
      this.healthStatus.redis = false;
      errors.push(`Redis: ${error}`);
      this.scheduleReconnect('redis');
    }

    this.healthStatus.lastCheck = new Date();
    this.healthStatus.errors = errors;

    if (errors.length > 0) {
      logger.warn('Health check issues:', errors);
      this.emit('health:degraded', this.healthStatus);
    } else {
      this.emit('health:healthy', this.healthStatus);
    }
  }

  public getPrisma(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database connection not available');
    }
    return this.prisma;
  }

  public getRedis(): Redis | Cluster {
    if (!this.redis || this.redis.status !== 'ready') {
      throw new Error('Redis connection not available');
    }
    return this.redis;
  }

  public getRedisIfAvailable(): Redis | Cluster | null {
    if (!this.redis || this.redis.status !== 'ready') {
      return null;
    }
    return this.redis;
  }

  public getPostgresPool(): Pool {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not available');
    }
    return this.pgPool;
  }

  /**
   * Execute query with intelligent routing (read replicas for SELECT queries)
   */
  async executeQuery<T>(query: string, params?: any[]): Promise<T> {
    const span = this.tracer.startSpan('execute_query', {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.statement': query.substring(0, 100),
        'db.operation': this.getQueryOperation(query)
      }
    });

    const startTime = Date.now();

    try {
      this.queryMetrics.totalQueries++;

      // Route read queries to read replicas if available
      const isReadQuery = this.isReadQuery(query);
      let result: T;

      if (isReadQuery && this.readReplicaPools.length > 0) {
        // Use round-robin for read replica selection
        const replicaIndex = this.queryMetrics.totalQueries % this.readReplicaPools.length;
        const replicaPool = this.readReplicaPools[replicaIndex];

        if (!replicaPool) {
          throw new Error('Read replica pool not available');
        }

        const client = await replicaPool.connect();
        try {
          const queryResult = await client.query(query, params);
          result = queryResult.rows as T;
          span.setAttributes({ 'db.replica_used': true, 'db.replica_index': replicaIndex });
        } finally {
          client.release();
        }
      } else {
        // Use primary database for write queries
        if (this.pgPool) {
          const client = await this.pgPool.connect();
          try {
            const queryResult = await client.query(query, params);
            result = queryResult.rows as T;
            span.setAttributes({ 'db.replica_used': false });
          } finally {
            client.release();
          }
        } else {
          throw new Error('Database pool not available');
        }
      }

      const queryTime = Date.now() - startTime;
      this.queryMetrics.totalQueryTime += queryTime;

      // Track slow queries
      if (queryTime > this.databaseConfig.slowQueryThreshold) {
        this.queryMetrics.slowQueries++;
        logger.warn(`Slow query detected (${queryTime}ms):`, query.substring(0, 200));
      }

      span.setAttributes({
        'db.query_time': queryTime,
        'db.slow_query': queryTime > this.databaseConfig.slowQueryThreshold
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return result;

    } catch (error) {
      this.queryMetrics.errorCount++;
      this.queryMetrics.lastError = (error as Error).message;

      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });

      logger.error('Query execution failed:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Determine if query is a read operation
   */
  private isReadQuery(query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery.startsWith('select') ||
           normalizedQuery.startsWith('with') ||
           normalizedQuery.startsWith('show') ||
           normalizedQuery.startsWith('explain');
  }

  /**
   * Extract query operation type
   */
  private getQueryOperation(query: string): string {
    const normalizedQuery = query.trim().toLowerCase();
    const operation = normalizedQuery.split(' ')[0];
    return operation || 'unknown';
  }

  /**
   * Get Redis client with cluster support
   */
  public getRedisClient(): Redis | Cluster {
    if (this.redisCluster && this.healthStatus.redisCluster) {
      return this.redisCluster;
    }

    if (this.redis && this.redis.status === 'ready') {
      return this.redis;
    }

    throw new Error('No Redis connection available');
  }

  /**
   * Execute cached operation with intelligent cache management
   */
  async executeWithCache<T>(
    key: string,
    operation: () => Promise<T>,
    ttl: number = 3600,
    useCluster: boolean = false
  ): Promise<T> {
    const span = this.tracer.startSpan('execute_with_cache', {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.key': key,
        'cache.ttl': ttl,
        'cache.use_cluster': useCluster
      }
    });

    try {
      const redisClient = useCluster && this.redisCluster ? this.redisCluster : this.redis;

      if (!redisClient) {
        // No cache available, execute operation directly
        span.setAttributes({ 'cache.available': false });
        return await operation();
      }

      // Try to get from cache
      const cached = await redisClient.get(key);
      if (cached) {
        this.cacheMetrics.hits++;
        span.setAttributes({ 'cache.hit': true });
        return JSON.parse(cached);
      }

      // Cache miss, execute operation
      this.cacheMetrics.misses++;
      const result = await operation();

      // Store in cache
      await redisClient.setex(key, ttl, JSON.stringify(result));
      this.cacheMetrics.operations++;

      span.setAttributes({ 'cache.hit': false });
      span.setStatus({ code: SpanStatusCode.OK });

      return result;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });

      // If cache operation fails, still try to execute the operation
      logger.warn('Cache operation failed, executing without cache:', error);
      return await operation();
    } finally {
      span.end();
    }
  }

  public getHealthStatus(): ConnectionHealth {
    return { ...this.healthStatus };
  }

  public isHealthy(): boolean {
    return this.healthStatus.database && this.healthStatus.redis;
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`🔄 Received ${signal}, shutting down Enterprise Connection Manager gracefully...`);

      // Stop monitoring intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      if (this.metricsCollectionInterval) {
        clearInterval(this.metricsCollectionInterval);
      }

      // Close all connections
      const shutdownTasks = [
        this.prisma?.$disconnect(),
        this.redis?.disconnect(),
        this.pgPool?.end()
      ];

      // Add enterprise connections
      if (this.redisCluster) {
        shutdownTasks.push(this.redisCluster.disconnect());
      }

      // Close read replica pools
      this.readReplicaPools.forEach(pool => {
        shutdownTasks.push(pool.end());
      });

      await Promise.allSettled(shutdownTasks);

      logger.info('✅ All enterprise connections closed gracefully');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

export const connectionManager = ConnectionManager.getInstance();
export default connectionManager;
