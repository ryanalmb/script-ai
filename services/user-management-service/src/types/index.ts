/**
 * Enterprise User Management Service - Type Definitions
 * Comprehensive type system for user management microservice
 */

import { Request } from 'express';

// ===================================
// USER TYPES
// ===================================

// Import types from Prisma client to ensure consistency
import type { User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';

export type User = PrismaUser;
export type UserRole = PrismaUserRole;
export { UserRole as UserRoleEnum } from '@prisma/client';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
  };
  correlationId?: string;
}

// ===================================
// AUTHENTICATION TYPES
// ===================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'password' | 'mfaSecret'>;
  tokens: TokenPair;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ===================================
// SESSION TYPES
// ===================================

export interface UserSession {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

// ===================================
// MFA TYPES
// ===================================

export interface MfaSetupRequest {
  secret: string;
  token: string;
}

export interface MfaVerifyRequest {
  token: string;
}

export interface MfaBackupCode {
  code: string;
  used: boolean;
  usedAt?: Date;
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

export interface UserEvent extends BaseEvent {
  userId: string;
  data: Record<string, any>;
  metadata?: Record<string, any> | undefined;
}

export enum UserEventType {
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_ACTIVATED = 'user.activated',
  USER_DEACTIVATED = 'user.deactivated',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_PASSWORD_CHANGED = 'user.password_changed',
  USER_MFA_ENABLED = 'user.mfa_enabled',
  USER_MFA_DISABLED = 'user.mfa_disabled',
  USER_TELEGRAM_LINKED = 'user.telegram_linked',
  USER_OAUTH_CONNECTED = 'user.oauth_connected',
  USER_SECURITY_VIOLATION = 'user.security_violation'
}

// ===================================
// INTEGRATION TYPES
// ===================================

export interface TelegramAuthRequest {
  telegramId: string;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  authToken: string;
}

export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthSession {
  sessionId: string;
  userId: string;
  provider: string;
  state: string;
  codeVerifier?: string;
  expiresAt: Date;
}

// ===================================
// SECURITY TYPES
// ===================================

export interface SecurityEvent {
  id: string;
  userId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// ===================================
// SERVICE TYPES
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
  jwt: {
    secret: string;
    refreshSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
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
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

// ===================================
// API RESPONSE TYPES
// ===================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
  correlationId?: string;
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
  errors?: ValidationError[];
  stack?: string;
}
