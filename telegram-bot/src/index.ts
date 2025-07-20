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

// Enterprise Infrastructure Imports
import { eventBus } from './infrastructure/eventBus';
import { serviceDiscovery } from './infrastructure/serviceDiscovery';
import { circuitBreakerManager } from './infrastructure/circuitBreaker';
import { metrics } from './infrastructure/metrics';
import { tracing } from './infrastructure/tracing';
import { enterpriseWebhookService } from './services/enterpriseWebhookService';
import { QualityControlService } from './services/qualityControlService';
import { ComplianceService } from './services/complianceService';
import { BotBackendIntegration } from './services/botBackendIntegration';

// Health check routes
import healthRoutes from './routes/health';
import { enhancedUserService } from './services/enhancedUserService';
import { backendIntegration } from './services/backendIntegrationService';
import { extractUserData } from './utils/userDataUtils';


// Environment variables are provided by docker-compose
// dotenv.config({ path: '.env.local' });

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

// Create bot instance - support both polling and webhook modes
const bot = new TelegramBot(TOKEN, {
  polling: ENABLE_POLLING && !WEBHOOK_URL,  // Use polling only if enabled and no webhook
  webHook: !!WEBHOOK_URL  // Use webhook if URL is provided
});

// Create Express app for health checks and webhook
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Enterprise health check routes
app.use('/health', healthRoutes);

// Legacy health check endpoint for backward compatibility
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mode: WEBHOOK_URL ? 'webhook' : 'polling',
    webhook_url: WEBHOOK_URL || null
  });
});

// Enterprise webhook endpoint for Telegram
app.post('/webhook/telegram', async (req, res) => {
  try {
    await enterpriseWebhookService.processWebhookRequest(req.body, req.headers as Record<string, string>);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Enterprise webhook processing failed:', error);
    res.sendStatus(500);
  }
});

// Webhook management endpoints
app.get('/webhook/status', (req, res) => {
  const status = enterpriseWebhookService.getStatus();
  res.json(status);
});

app.post('/webhook/failover', async (req, res) => {
  try {
    await enterpriseWebhookService.performFailover();
    res.json({ success: true, message: 'Failover completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

logger.info('Enterprise webhook endpoints configured');

// Initialize enterprise webhook service
const initializeWebhookService = async () => {
  try {
    await enterpriseWebhookService.initialize();
    logger.info('Enterprise webhook service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize enterprise webhook service:', error);

    // Fallback to simple webhook or polling
    if (WEBHOOK_URL) {
      bot.setWebHook(WEBHOOK_URL, {
        allowed_updates: ['message', 'callback_query', 'inline_query']
      })
        .then(() => {
          logger.info(`Fallback webhook set successfully: ${WEBHOOK_URL}`);
        })
        .catch((error) => {
          logger.error('Failed to set fallback webhook:', error);
          logger.info('Falling back to polling mode');
        });
    } else {
      bot.deleteWebHook()
        .then(() => {
          logger.info('Webhook deleted successfully - using polling mode');
        })
        .catch((error) => {
          logger.warn('Failed to delete webhook (might not exist):', error);
        });
    }
  }
};

// Initialize services
const userService = new UserService();
const analyticsService = new AnalyticsService();
const contentGenerationService = new ContentGenerationService();
const notificationService = new NotificationService(bot);
const proxyService = new ProxyService();
const qualityService = new QualityControlService();
const complianceService = new ComplianceService();
const automationService = new AutomationService(userService, contentGenerationService, proxyService, qualityService, complianceService);

// Initialize backend integration
const botBackendIntegration = new BotBackendIntegration(bot, {
  enableAnalytics: true,
  enableContentGeneration: true,
  enableTemplates: true,
  enableUserSync: true,
  syncInterval: 300000 // 5 minutes
});

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
    if (!msg.text || !msg.from?.id) {
      logger.warn('Received message without required data', { messageId: msg.message_id });
      return;
    }

    // Skip backend integration for simulate commands to avoid rate limiting
    const isSimulateCommand = msg.text.startsWith('/simulate') ||
                             msg.text.includes('simulate') ||
                             (msg.text.startsWith('/') && msg.text.includes('sim'));

    if (!isSimulateCommand) {
      // Create or update user in enhanced service
      const userData = extractUserData(msg.from);
      await enhancedUserService.createOrUpdateUser(msg.from.id, userData);

      // Log user interaction
      await botBackendIntegration.handleUserInteraction(msg.from.id, 'message_received', {
        messageType: msg.text.startsWith('/') ? 'command' : 'text',
        chatType: msg.chat.type,
        hasUsername: !!msg.from.username
      });
    } else {
      logger.info('Skipping backend integration for simulate command', {
        text: msg.text,
        userId: msg.from.id
      });
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

    // Skip backend integration for simulate callbacks to avoid rate limiting
    const isSimulateCallback = query.data?.startsWith('simulate_') ||
                              query.data?.includes('simulate');

    if (!isSimulateCallback) {
      // Log user interaction
      await botBackendIntegration.handleUserInteraction(query.from.id, 'callback_query', {
        callbackData: query.data,
        chatType: query.message?.chat.type,
        hasUsername: !!query.from.username
      });
    } else {
      logger.info('Skipping backend integration for simulate callback', {
        data: query.data,
        userId: query.from.id
      });
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

  try {
    botBackendIntegration.destroy();
    logger.info('Backend integration cleaned up');
  } catch (error) {
    logger.error('Error cleaning up backend integration:', error);
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

  try {
    botBackendIntegration.destroy();
    logger.info('Backend integration cleaned up');
  } catch (error) {
    logger.error('Error cleaning up backend integration:', error);
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

// Initialize Enterprise Infrastructure
const initializeEnterpriseInfrastructure = async () => {
  try {
    logger.info('Initializing Enterprise Infrastructure...');

    // Initialize distributed tracing first
    await tracing.initialize();
    logger.info('✓ Distributed tracing initialized');

    // Initialize metrics collection
    const metricsPort = parseInt(process.env.METRICS_PORT || '9091');
    await metrics.initialize(metricsPort);
    logger.info('✓ Metrics collection initialized');

    // Initialize service discovery
    await serviceDiscovery.initialize();
    logger.info('✓ Service discovery initialized');

    // Register this service
    await serviceDiscovery.registerService({
      id: 'telegram-bot-service',
      name: 'telegram-bot',
      address: process.env.SERVICE_HOST || 'telegram-bot',
      port: parseInt(process.env.PORT || '3002'),
      tags: ['telegram', 'bot', 'enterprise', 'v1.0.0'],
      meta: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        team: 'platform',
        service_type: 'api'
      },
      check: {
        http: `http://${process.env.SERVICE_HOST || 'telegram-bot'}:${process.env.PORT || '3002'}/health`,
        interval: '10s',
        timeout: '5s',
        deregisterCriticalServiceAfter: '30s'
      }
    });
    logger.info('✓ Service registered with discovery');

    // Initialize event bus (optional for debugging)
    if (process.env.DISABLE_KAFKA !== 'true') {
      try {
        await eventBus.initialize();
        logger.info('✓ Event bus initialized');
      } catch (error) {
        logger.warn('⚠️ Event bus initialization failed, continuing without Kafka:', error);
      }
    } else {
      logger.warn('⚠️ Kafka is disabled via DISABLE_KAFKA environment variable');
    }

    // Setup event subscriptions (optional for debugging)
    if (process.env.DISABLE_KAFKA !== 'true') {
      try {
        await setupEventSubscriptions();
        logger.info('✓ Event subscriptions configured');
      } catch (error) {
        logger.warn('⚠️ Event subscriptions setup failed, continuing without event subscriptions:', error);
      }
    }

    logger.info('Enterprise Infrastructure initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize Enterprise Infrastructure:', error);
    throw error;
  }
};

// Setup event subscriptions
const setupEventSubscriptions = async () => {
  // Subscribe to user events
  await eventBus.subscribe('user.created', async (event: any) => {
    const userId = event.data?.userId || event.userId || 'unknown';
    logger.info('User created event received', { userId });
    metrics.userInteractions.inc({ type: 'user_created', user_id: userId.toString() });
  });

  await eventBus.subscribe('user.activity', async (event: any) => {
    const userId = event.data?.userId || event.userId || 'unknown';
    const action = event.data?.action || event.action || 'activity';
    logger.debug('User activity event received', {
      userId,
      action
    });
    metrics.userInteractions.inc({
      type: action,
      user_id: userId.toString()
    });
  });

  // Subscribe to content events
  await eventBus.subscribe('content.generated', async (event: any) => {
    const userId = event.data?.userId || event.userId || 'unknown';
    const contentType = event.data?.contentType || event.contentType || 'text';
    logger.info('Content generated event received', {
      userId,
      contentType
    });
    metrics.contentGenerationRequests.inc({
      type: contentType,
      status: 'success'
    });
  });

  await eventBus.subscribe('content.failed', async (event: any) => {
    const userId = event.data?.userId || event.userId || 'unknown';
    const contentType = event.data?.contentType || event.contentType || 'text';
    logger.warn('Content generation failed event received', {
      userId,
      contentType
    });
    metrics.contentGenerationFailures.inc({
      type: contentType,
      error: 'generation_failed'
    });
  });

  // Subscribe to system events
  await eventBus.subscribe('system.error', async (event: any) => {
    const service = event.data?.service || event.service || 'unknown';
    const severity = event.data?.severity || event.severity || 'medium';
    logger.error('System error event received', {
      service,
      severity
    });
  });
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

    // Initialize backend integration with circuit breaker
    const backendCircuitBreaker = circuitBreakerManager.getCircuitBreaker('backend-service', {
      failureThreshold: 5,
      resetTimeout: 60000,
      timeout: 30000
    });

    try {
      // Add timeout to prevent hanging
      const initPromise = backendCircuitBreaker.execute(async () => {
        await botBackendIntegration.initialize();
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Backend integration timeout')), 10000)
      );

      await Promise.race([initPromise, timeoutPromise]);
      logger.info('Backend integration initialized successfully');
    } catch (error) {
      logger.warn('Backend integration failed to initialize, continuing with limited functionality:', error);
    }

    // Start notification service
    await notificationService.start();

    // Publish system event
    await eventBus.publishSystemEvent('system.health', 'telegram-bot', {
      status: 'initialized',
      timestamp: new Date().toISOString()
    });

    logger.info('Telegram bot is ready to receive messages');
  } catch (error) {
    logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
};

// Main initialization sequence
const initializeApplication = async () => {
  try {
    logger.info('Starting Enterprise Telegram Bot Application...');

    // Initialize enterprise infrastructure first
    await initializeEnterpriseInfrastructure();

    // Initialize webhook service
    await initializeWebhookService();

    // Then initialize the bot
    await initializeBot();

    logger.info('Enterprise Telegram Bot Application started successfully');

  } catch (error) {
    logger.error('Failed to start application:', error);
    await gracefulShutdown();
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info('Initiating graceful shutdown...');

  try {
    // Stop accepting new requests
    if (WEBHOOK_URL) {
      await bot.deleteWebHook();
    }

    // Shutdown enterprise infrastructure
    await eventBus.shutdown();
    logger.info('✓ Event bus shutdown');

    await serviceDiscovery.shutdown();
    logger.info('✓ Service discovery shutdown');

    await metrics.shutdown();
    logger.info('✓ Metrics server shutdown');

    await tracing.shutdown();
    logger.info('✓ Distributed tracing shutdown');

    circuitBreakerManager.shutdown();
    logger.info('✓ Circuit breakers shutdown');

    // Close HTTP server
    if (app) {
      const server = app.listen();
      server.close();
    }

    logger.info('Graceful shutdown completed');

  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
  }
};

// Handle process signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown().then(() => process.exit(1));
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown().then(() => process.exit(1));
});

// Start the application
initializeApplication();

export { bot, app };
