/**
 * Redis Connection Test Script
 * Tests Redis connectivity with fallback options
 */

const Redis = require('ioredis');

async function testRedisConnection() {
  console.log('🔍 Testing Redis connections...\n');

  // Test 1: Upstash Redis (from environment)
  if (process.env.REDIS_URL) {
    console.log('1️⃣ Testing Upstash Redis (from REDIS_URL)...');
    try {
      const upstashRedis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 10000,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });

      await upstashRedis.connect();
      await upstashRedis.set('test:connection', 'success');
      const result = await upstashRedis.get('test:connection');

      if (result === 'success') {
        console.log('✅ Upstash Redis: CONNECTED');
        console.log(`   Host: ${upstashRedis.options.host}`);
        await upstashRedis.del('test:connection');
        await upstashRedis.disconnect();
        return { type: 'upstash', client: upstashRedis };
      }
    } catch (error) {
      console.log('❌ Upstash Redis: FAILED');
      console.log(`   Error: ${error.message}`);
    }
  } else {
    console.log('1️⃣ REDIS_URL not set, skipping Upstash test...');
  }

  // Test 2: Local Docker Redis
  console.log('2️⃣ Testing local Docker Redis (localhost:6379)...');
  try {
    const localRedis = new Redis({
      host: 'localhost',
      port: 6379,
      connectTimeout: 5000,
      lazyConnect: true
    });

    await localRedis.connect();
    await localRedis.set('test:connection', 'success');
    const result = await localRedis.get('test:connection');

    if (result === 'success') {
      console.log('✅ Local Docker Redis: CONNECTED');
      await localRedis.del('test:connection');
      await localRedis.disconnect();
      return { type: 'local', client: localRedis };
    }
  } catch (error) {
    console.log('❌ Local Docker Redis: FAILED');
    console.log(`   Error: ${error.message}`);
  }

  // Test 3: Setup instructions
  console.log('\n3️⃣ No Redis connection available. Setup instructions:');

  if (!process.env.REDIS_URL) {
    console.log('\n📋 To set up Upstash Redis:');
    console.log('   1. Go to https://console.upstash.com/');
    console.log('   2. Select your Redis database');
    console.log('   3. Copy the "Redis Connect URL"');
    console.log('   4. Set REDIS_URL environment variable');
    console.log('   5. Restart the application');

    console.log('\n🔧 Example environment variable:');
    console.log('   REDIS_URL=rediss://default:password@host:port');
    console.log('\n💡 You can add this to your .env file or set it directly');
  }

  return null;
}

async function testWithMock() {
  console.log('\n4️⃣ Testing with ioredis-mock (fallback)...');
  try {
    const MockRedis = require('ioredis-mock');
    const mockRedis = new MockRedis();

    await mockRedis.set('test:mock', 'success');
    const result = await mockRedis.get('test:mock');

    if (result === 'success') {
      console.log('✅ ioredis-mock: WORKING');
      return { type: 'mock', client: mockRedis };
    }
  } catch (error) {
    console.log('❌ ioredis-mock: FAILED');
    console.log(`   Error: ${error.message}`);
  }

  return null;
}

async function main() {
  console.log('🚀 Redis Connection Test\n');
  
  const connection = await testRedisConnection();
  
  if (!connection) {
    const mockConnection = await testWithMock();
    if (mockConnection) {
      console.log('\n💡 Recommendation: Use ioredis-mock for testing until Redis is available');
    }
  }
  
  console.log('\n📊 Summary:');
  console.log('   • For full functionality: Set up Docker Redis or cloud Redis');
  console.log('   • For testing only: ioredis-mock is sufficient');
  console.log('   • Application will gracefully degrade without Redis');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testRedisConnection, testWithMock };
