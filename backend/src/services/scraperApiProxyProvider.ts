import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';
import { ProxyConfiguration, ProxySession } from './antiDetection/proxyManager';

/**
 * Scraper API Proxy Provider Integration
 * This service integrates scraper APIs (like ScraperAPI, ZenRows, etc.) as proxy providers
 * for the X Marketing Platform automation system
 */

export interface ScraperApiConfig {
  apiKey: string;
  baseUrl: string;
  proxyEndpoint: string;
  maxConcurrentRequests: number;
  requestsPerMinute: number;
  costPerRequest: number;
  features: {
    jsRendering: boolean;
    captchaSolving: boolean;
    geoTargeting: boolean;
    sessionStickiness: boolean;
  };
}

export interface ScraperApiProvider {
  name: string;
  config: ScraperApiConfig;
  healthScore: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date | null;
}

/**
 * Popular Scraper API Providers Configuration
 */
export const SCRAPER_API_PROVIDERS: { [key: string]: Omit<ScraperApiConfig, 'apiKey'> } = {
  scraperapi: {
    baseUrl: 'http://api.scraperapi.com',
    proxyEndpoint: 'proxy-server.scraperapi.com:8001',
    maxConcurrentRequests: 100,
    requestsPerMinute: 60,
    costPerRequest: 0.001, // $0.001 per request
    features: {
      jsRendering: true,
      captchaSolving: true,
      geoTargeting: true,
      sessionStickiness: true
    }
  },
  zenrows: {
    baseUrl: 'https://api.zenrows.com/v1',
    proxyEndpoint: 'proxy.zenrows.com:8001',
    maxConcurrentRequests: 50,
    requestsPerMinute: 30,
    costPerRequest: 0.002, // $0.002 per request
    features: {
      jsRendering: true,
      captchaSolving: true,
      geoTargeting: true,
      sessionStickiness: true
    }
  },
  oxylabs: {
    baseUrl: 'https://realtime.oxylabs.io/v1/queries',
    proxyEndpoint: 'realtime.oxylabs.io:60000',
    maxConcurrentRequests: 200,
    requestsPerMinute: 120,
    costPerRequest: 0.0015, // $0.0015 per request
    features: {
      jsRendering: true,
      captchaSolving: true,
      geoTargeting: true,
      sessionStickiness: true
    }
  },
  brightdata: {
    baseUrl: 'https://api.brightdata.com',
    proxyEndpoint: 'brd.superproxy.io:22225',
    maxConcurrentRequests: 500,
    requestsPerMinute: 300,
    costPerRequest: 0.0012, // $0.0012 per request
    features: {
      jsRendering: true,
      captchaSolving: true,
      geoTargeting: true,
      sessionStickiness: true
    }
  }
};

/**
 * Scraper API Proxy Provider Service
 */
export class ScraperApiProxyProvider {
  private providers: Map<string, ScraperApiProvider> = new Map();
  private activeProvider: string | null = null;
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    // Don't initialize in constructor - allow manual initialization
  }

  /**
   * Initialize providers manually with API keys
   */
  public initialize(apiKeys?: { [provider: string]: string }): void {
    this.initializeProviders(apiKeys);
  }

  /**
   * Initialize scraper API providers from environment configuration or provided keys
   */
  private initializeProviders(apiKeys?: { [provider: string]: string }): void {
    try {
      logger.info('🔧 Initializing Scraper API Proxy Providers...');

      // Check for configured scraper API keys in environment or provided keys
      const scraperApiKey = apiKeys?.scraperapi || process.env.SCRAPER_API_KEY;
      const zenrowsApiKey = apiKeys?.zenrows || process.env.ZENROWS_API_KEY;
      const oxylabsApiKey = apiKeys?.oxylabs || process.env.OXYLABS_API_KEY;
      const brightdataApiKey = apiKeys?.brightdata || process.env.BRIGHTDATA_API_KEY;

      // Initialize ScraperAPI if key is provided
      if (scraperApiKey) {
        this.addProvider('scraperapi', {
          ...SCRAPER_API_PROVIDERS.scraperapi,
          apiKey: scraperApiKey
        } as ScraperApiConfig);
      }

      // Initialize ZenRows if key is provided
      if (zenrowsApiKey) {
        this.addProvider('zenrows', {
          ...SCRAPER_API_PROVIDERS.zenrows,
          apiKey: zenrowsApiKey
        } as ScraperApiConfig);
      }

      // Initialize Oxylabs if key is provided
      if (oxylabsApiKey) {
        this.addProvider('oxylabs', {
          ...SCRAPER_API_PROVIDERS.oxylabs,
          apiKey: oxylabsApiKey
        } as ScraperApiConfig);
      }

      // Initialize BrightData if key is provided
      if (brightdataApiKey) {
        this.addProvider('brightdata', {
          ...SCRAPER_API_PROVIDERS.brightdata,
          apiKey: brightdataApiKey
        } as ScraperApiConfig);
      }

      // Set active provider (prefer ScraperAPI if available)
      if (this.providers.has('scraperapi')) {
        this.activeProvider = 'scraperapi';
      } else if (this.providers.size > 0) {
        this.activeProvider = Array.from(this.providers.keys())[0] || null;
      }

      logger.info(`✅ Initialized ${this.providers.size} scraper API providers`);
      if (this.activeProvider) {
        logger.info(`🎯 Active provider: ${this.activeProvider}`);
      }

    } catch (error) {
      logger.error('❌ Failed to initialize scraper API providers:', error);
    }
  }

  /**
   * Add a scraper API provider
   */
  private addProvider(name: string, config: ScraperApiConfig): void {
    const provider: ScraperApiProvider = {
      name,
      config,
      healthScore: 1.0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastUsed: null
    };

    this.providers.set(name, provider);
    this.requestCounts.set(name, { count: 0, resetTime: Date.now() + 60000 });
    
    logger.info(`📡 Added scraper API provider: ${name}`);
  }

  /**
   * Get the best available scraper API provider
   */
  public getBestProvider(): ScraperApiProvider | null {
    if (this.providers.size === 0) {
      logger.warn('No scraper API providers available');
      return null;
    }

    // Filter providers that haven't exceeded rate limits
    const availableProviders = Array.from(this.providers.values()).filter(provider => {
      const rateLimitInfo = this.requestCounts.get(provider.name);
      if (!rateLimitInfo) return true;

      // Reset count if time window has passed
      if (Date.now() > rateLimitInfo.resetTime) {
        this.requestCounts.set(provider.name, { count: 0, resetTime: Date.now() + 60000 });
        return true;
      }

      return rateLimitInfo.count < provider.config.requestsPerMinute;
    });

    if (availableProviders.length === 0) {
      logger.warn('All scraper API providers have exceeded rate limits');
      return null;
    }

    // Sort by health score and response time
    availableProviders.sort((a, b) => {
      const scoreA = a.healthScore - (a.averageResponseTime / 10000); // Penalize slow responses
      const scoreB = b.healthScore - (b.averageResponseTime / 10000);
      return scoreB - scoreA;
    });

    return availableProviders[0] || null;
  }

  /**
   * Create HTTP proxy configuration for scraper API
   */
  public createProxyConfig(provider?: ScraperApiProvider): ProxyConfiguration | null {
    const selectedProvider = provider || this.getBestProvider();
    
    if (!selectedProvider) {
      return null;
    }

    // Parse proxy endpoint
    const [host, port] = selectedProvider.config.proxyEndpoint.split(':');

    if (!host) {
      return null;
    }

    return {
      id: `scraperapi_${selectedProvider.name}_${Date.now()}`,
      type: 'residential', // Scraper APIs typically use residential proxies
      provider: selectedProvider.name,
      host: host,
      port: parseInt(port || '8001') || 8001,
      username: 'scraperapi', // Standard username for scraper APIs
      password: selectedProvider.config.apiKey, // API key as password
      protocol: 'http',
      country: '', // Will be handled by scraper API
      region: '',
      city: '',
      isActive: true,
      lastUsed: selectedProvider.lastUsed,
      successRate: selectedProvider.successfulRequests / Math.max(selectedProvider.totalRequests, 1),
      responseTime: selectedProvider.averageResponseTime,
      failureCount: selectedProvider.failedRequests,
      maxConcurrentConnections: selectedProvider.config.maxConcurrentRequests,
      currentConnections: 0,
      rotationInterval: 300, // 5 minutes
      stickySession: selectedProvider.config.features.sessionStickiness,
      sessionDuration: 1800, // 30 minutes
      metadata: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        acceptLanguage: 'en-US,en;q=0.9'
      } as any
    };
  }

  /**
   * Create axios instance with scraper API proxy
   */
  public createAxiosInstance(targetUrl: string, options: {
    jsRendering?: boolean;
    country?: string;
    sessionId?: string;
  } = {}): AxiosInstance | null {
    const provider = this.getBestProvider();
    
    if (!provider) {
      logger.error('No scraper API provider available');
      return null;
    }

    // Increment request count
    const rateLimitInfo = this.requestCounts.get(provider.name);
    if (rateLimitInfo) {
      rateLimitInfo.count++;
    }

    // Create proxy configuration
    const proxyConfig = this.createProxyConfig(provider);
    if (!proxyConfig) {
      return null;
    }

    // Configure axios with scraper API proxy - optimized for better performance
    const axiosConfig: AxiosRequestConfig = {
      proxy: {
        host: proxyConfig.host,
        port: proxyConfig.port,
        auth: {
          username: proxyConfig.username!,
          password: proxyConfig.password!
        },
        protocol: proxyConfig.protocol as any
      },
      timeout: 45000, // Increased timeout for proxy requests
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Accept 4xx errors as valid responses
    };

    // Add scraper API specific parameters
    const params: any = {
      api_key: provider.config.apiKey,
      url: targetUrl
    };

    if (options.jsRendering && provider.config.features.jsRendering) {
      params.render = 'true';
    }

    if (options.country && provider.config.features.geoTargeting) {
      params.country_code = options.country;
    }

    if (options.sessionId && provider.config.features.sessionStickiness) {
      params.session_number = options.sessionId;
    }

    axiosConfig.params = params;

    const instance = axios.create(axiosConfig);

    // Add response interceptor to track metrics
    instance.interceptors.response.use(
      (response) => {
        this.updateProviderMetrics(provider.name, true, (response.config as any).metadata?.startTime);
        return response;
      },
      (error) => {
        this.updateProviderMetrics(provider.name, false, (error.config as any)?.metadata?.startTime);
        return Promise.reject(error);
      }
    );

    // Add request interceptor to track start time
    instance.interceptors.request.use((config) => {
      (config as any).metadata = { startTime: Date.now() };
      return config;
    });

    return instance;
  }

  /**
   * Update provider performance metrics
   */
  private updateProviderMetrics(providerName: string, success: boolean, startTime?: number): void {
    const provider = this.providers.get(providerName);
    if (!provider) return;

    provider.totalRequests++;
    provider.lastUsed = new Date();

    if (success) {
      provider.successfulRequests++;
    } else {
      provider.failedRequests++;
    }

    // Update response time
    if (startTime) {
      const responseTime = Date.now() - startTime;
      provider.averageResponseTime = (provider.averageResponseTime * (provider.totalRequests - 1) + responseTime) / provider.totalRequests;
    }

    // Update health score
    provider.healthScore = provider.successfulRequests / provider.totalRequests;

    this.providers.set(providerName, provider);
  }

  /**
   * Test scraper API provider health
   */
  public async testProviderHealth(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return false;
    }

    try {
      const axiosInstance = this.createAxiosInstance('https://httpbin.org/ip');
      if (!axiosInstance) {
        return false;
      }

      const response = await axiosInstance.get('https://httpbin.org/ip');
      return response.status === 200 && response.data;
    } catch (error) {
      logger.error(`Scraper API provider ${providerName} health check failed:`, error);
      return false;
    }
  }

  /**
   * Get provider statistics
   */
  public getProviderStats(): { [key: string]: any } {
    const stats: { [key: string]: any } = {};

    for (const [name, provider] of this.providers.entries()) {
      stats[name] = {
        healthScore: provider.healthScore,
        totalRequests: provider.totalRequests,
        successRate: provider.successfulRequests / Math.max(provider.totalRequests, 1),
        averageResponseTime: provider.averageResponseTime,
        lastUsed: provider.lastUsed,
        features: provider.config.features,
        costPerRequest: provider.config.costPerRequest
      };
    }

    return stats;
  }

  /**
   * Get available providers
   */
  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Export singleton instance with proper initialization
export const scraperApiProxyProvider = new ScraperApiProxyProvider();

// Initialize with environment variables or provided keys
export function initializeScraperApiProvider(apiKeys?: { [provider: string]: string }): void {
  scraperApiProxyProvider.initialize(apiKeys);
}
