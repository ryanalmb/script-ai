import { spawn, ChildProcess } from 'child_process';
import path from 'path';
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
}

/**
 * Enterprise Twikit Session Manager
 * Manages multiple Twikit sessions with proxy rotation, session persistence, and health monitoring
 */
export class TwikitSessionManager extends EventEmitter {
  private sessions: Map<string, TwikitSession> = new Map();
  private pythonScriptPath: string;
  private cookiesDir: string;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.pythonScriptPath = path.join(__dirname, '../../scripts/x_client.py');
    this.cookiesDir = path.join(__dirname, '../../data/cookies');
    
    // Initialize health monitoring
    this.startHealthMonitoring();
    this.startSessionCleanup();
    
    logger.info('TwikitSessionManager initialized');
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
   * Execute Python script with session management
   */
  private async executePythonScript(session: TwikitSession, action: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [
        this.pythonScriptPath,
        action,
        JSON.stringify(params)
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            logger.error('Failed to parse Python script output:', stdout);
            reject(new Error('Invalid JSON response from Python script'));
          }
        } else {
          logger.error('Python script failed:', stderr);
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error('Failed to spawn Python process:', error);
        reject(error);
      });

      // Store process reference for potential cleanup
      session.process = pythonProcess;
      session.isActive = true;
    });
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

      // Cleanup Python process
      if (session.process && !session.process.killed) {
        try {
          await this.executeAction(accountId, 'cleanup');
        } catch (error) {
          logger.warn(`Failed to cleanup Python client for account ${accountId}:`, error);
        }

        session.process.kill('SIGTERM');

        // Force kill if not terminated within 5 seconds
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
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
   * Shutdown session manager and cleanup all resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down TwikitSessionManager...');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }

    // Destroy all sessions
    const accountIds = Array.from(this.sessions.keys());
    const destroyPromises = accountIds.map(accountId => this.destroySession(accountId));
    await Promise.allSettled(destroyPromises);

    // Clear sessions map
    this.sessions.clear();

    // Remove all event listeners
    this.removeAllListeners();

    logger.info('TwikitSessionManager shutdown complete');
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
}

// Singleton instance
export const twikitSessionManager = new TwikitSessionManager();
