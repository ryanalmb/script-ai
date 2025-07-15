import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

export interface SimulatedAccount {
  id: string;
  telegramUserId: number;
  profile: SimulatedProfile;
  metrics: AccountMetrics;
  content: ContentData;
  engagement: EngagementData;
  apiResponses: ApiResponseData;
  settings: AccountSettings;
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'suspended' | 'limited' | 'verified';
}

export interface SimulatedProfile {
  username: string;
  displayName: string;
  bio: string;
  location: string;
  website: string;
  profileImageUrl: string;
  bannerImageUrl: string;
  verified: boolean;
  protected: boolean;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  likesCount: number;
  listsCount: number;
  createdAt: Date;
  accountType: 'personal' | 'business' | 'creator' | 'government';
  tier: 'basic' | 'premium' | 'premium_plus' | 'enterprise';
}

export interface AccountMetrics {
  impressions: DailyMetrics[];
  engagementRate: number;
  reachRate: number;
  clickThroughRate: number;
  conversionRate: number;
  audienceGrowth: GrowthMetrics;
  contentPerformance: ContentMetrics[];
  demographicData: DemographicData;
  topPerformingContent: ContentItem[];
}

export interface ContentData {
  tweets: TweetData[];
  retweets: RetweetData[];
  replies: ReplyData[];
  mentions: MentionData[];
  hashtags: string[];
  mediaUploads: MediaData[];
  scheduledContent: ScheduledContent[];
}

export interface EngagementData {
  likes: EngagementItem[];
  retweets: EngagementItem[];
  replies: EngagementItem[];
  mentions: EngagementItem[];
  directMessages: MessageData[];
  notifications: NotificationData[];
}

export interface ApiResponseData {
  rateLimits: RateLimitData;
  errorSimulation: ErrorSimulationData;
  responseDelays: ResponseDelayData;
  webhookEvents: WebhookEventData[];
}

export interface AccountSettings {
  privacySettings: PrivacySettings;
  notificationSettings: NotificationSettings;
  contentSettings: ContentSettings;
  apiSettings: ApiSettings;
  simulationSettings: SimulationSettings;
}

// Supporting interfaces
export interface DailyMetrics {
  date: Date;
  impressions: number;
  engagements: number;
  profileVisits: number;
  mentions: number;
  followers: number;
}

export interface GrowthMetrics {
  daily: number;
  weekly: number;
  monthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ContentMetrics {
  contentId: string;
  type: 'tweet' | 'retweet' | 'reply';
  impressions: number;
  engagements: number;
  clicks: number;
  shares: number;
  saves: number;
}

export interface DemographicData {
  ageGroups: { [key: string]: number };
  genders: { [key: string]: number };
  locations: { [key: string]: number };
  interests: { [key: string]: number };
  devices: { [key: string]: number };
}

export interface ContentItem {
  id: string;
  text: string;
  type: 'tweet' | 'retweet' | 'reply';
  createdAt: Date;
  metrics: ContentMetrics;
}

export interface TweetData {
  id: string;
  text: string;
  createdAt: Date;
  replyToId?: string;
  quoteTweetId?: string;
  mediaIds: string[];
  hashtags: string[];
  mentions: string[];
  urls: string[];
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    impressions: number;
  };
}

export interface RetweetData {
  id: string;
  originalTweetId: string;
  comment?: string;
  createdAt: Date;
}

export interface ReplyData {
  id: string;
  originalTweetId: string;
  text: string;
  createdAt: Date;
}

export interface MentionData {
  id: string;
  mentionedUsername: string;
  tweetId: string;
  createdAt: Date;
}

export interface MediaData {
  id: string;
  type: 'photo' | 'video' | 'gif';
  url: string;
  altText?: string;
  uploadedAt: Date;
}

export interface ScheduledContent {
  id: string;
  text: string;
  scheduledFor: Date;
  mediaIds: string[];
  status: 'scheduled' | 'published' | 'failed';
}

export interface EngagementItem {
  id: string;
  userId: string;
  username: string;
  tweetId: string;
  createdAt: Date;
}

export interface MessageData {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  mediaIds: string[];
  createdAt: Date;
  read: boolean;
}

export interface NotificationData {
  id: string;
  type: 'like' | 'retweet' | 'reply' | 'mention' | 'follow' | 'dm';
  fromUserId: string;
  fromUsername: string;
  tweetId?: string;
  text?: string;
  createdAt: Date;
  read: boolean;
}

export interface RateLimitData {
  endpoint: string;
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface ErrorSimulationData {
  errorType: string;
  probability: number;
  message: string;
  httpCode: number;
}

export interface ResponseDelayData {
  endpoint: string;
  minDelay: number;
  maxDelay: number;
  averageDelay: number;
}

export interface WebhookEventData {
  id: string;
  type: string;
  data: any;
  createdAt: Date;
  delivered: boolean;
}

export interface PrivacySettings {
  protected: boolean;
  allowDirectMessages: 'everyone' | 'following' | 'none';
  allowTagging: 'everyone' | 'following' | 'none';
  allowLocationTagging: boolean;
  showActivity: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  notificationTypes: {
    likes: boolean;
    retweets: boolean;
    replies: boolean;
    mentions: boolean;
    follows: boolean;
    directMessages: boolean;
  };
}

export interface ContentSettings {
  autoDeleteTweets: boolean;
  autoDeleteDays: number;
  contentFiltering: boolean;
  allowSensitiveContent: boolean;
  defaultTweetPrivacy: 'public' | 'followers' | 'mentioned';
}

export interface ApiSettings {
  rateLimitingEnabled: boolean;
  webhooksEnabled: boolean;
  analyticsEnabled: boolean;
  developerAccess: boolean;
  apiVersion: string;
}

export interface SimulationSettings {
  realisticDelays: boolean;
  errorSimulation: boolean;
  engagementSimulation: boolean;
  contentGeneration: boolean;
  metricsTracking: boolean;
  activityLevel: 'low' | 'medium' | 'high' | 'viral';
}

export class AccountSimulatorService {
  private simulatedAccounts: Map<string, SimulatedAccount> = new Map();
  private userSessions: Map<number, string[]> = new Map();
  private readonly CACHE_PREFIX = 'simulated_account:';
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours

  constructor() {
    // Initialize with some sample data
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    logger.info('Initializing Account Simulator Service');
    
    // Load existing simulated accounts from cache/database
    await this.loadExistingAccounts();
    
    // Start background processes
    this.startBackgroundProcesses();
  }

  private async loadExistingAccounts(): Promise<void> {
    try {
      // Load from cache first, then database
      // Note: keys method may not exist on all cache implementations
      const cachedAccounts: string[] = [];
      
      for (const key of cachedAccounts) {
        const account = await cacheManager.get(key) as SimulatedAccount;
        if (account) {
          this.simulatedAccounts.set(account.id, account);
        }
      }
      
      logger.info(`Loaded ${this.simulatedAccounts.size} simulated accounts`);
    } catch (error) {
      logger.error('Failed to load existing simulated accounts:', error);
    }
  }

  private startBackgroundProcesses(): void {
    // Simulate ongoing activity every 5 minutes
    setInterval(() => this.simulateOngoingActivity(), 5 * 60 * 1000);

    // Update metrics every hour
    setInterval(() => this.updateAccountMetrics(), 60 * 60 * 1000);

    // Clean up old data every 6 hours
    setInterval(() => this.cleanupOldData(), 6 * 60 * 60 * 1000);
  }

  /**
   * Create a comprehensive simulated X account
   */
  async createSimulatedAccount(telegramUserId: number, options?: {
    accountType?: 'personal' | 'business' | 'creator' | 'government';
    tier?: 'basic' | 'premium' | 'premium_plus' | 'enterprise';
    activityLevel?: 'low' | 'medium' | 'high' | 'viral';
    verified?: boolean;
  }): Promise<SimulatedAccount> {
    const accountId = this.generateAccountId();
    const profile = this.generateRealisticProfile(options);
    const metrics = this.generateAccountMetrics(profile, options?.activityLevel || 'medium');
    const content = this.generateContentData(profile, metrics);
    const engagement = this.generateEngagementData(profile, content);
    const apiResponses = this.generateApiResponseData();
    const settings = this.generateAccountSettings(options);

    const simulatedAccount: SimulatedAccount = {
      id: accountId,
      telegramUserId,
      profile,
      metrics,
      content,
      engagement,
      apiResponses,
      settings,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: options?.verified ? 'verified' : 'active'
    };

    // Store in memory and cache
    this.simulatedAccounts.set(accountId, simulatedAccount);
    await cacheManager.set(`${this.CACHE_PREFIX}${accountId}`, simulatedAccount, this.CACHE_TTL);

    // Store in database for persistence
    await this.persistAccountToDatabase(simulatedAccount);

    logger.info('Created simulated account', {
      accountId,
      telegramUserId,
      username: profile.username,
      accountType: profile.accountType,
      tier: profile.tier,
      followersCount: profile.followersCount
    });

    return simulatedAccount;
  }

  /**
   * Generate realistic profile data
   */
  private generateRealisticProfile(options?: any): SimulatedProfile {
    const accountType = options?.accountType || this.randomChoice(['personal', 'business', 'creator', 'government']);
    const tier = options?.tier || this.randomChoice(['basic', 'premium', 'premium_plus', 'enterprise']);
    const verified = options?.verified || (tier === 'enterprise' || Math.random() < 0.1);

    const username = this.generateRealisticUsername(accountType);
    const displayName = this.generateDisplayName(username, accountType);
    const bio = this.generateRealisticBio(accountType, tier);

    // Generate follower counts based on account type and tier
    const followersCount = this.generateFollowerCount(accountType, tier, verified);
    const followingCount = this.generateFollowingCount(followersCount, accountType);
    const tweetsCount = this.generateTweetCount(followersCount, accountType);

    return {
      username,
      displayName,
      bio,
      location: this.generateLocation(),
      website: this.generateWebsite(accountType),
      profileImageUrl: this.generateProfileImageUrl(username),
      bannerImageUrl: this.generateBannerImageUrl(username),
      verified,
      protected: Math.random() < 0.05, // 5% protected accounts
      followersCount,
      followingCount,
      tweetsCount,
      likesCount: Math.floor(tweetsCount * (1.5 + Math.random() * 2)),
      listsCount: Math.floor(followersCount / 1000 + Math.random() * 50),
      createdAt: this.generateAccountCreationDate(),
      accountType,
      tier
    };
  }

  /**
   * Generate comprehensive account metrics
   */
  private generateAccountMetrics(profile: SimulatedProfile, activityLevel: string): AccountMetrics {
    const baseEngagement = this.getBaseEngagementRate(profile.accountType, profile.tier);
    const activityMultiplier = this.getActivityMultiplier(activityLevel);

    const impressions = this.generateDailyMetrics(profile, activityMultiplier);
    const engagementRate = baseEngagement * activityMultiplier * (0.8 + Math.random() * 0.4);

    return {
      impressions,
      engagementRate,
      reachRate: engagementRate * 0.3,
      clickThroughRate: engagementRate * 0.05,
      conversionRate: engagementRate * 0.01,
      audienceGrowth: this.generateGrowthMetrics(profile, activityLevel),
      contentPerformance: this.generateContentMetrics(profile),
      demographicData: this.generateDemographicData(profile),
      topPerformingContent: this.generateTopContent(profile)
    };
  }

  /**
   * Generate realistic content data
   */
  private generateContentData(profile: SimulatedProfile, metrics: AccountMetrics): ContentData {
    const tweetCount = Math.min(profile.tweetsCount, 100); // Limit for simulation
    const tweets = this.generateTweets(tweetCount, profile);

    return {
      tweets,
      retweets: this.generateRetweets(tweets.length * 0.3, profile),
      replies: this.generateReplies(tweets.length * 0.5, profile),
      mentions: this.generateMentions(tweets.length * 0.2, profile),
      hashtags: this.generatePopularHashtags(profile.accountType),
      mediaUploads: this.generateMediaUploads(tweets.length * 0.4),
      scheduledContent: this.generateScheduledContent(profile)
    };
  }

  /**
   * Generate engagement simulation data
   */
  private generateEngagementData(profile: SimulatedProfile, content: ContentData): EngagementData {
    const totalEngagements = Math.floor(profile.followersCount * 0.1);

    return {
      likes: this.generateEngagementItems('like', totalEngagements * 0.6, content.tweets),
      retweets: this.generateEngagementItems('retweet', totalEngagements * 0.2, content.tweets),
      replies: this.generateEngagementItems('reply', totalEngagements * 0.15, content.tweets),
      mentions: this.generateEngagementItems('mention', totalEngagements * 0.05, content.tweets),
      directMessages: this.generateDirectMessages(profile),
      notifications: this.generateNotifications(profile, totalEngagements)
    };
  }

  /**
   * Generate API response simulation data
   */
  private generateApiResponseData(): ApiResponseData {
    return {
      rateLimits: this.generateRateLimits()[0] || {
        endpoint: '/default',
        limit: 300,
        remaining: 300,
        resetTime: new Date()
      },
      errorSimulation: this.generateErrorSimulation()[0] || {
        errorType: 'none',
        probability: 0,
        message: 'No errors',
        httpCode: 200
      },
      responseDelays: this.generateResponseDelays()[0] || {
        endpoint: '/default',
        minDelay: 100,
        maxDelay: 1000,
        averageDelay: 500
      },
      webhookEvents: this.generateWebhookEvents()
    };
  }

  /**
   * Generate account settings
   */
  private generateAccountSettings(options?: any): AccountSettings {
    return {
      privacySettings: {
        protected: Math.random() < 0.05,
        allowDirectMessages: this.randomChoice(['everyone', 'following', 'none']),
        allowTagging: this.randomChoice(['everyone', 'following', 'none']),
        allowLocationTagging: Math.random() < 0.3,
        showActivity: Math.random() < 0.8
      },
      notificationSettings: {
        emailNotifications: Math.random() < 0.7,
        pushNotifications: Math.random() < 0.9,
        smsNotifications: Math.random() < 0.3,
        notificationTypes: {
          likes: Math.random() < 0.8,
          retweets: Math.random() < 0.9,
          replies: Math.random() < 0.95,
          mentions: Math.random() < 0.95,
          follows: Math.random() < 0.85,
          directMessages: Math.random() < 0.9
        }
      },
      contentSettings: {
        autoDeleteTweets: Math.random() < 0.1,
        autoDeleteDays: 30 + Math.floor(Math.random() * 335),
        contentFiltering: Math.random() < 0.6,
        allowSensitiveContent: Math.random() < 0.4,
        defaultTweetPrivacy: this.randomChoice(['public', 'followers', 'mentioned'])
      },
      apiSettings: {
        rateLimitingEnabled: true,
        webhooksEnabled: Math.random() < 0.3,
        analyticsEnabled: Math.random() < 0.7,
        developerAccess: Math.random() < 0.1,
        apiVersion: this.randomChoice(['v1.1', 'v2'])
      },
      simulationSettings: {
        realisticDelays: true,
        errorSimulation: Math.random() < 0.8,
        engagementSimulation: true,
        contentGeneration: Math.random() < 0.9,
        metricsTracking: true,
        activityLevel: options?.activityLevel || this.randomChoice(['low', 'medium', 'high', 'viral'])
      }
    };
  }

  // Helper methods for data generation
  private generateAccountId(): string {
    return `sim_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateRealisticUsername(accountType: string): string {
    const prefixes: { [key: string]: string[] } = {
      personal: ['john', 'sarah', 'mike', 'emma', 'alex', 'lisa', 'david', 'anna'],
      business: ['tech', 'global', 'pro', 'smart', 'digital', 'future', 'elite', 'prime'],
      creator: ['create', 'art', 'design', 'make', 'build', 'craft', 'studio', 'lab'],
      government: ['gov', 'official', 'dept', 'agency', 'bureau', 'office', 'admin', 'public']
    };

    const suffixes: { [key: string]: string[] } = {
      personal: ['123', '2024', 'official', 'real', 'the', 'x', 'pro', ''],
      business: ['corp', 'inc', 'ltd', 'group', 'solutions', 'systems', 'tech', 'global'],
      creator: ['studio', 'lab', 'works', 'creative', 'design', 'art', 'media', 'content'],
      government: ['official', 'gov', 'dept', 'agency', 'bureau', 'admin', 'public', 'state']
    };

    const prefixArray = (prefixes[accountType] || prefixes.personal) as string[];
    const suffixArray = (suffixes[accountType] || suffixes.personal) as string[];
    const prefix = this.randomChoice(prefixArray);
    const suffix = this.randomChoice(suffixArray);

    return suffix ? `${prefix}_${suffix}` : prefix;
  }

  private generateDisplayName(username: string, accountType: string): string {
    const templates: { [key: string]: string[] } = {
      personal: ['John Doe', 'Sarah Smith', 'Mike Johnson', 'Emma Wilson', 'Alex Brown'],
      business: ['TechCorp Solutions', 'Global Innovations', 'Digital Future Inc', 'Smart Systems'],
      creator: ['Creative Studio', 'Art Lab', 'Design Works', 'Content Creator'],
      government: ['Department of Tech', 'Official Agency', 'Public Bureau', 'Government Office']
    };

    const templateArray = (templates[accountType] || templates.personal) as string[];
    return this.randomChoice(templateArray);
  }

  private generateRealisticBio(accountType: string, tier: string): string {
    const bios: { [key: string]: string[] } = {
      personal: [
        'Tech enthusiast | Coffee lover ☕ | Building the future',
        'Digital nomad 🌍 | Sharing my journey | DMs open',
        'Entrepreneur | Investor | Mentor | Views are my own',
        'Software engineer by day, gamer by night 🎮',
        'Passionate about AI, blockchain, and innovation'
      ],
      business: [
        'Leading digital transformation | Fortune 500 company',
        'Innovative solutions for modern businesses | Est. 2010',
        'Your trusted partner in technology | Global reach',
        'Empowering businesses through cutting-edge tech',
        'Industry leader in digital solutions | 24/7 support'
      ],
      creator: [
        'Content creator | 1M+ followers | Brand partnerships',
        'Digital artist | NFT creator | Commissions open',
        'YouTuber | Podcaster | Speaker | Book author',
        'Influencer marketing | Lifestyle content | Collab friendly',
        'Creative director | Visual storyteller | Award winner'
      ],
      government: [
        'Official government account | Public information',
        'Serving the community | Transparent governance',
        'Public safety updates | Emergency notifications',
        'Government services | Citizen engagement',
        'Official announcements | Policy updates'
      ]
    };

    const bioArray = (bios[accountType] || bios.personal) as string[];
    return this.randomChoice(bioArray);
  }

  private generateLocation(): string {
    const locations = [
      'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
      'London, UK', 'Tokyo, Japan', 'Berlin, Germany', 'Paris, France',
      'Toronto, Canada', 'Sydney, Australia', 'Singapore', 'Dubai, UAE',
      'San Francisco, CA', 'Seattle, WA', 'Boston, MA', 'Austin, TX'
    ];

    return Math.random() < 0.7 ? this.randomChoice(locations) : '';
  }

  private generateWebsite(accountType: string): string {
    if (Math.random() < 0.4) return '';

    const domains: { [key: string]: string[] } = {
      personal: ['portfolio.com', 'blog.com', 'personal.site', 'me.com'],
      business: ['company.com', 'business.net', 'corp.com', 'solutions.io'],
      creator: ['creative.studio', 'art.gallery', 'content.tv', 'creator.space'],
      government: ['gov.org', 'official.gov', 'public.gov', 'agency.gov']
    };

    const domainArray = (domains[accountType] || domains.personal) as string[];
    const domain = this.randomChoice(domainArray);
    return `https://www.example-${domain}`;
  }

  private generateProfileImageUrl(username: string): string {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  }

  private generateBannerImageUrl(username: string): string {
    return `https://picsum.photos/1500/500?random=${username}`;
  }

  private generateAccountCreationDate(): Date {
    const now = new Date();
    const yearsAgo = Math.floor(Math.random() * 10) + 1; // 1-10 years ago
    const creationDate = new Date(now.getFullYear() - yearsAgo,
                                 Math.floor(Math.random() * 12),
                                 Math.floor(Math.random() * 28) + 1);
    return creationDate;
  }

  private generateFollowerCount(accountType: string, tier: string, verified: boolean): number {
    let baseCount = 1000;

    // Account type multipliers
    const typeMultipliers: { [key: string]: number } = {
      personal: 1,
      business: 3,
      creator: 5,
      government: 2
    };

    // Tier multipliers
    const tierMultipliers: { [key: string]: number } = {
      basic: 1,
      premium: 3,
      premium_plus: 8,
      enterprise: 20
    };

    baseCount *= typeMultipliers[accountType] || 1;
    baseCount *= tierMultipliers[tier] || 1;

    if (verified) baseCount *= 5;

    // Add randomness
    const variance = baseCount * (0.5 + Math.random() * 1.5);
    return Math.floor(variance);
  }

  private generateFollowingCount(followersCount: number, accountType: string): number {
    const ratios: { [key: string]: number } = {
      personal: 0.8 + Math.random() * 0.4, // 0.8-1.2
      business: 0.1 + Math.random() * 0.3, // 0.1-0.4
      creator: 0.2 + Math.random() * 0.3, // 0.2-0.5
      government: 0.05 + Math.random() * 0.15 // 0.05-0.2
    };

    const ratio = (ratios[accountType] || ratios.personal) as number;
    return Math.floor(followersCount * ratio);
  }

  private generateTweetCount(followersCount: number, accountType: string): number {
    const baseTweets = Math.floor(followersCount / 10);
    const activityMultipliers: { [key: string]: number } = {
      personal: 1.2,
      business: 0.8,
      creator: 2.0,
      government: 0.5
    };

    const multiplier = activityMultipliers[accountType] || 1;
    return Math.floor(baseTweets * multiplier * (0.5 + Math.random()));
  }

  private getBaseEngagementRate(accountType: string, tier: string): number {
    const baseRates: { [key: string]: number } = {
      personal: 0.02,
      business: 0.015,
      creator: 0.05,
      government: 0.01
    };

    const tierMultipliers: { [key: string]: number } = {
      basic: 1,
      premium: 1.2,
      premium_plus: 1.5,
      enterprise: 2.0
    };

    return (baseRates[accountType] || 0.02) * (tierMultipliers[tier] || 1);
  }

  private getActivityMultiplier(activityLevel: string): number {
    const multipliers: { [key: string]: number } = {
      low: 0.5,
      medium: 1.0,
      high: 2.0,
      viral: 5.0
    };

    return multipliers[activityLevel] || 1.0;
  }

  private generateDailyMetrics(profile: SimulatedProfile, activityMultiplier: number): DailyMetrics[] {
    const metrics: DailyMetrics[] = [];
    const now = new Date();

    for (let i = 30; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const baseImpressions = Math.floor(profile.followersCount * 0.1 * activityMultiplier);

      metrics.push({
        date,
        impressions: baseImpressions + Math.floor(Math.random() * baseImpressions * 0.5),
        engagements: Math.floor(baseImpressions * 0.02 * (0.5 + Math.random())),
        profileVisits: Math.floor(baseImpressions * 0.005 * (0.5 + Math.random())),
        mentions: Math.floor(Math.random() * 10),
        followers: profile.followersCount + Math.floor((Math.random() - 0.5) * 100)
      });
    }

    return metrics;
  }

  private generateGrowthMetrics(profile: SimulatedProfile, activityLevel: string): GrowthMetrics {
    const baseGrowth = profile.followersCount * 0.001;
    const activityMultiplier = this.getActivityMultiplier(activityLevel);

    const daily = Math.floor(baseGrowth * activityMultiplier * (0.5 + Math.random()));
    const weekly = daily * 7;
    const monthly = daily * 30;

    const trends: ('increasing' | 'decreasing' | 'stable')[] = ['increasing', 'decreasing', 'stable'];
    const trend = this.randomChoice(trends);

    return { daily, weekly, monthly, trend };
  }

  private generateContentMetrics(profile: SimulatedProfile): ContentMetrics[] {
    const metrics: ContentMetrics[] = [];
    const contentCount = Math.min(profile.tweetsCount, 50);

    for (let i = 0; i < contentCount; i++) {
      const impressions = Math.floor(profile.followersCount * 0.1 * (0.5 + Math.random()));
      const engagements = Math.floor(impressions * 0.02 * (0.5 + Math.random()));

      metrics.push({
        contentId: `content_${i}`,
        type: this.randomChoice(['tweet', 'retweet', 'reply']),
        impressions,
        engagements,
        clicks: Math.floor(engagements * 0.1),
        shares: Math.floor(engagements * 0.3),
        saves: Math.floor(engagements * 0.05)
      });
    }

    return metrics;
  }

  private generateDemographicData(profile: SimulatedProfile): DemographicData {
    return {
      ageGroups: {
        '18-24': 15 + Math.random() * 20,
        '25-34': 25 + Math.random() * 20,
        '35-44': 20 + Math.random() * 15,
        '45-54': 15 + Math.random() * 15,
        '55+': 10 + Math.random() * 15
      },
      genders: {
        'Male': 40 + Math.random() * 20,
        'Female': 40 + Math.random() * 20,
        'Other': Math.random() * 5,
        'Prefer not to say': Math.random() * 5
      },
      locations: {
        'United States': 30 + Math.random() * 20,
        'United Kingdom': 10 + Math.random() * 10,
        'Canada': 8 + Math.random() * 8,
        'Australia': 5 + Math.random() * 5,
        'Other': 20 + Math.random() * 30
      },
      interests: this.generateInterests(profile.accountType),
      devices: {
        'Mobile': 60 + Math.random() * 20,
        'Desktop': 25 + Math.random() * 15,
        'Tablet': 10 + Math.random() * 10,
        'Other': Math.random() * 5
      }
    };
  }

  private generateInterests(accountType: string): { [key: string]: number } {
    const interestSets: { [key: string]: string[] } = {
      personal: ['Technology', 'Sports', 'Entertainment', 'News', 'Gaming'],
      business: ['Business', 'Technology', 'Finance', 'Marketing', 'Innovation'],
      creator: ['Art', 'Design', 'Entertainment', 'Technology', 'Lifestyle'],
      government: ['Politics', 'Public Policy', 'News', 'Community', 'Education']
    };

    const interests = (interestSets[accountType] || interestSets.personal) as string[];
    const result: { [key: string]: number } = {};

    interests.forEach((interest: string) => {
      result[interest] = 10 + Math.random() * 20;
    });

    return result;
  }

  private generateTopContent(profile: SimulatedProfile): ContentItem[] {
    const content: ContentItem[] = [];
    const contentCount = Math.min(10, Math.floor(profile.tweetsCount * 0.1));

    for (let i = 0; i < contentCount; i++) {
      const impressions = Math.floor(profile.followersCount * 0.2 * (0.5 + Math.random()));
      const engagements = Math.floor(impressions * 0.05 * (0.5 + Math.random()));

      content.push({
        id: `top_content_${i}`,
        text: this.generateTweetText(profile.accountType),
        type: this.randomChoice(['tweet', 'retweet', 'reply']),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        metrics: {
          contentId: `top_content_${i}`,
          type: 'tweet',
          impressions,
          engagements,
          clicks: Math.floor(engagements * 0.1),
          shares: Math.floor(engagements * 0.3),
          saves: Math.floor(engagements * 0.05)
        }
      });
    }

    return content.sort((a, b) => b.metrics.engagements - a.metrics.engagements);
  }

  private generateTweets(count: number, profile: SimulatedProfile): TweetData[] {
    const tweets: TweetData[] = [];

    for (let i = 0; i < count; i++) {
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const baseEngagement = Math.floor(profile.followersCount * 0.01 * (0.5 + Math.random()));

      tweets.push({
        id: `tweet_${i}`,
        text: this.generateTweetText(profile.accountType),
        createdAt,
        mediaIds: Math.random() < 0.3 ? [`media_${i}`] : [],
        hashtags: this.generateTweetHashtags(profile.accountType),
        mentions: Math.random() < 0.2 ? [`@user${Math.floor(Math.random() * 1000)}`] : [],
        urls: Math.random() < 0.1 ? ['https://example.com'] : [],
        metrics: {
          likes: Math.floor(baseEngagement * (0.6 + Math.random() * 0.8)),
          retweets: Math.floor(baseEngagement * (0.1 + Math.random() * 0.3)),
          replies: Math.floor(baseEngagement * (0.05 + Math.random() * 0.2)),
          quotes: Math.floor(baseEngagement * (0.02 + Math.random() * 0.1)),
          bookmarks: Math.floor(baseEngagement * (0.03 + Math.random() * 0.1)),
          impressions: Math.floor(baseEngagement * (10 + Math.random() * 20))
        }
      });
    }

    return tweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private generateTweetText(accountType: string): string {
    const templates: { [key: string]: string[] } = {
      personal: [
        "Just finished an amazing project! Excited to share more details soon 🚀",
        "Coffee thoughts: Why do the best ideas always come at 3 AM? ☕",
        "Grateful for all the support from this incredible community 🙏",
        "Working on something new... stay tuned! #innovation #tech",
        "Beautiful sunset today. Sometimes you need to pause and appreciate the moment 🌅"
      ],
      business: [
        "Excited to announce our latest product update! Enhanced features for better user experience 📈",
        "Thank you to our amazing team for making this quarter's goals possible 🎯",
        "Industry insights: The future of digital transformation is here #business #tech",
        "Join us at the upcoming conference! We'll be sharing our latest innovations 🎪",
        "Customer success story: How we helped increase efficiency by 40% 📊"
      ],
      creator: [
        "New video dropping tomorrow! Can't wait to share this creative journey with you all 🎬",
        "Behind the scenes: The creative process is messy but so rewarding ✨",
        "Collaboration announcement! Working with some incredible artists on this project 🎨",
        "Thank you for 100K followers! This community means everything to me ❤️",
        "Tutorial Tuesday: Today we're exploring advanced techniques in digital art 🖌️"
      ],
      government: [
        "Public service announcement: New community programs launching next month 📢",
        "Transparency update: Quarterly budget report now available on our website 📊",
        "Emergency preparedness: Important safety information for residents 🚨",
        "Community engagement: Join us for the town hall meeting this Thursday 🏛️",
        "Policy update: New regulations to improve public transportation efficiency 🚌"
      ]
    };

    const typeTemplates = (templates[accountType] || templates.personal) as string[];
    return this.randomChoice(typeTemplates);
  }

  private generateTweetHashtags(accountType: string): string[] {
    const hashtags: { [key: string]: string[] } = {
      personal: ['#life', '#tech', '#motivation', '#growth', '#innovation'],
      business: ['#business', '#growth', '#innovation', '#success', '#leadership'],
      creator: ['#creative', '#art', '#content', '#inspiration', '#community'],
      government: ['#public', '#community', '#service', '#transparency', '#policy']
    };

    const typeHashtags = (hashtags[accountType] || hashtags.personal) as string[];
    const count = Math.floor(Math.random() * 3);
    return this.shuffleArray(typeHashtags).slice(0, count);
  }

  private generateRetweets(count: number, profile: SimulatedProfile): RetweetData[] {
    const retweets: RetweetData[] = [];

    for (let i = 0; i < count; i++) {
      const comment = Math.random() < 0.3 ? this.generateTweetText(profile.accountType) : undefined;
      retweets.push({
        id: `retweet_${i}`,
        originalTweetId: `external_tweet_${i}`,
        ...(comment && { comment }),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }

    return retweets;
  }

  private generateReplies(count: number, profile: SimulatedProfile): ReplyData[] {
    const replies: ReplyData[] = [];

    for (let i = 0; i < count; i++) {
      replies.push({
        id: `reply_${i}`,
        originalTweetId: `external_tweet_${i}`,
        text: this.generateReplyText(profile.accountType),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }

    return replies;
  }

  private generateReplyText(accountType: string): string {
    const replies: { [key: string]: string[] } = {
      personal: [
        "Great point! I completely agree with this perspective.",
        "Thanks for sharing this insight! Very helpful.",
        "Interesting take. I hadn't considered that angle before.",
        "This is exactly what I needed to hear today. Thank you!",
        "Love this! Keep up the amazing work."
      ],
      business: [
        "Thank you for your feedback! We're always looking to improve.",
        "Great question! Our team will follow up with more details.",
        "We appreciate your business and continued support.",
        "Excellent point. We'll consider this for future updates.",
        "Thank you for choosing our services. We're here to help!"
      ],
      creator: [
        "Thank you so much for the support! It means everything.",
        "So glad you enjoyed the content! More coming soon.",
        "Your feedback helps me create better content. Thank you!",
        "Amazing community we have here! Love you all.",
        "This is why I love creating content. Thank you for watching!"
      ],
      government: [
        "Thank you for your question. We'll provide more information soon.",
        "We appreciate your engagement with our community programs.",
        "Your feedback is important to us. Thank you for sharing.",
        "We're committed to serving our community effectively.",
        "Thank you for participating in the democratic process."
      ]
    };

    const typeReplies = (replies[accountType] || replies.personal) as string[];
    return this.randomChoice(typeReplies);
  }

  // Utility methods
  private randomChoice<T>(array: T[]): T {
    if (!array || array.length === 0) {
      throw new Error('Cannot choose from empty or undefined array');
    }
    return array[Math.floor(Math.random() * array.length)] as T;
  }

  private shuffleArray<T>(array: T[]): T[] {
    if (!array || array.length === 0) {
      return [];
    }
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j] as T, shuffled[i] as T];
    }
    return shuffled;
  }

  /**
   * Get simulated accounts for a user
   */
  async getSimulatedAccounts(telegramUserId: number): Promise<SimulatedAccount[]> {
    const accounts = Array.from(this.simulatedAccounts.values())
      .filter(account => account.telegramUserId === telegramUserId);

    logger.info('Retrieved simulated accounts', { telegramUserId, count: accounts.length });
    return accounts;
  }

  /**
   * Get account details
   */
  async getAccountDetails(accountId: string, telegramUserId: number): Promise<SimulatedAccount | null> {
    const account = this.simulatedAccounts.get(accountId);

    if (!account || account.telegramUserId !== telegramUserId) {
      return null;
    }

    return account;
  }

  /**
   * Delete simulated account
   */
  async deleteSimulatedAccount(accountId: string, telegramUserId: number): Promise<boolean> {
    const account = this.simulatedAccounts.get(accountId);

    if (!account || account.telegramUserId !== telegramUserId) {
      return false;
    }

    // Remove from memory and cache
    this.simulatedAccounts.delete(accountId);
    await cacheManager.del(`${this.CACHE_PREFIX}${accountId}`);

    // Remove from user session tracking
    const userSessions = this.userSessions.get(telegramUserId);
    if (userSessions) {
      const index = userSessions.indexOf(accountId);
      if (index > -1) {
        userSessions.splice(index, 1);
        if (userSessions.length === 0) {
          this.userSessions.delete(telegramUserId);
        }
      }
    }

    logger.info('Simulated account deleted', { accountId, telegramUserId });
    return true;
  }

  /**
   * Update account settings
   */
  async updateAccountSettings(accountId: string, telegramUserId: number, settings: Partial<AccountSettings>): Promise<boolean> {
    const account = this.simulatedAccounts.get(accountId);

    if (!account || account.telegramUserId !== telegramUserId) {
      return false;
    }

    // Update settings
    account.settings = { ...account.settings, ...settings };
    account.lastActivity = new Date();

    // Update cache
    await cacheManager.set(`${this.CACHE_PREFIX}${accountId}`, account, this.CACHE_TTL);

    logger.info('Account settings updated', { accountId, telegramUserId });
    return true;
  }

  /**
   * Simulate account activity
   */
  async simulateActivity(accountId: string, telegramUserId: number, activityType: string, parameters?: any): Promise<any> {
    const account = this.simulatedAccounts.get(accountId);

    if (!account || account.telegramUserId !== telegramUserId) {
      throw new Error('Account not found or access denied');
    }

    let result: any = {};

    switch (activityType) {
      case 'tweet':
        result = await this.simulateTweet(account, parameters);
        break;
      case 'engagement':
        result = await this.simulateEngagement(account, parameters);
        break;
      case 'followers':
        result = await this.simulateFollowerGrowth(account, parameters);
        break;
      case 'analytics':
        result = await this.simulateAnalyticsUpdate(account, parameters);
        break;
      default:
        throw new Error(`Unknown activity type: ${activityType}`);
    }

    // Update last activity
    account.lastActivity = new Date();
    await cacheManager.set(`${this.CACHE_PREFIX}${accountId}`, account, this.CACHE_TTL);

    logger.info('Activity simulated', { accountId, activityType, telegramUserId });
    return result;
  }

  /**
   * Get account analytics
   */
  async getAccountAnalytics(accountId: string, telegramUserId: number): Promise<AccountMetrics | null> {
    const account = this.simulatedAccounts.get(accountId);

    if (!account || account.telegramUserId !== telegramUserId) {
      return null;
    }

    return account.metrics;
  }

  /**
   * Reset account data
   */
  async resetAccountData(accountId: string, telegramUserId: number, resetType: string = 'full'): Promise<boolean> {
    const account = this.simulatedAccounts.get(accountId);

    if (!account || account.telegramUserId !== telegramUserId) {
      return false;
    }

    switch (resetType) {
      case 'metrics':
        account.metrics = this.generateAccountMetrics(account.profile, account.settings.simulationSettings.activityLevel);
        break;
      case 'content':
        account.content = this.generateContentData(account.profile, account.metrics);
        break;
      case 'engagement':
        account.engagement = this.generateEngagementData(account.profile, account.content);
        break;
      case 'full':
        const newMetrics = this.generateAccountMetrics(account.profile, account.settings.simulationSettings.activityLevel);
        const newContent = this.generateContentData(account.profile, newMetrics);
        account.metrics = newMetrics;
        account.content = newContent;
        account.engagement = this.generateEngagementData(account.profile, newContent);
        break;
    }

    account.lastActivity = new Date();
    await cacheManager.set(`${this.CACHE_PREFIX}${accountId}`, account, this.CACHE_TTL);

    logger.info('Account data reset', { accountId, resetType, telegramUserId });
    return true;
  }

  /**
   * Get simulator statistics
   */
  async getSimulatorStatistics(): Promise<any> {
    const totalAccounts = this.simulatedAccounts.size;
    const activeAccounts = Array.from(this.simulatedAccounts.values())
      .filter(account => account.status === 'active').length;

    const accountsByType = {
      personal: 0,
      business: 0,
      creator: 0,
      government: 0
    };

    const accountsByTier = {
      basic: 0,
      premium: 0,
      premium_plus: 0,
      enterprise: 0
    };

    Array.from(this.simulatedAccounts.values()).forEach(account => {
      accountsByType[account.profile.accountType]++;
      accountsByTier[account.profile.tier]++;
    });

    return {
      totalAccounts,
      activeAccounts,
      accountsByType,
      accountsByTier,
      totalUsers: this.userSessions.size,
      lastUpdated: new Date().toISOString()
    };
  }

  // Missing helper methods for content generation
  private generateMentions(count: number, profile: SimulatedProfile): MentionData[] {
    const mentions: MentionData[] = [];

    for (let i = 0; i < count; i++) {
      mentions.push({
        id: `mention_${i}`,
        mentionedUsername: `user${Math.floor(Math.random() * 10000)}`,
        tweetId: `tweet_${Math.floor(Math.random() * 100)}`,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }

    return mentions;
  }

  private generatePopularHashtags(accountType: string): string[] {
    const hashtagSets: { [key: string]: string[] } = {
      personal: ['#tech', '#life', '#motivation', '#growth', '#innovation', '#coding', '#startup'],
      business: ['#business', '#marketing', '#growth', '#success', '#leadership', '#innovation', '#strategy'],
      creator: ['#creative', '#art', '#design', '#content', '#inspiration', '#community', '#artist'],
      government: ['#public', '#community', '#policy', '#service', '#transparency', '#government', '#civic']
    };

    return (hashtagSets[accountType] || hashtagSets.personal) as string[];
  }

  private generateMediaUploads(count: number): MediaData[] {
    const media: MediaData[] = [];
    const types: ('photo' | 'video' | 'gif')[] = ['photo', 'video', 'gif'];

    for (let i = 0; i < count; i++) {
      const type = this.randomChoice(types);
      media.push({
        id: `media_${i}`,
        type,
        url: `https://example.com/media/${type}/${i}`,
        altText: `Sample ${type} content`,
        uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }

    return media;
  }

  private generateScheduledContent(profile: SimulatedProfile): ScheduledContent[] {
    const scheduled: ScheduledContent[] = [];
    const count = Math.floor(Math.random() * 10) + 1;

    for (let i = 0; i < count; i++) {
      scheduled.push({
        id: `scheduled_${i}`,
        text: this.generateTweetText(profile.accountType),
        scheduledFor: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        mediaIds: Math.random() < 0.3 ? [`media_${i}`] : [],
        status: this.randomChoice(['scheduled', 'published', 'failed'])
      });
    }

    return scheduled;
  }

  private generateEngagementItems(type: string, count: number, tweets: TweetData[]): EngagementItem[] {
    const items: EngagementItem[] = [];

    for (let i = 0; i < count; i++) {
      const tweet = this.randomChoice(tweets);
      items.push({
        id: `${type}_${i}`,
        userId: `user_${Math.floor(Math.random() * 10000)}`,
        username: `user${Math.floor(Math.random() * 10000)}`,
        tweetId: tweet.id,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }

    return items;
  }

  private generateDirectMessages(profile: SimulatedProfile): MessageData[] {
    const messages: MessageData[] = [];
    const count = Math.floor(profile.followersCount * 0.001) + Math.floor(Math.random() * 20);

    for (let i = 0; i < Math.min(count, 50); i++) {
      messages.push({
        id: `dm_${i}`,
        senderId: `user_${Math.floor(Math.random() * 10000)}`,
        recipientId: profile.username,
        text: this.generateDirectMessageText(),
        mediaIds: Math.random() < 0.1 ? [`media_${i}`] : [],
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        read: Math.random() < 0.8
      });
    }

    return messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private generateDirectMessageText(): string {
    const messages = [
      "Hi! I loved your recent post about innovation.",
      "Thanks for the follow! Looking forward to connecting.",
      "Great content! Would love to collaborate sometime.",
      "Your insights on the industry are really valuable.",
      "Just wanted to say thanks for the inspiration!",
      "Saw your latest project - amazing work!",
      "Would you be interested in a partnership opportunity?",
      "Your content always brightens my day. Thank you!",
      "I have a question about your recent post...",
      "Keep up the fantastic work! You're making a difference."
    ];

    return this.randomChoice(messages);
  }

  private generateNotifications(profile: SimulatedProfile, totalEngagements: number): NotificationData[] {
    const notifications: NotificationData[] = [];
    const types: ('like' | 'retweet' | 'reply' | 'mention' | 'follow' | 'dm')[] = ['like', 'retweet', 'reply', 'mention', 'follow', 'dm'];

    for (let i = 0; i < Math.min(totalEngagements, 100); i++) {
      const type = this.randomChoice(types);
      const tweetId = type !== 'follow' && type !== 'dm' ? `tweet_${Math.floor(Math.random() * 100)}` : undefined;

      const notification: NotificationData = {
        id: `notification_${i}`,
        type,
        fromUserId: `user_${Math.floor(Math.random() * 10000)}`,
        fromUsername: `user${Math.floor(Math.random() * 10000)}`,
        text: this.generateNotificationText(type),
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        read: Math.random() < 0.6
      };

      if (tweetId) {
        notification.tweetId = tweetId;
      }

      notifications.push(notification);
    }

    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private generateNotificationText(type: string): string {
    const texts: { [key: string]: string } = {
      like: 'liked your tweet',
      retweet: 'retweeted your tweet',
      reply: 'replied to your tweet',
      mention: 'mentioned you in a tweet',
      follow: 'started following you',
      dm: 'sent you a direct message'
    };

    return texts[type] || 'interacted with your content';
  }

  private generateRateLimits(): RateLimitData[] {
    const endpoints = [
      '/tweets', '/users/me', '/tweets/search', '/users/by/username',
      '/tweets/:id/liking_users', '/tweets/:id/retweeted_by', '/users/:id/followers'
    ];

    return endpoints.map(endpoint => ({
      endpoint,
      limit: 300,
      remaining: Math.floor(Math.random() * 300),
      resetTime: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
    }));
  }

  private generateErrorSimulation(): ErrorSimulationData[] {
    return [
      {
        errorType: 'rate_limit_exceeded',
        probability: 0.05,
        message: 'Rate limit exceeded',
        httpCode: 429
      },
      {
        errorType: 'unauthorized',
        probability: 0.01,
        message: 'Unauthorized access',
        httpCode: 401
      },
      {
        errorType: 'not_found',
        probability: 0.02,
        message: 'Resource not found',
        httpCode: 404
      },
      {
        errorType: 'server_error',
        probability: 0.01,
        message: 'Internal server error',
        httpCode: 500
      }
    ];
  }

  private generateResponseDelays(): ResponseDelayData[] {
    const endpoints = ['/tweets', '/users', '/search', '/upload'];

    return endpoints.map(endpoint => ({
      endpoint,
      minDelay: 100,
      maxDelay: 2000,
      averageDelay: 500 + Math.random() * 1000
    }));
  }

  private generateWebhookEvents(): WebhookEventData[] {
    const events: WebhookEventData[] = [];
    const eventTypes = ['tweet.create', 'tweet.delete', 'user.follow', 'user.unfollow'];

    for (let i = 0; i < 10; i++) {
      events.push({
        id: `webhook_${i}`,
        type: this.randomChoice(eventTypes),
        data: { sample: 'webhook data' },
        createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        delivered: Math.random() < 0.9
      });
    }

    return events;
  }

  // Activity simulation methods
  private async simulateTweet(account: SimulatedAccount, parameters?: any): Promise<any> {
    const tweetText = parameters?.text || this.generateTweetText(account.profile.accountType);
    const baseEngagement = Math.floor(account.profile.followersCount * 0.01 * (0.5 + Math.random()));

    const newTweet: TweetData = {
      id: `tweet_${Date.now()}`,
      text: tweetText,
      createdAt: new Date(),
      mediaIds: parameters?.mediaIds || [],
      hashtags: this.generateTweetHashtags(account.profile.accountType),
      mentions: parameters?.mentions || [],
      urls: parameters?.urls || [],
      metrics: {
        likes: Math.floor(baseEngagement * (0.6 + Math.random() * 0.8)),
        retweets: Math.floor(baseEngagement * (0.1 + Math.random() * 0.3)),
        replies: Math.floor(baseEngagement * (0.05 + Math.random() * 0.2)),
        quotes: Math.floor(baseEngagement * (0.02 + Math.random() * 0.1)),
        bookmarks: Math.floor(baseEngagement * (0.03 + Math.random() * 0.1)),
        impressions: Math.floor(baseEngagement * (10 + Math.random() * 20))
      }
    };

    // Add to account content
    account.content.tweets.unshift(newTweet);

    // Keep only recent tweets (last 100)
    if (account.content.tweets.length > 100) {
      account.content.tweets = account.content.tweets.slice(0, 100);
    }

    // Update profile tweet count
    account.profile.tweetsCount++;

    return {
      tweet: newTweet,
      message: 'Tweet posted successfully'
    };
  }

  private async simulateEngagement(account: SimulatedAccount, parameters?: any): Promise<any> {
    const engagementType = parameters?.type || this.randomChoice(['likes', 'retweets', 'replies']);
    const amount = parameters?.amount || Math.floor(Math.random() * 50) + 10;

    // Update recent tweets with new engagement
    account.content.tweets.slice(0, 5).forEach(tweet => {
      switch (engagementType) {
        case 'likes':
          tweet.metrics.likes += Math.floor(amount * (0.5 + Math.random()));
          break;
        case 'retweets':
          tweet.metrics.retweets += Math.floor(amount * 0.3 * (0.5 + Math.random()));
          break;
        case 'replies':
          tweet.metrics.replies += Math.floor(amount * 0.2 * (0.5 + Math.random()));
          break;
      }

      // Update impressions
      tweet.metrics.impressions += Math.floor(amount * 10 * (0.5 + Math.random()));
    });

    return {
      type: engagementType,
      amount,
      message: `${engagementType} engagement simulated successfully`
    };
  }

  private async simulateFollowerGrowth(account: SimulatedAccount, parameters?: any): Promise<any> {
    const growthAmount = parameters?.amount || Math.floor(Math.random() * 100) + 10;
    const growthType = parameters?.type || (Math.random() < 0.8 ? 'gain' : 'loss');

    if (growthType === 'gain') {
      account.profile.followersCount += growthAmount;
    } else {
      account.profile.followersCount = Math.max(0, account.profile.followersCount - growthAmount);
    }

    // Update growth metrics
    account.metrics.audienceGrowth.daily += growthType === 'gain' ? growthAmount : -growthAmount;
    account.metrics.audienceGrowth.weekly += growthType === 'gain' ? growthAmount : -growthAmount;
    account.metrics.audienceGrowth.monthly += growthType === 'gain' ? growthAmount : -growthAmount;

    return {
      type: growthType,
      amount: growthAmount,
      newFollowerCount: account.profile.followersCount,
      message: `Follower ${growthType} of ${growthAmount} simulated successfully`
    };
  }

  private async simulateAnalyticsUpdate(account: SimulatedAccount, parameters?: any): Promise<any> {
    // Update daily metrics
    const today = new Date();
    const todayMetrics = account.metrics.impressions.find(m =>
      m.date.toDateString() === today.toDateString()
    );

    if (todayMetrics) {
      todayMetrics.impressions += Math.floor(Math.random() * 1000) + 100;
      todayMetrics.engagements += Math.floor(Math.random() * 100) + 10;
      todayMetrics.profileVisits += Math.floor(Math.random() * 50) + 5;
    } else {
      account.metrics.impressions.unshift({
        date: today,
        impressions: Math.floor(Math.random() * 1000) + 500,
        engagements: Math.floor(Math.random() * 100) + 50,
        profileVisits: Math.floor(Math.random() * 50) + 25,
        mentions: Math.floor(Math.random() * 10),
        followers: account.profile.followersCount
      });
    }

    // Keep only last 30 days
    if (account.metrics.impressions.length > 30) {
      account.metrics.impressions = account.metrics.impressions.slice(0, 30);
    }

    // Update engagement rate
    const totalImpressions = account.metrics.impressions.reduce((sum, m) => sum + m.impressions, 0);
    const totalEngagements = account.metrics.impressions.reduce((sum, m) => sum + m.engagements, 0);
    account.metrics.engagementRate = totalImpressions > 0 ? totalEngagements / totalImpressions : 0;

    return {
      message: 'Analytics updated successfully',
      newMetrics: {
        totalImpressions,
        totalEngagements,
        engagementRate: account.metrics.engagementRate
      }
    };
  }

  // Background activity simulation
  private async simulateOngoingActivity(): Promise<void> {
    for (const account of this.simulatedAccounts.values()) {
      if (account.settings.simulationSettings.engagementSimulation) {
        try {
          // Random chance of activity based on activity level
          const activityChance = this.getActivityChance(account.settings.simulationSettings.activityLevel);

          if (Math.random() < activityChance) {
            const activityType = this.randomChoice(['engagement', 'followers', 'analytics']);
            await this.simulateActivity(account.id, account.telegramUserId, activityType);
          }
        } catch (error) {
          logger.error('Error in ongoing activity simulation:', error);
        }
      }
    }
  }

  private getActivityChance(activityLevel: string): number {
    const chances: { [key: string]: number } = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      viral: 0.9
    };

    return chances[activityLevel] || 0.3;
  }

  private async updateAccountMetrics(): Promise<void> {
    for (const account of this.simulatedAccounts.values()) {
      try {
        await this.simulateAnalyticsUpdate(account);
      } catch (error) {
        logger.error('Error updating account metrics:', error);
      }
    }
  }

  private async cleanupOldData(): Promise<void> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    for (const account of this.simulatedAccounts.values()) {
      // Clean old tweets
      account.content.tweets = account.content.tweets.filter(
        tweet => tweet.createdAt > cutoffDate
      );

      // Clean old notifications
      account.engagement.notifications = account.engagement.notifications.filter(
        notification => notification.createdAt > cutoffDate
      );

      // Clean old metrics
      account.metrics.impressions = account.metrics.impressions.filter(
        metric => metric.date > cutoffDate
      );
    }

    logger.info('Old simulation data cleaned up');
  }

  private async persistAccountToDatabase(account: SimulatedAccount): Promise<void> {
    try {
      // In a real implementation, this would save to the database
      // For now, we'll just log it
      logger.info('Account persisted to database', {
        accountId: account.id,
        telegramUserId: account.telegramUserId
      });
    } catch (error) {
      logger.error('Failed to persist account to database:', error);
    }
  }
}
