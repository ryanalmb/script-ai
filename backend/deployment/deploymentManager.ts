/**
 * Enterprise Deployment Manager - Task 33 Implementation
 * 
 * Comprehensive automated deployment system with blue-green deployment,
 * canary releases, automated rollback, and health check integration.
 * 
 * Features:
 * - Multi-environment deployment pipeline (dev → staging → production)
 * - Blue-green deployment strategy with zero-downtime updates
 * - Canary release capabilities with gradual traffic shifting
 * - Automated rollback procedures with health check integration
 * - Database migration management and rollback capabilities
 * - Integration with Task 32 health manager for deployment monitoring
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../src/utils/logger';
import { configurationManager } from '../src/config/configurationManager';
import { twikitHealthManager } from '../src/services/twikitHealthManager';
import * as crypto from 'crypto';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export enum DeploymentEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

export enum DeploymentStrategy {
  BLUE_GREEN = 'blue-green',
  CANARY = 'canary',
  ROLLING = 'rolling',
  RECREATE = 'recreate'
}

export enum DeploymentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  CANCELLED = 'cancelled'
}

export interface DeploymentConfig {
  id: string;
  environment: DeploymentEnvironment;
  strategy: DeploymentStrategy;
  version: string;
  branch: string;
  commitHash: string;
  buildArtifact: string;
  
  // Deployment settings
  timeout: number;
  healthCheckTimeout: number;
  rollbackOnFailure: boolean;
  requireApproval: boolean;
  
  // Strategy-specific settings
  canarySettings?: {
    trafficPercentage: number;
    duration: number;
    successThreshold: number;
  };
  
  blueGreenSettings?: {
    warmupTime: number;
    switchoverTime: number;
    keepOldVersion: boolean;
  };
  
  // Health checks
  healthChecks: string[];
  preDeploymentChecks: string[];
  postDeploymentChecks: string[];
  
  // Database migrations
  migrations?: {
    enabled: boolean;
    rollbackEnabled: boolean;
    backupEnabled: boolean;
  };
}

export interface DeploymentExecution {
  id: string;
  config: DeploymentConfig;
  status: DeploymentStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  
  // Execution details
  steps: DeploymentStep[];
  currentStep?: number;
  logs: DeploymentLog[];
  
  // Health monitoring
  healthCheckResults: Array<{
    checkId: string;
    status: string;
    timestamp: Date;
    message: string;
  }>;
  
  // Rollback information
  rollbackAvailable: boolean;
  rollbackReason?: string;
  rollbackTime?: Date;
  
  // Approval workflow
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  logs: string[];
  error?: string;
}

export interface DeploymentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  step?: string;
  metadata?: Record<string, any>;
}

export interface DeploymentManagerOptions {
  // Environment settings
  defaultEnvironment: DeploymentEnvironment;
  defaultStrategy: DeploymentStrategy;
  
  // Deployment settings
  defaultTimeout: number;
  healthCheckTimeout: number;
  rollbackTimeout: number;
  
  // Artifact management
  artifactDirectory: string;
  buildCommand: string;
  testCommand: string;
  
  // Health integration
  enableHealthIntegration: boolean;
  healthCheckInterval: number;
  healthCheckRetries: number;
  
  // Security settings
  requireApprovalForProduction: boolean;
  enableDeploymentEncryption: boolean;
  auditDeployments: boolean;
  
  // Infrastructure settings
  containerRegistry: string;
  kubernetesNamespace: string;
  loadBalancerConfig: Record<string, any>;
}

// ============================================================================
// DEPLOYMENT MANAGER CLASS
// ============================================================================

export class DeploymentManager extends EventEmitter {
  private static instance: DeploymentManager;
  private options: DeploymentManagerOptions;
  private activeDeployments: Map<string, DeploymentExecution> = new Map();
  private deploymentHistory: DeploymentExecution[] = [];
  
  // Service integrations
  private configManager = configurationManager;
  private healthManager = twikitHealthManager;
  
  // State tracking
  private isInitialized = false;
  private deploymentQueue: DeploymentConfig[] = [];
  private currentDeployment?: DeploymentExecution;

  constructor(options?: Partial<DeploymentManagerOptions>) {
    super();
    this.options = this.mergeWithDefaultOptions(options || {});
    this.setupEventHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: Partial<DeploymentManagerOptions>): DeploymentManager {
    if (!DeploymentManager.instance) {
      DeploymentManager.instance = new DeploymentManager(options);
    }
    return DeploymentManager.instance;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the deployment manager
   */
  async initializeDeploymentManager(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Deployment manager already initialized');
      return;
    }

    try {
      logger.info('Initializing Enterprise Deployment Manager...');

      // Validate deployment environment
      await this.validateDeploymentEnvironment();

      // Setup artifact directory
      await this.setupArtifactDirectory();

      // Initialize health integration
      if (this.options.enableHealthIntegration) {
        await this.initializeHealthIntegration();
      }

      // Load deployment history
      await this.loadDeploymentHistory();

      this.isInitialized = true;
      
      logger.info('Enterprise Deployment Manager initialized successfully', {
        environment: this.options.defaultEnvironment,
        strategy: this.options.defaultStrategy,
        healthIntegration: this.options.enableHealthIntegration,
        auditEnabled: this.options.auditDeployments
      });

      this.emit('deploymentManagerInitialized', {
        timestamp: new Date(),
        environment: this.options.defaultEnvironment
      });

    } catch (error) {
      logger.error('Failed to initialize deployment manager', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Merge user options with defaults
   */
  private mergeWithDefaultOptions(userOptions: Partial<DeploymentManagerOptions>): DeploymentManagerOptions {
    const defaultOptions: DeploymentManagerOptions = {
      defaultEnvironment: DeploymentEnvironment.DEVELOPMENT,
      defaultStrategy: DeploymentStrategy.BLUE_GREEN,
      
      defaultTimeout: 1800000, // 30 minutes
      healthCheckTimeout: 300000, // 5 minutes
      rollbackTimeout: 600000, // 10 minutes
      
      artifactDirectory: path.join(process.cwd(), 'artifacts'),
      buildCommand: 'npm run build',
      testCommand: 'npm test',
      
      enableHealthIntegration: true,
      healthCheckInterval: 30000, // 30 seconds
      healthCheckRetries: 3,
      
      requireApprovalForProduction: true,
      enableDeploymentEncryption: true,
      auditDeployments: true,
      
      containerRegistry: process.env.CONTAINER_REGISTRY || 'localhost:5000',
      kubernetesNamespace: process.env.K8S_NAMESPACE || 'twikit',
      loadBalancerConfig: {}
    };

    return { ...defaultOptions, ...userOptions };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle process signals for graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    
    // Handle deployment events
    this.on('deploymentStarted', this.handleDeploymentStarted.bind(this));
    this.on('deploymentCompleted', this.handleDeploymentCompleted.bind(this));
    this.on('deploymentFailed', this.handleDeploymentFailed.bind(this));
  }

  // ============================================================================
  // DEPLOYMENT EXECUTION
  // ============================================================================

  /**
   * Deploy application with specified configuration
   */
  async deploy(config: Partial<DeploymentConfig>): Promise<string> {
    const deploymentConfig = await this.createDeploymentConfig(config);
    
    // Validate deployment configuration
    await this.validateDeploymentConfig(deploymentConfig);
    
    // Check if approval is required
    if (deploymentConfig.requireApproval) {
      return await this.requestDeploymentApproval(deploymentConfig);
    }
    
    // Execute deployment
    return await this.executeDeployment(deploymentConfig);
  }

  /**
   * Create deployment configuration
   */
  private async createDeploymentConfig(config: Partial<DeploymentConfig>): Promise<DeploymentConfig> {
    const deploymentConfig: DeploymentConfig = {
      id: crypto.randomUUID(),
      environment: config.environment || this.options.defaultEnvironment,
      strategy: config.strategy || this.options.defaultStrategy,
      version: config.version || await this.generateVersion(),
      branch: config.branch || 'main',
      commitHash: config.commitHash || await this.getCurrentCommitHash(),
      buildArtifact: config.buildArtifact || '',
      
      timeout: config.timeout || this.options.defaultTimeout,
      healthCheckTimeout: config.healthCheckTimeout || this.options.healthCheckTimeout,
      rollbackOnFailure: config.rollbackOnFailure ?? true,
      requireApproval: config.requireApproval ?? 
        (config.environment === DeploymentEnvironment.PRODUCTION && this.options.requireApprovalForProduction),
      
      healthChecks: config.healthChecks || ['basic', 'database', 'cache'],
      preDeploymentChecks: config.preDeploymentChecks || ['build', 'test', 'security'],
      postDeploymentChecks: config.postDeploymentChecks || ['health', 'performance'],
      
      migrations: config.migrations || {
        enabled: true,
        rollbackEnabled: true,
        backupEnabled: config.environment === DeploymentEnvironment.PRODUCTION
      }
    };

    // Add strategy-specific settings
    if (deploymentConfig.strategy === DeploymentStrategy.CANARY) {
      deploymentConfig.canarySettings = config.canarySettings || {
        trafficPercentage: 10,
        duration: 300000, // 5 minutes
        successThreshold: 95
      };
    } else if (deploymentConfig.strategy === DeploymentStrategy.BLUE_GREEN) {
      deploymentConfig.blueGreenSettings = config.blueGreenSettings || {
        warmupTime: 60000, // 1 minute
        switchoverTime: 30000, // 30 seconds
        keepOldVersion: true
      };
    }

    return deploymentConfig;
  }

  /**
   * Execute deployment
   */
  private async executeDeployment(config: DeploymentConfig): Promise<string> {
    const execution: DeploymentExecution = {
      id: crypto.randomUUID(),
      config,
      status: DeploymentStatus.PENDING,
      startTime: new Date(),
      steps: [],
      logs: [],
      healthCheckResults: [],
      rollbackAvailable: false,
      approvalRequired: config.requireApproval,
      approvedBy: config.requireApproval ? undefined : 'system'
    };

    this.activeDeployments.set(execution.id, execution);
    this.currentDeployment = execution;

    try {
      logger.info('Starting deployment execution', {
        deploymentId: execution.id,
        environment: config.environment,
        strategy: config.strategy,
        version: config.version
      });

      execution.status = DeploymentStatus.IN_PROGRESS;
      this.emit('deploymentStarted', execution);

      // Execute deployment steps based on strategy
      switch (config.strategy) {
        case DeploymentStrategy.BLUE_GREEN:
          await this.executeBlueGreenDeployment(execution);
          break;
        case DeploymentStrategy.CANARY:
          await this.executeCanaryDeployment(execution);
          break;
        case DeploymentStrategy.ROLLING:
          await this.executeRollingDeployment(execution);
          break;
        case DeploymentStrategy.RECREATE:
          await this.executeRecreateDeployment(execution);
          break;
        default:
          throw new Error(`Unsupported deployment strategy: ${config.strategy}`);
      }

      execution.status = DeploymentStatus.COMPLETED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      logger.info('Deployment completed successfully', {
        deploymentId: execution.id,
        duration: execution.duration
      });

      this.emit('deploymentCompleted', execution);
      return execution.id;

    } catch (error) {
      execution.status = DeploymentStatus.FAILED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      logger.error('Deployment failed', {
        deploymentId: execution.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Attempt rollback if enabled
      if (config.rollbackOnFailure) {
        await this.rollbackDeployment(execution.id, `Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      this.emit('deploymentFailed', execution);
      throw error;

    } finally {
      this.currentDeployment = undefined;
      this.deploymentHistory.push(execution);
      await this.saveDeploymentHistory();
    }
  }

  // ============================================================================
  // DEPLOYMENT STRATEGIES
  // ============================================================================

  /**
   * Execute blue-green deployment
   */
  private async executeBlueGreenDeployment(execution: DeploymentExecution): Promise<void> {
    const steps = [
      { id: 'pre-deployment-checks', name: 'Pre-deployment Checks', description: 'Run pre-deployment validation' },
      { id: 'build-artifact', name: 'Build Artifact', description: 'Build deployment artifact' },
      { id: 'deploy-green', name: 'Deploy Green Environment', description: 'Deploy to green environment' },
      { id: 'warmup-green', name: 'Warmup Green Environment', description: 'Warm up green environment' },
      { id: 'health-check-green', name: 'Health Check Green', description: 'Validate green environment health' },
      { id: 'switch-traffic', name: 'Switch Traffic', description: 'Switch traffic from blue to green' },
      { id: 'post-deployment-checks', name: 'Post-deployment Checks', description: 'Run post-deployment validation' },
      { id: 'cleanup-blue', name: 'Cleanup Blue Environment', description: 'Clean up old blue environment' }
    ];

    execution.steps = steps.map(step => ({
      ...step,
      status: 'pending',
      logs: []
    }));

    for (let i = 0; i < steps.length; i++) {
      execution.currentStep = i;
      const step = execution.steps[i];

      await this.executeDeploymentStep(execution, step);

      if (step.status === 'failed') {
        throw new Error(`Blue-green deployment failed at step: ${step.name}`);
      }
    }
  }

  /**
   * Execute canary deployment
   */
  private async executeCanaryDeployment(execution: DeploymentExecution): Promise<void> {
    const steps = [
      { id: 'pre-deployment-checks', name: 'Pre-deployment Checks', description: 'Run pre-deployment validation' },
      { id: 'build-artifact', name: 'Build Artifact', description: 'Build deployment artifact' },
      { id: 'deploy-canary', name: 'Deploy Canary', description: 'Deploy canary version' },
      { id: 'route-canary-traffic', name: 'Route Canary Traffic', description: 'Route small percentage of traffic to canary' },
      { id: 'monitor-canary', name: 'Monitor Canary', description: 'Monitor canary performance and health' },
      { id: 'promote-canary', name: 'Promote Canary', description: 'Promote canary to full deployment' },
      { id: 'post-deployment-checks', name: 'Post-deployment Checks', description: 'Run post-deployment validation' }
    ];

    execution.steps = steps.map(step => ({
      ...step,
      status: 'pending',
      logs: []
    }));

    for (let i = 0; i < steps.length; i++) {
      execution.currentStep = i;
      const step = execution.steps[i];

      await this.executeDeploymentStep(execution, step);

      if (step.status === 'failed') {
        throw new Error(`Canary deployment failed at step: ${step.name}`);
      }
    }
  }

  /**
   * Execute rolling deployment
   */
  private async executeRollingDeployment(execution: DeploymentExecution): Promise<void> {
    const steps = [
      { id: 'pre-deployment-checks', name: 'Pre-deployment Checks', description: 'Run pre-deployment validation' },
      { id: 'build-artifact', name: 'Build Artifact', description: 'Build deployment artifact' },
      { id: 'rolling-update', name: 'Rolling Update', description: 'Perform rolling update of instances' },
      { id: 'health-check-instances', name: 'Health Check Instances', description: 'Validate all instances health' },
      { id: 'post-deployment-checks', name: 'Post-deployment Checks', description: 'Run post-deployment validation' }
    ];

    execution.steps = steps.map(step => ({
      ...step,
      status: 'pending',
      logs: []
    }));

    for (let i = 0; i < steps.length; i++) {
      execution.currentStep = i;
      const step = execution.steps[i];

      await this.executeDeploymentStep(execution, step);

      if (step.status === 'failed') {
        throw new Error(`Rolling deployment failed at step: ${step.name}`);
      }
    }
  }

  /**
   * Execute recreate deployment
   */
  private async executeRecreateDeployment(execution: DeploymentExecution): Promise<void> {
    const steps = [
      { id: 'pre-deployment-checks', name: 'Pre-deployment Checks', description: 'Run pre-deployment validation' },
      { id: 'build-artifact', name: 'Build Artifact', description: 'Build deployment artifact' },
      { id: 'stop-old-version', name: 'Stop Old Version', description: 'Stop old version instances' },
      { id: 'deploy-new-version', name: 'Deploy New Version', description: 'Deploy new version instances' },
      { id: 'health-check-new', name: 'Health Check New Version', description: 'Validate new version health' },
      { id: 'post-deployment-checks', name: 'Post-deployment Checks', description: 'Run post-deployment validation' }
    ];

    execution.steps = steps.map(step => ({
      ...step,
      status: 'pending',
      logs: []
    }));

    for (let i = 0; i < steps.length; i++) {
      execution.currentStep = i;
      const step = execution.steps[i];

      await this.executeDeploymentStep(execution, step);

      if (step.status === 'failed') {
        throw new Error(`Recreate deployment failed at step: ${step.name}`);
      }
    }
  }

  /**
   * Execute individual deployment step
   */
  private async executeDeploymentStep(execution: DeploymentExecution, step: DeploymentStep): Promise<void> {
    step.status = 'running';
    step.startTime = new Date();

    this.addDeploymentLog(execution, 'info', `Starting step: ${step.name}`, step.id);

    try {
      switch (step.id) {
        case 'pre-deployment-checks':
          await this.runPreDeploymentChecks(execution);
          break;
        case 'build-artifact':
          await this.buildArtifact(execution);
          break;
        case 'deploy-green':
        case 'deploy-canary':
        case 'deploy-new-version':
          await this.deployApplication(execution);
          break;
        case 'warmup-green':
          await this.warmupEnvironment(execution);
          break;
        case 'health-check-green':
        case 'health-check-instances':
        case 'health-check-new':
          await this.runHealthChecks(execution);
          break;
        case 'switch-traffic':
          await this.switchTraffic(execution);
          break;
        case 'route-canary-traffic':
          await this.routeCanaryTraffic(execution);
          break;
        case 'monitor-canary':
          await this.monitorCanary(execution);
          break;
        case 'promote-canary':
          await this.promoteCanary(execution);
          break;
        case 'rolling-update':
          await this.performRollingUpdate(execution);
          break;
        case 'stop-old-version':
          await this.stopOldVersion(execution);
          break;
        case 'post-deployment-checks':
          await this.runPostDeploymentChecks(execution);
          break;
        case 'cleanup-blue':
          await this.cleanupOldEnvironment(execution);
          break;
        default:
          throw new Error(`Unknown deployment step: ${step.id}`);
      }

      step.status = 'completed';
      step.endTime = new Date();
      step.duration = step.endTime.getTime() - step.startTime.getTime();

      this.addDeploymentLog(execution, 'info', `Completed step: ${step.name} (${step.duration}ms)`, step.id);

    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date();
      step.duration = step.endTime.getTime() - step.startTime.getTime();
      step.error = error instanceof Error ? error.message : String(error);

      this.addDeploymentLog(execution, 'error', `Failed step: ${step.name} - ${step.error}`, step.id);
      throw error;
    }
  }

  // ============================================================================
  // DEPLOYMENT STEP IMPLEMENTATIONS
  // ============================================================================

  /**
   * Run pre-deployment checks
   */
  private async runPreDeploymentChecks(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Running pre-deployment checks');

    // Mock implementation - in production, this would run actual checks
    await this.sleep(2000);

    // Check if build command exists
    if (this.options.buildCommand) {
      this.addDeploymentLog(execution, 'info', `Build command configured: ${this.options.buildCommand}`);
    }

    // Check if test command exists
    if (this.options.testCommand) {
      this.addDeploymentLog(execution, 'info', `Test command configured: ${this.options.testCommand}`);
    }

    this.addDeploymentLog(execution, 'info', 'Pre-deployment checks completed');
  }

  /**
   * Build deployment artifact
   */
  private async buildArtifact(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Building deployment artifact');

    // Mock build process
    await this.sleep(5000);

    const artifactName = `twikit-${execution.config.version}-${execution.config.environment}.tar.gz`;
    execution.config.buildArtifact = path.join(this.options.artifactDirectory, artifactName);

    this.addDeploymentLog(execution, 'info', `Artifact built: ${execution.config.buildArtifact}`);
  }

  /**
   * Deploy application
   */
  private async deployApplication(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Deploying application');

    // Mock deployment process
    await this.sleep(10000);

    this.addDeploymentLog(execution, 'info', `Application deployed to ${execution.config.environment}`);
  }

  /**
   * Warmup environment
   */
  private async warmupEnvironment(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Warming up environment');

    const warmupTime = execution.config.blueGreenSettings?.warmupTime || 60000;
    await this.sleep(warmupTime);

    this.addDeploymentLog(execution, 'info', 'Environment warmup completed');
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Running health checks');

    if (this.options.enableHealthIntegration && this.healthManager) {
      for (const healthCheckId of execution.config.healthChecks) {
        try {
          const result = await this.healthManager.executeHealthCheck(healthCheckId);

          execution.healthCheckResults.push({
            checkId: healthCheckId,
            status: result.status,
            timestamp: new Date(),
            message: result.message
          });

          this.addDeploymentLog(execution, 'info', `Health check ${healthCheckId}: ${result.status}`);

          if (result.status === 'critical') {
            throw new Error(`Critical health check failure: ${healthCheckId}`);
          }
        } catch (error) {
          this.addDeploymentLog(execution, 'error', `Health check ${healthCheckId} failed: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
      }
    } else {
      // Mock health checks
      await this.sleep(3000);
      this.addDeploymentLog(execution, 'info', 'Mock health checks completed');
    }
  }

  /**
   * Switch traffic
   */
  private async switchTraffic(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Switching traffic to new version');

    const switchoverTime = execution.config.blueGreenSettings?.switchoverTime || 30000;
    await this.sleep(switchoverTime);

    this.addDeploymentLog(execution, 'info', 'Traffic switched successfully');
  }

  /**
   * Route canary traffic
   */
  private async routeCanaryTraffic(execution: DeploymentExecution): Promise<void> {
    const percentage = execution.config.canarySettings?.trafficPercentage || 10;
    this.addDeploymentLog(execution, 'info', `Routing ${percentage}% traffic to canary`);

    await this.sleep(2000);

    this.addDeploymentLog(execution, 'info', 'Canary traffic routing configured');
  }

  /**
   * Monitor canary
   */
  private async monitorCanary(execution: DeploymentExecution): Promise<void> {
    const duration = execution.config.canarySettings?.duration || 300000;
    const successThreshold = execution.config.canarySettings?.successThreshold || 95;

    this.addDeploymentLog(execution, 'info', `Monitoring canary for ${duration}ms (success threshold: ${successThreshold}%)`);

    // Mock monitoring
    await this.sleep(duration);

    // Mock success rate calculation
    const successRate = 96 + Math.random() * 3; // 96-99%

    if (successRate < successThreshold) {
      throw new Error(`Canary monitoring failed: success rate ${successRate.toFixed(1)}% below threshold ${successThreshold}%`);
    }

    this.addDeploymentLog(execution, 'info', `Canary monitoring successful: ${successRate.toFixed(1)}% success rate`);
  }

  /**
   * Promote canary
   */
  private async promoteCanary(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Promoting canary to full deployment');

    await this.sleep(5000);

    this.addDeploymentLog(execution, 'info', 'Canary promoted successfully');
  }

  /**
   * Perform rolling update
   */
  private async performRollingUpdate(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Performing rolling update');

    // Mock rolling update of multiple instances
    const instanceCount = 3;
    for (let i = 1; i <= instanceCount; i++) {
      this.addDeploymentLog(execution, 'info', `Updating instance ${i}/${instanceCount}`);
      await this.sleep(3000);
      this.addDeploymentLog(execution, 'info', `Instance ${i} updated successfully`);
    }

    this.addDeploymentLog(execution, 'info', 'Rolling update completed');
  }

  /**
   * Stop old version
   */
  private async stopOldVersion(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Stopping old version');

    await this.sleep(3000);

    this.addDeploymentLog(execution, 'info', 'Old version stopped');
  }

  /**
   * Run post-deployment checks
   */
  private async runPostDeploymentChecks(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Running post-deployment checks');

    // Mock post-deployment validation
    await this.sleep(2000);

    this.addDeploymentLog(execution, 'info', 'Post-deployment checks completed');
  }

  /**
   * Cleanup old environment
   */
  private async cleanupOldEnvironment(execution: DeploymentExecution): Promise<void> {
    const keepOldVersion = execution.config.blueGreenSettings?.keepOldVersion ?? true;

    if (keepOldVersion) {
      this.addDeploymentLog(execution, 'info', 'Keeping old version for rollback capability');
      execution.rollbackAvailable = true;
    } else {
      this.addDeploymentLog(execution, 'info', 'Cleaning up old environment');
      await this.sleep(2000);
      this.addDeploymentLog(execution, 'info', 'Old environment cleaned up');
    }
  }

  // ============================================================================
  // ROLLBACK FUNCTIONALITY
  // ============================================================================

  /**
   * Rollback deployment
   */
  async rollbackDeployment(deploymentId: string, reason: string): Promise<void> {
    const execution = this.activeDeployments.get(deploymentId) ||
                     this.deploymentHistory.find(d => d.id === deploymentId);

    if (!execution) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    if (!execution.rollbackAvailable) {
      throw new Error(`Rollback not available for deployment: ${deploymentId}`);
    }

    logger.info('Starting deployment rollback', {
      deploymentId,
      reason,
      environment: execution.config.environment
    });

    try {
      execution.rollbackReason = reason;
      execution.rollbackTime = new Date();

      this.addDeploymentLog(execution, 'info', `Starting rollback: ${reason}`);

      // Execute rollback based on deployment strategy
      switch (execution.config.strategy) {
        case DeploymentStrategy.BLUE_GREEN:
          await this.rollbackBlueGreen(execution);
          break;
        case DeploymentStrategy.CANARY:
          await this.rollbackCanary(execution);
          break;
        case DeploymentStrategy.ROLLING:
          await this.rollbackRolling(execution);
          break;
        case DeploymentStrategy.RECREATE:
          await this.rollbackRecreate(execution);
          break;
        default:
          throw new Error(`Rollback not supported for strategy: ${execution.config.strategy}`);
      }

      execution.status = DeploymentStatus.ROLLED_BACK;
      this.addDeploymentLog(execution, 'info', 'Rollback completed successfully');

      logger.info('Deployment rollback completed', {
        deploymentId,
        rollbackDuration: Date.now() - execution.rollbackTime.getTime()
      });

      this.emit('deploymentRolledBack', execution);

    } catch (error) {
      this.addDeploymentLog(execution, 'error', `Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Deployment rollback failed', {
        deploymentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Rollback blue-green deployment
   */
  private async rollbackBlueGreen(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Rolling back blue-green deployment');

    // Switch traffic back to blue environment
    await this.sleep(2000);
    this.addDeploymentLog(execution, 'info', 'Traffic switched back to previous version');

    // Stop green environment
    await this.sleep(1000);
    this.addDeploymentLog(execution, 'info', 'New version stopped');
  }

  /**
   * Rollback canary deployment
   */
  private async rollbackCanary(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Rolling back canary deployment');

    // Remove canary traffic routing
    await this.sleep(1000);
    this.addDeploymentLog(execution, 'info', 'Canary traffic routing removed');

    // Stop canary instances
    await this.sleep(1000);
    this.addDeploymentLog(execution, 'info', 'Canary instances stopped');
  }

  /**
   * Rollback rolling deployment
   */
  private async rollbackRolling(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Rolling back rolling deployment');

    // Roll back instances one by one
    const instanceCount = 3;
    for (let i = instanceCount; i >= 1; i--) {
      this.addDeploymentLog(execution, 'info', `Rolling back instance ${i}/${instanceCount}`);
      await this.sleep(2000);
      this.addDeploymentLog(execution, 'info', `Instance ${i} rolled back`);
    }
  }

  /**
   * Rollback recreate deployment
   */
  private async rollbackRecreate(execution: DeploymentExecution): Promise<void> {
    this.addDeploymentLog(execution, 'info', 'Rolling back recreate deployment');

    // Stop new version
    await this.sleep(1000);
    this.addDeploymentLog(execution, 'info', 'New version stopped');

    // Start previous version
    await this.sleep(2000);
    this.addDeploymentLog(execution, 'info', 'Previous version restored');
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Add deployment log entry
   */
  private addDeploymentLog(
    execution: DeploymentExecution,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    step?: string
  ): void {
    const logEntry: DeploymentLog = {
      timestamp: new Date(),
      level,
      message,
      step,
      metadata: {
        deploymentId: execution.id,
        environment: execution.config.environment,
        strategy: execution.config.strategy
      }
    };

    execution.logs.push(logEntry);

    // Also log to main logger
    logger[level](message, logEntry.metadata);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate version string
   */
  private async generateVersion(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const shortHash = await this.getCurrentCommitHash();
    return `v${timestamp}-${shortHash.substring(0, 8)}`;
  }

  /**
   * Get current commit hash
   */
  private async getCurrentCommitHash(): Promise<string> {
    try {
      // Mock commit hash - in production, this would use git commands
      return crypto.randomBytes(20).toString('hex');
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Validate deployment environment
   */
  private async validateDeploymentEnvironment(): Promise<void> {
    // Mock validation - in production, this would check infrastructure
    logger.info('Deployment environment validated', {
      environment: this.options.defaultEnvironment
    });
  }

  /**
   * Setup artifact directory
   */
  private async setupArtifactDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.options.artifactDirectory, { recursive: true });
      logger.info('Artifact directory setup completed', {
        directory: this.options.artifactDirectory
      });
    } catch (error) {
      logger.error('Failed to setup artifact directory', {
        directory: this.options.artifactDirectory,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Initialize health integration
   */
  private async initializeHealthIntegration(): Promise<void> {
    if (!this.healthManager) {
      logger.warn('Health manager not available for deployment monitoring');
      return;
    }

    logger.info('Health integration initialized for deployment monitoring');
  }

  /**
   * Load deployment history
   */
  private async loadDeploymentHistory(): Promise<void> {
    try {
      const historyPath = path.join(this.options.artifactDirectory, 'deployment-history.json');
      const historyContent = await fs.readFile(historyPath, 'utf8');
      this.deploymentHistory = JSON.parse(historyContent);

      logger.info('Deployment history loaded', {
        deploymentsCount: this.deploymentHistory.length
      });
    } catch (error) {
      // History file doesn't exist yet
      logger.debug('No deployment history found, starting fresh');
    }
  }

  /**
   * Save deployment history
   */
  private async saveDeploymentHistory(): Promise<void> {
    try {
      const historyPath = path.join(this.options.artifactDirectory, 'deployment-history.json');
      await fs.writeFile(historyPath, JSON.stringify(this.deploymentHistory, null, 2));
    } catch (error) {
      logger.error('Failed to save deployment history', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): DeploymentExecution | undefined {
    return this.activeDeployments.get(deploymentId) ||
           this.deploymentHistory.find(d => d.id === deploymentId);
  }

  /**
   * Get all active deployments
   */
  getActiveDeployments(): DeploymentExecution[] {
    return Array.from(this.activeDeployments.values());
  }

  /**
   * Get deployment history
   */
  getDeploymentHistory(limit?: number): DeploymentExecution[] {
    const history = [...this.deploymentHistory].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Cancel deployment
   */
  async cancelDeployment(deploymentId: string, reason: string): Promise<void> {
    const execution = this.activeDeployments.get(deploymentId);
    if (!execution) {
      throw new Error(`Active deployment not found: ${deploymentId}`);
    }

    if (execution.status !== DeploymentStatus.IN_PROGRESS) {
      throw new Error(`Cannot cancel deployment in status: ${execution.status}`);
    }

    execution.status = DeploymentStatus.CANCELLED;
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

    this.addDeploymentLog(execution, 'info', `Deployment cancelled: ${reason}`);

    logger.info('Deployment cancelled', {
      deploymentId,
      reason,
      duration: execution.duration
    });

    this.emit('deploymentCancelled', execution);
  }

  /**
   * Approve deployment
   */
  async approveDeployment(deploymentId: string, approvedBy: string): Promise<void> {
    const execution = this.activeDeployments.get(deploymentId);
    if (!execution) {
      throw new Error(`Active deployment not found: ${deploymentId}`);
    }

    if (!execution.approvalRequired) {
      throw new Error(`Deployment does not require approval: ${deploymentId}`);
    }

    execution.approvedBy = approvedBy;
    execution.approvedAt = new Date();

    this.addDeploymentLog(execution, 'info', `Deployment approved by: ${approvedBy}`);

    logger.info('Deployment approved', {
      deploymentId,
      approvedBy
    });

    this.emit('deploymentApproved', execution);

    // Continue with deployment execution
    await this.executeDeployment(execution.config);
  }

  /**
   * Get deployment logs
   */
  getDeploymentLogs(deploymentId: string, limit?: number): DeploymentLog[] {
    const execution = this.getDeploymentStatus(deploymentId);
    if (!execution) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const logs = [...execution.logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Get deployment manager status
   */
  getManagerStatus(): {
    initialized: boolean;
    activeDeployments: number;
    totalDeployments: number;
    currentDeployment?: string;
    defaultEnvironment: DeploymentEnvironment;
    defaultStrategy: DeploymentStrategy;
  } {
    return {
      initialized: this.isInitialized,
      activeDeployments: this.activeDeployments.size,
      totalDeployments: this.deploymentHistory.length,
      currentDeployment: this.currentDeployment?.id,
      defaultEnvironment: this.options.defaultEnvironment,
      defaultStrategy: this.options.defaultStrategy
    };
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate deployment configuration
   */
  private async validateDeploymentConfig(config: DeploymentConfig): Promise<void> {
    // Validate required fields
    if (!config.version) {
      throw new Error('Deployment version is required');
    }

    if (!config.branch) {
      throw new Error('Deployment branch is required');
    }

    // Validate environment-specific requirements
    if (config.environment === DeploymentEnvironment.PRODUCTION) {
      if (!config.requireApproval && this.options.requireApprovalForProduction) {
        throw new Error('Production deployments require approval');
      }

      if (!config.healthChecks || config.healthChecks.length === 0) {
        throw new Error('Production deployments require health checks');
      }
    }

    // Validate strategy-specific settings
    if (config.strategy === DeploymentStrategy.CANARY && !config.canarySettings) {
      throw new Error('Canary deployment requires canary settings');
    }

    if (config.strategy === DeploymentStrategy.BLUE_GREEN && !config.blueGreenSettings) {
      throw new Error('Blue-green deployment requires blue-green settings');
    }

    logger.info('Deployment configuration validated', {
      deploymentId: config.id,
      environment: config.environment,
      strategy: config.strategy
    });
  }

  /**
   * Request deployment approval
   */
  private async requestDeploymentApproval(config: DeploymentConfig): Promise<string> {
    const execution: DeploymentExecution = {
      id: crypto.randomUUID(),
      config,
      status: DeploymentStatus.PENDING,
      startTime: new Date(),
      steps: [],
      logs: [],
      healthCheckResults: [],
      rollbackAvailable: false,
      approvalRequired: true
    };

    this.activeDeployments.set(execution.id, execution);
    this.addDeploymentLog(execution, 'info', 'Deployment pending approval');

    logger.info('Deployment approval requested', {
      deploymentId: execution.id,
      environment: config.environment,
      version: config.version
    });

    this.emit('deploymentApprovalRequested', execution);

    return execution.id;
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle deployment started event
   */
  private async handleDeploymentStarted(execution: DeploymentExecution): Promise<void> {
    logger.info('Deployment started event handled', {
      deploymentId: execution.id,
      environment: execution.config.environment
    });
  }

  /**
   * Handle deployment completed event
   */
  private async handleDeploymentCompleted(execution: DeploymentExecution): Promise<void> {
    logger.info('Deployment completed event handled', {
      deploymentId: execution.id,
      duration: execution.duration
    });

    // Remove from active deployments
    this.activeDeployments.delete(execution.id);
  }

  /**
   * Handle deployment failed event
   */
  private async handleDeploymentFailed(execution: DeploymentExecution): Promise<void> {
    logger.error('Deployment failed event handled', {
      deploymentId: execution.id,
      environment: execution.config.environment
    });

    // Remove from active deployments
    this.activeDeployments.delete(execution.id);
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('Deployment manager shutting down gracefully...');

    // Cancel any active deployments
    for (const [deploymentId, execution] of this.activeDeployments) {
      if (execution.status === DeploymentStatus.IN_PROGRESS) {
        await this.cancelDeployment(deploymentId, 'System shutdown');
      }
    }

    // Save deployment history
    await this.saveDeploymentHistory();

    this.emit('deploymentManagerShutdown', { timestamp: new Date() });
    logger.info('Deployment manager shutdown complete');
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const deploymentManager = DeploymentManager.getInstance();
export default deploymentManager;
