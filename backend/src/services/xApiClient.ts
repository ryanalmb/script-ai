import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { logger, logXApiCall } from '../utils/logger';
import { CacheService, RateLimiter } from '../config/redis';

export interface XApiCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken?: string;
}

export interface TweetData {
  text: string;
  media_ids?: string[];
  reply?: {
    in_reply_to_tweet_id: string;
  };
  quote_tweet_id?: string;
  poll?: {
    options: string[];
    duration_minutes: number;
  };
}

export interface UserData {
  id: string;
  username: string;
  name: string;
  description?: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified: boolean;
  protected: boolean;
}

export interface TweetResponse {
  data: {
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    public_metrics: {
      retweet_count: number;
      like_count: number;
      reply_count: number;
      quote_count: number;
    };
  };
}

export class XApiClient {
  private client: AxiosInstance;
  private credentials: XApiCredentials;
  private cache: CacheService;
  private rateLimiter: RateLimiter;
  private baseUrl = 'https://api.twitter.com/2';

  constructor(credentials: XApiCredentials) {
    this.credentials = credentials;
    this.cache = new CacheService();
    this.rateLimiter = new RateLimiter();
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'X-Marketing-Platform/1.0',
      },
    });

    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => this.addAuthHeaders(config) as any,
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        logXApiCall(
          response.config.url || '',
          response.config.method?.toUpperCase() || '',
          response.status
        );
        return response;
      },
      (error) => {
        const status = error.response?.status || 0;
        logXApiCall(
          error.config?.url || '',
          error.config?.method?.toUpperCase() || '',
          status
        );
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  // Add authentication headers
  private addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig {
    const url = config.url || '';
    const method = (config.method || 'GET').toUpperCase();
    
    // Use Bearer token for read operations when available
    if (this.credentials.bearerToken && method === 'GET') {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.credentials.bearerToken}`,
      };
    } else {
      // Use OAuth 1.0a for write operations
      const oauthHeader = this.generateOAuthHeader(method, url, config.data);
      config.headers = {
        ...config.headers,
        'Authorization': oauthHeader,
      };
    }

    return config;
  }

  // Generate OAuth 1.0a header
  private generateOAuthHeader(method: string, url: string, body?: any): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '');

    const parameters: Record<string, string> = {
      oauth_consumer_key: this.credentials.apiKey,
      oauth_token: this.credentials.accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    };

    // Create signature base string
    const parameterString = Object.keys(parameters)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key] || '')}`)
      .join('&');

    const signatureBaseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(parameterString)
    ].join('&');

    // Create signing key
    const signingKey = [
      encodeURIComponent(this.credentials.apiSecret),
      encodeURIComponent(this.credentials.accessTokenSecret)
    ].join('&');

    // Generate signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    parameters.oauth_signature = signature;

    // Build authorization header
    const authHeader = 'OAuth ' + Object.keys(parameters)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(parameters[key] || '')}"`)
      .join(', ');

    return authHeader;
  }

  // Handle API errors
  private handleApiError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.detail || data?.title || `X API error: ${status}`;
      
      logger.error('X API error:', {
        status,
        message,
        data,
        url: error.config?.url,
        method: error.config?.method,
      });

      switch (status) {
        case 401:
          return new Error('X API authentication failed');
        case 403:
          return new Error('X API access forbidden');
        case 429:
          return new Error('X API rate limit exceeded');
        case 500:
        case 502:
        case 503:
          return new Error('X API server error');
        default:
          return new Error(message);
      }
    }

    return new Error('X API connection error');
  }

  // Rate limiting check
  private async checkRateLimit(endpoint: string): Promise<void> {
    const key = `x_api_rate_limit:${endpoint}`;
    const limit = this.getRateLimitForEndpoint(endpoint);
    const windowSeconds = 900; // 15 minutes

    const result = await this.rateLimiter.checkLimit(key, limit, windowSeconds);
    
    if (!result.allowed) {
      throw new Error(`Rate limit exceeded for ${endpoint}. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`);
    }
  }

  // Get rate limit for specific endpoint
  private getRateLimitForEndpoint(endpoint: string): number {
    const rateLimits: Record<string, number> = {
      '/tweets': 300, // 300 tweets per 15 minutes
      '/users/by/username': 300,
      '/users/me': 75,
      '/tweets/search/recent': 180,
      '/users/:id/following': 15,
      '/users/:id/followers': 15,
      '/tweets/:id/liking_users': 75,
      '/tweets/:id/retweeted_by': 75,
    };

    // Find matching endpoint pattern
    for (const [pattern, limit] of Object.entries(rateLimits)) {
      if (endpoint.includes(pattern.replace(':id', ''))) {
        return Math.floor(limit * 0.8); // Use 80% of limit as buffer
      }
    }

    return 100; // Default conservative limit
  }

  // Post a tweet
  async postTweet(tweetData: TweetData): Promise<TweetResponse> {
    await this.checkRateLimit('/tweets');
    
    try {
      const response = await this.client.post('/tweets', tweetData);
      
      logger.info('Tweet posted successfully', {
        tweetId: response.data.data.id,
        text: tweetData.text.substring(0, 50) + '...',
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to post tweet:', error);
      throw error;
    }
  }

  // Delete a tweet
  async deleteTweet(tweetId: string): Promise<void> {
    await this.checkRateLimit('/tweets');
    
    try {
      await this.client.delete(`/tweets/${tweetId}`);
      
      logger.info('Tweet deleted successfully', { tweetId });
    } catch (error) {
      logger.error('Failed to delete tweet:', error);
      throw error;
    }
  }

  // Like a tweet
  async likeTweet(tweetId: string, userId: string): Promise<void> {
    await this.checkRateLimit('/users/:id/likes');
    
    try {
      await this.client.post(`/users/${userId}/likes`, {
        tweet_id: tweetId,
      });
      
      logger.info('Tweet liked successfully', { tweetId, userId });
    } catch (error) {
      logger.error('Failed to like tweet:', error);
      throw error;
    }
  }

  // Unlike a tweet
  async unlikeTweet(tweetId: string, userId: string): Promise<void> {
    await this.checkRateLimit('/users/:id/likes');
    
    try {
      await this.client.delete(`/users/${userId}/likes/${tweetId}`);
      
      logger.info('Tweet unliked successfully', { tweetId, userId });
    } catch (error) {
      logger.error('Failed to unlike tweet:', error);
      throw error;
    }
  }

  // Retweet
  async retweet(tweetId: string, userId: string): Promise<void> {
    await this.checkRateLimit('/users/:id/retweets');
    
    try {
      await this.client.post(`/users/${userId}/retweets`, {
        tweet_id: tweetId,
      });
      
      logger.info('Tweet retweeted successfully', { tweetId, userId });
    } catch (error) {
      logger.error('Failed to retweet:', error);
      throw error;
    }
  }

  // Unretweet
  async unretweet(tweetId: string, userId: string): Promise<void> {
    await this.checkRateLimit('/users/:id/retweets');
    
    try {
      await this.client.delete(`/users/${userId}/retweets/${tweetId}`);
      
      logger.info('Tweet unretweeted successfully', { tweetId, userId });
    } catch (error) {
      logger.error('Failed to unretweet:', error);
      throw error;
    }
  }

  // Follow a user
  async followUser(targetUserId: string, userId: string): Promise<void> {
    await this.checkRateLimit('/users/:id/following');
    
    try {
      await this.client.post(`/users/${userId}/following`, {
        target_user_id: targetUserId,
      });
      
      logger.info('User followed successfully', { targetUserId, userId });
    } catch (error) {
      logger.error('Failed to follow user:', error);
      throw error;
    }
  }

  // Unfollow a user
  async unfollowUser(targetUserId: string, userId: string): Promise<void> {
    await this.checkRateLimit('/users/:id/following');
    
    try {
      await this.client.delete(`/users/${userId}/following/${targetUserId}`);
      
      logger.info('User unfollowed successfully', { targetUserId, userId });
    } catch (error) {
      logger.error('Failed to unfollow user:', error);
      throw error;
    }
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<UserData> {
    const cacheKey = `user:${username}`;
    const cached = await this.cache.get<UserData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    await this.checkRateLimit('/users/by/username');
    
    try {
      const response = await this.client.get(`/users/by/username/${username}`, {
        params: {
          'user.fields': 'description,public_metrics,verified,protected',
        },
      });

      const userData = response.data.data;
      
      // Cache for 5 minutes
      await this.cache.set(cacheKey, userData, 300);
      
      return userData;
    } catch (error) {
      logger.error('Failed to get user by username:', error);
      throw error;
    }
  }

  // Get current user
  async getCurrentUser(): Promise<UserData> {
    const cacheKey = 'current_user';
    const cached = await this.cache.get<UserData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    await this.checkRateLimit('/users/me');
    
    try {
      const response = await this.client.get('/users/me', {
        params: {
          'user.fields': 'description,public_metrics,verified,protected',
        },
      });

      const userData = response.data.data;
      
      // Cache for 1 minute
      await this.cache.set(cacheKey, userData, 60);
      
      return userData;
    } catch (error) {
      logger.error('Failed to get current user:', error);
      throw error;
    }
  }

  // Search tweets
  async searchTweets(query: string, maxResults: number = 10): Promise<any> {
    await this.checkRateLimit('/tweets/search/recent');
    
    try {
      const response = await this.client.get('/tweets/search/recent', {
        params: {
          query,
          max_results: Math.min(maxResults, 100),
          'tweet.fields': 'created_at,public_metrics,author_id',
          'user.fields': 'username,name,verified',
          expansions: 'author_id',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to search tweets:', error);
      throw error;
    }
  }

  // Get tweet by ID
  async getTweet(tweetId: string): Promise<any> {
    const cacheKey = `tweet:${tweetId}`;
    const cached = await this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get(`/tweets/${tweetId}`, {
        params: {
          'tweet.fields': 'created_at,public_metrics,author_id',
          'user.fields': 'username,name,verified',
          expansions: 'author_id',
        },
      });

      const tweetData = response.data;
      
      // Cache for 2 minutes
      await this.cache.set(cacheKey, tweetData, 120);
      
      return tweetData;
    } catch (error) {
      logger.error('Failed to get tweet:', error);
      throw error;
    }
  }
}
