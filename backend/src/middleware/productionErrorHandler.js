/**
 * Production-Grade Error Handling Middleware
 * Comprehensive error handling with logging, monitoring, and recovery
 */

const logger = require('../utils/logger');
const { SystemLog } = require('../database/connection');

class ProductionErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.circuitBreakers = new Map();
    this.alertThresholds = {
      error_rate: 0.1, // 10% error rate
      response_time: 5000, // 5 seconds
      consecutive_errors: 5
    };
  }

  /**
   * Main error handling middleware
   */
  handleError() {
    return async (error, req, res, next) => {
      const startTime = Date.now();
      const correlationId = req.headers['x-correlation-id'] || `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Classify error
        const errorClassification = this._classifyError(error);
        
        // Log error with full context
        await this._logError(error, req, correlationId, errorClassification);
        
        // Update error metrics
        this._updateErrorMetrics(error, req);
        
        // Check circuit breaker
        const shouldBreak = this._checkCircuitBreaker(req.path, error);
        
        // Generate appropriate response
        const response = this._generateErrorResponse(error, errorClassification, shouldBreak);
        
        // Send response
        res.status(response.status).json(response.body);
        
        // Trigger alerts if necessary
        await this._checkAlertConditions(error, req, correlationId);
        
        const processingTime = Date.now() - startTime;
        logger.info(`Error handled in ${processingTime}ms`, { correlationId });
        
      } catch (handlingError) {
        logger.error('Error handler failed:', handlingError);
        
        // Fallback response
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Classify error type and severity
   */
  _classifyError(error) {
    const classification = {
      type: 'unknown',
      severity: 'medium',
      category: 'system',
      recoverable: true,
      user_facing: true
    };

    // Database errors
    if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeTimeoutError') {
      classification.type = 'database_connection';
      classification.severity = 'high';
      classification.category = 'infrastructure';
      classification.recoverable = true;
      classification.user_facing = false;
    }
    
    // Validation errors
    else if (error.name === 'ValidationError' || error.status === 400) {
      classification.type = 'validation';
      classification.severity = 'low';
      classification.category = 'user_input';
      classification.recoverable = false;
      classification.user_facing = true;
    }
    
    // Authentication errors
    else if (error.status === 401 || error.status === 403) {
      classification.type = 'authentication';
      classification.severity = 'medium';
      classification.category = 'security';
      classification.recoverable = false;
      classification.user_facing = true;
    }
    
    // Rate limiting errors
    else if (error.status === 429) {
      classification.type = 'rate_limit';
      classification.severity = 'medium';
      classification.category = 'throttling';
      classification.recoverable = true;
      classification.user_facing = true;
    }
    
    // External service errors
    else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      classification.type = 'external_service';
      classification.severity = 'high';
      classification.category = 'infrastructure';
      classification.recoverable = true;
      classification.user_facing = false;
    }
    
    // Natural language processing errors
    else if (error.message.includes('Natural Language') || error.message.includes('Orchestrator')) {
      classification.type = 'nlp_processing';
      classification.severity = 'high';
      classification.category = 'ai_service';
      classification.recoverable = true;
      classification.user_facing = true;
    }
    
    // Gemini API errors
    else if (error.message.includes('Gemini') || error.message.includes('API')) {
      classification.type = 'ai_api';
      classification.severity = 'high';
      classification.category = 'external_ai';
      classification.recoverable = true;
      classification.user_facing = false;
    }

    return classification;
  }

  /**
   * Log error with comprehensive context
   */
  async _logError(error, req, correlationId, classification) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      classification: classification,
      request: {
        method: req.method,
        url: req.url,
        headers: this._sanitizeHeaders(req.headers),
        body: this._sanitizeBody(req.body),
        params: req.params,
        query: req.query,
        user_id: req.user?.id,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      },
      timestamp: new Date().toISOString(),
      correlation_id: correlationId,
      environment: process.env.NODE_ENV,
      service: 'backend-api'
    };

    // Log to console/file
    logger.error('Production error occurred:', errorData);

    // Log to database
    try {
      await SystemLog.create({
        level: this._mapSeverityToLevel(classification.severity),
        service: 'backend-api',
        component: 'error-handler',
        message: error.message,
        data: errorData,
        user_id: req.user?.id,
        correlation_id: correlationId
      });
    } catch (dbError) {
      logger.error('Failed to log error to database:', dbError);
    }
  }

  /**
   * Update error metrics for monitoring
   */
  _updateErrorMetrics(error, req) {
    const key = `${req.method}:${req.path}`;
    const now = Date.now();
    
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, {
        total: 0,
        recent: [],
        last_error: null
      });
    }
    
    const metrics = this.errorCounts.get(key);
    metrics.total++;
    metrics.recent.push(now);
    metrics.last_error = now;
    
    // Keep only recent errors (last hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    metrics.recent = metrics.recent.filter(timestamp => timestamp > oneHourAgo);
    
    this.errorCounts.set(key, metrics);
  }

  /**
   * Check circuit breaker conditions
   */
  _checkCircuitBreaker(path, error) {
    const key = path;
    
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        state: 'closed', // closed, open, half-open
        failures: 0,
        last_failure: null,
        next_attempt: null
      });
    }
    
    const breaker = this.circuitBreakers.get(key);
    const now = Date.now();
    
    // If circuit is open, check if we should try again
    if (breaker.state === 'open') {
      if (now > breaker.next_attempt) {
        breaker.state = 'half-open';
        breaker.failures = 0;
      } else {
        return true; // Circuit is still open
      }
    }
    
    // Record failure
    breaker.failures++;
    breaker.last_failure = now;
    
    // Open circuit if too many failures
    if (breaker.failures >= this.alertThresholds.consecutive_errors) {
      breaker.state = 'open';
      breaker.next_attempt = now + (5 * 60 * 1000); // Try again in 5 minutes
      
      logger.warn(`Circuit breaker opened for ${key}`, {
        failures: breaker.failures,
        next_attempt: new Date(breaker.next_attempt)
      });
      
      return true;
    }
    
    this.circuitBreakers.set(key, breaker);
    return false;
  }

  /**
   * Generate appropriate error response
   */
  _generateErrorResponse(error, classification, circuitOpen) {
    if (circuitOpen) {
      return {
        status: 503,
        body: {
          success: false,
          error: 'Service temporarily unavailable',
          error_type: 'circuit_breaker',
          retry_after: 300, // 5 minutes
          timestamp: new Date().toISOString()
        }
      };
    }

    // User-facing errors
    if (classification.user_facing) {
      const userMessage = this._getUserFriendlyMessage(error, classification);
      
      return {
        status: error.status || 500,
        body: {
          success: false,
          error: userMessage,
          error_type: classification.type,
          recoverable: classification.recoverable,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Internal errors
    return {
      status: 500,
      body: {
        success: false,
        error: 'An internal error occurred. Please try again later.',
        error_type: 'internal',
        recoverable: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get user-friendly error message
   */
  _getUserFriendlyMessage(error, classification) {
    switch (classification.type) {
      case 'validation':
        return error.message || 'Invalid input provided. Please check your request and try again.';
      
      case 'authentication':
        return 'Authentication required. Please log in and try again.';
      
      case 'rate_limit':
        return 'Too many requests. Please wait a moment and try again.';
      
      case 'nlp_processing':
        return 'I\'m having trouble understanding your request. Could you please rephrase it?';
      
      case 'ai_api':
        return 'AI service is temporarily unavailable. Please try again in a few moments.';
      
      case 'database_connection':
        return 'Service is temporarily unavailable. Please try again later.';
      
      case 'external_service':
        return 'External service is unavailable. Please try again later.';
      
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  /**
   * Check alert conditions and trigger notifications
   */
  async _checkAlertConditions(error, req, correlationId) {
    try {
      const key = `${req.method}:${req.path}`;
      const metrics = this.errorCounts.get(key);
      
      if (!metrics) return;
      
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const recentErrors = metrics.recent.filter(timestamp => timestamp > oneHourAgo);
      
      // Check error rate threshold
      if (recentErrors.length >= 10) { // More than 10 errors in an hour
        await this._triggerAlert('high_error_rate', {
          endpoint: key,
          error_count: recentErrors.length,
          time_window: '1_hour',
          correlation_id: correlationId
        });
      }
      
      // Check consecutive errors
      const breaker = this.circuitBreakers.get(key);
      if (breaker && breaker.failures >= this.alertThresholds.consecutive_errors) {
        await this._triggerAlert('circuit_breaker_open', {
          endpoint: key,
          consecutive_failures: breaker.failures,
          correlation_id: correlationId
        });
      }
      
    } catch (alertError) {
      logger.error('Failed to check alert conditions:', alertError);
    }
  }

  /**
   * Trigger alert notification
   */
  async _triggerAlert(alertType, data) {
    try {
      // Log alert
      logger.warn(`ALERT: ${alertType}`, data);
      
      // Save alert to database
      await SystemLog.create({
        level: 'warn',
        service: 'backend-api',
        component: 'alerting',
        message: `Alert triggered: ${alertType}`,
        data: {
          alert_type: alertType,
          alert_data: data,
          timestamp: new Date().toISOString()
        }
      });
      
      // In production, this would integrate with:
      // - Slack/Discord notifications
      // - Email alerts
      // - PagerDuty/OpsGenie
      // - Monitoring dashboards
      
    } catch (alertError) {
      logger.error('Failed to trigger alert:', alertError);
    }
  }

  /**
   * Sanitize headers for logging
   */
  _sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }

  /**
   * Sanitize request body for logging
   */
  _sanitizeBody(body) {
    if (!body) return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.api_key;
    
    return sanitized;
  }

  /**
   * Map severity to log level
   */
  _mapSeverityToLevel(severity) {
    switch (severity) {
      case 'low': return 'warn';
      case 'medium': return 'error';
      case 'high': return 'critical';
      default: return 'error';
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics() {
    const stats = {
      total_endpoints: this.errorCounts.size,
      circuit_breakers: {
        total: this.circuitBreakers.size,
        open: 0,
        half_open: 0,
        closed: 0
      },
      error_summary: []
    };
    
    // Count circuit breaker states
    for (const [key, breaker] of this.circuitBreakers) {
      stats.circuit_breakers[breaker.state]++;
    }
    
    // Summarize errors
    for (const [endpoint, metrics] of this.errorCounts) {
      stats.error_summary.push({
        endpoint,
        total_errors: metrics.total,
        recent_errors: metrics.recent.length,
        last_error: metrics.last_error ? new Date(metrics.last_error) : null
      });
    }
    
    return stats;
  }

  /**
   * Reset circuit breaker for endpoint
   */
  resetCircuitBreaker(endpoint) {
    if (this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, {
        state: 'closed',
        failures: 0,
        last_failure: null,
        next_attempt: null
      });
      
      logger.info(`Circuit breaker reset for ${endpoint}`);
      return true;
    }
    
    return false;
  }
}

// Create singleton instance
const productionErrorHandler = new ProductionErrorHandler();

module.exports = {
  ProductionErrorHandler,
  productionErrorHandler
};
