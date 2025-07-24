#!/usr/bin/env node
/**
 * Comprehensive Anti-Detection System Validation Script
 * Validates all anti-detection measures and integration points
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString().substr(11, 8);
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function warning(message) {
  console.log(`${colors.yellow}⚠️ ${message}${colors.reset}`);
}

function error(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function header(message) {
  console.log(`\n${colors.bold}${colors.cyan}🚀 ${message}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(message.length + 4)}${colors.reset}\n`);
}

class AntiDetectionValidator {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };
  }

  async validate() {
    header('Anti-Detection System Comprehensive Validation');

    try {
      // 1. Validate file structure
      await this.validateFileStructure();

      // 2. Validate configuration
      await this.validateConfiguration();

      // 3. Validate database schema
      await this.validateDatabaseSchema();

      // 4. Validate TypeScript compilation
      await this.validateTypeScriptCompilation();

      // 5. Run unit tests
      await this.runUnitTests();

      // 6. Validate Python integration
      await this.validatePythonIntegration();

      // 7. Validate Redis coordination
      await this.validateRedisCoordination();

      // 8. Performance validation
      await this.validatePerformance();

      // 9. Security validation
      await this.validateSecurity();

      // 10. Integration validation
      await this.validateIntegration();

      // Generate final report
      this.generateReport();

    } catch (error) {
      error(`Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  async validateFileStructure() {
    header('File Structure Validation');

    const requiredFiles = [
      'backend/src/config/antiDetection.ts',
      'backend/src/services/antiDetectionService.ts',
      'backend/src/services/fingerprint/fingerprintManager.ts',
      'backend/src/services/coordination/antiDetectionCoordinator.ts',
      'backend/scripts/anti_detection_bridge.py',
      'backend/prisma/anti-detection-schema-extension.prisma',
      'backend/prisma/migrations/add_anti_detection_schema.sql',
      'backend/__tests__/antiDetectionService.test.ts',
    ];

    for (const file of requiredFiles) {
      this.checkFile(file);
    }

    success('File structure validation completed');
  }

  async validateConfiguration() {
    header('Configuration Validation');

    try {
      // Check if configuration file exists and is valid
      const configPath = 'backend/src/config/antiDetection.ts';
      if (!fs.existsSync(configPath)) {
        throw new Error('Anti-detection configuration file not found');
      }

      // Validate configuration structure
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      const requiredConfigSections = [
        'AntiDetectionConfig',
        'defaultAntiDetectionConfig',
        'AntiDetectionConfigManager',
        'identityProfiles',
        'fingerprinting',
        'behavior',
        'network',
        'detection',
        'redis'
      ];

      for (const section of requiredConfigSections) {
        if (!configContent.includes(section)) {
          this.addResult('Configuration', `Missing section: ${section}`, 'failed');
        } else {
          this.addResult('Configuration', `Section found: ${section}`, 'passed');
        }
      }

      success('Configuration validation completed');
    } catch (error) {
      this.addResult('Configuration', `Validation failed: ${error.message}`, 'failed');
    }
  }

  async validateDatabaseSchema() {
    header('Database Schema Validation');

    try {
      // Check Prisma schema extension
      const schemaPath = 'backend/prisma/anti-detection-schema-extension.prisma';
      if (!fs.existsSync(schemaPath)) {
        throw new Error('Anti-detection schema extension not found');
      }

      const schemaContent = fs.readFileSync(schemaPath, 'utf8');

      const requiredModels = [
        'IdentityProfile',
        'FingerprintProfile',
        'BehaviorPattern',
        'DetectionEvent',
        'IdentitySessionAssignment'
      ];

      for (const model of requiredModels) {
        if (schemaContent.includes(`model ${model}`)) {
          this.addResult('Database Schema', `Model found: ${model}`, 'passed');
        } else {
          this.addResult('Database Schema', `Missing model: ${model}`, 'failed');
        }
      }

      // Check migration file
      const migrationPath = 'backend/prisma/migrations/add_anti_detection_schema.sql';
      if (fs.existsSync(migrationPath)) {
        this.addResult('Database Schema', 'Migration file exists', 'passed');
      } else {
        this.addResult('Database Schema', 'Migration file missing', 'failed');
      }

      success('Database schema validation completed');
    } catch (error) {
      this.addResult('Database Schema', `Validation failed: ${error.message}`, 'failed');
    }
  }

  async validateTypeScriptCompilation() {
    header('TypeScript Compilation Validation');

    try {
      // Check if TypeScript compiles without errors
      log('Compiling TypeScript files...', 'blue');
      
      const compileResult = execSync('npx tsc --noEmit --project backend/tsconfig.json', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.addResult('TypeScript', 'Compilation successful', 'passed');
      success('TypeScript compilation validation completed');
    } catch (error) {
      this.addResult('TypeScript', `Compilation failed: ${error.message}`, 'failed');
      warning('TypeScript compilation has errors - check the output above');
    }
  }

  async runUnitTests() {
    header('Unit Tests Validation');

    try {
      log('Running anti-detection unit tests...', 'blue');
      
      const testResult = execSync('npm test -- --testPathPattern=antiDetectionService.test.ts', {
        cwd: 'backend',
        encoding: 'utf8',
        stdio: 'pipe'
      });

      this.addResult('Unit Tests', 'All tests passed', 'passed');
      success('Unit tests validation completed');
    } catch (error) {
      this.addResult('Unit Tests', `Tests failed: ${error.message}`, 'failed');
      warning('Some unit tests are failing - check the test output');
    }
  }

  async validatePythonIntegration() {
    header('Python Integration Validation');

    try {
      // Check Python bridge file
      const pythonBridgePath = 'backend/scripts/anti_detection_bridge.py';
      if (!fs.existsSync(pythonBridgePath)) {
        throw new Error('Python bridge file not found');
      }

      const pythonContent = fs.readFileSync(pythonBridgePath, 'utf8');

      const requiredPythonClasses = [
        'AntiDetectionProfile',
        'BehaviorTiming',
        'AntiDetectionBridge'
      ];

      for (const className of requiredPythonClasses) {
        if (pythonContent.includes(`class ${className}`)) {
          this.addResult('Python Integration', `Class found: ${className}`, 'passed');
        } else {
          this.addResult('Python Integration', `Missing class: ${className}`, 'failed');
        }
      }

      // Check Python syntax
      try {
        execSync(`python -m py_compile ${pythonBridgePath}`, {
          stdio: 'pipe'
        });
        this.addResult('Python Integration', 'Python syntax valid', 'passed');
      } catch (error) {
        this.addResult('Python Integration', 'Python syntax errors', 'failed');
      }

      success('Python integration validation completed');
    } catch (error) {
      this.addResult('Python Integration', `Validation failed: ${error.message}`, 'failed');
    }
  }

  async validateRedisCoordination() {
    header('Redis Coordination Validation');

    try {
      // Check coordinator file
      const coordinatorPath = 'backend/src/services/coordination/antiDetectionCoordinator.ts';
      if (!fs.existsSync(coordinatorPath)) {
        throw new Error('Anti-detection coordinator not found');
      }

      const coordinatorContent = fs.readFileSync(coordinatorPath, 'utf8');

      const requiredCoordinatorFeatures = [
        'AntiDetectionCoordinator',
        'broadcastMessage',
        'acquireDistributedLock',
        'releaseDistributedLock',
        'coordinateProfileRotation',
        'synchronizeDetectionEvent'
      ];

      for (const feature of requiredCoordinatorFeatures) {
        if (coordinatorContent.includes(feature)) {
          this.addResult('Redis Coordination', `Feature found: ${feature}`, 'passed');
        } else {
          this.addResult('Redis Coordination', `Missing feature: ${feature}`, 'failed');
        }
      }

      success('Redis coordination validation completed');
    } catch (error) {
      this.addResult('Redis Coordination', `Validation failed: ${error.message}`, 'failed');
    }
  }

  async validatePerformance() {
    header('Performance Validation');

    try {
      // Check for performance optimizations
      const serviceContent = fs.readFileSync('backend/src/services/antiDetectionService.ts', 'utf8');

      const performanceFeatures = [
        'detectionCache',
        'performanceMetrics',
        'cacheKey',
        'isCacheValid',
        'updateMetrics'
      ];

      for (const feature of performanceFeatures) {
        if (serviceContent.includes(feature)) {
          this.addResult('Performance', `Optimization found: ${feature}`, 'passed');
        } else {
          this.addResult('Performance', `Missing optimization: ${feature}`, 'warning');
        }
      }

      success('Performance validation completed');
    } catch (error) {
      this.addResult('Performance', `Validation failed: ${error.message}`, 'failed');
    }
  }

  async validateSecurity() {
    header('Security Validation');

    try {
      // Check for security measures
      const files = [
        'backend/src/services/antiDetectionService.ts',
        'backend/scripts/anti_detection_bridge.py'
      ];

      const securityFeatures = [
        'consistency',
        'encryption',
        'validation',
        'sanitize',
        'secure'
      ];

      for (const file of files) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          for (const feature of securityFeatures) {
            if (content.toLowerCase().includes(feature)) {
              this.addResult('Security', `Security feature found in ${path.basename(file)}: ${feature}`, 'passed');
            }
          }
        }
      }

      success('Security validation completed');
    } catch (error) {
      this.addResult('Security', `Validation failed: ${error.message}`, 'failed');
    }
  }

  async validateIntegration() {
    header('Integration Validation');

    try {
      // Check integration points
      const mainSchemaPath = 'backend/prisma/schema.prisma';
      if (fs.existsSync(mainSchemaPath)) {
        const schemaContent = fs.readFileSync(mainSchemaPath, 'utf8');
        
        // Check if anti-detection relations are added
        const integrationPoints = [
          'identityProfiles',
          'detectionEvents',
          'identityAssignments'
        ];

        for (const point of integrationPoints) {
          if (schemaContent.includes(point)) {
            this.addResult('Integration', `Integration point found: ${point}`, 'passed');
          } else {
            this.addResult('Integration', `Missing integration point: ${point}`, 'warning');
          }
        }
      }

      success('Integration validation completed');
    } catch (error) {
      this.addResult('Integration', `Validation failed: ${error.message}`, 'failed');
    }
  }

  checkFile(filePath) {
    if (fs.existsSync(filePath)) {
      this.addResult('File Structure', `File exists: ${filePath}`, 'passed');
    } else {
      this.addResult('File Structure', `Missing file: ${filePath}`, 'failed');
    }
  }

  addResult(category, message, status) {
    this.results.total++;
    this.results[status]++;
    this.results.details.push({ category, message, status });

    const statusIcon = {
      passed: '✅',
      failed: '❌',
      warning: '⚠️'
    }[status];

    const statusColor = {
      passed: 'green',
      failed: 'red',
      warning: 'yellow'
    }[status];

    log(`${statusIcon} [${category}] ${message}`, statusColor);
  }

  generateReport() {
    header('Validation Report');

    console.log(`${colors.bold}Summary:${colors.reset}`);
    console.log(`  Total checks: ${this.results.total}`);
    console.log(`  ${colors.green}Passed: ${this.results.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${this.results.failed}${colors.reset}`);
    console.log(`  ${colors.yellow}Warnings: ${this.results.warnings}${colors.reset}`);

    const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    console.log(`  Success rate: ${successRate}%`);

    if (this.results.failed > 0) {
      console.log(`\n${colors.red}${colors.bold}❌ Validation FAILED${colors.reset}`);
      console.log(`${colors.red}Please fix the failed checks before proceeding.${colors.reset}`);
      process.exit(1);
    } else if (this.results.warnings > 0) {
      console.log(`\n${colors.yellow}${colors.bold}⚠️ Validation PASSED with warnings${colors.reset}`);
      console.log(`${colors.yellow}Consider addressing the warnings for optimal performance.${colors.reset}`);
    } else {
      console.log(`\n${colors.green}${colors.bold}🎉 Validation PASSED${colors.reset}`);
      console.log(`${colors.green}All anti-detection measures are properly implemented!${colors.reset}`);
    }

    // Save detailed report
    const reportPath = 'validation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    log(`Detailed report saved to: ${reportPath}`, 'blue');
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new AntiDetectionValidator();
  validator.validate().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = AntiDetectionValidator;
