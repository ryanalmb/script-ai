/**
 * Enterprise Python Process Manager
 * 
 * Provides scalable Python process management with:
 * - Process pooling and connection reuse
 * - Lifecycle management and graceful shutdown
 * - Resource monitoring and cleanup
 * - Error recovery and failover mechanisms
 * - Performance optimization and load balancing
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { logger } from '../utils/logger';
import { cacheManager } from '../lib/cache';

export interface PythonProcessConfig {
  maxPoolSize: number;
  minPoolSize: number;
  processTimeout: number;
  maxIdleTime: number;
  healthCheckInterval: number;
  maxRetries: number;
  gracefulShutdownTimeout: number;
}

export interface PythonProcess {
  id: string;
  process: ChildProcess;
  isActive: boolean;
  isBusy: boolean;
  createdAt: Date;
  lastUsed: Date;
  requestCount: number;
  errorCount: number;
  sessionId?: string;
}

export interface ProcessExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  processId: string;
}

/**
 * Enterprise Python Process Pool Manager
 */
export class EnterprisePythonProcessManager extends EventEmitter {
  private processPool: Map<string, PythonProcess> = new Map();
  private sessionProcessMap: Map<string, string> = new Map(); // sessionId -> processId
  private availableProcesses: Set<string> = new Set();
  private busyProcesses: Set<string> = new Set();
  private config: PythonProcessConfig;
  private pythonScriptPath: string;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(config: Partial<PythonProcessConfig> = {}) {
    super();
    
    this.config = {
      maxPoolSize: config.maxPoolSize || 20,
      minPoolSize: config.minPoolSize || 5,
      processTimeout: config.processTimeout || 30000,
      maxIdleTime: config.maxIdleTime || 300000, // 5 minutes
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      maxRetries: config.maxRetries || 3,
      gracefulShutdownTimeout: config.gracefulShutdownTimeout || 10000
    };

    this.pythonScriptPath = path.join(__dirname, '../../scripts/x_client.py');
    
    this.startHealthMonitoring();
    this.startCleanupMonitoring();
    
    logger.info('EnterprisePythonProcessManager initialized', {
      maxPoolSize: this.config.maxPoolSize,
      minPoolSize: this.config.minPoolSize
    });
  }

  /**
   * Initialize the process pool
   */
  async initialize(): Promise<void> {
    try {
      // Create minimum number of processes
      for (let i = 0; i < this.config.minPoolSize; i++) {
        await this.createProcess();
      }
      
      logger.info(`Process pool initialized with ${this.config.minPoolSize} processes`);
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Failed to initialize process pool:', error);
      throw error;
    }
  }

  /**
   * Execute action with process pooling and connection reuse
   */
  async executeAction(
    sessionId: string,
    action: string,
    params: any,
    retryCount: number = 0
  ): Promise<ProcessExecutionResult> {
    if (this.isShuttingDown) {
      throw new Error('Process manager is shutting down');
    }

    const startTime = Date.now();
    let processId: string | null = null;

    try {
      // Get or create process for session
      processId = await this.getProcessForSession(sessionId);
      const process = this.processPool.get(processId);
      
      if (!process) {
        throw new Error(`Process ${processId} not found in pool`);
      }

      // Mark process as busy
      this.markProcessBusy(processId);

      // Execute the action
      const result = await this.executeOnProcess(process, action, params);
      
      // Update process metrics
      process.lastUsed = new Date();
      process.requestCount++;
      
      // Mark process as available
      this.markProcessAvailable(processId);

      const executionTime = Date.now() - startTime;
      
      logger.debug(`Action executed successfully`, {
        sessionId,
        action,
        processId,
        executionTime
      });

      return {
        success: true,
        data: result,
        executionTime,
        processId
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (processId) {
        const process = this.processPool.get(processId);
        if (process) {
          process.errorCount++;
          this.markProcessAvailable(processId);
          
          // Remove unhealthy process if too many errors
          if (process.errorCount > 5) {
            await this.removeProcess(processId);
          }
        }
      }

      // Retry logic
      if (retryCount < this.config.maxRetries) {
        logger.warn(`Retrying action after error (attempt ${retryCount + 1}/${this.config.maxRetries})`, {
          sessionId,
          action,
          error: error instanceof Error ? error.message : String(error)
        });
        
        return await this.executeAction(sessionId, action, params, retryCount + 1);
      }

      logger.error('Action execution failed after retries', {
        sessionId,
        action,
        retryCount,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        processId: processId || 'unknown'
      };
    }
  }

  /**
   * Get or create process for session with connection reuse
   */
  private async getProcessForSession(sessionId: string): Promise<string> {
    // Check if session already has a dedicated process
    const existingProcessId = this.sessionProcessMap.get(sessionId);
    if (existingProcessId && this.processPool.has(existingProcessId)) {
      const process = this.processPool.get(existingProcessId)!;
      if (process.isActive && !process.isBusy) {
        return existingProcessId;
      }
    }

    // Get available process from pool
    let processId = this.getAvailableProcess();
    
    if (!processId) {
      // Create new process if pool not at max capacity
      if (this.processPool.size < this.config.maxPoolSize) {
        processId = await this.createProcess();
      } else {
        // Wait for available process
        processId = await this.waitForAvailableProcess();
      }
    }

    // Associate process with session
    this.sessionProcessMap.set(sessionId, processId);
    const process = this.processPool.get(processId)!;
    process.sessionId = sessionId;

    return processId;
  }

  /**
   * Create new Python process
   */
  private async createProcess(): Promise<string> {
    const processId = `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const childProcess = spawn('python', [this.pythonScriptPath, 'init'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PROCESS_ID: processId }
      });

      const pythonProcess: PythonProcess = {
        id: processId,
        process: childProcess,
        isActive: true,
        isBusy: false,
        createdAt: new Date(),
        lastUsed: new Date(),
        requestCount: 0,
        errorCount: 0
      };

      // Setup process event handlers
      this.setupProcessHandlers(pythonProcess);

      // Add to pool
      this.processPool.set(processId, pythonProcess);
      this.availableProcesses.add(processId);

      logger.debug(`Created new Python process: ${processId}`);
      this.emit('processCreated', processId);

      return processId;

    } catch (error) {
      logger.error(`Failed to create Python process: ${processId}`, error);
      throw error;
    }
  }

  /**
   * Execute action on specific process
   */
  private async executeOnProcess(
    pythonProcess: PythonProcess,
    action: string,
    params: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Process execution timeout after ${this.config.processTimeout}ms`));
      }, this.config.processTimeout);

      let stdout = '';
      let stderr = '';

      const dataHandler = (data: Buffer) => {
        stdout += data.toString();
      };

      const errorHandler = (data: Buffer) => {
        stderr += data.toString();
      };

      const closeHandler = (code: number) => {
        clearTimeout(timeout);
        pythonProcess.process.stdout?.removeListener('data', dataHandler);
        pythonProcess.process.stderr?.removeListener('data', errorHandler);
        pythonProcess.process.removeListener('close', closeHandler);

        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${stdout}`));
          }
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      };

      pythonProcess.process.stdout?.on('data', dataHandler);
      pythonProcess.process.stderr?.on('data', errorHandler);
      pythonProcess.process.on('close', closeHandler);

      // Send command to process
      const command = JSON.stringify({ action, params }) + '\n';
      pythonProcess.process.stdin?.write(command);
    });
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(pythonProcess: PythonProcess): void {
    pythonProcess.process.on('error', (error) => {
      logger.error(`Python process error: ${pythonProcess.id}`, error);
      pythonProcess.isActive = false;
      this.removeProcess(pythonProcess.id);
    });

    pythonProcess.process.on('exit', (code, signal) => {
      logger.warn(`Python process exited: ${pythonProcess.id}`, { code, signal });
      pythonProcess.isActive = false;
      this.removeProcess(pythonProcess.id);
    });
  }

  /**
   * Get available process from pool
   */
  private getAvailableProcess(): string | null {
    for (const processId of this.availableProcesses) {
      const process = this.processPool.get(processId);
      if (process && process.isActive && !process.isBusy) {
        return processId;
      }
    }
    return null;
  }

  /**
   * Wait for available process
   */
  private async waitForAvailableProcess(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for available process'));
      }, this.config.processTimeout);

      const checkAvailable = () => {
        const processId = this.getAvailableProcess();
        if (processId) {
          clearTimeout(timeout);
          resolve(processId);
        } else {
          setTimeout(checkAvailable, 100);
        }
      };

      checkAvailable();
    });
  }

  /**
   * Mark process as busy
   */
  private markProcessBusy(processId: string): void {
    const process = this.processPool.get(processId);
    if (process) {
      process.isBusy = true;
      this.availableProcesses.delete(processId);
      this.busyProcesses.add(processId);
    }
  }

  /**
   * Mark process as available
   */
  private markProcessAvailable(processId: string): void {
    const process = this.processPool.get(processId);
    if (process) {
      process.isBusy = false;
      this.busyProcesses.delete(processId);
      this.availableProcesses.add(processId);
    }
  }

  /**
   * Remove process from pool
   */
  private async removeProcess(processId: string): Promise<void> {
    const process = this.processPool.get(processId);
    if (!process) return;

    try {
      // Remove from tracking sets
      this.availableProcesses.delete(processId);
      this.busyProcesses.delete(processId);

      // Remove session mapping
      for (const [sessionId, mappedProcessId] of this.sessionProcessMap.entries()) {
        if (mappedProcessId === processId) {
          this.sessionProcessMap.delete(sessionId);
        }
      }

      // Gracefully terminate process
      if (!process.process.killed) {
        process.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (!process.process.killed) {
            process.process.kill('SIGKILL');
          }
        }, 5000);
      }

      // Remove from pool
      this.processPool.delete(processId);

      logger.debug(`Removed process from pool: ${processId}`);
      this.emit('processRemoved', processId);

    } catch (error) {
      logger.error(`Error removing process ${processId}:`, error);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Start cleanup monitoring
   */
  private startCleanupMonitoring(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, this.config.maxIdleTime / 2);
  }

  /**
   * Perform health check on all processes
   */
  private async performHealthCheck(): Promise<void> {
    const healthyProcesses: string[] = [];
    const unhealthyProcesses: string[] = [];

    for (const [processId, process] of this.processPool.entries()) {
      try {
        if (!process.isActive || process.process.killed) {
          unhealthyProcesses.push(processId);
          continue;
        }

        // Simple health check - send ping command
        const result = await this.executeOnProcess(process, 'ping', {});
        if (result && result.status === 'ok') {
          healthyProcesses.push(processId);
        } else {
          unhealthyProcesses.push(processId);
        }

      } catch (error) {
        unhealthyProcesses.push(processId);
      }
    }

    // Remove unhealthy processes
    for (const processId of unhealthyProcesses) {
      await this.removeProcess(processId);
    }

    // Ensure minimum pool size
    const currentSize = this.processPool.size;
    if (currentSize < this.config.minPoolSize) {
      const needed = this.config.minPoolSize - currentSize;
      for (let i = 0; i < needed; i++) {
        try {
          await this.createProcess();
        } catch (error) {
          logger.error('Failed to create process during health check:', error);
        }
      }
    }

    logger.debug('Health check completed', {
      healthy: healthyProcesses.length,
      unhealthy: unhealthyProcesses.length,
      total: this.processPool.size
    });
  }

  /**
   * Perform cleanup of idle processes
   */
  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const idleProcesses: string[] = [];

    for (const [processId, process] of this.processPool.entries()) {
      const idleTime = now - process.lastUsed.getTime();
      
      if (!process.isBusy && idleTime > this.config.maxIdleTime) {
        idleProcesses.push(processId);
      }
    }

    // Remove idle processes but maintain minimum pool size
    const canRemove = Math.max(0, this.processPool.size - this.config.minPoolSize);
    const toRemove = idleProcesses.slice(0, canRemove);

    for (const processId of toRemove) {
      await this.removeProcess(processId);
    }

    if (toRemove.length > 0) {
      logger.debug(`Cleaned up ${toRemove.length} idle processes`);
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    total: number;
    available: number;
    busy: number;
    sessions: number;
  } {
    return {
      total: this.processPool.size,
      available: this.availableProcesses.size,
      busy: this.busyProcesses.size,
      sessions: this.sessionProcessMap.size
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    logger.info('Starting graceful shutdown of Python process manager');

    // Stop monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Wait for busy processes to complete or timeout
    const shutdownStart = Date.now();
    while (this.busyProcesses.size > 0 && 
           (Date.now() - shutdownStart) < this.config.gracefulShutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force shutdown all remaining processes
    const shutdownPromises = Array.from(this.processPool.keys()).map(processId => 
      this.removeProcess(processId)
    );

    await Promise.allSettled(shutdownPromises);

    logger.info('Python process manager shutdown complete');
    this.emit('shutdown');
  }
}
