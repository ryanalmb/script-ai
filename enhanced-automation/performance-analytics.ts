/**
 * Enhanced Performance Analytics System
 * Provides comprehensive analytics for ethical automation performance
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { CacheService } from '../config/redis';

export interface PerformanceMetrics {
  accountId: string;
  timeframe: {
    start: Date;
    end: Date;
  };
  growth: {
    followersGained: number;
    followersLost: number;
    netGrowth: number;
    growthRate: number;
  };
  engagement: {
    totalLikes: number;
    totalRetweets: number;
    totalReplies: number;
    totalImpressions: number;
    engagementRate: number;
    averageEngagementPerPost: number;
  };
  content: {
    postsPublished: number;
    averagePostsPerDay: number;
    topPerformingPosts: any[];
    contentTypes: {
      text: number;
      image: number;
      video: number;
    };
  };
  automation: {
    actionsPerformed: number;
    automationUptime: number;
    complianceScore: number;
    violationsCount: number;
  };
  audience: {
    demographics: any;
    interests: string[];
    engagementTimes: any[];
    topLocations: string[];
  };
}

export interface BenchmarkData {
  industry: string;
  accountSize: 'small' | 'medium' | 'large';
  averageGrowthRate: number;
  averageEngagementRate: number;
  averagePostsPerDay: number;
  topHashtags: string[];
  bestPostingTimes: string[];
}

export class PerformanceAnalytics extends EventEmitter {
  private prisma: PrismaClient;
  private cache: CacheService;

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.cache = new CacheService();
  }

  /**
   * Get comprehensive performance metrics for an account
   */
  async getPerformanceMetrics(
    accountId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<PerformanceMetrics> {
    try {
      // Check cache first
      const cacheKey = `metrics:${accountId}:${timeframe.start.getTime()}:${timeframe.end.getTime()}`;
      const cached = await this.cache.get<PerformanceMetrics>(cacheKey);
      if (cached) {
        return cached;
      }

      // Gather metrics from various sources
      const [growth, engagement, content, automation, audience] = await Promise.all([
        this.calculateGrowthMetrics(accountId, timeframe),
        this.calculateEngagementMetrics(accountId, timeframe),
        this.calculateContentMetrics(accountId, timeframe),
        this.calculateAutomationMetrics(accountId, timeframe),
        this.calculateAudienceMetrics(accountId, timeframe)
      ]);

      const metrics: PerformanceMetrics = {
        accountId,
        timeframe,
        growth,
        engagement,
        content,
        automation,
        audience
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, metrics, 3600);

      return metrics;

    } catch (error) {
      logger.error('Error calculating performance metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate growth metrics
   */
  private async calculateGrowthMetrics(
    accountId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<PerformanceMetrics['growth']> {
    // Get follower data from analytics table
    const followerData = await this.prisma.analytics.findMany({
      where: {
        accountId,
        date: {
          gte: timeframe.start,
          lte: timeframe.end
        }
      },
      orderBy: { date: 'asc' }
    });

    if (followerData.length === 0) {
      return {
        followersGained: 0,
        followersLost: 0,
        netGrowth: 0,
        growthRate: 0
      };
    }

    const startFollowers = (followerData[0].metrics as any).followers || 0;
    const endFollowers = (followerData[followerData.length - 1].metrics as any).followers || 0;
    
    // Calculate daily changes
    let followersGained = 0;
    let followersLost = 0;

    for (let i = 1; i < followerData.length; i++) {
      const prev = (followerData[i - 1].metrics as any).followers || 0;
      const curr = (followerData[i].metrics as any).followers || 0;
      const change = curr - prev;

      if (change > 0) {
        followersGained += change;
      } else {
        followersLost += Math.abs(change);
      }
    }

    const netGrowth = endFollowers - startFollowers;
    const days = Math.max(1, Math.ceil((timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60 * 24)));
    const growthRate = startFollowers > 0 ? (netGrowth / startFollowers) * 100 : 0;

    return {
      followersGained,
      followersLost,
      netGrowth,
      growthRate
    };
  }

  /**
   * Calculate engagement metrics
   */
  private async calculateEngagementMetrics(
    accountId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<PerformanceMetrics['engagement']> {
    // Get posts and their engagement data
    const posts = await this.prisma.post.findMany({
      where: {
        accountId,
        publishedAt: {
          gte: timeframe.start,
          lte: timeframe.end
        },
        status: 'PUBLISHED'
      },
      include: {
        analytics: true
      }
    });

    let totalLikes = 0;
    let totalRetweets = 0;
    let totalReplies = 0;
    let totalImpressions = 0;

    posts.forEach(post => {
      totalLikes += post.likesCount;
      totalRetweets += post.retweetsCount;
      totalReplies += post.repliesCount;
      totalImpressions += post.viewsCount;
    });

    const totalEngagements = totalLikes + totalRetweets + totalReplies;
    const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;
    const averageEngagementPerPost = posts.length > 0 ? totalEngagements / posts.length : 0;

    return {
      totalLikes,
      totalRetweets,
      totalReplies,
      totalImpressions,
      engagementRate,
      averageEngagementPerPost
    };
  }

  /**
   * Calculate content metrics
   */
  private async calculateContentMetrics(
    accountId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<PerformanceMetrics['content']> {
    const posts = await this.prisma.post.findMany({
      where: {
        accountId,
        publishedAt: {
          gte: timeframe.start,
          lte: timeframe.end
        },
        status: 'PUBLISHED'
      },
      orderBy: {
        likesCount: 'desc'
      }
    });

    const days = Math.max(1, Math.ceil((timeframe.end.getTime() - timeframe.start.getTime()) / (1000 * 60 * 60 * 24)));
    const averagePostsPerDay = posts.length / days;

    // Categorize content types
    const contentTypes = {
      text: 0,
      image: 0,
      video: 0
    };

    posts.forEach(post => {
      if (post.mediaUrls.length === 0) {
        contentTypes.text++;
      } else {
        // Simple heuristic - could be enhanced with actual media type detection
        const hasVideo = post.mediaUrls.some(url => url.includes('.mp4') || url.includes('.mov'));
        if (hasVideo) {
          contentTypes.video++;
        } else {
          contentTypes.image++;
        }
      }
    });

    // Get top performing posts (top 10)
    const topPerformingPosts = posts.slice(0, 10).map(post => ({
      id: post.id,
      content: post.content.substring(0, 100),
      likes: post.likesCount,
      retweets: post.retweetsCount,
      replies: post.repliesCount,
      publishedAt: post.publishedAt
    }));

    return {
      postsPublished: posts.length,
      averagePostsPerDay,
      topPerformingPosts,
      contentTypes
    };
  }

  /**
   * Calculate automation metrics
   */
  private async calculateAutomationMetrics(
    accountId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<PerformanceMetrics['automation']> {
    // Get automation logs
    const automationLogs = await this.prisma.automationLog.findMany({
      where: {
        automation: {
          accountId
        },
        executedAt: {
          gte: timeframe.start,
          lte: timeframe.end
        }
      }
    });

    const actionsPerformed = automationLogs.length;
    const successfulActions = automationLogs.filter(log => log.status === 'SUCCESS').length;
    const automationUptime = actionsPerformed > 0 ? (successfulActions / actionsPerformed) * 100 : 0;

    // Get compliance data
    const complianceData = await this.getComplianceData(accountId, timeframe);
    const complianceScore = complianceData.averageScore;
    const violationsCount = complianceData.violationsCount;

    return {
      actionsPerformed,
      automationUptime,
      complianceScore,
      violationsCount
    };
  }

  /**
   * Calculate audience metrics
   */
  private async calculateAudienceMetrics(
    accountId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<PerformanceMetrics['audience']> {
    // This would typically integrate with X API to get audience insights
    // For now, return mock data structure
    return {
      demographics: {
        ageGroups: {
          '18-24': 25,
          '25-34': 35,
          '35-44': 25,
          '45-54': 10,
          '55+': 5
        },
        gender: {
          male: 60,
          female: 35,
          other: 5
        }
      },
      interests: ['cryptocurrency', 'blockchain', 'trading', 'technology', 'finance'],
      engagementTimes: [
        { hour: 9, engagement: 0.8 },
        { hour: 12, engagement: 0.9 },
        { hour: 15, engagement: 0.7 },
        { hour: 18, engagement: 0.85 },
        { hour: 21, engagement: 0.75 }
      ],
      topLocations: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany']
    };
  }

  /**
   * Get benchmark data for comparison
   */
  async getBenchmarkData(
    industry: string,
    accountSize: 'small' | 'medium' | 'large'
  ): Promise<BenchmarkData> {
    const cacheKey = `benchmark:${industry}:${accountSize}`;
    const cached = await this.cache.get<BenchmarkData>(cacheKey);
    if (cached) {
      return cached;
    }

    // This would typically come from industry data or aggregated platform data
    const benchmarkData: BenchmarkData = {
      industry,
      accountSize,
      averageGrowthRate: this.getBenchmarkGrowthRate(industry, accountSize),
      averageEngagementRate: this.getBenchmarkEngagementRate(industry, accountSize),
      averagePostsPerDay: this.getBenchmarkPostFrequency(industry, accountSize),
      topHashtags: this.getBenchmarkHashtags(industry),
      bestPostingTimes: ['09:00', '12:00', '15:00', '18:00', '21:00']
    };

    // Cache for 24 hours
    await this.cache.set(cacheKey, benchmarkData, 86400);

    return benchmarkData;
  }

  /**
   * Generate performance insights and recommendations
   */
  async generateInsights(
    metrics: PerformanceMetrics,
    benchmark: BenchmarkData
  ): Promise<{
    insights: string[];
    recommendations: string[];
    score: number;
  }> {
    const insights: string[] = [];
    const recommendations: string[] = [];

    // Growth analysis
    if (metrics.growth.growthRate > benchmark.averageGrowthRate) {
      insights.push(`Growth rate (${metrics.growth.growthRate.toFixed(2)}%) is above industry average`);
    } else {
      insights.push(`Growth rate (${metrics.growth.growthRate.toFixed(2)}%) is below industry average`);
      recommendations.push('Consider increasing content frequency and engagement activities');
    }

    // Engagement analysis
    if (metrics.engagement.engagementRate > benchmark.averageEngagementRate) {
      insights.push(`Engagement rate (${metrics.engagement.engagementRate.toFixed(2)}%) is excellent`);
    } else {
      insights.push(`Engagement rate (${metrics.engagement.engagementRate.toFixed(2)}%) needs improvement`);
      recommendations.push('Focus on creating more engaging content and optimal posting times');
    }

    // Content analysis
    if (metrics.content.averagePostsPerDay < benchmark.averagePostsPerDay) {
      recommendations.push('Consider increasing posting frequency to match industry standards');
    }

    // Automation analysis
    if (metrics.automation.complianceScore < 80) {
      recommendations.push('Review automation settings to improve compliance score');
    }

    if (metrics.automation.automationUptime < 95) {
      recommendations.push('Investigate automation failures and improve reliability');
    }

    // Calculate overall performance score
    const score = this.calculatePerformanceScore(metrics, benchmark);

    return {
      insights,
      recommendations,
      score
    };
  }

  /**
   * Helper methods
   */
  private async getComplianceData(
    accountId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<{ averageScore: number; violationsCount: number }> {
    // This would integrate with the compliance monitoring system
    return {
      averageScore: 85,
      violationsCount: 2
    };
  }

  private getBenchmarkGrowthRate(industry: string, accountSize: string): number {
    const benchmarks = {
      crypto: { small: 2.5, medium: 1.8, large: 1.2 },
      finance: { small: 1.8, medium: 1.3, large: 0.9 },
      technology: { small: 2.2, medium: 1.6, large: 1.1 }
    };

    return benchmarks[industry as keyof typeof benchmarks]?.[accountSize as keyof typeof benchmarks.crypto] || 1.5;
  }

  private getBenchmarkEngagementRate(industry: string, accountSize: string): number {
    const benchmarks = {
      crypto: { small: 3.5, medium: 2.8, large: 2.2 },
      finance: { small: 2.8, medium: 2.3, large: 1.8 },
      technology: { small: 3.2, medium: 2.6, large: 2.0 }
    };

    return benchmarks[industry as keyof typeof benchmarks]?.[accountSize as keyof typeof benchmarks.crypto] || 2.5;
  }

  private getBenchmarkPostFrequency(industry: string, accountSize: string): number {
    const benchmarks = {
      crypto: { small: 3, medium: 5, large: 8 },
      finance: { small: 2, medium: 4, large: 6 },
      technology: { small: 3, medium: 5, large: 7 }
    };

    return benchmarks[industry as keyof typeof benchmarks]?.[accountSize as keyof typeof benchmarks.crypto] || 4;
  }

  private getBenchmarkHashtags(industry: string): string[] {
    const hashtags = {
      crypto: ['#crypto', '#bitcoin', '#blockchain', '#defi', '#trading'],
      finance: ['#finance', '#investing', '#money', '#stocks', '#trading'],
      technology: ['#tech', '#innovation', '#ai', '#software', '#startup']
    };

    return hashtags[industry as keyof typeof hashtags] || hashtags.technology;
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics, benchmark: BenchmarkData): number {
    let score = 0;
    let factors = 0;

    // Growth score (25%)
    const growthScore = Math.min(100, (metrics.growth.growthRate / benchmark.averageGrowthRate) * 100);
    score += growthScore * 0.25;
    factors++;

    // Engagement score (30%)
    const engagementScore = Math.min(100, (metrics.engagement.engagementRate / benchmark.averageEngagementRate) * 100);
    score += engagementScore * 0.30;
    factors++;

    // Content score (20%)
    const contentScore = Math.min(100, (metrics.content.averagePostsPerDay / benchmark.averagePostsPerDay) * 100);
    score += contentScore * 0.20;
    factors++;

    // Automation score (25%)
    const automationScore = (metrics.automation.complianceScore + metrics.automation.automationUptime) / 2;
    score += automationScore * 0.25;
    factors++;

    return Math.round(score);
  }
}
