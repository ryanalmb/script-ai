/**
 * Behavior Pattern Simulator
 * Simulates human-like behavioral patterns for anti-detection
 */

import { PrismaClient } from '@prisma/client';
import Redis, { Redis as RedisType } from 'ioredis';
import { EventEmitter } from 'events';
import { AntiDetectionConfig, BehaviorPatternType } from '../../config/antiDetection';
import { logger } from '../../utils/logger';

export interface BehaviorPattern {
  id: string;
  identityProfileId: string;
  patternType: BehaviorPatternType;
  patternName: string;
  patternData: any;
  timeOfDay?: string | null;
  dayOfWeek: string[];
  contentTypes: string[];
  actionTypes: string[];
  minInterval: number;
  maxInterval: number;
  burstProbability: number;
  fatigueRate: number;
  attentionSpan: number;
  engagementRate: number;
  scrollSpeed: any;
  mouseMovement: any;
  typingSpeed: any;
  isActive: boolean;
  priority: number;
  usageCount: number;
  successRate: number;
  lastUsed?: Date | null;
  metadata: any;
  realismScore?: number;
}

export interface TimingCalculation {
  baseDelay: number;
  variationFactor: number;
  fatigueMultiplier: number;
  burstReduction: number;
  finalDelay: number;
}

export class BehaviorPatternSimulator extends EventEmitter {
  private prisma: PrismaClient;
  private redis: RedisType;
  private config: AntiDetectionConfig;
  private patternCache: Map<string, BehaviorPattern> = new Map();
  private isInitialized: boolean = false;

  // Behavioral state tracking
  private sessionStates: Map<string, {
    startTime: number;
    actionCount: number;
    currentFatigue: number;
    lastActionTime: number;
    burstMode: boolean;
    attentionRemaining: number;
  }> = new Map();

  constructor(prisma: PrismaClient, redis: RedisType, config: AntiDetectionConfig) {
    super();
    this.prisma = prisma;
    this.redis = redis;
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Behavior Pattern Simulator...');

      // Load existing patterns from database
      await this.loadBehaviorPatterns();

      // Setup Redis subscriptions for pattern updates
      await this.setupRedisSubscriptions();

      this.isInitialized = true;
      logger.info('Behavior Pattern Simulator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Behavior Pattern Simulator:', error);
      throw error;
    }
  }

  /**
   * Get behavior pattern for identity profile and action
   */
  public async getBehaviorPattern(
    identityProfileId: string,
    action: string,
    metadata?: any
  ): Promise<BehaviorPattern> {
    try {
      const cacheKey = `pattern:${identityProfileId}:${action}`;
      
      // Check cache first
      const cached = this.patternCache.get(cacheKey);
      if (cached && this.isPatternValid(cached)) {
        return cached;
      }

      // Query database for pattern
      const pattern = await this.prisma.behaviorPattern.findFirst({
        where: {
          identityProfileId,
          actionTypes: {
            has: action.toUpperCase(),
          },
          isActive: true,
        },
        orderBy: {
          priority: 'desc',
        },
      });

      if (pattern) {
        const behaviorPattern: BehaviorPattern = {
          ...pattern,
          patternType: pattern.patternType as BehaviorPatternType,
          realismScore: this.calculateRealismScore(pattern),
        };

        // Cache the pattern
        this.patternCache.set(cacheKey, behaviorPattern);
        return behaviorPattern;
      }

      // Create default pattern if none found
      return this.createDefaultPattern(identityProfileId, action);
    } catch (error) {
      logger.error('Failed to get behavior pattern:', error);
      throw error;
    }
  }

  /**
   * Calculate timing for specific action
   */
  public async calculateActionTiming(
    identityProfileId: string,
    sessionId: string,
    action: string,
    metadata?: any
  ): Promise<TimingCalculation> {
    try {
      const pattern = await this.getBehaviorPattern(identityProfileId, action, metadata);
      const sessionState = this.getOrCreateSessionState(sessionId);

      // Base timing from pattern
      const baseMin = pattern.minInterval;
      const baseMax = pattern.maxInterval;
      const baseDelay = this.randomBetween(baseMin, baseMax);

      // Calculate variation factor based on time of day and content type
      const variationFactor = this.calculateVariationFactor(pattern, metadata);

      // Calculate fatigue multiplier
      const fatigueMultiplier = this.calculateFatigueMultiplier(sessionState, pattern);

      // Check for burst behavior
      const burstReduction = this.shouldBurst(sessionState, pattern) ? 0.3 : 1.0;

      // Calculate final delay
      const finalDelay = Math.max(
        baseMin * 0.5, // Minimum threshold
        baseDelay * variationFactor * fatigueMultiplier * burstReduction
      );

      // Update session state
      this.updateSessionState(sessionId, sessionState, finalDelay);

      return {
        baseDelay,
        variationFactor,
        fatigueMultiplier,
        burstReduction,
        finalDelay,
      };
    } catch (error) {
      logger.error('Failed to calculate action timing:', error);
      throw error;
    }
  }

  /**
   * Simulate mouse movement pattern
   */
  public generateMouseMovementPattern(pattern: BehaviorPattern): any {
    const mouseConfig = pattern.mouseMovement || {};
    
    return {
      speed: this.randomBetween(mouseConfig.minSpeed || 100, mouseConfig.maxSpeed || 300),
      acceleration: this.randomBetween(0.8, 1.2),
      jitter: this.randomBetween(0, mouseConfig.jitterLevel || 2),
      pauseProbability: mouseConfig.pauseProbability || 0.1,
      trajectory: this.generateMouseTrajectory(),
    };
  }

  /**
   * Simulate scroll behavior pattern
   */
  public generateScrollPattern(pattern: BehaviorPattern): any {
    const scrollConfig = pattern.scrollSpeed || {};
    
    return {
      speed: this.randomBetween(scrollConfig.minSpeed || 200, scrollConfig.maxSpeed || 800),
      direction: Math.random() > 0.9 ? 'up' : 'down', // Mostly down scrolling
      distance: this.randomBetween(100, 500),
      pauseDuration: this.randomBetween(500, 2000),
      smoothness: this.randomBetween(0.7, 1.0),
    };
  }

  /**
   * Simulate typing pattern
   */
  public generateTypingPattern(pattern: BehaviorPattern, _textLength: number): any {
    const typingConfig = pattern.typingSpeed || {};
    
    const baseWpm = typingConfig.wordsPerMinute || this.randomBetween(40, 80);
    const variation = typingConfig.variation || 0.2;
    
    return {
      wordsPerMinute: baseWpm * (1 + (Math.random() - 0.5) * variation),
      keystrokeInterval: this.calculateKeystrokeInterval(baseWpm),
      pauseProbability: typingConfig.pauseProbability || 0.05,
      backspaceProbability: typingConfig.backspaceProbability || 0.02,
      burstTyping: Math.random() < 0.1, // 10% chance of burst typing
    };
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(config: AntiDetectionConfig): Promise<void> {
    this.config = config;
    logger.info('Behavior Pattern Simulator configuration updated');
  }

  /**
   * Get statistics
   */
  public async getStatistics(): Promise<any> {
    return {
      isInitialized: this.isInitialized,
      cachedPatterns: this.patternCache.size,
      activeSessions: this.sessionStates.size,
    };
  }

  /**
   * Shutdown
   */
  public async shutdown(): Promise<void> {
    this.patternCache.clear();
    this.sessionStates.clear();
    this.isInitialized = false;
    logger.info('Behavior Pattern Simulator shut down');
  }

  // Private helper methods
  private async loadBehaviorPatterns(): Promise<void> {
    try {
      const patterns = await this.prisma.behaviorPattern.findMany({
        where: { isActive: true },
        take: 100, // Limit for performance
      });

      patterns.forEach(pattern => {
        const key = `pattern:${pattern.identityProfileId}:${pattern.patternType}`;
        this.patternCache.set(key, {
          ...pattern,
          patternType: pattern.patternType as BehaviorPatternType,
          realismScore: this.calculateRealismScore(pattern),
        });
      });

      logger.debug(`Loaded ${patterns.length} behavior patterns`);
    } catch (error) {
      logger.error('Failed to load behavior patterns:', error);
    }
  }

  private async setupRedisSubscriptions(): Promise<void> {
    // Setup Redis subscriptions for pattern updates
    // Implementation would subscribe to pattern update channels
  }

  private isPatternValid(pattern: BehaviorPattern): boolean {
    if (!pattern.lastUsed) return true;
    
    const maxAge = 3600000; // 1 hour
    return Date.now() - pattern.lastUsed.getTime() < maxAge;
  }

  private calculateRealismScore(pattern: any): number {
    // Calculate realism score based on pattern characteristics
    let score = 100;

    // Penalize unrealistic timing
    if (pattern.minInterval < 500) score -= 20;
    if (pattern.maxInterval > 300000) score -= 10;

    // Reward natural variation
    const variation = pattern.maxInterval / pattern.minInterval;
    if (variation > 2 && variation < 10) score += 10;

    // Consider fatigue simulation
    if (pattern.fatigueRate > 0) score += 15;

    // Consider burst behavior
    if (pattern.burstProbability > 0 && pattern.burstProbability < 0.3) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private createDefaultPattern(identityProfileId: string, action: string): BehaviorPattern {
    return {
      id: `default_${identityProfileId}_${action}`,
      identityProfileId,
      patternType: 'TIMING',
      patternName: `Default ${action} pattern`,
      patternData: { distribution: 'normal', mean: 15000, stddev: 5000 },
      dayOfWeek: [],
      contentTypes: [],
      actionTypes: [action.toUpperCase()],
      minInterval: 1000,
      maxInterval: 30000,
      burstProbability: 0.1,
      fatigueRate: 0.05,
      attentionSpan: 1800,
      engagementRate: 0.15,
      scrollSpeed: {},
      mouseMovement: {},
      typingSpeed: {},
      isActive: true,
      priority: 1,
      usageCount: 0,
      successRate: 100,
      metadata: {},
      realismScore: 75,
    };
  }

  private getOrCreateSessionState(sessionId: string) {
    if (!this.sessionStates.has(sessionId)) {
      this.sessionStates.set(sessionId, {
        startTime: Date.now(),
        actionCount: 0,
        currentFatigue: 0,
        lastActionTime: 0,
        burstMode: false,
        attentionRemaining: 1800, // 30 minutes
      });
    }
    const sessionState = this.sessionStates.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session state not found: ${sessionId}`);
    }
    return sessionState;
  }

  private calculateVariationFactor(_pattern: BehaviorPattern, metadata?: any): number {
    let factor = 1.0;

    // Time of day variation
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) {
      factor *= 0.8; // Faster during work hours
    } else if (hour >= 22 || hour <= 6) {
      factor *= 1.3; // Slower during night hours
    }

    // Content type variation
    if (metadata?.contentType === 'video') {
      factor *= 1.2; // Slower for video content
    } else if (metadata?.contentType === 'image') {
      factor *= 0.9; // Faster for images
    }

    return factor;
  }

  private calculateFatigueMultiplier(sessionState: any, pattern: BehaviorPattern): number {
    const sessionDuration = Date.now() - sessionState.startTime;
    const fatigueFromTime = sessionDuration / (pattern.attentionSpan * 1000);
    const fatigueFromActions = sessionState.actionCount * pattern.fatigueRate;
    
    const totalFatigue = Math.min(2.0, fatigueFromTime + fatigueFromActions);
    return 1.0 + totalFatigue;
  }

  private shouldBurst(sessionState: any, pattern: BehaviorPattern): boolean {
    // Check if we should enter burst mode
    if (sessionState.burstMode) {
      // Exit burst mode after some actions
      if (sessionState.actionCount % 5 === 0) {
        sessionState.burstMode = false;
      }
      return true;
    }

    // Enter burst mode based on probability
    if (Math.random() < pattern.burstProbability) {
      sessionState.burstMode = true;
      return true;
    }

    return false;
  }

  private updateSessionState(sessionId: string, sessionState: any, delay: number): void {
    sessionState.actionCount++;
    sessionState.lastActionTime = Date.now();
    sessionState.attentionRemaining -= delay / 1000;

    // Reset session if attention span exceeded
    if (sessionState.attentionRemaining <= 0) {
      this.sessionStates.delete(sessionId);
    }
  }

  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private generateMouseTrajectory(): any {
    // Generate realistic mouse movement trajectory
    return {
      points: Array.from({ length: 5 }, () => ({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        timestamp: Date.now() + Math.random() * 1000,
      })),
    };
  }

  private calculateKeystrokeInterval(wpm: number): number {
    // Calculate average time between keystrokes based on WPM
    const charactersPerMinute = wpm * 5; // Average 5 characters per word
    const millisecondsPerCharacter = 60000 / charactersPerMinute;
    return millisecondsPerCharacter;
  }
}
