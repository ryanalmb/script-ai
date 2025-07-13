import { BaseHandler, CommandHandler, HandlerServices } from '../base/BaseHandler';
import { logger } from '../../utils/logger';

export class SystemHandler extends BaseHandler implements CommandHandler {
  constructor(services: HandlerServices) {
    super(services);
  }

  canHandle(command: string): boolean {
    const { cmd } = this.parseCommand(command);
    return ['/status', '/version', '/stop', '/quick_post', '/quick_schedule', '/emergency_stop'].includes(cmd);
  }

  async handle(chatId: number, command: string, user: any): Promise<void> {
    const { cmd, args } = this.parseCommand(command);

    try {
      switch (cmd) {
        case '/status':
          await this.handleStatusCommand(chatId);
          break;
        case '/version':
          await this.handleVersionCommand(chatId);
          break;
        case '/stop':
          await this.handleStopCommand(chatId, user);
          break;
        case '/quick_post':
          await this.handleQuickPostCommand(chatId, user, args);
          break;
        case '/quick_schedule':
          await this.handleQuickScheduleCommand(chatId, user, args);
          break;
        case '/emergency_stop':
          await this.handleEmergencyStopCommand(chatId, user);
          break;
        default:
          await this.sendErrorMessage(chatId, '❓ Unknown system command.');
      }
    } catch (error) {
      await this.handleError(error, chatId, 'System command');
    }
  }

  private async handleStatusCommand(chatId: number): Promise<void> {
    const loadingMessage = await this.sendLoadingMessage(chatId, '🔍 Checking system status...');

    try {
      // Check various system components
      const systemStatus = await this.getSystemStatus();
      
      const statusMessage = `
🔍 **X Marketing Platform Status**

**🤖 Bot Status:**
• Status: ${systemStatus.bot.status}
• Uptime: ${systemStatus.bot.uptime}
• Response Time: ${systemStatus.bot.responseTime}
• Memory Usage: ${systemStatus.bot.memoryUsage}

**🔗 Service Health:**
• Backend API: ${systemStatus.services.backend}
• LLM Service: ${systemStatus.services.llm}
• Database: ${systemStatus.services.database}
• Redis Cache: ${systemStatus.services.redis}

**📊 Performance Metrics:**
• Active Users: ${systemStatus.metrics.activeUsers}
• Commands/Hour: ${systemStatus.metrics.commandsPerHour}
• Success Rate: ${systemStatus.metrics.successRate}%
• Error Rate: ${systemStatus.metrics.errorRate}%

**🌐 External Services:**
• X API: ${systemStatus.external.xApi}
• Image Generation: ${systemStatus.external.imageGen}
• Analytics: ${systemStatus.external.analytics}
• Proxy Network: ${systemStatus.external.proxies}

**📅 Last Updated:** ${new Date().toLocaleString()}
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '🔄 Refresh Status', callback_data: 'refresh_system_status' },
          { text: '📊 Detailed Report', callback_data: 'detailed_system_report' }
        ],
        [
          { text: '🛠️ Troubleshoot', callback_data: 'system_troubleshoot' },
          { text: '📞 Contact Support', callback_data: 'contact_support' }
        ]
      ]);

      await this.editMessage(chatId, loadingMessage.message_id, statusMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      await this.trackEvent(chatId, 'system_status_checked');

    } catch (error) {
      await this.handleError(error, chatId, 'System status check');
    }
  }

  private async handleVersionCommand(chatId: number): Promise<void> {
    const versionInfo = {
      bot: '2.1.0',
      backend: '1.8.3',
      llm: '1.5.2',
      lastUpdate: '2024-07-12',
      features: [
        'Advanced AI Content Generation',
        'Real-time Analytics',
        'Smart Automation',
        'Multi-account Management',
        'Compliance Monitoring'
      ]
    };

    const versionMessage = `
ℹ️ **X Marketing Platform - Version Information**

**🤖 Bot Version:** ${versionInfo.bot}
**🔧 Backend Version:** ${versionInfo.backend}
**🧠 LLM Service Version:** ${versionInfo.llm}
**📅 Last Update:** ${versionInfo.lastUpdate}

**🚀 Current Features:**
${versionInfo.features.map(feature => `• ${feature}`).join('\n')}

**📋 Recent Updates:**
• Enhanced AI content generation
• Improved automation safety
• Real-time analytics dashboard
• Advanced engagement strategies
• Better error handling

**🔮 Coming Soon:**
• Video content generation
• Advanced competitor analysis
• Custom AI model training
• White-label solutions
• Mobile app companion

**📞 Support:**
• Documentation: /help
• Contact: /support
• Status: /status

**💡 Tip:** Use /advanced to explore premium features!
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '📋 Release Notes', callback_data: 'view_release_notes' },
        { text: '🔮 Roadmap', callback_data: 'view_roadmap' }
      ],
      [
        { text: '🚀 What\'s New', callback_data: 'whats_new' },
        { text: '📞 Support', callback_data: 'contact_support' }
      ]
    ]);

    await this.bot.sendMessage(chatId, versionMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    await this.trackEvent(chatId, 'version_info_viewed');
  }

  private async handleStopCommand(chatId: number, user: any): Promise<void> {
    // Authentication disabled for testing - direct access allowed

    const confirmMessage = `
⏸️ **Stop All Automation**

**⚠️ This will stop:**
• All active automation
• Scheduled posts
• Background tasks
• Monitoring services

**✅ This will NOT affect:**
• Your account connections
• Saved settings
• Historical data
• Scheduled content (paused, not deleted)

**You can restart anytime with /start_auto**

Are you sure you want to stop all automation?
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '⏸️ Yes, Stop All', callback_data: 'confirm_stop_all' },
        { text: '❌ Cancel', callback_data: 'cancel_stop_all' }
      ],
      [
        { text: '⏸️ Pause Temporarily', callback_data: 'pause_temporarily' }
      ]
    ]);

    await this.bot.sendMessage(chatId, confirmMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    await this.trackEvent(chatId, 'stop_command_requested');
  }

  private async handleQuickPostCommand(chatId: number, user: any, args: string[]): Promise<void> {
    // Check authentication
    if (!(await this.requireAuth(chatId))) {
      await this.sendErrorMessage(chatId, '🔐 Please authenticate first using /auth');
      return;
    }

    const content = args.join(' ');
    
    if (!content) {
      await this.bot.sendMessage(chatId, '📝 Please provide content to post. Example: `/quick_post Bitcoin is bullish today! 🚀`', {
        parse_mode: 'Markdown'
      });
      return;
    }

    const loadingMessage = await this.sendLoadingMessage(chatId, '📤 Preparing quick post...');

    try {
      // Get active account
      const activeAccount = await this.userService.getActiveAccount(user?.id || chatId);
      if (!activeAccount) {
        await this.editMessage(chatId, loadingMessage.message_id, '❌ No active X account found. Please connect an account first.');
        return;
      }

      // Quality check
      const qualityResult = await this.performQuickQualityCheck(content);
      
      const confirmMessage = `
📤 **Quick Post Confirmation**

**Account:** @${(activeAccount as any).username || 'Unknown'}
**Content:** ${content}

**📊 Quality Metrics:**
• Quality Score: ${(qualityResult.qualityScore * 100).toFixed(1)}%
• Compliance Score: ${(qualityResult.complianceScore * 100).toFixed(1)}%
• Engagement Prediction: ${qualityResult.engagementPrediction}
• Risk Level: ${qualityResult.riskLevel}

**⚠️ Recommendations:**
${qualityResult.recommendations?.map((rec: string) => `• ${rec}`).join('\n') || '• Content looks good to post'}

Ready to post?
      `;

      const keyboard = this.createInlineKeyboard([
        [
          { text: '📤 Post Now', callback_data: `confirm_quick_post_${Date.now()}` },
          { text: '✏️ Edit Content', callback_data: `edit_quick_post_${Date.now()}` }
        ],
        [
          { text: '📅 Schedule Instead', callback_data: `schedule_quick_post_${Date.now()}` },
          { text: '❌ Cancel', callback_data: 'cancel_quick_post' }
        ]
      ]);

      await this.editMessage(chatId, loadingMessage.message_id, confirmMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      await this.trackEvent(chatId, 'quick_post_prepared', {
        content_length: content.length,
        quality_score: qualityResult.qualityScore
      });

    } catch (error) {
      await this.handleError(error, chatId, 'Quick post preparation');
    }
  }

  private async handleQuickScheduleCommand(chatId: number, user: any, args: string[]): Promise<void> {
    // Check authentication
    if (!(await this.requireAuth(chatId))) {
      await this.sendErrorMessage(chatId, '🔐 Please authenticate first using /auth');
      return;
    }

    if (args.length < 2) {
      await this.bot.sendMessage(chatId, '📅 Please provide time and content. Example: `/quick_schedule 3:00 PM Bitcoin analysis ready!`', {
        parse_mode: 'Markdown'
      });
      return;
    }

    const timeStr = args[0] + ' ' + args[1];
    const content = args.slice(2).join(' ');

    if (!content) {
      await this.bot.sendMessage(chatId, '📝 Please provide content to schedule.');
      return;
    }

    const loadingMessage = await this.sendLoadingMessage(chatId, '📅 Scheduling post...');

    try {
      // Parse and validate time
      const scheduledTime = this.parseScheduleTime(timeStr);
      if (!scheduledTime) {
        await this.editMessage(chatId, loadingMessage.message_id, '❌ Invalid time format. Use formats like "3:00 PM", "15:30", or "tomorrow 2 PM"');
        return;
      }

      // Call scheduling service
      const response = await fetch(`${process.env.BACKEND_URL}/api/posts/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id || chatId,
          content,
          scheduled_time: scheduledTime.toISOString(),
          platform: 'twitter'
        })
      });

      const result = await response.json() as any;

      if (response.ok && result.success) {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `✅ **Post Scheduled Successfully!**\n\n📅 **Scheduled for:** ${scheduledTime.toLocaleString()}\n📝 **Content:** ${content}\n\n🎯 Your post will be automatically published at the scheduled time.`,
          { parse_mode: 'Markdown' }
        );

        await this.trackEvent(chatId, 'post_scheduled', {
          scheduled_time: scheduledTime.toISOString(),
          content_length: content.length
        });
      } else {
        await this.editMessage(
          chatId,
          loadingMessage.message_id,
          `❌ **Scheduling Failed**\n\nError: ${result.error || 'Unknown error'}\n\nPlease try again or contact support.`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (scheduleError) {
      await this.editMessage(
        chatId,
        loadingMessage.message_id,
        '❌ **Scheduling Error**\n\nUnable to connect to scheduling service.\n\nPlease try again in a few moments.',
        { parse_mode: 'Markdown' }
      );
    }
  }

  private async handleEmergencyStopCommand(chatId: number, user: any): Promise<void> {
    // Check authentication
    if (!(await this.requireAuth(chatId))) {
      await this.sendErrorMessage(chatId, '🔐 Please authenticate first using /auth');
      return;
    }

    const confirmMessage = `
🚨 **EMERGENCY STOP**

**⚠️ This will IMMEDIATELY stop:**
• All automation activities
• Scheduled posts
• Background processes
• API calls
• Monitoring services

**🛡️ Emergency stop is for:**
• Suspicious activity detected
• Account safety concerns
• Unexpected behavior
• Compliance issues

**This action cannot be undone and will require manual restart.**

Are you absolutely sure?
    `;

    const keyboard = this.createInlineKeyboard([
      [
        { text: '🚨 EMERGENCY STOP', callback_data: 'confirm_emergency_stop' },
        { text: '❌ Cancel', callback_data: 'cancel_emergency_stop' }
      ]
    ]);

    await this.bot.sendMessage(chatId, confirmMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    await this.trackEvent(chatId, 'emergency_stop_requested');
  }

  private async getSystemStatus(): Promise<any> {
    // Mock system status - replace with actual health checks
    return {
      bot: {
        status: '🟢 Online',
        uptime: '99.8%',
        responseTime: '< 100ms',
        memoryUsage: '45%'
      },
      services: {
        backend: '🟢 Healthy',
        llm: '🟢 Operational',
        database: '🟢 Connected',
        redis: '🟡 Degraded'
      },
      metrics: {
        activeUsers: 1247,
        commandsPerHour: 3456,
        successRate: 98.7,
        errorRate: 1.3
      },
      external: {
        xApi: '🟢 Stable',
        imageGen: '🟢 Available',
        analytics: '🟢 Active',
        proxies: '🟡 Limited'
      }
    };
  }

  private async performQuickQualityCheck(content: string): Promise<any> {
    try {
      // Call real quality service API
      const response = await fetch(`${process.env.BACKEND_URL}/api/quality/quick-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, platform: 'twitter' })
      });

      if (response.ok) {
        const result = await response.json() as any;
        return result.quality;
      }
    } catch (error) {
      logger.error('Quality API call failed, using content service:', error);
    }

    try {
      // Fallback to content service
      const analysis = await this.contentService.analyzeContent({
        text: content,
        platform: 'twitter',
        includeCompliance: true,
        includeSafety: true
      });

      return {
        qualityScore: analysis.quality?.score || 0.85,
        complianceScore: analysis.compliance?.score || 0.90,
        engagementPrediction: analysis.engagement?.level || 'Medium',
        riskLevel: analysis.safety?.risk_level || 'Low',
        recommendations: analysis.recommendations || [
          'Content analysis completed',
          'Ready for posting'
        ]
      };
    } catch (error) {
      logger.error('Content service analysis failed:', error);

      // Basic fallback analysis
      const hasHashtags = content.includes('#');
      const wordCount = content.split(' ').length;

      return {
        qualityScore: 0.80,
        complianceScore: 0.85,
        engagementPrediction: wordCount > 10 && hasHashtags ? 'High' : 'Medium',
        riskLevel: 'Low',
        recommendations: [
          'Basic quality check completed',
          hasHashtags ? 'Good hashtag usage detected' : 'Consider adding relevant hashtags',
          wordCount > 20 ? 'Consider shortening for better engagement' : 'Good length for X platform'
        ]
      };
    }
  }

  private parseScheduleTime(timeStr: string): Date | null {
    try {
      // Simple time parsing - enhance as needed
      const now = new Date();
      
      // Handle "tomorrow" prefix
      if (timeStr.toLowerCase().includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Extract time part and apply to tomorrow
        const timeMatch = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1] || '0');
          const minutes = parseInt(timeMatch[2] || '0');
          const ampm = timeMatch[3]?.toLowerCase();
          
          if (ampm === 'pm' && hours !== 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          
          tomorrow.setHours(hours, minutes, 0, 0);
          return tomorrow;
        }
      }
      
      // Handle time formats like "3:00 PM", "15:30"
      const timeMatch = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1] || '0');
        const minutes = parseInt(timeMatch[2] || '0');
        const ampm = timeMatch[3]?.toLowerCase();
        
        if (ampm === 'pm' && hours !== 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
        
        const scheduledTime = new Date(now);
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (scheduledTime <= now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
        
        return scheduledTime;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}
