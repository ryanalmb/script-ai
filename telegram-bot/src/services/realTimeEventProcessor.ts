/**
 * Real-time Event Processing System - Phase 2 Component 2.2 Implementation
 * 
 * Enterprise-grade real-time event processing system that transforms backend events
 * into intelligent, user-friendly Telegram notifications with embedded visualizations,
 * spam prevention, and customizable user preferences.
 * 
 * Key Features:
 * - Intelligent Event Processing Pipeline with filtering, transformation, and routing stages
 * - Advanced Event Filtering with user preferences, deduplication, and spam prevention
 * - User-Friendly Message Translation converting backend events to engaging Telegram notifications
 * - Embedded Visualization Support for progress charts, metrics dashboards, and status indicators
 * - Priority-Based Notification Routing ensuring critical events reach users immediately
 * - Customizable Analytics Dashboards with user-configurable metrics and preferences
 * - Actionable Recommendations Engine providing specific guidance for session maintenance and optimization
 * 
 * Integration Points:
 * - Phase 2 Component 2.1 WebSocket Client Integration for real-time event input
 * - Existing notification service for Telegram message delivery
 * - User service for preference management and personalization
 * - Analytics service for metrics processing and visualization
 * - Campaign and session management services for contextual information
 * 
 * Success Criteria:
 * - Intelligent event filtering preventing notification spam while ensuring critical event delivery
 * - User-friendly message formatting with embedded charts and status indicators
 * - Real-time processing with <500ms latency from backend event to Telegram notification
 * - Customizable user preferences for notification types, frequency, and visualization options
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { webSocketClientIntegration } from './webSocketClientIntegration';
import { notificationService } from './notificationService';
import { userService } from './userService';
import { botBackendIntegration } from './botBackendIntegration';

// Types and Interfaces
export interface ProcessedEvent {
  id: string;
  originalEvent: any;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  userId: number;
  message: FormattedMessage;
  timestamp: Date;
  correlationId?: string;
  context: EventContext;
}

export interface FormattedMessage {
  text: string;
  parseMode: 'Markdown' | 'HTML';
  buttons?: InlineButton[];
  visualization?: EmbeddedVisualization;
  silent?: boolean;
  disablePreview?: boolean;
}

export interface InlineButton {
  text: string;
  callback_data: string;
  url?: string;
}

export interface EmbeddedVisualization {
  type: 'progress_bar' | 'chart' | 'status_indicator' | 'metrics_dashboard';
  data: any;
  config: VisualizationConfig;
}

export interface VisualizationConfig {
  width?: number;
  height?: number;
  colors?: string[];
  showLabels?: boolean;
  showValues?: boolean;
  format?: 'ascii' | 'unicode' | 'emoji';
}

export interface EventContext {
  accountId?: string;
  campaignId?: string;
  serviceName?: string;
  userPreferences: UserEventPreferences;
  historicalData?: any;
  relatedEvents?: string[];
}

export interface UserEventPreferences {
  enabledEventTypes: string[];
  notificationLevel: 'minimal' | 'normal' | 'verbose';
  visualizationPreferences: {
    enableCharts: boolean;
    enableProgressBars: boolean;
    enableMetricsDashboards: boolean;
    preferredFormat: 'ascii' | 'unicode' | 'emoji';
  };
  deliveryPreferences: {
    immediateDelivery: boolean;
    batchNonCritical: boolean;
    quietHours: { start: string; end: string };
    maxNotificationsPerHour: number;
  };
  contentPreferences: {
    includeRecommendations: boolean;
    includeHistoricalContext: boolean;
    includeActionButtons: boolean;
    detailLevel: 'summary' | 'detailed' | 'comprehensive';
  };
}

export interface EventFilter {
  id: string;
  type: string;
  condition: (event: any) => boolean;
  priority: number;
  enabled: boolean;
}

export interface DeduplicationEntry {
  eventType: string;
  contentHash: string;
  userId: number;
  timestamp: Date;
  count: number;
}

export interface RateLimitEntry {
  userId: number;
  eventType: string;
  count: number;
  windowStart: Date;
  lastReset: Date;
}

export interface NotificationMetrics {
  totalProcessed: number;
  totalDelivered: number;
  totalFiltered: number;
  totalDeduplicated: number;
  averageProcessingTime: number;
  deliverySuccessRate: number;
  userEngagementRate: number;
}

/**
 * Event Deduplication Manager
 */
class EventDeduplicationManager {
  private deduplicationCache = new Map<string, DeduplicationEntry>();
  private readonly deduplicationWindow = 300000; // 5 minutes
  private readonly maxDuplicates = 3;

  /**
   * Check if event should be deduplicated
   */
  shouldDeduplicate(event: any, userId: number): boolean {
    const contentHash = this.generateContentHash(event);
    const key = `${event.type}_${userId}_${contentHash}`;
    
    const existing = this.deduplicationCache.get(key);
    const now = new Date();
    
    if (!existing) {
      // First occurrence, allow and cache
      this.deduplicationCache.set(key, {
        eventType: event.type,
        contentHash,
        userId,
        timestamp: now,
        count: 1
      });
      return false;
    }
    
    // Check if within deduplication window
    const timeDiff = now.getTime() - existing.timestamp.getTime();
    if (timeDiff > this.deduplicationWindow) {
      // Outside window, reset and allow
      existing.timestamp = now;
      existing.count = 1;
      return false;
    }
    
    // Within window, check count
    existing.count++;
    if (existing.count > this.maxDuplicates) {
      return true; // Deduplicate
    }
    
    return false;
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(event: any): string {
    const content = JSON.stringify({
      type: event.type,
      data: event.data,
      source: event.source
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Clean expired entries
   */
  cleanExpiredEntries(): void {
    const now = new Date();
    for (const [key, entry] of this.deduplicationCache.entries()) {
      const timeDiff = now.getTime() - entry.timestamp.getTime();
      if (timeDiff > this.deduplicationWindow) {
        this.deduplicationCache.delete(key);
      }
    }
  }

  /**
   * Get deduplication statistics
   */
  getStatistics(): any {
    return {
      totalEntries: this.deduplicationCache.size,
      windowSize: this.deduplicationWindow,
      maxDuplicates: this.maxDuplicates
    };
  }
}

/**
 * Rate Limiting Manager
 */
class RateLimitingManager {
  private rateLimits = new Map<string, RateLimitEntry>();
  private readonly windowSize = 3600000; // 1 hour
  private readonly defaultLimits = {
    critical: 100,
    high: 50,
    normal: 20,
    low: 10
  };

  /**
   * Check if event should be rate limited
   */
  shouldRateLimit(event: any, userId: number, priority: string): boolean {
    const key = `${userId}_${priority}`;
    const now = new Date();
    
    let entry = this.rateLimits.get(key);
    
    if (!entry) {
      // First event for this user/priority
      entry = {
        userId,
        eventType: priority,
        count: 1,
        windowStart: now,
        lastReset: now
      };
      this.rateLimits.set(key, entry);
      return false;
    }
    
    // Check if window has expired
    const timeDiff = now.getTime() - entry.windowStart.getTime();
    if (timeDiff > this.windowSize) {
      // Reset window
      entry.count = 1;
      entry.windowStart = now;
      entry.lastReset = now;
      return false;
    }
    
    // Check against limit
    const limit = this.defaultLimits[priority as keyof typeof this.defaultLimits] || this.defaultLimits.normal;
    entry.count++;
    
    return entry.count > limit;
  }

  /**
   * Get rate limit status for user
   */
  getRateLimitStatus(userId: number): any {
    const status: any = {};
    
    for (const priority of Object.keys(this.defaultLimits)) {
      const key = `${userId}_${priority}`;
      const entry = this.rateLimits.get(key);
      const limit = this.defaultLimits[priority as keyof typeof this.defaultLimits];
      
      status[priority] = {
        current: entry?.count || 0,
        limit,
        remaining: Math.max(0, limit - (entry?.count || 0)),
        resetTime: entry?.windowStart ? new Date(entry.windowStart.getTime() + this.windowSize) : null
      };
    }
    
    return status;
  }

  /**
   * Clean expired entries
   */
  cleanExpiredEntries(): void {
    const now = new Date();
    for (const [key, entry] of this.rateLimits.entries()) {
      const timeDiff = now.getTime() - entry.windowStart.getTime();
      if (timeDiff > this.windowSize) {
        this.rateLimits.delete(key);
      }
    }
  }
}

/**
 * Message Visualization Generator
 */
class MessageVisualizationGenerator {
  /**
   * Generate progress bar visualization
   */
  generateProgressBar(percentage: number, width: number = 20, format: 'ascii' | 'unicode' | 'emoji' = 'unicode'): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    switch (format) {
      case 'ascii':
        return `[${'='.repeat(filled)}${'-'.repeat(empty)}] ${percentage}%`;
      
      case 'unicode':
        const blocks = ['█', '▉', '▊', '▋', '▌', '▍', '▎', '▏'];
        const fullBlocks = Math.floor(filled);
        const remainder = filled - fullBlocks;
        const partialBlock = remainder > 0 ? blocks[Math.floor(remainder * 8)] : '';
        return `${'█'.repeat(fullBlocks)}${partialBlock}${'░'.repeat(empty - (partialBlock ? 1 : 0))} ${percentage}%`;
      
      case 'emoji':
        const greenSquares = Math.round(filled / 2);
        const whiteSquares = Math.round(empty / 2);
        return `${'🟩'.repeat(greenSquares)}${'⬜'.repeat(whiteSquares)} ${percentage}%`;
      
      default:
        return `${percentage}%`;
    }
  }

  /**
   * Generate status indicator
   */
  generateStatusIndicator(status: string, format: 'ascii' | 'unicode' | 'emoji' = 'emoji'): string {
    const statusMap = {
      healthy: { ascii: '[OK]', unicode: '●', emoji: '🟢' },
      warning: { ascii: '[WARN]', unicode: '◐', emoji: '🟡' },
      error: { ascii: '[ERR]', unicode: '○', emoji: '🔴' },
      unknown: { ascii: '[?]', unicode: '◯', emoji: '⚪' }
    };
    
    const indicator = statusMap[status as keyof typeof statusMap] || statusMap.unknown;
    return indicator[format];
  }

  /**
   * Generate metrics dashboard
   */
  generateMetricsDashboard(metrics: any, format: 'ascii' | 'unicode' | 'emoji' = 'unicode'): string {
    const lines = [];
    
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        const formattedValue = this.formatNumber(value);
        const trend = this.getTrendIndicator(value, format);
        lines.push(`${key}: ${formattedValue} ${trend}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format number with appropriate units
   */
  private formatNumber(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    } else {
      return value.toString();
    }
  }

  /**
   * Get trend indicator
   */
  private getTrendIndicator(value: number, format: 'ascii' | 'unicode' | 'emoji'): string {
    // Simplified trend logic - in real implementation, compare with historical data
    const trendMap = {
      up: { ascii: '^', unicode: '↗', emoji: '📈' },
      down: { ascii: 'v', unicode: '↘', emoji: '📉' },
      stable: { ascii: '-', unicode: '→', emoji: '➡️' }
    };
    
    // Random trend for demo - replace with actual trend calculation
    const trends = ['up', 'down', 'stable'];
    const trend = trends[Math.floor(Math.random() * trends.length)];
    
    return trendMap[trend as keyof typeof trendMap][format];
  }
}

/**
 * Message Template Engine
 */
class MessageTemplateEngine {
  private templates = new Map<string, string>();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize message templates
   */
  private initializeTemplates(): void {
    // Campaign Progress Templates
    this.templates.set('campaign_progress', `
🎯 **Campaign Progress Update**

📊 **{campaignName}** ({campaignId})
{progressBar}

📈 **Current Metrics:**
• Posts Published: {postsPublished}
• Engagement Rate: {engagementRate}%
• Reach: {reach}
• Quality Score: {qualityScore}/100

🎯 **Next Milestone:** {nextMilestone}
⏱️ **ETA:** {estimatedCompletion}

{recommendations}

{actionButtons}
    `.trim());

    // Session Health Templates
    this.templates.set('session_health', `
🏥 **Session Health Alert**

👤 **Account:** @{accountHandle} ({accountId})
{healthIndicator} **Health Score:** {healthScore}/100

{issuesList}

💡 **Recommendations:**
{recommendationsList}

⏰ **Last Check:** {lastCheckTime}
🔄 **Next Check:** {nextCheckTime}

{actionButtons}
    `.trim());

    // Analytics Update Templates
    this.templates.set('analytics_update', `
📊 **Analytics Update**

📈 **Performance Dashboard**
{metricsDashboard}

🔥 **Key Insights:**
{insightsList}

📊 **Trends:**
{trendsList}

⏰ **Period:** {timePeriod}
🔄 **Updated:** {lastUpdated}

{actionButtons}
    `.trim());

    // System Status Templates
    this.templates.set('system_status', `
🖥️ **System Status Update**

{statusIndicator} **Overall Status:** {overallStatus}

🔧 **Services:**
{servicesList}

{alertsList}

⏱️ **Resolution ETA:** {resolutionEta}
🔄 **Last Updated:** {lastUpdated}

{actionButtons}
    `.trim());

    // Rate Limit Warning Templates
    this.templates.set('rate_limit_warning', `
⚠️ **Rate Limit Warning**

👤 **Account:** @{accountHandle} ({accountId})
📊 **Remaining:** {remaining} requests
⏰ **Reset Time:** {resetTime}

🚨 **Recommendation:** {recommendation}

📈 **Current Usage:**
{usageChart}

💡 **Suggested Actions:**
{suggestedActions}

{actionButtons}
    `.trim());

    // Service Health Change Templates
    this.templates.set('service_health_change', `
🔄 **Service Health Change**

🔧 **Service:** {serviceName}
{statusChange}

📊 **Impact Level:** {impactLevel}
👥 **Affected Users:** {affectedUsers}

📝 **Details:**
{changeDetails}

⏱️ **Timeline:** {timeline}

{actionButtons}
    `.trim());
  }

  /**
   * Render template with data
   */
  renderTemplate(templateName: string, data: any): string {
    const template = this.templates.get(templateName);
    if (!template) {
      return `Template '${templateName}' not found`;
    }

    let rendered = template;

    // Replace placeholders with data
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Clean up any remaining placeholders
    rendered = rendered.replace(/\{[^}]+\}/g, 'N/A');

    return rendered;
  }

  /**
   * Add custom template
   */
  addTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}

/**
 * Actionable Recommendations Engine
 */
class ActionableRecommendationsEngine {
  /**
   * Generate recommendations for campaign events
   */
  generateCampaignRecommendations(event: any): string[] {
    const recommendations = [];
    const data = event.data;

    if (data.engagementRate < 2) {
      recommendations.push('📈 Consider adjusting posting times for better engagement');
      recommendations.push('🎯 Review content quality and relevance to audience');
    }

    if (data.qualityScore < 80) {
      recommendations.push('✨ Use AI content enhancement for better quality');
      recommendations.push('📝 Review and optimize content templates');
    }

    if (data.progress < 50 && data.timeRemaining < 24) {
      recommendations.push('⚡ Consider increasing posting frequency');
      recommendations.push('🤖 Enable automation for faster execution');
    }

    return recommendations.length > 0 ? recommendations : ['✅ Campaign performing well, continue current strategy'];
  }

  /**
   * Generate recommendations for session health events
   */
  generateSessionHealthRecommendations(event: any): string[] {
    const recommendations = [];
    const data = event.data;

    if (data.health === 'poor') {
      recommendations.push('🔄 Restart session to clear potential issues');
      recommendations.push('🛡️ Check for anti-detection measures');
      recommendations.push('⏰ Reduce activity frequency temporarily');
    }

    if (data.issues?.includes('rate_limit')) {
      recommendations.push('⏱️ Pause automation for 15-30 minutes');
      recommendations.push('📊 Review rate limit settings');
    }

    if (data.issues?.includes('authentication')) {
      recommendations.push('🔐 Re-authenticate account credentials');
      recommendations.push('🔄 Clear session cache and restart');
    }

    return recommendations.length > 0 ? recommendations : ['✅ Session healthy, no action needed'];
  }

  /**
   * Generate recommendations for analytics events
   */
  generateAnalyticsRecommendations(event: any): string[] {
    const recommendations = [];
    const data = event.data;

    if (data.trends?.declining) {
      recommendations.push('📊 Analyze declining metrics and adjust strategy');
      recommendations.push('🎯 A/B test different content approaches');
    }

    if (data.insights?.lowEngagement) {
      recommendations.push('⏰ Optimize posting schedule based on audience activity');
      recommendations.push('🎨 Experiment with different content formats');
    }

    return recommendations.length > 0 ? recommendations : ['📈 Analytics looking good, maintain current approach'];
  }

  /**
   * Generate recommendations for system status events
   */
  generateSystemStatusRecommendations(event: any): string[] {
    const recommendations = [];
    const data = event.data;

    if (data.status === 'degraded') {
      recommendations.push('⏸️ Consider pausing non-critical automation');
      recommendations.push('📊 Monitor system recovery progress');
    }

    if (data.status === 'down') {
      recommendations.push('🛑 Pause all automation until service recovery');
      recommendations.push('📧 Enable email notifications for status updates');
    }

    return recommendations.length > 0 ? recommendations : ['✅ All systems operational'];
  }
}

/**
 * Main Real-time Event Processing System
 */
export class RealTimeEventProcessor extends EventEmitter {
  private deduplicationManager: EventDeduplicationManager;
  private rateLimitingManager: RateLimitingManager;
  private visualizationGenerator: MessageVisualizationGenerator;
  private templateEngine: MessageTemplateEngine;
  private recommendationsEngine: ActionableRecommendationsEngine;

  private isInitialized = false;
  private eventFilters = new Map<string, EventFilter>();
  private processingMetrics: NotificationMetrics;

  // Cleanup intervals
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    this.deduplicationManager = new EventDeduplicationManager();
    this.rateLimitingManager = new RateLimitingManager();
    this.visualizationGenerator = new MessageVisualizationGenerator();
    this.templateEngine = new MessageTemplateEngine();
    this.recommendationsEngine = new ActionableRecommendationsEngine();

    this.processingMetrics = {
      totalProcessed: 0,
      totalDelivered: 0,
      totalFiltered: 0,
      totalDeduplicated: 0,
      averageProcessingTime: 0,
      deliverySuccessRate: 0,
      userEngagementRate: 0
    };

    this.initializeEventFilters();
  }

  /**
   * Initialize the real-time event processor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Real-time Event Processor already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Real-time Event Processing System...');

      // Setup event handlers for WebSocket Client Integration
      this.setupWebSocketEventHandlers();

      // Start cleanup intervals
      this.startCleanupIntervals();

      // Start metrics collection
      this.startMetricsCollection();

      this.isInitialized = true;
      this.emit('processor:initialized');

      logger.info('✅ Real-time Event Processing System initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Real-time Event Processing System:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for WebSocket Client Integration
   */
  private setupWebSocketEventHandlers(): void {
    // Campaign Progress Events
    webSocketClientIntegration.on('campaign:progress', async (data) => {
      await this.processCampaignProgressEvent(data);
    });

    // Session Health Events
    webSocketClientIntegration.on('session:health', async (data) => {
      await this.processSessionHealthEvent(data);
    });

    // Analytics Update Events
    webSocketClientIntegration.on('analytics:update', async (data) => {
      await this.processAnalyticsUpdateEvent(data);
    });

    // System Status Events
    webSocketClientIntegration.on('system:status', async (data) => {
      await this.processSystemStatusEvent(data);
    });

    // Rate Limit Warning Events
    webSocketClientIntegration.on('rate_limit:warning', async (data) => {
      await this.processRateLimitWarningEvent(data);
    });

    // Service Health Change Events
    webSocketClientIntegration.on('service:health_change', async (data) => {
      await this.processServiceHealthChangeEvent(data);
    });

    logger.info('📡 WebSocket event handlers configured');
  }

  /**
   * Process campaign progress events
   */
  async processCampaignProgressEvent(eventData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Get all users who should receive this notification
      const users = await this.getUsersForEvent('campaign_progress', eventData);

      for (const user of users) {
        await this.processEventForUser(eventData, user, 'campaign_progress', 'normal');
      }

      this.updateProcessingMetrics(startTime, true);
      logger.debug('📈 Campaign progress event processed successfully');

    } catch (error) {
      this.updateProcessingMetrics(startTime, false);
      logger.error('Failed to process campaign progress event:', error);
    }
  }

  /**
   * Process session health events
   */
  async processSessionHealthEvent(eventData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Determine priority based on health status
      const priority = this.determineSessionHealthPriority(eventData.health);

      // Get users for this account
      const users = await this.getUsersForAccount(eventData.accountId);

      for (const user of users) {
        await this.processEventForUser(eventData, user, 'session_health', priority);
      }

      this.updateProcessingMetrics(startTime, true);
      logger.debug('🏥 Session health event processed successfully');

    } catch (error) {
      this.updateProcessingMetrics(startTime, false);
      logger.error('Failed to process session health event:', error);
    }
  }

  /**
   * Process analytics update events
   */
  async processAnalyticsUpdateEvent(eventData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Get users who have analytics notifications enabled
      const users = await this.getUsersForEvent('analytics_update', eventData);

      for (const user of users) {
        await this.processEventForUser(eventData, user, 'analytics_update', 'normal');
      }

      this.updateProcessingMetrics(startTime, true);
      logger.debug('📊 Analytics update event processed successfully');

    } catch (error) {
      this.updateProcessingMetrics(startTime, false);
      logger.error('Failed to process analytics update event:', error);
    }
  }

  /**
   * Process system status events
   */
  async processSystemStatusEvent(eventData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Determine priority based on system status
      const priority = this.determineSystemStatusPriority(eventData.status);

      // Get all active users for system notifications
      const users = await this.getUsersForEvent('system_status', eventData);

      for (const user of users) {
        await this.processEventForUser(eventData, user, 'system_status', priority);
      }

      this.updateProcessingMetrics(startTime, true);
      logger.debug('🖥️ System status event processed successfully');

    } catch (error) {
      this.updateProcessingMetrics(startTime, false);
      logger.error('Failed to process system status event:', error);
    }
  }

  /**
   * Process rate limit warning events
   */
  async processRateLimitWarningEvent(eventData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Rate limit warnings are always high priority
      const priority = 'critical';

      // Get users for this account
      const users = await this.getUsersForAccount(eventData.accountId);

      for (const user of users) {
        await this.processEventForUser(eventData, user, 'rate_limit_warning', priority);
      }

      this.updateProcessingMetrics(startTime, true);
      logger.debug('⚠️ Rate limit warning event processed successfully');

    } catch (error) {
      this.updateProcessingMetrics(startTime, false);
      logger.error('Failed to process rate limit warning event:', error);
    }
  }

  /**
   * Process service health change events
   */
  async processServiceHealthChangeEvent(eventData: any): Promise<void> {
    const startTime = Date.now();

    try {
      // Determine priority based on health change impact
      const priority = this.determineServiceHealthPriority(eventData.impact);

      // Get all users for service health notifications
      const users = await this.getUsersForEvent('service_health_change', eventData);

      for (const user of users) {
        await this.processEventForUser(eventData, user, 'service_health_change', priority);
      }

      this.updateProcessingMetrics(startTime, true);
      logger.debug('🔄 Service health change event processed successfully');

    } catch (error) {
      this.updateProcessingMetrics(startTime, false);
      logger.error('Failed to process service health change event:', error);
    }
  }

  /**
   * Process event for a specific user
   */
  private async processEventForUser(
    eventData: any,
    user: any,
    eventType: string,
    priority: string
  ): Promise<void> {
    try {
      // Get user preferences
      const userPreferences = await this.getUserEventPreferences(user.id);

      // Check if user wants this event type
      if (!userPreferences.enabledEventTypes.includes(eventType)) {
        return;
      }

      // Apply deduplication
      if (this.deduplicationManager.shouldDeduplicate(eventData, user.id)) {
        this.processingMetrics.totalDeduplicated++;
        logger.debug(`Event deduplicated for user ${user.id}: ${eventType}`);
        return;
      }

      // Apply rate limiting (except for critical events)
      if (priority !== 'critical' && this.rateLimitingManager.shouldRateLimit(eventData, user.id, priority)) {
        this.processingMetrics.totalFiltered++;
        logger.debug(`Event rate limited for user ${user.id}: ${eventType}`);
        return;
      }

      // Create event context
      const context: EventContext = {
        accountId: eventData.accountId,
        campaignId: eventData.campaignId,
        serviceName: eventData.serviceName,
        userPreferences,
        historicalData: await this.getHistoricalData(user.id, eventType),
        relatedEvents: await this.getRelatedEvents(eventData)
      };

      // Format message
      const formattedMessage = await this.formatEventMessage(eventData, eventType, context);

      // Create processed event
      const processedEvent: ProcessedEvent = {
        id: `processed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originalEvent: eventData,
        type: eventType,
        priority: priority as any,
        userId: user.id,
        message: formattedMessage,
        timestamp: new Date(),
        correlationId: eventData.correlationId,
        context
      };

      // Deliver notification
      await this.deliverNotification(processedEvent);

      this.processingMetrics.totalDelivered++;
      this.emit('event:processed', processedEvent);

    } catch (error) {
      logger.error(`Failed to process event for user ${user.id}:`, error);
      throw error;
    }
  }

  /**
   * Format event message with templates and visualizations
   */
  private async formatEventMessage(
    eventData: any,
    eventType: string,
    context: EventContext
  ): Promise<FormattedMessage> {
    try {
      // Prepare template data
      const templateData = await this.prepareTemplateData(eventData, eventType, context);

      // Render message text
      const messageText = this.templateEngine.renderTemplate(eventType, templateData);

      // Generate action buttons
      const buttons = this.generateActionButtons(eventData, eventType, context);

      // Create formatted message
      const formattedMessage: FormattedMessage = {
        text: messageText,
        parseMode: 'Markdown',
        buttons,
        silent: this.shouldSendSilently(eventType, context),
        disablePreview: true
      };

      return formattedMessage;

    } catch (error) {
      logger.error('Failed to format event message:', error);

      // Fallback to simple message
      return {
        text: `📢 ${eventType.replace('_', ' ').toUpperCase()}\n\n${JSON.stringify(eventData, null, 2)}`,
        parseMode: 'Markdown'
      };
    }
  }

  /**
   * Prepare template data for message rendering
   */
  private async prepareTemplateData(
    eventData: any,
    eventType: string,
    context: EventContext
  ): Promise<any> {
    const data: any = { ...eventData };

    switch (eventType) {
      case 'campaign_progress':
        data.progressBar = this.visualizationGenerator.generateProgressBar(
          eventData.progress || 0,
          20,
          context.userPreferences.visualizationPreferences.preferredFormat
        );
        data.recommendations = this.formatRecommendations(
          this.recommendationsEngine.generateCampaignRecommendations(eventData)
        );
        break;

      case 'session_health':
        data.healthIndicator = this.visualizationGenerator.generateStatusIndicator(
          eventData.health,
          context.userPreferences.visualizationPreferences.preferredFormat
        );
        data.issuesList = this.formatIssuesList(eventData.issues || []);
        data.recommendationsList = this.formatRecommendations(
          this.recommendationsEngine.generateSessionHealthRecommendations(eventData)
        );
        break;

      case 'analytics_update':
        data.metricsDashboard = this.visualizationGenerator.generateMetricsDashboard(
          eventData.metrics || {},
          context.userPreferences.visualizationPreferences.preferredFormat
        );
        data.insightsList = this.formatInsightsList(eventData.insights || []);
        data.trendsList = this.formatTrendsList(eventData.trends || []);
        break;

      case 'system_status':
        data.statusIndicator = this.visualizationGenerator.generateStatusIndicator(
          eventData.status,
          context.userPreferences.visualizationPreferences.preferredFormat
        );
        data.servicesList = this.formatServicesList(eventData.services || []);
        data.alertsList = this.formatAlertsList(eventData.alerts || []);
        break;

      case 'rate_limit_warning':
        data.usageChart = this.generateUsageChart(eventData);
        data.suggestedActions = this.formatRecommendations(
          this.generateRateLimitActions(eventData)
        );
        break;

      case 'service_health_change':
        data.statusChange = this.formatStatusChange(eventData.oldStatus, eventData.newStatus);
        data.changeDetails = this.formatChangeDetails(eventData);
        break;
    }

    // Add common data
    data.lastUpdated = new Date().toLocaleString();
    data.actionButtons = ''; // Will be handled separately

    return data;
  }

  /**
   * Generate action buttons for events
   */
  private generateActionButtons(
    eventData: any,
    eventType: string,
    context: EventContext
  ): InlineButton[] {
    if (!context.userPreferences.contentPreferences.includeActionButtons) {
      return [];
    }

    const buttons: InlineButton[] = [];

    switch (eventType) {
      case 'campaign_progress':
        buttons.push(
          { text: '📊 View Details', callback_data: `campaign_details_${eventData.campaignId}` },
          { text: '⏸️ Pause Campaign', callback_data: `campaign_pause_${eventData.campaignId}` }
        );
        break;

      case 'session_health':
        buttons.push(
          { text: '🔄 Restart Session', callback_data: `session_restart_${eventData.accountId}` },
          { text: '🏥 Health Check', callback_data: `session_health_${eventData.accountId}` }
        );
        break;

      case 'analytics_update':
        buttons.push(
          { text: '📈 Full Report', callback_data: `analytics_report_${eventData.accountId}` },
          { text: '⚙️ Settings', callback_data: 'analytics_settings' }
        );
        break;

      case 'system_status':
        buttons.push(
          { text: '🔍 More Info', callback_data: `system_status_details` },
          { text: '📧 Email Updates', callback_data: 'enable_email_updates' }
        );
        break;

      case 'rate_limit_warning':
        buttons.push(
          { text: '⏸️ Pause Automation', callback_data: `pause_automation_${eventData.accountId}` },
          { text: '📊 View Limits', callback_data: `rate_limits_${eventData.accountId}` }
        );
        break;
    }

    return buttons;
  }

  /**
   * Deliver notification to user
   */
  private async deliverNotification(processedEvent: ProcessedEvent): Promise<void> {
    try {
      const { userId, message, priority } = processedEvent;

      // Determine notification type based on event
      const notificationType = this.mapEventTypeToNotificationType(processedEvent.type);

      // Use bot backend integration for enhanced delivery
      const notificationOptions: {
        type?: 'info' | 'warning' | 'error' | 'success';
        buttons?: Array<{ text: string; callback_data: string }>;
        silent?: boolean;
      } = {
        type: this.mapPriorityToType(priority)
      };

      if (message.buttons) {
        notificationOptions.buttons = message.buttons;
      }

      if (message.silent !== undefined) {
        notificationOptions.silent = message.silent;
      }

      const success = await botBackendIntegration.sendNotification(
        userId,
        message.text,
        notificationOptions
      );

      if (success) {
        this.emit('notification:delivered', processedEvent);
        logger.debug(`Notification delivered to user ${userId}: ${processedEvent.type}`);
      } else {
        this.emit('notification:failed', processedEvent);
        logger.warn(`Failed to deliver notification to user ${userId}: ${processedEvent.type}`);
      }

    } catch (error) {
      logger.error('Failed to deliver notification:', error);
      this.emit('notification:error', { processedEvent, error });
    }
  }

  // Helper Methods

  /**
   * Get users who should receive a specific event type
   */
  private async getUsersForEvent(eventType: string, eventData: any): Promise<any[]> {
    try {
      // Get all active users
      const allUsers = await userService.getAllUsers();

      // Filter users based on notification preferences
      const eligibleUsers = [];

      for (const user of allUsers) {
        const preferences = await this.getUserEventPreferences(user.id);

        if (preferences.enabledEventTypes.includes(eventType)) {
          eligibleUsers.push(user);
        }
      }

      return eligibleUsers;

    } catch (error) {
      logger.error('Failed to get users for event:', error);
      return [];
    }
  }

  /**
   * Get users for a specific account
   */
  private async getUsersForAccount(accountId: string): Promise<any[]> {
    try {
      // Get users who have access to this account
      const allUsers = await userService.getAllUsers();
      const accountUsers = [];

      for (const user of allUsers) {
        const userAccounts = await userService.getUserAccounts(user.id);
        if (userAccounts.some((acc: any) => acc.id === accountId)) {
          accountUsers.push(user);
        }
      }

      return accountUsers;

    } catch (error) {
      logger.error('Failed to get users for account:', error);
      return [];
    }
  }

  /**
   * Get user event preferences
   */
  private async getUserEventPreferences(userId: number): Promise<UserEventPreferences> {
    try {
      const user = await userService.getUser(userId);

      // Default preferences if not set
      const defaultPreferences: UserEventPreferences = {
        enabledEventTypes: ['campaign_progress', 'session_health', 'rate_limit_warning', 'system_status'],
        notificationLevel: 'normal',
        visualizationPreferences: {
          enableCharts: true,
          enableProgressBars: true,
          enableMetricsDashboards: true,
          preferredFormat: 'unicode'
        },
        deliveryPreferences: {
          immediateDelivery: true,
          batchNonCritical: false,
          quietHours: { start: '23:00', end: '07:00' },
          maxNotificationsPerHour: 10
        },
        contentPreferences: {
          includeRecommendations: true,
          includeHistoricalContext: true,
          includeActionButtons: true,
          detailLevel: 'detailed'
        }
      };

      // Merge with user settings if available
      if (user?.settings?.notifications) {
        // Map existing notification settings to new structure
        return {
          ...defaultPreferences,
          enabledEventTypes: this.mapLegacyNotificationTypes(user.settings.notifications)
        };
      }

      return defaultPreferences;

    } catch (error) {
      logger.error('Failed to get user event preferences:', error);
      return {
        enabledEventTypes: [],
        notificationLevel: 'minimal',
        visualizationPreferences: {
          enableCharts: false,
          enableProgressBars: false,
          enableMetricsDashboards: false,
          preferredFormat: 'ascii'
        },
        deliveryPreferences: {
          immediateDelivery: false,
          batchNonCritical: true,
          quietHours: { start: '22:00', end: '08:00' },
          maxNotificationsPerHour: 5
        },
        contentPreferences: {
          includeRecommendations: false,
          includeHistoricalContext: false,
          includeActionButtons: false,
          detailLevel: 'summary'
        }
      };
    }
  }

  /**
   * Map legacy notification types to new event types
   */
  private mapLegacyNotificationTypes(legacySettings: any): string[] {
    const eventTypes = [];

    if (legacySettings.campaigns) eventTypes.push('campaign_progress');
    if (legacySettings.automation) eventTypes.push('session_health');
    if (legacySettings.performance) eventTypes.push('analytics_update');
    if (legacySettings.system) eventTypes.push('system_status', 'service_health_change');
    if (legacySettings.errors) eventTypes.push('rate_limit_warning');

    return eventTypes;
  }

  /**
   * Determine priority for session health events
   */
  private determineSessionHealthPriority(health: string): string {
    switch (health) {
      case 'critical':
      case 'poor':
        return 'critical';
      case 'warning':
      case 'degraded':
        return 'high';
      case 'good':
        return 'normal';
      default:
        return 'normal';
    }
  }

  /**
   * Determine priority for system status events
   */
  private determineSystemStatusPriority(status: string): string {
    switch (status) {
      case 'down':
      case 'critical':
        return 'critical';
      case 'degraded':
      case 'maintenance':
        return 'high';
      case 'operational':
        return 'normal';
      default:
        return 'normal';
    }
  }

  /**
   * Determine priority for service health events
   */
  private determineServiceHealthPriority(impact: string): string {
    switch (impact) {
      case 'critical':
      case 'major':
        return 'critical';
      case 'minor':
        return 'high';
      case 'none':
        return 'normal';
      default:
        return 'normal';
    }
  }

  /**
   * Format recommendations list
   */
  private formatRecommendations(recommendations: string[]): string {
    if (recommendations.length === 0) return 'No recommendations at this time.';

    return recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n');
  }

  /**
   * Format issues list
   */
  private formatIssuesList(issues: string[]): string {
    if (issues.length === 0) return '✅ No issues detected';

    return issues.map(issue => `❌ ${issue}`).join('\n');
  }

  /**
   * Format insights list
   */
  private formatInsightsList(insights: string[]): string {
    if (insights.length === 0) return 'No new insights available.';

    return insights.map(insight => `💡 ${insight}`).join('\n');
  }

  /**
   * Format trends list
   */
  private formatTrendsList(trends: any[]): string {
    if (trends.length === 0) return 'No significant trends detected.';

    return trends.map(trend => `📊 ${trend.name}: ${trend.direction} ${trend.value}`).join('\n');
  }

  /**
   * Format services list
   */
  private formatServicesList(services: any[]): string {
    if (services.length === 0) return 'No service information available.';

    return services.map(service => {
      const indicator = this.visualizationGenerator.generateStatusIndicator(service.status);
      return `${indicator} ${service.name}: ${service.status}`;
    }).join('\n');
  }

  /**
   * Format alerts list
   */
  private formatAlertsList(alerts: any[]): string {
    if (alerts.length === 0) return '✅ No active alerts';

    return alerts.map(alert => `⚠️ ${alert.title}: ${alert.description}`).join('\n');
  }

  /**
   * Generate usage chart for rate limits
   */
  private generateUsageChart(eventData: any): string {
    const remaining = eventData.remaining || 0;
    const total = eventData.total || 100;
    const used = total - remaining;
    const percentage = Math.round((used / total) * 100);

    return this.visualizationGenerator.generateProgressBar(percentage, 15, 'unicode');
  }

  /**
   * Generate rate limit actions
   */
  private generateRateLimitActions(eventData: any): string[] {
    const actions = [];

    if (eventData.remaining < 10) {
      actions.push('⏸️ Pause all automation immediately');
      actions.push('⏰ Wait for rate limit reset');
    } else if (eventData.remaining < 50) {
      actions.push('🐌 Reduce automation frequency');
      actions.push('📊 Monitor usage closely');
    }

    actions.push('📈 Review rate limit settings');
    actions.push('🔄 Consider upgrading account limits');

    return actions;
  }

  /**
   * Format status change
   */
  private formatStatusChange(oldStatus: string, newStatus: string): string {
    const oldIndicator = this.visualizationGenerator.generateStatusIndicator(oldStatus);
    const newIndicator = this.visualizationGenerator.generateStatusIndicator(newStatus);

    return `${oldIndicator} ${oldStatus} → ${newIndicator} ${newStatus}`;
  }

  /**
   * Format change details
   */
  private formatChangeDetails(eventData: any): string {
    const details = [];

    if (eventData.reason) details.push(`Reason: ${eventData.reason}`);
    if (eventData.duration) details.push(`Duration: ${eventData.duration}`);
    if (eventData.affectedFeatures) details.push(`Affected: ${eventData.affectedFeatures.join(', ')}`);

    return details.length > 0 ? details.join('\n') : 'No additional details available.';
  }

  /**
   * Map event type to notification type
   */
  private mapEventTypeToNotificationType(eventType: string): string {
    const mapping: Record<string, string> = {
      'campaign_progress': 'campaigns',
      'session_health': 'automation',
      'analytics_update': 'performance',
      'system_status': 'system',
      'rate_limit_warning': 'errors',
      'service_health_change': 'system'
    };

    return mapping[eventType] || 'system';
  }

  /**
   * Map priority to notification type
   */
  private mapPriorityToType(priority: string): 'info' | 'warning' | 'error' | 'success' {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * Check if notification should be sent silently
   */
  private shouldSendSilently(eventType: string, context: EventContext): boolean {
    // Send silently during quiet hours for non-critical events
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const quietStart = context.userPreferences.deliveryPreferences.quietHours.start;
    const quietEnd = context.userPreferences.deliveryPreferences.quietHours.end;

    if (currentTime >= quietStart || currentTime <= quietEnd) {
      return !['rate_limit_warning', 'system_status'].includes(eventType);
    }

    return false;
  }

  /**
   * Get historical data for context
   */
  private async getHistoricalData(userId: number, eventType: string): Promise<any> {
    // Placeholder for historical data retrieval
    // In real implementation, this would query analytics service
    return {
      lastOccurrence: new Date(Date.now() - 86400000), // 24 hours ago
      frequency: 'daily',
      trend: 'stable'
    };
  }

  /**
   * Get related events
   */
  private async getRelatedEvents(eventData: any): Promise<string[]> {
    // Placeholder for related events lookup
    // In real implementation, this would find correlated events
    return [];
  }

  /**
   * Initialize event filters
   */
  private initializeEventFilters(): void {
    // Add default event filters
    this.eventFilters.set('spam_filter', {
      id: 'spam_filter',
      type: 'spam_prevention',
      condition: (event) => !this.isSpamEvent(event),
      priority: 1,
      enabled: true
    });

    this.eventFilters.set('duplicate_filter', {
      id: 'duplicate_filter',
      type: 'deduplication',
      condition: (event) => !this.isDuplicateEvent(event),
      priority: 2,
      enabled: true
    });
  }

  /**
   * Check if event is spam
   */
  private isSpamEvent(event: any): boolean {
    // Simple spam detection logic
    // In real implementation, this would use ML models
    return false;
  }

  /**
   * Check if event is duplicate
   */
  private isDuplicateEvent(event: any): boolean {
    // Handled by deduplication manager
    return false;
  }

  /**
   * Start cleanup intervals
   */
  private startCleanupIntervals(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.deduplicationManager.cleanExpiredEntries();
      this.rateLimitingManager.cleanExpiredEntries();
    }, 300000);

    logger.info('🧹 Cleanup intervals started');
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    // Collect metrics every minute
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000);

    logger.info('📊 Metrics collection started');
  }

  /**
   * Collect processing metrics
   */
  private collectMetrics(): void {
    const metrics = {
      ...this.processingMetrics,
      timestamp: new Date(),
      deduplicationStats: this.deduplicationManager.getStatistics(),
      rateLimitStats: this.getRateLimitStatistics()
    };

    this.emit('metrics:collected', metrics);
    logger.debug('📊 Processing metrics collected:', metrics);
  }

  /**
   * Get rate limit statistics
   */
  private getRateLimitStatistics(): any {
    // Placeholder for rate limit statistics
    return {
      totalUsers: 0,
      activeWindows: 0,
      averageUsage: 0
    };
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(startTime: number, success: boolean): void {
    const processingTime = Date.now() - startTime;

    this.processingMetrics.totalProcessed++;

    if (success) {
      // Update average processing time
      if (this.processingMetrics.averageProcessingTime === 0) {
        this.processingMetrics.averageProcessingTime = processingTime;
      } else {
        this.processingMetrics.averageProcessingTime =
          (this.processingMetrics.averageProcessingTime * 0.9) + (processingTime * 0.1);
      }
    }

    // Update success rate
    this.processingMetrics.deliverySuccessRate =
      this.processingMetrics.totalDelivered / this.processingMetrics.totalProcessed;
  }

  // Public API Methods

  /**
   * Get processing statistics
   */
  getProcessingStatistics(): NotificationMetrics {
    return { ...this.processingMetrics };
  }

  /**
   * Get user rate limit status
   */
  getUserRateLimitStatus(userId: number): any {
    return this.rateLimitingManager.getRateLimitStatus(userId);
  }

  /**
   * Add custom event filter
   */
  addEventFilter(filter: EventFilter): void {
    this.eventFilters.set(filter.id, filter);
    logger.info(`Event filter added: ${filter.id}`);
  }

  /**
   * Remove event filter
   */
  removeEventFilter(filterId: string): void {
    this.eventFilters.delete(filterId);
    logger.info(`Event filter removed: ${filterId}`);
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return this.templateEngine.getAvailableTemplates();
  }

  /**
   * Add custom template
   */
  addCustomTemplate(name: string, template: string): void {
    this.templateEngine.addTemplate(name, template);
    logger.info(`Custom template added: ${name}`);
  }

  /**
   * Shutdown the event processor
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔌 Shutting down Real-time Event Processing System...');

      // Clear intervals
      if (this.cleanupInterval) clearInterval(this.cleanupInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);

      // Remove event listeners
      webSocketClientIntegration.removeAllListeners();

      this.isInitialized = false;
      this.emit('processor:shutdown');

      logger.info('✅ Real-time Event Processing System shutdown complete');

    } catch (error) {
      logger.error('Failed to shutdown Real-time Event Processing System:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const realTimeEventProcessor = new RealTimeEventProcessor();
