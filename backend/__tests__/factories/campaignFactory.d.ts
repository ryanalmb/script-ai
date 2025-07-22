import { PrismaClient, Campaign, CampaignStatus } from '@prisma/client';
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
export interface GeneratedCampaign extends Campaign {
    posts?: any[];
    analytics?: any[];
    user?: any;
}
export declare class CampaignFactory {
    private static instance;
    private prisma;
    private generatedCampaigns;
    constructor(prisma: PrismaClient);
    static getInstance(prisma: PrismaClient): CampaignFactory;
    generate(config?: CampaignFactoryConfig): Partial<Campaign>;
    create(config?: CampaignFactoryConfig): Promise<GeneratedCampaign>;
    createMany(count: number, config?: CampaignFactoryConfig): Promise<GeneratedCampaign[]>;
    createActive(config?: Omit<CampaignFactoryConfig, 'status'>): Promise<GeneratedCampaign>;
    createDraft(config?: Omit<CampaignFactoryConfig, 'status'>): Promise<GeneratedCampaign>;
    createCompleted(config?: Omit<CampaignFactoryConfig, 'status'>): Promise<GeneratedCampaign>;
    private generateCampaignName;
    private generateCampaignDescription;
    private generateCampaignSettings;
    private generateCampaignMetrics;
    private createPosts;
    private createAnalytics;
    getGeneratedCampaign(id: string): GeneratedCampaign | undefined;
    getAllGeneratedCampaigns(): GeneratedCampaign[];
    clearCache(): void;
    cleanup(): Promise<void>;
}
export declare const getCampaignFactory: (prisma: PrismaClient) => CampaignFactory;
//# sourceMappingURL=campaignFactory.d.ts.map