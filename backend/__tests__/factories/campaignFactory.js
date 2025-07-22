"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCampaignFactory = exports.CampaignFactory = void 0;
const faker_1 = require("@faker-js/faker");
const client_1 = require("@prisma/client");
class CampaignFactory {
    constructor(prisma) {
        this.generatedCampaigns = new Map();
        this.prisma = prisma;
    }
    static getInstance(prisma) {
        if (!CampaignFactory.instance) {
            CampaignFactory.instance = new CampaignFactory(prisma);
        }
        return CampaignFactory.instance;
    }
    generate(config = {}) {
        const campaignType = config.campaignType || faker_1.faker.helpers.arrayElement(['awareness', 'conversion', 'engagement', 'traffic']);
        const budget = config.budget || faker_1.faker.number.int({ min: 500, max: 50000 });
        const duration = config.duration || faker_1.faker.number.int({ min: 7, max: 90 });
        const campaignData = {
            id: faker_1.faker.string.uuid(),
            name: this.generateCampaignName(campaignType),
            description: this.generateCampaignDescription(campaignType),
            userId: config.userId || faker_1.faker.string.uuid(),
            status: config.status || faker_1.faker.helpers.arrayElement(Object.values(client_1.CampaignStatus)),
            settings: this.generateCampaignSettings(campaignType, budget, duration),
            metrics: config.withMetrics ? this.generateCampaignMetrics(campaignType, budget) : {},
            metadata: {
                campaignType,
                source: 'test_factory',
                createdBy: 'automated_test',
                testRun: process.env.JEST_WORKER_ID || 'main'
            },
            createdAt: faker_1.faker.date.past({ years: 1 }),
            updatedAt: new Date(),
            ...config.customData
        };
        return campaignData;
    }
    async create(config = {}) {
        if (!config.userId) {
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
                data: campaignData,
                include: {
                    user: true,
                    posts: config.withPosts ? true : false
                }
            });
            const generatedCampaign = {
                ...campaign
            };
            if (config.withPosts && config.withPosts > 0) {
                generatedCampaign.posts = await this.createPosts(campaign.id, campaign.userId, config.withPosts);
            }
            if (config.withAnalytics) {
                generatedCampaign.analytics = await this.createAnalytics(campaign.id, campaign.userId);
            }
            this.generatedCampaigns.set(campaign.id, generatedCampaign);
            return generatedCampaign;
        }
        catch (error) {
            throw new Error(`Failed to create campaign: ${error.message}`);
        }
    }
    async createMany(count, config = {}) {
        const campaigns = [];
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
    async createActive(config = {}) {
        return this.create({
            ...config,
            status: client_1.CampaignStatus.ACTIVE,
            withMetrics: true,
            withPosts: config.withPosts || 5
        });
    }
    async createDraft(config = {}) {
        return this.create({
            ...config,
            status: client_1.CampaignStatus.DRAFT,
            withMetrics: false
        });
    }
    async createCompleted(config = {}) {
        return this.create({
            ...config,
            status: client_1.CampaignStatus.COMPLETED,
            withMetrics: true,
            withPosts: config.withPosts || 10,
            withAnalytics: true
        });
    }
    generateCampaignName(type) {
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
        const templates = nameTemplates[type] || nameTemplates.awareness;
        return faker_1.faker.helpers.arrayElement(templates) + ' ' + faker_1.faker.date.recent().getFullYear();
    }
    generateCampaignDescription(type) {
        const descriptions = {
            awareness: 'Increase brand visibility and recognition among target audience through strategic content distribution and engagement.',
            conversion: 'Drive qualified leads and conversions through targeted messaging and optimized user journey experiences.',
            engagement: 'Build community engagement and foster meaningful interactions with our audience across social platforms.',
            traffic: 'Generate high-quality website traffic and increase visitor acquisition through compelling content and CTAs.'
        };
        return descriptions[type] || descriptions.awareness;
    }
    generateCampaignSettings(type, budget, duration) {
        const baseSettings = {
            budget,
            duration,
            targetAudience: {
                ageRange: faker_1.faker.helpers.arrayElement(['18-25', '26-35', '36-45', '46-55', '55+']),
                interests: faker_1.faker.helpers.arrayElements([
                    'technology', 'business', 'marketing', 'social media', 'entrepreneurship',
                    'finance', 'health', 'fitness', 'travel', 'food', 'fashion', 'sports'
                ], 3),
                locations: faker_1.faker.helpers.arrayElements([
                    'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France'
                ], 2)
            },
            platforms: faker_1.faker.helpers.arrayElements(['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'], 3),
            schedule: {
                startDate: faker_1.faker.date.recent(),
                endDate: faker_1.faker.date.future(),
                timezone: faker_1.faker.location.timeZone(),
                postingTimes: faker_1.faker.helpers.arrayElements(['09:00', '12:00', '15:00', '18:00', '21:00'], 2)
            }
        };
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
            ...typeSpecificSettings[type]
        };
    }
    generateCampaignMetrics(type, budget) {
        const baseMetrics = {
            impressions: faker_1.faker.number.int({ min: budget * 10, max: budget * 100 }),
            clicks: faker_1.faker.number.int({ min: budget * 0.5, max: budget * 5 }),
            spend: faker_1.faker.number.float({ min: budget * 0.1, max: budget * 0.9, fractionDigits: 2 }),
            cpm: faker_1.faker.number.float({ min: 1, max: 15, fractionDigits: 2 }),
            cpc: faker_1.faker.number.float({ min: 0.5, max: 5, fractionDigits: 2 })
        };
        const ctr = baseMetrics.clicks / baseMetrics.impressions;
        const typeSpecificMetrics = {
            awareness: {
                reach: faker_1.faker.number.int({ min: baseMetrics.impressions * 0.6, max: baseMetrics.impressions * 0.9 }),
                frequency: faker_1.faker.number.float({ min: 1.1, max: 3.5, fractionDigits: 1 }),
                brandLift: faker_1.faker.number.float({ min: 5, max: 25, fractionDigits: 1 })
            },
            conversion: {
                conversions: faker_1.faker.number.int({ min: baseMetrics.clicks * 0.01, max: baseMetrics.clicks * 0.1 }),
                conversionRate: faker_1.faker.number.float({ min: 1, max: 10, fractionDigits: 2 }),
                costPerConversion: faker_1.faker.number.float({ min: 10, max: 100, fractionDigits: 2 })
            },
            engagement: {
                likes: faker_1.faker.number.int({ min: baseMetrics.clicks * 2, max: baseMetrics.clicks * 10 }),
                shares: faker_1.faker.number.int({ min: baseMetrics.clicks * 0.1, max: baseMetrics.clicks * 0.5 }),
                comments: faker_1.faker.number.int({ min: baseMetrics.clicks * 0.05, max: baseMetrics.clicks * 0.3 }),
                engagementRate: faker_1.faker.number.float({ min: 2, max: 15, fractionDigits: 2 })
            },
            traffic: {
                sessions: faker_1.faker.number.int({ min: baseMetrics.clicks * 0.8, max: baseMetrics.clicks }),
                bounceRate: faker_1.faker.number.float({ min: 20, max: 80, fractionDigits: 1 }),
                avgSessionDuration: faker_1.faker.number.int({ min: 30, max: 300 }),
                pageViews: faker_1.faker.number.int({ min: baseMetrics.clicks, max: baseMetrics.clicks * 3 })
            }
        };
        return {
            ...baseMetrics,
            ctr: parseFloat((ctr * 100).toFixed(2)),
            ...typeSpecificMetrics[type]
        };
    }
    async createPosts(campaignId, userId, count) {
        const posts = [];
        for (let i = 0; i < count; i++) {
            const post = await this.prisma.post.create({
                data: {
                    id: faker_1.faker.string.uuid(),
                    content: faker_1.faker.lorem.paragraphs(faker_1.faker.number.int({ min: 1, max: 3 })),
                    platform: faker_1.faker.helpers.arrayElement(['twitter', 'facebook', 'instagram', 'linkedin']),
                    status: faker_1.faker.helpers.arrayElement(['DRAFT', 'SCHEDULED', 'PUBLISHED']),
                    scheduledFor: faker_1.faker.date.future(),
                    userId,
                    campaignId,
                    metadata: {
                        hashtags: faker_1.faker.helpers.arrayElements([
                            '#marketing', '#business', '#growth', '#social', '#digital',
                            '#strategy', '#success', '#innovation', '#brand', '#content'
                        ], faker_1.faker.number.int({ min: 2, max: 5 })),
                        mentions: [],
                        mediaUrls: faker_1.faker.datatype.boolean() ? [faker_1.faker.image.url()] : []
                    },
                    metrics: {
                        likes: faker_1.faker.number.int({ min: 0, max: 1000 }),
                        shares: faker_1.faker.number.int({ min: 0, max: 100 }),
                        comments: faker_1.faker.number.int({ min: 0, max: 50 }),
                        reach: faker_1.faker.number.int({ min: 0, max: 10000 })
                    },
                    createdAt: faker_1.faker.date.past({ months: 3 }),
                    updatedAt: new Date()
                }
            });
            posts.push(post);
        }
        return posts;
    }
    async createAnalytics(campaignId, userId) {
        const analytics = [];
        const days = 30;
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const analytic = await this.prisma.analytics.create({
                data: {
                    id: faker_1.faker.string.uuid(),
                    userId,
                    campaignId,
                    eventType: faker_1.faker.helpers.arrayElement(['impression', 'click', 'conversion', 'engagement']),
                    eventData: {
                        platform: faker_1.faker.helpers.arrayElement(['twitter', 'facebook', 'instagram', 'linkedin']),
                        adType: faker_1.faker.helpers.arrayElement(['image', 'video', 'carousel', 'text']),
                        placement: faker_1.faker.helpers.arrayElement(['feed', 'story', 'sidebar', 'header']),
                        audience: faker_1.faker.helpers.arrayElement(['lookalike', 'interest', 'custom', 'retargeting'])
                    },
                    metadata: {
                        userAgent: faker_1.faker.internet.userAgent(),
                        ipAddress: faker_1.faker.internet.ip(),
                        country: faker_1.faker.location.country(),
                        city: faker_1.faker.location.city(),
                        device: faker_1.faker.helpers.arrayElement(['desktop', 'mobile', 'tablet'])
                    },
                    createdAt: date
                }
            });
            analytics.push(analytic);
        }
        return analytics;
    }
    getGeneratedCampaign(id) {
        return this.generatedCampaigns.get(id);
    }
    getAllGeneratedCampaigns() {
        return Array.from(this.generatedCampaigns.values());
    }
    clearCache() {
        this.generatedCampaigns.clear();
    }
    async cleanup() {
        const campaignIds = Array.from(this.generatedCampaigns.keys());
        if (campaignIds.length > 0) {
            await this.prisma.analytics.deleteMany({
                where: { campaignId: { in: campaignIds } }
            });
            await this.prisma.post.deleteMany({
                where: { campaignId: { in: campaignIds } }
            });
            await this.prisma.campaign.deleteMany({
                where: { id: { in: campaignIds } }
            });
        }
        this.clearCache();
    }
}
exports.CampaignFactory = CampaignFactory;
const getCampaignFactory = (prisma) => {
    return CampaignFactory.getInstance(prisma);
};
exports.getCampaignFactory = getCampaignFactory;
//# sourceMappingURL=campaignFactory.js.map