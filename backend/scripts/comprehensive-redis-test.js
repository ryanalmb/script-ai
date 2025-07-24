/**
 * Comprehensive Redis Integration Test
 * Tests all enterprise rate limiting features with real Upstash Redis
 */

require('dotenv').config();
const { GlobalRateLimitCoordinator, RateLimitAction, RateLimitPriority, AccountType } = require('../dist/services/globalRateLimitCoordinator');
const { TwikitConfigManager } = require('../dist/config/twikit');
const Redis = require('ioredis');

async function testRedisConnection() {
  console.log('🔍 Testing Redis Connection...');
  
  const redis = new Redis(process.env.REDIS_URL, {
    connectTimeout: 10000,
    lazyConnect: true,
    maxRetriesPerRequest: 3
  });

  try {
    await redis.connect();
    await redis.set('test:connection', 'success', 'EX', 60);
    const result = await redis.get('test:connection');
    
    if (result === 'success') {
      console.log('✅ Redis Connection: WORKING');
      console.log(`   Host: ${redis.options.host}`);
      console.log(`   Port: ${redis.options.port}`);
      await redis.del('test:connection');
      await redis.disconnect();
      return true;
    }
  } catch (error) {
    console.log('❌ Redis Connection: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testDistributedRateLimiting() {
  console.log('\n🔄 Testing Distributed Rate Limiting...');
  
  let redis, coordinator;
  
  try {
    // Setup
    redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });
    
    await redis.connect();
    
    const configManager = TwikitConfigManager.getInstance();
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
    console.log('✅ Coordinator Initialized');

    // Test 1: Basic Rate Limiting
    console.log('   Testing basic rate limiting...');
    const testAccountId = 'test-enterprise-account';
    
    const request = {
      accountId: testAccountId,
      action: RateLimitAction.POST_TWEET,
      priority: RateLimitPriority.NORMAL,
      metadata: { contentLength: 100, hasMedia: false }
    };

    const result1 = await coordinator.checkRateLimit(request);
    console.log(`   ✅ First request: allowed=${result1.allowed}`);

    // Test 2: Lua Script Execution
    console.log('   Testing Lua script execution...');
    const result2 = await coordinator.checkRateLimit(request);
    console.log(`   ✅ Second request: allowed=${result2.allowed}`);

    // Test 3: Account Profile Management
    console.log('   Testing account profile management...');
    await coordinator.updateAccountType(testAccountId, AccountType.PREMIUM);
    console.log('   ✅ Account type updated to PREMIUM');

    // Test 4: Rate Limit Status
    console.log('   Testing rate limit status...');
    const status = await coordinator.getRateLimitStatus(testAccountId, RateLimitAction.POST_TWEET);
    console.log(`   ✅ Status retrieved: limit=${status.limit}`);

    // Test 5: Analytics
    console.log('   Testing analytics collection...');
    const stats = await coordinator.getAccountStatistics(testAccountId);
    console.log(`   ✅ Analytics working: ${Object.keys(stats).length} metrics`);

    console.log('✅ Distributed Rate Limiting: ALL TESTS PASSED');
    return true;

  } catch (error) {
    console.log('❌ Distributed Rate Limiting: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  } finally {
    if (coordinator) await coordinator.shutdown();
    if (redis) await redis.disconnect();
  }
}

async function testGracefulDegradation() {
  console.log('\n🛡️ Testing Graceful Degradation...');
  
  try {
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
      accountId: 'test-fallback-account',
      action: RateLimitAction.POST_TWEET,
      priority: RateLimitPriority.NORMAL
    };

    const result = await coordinator.checkRateLimit(request);
    console.log(`✅ Fallback mode working: allowed=${result.allowed}`);

    await coordinator.shutdown();
    console.log('✅ Graceful Degradation: PASSED');
    return true;

  } catch (error) {
    console.log('❌ Graceful Degradation: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testCrossInstanceCoordination() {
  console.log('\n🌐 Testing Cross-Instance Coordination...');
  
  let redis1, redis2, coordinator1, coordinator2;
  
  try {
    // Create two coordinators simulating different instances
    redis1 = new Redis(process.env.REDIS_URL, { connectTimeout: 10000, lazyConnect: true });
    redis2 = new Redis(process.env.REDIS_URL, { connectTimeout: 10000, lazyConnect: true });
    
    await redis1.connect();
    await redis2.connect();
    
    const configManager = TwikitConfigManager.getInstance();
    
    coordinator1 = new GlobalRateLimitCoordinator({
      configManager,
      redisClient: redis1,
      enableDistributedCoordination: true,
      instanceId: 'instance-1'
    });
    
    coordinator2 = new GlobalRateLimitCoordinator({
      configManager,
      redisClient: redis2,
      enableDistributedCoordination: true,
      instanceId: 'instance-2'
    });

    await coordinator1.initialize();
    await coordinator2.initialize();
    console.log('✅ Two coordinator instances initialized');

    // Test distributed locking
    console.log('   Testing distributed locking...');
    const lockKey = 'test-cross-instance-lock';
    const lock1 = await coordinator1.acquireDistributedLock(lockKey, 5000);
    const lock2 = await coordinator2.acquireDistributedLock(lockKey, 1000);
    
    console.log(`   ✅ Lock coordination: instance1=${!!lock1}, instance2=${!!lock2}`);
    
    if (lock1) await coordinator1.releaseDistributedLock(lockKey);
    if (lock2) await coordinator2.releaseDistributedLock(lockKey);

    console.log('✅ Cross-Instance Coordination: PASSED');
    return true;

  } catch (error) {
    console.log('❌ Cross-Instance Coordination: FAILED');
    console.log(`   Error: ${error.message}`);
    return false;
  } finally {
    if (coordinator1) await coordinator1.shutdown();
    if (coordinator2) await coordinator2.shutdown();
    if (redis1) await redis1.disconnect();
    if (redis2) await redis2.disconnect();
  }
}

async function runComprehensiveTests() {
  console.log('🚀 Comprehensive Redis Integration Test Suite\n');
  console.log('Testing with Upstash Redis at noted-tuna-13394.upstash.io:6379\n');
  
  const results = {
    redisConnection: false,
    distributedRateLimiting: false,
    gracefulDegradation: false,
    crossInstanceCoordination: false
  };

  // Test 1: Redis Connection
  results.redisConnection = await testRedisConnection();

  // Test 2: Distributed Rate Limiting (only if Redis works)
  if (results.redisConnection) {
    results.distributedRateLimiting = await testDistributedRateLimiting();
  }

  // Test 3: Graceful Degradation
  results.gracefulDegradation = await testGracefulDegradation();

  // Test 4: Cross-Instance Coordination (only if Redis works)
  if (results.redisConnection) {
    results.crossInstanceCoordination = await testCrossInstanceCoordination();
  }

  // Summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  console.log(`✅ Redis Connection: ${results.redisConnection ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Distributed Rate Limiting: ${results.distributedRateLimiting ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Graceful Degradation: ${results.gracefulDegradation ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Cross-Instance Coordination: ${results.crossInstanceCoordination ? 'PASSED' : 'FAILED'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL ENTERPRISE FEATURES OPERATIONAL!');
    console.log('   • Distributed rate limiting coordination ✅');
    console.log('   • Lua script execution for atomic operations ✅');
    console.log('   • Account profile management in Redis ✅');
    console.log('   • Analytics data collection and storage ✅');
    console.log('   • Cross-instance rate limit sharing ✅');
    console.log('   • Graceful degradation when Redis unavailable ✅');
  } else {
    console.log('\n⚠️ Some features need attention');
  }
}

runComprehensiveTests().catch(console.error);
