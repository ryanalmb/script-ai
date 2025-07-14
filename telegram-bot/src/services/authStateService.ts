import { logger } from '../utils/logger';

export interface AuthState {
  userId: number;
  step: AuthStep;
  method: AuthMethod;
  data: Record<string, any>; // More flexible data storage
  timestamp: Date;
  messageIds: number[]; // Track messages to delete
  sessionId?: string;
  startTime?: number;
  attempts?: number;
}

export enum AuthStep {
  CHOOSE_METHOD = 'choose_method',
  ENTER_USERNAME = 'enter_username',
  ENTER_PASSWORD = 'enter_password',
  ENTER_2FA = 'enter_2fa',
  ENTER_API_KEY = 'enter_api_key',
  ENTER_API_SECRET = 'enter_api_secret',
  ENTER_ACCESS_TOKEN = 'enter_access_token',
  ENTER_ACCESS_SECRET = 'enter_access_secret',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum AuthMethod {
  NATIVE_CREDENTIALS = 'native_credentials',
  NATIVE_API_KEYS = 'native_api_keys',
  URL_PORTAL = 'url_portal'
}

export interface AuthData {
  username?: string;
  password?: string;
  twoFactorCode?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

class AuthStateService {
  private authStates: Map<number, AuthState> = new Map();
  private readonly STATE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Clean up expired states every 5 minutes
    setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000);
  }

  /**
   * Start a new authentication flow for a user
   */
  startAuth(userId: number, method: AuthMethod): AuthState {
    const state: AuthState = {
      userId,
      step: AuthStep.CHOOSE_METHOD,
      method,
      data: {},
      timestamp: new Date(),
      messageIds: []
    };

    this.authStates.set(userId, state);
    logger.info('Started auth flow', { userId, method });
    return state;
  }

  /**
   * Get current authentication state for a user
   */
  getAuthState(userId: number): AuthState | null {
    const state = this.authStates.get(userId);
    if (!state) return null;

    // Check if state has expired
    if (Date.now() - state.timestamp.getTime() > this.STATE_TIMEOUT) {
      this.clearAuthState(userId);
      return null;
    }

    return state;
  }

  /**
   * Update authentication state
   */
  updateAuthState(userId: number, updates: Partial<AuthState>): AuthState | null {
    const state = this.getAuthState(userId);
    if (!state) return null;

    const updatedState = {
      ...state,
      ...updates,
      timestamp: new Date() // Reset timeout
    };

    this.authStates.set(userId, updatedState);
    return updatedState;
  }

  /**
   * Set authentication state (alias for updateAuthState for compatibility)
   */
  setAuthState(userId: number, state: AuthState): void {
    this.authStates.set(userId, {
      ...state,
      timestamp: new Date()
    });
  }

  /**
   * Create a new authentication session
   */
  createAuthSession(userId: number, method: AuthMethod): string {
    const sessionId = `auth_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const state: AuthState = {
      userId,
      step: AuthStep.CHOOSE_METHOD,
      method,
      data: {},
      timestamp: new Date(),
      messageIds: [],
      sessionId,
      startTime: Date.now(),
      attempts: 0
    };

    this.authStates.set(userId, state);
    logger.info('Created auth session', { userId, method, sessionId });
    return sessionId;
  }

  /**
   * Update authentication data
   */
  updateAuthData(userId: number, data: Partial<AuthData>): AuthState | null {
    const state = this.getAuthState(userId);
    if (!state) return null;

    const updatedState = {
      ...state,
      data: { ...state.data, ...data },
      timestamp: new Date()
    };

    this.authStates.set(userId, updatedState);
    return updatedState;
  }

  /**
   * Move to next authentication step
   */
  nextStep(userId: number, step: AuthStep): AuthState | null {
    return this.updateAuthState(userId, { step });
  }

  /**
   * Add message ID to track for deletion
   */
  addMessageId(userId: number, messageId: number): void {
    const state = this.getAuthState(userId);
    if (state) {
      state.messageIds.push(messageId);
      this.authStates.set(userId, state);
    }
  }

  /**
   * Get message IDs to delete
   */
  getMessageIds(userId: number): number[] {
    const state = this.getAuthState(userId);
    return state ? state.messageIds : [];
  }

  /**
   * Clear authentication state
   */
  clearAuthState(userId: number): void {
    this.authStates.delete(userId);
    logger.info('Cleared auth state', { userId });
  }

  /**
   * Check if user is in authentication flow
   */
  isInAuthFlow(userId: number): boolean {
    return this.getAuthState(userId) !== null;
  }

  /**
   * Get next step based on current step and method
   */
  getNextStep(currentStep: AuthStep, method: AuthMethod): AuthStep {
    switch (method) {
      case AuthMethod.NATIVE_CREDENTIALS:
        switch (currentStep) {
          case AuthStep.CHOOSE_METHOD:
            return AuthStep.ENTER_USERNAME;
          case AuthStep.ENTER_USERNAME:
            return AuthStep.ENTER_PASSWORD;
          case AuthStep.ENTER_PASSWORD:
            return AuthStep.PROCESSING;
          case AuthStep.ENTER_2FA:
            return AuthStep.PROCESSING;
          default:
            return AuthStep.COMPLETED;
        }

      case AuthMethod.NATIVE_API_KEYS:
        switch (currentStep) {
          case AuthStep.CHOOSE_METHOD:
            return AuthStep.ENTER_API_KEY;
          case AuthStep.ENTER_API_KEY:
            return AuthStep.ENTER_API_SECRET;
          case AuthStep.ENTER_API_SECRET:
            return AuthStep.ENTER_ACCESS_TOKEN;
          case AuthStep.ENTER_ACCESS_TOKEN:
            return AuthStep.ENTER_ACCESS_SECRET;
          case AuthStep.ENTER_ACCESS_SECRET:
            return AuthStep.PROCESSING;
          default:
            return AuthStep.COMPLETED;
        }

      default:
        return AuthStep.COMPLETED;
    }
  }

  /**
   * Clean up expired authentication states
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    const expiredUsers: number[] = [];

    for (const [userId, state] of this.authStates.entries()) {
      if (now - state.timestamp.getTime() > this.STATE_TIMEOUT) {
        expiredUsers.push(userId);
      }
    }

    expiredUsers.forEach(userId => {
      this.clearAuthState(userId);
    });

    if (expiredUsers.length > 0) {
      logger.info('Cleaned up expired auth states', { count: expiredUsers.length });
    }
  }
}

export const authStateService = new AuthStateService();
