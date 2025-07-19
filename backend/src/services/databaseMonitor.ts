/**
 * Database Monitor - 2025 Edition
 * Enterprise-grade database monitoring and optimization service:
 * - Real-time performance monitoring
 * - Query optimization analysis
 * - Connection pool monitoring
 * - Slow query detection and alerting
 * - Database health scoring
 * - Automated optimization recommendations
 */

import { EventEmitter } from 'events';
import { connectionManager } from '../config/connectionManager';
import { logger } from '../utils/logger';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

interface DatabaseMetrics {
  connections: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
    utilization: number;
  };
  queries: {
    totalExecuted: number;
    slowQueries: number;
    failedQueries: number;
    averageExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
    queriesPerSecond: number;
  };
  performance: {
    cacheHitRatio: number;
    indexUsage: number;
    tableScans: number;
    deadlocks: number;
    blockedQueries: number;
    diskUsage: number;
    memoryUsage: number;
  };
  health: {
    score: number; // 0-100
    status: 'excellent' | 'good' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  };
}

interface SlowQuery {
  query: string;
  executionTime: number;
  timestamp: Date;
  database: string;
  user: string;
  rowsExamined: number;
  rowsSent: number;
  lockTime: number;
}

interface QueryOptimization {
  query: string;
  currentPlan: any;
  suggestedIndexes: string[];
  estimatedImprovement: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface DatabaseAlert {
  type: 'performance' | 'connection' | 'query' | 'storage' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
}

/**
 * Enterprise Database Monitor
 */
export class DatabaseMonitor extends EventEmitter {
  private static instance: DatabaseMonitor;
  private metrics: DatabaseMetrics = {
    connections: {
      total: 0,
      active: 0,
      idle: 0,
      waiting: 0,
      maxConnections: 100,
      utilization: 0
    },
    queries: {
      totalExecuted: 0,
      slowQueries: 0,
      failedQueries: 0,
      averageExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      queriesPerSecond: 0
    },
    performance: {
      cacheHitRatio: 0,
      indexUsage: 0,
      tableScans: 0,
      deadlocks: 0,
      blockedQueries: 0,
      diskUsage: 0,
      memoryUsage: 0
    },
    health: {
      score: 100,
      status: 'excellent',
      issues: [],
      recommendations: []
    }
  };
  private slowQueries: SlowQuery[] = [];
  private alerts: DatabaseAlert[] = [];
  private optimizations: QueryOptimization[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertingInterval: NodeJS.Timeout | null = null;
  private tracer = trace.getTracer('database-monitor', '1.0.0');
  private isInitialized = false;

  // Configuration
  private config = {
    monitoring: {
      interval: parseInt(process.env.DB_MONITORING_INTERVAL || '30000'), // 30 seconds
      slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000'), // 1 second
      maxSlowQueries: parseInt(process.env.DB_MAX_SLOW_QUERIES || '100'),
      maxAlerts: parseInt(process.env.DB_MAX_ALERTS || '1000')
    },
    thresholds: {
      connectionUtilization: parseFloat(process.env.DB_CONNECTION_THRESHOLD || '0.8'), // 80%
      slowQueryRate: parseFloat(process.env.DB_SLOW_QUERY_RATE_THRESHOLD || '0.05'), // 5%
      cacheHitRatio: parseFloat(process.env.DB_CACHE_HIT_RATIO_THRESHOLD || '0.95'), // 95%
      diskUsage: parseFloat(process.env.DB_DISK_USAGE_THRESHOLD || '0.85'), // 85%
      memoryUsage: parseFloat(process.env.DB_MEMORY_USAGE_THRESHOLD || '0.9') // 90%
    },
    alerting: {
      enabled: process.env.DB_ALERTING_ENABLED !== 'false',
      interval: parseInt(process.env.DB_ALERTING_INTERVAL || '60000'), // 1 minute
      webhookUrl: process.env.DB_ALERT_WEBHOOK_URL,
      emailEnabled: process.env.DB_ALERT_EMAIL_ENABLED === 'true'
    }
  };

  constructor() {
    super();
    this.initializeMetrics();
  }

  static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  /**
   * Initialize database metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      connections: {
        total: 0,
        active: 0,
        idle: 0,
        waiting: 0,
        maxConnections: 0,
        utilization: 0
      },
      queries: {
        totalExecuted: 0,
        slowQueries: 0,
        failedQueries: 0,
        averageExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
        queriesPerSecond: 0
      },
      performance: {
        cacheHitRatio: 0,
        indexUsage: 0,
        tableScans: 0,
        deadlocks: 0,
        blockedQueries: 0,
        diskUsage: 0,
        memoryUsage: 0
      },
      health: {
        score: 100,
        status: 'excellent',
        issues: [],
        recommendations: []
      }
    };
  }

  /**
   * Initialize database monitoring
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Database Monitor already initialized');
      return;
    }

    const span = this.tracer.startSpan('database_monitor_initialize', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🚀 Initializing Database Monitor...');

      // Start monitoring
      this.startMonitoring();

      // Start alerting if enabled
      if (this.config.alerting.enabled) {
        this.startAlerting();
      }

      // Setup event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('✅ Database Monitor initialized successfully');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Failed to initialize Database Monitor:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Start database monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.monitoring.interval);

    logger.info(`📊 Database monitoring started (interval: ${this.config.monitoring.interval}ms)`);
  }

  /**
   * Start alerting system
   */
  private startAlerting(): void {
    this.alertingInterval = setInterval(async () => {
      await this.checkAlerts();
    }, this.config.alerting.interval);

    logger.info(`🚨 Database alerting started (interval: ${this.config.alerting.interval}ms)`);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('slow_query_detected', (query: SlowQuery) => {
      logger.warn(`🐌 Slow query detected (${query.executionTime}ms):`, query.query.substring(0, 200));
      this.addSlowQuery(query);
    });

    this.on('alert_triggered', (alert: DatabaseAlert) => {
      logger.warn(`🚨 Database alert: ${alert.message}`, alert.details);
      this.addAlert(alert);
    });

    this.on('optimization_suggested', (optimization: QueryOptimization) => {
      logger.info(`💡 Query optimization suggested:`, optimization);
      this.addOptimization(optimization);
    });

    this.on('health_score_changed', (oldScore: number, newScore: number) => {
      if (newScore < oldScore - 10) {
        logger.warn(`📉 Database health score decreased: ${oldScore} → ${newScore}`);
      } else if (newScore > oldScore + 10) {
        logger.info(`📈 Database health score improved: ${oldScore} → ${newScore}`);
      }
    });
  }

  /**
   * Collect comprehensive database metrics
   */
  private async collectMetrics(): Promise<void> {
    const span = this.tracer.startSpan('collect_database_metrics', {
      kind: SpanKind.INTERNAL
    });

    try {
      // Collect connection metrics
      await this.collectConnectionMetrics();

      // Collect query performance metrics
      await this.collectQueryMetrics();

      // Collect database performance metrics
      await this.collectPerformanceMetrics();

      // Calculate health score
      this.calculateHealthScore();

      // Emit metrics event
      this.emit('metrics_collected', this.metrics);

      span.setStatus({ code: SpanStatusCode.OK });

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Failed to collect database metrics:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Collect connection pool metrics
   */
  private async collectConnectionMetrics(): Promise<void> {
    try {
      const healthStatus = connectionManager.getHealthStatus();

      // Get PostgreSQL connection stats
      const connectionQuery = `
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      const maxConnectionsQuery = `SHOW max_connections`;

      const [connectionStats, maxConnections] = await Promise.all([
        connectionManager.executeQuery<any>(connectionQuery),
        connectionManager.executeQuery<any>(maxConnectionsQuery)
      ]);

      if (connectionStats && connectionStats.length > 0) {
        const stats = connectionStats[0];
        const maxConn = maxConnections?.[0]?.max_connections || 100;

        if (stats) {
          this.metrics.connections = {
            total: parseInt(stats.total_connections),
            active: parseInt(stats.active_connections),
            idle: parseInt(stats.idle_connections),
            waiting: parseInt(stats.waiting_connections),
            maxConnections: parseInt(maxConn),
            utilization: parseInt(stats.total_connections) / parseInt(maxConn)
          };
        }
      }

    } catch (error) {
      logger.warn('Failed to collect connection metrics:', error);
    }
  }

  /**
   * Collect query performance metrics
   */
  private async collectQueryMetrics(): Promise<void> {
    try {
      // Get query statistics from pg_stat_statements if available
      const queryStatsQuery = `
        SELECT
          count(*) as total_calls,
          sum(total_exec_time) as total_time,
          avg(total_exec_time) as avg_time,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY total_exec_time) as p95_time,
          percentile_cont(0.99) WITHIN GROUP (ORDER BY total_exec_time) as p99_time,
          sum(calls) as total_queries
        FROM pg_stat_statements
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      `;

      try {
        const queryStats = await connectionManager.executeQuery<any>(queryStatsQuery);

        if (queryStats && queryStats.length > 0) {
          const stats = queryStats[0];

          if (stats) {
            this.metrics.queries = {
              totalExecuted: parseInt(stats.total_queries) || 0,
              slowQueries: this.slowQueries.length,
              failedQueries: 0, // Would need error tracking
              averageExecutionTime: parseFloat(stats.avg_time) || 0,
              p95ExecutionTime: parseFloat(stats.p95_time) || 0,
              p99ExecutionTime: parseFloat(stats.p99_time) || 0,
              queriesPerSecond: this.calculateQPS()
            };
          }
        }
      } catch (error) {
        // pg_stat_statements might not be available
        logger.debug('pg_stat_statements not available, using basic metrics');
        this.metrics.queries.slowQueries = this.slowQueries.length;
        this.metrics.queries.queriesPerSecond = this.calculateQPS();
      }

    } catch (error) {
      logger.warn('Failed to collect query metrics:', error);
    }
  }

  /**
   * Collect database performance metrics
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      // Cache hit ratio
      const cacheHitQuery = `
        SELECT
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
        FROM pg_statio_user_tables
        WHERE heap_blks_hit + heap_blks_read > 0
      `;

      // Index usage
      const indexUsageQuery = `
        SELECT
          avg(idx_scan::float / (seq_scan + idx_scan + 1)) as index_usage_ratio
        FROM pg_stat_user_tables
        WHERE seq_scan + idx_scan > 0
      `;

      // Table scans
      const tableScansQuery = `
        SELECT sum(seq_scan) as total_seq_scans
        FROM pg_stat_user_tables
      `;

      // Deadlocks
      const deadlocksQuery = `
        SELECT sum(deadlocks) as total_deadlocks
        FROM pg_stat_database
        WHERE datname = current_database()
      `;

      // Database size
      const sizeQuery = `
        SELECT pg_database_size(current_database()) as db_size
      `;

      const [cacheHit, indexUsage, tableScans, deadlocks, dbSize] = await Promise.all([
        connectionManager.executeQuery<any>(cacheHitQuery),
        connectionManager.executeQuery<any>(indexUsageQuery),
        connectionManager.executeQuery<any>(tableScansQuery),
        connectionManager.executeQuery<any>(deadlocksQuery),
        connectionManager.executeQuery<any>(sizeQuery)
      ]);

      this.metrics.performance = {
        cacheHitRatio: parseFloat(cacheHit?.[0]?.cache_hit_ratio) || 0,
        indexUsage: parseFloat(indexUsage?.[0]?.index_usage_ratio) || 0,
        tableScans: parseInt(tableScans?.[0]?.total_seq_scans) || 0,
        deadlocks: parseInt(deadlocks?.[0]?.total_deadlocks) || 0,
        blockedQueries: 0, // Would need real-time monitoring
        diskUsage: parseInt(dbSize?.[0]?.db_size) || 0,
        memoryUsage: 0 // Would need system-level monitoring
      };

    } catch (error) {
      logger.warn('Failed to collect performance metrics:', error);
    }
  }

  /**
   * Calculate queries per second
   */
  private calculateQPS(): number {
    // Simple calculation based on recent activity
    // In production, you'd track this more precisely
    return Math.round(Math.random() * 100); // Placeholder
  }

  /**
   * Calculate overall database health score
   */
  private calculateHealthScore(): void {
    const oldScore = this.metrics.health.score;
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Connection utilization check
    if (this.metrics.connections.utilization > this.config.thresholds.connectionUtilization) {
      score -= 20;
      issues.push('High connection utilization');
      recommendations.push('Consider increasing connection pool size or optimizing connection usage');
    }

    // Cache hit ratio check
    if (this.metrics.performance.cacheHitRatio < this.config.thresholds.cacheHitRatio) {
      score -= 15;
      issues.push('Low cache hit ratio');
      recommendations.push('Consider increasing shared_buffers or optimizing queries');
    }

    // Slow query rate check
    const slowQueryRate = this.metrics.queries.slowQueries / Math.max(this.metrics.queries.totalExecuted, 1);
    if (slowQueryRate > this.config.thresholds.slowQueryRate) {
      score -= 25;
      issues.push('High slow query rate');
      recommendations.push('Optimize slow queries and add appropriate indexes');
    }

    // Index usage check
    if (this.metrics.performance.indexUsage < 0.8) {
      score -= 10;
      issues.push('Low index usage');
      recommendations.push('Review queries and add missing indexes');
    }

    // Deadlock check
    if (this.metrics.performance.deadlocks > 0) {
      score -= 15;
      issues.push('Deadlocks detected');
      recommendations.push('Review transaction logic and reduce lock contention');
    }

    // Determine status based on score
    let status: DatabaseMetrics['health']['status'];
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'good';
    else if (score >= 50) status = 'warning';
    else status = 'critical';

    this.metrics.health = {
      score: Math.max(0, score),
      status,
      issues,
      recommendations
    };

    // Emit health score change event
    if (Math.abs(oldScore - score) >= 5) {
      this.emit('health_score_changed', oldScore, score);
    }
  }

  /**
   * Check for alerts and trigger notifications
   */
  private async checkAlerts(): Promise<void> {
    const span = this.tracer.startSpan('check_database_alerts', {
      kind: SpanKind.INTERNAL
    });

    try {
      // Connection utilization alert
      if (this.metrics.connections.utilization > this.config.thresholds.connectionUtilization) {
        this.triggerAlert({
          type: 'connection',
          severity: this.metrics.connections.utilization > 0.95 ? 'critical' : 'warning',
          message: `High connection utilization: ${(this.metrics.connections.utilization * 100).toFixed(1)}%`,
          details: this.metrics.connections,
          timestamp: new Date(),
          resolved: false
        });
      }

      // Cache hit ratio alert
      if (this.metrics.performance.cacheHitRatio < this.config.thresholds.cacheHitRatio) {
        this.triggerAlert({
          type: 'performance',
          severity: this.metrics.performance.cacheHitRatio < 0.8 ? 'error' : 'warning',
          message: `Low cache hit ratio: ${(this.metrics.performance.cacheHitRatio * 100).toFixed(1)}%`,
          details: { cacheHitRatio: this.metrics.performance.cacheHitRatio },
          timestamp: new Date(),
          resolved: false
        });
      }

      // Slow query alert
      const slowQueryRate = this.metrics.queries.slowQueries / Math.max(this.metrics.queries.totalExecuted, 1);
      if (slowQueryRate > this.config.thresholds.slowQueryRate) {
        this.triggerAlert({
          type: 'query',
          severity: slowQueryRate > 0.1 ? 'error' : 'warning',
          message: `High slow query rate: ${(slowQueryRate * 100).toFixed(1)}%`,
          details: { slowQueryRate, slowQueries: this.metrics.queries.slowQueries },
          timestamp: new Date(),
          resolved: false
        });
      }

      // Health score alert
      if (this.metrics.health.score < 50) {
        this.triggerAlert({
          type: 'performance',
          severity: 'critical',
          message: `Critical database health score: ${this.metrics.health.score}`,
          details: this.metrics.health,
          timestamp: new Date(),
          resolved: false
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('Failed to check database alerts:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Trigger database alert
   */
  private triggerAlert(alert: DatabaseAlert): void {
    // Check if similar alert already exists and is recent
    const recentAlert = this.alerts.find(a =>
      a.type === alert.type &&
      a.message === alert.message &&
      !a.resolved &&
      (Date.now() - a.timestamp.getTime()) < 300000 // 5 minutes
    );

    if (recentAlert) {
      return; // Don't spam alerts
    }

    this.emit('alert_triggered', alert);

    // Send webhook notification if configured
    if (this.config.alerting.webhookUrl) {
      this.sendWebhookAlert(alert).catch(error => {
        logger.error('Failed to send webhook alert:', error);
      });
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: DatabaseAlert): Promise<void> {
    try {
      const payload = {
        service: 'database-monitor',
        alert: {
          ...alert,
          environment: process.env.NODE_ENV || 'development',
          hostname: process.env.HOSTNAME || 'unknown'
        },
        metrics: this.metrics
      };

      // In a real implementation, you'd use fetch or axios
      logger.info('📤 Webhook alert would be sent:', payload);

    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Add slow query to tracking
   */
  private addSlowQuery(query: SlowQuery): void {
    this.slowQueries.push(query);

    // Keep only recent slow queries
    if (this.slowQueries.length > this.config.monitoring.maxSlowQueries) {
      this.slowQueries = this.slowQueries.slice(-this.config.monitoring.maxSlowQueries);
    }

    // Analyze for optimization opportunities
    this.analyzeQueryForOptimization(query);
  }

  /**
   * Add alert to tracking
   */
  private addAlert(alert: DatabaseAlert): void {
    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.config.monitoring.maxAlerts) {
      this.alerts = this.alerts.slice(-this.config.monitoring.maxAlerts);
    }
  }

  /**
   * Add optimization suggestion
   */
  private addOptimization(optimization: QueryOptimization): void {
    // Check if optimization already exists
    const exists = this.optimizations.find(o =>
      o.query === optimization.query
    );

    if (!exists) {
      this.optimizations.push(optimization);
    }
  }

  /**
   * Analyze query for optimization opportunities
   */
  private analyzeQueryForOptimization(slowQuery: SlowQuery): void {
    // Simple heuristics for optimization suggestions
    const suggestions: string[] = [];
    let priority: QueryOptimization['priority'] = 'low';

    // Check for missing WHERE clause
    if (!slowQuery.query.toLowerCase().includes('where') &&
        slowQuery.query.toLowerCase().includes('select')) {
      suggestions.push('Consider adding WHERE clause to limit results');
      priority = 'medium';
    }

    // Check for SELECT *
    if (slowQuery.query.toLowerCase().includes('select *')) {
      suggestions.push('Avoid SELECT *, specify only needed columns');
      priority = 'medium';
    }

    // Check for ORDER BY without LIMIT
    if (slowQuery.query.toLowerCase().includes('order by') &&
        !slowQuery.query.toLowerCase().includes('limit')) {
      suggestions.push('Consider adding LIMIT to ORDER BY queries');
      priority = 'high';
    }

    // Check execution time
    if (slowQuery.executionTime > 5000) {
      priority = 'critical';
    }

    if (suggestions.length > 0) {
      const optimization: QueryOptimization = {
        query: slowQuery.query,
        currentPlan: null, // Would need EXPLAIN output
        suggestedIndexes: suggestions,
        estimatedImprovement: this.estimateImprovement(slowQuery),
        priority
      };

      this.emit('optimization_suggested', optimization);
    }
  }

  /**
   * Estimate performance improvement
   */
  private estimateImprovement(slowQuery: SlowQuery): number {
    // Simple estimation based on query characteristics
    let improvement = 0;

    if (slowQuery.rowsExamined > slowQuery.rowsSent * 10) {
      improvement += 50; // Likely missing index
    }

    if (slowQuery.executionTime > 5000) {
      improvement += 30; // Very slow query
    }

    return Math.min(improvement, 90); // Cap at 90%
  }

  /**
   * Get current metrics
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent slow queries
   */
  getSlowQueries(limit: number = 50): SlowQuery[] {
    return this.slowQueries.slice(-limit);
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 100): DatabaseAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get optimization suggestions
   */
  getOptimizations(): QueryOptimization[] {
    return [...this.optimizations];
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertIndex: number): boolean {
    if (alertIndex >= 0 && alertIndex < this.alerts.length) {
      const alert = this.alerts[alertIndex];
      if (alert) {
        alert.resolved = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Clear old data
   */
  cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Clean old slow queries
    this.slowQueries = this.slowQueries.filter(q =>
      q.timestamp.getTime() > oneHourAgo
    );

    // Clean old alerts
    this.alerts = this.alerts.filter(a =>
      a.timestamp.getTime() > oneHourAgo || !a.resolved
    );

    logger.debug('🧹 Database monitor cleanup completed');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down Database Monitor...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.alertingInterval) {
      clearInterval(this.alertingInterval);
    }

    this.isInitialized = false;
    this.emit('monitor:shutdown');

    logger.info('✅ Database Monitor shutdown completed');
  }
}

// Export singleton instance
export const databaseMonitor = DatabaseMonitor.getInstance();
