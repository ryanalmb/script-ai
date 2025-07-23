import { TwikitSessionManager, TwikitSessionOptions } from '../services/twikitSessionManager';
import { logger } from '../utils/logger';

// Mock dependencies
jest.mock('../utils/logger');
jest.mock('../lib/cache');
jest.mock('../lib/prisma');

describe('TwikitSessionManager', () => {
  let sessionManager: TwikitSessionManager;
  
  beforeEach(() => {
    sessionManager = new TwikitSessionManager();
  });

  afterEach(async () => {
    await sessionManager.shutdown();
  });

  describe('Session Creation', () => {
    it('should create a new session successfully', async () => {
      const options: TwikitSessionOptions = {
        accountId: 'test-account-1',
        credentials: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'testpass'
        },
        enableHealthMonitoring: false
      };

      const session = await sessionManager.createSession(options);

      expect(session).toBeDefined();
      expect(session.accountId).toBe('test-account-1');
      expect(session.sessionId).toMatch(/^twikit_test-account-1_/);
      expect(session.isActive).toBe(false);
      expect(session.isAuthenticated).toBe(false);
      expect(session.metrics).toBeDefined();
      expect(session.metrics.totalRequests).toBe(0);
      expect(session.metrics.successfulRequests).toBe(0);
      expect(session.metrics.failedRequests).toBe(0);
    });

    it('should reuse existing active session', async () => {
      const options: TwikitSessionOptions = {
        accountId: 'test-account-2',
        credentials: {
          username: 'testuser2',
          email: 'test2@example.com',
          password: 'testpass2'
        }
      };

      const session1 = await sessionManager.createSession(options);
      session1.isActive = true; // Simulate active session

      const session2 = await sessionManager.createSession(options);

      expect(session1.sessionId).toBe(session2.sessionId);
    });
  });

  describe('Session Management', () => {
    it('should get session by account ID', async () => {
      const options: TwikitSessionOptions = {
        accountId: 'test-account-3',
        credentials: {
          username: 'testuser3',
          email: 'test3@example.com',
          password: 'testpass3'
        }
      };

      await sessionManager.createSession(options);
      const retrievedSession = sessionManager.getSession('test-account-3');

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.accountId).toBe('test-account-3');
    });

    it('should return null for non-existent session', () => {
      const session = sessionManager.getSession('non-existent-account');
      expect(session).toBeNull();
    });

    it('should get all sessions', async () => {
      const options1: TwikitSessionOptions = {
        accountId: 'test-account-4',
        credentials: {
          username: 'testuser4',
          email: 'test4@example.com',
          password: 'testpass4'
        }
      };

      const options2: TwikitSessionOptions = {
        accountId: 'test-account-5',
        credentials: {
          username: 'testuser5',
          email: 'test5@example.com',
          password: 'testpass5'
        }
      };

      await sessionManager.createSession(options1);
      await sessionManager.createSession(options2);

      const allSessions = sessionManager.getAllSessions();
      expect(allSessions).toHaveLength(2);
      expect(allSessions.map(s => s.accountId)).toContain('test-account-4');
      expect(allSessions.map(s => s.accountId)).toContain('test-account-5');
    });
  });

  describe('Session Statistics', () => {
    it('should return correct session statistics', async () => {
      const options: TwikitSessionOptions = {
        accountId: 'test-stats-account',
        credentials: {
          username: 'statsuser',
          email: 'stats@example.com',
          password: 'statspass'
        }
      };

      const session = await sessionManager.createSession(options);
      session.isAuthenticated = true;
      session.metrics.status = 'active';
      session.metrics.totalRequests = 10;
      session.metrics.successfulRequests = 8;
      session.metrics.successRate = 80;

      const stats = sessionManager.getSessionStatistics();

      expect(stats.totalSessions).toBe(1);
      expect(stats.activeSessions).toBe(1);
      expect(stats.authenticatedSessions).toBe(1);
      expect(stats.totalRequests).toBe(10);
      expect(stats.totalSuccessfulRequests).toBe(8);
      expect(stats.averageSuccessRate).toBe(80);
    });
  });

  describe('Session Filtering', () => {
    it('should filter sessions by status', async () => {
      const options1: TwikitSessionOptions = {
        accountId: 'active-account',
        credentials: {
          username: 'activeuser',
          email: 'active@example.com',
          password: 'activepass'
        }
      };

      const options2: TwikitSessionOptions = {
        accountId: 'suspended-account',
        credentials: {
          username: 'suspendeduser',
          email: 'suspended@example.com',
          password: 'suspendedpass'
        }
      };

      const session1 = await sessionManager.createSession(options1);
      const session2 = await sessionManager.createSession(options2);

      session1.metrics.status = 'active';
      session2.metrics.status = 'suspended';

      const activeSessions = sessionManager.getSessionsByStatus('active');
      const suspendedSessions = sessionManager.getSessionsByStatus('suspended');

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].accountId).toBe('active-account');
      expect(suspendedSessions).toHaveLength(1);
      expect(suspendedSessions[0].accountId).toBe('suspended-account');
    });
  });

  describe('Session Configuration Updates', () => {
    it('should update session configuration', async () => {
      const options: TwikitSessionOptions = {
        accountId: 'config-update-account',
        credentials: {
          username: 'configuser',
          email: 'config@example.com',
          password: 'configpass'
        },
        enableHealthMonitoring: false
      };

      await sessionManager.createSession(options);

      const updateResult = await sessionManager.updateSessionConfig('config-update-account', {
        enableHealthMonitoring: true,
        enableAntiDetection: true
      });

      expect(updateResult).toBe(true);

      const session = sessionManager.getSession('config-update-account');
      expect(session?.options.enableHealthMonitoring).toBe(true);
      expect(session?.options.enableAntiDetection).toBe(true);
    });

    it('should return false for non-existent session config update', async () => {
      const updateResult = await sessionManager.updateSessionConfig('non-existent', {
        enableHealthMonitoring: true
      });

      expect(updateResult).toBe(false);
    });
  });

  describe('Session Destruction', () => {
    it('should destroy session successfully', async () => {
      const options: TwikitSessionOptions = {
        accountId: 'destroy-account',
        credentials: {
          username: 'destroyuser',
          email: 'destroy@example.com',
          password: 'destroypass'
        }
      };

      await sessionManager.createSession(options);
      
      const destroyResult = await sessionManager.destroySession('destroy-account');
      expect(destroyResult).toBe(true);

      const session = sessionManager.getSession('destroy-account');
      expect(session).toBeNull();
    });

    it('should return false when destroying non-existent session', async () => {
      const destroyResult = await sessionManager.destroySession('non-existent');
      expect(destroyResult).toBe(false);
    });
  });
});
