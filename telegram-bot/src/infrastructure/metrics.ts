/**
 * Enterprise Metrics and Monitoring System
 * Provides comprehensive metrics collection for Prometheus
 */

import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';
import express from 'express';
import { Server } from 'http';

// Metric instances
export class EnterpriseMetrics {
  private metricsServer?: Server;
  private isInitialized: boolean = false;

  // HTTP Metrics
  public readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'service']
  });

  public readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code', 'service'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  });

  // Telegram Bot Metrics
  public readonly telegramMessagesTotal = new Counter({
    name: 'telegram_messages_total',
    help: 'Total number of Telegram messages processed',
    labelNames: ['type', 'status', 'user_id']
  });

  public readonly telegramMessagesProcessed = new Counter({
    name: 'telegram_messages_processed_total',
    help: 'Total number of Telegram messages successfully processed',
    labelNames: ['command', 'user_id']
  });

  public readonly telegramMessageProcessingDuration = new Histogram({
    name: 'telegram_message_processing_duration_seconds',
    help: 'Time spent processing Telegram messages',
    labelNames: ['type', 'command'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  });

  public readonly telegramActiveUsers = new Gauge({
    name: 'telegram_active_users',
    help: 'Number of active Telegram users',
    labelNames: ['period']
  });

  public readonly telegramMessageQueueSize = new Gauge({
    name: 'telegram_message_queue_size',
    help: 'Current size of the message queue'
  });

  public readonly telegramWebhookTotal = new Counter({
    name: 'telegram_webhook_total',
    help: 'Total number of webhook requests',
    labelNames: ['status']
  });

  public readonly telegramWebhookSuccess = new Counter({
    name: 'telegram_webhook_success_total',
    help: 'Total number of successful webhook requests'
  });

  public readonly telegramWebhookFailures = new Counter({
    name: 'telegram_webhook_failures_total',
    help: 'Total number of failed webhook requests',
    labelNames: ['error_type']
  });

  // LLM Service Metrics
  public readonly llmRequestsTotal = new Counter({
    name: 'llm_requests_total',
    help: 'Total number of LLM requests',
    labelNames: ['model', 'type', 'status']
  });

  public readonly llmRequestDuration = new Histogram({
    name: 'llm_request_duration_seconds',
    help: 'LLM request duration in seconds',
    labelNames: ['model', 'type'],
    buckets: [1, 5, 10, 15, 30, 60, 120]
  });

  public readonly llmTokensUsed = new Counter({
    name: 'llm_tokens_used_total',
    help: 'Total number of LLM tokens used',
    labelNames: ['model', 'type']
  });

  public readonly llmTokenUsageDaily = new Gauge({
    name: 'llm_token_usage_daily',
    help: 'Daily LLM token usage'
  });

  public readonly llmRateLimitExceeded = new Counter({
    name: 'llm_rate_limit_exceeded_total',
    help: 'Total number of rate limit exceeded events',
    labelNames: ['model']
  });

  // Backend Service Metrics
  public readonly backendRequestsTotal = new Counter({
    name: 'backend_requests_total',
    help: 'Total number of backend requests',
    labelNames: ['endpoint', 'method', 'status']
  });

  public readonly backendDatabaseConnections = new Gauge({
    name: 'backend_database_connections_active',
    help: 'Number of active database connections'
  });

  public readonly backendDatabaseConnectionsFailed = new Counter({
    name: 'backend_database_connections_failed_total',
    help: 'Total number of failed database connections'
  });

  public readonly backendCacheHitRatio = new Gauge({
    name: 'backend_cache_hit_ratio',
    help: 'Cache hit ratio'
  });

  public readonly backendCacheOperations = new Counter({
    name: 'backend_cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['operation', 'status']
  });

  // Circuit Breaker Metrics
  public readonly circuitBreakerState = new Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['name']
  });

  public readonly circuitBreakerFailures = new Counter({
    name: 'circuit_breaker_failures_total',
    help: 'Total number of circuit breaker failures',
    labelNames: ['name']
  });

  public readonly circuitBreakerSuccesses = new Counter({
    name: 'circuit_breaker_successes_total',
    help: 'Total number of circuit breaker successes',
    labelNames: ['name']
  });

  // Event Bus Metrics
  public readonly eventBusMessagesPublished = new Counter({
    name: 'event_bus_messages_published_total',
    help: 'Total number of messages published to event bus',
    labelNames: ['topic', 'event_type']
  });

  public readonly eventBusMessagesConsumed = new Counter({
    name: 'event_bus_messages_consumed_total',
    help: 'Total number of messages consumed from event bus',
    labelNames: ['topic', 'consumer_group']
  });

  public readonly eventBusMessageProcessingDuration = new Histogram({
    name: 'event_bus_message_processing_duration_seconds',
    help: 'Time spent processing event bus messages',
    labelNames: ['topic', 'event_type'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  public readonly eventBusConnectionStatus = new Gauge({
    name: 'event_bus_connection_status',
    help: 'Event bus connection status (1=connected, 0=disconnected)'
  });

  // Service Discovery Metrics
  public readonly serviceDiscoveryServices = new Gauge({
    name: 'service_discovery_services_total',
    help: 'Total number of discovered services',
    labelNames: ['service_name', 'health']
  });

  public readonly serviceDiscoveryConnectionStatus = new Gauge({
    name: 'service_discovery_connection_status',
    help: 'Service discovery connection status (1=connected, 0=disconnected)'
  });

  // Business Metrics
  public readonly userInteractions = new Counter({
    name: 'user_interactions_total',
    help: 'Total number of user interactions',
    labelNames: ['type', 'user_id']
  });

  public readonly contentGenerationRequests = new Counter({
    name: 'content_generation_requests_total',
    help: 'Total number of content generation requests',
    labelNames: ['type', 'status']
  });

  public readonly contentGenerationFailures = new Counter({
    name: 'content_generation_failures_total',
    help: 'Total number of content generation failures',
    labelNames: ['type', 'error']
  });

  public readonly campaignExecutionRequests = new Counter({
    name: 'campaign_execution_requests_total',
    help: 'Total number of campaign execution requests',
    labelNames: ['type', 'status']
  });

  public readonly campaignExecutionFailures = new Counter({
    name: 'campaign_execution_failures_total',
    help: 'Total number of campaign execution failures',
    labelNames: ['type', 'error']
  });

  // Authentication Metrics
  public readonly authAttempts = new Counter({
    name: 'auth_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['type', 'status']
  });

  public readonly authFailures = new Counter({
    name: 'auth_failures_total',
    help: 'Total number of authentication failures',
    labelNames: ['type', 'reason']
  });

  constructor() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({
      register,
      prefix: 'telegram_bot_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });
  }

  /**
   * Initialize metrics server
   */
  async initialize(port: number = 9091): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Metrics already initialized');
      return;
    }

    try {
      const app = express();
      
      // Health check endpoint
      app.get('/health', (req, res) => {
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
      });

      // Metrics endpoint
      app.get('/metrics', async (req, res) => {
        try {
          res.set('Content-Type', register.contentType);
          const metrics = await register.metrics();
          res.end(metrics);
        } catch (error) {
          logger.error('Error generating metrics:', error);
          res.status(500).end('Error generating metrics');
        }
      });

      // Memory metrics endpoint
      app.get('/metrics/memory', (req, res) => {
        const memUsage = process.memoryUsage();
        res.json({
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        });
      });

      this.metricsServer = app.listen(port, () => {
        logger.info(`Metrics server started on port ${port}`);
        this.isInitialized = true;
      });

    } catch (error) {
      logger.error('Failed to initialize metrics server:', error);
      throw error;
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    service: string = 'telegram-bot'
  ): void {
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
      service
    });

    this.httpRequestDuration.observe({
      method,
      route,
      status_code: statusCode.toString(),
      service
    }, duration);
  }

  /**
   * Record Telegram message metrics
   */
  recordTelegramMessage(
    type: string,
    status: 'success' | 'error',
    userId?: string,
    command?: string,
    duration?: number
  ): void {
    this.telegramMessagesTotal.inc({
      type,
      status,
      user_id: userId || 'unknown'
    });

    if (status === 'success' && command) {
      this.telegramMessagesProcessed.inc({
        command,
        user_id: userId || 'unknown'
      });
    }

    if (duration !== undefined) {
      this.telegramMessageProcessingDuration.observe({
        type,
        command: command || 'unknown'
      }, duration);
    }
  }

  /**
   * Record LLM request metrics
   */
  recordLLMRequest(
    model: string,
    type: string,
    status: 'success' | 'error',
    duration: number,
    tokensUsed?: number
  ): void {
    this.llmRequestsTotal.inc({
      model,
      type,
      status
    });

    this.llmRequestDuration.observe({
      model,
      type
    }, duration);

    if (tokensUsed) {
      this.llmTokensUsed.inc({
        model,
        type
      }, tokensUsed);
    }
  }

  /**
   * Update circuit breaker metrics
   */
  updateCircuitBreakerMetrics(name: string, state: number, failures: number, successes: number): void {
    this.circuitBreakerState.set({ name }, state);
    this.circuitBreakerFailures.inc({ name }, failures);
    this.circuitBreakerSuccesses.inc({ name }, successes);
  }

  /**
   * Record event bus metrics
   */
  recordEventBusMessage(
    action: 'published' | 'consumed',
    topic: string,
    eventType?: string,
    consumerGroup?: string,
    duration?: number
  ): void {
    if (action === 'published') {
      this.eventBusMessagesPublished.inc({
        topic,
        event_type: eventType || 'unknown'
      });
    } else {
      this.eventBusMessagesConsumed.inc({
        topic,
        consumer_group: consumerGroup || 'unknown'
      });
    }

    if (duration !== undefined) {
      this.eventBusMessageProcessingDuration.observe({
        topic,
        event_type: eventType || 'unknown'
      }, duration);
    }
  }

  /**
   * Get current metrics as JSON
   */
  async getMetricsAsJson(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    register.clear();
    logger.info('All metrics reset');
  }

  /**
   * Shutdown metrics server
   */
  async shutdown(): Promise<void> {
    if (this.metricsServer) {
      return new Promise((resolve, reject) => {
        this.metricsServer!.close((error) => {
          if (error) {
            logger.error('Error shutting down metrics server:', error);
            reject(error);
          } else {
            logger.info('Metrics server shutdown completed');
            this.isInitialized = false;
            resolve();
          }
        });
      });
    }
  }
}

// Singleton instance
export const metrics = new EnterpriseMetrics();
