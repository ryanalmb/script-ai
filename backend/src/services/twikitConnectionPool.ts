/**
 * Advanced Twikit Connection Pool Management System
 * 
 * Provides intelligent connection pooling, automatic scaling, and resource optimization
 * for high-volume Twitter automation operations using Twikit sessions.
 * 
 * Features:
 * - Dynamic connection pooling with intelligent scaling
 * - Priority-based resource allocation for campaigns
 * - Real-time performance monitoring and analytics
 * - Resource optimization (memory, CPU, network)
 * - Enterprise-grade monitoring and alerting
 * - Full integration with existing TwikitSessionManager
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { cacheManager } from '../lib/cache';
import { prisma } from '../lib/prisma';
import { TwikitSessionManager, TwikitSession, TwikitSessionOptions } from './twikitSessionManager';
import { EnterpriseWebSocketService } from './realTimeSync/webSocketService';
import { CampaignOrchestrator } from './campaignOrchestrator';
import { AdvancedAnalyticsService } from './analyticsService';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface ConnectionPoolConfig {
  // Pool Sizing Configuration
  minConnections: number;
  maxConnections: number;
  initialConnections: number;
  
  // Scaling Configuration
  scaleUpThreshold: number;        // Utilization % to trigger scale up
  scaleDownThreshold: number;      // Utilization % to trigger scale down
  scaleUpIncrement: number;        // Number of connections to add
  scaleDownIncrement: number;      // Number of connections to remove
  scalingCooldownMs: number;       // Cooldown between scaling operations
  
  // Resource Management
  maxIdleTimeMs: number;           // Max idle time before connection cleanup
  connectionTimeoutMs: number;     // Connection acquisition timeout
  healthCheckIntervalMs: number;   // Health check frequency
  resourceCheckIntervalMs: number; // Resource monitoring frequency
  
  // Performance Optimization
  enablePredictiveScaling: boolean;
  enableResourceOptimization: boolean;
  enableConnectionReuse: boolean;
  enablePriorityQueuing: boolean;
  
  // Monitoring and Alerting
  enableRealTimeMetrics: boolean;
  enablePerformanceAnalytics: boolean;
  enableAutomatedAlerting: boolean;
  metricsRetentionDays: number;
}

export interface PooledConnection {
  connectionId: string;
  session: TwikitSession;
  accountId: string;
  
  // Connection State
  isActive: boolean;
  isReserved: boolean;
  isHealthy: boolean;
  
  // Usage Tracking
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  totalUsageTime: number;
  
  // Priority and Reservation
  priority: ConnectionPriority;
  reservedFor?: string;           // Campaign ID or service identifier
  reservationExpiry?: Date;
  
  // Performance Metrics
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  
  // Resource Usage
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

export enum ConnectionPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
  EMERGENCY = 5
}

export interface ConnectionRequest {
  requestId: string;
  accountId: string;
  priority: ConnectionPriority;
  reservedFor?: string;
  timeoutMs?: number;
  requiredCapabilities?: string[];
  metadata?: Record<string, any>;
}

export interface PoolMetrics {
  // Pool Status
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  reservedConnections: number;
  unhealthyConnections: number;
  
  // Performance Metrics
  averageAcquisitionTime: number;
  averageResponseTime: number;
  throughputPerSecond: number;
  successRate: number;
  errorRate: number;
  
  // Resource Utilization
  memoryUtilization: number;
  cpuUtilization: number;
  networkUtilization: number;
  
  // Scaling Metrics
  scaleUpEvents: number;
  scaleDownEvents: number;
  lastScalingOperation: Date | null;
  
  // Queue Metrics
  queuedRequests: number;
  averageQueueTime: number;
  maxQueueTime: number;
  
  // Health Metrics
  healthChecksPassed: number;
  healthChecksFailed: number;
  lastHealthCheck: Date;
  
  timestamp: Date;
}

export interface ScalingDecision {
  action: 'SCALE_UP' | 'SCALE_DOWN' | 'NO_ACTION';
  reason: string;
  targetSize: number;
  confidence: number;
  predictedLoad?: number;
  resourceConstraints?: string[];
}

export interface ResourceOptimizationResult {
  optimizationId: string;
  timestamp: Date;
  
  // Memory Optimization
  memoryFreed: number;
  memoryOptimizations: string[];
  
  // CPU Optimization
  cpuSavings: number;
  cpuOptimizations: string[];
  
  // Network Optimization
  networkSavings: number;
  networkOptimizations: string[];
  
  // Connection Optimization
  connectionsOptimized: number;
  connectionOptimizations: string[];
  
  totalSavings: number;
  performanceImpact: number;
}

// ============================================================================
// POOLED CONNECTION CLASS
// ============================================================================

export class PooledTwikitConnection {
  private connection: PooledConnection;
  private sessionManager: TwikitSessionManager;
  private lastHealthCheck: Date;
  private performanceHistory: Array<{ timestamp: Date; responseTime: number; success: boolean }> = [];

  constructor(session: TwikitSession, sessionManager: TwikitSessionManager, priority: ConnectionPriority = ConnectionPriority.NORMAL) {
    this.sessionManager = sessionManager;
    this.lastHealthCheck = new Date();
    
    this.connection = {
      connectionId: `pool_${session.sessionId}_${Date.now()}`,
      session,
      accountId: session.accountId,
      
      isActive: true,
      isReserved: false,
      isHealthy: true,
      
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 0,
      totalUsageTime: 0,
      
      priority,
      
      averageResponseTime: 0,
      successRate: 1.0,
      errorCount: 0,
      
      memoryUsage: 0,
      cpuUsage: 0,
      networkLatency: 0
    };
  }

  /**
   * Execute action using this pooled connection
   */
  async executeAction(action: string, params: any = {}): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Update usage tracking
      this.connection.lastUsed = new Date();
      this.connection.usageCount++;
      
      // Execute action through session manager
      const result = await this.sessionManager.executeAction(this.connection.accountId, action, params);
      
      // Track performance
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime, true);
      
      return result;
      
    } catch (error) {
      // Track error
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime, false);
      this.connection.errorCount++;
      
      throw error;
    } finally {
      // Update total usage time
      this.connection.totalUsageTime += Date.now() - startTime;
    }
  }

  /**
   * Reserve connection for specific use
   */
  reserve(reservedFor: string, durationMs: number = 300000): boolean {
    if (this.connection.isReserved) {
      return false;
    }
    
    this.connection.isReserved = true;
    this.connection.reservedFor = reservedFor;
    this.connection.reservationExpiry = new Date(Date.now() + durationMs);
    
    return true;
  }

  /**
   * Release reservation
   */
  release(): void {
    this.connection.isReserved = false;
    delete this.connection.reservedFor;
    delete this.connection.reservationExpiry;
  }

  /**
   * Check if reservation has expired
   */
  isReservationExpired(): boolean {
    if (!this.connection.isReserved || !this.connection.reservationExpiry) {
      return false;
    }
    
    return new Date() > this.connection.reservationExpiry;
  }

  /**
   * Perform health check on connection
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      this.lastHealthCheck = new Date();
      
      // Check session health
      const session = this.connection.session;
      if (!session.isActive || !session.isAuthenticated) {
        this.connection.isHealthy = false;
        return false;
      }
      
      // Perform lightweight operation to verify connectivity
      await this.sessionManager.executeAction(this.connection.accountId, 'health_check');
      
      this.connection.isHealthy = true;
      return true;
      
    } catch (error) {
      logger.warn(`Health check failed for connection ${this.connection.connectionId}:`, error);
      this.connection.isHealthy = false;
      return false;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    // Add to performance history
    this.performanceHistory.push({
      timestamp: new Date(),
      responseTime,
      success
    });
    
    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
    
    // Calculate averages
    const recentHistory = this.performanceHistory.slice(-20); // Last 20 operations
    this.connection.averageResponseTime = recentHistory.reduce((sum, entry) => sum + entry.responseTime, 0) / recentHistory.length;
    this.connection.successRate = recentHistory.filter(entry => entry.success).length / recentHistory.length;
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): PooledConnection {
    return { ...this.connection };
  }

  /**
   * Check if connection is available for use
   */
  isAvailable(): boolean {
    return this.connection.isActive && 
           this.connection.isHealthy && 
           (!this.connection.isReserved || this.isReservationExpired());
  }

  /**
   * Get connection priority
   */
  getPriority(): ConnectionPriority {
    return this.connection.priority;
  }

  /**
   * Update connection priority
   */
  setPriority(priority: ConnectionPriority): void {
    this.connection.priority = priority;
  }

  /**
   * Get idle time in milliseconds
   */
  getIdleTime(): number {
    return Date.now() - this.connection.lastUsed.getTime();
  }

  /**
   * Destroy connection and cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      this.connection.isActive = false;

      // Close session if needed
      if (this.connection.session.isActive) {
        await this.sessionManager.closeSession(this.connection.accountId);
      }

      // Clear performance history
      this.performanceHistory = [];

      logger.debug(`Destroyed pooled connection ${this.connection.connectionId}`);

    } catch (error) {
      logger.error(`Error destroying connection ${this.connection.connectionId}:`, error);
    }
  }
}

// ============================================================================
// SCALING ENGINE CLASS
// ============================================================================

export class ConnectionPoolScalingEngine {
  private config: ConnectionPoolConfig;
  private lastScalingOperation: Date | null = null;
  private scalingHistory: Array<{ timestamp: Date; action: string; reason: string; targetSize: number }> = [];
  private loadHistory: Array<{ timestamp: Date; utilization: number; queueLength: number }> = [];

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
  }

  /**
   * Analyze current pool state and determine scaling decision
   */
  analyzeScalingNeeds(
    currentMetrics: PoolMetrics,
    currentPoolSize: number,
    queueLength: number
  ): ScalingDecision {
    const now = new Date();
    const utilization = currentMetrics.activeConnections / currentPoolSize;

    // Add to load history for predictive analysis
    this.loadHistory.push({
      timestamp: now,
      utilization,
      queueLength
    });

    // Keep only last 100 entries
    if (this.loadHistory.length > 100) {
      this.loadHistory = this.loadHistory.slice(-100);
    }

    // Check cooldown period
    if (this.lastScalingOperation &&
        (now.getTime() - this.lastScalingOperation.getTime()) < this.config.scalingCooldownMs) {
      return {
        action: 'NO_ACTION',
        reason: 'Scaling cooldown period active',
        targetSize: currentPoolSize,
        confidence: 1.0
      };
    }

    // Analyze scale up conditions
    if (this.shouldScaleUp(utilization, queueLength, currentPoolSize, currentMetrics)) {
      const targetSize = Math.min(
        currentPoolSize + this.config.scaleUpIncrement,
        this.config.maxConnections
      );

      return {
        action: 'SCALE_UP',
        reason: `High utilization (${(utilization * 100).toFixed(1)}%) and queue length (${queueLength})`,
        targetSize,
        confidence: this.calculateScalingConfidence('SCALE_UP', utilization, queueLength),
        predictedLoad: this.predictFutureLoad()
      };
    }

    // Analyze scale down conditions
    if (this.shouldScaleDown(utilization, queueLength, currentPoolSize, currentMetrics)) {
      const targetSize = Math.max(
        currentPoolSize - this.config.scaleDownIncrement,
        this.config.minConnections
      );

      return {
        action: 'SCALE_DOWN',
        reason: `Low utilization (${(utilization * 100).toFixed(1)}%) and no queue`,
        targetSize,
        confidence: this.calculateScalingConfidence('SCALE_DOWN', utilization, queueLength),
        predictedLoad: this.predictFutureLoad()
      };
    }

    return {
      action: 'NO_ACTION',
      reason: 'Pool size is optimal for current load',
      targetSize: currentPoolSize,
      confidence: 0.8
    };
  }

  /**
   * Determine if pool should scale up
   */
  private shouldScaleUp(
    utilization: number,
    queueLength: number,
    currentPoolSize: number,
    metrics: PoolMetrics
  ): boolean {
    // Scale up if utilization is high
    if (utilization >= this.config.scaleUpThreshold) {
      return true;
    }

    // Scale up if there's a queue and average acquisition time is high
    if (queueLength > 0 && metrics.averageAcquisitionTime > 1000) {
      return true;
    }

    // Scale up if error rate is high (might indicate overload)
    if (metrics.errorRate > 0.1) {
      return true;
    }

    // Predictive scaling: scale up if load is trending upward
    if (this.config.enablePredictiveScaling) {
      const predictedLoad = this.predictFutureLoad();
      if (predictedLoad > this.config.scaleUpThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine if pool should scale down
   */
  private shouldScaleDown(
    utilization: number,
    queueLength: number,
    currentPoolSize: number,
    metrics: PoolMetrics
  ): boolean {
    // Don't scale down if at minimum
    if (currentPoolSize <= this.config.minConnections) {
      return false;
    }

    // Don't scale down if there's a queue
    if (queueLength > 0) {
      return false;
    }

    // Scale down if utilization is consistently low
    if (utilization <= this.config.scaleDownThreshold) {
      // Check if utilization has been low for a sustained period
      const recentHistory = this.loadHistory.slice(-10);
      const avgRecentUtilization = recentHistory.reduce((sum, entry) => sum + entry.utilization, 0) / recentHistory.length;

      if (avgRecentUtilization <= this.config.scaleDownThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate confidence in scaling decision
   */
  private calculateScalingConfidence(action: string, utilization: number, queueLength: number): number {
    let confidence = 0.5;

    if (action === 'SCALE_UP') {
      // Higher confidence for scale up when utilization is very high
      if (utilization > 0.9) confidence += 0.4;
      else if (utilization > 0.8) confidence += 0.3;
      else if (utilization > 0.7) confidence += 0.2;

      // Higher confidence when there's a queue
      if (queueLength > 10) confidence += 0.3;
      else if (queueLength > 5) confidence += 0.2;
      else if (queueLength > 0) confidence += 0.1;

    } else if (action === 'SCALE_DOWN') {
      // Higher confidence for scale down when utilization is very low
      if (utilization < 0.2) confidence += 0.4;
      else if (utilization < 0.3) confidence += 0.3;
      else if (utilization < 0.4) confidence += 0.2;

      // Lower confidence if there's any queue
      if (queueLength > 0) confidence -= 0.3;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Predict future load based on historical data
   */
  private predictFutureLoad(): number {
    if (this.loadHistory.length < 5) {
      return 0.5; // Default prediction
    }

    // Simple linear trend analysis
    const recentHistory = this.loadHistory.slice(-20);
    if (recentHistory.length < 2) return 0.5;

    const timeSpan = recentHistory[recentHistory.length - 1]!.timestamp.getTime() - recentHistory[0]!.timestamp.getTime();

    if (timeSpan === 0) return recentHistory[recentHistory.length - 1]!.utilization;

    // Calculate trend
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    recentHistory.forEach((entry, index) => {
      const x = index;
      const y = entry.utilization;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const n = recentHistory.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict utilization 5 minutes ahead
    const futureX = n + 5;
    const predictedUtilization = slope * futureX + intercept;

    return Math.max(0, Math.min(1, predictedUtilization));
  }

  /**
   * Record scaling operation
   */
  recordScalingOperation(action: string, reason: string, targetSize: number): void {
    this.lastScalingOperation = new Date();

    this.scalingHistory.push({
      timestamp: this.lastScalingOperation,
      action,
      reason,
      targetSize
    });

    // Keep only last 50 scaling operations
    if (this.scalingHistory.length > 50) {
      this.scalingHistory = this.scalingHistory.slice(-50);
    }
  }

  /**
   * Get scaling history
   */
  getScalingHistory(): Array<{ timestamp: Date; action: string; reason: string; targetSize: number }> {
    return [...this.scalingHistory];
  }

  /**
   * Get load history
   */
  getLoadHistory(): Array<{ timestamp: Date; utilization: number; queueLength: number }> {
    return [...this.loadHistory];
  }
}

// ============================================================================
// RESOURCE OPTIMIZER CLASS
// ============================================================================

export class ConnectionPoolResourceOptimizer {
  private config: ConnectionPoolConfig;
  private optimizationHistory: ResourceOptimizationResult[] = [];

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
  }

  /**
   * Perform comprehensive resource optimization
   */
  async optimizeResources(
    connections: Map<string, PooledTwikitConnection>,
    metrics: PoolMetrics
  ): Promise<ResourceOptimizationResult> {
    const optimizationId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const result: ResourceOptimizationResult = {
      optimizationId,
      timestamp: new Date(),
      memoryFreed: 0,
      memoryOptimizations: [],
      cpuSavings: 0,
      cpuOptimizations: [],
      networkSavings: 0,
      networkOptimizations: [],
      connectionsOptimized: 0,
      connectionOptimizations: [],
      totalSavings: 0,
      performanceImpact: 0
    };

    try {
      // Memory optimization
      await this.optimizeMemoryUsage(connections, result);

      // CPU optimization
      await this.optimizeCpuUsage(connections, result);

      // Network optimization
      await this.optimizeNetworkUsage(connections, result);

      // Connection optimization
      await this.optimizeConnections(connections, result);

      // Calculate total savings and performance impact
      result.totalSavings = result.memoryFreed + result.cpuSavings + result.networkSavings;
      result.performanceImpact = this.calculatePerformanceImpact(result);

      // Store optimization result
      this.optimizationHistory.push(result);

      // Keep only last 100 optimization results
      if (this.optimizationHistory.length > 100) {
        this.optimizationHistory = this.optimizationHistory.slice(-100);
      }

      const duration = Date.now() - startTime;
      logger.info(`Resource optimization completed`, {
        optimizationId,
        duration,
        totalSavings: result.totalSavings,
        connectionsOptimized: result.connectionsOptimized
      });

      return result;

    } catch (error) {
      logger.error(`Resource optimization failed:`, error);
      throw error;
    }
  }

  /**
   * Optimize memory usage across connections
   */
  private async optimizeMemoryUsage(
    connections: Map<string, PooledTwikitConnection>,
    result: ResourceOptimizationResult
  ): Promise<void> {
    let memoryFreed = 0;
    const optimizations: string[] = [];

    for (const [connectionId, connection] of connections) {
      const connectionInfo = connection.getConnectionInfo();

      // Clean up idle connections with high memory usage
      if (connection.getIdleTime() > this.config.maxIdleTimeMs &&
          connectionInfo.memoryUsage > 50 * 1024 * 1024) { // 50MB threshold

        try {
          await connection.destroy();
          connections.delete(connectionId);

          memoryFreed += connectionInfo.memoryUsage;
          optimizations.push(`Cleaned up idle connection ${connectionId} (${Math.round(connectionInfo.memoryUsage / 1024 / 1024)}MB freed)`);
          result.connectionsOptimized++;

        } catch (error) {
          logger.warn(`Failed to cleanup connection ${connectionId}:`, error);
        }
      }

      // Force garbage collection on connections with high memory usage
      if (connectionInfo.memoryUsage > 100 * 1024 * 1024) { // 100MB threshold
        try {
          // Trigger garbage collection if available
          if (global.gc) {
            global.gc();
            optimizations.push(`Triggered GC for high memory connection ${connectionId}`);
          }
        } catch (error) {
          logger.warn(`Failed to trigger GC for connection ${connectionId}:`, error);
        }
      }
    }

    result.memoryFreed = memoryFreed;
    result.memoryOptimizations = optimizations;
  }

  /**
   * Optimize CPU usage across connections
   */
  private async optimizeCpuUsage(
    connections: Map<string, PooledTwikitConnection>,
    result: ResourceOptimizationResult
  ): Promise<void> {
    let cpuSavings = 0;
    const optimizations: string[] = [];

    for (const [connectionId, connection] of connections) {
      const connectionInfo = connection.getConnectionInfo();

      // Reduce priority of high CPU usage connections
      if (connectionInfo.cpuUsage > 80 && connectionInfo.priority > ConnectionPriority.LOW) {
        connection.setPriority(ConnectionPriority.LOW);
        cpuSavings += connectionInfo.cpuUsage * 0.1; // Estimated 10% savings
        optimizations.push(`Reduced priority for high CPU connection ${connectionId}`);
      }

      // Pause connections with excessive CPU usage
      if (connectionInfo.cpuUsage > 95 && connection.isAvailable()) {
        try {
          // Temporarily reserve to prevent new usage
          connection.reserve('cpu_optimization', 60000); // 1 minute
          cpuSavings += connectionInfo.cpuUsage * 0.5; // Estimated 50% savings
          optimizations.push(`Temporarily paused high CPU connection ${connectionId}`);
        } catch (error) {
          logger.warn(`Failed to pause connection ${connectionId}:`, error);
        }
      }
    }

    result.cpuSavings = cpuSavings;
    result.cpuOptimizations = optimizations;
  }

  /**
   * Optimize network usage across connections
   */
  private async optimizeNetworkUsage(
    connections: Map<string, PooledTwikitConnection>,
    result: ResourceOptimizationResult
  ): Promise<void> {
    let networkSavings = 0;
    const optimizations: string[] = [];

    // Group connections by network latency
    const connectionsByLatency = Array.from(connections.entries())
      .sort(([, a], [, b]) => a.getConnectionInfo().networkLatency - b.getConnectionInfo().networkLatency);

    // Optimize high-latency connections
    for (const [connectionId, connection] of connectionsByLatency) {
      const connectionInfo = connection.getConnectionInfo();

      // Close connections with very high latency
      if (connectionInfo.networkLatency > 5000 && // 5 seconds
          connection.getIdleTime() > 60000) { // Idle for 1 minute

        try {
          await connection.destroy();
          connections.delete(connectionId);

          networkSavings += connectionInfo.networkLatency;
          optimizations.push(`Closed high-latency connection ${connectionId} (${connectionInfo.networkLatency}ms)`);
          result.connectionsOptimized++;

        } catch (error) {
          logger.warn(`Failed to close high-latency connection ${connectionId}:`, error);
        }
      }

      // Reduce priority of moderate latency connections
      else if (connectionInfo.networkLatency > 2000 && // 2 seconds
               connectionInfo.priority > ConnectionPriority.LOW) {

        connection.setPriority(ConnectionPriority.LOW);
        networkSavings += connectionInfo.networkLatency * 0.1;
        optimizations.push(`Reduced priority for moderate-latency connection ${connectionId}`);
      }
    }

    result.networkSavings = networkSavings;
    result.networkOptimizations = optimizations;
  }

  /**
   * Optimize connection pool structure and usage
   */
  private async optimizeConnections(
    connections: Map<string, PooledTwikitConnection>,
    result: ResourceOptimizationResult
  ): Promise<void> {
    const optimizations: string[] = [];
    let connectionsOptimized = 0;

    // Clean up expired reservations
    for (const [connectionId, connection] of connections) {
      if (connection.isReservationExpired()) {
        connection.release();
        optimizations.push(`Released expired reservation for connection ${connectionId}`);
        connectionsOptimized++;
      }
    }

    // Identify and remove duplicate connections for same account
    const accountConnections = new Map<string, PooledTwikitConnection[]>();

    for (const [connectionId, connection] of connections) {
      const accountId = connection.getConnectionInfo().accountId;
      if (!accountConnections.has(accountId)) {
        accountConnections.set(accountId, []);
      }
      accountConnections.get(accountId)!.push(connection);
    }

    // Remove excess connections per account
    for (const [accountId, accountConns] of accountConnections) {
      if (accountConns.length > 3) { // Max 3 connections per account
        // Sort by usage and keep the most active ones
        accountConns.sort((a, b) => {
          const aInfo = a.getConnectionInfo();
          const bInfo = b.getConnectionInfo();
          return bInfo.usageCount - aInfo.usageCount;
        });

        // Remove excess connections
        const excessConnections = accountConns.slice(3);
        for (const connection of excessConnections) {
          if (connection.isAvailable()) {
            try {
              await connection.destroy();
              connections.delete(connection.getConnectionInfo().connectionId);
              connectionsOptimized++;
              optimizations.push(`Removed excess connection for account ${accountId}`);
            } catch (error) {
              logger.warn(`Failed to remove excess connection for account ${accountId}:`, error);
            }
          }
        }
      }
    }

    result.connectionsOptimized += connectionsOptimized;
    result.connectionOptimizations = optimizations;
  }

  /**
   * Calculate performance impact of optimizations
   */
  private calculatePerformanceImpact(result: ResourceOptimizationResult): number {
    // Calculate weighted performance impact
    let impact = 0;

    // Memory optimization impact (positive)
    impact += (result.memoryFreed / (1024 * 1024 * 1024)) * 10; // 10 points per GB freed

    // CPU optimization impact (positive)
    impact += result.cpuSavings * 0.1; // 0.1 points per CPU unit saved

    // Network optimization impact (positive)
    impact += (result.networkSavings / 1000) * 2; // 2 points per second saved

    // Connection optimization impact (positive)
    impact += result.connectionsOptimized * 5; // 5 points per connection optimized

    return Math.max(0, Math.min(100, impact)); // Normalize to 0-100 scale
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): ResourceOptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    totalOptimizations: number;
    totalMemoryFreed: number;
    totalCpuSavings: number;
    totalNetworkSavings: number;
    totalConnectionsOptimized: number;
    averagePerformanceImpact: number;
  } {
    const history = this.optimizationHistory;

    return {
      totalOptimizations: history.length,
      totalMemoryFreed: history.reduce((sum, opt) => sum + opt.memoryFreed, 0),
      totalCpuSavings: history.reduce((sum, opt) => sum + opt.cpuSavings, 0),
      totalNetworkSavings: history.reduce((sum, opt) => sum + opt.networkSavings, 0),
      totalConnectionsOptimized: history.reduce((sum, opt) => sum + opt.connectionsOptimized, 0),
      averagePerformanceImpact: history.length > 0
        ? history.reduce((sum, opt) => sum + opt.performanceImpact, 0) / history.length
        : 0
    };
  }
}

// ============================================================================
// MAIN CONNECTION POOL CLASS
// ============================================================================

/**
 * Advanced Twikit Connection Pool Management System
 *
 * Provides intelligent connection pooling, automatic scaling, and resource optimization
 * for high-volume Twitter automation operations.
 */
export class TwikitConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig;
  private sessionManager: TwikitSessionManager;
  private connections: Map<string, PooledTwikitConnection> = new Map();
  private requestQueue: Array<{ request: ConnectionRequest; resolve: (value: PooledTwikitConnection | PromiseLike<PooledTwikitConnection>) => void; reject: (reason?: any) => void; timestamp: Date }> = [];

  // Scaling and optimization engines
  private scalingEngine: ConnectionPoolScalingEngine;
  private resourceOptimizer: ConnectionPoolResourceOptimizer;

  // Integration services
  private webSocketService: EnterpriseWebSocketService | undefined;
  private campaignOrchestrator: CampaignOrchestrator | undefined;
  private analyticsService: AdvancedAnalyticsService | undefined;

  // Monitoring and metrics
  private metrics: PoolMetrics;
  private metricsHistory: PoolMetrics[] = [];
  private isInitialized: boolean = false;

  // Intervals and timers
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private resourceOptimizationInterval?: NodeJS.Timeout;
  private scalingAnalysisInterval?: NodeJS.Timeout;

  // Redis for coordination
  private redis: Redis;

  constructor(
    config: ConnectionPoolConfig,
    sessionManager: TwikitSessionManager,
    integrations?: {
      webSocketService?: EnterpriseWebSocketService;
      campaignOrchestrator?: CampaignOrchestrator;
      analyticsService?: AdvancedAnalyticsService;
    }
  ) {
    super();

    this.config = config;
    this.sessionManager = sessionManager;
    this.scalingEngine = new ConnectionPoolScalingEngine(config);
    this.resourceOptimizer = new ConnectionPoolResourceOptimizer(config);

    // Set up integrations
    this.webSocketService = integrations?.webSocketService;
    this.campaignOrchestrator = integrations?.campaignOrchestrator;
    this.analyticsService = integrations?.analyticsService;

    // Initialize Redis connection
    this.redis = cacheManager as any;

    // Initialize metrics
    this.metrics = this.createInitialMetrics();

    logger.info('TwikitConnectionPool created', {
      minConnections: config.minConnections,
      maxConnections: config.maxConnections,
      initialConnections: config.initialConnections
    });
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('TwikitConnectionPool already initialized');
      return;
    }

    const startTime = Date.now();

    try {
      logger.info('Initializing TwikitConnectionPool...');

      // Create initial connections
      await this.createInitialConnections();

      // Start monitoring and optimization tasks
      this.startMonitoringTasks();

      // Setup integration event handlers
      this.setupIntegrationHandlers();

      // Setup Redis coordination
      await this.setupRedisCoordination();

      this.isInitialized = true;

      const duration = Date.now() - startTime;
      logger.info('TwikitConnectionPool initialized successfully', {
        duration,
        initialConnections: this.connections.size,
        config: {
          minConnections: this.config.minConnections,
          maxConnections: this.config.maxConnections,
          enablePredictiveScaling: this.config.enablePredictiveScaling,
          enableResourceOptimization: this.config.enableResourceOptimization
        }
      });

      this.emit('initialized', { duration, connectionCount: this.connections.size });

    } catch (error) {
      logger.error('Failed to initialize TwikitConnectionPool:', error);
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquireConnection(request: ConnectionRequest): Promise<PooledTwikitConnection> {
    const startTime = Date.now();

    try {
      // Validate request
      this.validateConnectionRequest(request);

      // Try to get an available connection immediately
      const availableConnection = this.findAvailableConnection(request);
      if (availableConnection) {
        const acquisitionTime = Date.now() - startTime;
        this.updateAcquisitionMetrics(acquisitionTime, true);

        logger.debug(`Connection acquired immediately`, {
          requestId: request.requestId,
          connectionId: availableConnection.getConnectionInfo().connectionId,
          acquisitionTime
        });

        return availableConnection;
      }

      // No available connection, check if we can create a new one
      if (this.connections.size < this.config.maxConnections) {
        const newConnection = await this.createConnection(request.accountId, request.priority);
        if (newConnection) {
          const acquisitionTime = Date.now() - startTime;
          this.updateAcquisitionMetrics(acquisitionTime, true);

          logger.debug(`New connection created for request`, {
            requestId: request.requestId,
            connectionId: newConnection.getConnectionInfo().connectionId,
            acquisitionTime
          });

          return newConnection;
        }
      }

      // Queue the request and wait
      return await this.queueConnectionRequest(request, startTime);

    } catch (error) {
      const acquisitionTime = Date.now() - startTime;
      this.updateAcquisitionMetrics(acquisitionTime, false);

      logger.error(`Failed to acquire connection for request ${request.requestId}:`, error);
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(connection: PooledTwikitConnection): Promise<void> {
    try {
      const connectionInfo = connection.getConnectionInfo();

      // Release any reservation
      connection.release();

      // Process queued requests
      await this.processQueuedRequests();

      logger.debug(`Connection released`, {
        connectionId: connectionInfo.connectionId,
        accountId: connectionInfo.accountId,
        usageCount: connectionInfo.usageCount
      });

      this.emit('connectionReleased', connectionInfo);

    } catch (error) {
      logger.error(`Failed to release connection:`, error);
    }
  }

  /**
   * Reserve a connection for specific use (e.g., campaign)
   */
  async reserveConnection(
    accountId: string,
    reservedFor: string,
    priority: ConnectionPriority = ConnectionPriority.NORMAL,
    durationMs: number = 300000
  ): Promise<PooledTwikitConnection | null> {
    try {
      // Find best available connection for the account
      const connection = this.findBestConnectionForAccount(accountId, priority);

      if (connection && connection.reserve(reservedFor, durationMs)) {
        logger.info(`Connection reserved`, {
          connectionId: connection.getConnectionInfo().connectionId,
          accountId,
          reservedFor,
          durationMs
        });

        this.emit('connectionReserved', {
          connectionId: connection.getConnectionInfo().connectionId,
          accountId,
          reservedFor,
          durationMs
        });

        return connection;
      }

      return null;

    } catch (error) {
      logger.error(`Failed to reserve connection for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get pool status information
   */
  getPoolStatus(): {
    totalConnections: number;
    availableConnections: number;
    reservedConnections: number;
    queuedRequests: number;
    healthyConnections: number;
    connectionsByPriority: Record<string, number>;
    connectionsByAccount: Record<string, number>;
  } {
    const connectionsByPriority: Record<string, number> = {};
    const connectionsByAccount: Record<string, number> = {};
    let availableConnections = 0;
    let reservedConnections = 0;
    let healthyConnections = 0;

    for (const connection of this.connections.values()) {
      const info = connection.getConnectionInfo();

      // Count by priority
      const priorityName = ConnectionPriority[info.priority];
      connectionsByPriority[priorityName] = (connectionsByPriority[priorityName] || 0) + 1;

      // Count by account
      connectionsByAccount[info.accountId] = (connectionsByAccount[info.accountId] || 0) + 1;

      // Count availability
      if (connection.isAvailable()) availableConnections++;
      if (info.isReserved) reservedConnections++;
      if (info.isHealthy) healthyConnections++;
    }

    return {
      totalConnections: this.connections.size,
      availableConnections,
      reservedConnections,
      queuedRequests: this.requestQueue.length,
      healthyConnections,
      connectionsByPriority,
      connectionsByAccount
    };
  }

  /**
   * Shutdown the connection pool gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down TwikitConnectionPool...');

    try {
      // Clear intervals
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      if (this.metricsCollectionInterval) clearInterval(this.metricsCollectionInterval);
      if (this.resourceOptimizationInterval) clearInterval(this.resourceOptimizationInterval);
      if (this.scalingAnalysisInterval) clearInterval(this.scalingAnalysisInterval);

      // Reject all queued requests
      for (const queuedRequest of this.requestQueue) {
        queuedRequest.reject(new Error('Connection pool is shutting down'));
      }
      this.requestQueue = [];

      // Close all connections
      const connectionClosePromises = Array.from(this.connections.values()).map(
        connection => connection.destroy()
      );
      await Promise.allSettled(connectionClosePromises);

      this.connections.clear();
      this.isInitialized = false;

      logger.info('TwikitConnectionPool shutdown completed');
      this.emit('shutdown');

    } catch (error) {
      logger.error('Error during TwikitConnectionPool shutdown:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - INITIALIZATION AND SETUP
  // ============================================================================

  /**
   * Create initial connections for the pool
   */
  private async createInitialConnections(): Promise<void> {
    const connectionsToCreate = Math.max(this.config.minConnections, this.config.initialConnections);
    const creationPromises: Promise<void>[] = [];

    for (let i = 0; i < connectionsToCreate; i++) {
      creationPromises.push(this.createInitialConnection(i));
    }

    const results = await Promise.allSettled(creationPromises);
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - successful;

    if (failed > 0) {
      logger.warn(`Failed to create ${failed} initial connections, created ${successful}`);
    }

    logger.info(`Created ${successful} initial connections`);
  }

  /**
   * Create a single initial connection
   */
  private async createInitialConnection(index: number): Promise<void> {
    try {
      // For initial connections, we'll create generic connections
      // that can be used by any account when needed
      const accountId = `pool_initial_${index}`;

      // Create a basic session for the pool
      const sessionOptions: TwikitSessionOptions = {
        accountId,
        credentials: {
          username: `pool_user_${index}`,
          email: `pool_${index}@example.com`,
          password: 'placeholder'
        },
        enableHealthMonitoring: true,
        enableAntiDetection: this.config.enableResourceOptimization
      };

      // Note: In a real implementation, these would be actual account credentials
      // For now, we'll create placeholder sessions that can be reconfigured when needed
      const session = await this.sessionManager.createSession(sessionOptions);
      const pooledConnection = new PooledTwikitConnection(session, this.sessionManager);

      this.connections.set(pooledConnection.getConnectionInfo().connectionId, pooledConnection);

    } catch (error) {
      logger.error(`Failed to create initial connection ${index}:`, error);
      throw error;
    }
  }

  /**
   * Start monitoring and optimization tasks
   */
  private startMonitoringTasks(): void {
    // Health check interval
    if (this.config.healthCheckIntervalMs > 0) {
      this.healthCheckInterval = setInterval(
        () => this.performHealthChecks(),
        this.config.healthCheckIntervalMs
      );
    }

    // Metrics collection interval
    if (this.config.enableRealTimeMetrics) {
      this.metricsCollectionInterval = setInterval(
        () => this.collectMetrics(),
        Math.min(this.config.healthCheckIntervalMs, 30000) // At least every 30 seconds
      );
    }

    // Resource optimization interval
    if (this.config.enableResourceOptimization && this.config.resourceCheckIntervalMs > 0) {
      this.resourceOptimizationInterval = setInterval(
        () => this.performResourceOptimization(),
        this.config.resourceCheckIntervalMs
      );
    }

    // Scaling analysis interval
    if (this.config.enablePredictiveScaling) {
      this.scalingAnalysisInterval = setInterval(
        () => this.performScalingAnalysis(),
        Math.min(this.config.scalingCooldownMs / 2, 60000) // At least every minute
      );
    }

    logger.info('Monitoring tasks started', {
      healthCheckInterval: this.config.healthCheckIntervalMs,
      metricsCollection: this.config.enableRealTimeMetrics,
      resourceOptimization: this.config.enableResourceOptimization,
      scalingAnalysis: this.config.enablePredictiveScaling
    });
  }

  /**
   * Setup integration event handlers
   */
  private setupIntegrationHandlers(): void {
    // Campaign Orchestrator integration
    if (this.campaignOrchestrator) {
      this.campaignOrchestrator.on('campaignStarted', (data: any) => {
        this.handleCampaignStarted(data);
      });

      this.campaignOrchestrator.on('campaignPriorityChanged', (data: any) => {
        this.handleCampaignPriorityChanged(data);
      });

      this.campaignOrchestrator.on('emergencyStop', () => {
        this.handleEmergencyStop();
      });
    }

    // Analytics Service integration
    if (this.analyticsService) {
      // Send pool metrics to analytics service
      this.on('metricsCollected', (metrics: PoolMetrics) => {
        // Note: Analytics service integration would be implemented here
        logger.debug('Pool metrics sent to analytics service', metrics);
      });
    }

    // WebSocket Service integration
    if (this.webSocketService && this.config.enableRealTimeMetrics) {
      // Broadcast pool status updates
      this.on('metricsCollected', (metrics: PoolMetrics) => {
        this.broadcastPoolStatus(metrics);
      });

      this.on('connectionCreated', (connectionInfo: any) => {
        this.broadcastConnectionEvent('connection_created', connectionInfo);
      });

      this.on('connectionDestroyed', (connectionInfo: any) => {
        this.broadcastConnectionEvent('connection_destroyed', connectionInfo);
      });
    }
  }

  /**
   * Setup Redis coordination for multi-instance deployments
   */
  private async setupRedisCoordination(): Promise<void> {
    try {
      // Subscribe to pool coordination events
      await this.redis.subscribe('twikit_pool_coordination');

      // Handle coordination messages
      this.redis.on('message', (channel: string, message: string) => {
        if (channel === 'twikit_pool_coordination') {
          this.handleCoordinationMessage(JSON.parse(message));
        }
      });

      // Publish pool initialization
      await this.publishCoordinationMessage({
        type: 'pool_initialized',
        poolId: this.getPoolId(),
        timestamp: new Date(),
        connectionCount: this.connections.size
      });

      logger.info('Redis coordination setup completed');

    } catch (error) {
      logger.error('Failed to setup Redis coordination:', error);
      // Don't throw - coordination is optional
    }
  }

  /**
   * Create initial metrics object
   */
  private createInitialMetrics(): PoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      reservedConnections: 0,
      unhealthyConnections: 0,

      averageAcquisitionTime: 0,
      averageResponseTime: 0,
      throughputPerSecond: 0,
      successRate: 1.0,
      errorRate: 0,

      memoryUtilization: 0,
      cpuUtilization: 0,
      networkUtilization: 0,

      scaleUpEvents: 0,
      scaleDownEvents: 0,
      lastScalingOperation: null,

      queuedRequests: 0,
      averageQueueTime: 0,
      maxQueueTime: 0,

      healthChecksPassed: 0,
      healthChecksFailed: 0,
      lastHealthCheck: new Date(),

      timestamp: new Date()
    };
  }

  // ============================================================================
  // PRIVATE METHODS - CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Validate connection request
   */
  private validateConnectionRequest(request: ConnectionRequest): void {
    if (!request.requestId) {
      throw new Error('Connection request must have a requestId');
    }

    if (!request.accountId) {
      throw new Error('Connection request must have an accountId');
    }

    if (!Object.values(ConnectionPriority).includes(request.priority)) {
      throw new Error('Invalid connection priority');
    }
  }

  /**
   * Find available connection matching request criteria
   */
  private findAvailableConnection(request: ConnectionRequest): PooledTwikitConnection | null {
    const availableConnections = Array.from(this.connections.values())
      .filter(connection => connection.isAvailable())
      .sort((a, b) => {
        // Prioritize by:
        // 1. Same account ID (exact match)
        // 2. Higher priority connections
        // 3. Lower usage count (less used connections)
        // 4. Better performance (lower response time)

        const aInfo = a.getConnectionInfo();
        const bInfo = b.getConnectionInfo();

        // Same account preference
        const aAccountMatch = aInfo.accountId === request.accountId ? 1 : 0;
        const bAccountMatch = bInfo.accountId === request.accountId ? 1 : 0;
        if (aAccountMatch !== bAccountMatch) {
          return bAccountMatch - aAccountMatch;
        }

        // Priority preference
        if (aInfo.priority !== bInfo.priority) {
          return bInfo.priority - aInfo.priority;
        }

        // Usage count preference (less used first)
        if (aInfo.usageCount !== bInfo.usageCount) {
          return aInfo.usageCount - bInfo.usageCount;
        }

        // Performance preference (faster response time first)
        return aInfo.averageResponseTime - bInfo.averageResponseTime;
      });

    return availableConnections.length > 0 ? (availableConnections[0] || null) : null;
  }

  /**
   * Create a new connection for the pool
   */
  private async createConnection(
    accountId: string,
    priority: ConnectionPriority = ConnectionPriority.NORMAL
  ): Promise<PooledTwikitConnection | null> {
    try {
      // Check if we're at capacity
      if (this.connections.size >= this.config.maxConnections) {
        return null;
      }

      // Create session options
      const sessionOptions: TwikitSessionOptions = {
        accountId,
        credentials: {
          username: `pool_${accountId}`,
          email: `${accountId}@pool.local`,
          password: 'placeholder' // In real implementation, get from secure storage
        },
        enableHealthMonitoring: true,
        enableAntiDetection: this.config.enableResourceOptimization
      };

      // Create session through session manager
      const session = await this.sessionManager.createSession(sessionOptions);
      const pooledConnection = new PooledTwikitConnection(session, this.sessionManager, priority);

      // Add to pool
      const connectionId = pooledConnection.getConnectionInfo().connectionId;
      this.connections.set(connectionId, pooledConnection);

      logger.info(`Created new pooled connection`, {
        connectionId,
        accountId,
        priority: ConnectionPriority[priority],
        totalConnections: this.connections.size
      });

      this.emit('connectionCreated', pooledConnection.getConnectionInfo());

      return pooledConnection;

    } catch (error) {
      logger.error(`Failed to create connection for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Queue connection request and wait for availability
   */
  private async queueConnectionRequest(
    request: ConnectionRequest,
    startTime: number
  ): Promise<PooledTwikitConnection> {
    return new Promise((resolve, reject) => {
      const timeout = request.timeoutMs || this.config.connectionTimeoutMs;

      // Add to queue with priority sorting
      const queueEntry = {
        request,
        resolve,
        reject,
        timestamp: new Date()
      };

      // Insert in priority order
      let insertIndex = this.requestQueue.length;
      for (let i = 0; i < this.requestQueue.length; i++) {
        const queueItem = this.requestQueue[i];
        if (queueItem && queueItem.request.priority < request.priority) {
          insertIndex = i;
          break;
        }
      }

      this.requestQueue.splice(insertIndex, 0, queueEntry);

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        // Remove from queue
        const index = this.requestQueue.indexOf(queueEntry);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
        }

        const acquisitionTime = Date.now() - startTime;
        this.updateAcquisitionMetrics(acquisitionTime, false);

        reject(new Error(`Connection request timeout after ${timeout}ms`));
      }, timeout);

      // Override resolve to clear timeout
      const originalResolve = resolve;
      queueEntry.resolve = (connection: PooledTwikitConnection | PromiseLike<PooledTwikitConnection>) => {
        clearTimeout(timeoutHandle);
        const acquisitionTime = Date.now() - startTime;
        this.updateAcquisitionMetrics(acquisitionTime, true);
        originalResolve(connection);
      };

      // Override reject to clear timeout
      const originalReject = reject;
      queueEntry.reject = (error: Error) => {
        clearTimeout(timeoutHandle);
        const acquisitionTime = Date.now() - startTime;
        this.updateAcquisitionMetrics(acquisitionTime, false);
        originalReject(error);
      };

      logger.debug(`Connection request queued`, {
        requestId: request.requestId,
        queuePosition: insertIndex,
        queueLength: this.requestQueue.length,
        priority: ConnectionPriority[request.priority]
      });
    });
  }

  /**
   * Process queued connection requests
   */
  private async processQueuedRequests(): Promise<void> {
    if (this.requestQueue.length === 0) {
      return;
    }

    // Process requests in priority order
    const processedRequests: number[] = [];

    for (let i = 0; i < this.requestQueue.length; i++) {
      const queueEntry = this.requestQueue[i];
      if (!queueEntry) continue;

      // Try to find available connection
      const availableConnection = this.findAvailableConnection(queueEntry.request);
      if (availableConnection) {
        queueEntry.resolve(availableConnection);
        processedRequests.push(i);
        continue;
      }

      // Try to create new connection if under capacity
      if (this.connections.size < this.config.maxConnections) {
        const newConnection = await this.createConnection(
          queueEntry.request.accountId,
          queueEntry.request.priority
        );

        if (newConnection) {
          queueEntry.resolve(newConnection);
          processedRequests.push(i);
          continue;
        }
      }

      // If we can't fulfill high-priority requests, stop processing
      if (queueEntry.request.priority >= ConnectionPriority.HIGH) {
        break;
      }
    }

    // Remove processed requests (in reverse order to maintain indices)
    for (let i = processedRequests.length - 1; i >= 0; i--) {
      const indexToRemove = processedRequests[i];
      if (indexToRemove !== undefined) {
        this.requestQueue.splice(indexToRemove, 1);
      }
    }

    if (processedRequests.length > 0) {
      logger.debug(`Processed ${processedRequests.length} queued requests, ${this.requestQueue.length} remaining`);
    }
  }

  /**
   * Find best connection for specific account
   */
  private findBestConnectionForAccount(
    accountId: string,
    priority: ConnectionPriority
  ): PooledTwikitConnection | undefined {
    const accountConnections = Array.from(this.connections.values())
      .filter(connection => {
        const info = connection.getConnectionInfo();
        return info.accountId === accountId &&
               connection.isAvailable() &&
               info.priority >= priority;
      })
      .sort((a, b) => {
        const aInfo = a.getConnectionInfo();
        const bInfo = b.getConnectionInfo();

        // Prefer higher priority, then better performance
        if (aInfo.priority !== bInfo.priority) {
          return bInfo.priority - aInfo.priority;
        }

        return aInfo.averageResponseTime - bInfo.averageResponseTime;
      });

    return accountConnections.length > 0 ? accountConnections[0] : undefined;
  }

  /**
   * Update acquisition metrics
   */
  private updateAcquisitionMetrics(acquisitionTime: number, success: boolean): void {
    // Update running averages
    const alpha = 0.1; // Smoothing factor
    this.metrics.averageAcquisitionTime =
      this.metrics.averageAcquisitionTime * (1 - alpha) + acquisitionTime * alpha;

    if (success) {
      this.metrics.successRate = this.metrics.successRate * (1 - alpha) + 1 * alpha;
    } else {
      this.metrics.successRate = this.metrics.successRate * (1 - alpha) + 0 * alpha;
      this.metrics.errorRate = this.metrics.errorRate * (1 - alpha) + 1 * alpha;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - MONITORING AND OPTIMIZATION
  // ============================================================================

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const healthCheckPromises = Array.from(this.connections.values()).map(
        async (connection) => {
          try {
            const isHealthy = await connection.performHealthCheck();
            return { connection, isHealthy };
          } catch (error) {
            logger.warn(`Health check failed for connection ${connection.getConnectionInfo().connectionId}:`, error);
            return { connection, isHealthy: false };
          }
        }
      );

      const results = await Promise.allSettled(healthCheckPromises);
      let healthyCount = 0;
      let unhealthyCount = 0;
      const unhealthyConnections: PooledTwikitConnection[] = [];

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.isHealthy) {
            healthyCount++;
          } else {
            unhealthyCount++;
            unhealthyConnections.push(result.value.connection);
          }
        } else {
          unhealthyCount++;
        }
      }

      // Update metrics
      this.metrics.healthChecksPassed = healthyCount;
      this.metrics.healthChecksFailed = unhealthyCount;
      this.metrics.lastHealthCheck = new Date();

      // Remove unhealthy connections
      for (const unhealthyConnection of unhealthyConnections) {
        await this.removeUnhealthyConnection(unhealthyConnection);
      }

      logger.debug(`Health check completed`, {
        healthy: healthyCount,
        unhealthy: unhealthyCount,
        removed: unhealthyConnections.length
      });

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Remove unhealthy connection from pool
   */
  private async removeUnhealthyConnection(connection: PooledTwikitConnection): Promise<void> {
    try {
      const connectionInfo = connection.getConnectionInfo();

      // Remove from pool
      this.connections.delete(connectionInfo.connectionId);

      // Destroy connection
      await connection.destroy();

      logger.info(`Removed unhealthy connection`, {
        connectionId: connectionInfo.connectionId,
        accountId: connectionInfo.accountId,
        remainingConnections: this.connections.size
      });

      this.emit('connectionDestroyed', connectionInfo);

      // Try to create replacement if below minimum
      if (this.connections.size < this.config.minConnections) {
        await this.createConnection(connectionInfo.accountId, connectionInfo.priority);
      }

    } catch (error) {
      logger.error(`Failed to remove unhealthy connection:`, error);
    }
  }

  /**
   * Collect comprehensive pool metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const now = new Date();
      let activeConnections = 0;
      let idleConnections = 0;
      let reservedConnections = 0;
      let unhealthyConnections = 0;
      let totalResponseTime = 0;
      let totalMemoryUsage = 0;
      let totalCpuUsage = 0;
      let totalNetworkLatency = 0;

      // Collect connection-level metrics
      for (const connection of this.connections.values()) {
        const info = connection.getConnectionInfo();

        if (info.isReserved) reservedConnections++;
        if (!info.isHealthy) unhealthyConnections++;
        if (connection.isAvailable()) idleConnections++;
        else activeConnections++;

        totalResponseTime += info.averageResponseTime;
        totalMemoryUsage += info.memoryUsage;
        totalCpuUsage += info.cpuUsage;
        totalNetworkLatency += info.networkLatency;
      }

      // Calculate queue metrics
      let totalQueueTime = 0;
      let maxQueueTime = 0;

      for (const queueEntry of this.requestQueue) {
        const queueTime = now.getTime() - queueEntry.timestamp.getTime();
        totalQueueTime += queueTime;
        maxQueueTime = Math.max(maxQueueTime, queueTime);
      }

      // Update metrics
      this.metrics.totalConnections = this.connections.size;
      this.metrics.activeConnections = activeConnections;
      this.metrics.idleConnections = idleConnections;
      this.metrics.reservedConnections = reservedConnections;
      this.metrics.unhealthyConnections = unhealthyConnections;

      this.metrics.averageResponseTime = this.connections.size > 0
        ? totalResponseTime / this.connections.size
        : 0;

      this.metrics.memoryUtilization = this.connections.size > 0
        ? totalMemoryUsage / this.connections.size
        : 0;

      this.metrics.cpuUtilization = this.connections.size > 0
        ? totalCpuUsage / this.connections.size
        : 0;

      this.metrics.networkUtilization = this.connections.size > 0
        ? totalNetworkLatency / this.connections.size
        : 0;

      this.metrics.queuedRequests = this.requestQueue.length;
      this.metrics.averageQueueTime = this.requestQueue.length > 0
        ? totalQueueTime / this.requestQueue.length
        : 0;
      this.metrics.maxQueueTime = maxQueueTime;

      this.metrics.timestamp = now;

      // Store metrics history
      this.metricsHistory.push({ ...this.metrics });

      // Keep only last 1000 metrics entries
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }

      this.emit('metricsCollected', this.metrics);

    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  /**
   * Perform resource optimization
   */
  private async performResourceOptimization(): Promise<void> {
    try {
      const optimizationResult = await this.resourceOptimizer.optimizeResources(
        this.connections,
        this.metrics
      );

      logger.info(`Resource optimization completed`, {
        optimizationId: optimizationResult.optimizationId,
        totalSavings: optimizationResult.totalSavings,
        connectionsOptimized: optimizationResult.connectionsOptimized,
        performanceImpact: optimizationResult.performanceImpact
      });

      this.emit('resourceOptimized', optimizationResult);

    } catch (error) {
      logger.error('Resource optimization failed:', error);
    }
  }

  /**
   * Perform scaling analysis and execute scaling decisions
   */
  private async performScalingAnalysis(): Promise<void> {
    try {
      const scalingDecision = this.scalingEngine.analyzeScalingNeeds(
        this.metrics,
        this.connections.size,
        this.requestQueue.length
      );

      if (scalingDecision.action !== 'NO_ACTION') {
        await this.executeScalingDecision(scalingDecision);
      }

    } catch (error) {
      logger.error('Scaling analysis failed:', error);
    }
  }

  /**
   * Execute scaling decision
   */
  private async executeScalingDecision(decision: ScalingDecision): Promise<void> {
    try {
      const currentSize = this.connections.size;
      const targetSize = decision.targetSize;

      logger.info(`Executing scaling decision`, {
        action: decision.action,
        reason: decision.reason,
        currentSize,
        targetSize,
        confidence: decision.confidence
      });

      if (decision.action === 'SCALE_UP') {
        await this.scaleUp(targetSize - currentSize);
        this.metrics.scaleUpEvents++;
      } else if (decision.action === 'SCALE_DOWN') {
        await this.scaleDown(currentSize - targetSize);
        this.metrics.scaleDownEvents++;
      }

      this.metrics.lastScalingOperation = new Date();

      // Record scaling operation
      this.scalingEngine.recordScalingOperation(
        decision.action,
        decision.reason,
        targetSize
      );

      this.emit('scalingExecuted', {
        action: decision.action,
        reason: decision.reason,
        previousSize: currentSize,
        newSize: this.connections.size,
        confidence: decision.confidence
      });

    } catch (error) {
      logger.error(`Failed to execute scaling decision:`, error);
    }
  }

  /**
   * Scale up the connection pool
   */
  private async scaleUp(connectionsToAdd: number): Promise<void> {
    const creationPromises: Promise<void>[] = [];

    for (let i = 0; i < connectionsToAdd; i++) {
      creationPromises.push(this.createScaleUpConnection(i));
    }

    const results = await Promise.allSettled(creationPromises);
    const successful = results.filter(result => result.status === 'fulfilled').length;

    logger.info(`Scale up completed`, {
      requested: connectionsToAdd,
      created: successful,
      totalConnections: this.connections.size
    });
  }

  /**
   * Create connection for scale up operation
   */
  private async createScaleUpConnection(index: number): Promise<void> {
    try {
      const accountId = `scale_up_${Date.now()}_${index}`;
      await this.createConnection(accountId, ConnectionPriority.NORMAL);
    } catch (error) {
      logger.error(`Failed to create scale up connection ${index}:`, error);
      throw error;
    }
  }

  /**
   * Scale down the connection pool
   */
  private async scaleDown(connectionsToRemove: number): Promise<void> {
    // Find connections to remove (prefer idle, low-priority connections)
    const candidatesForRemoval = Array.from(this.connections.values())
      .filter(connection => connection.isAvailable() && !connection.getConnectionInfo().isReserved)
      .sort((a, b) => {
        const aInfo = a.getConnectionInfo();
        const bInfo = b.getConnectionInfo();

        // Prefer removing connections with:
        // 1. Lower priority
        // 2. Longer idle time
        // 3. Lower usage count

        if (aInfo.priority !== bInfo.priority) {
          return aInfo.priority - bInfo.priority;
        }

        const aIdleTime = a.getIdleTime();
        const bIdleTime = b.getIdleTime();
        if (aIdleTime !== bIdleTime) {
          return bIdleTime - aIdleTime;
        }

        return aInfo.usageCount - bInfo.usageCount;
      })
      .slice(0, connectionsToRemove);

    // Remove selected connections
    const removalPromises = candidatesForRemoval.map(async (connection) => {
      try {
        const connectionInfo = connection.getConnectionInfo();
        this.connections.delete(connectionInfo.connectionId);
        await connection.destroy();

        logger.debug(`Removed connection during scale down`, {
          connectionId: connectionInfo.connectionId,
          accountId: connectionInfo.accountId
        });

        this.emit('connectionDestroyed', connectionInfo);

      } catch (error) {
        logger.error(`Failed to remove connection during scale down:`, error);
      }
    });

    await Promise.allSettled(removalPromises);

    logger.info(`Scale down completed`, {
      requested: connectionsToRemove,
      removed: candidatesForRemoval.length,
      totalConnections: this.connections.size
    });
  }

  // ============================================================================
  // PRIVATE METHODS - INTEGRATION HANDLERS
  // ============================================================================

  /**
   * Handle campaign started event
   */
  private async handleCampaignStarted(data: any): Promise<void> {
    try {
      const { campaignId, accountIds, priority } = data;

      logger.info(`Handling campaign started`, {
        campaignId,
        accountIds: accountIds?.length || 0,
        priority
      });

      // Reserve connections for campaign accounts
      const reservationPromises = (accountIds || []).map(async (accountId: string) => {
        const connection = await this.reserveConnection(
          accountId,
          campaignId,
          priority || ConnectionPriority.HIGH,
          3600000 // 1 hour reservation
        );

        if (connection) {
          logger.debug(`Reserved connection for campaign`, {
            campaignId,
            accountId,
            connectionId: connection.getConnectionInfo().connectionId
          });
        }

        return connection;
      });

      const reservedConnections = await Promise.allSettled(reservationPromises);
      const successfulReservations = reservedConnections.filter(
        result => result.status === 'fulfilled' && result.value !== null
      ).length;

      logger.info(`Campaign connection reservations completed`, {
        campaignId,
        requested: accountIds?.length || 0,
        reserved: successfulReservations
      });

    } catch (error) {
      logger.error(`Failed to handle campaign started event:`, error);
    }
  }

  /**
   * Handle campaign priority changed event
   */
  private async handleCampaignPriorityChanged(data: any): Promise<void> {
    try {
      const { campaignId, newPriority } = data;

      logger.info(`Handling campaign priority change`, {
        campaignId,
        newPriority
      });

      // Update priority for all connections reserved for this campaign
      let updatedConnections = 0;

      for (const connection of this.connections.values()) {
        const info = connection.getConnectionInfo();
        if (info.reservedFor === campaignId) {
          connection.setPriority(newPriority);
          updatedConnections++;
        }
      }

      logger.info(`Campaign priority update completed`, {
        campaignId,
        newPriority,
        updatedConnections
      });

    } catch (error) {
      logger.error(`Failed to handle campaign priority change:`, error);
    }
  }

  /**
   * Handle emergency stop event
   */
  private async handleEmergencyStop(): Promise<void> {
    try {
      logger.warn('Handling emergency stop - pausing all non-critical connections');

      // Pause all non-critical connections
      let pausedConnections = 0;

      for (const connection of this.connections.values()) {
        const info = connection.getConnectionInfo();
        if (info.priority < ConnectionPriority.CRITICAL) {
          // Reserve connection to prevent new usage
          if (connection.reserve('emergency_stop', 300000)) { // 5 minutes
            pausedConnections++;
          }
        }
      }

      // Reject all queued requests except critical ones
      const criticalRequests = this.requestQueue.filter(
        entry => entry.request.priority >= ConnectionPriority.CRITICAL
      );

      const rejectedRequests = this.requestQueue.filter(
        entry => entry.request.priority < ConnectionPriority.CRITICAL
      );

      for (const entry of rejectedRequests) {
        entry.reject(new Error('Emergency stop activated - non-critical requests rejected'));
      }

      this.requestQueue = criticalRequests;

      logger.warn(`Emergency stop completed`, {
        pausedConnections,
        rejectedRequests: rejectedRequests.length,
        remainingQueue: this.requestQueue.length
      });

      this.emit('emergencyStop', {
        pausedConnections,
        rejectedRequests: rejectedRequests.length
      });

    } catch (error) {
      logger.error('Failed to handle emergency stop:', error);
    }
  }

  /**
   * Handle coordination message from other pool instances
   */
  private handleCoordinationMessage(message: any): void {
    try {
      const { type, poolId, data } = message;

      // Ignore messages from this pool instance
      if (poolId === this.getPoolId()) {
        return;
      }

      switch (type) {
        case 'pool_initialized':
          logger.info(`Another pool instance initialized`, { poolId, connectionCount: data?.connectionCount });
          break;

        case 'scaling_event':
          logger.debug(`Scaling event from another pool`, { poolId, action: data?.action, size: data?.size });
          break;

        case 'resource_alert':
          logger.warn(`Resource alert from another pool`, { poolId, alert: data?.alert });
          break;

        default:
          logger.debug(`Unknown coordination message type: ${type}`, { poolId });
      }

    } catch (error) {
      logger.error('Failed to handle coordination message:', error);
    }
  }

  /**
   * Broadcast pool status via WebSocket
   */
  private async broadcastPoolStatus(metrics: PoolMetrics): Promise<void> {
    if (!this.webSocketService) {
      return;
    }

    try {
      const poolStatus = {
        type: 'pool_status_update',
        poolId: this.getPoolId(),
        timestamp: new Date(),
        metrics,
        status: this.getPoolStatus()
      };

      // Broadcast to all connected clients
      // Note: WebSocket broadcast would be implemented here
      logger.debug('Broadcasting pool status update', poolStatus);

    } catch (error) {
      logger.error('Failed to broadcast pool status:', error);
    }
  }

  /**
   * Broadcast connection event via WebSocket
   */
  private async broadcastConnectionEvent(eventType: string, connectionInfo: any): Promise<void> {
    if (!this.webSocketService) {
      return;
    }

    try {
      const connectionEvent = {
        type: eventType,
        poolId: this.getPoolId(),
        timestamp: new Date(),
        connectionInfo
      };

      // Note: WebSocket broadcast would be implemented here
      logger.debug(`Broadcasting connection event: ${eventType}`, connectionEvent);

    } catch (error) {
      logger.error(`Failed to broadcast connection event ${eventType}:`, error);
    }
  }

  /**
   * Publish coordination message to other pool instances
   */
  private async publishCoordinationMessage(message: any): Promise<void> {
    try {
      const coordinationMessage = {
        ...message,
        poolId: this.getPoolId()
      };

      await this.redis.publish('twikit_pool_coordination', JSON.stringify(coordinationMessage));

    } catch (error) {
      logger.error('Failed to publish coordination message:', error);
    }
  }

  /**
   * Get unique pool identifier
   */
  private getPoolId(): string {
    return `pool_${process.pid}_${Date.now()}`;
  }
}

// ============================================================================
// CONNECTION POOL MANAGER CLASS
// ============================================================================

/**
 * High-level Connection Pool Manager
 * Manages multiple connection pools and provides unified interface
 */
export class TwikitConnectionPoolManager extends EventEmitter {
  private pools: Map<string, TwikitConnectionPool> = new Map();
  private defaultPool: TwikitConnectionPool | undefined;
  private sessionManager: TwikitSessionManager;

  constructor(sessionManager: TwikitSessionManager) {
    super();
    this.sessionManager = sessionManager;
  }

  /**
   * Create and register a connection pool
   */
  async createPool(
    poolName: string,
    config: ConnectionPoolConfig,
    integrations?: {
      webSocketService?: EnterpriseWebSocketService;
      campaignOrchestrator?: CampaignOrchestrator;
      analyticsService?: AdvancedAnalyticsService;
    }
  ): Promise<TwikitConnectionPool> {
    if (this.pools.has(poolName)) {
      throw new Error(`Pool ${poolName} already exists`);
    }

    const pool = new TwikitConnectionPool(config, this.sessionManager, integrations);
    await pool.initialize();

    this.pools.set(poolName, pool);

    // Set as default if it's the first pool
    if (!this.defaultPool) {
      this.defaultPool = pool;
    }

    logger.info(`Created connection pool`, { poolName, totalPools: this.pools.size });

    return pool;
  }

  /**
   * Get connection pool by name
   */
  getPool(poolName?: string): TwikitConnectionPool | undefined {
    if (!poolName) {
      return this.defaultPool;
    }
    return this.pools.get(poolName);
  }

  /**
   * Acquire connection from specified or default pool
   */
  async acquireConnection(request: ConnectionRequest, poolName?: string): Promise<PooledTwikitConnection> {
    const pool = this.getPool(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName || 'default'} not found`);
    }

    return await pool.acquireConnection(request);
  }

  /**
   * Get aggregated metrics from all pools
   */
  getAggregatedMetrics(): {
    totalPools: number;
    totalConnections: number;
    totalActiveConnections: number;
    totalQueuedRequests: number;
    poolMetrics: Record<string, PoolMetrics>;
  } {
    const poolMetrics: Record<string, PoolMetrics> = {};
    let totalConnections = 0;
    let totalActiveConnections = 0;
    let totalQueuedRequests = 0;

    for (const [poolName, pool] of this.pools) {
      const metrics = pool.getMetrics();
      poolMetrics[poolName] = metrics;
      totalConnections += metrics.totalConnections;
      totalActiveConnections += metrics.activeConnections;
      totalQueuedRequests += metrics.queuedRequests;
    }

    return {
      totalPools: this.pools.size,
      totalConnections,
      totalActiveConnections,
      totalQueuedRequests,
      poolMetrics
    };
  }

  /**
   * Shutdown all pools
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all connection pools...');

    const shutdownPromises = Array.from(this.pools.values()).map(pool => pool.shutdown());
    await Promise.allSettled(shutdownPromises);

    this.pools.clear();
    this.defaultPool = undefined;

    logger.info('All connection pools shut down');
  }
}

// ============================================================================
// EXPORTS AND SINGLETON
// ============================================================================

// Default configuration
export const DEFAULT_CONNECTION_POOL_CONFIG: ConnectionPoolConfig = {
  minConnections: 5,
  maxConnections: 50,
  initialConnections: 10,

  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.3,
  scaleUpIncrement: 5,
  scaleDownIncrement: 2,
  scalingCooldownMs: 60000,

  maxIdleTimeMs: 300000,
  connectionTimeoutMs: 30000,
  healthCheckIntervalMs: 60000,
  resourceCheckIntervalMs: 300000,

  enablePredictiveScaling: true,
  enableResourceOptimization: true,
  enableConnectionReuse: true,
  enablePriorityQueuing: true,

  enableRealTimeMetrics: true,
  enablePerformanceAnalytics: true,
  enableAutomatedAlerting: true,
  metricsRetentionDays: 7
};

// Singleton instance
export const twikitConnectionPoolManager = new TwikitConnectionPoolManager(
  require('./twikitSessionManager').twikitSessionManager
);
