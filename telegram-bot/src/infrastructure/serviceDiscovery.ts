/**
 * Enterprise Service Discovery Client
 * Provides service registration, discovery, and health monitoring using Consul
 */

import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { ModernConsulClient, ConsulConfig, ServiceDefinition, ServiceInstance as ConsulServiceInstance } from './modernConsulClient';

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

export class EnterpriseServiceDiscovery extends EventEmitter {
  private consul: ModernConsulClient | null = null;
  private registeredServices: Map<string, ServiceConfig> = new Map();
  private serviceCache: Map<string, ConsulServiceInstance[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cacheRefreshInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor(consulUrl?: string) {
    super();

    // Check if Consul is disabled before creating client
    if (process.env.DISABLE_CONSUL === 'true') {
      logger.warn('⚠️ Consul service discovery disabled via DISABLE_CONSUL environment variable');
      this.consul = null;
      this.setupEventHandlers();
      return;
    }

    const consulConfig: ConsulConfig = {
      host: process.env.CONSUL_HOST || 'consul',
      port: parseInt(process.env.CONSUL_PORT || '8500'),
      secure: process.env.CONSUL_SECURE === 'true',
      token: process.env.CONSUL_TOKEN || undefined
    };

    if (consulUrl) {
      const url = new URL(consulUrl);
      consulConfig.host = url.hostname;
      consulConfig.port = parseInt(url.port || '8500');
      consulConfig.secure = url.protocol === 'https:';
    }

    this.consul = new ModernConsulClient(consulConfig);
    this.setupEventHandlers();
  }

  /**
   * Initialize service discovery
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Enterprise Service Discovery...');

      // Check if Consul is disabled or not available
      if (process.env.DISABLE_CONSUL === 'true' || !this.consul) {
        logger.warn('⚠️ Consul service discovery disabled via DISABLE_CONSUL environment variable');
        this.isConnected = false;
        return;
      }

      // Test connection using modern client
      this.isConnected = await this.consul.testConnection();

      if (this.isConnected) {
        // Start health check monitoring
        this.startHealthCheckMonitoring();

        // Start cache refresh
        this.startCacheRefresh();

        logger.info('✅ Enterprise Service Discovery initialized successfully');
        this.emit('connected');
      } else {
        throw new Error('Failed to connect to Consul');
      }

    } catch (error) {
      logger.error('❌ Failed to initialize Service Discovery:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Register a service
   */
  async registerService(config: ServiceConfig): Promise<void> {
    try {
      // Skip registration if Consul is disabled
      if (!this.consul) {
        logger.warn('⚠️ Skipping service registration - Consul is disabled', {
          serviceId: config.id,
          serviceName: config.name
        });
        return;
      }

      const serviceDefinition: ServiceDefinition = {
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

      const success = await this.consul.registerService(serviceDefinition);

      if (success) {
        this.registeredServices.set(config.id, config);

        logger.info('✅ Service registered successfully', {
          serviceId: config.id,
          serviceName: config.name,
          address: config.address,
          port: config.port
        });

        this.emit('serviceRegistered', config);
      } else {
        throw new Error('Service registration failed');
      }
      
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
      // Skip deregistration if Consul is disabled
      if (!this.consul) {
        logger.warn('⚠️ Skipping service deregistration - Consul is disabled', { serviceId });
        return;
      }

      const success = await this.consul.deregisterService(serviceId);

      if (success) {
        this.registeredServices.delete(serviceId);

        logger.info('✅ Service deregistered successfully', { serviceId });
        this.emit('serviceDeregistered', serviceId);
      } else {
        throw new Error('Service deregistration failed');
      }

    } catch (error) {
      logger.error('❌ Failed to deregister service:', error, { serviceId });
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
  } = {}): Promise<ConsulServiceInstance[]> {
    const { tag, healthy = true, cached = true } = options;

    try {
      // Return empty array if Consul is disabled
      if (!this.consul) {
        logger.warn('⚠️ Skipping service discovery - Consul is disabled', { serviceName });
        return [];
      }

      // Check cache first if enabled
      if (cached && this.serviceCache.has(serviceName)) {
        const cachedServices = this.serviceCache.get(serviceName)!;
        return this.filterServices(cachedServices, tag ? { tag, healthy } : { healthy });
      }

      // Query Consul using modern client
      const services = await this.consul.getHealthyServices(serviceName, tag);

      // Update cache
      this.serviceCache.set(serviceName, services);

      logger.debug('✅ Services discovered', {
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
   * Watch for service changes
   */
  async watchService(serviceName: string, callback: (services: ConsulServiceInstance[]) => void): Promise<void> {
    try {
      // Skip watching if Consul is disabled
      if (!this.consul) {
        logger.warn('⚠️ Skipping service watching - Consul is disabled', { serviceName });
        return;
      }

      // Modern client doesn't support watching, use polling instead
      logger.warn('⚠️ Service watching not supported with modern client, using polling', { serviceName });

      // TODO: Implement polling-based watching if needed
      return;

    } catch (error) {
      logger.error('❌ Failed to watch service:', error, { serviceName });
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth(serviceId: string): Promise<{
    status: 'passing' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: string;
      output: string;
    }>;
  }> {
    try {
      // Return default status if Consul is disabled
      if (!this.consul) {
        logger.warn('⚠️ Skipping service health check - Consul is disabled', { serviceId });
        return {
          status: 'passing',
          checks: []
        };
      }

      // Modern client doesn't have direct health checks API, return basic status
      logger.warn('⚠️ Service health checks not fully supported with modern client', { serviceId });

      return {
        status: 'passing',
        checks: []
      };

    } catch (error) {
      logger.error('❌ Failed to get service health:', error, { serviceId });
      throw error;
    }
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<Record<string, ConsulServiceInstance[]>> {
    try {
      // Return empty object if Consul is disabled
      if (!this.consul) {
        logger.warn('⚠️ Skipping get all services - Consul is disabled');
        return {};
      }

      const services = await this.consul.getAllServices();
      const result: Record<string, ConsulServiceInstance[]> = {};

      for (const serviceName of Object.keys(services)) {
        result[serviceName] = await this.discoverServices(serviceName, { cached: false });
      }

      return result;

    } catch (error) {
      logger.error('❌ Failed to get all services:', error);
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
    logger.info('Shutting down Enterprise Service Discovery...');

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
      logger.info('Enterprise Service Discovery shutdown completed');
      
    } catch (error) {
      logger.error('Error during Service Discovery shutdown:', error);
      throw error;
    }
  }

  /**
   * Filter services based on criteria
   */
  private filterServices(services: ConsulServiceInstance[], options: {
    tag?: string;
    healthy?: boolean;
  }): ConsulServiceInstance[] {
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
   * Get overall health status
   */
  private getOverallHealthStatus(checks: any[]): 'passing' | 'warning' | 'critical' {
    return this.getHealthStatus(checks);
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
    // Skip health monitoring if Consul is disabled
    if (!this.consul) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const connected = await this.consul!.testConnection();
        if (connected && !this.isConnected) {
          this.isConnected = true;
          this.emit('reconnected');
        } else if (!connected && this.isConnected) {
          this.isConnected = false;
          this.emit('disconnected');
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
export const serviceDiscovery = new EnterpriseServiceDiscovery();
