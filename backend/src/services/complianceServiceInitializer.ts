/**
 * Compliance Service Initializer - Task 26
 * 
 * Initializes and integrates the comprehensive compliance and audit trail system
 * with the main Twikit application and existing services.
 * 
 * Features:
 * - Service initialization and dependency injection
 * - Integration with existing automation services
 * - Connection to Task 25 monitoring dashboard
 * - Graceful startup and shutdown handling
 * - Health check integration
 * 
 * @author Twikit Development Team
 * @version 1.0.0
 * @since 2024-12-28
 */

import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { logger } from '../utils/logger';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { ComplianceAuditService } from './complianceAuditService';
import { ComplianceIntegrationService } from './complianceIntegrationService';
import complianceConfig, { validateComplianceConfig } from '../config/compliance';
import complianceRoutes from '../routes/compliance';

// Service instances
let complianceAuditService: ComplianceAuditService | null = null;
let complianceIntegrationService: ComplianceIntegrationService | null = null;
let isInitialized = false;

/**
 * Initialize the compliance and audit trail system
 */
export async function initializeComplianceServices(
  app: Express,
  prisma: PrismaClient
): Promise<{
  complianceAuditService: ComplianceAuditService;
  complianceIntegrationService: ComplianceIntegrationService;
}> {
  try {
    logger.info('Initializing compliance and audit trail system...', {
      service: 'ComplianceServiceInitializer'
    });

    // Validate configuration
    const configErrors = validateComplianceConfig(complianceConfig);
    if (configErrors.length > 0) {
      throw new TwikitError(
        TwikitErrorType.COMPLIANCE_FRAMEWORK_ERROR,
        'Invalid compliance configuration',
        { errors: configErrors }
      );
    }

    // Initialize compliance audit service
    complianceAuditService = new ComplianceAuditService(prisma);
    await complianceAuditService.initialize();

    // Initialize compliance integration service
    complianceIntegrationService = new ComplianceIntegrationService(prisma);
    await complianceIntegrationService.initialize();

    // Register API routes
    app.use('/api/compliance', complianceRoutes);

    // Set up event listeners for integration
    setupEventListeners();

    // Set up health checks
    setupHealthChecks();

    // Set up monitoring integration
    await setupMonitoringIntegration();

    isInitialized = true;

    logger.info('Compliance and audit trail system initialized successfully', {
      service: 'ComplianceServiceInitializer',
      config: {
        enabled: complianceConfig.enabled,
        frameworks: Object.keys(complianceConfig.frameworks).filter(
          key => complianceConfig.frameworks[key as keyof typeof complianceConfig.frameworks].enabled
        ),
        auditTrailIntegrity: complianceConfig.auditTrail.integrityChecking,
        autoReporting: complianceConfig.reporting.autoGeneration
      }
    });

    return {
      complianceAuditService,
      complianceIntegrationService
    };
  } catch (error) {
    logger.error('Failed to initialize compliance services:', error);
    throw new TwikitError(
      TwikitErrorType.SERVICE_INITIALIZATION_ERROR,
      'Failed to initialize compliance and audit trail system',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Set up event listeners for service integration
 */
function setupEventListeners(): void {
  if (!complianceIntegrationService) return;

  // Listen for automation actions from integration service
  complianceIntegrationService.on('automation_action', (eventData) => {
    logger.debug('Automation action recorded for compliance', {
      eventType: eventData.eventType,
      action: eventData.action,
      outcome: eventData.outcome,
      service: 'ComplianceServiceInitializer'
    });
  });

  // Listen for compliance violations
  complianceIntegrationService.on('compliance_violation', (violation) => {
    logger.warn('Compliance violation detected', {
      violationType: violation.violationType,
      severity: violation.severity,
      service: 'ComplianceServiceInitializer'
    });
  });

  // Set up process event listeners for graceful shutdown
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in compliance services:', error);
    gracefulShutdown();
  });
}

/**
 * Set up health checks for compliance services
 */
function setupHealthChecks(): void {
  // Health check endpoint will be added to the main health check system
  const healthCheck = async () => {
    try {
      if (!complianceAuditService || !complianceIntegrationService) {
        return {
          status: 'unhealthy',
          error: 'Services not initialized'
        };
      }

      // Check audit trail integrity
      const integrityCheck = await complianceAuditService.verifyAuditTrailIntegrity();
      
      // Get integration metrics
      const integrationMetrics = await complianceIntegrationService.getIntegrationMetrics();

      return {
        status: integrityCheck.isValid && integrationMetrics.integrationHealth === 'healthy' 
          ? 'healthy' : 'degraded',
        details: {
          auditTrailIntegrity: integrityCheck.isValid,
          integrationHealth: integrationMetrics.integrationHealth,
          totalAuditEvents: integrityCheck.totalEvents,
          bufferSize: integrationMetrics.bufferSize
        }
      };
    } catch (error) {
      logger.error('Compliance health check failed:', error);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  // Store health check function for external access
  (global as any).complianceHealthCheck = healthCheck;
}

/**
 * Set up integration with Task 25 monitoring dashboard
 */
async function setupMonitoringIntegration(): Promise<void> {
  try {
    // Check if monitoring service is available
    const monitoringService = (global as any).twikitMonitoringService;
    
    if (monitoringService) {
      logger.info('Integrating compliance system with monitoring dashboard', {
        service: 'ComplianceServiceInitializer'
      });

      // Add compliance metrics to monitoring dashboard
      const originalGetMetrics = monitoringService.getMetrics;
      monitoringService.getMetrics = async function() {
        const originalMetrics = await originalGetMetrics.call(this);
        
        try {
          const complianceMetrics = await getComplianceMetricsForMonitoring();
          return {
            ...originalMetrics,
            compliance: complianceMetrics
          };
        } catch (error) {
          logger.error('Failed to get compliance metrics for monitoring:', error);
          return originalMetrics;
        }
      };

      // Set up compliance alerts in monitoring system
      await setupComplianceAlerts(monitoringService);
    } else {
      logger.warn('Monitoring service not available, compliance metrics will not be integrated', {
        service: 'ComplianceServiceInitializer'
      });
    }
  } catch (error) {
    logger.error('Failed to set up monitoring integration:', error);
    // Don't throw error as this is not critical for compliance functionality
  }
}

/**
 * Get compliance metrics formatted for monitoring dashboard
 */
async function getComplianceMetricsForMonitoring(): Promise<any> {
  if (!complianceAuditService || !complianceIntegrationService) {
    return {
      status: 'unavailable',
      error: 'Compliance services not initialized'
    };
  }

  try {
    const [complianceMetrics, integrationMetrics] = await Promise.all([
      complianceAuditService.getComplianceMetrics(),
      complianceIntegrationService.getIntegrationMetrics()
    ]);

    return {
      status: 'active',
      auditTrail: {
        totalEvents: complianceMetrics.totalAuditEvents,
        integrityStatus: complianceMetrics.auditTrailIntegrity ? 'valid' : 'compromised',
        eventsByFramework: complianceMetrics.eventsByFramework,
        eventsByRiskLevel: complianceMetrics.eventsByRiskLevel
      },
      compliance: {
        activeViolations: complianceMetrics.activeViolations,
        pendingPrivacyRequests: complianceMetrics.pendingPrivacyRequests,
        recentReports: complianceMetrics.recentReports
      },
      integration: {
        health: integrationMetrics.integrationHealth,
        bufferSize: integrationMetrics.bufferSize,
        recentEvents: integrationMetrics.totalEventsRecorded
      },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get compliance metrics:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Set up compliance-specific alerts in monitoring system
 */
async function setupComplianceAlerts(monitoringService: any): Promise<void> {
  try {
    // Define compliance alert rules
    const complianceAlertRules = [
      {
        name: 'High Risk Compliance Violation',
        condition: 'compliance.activeViolations > 5',
        severity: 'HIGH',
        description: 'Multiple active compliance violations detected'
      },
      {
        name: 'Audit Trail Integrity Compromised',
        condition: 'compliance.auditTrail.integrityStatus === "compromised"',
        severity: 'CRITICAL',
        description: 'Audit trail integrity has been compromised'
      },
      {
        name: 'Privacy Request Overdue',
        condition: 'compliance.pendingPrivacyRequests > 10',
        severity: 'MEDIUM',
        description: 'Multiple privacy requests are pending response'
      },
      {
        name: 'Compliance Integration Unhealthy',
        condition: 'compliance.integration.health === "unhealthy"',
        severity: 'HIGH',
        description: 'Compliance integration service is unhealthy'
      }
    ];

    // Register alert rules with monitoring service
    if (typeof monitoringService.addAlertRules === 'function') {
      await monitoringService.addAlertRules(complianceAlertRules);
      logger.info('Compliance alert rules registered with monitoring system', {
        rulesCount: complianceAlertRules.length,
        service: 'ComplianceServiceInitializer'
      });
    }
  } catch (error) {
    logger.error('Failed to set up compliance alerts:', error);
  }
}

/**
 * Get service instances (for external access)
 */
export function getComplianceServices(): {
  complianceAuditService: ComplianceAuditService | null;
  complianceIntegrationService: ComplianceIntegrationService | null;
  isInitialized: boolean;
} {
  return {
    complianceAuditService,
    complianceIntegrationService,
    isInitialized
  };
}

/**
 * Record automation action (convenience function for external services)
 */
export async function recordAutomationAction(eventData: any): Promise<void> {
  if (!complianceIntegrationService) {
    logger.warn('Compliance integration service not initialized, skipping event recording');
    return;
  }

  try {
    await complianceIntegrationService.recordAutomationAction(eventData);
  } catch (error) {
    logger.error('Failed to record automation action:', error);
    // Don't throw error to avoid breaking the main automation flow
  }
}

/**
 * Graceful shutdown of compliance services
 */
async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down compliance services...', {
    service: 'ComplianceServiceInitializer'
  });

  try {
    // Cleanup services
    if (complianceIntegrationService) {
      await complianceIntegrationService.cleanup();
    }

    if (complianceAuditService) {
      await complianceAuditService.cleanup();
    }

    isInitialized = false;

    logger.info('Compliance services shutdown completed', {
      service: 'ComplianceServiceInitializer'
    });
  } catch (error) {
    logger.error('Error during compliance services shutdown:', error);
  }
}

// Export service instances and functions
export {
  complianceAuditService,
  complianceIntegrationService,
  gracefulShutdown
};
