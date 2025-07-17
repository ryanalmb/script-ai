/**
 * Enterprise Backend Integration Service - 2025 Edition
 * Enhances existing backend integration with enterprise-grade capabilities:
 * - Service registry integration
 * - Distributed tracing
 * - Circuit breakers and failover
 * - Intelligent caching and retry strategies
 * - Real-time health monitoring
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { safeErrorDetails } from '../utils/userDataUtils';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Import our enterprise infrastructure (will be created)
interface EnhancedApiClient {
  get<T>(serviceName: string, endpoint: string, config?: any): Promise<ServiceResponse<T>>;
  post<T>(serviceName: string, endpoint: string, data?: any, config?: any): Promise<ServiceResponse<T>>;
  put<T>(serviceName: string, endpoint: string, data?: any, config?: any): Promise<ServiceResponse<T>>;
  delete<T>(serviceName: string, endpoint: string, config?: any): Promise<ServiceResponse<T>>;
}

interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  responseTime: number;
  fromCache: boolean;
  serviceUsed: string;
  traceId?: string;
  spanId?: string;
}

// Re-export existing interfaces for compatibility
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

/**
 * Enterprise Backend Integration Service
 */
export class EnterpriseBackendIntegration extends EventEmitter {
  private apiClient: EnhancedApiClient;
  private tracer = trace.getTracer('enterprise-backend-integration', '1.0.0');
  private isInitialized = false;
  private healthStatus = {
    isHealthy: false,
    lastCheck: new Date(),
    consecutiveFailures: 0,
    responseTime: 0
  };

  constructor(apiClient: EnhancedApiClient) {
    super();
    this.apiClient = apiClient;
    this.setupEventHandlers();
  }

  /**
   * Initialize the enterprise backend integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Enterprise backend integration already initialized');
      return;
    }

    const span = this.tracer.startSpan('backend_integration_init', {
      kind: SpanKind.INTERNAL
    });

    try {
      logger.info('🚀 Initializing Enterprise Backend Integration...');

      // Test backend connectivity
      await this.performHealthCheck();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.emit('integration:initialized');
      
      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('✅ Enterprise Backend Integration initialized successfully');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      logger.error('❌ Failed to initialize Enterprise Backend Integration:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get or create authentication token for Telegram user
   */
  async getAuthToken(request: AuthTokenRequest): Promise<AuthTokenResponse> {
    const span = this.tracer.startSpan('get_auth_token', {
      kind: SpanKind.CLIENT,
      attributes: {
        'user.telegram_id': request.telegramUserId,
        'user.username': request.username || 'unknown'
      }
    });

    try {
      const response = await this.apiClient.post<AuthTokenResponse>('backend', '/api/auth/telegram', request, {
        priority: 'high',
        cacheKey: `auth_token:${request.telegramUserId}`,
        cacheTTL: 300, // 5 minutes
        enableFallback: true,
        fallbackData: {
          success: false,
          error: 'Authentication service temporarily unavailable'
        }
      });

      if (response.success && response.data) {
        span.setAttributes({
          'auth.success': true,
          'auth.user_id': response.data.user?.id || 'unknown'
        });
        span.setStatus({ code: SpanStatusCode.OK });
        
        this.emit('auth:token_created', request.telegramUserId, response.data);
        return response.data;
      } else {
        span.setAttributes({ 'auth.success': false });
        span.setStatus({ code: SpanStatusCode.ERROR, message: response.error || 'Unknown error' });
        
        return {
          success: false,
          error: response.error || 'Failed to get authentication token'
        };
      }

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      
      logger.error('Failed to get auth token', { 
        error: safeErrorDetails(error), 
        request 
      });
      
      return {
        success: false,
        error: (error as Error).message
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get user profile with enhanced caching and fallback
   */
  async getUserProfile(telegramUserId: number, token?: string): Promise<UserProfile | null> {
    const span = this.tracer.startSpan('get_user_profile', {
      kind: SpanKind.CLIENT,
      attributes: {
        'user.telegram_id': telegramUserId
      }
    });

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await this.apiClient.get<UserProfile>('backend', `/api/users/telegram/${telegramUserId}`, {
        headers,
        priority: 'normal',
        cacheKey: `user_profile:${telegramUserId}`,
        cacheTTL: 600, // 10 minutes
        enableFallback: true,
        fallbackData: null
      });

      if (response.success && response.data) {
        span.setAttributes({
          'user.id': response.data.id,
          'user.role': response.data.role,
          'user.active': response.data.isActive
        });
        span.setStatus({ code: SpanStatusCode.OK });
        
        this.emit('user:profile_retrieved', telegramUserId, response.data);
        return response.data;
      }

      return null;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      
      logger.error('Failed to get user profile', { 
        error: safeErrorDetails(error), 
        telegramUserId 
      });
      
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Create campaign with enhanced error handling and tracing
   */
  async createCampaign(campaignData: any, token: string): Promise<any> {
    const span = this.tracer.startSpan('create_campaign', {
      kind: SpanKind.CLIENT,
      attributes: {
        'campaign.name': campaignData.name || 'unknown',
        'campaign.type': campaignData.type || 'unknown'
      }
    });

    try {
      const response = await this.apiClient.post('backend', '/api/campaigns', campaignData, {
        headers: { Authorization: `Bearer ${token}` },
        priority: 'high',
        timeout: 30000, // 30 seconds for campaign creation
        retries: 2,
        enableFallback: false // No fallback for creation operations
      });

      if (response.success && response.data) {
        span.setAttributes({
          'campaign.id': response.data.id,
          'campaign.status': response.data.status
        });
        span.setStatus({ code: SpanStatusCode.OK });
        
        this.emit('campaign:created', response.data);
        return response.data;
      }

      throw new Error(response.error || 'Failed to create campaign');

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      
      logger.error('Failed to create campaign', { 
        error: safeErrorDetails(error), 
        campaignData 
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Log user activity with batching and retry logic
   */
  async logActivity(
    telegramUserId: number,
    action: string,
    metadata: Record<string, any> = {},
    token?: string
  ): Promise<boolean> {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await this.apiClient.post('backend', '/api/activity/log', {
        telegramUserId,
        action,
        metadata,
        timestamp: new Date().toISOString()
      }, {
        headers,
        priority: 'low', // Activity logging is low priority
        timeout: 5000,
        retries: 1,
        enableFallback: true,
        fallbackData: { success: true } // Fail silently for activity logging
      });

      return response.success;

    } catch (error) {
      logger.warn('Failed to log activity (non-critical)', { 
        error: safeErrorDetails(error), 
        telegramUserId, 
        action 
      });
      return false; // Non-critical failure
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await this.apiClient.get('backend', '/health', {
        timeout: 5000,
        priority: 'critical',
        enableFallback: false
      });

      const responseTime = Date.now() - startTime;
      
      if (response.success) {
        this.healthStatus = {
          isHealthy: true,
          lastCheck: new Date(),
          consecutiveFailures: 0,
          responseTime
        };
        
        this.emit('health:healthy', this.healthStatus);
      } else {
        throw new Error('Health check returned unsuccessful response');
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.healthStatus = {
        isHealthy: false,
        lastCheck: new Date(),
        consecutiveFailures: this.healthStatus.consecutiveFailures + 1,
        responseTime
      };
      
      this.emit('health:unhealthy', this.healthStatus, error);
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    const healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');
    
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        // Health check failures are logged by performHealthCheck
      }
    }, healthCheckInterval);

    logger.info(`🏥 Backend health monitoring started (interval: ${healthCheckInterval}ms)`);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('health:unhealthy', (status, error) => {
      logger.warn(`Backend health check failed (${status.consecutiveFailures} consecutive failures):`, error);
      
      if (status.consecutiveFailures >= 3) {
        this.emit('backend:critical_failure', status);
      }
    });

    this.on('health:healthy', (status) => {
      if (status.consecutiveFailures > 0) {
        logger.info('Backend service recovered');
        this.emit('backend:recovered', status);
      }
    });
  }

  /**
   * Get health status
   */
  getHealthStatus(): typeof this.healthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Check if backend is healthy
   */
  isHealthy(): boolean {
    return this.healthStatus.isHealthy;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.isInitialized = false;
    this.emit('integration:destroyed');
    logger.info('🧹 Enterprise Backend Integration destroyed');
  }
}
