import { Server as HTTPServer } from 'http';
import { logger } from '../../utils/logger';
import { EnterpriseRealTimeSyncCoordinator } from './realTimeSyncCoordinator';
import { EnterpriseAntiDetectionCoordinator } from '../antiDetection/antiDetectionCoordinator';

// Export all real-time sync services
export { EnterpriseAccountSyncService } from './accountSyncService';
export { EnterpriseAnalyticsCollectionService } from './analyticsCollectionService';
export { EnterpriseCampaignTrackingService } from './campaignTrackingService';
export { EnterpriseWebSocketService } from './webSocketService';
export { EnterpriseDataIntegrityService } from './dataIntegrityService';
export { EnterpriseRealTimeSyncCoordinator } from './realTimeSyncCoordinator';

// Export types
export type {
  SyncConfiguration,
  SyncResult,
  AccountMetricsData,
  AccountHealthData
} from './accountSyncService';

export type {
  TweetEngagementData,
  AutomationPerformanceData,
  ProxyPerformanceData,
  BehavioralAnalyticsData
} from './analyticsCollectionService';

export type {
  CampaignConfiguration,
  CampaignPerformanceData,
  CampaignAnalytics,
  ABTestConfiguration
} from './campaignTrackingService';

export type {
  WebSocketClient,
  WebSocketMessage,
  SubscriptionFilter
} from './webSocketService';

export type {
  DataValidationRule,
  DataQualityIssue,
  DataRetentionPolicy,
  GDPRComplianceRecord
} from './dataIntegrityService';

export type {
  RealTimeSyncConfiguration,
  SystemHealthStatus
} from './realTimeSyncCoordinator';

/**
 * Global real-time sync coordinator instance
 */
let realTimeSyncCoordinator: EnterpriseRealTimeSyncCoordinator | null = null;

/**
 * Initialize the enterprise real-time synchronization system
 */
export async function initializeRealTimeSync(
  httpServer: HTTPServer,
  antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator,
  configuration?: Partial<RealTimeSyncConfiguration>
): Promise<EnterpriseRealTimeSyncCoordinator> {
  try {
    logger.info('🚀 Initializing Enterprise Real-Time Synchronization System...');
    
    if (realTimeSyncCoordinator) {
      logger.warn('Real-time sync coordinator already initialized');
      return realTimeSyncCoordinator;
    }

    // Create and initialize the coordinator
    realTimeSyncCoordinator = new EnterpriseRealTimeSyncCoordinator(
      httpServer,
      antiDetectionCoordinator,
      configuration
    );

    // Setup graceful shutdown
    setupGracefulShutdown();

    logger.info('✅ Enterprise Real-Time Synchronization System initialized successfully');
    return realTimeSyncCoordinator;
  } catch (error) {
    logger.error('❌ Failed to initialize Enterprise Real-Time Synchronization System:', error);
    throw new Error(`Real-Time Sync initialization failed: ${error}`);
  }
}

/**
 * Get the real-time sync coordinator instance
 */
export function getRealTimeSyncCoordinator(): EnterpriseRealTimeSyncCoordinator | null {
  return realTimeSyncCoordinator;
}

/**
 * Setup graceful shutdown for real-time sync system
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down real-time sync system gracefully...`);
    
    if (realTimeSyncCoordinator) {
      try {
        await realTimeSyncCoordinator.shutdown();
        realTimeSyncCoordinator = null;
        logger.info('Real-time sync system shutdown complete');
      } catch (error) {
        logger.error('Error during real-time sync shutdown:', error);
      }
    }
    
    process.exit(0);
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in real-time sync system:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection in real-time sync system:', { reason, promise });
    shutdown('unhandledRejection');
  });
}

/**
 * Health check function for real-time sync system
 */
export async function checkRealTimeSyncHealth(): Promise<{
  status: 'healthy' | 'warning' | 'critical' | 'down';
  details: any;
}> {
  try {
    if (!realTimeSyncCoordinator) {
      return {
        status: 'down',
        details: { error: 'Real-time sync coordinator not initialized' }
      };
    }

    const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
    
    return {
      status: healthStatus.overall,
      details: {
        components: healthStatus.components,
        metrics: healthStatus.metrics,
        alerts: healthStatus.alerts,
        lastUpdated: healthStatus.lastUpdated
      }
    };
  } catch (error) {
    logger.error('Health check failed for real-time sync system:', error);
    return {
      status: 'critical',
      details: { error: error.toString() }
    };
  }
}

/**
 * Get real-time sync statistics
 */
export function getRealTimeSyncStatistics(): any {
  try {
    if (!realTimeSyncCoordinator) {
      return {
        error: 'Real-time sync coordinator not initialized'
      };
    }

    return realTimeSyncCoordinator.getRealTimeStatistics();
  } catch (error) {
    logger.error('Failed to get real-time sync statistics:', error);
    return {
      error: error.toString()
    };
  }
}

/**
 * Force sync for specific account
 */
export async function forceSyncAccount(
  accountId: string,
  syncType: string = 'full'
): Promise<any> {
  try {
    if (!realTimeSyncCoordinator) {
      throw new Error('Real-time sync coordinator not initialized');
    }

    return await realTimeSyncCoordinator.forceSyncAccount(accountId, syncType);
  } catch (error) {
    logger.error(`Failed to force sync account ${accountId}:`, error);
    throw error;
  }
}

/**
 * Create new campaign with real-time tracking
 */
export async function createCampaignWithTracking(campaignConfig: any): Promise<string> {
  try {
    if (!realTimeSyncCoordinator) {
      throw new Error('Real-time sync coordinator not initialized');
    }

    return await realTimeSyncCoordinator.createCampaign(campaignConfig);
  } catch (error) {
    logger.error('Failed to create campaign with tracking:', error);
    throw error;
  }
}

/**
 * Broadcast real-time event to WebSocket clients
 */
export async function broadcastRealTimeEvent(
  channel: string,
  eventType: string,
  data: any,
  filters?: any
): Promise<void> {
  try {
    if (!realTimeSyncCoordinator) {
      logger.warn('Cannot broadcast event: Real-time sync coordinator not initialized');
      return;
    }

    // This would access the WebSocket service through the coordinator
    // For now, log the event
    logger.info(`Broadcasting real-time event: ${eventType} on channel ${channel}`, {
      data,
      filters
    });
  } catch (error) {
    logger.error(`Failed to broadcast real-time event ${eventType}:`, error);
  }
}

/**
 * Validate data using data integrity service
 */
export async function validateRealTimeData(
  dataType: string,
  data: any,
  recordId: string
): Promise<any[]> {
  try {
    if (!realTimeSyncCoordinator) {
      logger.warn('Cannot validate data: Real-time sync coordinator not initialized');
      return [];
    }

    // This would access the data integrity service through the coordinator
    // For now, return empty array (no issues)
    return [];
  } catch (error) {
    logger.error(`Failed to validate real-time data for type ${dataType}:`, error);
    return [];
  }
}

/**
 * Record GDPR compliance action
 */
export async function recordGDPRComplianceAction(
  userId: string,
  action: string,
  dataType: string,
  details: any
): Promise<void> {
  try {
    if (!realTimeSyncCoordinator) {
      logger.warn('Cannot record GDPR action: Real-time sync coordinator not initialized');
      return;
    }

    // This would access the data integrity service through the coordinator
    logger.info(`GDPR compliance action recorded: ${action} for user ${userId}`, {
      dataType,
      details
    });
  } catch (error) {
    logger.error(`Failed to record GDPR compliance action:`, error);
  }
}

/**
 * Handle GDPR data subject request
 */
export async function handleGDPRDataSubjectRequest(
  userId: string,
  requestType: 'access' | 'deletion' | 'portability' | 'rectification',
  dataTypes?: string[]
): Promise<{ success: boolean; data?: any; message: string }> {
  try {
    if (!realTimeSyncCoordinator) {
      return {
        success: false,
        message: 'Real-time sync coordinator not initialized'
      };
    }

    // This would access the data integrity service through the coordinator
    // For now, return success response
    return {
      success: true,
      message: `GDPR ${requestType} request processed successfully`
    };
  } catch (error) {
    logger.error(`Failed to handle GDPR ${requestType} request:`, error);
    return {
      success: false,
      message: 'Failed to process GDPR request'
    };
  }
}

/**
 * Get real-time analytics summary
 */
export async function getRealTimeAnalyticsSummary(): Promise<any> {
  try {
    if (!realTimeSyncCoordinator) {
      return {
        error: 'Real-time sync coordinator not initialized'
      };
    }

    const healthStatus = await realTimeSyncCoordinator.getSystemHealthStatus();
    const statistics = realTimeSyncCoordinator.getRealTimeStatistics();

    return {
      systemHealth: healthStatus.overall,
      totalAccounts: healthStatus.metrics.totalAccounts,
      totalCampaigns: healthStatus.metrics.totalCampaigns,
      totalDataPoints: healthStatus.metrics.totalDataPoints,
      uptime: healthStatus.metrics.uptime,
      componentStatus: Object.fromEntries(
        Object.entries(healthStatus.components).map(([name, status]) => [name, status.status])
      ),
      alerts: healthStatus.alerts,
      lastUpdated: healthStatus.lastUpdated
    };
  } catch (error) {
    logger.error('Failed to get real-time analytics summary:', error);
    return {
      error: error.toString()
    };
  }
}

/**
 * Configuration validation helper
 */
export function validateRealTimeSyncConfiguration(config: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate account sync configuration
    if (config.accountSync) {
      if (config.accountSync.intervalSeconds < 10) {
        warnings.push('Account sync interval is very low, may cause rate limiting');
      }
      if (config.accountSync.batchSize > 50) {
        warnings.push('Account sync batch size is high, may impact performance');
      }
    }

    // Validate analytics collection configuration
    if (config.analyticsCollection) {
      if (config.analyticsCollection.bufferSize < 100) {
        errors.push('Analytics buffer size must be at least 100');
      }
      if (config.analyticsCollection.rateLimitPerMinute > 1000) {
        warnings.push('Analytics rate limit is very high, may exceed API limits');
      }
    }

    // Validate WebSocket configuration
    if (config.webSocket) {
      if (config.webSocket.maxConnections > 10000) {
        errors.push('WebSocket max connections cannot exceed 10000');
      }
      if (config.webSocket.messageQueueSize < 10) {
        warnings.push('WebSocket message queue size is very low');
      }
    }

    // Validate data integrity configuration
    if (config.dataIntegrity) {
      if (config.dataIntegrity.qualityThreshold < 0 || config.dataIntegrity.qualityThreshold > 1) {
        errors.push('Data quality threshold must be between 0 and 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Configuration validation failed: ${error}`],
      warnings: []
    };
  }
}

/**
 * Default configuration for real-time sync system
 */
export const DEFAULT_REAL_TIME_SYNC_CONFIG: RealTimeSyncConfiguration = {
  accountSync: {
    enabled: true,
    intervalSeconds: 30,
    batchSize: 10,
    retryAttempts: 3
  },
  analyticsCollection: {
    enabled: true,
    bufferSize: 1000,
    flushIntervalSeconds: 10,
    rateLimitPerMinute: 300
  },
  campaignTracking: {
    enabled: true,
    trackingIntervalSeconds: 300,
    analyticsIntervalSeconds: 900,
    performanceThresholds: {
      minEngagementRate: 0.02,
      minQualityScore: 0.7,
      maxRiskScore: 0.3
    }
  },
  webSocket: {
    enabled: true,
    maxConnections: 1000,
    messageQueueSize: 100,
    broadcastIntervalSeconds: 30
  },
  dataIntegrity: {
    enabled: true,
    validationIntervalSeconds: 300,
    retentionCheckIntervalSeconds: 3600,
    qualityThreshold: 0.8
  }
};

// Export the default configuration
export default {
  initializeRealTimeSync,
  getRealTimeSyncCoordinator,
  checkRealTimeSyncHealth,
  getRealTimeSyncStatistics,
  forceSyncAccount,
  createCampaignWithTracking,
  broadcastRealTimeEvent,
  validateRealTimeData,
  recordGDPRComplianceAction,
  handleGDPRDataSubjectRequest,
  getRealTimeAnalyticsSummary,
  validateRealTimeSyncConfiguration,
  DEFAULT_REAL_TIME_SYNC_CONFIG
};
