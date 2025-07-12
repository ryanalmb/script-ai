import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { BotCommandHandler } from './handlers/commandHandler';
import { BotCallbackHandler } from './handlers/callbackHandler';
import { NotificationService } from './services/notificationService';
import { UserService } from './services/userService';
import { AnalyticsService } from './services/analyticsService';
import { AutomationService } from './services/automationService';
import { ContentGenerationService } from './services/contentGenerationService';
import { ProxyService } from './services/proxyService';
import { QualityControlService } from './services/qualityControlService';
import { ComplianceService } from './services/complianceService';

// Load environment variables
dotenv.config({ path: '.env.local' });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.TELEGRAM_BOT_PORT || 3002;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

// Create Express app for webhooks and health checks
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Telegram Bot',
    version: '1.0.0',
    bot_configured: !!TOKEN,
    webhook_configured: !!WEBHOOK_URL,
    features: [
      'X/Twitter Automation Control',
      'Multi-Account Management',
      'AI Content Generation',
      'Real-Time Analytics',
      'Campaign Management',
      'Quality Control',
      'Compliance Monitoring',
      'Emergency Controls',
      'Performance Optimization',
      'Proxy Management'
    ]
  });
});

// Bot status endpoint
app.get('/api/bot/status', (req, res) => {
  res.json({
    success: true,
    bot: {
      configured: !!TOKEN,
      webhook_mode: !!WEBHOOK_URL,
      polling_mode: !WEBHOOK_URL,
      status: 'active',
      commands: [
        '/start - Initialize X Marketing Platform',
        '/help - Show comprehensive help menu',
        '/status - System and automation status',
        '/accounts - Multi-account management',
        '/campaigns - Campaign management',
        '/automation - Automation controls',
        '/analytics - Performance analytics',
        '/content - AI content generation',
        '/settings - Bot configuration',
        '/emergency - Emergency stop controls',
        '/quality - Quality control settings',
        '/compliance - Compliance monitoring',
        '/proxy - Proxy management',
        '/schedule - Content scheduling',
        '/trends - Trending topics analysis'
      ],
      features: {
        posting: 'available',
        liking: 'available',
        commenting: 'available',
        following: 'available',
        dm: 'available',
        polls: 'available',
        threads: 'available',
        multiAccount: 'available',
        qualityControl: 'available',
        compliance: 'available',
        proxyManagement: 'available',
        contentGeneration: 'available',
        analytics: 'available',
        scheduling: 'available',
        trendingAnalysis: 'available'
      }
    }
  });
});

// Create bot instance with proper configuration
const botOptions: TelegramBot.ConstructorOptions = {
  polling: !WEBHOOK_URL,
  webHook: WEBHOOK_URL ? {
    port: parseInt(PORT as string),
    host: '0.0.0.0'
  } : false
};

const bot = new TelegramBot(TOKEN, botOptions);

// Initialize services
const userService = new UserService();
const analyticsService = new AnalyticsService();
const contentGenerationService = new ContentGenerationService();
const notificationService = new NotificationService(bot);
const proxyService = new ProxyService();
const qualityService = new QualityControlService();
const complianceService = new ComplianceService();
const automationService = new AutomationService(userService, contentGenerationService, proxyService, qualityService, complianceService);
const commandHandler = new BotCommandHandler(
  bot,
  userService,
  analyticsService,
  automationService,
  contentGenerationService,
  notificationService
);
const callbackHandler = new BotCallbackHandler(
  bot,
  userService,
  analyticsService,
  notificationService
);

// Webhook endpoint
if (WEBHOOK_URL) {
  app.post(`/webhook/${TOKEN}`, (req, res) => {
    try {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.sendStatus(500);
    }
  });

  // Set webhook
  bot.setWebHook(`${WEBHOOK_URL}/webhook/${TOKEN}`)
    .then(() => {
      logger.info('Webhook set successfully', { url: WEBHOOK_URL });
    })
    .catch((error) => {
      logger.error('Failed to set webhook:', error);
    });
}

// Bot event handlers
bot.on('message', async (msg) => {
  try {
    logger.info('Received message', {
      chatId: msg.chat.id,
      userId: msg.from?.id,
      username: msg.from?.username,
      text: msg.text?.substring(0, 100),
      messageType: msg.text ? 'text' : 'other'
    });

    // Track analytics
    await analyticsService.trackEvent(msg.from?.id || 0, 'message_received', {
      chatId: msg.chat.id,
      messageType: msg.text ? 'text' : 'other'
    });

    await commandHandler.handleMessage(msg);
  } catch (error) {
    logger.error('Error handling message:', error);
    
    try {
      await bot.sendMessage(
        msg.chat.id, 
        '❌ An error occurred while processing your request. Please try again later.\n\nIf the issue persists, use /help for assistance.'
      );
    } catch (sendError) {
      logger.error('Error sending error message:', sendError);
    }
  }
});

bot.on('callback_query', async (query) => {
  try {
    logger.info('Received callback query', {
      chatId: query.message?.chat.id,
      userId: query.from.id,
      data: query.data,
      username: query.from.username
    });

    // Track analytics
    await analyticsService.trackEvent(query.from.id, 'callback_query', {
      data: query.data,
      chatId: query.message?.chat.id
    });

    await callbackHandler.handleCallback(query);
  } catch (error) {
    logger.error('Error handling callback query:', error);
    
    try {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ An error occurred. Please try again.',
        show_alert: true,
      });
    } catch (answerError) {
      logger.error('Error answering callback query:', answerError);
    }
  }
});

bot.on('polling_error', (error) => {
  logger.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  logger.error('Webhook error:', error);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    if (!WEBHOOK_URL) {
      await bot.stopPolling();
      logger.info('Bot polling stopped');
    }
    
    await notificationService.stop();
    logger.info('Notification service stopped');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start HTTP server
app.listen(PORT, () => {
  logger.info(`Telegram bot server running on port ${PORT}`);
  logger.info(`Bot mode: ${WEBHOOK_URL ? 'webhook' : 'polling'}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Bot status: http://localhost:${PORT}/api/bot/status`);
});

// Initialize bot commands and services
const initializeBot = async () => {
  try {
    const botInfo = await bot.getMe();
    logger.info('Bot initialized successfully', {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
    });

    // Set bot commands
    const commands = [
      { command: 'start', description: 'Initialize X Marketing Platform' },
      { command: 'help', description: 'Show comprehensive help menu' },
      { command: 'status', description: 'System and automation status' },
      { command: 'accounts', description: 'Multi-account management' },
      { command: 'campaigns', description: 'Campaign management' },
      { command: 'automation', description: 'Automation controls' },
      { command: 'analytics', description: 'Performance analytics' },
      { command: 'content', description: 'AI content generation' },
      { command: 'settings', description: 'Bot configuration' },
      { command: 'emergency', description: 'Emergency stop controls' },
      { command: 'quality', description: 'Quality control settings' },
      { command: 'compliance', description: 'Compliance monitoring' },
      { command: 'proxy', description: 'Proxy management' },
      { command: 'schedule', description: 'Content scheduling' },
      { command: 'trends', description: 'Trending topics analysis' }
    ];

    await bot.setMyCommands(commands);
    logger.info('Bot commands set successfully');
    
    // Start notification service
    await notificationService.start();
    
    logger.info('🚀 X Marketing Platform Telegram Bot is ready!');
    logger.info('✅ All services initialized and operational');
    
  } catch (error) {
    logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
};

// Initialize the bot
initializeBot();

export { bot, app };
