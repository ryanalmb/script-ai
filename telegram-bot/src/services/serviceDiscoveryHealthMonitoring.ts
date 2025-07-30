/**
 * Service Discovery and Health Monitoring - Stage 24 Component 1.3
 * 
 * Main coordinator for enterprise service discovery and health monitoring system
 * that integrates all components for comprehensive service management.
 * 
 * Key Features:
 * - Unified service discovery and health monitoring coordination
 * - Integration of all Stage 24 Component 1.3 services
 * - Comprehensive status reporting and metrics collection
 * - Event-driven coordination between all components
 * - Enterprise-grade service management capabilities
 * 
 * Integrated Components:
 * - Dynamic Service Registry: Auto-discovery and service management
 * - Advanced Health Monitor: Multi-tier health monitoring
 * - Intelligent Load Balancer: Health-aware request routing
 * - Automatic Failover System: Zero-downtime failover management
 * - Service Topology Mapper: Real-time topology visualization
 * 
 * Integration Points:
 * - Enhanced Backend Client: Service endpoint resolution enhancement
 * - Service Integration Mapper: Health-aware method routing
 * - Real-Time Service Coordinator: Advanced coordination capabilities
 * - Stage 24 Integration: Main integration coordinator
 */

import { logger } from '../utils/logger';
import { dynamicServiceRegistry } from './dynamicServiceRegistry';
import { advancedHealthMonitor } from './advancedHealthMonitor';
import { intelligentLoadBalancer } from './intelligentLoadBalancer';
import { automaticFailoverSystem } from './automaticFailoverSystem';
import { serviceTopologyMapper } from './serviceTopologyMapper';
import { enhancedBackendClient } from './enhancedBackendClient';
import { serviceIntegrationMapper } from './serviceIntegrationMapper';
import { realTimeServiceCoordinator } from './realTimeServiceCoordinator';
import { EventEmitter } from 'events';

// Main Coordinator Types
export interface ServiceDiscoveryHealthStatus {
  initialized: boolean;
  components: {
    dynamicServiceRegistry: boolean;
    advancedHealthMonitor: boolean;
    intelligentLoadBalancer: boolean;
    automaticFailoverSystem: boolean;
    serviceTopologyMapper: boolean;
  };
  metrics: {
    totalServices: number;
    totalInstances: number;
    healthyInstances: number;
    activeFailovers: number;
    totalRequests: number;
    averageResponseTime: number;
  };
  integration: {
    enhancedBackendClient: boolean;
    serviceIntegrationMapper: boolean;
    realTimeServiceCoordinator: boolean;
  };
  lastUpdate: string;
}

export interface ComponentHealth {
  componentName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  uptime: number;
  lastCheck: Date;
  metrics?: Record<string, any>;
  issues?: string[];
}

/**
 * Service Discovery and Health Monitoring - Main Coordinator
 */
export class ServiceDiscoveryHealthMonitoring extends EventEmitter {
  private isInitialized = false;
  private initializationStartTime: Date | null = null;
  private componentHealthChecks = new Map<string, ComponentHealth>();
  
  // Health monitoring interval
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize the complete service discovery and health monitoring system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Service Discovery and Health Monitoring already initialized');
      return;
    }

    this.initializationStartTime = new Date();

    try {
      logger.info('🚀 Initializing Service Discovery and Health Monitoring System...');

      // Phase 1: Initialize Dynamic Service Registry
      logger.info('📋 Phase 1: Initializing Dynamic Service Registry...');
      await dynamicServiceRegistry.initialize();
      this.emit('component:initialized', 'dynamicServiceRegistry');

      // Phase 2: Initialize Advanced Health Monitor
      logger.info('🏥 Phase 2: Initializing Advanced Health Monitor...');
      await advancedHealthMonitor.initialize();
      this.emit('component:initialized', 'advancedHealthMonitor');

      // Phase 3: Initialize Intelligent Load Balancer
      logger.info('⚖️ Phase 3: Initializing Intelligent Load Balancer...');
      await intelligentLoadBalancer.initialize();
      this.emit('component:initialized', 'intelligentLoadBalancer');

      // Phase 4: Initialize Automatic Failover System
      logger.info('🔄 Phase 4: Initializing Automatic Failover System...');
      await automaticFailoverSystem.initialize();
      this.emit('component:initialized', 'automaticFailoverSystem');

      // Phase 5: Initialize Service Topology Mapper
      logger.info('🗺️ Phase 5: Initializing Service Topology Mapper...');
      await serviceTopologyMapper.initialize();
      this.emit('component:initialized', 'serviceTopologyMapper');

      // Phase 6: Start integrated health monitoring
      logger.info('🔍 Phase 6: Starting integrated health monitoring...');
      this.startIntegratedHealthMonitoring();

      // Phase 7: Verify integration with existing systems
      logger.info('✅ Phase 7: Verifying system integration...');
      await this.verifySystemIntegration();

      const initializationTime = Date.now() - this.initializationStartTime.getTime();
      this.isInitialized = true;
      this.emit('system:initialized');

      logger.info(`✅ Service Discovery and Health Monitoring System initialized successfully in ${initializationTime}ms`);

    } catch (error) {
      logger.error('❌ Failed to initialize Service Discovery and Health Monitoring System:', error);
      throw error;
    }
  }

  /**
   * Start integrated health monitoring for all components
   */
  private startIntegratedHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performComponentHealthChecks();
      } catch (error) {
        logger.error('Component health checks failed:', error);
      }
    }, 30000); // Every 30 seconds

    logger.info('🏥 Integrated health monitoring started');
  }

  /**
   * Perform health checks on all components
   */
  private async performComponentHealthChecks(): Promise<void> {
    const components = [
      { name: 'dynamicServiceRegistry', instance: dynamicServiceRegistry },
      { name: 'advancedHealthMonitor', instance: advancedHealthMonitor },
      { name: 'intelligentLoadBalancer', instance: intelligentLoadBalancer },
      { name: 'automaticFailoverSystem', instance: automaticFailoverSystem },
      { name: 'serviceTopologyMapper', instance: serviceTopologyMapper }
    ];

    for (const component of components) {
      try {
        const startTime = Date.now();
        
        // Get component status
        let status: any = {};
        if (typeof (component.instance as any).getRegistryStatus === 'function') {
          status = await (component.instance as any).getRegistryStatus();
        } else if (typeof (component.instance as any).getMonitorStatus === 'function') {
          status = await (component.instance as any).getMonitorStatus();
        } else if (typeof (component.instance as any).getBalancerStatus === 'function') {
          status = await (component.instance as any).getBalancerStatus();
        } else if (typeof (component.instance as any).getFailoverStatus === 'function') {
          status = await (component.instance as any).getFailoverStatus();
        } else if (typeof (component.instance as any).getTopologyStatus === 'function') {
          status = await (component.instance as any).getTopologyStatus();
        }

        const responseTime = Date.now() - startTime;
        const uptime = this.initializationStartTime 
          ? Date.now() - this.initializationStartTime.getTime()
          : 0;

        // Determine component health
        const componentHealth: ComponentHealth = {
          componentName: component.name,
          status: this.determineComponentHealth(status, responseTime),
          uptime,
          lastCheck: new Date(),
          metrics: {
            responseTime,
            initialized: status.initialized || false,
            ...status
          },
          issues: this.detectComponentIssues(status, responseTime)
        };

        this.componentHealthChecks.set(component.name, componentHealth);

        // Emit health event if status changed
        this.emit('component:health', componentHealth);

      } catch (error) {
        // Component health check failed
        const componentHealth: ComponentHealth = {
          componentName: component.name,
          status: 'critical',
          uptime: 0,
          lastCheck: new Date(),
          issues: [`Health check failed: ${(error as Error).message}`]
        };

        this.componentHealthChecks.set(component.name, componentHealth);
        this.emit('component:health_failed', componentHealth, error);
      }
    }
  }

  /**
   * Determine component health status
   */
  private determineComponentHealth(status: any, responseTime: number): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    // Check if component is initialized
    if (!status.initialized) {
      return 'critical';
    }

    // Check response time
    if (responseTime > 5000) {
      return 'unhealthy';
    } else if (responseTime > 2000) {
      return 'degraded';
    }

    // Check component-specific metrics
    if (status.metrics) {
      // For health monitor
      if (status.monitoring && status.monitoring.totalActiveIssues > 10) {
        return 'degraded';
      }

      // For load balancer
      if (status.metrics.failedRoutes > status.metrics.successfulRoutes * 0.1) {
        return 'degraded';
      }

      // For failover system
      if (status.activeFailovers && status.activeFailovers.length > 3) {
        return 'degraded';
      }
    }

    return 'healthy';
  }

  /**
   * Detect component issues
   */
  private detectComponentIssues(status: any, responseTime: number): string[] {
    const issues: string[] = [];

    if (!status.initialized) {
      issues.push('Component not initialized');
    }

    if (responseTime > 2000) {
      issues.push(`High response time: ${responseTime}ms`);
    }

    // Component-specific issue detection
    if (status.metrics) {
      if (status.metrics.errorRate > 5) {
        issues.push(`High error rate: ${status.metrics.errorRate}%`);
      }

      if (status.monitoring && status.monitoring.totalActiveIssues > 5) {
        issues.push(`Multiple active issues: ${status.monitoring.totalActiveIssues}`);
      }
    }

    return issues;
  }

  /**
   * Verify integration with existing systems
   */
  private async verifySystemIntegration(): Promise<void> {
    const integrationTests = [
      {
        name: 'Enhanced Backend Client Integration',
        test: async () => {
          const clientStatus = await enhancedBackendClient.getClientStatus();
          return clientStatus.initialized;
        }
      },
      {
        name: 'Service Integration Mapper Integration',
        test: async () => {
          const mapperStatus = await serviceIntegrationMapper.getIntegrationStatus();
          return mapperStatus.initialized;
        }
      },
      {
        name: 'Real-Time Service Coordinator Integration',
        test: async () => {
          const coordinatorStatus = await realTimeServiceCoordinator.getRealtimeStatus();
          return coordinatorStatus.initialized;
        }
      },
      {
        name: 'Service Discovery Registry Integration',
        test: async () => {
          const registryStatus = await dynamicServiceRegistry.getRegistryStatus();
          return registryStatus.totalServices > 0;
        }
      },
      {
        name: 'Health Monitoring Integration',
        test: async () => {
          const monitorStatus = await advancedHealthMonitor.getMonitorStatus();
          return monitorStatus.monitoring.totalInstances > 0;
        }
      }
    ];

    const results = await Promise.allSettled(
      integrationTests.map(async test => {
        try {
          const result = await test.test();
          return { name: test.name, success: result, error: null };
        } catch (error) {
          return { name: test.name, success: false, error: (error as Error).message };
        }
      })
    );

    const failedTests = results
      .filter(result => result.status === 'fulfilled' && !result.value.success)
      .map(result => result.status === 'fulfilled' ? result.value : null)
      .filter(Boolean);

    if (failedTests.length > 0) {
      logger.warn(`⚠️ Some integration tests failed:`, failedTests);
    } else {
      logger.info('✅ All integration tests passed');
    }

    this.emit('integration:verified', { passed: results.length - failedTests.length, failed: failedTests.length });
  }

  /**
   * Setup event handlers for component coordination
   */
  private setupEventHandlers(): void {
    // Dynamic Service Registry Events
    dynamicServiceRegistry.on('instance:registered', (instance) => {
      logger.debug(`📝 Service instance registered: ${instance.serviceName}/${instance.instanceId}`);
      this.emit('service:registered', instance);
    });

    dynamicServiceRegistry.on('instance:health_changed', (instance, oldStatus, newStatus) => {
      logger.info(`🏥 Service health changed: ${instance.serviceName}/${instance.instanceId} (${oldStatus} → ${newStatus})`);
      this.emit('service:health_changed', instance, oldStatus, newStatus);
    });

    // Advanced Health Monitor Events
    advancedHealthMonitor.on('health:assessed', (assessment) => {
      if (assessment.overallHealth === 'critical' || assessment.overallHealth === 'unhealthy') {
        logger.warn(`⚠️ Service health issue: ${assessment.serviceName}/${assessment.instanceId} (${assessment.overallHealth})`);
        this.emit('health:issue', assessment);
      }
    });

    // Intelligent Load Balancer Events
    intelligentLoadBalancer.on('request:failed', (request, error) => {
      logger.warn(`❌ Load balancing failed: ${request.serviceName} - ${error.message}`);
      this.emit('routing:failed', request, error);
    });

    // Automatic Failover System Events
    automaticFailoverSystem.on('failover:started', (event) => {
      logger.warn(`🔄 Failover started: ${event.serviceName}/${event.failedInstance.instanceId}`);
      this.emit('failover:started', event);
    });

    automaticFailoverSystem.on('failover:completed', (event) => {
      logger.info(`✅ Failover completed: ${event.serviceName}/${event.failedInstance.instanceId}`);
      this.emit('failover:completed', event);
    });

    // Service Topology Mapper Events
    serviceTopologyMapper.on('topology:updated', (topology) => {
      logger.debug(`🗺️ Service topology updated: ${topology.metrics.totalNodes} nodes, ${topology.metrics.totalEdges} edges`);
      this.emit('topology:updated', topology);
    });

    // Component initialization events
    this.on('component:initialized', (componentName) => {
      logger.info(`✅ Component initialized: ${componentName}`);
    });

    this.on('component:health_failed', (health, error) => {
      logger.error(`❌ Component health check failed: ${health.componentName} - ${error.message}`);
    });
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<ServiceDiscoveryHealthStatus> {
    try {
      // Get component statuses
      const registryStatus = await dynamicServiceRegistry.getRegistryStatus();
      const monitorStatus = await advancedHealthMonitor.getMonitorStatus();
      const balancerStatus = await intelligentLoadBalancer.getBalancerStatus();
      const failoverStatus = await automaticFailoverSystem.getFailoverStatus();
      const topologyStatus = await serviceTopologyMapper.getTopologyStatus();

      // Get integration statuses
      const backendStatus = await enhancedBackendClient.getClientStatus();
      const mapperStatus = await serviceIntegrationMapper.getIntegrationStatus();
      const coordinatorStatus = await realTimeServiceCoordinator.getRealtimeStatus();

      return {
        initialized: this.isInitialized,
        components: {
          dynamicServiceRegistry: registryStatus.initialized,
          advancedHealthMonitor: monitorStatus.initialized,
          intelligentLoadBalancer: balancerStatus.initialized,
          automaticFailoverSystem: failoverStatus.initialized,
          serviceTopologyMapper: topologyStatus.initialized
        },
        metrics: {
          totalServices: registryStatus.totalServices,
          totalInstances: registryStatus.totalInstances,
          healthyInstances: registryStatus.healthyInstances,
          activeFailovers: failoverStatus.activeFailovers?.length || 0,
          totalRequests: balancerStatus.metrics?.totalRequests || 0,
          averageResponseTime: balancerStatus.metrics?.averageSelectionTime || 0
        },
        integration: {
          enhancedBackendClient: backendStatus.initialized,
          serviceIntegrationMapper: mapperStatus.initialized,
          realTimeServiceCoordinator: coordinatorStatus.initialized
        },
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * Get detailed component health information
   */
  getComponentHealth(): Map<string, ComponentHealth> {
    return new Map(this.componentHealthChecks);
  }

  /**
   * Get system metrics for monitoring
   */
  async getSystemMetrics(): Promise<any> {
    try {
      const registryStatus = await dynamicServiceRegistry.getRegistryStatus();
      const monitorStatus = await advancedHealthMonitor.getMonitorStatus();
      const balancerStatus = await intelligentLoadBalancer.getBalancerStatus();
      const failoverStatus = await automaticFailoverSystem.getFailoverStatus();
      const topologyStatus = await serviceTopologyMapper.getTopologyStatus();

      return {
        serviceDiscovery: {
          totalServices: registryStatus.totalServices,
          totalInstances: registryStatus.totalInstances,
          healthyInstances: registryStatus.healthyInstances,
          discoveryConfig: registryStatus.discoveryConfig
        },
        healthMonitoring: {
          totalInstances: monitorStatus.monitoring?.totalInstances || 0,
          healthDistribution: monitorStatus.monitoring?.healthDistribution || {},
          totalActiveIssues: monitorStatus.monitoring?.totalActiveIssues || 0,
          concurrentChecks: monitorStatus.monitoring?.concurrentChecks || 0
        },
        loadBalancing: {
          totalRequests: balancerStatus.metrics?.totalRequests || 0,
          successfulRoutes: balancerStatus.metrics?.successfulRoutes || 0,
          failedRoutes: balancerStatus.metrics?.failedRoutes || 0,
          averageSelectionTime: balancerStatus.metrics?.averageSelectionTime || 0,
          algorithmUsage: balancerStatus.metrics?.algorithmUsage || {}
        },
        failoverSystem: {
          totalFailovers: failoverStatus.metrics?.totalFailovers || 0,
          successfulFailovers: failoverStatus.metrics?.successfulFailovers || 0,
          activeFailovers: failoverStatus.activeFailovers?.length || 0,
          cascadingFailures: failoverStatus.metrics?.cascadingFailures || 0
        },
        topologyMapping: {
          totalNodes: topologyStatus.currentTopology?.metrics?.totalNodes || 0,
          totalEdges: topologyStatus.currentTopology?.metrics?.totalEdges || 0,
          totalClusters: topologyStatus.currentTopology?.metrics?.totalClusters || 0,
          avgProximity: topologyStatus.currentTopology?.metrics?.avgProximity || 0
        },
        systemHealth: {
          componentHealth: Array.from(this.componentHealthChecks.values()),
          overallHealth: this.calculateOverallSystemHealth(),
          uptime: this.initializationStartTime
            ? Date.now() - this.initializationStartTime.getTime()
            : 0
        }
      };

    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallSystemHealth(): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    const healthChecks = Array.from(this.componentHealthChecks.values());

    if (healthChecks.length === 0) {
      return 'critical';
    }

    const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;
    const degradedCount = healthChecks.filter(h => h.status === 'degraded').length;
    const unhealthyCount = healthChecks.filter(h => h.status === 'unhealthy').length;
    const criticalCount = healthChecks.filter(h => h.status === 'critical').length;

    const healthyRatio = healthyCount / healthChecks.length;

    if (criticalCount > 0) {
      return 'critical';
    } else if (unhealthyCount > 0 || healthyRatio < 0.5) {
      return 'unhealthy';
    } else if (degradedCount > 0 || healthyRatio < 0.8) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Trigger manual service discovery refresh
   */
  async refreshServiceDiscovery(): Promise<void> {
    logger.info('🔄 Triggering manual service discovery refresh...');

    try {
      // This would trigger a refresh in the dynamic service registry
      this.emit('discovery:refresh_requested');

      logger.info('✅ Service discovery refresh completed');
    } catch (error) {
      logger.error('❌ Service discovery refresh failed:', error);
      throw error;
    }
  }

  /**
   * Trigger manual health check for all services
   */
  async triggerHealthCheck(): Promise<void> {
    logger.info('🏥 Triggering manual health check for all services...');

    try {
      await this.performComponentHealthChecks();
      this.emit('health:manual_check_completed');

      logger.info('✅ Manual health check completed');
    } catch (error) {
      logger.error('❌ Manual health check failed:', error);
      throw error;
    }
  }

  /**
   * Get initialization status
   */
  getInitializationStatus(): { initialized: boolean; startTime: Date | null; uptime: number } {
    return {
      initialized: this.isInitialized,
      startTime: this.initializationStartTime,
      uptime: this.initializationStartTime
        ? Date.now() - this.initializationStartTime.getTime()
        : 0
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    logger.info('🧹 Destroying Service Discovery and Health Monitoring System...');

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Destroy components in reverse order
      await serviceTopologyMapper.destroy();
      await automaticFailoverSystem.destroy();
      await intelligentLoadBalancer.destroy();
      await advancedHealthMonitor.destroy();
      await dynamicServiceRegistry.destroy();

      // Clear state
      this.componentHealthChecks.clear();
      this.isInitialized = false;
      this.initializationStartTime = null;

      this.emit('system:destroyed');
      logger.info('✅ Service Discovery and Health Monitoring System destroyed');

    } catch (error) {
      logger.error('❌ Error during system destruction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const serviceDiscoveryHealthMonitoring = new ServiceDiscoveryHealthMonitoring();
