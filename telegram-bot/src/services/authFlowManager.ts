import { logger } from '../utils/logger';
import { authStateService, AuthStep, AuthMethod, AuthState } from './authStateService';
import { UserService } from './userService';
import TelegramBot from 'node-telegram-bot-api';

export interface AuthenticationStrategy {
  name: string;
  description: string;
  securityLevel: 'basic' | 'standard' | 'enhanced' | 'enterprise';
  requirements: string[];
  steps: AuthStep[];
  estimatedTime: string;
  supportedFeatures: string[];
}

export interface AuthenticationResult {
  success: boolean;
  tokens?: {
    accessToken: string;
    accessTokenSecret: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
  userInfo?: {
    id: string;
    username: string;
    displayName: string;
    profileImage?: string;
    verified: boolean;
    followerCount?: number;
    followingCount?: number;
  };
  permissions?: string[];
  error?: string;
  requiresTwoFactor?: boolean;
  twoFactorMethods?: string[];
}

export interface AuthenticationContext {
  userId: number;
  chatId: number;
  strategy: AuthenticationStrategy;
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  securityFlags: string[];
  metadata: Record<string, any>;
}

export class AuthFlowManager {
  private userService: UserService;
  private activeContexts: Map<number, AuthenticationContext> = new Map();
  private readonly SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private attemptTracker: Map<number, { count: number; lastAttempt: Date }> = new Map();

  constructor() {
    this.userService = new UserService();
    
    // Cleanup expired contexts every 5 minutes
    setInterval(() => this.cleanupExpiredContexts(), 5 * 60 * 1000);
  }

  /**
   * Get a specific authentication strategy by name
   */
  getStrategy(name: string): AuthenticationStrategy | null {
    const strategies = this.getAvailableStrategies();
    return strategies.find(s => s.name === name) || null;
  }

  /**
   * Get available authentication strategies
   */
  getAvailableStrategies(): AuthenticationStrategy[] {
    return [
      {
        name: 'native_credentials',
        description: '🚀 Quick Setup - Username & Password',
        securityLevel: 'standard',
        requirements: ['X username or email', 'X password'],
        steps: [AuthStep.ENTER_USERNAME, AuthStep.ENTER_PASSWORD],
        estimatedTime: '2-3 minutes',
        supportedFeatures: [
          'Basic posting and engagement',
          'Content generation',
          'Basic analytics',
          'Automation (limited)',
          'Rate limit protection'
        ]
      },
      {
        name: 'native_api_keys',
        description: '🔑 API Keys - Full Control',
        securityLevel: 'enhanced',
        requirements: [
          'X API Key (Consumer Key)',
          'X API Secret (Consumer Secret)', 
          'X Access Token',
          'X Access Token Secret'
        ],
        steps: [
          AuthStep.ENTER_API_KEY,
          AuthStep.ENTER_API_SECRET,
          AuthStep.ENTER_ACCESS_TOKEN,
          AuthStep.ENTER_ACCESS_SECRET
        ],
        estimatedTime: '3-5 minutes',
        supportedFeatures: [
          'Full API access',
          'Advanced automation',
          'Real-time streaming',
          'Advanced analytics',
          'Custom rate limits',
          'Webhook support',
          'Enterprise features'
        ]
      },
      {
        name: 'oauth_flow',
        description: '🔒 Secure Portal - OAuth 2.0',
        securityLevel: 'enterprise',
        requirements: ['Web browser access', 'X account'],
        steps: [AuthStep.PROCESSING],
        estimatedTime: '1-2 minutes',
        supportedFeatures: [
          'Maximum security',
          'Granular permissions',
          'Token refresh',
          'Audit logging',
          'Compliance features',
          'SSO integration',
          'Enterprise security'
        ]
      }
    ];
  }

  /**
   * Start authentication flow with comprehensive context
   */
  async startAuthenticationFlow(
    userId: number,
    chatId: number,
    strategyName: string,
    metadata: Record<string, any> = {}
  ): Promise<AuthenticationContext> {
    // Check rate limiting
    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please wait before trying again.');
    }

    // Find strategy
    const strategy = this.getAvailableStrategies().find(s => s.name === strategyName);
    if (!strategy) {
      throw new Error(`Unknown authentication strategy: ${strategyName}`);
    }

    // Create authentication context
    const context: AuthenticationContext = {
      userId,
      chatId,
      strategy,
      sessionId: this.generateSecureSessionId(),
      startTime: new Date(),
      lastActivity: new Date(),
      securityFlags: this.generateSecurityFlags(strategy),
      metadata: {
        ...metadata,
        userAgent: 'Telegram Bot',
        platform: 'telegram',
        version: '1.0.0'
      }
    };

    // Store context
    this.activeContexts.set(userId, context);

    // Initialize auth state service
    const authMethod = this.mapStrategyToAuthMethod(strategyName);
    authStateService.startAuth(userId, authMethod);

    logger.info('Started authentication flow', {
      userId,
      strategy: strategyName,
      sessionId: context.sessionId,
      securityLevel: strategy.securityLevel
    });

    return context;
  }

  /**
   * Process authentication step with comprehensive validation
   */
  async processAuthenticationStep(
    userId: number,
    step: AuthStep,
    data: any,
    securityContext: Record<string, any> = {}
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string; requiresAction?: string }> {
    const context = this.activeContexts.get(userId);
    if (!context) {
      throw new Error('No active authentication context found');
    }

    // Update activity
    context.lastActivity = new Date();

    // Validate step progression
    if (!this.validateStepProgression(context, step)) {
      throw new Error('Invalid authentication step progression');
    }

    // Process based on step
    switch (step) {
      case AuthStep.ENTER_USERNAME:
        return this.processUsernameStep(context, data, securityContext);
      
      case AuthStep.ENTER_PASSWORD:
        return this.processPasswordStep(context, data, securityContext);
      
      case AuthStep.ENTER_2FA:
        return this.process2FAStep(context, data, securityContext);
      
      case AuthStep.ENTER_API_KEY:
        return this.processApiKeyStep(context, data, securityContext);
      
      case AuthStep.ENTER_API_SECRET:
        return this.processApiSecretStep(context, data, securityContext);
      
      case AuthStep.ENTER_ACCESS_TOKEN:
        return this.processAccessTokenStep(context, data, securityContext);
      
      case AuthStep.ENTER_ACCESS_SECRET:
        return this.processAccessSecretStep(context, data, securityContext);
      
      case AuthStep.PROCESSING:
        return this.processAuthenticationFinalization(context);
      
      default:
        throw new Error(`Unsupported authentication step: ${step}`);
    }
  }

  /**
   * Get authentication context
   */
  getAuthenticationContext(userId: number): AuthenticationContext | null {
    const context = this.activeContexts.get(userId);
    if (!context) return null;

    // Check if context has expired
    if (Date.now() - context.lastActivity.getTime() > this.SESSION_TIMEOUT) {
      this.clearAuthenticationContext(userId);
      return null;
    }

    return context;
  }

  /**
   * Clear authentication context
   */
  clearAuthenticationContext(userId: number): void {
    this.activeContexts.delete(userId);
    authStateService.clearAuthState(userId);
    logger.info('Cleared authentication context', { userId });
  }

  /**
   * Generate comprehensive security assessment
   */
  generateSecurityAssessment(context: AuthenticationContext): {
    score: number;
    level: string;
    recommendations: string[];
    warnings: string[];
  } {
    let score = 50; // Base score
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Strategy-based scoring
    switch (context.strategy.securityLevel) {
      case 'enterprise':
        score += 30;
        break;
      case 'enhanced':
        score += 20;
        break;
      case 'standard':
        score += 10;
        break;
      case 'basic':
        warnings.push('Consider upgrading to a more secure authentication method');
        break;
    }

    // Session security
    if (context.securityFlags.includes('encrypted_session')) score += 10;
    if (context.securityFlags.includes('rate_limited')) score += 5;
    if (context.securityFlags.includes('audit_logged')) score += 5;

    // Time-based factors
    const sessionDuration = Date.now() - context.startTime.getTime();
    if (sessionDuration > 10 * 60 * 1000) { // > 10 minutes
      score -= 10;
      warnings.push('Long authentication session detected');
    }

    // Generate recommendations
    if (score < 70) {
      recommendations.push('Enable two-factor authentication');
      recommendations.push('Use API keys for enhanced security');
    }
    if (score < 50) {
      recommendations.push('Consider using OAuth 2.0 flow');
      warnings.push('Current security level is below recommended standards');
    }

    const level = score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low';

    return { score, level, recommendations, warnings };
  }

  // Private helper methods
  private checkRateLimit(userId: number): boolean {
    const now = new Date();
    const attempts = this.attemptTracker.get(userId);

    if (!attempts) {
      this.attemptTracker.set(userId, { count: 1, lastAttempt: now });
      return true;
    }

    // Reset if window expired
    if (now.getTime() - attempts.lastAttempt.getTime() > this.RATE_LIMIT_WINDOW) {
      this.attemptTracker.set(userId, { count: 1, lastAttempt: now });
      return true;
    }

    // Check limit
    if (attempts.count >= this.MAX_ATTEMPTS) {
      return false;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    return true;
  }

  private generateSecureSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = Array.from({ length: 3 }, () => 
      Math.random().toString(36).substring(2, 15)
    ).join('');
    return `auth_${timestamp}_${randomBytes}`;
  }

  private generateSecurityFlags(strategy: AuthenticationStrategy): string[] {
    const flags = ['rate_limited', 'audit_logged'];
    
    if (strategy.securityLevel === 'enhanced' || strategy.securityLevel === 'enterprise') {
      flags.push('encrypted_session', 'token_rotation');
    }
    
    if (strategy.securityLevel === 'enterprise') {
      flags.push('compliance_mode', 'advanced_monitoring');
    }

    return flags;
  }

  private mapStrategyToAuthMethod(strategyName: string): AuthMethod {
    switch (strategyName) {
      case 'native_credentials':
        return AuthMethod.NATIVE_CREDENTIALS;
      case 'native_api_keys':
        return AuthMethod.NATIVE_API_KEYS;
      case 'oauth_flow':
        return AuthMethod.URL_PORTAL;
      default:
        return AuthMethod.NATIVE_CREDENTIALS;
    }
  }

  private validateStepProgression(context: AuthenticationContext, step: AuthStep): boolean {
    const currentState = authStateService.getAuthState(context.userId);
    if (!currentState) return false;

    // Validate step is in strategy's expected steps
    return context.strategy.steps.includes(step) || step === AuthStep.PROCESSING;
  }

  private async processUsernameStep(
    context: AuthenticationContext,
    username: string,
    securityContext: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string }> {
    // Comprehensive username validation
    const cleanUsername = username.trim().replace('@', '');
    
    if (!cleanUsername || cleanUsername.length < 1) {
      return { success: false, message: 'Please enter a valid username or email address' };
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(cleanUsername);
    
    // Username validation
    const usernameRegex = /^[a-zA-Z0-9_]{1,15}$/;
    const isValidUsername = usernameRegex.test(cleanUsername);

    if (!isEmail && !isValidUsername) {
      return { 
        success: false, 
        message: 'Please enter a valid X username (1-15 characters, letters, numbers, underscore) or email address' 
      };
    }

    // Store in auth state
    authStateService.updateAuthData(context.userId, { username: cleanUsername });
    
    // Update context metadata
    context.metadata.username = cleanUsername;
    context.metadata.usernameType = isEmail ? 'email' : 'username';

    return {
      success: true,
      nextStep: AuthStep.ENTER_PASSWORD,
      message: `Username validated ✓ (${isEmail ? 'Email' : 'Username'})`
    };
  }

  private async processPasswordStep(
    context: AuthenticationContext,
    password: string,
    securityContext: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string }> {
    if (!password || password.length < 1) {
      return { success: false, message: 'Please enter your password' };
    }

    // Password strength validation
    const strength = this.assessPasswordStrength(password);
    if (strength.score < 3) {
      context.securityFlags.push('weak_password');
    }

    // Store in auth state (would be encrypted in production)
    authStateService.updateAuthData(context.userId, { password });
    
    // Update context
    context.metadata.passwordStrength = strength;

    return {
      success: true,
      nextStep: AuthStep.PROCESSING,
      message: 'Password received ✓ Processing authentication...'
    };
  }

  private async process2FAStep(
    context: AuthenticationContext,
    code: string,
    securityContext: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string }> {
    const cleanCode = code.trim().replace(/\s/g, '');
    
    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      return { success: false, message: 'Please enter a valid 6-digit 2FA code' };
    }

    authStateService.updateAuthData(context.userId, { twoFactorCode: cleanCode });
    context.securityFlags.push('2fa_verified');

    return {
      success: true,
      nextStep: AuthStep.PROCESSING,
      message: '2FA code verified ✓ Completing authentication...'
    };
  }

  private async processApiKeyStep(
    context: AuthenticationContext,
    apiKey: string,
    securityContext: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string }> {
    const cleanKey = apiKey.trim();
    
    // Validate API key format (X API keys are typically 25 characters)
    if (!cleanKey || cleanKey.length < 20 || cleanKey.length > 30) {
      return { success: false, message: 'Please enter a valid API key (20-30 characters)' };
    }

    authStateService.updateAuthData(context.userId, { apiKey: cleanKey });
    context.metadata.apiKeyLength = cleanKey.length;

    return {
      success: true,
      nextStep: AuthStep.ENTER_API_SECRET,
      message: 'API Key validated ✓'
    };
  }

  private async processApiSecretStep(
    context: AuthenticationContext,
    apiSecret: string,
    securityContext: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string }> {
    const cleanSecret = apiSecret.trim();
    
    // Validate API secret format (X API secrets are typically 50 characters)
    if (!cleanSecret || cleanSecret.length < 40 || cleanSecret.length > 60) {
      return { success: false, message: 'Please enter a valid API secret (40-60 characters)' };
    }

    authStateService.updateAuthData(context.userId, { apiSecret: cleanSecret });

    return {
      success: true,
      nextStep: AuthStep.ENTER_ACCESS_TOKEN,
      message: 'API Secret validated ✓'
    };
  }

  private async processAccessTokenStep(
    context: AuthenticationContext,
    accessToken: string,
    securityContext: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string }> {
    const cleanToken = accessToken.trim();
    
    // Validate access token format
    if (!cleanToken || cleanToken.length < 40 || cleanToken.length > 60) {
      return { success: false, message: 'Please enter a valid access token (40-60 characters)' };
    }

    authStateService.updateAuthData(context.userId, { accessToken: cleanToken });

    return {
      success: true,
      nextStep: AuthStep.ENTER_ACCESS_SECRET,
      message: 'Access Token validated ✓'
    };
  }

  private async processAccessSecretStep(
    context: AuthenticationContext,
    accessSecret: string,
    securityContext: Record<string, any>
  ): Promise<{ success: boolean; nextStep?: AuthStep; message?: string }> {
    const cleanSecret = accessSecret.trim();
    
    // Validate access token secret format
    if (!cleanSecret || cleanSecret.length < 40 || cleanSecret.length > 60) {
      return { success: false, message: 'Please enter a valid access token secret (40-60 characters)' };
    }

    authStateService.updateAuthData(context.userId, { accessTokenSecret: cleanSecret });

    return {
      success: true,
      nextStep: AuthStep.PROCESSING,
      message: 'Access Token Secret validated ✓ Processing authentication...'
    };
  }

  private async processAuthenticationFinalization(
    context: AuthenticationContext
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Here would be the actual X API authentication
      // For now, we'll simulate comprehensive authentication
      
      const authData = authStateService.getAuthState(context.userId)?.data;
      if (!authData) {
        throw new Error('Authentication data not found');
      }

      // Simulate authentication based on strategy
      const result = await this.simulateAuthentication(context, authData);
      
      if (result.success) {
        // Store tokens securely
        await this.userService.storeUserTokens(context.userId, result.tokens!);
        
        // Update context with success
        context.metadata.authenticationResult = result;
        context.metadata.completedAt = new Date();
        
        // Generate security assessment
        const securityAssessment = this.generateSecurityAssessment(context);
        context.metadata.securityAssessment = securityAssessment;

        return {
          success: true,
          message: 'Authentication completed successfully!'
        };
      } else {
        return {
          success: false,
          message: result.error || 'Authentication failed'
        };
      }
    } catch (error) {
      logger.error('Authentication finalization failed:', error);
      return {
        success: false,
        message: 'Authentication processing failed. Please try again.'
      };
    }
  }

  private async simulateAuthentication(
    context: AuthenticationContext,
    authData: any
  ): Promise<AuthenticationResult> {
    // Simulate different authentication methods
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

    const mockResult: AuthenticationResult = {
      success: true,
      tokens: {
        accessToken: `mock_access_token_${Date.now()}`,
        accessTokenSecret: `mock_access_secret_${Date.now()}`,
        refreshToken: `mock_refresh_token_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      },
      userInfo: {
        id: `mock_user_id_${context.userId}`,
        username: authData.username || 'user',
        displayName: authData.username || 'User',
        verified: Math.random() > 0.5,
        followerCount: Math.floor(Math.random() * 10000),
        followingCount: Math.floor(Math.random() * 1000)
      },
      permissions: this.getPermissionsForStrategy(context.strategy)
    };

    return mockResult;
  }

  private getPermissionsForStrategy(strategy: AuthenticationStrategy): string[] {
    const basePermissions = ['read', 'write'];
    
    switch (strategy.securityLevel) {
      case 'enterprise':
        return [...basePermissions, 'admin', 'analytics', 'automation', 'streaming', 'webhooks'];
      case 'enhanced':
        return [...basePermissions, 'analytics', 'automation', 'streaming'];
      case 'standard':
        return [...basePermissions, 'analytics'];
      default:
        return basePermissions;
    }
  }

  private assessPasswordStrength(password: string): { score: number; feedback: string[] } {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score++;
    else feedback.push('Use at least 8 characters');

    if (/[a-z]/.test(password)) score++;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Include uppercase letters');

    if (/\d/.test(password)) score++;
    else feedback.push('Include numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else feedback.push('Include special characters');

    return { score, feedback };
  }

  private cleanupExpiredContexts(): void {
    const now = Date.now();
    const expiredUsers: number[] = [];

    for (const [userId, context] of this.activeContexts.entries()) {
      if (now - context.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        expiredUsers.push(userId);
      }
    }

    expiredUsers.forEach(userId => {
      this.clearAuthenticationContext(userId);
    });

    if (expiredUsers.length > 0) {
      logger.info('Cleaned up expired authentication contexts', { count: expiredUsers.length });
    }
  }
}

export const authFlowManager = new AuthFlowManager();
