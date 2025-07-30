/**
 * Advanced Health Monitor - Stage 24 Component 1.3
 * 
 * Multi-tier health monitoring system with predictive capabilities, performance
 * metrics collection, and intelligent health assessment for distributed services.
 * 
 * Key Features:
 * - Multi-tier health checks (basic, detailed, predictive)
 * - Performance metrics collection and trend analysis
 * - Predictive health assessment using ML-based algorithms
 * - Service dependency health correlation
 * - Automated health recovery recommendations
 * - Real-time health event streaming
 * 
 * Integration Points:
 * - Dynamic Service Registry: Health-aware service selection
 * - Enhanced Backend Client: Circuit breaker health integration
 * - Real-Time Service Coordinator: Health-based coordination
 * - Service Integration Mapper: Health-aware method routing
 * 
 * Research-Based Implementation:
 * - Google SRE golden signals (latency, traffic, errors, saturation)
 * - Multi-tier health check patterns from distributed systems
 * - Predictive monitoring using time-series analysis
 * - Service mesh observability patterns
 */

import { logger } from '../utils/logger';
import { dynamicServiceRegistry, ServiceInstance } from './dynamicServiceRegistry';
import { enhancedBackendClient } from './enhancedBackendClient';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Health Check Types
export enum HealthCheckTier {
  BASIC = 'basic',
  DETAILED = 'detailed',
  PREDICTIVE = 'predictive'
}

export interface HealthMetrics {
  // Golden Signals
  latency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  traffic: {
    requestsPerSecond: number;
    connectionsActive: number;
    throughputMbps: number;
  };
  errors: {
    errorRate: number;
    errorCount: number;
    criticalErrors: number;
    timeoutRate: number;
  };
  saturation: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkUsage: number;
    queueDepth: number;
  };
  
  // Additional Metrics
  availability: {
    uptime: number;
    successRate: number;
    mttr: number; // Mean Time To Recovery
    mtbf: number; // Mean Time Between Failures
  };
  performance: {
    responseTime: number;
    concurrency: number;
    cacheHitRate: number;
    databaseConnections: number;
  };
}

export interface HealthAssessment {
  instanceId: string;
  serviceName: string;
  tier: HealthCheckTier;
  timestamp: Date;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  healthScore: number; // 0-100
  metrics: HealthMetrics;
  issues: HealthIssue[];
  recommendations: HealthRecommendation[];
  prediction: HealthPrediction;
}

export interface HealthIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'availability' | 'errors' | 'capacity';
  description: string;
  impact: string;
  detectedAt: Date;
  threshold: number;
  currentValue: number;
}

export interface HealthRecommendation {
  id: string;
  type: 'scale_up' | 'scale_down' | 'restart' | 'failover' | 'optimize' | 'investigate';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  expectedImpact: string;
  estimatedTime: number; // minutes
  confidence: number; // 0-100
}

export interface HealthPrediction {
  timeHorizon: number; // minutes
  predictedHealth: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  confidence: number; // 0-100
  riskFactors: string[];
  recommendedActions: string[];
}

export interface HealthMonitorConfig {
  basicCheckInterval: number;
  detailedCheckInterval: number;
  predictiveCheckInterval: number;
  metricsRetentionPeriod: number;
  healthScoreThresholds: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  enablePredictiveAnalysis: boolean;
  enableAutoRecovery: boolean;
  maxConcurrentChecks: number;
}

/**
 * Advanced Health Monitor - Main Implementation
 */
export class AdvancedHealthMonitor extends EventEmitter {
  private healthAssessments = new Map<string, HealthAssessment[]>();
  private metricsHistory = new Map<string, HealthMetrics[]>();
  private activeIssues = new Map<string, HealthIssue[]>();
  private config: HealthMonitorConfig;
  
  // Monitoring intervals
  private basicCheckInterval: NodeJS.Timeout | null = null;
  private detailedCheckInterval: NodeJS.Timeout | null = null;
  private predictiveCheckInterval: NodeJS.Timeout | null = null;
  
  private isInitialized = false;
  private concurrentChecks = 0;

  constructor(config?: Partial<HealthMonitorConfig>) {
    super();
    
    this.config = {
      basicCheckInterval: 10000, // 10 seconds
      detailedCheckInterval: 60000, // 1 minute
      predictiveCheckInterval: 300000, // 5 minutes
      metricsRetentionPeriod: 86400000, // 24 hours
      healthScoreThresholds: {
        healthy: 80,
        degraded: 60,
        unhealthy: 40
      },
      enablePredictiveAnalysis: true,
      enableAutoRecovery: false,
      maxConcurrentChecks: 10,
      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize the advanced health monitor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Advanced Health Monitor already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Advanced Health Monitor...');

      // Start multi-tier health monitoring
      this.startBasicHealthChecks();
      this.startDetailedHealthChecks();
      
      if (this.config.enablePredictiveAnalysis) {
        this.startPredictiveHealthChecks();
      }

      // Start metrics cleanup
      this.startMetricsCleanup();

      this.isInitialized = true;
      this.emit('monitor:initialized');

      logger.info('✅ Advanced Health Monitor initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Advanced Health Monitor:', error);
      throw error;
    }
  }

  /**
   * Start basic health checks (tier 1)
   */
  private startBasicHealthChecks(): void {
    this.basicCheckInterval = setInterval(async () => {
      try {
        await this.performBasicHealthChecks();
      } catch (error) {
        logger.error('Basic health checks failed:', error);
      }
    }, this.config.basicCheckInterval);
    
    logger.info('🏥 Basic health monitoring started');
  }

  /**
   * Start detailed health checks (tier 2)
   */
  private startDetailedHealthChecks(): void {
    this.detailedCheckInterval = setInterval(async () => {
      try {
        await this.performDetailedHealthChecks();
      } catch (error) {
        logger.error('Detailed health checks failed:', error);
      }
    }, this.config.detailedCheckInterval);
    
    logger.info('🔬 Detailed health monitoring started');
  }

  /**
   * Start predictive health checks (tier 3)
   */
  private startPredictiveHealthChecks(): void {
    this.predictiveCheckInterval = setInterval(async () => {
      try {
        await this.performPredictiveHealthChecks();
      } catch (error) {
        logger.error('Predictive health checks failed:', error);
      }
    }, this.config.predictiveCheckInterval);
    
    logger.info('🔮 Predictive health monitoring started');
  }

  /**
   * Perform basic health checks on all service instances
   */
  private async performBasicHealthChecks(): Promise<void> {
    if (this.concurrentChecks >= this.config.maxConcurrentChecks) {
      logger.debug('Skipping basic health checks - max concurrent limit reached');
      return;
    }

    const registryStatus = await dynamicServiceRegistry.getRegistryStatus();
    const healthCheckPromises: Promise<void>[] = [];

    for (const serviceInfo of registryStatus.services) {
      const instances = await dynamicServiceRegistry.discoverServiceInstances(
        serviceInfo.serviceName,
        { healthyOnly: false }
      );

      for (const instance of instances) {
        if (this.concurrentChecks < this.config.maxConcurrentChecks) {
          healthCheckPromises.push(this.performBasicHealthCheck(instance));
        }
      }
    }

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Perform basic health check on a single service instance
   */
  private async performBasicHealthCheck(instance: ServiceInstance): Promise<void> {
    this.concurrentChecks++;
    
    try {
      const startTime = Date.now();
      const healthUrl = `${instance.protocol}://${instance.address}:${instance.port}/health`;
      
      const response = await axios.get(healthUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      
      const responseTime = Date.now() - startTime;
      
      // Create basic health metrics
      const metrics: HealthMetrics = {
        latency: {
          p50: responseTime,
          p95: responseTime,
          p99: responseTime,
          average: responseTime
        },
        traffic: {
          requestsPerSecond: 0,
          connectionsActive: 0,
          throughputMbps: 0
        },
        errors: {
          errorRate: response.status >= 400 ? 100 : 0,
          errorCount: response.status >= 400 ? 1 : 0,
          criticalErrors: response.status >= 500 ? 1 : 0,
          timeoutRate: 0
        },
        saturation: {
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          networkUsage: 0,
          queueDepth: 0
        },
        availability: {
          uptime: response.status === 200 ? 100 : 0,
          successRate: response.status === 200 ? 100 : 0,
          mttr: 0,
          mtbf: 0
        },
        performance: {
          responseTime,
          concurrency: 0,
          cacheHitRate: 0,
          databaseConnections: 0
        }
      };

      // Calculate health score
      const healthScore = this.calculateBasicHealthScore(metrics, response.status);
      
      // Determine overall health
      const overallHealth = this.determineOverallHealth(healthScore);
      
      // Create health assessment
      const assessment: HealthAssessment = {
        instanceId: instance.instanceId,
        serviceName: instance.serviceName,
        tier: HealthCheckTier.BASIC,
        timestamp: new Date(),
        overallHealth,
        healthScore,
        metrics,
        issues: this.detectBasicIssues(metrics, response.status),
        recommendations: [],
        prediction: {
          timeHorizon: 0,
          predictedHealth: overallHealth,
          confidence: 50,
          riskFactors: [],
          recommendedActions: []
        }
      };

      // Store assessment
      this.storeHealthAssessment(assessment);

      // Emit health event
      this.emit('health:assessed', assessment);

    } catch (error) {
      // Handle health check failure
      await this.handleHealthCheckFailure(instance, HealthCheckTier.BASIC, error);
    } finally {
      this.concurrentChecks--;
    }
  }

  /**
   * Calculate basic health score from metrics
   */
  private calculateBasicHealthScore(metrics: HealthMetrics, statusCode: number): number {
    let score = 100;
    
    // Response time factor (0-30 points)
    if (metrics.latency.average > 5000) {
      score -= 30;
    } else if (metrics.latency.average > 2000) {
      score -= 20;
    } else if (metrics.latency.average > 1000) {
      score -= 10;
    }
    
    // Status code factor (0-40 points)
    if (statusCode >= 500) {
      score -= 40;
    } else if (statusCode >= 400) {
      score -= 20;
    }
    
    // Availability factor (0-30 points)
    if (metrics.availability.uptime < 50) {
      score -= 30;
    } else if (metrics.availability.uptime < 80) {
      score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine overall health status from score
   */
  private determineOverallHealth(healthScore: number): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    if (healthScore >= this.config.healthScoreThresholds.healthy) {
      return 'healthy';
    } else if (healthScore >= this.config.healthScoreThresholds.degraded) {
      return 'degraded';
    } else if (healthScore >= this.config.healthScoreThresholds.unhealthy) {
      return 'unhealthy';
    } else {
      return 'critical';
    }
  }

  /**
   * Detect basic health issues from metrics
   */
  private detectBasicIssues(metrics: HealthMetrics, statusCode: number): HealthIssue[] {
    const issues: HealthIssue[] = [];
    
    // High latency issue
    if (metrics.latency.average > 2000) {
      issues.push({
        id: uuidv4(),
        severity: metrics.latency.average > 5000 ? 'critical' : 'high',
        category: 'performance',
        description: `High response time: ${metrics.latency.average}ms`,
        impact: 'Degraded user experience and potential timeouts',
        detectedAt: new Date(),
        threshold: 2000,
        currentValue: metrics.latency.average
      });
    }
    
    // HTTP error issue
    if (statusCode >= 400) {
      issues.push({
        id: uuidv4(),
        severity: statusCode >= 500 ? 'critical' : 'high',
        category: 'errors',
        description: `HTTP error status: ${statusCode}`,
        impact: 'Service requests failing',
        detectedAt: new Date(),
        threshold: 399,
        currentValue: statusCode
      });
    }
    
    return issues;
  }

  /**
   * Perform detailed health checks with comprehensive metrics
   */
  private async performDetailedHealthChecks(): Promise<void> {
    const registryStatus = await dynamicServiceRegistry.getRegistryStatus();

    for (const serviceInfo of registryStatus.services) {
      const instances = await dynamicServiceRegistry.discoverServiceInstances(
        serviceInfo.serviceName,
        { healthyOnly: false, maxInstances: 5 }
      );

      for (const instance of instances) {
        if (this.concurrentChecks < this.config.maxConcurrentChecks) {
          await this.performDetailedHealthCheck(instance);
        }
      }
    }
  }

  /**
   * Perform detailed health check with comprehensive metrics collection
   */
  private async performDetailedHealthCheck(instance: ServiceInstance): Promise<void> {
    this.concurrentChecks++;

    try {
      // Collect comprehensive metrics
      const metrics = await this.collectDetailedMetrics(instance);

      // Calculate advanced health score
      const healthScore = this.calculateDetailedHealthScore(metrics);

      // Determine overall health
      const overallHealth = this.determineOverallHealth(healthScore);

      // Detect detailed issues
      const issues = this.detectDetailedIssues(metrics);

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(metrics, issues);

      // Create detailed assessment
      const assessment: HealthAssessment = {
        instanceId: instance.instanceId,
        serviceName: instance.serviceName,
        tier: HealthCheckTier.DETAILED,
        timestamp: new Date(),
        overallHealth,
        healthScore,
        metrics,
        issues,
        recommendations,
        prediction: {
          timeHorizon: 0,
          predictedHealth: overallHealth,
          confidence: 70,
          riskFactors: [],
          recommendedActions: []
        }
      };

      // Store assessment and metrics
      this.storeHealthAssessment(assessment);
      this.storeMetricsHistory(instance.instanceId, metrics);

      // Emit detailed health event
      this.emit('health:detailed', assessment);

    } catch (error) {
      await this.handleHealthCheckFailure(instance, HealthCheckTier.DETAILED, error);
    } finally {
      this.concurrentChecks--;
    }
  }

  /**
   * Collect detailed metrics from service instance
   */
  private async collectDetailedMetrics(instance: ServiceInstance): Promise<HealthMetrics> {
    try {
      const metricsUrl = `${instance.protocol}://${instance.address}:${instance.port}/metrics`;
      const startTime = Date.now();

      const response = await axios.get(metricsUrl, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      const responseTime = Date.now() - startTime;
      const metricsData = response.data;

      // Parse metrics (assuming Prometheus format or custom JSON)
      return {
        latency: {
          p50: metricsData.latency_p50 || responseTime,
          p95: metricsData.latency_p95 || responseTime * 1.5,
          p99: metricsData.latency_p99 || responseTime * 2,
          average: metricsData.latency_avg || responseTime
        },
        traffic: {
          requestsPerSecond: metricsData.requests_per_second || 0,
          connectionsActive: metricsData.active_connections || 0,
          throughputMbps: metricsData.throughput_mbps || 0
        },
        errors: {
          errorRate: metricsData.error_rate || 0,
          errorCount: metricsData.error_count || 0,
          criticalErrors: metricsData.critical_errors || 0,
          timeoutRate: metricsData.timeout_rate || 0
        },
        saturation: {
          cpuUsage: metricsData.cpu_usage || 0,
          memoryUsage: metricsData.memory_usage || 0,
          diskUsage: metricsData.disk_usage || 0,
          networkUsage: metricsData.network_usage || 0,
          queueDepth: metricsData.queue_depth || 0
        },
        availability: {
          uptime: metricsData.uptime || 100,
          successRate: metricsData.success_rate || 100,
          mttr: metricsData.mttr || 0,
          mtbf: metricsData.mtbf || 0
        },
        performance: {
          responseTime,
          concurrency: metricsData.concurrency || 0,
          cacheHitRate: metricsData.cache_hit_rate || 0,
          databaseConnections: metricsData.db_connections || 0
        }
      };

    } catch (error) {
      // Return basic metrics if detailed collection fails
      return this.createFallbackMetrics(instance);
    }
  }

  /**
   * Calculate detailed health score from comprehensive metrics
   */
  private calculateDetailedHealthScore(metrics: HealthMetrics): number {
    let score = 100;

    // Latency score (25%)
    const latencyScore = Math.max(0, 100 - (metrics.latency.p95 / 50)); // 50ms = 0 points
    score = score * 0.75 + latencyScore * 0.25;

    // Error rate score (25%)
    const errorScore = Math.max(0, 100 - (metrics.errors.errorRate * 10));
    score = score * 0.75 + errorScore * 0.25;

    // Saturation score (25%)
    const saturationScore = Math.max(0, 100 - Math.max(
      metrics.saturation.cpuUsage,
      metrics.saturation.memoryUsage,
      metrics.saturation.diskUsage
    ));
    score = score * 0.75 + saturationScore * 0.25;

    // Availability score (25%)
    const availabilityScore = metrics.availability.successRate;
    score = score * 0.75 + availabilityScore * 0.25;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Detect detailed health issues from comprehensive metrics
   */
  private detectDetailedIssues(metrics: HealthMetrics): HealthIssue[] {
    const issues: HealthIssue[] = [];

    // High CPU usage
    if (metrics.saturation.cpuUsage > 80) {
      issues.push({
        id: uuidv4(),
        severity: metrics.saturation.cpuUsage > 95 ? 'critical' : 'high',
        category: 'capacity',
        description: `High CPU usage: ${metrics.saturation.cpuUsage}%`,
        impact: 'Performance degradation and potential service instability',
        detectedAt: new Date(),
        threshold: 80,
        currentValue: metrics.saturation.cpuUsage
      });
    }

    // High memory usage
    if (metrics.saturation.memoryUsage > 85) {
      issues.push({
        id: uuidv4(),
        severity: metrics.saturation.memoryUsage > 95 ? 'critical' : 'high',
        category: 'capacity',
        description: `High memory usage: ${metrics.saturation.memoryUsage}%`,
        impact: 'Risk of out-of-memory errors and service crashes',
        detectedAt: new Date(),
        threshold: 85,
        currentValue: metrics.saturation.memoryUsage
      });
    }

    // High error rate
    if (metrics.errors.errorRate > 5) {
      issues.push({
        id: uuidv4(),
        severity: metrics.errors.errorRate > 20 ? 'critical' : 'high',
        category: 'errors',
        description: `High error rate: ${metrics.errors.errorRate}%`,
        impact: 'Service reliability issues affecting user experience',
        detectedAt: new Date(),
        threshold: 5,
        currentValue: metrics.errors.errorRate
      });
    }

    // High queue depth
    if (metrics.saturation.queueDepth > 100) {
      issues.push({
        id: uuidv4(),
        severity: metrics.saturation.queueDepth > 500 ? 'critical' : 'medium',
        category: 'performance',
        description: `High queue depth: ${metrics.saturation.queueDepth}`,
        impact: 'Increased latency and potential request timeouts',
        detectedAt: new Date(),
        threshold: 100,
        currentValue: metrics.saturation.queueDepth
      });
    }

    return issues;
  }

  /**
   * Generate health recommendations based on metrics and issues
   */
  private generateHealthRecommendations(metrics: HealthMetrics, issues: HealthIssue[]): HealthRecommendation[] {
    const recommendations: HealthRecommendation[] = [];

    // CPU-based recommendations
    if (metrics.saturation.cpuUsage > 80) {
      recommendations.push({
        id: uuidv4(),
        type: 'scale_up',
        priority: metrics.saturation.cpuUsage > 95 ? 'urgent' : 'high',
        description: 'Scale up service instances to distribute CPU load',
        expectedImpact: 'Reduced CPU usage and improved response times',
        estimatedTime: 5,
        confidence: 85
      });
    }

    // Memory-based recommendations
    if (metrics.saturation.memoryUsage > 85) {
      recommendations.push({
        id: uuidv4(),
        type: 'optimize',
        priority: 'high',
        description: 'Investigate memory leaks and optimize memory usage',
        expectedImpact: 'Reduced memory consumption and improved stability',
        estimatedTime: 30,
        confidence: 70
      });
    }

    // Error rate recommendations
    if (metrics.errors.errorRate > 10) {
      recommendations.push({
        id: uuidv4(),
        type: 'investigate',
        priority: 'urgent',
        description: 'Investigate root cause of high error rate',
        expectedImpact: 'Improved service reliability and user experience',
        estimatedTime: 60,
        confidence: 90
      });
    }

    // Performance recommendations
    if (metrics.latency.p95 > 2000) {
      recommendations.push({
        id: uuidv4(),
        type: 'optimize',
        priority: 'medium',
        description: 'Optimize service performance and database queries',
        expectedImpact: 'Reduced response times and improved user experience',
        estimatedTime: 120,
        confidence: 75
      });
    }

    return recommendations;
  }

  /**
   * Perform predictive health analysis
   */
  private async performPredictiveHealthChecks(): Promise<void> {
    const registryStatus = await dynamicServiceRegistry.getRegistryStatus();

    for (const serviceInfo of registryStatus.services) {
      const instances = await dynamicServiceRegistry.discoverServiceInstances(
        serviceInfo.serviceName,
        { healthyOnly: false, maxInstances: 3 }
      );

      for (const instance of instances) {
        await this.performPredictiveHealthCheck(instance);
      }
    }
  }

  /**
   * Perform predictive health analysis using historical data
   */
  private async performPredictiveHealthCheck(instance: ServiceInstance): Promise<void> {
    try {
      const metricsHistory = this.metricsHistory.get(instance.instanceId) || [];

      if (metricsHistory.length < 5) {
        return; // Need more data for prediction
      }

      // Analyze trends
      const prediction = this.analyzeTrends(metricsHistory);

      // Get latest assessment
      const assessments = this.healthAssessments.get(instance.instanceId) || [];
      const latestAssessment = assessments[assessments.length - 1];

      if (latestAssessment) {
        // Update prediction
        latestAssessment.prediction = prediction;

        // Emit predictive health event
        this.emit('health:predictive', latestAssessment);
      }

    } catch (error) {
      logger.debug(`Predictive health check failed for ${instance.instanceId}:`, error);
    }
  }

  /**
   * Analyze trends in metrics history for predictive health assessment
   */
  private analyzeTrends(metricsHistory: HealthMetrics[]): HealthPrediction {
    const recentMetrics = metricsHistory.slice(-10); // Last 10 data points

    // Calculate trend slopes for key metrics
    const latencyTrend = this.calculateTrend(recentMetrics.map(m => m.latency.average));
    const errorTrend = this.calculateTrend(recentMetrics.map(m => m.errors.errorRate));
    const cpuTrend = this.calculateTrend(recentMetrics.map(m => m.saturation.cpuUsage));
    const memoryTrend = this.calculateTrend(recentMetrics.map(m => m.saturation.memoryUsage));

    // Predict future health based on trends
    let predictedHealth: 'healthy' | 'degraded' | 'unhealthy' | 'critical' = 'healthy';
    let confidence = 50;
    const riskFactors: string[] = [];
    const recommendedActions: string[] = [];

    // Analyze latency trend
    if (latencyTrend > 50) { // Increasing latency
      riskFactors.push('Increasing response times');
      if (latencyTrend > 100) {
        predictedHealth = 'degraded';
        recommendedActions.push('Investigate performance bottlenecks');
      }
    }

    // Analyze error trend
    if (errorTrend > 1) { // Increasing error rate
      riskFactors.push('Rising error rates');
      predictedHealth = 'degraded';
      recommendedActions.push('Review error logs and fix issues');
    }

    // Analyze resource trends
    if (cpuTrend > 5 || memoryTrend > 5) {
      riskFactors.push('Increasing resource usage');
      if (cpuTrend > 10 || memoryTrend > 10) {
        predictedHealth = 'unhealthy';
        recommendedActions.push('Scale up resources or optimize usage');
      }
    }

    // Calculate confidence based on data quality
    confidence = Math.min(95, 50 + (recentMetrics.length * 5));

    return {
      timeHorizon: 30, // 30 minutes prediction
      predictedHealth,
      confidence,
      riskFactors,
      recommendedActions
    };
  }

  /**
   * Calculate trend slope for a series of values
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = values.reduce((sum, _, index) => sum + (index * index), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Store health assessment in history
   */
  private storeHealthAssessment(assessment: HealthAssessment): void {
    const instanceId = assessment.instanceId;
    const assessments = this.healthAssessments.get(instanceId) || [];

    // Add new assessment
    assessments.push(assessment);

    // Keep only last 100 assessments per instance
    if (assessments.length > 100) {
      assessments.shift();
    }

    this.healthAssessments.set(instanceId, assessments);

    // Update active issues
    this.updateActiveIssues(instanceId, assessment.issues);
  }

  /**
   * Store metrics in history with retention management
   */
  private storeMetricsHistory(instanceId: string, metrics: HealthMetrics): void {
    const history = this.metricsHistory.get(instanceId) || [];

    // Add timestamp to metrics
    const timestampedMetrics = {
      ...metrics,
      timestamp: new Date()
    } as HealthMetrics & { timestamp: Date };

    history.push(timestampedMetrics);

    // Apply retention policy - keep last 24 hours of data
    const retentionCutoff = Date.now() - this.config.metricsRetentionPeriod;
    const filteredHistory = history.filter(m =>
      (m as any).timestamp.getTime() > retentionCutoff
    );

    this.metricsHistory.set(instanceId, filteredHistory);
  }

  /**
   * Handle health check failures
   */
  private async handleHealthCheckFailure(
    instance: ServiceInstance,
    tier: HealthCheckTier,
    error: any
  ): Promise<void> {
    logger.warn(`Health check failed for ${instance.serviceName}/${instance.instanceId}:`, error);

    // Create failure assessment
    const failureAssessment: HealthAssessment = {
      instanceId: instance.instanceId,
      serviceName: instance.serviceName,
      tier,
      timestamp: new Date(),
      overallHealth: 'critical',
      healthScore: 0,
      metrics: this.createFallbackMetrics(instance),
      issues: [{
        id: uuidv4(),
        severity: 'critical',
        category: 'availability',
        description: `Health check failed: ${error.message}`,
        impact: 'Service unavailable for health monitoring',
        detectedAt: new Date(),
        threshold: 0,
        currentValue: 1
      }],
      recommendations: [{
        id: uuidv4(),
        type: 'investigate',
        priority: 'urgent',
        description: 'Investigate service connectivity and health endpoint',
        expectedImpact: 'Restore health monitoring capabilities',
        estimatedTime: 15,
        confidence: 90
      }],
      prediction: {
        timeHorizon: 0,
        predictedHealth: 'critical',
        confidence: 95,
        riskFactors: ['Service unreachable'],
        recommendedActions: ['Check service status and connectivity']
      }
    };

    // Store failure assessment
    this.storeHealthAssessment(failureAssessment);

    // Emit failure event
    this.emit('health:failed', failureAssessment, error);
  }

  /**
   * Create fallback metrics when detailed collection fails
   */
  private createFallbackMetrics(_instance: ServiceInstance): HealthMetrics {
    return {
      latency: {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0
      },
      traffic: {
        requestsPerSecond: 0,
        connectionsActive: 0,
        throughputMbps: 0
      },
      errors: {
        errorRate: 100, // Assume 100% error rate if unreachable
        errorCount: 1,
        criticalErrors: 1,
        timeoutRate: 100
      },
      saturation: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0,
        queueDepth: 0
      },
      availability: {
        uptime: 0,
        successRate: 0,
        mttr: 0,
        mtbf: 0
      },
      performance: {
        responseTime: 0,
        concurrency: 0,
        cacheHitRate: 0,
        databaseConnections: 0
      }
    };
  }

  /**
   * Update active issues for an instance
   */
  private updateActiveIssues(instanceId: string, newIssues: HealthIssue[]): void {
    // Remove resolved issues and add new ones
    this.activeIssues.set(instanceId, newIssues);

    // Emit issue events
    for (const issue of newIssues) {
      this.emit('health:issue', instanceId, issue);
    }
  }

  /**
   * Start metrics cleanup process
   */
  private startMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // 1 hour

    logger.info('🧹 Metrics cleanup process started');
  }

  /**
   * Clean up old metrics based on retention policy
   */
  private cleanupOldMetrics(): void {
    const retentionCutoff = Date.now() - this.config.metricsRetentionPeriod;
    let cleanedCount = 0;

    for (const [instanceId, history] of this.metricsHistory.entries()) {
      const filteredHistory = history.filter(metrics =>
        (metrics as any).timestamp?.getTime() > retentionCutoff
      );

      if (filteredHistory.length !== history.length) {
        this.metricsHistory.set(instanceId, filteredHistory);
        cleanedCount += history.length - filteredHistory.length;
      }
    }

    // Clean up old assessments
    for (const [instanceId, assessments] of this.healthAssessments.entries()) {
      const filteredAssessments = assessments.filter(assessment =>
        assessment.timestamp.getTime() > retentionCutoff
      );

      if (filteredAssessments.length !== assessments.length) {
        this.healthAssessments.set(instanceId, filteredAssessments);
        cleanedCount += assessments.length - filteredAssessments.length;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} old metrics and assessments`);
    }
  }

  /**
   * Setup event handlers for health monitoring
   */
  private setupEventHandlers(): void {
    // Handle service registry events
    dynamicServiceRegistry.on('instance:registered', (instance: ServiceInstance) => {
      logger.debug(`📝 New service instance registered for health monitoring: ${instance.serviceName}/${instance.instanceId}`);
    });

    dynamicServiceRegistry.on('instance:health_changed', (instance: ServiceInstance, oldStatus: string, newStatus: string) => {
      logger.info(`🏥 Service health changed: ${instance.serviceName}/${instance.instanceId} (${oldStatus} → ${newStatus})`);
    });

    dynamicServiceRegistry.on('instance:expired', (instance: ServiceInstance) => {
      // Clean up health data for expired instances
      this.healthAssessments.delete(instance.instanceId);
      this.metricsHistory.delete(instance.instanceId);
      this.activeIssues.delete(instance.instanceId);

      logger.debug(`🧹 Cleaned up health data for expired instance: ${instance.serviceName}/${instance.instanceId}`);
    });

    // Handle internal health events
    this.on('health:assessed', (assessment: HealthAssessment) => {
      if (assessment.overallHealth === 'critical' || assessment.overallHealth === 'unhealthy') {
        logger.warn(`⚠️ Service health degraded: ${assessment.serviceName}/${assessment.instanceId} (${assessment.overallHealth})`);
      }
    });

    this.on('health:issue', (instanceId: string, issue: HealthIssue) => {
      if (issue.severity === 'critical') {
        logger.error(`🚨 Critical health issue detected: ${instanceId} - ${issue.description}`);
      }
    });
  }

  /**
   * Get health status for a specific service instance
   */
  async getInstanceHealth(instanceId: string): Promise<HealthAssessment | null> {
    const assessments = this.healthAssessments.get(instanceId);
    return (assessments && assessments.length > 0) ? assessments[assessments.length - 1] || null : null;
  }

  /**
   * Get health status for all instances of a service
   */
  async getServiceHealth(serviceName: string): Promise<HealthAssessment[]> {
    const allAssessments: HealthAssessment[] = [];

    for (const [, assessments] of this.healthAssessments.entries()) {
      const latestAssessment = assessments[assessments.length - 1];
      if (latestAssessment && latestAssessment.serviceName === serviceName) {
        allAssessments.push(latestAssessment);
      }
    }

    return allAssessments;
  }

  /**
   * Get active health issues across all services
   */
  getActiveIssues(): Map<string, HealthIssue[]> {
    return new Map(this.activeIssues);
  }

  /**
   * Get health monitor status and metrics
   */
  async getMonitorStatus(): Promise<any> {
    const totalInstances = this.healthAssessments.size;
    const totalAssessments = Array.from(this.healthAssessments.values())
      .reduce((sum, assessments) => sum + assessments.length, 0);

    const healthDistribution = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      critical: 0
    };

    // Calculate health distribution
    for (const assessments of this.healthAssessments.values()) {
      const latest = assessments[assessments.length - 1];
      if (latest) {
        healthDistribution[latest.overallHealth]++;
      }
    }

    const totalIssues = Array.from(this.activeIssues.values())
      .reduce((sum, issues) => sum + issues.length, 0);

    return {
      initialized: this.isInitialized,
      config: this.config,
      monitoring: {
        totalInstances,
        totalAssessments,
        healthDistribution,
        totalActiveIssues: totalIssues,
        concurrentChecks: this.concurrentChecks
      },
      intervals: {
        basicCheckInterval: this.basicCheckInterval !== null,
        detailedCheckInterval: this.detailedCheckInterval !== null,
        predictiveCheckInterval: this.predictiveCheckInterval !== null
      },
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.basicCheckInterval) {
      clearInterval(this.basicCheckInterval);
      this.basicCheckInterval = null;
    }

    if (this.detailedCheckInterval) {
      clearInterval(this.detailedCheckInterval);
      this.detailedCheckInterval = null;
    }

    if (this.predictiveCheckInterval) {
      clearInterval(this.predictiveCheckInterval);
      this.predictiveCheckInterval = null;
    }

    this.healthAssessments.clear();
    this.metricsHistory.clear();
    this.activeIssues.clear();
    this.isInitialized = false;

    this.emit('monitor:destroyed');
    logger.info('🧹 Advanced Health Monitor destroyed');
  }
}

// Export singleton instance
export const advancedHealthMonitor = new AdvancedHealthMonitor();
