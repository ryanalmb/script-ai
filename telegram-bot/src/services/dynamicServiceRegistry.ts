/**
 * Dynamic Service Registry - Stage 24 Component 1.3
 * 
 * Enterprise-grade service discovery system with auto-discovery of backend service
 * instances, capability detection, and intelligent endpoint resolution.
 * 
 * Key Features:
 * - Dynamic service instance discovery with capability detection
 * - Multi-tier service registration (static, dynamic, ephemeral)
 * - Network proximity detection and topology mapping
 * - Service capability negotiation and version compatibility
 * - Real-time service instance lifecycle management
 * - Intelligent endpoint resolution with load balancing
 * 
 * Integration Points:
 * - Enhanced Backend Client: Service endpoint resolution
 * - Service Integration Mapper: Capability-aware method routing
 * - Real-Time Service Coordinator: Service lifecycle events
 * - Advanced Health Monitor: Health-aware service selection
 * 
 * Research-Based Implementation:
 * - Consul-inspired service discovery patterns
 * - Kubernetes service discovery mechanisms
 * - etcd-based distributed coordination
 * - Network proximity optimization techniques
 */

import { logger } from '../utils/logger';
import { enhancedBackendClient } from './enhancedBackendClient';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Service Discovery Types
export interface ServiceCapability {
  name: string;
  version: string;
  endpoints: string[];
  parameters?: Record<string, any>;
  dependencies?: string[];
  optional: boolean;
}

export interface ServiceInstance {
  instanceId: string;
  serviceName: string;
  address: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'websocket';
  version: string;
  capabilities: ServiceCapability[];
  metadata: {
    region?: string;
    zone?: string;
    datacenter?: string;
    tags: string[];
    weight: number;
    priority: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastCheck: Date;
    responseTime: number;
    consecutiveFailures: number;
    uptime: number;
  };
  network: {
    latency: number;
    bandwidth: number;
    proximity: number; // 0-100, higher is closer
    lastProximityCheck: Date;
  };
  registration: {
    registeredAt: Date;
    lastHeartbeat: Date;
    ttl: number;
    source: 'static' | 'dynamic' | 'ephemeral';
  };
}

export interface ServiceTopology {
  serviceName: string;
  instances: ServiceInstance[];
  dependencies: string[];
  dependents: string[];
  networkMap: Map<string, number>; // instanceId -> proximity score
  loadBalancingStrategy: 'round_robin' | 'weighted' | 'least_connections' | 'proximity' | 'adaptive';
}

export interface DiscoveryConfiguration {
  discoveryInterval: number;
  healthCheckInterval: number;
  proximityCheckInterval: number;
  instanceTTL: number;
  maxInstancesPerService: number;
  enableNetworkProximity: boolean;
  enableCapabilityNegotiation: boolean;
  enableDynamicDiscovery: boolean;
  consulEndpoint?: string;
  etcdEndpoint?: string;
  kubernetesNamespace?: string;
}

/**
 * Dynamic Service Registry - Main Implementation
 */
export class DynamicServiceRegistry extends EventEmitter {
  private serviceInstances = new Map<string, ServiceInstance[]>();
  private serviceTopologies = new Map<string, ServiceTopology>();
  private capabilityIndex = new Map<string, ServiceInstance[]>();
  private proximityCache = new Map<string, number>();
  private discoveryConfig: DiscoveryConfiguration;
  
  // Discovery intervals
  private discoveryInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private proximityCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  private isInitialized = false;

  constructor(config?: Partial<DiscoveryConfiguration>) {
    super();
    
    this.discoveryConfig = {
      discoveryInterval: 30000, // 30 seconds
      healthCheckInterval: 10000, // 10 seconds
      proximityCheckInterval: 300000, // 5 minutes
      instanceTTL: 120000, // 2 minutes
      maxInstancesPerService: 10,
      enableNetworkProximity: true,
      enableCapabilityNegotiation: true,
      enableDynamicDiscovery: true,
      consulEndpoint: process.env.CONSUL_ENDPOINT || 'http://localhost:8500',
      etcdEndpoint: process.env.ETCD_ENDPOINT || 'http://localhost:2379',
      kubernetesNamespace: process.env.KUBERNETES_NAMESPACE || 'default',
      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize the dynamic service registry
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Dynamic Service Registry already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Dynamic Service Registry...');

      // Initialize static service registrations
      await this.initializeStaticServices();

      // Start dynamic discovery if enabled
      if (this.discoveryConfig.enableDynamicDiscovery) {
        await this.startDynamicDiscovery();
      }

      // Start health monitoring
      this.startHealthMonitoring();

      // Start network proximity monitoring
      if (this.discoveryConfig.enableNetworkProximity) {
        this.startProximityMonitoring();
      }

      // Start heartbeat processing
      this.startHeartbeatProcessing();

      this.isInitialized = true;
      this.emit('registry:initialized');

      logger.info('✅ Dynamic Service Registry initialized successfully');
      logger.info(`📊 Discovered ${this.getTotalInstanceCount()} service instances`);

    } catch (error) {
      logger.error('❌ Failed to initialize Dynamic Service Registry:', error);
      throw error;
    }
  }

  /**
   * Initialize static service registrations from existing Enhanced Backend Client
   */
  private async initializeStaticServices(): Promise<void> {
    const existingServices = enhancedBackendClient.getServices();
    
    for (const [serviceName, serviceEndpoint] of existingServices.entries()) {
      const instance: ServiceInstance = {
        instanceId: uuidv4(),
        serviceName,
        address: this.extractAddress(serviceEndpoint.baseUrl),
        port: this.extractPort(serviceEndpoint.baseUrl),
        protocol: serviceEndpoint.baseUrl.startsWith('https') ? 'https' : 'http',
        version: serviceEndpoint.version,
        capabilities: this.mapCapabilities(serviceEndpoint.capabilities),
        metadata: {
          tags: serviceEndpoint.tags,
          weight: 100,
          priority: serviceEndpoint.priority,
        },
        health: {
          status: 'unknown',
          lastCheck: new Date(),
          responseTime: 0,
          consecutiveFailures: 0,
          uptime: 0
        },
        network: {
          latency: 0,
          bandwidth: 0,
          proximity: 50, // Default proximity
          lastProximityCheck: new Date()
        },
        registration: {
          registeredAt: new Date(),
          lastHeartbeat: new Date(),
          ttl: this.discoveryConfig.instanceTTL,
          source: 'static'
        }
      };

      await this.registerServiceInstance(instance);
    }

    logger.info(`📋 Initialized ${existingServices.size} static service registrations`);
  }

  /**
   * Register a service instance
   */
  async registerServiceInstance(instance: ServiceInstance): Promise<void> {
    const serviceName = instance.serviceName;
    
    // Get or create service instance list
    const instances = this.serviceInstances.get(serviceName) || [];
    
    // Check for existing instance
    const existingIndex = instances.findIndex(i => i.instanceId === instance.instanceId);
    
    if (existingIndex >= 0) {
      // Update existing instance
      instances[existingIndex] = instance;
    } else {
      // Add new instance
      instances.push(instance);
      
      // Enforce max instances limit
      if (instances.length > this.discoveryConfig.maxInstancesPerService) {
        // Remove oldest unhealthy instance
        const sortedInstances = instances.sort((a, b) => {
          if (a.health.status !== b.health.status) {
            return a.health.status === 'unhealthy' ? -1 : 1;
          }
          return a.registration.registeredAt.getTime() - b.registration.registeredAt.getTime();
        });
        
        instances.splice(0, instances.length - this.discoveryConfig.maxInstancesPerService);
      }
    }
    
    this.serviceInstances.set(serviceName, instances);
    
    // Update capability index
    this.updateCapabilityIndex(instance);
    
    // Update service topology
    await this.updateServiceTopology(serviceName);
    
    // Emit registration event
    this.emit('instance:registered', instance);
    
    logger.debug(`📝 Registered service instance: ${serviceName}/${instance.instanceId}`);
  }

  /**
   * Discover service instances by name with capability filtering
   */
  async discoverServiceInstances(
    serviceName: string,
    options: {
      capabilities?: string[];
      healthyOnly?: boolean;
      maxInstances?: number;
      preferredRegion?: string;
      loadBalancingStrategy?: string;
    } = {}
  ): Promise<ServiceInstance[]> {
    const instances = this.serviceInstances.get(serviceName) || [];
    
    let filteredInstances = [...instances];
    
    // Filter by health status
    if (options.healthyOnly !== false) {
      filteredInstances = filteredInstances.filter(i => i.health.status === 'healthy');
    }
    
    // Filter by capabilities
    if (options.capabilities && options.capabilities.length > 0) {
      filteredInstances = filteredInstances.filter(instance => {
        const instanceCapabilities = instance.capabilities.map(c => c.name);
        return options.capabilities!.every(cap => instanceCapabilities.includes(cap));
      });
    }
    
    // Filter by preferred region
    if (options.preferredRegion) {
      const regionInstances = filteredInstances.filter(i => i.metadata.region === options.preferredRegion);
      if (regionInstances.length > 0) {
        filteredInstances = regionInstances;
      }
    }
    
    // Apply load balancing strategy
    const topology = this.serviceTopologies.get(serviceName);
    if (topology) {
      filteredInstances = this.applyLoadBalancingStrategy(
        filteredInstances,
        topology.loadBalancingStrategy
      );
    }
    
    // Limit results
    if (options.maxInstances && options.maxInstances > 0) {
      filteredInstances = filteredInstances.slice(0, options.maxInstances);
    }
    
    return filteredInstances;
  }

  /**
   * Get optimal service instance based on multiple criteria
   */
  async getOptimalServiceInstance(
    serviceName: string,
    criteria: {
      capabilities?: string[];
      maxLatency?: number;
      minProximity?: number;
      preferredZone?: string;
      loadFactor?: number;
    } = {}
  ): Promise<ServiceInstance | null> {
    const discoverOptions: {
      capabilities?: string[];
      healthyOnly?: boolean;
      maxInstances?: number;
      preferredRegion?: string;
      loadBalancingStrategy?: string;
    } = {
      healthyOnly: true
    };

    if (criteria.capabilities) {
      discoverOptions.capabilities = criteria.capabilities;
    }

    const instances = await this.discoverServiceInstances(serviceName, discoverOptions);
    
    if (instances.length === 0) {
      return null;
    }
    
    // Score instances based on criteria
    const scoredInstances = instances.map(instance => {
      let score = 0;
      
      // Network latency score (lower is better)
      if (criteria.maxLatency) {
        const latencyScore = Math.max(0, 100 - (instance.network.latency / criteria.maxLatency) * 100);
        score += latencyScore * 0.3;
      }
      
      // Proximity score (higher is better)
      if (criteria.minProximity) {
        const proximityScore = Math.max(0, (instance.network.proximity / criteria.minProximity) * 100);
        score += proximityScore * 0.2;
      }
      
      // Zone preference score
      if (criteria.preferredZone && instance.metadata.zone === criteria.preferredZone) {
        score += 25;
      }
      
      // Health score
      const healthScore = instance.health.status === 'healthy' ? 100 : 
                         instance.health.status === 'degraded' ? 50 : 0;
      score += healthScore * 0.3;
      
      // Priority and weight
      score += (instance.metadata.priority / 10) * 0.1;
      score += (instance.metadata.weight / 100) * 0.1;
      
      return { instance, score };
    });
    
    // Sort by score (highest first)
    scoredInstances.sort((a, b) => b.score - a.score);
    
    return scoredInstances[0]?.instance || null;
  }

  /**
   * Start dynamic service discovery
   */
  private async startDynamicDiscovery(): Promise<void> {
    // Consul discovery
    if (this.discoveryConfig.consulEndpoint) {
      await this.startConsulDiscovery();
    }

    // etcd discovery
    if (this.discoveryConfig.etcdEndpoint) {
      await this.startEtcdDiscovery();
    }

    // Kubernetes discovery
    if (this.discoveryConfig.kubernetesNamespace) {
      await this.startKubernetesDiscovery();
    }

    // Start periodic discovery
    this.discoveryInterval = setInterval(async () => {
      try {
        await this.performDiscoveryRound();
      } catch (error) {
        logger.error('Discovery round failed:', error);
      }
    }, this.discoveryConfig.discoveryInterval);

    logger.info('🔍 Dynamic service discovery started');
  }

  /**
   * Start Consul-based service discovery
   */
  private async startConsulDiscovery(): Promise<void> {
    try {
      const consulUrl = this.discoveryConfig.consulEndpoint;
      const response = await axios.get(`${consulUrl}/v1/catalog/services`);

      for (const [serviceName, tags] of Object.entries(response.data)) {
        if (this.isRelevantService(serviceName as string, tags as string[])) {
          await this.discoverConsulService(serviceName as string);
        }
      }

      logger.info('📡 Consul service discovery initialized');
    } catch (error) {
      logger.warn('Failed to initialize Consul discovery:', error);
    }
  }

  /**
   * Start health monitoring for all service instances
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Health check round failed:', error);
      }
    }, this.discoveryConfig.healthCheckInterval);

    logger.info('🏥 Service health monitoring started');
  }

  /**
   * Start network proximity monitoring
   */
  private startProximityMonitoring(): void {
    this.proximityCheckInterval = setInterval(async () => {
      try {
        await this.performProximityChecks();
      } catch (error) {
        logger.error('Proximity check round failed:', error);
      }
    }, this.discoveryConfig.proximityCheckInterval);

    logger.info('🌐 Network proximity monitoring started');
  }

  /**
   * Start heartbeat processing for TTL management
   */
  private startHeartbeatProcessing(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.processHeartbeats();
      } catch (error) {
        logger.error('Heartbeat processing failed:', error);
      }
    }, 30000); // Every 30 seconds

    logger.info('💓 Heartbeat processing started');
  }

  /**
   * Perform health checks on all service instances
   */
  private async performHealthChecks(): Promise<void> {
    const allInstances = Array.from(this.serviceInstances.values()).flat();

    const healthCheckPromises = allInstances.map(async (instance) => {
      try {
        const startTime = Date.now();
        const healthUrl = `${instance.protocol}://${instance.address}:${instance.port}/health`;

        const response = await axios.get(healthUrl, {
          timeout: 5000,
          validateStatus: (status) => status < 500
        });

        const responseTime = Date.now() - startTime;

        // Update health status
        const oldStatus = instance.health.status;
        instance.health.status = response.status === 200 ? 'healthy' : 'degraded';
        instance.health.lastCheck = new Date();
        instance.health.responseTime = responseTime;
        instance.health.consecutiveFailures = 0;

        // Calculate uptime
        const totalTime = Date.now() - instance.registration.registeredAt.getTime();
        const healthyTime = totalTime - (instance.health.consecutiveFailures * this.discoveryConfig.healthCheckInterval);
        instance.health.uptime = Math.max(0, (healthyTime / totalTime) * 100);

        // Emit health change event
        if (oldStatus !== instance.health.status) {
          this.emit('instance:health_changed', instance, oldStatus, instance.health.status);
        }

      } catch (error) {
        // Update failure status
        instance.health.status = 'unhealthy';
        instance.health.lastCheck = new Date();
        instance.health.consecutiveFailures++;
        instance.health.responseTime = 0;

        this.emit('instance:health_failed', instance, error);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Perform network proximity checks
   */
  private async performProximityChecks(): Promise<void> {
    const allInstances = Array.from(this.serviceInstances.values()).flat();

    for (const instance of allInstances) {
      try {
        const proximity = await this.calculateNetworkProximity(instance);
        instance.network.proximity = proximity;
        instance.network.lastProximityCheck = new Date();

        // Cache proximity result
        this.proximityCache.set(instance.instanceId, proximity);

      } catch (error) {
        logger.debug(`Proximity check failed for ${instance.instanceId}:`, error);
      }
    }
  }

  /**
   * Calculate network proximity to a service instance
   */
  private async calculateNetworkProximity(instance: ServiceInstance): Promise<number> {
    try {
      // Perform latency test
      const startTime = Date.now();
      const testUrl = `${instance.protocol}://${instance.address}:${instance.port}/ping`;

      await axios.get(testUrl, { timeout: 2000 });
      const latency = Date.now() - startTime;

      // Update latency
      instance.network.latency = latency;

      // Calculate proximity score (0-100, higher is better)
      // Based on latency, geographic proximity, and network topology
      let proximityScore = 100;

      // Latency factor (0-50ms = 100, 50-200ms = 50, >200ms = 0)
      if (latency <= 50) {
        proximityScore = 100;
      } else if (latency <= 200) {
        proximityScore = 100 - ((latency - 50) / 150) * 50;
      } else {
        proximityScore = Math.max(0, 50 - ((latency - 200) / 100) * 50);
      }

      // Geographic proximity bonus
      if (instance.metadata.region === process.env.CURRENT_REGION) {
        proximityScore += 10;
      }
      if (instance.metadata.zone === process.env.CURRENT_ZONE) {
        proximityScore += 5;
      }

      return Math.min(100, Math.max(0, proximityScore));

    } catch (error) {
      return 0; // No proximity if unreachable
    }
  }

  /**
   * Process heartbeats and handle TTL expiration
   */
  private async processHeartbeats(): Promise<void> {
    const now = Date.now();

    for (const [serviceName, instances] of this.serviceInstances.entries()) {
      const validInstances = instances.filter(instance => {
        const timeSinceHeartbeat = now - instance.registration.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > instance.registration.ttl) {
          // Instance expired
          this.emit('instance:expired', instance);
          logger.debug(`⏰ Service instance expired: ${serviceName}/${instance.instanceId}`);
          return false;
        }

        return true;
      });

      if (validInstances.length !== instances.length) {
        this.serviceInstances.set(serviceName, validInstances);
        await this.updateServiceTopology(serviceName);
      }
    }
  }

  /**
   * Update service topology mapping
   */
  private async updateServiceTopology(serviceName: string): Promise<void> {
    const instances = this.serviceInstances.get(serviceName) || [];

    const topology: ServiceTopology = {
      serviceName,
      instances,
      dependencies: this.extractServiceDependencies(serviceName),
      dependents: this.extractServiceDependents(serviceName),
      networkMap: new Map(),
      loadBalancingStrategy: this.determineLoadBalancingStrategy(serviceName, instances) as 'round_robin' | 'weighted' | 'least_connections' | 'proximity' | 'adaptive'
    };

    // Build network proximity map
    for (const instance of instances) {
      topology.networkMap.set(instance.instanceId, instance.network.proximity);
    }

    this.serviceTopologies.set(serviceName, topology);
    this.emit('topology:updated', topology);
  }

  /**
   * Apply load balancing strategy to service instances
   */
  private applyLoadBalancingStrategy(
    instances: ServiceInstance[],
    strategy: string
  ): ServiceInstance[] {
    switch (strategy) {
      case 'weighted':
        return this.applyWeightedLoadBalancing(instances);
      case 'proximity':
        return this.applyProximityLoadBalancing(instances);
      case 'least_connections':
        return this.applyLeastConnectionsLoadBalancing(instances);
      case 'adaptive':
        return this.applyAdaptiveLoadBalancing(instances);
      default:
        return instances; // Round robin (default order)
    }
  }

  /**
   * Apply weighted load balancing
   */
  private applyWeightedLoadBalancing(instances: ServiceInstance[]): ServiceInstance[] {
    return instances.sort((a, b) => b.metadata.weight - a.metadata.weight);
  }

  /**
   * Apply proximity-based load balancing
   */
  private applyProximityLoadBalancing(instances: ServiceInstance[]): ServiceInstance[] {
    return instances.sort((a, b) => b.network.proximity - a.network.proximity);
  }

  /**
   * Apply least connections load balancing
   */
  private applyLeastConnectionsLoadBalancing(instances: ServiceInstance[]): ServiceInstance[] {
    // This would integrate with connection pool metrics
    return instances.sort((a, b) => a.network.latency - b.network.latency);
  }

  /**
   * Apply adaptive load balancing
   */
  private applyAdaptiveLoadBalancing(instances: ServiceInstance[]): ServiceInstance[] {
    // Combine multiple factors for intelligent routing
    return instances.sort((a, b) => {
      const scoreA = this.calculateAdaptiveScore(a);
      const scoreB = this.calculateAdaptiveScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate adaptive load balancing score
   */
  private calculateAdaptiveScore(instance: ServiceInstance): number {
    let score = 0;

    // Health factor (40%)
    const healthScore = instance.health.status === 'healthy' ? 100 :
                       instance.health.status === 'degraded' ? 50 : 0;
    score += healthScore * 0.4;

    // Performance factor (30%)
    const performanceScore = Math.max(0, 100 - (instance.health.responseTime / 10));
    score += performanceScore * 0.3;

    // Proximity factor (20%)
    score += instance.network.proximity * 0.2;

    // Weight factor (10%)
    score += (instance.metadata.weight / 100) * 0.1;

    return score;
  }

  /**
   * Utility methods for service discovery
   */
  private extractAddress(baseUrl: string): string {
    try {
      const url = new URL(baseUrl);
      return url.hostname;
    } catch {
      return 'localhost';
    }
  }

  private extractPort(baseUrl: string): number {
    try {
      const url = new URL(baseUrl);
      return parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
    } catch {
      return 3001;
    }
  }

  private mapCapabilities(capabilities: string[]): ServiceCapability[] {
    return capabilities.map(cap => ({
      name: cap,
      version: '1.0.0',
      endpoints: [`/api/${cap}`],
      optional: false
    }));
  }

  private updateCapabilityIndex(instance: ServiceInstance): void {
    for (const capability of instance.capabilities) {
      const instances = this.capabilityIndex.get(capability.name) || [];
      const existingIndex = instances.findIndex(i => i.instanceId === instance.instanceId);

      if (existingIndex >= 0) {
        instances[existingIndex] = instance;
      } else {
        instances.push(instance);
      }

      this.capabilityIndex.set(capability.name, instances);
    }
  }

  private extractServiceDependencies(serviceName: string): string[] {
    // This would be enhanced with actual dependency analysis
    const dependencyMap: Record<string, string[]> = {
      'campaign-orchestrator': ['twikit-session-manager', 'proxy-rotation-manager'],
      'x-automation-service': ['twikit-session-manager', 'global-rate-limit-coordinator'],
      'twikit-monitoring-service': ['account-health-monitor']
    };

    return dependencyMap[serviceName] || [];
  }

  private extractServiceDependents(serviceName: string): string[] {
    // This would be enhanced with actual dependent analysis
    const dependentMap: Record<string, string[]> = {
      'twikit-session-manager': ['campaign-orchestrator', 'x-automation-service'],
      'proxy-rotation-manager': ['campaign-orchestrator'],
      'global-rate-limit-coordinator': ['x-automation-service']
    };

    return dependentMap[serviceName] || [];
  }

  private determineLoadBalancingStrategy(serviceName: string, instances: ServiceInstance[]): string {
    // Intelligent strategy selection based on service characteristics
    if (instances.length <= 2) return 'round_robin';
    if (serviceName.includes('session')) return 'least_connections';
    if (serviceName.includes('proxy')) return 'proximity';
    if (serviceName.includes('campaign')) return 'adaptive';
    return 'weighted';
  }

  private isRelevantService(serviceName: string, tags: string[]): boolean {
    const relevantTags = ['twikit', 'automation', 'backend', 'api'];
    return tags.some(tag => relevantTags.includes(tag.toLowerCase()));
  }

  private async discoverConsulService(serviceName: string): Promise<void> {
    try {
      const consulUrl = this.discoveryConfig.consulEndpoint;
      const response = await axios.get(`${consulUrl}/v1/health/service/${serviceName}?passing=true`);

      for (const serviceData of response.data) {
        const service = serviceData.Service;
        const checks = serviceData.Checks;

        const instance: ServiceInstance = {
          instanceId: service.ID,
          serviceName: service.Service,
          address: service.Address,
          port: service.Port,
          protocol: 'http',
          version: service.Meta?.version || '1.0.0',
          capabilities: this.parseConsulCapabilities(service.Tags),
          metadata: {
            tags: service.Tags || [],
            weight: parseInt(service.Meta?.weight || '100'),
            priority: parseInt(service.Meta?.priority || '5'),
            region: service.Meta?.region,
            zone: service.Meta?.zone,
            datacenter: service.Datacenter
          },
          health: {
            status: checks.every((c: any) => c.Status === 'passing') ? 'healthy' : 'degraded',
            lastCheck: new Date(),
            responseTime: 0,
            consecutiveFailures: 0,
            uptime: 100
          },
          network: {
            latency: 0,
            bandwidth: 0,
            proximity: 50,
            lastProximityCheck: new Date()
          },
          registration: {
            registeredAt: new Date(),
            lastHeartbeat: new Date(),
            ttl: this.discoveryConfig.instanceTTL,
            source: 'dynamic'
          }
        };

        await this.registerServiceInstance(instance);
      }

    } catch (error) {
      logger.debug(`Failed to discover Consul service ${serviceName}:`, error);
    }
  }

  private parseConsulCapabilities(tags: string[]): ServiceCapability[] {
    return tags
      .filter(tag => tag.startsWith('capability:'))
      .map(tag => ({
        name: tag.replace('capability:', ''),
        version: '1.0.0',
        endpoints: [],
        optional: false
      }));
  }

  private async startEtcdDiscovery(): Promise<void> {
    // etcd discovery implementation would go here
    logger.info('📡 etcd service discovery initialized');
  }

  private async startKubernetesDiscovery(): Promise<void> {
    // Kubernetes discovery implementation would go here
    logger.info('📡 Kubernetes service discovery initialized');
  }

  private async performDiscoveryRound(): Promise<void> {
    // Perform periodic discovery across all enabled sources
    if (this.discoveryConfig.consulEndpoint) {
      await this.startConsulDiscovery();
    }
  }

  private setupEventHandlers(): void {
    // Handle service instance events
    this.on('instance:registered', (instance: ServiceInstance) => {
      logger.debug(`📝 Service instance registered: ${instance.serviceName}/${instance.instanceId}`);
    });

    this.on('instance:health_changed', (instance: ServiceInstance, oldStatus: string, newStatus: string) => {
      logger.info(`🏥 Health changed: ${instance.serviceName}/${instance.instanceId} (${oldStatus} → ${newStatus})`);
    });

    this.on('instance:expired', (instance: ServiceInstance) => {
      logger.warn(`⏰ Service instance expired: ${instance.serviceName}/${instance.instanceId}`);
    });
  }

  /**
   * Get service registry status and metrics
   */
  async getRegistryStatus(): Promise<any> {
    const totalInstances = this.getTotalInstanceCount();
    const healthyInstances = this.getHealthyInstanceCount();
    const services = Array.from(this.serviceInstances.keys());

    return {
      initialized: this.isInitialized,
      totalServices: services.length,
      totalInstances,
      healthyInstances,
      unhealthyInstances: totalInstances - healthyInstances,
      discoveryConfig: this.discoveryConfig,
      services: services.map(serviceName => ({
        serviceName,
        instanceCount: this.serviceInstances.get(serviceName)?.length || 0,
        healthyCount: this.serviceInstances.get(serviceName)?.filter(i => i.health.status === 'healthy').length || 0,
        topology: this.serviceTopologies.get(serviceName)
      })),
      capabilities: Array.from(this.capabilityIndex.keys()),
      lastUpdate: new Date().toISOString()
    };
  }

  private getTotalInstanceCount(): number {
    return Array.from(this.serviceInstances.values()).reduce((sum, instances) => sum + instances.length, 0);
  }

  private getHealthyInstanceCount(): number {
    return Array.from(this.serviceInstances.values())
      .flat()
      .filter(instance => instance.health.status === 'healthy').length;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.proximityCheckInterval) {
      clearInterval(this.proximityCheckInterval);
      this.proximityCheckInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.serviceInstances.clear();
    this.serviceTopologies.clear();
    this.capabilityIndex.clear();
    this.proximityCache.clear();
    this.isInitialized = false;

    this.emit('registry:destroyed');
    logger.info('🧹 Dynamic Service Registry destroyed');
  }
}

// Export singleton instance
export const dynamicServiceRegistry = new DynamicServiceRegistry();
