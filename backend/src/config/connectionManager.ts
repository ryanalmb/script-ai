import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { prisma } from '../lib/prisma';
import { createRedisClient } from '../config/redis';

interface ConnectionHealth {
  database: boolean;
  redis: boolean;
  lastCheck: Date;
  errors: string[];
}

class ConnectionManager extends EventEmitter {
  private static instance: ConnectionManager;
  private prisma: PrismaClient | null = null;
  private redis: Redis | null = null;
  private pgPool: Pool | null = null;
  private healthStatus: ConnectionHealth = {
    database: false,
    redis: false,
    lastCheck: new Date(),
    errors: []
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = {
    database: 0,
    redis: 0
  };
  private readonly maxReconnectAttempts = 10;
  private readonly healthCheckIntervalMs = 30000; // 30 seconds

  private constructor() {
    super();
    this.setupGracefulShutdown();
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public async initialize(): Promise<void> {
    logger.info('Initializing connection manager...');

    // Use existing Prisma instance instead of creating new one
    this.prisma = prisma;

    // Initialize services with proper error handling
    const results = await Promise.allSettled([
      this.initializeDatabase(),
      this.initializeRedis(),
      this.initializePostgresPool()
    ]);

    // Log initialization results
    results.forEach((result, index) => {
      const services = ['Database', 'Redis', 'PostgreSQL Pool'];
      if (result.status === 'fulfilled') {
        logger.info(`${services[index]} initialized successfully`);
      } else {
        logger.error(`${services[index]} initialization failed:`, result.reason);
      }
    });

    this.startHealthChecks();
    logger.info('Connection manager initialized');
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

  public getRedis(): Redis {
    if (!this.redis || this.redis.status !== 'ready') {
      throw new Error('Redis connection not available');
    }
    return this.redis;
  }

  public getRedisIfAvailable(): Redis | null {
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

  public getHealthStatus(): ConnectionHealth {
    return { ...this.healthStatus };
  }

  public isHealthy(): boolean {
    return this.healthStatus.database && this.healthStatus.redis;
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      await Promise.allSettled([
        this.prisma?.$disconnect(),
        this.redis?.disconnect(),
        this.pgPool?.end()
      ]);

      logger.info('All connections closed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

export const connectionManager = ConnectionManager.getInstance();
export default connectionManager;
