import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// User validation schemas
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number, and special character'),
});

export const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// X Account validation schemas
export const xAccountSchema = z.object({
  username: z.string()
    .min(1, 'Username is required')
    .max(15, 'X username cannot exceed 15 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Invalid X username format'),
  apiKey: z.string().min(1, 'API key is required'),
  apiSecret: z.string().min(1, 'API secret is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  accessTokenSecret: z.string().min(1, 'Access token secret is required'),
  bearerToken: z.string().optional(),
});

// Post/Content validation schemas
export const postSchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(280, 'Content cannot exceed 280 characters'),
  mediaUrls: z.array(z.string().url('Invalid media URL')).max(4, 'Maximum 4 media files allowed'),
  hashtags: z.array(z.string().regex(/^#[a-zA-Z0-9_]+$/, 'Invalid hashtag format')).max(10),
  mentions: z.array(z.string().regex(/^@[a-zA-Z0-9_]+$/, 'Invalid mention format')).max(10),
  scheduledFor: z.string().datetime().optional(),
});

// Content generation validation
export const contentGenerationSchema = z.object({
  topic: z.string()
    .min(1, 'Topic is required')
    .max(200, 'Topic too long'),
  tone: z.enum(['professional', 'casual', 'enthusiastic', 'informative', 'humorous']),
  contentType: z.enum(['post', 'thread', 'reply', 'market_analysis', 'news_update']),
  platform: z.enum(['twitter', 'x']).default('x'),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  includeHashtags: z.boolean().default(true),
  includeMentions: z.boolean().default(false),
});

// Campaign validation schemas
export const campaignSchema = z.object({
  name: z.string()
    .min(1, 'Campaign name is required')
    .max(100, 'Campaign name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  budget: z.number().min(0, 'Budget cannot be negative').optional(),
  targetAudience: z.object({
    demographics: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
  }).optional(),
});

// Automation rule validation
export const automationRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100),
  type: z.enum(['posting', 'engagement', 'following', 'analytics']),
  schedule: z.object({
    frequency: z.enum(['hourly', 'daily', 'weekly', 'custom']),
    interval: z.number().min(1).max(24),
    timezone: z.string().default('UTC'),
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'greater_than', 'less_than']),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })),
  actions: z.array(z.object({
    type: z.enum(['post', 'like', 'retweet', 'follow', 'unfollow', 'dm']),
    parameters: z.record(z.any()),
  })),
});

// Validation middleware factory
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
          ip: req.ip,
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        }) as any;
      }
      next(error);
    }
  };
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\son\w+\s*=\s*[^>\s]+/gi, '')
        .trim();
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};
