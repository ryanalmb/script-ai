/**
 * Enterprise User Management Service - Event Service
 * Comprehensive Kafka event publishing and consumption with enterprise features
 */

import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { config, serviceDiscoveryConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { UserEvent, UserEventType, BaseEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';

class EventService {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isConnected: boolean = false;
  private isProducerConnected: boolean = false;
  private isConsumerConnected: boolean = false;

  constructor() {
    if (!serviceDiscoveryConfig.disableKafka) {
      this.initializeKafka();
    } else {
      log.info('Kafka is disabled, event service will operate in mock mode', {
        operation: 'event_service_init'
      });
    }
  }

  /**
   * Initialize Kafka client
   */
  private initializeKafka(): void {
    try {
      this.kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        retry: {
          initialRetryTime: 100,
          retries: 8
        },
        connectionTimeout: 3000,
        requestTimeout: 30000
      });

      this.producer = this.kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000
      });

      this.consumer = this.kafka.consumer({
        groupId: config.kafka.groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000
      });

      log.info('Kafka client initialized', {
        operation: 'kafka_init',
        metadata: {
          clientId: config.kafka.clientId,
          brokers: config.kafka.brokers,
          groupId: config.kafka.groupId
        }
      });
    } catch (error) {
      log.error('Failed to initialize Kafka client', {
        operation: 'kafka_init',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (serviceDiscoveryConfig.disableKafka) {
      log.info('Kafka is disabled, skipping connection', {
        operation: 'kafka_connect'
      });
      return;
    }

    const timer = createTimer('kafka_connect');

    try {
      if (!this.producer || !this.consumer) {
        throw new Error('Kafka client not initialized');
      }

      log.info('Connecting to Kafka', {
        operation: 'kafka_connect',
        metadata: { brokers: config.kafka.brokers }
      });

      // Connect producer
      await this.producer.connect();
      this.isProducerConnected = true;
      
      log.info('Kafka producer connected', {
        operation: 'kafka_producer_connect'
      });

      // Connect consumer
      await this.consumer.connect();
      this.isConsumerConnected = true;
      
      log.info('Kafka consumer connected', {
        operation: 'kafka_consumer_connect'
      });

      this.isConnected = true;
      
      const duration = timer.end();
      
      log.info('Successfully connected to Kafka', {
        operation: 'kafka_connect',
        duration
      });

      // Subscribe to topics
      await this.subscribeToTopics();

    } catch (error) {
      timer.end();
      log.error('Failed to connect to Kafka', {
        operation: 'kafka_connect',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (serviceDiscoveryConfig.disableKafka) {
      return;
    }

    const timer = createTimer('kafka_disconnect');

    try {
      if (this.producer && this.isProducerConnected) {
        await this.producer.disconnect();
        this.isProducerConnected = false;
        log.info('Kafka producer disconnected', {
          operation: 'kafka_producer_disconnect'
        });
      }

      if (this.consumer && this.isConsumerConnected) {
        await this.consumer.disconnect();
        this.isConsumerConnected = false;
        log.info('Kafka consumer disconnected', {
          operation: 'kafka_consumer_disconnect'
        });
      }

      this.isConnected = false;
      
      const duration = timer.end();
      
      log.info('Successfully disconnected from Kafka', {
        operation: 'kafka_disconnect',
        duration
      });
    } catch (error) {
      timer.end();
      log.error('Error disconnecting from Kafka', {
        operation: 'kafka_disconnect',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Subscribe to relevant topics
   */
  private async subscribeToTopics(): Promise<void> {
    if (!this.consumer || !this.isConsumerConnected) {
      throw new Error('Consumer not connected');
    }

    const topics = [
      'account.connected',
      'campaign.created',
      'subscription.updated',
      'compliance.violation'
    ];

    try {
      for (const topic of topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
        log.info(`Subscribed to topic: ${topic}`, {
          operation: 'kafka_subscribe',
          metadata: { topic }
        });
      }

      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleIncomingEvent(topic, partition, message);
        }
      });

      log.info('Kafka consumer started', {
        operation: 'kafka_consumer_start',
        metadata: { topics }
      });
    } catch (error) {
      log.error('Failed to subscribe to topics', {
        operation: 'kafka_subscribe',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Publish a user event
   */
  async publishUserEvent(
    eventType: UserEventType,
    userId: string,
    data: Record<string, any>,
    correlationId?: string | undefined,
    metadata?: Record<string, any> | undefined
  ): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: eventType,
      userId,
      data,
      metadata: metadata || undefined,
      timestamp: new Date(),
      correlationId: correlationId || uuidv4(),
      source: config.name,
      version: config.version
    };

    await this.publishEvent(eventType, event, correlationId);
  }

  /**
   * Publish a generic event
   */
  async publishEvent(
    topic: string,
    event: BaseEvent | UserEvent,
    correlationId?: string | undefined
  ): Promise<void> {
    const timer = createTimer('event_publish');

    try {
      if (serviceDiscoveryConfig.disableKafka) {
        log.info(`Mock event published: ${topic}`, {
          operation: 'event_publish_mock',
          correlationId,
          metadata: { eventId: event.id, eventType: event.type }
        });
        timer.end();
        return;
      }

      if (!this.producer || !this.isProducerConnected) {
        throw new Error('Producer not connected');
      }

      const message = {
        key: 'userId' in event ? event.userId : event.id,
        value: JSON.stringify(event),
        headers: {
          'event-type': event.type,
          'event-id': event.id,
          'correlation-id': event.correlationId,
          'source': event.source,
          'version': event.version,
          'timestamp': event.timestamp.toISOString()
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      const duration = timer.end();

      log.eventPublished(event.type, event.id, {
        correlationId,
        duration,
        metadata: { topic, userId: 'userId' in event ? event.userId : undefined }
      });

    } catch (error) {
      timer.end();
      log.error(`Failed to publish event: ${topic}`, {
        operation: 'event_publish',
        correlationId,
        error: error as Error,
        metadata: { eventId: event.id, eventType: event.type }
      });
      throw error;
    }
  }

  /**
   * Handle incoming events from other services
   */
  private async handleIncomingEvent(
    topic: string,
    partition: number,
    message: KafkaMessage
  ): Promise<void> {
    const timer = createTimer('event_consume');

    try {
      if (!message.value) {
        log.warn('Received empty message', {
          operation: 'event_consume',
          metadata: { topic, partition }
        });
        return;
      }

      const eventData = JSON.parse(message.value.toString());
      const eventId = message.headers?.['event-id']?.toString() || 'unknown';
      const correlationId = message.headers?.['correlation-id']?.toString();

      log.debug(`Processing incoming event: ${topic}`, {
        operation: 'event_consume',
        correlationId,
        metadata: { eventId, topic, partition }
      });

      // Route to appropriate handler based on topic
      switch (topic) {
        case 'account.connected':
          await this.handleAccountConnected(eventData, correlationId);
          break;
        case 'campaign.created':
          await this.handleCampaignCreated(eventData, correlationId);
          break;
        case 'subscription.updated':
          await this.handleSubscriptionUpdated(eventData, correlationId);
          break;
        case 'compliance.violation':
          await this.handleComplianceViolation(eventData, correlationId);
          break;
        default:
          log.warn(`Unknown event topic: ${topic}`, {
            operation: 'event_consume',
            correlationId,
            metadata: { topic, eventId }
          });
      }

      const duration = timer.end();

      log.eventConsumed(topic, eventId, true, {
        correlationId,
        duration,
        metadata: { partition }
      });

    } catch (error) {
      timer.end();
      const eventId = message.headers?.['event-id']?.toString() || 'unknown';
      const correlationId = message.headers?.['correlation-id']?.toString();

      log.eventConsumed(topic, eventId, false, {
        correlationId,
        error: error as Error,
        metadata: { topic, partition }
      });

      // In a production system, you might want to send to a dead letter queue
      throw error;
    }
  }

  /**
   * Handle account connected event
   */
  private async handleAccountConnected(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, accountId, platform } = eventData;

      log.business('Account connected', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { accountId, platform }
      });

      // Update user's connected accounts count or other relevant data
      // This would typically involve updating user metadata

    } catch (error) {
      log.error('Failed to handle account connected event', {
        operation: 'handle_account_connected',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Handle campaign created event
   */
  private async handleCampaignCreated(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, campaignId } = eventData;

      log.business('Campaign created', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { campaignId }
      });

      // Update user activity metrics or other relevant data

    } catch (error) {
      log.error('Failed to handle campaign created event', {
        operation: 'handle_campaign_created',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Handle subscription updated event
   */
  private async handleSubscriptionUpdated(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, plan, features } = eventData;

      log.business('Subscription updated', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { plan, features }
      });

      // Update user role and permissions based on subscription

    } catch (error) {
      log.error('Failed to handle subscription updated event', {
        operation: 'handle_subscription_updated',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Handle compliance violation event
   */
  private async handleComplianceViolation(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, violationType, severity } = eventData;

      log.security('Compliance violation detected', {
        correlationId: correlationId || undefined,
        userId,
        severity,
        eventType: 'compliance_violation',
        ipAddress: undefined,
        userAgent: undefined,
        metadata: { violationType }
      });

      // Apply user restrictions if needed based on violation severity

    } catch (error) {
      log.error('Failed to handle compliance violation event', {
        operation: 'handle_compliance_violation',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Check Kafka health
   */
  async healthCheck(): Promise<boolean> {
    if (serviceDiscoveryConfig.disableKafka) {
      return true; // Always healthy when disabled
    }

    try {
      if (!this.kafka) {
        return false;
      }

      // Simple health check by getting metadata
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();

      return true;
    } catch (error) {
      log.error('Kafka health check failed', {
        operation: 'kafka_health_check',
        error: error as Error
      });
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    isProducerConnected: boolean;
    isConsumerConnected: boolean;
    isDisabled: boolean;
  } {
    return {
      isConnected: this.isConnected,
      isProducerConnected: this.isProducerConnected,
      isConsumerConnected: this.isConsumerConnected,
      isDisabled: serviceDiscoveryConfig.disableKafka
    };
  }
}

// Create and export singleton instance
export const eventService = new EventService();

// Export the class for testing
export { EventService };
