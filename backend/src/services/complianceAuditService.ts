/**
 * Comprehensive Compliance and Audit Trail Service - Task 26
 * 
 * Enterprise-grade compliance and audit trail system that integrates with all existing
 * Twikit automation services while leveraging current audit infrastructure.
 * 
 * Features:
 * - Immutable audit trails with cryptographic integrity
 * - GDPR/CCPA/SOX compliance reporting
 * - Real-time compliance violation detection
 * - Automated data retention management
 * - Integration with Task 25 monitoring system
 * 
 * @author Twikit Development Team
 * @version 1.0.0
 * @since 2024-12-28
 */

import { PrismaClient } from '@prisma/client';
import { createHash, createHmac } from 'crypto';
import { logger, logAuditTrail } from '../utils/logger';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { generateCorrelationId } from '../utils/correlationId';

// Compliance frameworks supported
export enum ComplianceFramework {
  GDPR = 'GDPR',
  CCPA = 'CCPA',
  SOX = 'SOX',
  HIPAA = 'HIPAA',
  CUSTOM = 'CUSTOM'
}

// Event types for compliance audit
export enum ComplianceEventType {
  // Privacy Rights
  GDPR_ACCESS_REQUEST = 'GDPR_ACCESS_REQUEST',
  GDPR_DELETE_REQUEST = 'GDPR_DELETE_REQUEST',
  GDPR_CORRECT_REQUEST = 'GDPR_CORRECT_REQUEST',
  CCPA_OPT_OUT_REQUEST = 'CCPA_OPT_OUT_REQUEST',
  CCPA_ACCESS_REQUEST = 'CCPA_ACCESS_REQUEST',
  
  // Data Processing
  DATA_COLLECTION = 'DATA_COLLECTION',
  DATA_PROCESSING = 'DATA_PROCESSING',
  DATA_SHARING = 'DATA_SHARING',
  DATA_DELETION = 'DATA_DELETION',
  DATA_ANONYMIZATION = 'DATA_ANONYMIZATION',
  
  // System Access
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  PRIVILEGED_OPERATION = 'PRIVILEGED_OPERATION',
  SYSTEM_CONFIGURATION = 'SYSTEM_CONFIGURATION',
  
  // Automation Actions
  AUTOMATION_START = 'AUTOMATION_START',
  AUTOMATION_STOP = 'AUTOMATION_STOP',
  CONTENT_POSTED = 'CONTENT_POSTED',
  ACCOUNT_INTERACTION = 'ACCOUNT_INTERACTION',
  
  // Compliance Violations
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',
  SECURITY_INCIDENT = 'SECURITY_INCIDENT',
  DATA_BREACH = 'DATA_BREACH'
}

// Event categories
export enum ComplianceEventCategory {
  PRIVACY_REQUEST = 'PRIVACY_REQUEST',
  DATA_PROCESSING = 'DATA_PROCESSING',
  SYSTEM_ACCESS = 'SYSTEM_ACCESS',
  AUTOMATION_ACTION = 'AUTOMATION_ACTION',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',
  SECURITY_EVENT = 'SECURITY_EVENT'
}

// Risk levels
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Compliance audit event interface
export interface ComplianceAuditEventData {
  eventType: ComplianceEventType;
  eventCategory: ComplianceEventCategory;
  complianceFramework: ComplianceFramework;
  userId?: string;
  accountId?: string;
  sessionId?: string;
  sourceIp?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  details: Record<string, any>;
  riskLevel?: RiskLevel;
  complianceRelevant?: boolean;
  retentionUntil?: Date;
}

// Privacy request interface
export interface PrivacyRequestData {
  requestType: 'ACCESS' | 'DELETE' | 'CORRECT' | 'OPT_OUT' | 'PORTABILITY';
  complianceFramework: ComplianceFramework;
  userId?: string;
  requestorEmail: string;
  requestorName?: string;
  dataSubject?: string;
  requestDetails: Record<string, any>;
  dueDate: Date;
}

// Compliance report interface
export interface ComplianceReportConfig {
  reportType: string;
  complianceFramework: ComplianceFramework;
  reportPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
  periodStart: Date;
  periodEnd: Date;
  includeViolations?: boolean;
  includeRecommendations?: boolean;
}

/**
 * Comprehensive Compliance and Audit Trail Service
 * 
 * This service provides enterprise-grade compliance and audit trail capabilities
 * that integrate with existing Twikit infrastructure while adding compliance-specific
 * features for GDPR, CCPA, SOX, and other regulatory frameworks.
 */
export class ComplianceAuditService {
  private prisma: PrismaClient;
  private hashSecret: string;
  private lastEventHash: string | null = null;
  private isInitialized: boolean = false;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.hashSecret = process.env.COMPLIANCE_HASH_SECRET || 'default-secret-change-in-production';
  }

  /**
   * Initialize the compliance audit service
   */
  async initialize(): Promise<void> {
    try {
      // Get the last event hash for chain integrity
      const lastEvent = await this.prisma.complianceAuditEvent.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { hashSignature: true }
      });

      this.lastEventHash = lastEvent?.hashSignature || null;
      this.isInitialized = true;

      logger.info('ComplianceAuditService initialized successfully', {
        hasLastEventHash: !!this.lastEventHash,
        service: 'ComplianceAuditService'
      });
    } catch (error) {
      logger.error('Failed to initialize ComplianceAuditService:', error);
      throw new TwikitError(
        TwikitErrorType.SERVICE_INITIALIZATION_ERROR,
        'Failed to initialize compliance audit service',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Create an immutable compliance audit event
   */
  async createAuditEvent(eventData: ComplianceAuditEventData): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const correlationId = generateCorrelationId();
    const eventId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create hash signature for integrity
      const eventContent = JSON.stringify({
        eventId,
        eventType: eventData.eventType,
        eventCategory: eventData.eventCategory,
        complianceFramework: eventData.complianceFramework,
        userId: eventData.userId,
        accountId: eventData.accountId,
        action: eventData.action,
        outcome: eventData.outcome,
        details: eventData.details,
        timestamp: new Date().toISOString(),
        previousHash: this.lastEventHash
      });

      const hashSignature = createHmac('sha256', this.hashSecret)
        .update(eventContent)
        .digest('hex');

      // Create the audit event
      const auditEvent = await this.prisma.complianceAuditEvent.create({
        data: {
          eventId,
          eventType: eventData.eventType,
          eventCategory: eventData.eventCategory,
          complianceFramework: eventData.complianceFramework,
          userId: eventData.userId || null,
          accountId: eventData.accountId || null,
          sessionId: eventData.sessionId || null,
          sourceIp: eventData.sourceIp || null,
          userAgent: eventData.userAgent || null,
          resourceType: eventData.resourceType || null,
          resourceId: eventData.resourceId || null,
          action: eventData.action,
          outcome: eventData.outcome,
          details: eventData.details,
          riskLevel: eventData.riskLevel || RiskLevel.LOW,
          complianceRelevant: eventData.complianceRelevant ?? true,
          retentionUntil: eventData.retentionUntil || null,
          hashSignature,
          previousHash: this.lastEventHash
        }
      });

      // Update last event hash for chain integrity
      this.lastEventHash = hashSignature;

      // Also log to existing audit trail system for backward compatibility
      if (eventData.userId && eventData.accountId) {
        const auditTrailData: any = {
          correlationId,
          result: eventData.outcome === 'SUCCESS' ? 'success' : 'failure',
          metadata: {
            complianceFramework: eventData.complianceFramework,
            eventType: eventData.eventType,
            riskLevel: eventData.riskLevel,
            auditEventId: auditEvent.id
          }
        };

        if (eventData.resourceId) {
          auditTrailData.resourceId = eventData.resourceId;
        }

        logAuditTrail(eventData.action, eventData.userId, eventData.accountId, auditTrailData);
      }

      logger.info('Compliance audit event created', {
        eventId,
        eventType: eventData.eventType,
        complianceFramework: eventData.complianceFramework,
        correlationId,
        service: 'ComplianceAuditService'
      });

      return auditEvent.id;
    } catch (error) {
      logger.error('Failed to create compliance audit event:', error);
      throw new TwikitError(
        TwikitErrorType.AUDIT_LOGGING_ERROR,
        'Failed to create compliance audit event',
        { eventData, correlationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Create a privacy request (GDPR/CCPA)
   */
  async createPrivacyRequest(requestData: PrivacyRequestData): Promise<string> {
    const correlationId = generateCorrelationId();
    const requestId = `privacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const privacyRequest = await this.prisma.privacyRequest.create({
        data: {
          requestId,
          requestType: requestData.requestType,
          complianceFramework: requestData.complianceFramework,
          userId: requestData.userId || null,
          requestorEmail: requestData.requestorEmail,
          requestorName: requestData.requestorName || null,
          dataSubject: requestData.dataSubject || null,
          requestDetails: requestData.requestDetails,
          dueDate: requestData.dueDate
        }
      });

      // Create corresponding audit event
      const auditEventData: any = {
        eventType: requestData.complianceFramework === ComplianceFramework.GDPR
          ? ComplianceEventType.GDPR_ACCESS_REQUEST
          : ComplianceEventType.CCPA_ACCESS_REQUEST,
        eventCategory: ComplianceEventCategory.PRIVACY_REQUEST,
        complianceFramework: requestData.complianceFramework,
        action: `PRIVACY_REQUEST_${requestData.requestType}`,
        outcome: 'SUCCESS',
        details: {
          requestId,
          requestType: requestData.requestType,
          requestorEmail: requestData.requestorEmail,
          dueDate: requestData.dueDate
        },
        riskLevel: RiskLevel.MEDIUM,
        resourceType: 'PRIVACY_REQUEST',
        resourceId: requestId
      };

      if (requestData.userId) {
        auditEventData.userId = requestData.userId;
      }

      await this.createAuditEvent(auditEventData);

      logger.info('Privacy request created', {
        requestId,
        requestType: requestData.requestType,
        complianceFramework: requestData.complianceFramework,
        correlationId,
        service: 'ComplianceAuditService'
      });

      return privacyRequest.id;
    } catch (error) {
      logger.error('Failed to create privacy request:', error);
      throw new TwikitError(
        TwikitErrorType.PRIVACY_REQUEST_ERROR,
        'Failed to create privacy request',
        { requestData, correlationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(config: ComplianceReportConfig): Promise<string> {
    const correlationId = generateCorrelationId();

    try {
      // Create report record
      const report = await this.prisma.complianceReport.create({
        data: {
          reportType: config.reportType,
          complianceFramework: config.complianceFramework,
          reportPeriod: config.reportPeriod,
          periodStart: config.periodStart,
          periodEnd: config.periodEnd,
          status: 'GENERATING'
        }
      });

      // Generate report data asynchronously
      this.generateReportData(report.id, config).catch(error => {
        logger.error('Failed to generate report data:', error);
      });

      // Create audit event for report generation
      await this.createAuditEvent({
        eventType: ComplianceEventType.SYSTEM_CONFIGURATION,
        eventCategory: ComplianceEventCategory.SYSTEM_ACCESS,
        complianceFramework: config.complianceFramework,
        action: 'COMPLIANCE_REPORT_GENERATED',
        outcome: 'SUCCESS',
        details: {
          reportId: report.id,
          reportType: config.reportType,
          periodStart: config.periodStart,
          periodEnd: config.periodEnd
        },
        riskLevel: RiskLevel.LOW,
        resourceType: 'COMPLIANCE_REPORT',
        resourceId: report.id
      });

      logger.info('Compliance report generation started', {
        reportId: report.id,
        reportType: config.reportType,
        complianceFramework: config.complianceFramework,
        correlationId,
        service: 'ComplianceAuditService'
      });

      return report.id;
    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw new TwikitError(
        TwikitErrorType.COMPLIANCE_REPORT_ERROR,
        'Failed to generate compliance report',
        { config, correlationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Record compliance violation
   */
  async recordComplianceViolation(violation: {
    violationType: string;
    complianceFramework: ComplianceFramework;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    description: string;
    affectedUsers?: number;
    affectedRecords?: number;
    dataTypes?: string[];
    reportedBy?: string;
  }): Promise<string> {
    const correlationId = generateCorrelationId();

    try {
      const complianceViolation = await this.prisma.complianceViolation.create({
        data: {
          violationType: violation.violationType,
          complianceFramework: violation.complianceFramework,
          severity: violation.severity,
          title: violation.title,
          description: violation.description,
          affectedUsers: violation.affectedUsers || 0,
          affectedRecords: violation.affectedRecords || 0,
          dataTypes: violation.dataTypes || [],
          reportedBy: violation.reportedBy || null,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      });

      // Create audit event for violation
      await this.createAuditEvent({
        eventType: ComplianceEventType.COMPLIANCE_VIOLATION,
        eventCategory: ComplianceEventCategory.COMPLIANCE_VIOLATION,
        complianceFramework: violation.complianceFramework,
        action: 'COMPLIANCE_VIOLATION_RECORDED',
        outcome: 'SUCCESS',
        details: {
          violationId: complianceViolation.id,
          violationType: violation.violationType,
          severity: violation.severity,
          affectedUsers: violation.affectedUsers,
          affectedRecords: violation.affectedRecords
        },
        riskLevel: violation.severity === 'CRITICAL' ? RiskLevel.CRITICAL :
                  violation.severity === 'HIGH' ? RiskLevel.HIGH :
                  violation.severity === 'MEDIUM' ? RiskLevel.MEDIUM : RiskLevel.LOW,
        resourceType: 'COMPLIANCE_VIOLATION',
        resourceId: complianceViolation.id
      });

      logger.warn('Compliance violation recorded', {
        violationId: complianceViolation.id,
        violationType: violation.violationType,
        severity: violation.severity,
        complianceFramework: violation.complianceFramework,
        correlationId,
        service: 'ComplianceAuditService'
      });

      return complianceViolation.id;
    } catch (error) {
      logger.error('Failed to record compliance violation:', error);
      throw new TwikitError(
        TwikitErrorType.COMPLIANCE_VIOLATION_ERROR,
        'Failed to record compliance violation',
        { violation, correlationId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Verify audit trail integrity
   */
  async verifyAuditTrailIntegrity(): Promise<{
    isValid: boolean;
    totalEvents: number;
    invalidEvents: string[];
    lastVerifiedHash: string | null;
  }> {
    try {
      const events = await this.prisma.complianceAuditEvent.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          eventId: true,
          eventType: true,
          eventCategory: true,
          complianceFramework: true,
          userId: true,
          accountId: true,
          action: true,
          outcome: true,
          details: true,
          hashSignature: true,
          previousHash: true,
          createdAt: true
        }
      });

      const invalidEvents: string[] = [];
      let previousHash: string | null = null;

      for (const event of events) {
        // Recreate the hash content
        const eventContent = JSON.stringify({
          eventId: event.eventId,
          eventType: event.eventType,
          eventCategory: event.eventCategory,
          complianceFramework: event.complianceFramework,
          userId: event.userId,
          accountId: event.accountId,
          action: event.action,
          outcome: event.outcome,
          details: event.details,
          timestamp: event.createdAt.toISOString(),
          previousHash: event.previousHash
        });

        const expectedHash = createHmac('sha256', this.hashSecret)
          .update(eventContent)
          .digest('hex');

        // Verify hash integrity
        if (event.hashSignature !== expectedHash) {
          invalidEvents.push(event.id);
        }

        // Verify chain integrity
        if (event.previousHash !== previousHash) {
          invalidEvents.push(event.id);
        }

        previousHash = event.hashSignature;
      }

      const result = {
        isValid: invalidEvents.length === 0,
        totalEvents: events.length,
        invalidEvents,
        lastVerifiedHash: previousHash
      };

      logger.info('Audit trail integrity verification completed', {
        ...result,
        service: 'ComplianceAuditService'
      });

      return result;
    } catch (error) {
      logger.error('Failed to verify audit trail integrity:', error);
      throw new TwikitError(
        TwikitErrorType.AUDIT_VERIFICATION_ERROR,
        'Failed to verify audit trail integrity',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get compliance metrics for monitoring dashboard
   */
  async getComplianceMetrics(): Promise<{
    totalAuditEvents: number;
    eventsByFramework: Record<string, number>;
    eventsByRiskLevel: Record<string, number>;
    activeViolations: number;
    pendingPrivacyRequests: number;
    recentReports: number;
    auditTrailIntegrity: boolean;
  }> {
    try {
      const [
        totalEvents,
        eventsByFramework,
        eventsByRiskLevel,
        activeViolations,
        pendingRequests,
        recentReports
      ] = await Promise.all([
        // Total audit events
        this.prisma.complianceAuditEvent.count(),

        // Events by framework
        this.prisma.complianceAuditEvent.groupBy({
          by: ['complianceFramework'],
          _count: true
        }),

        // Events by risk level
        this.prisma.complianceAuditEvent.groupBy({
          by: ['riskLevel'],
          _count: true
        }),

        // Active violations
        this.prisma.complianceViolation.count({
          where: { status: { in: ['OPEN', 'INVESTIGATING'] } }
        }),

        // Pending privacy requests
        this.prisma.privacyRequest.count({
          where: { status: { in: ['RECEIVED', 'VERIFIED', 'PROCESSING'] } }
        }),

        // Recent reports (last 30 days)
        this.prisma.complianceReport.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      // Quick integrity check (last 100 events)
      const integrityCheck = await this.quickIntegrityCheck();

      return {
        totalAuditEvents: totalEvents,
        eventsByFramework: eventsByFramework.reduce((acc, item) => {
          acc[item.complianceFramework] = item._count;
          return acc;
        }, {} as Record<string, number>),
        eventsByRiskLevel: eventsByRiskLevel.reduce((acc, item) => {
          acc[item.riskLevel] = item._count;
          return acc;
        }, {} as Record<string, number>),
        activeViolations,
        pendingPrivacyRequests: pendingRequests,
        recentReports,
        auditTrailIntegrity: integrityCheck
      };
    } catch (error) {
      logger.error('Failed to get compliance metrics:', error);
      throw new TwikitError(
        TwikitErrorType.METRICS_COLLECTION_ERROR,
        'Failed to get compliance metrics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Private method to generate report data
   */
  private async generateReportData(reportId: string, config: ComplianceReportConfig): Promise<void> {
    try {
      // Get audit events for the period
      const events = await this.prisma.complianceAuditEvent.findMany({
        where: {
          complianceFramework: config.complianceFramework,
          createdAt: {
            gte: config.periodStart,
            lte: config.periodEnd
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get violations for the period
      const violations = config.includeViolations ? await this.prisma.complianceViolation.findMany({
        where: {
          complianceFramework: config.complianceFramework,
          reportedAt: {
            gte: config.periodStart,
            lte: config.periodEnd
          }
        }
      }) : [];

      // Generate report data
      const reportData = {
        summary: {
          totalEvents: events.length,
          eventsByType: this.groupBy(events, 'eventType'),
          eventsByRiskLevel: this.groupBy(events, 'riskLevel'),
          totalViolations: violations.length,
          violationsBySeverity: this.groupBy(violations, 'severity')
        },
        events: events.map(event => ({
          id: event.id,
          eventType: event.eventType,
          action: event.action,
          outcome: event.outcome,
          riskLevel: event.riskLevel,
          createdAt: event.createdAt
        })),
        violations: violations.map(violation => ({
          id: violation.id,
          violationType: violation.violationType,
          severity: violation.severity,
          title: violation.title,
          status: violation.status,
          reportedAt: violation.reportedAt
        }))
      };

      // Update report with generated data
      await this.prisma.complianceReport.update({
        where: { id: reportId },
        data: {
          status: 'COMPLETED',
          reportData,
          summary: reportData.summary
        }
      });

      logger.info('Compliance report data generated successfully', {
        reportId,
        totalEvents: events.length,
        totalViolations: violations.length,
        service: 'ComplianceAuditService'
      });
    } catch (error) {
      logger.error('Failed to generate report data:', error);

      // Update report status to failed
      await this.prisma.complianceReport.update({
        where: { id: reportId },
        data: { status: 'FAILED' }
      });
    }
  }

  /**
   * Quick integrity check for recent events
   */
  private async quickIntegrityCheck(): Promise<boolean> {
    try {
      const recentEvents = await this.prisma.complianceAuditEvent.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          hashSignature: true,
          previousHash: true
        }
      });

      if (recentEvents.length < 2) return true;

      // Check chain integrity for recent events
      for (let i = 0; i < recentEvents.length - 1; i++) {
        const currentEvent = recentEvents[i];
        const nextEvent = recentEvents[i + 1];
        if (currentEvent && nextEvent && currentEvent.previousHash !== nextEvent.hashSignature) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Quick integrity check failed:', error);
      return false;
    }
  }

  /**
   * Utility method to group array by property
   */
  private groupBy<T>(array: T[], property: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = String(item[property]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('ComplianceAuditService cleanup completed', {
        service: 'ComplianceAuditService'
      });
    } catch (error) {
      logger.error('Error during ComplianceAuditService cleanup:', error);
    }
  }
}
