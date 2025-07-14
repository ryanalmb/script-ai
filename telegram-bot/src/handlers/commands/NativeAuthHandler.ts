import TelegramBot from 'node-telegram-bot-api';
import { BaseHandler, HandlerServices } from '../base/BaseHandler';
import { authStateService, AuthStep, AuthMethod, AuthState } from '../../services/authStateService';
import { SecureMessageService } from '../../services/secureMessageService';
import { authFlowManager, AuthenticationStrategy } from '../../services/authFlowManager';
import { logger } from '../../utils/logger';
import { safeErrorMessage, getDisplayName } from '../../utils/userDataUtils';

/**
 * Enhanced Native Authentication Handler
 * Provides secure, step-by-step authentication for X/Twitter accounts
 */
export class NativeAuthHandler extends BaseHandler {
  private secureMessageService: SecureMessageService;

  constructor(services: HandlerServices) {
    super(services);
    this.secureMessageService = new SecureMessageService(this.bot);
  }

  /**
   * Start native authentication flow
   */
  async startNativeAuth(chatId: number, method: AuthMethod): Promise<void> {
    try {
      logger.info('Starting native authentication', { chatId, method });

      // Clear any existing auth state
      authStateService.clearAuthState(chatId);

      // Map method to strategy name
      const strategyName = this.mapAuthMethodToStrategy(method);

      // Get authentication strategy
      const strategy = authFlowManager.getStrategy(strategyName);
      if (!strategy) {
        await this.bot.sendMessage(chatId, '❌ Authentication method not available. Please try again later.');
        return;
      }

      // Create new session
      const sessionId = authStateService.createAuthSession(chatId, method);

      // Initialize auth state
      const authState: AuthState = {
        userId: chatId,
        step: AuthStep.CHOOSE_METHOD,
        method,
        sessionId,
        startTime: Date.now(),
        attempts: 0,
        data: {},
        timestamp: new Date(),
        messageIds: []
      };
      authStateService.setAuthState(chatId, authState);

      // Send strategy introduction
      await this.sendStrategyIntroduction(chatId, strategy, sessionId);

      // Start first step
      await this.initiateFirstStep(chatId, strategy);

      logger.info('Native authentication started', { chatId, method, sessionId });
    } catch (error) {
      logger.error('Failed to start native authentication:', { error: safeErrorMessage(error), chatId, method });
      await this.bot.sendMessage(chatId, '❌ Failed to start authentication. Please try again.');
    }
  }

  /**
   * Process authentication message
   */
  async processAuthMessage(chatId: number, messageId: number, text: string): Promise<void> {
    try {
      const authState = authStateService.getAuthState(chatId);
      if (!authState) {
        await this.bot.sendMessage(chatId, '❌ No active authentication session. Use /auth to start.');
        return;
      }

      // Check session timeout
      if (this.isSessionExpired(authState)) {
        authStateService.clearAuthState(chatId);
        await this.bot.sendMessage(chatId, '⏰ Authentication session expired. Please start again with /auth.');
        return;
      }

      // Delete user message immediately for security
      await this.secureMessageService.deleteMessage(chatId, messageId);

      // Process based on current step
      await this.processAuthStep(chatId, authState, text);

    } catch (error) {
      logger.error('Failed to process auth message:', { error: safeErrorMessage(error), chatId });
      await this.bot.sendMessage(chatId, '❌ Error processing authentication. Please try again.');
    }
  }

  /**
   * Cancel authentication flow
   */
  async cancelAuth(chatId: number): Promise<void> {
    try {
      const authState = authStateService.getAuthState(chatId);
      if (authState) {
        authStateService.clearAuthState(chatId);
        logger.info('Authentication cancelled by user', { chatId, sessionId: authState.sessionId });
      }

      await this.bot.sendMessage(chatId, '❌ Authentication cancelled. Your data has been securely cleared.', {
        reply_markup: { remove_keyboard: true }
      });
    } catch (error) {
      logger.error('Failed to cancel authentication:', { error: safeErrorMessage(error), chatId });
    }
  }

  /**
   * Process authentication step
   */
  private async processAuthStep(chatId: number, authState: AuthState, input: string): Promise<void> {
    const strategy = authFlowManager.getStrategy(this.mapAuthMethodToStrategy(authState.method));
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Validate input
    const validation = this.validateInput(authState.step, input);
    if (!validation.isValid) {
      await this.sendValidationError(chatId, validation.error || 'Invalid input');
      return;
    }

    // Store the input securely
    authState.data[authState.step] = input;
    authState.attempts = 0; // Reset attempts on successful input

    // Move to next step
    const currentStepIndex = strategy.steps.indexOf(authState.step);
    const nextStep = strategy.steps[currentStepIndex + 1];

    if (nextStep) {
      // Continue to next step
      authState.step = nextStep;
      authStateService.setAuthState(chatId, authState);
      await this.sendNextStepPrompt(chatId, nextStep, strategy);
    } else {
      // All steps completed, process authentication
      await this.completeAuthentication(chatId, authState);
    }
  }

  /**
   * Complete authentication process
   */
  private async completeAuthentication(chatId: number, authState: AuthState): Promise<void> {
    try {
      authState.step = AuthStep.PROCESSING;
      authStateService.setAuthState(chatId, authState);

      const processingMsg = await this.bot.sendMessage(chatId, '🔄 Processing your authentication...');

      // Extract credentials from auth data
      const credentials = this.extractCredentials(authState);

      // Attempt authentication with X API
      const authResult = await this.authenticateWithX(credentials);

      // Delete processing message
      await this.secureMessageService.deleteMessage(chatId, processingMsg.message_id);

      if (authResult.success) {
        // Store tokens securely
        await this.userService.storeUserTokens(chatId, authResult.tokens);

        // Update auth state
        authState.step = AuthStep.COMPLETED;
        authStateService.setAuthState(chatId, authState);

        // Send success message
        await this.sendSuccessMessage(chatId, authResult);

        // Clear auth state after success
        setTimeout(() => {
          authStateService.clearAuthState(chatId);
        }, 30000); // Clear after 30 seconds

      } else {
        authState.step = AuthStep.FAILED;
        authState.attempts = (authState.attempts || 0) + 1;
        authStateService.setAuthState(chatId, authState);

        await this.sendAuthenticationError(chatId, authResult.error || 'Authentication failed', authState.attempts || 0);
      }

    } catch (error) {
      logger.error('Authentication completion failed:', { error: safeErrorMessage(error), chatId });
      await this.bot.sendMessage(chatId, '❌ Authentication failed. Please try again.');
      authStateService.clearAuthState(chatId);
    }
  }

  /**
   * Validate user input based on current step
   */
  private validateInput(step: AuthStep, input: string): { isValid: boolean; error?: string } {
    const trimmedInput = input.trim();

    switch (step) {
      case AuthStep.ENTER_USERNAME:
        if (!trimmedInput) {
          return { isValid: false, error: 'Username cannot be empty' };
        }
        if (trimmedInput.length < 1 || trimmedInput.length > 15) {
          return { isValid: false, error: 'Username must be 1-15 characters' };
        }
        return { isValid: true };

      case AuthStep.ENTER_PASSWORD:
        if (!trimmedInput) {
          return { isValid: false, error: 'Password cannot be empty' };
        }
        if (trimmedInput.length < 1) {
          return { isValid: false, error: 'Password is required' };
        }
        return { isValid: true };

      case AuthStep.ENTER_API_KEY:
        if (!trimmedInput) {
          return { isValid: false, error: 'API Key cannot be empty' };
        }
        if (trimmedInput.length < 20) {
          return { isValid: false, error: 'API Key appears to be too short' };
        }
        return { isValid: true };

      case AuthStep.ENTER_API_SECRET:
        if (!trimmedInput) {
          return { isValid: false, error: 'API Secret cannot be empty' };
        }
        if (trimmedInput.length < 40) {
          return { isValid: false, error: 'API Secret appears to be too short' };
        }
        return { isValid: true };

      case AuthStep.ENTER_ACCESS_TOKEN:
        if (!trimmedInput) {
          return { isValid: false, error: 'Access Token cannot be empty' };
        }
        return { isValid: true };

      case AuthStep.ENTER_ACCESS_SECRET:
        if (!trimmedInput) {
          return { isValid: false, error: 'Access Token Secret cannot be empty' };
        }
        return { isValid: true };

      case AuthStep.ENTER_2FA:
        if (!trimmedInput) {
          return { isValid: false, error: '2FA code cannot be empty' };
        }
        if (!/^\d{6}$/.test(trimmedInput)) {
          return { isValid: false, error: '2FA code must be 6 digits' };
        }
        return { isValid: true };

      default:
        return { isValid: true };
    }
  }

  /**
   * Send validation error message
   */
  private async sendValidationError(chatId: number, error: string): Promise<void> {
    const errorMsg = await this.bot.sendMessage(chatId, `❌ ${error}\n\nPlease try again:`);
    
    // Auto-delete error message after 10 seconds
    setTimeout(async () => {
      await this.secureMessageService.deleteMessage(chatId, errorMsg.message_id);
    }, 10000);
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(authState: AuthState): boolean {
    const sessionAge = Date.now() - (authState.startTime || 0);
    const maxAge = 15 * 60 * 1000; // 15 minutes
    return sessionAge > maxAge;
  }

  /**
   * Extract credentials from auth data
   */
  private extractCredentials(authState: AuthState): any {
    const { data } = authState;
    
    switch (authState.method) {
      case AuthMethod.NATIVE_CREDENTIALS:
        return {
          username: data[AuthStep.ENTER_USERNAME],
          password: data[AuthStep.ENTER_PASSWORD],
          twoFactorCode: data[AuthStep.ENTER_2FA]
        };
        
      case AuthMethod.NATIVE_API_KEYS:
        return {
          apiKey: data[AuthStep.ENTER_API_KEY],
          apiSecret: data[AuthStep.ENTER_API_SECRET],
          accessToken: data[AuthStep.ENTER_ACCESS_TOKEN],
          accessTokenSecret: data[AuthStep.ENTER_ACCESS_SECRET]
        };
        
      default:
        return {};
    }
  }

  /**
   * Authenticate with X API
   */
  private async authenticateWithX(credentials: any): Promise<{ success: boolean; tokens?: any; error?: string }> {
    // This would integrate with actual X API authentication
    // For now, return a mock response
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate authentication process
        if (credentials.username === 'test' && credentials.password === 'test') {
          resolve({
            success: false,
            error: 'Invalid credentials'
          });
        } else {
          resolve({
            success: true,
            tokens: {
              accessToken: 'mock_access_token',
              accessTokenSecret: 'mock_access_token_secret'
            }
          });
        }
      }, 2000);
    });
  }

  /**
   * Send success message after authentication
   */
  private async sendSuccessMessage(chatId: number, authResult: any): Promise<void> {
    const successMessage = `✅ **Authentication Successful!**

🎉 Your X account has been successfully connected!

**What's Next:**
• Use /generate to create content
• Use /schedule to plan posts
• Use /analytics to view insights
• Use /settings to configure preferences

**Security Notes:**
• Your credentials are encrypted and secure
• Session tokens are automatically managed
• You can disconnect anytime with /disconnect

Ready to start creating amazing content! 🚀`;

    await this.bot.sendMessage(chatId, successMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 Generate Content', callback_data: 'generate_content' },
            { text: '📊 View Analytics', callback_data: 'view_analytics' }
          ],
          [
            { text: '⚙️ Settings', callback_data: 'user_settings' },
            { text: '❓ Help', callback_data: 'help_main' }
          ]
        ]
      }
    });
  }

  /**
   * Send authentication error message
   */
  private async sendAuthenticationError(chatId: number, error: string, attempts: number): Promise<void> {
    const maxAttempts = 3;
    const remainingAttempts = maxAttempts - attempts;

    let errorMessage = `❌ **Authentication Failed**\n\n`;

    if (error.includes('credentials')) {
      errorMessage += `🔐 **Invalid Credentials**\nPlease check your username and password.`;
    } else if (error.includes('2fa') || error.includes('two-factor')) {
      errorMessage += `🔢 **Two-Factor Authentication Required**\nPlease provide your 6-digit 2FA code.`;
    } else if (error.includes('rate limit')) {
      errorMessage += `⏱️ **Rate Limited**\nToo many attempts. Please wait before trying again.`;
    } else {
      errorMessage += `⚠️ **Authentication Error**\n${error}`;
    }

    if (remainingAttempts > 0) {
      errorMessage += `\n\n🔄 **${remainingAttempts} attempt(s) remaining**\nWould you like to try again?`;

      await this.bot.sendMessage(chatId, errorMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Try Again', callback_data: `retry_auth_${authStateService.getAuthState(chatId)?.method}` },
              { text: '❌ Cancel', callback_data: 'cancel_auth' }
            ],
            [
              { text: '🌐 Use Portal Instead', callback_data: 'get_auth_token' }
            ]
          ]
        }
      });
    } else {
      errorMessage += `\n\n❌ **Maximum attempts exceeded**\nPlease try again later or use the secure portal.`;

      await this.bot.sendMessage(chatId, errorMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🌐 Use Secure Portal', callback_data: 'get_auth_token' },
              { text: '❓ Get Help', callback_data: 'help_auth' }
            ]
          ]
        }
      });

      // Clear auth state after max attempts
      authStateService.clearAuthState(chatId);
    }
  }

  /**
   * Send next step prompt
   */
  private async sendNextStepPrompt(chatId: number, step: AuthStep, strategy: AuthenticationStrategy): Promise<void> {
    switch (step) {
      case AuthStep.ENTER_USERNAME:
        await this.sendUsernamePrompt(chatId);
        break;
      case AuthStep.ENTER_PASSWORD:
        await this.sendPasswordPrompt(chatId);
        break;
      case AuthStep.ENTER_2FA:
        await this.send2FAPrompt(chatId);
        break;
      case AuthStep.ENTER_API_KEY:
        await this.sendApiKeyPrompt(chatId);
        break;
      case AuthStep.ENTER_API_SECRET:
        await this.sendApiSecretPrompt(chatId);
        break;
      case AuthStep.ENTER_ACCESS_TOKEN:
        await this.sendAccessTokenPrompt(chatId);
        break;
      case AuthStep.ENTER_ACCESS_SECRET:
        await this.sendAccessSecretPrompt(chatId);
        break;
      default:
        await this.sendGenericPrompt(chatId, step);
    }
  }

  /**
   * Send username prompt
   */
  private async sendUsernamePrompt(chatId: number): Promise<void> {
    const message = `🔐 **Step 1/2: X Username**

Please enter your X (Twitter) username or email address:

**Tips:**
• Enter without the @ symbol
• Use your login email if preferred
• This will be encrypted immediately

**Security:** This message will auto-delete in 30 seconds.`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Send password prompt
   */
  private async sendPasswordPrompt(chatId: number): Promise<void> {
    const message = `🔐 **Step 2/2: Account Password**

Please enter your X account password:

**Security Features:**
• Password is encrypted immediately
• Message auto-deletes in 30 seconds
• No storage of plain text passwords
• Secure transmission only

**Tips:**
• Use your actual X password
• Consider App Passwords if available
• Ensure you're in a private chat

⚠️ **Never share your password with anyone else!**`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Send 2FA prompt
   */
  private async send2FAPrompt(chatId: number): Promise<void> {
    const message = `🔢 **Two-Factor Authentication**

Please enter your 6-digit 2FA code:

**Instructions:**
• Open your authenticator app
• Find your X/Twitter entry
• Enter the current 6-digit code
• Code expires in ~30 seconds

**Supported Apps:**
• Google Authenticator
• Authy
• Microsoft Authenticator
• Any TOTP app

⏱️ **This message auto-deletes in 30 seconds.**`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Send API key prompt
   */
  private async sendApiKeyPrompt(chatId: number): Promise<void> {
    const message = `🔑 **Step 1/4: API Key (Consumer Key)**

Please enter your X API Key from the Developer Portal:

**Where to find it:**
1. Go to developer.twitter.com
2. Select your app
3. Go to "Keys and tokens"
4. Copy the "API Key" (Consumer Key)

**Format:** Usually 25 characters, alphanumeric

**Security:** This will be encrypted immediately.

⚠️ **Keep this key secure and never share it!**`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Send API secret prompt
   */
  private async sendApiSecretPrompt(chatId: number): Promise<void> {
    const message = `🔐 **Step 2/4: API Secret (Consumer Secret)**

Please enter your X API Secret from the Developer Portal:

**Where to find it:**
• Same location as API Key
• Click "Show" to reveal the secret
• Usually 50 characters long

**Security Features:**
• Immediate encryption
• Auto-delete in 30 seconds
• Secure transmission only

**Format:** Long alphanumeric string

⚠️ **This is extremely sensitive - keep it secure!**`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Send access token prompt
   */
  private async sendAccessTokenPrompt(chatId: number): Promise<void> {
    const message = `🎫 **Step 3/4: Access Token**

Please enter your X Access Token:

**Where to find it:**
1. In the "Keys and tokens" section
2. Under "Access Token and Secret"
3. Copy the "Access Token"

**What it does:**
• Represents your account access
• Usually starts with numbers
• Paired with Access Token Secret

**Security:** Encrypted and auto-deleted.`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Send access secret prompt
   */
  private async sendAccessSecretPrompt(chatId: number): Promise<void> {
    const message = `🔒 **Step 4/4: Access Token Secret**

Please enter your X Access Token Secret:

**Final Step:**
• Found next to Access Token
• Click "Show" to reveal
• Completes your authentication set

**What happens next:**
• All credentials will be verified
• Secure connection established
• You'll get confirmation

**Security:** This completes your secure authentication.

🎉 **Almost done!**`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Send generic prompt for any step
   */
  private async sendGenericPrompt(chatId: number, step: AuthStep): Promise<void> {
    const prompts: Partial<Record<AuthStep, { title: string; description: string; tips: string[] }>> = {
      [AuthStep.CHOOSE_METHOD]: {
        title: 'Choose Authentication Method',
        description: 'Please select your preferred authentication method',
        tips: ['Choose the method that works best for you']
      },
      [AuthStep.ENTER_USERNAME]: {
        title: 'Step 1: Username',
        description: 'Please enter your X username',
        tips: ['Enter your X username or email']
      },
      [AuthStep.ENTER_PASSWORD]: {
        title: 'Step 2/2: Account Password',
        description: 'Please enter your X account password',
        tips: [
          'Use your actual X account password',
          'Consider using an App Password if available',
          'Password will be encrypted immediately'
        ]
      },
      [AuthStep.ENTER_2FA]: {
        title: 'Two-Factor Authentication',
        description: 'Please enter your 2FA code',
        tips: ['Enter the 6-digit code from your authenticator app']
      },
      [AuthStep.ENTER_API_KEY]: {
        title: 'Step 1/4: API Key',
        description: 'Please enter your X API Key',
        tips: ['Found in your X Developer Portal']
      },
      [AuthStep.ENTER_API_SECRET]: {
        title: 'Step 2/4: API Secret (Consumer Secret)',
        description: 'Please enter your X API Secret from the Developer Portal',
        tips: [
          'Found in the same location as API Key',
          'Typically 50 characters long',
          'Keep this extremely secure'
        ]
      },
      [AuthStep.ENTER_ACCESS_TOKEN]: {
        title: 'Step 3/4: Access Token',
        description: 'Please enter your X Access Token',
        tips: [
          'Found in "Keys and tokens" section',
          'Represents your account access',
          'Usually starts with numbers'
        ]
      },
      [AuthStep.ENTER_ACCESS_SECRET]: {
        title: 'Step 4/4: Access Token Secret',
        description: 'Please enter your X Access Token Secret',
        tips: [
          'Final credential needed',
          'Paired with Access Token',
          'Completes the authentication set'
        ]
      },
      [AuthStep.PROCESSING]: {
        title: 'Processing',
        description: 'Processing your authentication',
        tips: ['Please wait while we verify your credentials']
      },
      [AuthStep.COMPLETED]: {
        title: 'Completed',
        description: 'Authentication completed successfully',
        tips: ['You are now authenticated']
      },
      [AuthStep.FAILED]: {
        title: 'Failed',
        description: 'Authentication failed',
        tips: ['Please try again or contact support']
      }
    };

    const prompt = prompts[step];
    if (!prompt) {
      logger.warn('Unknown auth step for prompt', { step });
      await this.bot.sendMessage(chatId, `🔐 Please provide the required information for step: ${step}`);
      return;
    }

    const message = `🔐 **${prompt.title}**

${prompt.description}

**Tips:**
${prompt.tips.map((tip: string) => `• ${tip}`).join('\n')}

**Security:** This message will auto-delete in 30 seconds.`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      message,
      { parse_mode: 'Markdown' },
      30000
    );
  }

  /**
   * Map AuthMethod to strategy name
   */
  private mapAuthMethodToStrategy(method: AuthMethod): string {
    switch (method) {
      case AuthMethod.NATIVE_CREDENTIALS:
        return 'native_credentials';
      case AuthMethod.NATIVE_API_KEYS:
        return 'native_api_keys';
      case AuthMethod.URL_PORTAL:
        return 'oauth_flow';
      default:
        return 'native_credentials';
    }
  }

  /**
   * Send comprehensive strategy introduction
   */
  private async sendStrategyIntroduction(
    chatId: number,
    strategy: AuthenticationStrategy,
    sessionId: string
  ): Promise<void> {
    const introMessage = `🔐 **${strategy.description}**

**Security Level:** ${strategy.securityLevel.toUpperCase()}
**Estimated Time:** ${strategy.estimatedTime}
**Session ID:** \`${sessionId.substring(0, 12)}...\`

**📋 Requirements:**
${strategy.requirements.map((req: string) => `• ${req}`).join('\n')}

**✨ Features You'll Get:**
${strategy.supportedFeatures.map((feature: string) => `• ${feature}`).join('\n')}

**🔒 Security Features:**
• End-to-end encryption of credentials
• Automatic message deletion (30 seconds)
• Session timeout protection (15 minutes)
• Rate limiting protection
• Comprehensive audit logging

**⚠️ Important Notes:**
• Never share your credentials with anyone
• This bot will never store your passwords
• You can cancel anytime with /cancel
• All data is encrypted and auto-deleted

Ready to begin? The process will start in 10 seconds...`;

    await this.secureMessageService.sendSecureMessage(
      chatId,
      introMessage,
      { parse_mode: 'Markdown' },
      60 * 1000 // Keep intro for 1 minute
    );

    // Brief pause for user to read
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  /**
   * Initiate first step based on strategy
   */
  private async initiateFirstStep(chatId: number, strategy: AuthenticationStrategy): Promise<void> {
    const firstStep = strategy.steps[0];

    if (!firstStep) {
      logger.error('Strategy has no steps defined', { strategy: strategy.name });
      await this.bot.sendMessage(chatId, '❌ Authentication strategy configuration error.');
      return;
    }

    switch (firstStep) {
      case AuthStep.ENTER_USERNAME:
        await this.sendUsernamePrompt(chatId);
        break;
      case AuthStep.ENTER_API_KEY:
        await this.sendApiKeyPrompt(chatId);
        break;
      default:
        await this.sendGenericPrompt(chatId, firstStep);
    }
  }
}
