/**
 * Enterprise Service Discovery Client for Backend Service
 * Provides service registration, discovery, and health monitoring using Consul
 */

import consul from 'consul';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface ServiceConfig {
  id: string;
  name: string;
  address: string;
  port: number;
  tags: string[];
  meta: Record<string, string>;
  check: {
    http?: string;
    tcp?: string;
    interval: string;
    timeout: string;
    deregisterCriticalServiceAfter?: string;
  };
}

export interface ServiceInstance {
  id: string;
  name: string;
  address: string;
  port: number;
  tags: string[];
  meta: Record<string, string>;
  health: 'passing' | 'warning' | 'critical';
}

export class BackendServiceDiscovery extends EventEmitter {
  private consul: consul.Consul;
  private registeredServices: Map<string, ServiceConfig> = new Map();
  private serviceCache: Map<string, ServiceInstance[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cacheRefreshInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor(consulUrl?: string) {
    super();
    
    const consulConfig = {
      host: process.env.CONSUL_HOST || 'consul',
      port: process.env.CONSUL_PORT || '8500',
      secure: process.env.CONSUL_SECURE === 'true',
      promisify: true
    };

    if (consulUrl) {
      const url = new URL(consulUrl);
      consulConfig.host = url.hostname;
      consulConfig.port = url.port || '8500';
      consulConfig.secure = url.protocol === 'https:';
    }

    this.consul = consul(consulConfig);
    this.setupEventHandlers();
  }

  /**
   * Initialize service discovery
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Backend Service Discovery...');
      
      // Test connection
      await this.consul.status.leader();
      this.isConnected = true;
      
      // Start health check monitoring
      this.startHealthCheckMonitoring();
      
      // Start cache refresh
      this.startCacheRefresh();
      
      logger.info('Backend Service Discovery initialized successfully');
      this.emit('connected');
      
    } catch (error) {
      logger.error('Failed to initialize Service Discovery:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Register a service
   */
  async registerService(config: ServiceConfig): Promise<void> {
    try {
      const serviceDefinition = {
        id: config.id,
        name: config.name,
        address: config.address,
        port: config.port,
        tags: config.tags,
        meta: config.meta,
        check: {
          ...config.check,
          deregisterCriticalServiceAfter: config.check.deregisterCriticalServiceAfter || '30s'
        }
      };

      await this.consul.agent.service.register(serviceDefinition);
      this.registeredServices.set(config.id, config);
      
      logger.info('Service registered successfully', {
        serviceId: config.id,
        serviceName: config.name,
        address: config.address,
        port: config.port
      });

      this.emit('serviceRegistered', config);
      
    } catch (error) {
      logger.error('Failed to register service:', error, {
        serviceId: config.id,
        serviceName: config.name
      });
      throw error;
    }
  }

  /**
   * Deregister a service
   */
  async deregisterService(serviceId: string): Promise<void> {
    try {
      await this.consul.agent.service.deregister(serviceId);
      this.registeredServices.delete(serviceId);
      
      logger.info('Service deregistered successfully', { serviceId });
      this.emit('serviceDeregistered', serviceId);
      
    } catch (error) {
      logger.error('Failed to deregister service:', error, { serviceId });
      throw error;
    }
  }

  /**
   * Discover services by name
   */
  async discoverServices(serviceName: string, options: {
    tag?: string;
    healthy?: boolean;
    cached?: boolean;
  } = {}): Promise<ServiceInstance[]> {
    const { tag, healthy = true, cached = true } = options;

    try {
      // Check cache first if enabled
      if (cached && this.serviceCache.has(serviceName)) {
        const cachedServices = this.serviceCache.get(serviceName)!;
        return this.filterServices(cachedServices, tag ? { tag, healthy } : { healthy });
      }

      // Query Consul
      const queryOptions: any = {
        service: serviceName,
        passing: healthy
      };

      if (tag) {
        queryOptions.tag = tag;
      }

      const result = await this.consul.health.service(queryOptions) as any[];
      const services: ServiceInstance[] = result.map((entry: any) => ({
        id: entry.Service.ID,
        name: entry.Service.Service,
        address: entry.Service.Address,
        port: entry.Service.Port,
        tags: entry.Service.Tags || [],
        meta: entry.Service.Meta || {},
        health: this.getHealthStatus(entry.Checks)
      }));

      // Update cache
      this.serviceCache.set(serviceName, services);
      
      logger.debug('Services discovered', {
        serviceName,
        count: services.length,
        healthy: services.filter(s => s.health === 'passing').length
      });

      return this.filterServices(services, tag ? { tag, healthy } : { healthy });
      
    } catch (error) {
      logger.error('Failed to discover services:', error, { serviceName });
      throw error;
    }
  }

  /**
   * Get a single service instance (load balanced)
   */
  async getService(serviceName: string, options: {
    tag?: string;
    strategy?: 'round-robin' | 'random' | 'least-connections';
  } = {}): Promise<ServiceInstance | null> {
    const { strategy = 'round-robin' } = options;
    
    try {
      const services = await this.discoverServices(serviceName, options);
      
      if (services.length === 0) {
        logger.warn('No healthy services found', { serviceName });
        return null;
      }

      // Apply load balancing strategy
      switch (strategy) {
        case 'random':
          return services[Math.floor(Math.random() * services.length)] || null;
        
        case 'round-robin':
        default:
          // Simple round-robin based on service ID hash
          const index = Math.abs(serviceName.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0)) % services.length;
          return services[index] || null;
      }
      
    } catch (error) {
      logger.error('Failed to get service:', error, { serviceName });
      return null;
    }
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<Record<string, ServiceInstance[]>> {
    try {
      const services = await this.consul.catalog.service.list();
      const result: Record<string, ServiceInstance[]> = {};

      for (const serviceName of Object.keys(services as object)) {
        result[serviceName] = await this.discoverServices(serviceName, { cached: false });
      }

      return result;
      
    } catch (error) {
      logger.error('Failed to get all services:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get service discovery metrics
   */
  getMetrics(): {
    connected: boolean;
    registeredServices: number;
    cachedServices: number;
    serviceNames: string[];
  } {
    return {
      connected: this.isConnected,
      registeredServices: this.registeredServices.size,
      cachedServices: this.serviceCache.size,
      serviceNames: Array.from(this.serviceCache.keys())
    };
  }

  /**
   * Gracefully shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Backend Service Discovery...');

    try {
      // Stop intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      if (this.cacheRefreshInterval) {
        clearInterval(this.cacheRefreshInterval);
      }

      // Deregister all services
      for (const serviceId of this.registeredServices.keys()) {
        await this.deregisterService(serviceId);
      }

      this.isConnected = false;
      logger.info('Backend Service Discovery shutdown completed');
      
    } catch (error) {
      logger.error('Error during Service Discovery shutdown:', error);
      throw error;
    }
  }

  /**
   * Filter services based on criteria
   */
  private filterServices(services: ServiceInstance[], options: {
    tag?: string;
    healthy?: boolean;
  }): ServiceInstance[] {
    let filtered = services;

    if (options.tag) {
      filtered = filtered.filter(service => service.tags.includes(options.tag!));
    }

    if (options.healthy) {
      filtered = filtered.filter(service => service.health === 'passing');
    }

    return filtered;
  }

  /**
   * Get health status from checks
   */
  private getHealthStatus(checks: any[]): 'passing' | 'warning' | 'critical' {
    if (!checks || checks.length === 0) return 'critical';
    
    const statuses = checks.map(check => check.Status);
    
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'passing';
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', (error) => {
      logger.error('Service Discovery error:', error);
      this.isConnected = false;
    });
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.consul.status.leader();
        if (!this.isConnected) {
          this.isConnected = true;
          this.emit('reconnected');
        }
      } catch (error) {
        if (this.isConnected) {
          this.isConnected = false;
          this.emit('disconnected');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start cache refresh
   */
  private startCacheRefresh(): void {
    this.cacheRefreshInterval = setInterval(async () => {
      for (const serviceName of this.serviceCache.keys()) {
        try {
          await this.discoverServices(serviceName, { cached: false });
        } catch (error) {
          logger.warn('Failed to refresh service cache:', error, { serviceName });
        }
      }
    }, 60000); // Refresh every minute
  }
}

// Singleton instance
export const serviceDiscovery = new BackendServiceDiscovery();
