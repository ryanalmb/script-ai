/**
 * Campaign Factory - 2025 Edition
 * Enterprise-grade test data generation for campaigns:
 * - Realistic campaign data generation
 * - Multiple campaign types and statuses
 * - Performance metrics simulation
 * - User relationship management
 * - Data consistency validation
 */

import { faker } from '@faker-js/faker';
import { PrismaClient, Campaign, CampaignStatus } from '@prisma/client';

// Campaign factory configuration
export interface CampaignFactoryConfig {
  userId?: string;
  status?: CampaignStatus;
  withPosts?: number;
  withAnalytics?: boolean;
  withMetrics?: boolean;
  campaignType?: 'awareness' | 'conversion' | 'engagement' | 'traffic';
  budget?: number;
  duration?: number;
  customData?: Partial<Campaign>;
}

// Generated campaign data interface
export interface GeneratedCampaign extends Campaign {
  posts?: any[];
  analytics?: any[];
  user?: any;
}

/**
 * Enterprise Campaign Factory
 */
export class CampaignFactory {
  private static instance: CampaignFactory;
  private prisma: PrismaClient;
  private generatedCampaigns: Map<string, GeneratedCampaign> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  static getInstance(prisma: PrismaClient): CampaignFactory {
    if (!CampaignFactory.instance) {
      CampaignFactory.instance = new CampaignFactory(prisma);
    }
    return CampaignFactory.instance;
  }

  /**
   * Generate campaign data without saving to database
   */
  generate(config: CampaignFactoryConfig = {}): Partial<Campaign> {
    const campaignType = config.campaignType || faker.helpers.arrayElement(['awareness', 'conversion', 'engagement', 'traffic']);
    const budget = config.budget || faker.number.int({ min: 500, max: 50000 });
    const duration = config.duration || faker.number.int({ min: 7, max: 90 });

    const campaignData = {
      id: faker.string.uuid(),
      name: this.generateCampaignName(campaignType),
      description: this.generateCampaignDescription(campaignType),
      userId: config.userId || faker.string.uuid(),
      status: config.status || faker.helpers.arrayElement(Object.values(CampaignStatus)),
      settings: this.generateCampaignSettings(campaignType, budget, duration),
      metrics: config.withMetrics ? this.generateCampaignMetrics(campaignType, budget) : {},
      metadata: {
        campaignType,
        source: 'test_factory',
        createdBy: 'automated_test',
        testRun: process.env.JEST_WORKER_ID || 'main'
      },
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: new Date(),
      ...config.customData
    };

    return campaignData;
  }

  /**
   * Create campaign in database
   */
  async create(config: CampaignFactoryConfig = {}): Promise<GeneratedCampaign> {
    // Ensure we have a valid user ID
    if (!config.userId) {
      // Create a test user if none provided
      const testUser = await this.prisma.user.create({
        data: {
          email: `campaign-user-${Date.now()}@example.com`,
          username: `campaignuser${Date.now()}`,
          password: '$2a$10$test.hash.for.testing.purposes.only',
          isActive: true,
          emailVerified: true
        }
      });
      config.userId = testUser.id;
    }

    const campaignData = this.generate(config);

    try {
      const campaign = await this.prisma.campaign.create({
        data: campaignData as any,
        include: {
          user: true,
          posts: config.withPosts ? true : false
        }
      });

      const generatedCampaign: GeneratedCampaign = {
        ...campaign
      };

      // Generate related data if requested
      if (config.withPosts && config.withPosts > 0) {
        generatedCampaign.posts = await this.createPosts(campaign.id, campaign.userId, config.withPosts);
      }

      if (config.withAnalytics) {
        generatedCampaign.analytics = await this.createAnalytics(campaign.id, campaign.userId);
      }

      // Cache generated campaign
      this.generatedCampaigns.set(campaign.id, generatedCampaign);

      return generatedCampaign;

    } catch (error) {
      throw new Error(`Failed to create campaign: ${(error as Error).message}`);
    }
  }

  /**
   * Create multiple campaigns
   */
  async createMany(count: number, config: CampaignFactoryConfig = {}): Promise<GeneratedCampaign[]> {
    const campaigns: GeneratedCampaign[] = [];
    
    for (let i = 0; i < count; i++) {
      const campaignConfig = {
        ...config,
        customData: {
          ...config.customData,
          name: `Test Campaign ${i + 1} - ${Date.now()}`
        }
      };
      
      const campaign = await this.create(campaignConfig);
      campaigns.push(campaign);
    }

    return campaigns;
  }

  /**
   * Create active campaign
   */
  async createActive(config: Omit<CampaignFactoryConfig, 'status'> = {}): Promise<GeneratedCampaign> {
    return this.create({
      ...config,
      status: CampaignStatus.ACTIVE,
      withMetrics: true,
      withPosts: config.withPosts || 5
    });
  }

  /**
   * Create draft campaign
   */
  async createDraft(config: Omit<CampaignFactoryConfig, 'status'> = {}): Promise<GeneratedCampaign> {
    return this.create({
      ...config,
      status: CampaignStatus.DRAFT,
      withMetrics: false
    });
  }

  /**
   * Create completed campaign
   */
  async createCompleted(config: Omit<CampaignFactoryConfig, 'status'> = {}): Promise<GeneratedCampaign> {
    return this.create({
      ...config,
      status: CampaignStatus.COMPLETED,
      withMetrics: true,
      withPosts: config.withPosts || 10,
      withAnalytics: true
    });
  }

  /**
   * Generate campaign name based on type
   */
  private generateCampaignName(type: string): string {
    const nameTemplates = {
      awareness: [
        'Brand Awareness Drive',
        'Market Visibility Campaign',
        'Brand Recognition Initiative',
        'Awareness Boost Campaign'
      ],
      conversion: [
        'Sales Conversion Drive',
        'Lead Generation Campaign',
        'Conversion Optimization',
        'Revenue Growth Initiative'
      ],
      engagement: [
        'Community Engagement Drive',
        'Social Interaction Campaign',
        'User Engagement Boost',
        'Community Building Initiative'
      ],
      traffic: [
        'Website Traffic Drive',
        'Visitor Acquisition Campaign',
        'Traffic Generation Initiative',
        'Site Visitor Boost'
      ]
    };

    const templates = nameTemplates[type as keyof typeof nameTemplates] || nameTemplates.awareness;
    return faker.helpers.arrayElement(templates) + ' ' + faker.date.recent().getFullYear();
  }

  /**
   * Generate campaign description based on type
   */
  private generateCampaignDescription(type: string): string {
    const descriptions = {
      awareness: 'Increase brand visibility and recognition among target audience through strategic content distribution and engagement.',
      conversion: 'Drive qualified leads and conversions through targeted messaging and optimized user journey experiences.',
      engagement: 'Build community engagement and foster meaningful interactions with our audience across social platforms.',
      traffic: 'Generate high-quality website traffic and increase visitor acquisition through compelling content and CTAs.'
    };

    return descriptions[type as keyof typeof descriptions] || descriptions.awareness;
  }

  /**
   * Generate campaign settings based on type
   */
  private generateCampaignSettings(type: string, budget: number, duration: number): any {
    const baseSettings = {
      budget,
      duration,
      targetAudience: {
        ageRange: faker.helpers.arrayElement(['18-25', '26-35', '36-45', '46-55', '55+']),
        interests: faker.helpers.arrayElements([
          'technology', 'business', 'marketing', 'social media', 'entrepreneurship',
          'finance', 'health', 'fitness', 'travel', 'food', 'fashion', 'sports'
        ], 3),
        locations: faker.helpers.arrayElements([
          'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France'
        ], 2)
      },
      platforms: faker.helpers.arrayElements(['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'], 3),
      schedule: {
        startDate: faker.date.recent(),
        endDate: faker.date.future(),
        timezone: faker.location.timeZone(),
        postingTimes: faker.helpers.arrayElements(['09:00', '12:00', '15:00', '18:00', '21:00'], 2)
      }
    };

    // Type-specific settings
    const typeSpecificSettings = {
      awareness: {
        objective: 'brand_awareness',
        bidStrategy: 'maximize_reach',
        creativeFocus: 'brand_messaging'
      },
      conversion: {
        objective: 'conversions',
        bidStrategy: 'target_cpa',
        creativeFocus: 'call_to_action',
        conversionGoals: ['purchase', 'signup', 'download']
      },
      engagement: {
        objective: 'engagement',
        bidStrategy: 'maximize_engagement',
        creativeFocus: 'interactive_content'
      },
      traffic: {
        objective: 'traffic',
        bidStrategy: 'maximize_clicks',
        creativeFocus: 'compelling_headlines'
      }
    };

    return {
      ...baseSettings,
      ...typeSpecificSettings[type as keyof typeof typeSpecificSettings]
    };
  }

  /**
   * Generate campaign metrics based on type and budget
   */
  private generateCampaignMetrics(type: string, budget: number): any {
    const baseMetrics = {
      impressions: faker.number.int({ min: budget * 10, max: budget * 100 }),
      clicks: faker.number.int({ min: budget * 0.5, max: budget * 5 }),
      spend: faker.number.float({ min: budget * 0.1, max: budget * 0.9, fractionDigits: 2 }),
      cpm: faker.number.float({ min: 1, max: 15, fractionDigits: 2 }),
      cpc: faker.number.float({ min: 0.5, max: 5, fractionDigits: 2 })
    };

    // Calculate CTR
    const ctr = baseMetrics.clicks / baseMetrics.impressions;
    
    // Type-specific metrics
    const typeSpecificMetrics = {
      awareness: {
        reach: faker.number.int({ min: baseMetrics.impressions * 0.6, max: baseMetrics.impressions * 0.9 }),
        frequency: faker.number.float({ min: 1.1, max: 3.5, fractionDigits: 1 }),
        brandLift: faker.number.float({ min: 5, max: 25, fractionDigits: 1 })
      },
      conversion: {
        conversions: faker.number.int({ min: baseMetrics.clicks * 0.01, max: baseMetrics.clicks * 0.1 }),
        conversionRate: faker.number.float({ min: 1, max: 10, fractionDigits: 2 }),
        costPerConversion: faker.number.float({ min: 10, max: 100, fractionDigits: 2 })
      },
      engagement: {
        likes: faker.number.int({ min: baseMetrics.clicks * 2, max: baseMetrics.clicks * 10 }),
        shares: faker.number.int({ min: baseMetrics.clicks * 0.1, max: baseMetrics.clicks * 0.5 }),
        comments: faker.number.int({ min: baseMetrics.clicks * 0.05, max: baseMetrics.clicks * 0.3 }),
        engagementRate: faker.number.float({ min: 2, max: 15, fractionDigits: 2 })
      },
      traffic: {
        sessions: faker.number.int({ min: baseMetrics.clicks * 0.8, max: baseMetrics.clicks }),
        bounceRate: faker.number.float({ min: 20, max: 80, fractionDigits: 1 }),
        avgSessionDuration: faker.number.int({ min: 30, max: 300 }),
        pageViews: faker.number.int({ min: baseMetrics.clicks, max: baseMetrics.clicks * 3 })
      }
    };

    return {
      ...baseMetrics,
      ctr: parseFloat((ctr * 100).toFixed(2)),
      ...typeSpecificMetrics[type as keyof typeof typeSpecificMetrics]
    };
  }

  /**
   * Create posts for campaign
   */
  private async createPosts(campaignId: string, userId: string, count: number): Promise<any[]> {
    const posts = [];
    
    for (let i = 0; i < count; i++) {
      const post = await this.prisma.post.create({
        data: {
          id: faker.string.uuid(),
          content: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })),
          platform: faker.helpers.arrayElement(['twitter', 'facebook', 'instagram', 'linkedin']),
          status: faker.helpers.arrayElement(['DRAFT', 'SCHEDULED', 'PUBLISHED']),
          scheduledFor: faker.date.future(),
          userId,
          campaignId,
          metadata: {
            hashtags: faker.helpers.arrayElements([
              '#marketing', '#business', '#growth', '#social', '#digital',
              '#strategy', '#success', '#innovation', '#brand', '#content'
            ], faker.number.int({ min: 2, max: 5 })),
            mentions: [],
            mediaUrls: faker.datatype.boolean() ? [faker.image.url()] : []
          },
          metrics: {
            likes: faker.number.int({ min: 0, max: 1000 }),
            shares: faker.number.int({ min: 0, max: 100 }),
            comments: faker.number.int({ min: 0, max: 50 }),
            reach: faker.number.int({ min: 0, max: 10000 })
          },
          createdAt: faker.date.past({ months: 3 }),
          updatedAt: new Date()
        }
      });
      
      posts.push(post);
    }

    return posts;
  }

  /**
   * Create analytics for campaign
   */
  private async createAnalytics(campaignId: string, userId: string): Promise<any[]> {
    const analytics = [];
    const days = 30;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const analytic = await this.prisma.analytics.create({
        data: {
          id: faker.string.uuid(),
          userId,
          campaignId,
          eventType: faker.helpers.arrayElement(['impression', 'click', 'conversion', 'engagement']),
          eventData: {
            platform: faker.helpers.arrayElement(['twitter', 'facebook', 'instagram', 'linkedin']),
            adType: faker.helpers.arrayElement(['image', 'video', 'carousel', 'text']),
            placement: faker.helpers.arrayElement(['feed', 'story', 'sidebar', 'header']),
            audience: faker.helpers.arrayElement(['lookalike', 'interest', 'custom', 'retargeting'])
          },
          metadata: {
            userAgent: faker.internet.userAgent(),
            ipAddress: faker.internet.ip(),
            country: faker.location.country(),
            city: faker.location.city(),
            device: faker.helpers.arrayElement(['desktop', 'mobile', 'tablet'])
          },
          createdAt: date
        }
      });
      
      analytics.push(analytic);
    }

    return analytics;
  }

  /**
   * Get generated campaign by ID
   */
  getGeneratedCampaign(id: string): GeneratedCampaign | undefined {
    return this.generatedCampaigns.get(id);
  }

  /**
   * Get all generated campaigns
   */
  getAllGeneratedCampaigns(): GeneratedCampaign[] {
    return Array.from(this.generatedCampaigns.values());
  }

  /**
   * Clear generated campaigns cache
   */
  clearCache(): void {
    this.generatedCampaigns.clear();
  }

  /**
   * Cleanup all generated campaigns
   */
  async cleanup(): Promise<void> {
    const campaignIds = Array.from(this.generatedCampaigns.keys());
    
    if (campaignIds.length > 0) {
      // Delete related data first
      await this.prisma.analytics.deleteMany({
        where: { campaignId: { in: campaignIds } }
      });
      
      await this.prisma.post.deleteMany({
        where: { campaignId: { in: campaignIds } }
      });
      
      // Delete campaigns
      await this.prisma.campaign.deleteMany({
        where: { id: { in: campaignIds } }
      });
    }
    
    this.clearCache();
  }
}

// Export factory instance getter
export const getCampaignFactory = (prisma: PrismaClient): CampaignFactory => {
  return CampaignFactory.getInstance(prisma);
};
