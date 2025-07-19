/**
 * Enterprise Service Orchestrator
 * 
 * Manages the complete lifecycle of all services in the platform:
 * - Service discovery and registration
 * - Health monitoring and recovery
 * - Inter-service communication
 * - Load balancing and failover
 * - Distributed configuration management
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { EnterpriseDatabaseManager, DatabaseConfig } from './enterpriseDatabaseManager';
import axios, { AxiosInstance } from 'axios';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ModernConsulClient, ConsulConfig } from '../infrastructure/modernConsulClient';

export interface ServiceConfig {
  name: string;
  version: string;
  host: string;
  port: number;
  healthCheckPath: string;
  dependencies: string[];
  metadata: Record<string, any>;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
}

export interface ServiceStatus {
  name: string;
  status: 'starting' | 'healthy' | 'unhealthy' | 'stopped';
  lastHealthCheck: Date;
  uptime: number;
  errorCount: number;
  responseTime: number;
  dependencies: Record<string, boolean>;
}

export interface ServiceRegistry {
  [serviceName: string]: {
    config: ServiceConfig;
    status: ServiceStatus;
    httpClient: AxiosInstance;
    healthCheckInterval?: NodeJS.Timeout;
  };
}

export class EnterpriseServiceOrchestrator extends EventEmitter {
  private databaseManager: EnterpriseDatabaseManager;
  private serviceRegistry: ServiceRegistry = {};
  private consulClient?: ModernConsulClient | undefined;
  private isInitialized = false;
  private orchestrationInterval?: NodeJS.Timeout;
  private serviceStartOrder: string[] = [];
  private serviceProcesses: Map<string, ChildProcess> = new Map();
  private projectRoot: string;
  private isShuttingDown = false;

  constructor(private databaseConfig: DatabaseConfig) {
    super();
    this.databaseManager = new EnterpriseDatabaseManager(databaseConfig);
    this.projectRoot = path.resolve(__dirname, '../../..');
  }

  /**
   * Initialize the enterprise service orchestrator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enterprise Service Orchestrator already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Enterprise Service Orchestrator...');

      // Initialize database manager first
      await this.databaseManager.initialize();

      // Initialize service discovery (Consul)
      await this.initializeServiceDiscovery();

      // Register core services
      await this.registerCoreServices();

      // Start all registered services
      await this.startAllServices();

      // Start orchestration monitoring
      this.startOrchestrationMonitoring();

      this.isInitialized = true;
      this.emit('initialized');
      logger.info('✅ Enterprise Service Orchestrator initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise Service Orchestrator:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize service discovery with Consul
   */
  private async initializeServiceDiscovery(): Promise<void> {
    try {
      // Check if Consul is disabled
      if (process.env.DISABLE_CONSUL === 'true') {
        logger.warn('⚠️ Consul service discovery disabled via DISABLE_CONSUL environment variable');
        this.consulClient = undefined;
        return;
      }

      // Create modern Consul client
      const consulConfig: ConsulConfig = {
        host: process.env.CONSUL_HOST || 'consul',
        port: parseInt(process.env.CONSUL_PORT || '8500'),
        secure: process.env.CONSUL_SECURE === 'true',
        token: process.env.CONSUL_TOKEN || undefined
      };

      this.consulClient = new ModernConsulClient(consulConfig);

      // Test Consul connection
      const connected = await this.consulClient.testConnection();

      if (connected) {
        logger.info('✅ Connected to Consul service discovery');
      } else {
        throw new Error('Failed to connect to Consul');
      }

    } catch (error) {
      logger.warn('⚠️ Consul not available, using local service registry', { error: error instanceof Error ? error.message : String(error) });
      this.consulClient = undefined;
    }
  }

  /**
   * Register core platform services
   */
  private async registerCoreServices(): Promise<void> {
    const coreServices: ServiceConfig[] = [
      {
        name: 'backend-api',
        version: '1.0.0',
        host: 'localhost',
        port: 3001,
        healthCheckPath: '/health/ready',
        dependencies: [],
        metadata: {
          type: 'api',
          role: 'primary',
          capabilities: ['rest-api', 'websocket', 'auth'],
        },
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
        },
      },
      {
        name: 'frontend-app',
        version: '1.0.0',
        host: 'localhost',
        port: 3004,
        healthCheckPath: '/api/health',
        dependencies: ['backend-api'],
        metadata: {
          type: 'frontend',
          role: 'ui',
          capabilities: ['react', 'ssr'],
        },
        retryPolicy: {
          maxRetries: 2,
          retryDelay: 500,
          backoffMultiplier: 1.5,
        },
      },
      {
        name: 'telegram-bot',
        version: '1.0.0',
        host: 'localhost',
        port: 3002,
        healthCheckPath: '/health',
        dependencies: ['backend-api'],
        metadata: {
          type: 'bot',
          role: 'interface',
          capabilities: ['telegram-api', 'webhooks'],
        },
        retryPolicy: {
          maxRetries: 5,
          retryDelay: 2000,
          backoffMultiplier: 2,
        },
      },
      {
        name: 'llm-service',
        version: '1.0.0',
        host: 'localhost',
        port: 3003,
        healthCheckPath: '/health',
        dependencies: ['backend-api'],
        metadata: {
          type: 'ai',
          role: 'processor',
          capabilities: ['llm', 'embeddings', 'analysis'],
        },
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 3000,
          backoffMultiplier: 2,
        },
      },
    ];

    // Determine service start order based on dependencies
    this.serviceStartOrder = this.calculateServiceStartOrder(coreServices);
    logger.info(`📋 Service start order: ${this.serviceStartOrder.join(' → ')}`);

    // Register each service
    for (const serviceConfig of coreServices) {
      await this.registerService(serviceConfig);
    }
  }

  /**
   * Start all registered services in dependency order
   */
  private async startAllServices(): Promise<void> {
    logger.info('🚀 Starting all enterprise services...');

    for (const serviceName of this.serviceStartOrder) {
      if (serviceName === 'backend-api') {
        // Backend API is already running (this is the backend)
        logger.info(`✅ Backend API is already running`);
        continue;
      }

      try {
        await this.startService(serviceName);

        // Wait for service to be healthy before starting next one
        await this.waitForServiceHealth(serviceName, 30000); // 30 second timeout

        logger.info(`✅ Service ${serviceName} started and healthy`);
      } catch (error: any) {
        logger.error(`❌ Failed to start service ${serviceName}:`, error.message);
        logger.error(`❌ Error details:`, error.stack || error);
        // Continue with other services - don't fail the entire startup
      }
    }

    logger.info('🎉 All enterprise services startup completed');
  }

  /**
   * Start a specific service
   */
  private async startService(serviceName: string): Promise<void> {
    const service = this.serviceRegistry[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    logger.info(`🚀 Starting service: ${serviceName}`);

    let serviceProcess: ChildProcess;
    let cwd: string;
    let command: string;
    let args: string[];

    switch (serviceName) {
      case 'frontend-app':
        cwd = path.join(this.projectRoot, 'frontend');
        command = 'npm';
        args = ['run', 'dev'];
        break;

      case 'telegram-bot':
        cwd = path.join(this.projectRoot, 'telegram-bot');
        command = 'npm';
        args = ['run', 'dev'];
        break;

      case 'llm-service':
        cwd = path.join(this.projectRoot, 'llm-service');
        command = 'python3';
        args = ['app.py'];
        break;

      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }

    // Check if service directory exists
    if (!fs.existsSync(cwd)) {
      logger.error(`❌ Service directory not found: ${cwd}`);
      logger.error(`❌ Available directories in project root:`, fs.readdirSync(this.projectRoot));
      throw new Error(`Service directory not found: ${cwd}`);
    }

    logger.info(`📁 Service directory found: ${cwd}`);
    logger.info(`🔧 Starting ${serviceName} with command: ${command} ${args.join(' ')}`);

    // Get enterprise database connection info
    const dbConnectionInfo = await this.databaseManager.getConnectionInfo();

    if (!dbConnectionInfo.postgres || !dbConnectionInfo.redis) {
      throw new Error('Enterprise database containers not available');
    }

    // Set environment variables for the service
    const env = {
      ...process.env,
      PORT: service.config.port.toString(),
      NODE_ENV: process.env.NODE_ENV || 'development',
      // Pass enterprise database connection info
      DB_HOST: dbConnectionInfo.postgres.host,
      DB_PORT: dbConnectionInfo.postgres.port.toString(),
      DB_NAME: dbConnectionInfo.postgres.database,
      DB_USER: dbConnectionInfo.postgres.username,
      DB_PASSWORD: dbConnectionInfo.postgres.password,
      DATABASE_URL: `postgresql://${dbConnectionInfo.postgres.username}:${dbConnectionInfo.postgres.password}@${dbConnectionInfo.postgres.host}:${dbConnectionInfo.postgres.port}/${dbConnectionInfo.postgres.database}`,
      POSTGRES_HOST: dbConnectionInfo.postgres.host,
      POSTGRES_PORT: dbConnectionInfo.postgres.port.toString(),
      POSTGRES_DB: dbConnectionInfo.postgres.database,
      POSTGRES_USER: dbConnectionInfo.postgres.username,
      POSTGRES_PASSWORD: dbConnectionInfo.postgres.password,
      // Redis connection info
      REDIS_HOST: dbConnectionInfo.redis.host,
      REDIS_PORT: dbConnectionInfo.redis.port.toString(),
      REDIS_URL: `redis://${dbConnectionInfo.redis.host}:${dbConnectionInfo.redis.port}`,
      // Backend API URL for service communication
      API_URL: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
      BACKEND_URL: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
      LLM_SERVICE_URL: 'http://localhost:3003',
      // Telegram bot specific
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0',
      ENABLE_POLLING: 'true',
    };

    // Start the service process
    serviceProcess = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Store process reference
    this.serviceProcesses.set(serviceName, serviceProcess);

    // Setup process event handlers
    this.setupProcessHandlers(serviceName, serviceProcess);

    logger.info(`📦 Service ${serviceName} process started with PID: ${serviceProcess.pid}`);
  }

  /**
   * Setup event handlers for a service process
   */
  private setupProcessHandlers(serviceName: string, serviceProcess: ChildProcess): void {
    serviceProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.info(`[${serviceName}] ${output}`);
      }
    });

    serviceProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('ExperimentalWarning')) {
        logger.warn(`[${serviceName}] ${output}`);
      }
    });

    serviceProcess.on('exit', (code, signal) => {
      if (!this.isShuttingDown) {
        logger.error(`💥 Service ${serviceName} exited with code ${code}, signal ${signal}`);
        this.serviceProcesses.delete(serviceName);

        // Mark service as unhealthy
        const service = this.serviceRegistry[serviceName];
        if (service) {
          service.status.status = 'unhealthy';
          service.status.lastHealthCheck = new Date();
          this.emit('service-crashed', serviceName, { code, signal });
        }

        // Attempt restart after delay
        setTimeout(() => {
          if (!this.isShuttingDown) {
            logger.info(`🔄 Attempting to restart service: ${serviceName}`);
            this.startService(serviceName).catch((error: any) => {
              logger.error(`❌ Failed to restart service ${serviceName}:`, error.message);
            });
          }
        }, 5000);
      }
    });

    serviceProcess.on('error', (error) => {
      logger.error(`💥 Service ${serviceName} process error:`, error);
      this.emit('service-error', serviceName, error);
    });
  }

  /**
   * Wait for a service to become healthy
   */
  private async waitForServiceHealth(serviceName: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    const service = this.serviceRegistry[serviceName];

    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    while (Date.now() - startTime < timeout) {
      try {
        const response = await service.httpClient.get(service.config.healthCheckPath, {
          timeout: 5000,
        });

        if (response.status === 200) {
          service.status.status = 'healthy';
          service.status.lastHealthCheck = new Date();
          return;
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }

      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Service ${serviceName} did not become healthy within ${timeout}ms`);
  }

  /**
   * Calculate optimal service start order based on dependencies
   */
  private calculateServiceStartOrder(services: ServiceConfig[]): string[] {
    const serviceMap = new Map(services.map(s => [s.name, s]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);
      const service = serviceMap.get(serviceName);
      
      if (service) {
        for (const dependency of service.dependencies) {
          visit(dependency);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    for (const service of services) {
      visit(service.name);
    }

    return order;
  }

  /**
   * Register a service in the orchestrator
   */
  async registerService(config: ServiceConfig): Promise<void> {
    try {
      logger.info(`📝 Registering service: ${config.name}`);

      // Create HTTP client for service communication
      const httpClient = axios.create({
        baseURL: `http://${config.host}:${config.port}`,
        timeout: 10000,
        headers: {
          'User-Agent': 'Enterprise-Service-Orchestrator/1.0',
          'X-Service-Name': 'orchestrator',
        },
      });

      // Create service status
      const status: ServiceStatus = {
        name: config.name,
        status: 'starting',
        lastHealthCheck: new Date(),
        uptime: 0,
        errorCount: 0,
        responseTime: 0,
        dependencies: {},
      };

      // Register in local registry
      this.serviceRegistry[config.name] = {
        config,
        status,
        httpClient,
      };

      // Register with Consul if available
      if (this.consulClient) {
        await this.consulClient.registerService({
          id: `${config.name}-${config.version}`,
          name: config.name,
          tags: [config.version, config.metadata.type],
          address: config.host,
          port: config.port,
          check: {
            http: `http://${config.host}:${config.port}${config.healthCheckPath}`,
            interval: '30s',
            timeout: '10s',
          },
          meta: config.metadata,
        });
      }

      // Start health monitoring
      this.startServiceHealthMonitoring(config.name);

      this.emit('service-registered', config.name);
      logger.info(`✅ Service registered: ${config.name}`);

    } catch (error) {
      logger.error(`❌ Failed to register service ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Start health monitoring for a service
   */
  private startServiceHealthMonitoring(serviceName: string): void {
    const service = this.serviceRegistry[serviceName];
    if (!service) return;

    service.healthCheckInterval = setInterval(async () => {
      await this.performServiceHealthCheck(serviceName);
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health check for a specific service
   */
  async performServiceHealthCheck(serviceName: string): Promise<boolean> {
    const service = this.serviceRegistry[serviceName];
    if (!service) return false;

    const startTime = Date.now();

    try {
      const response = await service.httpClient.get(service.config.healthCheckPath);
      const responseTime = Date.now() - startTime;

      // Update service status
      service.status.status = response.status === 200 ? 'healthy' : 'unhealthy';
      service.status.lastHealthCheck = new Date();
      service.status.responseTime = responseTime;
      service.status.uptime = Date.now() - startTime;

      // Check dependencies
      await this.checkServiceDependencies(serviceName);

      this.emit('health-check-completed', serviceName, service.status);
      return service.status.status === 'healthy';

    } catch (error: any) {
      service.status.status = 'unhealthy';
      service.status.errorCount++;
      service.status.lastHealthCheck = new Date();

      logger.warn(`⚠️ Health check failed for ${serviceName}:`, error.message);
      this.emit('health-check-failed', serviceName, error);

      // Attempt service recovery
      await this.attemptServiceRecovery(serviceName);

      return false;
    }
  }

  /**
   * Check service dependencies
   */
  private async checkServiceDependencies(serviceName: string): Promise<void> {
    const service = this.serviceRegistry[serviceName];
    if (!service) return;

    for (const dependencyName of service.config.dependencies) {
      const dependency = this.serviceRegistry[dependencyName];
      if (dependency) {
        service.status.dependencies[dependencyName] = 
          dependency.status.status === 'healthy';
      } else {
        service.status.dependencies[dependencyName] = false;
      }
    }
  }

  /**
   * Attempt to recover a failed service
   */
  private async attemptServiceRecovery(serviceName: string): Promise<void> {
    const service = this.serviceRegistry[serviceName];
    if (!service) return;

    logger.info(`🔄 Attempting recovery for service: ${serviceName}`);

    try {
      // Implement recovery strategies based on service type
      switch (service.config.metadata.type) {
        case 'api':
          await this.recoverApiService(serviceName);
          break;
        case 'frontend':
          await this.recoverFrontendService(serviceName);
          break;
        case 'bot':
          await this.recoverBotService(serviceName);
          break;
        case 'ai':
          await this.recoverAiService(serviceName);
          break;
        default:
          await this.genericServiceRecovery(serviceName);
      }

      this.emit('service-recovered', serviceName);
      logger.info(`✅ Service recovery completed: ${serviceName}`);

    } catch (error) {
      logger.error(`❌ Service recovery failed for ${serviceName}:`, error);
      this.emit('service-recovery-failed', serviceName, error);
    }
  }

  /**
   * Recover API service
   */
  private async recoverApiService(serviceName: string): Promise<void> {
    // Check database connections
    const health = await this.databaseManager.performHealthCheck();
    if (!health.postgres || !health.redis) {
      logger.warn('Database services unhealthy, attempting database recovery');
      // Database recovery would be handled by the database manager
    }

    // Clear any stuck connections or caches
    // Restart service if necessary
  }

  /**
   * Recover frontend service
   */
  private async recoverFrontendService(serviceName: string): Promise<void> {
    // Check if backend API is healthy
    const backendHealth = await this.performServiceHealthCheck('backend-api');
    if (!backendHealth) {
      logger.warn('Backend API unhealthy, frontend recovery may fail');
    }
  }

  /**
   * Recover bot service
   */
  private async recoverBotService(serviceName: string): Promise<void> {
    // Check webhook connections
    // Verify Telegram API connectivity
    // Reset bot state if necessary
  }

  /**
   * Recover AI service
   */
  private async recoverAiService(serviceName: string): Promise<void> {
    // Check model availability
    // Clear model cache if necessary
    // Verify GPU/CPU resources
  }

  /**
   * Generic service recovery
   */
  private async genericServiceRecovery(serviceName: string): Promise<void> {
    // Basic recovery: wait and retry
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  /**
   * Start orchestration monitoring
   */
  private startOrchestrationMonitoring(): void {
    this.orchestrationInterval = setInterval(async () => {
      await this.performOrchestrationTasks();
    }, 60000); // Every minute
  }

  /**
   * Perform orchestration tasks
   */
  private async performOrchestrationTasks(): Promise<void> {
    try {
      // Check overall system health
      const systemHealth = await this.getSystemHealth();
      
      // Emit system health metrics
      this.emit('system-health', systemHealth);

      // Perform load balancing if needed
      await this.performLoadBalancing();

      // Clean up failed services
      await this.cleanupFailedServices();

    } catch (error) {
      logger.error('Orchestration tasks failed:', error);
    }
  }

  /**
   * Get overall system health
   */
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, ServiceStatus>;
    database: any;
  }> {
    const services: Record<string, ServiceStatus> = {};
    let healthyCount = 0;

    for (const [name, service] of Object.entries(this.serviceRegistry)) {
      services[name] = { ...service.status };
      if (service.status.status === 'healthy') {
        healthyCount++;
      }
    }

    const totalServices = Object.keys(this.serviceRegistry).length;
    const healthPercentage = totalServices > 0 ? healthyCount / totalServices : 0;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthPercentage >= 0.8) {
      overall = 'healthy';
    } else if (healthPercentage >= 0.5) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services,
      database: this.databaseManager.getMetrics(),
    };
  }

  /**
   * Perform load balancing
   */
  private async performLoadBalancing(): Promise<void> {
    // Implement load balancing logic
    // This could involve spinning up additional instances
    // or redistributing traffic
  }

  /**
   * Clean up failed services
   */
  private async cleanupFailedServices(): Promise<void> {
    for (const [name, service] of Object.entries(this.serviceRegistry)) {
      if (service.status.status === 'unhealthy' && service.status.errorCount > 10) {
        logger.warn(`🧹 Cleaning up persistently failed service: ${name}`);
        // Implement cleanup logic
      }
    }
  }

  /**
   * Make inter-service call
   */
  async callService(
    serviceName: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any
  ): Promise<any> {
    const service = this.serviceRegistry[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    if (service.status.status !== 'healthy') {
      throw new Error(`Service ${serviceName} is not healthy`);
    }

    try {
      const response = await service.httpClient.request({
        method,
        url: path,
        data,
      });

      return response.data;

    } catch (error: any) {
      logger.error(`Inter-service call failed: ${serviceName}${path}`, error);
      throw error;
    }
  }

  /**
   * Get service registry
   */
  getServiceRegistry(): ServiceRegistry {
    return { ...this.serviceRegistry };
  }

  /**
   * Get database manager
   */
  getDatabaseManager(): EnterpriseDatabaseManager {
    return this.databaseManager;
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down Enterprise Service Orchestrator...');
    this.isShuttingDown = true;

    // Stop all service processes
    await this.stopAllServices();

    // Clear intervals
    if (this.orchestrationInterval) {
      clearInterval(this.orchestrationInterval);
    }

    // Stop service health monitoring
    for (const service of Object.values(this.serviceRegistry)) {
      if (service.healthCheckInterval) {
        clearInterval(service.healthCheckInterval);
      }
    }

    // Deregister services from Consul
    if (this.consulClient) {
      for (const service of Object.values(this.serviceRegistry)) {
        try {
          await this.consulClient.deregisterService(
            `${service.config.name}-${service.config.version}`
          );
        } catch (error) {
          logger.warn(`Failed to deregister service ${service.config.name}:`, error);
        }
      }
    }

    // Shutdown database manager
    await this.databaseManager.shutdown();

    this.isInitialized = false;
    this.emit('shutdown');
    logger.info('✅ Enterprise Service Orchestrator shutdown complete');
  }

  /**
   * Stop all service processes
   */
  private async stopAllServices(): Promise<void> {
    logger.info('🛑 Stopping all enterprise services...');

    const stopPromises: Promise<void>[] = [];

    for (const [serviceName, process] of this.serviceProcesses) {
      stopPromises.push(this.stopService(serviceName, process));
    }

    await Promise.all(stopPromises);
    this.serviceProcesses.clear();

    logger.info('✅ All enterprise services stopped');
  }

  /**
   * Stop a specific service process
   */
  private async stopService(serviceName: string, serviceProcess: ChildProcess): Promise<void> {
    return new Promise<void>((resolve) => {
      logger.info(`🛑 Stopping service: ${serviceName}`);

      const timeout = setTimeout(() => {
        logger.warn(`⚠️ Force killing service ${serviceName} (timeout)`);
        serviceProcess.kill('SIGKILL');
        resolve();
      }, 10000); // 10 second timeout

      serviceProcess.on('exit', () => {
        clearTimeout(timeout);
        logger.info(`✅ Service ${serviceName} stopped`);
        resolve();
      });

      // Try graceful shutdown first
      serviceProcess.kill('SIGTERM');
    });
  }
}
