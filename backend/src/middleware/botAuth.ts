import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

// Bot authentication configuration
const BOT_JWT_SECRET = process.env.BOT_JWT_SECRET || 'bot-secret-key';
const BOT_API_KEY_HEADER = 'x-bot-api-key';
const BOT_SIGNATURE_HEADER = 'x-bot-signature';
const BOT_TIMESTAMP_HEADER = 'x-bot-timestamp';
const BOT_NONCE_HEADER = 'x-bot-nonce';

// Request signature validation window (5 minutes)
const SIGNATURE_VALIDITY_WINDOW = 5 * 60 * 1000;

// Rate limiting for bot authentication
const BOT_AUTH_RATE_LIMIT = 100; // requests per minute
const BOT_AUTH_RATE_WINDOW = 60 * 1000; // 1 minute

interface BotAuthRequest extends Request {
  botId?: string;
  botInfo?: {
    id: string;
    name: string;
    permissions: string[];
    rateLimit: number;
    isActive: boolean;
  };
}

/**
 * Bot authentication middleware
 * Supports multiple authentication methods:
 * 1. JWT tokens for trusted bots
 * 2. API key + signature for webhook bots
 * 3. Telegram bot token validation
 */
export async function authenticateBot(
  req: BotAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers[BOT_API_KEY_HEADER] as string;
    const signature = req.headers[BOT_SIGNATURE_HEADER] as string;
    const timestamp = req.headers[BOT_TIMESTAMP_HEADER] as string;
    const nonce = req.headers[BOT_NONCE_HEADER] as string;

    // Check rate limiting for bot authentication
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const rateLimitKey = `bot_auth_rate_limit:${clientIp}`;
    
    const currentRequests = await cacheManager.get(rateLimitKey) || 0;
    if ((currentRequests as number) >= BOT_AUTH_RATE_LIMIT) {
      logger.warn(`Bot authentication rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({
        success: false,
        error: 'Authentication rate limit exceeded',
        botResponse: {
          type: 'error',
          message: '❌ Too many authentication attempts. Please wait before trying again.',
          retryAfter: 60
        }
      });
    }

    // Increment rate limit counter
    await cacheManager.set(
      rateLimitKey,
      (currentRequests as number) + 1,
      Math.ceil(BOT_AUTH_RATE_WINDOW / 1000)
    );

    let botInfo: any = null;

    // Method 1: JWT Token Authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      botInfo = await authenticateWithJWT(token);
    }
    // Method 2: API Key + Signature Authentication
    else if (apiKey && signature && timestamp && nonce) {
      botInfo = await authenticateWithSignature(req, apiKey, signature, timestamp, nonce);
    }
    // Method 3: Telegram Bot Token Authentication
    else if (authHeader && authHeader.startsWith('Bot ')) {
      const botToken = authHeader.substring(4);
      botInfo = await authenticateWithTelegramToken(botToken);
    }
    else {
      logger.warn('Bot authentication failed: No valid authentication method provided');
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        botResponse: {
          type: 'error',
          message: '❌ Authentication required. Please provide valid credentials.',
          authMethods: ['Bearer JWT', 'API Key + Signature', 'Telegram Bot Token']
        }
      });
    }

    if (!botInfo) {
      logger.warn('Bot authentication failed: Invalid credentials');
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication credentials',
        botResponse: {
          type: 'error',
          message: '❌ Invalid authentication credentials. Please check your bot configuration.'
        }
      });
    }

    // Check if bot is active
    if (!botInfo.isActive) {
      logger.warn(`Bot authentication failed: Bot ${botInfo.id} is inactive`);
      return res.status(403).json({
        success: false,
        error: 'Bot account is inactive',
        botResponse: {
          type: 'error',
          message: '❌ Bot account is inactive. Please contact administrator.'
        }
      });
    }

    // Check bot-specific rate limiting
    const botRateLimitKey = `bot_rate_limit:${botInfo.id}`;
    const botRequests = await cacheManager.get(botRateLimitKey) || 0;
    
    if (botRequests >= botInfo.rateLimit) {
      logger.warn(`Bot rate limit exceeded for bot: ${botInfo.id}`);
      return res.status(429).json({
        success: false,
        error: 'Bot rate limit exceeded',
        botResponse: {
          type: 'error',
          message: '❌ Bot rate limit exceeded. Please wait before making more requests.',
          retryAfter: 60
        }
      });
    }

    // Increment bot rate limit counter
    await cacheManager.set(
      botRateLimitKey,
      (botRequests as number) + 1,
      60 // 1 minute TTL
    );

    // Attach bot information to request
    req.botId = botInfo.id;
    req.botInfo = botInfo;

    // Log successful authentication
    logger.info(`Bot authenticated successfully: ${botInfo.id} (${botInfo.name})`);

    // Record bot activity
    await recordBotActivity(botInfo.id, req);

    next();
  } catch (error) {
    logger.error('Bot authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service error',
      botResponse: {
        type: 'error',
        message: '❌ Authentication service error. Please try again later.'
      }
    });
  }
}

/**
 * Authenticate bot using JWT token
 */
async function authenticateWithJWT(token: string): Promise<any> {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, BOT_JWT_SECRET) as any;
    
    if (!decoded.botId || !decoded.type || decoded.type !== 'bot') {
      throw new Error('Invalid bot JWT token');
    }

    // Get bot information from database
    const bot = await prisma.telegramBot.findUnique({
      where: { id: decoded.botId },
      select: {
        id: true,
        name: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastActiveAt: true
      }
    });

    if (!bot) {
      throw new Error('Bot not found');
    }

    return {
      id: bot.id,
      name: bot.name,
      permissions: bot.permissions || [],
      rateLimit: bot.rateLimit || 60,
      isActive: bot.isActive,
      authMethod: 'jwt'
    };
  } catch (error) {
    logger.error('JWT bot authentication failed:', error);
    return null;
  }
}

/**
 * Authenticate bot using API key and signature
 */
async function authenticateWithSignature(
  req: Request,
  apiKey: string,
  signature: string,
  timestamp: string,
  nonce: string
): Promise<any> {
  try {
    // Validate timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    
    if (Math.abs(currentTime - requestTime) > SIGNATURE_VALIDITY_WINDOW) {
      throw new Error('Request timestamp is outside valid window');
    }

    // Check nonce to prevent replay attacks
    const nonceKey = `bot_nonce:${nonce}`;
    const nonceExists = await cacheManager.get(nonceKey);
    
    if (nonceExists) {
      throw new Error('Nonce has already been used');
    }

    // Store nonce to prevent reuse
    await cacheManager.set(nonceKey, true, SIGNATURE_VALIDITY_WINDOW / 1000);

    // Get bot by API key
    const bot = await prisma.telegramBot.findFirst({
      where: { 
        apiKey,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        apiSecret: true,
        permissions: true,
        rateLimit: true,
        isActive: true
      }
    });

    if (!bot || !bot.apiSecret) {
      throw new Error('Invalid API key');
    }

    // Generate expected signature
    const requestBody = JSON.stringify(req.body);
    const signaturePayload = `${req.method}${req.path}${requestBody}${timestamp}${nonce}`;
    const expectedSignature = crypto
      .createHmac('sha256', bot.apiSecret)
      .update(signaturePayload)
      .digest('hex');

    // Verify signature
    if (!crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )) {
      throw new Error('Invalid signature');
    }

    return {
      id: bot.id,
      name: bot.name,
      permissions: bot.permissions || [],
      rateLimit: bot.rateLimit || 60,
      isActive: bot.isActive,
      authMethod: 'signature'
    };
  } catch (error) {
    logger.error('Signature bot authentication failed:', error);
    return null;
  }
}

/**
 * Authenticate bot using Telegram bot token
 */
async function authenticateWithTelegramToken(botToken: string): Promise<any> {
  try {
    // Validate Telegram bot token format
    if (!botToken.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
      throw new Error('Invalid Telegram bot token format');
    }

    // Extract bot ID from token
    const botId = botToken.split(':')[0];

    // Verify token with Telegram API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/getMe`;
    const response = await fetch(telegramApiUrl);
    const data = await response.json();

    if (!(data as any).ok) {
      throw new Error('Invalid Telegram bot token');
    }

    // Get or create bot record in database
    let bot = await prisma.telegramBot.findFirst({
      where: {
        telegramBotId: botId || null,
        isActive: true
      }
    });

    if (!bot) {
      // Create new bot record
      bot = await prisma.telegramBot.create({
        data: {
          id: `telegram_bot_${botId}`,
          name: (data as any).result.first_name || `Bot ${botId}`,
          telegramBotId: botId || null,
          telegramUsername: (data as any).result.username,
          botToken: botToken, // Store encrypted in production
          permissions: ['basic_access'],
          rateLimit: 30, // Conservative rate limit for new bots
          isActive: true,
          metadata: {
            telegramData: (data as any).result,
            createdViaAuth: true
          }
        }
      });
    }

    return {
      id: bot.id,
      name: bot.name,
      permissions: bot.permissions || ['basic_access'],
      rateLimit: bot.rateLimit || 30,
      isActive: bot.isActive,
      authMethod: 'telegram',
      telegramData: (data as any).result
    };
  } catch (error) {
    logger.error('Telegram bot authentication failed:', error);
    return null;
  }
}

/**
 * Record bot activity for monitoring and analytics
 */
async function recordBotActivity(botId: string, req: Request): Promise<void> {
  try {
    // Update last active timestamp
    await prisma.telegramBot.update({
      where: { id: botId },
      data: { lastActiveAt: new Date() }
    });

    // Record activity metrics
    const activityKey = `bot_activity:${botId}:${new Date().toISOString().split('T')[0]}`;
    const currentActivity = await cacheManager.get(activityKey) || {
      requests: 0,
      endpoints: {},
      errors: 0
    };

    (currentActivity as any).requests++;
    (currentActivity as any).endpoints[req.path] = ((currentActivity as any).endpoints[req.path] || 0) + 1;

    await cacheManager.set(activityKey, currentActivity, 24 * 60 * 60); // 24 hours

    // Store detailed activity log (optional, for debugging)
    if (process.env.BOT_DETAILED_LOGGING === 'true') {
      await prisma.botActivityLog.create({
        data: {
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          botId,
          endpoint: req.path,
          method: req.method,




          metadata: {
            headers: req.headers,
            query: req.query
          }
        }
      });
    }
  } catch (error) {
    logger.error('Failed to record bot activity:', error);
    // Don't throw error as this is non-critical
  }
}

/**
 * Middleware to check specific bot permissions
 */
export function requireBotPermission(permission: string) {
  return (req: BotAuthRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.botInfo) {
      return res.status(401).json({
        success: false,
        error: 'Bot not authenticated',
        botResponse: {
          type: 'error',
          message: '❌ Bot authentication required.'
        }
      });
    }

    if (!req.botInfo.permissions.includes(permission) && 
        !req.botInfo.permissions.includes('admin')) {
      logger.warn(`Bot ${req.botInfo.id} lacks permission: ${permission}`);
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions: ${permission} required`,
        botResponse: {
          type: 'error',
          message: `❌ This action requires the '${permission}' permission. Please contact administrator.`
        }
      });
    }

    next();
  };
}

/**
 * Generate JWT token for bot authentication
 */
export function generateBotJWT(botId: string, expiresIn: string = '24h'): string {
  const payload = {
    botId,
    type: 'bot',
    iat: Math.floor(Date.now() / 1000)
  };

  const options = { expiresIn };

  return jwt.sign(payload, BOT_JWT_SECRET, options);
}

/**
 * Generate API key and secret for bot
 */
export function generateBotApiCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = crypto.randomBytes(32).toString('hex');
  const apiSecret = crypto.randomBytes(64).toString('hex');
  
  return { apiKey, apiSecret };
}

/**
 * Generate request signature for bot API calls
 */
export function generateRequestSignature(
  method: string,
  path: string,
  body: any,
  timestamp: number,
  nonce: string,
  apiSecret: string
): string {
  const requestBody = JSON.stringify(body);
  const signaturePayload = `${method}${path}${requestBody}${timestamp}${nonce}`;
  
  return crypto
    .createHmac('sha256', apiSecret)
    .update(signaturePayload)
    .digest('hex');
}

/**
 * Validate bot webhook signature (for Telegram webhooks)
 */
export function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Webhook signature validation failed:', error);
    return false;
  }
}

/**
 * Get bot activity statistics
 */
export async function getBotActivityStats(botId: string, days: number = 7): Promise<any> {
  try {
    const stats = {
      totalRequests: 0,
      dailyBreakdown: {},
      topEndpoints: {},
      errorRate: 0,
      avgRequestsPerDay: 0
    };

    // Get activity data for the specified number of days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const activityKey = `bot_activity:${botId}:${dateKey}`;
      const dayActivity = await cacheManager.get(activityKey);
      
      if (dayActivity) {
        stats.totalRequests += (dayActivity as any).requests;
        if (dateKey) {
          (stats.dailyBreakdown as Record<string, number>)[dateKey] = (dayActivity as any).requests;
        }
        
        // Aggregate endpoint usage
        for (const [endpoint, count] of Object.entries((dayActivity as any).endpoints)) {
          (stats.topEndpoints as any)[endpoint] = ((stats.topEndpoints as any)[endpoint] || 0) + (count as number);
        }
      }
    }

    stats.avgRequestsPerDay = stats.totalRequests / days;

    return stats;
  } catch (error) {
    logger.error('Failed to get bot activity stats:', error);
    return null;
  }
}

export default {
  authenticateBot,
  requireBotPermission,
  generateBotJWT,
  generateBotApiCredentials,
  generateRequestSignature,
  validateWebhookSignature,
  getBotActivityStats
};
