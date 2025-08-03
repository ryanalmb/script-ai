import { logger } from '../utils/logger';
import { scraperApiProxyProvider, ScraperApiProxyProvider, initializeScraperApiProvider } from './scraperApiProxyProvider';
import { EnterpriseProxyManager, ProxyConfiguration } from './antiDetection/proxyManager';
import { ProxyRotationManager } from './proxyRotationManager';
import axios, { AxiosInstance } from 'axios';

/**
 * Scraper API Integration Service
 * Integrates scraper APIs with the existing proxy management system
 * Provides seamless switching between traditional proxies and scraper APIs
 */

export interface ScraperApiRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: { [key: string]: string };
  data?: any;
  options?: {
    jsRendering?: boolean;
    country?: string;
    sessionId?: string;
    timeout?: number;
  };
}

export interface ScraperApiResponse {
  success: boolean;
  data?: any;
  status?: number;
  headers?: { [key: string]: string };
  responseTime: number;
  provider: string;
  cost: number;
  error?: string;
}

/**
 * Enhanced Proxy Manager with Scraper API Integration
 */
export class EnhancedProxyManager extends EnterpriseProxyManager {
  private scraperApiProvider: ScraperApiProxyProvider;
  private useScraperApi: boolean = false;
  private fallbackToTraditionalProxies: boolean = true;

  constructor() {
    super();
    this.scraperApiProvider = scraperApiProxyProvider;
    this.initializeScraperApiIntegration();
  }

  /**
   * Initialize with API keys
   */
  public initializeWithApiKeys(apiKeys: { [provider: string]: string }): void {
    initializeScraperApiProvider(apiKeys);
    this.initializeScraperApiIntegration();
  }

  /**
   * Initialize scraper API integration
   */
  private initializeScraperApiIntegration(): void {
    try {
      logger.info('🔧 Initializing Scraper API Integration...');

      // Check if scraper APIs should be used
      this.useScraperApi = process.env.USE_SCRAPER_API === 'true';
      this.fallbackToTraditionalProxies = process.env.FALLBACK_TO_TRADITIONAL_PROXIES !== 'false';

      // Log available scraper API providers
      const availableProviders = this.scraperApiProvider.getAvailableProviders();
      if (availableProviders.length > 0) {
        logger.info(`📡 Available Scraper API providers: ${availableProviders.join(', ')}`);
      } else {
        logger.warn('⚠️ No Scraper API providers configured');
      }

      logger.info(`✅ Scraper API Integration initialized`);
      logger.info(`   Use Scraper API: ${this.useScraperApi}`);
      logger.info(`   Fallback to Traditional: ${this.fallbackToTraditionalProxies}`);

    } catch (error) {
      logger.error('❌ Failed to initialize Scraper API integration:', error);
    }
  }

  /**
   * Get optimal proxy configuration (traditional or scraper API)
   */
  async getOptimalProxyConfiguration(
    accountId: string,
    requirements: {
      country?: string;
      region?: string;
      city?: string;
      type?: string;
      minSuccessRate?: number;
      maxResponseTime?: number;
      stickySession?: boolean;
      jsRendering?: boolean;
    } = {}
  ): Promise<ProxyConfiguration | null> {
    try {
      // If scraper API is preferred and available
      if (this.useScraperApi) {
        const scraperApiConfig = this.scraperApiProvider.createProxyConfig();
        if (scraperApiConfig) {
          logger.info(`🌐 Using Scraper API proxy for account ${accountId}`);
          return scraperApiConfig;
        } else if (!this.fallbackToTraditionalProxies) {
          logger.error('Scraper API not available and fallback disabled');
          return null;
        }
      }

      // Fallback to traditional proxy management
      if (this.fallbackToTraditionalProxies) {
        logger.info(`🔄 Using traditional proxy for account ${accountId}`);
        return await this.getOptimalProxy(accountId, requirements);
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get optimal proxy configuration for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Make HTTP request using scraper API or traditional proxy
   */
  async makeRequest(request: ScraperApiRequest): Promise<ScraperApiResponse> {
    const startTime = Date.now();
    let response: ScraperApiResponse = {
      success: false,
      responseTime: 0,
      provider: 'unknown',
      cost: 0
    };

    try {
      // Try scraper API first if enabled
      if (this.useScraperApi) {
        const scraperApiResponse = await this.makeScraperApiRequest(request);
        if (scraperApiResponse.success) {
          return scraperApiResponse;
        } else if (!this.fallbackToTraditionalProxies) {
          return scraperApiResponse;
        }
      }

      // Fallback to traditional proxy
      if (this.fallbackToTraditionalProxies) {
        return await this.makeTraditionalProxyRequest(request);
      }

      response.error = 'No proxy method available';
      return response;

    } catch (error) {
      response.error = error instanceof Error ? error.message : 'Unknown error';
      response.responseTime = Date.now() - startTime;
      return response;
    }
  }

  /**
   * Make request using scraper API
   */
  private async makeScraperApiRequest(request: ScraperApiRequest): Promise<ScraperApiResponse> {
    const startTime = Date.now();
    
    try {
      const axiosInstance = this.scraperApiProvider.createAxiosInstance(request.url, request.options);
      
      if (!axiosInstance) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          provider: 'scraperapi',
          cost: 0,
          error: 'Failed to create scraper API instance'
        };
      }

      const requestConfig: any = {
        method: request.method || 'GET',
        url: request.url,
        data: request.data,
        timeout: request.options?.timeout || 30000
      };

      if (request.headers) {
        requestConfig.headers = request.headers;
      }

      // Set a more reasonable timeout for the request
      requestConfig.timeout = request.options?.timeout || 45000;

      const axiosResponse = await axiosInstance.request(requestConfig);

      const provider = this.scraperApiProvider.getBestProvider();
      const cost = provider ? provider.config.costPerRequest : 0;

      return {
        success: true,
        data: axiosResponse.data,
        status: axiosResponse.status,
        headers: axiosResponse.headers as any,
        responseTime: Date.now() - startTime,
        provider: provider?.name || 'scraperapi',
        cost: cost
      };

    } catch (error) {
      logger.error('Scraper API request failed:', error);
      
      return {
        success: false,
        responseTime: Date.now() - startTime,
        provider: 'scraperapi',
        cost: 0,
        error: error instanceof Error ? error.message : 'Scraper API request failed'
      };
    }
  }

  /**
   * Make request using traditional proxy
   */
  private async makeTraditionalProxyRequest(request: ScraperApiRequest): Promise<ScraperApiResponse> {
    const startTime = Date.now();
    
    try {
      // Get optimal proxy configuration
      const requirements: any = {};
      if (request.options?.country) {
        requirements.country = request.options.country;
      }
      const proxyConfig = await this.getOptimalProxy('default', requirements);

      if (!proxyConfig) {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          provider: 'traditional',
          cost: 0,
          error: 'No traditional proxy available'
        };
      }

      // Create axios instance with traditional proxy
      const proxySettings: any = {
        host: proxyConfig.host,
        port: proxyConfig.port,
        protocol: proxyConfig.protocol
      };

      if (proxyConfig.username && proxyConfig.password) {
        proxySettings.auth = {
          username: proxyConfig.username,
          password: proxyConfig.password
        };
      }

      const axiosInstance = axios.create({
        proxy: proxySettings,
        timeout: request.options?.timeout || 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...request.headers
        }
      });

      const axiosResponse = await axiosInstance.request({
        method: request.method || 'GET',
        url: request.url,
        data: request.data
      });

      return {
        success: true,
        data: axiosResponse.data,
        status: axiosResponse.status,
        headers: axiosResponse.headers as any,
        responseTime: Date.now() - startTime,
        provider: `traditional_${proxyConfig.provider}`,
        cost: 0 // Traditional proxies typically have flat rate pricing
      };

    } catch (error) {
      logger.error('Traditional proxy request failed:', error);
      
      return {
        success: false,
        responseTime: Date.now() - startTime,
        provider: 'traditional',
        cost: 0,
        error: error instanceof Error ? error.message : 'Traditional proxy request failed'
      };
    }
  }

  /**
   * Test both scraper API and traditional proxy health
   */
  async testAllProxyMethods(): Promise<{
    scraperApi: { [provider: string]: boolean };
    traditional: boolean;
  }> {
    const results = {
      scraperApi: {} as { [provider: string]: boolean },
      traditional: false
    };

    // Test scraper API providers
    const scraperApiProviders = this.scraperApiProvider.getAvailableProviders();
    for (const provider of scraperApiProviders) {
      results.scraperApi[provider] = await this.scraperApiProvider.testProviderHealth(provider);
    }

    // Test traditional proxies
    try {
      const proxyConfig = await this.getOptimalProxy('test');
      results.traditional = proxyConfig !== null;
    } catch (error) {
      results.traditional = false;
    }

    return results;
  }

  /**
   * Get comprehensive proxy statistics
   */
  getComprehensiveStats(): {
    scraperApi: { [key: string]: any };
    traditional: { [key: string]: any };
    configuration: {
      useScraperApi: boolean;
      fallbackEnabled: boolean;
      availableProviders: string[];
    };
  } {
    return {
      scraperApi: this.scraperApiProvider.getProviderStats(),
      traditional: {}, // Would need to implement in base class
      configuration: {
        useScraperApi: this.useScraperApi,
        fallbackEnabled: this.fallbackToTraditionalProxies,
        availableProviders: this.scraperApiProvider.getAvailableProviders()
      }
    };
  }

  /**
   * Switch between scraper API and traditional proxy modes
   */
  switchProxyMode(useScraperApi: boolean, fallbackEnabled: boolean = true): void {
    this.useScraperApi = useScraperApi;
    this.fallbackToTraditionalProxies = fallbackEnabled;
    
    logger.info(`🔄 Switched proxy mode:`);
    logger.info(`   Use Scraper API: ${this.useScraperApi}`);
    logger.info(`   Fallback Enabled: ${this.fallbackToTraditionalProxies}`);
  }
}

/**
 * Scraper API specific client for X/Twitter operations
 */
export class ScraperApiTwitterClient {
  private enhancedProxyManager: EnhancedProxyManager;

  constructor() {
    this.enhancedProxyManager = new EnhancedProxyManager();
  }

  /**
   * Search tweets using scraper API
   */
  async searchTweets(query: string, options: {
    count?: number;
    country?: string;
    jsRendering?: boolean;
  } = {}): Promise<ScraperApiResponse> {
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&count=${options.count || 20}`;

    const requestOptions: any = {
      jsRendering: options.jsRendering || true,
      timeout: 45000
    };

    if (options.country) {
      requestOptions.country = options.country;
    }

    return await this.enhancedProxyManager.makeRequest({
      url: searchUrl,
      method: 'GET',
      options: requestOptions
    });
  }

  /**
   * Get user profile using scraper API
   */
  async getUserProfile(username: string, options: {
    country?: string;
    jsRendering?: boolean;
  } = {}): Promise<ScraperApiResponse> {
    const profileUrl = `https://twitter.com/${username}`;

    const requestOptions: any = {
      jsRendering: options.jsRendering || true,
      timeout: 45000
    };

    if (options.country) {
      requestOptions.country = options.country;
    }

    return await this.enhancedProxyManager.makeRequest({
      url: profileUrl,
      method: 'GET',
      options: requestOptions
    });
  }

  /**
   * Get tweet details using scraper API
   */
  async getTweetDetails(tweetId: string, options: {
    country?: string;
    jsRendering?: boolean;
  } = {}): Promise<ScraperApiResponse> {
    const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;

    const requestOptions: any = {
      jsRendering: options.jsRendering || true,
      timeout: 45000
    };

    if (options.country) {
      requestOptions.country = options.country;
    }

    return await this.enhancedProxyManager.makeRequest({
      url: tweetUrl,
      method: 'GET',
      options: requestOptions
    });
  }
}

// Export singleton instances
export const enhancedProxyManager = new EnhancedProxyManager();
export const scraperApiTwitterClient = new ScraperApiTwitterClient();
