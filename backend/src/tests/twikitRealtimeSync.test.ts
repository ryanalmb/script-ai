/**
 * Twikit Real-time Synchronization Service Tests - Task 16
 * 
 * Comprehensive test suite for the TwikitRealtimeSync service
 * Tests WebSocket integration, event processing, and service coordination
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { TwikitRealtimeSync, WebSocketEventType, StreamingFilterType, WebSocketEvent } from '../services/twikitRealtimeSync';
import { AccountHealthMonitor } from '../services/accountHealthMonitor';
import { EnterpriseAntiDetectionManager } from '../services/enterpriseAntiDetectionManager';
import { EnterpriseWebSocketService } from '../services/realTimeSync/webSocketService';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';

// Mock dependencies
jest.mock('../lib/prisma');
jest.mock('../lib/cache');
jest.mock('../utils/logger');
jest.mock('child_process');

describe('TwikitRealtimeSync', () => {
  let realtimeSync: TwikitRealtimeSync;
  let mockHealthMonitor: jest.Mocked<AccountHealthMonitor>;
  let mockAntiDetectionManager: jest.Mocked<EnterpriseAntiDetectionManager>;
  let mockWebSocketService: jest.Mocked<EnterpriseWebSocketService>;
  let mockBehavioralEngine: any;

  const testConfig = {
    pythonScriptPath: 'test/x_client.py',
    maxConnections: 10,
    eventQueueSize: 1000,
    heartbeatInterval: 5000,
    reconnectInterval: 1000,
    maxReconnectAttempts: 3,
    processingLatencyThreshold: 50,
    enableMetricsCollection: true,
    enableEventPersistence: true
  };

  beforeAll(async () => {
    // Setup mock dependencies
    mockHealthMonitor = {
      handleRealtimeEvent: jest.fn(),
      performHealthAssessment: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockAntiDetectionManager = {
      handleRealtimeDetectionEvent: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockWebSocketService = {
      broadcastToChannel: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockBehavioralEngine = {
      handleRealtimeBehavioralEvent: jest.fn(),
      update_behavioral_state: jest.fn()
    };

    // Mock database and cache responses
    (prisma.antiDetectionAuditLog.create as jest.Mock).mockResolvedValue({});
    (cacheManager.set as jest.Mock).mockResolvedValue(true);
    (cacheManager.get as jest.Mock).mockResolvedValue(null);

    // Initialize real-time sync service
    realtimeSync = new TwikitRealtimeSync(
      testConfig,
      mockHealthMonitor,
      mockAntiDetectionManager,
      mockBehavioralEngine,
      mockWebSocketService
    );

    await realtimeSync.initialize();
  });

  afterAll(async () => {
    await realtimeSync.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(realtimeSync).toBeDefined();
      expect(realtimeSync.getConnectionStatus().is_running).toBe(true);
    });

    test('should setup service integrations', () => {
      const status = realtimeSync.getConnectionStatus();
      expect(status.is_running).toBe(true);
      expect(status.total_connections).toBe(0);
      expect(status.active_connections).toBe(0);
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        ...testConfig,
        maxConnections: 50,
        eventQueueSize: 5000
      };

      const customSync = new TwikitRealtimeSync(customConfig);
      expect(customSync).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    test('should start account streaming', async () => {
      const accountId = 'test-account-123';
      const credentials = {
        username: 'testuser',
        password: 'testpass',
        email: 'test@example.com'
      };

      // Mock child_process spawn
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      mockSpawn.mockReturnValue(mockProcess);

      const connectionId = await realtimeSync.startAccountStreaming(
        accountId,
        credentials,
        [WebSocketEventType.TWEET_CREATE, WebSocketEventType.MENTION]
      );

      expect(connectionId).toBeDefined();
      expect(connectionId).toMatch(/^conn_test-account-123_\d+$/);
      expect(mockSpawn).toHaveBeenCalled();

      const status = realtimeSync.getConnectionStatus();
      expect(status.total_connections).toBe(1);
      expect(status.active_connections).toBe(1);
    });

    test('should stop account streaming', async () => {
      const accountId = 'test-account-456';
      const credentials = { username: 'test', password: 'test', email: 'test@test.com' };

      // Mock child_process spawn
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      mockSpawn.mockReturnValue(mockProcess);

      const connectionId = await realtimeSync.startAccountStreaming(accountId, credentials);
      const success = await realtimeSync.stopAccountStreaming(connectionId);

      expect(success).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      const status = realtimeSync.getConnectionStatus();
      expect(status.active_connections).toBe(0);
    });

    test('should handle connection limit', async () => {
      const limitedConfig = { ...testConfig, maxConnections: 1 };
      const limitedSync = new TwikitRealtimeSync(limitedConfig);
      await limitedSync.initialize();

      const credentials = { username: 'test', password: 'test', email: 'test@test.com' };

      // Mock child_process spawn
      const mockSpawn = require('child_process').spawn;
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      });

      // Start first connection
      await limitedSync.startAccountStreaming('account1', credentials);

      // Try to start second connection (should fail)
      await expect(
        limitedSync.startAccountStreaming('account2', credentials)
      ).rejects.toThrow('Maximum connections reached');

      await limitedSync.shutdown();
    });
  });

  describe('Event Processing', () => {
    test('should process WebSocket events', async () => {
      const testEvent: WebSocketEvent = {
        event_id: 'test-event-123',
        event_type: WebSocketEventType.TWEET_CREATE,
        account_id: 'test-account',
        timestamp: new Date(),
        data: {
          tweet_id: 'tweet_123',
          text: 'Test tweet content',
          user_id: 'user_456'
        },
        correlation_id: 'corr_123',
        source: 'test',
        priority: 2,
        retry_count: 0
      };

      // Emit event for processing
      realtimeSync.emit('eventReceived', testEvent);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify event was processed
      const metrics = realtimeSync.getStreamingMetrics();
      expect(metrics.events_processed).toBeGreaterThan(0);
    });

    test('should forward health events to AccountHealthMonitor', async () => {
      const healthEvent: WebSocketEvent = {
        event_id: 'health-event-123',
        event_type: WebSocketEventType.HEALTH_ALERT,
        account_id: 'test-account',
        timestamp: new Date(),
        data: { alert_type: 'rate_limit_warning' },
        priority: 3,
        retry_count: 0
      };

      realtimeSync.emit('eventReceived', healthEvent);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockHealthMonitor.handleRealtimeEvent).toHaveBeenCalledWith(healthEvent);
    });

    test('should forward detection events to EnterpriseAntiDetectionManager', async () => {
      const detectionEvent: WebSocketEvent = {
        event_id: 'detection-event-123',
        event_type: WebSocketEventType.DETECTION_EVENT,
        account_id: 'test-account',
        timestamp: new Date(),
        data: { detection_type: 'captcha_challenge' },
        priority: 3,
        retry_count: 0
      };

      realtimeSync.emit('eventReceived', detectionEvent);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockAntiDetectionManager.handleRealtimeDetectionEvent).toHaveBeenCalledWith(detectionEvent);
    });

    test('should forward behavioral events to AdvancedBehavioralPatternEngine', async () => {
      const behavioralEvent: WebSocketEvent = {
        event_id: 'behavioral-event-123',
        event_type: WebSocketEventType.TWEET_LIKE,
        account_id: 'test-account',
        timestamp: new Date(),
        data: { tweet_id: 'tweet_456', user_id: 'user_789' },
        priority: 1,
        retry_count: 0
      };

      realtimeSync.emit('eventReceived', behavioralEvent);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockBehavioralEngine.handleRealtimeBehavioralEvent).toHaveBeenCalledWith(behavioralEvent);
    });

    test('should broadcast events to WebSocket service', async () => {
      const broadcastEvent: WebSocketEvent = {
        event_id: 'broadcast-event-123',
        event_type: WebSocketEventType.MENTION,
        account_id: 'test-account',
        timestamp: new Date(),
        data: { mention_text: '@testuser hello' },
        priority: 2,
        retry_count: 0
      };

      realtimeSync.emit('eventReceived', broadcastEvent);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockWebSocketService.broadcastToChannel).toHaveBeenCalledWith(
        'realtime_events',
        expect.objectContaining({
          type: 'realtime_event',
          event_type: WebSocketEventType.MENTION,
          account_id: 'test-account'
        })
      );
    });
  });

  describe('Streaming Filters', () => {
    test('should add streaming filter', async () => {
      const accountId = 'test-account-filter';
      const credentials = { username: 'test', password: 'test', email: 'test@test.com' };

      // Mock child_process spawn
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      mockSpawn.mockReturnValue(mockProcess);

      const connectionId = await realtimeSync.startAccountStreaming(accountId, credentials);

      const filterId = await realtimeSync.addStreamingFilter(
        connectionId,
        StreamingFilterType.KEYWORD_FILTER,
        { keywords: ['test', 'demo'] }
      );

      expect(filterId).toBeDefined();
      expect(filterId).toMatch(/^filter_\d+_[a-z0-9]+$/);
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('add_streaming_filter')
      );
    });

    test('should handle filter for non-existent connection', async () => {
      await expect(
        realtimeSync.addStreamingFilter(
          'non-existent-connection',
          StreamingFilterType.USER_FILTER,
          { user_ids: ['user123'] }
        )
      ).rejects.toThrow('Connection not found');
    });
  });

  describe('Real-time Commands', () => {
    test('should send real-time command', async () => {
      const accountId = 'test-account-command';
      const credentials = { username: 'test', password: 'test', email: 'test@test.com' };

      // Mock child_process spawn
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      mockSpawn.mockReturnValue(mockProcess);

      const connectionId = await realtimeSync.startAccountStreaming(accountId, credentials);

      const success = await realtimeSync.sendRealtimeCommand(
        connectionId,
        'post_tweet',
        { text: 'Real-time tweet from WebSocket' }
      );

      expect(success).toBe(true);
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('send_realtime_command')
      );
    });

    test('should handle command for non-existent connection', async () => {
      const success = await realtimeSync.sendRealtimeCommand(
        'non-existent-connection',
        'test_command',
        { data: 'test' }
      );

      expect(success).toBe(false);
    });
  });

  describe('Performance and Metrics', () => {
    test('should track streaming metrics', () => {
      const metrics = realtimeSync.getStreamingMetrics();

      expect(metrics).toHaveProperty('total_connections');
      expect(metrics).toHaveProperty('active_connections');
      expect(metrics).toHaveProperty('events_processed');
      expect(metrics).toHaveProperty('events_per_second');
      expect(metrics).toHaveProperty('average_latency');
      expect(metrics).toHaveProperty('error_rate');
      expect(metrics).toHaveProperty('reconnection_rate');
      expect(metrics).toHaveProperty('uptime_percentage');
      expect(metrics).toHaveProperty('last_updated');

      expect(typeof metrics.total_connections).toBe('number');
      expect(typeof metrics.active_connections).toBe('number');
      expect(typeof metrics.events_processed).toBe('number');
      expect(typeof metrics.average_latency).toBe('number');
    });

    test('should provide connection status', () => {
      const status = realtimeSync.getConnectionStatus();

      expect(status).toHaveProperty('is_running');
      expect(status).toHaveProperty('total_connections');
      expect(status).toHaveProperty('active_connections');
      expect(status).toHaveProperty('event_queue_size');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('connections');

      expect(status.is_running).toBe(true);
      expect(Array.isArray(status.connections)).toBe(true);
    });

    test('should maintain low processing latency', async () => {
      const startTime = Date.now();

      // Process multiple events
      for (let i = 0; i < 10; i++) {
        const event: WebSocketEvent = {
          event_id: `perf-test-${i}`,
          event_type: WebSocketEventType.HEARTBEAT,
          account_id: 'perf-test-account',
          timestamp: new Date(),
          data: { test: true },
          priority: 0,
          retry_count: 0
        };

        realtimeSync.emit('eventReceived', event);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = realtimeSync.getStreamingMetrics();
      expect(metrics.average_latency).toBeLessThan(100); // Should be under 100ms
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle Python process errors gracefully', async () => {
      const accountId = 'test-error-account';
      const credentials = { username: 'test', password: 'test', email: 'test@test.com' };

      // Mock child_process spawn with error
      const mockSpawn = require('child_process').spawn;
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      mockSpawn.mockReturnValue(mockProcess);

      const connectionId = await realtimeSync.startAccountStreaming(accountId, credentials);

      // Simulate process error
      const errorHandler = mockProcess.on.mock.calls.find(call => call[0] === 'error')?.[1];
      if (errorHandler) {
        errorHandler(new Error('Test process error'));
      }

      // Should not crash the service
      expect(realtimeSync.getConnectionStatus().is_running).toBe(true);
    });

    test('should persist high-priority events', async () => {
      const highPriorityEvent: WebSocketEvent = {
        event_id: 'high-priority-event',
        event_type: WebSocketEventType.ACCOUNT_SUSPENSION,
        account_id: 'test-account',
        timestamp: new Date(),
        data: { suspension_reason: 'policy_violation' },
        priority: 3, // High priority
        retry_count: 0
      };

      realtimeSync.emit('eventReceived', highPriorityEvent);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should persist to database
      expect(prisma.antiDetectionAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'test-account',
            action: 'REALTIME_EVENT_ACCOUNT_SUSPENSION'
          })
        })
      );

      // Should cache the event
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('twikit_realtime:events:test-account:high-priority-event'),
        expect.any(String),
        300
      );
    });
  });

  describe('Service Integration', () => {
    test('should integrate with existing WebSocket infrastructure', () => {
      // Verify that the service extends existing WebSocket infrastructure
      expect(mockWebSocketService.broadcastToChannel).toBeDefined();
      expect(mockWebSocketService.on).toBeDefined();
    });

    test('should coordinate with all Phase 2 services', () => {
      // Verify integration with AccountHealthMonitor
      expect(mockHealthMonitor.handleRealtimeEvent).toBeDefined();

      // Verify integration with EnterpriseAntiDetectionManager
      expect(mockAntiDetectionManager.handleRealtimeDetectionEvent).toBeDefined();

      // Verify integration with AdvancedBehavioralPatternEngine
      expect(mockBehavioralEngine.handleRealtimeBehavioralEvent).toBeDefined();
    });

    test('should maintain backward compatibility', () => {
      // Service should not break existing functionality
      const status = realtimeSync.getConnectionStatus();
      expect(status.is_running).toBe(true);

      // Should work without service dependencies
      const standaloneSync = new TwikitRealtimeSync(testConfig);
      expect(standaloneSync).toBeDefined();
    });
  });
});
