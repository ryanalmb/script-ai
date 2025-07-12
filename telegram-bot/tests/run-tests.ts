#!/usr/bin/env ts-node

import { ComprehensiveBotTester } from './comprehensive-bot-test';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const testChatId = parseInt(process.env.TEST_CHAT_ID || '6447668010');

  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
    process.exit(1);
  }

  console.log('🤖 X Marketing Platform - Comprehensive Bot Testing');
  console.log('=' .repeat(60));
  console.log(`📱 Bot Token: ${token.substring(0, 10)}...`);
  console.log(`👤 Test Chat ID: ${testChatId}`);
  console.log(`🕐 Started: ${new Date().toLocaleString()}`);
  console.log('=' .repeat(60));

  const tester = new ComprehensiveBotTester(token, testChatId);
  
  try {
    await tester.runAllTests();
    console.log('\n✅ Testing completed successfully!');
  } catch (error) {
    console.error('\n❌ Testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
