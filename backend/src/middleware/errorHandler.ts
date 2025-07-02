import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') => {
  return new CustomError(message, statusCode, code);
};

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let code = error.code || 'INTERNAL_ERROR';

  // Log error details
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    statusCode,
    code,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle specific error types
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        statusCode = 409;
        message = 'Resource already exists';
        code = 'DUPLICATE_RESOURCE';
        break;
      case 'P2025':
        // Record not found
        statusCode = 404;
        message = 'Resource not found';
        code = 'RESOURCE_NOT_FOUND';
        break;
      case 'P2003':
        // Foreign key constraint violation
        statusCode = 400;
        message = 'Invalid reference';
        code = 'INVALID_REFERENCE';
        break;
      case 'P2014':
        // Required relation violation
        statusCode = 400;
        message = 'Required relation missing';
        code = 'MISSING_RELATION';
        break;
      default:
        statusCode = 500;
        message = 'Database error';
        code = 'DATABASE_ERROR';
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 500;
    message = 'Database connection error';
    code = 'DATABASE_CONNECTION_ERROR';
  } else if (error instanceof SyntaxError && 'body' in error) {
    // JSON parsing error
    statusCode = 400;
    message = 'Invalid JSON format';
    code = 'INVALID_JSON';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    code = 'INTERNAL_ERROR';
  }

  // Send error response
  res.status(statusCode).json({
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error,
    }),
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error handler
export const handleValidationError = (errors: any[]) => {
  const message = errors.map(err => err.msg).join(', ');
  return new CustomError(message, 400, 'VALIDATION_ERROR');
};

// Rate limit error handler
export const handleRateLimitError = () => {
  return new CustomError('Too many requests, please try again later', 429, 'RATE_LIMIT_EXCEEDED');
};

// Authentication error handlers
export const handleAuthError = (message: string = 'Authentication failed') => {
  return new CustomError(message, 401, 'AUTH_ERROR');
};

export const handleForbiddenError = (message: string = 'Access forbidden') => {
  return new CustomError(message, 403, 'FORBIDDEN');
};

// Resource error handlers
export const handleNotFoundError = (resource: string = 'Resource') => {
  return new CustomError(`${resource} not found`, 404, 'NOT_FOUND');
};

export const handleConflictError = (message: string = 'Resource conflict') => {
  return new CustomError(message, 409, 'CONFLICT');
};

// X API specific error handlers
export const handleXApiError = (error: any) => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 401:
        return new CustomError('X API authentication failed', 401, 'X_API_AUTH_ERROR');
      case 403:
        return new CustomError('X API access forbidden', 403, 'X_API_FORBIDDEN');
      case 429:
        return new CustomError('X API rate limit exceeded', 429, 'X_API_RATE_LIMIT');
      case 500:
        return new CustomError('X API server error', 502, 'X_API_SERVER_ERROR');
      default:
        return new CustomError(`X API error: ${data?.detail || 'Unknown error'}`, 502, 'X_API_ERROR');
    }
  }
  
  return new CustomError('X API connection error', 502, 'X_API_CONNECTION_ERROR');
};

// Process unhandled errors
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
