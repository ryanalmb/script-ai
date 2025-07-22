"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFactory = exports.UserFactory = void 0;
const faker_1 = require("@faker-js/faker");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class UserFactory {
    constructor(prisma) {
        this.generatedUsers = new Map();
        this.prisma = prisma;
    }
    static getInstance(prisma) {
        if (!UserFactory.instance) {
            UserFactory.instance = new UserFactory(prisma);
        }
        return UserFactory.instance;
    }
    generate(config = {}) {
        const plainPassword = config.customData?.password || faker_1.faker.internet.password(12);
        const hashedPassword = bcryptjs_1.default.hashSync(plainPassword, 10);
        const userData = {
            id: faker_1.faker.string.uuid(),
            email: faker_1.faker.internet.email().toLowerCase(),
            username: faker_1.faker.internet.userName().toLowerCase(),
            password: hashedPassword,
            firstName: faker_1.faker.person.firstName(),
            lastName: faker_1.faker.person.lastName(),
            role: config.role || client_1.UserRole.USER,
            isActive: config.isActive ?? true,
            emailVerified: config.emailVerified ?? true,
            telegramId: config.telegramId || (Math.random() > 0.5 ? faker_1.faker.string.numeric(10) : null),
            avatar: faker_1.faker.image.avatar(),
            bio: faker_1.faker.lorem.sentence(),
            timezone: faker_1.faker.location.timeZone(),
            language: faker_1.faker.helpers.arrayElement(['en', 'es', 'fr', 'de', 'it']),
            preferences: {
                notifications: {
                    email: faker_1.faker.datatype.boolean(),
                    push: faker_1.faker.datatype.boolean(),
                    telegram: faker_1.faker.datatype.boolean()
                },
                privacy: {
                    profilePublic: faker_1.faker.datatype.boolean(),
                    analyticsSharing: faker_1.faker.datatype.boolean()
                },
                ui: {
                    theme: faker_1.faker.helpers.arrayElement(['light', 'dark', 'auto']),
                    language: faker_1.faker.helpers.arrayElement(['en', 'es', 'fr'])
                }
            },
            metadata: {
                source: 'test_factory',
                createdBy: 'automated_test',
                testRun: process.env.JEST_WORKER_ID || 'main'
            },
            createdAt: faker_1.faker.date.past({ years: 2 }),
            updatedAt: new Date(),
            plainPassword,
            ...config.customData
        };
        return userData;
    }
    async create(config = {}) {
        const userData = this.generate(config);
        const { plainPassword, ...userDataForDB } = userData;
        try {
            const user = await this.prisma.user.create({
                data: userDataForDB,
                include: {
                    campaigns: config.withCampaigns ? true : false,
                    posts: config.withPosts ? true : false,
                    analytics: config.withAnalytics ? true : false
                }
            });
            const generatedUser = {
                ...user,
                plainPassword
            };
            if (config.withCampaigns && config.withCampaigns > 0) {
                generatedUser.campaigns = await this.createCampaigns(user.id, config.withCampaigns);
            }
            if (config.withPosts && config.withPosts > 0) {
                generatedUser.posts = await this.createPosts(user.id, config.withPosts);
            }
            if (config.withAnalytics) {
                generatedUser.analytics = await this.createAnalytics(user.id);
            }
            this.generatedUsers.set(user.id, generatedUser);
            return generatedUser;
        }
        catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }
    async createMany(count, config = {}) {
        const users = [];
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
    async createAdmin(config = {}) {
        return this.create({
            ...config,
            role: client_1.UserRole.ADMIN,
            emailVerified: true,
            isActive: true
        });
    }
    async createPremium(config = {}) {
        return this.create({
            ...config,
            role: client_1.UserRole.PREMIUM,
            emailVerified: true,
            isActive: true,
            withCampaigns: config.withCampaigns || 5,
            withPosts: config.withPosts || 20
        });
    }
    async createWithEmail(email, config = {}) {
        return this.create({
            ...config,
            customData: {
                ...config.customData,
                email,
                username: email.split('@')[0]
            }
        });
    }
    async createWithTelegram(config = {}) {
        return this.create({
            ...config,
            telegramId: faker_1.faker.string.numeric(10),
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
    async createCampaigns(userId, count) {
        const campaigns = [];
        for (let i = 0; i < count; i++) {
            const campaign = await this.prisma.campaign.create({
                data: {
                    id: faker_1.faker.string.uuid(),
                    name: faker_1.faker.company.catchPhrase(),
                    description: faker_1.faker.lorem.paragraph(),
                    userId,
                    status: faker_1.faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
                    settings: {
                        targetAudience: faker_1.faker.helpers.arrayElements(['18-25', '26-35', '36-45', '46-55'], 2),
                        platforms: faker_1.faker.helpers.arrayElements(['twitter', 'facebook', 'instagram', 'linkedin'], 2),
                        budget: faker_1.faker.number.int({ min: 100, max: 10000 }),
                        duration: faker_1.faker.number.int({ min: 7, max: 90 })
                    },
                    metrics: {
                        impressions: faker_1.faker.number.int({ min: 0, max: 100000 }),
                        clicks: faker_1.faker.number.int({ min: 0, max: 10000 }),
                        conversions: faker_1.faker.number.int({ min: 0, max: 1000 }),
                        spend: faker_1.faker.number.float({ min: 0, max: 5000, fractionDigits: 2 })
                    },
                    createdAt: faker_1.faker.date.past({ years: 1 }),
                    updatedAt: new Date()
                }
            });
            campaigns.push(campaign);
        }
        return campaigns;
    }
    async createPosts(userId, count) {
        const posts = [];
        for (let i = 0; i < count; i++) {
            const post = await this.prisma.post.create({
                data: {
                    id: faker_1.faker.string.uuid(),
                    content: faker_1.faker.lorem.paragraphs(2),
                    platform: faker_1.faker.helpers.arrayElement(['twitter', 'facebook', 'instagram', 'linkedin']),
                    status: faker_1.faker.helpers.arrayElement(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']),
                    scheduledFor: faker_1.faker.date.future(),
                    userId,
                    metadata: {
                        hashtags: faker_1.faker.helpers.arrayElements(['#marketing', '#social', '#business', '#growth'], 2),
                        mentions: [],
                        mediaUrls: faker_1.faker.datatype.boolean() ? [faker_1.faker.image.url()] : []
                    },
                    metrics: {
                        likes: faker_1.faker.number.int({ min: 0, max: 1000 }),
                        shares: faker_1.faker.number.int({ min: 0, max: 100 }),
                        comments: faker_1.faker.number.int({ min: 0, max: 50 }),
                        reach: faker_1.faker.number.int({ min: 0, max: 10000 })
                    },
                    createdAt: faker_1.faker.date.past({ months: 6 }),
                    updatedAt: new Date()
                }
            });
            posts.push(post);
        }
        return posts;
    }
    async createAnalytics(userId) {
        const analytics = [];
        const days = 30;
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const analytic = await this.prisma.analytics.create({
                data: {
                    id: faker_1.faker.string.uuid(),
                    userId,
                    eventType: faker_1.faker.helpers.arrayElement(['page_view', 'click', 'conversion', 'signup']),
                    eventData: {
                        page: faker_1.faker.internet.url(),
                        source: faker_1.faker.helpers.arrayElement(['organic', 'paid', 'social', 'email']),
                        medium: faker_1.faker.helpers.arrayElement(['cpc', 'organic', 'social', 'email']),
                        campaign: faker_1.faker.company.catchPhrase()
                    },
                    metadata: {
                        userAgent: faker_1.faker.internet.userAgent(),
                        ipAddress: faker_1.faker.internet.ip(),
                        country: faker_1.faker.location.country(),
                        city: faker_1.faker.location.city()
                    },
                    createdAt: date
                }
            });
            analytics.push(analytic);
        }
        return analytics;
    }
    getGeneratedUser(id) {
        return this.generatedUsers.get(id);
    }
    getAllGeneratedUsers() {
        return Array.from(this.generatedUsers.values());
    }
    clearCache() {
        this.generatedUsers.clear();
    }
    async cleanup() {
        const userIds = Array.from(this.generatedUsers.keys());
        if (userIds.length > 0) {
            await this.prisma.analytics.deleteMany({
                where: { userId: { in: userIds } }
            });
            await this.prisma.post.deleteMany({
                where: { userId: { in: userIds } }
            });
            await this.prisma.campaign.deleteMany({
                where: { userId: { in: userIds } }
            });
            await this.prisma.user.deleteMany({
                where: { id: { in: userIds } }
            });
        }
        this.clearCache();
    }
}
exports.UserFactory = UserFactory;
const getUserFactory = (prisma) => {
    return UserFactory.getInstance(prisma);
};
exports.getUserFactory = getUserFactory;
//# sourceMappingURL=userFactory.js.map