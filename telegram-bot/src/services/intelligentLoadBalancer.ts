/**
 * Intelligent Load Balancer - Stage 24 Component 1.3
 * 
 * Advanced load balancing system with intelligent request routing based on service
 * capacity, load, network proximity, and real-time health metrics.
 * 
 * Key Features:
 * - Multiple load balancing algorithms (round-robin, weighted, least connections, proximity, adaptive)
 * - Real-time capacity and load monitoring
 * - Network proximity-aware routing
 * - Health-aware request distribution
 * - Dynamic weight adjustment based on performance
 * - Circuit breaker integration for failed instances
 * 
 * Integration Points:
 * - Dynamic Service Registry: Service instance discovery and selection
 * - Advanced Health Monitor: Health-aware routing decisions
 * - Enhanced Backend Client: Request routing and execution
 * - Real-Time Service Coordinator: Load balancing coordination
 * 
 * Research-Based Implementation:
 * - Adaptive load balancing algorithms from distributed systems research
 * - Network proximity optimization techniques
 * - Service capacity-aware routing patterns
 * - Real-time performance-based weight adjustment
 */

import { logger } from '../utils/logger';
import { dynamicServiceRegistry, ServiceInstance } from './dynamicServiceRegistry';
import { advancedHealthMonitor, HealthAssessment } from './advancedHealthMonitor';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Load Balancing Types
export enum LoadBalancingAlgorithm {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED = 'weighted',
  LEAST_CONNECTIONS = 'least_connections',
  PROXIMITY = 'proximity',
  ADAPTIVE = 'adaptive',
  HEALTH_AWARE = 'health_aware'
}

export interface LoadBalancingRequest {
  requestId: string;
  serviceName: string;
  method: string;
  endpoint: string;
  requiredCapabilities?: string[];
  preferredRegion?: string;
  preferredZone?: string;
  maxLatency?: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  userContext?: any;
}

export interface LoadBalancingResult {
  requestId: string;
  selectedInstance: ServiceInstance;
  algorithm: LoadBalancingAlgorithm;
  selectionReason: string;
  alternativeInstances: ServiceInstance[];
  routingMetrics: {
    selectionTime: number;
    totalCandidates: number;
    healthyCandidates: number;
    proximityScore: number;
    loadScore: number;
  };
}

export interface InstanceLoad {
  instanceId: string;
  serviceName: string;
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  cpuUsage: number;
  memoryUsage: number;
  loadScore: number; // 0-100, higher means more loaded
  lastUpdated: Date;
}

export interface LoadBalancerMetrics {
  totalRequests: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageSelectionTime: number;
  algorithmUsage: Record<LoadBalancingAlgorithm, number>;
  instanceUsage: Record<string, number>;
  routingErrors: number;
}

export interface LoadBalancerConfig {
  defaultAlgorithm: LoadBalancingAlgorithm;
  enableAdaptiveWeights: boolean;
  enableHealthAwareRouting: boolean;
  enableProximityRouting: boolean;
  maxSelectionTime: number;
  loadUpdateInterval: number;
  weightAdjustmentInterval: number;
  circuitBreakerIntegration: boolean;
  metricsRetentionPeriod: number;
}

/**
 * Intelligent Load Balancer - Main Implementation
 */
export class IntelligentLoadBalancer extends EventEmitter {
  private instanceLoads = new Map<string, InstanceLoad>();
  private roundRobinCounters = new Map<string, number>();
  private metrics: LoadBalancerMetrics;
  private config: LoadBalancerConfig;
  
  // Monitoring intervals
  private loadUpdateInterval: NodeJS.Timeout | null = null;
  private weightAdjustmentInterval: NodeJS.Timeout | null = null;
  private metricsCleanupInterval: NodeJS.Timeout | null = null;
  
  private isInitialized = false;

  constructor(config?: Partial<LoadBalancerConfig>) {
    super();
    
    this.config = {
      defaultAlgorithm: LoadBalancingAlgorithm.ADAPTIVE,
      enableAdaptiveWeights: true,
      enableHealthAwareRouting: true,
      enableProximityRouting: true,
      maxSelectionTime: 100, // 100ms
      loadUpdateInterval: 5000, // 5 seconds
      weightAdjustmentInterval: 30000, // 30 seconds
      circuitBreakerIntegration: true,
      metricsRetentionPeriod: 86400000, // 24 hours
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      averageSelectionTime: 0,
      algorithmUsage: {} as Record<LoadBalancingAlgorithm, number>,
      instanceUsage: {},
      routingErrors: 0
    };

    this.initializeAlgorithmUsage();
    this.setupEventHandlers();
  }

  /**
   * Initialize the intelligent load balancer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Intelligent Load Balancer already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Intelligent Load Balancer...');

      // Initialize instance load tracking
      await this.initializeInstanceLoads();

      // Start load monitoring
      this.startLoadMonitoring();

      // Start adaptive weight adjustment
      if (this.config.enableAdaptiveWeights) {
        this.startWeightAdjustment();
      }

      // Start metrics cleanup
      this.startMetricsCleanup();

      this.isInitialized = true;
      this.emit('balancer:initialized');

      logger.info('✅ Intelligent Load Balancer initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Intelligent Load Balancer:', error);
      throw error;
    }
  }

  /**
   * Route request to optimal service instance
   */
  async routeRequest(request: LoadBalancingRequest): Promise<LoadBalancingResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Get available service instances
      const discoverOptions: {
        capabilities?: string[];
        healthyOnly?: boolean;
        maxInstances?: number;
        preferredRegion?: string;
        loadBalancingStrategy?: string;
      } = {
        healthyOnly: this.config.enableHealthAwareRouting
      };

      if (request.requiredCapabilities) {
        discoverOptions.capabilities = request.requiredCapabilities;
      }

      if (request.preferredRegion) {
        discoverOptions.preferredRegion = request.preferredRegion;
      }

      const instances = await dynamicServiceRegistry.discoverServiceInstances(
        request.serviceName,
        discoverOptions
      );

      if (instances.length === 0) {
        throw new Error(`No available instances for service: ${request.serviceName}`);
      }

      // Select optimal algorithm based on request and service characteristics
      const algorithm = this.selectOptimalAlgorithm(request, instances);

      // Route using selected algorithm
      const selectedInstance = await this.routeWithAlgorithm(
        algorithm,
        request,
        instances
      );

      // Calculate routing metrics
      const selectionTime = Date.now() - startTime;
      const proximityScore = selectedInstance.network.proximity;
      const loadScore = this.instanceLoads.get(selectedInstance.instanceId)?.loadScore || 0;

      // Create result
      const result: LoadBalancingResult = {
        requestId: request.requestId,
        selectedInstance,
        algorithm,
        selectionReason: this.getSelectionReason(algorithm, selectedInstance),
        alternativeInstances: instances.filter(i => i.instanceId !== selectedInstance.instanceId),
        routingMetrics: {
          selectionTime,
          totalCandidates: instances.length,
          healthyCandidates: instances.filter(i => i.health.status === 'healthy').length,
          proximityScore,
          loadScore
        }
      };

      // Update metrics
      this.updateRoutingMetrics(result);
      this.metrics.successfulRoutes++;

      // Emit routing event
      this.emit('request:routed', result);

      return result;

    } catch (error) {
      this.metrics.failedRoutes++;
      this.metrics.routingErrors++;
      
      logger.error(`Load balancing failed for ${request.serviceName}:`, error);
      this.emit('request:failed', request, error);
      
      throw error;
    }
  }

  /**
   * Select optimal load balancing algorithm
   */
  private selectOptimalAlgorithm(
    request: LoadBalancingRequest,
    instances: ServiceInstance[]
  ): LoadBalancingAlgorithm {
    // Use request-specific algorithm if specified
    if (request.priority === 'critical') {
      return LoadBalancingAlgorithm.HEALTH_AWARE;
    }

    // Use proximity routing for latency-sensitive requests
    if (request.maxLatency && request.maxLatency < 100) {
      return LoadBalancingAlgorithm.PROXIMITY;
    }

    // Use adaptive routing for services with multiple instances
    if (instances.length > 3) {
      return LoadBalancingAlgorithm.ADAPTIVE;
    }

    // Use weighted routing for services with different capacities
    const hasVariedWeights = instances.some(i => i.metadata.weight !== instances[0]?.metadata.weight);
    if (hasVariedWeights) {
      return LoadBalancingAlgorithm.WEIGHTED;
    }

    // Default to configured algorithm
    return this.config.defaultAlgorithm;
  }

  /**
   * Route request using specified algorithm
   */
  private async routeWithAlgorithm(
    algorithm: LoadBalancingAlgorithm,
    request: LoadBalancingRequest,
    instances: ServiceInstance[]
  ): Promise<ServiceInstance> {
    this.metrics.algorithmUsage[algorithm]++;

    switch (algorithm) {
      case LoadBalancingAlgorithm.ROUND_ROBIN:
        return this.routeRoundRobin(request.serviceName, instances);
      
      case LoadBalancingAlgorithm.WEIGHTED:
        return this.routeWeighted(instances);
      
      case LoadBalancingAlgorithm.LEAST_CONNECTIONS:
        return this.routeLeastConnections(instances);
      
      case LoadBalancingAlgorithm.PROXIMITY:
        return this.routeProximity(instances);
      
      case LoadBalancingAlgorithm.HEALTH_AWARE:
        return this.routeHealthAware(instances);
      
      case LoadBalancingAlgorithm.ADAPTIVE:
        return this.routeAdaptive(request, instances);
      
      default:
        return instances[0]!;
    }
  }

  /**
   * Round-robin load balancing
   */
  private routeRoundRobin(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const selectedIndex = counter % instances.length;
    
    this.roundRobinCounters.set(serviceName, counter + 1);
    
    return instances[selectedIndex]!;
  }

  /**
   * Weighted load balancing
   */
  private routeWeighted(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.metadata.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const instance of instances) {
      currentWeight += instance.metadata.weight;
      if (random <= currentWeight) {
        return instance;
      }
    }
    
    return instances[instances.length - 1]!;
  }

  /**
   * Least connections load balancing
   */
  private routeLeastConnections(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((best, current) => {
      const bestLoad = this.instanceLoads.get(best.instanceId);
      const currentLoad = this.instanceLoads.get(current.instanceId);
      
      const bestConnections = bestLoad?.activeConnections || 0;
      const currentConnections = currentLoad?.activeConnections || 0;
      
      return currentConnections < bestConnections ? current : best;
    });
  }

  /**
   * Proximity-based load balancing
   */
  private routeProximity(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((best, current) => {
      return current.network.proximity > best.network.proximity ? current : best;
    });
  }

  /**
   * Health-aware load balancing
   */
  private async routeHealthAware(instances: ServiceInstance[]): Promise<ServiceInstance> {
    // Get health assessments for all instances
    const healthyInstances: Array<{ instance: ServiceInstance; health: HealthAssessment | null }> = [];
    
    for (const instance of instances) {
      const health = await advancedHealthMonitor.getInstanceHealth(instance.instanceId);
      if (!health || health.overallHealth === 'healthy' || health.overallHealth === 'degraded') {
        healthyInstances.push({ instance, health });
      }
    }
    
    if (healthyInstances.length === 0) {
      // Fallback to any available instance
      return instances[0]!;
    }
    
    // Select instance with best health score
    return healthyInstances.reduce((best, current) => {
      const bestScore = best.health?.healthScore || 0;
      const currentScore = current.health?.healthScore || 0;
      return currentScore > bestScore ? current : best;
    }).instance;
  }

  /**
   * Adaptive load balancing combining multiple factors
   */
  private async routeAdaptive(
    request: LoadBalancingRequest,
    instances: ServiceInstance[]
  ): Promise<ServiceInstance> {
    const scoredInstances = await Promise.all(
      instances.map(async (instance) => {
        const score = await this.calculateAdaptiveScore(instance, request);
        return { instance, score };
      })
    );
    
    // Sort by score (highest first)
    scoredInstances.sort((a, b) => b.score - a.score);
    
    return scoredInstances[0]!.instance;
  }

  /**
   * Calculate adaptive score for an instance
   */
  private async calculateAdaptiveScore(
    instance: ServiceInstance,
    request: LoadBalancingRequest
  ): Promise<number> {
    let score = 0;
    
    // Health factor (30%)
    const health = await advancedHealthMonitor.getInstanceHealth(instance.instanceId);
    const healthScore = health?.healthScore || 50;
    score += healthScore * 0.3;
    
    // Load factor (25%)
    const load = this.instanceLoads.get(instance.instanceId);
    const loadScore = load ? Math.max(0, 100 - load.loadScore) : 50;
    score += loadScore * 0.25;
    
    // Proximity factor (20%)
    score += instance.network.proximity * 0.2;
    
    // Weight factor (15%)
    score += (instance.metadata.weight / 100) * 0.15;
    
    // Priority factor (10%)
    const priorityBonus = request.priority === 'critical' ? 20 : 
                         request.priority === 'high' ? 10 : 0;
    score += priorityBonus * 0.1;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Initialize instance load tracking
   */
  private async initializeInstanceLoads(): Promise<void> {
    const registryStatus = await dynamicServiceRegistry.getRegistryStatus();

    for (const serviceInfo of registryStatus.services) {
      const instances = await dynamicServiceRegistry.discoverServiceInstances(
        serviceInfo.serviceName,
        { healthyOnly: false }
      );

      for (const instance of instances) {
        this.instanceLoads.set(instance.instanceId, {
          instanceId: instance.instanceId,
          serviceName: instance.serviceName,
          activeConnections: 0,
          requestsPerSecond: 0,
          averageResponseTime: instance.health.responseTime,
          cpuUsage: 0,
          memoryUsage: 0,
          loadScore: 0,
          lastUpdated: new Date()
        });
      }
    }

    logger.info(`📊 Initialized load tracking for ${this.instanceLoads.size} service instances`);
  }

  /**
   * Start load monitoring
   */
  private startLoadMonitoring(): void {
    this.loadUpdateInterval = setInterval(async () => {
      try {
        await this.updateInstanceLoads();
      } catch (error) {
        logger.error('Load monitoring update failed:', error);
      }
    }, this.config.loadUpdateInterval);

    logger.info('📈 Load monitoring started');
  }

  /**
   * Update instance loads from health monitor and service registry
   */
  private async updateInstanceLoads(): Promise<void> {
    for (const [instanceId, currentLoad] of this.instanceLoads.entries()) {
      try {
        // Get latest health assessment
        const health = await advancedHealthMonitor.getInstanceHealth(instanceId);

        if (health) {
          // Update load metrics from health data
          const updatedLoad: InstanceLoad = {
            ...currentLoad,
            averageResponseTime: health.metrics.performance.responseTime,
            cpuUsage: health.metrics.saturation.cpuUsage,
            memoryUsage: health.metrics.saturation.memoryUsage,
            requestsPerSecond: health.metrics.traffic.requestsPerSecond,
            activeConnections: health.metrics.traffic.connectionsActive,
            loadScore: this.calculateLoadScore(health.metrics),
            lastUpdated: new Date()
          };

          this.instanceLoads.set(instanceId, updatedLoad);
        }

      } catch (error) {
        logger.debug(`Failed to update load for instance ${instanceId}:`, error);
      }
    }
  }

  /**
   * Calculate load score from health metrics
   */
  private calculateLoadScore(metrics: any): number {
    let loadScore = 0;

    // CPU usage factor (40%)
    loadScore += metrics.saturation.cpuUsage * 0.4;

    // Memory usage factor (30%)
    loadScore += metrics.saturation.memoryUsage * 0.3;

    // Response time factor (20%)
    const responseTimeScore = Math.min(100, (metrics.performance.responseTime / 10));
    loadScore += responseTimeScore * 0.2;

    // Queue depth factor (10%)
    const queueScore = Math.min(100, metrics.saturation.queueDepth);
    loadScore += queueScore * 0.1;

    return Math.max(0, Math.min(100, loadScore));
  }

  /**
   * Start adaptive weight adjustment
   */
  private startWeightAdjustment(): void {
    this.weightAdjustmentInterval = setInterval(async () => {
      try {
        await this.adjustInstanceWeights();
      } catch (error) {
        logger.error('Weight adjustment failed:', error);
      }
    }, this.config.weightAdjustmentInterval);

    logger.info('⚖️ Adaptive weight adjustment started');
  }

  /**
   * Adjust instance weights based on performance
   */
  private async adjustInstanceWeights(): Promise<void> {
    const registryStatus = await dynamicServiceRegistry.getRegistryStatus();

    for (const serviceInfo of registryStatus.services) {
      const instances = await dynamicServiceRegistry.discoverServiceInstances(
        serviceInfo.serviceName,
        { healthyOnly: false }
      );

      if (instances.length <= 1) continue;

      // Calculate average performance metrics
      const loads = instances.map(i => this.instanceLoads.get(i.instanceId)).filter(Boolean);
      if (loads.length === 0) continue;

      const avgResponseTime = loads.reduce((sum, load) => sum + load!.averageResponseTime, 0) / loads.length;
      const avgLoadScore = loads.reduce((sum, load) => sum + load!.loadScore, 0) / loads.length;

      // Adjust weights based on performance relative to average
      for (const instance of instances) {
        const load = this.instanceLoads.get(instance.instanceId);
        if (!load) continue;

        let weightMultiplier = 1.0;

        // Better than average performance gets higher weight
        if (load.averageResponseTime < avgResponseTime * 0.8) {
          weightMultiplier += 0.2;
        }
        if (load.loadScore < avgLoadScore * 0.8) {
          weightMultiplier += 0.2;
        }

        // Worse than average performance gets lower weight
        if (load.averageResponseTime > avgResponseTime * 1.2) {
          weightMultiplier -= 0.2;
        }
        if (load.loadScore > avgLoadScore * 1.2) {
          weightMultiplier -= 0.2;
        }

        // Apply weight adjustment (keep within reasonable bounds)
        const newWeight = Math.max(10, Math.min(200, instance.metadata.weight * weightMultiplier));
        if (Math.abs(newWeight - instance.metadata.weight) > 5) {
          instance.metadata.weight = Math.round(newWeight);

          this.emit('weight:adjusted', {
            instanceId: instance.instanceId,
            serviceName: instance.serviceName,
            oldWeight: instance.metadata.weight,
            newWeight,
            reason: 'performance-based adjustment'
          });
        }
      }
    }
  }

  /**
   * Update routing metrics
   */
  private updateRoutingMetrics(result: LoadBalancingResult): void {
    // Update algorithm usage
    this.metrics.algorithmUsage[result.algorithm]++;

    // Update instance usage
    const instanceKey = `${result.selectedInstance.serviceName}/${result.selectedInstance.instanceId}`;
    this.metrics.instanceUsage[instanceKey] = (this.metrics.instanceUsage[instanceKey] || 0) + 1;

    // Update average selection time
    const totalTime = this.metrics.averageSelectionTime * (this.metrics.totalRequests - 1);
    this.metrics.averageSelectionTime = (totalTime + result.routingMetrics.selectionTime) / this.metrics.totalRequests;
  }

  /**
   * Get selection reason for logging and debugging
   */
  private getSelectionReason(algorithm: LoadBalancingAlgorithm, instance: ServiceInstance): string {
    switch (algorithm) {
      case LoadBalancingAlgorithm.ROUND_ROBIN:
        return 'Selected by round-robin rotation';
      case LoadBalancingAlgorithm.WEIGHTED:
        return `Selected by weighted distribution (weight: ${instance.metadata.weight})`;
      case LoadBalancingAlgorithm.LEAST_CONNECTIONS:
        const load = this.instanceLoads.get(instance.instanceId);
        return `Selected for least connections (${load?.activeConnections || 0} active)`;
      case LoadBalancingAlgorithm.PROXIMITY:
        return `Selected for network proximity (score: ${instance.network.proximity})`;
      case LoadBalancingAlgorithm.HEALTH_AWARE:
        return 'Selected based on health assessment';
      case LoadBalancingAlgorithm.ADAPTIVE:
        return 'Selected by adaptive algorithm combining multiple factors';
      default:
        return 'Selected by default algorithm';
    }
  }

  /**
   * Initialize algorithm usage tracking
   */
  private initializeAlgorithmUsage(): void {
    for (const algorithm of Object.values(LoadBalancingAlgorithm)) {
      this.metrics.algorithmUsage[algorithm] = 0;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle service registry events
    dynamicServiceRegistry.on('instance:registered', (instance: ServiceInstance) => {
      this.instanceLoads.set(instance.instanceId, {
        instanceId: instance.instanceId,
        serviceName: instance.serviceName,
        activeConnections: 0,
        requestsPerSecond: 0,
        averageResponseTime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        loadScore: 0,
        lastUpdated: new Date()
      });

      logger.debug(`📊 Added load tracking for new instance: ${instance.serviceName}/${instance.instanceId}`);
    });

    dynamicServiceRegistry.on('instance:expired', (instance: ServiceInstance) => {
      this.instanceLoads.delete(instance.instanceId);
      this.roundRobinCounters.delete(instance.serviceName);

      logger.debug(`🧹 Removed load tracking for expired instance: ${instance.serviceName}/${instance.instanceId}`);
    });

    // Handle internal events
    this.on('request:routed', (result: LoadBalancingResult) => {
      logger.debug(`🎯 Request routed: ${result.requestId} → ${result.selectedInstance.serviceName}/${result.selectedInstance.instanceId} (${result.algorithm})`);
    });

    this.on('request:failed', (request: LoadBalancingRequest, error: Error) => {
      logger.warn(`❌ Routing failed for ${request.serviceName}: ${error.message}`);
    });
  }

  /**
   * Start metrics cleanup
   */
  private startMetricsCleanup(): void {
    this.metricsCleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // Every hour

    logger.info('🧹 Metrics cleanup started');
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    // Reset counters periodically to prevent overflow
    if (this.metrics.totalRequests > 1000000) {
      this.metrics.totalRequests = Math.floor(this.metrics.totalRequests / 2);
      this.metrics.successfulRoutes = Math.floor(this.metrics.successfulRoutes / 2);
      this.metrics.failedRoutes = Math.floor(this.metrics.failedRoutes / 2);

      // Reset algorithm usage
      for (const algorithm of Object.values(LoadBalancingAlgorithm)) {
        this.metrics.algorithmUsage[algorithm] = Math.floor(this.metrics.algorithmUsage[algorithm] / 2);
      }

      // Reset instance usage
      for (const instanceKey of Object.keys(this.metrics.instanceUsage)) {
        this.metrics.instanceUsage[instanceKey] = Math.floor((this.metrics.instanceUsage[instanceKey] || 0) / 2);
      }

      logger.info('🧹 Load balancer metrics reset to prevent overflow');
    }
  }

  /**
   * Get load balancer status and metrics
   */
  async getBalancerStatus(): Promise<any> {
    const totalInstances = this.instanceLoads.size;
    const activeInstances = Array.from(this.instanceLoads.values())
      .filter(load => Date.now() - load.lastUpdated.getTime() < 60000).length;

    return {
      initialized: this.isInitialized,
      config: this.config,
      metrics: this.metrics,
      instances: {
        total: totalInstances,
        active: activeInstances,
        loads: Array.from(this.instanceLoads.values())
      },
      algorithms: {
        default: this.config.defaultAlgorithm,
        usage: this.metrics.algorithmUsage
      },
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.loadUpdateInterval) {
      clearInterval(this.loadUpdateInterval);
      this.loadUpdateInterval = null;
    }

    if (this.weightAdjustmentInterval) {
      clearInterval(this.weightAdjustmentInterval);
      this.weightAdjustmentInterval = null;
    }

    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
      this.metricsCleanupInterval = null;
    }

    this.instanceLoads.clear();
    this.roundRobinCounters.clear();
    this.isInitialized = false;

    this.emit('balancer:destroyed');
    logger.info('🧹 Intelligent Load Balancer destroyed');
  }
}

// Export singleton instance
export const intelligentLoadBalancer = new IntelligentLoadBalancer();
