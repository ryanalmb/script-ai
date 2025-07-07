import { logger } from '../utils/logger';

export interface AnalyticsData {
  userId: number;
  timestamp: Date;
  action: string;
  data: any;
}

export interface DashboardStats {
  today: {
    posts: number;
    likes: number;
    comments: number;
    follows: number;
    dms: number;
    engagementRate: number;
    qualityScore: number;
  };
  automation: {
    activeAccounts: number;
    successRate: number;
    uptime: number;
    errorsToday: number;
  };
  performance: {
    bestPerformingPost: string;
    avgEngagementRate: number;
    topHashtags: string[];
    optimalPostingTime: string;
  };
}

export class AnalyticsService {
  private analytics: AnalyticsData[] = [];

  async trackEvent(userId: number, action: string, data: any = {}): Promise<void> {
    try {
      const event: AnalyticsData = {
        userId,
        timestamp: new Date(),
        action,
        data
      };

      this.analytics.push(event);
      logger.info(`Tracked event: ${action} for user ${userId}`);
    } catch (error) {
      logger.error('Error tracking event:', error);
    }
  }

  async getDashboardStats(userId?: number): Promise<DashboardStats> {
    try {
      // In a real implementation, this would query a database
      // For now, return mock data
      return {
        today: {
          posts: 12,
          likes: 156,
          comments: 34,
          follows: 8,
          dms: 3,
          engagementRate: 0.045,
          qualityScore: 0.92
        },
        automation: {
          activeAccounts: 3,
          successRate: 0.96,
          uptime: 0.998,
          errorsToday: 2
        },
        performance: {
          bestPerformingPost: 'Bitcoin analysis thread',
          avgEngagementRate: 0.045,
          topHashtags: ['#crypto', '#bitcoin', '#trading', '#blockchain', '#defi'],
          optimalPostingTime: '2:30 PM EST'
        }
      };
    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  async getEngagementAnalytics(userId?: number, timeframe: string = '7d'): Promise<any> {
    try {
      return {
        summary: {
          totalEngagements: 4567,
          avgEngagementRate: 0.045,
          bestPost: {
            id: 'post-123',
            content: 'Bitcoin analysis...',
            engagementRate: 0.089
          },
          worstPost: {
            id: 'post-456',
            content: 'Market update...',
            engagementRate: 0.012
          }
        },
        breakdown: {
          likes: { count: 3420, percentage: 75 },
          comments: { count: 892, percentage: 19.5 },
          retweets: { count: 234, percentage: 5.1 },
          mentions: { count: 21, percentage: 0.4 }
        },
        trends: [
          { date: '2024-01-09', likes: 450, comments: 120, retweets: 30 },
          { date: '2024-01-10', likes: 520, comments: 135, retweets: 35 },
          { date: '2024-01-11', likes: 480, comments: 128, retweets: 32 },
          { date: '2024-01-12', likes: 610, comments: 145, retweets: 40 },
          { date: '2024-01-13', likes: 590, comments: 142, retweets: 38 },
          { date: '2024-01-14', likes: 650, comments: 155, retweets: 42 },
          { date: '2024-01-15', likes: 520, comments: 130, retweets: 35 }
        ]
      };
    } catch (error) {
      logger.error('Error getting engagement analytics:', error);
      throw error;
    }
  }

  async getAutomationAnalytics(userId?: number, timeframe: string = '7d'): Promise<any> {
    try {
      return {
        performance: {
          totalActions: 1234,
          successfulActions: 1185,
          failedActions: 49,
          successRate: 0.96,
          avgResponseTime: 2.3,
          uptime: 0.998
        },
        breakdown: {
          posting: { total: 156, successful: 152, failed: 4, rate: 0.974 },
          liking: { total: 892, successful: 856, failed: 36, rate: 0.959 },
          commenting: { total: 234, successful: 228, failed: 6, rate: 0.974 },
          following: { total: 89, successful: 87, failed: 2, rate: 0.977 },
          dm: { total: 45, successful: 44, failed: 1, rate: 0.978 }
        },
        quality: {
          avgQualityScore: 0.92,
          avgComplianceScore: 0.95,
          contentFiltered: 12,
          spamDetected: 3,
          violationsFound: 0
        },
        errors: [
          {
            type: 'rate_limit',
            count: 25,
            lastOccurred: '2024-01-15T16:45:00Z'
          },
          {
            type: 'network_timeout',
            count: 15,
            lastOccurred: '2024-01-15T14:20:00Z'
          }
        ]
      };
    } catch (error) {
      logger.error('Error getting automation analytics:', error);
      throw error;
    }
  }

  async getUserAnalytics(userId: number): Promise<any> {
    try {
      const userEvents = this.analytics.filter(event => event.userId === userId);
      
      return {
        totalEvents: userEvents.length,
        commandsUsed: userEvents.filter(e => e.action.startsWith('command_')).length,
        lastActivity: userEvents.length > 0 ? userEvents[userEvents.length - 1].timestamp : null,
        mostUsedCommands: this.getMostUsedCommands(userEvents),
        activityByHour: this.getActivityByHour(userEvents)
      };
    } catch (error) {
      logger.error('Error getting user analytics:', error);
      throw error;
    }
  }

  async getSystemAnalytics(): Promise<any> {
    try {
      return {
        totalUsers: new Set(this.analytics.map(e => e.userId)).size,
        totalEvents: this.analytics.length,
        activeUsers24h: this.getActiveUsers24h(),
        systemUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        topCommands: this.getTopCommands(),
        errorRate: this.getErrorRate()
      };
    } catch (error) {
      logger.error('Error getting system analytics:', error);
      throw error;
    }
  }

  private getMostUsedCommands(events: AnalyticsData[]): any[] {
    const commandCounts = new Map<string, number>();
    
    events.filter(e => e.action.startsWith('command_')).forEach(event => {
      const command = event.action.replace('command_', '');
      commandCounts.set(command, (commandCounts.get(command) || 0) + 1);
    });

    return Array.from(commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([command, count]) => ({ command, count }));
  }

  private getActivityByHour(events: AnalyticsData[]): any[] {
    const hourCounts = new Array(24).fill(0);
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourCounts[hour]++;
    });

    return hourCounts.map((count, hour) => ({ hour, count }));
  }

  private getActiveUsers24h(): number {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = this.analytics.filter(e => e.timestamp > yesterday);
    return new Set(recentEvents.map(e => e.userId)).size;
  }

  private getTopCommands(): any[] {
    const commandCounts = new Map<string, number>();
    
    this.analytics.filter(e => e.action.startsWith('command_')).forEach(event => {
      const command = event.action.replace('command_', '');
      commandCounts.set(command, (commandCounts.get(command) || 0) + 1);
    });

    return Array.from(commandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([command, count]) => ({ command, count }));
  }

  private getErrorRate(): number {
    const errorEvents = this.analytics.filter(e => e.action.includes('error'));
    return this.analytics.length > 0 ? errorEvents.length / this.analytics.length : 0;
  }
}
