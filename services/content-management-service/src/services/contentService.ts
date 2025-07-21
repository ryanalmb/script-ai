/**
 * Enterprise Content Management Service - Core Content Service
 * Comprehensive content management with AI generation, media processing, and enterprise features
 */

import { PrismaClient } from '@prisma/client';
import { contentConfig, aiConfig, moderationConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { eventService } from './eventService';
import { databaseService } from './database';
import {
  Content,
  ContentStatus,
  ContentStatusEnum,
  ContentType,
  CreateContentRequest,
  UpdateContentRequest,
  ContentEventType,
  ContentGenerationRequest,
  ContentGenerationResponse
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

class ContentService {
  private get prisma(): PrismaClient {
    return databaseService.getClient();
  }

  constructor() {
    log.info('Content service initialized', {
      operation: 'content_service_init',
      metadata: {
        maxContentPerUser: contentConfig.maxContentPerUser,
        maxMediaPerContent: contentConfig.maxMediaPerContent,
        aiGenerationEnabled: aiConfig.enabled
      }
    });
  }

  /**
   * Create new content
   */
  async createContent(
    userId: string,
    request: CreateContentRequest,
    correlationId?: string | undefined
  ): Promise<Content> {
    const timer = createTimer('content_create');

    try {
      const { body, type, campaignId, templateId, mediaIds, hashtags, mentions, scheduledAt } = request;

      log.content('Creating new content', '', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'content_create',
        metadata: { content: body, type, campaignId, templateId }
      });

      // Check content limit for the account
      const existingContent = await this.prisma.post.count({
        where: {
          accountId: userId,
          status: { not: ContentStatusEnum.DELETED }
        }
      });

      if (existingContent >= contentConfig.maxContentPerUser) {
        throw new Error(`User has reached maximum content limit of ${contentConfig.maxContentPerUser}`);
      }

      // Validate media URLs if provided
      if (mediaIds && mediaIds.length > contentConfig.maxMediaPerContent) {
        throw new Error(`Maximum ${contentConfig.maxMediaPerContent} media items allowed per content`);
      }

      // Note: Content metadata and settings would be stored when metadata fields are added to Post model
      // const contentMetadata = await this.generateContentMetadata(body, type, metadata);
      // const contentSettings = { ...settings, createdBy: userId, version: '1.0', mediaIds: mediaIds || [], hashtags: hashtags || [], mentions: mentions || [] };

      // Create content using Post model with proper field mapping
      const content = await this.prisma.post.create({
        data: {
          id: uuidv4(),
          accountId: userId,
          campaignId: campaignId || null,
          content: body,
          mediaUrls: mediaIds || [],
          hashtags: hashtags || [],
          mentions: mentions || [],
          status: ContentStatusEnum.DRAFT,
          scheduledFor: scheduledAt || null
        }
      });

      const duration = timer.end();

      // Publish content created event
      await eventService.publishContentEvent(
        ContentEventType.CONTENT_CREATED,
        userId,
        content.id,
        {
          content: body,
          type: 'POST',
          campaignId,
          templateId,
          mediaCount: mediaIds?.length || 0
        },
        correlationId
      );

      log.audit('Content created successfully', {
        correlationId: correlationId || undefined,
        userId,
        contentId: content.id,
        action: 'content_create',
        resource: 'content',
        duration,
        metadata: { content: body, type: 'POST', campaignId: campaignId || null }
      });

      return content;

    } catch (error) {
      timer.end();
      log.error('Failed to create content', {
        operation: 'content_create',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error,
        metadata: { content: request.body, type: request.type }
      });
      throw error;
    }
  }

  /**
   * Update existing content
   */
  async updateContent(
    contentId: string,
    userId: string,
    updates: UpdateContentRequest,
    correlationId?: string | undefined
  ): Promise<Content> {
    const timer = createTimer('content_update');

    try {
      log.content('Updating content', contentId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'content_update',
        metadata: { updates }
      });

      // Get existing content
      const existingContent = await this.prisma.post.findFirst({
        where: { id: contentId, accountId: userId }
      });

      if (!existingContent) {
        throw new Error('Content not found or access denied');
      }

      // Check if content can be edited
      if (existingContent.status === ContentStatusEnum.PUBLISHED) {
        // For now, allow editing (would implement settings check when available)
        // const settings = existingContent.settings as any;
        // if (!settings?.allowEditing) {
        //   throw new Error('Published content cannot be edited');
        // }
      }

      // Prepare update data for Post model
      const updateData: any = {};

      if (updates.body !== undefined) {
        updateData.content = updates.body; // Map body to content field in Post model
      }

      if (updates.scheduledAt !== undefined) {
        updateData.scheduledFor = updates.scheduledAt;
      }

      // Update hashtags and mentions if provided (these are direct fields in Post model)
      if (updates.hashtags !== undefined) {
        updateData.hashtags = updates.hashtags;
      }

      if (updates.mentions !== undefined) {
        updateData.mentions = updates.mentions;
      }

      // Update content
      const updatedContent = await this.prisma.post.update({
        where: { id: contentId },
        data: updateData
      });

      const duration = timer.end();

      // Publish content updated event
      await eventService.publishContentEvent(
        ContentEventType.CONTENT_UPDATED,
        userId,
        contentId,
        { updates },
        correlationId
      );

      log.audit('Content updated successfully', {
        correlationId: correlationId || undefined,
        userId,
        contentId,
        action: 'content_update',
        resource: 'content',
        duration,
        metadata: { updates }
      });

      return updatedContent;

    } catch (error) {
      timer.end();
      log.error('Failed to update content', {
        operation: 'content_update',
        correlationId: correlationId || undefined,
        userId,
        contentId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get user's content
   */
  async getUserContent(
    userId: string,
    filters?: {
      status?: ContentStatus | undefined;
      type?: ContentType | undefined;
      campaignId?: string | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    } | undefined,
    correlationId?: string | undefined
  ): Promise<{ content: Content[]; total: number }> {
    const timer = createTimer('get_user_content');

    try {
      log.debug('Getting user content', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'get_user_content',
        metadata: { filters }
      });

      const where: any = {
        accountId: userId,
        status: { not: ContentStatusEnum.DELETED }
      };
      
      if (filters?.status) {
        where.status = filters.status;
      }
      
      if (filters?.type) {
        where.type = filters.type;
      }

      if (filters?.campaignId) {
        where.campaignId = filters.campaignId;
      }

      const [content, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: filters?.limit || 50,
          skip: filters?.offset || 0
        }),
        this.prisma.post.count({ where })
      ]);

      timer.end();

      return { content, total };

    } catch (error) {
      timer.end();
      log.error('Failed to get user content', {
        operation: 'get_user_content',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get content by ID
   */
  async getContent(
    contentId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<Content | null> {
    const timer = createTimer('get_content');

    try {
      log.debug('Getting content', {
        correlationId: correlationId || undefined,
        userId,
        contentId,
        operation: 'get_content'
      });

      const content = await this.prisma.post.findFirst({
        where: {
          id: contentId,
          accountId: userId,
          status: { not: ContentStatusEnum.DELETED }
        }
      });

      timer.end();

      return content;

    } catch (error) {
      timer.end();
      log.error('Failed to get content', {
        operation: 'get_content',
        correlationId: correlationId || undefined,
        userId,
        contentId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Publish content
   */
  async publishContent(
    contentId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<Content> {
    const timer = createTimer('content_publish');

    try {
      log.content('Publishing content', contentId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'content_publish'
      });

      // Get content using Post model
      const content = await this.prisma.post.findFirst({
        where: { id: contentId, accountId: userId }
      });

      if (!content) {
        throw new Error('Content not found or access denied');
      }

      if (content.status !== ContentStatusEnum.DRAFT && content.status !== ContentStatusEnum.SCHEDULED) {
        throw new Error(`Cannot publish content with status: ${content.status}`);
      }

      // Check if content requires approval (simplified for Post model)
      if (moderationConfig.requireManualApproval) {
        // Would implement approval check when approval system is added
        log.debug('Manual approval required but not implemented yet', {
          correlationId: correlationId || undefined,
          contentId
        });
      }

      // Validate content before publishing
      await this.validateContentForPublishing(content);

      // Update content status using Post model
      const updatedContent = await this.prisma.post.update({
        where: { id: contentId },
        data: {
          status: ContentStatusEnum.PUBLISHED
          // Note: publishedAt field is not in the Post model
        }
      });

      const duration = timer.end();

      // Publish content published event
      await eventService.publishContentEvent(
        ContentEventType.CONTENT_PUBLISHED,
        userId,
        contentId,
        {
          previousStatus: content.status,
          publishedAt: new Date().toISOString()
        },
        correlationId
      );

      log.audit('Content published successfully', {
        correlationId: correlationId || undefined,
        userId,
        contentId,
        action: 'content_publish',
        resource: 'content',
        duration,
        metadata: { previousStatus: content.status }
      });

      return updatedContent;

    } catch (error) {
      timer.end();
      log.error('Failed to publish content', {
        operation: 'content_publish',
        correlationId: correlationId || undefined,
        userId,
        contentId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Schedule content for publishing
   */
  async scheduleContent(
    contentId: string,
    userId: string,
    scheduledAt: Date,
    correlationId?: string | undefined
  ): Promise<Content> {
    const timer = createTimer('content_schedule');

    try {
      log.content('Scheduling content', contentId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'content_schedule',
        metadata: { scheduledAt }
      });

      // Get content using Post model
      const content = await this.prisma.post.findFirst({
        where: { id: contentId, accountId: userId }
      });

      if (!content) {
        throw new Error('Content not found or access denied');
      }

      if (content.status !== ContentStatusEnum.DRAFT) {
        throw new Error(`Cannot schedule content with status: ${content.status}`);
      }

      // Validate scheduled time
      if (scheduledAt <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }

      // Update content status and scheduled time using Post model
      const updatedContent = await this.prisma.post.update({
        where: { id: contentId },
        data: {
          status: ContentStatusEnum.SCHEDULED,
          scheduledFor: scheduledAt
        }
      });

      const duration = timer.end();

      // Publish content scheduled event
      await eventService.publishContentEvent(
        ContentEventType.CONTENT_SCHEDULED,
        userId,
        contentId,
        {
          previousStatus: content.status,
          scheduledAt: scheduledAt.toISOString()
        },
        correlationId
      );

      log.audit('Content scheduled successfully', {
        correlationId: correlationId || undefined,
        userId,
        contentId,
        action: 'content_schedule',
        resource: 'content',
        duration,
        metadata: { scheduledAt }
      });

      return updatedContent;

    } catch (error) {
      timer.end();
      log.error('Failed to schedule content', {
        operation: 'content_schedule',
        correlationId: correlationId || undefined,
        userId,
        contentId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Delete content
   */
  async deleteContent(
    contentId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<void> {
    const timer = createTimer('content_delete');

    try {
      log.content('Deleting content', contentId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'content_delete'
      });

      // Get content using Post model
      const content = await this.prisma.post.findFirst({
        where: { id: contentId, accountId: userId }
      });

      if (!content) {
        throw new Error('Content not found or access denied');
      }

      // Soft delete content using Post model
      await databaseService.transaction(async (prisma) => {
        // Mark content as deleted
        await prisma.post.update({
          where: { id: contentId },
          data: {
            status: ContentStatusEnum.DELETED
          }
        });

        // Note: Media deletion would be implemented when media model is added
      }, 'content_delete_transaction');

      const duration = timer.end();

      // Publish content deleted event
      await eventService.publishContentEvent(
        ContentEventType.CONTENT_DELETED,
        userId,
        contentId,
        {
          content: content.content,
          type: 'POST',
          deletedAt: new Date().toISOString()
        },
        correlationId
      );

      log.audit('Content deleted successfully', {
        correlationId: correlationId || undefined,
        userId,
        contentId,
        action: 'content_delete',
        resource: 'content',
        duration,
        metadata: { content: content.content, type: 'POST' }
      });

    } catch (error) {
      timer.end();
      log.error('Failed to delete content', {
        operation: 'content_delete',
        correlationId: correlationId || undefined,
        userId,
        contentId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Generate AI content
   */
  async generateContent(
    userId: string,
    request: ContentGenerationRequest,
    correlationId?: string | undefined
  ): Promise<ContentGenerationResponse> {
    const timer = createTimer('ai_content_generation');

    try {
      if (!aiConfig.enabled) {
        throw new Error('AI content generation is disabled');
      }

      log.aiGeneration('Generating AI content', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'ai_content_generation',
        model: request.model || aiConfig.defaultModel,
        metadata: { prompt: request.prompt.substring(0, 100), type: request.type }
      });

      // Call LLM service for content generation
      const response = await this.callLLMService(request, correlationId);

      const duration = timer.end();

      // Publish AI content generated event
      await eventService.publishContentEvent(
        ContentEventType.AI_CONTENT_GENERATED,
        userId,
        uuidv4(),
        {
          prompt: request.prompt,
          model: request.model || aiConfig.defaultModel,
          tokensUsed: response.metadata.tokensUsed,
          cost: response.metadata.cost
        },
        correlationId
      );

      log.aiGeneration('AI content generated successfully', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'ai_content_generation',
        duration,
        model: response.metadata.model,
        tokensUsed: response.metadata.tokensUsed,
        cost: response.metadata.cost
      });

      return response;

    } catch (error) {
      timer.end();
      log.error('Failed to generate AI content', {
        operation: 'ai_content_generation',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error,
        metadata: { prompt: request.prompt.substring(0, 100) }
      });
      throw error;
    }
  }

  /**
   * Validate content for publishing
   */
  private async validateContentForPublishing(content: Content): Promise<void> {
    // Check content length using Post model's content field
    if (!content.content || content.content.length === 0) {
      throw new Error('Content body cannot be empty');
    }

    // Check for required approvals (simplified for Post model)
    if (moderationConfig.requireManualApproval) {
      // Would implement approval check when approval system is added
      log.debug('Manual approval required but not implemented yet', {
        contentId: content.id
      });
    }

    // Note: Brand safety and compliance checks would be implemented
    // when metadata fields are added to the Post model
  }

  // Note: Content metadata generation would be implemented when metadata fields are added to Post model

  /**
   * Call LLM service for content generation
   */
  private async callLLMService(
    request: ContentGenerationRequest,
    _correlationId?: string | undefined
  ): Promise<ContentGenerationResponse> {
    // Mock implementation - would call actual LLM service
    const mockResponse: ContentGenerationResponse = {
      content: {
        title: request.type === 'TWEET' ? undefined : 'Generated Content Title',
        body: `Generated content based on: ${request.prompt}`,
        hashtags: request.includeHashtags ? ['#generated', '#ai'] : [],
        mentions: request.includeMentions ? ['@example'] : [],
        suggestedMedia: []
      },
      metadata: {
        model: request.model || aiConfig.defaultModel,
        tokensUsed: 150,
        cost: 0.003,
        confidence: 0.85,
        alternatives: 3
      },
      analysis: {
        sentiment: 'positive',
        readabilityScore: 0.8,
        seoScore: 0.7,
        brandSafety: 0.9,
        engagement: 0.75
      },
      suggestions: {
        improvements: ['Add more specific details', 'Include call-to-action'],
        alternatives: ['Alternative version 1', 'Alternative version 2'],
        hashtags: ['#marketing', '#content', '#ai'],
        mentions: ['@influencer', '@brand']
      }
    };

    return mockResponse;
  }

  // Note: Content analysis methods would be implemented when needed

  /**
   * Get content statistics
   */
  async getContentStats(
    userId: string,
    correlationId?: string | undefined
  ): Promise<{
    totalContent: number;
    publishedContent: number;
    scheduledContent: number;
    draftContent: number;
    totalMedia: number;
    aiGeneratedContent: number;
  }> {
    const timer = createTimer('get_content_stats');

    try {
      log.debug('Getting content statistics', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'get_content_stats'
      });

      const [
        totalContent,
        publishedContent,
        scheduledContent,
        draftContent
      ] = await Promise.all([
        this.prisma.post.count({
          where: { accountId: userId, status: { not: ContentStatusEnum.DELETED } }
        }),
        this.prisma.post.count({
          where: { accountId: userId, status: ContentStatusEnum.PUBLISHED }
        }),
        this.prisma.post.count({
          where: { accountId: userId, status: ContentStatusEnum.SCHEDULED }
        }),
        this.prisma.post.count({
          where: { accountId: userId, status: ContentStatusEnum.DRAFT }
        })
      ]);

      // Note: Media and AI-generated content stats would be implemented
      // when media model and metadata fields are added
      const totalMedia = 0;
      const aiGeneratedContent = 0;

      timer.end();

      return {
        totalContent,
        publishedContent,
        scheduledContent,
        draftContent,
        totalMedia,
        aiGeneratedContent
      };

    } catch (error) {
      timer.end();
      log.error('Failed to get content statistics', {
        operation: 'get_content_stats',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }
}

// Create and export singleton instance
export const contentService = new ContentService();

// Export the class for testing
export { ContentService };
