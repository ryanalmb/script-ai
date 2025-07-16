import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Enhanced Prisma configuration with connection pooling and logging
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
  });
};

// Global Prisma instance with connection pooling
declare global {
  var __prisma: PrismaClient | undefined;
}

// Singleton pattern for Prisma client
export const prisma = globalThis.__prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Enhanced logging for database operations
// Note: Prisma event listeners are disabled due to type conflicts
// TODO: Re-enable when Prisma types are properly configured

// prisma.$on('query', (e: any) => {
//   if (process.env.NODE_ENV === 'development') {
//     logger.debug('Database Query', {
//       query: e.query,
//       params: e.params,
//       duration: `${e.duration}ms`,
//       timestamp: e.timestamp,
//     });
//   }
//
//   // Log slow queries in production
//   if (e.duration > 1000) { // Queries taking more than 1 second
//     logger.warn('Slow database query detected', {
//       query: e.query.substring(0, 200), // Truncate long queries
//       duration: `${e.duration}ms`,
//       timestamp: e.timestamp,
//     });
//   }
// });

// prisma.$on('error', (e: any) => {
//   logger.error('Database error', {
//     message: e.message,
//     target: e.target,
//     timestamp: e.timestamp,
//   });
// });

// prisma.$on('info', (e: any) => {
//   logger.info('Database info', {
//     message: e.message,
//     target: e.target,
//     timestamp: e.timestamp,
//   });
// });

// prisma.$on('warn', (e: any) => {
//   logger.warn('Database warning', {
//     message: e.message,
//     target: e.target,
//     timestamp: e.timestamp,
//   });
// });

// Connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection healthy');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    return false;
  }
};

// Database metrics collection
export const getDatabaseMetrics = async () => {
  try {
    const [
      userCount,
      accountCount,
      postCount,
      campaignCount,
      activeAutomations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.xAccount.count(),
      prisma.post.count(),
      prisma.campaign.count(),
      prisma.automation.count({
        where: { status: 'ACTIVE' }
      }),
    ]);

    return {
      users: userCount,
      accounts: accountCount,
      posts: postCount,
      campaigns: campaignCount,
      activeAutomations,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to collect database metrics', { error });
    return null;
  }
};

// Graceful shutdown
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
  }
};

// Transaction helper with retry logic
export const withTransaction = async <T>(
  operation: (tx: any) => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
      });
    } catch (error) {
      lastError = error as Error;

      logger.warn('Transaction attempt failed', {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
  }

  logger.error('Transaction failed after all retries', {
    maxRetries,
    error: lastError?.message || 'Unknown error',
  });

  throw lastError || new Error('Transaction failed');
};

// Bulk operations helper
export const bulkInsert = async <T extends Record<string, any>>(
  model: any,
  data: T[],
  batchSize: number = 100
): Promise<void> => {
  const batches: T[][] = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      await model.createMany({
        data: batch,
        skipDuplicates: true,
      });
    } catch (error) {
      logger.error('Bulk insert batch failed', {
        batchSize: batch.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
};

// Query optimization helpers
export const findWithPagination = async <T>(
  model: any,
  options: {
    where?: any;
    orderBy?: any;
    page?: number;
    limit?: number;
    include?: any;
    select?: any;
  }
) => {
  const { where, orderBy, page = 1, limit = 10, include, select } = options;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include,
      select,
    }),
    model.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

export default prisma;
