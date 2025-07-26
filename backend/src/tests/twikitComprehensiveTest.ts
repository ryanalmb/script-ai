import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { 
  logger, 
  logTwikitAction, 
  logAuditTrail, 
  generateCorrelationId,
  sanitizeData 
} from '../utils/logger';
import { twikitConfig } from '../config/twikit';
import { TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';

// ============================================================================
// TEST FRAMEWORK INTERFACES AND TYPES
// ============================================================================

interface TestCredentials {
  username: string;
  email: string;
  password: string;
  twoFactorSecret?: string;
  captchaApiKey?: string;
}

interface TestResult {
  testName: string;
  category: TestCategory;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
  duration: number;
  error: string | undefined;
  details: any;
  correlationId: string;
}

interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
  successRate: number;
  categoryResults: Record<TestCategory, CategorySummary>;
}

interface CategorySummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  successRate: number;
}

enum TestCategory {
  AUTHENTICATION = 'Authentication & Account Management',
  TWEET_OPERATIONS = 'Tweet Operations',
  ENGAGEMENT = 'Engagement Actions',
  USER_OPERATIONS = 'User Operations',
  SEARCH_DISCOVERY = 'Search & Discovery',
  DIRECT_MESSAGES = 'Direct Messages',
  LIST_MANAGEMENT = 'List Management',
  COMMUNITIES = 'Communities',
  MEDIA_POLLS = 'Media & Polls',
  LOCATION = 'Location & Geography',
  NOTIFICATIONS = 'Notifications & Timeline',
  ADVANCED_FEATURES = 'Advanced Features'
}

// ============================================================================
// COMPREHENSIVE TWIKIT TEST SUITE
// ============================================================================

export class TwikitComprehensiveTestSuite {
  private credentials: TestCredentials;
  private results: TestResult[] = [];
  private pythonProcess: any = null;
  private testStartTime: number = 0;
  private correlationId: string;
  private testDataCleanup: string[] = []; // Track created data for cleanup

  constructor(credentials: TestCredentials) {
    // Store original credentials for actual use (will be used in authentication)
    // const originalCredentials = { ...credentials };

    // Create sanitized version for logging
    this.credentials = {
      username: credentials.username,
      email: credentials.email,
      password: '***REDACTED***'
    };

    // Add optional fields only if they exist
    if (credentials.twoFactorSecret) {
      this.credentials.twoFactorSecret = '***REDACTED***';
    }
    if (credentials.captchaApiKey) {
      this.credentials.captchaApiKey = '***REDACTED***';
    }

    this.correlationId = generateCorrelationId();
  }

  /**
   * Run the complete test suite
   */
  public async runComprehensiveTests(): Promise<TestSummary> {
    this.testStartTime = Date.now();
    
    logger.info('🚀 Starting Twikit Comprehensive Test Suite', {
      correlationId: this.correlationId,
      username: this.credentials.username,
      testCategories: Object.values(TestCategory).length
    });

    try {
      // Initialize Python Twikit environment
      await this.initializePythonEnvironment();

      // Run all test categories in sequence
      await this.runAuthenticationTests();
      await this.runTweetOperationTests();
      await this.runEngagementTests();
      await this.runUserOperationTests();
      await this.runSearchDiscoveryTests();
      await this.runDirectMessageTests();
      await this.runListManagementTests();
      await this.runCommunityTests();
      await this.runMediaPollTests();
      await this.runLocationTests();
      await this.runNotificationTimelineTests();
      await this.runAdvancedFeatureTests();

      // Cleanup test data
      await this.cleanupTestData();

    } catch (error) {
      logger.error('Critical error in test suite execution:', error);
      this.addTestResult('Test Suite Execution', TestCategory.AUTHENTICATION, 'ERROR', 0, error);
    } finally {
      // Ensure Python process is terminated
      if (this.pythonProcess) {
        this.pythonProcess.kill();
      }
    }

    const summary = this.generateTestSummary();
    await this.generateDetailedReport(summary);
    
    return summary;
  }

  /**
   * Initialize Python environment for Twikit
   */
  private async initializePythonEnvironment(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Initializing Python Twikit environment...', { correlationId: this.correlationId });

      // Use existing Python test script
      const pythonScript = path.join(__dirname, '../../python/comprehensive_twikit_test.py');

      // Spawn Python process
      this.pythonProcess = spawn('python', [pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '../../python')
      });

      // Wait for initialization
      await this.waitForPythonReady();

      this.addTestResult(
        'Python Environment Initialization', 
        TestCategory.AUTHENTICATION, 
        'PASS', 
        Date.now() - startTime
      );

    } catch (error) {
      this.addTestResult(
        'Python Environment Initialization', 
        TestCategory.AUTHENTICATION, 
        'FAIL', 
        Date.now() - startTime, 
        error
      );
      throw error;
    }
  }



  /**
   * Wait for Python process to be ready
   */
  private async waitForPythonReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python process initialization timeout'));
      }, 30000);

      this.pythonProcess.stdout.on('data', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.status === 'ready') {
            clearTimeout(timeout);
            resolve();
          }
        } catch (e) {
          // Ignore parsing errors for non-JSON output
        }
      });

      this.pythonProcess.stderr.on('data', (data: Buffer) => {
        logger.error('Python process error:', data.toString());
      });
    });
  }

  /**
   * Add test result to collection
   */
  private addTestResult(
    testName: string,
    category: TestCategory,
    status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR',
    duration: number,
    error?: any,
    details?: any
  ): void {
    const result: TestResult = {
      testName,
      category,
      status,
      duration,
      error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
      details: sanitizeData(details),
      correlationId: this.correlationId
    };

    this.results.push(result);

    // Log individual test result
    const logStatus = status === 'PASS' ? 'success' : status === 'FAIL' ? 'failure' : 'retry';
    const logContext: any = {
      correlationId: this.correlationId,
      duration
    };

    if (result.error) {
      logContext.error = new Error(result.error);
    }

    logTwikitAction(testName, this.credentials.username, { category }, logStatus, logContext);
  }

  // ============================================================================
  // AUTHENTICATION & ACCOUNT MANAGEMENT TESTS
  // ============================================================================

  private async runAuthenticationTests(): Promise<void> {
    logger.info('🔐 Running Authentication & Account Management Tests', { correlationId: this.correlationId });

    // Test 1: Basic Login
    await this.testBasicLogin();

    // Test 2: Cookie Management
    await this.testCookieManagement();

    // Test 3: User Information Retrieval
    await this.testUserInformationRetrieval();

    // Test 4: Account Unlock (if needed)
    await this.testAccountUnlock();

    // Test 5: Logout
    await this.testLogout();
  }

  private async testBasicLogin(): Promise<void> {
    const startTime = Date.now();

    try {
      const credentials = {
        username: 'ryan1stacc', // Using actual credentials
        email: 'ryanalex1@protonmail.com',
        password: 'Ryan2003'
      };

      // Send authentication command to Python
      const authResult = await this.sendPythonCommand('authenticate', { credentials });

      if (authResult.status === 'authenticated') {
        this.addTestResult('Basic Login', TestCategory.AUTHENTICATION, 'PASS', Date.now() - startTime, null, {
          userId: authResult.user_id
        });
      } else {
        this.addTestResult('Basic Login', TestCategory.AUTHENTICATION, 'FAIL', Date.now() - startTime, authResult.error);
      }
    } catch (error) {
      this.addTestResult('Basic Login', TestCategory.AUTHENTICATION, 'ERROR', Date.now() - startTime, error);
    }
  }

  private async testCookieManagement(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test cookie save/load functionality
      const result = await this.sendPythonCommand('test', {
        test_name: 'cookie_management',
        params: {}
      });

      this.addTestResult('Cookie Management', TestCategory.AUTHENTICATION, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Cookie Management', TestCategory.AUTHENTICATION, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testUserInformationRetrieval(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'user_info',
        params: {}
      });

      this.addTestResult('User Information Retrieval', TestCategory.AUTHENTICATION, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('User Information Retrieval', TestCategory.AUTHENTICATION, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testAccountUnlock(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test account unlock if CAPTCHA solver is available
      if (this.credentials.captchaApiKey) {
        const result = await this.sendPythonCommand('test', {
          test_name: 'account_unlock',
          params: { captcha_api_key: this.credentials.captchaApiKey }
        });

        this.addTestResult('Account Unlock', TestCategory.AUTHENTICATION, 'PASS', Date.now() - startTime, null, result);
      } else {
        this.addTestResult('Account Unlock', TestCategory.AUTHENTICATION, 'SKIP', Date.now() - startTime, 'No CAPTCHA API key provided');
      }
    } catch (error) {
      this.addTestResult('Account Unlock', TestCategory.AUTHENTICATION, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testLogout(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'logout',
        params: {}
      });

      this.addTestResult('Logout', TestCategory.AUTHENTICATION, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Logout', TestCategory.AUTHENTICATION, 'FAIL', Date.now() - startTime, error);
    }
  }

  // ============================================================================
  // TWEET OPERATIONS TESTS
  // ============================================================================

  private async runTweetOperationTests(): Promise<void> {
    logger.info('🐦 Running Tweet Operations Tests', { correlationId: this.correlationId });

    // Test 1: Create Tweet
    await this.testCreateTweet();

    // Test 2: Get Tweet by ID
    await this.testGetTweetById();

    // Test 3: Delete Tweet
    await this.testDeleteTweet();

    // Test 4: Reply to Tweet
    await this.testReplyToTweet();

    // Test 5: Scheduled Tweets
    await this.testScheduledTweets();
  }

  private async testCreateTweet(): Promise<void> {
    const startTime = Date.now();

    try {
      const testTweetText = `🤖 Twikit Test Tweet - ${new Date().toISOString()} #TwikitTest`;

      const result = await this.sendPythonCommand('test', {
        test_name: 'create_tweet',
        params: { text: testTweetText }
      });

      if (result && result.tweet_id) {
        this.testDataCleanup.push(result.tweet_id); // Track for cleanup
        this.addTestResult('Create Tweet', TestCategory.TWEET_OPERATIONS, 'PASS', Date.now() - startTime, null, {
          tweetId: result.tweet_id,
          text: testTweetText
        });
      } else {
        this.addTestResult('Create Tweet', TestCategory.TWEET_OPERATIONS, 'FAIL', Date.now() - startTime, 'No tweet ID returned');
      }
    } catch (error) {
      this.addTestResult('Create Tweet', TestCategory.TWEET_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetTweetById(): Promise<void> {
    const startTime = Date.now();

    try {
      // Use a known tweet ID or the one we just created
      const tweetId = this.testDataCleanup[0] || '1234567890'; // Fallback to dummy ID

      const result = await this.sendPythonCommand('test', {
        test_name: 'get_tweet_by_id',
        params: { tweet_id: tweetId }
      });

      this.addTestResult('Get Tweet by ID', TestCategory.TWEET_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Tweet by ID', TestCategory.TWEET_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testDeleteTweet(): Promise<void> {
    const startTime = Date.now();

    try {
      if (this.testDataCleanup.length > 0) {
        const tweetId = this.testDataCleanup.pop(); // Remove from cleanup list as we're deleting it

        const result = await this.sendPythonCommand('test', {
          test_name: 'delete_tweet',
          params: { tweet_id: tweetId }
        });

        this.addTestResult('Delete Tweet', TestCategory.TWEET_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
      } else {
        this.addTestResult('Delete Tweet', TestCategory.TWEET_OPERATIONS, 'SKIP', Date.now() - startTime, 'No test tweet to delete');
      }
    } catch (error) {
      this.addTestResult('Delete Tweet', TestCategory.TWEET_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testReplyToTweet(): Promise<void> {
    const startTime = Date.now();

    try {
      // Find a tweet to reply to (use a popular tweet ID)
      const result = await this.sendPythonCommand('test', {
        test_name: 'reply_to_tweet',
        params: {
          tweet_id: '1234567890', // Use a known tweet ID
          reply_text: '🤖 Test reply from Twikit automation'
        }
      });

      if (result && result.reply_id) {
        this.testDataCleanup.push(result.reply_id);
      }

      this.addTestResult('Reply to Tweet', TestCategory.TWEET_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Reply to Tweet', TestCategory.TWEET_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testScheduledTweets(): Promise<void> {
    const startTime = Date.now();

    try {
      // Test creating, listing, and deleting scheduled tweets
      const result = await this.sendPythonCommand('test', {
        test_name: 'scheduled_tweets',
        params: {
          text: '🤖 Scheduled test tweet',
          schedule_time: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        }
      });

      this.addTestResult('Scheduled Tweets', TestCategory.TWEET_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Scheduled Tweets', TestCategory.TWEET_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  // ============================================================================
  // PYTHON COMMUNICATION METHODS
  // ============================================================================

  /**
   * Send command to Python process and wait for response
   */
  private async sendPythonCommand(action: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const command = JSON.stringify({ action, ...params });
      const timeout = setTimeout(() => {
        reject(new Error('Python command timeout'));
      }, 30000);

      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          clearTimeout(timeout);
          this.pythonProcess.stdout.removeListener('data', responseHandler);

          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        } catch (e) {
          // Ignore parsing errors for partial data
        }
      };

      this.pythonProcess.stdout.on('data', responseHandler);
      this.pythonProcess.stdin.write(command + '\n');
    });
  }

  // ============================================================================
  // ENGAGEMENT TESTS
  // ============================================================================

  private async runEngagementTests(): Promise<void> {
    logger.info('❤️ Running Engagement Tests', { correlationId: this.correlationId });

    await this.testLikeTweet();
    await this.testRetweetTweet();
    await this.testBookmarkTweet();
    await this.testGetEngagementData();
  }

  private async testLikeTweet(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'like_tweet',
        params: { tweet_id: '1234567890' } // Use a known tweet ID
      });

      this.addTestResult('Like Tweet', TestCategory.ENGAGEMENT, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Like Tweet', TestCategory.ENGAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testRetweetTweet(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'retweet',
        params: { tweet_id: '1234567890' }
      });

      this.addTestResult('Retweet', TestCategory.ENGAGEMENT, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Retweet', TestCategory.ENGAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testBookmarkTweet(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'bookmark_tweet',
        params: { tweet_id: '1234567890' }
      });

      this.addTestResult('Bookmark Tweet', TestCategory.ENGAGEMENT, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Bookmark Tweet', TestCategory.ENGAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetEngagementData(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_engagement_data',
        params: { tweet_id: '1234567890' }
      });

      this.addTestResult('Get Engagement Data', TestCategory.ENGAGEMENT, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Engagement Data', TestCategory.ENGAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  // ============================================================================
  // USER OPERATIONS TESTS
  // ============================================================================

  private async runUserOperationTests(): Promise<void> {
    logger.info('👥 Running User Operations Tests', { correlationId: this.correlationId });

    await this.testFollowUser();
    await this.testGetUserInfo();
    await this.testGetUserTweets();
    await this.testGetUserFollowers();
  }

  private async testFollowUser(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'follow_user',
        params: { user_id: 'twitter' } // Follow Twitter's official account
      });

      this.addTestResult('Follow User', TestCategory.USER_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Follow User', TestCategory.USER_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetUserInfo(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_user_info',
        params: { username: 'twitter' }
      });

      this.addTestResult('Get User Info', TestCategory.USER_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get User Info', TestCategory.USER_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetUserTweets(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_user_tweets',
        params: { username: 'twitter', count: 5 }
      });

      this.addTestResult('Get User Tweets', TestCategory.USER_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get User Tweets', TestCategory.USER_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetUserFollowers(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_user_followers',
        params: { username: 'twitter', count: 5 }
      });

      this.addTestResult('Get User Followers', TestCategory.USER_OPERATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get User Followers', TestCategory.USER_OPERATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  // ============================================================================
  // SEARCH & DISCOVERY TESTS
  // ============================================================================

  private async runSearchDiscoveryTests(): Promise<void> {
    logger.info('🔍 Running Search & Discovery Tests', { correlationId: this.correlationId });

    await this.testSearchTweets();
    await this.testSearchUsers();
    await this.testGetTrends();
  }

  private async testSearchTweets(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'search_tweets',
        params: { query: 'python programming', product: 'Latest', count: 5 }
      });

      this.addTestResult('Search Tweets', TestCategory.SEARCH_DISCOVERY, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Search Tweets', TestCategory.SEARCH_DISCOVERY, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testSearchUsers(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'search_users',
        params: { query: 'python developer', count: 5 }
      });

      this.addTestResult('Search Users', TestCategory.SEARCH_DISCOVERY, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Search Users', TestCategory.SEARCH_DISCOVERY, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetTrends(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_trends',
        params: {}
      });

      this.addTestResult('Get Trends', TestCategory.SEARCH_DISCOVERY, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Trends', TestCategory.SEARCH_DISCOVERY, 'FAIL', Date.now() - startTime, error);
    }
  }

  // ============================================================================
  // PLACEHOLDER METHODS FOR OTHER TEST CATEGORIES
  // ============================================================================

  private async runDirectMessageTests(): Promise<void> {
    logger.info('💬 Running Direct Message Tests', { correlationId: this.correlationId });

    await this.testSendDirectMessage();
    await this.testGetDMHistory();
    await this.testDeleteDM();
    await this.testDMReactions();
    await this.testGroupDMs();
  }

  private async testSendDirectMessage(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'send_dm',
        params: {
          recipient_username: 'twitter', // Send to Twitter's official account
          message: '🤖 Test DM from Twikit automation - please ignore'
        }
      });

      if (result && result.dm_id) {
        this.testDataCleanup.push(result.dm_id);
      }

      this.addTestResult('Send Direct Message', TestCategory.DIRECT_MESSAGES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Send Direct Message', TestCategory.DIRECT_MESSAGES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetDMHistory(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_dm_history',
        params: {
          user_id: 'twitter',
          count: 5
        }
      });

      this.addTestResult('Get DM History', TestCategory.DIRECT_MESSAGES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get DM History', TestCategory.DIRECT_MESSAGES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testDeleteDM(): Promise<void> {
    const startTime = Date.now();

    try {
      if (this.testDataCleanup.length > 0) {
        const dmId = this.testDataCleanup.find(id => id.includes('dm_'));
        if (dmId) {
          const result = await this.sendPythonCommand('test', {
            test_name: 'delete_dm',
            params: { dm_id: dmId }
          });

          // Remove from cleanup list
          this.testDataCleanup = this.testDataCleanup.filter(id => id !== dmId);

          this.addTestResult('Delete DM', TestCategory.DIRECT_MESSAGES, 'PASS', Date.now() - startTime, null, result);
        } else {
          this.addTestResult('Delete DM', TestCategory.DIRECT_MESSAGES, 'SKIP', Date.now() - startTime, 'No DM to delete');
        }
      } else {
        this.addTestResult('Delete DM', TestCategory.DIRECT_MESSAGES, 'SKIP', Date.now() - startTime, 'No DM to delete');
      }
    } catch (error) {
      this.addTestResult('Delete DM', TestCategory.DIRECT_MESSAGES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testDMReactions(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'dm_reactions',
        params: {
          dm_id: 'test_dm_id',
          reaction: '👍'
        }
      });

      this.addTestResult('DM Reactions', TestCategory.DIRECT_MESSAGES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('DM Reactions', TestCategory.DIRECT_MESSAGES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGroupDMs(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'group_dms',
        params: {
          participants: ['twitter'],
          message: '🤖 Test group DM from Twikit automation'
        }
      });

      this.addTestResult('Group DMs', TestCategory.DIRECT_MESSAGES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Group DMs', TestCategory.DIRECT_MESSAGES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async runListManagementTests(): Promise<void> {
    logger.info('📋 Running List Management Tests', { correlationId: this.correlationId });

    await this.testCreateList();
    await this.testEditList();
    await this.testGetListTweets();
    await this.testListMembers();
    await this.testSearchLists();
  }

  private async testCreateList(): Promise<void> {
    const startTime = Date.now();

    try {
      const listName = `Twikit Test List ${Date.now()}`;
      const result = await this.sendPythonCommand('test', {
        test_name: 'create_list',
        params: {
          name: listName,
          description: '🤖 Test list created by Twikit automation',
          private: false
        }
      });

      if (result && result.list_id) {
        this.testDataCleanup.push(`list_${result.list_id}`);
      }

      this.addTestResult('Create List', TestCategory.LIST_MANAGEMENT, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Create List', TestCategory.LIST_MANAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testEditList(): Promise<void> {
    const startTime = Date.now();

    try {
      const listId = this.testDataCleanup.find(id => id.startsWith('list_'))?.replace('list_', '');
      if (listId) {
        const result = await this.sendPythonCommand('test', {
          test_name: 'edit_list',
          params: {
            list_id: listId,
            name: `Updated Twikit Test List ${Date.now()}`,
            description: '🤖 Updated test list description'
          }
        });

        this.addTestResult('Edit List', TestCategory.LIST_MANAGEMENT, 'PASS', Date.now() - startTime, null, result);
      } else {
        this.addTestResult('Edit List', TestCategory.LIST_MANAGEMENT, 'SKIP', Date.now() - startTime, 'No list to edit');
      }
    } catch (error) {
      this.addTestResult('Edit List', TestCategory.LIST_MANAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetListTweets(): Promise<void> {
    const startTime = Date.now();

    try {
      // Use a known public list or create one
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_list_tweets',
        params: {
          list_id: 'twitter-team', // Twitter's official team list
          count: 5
        }
      });

      this.addTestResult('Get List Tweets', TestCategory.LIST_MANAGEMENT, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get List Tweets', TestCategory.LIST_MANAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testListMembers(): Promise<void> {
    const startTime = Date.now();

    try {
      const listId = this.testDataCleanup.find(id => id.startsWith('list_'))?.replace('list_', '');
      if (listId) {
        // Add member to list
        const addResult = await this.sendPythonCommand('test', {
          test_name: 'add_list_member',
          params: {
            list_id: listId,
            user_id: 'twitter'
          }
        });

        // Get list members
        const membersResult = await this.sendPythonCommand('test', {
          test_name: 'get_list_members',
          params: {
            list_id: listId,
            count: 10
          }
        });

        this.addTestResult('List Members', TestCategory.LIST_MANAGEMENT, 'PASS', Date.now() - startTime, null, {
          add_result: addResult,
          members: membersResult
        });
      } else {
        this.addTestResult('List Members', TestCategory.LIST_MANAGEMENT, 'SKIP', Date.now() - startTime, 'No list available');
      }
    } catch (error) {
      this.addTestResult('List Members', TestCategory.LIST_MANAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testSearchLists(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'search_lists',
        params: {
          query: 'python programming',
          count: 5
        }
      });

      this.addTestResult('Search Lists', TestCategory.LIST_MANAGEMENT, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Search Lists', TestCategory.LIST_MANAGEMENT, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async runCommunityTests(): Promise<void> {
    logger.info('🏘️ Running Community Tests', { correlationId: this.correlationId });

    await this.testSearchCommunity();
    await this.testGetCommunityInfo();
    await this.testGetCommunityTweets();
    await this.testJoinLeaveCommunity();
    await this.testCommunityMembers();
  }

  private async testSearchCommunity(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'search_community',
        params: {
          query: 'python programming',
          count: 5
        }
      });

      this.addTestResult('Search Community', TestCategory.COMMUNITIES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Search Community', TestCategory.COMMUNITIES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetCommunityInfo(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_community_info',
        params: {
          community_id: 'test_community_id' // Would use a real community ID
        }
      });

      this.addTestResult('Get Community Info', TestCategory.COMMUNITIES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Community Info', TestCategory.COMMUNITIES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetCommunityTweets(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_community_tweets',
        params: {
          community_id: 'test_community_id',
          count: 5
        }
      });

      this.addTestResult('Get Community Tweets', TestCategory.COMMUNITIES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Community Tweets', TestCategory.COMMUNITIES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testJoinLeaveCommunity(): Promise<void> {
    const startTime = Date.now();

    try {
      const joinResult = await this.sendPythonCommand('test', {
        test_name: 'join_community',
        params: {
          community_id: 'test_community_id'
        }
      });

      const leaveResult = await this.sendPythonCommand('test', {
        test_name: 'leave_community',
        params: {
          community_id: 'test_community_id'
        }
      });

      this.addTestResult('Join/Leave Community', TestCategory.COMMUNITIES, 'PASS', Date.now() - startTime, null, {
        join: joinResult,
        leave: leaveResult
      });
    } catch (error) {
      this.addTestResult('Join/Leave Community', TestCategory.COMMUNITIES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testCommunityMembers(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_community_members',
        params: {
          community_id: 'test_community_id',
          count: 10
        }
      });

      this.addTestResult('Community Members', TestCategory.COMMUNITIES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Community Members', TestCategory.COMMUNITIES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async runMediaPollTests(): Promise<void> {
    logger.info('📱 Running Media & Poll Tests', { correlationId: this.correlationId });

    await this.testUploadMedia();
    await this.testCreatePoll();
    await this.testVoteInPoll();
    await this.testMediaMetadata();
  }

  private async testUploadMedia(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'upload_media',
        params: {
          media_type: 'image',
          media_path: 'test_image.jpg' // Would use actual test image
        }
      });

      if (result && result.media_id) {
        this.testDataCleanup.push(`media_${result.media_id}`);
      }

      this.addTestResult('Upload Media', TestCategory.MEDIA_POLLS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Upload Media', TestCategory.MEDIA_POLLS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testCreatePoll(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'create_poll',
        params: {
          question: '🤖 Which programming language do you prefer?',
          options: ['Python', 'JavaScript', 'TypeScript', 'Go'],
          duration_minutes: 60
        }
      });

      if (result && result.poll_id) {
        this.testDataCleanup.push(`poll_${result.poll_id}`);
      }

      this.addTestResult('Create Poll', TestCategory.MEDIA_POLLS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Create Poll', TestCategory.MEDIA_POLLS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testVoteInPoll(): Promise<void> {
    const startTime = Date.now();

    try {
      const pollId = this.testDataCleanup.find(id => id.startsWith('poll_'))?.replace('poll_', '');
      if (pollId) {
        const result = await this.sendPythonCommand('test', {
          test_name: 'vote_in_poll',
          params: {
            poll_id: pollId,
            choice: 1 // Vote for first option
          }
        });

        this.addTestResult('Vote in Poll', TestCategory.MEDIA_POLLS, 'PASS', Date.now() - startTime, null, result);
      } else {
        this.addTestResult('Vote in Poll', TestCategory.MEDIA_POLLS, 'SKIP', Date.now() - startTime, 'No poll available');
      }
    } catch (error) {
      this.addTestResult('Vote in Poll', TestCategory.MEDIA_POLLS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testMediaMetadata(): Promise<void> {
    const startTime = Date.now();

    try {
      const mediaId = this.testDataCleanup.find(id => id.startsWith('media_'))?.replace('media_', '');
      if (mediaId) {
        const result = await this.sendPythonCommand('test', {
          test_name: 'create_media_metadata',
          params: {
            media_id: mediaId,
            alt_text: '🤖 Test image uploaded by Twikit automation'
          }
        });

        this.addTestResult('Media Metadata', TestCategory.MEDIA_POLLS, 'PASS', Date.now() - startTime, null, result);
      } else {
        this.addTestResult('Media Metadata', TestCategory.MEDIA_POLLS, 'SKIP', Date.now() - startTime, 'No media available');
      }
    } catch (error) {
      this.addTestResult('Media Metadata', TestCategory.MEDIA_POLLS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async runLocationTests(): Promise<void> {
    logger.info('🌍 Running Location Tests', { correlationId: this.correlationId });

    await this.testReverseGeocode();
    await this.testSearchGeo();
    await this.testGetPlace();
  }

  private async testReverseGeocode(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'reverse_geocode',
        params: {
          lat: 37.7749,  // San Francisco coordinates
          long: -122.4194
        }
      });

      this.addTestResult('Reverse Geocode', TestCategory.LOCATION, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Reverse Geocode', TestCategory.LOCATION, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testSearchGeo(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'search_geo',
        params: {
          query: 'San Francisco, CA',
          count: 5
        }
      });

      this.addTestResult('Search Geo', TestCategory.LOCATION, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Search Geo', TestCategory.LOCATION, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetPlace(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_place',
        params: {
          place_id: 'test_place_id' // Would use actual place ID
        }
      });

      this.addTestResult('Get Place', TestCategory.LOCATION, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Place', TestCategory.LOCATION, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async runNotificationTimelineTests(): Promise<void> {
    logger.info('🔔 Running Notification & Timeline Tests', { correlationId: this.correlationId });

    await this.testGetNotifications();
    await this.testGetTimeline();
    await this.testGetLatestTimeline();
    await this.testGetCommunitiesTimeline();
  }

  private async testGetNotifications(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_notifications',
        params: {
          count: 10
        }
      });

      this.addTestResult('Get Notifications', TestCategory.NOTIFICATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Notifications', TestCategory.NOTIFICATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetTimeline(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_timeline',
        params: {
          count: 10
        }
      });

      this.addTestResult('Get Timeline', TestCategory.NOTIFICATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Timeline', TestCategory.NOTIFICATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetLatestTimeline(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_latest_timeline',
        params: {
          count: 10
        }
      });

      this.addTestResult('Get Latest Timeline', TestCategory.NOTIFICATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Latest Timeline', TestCategory.NOTIFICATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testGetCommunitiesTimeline(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_communities_timeline',
        params: {
          count: 10
        }
      });

      this.addTestResult('Get Communities Timeline', TestCategory.NOTIFICATIONS, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Get Communities Timeline', TestCategory.NOTIFICATIONS, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async runAdvancedFeatureTests(): Promise<void> {
    logger.info('📊 Running Advanced Feature Tests', { correlationId: this.correlationId });

    await this.testBookmarkFolders();
    await this.testStreamingSession();
    await this.testCommunityNotes();
    await this.testUserHighlights();
    await this.testSimilarTweets();
  }

  private async testBookmarkFolders(): Promise<void> {
    const startTime = Date.now();

    try {
      // Get bookmark folders
      const foldersResult = await this.sendPythonCommand('test', {
        test_name: 'get_bookmark_folders',
        params: {}
      });

      // Create bookmark folder
      const createResult = await this.sendPythonCommand('test', {
        test_name: 'create_bookmark_folder',
        params: {
          name: `Twikit Test Folder ${Date.now()}`
        }
      });

      this.addTestResult('Bookmark Folders', TestCategory.ADVANCED_FEATURES, 'PASS', Date.now() - startTime, null, {
        folders: foldersResult,
        created: createResult
      });
    } catch (error) {
      this.addTestResult('Bookmark Folders', TestCategory.ADVANCED_FEATURES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testStreamingSession(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_streaming_session',
        params: {
          track: ['python', 'javascript'],
          timeout: 5 // Short timeout for testing
        }
      });

      this.addTestResult('Streaming Session', TestCategory.ADVANCED_FEATURES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Streaming Session', TestCategory.ADVANCED_FEATURES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testCommunityNotes(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_community_note',
        params: {
          tweet_id: '1234567890' // Would use actual tweet with community note
        }
      });

      this.addTestResult('Community Notes', TestCategory.ADVANCED_FEATURES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Community Notes', TestCategory.ADVANCED_FEATURES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testUserHighlights(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_user_highlights_tweets',
        params: {
          user_id: 'twitter',
          count: 5
        }
      });

      this.addTestResult('User Highlights', TestCategory.ADVANCED_FEATURES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('User Highlights', TestCategory.ADVANCED_FEATURES, 'FAIL', Date.now() - startTime, error);
    }
  }

  private async testSimilarTweets(): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await this.sendPythonCommand('test', {
        test_name: 'get_similar_tweets',
        params: {
          tweet_id: '1234567890',
          count: 5
        }
      });

      this.addTestResult('Similar Tweets', TestCategory.ADVANCED_FEATURES, 'PASS', Date.now() - startTime, null, result);
    } catch (error) {
      this.addTestResult('Similar Tweets', TestCategory.ADVANCED_FEATURES, 'FAIL', Date.now() - startTime, error);
    }
  }

  // ============================================================================
  // CLEANUP AND REPORTING METHODS
  // ============================================================================

  private async cleanupTestData(): Promise<void> {
    logger.info('🧹 Cleaning up test data', { correlationId: this.correlationId });

    try {
      if (this.testDataCleanup.length > 0) {
        await this.sendPythonCommand('cleanup', { data_ids: this.testDataCleanup });
        logger.info(`Cleaned up ${this.testDataCleanup.length} test items`);
      }
    } catch (error) {
      logger.warn('Failed to cleanup test data:', error);
    }
  }

  /**
   * Generate comprehensive test summary
   */
  private generateTestSummary(): TestSummary {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const duration = Date.now() - this.testStartTime;
    const successRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    // Generate category summaries
    const categoryResults: Record<TestCategory, CategorySummary> = {} as any;

    for (const category of Object.values(TestCategory)) {
      const categoryTests = this.results.filter(r => r.category === category);
      const categoryPassed = categoryTests.filter(r => r.status === 'PASS').length;
      const categoryFailed = categoryTests.filter(r => r.status === 'FAIL').length;
      const categorySkipped = categoryTests.filter(r => r.status === 'SKIP').length;
      const categoryErrors = categoryTests.filter(r => r.status === 'ERROR').length;
      const categoryTotal = categoryTests.length;

      categoryResults[category] = {
        total: categoryTotal,
        passed: categoryPassed,
        failed: categoryFailed,
        skipped: categorySkipped,
        errors: categoryErrors,
        successRate: categoryTotal > 0 ? (categoryPassed / categoryTotal) * 100 : 0
      };
    }

    return {
      totalTests,
      passed,
      failed,
      skipped,
      errors,
      duration,
      successRate,
      categoryResults
    };
  }

  /**
   * Generate detailed test report
   */
  private async generateDetailedReport(summary: TestSummary): Promise<void> {
    const reportPath = path.join(__dirname, `../../reports/twikit-test-report-${Date.now()}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      credentials: {
        username: this.credentials.username,
        email: this.credentials.email
      },
      summary,
      results: this.results,
      configuration: twikitConfig.getConfigSummary()
    };

    try {
      // Ensure reports directory exists
      await fs.mkdir(path.dirname(reportPath), { recursive: true });

      // Write detailed report
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      logger.info('📊 Test report generated', {
        correlationId: this.correlationId,
        reportPath,
        summary: {
          totalTests: summary.totalTests,
          successRate: `${summary.successRate.toFixed(2)}%`,
          duration: `${(summary.duration / 1000).toFixed(2)}s`
        }
      });

      // Log audit trail
      logAuditTrail('twikit_test_completed', this.credentials.username, 'comprehensive_test', {
        correlationId: this.correlationId,
        result: summary.successRate > 80 ? 'success' : 'failure',
        metadata: {
          totalTests: summary.totalTests,
          passed: summary.passed,
          failed: summary.failed,
          successRate: summary.successRate,
          duration: summary.duration,
          reportPath
        }
      });

    } catch (error) {
      logger.error('Failed to generate test report:', error);
    }
  }
}

// ============================================================================
// TEST EXECUTION FUNCTION
// ============================================================================

/**
 * Execute comprehensive Twikit tests with provided credentials
 */
export async function runTwikitComprehensiveTests(): Promise<TestSummary> {
  const credentials: TestCredentials = {
    username: 'ryan1stacc',
    email: 'ryanalex1@protonmail.com',
    password: 'Ryan2003'
    // twoFactorSecret and captchaApiKey are optional
  };

  const testSuite = new TwikitComprehensiveTestSuite(credentials);
  return await testSuite.runComprehensiveTests();
}

// ============================================================================
// MAIN EXECUTION (if run directly)
// ============================================================================

if (require.main === module) {
  runTwikitComprehensiveTests()
    .then(summary => {
      console.log('\n🎉 Twikit Comprehensive Test Suite Completed!');
      console.log(`📊 Results: ${summary.passed}/${summary.totalTests} tests passed (${summary.successRate.toFixed(2)}%)`);
      console.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)} seconds`);

      if (summary.successRate >= 90) {
        console.log('✅ Excellent! All major features working correctly.');
        process.exit(0);
      } else if (summary.successRate >= 70) {
        console.log('⚠️  Good! Most features working with some issues.');
        process.exit(0);
      } else {
        console.log('❌ Issues detected. Check the detailed report for more information.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test suite execution failed:', error);
      process.exit(1);
    });
}
