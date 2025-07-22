"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const correlationManager_1 = require("../../../src/services/correlationManager");
describe('Correlation Manager', () => {
    beforeEach(() => {
        correlationManager_1.correlationManager.clearContext?.();
    });
    afterEach(() => {
        correlationManager_1.CorrelationManager.resetInstance();
    });
    describe('Context Management', () => {
        it('should create correlation context with required fields', () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test-service',
                operation: 'test-operation'
            });
            expect(context).toMatchObject({
                service: 'test-service',
                operation: 'test-operation'
            });
            expect(context.correlationId).toBeDefined();
            expect(context.requestId).toBeDefined();
            expect(context.startTime).toBeGreaterThan(0);
            expect(typeof context.correlationId).toBe('string');
            expect(context.correlationId.length).toBeGreaterThan(0);
        });
        it('should generate unique correlation IDs', () => {
            const context1 = correlationManager_1.correlationManager.createContext({ service: 'test' });
            const context2 = correlationManager_1.correlationManager.createContext({ service: 'test' });
            expect(context1.correlationId).not.toBe(context2.correlationId);
            expect(context1.requestId).not.toBe(context2.requestId);
        });
        it('should set and get current context', () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test-service',
                userId: 'test-user',
                sessionId: 'test-session'
            });
            correlationManager_1.correlationManager.setContext(context);
            const retrievedContext = correlationManager_1.correlationManager.getContext();
            expect(retrievedContext).toEqual(context);
            expect(retrievedContext?.correlationId).toBe(context.correlationId);
            expect(retrievedContext?.userId).toBe('test-user');
            expect(retrievedContext?.sessionId).toBe('test-session');
        });
        it('should return undefined when no context is set', () => {
            const context = correlationManager_1.correlationManager.getContext();
            expect(context).toBeUndefined();
        });
        it('should get correlation ID from current context', () => {
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            correlationManager_1.correlationManager.setContext(context);
            const correlationId = correlationManager_1.correlationManager.getCorrelationId();
            expect(correlationId).toBe(context.correlationId);
        });
        it('should get trace ID from current context', () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test',
                traceId: 'test-trace-id'
            });
            correlationManager_1.correlationManager.setContext(context);
            const traceId = correlationManager_1.correlationManager.getTraceId();
            expect(traceId).toBe('test-trace-id');
        });
        it('should get user ID from current context', () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test',
                userId: 'test-user-id'
            });
            correlationManager_1.correlationManager.setContext(context);
            const userId = correlationManager_1.correlationManager.getUserId();
            expect(userId).toBe('test-user-id');
        });
    });
    describe('Context Updates', () => {
        it('should update context metadata', () => {
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            correlationManager_1.correlationManager.setContext(context);
            correlationManager_1.correlationManager.updateContext({
                operation: 'updated-operation',
                metadata: { key: 'value' }
            });
            const updatedContext = correlationManager_1.correlationManager.getContext();
            expect(updatedContext?.operation).toBe('updated-operation');
            expect(updatedContext?.metadata).toEqual({ key: 'value' });
        });
        it('should add metadata to current context', () => {
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            correlationManager_1.correlationManager.setContext(context);
            correlationManager_1.correlationManager.addMetadata('testKey', 'testValue');
            correlationManager_1.correlationManager.addMetadata('anotherKey', { nested: 'object' });
            const updatedContext = correlationManager_1.correlationManager.getContext();
            expect(updatedContext?.metadata).toEqual({
                testKey: 'testValue',
                anotherKey: { nested: 'object' }
            });
        });
        it('should add tags to current context', () => {
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            correlationManager_1.correlationManager.setContext(context);
            correlationManager_1.correlationManager.addTags('tag1', 'tag2', 'tag3');
            const updatedContext = correlationManager_1.correlationManager.getContext();
            expect(updatedContext?.tags).toEqual(['tag1', 'tag2', 'tag3']);
        });
        it('should append tags to existing tags', () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test',
                tags: ['existing-tag']
            });
            correlationManager_1.correlationManager.setContext(context);
            correlationManager_1.correlationManager.addTags('new-tag1', 'new-tag2');
            const updatedContext = correlationManager_1.correlationManager.getContext();
            expect(updatedContext?.tags).toEqual(['existing-tag', 'new-tag1', 'new-tag2']);
        });
    });
    describe('Child Context Creation', () => {
        it('should create child context with inherited properties', () => {
            const parentContext = correlationManager_1.correlationManager.createContext({
                service: 'parent-service',
                userId: 'test-user',
                sessionId: 'test-session',
                metadata: { parentKey: 'parentValue' },
                tags: ['parent-tag']
            });
            correlationManager_1.correlationManager.setContext(parentContext);
            const childContext = correlationManager_1.correlationManager.createChildContext('child-operation', { childKey: 'childValue' });
            expect(childContext.correlationId).toBe(parentContext.correlationId);
            expect(childContext.parentSpanId).toBe(parentContext.spanId);
            expect(childContext.userId).toBe('test-user');
            expect(childContext.sessionId).toBe('test-session');
            expect(childContext.service).toBe('parent-service');
            expect(childContext.operation).toBe('child-operation');
            expect(childContext.metadata).toEqual({
                parentKey: 'parentValue',
                childKey: 'childValue',
                parentOperation: parentContext.operation
            });
            expect(childContext.tags).toEqual(['parent-tag']);
        });
        it('should throw error when creating child context without parent', () => {
            expect(() => {
                correlationManager_1.correlationManager.createChildContext('child-operation');
            }).toThrow('No parent context available for child context creation');
        });
    });
    describe('Context Execution', () => {
        it('should run function with correlation context', async () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test-service',
                userId: 'test-user'
            });
            const result = await correlationManager_1.correlationManager.runWithContext(context, async () => {
                const currentContext = correlationManager_1.correlationManager.getContext();
                expect(currentContext?.correlationId).toBe(context.correlationId);
                expect(currentContext?.userId).toBe('test-user');
                return 'test-result';
            });
            expect(result).toBe('test-result');
        });
        it('should run function with new correlation context', async () => {
            const result = await correlationManager_1.correlationManager.runWithNewContext({ service: 'test-service', operation: 'test-op' }, async () => {
                const context = correlationManager_1.correlationManager.getContext();
                expect(context?.service).toBe('test-service');
                expect(context?.operation).toBe('test-op');
                expect(context?.correlationId).toBeDefined();
                return 'new-context-result';
            });
            expect(result).toBe('new-context-result');
        });
        it('should handle errors in context execution', async () => {
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            await expect(correlationManager_1.correlationManager.runWithContext(context, async () => {
                throw new Error('Test error');
            })).rejects.toThrow('Test error');
        });
    });
    describe('Context Management', () => {
        it('should track active contexts', () => {
            const context1 = correlationManager_1.correlationManager.createContext({ service: 'service1' });
            const context2 = correlationManager_1.correlationManager.createContext({ service: 'service2' });
            const activeContexts = correlationManager_1.correlationManager.getActiveContexts();
            expect(activeContexts).toHaveLength(2);
            expect(activeContexts.map(c => c.correlationId)).toContain(context1.correlationId);
            expect(activeContexts.map(c => c.correlationId)).toContain(context2.correlationId);
        });
        it('should get context by correlation ID', () => {
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            const retrievedContext = correlationManager_1.correlationManager.getContextById(context.correlationId);
            expect(retrievedContext).toEqual(context);
        });
        it('should destroy context by correlation ID', () => {
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            correlationManager_1.correlationManager.destroyContext(context.correlationId);
            const retrievedContext = correlationManager_1.correlationManager.getContextById(context.correlationId);
            expect(retrievedContext).toBeUndefined();
        });
        it('should get context metrics', () => {
            correlationManager_1.correlationManager.createContext({ service: 'test1' });
            correlationManager_1.correlationManager.createContext({ service: 'test2' });
            const metrics = correlationManager_1.correlationManager.getMetrics();
            expect(metrics.created).toBeGreaterThanOrEqual(2);
            expect(metrics.active).toBeGreaterThanOrEqual(2);
            expect(metrics.maxActive).toBeGreaterThanOrEqual(2);
        });
    });
    describe('Express Middleware', () => {
        it('should create Express middleware function', () => {
            const middleware = correlationManager_1.correlationManager.createExpressMiddleware();
            expect(typeof middleware).toBe('function');
            expect(middleware.length).toBe(3);
        });
        it('should extract correlation ID from headers', () => {
            const middleware = correlationManager_1.correlationManager.createExpressMiddleware();
            const req = {
                headers: { 'x-correlation-id': 'existing-correlation-id' },
                method: 'GET',
                path: '/test',
                ip: '127.0.0.1',
                connection: { remoteAddress: '127.0.0.1' },
                query: {},
                params: {}
            };
            const res = {
                setHeader: jest.fn(),
                on: jest.fn()
            };
            const next = jest.fn();
            middleware(req, res, next);
            expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'existing-correlation-id');
            expect(next).toHaveBeenCalled();
        });
        it('should generate new correlation ID when not provided', () => {
            const middleware = correlationManager_1.correlationManager.createExpressMiddleware();
            const req = {
                headers: {},
                method: 'POST',
                path: '/api/test',
                ip: '127.0.0.1',
                connection: { remoteAddress: '127.0.0.1' },
                query: { param: 'value' },
                params: { id: '123' },
                body: { data: 'test' }
            };
            const res = {
                setHeader: jest.fn(),
                on: jest.fn()
            };
            const next = jest.fn();
            middleware(req, res, next);
            expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', expect.stringMatching(/^.+_.+_.+$/));
            expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.stringMatching(/^req_.+_.+$/));
            expect(next).toHaveBeenCalled();
        });
    });
    describe('Outgoing Headers', () => {
        it('should create outgoing headers with correlation context', () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test-service',
                userId: 'test-user',
                sessionId: 'test-session',
                traceId: 'test-trace-id',
                spanId: 'test-span-id'
            });
            correlationManager_1.correlationManager.setContext(context);
            const headers = correlationManager_1.correlationManager.createOutgoingHeaders();
            expect(headers).toEqual({
                'X-Correlation-ID': context.correlationId,
                'X-Trace-ID': 'test-trace-id',
                'X-Span-ID': 'test-span-id',
                'X-User-ID': 'test-user',
                'X-Session-ID': 'test-session',
                'X-Source-Service': 'test-service'
            });
        });
        it('should create outgoing headers with additional headers', () => {
            const context = correlationManager_1.correlationManager.createContext({
                service: 'test-service'
            });
            correlationManager_1.correlationManager.setContext(context);
            const headers = correlationManager_1.correlationManager.createOutgoingHeaders({
                'Custom-Header': 'custom-value',
                'Another-Header': 'another-value'
            });
            expect(headers).toMatchObject({
                'X-Correlation-ID': context.correlationId,
                'X-Source-Service': 'test-service',
                'Custom-Header': 'custom-value',
                'Another-Header': 'another-value'
            });
        });
        it('should create minimal headers when no context is available', () => {
            const headers = correlationManager_1.correlationManager.createOutgoingHeaders({
                'Custom-Header': 'custom-value'
            });
            expect(headers).toEqual({
                'Custom-Header': 'custom-value'
            });
        });
    });
    describe('Performance and Memory', () => {
        it('should handle large number of contexts efficiently', () => {
            const startTime = Date.now();
            const contexts = [];
            for (let i = 0; i < 1000; i++) {
                const context = correlationManager_1.correlationManager.createContext({
                    service: `service-${i}`,
                    operation: `operation-${i}`
                });
                contexts.push(context);
            }
            const creationTime = Date.now() - startTime;
            expect(creationTime).toBeLessThan(1000);
            const activeContexts = correlationManager_1.correlationManager.getActiveContexts();
            expect(activeContexts.length).toBe(1000);
            contexts.forEach(context => {
                correlationManager_1.correlationManager.destroyContext(context.correlationId);
            });
            const finalActiveContexts = correlationManager_1.correlationManager.getActiveContexts();
            expect(finalActiveContexts.length).toBe(0);
        });
        it('should update metrics correctly during context lifecycle', () => {
            const initialMetrics = correlationManager_1.correlationManager.getMetrics();
            const context = correlationManager_1.correlationManager.createContext({ service: 'test' });
            const afterCreateMetrics = correlationManager_1.correlationManager.getMetrics();
            expect(afterCreateMetrics.created).toBe(initialMetrics.created + 1);
            expect(afterCreateMetrics.active).toBe(initialMetrics.active + 1);
            correlationManager_1.correlationManager.destroyContext(context.correlationId);
            const afterDestroyMetrics = correlationManager_1.correlationManager.getMetrics();
            expect(afterDestroyMetrics.destroyed).toBe(initialMetrics.destroyed + 1);
            expect(afterDestroyMetrics.active).toBe(initialMetrics.active);
        });
    });
});
//# sourceMappingURL=correlationManager.test.js.map