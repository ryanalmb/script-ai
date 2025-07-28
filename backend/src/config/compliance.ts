/**
 * Compliance Configuration - Task 26
 * 
 * Configuration settings for the comprehensive compliance and audit trail system.
 * Includes settings for GDPR, CCPA, SOX, and other regulatory frameworks.
 * 
 * Features:
 * - Compliance framework configurations
 * - Data retention policies
 * - Audit trail settings
 * - Privacy request handling
 * - Violation thresholds and alerting
 * 
 * @author Twikit Development Team
 * @version 1.0.0
 * @since 2024-12-28
 */

import { ComplianceFramework } from '../services/complianceAuditService';

// Environment-specific compliance settings
export interface ComplianceConfig {
  // General settings
  enabled: boolean;
  hashSecret: string;
  bufferSize: number;
  flushInterval: number;
  
  // Framework-specific settings
  frameworks: {
    [key in ComplianceFramework]: FrameworkConfig;
  };
  
  // Data retention policies
  dataRetention: DataRetentionConfig;
  
  // Privacy request settings
  privacyRequests: PrivacyRequestConfig;
  
  // Audit trail settings
  auditTrail: AuditTrailConfig;
  
  // Violation settings
  violations: ViolationConfig;
  
  // Reporting settings
  reporting: ReportingConfig;
}

export interface FrameworkConfig {
  enabled: boolean;
  responseTimeLimit: number; // days
  dataSubjectRights: string[];
  requiredNotifications: string[];
  retentionPeriods: Record<string, number>; // data type -> days
  specialCategories: string[];
}

export interface DataRetentionConfig {
  defaultRetentionPeriod: number; // days
  auditLogRetention: number; // days
  complianceReportRetention: number; // days
  violationRecordRetention: number; // days
  privacyRequestRetention: number; // days
  automaticPurging: boolean;
  purgeSchedule: string; // cron expression
}

export interface PrivacyRequestConfig {
  autoVerification: boolean;
  verificationMethods: string[];
  defaultResponseTime: number; // days
  escalationThreshold: number; // days
  notificationChannels: string[];
  dataExportFormats: string[];
}

export interface AuditTrailConfig {
  integrityChecking: boolean;
  checksumAlgorithm: string;
  chainValidation: boolean;
  immutableStorage: boolean;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
}

export interface ViolationConfig {
  autoDetection: boolean;
  severityThresholds: Record<string, number>;
  escalationRules: EscalationRule[];
  notificationChannels: string[];
  regulatoryReporting: boolean;
}

export interface EscalationRule {
  severity: string;
  timeThreshold: number; // hours
  escalateTo: string[];
  actions: string[];
}

export interface ReportingConfig {
  autoGeneration: boolean;
  schedules: ReportSchedule[];
  formats: string[];
  distributionLists: Record<string, string[]>;
  archivalPolicy: string;
}

export interface ReportSchedule {
  reportType: string;
  framework: ComplianceFramework;
  frequency: string; // cron expression
  recipients: string[];
}

// Default compliance configuration
const defaultConfig: ComplianceConfig = {
  enabled: true,
  hashSecret: process.env.COMPLIANCE_HASH_SECRET || 'change-in-production',
  bufferSize: 100,
  flushInterval: 5000, // 5 seconds

  frameworks: {
    [ComplianceFramework.GDPR]: {
      enabled: true,
      responseTimeLimit: 30, // 30 days
      dataSubjectRights: [
        'ACCESS',
        'RECTIFICATION',
        'ERASURE',
        'RESTRICT_PROCESSING',
        'DATA_PORTABILITY',
        'OBJECT'
      ],
      requiredNotifications: [
        'DATA_BREACH_72H',
        'DPO_NOTIFICATION',
        'SUPERVISORY_AUTHORITY'
      ],
      retentionPeriods: {
        'PERSONAL_DATA': 365, // 1 year
        'AUDIT_LOGS': 2555, // 7 years
        'CONSENT_RECORDS': 1095, // 3 years
        'MARKETING_DATA': 730 // 2 years
      },
      specialCategories: [
        'HEALTH_DATA',
        'BIOMETRIC_DATA',
        'GENETIC_DATA',
        'POLITICAL_OPINIONS',
        'RELIGIOUS_BELIEFS'
      ]
    },

    [ComplianceFramework.CCPA]: {
      enabled: true,
      responseTimeLimit: 45, // 45 days
      dataSubjectRights: [
        'KNOW',
        'DELETE',
        'OPT_OUT',
        'NON_DISCRIMINATION'
      ],
      requiredNotifications: [
        'PRIVACY_POLICY_UPDATE',
        'DATA_SALE_DISCLOSURE'
      ],
      retentionPeriods: {
        'PERSONAL_INFORMATION': 365, // 1 year
        'AUDIT_LOGS': 2555, // 7 years
        'SALE_RECORDS': 1095 // 3 years
      },
      specialCategories: [
        'SENSITIVE_PERSONAL_INFORMATION',
        'FINANCIAL_DATA',
        'HEALTH_DATA'
      ]
    },

    [ComplianceFramework.SOX]: {
      enabled: false, // Enable if handling financial data
      responseTimeLimit: 90, // 90 days
      dataSubjectRights: [],
      requiredNotifications: [
        'INTERNAL_CONTROL_DEFICIENCY',
        'MATERIAL_WEAKNESS',
        'AUDIT_COMMITTEE'
      ],
      retentionPeriods: {
        'FINANCIAL_RECORDS': 2555, // 7 years
        'AUDIT_LOGS': 2555, // 7 years
        'INTERNAL_CONTROLS': 2555 // 7 years
      },
      specialCategories: [
        'FINANCIAL_STATEMENTS',
        'INTERNAL_CONTROLS',
        'AUDIT_EVIDENCE'
      ]
    },

    [ComplianceFramework.HIPAA]: {
      enabled: false, // Enable if handling health data
      responseTimeLimit: 60, // 60 days
      dataSubjectRights: [
        'ACCESS',
        'AMENDMENT',
        'ACCOUNTING_DISCLOSURES',
        'RESTRICT_USE'
      ],
      requiredNotifications: [
        'BREACH_NOTIFICATION',
        'HHS_NOTIFICATION'
      ],
      retentionPeriods: {
        'PHI': 2190, // 6 years
        'AUDIT_LOGS': 2190, // 6 years
        'AUTHORIZATION_RECORDS': 2190 // 6 years
      },
      specialCategories: [
        'PROTECTED_HEALTH_INFORMATION',
        'PSYCHOTHERAPY_NOTES',
        'GENETIC_INFORMATION'
      ]
    },

    [ComplianceFramework.CUSTOM]: {
      enabled: true,
      responseTimeLimit: 30, // 30 days
      dataSubjectRights: [
        'ACCESS',
        'DELETE',
        'CORRECT'
      ],
      requiredNotifications: [
        'SYSTEM_NOTIFICATION'
      ],
      retentionPeriods: {
        'USER_DATA': 365, // 1 year
        'AUDIT_LOGS': 1095, // 3 years
        'SYSTEM_LOGS': 90 // 90 days
      },
      specialCategories: [
        'AUTOMATION_DATA',
        'BEHAVIORAL_DATA'
      ]
    }
  },

  dataRetention: {
    defaultRetentionPeriod: 365, // 1 year
    auditLogRetention: 2555, // 7 years
    complianceReportRetention: 2555, // 7 years
    violationRecordRetention: 2555, // 7 years
    privacyRequestRetention: 1095, // 3 years
    automaticPurging: true,
    purgeSchedule: '0 2 * * 0' // Weekly at 2 AM on Sunday
  },

  privacyRequests: {
    autoVerification: false,
    verificationMethods: [
      'EMAIL_VERIFICATION',
      'IDENTITY_DOCUMENT',
      'SECURITY_QUESTIONS'
    ],
    defaultResponseTime: 30, // days
    escalationThreshold: 25, // days (5 days before deadline)
    notificationChannels: [
      'EMAIL',
      'SYSTEM_LOG',
      'WEBHOOK'
    ],
    dataExportFormats: [
      'JSON',
      'CSV',
      'PDF'
    ]
  },

  auditTrail: {
    integrityChecking: true,
    checksumAlgorithm: 'SHA256',
    chainValidation: true,
    immutableStorage: true,
    encryptionEnabled: true,
    compressionEnabled: false
  },

  violations: {
    autoDetection: true,
    severityThresholds: {
      'RATE_LIMIT_VIOLATIONS': 5, // per hour
      'DETECTION_EVENTS': 3, // per hour
      'FAILED_AUTHENTICATIONS': 10, // per hour
      'DATA_ACCESS_VIOLATIONS': 1 // per hour
    },
    escalationRules: [
      {
        severity: 'CRITICAL',
        timeThreshold: 1, // 1 hour
        escalateTo: ['ADMIN', 'COMPLIANCE_OFFICER'],
        actions: ['IMMEDIATE_NOTIFICATION', 'SYSTEM_ALERT']
      },
      {
        severity: 'HIGH',
        timeThreshold: 4, // 4 hours
        escalateTo: ['COMPLIANCE_OFFICER'],
        actions: ['EMAIL_NOTIFICATION', 'DASHBOARD_ALERT']
      },
      {
        severity: 'MEDIUM',
        timeThreshold: 24, // 24 hours
        escalateTo: ['TEAM_LEAD'],
        actions: ['EMAIL_NOTIFICATION']
      }
    ],
    notificationChannels: [
      'EMAIL',
      'SLACK',
      'WEBHOOK',
      'SYSTEM_LOG'
    ],
    regulatoryReporting: false // Enable for production
  },

  reporting: {
    autoGeneration: true,
    schedules: [
      {
        reportType: 'GDPR_MONTHLY_SUMMARY',
        framework: ComplianceFramework.GDPR,
        frequency: '0 9 1 * *', // Monthly on 1st at 9 AM
        recipients: ['compliance@company.com']
      },
      {
        reportType: 'CCPA_QUARTERLY_SUMMARY',
        framework: ComplianceFramework.CCPA,
        frequency: '0 9 1 */3 *', // Quarterly on 1st at 9 AM
        recipients: ['compliance@company.com']
      },
      {
        reportType: 'WEEKLY_VIOLATIONS',
        framework: ComplianceFramework.CUSTOM,
        frequency: '0 9 * * 1', // Weekly on Monday at 9 AM
        recipients: ['admin@company.com']
      }
    ],
    formats: [
      'PDF',
      'JSON',
      'CSV',
      'HTML'
    ],
    distributionLists: {
      'COMPLIANCE_TEAM': ['compliance@company.com', 'legal@company.com'],
      'ADMIN_TEAM': ['admin@company.com', 'security@company.com'],
      'EXECUTIVE_TEAM': ['ceo@company.com', 'cto@company.com']
    },
    archivalPolicy: 'COMPRESS_AND_STORE' // COMPRESS_AND_STORE, DELETE_AFTER_RETENTION
  }
};

// Environment-specific overrides
const getEnvironmentConfig = (): Partial<ComplianceConfig> => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        hashSecret: process.env.COMPLIANCE_HASH_SECRET!,
        violations: {
          ...defaultConfig.violations,
          regulatoryReporting: true
        },
        reporting: {
          ...defaultConfig.reporting,
          autoGeneration: true
        }
      };
    
    case 'staging':
      return {
        violations: {
          ...defaultConfig.violations,
          regulatoryReporting: false
        },
        reporting: {
          ...defaultConfig.reporting,
          autoGeneration: false
        }
      };
    
    case 'development':
    default:
      return {
        dataRetention: {
          ...defaultConfig.dataRetention,
          automaticPurging: false
        },
        violations: {
          ...defaultConfig.violations,
          autoDetection: false,
          regulatoryReporting: false
        },
        reporting: {
          ...defaultConfig.reporting,
          autoGeneration: false
        }
      };
  }
};

// Merge default config with environment-specific overrides
export const complianceConfig: ComplianceConfig = {
  ...defaultConfig,
  ...getEnvironmentConfig()
};

// Validation function for compliance configuration
export const validateComplianceConfig = (config: ComplianceConfig): string[] => {
  const errors: string[] = [];

  // Validate hash secret
  if (!config.hashSecret || config.hashSecret === 'change-in-production') {
    if (process.env.NODE_ENV === 'production') {
      errors.push('COMPLIANCE_HASH_SECRET must be set in production');
    }
  }

  // Validate buffer settings
  if (config.bufferSize <= 0) {
    errors.push('Buffer size must be greater than 0');
  }

  if (config.flushInterval <= 0) {
    errors.push('Flush interval must be greater than 0');
  }

  // Validate framework configurations
  Object.entries(config.frameworks).forEach(([framework, frameworkConfig]) => {
    if (frameworkConfig.enabled && frameworkConfig.responseTimeLimit <= 0) {
      errors.push(`Response time limit for ${framework} must be greater than 0`);
    }
  });

  // Validate retention periods
  if (config.dataRetention.defaultRetentionPeriod <= 0) {
    errors.push('Default retention period must be greater than 0');
  }

  return errors;
};

// Export individual configurations for specific use cases
export const gdprConfig = complianceConfig.frameworks[ComplianceFramework.GDPR];
export const ccpaConfig = complianceConfig.frameworks[ComplianceFramework.CCPA];
export const soxConfig = complianceConfig.frameworks[ComplianceFramework.SOX];
export const hipaaConfig = complianceConfig.frameworks[ComplianceFramework.HIPAA];
export const customConfig = complianceConfig.frameworks[ComplianceFramework.CUSTOM];

export default complianceConfig;
