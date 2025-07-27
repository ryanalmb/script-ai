/**
 * Enterprise Service Manager - 2025 Edition
 * Automatic service detection, startup, and management system
 * 
 * Features:
 * - Automatic Docker Compose service startup
 * - Embedded service fallbacks (pg-mem, redis-memory-server)
 * - Service health monitoring and recovery
 * - Cross-platform compatibility
 * - Zero-configuration development experience
 */

import { EventEmitter } from 'events';
import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { DataType } from 'pg-mem';
import { EnterpriseServiceOrchestrator } from './enterpriseServiceOrchestrator';
import { EnterpriseDatabaseManager } from './enterpriseDatabaseManager';

const execAsync = promisify(exec);

export interface ServiceConfig {
  name: string;
  type: 'docker' | 'embedded' | 'external';
  required: boolean;
  healthCheck: () => Promise<boolean>;
  startup: () => Promise<void>;
  shutdown: () => Promise<void>;
  fallback?: () => Promise<void>;
  dependencies?: string[];
}

export interface ServiceStatus {
  name: string;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'fallback';
  type: 'docker' | 'embedded' | 'external';
  pid?: number;
  port?: number;
  lastCheck: Date;
  error?: string;
  uptime?: number;
}

/**
 * Enterprise Service Manager
 * Handles automatic service startup and management
 */
export class ServiceManager extends EventEmitter {
  private static instance: ServiceManager;
  private services: Map<string, ServiceConfig> = new Map();
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private tracer = trace.getTracer('service-manager', '1.0.0');
  private enterpriseOrchestrator?: EnterpriseServiceOrchestrator;
  private enterpriseMode = process.env.ENTERPRISE_MODE !== 'false'; // Default to true, only disable if explicitly set to false
  private useTestcontainers = process.env.USE_TESTCONTAINERS !== 'false' && this.enterpriseMode; // Default to true in enterprise mode

  private constructor() {
    super();
    this.setupSignalHandlers();
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Initialize the service manager with default services
   */
  public async initialize(): Promise<void> {
    const span = this.tracer.startSpan('service-manager-initialize');

    try {
      logger.info(`🚀 Initializing Enterprise Service Manager (${this.enterpriseMode ? 'Enterprise' : 'Development'} Mode)...`);

      if (this.enterpriseMode) {
        // Initialize enterprise orchestrator
        await this.initializeEnterpriseMode();
      } else {
        // Register core services in development mode
        await this.registerCoreServices();

        // Start health monitoring
        this.startHealthMonitoring();
      }

      this.isInitialized = true;
      logger.info('✅ Service Manager initialized successfully');

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      logger.error('❌ Service Manager initialization failed:', error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize enterprise mode with orchestrator
   */
  private async initializeEnterpriseMode(): Promise<void> {
    logger.info('🏢 Initializing Enterprise Mode...');

    // Create database configuration
    const databaseConfig = {
      postgres: {
        database: process.env.POSTGRES_DB || 'x_marketing',
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
        idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000'),
      },
      redis: {
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      },
    };

    // Initialize enterprise orchestrator
    this.enterpriseOrchestrator = new EnterpriseServiceOrchestrator(databaseConfig);

    // Setup event handlers
    this.enterpriseOrchestrator.on('initialized', () => {
      logger.info('✅ Enterprise Orchestrator initialized');
      this.emit('enterprise-ready');
    });

    this.enterpriseOrchestrator.on('service-registered', (serviceName: string) => {
      logger.info(`📝 Service registered: ${serviceName}`);
      this.emit('service-registered', serviceName);
    });

    this.enterpriseOrchestrator.on('health-check-failed', (serviceName: string, error: any) => {
      logger.warn(`⚠️ Health check failed for ${serviceName}:`, error.message);
      this.emit('service-unhealthy', serviceName, error);
    });

    this.enterpriseOrchestrator.on('service-recovered', (serviceName: string) => {
      logger.info(`✅ Service recovered: ${serviceName}`);
      this.emit('service-recovered', serviceName);
    });

    this.enterpriseOrchestrator.on('system-health', (health: any) => {
      this.emit('system-health', health);
    });

    // Initialize the orchestrator
    await this.enterpriseOrchestrator.initialize();

    logger.info('✅ Enterprise Mode initialized successfully');
  }

  /**
   * Register core services (PostgreSQL, Redis, etc.)
   */
  private async registerCoreServices(): Promise<void> {
    if (this.useTestcontainers) {
      logger.info('🐳 Using Testcontainers for enterprise-grade databases');

      // PostgreSQL Service with Testcontainers
      this.registerService({
        name: 'postgresql',
        type: 'external', // Managed by testcontainers
        required: true,
        healthCheck: () => this.checkTestcontainerPostgreSQLHealth(),
        startup: () => this.startTestcontainerPostgreSQL(),
        shutdown: () => this.stopTestcontainerPostgreSQL(),
        fallback: () => this.startEmbeddedPostgreSQL(),
        dependencies: []
      });

      // Redis Service with Testcontainers
      this.registerService({
        name: 'redis',
        type: 'external', // Managed by testcontainers
        required: true,
        healthCheck: () => this.checkTestcontainerRedisHealth(),
        startup: () => this.startTestcontainerRedis(),
        shutdown: () => this.stopTestcontainerRedis(),
        fallback: () => this.startEmbeddedRedis(),
        dependencies: []
      });
    } else {
      // Traditional Docker Compose services
      this.registerService({
        name: 'postgresql',
        type: 'docker',
        required: true,
        healthCheck: () => this.checkPostgreSQLHealth(),
        startup: () => this.startPostgreSQL(),
        shutdown: () => this.stopService('postgresql'),
        fallback: () => this.startEmbeddedPostgreSQL(),
        dependencies: []
      });

      this.registerService({
        name: 'redis',
        type: 'docker',
        required: true,
        healthCheck: () => this.checkRedisHealth(),
        startup: () => this.startRedis(),
        shutdown: () => this.stopService('redis'),
        fallback: () => this.startEmbeddedRedis(),
        dependencies: []
      });
    }

    logger.info('📋 Core services registered');
  }

  /**
   * Register a service with the manager
   */
  public registerService(config: ServiceConfig): void {
    this.services.set(config.name, config);
    this.serviceStatus.set(config.name, {
      name: config.name,
      status: 'stopped',
      type: config.type,
      lastCheck: new Date()
    });
    
    logger.debug(`📝 Service registered: ${config.name} (${config.type})`);
  }

  /**
   * Start all required services
   */
  public async startAllServices(): Promise<void> {
    const span = this.tracer.startSpan('start-all-services');
    
    try {
      logger.info('🚀 Starting all required services...');
      
      // Check if Docker is available
      const dockerAvailable = await this.isDockerAvailable();
      logger.info(`🐳 Docker availability: ${dockerAvailable ? 'Available' : 'Not available'}`);
      
      // Start services in dependency order
      const startOrder = this.calculateStartOrder();
      
      for (const serviceName of startOrder) {
        await this.startService(serviceName);
      }
      
      logger.info('✅ All required services started successfully');
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      logger.error('❌ Failed to start all services:', error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Start a specific service
   */
  public async startService(serviceName: string): Promise<void> {
    const span = this.tracer.startSpan(`start-service-${serviceName}`);
    
    try {
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      const status = this.serviceStatus.get(serviceName)!;
      
      if (status.status === 'running') {
        logger.debug(`⏭️ Service ${serviceName} already running`);
        return;
      }

      logger.info(`🚀 Starting service: ${serviceName}`);
      status.status = 'starting';
      status.lastCheck = new Date();

      try {
        // Try primary startup method
        await service.startup();
        
        // Verify service is healthy
        const isHealthy = await service.healthCheck();
        if (isHealthy) {
          status.status = 'running';
          logger.info(`✅ Service ${serviceName} started successfully`);
          this.emit('service:started', serviceName);
        } else {
          throw new Error('Health check failed after startup');
        }
      } catch (error: any) {
        logger.warn(`⚠️ Primary startup failed for ${serviceName}: ${error.message}`);
        
        // Try fallback if available
        if (service.fallback) {
          logger.info(`🔄 Attempting fallback startup for ${serviceName}`);
          await service.fallback();
          
          const isHealthy = await service.healthCheck();
          if (isHealthy) {
            status.status = 'fallback';
            status.type = 'embedded';
            logger.info(`✅ Service ${serviceName} started with fallback`);
            this.emit('service:started:fallback', serviceName);
          } else {
            throw new Error('Fallback startup also failed');
          }
        } else {
          throw error;
        }
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      const status = this.serviceStatus.get(serviceName)!;
      status.status = 'error';
      status.error = error.message;
      
      logger.error(`❌ Failed to start service ${serviceName}:`, error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      
      if (this.services.get(serviceName)?.required) {
        throw error;
      }
    } finally {
      span.end();
    }
  }

  /**
   * Check if Docker is available
   */
  private async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync('docker --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Docker Compose is available
   */
  private async isDockerComposeAvailable(): Promise<boolean> {
    try {
      await execAsync('docker-compose --version');
      return true;
    } catch {
      try {
        await execAsync('docker compose version');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Start PostgreSQL service
   */
  private async startPostgreSQL(): Promise<void> {
    const dockerAvailable = await this.isDockerAvailable();
    const composeAvailable = await this.isDockerComposeAvailable();
    
    if (dockerAvailable && composeAvailable) {
      await this.startDockerComposeService('postgres');
    } else {
      throw new Error('Docker/Docker Compose not available for PostgreSQL');
    }
  }

  /**
   * Start Redis service
   */
  private async startRedis(): Promise<void> {
    const dockerAvailable = await this.isDockerAvailable();
    const composeAvailable = await this.isDockerComposeAvailable();
    
    if (dockerAvailable && composeAvailable) {
      await this.startDockerComposeService('redis');
    } else {
      throw new Error('Docker/Docker Compose not available for Redis');
    }
  }

  /**
   * Start a Docker Compose service
   */
  private async startDockerComposeService(serviceName: string): Promise<void> {
    const projectRoot = path.resolve(__dirname, '../../../..');
    const composeFile = path.join(projectRoot, 'docker-compose.local.yml');
    
    // Check if compose file exists
    if (!fs.existsSync(composeFile)) {
      throw new Error(`Docker Compose file not found: ${composeFile}`);
    }
    
    logger.info(`🐳 Starting Docker Compose service: ${serviceName}`);
    
    try {
      // Use docker compose (newer) or docker-compose (legacy)
      let command = 'docker compose';
      try {
        await execAsync('docker compose version');
      } catch {
        command = 'docker-compose';
      }
      
      const { stdout, stderr } = await execAsync(
        `${command} -f "${composeFile}" up -d ${serviceName}`,
        { cwd: projectRoot, timeout: 120000 }
      );
      
      if (stderr && !stderr.includes('Creating') && !stderr.includes('Starting')) {
        logger.warn(`Docker Compose stderr: ${stderr}`);
      }
      
      logger.info(`✅ Docker Compose service ${serviceName} started`);
    } catch (error: any) {
      logger.error(`❌ Failed to start Docker Compose service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Start embedded PostgreSQL (fallback)
   */
  private async startEmbeddedPostgreSQL(): Promise<void> {
    logger.info('🔄 Starting embedded PostgreSQL (pg-mem)...');

    try {
      // Dynamic import to avoid loading if not needed
      const { newDb } = await import('pg-mem');

      // Create in-memory database
      const db = newDb();

      // Enable extensions that might be needed
      db.public.registerFunction({
        name: 'version',
        returns: DataType.text,
        implementation: () => 'PostgreSQL 14.0 (pg-mem)',
      });

      // Create a PostgreSQL-compatible server
      const { Pool } = await import('pg');

      // Store reference for health checks
      (global as any).__embedded_pg_db = db;

      // Create a pool instance for the embedded PostgreSQL
      const PgPool = db.adapters.createPg().Pool;
      const embeddedPool = new PgPool();
      (global as any).__embedded_pg_pool = embeddedPool;

      logger.info('✅ Embedded PostgreSQL started successfully');
    } catch (error: any) {
      logger.error('❌ Failed to start embedded PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Start embedded Redis (fallback)
   */
  private async startEmbeddedRedis(): Promise<void> {
    logger.info('🔄 Starting embedded Redis (redis-memory-server)...');

    try {
      // Dynamic import to avoid loading if not needed
      const { RedisMemoryServer } = await import('redis-memory-server');

      // Start Redis memory server
      const redisServer = new RedisMemoryServer({
        instance: {
          port: 6379,
          args: ['--save', '', '--appendonly', 'no']
        }
      });

      await redisServer.start();
      const port = await redisServer.getPort();
      const uri = `redis://127.0.0.1:${port}`;

      // Store reference for health checks and cleanup
      (global as any).__embedded_redis_server = redisServer;
      (global as any).__embedded_redis_uri = uri;

      logger.info(`✅ Embedded Redis started successfully at ${uri}`);
    } catch (error: any) {
      logger.error('❌ Failed to start embedded Redis:', error);
      throw error;
    }
  }

  /**
   * Check PostgreSQL health
   */
  private async checkPostgreSQLHealth(): Promise<boolean> {
    try {
      // Check if embedded PostgreSQL is running
      if ((global as any).__embedded_pg_pool) {
        return true;
      }

      // Check regular PostgreSQL connection
      const { Pool } = await import('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'x_marketing',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        max: 1
      });

      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<boolean> {
    try {
      // Check if embedded Redis is running
      if ((global as any).__embedded_redis_server) {
        return true;
      }

      // Check regular Redis connection
      const { createClient } = await import('redis');
      const client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000
        }
      });

      await client.connect();
      await client.ping();
      await client.disconnect();

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop a specific service
   */
  private async stopService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    const status = this.serviceStatus.get(serviceName);

    if (!service || !status) {
      return;
    }

    logger.info(`🛑 Stopping service: ${serviceName}`);

    try {
      if (status.type === 'embedded') {
        await this.stopEmbeddedService(serviceName);
      } else {
        await this.stopDockerService(serviceName);
      }

      status.status = 'stopped';
      status.lastCheck = new Date();

      logger.info(`✅ Service ${serviceName} stopped successfully`);
      this.emit('service:stopped', serviceName);
    } catch (error: any) {
      logger.error(`❌ Failed to stop service ${serviceName}:`, error);
      status.status = 'error';
      status.error = error.message;
    }
  }

  /**
   * Stop embedded service
   */
  private async stopEmbeddedService(serviceName: string): Promise<void> {
    if (serviceName === 'postgresql') {
      delete (global as any).__embedded_pg_db;
      delete (global as any).__embedded_pg_pool;
    } else if (serviceName === 'redis') {
      const server = (global as any).__embedded_redis_server;
      if (server) {
        await server.stop();
        delete (global as any).__embedded_redis_server;
        delete (global as any).__embedded_redis_uri;
      }
    }
  }

  /**
   * Stop Docker service
   */
  private async stopDockerService(serviceName: string): Promise<void> {
    const projectRoot = path.resolve(__dirname, '../../../..');
    const composeFile = path.join(projectRoot, 'docker-compose.local.yml');

    if (!fs.existsSync(composeFile)) {
      return;
    }

    try {
      let command = 'docker compose';
      try {
        await execAsync('docker compose version');
      } catch {
        command = 'docker-compose';
      }

      await execAsync(
        `${command} -f "${composeFile}" stop ${serviceName}`,
        { cwd: projectRoot, timeout: 30000 }
      );
    } catch (error: any) {
      logger.warn(`Warning: Failed to stop Docker service ${serviceName}:`, error.message);
    }
  }

  /**
   * Calculate service start order based on dependencies
   */
  private calculateStartOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected: ${serviceName}`);
      }
      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);
      const service = this.services.get(serviceName);
      if (service?.dependencies) {
        for (const dep of service.dependencies) {
          visit(dep);
        }
      }
      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    for (const [serviceName, service] of Array.from(this.services)) {
      if (service.required) {
        visit(serviceName);
      }
    }

    return order;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const [serviceName, service] of Array.from(this.services)) {
        const status = this.serviceStatus.get(serviceName)!;

        if (status.status === 'running' || status.status === 'fallback') {
          try {
            const isHealthy = await service.healthCheck();
            if (!isHealthy) {
              logger.warn(`⚠️ Health check failed for service: ${serviceName}`);
              status.status = 'error';
              status.error = 'Health check failed';
              this.emit('service:unhealthy', serviceName);
            } else {
              status.lastCheck = new Date();
              if (status.uptime === undefined) {
                status.uptime = 0;
              }
              status.uptime += 30; // Health check interval
            }
          } catch (error: any) {
            logger.error(`❌ Health check error for ${serviceName}:`, error);
            status.status = 'error';
            status.error = error.message;
            this.emit('service:error', serviceName, error);
          }
        }
      }
    }, 30000); // Check every 30 seconds

    logger.debug('💓 Health monitoring started');
  }

  /**
   * Get service status
   */
  public getServiceStatus(serviceName?: string): ServiceStatus | ServiceStatus[] {
    if (serviceName) {
      const status = this.serviceStatus.get(serviceName);
      if (!status) {
        throw new Error(`Service not found: ${serviceName}`);
      }
      return status;
    }

    return Array.from(this.serviceStatus.values());
  }

  /**
   * Get all services status summary
   */
  public getStatusSummary(): { total: number; running: number; stopped: number; error: number; fallback: number } {
    const statuses = Array.from(this.serviceStatus.values());
    return {
      total: statuses.length,
      running: statuses.filter(s => s.status === 'running').length,
      stopped: statuses.filter(s => s.status === 'stopped').length,
      error: statuses.filter(s => s.status === 'error').length,
      fallback: statuses.filter(s => s.status === 'fallback').length
    };
  }

  /**
   * Wait for all services to be ready
   */
  public async waitForServices(timeoutMs: number = 120000): Promise<void> {
    const span = this.tracer.startSpan('wait-for-services');

    try {
      logger.info('⏳ Waiting for all services to be ready...');

      const startTime = Date.now();
      const requiredServices = Array.from(this.services.entries())
        .filter(([, service]) => service.required)
        .map(([name]) => name);

      while (Date.now() - startTime < timeoutMs) {
        const allReady = requiredServices.every(serviceName => {
          const status = this.serviceStatus.get(serviceName);
          return status && (status.status === 'running' || status.status === 'fallback');
        });

        if (allReady) {
          logger.info('✅ All required services are ready');
          span.setStatus({ code: SpanStatusCode.OK });
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      throw new Error(`Timeout waiting for services to be ready after ${timeoutMs}ms`);
    } catch (error: any) {
      logger.error('❌ Failed to wait for services:', error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Shutdown all services
   */
  public async shutdown(): Promise<void> {
    const span = this.tracer.startSpan('shutdown-all-services');

    try {
      logger.info('🛑 Shutting down all services...');

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Stop services in reverse dependency order
      const stopOrder = this.calculateStartOrder().reverse();

      for (const serviceName of stopOrder) {
        await this.stopService(serviceName);
      }

      // Kill any remaining processes
      for (const [serviceName, process] of Array.from(this.processes)) {
        if (!process.killed) {
          logger.info(`🔪 Killing process for service: ${serviceName}`);
          process.kill('SIGTERM');
        }
      }
      this.processes.clear();

      logger.info('✅ All services shut down successfully');
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      logger.error('❌ Error during shutdown:', error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    } finally {
      span.end();
    }
  }

  /**
   * Start PostgreSQL with Testcontainers
   */
  private async startTestcontainerPostgreSQL(): Promise<void> {
    logger.info('🐳 Starting PostgreSQL with Testcontainers...');

    try {
      const { PostgreSqlContainer } = await import('@testcontainers/postgresql');

      const container = await new PostgreSqlContainer('postgres:15-alpine')
        .withDatabase(process.env.POSTGRES_DB || 'x_marketing')
        .withUsername(process.env.POSTGRES_USER || 'postgres')
        .withPassword(process.env.POSTGRES_PASSWORD || 'postgres')
        .withExposedPorts(5432)
        .start();

      // Store container reference
      (global as any).__testcontainer_postgres = container;

      // Update environment variables for other services
      process.env.DB_HOST = container.getHost();
      process.env.DB_PORT = container.getPort().toString();
      process.env.DATABASE_URL = container.getConnectionUri();

      logger.info(`✅ PostgreSQL Testcontainer started on ${container.getHost()}:${container.getPort()}`);
    } catch (error: any) {
      logger.error('❌ Failed to start PostgreSQL Testcontainer:', error);
      throw error;
    }
  }

  /**
   * Start Redis with Testcontainers
   */
  private async startTestcontainerRedis(): Promise<void> {
    logger.info('🐳 Starting Redis with Testcontainers...');

    try {
      const { RedisContainer } = await import('@testcontainers/redis');

      const container = await new RedisContainer('redis:7-alpine')
        .withExposedPorts(6379)
        .start();

      // Store container reference
      (global as any).__testcontainer_redis = container;

      // Update environment variables for other services
      process.env.REDIS_HOST = container.getHost();
      process.env.REDIS_PORT = container.getPort().toString();
      process.env.REDIS_URL = `redis://${container.getHost()}:${container.getPort()}`;

      logger.info(`✅ Redis Testcontainer started on ${container.getHost()}:${container.getPort()}`);
    } catch (error: any) {
      logger.error('❌ Failed to start Redis Testcontainer:', error);
      throw error;
    }
  }

  /**
   * Check PostgreSQL Testcontainer health
   */
  private async checkTestcontainerPostgreSQLHealth(): Promise<boolean> {
    try {
      const container = (global as any).__testcontainer_postgres;
      if (!container) return false;

      const { Pool } = await import('pg');
      const pool = new Pool({
        host: container.getHost(),
        port: container.getPort(),
        database: process.env.POSTGRES_DB || 'x_marketing',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        connectionTimeoutMillis: 5000,
        max: 1
      });

      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Redis Testcontainer health
   */
  private async checkTestcontainerRedisHealth(): Promise<boolean> {
    try {
      const container = (global as any).__testcontainer_redis;
      if (!container) return false;

      const Redis = await import('ioredis');
      const redis = new Redis.default({
        host: container.getHost(),
        port: container.getPort(),
        connectTimeout: 5000,
        lazyConnect: true,
      });

      await redis.ping();
      redis.disconnect();

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop PostgreSQL Testcontainer
   */
  private async stopTestcontainerPostgreSQL(): Promise<void> {
    const container = (global as any).__testcontainer_postgres;
    if (container) {
      await container.stop();
      delete (global as any).__testcontainer_postgres;
    }
  }

  /**
   * Stop Redis Testcontainer
   */
  private async stopTestcontainerRedis(): Promise<void> {
    const container = (global as any).__testcontainer_redis;
    if (container) {
      await container.stop();
      delete (global as any).__testcontainer_redis;
    }
  }

  /**
   * Get enterprise orchestrator instance
   */
  public getEnterpriseOrchestrator(): EnterpriseServiceOrchestrator | undefined {
    return this.enterpriseOrchestrator;
  }

  /**
   * Check if running in enterprise mode
   */
  public isEnterpriseMode(): boolean {
    return this.enterpriseMode;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`📡 Received ${signal}, shutting down gracefully...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      logger.error('💥 Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
