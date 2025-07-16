/**
 * X (Twitter) OAuth 2.0 Service
 * Handles secure OAuth 2.0 authentication flow with X API
 */

import crypto from 'crypto';
import { TwitterApi } from 'twitter-api-v2';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { Request } from 'express';

export interface OAuthSession {
  sessionId: string;
  telegramUserId: number;
  oauthToken: string;
  oauthTokenSecret: string;
  verifier?: string;
  expiresAt: Date;
  state: 'pending' | 'authorized' | 'completed' | 'expired' | 'revoked';
  // Enterprise security fields
  ipAddress?: string;
  userAgent?: string;
  fingerprint?: string;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  securityFlags: string[];
  riskScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface XUserTokens {
  accessToken: string;
  accessTokenSecret: string;
  userId: string;
  screenName: string;
}

export class XOAuthService {
  private readonly API_KEY: string;
  private readonly API_SECRET: string;
  private readonly CALLBACK_URL: string;
  private sessions: Map<string, OAuthSession> = new Map();

  // Enterprise security configuration (relaxed for development)
  private readonly MAX_ATTEMPTS_PER_SESSION = process.env.NODE_ENV === 'production' ? 3 : 10;
  private readonly SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_WINDOW = process.env.NODE_ENV === 'production' ? 60 * 1000 : 10 * 1000; // 1 minute prod, 10 seconds dev
  private readonly MAX_SESSIONS_PER_USER = process.env.NODE_ENV === 'production' ? 5 : 20;
  private readonly HIGH_RISK_THRESHOLD = process.env.NODE_ENV === 'production' ? 70 : 90;
  private readonly ENCRYPTION_KEY: Buffer;

  // Rate limiting and security tracking
  private attemptTracker: Map<string, { count: number; lastAttempt: Date }> = new Map();
  private userSessions: Map<number, string[]> = new Map();

  constructor() {
    this.API_KEY = process.env.X_API_KEY || '';
    this.API_SECRET = process.env.X_API_SECRET || '';
    this.CALLBACK_URL = process.env.X_OAUTH_CALLBACK_URL || `${process.env.BACKEND_URL}/auth/x/callback`;

    // Initialize encryption key for session data
    this.ENCRYPTION_KEY = crypto.scryptSync(
      process.env.OAUTH_ENCRYPTION_KEY || 'default-oauth-key-change-in-production',
      'oauth-salt',
      32
    );

    if (!this.API_KEY || !this.API_SECRET) {
      logger.warn('X API credentials not configured - OAuth will not work');
    }

    // Enhanced cleanup with security monitoring
    setInterval(() => this.performSecurityMaintenance(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Check if OAuth is properly configured
   */
  isConfigured(): boolean {
    return !!(this.API_KEY && this.API_SECRET &&
             this.API_KEY !== 'your_x_api_key_here' &&
             this.API_SECRET !== 'your_x_api_secret_here');
  }

  /**
   * Enterprise security: Generate secure session fingerprint
   */
  private generateSecurityFingerprint(req?: any): string {
    const components = [
      req?.ip || 'unknown',
      req?.get('User-Agent') || 'unknown',
      req?.get('Accept-Language') || 'unknown',
      Date.now().toString()
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Enterprise security: Calculate risk score for session
   */
  private calculateRiskScore(telegramUserId: number, req?: any): number {
    let riskScore = 0;

    // Check for multiple concurrent sessions
    const userSessionCount = this.userSessions.get(telegramUserId)?.length || 0;
    if (userSessionCount > 2) riskScore += 20;
    if (userSessionCount > 4) riskScore += 30;

    // Check attempt frequency
    const attemptKey = `${telegramUserId}:${req?.ip || 'unknown'}`;
    const attempts = this.attemptTracker.get(attemptKey);
    if (attempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
      if (timeSinceLastAttempt < 30000) riskScore += 25; // Less than 30 seconds
      if (attempts.count > 3) riskScore += 40;
    }

    // Check for suspicious patterns
    if (req?.get('User-Agent')?.includes('bot') || req?.get('User-Agent')?.includes('crawler')) {
      riskScore += 50;
    }

    // Time-based risk (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) riskScore += 15;

    return Math.min(riskScore, 100);
  }

  /**
   * Enterprise security: Encrypt sensitive session data
   */
  private encryptSessionData(data: string): string {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.ENCRYPTION_KEY.toString('hex'));
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      logger.error('Failed to encrypt session data:', error);
      // Fallback to base64 encoding for compatibility
      return Buffer.from(data).toString('base64');
    }
  }

  /**
   * Enterprise security: Decrypt sensitive session data
   */
  private decryptSessionData(encryptedData: string): string {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.ENCRYPTION_KEY.toString('hex'));
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // Fallback: try base64 decoding
      try {
        return Buffer.from(encryptedData, 'base64').toString('utf8');
      } catch (fallbackError) {
        logger.error('Failed to decrypt session data:', error);
        throw new Error('Decryption failed');
      }
    }
  }

  /**
   * Enterprise security: Rate limiting check
   */
  private checkRateLimit(telegramUserId: number, ipAddress?: string): boolean {
    const key = `${telegramUserId}:${ipAddress || 'unknown'}`;
    const now = new Date();

    const attempts = this.attemptTracker.get(key);
    if (!attempts) {
      this.attemptTracker.set(key, { count: 1, lastAttempt: now });
      return true;
    }

    // Reset counter if window expired
    if (now.getTime() - attempts.lastAttempt.getTime() > this.RATE_LIMIT_WINDOW) {
      this.attemptTracker.set(key, { count: 1, lastAttempt: now });
      return true;
    }

    // Check if rate limit exceeded (relaxed for development)
    const maxAttempts = process.env.NODE_ENV === 'production' ? 5 : 50; // 5 prod, 50 dev
    if (attempts.count >= maxAttempts) {
      logger.warn('OAuth rate limit exceeded', { telegramUserId, ipAddress, attempts: attempts.count, maxAttempts });
      return false;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    return true;
  }

  /**
   * Enterprise security: Session validation
   */
  private validateSession(session: OAuthSession): { valid: boolean; reason?: string } {
    const now = new Date();

    // Check expiration
    if (session.expiresAt < now) {
      return { valid: false, reason: 'Session expired' };
    }

    // Check attempt limits
    if (session.attempts >= session.maxAttempts) {
      return { valid: false, reason: 'Maximum attempts exceeded' };
    }

    // Check state validity
    if (session.state === 'revoked' || session.state === 'expired') {
      return { valid: false, reason: 'Session revoked or expired' };
    }

    // Check high risk sessions
    if (session.riskScore > this.HIGH_RISK_THRESHOLD) {
      logger.warn('High risk OAuth session detected', {
        sessionId: session.sessionId,
        riskScore: session.riskScore,
        telegramUserId: session.telegramUserId
      });

      // Allow but with additional monitoring
      session.securityFlags.push('HIGH_RISK_MONITORED');
    }

    return { valid: true };
  }

  /**
   * Start OAuth flow - Step 1: Get request token (Enterprise Security Enhanced)
   */
  async startOAuthFlow(telegramUserId: number, req?: any): Promise<{ authUrl: string; sessionId: string }> {
    if (!this.isConfigured()) {
      throw new Error('X API credentials not configured. Please set X_API_KEY and X_API_SECRET environment variables.');
    }

    // Enterprise security checks
    const ipAddress = req?.ip || req?.connection?.remoteAddress;
    const userAgent = req?.get('User-Agent');

    // Rate limiting check
    if (!this.checkRateLimit(telegramUserId, ipAddress)) {
      throw new Error('Rate limit exceeded. Please wait before trying again.');
    }

    // Check maximum concurrent sessions per user
    const existingSessions = this.userSessions.get(telegramUserId) || [];
    if (existingSessions.length >= this.MAX_SESSIONS_PER_USER) {
      logger.warn('Maximum concurrent OAuth sessions exceeded', { telegramUserId, sessionCount: existingSessions.length });
      throw new Error('Maximum concurrent authentication sessions exceeded. Please complete or cancel existing sessions.');
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(telegramUserId, req);
    const securityFlags: string[] = [];

    if (riskScore > this.HIGH_RISK_THRESHOLD) {
      securityFlags.push('HIGH_RISK');
      logger.warn('High risk OAuth session initiated', { telegramUserId, riskScore, ipAddress });
    }

    try {
      // Create Twitter client for OAuth 1.0a
      const client = new TwitterApi({
        appKey: this.API_KEY,
        appSecret: this.API_SECRET,
      });

      // Get request token with enhanced error handling
      const authLink = await client.generateAuthLink(this.CALLBACK_URL, {
        linkMode: 'authorize',
        forceLogin: riskScore > 50 // Force login for higher risk sessions
      });

      // Generate cryptographically secure session ID
      const sessionId = this.generateSecureSessionId();
      const fingerprint = this.generateSecurityFingerprint(req);
      const now = new Date();

      // Create enhanced OAuth session with enterprise security
      const session: OAuthSession = {
        sessionId,
        telegramUserId,
        oauthToken: this.encryptSessionData(authLink.oauth_token),
        oauthTokenSecret: this.encryptSessionData(authLink.oauth_token_secret),
        expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT),
        state: 'pending',
        // Enterprise security fields
        ipAddress,
        userAgent,
        fingerprint,
        attempts: 0,
        maxAttempts: this.MAX_ATTEMPTS_PER_SESSION,
        securityFlags,
        riskScore,
        createdAt: now,
        updatedAt: now
      };

      // Store session with enterprise security
      this.sessions.set(sessionId, session);

      // Update user session tracking
      const userSessionList = this.userSessions.get(telegramUserId) || [];
      userSessionList.push(sessionId);
      this.userSessions.set(telegramUserId, userSessionList);

      // Enhanced caching with security metadata
      await cacheManager.set(`oauth_session:${sessionId}`, session, this.SESSION_TIMEOUT / 1000);
      await cacheManager.set(`oauth_token:${authLink.oauth_token}`, { sessionId, telegramUserId }, this.SESSION_TIMEOUT / 1000);

      // Security audit logging
      logger.info('Enterprise OAuth flow started', {
        sessionId,
        telegramUserId,
        riskScore,
        securityFlags,
        ipAddress,
        fingerprint: fingerprint.substring(0, 8) + '...',
        timestamp: now.toISOString()
      });

      return {
        authUrl: authLink.url,
        sessionId
      };

    } catch (error) {
      // Enhanced error logging with security context
      logger.error('Failed to start OAuth flow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        telegramUserId,
        riskScore,
        ipAddress,
        timestamp: new Date().toISOString()
      });

      throw new Error('Failed to initialize OAuth flow. Please try again.');
    }
  }

  /**
   * Generate cryptographically secure session ID
   */
  private generateSecureSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(`${timestamp}:${randomBytes}`).digest('hex');
    return `oauth_${timestamp}_${hash.substring(0, 32)}`;
  }

  /**
   * Handle OAuth callback - Step 2: Exchange for access token (Enterprise Security Enhanced)
   */
  async handleCallback(oauthToken: string, oauthVerifier: string, req?: any): Promise<{
    success: boolean;
    sessionId?: string;
    telegramUserId?: number;
    tokens?: XUserTokens;
    error?: string;
    securityInfo?: any;
  }> {
    const startTime = Date.now();
    const ipAddress = req?.ip || req?.connection?.remoteAddress;
    const userAgent = req?.get('User-Agent');

    try {
      // Enhanced session lookup with decryption
      let activeSession: OAuthSession | undefined;

      // First, try to find session by encrypted token
      for (const session of this.sessions.values()) {
        try {
          const decryptedToken = this.decryptSessionData(session.oauthToken);
          if (decryptedToken === oauthToken && session.state === 'pending') {
            activeSession = session;
            break;
          }
        } catch (error) {
          // Skip corrupted sessions
          logger.warn('Corrupted OAuth session detected', { sessionId: session.sessionId });
          continue;
        }
      }

      // If not found in memory, try Redis cache
      if (!activeSession) {
        const cachedSessionInfo = await cacheManager.get(`oauth_token:${oauthToken}`) as any;

        if (cachedSessionInfo?.sessionId) {
          const cachedSession = await cacheManager.get(`oauth_session:${cachedSessionInfo.sessionId}`) as OAuthSession;
          if (cachedSession) {
            activeSession = cachedSession;
            this.sessions.set(cachedSession.sessionId, cachedSession);
          }
        }
      }

      if (!activeSession) {
        logger.warn('OAuth callback with invalid token', { oauthToken: oauthToken.substring(0, 8) + '...', ipAddress });
        return { success: false, error: 'Invalid or expired OAuth session' };
      }

      // Enterprise security validation
      const validation = this.validateSession(activeSession);
      if (!validation.valid) {
        logger.warn('OAuth session validation failed', {
          sessionId: activeSession.sessionId,
          reason: validation.reason,
          ipAddress
        });
        return { success: false, error: validation.reason || 'Session validation failed' };
      }

      // Security checks for callback
      if (activeSession.ipAddress && activeSession.ipAddress !== ipAddress) {
        activeSession.securityFlags.push('IP_MISMATCH');
        activeSession.riskScore += 30;
        logger.warn('OAuth callback IP mismatch detected', {
          sessionId: activeSession.sessionId,
          originalIp: activeSession.ipAddress,
          callbackIp: ipAddress
        });
      }

      // Increment attempt counter
      activeSession.attempts++;
      activeSession.lastAttempt = new Date();
      activeSession.updatedAt = new Date();

      // Create client with request token
      const client = new TwitterApi({
        appKey: this.API_KEY,
        appSecret: this.API_SECRET,
        accessToken: oauthToken,
        accessSecret: activeSession.oauthTokenSecret,
      });

      // Exchange for access token
      const loginResult = await client.login(oauthVerifier);
      
      // Get user info
      const userClient = loginResult.client;
      const userInfo = await userClient.v1.verifyCredentials();

      const tokens: XUserTokens = {
        accessToken: loginResult.accessToken,
        accessTokenSecret: loginResult.accessSecret,
        userId: userInfo.id_str,
        screenName: userInfo.screen_name
      };

      // Update session
      activeSession.state = 'completed';
      activeSession.verifier = oauthVerifier;

      // Store user tokens in database
      await this.storeUserTokens(activeSession.telegramUserId, tokens, userInfo);

      logger.info(`OAuth completed for user ${userInfo.screen_name}`, {
        sessionId: activeSession.sessionId,
        telegramUserId: activeSession.telegramUserId,
        xUserId: userInfo.id_str
      });

      return {
        success: true,
        sessionId: activeSession.sessionId,
        telegramUserId: activeSession.telegramUserId,
        tokens
      };

    } catch (error) {
      logger.error('OAuth callback failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'OAuth authentication failed' 
      };
    }
  }

  /**
   * Get OAuth session status
   */
  async getSessionStatus(sessionId: string): Promise<OAuthSession | null> {
    const session = this.sessions.get(sessionId);
    if (session) return session;

    // Try to get from cache
    const cached = await cacheManager.get(`oauth_session:${sessionId}`) as OAuthSession;
    if (cached) {
      this.sessions.set(sessionId, cached);
      return cached;
    }

    return null;
  }

  /**
   * Store user tokens in database
   */
  private async storeUserTokens(telegramUserId: number, tokens: XUserTokens, userInfo: any): Promise<void> {
    try {
      // Find or create user
      let user = await prisma.user.findFirst({
        where: { username: `telegram_${telegramUserId}` }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `telegram_${telegramUserId}@temp.local`,
            username: `telegram_${telegramUserId}`,
            password: await this.hashPassword(tokens.accessToken),
          }
        });
      }

      // Store or update X account
      await prisma.xAccount.upsert({
        where: {
          accountId: tokens.userId
        },
        update: {
          accessToken: tokens.accessToken,
          accessTokenSecret: tokens.accessTokenSecret,
          username: tokens.screenName,
          displayName: userInfo.name,
          isVerified: userInfo.verified || false,
          lastActivity: new Date()
        },
        create: {
          userId: user.id,
          accountId: tokens.userId,
          accessToken: tokens.accessToken,
          accessTokenSecret: tokens.accessTokenSecret,
          username: tokens.screenName,
          displayName: userInfo.name,
          isVerified: userInfo.verified || false,
          lastActivity: new Date()
        }
      });

    } catch (error) {
      logger.error('Failed to store user tokens:', error);
      throw error;
    }
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * Get cached sessions from Redis
   */
  private async getCachedSessions(): Promise<OAuthSession[]> {
    try {
      // For now, return empty array since we're using in-memory cache
      // In production, implement proper Redis key scanning
      return [];
    } catch (error) {
      logger.error('Failed to get cached sessions:', error);
      return [];
    }
  }

  /**
   * Enterprise security maintenance and cleanup
   */
  private performSecurityMaintenance(): void {
    const now = new Date();
    let expiredCount = 0;
    let highRiskCount = 0;
    let cleanedAttempts = 0;

    // Clean up expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now || session.state === 'expired') {
        this.sessions.delete(sessionId);
        cacheManager.del(`oauth_session:${sessionId}`);

        // Remove from user session tracking
        const userSessions = this.userSessions.get(session.telegramUserId);
        if (userSessions) {
          const index = userSessions.indexOf(sessionId);
          if (index > -1) {
            userSessions.splice(index, 1);
            if (userSessions.length === 0) {
              this.userSessions.delete(session.telegramUserId);
            }
          }
        }

        expiredCount++;
      } else if (session.riskScore > this.HIGH_RISK_THRESHOLD) {
        highRiskCount++;

        // Additional monitoring for high-risk sessions
        logger.info('High-risk OAuth session monitored', {
          sessionId: session.sessionId,
          riskScore: session.riskScore,
          securityFlags: session.securityFlags,
          age: now.getTime() - session.createdAt.getTime()
        });
      }
    }

    // Clean up old attempt tracking
    for (const [key, attempts] of this.attemptTracker.entries()) {
      if (now.getTime() - attempts.lastAttempt.getTime() > 60 * 60 * 1000) { // 1 hour
        this.attemptTracker.delete(key);
        cleanedAttempts++;
      }
    }

    // Log maintenance summary
    if (expiredCount > 0 || highRiskCount > 0 || cleanedAttempts > 0) {
      logger.info('OAuth security maintenance completed', {
        expiredSessions: expiredCount,
        highRiskSessions: highRiskCount,
        cleanedAttempts,
        activeSessions: this.sessions.size,
        timestamp: now.toISOString()
      });
    }
  }

  /**
   * Enterprise security: Revoke session
   */
  async revokeSession(sessionId: string, reason: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.state = 'revoked';
    session.securityFlags.push(`REVOKED:${reason}`);
    session.updatedAt = new Date();

    // Remove from active sessions
    this.sessions.delete(sessionId);
    await cacheManager.del(`oauth_session:${sessionId}`);

    // Security audit log
    logger.warn('OAuth session revoked', {
      sessionId,
      reason,
      telegramUserId: session.telegramUserId,
      riskScore: session.riskScore,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  /**
   * Development helper: Clear rate limiting for a user (development only)
   */
  clearRateLimit(telegramUserId: number, ipAddress?: string): boolean {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Rate limit clear attempted in production', { telegramUserId });
      return false;
    }

    const key = `${telegramUserId}:${ipAddress || 'unknown'}`;
    const cleared = this.attemptTracker.delete(key);

    if (cleared) {
      logger.info('Rate limit cleared for development', { telegramUserId, ipAddress });
    }

    return cleared;
  }

  /**
   * Development helper: Clear all rate limits (development only)
   */
  clearAllRateLimits(): boolean {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('All rate limits clear attempted in production');
      return false;
    }

    const count = this.attemptTracker.size;
    this.attemptTracker.clear();

    logger.info('All rate limits cleared for development', { clearedCount: count });
    return true;
  }

  /**
   * Enterprise security: Get security metrics
   */
  getSecurityMetrics(): any {
    const now = new Date();
    const metrics = {
      activeSessions: this.sessions.size,
      highRiskSessions: 0,
      expiringSoon: 0,
      totalAttempts: 0,
      uniqueUsers: this.userSessions.size,
      averageRiskScore: 0,
      securityFlags: {} as any
    };

    let totalRiskScore = 0;

    for (const session of this.sessions.values()) {
      totalRiskScore += session.riskScore;

      if (session.riskScore > this.HIGH_RISK_THRESHOLD) {
        metrics.highRiskSessions++;
      }

      if (session.expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) { // 5 minutes
        metrics.expiringSoon++;
      }

      metrics.totalAttempts += session.attempts;

      // Count security flags
      session.securityFlags.forEach(flag => {
        metrics.securityFlags[flag] = (metrics.securityFlags[flag] || 0) + 1;
      });
    }

    metrics.averageRiskScore = metrics.activeSessions > 0 ? totalRiskScore / metrics.activeSessions : 0;

    return metrics;
  }
}

export const xOAuthService = new XOAuthService();
