import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';
import { config } from '../src/config/environment';

const prisma = new PrismaClient();

/**
 * Comprehensive Proxy Configuration Seeding Script
 * Seeds the database with proxy configurations from environment variables
 * and creates proper proxy pools for enterprise operations
 */

interface ProxyPoolSeedData {
  name: string;
  description: string;
  provider: string;
  region?: string;
  country?: string;
  protocol: string;
  authMethod: string;
  maxConcurrentSessions: number;
  rotationInterval: number;
  healthCheckInterval: number;
  priority: number;
  proxies: Array<{
    host: string;
    port: number;
    username?: string;
    password?: string;
    type: string;
    protocol: string;
    country?: string;
    region?: string;
    city?: string;
  }>;
}

/**
 * Parse proxy URLs from environment configuration
 */
function parseProxyUrls(urls: string[], username?: string, password?: string, type: string = 'http'): Array<{
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: string;
  protocol: string;
  country?: string;
  region?: string;
  city?: string;
}> {
  const proxies = [];
  
  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      proxies.push({
        host: urlObj.hostname,
        port: parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
        username: username || urlObj.username || undefined,
        password: password || urlObj.password || undefined,
        type: type,
        protocol: urlObj.protocol.replace(':', ''),
        country: undefined, // Will be detected during health checks
        region: undefined,
        city: undefined
      });
    } catch (error) {
      logger.warn(`Invalid proxy URL: ${url}`, error);
    }
  }
  
  return proxies;
}

/**
 * Generate seed data from environment configuration
 */
function generateProxyPoolSeedData(): ProxyPoolSeedData[] {
  const seedData: ProxyPoolSeedData[] = [];
  
  // Residential Proxy Pool
  if (config.twikit.proxy.pools.residential.enabled && config.twikit.proxy.pools.residential.urls.length > 0) {
    seedData.push({
      name: 'Residential Proxy Pool',
      description: 'High-quality residential proxies for anti-detection',
      provider: 'RESIDENTIAL',
      protocol: 'HTTP',
      authMethod: 'USER_PASS',
      maxConcurrentSessions: 20,
      rotationInterval: config.twikit.proxy.rotationInterval,
      healthCheckInterval: config.twikit.proxy.healthCheckInterval,
      priority: 1,
      proxies: parseProxyUrls(
        config.twikit.proxy.pools.residential.urls,
        config.twikit.proxy.pools.residential.username,
        config.twikit.proxy.pools.residential.password,
        'residential'
      )
    });
  }
  
  // Datacenter Proxy Pool
  if (config.twikit.proxy.pools.datacenter.enabled && config.twikit.proxy.pools.datacenter.urls.length > 0) {
    seedData.push({
      name: 'Datacenter Proxy Pool',
      description: 'Fast datacenter proxies for high-volume operations',
      provider: 'DATACENTER',
      protocol: 'HTTP',
      authMethod: 'USER_PASS',
      maxConcurrentSessions: 50,
      rotationInterval: config.twikit.proxy.rotationInterval,
      healthCheckInterval: config.twikit.proxy.healthCheckInterval,
      priority: 2,
      proxies: parseProxyUrls(
        config.twikit.proxy.pools.datacenter.urls,
        config.twikit.proxy.pools.datacenter.username,
        config.twikit.proxy.pools.datacenter.password,
        'datacenter'
      )
    });
  }
  
  // Mobile Proxy Pool
  if (config.twikit.proxy.pools.mobile.enabled && config.twikit.proxy.pools.mobile.urls.length > 0) {
    seedData.push({
      name: 'Mobile Proxy Pool',
      description: 'Mobile carrier proxies for maximum authenticity',
      provider: 'MOBILE',
      protocol: 'HTTP',
      authMethod: 'USER_PASS',
      maxConcurrentSessions: 10,
      rotationInterval: config.twikit.proxy.rotationInterval,
      healthCheckInterval: config.twikit.proxy.healthCheckInterval,
      priority: 3,
      proxies: parseProxyUrls(
        config.twikit.proxy.pools.mobile.urls,
        config.twikit.proxy.pools.mobile.username,
        config.twikit.proxy.pools.mobile.password,
        'mobile'
      )
    });
  }
  
  return seedData;
}

/**
 * Create demo proxy pools for development/testing
 */
function generateDemoProxyPools(): ProxyPoolSeedData[] {
  return [
    {
      name: 'Demo Residential Pool',
      description: 'Demo residential proxies for development',
      provider: 'RESIDENTIAL',
      region: 'US',
      country: 'US',
      protocol: 'HTTP',
      authMethod: 'USER_PASS',
      maxConcurrentSessions: 5,
      rotationInterval: 300,
      healthCheckInterval: 60,
      priority: 1,
      proxies: [
        {
          host: '192.168.1.100',
          port: 8080,
          username: 'demo_user_1',
          password: 'demo_pass_1',
          type: 'residential',
          protocol: 'http',
          country: 'US',
          region: 'California',
          city: 'Los Angeles'
        },
        {
          host: '192.168.1.101',
          port: 8081,
          username: 'demo_user_2',
          password: 'demo_pass_2',
          type: 'residential',
          protocol: 'http',
          country: 'US',
          region: 'New York',
          city: 'New York'
        }
      ]
    },
    {
      name: 'Demo Datacenter Pool',
      description: 'Demo datacenter proxies for development',
      provider: 'DATACENTER',
      region: 'EU',
      country: 'DE',
      protocol: 'HTTP',
      authMethod: 'USER_PASS',
      maxConcurrentSessions: 10,
      rotationInterval: 300,
      healthCheckInterval: 60,
      priority: 2,
      proxies: [
        {
          host: '10.0.1.100',
          port: 3128,
          username: 'datacenter_user',
          password: 'datacenter_pass',
          type: 'datacenter',
          protocol: 'http',
          country: 'DE',
          region: 'Bavaria',
          city: 'Munich'
        }
      ]
    }
  ];
}

/**
 * Seed proxy pools and configurations
 */
async function seedProxyConfigurations(): Promise<void> {
  try {
    logger.info('🌱 Starting proxy configuration seeding...');
    
    // Clear existing proxy data
    logger.info('Clearing existing proxy data...');
    await prisma.sessionProxyAssignment.deleteMany();
    await prisma.proxyHealthMetrics.deleteMany();
    await prisma.proxyUsageLog.deleteMany();
    await prisma.proxy.deleteMany();
    await prisma.proxyPool.deleteMany();
    
    // Generate seed data from environment or use demo data
    let seedData = generateProxyPoolSeedData();
    
    if (seedData.length === 0) {
      logger.info('No proxy configuration found in environment, using demo data...');
      seedData = generateDemoProxyPools();
    }
    
    let totalProxies = 0;
    
    // Create proxy pools and proxies
    for (const poolData of seedData) {
      logger.info(`Creating proxy pool: ${poolData.name}`);
      
      // Create proxy pool
      const proxyPool = await prisma.proxyPool.create({
        data: {
          name: poolData.name,
          description: poolData.description,
          provider: poolData.provider,
          region: poolData.region,
          country: poolData.country,
          protocol: poolData.protocol,
          authMethod: poolData.authMethod,
          maxConcurrentSessions: poolData.maxConcurrentSessions,
          rotationInterval: poolData.rotationInterval,
          healthCheckInterval: poolData.healthCheckInterval,
          priority: poolData.priority,
          isActive: true,
          healthStatus: 'UNKNOWN',
          successRate: 0.0,
          avgResponseTime: 0,
          currentUsage: 0,
          metadata: {}
        }
      });
      
      // Create proxies for this pool
      for (const proxyData of poolData.proxies) {
        await prisma.proxy.create({
          data: {
            host: proxyData.host,
            port: proxyData.port,
            username: proxyData.username,
            password: proxyData.password, // In production, this should be encrypted
            type: proxyData.type,
            protocol: proxyData.protocol,
            country: proxyData.country,
            region: proxyData.region,
            city: proxyData.city,
            isActive: true,
            successRate: 1.0,
            responseTime: 0,
            failureCount: 0,
            maxConcurrentConnections: 10,
            rotationInterval: poolData.rotationInterval,
            stickySession: false,
            sessionDuration: 1800,
            proxyPoolId: proxyPool.id,
            metadata: {}
          }
        });
        totalProxies++;
      }
    }
    
    logger.info(`✅ Proxy seeding completed successfully!`);
    logger.info(`📊 Created ${seedData.length} proxy pools with ${totalProxies} total proxies`);
    
  } catch (error) {
    logger.error('❌ Proxy seeding failed:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    await seedProxyConfigurations();
  } catch (error) {
    logger.error('Seeding process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedProxyConfigurations };
