/**
 * Natural Language Service for Telegram Bot
 * Revolutionary integration with the Natural Language Orchestrator
 * Enables conversational AI that understands ANY user input
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface NaturalLanguageRequest {
  user_input: string;
  user_context?: {
    user_id?: number;
    username?: string;
    chat_id?: number;
    user_profile?: any;
    preferences?: any;
    active_accounts?: any[];
    current_session?: any;
  };
  conversation_history?: string[];
}

export interface NaturalLanguageResponse {
  success: boolean;
  user_intent?: {
    intent_id: string;
    category: string;
    complexity: string;
    primary_action: string;
    secondary_actions: string[];
    parameters: Record<string, any>;
    confidence_score: number;
    natural_language_query: string;
    suggested_response: string;
    function_calls: Array<{
      function: string;
      parameters: Record<string, any>;
    }>;
    requires_confirmation: boolean;
    estimated_execution_time: number;
  };
  execution_plan?: {
    plan_id: string;
    execution_steps: Array<{
      step_id: string;
      function: string;
      parameters: Record<string, any>;
      telegram_command?: string;
      backend_endpoint?: string;
      estimated_time: number;
      ai_enhanced: boolean;
      description: string;
    }>;
    estimated_duration: number;
    risk_assessment: Record<string, any>;
    user_guidance: string;
    confirmation_required: boolean;
  };
  execution_result?: {
    execution_id: string;
    success: boolean;
    success_rate: number;
    total_steps: number;
    successful_steps: number;
    failed_steps: number;
    execution_time: number;
    step_results: any[];
  };
  natural_response: string;
  processing_time: number;
  orchestrator_metadata?: {
    intent_confidence: number;
    complexity_level: string;
    functions_involved: number;
    ai_enhanced: boolean;
  };
  requires_confirmation?: boolean;
  confirmation_message?: string;
  error?: string;
}

export interface OrchestratorStatus {
  orchestrator_status: string;
  active_executions: number;
  total_functions: number;
  execution_history_count: number;
  intent_categories: number;
  ai_enhanced_functions: number;
  conversation_contexts: number;
  capabilities: {
    natural_language_understanding: boolean;
    multi_step_execution: boolean;
    ai_enhanced_functions: boolean;
    conversation_memory: boolean;
    intelligent_routing: boolean;
    enterprise_orchestration: boolean;
  };
}

export class NaturalLanguageService {
  private client: AxiosInstance;
  private logger: typeof logger;
  private baseUrl: string;
  private conversationHistory: Map<number, string[]> = new Map();
  private userContexts: Map<number, any> = new Map();

  constructor(baseUrl: string = process.env.BACKEND_URL || 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.logger = logger;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 seconds for complex orchestrations
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TelegramBot-NaturalLanguage/1.0'
      }
    });

    // Add request/response interceptors
    this.client.interceptors.request.use(
      (config) => {
        this.logger.info('Natural Language Request', { 
          url: config.url, 
          method: config.method,
          userInput: config.data?.user_input?.substring(0, 100) + '...' || 'none'
        });
        return config;
      },
      (error) => {
        this.logger.error('Natural Language Request Error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.info('Natural Language Response', { 
          status: response.status,
          success: response.data?.success,
          processingTime: response.data?.processing_time
        });
        return response;
      },
      (error) => {
        this.logger.error('Natural Language Response Error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Process natural language input and orchestrate platform functions
   * This is the revolutionary method that makes the bot truly conversational
   */
  async processNaturalLanguage(
    userId: number,
    userInput: string,
    userProfile?: any
  ): Promise<NaturalLanguageResponse> {
    try {
      // Get conversation history for this user
      const conversationHistory = this.conversationHistory.get(userId) || [];
      
      // Get user context
      const userContext = this.buildUserContext(userId, userProfile);
      
      // Prepare request
      const request: NaturalLanguageRequest = {
        user_input: userInput,
        user_context: userContext,
        conversation_history: conversationHistory.slice(-10) // Last 10 messages
      };

      // Call the Production Natural Language Service
      const response = await this.client.post('/api/natural-language/process', request);
      const result = response.data as NaturalLanguageResponse;

      // Update conversation history
      this.updateConversationHistory(userId, userInput, result.natural_response);

      // Update user context if needed
      if (result.user_intent) {
        this.updateUserContext(userId, result.user_intent);
      }

      return result;

    } catch (error) {
      this.logger.error('Natural language processing failed', error);
      
      // Return fallback response
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        natural_response: "I apologize, but I'm having trouble understanding your request right now. Could you please try rephrasing it or use a specific command like /help to see what I can do?",
        processing_time: 0
      };
    }
  }

  /**
   * Get orchestrator status and capabilities
   */
  async getOrchestratorStatus(): Promise<OrchestratorStatus | null> {
    try {
      const response = await this.client.get('/api/natural-language/status');
      return response.data as OrchestratorStatus;
    } catch (error) {
      this.logger.error('Failed to get orchestrator status', error);
      return null;
    }
  }

  /**
   * Check if the natural language service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const status = await this.getOrchestratorStatus();
      return status?.orchestrator_status === 'operational';
    } catch (error) {
      this.logger.warn('Natural language service availability check failed', error);
      return false;
    }
  }

  /**
   * Build comprehensive user context for better understanding
   */
  private buildUserContext(userId: number, userProfile?: any): any {
    const existingContext = this.userContexts.get(userId) || {};
    
    return {
      user_id: userId,
      username: userProfile?.username,
      chat_id: userId, // For Telegram, user_id and chat_id are the same in private chats
      user_profile: userProfile,
      preferences: existingContext.preferences || {},
      active_accounts: existingContext.active_accounts || [],
      current_session: {
        start_time: existingContext.session_start || new Date().toISOString(),
        message_count: (existingContext.message_count || 0) + 1,
        last_activity: new Date().toISOString()
      },
      platform_usage: {
        total_commands_used: existingContext.total_commands || 0,
        favorite_features: existingContext.favorite_features || [],
        automation_level: existingContext.automation_level || 'beginner'
      }
    };
  }

  /**
   * Update conversation history for context awareness
   */
  private updateConversationHistory(userId: number, userInput: string, botResponse: string): void {
    const history = this.conversationHistory.get(userId) || [];
    
    // Add user input and bot response
    history.push(`User: ${userInput}`);
    history.push(`Bot: ${botResponse}`);
    
    // Keep only last 20 messages (10 exchanges)
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    
    this.conversationHistory.set(userId, history);
  }

  /**
   * Update user context based on interactions
   */
  private updateUserContext(userId: number, userIntent: any): void {
    const context = this.userContexts.get(userId) || {};
    
    // Update usage statistics
    context.total_commands = (context.total_commands || 0) + 1;
    context.last_intent_category = userIntent.category;
    context.last_complexity = userIntent.complexity;
    
    // Track favorite features
    if (!context.favorite_features) {
      context.favorite_features = [];
    }
    
    const primaryAction = userIntent.primary_action;
    if (primaryAction && !context.favorite_features.includes(primaryAction)) {
      context.favorite_features.push(primaryAction);
      
      // Keep only top 10 favorite features
      if (context.favorite_features.length > 10) {
        context.favorite_features.splice(0, 1);
      }
    }
    
    // Update automation level based on usage
    if (userIntent.category === 'automation_control') {
      context.automation_level = 'advanced';
    } else if (userIntent.complexity === 'enterprise') {
      context.automation_level = 'expert';
    }
    
    this.userContexts.set(userId, context);
  }

  /**
   * Clear conversation history for a user
   */
  clearConversationHistory(userId: number): void {
    this.conversationHistory.delete(userId);
    this.logger.info(`Cleared conversation history for user ${userId}`);
  }

  /**
   * Get conversation history for a user
   */
  getConversationHistory(userId: number): string[] {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Get user context
   */
  getUserContext(userId: number): any {
    return this.userContexts.get(userId) || {};
  }
}

// Singleton instance
export const naturalLanguageService = new NaturalLanguageService();
