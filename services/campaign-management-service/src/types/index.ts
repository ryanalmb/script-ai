/**
 * Enterprise Campaign Management Service - Type Definitions
 * Comprehensive type system for campaign management, automation, and scheduling
 */

import { Request } from 'express';

// Import types from Prisma client to ensure consistency
import type { 
  Campaign as PrismaCampaign,
  CampaignStatus as PrismaCampaignStatus,
  CampaignType as PrismaCampaignType,
  Post as PrismaPost,
  PostStatus as PrismaPostStatus,
  PostType as PrismaPostType,
  Automation as PrismaAutomation,
  AutomationStatus as PrismaAutomationStatus,
  AutomationType as PrismaAutomationType,
  User as PrismaUser,
  UserRole as PrismaUserRole,
  XAccount as PrismaXAccount
} from '@prisma/client';

export type Campaign = PrismaCampaign;
export type CampaignStatus = PrismaCampaignStatus;
export type CampaignType = PrismaCampaignType;
export type Post = PrismaPost;
export type PostStatus = PrismaPostStatus;
export type PostType = PrismaPostType;
export type Automation = PrismaAutomation;
export type AutomationStatus = PrismaAutomationStatus;
export type AutomationType = PrismaAutomationType;
export type User = PrismaUser;
export type UserRole = PrismaUserRole;
export type XAccount = PrismaXAccount;

export { 
  CampaignStatus as CampaignStatusEnum,
  CampaignType as CampaignTypeEnum,
  PostStatus as PostStatusEnum,
  PostType as PostTypeEnum,
  AutomationStatus as AutomationStatusEnum,
  AutomationType as AutomationTypeEnum
} from '@prisma/client';

// ===================================
// CAMPAIGN MANAGEMENT TYPES
// ===================================

export interface CreateCampaignRequest {
  name: string;
  description?: string | undefined;
  type: CampaignType;
  accountIds: string[];
  settings: CampaignSettings;
  scheduledStartAt?: Date | undefined;
  scheduledEndAt?: Date | undefined;
  budget?: CampaignBudget | undefined;
  targeting?: CampaignTargeting | undefined;
}

export interface UpdateCampaignRequest {
  name?: string | undefined;
  description?: string | undefined;
  settings?: Partial<CampaignSettings> | undefined;
  scheduledStartAt?: Date | undefined;
  scheduledEndAt?: Date | undefined;
  budget?: Partial<CampaignBudget> | undefined;
  targeting?: Partial<CampaignTargeting> | undefined;
}

export interface CampaignSettings {
  autoPost: boolean;
  autoLike: boolean;
  autoRetweet: boolean;
  autoFollow: boolean;
  autoReply: boolean;
  contentGeneration: {
    enabled: boolean;
    tone: 'professional' | 'casual' | 'humorous' | 'aggressive' | 'friendly';
    topics: string[];
    hashtags: string[];
    mentions: string[];
    maxLength: number;
    includeImages: boolean;
    includeLinks: boolean;
  };
  scheduling: {
    timezone: string;
    workingHours: {
      start: string; // HH:mm format
      end: string;   // HH:mm format
    };
    workingDays: number[]; // 0-6, Sunday = 0
    frequency: {
      postsPerDay: number;
      likesPerDay: number;
      retweetsPerDay: number;
      followsPerDay: number;
      repliesPerDay: number;
    };
    intervals: {
      minPostInterval: number; // minutes
      maxPostInterval: number; // minutes
      minEngagementInterval: number; // minutes
      maxEngagementInterval: number; // minutes
    };
  };
  safety: {
    respectRateLimits: boolean;
    avoidSpamDetection: boolean;
    randomizeTimings: boolean;
    pauseOnSuspicion: boolean;
    maxDailyActions: number;
    cooldownPeriods: {
      afterPost: number; // minutes
      afterLike: number; // minutes
      afterRetweet: number; // minutes
      afterFollow: number; // minutes
    };
  };
  contentFilters: {
    blacklistedKeywords: string[];
    whitelistedDomains: string[];
    requireApproval: boolean;
    autoModeration: boolean;
    sentimentFilter: 'none' | 'positive' | 'neutral' | 'negative';
  };
}

export interface CampaignBudget {
  totalBudget: number;
  dailyBudget: number;
  currency: string;
  costPerAction: {
    post: number;
    like: number;
    retweet: number;
    follow: number;
    reply: number;
  };
  spendingLimits: {
    maxDailySpend: number;
    maxWeeklySpend: number;
    maxMonthlySpend: number;
  };
}

export interface CampaignTargeting {
  demographics: {
    ageRange?: { min: number; max: number } | undefined;
    gender?: 'male' | 'female' | 'all' | undefined;
    location?: {
      countries: string[];
      cities: string[];
      radius?: number | undefined; // km
    } | undefined;
    languages: string[];
  };
  interests: {
    keywords: string[];
    hashtags: string[];
    accounts: string[]; // usernames to target followers of
    competitors: string[]; // competitor accounts
  };
  behavior: {
    engagementLevel: 'low' | 'medium' | 'high' | 'all';
    activityTime: {
      timezone: string;
      preferredHours: number[]; // 0-23
      preferredDays: number[]; // 0-6
    };
    deviceTypes: ('mobile' | 'desktop' | 'tablet')[];
  };
  exclusions: {
    blockedKeywords: string[];
    blockedAccounts: string[];
    blockedHashtags: string[];
    excludeFollowers: boolean;
    excludeExistingCustomers: boolean;
  };
}

export interface CampaignMetrics {
  campaignId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  performance: {
    postsCreated: number;
    postsPublished: number;
    postsScheduled: number;
    postsFailed: number;
    likesGiven: number;
    retweetsMade: number;
    followsExecuted: number;
    repliesSent: number;
  };
  engagement: {
    totalImpressions: number;
    totalReach: number;
    totalEngagements: number;
    engagementRate: number;
    clickThroughRate: number;
    conversionRate: number;
  };
  costs: {
    totalSpent: number;
    costPerPost: number;
    costPerEngagement: number;
    costPerClick: number;
    costPerConversion: number;
    remainingBudget: number;
  };
  audience: {
    newFollowers: number;
    lostFollowers: number;
    profileViews: number;
    mentionsReceived: number;
    directMessages: number;
  };
  errors: {
    apiErrors: number;
    rateLimitHits: number;
    contentRejections: number;
    accountSuspensions: number;
  };
}

// ===================================
// POST MANAGEMENT TYPES
// ===================================

export interface CreatePostRequest {
  campaignId: string;
  accountIds: string[];
  content: PostContent;
  scheduledAt?: Date | undefined;
  settings?: PostSettings | undefined;
}

export interface UpdatePostRequest {
  content?: Partial<PostContent> | undefined;
  scheduledAt?: Date | undefined;
  settings?: Partial<PostSettings> | undefined;
}

export interface PostContent {
  text: string;
  media?: PostMedia[] | undefined;
  links?: PostLink[] | undefined;
  hashtags: string[];
  mentions: string[];
  replyToPostId?: string | undefined;
  quoteTweetId?: string | undefined;
}

export interface PostMedia {
  type: 'image' | 'video' | 'gif';
  url: string;
  altText?: string | undefined;
  thumbnail?: string | undefined;
  duration?: number | undefined; // for videos
  size?: {
    width: number;
    height: number;
  } | undefined;
}

export interface PostLink {
  url: string;
  title?: string | undefined;
  description?: string | undefined;
  image?: string | undefined;
  domain: string;
}

export interface PostSettings {
  autoGenerate: boolean;
  requireApproval: boolean;
  allowEditing: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  notes?: string | undefined;
}

export interface PostAnalytics {
  postId: string;
  publishedAt: Date;
  metrics: {
    impressions: number;
    reach: number;
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    profileClicks: number;
    linkClicks: number;
    mediaViews: number;
    engagementRate: number;
  };
  audience: {
    demographics: {
      ageGroups: Record<string, number>;
      genders: Record<string, number>;
      locations: Record<string, number>;
    };
    interests: string[];
    devices: Record<string, number>;
  };
  performance: {
    bestPerformingTime: string;
    peakEngagementHour: number;
    viralityScore: number;
    sentimentScore: number;
  };
}

// ===================================
// AUTOMATION TYPES
// ===================================

export interface CreateAutomationRequest {
  campaignId: string;
  name: string;
  description?: string | undefined;
  type: AutomationType;
  triggers: AutomationTrigger[];
  actions: AutomationAction[];
  conditions?: AutomationCondition[] | undefined;
  schedule?: AutomationSchedule | undefined;
  settings: AutomationSettings;
}

export interface UpdateAutomationRequest {
  name?: string | undefined;
  description?: string | undefined;
  triggers?: AutomationTrigger[] | undefined;
  actions?: AutomationAction[] | undefined;
  conditions?: AutomationCondition[] | undefined;
  schedule?: AutomationSchedule | undefined;
  settings?: Partial<AutomationSettings> | undefined;
}

export interface AutomationTrigger {
  type: 'time' | 'event' | 'condition' | 'webhook' | 'manual';
  config: {
    // Time-based triggers
    schedule?: {
      cron: string;
      timezone: string;
      startDate?: Date | undefined;
      endDate?: Date | undefined;
    } | undefined;
    
    // Event-based triggers
    event?: {
      source: 'twitter' | 'internal' | 'external';
      eventType: string;
      filters: Record<string, any>;
    } | undefined;
    
    // Condition-based triggers
    condition?: {
      metric: string;
      operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
      value: number | string;
      timeframe: number; // minutes
    } | undefined;
    
    // Webhook triggers
    webhook?: {
      url: string;
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      payload: Record<string, any>;
    } | undefined;
  };
}

export interface AutomationAction {
  type: 'post' | 'like' | 'retweet' | 'follow' | 'unfollow' | 'reply' | 'dm' | 'webhook' | 'wait';
  config: {
    // Post actions
    post?: {
      content: PostContent;
      accountIds: string[];
      delay?: number | undefined; // minutes
    } | undefined;
    
    // Engagement actions
    engagement?: {
      targetType: 'hashtag' | 'user' | 'keyword' | 'trending';
      target: string;
      accountIds: string[];
      limit: number;
      filters?: {
        minFollowers?: number | undefined;
        maxFollowers?: number | undefined;
        verified?: boolean | undefined;
        language?: string | undefined;
      } | undefined;
    } | undefined;
    
    // Webhook actions
    webhook?: {
      url: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers: Record<string, string>;
      payload: Record<string, any>;
      retries: number;
    } | undefined;
    
    // Wait actions
    wait?: {
      duration: number; // minutes
      randomize?: boolean | undefined;
      maxRandomDelay?: number | undefined; // minutes
    } | undefined;
  };
}

export interface AutomationCondition {
  type: 'time' | 'metric' | 'account' | 'content' | 'budget';
  operator: 'and' | 'or' | 'not';
  config: {
    // Time conditions
    time?: {
      startTime: string; // HH:mm
      endTime: string;   // HH:mm
      days: number[];    // 0-6
      timezone: string;
    } | undefined;
    
    // Metric conditions
    metric?: {
      name: string;
      operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
      value: number;
      timeframe: number; // minutes
    } | undefined;
    
    // Account conditions
    account?: {
      accountId: string;
      status: 'active' | 'suspended' | 'rate_limited';
      minFollowers?: number | undefined;
      maxFollowers?: number | undefined;
    } | undefined;
    
    // Content conditions
    content?: {
      sentiment: 'positive' | 'negative' | 'neutral';
      keywords: string[];
      hashtags: string[];
      mentions: string[];
    } | undefined;
    
    // Budget conditions
    budget?: {
      remainingBudget: number;
      dailySpent: number;
      monthlySpent: number;
    } | undefined;
  };
}

export interface AutomationSchedule {
  enabled: boolean;
  timezone: string;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  workingHours: {
    start: string; // HH:mm
    end: string;   // HH:mm
  };
  workingDays: number[]; // 0-6
  frequency: {
    interval: number; // minutes
    maxExecutionsPerDay: number;
    maxExecutionsPerHour: number;
  };
}

export interface AutomationSettings {
  enabled: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryOnFailure: boolean;
  maxRetries: number;
  retryDelay: number; // minutes
  stopOnError: boolean;
  logLevel: 'minimal' | 'normal' | 'detailed' | 'debug';
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    onComplete: boolean;
    webhookUrl?: string | undefined;
    emailRecipients: string[];
  };
  safety: {
    respectRateLimits: boolean;
    pauseOnSuspicion: boolean;
    maxActionsPerHour: number;
    cooldownBetweenActions: number; // minutes
  };
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

export interface CampaignEvent extends BaseEvent {
  userId: string;
  campaignId: string;
  data: Record<string, any>;
  metadata?: Record<string, any> | undefined;
}

export enum CampaignEventType {
  CAMPAIGN_CREATED = 'campaign.created',
  CAMPAIGN_UPDATED = 'campaign.updated',
  CAMPAIGN_STARTED = 'campaign.started',
  CAMPAIGN_PAUSED = 'campaign.paused',
  CAMPAIGN_RESUMED = 'campaign.resumed',
  CAMPAIGN_STOPPED = 'campaign.stopped',
  CAMPAIGN_COMPLETED = 'campaign.completed',
  CAMPAIGN_DELETED = 'campaign.deleted',
  POST_CREATED = 'post.created',
  POST_SCHEDULED = 'post.scheduled',
  POST_PUBLISHED = 'post.published',
  POST_FAILED = 'post.failed',
  POST_DELETED = 'post.deleted',
  AUTOMATION_CREATED = 'automation.created',
  AUTOMATION_STARTED = 'automation.started',
  AUTOMATION_EXECUTED = 'automation.executed',
  AUTOMATION_FAILED = 'automation.failed',
  AUTOMATION_STOPPED = 'automation.stopped',
  BUDGET_THRESHOLD_REACHED = 'budget.threshold_reached',
  BUDGET_EXHAUSTED = 'budget.exhausted',
  PERFORMANCE_ALERT = 'performance.alert',
  COMPLIANCE_VIOLATION = 'compliance.violation'
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
  llm: {
    serviceUrl: string;
    apiKey: string;
    model: string;
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
    llm: boolean;
    scheduler: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeCampaigns: number;
    scheduledPosts: number;
    runningAutomations: number;
  };
}

// ===================================
// SCHEDULER TYPES
// ===================================

export interface ScheduledTask {
  id: string;
  type: 'post' | 'automation' | 'campaign' | 'maintenance';
  entityId: string;
  scheduledAt: Date;
  data: Record<string, any>;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerMetrics {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  tasksPerMinute: number;
  errorRate: number;
}
