import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface ConsulServiceCheck {
  HTTP?: string;
  TCP?: string;
  Interval: string;
  Timeout: string;
  DeregisterCriticalServiceAfter?: string;
}

export interface ConsulService {
  ID: string;
  Name: string;
  Tags: string[];
  Address: string;
  Port: number;
  Meta?: Record<string, string>;
  Check?: ConsulServiceCheck;
}

export interface ConsulHealthCheck {
  Node: string;
  CheckID: string;
  Name: string;
  Status: 'passing' | 'warning' | 'critical';
  Notes: string;
  Output: string;
  ServiceID: string;
  ServiceName: string;
}

export interface ConsulKVPair {
  Key: string;
  Value: string;
  Flags?: number;
}

export class EnhancedConsulClient extends EventEmitter {
  private client: AxiosInstance;
  private baseUrl: string;
  private healthCheckInterval?: NodeJS.Timeout;
  private isConnected: boolean = false;

  constructor(
    private config: {
      host: string;
      port: number;
      secure?: boolean;
      token?: string;
      datacenter?: string;
    }
  ) {
    super();
    
    this.baseUrl = `${config.secure ? 'https' : 'http'}://${config.host}:${config.port}`;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.token && { 'X-Consul-Token': config.token })
      }
    });

    this.setupHealthCheck();
  }

  private setupHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.client.get('/v1/status/leader');
        if (!this.isConnected) {
          this.isConnected = true;
          this.emit('connect');
        }
      } catch (error) {
        if (this.isConnected) {
          this.isConnected = false;
          this.emit('disconnect', error);
        }
      }
    }, 5000);
  }

  async registerService(service: ConsulService): Promise<void> {
    try {
      await this.client.put('/v1/agent/service/register', service);
      this.emit('serviceRegistered', service);
    } catch (error) {
      this.emit('error', new Error(`Failed to register service ${service.Name}: ${error}`));
      throw error;
    }
  }

  async deregisterService(serviceId: string): Promise<void> {
    try {
      await this.client.put(`/v1/agent/service/deregister/${serviceId}`);
      this.emit('serviceDeregistered', serviceId);
    } catch (error) {
      this.emit('error', new Error(`Failed to deregister service ${serviceId}: ${error}`));
      throw error;
    }
  }

  async getService(serviceName: string): Promise<ConsulService[]> {
    try {
      const response = await this.client.get(`/v1/health/service/${serviceName}`, {
        params: { passing: true }
      });
      
      return response.data.map((entry: any) => ({
        ID: entry.Service.ID,
        Name: entry.Service.Service,
        Tags: entry.Service.Tags,
        Address: entry.Service.Address,
        Port: entry.Service.Port,
        Meta: entry.Service.Meta
      }));
    } catch (error) {
      this.emit('error', new Error(`Failed to get service ${serviceName}: ${error}`));
      throw error;
    }
  }

  async getServices(): Promise<Record<string, string[]>> {
    try {
      const response = await this.client.get('/v1/catalog/services');
      return response.data;
    } catch (error) {
      this.emit('error', new Error(`Failed to get services: ${error}`));
      throw error;
    }
  }

  async getHealthChecks(serviceName?: string): Promise<ConsulHealthCheck[]> {
    try {
      const url = serviceName 
        ? `/v1/health/checks/${serviceName}`
        : '/v1/health/state/any';
      
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      this.emit('error', new Error(`Failed to get health checks: ${error}`));
      throw error;
    }
  }

  async setKV(key: string, value: string, flags?: number): Promise<void> {
    try {
      await this.client.put(`/v1/kv/${key}`, value, {
        params: flags ? { flags } : undefined
      });
      this.emit('kvSet', { key, value });
    } catch (error) {
      this.emit('error', new Error(`Failed to set KV ${key}: ${error}`));
      throw error;
    }
  }

  async getKV(key: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/v1/kv/${key}`);
      if (response.data && response.data.length > 0) {
        return Buffer.from(response.data[0].Value, 'base64').toString();
      }
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      this.emit('error', new Error(`Failed to get KV ${key}: ${error}`));
      throw error;
    }
  }

  async deleteKV(key: string): Promise<void> {
    try {
      await this.client.delete(`/v1/kv/${key}`);
      this.emit('kvDeleted', key);
    } catch (error) {
      this.emit('error', new Error(`Failed to delete KV ${key}: ${error}`));
      throw error;
    }
  }

  async getLeader(): Promise<string> {
    try {
      const response = await this.client.get('/v1/status/leader');
      return response.data;
    } catch (error) {
      this.emit('error', new Error(`Failed to get leader: ${error}`));
      throw error;
    }
  }

  async getMembers(): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/agent/members');
      return response.data;
    } catch (error) {
      this.emit('error', new Error(`Failed to get members: ${error}`));
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.removeAllListeners();
  }
}

// Factory function for creating Consul client with fallback
export function createConsulClient(config: {
  host: string;
  port: number;
  secure?: boolean;
  token?: string;
  datacenter?: string;
}): EnhancedConsulClient {
  return new EnhancedConsulClient(config);
}

// Compatibility wrapper for legacy consul package
export class ConsulCompatibilityWrapper {
  private enhancedClient: EnhancedConsulClient;

  constructor(options: any) {
    this.enhancedClient = new EnhancedConsulClient({
      host: options.host || 'localhost',
      port: options.port || 8500,
      secure: options.secure || false,
      token: options.token,
      datacenter: options.dc
    });
  }

  get agent() {
    return {
      service: {
        register: (service: any) => this.enhancedClient.registerService(service),
        deregister: (id: string) => this.enhancedClient.deregisterService(id),
        list: () => this.enhancedClient.getServices()
      }
    };
  }

  get health() {
    return {
      service: (name: string) => this.enhancedClient.getService(name),
      checks: (name?: string) => this.enhancedClient.getHealthChecks(name)
    };
  }

  get kv() {
    return {
      set: (key: string, value: string) => this.enhancedClient.setKV(key, value),
      get: (key: string) => this.enhancedClient.getKV(key),
      del: (key: string) => this.enhancedClient.deleteKV(key)
    };
  }

  get status() {
    return {
      leader: () => this.enhancedClient.getLeader()
    };
  }

  destroy() {
    this.enhancedClient.destroy();
  }
}
