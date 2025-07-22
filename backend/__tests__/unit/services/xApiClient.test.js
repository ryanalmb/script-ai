"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const xApiClient_1 = require("../../../src/services/xApiClient");
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    },
    logXApiCall: jest.fn()
}));
jest.mock('../../../src/config/redis', () => ({
    CacheService: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(true)
    }))
}));
jest.mock('../../../src/middleware/circuitBreaker', () => ({
    xApiCircuitBreaker: {
        execute: jest.fn((fn) => fn())
    }
}));
jest.mock('../../../src/middleware/timeoutHandler', () => ({
    withTimeoutAndRetry: jest.fn((fn) => fn())
}));
jest.mock('../../../src/middleware/gracefulDegradation', () => ({
    withXApiFallback: jest.fn((fn) => fn())
}));
jest.mock('axios');
const mockAxios = axios;
const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
    }
};
describe('X API Client', () => {
    let xApiClient;
    beforeEach(() => {
        jest.clearAllMocks();
        mockAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);
        xApiClient = new xApiClient_1.XApiClient({
            apiKey: 'test-api-key',
            apiSecret: 'test-api-secret',
            accessToken: 'test-access-token',
            accessTokenSecret: 'test-access-token-secret',
            bearerToken: 'test-bearer-token'
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Initialization', () => {
        it('should initialize with valid credentials', () => {
            expect(xApiClient).toBeDefined();
            expect(xApiClient).toBeInstanceOf(xApiClient_1.XApiClient);
        });
        it('should create axios instance on initialization', () => {
            expect(mockAxios.create).toHaveBeenCalledWith({
                baseURL: 'https://api.twitter.com/2',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'X-Marketing-Platform/1.0'
                }
            });
        });
    });
    describe('Tweet Operations', () => {
        it('should call postTweet with correct parameters', async () => {
            const mockTweetResponse = {
                data: {
                    id: '1234567890',
                    text: 'Hello World!',
                    created_at: new Date().toISOString(),
                    author_id: 'user123'
                }
            };
            mockAxiosInstance.post.mockResolvedValueOnce({
                data: mockTweetResponse,
                status: 201,
                statusText: 'Created',
                headers: {},
                config: {}
            });
            const result = await xApiClient.postTweet({
                text: 'Hello World!'
            });
            expect(result).toEqual(mockTweetResponse);
            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/tweets', {
                text: 'Hello World!'
            });
        });
        it('should call deleteTweet with correct parameters', async () => {
            mockAxiosInstance.delete.mockResolvedValueOnce({
                data: {},
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            });
            await xApiClient.deleteTweet('1234567890');
            expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/tweets/1234567890');
        });
        it('should call getTweet with correct parameters', async () => {
            const mockTweetData = {
                data: {
                    id: '1234567890',
                    text: 'Hello World!',
                    created_at: new Date().toISOString(),
                    author_id: 'user123'
                }
            };
            mockAxiosInstance.get.mockResolvedValueOnce({
                data: mockTweetData,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            });
            const result = await xApiClient.getTweet('1234567890');
            expect(result).toEqual(mockTweetData);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tweets/1234567890', {
                params: {
                    'tweet.fields': 'created_at,public_metrics,author_id',
                    'user.fields': 'username,name,verified',
                    expansions: 'author_id'
                }
            });
        });
    });
    describe('User Operations', () => {
        it('should call getUserByUsername with correct parameters', async () => {
            const mockUserData = {
                data: {
                    id: 'user123',
                    username: 'testuser',
                    name: 'Test User',
                    public_metrics: {
                        followers_count: 100,
                        following_count: 50,
                        tweet_count: 200,
                        listed_count: 5
                    }
                }
            };
            mockAxiosInstance.get.mockResolvedValueOnce({
                data: mockUserData,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            });
            const result = await xApiClient.getUserByUsername('testuser');
            expect(result).toEqual(mockUserData.data);
            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users/by/username/testuser', {
                params: {
                    'user.fields': 'description,public_metrics,verified,protected'
                }
            });
        });
        it('should call followUser with correct parameters', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({
                data: {},
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {}
            });
            await xApiClient.followUser('target123', 'user123');
            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/users/user123/following', {
                target_user_id: 'target123'
            });
        });
    });
    describe('Rate Limiting', () => {
        it('should respect rate limits', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: new Headers({
                    'x-rate-limit-remaining': '0',
                    'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900)
                }),
                json: async () => ({ error: 'Rate limit exceeded' })
            });
            await expect(xApiClient.postTweet({
                text: 'Test tweet'
            })).rejects.toThrow('X API rate limit exceeded');
        });
        it('should handle rate limit headers correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'x-rate-limit-remaining': '100',
                    'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900)
                }),
                json: async () => ({ data: { id: '123', text: 'Test' } })
            });
            await xApiClient.postTweet({ text: 'Test tweet' });
            expect(mockFetch).toHaveBeenCalled();
        });
    });
    describe('Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            await expect(xApiClient.postTweet({
                text: 'Test tweet'
            })).rejects.toThrow();
        });
        it('should handle API errors with proper error codes', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({
                    errors: [{ code: 63, message: 'User has been suspended' }]
                })
            });
            await expect(xApiClient.getUserByUsername('suspendeduser')).rejects.toThrow();
        });
        it('should retry on transient errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: 'Internal server error' })
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: { id: '123', text: 'Test' } })
            });
            const result = await xApiClient.postTweet({ text: 'Test tweet' });
            expect(result).toEqual({ data: { id: '123', text: 'Test' } });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
    describe('Search and Retrieval', () => {
        it('should search tweets successfully', async () => {
            const mockSearchResponse = {
                data: [
                    { id: '1', text: 'Test tweet 1', author_id: 'user1' },
                    { id: '2', text: 'Test tweet 2', author_id: 'user2' }
                ],
                meta: { result_count: 2 }
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockSearchResponse
            });
            const result = await xApiClient.searchTweets('test query', 10);
            expect(result).toEqual(mockSearchResponse);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tweets/search/recent'), expect.objectContaining({
                method: 'GET'
            }));
        });
    });
});
//# sourceMappingURL=xApiClient.test.js.map