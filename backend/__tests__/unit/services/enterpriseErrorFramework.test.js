"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enterpriseErrorFramework_1 = require("../../../src/errors/enterpriseErrorFramework");
const correlationManager_1 = require("../../../src/services/correlationManager");
describe('Enterprise Error Framework', () => {
    beforeEach(() => {
        enterpriseErrorFramework_1.ErrorFactory.clearContext();
    });
    afterEach(() => {
        correlationManager_1.CorrelationManager.resetInstance();
    });
    describe('EnterpriseErrorClass', () => {
        it('should create error with all required properties', () => {
            const error = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Test validation error',
                operation: 'test_operation'
            });
            expect(error).toHaveValidErrorStructure();
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR);
            expect(error.message).toBe('Test validation error');
            expect(error.operation).toBe('test_operation');
            expect(error.category).toBe(enterpriseErrorFramework_1.ErrorCategory.BUSINESS);
            expect(error.severity).toBe(enterpriseErrorFramework_1.ErrorSeverity.LOW);
            expect(error.retryable).toBe(false);
            expect(error.id).toBeDefined();
            expect(error.correlationId).toBeDefined();
            expect(error.timestamp).toBeInstanceOf(Date);
        });
        it('should infer correct category from error type', () => {
            const networkError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR,
                message: 'Network error'
            });
            expect(networkError.category).toBe(enterpriseErrorFramework_1.ErrorCategory.TRANSIENT);
            const authError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.AUTHENTICATION_ERROR,
                message: 'Auth error'
            });
            expect(authError.category).toBe(enterpriseErrorFramework_1.ErrorCategory.SECURITY);
            const systemError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.SYSTEM_ERROR,
                message: 'System error'
            });
            expect(systemError.category).toBe(enterpriseErrorFramework_1.ErrorCategory.INFRASTRUCTURE);
        });
        it('should infer correct severity from error type', () => {
            const validationError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Validation error'
            });
            expect(validationError.severity).toBe(enterpriseErrorFramework_1.ErrorSeverity.LOW);
            const authError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.AUTHENTICATION_ERROR,
                message: 'Auth error'
            });
            expect(authError.severity).toBe(enterpriseErrorFramework_1.ErrorSeverity.HIGH);
            const systemError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.SYSTEM_ERROR,
                message: 'System error'
            });
            expect(systemError.severity).toBe(enterpriseErrorFramework_1.ErrorSeverity.CRITICAL);
        });
        it('should infer correct recovery strategy from error type', () => {
            const networkError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR,
                message: 'Network error'
            });
            expect(networkError.recoveryStrategy).toBe(enterpriseErrorFramework_1.RecoveryStrategy.RETRY);
            const validationError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Validation error'
            });
            expect(validationError.recoveryStrategy).toBe(enterpriseErrorFramework_1.RecoveryStrategy.IGNORE);
            const externalApiError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.EXTERNAL_API_ERROR,
                message: 'External API error'
            });
            expect(externalApiError.recoveryStrategy).toBe(enterpriseErrorFramework_1.RecoveryStrategy.CIRCUIT_BREAKER);
        });
        it('should generate correct error codes', () => {
            const validationError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Validation error'
            });
            expect(validationError.code).toBe('VAL_001');
            const networkError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR,
                message: 'Network error'
            });
            expect(networkError.code).toBe('NET_001');
            const notFoundError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.RESOURCE_NOT_FOUND,
                message: 'Not found error'
            });
            expect(notFoundError.code).toBe('RES_404');
        });
        it('should serialize to JSON correctly', () => {
            const error = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Test error',
                operation: 'test_operation',
                details: { field: 'email', value: 'invalid' }
            });
            const json = error.toJSON();
            expect(json).toMatchObject({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Test error',
                operation: 'test_operation',
                details: { field: 'email', value: 'invalid' },
                category: enterpriseErrorFramework_1.ErrorCategory.BUSINESS,
                severity: enterpriseErrorFramework_1.ErrorSeverity.LOW,
                retryable: false
            });
            expect(json.id).toBeDefined();
            expect(json.correlationId).toBeDefined();
            expect(json.timestamp).toBeDefined();
        });
        it('should create HTTP response format correctly', () => {
            const error = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Test error',
                retryAfter: 30
            });
            const httpResponse = error.toHttpResponse();
            expect(httpResponse).toBeValidApiResponse();
            expect(httpResponse.success).toBe(false);
            expect(httpResponse.error).toMatchObject({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Test error',
                retryable: false,
                retryAfter: 30
            });
        });
        it('should mark error as resolved', () => {
            const error = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Test error'
            });
            expect(error.resolved).toBe(false);
            expect(error.resolvedAt).toBeUndefined();
            expect(error.resolution).toBeUndefined();
            error.resolve('Fixed validation logic');
            expect(error.resolved).toBe(true);
            expect(error.resolvedAt).toBeInstanceOf(Date);
            expect(error.resolution).toBe('Fixed validation logic');
        });
        it('should create child error with inherited context', () => {
            const parentError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.SYSTEM_ERROR,
                message: 'Parent error',
                correlationId: 'test-correlation-id',
                userId: 'test-user-id',
                service: 'test-service'
            });
            const childError = parentError.createChild({
                type: enterpriseErrorFramework_1.ErrorType.DATABASE_ERROR,
                message: 'Child error',
                operation: 'database_query'
            });
            expect(childError.correlationId).toBe('test-correlation-id');
            expect(childError.userId).toBe('test-user-id');
            expect(childError.service).toBe('test-service');
            expect(childError.parentSpanId).toBe(parentError.spanId);
            expect(childError.type).toBe(enterpriseErrorFramework_1.ErrorType.DATABASE_ERROR);
            expect(childError.message).toBe('Child error');
        });
    });
    describe('ErrorFactory', () => {
        it('should set and use context for error creation', () => {
            enterpriseErrorFramework_1.ErrorFactory.setContext({
                correlationId: 'test-correlation',
                userId: 'test-user',
                service: 'test-service'
            });
            const error = enterpriseErrorFramework_1.ErrorFactory.createValidationError('Test error');
            expect(error.correlationId).toBe('test-correlation');
            expect(error.userId).toBe('test-user');
            expect(error.service).toBe('test-service');
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR);
        });
        it('should create system error correctly', () => {
            const error = enterpriseErrorFramework_1.ErrorFactory.createSystemError('System failure', { component: 'auth' });
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.SYSTEM_ERROR);
            expect(error.message).toBe('System failure');
            expect(error.details).toEqual({ component: 'auth' });
            expect(error.severity).toBe(enterpriseErrorFramework_1.ErrorSeverity.CRITICAL);
        });
        it('should create database error correctly', () => {
            const error = enterpriseErrorFramework_1.ErrorFactory.createDatabaseError('Connection failed', { host: 'localhost' });
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.DATABASE_ERROR);
            expect(error.message).toBe('Connection failed');
            expect(error.details).toEqual({ host: 'localhost' });
            expect(error.retryable).toBe(true);
        });
        it('should create authentication error correctly', () => {
            const error = enterpriseErrorFramework_1.ErrorFactory.createAuthenticationError('Invalid credentials');
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.AUTHENTICATION_ERROR);
            expect(error.message).toBe('Invalid credentials');
            expect(error.severity).toBe(enterpriseErrorFramework_1.ErrorSeverity.HIGH);
            expect(error.retryable).toBe(false);
        });
        it('should create rate limit error with retry after', () => {
            const error = enterpriseErrorFramework_1.ErrorFactory.createRateLimitError('Rate limit exceeded', 60);
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.RATE_LIMIT_ERROR);
            expect(error.message).toBe('Rate limit exceeded');
            expect(error.retryAfter).toBe(60);
            expect(error.retryable).toBe(true);
        });
        it('should create not found error correctly', () => {
            const error = enterpriseErrorFramework_1.ErrorFactory.createNotFoundError('User', 'user-123');
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.RESOURCE_NOT_FOUND);
            expect(error.message).toBe('User with ID user-123 not found');
            expect(error.details).toEqual({ resource: 'User', id: 'user-123' });
        });
        it('should create timeout error correctly', () => {
            const error = enterpriseErrorFramework_1.ErrorFactory.createTimeoutError('api_call', 5000, { endpoint: '/users' });
            expect(error.type).toBe(enterpriseErrorFramework_1.ErrorType.TIMEOUT_ERROR);
            expect(error.message).toBe('Operation api_call timed out after 5000ms');
            expect(error.details).toEqual({ timeout: 5000, endpoint: '/users' });
            expect(error.retryable).toBe(true);
        });
        it('should wrap existing error correctly', () => {
            const originalError = new Error('Original error message');
            const wrappedError = enterpriseErrorFramework_1.ErrorFactory.wrapError(originalError, enterpriseErrorFramework_1.ErrorType.EXTERNAL_API_ERROR, 'api_call');
            expect(wrappedError.type).toBe(enterpriseErrorFramework_1.ErrorType.EXTERNAL_API_ERROR);
            expect(wrappedError.message).toBe('Original error message');
            expect(wrappedError.cause).toBe(originalError);
            expect(wrappedError.operation).toBe('api_call');
        });
        it('should clear context correctly', () => {
            enterpriseErrorFramework_1.ErrorFactory.setContext({
                correlationId: 'test-correlation',
                userId: 'test-user'
            });
            let error = enterpriseErrorFramework_1.ErrorFactory.createValidationError('Test error');
            expect(error.correlationId).toBe('test-correlation');
            enterpriseErrorFramework_1.ErrorFactory.clearContext();
            error = enterpriseErrorFramework_1.ErrorFactory.createValidationError('Test error 2');
            expect(error.correlationId).not.toBe('test-correlation');
        });
    });
    describe('ErrorUtils', () => {
        it('should identify retryable errors correctly', () => {
            const retryableError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR,
                message: 'Network error'
            });
            expect(enterpriseErrorFramework_1.ErrorUtils.isRetryable(retryableError)).toBe(true);
            const nonRetryableError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Validation error'
            });
            expect(enterpriseErrorFramework_1.ErrorUtils.isRetryable(nonRetryableError)).toBe(false);
            const timeoutError = new Error('Request timeout');
            expect(enterpriseErrorFramework_1.ErrorUtils.isRetryable(timeoutError)).toBe(true);
            const validationError = new Error('Invalid input');
            expect(enterpriseErrorFramework_1.ErrorUtils.isRetryable(validationError)).toBe(false);
        });
        it('should extract correlation ID correctly', () => {
            const error = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.SYSTEM_ERROR,
                message: 'Test error',
                correlationId: 'test-correlation-id'
            });
            expect(enterpriseErrorFramework_1.ErrorUtils.getCorrelationId(error)).toBe('test-correlation-id');
            const regularError = new Error('Regular error');
            expect(enterpriseErrorFramework_1.ErrorUtils.getCorrelationId(regularError)).toBeUndefined();
        });
        it('should check error type correctly', () => {
            const networkError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR,
                message: 'Network error'
            });
            expect(enterpriseErrorFramework_1.ErrorUtils.isErrorType(networkError, enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR)).toBe(true);
            expect(enterpriseErrorFramework_1.ErrorUtils.isErrorType(networkError, enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR)).toBe(false);
            const regularError = new Error('Regular error');
            expect(enterpriseErrorFramework_1.ErrorUtils.isErrorType(regularError, enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR)).toBe(false);
        });
        it('should get error severity correctly', () => {
            const criticalError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.SYSTEM_ERROR,
                message: 'System error'
            });
            expect(enterpriseErrorFramework_1.ErrorUtils.getSeverity(criticalError)).toBe(enterpriseErrorFramework_1.ErrorSeverity.CRITICAL);
            const regularError = new Error('Regular error');
            expect(enterpriseErrorFramework_1.ErrorUtils.getSeverity(regularError)).toBe(enterpriseErrorFramework_1.ErrorSeverity.MEDIUM);
        });
        it('should convert regular error to enterprise error', () => {
            const validationError = new Error('Invalid email format');
            const enterpriseError = enterpriseErrorFramework_1.ErrorUtils.toEnterpriseError(validationError, 'user_registration');
            expect(enterpriseError).toBeInstanceOf(enterpriseErrorFramework_1.EnterpriseErrorClass);
            expect(enterpriseError.type).toBe(enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR);
            expect(enterpriseError.message).toBe('Invalid email format');
            expect(enterpriseError.operation).toBe('user_registration');
            expect(enterpriseError.cause).toBe(validationError);
        });
        it('should infer error type from message patterns', () => {
            const testCases = [
                { message: 'Authentication failed', expectedType: enterpriseErrorFramework_1.ErrorType.AUTHENTICATION_ERROR },
                { message: 'Permission denied', expectedType: enterpriseErrorFramework_1.ErrorType.AUTHORIZATION_ERROR },
                { message: 'User not found', expectedType: enterpriseErrorFramework_1.ErrorType.RESOURCE_NOT_FOUND },
                { message: 'Request timeout occurred', expectedType: enterpriseErrorFramework_1.ErrorType.TIMEOUT_ERROR },
                { message: 'Network connection failed', expectedType: enterpriseErrorFramework_1.ErrorType.NETWORK_ERROR },
                { message: 'Database query failed', expectedType: enterpriseErrorFramework_1.ErrorType.DATABASE_ERROR },
                { message: 'Unknown error', expectedType: enterpriseErrorFramework_1.ErrorType.SYSTEM_ERROR }
            ];
            testCases.forEach(({ message, expectedType }) => {
                const error = new Error(message);
                const enterpriseError = enterpriseErrorFramework_1.ErrorUtils.toEnterpriseError(error);
                expect(enterpriseError.type).toBe(expectedType);
            });
        });
        it('should preserve enterprise error when converting', () => {
            const originalError = new enterpriseErrorFramework_1.EnterpriseErrorClass({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Original error',
                correlationId: 'test-correlation'
            });
            const convertedError = enterpriseErrorFramework_1.ErrorUtils.toEnterpriseError(originalError);
            expect(convertedError).toBe(originalError);
            expect(convertedError.correlationId).toBe('test-correlation');
        });
    });
    describe('Error Integration', () => {
        it('should maintain correlation across error hierarchy', () => {
            enterpriseErrorFramework_1.ErrorFactory.setContext({
                correlationId: 'test-correlation',
                userId: 'test-user',
                service: 'test-service'
            });
            const parentError = enterpriseErrorFramework_1.ErrorFactory.createSystemError('Parent error');
            const childError = parentError.createChild({
                type: enterpriseErrorFramework_1.ErrorType.DATABASE_ERROR,
                message: 'Child error'
            });
            const grandchildError = childError.createChild({
                type: enterpriseErrorFramework_1.ErrorType.VALIDATION_ERROR,
                message: 'Grandchild error'
            });
            expect(parentError.correlationId).toBe('test-correlation');
            expect(childError.correlationId).toBe('test-correlation');
            expect(grandchildError.correlationId).toBe('test-correlation');
            expect(childError.parentSpanId).toBe(parentError.spanId);
            expect(grandchildError.parentSpanId).toBe(childError.spanId);
        });
        it('should handle error resolution workflow', () => {
            const error = enterpriseErrorFramework_1.ErrorFactory.createSystemError('System error');
            expect(error.resolved).toBe(false);
            error.resolve('System restarted and issue resolved');
            expect(error.resolved).toBe(true);
            expect(error.resolvedAt).toBeInstanceOf(Date);
            expect(error.resolution).toBe('System restarted and issue resolved');
        });
        it('should generate unique fingerprints for similar errors', () => {
            const error1 = enterpriseErrorFramework_1.ErrorFactory.createValidationError('Email is required', { field: 'email' });
            const error2 = enterpriseErrorFramework_1.ErrorFactory.createValidationError('Email is required', { field: 'email' });
            const error3 = enterpriseErrorFramework_1.ErrorFactory.createValidationError('Password is required', { field: 'password' });
            expect(error1.fingerprint).toBe(error2.fingerprint);
            expect(error1.fingerprint).not.toBe(error3.fingerprint);
        });
    });
});
//# sourceMappingURL=enterpriseErrorFramework.test.js.map