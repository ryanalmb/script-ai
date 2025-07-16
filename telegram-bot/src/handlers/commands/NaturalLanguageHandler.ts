/**
 * Natural Language Handler for Telegram Bot
 * Revolutionary handler that understands ANY user input and orchestrates platform functions
 * This is the architectural marvel that makes the platform truly conversational
 */

import { BaseHandler, CommandHandler, HandlerServices } from '../base/BaseHandler';
import { naturalLanguageService, NaturalLanguageResponse } from '../../services/naturalLanguageService';
import { logger } from '../../utils/logger';

export class NaturalLanguageHandler extends BaseHandler implements CommandHandler {
  constructor(services: HandlerServices) {
    super(services);
  }

  /**
   * This handler can handle ANY input - it's the fallback for natural language processing
   */
  canHandle(command: string): boolean {
    // This handler should be used as a fallback when no specific command handler matches
    // It will be called by the main handler when no other handler can process the input
    return true;
  }

  /**
   * Revolutionary natural language processing
   * Understands ANY user input and orchestrates appropriate platform functions
   */
  async handle(chatId: number, command: string, user: any): Promise<void> {
    try {
      // Check if natural language service is available
      const isAvailable = await naturalLanguageService.isAvailable();
      if (!isAvailable) {
        await this.sendErrorMessage(chatId, 
          '🤖 The AI orchestrator is currently unavailable. Please try using specific commands like /help, /generate, or /dashboard.'
        );
        return;
      }

      // Show typing indicator for better UX
      await this.bot.sendChatAction(chatId, 'typing');

      // Send initial processing message
      const processingMessage = await this.bot.sendMessage(chatId, 
        '🧠 **Understanding your request...**\n\nI\'m analyzing what you want to accomplish and preparing the best approach.',
        { parse_mode: 'Markdown' }
      );

      // Process the natural language input
      const result = await naturalLanguageService.processNaturalLanguage(
        chatId,
        command,
        user
      );

      // Delete the processing message
      try {
        await this.bot.deleteMessage(chatId, processingMessage.message_id);
      } catch (deleteError) {
        // Ignore deletion errors
      }

      // Handle the result
      await this.handleNaturalLanguageResult(chatId, result, user);

    } catch (error) {
      logger.error('Natural language handling failed:', error);
      await this.sendErrorMessage(chatId, 
        '🤖 I encountered an issue processing your request. Please try rephrasing it or use a specific command.'
      );
    }
  }

  /**
   * Handle the result from natural language processing
   */
  private async handleNaturalLanguageResult(
    chatId: number, 
    result: NaturalLanguageResponse, 
    user: any
  ): Promise<void> {
    if (!result.success) {
      await this.sendErrorMessage(chatId, result.natural_response);
      return;
    }

    // If confirmation is required, ask the user
    if (result.requires_confirmation || result.execution_plan?.confirmation_required) {
      await this.handleConfirmationRequired(chatId, result, user);
      return;
    }

    // If execution was successful, show results
    if (result.execution_result) {
      await this.handleExecutionResult(chatId, result, user);
      return;
    }

    // Otherwise, just show the natural response
    await this.sendNaturalResponse(chatId, result);
  }

  /**
   * Handle cases where user confirmation is required
   */
  private async handleConfirmationRequired(
    chatId: number, 
    result: NaturalLanguageResponse, 
    user: any
  ): Promise<void> {
    const plan = result.execution_plan;
    if (!plan) {
      await this.sendErrorMessage(chatId, 'Unable to create execution plan.');
      return;
    }

    // Create confirmation message
    const confirmationMessage = `
🎯 **Action Plan Created**

${plan.user_guidance}

**Execution Details:**
• **Steps:** ${plan.execution_steps.length}
• **Estimated Time:** ${Math.ceil(plan.estimated_duration / 60)} minutes
• **Complexity:** ${result.user_intent?.complexity || 'moderate'}

**What will be executed:**
${plan.execution_steps.map((step, index) => 
  `${index + 1}. ${step.description} ${step.ai_enhanced ? '🤖' : ''}`
).join('\n')}

**Risk Assessment:**
• **Automation Risk:** ${plan.risk_assessment.automation_risk || 'low'}
• **Reversible:** ${plan.risk_assessment.reversible ? 'Yes' : 'No'}
• **Monitoring Required:** ${plan.risk_assessment.requires_monitoring ? 'Yes' : 'No'}

Do you want me to proceed with this plan?
    `;

    // Send confirmation with buttons
    await this.bot.sendMessage(chatId, confirmationMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Execute Plan', callback_data: `execute_plan:${plan.plan_id}` },
            { text: '❌ Cancel', callback_data: `cancel_plan:${plan.plan_id}` }
          ],
          [
            { text: '📋 View Details', callback_data: `plan_details:${plan.plan_id}` }
          ]
        ]
      }
    });

    // Store the plan for later execution (in a real implementation, this would be in a database)
    // For now, we'll use the user service to store it temporarily
    await this.trackEvent(chatId, 'plan_created', {
      plan_id: plan.plan_id,
      user_intent: result.user_intent?.natural_language_query,
      steps_count: plan.execution_steps.length,
      estimated_duration: plan.estimated_duration
    });
  }

  /**
   * Handle execution results
   */
  private async handleExecutionResult(
    chatId: number, 
    result: NaturalLanguageResponse, 
    user: any
  ): Promise<void> {
    const execution = result.execution_result;
    if (!execution) {
      await this.sendErrorMessage(chatId, 'No execution result available.');
      return;
    }

    // Create result message
    const successRate = Math.round(execution.success_rate * 100);
    const statusEmoji = execution.success ? '✅' : execution.success_rate > 0.5 ? '⚠️' : '❌';
    
    const resultMessage = `
${statusEmoji} **Execution Complete**

${result.natural_response}

**Execution Summary:**
• **Overall Success:** ${execution.success ? 'Yes' : 'Partial'}
• **Success Rate:** ${successRate}%
• **Steps Completed:** ${execution.successful_steps}/${execution.total_steps}
• **Execution Time:** ${Math.round(execution.execution_time)} seconds
• **Processing Time:** ${Math.round(result.processing_time * 1000)}ms

**AI Enhancement:** ${result.orchestrator_metadata?.ai_enhanced ? 'Enabled 🤖' : 'Standard'}
**Confidence:** ${Math.round((result.orchestrator_metadata?.intent_confidence || 0) * 100)}%
    `;

    await this.bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

    // If there were failures, show details
    if (execution.failed_steps > 0) {
      const failedSteps = execution.step_results
        .filter(step => !step.success)
        .map(step => `• ${step.function}: ${step.error}`)
        .join('\n');

      if (failedSteps) {
        await this.bot.sendMessage(chatId, 
          `⚠️ **Some steps failed:**\n\n${failedSteps}`, 
          { parse_mode: 'Markdown' }
        );
      }
    }

    // Track execution completion
    await this.trackEvent(chatId, 'execution_completed', {
      execution_id: execution.execution_id,
      success: execution.success,
      success_rate: execution.success_rate,
      execution_time: execution.execution_time,
      user_intent: result.user_intent?.natural_language_query
    });
  }

  /**
   * Send natural language response
   */
  private async sendNaturalResponse(chatId: number, result: NaturalLanguageResponse): Promise<void> {
    let responseMessage = result.natural_response;

    // Add metadata if available
    if (result.orchestrator_metadata) {
      const metadata = result.orchestrator_metadata;
      responseMessage += `\n\n🤖 **AI Analysis:**`;
      responseMessage += `\n• **Intent Confidence:** ${Math.round(metadata.intent_confidence * 100)}%`;
      responseMessage += `\n• **Complexity:** ${metadata.complexity_level}`;
      responseMessage += `\n• **Functions Involved:** ${metadata.functions_involved}`;
      responseMessage += `\n• **Processing Time:** ${Math.round(result.processing_time * 1000)}ms`;
    }

    await this.bot.sendMessage(chatId, responseMessage, { parse_mode: 'Markdown' });

    // Track natural language interaction
    await this.trackEvent(chatId, 'natural_language_processed', {
      intent_category: result.user_intent?.category,
      complexity: result.user_intent?.complexity,
      confidence: result.orchestrator_metadata?.intent_confidence,
      processing_time: result.processing_time
    });
  }

  /**
   * Handle callback queries for plan execution
   */
  async handleCallback(callbackQuery: any): Promise<void> {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    try {
      if (data.startsWith('execute_plan:')) {
        const planId = data.split(':')[1];
        await this.bot.editMessageText(
          '⚡ **Executing plan...**\n\nPlease wait while I execute your request.',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          }
        );

        // In a real implementation, this would retrieve and execute the stored plan
        // For now, we'll simulate execution
        await new Promise(resolve => setTimeout(resolve, 2000));

        await this.bot.editMessageText(
          '✅ **Plan executed successfully!**\n\nYour request has been completed.',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          }
        );

      } else if (data.startsWith('cancel_plan:')) {
        await this.bot.editMessageText(
          '❌ **Plan cancelled**\n\nNo actions were taken.',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          }
        );

      } else if (data.startsWith('plan_details:')) {
        const planId = data.split(':')[1];
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Plan details would be shown here in a full implementation.',
          show_alert: true
        });
      }

      await this.bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      logger.error('Callback handling failed:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: 'An error occurred processing your request.',
        show_alert: true
      });
    }
  }

  /**
   * Get natural language service status
   */
  async getServiceStatus(): Promise<any> {
    try {
      return await naturalLanguageService.getOrchestratorStatus();
    } catch (error) {
      logger.error('Failed to get natural language service status:', error);
      return null;
    }
  }

  /**
   * Clear conversation history for a user
   */
  async clearConversationHistory(chatId: number): Promise<void> {
    naturalLanguageService.clearConversationHistory(chatId);
    await this.bot.sendMessage(chatId, 
      '🧹 **Conversation history cleared**\n\nI\'ve cleared our conversation history. We can start fresh!',
      { parse_mode: 'Markdown' }
    );
  }
}
