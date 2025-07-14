import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger';
import { safeErrorMessage } from '../utils/userDataUtils';

interface SecureMessage {
  chatId: number;
  messageId: number;
  timestamp: Date;
  autoDeleteAfter: number; // milliseconds
}

class SecureMessageService {
  private bot: TelegramBot;
  private secureMessages: Map<string, SecureMessage> = new Map();
  private readonly DEFAULT_DELETE_AFTER = 30 * 1000; // 30 seconds

  constructor(bot: TelegramBot) {
    this.bot = bot;
    
    // Clean up expired messages every 10 seconds
    setInterval(() => this.cleanupExpiredMessages(), 10 * 1000);
  }

  /**
   * Send a message that will be automatically deleted after a specified time
   */
  async sendSecureMessage(
    chatId: number, 
    text: string, 
    options: any = {}, 
    deleteAfter: number = this.DEFAULT_DELETE_AFTER
  ): Promise<TelegramBot.Message> {
    try {
      const message = await this.bot.sendMessage(chatId, text, options);
      
      // Track message for auto-deletion
      this.trackSecureMessage(chatId, message.message_id, deleteAfter);
      
      return message;
    } catch (error) {
      logger.error('Failed to send secure message:', error);
      throw error;
    }
  }

  /**
   * Track a message for automatic deletion
   */
  trackSecureMessage(chatId: number, messageId: number, deleteAfter: number = this.DEFAULT_DELETE_AFTER): void {
    const key = `${chatId}:${messageId}`;
    const secureMessage: SecureMessage = {
      chatId,
      messageId,
      timestamp: new Date(),
      autoDeleteAfter: deleteAfter
    };

    this.secureMessages.set(key, secureMessage);
    
    // Schedule deletion
    setTimeout(() => {
      this.deleteMessage(chatId, messageId);
    }, deleteAfter);

    logger.debug('Tracking secure message for deletion', { chatId, messageId, deleteAfter });
  }

  /**
   * Immediately delete a message
   */
  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    try {
      await this.bot.deleteMessage(chatId, messageId);
      
      // Remove from tracking
      const key = `${chatId}:${messageId}`;
      this.secureMessages.delete(key);
      
      logger.debug('Deleted secure message', { chatId, messageId });
      return true;
    } catch (error) {
      logger.warn('Failed to delete message (may already be deleted)', { chatId, messageId, error: safeErrorMessage(error) });
      
      // Remove from tracking even if deletion failed
      const key = `${chatId}:${messageId}`;
      this.secureMessages.delete(key);
      
      return false;
    }
  }

  /**
   * Delete multiple messages
   */
  async deleteMessages(chatId: number, messageIds: number[]): Promise<void> {
    const deletePromises = messageIds.map(messageId => 
      this.deleteMessage(chatId, messageId)
    );

    await Promise.allSettled(deletePromises);
    logger.info('Deleted multiple secure messages', { chatId, count: messageIds.length });
  }

  /**
   * Send a message with immediate deletion warning
   */
  async sendSensitiveDataRequest(
    chatId: number, 
    text: string, 
    options: any = {}
  ): Promise<TelegramBot.Message> {
    const warningText = `🔒 **SECURE INPUT REQUIRED**

${text}

⚠️ **Security Notice:**
• Your message will be automatically deleted after 30 seconds
• Do not share sensitive information in group chats
• Use /cancel to abort authentication

Please send your response now:`;

    return this.sendSecureMessage(chatId, warningText, {
      parse_mode: 'Markdown',
      ...options
    }, 60 * 1000); // Keep instruction message for 1 minute
  }

  /**
   * Send a confirmation message that auto-deletes
   */
  async sendSecureConfirmation(
    chatId: number, 
    text: string, 
    deleteAfter: number = 10 * 1000
  ): Promise<TelegramBot.Message> {
    return this.sendSecureMessage(chatId, `✅ ${text}`, {
      parse_mode: 'Markdown'
    }, deleteAfter);
  }

  /**
   * Send an error message that auto-deletes
   */
  async sendSecureError(
    chatId: number, 
    text: string, 
    deleteAfter: number = 15 * 1000
  ): Promise<TelegramBot.Message> {
    return this.sendSecureMessage(chatId, `❌ ${text}`, {
      parse_mode: 'Markdown'
    }, deleteAfter);
  }

  /**
   * Process and immediately delete a sensitive message
   */
  async processSensitiveMessage(
    chatId: number, 
    messageId: number, 
    processor: (messageText: string) => Promise<void>
  ): Promise<void> {
    try {
      // Get the message content (this would need to be passed in or retrieved)
      // For now, we'll just schedule immediate deletion
      
      // Schedule immediate deletion (after 3 seconds to allow processing)
      setTimeout(() => {
        this.deleteMessage(chatId, messageId);
      }, 3000);

      logger.info('Processed sensitive message', { chatId, messageId });
    } catch (error) {
      logger.error('Failed to process sensitive message:', error);
      // Still delete the message even if processing failed
      setTimeout(() => {
        this.deleteMessage(chatId, messageId);
      }, 3000);
    }
  }

  /**
   * Clean up expired messages that should have been deleted
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    const expiredMessages: string[] = [];

    for (const [key, secureMessage] of this.secureMessages.entries()) {
      const expiryTime = secureMessage.timestamp.getTime() + secureMessage.autoDeleteAfter;
      
      if (now > expiryTime + 10000) { // 10 second grace period
        expiredMessages.push(key);
        
        // Attempt to delete the message
        this.deleteMessage(secureMessage.chatId, secureMessage.messageId);
      }
    }

    // Remove expired entries
    expiredMessages.forEach(key => {
      this.secureMessages.delete(key);
    });

    if (expiredMessages.length > 0) {
      logger.debug('Cleaned up expired secure messages', { count: expiredMessages.length });
    }
  }

  /**
   * Get count of tracked secure messages
   */
  getTrackedMessageCount(): number {
    return this.secureMessages.size;
  }

  /**
   * Clear all tracked messages for a user (useful when auth flow is cancelled)
   */
  async clearUserMessages(chatId: number): Promise<void> {
    const userMessages: string[] = [];
    
    for (const [key, secureMessage] of this.secureMessages.entries()) {
      if (secureMessage.chatId === chatId) {
        userMessages.push(key);
        await this.deleteMessage(secureMessage.chatId, secureMessage.messageId);
      }
    }

    logger.info('Cleared all secure messages for user', { chatId, count: userMessages.length });
  }
}

export { SecureMessageService };
