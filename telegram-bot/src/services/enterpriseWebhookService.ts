/**
 * Enterprise Webhook Service
 * Comprehensive webhook management with SSL, domain validation, failover, and monitoring
 */

import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { eventBus } from '../infrastructure/eventBus';
import { metrics } from '../infrastructure/metrics';
import { tracing } from '../infrastructure/tracing';
import { circuitBreakerManager } from '../infrastructure/circuitBreaker';
import axios from 'axios';
import crypto from 'crypto';
import { URL } from 'url';

export interface WebhookConfig {
  url: string;
  secretToken?: string;
  maxConnections?: number;
  allowedUpdates?: string[];
  dropPendingUpdates?: boolean;
  ipAddress?: string;
  certificate?: Buffer;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  priority: number;
  isActive: boolean;
  lastCheck: Date;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorCount: number;
  successCount: number;
  metadata: {
    provider: string;
    region?: string;
    sslValid: boolean;
    certificateExpiry?: Date;
  };
}

export interface WebhookMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date;
  uptime: number;
  errorRate: number;
}

export class EnterpriseWebhookService {
  private bot: TelegramBot;
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private activeEndpoint: WebhookEndpoint | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private failoverEnabled: boolean = true;
  private secretToken: string;
  private metrics: WebhookMetrics;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.secretToken = this.generateSecretToken();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: new Date(),
      uptime: 0,
      errorRate: 0
    };
  }

  /**
   * Initialize the webhook service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Enterprise Webhook Service...');

      // Load webhook endpoints from configuration
      await this.loadWebhookEndpoints();

      // Start monitoring
      this.startMonitoring();

      // Setup the primary webhook
      await this.setupPrimaryWebhook();

      logger.info('Enterprise Webhook Service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Enterprise Webhook Service:', error);
      throw error;
    }
  }

  /**
   * Add a webhook endpoint
   */
  async addEndpoint(config: {
    name: string;
    url: string;
    priority: number;
    provider: string;
    region?: string;
  }): Promise<void> {
    try {
      // Validate the webhook URL
      await this.validateWebhookUrl(config.url);

      const endpoint: WebhookEndpoint = {
        id: crypto.randomUUID(),
        name: config.name,
        url: config.url,
        priority: config.priority,
        isActive: false,
        lastCheck: new Date(),
        status: 'healthy',
        responseTime: 0,
        errorCount: 0,
        successCount: 0,
        metadata: {
          provider: config.provider,
          ...(config.region ? { region: config.region } : {}),
          sslValid: false
        }
      };

      // Check SSL certificate
      await this.checkSSLCertificate(endpoint);

      this.endpoints.set(endpoint.id, endpoint);

      logger.info('Webhook endpoint added', {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        priority: endpoint.priority
      });

      // Publish event
      await eventBus.publishSystemEvent('system.health', 'webhook-service', {
        action: 'endpoint_added',
        endpoint: endpoint.name,
        url: endpoint.url
      });

    } catch (error) {
      logger.error('Failed to add webhook endpoint:', error);
      throw error;
    }
  }

  /**
   * Setup primary webhook with failover
   */
  async setupPrimaryWebhook(): Promise<void> {
    try {
      // Get the highest priority healthy endpoint
      const primaryEndpoint = this.getPrimaryEndpoint();
      
      if (!primaryEndpoint) {
        throw new Error('No healthy webhook endpoints available');
      }

      await this.activateEndpoint(primaryEndpoint);

    } catch (error) {
      logger.error('Failed to setup primary webhook:', error);
      
      // Try failover if enabled
      if (this.failoverEnabled) {
        await this.performFailover();
      } else {
        throw error;
      }
    }
  }

  /**
   * Activate a webhook endpoint
   */
  async activateEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    try {
      logger.info('Activating webhook endpoint', {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url
      });

      // Deactivate current endpoint
      if (this.activeEndpoint) {
        this.activeEndpoint.isActive = false;
      }

      // Set webhook with Telegram
      const webhookConfig: WebhookConfig = {
        url: endpoint.url,
        secretToken: this.secretToken,
        maxConnections: 100,
        allowedUpdates: ['message', 'callback_query', 'inline_query', 'chosen_inline_result'],
        dropPendingUpdates: false
      };

      await this.setTelegramWebhook(webhookConfig);

      // Activate endpoint
      endpoint.isActive = true;
      endpoint.status = 'healthy';
      this.activeEndpoint = endpoint;

      // Record metrics
      metrics.recordHttpRequest('POST', '/webhook/activate', 200, 0, 'webhook-service');

      // Publish event
      await eventBus.publishSystemEvent('system.health', 'webhook-service', {
        action: 'endpoint_activated',
        endpoint: endpoint.name,
        url: endpoint.url
      });

      logger.info('Webhook endpoint activated successfully', {
        id: endpoint.id,
        name: endpoint.name
      });

    } catch (error) {
      endpoint.status = 'down';
      endpoint.errorCount++;
      
      logger.error('Failed to activate webhook endpoint:', error, {
        id: endpoint.id,
        name: endpoint.name
      });

      // Publish error event
      await eventBus.publishSystemEvent('system.error', 'webhook-service', {
        action: 'endpoint_activation_failed',
        endpoint: endpoint.name,
        error: (error as Error).message
      }, 'high');

      throw error;
    }
  }

  /**
   * Perform failover to backup endpoint
   */
  async performFailover(): Promise<void> {
    try {
      logger.warn('Performing webhook failover...');

      // Get next available endpoint
      const backupEndpoint = this.getBackupEndpoint();
      
      if (!backupEndpoint) {
        throw new Error('No backup webhook endpoints available');
      }

      await this.activateEndpoint(backupEndpoint);

      logger.info('Webhook failover completed successfully', {
        newEndpoint: backupEndpoint.name
      });

    } catch (error) {
      logger.error('Webhook failover failed:', error);
      
      // Publish critical error
      await eventBus.publishSystemEvent('system.error', 'webhook-service', {
        action: 'failover_failed',
        error: (error as Error).message
      }, 'critical');

      throw error;
    }
  }

  /**
   * Process incoming webhook request
   */
  async processWebhookRequest(
    body: any,
    headers: Record<string, string>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate request
      this.validateWebhookRequest(body, headers);

      // Process with tracing
      await tracing.traceTelegramMessage(
        'webhook_request',
        body.message?.from?.id?.toString() || 'unknown',
        async (span) => {
          span.setAttributes({
            'webhook.endpoint': this.activeEndpoint?.name || 'unknown',
            'webhook.update_id': body.update_id,
            'webhook.message_type': this.getMessageType(body)
          });

          // Process the update
          await this.bot.processUpdate(body);

          // Update metrics
          this.updateMetrics(true, Date.now() - startTime);

          // Record success
          if (this.activeEndpoint) {
            this.activeEndpoint.successCount++;
            this.activeEndpoint.responseTime = Date.now() - startTime;
          }
        }
      );

      // Publish success event
      await eventBus.publishTelegramEvent(
        'telegram.webhook',
        body.message?.from?.id || 0,
        {
          update_id: body.update_id,
          endpoint: this.activeEndpoint?.name,
          response_time: Date.now() - startTime
        }
      );

    } catch (error) {
      // Update metrics
      this.updateMetrics(false, Date.now() - startTime);

      // Record error
      if (this.activeEndpoint) {
        this.activeEndpoint.errorCount++;
      }

      logger.error('Webhook request processing failed:', error);

      // Publish error event
      await eventBus.publishSystemEvent('system.error', 'webhook-service', {
        action: 'request_processing_failed',
        error: (error as Error).message,
        endpoint: this.activeEndpoint?.name
      }, 'medium');

      throw error;
    }
  }

  /**
   * Get webhook status and metrics
   */
  getStatus(): {
    activeEndpoint: WebhookEndpoint | null;
    endpoints: WebhookEndpoint[];
    metrics: WebhookMetrics;
    health: 'healthy' | 'degraded' | 'down';
  } {
    const health = this.activeEndpoint?.status || 'down';
    
    return {
      activeEndpoint: this.activeEndpoint,
      endpoints: Array.from(this.endpoints.values()),
      metrics: this.metrics,
      health
    };
  }

  /**
   * Shutdown the webhook service
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Enterprise Webhook Service...');

      // Stop monitoring
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }

      // Delete webhook
      await this.bot.deleteWebHook();

      logger.info('Enterprise Webhook Service shutdown completed');

    } catch (error) {
      logger.error('Error during webhook service shutdown:', error);
      throw error;
    }
  }

  /**
   * Validate webhook URL
   */
  private async validateWebhookUrl(url: string): Promise<void> {
    try {
      const parsedUrl = new URL(url);

      // Check protocol
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS');
      }

      // Check if URL is reachable
      const response = await axios.head(url, { timeout: 10000 });
      
      if (response.status !== 200 && response.status !== 404) {
        throw new Error(`Webhook URL returned status: ${response.status}`);
      }

    } catch (error) {
      throw new Error(`Invalid webhook URL: ${(error as Error).message}`);
    }
  }

  /**
   * Check SSL certificate
   */
  private async checkSSLCertificate(endpoint: WebhookEndpoint): Promise<void> {
    try {
      const url = new URL(endpoint.url);
      const response = await axios.get(`https://ssl-checker.io/api/v1/check/${url.hostname}`);
      
      if (response.data.valid) {
        endpoint.metadata.sslValid = true;
        endpoint.metadata.certificateExpiry = new Date(response.data.expires);
      } else {
        endpoint.metadata.sslValid = false;
        logger.warn('SSL certificate invalid for endpoint', {
          endpoint: endpoint.name,
          url: endpoint.url
        });
      }

    } catch (error) {
      endpoint.metadata.sslValid = false;
      logger.warn('Failed to check SSL certificate:', error, {
        endpoint: endpoint.name
      });
    }
  }

  /**
   * Set Telegram webhook
   */
  private async setTelegramWebhook(config: WebhookConfig): Promise<void> {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker('telegram-webhook', {
      failureThreshold: 3,
      resetTimeout: 60000,
      timeout: 30000
    });

    await circuitBreaker.execute(async () => {
      await this.bot.setWebHook(config.url, {
        allowed_updates: config.allowedUpdates,
        max_connections: config.maxConnections,
        secret_token: config.secretToken
      });

      // Handle drop pending updates separately if needed
      if (config.dropPendingUpdates) {
        await this.bot.deleteWebHook();
        await this.bot.setWebHook(config.url, {
          allowed_updates: config.allowedUpdates,
          max_connections: config.maxConnections,
          secret_token: config.secretToken
        });
      }
    });
  }

  /**
   * Validate webhook request
   */
  private validateWebhookRequest(body: any, headers: Record<string, string>): void {
    // Validate secret token if configured
    if (this.secretToken && headers['x-telegram-bot-api-secret-token'] !== this.secretToken) {
      throw new Error('Invalid secret token');
    }

    // Validate request body
    if (!body || typeof body !== 'object') {
      throw new Error('Invalid request body');
    }

    // Validate update_id
    if (typeof body.update_id !== 'number') {
      throw new Error('Missing or invalid update_id');
    }
  }

  /**
   * Get message type from update
   */
  private getMessageType(update: any): string {
    if (update.message) return 'message';
    if (update.callback_query) return 'callback_query';
    if (update.inline_query) return 'inline_query';
    if (update.chosen_inline_result) return 'chosen_inline_result';
    return 'unknown';
  }

  /**
   * Update metrics
   */
  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date();

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;

    // Update error rate
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests;
  }

  /**
   * Generate secret token
   */
  private generateSecretToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Load webhook endpoints from configuration
   */
  private async loadWebhookEndpoints(): Promise<void> {
    // Load from environment variables
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    const cloudflareUrl = process.env.CLOUDFLARE_WEBHOOK_URL;
    const backupUrl = process.env.BACKUP_WEBHOOK_URL;

    if (webhookUrl) {
      await this.addEndpoint({
        name: 'primary',
        url: webhookUrl,
        priority: 1,
        provider: 'primary'
      });
    }

    if (cloudflareUrl) {
      await this.addEndpoint({
        name: 'cloudflare',
        url: cloudflareUrl,
        priority: 2,
        provider: 'cloudflare'
      });
    }

    if (backupUrl) {
      await this.addEndpoint({
        name: 'backup',
        url: backupUrl,
        priority: 3,
        provider: 'backup'
      });
    }
  }

  /**
   * Get primary endpoint
   */
  private getPrimaryEndpoint(): WebhookEndpoint | null {
    const healthyEndpoints = Array.from(this.endpoints.values())
      .filter(ep => ep.status === 'healthy')
      .sort((a, b) => a.priority - b.priority);

    return healthyEndpoints[0] || null;
  }

  /**
   * Get backup endpoint
   */
  private getBackupEndpoint(): WebhookEndpoint | null {
    const healthyEndpoints = Array.from(this.endpoints.values())
      .filter(ep => ep.status === 'healthy' && ep.id !== this.activeEndpoint?.id)
      .sort((a, b) => a.priority - b.priority);

    return healthyEndpoints[0] || null;
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorEndpoints();
      } catch (error) {
        logger.error('Error during endpoint monitoring:', error);
      }
    }, 60000); // Monitor every minute
  }

  /**
   * Monitor all endpoints
   */
  private async monitorEndpoints(): Promise<void> {
    for (const endpoint of this.endpoints.values()) {
      try {
        const startTime = Date.now();
        await axios.head(endpoint.url, { timeout: 10000 });
        
        endpoint.responseTime = Date.now() - startTime;
        endpoint.status = 'healthy';
        endpoint.lastCheck = new Date();

      } catch (error) {
        endpoint.errorCount++;
        endpoint.status = 'down';
        endpoint.lastCheck = new Date();

        logger.warn('Endpoint health check failed', {
          endpoint: endpoint.name,
          error: (error as Error).message
        });

        // Trigger failover if this is the active endpoint
        if (endpoint.isActive && this.failoverEnabled) {
          await this.performFailover();
        }
      }
    }
  }
}

// Export singleton instance
export const enterpriseWebhookService = new EnterpriseWebhookService(
  new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || '', { polling: false })
);
