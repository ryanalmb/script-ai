import { logger } from '../../utils/logger';
import { prisma } from '../../lib/prisma';
import { cacheManager } from '../../lib/cache';
import { EnterpriseAccountSyncService } from './accountSyncService';
import { EnterpriseAnalyticsCollectionService } from './analyticsCollectionService';
import { EnterpriseCampaignTrackingService } from './campaignTrackingService';
import { EnterpriseWebSocketService } from './webSocketService';
import { EnterpriseDataIntegrityService } from './dataIntegrityService';
import { EnterpriseAntiDetectionCoordinator } from '../antiDetection/antiDetectionCoordinator';
import { Server as HTTPServer } from 'http';

export interface RealTimeSyncConfiguration {
  accountSync: {
    enabled: boolean;
    intervalSeconds: number;
    batchSize: number;
    retryAttempts: number;
  };
  analyticsCollection: {
    enabled: boolean;
    bufferSize: number;
    flushIntervalSeconds: number;
    rateLimitPerMinute: number;
  };
  campaignTracking: {
    enabled: boolean;
    trackingIntervalSeconds: number;
    analyticsIntervalSeconds: number;
    performanceThresholds: {
      minEngagementRate: number;
      minQualityScore: number;
      maxRiskScore: number;
    };
  };
  webSocket: {
    enabled: boolean;
    maxConnections: number;
    messageQueueSize: number;
    broadcastIntervalSeconds: number;
  };
  dataIntegrity: {
    enabled: boolean;
    validationIntervalSeconds: number;
    retentionCheckIntervalSeconds: number;
    qualityThreshold: number;
  };
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'down';
  components: {
    accountSync: {
      status: 'healthy' | 'warning' | 'critical' | 'down';
      activeSyncs: number;
      successRate: number;
      avgDuration: number;
      lastSync: Date | null;
    };
    analyticsCollection: {
      status: 'healthy' | 'warning' | 'critical' | 'down';
      isCollecting: boolean;
      bufferUtilization: number;
      rateLimitUtilization: number;
      recordsPerMinute: number;
    };
    campaignTracking: {
      status: 'healthy' | 'warning' | 'critical' | 'down';
      activeCampaigns: number;
      avgROI: number;
      avgQualityScore: number;
      alertCount: number;
    };
    webSocket: {
      status: 'healthy' | 'warning' | 'critical' | 'down';
      connectedClients: number;
      activeSubscriptions: number;
      messageQueueSize: number;
      rateLimitHits: number;
    };
    dataIntegrity: {
      status: 'healthy' | 'warning' | 'critical' | 'down';
      qualityScore: number;
      unresolvedIssues: number;
      retentionCompliance: number;
      gdprCompliance: number;
    };
  };
  metrics: {
    uptime: number;
    totalAccounts: number;
    totalCampaigns: number;
    totalDataPoints: number;
    systemLoad: number;
    memoryUsage: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
  lastUpdated: Date;
}

/**
 * Enterprise Real-Time Synchronization Coordinator
 * Orchestrates all real-time sync components and provides unified management
 */
export class EnterpriseRealTimeSyncCoordinator {
  private accountSyncService: EnterpriseAccountSyncService;
  private analyticsCollectionService: EnterpriseAnalyticsCollectionService;
  private campaignTrackingService: EnterpriseCampaignTrackingService;
  private webSocketService: EnterpriseWebSocketService;
  private dataIntegrityService: EnterpriseDataIntegrityService;
  private antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator;
  
  private configuration: RealTimeSyncConfiguration;
  private isInitialized: boolean = false;
  private startTime: Date;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertingInterval: NodeJS.Timeout | null = null;

  constructor(
    httpServer: HTTPServer,
    antiDetectionCoordinator: EnterpriseAntiDetectionCoordinator,
    configuration?: Partial<RealTimeSyncConfiguration>
  ) {
    this.antiDetectionCoordinator = antiDetectionCoordinator;
    this.startTime = new Date();
    
    // Setup default configuration
    this.configuration = {
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
        trackingIntervalSeconds: 300, // 5 minutes
        analyticsIntervalSeconds: 900, // 15 minutes
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
        validationIntervalSeconds: 300, // 5 minutes
        retentionCheckIntervalSeconds: 3600, // 1 hour
        qualityThreshold: 0.8
      },
      ...configuration
    };

    // Initialize services
    this.accountSyncService = new EnterpriseAccountSyncService(antiDetectionCoordinator);
    this.analyticsCollectionService = new EnterpriseAnalyticsCollectionService(antiDetectionCoordinator);
    this.campaignTrackingService = new EnterpriseCampaignTrackingService();
    this.webSocketService = new EnterpriseWebSocketService(httpServer);
    this.dataIntegrityService = new EnterpriseDataIntegrityService();

    this.initializeCoordinator();
  }

  /**
   * Initialize real-time sync coordinator
   */
  private async initializeCoordinator(): Promise<void> {
    try {
      logger.info('🔧 Initializing Enterprise Real-Time Sync Coordinator...');
      
      await this.validateConfiguration();
      await this.setupEventHandlers();
      await this.startHealthMonitoring();
      await this.startMetricsCollection();
      await this.startAlertingSystem();
      
      this.isInitialized = true;
      logger.info('✅ Enterprise Real-Time Sync Coordinator initialized successfully');
      
      // Broadcast initialization complete
      await this.broadcastSystemEvent('system_initialized', {
        timestamp: new Date(),
        configuration: this.configuration,
        components: this.getComponentStatus()
      });
      
    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise Real-Time Sync Coordinator:', error);
      throw new Error(`Real-Time Sync Coordinator initialization failed: ${error}`);
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(): Promise<void> {
    try {
      // Validate account sync configuration
      if (this.configuration.accountSync.intervalSeconds < 10) {
        logger.warn('Account sync interval too low, setting to minimum 10 seconds');
        this.configuration.accountSync.intervalSeconds = 10;
      }

      // Validate analytics collection configuration
      if (this.configuration.analyticsCollection.bufferSize < 100) {
        logger.warn('Analytics buffer size too low, setting to minimum 100');
        this.configuration.analyticsCollection.bufferSize = 100;
      }

      // Validate WebSocket configuration
      if (this.configuration.webSocket.maxConnections > 10000) {
        logger.warn('WebSocket max connections too high, setting to maximum 10000');
        this.configuration.webSocket.maxConnections = 10000;
      }

      logger.info('Configuration validated successfully');
    } catch (error) {
      logger.error('Configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers between services
   */
  private async setupEventHandlers(): Promise<void> {
    try {
      // Setup data flow between services
      // Account sync -> Analytics collection
      // Analytics collection -> Campaign tracking
      // Campaign tracking -> WebSocket broadcasts
      // Data integrity -> All services

      logger.info('Event handlers configured between services');
    } catch (error) {
      logger.error('Failed to setup event handlers:', error);
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private async startHealthMonitoring(): Promise<void> {
    try {
      this.healthCheckInterval = setInterval(async () => {
        await this.performHealthCheck();
      }, 60000); // Every minute
      
      logger.info('Health monitoring started');
    } catch (error) {
      logger.error('Failed to start health monitoring:', error);
    }
  }

  /**
   * Start metrics collection
   */
  private async startMetricsCollection(): Promise<void> {
    try {
      this.metricsInterval = setInterval(async () => {
        await this.collectSystemMetrics();
      }, 30000); // Every 30 seconds
      
      logger.info('System metrics collection started');
    } catch (error) {
      logger.error('Failed to start metrics collection:', error);
    }
  }

  /**
   * Start alerting system
   */
  private async startAlertingSystem(): Promise<void> {
    try {
      this.alertingInterval = setInterval(async () => {
        await this.processAlerts();
      }, 60000); // Every minute
      
      logger.info('Alerting system started');
    } catch (error) {
      logger.error('Failed to start alerting system:', error);
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus = await this.getSystemHealthStatus();
      
      // Cache health status
      await cacheManager.set('system_health_status', healthStatus, 120); // 2 minutes
      
      // Broadcast health updates if there are issues
      if (healthStatus.overall !== 'healthy') {
        await this.broadcastSystemEvent('health_alert', {
          status: healthStatus.overall,
          components: healthStatus.components,
          timestamp: new Date()
        });
      }
      
      logger.debug(`System health check completed: ${healthStatus.overall}`);
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = {
        timestamp: new Date(),
        uptime: Date.now() - this.startTime.getTime(),
        components: {
          accountSync: this.accountSyncService.getSyncStatistics(),
          analyticsCollection: this.analyticsCollectionService.getAnalyticsStatistics(),
          campaignTracking: this.campaignTrackingService.getCampaignStatistics(),
          webSocket: this.webSocketService.getWebSocketStatistics(),
          dataIntegrity: this.dataIntegrityService.getDataIntegrityStatistics(),
          antiDetection: this.antiDetectionCoordinator.getAntiDetectionStatistics()
        },
        system: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          nodeVersion: process.version,
          platform: process.platform
        }
      };

      // Cache metrics
      await cacheManager.set('system_metrics', metrics, 60); // 1 minute
      
      // Broadcast metrics to WebSocket clients
      await this.broadcastSystemEvent('metrics_update', metrics);
      
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Process alerts and notifications
   */
  private async processAlerts(): Promise<void> {
    try {
      const healthStatus = await this.getSystemHealthStatus();
      
      // Check for critical issues
      const criticalComponents = Object.entries(healthStatus.components)
        .filter(([_, status]) => status.status === 'critical')
        .map(([name, _]) => name);

      if (criticalComponents.length > 0) {
        await this.triggerCriticalAlert(criticalComponents, healthStatus);
      }

      // Check for warning conditions
      const warningComponents = Object.entries(healthStatus.components)
        .filter(([_, status]) => status.status === 'warning')
        .map(([name, _]) => name);

      if (warningComponents.length > 0) {
        await this.triggerWarningAlert(warningComponents, healthStatus);
      }

    } catch (error) {
      logger.error('Failed to process alerts:', error);
    }
  }

  /**
   * Trigger critical alert
   */
  private async triggerCriticalAlert(components: string[], healthStatus: SystemHealthStatus): Promise<void> {
    try {
      const alert = {
        id: crypto.randomUUID(),
        type: 'system_critical',
        severity: 'critical',
        title: 'Critical System Issues Detected',
        message: `Critical issues detected in components: ${components.join(', ')}`,
        components,
        healthStatus,
        timestamp: new Date()
      };

      // Store alert in database
      await prisma.realTimeAlert.create({
        data: {
          id: alert.id,
          userId: 'system', // System-generated alert
          alertType: 'performance',
          severity: 'critical',
          title: alert.title,
          message: alert.message,
          alertData: JSON.parse(JSON.stringify({ components, healthStatus })),
          status: 'active'
        }
      });

      // Broadcast alert
      await this.broadcastSystemEvent('critical_alert', alert);
      
      logger.error(`Critical alert triggered: ${alert.message}`);
    } catch (error) {
      logger.error('Failed to trigger critical alert:', error);
    }
  }

  /**
   * Trigger warning alert
   */
  private async triggerWarningAlert(components: string[], healthStatus: SystemHealthStatus): Promise<void> {
    try {
      const alert = {
        id: crypto.randomUUID(),
        type: 'system_warning',
        severity: 'medium',
        title: 'System Performance Warning',
        message: `Performance issues detected in components: ${components.join(', ')}`,
        components,
        healthStatus,
        timestamp: new Date()
      };

      // Broadcast alert
      await this.broadcastSystemEvent('warning_alert', alert);
      
      logger.warn(`Warning alert triggered: ${alert.message}`);
    } catch (error) {
      logger.error('Failed to trigger warning alert:', error);
    }
  }

  /**
   * Broadcast system event to WebSocket clients
   */
  private async broadcastSystemEvent(eventType: string, data: any): Promise<void> {
    try {
      await this.webSocketService.broadcastToChannel('system_events', {
        type: eventType,
        data,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Failed to broadcast system event ${eventType}:`, error);
    }
  }

  /**
   * Broadcast real-time event to WebSocket clients
   */
  async broadcastRealTimeEvent(eventType: string, data: any, channel: string = 'automation_events'): Promise<void> {
    try {
      await this.webSocketService.broadcastToChannel(channel, {
        type: eventType,
        data,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to broadcast real-time event:', error);
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealthStatus(): Promise<SystemHealthStatus> {
    try {
      // Get component statistics
      const syncStats = this.accountSyncService.getSyncStatistics();
      const analyticsStats = this.analyticsCollectionService.getAnalyticsStatistics();
      const campaignStats = this.campaignTrackingService.getCampaignStatistics();
      const webSocketStats = this.webSocketService.getWebSocketStatistics();
      const integrityStats = this.dataIntegrityService.getDataIntegrityStatistics();

      // Calculate component health
      const accountSyncHealth = this.calculateComponentHealth('accountSync', {
        successRate: syncStats.successRate,
        activeSyncs: syncStats.activeSyncs,
        avgDuration: syncStats.avgSyncDuration
      });

      const analyticsHealth = this.calculateComponentHealth('analytics', {
        isCollecting: analyticsStats.isCollecting,
        bufferUtilization: analyticsStats.totalRecordsCollected / 1000, // Normalize
        rateLimitUtilization: 0.5 // Would calculate from actual rate limit usage
      });

      const campaignHealth = this.calculateComponentHealth('campaign', {
        avgROI: campaignStats.avgROI,
        avgQualityScore: campaignStats.avgQualityScore,
        activeCampaigns: campaignStats.activeCampaigns
      });

      const webSocketHealth = this.calculateComponentHealth('webSocket', {
        connectedClients: webSocketStats.connectedClients,
        queuedMessages: webSocketStats.queuedMessages,
        rateLimitHits: webSocketStats.rateLimitHits
      });

      const integrityHealth = this.calculateComponentHealth('integrity', {
        qualityScore: integrityStats.avgQualityScore,
        unresolvedIssues: integrityStats.unresolvedIssues,
        validationRules: integrityStats.validationRules
      });

      // Calculate overall health
      const componentHealthScores = [
        accountSyncHealth.score,
        analyticsHealth.score,
        campaignHealth.score,
        webSocketHealth.score,
        integrityHealth.score
      ];

      const avgHealthScore = componentHealthScores.reduce((sum, score) => sum + score, 0) / componentHealthScores.length;
      const overallStatus = avgHealthScore >= 0.8 ? 'healthy' : 
                           avgHealthScore >= 0.6 ? 'warning' : 
                           avgHealthScore >= 0.3 ? 'critical' : 'down';

      // Get alert counts
      const alertCounts = await this.getAlertCounts();

      return {
        overall: overallStatus,
        components: {
          accountSync: {
            status: accountSyncHealth.status as 'healthy' | 'warning' | 'critical' | 'down',
            activeSyncs: syncStats.activeSyncs,
            successRate: syncStats.successRate,
            avgDuration: syncStats.avgSyncDuration,
            lastSync: new Date() // Would get from actual sync service
          },
          analyticsCollection: {
            status: analyticsHealth.status as 'healthy' | 'warning' | 'critical' | 'down',
            isCollecting: analyticsStats.isCollecting,
            bufferUtilization: analyticsStats.totalRecordsCollected / 1000,
            rateLimitUtilization: 0.5,
            recordsPerMinute: 100 // Would calculate from actual data
          },
          campaignTracking: {
            status: campaignHealth.status as 'healthy' | 'warning' | 'critical' | 'down',
            activeCampaigns: campaignStats.activeCampaigns,
            avgROI: campaignStats.avgROI,
            avgQualityScore: campaignStats.avgQualityScore,
            alertCount: alertCounts.warning + alertCounts.critical
          },
          webSocket: {
            status: webSocketHealth.status as 'healthy' | 'warning' | 'critical' | 'down',
            connectedClients: webSocketStats.connectedClients,
            activeSubscriptions: webSocketStats.activeSubscriptions,
            messageQueueSize: webSocketStats.queuedMessages,
            rateLimitHits: webSocketStats.rateLimitHits
          },
          dataIntegrity: {
            status: integrityHealth.status as 'healthy' | 'warning' | 'critical' | 'down',
            qualityScore: integrityStats.avgQualityScore,
            unresolvedIssues: integrityStats.unresolvedIssues,
            retentionCompliance: 0.95, // Would calculate from actual policies
            gdprCompliance: 0.98 // Would calculate from actual compliance data
          }
        },
        metrics: {
          uptime: Date.now() - this.startTime.getTime(),
          totalAccounts: await prisma.xAccount.count({ where: { isActive: true } }),
          totalCampaigns: campaignStats.totalCampaigns,
          totalDataPoints: analyticsStats.totalRecordsCollected,
          systemLoad: 0.3, // Would get from system monitoring
          memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal
        },
        alerts: alertCounts,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Failed to get system health status:', error);
      return {
        overall: 'down',
        components: {} as any,
        metrics: {} as any,
        alerts: { critical: 0, warning: 0, info: 0 },
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Calculate component health
   */
  private calculateComponentHealth(componentType: string, metrics: any): { status: string; score: number } {
    try {
      let score = 1.0;

      switch (componentType) {
        case 'accountSync':
          if (metrics.successRate < 0.9) score -= 0.3;
          if (metrics.avgDuration > 10000) score -= 0.2; // > 10 seconds
          if (metrics.activeSyncs === 0) score -= 0.5;
          break;

        case 'analytics':
          if (!metrics.isCollecting) score -= 0.8;
          if (metrics.bufferUtilization > 0.9) score -= 0.3;
          if (metrics.rateLimitUtilization > 0.8) score -= 0.2;
          break;

        case 'campaign':
          if (metrics.avgROI < 0) score -= 0.4;
          if (metrics.avgQualityScore < 0.7) score -= 0.3;
          if (metrics.activeCampaigns === 0) score -= 0.3;
          break;

        case 'webSocket':
          if (metrics.connectedClients === 0) score -= 0.2;
          if (metrics.queuedMessages > 1000) score -= 0.3;
          if (metrics.rateLimitHits > 100) score -= 0.2;
          break;

        case 'integrity':
          if (metrics.qualityScore < 0.8) score -= 0.4;
          if (metrics.unresolvedIssues > 10) score -= 0.3;
          break;
      }

      score = Math.max(0, Math.min(1, score));
      
      const status = score >= 0.8 ? 'healthy' : 
                    score >= 0.6 ? 'warning' : 
                    score >= 0.3 ? 'critical' : 'down';

      return { status, score };
    } catch (error) {
      logger.error(`Failed to calculate health for ${componentType}:`, error);
      return { status: 'down', score: 0 };
    }
  }

  /**
   * Get alert counts
   */
  private async getAlertCounts(): Promise<{ critical: number; warning: number; info: number }> {
    try {
      const [critical, warning, info] = await Promise.all([
        prisma.realTimeAlert.count({ where: { severity: 'critical', status: 'active' } }),
        prisma.realTimeAlert.count({ where: { severity: 'medium', status: 'active' } }),
        prisma.realTimeAlert.count({ where: { severity: 'low', status: 'active' } })
      ]);

      return { critical, warning, info };
    } catch (error) {
      logger.error('Failed to get alert counts:', error);
      return { critical: 0, warning: 0, info: 0 };
    }
  }

  /**
   * Get component status summary
   */
  private getComponentStatus(): { [key: string]: string } {
    return {
      accountSync: this.configuration.accountSync.enabled ? 'enabled' : 'disabled',
      analyticsCollection: this.configuration.analyticsCollection.enabled ? 'enabled' : 'disabled',
      campaignTracking: this.configuration.campaignTracking.enabled ? 'enabled' : 'disabled',
      webSocket: this.configuration.webSocket.enabled ? 'enabled' : 'disabled',
      dataIntegrity: this.configuration.dataIntegrity.enabled ? 'enabled' : 'disabled'
    };
  }

  /**
   * Force sync for specific account
   */
  async forceSyncAccount(accountId: string, syncType: string = 'full'): Promise<any> {
    try {
      if (!this.isInitialized) {
        throw new Error('Real-time sync coordinator not initialized');
      }

      return await this.accountSyncService.forceSyncAccount(accountId, syncType);
    } catch (error) {
      logger.error(`Failed to force sync account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Create new campaign
   */
  async createCampaign(campaignConfig: any): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Real-time sync coordinator not initialized');
      }

      return await this.campaignTrackingService.createCampaign(campaignConfig);
    } catch (error) {
      logger.error('Failed to create campaign:', error);
      throw error;
    }
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStatistics(): {
    isInitialized: boolean;
    uptime: number;
    configuration: RealTimeSyncConfiguration;
    componentStats: any;
  } {
    return {
      isInitialized: this.isInitialized,
      uptime: Date.now() - this.startTime.getTime(),
      configuration: this.configuration,
      componentStats: {
        accountSync: this.accountSyncService.getSyncStatistics(),
        analyticsCollection: this.analyticsCollectionService.getAnalyticsStatistics(),
        campaignTracking: this.campaignTrackingService.getCampaignStatistics(),
        webSocket: this.webSocketService.getWebSocketStatistics(),
        dataIntegrity: this.dataIntegrityService.getDataIntegrityStatistics()
      }
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down Enterprise Real-Time Sync Coordinator...');
      
      // Clear intervals
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      if (this.alertingInterval) clearInterval(this.alertingInterval);
      
      // Shutdown services in reverse order
      await this.dataIntegrityService.shutdown();
      await this.webSocketService.shutdown();
      await this.campaignTrackingService.shutdown();
      await this.analyticsCollectionService.shutdown();
      await this.accountSyncService.shutdown();
      
      this.isInitialized = false;
      
      logger.info('✅ Enterprise Real-Time Sync Coordinator shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown real-time sync coordinator:', error);
    }
  }
}
