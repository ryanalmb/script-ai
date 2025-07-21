/**
 * Enterprise Campaign Management Service - Core Campaign Service
 * Comprehensive campaign management with automation, scheduling, and enterprise features
 */

import { PrismaClient } from '@prisma/client';
import { campaignConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { eventService } from './eventService';
import { databaseService } from './database';
import {
  Campaign,
  CampaignStatus,
  CampaignStatusEnum,
  CampaignType,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignMetrics,
  CampaignEventType
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

class CampaignService {
  private get prisma(): PrismaClient {
    return databaseService.getClient();
  }

  constructor() {
    log.info('Campaign service initialized', {
      operation: 'campaign_service_init',
      metadata: {
        maxCampaignsPerUser: campaignConfig.maxCampaignsPerUser,
        maxPostsPerCampaign: campaignConfig.maxPostsPerCampaign,
        maxAutomationsPerCampaign: campaignConfig.maxAutomationsPerCampaign
      }
    });
  }

  /**
   * Create a new campaign
   */
  async createCampaign(
    userId: string,
    request: CreateCampaignRequest,
    correlationId?: string | undefined
  ): Promise<Campaign> {
    const timer = createTimer('campaign_create');

    try {
      const { name, description, type, accountIds, settings, scheduledStartAt, scheduledEndAt, budget, targeting } = request;

      log.campaign('Creating new campaign', '', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'campaign_create',
        metadata: { name, type, accountCount: accountIds.length }
      });

      // Check campaign limit
      const existingCampaigns = await this.prisma.campaign.count({
        where: { 
          userId,
          status: { not: CampaignStatusEnum.CANCELLED }
        }
      });

      if (existingCampaigns >= campaignConfig.maxCampaignsPerUser) {
        throw new Error(`User has reached maximum campaign limit of ${campaignConfig.maxCampaignsPerUser}`);
      }

      // Validate account ownership
      const userAccounts = await this.prisma.xAccount.findMany({
        where: { 
          userId,
          id: { in: accountIds },
          isActive: true
        }
      });

      if (userAccounts.length !== accountIds.length) {
        throw new Error('One or more accounts are not accessible or inactive');
      }

      // Create campaign settings object
      const campaignSettings = JSON.parse(JSON.stringify({
        ...settings,
        accountIds,
        budget: budget || null,
        targeting: targeting || null,
        createdBy: userId,
        version: '1.0'
      }));

      // Create campaign
      const campaign = await this.prisma.campaign.create({
        data: {
          id: uuidv4(),
          userId,
          name,
          description: description || null,
          type,
          status: CampaignStatusEnum.DRAFT,
          startDate: scheduledStartAt || null,
          endDate: scheduledEndAt || null,
          settings: campaignSettings
        }
      });

      const duration = timer.end();

      // Publish campaign created event
      await eventService.publishCampaignEvent(
        CampaignEventType.CAMPAIGN_CREATED,
        userId,
        campaign.id,
        {
          name,
          type,
          accountIds,
          settings: campaignSettings
        },
        correlationId
      );

      log.audit('Campaign created successfully', {
        correlationId: correlationId || undefined,
        userId,
        campaignId: campaign.id,
        action: 'campaign_create',
        resource: 'campaign',
        duration,
        metadata: { name, type, accountCount: accountIds.length }
      });

      return campaign;

    } catch (error) {
      timer.end();
      log.error('Failed to create campaign', {
        operation: 'campaign_create',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error,
        metadata: { name: request.name, type: request.type }
      });
      throw error;
    }
  }

  /**
   * Update an existing campaign
   */
  async updateCampaign(
    campaignId: string,
    userId: string,
    updates: UpdateCampaignRequest,
    correlationId?: string | undefined
  ): Promise<Campaign> {
    const timer = createTimer('campaign_update');

    try {
      log.campaign('Updating campaign', campaignId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'campaign_update',
        metadata: { updates }
      });

      // Get existing campaign
      const existingCampaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId }
      });

      if (!existingCampaign) {
        throw new Error('Campaign not found or access denied');
      }

      // Prepare update data
      const updateData: any = {};
      
      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }
      
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      
      if (updates.scheduledStartAt !== undefined) {
        updateData.startDate = updates.scheduledStartAt;
      }
      
      if (updates.scheduledEndAt !== undefined) {
        updateData.endDate = updates.scheduledEndAt;
      }

      // Merge settings if provided
      if (updates.settings || updates.budget || updates.targeting) {
        const currentSettings = existingCampaign.settings as any;
        const newSettings = {
          ...currentSettings,
          ...(updates.settings || {}),
          budget: updates.budget ? { ...currentSettings.budget, ...updates.budget } : currentSettings.budget,
          targeting: updates.targeting ? { ...currentSettings.targeting, ...updates.targeting } : currentSettings.targeting,
          updatedBy: userId,
          updatedAt: new Date().toISOString()
        };
        updateData.settings = newSettings;
      }

      // Update campaign
      const updatedCampaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: updateData
      });

      const duration = timer.end();

      // Publish campaign updated event
      await eventService.publishCampaignEvent(
        CampaignEventType.CAMPAIGN_UPDATED,
        userId,
        campaignId,
        { updates },
        correlationId
      );

      log.audit('Campaign updated successfully', {
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        action: 'campaign_update',
        resource: 'campaign',
        duration,
        metadata: { updates }
      });

      return updatedCampaign;

    } catch (error) {
      timer.end();
      log.error('Failed to update campaign', {
        operation: 'campaign_update',
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get user's campaigns
   */
  async getUserCampaigns(
    userId: string,
    filters?: {
      status?: CampaignStatus | undefined;
      type?: CampaignType | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    } | undefined,
    correlationId?: string | undefined
  ): Promise<{ campaigns: Campaign[]; total: number }> {
    const timer = createTimer('get_user_campaigns');

    try {
      log.debug('Getting user campaigns', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'get_user_campaigns',
        metadata: { filters }
      });

      const where: any = { userId };
      
      if (filters?.status) {
        where.status = filters.status;
      }
      
      if (filters?.type) {
        where.type = filters.type;
      }

      const [campaigns, total] = await Promise.all([
        this.prisma.campaign.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: filters?.limit || 50,
          skip: filters?.offset || 0
        }),
        this.prisma.campaign.count({ where })
      ]);

      timer.end();

      return { campaigns, total };

    } catch (error) {
      timer.end();
      log.error('Failed to get user campaigns', {
        operation: 'get_user_campaigns',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(
    campaignId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<Campaign | null> {
    const timer = createTimer('get_campaign');

    try {
      log.debug('Getting campaign', {
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        operation: 'get_campaign'
      });

      const campaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId }
      });

      timer.end();

      return campaign;

    } catch (error) {
      timer.end();
      log.error('Failed to get campaign', {
        operation: 'get_campaign',
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Start a campaign
   */
  async startCampaign(
    campaignId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<Campaign> {
    const timer = createTimer('campaign_start');

    try {
      log.campaign('Starting campaign', campaignId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'campaign_start'
      });

      // Get campaign
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId }
      });

      if (!campaign) {
        throw new Error('Campaign not found or access denied');
      }

      if (campaign.status !== CampaignStatusEnum.DRAFT && campaign.status !== CampaignStatusEnum.PAUSED) {
        throw new Error(`Cannot start campaign with status: ${campaign.status}`);
      }

      // Validate campaign settings
      await this.validateCampaignSettings(campaign);

      // Update campaign status
      const updatedCampaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: CampaignStatusEnum.ACTIVE,
          startDate: campaign.startDate || new Date()
        }
      });

      const duration = timer.end();

      // Publish campaign started event
      await eventService.publishCampaignEvent(
        CampaignEventType.CAMPAIGN_STARTED,
        userId,
        campaignId,
        { 
          previousStatus: campaign.status,
          startedAt: new Date()
        },
        correlationId
      );

      log.audit('Campaign started successfully', {
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        action: 'campaign_start',
        resource: 'campaign',
        duration,
        metadata: { previousStatus: campaign.status }
      });

      return updatedCampaign;

    } catch (error) {
      timer.end();
      log.error('Failed to start campaign', {
        operation: 'campaign_start',
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(
    campaignId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<Campaign> {
    const timer = createTimer('campaign_pause');

    try {
      log.campaign('Pausing campaign', campaignId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'campaign_pause'
      });

      // Get campaign
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId }
      });

      if (!campaign) {
        throw new Error('Campaign not found or access denied');
      }

      if (campaign.status !== CampaignStatusEnum.ACTIVE) {
        throw new Error(`Cannot pause campaign with status: ${campaign.status}`);
      }

      // Update campaign status
      const updatedCampaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatusEnum.PAUSED }
      });

      const duration = timer.end();

      // Publish campaign paused event
      await eventService.publishCampaignEvent(
        CampaignEventType.CAMPAIGN_PAUSED,
        userId,
        campaignId,
        { 
          previousStatus: campaign.status,
          pausedAt: new Date()
        },
        correlationId
      );

      log.audit('Campaign paused successfully', {
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        action: 'campaign_pause',
        resource: 'campaign',
        duration,
        metadata: { previousStatus: campaign.status }
      });

      return updatedCampaign;

    } catch (error) {
      timer.end();
      log.error('Failed to pause campaign', {
        operation: 'campaign_pause',
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Stop a campaign
   */
  async stopCampaign(
    campaignId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<Campaign> {
    const timer = createTimer('campaign_stop');

    try {
      log.campaign('Stopping campaign', campaignId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'campaign_stop'
      });

      // Get campaign
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId }
      });

      if (!campaign) {
        throw new Error('Campaign not found or access denied');
      }

      if (campaign.status === CampaignStatusEnum.COMPLETED || campaign.status === CampaignStatusEnum.CANCELLED) {
        throw new Error(`Campaign is already ${campaign.status.toLowerCase()}`);
      }

      // Update campaign status
      const updatedCampaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: CampaignStatusEnum.COMPLETED,
          endDate: new Date()
        }
      });

      const duration = timer.end();

      // Publish campaign stopped event
      await eventService.publishCampaignEvent(
        CampaignEventType.CAMPAIGN_STOPPED,
        userId,
        campaignId,
        { 
          previousStatus: campaign.status,
          stoppedAt: new Date()
        },
        correlationId
      );

      log.audit('Campaign stopped successfully', {
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        action: 'campaign_stop',
        resource: 'campaign',
        duration,
        metadata: { previousStatus: campaign.status }
      });

      return updatedCampaign;

    } catch (error) {
      timer.end();
      log.error('Failed to stop campaign', {
        operation: 'campaign_stop',
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(
    campaignId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<void> {
    const timer = createTimer('campaign_delete');

    try {
      log.campaign('Deleting campaign', campaignId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'campaign_delete'
      });

      // Get campaign
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId }
      });

      if (!campaign) {
        throw new Error('Campaign not found or access denied');
      }

      // Delete campaign and related data
      await databaseService.transaction(async (prisma) => {
        // Delete related posts
        await prisma.post.deleteMany({
          where: { campaignId }
        });

        // Delete related automations
        await prisma.automation.deleteMany({
          where: { campaignId }
        });

        // Delete campaign
        await prisma.campaign.delete({
          where: { id: campaignId }
        });
      }, 'campaign_delete_transaction');

      const duration = timer.end();

      // Publish campaign deleted event
      await eventService.publishCampaignEvent(
        CampaignEventType.CAMPAIGN_DELETED,
        userId,
        campaignId,
        { 
          name: campaign.name,
          type: campaign.type,
          deletedAt: new Date()
        },
        correlationId
      );

      log.audit('Campaign deleted successfully', {
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        action: 'campaign_delete',
        resource: 'campaign',
        duration,
        metadata: { name: campaign.name, type: campaign.type }
      });

    } catch (error) {
      timer.end();
      log.error('Failed to delete campaign', {
        operation: 'campaign_delete',
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get campaign metrics
   */
  async getCampaignMetrics(
    campaignId: string,
    userId: string,
    startDate?: Date | undefined,
    endDate?: Date | undefined,
    correlationId?: string | undefined
  ): Promise<CampaignMetrics> {
    const timer = createTimer('get_campaign_metrics');

    try {
      log.debug('Getting campaign metrics', {
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        operation: 'get_campaign_metrics',
        metadata: { startDate, endDate }
      });

      // Get campaign
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: campaignId, userId }
      });

      if (!campaign) {
        throw new Error('Campaign not found or access denied');
      }

      const periodStart = startDate || campaign.startDate || campaign.createdAt;
      const periodEnd = endDate || campaign.endDate || new Date();

      // Get post metrics
      const posts = await this.prisma.post.findMany({
        where: {
          campaignId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd
          }
        }
      });

      // Calculate performance metrics
      const performance = {
        postsCreated: posts.length,
        postsPublished: posts.filter(p => p.status === 'PUBLISHED').length,
        postsScheduled: posts.filter(p => p.status === 'SCHEDULED').length,
        postsFailed: posts.filter(p => p.status === 'FAILED').length,
        likesGiven: 0, // Would be calculated from engagement data
        retweetsMade: 0,
        followsExecuted: 0,
        repliesSent: 0
      };

      // Mock engagement metrics (would be calculated from real data)
      const engagement = {
        totalImpressions: 0,
        totalReach: 0,
        totalEngagements: 0,
        engagementRate: 0,
        clickThroughRate: 0,
        conversionRate: 0
      };

      // Mock cost metrics (would be calculated from real data)
      const costs = {
        totalSpent: 0,
        costPerPost: 0,
        costPerEngagement: 0,
        costPerClick: 0,
        costPerConversion: 0,
        remainingBudget: 0
      };

      // Mock audience metrics (would be calculated from real data)
      const audience = {
        newFollowers: 0,
        lostFollowers: 0,
        profileViews: 0,
        mentionsReceived: 0,
        directMessages: 0
      };

      // Mock error metrics (would be calculated from real data)
      const errors = {
        apiErrors: 0,
        rateLimitHits: 0,
        contentRejections: 0,
        accountSuspensions: 0
      };

      const metrics: CampaignMetrics = {
        campaignId,
        period: {
          startDate: periodStart,
          endDate: periodEnd
        },
        performance,
        engagement,
        costs,
        audience,
        errors
      };

      timer.end();

      return metrics;

    } catch (error) {
      timer.end();
      log.error('Failed to get campaign metrics', {
        operation: 'get_campaign_metrics',
        correlationId: correlationId || undefined,
        userId,
        campaignId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Validate campaign settings
   */
  private async validateCampaignSettings(campaign: Campaign): Promise<void> {
    const settings = campaign.settings as any;

    // Validate account access
    if (settings.accountIds && settings.accountIds.length > 0) {
      const activeAccounts = await this.prisma.xAccount.count({
        where: {
          id: { in: settings.accountIds },
          userId: campaign.userId,
          isActive: true
        }
      });

      if (activeAccounts !== settings.accountIds.length) {
        throw new Error('One or more accounts are inactive or inaccessible');
      }
    }

    // Validate content generation settings
    if (settings.contentGeneration?.enabled) {
      if (!settings.contentGeneration.topics || settings.contentGeneration.topics.length === 0) {
        throw new Error('Content generation requires at least one topic');
      }
    }

    // Validate scheduling settings
    if (settings.scheduling) {
      const { workingHours, frequency } = settings.scheduling;

      if (workingHours) {
        const startTime = new Date(`1970-01-01T${workingHours.start}:00`);
        const endTime = new Date(`1970-01-01T${workingHours.end}:00`);

        if (startTime >= endTime) {
          throw new Error('Working hours start time must be before end time');
        }
      }

      if (frequency) {
        const totalActions = frequency.postsPerDay + frequency.likesPerDay +
                           frequency.retweetsPerDay + frequency.followsPerDay +
                           frequency.repliesPerDay;

        if (totalActions > 1000) { // Safety limit
          throw new Error('Total daily actions exceed safety limit of 1000');
        }
      }
    }

    // Validate budget settings
    if (settings.budget) {
      const { totalBudget, dailyBudget } = settings.budget;

      if (totalBudget && dailyBudget && dailyBudget > totalBudget) {
        throw new Error('Daily budget cannot exceed total budget');
      }
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(
    userId: string,
    correlationId?: string | undefined
  ): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    pausedCampaigns: number;
    completedCampaigns: number;
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
  }> {
    const timer = createTimer('get_campaign_stats');

    try {
      log.debug('Getting campaign statistics', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'get_campaign_stats'
      });

      const [
        totalCampaigns,
        activeCampaigns,
        pausedCampaigns,
        completedCampaigns,
        totalPosts,
        publishedPosts,
        scheduledPosts
      ] = await Promise.all([
        this.prisma.campaign.count({ where: { userId } }),
        this.prisma.campaign.count({ where: { userId, status: CampaignStatusEnum.ACTIVE } }),
        this.prisma.campaign.count({ where: { userId, status: CampaignStatusEnum.PAUSED } }),
        this.prisma.campaign.count({ where: { userId, status: CampaignStatusEnum.COMPLETED } }),
        this.prisma.post.count({
          where: {
            campaign: { userId }
          }
        }),
        this.prisma.post.count({
          where: {
            campaign: { userId },
            status: 'PUBLISHED'
          }
        }),
        this.prisma.post.count({
          where: {
            campaign: { userId },
            status: 'SCHEDULED'
          }
        })
      ]);

      timer.end();

      return {
        totalCampaigns,
        activeCampaigns,
        pausedCampaigns,
        completedCampaigns,
        totalPosts,
        publishedPosts,
        scheduledPosts
      };

    } catch (error) {
      timer.end();
      log.error('Failed to get campaign statistics', {
        operation: 'get_campaign_stats',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }
}

// Create and export singleton instance
export const campaignService = new CampaignService();

// Export the class for testing
export { CampaignService };
