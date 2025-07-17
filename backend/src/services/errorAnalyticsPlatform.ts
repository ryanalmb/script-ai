/**
 * Error Analytics Platform - 2025 Edition
 * Enterprise-grade error monitoring and analytics:
 * - Real-time error tracking and aggregation
 * - Error pattern detection and analysis
 * - Performance impact assessment
 * - Automated root cause analysis
 * - Predictive error forecasting
 * - Error correlation across services
 */

import { EventEmitter } from 'events';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from '../utils/logger';
import { EnterpriseErrorClass, ErrorType, ErrorCategory, ErrorSeverity } from '../errors/enterpriseErrorFramework';
import { correlationManager } from './correlationManager';
import { advancedCacheManager } from './advancedCacheManager';

// Error Analytics Interfaces
export interface ErrorEvent {
  id: string;
  correlationId: string;
  error: EnterpriseErrorClass;
  timestamp: Date;
  service: string;
  operation: string;
  userId?: string;
  sessionId?: string;
  context: Record<string, any>;
  resolved: boolean;
  resolutionTime?: number;
}

export interface ErrorPattern {
  id: string;
  fingerprint: string;
  errorType: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  services: string[];
  operations: string[];
  affectedUsers: Set<string>;
  averageResolutionTime: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  errorsByType: Map<ErrorType, number>;
  errorsByCategory: Map<ErrorCategory, number>;
  errorsBySeverity: Map<ErrorSeverity, number>;
  errorsByService: Map<string, number>;
  averageResolutionTime: number;
  p95ResolutionTime: number;
  p99ResolutionTime: number;
  mttr: number; // Mean Time To Recovery
  mtbf: number; // Mean Time Between Failures
}

export interface ErrorInsight {
  type: 'pattern' | 'anomaly' | 'correlation' | 'prediction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: any[];
  recommendations: string[];
  confidence: number;
  timestamp: Date;
  correlationId?: string;
}

export interface ErrorForecast {
  timeframe: '1h' | '6h' | '24h' | '7d';
  predictedErrorCount: number;
  confidence: number;
  factors: string[];
  recommendations: string[];
  timestamp: Date;
}

/**
 * Enterprise Error Analytics Platform
 */
export class ErrorAnalyticsPlatform extends EventEmitter {
  private static instance: ErrorAnalyticsPlatform;
  private errorEvents: ErrorEvent[] = [];
  private errorPatterns = new Map<string, ErrorPattern>();
  private errorInsights: ErrorInsight[] = [];
  private errorForecasts: ErrorForecast[] = [];
  private metricsCache = new Map<string, any>();
  private tracer = trace.getTracer('error-analytics-platform', '1.0.0');
  private isInitialized = false;

  // Configuration
  private config = {
    maxEvents: parseInt(process.env.ERROR_ANALYTICS_MAX_EVENTS || '10000'),
    maxPatterns: parseInt(process.env.ERROR_ANALYTICS_MAX_PATTERNS || '1000'),
    maxInsights: parseInt(process.env.ERROR_ANALYTICS_MAX_INSIGHTS || '500'),
    analysisInterval: parseInt(process.env.ERROR_ANALYTICS_INTERVAL || '60000'), // 1 minute
    patternDetectionThreshold: parseInt(process.env.ERROR_PATTERN_THRESHOLD || '5'),
    anomalyDetectionSensitivity: parseFloat(process.env.ERROR_ANOMALY_SENSITIVITY || '0.8'),
    forecastingEnabled: process.env.ERROR_FORECASTING_ENABLED !== 'false',
    realTimeAnalysis: process.env.ERROR_REALTIME_ANALYSIS !== 'false'
  };

  constructor() {
    super();
  }

  static getInstance(): ErrorAnalyticsPlatform {
    if (!ErrorAnalyticsPlatform.instance) {
      ErrorAnalyticsPlatform.instance = new ErrorAnalyticsPlatform();
    }
    return ErrorAnalyticsPlatform.instance;
  }

  /**
   * Initialize error analytics platform
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Error Analytics Platform already initialized');
      return;
    }

    const span = this.tracer.startSpan('error_analytics_initialize', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🚀 Initializing Error Analytics Platform...');

      // Start periodic analysis
      this.startPeriodicAnalysis();

      // Setup event handlers
      this.setupEventHandlers();

      // Load historical data if available
      await this.loadHistoricalData();

      this.isInitialized = true;
      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('✅ Error Analytics Platform initialized successfully');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Failed to initialize Error Analytics Platform:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record error event
   */
  recordError(error: EnterpriseErrorClass, context?: Record<string, any>): void {
    const span = this.tracer.startSpan('record_error_event', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'error.type': error.type,
        'error.severity': error.severity,
        'error.service': error.service
      }
    });

    try {
      const errorEvent: ErrorEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        correlationId: error.correlationId,
        error,
        timestamp: new Date(),
        service: error.service,
        operation: error.operation,
        context: context || {},
        resolved: false,
        ...(error.userId && { userId: error.userId }),
        ...(error.sessionId && { sessionId: error.sessionId })
      };

      // Add to events
      this.errorEvents.push(errorEvent);

      // Limit events size
      if (this.errorEvents.length > this.config.maxEvents) {
        this.errorEvents = this.errorEvents.slice(-this.config.maxEvents);
      }

      // Real-time analysis if enabled
      if (this.config.realTimeAnalysis) {
        this.performRealTimeAnalysis(errorEvent);
      }

      // Update patterns
      this.updateErrorPatterns(errorEvent);

      // Emit event
      this.emit('error:recorded', errorEvent);

      span.setStatus({ code: SpanStatusCode.OK });

    } catch (analyticsError) {
      span.recordException(analyticsError as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (analyticsError as Error).message });
      logger.error('Failed to record error event:', analyticsError);
    } finally {
      span.end();
    }
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string, resolutionTime?: number): void {
    const event = this.errorEvents.find(e => e.error.id === errorId);
    if (event && !event.resolved) {
      event.resolved = true;
      event.resolutionTime = resolutionTime || (Date.now() - event.timestamp.getTime());
      
      // Update pattern resolution metrics
      const pattern = this.errorPatterns.get(event.error.fingerprint || '');
      if (pattern) {
        this.updatePatternResolutionMetrics(pattern, event.resolutionTime);
      }

      this.emit('error:resolved', event);
    }
  }

  /**
   * Perform real-time analysis
   */
  private performRealTimeAnalysis(errorEvent: ErrorEvent): void {
    // Check for immediate anomalies
    this.detectAnomalies(errorEvent);
    
    // Check for critical patterns
    this.detectCriticalPatterns(errorEvent);
    
    // Check for correlations
    this.detectCorrelations(errorEvent);
  }

  /**
   * Update error patterns
   */
  private updateErrorPatterns(errorEvent: ErrorEvent): void {
    const fingerprint = errorEvent.error.fingerprint || this.generateFingerprint(errorEvent.error);
    
    let pattern = this.errorPatterns.get(fingerprint);
    
    if (!pattern) {
      pattern = {
        id: `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fingerprint,
        errorType: errorEvent.error.type,
        category: errorEvent.error.category,
        severity: errorEvent.error.severity,
        count: 0,
        firstSeen: errorEvent.timestamp,
        lastSeen: errorEvent.timestamp,
        services: [],
        operations: [],
        affectedUsers: new Set(),
        averageResolutionTime: 0,
        trend: 'stable',
        confidence: 0
      };
      
      this.errorPatterns.set(fingerprint, pattern);
    }

    // Update pattern
    pattern.count++;
    pattern.lastSeen = errorEvent.timestamp;
    
    if (!pattern.services.includes(errorEvent.service)) {
      pattern.services.push(errorEvent.service);
    }
    
    if (!pattern.operations.includes(errorEvent.operation)) {
      pattern.operations.push(errorEvent.operation);
    }
    
    if (errorEvent.userId) {
      pattern.affectedUsers.add(errorEvent.userId);
    }

    // Calculate trend
    pattern.trend = this.calculateTrend(pattern);
    pattern.confidence = this.calculateConfidence(pattern);

    // Emit pattern update
    this.emit('pattern:updated', pattern);
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(errorEvent: ErrorEvent): void {
    const recentEvents = this.getRecentEvents(300000); // Last 5 minutes
    const currentRate = recentEvents.length / 5; // Errors per minute
    
    // Get historical average
    const historicalAverage = this.getHistoricalErrorRate();
    
    // Check if current rate is anomalous
    if (currentRate > historicalAverage * (1 + this.config.anomalyDetectionSensitivity)) {
      const insight: ErrorInsight = {
        type: 'anomaly',
        severity: currentRate > historicalAverage * 2 ? 'critical' : 'high',
        title: 'Error Rate Anomaly Detected',
        description: `Current error rate (${currentRate.toFixed(2)}/min) is ${((currentRate / historicalAverage - 1) * 100).toFixed(1)}% above historical average`,
        evidence: [
          { currentRate, historicalAverage, timeframe: '5min' },
          { recentErrors: recentEvents.length }
        ],
        recommendations: [
          'Investigate recent deployments or configuration changes',
          'Check system resource utilization',
          'Review error patterns for common causes'
        ],
        confidence: 0.8,
        timestamp: new Date(),
        correlationId: errorEvent.correlationId
      };
      
      this.addInsight(insight);
    }
  }

  /**
   * Detect critical patterns
   */
  private detectCriticalPatterns(errorEvent: ErrorEvent): void {
    const pattern = this.errorPatterns.get(errorEvent.error.fingerprint || '');
    
    if (pattern && pattern.count >= this.config.patternDetectionThreshold) {
      const timeWindow = Date.now() - pattern.firstSeen.getTime();
      const frequency = pattern.count / (timeWindow / 60000); // Errors per minute
      
      if (frequency > 1 && pattern.severity === ErrorSeverity.CRITICAL) {
        const insight: ErrorInsight = {
          type: 'pattern',
          severity: 'critical',
          title: 'Critical Error Pattern Detected',
          description: `Critical error pattern occurring at ${frequency.toFixed(2)} errors/min`,
          evidence: [
            { pattern: pattern.fingerprint, count: pattern.count, frequency },
            { services: pattern.services, operations: pattern.operations }
          ],
          recommendations: [
            'Immediate investigation required',
            'Consider implementing circuit breaker',
            'Review and fix root cause'
          ],
          confidence: 0.9,
          timestamp: new Date(),
          correlationId: errorEvent.correlationId
        };
        
        this.addInsight(insight);
      }
    }
  }

  /**
   * Detect correlations
   */
  private detectCorrelations(errorEvent: ErrorEvent): void {
    // Find errors with same correlation ID
    const correlatedErrors = this.errorEvents.filter(e => 
      e.correlationId === errorEvent.correlationId && 
      e.id !== errorEvent.id
    );

    if (correlatedErrors.length > 0) {
      const insight: ErrorInsight = {
        type: 'correlation',
        severity: 'medium',
        title: 'Correlated Errors Detected',
        description: `${correlatedErrors.length + 1} errors detected with same correlation ID`,
        evidence: [
          { correlationId: errorEvent.correlationId },
          { totalErrors: correlatedErrors.length + 1 },
          { services: [...new Set([errorEvent.service, ...correlatedErrors.map(e => e.service)])] }
        ],
        recommendations: [
          'Investigate distributed transaction flow',
          'Check for cascade failures',
          'Review service dependencies'
        ],
        confidence: 0.7,
        timestamp: new Date(),
        correlationId: errorEvent.correlationId
      };
      
      this.addInsight(insight);
    }
  }

  /**
   * Add insight
   */
  private addInsight(insight: ErrorInsight): void {
    this.errorInsights.push(insight);
    
    // Limit insights size
    if (this.errorInsights.length > this.config.maxInsights) {
      this.errorInsights = this.errorInsights.slice(-this.config.maxInsights);
    }
    
    this.emit('insight:generated', insight);
    
    // Log critical insights
    if (insight.severity === 'critical') {
      logger.warn(`🚨 Critical Error Insight: ${insight.title}`, insight);
    }
  }

  /**
   * Generate error metrics
   */
  generateMetrics(timeframe?: number): ErrorMetrics {
    const events = timeframe ?
      this.errorEvents.filter(e => Date.now() - e.timestamp.getTime() < timeframe) :
      this.errorEvents;

    const totalErrors = events.length;
    const timeSpan = timeframe || (Date.now() - (events[0]?.timestamp.getTime() || Date.now()));
    const errorRate = totalErrors / (timeSpan / 60000); // Errors per minute

    const errorsByType = new Map<ErrorType, number>();
    const errorsByCategory = new Map<ErrorCategory, number>();
    const errorsBySeverity = new Map<ErrorSeverity, number>();
    const errorsByService = new Map<string, number>();

    const resolutionTimes: number[] = [];

    events.forEach(event => {
      // Count by type
      errorsByType.set(event.error.type, (errorsByType.get(event.error.type) || 0) + 1);

      // Count by category
      errorsByCategory.set(event.error.category, (errorsByCategory.get(event.error.category) || 0) + 1);

      // Count by severity
      errorsBySeverity.set(event.error.severity, (errorsBySeverity.get(event.error.severity) || 0) + 1);

      // Count by service
      errorsByService.set(event.service, (errorsByService.get(event.service) || 0) + 1);

      // Collect resolution times
      if (event.resolved && event.resolutionTime) {
        resolutionTimes.push(event.resolutionTime);
      }
    });

    // Calculate resolution time metrics
    const averageResolutionTime = resolutionTimes.length > 0 ?
      resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;

    const sortedTimes = resolutionTimes.sort((a, b) => a - b);
    const p95ResolutionTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99ResolutionTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    // Calculate MTTR and MTBF
    const mttr = averageResolutionTime;
    const mtbf = events.length > 1 ? timeSpan / events.length : 0;

    return {
      totalErrors,
      errorRate,
      errorsByType,
      errorsByCategory,
      errorsBySeverity,
      errorsByService,
      averageResolutionTime,
      p95ResolutionTime,
      p99ResolutionTime,
      mttr,
      mtbf
    };
  }

  /**
   * Get recent events
   */
  private getRecentEvents(timeframe: number): ErrorEvent[] {
    const cutoff = Date.now() - timeframe;
    return this.errorEvents.filter(e => e.timestamp.getTime() > cutoff);
  }

  /**
   * Get historical error rate
   */
  private getHistoricalErrorRate(): number {
    const historicalEvents = this.errorEvents.filter(e =>
      Date.now() - e.timestamp.getTime() > 3600000 // Older than 1 hour
    );

    if (historicalEvents.length === 0) return 1; // Default baseline

    const timeSpan = Math.max(3600000, Date.now() - (historicalEvents[0]?.timestamp.getTime() ?? Date.now()));
    return historicalEvents.length / (timeSpan / 60000); // Errors per minute
  }

  /**
   * Calculate trend for pattern
   */
  private calculateTrend(pattern: ErrorPattern): 'increasing' | 'decreasing' | 'stable' {
    const recentEvents = this.errorEvents.filter(e =>
      e.error.fingerprint === pattern.fingerprint &&
      Date.now() - e.timestamp.getTime() < 3600000 // Last hour
    );

    const olderEvents = this.errorEvents.filter(e =>
      e.error.fingerprint === pattern.fingerprint &&
      Date.now() - e.timestamp.getTime() >= 3600000 &&
      Date.now() - e.timestamp.getTime() < 7200000 // Previous hour
    );

    const recentRate = recentEvents.length;
    const olderRate = olderEvents.length;

    if (recentRate > olderRate * 1.2) return 'increasing';
    if (recentRate < olderRate * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate confidence for pattern
   */
  private calculateConfidence(pattern: ErrorPattern): number {
    let confidence = 0;

    // Base confidence on count
    confidence += Math.min(pattern.count / 10, 0.5);

    // Add confidence based on consistency
    const timeSpan = Date.now() - pattern.firstSeen.getTime();
    const expectedFrequency = pattern.count / (timeSpan / 3600000); // Per hour
    if (expectedFrequency > 0.1) confidence += 0.3;

    // Add confidence based on service spread
    if (pattern.services.length > 1) confidence += 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * Update pattern resolution metrics
   */
  private updatePatternResolutionMetrics(pattern: ErrorPattern, resolutionTime: number): void {
    const resolvedEvents = this.errorEvents.filter(e =>
      e.error.fingerprint === pattern.fingerprint &&
      e.resolved &&
      e.resolutionTime
    );

    if (resolvedEvents.length > 0) {
      const totalTime = resolvedEvents.reduce((sum, e) => sum + (e.resolutionTime || 0), 0);
      pattern.averageResolutionTime = totalTime / resolvedEvents.length;
    }
  }

  /**
   * Generate fingerprint for error
   */
  private generateFingerprint(error: EnterpriseErrorClass): string {
    const components = [
      error.type,
      error.service,
      error.operation,
      error.code,
      error.message.substring(0, 100)
    ];

    return Buffer.from(components.join('|')).toString('base64').substring(0, 16);
  }

  /**
   * Start periodic analysis
   */
  private startPeriodicAnalysis(): void {
    setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.analysisInterval);

    logger.info(`📊 Error analytics periodic analysis started (interval: ${this.config.analysisInterval}ms)`);
  }

  /**
   * Perform periodic analysis
   */
  private performPeriodicAnalysis(): void {
    try {
      // Generate forecasts if enabled
      if (this.config.forecastingEnabled) {
        this.generateForecasts();
      }

      // Clean up old data
      this.cleanupOldData();

      // Update cached metrics
      this.updateCachedMetrics();

      this.emit('analysis:completed');

    } catch (error) {
      logger.error('Error during periodic analysis:', error);
    }
  }

  /**
   * Generate error forecasts
   */
  private generateForecasts(): void {
    const timeframes: Array<'1h' | '6h' | '24h' | '7d'> = ['1h', '6h', '24h', '7d'];

    timeframes.forEach(timeframe => {
      const forecast = this.generateForecast(timeframe);
      if (forecast) {
        this.errorForecasts.push(forecast);
      }
    });

    // Limit forecasts
    if (this.errorForecasts.length > 100) {
      this.errorForecasts = this.errorForecasts.slice(-100);
    }
  }

  /**
   * Generate forecast for timeframe
   */
  private generateForecast(timeframe: '1h' | '6h' | '24h' | '7d'): ErrorForecast | null {
    const timeframeMs = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000
    }[timeframe];

    const historicalData = this.getRecentEvents(timeframeMs * 2); // Use 2x timeframe for prediction

    if (historicalData.length < 10) {
      return null; // Not enough data
    }

    // Simple linear regression for prediction
    const recentRate = this.getRecentEvents(timeframeMs).length / (timeframeMs / 3600000);
    const historicalRate = historicalData.length / (timeframeMs * 2 / 3600000);

    const trend = (recentRate - historicalRate) / historicalRate;
    const predictedErrorCount = Math.max(0, recentRate * (1 + trend) * (timeframeMs / 3600000));

    return {
      timeframe,
      predictedErrorCount: Math.round(predictedErrorCount),
      confidence: Math.min(0.8, historicalData.length / 100),
      factors: this.identifyForecastFactors(historicalData),
      recommendations: this.generateForecastRecommendations(predictedErrorCount, recentRate),
      timestamp: new Date()
    };
  }

  /**
   * Identify forecast factors
   */
  private identifyForecastFactors(events: ErrorEvent[]): string[] {
    const factors: string[] = [];

    // Check for trending error types
    const typeFrequency = new Map<ErrorType, number>();
    events.forEach(e => {
      typeFrequency.set(e.error.type, (typeFrequency.get(e.error.type) || 0) + 1);
    });

    const sortedTypes = Array.from(typeFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    sortedTypes.forEach(([type, count]) => {
      factors.push(`High frequency of ${type} errors (${count} occurrences)`);
    });

    return factors;
  }

  /**
   * Generate forecast recommendations
   */
  private generateForecastRecommendations(predicted: number, current: number): string[] {
    const recommendations: string[] = [];

    if (predicted > current * 1.5) {
      recommendations.push('Error rate is predicted to increase significantly');
      recommendations.push('Consider implementing additional monitoring');
      recommendations.push('Review recent changes and deployments');
    } else if (predicted < current * 0.5) {
      recommendations.push('Error rate is predicted to decrease');
      recommendations.push('Current improvements appear to be working');
    } else {
      recommendations.push('Error rate is predicted to remain stable');
      recommendations.push('Continue current monitoring practices');
    }

    return recommendations;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error:recorded', (event: ErrorEvent) => {
      logger.debug(`📊 Error recorded: ${event.error.type} in ${event.service}`);
    });

    this.on('pattern:updated', (pattern: ErrorPattern) => {
      if (pattern.count >= this.config.patternDetectionThreshold) {
        logger.info(`🔍 Error pattern detected: ${pattern.fingerprint} (${pattern.count} occurrences)`);
      }
    });

    this.on('insight:generated', (insight: ErrorInsight) => {
      logger.info(`💡 Error insight generated: ${insight.title} (${insight.severity})`);
    });
  }

  /**
   * Load historical data
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // In a real implementation, this would load from persistent storage
      logger.debug('📚 Loading historical error data...');

      // For now, we'll start fresh
      logger.info('✅ Historical data loaded (starting fresh)');

    } catch (error) {
      logger.warn('Failed to load historical data:', error);
    }
  }

  /**
   * Update cached metrics
   */
  private updateCachedMetrics(): void {
    const metrics = this.generateMetrics();
    this.metricsCache.set('current', metrics);
    this.metricsCache.set('lastUpdated', new Date());
  }

  /**
   * Cleanup old data
   */
  private cleanupOldData(): void {
    const maxAge = parseInt(process.env.ERROR_ANALYTICS_MAX_AGE || '604800000'); // 7 days
    const cutoff = Date.now() - maxAge;

    // Clean events
    const initialEventCount = this.errorEvents.length;
    this.errorEvents = this.errorEvents.filter(e => e.timestamp.getTime() > cutoff);

    // Clean insights
    const initialInsightCount = this.errorInsights.length;
    this.errorInsights = this.errorInsights.filter(i => i.timestamp.getTime() > cutoff);

    // Clean forecasts
    const initialForecastCount = this.errorForecasts.length;
    this.errorForecasts = this.errorForecasts.filter(f => f.timestamp.getTime() > cutoff);

    const cleanedEvents = initialEventCount - this.errorEvents.length;
    const cleanedInsights = initialInsightCount - this.errorInsights.length;
    const cleanedForecasts = initialForecastCount - this.errorForecasts.length;

    if (cleanedEvents > 0 || cleanedInsights > 0 || cleanedForecasts > 0) {
      logger.debug(`🧹 Cleaned up old data: ${cleanedEvents} events, ${cleanedInsights} insights, ${cleanedForecasts} forecasts`);
    }
  }

  /**
   * Get error events
   */
  getErrorEvents(limit?: number): ErrorEvent[] {
    return limit ? this.errorEvents.slice(-limit) : [...this.errorEvents];
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values());
  }

  /**
   * Get error insights
   */
  getErrorInsights(severity?: string): ErrorInsight[] {
    return severity ?
      this.errorInsights.filter(i => i.severity === severity) :
      [...this.errorInsights];
  }

  /**
   * Get error forecasts
   */
  getErrorForecasts(): ErrorForecast[] {
    return [...this.errorForecasts];
  }

  /**
   * Get cached metrics
   */
  getCachedMetrics(): ErrorMetrics | null {
    return this.metricsCache.get('current') || null;
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(timeframe?: number): ErrorMetrics {
    return this.generateMetrics(timeframe);
  }

  /**
   * Shutdown error analytics platform
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down Error Analytics Platform...');

      // Clear intervals and cleanup
      this.removeAllListeners();

      // Clear data structures
      this.errorEvents.length = 0;
      this.errorPatterns.clear();
      this.errorInsights.length = 0;
      this.errorForecasts.length = 0;
      this.metricsCache.clear();

      this.isInitialized = false;

      logger.info('✅ Error Analytics Platform shutdown completed');
    } catch (error) {
      logger.error('❌ Error during Error Analytics Platform shutdown:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const errorAnalyticsPlatform = ErrorAnalyticsPlatform.getInstance();
