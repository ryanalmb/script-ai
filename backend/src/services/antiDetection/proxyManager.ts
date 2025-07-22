import { logger } from '../../utils/logger';
import { prisma } from '../../lib/prisma';
import { cacheManager } from '../../lib/cache';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface ProxyConfiguration {
  id: string;
  type: 'residential' | 'datacenter' | 'mobile' | 'isp';
  provider: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  country?: string;
  region?: string;
  city?: string;
  isActive: boolean;
  lastUsed: Date | null;
  successRate: number;
  responseTime: number;
  failureCount: number;
  maxConcurrentConnections: number;
  currentConnections: number;
  rotationInterval: number; // seconds
  stickySession: boolean;
  sessionDuration: number; // seconds
  metadata: {
    asn?: string;
    isp?: string;
    timezone?: string;
    userAgent?: string;
    acceptLanguage?: string;
  };
}

export interface ProxyPool {
  id: string;
  name: string;
  type: 'round_robin' | 'weighted' | 'least_connections' | 'geographic' | 'random';
  proxies: string[]; // proxy IDs
  healthCheckInterval: number;
  failoverThreshold: number;
  loadBalancingStrategy: string;
  geoTargeting: {
    countries: string[];
    regions: string[];
    cities: string[];
  };
  qualityThresholds: {
    minSuccessRate: number;
    maxResponseTime: number;
    maxFailureCount: number;
  };
}

export interface ProxySession {
  id: string;
  proxyId: string;
  accountId: string;
  startTime: Date;
  lastActivity: Date;
  requestCount: number;
  isSticky: boolean;
  expiresAt: Date;
  fingerprint: {
    userAgent: string;
    acceptLanguage: string;
    timezone: string;
    screenResolution: string;
    colorDepth: number;
    platform: string;
  };
}

/**
 * Enterprise-grade Proxy Management System
 * Handles residential, datacenter, mobile, and ISP proxies with advanced rotation
 */
export class EnterpriseProxyManager {
  private proxies: Map<string, ProxyConfiguration> = new Map();
  private pools: Map<string, ProxyPool> = new Map();
  private sessions: Map<string, ProxySession> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private rotationInterval: NodeJS.Timeout | null = null;
  private performanceMetrics: Map<string, any> = new Map();

  constructor() {
    this.initializeProxyManager();
  }

  /**
   * Initialize proxy manager with comprehensive error handling
   */
  private async initializeProxyManager(): Promise<void> {
    try {
      logger.info('🔧 Initializing Enterprise Proxy Manager...');
      
      await this.loadProxyConfigurations();
      await this.loadProxyPools();
      await this.validateAllProxies();
      
      this.startHealthCheckInterval();
      this.startRotationInterval();
      this.startPerformanceMonitoring();
      
      logger.info('✅ Enterprise Proxy Manager initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise Proxy Manager:', error);
      throw new Error(`Proxy Manager initialization failed: ${error}`);
    }
  }

  /**
   * Load proxy configurations from database with validation
   */
  private async loadProxyConfigurations(): Promise<void> {
    try {
      const proxyRecords = await prisma.proxy.findMany({
        where: { isActive: true }
      });

      for (const record of proxyRecords) {
        const config: ProxyConfiguration = {
          id: record.id,
          type: record.type as any,
          provider: record.provider,
          host: record.host,
          port: record.port,
          username: record.username || undefined,
          password: record.password ? this.decryptPassword(record.password) : undefined,
          protocol: record.protocol as any,
          country: record.country || undefined,
          region: record.region || undefined,
          city: record.city || undefined,
          isActive: record.isActive,
          lastUsed: record.lastUsed,
          successRate: record.successRate || 1.0,
          responseTime: record.responseTime || 0,
          failureCount: record.failureCount || 0,
          maxConcurrentConnections: record.maxConcurrentConnections || 10,
          currentConnections: 0,
          rotationInterval: record.rotationInterval || 300,
          stickySession: record.stickySession || false,
          sessionDuration: record.sessionDuration || 1800,
          metadata: record.metadata as any || {}
        };

        // Validate proxy configuration
        if (!this.validateProxyConfiguration(config)) {
          logger.warn(`Invalid proxy configuration for ${config.id}, skipping`);
          continue;
        }

        this.proxies.set(config.id, config);
      }

      logger.info(`Loaded ${this.proxies.size} proxy configurations`);
    } catch (error) {
      logger.error('Failed to load proxy configurations:', error);
      throw new Error(`Proxy configuration loading failed: ${error}`);
    }
  }

  /**
   * Validate proxy configuration with comprehensive checks
   */
  private validateProxyConfiguration(config: ProxyConfiguration): boolean {
    try {
      // Required fields validation
      if (!config.id || !config.host || !config.port || !config.type || !config.protocol) {
        logger.error(`Missing required fields in proxy config: ${config.id}`);
        return false;
      }

      // Host validation
      const hostRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!hostRegex.test(config.host)) {
        logger.error(`Invalid host format: ${config.host}`);
        return false;
      }

      // Port validation
      if (config.port < 1 || config.port > 65535) {
        logger.error(`Invalid port number: ${config.port}`);
        return false;
      }

      // Type validation
      const validTypes = ['residential', 'datacenter', 'mobile', 'isp'];
      if (!validTypes.includes(config.type)) {
        logger.error(`Invalid proxy type: ${config.type}`);
        return false;
      }

      // Protocol validation
      const validProtocols = ['http', 'https', 'socks4', 'socks5'];
      if (!validProtocols.includes(config.protocol)) {
        logger.error(`Invalid protocol: ${config.protocol}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Proxy validation error for ${config.id}:`, error);
      return false;
    }
  }

  /**
   * Get optimal proxy for account with advanced selection algorithm
   */
  async getOptimalProxy(
    accountId: string,
    requirements: {
      country?: string;
      region?: string;
      city?: string;
      type?: string;
      minSuccessRate?: number;
      maxResponseTime?: number;
      stickySession?: boolean;
    } = {}
  ): Promise<ProxyConfiguration | null> {
    try {
      // Check for existing sticky session
      const existingSession = this.getActiveSession(accountId);
      if (existingSession && requirements.stickySession) {
        const proxy = this.proxies.get(existingSession.proxyId);
        if (proxy && this.isProxyHealthy(proxy)) {
          return proxy;
        }
      }

      // Filter proxies based on requirements
      const candidateProxies = Array.from(this.proxies.values()).filter(proxy => {
        if (!proxy.isActive) return false;
        if (proxy.currentConnections >= proxy.maxConcurrentConnections) return false;
        
        // Geographic filtering
        if (requirements.country && proxy.country !== requirements.country) return false;
        if (requirements.region && proxy.region !== requirements.region) return false;
        if (requirements.city && proxy.city !== requirements.city) return false;
        
        // Type filtering
        if (requirements.type && proxy.type !== requirements.type) return false;
        
        // Quality filtering
        if (requirements.minSuccessRate && proxy.successRate < requirements.minSuccessRate) return false;
        if (requirements.maxResponseTime && proxy.responseTime > requirements.maxResponseTime) return false;
        
        return true;
      });

      if (candidateProxies.length === 0) {
        logger.warn(`No suitable proxies found for account ${accountId} with requirements:`, requirements);
        return null;
      }

      // Select optimal proxy using weighted algorithm
      const optimalProxy = this.selectOptimalProxy(candidateProxies);
      
      if (optimalProxy) {
        // Create session if sticky session is required
        if (requirements.stickySession) {
          await this.createProxySession(accountId, optimalProxy.id);
        }
        
        // Update proxy usage
        optimalProxy.currentConnections++;
        optimalProxy.lastUsed = new Date();
        this.proxies.set(optimalProxy.id, optimalProxy);
        
        logger.info(`Selected proxy ${optimalProxy.id} for account ${accountId}`);
      }

      return optimalProxy;
    } catch (error) {
      logger.error(`Failed to get optimal proxy for account ${accountId}:`, error);
      throw new Error(`Proxy selection failed: ${error}`);
    }
  }

  /**
   * Select optimal proxy using weighted scoring algorithm
   */
  private selectOptimalProxy(candidates: ProxyConfiguration[]): ProxyConfiguration | null {
    try {
      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];

      // Calculate weighted scores for each proxy
      const scoredProxies = candidates.map(proxy => {
        let score = 0;
        
        // Success rate weight (40%)
        score += proxy.successRate * 0.4;
        
        // Response time weight (30%) - lower is better
        const normalizedResponseTime = Math.max(0, 1 - (proxy.responseTime / 5000));
        score += normalizedResponseTime * 0.3;
        
        // Connection availability weight (20%)
        const connectionAvailability = 1 - (proxy.currentConnections / proxy.maxConcurrentConnections);
        score += connectionAvailability * 0.2;
        
        // Last used weight (10%) - prefer less recently used
        const timeSinceLastUsed = proxy.lastUsed ? Date.now() - proxy.lastUsed.getTime() : Date.now();
        const normalizedLastUsed = Math.min(1, timeSinceLastUsed / (24 * 60 * 60 * 1000)); // 24 hours max
        score += normalizedLastUsed * 0.1;

        return { proxy, score };
      });

      // Sort by score descending
      scoredProxies.sort((a, b) => b.score - a.score);
      
      // Add randomization to top 3 candidates to avoid always using the same proxy
      const topCandidates = scoredProxies.slice(0, Math.min(3, scoredProxies.length));
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      
      return topCandidates[randomIndex].proxy;
    } catch (error) {
      logger.error('Error in proxy selection algorithm:', error);
      return candidates[0]; // Fallback to first candidate
    }
  }

  /**
   * Create proxy session with comprehensive tracking
   */
  private async createProxySession(accountId: string, proxyId: string): Promise<ProxySession> {
    try {
      const proxy = this.proxies.get(proxyId);
      if (!proxy) {
        throw new Error(`Proxy ${proxyId} not found`);
      }

      const session: ProxySession = {
        id: crypto.randomUUID(),
        proxyId,
        accountId,
        startTime: new Date(),
        lastActivity: new Date(),
        requestCount: 0,
        isSticky: true,
        expiresAt: new Date(Date.now() + proxy.sessionDuration * 1000),
        fingerprint: await this.generateFingerprint(proxy)
      };

      this.sessions.set(session.id, session);
      
      // Store in cache for quick access
      await cacheManager.set(`proxy_session:${accountId}`, session, proxy.sessionDuration);
      
      logger.info(`Created proxy session ${session.id} for account ${accountId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to create proxy session for account ${accountId}:`, error);
      throw new Error(`Proxy session creation failed: ${error}`);
    }
  }

  /**
   * Generate realistic browser fingerprint for proxy session
   */
  private async generateFingerprint(proxy: ProxyConfiguration): Promise<ProxySession['fingerprint']> {
    try {
      // Generate realistic user agent based on proxy location
      const userAgents = await this.getRealisticUserAgents(proxy.country);
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      
      // Generate accept language based on country
      const acceptLanguage = this.getAcceptLanguageForCountry(proxy.country);
      
      // Generate timezone based on location
      const timezone = this.getTimezoneForLocation(proxy.country, proxy.region);
      
      // Generate realistic screen resolution
      const screenResolutions = [
        '1920x1080', '1366x768', '1536x864', '1440x900', '1280x720',
        '1600x900', '1024x768', '1280x1024', '1680x1050', '2560x1440'
      ];
      const screenResolution = screenResolutions[Math.floor(Math.random() * screenResolutions.length)] || '1920x1080';
      
      // Generate color depth
      const colorDepths = [24, 32];
      const colorDepth = colorDepths[Math.floor(Math.random() * colorDepths.length)] || 24;
      
      // Generate platform
      const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)] || 'Win32';

      return {
        userAgent,
        acceptLanguage,
        timezone,
        screenResolution,
        colorDepth,
        platform
      };
    } catch (error) {
      logger.error('Failed to generate fingerprint:', error);
      // Return default fingerprint
      return {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        acceptLanguage: 'en-US,en;q=0.9',
        timezone: 'America/New_York',
        screenResolution: '1920x1080',
        colorDepth: 24,
        platform: 'Win32'
      };
    }
  }

  /**
   * Get realistic user agents for country
   */
  private async getRealisticUserAgents(country?: string): Promise<string[]> {
    try {
      // Cache key for user agents
      const cacheKey = `user_agents:${country || 'global'}`;
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        return cached as string[];
      }

      // Default user agents with realistic distribution
      const userAgents = [
        // Chrome (most popular)
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        
        // Firefox
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0',
        
        // Safari
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        
        // Edge
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      ];

      // Cache for 1 hour
      await cacheManager.set(cacheKey, userAgents, 3600);
      
      return userAgents;
    } catch (error) {
      logger.error('Failed to get user agents:', error);
      return ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'];
    }
  }

  /**
   * Get accept language for country
   */
  private getAcceptLanguageForCountry(country?: string): string {
    const languageMap: { [key: string]: string } = {
      'US': 'en-US,en;q=0.9',
      'GB': 'en-GB,en;q=0.9',
      'CA': 'en-CA,en;q=0.9,fr-CA;q=0.8',
      'AU': 'en-AU,en;q=0.9',
      'DE': 'de-DE,de;q=0.9,en;q=0.8',
      'FR': 'fr-FR,fr;q=0.9,en;q=0.8',
      'ES': 'es-ES,es;q=0.9,en;q=0.8',
      'IT': 'it-IT,it;q=0.9,en;q=0.8',
      'JP': 'ja-JP,ja;q=0.9,en;q=0.8',
      'KR': 'ko-KR,ko;q=0.9,en;q=0.8',
      'CN': 'zh-CN,zh;q=0.9,en;q=0.8',
      'BR': 'pt-BR,pt;q=0.9,en;q=0.8',
      'MX': 'es-MX,es;q=0.9,en;q=0.8',
      'IN': 'en-IN,en;q=0.9,hi;q=0.8',
      'RU': 'ru-RU,ru;q=0.9,en;q=0.8'
    };

    return languageMap[country || 'US'] || 'en-US,en;q=0.9';
  }

  /**
   * Get timezone for location
   */
  private getTimezoneForLocation(country?: string, region?: string): string {
    const timezoneMap: { [key: string]: string } = {
      'US': 'America/New_York',
      'GB': 'Europe/London',
      'CA': 'America/Toronto',
      'AU': 'Australia/Sydney',
      'DE': 'Europe/Berlin',
      'FR': 'Europe/Paris',
      'ES': 'Europe/Madrid',
      'IT': 'Europe/Rome',
      'JP': 'Asia/Tokyo',
      'KR': 'Asia/Seoul',
      'CN': 'Asia/Shanghai',
      'BR': 'America/Sao_Paulo',
      'MX': 'America/Mexico_City',
      'IN': 'Asia/Kolkata',
      'RU': 'Europe/Moscow'
    };

    return timezoneMap[country || 'US'] || 'America/New_York';
  }

  /**
   * Get active session for account
   */
  private getActiveSession(accountId: string): ProxySession | null {
    try {
      for (const session of this.sessions.values()) {
        if (session.accountId === accountId && session.expiresAt > new Date()) {
          return session;
        }
      }
      return null;
    } catch (error) {
      logger.error(`Failed to get active session for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Check if proxy is healthy
   */
  private isProxyHealthy(proxy: ProxyConfiguration): boolean {
    try {
      return (
        proxy.isActive &&
        proxy.successRate >= 0.8 &&
        proxy.responseTime <= 5000 &&
        proxy.failureCount <= 10 &&
        proxy.currentConnections < proxy.maxConcurrentConnections
      );
    } catch (error) {
      logger.error(`Failed to check proxy health for ${proxy.id}:`, error);
      return false;
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheckInterval(): void {
    try {
      this.healthCheckInterval = setInterval(async () => {
        logger.info('🔍 Running proxy health checks...');
        await this.performHealthChecks();
      }, 5 * 60 * 1000); // Every 5 minutes
      
      logger.info('✅ Proxy health check interval started');
    } catch (error) {
      logger.error('Failed to start health check interval:', error);
    }
  }

  /**
   * Perform comprehensive health checks on all proxies
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const healthCheckPromises = Array.from(this.proxies.values()).map(proxy => 
        this.checkProxyHealth(proxy)
      );
      
      const results = await Promise.allSettled(healthCheckPromises);
      
      let healthyCount = 0;
      let unhealthyCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          healthyCount++;
        } else {
          unhealthyCount++;
          const proxy = Array.from(this.proxies.values())[index];
          logger.warn(`Proxy ${proxy.id} failed health check`);
        }
      });
      
      logger.info(`Health check completed: ${healthyCount} healthy, ${unhealthyCount} unhealthy proxies`);
    } catch (error) {
      logger.error('Failed to perform health checks:', error);
    }
  }

  /**
   * Check individual proxy health with comprehensive testing
   */
  private async checkProxyHealth(proxy: ProxyConfiguration): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      // Create axios instance with proxy configuration
      const axiosInstance = this.createAxiosInstanceWithProxy(proxy);
      
      // Test proxy with multiple endpoints
      const testUrls = [
        'https://httpbin.org/ip',
        'https://api.ipify.org?format=json',
        'https://ipinfo.io/json'
      ];
      
      let successCount = 0;
      let totalResponseTime = 0;
      
      for (const url of testUrls) {
        try {
          const testStart = Date.now();
          const response = await axiosInstance.get(url, { timeout: 10000 });
          const testTime = Date.now() - testStart;
          
          if (response.status === 200) {
            successCount++;
            totalResponseTime += testTime;
          }
        } catch (error) {
          // Individual test failure is expected, continue with other tests
        }
      }
      
      const avgResponseTime = successCount > 0 ? totalResponseTime / successCount : 10000;
      const successRate = successCount / testUrls.length;
      
      // Update proxy metrics
      proxy.responseTime = avgResponseTime;
      proxy.successRate = (proxy.successRate * 0.8) + (successRate * 0.2); // Weighted average
      
      if (successRate === 0) {
        proxy.failureCount++;
      } else {
        proxy.failureCount = Math.max(0, proxy.failureCount - 1);
      }
      
      // Determine if proxy is healthy
      const isHealthy = successRate >= 0.5 && avgResponseTime <= 10000;
      
      if (!isHealthy && proxy.isActive) {
        logger.warn(`Marking proxy ${proxy.id} as unhealthy: success rate ${successRate}, response time ${avgResponseTime}ms`);
        proxy.isActive = false;
        
        // Update database
        await prisma.proxy.update({
          where: { id: proxy.id },
          data: {
            isActive: false,
            successRate: proxy.successRate,
            responseTime: proxy.responseTime,
            failureCount: proxy.failureCount
          }
        });
      } else if (isHealthy && !proxy.isActive && proxy.failureCount <= 5) {
        logger.info(`Reactivating healthy proxy ${proxy.id}`);
        proxy.isActive = true;
        
        await prisma.proxy.update({
          where: { id: proxy.id },
          data: {
            isActive: true,
            successRate: proxy.successRate,
            responseTime: proxy.responseTime,
            failureCount: proxy.failureCount
          }
        });
      }
      
      this.proxies.set(proxy.id, proxy);
      return isHealthy;
    } catch (error) {
      logger.error(`Health check failed for proxy ${proxy.id}:`, error);
      proxy.failureCount++;
      this.proxies.set(proxy.id, proxy);
      return false;
    }
  }

  /**
   * Create axios instance with proxy configuration
   */
  private createAxiosInstanceWithProxy(proxy: ProxyConfiguration): AxiosInstance {
    const proxyConfig: any = {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol
    };

    if (proxy.username && proxy.password) {
      proxyConfig.auth = {
        username: proxy.username,
        password: proxy.password
      };
    }

    return axios.create({
      proxy: proxyConfig,
      timeout: 15000,
      headers: {
        'User-Agent': proxy.metadata.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': proxy.metadata.acceptLanguage || 'en-US,en;q=0.9'
      }
    });
  }

  /**
   * Start rotation interval for session management
   */
  private startRotationInterval(): void {
    try {
      this.rotationInterval = setInterval(async () => {
        await this.rotateExpiredSessions();
      }, 60 * 1000); // Every minute
      
      logger.info('✅ Proxy rotation interval started');
    } catch (error) {
      logger.error('Failed to start rotation interval:', error);
    }
  }

  /**
   * Rotate expired sessions
   */
  private async rotateExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      const expiredSessions = Array.from(this.sessions.values()).filter(
        session => session.expiresAt <= now
      );

      for (const session of expiredSessions) {
        // Release proxy connection
        const proxy = this.proxies.get(session.proxyId);
        if (proxy) {
          proxy.currentConnections = Math.max(0, proxy.currentConnections - 1);
          this.proxies.set(proxy.id, proxy);
        }

        // Remove session
        this.sessions.delete(session.id);
        await cacheManager.del(`proxy_session:${session.accountId}`);
        
        logger.info(`Rotated expired session ${session.id} for account ${session.accountId}`);
      }

      if (expiredSessions.length > 0) {
        logger.info(`Rotated ${expiredSessions.length} expired proxy sessions`);
      }
    } catch (error) {
      logger.error('Failed to rotate expired sessions:', error);
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    try {
      setInterval(() => {
        this.collectPerformanceMetrics();
      }, 5 * 60 * 1000); // Every 5 minutes
      
      logger.info('✅ Proxy performance monitoring started');
    } catch (error) {
      logger.error('Failed to start performance monitoring:', error);
    }
  }

  /**
   * Collect performance metrics
   */
  private collectPerformanceMetrics(): void {
    try {
      const metrics = {
        totalProxies: this.proxies.size,
        activeProxies: Array.from(this.proxies.values()).filter(p => p.isActive).length,
        activeSessions: this.sessions.size,
        avgSuccessRate: this.calculateAverageSuccessRate(),
        avgResponseTime: this.calculateAverageResponseTime(),
        proxyTypeDistribution: this.getProxyTypeDistribution(),
        countryDistribution: this.getCountryDistribution(),
        timestamp: new Date()
      };

      this.performanceMetrics.set('current', metrics);
      
      // Log summary
      logger.info(`Proxy Performance: ${metrics.activeProxies}/${metrics.totalProxies} active, ${metrics.activeSessions} sessions, ${(metrics.avgSuccessRate * 100).toFixed(1)}% success rate, ${metrics.avgResponseTime.toFixed(0)}ms avg response`);
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  /**
   * Calculate average success rate
   */
  private calculateAverageSuccessRate(): number {
    const activeProxies = Array.from(this.proxies.values()).filter(p => p.isActive);
    if (activeProxies.length === 0) return 0;
    
    const totalSuccessRate = activeProxies.reduce((sum, proxy) => sum + proxy.successRate, 0);
    return totalSuccessRate / activeProxies.length;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    const activeProxies = Array.from(this.proxies.values()).filter(p => p.isActive);
    if (activeProxies.length === 0) return 0;
    
    const totalResponseTime = activeProxies.reduce((sum, proxy) => sum + proxy.responseTime, 0);
    return totalResponseTime / activeProxies.length;
  }

  /**
   * Get proxy type distribution
   */
  private getProxyTypeDistribution(): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    
    for (const proxy of this.proxies.values()) {
      if (proxy.isActive) {
        distribution[proxy.type] = (distribution[proxy.type] || 0) + 1;
      }
    }
    
    return distribution;
  }

  /**
   * Get country distribution
   */
  private getCountryDistribution(): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    
    for (const proxy of this.proxies.values()) {
      if (proxy.isActive && proxy.country) {
        distribution[proxy.country] = (distribution[proxy.country] || 0) + 1;
      }
    }
    
    return distribution;
  }

  /**
   * Decrypt password from database
   */
  private decryptPassword(encryptedPassword: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
      
      const [ivHex, encrypted] = encryptedPassword.split(':');
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encryption data');
      }

      const iv = Buffer.from(ivHex, 'hex');

      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt password:', error);
      return '';
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return this.performanceMetrics.get('current') || {};
  }

  /**
   * Get proxy statistics
   */
  getProxyStatistics(): {
    total: number;
    active: number;
    byType: { [key: string]: number };
    byCountry: { [key: string]: number };
    avgSuccessRate: number;
    avgResponseTime: number;
  } {
    return {
      total: this.proxies.size,
      active: Array.from(this.proxies.values()).filter(p => p.isActive).length,
      byType: this.getProxyTypeDistribution(),
      byCountry: this.getCountryDistribution(),
      avgSuccessRate: this.calculateAverageSuccessRate(),
      avgResponseTime: this.calculateAverageResponseTime()
    };
  }

  /**
   * Release proxy connection
   */
  async releaseProxy(accountId: string, proxyId: string): Promise<void> {
    try {
      const proxy = this.proxies.get(proxyId);
      if (proxy) {
        proxy.currentConnections = Math.max(0, proxy.currentConnections - 1);
        this.proxies.set(proxyId, proxy);
      }

      // Remove any active sessions
      const session = this.getActiveSession(accountId);
      if (session) {
        this.sessions.delete(session.id);
        await cacheManager.del(`proxy_session:${accountId}`);
      }

      logger.info(`Released proxy ${proxyId} for account ${accountId}`);
    } catch (error) {
      logger.error(`Failed to release proxy ${proxyId} for account ${accountId}:`, error);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down Enterprise Proxy Manager...');
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      if (this.rotationInterval) {
        clearInterval(this.rotationInterval);
      }
      
      // Release all active connections
      for (const proxy of this.proxies.values()) {
        proxy.currentConnections = 0;
      }
      
      // Clear all sessions
      this.sessions.clear();
      
      logger.info('✅ Enterprise Proxy Manager shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown proxy manager:', error);
    }
  }
}
