/**
 * Enterprise Distributed Tracing Implementation
 * Provides comprehensive tracing using OpenTelemetry and Jaeger
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { trace, context, SpanStatusCode, SpanKind, Span } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface TraceContext {
  traceId: string;
  spanId: string;
  correlationId: string;
  userId?: string;
  operation: string;
}

export interface SpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
  tags?: Record<string, string>;
  userId?: string;
  correlationId?: string;
}

export class EnterpriseTracing {
  private sdk?: NodeSDK;
  private tracer = trace.getTracer('backend-service', '1.0.0');
  private isInitialized: boolean = false;

  /**
   * Initialize distributed tracing
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Tracing already initialized');
      return;
    }

    try {
      const serviceName = 'backend-service';
      const serviceVersion = '1.0.0';
      const environment = process.env.NODE_ENV || 'development';

      // Create Jaeger exporter
      const jaegerExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
      });

      // Create resource
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'enterprise-platform',
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
      });

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        spanProcessor: new BatchSpanProcessor(jaegerExporter, {
          maxQueueSize: 1000,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
          maxExportBatchSize: 512,
        }) as any,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable file system instrumentation for performance
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              requestHook: (span: any, request: any) => {
                span.setAttributes({
                  'http.request.body.size': (request.headers && request.headers['content-length']) || 0,
                  'http.user_agent': (request.headers && request.headers['user-agent']) || 'unknown',
                });
              },
              responseHook: (span: any, response: any) => {
                span.setAttributes({
                  'http.response.body.size': (response.headers && response.headers['content-length']) || 0,
                });
              },
            },
            '@opentelemetry/instrumentation-express': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-redis': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-pg': {
              enabled: true,
            },
          }),
        ],
      });

      // Start the SDK
      await this.sdk.start();
      
      this.isInitialized = true;
      logger.info('Distributed tracing initialized successfully', {
        serviceName,
        serviceVersion,
        environment,
        jaegerEndpoint: process.env.JAEGER_ENDPOINT
      });

    } catch (error) {
      logger.error('Failed to initialize distributed tracing:', error);
      throw error;
    }
  }

  /**
   * Create a new span
   */
  createSpan(name: string, options: SpanOptions = {}): Span {
    const {
      kind = SpanKind.INTERNAL,
      attributes = {},
      tags = {},
      userId,
      correlationId
    } = options;

    const span = this.tracer.startSpan(name, {
      kind,
      attributes: {
        ...attributes,
        'service.name': 'backend-service',
        'service.version': '1.0.0',
        ...(userId && { 'user.id': userId }),
        ...(correlationId && { 'correlation.id': correlationId }),
        ...tags
      }
    });

    return span;
  }

  /**
   * Execute function with tracing
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options: SpanOptions = {}
  ): Promise<T> {
    const span = this.createSpan(name, options);
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return await fn(span);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      });
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Trace Telegram message processing
   */
  async traceTelegramMessage<T>(
    messageType: string,
    userId: string,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const correlationId = uuidv4();
    
    return this.withSpan(
      `telegram.message.${messageType}`,
      async (span) => {
        span.setAttributes({
          'telegram.message.type': messageType,
          'telegram.user.id': userId,
          'correlation.id': correlationId,
          'operation.type': 'message_processing'
        });

        return await fn(span);
      },
      {
        kind: SpanKind.SERVER,
        userId,
        correlationId
      }
    );
  }

  /**
   * Trace LLM service calls
   */
  async traceLLMCall<T>(
    model: string,
    operation: string,
    fn: (span: Span) => Promise<T>,
    options: {
      userId?: string;
      prompt?: string;
      maxTokens?: number;
    } = {}
  ): Promise<T> {
    const { userId, prompt, maxTokens } = options;
    
    return this.withSpan(
      `llm.${operation}`,
      async (span) => {
        span.setAttributes({
          'llm.model': model,
          'llm.operation': operation,
          'llm.prompt.length': prompt?.length || 0,
          'llm.max_tokens': maxTokens || 0,
          ...(userId && { 'user.id': userId })
        });

        const startTime = Date.now();
        
        try {
          const result = await fn(span);
          
          const duration = Date.now() - startTime;
          span.setAttributes({
            'llm.response.duration_ms': duration,
            'llm.response.success': true
          });

          return result;

        } catch (error) {
          const duration = Date.now() - startTime;
          span.setAttributes({
            'llm.response.duration_ms': duration,
            'llm.response.success': false,
            'llm.error.type': (error as Error).name,
            'llm.error.message': (error as Error).message
          });
          throw error;
        }
      },
      {
        kind: SpanKind.CLIENT,
        ...(userId ? { userId } : {})
      }
    );
  }

  /**
   * Trace backend service calls
   */
  async traceBackendCall<T>(
    endpoint: string,
    method: string,
    fn: (span: Span) => Promise<T>,
    options: {
      userId?: string;
      requestBody?: any;
    } = {}
  ): Promise<T> {
    const { userId, requestBody } = options;
    
    return this.withSpan(
      `backend.${endpoint}`,
      async (span) => {
        span.setAttributes({
          'http.method': method,
          'http.url': endpoint,
          'http.request.body.size': JSON.stringify(requestBody || {}).length,
          ...(userId && { 'user.id': userId })
        });

        const startTime = Date.now();
        
        try {
          const result = await fn(span);
          
          const duration = Date.now() - startTime;
          span.setAttributes({
            'http.response.duration_ms': duration,
            'http.response.success': true
          });

          return result;

        } catch (error) {
          const duration = Date.now() - startTime;
          span.setAttributes({
            'http.response.duration_ms': duration,
            'http.response.success': false,
            'http.error.type': (error as Error).name,
            'http.error.message': (error as Error).message
          });
          throw error;
        }
      },
      {
        kind: SpanKind.CLIENT,
        ...(userId ? { userId } : {})
      }
    );
  }

  /**
   * Trace database operations
   */
  async traceDatabase<T>(
    operation: string,
    table: string,
    fn: (span: Span) => Promise<T>,
    options: {
      query?: string;
      userId?: string;
    } = {}
  ): Promise<T> {
    const { query, userId } = options;
    
    return this.withSpan(
      `db.${operation}`,
      async (span) => {
        span.setAttributes({
          'db.operation': operation,
          'db.table': table,
          'db.system': 'postgresql',
          ...(query && { 'db.statement': query }),
          ...(userId && { 'user.id': userId })
        });

        const startTime = Date.now();
        
        try {
          const result = await fn(span);
          
          const duration = Date.now() - startTime;
          span.setAttributes({
            'db.duration_ms': duration,
            'db.success': true
          });

          return result;

        } catch (error) {
          const duration = Date.now() - startTime;
          span.setAttributes({
            'db.duration_ms': duration,
            'db.success': false,
            'db.error.type': (error as Error).name,
            'db.error.message': (error as Error).message
          });
          throw error;
        }
      },
      {
        kind: SpanKind.CLIENT,
        ...(userId ? { userId } : {})
      }
    );
  }

  /**
   * Trace cache operations
   */
  async traceCache<T>(
    operation: string,
    key: string,
    fn: (span: Span) => Promise<T>,
    options: {
      userId?: string;
      ttl?: number;
    } = {}
  ): Promise<T> {
    const { userId, ttl } = options;
    
    return this.withSpan(
      `cache.${operation}`,
      async (span) => {
        span.setAttributes({
          'cache.operation': operation,
          'cache.key': key,
          'cache.system': 'redis',
          ...(ttl && { 'cache.ttl': ttl }),
          ...(userId && { 'user.id': userId })
        });

        const startTime = Date.now();
        
        try {
          const result = await fn(span);
          
          const duration = Date.now() - startTime;
          span.setAttributes({
            'cache.duration_ms': duration,
            'cache.success': true,
            'cache.hit': operation === 'get' && result !== null
          });

          return result;

        } catch (error) {
          const duration = Date.now() - startTime;
          span.setAttributes({
            'cache.duration_ms': duration,
            'cache.success': false,
            'cache.error.type': (error as Error).name,
            'cache.error.message': (error as Error).message
          });
          throw error;
        }
      },
      {
        kind: SpanKind.CLIENT,
        ...(userId ? { userId } : {})
      }
    );
  }

  /**
   * Get current trace context
   */
  getCurrentTraceContext(): TraceContext | null {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) return null;

    const spanContext = activeSpan.spanContext();
    
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      correlationId: uuidv4(),
      operation: 'unknown'
    };
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(name, attributes);
    }
  }

  /**
   * Set attribute on current span
   */
  setAttribute(key: string, value: string | number | boolean): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(key, value);
    }
  }

  /**
   * Record exception on current span
   */
  recordException(error: Error): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.recordException(error);
    }
  }

  /**
   * Check if tracing is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown tracing
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.isInitialized = false;
        logger.info('Distributed tracing shutdown completed');
      } catch (error) {
        logger.error('Error shutting down tracing:', error);
        throw error;
      }
    }
  }
}

// Singleton instance
export const tracing = new EnterpriseTracing();
