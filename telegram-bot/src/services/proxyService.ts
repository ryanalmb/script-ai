import { logger } from '../utils/logger';

export interface ProxyConfig {
  id: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  country?: string;
  provider?: string;
  isActive: boolean;
  lastUsed?: Date;
  failureCount: number;
  maxFailures: number;
}

export interface ProxyStats {
  proxyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastResponseTime: number;
  uptime: number;
  lastChecked: Date;
}

export interface ProxyRotationConfig {
  enabled: boolean;
  strategy: 'round-robin' | 'random' | 'least-used' | 'fastest';
  rotationInterval: number; // minutes
  maxRequestsPerProxy: number;
  healthCheckInterval: number; // minutes
}

export class ProxyService {
  private proxies: Map<string, ProxyConfig> = new Map();
  private stats: Map<string, ProxyStats> = new Map();
  private currentProxyIndex = 0;
  private rotationConfig: ProxyRotationConfig = {
    enabled: true,
    strategy: 'round-robin',
    rotationInterval: 30,
    maxRequestsPerProxy: 100,
    healthCheckInterval: 15
  };
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultProxies();
    this.startHealthChecks();
  }

  async addProxy(config: Omit<ProxyConfig, 'id' | 'isActive' | 'failureCount'>): Promise<string> {
    try {
      const proxyId = `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const proxyConfig: ProxyConfig = {
        ...config,
        id: proxyId,
        isActive: true,
        failureCount: 0,
        maxFailures: 5
      };

      this.proxies.set(proxyId, proxyConfig);
      
      // Initialize stats
      this.stats.set(proxyId, {
        proxyId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastResponseTime: 0,
        uptime: 1.0,
        lastChecked: new Date()
      });

      // Test proxy connectivity
      const isHealthy = await this.testProxyHealth(proxyId);
      if (!isHealthy) {
        proxyConfig.isActive = false;
        logger.warn(`Proxy ${proxyId} failed initial health check`);
      }

      logger.info(`Proxy added: ${proxyId}`, { 
        host: config.host, 
        port: config.port, 
        type: config.type,
        healthy: isHealthy 
      });

      return proxyId;
    } catch (error) {
      logger.error('Error adding proxy:', error);
      throw new Error('Failed to add proxy');
    }
  }

  async removeProxy(proxyId: string): Promise<boolean> {
    try {
      const removed = this.proxies.delete(proxyId);
      this.stats.delete(proxyId);
      
      if (removed) {
        logger.info(`Proxy removed: ${proxyId}`);
      }
      
      return removed;
    } catch (error) {
      logger.error('Error removing proxy:', error);
      return false;
    }
  }

  async getNextProxy(): Promise<ProxyConfig | null> {
    try {
      if (!this.rotationConfig.enabled) {
        return null;
      }

      const activeProxies = Array.from(this.proxies.values()).filter(p => p.isActive);
      
      if (activeProxies.length === 0) {
        logger.warn('No active proxies available');
        return null;
      }

      let selectedProxy: ProxyConfig;

      switch (this.rotationConfig.strategy) {
        case 'round-robin':
          selectedProxy = this.getRoundRobinProxy(activeProxies);
          break;
        case 'random':
          selectedProxy = this.getRandomProxy(activeProxies);
          break;
        case 'least-used':
          selectedProxy = this.getLeastUsedProxy(activeProxies);
          break;
        case 'fastest':
          selectedProxy = this.getFastestProxy(activeProxies);
          break;
        default:
          selectedProxy = activeProxies[0] || this.createDefaultProxy();
      }

      // Update usage
      selectedProxy.lastUsed = new Date();
      this.proxies.set(selectedProxy.id, selectedProxy);

      return selectedProxy;
    } catch (error) {
      logger.error('Error getting next proxy:', error);
      return null;
    }
  }

  async testProxyHealth(proxyId: string): Promise<boolean> {
    try {
      const proxy = this.proxies.get(proxyId);
      if (!proxy) {
        return false;
      }

      const startTime = Date.now();
      
      // Simulate proxy health check
      // In real implementation, this would make an actual HTTP request through the proxy
      const isHealthy = Math.random() > 0.1; // 90% success rate for simulation
      
      const responseTime = Date.now() - startTime;
      
      // Update stats
      const stats = this.stats.get(proxyId);
      if (stats) {
        stats.totalRequests++;
        stats.lastResponseTime = responseTime;
        stats.lastChecked = new Date();
        
        if (isHealthy) {
          stats.successfulRequests++;
          proxy.failureCount = 0;
        } else {
          stats.failedRequests++;
          proxy.failureCount++;
        }
        
        stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
        stats.uptime = stats.successfulRequests / stats.totalRequests;
        
        this.stats.set(proxyId, stats);
      }

      // Disable proxy if too many failures
      if (proxy.failureCount >= proxy.maxFailures) {
        proxy.isActive = false;
        logger.warn(`Proxy ${proxyId} disabled due to excessive failures`);
      }

      this.proxies.set(proxyId, proxy);
      
      return isHealthy;
    } catch (error) {
      logger.error(`Error testing proxy health for ${proxyId}:`, error);
      return false;
    }
  }

  getProxyStats(proxyId?: string): ProxyStats[] {
    if (proxyId) {
      const stats = this.stats.get(proxyId);
      return stats ? [stats] : [];
    }
    
    return Array.from(this.stats.values());
  }

  getActiveProxies(): ProxyConfig[] {
    return Array.from(this.proxies.values()).filter(p => p.isActive);
  }

  getAllProxies(): ProxyConfig[] {
    return Array.from(this.proxies.values());
  }

  updateRotationConfig(config: Partial<ProxyRotationConfig>): void {
    this.rotationConfig = { ...this.rotationConfig, ...config };
    
    // Restart health checks if interval changed
    if (config.healthCheckInterval) {
      this.stopHealthChecks();
      this.startHealthChecks();
    }
    
    logger.info('Proxy rotation config updated', this.rotationConfig);
  }

  getRotationConfig(): ProxyRotationConfig {
    return { ...this.rotationConfig };
  }

  async enableProxy(proxyId: string): Promise<boolean> {
    try {
      const proxy = this.proxies.get(proxyId);
      if (!proxy) {
        return false;
      }

      // Test health before enabling
      const isHealthy = await this.testProxyHealth(proxyId);
      if (isHealthy) {
        proxy.isActive = true;
        proxy.failureCount = 0;
        this.proxies.set(proxyId, proxy);
        logger.info(`Proxy enabled: ${proxyId}`);
        return true;
      } else {
        logger.warn(`Cannot enable proxy ${proxyId} - health check failed`);
        return false;
      }
    } catch (error) {
      logger.error(`Error enabling proxy ${proxyId}:`, error);
      return false;
    }
  }

  async disableProxy(proxyId: string): Promise<boolean> {
    try {
      const proxy = this.proxies.get(proxyId);
      if (!proxy) {
        return false;
      }

      proxy.isActive = false;
      this.proxies.set(proxyId, proxy);
      logger.info(`Proxy disabled: ${proxyId}`);
      return true;
    } catch (error) {
      logger.error(`Error disabling proxy ${proxyId}:`, error);
      return false;
    }
  }

  private getRoundRobinProxy(proxies: ProxyConfig[]): ProxyConfig {
    const proxy = proxies[this.currentProxyIndex % proxies.length];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % proxies.length;
    return proxy || this.createDefaultProxy();
  }

  private getRandomProxy(proxies: ProxyConfig[]): ProxyConfig {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex] || this.createDefaultProxy();
  }

  private getLeastUsedProxy(proxies: ProxyConfig[]): ProxyConfig {
    return proxies.reduce((least, current) => {
      const leastStats = this.stats.get(least.id);
      const currentStats = this.stats.get(current.id);
      
      if (!leastStats) return current;
      if (!currentStats) return least;
      
      return currentStats.totalRequests < leastStats.totalRequests ? current : least;
    });
  }

  private getFastestProxy(proxies: ProxyConfig[]): ProxyConfig {
    return proxies.reduce((fastest, current) => {
      const fastestStats = this.stats.get(fastest.id);
      const currentStats = this.stats.get(current.id);
      
      if (!fastestStats) return current;
      if (!currentStats) return fastest;
      
      return currentStats.averageResponseTime < fastestStats.averageResponseTime ? current : fastest;
    });
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const proxies = Array.from(this.proxies.keys());
      
      for (const proxyId of proxies) {
        try {
          await this.testProxyHealth(proxyId);
        } catch (error) {
          logger.error(`Health check failed for proxy ${proxyId}:`, error);
        }
      }
    }, this.rotationConfig.healthCheckInterval * 60000);

    logger.info('Proxy health checks started', { 
      interval: this.rotationConfig.healthCheckInterval 
    });
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined as any;
      logger.info('Proxy health checks stopped');
    }
  }

  private initializeDefaultProxies(): void {
    // Initialize with some example proxy configurations
    // In real implementation, these would be loaded from configuration or database
    const defaultProxies = [
      {
        host: '127.0.0.1',
        port: 8080,
        type: 'http' as const,
        country: 'US',
        provider: 'local'
      }
    ];

    defaultProxies.forEach(async (proxyConfig) => {
      try {
        await this.addProxy({
          ...proxyConfig,
          maxFailures: 5
        });
      } catch (error) {
        logger.error('Error adding default proxy:', error);
      }
    });
  }

  async stop(): Promise<void> {
    this.stopHealthChecks();
    logger.info('Proxy service stopped');
  }

  private createDefaultProxy(): ProxyConfig {
    return {
      id: 'default',
      host: 'localhost',
      port: 8080,
      type: 'http',
      country: 'US',
      provider: 'default',
      isActive: true,
      failureCount: 0,
      maxFailures: 5
    };
  }
}
