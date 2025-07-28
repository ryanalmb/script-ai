/**
 * Twikit Monitoring Service Configuration - Task 25
 * 
 * Configuration and initialization for the comprehensive Twikit monitoring dashboard.
 * This file handles the setup and integration of the monitoring service with all
 * existing Twikit services and infrastructure components.
 */

import { TwikitMonitoringConfig, AlertChannel, EscalationPolicy } from '../services/twikitMonitoringService';

// ============================================================================
// MONITORING SERVICE CONFIGURATION
// ============================================================================

/**
 * Default monitoring service configuration
 */
export const defaultMonitoringConfig: TwikitMonitoringConfig = {
  // Collection intervals (in milliseconds)
  metricsCollectionInterval: 30000, // 30 seconds
  healthCheckInterval: 60000, // 60 seconds
  alertCheckInterval: 15000, // 15 seconds
  
  // Data retention policies
  detailedRetentionDays: 30, // 30 days for detailed metrics
  aggregatedRetentionDays: 365, // 1 year for aggregated metrics
  
  // Performance settings
  maxConcurrentCollections: 10,
  collectionTimeout: 10000, // 10 seconds
  
  // Real-time updates
  enableRealTimeUpdates: true,
  updateBroadcastInterval: 5000, // 5 seconds
  
  // Alerting configuration
  enableAlerting: true,
  alertChannels: [],
  escalationPolicies: [],
  
  // Dashboard API settings
  enableDashboardAPI: true,
  maxDashboardClients: 100,
  
  // Cache settings
  metricsCacheTTL: 300, // 5 minutes
  enableMetricsCache: true
};

/**
 * Production monitoring configuration
 */
export const productionMonitoringConfig: Partial<TwikitMonitoringConfig> = {
  metricsCollectionInterval: 15000, // 15 seconds for production
  healthCheckInterval: 30000, // 30 seconds for production
  alertCheckInterval: 10000, // 10 seconds for production
  detailedRetentionDays: 90, // 90 days for production
  maxConcurrentCollections: 20,
  maxDashboardClients: 200
};

/**
 * Development monitoring configuration
 */
export const developmentMonitoringConfig: Partial<TwikitMonitoringConfig> = {
  metricsCollectionInterval: 60000, // 60 seconds for development
  healthCheckInterval: 120000, // 2 minutes for development
  alertCheckInterval: 30000, // 30 seconds for development
  detailedRetentionDays: 7, // 7 days for development
  enableRealTimeUpdates: false, // Disable real-time updates in development
  enableAlerting: false // Disable alerting in development
};

// ============================================================================
// ALERT CHANNELS CONFIGURATION
// ============================================================================

/**
 * Default alert channels
 */
export const defaultAlertChannels: AlertChannel[] = [
  {
    id: 'system_log',
    type: 'system_log',
    name: 'System Log',
    config: {},
    enabled: true,
    priority: 'medium'
  },
  {
    id: 'webhook_alerts',
    type: 'webhook',
    name: 'Webhook Alerts',
    config: {
      endpoint: process.env.MONITORING_WEBHOOK_URL || '',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MONITORING_WEBHOOK_TOKEN || ''}`
      },
      template: JSON.stringify({
        alert: '{title}',
        severity: '{severity}',
        metric: '{metric}',
        value: '{currentValue}',
        threshold: '{threshold}',
        timestamp: '{createdAt}'
      })
    },
    enabled: !!process.env.MONITORING_WEBHOOK_URL,
    priority: 'high'
  },
  {
    id: 'email_alerts',
    type: 'email',
    name: 'Email Alerts',
    config: {
      recipients: process.env.MONITORING_EMAIL_RECIPIENTS?.split(',') || [],
      template: `
        Alert: {title}
        Severity: {severity}
        Metric: {metric}
        Current Value: {currentValue}
        Threshold: {threshold}
        Time: {createdAt}
        
        Please investigate this issue immediately.
      `
    },
    enabled: !!process.env.MONITORING_EMAIL_RECIPIENTS,
    priority: 'high'
  }
];

/**
 * Production alert channels (includes additional channels)
 */
export const productionAlertChannels: AlertChannel[] = [
  ...defaultAlertChannels,
  {
    id: 'slack_critical',
    type: 'slack',
    name: 'Slack Critical Alerts',
    config: {
      endpoint: process.env.SLACK_WEBHOOK_URL || '',
      template: JSON.stringify({
        text: '🚨 Critical Alert: {title}',
        attachments: [
          {
            color: 'danger',
            fields: [
              { title: 'Metric', value: '{metric}', short: true },
              { title: 'Current Value', value: '{currentValue}', short: true },
              { title: 'Threshold', value: '{threshold}', short: true },
              { title: 'Severity', value: '{severity}', short: true }
            ],
            footer: 'Twikit Monitoring',
            ts: '{createdAt}'
          }
        ]
      })
    },
    enabled: !!process.env.SLACK_WEBHOOK_URL,
    priority: 'critical'
  }
];

// ============================================================================
// ESCALATION POLICIES CONFIGURATION
// ============================================================================

/**
 * Default escalation policies
 */
export const defaultEscalationPolicies: EscalationPolicy[] = [
  {
    id: 'critical_immediate',
    name: 'Critical Immediate Escalation',
    triggers: {
      severity: ['critical'],
      duration: 0, // Immediate
      conditions: []
    },
    actions: {
      channels: ['system_log', 'webhook_alerts', 'email_alerts'],
      autoResolve: false,
      suppressDuplicates: true
    },
    enabled: true
  },
  {
    id: 'error_escalation',
    name: 'Error Escalation',
    triggers: {
      severity: ['error'],
      duration: 5, // 5 minutes
      conditions: []
    },
    actions: {
      channels: ['system_log', 'webhook_alerts'],
      autoResolve: false,
      suppressDuplicates: true
    },
    enabled: true
  },
  {
    id: 'warning_escalation',
    name: 'Warning Escalation',
    triggers: {
      severity: ['warning'],
      duration: 15, // 15 minutes
      conditions: []
    },
    actions: {
      channels: ['system_log'],
      autoResolve: true,
      suppressDuplicates: true
    },
    enabled: true
  }
];

/**
 * Production escalation policies (more aggressive)
 */
export const productionEscalationPolicies: EscalationPolicy[] = [
  {
    id: 'critical_immediate_prod',
    name: 'Production Critical Immediate',
    triggers: {
      severity: ['critical'],
      duration: 0,
      conditions: []
    },
    actions: {
      channels: ['system_log', 'webhook_alerts', 'email_alerts', 'slack_critical'],
      autoResolve: false,
      suppressDuplicates: false // Don't suppress in production
    },
    enabled: true
  },
  {
    id: 'error_escalation_prod',
    name: 'Production Error Escalation',
    triggers: {
      severity: ['error'],
      duration: 2, // 2 minutes in production
      conditions: []
    },
    actions: {
      channels: ['system_log', 'webhook_alerts', 'email_alerts'],
      autoResolve: false,
      suppressDuplicates: true
    },
    enabled: true
  },
  {
    id: 'warning_escalation_prod',
    name: 'Production Warning Escalation',
    triggers: {
      severity: ['warning'],
      duration: 10, // 10 minutes in production
      conditions: []
    },
    actions: {
      channels: ['system_log', 'webhook_alerts'],
      autoResolve: true,
      suppressDuplicates: true
    },
    enabled: true
  }
];

// ============================================================================
// ENVIRONMENT-SPECIFIC CONFIGURATION
// ============================================================================

/**
 * Get monitoring configuration based on environment
 */
export function getMonitoringConfig(): TwikitMonitoringConfig {
  const environment = process.env.NODE_ENV || 'development';
  
  let config = { ...defaultMonitoringConfig };
  let alertChannels = [...defaultAlertChannels];
  let escalationPolicies = [...defaultEscalationPolicies];
  
  switch (environment) {
    case 'production':
      config = { ...config, ...productionMonitoringConfig };
      alertChannels = [...productionAlertChannels];
      escalationPolicies = [...productionEscalationPolicies];
      break;
      
    case 'development':
      config = { ...config, ...developmentMonitoringConfig };
      break;
      
    case 'test':
      config = {
        ...config,
        enableRealTimeUpdates: false,
        enableAlerting: false,
        enableMetricsCache: false,
        metricsCollectionInterval: 5000, // 5 seconds for tests
        healthCheckInterval: 10000 // 10 seconds for tests
      };
      alertChannels = []; // No alert channels in test
      escalationPolicies = []; // No escalation policies in test
      break;
  }
  
  // Set alert channels and escalation policies
  config.alertChannels = alertChannels;
  config.escalationPolicies = escalationPolicies;
  
  return config;
}

/**
 * Validate monitoring configuration
 */
export function validateMonitoringConfig(config: TwikitMonitoringConfig): boolean {
  try {
    // Validate intervals
    if (config.metricsCollectionInterval < 1000) {
      throw new Error('Metrics collection interval must be at least 1 second');
    }
    
    if (config.healthCheckInterval < 1000) {
      throw new Error('Health check interval must be at least 1 second');
    }
    
    if (config.alertCheckInterval < 1000) {
      throw new Error('Alert check interval must be at least 1 second');
    }
    
    // Validate retention periods
    if (config.detailedRetentionDays < 1) {
      throw new Error('Detailed retention period must be at least 1 day');
    }
    
    if (config.aggregatedRetentionDays < config.detailedRetentionDays) {
      throw new Error('Aggregated retention period must be >= detailed retention period');
    }
    
    // Validate performance settings
    if (config.maxConcurrentCollections < 1) {
      throw new Error('Max concurrent collections must be at least 1');
    }
    
    if (config.collectionTimeout < 1000) {
      throw new Error('Collection timeout must be at least 1 second');
    }
    
    // Validate cache settings
    if (config.metricsCacheTTL < 60) {
      throw new Error('Metrics cache TTL must be at least 60 seconds');
    }
    
    return true;
    
  } catch (error) {
    console.error('Monitoring configuration validation failed:', error);
    return false;
  }
}
