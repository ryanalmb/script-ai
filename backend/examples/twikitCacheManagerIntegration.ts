/**
 * Twikit Cache Manager Integration Example - Task 28
 * 
 * Demonstrates comprehensive integration of the TwikitCacheManager with all
 * Twikit services, showcasing advanced caching strategies, performance
 * optimization, and service-specific cache management.
 */

import { 
  twikitCacheManager,
  TwikitServiceType,
  CachePriority,
  type CacheOperationContext,
  type CachePerformanceMetrics
} from '../src/services/twikitCacheManager';
import { logger } from '../src/utils/logger';

/**
 * Comprehensive Twikit Cache Manager Integration Demo
 */
async function demonstrateTwikitCacheIntegration() {
  console.log('\n🚀 Starting Twikit Cache Manager Integration Demo...\n');

  try {
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    console.log('📋 Step 1: Initialize TwikitCacheManager');
    await twikitCacheManager.initialize();
    console.log('✅ TwikitCacheManager initialized successfully\n');

    // ========================================================================
    // SERVICE-SPECIFIC CACHING EXAMPLES
    // ========================================================================

    console.log('📋 Step 2: Demonstrate Service-Specific Caching\n');

    // Session Manager Caching
    await demonstrateSessionManagerCaching();
    
    // Proxy Rotation Manager Caching
    await demonstrateProxyRotationCaching();
    
    // Rate Limit Coordinator Caching
    await demonstrateRateLimitCaching();
    
    // Account Health Monitor Caching
    await demonstrateHealthMonitorCaching();
    
    // Anti-Detection Manager Caching
    await demonstrateAntiDetectionCaching();
    
    // Campaign Orchestrator Caching
    await demonstrateCampaignCaching();
    
    // Content Safety Filter Caching
    await demonstrateContentSafetyCaching();
    
    // Connection Pool Caching
    await demonstrateConnectionPoolCaching();

    // ========================================================================
    // PERFORMANCE MONITORING
    // ========================================================================

    console.log('📋 Step 3: Performance Monitoring and Metrics\n');
    await demonstratePerformanceMonitoring();

    // ========================================================================
    // ADVANCED FEATURES
    // ========================================================================

    console.log('📋 Step 4: Advanced Caching Features\n');
    await demonstrateAdvancedFeatures();

    console.log('✅ Twikit Cache Manager Integration Demo completed successfully!\n');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

/**
 * Demonstrate Session Manager caching integration
 */
async function demonstrateSessionManagerCaching() {
  console.log('🔐 Session Manager Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.SESSION_MANAGER,
    operationType: 'session_state',
    accountId: 'account_123',
    sessionId: 'session_456',
    priority: CachePriority.HIGH,
    tags: ['session', 'authentication']
  };

  // Cache session data
  const sessionData = {
    sessionId: 'session_456',
    accountId: 'account_123',
    isAuthenticated: true,
    lastActivity: new Date(),
    metrics: {
      requestCount: 150,
      successRate: 0.98
    }
  };

  await twikitCacheManager.set('session_456', sessionData, context);
  console.log('  ✅ Session data cached');

  // Retrieve session data
  const cachedSession = await twikitCacheManager.get('session_456', context);
  console.log('  ✅ Session data retrieved:', cachedSession ? 'Found' : 'Not found');

  // Get service-specific cache manager
  const sessionCacheManager = twikitCacheManager.getServiceCacheManager(TwikitServiceType.SESSION_MANAGER);
  if (sessionCacheManager) {
    const metrics = await sessionCacheManager.getMetrics();
    console.log('  📊 Session cache metrics:', {
      hitRate: (metrics.hitRate * 100).toFixed(2) + '%',
      avgResponseTime: metrics.averageResponseTime.toFixed(2) + 'ms'
    });
  }
  
  console.log('');
}

/**
 * Demonstrate Proxy Rotation Manager caching integration
 */
async function demonstrateProxyRotationCaching() {
  console.log('🌐 Proxy Rotation Manager Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.PROXY_ROTATION,
    operationType: 'health_metrics',
    priority: CachePriority.HIGH,
    tags: ['proxy', 'health', 'performance']
  };

  // Cache proxy health data
  const proxyHealthData = {
    proxyId: 'proxy_789',
    healthScore: 0.95,
    responseTime: 120,
    successRate: 0.98,
    lastChecked: new Date(),
    region: 'US-EAST'
  };

  await twikitCacheManager.set('proxy_health_789', proxyHealthData, context);
  console.log('  ✅ Proxy health data cached');

  // Cache proxy performance metrics
  const performanceData = {
    proxyId: 'proxy_789',
    averageResponseTime: 115,
    requestCount: 1000,
    errorRate: 0.02,
    bandwidth: '10Mbps'
  };

  const perfContext = { ...context, operationType: 'performance_metrics' };
  await twikitCacheManager.set('proxy_perf_789', performanceData, perfContext);
  console.log('  ✅ Proxy performance data cached');
  
  console.log('');
}

/**
 * Demonstrate Rate Limit Coordinator caching integration
 */
async function demonstrateRateLimitCaching() {
  console.log('⏱️ Rate Limit Coordinator Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.RATE_LIMIT_COORDINATOR,
    operationType: 'rate_limit_state',
    accountId: 'account_123',
    priority: CachePriority.CRITICAL,
    tags: ['rate_limit', 'state']
  };

  // Cache rate limit state
  const rateLimitState = {
    accountId: 'account_123',
    currentWindow: '2024-01-15T10:00:00Z',
    requestCount: 45,
    limit: 100,
    resetTime: new Date(Date.now() + 3600000),
    violationCount: 0
  };

  await twikitCacheManager.set('rate_limit_account_123', rateLimitState, context);
  console.log('  ✅ Rate limit state cached');

  // Cache account profile
  const profileData = {
    accountId: 'account_123',
    accountType: 'premium',
    customLimits: {
      tweets: 200,
      likes: 1000,
      follows: 50
    },
    riskScore: 0.1
  };

  const profileContext = { ...context, operationType: 'account_profile' };
  await twikitCacheManager.set('profile_account_123', profileData, profileContext);
  console.log('  ✅ Account profile cached');
  
  console.log('');
}

/**
 * Demonstrate Account Health Monitor caching integration
 */
async function demonstrateHealthMonitorCaching() {
  console.log('🏥 Account Health Monitor Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.ACCOUNT_HEALTH_MONITOR,
    operationType: 'health_profile',
    accountId: 'account_123',
    priority: CachePriority.HIGH,
    tags: ['health', 'monitoring', 'risk']
  };

  // Cache health profile
  const healthProfile = {
    accountId: 'account_123',
    overallHealthScore: 0.92,
    suspensionRiskScore: 0.08,
    lastAssessment: new Date(),
    riskFactors: ['high_activity_burst'],
    recommendations: ['reduce_posting_frequency']
  };

  await twikitCacheManager.set('health_profile_123', healthProfile, context);
  console.log('  ✅ Health profile cached');

  // Cache ML prediction
  const mlPrediction = {
    accountId: 'account_123',
    predictionType: 'suspension_risk',
    confidence: 0.87,
    prediction: 'low_risk',
    features: {
      activity_pattern: 'normal',
      engagement_rate: 'high',
      content_quality: 'good'
    }
  };

  const mlContext = { ...context, operationType: 'ml_prediction' };
  await twikitCacheManager.set('ml_pred_123', mlPrediction, mlContext);
  console.log('  ✅ ML prediction cached');
  
  console.log('');
}

/**
 * Demonstrate Anti-Detection Manager caching integration
 */
async function demonstrateAntiDetectionCaching() {
  console.log('🕵️ Anti-Detection Manager Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.ANTI_DETECTION_MANAGER,
    operationType: 'behavioral_signature',
    accountId: 'account_123',
    priority: CachePriority.HIGH,
    tags: ['behavioral', 'fingerprint', 'detection']
  };

  // Cache behavioral signature
  const behavioralSignature = {
    accountId: 'account_123',
    patterns: {
      typing_speed: 'medium',
      pause_patterns: 'human_like',
      interaction_timing: 'variable'
    },
    fingerprint: {
      browser: 'chrome_120',
      screen_resolution: '1920x1080',
      timezone: 'America/New_York'
    },
    lastUpdated: new Date()
  };

  await twikitCacheManager.set('behavior_sig_123', behavioralSignature, context);
  console.log('  ✅ Behavioral signature cached');
  
  console.log('');
}

/**
 * Demonstrate Campaign Orchestrator caching integration
 */
async function demonstrateCampaignCaching() {
  console.log('📢 Campaign Orchestrator Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.CAMPAIGN_ORCHESTRATOR,
    operationType: 'campaign_data',
    priority: CachePriority.NORMAL,
    tags: ['campaign', 'orchestration']
  };

  // Cache campaign data
  const campaignData = {
    campaignId: 'campaign_456',
    name: 'Product Launch Campaign',
    status: 'active',
    accounts: ['account_123', 'account_456'],
    schedule: {
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000),
      frequency: 'hourly'
    },
    content: {
      templates: ['template_1', 'template_2'],
      hashtags: ['#product', '#launch']
    }
  };

  await twikitCacheManager.set('campaign_456', campaignData, context);
  console.log('  ✅ Campaign data cached');
  
  console.log('');
}

/**
 * Demonstrate Content Safety Filter caching integration
 */
async function demonstrateContentSafetyCaching() {
  console.log('🛡️ Content Safety Filter Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.CONTENT_SAFETY_FILTER,
    operationType: 'analysis_result',
    priority: CachePriority.NORMAL,
    tags: ['content', 'safety', 'compliance']
  };

  // Cache content analysis result
  const analysisResult = {
    contentHash: 'hash_789',
    safetyScore: 0.95,
    flags: [],
    compliance: {
      gdpr: true,
      ccpa: true,
      coppa: true
    },
    recommendations: ['approved_for_posting'],
    analyzedAt: new Date()
  };

  await twikitCacheManager.set('content_analysis_789', analysisResult, context);
  console.log('  ✅ Content analysis result cached');
  
  console.log('');
}

/**
 * Demonstrate Connection Pool caching integration
 */
async function demonstrateConnectionPoolCaching() {
  console.log('🔗 Connection Pool Caching:');
  
  const context: CacheOperationContext = {
    serviceType: TwikitServiceType.CONNECTION_POOL,
    operationType: 'pool_state',
    priority: CachePriority.HIGH,
    tags: ['connection', 'pool', 'optimization']
  };

  // Cache connection pool state
  const poolState = {
    poolId: 'pool_main',
    activeConnections: 15,
    maxConnections: 50,
    queuedRequests: 3,
    averageResponseTime: 85,
    healthScore: 0.96,
    lastOptimized: new Date()
  };

  await twikitCacheManager.set('pool_state_main', poolState, context);
  console.log('  ✅ Connection pool state cached');
  
  console.log('');
}

/**
 * Demonstrate performance monitoring
 */
async function demonstratePerformanceMonitoring() {
  console.log('📊 Performance Monitoring:');
  
  // Get overall performance metrics
  const metrics = await twikitCacheManager.getPerformanceMetrics();
  console.log('  📈 Overall Cache Metrics:', {
    hitRate: (metrics.hitRate * 100).toFixed(2) + '%',
    missRate: (metrics.missRate * 100).toFixed(2) + '%',
    avgResponseTime: metrics.averageResponseTime.toFixed(2) + 'ms',
    memoryUsage: (metrics.memoryUsage * 100).toFixed(2) + '%'
  });

  // Get cache statistics
  const stats = twikitCacheManager.getCacheStatistics();
  console.log('  📊 Cache Statistics:', {
    serviceCacheManagers: stats.serviceCacheManagers,
    luaScripts: stats.luaScripts,
    isInitialized: stats.isInitialized
  });
  
  console.log('');
}

/**
 * Demonstrate advanced caching features
 */
async function demonstrateAdvancedFeatures() {
  console.log('🚀 Advanced Caching Features:');
  
  // Demonstrate cache clearing
  console.log('  🧹 Testing cache clearing...');
  await twikitCacheManager.clear(TwikitServiceType.SESSION_MANAGER);
  console.log('  ✅ Session manager cache cleared');
  
  // Demonstrate service-specific cache manager
  console.log('  🎯 Testing service-specific cache manager...');
  const proxyCache = twikitCacheManager.getServiceCacheManager(TwikitServiceType.PROXY_ROTATION);
  if (proxyCache) {
    await proxyCache.set('test_key', { test: 'data' });
    const retrieved = await proxyCache.get('test_key');
    console.log('  ✅ Service-specific cache working:', retrieved ? 'Success' : 'Failed');
  }
  
  console.log('');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateTwikitCacheIntegration()
    .then(() => {
      console.log('🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateTwikitCacheIntegration };
