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
const PORT = process.env.PORT || 3002;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const ENABLE_POLLING = process.env.ENABLE_POLLING === 'true';

if (!TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

logger.info('Bot configuration:', {
  hasToken: !!TOKEN,
  enablePolling: ENABLE_POLLING,
  hasWebhookUrl: !!WEBHOOK_URL,
  port: PORT
});

// Create bot instance with ONLY polling (no webhook conflicts)
const bot = new TelegramBot(TOKEN, {
  polling: true,  // Force polling mode only
  webHook: false  // Explicitly disable webhook
});

// Create Express app for health checks only
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
    mode: 'polling_only',
    webhook_disabled: true
  });
});

// Explicitly delete any existing webhook to prevent conflicts
bot.deleteWebHook()
  .then(() => {
    logger.info('Webhook deleted successfully - using polling only');
  })
  .catch((error) => {
    logger.warn('Failed to delete webhook (might not exist):', error);
  });

// Initialize services
const userService = new UserService();
const analyticsService = new AnalyticsService();
const contentGenerationService = new ContentGenerationService();
const notificationService = new NotificationService(bot);
const proxyService = new ProxyService();
const qualityService = new QualityControlService();
const complianceService = new ComplianceService();
const automationService = new AutomationService(userService, contentGenerationService, proxyService, qualityService, complianceService);
const commandHandler = new BotCommandHandler(bot, userService, analyticsService, automationService, contentGenerationService, notificationService);
const callbackHandler = new BotCallbackHandler(bot, userService, analyticsService, notificationService, automationService, contentGenerationService);

// Bot event handlers
bot.on('message', async (msg) => {
  try {
    logger.info('Received message', {
      chatId: msg.chat.id,
      userId: msg.from?.id,
      username: msg.from?.username,
      text: msg.text?.substring(0, 100),
      messageId: msg.message_id,
      date: new Date(msg.date * 1000).toISOString()
    });

    // Ensure we have required data
    if (!msg.text) {
      logger.warn('Received message without text', { messageId: msg.message_id });
      return;
    }

    await commandHandler.handleMessage(msg);
    logger.info('Message handled successfully', { messageId: msg.message_id });
  } catch (error) {
    logger.error('Error handling message:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      messageId: msg.message_id,
      chatId: msg.chat.id
    });

    try {
      await bot.sendMessage(msg.chat.id, '❌ An error occurred while processing your request. Please try again later.');
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
      username: query.from.username,
      data: query.data,
      queryId: query.id,
      messageId: query.message?.message_id
    });

    // Ensure we have required data
    if (!query.data) {
      logger.warn('Received callback query without data', { queryId: query.id });
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Invalid callback data',
        show_alert: true
      });
      return;
    }

    await callbackHandler.handleCallback(query);
    logger.info('Callback query handled successfully', {
      queryId: query.id,
      data: query.data
    });
  } catch (error) {
    logger.error('Error handling callback query:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      queryId: query.id,
      data: query.data,
      chatId: query.message?.chat.id
    });

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
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  try {
    await bot.stopPolling();
    logger.info('Bot polling stopped');
  } catch (error) {
    logger.error('Error stopping bot polling:', error);
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  try {
    await bot.stopPolling();
    logger.info('Bot polling stopped');
  } catch (error) {
    logger.error('Error stopping bot polling:', error);
  }

  process.exit(0);
});

// Start HTTP server
app.listen(PORT, () => {
  logger.info(`Telegram bot server running on port ${PORT}`);
  logger.info(`Bot username: @${(bot as any).options?.username || 'unknown'}`);
  logger.info(`Webhook mode: ${!!WEBHOOK_URL}`);
});

// Initialize bot commands
const initializeBotCommands = async () => {
  try {
    const commands = [
      { command: 'start', description: 'Start using the bot' },
      { command: 'help', description: 'Show help information' },
      { command: 'accounts', description: 'Manage X accounts' },
      { command: 'campaigns', description: 'Manage campaigns' },
      { command: 'analytics', description: 'View analytics' },
      { command: 'settings', description: 'Bot settings' },
      { command: 'status', description: 'Check system status' },
      { command: 'stop', description: 'Stop all automations' },
    ];

    await bot.setMyCommands(commands);
    logger.info('Bot commands set successfully');
  } catch (error) {
    logger.error('Failed to set bot commands:', error);
  }
};

// Initialize bot
const initializeBot = async () => {
  try {
    const botInfo = await bot.getMe();
    logger.info('Bot initialized successfully', {
      id: botInfo.id,
      username: botInfo.username,
      firstName: botInfo.first_name,
    });

    await initializeBotCommands();

    // Start notification service
    await notificationService.start();

    logger.info('Telegram bot is ready to receive messages');
  } catch (error) {
    logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
};

initializeBot();

export { bot, app };
