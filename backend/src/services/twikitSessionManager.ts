import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import {
  logger,
  logTwikitSession,
  logTwikitAction,
  logTwikitPerformance,
  generateCorrelationId,
  sanitizeData
} from '../utils/logger';
import { cacheManager } from '../lib/cache';
import { prisma } from '../lib/prisma';
import { EventEmitter } from 'events';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { EnterprisePythonProcessManager } from './enterprisePythonProcessManager';
import {
  twikitCacheManager,
  TwikitServiceType,
  CachePriority,
  type CacheOperationContext
} from './twikitCacheManager';

export interface ProxyConfig {
  url: string;
  type: 'residential' | 'datacenter' | 'mobile';
  username?: string;
  password?: string;
  healthScore?: number;
  lastUsed?: Date;
  failureCount?: number;
  successCount?: number;
}

export interface SessionConfig {
  userAgent: string;
  viewportSize: [number, number];
  timezone: string;
  language: string;
  behaviorProfile: 'conservative' | 'moderate' | 'active';
  sessionDuration: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
}

export interface TwikitSessionOptions {
  accountId: string;
  credentials: {
    username: string;
    email: string;
    password: string;
  };
  proxyConfigs?: ProxyConfig[];
  sessionConfig?: SessionConfig;
  retryConfig?: RetryConfig;
  enableAntiDetection?: boolean;
  enableHealthMonitoring?: boolean;
  cookiesFile?: string;
  enableSessionPersistence?: boolean;
  maxRetries?: number;
}

export interface SessionMetrics {
  sessionId: string;
  accountId: string;
  sessionDuration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  proxyRotations: number;
  authenticationAttempts: number;
  successRate: number;
  currentProxy: string;
  proxyHealth: number;
  actionCount: number;
  authenticated: boolean;
  lastActivity: Date;
  status: 'active' | 'suspended' | 'error' | 'idle';
}

export interface TwikitSession {
  sessionId: string;
  accountId: string;
  process: ChildProcess | null;
  isActive: boolean;
  isAuthenticated: boolean;
  createdAt: Date;
  lastActivity: Date;
  metrics: SessionMetrics;
  options: TwikitSessionOptions;
  healthCheckInterval?: NodeJS.Timeout;
  fingerprint?: string;

  // Health monitoring properties
  config?: any;
  isPaused?: boolean;
  pausedAt?: Date;
  pauseDuration?: number;
  emergencyStop?: boolean;
  emergencyStoppedAt?: Date;
}

// ============================================================================
// LOAD BALANCING AND HORIZONTAL SCALING INTERFACES - TASK 29
// ============================================================================

/**
 * Load balancing algorithms supported by the session manager
 */
export enum LoadBalancingAlgorithm {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  IP_HASH = 'ip_hash',
  GEOGRAPHIC = 'geographic',
  HEALTH_BASED = 'health_based'
}

/**
 * Instance information for load balancing and scaling
 */
export interface SessionManagerInstance {
  instanceId: string;
  hostname: string;
  port: number;
  region: string;
  isHealthy: boolean;
  weight: number;
  currentLoad: number;
  maxCapacity: number;
  sessionCount: number;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  lastHeartbeat: Date;
  startTime: Date;
  version: string;
  capabilities: string[];
  metadata: Record<string, any>;
}

/**
 * Load balancing configuration
 */
export interface LoadBalancingConfig {
  algorithm: LoadBalancingAlgorithm;
  healthCheckInterval: number;
  failoverTimeout: number;
  sessionAffinity: boolean;
  affinityTimeout: number;
  geographicRouting: boolean;
  weightUpdateInterval: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Horizontal scaling configuration
 */
export interface HorizontalScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  targetSessionsPerInstance: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  gracefulShutdownTimeout: number;
  autoDiscovery: boolean;
  instanceRegistrationTtl: number;
}

/**
 * Resource metrics for scaling decisions
 */
export interface ResourceMetrics {
  instanceId: string;
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  sessionCount: number;
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  networkLatency: number;
  diskUsage: number;
  customMetrics: Record<string, number>;
}

/**
 * Scaling event information
 */
export interface ScalingEvent {
  eventId: string;
  eventType: 'scale_up' | 'scale_down' | 'instance_added' | 'instance_removed' | 'failover';
  timestamp: Date;
  instanceId?: string;
  reason: string;
  metrics: ResourceMetrics;
  duration?: number;
  success: boolean;
  error?: string;
}

/**
 * Session distribution strategy
 */
export interface SessionDistributionStrategy {
  strategy: 'sticky' | 'distributed' | 'replicated';
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'strong';
  migrationEnabled: boolean;
  migrationThreshold: number;
}

/**
 * Load balancer state
 */
export interface LoadBalancerState {
  currentAlgorithm: LoadBalancingAlgorithm;
  activeInstances: SessionManagerInstance[];
  totalSessions: number;
  totalCapacity: number;
  averageLoad: number;
  healthyInstances: number;
  lastRebalance: Date;
  failoverCount: number;
  performanceMetrics: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

/**
 * Enterprise Twikit Session Manager with Load Balancing and Horizontal Scaling - Task 29
 *
 * Enhanced session manager that provides:
 * - Multiple load balancing algorithms (round-robin, weighted, least connections, IP hash)
 * - Horizontal scaling with automatic instance discovery and registration
 * - Distributed session management with Redis clustering support
 * - Performance optimization and resource monitoring
 * - Seamless integration with TwikitCacheManager for distributed operations
 */
export class TwikitSessionManager extends EventEmitter {
  // ========================================================================
  // EXISTING PROPERTIES (MAINTAINED FOR BACKWARD COMPATIBILITY)
  // ========================================================================
  private sessions: Map<string, TwikitSession> = new Map();
  private pythonScriptPath: string;
  private cookiesDir: string;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private processManager: EnterprisePythonProcessManager;

  // ========================================================================
  // NEW LOAD BALANCING AND SCALING PROPERTIES - TASK 29
  // ========================================================================

  // Instance identification and registration
  private instanceId: string;
  private instanceInfo: SessionManagerInstance;
  private isInitialized: boolean = false;

  // Load balancing system
  private loadBalancingConfig: LoadBalancingConfig;
  private loadBalancerState: LoadBalancerState;
  private sessionAffinityMap: Map<string, string> = new Map(); // clientId -> instanceId
  private roundRobinIndex: number = 0;

  // Horizontal scaling system
  private scalingConfig: HorizontalScalingConfig;
  private activeInstances: Map<string, SessionManagerInstance> = new Map();
  private resourceMetrics: ResourceMetrics;
  private scalingEvents: ScalingEvent[] = [];
  private lastScalingAction: Date = new Date(0);

  // Distributed session management
  private distributionStrategy: SessionDistributionStrategy;
  private distributedSessions: Map<string, string[]> = new Map(); // sessionId -> instanceIds
  private sessionMigrationQueue: Array<{ sessionId: string; fromInstance: string; toInstance: string }> = [];

  // Performance monitoring and optimization
  private performanceMonitoringInterval: NodeJS.Timeout | null = null;
  private instanceDiscoveryInterval: NodeJS.Timeout | null = null;
  private loadBalancingInterval: NodeJS.Timeout | null = null;
  private scalingEvaluationInterval: NodeJS.Timeout | null = null;

  // Integration with TwikitCacheManager
  private cacheContext: CacheOperationContext;

  // Redis keys for distributed coordination
  private readonly INSTANCE_REGISTRY_KEY = 'twikit_session_manager:instances';
  private readonly SESSION_DISTRIBUTION_KEY = 'twikit_session_manager:sessions';
  private readonly LOAD_BALANCER_STATE_KEY = 'twikit_session_manager:load_balancer';
  private readonly SCALING_EVENTS_KEY = 'twikit_session_manager:scaling_events';
  private readonly DISTRIBUTED_LOCK_PREFIX = 'twikit_session_manager:lock';

  constructor() {
    super();
    this.pythonScriptPath = path.join(__dirname, '../../scripts/x_client.py');
    this.cookiesDir = path.join(__dirname, '../../data/cookies');

    // ======================================================================
    // EXISTING INITIALIZATION (MAINTAINED FOR BACKWARD COMPATIBILITY)
    // ======================================================================

    // Initialize enterprise process manager
    this.processManager = new EnterprisePythonProcessManager({
      maxPoolSize: 20,
      minPoolSize: 5,
      processTimeout: 30000,
      maxIdleTime: 300000,
      healthCheckInterval: 60000,
      maxRetries: 3,
      gracefulShutdownTimeout: 10000
    });

    // ======================================================================
    // NEW LOAD BALANCING AND SCALING INITIALIZATION - TASK 29
    // ======================================================================

    // Generate unique instance ID
    this.instanceId = `twikit_session_manager_${os.hostname()}_${process.pid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize load balancing configuration
    this.loadBalancingConfig = this.createDefaultLoadBalancingConfig();

    // Initialize horizontal scaling configuration
    this.scalingConfig = this.createDefaultScalingConfig();

    // Initialize session distribution strategy
    this.distributionStrategy = this.createDefaultDistributionStrategy();

    // Initialize instance information
    this.instanceInfo = this.createInstanceInfo();

    // Initialize resource metrics
    this.resourceMetrics = this.createInitialResourceMetrics();

    // Initialize load balancer state
    this.loadBalancerState = this.createInitialLoadBalancerState();

    // Initialize cache context for TwikitCacheManager integration
    this.cacheContext = {
      serviceType: TwikitServiceType.SESSION_MANAGER,
      operationType: 'session_management',
      priority: CachePriority.HIGH,
      tags: ['session', 'load_balancing', 'scaling']
    };

    // Initialize existing systems
    this.initializeProcessManager();
    this.startHealthMonitoring();
    this.startSessionCleanup();

    logger.info('TwikitSessionManager initialized with enterprise process management, load balancing, and horizontal scaling', {
      instanceId: this.instanceId,
      loadBalancingAlgorithm: this.loadBalancingConfig.algorithm,
      scalingEnabled: this.scalingConfig.enabled,
      maxInstances: this.scalingConfig.maxInstances
    });
  }

  // ============================================================================
  // CONFIGURATION CREATION METHODS - TASK 29
  // ============================================================================

  /**
   * Create default load balancing configuration
   */
  private createDefaultLoadBalancingConfig(): LoadBalancingConfig {
    return {
      algorithm: LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN,
      healthCheckInterval: 30000, // 30 seconds
      failoverTimeout: 5000, // 5 seconds
      sessionAffinity: true,
      affinityTimeout: 3600000, // 1 hour
      geographicRouting: false,
      weightUpdateInterval: 60000, // 1 minute
      maxRetries: 3,
      retryDelay: 1000 // 1 second
    };
  }

  /**
   * Create default horizontal scaling configuration
   */
  private createDefaultScalingConfig(): HorizontalScalingConfig {
    return {
      enabled: true,
      minInstances: 1,
      maxInstances: 10,
      targetCpuUtilization: 70, // 70%
      targetMemoryUtilization: 80, // 80%
      targetSessionsPerInstance: 100,
      scaleUpThreshold: 80, // 80%
      scaleDownThreshold: 30, // 30%
      scaleUpCooldown: 300000, // 5 minutes
      scaleDownCooldown: 600000, // 10 minutes
      gracefulShutdownTimeout: 30000, // 30 seconds
      autoDiscovery: true,
      instanceRegistrationTtl: 300 // 5 minutes
    };
  }

  /**
   * Create default session distribution strategy
   */
  private createDefaultDistributionStrategy(): SessionDistributionStrategy {
    return {
      strategy: 'sticky',
      replicationFactor: 2,
      consistencyLevel: 'eventual',
      migrationEnabled: true,
      migrationThreshold: 90 // 90% capacity
    };
  }

  /**
   * Create instance information
   */
  private createInstanceInfo(): SessionManagerInstance {
    return {
      instanceId: this.instanceId,
      hostname: os.hostname(),
      port: parseInt(process.env.PORT || '3000'),
      region: process.env.AWS_REGION || process.env.REGION || 'local',
      isHealthy: true,
      weight: 100, // Default weight
      currentLoad: 0,
      maxCapacity: this.scalingConfig.targetSessionsPerInstance,
      sessionCount: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      responseTime: 0,
      lastHeartbeat: new Date(),
      startTime: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      capabilities: ['session_management', 'load_balancing', 'horizontal_scaling'],
      metadata: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: os.totalmem(),
        cpuCount: os.cpus().length
      }
    };
  }

  /**
   * Create initial resource metrics
   */
  private createInitialResourceMetrics(): ResourceMetrics {
    return {
      instanceId: this.instanceId,
      timestamp: new Date(),
      cpuUsage: 0,
      memoryUsage: 0,
      sessionCount: 0,
      activeConnections: 0,
      requestsPerSecond: 0,
      averageResponseTime: 0,
      errorRate: 0,
      networkLatency: 0,
      diskUsage: 0,
      customMetrics: {}
    };
  }

  /**
   * Create initial load balancer state
   */
  private createInitialLoadBalancerState(): LoadBalancerState {
    return {
      currentAlgorithm: this.loadBalancingConfig.algorithm,
      activeInstances: [],
      totalSessions: 0,
      totalCapacity: 0,
      averageLoad: 0,
      healthyInstances: 0,
      lastRebalance: new Date(),
      failoverCount: 0,
      performanceMetrics: {
        requestsPerSecond: 0,
        averageResponseTime: 0,
        errorRate: 0,
        throughput: 0
      }
    };
  }

  // ============================================================================
  // INITIALIZATION AND LIFECYCLE MANAGEMENT - TASK 29
  // ============================================================================

  /**
   * Initialize the enhanced session manager with load balancing and scaling
   */
  async initializeEnhancedSessionManager(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enhanced session manager already initialized');
      return;
    }

    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('🚀 Initializing enhanced session manager with load balancing and scaling...', {
        correlationId,
        instanceId: this.instanceId
      });

      // Initialize TwikitCacheManager integration
      await this.initializeCacheManagerIntegration();

      // Register this instance in the distributed registry
      await this.registerInstance();

      // Start performance monitoring
      this.startPerformanceMonitoring();

      // Start instance discovery
      this.startInstanceDiscovery();

      // Start load balancing
      this.startLoadBalancing();

      // Start scaling evaluation
      this.startScalingEvaluation();

      this.isInitialized = true;

      const duration = Date.now() - startTime;
      logger.info('✅ Enhanced session manager initialized successfully', {
        correlationId,
        instanceId: this.instanceId,
        duration,
        loadBalancingAlgorithm: this.loadBalancingConfig.algorithm,
        scalingEnabled: this.scalingConfig.enabled
      });

      this.emit('initialized', { correlationId, instanceId: this.instanceId, duration });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ Failed to initialize enhanced session manager', {
        correlationId,
        instanceId: this.instanceId,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new TwikitError(
        TwikitErrorType.INITIALIZATION_ERROR,
        'Failed to initialize enhanced session manager',
        { correlationId, instanceId: this.instanceId, error, duration }
      );
    }
  }

  /**
   * Create or get existing Twikit session
   */
  async createSession(options: TwikitSessionOptions): Promise<TwikitSession> {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const existingSession = this.sessions.get(options.accountId);

      if (existingSession && existingSession.isActive) {
        logTwikitSession('created', existingSession.sessionId, options.accountId, {
          correlationId,
          duration: Date.now() - startTime,
          metadata: { reused: true, existingSessionId: existingSession.sessionId }
        });
        return existingSession;
      }

      const sessionId = `twikit_${options.accountId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logTwikitSession('created', sessionId, options.accountId, {
        correlationId,
        metadata: {
          newSession: true,
          enableAntiDetection: options.enableAntiDetection,
          enableHealthMonitoring: options.enableHealthMonitoring,
          proxyCount: options.proxyConfigs?.length || 0
        }
      });

      const session: TwikitSession = {
        sessionId,
        accountId: options.accountId,
        process: null,
        isActive: false,
        isAuthenticated: false,
        createdAt: new Date(),
        lastActivity: new Date(),
        options: sanitizeData(options) as TwikitSessionOptions, // Sanitize sensitive data
        metrics: {
          sessionId,
          accountId: options.accountId,
          sessionDuration: 0,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          proxyRotations: 0,
          authenticationAttempts: 0,
          successRate: 0,
          currentProxy: 'direct',
          proxyHealth: 1.0,
          actionCount: 0,
          authenticated: false,
          lastActivity: new Date(),
          status: 'idle'
        }
      };

      // Store session in memory and cache
      this.sessions.set(options.accountId, session);
      await this.persistSessionToCache(session);

      // Start health monitoring for this session if enabled
      if (options.enableHealthMonitoring) {
        this.startSessionHealthMonitoring(session);
      }

      const duration = Date.now() - startTime;

      logTwikitSession('created', sessionId, options.accountId, {
        correlationId,
        duration,
        metadata: {
          success: true,
          sessionCreated: true,
          healthMonitoringEnabled: options.enableHealthMonitoring
        }
      });

      logger.info(`Created new Twikit session ${sessionId} for account ${options.accountId}`);
      this.emit('sessionCreated', session);

      return session;

    } catch (error) {
      const duration = Date.now() - startTime;
      const twikitError = error instanceof Error ? error : new Error('Unknown session creation error');

      const failedSessionId = `failed_${options.accountId}_${Date.now()}`;
      logTwikitSession('failed', failedSessionId, options.accountId, {
        correlationId,
        duration,
        error: twikitError,
        metadata: {
          sessionCreationFailed: true,
          errorMessage: twikitError.message
        }
      });

      logger.error(`Failed to create Twikit session for account ${options.accountId}:`, twikitError);

      // Clean up any partial session data
      this.sessions.delete(options.accountId);

      throw new TwikitError(
        TwikitErrorType.SESSION_CREATION_FAILED,
        `Failed to create session for account ${options.accountId}: ${twikitError.message}`,
        { accountId: options.accountId, correlationId, originalError: twikitError.message }
      );
    }
  }

  /**
   * Execute action on Twikit session
   */
  async executeAction(accountId: string, action: string, params: any = {}): Promise<any> {
    const session = this.sessions.get(accountId);
    if (!session) {
      throw new Error(`No session found for account ${accountId}`);
    }

    try {
      session.metrics.totalRequests++;
      session.lastActivity = new Date();
      session.metrics.lastActivity = new Date();

      // Prepare script parameters
      const scriptParams = {
        ...params,
        accountId: session.accountId,
        credentials: session.options.credentials,
        cookiesFile: path.join(this.cookiesDir, `${session.accountId}_cookies.json`),
        proxyConfigs: session.options.proxyConfigs || [],
        sessionConfig: session.options.sessionConfig,
        retryConfig: session.options.retryConfig
      };

      // Execute Python script
      const result = await this.executePythonScript(session, action, scriptParams);

      // Update session metrics based on result
      if (result.success) {
        session.metrics.successfulRequests++;
        session.metrics.status = 'active';
        
        if (action === 'authenticate' && result.success) {
          session.isAuthenticated = true;
          session.metrics.authenticated = true;
          session.metrics.authenticationAttempts++;
        }

        // Update proxy information if available
        if (result.proxy_used) {
          session.metrics.currentProxy = result.proxy_used;
          if (result.proxy_used !== session.metrics.currentProxy) {
            session.metrics.proxyRotations++;
          }
        }

        // Update session metrics from Python client
        if (result.session_metrics) {
          Object.assign(session.metrics, result.session_metrics);
        }
      } else {
        session.metrics.failedRequests++;
        
        // Handle specific error types
        if (result.error_type === 'suspension') {
          session.metrics.status = 'suspended';
          this.emit('sessionSuspended', session);
        } else if (result.error_type === 'authentication') {
          session.isAuthenticated = false;
          session.metrics.authenticated = false;
        }
      }

      // Calculate success rate
      session.metrics.successRate = (
        session.metrics.successfulRequests / Math.max(1, session.metrics.totalRequests)
      ) * 100;

      // Update session duration
      session.metrics.sessionDuration = (
        new Date().getTime() - session.createdAt.getTime()
      ) / 1000;

      // Persist updated session
      await this.persistSessionToCache(session);

      logger.debug(`Executed action ${action} for account ${accountId}:`, {
        success: result.success,
        sessionId: session.sessionId,
        totalRequests: session.metrics.totalRequests,
        successRate: session.metrics.successRate
      });

      return result;

    } catch (error) {
      session.metrics.failedRequests++;
      session.metrics.status = 'error';
      
      logger.error(`Action execution failed for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize enterprise process manager
   */
  private async initializeProcessManager(): Promise<void> {
    try {
      await this.processManager.initialize();
      logger.info('Enterprise Python process manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize process manager:', error);
      throw error;
    }
  }

  /**
   * Execute Python script with enterprise process management
   */
  private async executePythonScript(session: TwikitSession, action: string, params: any): Promise<any> {
    try {
      const result = await this.processManager.executeAction(
        session.sessionId,
        action,
        params
      );

      if (result.success) {
        // Update session with process information
        session.isActive = true;
        session.lastActivity = new Date();

        return result.data;
      } else {
        throw new Error(result.error || 'Unknown process execution error');
      }

    } catch (error) {
      logger.error('Enterprise Python script execution failed:', {
        sessionId: session.sessionId,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get session by account ID
   */
  getSession(accountId: string): TwikitSession | null {
    return this.sessions.get(accountId) || null;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): TwikitSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(accountId: string): Promise<SessionMetrics | null> {
    const session = this.sessions.get(accountId);
    if (!session) {
      return null;
    }

    // Try to get fresh metrics from Python client
    try {
      const result = await this.executeAction(accountId, 'get_session_metrics');
      if (result.success && result.session_metrics) {
        Object.assign(session.metrics, result.session_metrics);
        await this.persistSessionToCache(session);
      }
    } catch (error) {
      logger.warn(`Failed to get fresh metrics for account ${accountId}:`, error);
    }

    return { ...session.metrics };
  }

  /**
   * Destroy session and cleanup resources
   */
  async destroySession(accountId: string): Promise<boolean> {
    const session = this.sessions.get(accountId);
    if (!session) {
      return false;
    }

    try {
      // Stop health monitoring
      if (session.healthCheckInterval) {
        clearInterval(session.healthCheckInterval);
      }

      // Cleanup through enterprise process manager
      try {
        await this.executeAction(accountId, 'cleanup');
      } catch (error) {
        logger.warn(`Failed to cleanup Python client for account ${accountId}:`, error);
      }

      // Remove from cache
      await cacheManager.del(`twikit_session:${accountId}`);

      // Remove from memory
      this.sessions.delete(accountId);

      logger.info(`Destroyed session for account ${accountId}`);
      this.emit('sessionDestroyed', session);

      return true;
    } catch (error) {
      logger.error(`Failed to destroy session for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Persist session to Redis cache
   */
  private async persistSessionToCache(session: TwikitSession): Promise<void> {
    try {
      const cacheKey = `twikit_session:${session.accountId}`;
      const sessionData = {
        sessionId: session.sessionId,
        accountId: session.accountId,
        isActive: session.isActive,
        isAuthenticated: session.isAuthenticated,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        metrics: session.metrics,
        options: {
          ...session.options,
          credentials: undefined // Don't cache credentials for security
        }
      };

      await cacheManager.set(cacheKey, sessionData, 3600); // 1 hour TTL
    } catch (error) {
      logger.error(`Failed to persist session to cache for account ${session.accountId}:`, error);
    }
  }

  /**
   * Load session from Redis cache
   */
  private async loadSessionFromCache(accountId: string): Promise<TwikitSession | null> {
    try {
      const cacheKey = `twikit_session:${accountId}`;
      const sessionData = await cacheManager.get(cacheKey) as any;

      if (!sessionData) {
        return null;
      }

      // Reconstruct session object (without process reference)
      const session: TwikitSession = {
        sessionId: sessionData.sessionId,
        accountId: sessionData.accountId,
        isActive: sessionData.isActive,
        isAuthenticated: sessionData.isAuthenticated,
        process: null,
        createdAt: new Date(sessionData.createdAt),
        lastActivity: new Date(sessionData.lastActivity),
        metrics: {
          ...sessionData.metrics,
          lastActivity: new Date(sessionData.metrics.lastActivity)
        },
        options: sessionData.options
      };

      return session;
    } catch (error) {
      logger.error(`Failed to load session from cache for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Start health monitoring for a specific session
   */
  private startSessionHealthMonitoring(session: TwikitSession): void {
    if (session.healthCheckInterval) {
      clearInterval(session.healthCheckInterval);
    }

    session.healthCheckInterval = setInterval(async () => {
      try {
        const result = await this.executeAction(session.accountId, 'check_health');

        if (result.success) {
          session.metrics.status = result.healthy ? 'active' : 'suspended';

          if (!result.healthy) {
            logger.warn(`Account ${session.accountId} health check failed:`, result.message);
            this.emit('sessionUnhealthy', session, result);
          }
        } else {
          session.metrics.status = 'error';
          logger.error(`Health check failed for account ${session.accountId}:`, result.error);
        }

        await this.persistSessionToCache(session);
      } catch (error) {
        logger.error(`Health monitoring error for account ${session.accountId}:`, error);
        session.metrics.status = 'error';
      }
    }, 300000); // Check every 5 minutes
  }

  /**
   * Start global health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);

      logger.debug(`Health monitoring: ${activeSessions.length} active sessions`);

      for (const session of activeSessions) {
        // Check session age and activity
        const sessionAge = Date.now() - session.createdAt.getTime();
        const lastActivity = Date.now() - session.lastActivity.getTime();

        // Mark sessions as idle if no activity for 30 minutes
        if (lastActivity > 1800000) { // 30 minutes
          session.metrics.status = 'idle';
          await this.persistSessionToCache(session);
        }

        // Auto-cleanup very old sessions (24 hours)
        if (sessionAge > 86400000) { // 24 hours
          logger.info(`Auto-cleaning up old session for account ${session.accountId}`);
          await this.destroySession(session.accountId);
        }
      }
    }, 600000); // Check every 10 minutes
  }

  /**
   * Start session cleanup process
   */
  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(async () => {
      const sessions = Array.from(this.sessions.values());

      for (const session of sessions) {
        // Cleanup failed or suspended sessions after 1 hour
        if (
          (session.metrics.status === 'error' || session.metrics.status === 'suspended') &&
          Date.now() - session.lastActivity.getTime() > 3600000 // 1 hour
        ) {
          logger.info(`Cleaning up failed session for account ${session.accountId}`);
          await this.destroySession(session.accountId);
        }
      }
    }, 1800000); // Check every 30 minutes
  }

  /**
   * Restore session from cache on startup
   */
  async restoreSessionFromCache(accountId: string, credentials: any): Promise<TwikitSession | null> {
    try {
      const cachedSession = await this.loadSessionFromCache(accountId);
      if (!cachedSession) {
        return null;
      }

      // Restore credentials (not cached for security)
      cachedSession.options.credentials = credentials;

      // Add back to active sessions
      this.sessions.set(accountId, cachedSession);

      // Restart health monitoring if enabled
      if (cachedSession.options.enableHealthMonitoring) {
        this.startSessionHealthMonitoring(cachedSession);
      }

      logger.info(`Restored session from cache for account ${accountId}`);
      this.emit('sessionRestored', cachedSession);

      return cachedSession;
    } catch (error) {
      logger.error(`Failed to restore session from cache for account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(): {
    totalSessions: number;
    activeSessions: number;
    authenticatedSessions: number;
    suspendedSessions: number;
    errorSessions: number;
    idleSessions: number;
    averageSuccessRate: number;
    totalRequests: number;
    totalSuccessfulRequests: number;
  } {
    const sessions = Array.from(this.sessions.values());

    const stats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.metrics.status === 'active').length,
      authenticatedSessions: sessions.filter(s => s.isAuthenticated).length,
      suspendedSessions: sessions.filter(s => s.metrics.status === 'suspended').length,
      errorSessions: sessions.filter(s => s.metrics.status === 'error').length,
      idleSessions: sessions.filter(s => s.metrics.status === 'idle').length,
      averageSuccessRate: 0,
      totalRequests: 0,
      totalSuccessfulRequests: 0
    };

    if (sessions.length > 0) {
      const totalSuccessRate = sessions.reduce((sum, s) => sum + s.metrics.successRate, 0);
      stats.averageSuccessRate = totalSuccessRate / sessions.length;

      stats.totalRequests = sessions.reduce((sum, s) => sum + s.metrics.totalRequests, 0);
      stats.totalSuccessfulRequests = sessions.reduce((sum, s) => sum + s.metrics.successfulRequests, 0);
    }

    return stats;
  }

  /**
   * Force session refresh (re-authenticate and reset metrics)
   */
  async refreshSession(accountId: string): Promise<boolean> {
    const session = this.sessions.get(accountId);
    if (!session) {
      return false;
    }

    try {
      logger.info(`Refreshing session for account ${accountId}`);

      // Reset authentication status
      session.isAuthenticated = false;
      session.metrics.authenticated = false;

      // Attempt re-authentication
      const authResult = await this.executeAction(accountId, 'authenticate');

      if (authResult.success) {
        session.isAuthenticated = true;
        session.metrics.authenticated = true;
        session.metrics.status = 'active';
        session.lastActivity = new Date();

        await this.persistSessionToCache(session);

        logger.info(`Successfully refreshed session for account ${accountId}`);
        this.emit('sessionRefreshed', session);

        return true;
      } else {
        logger.error(`Failed to refresh session for account ${accountId}:`, authResult.error);
        session.metrics.status = 'error';
        return false;
      }
    } catch (error) {
      logger.error(`Error refreshing session for account ${accountId}:`, error);
      session.metrics.status = 'error';
      return false;
    }
  }

  /**
   * Bulk session operations
   */
  async bulkExecuteAction(accountIds: string[], action: string, params: any = {}): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    // Execute actions in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = [];

    for (let i = 0; i < accountIds.length; i += concurrencyLimit) {
      chunks.push(accountIds.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (accountId) => {
        try {
          const result = await this.executeAction(accountId, action, params);
          results.set(accountId, result);
        } catch (error) {
          results.set(accountId, {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.all(promises);
    }

    logger.info(`Bulk executed action ${action} for ${accountIds.length} accounts`);
    return results;
  }

  /**
   * Session health check for all sessions
   */
  async performHealthCheckAll(): Promise<Map<string, any>> {
    const accountIds = Array.from(this.sessions.keys());
    return await this.bulkExecuteAction(accountIds, 'check_health');
  }

  /**
   * Get session by status
   */
  getSessionsByStatus(status: 'active' | 'suspended' | 'error' | 'idle'): TwikitSession[] {
    return Array.from(this.sessions.values()).filter(s => s.metrics.status === status);
  }

  /**
   * Update session configuration
   */
  async updateSessionConfig(accountId: string, newConfig: Partial<TwikitSessionOptions>): Promise<boolean> {
    const session = this.sessions.get(accountId);
    if (!session) {
      return false;
    }

    try {
      // Update session options
      Object.assign(session.options, newConfig);

      // Persist updated session
      await this.persistSessionToCache(session);

      logger.info(`Updated configuration for session ${accountId}`);
      this.emit('sessionConfigUpdated', session);

      return true;
    } catch (error) {
      logger.error(`Failed to update session config for account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Close a specific session
   */
  async closeSession(accountId: string): Promise<void> {
    try {
      const session = this.sessions.get(accountId);
      if (!session) {
        logger.debug('No session found to close', {
          accountId: sanitizeData(accountId)
        });
        return;
      }

      logger.info('Closing session', {
        accountId: sanitizeData(accountId),
        sessionId: session.sessionId
      });

      // Update session state
      session.isActive = false;
      session.lastActivity = new Date();

      // Update database
      try {
        await prisma.twikitSession.update({
          where: { id: session.sessionId },
          data: {
            sessionState: 'INACTIVE',
            lastActivity: new Date()
          }
        });
      } catch (dbError) {
        logger.error('Failed to update session state in database', {
          accountId: sanitizeData(accountId),
          sessionId: session.sessionId,
          error: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      }

      // Remove from active sessions
      this.sessions.delete(accountId);

      // Emit session closed event
      this.emit('sessionClosed', {
        accountId,
        sessionId: session.sessionId,
        closedAt: new Date()
      });

      logger.info('Session closed successfully', {
        accountId: sanitizeData(accountId),
        sessionId: session.sessionId
      });
    } catch (error) {
      logger.error('Error closing session', {
        accountId: sanitizeData(accountId),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Initialize session manager (called on startup)
   */
  async initialize(): Promise<void> {
    logger.info('Initializing TwikitSessionManager...');

    try {
      // Ensure cookies directory exists
      const fs = await import('fs/promises');
      const { existsSync } = await import('fs');

      if (!existsSync(this.cookiesDir)) {
        await fs.mkdir(this.cookiesDir, { recursive: true });
        logger.info(`Created cookies directory: ${this.cookiesDir}`);
      }

      // Load any persisted sessions from database
      await this.loadPersistedSessions();

      logger.info('TwikitSessionManager initialization complete');
    } catch (error) {
      logger.error('Failed to initialize TwikitSessionManager:', error);
      throw error;
    }
  }

  /**
   * Load persisted sessions from database
   */
  private async loadPersistedSessions(): Promise<void> {
    try {
      // Get active X accounts from database
      const activeAccounts = await prisma.xAccount.findMany({
        where: {
          status: {
            in: ['authenticated', 'active']
          }
        },
        select: {
          id: true,
          username: true,
          email: true,
          // Note: password should be encrypted in database
        }
      });

      logger.info(`Found ${activeAccounts.length} active accounts to restore sessions for`);

      // Attempt to restore sessions from cache
      for (const account of activeAccounts) {
        try {
          const credentials = {
            username: account.username,
            email: account.email || '',
            password: '' // Would need to decrypt from database
          };

          await this.restoreSessionFromCache(account.id, credentials);
        } catch (error) {
          logger.warn(`Failed to restore session for account ${account.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to load persisted sessions:', error);
    }
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get process manager statistics
   */
  getProcessStats(): any {
    return this.processManager.getPoolStats();
  }

  /**
   * Adjust delays for a session (for health monitoring integration)
   */
  async adjustDelays(accountId: string, parameters: any): Promise<void> {
    try {
      const session = this.sessions.get(accountId);
      if (!session) {
        logger.warn('Cannot adjust delays - session not found', {
          accountId: sanitizeData(accountId)
        });
        return;
      }

      // Apply delay adjustments
      const delayMultiplier = parameters.delayMultiplier || 1.0;

      // Update session configuration with new delays
      session.config = {
        ...session.config,
        delayMultiplier,
        lastDelayAdjustment: new Date()
      };

      logger.info('Session delays adjusted', {
        accountId: sanitizeData(accountId),
        delayMultiplier,
        sessionId: session.sessionId
      });
    } catch (error) {
      logger.error('Failed to adjust session delays', {
        accountId: sanitizeData(accountId),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Pause a session (for health monitoring integration)
   */
  async pauseSession(accountId: string, pauseDuration: number): Promise<void> {
    try {
      const session = this.sessions.get(accountId);
      if (!session) {
        logger.warn('Cannot pause session - session not found', {
          accountId: sanitizeData(accountId)
        });
        return;
      }

      // Mark session as paused
      session.isPaused = true;
      session.pausedAt = new Date();
      session.pauseDuration = pauseDuration;

      // Schedule resume
      setTimeout(() => {
        if (session.isPaused) {
          session.isPaused = false;
          delete session.pausedAt;
          delete session.pauseDuration;
          logger.info('Session automatically resumed after pause', {
            accountId: sanitizeData(accountId),
            sessionId: session.sessionId
          });
        }
      }, pauseDuration);

      logger.info('Session paused', {
        accountId: sanitizeData(accountId),
        pauseDuration,
        sessionId: session.sessionId
      });
    } catch (error) {
      logger.error('Failed to pause session', {
        accountId: sanitizeData(accountId),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Emergency stop a session (for health monitoring integration)
   */
  async emergencyStop(accountId: string): Promise<void> {
    try {
      const session = this.sessions.get(accountId);
      if (!session) {
        logger.warn('Cannot emergency stop - session not found', {
          accountId: sanitizeData(accountId)
        });
        return;
      }

      // Mark session for emergency stop
      session.isActive = false;
      session.emergencyStop = true;
      session.emergencyStoppedAt = new Date();

      // Close the session immediately
      await this.closeSession(accountId);

      logger.warn('Session emergency stopped', {
        accountId: sanitizeData(accountId),
        sessionId: session.sessionId
      });
    } catch (error) {
      logger.error('Failed to emergency stop session', {
        accountId: sanitizeData(accountId),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Legacy shutdown method - now calls enhanced shutdown
   */
  private async legacyShutdown(): Promise<void> {
    logger.info('Starting legacy TwikitSessionManager shutdown');

    // Stop monitoring intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }

    // Close all sessions
    const shutdownPromises = Array.from(this.sessions.keys()).map(accountId =>
      this.closeSession(accountId)
    );
    await Promise.allSettled(shutdownPromises);

    // Shutdown process manager
    await this.processManager.shutdown();

    // Clear sessions map
    this.sessions.clear();

    // Remove all event listeners
    this.removeAllListeners();

    logger.info('Legacy TwikitSessionManager shutdown complete');
  }

  // ============================================================================
  // LOAD BALANCING IMPLEMENTATION - TASK 29
  // ============================================================================

  /**
   * Initialize TwikitCacheManager integration
   */
  private async initializeCacheManagerIntegration(): Promise<void> {
    try {
      // Ensure TwikitCacheManager is initialized
      if (!twikitCacheManager) {
        throw new Error('TwikitCacheManager not available');
      }

      // Test cache integration
      await twikitCacheManager.set(
        `test_${this.instanceId}`,
        { test: true, timestamp: Date.now() },
        this.cacheContext
      );

      logger.info('TwikitCacheManager integration initialized successfully', {
        instanceId: this.instanceId
      });

    } catch (error) {
      logger.error('Failed to initialize TwikitCacheManager integration', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register this instance in the distributed registry
   */
  private async registerInstance(): Promise<void> {
    try {
      const registryKey = `${this.INSTANCE_REGISTRY_KEY}:${this.instanceId}`;

      // Update instance info with current metrics
      this.instanceInfo.lastHeartbeat = new Date();
      this.instanceInfo.sessionCount = this.sessions.size;
      this.instanceInfo.currentLoad = this.calculateCurrentLoad();

      // Register in cache with TTL
      await twikitCacheManager.set(
        registryKey,
        this.instanceInfo,
        {
          ...this.cacheContext,
          operationType: 'instance_registration',
          tags: ['instance', 'registry', 'heartbeat']
        }
      );

      // Also register in local active instances
      this.activeInstances.set(this.instanceId, this.instanceInfo);

      logger.info('Instance registered successfully', {
        instanceId: this.instanceId,
        registryKey,
        sessionCount: this.instanceInfo.sessionCount,
        currentLoad: this.instanceInfo.currentLoad
      });

    } catch (error) {
      logger.error('Failed to register instance', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
    }

    this.performanceMonitoringInterval = setInterval(async () => {
      try {
        await this.collectResourceMetrics();
        await this.updateInstanceInfo();
        await this.registerInstance(); // Update heartbeat
      } catch (error) {
        logger.error('Performance monitoring error', {
          instanceId: this.instanceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 30000); // Every 30 seconds

    logger.info('Performance monitoring started', {
      instanceId: this.instanceId,
      interval: 30000
    });
  }

  /**
   * Start instance discovery
   */
  private startInstanceDiscovery(): void {
    if (this.instanceDiscoveryInterval) {
      clearInterval(this.instanceDiscoveryInterval);
    }

    this.instanceDiscoveryInterval = setInterval(async () => {
      try {
        await this.discoverActiveInstances();
        await this.updateLoadBalancerState();
      } catch (error) {
        logger.error('Instance discovery error', {
          instanceId: this.instanceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 60000); // Every minute

    logger.info('Instance discovery started', {
      instanceId: this.instanceId,
      interval: 60000
    });
  }

  /**
   * Start load balancing
   */
  private startLoadBalancing(): void {
    if (this.loadBalancingInterval) {
      clearInterval(this.loadBalancingInterval);
    }

    this.loadBalancingInterval = setInterval(async () => {
      try {
        await this.rebalanceLoad();
        await this.cleanupSessionAffinity();
      } catch (error) {
        logger.error('Load balancing error', {
          instanceId: this.instanceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.loadBalancingConfig.weightUpdateInterval);

    logger.info('Load balancing started', {
      instanceId: this.instanceId,
      algorithm: this.loadBalancingConfig.algorithm,
      interval: this.loadBalancingConfig.weightUpdateInterval
    });
  }

  /**
   * Start scaling evaluation
   */
  private startScalingEvaluation(): void {
    if (!this.scalingConfig.enabled) {
      logger.info('Horizontal scaling disabled');
      return;
    }

    if (this.scalingEvaluationInterval) {
      clearInterval(this.scalingEvaluationInterval);
    }

    this.scalingEvaluationInterval = setInterval(async () => {
      try {
        await this.evaluateScalingNeeds();
      } catch (error) {
        logger.error('Scaling evaluation error', {
          instanceId: this.instanceId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 60000); // Every minute

    logger.info('Scaling evaluation started', {
      instanceId: this.instanceId,
      enabled: this.scalingConfig.enabled,
      minInstances: this.scalingConfig.minInstances,
      maxInstances: this.scalingConfig.maxInstances
    });
  }

  /**
   * Calculate current load percentage
   */
  private calculateCurrentLoad(): number {
    const sessionLoad = (this.sessions.size / this.instanceInfo.maxCapacity) * 100;
    const cpuLoad = this.resourceMetrics.cpuUsage;
    const memoryLoad = this.resourceMetrics.memoryUsage;

    // Weighted average of different load factors
    return Math.round((sessionLoad * 0.4 + cpuLoad * 0.3 + memoryLoad * 0.3));
  }

  /**
   * Collect resource metrics
   */
  private async collectResourceMetrics(): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = await this.getCpuUsage();

      this.resourceMetrics = {
        instanceId: this.instanceId,
        timestamp: new Date(),
        cpuUsage,
        memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        sessionCount: this.sessions.size,
        activeConnections: this.getActiveConnectionsCount(),
        requestsPerSecond: this.calculateRequestsPerSecond(),
        averageResponseTime: this.calculateAverageResponseTime(),
        errorRate: this.calculateErrorRate(),
        networkLatency: 0, // Would implement actual network latency measurement
        diskUsage: 0, // Would implement actual disk usage measurement
        customMetrics: {
          processUptime: process.uptime(),
          eventLoopDelay: 0, // Would implement actual event loop delay measurement
          gcCount: 0 // Would implement actual GC count measurement
        }
      };

      // Cache metrics for monitoring
      await twikitCacheManager.set(
        `metrics:${this.instanceId}`,
        this.resourceMetrics,
        {
          ...this.cacheContext,
          operationType: 'resource_metrics',
          tags: ['metrics', 'performance', 'monitoring']
        }
      );

    } catch (error) {
      logger.error('Failed to collect resource metrics', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const cpuPercent = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(cpuPercent, 100));
      }, 100);
    });
  }

  /**
   * Get active connections count
   */
  private getActiveConnectionsCount(): number {
    // Count active sessions with processes
    return Array.from(this.sessions.values()).filter(s => s.isActive && s.process).length;
  }

  /**
   * Calculate requests per second
   */
  private calculateRequestsPerSecond(): number {
    // Would implement actual RPS calculation based on recent activity
    const totalRequests = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.metrics.totalRequests, 0);

    // Simple approximation - would use sliding window in production
    return Math.round(totalRequests / Math.max(process.uptime(), 1));
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    const sessions = Array.from(this.sessions.values());
    if (sessions.length === 0) return 0;

    // Would implement actual response time tracking in production
    return sessions.reduce((sum, session) => {
      // Estimate based on session health and activity
      const baseTime = session.isAuthenticated ? 100 : 500;
      const loadFactor = session.metrics.successRate < 0.9 ? 2 : 1;
      return sum + (baseTime * loadFactor);
    }, 0) / sessions.length;
  }

  /**
   * Calculate error rate percentage
   */
  private calculateErrorRate(): number {
    const sessions = Array.from(this.sessions.values());
    if (sessions.length === 0) return 0;

    const totalRequests = sessions.reduce((sum, s) => sum + s.metrics.totalRequests, 0);
    const failedRequests = sessions.reduce((sum, s) => sum + s.metrics.failedRequests, 0);

    return totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  }

  /**
   * Update instance information
   */
  private async updateInstanceInfo(): Promise<void> {
    this.instanceInfo.lastHeartbeat = new Date();
    this.instanceInfo.sessionCount = this.sessions.size;
    this.instanceInfo.currentLoad = this.calculateCurrentLoad();
    this.instanceInfo.cpuUsage = this.resourceMetrics.cpuUsage;
    this.instanceInfo.memoryUsage = this.resourceMetrics.memoryUsage;
    this.instanceInfo.responseTime = this.resourceMetrics.averageResponseTime;
    this.instanceInfo.isHealthy = this.isInstanceHealthy();
  }

  /**
   * Check if instance is healthy
   */
  private isInstanceHealthy(): boolean {
    const cpuOk = this.resourceMetrics.cpuUsage < 90;
    const memoryOk = this.resourceMetrics.memoryUsage < 90;
    const errorRateOk = this.resourceMetrics.errorRate < 10;
    const responseTimeOk = this.resourceMetrics.averageResponseTime < 5000;

    return cpuOk && memoryOk && errorRateOk && responseTimeOk;
  }

  /**
   * Discover active instances
   */
  private async discoverActiveInstances(): Promise<void> {
    try {
      // Get all registered instances from cache
      const instanceKeys = await this.getInstanceKeys();
      const currentTime = Date.now();
      const ttlThreshold = this.scalingConfig.instanceRegistrationTtl * 1000;

      for (const key of instanceKeys) {
        try {
          const instanceInfo = await twikitCacheManager.get<SessionManagerInstance>(
            key,
            {
              ...this.cacheContext,
              operationType: 'instance_discovery',
              tags: ['instance', 'discovery']
            }
          );

          if (instanceInfo) {
            // Check if instance is still alive (within TTL)
            const lastHeartbeat = new Date(instanceInfo.lastHeartbeat).getTime();
            const isAlive = (currentTime - lastHeartbeat) < ttlThreshold;

            if (isAlive) {
              this.activeInstances.set(instanceInfo.instanceId, instanceInfo);
            } else {
              // Remove stale instance
              this.activeInstances.delete(instanceInfo.instanceId);
              logger.warn('Removed stale instance', {
                instanceId: instanceInfo.instanceId,
                lastHeartbeat: instanceInfo.lastHeartbeat
              });
            }
          }
        } catch (error) {
          logger.warn('Failed to process instance key', {
            key,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.debug('Instance discovery completed', {
        activeInstances: this.activeInstances.size,
        discoveredKeys: instanceKeys.length
      });

    } catch (error) {
      logger.error('Failed to discover active instances', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get instance keys from cache
   */
  private async getInstanceKeys(): Promise<string[]> {
    // This is a simplified implementation
    // In production, you'd use Redis SCAN or similar pattern matching
    const keys: string[] = [];

    // For now, we'll track known instances
    // In a real implementation, you'd scan the cache for instance keys
    for (const instanceId of this.activeInstances.keys()) {
      keys.push(`${this.INSTANCE_REGISTRY_KEY}:${instanceId}`);
    }

    return keys;
  }

  /**
   * Update load balancer state
   */
  private async updateLoadBalancerState(): Promise<void> {
    try {
      const activeInstancesArray = Array.from(this.activeInstances.values());
      const healthyInstances = activeInstancesArray.filter(i => i.isHealthy);

      this.loadBalancerState = {
        currentAlgorithm: this.loadBalancingConfig.algorithm,
        activeInstances: activeInstancesArray,
        totalSessions: activeInstancesArray.reduce((sum, i) => sum + i.sessionCount, 0),
        totalCapacity: activeInstancesArray.reduce((sum, i) => sum + i.maxCapacity, 0),
        averageLoad: activeInstancesArray.length > 0
          ? activeInstancesArray.reduce((sum, i) => sum + i.currentLoad, 0) / activeInstancesArray.length
          : 0,
        healthyInstances: healthyInstances.length,
        lastRebalance: new Date(),
        failoverCount: this.loadBalancerState.failoverCount,
        performanceMetrics: {
          requestsPerSecond: activeInstancesArray.reduce((sum, i) => sum + (i.metadata.requestsPerSecond || 0), 0),
          averageResponseTime: activeInstancesArray.length > 0
            ? activeInstancesArray.reduce((sum, i) => sum + i.responseTime, 0) / activeInstancesArray.length
            : 0,
          errorRate: this.calculateClusterErrorRate(activeInstancesArray),
          throughput: this.calculateClusterThroughput(activeInstancesArray)
        }
      };

      // Cache the load balancer state
      await twikitCacheManager.set(
        this.LOAD_BALANCER_STATE_KEY,
        this.loadBalancerState,
        {
          ...this.cacheContext,
          operationType: 'load_balancer_state',
          tags: ['load_balancer', 'state', 'metrics']
        }
      );

    } catch (error) {
      logger.error('Failed to update load balancer state', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Calculate cluster error rate
   */
  private calculateClusterErrorRate(instances: SessionManagerInstance[]): number {
    if (instances.length === 0) return 0;

    // Would implement actual cluster-wide error rate calculation
    return instances.reduce((sum, instance) => {
      return sum + (instance.metadata.errorRate || 0);
    }, 0) / instances.length;
  }

  /**
   * Calculate cluster throughput
   */
  private calculateClusterThroughput(instances: SessionManagerInstance[]): number {
    return instances.reduce((sum, instance) => {
      return sum + (instance.metadata.throughput || 0);
    }, 0);
  }

  // ============================================================================
  // LOAD BALANCING ALGORITHMS - TASK 29
  // ============================================================================

  /**
   * Select best instance for new session using configured algorithm
   */
  async selectInstanceForSession(
    accountId: string,
    clientIp?: string,
    options?: { preferredRegion?: string; requireCapacity?: number }
  ): Promise<SessionManagerInstance | null> {
    try {
      const healthyInstances = Array.from(this.activeInstances.values())
        .filter(i => i.isHealthy && i.currentLoad < 95);

      if (healthyInstances.length === 0) {
        logger.warn('No healthy instances available for session creation', {
          totalInstances: this.activeInstances.size,
          accountId
        });
        return null;
      }

      // Check session affinity first
      if (this.loadBalancingConfig.sessionAffinity) {
        const affinityInstanceId = this.sessionAffinityMap.get(accountId);
        if (affinityInstanceId) {
          const affinityInstance = this.activeInstances.get(affinityInstanceId);
          if (affinityInstance && affinityInstance.isHealthy && affinityInstance.currentLoad < 90) {
            logger.debug('Using session affinity', {
              accountId,
              instanceId: affinityInstanceId
            });
            return affinityInstance;
          } else {
            // Remove stale affinity
            this.sessionAffinityMap.delete(accountId);
          }
        }
      }

      // Apply algorithm-specific selection
      let selectedInstance: SessionManagerInstance | null = null;

      switch (this.loadBalancingConfig.algorithm) {
        case LoadBalancingAlgorithm.ROUND_ROBIN:
          selectedInstance = this.selectRoundRobin(healthyInstances);
          break;
        case LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN:
          selectedInstance = this.selectWeightedRoundRobin(healthyInstances);
          break;
        case LoadBalancingAlgorithm.LEAST_CONNECTIONS:
          selectedInstance = this.selectLeastConnections(healthyInstances);
          break;
        case LoadBalancingAlgorithm.IP_HASH:
          selectedInstance = this.selectIpHash(healthyInstances, clientIp || accountId);
          break;
        case LoadBalancingAlgorithm.GEOGRAPHIC:
          selectedInstance = this.selectGeographic(healthyInstances, options?.preferredRegion);
          break;
        case LoadBalancingAlgorithm.HEALTH_BASED:
          selectedInstance = this.selectHealthBased(healthyInstances);
          break;
        default:
          selectedInstance = this.selectWeightedRoundRobin(healthyInstances);
      }

      // Set session affinity if enabled
      if (selectedInstance && this.loadBalancingConfig.sessionAffinity) {
        this.sessionAffinityMap.set(accountId, selectedInstance.instanceId);

        // Set expiration for affinity
        setTimeout(() => {
          this.sessionAffinityMap.delete(accountId);
        }, this.loadBalancingConfig.affinityTimeout);
      }

      if (selectedInstance) {
        logger.info('Instance selected for session', {
          accountId,
          instanceId: selectedInstance.instanceId,
          algorithm: this.loadBalancingConfig.algorithm,
          currentLoad: selectedInstance.currentLoad,
          sessionCount: selectedInstance.sessionCount
        });
      }

      return selectedInstance;

    } catch (error) {
      logger.error('Failed to select instance for session', {
        accountId,
        algorithm: this.loadBalancingConfig.algorithm,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Round robin selection
   */
  private selectRoundRobin(instances: SessionManagerInstance[]): SessionManagerInstance {
    if (instances.length === 0) {
      throw new Error('No instances available for round robin selection');
    }
    const index = this.roundRobinIndex % instances.length;
    const instance = instances[index];
    if (!instance) {
      throw new Error(`Instance at index ${index} is undefined`);
    }
    this.roundRobinIndex = (this.roundRobinIndex + 1) % instances.length;
    return instance;
  }

  /**
   * Weighted round robin selection
   */
  private selectWeightedRoundRobin(instances: SessionManagerInstance[]): SessionManagerInstance {
    // Calculate total weight
    const totalWeight = instances.reduce((sum, instance) => {
      // Adjust weight based on current load (lower load = higher effective weight)
      const loadFactor = Math.max(0.1, (100 - instance.currentLoad) / 100);
      return sum + (instance.weight * loadFactor);
    }, 0);

    if (totalWeight === 0) {
      return this.selectRoundRobin(instances);
    }

    // Select based on weighted probability
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      const loadFactor = Math.max(0.1, (100 - instance.currentLoad) / 100);
      const effectiveWeight = instance.weight * loadFactor;

      if (random <= effectiveWeight) {
        return instance;
      }
      random -= effectiveWeight;
    }

    // Fallback to first instance
    if (instances.length === 0) {
      throw new Error('No instances available for weighted round robin selection');
    }
    const firstInstance = instances[0];
    if (!firstInstance) {
      throw new Error('First instance is undefined');
    }
    return firstInstance;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(instances: SessionManagerInstance[]): SessionManagerInstance {
    return instances.reduce((best, current) => {
      const bestScore = best.sessionCount + (best.currentLoad * 0.01);
      const currentScore = current.sessionCount + (current.currentLoad * 0.01);
      return currentScore < bestScore ? current : best;
    });
  }

  /**
   * IP hash selection for session affinity
   */
  private selectIpHash(instances: SessionManagerInstance[], identifier: string): SessionManagerInstance {
    if (instances.length === 0) {
      throw new Error('No instances available for IP hash selection');
    }

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const index = Math.abs(hash) % instances.length;
    const instance = instances[index];
    if (!instance) {
      throw new Error(`Instance at index ${index} is undefined`);
    }
    return instance;
  }

  /**
   * Geographic selection
   */
  private selectGeographic(instances: SessionManagerInstance[], preferredRegion?: string): SessionManagerInstance {
    if (preferredRegion) {
      const regionalInstances = instances.filter(i => i.region === preferredRegion);
      if (regionalInstances.length > 0) {
        return this.selectLeastConnections(regionalInstances);
      }
    }

    // Fallback to least connections
    return this.selectLeastConnections(instances);
  }

  /**
   * Health-based selection
   */
  private selectHealthBased(instances: SessionManagerInstance[]): SessionManagerInstance {
    // Score based on multiple health factors
    return instances.reduce((best, current) => {
      const bestScore = this.calculateHealthScore(best);
      const currentScore = this.calculateHealthScore(current);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculate health score for an instance
   */
  private calculateHealthScore(instance: SessionManagerInstance): number {
    const cpuScore = Math.max(0, 100 - instance.cpuUsage);
    const memoryScore = Math.max(0, 100 - instance.memoryUsage);
    const loadScore = Math.max(0, 100 - instance.currentLoad);
    const responseTimeScore = Math.max(0, 100 - (instance.responseTime / 50)); // Normalize response time

    // Weighted average
    return (cpuScore * 0.25 + memoryScore * 0.25 + loadScore * 0.3 + responseTimeScore * 0.2);
  }

  /**
   * Rebalance load across instances
   */
  private async rebalanceLoad(): Promise<void> {
    try {
      const instances = Array.from(this.activeInstances.values());
      const healthyInstances = instances.filter(i => i.isHealthy);

      if (healthyInstances.length < 2) {
        return; // No need to rebalance with less than 2 instances
      }

      // Check if rebalancing is needed
      const loadVariance = this.calculateLoadVariance(healthyInstances);
      const rebalanceThreshold = 30; // 30% load difference threshold

      if (loadVariance > rebalanceThreshold) {
        logger.info('Load imbalance detected, initiating rebalancing', {
          loadVariance,
          threshold: rebalanceThreshold,
          instances: healthyInstances.length
        });

        // Update instance weights based on current performance
        await this.updateInstanceWeights(healthyInstances);

        // Trigger session migration if enabled
        if (this.distributionStrategy.migrationEnabled) {
          await this.evaluateSessionMigration(healthyInstances);
        }

        this.loadBalancerState.lastRebalance = new Date();

        this.emit('loadRebalanced', {
          instanceCount: healthyInstances.length,
          loadVariance,
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.error('Failed to rebalance load', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Calculate load variance across instances
   */
  private calculateLoadVariance(instances: SessionManagerInstance[]): number {
    if (instances.length === 0) return 0;

    const loads = instances.map(i => i.currentLoad);
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);

    return maxLoad - minLoad;
  }

  /**
   * Update instance weights based on performance
   */
  private async updateInstanceWeights(instances: SessionManagerInstance[]): Promise<void> {
    for (const instance of instances) {
      // Calculate new weight based on performance metrics
      const healthScore = this.calculateHealthScore(instance);
      const newWeight = Math.max(10, Math.min(200, Math.round(healthScore * 2)));

      if (instance.weight !== newWeight) {
        instance.weight = newWeight;

        // Update in cache if this is our instance
        if (instance.instanceId === this.instanceId) {
          this.instanceInfo.weight = newWeight;
          await this.registerInstance();
        }

        logger.debug('Updated instance weight', {
          instanceId: instance.instanceId,
          oldWeight: instance.weight,
          newWeight,
          healthScore
        });
      }
    }
  }

  // ============================================================================
  // HORIZONTAL SCALING IMPLEMENTATION - TASK 29
  // ============================================================================

  /**
   * Evaluate scaling needs and trigger scaling actions
   */
  private async evaluateScalingNeeds(): Promise<void> {
    try {
      if (!this.scalingConfig.enabled) {
        return;
      }

      const instances = Array.from(this.activeInstances.values());
      const healthyInstances = instances.filter(i => i.isHealthy);
      const currentTime = Date.now();

      // Check cooldown periods
      const timeSinceLastScaling = currentTime - this.lastScalingAction.getTime();

      // Evaluate scale-up conditions
      if (this.shouldScaleUp(healthyInstances) &&
          timeSinceLastScaling > this.scalingConfig.scaleUpCooldown) {
        await this.triggerScaleUp(healthyInstances);
      }
      // Evaluate scale-down conditions
      else if (this.shouldScaleDown(healthyInstances) &&
               timeSinceLastScaling > this.scalingConfig.scaleDownCooldown) {
        await this.triggerScaleDown(healthyInstances);
      }

    } catch (error) {
      logger.error('Failed to evaluate scaling needs', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if scale-up is needed
   */
  private shouldScaleUp(healthyInstances: SessionManagerInstance[]): boolean {
    if (healthyInstances.length >= this.scalingConfig.maxInstances) {
      return false;
    }

    // Check multiple scale-up triggers
    const avgCpuUsage = healthyInstances.reduce((sum, i) => sum + i.cpuUsage, 0) / healthyInstances.length;
    const avgMemoryUsage = healthyInstances.reduce((sum, i) => sum + i.memoryUsage, 0) / healthyInstances.length;
    const avgLoad = healthyInstances.reduce((sum, i) => sum + i.currentLoad, 0) / healthyInstances.length;
    const totalSessions = healthyInstances.reduce((sum, i) => sum + i.sessionCount, 0);
    const avgSessionsPerInstance = totalSessions / healthyInstances.length;

    const cpuTrigger = avgCpuUsage > this.scalingConfig.targetCpuUtilization;
    const memoryTrigger = avgMemoryUsage > this.scalingConfig.targetMemoryUtilization;
    const sessionTrigger = avgSessionsPerInstance > this.scalingConfig.targetSessionsPerInstance;
    const loadTrigger = avgLoad > this.scalingConfig.scaleUpThreshold;

    const shouldScale = cpuTrigger || memoryTrigger || sessionTrigger || loadTrigger;

    if (shouldScale) {
      logger.info('Scale-up conditions met', {
        avgCpuUsage,
        avgMemoryUsage,
        avgLoad,
        avgSessionsPerInstance,
        triggers: {
          cpu: cpuTrigger,
          memory: memoryTrigger,
          sessions: sessionTrigger,
          load: loadTrigger
        }
      });
    }

    return shouldScale;
  }

  /**
   * Check if scale-down is needed
   */
  private shouldScaleDown(healthyInstances: SessionManagerInstance[]): boolean {
    if (healthyInstances.length <= this.scalingConfig.minInstances) {
      return false;
    }

    // Check scale-down conditions (more conservative)
    const avgCpuUsage = healthyInstances.reduce((sum, i) => sum + i.cpuUsage, 0) / healthyInstances.length;
    const avgMemoryUsage = healthyInstances.reduce((sum, i) => sum + i.memoryUsage, 0) / healthyInstances.length;
    const avgLoad = healthyInstances.reduce((sum, i) => sum + i.currentLoad, 0) / healthyInstances.length;

    const cpuOk = avgCpuUsage < (this.scalingConfig.targetCpuUtilization * 0.5);
    const memoryOk = avgMemoryUsage < (this.scalingConfig.targetMemoryUtilization * 0.5);
    const loadOk = avgLoad < this.scalingConfig.scaleDownThreshold;

    const shouldScale = cpuOk && memoryOk && loadOk;

    if (shouldScale) {
      logger.info('Scale-down conditions met', {
        avgCpuUsage,
        avgMemoryUsage,
        avgLoad,
        thresholds: {
          cpu: this.scalingConfig.targetCpuUtilization * 0.5,
          memory: this.scalingConfig.targetMemoryUtilization * 0.5,
          load: this.scalingConfig.scaleDownThreshold
        }
      });
    }

    return shouldScale;
  }

  /**
   * Trigger scale-up action
   */
  private async triggerScaleUp(currentInstances: SessionManagerInstance[]): Promise<void> {
    try {
      const scalingEvent: ScalingEvent = {
        eventId: generateCorrelationId(),
        eventType: 'scale_up',
        timestamp: new Date(),
        reason: 'High resource utilization detected',
        metrics: this.resourceMetrics,
        success: false
      };

      logger.info('🚀 Triggering scale-up action', {
        eventId: scalingEvent.eventId,
        currentInstances: currentInstances.length,
        maxInstances: this.scalingConfig.maxInstances
      });

      // In a real implementation, this would trigger container orchestration
      // For now, we'll emit an event that external systems can listen to
      this.emit('scaleUpRequested', {
        eventId: scalingEvent.eventId,
        currentInstances: currentInstances.length,
        targetInstances: Math.min(currentInstances.length + 1, this.scalingConfig.maxInstances),
        reason: scalingEvent.reason,
        metrics: this.resourceMetrics
      });

      scalingEvent.success = true;
      this.lastScalingAction = new Date();
      this.scalingEvents.push(scalingEvent);

      // Cache scaling event
      await twikitCacheManager.set(
        `${this.SCALING_EVENTS_KEY}:${scalingEvent.eventId}`,
        scalingEvent,
        {
          ...this.cacheContext,
          operationType: 'scaling_event',
          tags: ['scaling', 'scale_up', 'event']
        }
      );

    } catch (error) {
      logger.error('Failed to trigger scale-up', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Trigger scale-down action
   */
  private async triggerScaleDown(currentInstances: SessionManagerInstance[]): Promise<void> {
    try {
      // Select instance to remove (prefer least loaded, non-critical instances)
      const candidateForRemoval = this.selectInstanceForRemoval(currentInstances);

      if (!candidateForRemoval) {
        logger.warn('No suitable instance found for scale-down');
        return;
      }

      const scalingEvent: ScalingEvent = {
        eventId: generateCorrelationId(),
        eventType: 'scale_down',
        timestamp: new Date(),
        instanceId: candidateForRemoval.instanceId,
        reason: 'Low resource utilization detected',
        metrics: this.resourceMetrics,
        success: false
      };

      logger.info('🔽 Triggering scale-down action', {
        eventId: scalingEvent.eventId,
        instanceToRemove: candidateForRemoval.instanceId,
        currentInstances: currentInstances.length,
        minInstances: this.scalingConfig.minInstances
      });

      // Initiate graceful shutdown of the selected instance
      if (candidateForRemoval.instanceId === this.instanceId) {
        // This instance is being scaled down
        await this.initiateGracefulShutdown();
      } else {
        // Signal other instance to shut down
        this.emit('scaleDownRequested', {
          eventId: scalingEvent.eventId,
          instanceId: candidateForRemoval.instanceId,
          reason: scalingEvent.reason
        });
      }

      scalingEvent.success = true;
      this.lastScalingAction = new Date();
      this.scalingEvents.push(scalingEvent);

      // Cache scaling event
      await twikitCacheManager.set(
        `${this.SCALING_EVENTS_KEY}:${scalingEvent.eventId}`,
        scalingEvent,
        {
          ...this.cacheContext,
          operationType: 'scaling_event',
          tags: ['scaling', 'scale_down', 'event']
        }
      );

    } catch (error) {
      logger.error('Failed to trigger scale-down', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Select instance for removal during scale-down
   */
  private selectInstanceForRemoval(instances: SessionManagerInstance[]): SessionManagerInstance | null {
    // Filter out this instance if it's critical or has high load
    const candidates = instances.filter(instance => {
      // Don't remove instances with high session counts
      if (instance.sessionCount > this.scalingConfig.targetSessionsPerInstance * 0.5) {
        return false;
      }

      // Don't remove instances with high load
      if (instance.currentLoad > 50) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Select instance with lowest load and session count
    return candidates.reduce((best, current) => {
      const bestScore = best.currentLoad + (best.sessionCount * 10);
      const currentScore = current.currentLoad + (current.sessionCount * 10);
      return currentScore < bestScore ? current : best;
    });
  }

  // ============================================================================
  // DISTRIBUTED SESSION MANAGEMENT - TASK 29
  // ============================================================================

  /**
   * Evaluate session migration needs
   */
  private async evaluateSessionMigration(instances: SessionManagerInstance[]): Promise<void> {
    try {
      // Find overloaded instances
      const overloadedInstances = instances.filter(i =>
        i.currentLoad > this.distributionStrategy.migrationThreshold
      );

      // Find underloaded instances
      const underloadedInstances = instances.filter(i =>
        i.currentLoad < 50 && i.sessionCount < this.scalingConfig.targetSessionsPerInstance * 0.7
      );

      if (overloadedInstances.length === 0 || underloadedInstances.length === 0) {
        return;
      }

      for (const overloadedInstance of overloadedInstances) {
        const sessionsToMigrate = Math.ceil(overloadedInstance.sessionCount * 0.2); // Migrate 20% of sessions

        logger.info('Planning session migration', {
          fromInstance: overloadedInstance.instanceId,
          sessionsToMigrate,
          currentLoad: overloadedInstance.currentLoad
        });

        // In a real implementation, this would coordinate with the overloaded instance
        // to migrate specific sessions to underloaded instances
        this.emit('sessionMigrationRequested', {
          fromInstance: overloadedInstance.instanceId,
          toInstances: underloadedInstances.map(i => i.instanceId),
          sessionCount: sessionsToMigrate,
          reason: 'Load balancing'
        });
      }

    } catch (error) {
      logger.error('Failed to evaluate session migration', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Clean up session affinity mappings
   */
  private async cleanupSessionAffinity(): Promise<void> {
    const currentTime = Date.now();
    const affinityTimeout = this.loadBalancingConfig.affinityTimeout;

    // This is a simplified cleanup - in production you'd track affinity timestamps
    if (this.sessionAffinityMap.size > 1000) { // Prevent memory leaks
      logger.info('Cleaning up session affinity mappings', {
        currentSize: this.sessionAffinityMap.size
      });

      // Keep only recent mappings (simplified approach)
      const keysToKeep = Array.from(this.sessionAffinityMap.keys()).slice(-500);
      const newMap = new Map();

      for (const key of keysToKeep) {
        const value = this.sessionAffinityMap.get(key);
        if (value) {
          newMap.set(key, value);
        }
      }

      this.sessionAffinityMap = newMap;
    }
  }

  /**
   * Initiate graceful shutdown
   */
  private async initiateGracefulShutdown(): Promise<void> {
    try {
      logger.info('🛑 Initiating graceful shutdown', {
        instanceId: this.instanceId,
        activeSessions: this.sessions.size
      });

      // Stop accepting new sessions
      this.instanceInfo.isHealthy = false;
      await this.registerInstance();

      // Migrate existing sessions if possible
      if (this.sessions.size > 0) {
        const healthyInstances = Array.from(this.activeInstances.values())
          .filter(i => i.isHealthy && i.instanceId !== this.instanceId);

        if (healthyInstances.length > 0) {
          logger.info('Migrating sessions before shutdown', {
            sessionCount: this.sessions.size,
            targetInstances: healthyInstances.length
          });

          // In a real implementation, this would coordinate session migration
          this.emit('sessionMigrationRequired', {
            fromInstance: this.instanceId,
            sessions: Array.from(this.sessions.keys()),
            targetInstances: healthyInstances.map(i => i.instanceId)
          });

          // Wait for migration to complete
          await new Promise(resolve => setTimeout(resolve, this.scalingConfig.gracefulShutdownTimeout));
        }
      }

      // Shutdown this instance
      await this.shutdown();

    } catch (error) {
      logger.error('Failed to initiate graceful shutdown', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================================================================
  // PUBLIC API METHODS - TASK 29
  // ============================================================================

  /**
   * Get load balancer status
   */
  getLoadBalancerStatus(): LoadBalancerState {
    return { ...this.loadBalancerState };
  }

  /**
   * Get active instances
   */
  getActiveInstances(): SessionManagerInstance[] {
    return Array.from(this.activeInstances.values());
  }

  /**
   * Get scaling configuration
   */
  getScalingConfig(): HorizontalScalingConfig {
    return { ...this.scalingConfig };
  }

  /**
   * Update scaling configuration
   */
  async updateScalingConfig(newConfig: Partial<HorizontalScalingConfig>): Promise<void> {
    Object.assign(this.scalingConfig, newConfig);

    logger.info('Scaling configuration updated', {
      instanceId: this.instanceId,
      newConfig
    });

    // Cache updated configuration
    await twikitCacheManager.set(
      `scaling_config:${this.instanceId}`,
      this.scalingConfig,
      {
        ...this.cacheContext,
        operationType: 'scaling_config',
        tags: ['config', 'scaling']
      }
    );
  }

  /**
   * Update load balancing configuration
   */
  async updateLoadBalancingConfig(newConfig: Partial<LoadBalancingConfig>): Promise<void> {
    Object.assign(this.loadBalancingConfig, newConfig);

    logger.info('Load balancing configuration updated', {
      instanceId: this.instanceId,
      newConfig
    });

    // Reset round robin index if algorithm changed
    if (newConfig.algorithm) {
      this.roundRobinIndex = 0;
    }
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics(): ResourceMetrics {
    return { ...this.resourceMetrics };
  }

  /**
   * Get scaling events
   */
  getScalingEvents(limit: number = 50): ScalingEvent[] {
    return this.scalingEvents.slice(-limit);
  }

  /**
   * Force rebalance
   */
  async forceRebalance(): Promise<void> {
    logger.info('Force rebalancing requested', {
      instanceId: this.instanceId
    });

    await this.rebalanceLoad();
  }

  /**
   * Enhanced shutdown with load balancing cleanup
   */
  async shutdown(): Promise<void> {
    const correlationId = generateCorrelationId();

    try {
      logger.info('🛑 Shutting down enhanced session manager...', {
        correlationId,
        instanceId: this.instanceId
      });

      // Stop all intervals
      if (this.performanceMonitoringInterval) {
        clearInterval(this.performanceMonitoringInterval);
        this.performanceMonitoringInterval = null;
      }

      if (this.instanceDiscoveryInterval) {
        clearInterval(this.instanceDiscoveryInterval);
        this.instanceDiscoveryInterval = null;
      }

      if (this.loadBalancingInterval) {
        clearInterval(this.loadBalancingInterval);
        this.loadBalancingInterval = null;
      }

      if (this.scalingEvaluationInterval) {
        clearInterval(this.scalingEvaluationInterval);
        this.scalingEvaluationInterval = null;
      }

      // Unregister from instance registry
      await twikitCacheManager.delete(
        `${this.INSTANCE_REGISTRY_KEY}:${this.instanceId}`,
        {
          ...this.cacheContext,
          operationType: 'instance_unregistration'
        }
      );

      // Clear session affinity mappings
      this.sessionAffinityMap.clear();

      // Clear active instances
      this.activeInstances.clear();

      this.isInitialized = false;

      logger.info('✅ Enhanced session manager shutdown complete', {
        correlationId,
        instanceId: this.instanceId
      });

      this.emit('shutdown', { correlationId, instanceId: this.instanceId });

    } catch (error) {
      logger.error('❌ Error during enhanced session manager shutdown', {
        correlationId,
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Singleton instance
export const twikitSessionManager = new TwikitSessionManager();
