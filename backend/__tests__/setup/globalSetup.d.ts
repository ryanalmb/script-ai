import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
export declare const TEST_CONFIG: {
    database: {
        url: string;
        resetBetweenTests: boolean;
        seedData: boolean;
    };
    redis: {
        host: string;
        port: number;
        db: number;
        keyPrefix: string;
        flushOnStart: boolean;
    };
    services: {
        backend: {
            port: number;
            host: string;
        };
        llm: {
            port: number;
            host: string;
            mockResponses: boolean;
        };
        telegram: {
            port: number;
            host: string;
            mockBot: boolean;
        };
    };
    timeouts: {
        default: number;
        integration: number;
        e2e: number;
        performance: number;
    };
    performance: {
        enableProfiling: boolean;
        memoryThreshold: number;
        responseTimeThreshold: number;
    };
};
export declare const TEST_STATE: {
    prisma: PrismaClient | null;
    redis: Redis | null;
    testStartTime: number;
    testData: Map<string, any>;
    cleanupTasks: Array<() => Promise<void>>;
};
export default function globalSetup(): Promise<void>;
export declare function cleanup(): Promise<void>;
//# sourceMappingURL=globalSetup.d.ts.map