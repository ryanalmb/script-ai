/**
 * Enterprise Event Bus Implementation
 * Provides reliable, scalable event-driven communication using Kafka
 */

import { Kafka, Producer, Consumer, EachMessagePayload, KafkaConfig } from 'kafkajs';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Event Types
export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  correlationId: string;
  source: string;
  version: string;
}

export interface TelegramEvent extends BaseEvent {
  type: 'telegram.message' | 'telegram.callback' | 'telegram.command' | 'telegram.error' | 'telegram.webhook';
  userId: number;
  data: any;
  metadata?: Record<string, any> | undefined;
}

export interface UserEvent extends BaseEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'user.activity';
  userId: number;
  action: string;
  metadata: Record<string, any>;
}

export interface ContentEvent extends BaseEvent {
  type: 'content.generated' | 'content.failed' | 'content.cached';
  userId: number;
  contentType: string;
  data: any;
  metadata?: Record<string, any> | undefined;
}

export interface SystemEvent extends BaseEvent {
  type: 'system.health' | 'system.error' | 'system.metric' | 'system.campaign';
  service: string;
  data: any;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export type Event = TelegramEvent | UserEvent | ContentEvent | SystemEvent;

// Event Handler Type
export type EventHandler<T extends Event = Event> = (event: T) => Promise<void>;

// Topic Configuration
export const TOPICS = {
  TELEGRAM_EVENTS: 'telegram-events',
  USER_EVENTS: 'user-events',
  CONTENT_EVENTS: 'content-events',
  ANALYTICS_EVENTS: 'analytics-events',
  SYSTEM_EVENTS: 'system-events',
  ERROR_EVENTS: 'error-events'
} as const;

export class EnterpriseEventBus extends EventEmitter {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;

  constructor(config?: Partial<KafkaConfig>) {
    super();

    // Parse Kafka brokers from environment
    const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',').map(b => b.trim()) || ['localhost:9092'];
    logger.info('Kafka brokers configuration:', { brokers: kafkaBrokers, env: process.env.KAFKA_BROKERS });

    const defaultConfig: KafkaConfig = {
      clientId: 'telegram-bot-service',
      brokers: kafkaBrokers,
      connectionTimeout: 30000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 5, // Limit retries to prevent infinite loops
        maxRetryTime: 30000,
        factor: 2,
        multiplier: 2,
        restartOnFailure: async (e: Error) => {
          logger.error('Kafka restart on failure:', e);
          return false; // Don't restart automatically to prevent crash loops
        }
      },
      logLevel: 4, // ERROR level to suppress warnings
    };

    this.kafka = new Kafka({ ...defaultConfig, ...config });
    // Use recommended idempotent producer configuration
    this.producer = this.kafka.producer({
      maxInFlightRequests: 5,
      idempotent: true,
      retry: {
        retries: Number.MAX_SAFE_INTEGER, // Unlimited retries for idempotent producer
        initialRetryTime: 300,
        maxRetryTime: 10000
      }
    });

    this.setupErrorHandlers();
  }

  /**
   * Initialize the event bus
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Enterprise Event Bus...');

      // Add timeout to prevent hanging
      const connectPromise = this.producer.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Kafka connection timeout')), 10000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      await this.createTopics();

      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info('Enterprise Event Bus initialized successfully');
      this.emit('connected');

    } catch (error) {
      logger.error('Failed to initialize Event Bus:', error);
      // Don't throw error to prevent container crash
      logger.warn('Continuing without Kafka event bus');
      this.isConnected = false;
    }
  }

  /**
   * Publish an event to the appropriate topic
   */
  async publish<T extends Event>(event: T): Promise<void> {
    if (!this.isConnected) {
      // Gracefully handle disconnected state instead of throwing
      logger.warn(`Event Bus not connected, skipping publish for event type: ${event.type}`);
      return;
    }

    try {
      const topic = this.getTopicForEventType(event.type);
      const message = {
        key: (event as any).userId?.toString() || event.id,
        value: JSON.stringify(event),
        timestamp: event.timestamp.getTime().toString(),
        headers: {
          'event-type': event.type,
          'correlation-id': event.correlationId,
          'source': event.source,
          'version': event.version
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.debug('Event published successfully', {
        eventId: event.id,
        eventType: event.type,
        topic,
        correlationId: event.correlationId
      });

      // Emit local event for immediate handlers
      this.emit(event.type, event);

    } catch (error) {
      logger.error('Failed to publish event:', error, {
        eventId: event.id,
        eventType: event.type
      });
      
      // Emit error event
      await this.publishSystemEvent('system.error', 'event-bus', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.id,
        eventType: event.type
      }, 'high');
      
      throw error;
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  async subscribe<T extends Event>(
    eventType: string,
    handler: EventHandler<T>,
    options: {
      groupId?: string;
      fromBeginning?: boolean;
      autoCommit?: boolean;
    } = {}
  ): Promise<void> {
    const {
      groupId = `telegram-bot-${eventType}-consumer`,
      fromBeginning = false,
      autoCommit = true
    } = options;

    try {
      const topic = this.getTopicForEventType(eventType);
      const consumer = this.kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxWaitTimeInMs: 5000,
        retry: {
          retries: 5,
          initialRetryTime: 300,
          maxRetryTime: 30000
        }
      });

      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning });

      await consumer.run({
        autoCommit,
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          try {
            if (!message.value) return;

            const event = JSON.parse(message.value.toString()) as T;
            
            // Add tracing information
            const correlationId = message.headers?.['correlation-id']?.toString() || event.correlationId;
            
            logger.debug('Processing event', {
              eventId: event.id,
              eventType: event.type,
              topic,
              partition,
              offset: message.offset,
              correlationId
            });

            // Execute handler with timeout
            await Promise.race([
              handler(event),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Handler timeout')), 30000)
              )
            ]);

            logger.debug('Event processed successfully', {
              eventId: event.id,
              eventType: event.type,
              correlationId
            });

          } catch (error) {
            logger.error('Error processing event:', error, {
              topic,
              partition,
              offset: message.offset,
              eventType
            });

            // Publish error event
            await this.publishSystemEvent('system.error', 'event-consumer', {
              error: error instanceof Error ? error.message : 'Unknown error',
              topic,
              partition,
              offset: message.offset,
              eventType
            }, 'high');

            // Don't throw - let Kafka handle retry logic
          }
        }
      });

      this.consumers.set(`${groupId}-${eventType}`, consumer);
      
      logger.info('Subscribed to events', {
        eventType,
        topic,
        groupId
      });

    } catch (error) {
      logger.error('Failed to subscribe to events:', error, {
        eventType,
        groupId
      });
      throw error;
    }
  }

  /**
   * Publish a Telegram event
   */
  async publishTelegramEvent(
    type: TelegramEvent['type'],
    userId: number,
    data: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: TelegramEvent = {
      id: uuidv4(),
      type,
      userId,
      data,
      metadata,
      timestamp: new Date(),
      correlationId: uuidv4(),
      source: 'telegram-bot',
      version: '1.0.0'
    };

    await this.publish(event);
  }

  /**
   * Publish a user event
   */
  async publishUserEvent(
    type: UserEvent['type'],
    userId: number,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type,
      userId,
      action,
      metadata,
      timestamp: new Date(),
      correlationId: uuidv4(),
      source: 'telegram-bot',
      version: '1.0.0'
    };

    await this.publish(event);
  }

  /**
   * Publish a content event
   */
  async publishContentEvent(
    type: ContentEvent['type'],
    userId: number,
    contentType: string,
    data: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: ContentEvent = {
      id: uuidv4(),
      type,
      userId,
      contentType,
      data,
      metadata,
      timestamp: new Date(),
      correlationId: uuidv4(),
      source: 'telegram-bot',
      version: '1.0.0'
    };

    await this.publish(event);
  }

  /**
   * Publish an LLM event
   */
  async publishLLMEvent(
    type: string,
    userId: number,
    model: string,
    operation: string,
    data: any,
    metadata?: Record<string, any> | undefined
  ): Promise<void> {
    const event: ContentEvent = {
      id: uuidv4(),
      type: 'content.generated',
      userId,
      contentType: model,
      data: {
        model,
        operation,
        ...data
      },
      metadata: metadata || undefined,
      timestamp: new Date(),
      correlationId: uuidv4(),
      source: 'telegram-bot',
      version: '1.0.0'
    };

    await this.publish(event);
  }

  /**
   * Publish a system event
   */
  async publishSystemEvent(
    type: SystemEvent['type'],
    service: string,
    data: any,
    severity: SystemEvent['severity'] = 'medium'
  ): Promise<void> {
    const event: SystemEvent = {
      id: uuidv4(),
      type,
      service,
      data,
      severity,
      timestamp: new Date(),
      correlationId: uuidv4(),
      source: 'telegram-bot',
      version: '1.0.0'
    };

    await this.publish(event);
  }

  /**
   * Get health status of the event bus
   */
  getHealthStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    activeConsumers: number;
    topics: string[];
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      activeConsumers: this.consumers.size,
      topics: Object.values(TOPICS)
    };
  }

  /**
   * Gracefully shutdown the event bus
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Enterprise Event Bus...');

    try {
      // Disconnect all consumers
      for (const [key, consumer] of this.consumers) {
        await consumer.disconnect();
        logger.debug(`Consumer ${key} disconnected`);
      }
      this.consumers.clear();

      // Disconnect producer
      await this.producer.disconnect();
      
      this.isConnected = false;
      logger.info('Enterprise Event Bus shutdown completed');
      
    } catch (error) {
      logger.error('Error during Event Bus shutdown:', error);
      throw error;
    }
  }

  /**
   * Create required topics
   */
  private async createTopics(): Promise<void> {
    const admin = this.kafka.admin();
    
    try {
      await admin.connect();
      
      const topics = Object.values(TOPICS).map(topic => ({
        topic,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'gzip' },
          { name: 'min.insync.replicas', value: '1' }
        ]
      }));

      await admin.createTopics({ topics });
      logger.info('Kafka topics created/verified');
      
    } catch (error) {
      logger.warn('Error creating topics (may already exist):', error);
    } finally {
      await admin.disconnect();
    }
  }

  /**
   * Get appropriate topic for event type
   */
  private getTopicForEventType(eventType: string): string {
    if (eventType.startsWith('telegram.')) return TOPICS.TELEGRAM_EVENTS;
    if (eventType.startsWith('user.')) return TOPICS.USER_EVENTS;
    if (eventType.startsWith('content.')) return TOPICS.CONTENT_EVENTS;
    if (eventType.startsWith('analytics.')) return TOPICS.ANALYTICS_EVENTS;
    if (eventType.startsWith('system.')) return TOPICS.SYSTEM_EVENTS;
    return TOPICS.ERROR_EVENTS;
  }

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    this.producer.on('producer.disconnect', () => {
      logger.warn('Producer disconnected');
      this.isConnected = false;
    });

    this.producer.on('producer.network.request_timeout', (payload: any) => {
      logger.warn('Producer network timeout:', payload);
    });
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    try {
      await this.initialize();
    } catch (error) {
      logger.error('Reconnection failed:', error);
      await this.handleReconnection();
    }
  }
}

// Singleton instance
export const eventBus = new EnterpriseEventBus();
