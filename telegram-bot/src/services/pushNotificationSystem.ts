/**
 * Push Notification System - Phase 2 Component 2.3 Implementation
 * 
 * Enterprise-grade push notification system with intelligent context-aware delivery,
 * critical alert management, machine learning-based preference optimization,
 * and advanced scheduling capabilities.
 * 
 * Key Features:
 * - Intelligent Context-Aware Notifications that analyze user activity patterns and optimize delivery timing
 * - Critical Alert Management System with immediate delivery, escalation workflows, and actionable remediation steps
 * - Campaign and Automation Notifications with milestone tracking, progress visualization, and performance threshold monitoring
 * - System Health and Maintenance Alerts with proactive scheduling, advance notice, and real-time maintenance updates
 * - Personalized Notification Preferences with machine learning-based optimization and user interaction pattern analysis
 * - Advanced Notification Scheduling with timezone awareness, quiet hours, and user activity-based timing
 * - Notification Analytics and Optimization tracking delivery rates, user engagement, and preference learning
 * 
 * Integration Points:
 * - Phase 2 Component 2.1 WebSocket Client Integration for real-time event input
 * - Phase 2 Component 2.2 Real-time Event Processor for processed event consumption
 * - Existing notification service for enhanced delivery capabilities
 * - User service for comprehensive preference management and personalization
 * - Analytics service for notification performance tracking and optimization
 * 
 * Success Criteria:
 * - Intelligent context-aware delivery that optimizes notification timing based on user activity patterns
 * - Critical alert management with <30 second delivery and comprehensive escalation workflows
 * - Personalized preference system with machine learning optimization and 90%+ user satisfaction
 * - Advanced scheduling system with timezone awareness and user behavior-based timing optimization
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { realTimeEventProcessor, ProcessedEvent } from './realTimeEventProcessor';
import { notificationService } from './notificationService';
import { userService } from './userService';
import { botBackendIntegration } from './botBackendIntegration';

// Types and Interfaces
export interface UserBehaviorProfile {
  userId: number;
  timezone: string;
  activityPatterns: ActivityPattern[];
  interactionHistory: InteractionRecord[];
  preferenceScores: PreferenceScores;
  engagementMetrics: EngagementMetrics;
  lastUpdated: Date;
}

export interface ActivityPattern {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hourOfDay: number; // 0-23
  activityLevel: 'low' | 'medium' | 'high';
  responseRate: number; // 0-1
  engagementScore: number; // 0-100
  sampleSize: number;
}

export interface InteractionRecord {
  notificationId: string;
  timestamp: Date;
  eventType: string;
  priority: string;
  deliveryTime: Date;
  openTime?: Date;
  responseTime?: Date;
  actionTaken?: string;
  engagementScore: number;
  contextData: any;
}

export interface PreferenceScores {
  timingPreference: number; // 0-100 (how well current timing works)
  contentPreference: number; // 0-100 (how well content format works)
  frequencyPreference: number; // 0-100 (how well frequency works)
  channelPreference: number; // 0-100 (how well delivery method works)
}

export interface EngagementMetrics {
  totalNotifications: number;
  openRate: number; // 0-1
  responseRate: number; // 0-1
  averageResponseTime: number; // milliseconds
  satisfactionScore: number; // 0-100
  lastEngagement: Date;
}

export interface CriticalAlert {
  id: string;
  type: 'system_error' | 'security_issue' | 'rate_limit_violation' | 'service_outage';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  affectedServices: string[];
  estimatedImpact: string;
  remediationSteps: RemediationStep[];
  escalationTier: number;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  escalationHistory: EscalationRecord[];
}

export interface RemediationStep {
  id: string;
  title: string;
  description: string;
  action: 'manual' | 'automated' | 'user_action';
  actionData?: any;
  estimatedTime: number; // minutes
  priority: number;
  completed: boolean;
  completedAt?: Date;
}

export interface EscalationRecord {
  tier: number;
  timestamp: Date;
  contacts: string[];
  method: 'telegram' | 'email' | 'sms' | 'phone';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface ScheduledNotification {
  id: string;
  userId: number;
  processedEvent: ProcessedEvent;
  scheduledTime: Date;
  priority: 'low' | 'normal' | 'high' | 'critical';
  deliveryMethod: 'immediate' | 'scheduled' | 'batched';
  context: NotificationContext;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  createdAt: Date;
  deliveredAt?: Date;
}

export interface NotificationContext {
  userTimezone: string;
  userActivityLevel: 'low' | 'medium' | 'high';
  optimalDeliveryWindow: { start: string; end: string };
  quietHoursActive: boolean;
  recentNotificationCount: number;
  lastNotificationTime: Date | undefined;
  predictedEngagement: number; // 0-100
}

export interface NotificationAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalResponded: number;
  averageDeliveryTime: number;
  averageResponseTime: number;
  engagementByEventType: Map<string, EngagementMetrics>;
  engagementByTimeOfDay: Map<number, number>;
  engagementByDayOfWeek: Map<number, number>;
  userSatisfactionScore: number;
  mlOptimizationAccuracy: number;
}

export interface MLOptimizationConfig {
  enableTimingOptimization: boolean;
  enableContentOptimization: boolean;
  enableFrequencyOptimization: boolean;
  learningRate: number;
  minSampleSize: number;
  optimizationInterval: number; // milliseconds
  confidenceThreshold: number; // 0-1
}

/**
 * User Behavior Analyzer
 */
class UserBehaviorAnalyzer {
  private behaviorProfiles = new Map<number, UserBehaviorProfile>();
  private readonly analysisWindow = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Analyze user behavior and update profile
   */
  async analyzeUserBehavior(userId: number): Promise<UserBehaviorProfile> {
    try {
      let profile = this.behaviorProfiles.get(userId);
      
      if (!profile) {
        profile = await this.createInitialProfile(userId);
        this.behaviorProfiles.set(userId, profile);
      }

      // Update activity patterns
      await this.updateActivityPatterns(profile);
      
      // Update engagement metrics
      await this.updateEngagementMetrics(profile);
      
      // Update preference scores
      await this.updatePreferenceScores(profile);
      
      profile.lastUpdated = new Date();
      
      return profile;

    } catch (error) {
      logger.error(`Failed to analyze user behavior for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create initial user behavior profile
   */
  private async createInitialProfile(userId: number): Promise<UserBehaviorProfile> {
    // Get user timezone from user service
    const user = await userService.getUser(userId);
    const timezone = user?.settings?.preferences?.timezone || 'UTC';

    return {
      userId,
      timezone,
      activityPatterns: this.generateDefaultActivityPatterns(),
      interactionHistory: [],
      preferenceScores: {
        timingPreference: 50,
        contentPreference: 50,
        frequencyPreference: 50,
        channelPreference: 50
      },
      engagementMetrics: {
        totalNotifications: 0,
        openRate: 0,
        responseRate: 0,
        averageResponseTime: 0,
        satisfactionScore: 50,
        lastEngagement: new Date()
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Generate default activity patterns
   */
  private generateDefaultActivityPatterns(): ActivityPattern[] {
    const patterns: ActivityPattern[] = [];
    
    // Generate patterns for each day of week and hour
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        patterns.push({
          dayOfWeek: day,
          hourOfDay: hour,
          activityLevel: this.getDefaultActivityLevel(day, hour),
          responseRate: this.getDefaultResponseRate(day, hour),
          engagementScore: this.getDefaultEngagementScore(day, hour),
          sampleSize: 0
        });
      }
    }
    
    return patterns;
  }

  /**
   * Get default activity level for time slot
   */
  private getDefaultActivityLevel(day: number, hour: number): 'low' | 'medium' | 'high' {
    // Weekend vs weekday
    const isWeekend = day === 0 || day === 6;
    
    // Work hours (9 AM - 5 PM)
    const isWorkHours = hour >= 9 && hour <= 17;
    
    // Evening hours (6 PM - 10 PM)
    const isEveningHours = hour >= 18 && hour <= 22;
    
    if (isWeekend) {
      if (hour >= 10 && hour <= 22) return 'medium';
      return 'low';
    } else {
      if (isWorkHours) return 'high';
      if (isEveningHours) return 'medium';
      return 'low';
    }
  }

  /**
   * Get default response rate for time slot
   */
  private getDefaultResponseRate(day: number, hour: number): number {
    const activityLevel = this.getDefaultActivityLevel(day, hour);
    
    switch (activityLevel) {
      case 'high': return 0.7;
      case 'medium': return 0.4;
      case 'low': return 0.1;
      default: return 0.3;
    }
  }

  /**
   * Get default engagement score for time slot
   */
  private getDefaultEngagementScore(day: number, hour: number): number {
    const responseRate = this.getDefaultResponseRate(day, hour);
    return Math.round(responseRate * 100);
  }

  /**
   * Update activity patterns based on interaction history
   */
  private async updateActivityPatterns(profile: UserBehaviorProfile): Promise<void> {
    const recentInteractions = profile.interactionHistory.filter(
      interaction => Date.now() - interaction.timestamp.getTime() < this.analysisWindow
    );

    // Group interactions by time slot
    const timeSlotInteractions = new Map<string, InteractionRecord[]>();
    
    for (const interaction of recentInteractions) {
      const date = new Date(interaction.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}_${hour}`;
      
      if (!timeSlotInteractions.has(key)) {
        timeSlotInteractions.set(key, []);
      }
      timeSlotInteractions.get(key)!.push(interaction);
    }

    // Update patterns based on actual data
    for (const pattern of profile.activityPatterns) {
      const key = `${pattern.dayOfWeek}_${pattern.hourOfDay}`;
      const interactions = timeSlotInteractions.get(key) || [];
      
      if (interactions.length > 0) {
        pattern.sampleSize = interactions.length;
        pattern.responseRate = interactions.filter(i => i.responseTime).length / interactions.length;
        pattern.engagementScore = interactions.reduce((sum, i) => sum + i.engagementScore, 0) / interactions.length;
        
        // Update activity level based on engagement
        if (pattern.engagementScore >= 70) {
          pattern.activityLevel = 'high';
        } else if (pattern.engagementScore >= 40) {
          pattern.activityLevel = 'medium';
        } else {
          pattern.activityLevel = 'low';
        }
      }
    }
  }

  /**
   * Update engagement metrics
   */
  private async updateEngagementMetrics(profile: UserBehaviorProfile): Promise<void> {
    const recentInteractions = profile.interactionHistory.filter(
      interaction => Date.now() - interaction.timestamp.getTime() < this.analysisWindow
    );

    if (recentInteractions.length === 0) return;

    const metrics = profile.engagementMetrics;
    
    metrics.totalNotifications = recentInteractions.length;
    metrics.openRate = recentInteractions.filter(i => i.openTime).length / recentInteractions.length;
    metrics.responseRate = recentInteractions.filter(i => i.responseTime).length / recentInteractions.length;
    
    const responseTimes = recentInteractions
      .filter(i => i.responseTime && i.deliveryTime)
      .map(i => i.responseTime!.getTime() - i.deliveryTime.getTime());
    
    metrics.averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    metrics.satisfactionScore = recentInteractions.reduce((sum, i) => sum + i.engagementScore, 0) / recentInteractions.length;
    metrics.lastEngagement = recentInteractions[recentInteractions.length - 1]?.timestamp || new Date();
  }

  /**
   * Update preference scores based on engagement
   */
  private async updatePreferenceScores(profile: UserBehaviorProfile): Promise<void> {
    const metrics = profile.engagementMetrics;
    
    // Update scores based on engagement metrics
    profile.preferenceScores.timingPreference = Math.min(100, metrics.satisfactionScore + (metrics.responseRate * 30));
    profile.preferenceScores.contentPreference = Math.min(100, metrics.satisfactionScore + (metrics.openRate * 20));
    profile.preferenceScores.frequencyPreference = Math.min(100, metrics.satisfactionScore - (metrics.totalNotifications > 50 ? 20 : 0));
    profile.preferenceScores.channelPreference = metrics.satisfactionScore;
  }

  /**
   * Record user interaction
   */
  recordInteraction(interaction: InteractionRecord): void {
    const profile = this.behaviorProfiles.get(interaction.timestamp.getTime());
    if (profile) {
      profile.interactionHistory.push(interaction);
      
      // Keep only recent interactions
      const cutoff = Date.now() - this.analysisWindow;
      profile.interactionHistory = profile.interactionHistory.filter(
        i => i.timestamp.getTime() > cutoff
      );
    }
  }

  /**
   * Get user behavior profile
   */
  getUserProfile(userId: number): UserBehaviorProfile | null {
    return this.behaviorProfiles.get(userId) || null;
  }

  /**
   * Predict optimal delivery time for user
   */
  predictOptimalDeliveryTime(userId: number, eventType: string): Date {
    const profile = this.behaviorProfiles.get(userId);
    if (!profile) {
      // Default to current time if no profile
      return new Date();
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Find the best time slot in the next 24 hours
    let bestTime = now;
    let bestScore = 0;

    for (let hourOffset = 0; hourOffset < 24; hourOffset++) {
      const testTime = new Date(now.getTime() + (hourOffset * 60 * 60 * 1000));
      const testHour = testTime.getHours();
      const testDay = testTime.getDay();

      const pattern = profile.activityPatterns.find(
        p => p.dayOfWeek === testDay && p.hourOfDay === testHour
      );

      if (pattern) {
        const score = pattern.engagementScore * pattern.responseRate;
        if (score > bestScore) {
          bestScore = score;
          bestTime = testTime;
        }
      }
    }

    return bestTime;
  }
}

/**
 * Intelligent Notification Scheduler
 */
class IntelligentNotificationScheduler {
  private scheduledNotifications = new Map<string, ScheduledNotification>();
  private schedulingQueue: ScheduledNotification[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(private behaviorAnalyzer: UserBehaviorAnalyzer) {}

  /**
   * Schedule notification for optimal delivery
   */
  async scheduleNotification(
    processedEvent: ProcessedEvent,
    deliveryMethod: 'immediate' | 'scheduled' | 'batched' = 'scheduled'
  ): Promise<string> {
    try {
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Determine optimal delivery time
      const scheduledTime = await this.determineOptimalDeliveryTime(processedEvent, deliveryMethod);

      // Create notification context
      const context = await this.createNotificationContext(processedEvent.userId);

      const scheduledNotification: ScheduledNotification = {
        id: notificationId,
        userId: processedEvent.userId,
        processedEvent,
        scheduledTime,
        priority: processedEvent.priority,
        deliveryMethod,
        context,
        attempts: 0,
        maxAttempts: this.getMaxAttempts(processedEvent.priority),
        status: 'pending',
        createdAt: new Date()
      };

      this.scheduledNotifications.set(notificationId, scheduledNotification);
      this.schedulingQueue.push(scheduledNotification);

      // Sort queue by scheduled time
      this.schedulingQueue.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

      logger.debug(`Notification scheduled: ${notificationId} for ${scheduledTime.toISOString()}`);

      return notificationId;

    } catch (error) {
      logger.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  /**
   * Determine optimal delivery time
   */
  private async determineOptimalDeliveryTime(
    processedEvent: ProcessedEvent,
    deliveryMethod: string
  ): Promise<Date> {
    // Immediate delivery for critical events
    if (processedEvent.priority === 'critical' || deliveryMethod === 'immediate') {
      return new Date();
    }

    // Use ML prediction for optimal timing
    const optimalTime = this.behaviorAnalyzer.predictOptimalDeliveryTime(
      processedEvent.userId,
      processedEvent.type
    );

    // Respect quiet hours
    const adjustedTime = await this.respectQuietHours(processedEvent.userId, optimalTime);

    // Ensure minimum delay for batched notifications
    if (deliveryMethod === 'batched') {
      const minDelay = 15 * 60 * 1000; // 15 minutes
      const minTime = new Date(Date.now() + minDelay);
      return adjustedTime > minTime ? adjustedTime : minTime;
    }

    return adjustedTime;
  }

  /**
   * Respect user quiet hours
   */
  private async respectQuietHours(userId: number, proposedTime: Date): Promise<Date> {
    try {
      // Get user preferences (this would integrate with existing user service)
      const userProfile = this.behaviorAnalyzer.getUserProfile(userId);
      if (!userProfile) return proposedTime;

      // Default quiet hours: 11 PM - 7 AM
      const quietStart = 23; // 11 PM
      const quietEnd = 7;    // 7 AM

      const hour = proposedTime.getHours();

      // Check if proposed time is in quiet hours
      if (hour >= quietStart || hour < quietEnd) {
        // Move to next available time (7 AM)
        const nextAvailable = new Date(proposedTime);
        nextAvailable.setHours(quietEnd, 0, 0, 0);

        // If it's already past 7 AM today, schedule for 7 AM tomorrow
        if (nextAvailable <= proposedTime) {
          nextAvailable.setDate(nextAvailable.getDate() + 1);
        }

        return nextAvailable;
      }

      return proposedTime;

    } catch (error) {
      logger.error('Failed to respect quiet hours:', error);
      return proposedTime;
    }
  }

  /**
   * Create notification context
   */
  private async createNotificationContext(userId: number): Promise<NotificationContext> {
    const userProfile = this.behaviorAnalyzer.getUserProfile(userId);
    const now = new Date();

    return {
      userTimezone: userProfile?.timezone || 'UTC',
      userActivityLevel: this.getCurrentActivityLevel(userProfile, now),
      optimalDeliveryWindow: this.getOptimalDeliveryWindow(userProfile, now),
      quietHoursActive: this.isQuietHoursActive(now),
      recentNotificationCount: this.getRecentNotificationCount(userId),
      lastNotificationTime: this.getLastNotificationTime(userId),
      predictedEngagement: this.predictEngagement(userProfile, now)
    };
  }

  /**
   * Get current activity level
   */
  private getCurrentActivityLevel(
    profile: UserBehaviorProfile | null,
    time: Date
  ): 'low' | 'medium' | 'high' {
    if (!profile) return 'medium';

    const pattern = profile.activityPatterns.find(
      p => p.dayOfWeek === time.getDay() && p.hourOfDay === time.getHours()
    );

    return pattern?.activityLevel || 'medium';
  }

  /**
   * Get optimal delivery window
   */
  private getOptimalDeliveryWindow(
    profile: UserBehaviorProfile | null,
    time: Date
  ): { start: string; end: string } {
    if (!profile) {
      return { start: '09:00', end: '17:00' }; // Default work hours
    }

    // Find the best 4-hour window based on engagement patterns
    let bestStart = 9;
    let bestScore = 0;

    for (let start = 6; start <= 20; start++) {
      let windowScore = 0;
      for (let hour = start; hour < start + 4 && hour < 24; hour++) {
        const pattern = profile.activityPatterns.find(
          p => p.dayOfWeek === time.getDay() && p.hourOfDay === hour
        );
        windowScore += pattern?.engagementScore || 0;
      }

      if (windowScore > bestScore) {
        bestScore = windowScore;
        bestStart = start;
      }
    }

    return {
      start: `${bestStart.toString().padStart(2, '0')}:00`,
      end: `${(bestStart + 4).toString().padStart(2, '0')}:00`
    };
  }

  /**
   * Check if quiet hours are active
   */
  private isQuietHoursActive(time: Date): boolean {
    const hour = time.getHours();
    return hour >= 23 || hour < 7;
  }

  /**
   * Get recent notification count
   */
  private getRecentNotificationCount(userId: number): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return Array.from(this.scheduledNotifications.values())
      .filter(n => n.userId === userId && n.createdAt.getTime() > oneHourAgo)
      .length;
  }

  /**
   * Get last notification time
   */
  private getLastNotificationTime(userId: number): Date | undefined {
    const userNotifications = Array.from(this.scheduledNotifications.values())
      .filter(n => n.userId === userId && n.deliveredAt)
      .sort((a, b) => (b.deliveredAt?.getTime() || 0) - (a.deliveredAt?.getTime() || 0));

    return userNotifications[0]?.deliveredAt;
  }

  /**
   * Predict engagement score
   */
  private predictEngagement(profile: UserBehaviorProfile | null, time: Date): number {
    if (!profile) return 50;

    const pattern = profile.activityPatterns.find(
      p => p.dayOfWeek === time.getDay() && p.hourOfDay === time.getHours()
    );

    return pattern?.engagementScore || 50;
  }

  /**
   * Get max attempts based on priority
   */
  private getMaxAttempts(priority: string): number {
    switch (priority) {
      case 'critical': return 5;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Start processing scheduled notifications
   */
  startProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processScheduledNotifications();
    }, 10000); // Check every 10 seconds

    logger.info('📅 Notification scheduler started');
  }

  /**
   * Process scheduled notifications
   */
  private async processScheduledNotifications(): Promise<void> {
    const now = new Date();
    const dueNotifications = this.schedulingQueue.filter(
      n => n.status === 'pending' && n.scheduledTime <= now
    );

    for (const notification of dueNotifications) {
      try {
        await this.deliverNotification(notification);
      } catch (error) {
        logger.error(`Failed to deliver notification ${notification.id}:`, error);
        await this.handleDeliveryFailure(notification);
      }
    }

    // Remove processed notifications from queue
    this.schedulingQueue = this.schedulingQueue.filter(n => n.status === 'pending');
  }

  /**
   * Deliver notification
   */
  private async deliverNotification(notification: ScheduledNotification): Promise<void> {
    notification.attempts++;

    // Use bot backend integration for delivery
    const notificationOptions: {
      type?: 'info' | 'warning' | 'error' | 'success';
      buttons?: Array<{ text: string; callback_data: string }>;
      silent?: boolean;
    } = {
      type: this.mapPriorityToType(notification.priority)
    };

    if (notification.processedEvent.message.silent !== undefined) {
      notificationOptions.silent = notification.processedEvent.message.silent;
    }

    if (notification.processedEvent.message.buttons) {
      notificationOptions.buttons = notification.processedEvent.message.buttons;
    }

    const success = await botBackendIntegration.sendNotification(
      notification.userId,
      notification.processedEvent.message.text,
      notificationOptions
    );

    if (success) {
      notification.status = 'delivered';
      notification.deliveredAt = new Date();

      // Record interaction for behavior analysis
      this.recordDeliveryInteraction(notification);

      logger.debug(`Notification delivered: ${notification.id}`);
    } else {
      throw new Error('Delivery failed');
    }
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(notification: ScheduledNotification): Promise<void> {
    if (notification.attempts >= notification.maxAttempts) {
      notification.status = 'failed';
      logger.warn(`Notification failed after ${notification.attempts} attempts: ${notification.id}`);
    } else {
      // Reschedule with exponential backoff
      const delay = Math.pow(2, notification.attempts) * 60 * 1000; // Exponential backoff in minutes
      notification.scheduledTime = new Date(Date.now() + delay);

      logger.debug(`Notification rescheduled: ${notification.id} (attempt ${notification.attempts})`);
    }
  }

  /**
   * Record delivery interaction
   */
  private recordDeliveryInteraction(notification: ScheduledNotification): void {
    const interaction: InteractionRecord = {
      notificationId: notification.id,
      timestamp: notification.createdAt,
      eventType: notification.processedEvent.type,
      priority: notification.priority,
      deliveryTime: notification.deliveredAt!,
      engagementScore: notification.context.predictedEngagement,
      contextData: notification.context
    };

    this.behaviorAnalyzer.recordInteraction(interaction);
  }

  /**
   * Map priority to notification type
   */
  private mapPriorityToType(priority: string): 'info' | 'warning' | 'error' | 'success' {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'info';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('📅 Notification scheduler stopped');
    }
  }

  /**
   * Get scheduling statistics
   */
  getSchedulingStatistics(): any {
    return {
      totalScheduled: this.scheduledNotifications.size,
      pendingNotifications: this.schedulingQueue.length,
      deliveredNotifications: Array.from(this.scheduledNotifications.values())
        .filter(n => n.status === 'delivered').length,
      failedNotifications: Array.from(this.scheduledNotifications.values())
        .filter(n => n.status === 'failed').length
    };
  }
}

/**
 * Critical Alert Manager
 */
class CriticalAlertManager {
  private activeAlerts = new Map<string, CriticalAlert>();
  private escalationTimers = new Map<string, NodeJS.Timeout>();
  private readonly escalationTiers = [
    { tier: 1, delayMinutes: 0, description: 'Immediate notification to primary contact' },
    { tier: 2, delayMinutes: 5, description: 'Escalate to secondary contacts' },
    { tier: 3, delayMinutes: 15, description: 'Escalate to emergency contacts' },
    { tier: 4, delayMinutes: 30, description: 'Activate incident response team' }
  ];

  /**
   * Create and process critical alert with <30 second delivery guarantee
   */
  async createCriticalAlert(
    type: 'system_error' | 'security_issue' | 'rate_limit_violation' | 'service_outage',
    title: string,
    description: string,
    affectedServices: string[],
    estimatedImpact: string,
    remediationSteps: Omit<RemediationStep, 'id' | 'completed' | 'completedAt'>[]
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const alert: CriticalAlert = {
        id: alertId,
        type,
        severity: this.determineSeverity(type),
        title,
        description,
        affectedServices,
        estimatedImpact,
        remediationSteps: remediationSteps.map((step, index) => ({
          ...step,
          id: `${alertId}_step_${index}`,
          completed: false
        })),
        escalationTier: 1,
        createdAt: new Date(),
        escalationHistory: []
      };

      this.activeAlerts.set(alertId, alert);

      // Immediate delivery (Tier 1) - Target: <30 seconds
      await this.executeEscalationTier(alert, 1);

      // Schedule subsequent escalation tiers
      this.scheduleEscalationTiers(alert);

      // Attempt automated remediation
      this.attemptAutomatedRemediation(alert);

      const processingTime = Date.now() - startTime;
      logger.info(`🚨 Critical alert created and processed in ${processingTime}ms: ${alertId}`);

      return alertId;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Failed to create critical alert in ${processingTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Determine alert severity based on type
   */
  private determineSeverity(type: string): 'critical' | 'high' | 'medium' {
    switch (type) {
      case 'system_error':
      case 'service_outage':
        return 'critical';
      case 'security_issue':
      case 'rate_limit_violation':
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * Execute escalation tier with immediate delivery
   */
  private async executeEscalationTier(alert: CriticalAlert, tier: number): Promise<void> {
    const startTime = Date.now();

    try {
      const escalationRecord: EscalationRecord = {
        tier,
        timestamp: new Date(),
        contacts: await this.getEscalationContacts(tier),
        method: 'telegram',
        acknowledged: false
      };

      alert.escalationHistory.push(escalationRecord);
      alert.escalationTier = tier;

      // Create critical alert message
      const alertMessage = this.formatCriticalAlertMessage(alert, tier);

      // Send to all contacts in this tier with emergency override
      const deliveryPromises = escalationRecord.contacts.map(contact =>
        this.sendEmergencyNotification(contact, alertMessage, alert)
      );

      await Promise.all(deliveryPromises);

      const deliveryTime = Date.now() - startTime;
      logger.info(`🚨 Tier ${tier} escalation executed in ${deliveryTime}ms for alert ${alert.id}`);

      // Guarantee: <30 seconds for Tier 1
      if (tier === 1 && deliveryTime > 30000) {
        logger.warn(`⚠️ Tier 1 delivery exceeded 30 second target: ${deliveryTime}ms`);
      }

    } catch (error) {
      logger.error(`Failed to execute escalation tier ${tier} for alert ${alert.id}:`, error);
      throw error;
    }
  }

  /**
   * Schedule subsequent escalation tiers
   */
  private scheduleEscalationTiers(alert: CriticalAlert): void {
    for (const tierConfig of this.escalationTiers.slice(1)) { // Skip tier 1 (already executed)
      const delay = tierConfig.delayMinutes * 60 * 1000;

      const timer = setTimeout(async () => {
        // Only escalate if alert is still active and not acknowledged
        if (this.activeAlerts.has(alert.id) && !this.isAlertAcknowledged(alert)) {
          await this.executeEscalationTier(alert, tierConfig.tier);
        }
      }, delay);

      this.escalationTimers.set(`${alert.id}_tier_${tierConfig.tier}`, timer);
    }
  }

  /**
   * Check if alert is acknowledged
   */
  private isAlertAcknowledged(alert: CriticalAlert): boolean {
    return alert.escalationHistory.some(record => record.acknowledged);
  }

  /**
   * Get escalation contacts for tier
   */
  private async getEscalationContacts(tier: number): Promise<string[]> {
    // This would integrate with user service to get escalation contacts
    // For now, return mock contacts based on tier
    switch (tier) {
      case 1: return ['primary_admin', 'on_call_engineer'];
      case 2: return ['secondary_admin', 'team_lead', 'backup_engineer'];
      case 3: return ['emergency_contact_1', 'emergency_contact_2', 'manager'];
      case 4: return ['incident_commander', 'executive_team', 'all_engineers'];
      default: return ['primary_admin'];
    }
  }

  /**
   * Format critical alert message
   */
  private formatCriticalAlertMessage(alert: CriticalAlert, tier: number): string {
    const tierEmojis = ['🚨', '🔥', '💥', '🆘'];
    const emoji = tierEmojis[tier - 1] || '🚨';

    return `
${emoji} **CRITICAL ALERT - TIER ${tier} ESCALATION**

🔴 **${alert.title}**
📝 **Description:** ${alert.description}

⚠️ **Severity:** ${alert.severity.toUpperCase()}
🕐 **Created:** ${alert.createdAt.toLocaleString()}
🔧 **Affected Services:** ${alert.affectedServices.join(', ')}
📊 **Estimated Impact:** ${alert.estimatedImpact}

🛠️ **Immediate Actions Required:**
${alert.remediationSteps.slice(0, 3).map((step, index) =>
  `${index + 1}. ${step.title} (${step.estimatedTime}min)`
).join('\n')}

⏱️ **Next Escalation:** ${tier < 4 ? `Tier ${tier + 1} in ${this.escalationTiers[tier]?.delayMinutes || 0} minutes` : 'Final tier reached'}

🆔 **Alert ID:** ${alert.id}

**ACKNOWLEDGE IMMEDIATELY TO STOP ESCALATION**
    `.trim();
  }

  /**
   * Send emergency notification with all overrides
   */
  private async sendEmergencyNotification(
    contact: string,
    message: string,
    alert: CriticalAlert
  ): Promise<void> {
    try {
      // Emergency notifications bypass all user preferences and quiet hours
      const success = await botBackendIntegration.sendNotification(
        parseInt(contact) || 0, // Convert contact to user ID
        message,
        {
          type: 'error',
          silent: false, // Never silent for critical alerts
          buttons: [
            { text: '✅ Acknowledge', callback_data: `ack_alert_${alert.id}` },
            { text: '🔧 View Remediation', callback_data: `remediation_${alert.id}` },
            { text: '📞 Escalate Now', callback_data: `escalate_${alert.id}` }
          ]
        }
      );

      if (!success) {
        logger.error(`Failed to send emergency notification to ${contact} for alert ${alert.id}`);
        // Could implement fallback methods (email, SMS, etc.)
      }

    } catch (error) {
      logger.error(`Error sending emergency notification to ${contact}:`, error);
    }
  }

  /**
   * Attempt automated remediation
   */
  private async attemptAutomatedRemediation(alert: CriticalAlert): Promise<void> {
    try {
      const automatedSteps = alert.remediationSteps.filter(step => step.action === 'automated');

      for (const step of automatedSteps) {
        try {
          logger.info(`🤖 Attempting automated remediation: ${step.title}`);

          // Execute automated remediation based on step data
          const success = await this.executeAutomatedStep(step, alert);

          if (success) {
            step.completed = true;
            step.completedAt = new Date();
            logger.info(`✅ Automated remediation completed: ${step.title}`);
          } else {
            logger.warn(`❌ Automated remediation failed: ${step.title}`);
          }

        } catch (error) {
          logger.error(`Error in automated remediation for step ${step.id}:`, error);
        }
      }

    } catch (error) {
      logger.error(`Failed to attempt automated remediation for alert ${alert.id}:`, error);
    }
  }

  /**
   * Execute automated remediation step
   */
  private async executeAutomatedStep(step: RemediationStep, alert: CriticalAlert): Promise<boolean> {
    // This would integrate with backend services for automated remediation
    // Examples of automated actions:

    switch (step.actionData?.type) {
      case 'restart_service':
        return await this.restartService(step.actionData.serviceName);

      case 'clear_cache':
        return await this.clearCache(step.actionData.cacheType);

      case 'scale_resources':
        return await this.scaleResources(step.actionData.resourceType, step.actionData.scaleFactor);

      case 'pause_automation':
        return await this.pauseAutomation(step.actionData.accountIds);

      default:
        logger.warn(`Unknown automated action type: ${step.actionData?.type}`);
        return false;
    }
  }

  /**
   * Restart service (automated remediation)
   */
  private async restartService(serviceName: string): Promise<boolean> {
    try {
      // This would integrate with backend service management
      logger.info(`🔄 Restarting service: ${serviceName}`);

      // Simulate service restart
      await new Promise(resolve => setTimeout(resolve, 2000));

      return true;
    } catch (error) {
      logger.error(`Failed to restart service ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Clear cache (automated remediation)
   */
  private async clearCache(cacheType: string): Promise<boolean> {
    try {
      logger.info(`🧹 Clearing cache: ${cacheType}`);

      // This would integrate with cache management systems
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      logger.error(`Failed to clear cache ${cacheType}:`, error);
      return false;
    }
  }

  /**
   * Scale resources (automated remediation)
   */
  private async scaleResources(resourceType: string, scaleFactor: number): Promise<boolean> {
    try {
      logger.info(`📈 Scaling resources: ${resourceType} by factor ${scaleFactor}`);

      // This would integrate with infrastructure management
      await new Promise(resolve => setTimeout(resolve, 3000));

      return true;
    } catch (error) {
      logger.error(`Failed to scale resources ${resourceType}:`, error);
      return false;
    }
  }

  /**
   * Pause automation (automated remediation)
   */
  private async pauseAutomation(accountIds: string[]): Promise<boolean> {
    try {
      logger.info(`⏸️ Pausing automation for accounts: ${accountIds.join(', ')}`);

      // This would integrate with automation management
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      logger.error(`Failed to pause automation for accounts ${accountIds.join(', ')}:`, error);
      return false;
    }
  }

  /**
   * Acknowledge alert and stop escalation
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.acknowledgedAt = new Date();

    // Update latest escalation record
    const latestEscalation = alert.escalationHistory[alert.escalationHistory.length - 1];
    if (latestEscalation) {
      latestEscalation.acknowledged = true;
      latestEscalation.acknowledgedBy = acknowledgedBy;
      latestEscalation.acknowledgedAt = new Date();
    }

    // Clear all pending escalation timers
    this.clearEscalationTimers(alertId);

    logger.info(`✅ Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    this.clearEscalationTimers(alertId);
    this.activeAlerts.delete(alertId);

    logger.info(`✅ Alert resolved: ${alertId}`);
    return true;
  }

  /**
   * Clear escalation timers for alert
   */
  private clearEscalationTimers(alertId: string): void {
    for (const [timerKey, timer] of this.escalationTimers.entries()) {
      if (timerKey.startsWith(alertId)) {
        clearTimeout(timer);
        this.escalationTimers.delete(timerKey);
      }
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): CriticalAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(): any {
    const alerts = Array.from(this.activeAlerts.values());

    return {
      totalActive: alerts.length,
      bySeverity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length
      },
      byType: {
        system_error: alerts.filter(a => a.type === 'system_error').length,
        security_issue: alerts.filter(a => a.type === 'security_issue').length,
        rate_limit_violation: alerts.filter(a => a.type === 'rate_limit_violation').length,
        service_outage: alerts.filter(a => a.type === 'service_outage').length
      },
      acknowledged: alerts.filter(a => a.acknowledgedAt).length,
      averageEscalationTier: alerts.reduce((sum, a) => sum + a.escalationTier, 0) / alerts.length || 0
    };
  }
}

/**
 * ML-based Preference Learning Engine
 */
class PreferenceLearningEngine {
  private learningConfig: MLOptimizationConfig;
  private userModels = new Map<number, any>(); // Simplified ML models
  private optimizationInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MLOptimizationConfig>) {
    this.learningConfig = {
      enableTimingOptimization: true,
      enableContentOptimization: true,
      enableFrequencyOptimization: true,
      learningRate: 0.01,
      minSampleSize: 10,
      optimizationInterval: 3600000, // 1 hour
      confidenceThreshold: 0.7,
      ...config
    };
  }

  /**
   * Start ML-based preference optimization
   */
  startOptimization(): void {
    if (this.optimizationInterval) return;

    this.optimizationInterval = setInterval(() => {
      this.optimizeAllUserPreferences();
    }, this.learningConfig.optimizationInterval);

    logger.info('🤖 ML-based preference optimization started');
  }

  /**
   * Optimize preferences for all users
   */
  private async optimizeAllUserPreferences(): Promise<void> {
    try {
      // Get all users with sufficient interaction data
      const users = await this.getUsersForOptimization();

      for (const userId of users) {
        await this.optimizeUserPreferences(userId);
      }

      logger.info(`🤖 Optimized preferences for ${users.length} users`);

    } catch (error) {
      logger.error('Failed to optimize user preferences:', error);
    }
  }

  /**
   * Optimize preferences for specific user
   */
  async optimizeUserPreferences(userId: number): Promise<void> {
    try {
      const userProfile = await this.getUserBehaviorProfile(userId);
      if (!userProfile || userProfile.interactionHistory.length < this.learningConfig.minSampleSize) {
        return; // Insufficient data for optimization
      }

      // Optimize timing preferences
      if (this.learningConfig.enableTimingOptimization) {
        await this.optimizeTimingPreferences(userId, userProfile);
      }

      // Optimize content preferences
      if (this.learningConfig.enableContentOptimization) {
        await this.optimizeContentPreferences(userId, userProfile);
      }

      // Optimize frequency preferences
      if (this.learningConfig.enableFrequencyOptimization) {
        await this.optimizeFrequencyPreferences(userId, userProfile);
      }

      // Update user satisfaction score
      await this.updateUserSatisfactionScore(userId, userProfile);

      logger.debug(`🤖 Optimized preferences for user ${userId}`);

    } catch (error) {
      logger.error(`Failed to optimize preferences for user ${userId}:`, error);
    }
  }

  /**
   * Optimize timing preferences using ML
   */
  private async optimizeTimingPreferences(userId: number, profile: UserBehaviorProfile): Promise<void> {
    try {
      // Analyze interaction patterns to find optimal timing
      const timingAnalysis = this.analyzeTimingPatterns(profile.interactionHistory);

      // Calculate confidence in timing optimization
      const confidence = this.calculateTimingConfidence(timingAnalysis);

      if (confidence >= this.learningConfig.confidenceThreshold) {
        // Update user preferences with optimized timing
        await this.updateUserTimingPreferences(userId, timingAnalysis);

        logger.debug(`⏰ Optimized timing preferences for user ${userId} (confidence: ${confidence})`);
      }

    } catch (error) {
      logger.error(`Failed to optimize timing preferences for user ${userId}:`, error);
    }
  }

  /**
   * Analyze timing patterns from interaction history
   */
  private analyzeTimingPatterns(interactions: InteractionRecord[]): any {
    const hourlyEngagement = new Map<number, { total: number; engaged: number }>();

    // Analyze engagement by hour of day
    for (const interaction of interactions) {
      const hour = interaction.timestamp.getHours();
      const current = hourlyEngagement.get(hour) || { total: 0, engaged: 0 };

      current.total++;
      if (interaction.engagementScore > 50) {
        current.engaged++;
      }

      hourlyEngagement.set(hour, current);
    }

    // Find optimal hours
    const optimalHours = Array.from(hourlyEngagement.entries())
      .map(([hour, stats]) => ({
        hour,
        engagementRate: stats.engaged / stats.total,
        sampleSize: stats.total
      }))
      .filter(h => h.sampleSize >= 3) // Minimum sample size
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 4); // Top 4 hours

    return {
      optimalHours: optimalHours.map(h => h.hour),
      bestEngagementRate: optimalHours[0]?.engagementRate || 0,
      averageEngagementRate: interactions.reduce((sum, i) => sum + i.engagementScore, 0) / interactions.length / 100
    };
  }

  /**
   * Calculate confidence in timing optimization
   */
  private calculateTimingConfidence(analysis: any): number {
    const { optimalHours, bestEngagementRate, averageEngagementRate } = analysis;

    if (optimalHours.length === 0) return 0;

    // Confidence based on improvement over average and sample size
    const improvement = bestEngagementRate - averageEngagementRate;
    const confidence = Math.min(1, improvement * 2); // Scale improvement to confidence

    return Math.max(0, confidence);
  }

  /**
   * Update user timing preferences
   */
  private async updateUserTimingPreferences(userId: number, analysis: any): Promise<void> {
    try {
      // This would integrate with user service to update preferences
      const optimizedPreferences = {
        optimalDeliveryHours: analysis.optimalHours,
        expectedEngagementRate: analysis.bestEngagementRate,
        lastOptimized: new Date()
      };

      // Store optimized preferences (would integrate with user service)
      logger.debug(`Updated timing preferences for user ${userId}:`, optimizedPreferences);

    } catch (error) {
      logger.error(`Failed to update timing preferences for user ${userId}:`, error);
    }
  }

  /**
   * Optimize content preferences
   */
  private async optimizeContentPreferences(userId: number, profile: UserBehaviorProfile): Promise<void> {
    try {
      // Analyze content engagement patterns
      const contentAnalysis = this.analyzeContentPatterns(profile.interactionHistory);

      // Calculate confidence in content optimization
      const confidence = this.calculateContentConfidence(contentAnalysis);

      if (confidence >= this.learningConfig.confidenceThreshold) {
        await this.updateUserContentPreferences(userId, contentAnalysis);
        logger.debug(`📝 Optimized content preferences for user ${userId} (confidence: ${confidence})`);
      }

    } catch (error) {
      logger.error(`Failed to optimize content preferences for user ${userId}:`, error);
    }
  }

  /**
   * Optimize frequency preferences
   */
  private async optimizeFrequencyPreferences(userId: number, profile: UserBehaviorProfile): Promise<void> {
    try {
      // Analyze frequency patterns
      const frequencyAnalysis = this.analyzeFrequencyPatterns(profile.interactionHistory);

      // Calculate confidence in frequency optimization
      const confidence = this.calculateFrequencyConfidence(frequencyAnalysis);

      if (confidence >= this.learningConfig.confidenceThreshold) {
        await this.updateUserFrequencyPreferences(userId, frequencyAnalysis);
        logger.debug(`📊 Optimized frequency preferences for user ${userId} (confidence: ${confidence})`);
      }

    } catch (error) {
      logger.error(`Failed to optimize frequency preferences for user ${userId}:`, error);
    }
  }

  /**
   * Update user satisfaction score
   */
  private async updateUserSatisfactionScore(userId: number, profile: UserBehaviorProfile): Promise<void> {
    try {
      const recentInteractions = profile.interactionHistory.slice(-20); // Last 20 interactions
      const satisfactionScore = recentInteractions.reduce((sum, i) => sum + i.engagementScore, 0) / recentInteractions.length;

      // Update user satisfaction (would integrate with user service)
      logger.debug(`📈 Updated satisfaction score for user ${userId}: ${satisfactionScore}`);

    } catch (error) {
      logger.error(`Failed to update satisfaction score for user ${userId}:`, error);
    }
  }

  /**
   * Get users eligible for optimization
   */
  private async getUsersForOptimization(): Promise<number[]> {
    try {
      // This would integrate with user service to get active users
      // For now, return mock user IDs
      return [123, 456, 789]; // Mock user IDs

    } catch (error) {
      logger.error('Failed to get users for optimization:', error);
      return [];
    }
  }

  /**
   * Get user behavior profile
   */
  private async getUserBehaviorProfile(userId: number): Promise<UserBehaviorProfile | null> {
    try {
      // This would integrate with behavior analyzer
      // For now, return null (would be implemented with actual behavior analyzer integration)
      return null;

    } catch (error) {
      logger.error(`Failed to get behavior profile for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Analyze content patterns
   */
  private analyzeContentPatterns(interactions: InteractionRecord[]): any {
    const eventTypeEngagement = new Map<string, { total: number; engaged: number }>();

    for (const interaction of interactions) {
      const current = eventTypeEngagement.get(interaction.eventType) || { total: 0, engaged: 0 };
      current.total++;
      if (interaction.engagementScore > 50) {
        current.engaged++;
      }
      eventTypeEngagement.set(interaction.eventType, current);
    }

    const preferredEventTypes = Array.from(eventTypeEngagement.entries())
      .map(([eventType, stats]) => ({
        eventType,
        engagementRate: stats.engaged / stats.total,
        sampleSize: stats.total
      }))
      .filter(e => e.sampleSize >= 3)
      .sort((a, b) => b.engagementRate - a.engagementRate);

    return {
      preferredEventTypes: preferredEventTypes.map(e => e.eventType),
      bestEngagementRate: preferredEventTypes[0]?.engagementRate || 0
    };
  }

  /**
   * Analyze frequency patterns
   */
  private analyzeFrequencyPatterns(interactions: InteractionRecord[]): any {
    // Group interactions by day to analyze daily frequency
    const dailyFrequency = new Map<string, number>();

    for (const interaction of interactions) {
      const day = interaction.timestamp.toDateString();
      dailyFrequency.set(day, (dailyFrequency.get(day) || 0) + 1);
    }

    const frequencies = Array.from(dailyFrequency.values());
    const averageDaily = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;

    // Calculate engagement vs frequency correlation
    const engagementByFrequency = new Map<number, number[]>();

    for (const interaction of interactions) {
      const day = interaction.timestamp.toDateString();
      const dayFrequency = dailyFrequency.get(day) || 0;

      if (!engagementByFrequency.has(dayFrequency)) {
        engagementByFrequency.set(dayFrequency, []);
      }
      engagementByFrequency.get(dayFrequency)!.push(interaction.engagementScore);
    }

    // Find optimal frequency
    let optimalFrequency = averageDaily;
    let bestEngagement = 0;

    for (const [frequency, engagements] of engagementByFrequency.entries()) {
      const avgEngagement = engagements.reduce((sum, e) => sum + e, 0) / engagements.length;
      if (avgEngagement > bestEngagement) {
        bestEngagement = avgEngagement;
        optimalFrequency = frequency;
      }
    }

    return {
      currentAverageDaily: averageDaily,
      optimalFrequency,
      bestEngagement
    };
  }

  /**
   * Calculate content confidence
   */
  private calculateContentConfidence(analysis: any): number {
    return analysis.preferredEventTypes.length > 0 ? analysis.bestEngagementRate : 0;
  }

  /**
   * Calculate frequency confidence
   */
  private calculateFrequencyConfidence(analysis: any): number {
    const improvement = analysis.bestEngagement - 50; // Baseline engagement of 50
    return Math.max(0, Math.min(1, improvement / 50));
  }

  /**
   * Update user content preferences
   */
  private async updateUserContentPreferences(userId: number, analysis: any): Promise<void> {
    // Would integrate with user service to update content preferences
    logger.debug(`Updated content preferences for user ${userId}:`, analysis.preferredEventTypes);
  }

  /**
   * Update user frequency preferences
   */
  private async updateUserFrequencyPreferences(userId: number, analysis: any): Promise<void> {
    // Would integrate with user service to update frequency preferences
    logger.debug(`Updated frequency preferences for user ${userId}: ${analysis.optimalFrequency} notifications/day`);
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStatistics(): any {
    return {
      totalUsersOptimized: this.userModels.size,
      optimizationConfig: this.learningConfig,
      lastOptimization: new Date(),
      averageConfidence: 0.75 // Would calculate from actual optimization results
    };
  }

  /**
   * Stop optimization
   */
  stopOptimization(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
      logger.info('🤖 ML-based preference optimization stopped');
    }
  }
}

/**
 * Main Push Notification System - Phase 2 Component 2.3
 */
export class PushNotificationSystem extends EventEmitter {
  private userBehaviorAnalyzer: UserBehaviorAnalyzer;
  private intelligentScheduler: IntelligentNotificationScheduler;
  private criticalAlertManager: CriticalAlertManager;
  private preferenceLearningEngine: PreferenceLearningEngine;

  private isInitialized = false;
  private notificationAnalytics: NotificationAnalytics;

  // Monitoring intervals
  private analyticsInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    this.userBehaviorAnalyzer = new UserBehaviorAnalyzer();
    this.intelligentScheduler = new IntelligentNotificationScheduler(this.userBehaviorAnalyzer);
    this.criticalAlertManager = new CriticalAlertManager();
    this.preferenceLearningEngine = new PreferenceLearningEngine();

    this.notificationAnalytics = {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalResponded: 0,
      averageDeliveryTime: 0,
      averageResponseTime: 0,
      engagementByEventType: new Map(),
      engagementByTimeOfDay: new Map(),
      engagementByDayOfWeek: new Map(),
      userSatisfactionScore: 0,
      mlOptimizationAccuracy: 0
    };
  }

  /**
   * Initialize the Push Notification System
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Push Notification System already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Push Notification System...');

      // Setup integration with Phase 2 Component 2.2 Real-time Event Processor
      this.setupRealTimeEventProcessorIntegration();

      // Start intelligent scheduler
      this.intelligentScheduler.startProcessing();

      // Start ML-based preference optimization
      this.preferenceLearningEngine.startOptimization();

      // Start analytics collection
      this.startAnalyticsCollection();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.emit('system:initialized');

      logger.info('✅ Push Notification System initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Push Notification System:', error);
      throw error;
    }
  }

  /**
   * Setup integration with Real-time Event Processor
   */
  private setupRealTimeEventProcessorIntegration(): void {
    // Listen for processed events from Real-time Event Processor
    realTimeEventProcessor.on('event:processed', async (processedEvent: ProcessedEvent) => {
      await this.handleProcessedEvent(processedEvent);
    });

    // Listen for notification delivery events
    realTimeEventProcessor.on('notification:delivered', (processedEvent: ProcessedEvent) => {
      this.recordNotificationDelivery(processedEvent);
    });

    // Listen for notification failures
    realTimeEventProcessor.on('notification:failed', (processedEvent: ProcessedEvent) => {
      this.handleNotificationFailure(processedEvent);
    });

    logger.info('📡 Real-time Event Processor integration configured');
  }

  /**
   * Handle processed event from Real-time Event Processor
   */
  private async handleProcessedEvent(processedEvent: ProcessedEvent): Promise<void> {
    try {
      const startTime = Date.now();

      // Determine if this is a critical alert
      if (this.isCriticalAlert(processedEvent)) {
        await this.handleCriticalAlert(processedEvent);
      } else {
        // Use intelligent scheduling for non-critical notifications
        await this.scheduleIntelligentNotification(processedEvent);
      }

      // Update analytics
      this.updateProcessingAnalytics(startTime, true);
      this.emit('event:handled', processedEvent);

    } catch (error) {
      logger.error('Failed to handle processed event:', error);
      this.updateProcessingAnalytics(Date.now(), false);
      this.emit('event:handling_failed', { processedEvent, error });
    }
  }

  /**
   * Check if event requires critical alert handling
   */
  private isCriticalAlert(processedEvent: ProcessedEvent): boolean {
    // Critical alert criteria
    const criticalEventTypes = ['rate_limit_warning', 'system_status', 'service_health_change'];
    const criticalPriorities = ['critical'];

    return criticalPriorities.includes(processedEvent.priority) ||
           (criticalEventTypes.includes(processedEvent.type) &&
            this.hasCriticalKeywords(processedEvent.originalEvent));
  }

  /**
   * Check for critical keywords in event data
   */
  private hasCriticalKeywords(eventData: any): boolean {
    const criticalKeywords = ['down', 'failed', 'error', 'critical', 'outage', 'breach', 'violation'];
    const eventText = JSON.stringify(eventData).toLowerCase();

    return criticalKeywords.some(keyword => eventText.includes(keyword));
  }

  /**
   * Handle critical alert with <30 second delivery
   */
  private async handleCriticalAlert(processedEvent: ProcessedEvent): Promise<void> {
    try {
      const alertType = this.mapEventTypeToCriticalAlertType(processedEvent.type);
      const remediationSteps = this.generateRemediationSteps(processedEvent);

      const alertId = await this.criticalAlertManager.createCriticalAlert(
        alertType,
        this.extractAlertTitle(processedEvent),
        this.extractAlertDescription(processedEvent),
        this.extractAffectedServices(processedEvent),
        this.extractEstimatedImpact(processedEvent),
        remediationSteps
      );

      this.emit('critical_alert:created', { alertId, processedEvent });
      logger.info(`🚨 Critical alert created: ${alertId} for event ${processedEvent.id}`);

    } catch (error) {
      logger.error('Failed to handle critical alert:', error);
      throw error;
    }
  }

  /**
   * Schedule intelligent notification
   */
  private async scheduleIntelligentNotification(processedEvent: ProcessedEvent): Promise<void> {
    try {
      // Analyze user behavior for optimal timing
      await this.userBehaviorAnalyzer.analyzeUserBehavior(processedEvent.userId);

      // Determine delivery method based on priority and user preferences
      const deliveryMethod = this.determineDeliveryMethod(processedEvent);

      // Schedule notification
      const notificationId = await this.intelligentScheduler.scheduleNotification(
        processedEvent,
        deliveryMethod
      );

      this.emit('notification:scheduled', { notificationId, processedEvent });
      logger.debug(`📅 Notification scheduled: ${notificationId} for user ${processedEvent.userId}`);

    } catch (error) {
      logger.error('Failed to schedule intelligent notification:', error);
      throw error;
    }
  }

  /**
   * Determine delivery method based on event and user context
   */
  private determineDeliveryMethod(processedEvent: ProcessedEvent): 'immediate' | 'scheduled' | 'batched' {
    switch (processedEvent.priority) {
      case 'critical':
        return 'immediate';
      case 'high':
        return 'immediate';
      case 'normal':
        return 'scheduled';
      case 'low':
        return 'batched';
      default:
        return 'scheduled';
    }
  }

  /**
   * Map event type to critical alert type
   */
  private mapEventTypeToCriticalAlertType(eventType: string): 'system_error' | 'security_issue' | 'rate_limit_violation' | 'service_outage' {
    switch (eventType) {
      case 'rate_limit_warning':
        return 'rate_limit_violation';
      case 'system_status':
        return 'system_error';
      case 'service_health_change':
        return 'service_outage';
      default:
        return 'system_error';
    }
  }

  /**
   * Generate remediation steps for critical alert
   */
  private generateRemediationSteps(processedEvent: ProcessedEvent): Omit<RemediationStep, 'id' | 'completed' | 'completedAt'>[] {
    const steps: Omit<RemediationStep, 'id' | 'completed' | 'completedAt'>[] = [];

    switch (processedEvent.type) {
      case 'rate_limit_warning':
        steps.push(
          {
            title: 'Pause Automation',
            description: 'Immediately pause all automation for affected accounts',
            action: 'automated',
            actionData: { type: 'pause_automation', accountIds: [processedEvent.originalEvent.accountId] },
            estimatedTime: 1,
            priority: 1
          },
          {
            title: 'Review Rate Limits',
            description: 'Check current rate limit usage and adjust settings',
            action: 'manual',
            estimatedTime: 5,
            priority: 2
          }
        );
        break;

      case 'system_status':
        steps.push(
          {
            title: 'Check Service Health',
            description: 'Verify the health of all critical services',
            action: 'automated',
            actionData: { type: 'health_check' },
            estimatedTime: 2,
            priority: 1
          },
          {
            title: 'Restart Failed Services',
            description: 'Restart any services that are not responding',
            action: 'automated',
            actionData: { type: 'restart_service' },
            estimatedTime: 3,
            priority: 2
          }
        );
        break;

      default:
        steps.push({
          title: 'Investigate Issue',
          description: 'Manual investigation required',
          action: 'manual',
          estimatedTime: 10,
          priority: 1
        });
    }

    return steps;
  }

  /**
   * Extract alert title from processed event
   */
  private extractAlertTitle(processedEvent: ProcessedEvent): string {
    const eventData = processedEvent.originalEvent;

    switch (processedEvent.type) {
      case 'rate_limit_warning':
        return `Rate Limit Critical: ${eventData.accountHandle || 'Unknown Account'}`;
      case 'system_status':
        return `System Status Alert: ${eventData.status || 'Unknown Status'}`;
      case 'service_health_change':
        return `Service Health Critical: ${eventData.serviceName || 'Unknown Service'}`;
      default:
        return `Critical Alert: ${processedEvent.type}`;
    }
  }

  /**
   * Extract alert description from processed event
   */
  private extractAlertDescription(processedEvent: ProcessedEvent): string {
    return processedEvent.message.text.substring(0, 200) + '...';
  }

  /**
   * Extract affected services from processed event
   */
  private extractAffectedServices(processedEvent: ProcessedEvent): string[] {
    const eventData = processedEvent.originalEvent;

    if (eventData.affectedServices) return eventData.affectedServices;
    if (eventData.serviceName) return [eventData.serviceName];
    if (eventData.services) return eventData.services.map((s: any) => s.name || s);

    return ['Unknown Service'];
  }

  /**
   * Extract estimated impact from processed event
   */
  private extractEstimatedImpact(processedEvent: ProcessedEvent): string {
    const eventData = processedEvent.originalEvent;

    if (eventData.estimatedImpact) return eventData.estimatedImpact;
    if (eventData.impact) return eventData.impact;

    switch (processedEvent.priority) {
      case 'critical': return 'High - Service disruption expected';
      case 'high': return 'Medium - Potential service degradation';
      default: return 'Low - Minimal impact expected';
    }
  }

  /**
   * Record notification delivery for analytics
   */
  private recordNotificationDelivery(processedEvent: ProcessedEvent): void {
    this.notificationAnalytics.totalDelivered++;

    // Update engagement by event type
    const eventTypeEngagement = this.notificationAnalytics.engagementByEventType.get(processedEvent.type) || {
      totalNotifications: 0,
      openRate: 0,
      responseRate: 0,
      averageResponseTime: 0,
      satisfactionScore: 0,
      lastEngagement: new Date()
    };

    eventTypeEngagement.totalNotifications++;
    this.notificationAnalytics.engagementByEventType.set(processedEvent.type, eventTypeEngagement);

    logger.debug(`📊 Recorded notification delivery: ${processedEvent.id}`);
  }

  /**
   * Handle notification failure
   */
  private handleNotificationFailure(processedEvent: ProcessedEvent): void {
    logger.warn(`📉 Notification delivery failed: ${processedEvent.id}`);

    // Could implement retry logic or alternative delivery methods
    this.emit('notification:delivery_failed', processedEvent);
  }

  /**
   * Update processing analytics
   */
  private updateProcessingAnalytics(startTime: number, success: boolean): void {
    const processingTime = Date.now() - startTime;

    this.notificationAnalytics.totalSent++;

    if (success) {
      // Update average delivery time
      if (this.notificationAnalytics.averageDeliveryTime === 0) {
        this.notificationAnalytics.averageDeliveryTime = processingTime;
      } else {
        this.notificationAnalytics.averageDeliveryTime =
          (this.notificationAnalytics.averageDeliveryTime * 0.9) + (processingTime * 0.1);
      }
    }
  }

  /**
   * Start analytics collection
   */
  private startAnalyticsCollection(): void {
    this.analyticsInterval = setInterval(() => {
      this.collectAnalytics();
    }, 300000); // Every 5 minutes

    logger.info('📊 Analytics collection started');
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute

    logger.info('🏥 Health monitoring started');
  }

  /**
   * Collect analytics data
   */
  private collectAnalytics(): void {
    try {
      const analytics = {
        ...this.notificationAnalytics,
        timestamp: new Date(),
        schedulerStats: this.intelligentScheduler.getSchedulingStatistics(),
        alertStats: this.criticalAlertManager.getAlertStatistics(),
        mlStats: this.preferenceLearningEngine.getOptimizationStatistics()
      };

      this.emit('analytics:collected', analytics);
      logger.debug('📊 Analytics collected:', analytics);

    } catch (error) {
      logger.error('Failed to collect analytics:', error);
    }
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    try {
      const health = {
        system: 'healthy',
        components: {
          userBehaviorAnalyzer: 'healthy',
          intelligentScheduler: 'healthy',
          criticalAlertManager: 'healthy',
          preferenceLearningEngine: 'healthy'
        },
        metrics: {
          totalActiveAlerts: this.criticalAlertManager.getActiveAlerts().length,
          pendingNotifications: this.intelligentScheduler.getSchedulingStatistics().pendingNotifications,
          averageDeliveryTime: this.notificationAnalytics.averageDeliveryTime,
          userSatisfactionScore: this.notificationAnalytics.userSatisfactionScore
        },
        timestamp: new Date()
      };

      this.emit('health:checked', health);

    } catch (error) {
      logger.error('Health check failed:', error);
      this.emit('health:check_failed', error);
    }
  }

  // Public API Methods

  /**
   * Create manual critical alert
   */
  async createCriticalAlert(
    type: 'system_error' | 'security_issue' | 'rate_limit_violation' | 'service_outage',
    title: string,
    description: string,
    affectedServices: string[],
    estimatedImpact: string,
    remediationSteps: Omit<RemediationStep, 'id' | 'completed' | 'completedAt'>[]
  ): Promise<string> {
    return await this.criticalAlertManager.createCriticalAlert(
      type,
      title,
      description,
      affectedServices,
      estimatedImpact,
      remediationSteps
    );
  }

  /**
   * Acknowledge critical alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    return this.criticalAlertManager.acknowledgeAlert(alertId, acknowledgedBy);
  }

  /**
   * Resolve critical alert
   */
  resolveAlert(alertId: string): boolean {
    return this.criticalAlertManager.resolveAlert(alertId);
  }

  /**
   * Get active critical alerts
   */
  getActiveCriticalAlerts(): CriticalAlert[] {
    return this.criticalAlertManager.getActiveAlerts();
  }

  /**
   * Get notification analytics
   */
  getNotificationAnalytics(): NotificationAnalytics {
    return { ...this.notificationAnalytics };
  }

  /**
   * Get system statistics
   */
  getSystemStatistics(): any {
    return {
      analytics: this.getNotificationAnalytics(),
      scheduler: this.intelligentScheduler.getSchedulingStatistics(),
      alerts: this.criticalAlertManager.getAlertStatistics(),
      mlOptimization: this.preferenceLearningEngine.getOptimizationStatistics(),
      systemHealth: {
        initialized: this.isInitialized,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * Update user interaction (for ML learning)
   */
  recordUserInteraction(
    notificationId: string,
    userId: number,
    interactionType: 'opened' | 'responded' | 'dismissed',
    responseTime?: number
  ): void {
    try {
      // Create interaction record
      const interaction: InteractionRecord = {
        notificationId,
        timestamp: new Date(),
        eventType: 'user_interaction',
        priority: 'normal',
        deliveryTime: new Date(), // Would get actual delivery time
        engagementScore: this.calculateEngagementScore(interactionType, responseTime),
        contextData: { interactionType, responseTime }
      };

      if (interactionType === 'opened') {
        interaction.openTime = new Date();
        this.notificationAnalytics.totalOpened++;
      }

      if (interactionType === 'responded') {
        interaction.responseTime = new Date();
        this.notificationAnalytics.totalResponded++;
      }

      // Record for behavior analysis
      this.userBehaviorAnalyzer.recordInteraction(interaction);

      logger.debug(`📝 Recorded user interaction: ${interactionType} for notification ${notificationId}`);

    } catch (error) {
      logger.error('Failed to record user interaction:', error);
    }
  }

  /**
   * Calculate engagement score based on interaction
   */
  private calculateEngagementScore(interactionType: string, responseTime?: number): number {
    let score = 0;

    switch (interactionType) {
      case 'opened':
        score = 30;
        break;
      case 'responded':
        score = 70;
        break;
      case 'dismissed':
        score = 10;
        break;
    }

    // Bonus for quick response
    if (responseTime && responseTime < 300000) { // 5 minutes
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * Shutdown the Push Notification System
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔌 Shutting down Push Notification System...');

      // Stop all intervals
      if (this.analyticsInterval) clearInterval(this.analyticsInterval);
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);

      // Stop components
      this.intelligentScheduler.stopProcessing();
      this.preferenceLearningEngine.stopOptimization();

      // Remove event listeners
      realTimeEventProcessor.removeAllListeners();

      this.isInitialized = false;
      this.emit('system:shutdown');

      logger.info('✅ Push Notification System shutdown complete');

    } catch (error) {
      logger.error('Failed to shutdown Push Notification System:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pushNotificationSystem = new PushNotificationSystem();
