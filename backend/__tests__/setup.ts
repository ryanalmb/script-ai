import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { cacheManager } from '../src/lib/cache';

// Mock Prisma Client
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// Mock Redis/Cache
jest.mock('../src/lib/cache', () => ({
  cacheManager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    warmCache: jest.fn(),
    cacheUserSession: jest.fn(),
    getUserSession: jest.fn(),
    invalidateUserSession: jest.fn(),
    cacheAnalytics: jest.fn(),
    getAnalytics: jest.fn(),
    cacheContentTemplates: jest.fn(),
    getContentTemplates: jest.fn().mockResolvedValue([]),
    cacheTrendingHashtags: jest.fn(),
    getTrendingHashtags: jest.fn().mockResolvedValue([]),
    incrementRateLimit: jest.fn().mockResolvedValue(1),
    invalidatePattern: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
  },
}));

// Mock Prisma
jest.mock('../src/lib/prisma', () => ({
  prisma: prismaMock,
  checkDatabaseConnection: jest.fn().mockResolvedValue(true),
  disconnectDatabase: jest.fn(),
  withTransaction: jest.fn(),
  bulkInsert: jest.fn(),
  findWithPagination: jest.fn(),
  getDatabaseMetrics: jest.fn().mockResolvedValue({
    users: 0,
    accounts: 0,
    posts: 0,
    campaigns: 0,
    activeAutomations: 0,
    timestamp: new Date().toISOString(),
  }),
}));

// Mock Logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock X API Client
jest.mock('../src/services/xApiClient', () => ({
  XApiClient: jest.fn().mockImplementation(() => ({
    tweet: jest.fn(),
    deleteTweet: jest.fn(),
    getUser: jest.fn(),
    getUserTweets: jest.fn(),
    like: jest.fn(),
    retweet: jest.fn(),
    follow: jest.fn(),
    unfollow: jest.fn(),
  })),
}));

// Global test setup
beforeEach(() => {
  mockReset(prismaMock);
});

// Test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashedPassword',
  role: 'USER' as any,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockXAccount = (overrides = {}) => ({
  id: 'account-1',
  userId: 'user-1',
  username: 'testaccount',
  displayName: 'Test Account',
  email: 'test@example.com',
  accessToken: 'mock-access-token',
  accessTokenSecret: 'mock-access-token-secret',
  accountId: 'x-account-id',
  isActive: true,
  isVerified: false,
  isSuspended: false,
  followersCount: 100,
  followingCount: 50,
  tweetsCount: 25,
  likesCount: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPost = (overrides = {}) => ({
  id: 'post-1',
  accountId: 'account-1',
  content: 'Test post content',
  mediaUrls: [],
  hashtags: ['#test'],
  mentions: [],
  status: 'DRAFT',
  tweetId: null,
  scheduledFor: null,
  publishedAt: null,
  likesCount: 0,
  retweetsCount: 0,
  repliesCount: 0,
  viewsCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockCampaign = (overrides = {}) => ({
  id: 'campaign-1',
  userId: 'user-1',
  name: 'Test Campaign',
  description: 'Test campaign description',
  status: 'DRAFT',
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockAutomation = (overrides = {}) => ({
  id: 'automation-1',
  accountId: 'account-1',
  campaignId: 'campaign-1',
  type: 'POST_CONTENT',
  status: 'INACTIVE',
  config: {},
  schedule: null,
  lastRun: null,
  nextRun: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// JWT Token utilities for testing
export const createMockJWT = (payload = {}) => {
  const defaultPayload = {
    userId: 'user-1',
    email: 'test@example.com',
    role: 'USER',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    ...payload,
  };
  
  // In real tests, you'd use a proper JWT library
  // For mocking, we'll just return a base64 encoded payload
  return `mock.${Buffer.from(JSON.stringify(defaultPayload)).toString('base64')}.signature`;
};

// Request/Response mocks
export const createMockRequest = (overrides = {}) => {
  const req: any = {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    method: 'GET',
    path: '/',
    originalUrl: '/',
    session: { id: 'test-session' },
    ...overrides,
  };

  // Make ip writable for tests
  Object.defineProperty(req, 'ip', {
    value: '127.0.0.1',
    writable: true,
    configurable: true,
  });

  return req;
};

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.locals = {};
  return res;
};

export const createMockNext = () => jest.fn();

// Database test helpers
export const clearDatabase = async () => {
  // In integration tests, this would clear the test database
  // For unit tests with mocks, we just reset the mocks
  mockReset(prismaMock);
};

// Time utilities for testing
export const advanceTime = (ms: number) => {
  jest.advanceTimersByTime(ms);
};

export const mockDate = (date: Date) => {
  jest.useFakeTimers();
  jest.setSystemTime(date);
};

export const restoreTime = () => {
  jest.useRealTimers();
};

// Environment setup for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
