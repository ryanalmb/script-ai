/**
 * Real-time Event Processor Demo - Phase 2 Component 2.2
 * 
 * Demonstrates the comprehensive real-time event processing capabilities
 * including intelligent filtering, user-friendly message formatting,
 * embedded visualizations, and actionable recommendations.
 */

import { RealTimeEventProcessor } from '../services/realTimeEventProcessor';
import { webSocketClientIntegration } from '../services/webSocketClientIntegration';
import { logger } from '../utils/logger';

/**
 * Demo: Basic Event Processing Setup
 */
async function demoBasicEventProcessing() {
  console.log('\n⚡ Demo: Basic Event Processing Setup');
  console.log('='.repeat(60));

  try {
    // Initialize Real-time Event Processor
    const eventProcessor = new RealTimeEventProcessor();

    // Setup event handlers
    eventProcessor.on('processor:initialized', () => {
      console.log('✅ Real-time Event Processor initialized successfully');
    });

    eventProcessor.on('event:processed', (processedEvent) => {
      console.log(`📨 Event processed: ${processedEvent.type} for user ${processedEvent.userId}`);
      console.log(`   Priority: ${processedEvent.priority}`);
      console.log(`   Message length: ${processedEvent.message.text.length} characters`);
    });

    eventProcessor.on('notification:delivered', (processedEvent) => {
      console.log(`✅ Notification delivered: ${processedEvent.type} to user ${processedEvent.userId}`);
    });

    eventProcessor.on('notification:failed', (processedEvent) => {
      console.log(`❌ Notification failed: ${processedEvent.type} to user ${processedEvent.userId}`);
    });

    eventProcessor.on('metrics:collected', (metrics) => {
      console.log('📊 Processing Metrics:');
      console.log(`   Total Processed: ${metrics.totalProcessed}`);
      console.log(`   Total Delivered: ${metrics.totalDelivered}`);
      console.log(`   Total Filtered: ${metrics.totalFiltered}`);
      console.log(`   Total Deduplicated: ${metrics.totalDeduplicated}`);
      console.log(`   Average Processing Time: ${Math.round(metrics.averageProcessingTime)}ms`);
      console.log(`   Delivery Success Rate: ${Math.round(metrics.deliverySuccessRate * 100)}%`);
    });

    // Initialize the processor
    await eventProcessor.initialize();
    console.log('✅ Event processing setup completed');

    return eventProcessor;

  } catch (error) {
    console.error('❌ Failed to setup event processing:', error);
    throw error;
  }
}

/**
 * Demo: Event Filtering and Deduplication
 */
async function demoEventFiltering(eventProcessor: RealTimeEventProcessor) {
  console.log('\n🔍 Demo: Event Filtering and Deduplication');
  console.log('='.repeat(60));

  try {
    // Add custom event filter
    eventProcessor.addEventFilter({
      id: 'demo_filter',
      type: 'custom',
      condition: (event) => {
        // Filter out events with low priority during demo
        return event.priority !== 'low';
      },
      priority: 10,
      enabled: true
    });

    console.log('✅ Custom event filter added');

    // Simulate duplicate events to test deduplication
    const duplicateEvent = {
      type: 'campaign_progress',
      data: {
        campaignId: 'demo_campaign_001',
        progress: 50,
        status: 'active'
      },
      timestamp: new Date(),
      priority: 'normal'
    };

    // Emit the same event multiple times
    for (let i = 0; i < 5; i++) {
      webSocketClientIntegration.emit('campaign:progress', duplicateEvent);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('📤 Sent 5 duplicate events for deduplication testing');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Event filtering and deduplication demo completed');

  } catch (error) {
    console.error('❌ Failed event filtering demo:', error);
    throw error;
  }
}

/**
 * Demo: Message Formatting and Visualizations
 */
async function demoMessageFormatting(eventProcessor: RealTimeEventProcessor) {
  console.log('\n🎨 Demo: Message Formatting and Visualizations');
  console.log('='.repeat(60));

  try {
    // Demo campaign progress event with visualization
    const campaignEvent = {
      campaignId: 'demo_campaign_002',
      campaignName: 'Crypto Education Series',
      progress: 75,
      status: 'active',
      postsPublished: 15,
      engagementRate: 4.2,
      reach: 12500,
      qualityScore: 88,
      nextMilestone: 'Reach 20 posts',
      estimatedCompletion: '2 hours',
      timestamp: new Date()
    };

    webSocketClientIntegration.emit('campaign:progress', campaignEvent);
    console.log('📈 Campaign progress event with embedded progress bar sent');

    // Demo session health event with status indicators
    const sessionEvent = {
      accountId: 'demo_account_001',
      accountHandle: 'crypto_educator',
      health: 'warning',
      healthScore: 65,
      issues: ['rate_limit_approaching', 'low_engagement'],
      recommendations: ['Reduce posting frequency', 'Improve content quality'],
      lastCheckTime: new Date().toLocaleString(),
      nextCheckTime: new Date(Date.now() + 3600000).toLocaleString(),
      timestamp: new Date()
    };

    webSocketClientIntegration.emit('session:health', sessionEvent);
    console.log('🏥 Session health event with status indicators sent');

    // Demo analytics event with metrics dashboard
    const analyticsEvent = {
      accountId: 'demo_account_001',
      metrics: {
        followers: 1250,
        engagement: 4.5,
        reach: 15000,
        impressions: 45000
      },
      trends: [
        { name: 'Followers', direction: 'up', value: '+12%' },
        { name: 'Engagement', direction: 'stable', value: '0%' }
      ],
      insights: [
        'Best posting time: 2:30 PM EST',
        'Top performing content: Educational threads'
      ],
      timePeriod: 'Last 7 days',
      lastUpdated: new Date().toLocaleString(),
      timestamp: new Date()
    };

    webSocketClientIntegration.emit('analytics:update', analyticsEvent);
    console.log('📊 Analytics event with metrics dashboard sent');

    // Demo rate limit warning with usage chart
    const rateLimitEvent = {
      accountId: 'demo_account_001',
      accountHandle: 'crypto_educator',
      remaining: 25,
      total: 100,
      resetTime: new Date(Date.now() + 3600000).toLocaleString(),
      recommendation: 'Pause automation for 30 minutes',
      timestamp: new Date()
    };

    webSocketClientIntegration.emit('rate_limit:warning', rateLimitEvent);
    console.log('⚠️ Rate limit warning with usage chart sent');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✅ Message formatting and visualizations demo completed');

  } catch (error) {
    console.error('❌ Failed message formatting demo:', error);
    throw error;
  }
}

/**
 * Demo: Priority-Based Routing and Rate Limiting
 */
async function demoPriorityRouting(eventProcessor: RealTimeEventProcessor) {
  console.log('\n🚦 Demo: Priority-Based Routing and Rate Limiting');
  console.log('='.repeat(60));

  try {
    // Send events with different priorities
    const events = [
      {
        type: 'system:status',
        data: { status: 'down', services: ['twikit-service'], alerts: ['Service unavailable'] },
        priority: 'critical'
      },
      {
        type: 'session:health',
        data: { accountId: 'demo_001', health: 'poor', issues: ['authentication_failed'] },
        priority: 'high'
      },
      {
        type: 'analytics:update',
        data: { metrics: { engagement: 3.2 }, trends: [] },
        priority: 'normal'
      },
      {
        type: 'campaign:progress',
        data: { campaignId: 'demo_002', progress: 10 },
        priority: 'low'
      }
    ];

    console.log('📤 Sending events with different priorities...');

    for (const event of events) {
      const eventName = event.type.replace(':', '_');
      webSocketClientIntegration.emit(eventName, event.data);
      console.log(`   ${event.priority.toUpperCase()}: ${event.type}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Test rate limiting by sending many normal priority events
    console.log('\n📊 Testing rate limiting with burst of normal events...');
    
    for (let i = 0; i < 25; i++) {
      webSocketClientIntegration.emit('analytics:update', {
        metrics: { engagement: Math.random() * 5 },
        timestamp: new Date()
      });
    }

    console.log('📤 Sent 25 analytics events to test rate limiting');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check rate limit status
    const rateLimitStatus = eventProcessor.getUserRateLimitStatus(123); // Demo user ID
    console.log('\n📊 Rate Limit Status:');
    for (const [priority, status] of Object.entries(rateLimitStatus)) {
      const statusObj = status as any;
      console.log(`   ${priority}: ${statusObj.current}/${statusObj.limit} (${statusObj.remaining} remaining)`);
    }

    console.log('✅ Priority-based routing and rate limiting demo completed');

  } catch (error) {
    console.error('❌ Failed priority routing demo:', error);
    throw error;
  }
}

/**
 * Demo: Custom Templates and Recommendations
 */
async function demoCustomTemplates(eventProcessor: RealTimeEventProcessor) {
  console.log('\n📝 Demo: Custom Templates and Recommendations');
  console.log('='.repeat(60));

  try {
    // Add custom template
    const customTemplate = `
🎯 **Custom Event Alert**

📊 **Event:** {eventType}
⏰ **Time:** {timestamp}
📈 **Data:** {eventData}

💡 **Custom Recommendations:**
{recommendations}

{actionButtons}
    `.trim();

    eventProcessor.addCustomTemplate('custom_alert', customTemplate);
    console.log('✅ Custom template added');

    // Show available templates
    const templates = eventProcessor.getAvailableTemplates();
    console.log(`📋 Available templates: ${templates.join(', ')}`);

    // Get processing statistics
    const stats = eventProcessor.getProcessingStatistics();
    console.log('\n📊 Processing Statistics:');
    console.log(`   Total Processed: ${stats.totalProcessed}`);
    console.log(`   Total Delivered: ${stats.totalDelivered}`);
    console.log(`   Total Filtered: ${stats.totalFiltered}`);
    console.log(`   Total Deduplicated: ${stats.totalDeduplicated}`);
    console.log(`   Average Processing Time: ${Math.round(stats.averageProcessingTime)}ms`);
    console.log(`   Delivery Success Rate: ${Math.round(stats.deliverySuccessRate * 100)}%`);

    console.log('✅ Custom templates and recommendations demo completed');

  } catch (error) {
    console.error('❌ Failed custom templates demo:', error);
    throw error;
  }
}

/**
 * Main demo execution
 */
async function runRealTimeEventProcessorDemo() {
  try {
    console.log('🚀 Starting Real-time Event Processor Demo');
    console.log('='.repeat(80));

    // Initialize WebSocket client first (dependency)
    await webSocketClientIntegration.initialize();

    // Run all demos
    const eventProcessor = await demoBasicEventProcessing();
    await demoEventFiltering(eventProcessor);
    await demoMessageFormatting(eventProcessor);
    await demoPriorityRouting(eventProcessor);
    await demoCustomTemplates(eventProcessor);

    console.log('\n🎉 Real-time Event Processor Demo completed successfully!');
    console.log('='.repeat(80));

    // Cleanup
    await eventProcessor.shutdown();
    await webSocketClientIntegration.shutdown();

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
export {
  demoBasicEventProcessing,
  demoEventFiltering,
  demoMessageFormatting,
  demoPriorityRouting,
  demoCustomTemplates,
  runRealTimeEventProcessorDemo
};

// Run demo if this file is executed directly
if (require.main === module) {
  runRealTimeEventProcessorDemo();
}
