/**
 * Enterprise Data Service for Advanced Telegram Bot
 * Handles all database operations for enterprise features, campaigns, content, and analytics
 */

import { logger } from '../utils/logger';

export interface UserPreferences {
  preferred_platform?: string;
  target_audience?: any;
  budget?: number;
  tone?: string;
  content_types?: string[];
  complexity_preference?: string;
}

export interface UserAnalytics {
  campaigns_created: number;
  content_generated: number;
  avg_quality_score: number;
  total_processing_time: number;
  preferred_complexity: string;
  most_used_features: string[];
  success_rate: number;
}

export class EnterpriseDataService {
  private backendUrl: string;

  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  }

  /**
   * Get user preferences from backend
   */
  async getUserPreferences(userId: number): Promise<UserPreferences | null> {
    try {
      const response = await fetch(`${this.backendUrl}/api/users/${userId}/preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        }
      });

      if (response.ok) {
        interface PreferencesResponse {
          preferences?: Record<string, any>;
        }

        const data = await response.json() as PreferencesResponse;
        return data.preferences || {};
      } else {
        logger.warn('Failed to get user preferences', { userId, status: response.status });
        return this.getDefaultPreferences();
      }
    } catch (error) {
      logger.error('Error getting user preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return this.getDefaultPreferences();
    }
  }

  /**
   * Save campaign to backend database
   */
  async saveCampaign(userId: number, campaignData: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        },
        body: JSON.stringify({
          user_id: userId,
          campaign_id: campaignData.campaign_id,
          title: campaignData.campaign_plan?.objective || 'Enterprise Campaign',
          description: campaignData.user_prompt,
          status: 'active',
          complexity_level: campaignData.complexity_level,
          quality_score: campaignData.orchestration_metadata?.quality_score,
          processing_time: campaignData.orchestration_metadata?.processing_time,
          deep_think_enabled: campaignData.orchestration_metadata?.deep_think_enabled,
          multimodal_assets: campaignData.orchestration_metadata?.multimodal_assets_generated,
          platforms_covered: campaignData.orchestration_metadata?.platforms_covered,
          content_pieces: campaignData.content_pieces?.length || 0,
          multimodal_content: campaignData.multimodal_content_suite?.length || 0,
          strategic_analysis: campaignData.strategic_analysis,
          competitive_intelligence: campaignData.competitive_intelligence,
          campaign_plan: campaignData.campaign_plan,
          optimization_framework: campaignData.optimization_framework,
          monitoring_setup: campaignData.monitoring_setup,
          compliance_report: campaignData.compliance_report,
          created_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        logger.info('Campaign saved successfully', { 
          userId, 
          campaignId: campaignData.campaign_id,
          complexity: campaignData.complexity_level
        });
        return true;
      } else {
        logger.error('Failed to save campaign', { 
          userId, 
          campaignId: campaignData.campaign_id,
          status: response.status 
        });
        return false;
      }
    } catch (error) {
      logger.error('Error saving campaign', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        campaignId: campaignData.campaign_id
      });
      return false;
    }
  }

  /**
   * Save generated content to backend
   */
  async saveGeneratedContent(userId: number, contentData: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        },
        body: JSON.stringify({
          user_id: userId,
          content: contentData.content,
          model_used: contentData.model,
          quality_score: contentData.quality_score,
          confidence_score: contentData.confidence_score,
          response_time: contentData.response_time,
          deep_think_steps: contentData.deep_think_steps?.length || 0,
          reasoning_trace: contentData.reasoning_trace?.length || 0,
          multimodal_outputs: contentData.multimodal_outputs?.length || 0,
          task_type: 'enterprise_generation',
          complexity: 'enterprise',
          created_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        logger.info('Content saved successfully', { 
          userId, 
          model: contentData.model,
          qualityScore: contentData.quality_score
        });
        return true;
      } else {
        logger.error('Failed to save content', { 
          userId, 
          status: response.status 
        });
        return false;
      }
    } catch (error) {
      logger.error('Error saving content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return false;
    }
  }

  /**
   * Save content optimization analysis
   */
  async saveOptimizationAnalysis(userId: number, originalContent: string, analysisData: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/analytics/optimization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        },
        body: JSON.stringify({
          user_id: userId,
          original_content: originalContent,
          optimized_content: analysisData.content,
          quality_score: analysisData.quality_score,
          confidence_score: analysisData.confidence_score,
          model_used: analysisData.model,
          reasoning_trace: analysisData.reasoning_trace,
          analysis_type: 'content_optimization',
          created_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        logger.info('Optimization analysis saved', { 
          userId, 
          qualityScore: analysisData.quality_score
        });
        return true;
      } else {
        logger.error('Failed to save optimization analysis', { 
          userId, 
          status: response.status 
        });
        return false;
      }
    } catch (error) {
      logger.error('Error saving optimization analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return false;
    }
  }

  /**
   * Get user analytics from backend
   */
  async getUserAnalytics(userId: number): Promise<UserAnalytics | null> {
    try {
      const response = await fetch(`${this.backendUrl}/api/analytics/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        }
      });

      if (response.ok) {
        interface AnalyticsResponse {
          campaigns_created?: number;
          content_generated?: number;
          avg_quality_score?: number;
          total_processing_time?: number;
          preferred_complexity?: string;
          most_used_features?: string[];
          success_rate?: number;
        }

        const data = await response.json() as AnalyticsResponse;
        return {
          campaigns_created: data.campaigns_created || 0,
          content_generated: data.content_generated || 0,
          avg_quality_score: data.avg_quality_score || 0,
          total_processing_time: data.total_processing_time || 0,
          preferred_complexity: data.preferred_complexity || 'moderate',
          most_used_features: data.most_used_features || ['content_generation'],
          success_rate: data.success_rate || 0
        };
      } else {
        logger.warn('Failed to get user analytics', { userId, status: response.status });
        return null;
      }
    } catch (error) {
      logger.error('Error getting user analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return null;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: number, preferences: Partial<UserPreferences>): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        },
        body: JSON.stringify({ preferences })
      });

      if (response.ok) {
        logger.info('User preferences updated', { userId });
        return true;
      } else {
        logger.error('Failed to update user preferences', { userId, status: response.status });
        return false;
      }
    } catch (error) {
      logger.error('Error updating user preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return false;
    }
  }

  /**
   * Get campaign details by ID
   */
  async getCampaignDetails(userId: number, campaignId: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.backendUrl}/api/campaigns/${campaignId}?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        }
      });

      if (response.ok) {
        interface CampaignResponse {
          campaign?: any;
        }

        const data = await response.json() as CampaignResponse;
        return data.campaign;
      } else {
        logger.warn('Campaign not found', { userId, campaignId, status: response.status });
        return null;
      }
    } catch (error) {
      logger.error('Error getting campaign details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        campaignId
      });
      return null;
    }
  }

  /**
   * Log user activity for analytics
   */
  async logUserActivity(userId: number, activity: string, metadata: any = {}): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/analytics/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
        },
        body: JSON.stringify({
          user_id: userId,
          activity,
          metadata,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        return true;
      } else {
        logger.warn('Failed to log user activity', { userId, activity, status: response.status });
        return false;
      }
    } catch (error) {
      logger.error('Error logging user activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        activity
      });
      return false;
    }
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      preferred_platform: 'twitter',
      target_audience: {
        age: '25-45',
        interests: ['technology', 'business', 'marketing'],
        demographics: 'professionals'
      },
      budget: 10000,
      tone: 'professional',
      content_types: ['text', 'image'],
      complexity_preference: 'moderate'
    };
  }
}
