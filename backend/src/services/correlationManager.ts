/**
 * Correlation Manager - 2025 Edition
 * Enterprise-grade correlation ID management for distributed tracing:
 * - Request correlation across all services
 * - Context propagation and inheritance
 * - Trace correlation with OpenTelemetry
 * - Cross-service error correlation
 * - Performance tracking and analytics
 */

import { AsyncLocalStorage } from 'async_hooks';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';

// Correlation Context Interface
export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  service: string;
  operation?: string;
  startTime: number;
  metadata?: Record<string, any>;
  tags?: string[];
}

// Request Context for HTTP requests
export interface RequestContext extends CorrelationContext {
  method: string;
  url: string;
  userAgent?: string;
  ipAddress?: string;
  headers: Record<string, string>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  body?: any;
}

// Service Context for inter-service communication
export interface ServiceContext extends CorrelationContext {
  sourceService: string;
  targetService: string;
  operationType: 'http' | 'grpc' | 'message' | 'database' | 'cache';
  timeout?: number;
  retryCount?: number;
}

/**
 * Enterprise Correlation Manager
 */
export class CorrelationManager extends EventEmitter {
  private static instance: CorrelationManager;
  private asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();
  private tracer = trace.getTracer('correlation-manager', '1.0.0');
  private activeContexts = new Map<string, CorrelationContext>();
  private contextMetrics = {
    created: 0,
    destroyed: 0,
    active: 0,
    maxActive: 0,
    averageLifetime: 0
  };
  private cleanupIntervalId?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  static getInstance(): CorrelationManager {
    if (!CorrelationManager.instance) {
      CorrelationManager.instance = new CorrelationManager();
    }
    return CorrelationManager.instance;
  }

  /**
   * Generate new correlation ID
   */
  generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const service = process.env.SERVICE_NAME?.substr(0, 3) || 'unk';
    return `${service}_${timestamp}_${random}`;
  }

  /**
   * Generate request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create new correlation context
   */
  createContext(config: Partial<CorrelationContext> & { service: string }): CorrelationContext {
    const correlationId = config.correlationId || this.generateCorrelationId();
    const requestId = this.generateRequestId();
    
    // Get OpenTelemetry trace information
    const span = trace.getActiveSpan();
    const traceId = span?.spanContext().traceId || config.traceId;
    const spanId = span?.spanContext().spanId || config.spanId;

    const context: CorrelationContext = {
      correlationId,
      traceId,
      spanId,
      parentSpanId: config.parentSpanId,
      userId: config.userId,
      sessionId: config.sessionId,
      requestId,
      service: config.service,
      operation: config.operation,
      startTime: Date.now(),
      metadata: config.metadata || {},
      tags: config.tags || []
    };

    // Store context for tracking
    this.activeContexts.set(correlationId, context);
    this.updateMetrics('created');

    this.emit('context:created', context);
    return context;
  }

  /**
   * Set current correlation context
   */
  setContext(context: CorrelationContext): void {
    this.asyncLocalStorage.enterWith(context);
    this.activeContexts.set(context.correlationId, context);
    this.emit('context:set', context);
  }

  /**
   * Get current correlation context
   */
  getContext(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get correlation ID from current context
   */
  getCorrelationId(): string | undefined {
    const context = this.getContext();
    return context?.correlationId;
  }

  /**
   * Get trace ID from current context
   */
  getTraceId(): string | undefined {
    const context = this.getContext();
    return context?.traceId;
  }

  /**
   * Get user ID from current context
   */
  getUserId(): string | undefined {
    const context = this.getContext();
    return context?.userId;
  }

  /**
   * Update context metadata
   */
  updateContext(updates: Partial<CorrelationContext>): void {
    const currentContext = this.getContext();
    if (!currentContext) {
      return;
    }

    const updatedContext: CorrelationContext = {
      ...currentContext,
      ...updates,
      metadata: {
        ...currentContext.metadata,
        ...updates.metadata
      },
      tags: updates.tags ? [...(currentContext.tags || []), ...updates.tags] : currentContext.tags
    };

    this.setContext(updatedContext);
    this.emit('context:updated', updatedContext);
  }

  /**
   * Add metadata to current context
   */
  addMetadata(key: string, value: any): void {
    const context = this.getContext();
    if (context) {
      context.metadata = context.metadata || {};
      context.metadata[key] = value;
      this.emit('context:metadata_added', context, key, value);
    }
  }

  /**
   * Add tags to current context
   */
  addTags(...tags: string[]): void {
    const context = this.getContext();
    if (context) {
      context.tags = context.tags || [];
      context.tags.push(...tags);
      this.emit('context:tags_added', context, tags);
    }
  }

  /**
   * Create child context for nested operations
   */
  createChildContext(operation: string, metadata?: Record<string, any>): CorrelationContext {
    const parentContext = this.getContext();
    if (!parentContext) {
      throw new Error('No parent context available for child context creation');
    }

    const childContext = this.createContext({
      correlationId: parentContext.correlationId, // Inherit correlation ID
      parentSpanId: parentContext.spanId,
      userId: parentContext.userId,
      sessionId: parentContext.sessionId,
      service: parentContext.service,
      operation,
      metadata: {
        ...parentContext.metadata,
        ...metadata,
        parentOperation: parentContext.operation
      },
      tags: [...(parentContext.tags || [])]
    });

    return childContext;
  }

  /**
   * Execute function with correlation context
   */
  async runWithContext<T>(context: CorrelationContext, fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.asyncLocalStorage.run(context, async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Execute function with new correlation context
   */
  async runWithNewContext<T>(
    config: Partial<CorrelationContext> & { service: string },
    fn: () => Promise<T>
  ): Promise<T> {
    const context = this.createContext(config);
    return this.runWithContext(context, fn);
  }

  /**
   * Destroy correlation context
   */
  destroyContext(correlationId?: string): void {
    const targetId = correlationId || this.getCorrelationId();
    if (!targetId) {
      return;
    }

    const context = this.activeContexts.get(targetId);
    if (context) {
      const lifetime = Date.now() - context.startTime;
      this.updateMetrics('destroyed', lifetime);
      this.activeContexts.delete(targetId);
      this.emit('context:destroyed', context, lifetime);
    }
  }

  /**
   * Get context by correlation ID
   */
  getContextById(correlationId: string): CorrelationContext | undefined {
    return this.activeContexts.get(correlationId);
  }

  /**
   * Get all active contexts
   */
  getActiveContexts(): CorrelationContext[] {
    return Array.from(this.activeContexts.values());
  }

  /**
   * Get context metrics
   */
  getMetrics(): typeof this.contextMetrics {
    return { ...this.contextMetrics };
  }

  /**
   * Update context metrics
   */
  private updateMetrics(operation: 'created' | 'destroyed', lifetime?: number): void {
    if (operation === 'created') {
      this.contextMetrics.created++;
      this.contextMetrics.active++;
      this.contextMetrics.maxActive = Math.max(this.contextMetrics.maxActive, this.contextMetrics.active);
    } else if (operation === 'destroyed') {
      this.contextMetrics.destroyed++;
      this.contextMetrics.active = Math.max(0, this.contextMetrics.active - 1);
      
      if (lifetime) {
        const totalLifetime = this.contextMetrics.averageLifetime * (this.contextMetrics.destroyed - 1) + lifetime;
        this.contextMetrics.averageLifetime = totalLifetime / this.contextMetrics.destroyed;
      }
    }
  }

  /**
   * Setup cleanup interval for stale contexts
   */
  private setupCleanupInterval(): void {
    const cleanupInterval = parseInt(process.env.CORRELATION_CLEANUP_INTERVAL || '300000'); // 5 minutes

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleContexts();
    }, cleanupInterval);
  }

  /**
   * Cleanup stale contexts
   */
  private cleanupStaleContexts(): void {
    const maxAge = parseInt(process.env.CORRELATION_MAX_AGE || '3600000'); // 1 hour
    const now = Date.now();
    let cleanedCount = 0;

    for (const [correlationId, context] of this.activeContexts.entries()) {
      if (now - context.startTime > maxAge) {
        this.destroyContext(correlationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} stale correlation contexts`);
      this.emit('contexts:cleaned', cleanedCount);
    }
  }

  /**
   * Create Express middleware for correlation
   */
  createExpressMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string || this.generateCorrelationId();
      const requestId = this.generateRequestId();
      
      // Extract user information from request
      const userId = (req as any).user?.id || (req as any).userId;
      const sessionId = (req as any).sessionID || req.headers['x-session-id'] as string;

      const requestContext: RequestContext = {
        correlationId,
        requestId,
        userId,
        sessionId,
        service: process.env.SERVICE_NAME || 'backend',
        operation: `${req.method} ${req.path}`,
        startTime: Date.now(),
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
        headers: req.headers as Record<string, string>,
        query: req.query as Record<string, any>,
        params: req.params,
        body: req.method !== 'GET' ? req.body : undefined,
        metadata: {
          httpVersion: req.httpVersion,
          protocol: req.protocol,
          secure: req.secure
        },
        tags: ['http', 'express']
      };

      // Set correlation ID in response headers
      res.setHeader('X-Correlation-ID', correlationId);
      res.setHeader('X-Request-ID', requestId);

      // Store context and continue
      this.asyncLocalStorage.run(requestContext, () => {
        this.activeContexts.set(correlationId, requestContext);
        this.updateMetrics('created');

        // Cleanup on response finish
        res.on('finish', () => {
          this.destroyContext(correlationId);
        });

        next();
      });
    };
  }

  /**
   * Create headers for outgoing requests
   */
  createOutgoingHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const context = this.getContext();
    const headers: Record<string, string> = {
      ...additionalHeaders
    };

    if (context) {
      headers['X-Correlation-ID'] = context.correlationId;
      if (context.traceId) headers['X-Trace-ID'] = context.traceId;
      if (context.spanId) headers['X-Span-ID'] = context.spanId;
      if (context.userId) headers['X-User-ID'] = context.userId;
      if (context.sessionId) headers['X-Session-ID'] = context.sessionId;
      headers['X-Source-Service'] = context.service;
    }

    return headers;
  }

  /**
   * Clear all contexts (for testing)
   */
  clearContext(): void {
    this.activeContexts.clear();
    this.contextMetrics = {
      created: 0,
      destroyed: 0,
      active: 0,
      maxActive: 0,
      averageLifetime: 0
    };

    // Clear cleanup interval to prevent memory leaks
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    this.emit('contexts:cleared');
  }

  /**
   * Shutdown correlation manager and cleanup resources
   */
  shutdown(): void {
    this.clearContext();
    this.removeAllListeners();
  }

  /**
   * Reset singleton instance (for testing only)
   */
  static resetInstance(): void {
    if (CorrelationManager.instance) {
      CorrelationManager.instance.shutdown();
      CorrelationManager.instance = undefined as any;
    }
  }
}

// Export singleton instance
export const correlationManager = CorrelationManager.getInstance();
