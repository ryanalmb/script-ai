#!/usr/bin/env node

/**
 * Telegram Bot Webhook Setup Script
 * 
 * This script helps you set up webhooks for the Telegram bot.
 * 
 * Usage:
 * node scripts/setup-webhook.js set <webhook-url>
 * node scripts/setup-webhook.js delete
 * node scripts/setup-webhook.js info
 */

const https = require('https');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required in .env.local');
  process.exit(1);
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TOKEN}`;

/**
 * Make HTTPS request to Telegram API
 */
function makeRequest(endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = `${TELEGRAM_API_BASE}/${endpoint}`;
    const options = {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Set webhook URL
 */
async function setWebhook(webhookUrl) {
  try {
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    
    const response = await makeRequest('setWebhook', {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query', 'inline_query'],
      drop_pending_updates: true
    });

    if (response.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`📝 Description: ${response.description}`);
    } else {
      console.error('❌ Failed to set webhook:', response.description);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
  }
}

/**
 * Delete webhook
 */
async function deleteWebhook() {
  try {
    console.log('🗑️  Deleting webhook...');
    
    const response = await makeRequest('deleteWebhook', {
      drop_pending_updates: true
    });

    if (response.ok) {
      console.log('✅ Webhook deleted successfully!');
      console.log('📝 Bot is now in polling mode');
    } else {
      console.error('❌ Failed to delete webhook:', response.description);
    }
  } catch (error) {
    console.error('❌ Error deleting webhook:', error.message);
  }
}

/**
 * Get webhook info
 */
async function getWebhookInfo() {
  try {
    console.log('ℹ️  Getting webhook info...');
    
    const response = await makeRequest('getWebhookInfo');

    if (response.ok) {
      const info = response.result;
      console.log('\n📊 Webhook Information:');
      console.log(`🔗 URL: ${info.url || 'Not set'}`);
      console.log(`✅ Has custom certificate: ${info.has_custom_certificate}`);
      console.log(`📊 Pending update count: ${info.pending_update_count}`);
      console.log(`📅 Last error date: ${info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : 'None'}`);
      console.log(`❌ Last error message: ${info.last_error_message || 'None'}`);
      console.log(`🔄 Max connections: ${info.max_connections || 'Default'}`);
      console.log(`📝 Allowed updates: ${info.allowed_updates ? info.allowed_updates.join(', ') : 'All'}`);
    } else {
      console.error('❌ Failed to get webhook info:', response.description);
    }
  } catch (error) {
    console.error('❌ Error getting webhook info:', error.message);
  }
}

/**
 * Validate webhook URL
 */
function validateWebhookUrl(url) {
  if (!url) {
    console.error('❌ Webhook URL is required');
    return false;
  }

  if (!url.startsWith('https://')) {
    console.error('❌ Webhook URL must use HTTPS');
    return false;
  }

  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    console.error('❌ Webhook URL cannot be localhost or 127.0.0.1');
    return false;
  }

  return true;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🤖 Telegram Bot Webhook Setup\n');

  switch (command) {
    case 'set':
      const webhookUrl = args[1];
      if (validateWebhookUrl(webhookUrl)) {
        await setWebhook(webhookUrl);
      }
      break;

    case 'delete':
      await deleteWebhook();
      break;

    case 'info':
      await getWebhookInfo();
      break;

    default:
      console.log('📖 Usage:');
      console.log('  node scripts/setup-webhook.js set <webhook-url>');
      console.log('  node scripts/setup-webhook.js delete');
      console.log('  node scripts/setup-webhook.js info');
      console.log('\n💡 Examples:');
      console.log('  node scripts/setup-webhook.js set https://your-domain.com/webhook/telegram');
      console.log('  node scripts/setup-webhook.js set https://abc123.ngrok.io/webhook/telegram');
      console.log('  node scripts/setup-webhook.js delete');
      console.log('  node scripts/setup-webhook.js info');
      break;
  }
}

// Run the script
main().catch(console.error);
