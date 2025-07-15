import axios from 'axios';
import { logger } from '../utils/logger';

interface WebhookEndpoint {
  name: string;
  url: string;
  priority: number;
  active: boolean;
  lastCheck: Date;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorCount: number;
}

interface WebhookConfig {
  endpoints: WebhookEndpoint[];
  checkInterval: number;
  maxRetries: number;
  timeout: number;
  fallbackToPolling: boolean;
}

export class WebhookMonitorService {
  private config: WebhookConfig;
  private currentEndpoint: WebhookEndpoint | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private bot: any; // TelegramBot instance

  constructor(bot: any, config?: Partial<WebhookConfig>) {
    this.bot = bot;
    this.config = {
      endpoints: [],
      checkInterval: 30000, // 30 seconds
      maxRetries: 3,
      timeout: 10000, // 10 seconds
      fallbackToPolling: true,
      ...config
    };
  }

  /**
   * Add webhook endpoint
   */
  addEndpoint(endpoint: Omit<WebhookEndpoint, 'lastCheck' | 'status' | 'responseTime' | 'errorCount'>): void {
    const newEndpoint: WebhookEndpoint = {
      ...endpoint,
      lastCheck: new Date(),
      status: 'healthy',
      responseTime: 0,
      errorCount: 0
    };

    this.config.endpoints.push(newEndpoint);
    this.config.endpoints.sort((a, b) => a.priority - b.priority);
    
    logger.info('Webhook endpoint added', { 
      name: endpoint.name, 
      url: endpoint.url, 
      priority: endpoint.priority 
    });
  }

  /**
   * Remove webhook endpoint
   */
  removeEndpoint(name: string): void {
    this.config.endpoints = this.config.endpoints.filter(ep => ep.name !== name);
    logger.info('Webhook endpoint removed', { name });
  }

  /**
   * Start monitoring webhooks
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    logger.info('Starting webhook monitoring', { 
      interval: this.config.checkInterval,
      endpoints: this.config.endpoints.length 
    });

    // Initial check
    this.checkAllEndpoints();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkAllEndpoints();
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Webhook monitoring stopped');
    }
  }

  /**
   * Check all webhook endpoints
   */
  private async checkAllEndpoints(): Promise<void> {
    const promises = this.config.endpoints.map(endpoint => this.checkEndpoint(endpoint));
    await Promise.allSettled(promises);

    // Find the best available endpoint
    const bestEndpoint = this.findBestEndpoint();
    
    if (bestEndpoint && bestEndpoint !== this.currentEndpoint) {
      await this.switchToEndpoint(bestEndpoint);
    } else if (!bestEndpoint && this.config.fallbackToPolling) {
      await this.fallbackToPolling();
    }
  }

  /**
   * Check individual endpoint health
   */
  private async checkEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${endpoint.url.replace('/webhook/telegram', '')}/health`, {
        timeout: this.config.timeout,
        validateStatus: (status) => status < 500
      });

      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        endpoint.status = 'healthy';
        endpoint.errorCount = 0;
        endpoint.responseTime = responseTime;
        
        logger.debug('Webhook endpoint healthy', {
          name: endpoint.name,
          responseTime: `${responseTime}ms`,
          status: response.status
        });
      } else {
        endpoint.status = 'degraded';
        endpoint.errorCount++;
        endpoint.responseTime = responseTime;
        
        logger.warn('Webhook endpoint degraded', {
          name: endpoint.name,
          status: response.status,
          responseTime: `${responseTime}ms`
        });
      }
    } catch (error: any) {
      endpoint.status = 'down';
      endpoint.errorCount++;
      endpoint.responseTime = Date.now() - startTime;
      
      logger.error('Webhook endpoint down', {
        name: endpoint.name,
        error: error.message,
        errorCount: endpoint.errorCount
      });
    }

    endpoint.lastCheck = new Date();
  }

  /**
   * Find the best available endpoint
   */
  private findBestEndpoint(): WebhookEndpoint | null {
    const healthyEndpoints = this.config.endpoints.filter(
      ep => ep.active && (ep.status === 'healthy' || ep.status === 'degraded')
    );

    if (healthyEndpoints.length === 0) {
      return null;
    }

    // Sort by priority, then by status, then by response time
    healthyEndpoints.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.status !== b.status) {
        if (a.status === 'healthy' && b.status === 'degraded') return -1;
        if (a.status === 'degraded' && b.status === 'healthy') return 1;
      }
      return a.responseTime - b.responseTime;
    });

    return healthyEndpoints[0] || null;
  }

  /**
   * Switch to a different webhook endpoint
   */
  private async switchToEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    try {
      logger.info('Switching webhook endpoint', {
        from: this.currentEndpoint?.name || 'none',
        to: endpoint.name,
        url: endpoint.url
      });

      // Set the new webhook
      await this.bot.setWebHook(endpoint.url, {
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: false
      });

      this.currentEndpoint = endpoint;
      
      logger.info('Webhook endpoint switched successfully', {
        endpoint: endpoint.name,
        url: endpoint.url
      });

    } catch (error: any) {
      logger.error('Failed to switch webhook endpoint', {
        endpoint: endpoint.name,
        error: error.message
      });
      
      // Mark endpoint as down
      endpoint.status = 'down';
      endpoint.errorCount++;
    }
  }

  /**
   * Fallback to polling mode
   */
  private async fallbackToPolling(): Promise<void> {
    try {
      logger.warn('All webhook endpoints down, falling back to polling');

      // Delete webhook to enable polling
      await this.bot.deleteWebHook();
      
      // Start polling if not already started
      if (!this.bot.isPolling()) {
        this.bot.startPolling();
        logger.info('Polling mode activated');
      }

      this.currentEndpoint = null;

    } catch (error: any) {
      logger.error('Failed to fallback to polling', { error: error.message });
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    currentEndpoint: WebhookEndpoint | null;
    endpoints: WebhookEndpoint[];
    mode: 'webhook' | 'polling';
    monitoring: boolean;
  } {
    return {
      currentEndpoint: this.currentEndpoint,
      endpoints: this.config.endpoints,
      mode: this.currentEndpoint ? 'webhook' : 'polling',
      monitoring: this.monitoringInterval !== null
    };
  }

  /**
   * Force switch to specific endpoint
   */
  async forceSwitch(endpointName: string): Promise<boolean> {
    const endpoint = this.config.endpoints.find(ep => ep.name === endpointName);

    if (!endpoint) {
      logger.error('Endpoint not found for force switch', { endpointName });
      return false;
    }

    await this.switchToEndpoint(endpoint);
    return true;
  }

  /**
   * Get health report
   */
  getHealthReport(): {
    overall: 'healthy' | 'degraded' | 'down';
    endpoints: Array<{
      name: string;
      status: string;
      responseTime: number;
      errorCount: number;
      lastCheck: string;
    }>;
    recommendations: string[];
  } {
    const healthyCount = this.config.endpoints.filter(ep => ep.status === 'healthy').length;
    const totalCount = this.config.endpoints.length;
    
    let overall: 'healthy' | 'degraded' | 'down';
    if (healthyCount === 0) {
      overall = 'down';
    } else if (healthyCount < totalCount / 2) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const recommendations: string[] = [];
    
    if (overall === 'down') {
      recommendations.push('All webhook endpoints are down. Consider adding more endpoints or checking network connectivity.');
    } else if (overall === 'degraded') {
      recommendations.push('Some webhook endpoints are experiencing issues. Monitor closely and consider adding backup endpoints.');
    }

    const downEndpoints = this.config.endpoints.filter(ep => ep.status === 'down');
    if (downEndpoints.length > 0) {
      recommendations.push(`Check these down endpoints: ${downEndpoints.map(ep => ep.name).join(', ')}`);
    }

    return {
      overall,
      endpoints: this.config.endpoints.map(ep => ({
        name: ep.name,
        status: ep.status,
        responseTime: ep.responseTime,
        errorCount: ep.errorCount,
        lastCheck: ep.lastCheck.toISOString()
      })),
      recommendations
    };
  }
}

// Default webhook endpoints configuration
export const DEFAULT_WEBHOOK_ENDPOINTS = [
  {
    name: 'cloudflare-tunnel',
    url: '', // Will be set dynamically
    priority: 1,
    active: false
  },
  {
    name: 'railway',
    url: '', // Will be set dynamically
    priority: 2,
    active: false
  },
  {
    name: 'render',
    url: '', // Will be set dynamically
    priority: 3,
    active: false
  },
  {
    name: 'vercel',
    url: '', // Will be set dynamically
    priority: 4,
    active: false
  },
  {
    name: 'ngrok',
    url: '', // Will be set dynamically
    priority: 5,
    active: false
  }
];
