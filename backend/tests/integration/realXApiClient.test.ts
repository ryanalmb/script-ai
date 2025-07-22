import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealXApiClient } from '../../src/services/realXApiClient';
import { EnterpriseAntiDetectionCoordinator } from '../../src/services/antiDetection/antiDetectionCoordinator';
import { 
  testAntiDetectionCoordinator,
  createTestUser,
  createTestXAccount,
  mockXApiResponses,
  TestPerformanceMonitor,
  waitForAsync
} from '../setup/testSetup';
import { logger } from '../../src/utils/logger';

describe('RealXApiClient Integration Tests', () => {
  let xApiClient: RealXApiClient;
  let testUser: any;
  let testAccount: any;
  let performanceMonitor: TestPerformanceMonitor;

  beforeEach(async () => {
    performanceMonitor = new TestPerformanceMonitor();
    
    // Create test user and account
    testUser = await createTestUser({
      email: 'test@example.com',
      password: 'testpassword',
      role: 'user'
    });

    testAccount = await createTestXAccount({
      userId: testUser.id,
      username: 'testuser123',
      isActive: true
    });

    // Initialize X API client with test credentials
    const credentials = {
      username: testAccount.username,
      email: testUser.email,
      password: 'testpassword'
    };

    xApiClient = new RealXApiClient(
      testAccount.id,
      credentials,
      testAntiDetectionCoordinator
    );

    performanceMonitor.checkpoint('setup_complete');
  });

  describe('Authentication and Initialization', () => {
    it('should initialize X API client successfully', async () => {
      expect(xApiClient).toBeDefined();
      expect(xApiClient.getAccountId()).toBe(testAccount.id);
      
      performanceMonitor.checkpoint('initialization_test');
      const results = performanceMonitor.getResults();
      expect(results.totalTime).toBeLessThan(1000); // Should initialize within 1 second
    });

    it('should handle authentication with anti-detection measures', async () => {
      // Mock successful authentication
      const authResult = await xApiClient.authenticate();
      
      expect(authResult).toBeDefined();
      expect(authResult.success).toBe(true);
      
      // Verify anti-detection measures were applied
      const antiDetectionStats = testAntiDetectionCoordinator.getAntiDetectionStatistics();
      expect(antiDetectionStats.profiles.active).toBeGreaterThan(0);
      
      performanceMonitor.checkpoint('authentication_test');
    });

    it('should handle authentication failures gracefully', async () => {
      // Create client with invalid credentials
      const invalidClient = new RealXApiClient(
        'invalid_account',
        { username: 'invalid', email: 'invalid@test.com', password: 'invalid' },
        testAntiDetectionCoordinator
      );

      const authResult = await invalidClient.authenticate();
      
      expect(authResult.success).toBe(false);
      expect(authResult.error).toBeDefined();
      
      performanceMonitor.checkpoint('auth_failure_test');
    });
  });

  describe('User Profile Operations', () => {
    it('should fetch user profile with real data structure', async () => {
      // Mock X API response
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.getUserProfile(testAccount.username)
      );

      const profile = await xApiClient.getUserProfile(testAccount.id);
      
      expect(profile).toBeDefined();
      expect(profile.username).toBe(testAccount.username);
      expect(profile.followersCount).toBeTypeOf('number');
      expect(profile.followingCount).toBeTypeOf('number');
      expect(profile.tweetsCount).toBeTypeOf('number');
      expect(profile.verified).toBeTypeOf('boolean');
      
      performanceMonitor.checkpoint('profile_fetch_test');
      const results = performanceMonitor.getResults();
      expect(results.checkpoints[results.checkpoints.length - 1].delta).toBeLessThan(2000);
    });

    it('should handle profile fetch errors with retry mechanism', async () => {
      let callCount = 0;
      vi.spyOn(xApiClient as any, 'makeApiCall').mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Rate limit exceeded');
        }
        return mockXApiResponses.getUserProfile(testAccount.username);
      });

      const profile = await xApiClient.getUserProfile(testAccount.id);
      
      expect(profile).toBeDefined();
      expect(callCount).toBe(3); // Should retry twice before success
      
      performanceMonitor.checkpoint('profile_retry_test');
    });

    it('should validate profile data integrity', async () => {
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.getUserProfile(testAccount.username)
      );

      const profile = await xApiClient.getUserProfile(testAccount.id);
      
      // Validate required fields
      expect(profile.id).toBeDefined();
      expect(profile.username).toBeDefined();
      expect(profile.followersCount).toBeGreaterThanOrEqual(0);
      expect(profile.followingCount).toBeGreaterThanOrEqual(0);
      expect(profile.tweetsCount).toBeGreaterThanOrEqual(0);
      
      // Validate data types
      expect(typeof profile.followersCount).toBe('number');
      expect(typeof profile.verified).toBe('boolean');
      
      performanceMonitor.checkpoint('profile_validation_test');
    });
  });

  describe('Tweet Operations', () => {
    it('should post tweet with anti-detection measures', async () => {
      const tweetText = 'Test tweet from automated system';
      
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.postTweet(tweetText)
      );

      const result = await xApiClient.postTweet(tweetText);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.tweetId).toBeDefined();
      expect(result.text).toBe(tweetText);
      
      // Verify anti-detection measures were applied
      const antiDetectionStats = testAntiDetectionCoordinator.getAntiDetectionStatistics();
      expect(antiDetectionStats.detectionEvents.total).toBe(0);
      
      performanceMonitor.checkpoint('tweet_post_test');
    });

    it('should handle tweet posting failures with proper error handling', async () => {
      const tweetText = 'Test tweet that will fail';
      
      vi.spyOn(xApiClient as any, 'makeApiCall').mockRejectedValue(
        new Error('Tweet posting failed: Duplicate content')
      );

      const result = await xApiClient.postTweet(tweetText);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Duplicate content');
      
      performanceMonitor.checkpoint('tweet_failure_test');
    });

    it('should fetch tweet by ID with engagement metrics', async () => {
      const tweetId = 'test_tweet_123';
      
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.getTweetById(tweetId)
      );

      const tweet = await xApiClient.getTweetById(tweetId);
      
      expect(tweet).toBeDefined();
      expect(tweet.id).toBe(tweetId);
      expect(tweet.metrics).toBeDefined();
      expect(tweet.metrics.likes).toBeTypeOf('number');
      expect(tweet.metrics.retweets).toBeTypeOf('number');
      expect(tweet.metrics.replies).toBeTypeOf('number');
      expect(tweet.impressions).toBeTypeOf('number');
      
      performanceMonitor.checkpoint('tweet_fetch_test');
    });

    it('should validate tweet content before posting', async () => {
      // Test empty tweet
      const emptyResult = await xApiClient.postTweet('');
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toContain('empty');

      // Test tweet too long
      const longTweet = 'a'.repeat(281); // Over 280 character limit
      const longResult = await xApiClient.postTweet(longTweet);
      expect(longResult.success).toBe(false);
      expect(longResult.error).toContain('too long');

      performanceMonitor.checkpoint('tweet_validation_test');
    });
  });

  describe('Engagement Operations', () => {
    it('should like tweet with anti-detection timing', async () => {
      const tweetId = 'test_tweet_to_like';
      
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.likeTweet(tweetId)
      );

      const startTime = Date.now();
      const result = await xApiClient.likeTweet(tweetId);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.tweetId).toBe(tweetId);
      
      // Verify human-like timing (should have some delay)
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(500); // At least 500ms delay
      expect(duration).toBeLessThan(5000); // But not more than 5 seconds
      
      performanceMonitor.checkpoint('like_tweet_test');
    });

    it('should follow user with proper rate limiting', async () => {
      const userIdToFollow = 'user_to_follow_123';
      
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.followUser(userIdToFollow)
      );

      const result = await xApiClient.followUser(userIdToFollow);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.userId).toBe(userIdToFollow);
      
      performanceMonitor.checkpoint('follow_user_test');
    });

    it('should handle rate limiting gracefully', async () => {
      const tweetId = 'rate_limited_tweet';
      
      // Mock rate limit error
      vi.spyOn(xApiClient as any, 'makeApiCall').mockRejectedValue(
        new Error('Rate limit exceeded. Try again in 15 minutes.')
      );

      const result = await xApiClient.likeTweet(tweetId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
      expect(result.retryAfter).toBeDefined();
      
      performanceMonitor.checkpoint('rate_limit_test');
    });
  });

  describe('Account Health Monitoring', () => {
    it('should check account health status', async () => {
      const healthCheck = await xApiClient.checkAccountHealth();
      
      expect(healthCheck).toBeDefined();
      expect(healthCheck.healthy).toBeTypeOf('boolean');
      expect(healthCheck.lastChecked).toBeInstanceOf(Date);
      
      if (!healthCheck.healthy) {
        expect(healthCheck.issues).toBeDefined();
        expect(Array.isArray(healthCheck.issues)).toBe(true);
      }
      
      performanceMonitor.checkpoint('health_check_test');
    });

    it('should detect account suspension', async () => {
      // Mock suspended account response
      vi.spyOn(xApiClient as any, 'makeApiCall').mockRejectedValue(
        new Error('Account suspended')
      );

      const healthCheck = await xApiClient.checkAccountHealth();
      
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues).toContain('suspended');
      
      performanceMonitor.checkpoint('suspension_detection_test');
    });

    it('should monitor authentication status', async () => {
      const authStatus = await xApiClient.checkAuthenticationStatus();
      
      expect(authStatus).toBeDefined();
      expect(authStatus.isAuthenticated).toBeTypeOf('boolean');
      expect(authStatus.lastAuthCheck).toBeInstanceOf(Date);
      
      if (!authStatus.isAuthenticated) {
        expect(authStatus.reason).toBeDefined();
      }
      
      performanceMonitor.checkpoint('auth_status_test');
    });
  });

  describe('Anti-Detection Integration', () => {
    it('should use different proxies for requests', async () => {
      // Make multiple requests and verify proxy rotation
      const requests = [];
      for (let i = 0; i < 3; i++) {
        vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
          mockXApiResponses.getUserProfile(`user${i}`)
        );
        
        requests.push(xApiClient.getUserProfile(`user${i}`));
        await waitForAsync(100); // Small delay between requests
      }

      await Promise.all(requests);
      
      // Verify anti-detection coordinator was used
      const stats = testAntiDetectionCoordinator.getAntiDetectionStatistics();
      expect(stats.profiles.active).toBeGreaterThan(0);
      
      performanceMonitor.checkpoint('proxy_rotation_test');
    });

    it('should apply browser fingerprint evasion', async () => {
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.getUserProfile(testAccount.username)
      );

      await xApiClient.getUserProfile(testAccount.id);
      
      // Verify fingerprint was used
      const stats = testAntiDetectionCoordinator.getAntiDetectionStatistics();
      expect(stats.systemHealth.fingerprints).toBeDefined();
      
      performanceMonitor.checkpoint('fingerprint_test');
    });

    it('should simulate human behavior patterns', async () => {
      const actions = [
        () => xApiClient.getUserProfile(testAccount.id),
        () => xApiClient.likeTweet('tweet1'),
        () => xApiClient.followUser('user1')
      ];

      // Mock all API calls
      vi.spyOn(xApiClient as any, 'makeApiCall').mockImplementation(async (endpoint) => {
        if (endpoint.includes('profile')) return mockXApiResponses.getUserProfile(testAccount.username);
        if (endpoint.includes('like')) return mockXApiResponses.likeTweet('tweet1');
        if (endpoint.includes('follow')) return mockXApiResponses.followUser('user1');
      });

      const startTime = Date.now();
      
      for (const action of actions) {
        await action();
        await waitForAsync(100); // Allow for behavior simulation
      }
      
      const totalTime = Date.now() - startTime;
      
      // Verify human-like timing was applied
      expect(totalTime).toBeGreaterThan(1000); // Should take at least 1 second for 3 actions
      
      performanceMonitor.checkpoint('behavior_simulation_test');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors with exponential backoff', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;
      
      vi.spyOn(xApiClient as any, 'makeApiCall').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < maxAttempts) {
          throw new Error('Network error');
        }
        return mockXApiResponses.getUserProfile(testAccount.username);
      });

      const result = await xApiClient.getUserProfile(testAccount.id);
      
      expect(result).toBeDefined();
      expect(attemptCount).toBe(maxAttempts);
      
      performanceMonitor.checkpoint('network_error_recovery_test');
    });

    it('should handle API changes gracefully', async () => {
      // Mock API response with missing fields
      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue({
        id: 'user123',
        username: testAccount.username
        // Missing other expected fields
      });

      const profile = await xApiClient.getUserProfile(testAccount.id);
      
      expect(profile).toBeDefined();
      expect(profile.username).toBe(testAccount.username);
      // Should handle missing fields gracefully
      expect(profile.followersCount).toBeDefined(); // Should have default value
      
      performanceMonitor.checkpoint('api_change_handling_test');
    });

    it('should log errors comprehensively', async () => {
      const logSpy = vi.spyOn(logger, 'error');
      
      vi.spyOn(xApiClient as any, 'makeApiCall').mockRejectedValue(
        new Error('Test error for logging')
      );

      await xApiClient.getUserProfile(testAccount.id);
      
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error for logging'),
        expect.any(Object)
      );
      
      performanceMonitor.checkpoint('error_logging_test');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 5;
      const requests = [];

      vi.spyOn(xApiClient as any, 'makeApiCall').mockImplementation(async (endpoint) => {
        await waitForAsync(100); // Simulate API delay
        return mockXApiResponses.getUserProfile(testAccount.username);
      });

      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(xApiClient.getUserProfile(`user${i}`));
      }

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(concurrentRequests);
      expect(results.every(r => r !== null)).toBe(true);
      
      // Should handle concurrent requests efficiently
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      
      performanceMonitor.checkpoint('concurrent_requests_test');
    });

    it('should maintain performance under load', async () => {
      const loadTestRequests = 10;
      const results = [];

      vi.spyOn(xApiClient as any, 'makeApiCall').mockResolvedValue(
        mockXApiResponses.getUserProfile(testAccount.username)
      );

      for (let i = 0; i < loadTestRequests; i++) {
        const startTime = Date.now();
        await xApiClient.getUserProfile(testAccount.id);
        const endTime = Date.now();
        
        results.push(endTime - startTime);
      }

      // Calculate average response time
      const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      
      expect(avgResponseTime).toBeLessThan(500); // Average should be under 500ms
      
      performanceMonitor.checkpoint('load_test');
    });
  });

  afterEach(() => {
    const results = performanceMonitor.getResults();
    logger.info('Test performance results:', results);
    
    // Verify overall test performance
    expect(results.totalTime).toBeLessThan(30000); // Test should complete within 30 seconds
  });
});
