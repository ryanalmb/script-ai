/**
 * Detection Monitor
 * Monitors and responds to detection events in real-time
 */

import { PrismaClient } from '@prisma/client';
import Redis, { Redis as RedisType } from 'ioredis';
import { EventEmitter } from 'events';
import { AntiDetectionConfig, DetectionType } from '../../config/antiDetection';
import { logger } from '../../utils/logger';

export interface DetectionEvent {
  type: DetectionType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  context: {
    sessionId?: string;
    accountId?: string;
    identityProfileId?: string;
    proxyId?: string;
    userAgent?: string;
    ipAddress?: string;
    action: string;
    metadata?: Record<string, any>;
  };
  detectionData: any;
  timestamp: Date;
}

export interface DetectionResponse {
  action: 'IGNORE' | 'COOLDOWN' | 'ROTATE_PROFILE' | 'ROTATE_PROXY' | 'SUSPEND_ACCOUNT';
  duration?: number; // in seconds
  reason: string;
}

export class DetectionMonitor extends EventEmitter {
  private prisma: PrismaClient;
  private redis: RedisType;
  private config: AntiDetectionConfig;
  private detectionCache: Map<string, DetectionEvent[]> = new Map();
  private isInitialized: boolean = false;

  // Detection pattern analysis
  private detectionPatterns: Map<string, {
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    severity: string;
  }> = new Map();

  // Response cooldowns
  private responseCooldowns: Map<string, Date> = new Map();

  constructor(prisma: PrismaClient, redis: RedisType, config: AntiDetectionConfig) {
    super();
    this.prisma = prisma;
    this.redis = redis;
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Detection Monitor...');

      // Load recent detection events
      await this.loadRecentDetectionEvents();

      // Setup Redis subscriptions for detection coordination
      await this.setupRedisSubscriptions();

      // Start background analysis tasks
      this.startBackgroundTasks();

      this.isInitialized = true;
      logger.info('Detection Monitor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Detection Monitor:', error);
      throw error;
    }
  }

  /**
   * Record detection event
   */
  public async recordDetectionEvent(event: DetectionEvent): Promise<void> {
    try {
      // Store in database
      const detectionRecord = await this.prisma.detectionEvent.create({
        data: {
          identityProfileId: event.context.identityProfileId || null,
          sessionId: event.context.sessionId || null,
          accountId: event.context.accountId || null,
          detectionType: event.type,
          detectionSource: this.inferDetectionSource(event),
          severity: event.severity,
          detectionData: event.detectionData,
          userAgent: event.context.userAgent || null,
          ipAddress: event.context.ipAddress || null,
          proxyId: event.context.proxyId || null,
          metadata: event.context.metadata || {},
          timestamp: event.timestamp,
        },
      });

      // Update local cache
      const cacheKey = event.context.sessionId || event.context.accountId || 'unknown';
      if (!this.detectionCache.has(cacheKey)) {
        this.detectionCache.set(cacheKey, []);
      }
      const cacheEntry = this.detectionCache.get(cacheKey);
      if (cacheEntry) {
        cacheEntry.push(event);
      }

      // Analyze detection patterns
      await this.analyzeDetectionPattern(event);

      // Determine response
      const response = await this.determineResponse(event);

      // Execute response if needed
      if (response.action !== 'IGNORE') {
        await this.executeResponse(event, response);
      }

      logger.info(`Recorded detection event: ${event.type} (${event.severity})`, {
        sessionId: event.context.sessionId,
        accountId: event.context.accountId,
        response: response.action,
      });

      this.emit('detectionEvent', { event, response });
    } catch (error) {
      logger.error('Failed to record detection event:', error);
      throw error;
    }
  }

  /**
   * Analyze detection trends
   */
  public async analyzeDetectionTrends(
    timeWindow: number = 3600000 // 1 hour
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topTargets: Array<{ target: string; count: number }>;
    riskScore: number;
  }> {
    try {
      const since = new Date(Date.now() - timeWindow);

      const events = await this.prisma.detectionEvent.findMany({
        where: {
          timestamp: { gte: since },
        },
        select: {
          detectionType: true,
          severity: true,
          accountId: true,
          sessionId: true,
        },
      });

      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      const targetCounts: Record<string, number> = {};

      events.forEach(event => {
        // Count by type
        eventsByType[event.detectionType] = (eventsByType[event.detectionType] || 0) + 1;

        // Count by severity
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

        // Count by target (account or session)
        const target = event.accountId || event.sessionId || 'unknown';
        targetCounts[target] = (targetCounts[target] || 0) + 1;
      });

      const topTargets = Object.entries(targetCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([target, count]) => ({ target, count }));

      // Calculate risk score
      const riskScore = this.calculateRiskScore(events);

      return {
        totalEvents: events.length,
        eventsByType,
        eventsBySeverity,
        topTargets,
        riskScore,
      };
    } catch (error) {
      logger.error('Failed to analyze detection trends:', error);
      throw error;
    }
  }

  /**
   * Get detection statistics
   */
  public async getStatistics(): Promise<any> {
    try {
      const last24h = new Date(Date.now() - 86400000);
      const last1h = new Date(Date.now() - 3600000);

      const [total24h, total1h, criticalEvents] = await Promise.all([
        this.prisma.detectionEvent.count({
          where: { timestamp: { gte: last24h } },
        }),
        this.prisma.detectionEvent.count({
          where: { timestamp: { gte: last1h } },
        }),
        this.prisma.detectionEvent.count({
          where: {
            severity: 'CRITICAL',
            timestamp: { gte: last24h },
          },
        }),
      ]);

      return {
        isInitialized: this.isInitialized,
        cachedSessions: this.detectionCache.size,
        detectionPatterns: this.detectionPatterns.size,
        activeCooldowns: this.responseCooldowns.size,
        events24h: total24h,
        events1h: total1h,
        criticalEvents24h: criticalEvents,
      };
    } catch (error) {
      logger.error('Failed to get detection statistics:', error);
      return {};
    }
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(config: AntiDetectionConfig): Promise<void> {
    this.config = config;
    logger.info('Detection Monitor configuration updated');
  }

  /**
   * Shutdown
   */
  public async shutdown(): Promise<void> {
    this.detectionCache.clear();
    this.detectionPatterns.clear();
    this.responseCooldowns.clear();
    this.isInitialized = false;
    logger.info('Detection Monitor shut down');
  }

  // Private helper methods
  private async loadRecentDetectionEvents(): Promise<void> {
    try {
      const recentEvents = await this.prisma.detectionEvent.findMany({
        where: {
          timestamp: { gte: new Date(Date.now() - 3600000) }, // Last hour
        },
        take: 1000,
      });

      // Group by session/account
      recentEvents.forEach(event => {
        const cacheKey = event.sessionId || event.accountId || 'unknown';
        if (!this.detectionCache.has(cacheKey)) {
          this.detectionCache.set(cacheKey, []);
        }

        const detectionEvent: DetectionEvent = {
          type: event.detectionType as DetectionType,
          severity: event.severity as any,
          context: {
            ...(event.sessionId && { sessionId: event.sessionId }),
            ...(event.accountId && { accountId: event.accountId }),
            ...(event.identityProfileId && { identityProfileId: event.identityProfileId }),
            ...(event.proxyId && { proxyId: event.proxyId }),
            ...(event.userAgent && { userAgent: event.userAgent }),
            ...(event.ipAddress && { ipAddress: event.ipAddress }),
            action: 'unknown',
            ...(event.metadata && typeof event.metadata === 'object' && { metadata: event.metadata as Record<string, any> })
          },
          detectionData: event.detectionData,
          timestamp: event.timestamp,
        };

        this.detectionCache.get(cacheKey)!.push(detectionEvent);
      });

      logger.debug(`Loaded ${recentEvents.length} recent detection events`);
    } catch (error) {
      logger.error('Failed to load recent detection events:', error);
    }
  }

  private async setupRedisSubscriptions(): Promise<void> {
    // Setup Redis subscriptions for detection coordination
    // Implementation would subscribe to detection channels
  }

  private startBackgroundTasks(): void {
    // Clean up old detection events every hour
    setInterval(() => {
      this.cleanupOldEvents();
    }, 3600000);

    // Analyze patterns every 15 minutes
    setInterval(() => {
      this.analyzeGlobalPatterns();
    }, 900000);
  }

  private inferDetectionSource(event: DetectionEvent): string {
    // Infer detection source based on event characteristics
    if (event.type === 'CAPTCHA') {
      return 'CLOUDFLARE';
    } else if (event.type === 'RATE_LIMIT') {
      return 'TWITTER';
    } else if (event.type === 'IP_BLOCK') {
      return 'FIREWALL';
    }

    return 'UNKNOWN';
  }

  private async analyzeDetectionPattern(event: DetectionEvent): Promise<void> {
    try {
      const patternKey = `${event.type}:${event.context.accountId || event.context.sessionId}`;
      
      if (!this.detectionPatterns.has(patternKey)) {
        this.detectionPatterns.set(patternKey, {
          count: 0,
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          severity: event.severity,
        });
      }

      const pattern = this.detectionPatterns.get(patternKey);
      if (!pattern) {
        return;
      }
      pattern.count++;
      pattern.lastSeen = event.timestamp;
      
      // Escalate severity if pattern is recurring
      if (pattern.count > 3 && pattern.severity !== 'CRITICAL') {
        pattern.severity = this.escalateSeverity(pattern.severity);
      }
    } catch (error) {
      logger.error('Failed to analyze detection pattern:', error);
    }
  }

  private async determineResponse(event: DetectionEvent): Promise<DetectionResponse> {
    try {
      // Check if we're in cooldown
      const cooldownKey = event.context.sessionId || event.context.accountId || 'unknown';
      const cooldownEnd = this.responseCooldowns.get(cooldownKey);
      
      if (cooldownEnd && cooldownEnd > new Date()) {
        return {
          action: 'IGNORE',
          reason: 'IN_COOLDOWN',
        };
      }

      // Determine response based on severity and type
      switch (event.severity) {
        case 'CRITICAL':
          if (event.type === 'ACCOUNT_SUSPENSION') {
            return {
              action: 'SUSPEND_ACCOUNT',
              reason: 'ACCOUNT_SUSPENDED',
            };
          }
          return {
            action: 'ROTATE_PROFILE',
            duration: 3600, // 1 hour
            reason: 'CRITICAL_DETECTION',
          };

        case 'HIGH':
          return {
            action: 'ROTATE_PROXY',
            duration: 1800, // 30 minutes
            reason: 'HIGH_RISK_DETECTION',
          };

        case 'MEDIUM':
          return {
            action: 'COOLDOWN',
            duration: 600, // 10 minutes
            reason: 'MEDIUM_RISK_DETECTION',
          };

        default: // LOW
          return {
            action: 'IGNORE',
            reason: 'LOW_RISK_DETECTION',
          };
      }
    } catch (error) {
      logger.error('Failed to determine response:', error);
      return {
        action: 'IGNORE',
        reason: 'ERROR_DETERMINING_RESPONSE',
      };
    }
  }

  private async executeResponse(event: DetectionEvent, response: DetectionResponse): Promise<void> {
    try {
      const cooldownKey = event.context.sessionId || event.context.accountId || 'unknown';

      switch (response.action) {
        case 'COOLDOWN':
          if (response.duration) {
            this.responseCooldowns.set(
              cooldownKey,
              new Date(Date.now() + response.duration * 1000)
            );
          }
          break;

        case 'ROTATE_PROFILE':
          this.emit('rotateProfileRequested', {
            accountId: event.context.accountId,
            sessionId: event.context.sessionId,
            reason: response.reason,
          });
          break;

        case 'ROTATE_PROXY':
          this.emit('rotateProxyRequested', {
            sessionId: event.context.sessionId,
            proxyId: event.context.proxyId,
            reason: response.reason,
          });
          break;

        case 'SUSPEND_ACCOUNT':
          this.emit('suspendAccountRequested', {
            accountId: event.context.accountId,
            reason: response.reason,
          });
          break;
      }

      logger.info(`Executed response: ${response.action} for ${response.reason}`);
    } catch (error) {
      logger.error('Failed to execute response:', error);
    }
  }

  private calculateRiskScore(events: any[]): number {
    if (events.length === 0) return 0;

    let score = 0;
    const severityWeights = {
      LOW: 1,
      MEDIUM: 3,
      HIGH: 7,
      CRITICAL: 15,
    };

    events.forEach(event => {
      score += severityWeights[event.severity as keyof typeof severityWeights] || 1;
    });

    // Normalize to 0-100 scale
    const maxPossibleScore = events.length * 15; // All critical
    return Math.min(100, (score / maxPossibleScore) * 100);
  }

  private escalateSeverity(currentSeverity: string): string {
    const escalationMap: Record<string, string> = {
      LOW: 'MEDIUM',
      MEDIUM: 'HIGH',
      HIGH: 'CRITICAL',
      CRITICAL: 'CRITICAL',
    };

    return escalationMap[currentSeverity] || currentSeverity;
  }

  private async cleanupOldEvents(): Promise<void> {
    try {
      // Clean up cache entries older than 1 hour
      const cutoff = Date.now() - 3600000;
      
      for (const [key, events] of this.detectionCache.entries()) {
        const filteredEvents = events.filter(
          event => event.timestamp.getTime() > cutoff
        );
        
        if (filteredEvents.length === 0) {
          this.detectionCache.delete(key);
        } else {
          this.detectionCache.set(key, filteredEvents);
        }
      }

      // Clean up expired cooldowns
      const now = new Date();
      for (const [key, expiry] of this.responseCooldowns.entries()) {
        if (expiry <= now) {
          this.responseCooldowns.delete(key);
        }
      }

      logger.debug('Cleaned up old detection events and cooldowns');
    } catch (error) {
      logger.error('Failed to cleanup old events:', error);
    }
  }

  private async analyzeGlobalPatterns(): Promise<void> {
    try {
      // Analyze global detection patterns across all sessions
      const trends = await this.analyzeDetectionTrends();
      
      if (trends.riskScore > 80) {
        logger.warn('High global risk score detected:', trends.riskScore);
        this.emit('highRiskDetected', trends);
      }
    } catch (error) {
      logger.error('Failed to analyze global patterns:', error);
    }
  }
}
