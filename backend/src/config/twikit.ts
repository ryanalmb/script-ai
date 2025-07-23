import { config } from './environment';
import { logger } from '../utils/logger';

export interface ProxyPoolConfig {
  enabled: boolean;
  urls: string[];
  username?: string;
  password?: string;
}

export interface ProxyConfig {
  enableRotation: boolean;
  rotationInterval: number;
  healthCheckInterval: number;
  maxFailures: number;
  healthCheckTimeout: number;
  healthCheckUrls: string[];
  pools: {
    residential: ProxyPoolConfig;
    datacenter: ProxyPoolConfig;
    mobile: ProxyPoolConfig;
  };
}

export interface AntiDetectionConfig {
  enabled: boolean;
  sessionDuration: {
    min: number;
    max: number;
  };
  actionDelay: {
    min: number;
    max: number;
  };
  behaviorProfile: 'conservative' | 'moderate' | 'active';
}

export interface SessionConfig {
  maxConcurrentSessions: number;
  cleanupInterval: number;
  healthCheckInterval: number;
  enablePersistence: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  enableJitter: boolean;
}

export interface RateLimitConfig {
  enabled: boolean;
  distributedCoordination: boolean;
  queueProcessingInterval: number;
  analyticsFlushInterval: number;
  profileCacheTtl: number;
  lockTtl: number;
  defaultAccountType: 'new' | 'standard' | 'verified' | 'premium' | 'enterprise';
  warmupDurationDays: number;
  customLimits?: {
    [accountId: string]: {
      [action: string]: Array<{
        window: string;
        limit: number;
        burstLimit?: number;
      }>;
    };
  };
}

export interface TwikitConfig {
  proxy: ProxyConfig;
  antiDetection: AntiDetectionConfig;
  session: SessionConfig;
  retry: RetryConfig;
  rateLimit: RateLimitConfig;
}

/**
 * Centralized Twikit configuration
 */
export class TwikitConfigManager {
  private static instance: TwikitConfigManager;
  private _config: TwikitConfig;

  private constructor() {
    this._config = config.twikit;
    this.validateConfiguration();
  }

  public static getInstance(): TwikitConfigManager {
    if (!TwikitConfigManager.instance) {
      TwikitConfigManager.instance = new TwikitConfigManager();
    }
    return TwikitConfigManager.instance;
  }

  public get config(): TwikitConfig {
    return this._config;
  }

  /**
   * Get proxy configuration for a specific pool type
   */
  public getProxyPoolConfig(poolType: 'residential' | 'datacenter' | 'mobile'): ProxyPoolConfig {
    return this._config.proxy.pools[poolType];
  }

  /**
   * Get all enabled proxy pools
   */
  public getEnabledProxyPools(): Array<{ type: string; config: ProxyPoolConfig }> {
    const pools = [];
    
    for (const [type, poolConfig] of Object.entries(this._config.proxy.pools)) {
      if (poolConfig.enabled && poolConfig.urls.length > 0) {
        pools.push({ type, config: poolConfig });
      }
    }
    
    return pools;
  }

  /**
   * Check if proxy rotation is enabled and configured
   */
  public isProxyRotationEnabled(): boolean {
    return this._config.proxy.enableRotation && this.getEnabledProxyPools().length > 0;
  }

  /**
   * Get session configuration with runtime adjustments
   */
  public getSessionConfig(): SessionConfig {
    return {
      ...this._config.session,
      // Adjust max concurrent sessions based on available proxy pools
      maxConcurrentSessions: this.isProxyRotationEnabled() 
        ? this._config.session.maxConcurrentSessions 
        : Math.min(this._config.session.maxConcurrentSessions, 10)
    };
  }

  /**
   * Get anti-detection configuration with randomization
   */
  public getAntiDetectionConfig(): AntiDetectionConfig & {
    randomSessionDuration: () => number;
    randomActionDelay: () => number;
  } {
    const baseConfig = this._config.antiDetection;
    
    return {
      ...baseConfig,
      randomSessionDuration: () => {
        const min = baseConfig.sessionDuration.min;
        const max = baseConfig.sessionDuration.max;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
      randomActionDelay: () => {
        const min = baseConfig.actionDelay.min;
        const max = baseConfig.actionDelay.max;
        return Math.random() * (max - min) + min;
      }
    };
  }

  /**
   * Get retry configuration with context-aware adjustments
   */
  public getRetryConfig(actionType?: string): RetryConfig {
    const baseConfig = this._config.retry;
    
    // Adjust retry configuration based on action type
    if (actionType === 'authenticate') {
      return {
        ...baseConfig,
        maxRetries: Math.min(baseConfig.maxRetries + 2, 5), // More retries for auth
        baseDelay: baseConfig.baseDelay * 2 // Longer delays for auth
      };
    }
    
    if (actionType === 'post_tweet' || actionType === 'follow_user') {
      return {
        ...baseConfig,
        maxRetries: Math.max(baseConfig.maxRetries - 1, 1), // Fewer retries for risky actions
        baseDelay: baseConfig.baseDelay * 1.5 // Longer delays for risky actions
      };
    }
    
    return baseConfig;
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(updates: Partial<TwikitConfig>): void {
    this._config = {
      ...this._config,
      ...updates,
      proxy: { ...this._config.proxy, ...updates.proxy },
      antiDetection: { ...this._config.antiDetection, ...updates.antiDetection },
      session: { ...this._config.session, ...updates.session },
      retry: { ...this._config.retry, ...updates.retry }
    };
    
    this.validateConfiguration();
    logger.info('Twikit configuration updated', { updates });
  }

  /**
   * Validate the current configuration
   */
  private validateConfiguration(): void {
    const errors: string[] = [];
    
    // Validate proxy configuration
    if (this._config.proxy.enableRotation) {
      const enabledPools = this.getEnabledProxyPools();
      if (enabledPools.length === 0) {
        errors.push('Proxy rotation is enabled but no proxy pools are configured');
      }
    }
    
    // Validate session duration
    if (this._config.antiDetection.sessionDuration.min >= this._config.antiDetection.sessionDuration.max) {
      errors.push('Session duration minimum must be less than maximum');
    }
    
    // Validate action delays
    if (this._config.antiDetection.actionDelay.min >= this._config.antiDetection.actionDelay.max) {
      errors.push('Action delay minimum must be less than maximum');
    }
    
    // Validate retry configuration
    if (this._config.retry.baseDelay >= this._config.retry.maxDelay) {
      errors.push('Retry base delay must be less than maximum delay');
    }
    
    if (this._config.retry.exponentialBase <= 1) {
      errors.push('Retry exponential base must be greater than 1');
    }
    
    if (errors.length > 0) {
      logger.warn('Twikit configuration validation warnings:', { errors });
    }
  }

  /**
   * Get configuration summary for logging
   */
  public getConfigSummary(): object {
    const enabledPools = this.getEnabledProxyPools();
    
    return {
      proxyRotationEnabled: this.isProxyRotationEnabled(),
      enabledProxyPools: enabledPools.map(p => p.type),
      totalProxyUrls: enabledPools.reduce((sum, p) => sum + p.config.urls.length, 0),
      antiDetectionEnabled: this._config.antiDetection.enabled,
      maxConcurrentSessions: this._config.session.maxConcurrentSessions,
      sessionPersistenceEnabled: this._config.session.enablePersistence,
      behaviorProfile: this._config.antiDetection.behaviorProfile
    };
  }

  /**
   * Export configuration for Python client
   */
  public exportForPythonClient(): object {
    return {
      proxyConfigs: this.getEnabledProxyPools().flatMap(pool => 
        pool.config.urls.map(url => ({
          url,
          type: pool.type,
          username: pool.config.username,
          password: pool.config.password,
          healthScore: 1.0
        }))
      ),
      sessionConfig: {
        userAgent: '', // Will be randomized by Python client
        viewportSize: [1920, 1080],
        timezone: 'UTC',
        language: 'en-US',
        behaviorProfile: this._config.antiDetection.behaviorProfile,
        sessionDuration: this.getAntiDetectionConfig().randomSessionDuration()
      },
      retryConfig: {
        maxRetries: this._config.retry.maxRetries,
        baseDelay: this._config.retry.baseDelay,
        maxDelay: this._config.retry.maxDelay,
        exponentialBase: this._config.retry.exponentialBase,
        jitter: this._config.retry.enableJitter
      }
    };
  }

  /**
   * Get rate limiting configuration
   */
  public getRateLimitConfig(): RateLimitConfig {
    return this._config.rateLimit;
  }

  /**
   * Get custom rate limits for a specific account
   */
  public getCustomRateLimits(accountId: string): any {
    return this._config.rateLimit.customLimits?.[accountId] || null;
  }

  /**
   * Set custom rate limits for an account
   */
  public setCustomRateLimits(accountId: string, limits: any): void {
    if (!this._config.rateLimit.customLimits) {
      this._config.rateLimit.customLimits = {};
    }
    this._config.rateLimit.customLimits[accountId] = limits;
    logger.info(`Set custom rate limits for account: ${accountId}`);
  }

  /**
   * Remove custom rate limits for an account
   */
  public removeCustomRateLimits(accountId: string): void {
    if (this._config.rateLimit.customLimits) {
      delete this._config.rateLimit.customLimits[accountId];
      logger.info(`Removed custom rate limits for account: ${accountId}`);
    }
  }

  /**
   * Check if rate limiting is enabled
   */
  public isRateLimitingEnabled(): boolean {
    return this._config.rateLimit.enabled;
  }

  /**
   * Check if distributed coordination is enabled
   */
  public isDistributedCoordinationEnabled(): boolean {
    return this._config.rateLimit.distributedCoordination;
  }
}

// Singleton instance
export const twikitConfig = TwikitConfigManager.getInstance();

// Export individual configurations for convenience
export const proxyConfig = twikitConfig.config.proxy;
export const antiDetectionConfig = twikitConfig.config.antiDetection;
export const sessionConfig = twikitConfig.config.session;
export const retryConfig = twikitConfig.config.retry;
export const rateLimitConfig = twikitConfig.config.rateLimit;
