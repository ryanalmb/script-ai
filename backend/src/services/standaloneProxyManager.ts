import { logger } from '../utils/logger';
import { scraperApiProxyProvider, ScraperApiProxyProvider, initializeScraperApiProvider } from './scraperApiProxyProvider';
import axios, { AxiosInstance } from 'axios';

/**
 * Standalone Proxy Manager (No Database Dependencies)
 * This service provides proxy functionality without requiring database connections
 * Perfect for testing and development environments
 */

export interface StandaloneProxyRequest {
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

export interface StandaloneProxyResponse {
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
 * Standalone Proxy Manager Class
 */
export class StandaloneProxyManager {
  private scraperApiProvider: ScraperApiProxyProvider;
  private useScraperApi: boolean = true;
  private initialized: boolean = false;

  constructor() {
    this.scraperApiProvider = scraperApiProxyProvider;
  }

  /**
   * Initialize the standalone proxy manager
   */
  public initialize(apiKeys: { [provider: string]: string }): void {
    try {
      logger.info('🔧 Initializing Standalone Proxy Manager...');
      
      // Initialize scraper API provider
      initializeScraperApiProvider(apiKeys);
      
      // Check if providers are available
      const availableProviders = this.scraperApiProvider.getAvailableProviders();
      if (availableProviders.length === 0) {
        logger.warn('⚠️ No scraper API providers available');
        this.useScraperApi = false;
      } else {
        logger.info(`📡 Available providers: ${availableProviders.join(', ')}`);
        this.useScraperApi = true;
      }
      
      this.initialized = true;
      logger.info('✅ Standalone Proxy Manager initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Standalone Proxy Manager:', error);
      throw error;
    }
  }

  /**
   * Check if the manager is properly initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get available proxy providers
   */
  public getAvailableProviders(): string[] {
    return this.scraperApiProvider.getAvailableProviders();
  }

  /**
   * Get the best available proxy provider
   */
  public getBestProvider(): any {
    return this.scraperApiProvider.getBestProvider();
  }

  /**
   * Create a proxy configuration
   */
  public createProxyConfiguration(): any {
    return this.scraperApiProvider.createProxyConfig();
  }

  /**
   * Make HTTP request through proxy
   */
  public async makeRequest(request: StandaloneProxyRequest): Promise<StandaloneProxyResponse> {
    const startTime = Date.now();
    
    if (!this.initialized) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        provider: 'none',
        cost: 0,
        error: 'Proxy manager not initialized'
      };
    }

    if (!this.useScraperApi) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        provider: 'none',
        cost: 0,
        error: 'No proxy providers available'
      };
    }

    try {
      // Use scraper API
      return await this.makeScraperApiRequest(request);
      
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        provider: 'scraperapi',
        cost: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Make request using scraper API
   */
  private async makeScraperApiRequest(request: StandaloneProxyRequest): Promise<StandaloneProxyResponse> {
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
        timeout: request.options?.timeout || 45000
      };

      if (request.headers) {
        requestConfig.headers = request.headers;
      }

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
   * Test proxy health
   */
  public async testProxyHealth(): Promise<{ [provider: string]: boolean }> {
    const results: { [provider: string]: boolean } = {};
    
    const availableProviders = this.scraperApiProvider.getAvailableProviders();
    
    for (const provider of availableProviders) {
      results[provider] = await this.scraperApiProvider.testProviderHealth(provider);
    }
    
    return results;
  }

  /**
   * Get provider statistics
   */
  public getProviderStats(): { [key: string]: any } {
    return this.scraperApiProvider.getProviderStats();
  }

  /**
   * Test multiple requests for IP rotation
   */
  public async testIpRotation(requestCount: number = 3): Promise<{
    totalRequests: number;
    successfulRequests: number;
    uniqueIpAddresses: number;
    ipRotationWorking: boolean;
    requests: Array<{
      requestNumber: number;
      success: boolean;
      provider: string;
      responseTime: number;
      ipAddress: string;
    }>;
  }> {
    const requests = [];
    const ipAddresses = new Set<string>();

    for (let i = 0; i < requestCount; i++) {
      const response = await this.makeRequest({
        url: 'https://httpbin.org/ip',
        method: 'GET',
        options: {
          timeout: 45000
        }
      });

      const ipAddress = response.data?.origin || response.data?.ip || 'Unknown';
      
      requests.push({
        requestNumber: i + 1,
        success: response.success,
        provider: response.provider,
        responseTime: response.responseTime,
        ipAddress: ipAddress
      });

      if (response.success && ipAddress !== 'Unknown') {
        ipAddresses.add(ipAddress);
      }
    }

    return {
      totalRequests: requests.length,
      successfulRequests: requests.filter(r => r.success).length,
      uniqueIpAddresses: ipAddresses.size,
      ipRotationWorking: ipAddresses.size > 1,
      requests: requests
    };
  }

  /**
   * Get comprehensive status
   */
  public getStatus(): {
    initialized: boolean;
    useScraperApi: boolean;
    availableProviders: string[];
    bestProvider: string | null;
    providerStats: { [key: string]: any };
  } {
    const bestProvider = this.getBestProvider();
    
    return {
      initialized: this.initialized,
      useScraperApi: this.useScraperApi,
      availableProviders: this.getAvailableProviders(),
      bestProvider: bestProvider?.name || null,
      providerStats: this.getProviderStats()
    };
  }
}

/**
 * Standalone Twitter Client (No Database Dependencies)
 */
export class StandaloneTwitterClient {
  private proxyManager: StandaloneProxyManager;

  constructor(proxyManager: StandaloneProxyManager) {
    this.proxyManager = proxyManager;
  }

  /**
   * Search tweets using proxy
   */
  async searchTweets(query: string, options: {
    count?: number;
    country?: string;
    jsRendering?: boolean;
  } = {}): Promise<StandaloneProxyResponse> {
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&count=${options.count || 20}`;
    
    return await this.proxyManager.makeRequest({
      url: searchUrl,
      method: 'GET',
      options: {
        jsRendering: options.jsRendering || true,
        country: options.country,
        timeout: 45000
      }
    });
  }

  /**
   * Get user profile using proxy
   */
  async getUserProfile(username: string, options: {
    country?: string;
    jsRendering?: boolean;
  } = {}): Promise<StandaloneProxyResponse> {
    const profileUrl = `https://twitter.com/${username}`;
    
    return await this.proxyManager.makeRequest({
      url: profileUrl,
      method: 'GET',
      options: {
        jsRendering: options.jsRendering || true,
        country: options.country,
        timeout: 45000
      }
    });
  }

  /**
   * Get tweet details using proxy
   */
  async getTweetDetails(tweetId: string, options: {
    country?: string;
    jsRendering?: boolean;
  } = {}): Promise<StandaloneProxyResponse> {
    const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;
    
    return await this.proxyManager.makeRequest({
      url: tweetUrl,
      method: 'GET',
      options: {
        jsRendering: options.jsRendering || true,
        country: options.country,
        timeout: 45000
      }
    });
  }
}

// Export singleton instances
export const standaloneProxyManager = new StandaloneProxyManager();
export const standaloneTwitterClient = new StandaloneTwitterClient(standaloneProxyManager);
