import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import Redis from 'ioredis';
export interface TestUtilsConfig {
    prisma: PrismaClient;
    app?: Express;
    redis?: Redis;
}
export interface ApiTestResponse {
    status: number;
    body: any;
    headers: any;
    correlationId?: string;
    traceId?: string;
    responseTime: number;
}
export interface PerformanceTestResult {
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage: NodeJS.MemoryUsage;
}
export declare class TestUtils {
    private prisma;
    private app?;
    private redis?;
    private createdRecords;
    constructor(config: TestUtilsConfig);
    cleanDatabase(): Promise<void>;
    resetDatabase(): Promise<void>;
    seedTestData(): Promise<void>;
    trackCreatedRecord(table: string, id: string): void;
    cleanupCreatedRecords(): Promise<void>;
    makeRequest(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, options?: {
        body?: any;
        headers?: Record<string, string>;
        query?: Record<string, string>;
        auth?: string;
        expectStatus?: number;
    }): Promise<ApiTestResponse>;
    authenticateUser(userId: string): Promise<string>;
    authenticateAdmin(): Promise<string>;
    performanceTest(testFunction: () => Promise<any>, options?: {
        iterations?: number;
        concurrency?: number;
        warmupIterations?: number;
    }): Promise<PerformanceTestResult>;
    mockExternalService(serviceName: string, responses: Record<string, any>): void;
    restoreExternalServices(): void;
    simulateNetworkError(): void;
    simulateTimeoutError(delay?: number): void;
    simulateDatabaseError(): void;
    restoreDatabase(): void;
    clearCache(): Promise<void>;
    setCacheValue(key: string, value: any, ttl?: number): Promise<void>;
    getCacheValue(key: string): Promise<any>;
    generateSQLInjectionPayloads(): string[];
    generateXSSPayloads(): string[];
    generateCSRFToken(): string;
    generateRandomData(type: 'email' | 'username' | 'password' | 'phone' | 'url'): string;
    generateLargePayload(sizeInMB: number): string;
    cleanup(): Promise<void>;
}
export declare const createTestUtils: (config: TestUtilsConfig) => TestUtils;
export declare const waitFor: (ms: number) => Promise<void>;
export declare const retry: <T>(fn: () => Promise<T>, maxAttempts?: number, delay?: number) => Promise<T>;
//# sourceMappingURL=testUtils.d.ts.map