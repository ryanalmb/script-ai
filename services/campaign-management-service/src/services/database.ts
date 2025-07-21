/**
 * Enterprise Campaign Management Service - Database Service
 * Comprehensive database service with connection management, monitoring, and enterprise features
 */

import { PrismaClient } from '@prisma/client';
import { config } from '@/config';
import { log, createTimer } from '@/utils/logger';

class DatabaseService {
  private prisma: PrismaClient;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000; // 5 seconds

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.database.url
        }
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' }
      ]
    });

    this.setupEventListeners();
  }

  /**
   * Setup Prisma event listeners for monitoring and logging
   */
  private setupEventListeners(): void {
    // Query logging with performance monitoring
    this.prisma.$on('query' as any, (event: any) => {
      const duration = event.duration;
      const query = event.query;
      const params = event.params;

      // Log slow queries
      if (duration > 1000) { // Queries taking more than 1 second
        log.warn('Slow database query detected', {
          operation: 'database_query',
          duration,
          metadata: { query, params }
        });
      } else {
        log.debug('Database query executed', {
          operation: 'database_query',
          duration,
          metadata: { query, params }
        });
      }
    });

    // Error logging
    this.prisma.$on('error' as any, (event: any) => {
      log.error('Database error occurred', {
        operation: 'database_error',
        error: new Error(event.message),
        metadata: { target: event.target }
      });
    });

    // Info logging
    this.prisma.$on('info' as any, (event: any) => {
      log.info('Database info', {
        operation: 'database_info',
        metadata: { message: event.message, target: event.target }
      });
    });

    // Warning logging
    this.prisma.$on('warn' as any, (event: any) => {
      log.warn('Database warning', {
        operation: 'database_warning',
        metadata: { message: event.message, target: event.target }
      });
    });
  }

  /**
   * Connect to the database with retry logic
   */
  async connect(): Promise<void> {
    const timer = createTimer('database_connect');

    try {
      log.info('Attempting to connect to database', {
        operation: 'database_connect',
        metadata: { attempt: this.connectionAttempts + 1, maxRetries: this.maxRetries }
      });

      await this.prisma.$connect();
      
      // Test the connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      const duration = timer.end();
      
      log.info('Successfully connected to database', {
        operation: 'database_connect',
        duration,
        metadata: { poolSize: config.database.poolSize }
      });

      // Log database info
      await this.logDatabaseInfo();

    } catch (error) {
      timer.end();
      this.connectionAttempts++;
      
      log.error('Failed to connect to database', {
        operation: 'database_connect',
        error: error as Error,
        metadata: { 
          attempt: this.connectionAttempts, 
          maxRetries: this.maxRetries,
          willRetry: this.connectionAttempts < this.maxRetries
        }
      });

      if (this.connectionAttempts < this.maxRetries) {
        log.info(`Retrying database connection in ${this.retryDelay}ms`, {
          operation: 'database_connect_retry',
          metadata: { delay: this.retryDelay, attempt: this.connectionAttempts }
        });
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      } else {
        throw new Error(`Failed to connect to database after ${this.maxRetries} attempts: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    const timer = createTimer('database_disconnect');

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      
      const duration = timer.end();
      
      log.info('Successfully disconnected from database', {
        operation: 'database_disconnect',
        duration
      });
    } catch (error) {
      timer.end();
      log.error('Error disconnecting from database', {
        operation: 'database_disconnect',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<boolean> {
    const timer = createTimer('database_health_check');

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      timer.end();
      return true;
    } catch (error) {
      timer.end();
      log.error('Database health check failed', {
        operation: 'database_health_check',
        error: error as Error
      });
      return false;
    }
  }

  /**
   * Get detailed database health information
   */
  async getHealthInfo(): Promise<{
    isHealthy: boolean;
    connectionCount: number;
    version: string;
    uptime: number;
  }> {
    try {
      // Get database version
      const versionResult = await this.prisma.$queryRaw<[{ version: string }]>`SELECT version()`;
      const version = versionResult[0]?.version || 'unknown';

      // Get connection count
      const connectionResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
      `;
      const connectionCount = Number(connectionResult[0]?.count || 0);

      // Get database uptime (PostgreSQL specific)
      const uptimeResult = await this.prisma.$queryRaw<[{ uptime: number }]>`
        SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime
      `;
      const uptime = uptimeResult[0]?.uptime || 0;

      return {
        isHealthy: true,
        connectionCount,
        version,
        uptime
      };
    } catch (error) {
      log.error('Failed to get database health info', {
        operation: 'database_health_info',
        error: error as Error
      });
      
      return {
        isHealthy: false,
        connectionCount: 0,
        version: 'unknown',
        uptime: 0
      };
    }
  }

  /**
   * Log database information on startup
   */
  private async logDatabaseInfo(): Promise<void> {
    try {
      const healthInfo = await this.getHealthInfo();
      
      log.info('Database information', {
        operation: 'database_info',
        metadata: {
          version: healthInfo.version,
          connectionCount: healthInfo.connectionCount,
          uptime: healthInfo.uptime,
          poolSize: config.database.poolSize,
          timeout: config.database.timeout
        }
      });
    } catch (error) {
      log.warn('Could not retrieve database information', {
        operation: 'database_info',
        error: error as Error
      });
    }
  }

  /**
   * Execute a transaction with logging and error handling
   */
  async transaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
    operation: string = 'database_transaction'
  ): Promise<T> {
    const timer = createTimer(operation);

    try {
      log.debug(`Starting transaction: ${operation}`, {
        operation
      });

      const result = await this.prisma.$transaction(fn);
      
      const duration = timer.end();
      
      log.debug(`Completed transaction: ${operation}`, {
        operation,
        duration
      });

      return result;
    } catch (error) {
      timer.end();
      log.error(`Transaction failed: ${operation}`, {
        operation,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    if (!this.isConnected) {
      throw new Error('Database is not connected. Call connect() first.');
    }
    return this.prisma;
  }

  /**
   * Check if database is connected
   */
  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  /**
   * Get database metrics for monitoring
   */
  async getMetrics(): Promise<{
    connectionCount: number;
    activeQueries: number;
    slowQueries: number;
    errorCount: number;
    campaignCount: number;
    postCount: number;
    automationCount: number;
  }> {
    try {
      // Get active connections
      const connectionResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
      `;
      const connectionCount = Number(connectionResult[0]?.count || 0);

      // Get active queries
      const queryResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active' AND query != '<IDLE>'
      `;
      const activeQueries = Number(queryResult[0]?.count || 0);

      // Get slow queries (queries running for more than 30 seconds)
      const slowQueryResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*) as count FROM pg_stat_activity 
        WHERE state = 'active' AND query_start < now() - interval '30 seconds'
      `;
      const slowQueries = Number(slowQueryResult[0]?.count || 0);

      // Get campaign metrics
      const campaignCount = await this.prisma.campaign.count();
      const postCount = await this.prisma.post.count();
      const automationCount = await this.prisma.automation.count();

      return {
        connectionCount,
        activeQueries,
        slowQueries,
        errorCount: 0, // This would need to be tracked separately
        campaignCount,
        postCount,
        automationCount
      };
    } catch (error) {
      log.error('Failed to get database metrics', {
        operation: 'database_metrics',
        error: error as Error
      });
      
      return {
        connectionCount: 0,
        activeQueries: 0,
        slowQueries: 0,
        errorCount: 1,
        campaignCount: 0,
        postCount: 0,
        automationCount: 0
      };
    }
  }
}

// Create and export singleton instance
export const databaseService = new DatabaseService();

// Export the class for testing
export { DatabaseService };
