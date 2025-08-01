/**
 * Service Initializer
 * 
 * Handles the startup and initialization of all services in the correct order
 * for comprehensive testing with real credentials.
 */

import { CoreBackendController } from '../controllers/coreBackendController';
import { logger } from '../utils/logger';

export class ServiceInitializer {
  private controller: CoreBackendController | null = null;
  private isInitialized: boolean = false;
  private initializationStartTime: number = 0;

  constructor() {
    this.initializationStartTime = Date.now();
  }

  /**
   * Initialize all services
   */
  async initializeAllServices(): Promise<CoreBackendController> {
    try {
      logger.info('🚀 Starting comprehensive service initialization...');
      
      // Create controller instance
      this.controller = new CoreBackendController();
      
      // Initialize the controller (this will initialize all services)
      await this.controller.initialize();
      
      this.isInitialized = true;
      
      const initTime = Date.now() - this.initializationStartTime;
      logger.info(`✅ All services initialized successfully in ${initTime}ms`);
      
      // Log service status
      await this.logServiceStatus();
      
      return this.controller;
      
    } catch (error) {
      logger.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Log the status of all services
   */
  private async logServiceStatus(): Promise<void> {
    if (!this.controller) return;

    logger.info('📋 Service Status Report:');
    logger.info('='.repeat(50));

    const services = [
      { name: 'Account Simulator Service', property: 'accountSimulatorService' },
      { name: 'Advanced Cache Manager', property: 'advancedCacheManager' },
      { name: 'Analytics Service', property: 'analyticsService' },
      { name: 'Anti-Detection Service', property: 'antiDetectionService' },
      { name: 'Campaign Orchestrator', property: 'campaignOrchestrator' },
      { name: 'Compliance Audit Service', property: 'complianceAuditService' },
      { name: 'Compliance Integration Service', property: 'complianceIntegrationService' },
      { name: 'Content Safety Filter', property: 'contentSafetyFilter' },
      { name: 'Correlation Manager', property: 'correlationManager' },
      { name: 'Database Monitor', property: 'databaseMonitor' },
      { name: 'Disaster Recovery Service', property: 'disasterRecoveryService' },
      { name: 'Emergency Stop System', property: 'emergencyStopSystem' },
      { name: 'Enhanced API Client', property: 'enhancedApiClient' },
      { name: 'Enterprise Anti-Detection Manager', property: 'enterpriseAntiDetectionManager' },
      { name: 'Enterprise Auth Service', property: 'enterpriseAuthService' },
      { name: 'Enterprise Database Manager', property: 'enterpriseDatabaseManager' },
      { name: 'Enterprise Python Process Manager', property: 'enterprisePythonProcessManager' },
      { name: 'Enterprise Service Orchestrator', property: 'enterpriseServiceOrchestrator' },
      { name: 'Enterprise Service Registry', property: 'enterpriseServiceRegistry' },
      { name: 'Error Analytics Platform', property: 'errorAnalyticsPlatform' },
      { name: 'Global Rate Limit Coordinator', property: 'globalRateLimitCoordinator' },
      { name: 'Intelligent Retry Engine', property: 'intelligentRetryEngine' },
      { name: 'Intelligent Retry Manager', property: 'intelligentRetryManager' },
      { name: 'Account Health Monitor', property: 'accountHealthMonitor' }
    ];

    let initializedCount = 0;
    let totalCount = services.length;

    for (const service of services) {
      try {
        const serviceInstance = (this.controller as any)[service.property];
        const isInitialized = serviceInstance !== null && serviceInstance !== undefined;
        
        if (isInitialized) {
          initializedCount++;
          logger.info(`  ✅ ${service.name}`);
        } else {
          logger.warn(`  ❌ ${service.name} - Not initialized`);
        }
      } catch (error) {
        logger.warn(`  ⚠️  ${service.name} - Error checking status`);
      }
    }

    logger.info('='.repeat(50));
    logger.info(`📊 Summary: ${initializedCount}/${totalCount} services initialized`);
    logger.info(`🎯 Success Rate: ${((initializedCount / totalCount) * 100).toFixed(1)}%`);
    logger.info('='.repeat(50));

    if (initializedCount === totalCount) {
      logger.info('🎉 All services are ready for testing!');
    } else {
      logger.warn(`⚠️  ${totalCount - initializedCount} services failed to initialize`);
      logger.info('💡 Services may still be functional with graceful degradation');
    }
  }

  /**
   * Get the initialized controller
   */
  getController(): CoreBackendController | null {
    return this.controller;
  }

  /**
   * Check if services are initialized
   */
  isServicesInitialized(): boolean {
    return this.isInitialized && this.controller !== null;
  }

  /**
   * Get service health status
   */
  async getServiceHealthStatus(): Promise<any> {
    if (!this.controller) {
      return { status: 'not_initialized', services: [] };
    }

    const healthStatus = {
      status: 'initialized',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.initializationStartTime,
      services: [] as any[]
    };

    // Check each service
    const serviceChecks = [
      { name: 'accountSimulatorService', method: 'getSimulatedAccounts' },
      { name: 'advancedCacheManager', method: 'getCacheMetrics' },
      { name: 'analyticsService', method: 'getAnalyticsData' },
      { name: 'contentSafetyFilter', method: 'analyzeContent' },
      { name: 'globalRateLimitCoordinator', method: 'getRateLimitStatus' },
      { name: 'enterpriseAuthService', method: 'generateAuthTokens' }
    ];

    for (const check of serviceChecks) {
      try {
        const service = (this.controller as any)[check.name];
        const isHealthy = service !== null && service !== undefined;
        
        healthStatus.services.push({
          name: check.name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          available: isHealthy
        });
      } catch (error) {
        healthStatus.services.push({
          name: check.name,
          status: 'error',
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return healthStatus;
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🛑 Shutting down all services...');
      
      if (this.controller) {
        await this.controller.shutdown();
      }
      
      this.isInitialized = false;
      this.controller = null;
      
      logger.info('✅ All services shut down successfully');
    } catch (error) {
      logger.error('❌ Error during service shutdown:', error);
      throw error;
    }
  }
}

// Global service initializer instance
let globalServiceInitializer: ServiceInitializer | null = null;

/**
 * Get or create the global service initializer
 */
export function getServiceInitializer(): ServiceInitializer {
  if (!globalServiceInitializer) {
    globalServiceInitializer = new ServiceInitializer();
  }
  return globalServiceInitializer;
}

/**
 * Initialize services if not already initialized
 */
export async function ensureServicesInitialized(): Promise<CoreBackendController> {
  const initializer = getServiceInitializer();
  
  if (!initializer.isServicesInitialized()) {
    await initializer.initializeAllServices();
  }
  
  const controller = initializer.getController();
  if (!controller) {
    throw new Error('Failed to get initialized controller');
  }
  
  return controller;
}

/**
 * Get service health status
 */
export async function getServicesHealthStatus(): Promise<any> {
  const initializer = getServiceInitializer();
  return await initializer.getServiceHealthStatus();
}

/**
 * Shutdown all services
 */
export async function shutdownAllServices(): Promise<void> {
  if (globalServiceInitializer) {
    await globalServiceInitializer.shutdown();
    globalServiceInitializer = null;
  }
}
