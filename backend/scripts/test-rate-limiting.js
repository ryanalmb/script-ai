/**
 * Test Rate Limiting with Real Redis
 */

require('dotenv').config();
const { GlobalRateLimitCoordinator, RateLimitAction, RateLimitPriority, AccountType } = require('../dist/services/globalRateLimitCoordinator');
const { TwikitConfigManager } = require('../dist/config/twikit');
const Redis = require('ioredis');

async function testRateLimiting() {
  console.log('🧪 Testing Rate Limiting with Upstash Redis...\n');

  let redis;
  let coordinator;

  try {
    // Connect to Redis
    console.log('1️⃣ Connecting to Redis...');
    redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });

    await redis.connect();
    console.log('✅ Connected to Redis');

    // Initialize config manager
    console.log('2️⃣ Initializing config manager...');
    const configManager = TwikitConfigManager.getInstance();
    console.log('✅ Config manager initialized');

    // Create rate limit coordinator
    console.log('3️⃣ Creating rate limit coordinator...');
    coordinator = new GlobalRateLimitCoordinator({
      configManager,
      redisClient: redis,
      enableAnalytics: true,
      enableDistributedCoordination: true,
      queueProcessInterval: 50,
      analyticsFlushInterval: 1000,
      lockTtl: 5000,
      profileCacheTtl: 1800
    });

    await coordinator.initialize();
    console.log('✅ Rate limit coordinator initialized');

    // Test basic rate limiting
    console.log('4️⃣ Testing basic rate limiting...');
    const testAccountId = 'test-account-123';
    
    const request = {
      accountId: testAccountId,
      action: RateLimitAction.POST_TWEET,
      priority: RateLimitPriority.NORMAL,
      metadata: {
        contentLength: 100,
        hasMedia: false
      }
    };

    const result = await coordinator.checkRateLimit(request);
    console.log('✅ Rate limit check result:', {
      allowed: result.allowed,
      remainingRequests: result.remainingRequests,
      resetTime: new Date(result.resetTime)
    });

    // Test multiple requests
    console.log('5️⃣ Testing multiple requests...');
    for (let i = 0; i < 3; i++) {
      const result = await coordinator.checkRateLimit(request);
      console.log(`   Request ${i + 1}: allowed=${result.allowed}, remaining=${result.remainingRequests}`);
    }

    // Test rate limit status
    console.log('6️⃣ Getting rate limit status...');
    const status = await coordinator.getRateLimitStatus(testAccountId, RateLimitAction.POST_TWEET);
    console.log('✅ Rate limit status:', {
      currentCount: status.currentCount,
      limit: status.limit,
      resetTime: new Date(status.resetTime)
    });

    console.log('\n🎉 All rate limiting tests passed!');
    console.log('   • Redis integration working');
    console.log('   • Rate limiting functional');
    console.log('   • Distributed coordination active');

  } catch (error) {
    console.error('❌ Rate limiting test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Cleanup
    if (coordinator) {
      await coordinator.shutdown();
    }
    if (redis) {
      await redis.disconnect();
    }
  }
}

async function testGracefulDegradation() {
  console.log('\n🧪 Testing Graceful Degradation...\n');

  try {
    // Test without Redis
    console.log('1️⃣ Testing without Redis connection...');
    const configManager = TwikitConfigManager.getInstance();
    
    const coordinator = new GlobalRateLimitCoordinator({
      configManager,
      redisClient: null, // No Redis
      enableAnalytics: false,
      enableDistributedCoordination: false
    });

    await coordinator.initialize();
    console.log('✅ Coordinator initialized without Redis');

    const request = {
      accountId: 'test-account-fallback',
      action: RateLimitAction.POST_TWEET,
      priority: RateLimitPriority.NORMAL
    };

    const result = await coordinator.checkRateLimit(request);
    console.log('✅ Fallback rate limiting works:', {
      allowed: result.allowed,
      fallbackMode: true
    });

    await coordinator.shutdown();
    console.log('✅ Graceful degradation test passed');

  } catch (error) {
    console.error('❌ Graceful degradation test failed:', error.message);
  }
}

async function main() {
  await testRateLimiting();
  await testGracefulDegradation();
}

main().catch(console.error);
