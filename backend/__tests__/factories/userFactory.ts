/**
 * User Factory - 2025 Edition
 * Enterprise-grade test data generation for users:
 * - Realistic user data generation
 * - Multiple user types and roles
 * - Relationship management
 * - Data consistency validation
 * - Performance optimization
 */

import { faker } from '@faker-js/faker';
import { PrismaClient, User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

// User factory configuration
export interface UserFactoryConfig {
  role?: UserRole;
  isActive?: boolean;
  emailVerified?: boolean;
  telegramId?: string;
  withCampaigns?: number;
  withPosts?: number;
  withAnalytics?: boolean;
  customData?: Partial<User>;
}

// Generated user data interface
export interface GeneratedUser extends User {
  plainPassword?: string;
  campaigns?: any[];
  posts?: any[];
  analytics?: any[];
}

/**
 * Enterprise User Factory
 */
export class UserFactory {
  private static instance: UserFactory;
  private prisma: PrismaClient;
  private generatedUsers: Map<string, GeneratedUser> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  static getInstance(prisma: PrismaClient): UserFactory {
    if (!UserFactory.instance) {
      UserFactory.instance = new UserFactory(prisma);
    }
    return UserFactory.instance;
  }

  /**
   * Generate user data without saving to database
   */
  generate(config: UserFactoryConfig = {}): Partial<User> & { plainPassword: string } {
    const plainPassword = config.customData?.password || faker.internet.password(12);
    const hashedPassword = bcrypt.hashSync(plainPassword, 10);

    const userData = {
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      username: faker.internet.userName().toLowerCase(),
      password: hashedPassword,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: config.role || UserRole.USER,
      isActive: config.isActive ?? true,
      emailVerified: config.emailVerified ?? true,
      telegramId: config.telegramId || (Math.random() > 0.5 ? faker.string.numeric(10) : null),
      avatar: faker.image.avatar(),
      bio: faker.lorem.sentence(),
      timezone: faker.location.timeZone(),
      language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de', 'it']),
      preferences: {
        notifications: {
          email: faker.datatype.boolean(),
          push: faker.datatype.boolean(),
          telegram: faker.datatype.boolean()
        },
        privacy: {
          profilePublic: faker.datatype.boolean(),
          analyticsSharing: faker.datatype.boolean()
        },
        ui: {
          theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
          language: faker.helpers.arrayElement(['en', 'es', 'fr'])
        }
      },
      metadata: {
        source: 'test_factory',
        createdBy: 'automated_test',
        testRun: process.env.JEST_WORKER_ID || 'main'
      },
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: new Date(),
      plainPassword,
      ...config.customData
    };

    return userData;
  }

  /**
   * Create user in database
   */
  async create(config: UserFactoryConfig = {}): Promise<GeneratedUser> {
    const userData = this.generate(config);
    const { plainPassword, ...userDataForDB } = userData;

    try {
      const user = await this.prisma.user.create({
        data: userDataForDB as any,
        include: {
          campaigns: config.withCampaigns ? true : false,
          posts: config.withPosts ? true : false,
          analytics: config.withAnalytics ? true : false
        }
      });

      const generatedUser: GeneratedUser = {
        ...user,
        plainPassword
      };

      // Generate related data if requested
      if (config.withCampaigns && config.withCampaigns > 0) {
        generatedUser.campaigns = await this.createCampaigns(user.id, config.withCampaigns);
      }

      if (config.withPosts && config.withPosts > 0) {
        generatedUser.posts = await this.createPosts(user.id, config.withPosts);
      }

      if (config.withAnalytics) {
        generatedUser.analytics = await this.createAnalytics(user.id);
      }

      // Cache generated user
      this.generatedUsers.set(user.id, generatedUser);

      return generatedUser;

    } catch (error) {
      throw new Error(`Failed to create user: ${(error as Error).message}`);
    }
  }

  /**
   * Create multiple users
   */
  async createMany(count: number, config: UserFactoryConfig = {}): Promise<GeneratedUser[]> {
    const users: GeneratedUser[] = [];
    
    for (let i = 0; i < count; i++) {
      const userConfig = {
        ...config,
        customData: {
          ...config.customData,
          email: `test-user-${i}-${Date.now()}@example.com`,
          username: `testuser${i}${Date.now()}`
        }
      };
      
      const user = await this.create(userConfig);
      users.push(user);
    }

    return users;
  }

  /**
   * Create admin user
   */
  async createAdmin(config: Omit<UserFactoryConfig, 'role'> = {}): Promise<GeneratedUser> {
    return this.create({
      ...config,
      role: UserRole.ADMIN,
      emailVerified: true,
      isActive: true
    });
  }

  /**
   * Create premium user
   */
  async createPremium(config: Omit<UserFactoryConfig, 'role'> = {}): Promise<GeneratedUser> {
    return this.create({
      ...config,
      role: UserRole.PREMIUM,
      emailVerified: true,
      isActive: true,
      withCampaigns: config.withCampaigns || 5,
      withPosts: config.withPosts || 20
    });
  }

  /**
   * Create user with specific email
   */
  async createWithEmail(email: string, config: UserFactoryConfig = {}): Promise<GeneratedUser> {
    return this.create({
      ...config,
      customData: {
        ...config.customData,
        email,
        username: email.split('@')[0]
      }
    });
  }

  /**
   * Create user with Telegram integration
   */
  async createWithTelegram(config: UserFactoryConfig = {}): Promise<GeneratedUser> {
    return this.create({
      ...config,
      telegramId: faker.string.numeric(10),
      customData: {
        ...config.customData,
        preferences: {
          notifications: {
            email: true,
            push: true,
            telegram: true
          }
        }
      }
    });
  }

  /**
   * Create campaigns for user
   */
  private async createCampaigns(userId: string, count: number): Promise<any[]> {
    const campaigns = [];
    
    for (let i = 0; i < count; i++) {
      const campaign = await this.prisma.campaign.create({
        data: {
          id: faker.string.uuid(),
          name: faker.company.catchPhrase(),
          description: faker.lorem.paragraph(),
          userId,
          status: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
          settings: {
            targetAudience: faker.helpers.arrayElements(['18-25', '26-35', '36-45', '46-55'], 2),
            platforms: faker.helpers.arrayElements(['twitter', 'facebook', 'instagram', 'linkedin'], 2),
            budget: faker.number.int({ min: 100, max: 10000 }),
            duration: faker.number.int({ min: 7, max: 90 })
          },
          metrics: {
            impressions: faker.number.int({ min: 0, max: 100000 }),
            clicks: faker.number.int({ min: 0, max: 10000 }),
            conversions: faker.number.int({ min: 0, max: 1000 }),
            spend: faker.number.float({ min: 0, max: 5000, fractionDigits: 2 })
          },
          createdAt: faker.date.past({ years: 1 }),
          updatedAt: new Date()
        }
      });
      
      campaigns.push(campaign);
    }

    return campaigns;
  }

  /**
   * Create posts for user
   */
  private async createPosts(userId: string, count: number): Promise<any[]> {
    const posts = [];
    
    for (let i = 0; i < count; i++) {
      const post = await this.prisma.post.create({
        data: {
          id: faker.string.uuid(),
          content: faker.lorem.paragraphs(2),
          platform: faker.helpers.arrayElement(['twitter', 'facebook', 'instagram', 'linkedin']),
          status: faker.helpers.arrayElement(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']),
          scheduledFor: faker.date.future(),
          userId,
          metadata: {
            hashtags: faker.helpers.arrayElements(['#marketing', '#social', '#business', '#growth'], 2),
            mentions: [],
            mediaUrls: faker.datatype.boolean() ? [faker.image.url()] : []
          },
          metrics: {
            likes: faker.number.int({ min: 0, max: 1000 }),
            shares: faker.number.int({ min: 0, max: 100 }),
            comments: faker.number.int({ min: 0, max: 50 }),
            reach: faker.number.int({ min: 0, max: 10000 })
          },
          createdAt: faker.date.past({ months: 6 }),
          updatedAt: new Date()
        }
      });
      
      posts.push(post);
    }

    return posts;
  }

  /**
   * Create analytics for user
   */
  private async createAnalytics(userId: string): Promise<any[]> {
    const analytics = [];
    const days = 30;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const analytic = await this.prisma.analytics.create({
        data: {
          id: faker.string.uuid(),
          userId,
          eventType: faker.helpers.arrayElement(['page_view', 'click', 'conversion', 'signup']),
          eventData: {
            page: faker.internet.url(),
            source: faker.helpers.arrayElement(['organic', 'paid', 'social', 'email']),
            medium: faker.helpers.arrayElement(['cpc', 'organic', 'social', 'email']),
            campaign: faker.company.catchPhrase()
          },
          metadata: {
            userAgent: faker.internet.userAgent(),
            ipAddress: faker.internet.ip(),
            country: faker.location.country(),
            city: faker.location.city()
          },
          createdAt: date
        }
      });
      
      analytics.push(analytic);
    }

    return analytics;
  }

  /**
   * Get generated user by ID
   */
  getGeneratedUser(id: string): GeneratedUser | undefined {
    return this.generatedUsers.get(id);
  }

  /**
   * Get all generated users
   */
  getAllGeneratedUsers(): GeneratedUser[] {
    return Array.from(this.generatedUsers.values());
  }

  /**
   * Clear generated users cache
   */
  clearCache(): void {
    this.generatedUsers.clear();
  }

  /**
   * Cleanup all generated users
   */
  async cleanup(): Promise<void> {
    const userIds = Array.from(this.generatedUsers.keys());
    
    if (userIds.length > 0) {
      // Delete related data first
      await this.prisma.analytics.deleteMany({
        where: { userId: { in: userIds } }
      });
      
      await this.prisma.post.deleteMany({
        where: { userId: { in: userIds } }
      });
      
      await this.prisma.campaign.deleteMany({
        where: { userId: { in: userIds } }
      });
      
      // Delete users
      await this.prisma.user.deleteMany({
        where: { id: { in: userIds } }
      });
    }
    
    this.clearCache();
  }
}

// Export factory instance getter
export const getUserFactory = (prisma: PrismaClient): UserFactory => {
  return UserFactory.getInstance(prisma);
};
