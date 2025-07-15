/**
 * Enterprise Gemini Integration Service for Telegram Bot
 * Provides seamless integration with the Gemini LLM service
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

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
    totalTokenCount?: number;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  response_time: number;
  quality_score: number;
  function_calls?: any[];
  confidence_score?: number;
  reasoning_trace?: string[];
  deep_think_steps?: any[];
  multimodal_outputs?: any[];
}

export interface CampaignOrchestrationRequest {
  prompt: string;
  complexity?: string;
  context?: {
    user_id?: number;
    platform?: string;
    preferences?: any;
    budget?: number;
    timeline?: string;
    target_market?: string;
    objectives?: string[];
  };
}

export interface CampaignOrchestrationResponse {
  campaign_id: string;
  user_prompt: string;
  complexity_level?: string;
  market_analysis?: any;
  strategic_analysis?: any;
  competitive_intelligence?: any;
  campaign_plan: {
    campaign_id: string;
    objective: string;
    target_audience: any;
    content_strategy: any;
    hashtag_strategy: string[];
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

  constructor() {
    this.baseUrl = process.env.LLM_SERVICE_URL || 'http://localhost:3003';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000, // 2 minutes for complex orchestrations
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'X-Marketing-Platform-Bot/1.0'
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Gemini API Request', {
          url: config.url,
          method: config.method,
          data: config.data ? JSON.stringify(config.data).substring(0, 200) : undefined
        });
        return config;
      },
      (error) => {
        logger.error('Gemini API Request Error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Gemini API Response', {
          status: response.status,
          url: response.config.url,
          responseTime: response.headers['x-response-time']
        });
        return response;
      },
      (error) => {
        logger.error('Gemini API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data
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
      logger.warn('Gemini service not available', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate content using Enterprise Gemini 2.5 API with intelligent routing
   */
  async generateContent(request: GeminiRequest): Promise<GeminiResponse | null> {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        logger.error('Gemini service not available for content generation');
        return null;
      }
    }

    try {
      // Use enterprise endpoint with intelligent model routing
      const enterpriseRequest = {
        prompt: request.prompt,
        task_type: request.task_type || 'content_generation',
        complexity: request.complexity || 'moderate',
        multimodal_types: request.multimodal_types || ['text'],
        performance_priority: request.performance_priority || 'balanced',
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000
      };

      const response: AxiosResponse<GeminiResponse> = await this.client.post('/api/gemini/enterprise/generate', enterpriseRequest);

      logger.info('Enterprise content generated successfully', {
        model: response.data.model,
        contentLength: response.data.content.length,
        responseTime: response.data.response_time,
        qualityScore: response.data.quality_score,
        confidenceScore: response.data.confidence_score,
        hasReasoningTrace: !!response.data.reasoning_trace,
        hasDeepThinkSteps: !!response.data.deep_think_steps
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to generate content with Enterprise Gemini', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: request.prompt.substring(0, 100)
      });

      // Fallback to legacy endpoint if enterprise fails
      try {
        const response: AxiosResponse<GeminiResponse> = await this.client.post('/api/gemini/generate', request);
        logger.warn('Used legacy Gemini endpoint as fallback');
        return response.data;
      } catch (fallbackError) {
        logger.error('Both enterprise and legacy endpoints failed', {
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        });
        return null;
      }
    }
  }

  /**
   * Orchestrate a complete marketing campaign using Enterprise Gemini 2.5 with Deep Think
   */
  async orchestrateCampaign(request: CampaignOrchestrationRequest): Promise<CampaignOrchestrationResponse | null> {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        logger.error('Gemini service not available for campaign orchestration');
        return null;
      }
    }

    try {
      logger.info('Starting enterprise campaign orchestration', {
        prompt: request.prompt.substring(0, 100),
        userId: request.context?.user_id
      });

      // Use enterprise orchestration endpoint with multimodal capabilities
      const enterpriseRequest = {
        prompt: request.prompt,
        complexity: request.complexity || 'enterprise',
        context: {
          user_id: request.context?.user_id,
          platform: request.context?.platform || 'multi_platform',
          preferences: request.context?.preferences || {},
          budget: request.context?.budget,
          timeline: request.context?.timeline,
          target_market: request.context?.target_market
        }
      };

      const response: AxiosResponse<CampaignOrchestrationResponse> = await this.client.post(
        '/api/gemini/enterprise/orchestrate',
        enterpriseRequest
      );

      logger.info('Enterprise campaign orchestrated successfully', {
        campaignId: response.data.campaign_id,
        complexityLevel: response.data.complexity_level,
        processingTime: response.data.orchestration_metadata.processing_time,
        multimodalContentPieces: response.data.multimodal_content_suite?.length || 0,
        platformsCovered: response.data.orchestration_metadata.platforms_covered,
        qualityScore: response.data.orchestration_metadata.quality_score,
        complexityScore: response.data.orchestration_metadata.complexity_score,
        innovationScore: response.data.orchestration_metadata.innovation_score,
        deepThinkEnabled: response.data.orchestration_metadata.deep_think_enabled
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to orchestrate campaign with Enterprise Gemini', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: request.prompt.substring(0, 100)
      });

      // Fallback to legacy orchestration if enterprise fails
      try {
        const response: AxiosResponse<CampaignOrchestrationResponse> = await this.client.post(
          '/api/gemini/orchestrate',
          request
        );
        logger.warn('Used legacy orchestration endpoint as fallback');
        return response.data;
      } catch (fallbackError) {
        logger.error('Both enterprise and legacy orchestration failed', {
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        });
        return null;
      }
    }
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
   * Get campaign details by ID
   */
  async getCampaignDetails(campaignId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/api/gemini/campaigns/${campaignId}`);
      return response.data;
    } catch (error) {
      if ((error as any).response?.status === 404) {
        logger.warn('Campaign not found', { campaignId });
        return null;
      }
      logger.error('Failed to get campaign details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignId
      });
      return null;
    }
  }

  /**
   * Generate marketing content with specific parameters
   */
  async generateMarketingContent(params: {
    topic: string;
    platform: string;
    tone: string;
    targetAudience: string;
    contentType: string;
    includeHashtags?: boolean;
    maxLength?: number;
  }): Promise<GeminiResponse | null> {
    const prompt = `Create a ${params.tone} ${params.contentType} for ${params.platform} about ${params.topic}.

Target Audience: ${params.targetAudience}
Platform: ${params.platform}
Tone: ${params.tone}
Content Type: ${params.contentType}
${params.includeHashtags ? 'Include relevant hashtags' : 'No hashtags needed'}
${params.maxLength ? `Maximum length: ${params.maxLength} characters` : ''}

Requirements:
- Engaging and platform-optimized
- Aligned with target audience interests
- Professional quality
- Action-oriented with clear value proposition
${params.includeHashtags ? '- Include 3-5 relevant hashtags' : ''}

Generate the content now:`;

    return this.generateContent({
      prompt,
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      max_tokens: params.maxLength || 1000
    });
  }

  /**
   * Analyze content performance and suggest improvements (legacy method)
   */
  async analyzeAndOptimizeContentLegacy(content: string, platform: string): Promise<GeminiResponse | null> {
    const prompt = `Analyze this ${platform} content and provide optimization suggestions:

Content: "${content}"
Platform: ${platform}

Please analyze:
1. Engagement potential (1-10 score)
2. Platform optimization level
3. Call-to-action effectiveness
4. Hashtag strategy (if applicable)
5. Target audience alignment

Provide specific suggestions for improvement and an optimized version of the content.`;

    return this.generateContent({
      prompt,
      model: 'gemini-1.5-pro',
      temperature: 0.3,
      max_tokens: 1500
    });
  }

  /**
   * Generate content series for a campaign
   */
  async generateContentSeries(params: {
    campaignTheme: string;
    numberOfPosts: number;
    platform: string;
    tone: string;
    targetAudience: string;
  }): Promise<GeminiResponse | null> {
    const prompt = `Create a series of ${params.numberOfPosts} ${params.platform} posts for a marketing campaign.

Campaign Theme: ${params.campaignTheme}
Platform: ${params.platform}
Tone: ${params.tone}
Target Audience: ${params.targetAudience}
Number of Posts: ${params.numberOfPosts}

Requirements:
- Each post should be unique but cohesive with the campaign theme
- Platform-optimized content length and format
- Progressive narrative that builds engagement over time
- Include relevant hashtags for each post
- Vary content types (educational, promotional, engaging questions, etc.)
- Clear call-to-actions where appropriate

Format the response as a numbered list with each post clearly separated.`;

    return this.generateContent({
      prompt,
      model: 'gemini-2.0-flash-exp',
      temperature: 0.8,
      max_tokens: 3000
    });
  }

  /**
   * Check if Gemini service is available
   */
  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Refresh service availability status
   */
  async refreshAvailability(): Promise<boolean> {
    await this.checkAvailability();
    return this.isAvailable;
  }

  /**
   * Get service health information
   */
  async getHealthInfo(): Promise<any> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('Failed to get health info', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get comprehensive enterprise service status and analytics
   */
  async getEnterpriseStatus(): Promise<any> {
    try {
      const response = await this.client.get('/api/gemini/enterprise/status');
      return response.data;
    } catch (error) {
      logger.error('Failed to get enterprise status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get detailed enterprise analytics and insights
   */
  async getEnterpriseAnalytics(): Promise<any> {
    try {
      const response = await this.client.get('/api/gemini/enterprise/analytics');
      return response.data;
    } catch (error) {
      logger.error('Failed to get enterprise analytics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Generate enterprise-grade multimodal content with Deep Think reasoning
   */
  async generateEnterpriseContent(params: {
    prompt: string;
    taskType: 'content_generation' | 'strategic_planning' | 'competitive_analysis' | 'multimodal_creation';
    complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    multimodalTypes?: string[];
    performancePriority?: 'speed' | 'quality' | 'cost' | 'balanced';
    deepThinkEnabled?: boolean;
    context?: any;
  }): Promise<GeminiResponse | null> {
    try {
      const enterpriseRequest = {
        prompt: params.prompt,
        task_type: params.taskType,
        complexity: params.complexity,
        multimodal_types: params.multimodalTypes || ['text'],
        performance_priority: params.performancePriority || 'balanced',
        deep_think_enabled: params.deepThinkEnabled || (params.complexity === 'enterprise'),
        context: params.context
      };

      const response: AxiosResponse<GeminiResponse> = await this.client.post(
        '/api/gemini/enterprise/generate',
        enterpriseRequest
      );

      logger.info('Enterprise content generated with advanced features', {
        taskType: params.taskType,
        complexity: params.complexity,
        model: response.data.model,
        qualityScore: response.data.quality_score,
        confidenceScore: response.data.confidence_score,
        deepThinkSteps: response.data.deep_think_steps?.length || 0,
        reasoningTrace: response.data.reasoning_trace?.length || 0
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to generate enterprise content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        taskType: params.taskType,
        complexity: params.complexity
      });
      return null;
    }
  }

  /**
   * Create comprehensive multimodal marketing campaign with enterprise features
   */
  async createEnterpriseMultimodalCampaign(params: {
    objective: string;
    targetAudience: any;
    budget?: number;
    timeline?: string;
    platforms: string[];
    contentTypes: string[];
    complexity?: 'simple' | 'moderate' | 'complex' | 'enterprise';
    enableDeepThink?: boolean;
    context?: any;
  }): Promise<CampaignOrchestrationResponse | null> {
    try {
      const campaignPrompt = `Create a comprehensive multimodal marketing campaign with the following specifications:

Objective: ${params.objective}
Target Audience: ${JSON.stringify(params.targetAudience)}
Budget: ${params.budget ? `$${params.budget}` : 'Flexible'}
Timeline: ${params.timeline || 'Q1 2025'}
Platforms: ${params.platforms.join(', ')}
Content Types: ${params.contentTypes.join(', ')}

Requirements:
- Multimodal content strategy (text, images, video, audio)
- Cross-platform optimization and adaptation
- Performance tracking and optimization framework
- Compliance and brand safety considerations
- Real-time monitoring and adaptation capabilities
- Competitive analysis and market positioning
- ROI optimization and budget allocation strategies`;

      const enterpriseRequest = {
        prompt: campaignPrompt,
        complexity: params.complexity || 'enterprise',
        context: {
          ...params.context,
          objective: params.objective,
          target_audience: params.targetAudience,
          budget: params.budget,
          timeline: params.timeline,
          platforms: params.platforms,
          content_types: params.contentTypes,
          enable_deep_think: params.enableDeepThink !== false
        }
      };

      const response = await this.orchestrateCampaign(enterpriseRequest);

      if (response) {
        logger.info('Enterprise multimodal campaign created successfully', {
          campaignId: response.campaign_id,
          platforms: params.platforms.length,
          contentTypes: params.contentTypes.length,
          complexity: params.complexity,
          deepThinkEnabled: response.orchestration_metadata?.deep_think_enabled
        });
      }

      return response;
    } catch (error) {
      logger.error('Failed to create enterprise multimodal campaign', {
        error: error instanceof Error ? error.message : 'Unknown error',
        objective: params.objective.substring(0, 100)
      });
      return null;
    }
  }

  /**
   * Analyze and optimize existing content using enterprise AI capabilities
   */
  async analyzeAndOptimizeContent(params: {
    content: string;
    platform: string;
    targetAudience?: any;
    objectives?: string[];
    enableDeepThink?: boolean;
  }): Promise<GeminiResponse | null> {
    const analysisPrompt = `Perform comprehensive analysis and optimization of this marketing content:

Content: "${params.content}"
Platform: ${params.platform}
Target Audience: ${JSON.stringify(params.targetAudience || 'General')}
Objectives: ${params.objectives?.join(', ') || 'Engagement and conversion'}

Provide detailed analysis including:
1. Content quality assessment (1-10 score)
2. Platform optimization level and recommendations
3. Engagement potential analysis
4. Target audience alignment score
5. Call-to-action effectiveness
6. Hashtag and mention strategy optimization
7. Viral potential assessment
8. Brand safety and compliance check
9. Performance prediction and optimization suggestions
10. A/B testing recommendations

Generate an optimized version of the content with explanations for all changes.`;

    return this.generateEnterpriseContent({
      prompt: analysisPrompt,
      taskType: 'competitive_analysis',
      complexity: 'complex',
      multimodalTypes: ['text'],
      performancePriority: 'quality',
      deepThinkEnabled: params.enableDeepThink !== false,
      context: {
        original_content: params.content,
        platform: params.platform,
        target_audience: params.targetAudience,
        objectives: params.objectives
      }
    });
  }
}
