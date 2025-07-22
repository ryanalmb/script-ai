declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidApiResponse(): R;
            toHaveCorrelationId(): R;
            toHaveValidErrorFormat(): R;
            toHaveValidSuccessFormat(): R;
            toHaveValidPagination(): R;
            toRespondWithin(milliseconds: number): R;
            toHaveMemoryUsageBelow(megabytes: number): R;
            toHaveCpuUsageBelow(percentage: number): R;
            toExistInDatabase(table: string, conditions: Record<string, any>): R;
            toNotExistInDatabase(table: string, conditions: Record<string, any>): R;
            toHaveValidDatabaseSchema(): R;
            toBeSecureEndpoint(): R;
            toHaveValidJWT(): R;
            toHaveSecureHeaders(): R;
            toPreventSQLInjection(): R;
            toHaveValidErrorStructure(): R;
            toHaveRetryableError(): R;
            toHaveNonRetryableError(): R;
            toHaveCircuitBreakerTripped(): R;
            toBeCached(): R;
            toHaveCacheHit(): R;
            toHaveCacheMiss(): R;
            toHaveValidCacheKey(): R;
            toHaveValidTraceId(): R;
            toHaveValidSpanId(): R;
            toHaveValidMetrics(): R;
            toHaveValidTelemetryData(): R;
        }
    }
}
export {};
//# sourceMappingURL=customMatchers.d.ts.map