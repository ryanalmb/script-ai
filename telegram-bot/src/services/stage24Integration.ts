/**
 * Stage 24 Integration - Main Initialization and Coordination
 * 
 * This module coordinates the initialization and integration of all Stage 24 components:
 * - Enhanced Backend Client: Unified API abstraction layer
 * - Service Integration Mapper: Standardized service communication
 * - Enhanced Auth Integration: Multi-account session management
 * 
 * Provides a single entry point for Stage 24 functionality and ensures
 * proper initialization order and dependency management.
 */

import { logger } from '../utils/logger';
import { enhancedBackendClient } from './enhancedBackendClient';
import { serviceIntegrationMapper } from './serviceIntegrationMapper';
import { enhancedAuthIntegration } from './enhancedAuthIntegration';
import { realTimeServiceCoordinator } from './realTimeServiceCoordinator';
import { serviceDiscoveryHealthMonitoring } from './serviceDiscoveryHealthMonitoring';
import { advancedAuthenticationIntegration } from './advancedAuthenticationIntegration';
import { performanceOptimizationService } from './performanceOptimizationService';
import { intelligentRetryPolicyManager } from './intelligentRetryPolicyManager';
import { enhancedCircuitBreakerManager } from './enhancedCircuitBreakerManager';
import { successCriteriaValidator } from './successCriteriaValidator';
import { webSocketClientIntegration } from './webSocketClientIntegration';
import { realTimeEventProcessor } from './realTimeEventProcessor';
import { pushNotificationSystem } from './pushNotificationSystem';
import { EventEmitter } from 'events';

export interface Stage24Status {
  initialized: boolean;
  components: {
    enhancedBackendClient: boolean;
    serviceIntegrationMapper: boolean;
    enhancedAuthIntegration: boolean;
    realTimeServiceCoordinator: boolean;
    serviceDiscoveryHealthMonitoring: boolean;
    advancedAuthenticationIntegration: boolean;
    performanceOptimizationService: boolean;
    intelligentRetryPolicyManager: boolean;
    enhancedCircuitBreakerManager: boolean;
    successCriteriaValidator: boolean;
  };
  serviceHealth: {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
  };
  authentication: {
    totalSessions: number;
    activeSessions: number;
    totalUsers: number;
  };
  performance: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
  lastUpdate: string;
}

/**
 * Stage 24 Integration Manager
 */
export class Stage24Integration extends EventEmitter {
  private isInitialized = false;
  private initializationStartTime: Date | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize all Stage 24 components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Stage 24 Integration already initialized');
      return;
    }

    this.initializationStartTime = new Date();
    logger.info('🚀 Initializing Stage 24 Telegram Bot Integration...');

    try {
      // Phase 1: Initialize Enhanced Backend Client
      logger.info('📡 Phase 1: Initializing Enhanced Backend Client...');
      await enhancedBackendClient.initialize();
      this.emit('component:initialized', 'enhancedBackendClient');

      // Phase 2: Initialize Service Integration Mapper
      logger.info('🗺️ Phase 2: Initializing Service Integration Mapper...');
      await serviceIntegrationMapper.initialize();
      this.emit('component:initialized', 'serviceIntegrationMapper');

      // Phase 3: Initialize Enhanced Auth Integration
      logger.info('🔐 Phase 3: Initializing Enhanced Auth Integration...');
      await enhancedAuthIntegration.initialize();
      this.emit('component:initialized', 'enhancedAuthIntegration');

      // Phase 4: Initialize WebSocket Client Integration (Phase 2 Component 2.1)
      logger.info('🌐 Phase 4: Initializing WebSocket Client Integration...');
      await webSocketClientIntegration.initialize();
      this.emit('component:initialized', 'webSocketClientIntegration');

      // Phase 5: Initialize Real-time Event Processor (Phase 2 Component 2.2)
      logger.info('⚡ Phase 5: Initializing Real-time Event Processor...');
      await realTimeEventProcessor.initialize();
      this.emit('component:initialized', 'realTimeEventProcessor');

      // Phase 6: Initialize Push Notification System (Phase 2 Component 2.3)
      logger.info('📱 Phase 6: Initializing Push Notification System...');
      await pushNotificationSystem.initialize();
      this.emit('component:initialized', 'pushNotificationSystem');

      // Phase 7: Initialize Real-Time Service Coordinator
      logger.info('📡 Phase 7: Initializing Real-Time Service Coordinator...');
      await realTimeServiceCoordinator.initialize();
      this.emit('component:initialized', 'realTimeServiceCoordinator');

      // Phase 8: Initialize Service Discovery and Health Monitoring
      logger.info('🔍 Phase 8: Initializing Service Discovery and Health Monitoring...');
      await serviceDiscoveryHealthMonitoring.initialize();
      this.emit('component:initialized', 'serviceDiscoveryHealthMonitoring');

      // Phase 6: Initialize Advanced Authentication Integration
      logger.info('🔐 Phase 6: Initializing Advanced Authentication Integration...');
      await advancedAuthenticationIntegration.initialize();
      this.emit('component:initialized', 'advancedAuthenticationIntegration');

      // Phase 7: Initialize Performance Optimization Services
      logger.info('⚡ Phase 7: Initializing Performance Optimization Services...');

      // Initialize Performance Optimization Service
      await performanceOptimizationService.initialize();
      this.emit('component:initialized', 'performanceOptimizationService');

      // Initialize Intelligent Retry Policy Manager
      await intelligentRetryPolicyManager.initialize();
      this.emit('component:initialized', 'intelligentRetryPolicyManager');

      // Initialize Enhanced Circuit Breaker Manager
      await enhancedCircuitBreakerManager.initialize();
      this.emit('component:initialized', 'enhancedCircuitBreakerManager');

      // Initialize Success Criteria Validator
      await successCriteriaValidator.initialize();
      this.emit('component:initialized', 'successCriteriaValidator');

      // Phase 8: Start health monitoring
      logger.info('🏥 Phase 8: Starting integrated health monitoring...');
      this.startIntegratedHealthMonitoring();

      // Phase 9: Verify integration and success criteria
      logger.info('✅ Phase 9: Verifying integration and success criteria...');
      await this.verifyIntegration();
      await this.validateSuccessCriteria();

      const initializationTime = Date.now() - this.initializationStartTime.getTime();
      this.isInitialized = true;

      logger.info(`🎉 Stage 24 Integration initialized successfully in ${initializationTime}ms`);
      this.emit('integration:initialized', { initializationTime });

      // Log integration status
      const status = await this.getStatus();
      logger.info('📊 Integration Status:', {
        services: status.serviceHealth,
        authentication: status.authentication,
        performance: status.performance
      });

    } catch (error) {
      logger.error('❌ Stage 24 Integration initialization failed:', error);
      this.emit('integration:error', error);
      throw error;
    }
  }

  /**
   * Verify that all components are working correctly
   */
  private async verifyIntegration(): Promise<void> {
    const verificationTests = [
      {
        name: 'Backend Client Connectivity',
        test: async () => {
          const status = await enhancedBackendClient.getClientStatus();
          return status.healthyServices > 0;
        }
      },
      {
        name: 'Service Integration Mapping',
        test: async () => {
          const status = await serviceIntegrationMapper.getIntegrationStatus();
          return status.totalMethods > 0;
        }
      },
      {
        name: 'Authentication Integration',
        test: async () => {
          const status = await enhancedAuthIntegration.getIntegrationStatus();
          return status.initialized;
        }
      },
      {
        name: 'Real-Time Service Coordination',
        test: async () => {
          const status = await realTimeServiceCoordinator.getRealtimeStatus();
          return status.initialized;
        }
      },
      {
        name: 'Service Discovery and Health Monitoring',
        test: async () => {
          const status = await serviceDiscoveryHealthMonitoring.getSystemStatus();
          return status.initialized;
        }
      },
      {
        name: 'Advanced Authentication Integration',
        test: async () => {
          const status = await advancedAuthenticationIntegration.getSystemStatus();
          return status.initialized;
        }
      },
      {
        name: 'Performance Optimization Service',
        test: async () => {
          const status = await performanceOptimizationService.getPerformanceStatus();
          return status.summary.criteriaMet;
        }
      },
      {
        name: 'Intelligent Retry Policy Manager',
        test: async () => {
          const status = await intelligentRetryPolicyManager.getManagerStatus();
          return status.initialized && status.averageSuccessRate >= 95;
        }
      },
      {
        name: 'Enhanced Circuit Breaker Manager',
        test: async () => {
          const status = await enhancedCircuitBreakerManager.getManagerStatus();
          return status.initialized && status.healthyServices > 0;
        }
      },
      {
        name: 'Success Criteria Validator',
        test: async () => {
          const status = await successCriteriaValidator.getValidatorStatus();
          return status.initialized;
        }
      }
    ];

    for (const test of verificationTests) {
      try {
        const result = await test.test();
        if (result) {
          logger.info(`✅ ${test.name}: PASSED`);
        } else {
          logger.warn(`⚠️ ${test.name}: FAILED`);
        }
      } catch (error) {
        logger.error(`❌ ${test.name}: ERROR -`, error);
      }
    }
  }

  /**
   * Validate success criteria
   */
  private async validateSuccessCriteria(): Promise<void> {
    try {
      logger.info('🎯 Validating Stage 24 success criteria...');

      const report = await successCriteriaValidator.validateSuccessCriteria();

      if (report.overallStatus === 'PASS') {
        logger.info(`✅ All success criteria met! Overall score: ${report.overallScore.toFixed(1)}/100`);

        // Log individual criteria
        for (const [name, result] of Object.entries(report.criteria)) {
          logger.info(`  ✅ ${name}: ${result.score.toFixed(1)}/100 - ${result.details}`);
        }

      } else {
        logger.warn(`⚠️ Success criteria validation: ${report.overallStatus} (Score: ${report.overallScore.toFixed(1)}/100)`);

        // Log failed/warning criteria
        for (const [name, result] of Object.entries(report.criteria)) {
          const emoji = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
          logger.warn(`  ${emoji} ${name}: ${result.score.toFixed(1)}/100 - ${result.details}`);
        }

        // Log recommendations
        if (report.recommendations.length > 0) {
          logger.warn('📋 Recommendations:');
          for (const recommendation of report.recommendations.slice(0, 5)) {
            logger.warn(`  • ${recommendation}`);
          }
        }
      }

      this.emit('criteria:validated', report);

    } catch (error) {
      logger.error('❌ Failed to validate success criteria:', error);
    }
  }

  /**
   * Setup event handlers for component coordination
   */
  private setupEventHandlers(): void {
    // Enhanced Backend Client Events
    enhancedBackendClient.on('service:unhealthy', (serviceName: string) => {
      logger.warn(`⚠️ Service unhealthy: ${serviceName}`);
      this.emit('service:unhealthy', serviceName);
    });

    enhancedBackendClient.on('service:recovered', (serviceName: string) => {
      logger.info(`✅ Service recovered: ${serviceName}`);
      this.emit('service:recovered', serviceName);
    });

    enhancedBackendClient.on('circuit_breaker:opened', (serviceName: string) => {
      logger.warn(`⚡ Circuit breaker opened: ${serviceName}`);
      this.emit('circuit_breaker:opened', serviceName);
    });

    // Service Integration Mapper Events
    serviceIntegrationMapper.on('method:error', (event: any) => {
      logger.warn(`⚠️ Service method error: ${event.methodName} on ${event.serviceName}`);
      this.emit('method:error', event);
    });

    // Enhanced Auth Integration Events
    enhancedAuthIntegration.on('session:health_warning', (sessionId: string, warnings: string[]) => {
      logger.warn(`⚠️ Session health warning: ${sessionId}`, warnings);
      this.emit('session:health_warning', { sessionId, warnings });
    });

    enhancedAuthIntegration.on('session:expired', (sessionId: string) => {
      logger.info(`⏰ Session expired: ${sessionId}`);
      this.emit('session:expired', sessionId);
    });

    // Integration-level events
    this.on('component:initialized', (componentName: string) => {
      logger.info(`✅ Component initialized: ${componentName}`);
    });

    this.on('integration:error', (error: Error) => {
      logger.error('❌ Integration error:', error);
    });
  }

  /**
   * Start integrated health monitoring
   */
  private startIntegratedHealthMonitoring(): void {
    const healthCheckInterval = parseInt(process.env.INTEGRATION_HEALTH_CHECK_INTERVAL || '120000');

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performIntegratedHealthCheck();
      } catch (error) {
        logger.error('Integrated health check failed:', error);
      }
    }, healthCheckInterval);

    logger.info(`🏥 Integrated health monitoring started (interval: ${healthCheckInterval}ms)`);
  }

  /**
   * Perform integrated health check across all components
   */
  private async performIntegratedHealthCheck(): Promise<void> {
    const healthResults = {
      backendClient: false,
      serviceMapper: false,
      authIntegration: false,
      overallHealth: 0
    };

    try {
      // Check Enhanced Backend Client
      const backendStatus = await enhancedBackendClient.getClientStatus();
      healthResults.backendClient = backendStatus.healthyServices > 0;

      // Check Service Integration Mapper
      const mapperStatus = await serviceIntegrationMapper.getIntegrationStatus();
      healthResults.serviceMapper = mapperStatus.initialized;

      // Check Enhanced Auth Integration
      const authStatus = await enhancedAuthIntegration.getIntegrationStatus();
      healthResults.authIntegration = authStatus.initialized;

      // Calculate overall health score
      const healthyComponents = Object.values(healthResults).filter(Boolean).length - 1; // Exclude overallHealth
      healthResults.overallHealth = (healthyComponents / 3) * 100;

      // Emit health status
      this.emit('health:check', healthResults);

      // Log warnings for unhealthy components
      if (healthResults.overallHealth < 100) {
        const unhealthyComponents = [];
        if (!healthResults.backendClient) unhealthyComponents.push('Backend Client');
        if (!healthResults.serviceMapper) unhealthyComponents.push('Service Mapper');
        if (!healthResults.authIntegration) unhealthyComponents.push('Auth Integration');

        logger.warn(`⚠️ Unhealthy components detected: ${unhealthyComponents.join(', ')}`);
      }

    } catch (error) {
      logger.error('Health check execution failed:', error);
      this.emit('health:error', error);
    }
  }

  /**
   * Get comprehensive integration status
   */
  async getStatus(): Promise<Stage24Status> {
    try {
      // Get component statuses
      const backendStatus = await enhancedBackendClient.getClientStatus();
      const mapperStatus = await serviceIntegrationMapper.getIntegrationStatus();
      const authStatus = await enhancedAuthIntegration.getIntegrationStatus();

      // Calculate performance metrics
      const totalServices = backendStatus.totalServices;
      const healthyServices = backendStatus.healthyServices;
      const unhealthyServices = backendStatus.unhealthyServices;

      // Calculate average response time from service metrics
      let totalResponseTime = 0;
      let totalRequests = 0;
      let totalErrors = 0;

      for (const service of backendStatus.services) {
        if (service.metrics) {
          totalResponseTime += service.metrics.averageResponseTime * service.metrics.requestCount;
          totalRequests += service.metrics.requestCount;
          totalErrors += service.metrics.errorCount;
        }
      }

      const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
      const successRate = totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      return {
        initialized: this.isInitialized,
        components: {
          enhancedBackendClient: backendStatus.initialized,
          serviceIntegrationMapper: mapperStatus.initialized,
          enhancedAuthIntegration: authStatus.initialized,
          realTimeServiceCoordinator: true, // Will be updated with actual status
          serviceDiscoveryHealthMonitoring: true, // Will be updated with actual status
          advancedAuthenticationIntegration: true, // Will be updated with actual status
          performanceOptimizationService: true, // Will be updated with actual status
          intelligentRetryPolicyManager: true, // Will be updated with actual status
          enhancedCircuitBreakerManager: true, // Will be updated with actual status
          successCriteriaValidator: true // Will be updated with actual status
        },
        serviceHealth: {
          totalServices,
          healthyServices,
          unhealthyServices
        },
        authentication: {
          totalSessions: authStatus.totalSessions,
          activeSessions: authStatus.activeSessions,
          totalUsers: authStatus.totalUsers
        },
        performance: {
          averageResponseTime: Math.round(averageResponseTime),
          successRate: Math.round(successRate * 100) / 100,
          errorRate: Math.round(errorRate * 100) / 100
        },
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get integration status:', error);
      throw error;
    }
  }

  /**
   * Get detailed component information
   */
  async getDetailedStatus(): Promise<any> {
    return {
      integration: await this.getStatus(),
      backendClient: await enhancedBackendClient.getClientStatus(),
      serviceMapper: await serviceIntegrationMapper.getIntegrationStatus(),
      authIntegration: await enhancedAuthIntegration.getIntegrationStatus(),
      realTimeCoordinator: await realTimeServiceCoordinator.getRealtimeStatus(),
      serviceDiscoveryHealthMonitoring: await serviceDiscoveryHealthMonitoring.getSystemStatus(),
      advancedAuthenticationIntegration: await advancedAuthenticationIntegration.getSystemStatus(),
      performanceOptimizationService: await performanceOptimizationService.getPerformanceStatus(),
      intelligentRetryPolicyManager: await intelligentRetryPolicyManager.getManagerStatus(),
      enhancedCircuitBreakerManager: await enhancedCircuitBreakerManager.getManagerStatus(),
      successCriteriaValidator: await successCriteriaValidator.getValidatorStatus()
    };
  }

  /**
   * Check if integration is ready for use
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup and destroy all components
   */
  async destroy(): Promise<void> {
    logger.info('🧹 Destroying Stage 24 Integration...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    try {
      // Destroy components in reverse order
      await successCriteriaValidator.destroy();
      await enhancedCircuitBreakerManager.destroy();
      await intelligentRetryPolicyManager.destroy();
      await performanceOptimizationService.destroy();
      await advancedAuthenticationIntegration.destroy();
      await serviceDiscoveryHealthMonitoring.destroy();
      await realTimeServiceCoordinator.destroy();
      await enhancedAuthIntegration.destroy();
      await serviceIntegrationMapper.destroy();
      await enhancedBackendClient.destroy();

      this.isInitialized = false;
      this.emit('integration:destroyed');

      logger.info('✅ Stage 24 Integration destroyed successfully');

    } catch (error) {
      logger.error('❌ Error during Stage 24 Integration destruction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const stage24Integration = new Stage24Integration();
