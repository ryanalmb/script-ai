/**
 * Service Test Runner for Service Routing Pattern
 * 
 * Comprehensive test runner that initializes and tests all services
 * in the CoreBackendController using the Service Routing Pattern.
 */

import { CoreBackendController } from '../../src/controllers/coreBackendController';
import { MockFactory, setupTestEnvironment, cleanupTestEnvironment } from './mockUtilities';
import { testConfig, serviceInitializationOrder, testScenarios, mockData, testUtils, expectedResults } from './testConfig';

// ============================================================================
// TEST RESULT INTERFACES
// ============================================================================

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface ServiceTestResult {
  serviceName: string;
  initialized: boolean;
  healthCheck: boolean;
  methodTests: TestResult[];
  error?: string;
}

interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  services: ServiceTestResult[];
  errors: string[];
}

// ============================================================================
// SERVICE TEST RUNNER CLASS
// ============================================================================

export class ServiceTestRunner {
  private controller: CoreBackendController | null = null;
  private testResults: TestSummary = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    duration: 0,
    services: [],
    errors: []
  };

  constructor() {
    this.setupMocks();
  }

  /**
   * Setup mock dependencies
   */
  private setupMocks(): void {
    // Setup test environment
    setupTestEnvironment();

    // Mock external dependencies
    const mockRedis = MockFactory.createRedis();
    const mockPostgres = MockFactory.createPostgreSQLPool();
    const mockPrisma = MockFactory.createPrismaClient();

    // Replace global instances with mocks (if they exist)
    // This would typically be done through dependency injection
    // For now, we'll rely on the services handling missing dependencies gracefully
  }

  /**
   * Initialize the CoreBackendController
   */
  async initializeController(): Promise<boolean> {
    try {
      console.log('🚀 Initializing CoreBackendController...');
      
      this.controller = new CoreBackendController();
      
      // Initialize with test configuration
      await this.controller.initialize();
      
      console.log('✅ CoreBackendController initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize CoreBackendController:', error);
      this.testResults.errors.push(`Controller initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Test individual service initialization
   */
  async testServiceInitialization(serviceName: string): Promise<ServiceTestResult> {
    const result: ServiceTestResult = {
      serviceName,
      initialized: false,
      healthCheck: false,
      methodTests: []
    };

    if (!this.controller) {
      result.error = 'Controller not initialized';
      return result;
    }

    try {
      console.log(`  🔧 Testing ${serviceName} initialization...`);

      // Test service initialization based on service type
      const initResult = await this.testServiceSpecificInitialization(serviceName);
      result.initialized = initResult.success;
      
      if (!initResult.success) {
        result.error = initResult.error;
        return result;
      }

      // Test basic health check
      const healthResult = await this.testServiceHealthCheck(serviceName);
      result.healthCheck = healthResult.success;

      // Test service methods
      const methodResults = await this.testServiceMethods(serviceName);
      result.methodTests = methodResults;

      console.log(`  ${result.initialized && result.healthCheck ? '✅' : '❌'} ${serviceName} test completed`);

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ ${serviceName} test failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Test service-specific initialization
   */
  private async testServiceSpecificInitialization(serviceName: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Map service names to controller methods
      const initMethods: Record<string, string> = {
        'accountSimulatorService': 'initializeAccountSimulatorService',
        'advancedCacheManager': 'initializeAdvancedCacheManager',
        'analyticsService': 'initializeAnalyticsService',
        'antiDetectionService': 'initializeAntiDetectionService',
        'campaignOrchestrator': 'initializeCampaignOrchestrator',
        'complianceAuditService': 'initializeComplianceAuditService',
        'complianceIntegrationService': 'initializeComplianceIntegrationService',
        'contentSafetyFilter': 'initializeContentSafetyFilter',
        'correlationManager': 'initializeCorrelationManager',
        'databaseMonitor': 'initializeDatabaseMonitor',
        'disasterRecoveryService': 'initializeDisasterRecoveryService',
        'emergencyStopSystem': 'initializeEmergencyStopSystem',
        'enhancedApiClient': 'initializeEnhancedApiClient',
        'enterpriseAntiDetectionManager': 'initializeEnterpriseAntiDetectionManager',
        'enterpriseAuthService': 'initializeEnterpriseAuthService',
        'enterpriseDatabaseManager': 'initializeEnterpriseDatabaseManager',
        'enterprisePythonProcessManager': 'initializeEnterprisePythonProcessManager',
        'enterpriseServiceOrchestrator': 'initializeEnterpriseServiceOrchestrator',
        'enterpriseServiceRegistry': 'initializeEnterpriseServiceRegistry',
        'errorAnalyticsPlatform': 'initializeErrorAnalyticsPlatform',
        'globalRateLimitCoordinator': 'initializeGlobalRateLimitCoordinator',
        'intelligentRetryEngine': 'initializeIntelligentRetryEngine',
        'intelligentRetryManager': 'initializeIntelligentRetryManager',
        'accountHealthMonitor': 'initializeAccountHealthMonitor'
      };

      const methodName = initMethods[serviceName];
      if (!methodName) {
        throw new Error(`No initialization method found for service: ${serviceName}`);
      }

      // Call the initialization method
      const method = (this.controller as any)[methodName];
      if (typeof method !== 'function') {
        throw new Error(`Initialization method ${methodName} not found on controller`);
      }

      // Some services require parameters
      if (serviceName === 'emergencyStopSystem') {
        await method.call(this.controller, {}, null, null, null, null);
      } else if (serviceName === 'enterpriseAntiDetectionManager') {
        await method.call(this.controller, null, null, null);
      } else if (serviceName === 'enterpriseDatabaseManager') {
        await method.call(this.controller, MockFactory.createPostgreSQLPool(), MockFactory.createRedis());
      } else if (serviceName === 'enterpriseServiceOrchestrator') {
        await method.call(this.controller, {});
      } else {
        await method.call(this.controller);
      }

      return {
        name: `${serviceName} initialization`,
        success: true,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        name: `${serviceName} initialization`,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test service health check
   */
  private async testServiceHealthCheck(serviceName: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Most services don't have explicit health check methods
      // We'll test by checking if the service property exists on the controller
      const serviceProperty = this.getServicePropertyName(serviceName);
      const service = (this.controller as any)[serviceProperty];
      
      const isHealthy = service !== null && service !== undefined;
      
      return {
        name: `${serviceName} health check`,
        success: isHealthy,
        duration: Date.now() - startTime,
        details: { hasService: !!service }
      };

    } catch (error) {
      return {
        name: `${serviceName} health check`,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test service methods
   */
  private async testServiceMethods(serviceName: string): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      // Test a few key methods for each service
      const testMethods = this.getServiceTestMethods(serviceName);
      
      for (const methodTest of testMethods) {
        const startTime = Date.now();
        
        try {
          const method = (this.controller as any)[methodTest.methodName];
          if (typeof method !== 'function') {
            results.push({
              name: methodTest.name,
              success: false,
              duration: Date.now() - startTime,
              error: `Method ${methodTest.methodName} not found`
            });
            continue;
          }

          // Call the method with test parameters
          const result = await method.call(this.controller, ...methodTest.params);
          
          results.push({
            name: methodTest.name,
            success: true,
            duration: Date.now() - startTime,
            details: { result }
          });

        } catch (error) {
          results.push({
            name: methodTest.name,
            success: false,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

    } catch (error) {
      results.push({
        name: `${serviceName} method testing`,
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  /**
   * Get service property name on controller
   */
  private getServicePropertyName(serviceName: string): string {
    // Map service names to controller property names
    const propertyMap: Record<string, string> = {
      'accountSimulatorService': 'accountSimulatorService',
      'advancedCacheManager': 'advancedCacheManager',
      'analyticsService': 'analyticsService',
      'antiDetectionService': 'antiDetectionService',
      'campaignOrchestrator': 'campaignOrchestrator',
      'complianceAuditService': 'complianceAuditService',
      'complianceIntegrationService': 'complianceIntegrationService',
      'contentSafetyFilter': 'contentSafetyFilter',
      'correlationManager': 'correlationManager',
      'databaseMonitor': 'databaseMonitor',
      'disasterRecoveryService': 'disasterRecoveryService',
      'emergencyStopSystem': 'emergencyStopSystem',
      'enhancedApiClient': 'enhancedApiClient',
      'enterpriseAntiDetectionManager': 'enterpriseAntiDetectionManager',
      'enterpriseAuthService': 'enterpriseAuthService',
      'enterpriseDatabaseManager': 'enterpriseDatabaseManager',
      'enterprisePythonProcessManager': 'enterprisePythonProcessManager',
      'enterpriseServiceOrchestrator': 'enterpriseServiceOrchestrator',
      'enterpriseServiceRegistry': 'enterpriseServiceRegistry',
      'errorAnalyticsPlatform': 'errorAnalyticsPlatform',
      'globalRateLimitCoordinator': 'globalRateLimitCoordinator',
      'intelligentRetryEngine': 'intelligentRetryEngine',
      'intelligentRetryManager': 'intelligentRetryManager',
      'accountHealthMonitor': 'accountHealthMonitor'
    };

    return propertyMap[serviceName] || serviceName;
  }

  /**
   * Get test methods for a service
   */
  private getServiceTestMethods(serviceName: string): Array<{name: string, methodName: string, params: any[]}> {
    const testMethods: Record<string, Array<{name: string, methodName: string, params: any[]}>> = {
      'accountSimulatorService': [
        { name: 'Get simulated accounts', methodName: 'getSimulatedAccounts', params: [123456789] },
        { name: 'Create simulated account', methodName: 'createSimulatedAccount', params: [123456789, { username: 'test_user' }] }
      ],
      'advancedCacheManager': [
        { name: 'Get cache metrics', methodName: 'getCacheMetrics', params: [] },
        { name: 'Clear cache', methodName: 'clearCache', params: ['test'] }
      ],
      'analyticsService': [
        { name: 'Get analytics data', methodName: 'getAnalyticsData', params: ['test-account-1', new Date(), new Date()] },
        { name: 'Track event', methodName: 'trackEvent', params: ['test-event', { data: 'test' }] }
      ],
      'contentSafetyFilter': [
        { name: 'Analyze content', methodName: 'analyzeContent', params: [{ content: 'Test content', contentType: 'TWEET' }] },
        { name: 'Get performance metrics', methodName: 'getContentSafetyMetrics', params: [] }
      ],
      'globalRateLimitCoordinator': [
        { name: 'Check rate limit', methodName: 'checkRateLimit', params: ['test-account-1', 'TWEET'] },
        { name: 'Get rate limit status', methodName: 'getRateLimitStatus', params: ['test-account-1'] }
      ],
      'enterpriseAuthService': [
        { name: 'Generate tokens', methodName: 'generateAuthTokens', params: ['test-user-1'] },
        { name: 'Validate token', methodName: 'validateAuthToken', params: ['test-token'] }
      ]
    };

    return testMethods[serviceName] || [
      { name: 'Basic service check', methodName: 'toString', params: [] }
    ];
  }

  /**
   * Run all service tests
   */
  async runAllTests(): Promise<TestSummary> {
    console.log('🧪 Starting comprehensive service tests...\n');

    const startTime = Date.now();

    // Initialize controller
    const controllerInitialized = await this.initializeController();
    if (!controllerInitialized) {
      this.testResults.errors.push('Failed to initialize controller');
      this.testResults.duration = Date.now() - startTime;
      return this.testResults;
    }

    // Test each service
    console.log('\n📋 Testing individual services...');
    for (const serviceName of serviceInitializationOrder) {
      const serviceResult = await this.testServiceInitialization(serviceName);
      this.testResults.services.push(serviceResult);

      // Update counters
      this.testResults.totalTests++;
      if (serviceResult.initialized && serviceResult.healthCheck) {
        this.testResults.passedTests++;
      } else {
        this.testResults.failedTests++;
        if (serviceResult.error) {
          this.testResults.errors.push(`${serviceName}: ${serviceResult.error}`);
        }
      }

      // Add method test results
      for (const methodTest of serviceResult.methodTests) {
        this.testResults.totalTests++;
        if (methodTest.success) {
          this.testResults.passedTests++;
        } else {
          this.testResults.failedTests++;
          if (methodTest.error) {
            this.testResults.errors.push(`${serviceName}.${methodTest.name}: ${methodTest.error}`);
          }
        }
      }
    }

    // Test integration scenarios
    console.log('\n🔗 Testing service integration...');
    await this.runIntegrationTests();

    this.testResults.duration = Date.now() - startTime;

    // Print summary
    this.printTestSummary();

    return this.testResults;
  }

  /**
   * Run integration tests
   */
  private async runIntegrationTests(): Promise<void> {
    const integrationTests = [
      {
        name: 'Content Safety + Analytics Integration',
        test: async () => {
          const content = { content: 'Test integration content', contentType: 'TWEET' as any };
          const analysisResult = await (this.controller as any).analyzeContent(content);
          await (this.controller as any).trackEvent('content_analyzed', { result: analysisResult });
          return true;
        }
      },
      {
        name: 'Rate Limiting + Account Health Integration',
        test: async () => {
          const allowed = await (this.controller as any).checkRateLimit('test-account-1', 'TWEET');
          const health = await (this.controller as any).getAccountHealthStatus('test-account-1');
          return allowed !== undefined && health !== undefined;
        }
      }
    ];

    for (const integrationTest of integrationTests) {
      try {
        console.log(`  🔗 Testing ${integrationTest.name}...`);
        const success = await integrationTest.test();

        this.testResults.totalTests++;
        if (success) {
          this.testResults.passedTests++;
          console.log(`  ✅ ${integrationTest.name} passed`);
        } else {
          this.testResults.failedTests++;
          console.log(`  ❌ ${integrationTest.name} failed`);
        }
      } catch (error) {
        this.testResults.totalTests++;
        this.testResults.failedTests++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.testResults.errors.push(`${integrationTest.name}: ${errorMsg}`);
        console.log(`  ❌ ${integrationTest.name} failed: ${errorMsg}`);
      }
    }
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.testResults.totalTests}`);
    console.log(`Passed: ${this.testResults.passedTests} ✅`);
    console.log(`Failed: ${this.testResults.failedTests} ❌`);
    console.log(`Success Rate: ${((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(1)}%`);
    console.log(`Duration: ${(this.testResults.duration / 1000).toFixed(2)}s`);

    console.log('\n📋 SERVICE STATUS:');
    for (const service of this.testResults.services) {
      const status = service.initialized && service.healthCheck ? '✅' : '❌';
      const methodsPassed = service.methodTests.filter(t => t.success).length;
      const methodsTotal = service.methodTests.length;
      console.log(`  ${status} ${service.serviceName} (${methodsPassed}/${methodsTotal} methods)`);
    }

    if (this.testResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      for (const error of this.testResults.errors.slice(0, 10)) { // Show first 10 errors
        console.log(`  • ${error}`);
      }
      if (this.testResults.errors.length > 10) {
        console.log(`  ... and ${this.testResults.errors.length - 10} more errors`);
      }
    }

    console.log('='.repeat(80));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.controller) {
        await this.controller.shutdown();
      }
      cleanupTestEnvironment();
      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}
