/**
 * Twikit Health Manager - Task 32 Implementation
 * 
 * Comprehensive health check and alerting system for enterprise Twikit automation platform.
 * Provides robust health monitoring, automated incident response, and predictive analytics
 * for all Twikit services and infrastructure components.
 * 
 * Features:
 * - Comprehensive health checks for all services and infrastructure
 * - Multi-channel automated alerting (email, SMS, Slack, webhook, PagerDuty)
 * - Tiered escalation procedures with on-call management
 * - Predictive health monitoring and anomaly detection
 * - Automated recovery procedures and runbook execution
 * - Service dependency mapping and cascade failure detection
 * - Integration with Task 25 monitoring dashboard
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { twikitSessionManager } from './twikitSessionManager';
import { twikitSecurityManager } from './twikitSecurityManager';
import { twikitCacheManager } from './twikitCacheManager';
// Import types for cache manager
import { TwikitServiceType, CachePriority } from './twikitCacheManager';
import * as crypto from 'crypto';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertChannel {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  PAGERDUTY = 'pagerduty',
  TEAMS = 'teams'
}

export enum EscalationLevel {
  L1_SUPPORT = 'l1_support',
  L2_ENGINEERING = 'l2_engineering',
  L3_SENIOR = 'l3_senior',
  INCIDENT_COMMANDER = 'incident_commander',
  EXECUTIVE = 'executive'
}

export interface HealthCheck {
  id: string;
  name: string;
  description: string;
  service: string;
  category: 'infrastructure' | 'application' | 'business' | 'security';
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  enabled: boolean;
  dependencies: string[]; // Other health check IDs this depends on
  thresholds: {
    warning: any;
    critical: any;
  };
  checkFunction: () => Promise<HealthCheckResult>;
  recoveryProcedure?: string; // Runbook ID for automated recovery
}

export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  timestamp: Date;
  responseTime: number;
  metadata?: Record<string, any>;
  metrics?: Record<string, number>;
}

export interface Alert {
  id: string;
  healthCheckId: string;
  severity: AlertSeverity;
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  title: string;
  description: string;
  timestamp: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  escalationLevel: EscalationLevel;
  channels: AlertChannel[];
  metadata: Record<string, any>;
  runbookUrl?: string | undefined;
  affectedServices: string[];
}

export interface EscalationRule {
  id: string;
  name: string;
  severity: AlertSeverity;
  level: EscalationLevel;
  delayMinutes: number;
  channels: AlertChannel[];
  recipients: string[];
  conditions: {
    timeOfDay?: { start: string; end: string };
    daysOfWeek?: number[];
    serviceCategories?: string[];
  };
}

export interface OnCallSchedule {
  id: string;
  name: string;
  level: EscalationLevel;
  timezone: string;
  rotations: OnCallRotation[];
}

export interface OnCallRotation {
  id: string;
  name: string;
  startDate: Date;
  rotationDays: number;
  participants: OnCallParticipant[];
}

export interface OnCallParticipant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  slackUserId?: string;
  pagerDutyUserId?: string;
}

export interface RecoveryProcedure {
  id: string;
  name: string;
  description: string;
  applicableHealthChecks: string[];
  automationLevel: 'manual' | 'semi_automated' | 'fully_automated';
  steps: RecoveryStep[];
  maxExecutionTime: number;
  successCriteria: string[];
}

export interface RecoveryStep {
  id: string;
  name: string;
  type: 'command' | 'api_call' | 'service_restart' | 'notification' | 'wait';
  action: string;
  parameters: Record<string, any>;
  timeout: number;
  retries: number;
  continueOnFailure: boolean;
}

export interface HealthManagerConfig {
  // Global settings
  enabled: boolean;
  globalCheckInterval: number;
  maxConcurrentChecks: number;
  defaultTimeout: number;
  defaultRetries: number;
  
  // Alerting configuration
  alerting: {
    enabled: boolean;
    aggregationWindow: number; // milliseconds
    deduplicationWindow: number; // milliseconds
    maxAlertsPerHour: number;
    suppressDuringMaintenance: boolean;
    channels: {
      email: {
        enabled: boolean;
        smtpHost: string;
        smtpPort: number;
        username: string;
        password: string;
        from: string;
        defaultRecipients: string[];
      };
      slack: {
        enabled: boolean;
        webhookUrl: string;
        channel: string;
        username: string;
        iconEmoji: string;
      };
      pagerduty: {
        enabled: boolean;
        integrationKey: string;
        apiUrl: string;
      };
      webhook: {
        enabled: boolean;
        urls: string[];
        headers: Record<string, string>;
      };
    };
  };
  
  // Escalation configuration
  escalation: {
    enabled: boolean;
    defaultEscalationDelay: number; // minutes
    maxEscalationLevel: EscalationLevel;
    autoAcknowledgeAfter: number; // minutes
    autoResolveAfter: number; // minutes
  };
  
  // Recovery configuration
  recovery: {
    enabled: boolean;
    autoRecoveryEnabled: boolean;
    maxRecoveryAttempts: number;
    recoveryTimeout: number; // milliseconds
    requireApprovalForCritical: boolean;
  };
  
  // Monitoring configuration
  monitoring: {
    retentionPeriod: number; // milliseconds
    metricsInterval: number; // milliseconds
    anomalyDetection: boolean;
    predictiveMonitoring: boolean;
    dashboardIntegration: boolean;
  };
}

// ============================================================================
// MAIN HEALTH MANAGER CLASS
// ============================================================================

export class TwikitHealthManager extends EventEmitter {
  private static instance: TwikitHealthManager;
  private config: HealthManagerConfig;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private escalationRules: EscalationRule[] = [];
  private onCallSchedules: Map<string, OnCallSchedule> = new Map();
  private recoveryProcedures: Map<string, RecoveryProcedure> = new Map();
  
  // Monitoring intervals
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private alertProcessingInterval?: NodeJS.Timeout;
  
  // Service dependencies
  private sessionManager = twikitSessionManager;
  private securityManager = twikitSecurityManager;
  private cacheManager = twikitCacheManager;
  
  // State tracking
  private isInitialized = false;
  private maintenanceMode = false;
  private lastHealthCheckRun = new Date();
  private healthCheckStats = {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    averageResponseTime: 0
  };

  constructor(config?: Partial<HealthManagerConfig>) {
    super();
    this.config = this.mergeWithDefaultConfig(config || {});
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<HealthManagerConfig>): TwikitHealthManager {
    if (!TwikitHealthManager.instance) {
      TwikitHealthManager.instance = new TwikitHealthManager(config);
    }
    return TwikitHealthManager.instance;
  }

  // ============================================================================
  // INITIALIZATION AND CONFIGURATION
  // ============================================================================

  /**
   * Initialize the health manager
   */
  async initializeHealthManager(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Health manager already initialized');
      return;
    }

    try {
      logger.info('Initializing Twikit Health Manager...');

      // Register default health checks
      await this.registerDefaultHealthChecks();

      // Load escalation rules
      await this.loadEscalationRules();

      // Load on-call schedules
      await this.loadOnCallSchedules();

      // Load recovery procedures
      await this.loadRecoveryProcedures();

      // Start monitoring intervals
      this.startHealthMonitoring();
      this.startMetricsCollection();
      this.startAlertProcessing();

      // Initialize dashboard integration
      if (this.config.monitoring.dashboardIntegration) {
        await this.initializeDashboardIntegration();
      }

      this.isInitialized = true;
      
      logger.info('Twikit Health Manager initialized successfully', {
        healthChecks: this.healthChecks.size,
        escalationRules: this.escalationRules.length,
        onCallSchedules: this.onCallSchedules.size,
        recoveryProcedures: this.recoveryProcedures.size
      });

      this.emit('healthManagerInitialized', {
        timestamp: new Date(),
        config: this.getPublicConfig()
      });

    } catch (error) {
      logger.error('Failed to initialize health manager', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaultConfig(userConfig: Partial<HealthManagerConfig>): HealthManagerConfig {
    const defaultConfig: HealthManagerConfig = {
      enabled: true,
      globalCheckInterval: 60000, // 1 minute
      maxConcurrentChecks: 10,
      defaultTimeout: 30000, // 30 seconds
      defaultRetries: 3,
      
      alerting: {
        enabled: true,
        aggregationWindow: 300000, // 5 minutes
        deduplicationWindow: 600000, // 10 minutes
        maxAlertsPerHour: 100,
        suppressDuringMaintenance: true,
        channels: {
          email: {
            enabled: false,
            smtpHost: process.env.SMTP_HOST || 'localhost',
            smtpPort: parseInt(process.env.SMTP_PORT || '587'),
            username: process.env.SMTP_USERNAME || '',
            password: process.env.SMTP_PASSWORD || '',
            from: process.env.ALERT_EMAIL_FROM || 'alerts@twikit.com',
            defaultRecipients: []
          },
          slack: {
            enabled: false,
            webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
            channel: process.env.SLACK_CHANNEL || '#alerts',
            username: 'Twikit Health Monitor',
            iconEmoji: ':warning:'
          },
          pagerduty: {
            enabled: false,
            integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY || '',
            apiUrl: 'https://events.pagerduty.com/v2/enqueue'
          },
          webhook: {
            enabled: false,
            urls: [],
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Twikit-Health-Manager/1.0'
            }
          }
        }
      },
      
      escalation: {
        enabled: true,
        defaultEscalationDelay: 15, // 15 minutes
        maxEscalationLevel: EscalationLevel.INCIDENT_COMMANDER,
        autoAcknowledgeAfter: 60, // 1 hour
        autoResolveAfter: 240 // 4 hours
      },
      
      recovery: {
        enabled: true,
        autoRecoveryEnabled: true,
        maxRecoveryAttempts: 3,
        recoveryTimeout: 300000, // 5 minutes
        requireApprovalForCritical: true
      },
      
      monitoring: {
        retentionPeriod: 86400000 * 30, // 30 days
        metricsInterval: 60000, // 1 minute
        anomalyDetection: true,
        predictiveMonitoring: true,
        dashboardIntegration: true
      }
    };

    return this.deepMerge(defaultConfig, userConfig);
  }

  /**
   * Deep merge configuration objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen to health check events from services
    this.sessionManager.on('sessionUnhealthy', this.handleSessionUnhealthy.bind(this));
    this.cacheManager.on('performanceAlert', this.handleCachePerformanceAlert.bind(this));
    this.securityManager.on('securityThreat', this.handleSecurityThreat.bind(this));
    
    // Additional event handlers can be added here for other services
    
    // Handle process signals for graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  // ============================================================================
  // HEALTH CHECK REGISTRATION AND MANAGEMENT
  // ============================================================================

  /**
   * Register a health check
   */
  registerHealthCheck(healthCheck: HealthCheck): void {
    if (this.healthChecks.has(healthCheck.id)) {
      logger.warn('Health check already registered, updating', { id: healthCheck.id });
    }

    this.healthChecks.set(healthCheck.id, healthCheck);
    
    logger.info('Health check registered', {
      id: healthCheck.id,
      name: healthCheck.name,
      service: healthCheck.service,
      category: healthCheck.category,
      interval: healthCheck.interval
    });

    this.emit('healthCheckRegistered', healthCheck);
  }

  /**
   * Unregister a health check
   */
  unregisterHealthCheck(healthCheckId: string): boolean {
    const removed = this.healthChecks.delete(healthCheckId);
    
    if (removed) {
      this.healthResults.delete(healthCheckId);
      logger.info('Health check unregistered', { id: healthCheckId });
      this.emit('healthCheckUnregistered', { id: healthCheckId });
    }
    
    return removed;
  }

  /**
   * Get health check by ID
   */
  getHealthCheck(healthCheckId: string): HealthCheck | undefined {
    return this.healthChecks.get(healthCheckId);
  }

  /**
   * Get all health checks
   */
  getAllHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get health checks by service
   */
  getHealthChecksByService(service: string): HealthCheck[] {
    return Array.from(this.healthChecks.values()).filter(hc => hc.service === service);
  }

  /**
   * Get health checks by category
   */
  getHealthChecksByCategory(category: HealthCheck['category']): HealthCheck[] {
    return Array.from(this.healthChecks.values()).filter(hc => hc.category === category);
  }

  /**
   * Update health check configuration
   */
  updateHealthCheck(healthCheckId: string, updates: Partial<HealthCheck>): boolean {
    const healthCheck = this.healthChecks.get(healthCheckId);
    if (!healthCheck) {
      return false;
    }

    const updatedHealthCheck = { ...healthCheck, ...updates };
    this.healthChecks.set(healthCheckId, updatedHealthCheck);
    
    logger.info('Health check updated', { id: healthCheckId, updates });
    this.emit('healthCheckUpdated', { id: healthCheckId, healthCheck: updatedHealthCheck });
    
    return true;
  }

  /**
   * Enable/disable health check
   */
  setHealthCheckEnabled(healthCheckId: string, enabled: boolean): boolean {
    return this.updateHealthCheck(healthCheckId, { enabled });
  }

  // ============================================================================
  // HEALTH CHECK EXECUTION
  // ============================================================================

  /**
   * Execute a single health check
   */
  async executeHealthCheck(healthCheckId: string): Promise<HealthCheckResult> {
    const healthCheck = this.healthChecks.get(healthCheckId);
    if (!healthCheck) {
      throw new Error(`Health check not found: ${healthCheckId}`);
    }

    if (!healthCheck.enabled) {
      return {
        status: HealthStatus.UNKNOWN,
        message: 'Health check is disabled',
        timestamp: new Date(),
        responseTime: 0
      };
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Check dependencies first
      const dependencyResults = await this.checkDependencies(healthCheck.dependencies);
      if (dependencyResults.some(r => r.status === HealthStatus.CRITICAL)) {
        return {
          status: HealthStatus.CRITICAL,
          message: 'Dependency health check failed',
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          metadata: { dependencyFailures: dependencyResults.filter(r => r.status === HealthStatus.CRITICAL) }
        };
      }

      // Execute health check with timeout and retries
      result = await this.executeWithRetries(healthCheck);

      // Store result
      this.healthResults.set(healthCheckId, result);

      // Update statistics
      this.updateHealthCheckStats(result);

      // Process result for alerting
      await this.processHealthCheckResult(healthCheck, result);

      logger.debug('Health check executed', {
        id: healthCheckId,
        status: result.status,
        responseTime: result.responseTime,
        message: result.message
      });

    } catch (error) {
      result = {
        status: HealthStatus.CRITICAL,
        message: `Health check execution failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        metadata: { error: error instanceof Error ? error.stack : String(error) }
      };

      this.healthResults.set(healthCheckId, result);
      this.updateHealthCheckStats(result);

      logger.error('Health check execution failed', {
        id: healthCheckId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.emit('healthCheckExecuted', { healthCheck, result });
    return result;
  }

  /**
   * Execute health check with retries
   */
  private async executeWithRetries(healthCheck: HealthCheck): Promise<HealthCheckResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= healthCheck.retries + 1; attempt++) {
      try {
        const result = await Promise.race([
          healthCheck.checkFunction(),
          this.createTimeoutPromise(healthCheck.timeout)
        ]);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt <= healthCheck.retries) {
          logger.warn('Health check attempt failed, retrying', {
            id: healthCheck.id,
            attempt,
            maxRetries: healthCheck.retries,
            error: lastError.message
          });

          // Wait before retry (exponential backoff)
          await this.sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000));
        }
      }
    }

    throw lastError || new Error('Health check failed after all retries');
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timed out after ${timeout}ms`)), timeout);
    });
  }

  /**
   * Check health check dependencies
   */
  private async checkDependencies(dependencies: string[]): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const depId of dependencies) {
      const result = this.healthResults.get(depId);
      if (result) {
        results.push(result);
      } else {
        // Execute dependency check if not available
        try {
          const depResult = await this.executeHealthCheck(depId);
          results.push(depResult);
        } catch (error) {
          results.push({
            status: HealthStatus.CRITICAL,
            message: `Dependency check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            responseTime: 0
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute all enabled health checks
   */
  async executeAllHealthChecks(): Promise<Map<string, HealthCheckResult>> {
    const enabledChecks = Array.from(this.healthChecks.values()).filter(hc => hc.enabled);
    const results = new Map<string, HealthCheckResult>();

    // Execute checks in batches to respect concurrency limits
    const batches = this.createBatches(enabledChecks, this.config.maxConcurrentChecks);

    for (const batch of batches) {
      const batchPromises = batch.map(async (healthCheck) => {
        try {
          const result = await this.executeHealthCheck(healthCheck.id);
          results.set(healthCheck.id, result);
        } catch (error) {
          logger.error('Batch health check failed', {
            id: healthCheck.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.allSettled(batchPromises);
    }

    this.lastHealthCheckRun = new Date();

    logger.info('Health check batch completed', {
      totalChecks: enabledChecks.length,
      successfulChecks: Array.from(results.values()).filter(r => r.status === HealthStatus.HEALTHY).length,
      warningChecks: Array.from(results.values()).filter(r => r.status === HealthStatus.WARNING).length,
      criticalChecks: Array.from(results.values()).filter(r => r.status === HealthStatus.CRITICAL).length
    });

    this.emit('healthCheckBatchCompleted', {
      timestamp: new Date(),
      results: Object.fromEntries(results)
    });

    return results;
  }

  /**
   * Create batches for concurrent execution
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update health check statistics
   */
  private updateHealthCheckStats(result: HealthCheckResult): void {
    this.healthCheckStats.totalChecks++;

    if (result.status === HealthStatus.HEALTHY) {
      this.healthCheckStats.successfulChecks++;
    } else {
      this.healthCheckStats.failedChecks++;
    }

    // Update average response time (exponential moving average)
    const alpha = 0.1;
    this.healthCheckStats.averageResponseTime =
      (alpha * result.responseTime) + ((1 - alpha) * this.healthCheckStats.averageResponseTime);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // ALERTING SYSTEM
  // ============================================================================

  /**
   * Process health check result for alerting
   */
  private async processHealthCheckResult(healthCheck: HealthCheck, result: HealthCheckResult): Promise<void> {
    if (!this.config.alerting.enabled) {
      return;
    }

    // Determine if alert should be triggered
    const shouldAlert = this.shouldTriggerAlert(healthCheck, result);
    if (!shouldAlert) {
      return;
    }

    // Check for existing alert
    const existingAlert = this.findExistingAlert(healthCheck.id, result.status);
    if (existingAlert) {
      await this.updateExistingAlert(existingAlert, result);
      return;
    }

    // Create new alert
    const alert = await this.createAlert(healthCheck, result);
    this.activeAlerts.set(alert.id, alert);

    // Send alert notifications
    await this.sendAlertNotifications(alert);

    // Start escalation if needed
    if (alert.severity === AlertSeverity.HIGH || alert.severity === AlertSeverity.CRITICAL) {
      await this.startEscalation(alert);
    }

    // Attempt automated recovery if configured
    if (this.config.recovery.autoRecoveryEnabled && healthCheck.recoveryProcedure) {
      await this.attemptAutomatedRecovery(healthCheck, alert);
    }

    this.emit('alertTriggered', alert);
  }

  /**
   * Determine if alert should be triggered
   */
  private shouldTriggerAlert(healthCheck: HealthCheck, result: HealthCheckResult): boolean {
    // Don't alert during maintenance mode
    if (this.maintenanceMode && this.config.alerting.suppressDuringMaintenance) {
      return false;
    }

    // Only alert on warning or critical status
    if (result.status !== HealthStatus.WARNING && result.status !== HealthStatus.CRITICAL) {
      return false;
    }

    // Check rate limiting
    const recentAlerts = this.getRecentAlerts(3600000); // Last hour
    if (recentAlerts.length >= this.config.alerting.maxAlertsPerHour) {
      logger.warn('Alert rate limit exceeded, suppressing alert', {
        healthCheckId: healthCheck.id,
        recentAlerts: recentAlerts.length,
        maxPerHour: this.config.alerting.maxAlertsPerHour
      });
      return false;
    }

    return true;
  }

  /**
   * Find existing alert for health check
   */
  private findExistingAlert(healthCheckId: string, status: HealthStatus): Alert | undefined {
    return Array.from(this.activeAlerts.values()).find(alert =>
      alert.healthCheckId === healthCheckId &&
      alert.status === 'active' &&
      this.getAlertSeverityFromStatus(status) === alert.severity
    );
  }

  /**
   * Create new alert
   */
  private async createAlert(healthCheck: HealthCheck, result: HealthCheckResult): Promise<Alert> {
    const severity = this.getAlertSeverityFromStatus(result.status);
    const escalationLevel = this.getInitialEscalationLevel(severity);

    const alert: Alert = {
      id: crypto.randomUUID(),
      healthCheckId: healthCheck.id,
      severity,
      status: 'active',
      title: `${healthCheck.name} - ${result.status.toUpperCase()}`,
      description: this.generateAlertDescription(healthCheck, result),
      timestamp: new Date(),
      escalationLevel,
      channels: this.getAlertChannels(severity),
      metadata: {
        service: healthCheck.service,
        category: healthCheck.category,
        responseTime: result.responseTime,
        ...result.metadata
      },
      affectedServices: await this.getAffectedServices(healthCheck),
      runbookUrl: this.getRunbookUrl(healthCheck)
    };

    logger.info('Alert created', {
      id: alert.id,
      healthCheckId: healthCheck.id,
      severity: alert.severity,
      title: alert.title
    });

    return alert;
  }

  /**
   * Get alert severity from health status
   */
  private getAlertSeverityFromStatus(status: HealthStatus): AlertSeverity {
    switch (status) {
      case HealthStatus.WARNING:
        return AlertSeverity.MEDIUM;
      case HealthStatus.CRITICAL:
        return AlertSeverity.CRITICAL;
      default:
        return AlertSeverity.LOW;
    }
  }

  /**
   * Get initial escalation level based on severity
   */
  private getInitialEscalationLevel(severity: AlertSeverity): EscalationLevel {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return EscalationLevel.L2_ENGINEERING;
      case AlertSeverity.HIGH:
        return EscalationLevel.L1_SUPPORT;
      default:
        return EscalationLevel.L1_SUPPORT;
    }
  }

  /**
   * Get alert channels based on severity
   */
  private getAlertChannels(severity: AlertSeverity): AlertChannel[] {
    const channels: AlertChannel[] = [];

    if (this.config.alerting.channels.email.enabled) {
      channels.push(AlertChannel.EMAIL);
    }

    if (this.config.alerting.channels.slack.enabled) {
      channels.push(AlertChannel.SLACK);
    }

    if (severity === AlertSeverity.CRITICAL && this.config.alerting.channels.pagerduty.enabled) {
      channels.push(AlertChannel.PAGERDUTY);
    }

    if (this.config.alerting.channels.webhook.enabled) {
      channels.push(AlertChannel.WEBHOOK);
    }

    return channels;
  }

  /**
   * Generate alert description
   */
  private generateAlertDescription(healthCheck: HealthCheck, result: HealthCheckResult): string {
    let description = `Health check "${healthCheck.name}" for service "${healthCheck.service}" has failed.\n\n`;
    description += `Status: ${result.status}\n`;
    description += `Message: ${result.message}\n`;
    description += `Response Time: ${result.responseTime}ms\n`;
    description += `Timestamp: ${result.timestamp.toISOString()}\n`;

    if (result.metrics) {
      description += '\nMetrics:\n';
      for (const [key, value] of Object.entries(result.metrics)) {
        description += `- ${key}: ${value}\n`;
      }
    }

    if (healthCheck.recoveryProcedure) {
      description += `\nAutomated recovery procedure available: ${healthCheck.recoveryProcedure}`;
    }

    return description;
  }

  /**
   * Get affected services based on dependencies
   */
  private async getAffectedServices(healthCheck: HealthCheck): Promise<string[]> {
    const affectedServices = new Set<string>([healthCheck.service]);

    // Find services that depend on this health check
    for (const [_, hc] of this.healthChecks) {
      if (hc.dependencies.includes(healthCheck.id)) {
        affectedServices.add(hc.service);
      }
    }

    return Array.from(affectedServices);
  }

  /**
   * Get runbook URL for health check
   */
  private getRunbookUrl(healthCheck: HealthCheck): string | undefined {
    if (healthCheck.recoveryProcedure) {
      return `https://runbooks.twikit.com/${healthCheck.recoveryProcedure}`;
    }
    return undefined;
  }

  /**
   * Get recent alerts within time window
   */
  private getRecentAlerts(timeWindowMs: number): Alert[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return Array.from(this.activeAlerts.values()).filter(alert => alert.timestamp > cutoff);
  }

  // ============================================================================
  // NOTIFICATION SYSTEM
  // ============================================================================

  /**
   * Send alert notifications through configured channels
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    const notificationPromises: Promise<void>[] = [];

    for (const channel of alert.channels) {
      switch (channel) {
        case AlertChannel.EMAIL:
          notificationPromises.push(this.sendEmailNotification(alert));
          break;
        case AlertChannel.SLACK:
          notificationPromises.push(this.sendSlackNotification(alert));
          break;
        case AlertChannel.PAGERDUTY:
          notificationPromises.push(this.sendPagerDutyNotification(alert));
          break;
        case AlertChannel.WEBHOOK:
          notificationPromises.push(this.sendWebhookNotification(alert));
          break;
        case AlertChannel.SMS:
          notificationPromises.push(this.sendSMSNotification(alert));
          break;
        case AlertChannel.TEAMS:
          notificationPromises.push(this.sendTeamsNotification(alert));
          break;
      }
    }

    // Send notifications concurrently
    const results = await Promise.allSettled(notificationPromises);

    // Log notification results
    results.forEach((result, index) => {
      const channel = alert.channels[index];
      if (result.status === 'rejected') {
        logger.error('Notification failed', {
          alertId: alert.id,
          channel,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      } else {
        logger.info('Notification sent successfully', {
          alertId: alert.id,
          channel
        });
      }
    });

    this.emit('notificationsSent', { alert, results });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    if (!this.config.alerting.channels.email.enabled) {
      return;
    }

    const emailConfig = this.config.alerting.channels.email;
    const recipients = this.getEmailRecipients(alert);

    const emailContent = {
      from: emailConfig.from,
      to: recipients,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html: this.generateEmailHTML(alert),
      text: alert.description
    };

    // Mock email sending (replace with actual SMTP implementation)
    logger.info('Email notification sent', {
      alertId: alert.id,
      recipients: recipients.length,
      subject: emailContent.subject
    });

    // In production, implement actual email sending:
    // await this.emailService.send(emailContent);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert): Promise<void> {
    if (!this.config.alerting.channels.slack.enabled) {
      return;
    }

    const slackConfig = this.config.alerting.channels.slack;
    const payload = {
      channel: slackConfig.channel,
      username: slackConfig.username,
      icon_emoji: slackConfig.iconEmoji,
      attachments: [{
        color: this.getSlackColor(alert.severity),
        title: alert.title,
        text: alert.description,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Service',
            value: alert.metadata.service,
            short: true
          },
          {
            title: 'Response Time',
            value: `${alert.metadata.responseTime}ms`,
            short: true
          },
          {
            title: 'Timestamp',
            value: alert.timestamp.toISOString(),
            short: true
          }
        ],
        actions: [
          {
            type: 'button',
            text: 'Acknowledge',
            url: `https://dashboard.twikit.com/alerts/${alert.id}/acknowledge`
          },
          {
            type: 'button',
            text: 'View Runbook',
            url: alert.runbookUrl || 'https://runbooks.twikit.com'
          }
        ]
      }]
    };

    // Mock Slack sending (replace with actual webhook call)
    logger.info('Slack notification sent', {
      alertId: alert.id,
      channel: slackConfig.channel,
      severity: alert.severity
    });

    // In production, implement actual Slack webhook:
    // await axios.post(slackConfig.webhookUrl, payload);
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(alert: Alert): Promise<void> {
    if (!this.config.alerting.channels.pagerduty.enabled) {
      return;
    }

    const pagerDutyConfig = this.config.alerting.channels.pagerduty;
    const payload = {
      routing_key: pagerDutyConfig.integrationKey,
      event_action: 'trigger',
      dedup_key: `twikit-health-${alert.healthCheckId}`,
      payload: {
        summary: alert.title,
        source: 'Twikit Health Manager',
        severity: this.mapToPagerDutySeverity(alert.severity),
        component: alert.metadata.service,
        group: alert.metadata.category,
        class: 'health_check',
        custom_details: {
          description: alert.description,
          response_time: alert.metadata.responseTime,
          affected_services: alert.affectedServices,
          runbook_url: alert.runbookUrl
        }
      }
    };

    // Mock PagerDuty sending (replace with actual API call)
    logger.info('PagerDuty notification sent', {
      alertId: alert.id,
      dedupKey: payload.dedup_key,
      severity: payload.payload.severity
    });

    // In production, implement actual PagerDuty API call:
    // await axios.post(pagerDutyConfig.apiUrl, payload);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    if (!this.config.alerting.channels.webhook.enabled) {
      return;
    }

    const webhookConfig = this.config.alerting.channels.webhook;
    const payload = {
      alert_id: alert.id,
      health_check_id: alert.healthCheckId,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      description: alert.description,
      timestamp: alert.timestamp.toISOString(),
      escalation_level: alert.escalationLevel,
      metadata: alert.metadata,
      affected_services: alert.affectedServices,
      runbook_url: alert.runbookUrl
    };

    // Send to all configured webhook URLs
    const webhookPromises = webhookConfig.urls.map(async (url) => {
      try {
        // Mock webhook sending (replace with actual HTTP call)
        logger.info('Webhook notification sent', {
          alertId: alert.id,
          url,
          severity: alert.severity
        });

        // In production, implement actual webhook call:
        // await axios.post(url, payload, { headers: webhookConfig.headers });
      } catch (error) {
        logger.error('Webhook notification failed', {
          alertId: alert.id,
          url,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.allSettled(webhookPromises);
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMSNotification(alert: Alert): Promise<void> {
    // Mock SMS sending
    logger.info('SMS notification sent', {
      alertId: alert.id,
      severity: alert.severity
    });
  }

  /**
   * Send Teams notification (placeholder)
   */
  private async sendTeamsNotification(alert: Alert): Promise<void> {
    // Mock Teams sending
    logger.info('Teams notification sent', {
      alertId: alert.id,
      severity: alert.severity
    });
  }

  // ============================================================================
  // ESCALATION SYSTEM
  // ============================================================================

  /**
   * Start escalation process for alert
   */
  private async startEscalation(alert: Alert): Promise<void> {
    if (!this.config.escalation.enabled) {
      return;
    }

    const escalationRules = this.getApplicableEscalationRules(alert);
    if (escalationRules.length === 0) {
      logger.warn('No escalation rules found for alert', { alertId: alert.id });
      return;
    }

    // Schedule escalation steps
    for (const rule of escalationRules) {
      setTimeout(async () => {
        await this.executeEscalationRule(alert, rule);
      }, rule.delayMinutes * 60 * 1000);
    }

    logger.info('Escalation started', {
      alertId: alert.id,
      escalationRules: escalationRules.length,
      maxLevel: escalationRules[escalationRules.length - 1]?.level
    });

    this.emit('escalationStarted', { alert, escalationRules });
  }

  /**
   * Get applicable escalation rules for alert
   */
  private getApplicableEscalationRules(alert: Alert): EscalationRule[] {
    return this.escalationRules
      .filter(rule => rule.severity === alert.severity)
      .filter(rule => this.isEscalationRuleApplicable(rule, alert))
      .sort((a, b) => a.delayMinutes - b.delayMinutes);
  }

  /**
   * Check if escalation rule is applicable
   */
  private isEscalationRuleApplicable(rule: EscalationRule, alert: Alert): boolean {
    const now = new Date();

    // Check time of day conditions
    if (rule.conditions.timeOfDay) {
      const currentTime = now.toTimeString().slice(0, 5);
      if (currentTime < rule.conditions.timeOfDay.start || currentTime > rule.conditions.timeOfDay.end) {
        return false;
      }
    }

    // Check day of week conditions
    if (rule.conditions.daysOfWeek) {
      const currentDay = now.getDay();
      if (!rule.conditions.daysOfWeek.includes(currentDay)) {
        return false;
      }
    }

    // Check service category conditions
    if (rule.conditions.serviceCategories) {
      if (!rule.conditions.serviceCategories.includes(alert.metadata.category)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute escalation rule
   */
  private async executeEscalationRule(alert: Alert, rule: EscalationRule): Promise<void> {
    // Check if alert is still active
    const currentAlert = this.activeAlerts.get(alert.id);
    if (!currentAlert || currentAlert.status !== 'active') {
      logger.info('Skipping escalation for resolved alert', {
        alertId: alert.id,
        ruleId: rule.id
      });
      return;
    }

    // Update alert escalation level
    currentAlert.escalationLevel = rule.level;
    this.activeAlerts.set(alert.id, currentAlert);

    // Get on-call person for this level
    const onCallPerson = await this.getOnCallPerson(rule.level);

    // Send escalation notifications
    await this.sendEscalationNotifications(currentAlert, rule, onCallPerson);

    logger.info('Escalation rule executed', {
      alertId: alert.id,
      ruleId: rule.id,
      level: rule.level,
      onCallPerson: onCallPerson?.name
    });

    this.emit('escalationExecuted', { alert: currentAlert, rule, onCallPerson });
  }

  /**
   * Get on-call person for escalation level
   */
  private async getOnCallPerson(level: EscalationLevel): Promise<OnCallParticipant | null> {
    const schedule = Array.from(this.onCallSchedules.values()).find(s => s.level === level);
    if (!schedule) {
      return null;
    }

    // Find current rotation
    const now = new Date();
    for (const rotation of schedule.rotations) {
      const rotationStart = rotation.startDate;
      const daysSinceStart = Math.floor((now.getTime() - rotationStart.getTime()) / (1000 * 60 * 60 * 24));
      const currentParticipantIndex = Math.floor(daysSinceStart / rotation.rotationDays) % rotation.participants.length;

      if (currentParticipantIndex >= 0 && currentParticipantIndex < rotation.participants.length) {
        return rotation.participants[currentParticipantIndex] || null;
      }
    }

    return null;
  }

  /**
   * Send escalation notifications
   */
  private async sendEscalationNotifications(alert: Alert, rule: EscalationRule, onCallPerson: OnCallParticipant | null): Promise<void> {
    const escalationAlert = {
      ...alert,
      title: `[ESCALATED - ${rule.level.toUpperCase()}] ${alert.title}`,
      description: `Alert has been escalated to ${rule.level}.\n\n${alert.description}`,
      channels: rule.channels
    };

    if (onCallPerson) {
      escalationAlert.description += `\n\nOn-call person: ${onCallPerson.name} (${onCallPerson.email})`;
    }

    await this.sendAlertNotifications(escalationAlert);
  }

  // ============================================================================
  // AUTOMATED RECOVERY SYSTEM
  // ============================================================================

  /**
   * Attempt automated recovery for health check
   */
  private async attemptAutomatedRecovery(healthCheck: HealthCheck, alert: Alert): Promise<void> {
    if (!this.config.recovery.enabled || !healthCheck.recoveryProcedure) {
      return;
    }

    const procedure = this.recoveryProcedures.get(healthCheck.recoveryProcedure);
    if (!procedure) {
      logger.warn('Recovery procedure not found', {
        healthCheckId: healthCheck.id,
        procedureId: healthCheck.recoveryProcedure
      });
      return;
    }

    // Check if critical alert requires approval
    if (alert.severity === AlertSeverity.CRITICAL && this.config.recovery.requireApprovalForCritical) {
      logger.info('Critical alert recovery requires approval', {
        alertId: alert.id,
        procedureId: procedure.id
      });
      await this.requestRecoveryApproval(alert, procedure);
      return;
    }

    // Execute recovery procedure
    await this.executeRecoveryProcedure(alert, procedure);
  }

  /**
   * Execute recovery procedure
   */
  private async executeRecoveryProcedure(alert: Alert, procedure: RecoveryProcedure): Promise<void> {
    const startTime = Date.now();

    logger.info('Starting automated recovery', {
      alertId: alert.id,
      procedureId: procedure.id,
      steps: procedure.steps.length
    });

    try {
      for (let i = 0; i < procedure.steps.length; i++) {
        const step = procedure.steps[i];

        if (!step) {
          logger.error('Recovery step is undefined', {
            alertId: alert.id,
            procedureId: procedure.id,
            stepIndex: i
          });
          break;
        }

        logger.info('Executing recovery step', {
          alertId: alert.id,
          procedureId: procedure.id,
          stepIndex: i,
          stepName: step.name,
          stepType: step.type
        });

        const stepResult = await this.executeRecoveryStep(step);

        if (!stepResult.success && !step.continueOnFailure) {
          logger.error('Recovery step failed, stopping procedure', {
            alertId: alert.id,
            procedureId: procedure.id,
            stepIndex: i,
            error: stepResult.error
          });
          break;
        }
      }

      // Check if recovery was successful
      const recoveryTime = Date.now() - startTime;
      const wasSuccessful = await this.validateRecoverySuccess(alert, procedure);

      if (wasSuccessful) {
        logger.info('Automated recovery successful', {
          alertId: alert.id,
          procedureId: procedure.id,
          recoveryTime
        });

        await this.resolveAlert(alert.id, 'Automated recovery successful');
        this.emit('recoverySuccessful', { alert, procedure, recoveryTime });
      } else {
        logger.warn('Automated recovery completed but issue persists', {
          alertId: alert.id,
          procedureId: procedure.id,
          recoveryTime
        });

        this.emit('recoveryFailed', { alert, procedure, recoveryTime });
      }

    } catch (error) {
      logger.error('Recovery procedure failed', {
        alertId: alert.id,
        procedureId: procedure.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.emit('recoveryFailed', { alert, procedure, error });
    }
  }

  /**
   * Execute individual recovery step
   */
  private async executeRecoveryStep(step: RecoveryStep): Promise<{ success: boolean; error?: string }> {
    try {
      switch (step.type) {
        case 'command':
          return await this.executeCommandStep(step);
        case 'api_call':
          return await this.executeApiCallStep(step);
        case 'service_restart':
          return await this.executeServiceRestartStep(step);
        case 'notification':
          return await this.executeNotificationStep(step);
        case 'wait':
          return await this.executeWaitStep(step);
        default:
          return { success: false, error: `Unknown step type: ${step.type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ============================================================================
  // RECOVERY STEP IMPLEMENTATIONS
  // ============================================================================

  /**
   * Execute command step
   */
  private async executeCommandStep(step: RecoveryStep): Promise<{ success: boolean; error?: string }> {
    // Mock command execution
    logger.info('Executing command step', {
      stepId: step.id,
      command: step.action,
      parameters: step.parameters
    });

    // In production, implement actual command execution
    return { success: true };
  }

  /**
   * Execute API call step
   */
  private async executeApiCallStep(step: RecoveryStep): Promise<{ success: boolean; error?: string }> {
    // Mock API call
    logger.info('Executing API call step', {
      stepId: step.id,
      endpoint: step.action,
      parameters: step.parameters
    });

    // In production, implement actual API call
    return { success: true };
  }

  /**
   * Execute service restart step
   */
  private async executeServiceRestartStep(step: RecoveryStep): Promise<{ success: boolean; error?: string }> {
    // Mock service restart
    logger.info('Executing service restart step', {
      stepId: step.id,
      service: step.action,
      parameters: step.parameters
    });

    // In production, implement actual service restart
    return { success: true };
  }

  /**
   * Execute notification step
   */
  private async executeNotificationStep(step: RecoveryStep): Promise<{ success: boolean; error?: string }> {
    // Mock notification
    logger.info('Executing notification step', {
      stepId: step.id,
      message: step.action,
      parameters: step.parameters
    });

    return { success: true };
  }

  /**
   * Execute wait step
   */
  private async executeWaitStep(step: RecoveryStep): Promise<{ success: boolean; error?: string }> {
    const waitTime = step.parameters.duration || 5000;

    logger.info('Executing wait step', {
      stepId: step.id,
      waitTime
    });

    await this.sleep(waitTime);
    return { success: true };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get email recipients for alert
   */
  private getEmailRecipients(alert: Alert): string[] {
    const recipients = [...this.config.alerting.channels.email.defaultRecipients];

    // Add escalation-specific recipients
    const escalationRule = this.escalationRules.find(r => r.level === alert.escalationLevel);
    if (escalationRule) {
      recipients.push(...escalationRule.recipients);
    }

    return [...new Set(recipients)]; // Remove duplicates
  }

  /**
   * Generate email HTML content
   */
  private generateEmailHTML(alert: Alert): string {
    return `
      <html>
        <body>
          <h2 style="color: ${this.getAlertColor(alert.severity)};">${alert.title}</h2>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Service:</strong> ${alert.metadata.service}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
          <p><strong>Response Time:</strong> ${alert.metadata.responseTime}ms</p>
          <hr>
          <p>${alert.description.replace(/\n/g, '<br>')}</p>
          ${alert.runbookUrl ? `<p><a href="${alert.runbookUrl}">View Runbook</a></p>` : ''}
          <p><a href="https://dashboard.twikit.com/alerts/${alert.id}">View Alert Details</a></p>
        </body>
      </html>
    `;
  }

  /**
   * Get Slack color for severity
   */
  private getSlackColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'danger';
      case AlertSeverity.HIGH:
        return 'warning';
      case AlertSeverity.MEDIUM:
        return 'warning';
      default:
        return 'good';
    }
  }

  /**
   * Get alert color for severity
   */
  private getAlertColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '#ff0000';
      case AlertSeverity.HIGH:
        return '#ff8800';
      case AlertSeverity.MEDIUM:
        return '#ffaa00';
      default:
        return '#00aa00';
    }
  }

  /**
   * Map to PagerDuty severity
   */
  private mapToPagerDutySeverity(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'critical';
      case AlertSeverity.HIGH:
        return 'error';
      case AlertSeverity.MEDIUM:
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Validate recovery success
   */
  private async validateRecoverySuccess(alert: Alert, procedure: RecoveryProcedure): Promise<boolean> {
    // Re-run the health check to see if issue is resolved
    try {
      const result = await this.executeHealthCheck(alert.healthCheckId);
      return result.status === HealthStatus.HEALTHY;
    } catch (error) {
      logger.error('Failed to validate recovery success', {
        alertId: alert.id,
        procedureId: procedure.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Request recovery approval
   */
  private async requestRecoveryApproval(alert: Alert, procedure: RecoveryProcedure): Promise<void> {
    logger.info('Recovery approval requested', {
      alertId: alert.id,
      procedureId: procedure.id,
      severity: alert.severity
    });

    // In production, implement approval workflow
    this.emit('recoveryApprovalRequested', { alert, procedure });
  }

  /**
   * Update existing alert
   */
  private async updateExistingAlert(alert: Alert, result: HealthCheckResult): Promise<void> {
    alert.timestamp = new Date();
    alert.metadata = { ...alert.metadata, ...result.metadata };

    this.activeAlerts.set(alert.id, alert);

    logger.info('Alert updated', {
      alertId: alert.id,
      status: result.status,
      message: result.message
    });

    this.emit('alertUpdated', alert);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolution: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.metadata.resolution = resolution;

    this.activeAlerts.set(alertId, alert);

    logger.info('Alert resolved', {
      alertId,
      resolution,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
    });

    this.emit('alertResolved', alert);
    return true;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.activeAlerts.set(alertId, alert);

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy
    });

    this.emit('alertAcknowledged', alert);
    return true;
  }

  // ============================================================================
  // DEFAULT HEALTH CHECKS REGISTRATION
  // ============================================================================

  /**
   * Register default health checks for all Twikit services
   */
  private async registerDefaultHealthChecks(): Promise<void> {
    // Session Manager Health Checks
    this.registerHealthCheck({
      id: 'session-manager-health',
      name: 'Session Manager Health',
      description: 'Monitors TwikitSessionManager service health and performance',
      service: 'TwikitSessionManager',
      category: 'application',
      interval: 60000, // 1 minute
      timeout: 30000,
      retries: 3,
      enabled: true,
      dependencies: [],
      thresholds: {
        warning: { responseTime: 5000, errorRate: 5 },
        critical: { responseTime: 10000, errorRate: 10 }
      },
      checkFunction: async () => {
        const startTime = Date.now();
        try {
          const sessions = this.sessionManager.getAllSessions();
          const healthyCount = sessions.filter(s => s.metrics.status === 'active').length;
          const responseTime = Date.now() - startTime;

          const status = responseTime > 10000 ? HealthStatus.CRITICAL :
                        responseTime > 5000 ? HealthStatus.WARNING : HealthStatus.HEALTHY;

          return {
            status,
            message: `Session manager operational with ${sessions.length} sessions (${healthyCount} healthy)`,
            timestamp: new Date(),
            responseTime,
            metrics: {
              totalSessions: sessions.length,
              healthySessions: healthyCount,
              responseTime
            }
          };
        } catch (error) {
          return {
            status: HealthStatus.CRITICAL,
            message: `Session manager health check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            responseTime: Date.now() - startTime
          };
        }
      },
      recoveryProcedure: 'session-manager-restart'
    });

    // Security Manager Health Check
    this.registerHealthCheck({
      id: 'security-manager-health',
      name: 'Security Manager Health',
      description: 'Monitors TwikitSecurityManager service health and security monitoring',
      service: 'TwikitSecurityManager',
      category: 'security',
      interval: 30000, // 30 seconds
      timeout: 15000,
      retries: 2,
      enabled: true,
      dependencies: [],
      thresholds: {
        warning: { responseTime: 3000, threatLevel: 'medium' },
        critical: { responseTime: 8000, threatLevel: 'high' }
      },
      checkFunction: async () => {
        const startTime = Date.now();
        try {
          const events = this.securityManager.getSecurityEvents(10);
          const threats = this.securityManager.getActiveThreats();
          const responseTime = Date.now() - startTime;

          const highThreats = threats.filter(t => t.severity === 'high' || t.severity === 'critical');
          const status = highThreats.length > 0 ? HealthStatus.CRITICAL :
                        threats.length > 5 ? HealthStatus.WARNING : HealthStatus.HEALTHY;

          return {
            status,
            message: `Security manager operational with ${events.length} recent events and ${threats.length} active threats`,
            timestamp: new Date(),
            responseTime,
            metrics: {
              recentEvents: events.length,
              activeThreats: threats.length,
              highSeverityThreats: highThreats.length,
              responseTime
            }
          };
        } catch (error) {
          return {
            status: HealthStatus.CRITICAL,
            message: `Security manager health check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            responseTime: Date.now() - startTime
          };
        }
      }
    });

    // Cache Manager Health Check
    this.registerHealthCheck({
      id: 'cache-manager-health',
      name: 'Cache Manager Health',
      description: 'Monitors TwikitCacheManager performance and Redis connectivity',
      service: 'TwikitCacheManager',
      category: 'infrastructure',
      interval: 30000, // 30 seconds
      timeout: 10000,
      retries: 3,
      enabled: true,
      dependencies: [],
      thresholds: {
        warning: { hitRate: 0.8, responseTime: 100 },
        critical: { hitRate: 0.6, responseTime: 500 }
      },
      checkFunction: async () => {
        const startTime = Date.now();
        try {
          const metrics = await this.cacheManager.getPerformanceMetrics();
          const responseTime = Date.now() - startTime;

          const status = metrics.hitRate < 0.6 || responseTime > 500 ? HealthStatus.CRITICAL :
                        metrics.hitRate < 0.8 || responseTime > 100 ? HealthStatus.WARNING : HealthStatus.HEALTHY;

          return {
            status,
            message: `Cache manager operational with ${(metrics.hitRate * 100).toFixed(1)}% hit rate`,
            timestamp: new Date(),
            responseTime,
            metrics: {
              hitRate: metrics.hitRate,
              averageResponseTime: metrics.averageResponseTime,
              memoryUsage: metrics.memoryUsage,
              operationCount: 0 // Mock operation count
            }
          };
        } catch (error) {
          return {
            status: HealthStatus.CRITICAL,
            message: `Cache manager health check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            responseTime: Date.now() - startTime
          };
        }
      },
      recoveryProcedure: 'cache-manager-restart'
    });

    // Database Health Check
    this.registerHealthCheck({
      id: 'database-health',
      name: 'Database Connectivity',
      description: 'Monitors PostgreSQL database connectivity and performance',
      service: 'PostgreSQL',
      category: 'infrastructure',
      interval: 60000, // 1 minute
      timeout: 15000,
      retries: 3,
      enabled: true,
      dependencies: [],
      thresholds: {
        warning: { responseTime: 1000, connectionCount: 80 },
        critical: { responseTime: 5000, connectionCount: 95 }
      },
      checkFunction: async () => {
        const startTime = Date.now();
        try {
          // Mock database health check
          const responseTime = Date.now() - startTime;
          const connectionCount = Math.floor(Math.random() * 50); // Mock connection count

          const status = responseTime > 5000 || connectionCount > 95 ? HealthStatus.CRITICAL :
                        responseTime > 1000 || connectionCount > 80 ? HealthStatus.WARNING : HealthStatus.HEALTHY;

          return {
            status,
            message: `Database operational with ${connectionCount} active connections`,
            timestamp: new Date(),
            responseTime,
            metrics: {
              responseTime,
              connectionCount,
              queryPerformance: Math.random() * 100
            }
          };
        } catch (error) {
          return {
            status: HealthStatus.CRITICAL,
            message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            responseTime: Date.now() - startTime
          };
        }
      },
      recoveryProcedure: 'database-restart'
    });

    // Account Health Monitor Check
    this.registerHealthCheck({
      id: 'account-health-monitor',
      name: 'Account Health Monitor',
      description: 'Monitors account health monitoring service and risk assessment',
      service: 'AccountHealthMonitor',
      category: 'application',
      interval: 120000, // 2 minutes
      timeout: 30000,
      retries: 2,
      enabled: true,
      dependencies: ['session-manager-health'],
      thresholds: {
        warning: { atRiskAccounts: 5, averageHealthScore: 70 },
        critical: { atRiskAccounts: 10, averageHealthScore: 50 }
      },
      checkFunction: async () => {
        const startTime = Date.now();
        try {
          // Mock account health data
          const totalAccounts = 50;
          const atRiskAccounts = Math.floor(Math.random() * 8);
          const averageHealthScore = 75 + Math.random() * 20;
          const responseTime = Date.now() - startTime;

          const status = atRiskAccounts > 10 || averageHealthScore < 50 ? HealthStatus.CRITICAL :
                        atRiskAccounts > 5 || averageHealthScore < 70 ? HealthStatus.WARNING : HealthStatus.HEALTHY;

          return {
            status,
            message: `Account health monitor operational with ${atRiskAccounts} at-risk accounts`,
            timestamp: new Date(),
            responseTime,
            metrics: {
              totalAccounts,
              atRiskAccounts,
              averageHealthScore,
              responseTime
            }
          };
        } catch (error) {
          return {
            status: HealthStatus.CRITICAL,
            message: `Account health monitor check failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            responseTime: Date.now() - startTime
          };
        }
      }
    });

    logger.info('Default health checks registered', {
      totalChecks: this.healthChecks.size
    });
  }

  // ============================================================================
  // MONITORING INTERVALS AND LIFECYCLE
  // ============================================================================

  /**
   * Start health monitoring intervals
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.maintenanceMode) {
        await this.executeAllHealthChecks();
      }
    }, this.config.globalCheckInterval);

    logger.info('Health monitoring started', {
      interval: this.config.globalCheckInterval
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    this.metricsCollectionInterval = setInterval(async () => {
      await this.collectAndStoreMetrics();
    }, this.config.monitoring.metricsInterval);

    logger.info('Metrics collection started', {
      interval: this.config.monitoring.metricsInterval
    });
  }

  /**
   * Start alert processing
   */
  private startAlertProcessing(): void {
    if (this.alertProcessingInterval) {
      clearInterval(this.alertProcessingInterval);
    }

    this.alertProcessingInterval = setInterval(async () => {
      await this.processAlertMaintenance();
    }, 60000); // Process every minute

    logger.info('Alert processing started');
  }

  /**
   * Collect and store metrics
   */
  private async collectAndStoreMetrics(): Promise<void> {
    try {
      const metrics = {
        timestamp: new Date(),
        healthChecks: {
          total: this.healthChecks.size,
          enabled: Array.from(this.healthChecks.values()).filter(hc => hc.enabled).length,
          healthy: Array.from(this.healthResults.values()).filter(r => r.status === HealthStatus.HEALTHY).length,
          warning: Array.from(this.healthResults.values()).filter(r => r.status === HealthStatus.WARNING).length,
          critical: Array.from(this.healthResults.values()).filter(r => r.status === HealthStatus.CRITICAL).length
        },
        alerts: {
          active: Array.from(this.activeAlerts.values()).filter(a => a.status === 'active').length,
          acknowledged: Array.from(this.activeAlerts.values()).filter(a => a.status === 'acknowledged').length,
          resolved: Array.from(this.activeAlerts.values()).filter(a => a.status === 'resolved').length
        },
        performance: {
          averageResponseTime: this.healthCheckStats.averageResponseTime,
          totalChecks: this.healthCheckStats.totalChecks,
          successRate: this.healthCheckStats.totalChecks > 0 ?
            (this.healthCheckStats.successfulChecks / this.healthCheckStats.totalChecks) * 100 : 0
        }
      };

      // Store metrics in cache for dashboard consumption
      await this.cacheManager.set(
        'health_manager_metrics',
        metrics,
        {
          serviceType: TwikitServiceType.SESSION_MANAGER,
          operationType: 'metrics_collection',
          priority: CachePriority.HIGH,
          tags: ['metrics', 'health', 'monitoring']
        }
      );

      this.emit('metricsCollected', metrics);

    } catch (error) {
      logger.error('Failed to collect metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Process alert maintenance tasks
   */
  private async processAlertMaintenance(): Promise<void> {
    const now = new Date();
    const autoAcknowledgeTime = this.config.escalation.autoAcknowledgeAfter * 60 * 1000;
    const autoResolveTime = this.config.escalation.autoResolveAfter * 60 * 1000;

    for (const [alertId, alert] of this.activeAlerts) {
      const alertAge = now.getTime() - alert.timestamp.getTime();

      // Auto-acknowledge old alerts
      if (alert.status === 'active' && alertAge > autoAcknowledgeTime) {
        await this.acknowledgeAlert(alertId, 'system-auto-acknowledge');
      }

      // Auto-resolve very old alerts
      if (alert.status === 'acknowledged' && alertAge > autoResolveTime) {
        await this.resolveAlert(alertId, 'Auto-resolved due to age');
      }
    }
  }

  // ============================================================================
  // CONFIGURATION AND DATA LOADING
  // ============================================================================

  /**
   * Load escalation rules
   */
  private async loadEscalationRules(): Promise<void> {
    // Default escalation rules
    this.escalationRules = [
      {
        id: 'critical-immediate',
        name: 'Critical Alert Immediate Escalation',
        severity: AlertSeverity.CRITICAL,
        level: EscalationLevel.L2_ENGINEERING,
        delayMinutes: 0,
        channels: [AlertChannel.EMAIL, AlertChannel.SLACK, AlertChannel.PAGERDUTY],
        recipients: ['engineering-oncall@twikit.com'],
        conditions: {}
      },
      {
        id: 'critical-escalation-l3',
        name: 'Critical Alert L3 Escalation',
        severity: AlertSeverity.CRITICAL,
        level: EscalationLevel.L3_SENIOR,
        delayMinutes: 15,
        channels: [AlertChannel.EMAIL, AlertChannel.PAGERDUTY],
        recipients: ['senior-engineering@twikit.com'],
        conditions: {}
      },
      {
        id: 'high-escalation',
        name: 'High Severity Escalation',
        severity: AlertSeverity.HIGH,
        level: EscalationLevel.L2_ENGINEERING,
        delayMinutes: 30,
        channels: [AlertChannel.EMAIL, AlertChannel.SLACK],
        recipients: ['engineering@twikit.com'],
        conditions: {}
      }
    ];

    logger.info('Escalation rules loaded', {
      rulesCount: this.escalationRules.length
    });
  }

  /**
   * Load on-call schedules
   */
  private async loadOnCallSchedules(): Promise<void> {
    // Default on-call schedule
    const defaultSchedule: OnCallSchedule = {
      id: 'engineering-oncall',
      name: 'Engineering On-Call',
      level: EscalationLevel.L2_ENGINEERING,
      timezone: 'UTC',
      rotations: [
        {
          id: 'primary-rotation',
          name: 'Primary Engineering Rotation',
          startDate: new Date('2024-01-01'),
          rotationDays: 7,
          participants: [
            {
              id: 'eng1',
              name: 'Engineering Team Lead',
              email: 'eng-lead@twikit.com',
              phone: '+1-555-0101',
              slackUserId: 'U123456',
              pagerDutyUserId: 'P123456'
            },
            {
              id: 'eng2',
              name: 'Senior Engineer',
              email: 'senior-eng@twikit.com',
              phone: '+1-555-0102',
              slackUserId: 'U123457',
              pagerDutyUserId: 'P123457'
            }
          ]
        }
      ]
    };

    this.onCallSchedules.set(defaultSchedule.id, defaultSchedule);

    logger.info('On-call schedules loaded', {
      schedulesCount: this.onCallSchedules.size
    });
  }

  /**
   * Load recovery procedures
   */
  private async loadRecoveryProcedures(): Promise<void> {
    // Default recovery procedures
    const procedures: RecoveryProcedure[] = [
      {
        id: 'session-manager-restart',
        name: 'Session Manager Restart Procedure',
        description: 'Restart session manager service and validate health',
        applicableHealthChecks: ['session-manager-health'],
        automationLevel: 'semi_automated',
        maxExecutionTime: 300000, // 5 minutes
        successCriteria: ['Service responds to health check', 'All sessions restored'],
        steps: [
          {
            id: 'notify-restart',
            name: 'Notify Restart',
            type: 'notification',
            action: 'Session manager restart initiated',
            parameters: { channels: ['slack'] },
            timeout: 5000,
            retries: 1,
            continueOnFailure: true
          },
          {
            id: 'graceful-shutdown',
            name: 'Graceful Shutdown',
            type: 'api_call',
            action: '/api/session-manager/shutdown',
            parameters: { graceful: true, timeout: 30000 },
            timeout: 35000,
            retries: 2,
            continueOnFailure: false
          },
          {
            id: 'wait-shutdown',
            name: 'Wait for Shutdown',
            type: 'wait',
            action: 'wait',
            parameters: { duration: 10000 },
            timeout: 15000,
            retries: 1,
            continueOnFailure: true
          },
          {
            id: 'restart-service',
            name: 'Restart Service',
            type: 'service_restart',
            action: 'session-manager',
            parameters: { wait: true },
            timeout: 60000,
            retries: 3,
            continueOnFailure: false
          }
        ]
      },
      {
        id: 'cache-manager-restart',
        name: 'Cache Manager Restart Procedure',
        description: 'Restart cache manager and clear problematic cache entries',
        applicableHealthChecks: ['cache-manager-health'],
        automationLevel: 'fully_automated',
        maxExecutionTime: 180000, // 3 minutes
        successCriteria: ['Cache responds to ping', 'Hit rate above 80%'],
        steps: [
          {
            id: 'clear-cache',
            name: 'Clear Problematic Cache',
            type: 'api_call',
            action: '/api/cache/clear-problematic',
            parameters: {},
            timeout: 30000,
            retries: 2,
            continueOnFailure: true
          },
          {
            id: 'restart-cache',
            name: 'Restart Cache Service',
            type: 'service_restart',
            action: 'cache-manager',
            parameters: { force: true },
            timeout: 60000,
            retries: 2,
            continueOnFailure: false
          }
        ]
      }
    ];

    for (const procedure of procedures) {
      this.recoveryProcedures.set(procedure.id, procedure);
    }

    logger.info('Recovery procedures loaded', {
      proceduresCount: this.recoveryProcedures.size
    });
  }

  // ============================================================================
  // DASHBOARD INTEGRATION AND PUBLIC API
  // ============================================================================

  /**
   * Initialize dashboard integration
   */
  private async initializeDashboardIntegration(): Promise<void> {
    try {
      // Store health manager status in cache for dashboard integration
      await this.cacheManager.set(
        'health_manager_status',
        {
          initialized: true,
          timestamp: new Date(),
          healthChecks: this.healthChecks.size,
          activeAlerts: this.activeAlerts.size
        },
        {
          serviceType: TwikitServiceType.SESSION_MANAGER,
          operationType: 'dashboard_integration',
          priority: CachePriority.HIGH,
          tags: ['dashboard', 'health', 'status']
        }
      );

      logger.info('Dashboard integration initialized');
    } catch (error) {
      logger.error('Failed to initialize dashboard integration', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get overall system health status
   */
  getSystemHealthStatus(): {
    status: HealthStatus;
    summary: string;
    details: {
      totalChecks: number;
      healthyChecks: number;
      warningChecks: number;
      criticalChecks: number;
      unknownChecks: number;
    };
    lastUpdate: Date;
  } {
    const results = Array.from(this.healthResults.values());
    const healthyCount = results.filter(r => r.status === HealthStatus.HEALTHY).length;
    const warningCount = results.filter(r => r.status === HealthStatus.WARNING).length;
    const criticalCount = results.filter(r => r.status === HealthStatus.CRITICAL).length;
    const unknownCount = results.filter(r => r.status === HealthStatus.UNKNOWN).length;

    let overallStatus = HealthStatus.HEALTHY;
    if (criticalCount > 0) {
      overallStatus = HealthStatus.CRITICAL;
    } else if (warningCount > 0) {
      overallStatus = HealthStatus.WARNING;
    } else if (unknownCount > 0 && healthyCount === 0) {
      overallStatus = HealthStatus.UNKNOWN;
    }

    return {
      status: overallStatus,
      summary: `${healthyCount}/${results.length} services healthy`,
      details: {
        totalChecks: results.length,
        healthyChecks: healthyCount,
        warningChecks: warningCount,
        criticalChecks: criticalCount,
        unknownChecks: unknownCount
      },
      lastUpdate: this.lastHealthCheckRun
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.status === 'active');
  }

  /**
   * Get all alerts with optional filtering
   */
  getAllAlerts(filters?: {
    status?: Alert['status'];
    severity?: AlertSeverity;
    service?: string;
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.activeAlerts.values());

    if (filters) {
      if (filters.status) {
        alerts = alerts.filter(a => a.status === filters.status);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.service) {
        alerts = alerts.filter(a => a.metadata.service === filters.service);
      }
      if (filters.limit) {
        alerts = alerts.slice(0, filters.limit);
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get health check results
   */
  getHealthCheckResults(): Map<string, HealthCheckResult> {
    return new Map(this.healthResults);
  }

  /**
   * Get health manager statistics
   */
  getHealthManagerStats(): {
    healthChecks: {
      totalChecks: number;
      successfulChecks: number;
      failedChecks: number;
      averageResponseTime: number;
    };
    alerts: {
      total: number;
      active: number;
      acknowledged: number;
      resolved: number;
    };
    uptime: number;
    lastHealthCheck: Date;
  } {
    const alerts = Array.from(this.activeAlerts.values());

    return {
      healthChecks: { ...this.healthCheckStats },
      alerts: {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
        resolved: alerts.filter(a => a.status === 'resolved').length
      },
      uptime: this.isInitialized ? Date.now() - this.lastHealthCheckRun.getTime() : 0,
      lastHealthCheck: this.lastHealthCheckRun
    };
  }

  /**
   * Get public configuration (without sensitive data)
   */
  getPublicConfig(): any {
    return {
      enabled: this.config.enabled,
      globalCheckInterval: this.config.globalCheckInterval,
      maxConcurrentChecks: this.config.maxConcurrentChecks,
      defaultTimeout: this.config.defaultTimeout,
      defaultRetries: this.config.defaultRetries,
      alerting: {
        enabled: this.config.alerting.enabled,
        aggregationWindow: this.config.alerting.aggregationWindow,
        deduplicationWindow: this.config.alerting.deduplicationWindow,
        maxAlertsPerHour: this.config.alerting.maxAlertsPerHour,
        suppressDuringMaintenance: this.config.alerting.suppressDuringMaintenance,
        channels: {
          email: { enabled: this.config.alerting.channels.email.enabled },
          slack: { enabled: this.config.alerting.channels.slack.enabled },
          pagerduty: { enabled: this.config.alerting.channels.pagerduty.enabled },
          webhook: { enabled: this.config.alerting.channels.webhook.enabled }
        }
      },
      escalation: {
        enabled: this.config.escalation.enabled,
        defaultEscalationDelay: this.config.escalation.defaultEscalationDelay,
        maxEscalationLevel: this.config.escalation.maxEscalationLevel,
        autoAcknowledgeAfter: this.config.escalation.autoAcknowledgeAfter,
        autoResolveAfter: this.config.escalation.autoResolveAfter
      },
      recovery: {
        enabled: this.config.recovery.enabled,
        autoRecoveryEnabled: this.config.recovery.autoRecoveryEnabled,
        maxRecoveryAttempts: this.config.recovery.maxRecoveryAttempts,
        recoveryTimeout: this.config.recovery.recoveryTimeout,
        requireApprovalForCritical: this.config.recovery.requireApprovalForCritical
      },
      monitoring: {
        retentionPeriod: this.config.monitoring.retentionPeriod,
        metricsInterval: this.config.monitoring.metricsInterval,
        anomalyDetection: this.config.monitoring.anomalyDetection,
        predictiveMonitoring: this.config.monitoring.predictiveMonitoring,
        dashboardIntegration: this.config.monitoring.dashboardIntegration
      }
    };
  }

  // ============================================================================
  // MAINTENANCE AND LIFECYCLE
  // ============================================================================

  /**
   * Enable maintenance mode
   */
  enableMaintenanceMode(reason: string): void {
    this.maintenanceMode = true;

    logger.info('Maintenance mode enabled', { reason });
    this.emit('maintenanceModeEnabled', { reason, timestamp: new Date() });
  }

  /**
   * Disable maintenance mode
   */
  disableMaintenanceMode(): void {
    this.maintenanceMode = false;

    logger.info('Maintenance mode disabled');
    this.emit('maintenanceModeDisabled', { timestamp: new Date() });
  }

  /**
   * Check if in maintenance mode
   */
  isInMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('Health manager shutting down gracefully...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    if (this.alertProcessingInterval) {
      clearInterval(this.alertProcessingInterval);
    }

    // Resolve any pending alerts
    const activeAlerts = this.getActiveAlerts();
    for (const alert of activeAlerts) {
      await this.resolveAlert(alert.id, 'System shutdown');
    }

    this.emit('healthManagerShutdown', { timestamp: new Date() });
    logger.info('Health manager shutdown complete');
  }

  // ============================================================================
  // EVENT HANDLERS FOR SERVICE INTEGRATION
  // ============================================================================

  /**
   * Handle session unhealthy event
   */
  private async handleSessionUnhealthy(event: any): Promise<void> {
    logger.warn('Session unhealthy event received', event);

    // Trigger immediate health check for session manager
    await this.executeHealthCheck('session-manager-health');
  }

  /**
   * Handle cache performance alert
   */
  private async handleCachePerformanceAlert(event: any): Promise<void> {
    logger.warn('Cache performance alert received', event);

    // Trigger immediate health check for cache manager
    await this.executeHealthCheck('cache-manager-health');
  }

  /**
   * Handle security threat event
   */
  private async handleSecurityThreat(event: any): Promise<void> {
    logger.warn('Security threat event received', event);

    // Trigger immediate health check for security manager
    await this.executeHealthCheck('security-manager-health');
  }

  /**
   * Handle service health changed event
   */
  private async handleServiceHealthChanged(event: any): Promise<void> {
    logger.info('Service health changed event received', event);

    // Update relevant health checks based on service
    if (event.service) {
      const relevantChecks = this.getHealthChecksByService(event.service);
      for (const healthCheck of relevantChecks) {
        await this.executeHealthCheck(healthCheck.id);
      }
    }
  }

  /**
   * Handle account health alert
   */
  private async handleAccountHealthAlert(event: any): Promise<void> {
    logger.warn('Account health alert received', event);

    // Trigger immediate health check for account health monitor
    if (this.healthChecks.has('account-health-monitor')) {
      await this.executeHealthCheck('account-health-monitor');
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const twikitHealthManager = TwikitHealthManager.getInstance();
export default twikitHealthManager;
