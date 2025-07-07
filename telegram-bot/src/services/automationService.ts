import { logger } from '../utils/logger';
import { UserService } from './userService';
import { ContentGenerationService } from './contentGenerationService';
import { ProxyService } from './proxyService';
import { QualityControlService } from './qualityControlService';
import { ComplianceService } from './complianceService';

export interface AutomationConfig {
  userId: number;
  accountId: string;
  enabled: boolean;
  features: {
    posting: boolean;
    liking: boolean;
    commenting: boolean;
    following: boolean;
    dm: boolean;
    polls: boolean;
    threads: boolean;
  };
  limits: {
    postsPerDay: number;
    likesPerDay: number;
    commentsPerDay: number;
    followsPerDay: number;
    dmsPerDay: number;
    pollVotesPerDay: number;
    threadsPerDay: number;
  };
  schedule: {
    startTime: string;
    endTime: string;
    timezone: string;
    intervals: {
      posting: number; // minutes between posts
      engagement: number; // minutes between engagement actions
    };
  };
  quality: {
    minQualityScore: number;
    minComplianceScore: number;
    contentFiltering: boolean;
    spamDetection: boolean;
  };
  targeting: {
    hashtags: string[];
    keywords: string[];
    accounts: string[];
    excludeKeywords: string[];
  };
}

export interface AutomationStats {
  accountId: string;
  today: {
    posts: number;
    likes: number;
    comments: number;
    follows: number;
    dms: number;
    pollVotes: number;
    threads: number;
  };
  performance: {
    successRate: number;
    qualityScore: number;
    complianceScore: number;
    engagementRate: number;
  };
  status: 'active' | 'paused' | 'stopped' | 'error';
  lastAction: Date;
  nextAction: Date;
}

export class AutomationService {
  private automations: Map<string, AutomationConfig> = new Map();
  private stats: Map<string, AutomationStats> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(
    private userService: UserService,
    private contentService: ContentGenerationService,
    private proxyService: ProxyService,
    private qualityService: QualityControlService,
    private complianceService: ComplianceService
  ) {}

  async startAutomation(userId: number, accountId: string, config: Partial<AutomationConfig>): Promise<boolean> {
    try {
      const automationId = `${userId}-${accountId}`;
      
      const fullConfig: AutomationConfig = {
        userId,
        accountId,
        enabled: true,
        features: {
          posting: true,
          liking: true,
          commenting: true,
          following: true,
          dm: false,
          polls: true,
          threads: true,
          ...config.features
        },
        limits: {
          postsPerDay: 50,
          likesPerDay: 200,
          commentsPerDay: 100,
          followsPerDay: 50,
          dmsPerDay: 20,
          pollVotesPerDay: 30,
          threadsPerDay: 25,
          ...config.limits
        },
        schedule: {
          startTime: '08:00',
          endTime: '22:00',
          timezone: 'UTC',
          intervals: {
            posting: 60, // 1 hour between posts
            engagement: 15 // 15 minutes between engagement actions
          },
          ...config.schedule
        },
        quality: {
          minQualityScore: 0.8,
          minComplianceScore: 0.9,
          contentFiltering: true,
          spamDetection: true,
          ...config.quality
        },
        targeting: {
          hashtags: ['#crypto', '#blockchain', '#trading'],
          keywords: ['bitcoin', 'ethereum', 'defi'],
          accounts: [],
          excludeKeywords: ['scam', 'spam'],
          ...config.targeting
        }
      };

      this.automations.set(automationId, fullConfig);
      
      // Initialize stats
      this.stats.set(automationId, {
        accountId,
        today: {
          posts: 0,
          likes: 0,
          comments: 0,
          follows: 0,
          dms: 0,
          pollVotes: 0,
          threads: 0
        },
        performance: {
          successRate: 1.0,
          qualityScore: 0.9,
          complianceScore: 0.95,
          engagementRate: 0.045
        },
        status: 'active',
        lastAction: new Date(),
        nextAction: new Date(Date.now() + fullConfig.schedule.intervals.posting * 60000)
      });

      // Start automation intervals
      await this.startAutomationIntervals(automationId);
      
      logger.info(`Automation started for account ${accountId}`, { userId, automationId });
      return true;
    } catch (error) {
      logger.error('Error starting automation:', error);
      return false;
    }
  }

  async stopAutomation(userId: number, accountId: string): Promise<boolean> {
    try {
      const automationId = `${userId}-${accountId}`;
      
      // Clear intervals
      const interval = this.intervals.get(automationId);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(automationId);
      }

      // Update status
      const stats = this.stats.get(automationId);
      if (stats) {
        stats.status = 'stopped';
        this.stats.set(automationId, stats);
      }

      // Remove automation config
      this.automations.delete(automationId);
      
      logger.info(`Automation stopped for account ${accountId}`, { userId, automationId });
      return true;
    } catch (error) {
      logger.error('Error stopping automation:', error);
      return false;
    }
  }

  async pauseAutomation(userId: number, accountId: string): Promise<boolean> {
    try {
      const automationId = `${userId}-${accountId}`;
      
      const config = this.automations.get(automationId);
      if (config) {
        config.enabled = false;
        this.automations.set(automationId, config);
      }

      const stats = this.stats.get(automationId);
      if (stats) {
        stats.status = 'paused';
        this.stats.set(automationId, stats);
      }

      logger.info(`Automation paused for account ${accountId}`, { userId, automationId });
      return true;
    } catch (error) {
      logger.error('Error pausing automation:', error);
      return false;
    }
  }

  async resumeAutomation(userId: number, accountId: string): Promise<boolean> {
    try {
      const automationId = `${userId}-${accountId}`;
      
      const config = this.automations.get(automationId);
      if (config) {
        config.enabled = true;
        this.automations.set(automationId, config);
      }

      const stats = this.stats.get(automationId);
      if (stats) {
        stats.status = 'active';
        this.stats.set(automationId, stats);
      }

      logger.info(`Automation resumed for account ${accountId}`, { userId, automationId });
      return true;
    } catch (error) {
      logger.error('Error resuming automation:', error);
      return false;
    }
  }

  async emergencyStop(userId?: number): Promise<boolean> {
    try {
      if (userId) {
        // Stop all automations for specific user
        const userAutomations = Array.from(this.automations.keys())
          .filter(id => id.startsWith(`${userId}-`));
        
        for (const automationId of userAutomations) {
          const [, accountId] = automationId.split('-');
          await this.stopAutomation(userId, accountId);
        }
      } else {
        // Stop all automations
        for (const [automationId] of this.automations) {
          const [userIdStr, accountId] = automationId.split('-');
          await this.stopAutomation(parseInt(userIdStr), accountId);
        }
      }

      logger.warn('Emergency stop executed', { userId: userId || 'all' });
      return true;
    } catch (error) {
      logger.error('Error during emergency stop:', error);
      return false;
    }
  }

  getAutomationStats(userId: number, accountId?: string): AutomationStats[] {
    if (accountId) {
      const automationId = `${userId}-${accountId}`;
      const stats = this.stats.get(automationId);
      return stats ? [stats] : [];
    }

    // Return all stats for user
    return Array.from(this.stats.entries())
      .filter(([id]) => id.startsWith(`${userId}-`))
      .map(([, stats]) => stats);
  }

  getAutomationConfig(userId: number, accountId: string): AutomationConfig | null {
    const automationId = `${userId}-${accountId}`;
    return this.automations.get(automationId) || null;
  }

  async updateAutomationConfig(
    userId: number, 
    accountId: string, 
    updates: Partial<AutomationConfig>
  ): Promise<boolean> {
    try {
      const automationId = `${userId}-${accountId}`;
      const config = this.automations.get(automationId);
      
      if (!config) {
        return false;
      }

      const updatedConfig = { ...config, ...updates };
      this.automations.set(automationId, updatedConfig);
      
      // Restart intervals if schedule changed
      if (updates.schedule) {
        await this.stopAutomationIntervals(automationId);
        await this.startAutomationIntervals(automationId);
      }

      logger.info(`Automation config updated for account ${accountId}`, { userId, updates });
      return true;
    } catch (error) {
      logger.error('Error updating automation config:', error);
      return false;
    }
  }

  private async startAutomationIntervals(automationId: string): Promise<void> {
    const config = this.automations.get(automationId);
    if (!config) return;

    // Clear existing interval
    await this.stopAutomationIntervals(automationId);

    // Start new interval
    const interval = setInterval(async () => {
      if (config.enabled) {
        await this.executeAutomationCycle(automationId);
      }
    }, config.schedule.intervals.engagement * 60000); // Convert minutes to milliseconds

    this.intervals.set(automationId, interval);
  }

  private async stopAutomationIntervals(automationId: string): Promise<void> {
    const interval = this.intervals.get(automationId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(automationId);
    }
  }

  private async executeAutomationCycle(automationId: string): Promise<void> {
    try {
      const config = this.automations.get(automationId);
      const stats = this.stats.get(automationId);
      
      if (!config || !stats || !config.enabled) return;

      // Check if within schedule
      if (!this.isWithinSchedule(config.schedule)) {
        return;
      }

      // Check daily limits
      if (!this.checkDailyLimits(config, stats)) {
        return;
      }

      // Execute automation actions based on configuration
      await this.executeAutomationActions(config, stats);

      // Update stats
      stats.lastAction = new Date();
      stats.nextAction = new Date(Date.now() + config.schedule.intervals.engagement * 60000);
      this.stats.set(automationId, stats);

    } catch (error) {
      logger.error('Error in automation cycle:', error);
      
      // Update error status
      const stats = this.stats.get(automationId);
      if (stats) {
        stats.status = 'error';
        this.stats.set(automationId, stats);
      }
    }
  }

  private isWithinSchedule(schedule: AutomationConfig['schedule']): boolean {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
  }

  private checkDailyLimits(config: AutomationConfig, stats: AutomationStats): boolean {
    const { limits } = config;
    const { today } = stats;

    return (
      today.posts < limits.postsPerDay &&
      today.likes < limits.likesPerDay &&
      today.comments < limits.commentsPerDay &&
      today.follows < limits.followsPerDay &&
      today.dms < limits.dmsPerDay &&
      today.pollVotes < limits.pollVotesPerDay &&
      today.threads < limits.threadsPerDay
    );
  }

  private async executeAutomationActions(config: AutomationConfig, stats: AutomationStats): Promise<void> {
    // This is where the actual X/Twitter automation would happen
    // For now, simulate the actions and update stats
    
    const actions = [];
    
    if (config.features.posting && stats.today.posts < config.limits.postsPerDay) {
      actions.push('posting');
    }
    
    if (config.features.liking && stats.today.likes < config.limits.likesPerDay) {
      actions.push('liking');
    }
    
    if (config.features.commenting && stats.today.comments < config.limits.commentsPerDay) {
      actions.push('commenting');
    }

    // Execute random action
    if (actions.length > 0) {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      await this.executeAction(randomAction, config, stats);
    }
  }

  private async executeAction(action: string, config: AutomationConfig, stats: AutomationStats): Promise<void> {
    try {
      logger.info(`Executing ${action} for account ${config.accountId}`);
      
      // Simulate action execution
      switch (action) {
        case 'posting':
          stats.today.posts++;
          break;
        case 'liking':
          stats.today.likes++;
          break;
        case 'commenting':
          stats.today.comments++;
          break;
        case 'following':
          stats.today.follows++;
          break;
        case 'dm':
          stats.today.dms++;
          break;
        case 'polls':
          stats.today.pollVotes++;
          break;
        case 'threads':
          stats.today.threads++;
          break;
      }

      // Update performance metrics
      stats.performance.successRate = Math.min(1.0, stats.performance.successRate + 0.001);
      
    } catch (error) {
      logger.error(`Error executing ${action}:`, error);
      stats.performance.successRate = Math.max(0.8, stats.performance.successRate - 0.01);
    }
  }
}
