import { PrismaClient, User, UserRole } from '@prisma/client';
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
export interface GeneratedUser extends User {
    plainPassword?: string;
    campaigns?: any[];
    posts?: any[];
    analytics?: any[];
}
export declare class UserFactory {
    private static instance;
    private prisma;
    private generatedUsers;
    constructor(prisma: PrismaClient);
    static getInstance(prisma: PrismaClient): UserFactory;
    generate(config?: UserFactoryConfig): Partial<User> & {
        plainPassword: string;
    };
    create(config?: UserFactoryConfig): Promise<GeneratedUser>;
    createMany(count: number, config?: UserFactoryConfig): Promise<GeneratedUser[]>;
    createAdmin(config?: Omit<UserFactoryConfig, 'role'>): Promise<GeneratedUser>;
    createPremium(config?: Omit<UserFactoryConfig, 'role'>): Promise<GeneratedUser>;
    createWithEmail(email: string, config?: UserFactoryConfig): Promise<GeneratedUser>;
    createWithTelegram(config?: UserFactoryConfig): Promise<GeneratedUser>;
    private createCampaigns;
    private createPosts;
    private createAnalytics;
    getGeneratedUser(id: string): GeneratedUser | undefined;
    getAllGeneratedUsers(): GeneratedUser[];
    clearCache(): void;
    cleanup(): Promise<void>;
}
export declare const getUserFactory: (prisma: PrismaClient) => UserFactory;
//# sourceMappingURL=userFactory.d.ts.map