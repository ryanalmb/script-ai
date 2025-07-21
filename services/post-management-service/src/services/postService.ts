/**
 * Enterprise Post Management Service - Core Post Service
 * Comprehensive post scheduling, publishing, and performance tracking with strict error checking
 */

import { PrismaClient } from '@prisma/client';
import { postConfig, schedulingConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { databaseService } from './database';
import {
  Post,
  PostStatusEnum,
  PostScheduleRequest,
  PostPublishRequest,
  PostPublishResult,
  PostPerformanceMetrics
} from '@/types';

class PostService {
  private get prisma(): PrismaClient {
    return databaseService.getClient();
  }

  constructor() {
    log.info('Post service initialized', {
      operation: 'post_service_init',
      metadata: {
        maxPostsPerUser: postConfig.maxPostsPerUser,
        maxScheduledPosts: postConfig.maxScheduledPosts,
        schedulerInterval: postConfig.schedulerInterval
      }
    });
  }

  /**
   * Schedule a post for publishing
   */
  async schedulePost(
    userId: string,
    request: PostScheduleRequest,
    correlationId?: string | undefined
  ): Promise<Post> {
    const timer = createTimer('post_schedule');

    try {
      const { postId, scheduledFor, timezone, retryAttempts, priority } = request;

      log.scheduling('Scheduling post for publishing', {
        correlationId: correlationId || undefined,
        userId,
        postId,
        operation: 'post_schedule',
        scheduledFor,
        priority,
        metadata: { timezone, retryAttempts }
      });

      // Get the post to schedule
      const post = await this.prisma.post.findFirst({
        where: { 
          id: postId,
          accountId: userId // Using accountId field from Post model
        }
      });

      if (!post) {
        throw new Error('Post not found or access denied');
      }

      if (post.status !== PostStatusEnum.DRAFT) {
        throw new Error(`Cannot schedule post with status: ${post.status}`);
      }

      // Validate scheduled time
      if (scheduledFor <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }

      // Check scheduling limits
      const scheduledCount = await this.prisma.post.count({
        where: {
          accountId: userId,
          status: PostStatusEnum.SCHEDULED
        }
      });

      if (scheduledCount >= postConfig.maxScheduledPosts) {
        throw new Error(`Maximum ${postConfig.maxScheduledPosts} scheduled posts allowed`);
      }

      // Validate scheduling rules (check minimum interval)
      const recentPosts = await this.prisma.post.findMany({
        where: {
          accountId: userId,
          status: { in: [PostStatusEnum.SCHEDULED, PostStatusEnum.PUBLISHED] },
          scheduledFor: {
            gte: new Date(scheduledFor.getTime() - schedulingConfig.minPostInterval),
            lte: new Date(scheduledFor.getTime() + schedulingConfig.minPostInterval)
          }
        }
      });

      if (recentPosts.length > 0) {
        throw new Error(`Posts must be at least ${schedulingConfig.minPostInterval / 60000} minutes apart`);
      }

      // Update post with scheduling information
      const updatedPost = await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatusEnum.SCHEDULED,
          scheduledFor: scheduledFor
        }
      });

      const duration = timer.end();

      log.audit('Post scheduled successfully', {
        correlationId: correlationId || undefined,
        userId,
        postId,
        action: 'post_schedule',
        resource: 'post',
        duration,
        metadata: { scheduledFor, priority: priority || 'normal' }
      });

      return updatedPost;

    } catch (error) {
      timer.end();
      log.error('Failed to schedule post', {
        operation: 'post_schedule',
        correlationId: correlationId || undefined,
        userId,
        postId: request.postId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Publish a post immediately or from queue
   */
  async publishPost(
    userId: string,
    request: PostPublishRequest,
    correlationId?: string | undefined
  ): Promise<PostPublishResult> {
    const timer = createTimer('post_publish');

    try {
      const { postId, accountId, immediatePublish, overrideSchedule } = request;

      log.publishing('Publishing post', {
        correlationId: correlationId || undefined,
        userId,
        postId,
        accountId,
        operation: 'post_publish',
        metadata: { immediatePublish, overrideSchedule }
      });

      // Get the post to publish
      const post = await this.prisma.post.findFirst({
        where: { 
          id: postId,
          accountId: userId
        }
      });

      if (!post) {
        throw new Error('Post not found or access denied');
      }

      // Validate post status
      const validStatuses: string[] = [PostStatusEnum.DRAFT, PostStatusEnum.SCHEDULED];
      if (!validStatuses.includes(post.status)) {
        throw new Error(`Cannot publish post with status: ${post.status}`);
      }

      // Check if post is scheduled for future and not overriding
      if (post.status === PostStatusEnum.SCHEDULED && 
          post.scheduledFor && 
          post.scheduledFor > new Date() && 
          !overrideSchedule && 
          !immediatePublish) {
        throw new Error('Post is scheduled for future. Use overrideSchedule=true to publish now');
      }

      // Get account information for publishing
      const account = await this.prisma.account.findUnique({
        where: { id: accountId }
      });

      if (!account) {
        throw new Error('Account not found');
      }

      if (!account.isActive) {
        throw new Error('Account is not active');
      }

      // Simulate publishing to Twitter (would integrate with actual Twitter API)
      const publishResult = await this.simulateTwitterPublish(post, account);

      if (!publishResult.success) {
        // Update post status to failed
        await this.prisma.post.update({
          where: { id: postId },
          data: { 
            status: PostStatusEnum.FAILED
          }
        });

        const duration = timer.end();
        
        log.error('Post publishing failed', {
          operation: 'post_publish',
          correlationId: correlationId || undefined,
          userId,
          postId,
          accountId,
          error: new Error(publishResult.error || 'Unknown publishing error'),
          duration
        });

        return publishResult;
      }

      // Update post status to published
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatusEnum.PUBLISHED
        }
      });

      const duration = timer.end();

      log.audit('Post published successfully', {
        correlationId: correlationId || undefined,
        userId,
        postId,
        accountId,
        action: 'post_publish',
        resource: 'post',
        duration,
        metadata: { 
          platformPostId: publishResult.platformPostId,
          publishedAt: publishResult.publishedAt
        }
      });

      return {
        ...publishResult,
        metrics: {
          processingTime: duration,
          retryCount: 0,
          queueWaitTime: 0
        }
      };

    } catch (error) {
      timer.end();
      log.error('Failed to publish post', {
        operation: 'post_publish',
        correlationId: correlationId || undefined,
        userId,
        postId: request.postId,
        accountId: request.accountId,
        error: error as Error
      });
      
      return {
        success: false,
        postId: request.postId,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get posts scheduled for publishing
   */
  async getScheduledPosts(
    userId: string,
    filters?: {
      accountId?: string | undefined;
      campaignId?: string | undefined;
      fromDate?: Date | undefined;
      toDate?: Date | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    } | undefined,
    correlationId?: string | undefined
  ): Promise<{ posts: Post[]; total: number }> {
    const timer = createTimer('get_scheduled_posts');

    try {
      log.debug('Getting scheduled posts', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'get_scheduled_posts',
        metadata: { filters }
      });

      const where: any = {
        accountId: userId,
        status: PostStatusEnum.SCHEDULED
      };

      if (filters?.accountId) {
        where.accountId = filters.accountId;
      }

      if (filters?.campaignId) {
        where.campaignId = filters.campaignId;
      }

      if (filters?.fromDate || filters?.toDate) {
        where.scheduledFor = {};
        if (filters.fromDate) {
          where.scheduledFor.gte = filters.fromDate;
        }
        if (filters.toDate) {
          where.scheduledFor.lte = filters.toDate;
        }
      }

      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          orderBy: { scheduledFor: 'asc' },
          take: filters?.limit || 50,
          skip: filters?.offset || 0
        }),
        this.prisma.post.count({ where })
      ]);

      timer.end();

      return { posts, total };

    } catch (error) {
      timer.end();
      log.error('Failed to get scheduled posts', {
        operation: 'get_scheduled_posts',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Cancel a scheduled post
   */
  async cancelScheduledPost(
    postId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<Post> {
    const timer = createTimer('cancel_scheduled_post');

    try {
      log.post('Cancelling scheduled post', postId, {
        correlationId: correlationId || undefined,
        userId,
        operation: 'cancel_scheduled_post'
      });

      // Get the post
      const post = await this.prisma.post.findFirst({
        where: { 
          id: postId,
          accountId: userId
        }
      });

      if (!post) {
        throw new Error('Post not found or access denied');
      }

      if (post.status !== PostStatusEnum.SCHEDULED) {
        throw new Error(`Cannot cancel post with status: ${post.status}`);
      }

      // Update post status back to draft
      const updatedPost = await this.prisma.post.update({
        where: { id: postId },
        data: { 
          status: PostStatusEnum.DRAFT,
          scheduledFor: null
        }
      });

      const duration = timer.end();

      log.audit('Scheduled post cancelled successfully', {
        correlationId: correlationId || undefined,
        userId,
        postId,
        action: 'cancel_scheduled_post',
        resource: 'post',
        duration
      });

      return updatedPost;

    } catch (error) {
      timer.end();
      log.error('Failed to cancel scheduled post', {
        operation: 'cancel_scheduled_post',
        correlationId: correlationId || undefined,
        userId,
        postId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get post performance metrics
   */
  async getPostMetrics(
    postId: string,
    userId: string,
    correlationId?: string | undefined
  ): Promise<PostPerformanceMetrics | null> {
    const timer = createTimer('get_post_metrics');

    try {
      log.analytics('Getting post performance metrics', {
        correlationId: correlationId || undefined,
        userId,
        postId,
        operation: 'get_post_metrics'
      });

      // Get the post
      const post = await this.prisma.post.findFirst({
        where: {
          id: postId,
          accountId: userId
        }
      });

      if (!post) {
        throw new Error('Post not found or access denied');
      }

      if (post.status !== PostStatusEnum.PUBLISHED) {
        return null; // No metrics for unpublished posts
      }

      // Simulate getting metrics from Twitter API
      const metrics = await this.simulateGetTwitterMetrics(post);

      timer.end();

      return metrics;

    } catch (error) {
      timer.end();
      log.error('Failed to get post metrics', {
        operation: 'get_post_metrics',
        correlationId: correlationId || undefined,
        userId,
        postId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get posts due for publishing (for scheduler)
   */
  async getPostsDueForPublishing(
    limit: number = 10,
    correlationId?: string | undefined
  ): Promise<Post[]> {
    const timer = createTimer('get_posts_due_for_publishing');

    try {
      log.debug('Getting posts due for publishing', {
        correlationId: correlationId || undefined,
        operation: 'get_posts_due_for_publishing',
        metadata: { limit }
      });

      const now = new Date();

      const posts = await this.prisma.post.findMany({
        where: {
          status: PostStatusEnum.SCHEDULED,
          scheduledFor: {
            lte: now
          }
        },
        orderBy: { scheduledFor: 'asc' },
        take: limit
      });

      timer.end();

      return posts;

    } catch (error) {
      timer.end();
      log.error('Failed to get posts due for publishing', {
        operation: 'get_posts_due_for_publishing',
        correlationId: correlationId || undefined,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Simulate Twitter API publishing (would be replaced with actual Twitter API)
   */
  private async simulateTwitterPublish(
    post: Post,
    _account: any
  ): Promise<PostPublishResult> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate success/failure based on content length (Twitter has character limits)
    const contentLength = post.content.length;

    if (contentLength > 280) {
      return {
        success: false,
        postId: post.id,
        error: 'Tweet exceeds 280 character limit'
      };
    }

    // Simulate successful publishing
    return {
      success: true,
      postId: post.id,
      platformPostId: `twitter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      publishedAt: new Date()
    };
  }

  /**
   * Simulate getting Twitter metrics (would be replaced with actual Twitter API)
   */
  private async simulateGetTwitterMetrics(post: Post): Promise<PostPerformanceMetrics> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate realistic mock metrics
    const baseEngagement = Math.floor(Math.random() * 1000) + 50;
    const views = baseEngagement * (Math.floor(Math.random() * 10) + 5);

    return {
      postId: post.id,
      accountId: post.accountId,
      publishedAt: new Date(),
      metrics: {
        views: views,
        impressions: Math.floor(views * 1.2),
        reach: Math.floor(views * 0.8),
        likes: Math.floor(baseEngagement * 0.1),
        retweets: Math.floor(baseEngagement * 0.05),
        replies: Math.floor(baseEngagement * 0.03),
        quotes: Math.floor(baseEngagement * 0.02),
        bookmarks: Math.floor(baseEngagement * 0.08),
        clicks: Math.floor(baseEngagement * 0.15),
        engagementRate: Math.random() * 0.1 + 0.01, // 1-11%
        clickThroughRate: Math.random() * 0.05 + 0.005 // 0.5-5.5%
      },
      demographics: {
        ageGroups: {
          '18-24': Math.random() * 0.3,
          '25-34': Math.random() * 0.4,
          '35-44': Math.random() * 0.2,
          '45+': Math.random() * 0.1
        },
        genders: {
          'male': Math.random() * 0.6 + 0.2,
          'female': Math.random() * 0.6 + 0.2,
          'other': Math.random() * 0.1
        },
        locations: {
          'US': Math.random() * 0.5 + 0.3,
          'UK': Math.random() * 0.2,
          'CA': Math.random() * 0.1,
          'Other': Math.random() * 0.3
        },
        languages: {
          'en': Math.random() * 0.8 + 0.1,
          'es': Math.random() * 0.2,
          'fr': Math.random() * 0.1
        }
      },
      timeline: [
        {
          timestamp: new Date(),
          event: 'published',
          count: 1
        }
      ],
      lastUpdated: new Date()
    };
  }

  /**
   * Get post statistics
   */
  async getPostStats(
    userId: string,
    correlationId?: string | undefined
  ): Promise<{
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    draftPosts: number;
    failedPosts: number;
    avgEngagementRate: number;
  }> {
    const timer = createTimer('get_post_stats');

    try {
      log.debug('Getting post statistics', {
        correlationId: correlationId || undefined,
        userId,
        operation: 'get_post_stats'
      });

      const [
        totalPosts,
        publishedPosts,
        scheduledPosts,
        draftPosts,
        failedPosts
      ] = await Promise.all([
        this.prisma.post.count({
          where: { accountId: userId }
        }),
        this.prisma.post.count({
          where: { accountId: userId, status: PostStatusEnum.PUBLISHED }
        }),
        this.prisma.post.count({
          where: { accountId: userId, status: PostStatusEnum.SCHEDULED }
        }),
        this.prisma.post.count({
          where: { accountId: userId, status: PostStatusEnum.DRAFT }
        }),
        this.prisma.post.count({
          where: { accountId: userId, status: PostStatusEnum.FAILED }
        })
      ]);

      // Calculate average engagement rate (simulated)
      const avgEngagementRate = Math.random() * 0.08 + 0.02; // 2-10%

      timer.end();

      return {
        totalPosts,
        publishedPosts,
        scheduledPosts,
        draftPosts,
        failedPosts,
        avgEngagementRate
      };

    } catch (error) {
      timer.end();
      log.error('Failed to get post statistics', {
        operation: 'get_post_stats',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }
}

// Create and export singleton instance
export const postService = new PostService();

// Export the class for testing
export { PostService };
