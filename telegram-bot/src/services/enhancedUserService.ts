import { logger } from '../utils/logger';
import { backendIntegration, UserProfile as BackendUserProfile, AuthTokenRequest } from './backendIntegrationService';
import { UserService as OriginalUserService, User, UserSettings } from './userService';
import { createAuthTokenRequest } from '../utils/userDataUtils';

export interface UserTokens {
  accessToken: string;
  accessTokenSecret: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface EnhancedUserProfile {
  id: string;
  telegramUserId: number;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isAuthenticated: boolean;
  tokens?: UserTokens;
  createdAt: Date;
  updatedAt: Date;
  backendToken?: string;
  backendTokenExpiresAt?: Date;
  role?: string;
  subscription?: {
    plan: string;
    status: string;
    expiresAt?: string;
  };
  settings?: UserSettings;
  lastActivity?: Date;
}

export class EnhancedUserService extends OriginalUserService {
  private enhancedUsers: Map<number, EnhancedUserProfile> = new Map();
  private tokenCache: Map<number, { token: string; expiresAt: Date }> = new Map();

  /**
   * Get enhanced user profile with backend integration
   */
  async getEnhancedUserProfile(telegramUserId: number): Promise<EnhancedUserProfile | null> {
    try {
      // Check local cache first
      let user = this.enhancedUsers.get(telegramUserId);
      
      if (user && this.isTokenValid(user.backendTokenExpiresAt)) {
        logger.debug('Retrieved enhanced user profile from cache', { telegramUserId });
        return user;
      }

      // Try to get from backend
      const backendUser = await backendIntegration.getUserProfile(telegramUserId);
      if (backendUser) {
        // Convert backend user to enhanced format
        user = this.convertBackendUser(backendUser);
        this.enhancedUsers.set(telegramUserId, user);
        logger.debug('Retrieved enhanced user profile from backend', { telegramUserId });
        return user;
      }

      // Fallback to original user service
      const originalUser = await super.getUser(telegramUserId);
      if (originalUser) {
        user = this.convertOriginalUser(originalUser);
        this.enhancedUsers.set(telegramUserId, user);
        logger.debug('Retrieved enhanced user profile from original service', { telegramUserId });
        return user;
      }

      logger.debug('Enhanced user profile not found', { telegramUserId });
      return null;
    } catch (error) {
      logger.error('Failed to get enhanced user profile:', error);
      return null;
    }
  }

  /**
   * Create or update user with backend integration
   */
  async createOrUpdateUser(
    telegramUserId: number,
    userData: {
      username?: string;
      firstName?: string;
      lastName?: string;
      languageCode?: string;
    }
  ): Promise<EnhancedUserProfile | null> {
    try {
      // Get or create backend authentication token
      const authRequest = createAuthTokenRequest(telegramUserId, userData);

      const authResponse = await backendIntegration.getAuthToken(authRequest);
      
      if (!authResponse.success) {
        logger.error('Failed to get backend auth token', { telegramUserId, error: authResponse.error });
        return null;
      }

      // Create enhanced user profile
      const enhancedUser: EnhancedUserProfile = {
        id: authResponse.user?.id || `telegram_${telegramUserId}`,
        telegramUserId,
        ...(userData.username && { username: userData.username }),
        ...(userData.firstName && { firstName: userData.firstName }),
        ...(userData.lastName && { lastName: userData.lastName }),
        ...(authResponse.user?.email && { email: authResponse.user.email }),
        isAuthenticated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(authResponse.token && { backendToken: authResponse.token }),
        ...(authResponse.expiresAt && { backendTokenExpiresAt: new Date(authResponse.expiresAt) }),
        role: authResponse.user?.role || 'user',
        lastActivity: new Date()
      };

      // Store in cache
      this.enhancedUsers.set(telegramUserId, enhancedUser);

      // Also create/update in original service
      await super.createUser(
        telegramUserId,
        userData.username,
        userData.firstName,
        userData.lastName
      );

      logger.info('Created/updated enhanced user profile', { telegramUserId, userId: enhancedUser.id });
      return enhancedUser;
    } catch (error) {
      logger.error('Failed to create/update enhanced user:', error);
      return null;
    }
  }

  /**
   * Store user authentication tokens
   */
  override async storeUserTokens(telegramUserId: number, tokens: any): Promise<void> {
    try {
      const user = await this.getEnhancedUserProfile(telegramUserId);
      if (!user) {
        logger.error('User not found for token storage', { telegramUserId });
        return;
      }

      // Store in backend
      const backendSuccess = await backendIntegration.storeUserTokens(
        telegramUserId,
        tokens,
        user.backendToken
      );

      if (!backendSuccess) {
        logger.warn('Failed to store tokens in backend, storing locally only', { telegramUserId });
      }

      // Update local cache
      user.tokens = tokens;
      user.isAuthenticated = true;
      user.updatedAt = new Date();
      this.enhancedUsers.set(telegramUserId, user);

      logger.info('Stored user tokens', { telegramUserId, backendSuccess });
    } catch (error) {
      logger.error('Failed to store user tokens:', error);
    }
  }

  /**
   * Update user activity
   */
  async updateUserActivity(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const user = await this.getEnhancedUserProfile(telegramUserId);
      if (!user) {
        logger.warn('User not found for activity update', { telegramUserId });
        return;
      }

      // Log to backend
      await backendIntegration.logActivity(
        telegramUserId,
        action,
        metadata,
        user.backendToken
      );

      // Update local cache
      user.lastActivity = new Date();
      this.enhancedUsers.set(telegramUserId, user);
    } catch (error) {
      logger.error('Failed to update user activity:', error);
    }
  }

  /**
   * Get user's backend authentication token
   */
  async getBackendToken(telegramUserId: number): Promise<string | null> {
    try {
      const cached = this.tokenCache.get(telegramUserId);
      if (cached && this.isTokenValid(cached.expiresAt)) {
        return cached.token;
      }

      const user = await this.getEnhancedUserProfile(telegramUserId);
      if (!user?.backendToken || !this.isTokenValid(user.backendTokenExpiresAt)) {
        // Try to refresh token
        const refreshUserData: {
          username?: string;
          firstName?: string;
          lastName?: string;
        } = {};
        if (user?.username) refreshUserData.username = user.username;
        if (user?.firstName) refreshUserData.firstName = user.firstName;
        if (user?.lastName) refreshUserData.lastName = user.lastName;

        const authRequest = createAuthTokenRequest(telegramUserId, refreshUserData);
        const authResponse = await backendIntegration.getAuthToken(authRequest);

        if (authResponse.success && authResponse.token) {
          // Update cache
          if (user && authResponse.token) {
            const updatedUser: EnhancedUserProfile = {
              ...user,
              backendToken: authResponse.token,
              ...(authResponse.expiresAt && { backendTokenExpiresAt: new Date(authResponse.expiresAt) })
            };
            this.enhancedUsers.set(telegramUserId, updatedUser);
          }

          if (authResponse.expiresAt) {
            this.tokenCache.set(telegramUserId, {
              token: authResponse.token,
              expiresAt: new Date(authResponse.expiresAt)
            });
          }

          return authResponse.token;
        }

        return null;
      }

      return user.backendToken;
    } catch (error) {
      logger.error('Failed to get backend token:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated with X/Twitter
   */
  async isUserAuthenticated(telegramUserId: number): Promise<boolean> {
    try {
      const user = await this.getEnhancedUserProfile(telegramUserId);
      return !!(user?.isAuthenticated && user.tokens);
    } catch (error) {
      logger.error('Failed to check user authentication:', error);
      return false;
    }
  }

  /**
   * Get user subscription info
   */
  async getUserSubscription(telegramUserId: number): Promise<any> {
    try {
      const user = await this.getEnhancedUserProfile(telegramUserId);
      return user?.subscription || { plan: 'free', status: 'active' };
    } catch (error) {
      logger.error('Failed to get user subscription:', error);
      return { plan: 'free', status: 'active' };
    }
  }

  /**
   * Convert backend user to enhanced user format
   */
  private convertBackendUser(backendUser: BackendUserProfile): EnhancedUserProfile {
    return {
      id: backendUser.id,
      telegramUserId: backendUser.telegramUserId,
      ...(backendUser.username && { username: backendUser.username }),
      ...(backendUser.email && { email: backendUser.email }),
      ...(backendUser.firstName && { firstName: backendUser.firstName }),
      ...(backendUser.lastName && { lastName: backendUser.lastName }),
      isAuthenticated: false, // Will be updated when tokens are stored
      createdAt: new Date(backendUser.createdAt),
      updatedAt: new Date(backendUser.updatedAt),
      role: backendUser.role || 'user',
      ...(backendUser.subscription && { subscription: backendUser.subscription })
    };
  }

  /**
   * Convert original user to enhanced user format
   */
  private convertOriginalUser(originalUser: User): EnhancedUserProfile {
    return {
      id: `local_${originalUser.id}`,
      telegramUserId: originalUser.id,
      ...(originalUser.username && { username: originalUser.username }),
      ...(originalUser.firstName && { firstName: originalUser.firstName }),
      ...(originalUser.lastName && { lastName: originalUser.lastName }),
      isAuthenticated: false,
      createdAt: originalUser.createdAt,
      updatedAt: new Date(),
      settings: originalUser.settings,
      lastActivity: originalUser.lastActivity
    };
  }

  /**
   * Check if token is still valid
   */
  private isTokenValid(expiresAt?: Date): boolean {
    if (!expiresAt) return false;
    return expiresAt.getTime() > Date.now();
  }

  /**
   * Clear user cache
   */
  clearUserCache(telegramUserId: number): void {
    this.enhancedUsers.delete(telegramUserId);
    this.tokenCache.delete(telegramUserId);
  }

  /**
   * Get backend integration health status
   */
  getBackendHealthStatus(): boolean {
    return backendIntegration.getHealthStatus();
  }
}

// Export singleton instance
export const enhancedUserService = new EnhancedUserService();
