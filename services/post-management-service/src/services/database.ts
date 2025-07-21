/**
 * Enterprise Post Management Service - Database Service
 * Comprehensive database management with connection pooling and backend integration
 */

import { PrismaClient } from '@prisma/client';
import { config } from '@/config';
import { log, createTimer } from '@/utils/logger';

class DatabaseService {
  private prisma: PrismaClient | null = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private readonly maxRetries: number = 5;
  private readonly retryDelay: number = 5000; // 5 seconds

  constructor() {
    log.info('Database service initialized', {
      operation: 'database_service_init',
      metadata: {
        databaseUrl: config.database.url.replace(/:[^:@]*@/, ':***@'), // Hide password
        poolSize: config.database.poolSize,
        timeout: config.database.timeout
      }
    });
  }

  /**
   * Initialize Prisma client with enterprise configuration
   */
  private initializePrisma(): PrismaClient {
    return new PrismaClient({
      datasources: {
        db: {
          url: config.database.url
        }
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' }
      ],
      errorFormat: 'pretty'
    });
  }

  /**
   * Setup Prisma event listeners for logging
   */
  private setupEventListeners(prisma: PrismaClient): void {
    // Note: Prisma event listeners would be configured when proper types are available
    // For now, we'll skip event listener setup to maintain strict typing
    log.debug('Prisma event listeners setup skipped for strict typing', {
      operation: 'database_event_listeners'
    });
    
    // Suppress unused parameter warning
    void prisma;
  }

  /**
   * Connect to the database with retry logic
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.prisma) {
      log.debug('Database already connected', {
        operation: 'database_connect'
      });
      return;
    }

    while (this.connectionAttempts < this.maxRetries) {
      this.connectionAttempts++;
      const timer = createTimer('database_connect');

      try {
        log.info('Attempting to connect to database', {
          operation: 'database_connect',
          metadata: {
            attempt: this.connectionAttempts,
            maxRetries: this.maxRetries
          }
        });

        // Initialize Prisma client
        this.prisma = this.initializePrisma();
        
        // Setup event listeners
        this.setupEventListeners(this.prisma);

        // Test the connection
        await this.prisma.$connect();
        
        // Verify connection with a simple query
        await this.prisma.$queryRaw`SELECT 1`;

        this.isConnected = true;
        const duration = timer.end();

        log.info('Successfully connected to database', {
          operation: 'database_connect',
          duration,
          metadata: {
            attempt: this.connectionAttempts,
            poolSize: config.database.poolSize
          }
        });

        return;

      } catch (error) {
        timer.end();
        const willRetry = this.connectionAttempts < this.maxRetries;
        
        log.error('Failed to connect to database', {
          operation: 'database_connect',
          error: error as Error,
          metadata: {
            attempt: this.connectionAttempts,
            maxRetries: this.maxRetries,
            willRetry
          }
        });

        if (this.prisma) {
          try {
            await this.prisma.$disconnect();
          } catch (disconnectError) {
            log.warn('Error disconnecting failed Prisma client', {
              operation: 'database_connect_cleanup',
              error: disconnectError as Error
            });
          }
          this.prisma = null;
        }

        if (willRetry) {
          log.info(`Retrying database connection in ${this.retryDelay}ms`, {
            operation: 'database_connect_retry',
            metadata: {
              delay: this.retryDelay,
              attempt: this.connectionAttempts
            }
          });
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (!this.prisma) {
      log.debug('No database connection to disconnect', {
        operation: 'database_disconnect'
      });
      return;
    }

    const timer = createTimer('database_disconnect');

    try {
      await this.prisma.$disconnect();
      this.prisma = null;
      this.isConnected = false;
      this.connectionAttempts = 0;
      
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
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    if (!this.prisma || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.prisma || !this.isConnected) {
      return false;
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      log.error('Database health check failed', {
        operation: 'database_health_check',
        error: error as Error
      });
      return false;
    }
  }

  /**
   * Get database metrics
   */
  async getMetrics(): Promise<{
    postCount: number;
    queuedPosts: number;
    publishedToday: number;
    failedPosts: number;
    accountCount: number;
    userCount: number;
    connectionStatus: boolean;
  }> {
    if (!this.prisma || !this.isConnected) {
      return {
        postCount: 0,
        queuedPosts: 0,
        publishedToday: 0,
        failedPosts: 0,
        accountCount: 0,
        userCount: 0,
        connectionStatus: false
      };
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [postCount, queuedPosts, publishedToday, failedPosts, accountCount, userCount] = await Promise.all([
        this.prisma.post.count(),
        this.prisma.post.count({
          where: { status: 'SCHEDULED' }
        }),
        this.prisma.post.count({
          where: {
            status: 'PUBLISHED',
            createdAt: { gte: today }
          }
        }),
        this.prisma.post.count({
          where: { status: 'FAILED' }
        }),
        this.prisma.account.count(),
        this.prisma.user.count()
      ]);

      return {
        postCount,
        queuedPosts,
        publishedToday,
        failedPosts,
        accountCount,
        userCount,
        connectionStatus: true
      };
    } catch (error) {
      log.error('Failed to get database metrics', {
        operation: 'database_metrics',
        error: error as Error
      });
      
      return {
        postCount: 0,
        queuedPosts: 0,
        publishedToday: 0,
        failedPosts: 0,
        accountCount: 0,
        userCount: 0,
        connectionStatus: false
      };
    }
  }

  /**
   * Execute database transaction with proper typing
   */
  async transaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
    operationName: string = 'database_transaction'
  ): Promise<T> {
    if (!this.prisma || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const timer = createTimer(operationName);

    try {
      log.debug(`Starting database transaction: ${operationName}`, {
        operation: operationName
      });

      const result = await this.prisma.$transaction(fn);
      
      const duration = timer.end();
      
      log.debug(`Database transaction completed: ${operationName}`, {
        operation: operationName,
        duration
      });

      return result;
    } catch (error) {
      timer.end();
      log.error(`Database transaction failed: ${operationName}`, {
        operation: operationName,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  isConnectedToDatabase(): boolean {
    return this.isConnected && this.prisma !== null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    attempts: number;
    maxRetries: number;
    client: boolean;
  } {
    return {
      connected: this.isConnected,
      attempts: this.connectionAttempts,
      maxRetries: this.maxRetries,
      client: this.prisma !== null
    };
  }

  /**
   * Reset connection (for testing or recovery)
   */
  async resetConnection(): Promise<void> {
    log.info('Resetting database connection', {
      operation: 'database_reset'
    });

    await this.disconnect();
    this.connectionAttempts = 0;
    await this.connect();
  }
}

// Create and export singleton instance
export const databaseService = new DatabaseService();

// Export the class for testing
export { DatabaseService };
