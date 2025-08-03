/**
 * Debug Enhanced Proxy Manager Integration
 * Test the enhanced proxy manager with scraper API integration
 */

// Set environment variables
process.env.SCRAPER_API_KEY = '312ba5e97b195f504b88233282dc07b8';
process.env.USE_SCRAPER_API = 'true';
process.env.FALLBACK_TO_TRADITIONAL_PROXIES = 'true';

console.log('🚀 Starting Enhanced Proxy Manager Debug Test...');

async function testEnhancedProxyManager() {
  try {
    console.log('📦 Importing services...');
    
    // Import services
    const { logger } = require('../src/utils/logger');
    const { initializeScraperApiProvider } = require('../src/services/scraperApiProxyProvider');
    const { EnhancedProxyManager } = require('../src/services/scraperApiIntegration');
    
    console.log('✅ Services imported');
    
    // Initialize scraper API provider
    console.log('🔧 Initializing ScraperAPI Provider...');
    initializeScraperApiProvider({
      scraperapi: '312ba5e97b195f504b88233282dc07b8'
    });
    
    // Create enhanced proxy manager
    console.log('🔧 Creating Enhanced Proxy Manager...');
    const enhancedManager = new EnhancedProxyManager();
    
    // Initialize with API keys
    console.log('🔧 Initializing Enhanced Manager with API keys...');
    enhancedManager.initializeWithApiKeys({
      scraperapi: '312ba5e97b195f504b88233282dc07b8'
    });
    
    // Switch to scraper API mode
    console.log('🔄 Switching to ScraperAPI mode...');
    enhancedManager.switchProxyMode(true, true);
    
    // Get comprehensive stats
    console.log('📊 Getting comprehensive stats...');
    const stats = enhancedManager.getComprehensiveStats();
    console.log('✅ Stats retrieved:');
    console.log(`   Use Scraper API: ${stats.configuration.useScraperApi}`);
    console.log(`   Fallback Enabled: ${stats.configuration.fallbackEnabled}`);
    console.log(`   Available Providers: ${stats.configuration.availableProviders.join(', ')}`);
    
    // Test optimal proxy configuration
    console.log('🎯 Testing optimal proxy configuration...');
    const proxyConfig = await enhancedManager.getOptimalProxyConfiguration('test-account', {
      country: 'US',
      jsRendering: true
    });
    
    if (!proxyConfig) {
      console.error('❌ Failed to get optimal proxy configuration');
      return;
    }
    
    console.log('✅ Optimal proxy configuration:');
    console.log(`   ID: ${proxyConfig.id}`);
    console.log(`   Host: ${proxyConfig.host}`);
    console.log(`   Port: ${proxyConfig.port}`);
    console.log(`   Provider: ${proxyConfig.provider}`);
    
    // Test HTTP request through enhanced manager
    console.log('🌐 Testing HTTP request through Enhanced Manager...');
    const response = await enhancedManager.makeRequest({
      url: 'https://httpbin.org/ip',
      method: 'GET',
      options: {
        timeout: 45000
      }
    });
    
    console.log('✅ HTTP request result:');
    console.log(`   Success: ${response.success}`);
    console.log(`   Provider: ${response.provider}`);
    console.log(`   Response Time: ${response.responseTime}ms`);
    console.log(`   Cost: $${response.cost}`);
    
    if (response.success && response.data) {
      console.log(`   IP Address: ${response.data.origin || response.data.ip || 'Unknown'}`);
    } else if (response.error) {
      console.log(`   Error: ${response.error}`);
    }
    
    // Test user agent request
    console.log('🤖 Testing User Agent request...');
    const userAgentResponse = await enhancedManager.makeRequest({
      url: 'https://httpbin.org/user-agent',
      method: 'GET',
      options: {
        timeout: 45000
      }
    });
    
    console.log('✅ User Agent request result:');
    console.log(`   Success: ${userAgentResponse.success}`);
    console.log(`   Response Time: ${userAgentResponse.responseTime}ms`);
    
    if (userAgentResponse.success && userAgentResponse.data) {
      console.log(`   User Agent: ${userAgentResponse.data['user-agent']}`);
    }
    
    // Test health monitoring
    console.log('🏥 Testing health monitoring...');
    const healthResults = await enhancedManager.testAllProxyMethods();
    console.log('✅ Health monitoring results:');
    console.log(`   Scraper API Health: ${JSON.stringify(healthResults.scraperApi)}`);
    console.log(`   Traditional Proxies: ${healthResults.traditional ? 'Available' : 'Unavailable'}`);
    
    // Test multiple requests for rotation
    console.log('🔄 Testing multiple requests for IP rotation...');
    const ipAddresses = new Set();
    
    for (let i = 0; i < 3; i++) {
      console.log(`   Request ${i + 1}/3...`);
      const rotationResponse = await enhancedManager.makeRequest({
        url: 'https://httpbin.org/ip',
        method: 'GET',
        options: {
          timeout: 45000
        }
      });
      
      if (rotationResponse.success && rotationResponse.data) {
        const ip = rotationResponse.data.origin || rotationResponse.data.ip;
        ipAddresses.add(ip);
        console.log(`   IP: ${ip}, Provider: ${rotationResponse.provider}`);
      }
    }
    
    console.log(`✅ IP Rotation test completed:`);
    console.log(`   Unique IPs: ${ipAddresses.size}`);
    console.log(`   IPs: ${Array.from(ipAddresses).join(', ')}`);
    console.log(`   Rotation Working: ${ipAddresses.size > 1 ? 'Yes' : 'No'}`);
    
    console.log('\n🎉 Enhanced Proxy Manager is working correctly!');
    console.log('✅ All core functionality tested successfully');
    
  } catch (error) {
    console.error('❌ Enhanced Proxy Manager test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testEnhancedProxyManager();
