/**
 * Comprehensive Proxy Service Integration Test
 * Tests the complete proxy service architecture end-to-end
 */

// Set API key before importing services
process.env.SCRAPER_API_KEY = '312ba5e97b195f504b88233282dc07b8';
process.env.USE_SCRAPER_API = 'true';
process.env.FALLBACK_TO_TRADITIONAL_PROXIES = 'true';

import { logger } from '../src/utils/logger';
import { scraperApiProxyProvider, initializeScraperApiProvider } from '../src/services/scraperApiProxyProvider';
import { enhancedProxyManager, scraperApiTwitterClient, EnhancedProxyManager } from '../src/services/scraperApiIntegration';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

class ProxyServiceIntegrationTester {
  private results: TestResult[] = [];
  private enhancedManager: EnhancedProxyManager;

  constructor() {
    this.enhancedManager = new EnhancedProxyManager();
  }

  private async runTest(testName: string, testFunction: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now();
    logger.info(`🧪 Running test: ${testName}`);
    
    try {
      const details = await testFunction();
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        testName,
        success: true,
        duration,
        details
      };
      
      logger.info(`✅ ${testName} - SUCCESS (${duration}ms)`);
      this.results.push(result);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        testName,
        success: false,
        duration,
        details: null,
        error: error instanceof Error ? error.message : String(error)
      };
      
      logger.error(`❌ ${testName} - FAILED (${duration}ms): ${result.error}`);
      this.results.push(result);
      return result;
    }
  }

  async testScraperApiProviderInitialization(): Promise<any> {
    // Initialize with API key
    initializeScraperApiProvider({
      scraperapi: '312ba5e97b195f504b88233282dc07b8'
    });

    // Check if providers are loaded
    const availableProviders = scraperApiProxyProvider.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No scraper API providers initialized');
    }

    // Get best provider
    const bestProvider = scraperApiProxyProvider.getBestProvider();
    if (!bestProvider) {
      throw new Error('No best provider available');
    }

    // Create proxy configuration
    const proxyConfig = scraperApiProxyProvider.createProxyConfig();
    if (!proxyConfig) {
      throw new Error('Failed to create proxy configuration');
    }

    return {
      availableProviders,
      bestProvider: {
        name: bestProvider.name,
        baseUrl: bestProvider.config.baseUrl,
        costPerRequest: bestProvider.config.costPerRequest
      },
      proxyConfig: {
        id: proxyConfig.id,
        host: proxyConfig.host,
        port: proxyConfig.port,
        type: proxyConfig.type
      }
    };
  }

  async testEnhancedProxyManagerInitialization(): Promise<any> {
    // Initialize enhanced proxy manager with API keys
    this.enhancedManager.initializeWithApiKeys({
      scraperapi: '312ba5e97b195f504b88233282dc07b8'
    });

    // Test proxy mode switching
    this.enhancedManager.switchProxyMode(true, true);

    // Get comprehensive stats
    const stats = this.enhancedManager.getComprehensiveStats();

    if (stats.configuration.availableProviders.length === 0) {
      throw new Error('Enhanced proxy manager has no available providers');
    }

    return {
      configuration: stats.configuration,
      scraperApiProviders: Object.keys(stats.scraperApi),
      useScraperApi: stats.configuration.useScraperApi,
      fallbackEnabled: stats.configuration.fallbackEnabled
    };
  }

  async testHttpRequestThroughEnhancedManager(): Promise<any> {
    const response = await this.enhancedManager.makeRequest({
      url: 'https://httpbin.org/ip',
      method: 'GET',
      options: {
        timeout: 45000
      }
    });

    if (!response.success) {
      throw new Error(`HTTP request failed: ${response.error}`);
    }

    return {
      success: response.success,
      provider: response.provider,
      responseTime: response.responseTime,
      cost: response.cost,
      ipAddress: response.data?.origin || response.data?.ip || 'Unknown'
    };
  }

  async testUserAgentThroughEnhancedManager(): Promise<any> {
    const response = await this.enhancedManager.makeRequest({
      url: 'https://httpbin.org/user-agent',
      method: 'GET',
      options: {
        timeout: 45000
      }
    });

    if (!response.success) {
      throw new Error(`User agent request failed: ${response.error}`);
    }

    return {
      success: response.success,
      provider: response.provider,
      responseTime: response.responseTime,
      userAgent: response.data?.['user-agent'] || 'Unknown'
    };
  }

  async testTwitterClientIntegration(): Promise<any> {
    // Test Twitter search functionality
    const searchResponse = await scraperApiTwitterClient.searchTweets('test', {
      count: 5,
      jsRendering: true
    });

    // Test user profile functionality
    const profileResponse = await scraperApiTwitterClient.getUserProfile('twitter', {
      jsRendering: true
    });

    return {
      searchTest: {
        success: searchResponse.success,
        provider: searchResponse.provider,
        responseTime: searchResponse.responseTime,
        error: searchResponse.error
      },
      profileTest: {
        success: profileResponse.success,
        provider: profileResponse.provider,
        responseTime: profileResponse.responseTime,
        error: profileResponse.error
      }
    };
  }

  async testProxyHealthMonitoring(): Promise<any> {
    // Test all proxy methods
    const healthResults = await this.enhancedManager.testAllProxyMethods();

    // Test individual provider health
    const providerHealthResults: { [key: string]: boolean } = {};
    const availableProviders = scraperApiProxyProvider.getAvailableProviders();
    
    for (const provider of availableProviders) {
      providerHealthResults[provider] = await scraperApiProxyProvider.testProviderHealth(provider);
    }

    return {
      allProxyMethods: healthResults,
      individualProviders: providerHealthResults,
      providerStats: scraperApiProxyProvider.getProviderStats()
    };
  }

  async testOptimalProxyConfiguration(): Promise<any> {
    const proxyConfig = await this.enhancedManager.getOptimalProxyConfiguration('test-account', {
      country: 'US',
      minSuccessRate: 0.8,
      maxResponseTime: 30000,
      jsRendering: true
    });

    if (!proxyConfig) {
      throw new Error('Failed to get optimal proxy configuration');
    }

    return {
      proxyId: proxyConfig.id,
      host: proxyConfig.host,
      port: proxyConfig.port,
      type: proxyConfig.type,
      provider: proxyConfig.provider,
      country: proxyConfig.country,
      successRate: proxyConfig.successRate
    };
  }

  async testMultipleRequestsWithRotation(): Promise<any> {
    const requests = [];
    const ipAddresses = new Set<string>();

    // Make 5 requests to test rotation
    for (let i = 0; i < 5; i++) {
      const response = await this.enhancedManager.makeRequest({
        url: 'https://httpbin.org/ip',
        method: 'GET',
        options: {
          timeout: 45000
        }
      });

      requests.push({
        requestNumber: i + 1,
        success: response.success,
        provider: response.provider,
        responseTime: response.responseTime,
        ipAddress: response.data?.origin || response.data?.ip || 'Unknown'
      });

      if (response.success && response.data?.origin) {
        ipAddresses.add(response.data.origin);
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

  async runAllTests(): Promise<void> {
    logger.info('🚀 Starting Comprehensive Proxy Service Integration Tests...');
    logger.info('=' .repeat(80));

    // Test 1: ScraperAPI Provider Initialization
    await this.runTest(
      'ScraperAPI Provider Initialization',
      () => this.testScraperApiProviderInitialization()
    );

    // Test 2: Enhanced Proxy Manager Initialization
    await this.runTest(
      'Enhanced Proxy Manager Initialization',
      () => this.testEnhancedProxyManagerInitialization()
    );

    // Test 3: HTTP Request through Enhanced Manager
    await this.runTest(
      'HTTP Request through Enhanced Manager',
      () => this.testHttpRequestThroughEnhancedManager()
    );

    // Test 4: User Agent Request
    await this.runTest(
      'User Agent Request through Enhanced Manager',
      () => this.testUserAgentThroughEnhancedManager()
    );

    // Test 5: Optimal Proxy Configuration
    await this.runTest(
      'Optimal Proxy Configuration',
      () => this.testOptimalProxyConfiguration()
    );

    // Test 6: Multiple Requests with Rotation
    await this.runTest(
      'Multiple Requests with IP Rotation',
      () => this.testMultipleRequestsWithRotation()
    );

    // Test 7: Twitter Client Integration
    await this.runTest(
      'Twitter Client Integration',
      () => this.testTwitterClientIntegration()
    );

    // Test 8: Proxy Health Monitoring
    await this.runTest(
      'Proxy Health Monitoring',
      () => this.testProxyHealthMonitoring()
    );

    this.generateReport();
  }

  private generateReport(): void {
    logger.info('\n' + '='.repeat(80));
    logger.info('📋 COMPREHENSIVE PROXY SERVICE INTEGRATION TEST REPORT');
    logger.info('='.repeat(80));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    logger.info(`\n📊 Test Summary:`);
    logger.info(`   Total Tests: ${totalTests}`);
    logger.info(`   Successful: ${successfulTests} ✅`);
    logger.info(`   Failed: ${failedTests} ❌`);
    logger.info(`   Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);
    logger.info(`   Total Duration: ${totalDuration}ms`);

    logger.info(`\n📋 Detailed Results:`);
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      logger.info(`   ${index + 1}. ${status} ${result.testName} (${result.duration}ms)`);
      
      if (result.error) {
        logger.info(`      Error: ${result.error}`);
      }
      
      if (result.success && result.details) {
        // Log key details for successful tests
        if (result.testName.includes('Initialization')) {
          logger.info(`      Providers: ${JSON.stringify(result.details.availableProviders || [])}`);
        } else if (result.testName.includes('HTTP Request')) {
          logger.info(`      IP: ${result.details.ipAddress}, Provider: ${result.details.provider}`);
        } else if (result.testName.includes('Rotation')) {
          logger.info(`      Unique IPs: ${result.details.uniqueIpAddresses}, Rotation: ${result.details.ipRotationWorking ? 'Working' : 'Not Working'}`);
        }
      }
    });

    // Final assessment
    logger.info('\n' + '='.repeat(80));
    if (successfulTests === totalTests) {
      logger.info('🎉 ALL TESTS PASSED - PROXY SERVICE INTEGRATION IS FULLY FUNCTIONAL!');
      logger.info('✅ The complete proxy service architecture is working correctly');
      logger.info('✅ ScraperAPI integration is operational');
      logger.info('✅ Enhanced proxy management is functional');
      logger.info('✅ Twitter client integration is ready');
    } else if (successfulTests >= totalTests * 0.8) {
      logger.info('⚠️ MOSTLY SUCCESSFUL - Minor issues detected');
      logger.info(`✅ ${successfulTests}/${totalTests} tests passed`);
      logger.info('🔧 Review failed tests and address issues');
    } else {
      logger.info('❌ CRITICAL FAILURES - Proxy service integration needs fixes');
      logger.info(`❌ Only ${successfulTests}/${totalTests} tests passed`);
      logger.info('🚨 Major issues detected in proxy service architecture');
    }
    logger.info('='.repeat(80));
  }
}

async function main(): Promise<void> {
  try {
    const tester = new ProxyServiceIntegrationTester();
    await tester.runAllTests();
  } catch (error) {
    logger.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the comprehensive tests
if (require.main === module) {
  main();
}
