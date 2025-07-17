/**
 * Enterprise Service Registry - 2025 Edition
 * Builds upon existing health check infrastructure with enterprise-grade service discovery,
 * circuit breakers, distributed tracing, and intelligent routing capabilities.
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { cacheManager } from '../lib/cache';

// OpenTelemetry imports for distributed tracing
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

interface ServiceConfig {
  name: string;
  baseUrl: string;
  healthEndpoint: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  circuitBreakerConfig: CircuitBreakerConfig;
  priority: number; // 1-10, higher = more critical
  tags: string[];
  version: string;
  capabilities: string[];
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  volumeThreshold: number;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: Date;
  consecutiveFailures: number;
  uptime: number;
  error?: string;
  metrics?: ServiceMetrics;
}

interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: Date | null;
  nextAttemptTime: Date | null;
  successCount: number;
}

export interface ServiceRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  circuitBreaker?: boolean;
  tracing?: boolean;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  responseTime: number;
  fromCache: boolean;
  serviceUsed: string;
  traceId?: string;
  spanId?: string;
}

/**
 * Enterprise Service Registry with advanced capabilities
 */
export class EnterpriseServiceRegistry extends EventEmitter {
  private services = new Map<string, ServiceConfig>();
  private healthStatus = new Map<string, ServiceHealth>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private httpClients = new Map<string, AxiosInstance>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  
  // Performance tracking
  private requestMetrics = new Map<string, number[]>(); // Response times
  private errorCounts = new Map<string, number>();
  private requestCounts = new Map<string, number>();
  
  // Distributed tracing
  private tracer = trace.getTracer('enterprise-service-registry', '1.0.0');

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize the service registry with default services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Service registry already initialized');
      return;
    }

    logger.info('🚀 Initializing Enterprise Service Registry...');

    // Register core services based on existing infrastructure
    await this.registerCoreServices();
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Start metrics collection
    this.startMetricsCollection();
    
    // Initialize circuit breakers
    this.initializeCircuitBreakers();
    
    this.isInitialized = true;
    this.emit('registry:initialized');
    
    logger.info('✅ Enterprise Service Registry initialized successfully');
  }

  /**
   * Register a service in the registry
   */
  async registerService(config: ServiceConfig): Promise<void> {
    const span = this.tracer.startSpan('service_registration', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'service.name': config.name,
        'service.url': config.baseUrl,
        'service.version': config.version
      }
    });

    try {
      // Validate service configuration
      this.validateServiceConfig(config);
      
      // Create HTTP client for this service
      const httpClient = this.createHttpClient(config);
      this.httpClients.set(config.name, httpClient);
      
      // Initialize health status
      this.healthStatus.set(config.name, {
        status: 'unknown',
        responseTime: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        uptime: 0
      });
      
      // Initialize circuit breaker
      this.circuitBreakers.set(config.name, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        successCount: 0
      });
      
      // Initialize metrics
      this.requestMetrics.set(config.name, []);
      this.errorCounts.set(config.name, 0);
      this.requestCounts.set(config.name, 0);
      
      // Store service configuration
      this.services.set(config.name, config);
      
      // Perform initial health check
      await this.performHealthCheck(config.name);
      
      span.setStatus({ code: SpanStatusCode.OK });
      this.emit('service:registered', config.name);
      
      logger.info(`✅ Service registered: ${config.name} at ${config.baseUrl}`);
      
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error(`❌ Failed to register service ${config.name}:`, error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Register core services based on existing infrastructure
   */
  private async registerCoreServices(): Promise<void> {
    const coreServices: ServiceConfig[] = [
      {
        name: 'llm-service',
        baseUrl: process.env.LLM_SERVICE_URL || 'http://localhost:3003',
        healthEndpoint: '/health',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        circuitBreakerConfig: {
          failureThreshold: 5,
          resetTimeout: 30000,
          monitoringPeriod: 10000,
          volumeThreshold: 10
        },
        priority: 9, // High priority
        tags: ['ai', 'content-generation', 'core'],
        version: '1.0.0',
        capabilities: ['content-generation', 'analysis', 'optimization']
      },
      {
        name: 'telegram-bot',
        baseUrl: process.env.TELEGRAM_BOT_URL || 'http://localhost:3002',
        healthEndpoint: '/health',
        timeout: 10000,
        retryAttempts: 2,
        retryDelay: 500,
        circuitBreakerConfig: {
          failureThreshold: 3,
          resetTimeout: 15000,
          monitoringPeriod: 5000,
          volumeThreshold: 5
        },
        priority: 8, // High priority
        tags: ['bot', 'messaging', 'core'],
        version: '1.0.0',
        capabilities: ['messaging', 'user-interaction', 'notifications']
      },
      {
        name: 'frontend',
        baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        healthEndpoint: '/api/health',
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 500,
        circuitBreakerConfig: {
          failureThreshold: 3,
          resetTimeout: 10000,
          monitoringPeriod: 5000,
          volumeThreshold: 5
        },
        priority: 6, // Medium priority
        tags: ['frontend', 'ui', 'web'],
        version: '1.0.0',
        capabilities: ['user-interface', 'dashboard', 'analytics']
      }
    ];

    for (const serviceConfig of coreServices) {
      try {
        await this.registerService(serviceConfig);
      } catch (error) {
        logger.warn(`Failed to register core service ${serviceConfig.name}:`, error);
        // Continue with other services even if one fails
      }
    }
  }

  /**
   * Setup event handlers for service registry
   */
  private setupEventHandlers(): void {
    this.on('service:health_changed', (serviceName: string, oldStatus: string, newStatus: string) => {
      logger.info(`🔄 Service ${serviceName} health changed: ${oldStatus} → ${newStatus}`);

      // Emit specific events for different health states
      if (newStatus === 'unhealthy') {
        this.emit('service:unhealthy', serviceName);
      } else if (newStatus === 'healthy' && oldStatus !== 'healthy') {
        this.emit('service:recovered', serviceName);
      }
    });

    this.on('circuit_breaker:opened', (serviceName: string) => {
      logger.warn(`⚡ Circuit breaker opened for service: ${serviceName}`);
    });

    this.on('circuit_breaker:closed', (serviceName: string) => {
      logger.info(`✅ Circuit breaker closed for service: ${serviceName}`);
    });
  }

  /**
   * Validate service configuration
   */
  private validateServiceConfig(config: ServiceConfig): void {
    if (!config.name || !config.baseUrl) {
      throw new Error('Service name and baseUrl are required');
    }

    if (this.services.has(config.name)) {
      throw new Error(`Service ${config.name} is already registered`);
    }

    if (config.timeout < 1000 || config.timeout > 120000) {
      throw new Error('Service timeout must be between 1000ms and 120000ms');
    }

    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      throw new Error('Retry attempts must be between 0 and 10');
    }
  }

  /**
   * Create HTTP client with enterprise-grade configuration
   */
  private createHttpClient(config: ServiceConfig): AxiosInstance {
    const client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'X-Marketing-Platform/1.0.0',
        'X-Service-Registry': 'enterprise',
        'X-Service-Version': config.version
      }
    });

    // Request interceptor for tracing and metrics
    client.interceptors.request.use(
      (requestConfig) => {
        // Add correlation ID for tracing
        const correlationId = this.generateCorrelationId();
        requestConfig.headers = requestConfig.headers || {};
        requestConfig.headers['X-Correlation-ID'] = correlationId;
        requestConfig.headers['X-Request-Start'] = Date.now().toString();

        return requestConfig;
      },
      (error) => {
        logger.error(`Request interceptor error for ${config.name}:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for metrics and error handling
    client.interceptors.response.use(
      (response) => {
        const startTime = parseInt(response.config.headers?.['X-Request-Start'] as string || '0');
        const responseTime = Date.now() - startTime;

        // Record successful request metrics
        this.recordRequestMetrics(config.name, responseTime, true);

        return response;
      },
      (error) => {
        const startTime = parseInt(error.config?.headers?.['X-Request-Start'] || '0');
        const responseTime = Date.now() - startTime;

        // Record failed request metrics
        this.recordRequestMetrics(config.name, responseTime, false);

        logger.error(`HTTP client error for ${config.name}:`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message
        });

        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Execute request with circuit breaker and retry logic
   */
  async executeRequest<T>(serviceName: string, request: ServiceRequest): Promise<ServiceResponse<T>> {
    const span = this.tracer.startSpan(`service_request_${serviceName}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'service.name': serviceName,
        'http.method': request.method,
        'http.url': request.endpoint
      }
    });

    const startTime = Date.now();
    let lastError: Error | null = null;

    try {
      // Check if service is registered
      const serviceConfig = this.services.get(serviceName);
      if (!serviceConfig) {
        throw new Error(`Service ${serviceName} is not registered`);
      }

      // Check circuit breaker
      if (request.circuitBreaker !== false && this.isCircuitBreakerOpen(serviceName)) {
        throw new Error(`Circuit breaker is open for service ${serviceName}`);
      }

      // Get HTTP client
      const client = this.httpClients.get(serviceName);
      if (!client) {
        throw new Error(`HTTP client not found for service ${serviceName}`);
      }

      // Attempt request with retries
      const maxRetries = request.retries ?? serviceConfig.retryAttempts;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.makeHttpRequest(client, request, serviceConfig);
          const responseTime = Date.now() - startTime;

          // Record success in circuit breaker
          this.recordCircuitBreakerSuccess(serviceName);

          span.setAttributes({
            'http.status_code': response.status,
            'http.response_time': responseTime,
            'retry.attempt': attempt
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return {
            success: true,
            data: response.data,
            responseTime,
            fromCache: false,
            serviceUsed: serviceName,
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId
          };

        } catch (error) {
          lastError = error as Error;

          // Don't retry on 4xx errors (except 429)
          if (this.isNonRetryableError(error)) {
            break;
          }

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = serviceConfig.retryDelay * Math.pow(2, attempt);
            await this.sleep(delay);
          }
        }
      }

      // All retries failed
      this.recordCircuitBreakerFailure(serviceName);
      throw lastError || new Error('Request failed after all retries');

    } catch (error) {
      const responseTime = Date.now() - startTime;

      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });

      logger.error(`Service request failed for ${serviceName}:`, {
        endpoint: request.endpoint,
        method: request.method,
        error: (error as Error).message,
        responseTime
      });

      return {
        success: false,
        error: (error as Error).message,
        responseTime,
        fromCache: false,
        serviceUsed: serviceName,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      };

    } finally {
      span.end();
    }
  }

  /**
   * Make HTTP request with proper error handling
   */
  private async makeHttpRequest(
    client: AxiosInstance,
    request: ServiceRequest,
    config: ServiceConfig
  ): Promise<AxiosResponse> {
    const requestConfig: AxiosRequestConfig = {
      method: request.method,
      url: request.endpoint,
      data: request.data,
      timeout: request.timeout || config.timeout,
      ...(request.headers && { headers: request.headers })
    };

    return await client.request(requestConfig);
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    const status = error.response?.status;
    return status >= 400 && status < 500 && status !== 429;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate correlation ID for request tracing
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record request metrics
   */
  private recordRequestMetrics(serviceName: string, responseTime: number, success: boolean): void {
    // Record response time
    const metrics = this.requestMetrics.get(serviceName) || [];
    metrics.push(responseTime);

    // Keep only last 1000 measurements
    if (metrics.length > 1000) {
      metrics.shift();
    }
    this.requestMetrics.set(serviceName, metrics);

    // Update counters
    const currentRequests = this.requestCounts.get(serviceName) || 0;
    this.requestCounts.set(serviceName, currentRequests + 1);

    if (!success) {
      const currentErrors = this.errorCounts.get(serviceName) || 0;
      this.errorCounts.set(serviceName, currentErrors + 1);
    }
  }

  /**
   * Start health monitoring for all services
   */
  private startHealthMonitoring(): void {
    const healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');

    this.healthCheckInterval = setInterval(async () => {
      for (const serviceName of this.services.keys()) {
        try {
          await this.performHealthCheck(serviceName);
        } catch (error) {
          logger.error(`Health check failed for ${serviceName}:`, error);
        }
      }
    }, healthCheckInterval);

    logger.info(`🏥 Health monitoring started (interval: ${healthCheckInterval}ms)`);
  }

  /**
   * Perform health check for a specific service
   */
  async performHealthCheck(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    const currentHealth = this.healthStatus.get(serviceName);

    if (!service || !currentHealth) {
      return;
    }

    const startTime = Date.now();
    let newStatus: ServiceHealth['status'] = 'unknown';
    let error: string | undefined;

    try {
      const client = this.httpClients.get(serviceName);
      if (!client) {
        throw new Error('HTTP client not available');
      }

      const response = await client.get(service.healthEndpoint, {
        timeout: 5000 // Short timeout for health checks
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        newStatus = 'healthy';
        currentHealth.consecutiveFailures = 0;
      } else {
        newStatus = 'degraded';
        error = `HTTP ${response.status}`;
      }

      currentHealth.responseTime = responseTime;

    } catch (err) {
      const responseTime = Date.now() - startTime;
      newStatus = 'unhealthy';
      error = (err as Error).message;
      currentHealth.consecutiveFailures++;
      currentHealth.responseTime = responseTime;
    }

    // Update health status
    const oldStatus = currentHealth.status;
    currentHealth.status = newStatus;
    currentHealth.lastCheck = new Date();
    if (error !== undefined) {
      currentHealth.error = error;
    }

    // Calculate uptime percentage
    const totalChecks = this.requestCounts.get(serviceName) || 1;
    const errorCount = this.errorCounts.get(serviceName) || 0;
    currentHealth.uptime = ((totalChecks - errorCount) / totalChecks) * 100;

    // Emit health change event
    if (oldStatus !== newStatus) {
      this.emit('service:health_changed', serviceName, oldStatus, newStatus);
    }

    // Update circuit breaker based on health
    if (newStatus === 'unhealthy') {
      this.recordCircuitBreakerFailure(serviceName);
    } else if (newStatus === 'healthy') {
      this.recordCircuitBreakerSuccess(serviceName);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const metricsInterval = parseInt(process.env.METRICS_COLLECTION_INTERVAL || '60000');

    this.metricsCollectionInterval = setInterval(() => {
      this.collectAndCacheMetrics();
    }, metricsInterval);

    logger.info(`📊 Metrics collection started (interval: ${metricsInterval}ms)`);
  }

  /**
   * Collect and cache service metrics
   */
  private async collectAndCacheMetrics(): Promise<void> {
    for (const [serviceName, health] of this.healthStatus.entries()) {
      const metrics = this.calculateServiceMetrics(serviceName);
      health.metrics = metrics;

      // Cache metrics for external access
      await cacheManager.set(`service_metrics:${serviceName}`, metrics, 300); // 5 minutes TTL
    }
  }

  /**
   * Calculate service metrics
   */
  private calculateServiceMetrics(serviceName: string): ServiceMetrics {
    const responseTimes = this.requestMetrics.get(serviceName) || [];
    const requestCount = this.requestCounts.get(serviceName) || 0;
    const errorCount = this.errorCounts.get(serviceName) || 0;

    // Calculate percentiles
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
    const throughput = requestCount / 60; // requests per minute (approximate)

    return {
      requestCount,
      errorCount,
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      throughput: Math.round(throughput * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  /**
   * Initialize circuit breakers for all services
   */
  private initializeCircuitBreakers(): void {
    for (const serviceName of this.services.keys()) {
      this.circuitBreakers.set(serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        successCount: 0
      });
    }
    logger.info('⚡ Circuit breakers initialized for all services');
  }

  /**
   * Check if circuit breaker is open for a service
   */
  private isCircuitBreakerOpen(serviceName: string): boolean {
    const breaker = this.circuitBreakers.get(serviceName);
    const service = this.services.get(serviceName);

    if (!breaker || !service) {
      return false;
    }

    if (breaker.state === 'OPEN') {
      // Check if we should attempt to half-open
      if (breaker.nextAttemptTime && new Date() >= breaker.nextAttemptTime) {
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;
        logger.info(`🔄 Circuit breaker half-opened for ${serviceName}`);
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    const service = this.services.get(serviceName);

    if (!breaker || !service) {
      return;
    }

    breaker.failureCount++;
    breaker.lastFailureTime = new Date();

    if (breaker.state === 'HALF_OPEN') {
      // Failed during half-open, go back to open
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = new Date(Date.now() + service.circuitBreakerConfig.resetTimeout);
      this.emit('circuit_breaker:opened', serviceName);
    } else if (breaker.state === 'CLOSED' &&
               breaker.failureCount >= service.circuitBreakerConfig.failureThreshold) {
      // Threshold reached, open the circuit
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = new Date(Date.now() + service.circuitBreakerConfig.resetTimeout);
      this.emit('circuit_breaker:opened', serviceName);
    }
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    const service = this.services.get(serviceName);

    if (!breaker || !service) {
      return;
    }

    if (breaker.state === 'HALF_OPEN') {
      breaker.successCount++;

      // If we have enough successes, close the circuit
      if (breaker.successCount >= service.circuitBreakerConfig.volumeThreshold) {
        breaker.state = 'CLOSED';
        breaker.failureCount = 0;
        breaker.successCount = 0;
        breaker.lastFailureTime = null;
        breaker.nextAttemptTime = null;
        this.emit('circuit_breaker:closed', serviceName);
      }
    } else if (breaker.state === 'CLOSED') {
      // Reset failure count on success
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }

  /**
   * Get healthy service instance (with load balancing if multiple instances)
   */
  async getHealthyService(serviceName: string): Promise<ServiceConfig | null> {
    const service = this.services.get(serviceName);
    const health = this.healthStatus.get(serviceName);

    if (!service || !health) {
      return null;
    }

    // Check if service is healthy and circuit breaker is not open
    if (health.status === 'healthy' && !this.isCircuitBreakerOpen(serviceName)) {
      return service;
    }

    // If primary service is unhealthy, try to find alternative
    // This could be extended to support multiple instances of the same service
    return null;
  }

  /**
   * Get all registered services
   */
  getServices(): Map<string, ServiceConfig> {
    return new Map(this.services);
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceName?: string): Map<string, ServiceHealth> | ServiceHealth | null {
    if (serviceName) {
      return this.healthStatus.get(serviceName) || null;
    }
    return new Map(this.healthStatus);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(serviceName?: string): Map<string, CircuitBreakerState> | CircuitBreakerState | null {
    if (serviceName) {
      return this.circuitBreakers.get(serviceName) || null;
    }
    return new Map(this.circuitBreakers);
  }

  /**
   * Get comprehensive service registry status
   */
  async getRegistryStatus(): Promise<any> {
    const services = Array.from(this.services.entries()).map(([name, config]) => {
      const health = this.healthStatus.get(name);
      const circuitBreaker = this.circuitBreakers.get(name);

      return {
        name,
        url: config.baseUrl,
        version: config.version,
        priority: config.priority,
        tags: config.tags,
        capabilities: config.capabilities,
        health: health ? {
          status: health.status,
          responseTime: health.responseTime,
          uptime: health.uptime,
          consecutiveFailures: health.consecutiveFailures,
          lastCheck: health.lastCheck,
          error: health.error
        } : null,
        circuitBreaker: circuitBreaker ? {
          state: circuitBreaker.state,
          failureCount: circuitBreaker.failureCount,
          nextAttemptTime: circuitBreaker.nextAttemptTime
        } : null,
        metrics: health?.metrics || null
      };
    });

    return {
      initialized: this.isInitialized,
      totalServices: this.services.size,
      healthyServices: Array.from(this.healthStatus.values()).filter(h => h.status === 'healthy').length,
      unhealthyServices: Array.from(this.healthStatus.values()).filter(h => h.status === 'unhealthy').length,
      openCircuitBreakers: Array.from(this.circuitBreakers.values()).filter(cb => cb.state === 'OPEN').length,
      services,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    this.services.clear();
    this.healthStatus.clear();
    this.circuitBreakers.clear();
    this.httpClients.clear();
    this.requestMetrics.clear();
    this.errorCounts.clear();
    this.requestCounts.clear();

    this.isInitialized = false;
    this.emit('registry:destroyed');

    logger.info('🧹 Enterprise Service Registry destroyed');
  }
}

// Export singleton instance
export const enterpriseServiceRegistry = new EnterpriseServiceRegistry();
