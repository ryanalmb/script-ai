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

// Load environment variables
dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3002;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

if (!TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(TOKEN, { polling: !WEBHOOK_URL });

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
  });
});

// Webhook endpoint
if (WEBHOOK_URL) {
  app.post(`/webhook/${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  // Set webhook
  bot.setWebHook(`${WEBHOOK_URL}/webhook/${TOKEN}`)
    .then(() => {
      logger.info('Webhook set successfully');
    })
    .catch((error) => {
      logger.error('Failed to set webhook:', error);
    });
}

// Initialize services
const userService = new UserService();
const analyticsService = new AnalyticsService();
const notificationService = new NotificationService(bot);
const automationService = new AutomationService();
const contentService = new ContentGenerationService();
const commandHandler = new BotCommandHandler(bot, userService, analyticsService, notificationService, automationService, contentService);
const callbackHandler = new BotCallbackHandler(bot, userService, analyticsService, notificationService, automationService, contentService);

// Bot event handlers
bot.on('message', async (msg) => {
  try {
    logger.info('Received message', {
      chatId: msg.chat.id,
      userId: msg.from?.id,
      username: msg.from?.username,
      text: msg.text?.substring(0, 100),
    });

    await commandHandler.handleMessage(msg);
  } catch (error) {
    logger.error('Error handling message:', error);
    
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
      data: query.data,
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
