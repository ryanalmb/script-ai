/**
 * Compliance Integration Service - Task 26
 * 
 * This service integrates the compliance audit system with all existing
 * Twikit automation services to ensure comprehensive audit trail coverage.
 * 
 * Features:
 * - Automatic audit event creation for all automation actions
 * - Integration with existing services without code changes
 * - Real-time compliance monitoring and alerting
 * - Automated data retention policy enforcement
 * 
 * @author Twikit Development Team
 * @version 1.0.0
 * @since 2024-12-28
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { 
  ComplianceAuditService, 
  ComplianceFramework, 
  ComplianceEventType, 
  ComplianceEventCategory,
  RiskLevel 
} from './complianceAuditService';

// Integration event types
export enum IntegrationEventType {
  // Session Events
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_AUTHENTICATED = 'SESSION_AUTHENTICATED',
  SESSION_TERMINATED = 'SESSION_TERMINATED',
  
  // Automation Actions
  TWEET_POSTED = 'TWEET_POSTED',
  TWEET_LIKED = 'TWEET_LIKED',
  TWEET_RETWEETED = 'TWEET_RETWEETED',
  USER_FOLLOWED = 'USER_FOLLOWED',
  USER_UNFOLLOWED = 'USER_UNFOLLOWED',
  DIRECT_MESSAGE_SENT = 'DIRECT_MESSAGE_SENT',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  
  // Proxy Events
  PROXY_ROTATED = 'PROXY_ROTATED',
  PROXY_FAILED = 'PROXY_FAILED',
  
  // Campaign Events
  CAMPAIGN_STARTED = 'CAMPAIGN_STARTED',
  CAMPAIGN_STOPPED = 'CAMPAIGN_STOPPED',
  CAMPAIGN_PAUSED = 'CAMPAIGN_PAUSED',
  
  // Anti-Detection Events
  DETECTION_TRIGGERED = 'DETECTION_TRIGGERED',
  FINGERPRINT_ROTATED = 'FINGERPRINT_ROTATED',
  BEHAVIOR_ADJUSTED = 'BEHAVIOR_ADJUSTED',
  
  // System Events
  RATE_LIMIT_HIT = 'RATE_LIMIT_HIT',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED'
}

// Integration event data interface
export interface IntegrationEventData {
  eventType: IntegrationEventType;
  userId?: string;
  accountId?: string;
  sessionId?: string;
  sourceIp?: string;
  userAgent?: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  details: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Compliance Integration Service
 * 
 * This service acts as a bridge between existing automation services
 * and the compliance audit system, automatically creating audit events
 * for all automation actions.
 */
export class ComplianceIntegrationService extends EventEmitter {
  private prisma: PrismaClient;
  private complianceAuditService: ComplianceAuditService;
  private isInitialized: boolean = false;
  private eventBuffer: IntegrationEventData[] = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor(prisma?: PrismaClient) {
    super();
    this.prisma = prisma || new PrismaClient();
    this.complianceAuditService = new ComplianceAuditService(this.prisma);
  }

  /**
   * Initialize the compliance integration service
   */
  async initialize(): Promise<void> {
    try {
      await this.complianceAuditService.initialize();
      
      // Start buffer flush interval
      this.bufferFlushInterval = setInterval(() => {
        this.flushEventBuffer().catch(error => {
          logger.error('Failed to flush event buffer:', error);
        });
      }, this.FLUSH_INTERVAL);

      this.isInitialized = true;

      logger.info('ComplianceIntegrationService initialized successfully', {
        service: 'ComplianceIntegrationService'
      });
    } catch (error) {
      logger.error('Failed to initialize ComplianceIntegrationService:', error);
      throw new TwikitError(
        TwikitErrorType.SERVICE_INITIALIZATION_ERROR,
        'Failed to initialize compliance integration service',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Record an automation action for compliance audit
   */
  async recordAutomationAction(eventData: IntegrationEventData): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Add to buffer for batch processing
      this.eventBuffer.push(eventData);

      // Flush buffer if it's full
      if (this.eventBuffer.length >= this.BUFFER_SIZE) {
        await this.flushEventBuffer();
      }

      // Emit event for real-time monitoring
      this.emit('automation_action', eventData);

      // Check for compliance violations
      await this.checkComplianceViolations(eventData);

    } catch (error) {
      logger.error('Failed to record automation action:', error);
      throw new TwikitError(
        TwikitErrorType.AUDIT_LOGGING_ERROR,
        'Failed to record automation action',
        { eventData, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Record session lifecycle events
   */
  async recordSessionEvent(
    eventType: IntegrationEventType,
    sessionId: string,
    accountId: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.recordAutomationAction({
      eventType,
      sessionId,
      accountId,
      action: eventType,
      outcome: 'SUCCESS',
      details
    });
  }

  /**
   * Record proxy rotation events
   */
  async recordProxyEvent(
    eventType: IntegrationEventType,
    accountId: string,
    proxyDetails: Record<string, any>
  ): Promise<void> {
    await this.recordAutomationAction({
      eventType,
      accountId,
      action: eventType,
      outcome: proxyDetails.success ? 'SUCCESS' : 'FAILURE',
      details: proxyDetails
    });
  }

  /**
   * Record campaign events
   */
  async recordCampaignEvent(
    eventType: IntegrationEventType,
    campaignId: string,
    userId: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.recordAutomationAction({
      eventType,
      userId,
      action: eventType,
      outcome: 'SUCCESS',
      details: {
        campaignId,
        ...details
      }
    });
  }

  /**
   * Record anti-detection events
   */
  async recordAntiDetectionEvent(
    eventType: IntegrationEventType,
    accountId: string,
    detectionDetails: Record<string, any>
  ): Promise<void> {
    const riskLevel = this.assessRiskLevel(detectionDetails);
    
    await this.recordAutomationAction({
      eventType,
      accountId,
      action: eventType,
      outcome: detectionDetails.evaded ? 'SUCCESS' : 'FAILURE',
      details: detectionDetails,
      metadata: { riskLevel }
    });
  }

  /**
   * Record content posting events
   */
  async recordContentEvent(
    eventType: IntegrationEventType,
    userId: string,
    accountId: string,
    contentDetails: Record<string, any>
  ): Promise<void> {
    await this.recordAutomationAction({
      eventType,
      userId,
      accountId,
      action: eventType,
      outcome: contentDetails.success ? 'SUCCESS' : 'FAILURE',
      details: {
        contentType: contentDetails.type,
        contentLength: contentDetails.text?.length || 0,
        mediaCount: contentDetails.mediaIds?.length || 0,
        ...contentDetails
      }
    });
  }

  /**
   * Get compliance metrics for integration monitoring
   */
  async getIntegrationMetrics(): Promise<{
    totalEventsRecorded: number;
    eventsByType: Record<string, number>;
    recentViolations: number;
    bufferSize: number;
    integrationHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      const complianceMetrics = await this.complianceAuditService.getComplianceMetrics();
      
      // Get recent events by type
      const recentEvents = await this.prisma.complianceAuditEvent.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: { eventType: true }
      });

      const eventsByType = recentEvents.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Assess integration health
      const integrationHealth = this.assessIntegrationHealth(complianceMetrics);

      return {
        totalEventsRecorded: complianceMetrics.totalAuditEvents,
        eventsByType,
        recentViolations: complianceMetrics.activeViolations,
        bufferSize: this.eventBuffer.length,
        integrationHealth
      };
    } catch (error) {
      logger.error('Failed to get integration metrics:', error);
      throw new TwikitError(
        TwikitErrorType.METRICS_COLLECTION_ERROR,
        'Failed to get integration metrics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Private method to flush event buffer
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToProcess = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // Process events in batch
      await Promise.all(eventsToProcess.map(async (eventData) => {
        const complianceEventType = this.mapToComplianceEventType(eventData.eventType);
        const complianceEventCategory = this.mapToComplianceEventCategory(eventData.eventType);
        const riskLevel = this.assessEventRiskLevel(eventData);

        await this.complianceAuditService.createAuditEvent({
          eventType: complianceEventType,
          eventCategory: complianceEventCategory,
          complianceFramework: ComplianceFramework.CUSTOM, // Default framework
          userId: eventData.userId,
          accountId: eventData.accountId,
          sessionId: eventData.sessionId,
          sourceIp: eventData.sourceIp,
          userAgent: eventData.userAgent,
          action: eventData.action,
          outcome: eventData.outcome,
          details: eventData.details,
          riskLevel,
          resourceType: 'AUTOMATION_ACTION',
          resourceId: eventData.accountId || eventData.sessionId
        });
      }));

      logger.debug('Event buffer flushed successfully', {
        eventsProcessed: eventsToProcess.length,
        service: 'ComplianceIntegrationService'
      });
    } catch (error) {
      logger.error('Failed to flush event buffer:', error);
      // Re-add failed events to buffer for retry
      this.eventBuffer.unshift(...eventsToProcess);
    }
  }

  /**
   * Map integration event type to compliance event type
   */
  private mapToComplianceEventType(eventType: IntegrationEventType): ComplianceEventType {
    const mapping: Record<IntegrationEventType, ComplianceEventType> = {
      [IntegrationEventType.SESSION_CREATED]: ComplianceEventType.AUTOMATION_START,
      [IntegrationEventType.SESSION_AUTHENTICATED]: ComplianceEventType.AUTOMATION_START,
      [IntegrationEventType.SESSION_TERMINATED]: ComplianceEventType.AUTOMATION_STOP,
      [IntegrationEventType.TWEET_POSTED]: ComplianceEventType.CONTENT_POSTED,
      [IntegrationEventType.TWEET_LIKED]: ComplianceEventType.ACCOUNT_INTERACTION,
      [IntegrationEventType.TWEET_RETWEETED]: ComplianceEventType.ACCOUNT_INTERACTION,
      [IntegrationEventType.USER_FOLLOWED]: ComplianceEventType.ACCOUNT_INTERACTION,
      [IntegrationEventType.USER_UNFOLLOWED]: ComplianceEventType.ACCOUNT_INTERACTION,
      [IntegrationEventType.DIRECT_MESSAGE_SENT]: ComplianceEventType.ACCOUNT_INTERACTION,
      [IntegrationEventType.PROFILE_UPDATED]: ComplianceEventType.DATA_PROCESSING,
      [IntegrationEventType.PROXY_ROTATED]: ComplianceEventType.SYSTEM_CONFIGURATION,
      [IntegrationEventType.PROXY_FAILED]: ComplianceEventType.SYSTEM_CONFIGURATION,
      [IntegrationEventType.CAMPAIGN_STARTED]: ComplianceEventType.AUTOMATION_START,
      [IntegrationEventType.CAMPAIGN_STOPPED]: ComplianceEventType.AUTOMATION_STOP,
      [IntegrationEventType.CAMPAIGN_PAUSED]: ComplianceEventType.AUTOMATION_STOP,
      [IntegrationEventType.DETECTION_TRIGGERED]: ComplianceEventType.SECURITY_INCIDENT,
      [IntegrationEventType.FINGERPRINT_ROTATED]: ComplianceEventType.SYSTEM_CONFIGURATION,
      [IntegrationEventType.BEHAVIOR_ADJUSTED]: ComplianceEventType.SYSTEM_CONFIGURATION,
      [IntegrationEventType.RATE_LIMIT_HIT]: ComplianceEventType.COMPLIANCE_VIOLATION,
      [IntegrationEventType.ERROR_OCCURRED]: ComplianceEventType.SECURITY_INCIDENT,
      [IntegrationEventType.HEALTH_CHECK_FAILED]: ComplianceEventType.SECURITY_INCIDENT
    };

    return mapping[eventType] || ComplianceEventType.AUTOMATION_START;
  }

  /**
   * Map integration event type to compliance event category
   */
  private mapToComplianceEventCategory(eventType: IntegrationEventType): ComplianceEventCategory {
    const mapping: Record<IntegrationEventType, ComplianceEventCategory> = {
      [IntegrationEventType.SESSION_CREATED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.SESSION_AUTHENTICATED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.SESSION_TERMINATED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.TWEET_POSTED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.TWEET_LIKED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.TWEET_RETWEETED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.USER_FOLLOWED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.USER_UNFOLLOWED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.DIRECT_MESSAGE_SENT]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.PROFILE_UPDATED]: ComplianceEventCategory.DATA_PROCESSING,
      [IntegrationEventType.PROXY_ROTATED]: ComplianceEventCategory.SYSTEM_ACCESS,
      [IntegrationEventType.PROXY_FAILED]: ComplianceEventCategory.SYSTEM_ACCESS,
      [IntegrationEventType.CAMPAIGN_STARTED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.CAMPAIGN_STOPPED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.CAMPAIGN_PAUSED]: ComplianceEventCategory.AUTOMATION_ACTION,
      [IntegrationEventType.DETECTION_TRIGGERED]: ComplianceEventCategory.SECURITY_EVENT,
      [IntegrationEventType.FINGERPRINT_ROTATED]: ComplianceEventCategory.SYSTEM_ACCESS,
      [IntegrationEventType.BEHAVIOR_ADJUSTED]: ComplianceEventCategory.SYSTEM_ACCESS,
      [IntegrationEventType.RATE_LIMIT_HIT]: ComplianceEventCategory.COMPLIANCE_VIOLATION,
      [IntegrationEventType.ERROR_OCCURRED]: ComplianceEventCategory.SECURITY_EVENT,
      [IntegrationEventType.HEALTH_CHECK_FAILED]: ComplianceEventCategory.SECURITY_EVENT
    };

    return mapping[eventType] || ComplianceEventCategory.AUTOMATION_ACTION;
  }

  /**
   * Assess risk level for event data
   */
  private assessEventRiskLevel(eventData: IntegrationEventData): RiskLevel {
    // High risk events
    if ([
      IntegrationEventType.DETECTION_TRIGGERED,
      IntegrationEventType.ERROR_OCCURRED,
      IntegrationEventType.HEALTH_CHECK_FAILED
    ].includes(eventData.eventType)) {
      return RiskLevel.HIGH;
    }

    // Medium risk events
    if ([
      IntegrationEventType.RATE_LIMIT_HIT,
      IntegrationEventType.PROXY_FAILED
    ].includes(eventData.eventType)) {
      return RiskLevel.MEDIUM;
    }

    // Failed outcomes are higher risk
    if (eventData.outcome === 'FAILURE') {
      return RiskLevel.MEDIUM;
    }

    return RiskLevel.LOW;
  }

  /**
   * Assess risk level for detection details
   */
  private assessRiskLevel(detectionDetails: Record<string, any>): RiskLevel {
    if (detectionDetails.severity === 'CRITICAL') return RiskLevel.CRITICAL;
    if (detectionDetails.severity === 'HIGH') return RiskLevel.HIGH;
    if (detectionDetails.severity === 'MEDIUM') return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Check for compliance violations
   */
  private async checkComplianceViolations(eventData: IntegrationEventData): Promise<void> {
    // Check for rate limit violations
    if (eventData.eventType === IntegrationEventType.RATE_LIMIT_HIT) {
      await this.complianceAuditService.recordComplianceViolation({
        violationType: 'RATE_LIMIT_VIOLATION',
        complianceFramework: ComplianceFramework.CUSTOM,
        severity: 'MEDIUM',
        title: 'Rate Limit Exceeded',
        description: `Rate limit exceeded for account ${eventData.accountId}`,
        affectedUsers: 1,
        affectedRecords: 1,
        dataTypes: ['AUTOMATION_DATA']
      });
    }

    // Check for detection violations
    if (eventData.eventType === IntegrationEventType.DETECTION_TRIGGERED) {
      await this.complianceAuditService.recordComplianceViolation({
        violationType: 'DETECTION_VIOLATION',
        complianceFramework: ComplianceFramework.CUSTOM,
        severity: 'HIGH',
        title: 'Anti-Detection Triggered',
        description: `Anti-detection system triggered for account ${eventData.accountId}`,
        affectedUsers: 1,
        affectedRecords: 1,
        dataTypes: ['AUTOMATION_DATA', 'BEHAVIORAL_DATA']
      });
    }
  }

  /**
   * Assess integration health
   */
  private assessIntegrationHealth(metrics: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (metrics.activeViolations > 10) return 'unhealthy';
    if (metrics.activeViolations > 5 || !metrics.auditTrailIntegrity) return 'degraded';
    return 'healthy';
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    try {
      // Flush remaining events
      await this.flushEventBuffer();

      // Clear interval
      if (this.bufferFlushInterval) {
        clearInterval(this.bufferFlushInterval);
      }

      // Cleanup compliance audit service
      await this.complianceAuditService.cleanup();

      logger.info('ComplianceIntegrationService cleanup completed', {
        service: 'ComplianceIntegrationService'
      });
    } catch (error) {
      logger.error('Error during ComplianceIntegrationService cleanup:', error);
    }
  }
}
