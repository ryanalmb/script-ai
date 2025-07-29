/**
 * Twikit Session Manager Load Balancing and Horizontal Scaling Demo - Task 29
 * 
 * Demonstrates the enhanced TwikitSessionManager with:
 * - Multiple load balancing algorithms
 * - Horizontal scaling with automatic instance discovery
 * - Distributed session management
 * - Performance optimization and resource monitoring
 * - Integration with TwikitCacheManager
 */

import { 
  twikitSessionManager,
  LoadBalancingAlgorithm,
  type TwikitSessionOptions,
  type SessionManagerInstance,
  type LoadBalancerState,
  type ResourceMetrics,
  type ScalingEvent
} from '../src/services/twikitSessionManager';
import { logger } from '../src/utils/logger';

/**
 * Comprehensive Load Balancing and Scaling Demo
 */
async function demonstrateLoadBalancingAndScaling() {
  console.log('\n🚀 Starting Twikit Session Manager Load Balancing and Scaling Demo...\n');

  try {
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    console.log('📋 Step 1: Initialize Enhanced Session Manager');
    await twikitSessionManager.initializeEnhancedSessionManager();
    console.log('✅ Enhanced session manager initialized successfully\n');

    // ========================================================================
    // LOAD BALANCING DEMONSTRATION
    // ========================================================================

    console.log('📋 Step 2: Demonstrate Load Balancing Algorithms\n');

    // Test different load balancing algorithms
    await demonstrateLoadBalancingAlgorithms();
    
    // Show load balancer status
    await demonstrateLoadBalancerStatus();
    
    // Test session affinity
    await demonstrateSessionAffinity();

    // ========================================================================
    // HORIZONTAL SCALING DEMONSTRATION
    // ========================================================================

    console.log('📋 Step 3: Demonstrate Horizontal Scaling\n');
    
    // Show scaling configuration
    await demonstrateScalingConfiguration();
    
    // Simulate load and scaling events
    await demonstrateScalingEvents();
    
    // Show resource monitoring
    await demonstrateResourceMonitoring();

    // ========================================================================
    // DISTRIBUTED SESSION MANAGEMENT
    // ========================================================================

    console.log('📋 Step 4: Demonstrate Distributed Session Management\n');
    
    // Show instance discovery
    await demonstrateInstanceDiscovery();
    
    // Test session distribution
    await demonstrateSessionDistribution();
    
    // Show performance optimization
    await demonstratePerformanceOptimization();

    console.log('✅ Load Balancing and Scaling Demo completed successfully!\n');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

/**
 * Demonstrate different load balancing algorithms
 */
async function demonstrateLoadBalancingAlgorithms() {
  console.log('⚖️ Load Balancing Algorithms:');
  
  const algorithms = [
    LoadBalancingAlgorithm.ROUND_ROBIN,
    LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN,
    LoadBalancingAlgorithm.LEAST_CONNECTIONS,
    LoadBalancingAlgorithm.HEALTH_BASED
  ];

  for (const algorithm of algorithms) {
    console.log(`  🔄 Testing ${algorithm} algorithm:`);
    
    // Update load balancing configuration
    await twikitSessionManager.updateLoadBalancingConfig({
      algorithm: algorithm
    });

    // Simulate session creation with load balancing
    const sessionOptions: TwikitSessionOptions = {
      accountId: `test_account_${algorithm}`,
      credentials: {
        username: 'test_user',
        email: 'test@example.com',
        password: 'test_password'
      },
      enableHealthMonitoring: true,
      enableAntiDetection: true
    };

    try {
      // In a real scenario, this would route to the best instance
      const selectedInstance = await twikitSessionManager.selectInstanceForSession(
        sessionOptions.accountId,
        '192.168.1.100'
      );

      if (selectedInstance) {
        console.log(`    ✅ Selected instance: ${selectedInstance.instanceId}`);
        console.log(`    📊 Instance load: ${selectedInstance.currentLoad}%`);
        console.log(`    🔢 Session count: ${selectedInstance.sessionCount}`);
      } else {
        console.log(`    ⚠️ No suitable instance found`);
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log('');
}

/**
 * Demonstrate load balancer status
 */
async function demonstrateLoadBalancerStatus() {
  console.log('📊 Load Balancer Status:');
  
  const status: LoadBalancerState = twikitSessionManager.getLoadBalancerStatus();
  
  console.log('  📈 Current Status:', {
    algorithm: status.currentAlgorithm,
    activeInstances: status.activeInstances.length,
    totalSessions: status.totalSessions,
    totalCapacity: status.totalCapacity,
    averageLoad: status.averageLoad.toFixed(2) + '%',
    healthyInstances: status.healthyInstances
  });

  console.log('  ⚡ Performance Metrics:', {
    requestsPerSecond: status.performanceMetrics.requestsPerSecond,
    averageResponseTime: status.performanceMetrics.averageResponseTime.toFixed(2) + 'ms',
    errorRate: status.performanceMetrics.errorRate.toFixed(2) + '%',
    throughput: status.performanceMetrics.throughput
  });
  
  console.log('');
}

/**
 * Demonstrate session affinity
 */
async function demonstrateSessionAffinity() {
  console.log('🔗 Session Affinity:');
  
  // Enable session affinity
  await twikitSessionManager.updateLoadBalancingConfig({
    sessionAffinity: true,
    affinityTimeout: 3600000 // 1 hour
  });

  const accountId = 'sticky_session_test';
  
  // First request - should select an instance
  const firstInstance = await twikitSessionManager.selectInstanceForSession(accountId);
  console.log(`  🎯 First request routed to: ${firstInstance?.instanceId || 'none'}`);
  
  // Second request - should use same instance due to affinity
  const secondInstance = await twikitSessionManager.selectInstanceForSession(accountId);
  console.log(`  🎯 Second request routed to: ${secondInstance?.instanceId || 'none'}`);
  
  const affinityWorking = firstInstance?.instanceId === secondInstance?.instanceId;
  console.log(`  ✅ Session affinity working: ${affinityWorking ? 'Yes' : 'No'}`);
  
  console.log('');
}

/**
 * Demonstrate scaling configuration
 */
async function demonstrateScalingConfiguration() {
  console.log('📏 Horizontal Scaling Configuration:');
  
  const config = twikitSessionManager.getScalingConfig();
  
  console.log('  ⚙️ Current Configuration:', {
    enabled: config.enabled,
    minInstances: config.minInstances,
    maxInstances: config.maxInstances,
    targetCpuUtilization: config.targetCpuUtilization + '%',
    targetMemoryUtilization: config.targetMemoryUtilization + '%',
    targetSessionsPerInstance: config.targetSessionsPerInstance,
    scaleUpThreshold: config.scaleUpThreshold + '%',
    scaleDownThreshold: config.scaleDownThreshold + '%'
  });

  // Update scaling configuration
  await twikitSessionManager.updateScalingConfig({
    targetCpuUtilization: 75,
    targetMemoryUtilization: 85,
    scaleUpThreshold: 85,
    scaleDownThreshold: 25
  });

  console.log('  ✅ Scaling configuration updated');
  console.log('');
}

/**
 * Demonstrate scaling events
 */
async function demonstrateScalingEvents() {
  console.log('📈 Scaling Events:');
  
  // Get recent scaling events
  const events: ScalingEvent[] = twikitSessionManager.getScalingEvents(10);
  
  if (events.length > 0) {
    console.log(`  📋 Recent scaling events (${events.length}):`);
    events.forEach((event, index) => {
      console.log(`    ${index + 1}. ${event.eventType.toUpperCase()}`);
      console.log(`       🕐 Time: ${event.timestamp.toISOString()}`);
      console.log(`       📝 Reason: ${event.reason}`);
      console.log(`       ✅ Success: ${event.success ? 'Yes' : 'No'}`);
      if (event.instanceId) {
        console.log(`       🖥️ Instance: ${event.instanceId}`);
      }
    });
  } else {
    console.log('  📋 No scaling events recorded yet');
  }

  // Listen for scaling events
  twikitSessionManager.on('scaleUpRequested', (data) => {
    console.log('  🚀 Scale-up requested:', {
      eventId: data.eventId,
      currentInstances: data.currentInstances,
      targetInstances: data.targetInstances,
      reason: data.reason
    });
  });

  twikitSessionManager.on('scaleDownRequested', (data) => {
    console.log('  🔽 Scale-down requested:', {
      eventId: data.eventId,
      instanceId: data.instanceId,
      reason: data.reason
    });
  });
  
  console.log('');
}

/**
 * Demonstrate resource monitoring
 */
async function demonstrateResourceMonitoring() {
  console.log('📊 Resource Monitoring:');
  
  const metrics: ResourceMetrics = twikitSessionManager.getResourceMetrics();
  
  console.log('  💻 Current Resource Metrics:', {
    instanceId: metrics.instanceId,
    timestamp: metrics.timestamp.toISOString(),
    cpuUsage: metrics.cpuUsage.toFixed(2) + '%',
    memoryUsage: metrics.memoryUsage.toFixed(2) + '%',
    sessionCount: metrics.sessionCount,
    activeConnections: metrics.activeConnections,
    requestsPerSecond: metrics.requestsPerSecond,
    averageResponseTime: metrics.averageResponseTime.toFixed(2) + 'ms',
    errorRate: metrics.errorRate.toFixed(2) + '%'
  });

  console.log('  🔧 Custom Metrics:', {
    processUptime: metrics.customMetrics.processUptime + 's',
    eventLoopDelay: metrics.customMetrics.eventLoopDelay + 'ms',
    gcCount: metrics.customMetrics.gcCount
  });
  
  console.log('');
}

/**
 * Demonstrate instance discovery
 */
async function demonstrateInstanceDiscovery() {
  console.log('🔍 Instance Discovery:');
  
  const instances: SessionManagerInstance[] = twikitSessionManager.getActiveInstances();
  
  console.log(`  🖥️ Active Instances (${instances.length}):`);
  instances.forEach((instance, index) => {
    console.log(`    ${index + 1}. Instance: ${instance.instanceId}`);
    console.log(`       🏠 Hostname: ${instance.hostname}`);
    console.log(`       🌍 Region: ${instance.region}`);
    console.log(`       ❤️ Healthy: ${instance.isHealthy ? 'Yes' : 'No'}`);
    console.log(`       ⚖️ Weight: ${instance.weight}`);
    console.log(`       📊 Load: ${instance.currentLoad}%`);
    console.log(`       🔢 Sessions: ${instance.sessionCount}/${instance.maxCapacity}`);
    console.log(`       💓 Last Heartbeat: ${instance.lastHeartbeat.toISOString()}`);
  });
  
  console.log('');
}

/**
 * Demonstrate session distribution
 */
async function demonstrateSessionDistribution() {
  console.log('🔄 Session Distribution:');
  
  // Force rebalance to demonstrate load balancing
  await twikitSessionManager.forceRebalance();
  console.log('  ✅ Force rebalance completed');
  
  // Listen for session migration events
  twikitSessionManager.on('sessionMigrationRequested', (data) => {
    console.log('  🔄 Session migration requested:', {
      fromInstance: data.fromInstance,
      toInstances: data.toInstances.length,
      sessionCount: data.sessionCount,
      reason: data.reason
    });
  });

  twikitSessionManager.on('loadRebalanced', (data) => {
    console.log('  ⚖️ Load rebalanced:', {
      instanceCount: data.instanceCount,
      loadVariance: data.loadVariance,
      timestamp: data.timestamp.toISOString()
    });
  });
  
  console.log('');
}

/**
 * Demonstrate performance optimization
 */
async function demonstratePerformanceOptimization() {
  console.log('⚡ Performance Optimization:');
  
  const status = twikitSessionManager.getLoadBalancerStatus();
  
  console.log('  📈 Optimization Metrics:', {
    totalCapacityUtilization: status.totalSessions > 0 
      ? ((status.totalSessions / status.totalCapacity) * 100).toFixed(2) + '%'
      : '0%',
    loadDistribution: status.averageLoad.toFixed(2) + '%',
    healthyInstanceRatio: status.activeInstances.length > 0
      ? ((status.healthyInstances / status.activeInstances.length) * 100).toFixed(2) + '%'
      : '0%',
    failoverCount: status.failoverCount,
    lastRebalance: status.lastRebalance.toISOString()
  });

  console.log('  🎯 Performance Recommendations:');
  
  if (status.averageLoad > 80) {
    console.log('    ⚠️ High average load detected - consider scaling up');
  } else if (status.averageLoad < 30) {
    console.log('    💡 Low average load detected - consider scaling down');
  } else {
    console.log('    ✅ Load levels are optimal');
  }

  if (status.healthyInstances < status.activeInstances.length) {
    console.log('    ⚠️ Some instances are unhealthy - check instance health');
  } else {
    console.log('    ✅ All instances are healthy');
  }
  
  console.log('');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateLoadBalancingAndScaling()
    .then(() => {
      console.log('🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateLoadBalancingAndScaling };
