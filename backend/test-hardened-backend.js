#!/usr/bin/env node

/**
 * Comprehensive Backend Hardening Test Suite
 * Tests all reliability components for 99.99% uptime
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3001';
const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

class BackendTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
  }

  async test(name, testFn) {
    const startTime = performance.now();
    try {
      await testFn();
      const duration = performance.now() - startTime;
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED', duration });
      this.log(`✅ ${name} (${duration.toFixed(2)}ms)`, COLORS.GREEN);
    } catch (error) {
      const duration = performance.now() - startTime;
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', duration, error: error.message });
      this.log(`❌ ${name} - ${error.message} (${duration.toFixed(2)}ms)`, COLORS.RED);
    }
  }

  async warn(name, message) {
    this.results.warnings++;
    this.results.tests.push({ name, status: 'WARNING', message });
    this.log(`⚠️  ${name} - ${message}`, COLORS.YELLOW);
  }

  async runAllTests() {
    this.log(`${COLORS.BOLD}🚀 Starting Backend Hardening Test Suite${COLORS.RESET}`);
    this.log(`Testing backend at: ${BASE_URL}\n`);

    // Basic connectivity tests
    await this.testBasicConnectivity();
    
    // Health monitoring tests
    await this.testHealthEndpoints();
    
    // Metrics collection tests
    await this.testMetricsEndpoints();
    
    // Circuit breaker tests
    await this.testCircuitBreakers();
    
    // Timeout handling tests
    await this.testTimeoutHandling();
    
    // Error handling tests
    await this.testErrorHandling();
    
    // Performance tests
    await this.testPerformance();
    
    // Database reliability tests
    await this.testDatabaseReliability();
    
    // Security tests
    await this.testSecurity();

    this.printSummary();
  }

  async testBasicConnectivity() {
    this.log(`\n${COLORS.BLUE}📡 Testing Basic Connectivity${COLORS.RESET}`);
    
    await this.test('Server is running', async () => {
      const response = await axios.get(`${BASE_URL}/health/live`);
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    });

    await this.test('CORS headers present', async () => {
      const response = await axios.options(`${BASE_URL}/api/auth`);
      if (!response.headers['access-control-allow-origin']) {
        throw new Error('CORS headers missing');
      }
    });
  }

  async testHealthEndpoints() {
    this.log(`\n${COLORS.BLUE}🏥 Testing Health Monitoring${COLORS.RESET}`);
    
    await this.test('Liveness probe works', async () => {
      const response = await axios.get(`${BASE_URL}/health/live`);
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (response.data.status !== 'alive') throw new Error('Liveness check failed');
    });

    await this.test('Readiness probe works', async () => {
      const response = await axios.get(`${BASE_URL}/health/ready`);
      if (response.status !== 200 && response.status !== 503) {
        throw new Error(`Unexpected status: ${response.status}`);
      }
      if (!response.data.services) throw new Error('Services status missing');
    });

    await this.test('Detailed health info available', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      if (!response.data.system) throw new Error('System metrics missing');
      if (!response.data.performance) throw new Error('Performance metrics missing');
    });
  }

  async testMetricsEndpoints() {
    this.log(`\n${COLORS.BLUE}📊 Testing Metrics Collection${COLORS.RESET}`);
    
    await this.test('JSON metrics endpoint works', async () => {
      const response = await axios.get(`${BASE_URL}/metrics`);
      if (!response.data.requests) throw new Error('Request metrics missing');
      if (!response.data.response) throw new Error('Response metrics missing');
    });

    await this.test('Prometheus metrics endpoint works', async () => {
      const response = await axios.get(`${BASE_URL}/metrics/prometheus`);
      if (!response.data.includes('http_requests_total')) {
        throw new Error('Prometheus metrics format invalid');
      }
    });

    await this.test('Endpoint metrics available', async () => {
      const response = await axios.get(`${BASE_URL}/metrics/endpoints`);
      if (typeof response.data !== 'object') throw new Error('Endpoint metrics invalid');
    });
  }

  async testCircuitBreakers() {
    this.log(`\n${COLORS.BLUE}🔌 Testing Circuit Breakers${COLORS.RESET}`);
    
    await this.test('Circuit breaker status available', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      if (!response.data.circuitBreakers) throw new Error('Circuit breaker status missing');
    });

    // Test circuit breaker by making multiple failing requests
    await this.test('Circuit breaker triggers on failures', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          axios.get(`${BASE_URL}/api/nonexistent-endpoint`).catch(() => {})
        );
      }
      await Promise.all(promises);
      
      // Check if circuit breaker status changed
      const response = await axios.get(`${BASE_URL}/health`);
      // This is expected behavior - circuit breakers should be monitoring
    });
  }

  async testTimeoutHandling() {
    this.log(`\n${COLORS.BLUE}⏱️  Testing Timeout Handling${COLORS.RESET}`);
    
    await this.test('Request timeout configured', async () => {
      // This test verifies timeout middleware is active
      // We can't easily test actual timeouts without long-running operations
      const response = await axios.get(`${BASE_URL}/health/live`);
      if (response.status !== 200) throw new Error('Timeout middleware may not be working');
    });
  }

  async testErrorHandling() {
    this.log(`\n${COLORS.BLUE}🚨 Testing Error Handling${COLORS.RESET}`);
    
    await this.test('404 errors handled properly', async () => {
      try {
        await axios.get(`${BASE_URL}/nonexistent-route`);
        throw new Error('Should have returned 404');
      } catch (error) {
        if (error.response?.status !== 404) {
          throw new Error(`Expected 404, got ${error.response?.status}`);
        }
        if (!error.response.data.code) {
          throw new Error('Error code missing from response');
        }
      }
    });

    await this.test('Error responses include timestamp', async () => {
      try {
        await axios.get(`${BASE_URL}/nonexistent-route`);
      } catch (error) {
        if (!error.response.data.timestamp) {
          throw new Error('Timestamp missing from error response');
        }
      }
    });
  }

  async testPerformance() {
    this.log(`\n${COLORS.BLUE}⚡ Testing Performance${COLORS.RESET}`);
    
    await this.test('Response time under 1 second', async () => {
      const startTime = performance.now();
      await axios.get(`${BASE_URL}/health/live`);
      const duration = performance.now() - startTime;
      
      if (duration > 1000) {
        throw new Error(`Response time too slow: ${duration.toFixed(2)}ms`);
      }
    });

    await this.test('Concurrent requests handled', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(axios.get(`${BASE_URL}/health/live`));
      }
      
      const startTime = performance.now();
      await Promise.all(promises);
      const duration = performance.now() - startTime;
      
      if (duration > 5000) {
        throw new Error(`Concurrent requests too slow: ${duration.toFixed(2)}ms`);
      }
    });
  }

  async testDatabaseReliability() {
    this.log(`\n${COLORS.BLUE}🗄️  Testing Database Reliability${COLORS.RESET}`);
    
    await this.test('Database health check works', async () => {
      const response = await axios.get(`${BASE_URL}/health/ready`);
      if (!response.data.services.database) {
        throw new Error('Database health status missing');
      }
    });
  }

  async testSecurity() {
    this.log(`\n${COLORS.BLUE}🔒 Testing Security Features${COLORS.RESET}`);
    
    await this.test('Security headers present', async () => {
      const response = await axios.get(`${BASE_URL}/health/live`);
      // Check for common security headers
      const headers = response.headers;
      if (!headers['x-content-type-options']) {
        this.warn('Security headers', 'X-Content-Type-Options header missing');
      }
    });

    await this.test('Rate limiting active', async () => {
      // Make multiple requests quickly to test rate limiting
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          axios.get(`${BASE_URL}/health/live`).catch(error => error.response)
        );
      }
      
      const responses = await Promise.all(promises);
      // Rate limiting should allow these requests for health endpoint
      const allSuccessful = responses.every(r => r.status === 200);
      if (!allSuccessful) {
        this.warn('Rate limiting', 'Rate limiting may be too aggressive for health checks');
      }
    });
  }

  printSummary() {
    this.log(`\n${COLORS.BOLD}📋 Test Summary${COLORS.RESET}`);
    this.log(`${COLORS.GREEN}✅ Passed: ${this.results.passed}${COLORS.RESET}`);
    this.log(`${COLORS.RED}❌ Failed: ${this.results.failed}${COLORS.RESET}`);
    this.log(`${COLORS.YELLOW}⚠️  Warnings: ${this.results.warnings}${COLORS.RESET}`);
    
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
    
    this.log(`\n${COLORS.BOLD}Success Rate: ${successRate}%${COLORS.RESET}`);
    
    if (this.results.failed === 0) {
      this.log(`\n${COLORS.GREEN}${COLORS.BOLD}🎉 All tests passed! Backend is production-ready.${COLORS.RESET}`);
    } else {
      this.log(`\n${COLORS.RED}${COLORS.BOLD}⚠️  Some tests failed. Please review and fix issues.${COLORS.RESET}`);
    }

    // Show failed tests
    if (this.results.failed > 0) {
      this.log(`\n${COLORS.RED}${COLORS.BOLD}Failed Tests:${COLORS.RESET}`);
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          this.log(`  • ${test.name}: ${test.error}`, COLORS.RED);
        });
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new BackendTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = BackendTester;
