/**
 * Comprehensive Twikit Integration Seed Data
 * Seeds the database with realistic test data for all Twikit-related tables
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seed data constants
const SEED_DATA = {
  users: [
    {
      email: 'twikit.test@example.com',
      username: 'twikit_test_user',
      password: '$2b$10$example.hash.for.testing',
      role: 'USER' as const,
      telegramId: '123456789',
      telegramUsername: 'twikit_test'
    }
  ],
  xaccounts: [
    {
      username: 'test_twitter_account',
      displayName: 'Test Twitter Account',
      email: 'test@twitter.example.com',
      accountId: 'twitter_123456789',
      accessToken: 'encrypted_access_token_example',
      accessTokenSecret: 'encrypted_secret_example',
      followersCount: 1500,
      followingCount: 300,
      tweetsCount: 250
    }
  ],
  proxyPools: [
    {
      name: 'US Residential Pool',
      description: 'High-quality US residential proxies',
      provider: 'RESIDENTIAL',
      region: 'US',
      country: 'United States',
      protocol: 'HTTP',
      maxConcurrentSessions: 50,
      rotationInterval: 300,
      healthStatus: 'HEALTHY'
    },
    {
      name: 'EU Datacenter Pool',
      description: 'European datacenter proxies',
      provider: 'DATACENTER',
      region: 'EU',
      country: 'Germany',
      protocol: 'SOCKS5',
      maxConcurrentSessions: 100,
      rotationInterval: 600,
      healthStatus: 'HEALTHY'
    }
  ],
  proxies: [
    {
      host: '192.168.1.100',
      port: 8080,
      username: 'proxy_user_1',
      password: 'proxy_pass_1',
      type: 'http',
      provider: 'ResidentialProvider',
      country: 'US',
      region: 'California',
      city: 'Los Angeles'
    },
    {
      host: '192.168.1.101',
      port: 8081,
      username: 'proxy_user_2',
      password: 'proxy_pass_2',
      type: 'socks5',
      provider: 'DatacenterProvider',
      country: 'DE',
      region: 'Bavaria',
      city: 'Munich'
    }
  ]
};

async function seedTwikitIntegration() {
  console.log('🌱 Starting Twikit integration seeding...');

  try {
    // 1. Create test user
    console.log('1️⃣ Creating test users...');
    const user = await prisma.user.create({
      data: SEED_DATA.users[0]
    });
    console.log(`✅ Created user: ${user.username}`);

    // 2. Create proxy pools
    console.log('2️⃣ Creating proxy pools...');
    const proxyPools = [];
    for (const poolData of SEED_DATA.proxyPools) {
      const pool = await prisma.proxyPool.create({
        data: poolData
      });
      proxyPools.push(pool);
      console.log(`✅ Created proxy pool: ${pool.name}`);
    }

    // 3. Create proxies
    console.log('3️⃣ Creating proxies...');
    const proxies = [];
    for (let i = 0; i < SEED_DATA.proxies.length; i++) {
      const proxyData = {
        ...SEED_DATA.proxies[i],
        proxyPoolId: proxyPools[i % proxyPools.length].id
      };
      const proxy = await prisma.proxy.create({
        data: proxyData
      });
      proxies.push(proxy);
      console.log(`✅ Created proxy: ${proxy.host}:${proxy.port}`);
    }

    // 4. Create X account
    console.log('4️⃣ Creating X accounts...');
    const xaccount = await prisma.xAccount.create({
      data: {
        ...SEED_DATA.xaccounts[0],
        userId: user.id,
        proxyId: proxies[0].id
      }
    });
    console.log(`✅ Created X account: ${xaccount.username}`);

    // 5. Create Twikit account
    console.log('5️⃣ Creating Twikit accounts...');
    const twikitAccount = await prisma.twikitAccount.create({
      data: {
        accountId: xaccount.id,
        twikitUserId: 'twikit_user_123456789',
        username: xaccount.username,
        displayName: xaccount.displayName,
        email: xaccount.email,
        followersCount: xaccount.followersCount,
        followingCount: xaccount.followingCount,
        tweetsCount: xaccount.tweetsCount,
        accountType: 'PERSONAL',
        rateLimitTier: 'STANDARD'
      }
    });
    console.log(`✅ Created Twikit account: ${twikitAccount.username}`);

    // 6. Create Twikit session
    console.log('6️⃣ Creating Twikit sessions...');
    const session = await prisma.twikitSession.create({
      data: {
        accountId: xaccount.id,
        sessionToken: 'encrypted_session_token_example_12345',
        sessionState: 'ACTIVE',
        isAuthenticated: true,
        authenticationMethod: 'PASSWORD',
        proxyId: proxies[0].id,
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        sessionMetadata: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ipAddress: '192.168.1.100',
          loginTime: new Date().toISOString()
        }
      }
    });
    console.log(`✅ Created Twikit session: ${session.id}`);

    // 7. Create session history
    console.log('7️⃣ Creating session history...');
    await prisma.twikitSessionHistory.create({
      data: {
        sessionId: session.id,
        accountId: xaccount.id,
        event: 'LOGIN',
        success: true,
        sessionDuration: 3600,
        ipAddress: '192.168.1.100',
        proxyId: proxies[0].id,
        eventDetails: {
          loginMethod: 'password',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    });
    console.log(`✅ Created session history entry`);

    // 8. Create session proxy assignment
    console.log('8️⃣ Creating session proxy assignments...');
    await prisma.sessionProxyAssignment.create({
      data: {
        sessionId: session.id,
        proxyId: proxies[0].id,
        assignmentReason: 'AUTOMATIC',
        priority: 1,
        stickySession: true,
        maxDuration: 3600,
        usageCount: 5,
        successCount: 5,
        lastUsed: new Date()
      }
    });
    console.log(`✅ Created session proxy assignment`);

    // 9. Create rate limit profile
    console.log('9️⃣ Creating rate limit profiles...');
    const rateLimitProfile = await prisma.accountRateLimitProfile.create({
      data: {
        accountId: xaccount.id,
        twikitAccountId: twikitAccount.id,
        profileName: 'STANDARD_PROFILE',
        accountType: 'STANDARD',
        tierLevel: 'BASIC',
        customLimits: {
          POST_TWEET: { limit: 300, window: 900 },
          LIKE: { limit: 1000, window: 900 },
          RETWEET: { limit: 300, window: 900 },
          FOLLOW: { limit: 400, window: 900 }
        },
        globalMultiplier: 1.0,
        burstAllowance: 10,
        violationThreshold: 5,
        suspensionThreshold: 10
      }
    });
    console.log(`✅ Created rate limit profile`);

    // 10. Create sample rate limit events
    console.log('🔟 Creating rate limit events...');
    const rateLimitEvents = [];
    const actions = ['POST_TWEET', 'LIKE', 'RETWEET', 'FOLLOW'];
    
    for (let i = 0; i < 10; i++) {
      const action = actions[i % actions.length];
      const event = await prisma.rateLimitEvent.create({
        data: {
          accountId: xaccount.id,
          sessionId: session.id,
          action,
          rateLimitType: 'USER_RATE_LIMIT',
          limitValue: 300,
          currentCount: Math.floor(Math.random() * 250),
          windowStart: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
          windowEnd: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
          windowDuration: 900,
          allowed: Math.random() > 0.1, // 90% allowed
          priority: 'NORMAL',
          source: 'TWIKIT',
          responseTime: Math.floor(Math.random() * 100) + 10,
          quotaRemaining: Math.floor(Math.random() * 50) + 10
        }
      });
      rateLimitEvents.push(event);
    }
    console.log(`✅ Created ${rateLimitEvents.length} rate limit events`);

    // 11. Create sample tweets cache
    console.log('1️⃣1️⃣ Creating tweet cache entries...');
    const tweetCacheEntries = [];
    for (let i = 0; i < 5; i++) {
      const tweet = await prisma.tweetCache.create({
        data: {
          tweetId: `tweet_${Date.now()}_${i}`,
          accountId: xaccount.id,
          twikitAccountId: twikitAccount.id,
          authorId: `author_${i}`,
          authorUsername: `author_user_${i}`,
          authorDisplayName: `Author ${i}`,
          content: `This is a sample tweet content for testing purposes #${i} #test`,
          language: 'en',
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          retweetCount: Math.floor(Math.random() * 100),
          likeCount: Math.floor(Math.random() * 500),
          replyCount: Math.floor(Math.random() * 50),
          hashtags: [`tag${i}`, 'test', 'sample'],
          mentions: [`user${i}`, 'testuser'],
          cacheReason: 'TRENDING',
          accessCount: Math.floor(Math.random() * 20),
          lastAccessed: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });
      tweetCacheEntries.push(tweet);
    }
    console.log(`✅ Created ${tweetCacheEntries.length} tweet cache entries`);

    // 12. Create sample interaction logs
    console.log('1️⃣2️⃣ Creating interaction logs...');
    const interactionTypes = ['LIKE', 'RETWEET', 'REPLY', 'FOLLOW'];
    for (let i = 0; i < 15; i++) {
      const interactionType = interactionTypes[i % interactionTypes.length];
      await prisma.interactionLog.create({
        data: {
          accountId: xaccount.id,
          twikitAccountId: twikitAccount.id,
          sessionId: session.id,
          interactionType,
          targetType: interactionType === 'FOLLOW' ? 'USER' : 'TWEET',
          targetId: interactionType === 'FOLLOW' ? `user_${i}` : `tweet_${i}`,
          targetUserId: interactionType === 'FOLLOW' ? `user_${i}` : null,
          targetUsername: interactionType === 'FOLLOW' ? `target_user_${i}` : null,
          tweetId: interactionType !== 'FOLLOW' ? `tweet_${i}` : null,
          success: Math.random() > 0.05, // 95% success rate
          responseTime: Math.floor(Math.random() * 2000) + 100,
          priority: 'NORMAL',
          source: 'AUTOMATED',
          proxyId: proxies[i % proxies.length].id,
          executedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
        }
      });
    }
    console.log(`✅ Created 15 interaction log entries`);

    // 13. Create content queue entries
    console.log('1️⃣3️⃣ Creating content queue entries...');
    const contentTypes = ['TWEET', 'RETWEET', 'REPLY'];
    for (let i = 0; i < 8; i++) {
      const contentType = contentTypes[i % contentTypes.length];
      await prisma.contentQueue.create({
        data: {
          accountId: xaccount.id,
          twikitAccountId: twikitAccount.id,
          sessionId: session.id,
          contentType,
          content: `Scheduled ${contentType.toLowerCase()} content #${i} for testing automation`,
          hashtags: [`scheduled${i}`, 'automation', 'test'],
          mentions: [`user${i}`],
          scheduledFor: new Date(Date.now() + (i + 1) * 60 * 60 * 1000), // Staggered hours
          priority: i % 3 === 0 ? 'HIGH' : 'NORMAL',
          status: i < 3 ? 'PENDING' : i < 6 ? 'POSTED' : 'FAILED',
          retryCount: i >= 6 ? Math.floor(Math.random() * 3) : 0,
          postedAt: i >= 3 && i < 6 ? new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) : null,
          postedTweetId: i >= 3 && i < 6 ? `posted_tweet_${i}` : null,
          source: 'AUTOMATED',
          contentScore: Math.random() * 100,
          sentimentScore: (Math.random() - 0.5) * 2, // -1 to 1
          engagementPrediction: Math.random() * 100
        }
      });
    }
    console.log(`✅ Created 8 content queue entries`);

    // 14. Create operation logs
    console.log('1️⃣4️⃣ Creating operation logs...');
    const operationTypes = ['AUTHENTICATION', 'POST_TWEET', 'LIKE', 'RETWEET', 'FOLLOW'];
    for (let i = 0; i < 20; i++) {
      const operationType = operationTypes[i % operationTypes.length];
      await prisma.twikitOperationLog.create({
        data: {
          accountId: xaccount.id,
          sessionId: session.id,
          operationType,
          operationCategory: operationType === 'AUTHENTICATION' ? 'AUTHENTICATION' : 'INTERACTION',
          method: `twikit.${operationType.toLowerCase()}`,
          success: Math.random() > 0.05, // 95% success rate
          statusCode: Math.random() > 0.05 ? 200 : 429, // Mostly 200, some rate limits
          duration: Math.floor(Math.random() * 3000) + 100,
          retryCount: Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0,
          rateLimited: Math.random() < 0.1, // 10% rate limited
          instanceId: 'instance_1',
          correlationId: `corr_${Date.now()}_${i}`,
          severity: Math.random() > 0.95 ? 'ERROR' : 'INFO',
          source: 'TWIKIT',
          environment: 'DEVELOPMENT'
        }
      });
    }
    console.log(`✅ Created 20 operation log entries`);

    // 15. Create system health entries
    console.log('1️⃣5️⃣ Creating system health entries...');
    const components = ['TWIKIT_BRIDGE', 'DATABASE', 'REDIS', 'PROXY_POOL'];
    for (const component of components) {
      await prisma.systemHealth.create({
        data: {
          componentName: component,
          componentType: component === 'DATABASE' ? 'DATABASE' : 'SERVICE',
          healthStatus: 'HEALTHY',
          healthScore: 95 + Math.random() * 5, // 95-100
          availability: 99.5 + Math.random() * 0.5, // 99.5-100%
          responseTime: Math.floor(Math.random() * 100) + 10,
          errorRate: Math.random() * 0.5, // 0-0.5%
          throughput: Math.random() * 1000 + 100,
          consecutiveSuccesses: Math.floor(Math.random() * 100) + 50,
          checkInterval: 60,
          nextCheckAt: new Date(Date.now() + 60 * 1000),
          instanceId: 'instance_1',
          environment: 'DEVELOPMENT'
        }
      });
    }
    console.log(`✅ Created ${components.length} system health entries`);

    console.log('\n🎉 Twikit integration seeding completed successfully!');
    console.log('📊 Summary:');
    console.log('   • 1 test user created');
    console.log('   • 2 proxy pools created');
    console.log('   • 2 proxies created');
    console.log('   • 1 X account created');
    console.log('   • 1 Twikit account created');
    console.log('   • 1 Twikit session created');
    console.log('   • 1 session history entry created');
    console.log('   • 1 session proxy assignment created');
    console.log('   • 1 rate limit profile created');
    console.log('   • 10 rate limit events created');
    console.log('   • 5 tweet cache entries created');
    console.log('   • 15 interaction logs created');
    console.log('   • 8 content queue entries created');
    console.log('   • 20 operation logs created');
    console.log('   • 4 system health entries created');

    return true;
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedTwikitIntegration();
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedTwikitIntegration };
