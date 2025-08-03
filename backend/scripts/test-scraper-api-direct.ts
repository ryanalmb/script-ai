/**
 * Direct Scraper API Test Script
 * Tests the scraper API integration directly with manual configuration
 */

import axios from 'axios';

// Your provided API key
const SCRAPER_API_KEY = '312ba5e97b195f504b88233282dc07b8';

interface TestResult {
  success: boolean;
  responseTime: number;
  data?: any;
  error?: string;
  status?: number;
}

/**
 * Test ScraperAPI directly using HTTP proxy method
 */
async function testScraperApiHttpProxy(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Testing ScraperAPI HTTP Proxy method...');
    
    // Create axios instance with ScraperAPI proxy
    const axiosInstance = axios.create({
      proxy: {
        host: 'proxy-server.scraperapi.com',
        port: 8001,
        auth: {
          username: 'scraperapi',
          password: SCRAPER_API_KEY
        },
        protocol: 'http'
      },
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const response = await axiosInstance.get('https://httpbin.org/ip');
    
    return {
      success: true,
      responseTime: Date.now() - startTime,
      data: response.data,
      status: response.status
    };
    
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test ScraperAPI using direct API method
 */
async function testScraperApiDirectApi(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Testing ScraperAPI Direct API method...');
    
    const response = await axios.get('http://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_API_KEY,
        url: 'https://httpbin.org/ip'
      },
      timeout: 30000
    });
    
    return {
      success: true,
      responseTime: Date.now() - startTime,
      data: response.data,
      status: response.status
    };
    
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test ScraperAPI account info
 */
async function testScraperApiAccount(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Testing ScraperAPI Account Info...');
    
    const response = await axios.get('http://api.scraperapi.com/account', {
      params: {
        api_key: SCRAPER_API_KEY
      },
      timeout: 15000
    });
    
    return {
      success: true,
      responseTime: Date.now() - startTime,
      data: response.data,
      status: response.status
    };
    
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test multiple websites through ScraperAPI
 */
async function testMultipleWebsites(): Promise<void> {
  console.log('🌍 Testing Multiple Websites...');
  
  const testUrls = [
    'https://httpbin.org/ip',
    'https://httpbin.org/user-agent',
    'https://httpbin.org/headers',
    'https://jsonplaceholder.typicode.com/posts/1'
  ];
  
  for (const url of testUrls) {
    try {
      console.log(`\n📡 Testing: ${url}`);
      
      const response = await axios.get('http://api.scraperapi.com/', {
        params: {
          api_key: SCRAPER_API_KEY,
          url: url
        },
        timeout: 30000
      });
      
      console.log(`✅ Success: ${response.status} (${JSON.stringify(response.data).length} chars)`);
      
      // Show preview of response
      if (typeof response.data === 'object') {
        console.log(`   Data: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
      } else if (typeof response.data === 'string') {
        console.log(`   Preview: ${response.data.substring(0, 200).replace(/\n/g, ' ')}...`);
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

/**
 * Test with different ScraperAPI parameters
 */
async function testScraperApiParameters(): Promise<void> {
  console.log('\n⚙️ Testing ScraperAPI Parameters...');
  
  const testConfigs = [
    {
      name: 'Basic Request',
      params: {
        api_key: SCRAPER_API_KEY,
        url: 'https://httpbin.org/ip'
      }
    },
    {
      name: 'With Country Targeting',
      params: {
        api_key: SCRAPER_API_KEY,
        url: 'https://httpbin.org/ip',
        country_code: 'US'
      }
    },
    {
      name: 'With Session',
      params: {
        api_key: SCRAPER_API_KEY,
        url: 'https://httpbin.org/ip',
        session_number: 123
      }
    },
    {
      name: 'With Premium Proxy',
      params: {
        api_key: SCRAPER_API_KEY,
        url: 'https://httpbin.org/ip',
        premium: true
      }
    }
  ];
  
  for (const config of testConfigs) {
    try {
      console.log(`\n🧪 Testing: ${config.name}`);
      
      const startTime = Date.now();
      const response = await axios.get('http://api.scraperapi.com/', {
        params: config.params,
        timeout: 30000
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`✅ Success: ${response.status} (${responseTime}ms)`);
      
      if (response.data && typeof response.data === 'object' && response.data.origin) {
        console.log(`   IP: ${response.data.origin}`);
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Direct ScraperAPI Tests...');
  console.log(`🔑 API Key: ${SCRAPER_API_KEY.substring(0, 8)}...${SCRAPER_API_KEY.substring(-4)}`);
  console.log('=' .repeat(80));
  
  try {
    // Test 1: Account Info
    console.log('\n📊 Test 1: Account Information');
    const accountResult = await testScraperApiAccount();
    console.log(`Result: ${accountResult.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`Response Time: ${accountResult.responseTime}ms`);
    if (accountResult.success && accountResult.data) {
      console.log(`Account Data: ${JSON.stringify(accountResult.data, null, 2)}`);
    } else if (accountResult.error) {
      console.log(`Error: ${accountResult.error}`);
    }
    
    // Test 2: Direct API Method
    console.log('\n📡 Test 2: Direct API Method');
    const directResult = await testScraperApiDirectApi();
    console.log(`Result: ${directResult.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`Response Time: ${directResult.responseTime}ms`);
    if (directResult.success && directResult.data) {
      console.log(`IP Address: ${directResult.data.origin || directResult.data.ip || 'Unknown'}`);
    } else if (directResult.error) {
      console.log(`Error: ${directResult.error}`);
    }
    
    // Test 3: HTTP Proxy Method
    console.log('\n🔗 Test 3: HTTP Proxy Method');
    const proxyResult = await testScraperApiHttpProxy();
    console.log(`Result: ${proxyResult.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`Response Time: ${proxyResult.responseTime}ms`);
    if (proxyResult.success && proxyResult.data) {
      console.log(`IP Address: ${proxyResult.data.origin || proxyResult.data.ip || 'Unknown'}`);
    } else if (proxyResult.error) {
      console.log(`Error: ${proxyResult.error}`);
    }
    
    // Test 4: Multiple Websites
    await testMultipleWebsites();
    
    // Test 5: Different Parameters
    await testScraperApiParameters();
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed!');
    console.log('\n💡 Summary:');
    console.log(`• Account Test: ${accountResult.success ? '✅' : '❌'}`);
    console.log(`• Direct API Test: ${directResult.success ? '✅' : '❌'}`);
    console.log(`• HTTP Proxy Test: ${proxyResult.success ? '✅' : '❌'}`);
    
    if (directResult.success || proxyResult.success) {
      console.log('\n🎉 ScraperAPI is working correctly!');
      console.log('Your API key is valid and the service is accessible.');
    } else {
      console.log('\n⚠️ ScraperAPI tests failed.');
      console.log('Please check your API key and network connection.');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  main();
}
