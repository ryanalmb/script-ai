/**
 * Network Detection Manager
 * Manages network-level anti-detection measures
 */

import { PrismaClient } from '@prisma/client';
import Redis, { Redis as RedisType } from 'ioredis';
import { EventEmitter } from 'events';
import { AntiDetectionConfig } from '../../config/antiDetection';
import { logger } from '../../utils/logger';

export interface NetworkConfig {
  proxyId?: string;
  ipAddress?: string;
  userAgent: string;
  headers: Record<string, string>;
  connectionSettings: {
    keepAlive: boolean;
    timeout: number;
    retries: number;
  };
  tlsSettings: {
    version: string;
    ciphers: string[];
  };
  qualityScore: number;
}

export interface ProxyRotationResult {
  newProxyId: string;
  reason: string;
  previousProxy?: string;
}

export class NetworkDetectionManager extends EventEmitter {
  private prisma: PrismaClient;
  private redis: RedisType;
  private config: AntiDetectionConfig;
  private networkCache: Map<string, NetworkConfig> = new Map();
  private isInitialized: boolean = false;

  // Network configuration templates
  private tlsVersions = ['TLS 1.2', 'TLS 1.3'];
  private commonCiphers = [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
    'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
  ];

  private commonHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    'DNT': '1',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
  };

  constructor(prisma: PrismaClient, redis: RedisType, config: AntiDetectionConfig) {
    super();
    this.prisma = prisma;
    this.redis = redis;
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Network Detection Manager...');

      // Load network configurations from cache
      await this.loadNetworkConfigurations();

      // Setup Redis subscriptions for network updates
      await this.setupRedisSubscriptions();

      this.isInitialized = true;
      logger.info('Network Detection Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Network Detection Manager:', error);
      throw error;
    }
  }

  /**
   * Configure network settings for identity profile
   */
  public async configureNetworkSettings(
    identityProfileId: string,
    proxyId?: string,
    context?: any
  ): Promise<NetworkConfig> {
    try {
      const cacheKey = `network:${identityProfileId}:${proxyId || 'direct'}`;
      
      // Check cache first
      const cached = this.networkCache.get(cacheKey);
      if (cached && this.isConfigValid(cached)) {
        return cached;
      }

      // Get identity profile for consistency
      const identityProfile = await this.prisma.identityProfile.findUnique({
        where: { id: identityProfileId },
      });

      if (!identityProfile) {
        throw new Error(`Identity profile not found: ${identityProfileId}`);
      }

      // Generate network configuration
      const networkConfig: NetworkConfig = {
        proxyId,
        ipAddress: context?.ipAddress,
        userAgent: identityProfile.userAgent,
        headers: this.generateHeaders(identityProfile),
        connectionSettings: this.generateConnectionSettings(),
        tlsSettings: this.generateTlsSettings(),
        qualityScore: this.calculateQualityScore(identityProfile, proxyId),
      };

      // Cache the configuration
      this.networkCache.set(cacheKey, networkConfig);

      logger.debug(`Generated network configuration for profile: ${identityProfileId}`);
      return networkConfig;
    } catch (error) {
      logger.error('Failed to configure network settings:', error);
      throw error;
    }
  }

  /**
   * Rotate proxy for session
   */
  public async rotateProxy(sessionId: string, currentProxyId?: string): Promise<ProxyRotationResult> {
    try {
      // Get available proxies from proxy pool
      const availableProxies = await this.prisma.proxyPool.findMany({
        where: {
          isActive: true,
          successRate: { gte: 70 },
          ...(currentProxyId && { id: { not: currentProxyId } }), // Exclude current proxy if provided
        },
        orderBy: {
          successRate: 'desc',
        },
        take: 5, // Get top 5 candidates
      });

      if (availableProxies.length === 0) {
        throw new Error('No available proxies for rotation');
      }

      // Select proxy based on geolocation consistency and health
      const selectedProxy = this.selectOptimalProxy(availableProxies, sessionId);

      // Update session proxy assignment
      await this.updateSessionProxyAssignment(sessionId, selectedProxy.id, currentProxyId);

      const result: ProxyRotationResult = {
        newProxyId: selectedProxy.id,
        reason: 'AUTOMATIC_ROTATION',
        previousProxy: currentProxyId,
      };

      logger.info(`Rotated proxy for session ${sessionId}: ${currentProxyId} -> ${selectedProxy.id}`);
      this.emit('proxyRotated', result);

      return result;
    } catch (error) {
      logger.error('Failed to rotate proxy:', error);
      throw error;
    }
  }

  /**
   * Validate network configuration consistency
   */
  public async validateNetworkConsistency(
    identityProfileId: string,
    networkConfig: NetworkConfig
  ): Promise<{ consistent: boolean; issues: string[] }> {
    try {
      const issues: string[] = [];

      // Get identity profile
      const identityProfile = await this.prisma.identityProfile.findUnique({
        where: { id: identityProfileId },
      });

      if (!identityProfile) {
        issues.push('Identity profile not found');
        return { consistent: false, issues };
      }

      // Check user agent consistency
      if (networkConfig.userAgent !== identityProfile.userAgent) {
        issues.push('User agent mismatch with identity profile');
      }

      // Check geolocation consistency if proxy is used
      if (networkConfig.proxyId) {
        const proxy = await this.prisma.proxyPool.findUnique({
          where: { id: networkConfig.proxyId },
        });

        if (proxy && proxy.country) {
          const profileTimezone = identityProfile.timezone;
          const expectedCountry = this.getCountryFromTimezone(profileTimezone);
          
          if (proxy.country !== expectedCountry) {
            issues.push(`Geolocation inconsistency: proxy country ${proxy.country} doesn't match profile timezone ${profileTimezone}`);
          }
        }
      }

      // Check TLS configuration consistency
      if (!this.isTlsConfigurationRealistic(networkConfig.tlsSettings)) {
        issues.push('Unrealistic TLS configuration');
      }

      return {
        consistent: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error('Failed to validate network consistency:', error);
      return { consistent: false, issues: ['Validation error'] };
    }
  }

  /**
   * Monitor network detection signals
   */
  public async monitorDetectionSignals(
    sessionId: string,
    response: any
  ): Promise<{ detected: boolean; signals: string[] }> {
    try {
      const signals: string[] = [];

      // Check response headers for detection signals
      if (response.headers) {
        // Cloudflare detection
        if (response.headers['cf-ray']) {
          signals.push('CLOUDFLARE_DETECTED');
        }

        // Rate limiting headers
        if (response.headers['x-rate-limit-remaining']) {
          const remaining = parseInt(response.headers['x-rate-limit-remaining']);
          if (remaining < 10) {
            signals.push('RATE_LIMIT_WARNING');
          }
        }

        // Security headers that might indicate detection
        if (response.headers['x-frame-options'] === 'DENY') {
          signals.push('SECURITY_HEADERS_DETECTED');
        }
      }

      // Check response status codes
      if (response.status === 429) {
        signals.push('RATE_LIMITED');
      } else if (response.status === 403) {
        signals.push('ACCESS_FORBIDDEN');
      } else if (response.status === 503) {
        signals.push('SERVICE_UNAVAILABLE');
      }

      // Check response body for detection patterns
      if (response.body && typeof response.body === 'string') {
        if (response.body.includes('captcha') || response.body.includes('CAPTCHA')) {
          signals.push('CAPTCHA_DETECTED');
        }

        if (response.body.includes('blocked') || response.body.includes('suspended')) {
          signals.push('ACCOUNT_BLOCKED');
        }
      }

      const detected = signals.length > 0;

      if (detected) {
        logger.warn(`Detection signals found for session ${sessionId}:`, signals);
        this.emit('detectionSignals', { sessionId, signals });
      }

      return { detected, signals };
    } catch (error) {
      logger.error('Failed to monitor detection signals:', error);
      return { detected: false, signals: [] };
    }
  }

  /**
   * Get statistics
   */
  public async getStatistics(): Promise<any> {
    return {
      isInitialized: this.isInitialized,
      cachedConfigurations: this.networkCache.size,
    };
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(config: AntiDetectionConfig): Promise<void> {
    this.config = config;
    logger.info('Network Detection Manager configuration updated');
  }

  /**
   * Shutdown
   */
  public async shutdown(): Promise<void> {
    this.networkCache.clear();
    this.isInitialized = false;
    logger.info('Network Detection Manager shut down');
  }

  // Private helper methods
  private async loadNetworkConfigurations(): Promise<void> {
    // Load cached network configurations
    // Implementation would load from Redis or database
  }

  private async setupRedisSubscriptions(): Promise<void> {
    // Setup Redis subscriptions for network updates
    // Implementation would subscribe to network update channels
  }

  private generateHeaders(identityProfile: any): Record<string, string> {
    const headers: Record<string, string> = { ...this.commonHeaders };

    // Set user agent
    headers['User-Agent'] = identityProfile.userAgent;

    // Set accept language based on profile
    headers['Accept-Language'] = `${identityProfile.language},${identityProfile.language.split('-')[0]};q=0.9,en;q=0.8`;

    // Add some randomization
    if (Math.random() > 0.5) {
      headers['Connection'] = 'keep-alive';
    }

    if (Math.random() > 0.7) {
      headers['Sec-Fetch-Dest'] = 'document';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-Site'] = 'none';
    }

    return headers;
  }

  private generateConnectionSettings(): any {
    return {
      keepAlive: Math.random() > 0.2, // 80% chance of keep-alive
      timeout: Math.floor(Math.random() * 20000) + 10000, // 10-30 seconds
      retries: Math.floor(Math.random() * 3) + 1, // 1-3 retries
    };
  }

  private generateTlsSettings(): any {
    const version = this.tlsVersions[Math.floor(Math.random() * this.tlsVersions.length)];
    const cipherCount = Math.floor(Math.random() * 3) + 3; // 3-5 ciphers
    const ciphers = this.commonCiphers
      .sort(() => Math.random() - 0.5)
      .slice(0, cipherCount);

    return {
      version,
      ciphers,
    };
  }

  private calculateQualityScore(identityProfile: any, proxyId?: string): number {
    let score = 100;

    // Penalize if no proxy is used (less anonymous)
    if (!proxyId) {
      score -= 20;
    }

    // Reward consistent configuration
    if (identityProfile.profileConsistency > 90) {
      score += 10;
    }

    // Penalize high detection score
    score -= identityProfile.detectionScore * 0.5;

    return Math.max(0, Math.min(100, score));
  }

  private isConfigValid(config: NetworkConfig): boolean {
    // Check if configuration is still valid (not expired)
    return true; // Simplified for now
  }

  private selectOptimalProxy(proxies: any[], sessionId: string): any {
    // Select proxy based on health score and other factors
    // For now, just return the first (highest health score)
    return proxies[0];
  }

  private async updateSessionProxyAssignment(
    sessionId: string,
    newProxyId: string,
    oldProxyId?: string
  ): Promise<void> {
    try {
      // Update session proxy assignment in database
      await this.prisma.sessionProxyAssignment.updateMany({
        where: { sessionId, isActive: true },
        data: { isActive: false, unassignedAt: new Date() },
      });

      // Create new assignment
      await this.prisma.sessionProxyAssignment.create({
        data: {
          sessionId,
          proxyId: newProxyId,
          assignedAt: new Date(),
          isActive: true,
          assignmentReason: 'ROTATION',
        },
      });
    } catch (error) {
      logger.error('Failed to update session proxy assignment:', error);
    }
  }

  private getCountryFromTimezone(timezone: string): string {
    const timezoneCountryMap: Record<string, string> = {
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'America/Chicago': 'US',
      'Europe/London': 'GB',
      'Europe/Berlin': 'DE',
      'Europe/Paris': 'FR',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Australia/Sydney': 'AU',
    };

    return timezoneCountryMap[timezone] || 'US';
  }

  private isTlsConfigurationRealistic(tlsSettings: any): boolean {
    // Check if TLS configuration is realistic
    if (!tlsSettings.version || !tlsSettings.ciphers) {
      return false;
    }

    if (tlsSettings.ciphers.length < 2 || tlsSettings.ciphers.length > 10) {
      return false;
    }

    return true;
  }
}
