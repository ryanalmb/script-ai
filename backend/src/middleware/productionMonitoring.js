/**
 * Production-Grade Monitoring and Metrics Middleware
 * Comprehensive monitoring with performance tracking, health checks, and alerting
 */

const logger = require('../utils/logger');
const { Analytics, SystemLog } = require('../database/connection');
const { databaseManager } = require('../database/connection');

class ProductionMonitoring {
  constructor() {
    this.metrics = {
      requests: new Map(),
      performance: new Map(),
      health: {
        last_check: null,
        status: 'unknown',
        components: {}
      }
    };
    
    this.thresholds = {
      response_time_warning: 1000, // 1 second
      response_time_critical: 5000, // 5 seconds
      memory_warning: 0.8, // 80% memory usage
      cpu_warning: 0.8, // 80% CPU usage
      error_rate_warning: 0.05, // 5% error rate
      error_rate_critical: 0.1 // 10% error rate
    };
    
    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  /**
   * Request monitoring middleware
   */
  monitorRequests() {
    return (req, res, next) => {
      const startTime = Date.now();
      const correlationId = req.headers['x-correlation-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add correlation ID to request
      req.correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);
      
      // Track request start
      const requestKey = `${req.method}:${req.path}`;
      this._trackRequestStart(requestKey, req);
      
      // Override res.json to capture response
      const originalJson = res.json;
      res.json = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Track request completion
        this._trackRequestComplete(requestKey, req, res, responseTime, data);
        
        // Log request
        this._logRequest(req, res, responseTime, correlationId);
        
        // Record analytics
        this._recordRequestAnalytics(req, res, responseTime);
        
        return originalJson.call(this, data);
      }.bind(this);
      
      // Handle response finish
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        
        // Check performance thresholds
        this._checkPerformanceThresholds(requestKey, responseTime, res.statusCode);
      });
      
      next();
    };
  }

  /**
   * Track request start
   */
  _trackRequestStart(requestKey, req) {
    if (!this.metrics.requests.has(requestKey)) {
      this.metrics.requests.set(requestKey, {
        total: 0,
        success: 0,
        errors: 0,
        response_times: [],
        last_request: null
      });
    }
    
    const metrics = this.metrics.requests.get(requestKey);
    metrics.total++;
    metrics.last_request = Date.now();
    
    this.metrics.requests.set(requestKey, metrics);
  }

  /**
   * Track request completion
   */
  _trackRequestComplete(requestKey, req, res, responseTime, responseData) {
    const metrics = this.metrics.requests.get(requestKey);
    
    if (res.statusCode >= 200 && res.statusCode < 400) {
      metrics.success++;
    } else {
      metrics.errors++;
    }
    
    // Track response times (keep last 100)
    metrics.response_times.push(responseTime);
    if (metrics.response_times.length > 100) {
      metrics.response_times.shift();
    }
    
    this.metrics.requests.set(requestKey, metrics);
    
    // Update performance metrics
    this._updatePerformanceMetrics(requestKey, responseTime, res.statusCode);
  }

  /**
   * Log request with comprehensive details
   */
  _logRequest(req, res, responseTime, correlationId) {
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      response_time: responseTime,
      user_id: req.user?.id,
      ip: req.ip,
      user_agent: req.get('User-Agent'),
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    };
    
    // Determine log level based on status and response time
    let level = 'info';
    if (res.statusCode >= 400) {
      level = 'warn';
    }
    if (res.statusCode >= 500) {
      level = 'error';
    }
    if (responseTime > this.thresholds.response_time_warning) {
      level = 'warn';
    }
    
    logger[level]('Request processed', logData);
  }

  /**
   * Record request analytics
   */
  async _recordRequestAnalytics(req, res, responseTime) {
    try {
      const metrics = [
        {
          user_id: req.user?.id,
          metric_type: 'api_request',
          metric_name: 'response_time',
          value: responseTime,
          dimensions: {
            method: req.method,
            endpoint: req.path,
            status_code: res.statusCode,
            success: res.statusCode < 400
          }
        },
        {
          user_id: req.user?.id,
          metric_type: 'api_request',
          metric_name: 'request_count',
          value: 1,
          dimensions: {
            method: req.method,
            endpoint: req.path,
            status_code: res.statusCode
          }
        }
      ];
      
      await Analytics.bulkCreate(metrics);
      
    } catch (error) {
      logger.error('Failed to record request analytics:', error);
    }
  }

  /**
   * Update performance metrics
   */
  _updatePerformanceMetrics(requestKey, responseTime, statusCode) {
    if (!this.metrics.performance.has(requestKey)) {
      this.metrics.performance.set(requestKey, {
        avg_response_time: 0,
        min_response_time: Infinity,
        max_response_time: 0,
        p95_response_time: 0,
        error_rate: 0,
        throughput: 0,
        last_updated: Date.now()
      });
    }
    
    const perf = this.metrics.performance.get(requestKey);
    const requestMetrics = this.metrics.requests.get(requestKey);
    
    // Calculate averages
    const responseTimes = requestMetrics.response_times;
    perf.avg_response_time = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    perf.min_response_time = Math.min(...responseTimes);
    perf.max_response_time = Math.max(...responseTimes);
    
    // Calculate P95
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    perf.p95_response_time = sorted[p95Index] || 0;
    
    // Calculate error rate
    perf.error_rate = requestMetrics.errors / requestMetrics.total;
    
    // Calculate throughput (requests per minute)
    const timeWindow = 60000; // 1 minute
    const now = Date.now();
    const recentRequests = responseTimes.filter(time => 
      (now - time) < timeWindow
    ).length;
    perf.throughput = recentRequests;
    
    perf.last_updated = now;
    
    this.metrics.performance.set(requestKey, perf);
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  async _checkPerformanceThresholds(requestKey, responseTime, statusCode) {
    try {
      const perf = this.metrics.performance.get(requestKey);
      if (!perf) return;
      
      // Response time alerts
      if (responseTime > this.thresholds.response_time_critical) {
        await this._triggerAlert('critical_response_time', {
          endpoint: requestKey,
          response_time: responseTime,
          threshold: this.thresholds.response_time_critical
        });
      } else if (responseTime > this.thresholds.response_time_warning) {
        await this._triggerAlert('slow_response_time', {
          endpoint: requestKey,
          response_time: responseTime,
          threshold: this.thresholds.response_time_warning
        });
      }
      
      // Error rate alerts
      if (perf.error_rate > this.thresholds.error_rate_critical) {
        await this._triggerAlert('critical_error_rate', {
          endpoint: requestKey,
          error_rate: perf.error_rate,
          threshold: this.thresholds.error_rate_critical
        });
      } else if (perf.error_rate > this.thresholds.error_rate_warning) {
        await this._triggerAlert('high_error_rate', {
          endpoint: requestKey,
          error_rate: perf.error_rate,
          threshold: this.thresholds.error_rate_warning
        });
      }
      
    } catch (error) {
      logger.error('Failed to check performance thresholds:', error);
    }
  }

  /**
   * Start background monitoring tasks
   */
  startBackgroundMonitoring() {
    // Health check every 30 seconds
    setInterval(() => {
      this._performHealthCheck();
    }, 30000);
    
    // System metrics every 60 seconds
    setInterval(() => {
      this._collectSystemMetrics();
    }, 60000);
    
    // Cleanup old metrics every 5 minutes
    setInterval(() => {
      this._cleanupOldMetrics();
    }, 300000);
    
    logger.info('✅ Background monitoring started');
  }

  /**
   * Perform comprehensive health check
   */
  async _performHealthCheck() {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {}
      };
      
      // Check database health
      const dbHealth = await databaseManager.healthCheck();
      health.components.database = {
        status: dbHealth.overall ? 'healthy' : 'unhealthy',
        postgres: dbHealth.postgres,
        redis: dbHealth.redis
      };
      
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
      health.components.memory = {
        status: memUsagePercent < this.thresholds.memory_warning ? 'healthy' : 'warning',
        heap_used: memUsage.heapUsed,
        heap_total: memUsage.heapTotal,
        usage_percent: memUsagePercent
      };
      
      // Check LLM service
      try {
        const axios = require('axios');
        const llmResponse = await axios.get('http://localhost:3005/health', { timeout: 5000 });
        health.components.llm_service = {
          status: llmResponse.status === 200 ? 'healthy' : 'unhealthy',
          response_time: Date.now()
        };
      } catch (llmError) {
        health.components.llm_service = {
          status: 'unhealthy',
          error: llmError.message
        };
      }
      
      // Overall health status
      const unhealthyComponents = Object.values(health.components)
        .filter(comp => comp.status !== 'healthy').length;
      
      if (unhealthyComponents > 0) {
        health.status = unhealthyComponents === Object.keys(health.components).length ? 'unhealthy' : 'degraded';
      }
      
      this.metrics.health = health;
      
      // Log health status
      if (health.status !== 'healthy') {
        logger.warn('System health check failed', health);
        
        await this._triggerAlert('health_check_failed', {
          status: health.status,
          unhealthy_components: unhealthyComponents,
          components: health.components
        });
      }
      
    } catch (error) {
      logger.error('Health check failed:', error);
      
      this.metrics.health = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Collect system metrics
   */
  async _collectSystemMetrics() {
    try {
      const metrics = [];
      
      // Memory metrics
      const memUsage = process.memoryUsage();
      metrics.push({
        metric_type: 'system',
        metric_name: 'memory_usage',
        value: memUsage.heapUsed,
        dimensions: {
          type: 'heap_used',
          total: memUsage.heapTotal
        }
      });
      
      // CPU metrics (simplified)
      const cpuUsage = process.cpuUsage();
      metrics.push({
        metric_type: 'system',
        metric_name: 'cpu_usage',
        value: cpuUsage.user + cpuUsage.system,
        dimensions: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      });
      
      // Request metrics summary
      let totalRequests = 0;
      let totalErrors = 0;
      let avgResponseTime = 0;
      
      for (const [endpoint, requestMetrics] of this.metrics.requests) {
        totalRequests += requestMetrics.total;
        totalErrors += requestMetrics.errors;
        
        const perfMetrics = this.metrics.performance.get(endpoint);
        if (perfMetrics) {
          avgResponseTime += perfMetrics.avg_response_time;
        }
      }
      
      if (this.metrics.requests.size > 0) {
        avgResponseTime /= this.metrics.requests.size;
      }
      
      metrics.push({
        metric_type: 'api',
        metric_name: 'total_requests',
        value: totalRequests,
        dimensions: {
          errors: totalErrors,
          error_rate: totalRequests > 0 ? totalErrors / totalRequests : 0,
          avg_response_time: avgResponseTime
        }
      });
      
      // Save metrics to database
      await Analytics.bulkCreate(metrics);
      
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Cleanup old metrics to prevent memory leaks
   */
  _cleanupOldMetrics() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, metrics] of this.metrics.requests) {
      if (metrics.last_request && (now - metrics.last_request) > maxAge) {
        // Keep only recent response times
        metrics.response_times = metrics.response_times.slice(-10);
      }
    }
    
    logger.debug('Metrics cleanup completed');
  }

  /**
   * Trigger monitoring alert
   */
  async _triggerAlert(alertType, data) {
    try {
      const alertData = {
        alert_type: alertType,
        severity: this._getAlertSeverity(alertType),
        data: data,
        timestamp: new Date().toISOString(),
        service: 'backend-api'
      };
      
      // Log alert
      logger.warn(`MONITORING ALERT: ${alertType}`, alertData);
      
      // Save to database
      await SystemLog.create({
        level: alertData.severity,
        service: 'backend-api',
        component: 'monitoring',
        message: `Monitoring alert: ${alertType}`,
        data: alertData
      });
      
      // In production, integrate with:
      // - Prometheus/Grafana
      // - Slack/Discord webhooks
      // - PagerDuty/OpsGenie
      // - Email notifications
      
    } catch (error) {
      logger.error('Failed to trigger monitoring alert:', error);
    }
  }

  /**
   * Get alert severity level
   */
  _getAlertSeverity(alertType) {
    const criticalAlerts = ['critical_response_time', 'critical_error_rate', 'health_check_failed'];
    const warningAlerts = ['slow_response_time', 'high_error_rate', 'memory_warning'];
    
    if (criticalAlerts.includes(alertType)) return 'critical';
    if (warningAlerts.includes(alertType)) return 'warn';
    return 'info';
  }

  /**
   * Get comprehensive metrics summary
   */
  getMetricsSummary() {
    const summary = {
      health: this.metrics.health,
      requests: {
        total_endpoints: this.metrics.requests.size,
        endpoints: []
      },
      performance: {
        total_endpoints: this.metrics.performance.size,
        endpoints: []
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    };
    
    // Summarize request metrics
    for (const [endpoint, metrics] of this.metrics.requests) {
      summary.requests.endpoints.push({
        endpoint,
        total: metrics.total,
        success: metrics.success,
        errors: metrics.errors,
        error_rate: metrics.total > 0 ? metrics.errors / metrics.total : 0,
        last_request: metrics.last_request ? new Date(metrics.last_request) : null
      });
    }
    
    // Summarize performance metrics
    for (const [endpoint, perf] of this.metrics.performance) {
      summary.performance.endpoints.push({
        endpoint,
        avg_response_time: perf.avg_response_time,
        p95_response_time: perf.p95_response_time,
        error_rate: perf.error_rate,
        throughput: perf.throughput
      });
    }
    
    return summary;
  }

  /**
   * Reset metrics for endpoint
   */
  resetMetrics(endpoint) {
    if (this.metrics.requests.has(endpoint)) {
      this.metrics.requests.delete(endpoint);
    }
    
    if (this.metrics.performance.has(endpoint)) {
      this.metrics.performance.delete(endpoint);
    }
    
    logger.info(`Metrics reset for endpoint: ${endpoint}`);
  }
}

// Create singleton instance
const productionMonitoring = new ProductionMonitoring();

module.exports = {
  ProductionMonitoring,
  productionMonitoring
};
