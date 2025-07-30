/**
 * Service Topology Mapper - Stage 24 Component 1.3
 * 
 * Real-time service topology mapping and visualization system with network
 * proximity detection, dependency analysis, and performance correlation.
 * 
 * Key Features:
 * - Real-time service topology mapping and visualization
 * - Network proximity detection and optimization
 * - Service dependency analysis and impact assessment
 * - Performance correlation across service boundaries
 * - Topology-aware routing recommendations
 * - Visual topology representation for monitoring
 * 
 * Integration Points:
 * - Dynamic Service Registry: Service instance topology data
 * - Advanced Health Monitor: Health correlation across topology
 * - Intelligent Load Balancer: Topology-aware routing decisions
 * - Automatic Failover System: Topology-aware failover planning
 * 
 * Research-Based Implementation:
 * - Service mesh topology patterns
 * - Network proximity algorithms
 * - Dependency graph analysis techniques
 * - Performance correlation analysis
 */

import { logger } from '../utils/logger';
import { dynamicServiceRegistry, ServiceInstance } from './dynamicServiceRegistry';
import { advancedHealthMonitor, HealthAssessment } from './advancedHealthMonitor';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Topology Types
export interface ServiceNode {
  nodeId: string;
  serviceName: string;
  instances: ServiceInstance[];
  position: {
    x: number;
    y: number;
    zone?: string;
    region?: string;
  };
  metadata: {
    criticality: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    version: string;
    tags: string[];
  };
  health: {
    overallHealth: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    healthScore: number;
    instanceCount: number;
    healthyInstances: number;
  };
}

export interface ServiceEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: 'depends_on' | 'provides_to' | 'communicates_with';
  metrics: {
    latency: number;
    throughput: number;
    errorRate: number;
    bandwidth: number;
  };
  weight: number; // Connection strength
  proximity: number; // Network proximity score
}

export interface TopologyCluster {
  clusterId: string;
  name: string;
  nodes: ServiceNode[];
  boundaries: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  characteristics: {
    avgLatency: number;
    totalThroughput: number;
    clusterHealth: number;
    criticalityLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface TopologyMap {
  mapId: string;
  timestamp: Date;
  nodes: Map<string, ServiceNode>;
  edges: Map<string, ServiceEdge>;
  clusters: Map<string, TopologyCluster>;
  metrics: {
    totalNodes: number;
    totalEdges: number;
    totalClusters: number;
    avgProximity: number;
    healthDistribution: Record<string, number>;
  };
}

export interface ProximityMatrix {
  matrix: Map<string, Map<string, number>>;
  lastUpdated: Date;
  algorithm: 'latency_based' | 'geographic' | 'network_hops' | 'hybrid';
}

/**
 * Service Topology Mapper - Main Implementation
 */
export class ServiceTopologyMapper extends EventEmitter {
  private currentTopology: TopologyMap | null = null;
  private proximityMatrix: ProximityMatrix | null = null;
  private topologyHistory: TopologyMap[] = [];
  
  // Mapping intervals
  private topologyUpdateInterval: NodeJS.Timeout | null = null;
  private proximityUpdateInterval: NodeJS.Timeout | null = null;
  private visualizationUpdateInterval: NodeJS.Timeout | null = null;
  
  private isInitialized = false;

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize the service topology mapper
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Service Topology Mapper already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Service Topology Mapper...');

      // Create initial topology map
      await this.createInitialTopology();

      // Start topology monitoring
      this.startTopologyMonitoring();

      // Start proximity monitoring
      this.startProximityMonitoring();

      // Start visualization updates
      this.startVisualizationUpdates();

      this.isInitialized = true;
      this.emit('topology:initialized');

      logger.info('✅ Service Topology Mapper initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Service Topology Mapper:', error);
      throw error;
    }
  }

  /**
   * Create initial topology map
   */
  private async createInitialTopology(): Promise<void> {
    const mapId = uuidv4();
    const nodes = new Map<string, ServiceNode>();
    const edges = new Map<string, ServiceEdge>();
    const clusters = new Map<string, TopologyCluster>();

    // Get all services from registry
    const registryStatus = await dynamicServiceRegistry.getRegistryStatus();

    // Create nodes for each service
    for (const serviceInfo of registryStatus.services) {
      const instances = await dynamicServiceRegistry.discoverServiceInstances(
        serviceInfo.serviceName,
        { healthyOnly: false }
      );

      if (instances.length === 0) continue;

      // Calculate service health
      const healthAssessments = await Promise.all(
        instances.map(i => advancedHealthMonitor.getInstanceHealth(i.instanceId))
      );

      const validAssessments = healthAssessments.filter(Boolean) as HealthAssessment[];
      const avgHealthScore = validAssessments.length > 0 
        ? validAssessments.reduce((sum, h) => sum + h.healthScore, 0) / validAssessments.length
        : 50;

      const healthyCount = instances.filter(i => i.health.status === 'healthy').length;
      const overallHealth = this.determineOverallHealth(avgHealthScore, healthyCount, instances.length);

      // Create service node
      const node: ServiceNode = {
        nodeId: uuidv4(),
        serviceName: serviceInfo.serviceName,
        instances,
        position: this.calculateNodePosition(serviceInfo.serviceName, instances),
        metadata: {
          criticality: this.determineCriticality(serviceInfo.serviceName),
          category: this.determineCategory(serviceInfo.serviceName),
          version: instances[0]?.version || '1.0.0',
          tags: instances[0]?.metadata.tags || []
        },
        health: {
          overallHealth,
          healthScore: avgHealthScore,
          instanceCount: instances.length,
          healthyInstances: healthyCount
        }
      };

      nodes.set(node.nodeId, node);
    }

    // Create edges between related services
    await this.createServiceEdges(nodes, edges);

    // Create clusters
    await this.createTopologyClusters(nodes, edges, clusters);

    // Create topology map
    this.currentTopology = {
      mapId,
      timestamp: new Date(),
      nodes,
      edges,
      clusters,
      metrics: {
        totalNodes: nodes.size,
        totalEdges: edges.size,
        totalClusters: clusters.size,
        avgProximity: this.calculateAverageProximity(edges),
        healthDistribution: this.calculateHealthDistribution(nodes)
      }
    };

    // Store in history
    this.topologyHistory.push(this.currentTopology);
    if (this.topologyHistory.length > 10) {
      this.topologyHistory.shift();
    }

    logger.info(`🗺️ Created initial topology: ${nodes.size} nodes, ${edges.size} edges, ${clusters.size} clusters`);
  }

  /**
   * Calculate node position based on service characteristics
   */
  private calculateNodePosition(serviceName: string, instances: ServiceInstance[]): { x: number; y: number; zone?: string; region?: string } {
    // Position based on service category and network characteristics
    let x = 0;
    let y = 0;

    // Category-based positioning
    if (serviceName.includes('session')) {
      x = 100; y = 100;
    } else if (serviceName.includes('proxy')) {
      x = 200; y = 100;
    } else if (serviceName.includes('campaign')) {
      x = 150; y = 200;
    } else if (serviceName.includes('monitoring')) {
      x = 300; y = 150;
    } else if (serviceName.includes('safety')) {
      x = 250; y = 250;
    } else {
      x = 150; y = 150;
    }

    // Add some randomization to avoid overlap
    x += Math.random() * 50 - 25;
    y += Math.random() * 50 - 25;

    // Get zone and region from first instance
    const firstInstance = instances[0];
    const position: any = { x, y };

    if (firstInstance?.metadata.zone) {
      position.zone = firstInstance.metadata.zone;
    }

    if (firstInstance?.metadata.region) {
      position.region = firstInstance.metadata.region;
    }

    return position;
  }

  /**
   * Create edges between related services
   */
  private async createServiceEdges(
    nodes: Map<string, ServiceNode>,
    edges: Map<string, ServiceEdge>
  ): Promise<void> {
    const nodeArray = Array.from(nodes.values());

    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const sourceNode = nodeArray[i];
        const targetNode = nodeArray[j];

        // Check if services are related
        const relationship = this.determineServiceRelationship(
          sourceNode?.serviceName || 'unknown',
          targetNode?.serviceName || 'unknown'
        );

        if (relationship) {
          // Calculate edge metrics
          const metrics = await this.calculateEdgeMetrics(sourceNode!, targetNode!);
          const proximity = await this.calculateServiceProximity(sourceNode!, targetNode!);

          const edge: ServiceEdge = {
            edgeId: uuidv4(),
            sourceNodeId: sourceNode?.nodeId || 'unknown',
            targetNodeId: targetNode?.nodeId || 'unknown',
            relationship,
            metrics,
            weight: this.calculateEdgeWeight(metrics, relationship),
            proximity
          };

          edges.set(edge.edgeId, edge);
        }
      }
    }
  }

  /**
   * Determine relationship between two services
   */
  private determineServiceRelationship(
    sourceService: string,
    targetService: string
  ): 'depends_on' | 'provides_to' | 'communicates_with' | null {
    // Define service dependencies
    const dependencies: Record<string, string[]> = {
      'campaign-orchestrator': ['twikit-session-manager', 'proxy-rotation-manager'],
      'x-automation-service': ['twikit-session-manager', 'global-rate-limit-coordinator'],
      'twikit-monitoring-service': ['account-health-monitor'],
      'account-health-monitor': ['twikit-session-manager']
    };

    if (dependencies[sourceService]?.includes(targetService)) {
      return 'depends_on';
    }

    if (dependencies[targetService]?.includes(sourceService)) {
      return 'provides_to';
    }

    // Check for communication patterns
    const communicationPairs = [
      ['twikit-session-manager', 'proxy-rotation-manager'],
      ['campaign-orchestrator', 'x-automation-service'],
      ['twikit-monitoring-service', 'account-health-monitor']
    ];

    for (const [service1, service2] of communicationPairs) {
      if ((sourceService === service1 && targetService === service2) ||
          (sourceService === service2 && targetService === service1)) {
        return 'communicates_with';
      }
    }

    return null;
  }

  /**
   * Calculate metrics between two service nodes
   */
  private async calculateEdgeMetrics(
    sourceNode: ServiceNode,
    targetNode: ServiceNode
  ): Promise<{ latency: number; throughput: number; errorRate: number; bandwidth: number }> {
    // Calculate average metrics between all instance pairs
    let totalLatency = 0;
    let totalThroughput = 0;
    let totalErrorRate = 0;
    let totalBandwidth = 0;
    let pairCount = 0;

    for (const sourceInstance of sourceNode.instances) {
      for (const targetInstance of targetNode.instances) {
        // Calculate latency based on network proximity
        const latency = Math.abs(sourceInstance.network.latency - targetInstance.network.latency) + 
                       (100 - Math.min(sourceInstance.network.proximity, targetInstance.network.proximity));

        totalLatency += latency;
        totalThroughput += Math.min(sourceInstance.network.bandwidth, targetInstance.network.bandwidth);
        totalErrorRate += (sourceInstance.health.consecutiveFailures + targetInstance.health.consecutiveFailures) / 2;
        totalBandwidth += (sourceInstance.network.bandwidth + targetInstance.network.bandwidth) / 2;
        pairCount++;
      }
    }

    return {
      latency: pairCount > 0 ? totalLatency / pairCount : 0,
      throughput: pairCount > 0 ? totalThroughput / pairCount : 0,
      errorRate: pairCount > 0 ? totalErrorRate / pairCount : 0,
      bandwidth: pairCount > 0 ? totalBandwidth / pairCount : 0
    };
  }

  /**
   * Calculate proximity between two service nodes
   */
  private async calculateServiceProximity(
    sourceNode: ServiceNode,
    targetNode: ServiceNode
  ): Promise<number> {
    // Calculate average proximity between all instance pairs
    let totalProximity = 0;
    let pairCount = 0;

    for (const sourceInstance of sourceNode.instances) {
      for (const targetInstance of targetNode.instances) {
        // Proximity based on network metrics and geographic location
        let proximity = (sourceInstance.network.proximity + targetInstance.network.proximity) / 2;

        // Bonus for same zone/region
        if (sourceInstance.metadata.zone === targetInstance.metadata.zone) {
          proximity += 10;
        }
        if (sourceInstance.metadata.region === targetInstance.metadata.region) {
          proximity += 5;
        }

        totalProximity += proximity;
        pairCount++;
      }
    }

    return pairCount > 0 ? Math.min(100, totalProximity / pairCount) : 0;
  }

  /**
   * Calculate edge weight based on metrics and relationship
   */
  private calculateEdgeWeight(
    metrics: { latency: number; throughput: number; errorRate: number; bandwidth: number },
    relationship: 'depends_on' | 'provides_to' | 'communicates_with'
  ): number {
    let weight = 50; // Base weight

    // Adjust based on performance metrics
    weight += Math.max(0, 50 - metrics.latency / 10); // Lower latency = higher weight
    weight += Math.min(50, metrics.throughput / 10); // Higher throughput = higher weight
    weight -= metrics.errorRate * 5; // Higher error rate = lower weight

    // Adjust based on relationship type
    switch (relationship) {
      case 'depends_on':
        weight += 20; // Dependencies are important
        break;
      case 'provides_to':
        weight += 15; // Providers are important
        break;
      case 'communicates_with':
        weight += 10; // Communication is moderately important
        break;
    }

    return Math.max(0, Math.min(100, weight));
  }

  /**
   * Create topology clusters
   */
  private async createTopologyClusters(
    nodes: Map<string, ServiceNode>,
    edges: Map<string, ServiceEdge>,
    clusters: Map<string, TopologyCluster>
  ): Promise<void> {
    // Group nodes by category and proximity
    const categoryGroups = new Map<string, ServiceNode[]>();

    for (const node of nodes.values()) {
      const category = node.metadata.category;
      const group = categoryGroups.get(category) || [];
      group.push(node);
      categoryGroups.set(category, group);
    }

    // Create clusters for each category
    for (const [category, groupNodes] of categoryGroups.entries()) {
      if (groupNodes.length === 0) continue;

      const clusterId = uuidv4();
      
      // Calculate cluster boundaries
      const xCoords = groupNodes.map(n => n.position.x);
      const yCoords = groupNodes.map(n => n.position.y);
      
      const boundaries = {
        minX: Math.min(...xCoords) - 25,
        maxX: Math.max(...xCoords) + 25,
        minY: Math.min(...yCoords) - 25,
        maxY: Math.max(...yCoords) + 25
      };

      // Calculate cluster characteristics
      const avgLatency = this.calculateClusterLatency(groupNodes, edges);
      const totalThroughput = this.calculateClusterThroughput(groupNodes);
      const clusterHealth = this.calculateClusterHealth(groupNodes);
      const criticalityLevel = this.calculateClusterCriticality(groupNodes);

      const cluster: TopologyCluster = {
        clusterId,
        name: `${category.charAt(0).toUpperCase() + category.slice(1)} Cluster`,
        nodes: groupNodes,
        boundaries,
        characteristics: {
          avgLatency,
          totalThroughput,
          clusterHealth,
          criticalityLevel
        }
      };

      clusters.set(clusterId, cluster);
    }
  }

  /**
   * Utility methods for topology calculations
   */
  private determineOverallHealth(avgHealthScore: number, healthyCount: number, totalCount: number): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    const healthyRatio = healthyCount / totalCount;

    if (avgHealthScore >= 80 && healthyRatio >= 0.8) return 'healthy';
    if (avgHealthScore >= 60 && healthyRatio >= 0.6) return 'degraded';
    if (avgHealthScore >= 40 && healthyRatio >= 0.4) return 'unhealthy';
    return 'critical';
  }

  private determineCriticality(serviceName: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalServices = ['twikit-session-manager', 'global-rate-limit-coordinator'];
    const highServices = ['campaign-orchestrator', 'x-automation-service'];
    const mediumServices = ['proxy-rotation-manager', 'twikit-monitoring-service'];

    if (criticalServices.includes(serviceName)) return 'critical';
    if (highServices.includes(serviceName)) return 'high';
    if (mediumServices.includes(serviceName)) return 'medium';
    return 'low';
  }

  private determineCategory(serviceName: string): string {
    if (serviceName.includes('session') || serviceName.includes('auth')) return 'session_management';
    if (serviceName.includes('proxy') || serviceName.includes('connection')) return 'connection_infrastructure';
    if (serviceName.includes('campaign') || serviceName.includes('automation')) return 'campaign_automation';
    if (serviceName.includes('monitoring') || serviceName.includes('analytics')) return 'analytics_monitoring';
    if (serviceName.includes('safety') || serviceName.includes('compliance')) return 'safety_compliance';
    return 'other';
  }

  private calculateAverageProximity(edges: Map<string, ServiceEdge>): number {
    if (edges.size === 0) return 0;
    const totalProximity = Array.from(edges.values()).reduce((sum, edge) => sum + edge.proximity, 0);
    return totalProximity / edges.size;
  }

  private calculateHealthDistribution(nodes: Map<string, ServiceNode>): Record<string, number> {
    const distribution = { healthy: 0, degraded: 0, unhealthy: 0, critical: 0 };

    for (const node of nodes.values()) {
      distribution[node.health.overallHealth]++;
    }

    return distribution;
  }

  private calculateClusterLatency(nodes: ServiceNode[], edges: Map<string, ServiceEdge>): number {
    const nodeIds = new Set(nodes.map(n => n.nodeId));
    const clusterEdges = Array.from(edges.values()).filter(e =>
      nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
    );

    if (clusterEdges.length === 0) return 0;
    return clusterEdges.reduce((sum, edge) => sum + edge.metrics.latency, 0) / clusterEdges.length;
  }

  private calculateClusterThroughput(nodes: ServiceNode[]): number {
    return nodes.reduce((sum, node) => {
      const instanceThroughput = node.instances.reduce((iSum, instance) =>
        iSum + (instance.network.bandwidth || 0), 0
      );
      return sum + instanceThroughput;
    }, 0);
  }

  private calculateClusterHealth(nodes: ServiceNode[]): number {
    if (nodes.length === 0) return 0;
    return nodes.reduce((sum, node) => sum + node.health.healthScore, 0) / nodes.length;
  }

  private calculateClusterCriticality(nodes: ServiceNode[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalityScores = { low: 1, medium: 2, high: 3, critical: 4 };
    const avgScore = nodes.reduce((sum, node) => sum + criticalityScores[node.metadata.criticality], 0) / nodes.length;

    if (avgScore >= 3.5) return 'critical';
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Start topology monitoring
   */
  private startTopologyMonitoring(): void {
    this.topologyUpdateInterval = setInterval(async () => {
      try {
        await this.updateTopology();
      } catch (error) {
        logger.error('Topology update failed:', error);
      }
    }, 60000); // Every minute

    logger.info('🗺️ Topology monitoring started');
  }

  /**
   * Update topology map
   */
  private async updateTopology(): Promise<void> {
    if (!this.currentTopology) return;

    // Update node health information
    for (const node of this.currentTopology.nodes.values()) {
      const healthAssessments = await Promise.all(
        node.instances.map(i => advancedHealthMonitor.getInstanceHealth(i.instanceId))
      );

      const validAssessments = healthAssessments.filter(Boolean) as HealthAssessment[];
      if (validAssessments.length > 0) {
        const avgHealthScore = validAssessments.reduce((sum, h) => sum + h.healthScore, 0) / validAssessments.length;
        const healthyCount = node.instances.filter(i => i.health.status === 'healthy').length;

        node.health.healthScore = avgHealthScore;
        node.health.healthyInstances = healthyCount;
        node.health.overallHealth = this.determineOverallHealth(avgHealthScore, healthyCount, node.instances.length);
      }
    }

    // Update edge metrics
    for (const edge of this.currentTopology.edges.values()) {
      const sourceNode = this.currentTopology.nodes.get(edge.sourceNodeId);
      const targetNode = this.currentTopology.nodes.get(edge.targetNodeId);

      if (sourceNode && targetNode) {
        edge.metrics = await this.calculateEdgeMetrics(sourceNode, targetNode);
        edge.proximity = await this.calculateServiceProximity(sourceNode, targetNode);
        edge.weight = this.calculateEdgeWeight(edge.metrics, edge.relationship);
      }
    }

    // Update topology metrics
    this.currentTopology.metrics = {
      totalNodes: this.currentTopology.nodes.size,
      totalEdges: this.currentTopology.edges.size,
      totalClusters: this.currentTopology.clusters.size,
      avgProximity: this.calculateAverageProximity(this.currentTopology.edges),
      healthDistribution: this.calculateHealthDistribution(this.currentTopology.nodes)
    };

    this.currentTopology.timestamp = new Date();
    this.emit('topology:updated', this.currentTopology);
  }

  /**
   * Start proximity monitoring
   */
  private startProximityMonitoring(): void {
    this.proximityUpdateInterval = setInterval(async () => {
      try {
        await this.updateProximityMatrix();
      } catch (error) {
        logger.error('Proximity matrix update failed:', error);
      }
    }, 300000); // Every 5 minutes

    logger.info('🌐 Proximity monitoring started');
  }

  /**
   * Update proximity matrix
   */
  private async updateProximityMatrix(): Promise<void> {
    if (!this.currentTopology) return;

    const matrix = new Map<string, Map<string, number>>();
    const nodes = Array.from(this.currentTopology.nodes.values());

    for (let i = 0; i < nodes.length; i++) {
      const sourceNode = nodes[i];
      const sourceProximities = new Map<string, number>();

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) {
          sourceProximities.set(nodes[j]?.nodeId || 'unknown', 100); // Self proximity is 100
          continue;
        }

        const targetNode = nodes[j];
        const proximity = await this.calculateServiceProximity(sourceNode!, targetNode!);
        sourceProximities.set(targetNode?.nodeId || 'unknown', proximity);
      }

      matrix.set(sourceNode?.nodeId || 'unknown', sourceProximities);
    }

    this.proximityMatrix = {
      matrix,
      lastUpdated: new Date(),
      algorithm: 'hybrid'
    };

    this.emit('proximity:updated', this.proximityMatrix);
  }

  /**
   * Start visualization updates
   */
  private startVisualizationUpdates(): void {
    this.visualizationUpdateInterval = setInterval(() => {
      try {
        this.updateVisualization();
      } catch (error) {
        logger.error('Visualization update failed:', error);
      }
    }, 30000); // Every 30 seconds

    logger.info('📊 Visualization updates started');
  }

  /**
   * Update visualization data
   */
  private updateVisualization(): void {
    if (!this.currentTopology) return;

    const visualizationData = {
      nodes: Array.from(this.currentTopology.nodes.values()).map(node => ({
        id: node.nodeId,
        label: node.serviceName,
        x: node.position.x,
        y: node.position.y,
        size: Math.max(10, node.health.healthScore / 5),
        color: this.getHealthColor(node.health.overallHealth),
        category: node.metadata.category,
        criticality: node.metadata.criticality,
        instances: node.health.instanceCount,
        healthy: node.health.healthyInstances
      })),
      edges: Array.from(this.currentTopology.edges.values()).map(edge => ({
        id: edge.edgeId,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        weight: edge.weight / 10,
        color: this.getRelationshipColor(edge.relationship),
        label: edge.relationship,
        latency: edge.metrics.latency,
        proximity: edge.proximity
      })),
      clusters: Array.from(this.currentTopology.clusters.values()).map(cluster => ({
        id: cluster.clusterId,
        name: cluster.name,
        bounds: cluster.boundaries,
        health: cluster.characteristics.clusterHealth,
        criticality: cluster.characteristics.criticalityLevel,
        nodeCount: cluster.nodes.length
      }))
    };

    this.emit('visualization:updated', visualizationData);
  }

  /**
   * Get health color for visualization
   */
  private getHealthColor(health: string): string {
    switch (health) {
      case 'healthy': return '#4CAF50';
      case 'degraded': return '#FF9800';
      case 'unhealthy': return '#F44336';
      case 'critical': return '#9C27B0';
      default: return '#9E9E9E';
    }
  }

  /**
   * Get relationship color for visualization
   */
  private getRelationshipColor(relationship: string): string {
    switch (relationship) {
      case 'depends_on': return '#2196F3';
      case 'provides_to': return '#4CAF50';
      case 'communicates_with': return '#FF9800';
      default: return '#9E9E9E';
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle service registry events
    dynamicServiceRegistry.on('instance:registered', async () => {
      await this.createInitialTopology();
    });

    dynamicServiceRegistry.on('instance:expired', async () => {
      await this.createInitialTopology();
    });

    // Handle health monitor events
    advancedHealthMonitor.on('health:assessed', () => {
      // Topology will be updated on next interval
    });
  }

  /**
   * Get current topology
   */
  getCurrentTopology(): TopologyMap | null {
    return this.currentTopology;
  }

  /**
   * Get proximity matrix
   */
  getProximityMatrix(): ProximityMatrix | null {
    return this.proximityMatrix;
  }

  /**
   * Get topology status
   */
  async getTopologyStatus(): Promise<any> {
    return {
      initialized: this.isInitialized,
      currentTopology: this.currentTopology ? {
        mapId: this.currentTopology.mapId,
        timestamp: this.currentTopology.timestamp,
        metrics: this.currentTopology.metrics
      } : null,
      proximityMatrix: this.proximityMatrix ? {
        lastUpdated: this.proximityMatrix.lastUpdated,
        algorithm: this.proximityMatrix.algorithm,
        size: this.proximityMatrix.matrix.size
      } : null,
      historySize: this.topologyHistory.length,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.topologyUpdateInterval) {
      clearInterval(this.topologyUpdateInterval);
      this.topologyUpdateInterval = null;
    }

    if (this.proximityUpdateInterval) {
      clearInterval(this.proximityUpdateInterval);
      this.proximityUpdateInterval = null;
    }

    if (this.visualizationUpdateInterval) {
      clearInterval(this.visualizationUpdateInterval);
      this.visualizationUpdateInterval = null;
    }

    this.currentTopology = null;
    this.proximityMatrix = null;
    this.topologyHistory = [];
    this.isInitialized = false;

    this.emit('topology:destroyed');
    logger.info('🧹 Service Topology Mapper destroyed');
  }
}

// Export singleton instance
export const serviceTopologyMapper = new ServiceTopologyMapper();
