/**
 * OpenTelemetry Configuration - 2025 Edition
 * Enterprise-grade distributed tracing and observability setup
 * Integrates with existing logging infrastructure
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { logger } from '../utils/logger';

interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  prometheusPort?: number;
  enableConsoleExporter?: boolean;
  enableJaegerExporter?: boolean;
  enablePrometheusExporter?: boolean;
  sampleRate?: number;
}

/**
 * Enterprise Telemetry Manager
 */
export class TelemetryManager {
  private sdk: NodeSDK | null = null;
  private config: TelemetryConfig;
  private isInitialized = false;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      serviceName: process.env.SERVICE_NAME || 'x-marketing-backend',
      serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090'),
      enableConsoleExporter: process.env.OTEL_CONSOLE_EXPORTER === 'true',
      enableJaegerExporter: process.env.OTEL_JAEGER_EXPORTER !== 'false',
      enablePrometheusExporter: process.env.OTEL_PROMETHEUS_EXPORTER !== 'false',
      sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE || '0.1'),
      ...config
    };
  }

  /**
   * Initialize OpenTelemetry with enterprise configuration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Telemetry already initialized');
      return;
    }

    try {
      logger.info('🔍 Initializing OpenTelemetry...');

      // Create resource with service information
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'x-marketing-platform',
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
      });

      // Configure span processors
      const spanProcessors = this.createSpanProcessors();

      // Configure metric readers
      const metricReaders = this.createMetricReaders();

      // Create SDK with auto-instrumentations
      this.sdk = new NodeSDK({
        resource,
        spanProcessors: spanProcessors as any,
        metricReader: metricReaders.length > 0 ? metricReaders[0] as any : undefined,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Disable some instrumentations that might be too verbose
            '@opentelemetry/instrumentation-fs': {
              enabled: false,
            },
            '@opentelemetry/instrumentation-dns': {
              enabled: false,
            },
            // Configure HTTP instrumentation
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              requestHook: (span, request) => {
                const attributes: any = {};
                if ('getHeader' in request && typeof request.getHeader === 'function') {
                  attributes['http.request.header.user-agent'] = request.getHeader('user-agent');
                  attributes['http.request.header.x-correlation-id'] = request.getHeader('x-correlation-id');
                }
                span.setAttributes(attributes);
              },
              responseHook: (span, response) => {
                const attributes: any = {};
                if ('getHeader' in response && typeof response.getHeader === 'function') {
                  attributes['http.response.header.content-type'] = response.getHeader('content-type');
                }
                span.setAttributes(attributes);
              },
            },
            // Configure Express instrumentation
            '@opentelemetry/instrumentation-express': {
              enabled: true,
            },
            // Configure database instrumentations
            '@opentelemetry/instrumentation-pg': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-redis': {
              enabled: true,
            },
          }),
        ],
      });

      // Start the SDK
      await this.sdk.start();

      this.isInitialized = true;
      logger.info('✅ OpenTelemetry initialized successfully', {
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        jaegerEnabled: this.config.enableJaegerExporter,
        prometheusEnabled: this.config.enablePrometheusExporter,
      });

    } catch (error) {
      logger.error('❌ Failed to initialize OpenTelemetry:', error);
      throw error;
    }
  }

  /**
   * Create span processors for different exporters
   */
  private createSpanProcessors(): BatchSpanProcessor[] {
    const processors: BatchSpanProcessor[] = [];

    // Jaeger exporter for distributed tracing
    if (this.config.enableJaegerExporter) {
      try {
        const jaegerExporter = new JaegerExporter({
          ...(this.config.jaegerEndpoint && { endpoint: this.config.jaegerEndpoint }),
        });
        
        processors.push(new BatchSpanProcessor(jaegerExporter, {
          maxQueueSize: 1000,
          maxExportBatchSize: 100,
          scheduledDelayMillis: 5000,
        }));
        
        logger.info(`📊 Jaeger exporter configured: ${this.config.jaegerEndpoint}`);
      } catch (error) {
        logger.warn('Failed to configure Jaeger exporter:', error);
      }
    }

    // Console exporter for development
    if (this.config.enableConsoleExporter && this.config.environment === 'development') {
      const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-node');
      processors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
      logger.info('🖥️ Console span exporter enabled for development');
    }

    return processors;
  }

  /**
   * Create metric readers for different exporters
   */
  private createMetricReaders(): PeriodicExportingMetricReader[] {
    const readers: PeriodicExportingMetricReader[] = [];

    // Prometheus exporter for metrics
    if (this.config.enablePrometheusExporter) {
      try {
        const prometheusExporter = new PrometheusExporter({
          ...(this.config.prometheusPort && { port: this.config.prometheusPort }),
          endpoint: '/metrics',
        });

        // Note: PrometheusExporter doesn't use PeriodicExportingMetricReader
        // It starts its own HTTP server
        logger.info(`📈 Prometheus metrics available at http://localhost:${this.config.prometheusPort}/metrics`);
      } catch (error) {
        logger.warn('Failed to configure Prometheus exporter:', error);
      }
    }

    return readers;
  }

  /**
   * Create custom span with enterprise attributes
   */
  createSpan(name: string, attributes: Record<string, any> = {}) {
    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion);
    
    return tracer.startSpan(name, {
      attributes: {
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion,
        'service.environment': this.config.environment,
        ...attributes,
      },
    });
  }

  /**
   * Add custom metrics
   */
  recordMetric(name: string, value: number, attributes: Record<string, any> = {}) {
    try {
      const { metrics } = require('@opentelemetry/api');
      const meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion);
      
      const counter = meter.createCounter(name, {
        description: `Custom metric: ${name}`,
      });
      
      counter.add(value, attributes);
    } catch (error) {
      logger.warn(`Failed to record metric ${name}:`, error);
    }
  }

  /**
   * Get telemetry configuration
   */
  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  /**
   * Check if telemetry is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk && this.isInitialized) {
      try {
        await this.sdk.shutdown();
        this.isInitialized = false;
        logger.info('🔍 OpenTelemetry shutdown completed');
      } catch (error) {
        logger.error('Error shutting down OpenTelemetry:', error);
      }
    }
  }
}

// Create singleton instance
export const telemetryManager = new TelemetryManager();

/**
 * Initialize telemetry for the application
 */
export async function initializeTelemetry(config?: Partial<TelemetryConfig>): Promise<void> {
  if (config) {
    // Create new instance with custom config
    const customTelemetry = new TelemetryManager(config);
    await customTelemetry.initialize();
  } else {
    // Use singleton instance
    await telemetryManager.initialize();
  }
}

/**
 * Middleware to add tracing to Express routes
 */
export function tracingMiddleware() {
  return (req: any, res: any, next: any) => {
    const { trace, context } = require('@opentelemetry/api');
    
    // Get the current span from auto-instrumentation
    const span = trace.getActiveSpan();
    
    if (span) {
      // Add custom attributes
      span.setAttributes({
        'http.route': req.route?.path || req.path,
        'user.id': req.user?.id,
        'user.telegram_id': req.user?.telegramId,
        'request.correlation_id': req.headers['x-correlation-id'],
      });
      
      // Add correlation ID to response headers
      const correlationId = req.headers['x-correlation-id'] || 
                           `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Correlation-ID', correlationId);
      res.setHeader('X-Trace-ID', span.spanContext().traceId);
    }
    
    next();
  };
}

/**
 * Utility function to create traced async operations
 */
export function traced<T>(
  name: string, 
  operation: () => Promise<T>, 
  attributes: Record<string, any> = {}
): Promise<T> {
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer('x-marketing-backend', '1.0.0');
  
  return tracer.startActiveSpan(name, { attributes }, async (span: any) => {
    try {
      const result = await operation();
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}
