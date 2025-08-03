/**
 * Debug Proxy Service Integration
 * Simple test to debug proxy service issues
 */

// Set environment variables
process.env.SCRAPER_API_KEY = '312ba5e97b195f504b88233282dc07b8';
process.env.USE_SCRAPER_API = 'true';

console.log('🚀 Starting Proxy Service Debug Test...');
console.log(`🔑 API Key: ${process.env.SCRAPER_API_KEY ? 'Set' : 'Not Set'}`);

try {
  console.log('📦 Importing services...');
  
  // Import logger first
  const { logger } = require('../src/utils/logger');
  console.log('✅ Logger imported');
  
  // Import scraper API provider
  const { scraperApiProxyProvider, initializeScraperApiProvider } = require('../src/services/scraperApiProxyProvider');
  console.log('✅ ScraperAPI Provider imported');
  
  // Initialize provider
  console.log('🔧 Initializing ScraperAPI Provider...');
  initializeScraperApiProvider({
    scraperapi: '312ba5e97b195f504b88233282dc07b8'
  });
  
  // Check providers
  const availableProviders = scraperApiProxyProvider.getAvailableProviders();
  console.log(`📡 Available providers: ${availableProviders.join(', ')}`);
  
  if (availableProviders.length === 0) {
    console.error('❌ No providers available after initialization');
    process.exit(1);
  }
  
  // Get best provider
  const bestProvider = scraperApiProxyProvider.getBestProvider();
  if (!bestProvider) {
    console.error('❌ No best provider found');
    process.exit(1);
  }
  
  console.log(`🎯 Best provider: ${bestProvider.name}`);
  console.log(`   Base URL: ${bestProvider.config.baseUrl}`);
  console.log(`   Proxy Endpoint: ${bestProvider.config.proxyEndpoint}`);
  
  // Create proxy config
  const proxyConfig = scraperApiProxyProvider.createProxyConfig();
  if (!proxyConfig) {
    console.error('❌ Failed to create proxy configuration');
    process.exit(1);
  }
  
  console.log('✅ Proxy configuration created:');
  console.log(`   Host: ${proxyConfig.host}`);
  console.log(`   Port: ${proxyConfig.port}`);
  console.log(`   Type: ${proxyConfig.type}`);
  
  // Test axios instance creation
  console.log('🌐 Testing axios instance creation...');
  const axiosInstance = scraperApiProxyProvider.createAxiosInstance('https://httpbin.org/ip');
  
  if (!axiosInstance) {
    console.error('❌ Failed to create axios instance');
    process.exit(1);
  }
  
  console.log('✅ Axios instance created successfully');
  
  // Test HTTP request
  console.log('📡 Making test HTTP request...');
  axiosInstance.get('https://httpbin.org/ip', { timeout: 45000 })
    .then(response => {
      console.log('✅ HTTP request successful:');
      console.log(`   Status: ${response.status}`);
      console.log(`   IP: ${response.data.origin || response.data.ip || 'Unknown'}`);
      console.log('🎉 Basic proxy service is working!');
    })
    .catch(error => {
      console.error('❌ HTTP request failed:', error.message);
      process.exit(1);
    });
  
} catch (error) {
  console.error('❌ Debug test failed:', error);
  process.exit(1);
}
