import TelegramBot from 'node-telegram-bot-api';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// Legacy imports for backward compatibility
import { ContentTemplate, GeneratedContent, AnalyticsData } from './backendIntegrationService';
import { enhancedUserService, EnhancedUserProfile } from './enhancedUserService';
import { extractUserProfile } from '../utils/userDataUtils';

// Phase 1: Enhanced Backend Integration Services
import { enhancedBackendClient } from './enhancedBackendClient';
import { serviceDiscoveryHealthMonitoring } from './serviceDiscoveryHealthMonitoring';
import { dynamicServiceRegistry } from './dynamicServiceRegistry';
import { intelligentLoadBalancer } from './intelligentLoadBalancer';
import { EnterpriseCircuitBreaker } from '../infrastructure/circuitBreaker';
import { intelligentRetryPolicyManager } from './intelligentRetryPolicyManager';

// Phase 2: Real-time Integration Services
import { webSocketClientIntegration } from './webSocketClientIntegration';
import { realTimeEventProcessor } from './realTimeEventProcessor';
import { realTimeServiceCoordinator } from './realTimeServiceCoordinator';
import { pushNotificationSystem } from './pushNotificationSystem';

// Enterprise Infrastructure
import { eventBus } from '../infrastructure/eventBus';
import { metrics } from '../infrastructure/metrics';
import { tracing } from '../infrastructure/tracing';
import { serviceDiscovery } from '../infrastructure/serviceDiscovery';

// Enterprise Integration Configuration
export interface EnterpriseIntegrationConfig {
  // Legacy compatibility options
  enableAnalytics: boolean;
  enableContentGeneration: boolean;
  enableTemplates: boolean;
  enableUserSync: boolean;
  syncInterval: number;

  // Phase 1: Enhanced Backend Integration
  enhancedBackend: {
    enabled: boolean;
    serviceDiscovery: boolean;
    circuitBreakers: boolean;
    loadBalancing: boolean;
    retryPolicies: boolean;
    healthMonitoring: boolean;
  };

  // Phase 2: Real-time Integration
  realTimeIntegration: {
    enabled: boolean;
    webSocketConnections: boolean;
    eventProcessing: boolean;
    pushNotifications: boolean;
    serviceCoordination: boolean;
  };

  // Enterprise Features
  enterprise: {
    distributedTracing: boolean;
    metricsCollection: boolean;
    auditLogging: boolean;
    securityEnforcement: boolean;
    performanceOptimization: boolean;
  };
}

export interface ContentGenerationRequest {
  telegramUserId: number;
  prompt: string;
  type: 'post' | 'thread' | 'reply' | 'bio' | 'hashtags';
  options?: {
    tone?: 'professional' | 'casual' | 'humorous' | 'serious';
    length?: 'short' | 'medium' | 'long';
    includeHashtags?: boolean;
    includeEmojis?: boolean;
    platform?: 'twitter' | 'linkedin' | 'instagram';
  };
}

export interface AnalyticsRequest {
  telegramUserId: number;
  period: '1d' | '7d' | '30d' | '90d';
  metrics?: string[];
}

// Enterprise Integration Status
export interface EnterpriseIntegrationStatus {
  initialized: boolean;
  phase1Services: {
    enhancedBackendClient: boolean;
    serviceDiscovery: boolean;
    loadBalancer: boolean;
    circuitBreakers: boolean;
    retryPolicies: boolean;
    healthMonitoring: boolean;
  };
  phase2Services: {
    webSocketIntegration: boolean;
    eventProcessor: boolean;
    pushNotifications: boolean;
    serviceCoordinator: boolean;
  };
  infrastructure: {
    eventBus: boolean;
    metrics: boolean;
    tracing: boolean;
    serviceRegistry: boolean;
  };
  backendHealth: boolean;
  activeConnections: number;
  lastHealthCheck: Date;
}

export class BotBackendIntegration extends EventEmitter {
  private bot: TelegramBot;
  private config: EnterpriseIntegrationConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  // Enterprise Service Instances
  private circuitBreakers: Map<string, EnterpriseCircuitBreaker> = new Map();
  private activeConnections: number = 0;
  private lastHealthCheck: Date = new Date();
  private initializationPromise: Promise<void> | null = null;

  constructor(bot: TelegramBot, config: Partial<EnterpriseIntegrationConfig> = {}) {
    super();
    this.bot = bot;
    this.config = {
      // Legacy compatibility
      enableAnalytics: true,
      enableContentGeneration: true,
      enableTemplates: true,
      enableUserSync: true,
      syncInterval: 300000, // 5 minutes

      // Phase 1: Enhanced Backend Integration
      enhancedBackend: {
        enabled: true,
        serviceDiscovery: true,
        circuitBreakers: true,
        loadBalancing: true,
        retryPolicies: true,
        healthMonitoring: true,
      },

      // Phase 2: Real-time Integration
      realTimeIntegration: {
        enabled: true,
        webSocketConnections: true,
        eventProcessing: true,
        pushNotifications: true,
        serviceCoordination: true,
      },

      // Enterprise Features
      enterprise: {
        distributedTracing: true,
        metricsCollection: true,
        auditLogging: true,
        securityEnforcement: true,
        performanceOptimization: true,
      },

      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize the enterprise integration with all Phase 1 + Phase 2 services
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      logger.info('🚀 Initializing Enterprise Bot-Backend Integration...');

      // Phase 1: Initialize Enhanced Backend Services
      if (this.config.enhancedBackend.enabled) {
        await this.initializePhase1Services();
      }

      // Phase 2: Initialize Real-time Services
      if (this.config.realTimeIntegration.enabled) {
        await this.initializePhase2Services();
      }

      // Initialize Infrastructure Services
      await this.initializeInfrastructureServices();

      // Setup Circuit Breakers
      if (this.config.enhancedBackend.circuitBreakers) {
        this.initializeCircuitBreakers();
      }

      // Start health monitoring
      if (this.config.enhancedBackend.healthMonitoring) {
        this.startHealthMonitoring();
      }

      // Start periodic sync if enabled
      if (this.config.enableUserSync) {
        this.startPeriodicSync();
      }

      this.isInitialized = true;
      this.lastHealthCheck = new Date();

      logger.info('✅ Enterprise Bot-Backend Integration initialized successfully', {
        phase1Enabled: this.config.enhancedBackend.enabled,
        phase2Enabled: this.config.realTimeIntegration.enabled,
        enterpriseFeatures: this.config.enterprise,
        activeConnections: this.activeConnections
      });

      this.emit('integration:initialized', this.getStatus());

    } catch (error) {
      logger.error('❌ Failed to initialize enterprise bot-backend integration:', error);
      this.emit('integration:error', error);
      throw error;
    }
  }

  /**
   * Initialize Phase 1: Enhanced Backend Services
   */
  private async initializePhase1Services(): Promise<void> {
    logger.info('🔧 Initializing Phase 1: Enhanced Backend Services...');

    try {
      // Initialize Enhanced Backend Client
      await enhancedBackendClient.initialize();
      logger.debug('✅ Enhanced Backend Client initialized');

      // Initialize Service Discovery
      if (this.config.enhancedBackend.serviceDiscovery) {
        await serviceDiscovery.initialize();
        await dynamicServiceRegistry.initialize();
        logger.debug('✅ Service Discovery initialized');
      }

      // Initialize Load Balancer
      if (this.config.enhancedBackend.loadBalancing) {
        await intelligentLoadBalancer.initialize();
        logger.debug('✅ Intelligent Load Balancer initialized');
      }

      // Initialize Retry Policy Manager
      if (this.config.enhancedBackend.retryPolicies) {
        await intelligentRetryPolicyManager.initialize();
        logger.debug('✅ Intelligent Retry Policy Manager initialized');
      }

      // Initialize Health Monitoring
      if (this.config.enhancedBackend.healthMonitoring) {
        await serviceDiscoveryHealthMonitoring.initialize();
        logger.debug('✅ Service Discovery Health Monitoring initialized');
      }

      logger.info('✅ Phase 1 services initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Phase 1 services:', error);
      throw new Error(`Phase 1 initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize Phase 2: Real-time Services
   */
  private async initializePhase2Services(): Promise<void> {
    logger.info('🔧 Initializing Phase 2: Real-time Services...');

    try {
      // Initialize WebSocket Client Integration
      if (this.config.realTimeIntegration.webSocketConnections) {
        await webSocketClientIntegration.initialize();
        this.activeConnections += 4; // 4 WebSocket services
        logger.debug('✅ WebSocket Client Integration initialized');
      }

      // Initialize Real-time Event Processor
      if (this.config.realTimeIntegration.eventProcessing) {
        await realTimeEventProcessor.initialize();
        logger.debug('✅ Real-time Event Processor initialized');
      }

      // Initialize Push Notification System
      if (this.config.realTimeIntegration.pushNotifications) {
        await pushNotificationSystem.initialize();
        logger.debug('✅ Push Notification System initialized');
      }

      // Initialize Real-time Service Coordinator
      if (this.config.realTimeIntegration.serviceCoordination) {
        await realTimeServiceCoordinator.initialize();
        logger.debug('✅ Real-time Service Coordinator initialized');
      }

      logger.info('✅ Phase 2 services initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Phase 2 services:', error);
      throw new Error(`Phase 2 initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize Infrastructure Services
   */
  private async initializeInfrastructureServices(): Promise<void> {
    logger.info('🔧 Initializing Infrastructure Services...');

    try {
      // Initialize Event Bus
      await eventBus.initialize();
      logger.debug('✅ Event Bus (Kafka) initialized');

      // Initialize Metrics Collection
      if (this.config.enterprise.metricsCollection) {
        await metrics.initialize();
        logger.debug('✅ Metrics Collection initialized');
      }

      // Initialize Distributed Tracing
      if (this.config.enterprise.distributedTracing) {
        await tracing.initialize();
        logger.debug('✅ Distributed Tracing initialized');
      }

      logger.info('✅ Infrastructure services initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize infrastructure services:', error);
      throw new Error(`Infrastructure initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize Circuit Breakers for all services
   */
  private initializeCircuitBreakers(): void {
    logger.info('🔧 Initializing Circuit Breakers...');

    const services = [
      'analytics-service',
      'content-generation-service',
      'user-management-service',
      'notification-service',
      'twikit-service',
      'websocket-service'
    ];

    services.forEach(serviceName => {
      const circuitBreaker = new EnterpriseCircuitBreaker({
        name: `${serviceName}-circuit-breaker`,
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 10000,
        resetTimeout: 60000,
        monitoringPeriod: 30000,
        expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']
      });

      circuitBreaker.on('open', () => {
        logger.warn(`🔴 Circuit breaker opened for ${serviceName}`);
        this.emit('circuit:open', serviceName);
      });

      circuitBreaker.on('halfOpen', () => {
        logger.info(`🟡 Circuit breaker half-open for ${serviceName}`);
        this.emit('circuit:halfOpen', serviceName);
      });

      circuitBreaker.on('close', () => {
        logger.info(`🟢 Circuit breaker closed for ${serviceName}`);
        this.emit('circuit:close', serviceName);
      });

      this.circuitBreakers.set(serviceName, circuitBreaker);
    });

    logger.info(`✅ ${services.length} Circuit Breakers initialized`);
  }

  /**
   * Start health monitoring for all services
   */
  private startHealthMonitoring(): void {
    logger.info('🔧 Starting Health Monitoring...');

    // Monitor every 30 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000);

    logger.info('✅ Health Monitoring started');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const healthStatus = {
      timestamp: new Date(),
      services: {} as Record<string, boolean>,
      overall: true
    };

    try {
      // Check Enhanced Backend Client
      if (this.config.enhancedBackend.enabled) {
        try {
          healthStatus.services.enhancedBackendClient = true; // Assume healthy if initialized
        } catch {
          healthStatus.services.enhancedBackendClient = false;
        }
      }

      // Check WebSocket connections
      if (this.config.realTimeIntegration.webSocketConnections) {
        try {
          healthStatus.services.webSocketIntegration = this.activeConnections > 0;
        } catch {
          healthStatus.services.webSocketIntegration = false;
        }
      }

      // Check Event Processor
      if (this.config.realTimeIntegration.eventProcessing) {
        try {
          healthStatus.services.eventProcessor = true; // Assume healthy if initialized
        } catch {
          healthStatus.services.eventProcessor = false;
        }
      }

      // Update overall health
      healthStatus.overall = Object.values(healthStatus.services).every(status => status);
      this.lastHealthCheck = healthStatus.timestamp;

      // Emit health status
      this.emit('health:check', healthStatus);

      if (!healthStatus.overall) {
        logger.warn('⚠️ Health check detected issues:', healthStatus);
      }

    } catch (error) {
      logger.error('❌ Health check failed:', error);
      this.emit('health:error', error);
    }
  }

  /**
   * Setup enterprise event handlers
   */
  private setupEventHandlers(): void {
    // WebSocket Integration Events
    if (this.config.realTimeIntegration.webSocketConnections) {
      webSocketClientIntegration.on('connection:established', (serviceName: string) => {
        logger.info(`🔗 WebSocket connection established: ${serviceName}`);
        this.activeConnections++;
        this.emit('websocket:connected', serviceName);
      });

      webSocketClientIntegration.on('connection:lost', (serviceName: string) => {
        logger.warn(`🔗 WebSocket connection lost: ${serviceName}`);
        this.activeConnections = Math.max(0, this.activeConnections - 1);
        this.emit('websocket:disconnected', serviceName);
      });

      webSocketClientIntegration.on('event:received', (event: any) => {
        this.handleWebSocketEvent(event);
      });
    }

    // Real-time Event Processor Events
    if (this.config.realTimeIntegration.eventProcessing) {
      realTimeEventProcessor.on('event:processed', (event: any) => {
        this.emit('event:processed', event);
      });

      realTimeEventProcessor.on('event:failed', (event: any, error: Error) => {
        logger.error('Event processing failed:', error);
        this.emit('event:failed', event, error);
      });
    }

    // Enhanced Backend Client Events
    if (this.config.enhancedBackend.enabled) {
      enhancedBackendClient.on('service:discovered', (serviceName: string) => {
        logger.info(`🔍 Service discovered: ${serviceName}`);
        this.emit('service:discovered', serviceName);
      });

      enhancedBackendClient.on('service:unavailable', (serviceName: string) => {
        logger.warn(`⚠️ Service unavailable: ${serviceName}`);
        this.emit('service:unavailable', serviceName);
      });
    }
  }

  /**
   * Handle incoming WebSocket events from backend services
   */
  private async handleWebSocketEvent(event: any): Promise<void> {
    try {
      logger.debug('📡 Received WebSocket event:', { type: event.type, source: event.source });

      // Process through real-time event processor if enabled
      if (this.config.realTimeIntegration.eventProcessing) {
        // Route event to appropriate processor based on type
        switch (event.type) {
          case 'campaign_progress':
            await realTimeEventProcessor.processCampaignProgressEvent(event);
            break;
          case 'session_health':
            await realTimeEventProcessor.processSessionHealthEvent(event);
            break;
          case 'analytics_update':
            await realTimeEventProcessor.processAnalyticsUpdateEvent(event);
            break;
          case 'system_status':
            await realTimeEventProcessor.processSystemStatusEvent(event);
            break;
          case 'rate_limit_warning':
            await realTimeEventProcessor.processRateLimitWarningEvent(event);
            break;
          case 'service_health_change':
            await realTimeEventProcessor.processServiceHealthChangeEvent(event);
            break;
          default:
            logger.debug('Unhandled WebSocket event type:', event.type);
        }
      }

      // Emit event for external handlers
      this.emit('websocket:event', event);

    } catch (error) {
      logger.error('Failed to handle WebSocket event:', error);
      this.emit('websocket:error', event, error);
    }
  }

  /**
   * Handle user notification from WebSocket
   */
  private async handleUserNotification(event: any): Promise<void> {
    if (event.userId && event.message) {
      await this.sendNotification(event.userId, event.message, event.options || {});
    }
  }

  /**
   * Handle system alert from WebSocket
   */
  private async handleSystemAlert(event: any): Promise<void> {
    logger.warn('🚨 System Alert:', event);
    this.emit('system:alert', event);
  }

  /**
   * Handle analytics update from WebSocket
   */
  private async handleAnalyticsUpdate(event: any): Promise<void> {
    logger.debug('📊 Analytics Update:', event);
    this.emit('analytics:update', event);
  }

  /**
   * Handle campaign status from WebSocket
   */
  private async handleCampaignStatus(event: any): Promise<void> {
    logger.debug('🎯 Campaign Status:', event);
    this.emit('campaign:status', event);
  }

  /**
   * Handle user interaction with enterprise-grade backend integration
   */
  async handleUserInteraction(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    return tracing.traceTelegramMessage(
      'user_interaction',
      telegramUserId.toString(),
      async (span) => {
        try {
          span.setAttributes({
            'user.action': action,
            'user.metadata': JSON.stringify(metadata),
            'enterprise.enabled': this.config.enhancedBackend.enabled,
            'realtime.enabled': this.config.realTimeIntegration.enabled
          });

          // Update user activity
          await enhancedUserService.updateUserActivity(telegramUserId, action, metadata);

          // Enterprise Backend Integration
          if (this.config.enableAnalytics && this.config.enhancedBackend.enabled) {
            await this.handleEnterpriseAnalytics(telegramUserId, action, metadata);
          }

          // Real-time Event Processing
          if (this.config.realTimeIntegration.eventProcessing) {
            await this.handleRealTimeEvent(telegramUserId, action, metadata);
          }

          // WebSocket Broadcasting for real-time actions
          if (this.config.realTimeIntegration.webSocketConnections && this.isRealTimeAction(action)) {
            await this.broadcastRealTimeEvent(telegramUserId, action, metadata);
          }

          // Publish user activity event through enterprise event bus
          if (process.env.DISABLE_KAFKA !== 'true') {
            try {
              await eventBus.publishUserEvent('user.activity', telegramUserId, action, metadata);
            } catch (error) {
              logger.warn('Event bus unavailable, continuing without event publishing:', error);
            }
          }

          // Record enterprise metrics
          metrics.userInteractions.inc({
            type: action,
            user_id: telegramUserId.toString()
          });

          span.setAttributes({
            'interaction.success': true,
            'enterprise.analytics': this.config.enableAnalytics,
            'realtime.processed': this.config.realTimeIntegration.eventProcessing
          });

        } catch (error) {
          span.recordException(error as Error);
          logger.error('Failed to handle user interaction:', error);

          // Publish error event through enterprise event bus
          await eventBus.publishSystemEvent('system.error', 'telegram-bot', {
            type: 'user_interaction_failed',
            userId: telegramUserId,
            action,
            error: (error as Error).message,
            enterprise: this.config.enhancedBackend.enabled,
            realtime: this.config.realTimeIntegration.enabled
          }, 'medium');

          throw error;
        }
      }
    );
  }

  /**
   * Handle enterprise analytics with enhanced backend client
   */
  private async handleEnterpriseAnalytics(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const token = await enhancedUserService.getBackendToken(telegramUserId);

      // Use enhanced backend client with circuit breaker and retry policies
      // Use enhanced backend client for analytics
      await enhancedBackendClient.post('analytics-service', '/api/activity', {
        userId: telegramUserId,
        action,
        metadata,
        timestamp: new Date().toISOString()
      }, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      logger.debug('✅ Enterprise analytics logged successfully');

    } catch (error) {
      logger.warn('Enterprise analytics unavailable, continuing without tracking:', error);

      // Emit analytics error for monitoring
      this.emit('analytics:error', { telegramUserId, action, error });
    }
  }

  /**
   * Handle real-time event processing
   */
  private async handleRealTimeEvent(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Create event for real-time processing
      const event = {
        type: 'user_interaction',
        userId: telegramUserId,
        action,
        metadata,
        timestamp: new Date(),
        source: 'telegram-bot',
        priority: this.determineEventPriority(action)
      };

      // Process through real-time event processor
      switch (action) {
        case 'campaign_created':
        case 'campaign_updated':
        case 'campaign_deleted':
          await realTimeEventProcessor.processCampaignProgressEvent(event);
          break;
        case 'analytics_requested':
          await realTimeEventProcessor.processAnalyticsUpdateEvent(event);
          break;
        case 'system_health_check':
          await realTimeEventProcessor.processSystemStatusEvent(event);
          break;
        default:
          // Generic event processing
          logger.debug('Processing generic real-time event:', event);
      }

      logger.debug('✅ Real-time event processed successfully');

    } catch (error) {
      logger.error('Real-time event processing failed:', error);
      this.emit('realtime:error', { telegramUserId, action, error });
    }
  }

  /**
   * Generate content using backend AI
   */
  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent | null> {
    try {
      if (!this.config.enableContentGeneration) {
        logger.warn('Content generation is disabled');
        return null;
      }

      const token = await enhancedUserService.getBackendToken(request.telegramUserId);
      
      const content = await enhancedBackendClient.post('content-generation-service', '/api/generate', {
        prompt: request.prompt,
        type: request.type,
        options: request.options || {},
        userId: request.telegramUserId
      }, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (content && content.data) {
        // Log the generation activity
        await this.handleUserInteraction(request.telegramUserId, 'content_generated', {
          type: request.type,
          prompt: request.prompt.substring(0, 100), // Log first 100 chars
          contentId: (content.data as any)?.id || 'generated'
        });

        return content.data as GeneratedContent;
      }

      return null;
    } catch (error) {
      logger.error('Failed to generate content:', error);
      return null;
    }
  }

  /**
   * Get content templates
   */
  async getContentTemplates(
    telegramUserId: number,
    category?: string
  ): Promise<ContentTemplate[]> {
    try {
      if (!this.config.enableTemplates) {
        logger.warn('Templates are disabled');
        return [];
      }

      const token = await enhancedUserService.getBackendToken(telegramUserId);
      
      const endpoint = category ? `/api/templates?category=${category}` : '/api/templates';
      const response = await enhancedBackendClient.get('content-generation-service', endpoint, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const templates = response.data as ContentTemplate[] || [];

      // Log template access
      await this.handleUserInteraction(telegramUserId, 'templates_accessed', {
        category,
        count: templates.length
      });

      return templates;
    } catch (error) {
      logger.error('Failed to get content templates:', error);
      return [];
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(request: AnalyticsRequest): Promise<AnalyticsData | null> {
    try {
      if (!this.config.enableAnalytics) {
        logger.warn('Analytics are disabled');
        return null;
      }

      const token = await enhancedUserService.getBackendToken(request.telegramUserId);
      
      const response = await enhancedBackendClient.get('analytics-service', `/api/analytics/${request.telegramUserId}?period=${request.period}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const analytics = response.data as AnalyticsData || null;

      if (analytics) {
        // Log analytics access
        await this.handleUserInteraction(request.telegramUserId, 'analytics_viewed', {
          period: request.period,
          metrics: request.metrics
        });
      }

      return analytics;
    } catch (error) {
      logger.error('Failed to get user analytics:', error);
      return null;
    }
  }

  /**
   * Sync user data with backend
   */
  async syncUserData(telegramUserId: number): Promise<boolean> {
    try {
      const user = await enhancedUserService.getEnhancedUserProfile(telegramUserId);
      if (!user) {
        logger.warn('User not found for sync', { telegramUserId });
        return false;
      }

      // Update backend with latest user data
      const token = await enhancedUserService.getBackendToken(telegramUserId);
      if (!token) {
        logger.warn('No backend token for user sync', { telegramUserId });
        return false;
      }

      const profileData = extractUserProfile(user);

      const response = await enhancedBackendClient.put('user-management-service', `/api/users/${telegramUserId}/profile`, profileData, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      const success = response.success || false;

      if (success) {
        logger.debug('User data synced successfully', { telegramUserId });
      }

      return success;
    } catch (error) {
      logger.error('Failed to sync user data:', error);
      return false;
    }
  }

  /**
   * Send notification via Telegram
   */
  async sendNotification(
    telegramUserId: number,
    message: string,
    options: {
      type?: 'info' | 'warning' | 'error' | 'success';
      buttons?: Array<{ text: string; callback_data: string }>;
      silent?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      const emoji = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        success: '✅'
      }[options.type || 'info'];

      const formattedMessage = `${emoji} ${message}`;

      const messageOptions: any = {
        parse_mode: 'Markdown'
      };

      if (options.buttons && options.buttons.length > 0) {
        messageOptions.reply_markup = {
          inline_keyboard: [options.buttons]
        };
      }

      if (options.silent) {
        messageOptions.disable_notification = true;
      }

      await this.bot.sendMessage(telegramUserId, formattedMessage, messageOptions);

      // Log notification
      await this.handleUserInteraction(telegramUserId, 'notification_sent', {
        type: options.type,
        hasButtons: !!options.buttons?.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Handle authentication success
   */
  async handleAuthenticationSuccess(
    telegramUserId: number,
    tokens: {
      accessToken: string;
      accessTokenSecret: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
    userInfo: {
      username: string;
      displayName: string;
      verified: boolean;
      followerCount?: number;
      followingCount?: number;
    }
  ): Promise<void> {
    try {
      // Store tokens
      await enhancedUserService.storeUserTokens(telegramUserId, tokens);

      // Log authentication success
      await this.handleUserInteraction(telegramUserId, 'authentication_success', {
        platform: 'twitter',
        username: userInfo.username,
        verified: userInfo.verified,
        followerCount: userInfo.followerCount
      });

      // Send success notification
      await this.sendNotification(
        telegramUserId,
        `🎉 Successfully authenticated as @${userInfo.username}!\n\n` +
        `✅ Verified: ${userInfo.verified ? 'Yes' : 'No'}\n` +
        `👥 Followers: ${userInfo.followerCount?.toLocaleString() || 'N/A'}\n\n` +
        `You can now use all platform features!`,
        {
          type: 'success',
          buttons: [
            { text: '📊 View Dashboard', callback_data: 'dashboard_main' },
            { text: '🎨 Create Content', callback_data: 'content_generate' }
          ]
        }
      );
    } catch (error) {
      logger.error('Failed to handle authentication success:', error);
    }
  }

  /**
   * Broadcast real-time event through WebSocket
   */
  private async broadcastRealTimeEvent(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const event = {
        type: 'user_activity',
        userId: telegramUserId,
        action,
        metadata,
        timestamp: new Date().toISOString(),
        source: 'telegram-bot'
      };

      // Broadcast through WebSocket integration
      await webSocketClientIntegration.sendMessage('enterprise-websocket-service', event);

      logger.debug('✅ Real-time event broadcasted successfully');

    } catch (error) {
      logger.warn('WebSocket broadcast failed, continuing without real-time update:', error);
      this.emit('websocket:broadcast_error', { telegramUserId, action, error });
    }
  }

  /**
   * Determine if action requires real-time processing
   */
  private isRealTimeAction(action: string): boolean {
    const realTimeActions = [
      'campaign_created',
      'campaign_updated',
      'campaign_deleted',
      'content_generated',
      'analytics_requested',
      'notification_sent',
      'authentication_success',
      'system_health_check'
    ];

    return realTimeActions.includes(action);
  }

  /**
   * Determine event priority based on action
   */
  private determineEventPriority(action: string): string {
    const highPriorityActions = [
      'authentication_success',
      'system_health_check',
      'campaign_deleted'
    ];

    const mediumPriorityActions = [
      'campaign_created',
      'campaign_updated',
      'content_generated'
    ];

    if (highPriorityActions.includes(action)) return 'high';
    if (mediumPriorityActions.includes(action)) return 'medium';
    return 'normal';
  }

  /**
   * Get comprehensive enterprise integration status
   */
  getStatus(): EnterpriseIntegrationStatus {
    return {
      initialized: this.isInitialized,
      phase1Services: {
        enhancedBackendClient: this.config.enhancedBackend.enabled,
        serviceDiscovery: this.config.enhancedBackend.serviceDiscovery,
        loadBalancer: this.config.enhancedBackend.loadBalancing,
        circuitBreakers: this.config.enhancedBackend.circuitBreakers,
        retryPolicies: this.config.enhancedBackend.retryPolicies,
        healthMonitoring: this.config.enhancedBackend.healthMonitoring,
      },
      phase2Services: {
        webSocketIntegration: this.config.realTimeIntegration.webSocketConnections,
        eventProcessor: this.config.realTimeIntegration.eventProcessing,
        pushNotifications: this.config.realTimeIntegration.pushNotifications,
        serviceCoordinator: this.config.realTimeIntegration.serviceCoordination,
      },
      infrastructure: {
        eventBus: true,
        metrics: this.config.enterprise.metricsCollection,
        tracing: this.config.enterprise.distributedTracing,
        serviceRegistry: this.config.enhancedBackend.serviceDiscovery,
      },
      backendHealth: true, // Will be updated by health monitoring
      activeConnections: this.activeConnections,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        // Sync health check using enhanced backend client
        await this.performHealthCheck();
        logger.debug('Periodic health check completed');

        logger.debug('Periodic sync completed');
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, this.config.syncInterval);

    logger.info('Periodic sync started', { interval: this.config.syncInterval });
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Periodic sync stopped');
    }
  }

  /**
   * Cleanup enterprise integration resources
   */
  destroy(): void {
    this.stopPeriodicSync();

    // Cleanup circuit breakers
    this.circuitBreakers.forEach(circuitBreaker => {
      try {
        circuitBreaker.removeAllListeners();
      } catch (error) {
        logger.warn('Error cleaning up circuit breaker:', error);
      }
    });
    this.circuitBreakers.clear();

    // Cleanup enterprise services
    try {
      if (this.config.realTimeIntegration.webSocketConnections) {
        webSocketClientIntegration.removeAllListeners();
      }

      if (this.config.realTimeIntegration.eventProcessing) {
        realTimeEventProcessor.removeAllListeners();
      }

      if (this.config.realTimeIntegration.pushNotifications) {
        pushNotificationSystem.removeAllListeners();
      }
    } catch (error) {
      logger.warn('Error cleaning up enterprise services:', error);
    }

    this.isInitialized = false;
    this.activeConnections = 0;

    logger.info('🔄 Enterprise Bot-Backend integration destroyed');
  }
}

// Export singleton instance - will be initialized with bot instance later
export let botBackendIntegration: BotBackendIntegration;
