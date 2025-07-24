/**
 * Anti-Detection Cross-Instance Coordinator
 * Manages coordination of anti-detection measures across multiple instances via Redis
 */

import Redis, { Redis as RedisType } from 'ioredis';
import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { AntiDetectionConfig } from '../../config/antiDetection';
import { logger } from '../../utils/logger';

export interface CoordinationMessage {
  type: 'DETECTION_EVENT' | 'PROFILE_UPDATE' | 'FINGERPRINT_UPDATE' | 'BEHAVIOR_UPDATE' | 'EMERGENCY_ROTATION';
  instanceId: string;
  timestamp: number;
  data: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  correlationId?: string;
}

export interface InstanceStatus {
  instanceId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  lastHeartbeat: number;
  activeProfiles: number;
  detectionScore: number;
  load: number;
  version: string;
  capabilities: string[];
}

export interface DistributedLock {
  key: string;
  instanceId: string;
  expiresAt: number;
  metadata?: any;
}

export class AntiDetectionCoordinator extends EventEmitter {
  private redis: RedisType;
  private subscriber: RedisType;
  private publisher: RedisType;
  private prisma: PrismaClient;
  private config: AntiDetectionConfig;
  private instanceId: string;
  private isInitialized: boolean = false;
  
  // Coordination state
  private activeInstances: Map<string, InstanceStatus> = new Map();
  private distributedLocks: Map<string, DistributedLock> = new Map();
  private messageQueue: CoordinationMessage[] = [];
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  
  // Performance metrics
  private metrics = {
    messagesProcessed: 0,
    messagesSent: 0,
    locksAcquired: 0,
    locksReleased: 0,
    coordinationErrors: 0,
    averageResponseTime: 0,
  };

  constructor(config: AntiDetectionConfig, prisma: PrismaClient) {
    super();
    this.config = config;
    this.prisma = prisma;
    this.instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize Redis connections
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.publisher = new Redis(redisUrl);
    
    this.setupEventHandlers();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Anti-Detection Coordinator...');

      // Test Redis connections
      await this.testRedisConnections();

      // Setup Redis subscriptions
      await this.setupRedisSubscriptions();

      // Register this instance
      await this.registerInstance();

      // Start background tasks
      this.startBackgroundTasks();

      this.isInitialized = true;
      logger.info(`Anti-Detection Coordinator initialized with instance ID: ${this.instanceId}`);

      this.emit('initialized', { instanceId: this.instanceId });
    } catch (error) {
      logger.error('Failed to initialize Anti-Detection Coordinator:', error);
      throw error;
    }
  }

  /**
   * Broadcast a coordination message to all instances
   */
  public async broadcastMessage(message: Omit<CoordinationMessage, 'instanceId' | 'timestamp'>): Promise<void> {
    try {
      const fullMessage: CoordinationMessage = {
        ...message,
        instanceId: this.instanceId,
        timestamp: Date.now(),
      };

      const channel = this.getChannelForMessageType(message.type);
      await this.publisher.publish(channel, JSON.stringify(fullMessage));

      this.metrics.messagesSent++;
      logger.debug(`Broadcasted message: ${message.type}`, { correlationId: message.correlationId });

      this.emit('messageBroadcast', fullMessage);
    } catch (error) {
      this.metrics.coordinationErrors++;
      logger.error('Failed to broadcast coordination message:', error);
      throw error;
    }
  }

  /**
   * Acquire a distributed lock
   */
  public async acquireDistributedLock(
    key: string,
    ttlSeconds: number = 300,
    metadata?: any
  ): Promise<boolean> {
    try {
      const lockKey = `${this.config.redis.keyPrefix}lock:${key}`;
      const lockValue = JSON.stringify({
        instanceId: this.instanceId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + (ttlSeconds * 1000),
        metadata,
      });

      // Use Redis SET with NX (only if not exists) and EX (expiration)
      const result = await this.redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');

      if (result === 'OK') {
        const lock: DistributedLock = {
          key,
          instanceId: this.instanceId,
          expiresAt: Date.now() + (ttlSeconds * 1000),
          metadata,
        };

        this.distributedLocks.set(key, lock);
        this.metrics.locksAcquired++;

        logger.debug(`Acquired distributed lock: ${key}`);
        this.emit('lockAcquired', { key, instanceId: this.instanceId });

        return true;
      }

      return false;
    } catch (error) {
      this.metrics.coordinationErrors++;
      logger.error(`Failed to acquire distributed lock: ${key}`, error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   */
  public async releaseDistributedLock(key: string): Promise<boolean> {
    try {
      const lockKey = `${this.config.redis.keyPrefix}lock:${key}`;
      
      // Use Lua script to ensure atomic check-and-delete
      const luaScript = `
        local lockKey = KEYS[1]
        local instanceId = ARGV[1]
        local lockData = redis.call('GET', lockKey)
        
        if lockData then
          local lock = cjson.decode(lockData)
          if lock.instanceId == instanceId then
            redis.call('DEL', lockKey)
            return 1
          end
        end
        
        return 0
      `;

      const result = await this.redis.eval(luaScript, 1, lockKey, this.instanceId);

      if (result === 1) {
        this.distributedLocks.delete(key);
        this.metrics.locksReleased++;

        logger.debug(`Released distributed lock: ${key}`);
        this.emit('lockReleased', { key, instanceId: this.instanceId });

        return true;
      }

      return false;
    } catch (error) {
      this.metrics.coordinationErrors++;
      logger.error(`Failed to release distributed lock: ${key}`, error);
      return false;
    }
  }

  /**
   * Get status of all active instances
   */
  public async getActiveInstances(): Promise<InstanceStatus[]> {
    try {
      const instanceKeys = await this.redis.keys(`${this.config.redis.keyPrefix}instance:*`);
      const instances: InstanceStatus[] = [];

      for (const key of instanceKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const instance: InstanceStatus = JSON.parse(data);
          
          // Check if instance is still active (heartbeat within last 2 minutes)
          if (Date.now() - instance.lastHeartbeat < 120000) {
            instances.push(instance);
            this.activeInstances.set(instance.instanceId, instance);
          } else {
            // Remove inactive instance
            await this.redis.del(key);
            this.activeInstances.delete(instance.instanceId);
          }
        }
      }

      return instances;
    } catch (error) {
      logger.error('Failed to get active instances:', error);
      return [];
    }
  }

  /**
   * Coordinate identity profile rotation across instances
   */
  public async coordinateProfileRotation(
    accountId: string,
    reason: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
  ): Promise<void> {
    try {
      // Acquire lock for this account
      const lockKey = `profile_rotation:${accountId}`;
      const lockAcquired = await this.acquireDistributedLock(lockKey, 60, { reason });

      if (!lockAcquired) {
        logger.warn(`Could not acquire lock for profile rotation: ${accountId}`);
        return;
      }

      try {
        // Broadcast rotation message
        await this.broadcastMessage({
          type: 'EMERGENCY_ROTATION',
          priority,
          data: {
            accountId,
            reason,
            requestedBy: this.instanceId,
          },
          correlationId: `rotation_${accountId}_${Date.now()}`,
        });

        // Update local state
        await this.handleProfileRotation(accountId, reason);

        logger.info(`Coordinated profile rotation for account: ${accountId}`);
      } finally {
        // Always release the lock
        await this.releaseDistributedLock(lockKey);
      }
    } catch (error) {
      logger.error(`Failed to coordinate profile rotation for account: ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Synchronize detection events across instances
   */
  public async synchronizeDetectionEvent(
    detectionEvent: any,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
  ): Promise<void> {
    try {
      await this.broadcastMessage({
        type: 'DETECTION_EVENT',
        priority,
        data: detectionEvent,
        correlationId: `detection_${detectionEvent.id}`,
      });

      // Store in Redis for other instances to query
      const eventKey = `${this.config.redis.keyPrefix}detection_event:${detectionEvent.id}`;
      await this.redis.setex(eventKey, 3600, JSON.stringify(detectionEvent)); // 1 hour TTL

      logger.debug(`Synchronized detection event: ${detectionEvent.id}`);
    } catch (error) {
      logger.error('Failed to synchronize detection event:', error);
      throw error;
    }
  }

  /**
   * Get coordination statistics
   */
  public getCoordinationStatistics(): any {
    return {
      instanceId: this.instanceId,
      isInitialized: this.isInitialized,
      activeInstances: this.activeInstances.size,
      distributedLocks: this.distributedLocks.size,
      messageQueue: this.messageQueue.length,
      metrics: { ...this.metrics },
      uptime: Date.now() - (this.heartbeatInterval ? Date.now() - 60000 : Date.now()),
    };
  }

  /**
   * Shutdown the coordinator
   */
  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Anti-Detection Coordinator...');

      // Stop background tasks
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Release all distributed locks
      for (const key of this.distributedLocks.keys()) {
        await this.releaseDistributedLock(key);
      }

      // Unregister instance
      await this.unregisterInstance();

      // Close Redis connections
      await this.subscriber.disconnect();
      await this.publisher.disconnect();
      await this.redis.disconnect();

      this.isInitialized = false;
      logger.info('Anti-Detection Coordinator shut down successfully');

      this.emit('shutdown');
    } catch (error) {
      logger.error('Error during coordinator shutdown:', error);
      throw error;
    }
  }

  // Private helper methods
  private setupEventHandlers(): void {
    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
      this.emit('error', error);
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', error);
      this.emit('error', error);
    });

    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error:', error);
      this.emit('error', error);
    });
  }

  private async testRedisConnections(): Promise<void> {
    try {
      await this.redis.ping();
      await this.subscriber.ping();
      await this.publisher.ping();
      logger.debug('Redis connections tested successfully');
    } catch (error) {
      logger.error('Redis connection test failed:', error);
      throw error;
    }
  }

  private async setupRedisSubscriptions(): Promise<void> {
    try {
      const channels = [
        `${this.config.redis.keyPrefix}detection_events`,
        `${this.config.redis.keyPrefix}profile_updates`,
        `${this.config.redis.keyPrefix}fingerprint_updates`,
        `${this.config.redis.keyPrefix}behavior_updates`,
        `${this.config.redis.keyPrefix}emergency_rotation`,
        this.config.redis.coordinationChannel,
      ];

      await this.subscriber.subscribe(...channels);

      this.subscriber.on('message', async (channel, message) => {
        try {
          await this.handleCoordinationMessage(channel, message);
        } catch (error) {
          this.metrics.coordinationErrors++;
          logger.error('Error handling coordination message:', error);
        }
      });

      logger.debug('Redis subscriptions setup completed');
    } catch (error) {
      logger.error('Failed to setup Redis subscriptions:', error);
      throw error;
    }
  }

  private async handleCoordinationMessage(channel: string, message: string): Promise<void> {
    try {
      const coordinationMessage: CoordinationMessage = JSON.parse(message);
      
      // Ignore messages from this instance
      if (coordinationMessage.instanceId === this.instanceId) {
        return;
      }

      this.metrics.messagesProcessed++;
      logger.debug(`Received coordination message: ${coordinationMessage.type}`, {
        from: coordinationMessage.instanceId,
        correlationId: coordinationMessage.correlationId,
      });

      // Handle different message types
      switch (coordinationMessage.type) {
        case 'DETECTION_EVENT':
          await this.handleDetectionEventMessage(coordinationMessage);
          break;
        case 'PROFILE_UPDATE':
          await this.handleProfileUpdateMessage(coordinationMessage);
          break;
        case 'FINGERPRINT_UPDATE':
          await this.handleFingerprintUpdateMessage(coordinationMessage);
          break;
        case 'BEHAVIOR_UPDATE':
          await this.handleBehaviorUpdateMessage(coordinationMessage);
          break;
        case 'EMERGENCY_ROTATION':
          await this.handleEmergencyRotationMessage(coordinationMessage);
          break;
        default:
          logger.warn(`Unknown coordination message type: ${coordinationMessage.type}`);
      }

      this.emit('messageReceived', coordinationMessage);
    } catch (error) {
      this.metrics.coordinationErrors++;
      logger.error('Failed to handle coordination message:', error);
    }
  }

  private async handleDetectionEventMessage(message: CoordinationMessage): Promise<void> {
    // Handle detection event from another instance
    const detectionEvent = message.data;
    
    // Update local detection tracking
    // This would integrate with the detection monitoring system
    logger.info(`Received detection event from ${message.instanceId}:`, detectionEvent.detectionType);
    
    this.emit('detectionEventReceived', detectionEvent);
  }

  private async handleProfileUpdateMessage(message: CoordinationMessage): Promise<void> {
    // Handle profile update from another instance
    const profileUpdate = message.data;
    
    logger.debug(`Received profile update from ${message.instanceId}:`, profileUpdate.profileId);
    
    this.emit('profileUpdateReceived', profileUpdate);
  }

  private async handleFingerprintUpdateMessage(message: CoordinationMessage): Promise<void> {
    // Handle fingerprint update from another instance
    const fingerprintUpdate = message.data;
    
    logger.debug(`Received fingerprint update from ${message.instanceId}:`, fingerprintUpdate.fingerprintType);
    
    this.emit('fingerprintUpdateReceived', fingerprintUpdate);
  }

  private async handleBehaviorUpdateMessage(message: CoordinationMessage): Promise<void> {
    // Handle behavior update from another instance
    const behaviorUpdate = message.data;
    
    logger.debug(`Received behavior update from ${message.instanceId}:`, behaviorUpdate.patternType);
    
    this.emit('behaviorUpdateReceived', behaviorUpdate);
  }

  private async handleEmergencyRotationMessage(message: CoordinationMessage): Promise<void> {
    // Handle emergency rotation request from another instance
    const rotationData = message.data;
    
    if (rotationData.requestedBy !== this.instanceId) {
      logger.warn(`Emergency rotation requested by ${message.instanceId} for account: ${rotationData.accountId}`);
      
      // Perform local rotation if we have this account
      await this.handleProfileRotation(rotationData.accountId, rotationData.reason);
      
      this.emit('emergencyRotationReceived', rotationData);
    }
  }

  private async handleProfileRotation(accountId: string, reason: string): Promise<void> {
    try {
      // This would integrate with the identity profile manager
      // For now, just log the rotation
      logger.info(`Performing profile rotation for account ${accountId}, reason: ${reason}`);
      
      // Update database or cache as needed
      // await this.identityManager.rotateProfile(accountId, reason);
      
    } catch (error) {
      logger.error(`Failed to handle profile rotation for account: ${accountId}`, error);
    }
  }

  private getChannelForMessageType(type: CoordinationMessage['type']): string {
    const channelMap = {
      'DETECTION_EVENT': `${this.config.redis.keyPrefix}detection_events`,
      'PROFILE_UPDATE': `${this.config.redis.keyPrefix}profile_updates`,
      'FINGERPRINT_UPDATE': `${this.config.redis.keyPrefix}fingerprint_updates`,
      'BEHAVIOR_UPDATE': `${this.config.redis.keyPrefix}behavior_updates`,
      'EMERGENCY_ROTATION': `${this.config.redis.keyPrefix}emergency_rotation`,
    };

    return channelMap[type] || this.config.redis.coordinationChannel;
  }

  private async registerInstance(): Promise<void> {
    try {
      const instanceStatus: InstanceStatus = {
        instanceId: this.instanceId,
        status: 'ACTIVE',
        lastHeartbeat: Date.now(),
        activeProfiles: 0,
        detectionScore: 0,
        load: 0,
        version: process.env.npm_package_version || '1.0.0',
        capabilities: ['fingerprinting', 'behavior_simulation', 'detection_monitoring'],
      };

      const instanceKey = `${this.config.redis.keyPrefix}instance:${this.instanceId}`;
      await this.redis.setex(instanceKey, 300, JSON.stringify(instanceStatus)); // 5 minutes TTL

      this.activeInstances.set(this.instanceId, instanceStatus);
      logger.info(`Registered instance: ${this.instanceId}`);
    } catch (error) {
      logger.error('Failed to register instance:', error);
      throw error;
    }
  }

  private async unregisterInstance(): Promise<void> {
    try {
      const instanceKey = `${this.config.redis.keyPrefix}instance:${this.instanceId}`;
      await this.redis.del(instanceKey);

      this.activeInstances.delete(this.instanceId);
      logger.info(`Unregistered instance: ${this.instanceId}`);
    } catch (error) {
      logger.error('Failed to unregister instance:', error);
    }
  }

  private startBackgroundTasks(): void {
    // Heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        logger.error('Heartbeat failed:', error);
      }
    }, 30000);

    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error('Cleanup failed:', error);
      }
    }, 300000);
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const instanceStatus: InstanceStatus = {
        instanceId: this.instanceId,
        status: 'ACTIVE',
        lastHeartbeat: Date.now(),
        activeProfiles: this.distributedLocks.size, // Approximate
        detectionScore: 0, // Would be calculated from actual metrics
        load: process.cpuUsage().system / 1000000, // Convert to percentage
        version: process.env.npm_package_version || '1.0.0',
        capabilities: ['fingerprinting', 'behavior_simulation', 'detection_monitoring'],
      };

      const instanceKey = `${this.config.redis.keyPrefix}instance:${this.instanceId}`;
      await this.redis.setex(instanceKey, 300, JSON.stringify(instanceStatus));

      this.activeInstances.set(this.instanceId, instanceStatus);
    } catch (error) {
      logger.error('Failed to send heartbeat:', error);
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      // Clean up expired locks
      const expiredLocks = Array.from(this.distributedLocks.entries())
        .filter(([_, lock]) => Date.now() > lock.expiresAt);

      for (const [key, _] of expiredLocks) {
        this.distributedLocks.delete(key);
      }

      // Clean up old message queue entries
      this.messageQueue = this.messageQueue.filter(
        msg => Date.now() - msg.timestamp < 3600000 // Keep messages for 1 hour
      );

      // Clean up inactive instances
      await this.getActiveInstances(); // This will clean up inactive instances

      logger.debug('Coordination cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }
}
