/**
 * Test Configuration for Service Routing Pattern
 * 
 * Provides test-specific configurations for all services to enable
 * comprehensive testing without external dependencies.
 */

// ============================================================================
// TEST CONFIGURATIONS
// ============================================================================

export const testConfig = {
  // Core Backend Services
  coreBackend: {
    initializationTimeout: 30000, // 30 seconds
    healthCheckInterval: 5000,    // 5 seconds
    enableAllServices: true,
    logLevel: 'info'
  },

  // Cache Configuration
  cache: {
    provider: 'memory',
    ttl: 300,
    maxSize: 1000,
    enableDistributed: false
  },

  // Database Configuration
  database: {
    type: 'mock',
    connectionTimeout: 5000,
    queryTimeout: 10000,
    poolSize: 10
  },

  // Redis Configuration
  redis: {
    type: 'mock',
    connectionTimeout: 5000,
    retryAttempts: 3,
    retryDelay: 1000
  },

  // Rate Limiting
  rateLimiting: {
    enabled: false, // Disabled for testing
    windowMs: 60000,
    maxRequests: 100
  },

  // Anti-Detection
  antiDetection: {
    enabled: true,
    behaviorSimulation: true,
    fingerprintRotation: true,
    proxyRotation: false // Disabled for testing
  },

  // Content Safety
  contentSafety: {
    enabled: true,
    aiProviders: ['mock'],
    strictMode: false
  },

  // Analytics
  analytics: {
    enabled: true,
    realTimeProcessing: false,
    batchSize: 100
  },

  // Compliance
  compliance: {
    enabled: true,
    auditLevel: 'basic',
    realTimeMonitoring: false
  },

  // Emergency Stop
  emergencyStop: {
    enabled: true,
    triggers: ['manual'],
    autoRecovery: false
  }
};

// ============================================================================
// SERVICE INITIALIZATION ORDER
// ============================================================================

export const serviceInitializationOrder = [
  // Phase 1: Independent Services (no dependencies)
  'accountSimulatorService',
  'advancedCacheManager',
  'analyticsService',
  'contentSafetyFilter',
  'correlationManager',
  'databaseMonitor',
  'disasterRecoveryService',
  'enhancedApiClient',
  'enterpriseAuthService',
  'enterprisePythonProcessManager',
  'enterpriseServiceRegistry',
  'errorAnalyticsPlatform',
  'globalRateLimitCoordinator',
  'intelligentRetryEngine',
  'intelligentRetryManager',

  // Phase 2: Services with light dependencies
  'antiDetectionService',
  'campaignOrchestrator',
  'complianceAuditService',
  'complianceIntegrationService',

  // Phase 3: Services with heavy dependencies
  'emergencyStopSystem',
  'enterpriseAntiDetectionManager',
  'enterpriseDatabaseManager',
  'enterpriseServiceOrchestrator',

  // Phase 4: Monitoring and health services
  'accountHealthMonitor'
];

// ============================================================================
// TEST SCENARIOS
// ============================================================================

export const testScenarios = {
  // Basic functionality tests
  basic: {
    name: 'Basic Service Functionality',
    description: 'Test basic initialization and method calls for all services',
    timeout: 60000,
    services: 'all'
  },

  // Service routing tests
  routing: {
    name: 'Service Routing Pattern',
    description: 'Test that all service methods are properly routed through the controller',
    timeout: 30000,
    services: 'all'
  },

  // Error handling tests
  errorHandling: {
    name: 'Error Handling',
    description: 'Test error handling and graceful degradation',
    timeout: 30000,
    services: ['coreBackend', 'cache', 'database']
  },

  // Performance tests
  performance: {
    name: 'Performance Testing',
    description: 'Test service performance under load',
    timeout: 120000,
    services: ['cache', 'rateLimiting', 'analytics']
  },

  // Integration tests
  integration: {
    name: 'Service Integration',
    description: 'Test inter-service communication and dependencies',
    timeout: 90000,
    services: 'all'
  }
};

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockData = {
  // Mock user data
  users: [
    {
      id: 'test-user-1',
      username: 'testuser1',
      email: 'test1@example.com',
      telegramUserId: 123456789
    },
    {
      id: 'test-user-2',
      username: 'testuser2',
      email: 'test2@example.com',
      telegramUserId: 987654321
    }
  ],

  // Mock account data
  accounts: [
    {
      id: 'test-account-1',
      username: 'test_twitter_1',
      platform: 'twitter',
      isActive: true,
      userId: 'test-user-1'
    },
    {
      id: 'test-account-2',
      username: 'test_twitter_2',
      platform: 'twitter',
      isActive: true,
      userId: 'test-user-2'
    }
  ],

  // Mock content data
  content: [
    {
      id: 'test-content-1',
      content: 'This is a test tweet for content safety analysis',
      type: 'tweet',
      accountId: 'test-account-1'
    },
    {
      id: 'test-content-2',
      content: 'Another test tweet with different content',
      type: 'tweet',
      accountId: 'test-account-2'
    }
  ],

  // Mock campaign data
  campaigns: [
    {
      id: 'test-campaign-1',
      name: 'Test Campaign 1',
      description: 'A test campaign for service testing',
      status: 'active',
      userId: 'test-user-1'
    }
  ]
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

export const testUtils = {
  // Generate test correlation ID
  generateCorrelationId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Create test timeout
  createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${ms}ms`)), ms);
    });
  },

  // Wait for condition
  async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Measure execution time
  async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }
};

// ============================================================================
// EXPECTED RESULTS
// ============================================================================

export const expectedResults = {
  // Service initialization
  initialization: {
    maxTime: 30000, // 30 seconds
    requiredServices: serviceInitializationOrder.length,
    optionalServices: 0
  },

  // Health checks
  healthChecks: {
    maxResponseTime: 1000, // 1 second
    requiredHealthy: serviceInitializationOrder.length,
    allowedUnhealthy: 0
  },

  // Performance benchmarks
  performance: {
    cacheHitRate: 0.8, // 80%
    averageResponseTime: 100, // 100ms
    maxMemoryUsage: 512 * 1024 * 1024 // 512MB
  }
};
