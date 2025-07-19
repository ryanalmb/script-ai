/**
 * Enterprise Gemini Integration Service for Telegram Bot
 * Provides seamless integration with the Gemini LLM service
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

// Enterprise Infrastructure Imports
import { eventBus } from '../infrastructure/eventBus';
import { metrics } from '../infrastructure/metrics';
import { tracing } from '../infrastructure/tracing';
import { circuitBreakerManager } from '../infrastructure/circuitBreaker';

export interface GeminiRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  context?: any;
  task_type?: string;
  complexity?: string;
  multimodal_types?: string[];
  performance_priority?: string;
  deep_think_enabled?: boolean;
}

export interface GeminiResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata?: {
    processing_time: number;
    quality_score?: number;
    complexity_score?: number;
    innovation_score?: number;
    deep_think_enabled?: boolean;
  };
}

export interface CampaignOrchestrationRequest {
  objective: string;
  target_audience: any;
  budget?: number;
  timeline?: string;
  platforms: string[];
  content_types: string[];
  complexity?: string;
  enable_deep_think?: boolean;
  context?: any;
}

export interface CampaignOrchestrationResponse {
  campaign_id: string;
  strategy: {
    overview: string;
    key_messages: string[];
    content_pillars: string[];
    engagement_tactics: string[];
    success_metrics: string[];
    timeline: any;
    estimated_reach: number;
    expected_engagement_rate: number;
  };
  content_strategy?: any;
  content_pieces?: any[];
  multimodal_content_suite?: any[];
  optimization_plan?: any;
  optimization_framework?: any;
  monitoring_setup?: any;
  compliance_report?: any;
  orchestration_metadata: {
    created_at: string;
    processing_time: number;
    model_used: string;
    function_calls_made?: number;
    quality_score: number;
    complexity_score?: number;
    innovation_score?: number;
    deep_think_enabled?: boolean;
    multimodal_assets_generated?: number;
    platforms_covered?: number;
  };
}

export interface GeminiServiceStatus {
  service_status: string;
  client_stats: {
    metrics: any;
    rate_limits: any;
    model_availability: any;
  };
  orchestrator_stats: {
    active_campaigns: number;
    total_campaigns_created: number;
    metrics: any;
  };
  rate_limiter_stats: any;
  monitoring_data: any;
}

export class GeminiIntegrationService {
  private client: AxiosInstance;
  private baseUrl: string;
  private isAvailable: boolean = false;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private lastRequestTime: Date | null = null;

  constructor() {
    this.baseUrl = process.env.LLM_SERVICE_URL || 'http://llm-service:3003';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Enterprise-Telegram-Bot/1.0.0'
      }
    });

    // Add request/response interceptors for logging and metrics
    this.client.interceptors.request.use(
      (config) => {
        this.requestCount++;
        this.lastRequestTime = new Date();
        
        // Add correlation ID for tracing
        config.headers['X-Correlation-ID'] = this.generateCorrelationId();
        
        logger.debug('Gemini API Request', {
          url: config.url,
          method: config.method,
          correlationId: config.headers['X-Correlation-ID']
        });

        return config;
      },
      (error) => {
        this.errorCount++;
        logger.error('Gemini API request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Gemini API Response', {
          status: response.status,
          correlationId: response.config.headers['X-Correlation-ID']
        });

        return response;
      },
      (error) => {
        this.errorCount++;
        logger.error('Gemini API response error', {
          status: error.response?.status,
          message: error.message,
          correlationId: error.config?.headers['X-Correlation-ID']
        });

        return Promise.reject(error);
      }
    );

    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const response = await this.client.get('/health');
      this.isAvailable = response.status === 200;
      logger.info('Gemini service availability check', { available: this.isAvailable });
    } catch (error) {
      this.isAvailable = false;
      logger.warn('Gemini service not available', { error: (error as Error).message });
    }
  }

  /**
   * Generate content using Enterprise Gemini API
   */
  async generateContent(request: GeminiRequest): Promise<GeminiResponse | null> {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        logger.error('Gemini service not available for content generation');
        return null;
      }
    }

    return tracing.traceLLMCall(
      request.model || 'gemini-pro',
      'content_generation',
      async (span) => {
        try {
          span.setAttributes({
            'llm.model': request.model || 'gemini-pro',
            'llm.task_type': request.task_type || 'content_generation',
            'llm.complexity': request.complexity || 'moderate'
          });

          const response: AxiosResponse<GeminiResponse> = await this.client.post('/api/gemini/generate', request);

          // Record metrics
          metrics.recordLLMRequest(
            request.model || 'gemini-pro',
            'content_generation',
            'success',
            Date.now() - (this.lastRequestTime?.getTime() || Date.now()),
            response.data.usage?.total_tokens || 0
          );

          // Publish event
          await eventBus.publishLLMEvent(
            'llm.content_generated',
            0, // user_id would come from context
            request.model || 'gemini-pro',
            'generate_content',
            {
              prompt_length: request.prompt.length,
              response_length: response.data.content.length,
              tokens_used: response.data.usage?.total_tokens || 0
            }
          );

          return response.data;
        } catch (error) {
          this.errorCount++;
          
          // Record error metrics
          metrics.recordLLMRequest(
            request.model || 'gemini-pro',
            'content_generation',
            'error',
            Date.now() - (this.lastRequestTime?.getTime() || Date.now()),
            0
          );

          logger.error('Content generation failed', {
            error: (error as Error).message,
            model: request.model,
            task_type: request.task_type
          });

          return null;
        }
      }
    );
  }

  /**
   * Orchestrate a complete marketing campaign
   */
  async orchestrateCampaign(request: CampaignOrchestrationRequest): Promise<CampaignOrchestrationResponse | null> {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        logger.error('Gemini service not available for campaign orchestration');
        return null;
      }
    }

    return tracing.traceLLMCall(
      'gemini-2.5-flash',
      'campaign_orchestration',
      async (span) => {
        try {
          span.setAttributes({
            'campaign.complexity': request.complexity || 'enterprise',
            'campaign.platforms': request.platforms.join(','),
            'campaign.content_types': request.content_types.join(',')
          });

          const response: AxiosResponse<CampaignOrchestrationResponse> = await this.client.post('/api/gemini/orchestrate', request);

          // Publish campaign event
          await eventBus.publishSystemEvent(
            'system.campaign',
            'gemini-service',
            {
              campaign_id: response.data.campaign_id,
              platforms: request.platforms,
              content_types: request.content_types,
              complexity: request.complexity
            }
          );

          return response.data;
        } catch (error) {
          logger.error('Campaign orchestration failed', {
            error: (error as Error).message,
            objective: request.objective,
            platforms: request.platforms
          });

          return null;
        }
      }
    );
  }

  /**
   * Get Gemini service status and metrics
   */
  async getServiceStatus(): Promise<GeminiServiceStatus | null> {
    try {
      const response: AxiosResponse<GeminiServiceStatus> = await this.client.get('/api/gemini/status');
      return response.data;
    } catch (error) {
      logger.error('Failed to get Gemini service status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Generate correlation ID for request tracing
   */
  private generateCorrelationId(): string {
    return `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      lastRequestTime: this.lastRequestTime,
      isAvailable: this.isAvailable
    };
  }

  /**
   * Refresh service availability status
   */
  async refreshAvailability(): Promise<boolean> {
    await this.checkAvailability();
    return this.isAvailable;
  }

  /**
   * Generate enterprise content
   */
  async generateEnterpriseContent(request: GeminiRequest): Promise<GeminiResponse | null> {
    return this.generateContent(request);
  }

  /**
   * Get enterprise status
   */
  async getEnterpriseStatus(): Promise<GeminiServiceStatus | null> {
    return this.getServiceStatus();
  }

  /**
   * Get enterprise analytics
   */
  async getEnterpriseAnalytics(): Promise<any> {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      successRate: this.requestCount > 0 ? (this.requestCount - this.errorCount) / this.requestCount : 0,
      lastRequestTime: this.lastRequestTime,
      isAvailable: this.isAvailable
    };
  }

  /**
   * Analyze and optimize content
   */
  async analyzeAndOptimizeContent(content: string, options?: any): Promise<any> {
    const request: GeminiRequest = {
      prompt: `Analyze and optimize the following content: ${content}`,
      task_type: 'content_optimization',
      complexity: options?.complexity || 'moderate',
      context: options
    };

    const response = await this.generateContent(request);
    return response ? {
      optimized_content: response.content,
      analysis: response.metadata,
      suggestions: []
    } : null;
  }

  /**
   * Create enterprise multimodal campaign
   */
  async createEnterpriseMultimodalCampaign(request: any): Promise<CampaignOrchestrationResponse | null> {
    const campaignRequest: CampaignOrchestrationRequest = {
      objective: request.objective || request.prompt,
      target_audience: request.target_audience || {},
      platforms: request.platforms || ['telegram'],
      content_types: request.content_types || ['text'],
      complexity: request.complexity || 'enterprise',
      enable_deep_think: request.enable_deep_think || true,
      context: request.context
    };

    return this.orchestrateCampaign(campaignRequest);
  }
}

// Export singleton instance
export const geminiIntegrationService = new GeminiIntegrationService();
