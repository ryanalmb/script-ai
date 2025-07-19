/**
 * Enhanced API Client - 2025 Edition
 * Builds upon existing HTTP clients with enterprise-grade features:
 * - Intelligent routing and load balancing
 * - Distributed tracing with OpenTelemetry
 * - Advanced retry strategies
 * - Request/response caching
 * - Automatic failover and circuit breaking
 */

import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { cacheManager } from '../lib/cache';
import { enterpriseServiceRegistry, ServiceRequest, ServiceResponse } from './enterpriseServiceRegistry';

interface EnhancedRequestConfig extends ServiceRequest {
  cacheKey?: string;
  cacheTTL?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  fallbackData?: any;
  enableFallback?: boolean;
  correlationId?: string;
}

interface RequestContext {
  startTime: number;
  correlationId: string;
  traceId: string;
  spanId: string;
  retryCount: number;
  serviceName: string;
}

/**
 * Enhanced API Client with enterprise capabilities
 */
export class EnhancedApiClient {
  private tracer = trace.getTracer('enhanced-api-client', '1.0.0');
  private requestQueue = new Map<string, Promise<any>>(); // Deduplication
  private rateLimiters = new Map<string, RateLimiter>();

  constructor() {
    this.initializeRateLimiters();
  }

  /**
   * Execute request with full enterprise features
   */
  async request<T>(serviceName: string, config: EnhancedRequestConfig): Promise<ServiceResponse<T>> {
    const span = this.tracer.startSpan(`api_request_${serviceName}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'service.name': serviceName,
        'http.method': config.method,
        'http.url': config.endpoint,
        'request.priority': config.priority || 'normal'
      }
    });

    const requestContext: RequestContext = {
      startTime: Date.now(),
      correlationId: config.correlationId || this.generateCorrelationId(),
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      retryCount: 0,
      serviceName
    };

    try {
      // Check rate limiting
      await this.checkRateLimit(serviceName, config.priority || 'normal');

      // Try cache first (for GET requests)
      if (config.method === 'GET' && config.cacheKey) {
        const cachedResponse = await this.getCachedResponse<T>(config.cacheKey);
        if (cachedResponse) {
          span.setAttributes({ 'cache.hit': true });
          span.setStatus({ code: SpanStatusCode.OK });
          
          return {
            success: true,
            data: cachedResponse,
            responseTime: Date.now() - requestContext.startTime,
            fromCache: true,
            serviceUsed: serviceName,
            traceId: requestContext.traceId,
            spanId: requestContext.spanId
          };
        }
      }

      // Deduplicate identical requests
      const deduplicationKey = this.getDeduplicationKey(serviceName, config);
      if (this.requestQueue.has(deduplicationKey)) {
        logger.debug(`Deduplicating request: ${deduplicationKey}`);
        const existingRequest = this.requestQueue.get(deduplicationKey)!;
        return await existingRequest;
      }

      // Execute request with service registry
      const requestPromise = this.executeWithServiceRegistry<T>(serviceName, config, requestContext, span);
      this.requestQueue.set(deduplicationKey, requestPromise);

      try {
        const result = await requestPromise;
        
        // Cache successful GET responses
        if (result.success && config.method === 'GET' && config.cacheKey) {
          await this.cacheResponse(config.cacheKey, result.data, config.cacheTTL || 300);
        }

        return result;
      } finally {
        this.requestQueue.delete(deduplicationKey);
      }

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      
      // Try fallback if enabled
      if (config.enableFallback && config.fallbackData) {
        logger.warn(`Using fallback data for ${serviceName}:${config.endpoint}`);
        return {
          success: true,
          data: config.fallbackData,
          responseTime: Date.now() - requestContext.startTime,
          fromCache: false,
          serviceUsed: `${serviceName}-fallback`,
          traceId: requestContext.traceId,
          spanId: requestContext.spanId
        };
      }

      return {
        success: false,
        error: (error as Error).message,
        responseTime: Date.now() - requestContext.startTime,
        fromCache: false,
        serviceUsed: serviceName,
        traceId: requestContext.traceId,
        spanId: requestContext.spanId
      };
    } finally {
      span.end();
    }
  }

  /**
   * Execute request through service registry
   */
  private async executeWithServiceRegistry<T>(
    serviceName: string,
    config: EnhancedRequestConfig,
    requestContext: RequestContext,
    span: any
  ): Promise<ServiceResponse<T>> {
    // Add tracing headers
    const enhancedHeaders = {
      ...config.headers,
      'X-Correlation-ID': requestContext.correlationId,
      'X-Trace-ID': requestContext.traceId,
      'X-Span-ID': requestContext.spanId,
      'X-Request-Priority': config.priority || 'normal'
    };

    const serviceRequest: ServiceRequest = {
      method: config.method,
      endpoint: config.endpoint,
      data: config.data,
      headers: enhancedHeaders,
      timeout: config.timeout,
      retries: config.retries,
      circuitBreaker: config.circuitBreaker,
      tracing: config.tracing
    };

    return await enterpriseServiceRegistry.executeRequest<T>(serviceName, serviceRequest);
  }

  /**
   * Check rate limiting for service
   */
  private async checkRateLimit(serviceName: string, priority: string): Promise<void> {
    const rateLimiter = this.rateLimiters.get(serviceName);
    if (!rateLimiter) {
      return; // No rate limiting configured
    }

    const allowed = await rateLimiter.checkLimit(priority);
    if (!allowed) {
      throw new Error(`Rate limit exceeded for service ${serviceName}`);
    }
  }

  /**
   * Get cached response
   */
  private async getCachedResponse<T>(cacheKey: string): Promise<T | null> {
    try {
      return await cacheManager.get<T>(`api_cache:${cacheKey}`);
    } catch (error) {
      logger.warn(`Cache get error for key ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Cache response
   */
  private async cacheResponse(cacheKey: string, data: any, ttl: number): Promise<void> {
    try {
      await cacheManager.set(`api_cache:${cacheKey}`, data, ttl);
    } catch (error) {
      logger.warn(`Cache set error for key ${cacheKey}:`, error);
    }
  }

  /**
   * Generate deduplication key
   */
  private getDeduplicationKey(serviceName: string, config: EnhancedRequestConfig): string {
    const dataHash = config.data ? JSON.stringify(config.data) : '';
    return `${serviceName}:${config.method}:${config.endpoint}:${dataHash}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize rate limiters for services
   */
  private initializeRateLimiters(): void {
    // Configure rate limiters based on service priority
    const services = ['llm-service', 'telegram-bot', 'frontend'];
    
    services.forEach(serviceName => {
      this.rateLimiters.set(serviceName, new RateLimiter({
        windowMs: 60000, // 1 minute
        limits: {
          low: 10,
          normal: 50,
          high: 100,
          critical: 200
        }
      }));
    });
  }

  /**
   * Convenience methods for common HTTP operations
   */
  async get<T>(serviceName: string, endpoint: string, config?: Partial<EnhancedRequestConfig>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'GET',
      endpoint,
      ...config
    });
  }

  async post<T>(serviceName: string, endpoint: string, data?: any, config?: Partial<EnhancedRequestConfig>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'POST',
      endpoint,
      data,
      ...config
    });
  }

  async put<T>(serviceName: string, endpoint: string, data?: any, config?: Partial<EnhancedRequestConfig>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'PUT',
      endpoint,
      data,
      ...config
    });
  }

  async delete<T>(serviceName: string, endpoint: string, config?: Partial<EnhancedRequestConfig>): Promise<ServiceResponse<T>> {
    return this.request<T>(serviceName, {
      method: 'DELETE',
      endpoint,
      ...config
    });
  }
}

/**
 * Simple rate limiter implementation
 */
class RateLimiter {
  private requests = new Map<string, number[]>();
  private config: {
    windowMs: number;
    limits: Record<string, number>;
  };

  constructor(config: { windowMs: number; limits: Record<string, number> }) {
    this.config = config;
  }

  async checkLimit(priority: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const limit = this.config.limits[priority] || this.config.limits.normal || 100; // Default fallback

    // Clean old requests
    const requests = this.requests.get(priority) || [];
    const validRequests = requests.filter(time => time > windowStart);

    if (validRequests.length >= limit) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(priority, validRequests);
    return true;
  }
}

// Export singleton instance
export const enhancedApiClient = new EnhancedApiClient();
