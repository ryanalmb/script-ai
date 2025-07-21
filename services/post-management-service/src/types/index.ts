/**
 * Enterprise Post Management Service - Type Definitions
 * Comprehensive type system for post scheduling, publishing, and performance tracking
 */

import { Request } from 'express';

// Import types from Prisma client to ensure consistency
import type { 
  Post as PrismaPost,
  PostStatus as PrismaPostStatus,
  Account as PrismaAccount,
  Campaign as PrismaCampaign,
  User as PrismaUser,
  UserRole as PrismaUserRole
} from '@prisma/client';

export type Post = PrismaPost;
export type PostStatus = PrismaPostStatus;
export type Account = PrismaAccount;
export type Campaign = PrismaCampaign;
export type User = PrismaUser;
export type UserRole = PrismaUserRole;

export { 
  PostStatus as PostStatusEnum
} from '@prisma/client';

// ===================================
// POST MANAGEMENT TYPES
// ===================================

export interface PostScheduleRequest {
  postId: string;
  scheduledFor: Date;
  timezone?: string | undefined;
  retryAttempts?: number | undefined;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | undefined;
}

export interface PostPublishRequest {
  postId: string;
  accountId: string;
  immediatePublish?: boolean | undefined;
  overrideSchedule?: boolean | undefined;
}

export interface PostPerformanceMetrics {
  postId: string;
  accountId: string;
  publishedAt: Date;
  metrics: {
    views: number;
    impressions: number;
    reach: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    clicks: number;
    engagementRate: number;
    clickThroughRate: number;
  };
  demographics: {
    ageGroups: Record<string, number>;
    genders: Record<string, number>;
    locations: Record<string, number>;
    languages: Record<string, number>;
  };
  timeline: {
    timestamp: Date;
    event: 'published' | 'liked' | 'retweeted' | 'replied' | 'quoted' | 'bookmarked';
    count: number;
  }[];
  lastUpdated: Date;
}

export interface PostQueue {
  id: string;
  postId: string;
  accountId: string;
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'published' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryAttempts: number;
  maxRetries: number;
  lastAttempt?: Date | undefined;
  error?: string | undefined;
  publishedAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostPublishResult {
  success: boolean;
  postId: string;
  platformPostId?: string | undefined;
  publishedAt?: Date | undefined;
  error?: string | undefined;
  metrics?: {
    processingTime: number;
    retryCount: number;
    queueWaitTime: number;
  } | undefined;
}

export interface PostAnalytics {
  postId: string;
  accountId: string;
  campaignId?: string | undefined;
  performance: PostPerformanceMetrics;
  insights: {
    bestPerformingTime: string;
    audienceEngagement: number;
    viralityScore: number;
    sentimentScore: number;
    topHashtags: string[];
    topMentions: string[];
  };
  comparisons: {
    vsAccountAverage: number;
    vsCampaignAverage?: number | undefined;
    vsIndustryBenchmark: number;
  };
  recommendations: {
    optimalPostingTime: string;
    contentSuggestions: string[];
    hashtagRecommendations: string[];
    audienceTargeting: string[];
  };
}

// ===================================
// SCHEDULING TYPES
// ===================================

export interface SchedulingRule {
  id: string;
  accountId: string;
  name: string;
  description?: string | undefined;
  isActive: boolean;
  conditions: {
    timeSlots: {
      dayOfWeek: number; // 0-6 (Sunday-Saturday)
      startTime: string; // HH:mm format
      endTime: string; // HH:mm format
    }[];
    timezone: string;
    excludeDates: Date[];
    minInterval: number; // minutes between posts
    maxPostsPerDay: number;
    maxPostsPerHour: number;
  };
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptimalTimingAnalysis {
  accountId: string;
  analysis: {
    bestDays: {
      dayOfWeek: number;
      score: number;
      avgEngagement: number;
    }[];
    bestHours: {
      hour: number;
      score: number;
      avgEngagement: number;
    }[];
    audienceActivity: {
      hour: number;
      dayOfWeek: number;
      activityLevel: number;
    }[];
  };
  recommendations: {
    optimalSlots: {
      dayOfWeek: number;
      hour: number;
      minute: number;
      score: number;
    }[];
    avoidSlots: {
      dayOfWeek: number;
      hour: number;
      reason: string;
    }[];
  };
  lastAnalyzed: Date;
  dataPoints: number;
}

// ===================================
// TWITTER API INTEGRATION TYPES
// ===================================

export interface TwitterApiConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken: string;
  apiVersion: 'v1.1' | 'v2';
  rateLimitBuffer: number; // percentage buffer for rate limits
}

export interface TwitterPostRequest {
  text: string;
  mediaIds?: string[] | undefined;
  replyToTweetId?: string | undefined;
  quoteTweetId?: string | undefined;
  poll?: {
    options: string[];
    durationMinutes: number;
  } | undefined;
  geoLocation?: {
    latitude: number;
    longitude: number;
  } | undefined;
  settings?: {
    replySettings: 'everyone' | 'mentionedUsers' | 'following';
  } | undefined;
}

export interface TwitterPostResponse {
  success: boolean;
  tweetId?: string | undefined;
  url?: string | undefined;
  error?: {
    code: string;
    message: string;
    details?: any;
  } | undefined;
  rateLimitInfo?: {
    remaining: number;
    resetTime: Date;
    limit: number;
  } | undefined;
}

export interface TwitterMetrics {
  tweetId: string;
  metrics: {
    retweetCount: number;
    likeCount: number;
    replyCount: number;
    quoteCount: number;
    bookmarkCount: number;
    impressionCount: number;
  };
  publicMetrics: {
    viewCount: number;
    urlLinkClicks: number;
    userProfileClicks: number;
    mediaViews: number;
  };
  organicMetrics?: {
    impressionCount: number;
    likeCount: number;
    replyCount: number;
    retweetCount: number;
    urlLinkClicks: number;
    userProfileClicks: number;
  } | undefined;
  promotedMetrics?: {
    impressionCount: number;
    likeCount: number;
    replyCount: number;
    retweetCount: number;
    urlLinkClicks: number;
    userProfileClicks: number;
  } | undefined;
}

// ===================================
// EVENT TYPES
// ===================================

export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  correlationId: string;
  source: string;
  version: string;
}

export interface PostEvent extends BaseEvent {
  userId: string;
  postId: string;
  accountId: string;
  data: Record<string, any>;
  metadata?: Record<string, any> | undefined;
}

export enum PostEventType {
  POST_SCHEDULED = 'post.scheduled',
  POST_PUBLISHED = 'post.published',
  POST_FAILED = 'post.failed',
  POST_CANCELLED = 'post.cancelled',
  POST_METRICS_UPDATED = 'post.metrics_updated',
  POST_QUEUE_ADDED = 'post.queue_added',
  POST_QUEUE_PROCESSED = 'post.queue_processed',
  OPTIMAL_TIMING_ANALYZED = 'post.optimal_timing_analyzed',
  RATE_LIMIT_REACHED = 'post.rate_limit_reached',
  ACCOUNT_SUSPENDED = 'post.account_suspended'
}

// ===================================
// API TYPES
// ===================================

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  } | undefined;
  correlationId?: string | undefined;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
  code?: string | undefined;
  timestamp: string;
  correlationId?: string | undefined;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ErrorResponse extends ApiResponse {
  errors?: ValidationError[] | undefined;
  stack?: string | undefined;
}

// ===================================
// SERVICE CONFIGURATION TYPES
// ===================================

export interface ServiceConfig {
  name: string;
  version: string;
  port: number;
  host: string;
  environment: string;
  database: {
    url: string;
    poolSize: number;
    timeout: number;
  };
  redis: {
    url: string;
    keyPrefix: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  consul: {
    host: string;
    port: number;
    serviceName: string;
  };
  twitter: {
    consumerKey: string;
    consumerSecret: string;
    rateLimitBuffer: number;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  checks: {
    database: boolean;
    redis: boolean;
    kafka: boolean;
    consul: boolean;
    twitter: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    totalPosts: number;
    queuedPosts: number;
    publishedToday: number;
    failedPosts: number;
  };
}
