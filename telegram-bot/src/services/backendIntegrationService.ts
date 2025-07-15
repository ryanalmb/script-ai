import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { safeErrorDetails } from '../utils/userDataUtils';

export interface BackendConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AuthTokenRequest {
  telegramUserId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

export interface AuthTokenResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  user?: {
    id: string;
    telegramUserId: number;
    username?: string;
    email?: string;
    role: string;
    isActive: boolean;
  };
  error?: string;
}

export interface UserProfile {
  id: string;
  telegramUserId: number;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  preferences?: Record<string, any>;
  subscription?: {
    plan: string;
    status: string;
    expiresAt?: string;
  };
}

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
}

export interface GeneratedContent {
  id: string;
  content: string;
  type: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AnalyticsData {
  period: string;
  metrics: {
    posts: number;
    engagement: number;
    reach: number;
    clicks: number;
    impressions: number;
  };
  trends: Array<{
    date: string;
    value: number;
    metric: string;
  }>;
}

export class BackendIntegrationService {
  private client: AxiosInstance;
  private config: BackendConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isHealthy: boolean = false;

  constructor(config: Partial<BackendConfig> = {}) {
    this.config = {
      baseUrl: process.env.BACKEND_URL || 'http://localhost:3001',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TelegramBot/1.0.0'
      }
    });

    this.setupInterceptors();
    this.startHealthCheck();
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Backend request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? 'present' : 'none'
        });
        return config;
      },
      (error) => {
        logger.error('Backend request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Backend response', {
          status: response.status,
          url: response.config.url,
          data: response.data ? 'present' : 'none'
        });
        return response;
      },
      (error) => {
        const errorDetails = safeErrorDetails(error);
        logger.error('Backend response error', {
          status: (error as any).response?.status,
          url: (error as any).config?.url,
          ...errorDetails
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Start health check monitoring (disabled to prevent rate limiting)
   */
  private startHealthCheck(): void {
    // Disable aggressive health checking to prevent rate limiting
    // The bot will rely on actual request failures to detect backend issues
    logger.info('Health check monitoring disabled to prevent rate limiting');
    this.isHealthy = true; // Assume healthy by default
  }

  /**
   * Check backend health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get or create authentication token for Telegram user
   */
  async getAuthToken(request: AuthTokenRequest): Promise<AuthTokenResponse> {
    try {
      const response = await this.retryRequest(() =>
        this.client.post('/api/auth/telegram', request)
      );

      return {
        success: true,
        token: response.data.token,
        expiresAt: response.data.expiresAt,
        user: response.data.user
      };
    } catch (error) {
      const errorDetails = safeErrorDetails(error);
      logger.error('Failed to get auth token', { ...errorDetails, request });
      return {
        success: false,
        error: errorDetails.message
      };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(telegramUserId: number, token?: string): Promise<UserProfile | null> {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await this.retryRequest(() =>
        this.client.get(`/api/users/telegram/${telegramUserId}`, { headers })
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get user profile', { error, telegramUserId });
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    telegramUserId: number, 
    updates: Partial<UserProfile>, 
    token: string
  ): Promise<boolean> {
    try {
      await this.retryRequest(() =>
        this.client.patch(`/api/users/telegram/${telegramUserId}`, updates, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      return true;
    } catch (error) {
      logger.error('Failed to update user profile', { error, telegramUserId, updates });
      return false;
    }
  }

  /**
   * Get content templates
   */
  async getContentTemplates(
    category?: string, 
    token?: string
  ): Promise<ContentTemplate[]> {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = category ? { category } : {};
      
      const response = await this.retryRequest(() =>
        this.client.get('/api/templates', { headers, params })
      );

      return response.data.templates || [];
    } catch (error) {
      logger.error('Failed to get content templates', { error, category });
      return [];
    }
  }

  /**
   * Generate content using AI
   */
  async generateContent(
    prompt: string,
    type: string = 'post',
    options: Record<string, any> = {},
    token?: string
  ): Promise<GeneratedContent | null> {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await this.retryRequest(() =>
        this.client.post('/api/content/generate', {
          prompt,
          type,
          options
        }, { headers })
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to generate content', { error, prompt, type });
      return null;
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(
    telegramUserId: number,
    period: string = '7d',
    token?: string
  ): Promise<AnalyticsData | null> {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await this.retryRequest(() =>
        this.client.get(`/api/analytics/telegram/${telegramUserId}`, {
          headers,
          params: { period }
        })
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get analytics', { error, telegramUserId, period });
      return null;
    }
  }

  /**
   * Log user activity
   */
  async logActivity(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any> = {},
    token?: string
  ): Promise<boolean> {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      await this.retryRequest(() =>
        this.client.post('/api/activity/log', {
          telegramUserId,
          action,
          metadata,
          timestamp: new Date().toISOString()
        }, { headers })
      );

      return true;
    } catch (error) {
      logger.error('Failed to log activity', { error, telegramUserId, action });
      return false;
    }
  }

  /**
   * Store user tokens securely
   */
  async storeUserTokens(
    telegramUserId: number,
    tokens: {
      accessToken: string;
      accessTokenSecret: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
    authToken?: string
  ): Promise<boolean> {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      
      await this.retryRequest(() =>
        this.client.post('/api/auth/tokens/store', {
          telegramUserId,
          tokens: {
            ...tokens,
            expiresAt: tokens.expiresAt?.toISOString()
          }
        }, { headers })
      );

      return true;
    } catch (error) {
      logger.error('Failed to store user tokens', { error, telegramUserId });
      return false;
    }
  }

  /**
   * Retry request with exponential backoff
   */
  private async retryRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.retryAttempts) {
          throw lastError;
        }

        // Don't retry on 4xx errors (except 429)
        if ((error as any).response?.status >= 400 &&
            (error as any).response?.status < 500 &&
            (error as any).response?.status !== 429) {
          throw lastError;
        }

        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        const errorDetails = safeErrorDetails(lastError);
        logger.warn(`Backend request failed, retrying in ${delay}ms`, {
          attempt,
          ...errorDetails
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Get backend health status
   */
  getHealthStatus(): boolean {
    return this.isHealthy;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Create a simulated account (no auth required)
   */
  async createSimulatedAccount(options: {
    telegramUserId: number;
    accountType: string;
    tier: string;
    activityLevel: string;
    verified?: boolean;
  }): Promise<any> {
    return this.makeSimulateRequest('POST', '/api/simulate/create-account', options);
  }

  /**
   * Make a request to simulate endpoints without authentication
   */
  private async makeSimulateRequest(method: string, endpoint: string, data?: any): Promise<any> {
    try {
      logger.info('Making simulate API call', {
        method,
        url: `${this.config.baseUrl}${endpoint}`,
        hasData: !!data
      });

      const requestOptions: any = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TelegramBot/1.0.0',
          'X-Simulate-Request': 'true' // Special header to identify simulate requests
        }
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, requestOptions);

      logger.info('Simulate API response received', {
        method,
        endpoint,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Simulate API error response', {
          method,
          endpoint,
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const responseData: any = await response.json();

      logger.info('Simulate API data received', {
        method,
        endpoint,
        success: responseData.success,
        hasData: !!responseData.account || !!responseData.accounts
      });

      if (responseData.success === false) {
        throw new Error(responseData.error || `Failed to ${method} ${endpoint}`);
      }

      return responseData;

    } catch (error) {
      logger.error('Failed to make simulate request:', {
        method,
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get simulated accounts for a user (no auth required)
   */
  async getSimulatedAccounts(telegramUserId: number): Promise<any[]> {
    try {
      const response = await this.makeSimulateRequest('GET', `/api/simulate/accounts/${telegramUserId}`);
      return response.accounts || [];
    } catch (error) {
      logger.error('Failed to get simulated accounts:', error);
      return [];
    }
  }

  /**
   * Delete a simulated account (no auth required)
   */
  async deleteSimulatedAccount(accountId: string, telegramUserId: number): Promise<boolean> {
    try {
      const response = await this.makeSimulateRequest('DELETE', `/api/simulate/accounts/${accountId}`, { telegramUserId });
      return response.success || false;
    } catch (error) {
      logger.error('Failed to delete simulated account:', error);
      return false;
    }
  }

  /**
   * Get simulated account details
   */
  async getSimulatedAccountDetails(accountId: string, telegramUserId: number): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/simulate/accounts/${accountId}/details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telegramUserId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get account details');
      }

      return data.account;

    } catch (error) {
      logger.error('Failed to get simulated account details:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const backendIntegration = new BackendIntegrationService();
