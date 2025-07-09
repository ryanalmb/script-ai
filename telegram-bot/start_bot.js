#!/usr/bin/env node
/**
 * Telegram Bot Startup Script with Real API Token
 */

// Set environment variables
process.env.TELEGRAM_BOT_TOKEN = '7848656841:AAFm6v8KPzn1zPZmHKklXjkIwzQ8fYY25O0';
process.env.BACKEND_URL = 'http://localhost:3001';
process.env.LLM_SERVICE_URL = 'http://localhost:3003';
process.env.NODE_ENV = 'development';
process.env.PORT = '3002';
process.env.ENABLE_POLLING = 'true';
process.env.LOG_LEVEL = 'debug';

console.log('🤖 Starting Telegram Bot with real API credentials...');
console.log(`🔑 Bot Token: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 20)}...`);
console.log(`🔗 Backend URL: ${process.env.BACKEND_URL}`);
console.log(`🧠 LLM Service URL: ${process.env.LLM_SERVICE_URL}`);
console.log(`🚀 Starting on port: ${process.env.PORT}`);

// Import and run the bot
try {
    require('./dist/index.js');
} catch (error) {
    console.error('❌ Error starting Telegram bot:', error);
    process.exit(1);
}
