import { EventEmitter } from 'events';
import { ModernConsulClient, ConsulConfig, ServiceDefinition } from './modernConsulClient';
import { EnhancedConsulClient, ConsulCompatibilityWrapper } from './enhancedConsulClient';
import { logger } from '../utils/logger';

export interface ConsulServiceManagerConfig extends ConsulConfig {
  enableFallback?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export class ConsulServiceManager extends EventEmitter {
  private modernClient: ModernConsulClient;
  private enhancedClient: EnhancedConsulClient;
  private legacyClient?: any; // For the deprecated consul package
  private config: ConsulServiceManagerConfig;
  private isInitialized: boolean = false;

  constructor(config: ConsulServiceManagerConfig) {
    super();
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      enableFallback: true,
      ...config
    };

    // Initialize modern client
    this.modernClient = new ModernConsulClient(config);
    const enhancedConfig: any = {
      host: config.host,
      port: config.port,
      secure: config.secure || false,
      datacenter: 'dc1'
    };

    if (config.token) {
      enhancedConfig.token = config.token;
    }

    this.enhancedClient = new EnhancedConsulClient(enhancedConfig);

    // Initialize legacy client if available and fallback is enabled
    if (this.config.enableFallback) {
      this.initializeLegacyClient();
    }

    this.setupEventHandlers();
  }

  private initializeLegacyClient(): void {
    try {
      // Try to load the deprecated consul package
      const consul = require('consul');
      this.legacyClient = new consul({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        token: this.config.token
      });
      logger.info('Legacy Consul client initialized as fallback');
    } catch (error) {
      logger.warn('Legacy consul package not available, using modern clients only', { error });
    }
  }

  private setupEventHandlers(): void {
    this.modernClient.on('connect', () => {
      this.isInitialized = true;
      this.emit('connect', 'modern');
      logger.info('Modern Consul client connected');
    });

    this.modernClient.on('disconnect', (error) => {
      this.emit('disconnect', 'modern', error);
      logger.warn('Modern Consul client disconnected', { error });
    });

    this.enhancedClient.on('connect', () => {
      this.emit('connect', 'enhanced');
      logger.info('Enhanced Consul client connected');
    });

    this.enhancedClient.on('disconnect', (error) => {
      this.emit('disconnect', 'enhanced', error);
      logger.warn('Enhanced Consul client disconnected', { error });
    });

    this.modernClient.on('error', (error) => {
      this.emit('error', 'modern', error);
      logger.error('Modern Consul client error', { error });
    });

    this.enhancedClient.on('error', (error) => {
      this.emit('error', 'enhanced', error);
      logger.error('Enhanced Consul client error', { error });
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.modernClient.testConnection();
      this.isInitialized = true;
      logger.info('Consul Service Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Consul Service Manager', { error });
      throw error;
    }
  }

  async registerService(service: ServiceDefinition): Promise<void> {
    const attempts = this.config.retryAttempts || 3;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        // Try modern client first
        await this.modernClient.registerService(service);
        logger.info('Service registered successfully with modern client', { 
          serviceId: service.id,
          serviceName: service.name 
        });
        return;
      } catch (modernError) {
        logger.warn(`Modern client registration failed (attempt ${attempt}/${attempts})`, { 
          error: modernError,
          serviceId: service.id 
        });

        // Try enhanced client as fallback
        try {
          const enhancedService = {
            ID: service.id,
            Name: service.name,
            Address: service.address,
            Port: service.port,
            Tags: service.tags || [],
            Meta: service.meta || {}
          };

          if (service.check) {
            (enhancedService as any).Check = {
              HTTP: service.check.http,
              TCP: service.check.tcp,
              Interval: service.check.interval || '10s',
              Timeout: service.check.timeout || '3s',
              DeregisterCriticalServiceAfter: service.check.deregisterCriticalServiceAfter
            };
          }

          await this.enhancedClient.registerService(enhancedService);
          logger.info('Service registered successfully with enhanced client', { 
            serviceId: service.id,
            serviceName: service.name 
          });
          return;
        } catch (enhancedError) {
          logger.warn(`Enhanced client registration failed (attempt ${attempt}/${attempts})`, { 
            error: enhancedError,
            serviceId: service.id 
          });

          // Try legacy client as last resort
          if (this.legacyClient && this.config.enableFallback) {
            try {
              await new Promise((resolve, reject) => {
                this.legacyClient.agent.service.register(service, (err: any) => {
                  if (err) reject(err);
                  else resolve(undefined);
                });
              });
              logger.info('Service registered successfully with legacy client', { 
                serviceId: service.id,
                serviceName: service.name 
              });
              return;
            } catch (legacyError) {
              logger.warn(`Legacy client registration failed (attempt ${attempt}/${attempts})`, { 
                error: legacyError,
                serviceId: service.id 
              });
            }
          }
        }

        if (attempt < attempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    throw new Error(`Failed to register service ${service.id} after ${attempts} attempts`);
  }

  async deregisterService(serviceId: string): Promise<void> {
    const errors: Error[] = [];

    // Try all available clients
    try {
      await this.modernClient.deregisterService(serviceId);
      logger.info('Service deregistered successfully with modern client', { serviceId });
      return;
    } catch (error) {
      errors.push(error as Error);
    }

    try {
      await this.enhancedClient.deregisterService(serviceId);
      logger.info('Service deregistered successfully with enhanced client', { serviceId });
      return;
    } catch (error) {
      errors.push(error as Error);
    }

    if (this.legacyClient && this.config.enableFallback) {
      try {
        await new Promise((resolve, reject) => {
          this.legacyClient.agent.service.deregister(serviceId, (err: any) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
        logger.info('Service deregistered successfully with legacy client', { serviceId });
        return;
      } catch (error) {
        errors.push(error as Error);
      }
    }

    throw new Error(`Failed to deregister service ${serviceId}. Errors: ${errors.map(e => e.message).join(', ')}`);
  }

  async getServices(): Promise<any> {
    try {
      return await this.modernClient.getAllServices();
    } catch (modernError) {
      logger.warn('Modern client getAllServices failed, trying enhanced client', { error: modernError });

      try {
        return await this.enhancedClient.getServices();
      } catch (enhancedError) {
        logger.warn('Enhanced client getServices failed', { error: enhancedError });

        if (this.legacyClient && this.config.enableFallback) {
          return new Promise((resolve, reject) => {
            this.legacyClient.agent.service.list((err: any, result: any) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        }

        throw enhancedError;
      }
    }
  }

  async getHealthChecks(serviceName?: string): Promise<any> {
    try {
      if (serviceName) {
        return await this.modernClient.getHealthyServices(serviceName);
      } else {
        return await this.modernClient.getAgentInfo();
      }
    } catch (modernError) {
      logger.warn('Modern client health check failed, trying enhanced client', { error: modernError });

      try {
        return await this.enhancedClient.getHealthChecks(serviceName);
      } catch (enhancedError) {
        logger.warn('Enhanced client getHealthChecks failed', { error: enhancedError });

        if (this.legacyClient && this.config.enableFallback) {
          return new Promise((resolve, reject) => {
            this.legacyClient.health.checks(serviceName, (err: any, result: any) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        }

        throw enhancedError;
      }
    }
  }

  isHealthy(): boolean {
    return this.modernClient.isConnectedToConsul() || this.enhancedClient.isHealthy();
  }

  async destroy(): Promise<void> {
    try {
      this.modernClient.destroy();
    } catch (error) {
      logger.warn('Error destroying modern client', { error });
    }

    try {
      this.enhancedClient.destroy();
    } catch (error) {
      logger.warn('Error destroying enhanced client', { error });
    }

    this.removeAllListeners();
    logger.info('Consul Service Manager destroyed');
  }
}

// Factory function
export function createConsulServiceManager(config: ConsulServiceManagerConfig): ConsulServiceManager {
  return new ConsulServiceManager(config);
}
