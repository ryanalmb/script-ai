import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface ConsulConfig {
  host: string;
  port: number;
  secure?: boolean;
  token?: string | undefined;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  address: string;
  port: number;
  tags?: string[];
  meta?: Record<string, string>;
  check?: HealthCheck;
}

export interface HealthCheck {
  http?: string;
  tcp?: string;
  interval?: string;
  timeout?: string;
  deregisterCriticalServiceAfter?: string;
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

/**
 * Modern Consul Client using direct HTTP API calls
 * Replaces the deprecated consul npm package
 */
export class ModernConsulClient extends EventEmitter {
  private httpClient: AxiosInstance;
  private config: ConsulConfig;
  private isConnected: boolean = false;

  constructor(config: ConsulConfig) {
    super();
    this.config = config;
    
    const baseURL = `${config.secure ? 'https' : 'http'}://${config.host}:${config.port}`;
    
    this.httpClient = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.token && { 'X-Consul-Token': config.token })
      }
    });

    // Add request/response interceptors for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('Consul HTTP Request', { 
          method: config.method?.toUpperCase(), 
          url: config.url,
          baseURL: config.baseURL 
        });
        return config;
      },
      (error) => {
        logger.error('Consul HTTP Request Error', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('Consul HTTP Response', { 
          status: response.status, 
          url: response.config.url 
        });
        return response;
      },
      (error) => {
        logger.error('Consul HTTP Response Error', { 
          status: error.response?.status,
          url: error.config?.url,
          message: error.message 
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test connection to Consul
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/v1/status/leader');
      this.isConnected = response.status === 200;
      
      if (this.isConnected) {
        logger.info('✅ Connected to Consul', { 
          host: this.config.host, 
          port: this.config.port,
          leader: response.data 
        });
        this.emit('connected');
      }
      
      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ Failed to connect to Consul', { 
        host: this.config.host, 
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      });
      this.emit('disconnected', error);
      return false;
    }
  }

  /**
   * Register a service with Consul
   */
  async registerService(service: ServiceDefinition): Promise<boolean> {
    try {
      const response = await this.httpClient.put(`/v1/agent/service/register`, service);
      
      if (response.status === 200) {
        logger.info('✅ Service registered successfully', {
          serviceId: service.id,
          serviceName: service.name,
          address: service.address,
          port: service.port
        });
        this.emit('serviceRegistered', service);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('❌ Failed to register service', {
        serviceId: service.id,
        error: error instanceof Error ? error.message : String(error)
      });
      this.emit('serviceRegistrationFailed', service, error);
      return false;
    }
  }

  /**
   * Deregister a service from Consul
   */
  async deregisterService(serviceId: string): Promise<boolean> {
    try {
      const response = await this.httpClient.put(`/v1/agent/service/deregister/${serviceId}`);
      
      if (response.status === 200) {
        logger.info('✅ Service deregistered successfully', { serviceId });
        this.emit('serviceDeregistered', serviceId);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('❌ Failed to deregister service', {
        serviceId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get healthy service instances
   */
  async getHealthyServices(serviceName: string, tag?: string): Promise<ServiceInstance[]> {
    try {
      const params: Record<string, string> = { passing: 'true' };
      if (tag) params.tag = tag;

      const response = await this.httpClient.get(`/v1/health/service/${serviceName}`, { params });
      
      if (response.status === 200) {
        const instances: ServiceInstance[] = response.data.map((item: any) => ({
          id: item.Service.ID,
          name: item.Service.Service,
          address: item.Service.Address,
          port: item.Service.Port,
          tags: item.Service.Tags || [],
          meta: item.Service.Meta || {},
          health: this.determineHealth(item.Checks)
        }));

        logger.debug('✅ Retrieved healthy services', { 
          serviceName, 
          count: instances.length 
        });
        
        return instances;
      }
      
      return [];
    } catch (error) {
      logger.error('❌ Failed to get healthy services', {
        serviceName,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get all services
   */
  async getAllServices(): Promise<Record<string, string[]>> {
    try {
      const response = await this.httpClient.get('/v1/catalog/services');
      
      if (response.status === 200) {
        logger.debug('✅ Retrieved all services', { 
          count: Object.keys(response.data).length 
        });
        return response.data;
      }
      
      return {};
    } catch (error) {
      logger.error('❌ Failed to get all services', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  /**
   * Get agent information
   */
  async getAgentInfo(): Promise<any> {
    try {
      const response = await this.httpClient.get('/v1/agent/self');
      
      if (response.status === 200) {
        logger.debug('✅ Retrieved agent info');
        return response.data;
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Failed to get agent info', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Check if connected to Consul
   */
  isConnectedToConsul(): boolean {
    return this.isConnected;
  }

  /**
   * Determine health status from checks
   */
  private determineHealth(checks: any[]): 'passing' | 'warning' | 'critical' {
    if (!checks || checks.length === 0) return 'passing';
    
    const statuses = checks.map(check => check.Status);
    
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'passing';
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeAllListeners();
    this.isConnected = false;
  }
}
