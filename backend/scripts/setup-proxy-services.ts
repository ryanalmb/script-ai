import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';
import { config } from '../src/config/environment';
import { EnterpriseProxyManager } from '../src/services/antiDetection/proxyManager';
import { ProxyRotationManager } from '../src/services/proxyRotationManager';
import { seedProxyConfigurations } from './seed-proxy-configurations';
import axios from 'axios';

const prisma = new PrismaClient();

/**
 * Comprehensive Proxy Services Setup and Validation Script
 * This script sets up, configures, and validates all proxy services
 */

interface ProxyTestResult {
  proxyId: string;
  host: string;
  port: number;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  ipAddress?: string;
}

interface SetupResult {
  success: boolean;
  proxyPoolsCreated: number;
  proxiesConfigured: number;
  healthyProxies: number;
  unhealthyProxies: number;
  testResults: ProxyTestResult[];
  errors: string[];
}

/**
 * Test proxy connectivity and health
 */
async function testProxyHealth(proxy: any): Promise<ProxyTestResult> {
  const startTime = Date.now();
  const result: ProxyTestResult = {
    proxyId: proxy.id,
    host: proxy.host,
    port: proxy.port,
    isHealthy: false,
    responseTime: 0
  };

  try {
    // Create axios instance with proxy configuration
    const proxyConfig: any = {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol || 'http'
    };

    if (proxy.username && proxy.password) {
      proxyConfig.auth = {
        username: proxy.username,
        password: proxy.password
      };
    }

    const axiosInstance = axios.create({
      proxy: proxyConfig,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Test with multiple endpoints
    const testUrls = [
      'https://httpbin.org/ip',
      'https://api.ipify.org?format=json'
    ];

    let testPassed = false;
    for (const url of testUrls) {
      try {
        const response = await axiosInstance.get(url);
        if (response.status === 200 && response.data) {
          result.isHealthy = true;
          result.ipAddress = response.data.ip || response.data.origin;
          testPassed = true;
          break;
        }
      } catch (urlError) {
        logger.debug(`Proxy ${proxy.id} failed test with ${url}:`, urlError);
      }
    }

    result.responseTime = Date.now() - startTime;
    
    if (!testPassed) {
      result.error = 'All test URLs failed';
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.responseTime = Date.now() - startTime;
  }

  return result;
}

/**
 * Validate proxy configuration environment variables
 */
function validateProxyConfiguration(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if proxy rotation is enabled
  if (!config.twikit.proxy.enableRotation) {
    errors.push('Proxy rotation is disabled. Set TWIKIT_ENABLE_PROXY_ROTATION=true');
  }
  
  // Check if at least one proxy pool is enabled
  const enabledPools = [
    config.twikit.proxy.pools.residential.enabled,
    config.twikit.proxy.pools.datacenter.enabled,
    config.twikit.proxy.pools.mobile.enabled
  ];
  
  if (!enabledPools.some(enabled => enabled)) {
    errors.push('No proxy pools are enabled. Enable at least one proxy pool.');
  }
  
  // Check proxy pool configurations
  Object.entries(config.twikit.proxy.pools).forEach(([poolName, poolConfig]) => {
    if (poolConfig.enabled) {
      if (poolConfig.urls.length === 0) {
        errors.push(`${poolName} proxy pool is enabled but has no URLs configured`);
      }
      
      // Validate URL format
      poolConfig.urls.forEach((url, index) => {
        try {
          new URL(url);
        } catch {
          errors.push(`Invalid URL in ${poolName} pool at index ${index}: ${url}`);
        }
      });
    }
  });
  
  // Check health check configuration
  if (config.twikit.proxy.healthCheckUrls.length === 0) {
    errors.push('No health check URLs configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Setup and test all proxy services
 */
async function setupProxyServices(): Promise<SetupResult> {
  const result: SetupResult = {
    success: false,
    proxyPoolsCreated: 0,
    proxiesConfigured: 0,
    healthyProxies: 0,
    unhealthyProxies: 0,
    testResults: [],
    errors: []
  };

  try {
    logger.info('🚀 Starting comprehensive proxy services setup...');
    
    // Step 1: Validate configuration
    logger.info('📋 Step 1: Validating proxy configuration...');
    const configValidation = validateProxyConfiguration();
    
    if (!configValidation.isValid) {
      result.errors.push(...configValidation.errors);
      logger.error('❌ Configuration validation failed:', configValidation.errors);
      return result;
    }
    
    logger.info('✅ Configuration validation passed');
    
    // Step 2: Seed proxy configurations
    logger.info('🌱 Step 2: Seeding proxy configurations...');
    await seedProxyConfigurations();
    
    // Count created resources
    const proxyPools = await prisma.proxyPool.count();
    const proxies = await prisma.proxy.count();
    
    result.proxyPoolsCreated = proxyPools;
    result.proxiesConfigured = proxies;
    
    logger.info(`✅ Created ${proxyPools} proxy pools with ${proxies} proxies`);
    
    // Step 3: Test proxy health
    logger.info('🔍 Step 3: Testing proxy health...');
    
    const allProxies = await prisma.proxy.findMany({
      where: { isActive: true }
    });
    
    const testPromises = allProxies.map(proxy => testProxyHealth(proxy));
    const testResults = await Promise.allSettled(testPromises);
    
    for (const testResult of testResults) {
      if (testResult.status === 'fulfilled') {
        result.testResults.push(testResult.value);
        
        if (testResult.value.isHealthy) {
          result.healthyProxies++;
          
          // Update proxy health in database
          await prisma.proxy.update({
            where: { id: testResult.value.proxyId },
            data: {
              successRate: 1.0,
              responseTime: testResult.value.responseTime,
              failureCount: 0,
              lastUsed: new Date()
            }
          });
        } else {
          result.unhealthyProxies++;
          
          // Update proxy as unhealthy
          await prisma.proxy.update({
            where: { id: testResult.value.proxyId },
            data: {
              successRate: 0.0,
              responseTime: testResult.value.responseTime,
              failureCount: 1,
              isActive: false // Disable unhealthy proxies
            }
          });
        }
      } else {
        result.unhealthyProxies++;
        result.errors.push(`Proxy test failed: ${testResult.reason}`);
      }
    }
    
    logger.info(`✅ Proxy health testing completed: ${result.healthyProxies} healthy, ${result.unhealthyProxies} unhealthy`);
    
    // Step 4: Initialize proxy managers
    logger.info('⚙️ Step 4: Initializing proxy managers...');
    
    try {
      // Test EnterpriseProxyManager initialization
      const enterpriseManager = new EnterpriseProxyManager();
      logger.info('✅ EnterpriseProxyManager initialized successfully');
      
      // Test ProxyRotationManager initialization
      const rotationManager = new ProxyRotationManager();
      logger.info('✅ ProxyRotationManager initialized successfully');
      
    } catch (managerError) {
      const errorMsg = `Proxy manager initialization failed: ${managerError}`;
      result.errors.push(errorMsg);
      logger.error('❌', errorMsg);
    }
    
    // Step 5: Final validation
    logger.info('🔍 Step 5: Final validation...');
    
    if (result.healthyProxies === 0) {
      result.errors.push('No healthy proxies found! Check your proxy configurations.');
      logger.error('❌ No healthy proxies found!');
    } else {
      result.success = true;
      logger.info('✅ Proxy services setup completed successfully!');
    }
    
  } catch (error) {
    const errorMsg = `Setup process failed: ${error}`;
    result.errors.push(errorMsg);
    logger.error('❌', errorMsg);
  }
  
  return result;
}

/**
 * Generate setup report
 */
function generateSetupReport(result: SetupResult): void {
  logger.info('\n' + '='.repeat(60));
  logger.info('📊 PROXY SERVICES SETUP REPORT');
  logger.info('='.repeat(60));
  
  logger.info(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  logger.info(`Proxy Pools Created: ${result.proxyPoolsCreated}`);
  logger.info(`Proxies Configured: ${result.proxiesConfigured}`);
  logger.info(`Healthy Proxies: ${result.healthyProxies}`);
  logger.info(`Unhealthy Proxies: ${result.unhealthyProxies}`);
  
  if (result.testResults.length > 0) {
    logger.info('\n📋 Proxy Test Results:');
    result.testResults.forEach(test => {
      const status = test.isHealthy ? '✅' : '❌';
      const ip = test.ipAddress ? ` (IP: ${test.ipAddress})` : '';
      logger.info(`  ${status} ${test.host}:${test.port} - ${test.responseTime}ms${ip}`);
      if (test.error) {
        logger.info(`     Error: ${test.error}`);
      }
    });
  }
  
  if (result.errors.length > 0) {
    logger.info('\n❌ Errors:');
    result.errors.forEach(error => {
      logger.info(`  • ${error}`);
    });
  }
  
  logger.info('\n' + '='.repeat(60));
  
  if (result.success) {
    logger.info('🎉 Proxy services are ready for production use!');
  } else {
    logger.info('⚠️ Please fix the errors above before using proxy services.');
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const result = await setupProxyServices();
    generateSetupReport(result);
    
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Setup script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { setupProxyServices };
