/**
 * Enterprise Content Management Service - Type Definitions
 * Comprehensive type system for content creation, media management, and AI generation
 */

import { Request } from 'express';

// Import types from Prisma client to ensure consistency
import type {
  Post as PrismaPost,
  PostStatus as PrismaPostStatus,
  ContentTemplate as PrismaContentTemplate,
  User as PrismaUser,
  UserRole as PrismaUserRole
} from '@prisma/client';

// Map Post to Content for our service
export type Content = PrismaPost;
export type ContentStatus = PrismaPostStatus;
export type Template = PrismaContentTemplate;
export type User = PrismaUser;
export type UserRole = PrismaUserRole;

export {
  PostStatus as ContentStatusEnum
} from '@prisma/client';

// Content types based on the actual Post model usage
export type ContentType = 'TWEET' | 'THREAD' | 'RETWEET' | 'REPLY' | 'QUOTE_TWEET' | 'ARTICLE' | 'POST';
export const ContentTypeEnum = {
  TWEET: 'TWEET' as const,
  THREAD: 'THREAD' as const,
  RETWEET: 'RETWEET' as const,
  REPLY: 'REPLY' as const,
  QUOTE_TWEET: 'QUOTE_TWEET' as const,
  ARTICLE: 'ARTICLE' as const,
  POST: 'POST' as const
};

// Media types for content management
export type MediaType = 'IMAGE' | 'VIDEO' | 'GIF' | 'AUDIO' | 'DOCUMENT';
export const MediaTypeEnum = {
  IMAGE: 'IMAGE' as const,
  VIDEO: 'VIDEO' as const,
  GIF: 'GIF' as const,
  AUDIO: 'AUDIO' as const,
  DOCUMENT: 'DOCUMENT' as const
};

// Template categories based on ContentTemplate model
export type TemplateCategory = 'crypto' | 'finance' | 'general' | 'marketing' | 'tech' | 'business';
export const TemplateCategoryEnum = {
  CRYPTO: 'crypto' as const,
  FINANCE: 'finance' as const,
  GENERAL: 'general' as const,
  MARKETING: 'marketing' as const,
  TECH: 'tech' as const,
  BUSINESS: 'business' as const
};

// Media interface for content management (will be implemented when media model is added)
export interface Media {
  id: string;
  userId: string;
  contentId?: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string | null;
  metadata: any;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===================================
// CONTENT MANAGEMENT TYPES
// ===================================

export interface CreateContentRequest {
  title: string;
  body: string;
  type: ContentType;
  campaignId?: string | undefined;
  templateId?: string | undefined;
  mediaIds?: string[] | undefined;
  hashtags?: string[] | undefined;
  mentions?: string[] | undefined;
  scheduledAt?: Date | undefined;
  settings?: ContentSettings | undefined;
  metadata?: ContentMetadata | undefined;
}

export interface UpdateContentRequest {
  title?: string | undefined;
  body?: string | undefined;
  hashtags?: string[] | undefined;
  mentions?: string[] | undefined;
  scheduledAt?: Date | undefined;
  settings?: Partial<ContentSettings> | undefined;
  metadata?: Partial<ContentMetadata> | undefined;
}

export interface ContentSettings {
  autoPublish: boolean;
  requireApproval: boolean;
  allowEditing: boolean;
  enableComments: boolean;
  enableSharing: boolean;
  visibility: 'public' | 'private' | 'unlisted';
  contentWarnings: string[];
  ageRestriction: boolean;
  geolocation?: {
    enabled: boolean;
    latitude?: number | undefined;
    longitude?: number | undefined;
    placeName?: string | undefined;
  } | undefined;
  scheduling: {
    timezone: string;
    optimalTiming: boolean;
    recurringPost: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly' | undefined;
    endDate?: Date | undefined;
  };
  engagement: {
    autoLike: boolean;
    autoReply: boolean;
    replyTemplates: string[];
    engagementLimit: number;
  };
  analytics: {
    trackClicks: boolean;
    trackEngagement: boolean;
    trackConversions: boolean;
    customEvents: string[];
  };
}

export interface ContentMetadata {
  source: 'manual' | 'ai_generated' | 'template' | 'imported';
  aiModel?: string | undefined;
  aiPrompt?: string | undefined;
  aiTokensUsed?: number | undefined;
  aiCost?: number | undefined;
  language: string;
  readingTime: number; // in minutes
  wordCount: number;
  characterCount: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  topics: string[];
  keywords: string[];
  entities: ContentEntity[];
  seoScore?: number | undefined;
  readabilityScore?: number | undefined;
  brandSafety: {
    score: number;
    issues: string[];
    approved: boolean;
  };
  compliance: {
    checked: boolean;
    violations: string[];
    approved: boolean;
  };
}

export interface ContentEntity {
  type: 'person' | 'organization' | 'location' | 'product' | 'event' | 'hashtag' | 'mention';
  text: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface ContentAnalytics {
  contentId: string;
  publishedAt: Date;
  metrics: {
    views: number;
    impressions: number;
    reach: number;
    likes: number;
    shares: number;
    comments: number;
    clicks: number;
    saves: number;
    engagementRate: number;
    clickThroughRate: number;
    conversionRate: number;
  };
  audience: {
    demographics: {
      ageGroups: Record<string, number>;
      genders: Record<string, number>;
      locations: Record<string, number>;
      languages: Record<string, number>;
    };
    interests: string[];
    devices: Record<string, number>;
    platforms: Record<string, number>;
  };
  performance: {
    bestPerformingTime: string;
    peakEngagementHour: number;
    viralityScore: number;
    sentimentScore: number;
    shareability: number;
  };
  timeline: {
    timestamp: Date;
    event: string;
    value: number;
  }[];
}

// ===================================
// MEDIA MANAGEMENT TYPES
// ===================================

export interface CreateMediaRequest {
  file: Express.Multer.File;
  title?: string | undefined;
  description?: string | undefined;
  altText?: string | undefined;
  tags?: string[] | undefined;
  folder?: string | undefined;
  isPublic?: boolean | undefined;
}

export interface UpdateMediaRequest {
  title?: string | undefined;
  description?: string | undefined;
  altText?: string | undefined;
  tags?: string[] | undefined;
  folder?: string | undefined;
  isPublic?: boolean | undefined;
}

export interface MediaProcessingOptions {
  resize?: {
    width?: number | undefined;
    height?: number | undefined;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | undefined;
    quality?: number | undefined;
  } | undefined;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined;
  filters?: {
    blur?: number | undefined;
    brightness?: number | undefined;
    contrast?: number | undefined;
    saturation?: number | undefined;
    hue?: number | undefined;
    gamma?: number | undefined;
  } | undefined;
  watermark?: {
    text?: string | undefined;
    image?: string | undefined;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity: number;
  } | undefined;
  format?: 'jpeg' | 'png' | 'webp' | 'avif' | undefined;
  optimize: boolean;
}

export interface MediaMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  } | undefined;
  duration?: number | undefined; // for videos
  frameRate?: number | undefined; // for videos
  bitrate?: number | undefined; // for videos/audio
  colorSpace?: string | undefined;
  hasAudio?: boolean | undefined;
  hasVideo?: boolean | undefined;
  exif?: Record<string, any> | undefined;
  processing: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    variants: MediaVariant[];
    error?: string | undefined;
  };
  analysis: {
    faces?: FaceDetection[] | undefined;
    objects?: ObjectDetection[] | undefined;
    text?: TextDetection[] | undefined;
    scenes?: SceneDetection[] | undefined;
    moderation?: ModerationResult | undefined;
  };
}

export interface MediaVariant {
  name: string;
  url: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  } | undefined;
  format: string;
  quality?: number | undefined;
}

export interface FaceDetection {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  landmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
    mouth: { x: number; y: number };
  } | undefined;
  attributes?: {
    age?: number | undefined;
    gender?: string | undefined;
    emotion?: string | undefined;
  } | undefined;
}

export interface ObjectDetection {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TextDetection {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  language?: string | undefined;
}

export interface SceneDetection {
  label: string;
  confidence: number;
  timestamp?: number | undefined; // for videos
}

export interface ModerationResult {
  isAppropriate: boolean;
  confidence: number;
  categories: {
    adult: number;
    violence: number;
    racy: number;
    medical: number;
    spoof: number;
  };
  flags: string[];
}

// ===================================
// TEMPLATE MANAGEMENT TYPES
// ===================================

export interface CreateTemplateRequest {
  name: string;
  description?: string | undefined;
  category: TemplateCategory;
  content: TemplateContent;
  variables: TemplateVariable[];
  settings?: TemplateSettings | undefined;
  isPublic?: boolean | undefined;
  tags?: string[] | undefined;
}

export interface UpdateTemplateRequest {
  name?: string | undefined;
  description?: string | undefined;
  category?: TemplateCategory | undefined;
  content?: Partial<TemplateContent> | undefined;
  variables?: TemplateVariable[] | undefined;
  settings?: Partial<TemplateSettings> | undefined;
  isPublic?: boolean | undefined;
  tags?: string[] | undefined;
}

export interface TemplateContent {
  title?: string | undefined;
  body: string;
  mediaPlaceholders: MediaPlaceholder[];
  hashtagPlaceholders: string[];
  mentionPlaceholders: string[];
  linkPlaceholders: LinkPlaceholder[];
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string | undefined;
  required: boolean;
  defaultValue?: any;
  options?: string[] | undefined; // for select/multiselect
  validation?: {
    minLength?: number | undefined;
    maxLength?: number | undefined;
    pattern?: string | undefined;
    min?: number | undefined;
    max?: number | undefined;
  } | undefined;
}

export interface MediaPlaceholder {
  id: string;
  type: MediaType;
  required: boolean;
  description?: string | undefined;
  constraints?: {
    maxSize?: number | undefined;
    dimensions?: {
      minWidth?: number | undefined;
      maxWidth?: number | undefined;
      minHeight?: number | undefined;
      maxHeight?: number | undefined;
      aspectRatio?: string | undefined;
    } | undefined;
    formats?: string[] | undefined;
  } | undefined;
}

export interface LinkPlaceholder {
  id: string;
  label: string;
  required: boolean;
  description?: string | undefined;
  validation?: {
    allowedDomains?: string[] | undefined;
    requireHttps?: boolean | undefined;
  } | undefined;
}

export interface TemplateSettings {
  autoFillVariables: boolean;
  requireAllVariables: boolean;
  allowCustomization: boolean;
  versionControl: boolean;
  approvalRequired: boolean;
  usage: {
    maxUsesPerDay?: number | undefined;
    maxUsesPerUser?: number | undefined;
    expiresAt?: Date | undefined;
  };
  ai: {
    enableGeneration: boolean;
    model?: string | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
  };
}

// ===================================
// AI CONTENT GENERATION TYPES
// ===================================

export interface ContentGenerationRequest {
  prompt: string;
  type: ContentType;
  tone?: 'professional' | 'casual' | 'humorous' | 'aggressive' | 'friendly' | 'formal' | 'informal' | undefined;
  length?: 'short' | 'medium' | 'long' | undefined;
  audience?: string | undefined;
  keywords?: string[] | undefined;
  hashtags?: string[] | undefined;
  mentions?: string[] | undefined;
  includeEmojis?: boolean | undefined;
  includeHashtags?: boolean | undefined;
  includeMentions?: boolean | undefined;
  includeLinks?: boolean | undefined;
  language?: string | undefined;
  model?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  context?: {
    campaignId?: string | undefined;
    previousContent?: string[] | undefined;
    brandGuidelines?: string | undefined;
    targetAudience?: string | undefined;
  } | undefined;
}

export interface ContentGenerationResponse {
  content: {
    title?: string | undefined;
    body: string;
    hashtags: string[];
    mentions: string[];
    suggestedMedia?: string[] | undefined;
  };
  metadata: {
    model: string;
    tokensUsed: number;
    cost: number;
    confidence: number;
    alternatives: number;
  };
  analysis: {
    sentiment: 'positive' | 'negative' | 'neutral';
    readabilityScore: number;
    seoScore: number;
    brandSafety: number;
    engagement: number;
  };
  suggestions: {
    improvements: string[];
    alternatives: string[];
    hashtags: string[];
    mentions: string[];
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

export interface ContentEvent extends BaseEvent {
  userId: string;
  contentId: string;
  data: Record<string, any>;
  metadata?: Record<string, any> | undefined;
}

export enum ContentEventType {
  CONTENT_CREATED = 'content.created',
  CONTENT_UPDATED = 'content.updated',
  CONTENT_PUBLISHED = 'content.published',
  CONTENT_SCHEDULED = 'content.scheduled',
  CONTENT_DELETED = 'content.deleted',
  CONTENT_APPROVED = 'content.approved',
  CONTENT_REJECTED = 'content.rejected',
  MEDIA_UPLOADED = 'media.uploaded',
  MEDIA_PROCESSED = 'media.processed',
  MEDIA_DELETED = 'media.deleted',
  TEMPLATE_CREATED = 'template.created',
  TEMPLATE_USED = 'template.used',
  AI_CONTENT_GENERATED = 'ai.content_generated',
  CONTENT_MODERATED = 'content.moderated',
  CONTENT_ANALYTICS_UPDATED = 'content.analytics_updated'
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
  storage: {
    provider: 'local' | 's3' | 'gcs' | 'azure';
    bucket?: string | undefined;
    region?: string | undefined;
    accessKey?: string | undefined;
    secretKey?: string | undefined;
    endpoint?: string | undefined;
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
    storage: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    totalContent: number;
    totalMedia: number;
    totalTemplates: number;
    processingQueue: number;
  };
}
