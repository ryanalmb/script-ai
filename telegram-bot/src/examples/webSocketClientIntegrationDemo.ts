/**
 * WebSocket Client Integration Demo - Phase 2 Component 2.1
 * 
 * Demonstrates the comprehensive WebSocket client integration capabilities
 * including connection management, event routing, and real-time communication.
 */

import { WebSocketClientIntegration } from '../services/webSocketClientIntegration';
import { logger } from '../utils/logger';

/**
 * Demo: Basic WebSocket Client Setup
 */
async function demoBasicWebSocketClient() {
  console.log('\n🌐 Demo: Basic WebSocket Client Setup');
  console.log('='.repeat(60));

  try {
    // Initialize WebSocket client with custom configuration
    const wsClient = new WebSocketClientIntegration({
      connectionPool: {
        maxConnectionsPerService: 3,
        connectionTimeout: 15000,
        heartbeatInterval: 20000,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        bufferSize: 500,
        enableMetrics: true,
        enableHealthMonitoring: true
      },
      authentication: {
        enabled: true,
        tokenRefreshInterval: 1800000, // 30 minutes
        authHeader: 'Authorization'
      },
      eventRouting: {
        enableFiltering: true,
        enablePrioritization: true,
        bufferCriticalEvents: true
      },
      monitoring: {
        enableAnalytics: true,
        metricsInterval: 30000, // 30 seconds
        healthCheckInterval: 15000 // 15 seconds
      }
    });

    // Setup event handlers
    wsClient.on('client:initialized', () => {
      console.log('✅ WebSocket client initialized successfully');
    });

    wsClient.on('connection:established', (data) => {
      console.log(`🔗 Connection established: ${data.serviceName} (${data.connectionId})`);
    });

    wsClient.on('connection:closed', (data) => {
      console.log(`🔌 Connection closed: ${data.serviceName} - ${data.reason}`);
    });

    wsClient.on('connection:error', (data) => {
      console.log(`❌ Connection error: ${data.serviceName} - ${data.error.message}`);
    });

    wsClient.on('event:routed', (event) => {
      console.log(`📨 Event routed: ${event.type} from ${event.source}`);
    });

    // Initialize the client
    await wsClient.initialize();
    console.log('✅ WebSocket client setup completed');

    return wsClient;

  } catch (error) {
    console.error('❌ Failed to setup WebSocket client:', error);
    throw error;
  }
}

/**
 * Demo: Event Handling and Routing
 */
async function demoEventHandling(wsClient: WebSocketClientIntegration) {
  console.log('\n📨 Demo: Event Handling and Routing');
  console.log('='.repeat(60));

  try {
    // Setup specific event handlers
    wsClient.on('campaign:progress', (data) => {
      console.log(`📈 Campaign Progress: ${data.campaignId} - ${data.progress}%`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Metrics:`, data.metrics);
    });

    wsClient.on('session:health', (data) => {
      console.log(`🏥 Session Health: ${data.accountId} - ${data.health}`);
      if (data.issues && data.issues.length > 0) {
        console.log(`   Issues:`, data.issues);
      }
      if (data.recommendations && data.recommendations.length > 0) {
        console.log(`   Recommendations:`, data.recommendations);
      }
    });

    wsClient.on('analytics:update', (data) => {
      console.log(`📊 Analytics Update:`);
      console.log(`   Metrics:`, data.metrics);
      console.log(`   Trends:`, data.trends);
    });

    wsClient.on('rate_limit:warning', (data) => {
      console.log(`⚠️ Rate Limit Warning: ${data.accountId}`);
      console.log(`   Remaining: ${data.remaining}`);
      console.log(`   Reset Time: ${data.resetTime}`);
      console.log(`   Recommendation: ${data.recommendation}`);
    });

    wsClient.on('system:status', (data) => {
      console.log(`🖥️ System Status: ${data.status}`);
      console.log(`   Services:`, data.services);
      if (data.alerts && data.alerts.length > 0) {
        console.log(`   Alerts:`, data.alerts);
      }
    });

    wsClient.on('service:health_change', (data) => {
      console.log(`🔄 Service Health Change: ${data.serviceName}`);
      console.log(`   ${data.oldStatus} → ${data.newStatus}`);
      console.log(`   Impact: ${data.impact}`);
    });

    console.log('✅ Event handlers configured');

  } catch (error) {
    console.error('❌ Failed to setup event handling:', error);
    throw error;
  }
}

/**
 * Demo: Bidirectional Communication
 */
async function demoBidirectionalCommunication(wsClient: WebSocketClientIntegration) {
  console.log('\n🔄 Demo: Bidirectional Communication');
  console.log('='.repeat(60));

  try {
    // Subscribe to specific events from services
    console.log('📡 Subscribing to events...');
    
    await wsClient.subscribeToEvents('twikit-realtime-sync', [
      'campaign_progress',
      'session_health',
      'analytics_update'
    ]);

    await wsClient.subscribeToEvents('twikit-monitoring-service', [
      'system_status',
      'service_health_change'
    ]);

    await wsClient.subscribeToEvents('global-rate-limit-coordinator', [
      'rate_limit_warning',
      'queue_status'
    ]);

    // Send custom messages to services
    console.log('📤 Sending custom messages...');

    await wsClient.sendMessage('twikit-realtime-sync', {
      type: 'request_status',
      data: { requestId: 'demo_001' }
    });

    await wsClient.sendMessage('twikit-monitoring-service', {
      type: 'health_check',
      data: { component: 'websocket_client' }
    });

    // Broadcast message to all services
    const broadcastCount = await wsClient.broadcastMessage({
      type: 'client_announcement',
      data: { 
        message: 'WebSocket client integration demo active',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📢 Broadcast sent to ${broadcastCount} services`);
    console.log('✅ Bidirectional communication demo completed');

  } catch (error) {
    console.error('❌ Failed bidirectional communication demo:', error);
    throw error;
  }
}

/**
 * Demo: Connection Management and Monitoring
 */
async function demoConnectionManagement(wsClient: WebSocketClientIntegration) {
  console.log('\n🔧 Demo: Connection Management and Monitoring');
  console.log('='.repeat(60));

  try {
    // Get connection status
    const connectionStatus = wsClient.getConnectionStatus();
    console.log('📊 Connection Status:');
    for (const [serviceName, status] of Object.entries(connectionStatus)) {
      console.log(`   ${serviceName}:`);
      console.log(`     Connected: ${status.connected}`);
      console.log(`     Status: ${status.status}`);
      console.log(`     Connections: ${status.connectionCount}`);
      if (status.metrics) {
        console.log(`     Messages Sent: ${status.metrics.messagesSent}`);
        console.log(`     Messages Received: ${status.metrics.messagesReceived}`);
        console.log(`     Average Latency: ${status.metrics.averageLatency}ms`);
      }
    }

    // Get client status
    const clientStatus = await wsClient.getClientStatus();
    console.log('\n🖥️ Client Status:');
    console.log(`   Initialized: ${clientStatus.initialized}`);
    console.log(`   Total Services: ${clientStatus.totalServices}`);
    console.log(`   Active Connections: ${clientStatus.activeConnections}`);
    console.log(`   Event Buffer Size: ${clientStatus.eventBufferSize}`);
    console.log(`   Event Queue Size: ${clientStatus.eventQueueSize}`);
    console.log(`   Average Latency: ${clientStatus.averageLatency}ms`);
    console.log(`   Uptime: ${Math.round(clientStatus.uptime / 1000)}s`);

    // Get buffered events
    const bufferedEvents = wsClient.getBufferedEvents();
    console.log(`\n📦 Buffered Events: ${bufferedEvents.length}`);
    bufferedEvents.slice(0, 3).forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.type} from ${event.source} (${event.priority})`);
    });

    console.log('✅ Connection management demo completed');

  } catch (error) {
    console.error('❌ Failed connection management demo:', error);
    throw error;
  }
}

/**
 * Demo: Metrics and Analytics
 */
async function demoMetricsAndAnalytics(wsClient: WebSocketClientIntegration) {
  console.log('\n📈 Demo: Metrics and Analytics');
  console.log('='.repeat(60));

  try {
    // Setup metrics collection handler
    wsClient.on('metrics:collected', (metrics) => {
      console.log('📊 Metrics Update:');
      console.log(`   Total Connections: ${metrics.totalConnections}`);
      console.log(`   Active Connections: ${metrics.activeConnections}`);
      console.log(`   Failed Connections: ${metrics.failedConnections}`);
      console.log(`   Messages Sent: ${metrics.totalMessagesSent}`);
      console.log(`   Messages Received: ${metrics.totalMessagesReceived}`);
      console.log(`   Average Latency: ${Math.round(metrics.averageLatency)}ms`);
      console.log(`   Event Buffer: ${metrics.eventBufferSize}/${metrics.eventQueueSize}`);
    });

    // Setup health monitoring handler
    wsClient.on('health:issue', (data) => {
      console.log(`🏥 Health Issue Detected:`);
      console.log(`   Service: ${data.serviceName}`);
      console.log(`   Health: ${data.health}`);
      console.log(`   Issues:`, data.issues);
      console.log(`   Recommendations:`, data.recommendations);
    });

    console.log('⏱️ Waiting for metrics collection...');
    
    // Wait for metrics to be collected
    await new Promise(resolve => setTimeout(resolve, 35000));

    console.log('✅ Metrics and analytics demo completed');

  } catch (error) {
    console.error('❌ Failed metrics and analytics demo:', error);
    throw error;
  }
}

/**
 * Main demo execution
 */
async function runWebSocketClientDemo() {
  try {
    console.log('🚀 Starting WebSocket Client Integration Demo');
    console.log('='.repeat(80));

    // Run all demos
    const wsClient = await demoBasicWebSocketClient();
    await demoEventHandling(wsClient);
    await demoBidirectionalCommunication(wsClient);
    await demoConnectionManagement(wsClient);
    await demoMetricsAndAnalytics(wsClient);

    console.log('\n🎉 WebSocket Client Integration Demo completed successfully!');
    console.log('='.repeat(80));

    // Cleanup
    await wsClient.shutdown();

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
export {
  demoBasicWebSocketClient,
  demoEventHandling,
  demoBidirectionalCommunication,
  demoConnectionManagement,
  demoMetricsAndAnalytics,
  runWebSocketClientDemo
};

// Run demo if this file is executed directly
if (require.main === module) {
  runWebSocketClientDemo();
}
