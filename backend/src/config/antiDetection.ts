/**
 * Anti-Detection Configuration Management
 * Comprehensive configuration for all anti-detection measures
 */

export interface AntiDetectionConfig {
  // Core Settings
  enabled: boolean;
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // Identity Profile Management
  identityProfiles: {
    maxActiveProfiles: number;
    profileRotationInterval: number; // seconds
    profileExpirationDays: number;
    consistencyThreshold: number; // 0-100
    detectionScoreThreshold: number; // 0-100
    agingRate: number; // How fast profiles age
  };
  
  // Fingerprint Management
  fingerprinting: {
    canvas: {
      enabled: boolean;
      spoofingMethod: 'randomize' | 'spoof_specific' | 'block';
      consistencyPeriod: number; // seconds
      noiseLevel: number; // 0-1
    };
    webgl: {
      enabled: boolean;
      spoofGpuInfo: boolean;
      spoofExtensions: boolean;
      consistencyPeriod: number;
    };
    audio: {
      enabled: boolean;
      spoofingMethod: 'randomize' | 'block';
      noiseLevel: number;
    };
    fonts: {
      enabled: boolean;
      spoofAvailableFonts: boolean;
      fontSubstitution: boolean;
    };
    tls: {
      enabled: boolean;
      coordinateWithProxy: boolean;
      randomizeFingerprint: boolean;
    };
  };
  
  // Behavioral Simulation
  behavior: {
    timing: {
      enabled: boolean;
      humanLikeDistribution: boolean;
      minActionInterval: number; // milliseconds
      maxActionInterval: number;
      burstProbability: number; // 0-1
      fatigueSimulation: boolean;
    };
    interaction: {
      enabled: boolean;
      mouseMovementSimulation: boolean;
      scrollPatternSimulation: boolean;
      typingPatternSimulation: boolean;
      engagementRateVariation: boolean;
    };
    navigation: {
      enabled: boolean;
      naturalBrowsingPatterns: boolean;
      tabSwitchingSimulation: boolean;
      backButtonUsage: boolean;
    };
  };
  
  // Network and Proxy Management
  network: {
    proxyRotation: {
      enabled: boolean;
      rotationStrategy: 'time_based' | 'request_based' | 'detection_based';
      rotationInterval: number; // seconds
      geolocationConsistency: boolean;
      ipReputationCheck: boolean;
    };
    connectionPatterns: {
      enabled: boolean;
      randomizeKeepAlive: boolean;
      varyConnectionTiming: boolean;
      simulateNetworkLatency: boolean;
    };
  };
  
  // Detection Monitoring
  detection: {
    monitoring: {
      enabled: boolean;
      realTimeAnalysis: boolean;
      captchaDetection: boolean;
      rateLimitDetection: boolean;
      suspensionDetection: boolean;
    };
    response: {
      automaticEvasion: boolean;
      profileSwitching: boolean;
      proxyRotation: boolean;
      cooldownPeriod: number; // seconds
      escalationThreshold: number; // number of detections
    };
  };
  
  // Redis Coordination
  redis: {
    enabled: boolean;
    keyPrefix: string;
    coordinationChannel: string;
    syncInterval: number; // seconds
    distributedLocking: boolean;
  };
  
  // Performance Settings
  performance: {
    maxConcurrentOperations: number;
    cacheSize: number;
    cleanupInterval: number; // seconds
    metricsCollection: boolean;
  };
}

// Default configuration
export const defaultAntiDetectionConfig: AntiDetectionConfig = {
  enabled: true,
  debug: process.env.NODE_ENV === 'development',
  logLevel: 'info',
  
  identityProfiles: {
    maxActiveProfiles: 100,
    profileRotationInterval: 3600, // 1 hour
    profileExpirationDays: 30,
    consistencyThreshold: 85,
    detectionScoreThreshold: 70,
    agingRate: 0.01, // 1% per day
  },
  
  fingerprinting: {
    canvas: {
      enabled: true,
      spoofingMethod: 'randomize',
      consistencyPeriod: 86400, // 24 hours
      noiseLevel: 0.1,
    },
    webgl: {
      enabled: true,
      spoofGpuInfo: true,
      spoofExtensions: true,
      consistencyPeriod: 86400,
    },
    audio: {
      enabled: true,
      spoofingMethod: 'randomize',
      noiseLevel: 0.05,
    },
    fonts: {
      enabled: true,
      spoofAvailableFonts: true,
      fontSubstitution: false,
    },
    tls: {
      enabled: true,
      coordinateWithProxy: true,
      randomizeFingerprint: true,
    },
  },
  
  behavior: {
    timing: {
      enabled: true,
      humanLikeDistribution: true,
      minActionInterval: 1000, // 1 second
      maxActionInterval: 30000, // 30 seconds
      burstProbability: 0.1,
      fatigueSimulation: true,
    },
    interaction: {
      enabled: true,
      mouseMovementSimulation: true,
      scrollPatternSimulation: true,
      typingPatternSimulation: true,
      engagementRateVariation: true,
    },
    navigation: {
      enabled: true,
      naturalBrowsingPatterns: true,
      tabSwitchingSimulation: false, // Not applicable for API automation
      backButtonUsage: false,
    },
  },
  
  network: {
    proxyRotation: {
      enabled: true,
      rotationStrategy: 'detection_based',
      rotationInterval: 1800, // 30 minutes
      geolocationConsistency: true,
      ipReputationCheck: true,
    },
    connectionPatterns: {
      enabled: true,
      randomizeKeepAlive: true,
      varyConnectionTiming: true,
      simulateNetworkLatency: false,
    },
  },
  
  detection: {
    monitoring: {
      enabled: true,
      realTimeAnalysis: true,
      captchaDetection: true,
      rateLimitDetection: true,
      suspensionDetection: true,
    },
    response: {
      automaticEvasion: true,
      profileSwitching: true,
      proxyRotation: true,
      cooldownPeriod: 300, // 5 minutes
      escalationThreshold: 3,
    },
  },
  
  redis: {
    enabled: true,
    keyPrefix: 'antidetection:',
    coordinationChannel: 'antidetection:coordination',
    syncInterval: 60, // 1 minute
    distributedLocking: true,
  },
  
  performance: {
    maxConcurrentOperations: 50,
    cacheSize: 1000,
    cleanupInterval: 3600, // 1 hour
    metricsCollection: true,
  },
};

// Environment-based configuration loader
export class AntiDetectionConfigManager {
  private static instance: AntiDetectionConfigManager;
  private config: AntiDetectionConfig;
  
  private constructor() {
    this.config = this.loadConfiguration();
  }
  
  public static getInstance(): AntiDetectionConfigManager {
    if (!AntiDetectionConfigManager.instance) {
      AntiDetectionConfigManager.instance = new AntiDetectionConfigManager();
    }
    return AntiDetectionConfigManager.instance;
  }
  
  private loadConfiguration(): AntiDetectionConfig {
    const config = { ...defaultAntiDetectionConfig };
    
    // Override with environment variables
    if (process.env.ANTI_DETECTION_ENABLED !== undefined) {
      config.enabled = process.env.ANTI_DETECTION_ENABLED === 'true';
    }
    
    if (process.env.ANTI_DETECTION_DEBUG !== undefined) {
      config.debug = process.env.ANTI_DETECTION_DEBUG === 'true';
    }
    
    if (process.env.ANTI_DETECTION_LOG_LEVEL) {
      config.logLevel = process.env.ANTI_DETECTION_LOG_LEVEL as any;
    }
    
    // Identity profiles
    if (process.env.ANTI_DETECTION_MAX_PROFILES) {
      config.identityProfiles.maxActiveProfiles = parseInt(process.env.ANTI_DETECTION_MAX_PROFILES);
    }
    
    if (process.env.ANTI_DETECTION_PROFILE_ROTATION) {
      config.identityProfiles.profileRotationInterval = parseInt(process.env.ANTI_DETECTION_PROFILE_ROTATION);
    }
    
    // Fingerprinting
    if (process.env.ANTI_DETECTION_CANVAS_ENABLED !== undefined) {
      config.fingerprinting.canvas.enabled = process.env.ANTI_DETECTION_CANVAS_ENABLED === 'true';
    }
    
    if (process.env.ANTI_DETECTION_WEBGL_ENABLED !== undefined) {
      config.fingerprinting.webgl.enabled = process.env.ANTI_DETECTION_WEBGL_ENABLED === 'true';
    }
    
    // Behavioral simulation
    if (process.env.ANTI_DETECTION_MIN_INTERVAL) {
      config.behavior.timing.minActionInterval = parseInt(process.env.ANTI_DETECTION_MIN_INTERVAL);
    }
    
    if (process.env.ANTI_DETECTION_MAX_INTERVAL) {
      config.behavior.timing.maxActionInterval = parseInt(process.env.ANTI_DETECTION_MAX_INTERVAL);
    }
    
    // Network settings
    if (process.env.ANTI_DETECTION_PROXY_ROTATION !== undefined) {
      config.network.proxyRotation.enabled = process.env.ANTI_DETECTION_PROXY_ROTATION === 'true';
    }
    
    if (process.env.ANTI_DETECTION_PROXY_STRATEGY) {
      config.network.proxyRotation.rotationStrategy = process.env.ANTI_DETECTION_PROXY_STRATEGY as any;
    }
    
    // Detection monitoring
    if (process.env.ANTI_DETECTION_MONITORING !== undefined) {
      config.detection.monitoring.enabled = process.env.ANTI_DETECTION_MONITORING === 'true';
    }
    
    if (process.env.ANTI_DETECTION_AUTO_EVASION !== undefined) {
      config.detection.response.automaticEvasion = process.env.ANTI_DETECTION_AUTO_EVASION === 'true';
    }
    
    // Redis coordination
    if (process.env.ANTI_DETECTION_REDIS_PREFIX) {
      config.redis.keyPrefix = process.env.ANTI_DETECTION_REDIS_PREFIX;
    }
    
    return config;
  }
  
  public getConfig(): AntiDetectionConfig {
    return { ...this.config };
  }
  
  public updateConfig(updates: Partial<AntiDetectionConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  public resetToDefaults(): void {
    this.config = { ...defaultAntiDetectionConfig };
  }
  
  // Validate configuration
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (this.config.identityProfiles.maxActiveProfiles <= 0) {
      errors.push('maxActiveProfiles must be greater than 0');
    }
    
    if (this.config.identityProfiles.consistencyThreshold < 0 || this.config.identityProfiles.consistencyThreshold > 100) {
      errors.push('consistencyThreshold must be between 0 and 100');
    }
    
    if (this.config.behavior.timing.minActionInterval >= this.config.behavior.timing.maxActionInterval) {
      errors.push('minActionInterval must be less than maxActionInterval');
    }
    
    if (this.config.fingerprinting.canvas.noiseLevel < 0 || this.config.fingerprinting.canvas.noiseLevel > 1) {
      errors.push('canvas noiseLevel must be between 0 and 1');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export configuration types and utilities
export type FingerprintType = 'CANVAS' | 'WEBGL' | 'AUDIO' | 'TLS' | 'FONT';
export type BehaviorPatternType = 'TIMING' | 'INTERACTION' | 'ENGAGEMENT' | 'NAVIGATION';
export type DetectionType = 'CAPTCHA' | 'RATE_LIMIT' | 'ACCOUNT_SUSPENSION' | 'IP_BLOCK' | 'FINGERPRINT_FLAG';
export type ProfileType = 'HUMAN_LIKE' | 'POWER_USER' | 'CASUAL_USER' | 'MOBILE_USER';
export type DeviceCategory = 'DESKTOP' | 'MOBILE' | 'TABLET';

// Utility functions for configuration
export const ConfigUtils = {
  isProductionMode: (): boolean => process.env.NODE_ENV === 'production',
  isDevelopmentMode: (): boolean => process.env.NODE_ENV === 'development',
  getRedisUrl: (): string => process.env.REDIS_URL || 'redis://localhost:6379',
  getDatabaseUrl: (): string => process.env.DATABASE_URL || '',
  
  // Generate profile-specific configuration
  generateProfileConfig: (profileType: ProfileType): Partial<AntiDetectionConfig> => {
    const baseConfig: Partial<AntiDetectionConfig> = {};
    
    switch (profileType) {
      case 'CASUAL_USER':
        baseConfig.behavior = {
          timing: {
            enabled: true,
            humanLikeDistribution: true,
            minActionInterval: 5000, // Slower, more casual
            maxActionInterval: 60000,
            burstProbability: 0.05, // Less bursts
            fatigueSimulation: true,
          },
          interaction: {
            enabled: true,
            mouseMovementSimulation: true,
            scrollPatternSimulation: true,
            typingPatternSimulation: true,
            engagementRateVariation: true,
          },
          navigation: {
            enabled: true,
            naturalBrowsingPatterns: true,
            tabSwitchingSimulation: false,
            backButtonUsage: false,
          },
        };
        break;
        
      case 'POWER_USER':
        baseConfig.behavior = {
          timing: {
            enabled: true,
            humanLikeDistribution: true,
            minActionInterval: 500, // Faster, more active
            maxActionInterval: 15000,
            burstProbability: 0.2, // More bursts
            fatigueSimulation: false, // Power users don't get tired as easily
          },
          interaction: {
            enabled: true,
            mouseMovementSimulation: true,
            scrollPatternSimulation: true,
            typingPatternSimulation: true,
            engagementRateVariation: true,
          },
          navigation: {
            enabled: true,
            naturalBrowsingPatterns: true,
            tabSwitchingSimulation: false,
            backButtonUsage: false,
          },
        };
        break;
        
      case 'MOBILE_USER':
        baseConfig.behavior = {
          timing: {
            enabled: true,
            humanLikeDistribution: true,
            minActionInterval: 2000, // Mobile users are typically slower
            maxActionInterval: 45000,
            burstProbability: 0.08,
            fatigueSimulation: true,
          },
          interaction: {
            enabled: true,
            mouseMovementSimulation: false, // No mouse on mobile
            scrollPatternSimulation: true,
            typingPatternSimulation: true,
            engagementRateVariation: true,
          },
          navigation: {
            enabled: true,
            naturalBrowsingPatterns: true,
            tabSwitchingSimulation: false,
            backButtonUsage: true, // Mobile users use back button more
          },
        };
        break;
        
      default: // HUMAN_LIKE
        baseConfig.behavior = defaultAntiDetectionConfig.behavior;
        break;
    }
    
    return baseConfig;
  },
};
