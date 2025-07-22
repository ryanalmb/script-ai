"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
globals_1.expect.extend({
    toBeValidApiResponse(received) {
        const pass = received &&
            typeof received === 'object' &&
            typeof received.success === 'boolean' &&
            (received.success ? 'data' in received : 'error' in received);
        return {
            message: () => pass
                ? `Expected ${JSON.stringify(received)} not to be a valid API response`
                : `Expected ${JSON.stringify(received)} to be a valid API response with success boolean and data/error`,
            pass
        };
    },
    toHaveCorrelationId(received) {
        const correlationId = received?.error?.correlationId ||
            received?.metadata?.correlationId ||
            received?.correlationId;
        const pass = correlationId &&
            typeof correlationId === 'string' &&
            correlationId.length > 0;
        return {
            message: () => pass
                ? `Expected response not to have correlation ID`
                : `Expected response to have a valid correlation ID, got: ${correlationId}`,
            pass
        };
    },
    toHaveValidErrorFormat(received) {
        const error = received?.error;
        const pass = error &&
            typeof error.id === 'string' &&
            typeof error.correlationId === 'string' &&
            typeof error.type === 'string' &&
            typeof error.code === 'string' &&
            typeof error.message === 'string' &&
            typeof error.retryable === 'boolean' &&
            typeof error.timestamp === 'string';
        return {
            message: () => pass
                ? `Expected error not to have valid format`
                : `Expected error to have valid enterprise format with id, correlationId, type, code, message, retryable, timestamp`,
            pass
        };
    },
    toHaveValidSuccessFormat(received) {
        const pass = received &&
            received.success === true &&
            'data' in received &&
            received.metadata &&
            typeof received.metadata.timestamp === 'string';
        return {
            message: () => pass
                ? `Expected success response not to have valid format`
                : `Expected success response to have valid format with success: true, data, and metadata`,
            pass
        };
    },
    toHaveValidPagination(received) {
        const pagination = received?.metadata?.pagination;
        const pass = pagination &&
            typeof pagination.page === 'number' &&
            typeof pagination.limit === 'number' &&
            typeof pagination.total === 'number' &&
            typeof pagination.hasNext === 'boolean' &&
            typeof pagination.hasPrev === 'boolean';
        return {
            message: () => pass
                ? `Expected response not to have valid pagination`
                : `Expected response to have valid pagination metadata`,
            pass
        };
    }
});
globals_1.expect.extend({
    toRespondWithin(received, milliseconds) {
        const startTime = Date.now();
        return received.then(() => {
            const responseTime = Date.now() - startTime;
            const pass = responseTime <= milliseconds;
            return {
                message: () => pass
                    ? `Expected response time ${responseTime}ms to be greater than ${milliseconds}ms`
                    : `Expected response time ${responseTime}ms to be within ${milliseconds}ms`,
                pass
            };
        }, (error) => {
            const responseTime = Date.now() - startTime;
            return {
                message: () => `Request failed after ${responseTime}ms: ${error.message}`,
                pass: false
            };
        });
    },
    toHaveMemoryUsageBelow(received, megabytes) {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const pass = heapUsedMB < megabytes;
        return {
            message: () => pass
                ? `Expected memory usage ${heapUsedMB}MB to be above ${megabytes}MB`
                : `Expected memory usage ${heapUsedMB}MB to be below ${megabytes}MB`,
            pass
        };
    }
});
globals_1.expect.extend({
    async toExistInDatabase(received, table, conditions) {
        const { TEST_STATE } = global;
        if (!TEST_STATE?.prisma) {
            return {
                message: () => 'Database connection not available in test environment',
                pass: false
            };
        }
        try {
            const result = await TEST_STATE.prisma[table].findFirst({
                where: conditions
            });
            const pass = result !== null;
            return {
                message: () => pass
                    ? `Expected record not to exist in ${table} with conditions ${JSON.stringify(conditions)}`
                    : `Expected record to exist in ${table} with conditions ${JSON.stringify(conditions)}`,
                pass
            };
        }
        catch (error) {
            return {
                message: () => `Database query failed: ${error.message}`,
                pass: false
            };
        }
    },
    async toNotExistInDatabase(received, table, conditions) {
        const { TEST_STATE } = global;
        if (!TEST_STATE?.prisma) {
            return {
                message: () => 'Database connection not available in test environment',
                pass: false
            };
        }
        try {
            const result = await TEST_STATE.prisma[table].findFirst({
                where: conditions
            });
            const pass = result === null;
            return {
                message: () => pass
                    ? `Expected record to exist in ${table} with conditions ${JSON.stringify(conditions)}`
                    : `Expected record not to exist in ${table} with conditions ${JSON.stringify(conditions)}`,
                pass
            };
        }
        catch (error) {
            return {
                message: () => `Database query failed: ${error.message}`,
                pass: false
            };
        }
    }
});
globals_1.expect.extend({
    toHaveSecureHeaders(received) {
        const headers = received?.headers || {};
        const requiredHeaders = [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection',
            'strict-transport-security'
        ];
        const missingHeaders = requiredHeaders.filter(header => !headers[header]);
        const pass = missingHeaders.length === 0;
        return {
            message: () => pass
                ? `Expected response not to have secure headers`
                : `Expected response to have secure headers. Missing: ${missingHeaders.join(', ')}`,
            pass
        };
    },
    toHaveValidJWT(received) {
        const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
        const pass = typeof received === 'string' && jwtRegex.test(received);
        return {
            message: () => pass
                ? `Expected ${received} not to be a valid JWT`
                : `Expected ${received} to be a valid JWT format`,
            pass
        };
    }
});
globals_1.expect.extend({
    toHaveValidErrorStructure(received) {
        const error = received?.error || received;
        const pass = error &&
            typeof error.id === 'string' &&
            typeof error.type === 'string' &&
            typeof error.message === 'string' &&
            typeof error.retryable === 'boolean';
        return {
            message: () => pass
                ? `Expected error not to have valid structure`
                : `Expected error to have valid structure with id, type, message, retryable`,
            pass
        };
    },
    toHaveRetryableError(received) {
        const error = received?.error || received;
        const pass = error && error.retryable === true;
        return {
            message: () => pass
                ? `Expected error not to be retryable`
                : `Expected error to be retryable`,
            pass
        };
    },
    toHaveNonRetryableError(received) {
        const error = received?.error || received;
        const pass = error && error.retryable === false;
        return {
            message: () => pass
                ? `Expected error to be retryable`
                : `Expected error not to be retryable`,
            pass
        };
    }
});
globals_1.expect.extend({
    toBeCached(received) {
        const cacheHeaders = received?.headers;
        const pass = cacheHeaders &&
            (cacheHeaders['cache-control'] ||
                cacheHeaders['etag'] ||
                cacheHeaders['last-modified']);
        return {
            message: () => pass
                ? `Expected response not to be cached`
                : `Expected response to have cache headers`,
            pass
        };
    }
});
globals_1.expect.extend({
    toHaveValidTraceId(received) {
        const traceId = received?.traceId ||
            received?.error?.traceId ||
            received?.metadata?.traceId;
        const pass = traceId &&
            typeof traceId === 'string' &&
            traceId.length === 32;
        return {
            message: () => pass
                ? `Expected response not to have valid trace ID`
                : `Expected response to have valid trace ID (32 characters), got: ${traceId}`,
            pass
        };
    },
    toHaveValidMetrics(received) {
        const pass = received &&
            typeof received === 'object' &&
            Object.keys(received).length > 0;
        return {
            message: () => pass
                ? `Expected metrics not to be valid`
                : `Expected valid metrics object`,
            pass
        };
    }
});
console.log('✅ Custom Jest matchers loaded');
//# sourceMappingURL=customMatchers.js.map