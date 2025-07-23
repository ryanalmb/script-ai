/**
 * Simple Redis Connection Test
 */

require('dotenv').config();
const Redis = require('ioredis');

async function testUpstashRedis() {
  console.log('🔍 Testing Upstash Redis connection...');
  console.log('Redis URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
  
  if (!process.env.REDIS_URL) {
    console.log('❌ REDIS_URL environment variable not set');
    return;
  }

  try {
    const redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 10000,
      lazyConnect: true,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    });

    console.log('⏳ Connecting to Redis...');
    await redis.connect();
    
    console.log('⏳ Testing basic operations...');
    await redis.set('test:connection', 'success', 'EX', 60);
    const result = await redis.get('test:connection');
    
    if (result === 'success') {
      console.log('✅ Upstash Redis: CONNECTED and WORKING');
      console.log(`   Host: ${redis.options.host}`);
      console.log(`   Port: ${redis.options.port}`);
      
      // Clean up
      await redis.del('test:connection');
      await redis.disconnect();
      
      return true;
    } else {
      console.log('❌ Redis connected but operations failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Upstash Redis connection failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function main() {
  const success = await testUpstashRedis();
  
  if (success) {
    console.log('\n🎉 Redis is ready for use!');
    console.log('   • Rate limiting will use distributed coordination');
    console.log('   • Analytics will be stored in Redis');
    console.log('   • Full enterprise features available');
  } else {
    console.log('\n⚠️ Redis not available - using fallback mode');
    console.log('   • Rate limiting will work locally only');
    console.log('   • Limited analytics capabilities');
    console.log('   • Some enterprise features disabled');
  }
}

main().catch(console.error);
