import { RealXApiClient, XUserProfile } from './realXApiClient';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import crypto from 'crypto';

export interface AccountCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AccountStatus {
  id: string;
  username: string;
  status: 'active' | 'suspended' | 'limited' | 'authentication_failed' | 'error';
  isAuthenticated: boolean;
  lastActivity: Date | null;
  profile: XUserProfile | null;
  health: {
    healthy: boolean;
    message?: string;
    lastCheck: Date;
  };
  metrics: {
    followersCount: number;
    followingCount: number;
    tweetsCount: number;
    lastUpdated: Date;
  };
}

/**
 * Real Account Service that manages X/Twitter accounts
 * Replaces the mock accountSimulatorService with actual functionality
 */
export class RealAccountService {
  private clients: Map<string, RealXApiClient> = new Map();
  private accountStatuses: Map<string, AccountStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadAccountsFromDatabase();
    this.startHealthCheckInterval();
  }

  /**
   * Load accounts from database and initialize clients
   */
  private async loadAccountsFromDatabase(): Promise<void> {
    try {
      const accounts = await prisma.xAccount.findMany({
        where: { isActive: true },
        include: { user: true }
      });

      for (const account of accounts) {
        if (account.username && account.user.email) {
          // Initialize account status
          const status: AccountStatus = {
            id: account.id,
            username: account.username,
            status: 'active',
            isAuthenticated: false,
            lastActivity: account.lastActivity,
            profile: null,
            health: {
              healthy: true,
              lastCheck: new Date()
            },
            metrics: {
              followersCount: 0,
              followingCount: 0,
              tweetsCount: 0,
              lastUpdated: new Date()
            }
          };

          this.accountStatuses.set(account.id, status);

          // Create X client (password would need to be stored securely)
          const credentials: AccountCredentials = {
            username: account.username,
            email: account.user.email,
            password: '' // This needs to be implemented with secure storage
          };

          const client = new RealXApiClient(account.id, credentials);
          this.clients.set(account.id, client);
        }
      }

      logger.info(`Loaded ${this.accountStatuses.size} X accounts`);
    } catch (error) {
      logger.error('Failed to load accounts from database:', error);
    }
  }

  /**
   * Add a new X account
   */
  async addAccount(
    userId: string,
    credentials: AccountCredentials,
    telegramUserId?: number
  ): Promise<{ success: boolean; accountId?: string; error?: string }> {
    try {
      // Create account record in database
      const account = await prisma.xAccount.create({
        data: {
          userId,
          username: credentials.username,
          email: credentials.email,
          // Password should be encrypted before storing
          accessToken: this.encryptPassword(credentials.password),
          isActive: true,
          status: 'pending_verification',
          createdAt: new Date()
        }
      });

      // Create X client
      const client = new RealXApiClient(account.id, credentials);
      
      // Test authentication
      const authenticated = await client.authenticate();
      
      if (authenticated) {
        // Get user profile
        const profile = await client.getUserProfile(credentials.username);
        
        // Initialize account status
        const status: AccountStatus = {
          id: account.id,
          username: credentials.username,
          status: 'active',
          isAuthenticated: true,
          lastActivity: new Date(),
          profile,
          health: {
            healthy: true,
            lastCheck: new Date()
          },
          metrics: {
            followersCount: profile?.followersCount || 0,
            followingCount: profile?.followingCount || 0,
            tweetsCount: profile?.tweetsCount || 0,
            lastUpdated: new Date()
          }
        };

        this.accountStatuses.set(account.id, status);
        this.clients.set(account.id, client);

        // Update database
        await prisma.xAccount.update({
          where: { id: account.id },
          data: {
            status: 'active',
            isActive: true,
            lastActivity: new Date()
          }
        });

        logger.info(`Successfully added X account: ${credentials.username}`);
        
        return {
          success: true,
          accountId: account.id
        };
      } else {
        // Authentication failed
        await prisma.xAccount.update({
          where: { id: account.id },
          data: { status: 'authentication_failed' }
        });

        return {
          success: false,
          error: 'Failed to authenticate with X. Please check your credentials.'
        };
      }
    } catch (error) {
      logger.error('Failed to add X account:', error);
      return {
        success: false,
        error: 'Failed to add account. Please try again.'
      };
    }
  }

  /**
   * Remove an X account
   */
  async removeAccount(accountId: string): Promise<boolean> {
    try {
      // Remove from database
      await prisma.xAccount.update({
        where: { id: accountId },
        data: { isActive: false }
      });

      // Remove from memory
      this.accountStatuses.delete(accountId);
      this.clients.delete(accountId);

      logger.info(`Removed X account: ${accountId}`);
      return true;
    } catch (error) {
      logger.error('Failed to remove X account:', error);
      return false;
    }
  }

  /**
   * Get account status
   */
  getAccountStatus(accountId: string): AccountStatus | null {
    return this.accountStatuses.get(accountId) || null;
  }

  /**
   * Get all account statuses
   */
  getAllAccountStatuses(): AccountStatus[] {
    return Array.from(this.accountStatuses.values());
  }

  /**
   * Get X client for an account
   */
  getClient(accountId: string): RealXApiClient | null {
    return this.clients.get(accountId) || null;
  }

  /**
   * Authenticate an account
   */
  async authenticateAccount(accountId: string): Promise<boolean> {
    const client = this.clients.get(accountId);
    const status = this.accountStatuses.get(accountId);
    
    if (!client || !status) {
      return false;
    }

    try {
      const authenticated = await client.authenticate();
      
      if (authenticated) {
        status.isAuthenticated = true;
        status.status = 'active';
        status.lastActivity = new Date();
        
        // Update profile
        const profile = await client.getUserProfile(status.username);
        if (profile) {
          status.profile = profile;
          status.metrics = {
            followersCount: profile.followersCount,
            followingCount: profile.followingCount,
            tweetsCount: profile.tweetsCount,
            lastUpdated: new Date()
          };
        }
        
        this.accountStatuses.set(accountId, status);
        
        // Update database
        await prisma.xAccount.update({
          where: { id: accountId },
          data: {
            status: 'active',
            lastActivity: new Date()
          }
        });
        
        return true;
      } else {
        status.isAuthenticated = false;
        status.status = 'authentication_failed';
        this.accountStatuses.set(accountId, status);
        
        await prisma.xAccount.update({
          where: { id: accountId },
          data: { status: 'authentication_failed' }
        });
        
        return false;
      }
    } catch (error) {
      logger.error(`Authentication failed for account ${accountId}:`, error);
      
      status.isAuthenticated = false;
      status.status = 'error';
      this.accountStatuses.set(accountId, status);
      
      return false;
    }
  }

  /**
   * Check health of all accounts
   */
  async checkAllAccountsHealth(): Promise<void> {
    const promises = Array.from(this.clients.keys()).map(accountId => 
      this.checkAccountHealth(accountId)
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Check health of a specific account
   */
  async checkAccountHealth(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    const status = this.accountStatuses.get(accountId);
    
    if (!client || !status) {
      return;
    }

    try {
      const health = await client.checkAccountHealth();
      
      status.health = {
        healthy: health.healthy,
        message: health.message,
        lastCheck: new Date()
      };

      if (!health.healthy) {
        status.status = health.status as any;
        logger.warn(`Account ${accountId} health issue: ${health.message}`);
      }

      this.accountStatuses.set(accountId, status);
      
      // Update database
      await prisma.xAccount.update({
        where: { id: accountId },
        data: {
          status: status.status,
          lastActivity: new Date()
        }
      });
    } catch (error) {
      logger.error(`Health check failed for account ${accountId}:`, error);
      
      status.health = {
        healthy: false,
        message: 'Health check failed',
        lastCheck: new Date()
      };
      
      this.accountStatuses.set(accountId, status);
    }
  }

  /**
   * Update account metrics
   */
  async updateAccountMetrics(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    const status = this.accountStatuses.get(accountId);
    
    if (!client || !status || !status.isAuthenticated) {
      return;
    }

    try {
      const profile = await client.getUserProfile(status.username);
      
      if (profile) {
        status.profile = profile;
        status.metrics = {
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          tweetsCount: profile.tweetsCount,
          lastUpdated: new Date()
        };
        
        this.accountStatuses.set(accountId, status);
        
        logger.info(`Updated metrics for account ${accountId}: ${profile.followersCount} followers`);
      }
    } catch (error) {
      logger.error(`Failed to update metrics for account ${accountId}:`, error);
    }
  }

  /**
   * Start health check interval
   */
  private startHealthCheckInterval(): void {
    // Check account health every 30 minutes
    this.healthCheckInterval = setInterval(async () => {
      logger.info('Running scheduled account health checks...');
      await this.checkAllAccountsHealth();
    }, 30 * 60 * 1000);
  }

  /**
   * Stop health check interval
   */
  stopHealthCheckInterval(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Encrypt password for storage
   */
  private encryptPassword(password: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt password from storage
   */
  private decryptPassword(encryptedPassword: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get account statistics
   */
  getAccountStatistics(): {
    total: number;
    active: number;
    authenticated: number;
    suspended: number;
    limited: number;
    healthy: number;
  } {
    const statuses = Array.from(this.accountStatuses.values());
    
    return {
      total: statuses.length,
      active: statuses.filter(s => s.status === 'active').length,
      authenticated: statuses.filter(s => s.isAuthenticated).length,
      suspended: statuses.filter(s => s.status === 'suspended').length,
      limited: statuses.filter(s => s.status === 'limited').length,
      healthy: statuses.filter(s => s.health.healthy).length
    };
  }
}
