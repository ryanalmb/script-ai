/**
 * Enterprise Account Management Service - Event Service
 * Comprehensive event publishing and consumption with Kafka integration
 */

import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { config, serviceDiscoveryConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { AccountEvent, AccountEventType, BaseEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';

class EventService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private isConnected: boolean = false;
  private eventHandlers: Map<string, (event: any, correlationId?: string | undefined) => Promise<void>>;

  constructor() {
    // Initialize Kafka client
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
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

    this.eventHandlers = new Map();
    this.setupEventHandlers();

    log.info('Kafka client initialized', {
      operation: 'kafka_init',
      metadata: {
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        groupId: config.kafka.groupId
      }
    });
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
      log.info('Connecting to Kafka...', {
        operation: 'kafka_connect'
      });

      await this.producer.connect();
      await this.consumer.connect();

      // Subscribe to relevant topics
      await this.consumer.subscribe({
        topics: [
          'user.events',
          'account.events',
          'campaign.events',
          'compliance.events'
        ],
        fromBeginning: false
      });

      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleMessage(topic, partition, message);
        }
      });

      this.isConnected = true;
      const duration = timer.end();

      log.info('Successfully connected to Kafka', {
        operation: 'kafka_connect',
        duration
      });

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
    const timer = createTimer('kafka_disconnect');

    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
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
   * Check Kafka health
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      // Try to get metadata to check connection
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
   * Handle incoming Kafka messages
   */
  private async handleMessage(topic: string, partition: number, message: KafkaMessage): Promise<void> {
    const timer = createTimer('kafka_message_processing');

    try {
      if (!message.value) {
        log.warn('Received empty message', {
          operation: 'kafka_message_processing',
          metadata: { topic, partition }
        });
        return;
      }

      const eventData = JSON.parse(message.value.toString());
      const correlationId = eventData.correlationId || uuidv4();

      log.debug('Processing Kafka message', {
        operation: 'kafka_message_processing',
        correlationId,
        metadata: { topic, partition, eventType: eventData.type }
      });

      // Get event handler
      const handler = this.eventHandlers.get(eventData.type);
      if (handler) {
        await handler(eventData, correlationId);
        
        log.eventConsumed(eventData.type, eventData.id, true, {
          correlationId,
          metadata: { topic, partition }
        });
      } else {
        log.warn('No handler found for event type', {
          operation: 'kafka_message_processing',
          correlationId,
          metadata: { eventType: eventData.type, topic, partition }
        });
      }

      timer.end();

    } catch (error) {
      timer.end();
      log.error('Failed to process Kafka message', {
        operation: 'kafka_message_processing',
        error: error as Error,
        metadata: { topic, partition }
      });
    }
  }

  /**
   * Setup event handlers for different event types
   */
  private setupEventHandlers(): void {
    // User events
    this.eventHandlers.set('user.registered', this.handleUserRegistered.bind(this));
    this.eventHandlers.set('user.updated', this.handleUserUpdated.bind(this));
    this.eventHandlers.set('user.deleted', this.handleUserDeleted.bind(this));

    // Campaign events
    this.eventHandlers.set('campaign.created', this.handleCampaignCreated.bind(this));
    this.eventHandlers.set('campaign.updated', this.handleCampaignUpdated.bind(this));
    this.eventHandlers.set('campaign.deleted', this.handleCampaignDeleted.bind(this));

    // Compliance events
    this.eventHandlers.set('compliance.violation', this.handleComplianceViolation.bind(this));
    this.eventHandlers.set('compliance.warning', this.handleComplianceWarning.bind(this));

    log.info('Event handlers configured', {
      operation: 'event_handlers_setup',
      metadata: { handlerCount: this.eventHandlers.size }
    });
  }

  /**
   * Publish an event to Kafka
   */
  async publishEvent(
    topic: string,
    event: BaseEvent | AccountEvent,
    correlationId?: string | undefined
  ): Promise<void> {
    if (serviceDiscoveryConfig.disableKafka) {
      log.debug('Kafka is disabled, skipping event publishing', {
        operation: 'kafka_publish_event',
        correlationId: correlationId || undefined,
        metadata: { topic, eventType: event.type }
      });
      return;
    }

    const timer = createTimer('kafka_publish_event');

    try {
      const message = {
        key: event.id,
        value: JSON.stringify(event),
        headers: {
          correlationId: correlationId || event.correlationId,
          eventType: event.type,
          source: event.source,
          timestamp: event.timestamp.toISOString()
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      const duration = timer.end();

      log.eventPublished(event.type, event.id, {
        correlationId: correlationId || undefined,
        operation: 'kafka_publish_event',
        duration,
        metadata: { topic }
      });

    } catch (error) {
      timer.end();
      log.error('Failed to publish event to Kafka', {
        operation: 'kafka_publish_event',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { topic, eventType: event.type, eventId: event.id }
      });
      throw error;
    }
  }

  /**
   * Publish account event
   */
  async publishAccountEvent(
    eventType: AccountEventType,
    userId: string,
    accountId: string,
    data: Record<string, any>,
    correlationId?: string | undefined,
    metadata?: Record<string, any> | undefined
  ): Promise<void> {
    const event: AccountEvent = {
      id: uuidv4(),
      type: eventType,
      userId,
      accountId,
      data,
      metadata: metadata || undefined,
      timestamp: new Date(),
      correlationId: correlationId || uuidv4(),
      source: config.name,
      version: config.version
    };

    await this.publishEvent('account.events', event, correlationId);
  }

  /**
   * Handle user registered event
   */
  private async handleUserRegistered(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId } = eventData;
      
      log.business('User registered - preparing account management', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { userId }
      });

      // Initialize user account management settings
      // This could involve setting up default account limits, preferences, etc.
      
    } catch (error) {
      log.error('Failed to handle user registered event', {
        operation: 'handle_user_registered',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Handle user updated event
   */
  private async handleUserUpdated(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, changes } = eventData;
      
      log.business('User updated - checking account implications', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { userId, changes }
      });

      // Handle user updates that might affect account management
      // e.g., subscription changes, role changes, etc.
      
    } catch (error) {
      log.error('Failed to handle user updated event', {
        operation: 'handle_user_updated',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Handle user deleted event
   */
  private async handleUserDeleted(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId } = eventData;
      
      log.business('User deleted - cleaning up accounts', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { userId }
      });

      // Clean up user accounts when user is deleted
      // This would involve disconnecting all accounts, cleaning up data, etc.
      
    } catch (error) {
      log.error('Failed to handle user deleted event', {
        operation: 'handle_user_deleted',
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
      const { userId, campaignId, accountIds } = eventData;
      
      log.business('Campaign created - validating accounts', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { campaignId, accountIds }
      });

      // Validate that accounts are healthy and ready for campaign
      // This could involve checking account status, rate limits, etc.
      
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
   * Handle campaign updated event
   */
  private async handleCampaignUpdated(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, campaignId, changes } = eventData;
      
      log.business('Campaign updated - checking account requirements', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { campaignId, changes }
      });

      // Handle campaign updates that might affect account requirements
      
    } catch (error) {
      log.error('Failed to handle campaign updated event', {
        operation: 'handle_campaign_updated',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Handle campaign deleted event
   */
  private async handleCampaignDeleted(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, campaignId } = eventData;
      
      log.business('Campaign deleted - releasing account resources', {
        correlationId: correlationId || undefined,
        userId,
        eventData: { campaignId }
      });

      // Release account resources when campaign is deleted
      
    } catch (error) {
      log.error('Failed to handle campaign deleted event', {
        operation: 'handle_campaign_deleted',
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
      const { userId, accountId, violationType, severity } = eventData;
      
      log.security('Compliance violation detected for account', {
        correlationId: correlationId || undefined,
        userId,
        accountId,
        severity,
        eventType: 'compliance_violation',
        ipAddress: undefined,
        userAgent: undefined,
        metadata: { violationType }
      });

      // Handle compliance violations - might involve suspending accounts
      
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
   * Handle compliance warning event
   */
  private async handleComplianceWarning(eventData: any, correlationId?: string | undefined): Promise<void> {
    try {
      const { userId, accountId, warningType } = eventData;
      
      log.warn('Compliance warning for account', {
        correlationId: correlationId || undefined,
        userId,
        accountId,
        metadata: { warningType }
      });

      // Handle compliance warnings - might involve rate limiting or notifications
      
    } catch (error) {
      log.error('Failed to handle compliance warning event', {
        operation: 'handle_compliance_warning',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { eventData }
      });
      throw error;
    }
  }

  /**
   * Check if connected to Kafka
   */
  isConnectedToKafka(): boolean {
    return this.isConnected;
  }
}

// Create and export singleton instance
export const eventService = new EventService();

// Export the class for testing
export { EventService };
