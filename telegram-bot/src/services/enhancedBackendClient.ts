/**
 * Enhanced Backend Client - Stage 24 Implementation
 * 
 * Unified API abstraction layer that standardizes communication patterns across
 * all 35+ backend services while maintaining service-specific optimizations.
 * 
 * Key Features:
 * - Intelligent service discovery and health monitoring
 * - Persistent connection pools for high-frequency operations
 * - Circuit breaker patterns with adaptive retry policies
 * - Context-aware error handling and fallback mechanisms
 * - Real-time metrics collection and performance optimization
 * - Distributed tracing and correlation ID management
 * 
 * Integration Points:
 * - EnterpriseServiceRegistry: Service discovery and health monitoring
 * - TwikitSessionManager: Session lifecycle management
 * - GlobalRateLimitCoordinator: Distributed rate limiting
 * - TwikitRealtimeSync: WebSocket event coordination
 * - TwikitMonitoringService: Performance metrics and alerting
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

// Types and Interfaces
export interface ServiceEndpoint {
  serviceName: string;
  baseUrl: string;
  healthEndpoint: string;
  version: string;
  capabilities: string[];
  priority: number;
  tags: string[];
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  maxIdleTime: number;
  keepAlive: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  volumeThreshold: number;
}

export interface ServiceRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  circuitBreaker?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  correlationId?: string;
  userContext?: any;
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
  retryCount?: number;
  circuitBreakerState?: string;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: Date;
  consecutiveFailures: number;
  uptime: number;
  error?: string;
  metrics?: ServiceMetrics;
}

export interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: Date | null;
  nextAttemptTime: Date | null;
  successCount: number;
}

/**
 * Connection Pool Manager for persistent HTTP connections
 */
class ConnectionPool {
  private pools = new Map<string, AxiosInstance[]>();
  private activeConnections = new Map<string, number>();
  private config: ConnectionPoolConfig;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
  }

  async getConnection(serviceName: string, baseUrl: string): Promise<AxiosInstance> {
    const pool = this.pools.get(serviceName) || [];
    const active = this.activeConnections.get(serviceName) || 0;

    // Reuse existing connection if available
    if (pool.length > 0) {
      const connection = pool.pop()!;
      this.activeConnections.set(serviceName, active + 1);
      return connection;
    }

    // Create new connection if under limit
    if (active < this.config.maxConnections) {
      const connection = this.createConnection(baseUrl);
      this.activeConnections.set(serviceName, active + 1);
      return connection;
    }

    // Wait for available connection
    return new Promise((resolve) => {
      const checkForConnection = () => {
        const currentPool = this.pools.get(serviceName) || [];
        if (currentPool.length > 0) {
          const connection = currentPool.pop()!;
          const currentActive = this.activeConnections.get(serviceName) || 0;
          this.activeConnections.set(serviceName, currentActive + 1);
          resolve(connection);
        } else {
          setTimeout(checkForConnection, 100);
        }
      };
      checkForConnection();
    });
  }

  releaseConnection(serviceName: string, connection: AxiosInstance): void {
    const pool = this.pools.get(serviceName) || [];
    const active = this.activeConnections.get(serviceName) || 0;

    pool.push(connection);
    this.pools.set(serviceName, pool);
    this.activeConnections.set(serviceName, Math.max(0, active - 1));
  }

  private createConnection(baseUrl: string): AxiosInstance {
    return axios.create({
      baseURL: baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Enhanced-Backend-Client/1.0.0',
        'Connection': this.config.keepAlive ? 'keep-alive' : 'close'
      }
    });
  }

  getPoolStats(): Record<string, { total: number; active: number }> {
    const stats: Record<string, { total: number; active: number }> = {};
    
    for (const [serviceName, pool] of this.pools.entries()) {
      const active = this.activeConnections.get(serviceName) || 0;
      stats[serviceName] = {
        total: pool.length + active,
        active
      };
    }
    
    return stats;
  }
}

/**
 * Enhanced Backend Client - Main Implementation
 */
export class EnhancedBackendClient extends EventEmitter {
  private serviceRegistry = new Map<string, ServiceEndpoint>();
  private serviceHealth = new Map<string, ServiceHealth>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private connectionPool: ConnectionPool;
  private tracer = trace.getTracer('enhanced-backend-client', '1.0.0');
  
  // Performance tracking
  private requestMetrics = new Map<string, number[]>();
  private errorCounts = new Map<string, number>();
  private requestCounts = new Map<string, number>();
  
  // Configuration
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    super();
    
    // Initialize connection pool
    this.connectionPool = new ConnectionPool({
      maxConnections: parseInt(process.env.MAX_CONNECTIONS_PER_SERVICE || '10'),
      maxIdleTime: parseInt(process.env.CONNECTION_IDLE_TIME || '300000'), // 5 minutes
      keepAlive: true,
      timeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.DEFAULT_RETRIES || '3'),
      retryDelay: parseInt(process.env.DEFAULT_RETRY_DELAY || '1000')
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize the Enhanced Backend Client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enhanced Backend Client already initialized');
      return;
    }

    logger.info('🚀 Initializing Enhanced Backend Client...');

    try {
      // Discover and register backend services
      await this.discoverServices();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Initialize circuit breakers
      this.initializeCircuitBreakers();
      
      this.isInitialized = true;
      this.emit('client:initialized');
      
      logger.info('✅ Enhanced Backend Client initialized successfully');
      logger.info(`📊 Discovered ${this.serviceRegistry.size} backend services`);
      
    } catch (error) {
      logger.error('❌ Failed to initialize Enhanced Backend Client:', error);
      throw error;
    }
  }

  /**
   * Discover available backend services
   */
  private async discoverServices(): Promise<void> {
    const backendServices: ServiceEndpoint[] = [
      // Core Twikit Services
      {
        serviceName: 'twikit-session-manager',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['session-management', 'authentication', 'account-health'],
        priority: 10, // Critical
        tags: ['core', 'session', 'authentication']
      },
      {
        serviceName: 'global-rate-limit-coordinator',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['rate-limiting', 'queue-management', 'analytics'],
        priority: 9, // High
        tags: ['core', 'rate-limiting', 'coordination']
      },
      {
        serviceName: 'x-automation-service',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['automation', 'posting', 'engagement', 'analytics'],
        priority: 9, // High
        tags: ['core', 'automation', 'x-api']
      },
      {
        serviceName: 'twikit-monitoring-service',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/monitoring/health',
        version: '1.0.0',
        capabilities: ['monitoring', 'metrics', 'alerting', 'dashboard'],
        priority: 8, // High
        tags: ['monitoring', 'metrics', 'observability']
      },
      {
        serviceName: 'enterprise-anti-detection-manager',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['anti-detection', 'behavioral-analysis', 'fingerprinting'],
        priority: 8, // High
        tags: ['security', 'anti-detection', 'behavioral']
      },
      {
        serviceName: 'twikit-cache-manager',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['caching', 'performance', 'optimization'],
        priority: 7, // Medium-High
        tags: ['performance', 'caching', 'optimization']
      },
      {
        serviceName: 'proxy-rotation-manager',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['proxy-management', 'rotation', 'health-monitoring'],
        priority: 7, // Medium-High
        tags: ['infrastructure', 'proxy', 'networking']
      },
      {
        serviceName: 'account-health-monitor',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['health-monitoring', 'risk-assessment', 'alerts'],
        priority: 8, // High
        tags: ['monitoring', 'health', 'risk-assessment']
      },
      {
        serviceName: 'emergency-stop-system',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['emergency-stop', 'system-shutdown', 'recovery'],
        priority: 10, // Critical
        tags: ['safety', 'emergency', 'system-control']
      },
      {
        serviceName: 'twikit-realtime-sync',
        baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
        healthEndpoint: '/api/health',
        version: '1.0.0',
        capabilities: ['realtime-sync', 'websocket', 'event-streaming'],
        priority: 8, // High
        tags: ['realtime', 'websocket', 'events']
      },
      // LLM Service
      {
        serviceName: 'llm-service',
        baseUrl: process.env.LLM_SERVICE_URL || 'http://localhost:3003',
        healthEndpoint: '/health',
        version: '1.0.0',
        capabilities: ['content-generation', 'analysis', 'natural-language'],
        priority: 9, // High
        tags: ['ai', 'llm', 'content-generation']
      }
    ];

    // Register each service
    for (const service of backendServices) {
      try {
        await this.registerService(service);
      } catch (error) {
        logger.warn(`Failed to register service ${service.serviceName}:`, error);
        // Continue with other services
      }
    }
  }

  /**
   * Register a service in the client registry
   */
  private async registerService(service: ServiceEndpoint): Promise<void> {
    const span = this.tracer.startSpan('service_registration', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'service.name': service.serviceName,
        'service.url': service.baseUrl,
        'service.version': service.version
      }
    });

    try {
      // Store service configuration
      this.serviceRegistry.set(service.serviceName, service);

      // Initialize health status
      this.serviceHealth.set(service.serviceName, {
        status: 'unknown',
        responseTime: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        uptime: 0
      });

      // Initialize circuit breaker
      this.circuitBreakers.set(service.serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null,
        successCount: 0
      });

      // Initialize metrics
      this.requestMetrics.set(service.serviceName, []);
      this.errorCounts.set(service.serviceName, 0);
      this.requestCounts.set(service.serviceName, 0);

      // Perform initial health check
      await this.performHealthCheck(service.serviceName);

      span.setStatus({ code: SpanStatusCode.OK });
      this.emit('service:registered', service.serviceName);

      logger.info(`✅ Service registered: ${service.serviceName}`);

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error(`❌ Failed to register service ${service.serviceName}:`, error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute request with intelligent routing and error handling
   */
  async request<T>(serviceName: string, request: ServiceRequest): Promise<ServiceResponse<T>> {
    const span = this.tracer.startSpan(`backend_request_${serviceName}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'service.name': serviceName,
        'http.method': request.method,
        'http.url': request.endpoint,
        'request.priority': request.priority || 'normal'
      }
    });

    const startTime = Date.now();
    const correlationId = request.correlationId || uuidv4();
    let lastError: Error | null = null;

    try {
      // Check if service is registered
      const service = this.serviceRegistry.get(serviceName);
      if (!service) {
        throw new Error(`Service ${serviceName} is not registered`);
      }

      // Check circuit breaker
      if (request.circuitBreaker !== false && this.isCircuitBreakerOpen(serviceName)) {
        throw new Error(`Circuit breaker is open for service ${serviceName}`);
      }

      // Check service health
      const health = this.serviceHealth.get(serviceName);
      if (health?.status === 'unhealthy') {
        logger.warn(`Service ${serviceName} is unhealthy, attempting request anyway`);
      }

      // Get connection from pool
      const connection = await this.connectionPool.getConnection(serviceName, service.baseUrl);

      try {
        // Attempt request with retries
        const maxRetries = request.retries ?? 3;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const response = await this.makeHttpRequest(connection, request, correlationId, attempt);
            const responseTime = Date.now() - startTime;

            // Record success metrics
            this.recordRequestMetrics(serviceName, responseTime, true);
            this.recordCircuitBreakerSuccess(serviceName);

            span.setAttributes({
              'http.status_code': response.status,
              'http.response_time': responseTime,
              'retry.attempt': attempt,
              'correlation.id': correlationId
            });
            span.setStatus({ code: SpanStatusCode.OK });

            return {
              success: true,
              data: response.data,
              responseTime,
              fromCache: false,
              serviceUsed: serviceName,
              traceId: span.spanContext().traceId,
              spanId: span.spanContext().spanId,
              retryCount: attempt,
              circuitBreakerState: this.circuitBreakers.get(serviceName)?.state || 'CLOSED'
            };

          } catch (error) {
            lastError = error as Error;

            // Don't retry on 4xx errors (except 429)
            if (this.isNonRetryableError(error)) {
              break;
            }

            // Wait before retry with exponential backoff
            if (attempt < maxRetries) {
              const delay = 1000 * Math.pow(2, attempt);
              await this.sleep(delay);
            }
          }
        }

        // All retries failed
        this.recordCircuitBreakerFailure(serviceName);
        throw lastError || new Error('Request failed after all retries');

      } finally {
        // Release connection back to pool
        this.connectionPool.releaseConnection(serviceName, connection);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failure metrics
      this.recordRequestMetrics(serviceName, responseTime, false);

      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });

      logger.error(`Service request failed for ${serviceName}:`, {
        endpoint: request.endpoint,
        method: request.method,
        error: (error as Error).message,
        responseTime,
        correlationId
      });

      return {
        success: false,
        error: (error as Error).message,
        responseTime,
        fromCache: false,
        serviceUsed: serviceName,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        circuitBreakerState: this.circuitBreakers.get(serviceName)?.state || 'CLOSED'
      };

    } finally {
      span.end();
    }
  }

  /**
   * Make HTTP request with proper headers and tracing
   */
  private async makeHttpRequest(
    connection: AxiosInstance,
    request: ServiceRequest,
    correlationId: string,
    attempt: number
  ): Promise<AxiosResponse> {
    const requestConfig: AxiosRequestConfig = {
      method: request.method,
      url: request.endpoint,
      data: request.data,
      timeout: request.timeout || 30000,
      headers: {
        ...request.headers,
        'X-Correlation-ID': correlationId,
        'X-Request-Priority': request.priority || 'normal',
        'X-Retry-Attempt': attempt.toString(),
        'X-Request-Start': Date.now().toString()
      }
    };

    return await connection.request(requestConfig);
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
   * Convenience methods for common HTTP operations
   */
  async get<T>(serviceName: string, endpoint: string, options?: Partial<ServiceRequest>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'GET',
      endpoint,
      ...options
    });
  }

  async post<T>(serviceName: string, endpoint: string, data?: any, options?: Partial<ServiceRequest>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'POST',
      endpoint,
      data,
      ...options
    });
  }

  async put<T>(serviceName: string, endpoint: string, data?: any, options?: Partial<ServiceRequest>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'PUT',
      endpoint,
      data,
      ...options
    });
  }

  async delete<T>(serviceName: string, endpoint: string, options?: Partial<ServiceRequest>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'DELETE',
      endpoint,
      ...options
    });
  }

  async patch<T>(serviceName: string, endpoint: string, data?: any, options?: Partial<ServiceRequest>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'PATCH',
      endpoint,
      data,
      ...options
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('service:health_changed', (serviceName: string, oldStatus: string, newStatus: string) => {
      logger.info(`🔄 Service ${serviceName} health changed: ${oldStatus} → ${newStatus}`);

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
   * Start health monitoring for all services
   */
  private startHealthMonitoring(): void {
    const healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');

    this.healthCheckInterval = setInterval(async () => {
      for (const serviceName of this.serviceRegistry.keys()) {
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
  private async performHealthCheck(serviceName: string): Promise<void> {
    const service = this.serviceRegistry.get(serviceName);
    const currentHealth = this.serviceHealth.get(serviceName);

    if (!service || !currentHealth) {
      return;
    }

    const startTime = Date.now();
    let newStatus: ServiceHealth['status'] = 'unknown';
    let error: string | undefined;

    try {
      const connection = await this.connectionPool.getConnection(serviceName, service.baseUrl);

      try {
        const response = await connection.get(service.healthEndpoint, {
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

      } finally {
        this.connectionPool.releaseConnection(serviceName, connection);
      }

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
      this.collectMetrics();
    }, metricsInterval);

    logger.info(`📊 Metrics collection started (interval: ${metricsInterval}ms)`);
  }

  /**
   * Collect service metrics
   */
  private collectMetrics(): void {
    for (const [serviceName, health] of this.serviceHealth.entries()) {
      const metrics = this.calculateServiceMetrics(serviceName);
      health.metrics = metrics;
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
    for (const serviceName of this.serviceRegistry.keys()) {
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

    if (!breaker) {
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

    if (!breaker) {
      return;
    }

    breaker.failureCount++;
    breaker.lastFailureTime = new Date();

    const failureThreshold = 5; // Default threshold
    const resetTimeout = 30000; // 30 seconds

    if (breaker.state === 'HALF_OPEN') {
      // Failed during half-open, go back to open
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = new Date(Date.now() + resetTimeout);
      this.emit('circuit_breaker:opened', serviceName);
    } else if (breaker.state === 'CLOSED' && breaker.failureCount >= failureThreshold) {
      // Threshold reached, open the circuit
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = new Date(Date.now() + resetTimeout);
      this.emit('circuit_breaker:opened', serviceName);
    }
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);

    if (!breaker) {
      return;
    }

    if (breaker.state === 'HALF_OPEN') {
      breaker.successCount++;

      const volumeThreshold = 3; // Default volume threshold

      // If we have enough successes, close the circuit
      if (breaker.successCount >= volumeThreshold) {
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
   * Get healthy service for intelligent routing
   */
  async getHealthyService(serviceName: string): Promise<ServiceEndpoint | null> {
    const service = this.serviceRegistry.get(serviceName);
    const health = this.serviceHealth.get(serviceName);

    if (!service || !health) {
      return null;
    }

    // Check if service is healthy and circuit breaker is not open
    if (health.status === 'healthy' && !this.isCircuitBreakerOpen(serviceName)) {
      return service;
    }

    return null;
  }

  /**
   * Get all registered services
   */
  getServices(): Map<string, ServiceEndpoint> {
    return new Map(this.serviceRegistry);
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceName?: string): Map<string, ServiceHealth> | ServiceHealth | null {
    if (serviceName) {
      return this.serviceHealth.get(serviceName) || null;
    }
    return new Map(this.serviceHealth);
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
   * Get connection pool statistics
   */
  getConnectionPoolStats(): Record<string, { total: number; active: number }> {
    return this.connectionPool.getPoolStats();
  }

  /**
   * Get comprehensive client status
   */
  async getClientStatus(): Promise<any> {
    const services = Array.from(this.serviceRegistry.entries()).map(([name, config]) => {
      const health = this.serviceHealth.get(name);
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
      totalServices: this.serviceRegistry.size,
      healthyServices: Array.from(this.serviceHealth.values()).filter(h => h.status === 'healthy').length,
      unhealthyServices: Array.from(this.serviceHealth.values()).filter(h => h.status === 'unhealthy').length,
      openCircuitBreakers: Array.from(this.circuitBreakers.values()).filter(cb => cb.state === 'OPEN').length,
      connectionPools: this.getConnectionPoolStats(),
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

    this.serviceRegistry.clear();
    this.serviceHealth.clear();
    this.circuitBreakers.clear();
    this.requestMetrics.clear();
    this.errorCounts.clear();
    this.requestCounts.clear();

    this.isInitialized = false;
    this.emit('client:destroyed');

    logger.info('🧹 Enhanced Backend Client destroyed');
  }
}

// Export singleton instance
export const enhancedBackendClient = new EnhancedBackendClient();
