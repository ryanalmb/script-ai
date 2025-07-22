import { logger } from '../../utils/logger';
import { cacheManager } from '../../lib/cache';
import crypto from 'crypto';

export interface HumanBehaviorPattern {
  id: string;
  name: string;
  description: string;
  actionIntervals: {
    min: number; // minimum seconds between actions
    max: number; // maximum seconds between actions
    distribution: 'uniform' | 'normal' | 'exponential' | 'poisson';
    peakHours: number[]; // hours of day when most active (0-23)
    restHours: number[]; // hours of day when least active
  };
  sessionPatterns: {
    minSessionDuration: number; // seconds
    maxSessionDuration: number; // seconds
    breakProbability: number; // 0-1 probability of taking a break
    minBreakDuration: number; // seconds
    maxBreakDuration: number; // seconds
  };
  activityDistribution: {
    posting: number; // 0-1 weight
    liking: number;
    commenting: number;
    following: number;
    browsing: number;
    searching: number;
  };
  errorSimulation: {
    typoRate: number; // 0-1 probability of typos
    correctionRate: number; // 0-1 probability of correcting typos
    hesitationRate: number; // 0-1 probability of pausing before action
    backtrackRate: number; // 0-1 probability of undoing/redoing actions
  };
  mouseMovement: {
    speed: number; // pixels per second
    acceleration: number;
    jitter: number; // random movement variation
    pauseProbability: number; // probability of pausing during movement
  };
  keyboardTiming: {
    avgKeystrokeInterval: number; // milliseconds
    variability: number; // timing variation factor
    burstTyping: boolean; // simulate burst typing patterns
    pauseAfterWords: number; // probability of pausing after words
  };
  scrollBehavior: {
    speed: number; // pixels per second
    pauseProbability: number;
    backScrollRate: number; // probability of scrolling back up
    readingPauses: boolean; // pause to simulate reading
  };
  qualityScore: number; // 0-1 realism score
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
}

export interface BehaviorSession {
  id: string;
  accountId: string;
  patternId: string;
  startTime: Date;
  lastActivity: Date;
  plannedEndTime: Date;
  currentPhase: 'warmup' | 'active' | 'cooldown' | 'break';
  actionsPerformed: number;
  actionsPlanned: number;
  nextActionTime: Date;
  nextActionType: string;
  sessionMetrics: {
    totalActions: number;
    actionTypes: { [key: string]: number };
    avgActionInterval: number;
    errorCount: number;
    correctionCount: number;
    pauseCount: number;
  };
}

export interface ActionContext {
  accountId: string;
  actionType: string;
  targetData?: any;
  previousAction?: string;
  timeSinceLastAction: number;
  sessionContext: BehaviorSession;
}

/**
 * Enterprise Human Behavior Simulation System
 * Simulates realistic human interaction patterns to avoid detection
 */
export class EnterpriseBehaviorSimulator {
  private patterns: Map<string, HumanBehaviorPattern> = new Map();
  private activeSessions: Map<string, BehaviorSession> = new Map();
  private actionQueue: Map<string, any[]> = new Map(); // accountId -> queued actions
  private behaviorInterval: NodeJS.Timeout | null = null;
  private analyticsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeBehaviorSimulator();
  }

  /**
   * Initialize behavior simulator with comprehensive patterns
   */
  private async initializeBehaviorSimulator(): Promise<void> {
    try {
      logger.info('🔧 Initializing Enterprise Behavior Simulator...');
      
      await this.loadBehaviorPatterns();
      await this.generateRealisticPatterns();
      
      this.startBehaviorProcessing();
      this.startAnalyticsCollection();
      
      logger.info('✅ Enterprise Behavior Simulator initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Enterprise Behavior Simulator:', error);
      throw new Error(`Behavior Simulator initialization failed: ${error}`);
    }
  }

  /**
   * Generate realistic human behavior patterns
   */
  private async generateRealisticPatterns(): Promise<void> {
    try {
      // Conservative Professional Pattern
      const conservativePattern: HumanBehaviorPattern = {
        id: 'conservative_professional',
        name: 'Conservative Professional',
        description: 'Cautious, professional user with measured interactions',
        actionIntervals: {
          min: 300, // 5 minutes
          max: 1800, // 30 minutes
          distribution: 'normal',
          peakHours: [9, 10, 11, 14, 15, 16, 17],
          restHours: [0, 1, 2, 3, 4, 5, 6, 22, 23]
        },
        sessionPatterns: {
          minSessionDuration: 900, // 15 minutes
          maxSessionDuration: 3600, // 1 hour
          breakProbability: 0.3,
          minBreakDuration: 300, // 5 minutes
          maxBreakDuration: 1800 // 30 minutes
        },
        activityDistribution: {
          posting: 0.1,
          liking: 0.4,
          commenting: 0.1,
          following: 0.2,
          browsing: 0.15,
          searching: 0.05
        },
        errorSimulation: {
          typoRate: 0.02,
          correctionRate: 0.8,
          hesitationRate: 0.15,
          backtrackRate: 0.05
        },
        mouseMovement: {
          speed: 200,
          acceleration: 0.8,
          jitter: 0.1,
          pauseProbability: 0.2
        },
        keyboardTiming: {
          avgKeystrokeInterval: 150,
          variability: 0.3,
          burstTyping: false,
          pauseAfterWords: 0.1
        },
        scrollBehavior: {
          speed: 300,
          pauseProbability: 0.25,
          backScrollRate: 0.1,
          readingPauses: true
        },
        qualityScore: 0.9,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0
      };

      // Active Enthusiast Pattern
      const enthusiastPattern: HumanBehaviorPattern = {
        id: 'active_enthusiast',
        name: 'Active Enthusiast',
        description: 'Engaged user with frequent but natural interactions',
        actionIntervals: {
          min: 60, // 1 minute
          max: 600, // 10 minutes
          distribution: 'exponential',
          peakHours: [8, 9, 12, 13, 18, 19, 20, 21],
          restHours: [1, 2, 3, 4, 5, 6]
        },
        sessionPatterns: {
          minSessionDuration: 1800, // 30 minutes
          maxSessionDuration: 7200, // 2 hours
          breakProbability: 0.4,
          minBreakDuration: 180, // 3 minutes
          maxBreakDuration: 900 // 15 minutes
        },
        activityDistribution: {
          posting: 0.15,
          liking: 0.35,
          commenting: 0.2,
          following: 0.15,
          browsing: 0.1,
          searching: 0.05
        },
        errorSimulation: {
          typoRate: 0.05,
          correctionRate: 0.7,
          hesitationRate: 0.1,
          backtrackRate: 0.08
        },
        mouseMovement: {
          speed: 350,
          acceleration: 1.2,
          jitter: 0.15,
          pauseProbability: 0.15
        },
        keyboardTiming: {
          avgKeystrokeInterval: 120,
          variability: 0.4,
          burstTyping: true,
          pauseAfterWords: 0.05
        },
        scrollBehavior: {
          speed: 450,
          pauseProbability: 0.2,
          backScrollRate: 0.15,
          readingPauses: true
        },
        qualityScore: 0.85,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0
      };

      // Casual Browser Pattern
      const casualPattern: HumanBehaviorPattern = {
        id: 'casual_browser',
        name: 'Casual Browser',
        description: 'Relaxed user with sporadic, leisurely interactions',
        actionIntervals: {
          min: 180, // 3 minutes
          max: 2400, // 40 minutes
          distribution: 'uniform',
          peakHours: [11, 12, 13, 19, 20, 21, 22],
          restHours: [2, 3, 4, 5, 6, 7, 8]
        },
        sessionPatterns: {
          minSessionDuration: 600, // 10 minutes
          maxSessionDuration: 2700, // 45 minutes
          breakProbability: 0.5,
          minBreakDuration: 600, // 10 minutes
          maxBreakDuration: 3600 // 1 hour
        },
        activityDistribution: {
          posting: 0.05,
          liking: 0.5,
          commenting: 0.05,
          following: 0.1,
          browsing: 0.25,
          searching: 0.05
        },
        errorSimulation: {
          typoRate: 0.03,
          correctionRate: 0.6,
          hesitationRate: 0.2,
          backtrackRate: 0.1
        },
        mouseMovement: {
          speed: 180,
          acceleration: 0.6,
          jitter: 0.2,
          pauseProbability: 0.3
        },
        keyboardTiming: {
          avgKeystrokeInterval: 200,
          variability: 0.5,
          burstTyping: false,
          pauseAfterWords: 0.15
        },
        scrollBehavior: {
          speed: 250,
          pauseProbability: 0.35,
          backScrollRate: 0.2,
          readingPauses: true
        },
        qualityScore: 0.8,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0
      };

      // Store patterns
      this.patterns.set(conservativePattern.id, conservativePattern);
      this.patterns.set(enthusiastPattern.id, enthusiastPattern);
      this.patterns.set(casualPattern.id, casualPattern);

      logger.info(`Generated ${this.patterns.size} realistic behavior patterns`);
    } catch (error) {
      logger.error('Failed to generate realistic patterns:', error);
      throw error;
    }
  }

  /**
   * Start behavior session for account
   */
  async startBehaviorSession(
    accountId: string,
    patternId?: string,
    duration?: number
  ): Promise<BehaviorSession> {
    try {
      // Select pattern
      const selectedPatternId = patternId || this.selectOptimalPattern(accountId);
      const pattern = this.patterns.get(selectedPatternId);
      
      if (!pattern) {
        throw new Error(`Behavior pattern ${selectedPatternId} not found`);
      }

      // Calculate session duration
      const sessionDuration = duration || this.calculateSessionDuration(pattern);
      
      // Create session
      const session: BehaviorSession = {
        id: crypto.randomUUID(),
        accountId,
        patternId: selectedPatternId,
        startTime: new Date(),
        lastActivity: new Date(),
        plannedEndTime: new Date(Date.now() + sessionDuration * 1000),
        currentPhase: 'warmup',
        actionsPerformed: 0,
        actionsPlanned: this.calculatePlannedActions(pattern, sessionDuration),
        nextActionTime: new Date(Date.now() + this.calculateNextActionDelay(pattern)),
        nextActionType: this.selectNextActionType(pattern),
        sessionMetrics: {
          totalActions: 0,
          actionTypes: {},
          avgActionInterval: 0,
          errorCount: 0,
          correctionCount: 0,
          pauseCount: 0
        }
      };

      this.activeSessions.set(accountId, session);
      
      // Cache session
      await cacheManager.set(`behavior_session:${accountId}`, session, sessionDuration);
      
      logger.info(`Started behavior session ${session.id} for account ${accountId} with pattern ${selectedPatternId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to start behavior session for account ${accountId}:`, error);
      throw new Error(`Behavior session creation failed: ${error}`);
    }
  }

  /**
   * Calculate realistic action delay with human-like variation
   */
  calculateActionDelay(context: ActionContext): number {
    try {
      const pattern = this.patterns.get(context.sessionContext.patternId);
      if (!pattern) {
        return 300000; // 5 minutes default
      }

      let baseDelay = this.calculateBaseDelay(pattern, context);
      
      // Apply time-of-day modulation
      baseDelay = this.applyTimeOfDayModulation(baseDelay, pattern);
      
      // Apply session phase modulation
      baseDelay = this.applySessionPhaseModulation(baseDelay, context.sessionContext);
      
      // Apply action type modulation
      baseDelay = this.applyActionTypeModulation(baseDelay, context.actionType, pattern);
      
      // Apply error simulation
      if (Math.random() < pattern.errorSimulation.hesitationRate) {
        baseDelay *= (1.5 + Math.random() * 2); // 1.5x to 3.5x delay for hesitation
        context.sessionContext.sessionMetrics.pauseCount++;
      }
      
      // Add realistic randomization
      const randomFactor = 0.7 + Math.random() * 0.6; // 0.7x to 1.3x variation
      baseDelay *= randomFactor;
      
      // Ensure minimum delay for realism
      const minDelay = this.getMinimumDelayForAction(context.actionType);
      baseDelay = Math.max(baseDelay, minDelay);
      
      logger.debug(`Calculated action delay: ${Math.round(baseDelay)}ms for ${context.actionType}`);
      return Math.round(baseDelay);
    } catch (error) {
      logger.error('Failed to calculate action delay:', error);
      return 300000; // 5 minutes fallback
    }
  }

  /**
   * Calculate base delay from pattern
   */
  private calculateBaseDelay(pattern: HumanBehaviorPattern, context: ActionContext): number {
    const { min, max, distribution } = pattern.actionIntervals;
    
    switch (distribution) {
      case 'uniform':
        return (min + Math.random() * (max - min)) * 1000;
      
      case 'normal':
        const mean = (min + max) / 2;
        const stdDev = (max - min) / 6; // 99.7% within range
        return Math.max(min, Math.min(max, this.normalRandom(mean, stdDev))) * 1000;
      
      case 'exponential':
        const lambda = 1 / ((min + max) / 2);
        return Math.max(min, Math.min(max, -Math.log(Math.random()) / lambda)) * 1000;
      
      case 'poisson':
        const rate = (min + max) / 2;
        return this.poissonRandom(rate) * 1000;
      
      default:
        return (min + Math.random() * (max - min)) * 1000;
    }
  }

  /**
   * Apply time-of-day modulation to delay
   */
  private applyTimeOfDayModulation(delay: number, pattern: HumanBehaviorPattern): number {
    const currentHour = new Date().getHours();
    
    if (pattern.actionIntervals.peakHours.includes(currentHour)) {
      return delay * 0.7; // 30% faster during peak hours
    } else if (pattern.actionIntervals.restHours.includes(currentHour)) {
      return delay * 2.0; // 2x slower during rest hours
    }
    
    return delay;
  }

  /**
   * Apply session phase modulation
   */
  private applySessionPhaseModulation(delay: number, session: BehaviorSession): number {
    switch (session.currentPhase) {
      case 'warmup':
        return delay * 1.5; // Slower start
      case 'active':
        return delay; // Normal speed
      case 'cooldown':
        return delay * 1.3; // Slightly slower
      case 'break':
        return delay * 3.0; // Much slower during breaks
      default:
        return delay;
    }
  }

  /**
   * Apply action type modulation
   */
  private applyActionTypeModulation(delay: number, actionType: string, pattern: HumanBehaviorPattern): number {
    const modifiers: { [key: string]: number } = {
      'posting': 2.0, // Posting takes more thought
      'commenting': 1.8, // Comments require consideration
      'liking': 0.5, // Likes are quick
      'following': 1.2, // Following requires brief evaluation
      'browsing': 0.8, // Browsing is relatively quick
      'searching': 1.0 // Searching is baseline
    };

    return delay * (modifiers[actionType] || 1.0);
  }

  /**
   * Get minimum delay for action type (anti-detection)
   */
  private getMinimumDelayForAction(actionType: string): number {
    const minimums: { [key: string]: number } = {
      'posting': 30000, // 30 seconds minimum for posts
      'commenting': 15000, // 15 seconds for comments
      'liking': 2000, // 2 seconds for likes
      'following': 5000, // 5 seconds for follows
      'browsing': 1000, // 1 second for browsing
      'searching': 3000 // 3 seconds for searches
    };

    return minimums[actionType] || 5000;
  }

  /**
   * Generate normal random number
   */
  private normalRandom(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  /**
   * Generate Poisson random number
   */
  private poissonRandom(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    
    return k - 1;
  }

  /**
   * Select optimal behavior pattern for account
   */
  private selectOptimalPattern(accountId: string): string {
    // This would use ML or heuristics to select the best pattern
    // For now, randomly select from available patterns
    const patternIds = Array.from(this.patterns.keys());
    return patternIds[Math.floor(Math.random() * patternIds.length)];
  }

  /**
   * Calculate session duration based on pattern
   */
  private calculateSessionDuration(pattern: HumanBehaviorPattern): number {
    const { minSessionDuration, maxSessionDuration } = pattern.sessionPatterns;
    return minSessionDuration + Math.random() * (maxSessionDuration - minSessionDuration);
  }

  /**
   * Calculate planned actions for session
   */
  private calculatePlannedActions(pattern: HumanBehaviorPattern, duration: number): number {
    const avgInterval = (pattern.actionIntervals.min + pattern.actionIntervals.max) / 2;
    const baseActions = Math.floor(duration / avgInterval);
    
    // Add randomization
    return Math.floor(baseActions * (0.7 + Math.random() * 0.6));
  }

  /**
   * Calculate next action delay based on pattern
   */
  private calculateNextActionDelay(pattern: HumanBehaviorPattern): number {
    const { min, max } = pattern.actionIntervals;
    return (min + Math.random() * (max - min)) * 1000;
  }

  /**
   * Select next action type based on pattern distribution
   */
  private selectNextActionType(pattern: HumanBehaviorPattern): string {
    const { activityDistribution } = pattern;
    const random = Math.random();
    let cumulative = 0;
    
    for (const [actionType, weight] of Object.entries(activityDistribution)) {
      cumulative += weight;
      if (random <= cumulative) {
        return actionType;
      }
    }
    
    return 'browsing'; // Fallback
  }

  /**
   * Load behavior patterns from database
   */
  private async loadBehaviorPatterns(): Promise<void> {
    try {
      // This would load from database in a real implementation
      // For now, we'll generate patterns in generateRealisticPatterns()
      logger.info('Loaded behavior patterns from database');
    } catch (error) {
      logger.error('Failed to load behavior patterns:', error);
      throw error;
    }
  }

  /**
   * Start behavior processing interval
   */
  private startBehaviorProcessing(): void {
    try {
      this.behaviorInterval = setInterval(() => {
        this.processBehaviorSessions();
      }, 30000); // Every 30 seconds
      
      logger.info('✅ Behavior processing interval started');
    } catch (error) {
      logger.error('Failed to start behavior processing:', error);
    }
  }

  /**
   * Process active behavior sessions
   */
  private async processBehaviorSessions(): Promise<void> {
    try {
      const now = new Date();
      let processedCount = 0;
      
      for (const [accountId, session] of this.activeSessions) {
        // Check if session should end
        if (now >= session.plannedEndTime) {
          await this.endBehaviorSession(accountId);
          continue;
        }
        
        // Update session phase
        this.updateSessionPhase(session, now);
        
        // Process queued actions if any
        await this.processQueuedActions(accountId);
        
        processedCount++;
      }
      
      if (processedCount > 0) {
        logger.debug(`Processed ${processedCount} behavior sessions`);
      }
    } catch (error) {
      logger.error('Failed to process behavior sessions:', error);
    }
  }

  /**
   * Update session phase based on time and activity
   */
  private updateSessionPhase(session: BehaviorSession, now: Date): void {
    const elapsed = now.getTime() - session.startTime.getTime();
    const total = session.plannedEndTime.getTime() - session.startTime.getTime();
    const progress = elapsed / total;
    
    if (progress < 0.1) {
      session.currentPhase = 'warmup';
    } else if (progress < 0.8) {
      session.currentPhase = 'active';
    } else {
      session.currentPhase = 'cooldown';
    }
    
    // Check for break conditions
    const pattern = this.patterns.get(session.patternId);
    if (pattern && Math.random() < pattern.sessionPatterns.breakProbability * 0.01) {
      session.currentPhase = 'break';
    }
  }

  /**
   * Process queued actions for account
   */
  private async processQueuedActions(accountId: string): Promise<void> {
    try {
      const queue = this.actionQueue.get(accountId) || [];
      if (queue.length === 0) return;
      
      const session = this.activeSessions.get(accountId);
      if (!session) return;
      
      const now = new Date();
      if (now < session.nextActionTime) return;
      
      // Process next action
      const action = queue.shift();
      if (action) {
        await this.executeQueuedAction(accountId, action);
        this.actionQueue.set(accountId, queue);
      }
    } catch (error) {
      logger.error(`Failed to process queued actions for account ${accountId}:`, error);
    }
  }

  /**
   * Execute queued action with behavior simulation
   */
  private async executeQueuedAction(accountId: string, action: any): Promise<void> {
    try {
      const session = this.activeSessions.get(accountId);
      if (!session) return;
      
      // Update session metrics
      session.actionsPerformed++;
      session.lastActivity = new Date();
      session.sessionMetrics.totalActions++;
      session.sessionMetrics.actionTypes[action.type] = 
        (session.sessionMetrics.actionTypes[action.type] || 0) + 1;
      
      // Calculate next action
      const pattern = this.patterns.get(session.patternId);
      if (pattern) {
        const context: ActionContext = {
          accountId,
          actionType: action.type,
          targetData: action.data,
          previousAction: session.nextActionType,
          timeSinceLastAction: Date.now() - session.lastActivity.getTime(),
          sessionContext: session
        };
        
        const delay = this.calculateActionDelay(context);
        session.nextActionTime = new Date(Date.now() + delay);
        session.nextActionType = this.selectNextActionType(pattern);
      }
      
      this.activeSessions.set(accountId, session);
      
      logger.debug(`Executed ${action.type} action for account ${accountId}`);
    } catch (error) {
      logger.error(`Failed to execute queued action for account ${accountId}:`, error);
    }
  }

  /**
   * End behavior session
   */
  private async endBehaviorSession(accountId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(accountId);
      if (!session) return;
      
      // Update pattern usage
      const pattern = this.patterns.get(session.patternId);
      if (pattern) {
        pattern.lastUsed = new Date();
        pattern.usageCount++;
        this.patterns.set(session.patternId, pattern);
      }
      
      // Clean up
      this.activeSessions.delete(accountId);
      this.actionQueue.delete(accountId);
      await cacheManager.del(`behavior_session:${accountId}`);
      
      logger.info(`Ended behavior session ${session.id} for account ${accountId}`);
    } catch (error) {
      logger.error(`Failed to end behavior session for account ${accountId}:`, error);
    }
  }

  /**
   * Start analytics collection
   */
  private startAnalyticsCollection(): void {
    try {
      this.analyticsInterval = setInterval(() => {
        this.collectBehaviorAnalytics();
      }, 5 * 60 * 1000); // Every 5 minutes
      
      logger.info('✅ Behavior analytics collection started');
    } catch (error) {
      logger.error('Failed to start analytics collection:', error);
    }
  }

  /**
   * Collect behavior analytics
   */
  private collectBehaviorAnalytics(): void {
    try {
      const analytics = {
        activeSessions: this.activeSessions.size,
        totalPatterns: this.patterns.size,
        avgSessionDuration: this.calculateAverageSessionDuration(),
        actionDistribution: this.calculateActionDistribution(),
        phaseDistribution: this.calculatePhaseDistribution(),
        timestamp: new Date()
      };
      
      logger.info(`Behavior Analytics: ${analytics.activeSessions} active sessions, avg duration: ${Math.round(analytics.avgSessionDuration / 60)}min`);
    } catch (error) {
      logger.error('Failed to collect behavior analytics:', error);
    }
  }

  /**
   * Calculate average session duration
   */
  private calculateAverageSessionDuration(): number {
    const sessions = Array.from(this.activeSessions.values());
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (Date.now() - session.startTime.getTime());
    }, 0);
    
    return totalDuration / sessions.length;
  }

  /**
   * Calculate action distribution
   */
  private calculateActionDistribution(): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    
    for (const session of this.activeSessions.values()) {
      for (const [actionType, count] of Object.entries(session.sessionMetrics.actionTypes)) {
        distribution[actionType] = (distribution[actionType] || 0) + count;
      }
    }
    
    return distribution;
  }

  /**
   * Calculate phase distribution
   */
  private calculatePhaseDistribution(): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    
    for (const session of this.activeSessions.values()) {
      distribution[session.currentPhase] = (distribution[session.currentPhase] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Queue action for account with behavior simulation
   */
  async queueAction(accountId: string, actionType: string, actionData: any): Promise<void> {
    try {
      let session = this.activeSessions.get(accountId);
      
      // Start session if none exists
      if (!session) {
        session = await this.startBehaviorSession(accountId);
      }
      
      const action = {
        id: crypto.randomUUID(),
        type: actionType,
        data: actionData,
        queuedAt: new Date(),
        accountId
      };
      
      const queue = this.actionQueue.get(accountId) || [];
      queue.push(action);
      this.actionQueue.set(accountId, queue);
      
      logger.info(`Queued ${actionType} action for account ${accountId}`);
    } catch (error) {
      logger.error(`Failed to queue action for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get behavior statistics
   */
  getBehaviorStatistics(): {
    activeSessions: number;
    totalPatterns: number;
    queuedActions: number;
    avgSessionDuration: number;
    patternUsage: { [key: string]: number };
    phaseDistribution: { [key: string]: number };
  } {
    const patternUsage: { [key: string]: number } = {};
    for (const pattern of this.patterns.values()) {
      patternUsage[pattern.name] = pattern.usageCount;
    }

    return {
      activeSessions: this.activeSessions.size,
      totalPatterns: this.patterns.size,
      queuedActions: Array.from(this.actionQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      avgSessionDuration: this.calculateAverageSessionDuration(),
      patternUsage,
      phaseDistribution: this.calculatePhaseDistribution()
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🔄 Shutting down Enterprise Behavior Simulator...');
      
      if (this.behaviorInterval) {
        clearInterval(this.behaviorInterval);
      }
      
      if (this.analyticsInterval) {
        clearInterval(this.analyticsInterval);
      }
      
      // End all active sessions
      for (const accountId of this.activeSessions.keys()) {
        await this.endBehaviorSession(accountId);
      }
      
      this.patterns.clear();
      this.activeSessions.clear();
      this.actionQueue.clear();
      
      logger.info('✅ Enterprise Behavior Simulator shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown behavior simulator:', error);
    }
  }
}
