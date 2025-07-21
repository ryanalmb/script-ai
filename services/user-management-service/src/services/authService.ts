/**
 * Enterprise User Management Service - Authentication Service
 * Comprehensive authentication service with JWT, MFA, and enterprise security features
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config, securityConfig } from '@/config';
import { log, createTimer } from '@/utils/logger';
import { eventService } from './eventService';
import { databaseService } from './database';
import {
  User,
  TokenPair,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserRoleEnum,
  UserEventType,
  ChangePasswordRequest
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

class AuthService {
  private get prisma(): PrismaClient {
    return databaseService.getClient();
  }

  /**
   * Register a new user
   */
  async register(
    registerData: RegisterRequest,
    correlationId?: string | undefined
  ): Promise<AuthResponse> {
    const timer = createTimer('auth_register');

    try {
      const { email, username, password, firstName, lastName } = registerData;

      log.info('Starting user registration', {
        operation: 'auth_register',
        correlationId: correlationId || undefined,
        metadata: { email, username }
      });

      // Check if user already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { username }
          ]
        }
      });

      if (existingUser) {
        const field = existingUser.email === email ? 'email' : 'username';
        throw new Error(`User with this ${field} already exists`);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, securityConfig.bcryptRounds);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          id: uuidv4(),
          email,
          username,
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
          role: UserRoleEnum.USER,
          isActive: true,
          mfaEnabled: false,
          mfaBackupCodes: []
        }
      });

      // Generate tokens
      const tokens = await this.generateTokenPair(user.id, correlationId);

      // Create session
      await this.createSession(user.id, tokens.refreshToken, correlationId);

      // Publish user created event
      await eventService.publishUserEvent(
        UserEventType.USER_CREATED,
        user.id,
        {
          email: user.email,
          username: user.username,
          role: user.role,
          registrationMethod: 'email'
        },
        correlationId,
        { firstName, lastName }
      );

      const duration = timer.end();

      log.audit('User registered successfully', {
        correlationId: correlationId || undefined,
        userId: user.id,
        action: 'user_registration',
        resource: 'user',
        duration,
        metadata: { email, username, role: user.role }
      });

      // Remove sensitive data from response
      const { password: _, mfaSecret: __, ...userResponse } = user;

      return {
        user: userResponse,
        tokens
      };

    } catch (error) {
      timer.end();
      log.error('User registration failed', {
        operation: 'auth_register',
        correlationId: correlationId || undefined,
        error: error as Error,
        metadata: { email: registerData.email, username: registerData.username }
      });
      throw error;
    }
  }

  /**
   * Authenticate user login
   */
  async login(
    loginData: LoginRequest,
    ipAddress?: string,
    userAgent?: string,
    correlationId?: string
  ): Promise<AuthResponse> {
    const timer = createTimer('auth_login');

    try {
      const { email, password } = loginData;

      log.info('Starting user login', {
        operation: 'auth_login',
        correlationId,
        metadata: { email, ipAddress }
      });

      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email }
      });

      if (!user || !user.password) {
        throw new Error('Invalid credentials');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // Log security event for failed login
        log.security('Failed login attempt', {
          correlationId,
          userId: user.id,
          severity: 'medium',
          eventType: 'failed_login',
          ipAddress,
          userAgent,
          metadata: { email, reason: 'invalid_password' }
        });
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokens = await this.generateTokenPair(user.id, correlationId);

      // Create session
      await this.createSession(user.id, tokens.refreshToken, correlationId, ipAddress, userAgent);

      // Publish login event
      await eventService.publishUserEvent(
        UserEventType.USER_LOGIN,
        user.id,
        {
          loginMethod: 'password',
          ipAddress,
          userAgent,
          sessionId: tokens.refreshToken // Using refresh token as session identifier
        },
        correlationId
      );

      const duration = timer.end();

      log.audit('User logged in successfully', {
        correlationId,
        userId: user.id,
        action: 'user_login',
        resource: 'session',
        duration,
        metadata: { email, ipAddress, loginMethod: 'password' }
      });

      // Remove sensitive data from response
      const { password: _, mfaSecret: __, ...userResponse } = user;

      return {
        user: userResponse,
        tokens
      };

    } catch (error) {
      timer.end();
      log.error('User login failed', {
        operation: 'auth_login',
        correlationId,
        error: error as Error,
        metadata: { email: loginData.email, ipAddress }
      });
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string,
    correlationId?: string
  ): Promise<TokenPair> {
    const timer = createTimer('auth_refresh_token');

    try {
      log.debug('Refreshing access token', {
        operation: 'auth_refresh_token',
        correlationId
      });

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
      const userId = decoded.userId;

      // Check if session exists and is active
      const session = await this.prisma.userSession.findFirst({
        where: {
          userId,
          refreshToken,
          isActive: true,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (!session) {
        throw new Error('Invalid or expired refresh token');
      }

      // Generate new token pair
      const tokens = await this.generateTokenPair(userId, correlationId);

      // Update session with new refresh token
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { refreshToken: tokens.refreshToken }
      });

      const duration = timer.end();

      log.debug('Access token refreshed successfully', {
        operation: 'auth_refresh_token',
        correlationId,
        userId,
        duration
      });

      return tokens;

    } catch (error) {
      timer.end();
      log.error('Token refresh failed', {
        operation: 'auth_refresh_token',
        correlationId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    changePasswordData: ChangePasswordRequest,
    correlationId?: string
  ): Promise<void> {
    const timer = createTimer('auth_change_password');

    try {
      const { currentPassword, newPassword } = changePasswordData;

      log.info('Starting password change', {
        operation: 'auth_change_password',
        correlationId,
        userId
      });

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.password) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        log.security('Invalid current password during password change', {
          correlationId,
          userId,
          severity: 'medium',
          eventType: 'invalid_password_change',
          metadata: { reason: 'invalid_current_password' }
        });
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, securityConfig.bcryptRounds);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });

      // Invalidate all sessions except current one (optional)
      // await this.invalidateAllSessions(userId, correlationId);

      // Publish password changed event
      await eventService.publishUserEvent(
        UserEventType.USER_PASSWORD_CHANGED,
        userId,
        {
          changedBy: userId,
          securityLevel: 'user'
        },
        correlationId
      );

      const duration = timer.end();

      log.audit('Password changed successfully', {
        correlationId,
        userId,
        action: 'password_change',
        resource: 'user',
        duration
      });

    } catch (error) {
      timer.end();
      log.error('Password change failed', {
        operation: 'auth_change_password',
        correlationId,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Generate JWT token pair
   */
  private async generateTokenPair(userId: string, correlationId?: string | undefined): Promise<TokenPair> {
    try {
      const accessTokenPayload = {
        userId,
        type: 'access',
        correlationId
      };

      const refreshTokenPayload = {
        userId,
        type: 'refresh',
        correlationId
      };

      const accessToken = jwt.sign(
        accessTokenPayload,
        config.jwt.secret as string,
        { expiresIn: config.jwt.accessTokenExpiry } as jwt.SignOptions
      );

      const refreshToken = jwt.sign(
        refreshTokenPayload,
        config.jwt.refreshSecret as string,
        { expiresIn: config.jwt.refreshTokenExpiry } as jwt.SignOptions
      );

      return { accessToken, refreshToken };

    } catch (error) {
      log.error('Failed to generate token pair', {
        operation: 'generate_token_pair',
        correlationId: correlationId || undefined,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Create user session
   */
  private async createSession(
    userId: string,
    refreshToken: string,
    correlationId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Calculate expiry date based on refresh token expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await this.prisma.userSession.create({
        data: {
          id: uuidv4(),
          userId,
          refreshToken,
          expiresAt,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          isActive: true
        }
      });

      log.debug('User session created', {
        operation: 'create_session',
        correlationId,
        userId,
        metadata: { ipAddress, userAgent }
      });

    } catch (error) {
      log.error('Failed to create session', {
        operation: 'create_session',
        correlationId,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<{ userId: string; correlationId?: string }> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      return {
        userId: decoded.userId,
        correlationId: decoded.correlationId
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<Omit<User, 'password' | 'mfaSecret'> | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return null;
      }

      // Remove sensitive data
      const { password, mfaSecret, ...userResponse } = user;
      return userResponse;

    } catch (error) {
      log.error('Failed to get user by ID', {
        operation: 'get_user_by_id',
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllSessions(userId: string, correlationId?: string): Promise<void> {
    try {
      await this.prisma.userSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false }
      });

      log.audit('All user sessions invalidated', {
        correlationId,
        userId,
        action: 'invalidate_sessions',
        resource: 'session'
      });

    } catch (error) {
      log.error('Failed to invalidate sessions', {
        operation: 'invalidate_sessions',
        correlationId,
        userId,
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(
    refreshToken: string,
    correlationId?: string
  ): Promise<void> {
    const timer = createTimer('auth_logout');

    try {
      log.debug('Starting user logout', {
        operation: 'auth_logout',
        correlationId
      });

      // Find and deactivate session
      const session = await this.prisma.userSession.findFirst({
        where: { refreshToken, isActive: true }
      });

      if (session) {
        await this.prisma.userSession.update({
          where: { id: session.id },
          data: { isActive: false }
        });

        // Publish logout event
        await eventService.publishUserEvent(
          UserEventType.USER_LOGOUT,
          session.userId,
          {
            sessionId: session.id,
            logoutType: 'manual'
          },
          correlationId
        );

        const duration = timer.end();

        log.audit('User logged out successfully', {
          correlationId,
          userId: session.userId,
          action: 'user_logout',
          resource: 'session',
          duration,
          metadata: { sessionId: session.id, logoutType: 'manual' }
        });
      } else {
        timer.end();
        log.warn('Logout attempted with invalid session', {
          operation: 'auth_logout',
          correlationId
        });
      }

    } catch (error) {
      timer.end();
      log.error('User logout failed', {
        operation: 'auth_logout',
        correlationId,
        error: error as Error
      });
      throw error;
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();

// Export the class for testing
export { AuthService };
