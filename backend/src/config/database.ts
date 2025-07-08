import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Global Prisma instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with logging and error handling
const createPrismaClient = () => {
  return new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    errorFormat: 'pretty',
  });
};

// Use global instance in development to prevent multiple connections
const prisma = globalThis.__prisma || createPrismaClient();

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

// Set up event listeners for logging
// Note: Prisma event listeners are disabled due to type conflicts
// TODO: Re-enable when Prisma types are properly configured

// prisma.$on('query', (e) => {
//   logger.debug('Database query executed', {
//     query: e.query,
//     params: e.params,
//     duration: e.duration,
//     timestamp: e.timestamp,
//   });
// });

// prisma.$on('error', (e) => {
//   logger.error('Database error', {
//     message: e.message,
//     target: e.target,
//     timestamp: e.timestamp,
//   });
// });

// prisma.$on('info', (e) => {
//   logger.info('Database info', {
//     message: e.message,
//     target: e.target,
//     timestamp: e.timestamp,
//   });
// });

// prisma.$on('warn', (e) => {
//   logger.warn('Database warning', {
//     message: e.message,
//     target: e.target,
//     timestamp: e.timestamp,
//   });
// });

// Database connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database connection check failed:', error);
    return false;
  }
};

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    
    // Run a simple query to verify connection
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error('Database connection verification failed');
    }
    
    logger.info('Database connection verified');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
};

// Database transaction helper
export const withTransaction = async <T>(
  callback: (prisma: any) => Promise<T>
): Promise<T> => {
  return await prisma.$transaction(callback as any) as T;
};

// Database retry helper
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError!;
};

// Database metrics
export const getDatabaseMetrics = async () => {
  try {
    // const metrics = await prisma.$metrics.json(); // Disabled due to type issues
    return {
      users: 0,
      accounts: 0,
      posts: 0,
      campaigns: 0,
      activeAutomations: 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to get database metrics:', error);
    return null;
  }
};

// Clean up old records
export const cleanupOldRecords = async () => {
  try {
    const retentionDays = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Clean up old analytics records
    const deletedAnalytics = await prisma.analytics.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    
    // Clean up old automation logs
    const deletedLogs = await prisma.automationLog.deleteMany({
      where: {
        executedAt: {
          lt: cutoffDate,
        },
      },
    });
    
    // Clean up old user activities
    const deletedActivities = await prisma.userActivity.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    
    logger.info('Database cleanup completed', {
      deletedAnalytics: deletedAnalytics.count,
      deletedLogs: deletedLogs.count,
      deletedActivities: deletedActivities.count,
      cutoffDate,
    });
    
    return {
      deletedAnalytics: deletedAnalytics.count,
      deletedLogs: deletedLogs.count,
      deletedActivities: deletedActivities.count,
    };
  } catch (error) {
    logger.error('Database cleanup failed:', error);
    throw error;
  }
};

export default prisma;
