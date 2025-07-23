import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { cacheManager } from '../lib/cache';
import { twikitConfig, TwikitConfigManager } from '../config/twikit';

export enum ProxyType {
  RESIDENTIAL = 'residential',
  DATACENTER = 'datacenter',
  MOBILE = 'mobile'
}

export enum ActionRiskLevel {
  LOW = 'low',           // search, get_profile
  MEDIUM = 'medium',     // like, retweet
  HIGH = 'high',         // post, follow, dm
  CRITICAL = 'critical'  // authenticate
}

export interface ProxyEndpoint {
  id: string;
  url: string;
  type: ProxyType;
  username?: string;
  password?: string;
  healthScore: number;
  lastUsed: Date | null;
  lastHealthCheck: Date | null;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  consecutiveFailures: number;
  isActive: boolean;
  metadata: {
    country?: string;
    region?: string;
    provider?: string;
    bandwidth?: string;
    concurrent_limit?: number;
  };
}

export interface ProxyPool {
  type: ProxyType;
  endpoints: ProxyEndpoint[];
  currentIndex: number;
  totalRequests: number;
  successfulRequests: number;
  averageHealthScore: number;
  lastRotation: Date | null;
  isEnabled: boolean;
}

export interface ProxySelectionCriteria {
  actionType: string;
  riskLevel: ActionRiskLevel;
  accountId: string;
  preferredRegion?: string;
  requiresHighBandwidth?: boolean;
  maxResponseTime?: number;
  minHealthScore?: number;
}

export interface ProxyUsageStats {
  totalProxies: number;
  activeProxies: number;
  healthyProxies: number;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  successRate: number;
  poolStats: Map<ProxyType, {
    count: number;
    active: number;
    healthy: number;
    successRate: number;
  }>;
}

/**
 * Enterprise Proxy Rotation Manager
 * Manages multi-tier proxy pools with intelligent selection, health monitoring, and performance optimization
 */
export class ProxyRotationManager extends EventEmitter {
  private pools: Map<ProxyType, ProxyPool> = new Map();
  private configManager: TwikitConfigManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private rotationInterval: NodeJS.Timeout | null = null;
  private usageTrackingInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private readonly CACHE_PREFIX = 'proxy_manager';

  constructor(configManager?: TwikitConfigManager) {
    super();
    this.configManager = configManager || twikitConfig;
    this.initializePools();
    logger.info('ProxyRotationManager initialized');
  }

  /**
   * Initialize proxy pools from configuration
   */
  private initializePools(): void {
    const enabledPools = this.configManager.getEnabledProxyPools();
    
    for (const { type, config } of enabledPools) {
      const proxyType = type as ProxyType;
      const endpoints: ProxyEndpoint[] = config.urls.map((url, index) => ({
        id: `${proxyType}_${index}_${Date.now()}`,
        url,
        type: proxyType,
        ...(config.username && { username: config.username }),
        ...(config.password && { password: config.password }),
        healthScore: 1.0,
        lastUsed: null,
        lastHealthCheck: null,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        consecutiveFailures: 0,
        isActive: true,
        metadata: {}
      }));

      const pool: ProxyPool = {
        type: proxyType,
        endpoints,
        currentIndex: 0,
        totalRequests: 0,
        successfulRequests: 0,
        averageHealthScore: 1.0,
        lastRotation: null,
        isEnabled: true
      };

      this.pools.set(proxyType, pool);
      logger.info(`Initialized ${proxyType} proxy pool with ${endpoints.length} endpoints`);
    }

    this.emit('poolsInitialized', Array.from(this.pools.keys()));
  }

  /**
   * Start the proxy rotation manager
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('ProxyRotationManager is already running');
      return;
    }

    try {
      // Load cached proxy data
      await this.loadCachedProxyData();

      // Start health monitoring
      await this.startHealthMonitoring();

      // Start rotation management
      this.startRotationManagement();

      // Start usage tracking
      this.startUsageTracking();

      this.isInitialized = true;
      logger.info('ProxyRotationManager started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start ProxyRotationManager:', error);
      throw error;
    }
  }

  /**
   * Stop the proxy rotation manager
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }

    if (this.usageTrackingInterval) {
      clearInterval(this.usageTrackingInterval);
      this.usageTrackingInterval = null;
    }

    // Save proxy data to cache
    await this.saveProxyDataToCache();

    this.isInitialized = false;
    logger.info('ProxyRotationManager stopped');
    this.emit('stopped');
  }

  /**
   * Get optimal proxy for given criteria
   */
  async getOptimalProxy(criteria: ProxySelectionCriteria): Promise<ProxyEndpoint | null> {
    try {
      const preferredProxyType = this.determineOptimalProxyType(criteria.riskLevel);
      const pool = this.pools.get(preferredProxyType);

      if (!pool || !pool.isEnabled || pool.endpoints.length === 0) {
        logger.warn(`No available ${preferredProxyType} proxies, trying fallback`);
        return await this.getFallbackProxy(criteria);
      }

      // Filter healthy proxies
      const healthyProxies = pool.endpoints.filter(proxy => 
        proxy.isActive && 
        proxy.healthScore >= (criteria.minHealthScore || 0.5) &&
        proxy.consecutiveFailures < this.configManager.config.proxy.maxFailures
      );

      if (healthyProxies.length === 0) {
        logger.warn(`No healthy ${preferredProxyType} proxies available`);
        return await this.getFallbackProxy(criteria);
      }

      // Apply additional filtering criteria
      let candidateProxies = healthyProxies;

      if (criteria.maxResponseTime) {
        candidateProxies = candidateProxies.filter(p => 
          p.averageResponseTime === 0 || p.averageResponseTime <= criteria.maxResponseTime!
        );
      }

      if (criteria.preferredRegion) {
        const regionFiltered = candidateProxies.filter(p => 
          p.metadata.region === criteria.preferredRegion
        );
        if (regionFiltered.length > 0) {
          candidateProxies = regionFiltered;
        }
      }

      // Select best proxy using weighted scoring
      const selectedProxy = this.selectBestProxy(candidateProxies, criteria);
      
      if (selectedProxy) {
        // Update usage tracking
        selectedProxy.lastUsed = new Date();
        pool.lastRotation = new Date();
        
        logger.debug(`Selected ${preferredProxyType} proxy: ${selectedProxy.id}`, {
          healthScore: selectedProxy.healthScore,
          responseTime: selectedProxy.averageResponseTime,
          successRate: selectedProxy.totalRequests > 0 ? 
            (selectedProxy.successfulRequests / selectedProxy.totalRequests) * 100 : 0
        });

        this.emit('proxySelected', {
          proxy: selectedProxy,
          criteria,
          pool: preferredProxyType
        });
      }

      return selectedProxy;

    } catch (error) {
      logger.error('Error selecting optimal proxy:', error);
      return null;
    }
  }

  /**
   * Determine optimal proxy type based on action risk level
   */
  private determineOptimalProxyType(riskLevel: ActionRiskLevel): ProxyType {
    switch (riskLevel) {
      case ActionRiskLevel.CRITICAL:
      case ActionRiskLevel.HIGH:
        // High-risk actions prefer residential proxies for better anonymity
        return this.pools.has(ProxyType.RESIDENTIAL) ? ProxyType.RESIDENTIAL : ProxyType.MOBILE;

      case ActionRiskLevel.MEDIUM:
        // Medium-risk actions can use mobile or datacenter proxies
        return this.pools.has(ProxyType.MOBILE) ? ProxyType.MOBILE : ProxyType.DATACENTER;

      case ActionRiskLevel.LOW:
      default:
        // Low-risk actions can use any proxy type, prefer datacenter for speed
        return this.pools.has(ProxyType.DATACENTER) ? ProxyType.DATACENTER : ProxyType.MOBILE;
    }
  }

  /**
   * Get fallback proxy when preferred type is unavailable
   */
  private async getFallbackProxy(criteria: ProxySelectionCriteria): Promise<ProxyEndpoint | null> {
    const availableTypes = Array.from(this.pools.keys()).filter(type => {
      const pool = this.pools.get(type);
      return pool && pool.isEnabled && pool.endpoints.some(p => p.isActive && p.healthScore >= 0.3);
    });

    if (availableTypes.length === 0) {
      logger.error('No fallback proxies available');
      return null;
    }

    // Try each available type in order of preference
    for (const proxyType of availableTypes) {
      const pool = this.pools.get(proxyType)!;
      const healthyProxies = pool.endpoints.filter(p =>
        p.isActive && p.healthScore >= 0.3 && p.consecutiveFailures < 3
      );

      if (healthyProxies.length > 0) {
        const selectedProxy = this.selectBestProxy(healthyProxies, criteria);
        if (selectedProxy) {
          logger.info(`Using fallback ${proxyType} proxy: ${selectedProxy.id}`);
          selectedProxy.lastUsed = new Date();
          return selectedProxy;
        }
      }
    }

    return null;
  }

  /**
   * Select best proxy from candidates using weighted scoring
   */
  private selectBestProxy(candidates: ProxyEndpoint[], criteria: ProxySelectionCriteria): ProxyEndpoint | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0] || null;

    // Calculate weighted scores for each candidate
    const scoredProxies = candidates.map(proxy => {
      let score = 0;

      // Health score weight (40%)
      score += proxy.healthScore * 0.4;

      // Success rate weight (30%)
      const successRate = proxy.totalRequests > 0 ?
        proxy.successfulRequests / proxy.totalRequests : 1;
      score += successRate * 0.3;

      // Response time weight (20%) - lower is better
      if (proxy.averageResponseTime > 0) {
        const responseTimeScore = Math.max(0, 1 - (proxy.averageResponseTime / 5000)); // 5s max
        score += responseTimeScore * 0.2;
      } else {
        score += 0.2; // No data, assume good
      }

      // Usage balance weight (10%) - prefer less used proxies
      const maxRequests = Math.max(...candidates.map(p => p.totalRequests), 1);
      const usageScore = 1 - (proxy.totalRequests / maxRequests);
      score += usageScore * 0.1;

      // Penalty for consecutive failures
      score -= proxy.consecutiveFailures * 0.1;

      // Bonus for recent successful usage
      if (proxy.lastUsed && (Date.now() - proxy.lastUsed.getTime()) < 300000) { // 5 minutes
        score += 0.05;
      }

      return { proxy, score };
    });

    // Sort by score and select the best
    scoredProxies.sort((a, b) => b.score - a.score);

    logger.debug('Proxy selection scores:', scoredProxies.map(sp => ({
      id: sp.proxy.id,
      score: sp.score.toFixed(3),
      health: sp.proxy.healthScore.toFixed(3),
      successRate: sp.proxy.totalRequests > 0 ?
        ((sp.proxy.successfulRequests / sp.proxy.totalRequests) * 100).toFixed(1) + '%' : 'N/A'
    })));

    return scoredProxies.length > 0 && scoredProxies[0] ? scoredProxies[0].proxy : null;
  }

  /**
   * Update proxy performance metrics
   */
  async updateProxyMetrics(proxyId: string, success: boolean, responseTime?: number): Promise<void> {
    try {
      const proxy = this.findProxyById(proxyId);
      if (!proxy) {
        logger.warn(`Proxy not found for metrics update: ${proxyId}`);
        return;
      }

      const pool = this.pools.get(proxy.type)!;

      // Update request counts
      proxy.totalRequests++;
      pool.totalRequests++;

      if (success) {
        proxy.successfulRequests++;
        pool.successfulRequests++;
        proxy.consecutiveFailures = 0;

        // Improve health score gradually
        proxy.healthScore = Math.min(1.0, proxy.healthScore + 0.05);
      } else {
        proxy.failedRequests++;
        proxy.consecutiveFailures++;

        // Decrease health score
        proxy.healthScore = Math.max(0.0, proxy.healthScore - 0.1);

        // Disable proxy if too many consecutive failures
        if (proxy.consecutiveFailures >= this.configManager.config.proxy.maxFailures) {
          proxy.isActive = false;
          logger.warn(`Proxy ${proxyId} disabled due to consecutive failures`);
          this.emit('proxyDisabled', proxy);
        }
      }

      // Update response time (exponential moving average)
      if (responseTime !== undefined) {
        if (proxy.averageResponseTime === 0) {
          proxy.averageResponseTime = responseTime;
        } else {
          proxy.averageResponseTime = (proxy.averageResponseTime * 0.8) + (responseTime * 0.2);
        }
      }

      // Update pool average health score
      const activeProxies = pool.endpoints.filter(p => p.isActive);
      if (activeProxies.length > 0) {
        pool.averageHealthScore = activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length;
      }

      // Cache updated metrics
      await this.cacheProxyMetrics(proxy);

      logger.debug(`Updated metrics for proxy ${proxyId}:`, {
        success,
        healthScore: proxy.healthScore.toFixed(3),
        consecutiveFailures: proxy.consecutiveFailures,
        responseTime: responseTime || 'N/A'
      });

    } catch (error) {
      logger.error('Error updating proxy metrics:', error);
    }
  }

  /**
   * Start health monitoring for all proxies
   */
  private async startHealthMonitoring(): Promise<void> {
    const interval = this.configManager.config.proxy.healthCheckInterval * 1000;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, interval);

    // Perform initial health check
    await this.performHealthChecks();

    logger.info(`Health monitoring started with ${interval}ms interval`);
  }

  /**
   * Perform health checks on all active proxies
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises: Promise<void>[] = [];

    for (const pool of this.pools.values()) {
      for (const proxy of pool.endpoints) {
        if (proxy.isActive) {
          healthCheckPromises.push(this.checkProxyHealth(proxy));
        }
      }
    }

    try {
      await Promise.allSettled(healthCheckPromises);
      logger.debug('Health checks completed for all active proxies');
    } catch (error) {
      logger.error('Error during health checks:', error);
    }
  }

  /**
   * Check health of individual proxy
   */
  private async checkProxyHealth(proxy: ProxyEndpoint): Promise<void> {
    const healthCheckUrls = this.configManager.config.proxy.healthCheckUrls;
    const timeout = this.configManager.config.proxy.healthCheckTimeout * 1000;

    try {
      const startTime = Date.now();

      // Use a random health check URL
      const checkUrl = healthCheckUrls[Math.floor(Math.random() * healthCheckUrls.length)];

      if (!checkUrl) {
        logger.warn('No health check URLs configured');
        return;
      }

      // Perform health check with proxy
      const response = await this.performProxyHealthCheck(proxy, checkUrl, timeout);

      const responseTime = Date.now() - startTime;

      if (response.success) {
        // Health check passed
        proxy.healthScore = Math.min(1.0, proxy.healthScore + 0.02);
        proxy.consecutiveFailures = 0;

        // Update response time
        if (proxy.averageResponseTime === 0) {
          proxy.averageResponseTime = responseTime;
        } else {
          proxy.averageResponseTime = (proxy.averageResponseTime * 0.9) + (responseTime * 0.1);
        }

        // Extract metadata if available
        if (response.metadata) {
          Object.assign(proxy.metadata, response.metadata);
        }

      } else {
        // Health check failed
        proxy.healthScore = Math.max(0.0, proxy.healthScore - 0.05);
        proxy.consecutiveFailures++;

        if (proxy.consecutiveFailures >= this.configManager.config.proxy.maxFailures) {
          proxy.isActive = false;
          logger.warn(`Proxy ${proxy.id} disabled after health check failures`);
          this.emit('proxyHealthCheckFailed', proxy);
        }
      }

      proxy.lastHealthCheck = new Date();

    } catch (error) {
      logger.error(`Health check failed for proxy ${proxy.id}:`, error);
      proxy.healthScore = Math.max(0.0, proxy.healthScore - 0.1);
      proxy.consecutiveFailures++;
    }
  }

  /**
   * Perform actual proxy health check (mock implementation)
   */
  private async performProxyHealthCheck(
    proxy: ProxyEndpoint,
    checkUrl: string,
    timeout: number
  ): Promise<{ success: boolean; metadata?: any }> {
    // In a real implementation, this would make an HTTP request through the proxy
    // For now, we'll simulate the health check

    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate success/failure based on proxy health score
        const success = Math.random() < (proxy.healthScore * 0.8 + 0.2);

        resolve({
          success,
          metadata: success ? {
            country: 'US',
            region: 'East',
            ip: '192.168.1.1'
          } : undefined
        });
      }, Math.random() * 1000 + 500); // 500-1500ms response time
    });
  }

  /**
   * Start rotation management
   */
  private startRotationManagement(): void {
    const interval = this.configManager.config.proxy.rotationInterval * 1000;

    this.rotationInterval = setInterval(() => {
      this.performRotationMaintenance();
    }, interval);

    logger.info(`Rotation management started with ${interval}ms interval`);
  }

  /**
   * Perform rotation maintenance tasks
   */
  private performRotationMaintenance(): void {
    try {
      // Re-enable proxies that have recovered
      this.reactivateRecoveredProxies();

      // Balance proxy usage
      this.balanceProxyUsage();

      // Update pool statistics
      this.updatePoolStatistics();

      logger.debug('Rotation maintenance completed');
    } catch (error) {
      logger.error('Error during rotation maintenance:', error);
    }
  }

  /**
   * Reactivate proxies that have recovered
   */
  private reactivateRecoveredProxies(): void {
    for (const pool of this.pools.values()) {
      for (const proxy of pool.endpoints) {
        if (!proxy.isActive && proxy.healthScore > 0.6 && proxy.consecutiveFailures === 0) {
          proxy.isActive = true;
          logger.info(`Reactivated recovered proxy: ${proxy.id}`);
          this.emit('proxyReactivated', proxy);
        }
      }
    }
  }

  /**
   * Balance proxy usage across pools
   */
  private balanceProxyUsage(): void {
    for (const pool of this.pools.values()) {
      const activeProxies = pool.endpoints.filter(p => p.isActive);

      if (activeProxies.length > 1) {
        // Sort by usage (least used first)
        activeProxies.sort((a, b) => a.totalRequests - b.totalRequests);

        // Update current index to prefer less used proxies
        if (activeProxies.length > 0 && activeProxies[0]) {
          const leastUsedIndex = pool.endpoints.indexOf(activeProxies[0]);
          if (leastUsedIndex !== -1) {
            pool.currentIndex = leastUsedIndex;
          }
        }
      }
    }
  }

  /**
   * Update pool statistics
   */
  private updatePoolStatistics(): void {
    for (const pool of this.pools.values()) {
      const activeProxies = pool.endpoints.filter(p => p.isActive);

      if (activeProxies.length > 0) {
        pool.averageHealthScore = activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length;
      }
    }
  }

  /**
   * Start usage tracking
   */
  private startUsageTracking(): void {
    this.usageTrackingInterval = setInterval(() => {
      this.trackUsageMetrics();
    }, 60000); // Track every minute

    logger.info('Usage tracking started');
  }

  /**
   * Track usage metrics
   */
  private trackUsageMetrics(): void {
    const stats = this.getUsageStatistics();

    // Emit usage statistics for monitoring
    this.emit('usageStats', stats);

    // Log summary
    logger.debug('Proxy usage statistics:', {
      totalProxies: stats.totalProxies,
      activeProxies: stats.activeProxies,
      successRate: `${stats.successRate.toFixed(1)}%`,
      avgResponseTime: `${stats.averageResponseTime.toFixed(0)}ms`
    });
  }

  /**
   * Find proxy by ID
   */
  private findProxyById(proxyId: string): ProxyEndpoint | null {
    for (const pool of this.pools.values()) {
      const proxy = pool.endpoints.find(p => p.id === proxyId);
      if (proxy) return proxy;
    }
    return null;
  }

  /**
   * Load cached proxy data
   */
  private async loadCachedProxyData(): Promise<void> {
    try {
      for (const [type, pool] of this.pools.entries()) {
        const cacheKey = `${this.CACHE_PREFIX}:${type}`;
        const cachedData = await cacheManager.get(cacheKey);

        if (cachedData && Array.isArray(cachedData)) {
          // Restore proxy metrics from cache
          for (let i = 0; i < Math.min(cachedData.length, pool.endpoints.length); i++) {
            const cached = cachedData[i];
            const proxy = pool.endpoints[i];

            if (cached && proxy && cached.id === proxy.id) {
              proxy.healthScore = cached.healthScore || 1.0;
              proxy.totalRequests = cached.totalRequests || 0;
              proxy.successfulRequests = cached.successfulRequests || 0;
              proxy.failedRequests = cached.failedRequests || 0;
              proxy.averageResponseTime = cached.averageResponseTime || 0;
              proxy.consecutiveFailures = cached.consecutiveFailures || 0;
              proxy.lastUsed = cached.lastUsed ? new Date(cached.lastUsed) : null;
              proxy.lastHealthCheck = cached.lastHealthCheck ? new Date(cached.lastHealthCheck) : null;
            }
          }
        }
      }

      logger.info('Loaded cached proxy data');
    } catch (error) {
      logger.warn('Failed to load cached proxy data:', error);
    }
  }

  /**
   * Save proxy data to cache
   */
  private async saveProxyDataToCache(): Promise<void> {
    try {
      for (const [type, pool] of this.pools.entries()) {
        const cacheKey = `${this.CACHE_PREFIX}:${type}`;
        const dataToCache = pool.endpoints.map(proxy => ({
          id: proxy.id,
          healthScore: proxy.healthScore,
          totalRequests: proxy.totalRequests,
          successfulRequests: proxy.successfulRequests,
          failedRequests: proxy.failedRequests,
          averageResponseTime: proxy.averageResponseTime,
          consecutiveFailures: proxy.consecutiveFailures,
          lastUsed: proxy.lastUsed,
          lastHealthCheck: proxy.lastHealthCheck
        }));

        await cacheManager.set(cacheKey, dataToCache, 86400); // 24 hours
      }

      logger.info('Saved proxy data to cache');
    } catch (error) {
      logger.warn('Failed to save proxy data to cache:', error);
    }
  }

  /**
   * Cache individual proxy metrics
   */
  private async cacheProxyMetrics(proxy: ProxyEndpoint): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:proxy:${proxy.id}`;
      const metricsData = {
        healthScore: proxy.healthScore,
        totalRequests: proxy.totalRequests,
        successfulRequests: proxy.successfulRequests,
        failedRequests: proxy.failedRequests,
        averageResponseTime: proxy.averageResponseTime,
        consecutiveFailures: proxy.consecutiveFailures,
        lastUsed: proxy.lastUsed,
        lastHealthCheck: proxy.lastHealthCheck
      };

      await cacheManager.set(cacheKey, metricsData, 3600); // 1 hour
    } catch (error) {
      logger.debug('Failed to cache proxy metrics:', error);
    }
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Get usage statistics for all proxy pools
   */
  getUsageStatistics(): ProxyUsageStats {
    let totalProxies = 0;
    let activeProxies = 0;
    let healthyProxies = 0;
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    const poolStats = new Map<ProxyType, any>();

    for (const [type, pool] of this.pools.entries()) {
      const poolActiveProxies = pool.endpoints.filter(p => p.isActive);
      const poolHealthyProxies = poolActiveProxies.filter(p => p.healthScore >= 0.5);
      const poolTotalRequests = pool.endpoints.reduce((sum, p) => sum + p.totalRequests, 0);
      const poolSuccessfulRequests = pool.endpoints.reduce((sum, p) => sum + p.successfulRequests, 0);

      totalProxies += pool.endpoints.length;
      activeProxies += poolActiveProxies.length;
      healthyProxies += poolHealthyProxies.length;
      totalRequests += poolTotalRequests;
      successfulRequests += poolSuccessfulRequests;

      // Calculate average response time
      for (const proxy of pool.endpoints) {
        if (proxy.averageResponseTime > 0) {
          totalResponseTime += proxy.averageResponseTime;
          responseTimeCount++;
        }
      }

      poolStats.set(type, {
        count: pool.endpoints.length,
        active: poolActiveProxies.length,
        healthy: poolHealthyProxies.length,
        successRate: poolTotalRequests > 0 ? (poolSuccessfulRequests / poolTotalRequests) * 100 : 0
      });
    }

    return {
      totalProxies,
      activeProxies,
      healthyProxies,
      totalRequests,
      successfulRequests,
      averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      poolStats
    };
  }

  /**
   * Get detailed information about all proxy pools
   */
  getPoolInformation(): Map<ProxyType, ProxyPool> {
    return new Map(this.pools);
  }

  /**
   * Get proxy by ID
   */
  getProxyById(proxyId: string): ProxyEndpoint | null {
    return this.findProxyById(proxyId);
  }

  /**
   * Manually disable a proxy
   */
  async disableProxy(proxyId: string, reason?: string): Promise<boolean> {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) {
      logger.warn(`Cannot disable proxy - not found: ${proxyId}`);
      return false;
    }

    proxy.isActive = false;
    logger.info(`Manually disabled proxy ${proxyId}${reason ? `: ${reason}` : ''}`);

    await this.cacheProxyMetrics(proxy);
    this.emit('proxyDisabled', proxy, reason);

    return true;
  }

  /**
   * Manually enable a proxy
   */
  async enableProxy(proxyId: string): Promise<boolean> {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) {
      logger.warn(`Cannot enable proxy - not found: ${proxyId}`);
      return false;
    }

    proxy.isActive = true;
    proxy.consecutiveFailures = 0;
    proxy.healthScore = Math.max(0.5, proxy.healthScore);

    logger.info(`Manually enabled proxy ${proxyId}`);

    await this.cacheProxyMetrics(proxy);
    this.emit('proxyEnabled', proxy);

    return true;
  }

  /**
   * Reset proxy metrics
   */
  async resetProxyMetrics(proxyId: string): Promise<boolean> {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) {
      return false;
    }

    proxy.totalRequests = 0;
    proxy.successfulRequests = 0;
    proxy.failedRequests = 0;
    proxy.averageResponseTime = 0;
    proxy.consecutiveFailures = 0;
    proxy.healthScore = 1.0;
    proxy.lastUsed = null;
    proxy.lastHealthCheck = null;

    await this.cacheProxyMetrics(proxy);
    logger.info(`Reset metrics for proxy ${proxyId}`);

    return true;
  }

  /**
   * Add new proxy endpoint to a pool
   */
  async addProxyEndpoint(type: ProxyType, url: string, username?: string, password?: string): Promise<string | null> {
    const pool = this.pools.get(type);
    if (!pool) {
      logger.error(`Cannot add proxy - pool not found: ${type}`);
      return null;
    }

    const proxyId = `${type}_${pool.endpoints.length}_${Date.now()}`;
    const newProxy: ProxyEndpoint = {
      id: proxyId,
      url,
      type,
      ...(username && { username }),
      ...(password && { password }),
      healthScore: 1.0,
      lastUsed: null,
      lastHealthCheck: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      consecutiveFailures: 0,
      isActive: true,
      metadata: {}
    };

    pool.endpoints.push(newProxy);
    await this.cacheProxyMetrics(newProxy);

    logger.info(`Added new proxy endpoint: ${proxyId}`);
    this.emit('proxyAdded', newProxy);

    return proxyId;
  }

  /**
   * Remove proxy endpoint from pool
   */
  async removeProxyEndpoint(proxyId: string): Promise<boolean> {
    for (const pool of this.pools.values()) {
      const index = pool.endpoints.findIndex(p => p.id === proxyId);
      if (index !== -1) {
        const removedProxy = pool.endpoints.splice(index, 1)[0];

        // Remove from cache
        try {
          await cacheManager.del(`${this.CACHE_PREFIX}:proxy:${proxyId}`);
        } catch (error) {
          logger.debug('Failed to remove proxy from cache:', error);
        }

        logger.info(`Removed proxy endpoint: ${proxyId}`);
        this.emit('proxyRemoved', removedProxy);

        return true;
      }
    }

    return false;
  }

  // ===== INTEGRATED TESTING METHODS =====

  /**
   * Test proxy health for all active proxies
   */
  async testProxyHealth(): Promise<Map<string, { success: boolean; responseTime?: number; error?: string }>> {
    const results = new Map<string, any>();

    logger.info('Starting proxy health test...');

    for (const pool of this.pools.values()) {
      for (const proxy of pool.endpoints) {
        if (proxy.isActive) {
          try {
            const startTime = Date.now();
            const healthResult = await this.performProxyHealthCheck(
              proxy,
              'https://httpbin.org/ip',
              10000
            );
            const responseTime = Date.now() - startTime;

            results.set(proxy.id, {
              success: healthResult.success,
              responseTime,
              metadata: healthResult.metadata
            });

          } catch (error) {
            results.set(proxy.id, {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    }

    logger.info(`Proxy health test completed for ${results.size} proxies`);
    return results;
  }

  /**
   * Validate configuration and setup
   */
  validateConfiguration(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if any pools are configured
    if (this.pools.size === 0) {
      errors.push('No proxy pools configured');
    }

    // Check each pool
    for (const [type, pool] of this.pools.entries()) {
      if (pool.endpoints.length === 0) {
        warnings.push(`${type} pool has no endpoints configured`);
      }

      const activeEndpoints = pool.endpoints.filter(p => p.isActive);
      if (activeEndpoints.length === 0) {
        warnings.push(`${type} pool has no active endpoints`);
      }

      // Validate endpoint URLs
      for (const endpoint of pool.endpoints) {
        try {
          new URL(endpoint.url);
        } catch (error) {
          errors.push(`Invalid URL in ${type} pool: ${endpoint.url}`);
        }
      }
    }

    // Check configuration values
    const config = this.configManager.config.proxy;

    if (config.healthCheckInterval <= 0) {
      errors.push('Health check interval must be positive');
    }

    if (config.rotationInterval <= 0) {
      errors.push('Rotation interval must be positive');
    }

    if (config.maxFailures <= 0) {
      errors.push('Max failures must be positive');
    }

    if (config.healthCheckUrls.length === 0) {
      errors.push('No health check URLs configured');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics(): Promise<{
    configuration: ReturnType<ProxyRotationManager['validateConfiguration']>;
    statistics: ProxyUsageStats;
    healthTest: Map<string, any>;
    poolStatus: Map<ProxyType, {
      total: number;
      active: number;
      healthy: number;
      avgHealth: number;
      avgResponseTime: number;
    }>;
  }> {
    logger.info('Running comprehensive proxy diagnostics...');

    const configuration = this.validateConfiguration();
    const statistics = this.getUsageStatistics();
    const healthTest = await this.testProxyHealth();

    const poolStatus = new Map<ProxyType, any>();

    for (const [type, pool] of this.pools.entries()) {
      const activeProxies = pool.endpoints.filter(p => p.isActive);
      const healthyProxies = activeProxies.filter(p => p.healthScore >= 0.5);

      const avgHealth = activeProxies.length > 0
        ? activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length
        : 0;

      const proxiesWithResponseTime = activeProxies.filter(p => p.averageResponseTime > 0);
      const avgResponseTime = proxiesWithResponseTime.length > 0
        ? proxiesWithResponseTime.reduce((sum, p) => sum + p.averageResponseTime, 0) / proxiesWithResponseTime.length
        : 0;

      poolStatus.set(type, {
        total: pool.endpoints.length,
        active: activeProxies.length,
        healthy: healthyProxies.length,
        avgHealth: Number(avgHealth.toFixed(3)),
        avgResponseTime: Number(avgResponseTime.toFixed(0))
      });
    }

    logger.info('Proxy diagnostics completed');

    return {
      configuration,
      statistics,
      healthTest,
      poolStatus
    };
  }

  /**
   * Test proxy selection algorithm
   */
  async testProxySelection(): Promise<{
    testResults: Array<{
      criteria: ProxySelectionCriteria;
      selectedProxy: ProxyEndpoint | null;
      selectionTime: number;
    }>;
    summary: {
      totalTests: number;
      successfulSelections: number;
      averageSelectionTime: number;
      poolDistribution: Map<ProxyType, number>;
    };
  }> {
    logger.info('Testing proxy selection algorithm...');

    const testCriteria: ProxySelectionCriteria[] = [
      {
        actionType: 'authenticate',
        riskLevel: ActionRiskLevel.CRITICAL,
        accountId: 'test_account_1',
        minHealthScore: 0.8
      },
      {
        actionType: 'post_tweet',
        riskLevel: ActionRiskLevel.HIGH,
        accountId: 'test_account_2',
        maxResponseTime: 3000
      },
      {
        actionType: 'like_tweet',
        riskLevel: ActionRiskLevel.MEDIUM,
        accountId: 'test_account_3'
      },
      {
        actionType: 'search_tweets',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'test_account_4',
        requiresHighBandwidth: false
      }
    ];

    const testResults = [];
    const poolDistribution = new Map<ProxyType, number>();

    for (const criteria of testCriteria) {
      const startTime = Date.now();
      const selectedProxy = await this.getOptimalProxy(criteria);
      const selectionTime = Date.now() - startTime;

      testResults.push({
        criteria,
        selectedProxy,
        selectionTime
      });

      if (selectedProxy) {
        const count = poolDistribution.get(selectedProxy.type) || 0;
        poolDistribution.set(selectedProxy.type, count + 1);
      }
    }

    const successfulSelections = testResults.filter(r => r.selectedProxy !== null).length;
    const averageSelectionTime = testResults.reduce((sum, r) => sum + r.selectionTime, 0) / testResults.length;

    logger.info(`Proxy selection test completed: ${successfulSelections}/${testResults.length} successful`);

    return {
      testResults,
      summary: {
        totalTests: testResults.length,
        successfulSelections,
        averageSelectionTime: Number(averageSelectionTime.toFixed(2)),
        poolDistribution
      }
    };
  }

  /**
   * Generate comprehensive status report
   */
  getStatusReport(): {
    isRunning: boolean;
    uptime: number;
    configuration: ReturnType<ProxyRotationManager['validateConfiguration']>;
    statistics: ProxyUsageStats;
    poolSummary: Array<{
      type: ProxyType;
      total: number;
      active: number;
      healthy: number;
      avgHealth: string;
      successRate: string;
    }>;
  } {
    const statistics = this.getUsageStatistics();
    const configuration = this.validateConfiguration();

    const poolSummary = Array.from(this.pools.entries()).map(([type, pool]) => {
      const activeProxies = pool.endpoints.filter(p => p.isActive);
      const healthyProxies = activeProxies.filter(p => p.healthScore >= 0.5);
      const avgHealth = activeProxies.length > 0
        ? activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length
        : 0;
      const successRate = pool.totalRequests > 0
        ? (pool.successfulRequests / pool.totalRequests) * 100
        : 0;

      return {
        type,
        total: pool.endpoints.length,
        active: activeProxies.length,
        healthy: healthyProxies.length,
        avgHealth: avgHealth.toFixed(3),
        successRate: successRate.toFixed(1) + '%'
      };
    });

    return {
      isRunning: this.isInitialized,
      uptime: this.isInitialized ? Date.now() - (this.pools.values().next().value?.lastRotation?.getTime() || Date.now()) : 0,
      configuration,
      statistics,
      poolSummary
    };
  }
}

// Singleton instance
export const proxyRotationManager = new ProxyRotationManager();
