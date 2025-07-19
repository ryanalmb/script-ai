/**
 * Enterprise Service Client
 * Provides resilient, observable service-to-service communication
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { serviceDiscovery, ServiceInstance } from './serviceDiscovery';
import { circuitBreakerManager } from './circuitBreaker';
import { metrics } from './metrics';
import { tracing } from './tracing';
import { eventBus } from './eventBus';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ServiceClientConfig {
  serviceName: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    resetTimeout?: number;
    timeout?: number;
  };
  cacheConfig?: {
    enabled?: boolean;
    ttl?: number;
  };
}

export interface RequestOptions extends AxiosRequestConfig {
  userId?: string;
  correlationId?: string;
  skipCache?: boolean;
  skipCircuitBreaker?: boolean;
  skipTracing?: boolean;
}

export class EnterpriseServiceClient {
  private serviceName: string;
  private config: Required<ServiceClientConfig>;
  private axiosInstance: AxiosInstance;
  private cache: Map<string, { data: any; expires: number }> = new Map();

  constructor(config: ServiceClientConfig) {
    this.serviceName = config.serviceName;
    this.config = {
      serviceName: config.serviceName,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      circuitBreakerConfig: {
        failureThreshold: 5,
        resetTimeout: 60000,
        timeout: 30000,
        ...config.circuitBreakerConfig
      },
      cacheConfig: {
        enabled: true,
        ttl: 300000, // 5 minutes
        ...config.cacheConfig
      }
    };

    this.axiosInstance = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Enterprise-Telegram-Bot/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Make a GET request
   */
  async get<T = any>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Make a POST request
   */
  async post<T = any>(
    path: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('POST', path, data, options);
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(
    path: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('PUT', path, data, options);
  }

  /**
   * Make a PATCH request
   */
  async patch<T = any>(
    path: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('PATCH', path, data, options);
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Core request method with all enterprise features
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      userId,
      correlationId = uuidv4(),
      skipCache = false,
      skipCircuitBreaker = false,
      skipTracing = false,
      ...axiosOptions
    } = options;

    const cacheKey = this.getCacheKey(method, path, data);
    const startTime = Date.now();

    // Check cache first for GET requests
    if (method === 'GET' && !skipCache && this.config.cacheConfig.enabled) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached !== null) {
        logger.debug('Cache hit', { serviceName: this.serviceName, path, cacheKey });
        metrics.recordHttpRequest(method, path, 200, Date.now() - startTime, this.serviceName);
        return cached;
      }
    }

    // Get service instance
    const serviceInstance = await this.getServiceInstance();
    if (!serviceInstance) {
      throw new Error(`Service ${this.serviceName} not available`);
    }

    const url = `http://${serviceInstance.address}:${serviceInstance.port}${path}`;

    // Execute request with enterprise patterns
    const executeRequest = async (): Promise<T> => {
      if (skipTracing) {
        return this.executeHttpRequest<T>(method, url, data, axiosOptions, correlationId, userId);
      }

      return tracing.traceBackendCall(
        path,
        method,
        async (span) => {
          span.setAttributes({
            'service.name': this.serviceName,
            'service.instance.id': serviceInstance.id,
            'service.instance.address': serviceInstance.address,
            'service.instance.port': serviceInstance.port,
            'correlation.id': correlationId
          });

          return this.executeHttpRequest<T>(method, url, data, axiosOptions, correlationId, userId);
        },
        userId ? { userId } : {}
      );
    };

    try {
      let result: T;

      if (skipCircuitBreaker) {
        result = await executeRequest();
      } else {
        // Execute with circuit breaker
        const circuitBreaker = circuitBreakerManager.getCircuitBreaker(
          `${this.serviceName}-circuit-breaker`,
          this.config.circuitBreakerConfig
        );

        result = await circuitBreaker.execute(executeRequest, async () => {
          // Fallback function
          logger.warn('Circuit breaker fallback triggered', {
            serviceName: this.serviceName,
            path,
            method
          });

          // Publish fallback event
          await eventBus.publishSystemEvent('system.error', this.serviceName, {
            type: 'circuit_breaker_fallback',
            path,
            method,
            correlationId
          }, 'high');

          throw new Error(`Service ${this.serviceName} is currently unavailable`);
        });
      }

      // Cache successful GET responses
      if (method === 'GET' && !skipCache && this.config.cacheConfig.enabled) {
        this.setCache(cacheKey, result);
      }

      // Record success metrics
      const duration = (Date.now() - startTime) / 1000;
      metrics.recordHttpRequest(method, path, 200, duration, this.serviceName);

      // Publish success event
      await eventBus.publishSystemEvent('system.health', this.serviceName, {
        type: 'request_success',
        path,
        method,
        duration,
        correlationId
      });

      return result;

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const statusCode = (error as any).response?.status || 500;

      // Record error metrics
      metrics.recordHttpRequest(method, path, statusCode, duration, this.serviceName);

      // Publish error event
      await eventBus.publishSystemEvent('system.error', this.serviceName, {
        type: 'request_error',
        path,
        method,
        error: (error as Error).message,
        statusCode,
        duration,
        correlationId
      }, 'high');

      logger.error('Service request failed', {
        serviceName: this.serviceName,
        method,
        path,
        error: (error as Error).message,
        statusCode,
        correlationId
      });

      throw error;
    }
  }

  /**
   * Execute HTTP request with retry logic
   */
  private async executeHttpRequest<T>(
    method: string,
    url: string,
    data?: any,
    options: AxiosRequestConfig = {},
    correlationId?: string,
    userId?: string
  ): Promise<T> {
    const requestConfig: AxiosRequestConfig = {
      method,
      url,
      data,
      ...options,
      headers: {
        ...options.headers,
        'X-Correlation-ID': correlationId,
        'X-User-ID': userId,
        'X-Service-Name': 'telegram-bot-service'
      }
    };

    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const response: AxiosResponse<T> = await this.axiosInstance.request(requestConfig);
        return response.data;

      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (except 429)
        const status = (error as any).response?.status;
        if (status >= 400 && status < 500 && status !== 429) {
          throw error;
        }

        if (attempt === this.config.retries) {
          throw error;
        }

        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        logger.warn('Request failed, retrying...', {
          serviceName: this.serviceName,
          attempt,
          maxRetries: this.config.retries,
          delay,
          error: (error as Error).message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Get service instance from service discovery
   */
  private async getServiceInstance(): Promise<ServiceInstance | null> {
    try {
      return await serviceDiscovery.getService(this.serviceName, {
        strategy: 'round-robin'
      });
    } catch (error) {
      logger.error('Failed to discover service', {
        serviceName: this.serviceName,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(method: string, path: string, data?: any): string {
    const dataHash = data ? JSON.stringify(data) : '';
    return `${this.serviceName}:${method}:${path}:${dataHash}`;
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  /**
   * Set cache
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + (this.config.cacheConfig?.ttl || 300000)
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Setup axios interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Making service request', {
          serviceName: this.serviceName,
          method: config.method?.toUpperCase(),
          url: config.url
        });
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', {
          serviceName: this.serviceName,
          error: error.message
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('Service response received', {
          serviceName: this.serviceName,
          status: response.status,
          statusText: response.statusText
        });
        return response;
      },
      (error) => {
        logger.error('Service response error', {
          serviceName: this.serviceName,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get client health status
   */
  getHealthStatus(): {
    serviceName: string;
    cacheSize: number;
    circuitBreakerStatus: any;
  } {
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(
      `${this.serviceName}-circuit-breaker`,
      this.config.circuitBreakerConfig
    );

    return {
      serviceName: this.serviceName,
      cacheSize: this.cache.size,
      circuitBreakerStatus: circuitBreaker.getStats()
    };
  }
}

// Factory for creating service clients
export class ServiceClientFactory {
  private static clients: Map<string, EnterpriseServiceClient> = new Map();

  static getClient(serviceName: string, config?: Partial<ServiceClientConfig>): EnterpriseServiceClient {
    if (!this.clients.has(serviceName)) {
      const client = new EnterpriseServiceClient({
        serviceName,
        ...config
      });
      this.clients.set(serviceName, client);
    }

    return this.clients.get(serviceName)!;
  }

  static getAllClients(): Map<string, EnterpriseServiceClient> {
    return this.clients;
  }

  static clearAllCaches(): void {
    for (const client of this.clients.values()) {
      client.clearCache();
    }
  }
}

// Pre-configured service clients
export const backendClient = ServiceClientFactory.getClient('backend', {
  timeout: 30000,
  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeout: 60000
  }
});

export const llmClient = ServiceClientFactory.getClient('llm', {
  timeout: 120000, // 2 minutes for LLM operations
  circuitBreakerConfig: {
    failureThreshold: 3,
    resetTimeout: 120000
  },
  cacheConfig: {
    enabled: true,
    ttl: 600000 // 10 minutes for LLM responses
  }
});
