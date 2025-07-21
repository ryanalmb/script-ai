/**
 * Enterprise Account Management Service - Type Definitions
 * Comprehensive type system for X/Twitter account management microservice
 */

import { Request } from 'express';

// Import types from Prisma client to ensure consistency
import type { 
  XAccount as PrismaXAccount, 
  XAccountStatus as PrismaXAccountStatus,
  User as PrismaUser,
  UserRole as PrismaUserRole
} from '@prisma/client';

export type XAccount = PrismaXAccount;
export type XAccountStatus = PrismaXAccountStatus;
export type User = PrismaUser;
export type UserRole = PrismaUserRole;
export { XAccountStatus as XAccountStatusEnum } from '@prisma/client';

// ===================================
// ACCOUNT MANAGEMENT TYPES
// ===================================

export interface ConnectAccountRequest {
  userId: string;
  oauthToken: string;
  oauthTokenSecret: string;
  screenName: string;
  displayName?: string | undefined;
  profileImageUrl?: string | undefined;
}

export interface UpdateAccountRequest {
  displayName?: string | undefined;
  profileImageUrl?: string | undefined;
  isActive?: boolean | undefined;
  settings?: AccountSettings | undefined;
}

export interface AccountSettings {
  autoPost: boolean;
  autoLike: boolean;
  autoRetweet: boolean;
  autoFollow: boolean;
  maxPostsPerDay: number;
  maxLikesPerDay: number;
  maxRetweetsPerDay: number;
  maxFollowsPerDay: number;
  workingHours: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
    timezone: string;
  };
  contentFilters: string[];
  blacklistedKeywords: string[];
  whitelistedDomains: string[];
}

export interface AccountHealth {
  accountId: string;
  status: XAccountStatus;
  lastActiveAt: Date;
  rateLimitStatus: {
    remaining: number;
    resetAt: Date;
    limit: number;
  };
  apiErrors: number;
  suspensionRisk: 'low' | 'medium' | 'high' | 'critical';
  complianceScore: number; // 0-100
  performanceMetrics: {
    postsToday: number;
    likesToday: number;
    retweetsToday: number;
    followsToday: number;
    engagementRate: number;
  };
}

export interface OAuthCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

// ===================================
// OAUTH TYPES
// ===================================

export interface OAuthSession {
  sessionId: string;
  userId: string;
  requestToken: string;
  requestTokenSecret: string;
  oauthVerifier?: string | undefined;
  callbackUrl: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface OAuthCallbackRequest {
  oauthToken: string;
  oauthVerifier: string;
  sessionId: string;
}

export interface TwitterUserProfile {
  id: string;
  screenName: string;
  name: string;
  description: string;
  profileImageUrl: string;
  followersCount: number;
  followingCount: number;
  statusesCount: number;
  verified: boolean;
  protected: boolean;
  createdAt: Date;
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

export interface AccountEvent extends BaseEvent {
  userId: string;
  accountId: string;
  data: Record<string, any>;
  metadata?: Record<string, any> | undefined;
}

export enum AccountEventType {
  ACCOUNT_CONNECTED = 'account.connected',
  ACCOUNT_DISCONNECTED = 'account.disconnected',
  ACCOUNT_UPDATED = 'account.updated',
  ACCOUNT_SUSPENDED = 'account.suspended',
  ACCOUNT_REACTIVATED = 'account.reactivated',
  ACCOUNT_HEALTH_CHECK = 'account.health_check',
  ACCOUNT_RATE_LIMITED = 'account.rate_limited',
  ACCOUNT_API_ERROR = 'account.api_error',
  ACCOUNT_COMPLIANCE_VIOLATION = 'account.compliance_violation',
  OAUTH_INITIATED = 'oauth.initiated',
  OAUTH_COMPLETED = 'oauth.completed',
  OAUTH_FAILED = 'oauth.failed'
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
    callbackUrl: string;
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
  };
}

// ===================================
// RATE LIMITING TYPES
// ===================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean | undefined;
  skipFailedRequests?: boolean | undefined;
}

export interface TwitterRateLimit {
  endpoint: string;
  limit: number;
  remaining: number;
  resetAt: Date;
  windowStart: Date;
}

// ===================================
// MONITORING TYPES
// ===================================

export interface AccountMetrics {
  accountId: string;
  timestamp: Date;
  apiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitHits: number;
  averageResponseTime: number;
  errorRate: number;
  complianceScore: number;
  engagementMetrics: {
    posts: number;
    likes: number;
    retweets: number;
    follows: number;
    unfollows: number;
  };
}
