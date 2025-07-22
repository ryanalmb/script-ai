import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../../utils/logger';
import { prisma } from '../../lib/prisma';
import { cacheManager } from '../../lib/cache';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface WebSocketClient {
  id: string;
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: string[];
  permissions: string[];
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
  };
}

export interface WebSocketMessage {
  id: string;
  type: string;
  channel: string;
  data: any;
  timestamp: Date;
  userId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ttl?: number; // Time to live in seconds
  retryCount?: number;
}

export interface SubscriptionFilter {
  accountIds?: string[];
  campaignIds?: string[];
  eventTypes?: string[];
  severity?: string[];
  dataTypes?: string[];
}

/**
 * Enterprise WebSocket Real-Time Updates Service
 * Provides real-time dashboard updates with authentication, rate limiting, and data validation
 */
export class EnterpriseWebSocketService {
  private io: SocketIOServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // channel -> client IDs
  private messageQueue: Map<string, WebSocketMessage[]> = new Map(); // client ID -> messages
  private rateLimiters: Map<string, any> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.initializeWebSocketService();
  }

  /**
   * Initialize WebSocket service with comprehensive setup
   */
  private async initializeWebSocketService(): Promise<void> {
    try {
      logger.info('🔧 Initializing Enterprise WebSocket Service...');
      
      await this.setupAuthentication();
      await this.setupEventHandlers();
      await this.setupRateLimiting();
      await this.startBroadcastInterval();
      await this.startCleanupInterval();
      await this.startMetricsCollection();
      
      logger.info('✅ Enterprise WebSocket Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise WebSocket Service:', error);
      throw new Error(`WebSocket Service initialization failed: ${error}`);
    }
  }

  /**
   * Setup authentication middleware
   */
  private async setupAuthentication(): Promise<void> {
    try {
      this.io.use(async (socket, next) => {
        try {
          const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
          
          if (!token) {
            return next(new Error('Authentication token required'));
          }

          // Verify JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
          
          // Get user from database
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, role: true, isActive: true }
          });

          if (!user || !user.isActive) {
            return next(new Error('Invalid or inactive user'));
          }

          // Attach user info to socket
          socket.data.userId = user.id;
          socket.data.userRole = user.role;
          socket.data.userEmail = user.email;
          
          next();
        } catch (error) {
          logger.error('WebSocket authentication failed:', error);
          next(new Error('Authentication failed'));
        }
      });

      logger.info('WebSocket authentication middleware configured');
    } catch (error) {
      logger.error('Failed to setup WebSocket authentication:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  private async setupEventHandlers(): Promise<void> {
    try {
      this.io.on('connection', async (socket) => {
        try {
          const clientId = crypto.randomUUID();
          const userId = socket.data.userId;
          
          // Create client record
          const client: WebSocketClient = {
            id: clientId,
            userId,
            socketId: socket.id,
            connectedAt: new Date(),
            lastActivity: new Date(),
            subscriptions: [],
            permissions: await this.getUserPermissions(userId),
            metadata: {
              userAgent: socket.handshake.headers['user-agent'],
              ipAddress: socket.handshake.address,
              location: socket.handshake.headers['x-forwarded-for'] as string
            }
          };

          this.clients.set(clientId, client);
          this.messageQueue.set(clientId, []);
          
          // Setup rate limiter for client
          this.setupClientRateLimit(clientId);

          logger.info(`WebSocket client connected: ${clientId} (User: ${userId})`);

          // Handle subscription requests
          socket.on('subscribe', async (data) => {
            await this.handleSubscription(clientId, data);
          });

          // Handle unsubscription requests
          socket.on('unsubscribe', async (data) => {
            await this.handleUnsubscription(clientId, data);
          });

          // Handle ping for keepalive
          socket.on('ping', () => {
            this.updateClientActivity(clientId);
            socket.emit('pong', { timestamp: Date.now() });
          });

          // Handle client requests
          socket.on('request', async (data) => {
            await this.handleClientRequest(clientId, data);
          });

          // Handle disconnection
          socket.on('disconnect', (reason) => {
            this.handleClientDisconnection(clientId, reason);
          });

          // Send welcome message
          socket.emit('connected', {
            clientId,
            serverTime: new Date(),
            permissions: client.permissions
          });

        } catch (error) {
          logger.error('Error handling WebSocket connection:', error);
          socket.disconnect(true);
        }
      });

      logger.info('WebSocket event handlers configured');
    } catch (error) {
      logger.error('Failed to setup WebSocket event handlers:', error);
      throw error;
    }
  }

  /**
   * Setup rate limiting
   */
  private async setupRateLimiting(): Promise<void> {
    try {
      // Global rate limiting configuration
      const rateLimitConfig = {
        subscribe: { limit: 10, window: 60000 }, // 10 subscriptions per minute
        request: { limit: 60, window: 60000 }, // 60 requests per minute
        message: { limit: 100, window: 60000 } // 100 messages per minute
      };

      // Store configuration for use in client rate limiters
      this.rateLimitConfig = rateLimitConfig;

      logger.info('WebSocket rate limiting configured');
    } catch (error) {
      logger.error('Failed to setup WebSocket rate limiting:', error);
      throw error;
    }
  }

  /**
   * Setup client-specific rate limiter
   */
  private setupClientRateLimit(clientId: string): void {
    try {
      const rateLimiters = {};
      
      for (const [action, config] of Object.entries(this.rateLimitConfig)) {
        rateLimiters[action] = {
          requests: 0,
          resetTime: Date.now() + config.window,
          limit: config.limit,
          window: config.window
        };
      }

      this.rateLimiters.set(clientId, rateLimiters);
    } catch (error) {
      logger.error(`Failed to setup rate limiter for client ${clientId}:`, error);
    }
  }

  /**
   * Check rate limit for client action
   */
  private checkRateLimit(clientId: string, action: string): boolean {
    try {
      const clientRateLimiters = this.rateLimiters.get(clientId);
      if (!clientRateLimiters) return true;

      const rateLimiter = clientRateLimiters[action];
      if (!rateLimiter) return true;

      const now = Date.now();
      
      // Reset if window has passed
      if (now >= rateLimiter.resetTime) {
        rateLimiter.requests = 0;
        rateLimiter.resetTime = now + rateLimiter.window;
      }

      // Check if under limit
      if (rateLimiter.requests < rateLimiter.limit) {
        rateLimiter.requests++;
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Rate limit check failed for client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Handle subscription requests
   */
  private async handleSubscription(clientId: string, data: any): Promise<void> {
    try {
      if (!this.checkRateLimit(clientId, 'subscribe')) {
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Rate limit exceeded for subscriptions'
        });
        return;
      }

      const client = this.clients.get(clientId);
      if (!client) return;

      const { channel, filters } = data;
      
      // Validate subscription request
      if (!this.validateSubscriptionRequest(client, channel, filters)) {
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Invalid subscription request or insufficient permissions'
        });
        return;
      }

      // Add to client subscriptions
      if (!client.subscriptions.includes(channel)) {
        client.subscriptions.push(channel);
      }

      // Add to channel subscriptions
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(clientId);

      // Store subscription filters
      await cacheManager.set(
        `subscription_filters:${clientId}:${channel}`,
        filters || {},
        3600 // 1 hour
      );

      this.updateClientActivity(clientId);

      // Send confirmation
      this.sendToClient(clientId, {
        type: 'subscribed',
        channel,
        filters
      });

      logger.debug(`Client ${clientId} subscribed to channel: ${channel}`);
    } catch (error) {
      logger.error(`Failed to handle subscription for client ${clientId}:`, error);
    }
  }

  /**
   * Handle unsubscription requests
   */
  private async handleUnsubscription(clientId: string, data: any): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { channel } = data;

      // Remove from client subscriptions
      client.subscriptions = client.subscriptions.filter(c => c !== channel);

      // Remove from channel subscriptions
      const channelSubscriptions = this.subscriptions.get(channel);
      if (channelSubscriptions) {
        channelSubscriptions.delete(clientId);
        if (channelSubscriptions.size === 0) {
          this.subscriptions.delete(channel);
        }
      }

      // Remove subscription filters
      await cacheManager.del(`subscription_filters:${clientId}:${channel}`);

      this.updateClientActivity(clientId);

      // Send confirmation
      this.sendToClient(clientId, {
        type: 'unsubscribed',
        channel
      });

      logger.debug(`Client ${clientId} unsubscribed from channel: ${channel}`);
    } catch (error) {
      logger.error(`Failed to handle unsubscription for client ${clientId}:`, error);
    }
  }

  /**
   * Handle client requests
   */
  private async handleClientRequest(clientId: string, data: any): Promise<void> {
    try {
      if (!this.checkRateLimit(clientId, 'request')) {
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Rate limit exceeded for requests'
        });
        return;
      }

      const client = this.clients.get(clientId);
      if (!client) return;

      const { requestId, type, payload } = data;

      this.updateClientActivity(clientId);

      // Process request based on type
      let response;
      switch (type) {
        case 'get_account_metrics':
          response = await this.getAccountMetrics(client, payload);
          break;
        case 'get_campaign_performance':
          response = await this.getCampaignPerformance(client, payload);
          break;
        case 'get_real_time_analytics':
          response = await this.getRealTimeAnalytics(client, payload);
          break;
        case 'force_sync':
          response = await this.forceSyncAccount(client, payload);
          break;
        default:
          response = { error: 'Unknown request type' };
      }

      // Send response
      this.sendToClient(clientId, {
        type: 'response',
        requestId,
        data: response
      });

    } catch (error) {
      logger.error(`Failed to handle client request for ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Request processing failed'
      });
    }
  }

  /**
   * Handle client disconnection
   */
  private handleClientDisconnection(clientId: string, reason: string): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Remove from all channel subscriptions
      for (const channel of client.subscriptions) {
        const channelSubscriptions = this.subscriptions.get(channel);
        if (channelSubscriptions) {
          channelSubscriptions.delete(clientId);
          if (channelSubscriptions.size === 0) {
            this.subscriptions.delete(channel);
          }
        }
      }

      // Clean up client data
      this.clients.delete(clientId);
      this.messageQueue.delete(clientId);
      this.rateLimiters.delete(clientId);

      logger.info(`WebSocket client disconnected: ${clientId} (Reason: ${reason})`);
    } catch (error) {
      logger.error(`Failed to handle client disconnection for ${clientId}:`, error);
    }
  }

  /**
   * Validate subscription request
   */
  private validateSubscriptionRequest(client: WebSocketClient, channel: string, filters: any): boolean {
    try {
      // Check if user has permission for this channel
      const channelPermissions = {
        'account_metrics': ['read_accounts'],
        'campaign_performance': ['read_campaigns'],
        'automation_events': ['read_automation'],
        'system_health': ['read_system'],
        'alerts': ['read_alerts']
      };

      const requiredPermissions = channelPermissions[channel] || [];
      const hasPermission = requiredPermissions.every(perm => 
        client.permissions.includes(perm) || client.permissions.includes('admin')
      );

      if (!hasPermission) {
        logger.warn(`Client ${client.id} lacks permissions for channel ${channel}`);
        return false;
      }

      // Validate filters
      if (filters && !this.validateSubscriptionFilters(filters)) {
        logger.warn(`Invalid filters for client ${client.id}, channel ${channel}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Subscription validation failed:', error);
      return false;
    }
  }

  /**
   * Validate subscription filters
   */
  private validateSubscriptionFilters(filters: SubscriptionFilter): boolean {
    try {
      // Validate account IDs
      if (filters.accountIds && !Array.isArray(filters.accountIds)) {
        return false;
      }

      // Validate campaign IDs
      if (filters.campaignIds && !Array.isArray(filters.campaignIds)) {
        return false;
      }

      // Validate event types
      if (filters.eventTypes && !Array.isArray(filters.eventTypes)) {
        return false;
      }

      // Validate severity levels
      if (filters.severity && !Array.isArray(filters.severity)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Filter validation failed:', error);
      return false;
    }
  }

  /**
   * Get user permissions
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user) return [];

      // Define role-based permissions
      const rolePermissions = {
        'admin': ['admin', 'read_accounts', 'write_accounts', 'read_campaigns', 'write_campaigns', 'read_automation', 'write_automation', 'read_system', 'read_alerts'],
        'manager': ['read_accounts', 'write_accounts', 'read_campaigns', 'write_campaigns', 'read_automation', 'read_alerts'],
        'operator': ['read_accounts', 'read_campaigns', 'read_automation', 'read_alerts'],
        'viewer': ['read_accounts', 'read_campaigns']
      };

      return rolePermissions[user.role] || ['viewer'];
    } catch (error) {
      logger.error(`Failed to get permissions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Update client activity timestamp
   */
  private updateClientActivity(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastActivity = new Date();
      }
    } catch (error) {
      logger.error(`Failed to update activity for client ${clientId}:`, error);
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, data: any): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const socket = this.io.sockets.sockets.get(client.socketId);
      if (socket && socket.connected) {
        socket.emit('message', {
          ...data,
          timestamp: new Date(),
          clientId
        });
      } else {
        // Queue message if client is temporarily disconnected
        this.queueMessage(clientId, data);
      }
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}:`, error);
    }
  }

  /**
   * Queue message for offline client
   */
  private queueMessage(clientId: string, data: any): void {
    try {
      const queue = this.messageQueue.get(clientId) || [];
      
      const message: WebSocketMessage = {
        id: crypto.randomUUID(),
        type: data.type,
        channel: data.channel || 'system',
        data,
        timestamp: new Date(),
        priority: data.priority || 'medium',
        ttl: data.ttl || 300 // 5 minutes default
      };

      queue.push(message);
      
      // Limit queue size
      if (queue.length > 100) {
        queue.shift(); // Remove oldest message
      }
      
      this.messageQueue.set(clientId, queue);
    } catch (error) {
      logger.error(`Failed to queue message for client ${clientId}:`, error);
    }
  }

  /**
   * Broadcast to channel subscribers
   */
  async broadcastToChannel(channel: string, data: any, filters?: SubscriptionFilter): Promise<void> {
    try {
      const subscribers = this.subscriptions.get(channel);
      if (!subscribers || subscribers.size === 0) return;

      const broadcastPromises = Array.from(subscribers).map(async (clientId) => {
        try {
          // Check if message matches client's filters
          if (filters && !await this.matchesClientFilters(clientId, channel, filters)) {
            return;
          }

          this.sendToClient(clientId, {
            type: 'broadcast',
            channel,
            data,
            timestamp: new Date()
          });
        } catch (error) {
          logger.error(`Failed to broadcast to client ${clientId}:`, error);
        }
      });

      await Promise.all(broadcastPromises);
      
      logger.debug(`Broadcasted to ${subscribers.size} subscribers on channel: ${channel}`);
    } catch (error) {
      logger.error(`Failed to broadcast to channel ${channel}:`, error);
    }
  }

  /**
   * Check if message matches client filters
   */
  private async matchesClientFilters(clientId: string, channel: string, messageFilters: SubscriptionFilter): Promise<boolean> {
    try {
      const clientFilters = await cacheManager.get(`subscription_filters:${clientId}:${channel}`) as SubscriptionFilter;
      if (!clientFilters) return true; // No filters means accept all

      // Check account ID filter
      if (clientFilters.accountIds && messageFilters.accountIds) {
        const hasMatchingAccount = messageFilters.accountIds.some(id => 
          clientFilters.accountIds!.includes(id)
        );
        if (!hasMatchingAccount) return false;
      }

      // Check campaign ID filter
      if (clientFilters.campaignIds && messageFilters.campaignIds) {
        const hasMatchingCampaign = messageFilters.campaignIds.some(id => 
          clientFilters.campaignIds!.includes(id)
        );
        if (!hasMatchingCampaign) return false;
      }

      // Check event type filter
      if (clientFilters.eventTypes && messageFilters.eventTypes) {
        const hasMatchingEventType = messageFilters.eventTypes.some(type => 
          clientFilters.eventTypes!.includes(type)
        );
        if (!hasMatchingEventType) return false;
      }

      // Check severity filter
      if (clientFilters.severity && messageFilters.severity) {
        const hasMatchingSeverity = messageFilters.severity.some(severity => 
          clientFilters.severity!.includes(severity)
        );
        if (!hasMatchingSeverity) return false;
      }

      return true;
    } catch (error) {
      logger.error(`Failed to match client filters for ${clientId}:`, error);
      return true; // Default to allowing message
    }
  }

  /**
   * Get account metrics for client request
   */
  private async getAccountMetrics(client: WebSocketClient, payload: any): Promise<any> {
    try {
      const { accountIds, timeframe } = payload;
      
      // Check permissions
      if (!client.permissions.includes('read_accounts') && !client.permissions.includes('admin')) {
        return { error: 'Insufficient permissions' };
      }

      // Get metrics from database
      const metrics = await prisma.accountMetrics.findMany({
        where: {
          accountId: { in: accountIds },
          timestamp: {
            gte: new Date(Date.now() - (timeframe || 24) * 60 * 60 * 1000)
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      return { metrics };
    } catch (error) {
      logger.error('Failed to get account metrics:', error);
      return { error: 'Failed to retrieve account metrics' };
    }
  }

  /**
   * Get campaign performance for client request
   */
  private async getCampaignPerformance(client: WebSocketClient, payload: any): Promise<any> {
    try {
      const { campaignIds, timeframe } = payload;
      
      // Check permissions
      if (!client.permissions.includes('read_campaigns') && !client.permissions.includes('admin')) {
        return { error: 'Insufficient permissions' };
      }

      // Get performance data from database
      const performance = await prisma.campaignPerformanceMetrics.findMany({
        where: {
          campaignId: { in: campaignIds },
          timestamp: {
            gte: new Date(Date.now() - (timeframe || 24) * 60 * 60 * 1000)
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      return { performance };
    } catch (error) {
      logger.error('Failed to get campaign performance:', error);
      return { error: 'Failed to retrieve campaign performance' };
    }
  }

  /**
   * Get real-time analytics for client request
   */
  private async getRealTimeAnalytics(client: WebSocketClient, payload: any): Promise<any> {
    try {
      // Check permissions
      if (!client.permissions.includes('read_system') && !client.permissions.includes('admin')) {
        return { error: 'Insufficient permissions' };
      }

      // Get real-time analytics
      const analytics = {
        totalAccounts: await prisma.xAccount.count({ where: { isActive: true } }),
        activeCampaigns: await prisma.campaign.count({ where: { status: 'active' } }),
        todayMetrics: await this.getTodayMetrics(),
        systemHealth: await this.getSystemHealth()
      };

      return { analytics };
    } catch (error) {
      logger.error('Failed to get real-time analytics:', error);
      return { error: 'Failed to retrieve real-time analytics' };
    }
  }

  /**
   * Force sync account for client request
   */
  private async forceSyncAccount(client: WebSocketClient, payload: any): Promise<any> {
    try {
      const { accountId, syncType } = payload;
      
      // Check permissions
      if (!client.permissions.includes('write_accounts') && !client.permissions.includes('admin')) {
        return { error: 'Insufficient permissions' };
      }

      // This would trigger the sync service
      // For now, return success
      return { 
        success: true, 
        message: `Sync initiated for account ${accountId}`,
        syncType 
      };
    } catch (error) {
      logger.error('Failed to force sync account:', error);
      return { error: 'Failed to initiate account sync' };
    }
  }

  /**
   * Get today's metrics summary
   */
  private async getTodayMetrics(): Promise<any> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const metrics = await prisma.accountMetrics.findMany({
        where: {
          timestamp: { gte: today }
        }
      });

      const totalFollowersGained = metrics.reduce((sum, m) => sum + (m.deltaFollowers > 0 ? m.deltaFollowers : 0), 0);
      const totalTweets = metrics.reduce((sum, m) => sum + (m.deltaTweets || 0), 0);
      const avgEngagementRate = metrics.length > 0 ? 
        metrics.reduce((sum, m) => sum + m.engagementRate, 0) / metrics.length : 0;

      return {
        totalFollowersGained,
        totalTweets,
        avgEngagementRate,
        activeAccounts: metrics.length
      };
    } catch (error) {
      logger.error('Failed to get today metrics:', error);
      return {};
    }
  }

  /**
   * Get system health status
   */
  private async getSystemHealth(): Promise<any> {
    try {
      const recentAlerts = await prisma.realTimeAlert.count({
        where: {
          status: 'active',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      return {
        status: recentAlerts === 0 ? 'healthy' : recentAlerts < 5 ? 'warning' : 'critical',
        activeAlerts: recentAlerts,
        connectedClients: this.clients.size,
        activeSubscriptions: this.subscriptions.size
      };
    } catch (error) {
      logger.error('Failed to get system health:', error);
      return { status: 'unknown' };
    }
  }

  /**
   * Start broadcast interval for regular updates
   */
  private async startBroadcastInterval(): Promise<void> {
    try {
      this.broadcastInterval = setInterval(async () => {
        // Broadcast system health updates
        await this.broadcastToChannel('system_health', {
          type: 'health_update',
          data: await this.getSystemHealth()
        });

        // Broadcast real-time metrics
        await this.broadcastToChannel('real_time_metrics', {
          type: 'metrics_update',
          data: await this.getTodayMetrics()
        });
      }, 30000); // Every 30 seconds

      logger.info('WebSocket broadcast interval started');
    } catch (error) {
      logger.error('Failed to start broadcast interval:', error);
    }
  }

  /**
   * Start cleanup interval for inactive clients
   */
  private async startCleanupInterval(): Promise<void> {
    try {
      this.cleanupInterval = setInterval(() => {
        this.cleanupInactiveClients();
        this.cleanupExpiredMessages();
      }, 5 * 60 * 1000); // Every 5 minutes

      logger.info('WebSocket cleanup interval started');
    } catch (error) {
      logger.error('Failed to start cleanup interval:', error);
    }
  }

  /**
   * Start metrics collection interval
   */
  private async startMetricsCollection(): Promise<void> {
    try {
      this.metricsInterval = setInterval(() => {
        this.collectWebSocketMetrics();
      }, 60 * 1000); // Every minute

      logger.info('WebSocket metrics collection started');
    } catch (error) {
      logger.error('Failed to start metrics collection:', error);
    }
  }

  /**
   * Cleanup inactive clients
   */
  private cleanupInactiveClients(): void {
    try {
      const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
      const now = Date.now();
      
      for (const [clientId, client] of this.clients) {
        if (now - client.lastActivity.getTime() > inactiveThreshold) {
          const socket = this.io.sockets.sockets.get(client.socketId);
          if (socket) {
            socket.disconnect(true);
          }
          this.handleClientDisconnection(clientId, 'inactive');
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup inactive clients:', error);
    }
  }

  /**
   * Cleanup expired messages
   */
  private cleanupExpiredMessages(): void {
    try {
      const now = Date.now();
      
      for (const [clientId, messages] of this.messageQueue) {
        const validMessages = messages.filter(msg => {
          const messageAge = now - msg.timestamp.getTime();
          return messageAge < (msg.ttl || 300) * 1000;
        });
        
        if (validMessages.length !== messages.length) {
          this.messageQueue.set(clientId, validMessages);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup expired messages:', error);
    }
  }

  /**
   * Collect WebSocket metrics
   */
  private collectWebSocketMetrics(): void {
    try {
      const metrics = {
        connectedClients: this.clients.size,
        activeSubscriptions: this.subscriptions.size,
        queuedMessages: Array.from(this.messageQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
        channelDistribution: Object.fromEntries(
          Array.from(this.subscriptions.entries()).map(([channel, clients]) => [channel, clients.size])
        ),
        timestamp: new Date()
      };

      logger.debug('WebSocket metrics:', metrics);
      
      // Store metrics in cache for monitoring
      cacheManager.set('websocket_metrics', metrics, 300); // 5 minutes
    } catch (error) {
      logger.error('Failed to collect WebSocket metrics:', error);
    }
  }

  /**
   * Get WebSocket statistics
   */
  getWebSocketStatistics(): {
    connectedClients: number;
    activeSubscriptions: number;
    queuedMessages: number;
    channelDistribution: { [key: string]: number };
    rateLimitHits: number;
  } {
    const channelDistribution: { [key: string]: number } = {};
    for (const [channel, clients] of this.subscriptions) {
      channelDistribution[channel] = clients.size;
    }

    const queuedMessages = Array.from(this.messageQueue.values())
      .reduce((sum, queue) => sum + queue.length, 0);

    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      queuedMessages,
      channelDistribution,
      rateLimitHits: 0 // Would track rate limit violations
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down Enterprise WebSocket Service...');
      
      // Clear intervals
      if (this.broadcastInterval) clearInterval(this.broadcastInterval);
      if (this.cleanupInterval) clearInterval(this.cleanupInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      
      // Disconnect all clients
      for (const client of this.clients.values()) {
        const socket = this.io.sockets.sockets.get(client.socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
      
      // Close server
      this.io.close();
      
      // Clear maps
      this.clients.clear();
      this.subscriptions.clear();
      this.messageQueue.clear();
      this.rateLimiters.clear();
      
      logger.info('✅ Enterprise WebSocket Service shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown WebSocket service:', error);
    }
  }
}
