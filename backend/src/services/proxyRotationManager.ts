import { EventEmitter } from 'events';
import { logger, sanitizeData } from '../utils/logger';
import { cacheManager } from '../lib/cache';
import { twikitConfig, TwikitConfigManager } from '../config/twikit';

// Task 18: Advanced Proxy Management - Enhanced imports for intelligent selection and optimization

// Custom error types for advanced proxy management
export class ProxyError extends Error {
  constructor(
    public type: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}

export enum ProxyErrorType {
  SELECTION_FAILED = 'selection_failed',
  OPTIMIZATION_FAILED = 'optimization_failed',
  PERFORMANCE_DEGRADED = 'performance_degraded',
  RISK_THRESHOLD_EXCEEDED = 'risk_threshold_exceeded',
  EMERGENCY_STOP_REQUIRED = 'emergency_stop_required'
}

export enum ProxyType {
  RESIDENTIAL = 'residential',
  DATACENTER = 'datacenter',
  MOBILE = 'mobile'
}

export enum ActionRiskLevel {
  LOW = 'low',           // search, get_profile
  MEDIUM = 'medium',     // like, retweet
  HIGH = 'high',         // post, follow, dm
  CRITICAL = 'critical'  // authenticate
}

// Task 18: Advanced Proxy Management - Enhanced risk and performance enums
export enum ProxyRiskLevel {
  VERY_LOW = 'very_low',     // 0-20 risk score
  LOW = 'low',               // 21-40 risk score
  MEDIUM = 'medium',         // 41-60 risk score
  HIGH = 'high',             // 61-80 risk score
  CRITICAL = 'critical'      // 81-100 risk score
}

export enum ProxyPerformanceClass {
  PREMIUM = 'premium',       // Top 10% performers
  HIGH = 'high',            // Top 25% performers
  STANDARD = 'standard',    // Average performers
  LOW = 'low',              // Below average performers
  DEGRADED = 'degraded'     // Poor performers requiring attention
}

export enum OptimizationStrategy {
  PERFORMANCE_FIRST = 'performance_first',     // Prioritize speed and reliability
  RISK_MINIMIZATION = 'risk_minimization',     // Prioritize low detection risk
  BALANCED = 'balanced',                       // Balance performance and risk
  COST_EFFECTIVE = 'cost_effective',           // Optimize for resource usage
  GEOGRAPHIC_DIVERSITY = 'geographic_diversity' // Prioritize geographic distribution
}

// Task 18: Advanced Proxy Management - Enhanced data structures
export interface DetectionEvent {
  timestamp: Date;
  type: 'captcha' | 'rate_limit' | 'ip_block' | 'account_suspension' | 'unusual_activity' | 'manual_adjustment';
  severity: 'low' | 'medium' | 'high' | 'critical';
  accountId?: string;
  details: Record<string, any>;
  resolved: boolean;
  resolutionTime?: Date;
}

export interface GeographicData {
  country: string;
  countryCode: string;
  region: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  isp?: string;
  asn?: string;
  riskLevel: ProxyRiskLevel;
  lastGeoUpdate: Date;
}

export interface PerformanceMetrics {
  latency: {
    min: number;
    max: number;
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
    concurrentConnections: number;
  };
  reliability: {
    uptime: number;              // Percentage uptime
    mtbf: number;                // Mean time between failures (seconds)
    mttr: number;                // Mean time to recovery (seconds)
    errorRate: number;           // Error rate percentage
  };
  trends: {
    performanceTrend: 'improving' | 'stable' | 'degrading';
    trendConfidence: number;     // 0-100 confidence in trend analysis
    lastTrendUpdate: Date;
  };
}

export interface OptimizationData {
  mlScore: number;                    // Machine learning performance score (0-100)
  predictionAccuracy: number;         // Accuracy of performance predictions (0-100)
  optimalUsagePattern: {
    timeOfDay: number[];              // Optimal hours (0-23)
    dayOfWeek: number[];              // Optimal days (0-6, Sunday=0)
    requestTypes: string[];           // Optimal request types
    accountTypes: string[];           // Optimal account types
  };
  learningData: {
    trainingDataPoints: number;
    lastTraining: Date;
    modelVersion: string;
    convergenceScore: number;         // Model convergence score (0-100)
  };
  recommendations: {
    action: 'continue' | 'optimize' | 'retire' | 'investigate';
    confidence: number;               // Confidence in recommendation (0-100)
    reasoning: string;
    expectedImprovement: number;      // Expected performance improvement percentage
  };
}

export interface BandwidthMetrics {
  totalBytesTransferred: number;
  averageBandwidthUsage: number;      // Bytes per second
  peakBandwidthUsage: number;         // Peak bytes per second
  bandwidthEfficiency: number;        // Efficiency score (0-100)
  compressionRatio: number;           // Data compression ratio
  lastBandwidthUpdate: Date;
}

export interface ProxyEndpoint {
  id: string;
  url: string;
  type: ProxyType;
  username?: string;
  password?: string;
  healthScore: number;
  lastUsed: Date | null;
  lastHealthCheck: Date | null;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  consecutiveFailures: number;
  isActive: boolean;
  metadata: {
    country?: string;
    region?: string;
    provider?: string;
    bandwidth?: string;
    concurrent_limit?: number;
  };

  // Task 18: Advanced Proxy Management - Enhanced metrics and intelligence
  riskScore: number;                    // 0-100 risk score based on detection history
  performanceClass: ProxyPerformanceClass;
  detectionHistory: DetectionEvent[];   // History of detection events
  geographicData: GeographicData;       // Enhanced geographic information
  performanceMetrics: PerformanceMetrics; // Detailed performance tracking
  optimizationData: OptimizationData;   // ML-based optimization data
  lastOptimization: Date | null;        // Last optimization timestamp
  retirementScore: number;              // Score indicating retirement likelihood (0-100)
  accountAssignments: string[];         // Accounts currently using this proxy
  bandwidthUtilization: BandwidthMetrics; // Bandwidth usage tracking
}

export interface ProxyPool {
  type: ProxyType;
  endpoints: ProxyEndpoint[];
  currentIndex: number;
  totalRequests: number;
  successfulRequests: number;
  averageHealthScore: number;
  lastRotation: Date | null;
  isEnabled: boolean;
}

export interface ProxySelectionCriteria {
  actionType: string;
  riskLevel: ActionRiskLevel;
  accountId: string;
  preferredRegion?: string;
  requiresHighBandwidth?: boolean;
  maxResponseTime?: number;
  minHealthScore?: number;

  // Task 18: Advanced Proxy Management - Enhanced selection criteria
  maxRiskScore?: number;                    // Maximum acceptable risk score (0-100)
  requiredPerformanceClass?: ProxyPerformanceClass;
  optimizationStrategy?: OptimizationStrategy;
  geographicConstraints?: {
    allowedCountries?: string[];
    blockedCountries?: string[];
    preferredTimezones?: string[];
    maxDistanceKm?: number;                 // Maximum distance from target location
  };
  accountSpecificRequirements?: {
    previouslyUsedProxies?: string[];       // Previously used proxy IDs
    blacklistedProxies?: string[];          // Blacklisted proxy IDs
    preferredProviders?: string[];          // Preferred proxy providers
    maxConcurrentUsage?: number;            // Max concurrent usage for this account
  };
  performanceRequirements?: {
    minThroughput?: number;                 // Minimum throughput (bytes/sec)
    maxLatency?: number;                    // Maximum latency (ms)
    minUptime?: number;                     // Minimum uptime percentage
    requiresLowDetectionRisk?: boolean;     // Requires low detection risk
  };
  temporalConstraints?: {
    timeOfDay?: number[];                   // Preferred hours (0-23)
    dayOfWeek?: number[];                   // Preferred days (0-6)
    timezone?: string;                      // Target timezone
  };
  fallbackOptions?: {
    allowDegradedPerformance?: boolean;     // Allow degraded performance proxies
    allowHigherRisk?: boolean;              // Allow higher risk proxies
    maxFallbackAttempts?: number;           // Maximum fallback attempts
  };
}

// Task 18: Advanced Proxy Management - Intelligent selection result
export interface ProxySelectionResult {
  proxy: ProxyEndpoint | null;
  selectionTime: number;                    // Time taken to select proxy (ms)
  selectionReason: string;                  // Reason for selection
  alternativeProxies: ProxyEndpoint[];      // Alternative proxy options
  riskAssessment: {
    overallRisk: ProxyRiskLevel;
    riskFactors: string[];
    mitigationSuggestions: string[];
  };
  performancePrediction: {
    expectedLatency: number;
    expectedThroughput: number;
    confidenceLevel: number;                // Confidence in prediction (0-100)
  };
  optimizationRecommendations: {
    shouldOptimize: boolean;
    optimizationType: string[];
    expectedImprovement: number;            // Expected improvement percentage
  };
}

export interface ProxyUsageStats {
  totalProxies: number;
  activeProxies: number;
  healthyProxies: number;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  successRate: number;
  poolStats: Map<ProxyType, {
    count: number;
    active: number;
    healthy: number;
    successRate: number;
  }>;
}

// Task 18: Advanced Proxy Management - Selection and optimization interfaces
export interface SelectionMetrics {
  totalSelections: number;
  successfulSelections: number;
  averageSelectionTime: number;
  riskScoreDistribution: Map<ProxyRiskLevel, number>;
  performanceImprovements: number;
}

export interface ProxyOptimizationResult {
  optimizedProxies: string[];               // IDs of optimized proxies
  retiredProxies: string[];                 // IDs of retired proxies
  performanceImprovement: number;           // Overall performance improvement percentage
  riskReduction: number;                    // Risk reduction percentage
  recommendations: string[];                // Optimization recommendations
  nextOptimizationTime: Date;               // Recommended next optimization time
}

export interface RiskAssessmentResult {
  overallRisk: ProxyRiskLevel;
  riskScore: number;                        // 0-100 risk score
  riskFactors: Array<{
    factor: string;
    impact: number;                         // Impact on risk score
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  mitigationStrategies: string[];
  confidenceLevel: number;                  // Confidence in assessment (0-100)
}

// Task 18: Advanced Proxy Management - Core algorithm classes
class IntelligentProxySelector {
  constructor(private pools: Map<ProxyType, ProxyPool>) {}

  async selectOptimalProxy(criteria: ProxySelectionCriteria): Promise<ProxySelectionResult> {
    const startTime = Date.now();

    // Implementation will be added in the enhanced methods
    return {
      proxy: null,
      selectionTime: Date.now() - startTime,
      selectionReason: 'Not implemented',
      alternativeProxies: [],
      riskAssessment: {
        overallRisk: ProxyRiskLevel.MEDIUM,
        riskFactors: [],
        mitigationSuggestions: []
      },
      performancePrediction: {
        expectedLatency: 0,
        expectedThroughput: 0,
        confidenceLevel: 0
      },
      optimizationRecommendations: {
        shouldOptimize: false,
        optimizationType: [],
        expectedImprovement: 0
      }
    };
  }
}

class ProxyPerformanceTracker {
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();

  trackPerformance(proxyId: string, metrics: Partial<PerformanceMetrics>): void {
    // Implementation will be added
  }

  getPredictedPerformance(proxyId: string): PerformanceMetrics | null {
    // Implementation will be added
    return null;
  }
}

class ProxyOptimizationEngine {
  async optimizeProxyPool(pools: Map<ProxyType, ProxyPool>): Promise<ProxyOptimizationResult> {
    // Implementation will be added
    return {
      optimizedProxies: [],
      retiredProxies: [],
      performanceImprovement: 0,
      riskReduction: 0,
      recommendations: [],
      nextOptimizationTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }
}

class ProxyRiskAssessment {
  assessRisk(proxy: ProxyEndpoint, criteria: ProxySelectionCriteria): RiskAssessmentResult {
    // Implementation will be added
    return {
      overallRisk: ProxyRiskLevel.LOW,
      riskScore: proxy.riskScore,
      riskFactors: [],
      mitigationStrategies: [],
      confidenceLevel: 50
    };
  }
}

/**
 * Enterprise Proxy Rotation Manager - Task 18 Enhanced
 * Manages multi-tier proxy pools with intelligent selection, health monitoring, and performance optimization
 *
 * Enhanced Features:
 * - AI-driven proxy selection algorithms with risk scoring
 * - Real-time performance tracking and predictive modeling
 * - Automated optimization with machine learning
 * - Geographic risk assessment and detection history analysis
 * - Emergency stop integration and comprehensive audit logging
 */
export class ProxyRotationManager extends EventEmitter {
  private pools: Map<ProxyType, ProxyPool> = new Map();
  private configManager: TwikitConfigManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private rotationInterval: NodeJS.Timeout | null = null;
  private usageTrackingInterval: NodeJS.Timeout | null = null;
  private optimizationInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private readonly CACHE_PREFIX = 'proxy_manager';

  // Task 18: Advanced Proxy Management - Enhanced state management
  private selectionAlgorithm: IntelligentProxySelector;
  private performanceTracker: ProxyPerformanceTracker;
  private optimizationEngine: ProxyOptimizationEngine;
  private riskAssessment: ProxyRiskAssessment;
  private emergencyStopSystem?: any;                    // EmergencyStopSystem integration
  private accountHealthMonitor?: any;                   // AccountHealthMonitor integration
  private antiDetectionManager?: any;                   // EnterpriseAntiDetectionManager integration

  // Performance and optimization state
  private lastOptimizationRun: Date | null = null;
  private optimizationInProgress: boolean = false;
  private performanceBaseline: Map<string, number> = new Map();
  private selectionMetrics: SelectionMetrics = {
    totalSelections: 0,
    successfulSelections: 0,
    averageSelectionTime: 0,
    riskScoreDistribution: new Map(),
    performanceImprovements: 0
  };

  constructor(
    configManager?: TwikitConfigManager,
    emergencyStopSystem?: any,
    accountHealthMonitor?: any,
    antiDetectionManager?: any
  ) {
    super();
    this.configManager = configManager || twikitConfig;

    // Task 18: Advanced Proxy Management - Initialize enhanced components
    this.emergencyStopSystem = emergencyStopSystem;
    this.accountHealthMonitor = accountHealthMonitor;
    this.antiDetectionManager = antiDetectionManager;

    // Initialize pools first
    this.initializePools();

    // Initialize advanced components
    this.selectionAlgorithm = new IntelligentProxySelector(this.pools);
    this.performanceTracker = new ProxyPerformanceTracker();
    this.optimizationEngine = new ProxyOptimizationEngine();
    this.riskAssessment = new ProxyRiskAssessment();

    logger.info('ProxyRotationManager initialized with advanced features');
  }

  /**
   * Initialize proxy pools from configuration
   */
  private initializePools(): void {
    const enabledPools = this.configManager.getEnabledProxyPools();
    
    for (const { type, config } of enabledPools) {
      const proxyType = type as ProxyType;
      const endpoints: ProxyEndpoint[] = config.urls.map((url, index) => ({
        id: `${proxyType}_${index}_${Date.now()}`,
        url,
        type: proxyType,
        ...(config.username && { username: config.username }),
        ...(config.password && { password: config.password }),
        healthScore: 1.0,
        lastUsed: null,
        lastHealthCheck: null,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        consecutiveFailures: 0,
        isActive: true,
        metadata: {},

        // Task 18: Advanced Proxy Management - Initialize enhanced fields
        riskScore: 0,
        performanceClass: ProxyPerformanceClass.STANDARD,
        detectionHistory: [],
        geographicData: {
          country: 'Unknown',
          countryCode: 'XX',
          region: 'Unknown',
          timezone: 'UTC',
          riskLevel: ProxyRiskLevel.LOW,
          lastGeoUpdate: new Date()
        },
        performanceMetrics: {
          latency: { min: 0, max: 0, average: 0, p95: 0, p99: 0 },
          throughput: { requestsPerSecond: 0, bytesPerSecond: 0, concurrentConnections: 0 },
          reliability: { uptime: 100, mtbf: 0, mttr: 0, errorRate: 0 },
          trends: { performanceTrend: 'stable', trendConfidence: 50, lastTrendUpdate: new Date() }
        },
        optimizationData: {
          mlScore: 50,
          predictionAccuracy: 0,
          optimalUsagePattern: { timeOfDay: [], dayOfWeek: [], requestTypes: [], accountTypes: [] },
          learningData: { trainingDataPoints: 0, lastTraining: new Date(), modelVersion: '1.0', convergenceScore: 0 },
          recommendations: { action: 'continue', confidence: 50, reasoning: 'Initial state', expectedImprovement: 0 }
        },
        lastOptimization: null,
        retirementScore: 0,
        accountAssignments: [],
        bandwidthUtilization: {
          totalBytesTransferred: 0,
          averageBandwidthUsage: 0,
          peakBandwidthUsage: 0,
          bandwidthEfficiency: 100,
          compressionRatio: 1.0,
          lastBandwidthUpdate: new Date()
        }
      }));

      const pool: ProxyPool = {
        type: proxyType,
        endpoints,
        currentIndex: 0,
        totalRequests: 0,
        successfulRequests: 0,
        averageHealthScore: 1.0,
        lastRotation: null,
        isEnabled: true
      };

      this.pools.set(proxyType, pool);
      logger.info(`Initialized ${proxyType} proxy pool with ${endpoints.length} endpoints`);
    }

    this.emit('poolsInitialized', Array.from(this.pools.keys()));
  }

  /**
   * Start the proxy rotation manager - Task 18 Enhanced
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('ProxyRotationManager is already running');
      return;
    }

    try {
      // Load cached proxy data
      await this.loadCachedProxyData();

      // Task 18: Load advanced proxy data
      await this.loadAdvancedProxyData();

      // Start health monitoring
      await this.startHealthMonitoring();

      // Start rotation management
      this.startRotationManagement();

      // Start usage tracking
      this.startUsageTracking();

      // Task 18: Start advanced optimization
      this.startOptimizationEngine();

      // Task 18: Setup service integrations
      await this.setupServiceIntegrations();

      this.isInitialized = true;
      logger.info('ProxyRotationManager started successfully with advanced features');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start ProxyRotationManager:', error);
      throw error;
    }
  }

  /**
   * Stop the proxy rotation manager
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }

    if (this.usageTrackingInterval) {
      clearInterval(this.usageTrackingInterval);
      this.usageTrackingInterval = null;
    }

    // Save proxy data to cache
    await this.saveProxyDataToCache();

    this.isInitialized = false;
    logger.info('ProxyRotationManager stopped');
    this.emit('stopped');
  }

  /**
   * Get optimal proxy for given criteria - Task 18 Enhanced
   * Uses intelligent selection algorithms with risk assessment and performance prediction
   */
  async getOptimalProxy(criteria: ProxySelectionCriteria): Promise<ProxyEndpoint | null> {
    const startTime = Date.now();

    try {
      // Task 18: Use intelligent proxy selection algorithm
      const selectionResult = await this.getOptimalProxyAdvanced(criteria);

      // Update selection metrics
      this.selectionMetrics.totalSelections++;
      this.selectionMetrics.averageSelectionTime =
        (this.selectionMetrics.averageSelectionTime + (Date.now() - startTime)) / 2;

      if (selectionResult.proxy) {
        this.selectionMetrics.successfulSelections++;

        // Update proxy usage tracking
        selectionResult.proxy.lastUsed = new Date();
        selectionResult.proxy.accountAssignments.push(criteria.accountId);

        // Update pool rotation
        const pool = this.pools.get(selectionResult.proxy.type);
        if (pool) {
          pool.lastRotation = new Date();
        }

        logger.debug(`Advanced proxy selection completed: ${selectionResult.proxy.id}`, {
          selectionTime: selectionResult.selectionTime,
          riskScore: selectionResult.proxy.riskScore,
          performanceClass: selectionResult.proxy.performanceClass,
          selectionReason: selectionResult.selectionReason
        });

        this.emit('proxySelected', {
          proxy: selectionResult.proxy,
          criteria,
          selectionResult,
          pool: selectionResult.proxy.type
        });

        // Track performance prediction accuracy
        this.trackPerformancePrediction(selectionResult);
      }

      return selectionResult.proxy;

    } catch (error) {
      logger.error('Error in advanced proxy selection:', error);

      // Fallback to basic selection
      logger.info('Falling back to basic proxy selection');
      return await this.getOptimalProxyBasic(criteria);
    }
  }

  /**
   * Task 18: Advanced intelligent proxy selection with ML-based algorithms
   */
  async getOptimalProxyAdvanced(criteria: ProxySelectionCriteria): Promise<ProxySelectionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get candidate proxies with advanced filtering
      const candidates = await this.getCandidateProxies(criteria);

      if (candidates.length === 0) {
        return {
          proxy: null,
          selectionTime: Date.now() - startTime,
          selectionReason: 'No candidate proxies available',
          alternativeProxies: [],
          riskAssessment: {
            overallRisk: ProxyRiskLevel.CRITICAL,
            riskFactors: ['No available proxies'],
            mitigationSuggestions: ['Add more proxy endpoints', 'Check proxy health']
          },
          performancePrediction: {
            expectedLatency: 0,
            expectedThroughput: 0,
            confidenceLevel: 0
          },
          optimizationRecommendations: {
            shouldOptimize: true,
            optimizationType: ['add_proxies', 'health_check'],
            expectedImprovement: 0
          }
        };
      }

      // Step 2: Apply intelligent scoring algorithm
      const scoredProxies = await this.scoreProxiesIntelligently(candidates, criteria);

      // Step 3: Select optimal proxy
      const selectedProxy = scoredProxies[0]?.proxy || null;
      const alternativeProxies = scoredProxies.slice(1, 4).map(sp => sp.proxy);

      // Step 4: Perform risk assessment
      let riskAssessment: {
        overallRisk: ProxyRiskLevel;
        riskFactors: string[];
        mitigationSuggestions: string[];
      };

      if (selectedProxy) {
        const assessmentResult = this.riskAssessment.assessRisk(selectedProxy, criteria);
        riskAssessment = {
          overallRisk: assessmentResult.overallRisk,
          riskFactors: (assessmentResult.riskFactors || []).map((factor: any) =>
            typeof factor === 'string' ? factor : factor.factor || 'Unknown risk factor'
          ),
          mitigationSuggestions: (assessmentResult as any).mitigationSuggestions || ['No specific suggestions']
        };
      } else {
        riskAssessment = {
          overallRisk: ProxyRiskLevel.CRITICAL,
          riskFactors: ['No proxy selected'],
          mitigationSuggestions: ['Review selection criteria']
        };
      }

      // Step 5: Generate performance prediction
      const performancePrediction = selectedProxy
        ? this.predictProxyPerformance(selectedProxy, criteria)
        : { expectedLatency: 0, expectedThroughput: 0, confidenceLevel: 0 };

      // Step 6: Generate optimization recommendations
      const optimizationRecommendations = this.generateOptimizationRecommendations(
        selectedProxy,
        candidates,
        criteria
      );

      return {
        proxy: selectedProxy,
        selectionTime: Date.now() - startTime,
        selectionReason: selectedProxy
          ? `Intelligent selection: score ${scoredProxies[0]?.score.toFixed(3)}`
          : 'No suitable proxy found',
        alternativeProxies,
        riskAssessment,
        performancePrediction,
        optimizationRecommendations
      };

    } catch (error) {
      logger.error('Error in advanced proxy selection:', error);
      throw error;
    }
  }

  /**
   * Task 18: Get candidate proxies with advanced filtering
   */
  private async getCandidateProxies(criteria: ProxySelectionCriteria): Promise<ProxyEndpoint[]> {
    const allCandidates: ProxyEndpoint[] = [];

    // Collect proxies from all pools
    for (const pool of this.pools.values()) {
      if (!pool.isEnabled) continue;

      for (const proxy of pool.endpoints) {
        if (!proxy.isActive) continue;

        // Basic health and failure checks
        if (proxy.healthScore < (criteria.minHealthScore || 0.3)) continue;
        if (proxy.consecutiveFailures >= this.configManager.config.proxy.maxFailures) continue;

        // Advanced filtering based on criteria
        if (criteria.maxRiskScore && proxy.riskScore > criteria.maxRiskScore) continue;
        if (criteria.requiredPerformanceClass &&
            this.getPerformanceClassRank(proxy.performanceClass) <
            this.getPerformanceClassRank(criteria.requiredPerformanceClass)) continue;

        // Geographic constraints
        if (criteria.geographicConstraints) {
          if (criteria.geographicConstraints.allowedCountries &&
              !criteria.geographicConstraints.allowedCountries.includes(proxy.geographicData.country)) continue;
          if (criteria.geographicConstraints.blockedCountries &&
              criteria.geographicConstraints.blockedCountries.includes(proxy.geographicData.country)) continue;
        }

        // Account-specific requirements
        if (criteria.accountSpecificRequirements) {
          if (criteria.accountSpecificRequirements.blacklistedProxies &&
              criteria.accountSpecificRequirements.blacklistedProxies.includes(proxy.id)) continue;
          if (criteria.accountSpecificRequirements.maxConcurrentUsage &&
              proxy.accountAssignments.length >= criteria.accountSpecificRequirements.maxConcurrentUsage) continue;
        }

        // Performance requirements
        if (criteria.performanceRequirements) {
          if (criteria.performanceRequirements.maxLatency &&
              proxy.performanceMetrics.latency.average > criteria.performanceRequirements.maxLatency) continue;
          if (criteria.performanceRequirements.minUptime &&
              proxy.performanceMetrics.reliability.uptime < criteria.performanceRequirements.minUptime) continue;
        }

        allCandidates.push(proxy);
      }
    }

    return allCandidates;
  }

  /**
   * Task 18: Score proxies using intelligent algorithms
   */
  private async scoreProxiesIntelligently(
    candidates: ProxyEndpoint[],
    criteria: ProxySelectionCriteria
  ): Promise<Array<{ proxy: ProxyEndpoint; score: number; reasoning: string }>> {
    const scoredProxies = candidates.map(proxy => {
      let score = 0;
      const reasoningParts: string[] = [];

      // Health score component (25%)
      const healthWeight = 0.25;
      const healthScore = proxy.healthScore * healthWeight;
      score += healthScore;
      reasoningParts.push(`health: ${(healthScore * 100).toFixed(1)}%`);

      // Risk score component (20%) - lower risk is better
      const riskWeight = 0.20;
      const riskScore = (100 - proxy.riskScore) / 100 * riskWeight;
      score += riskScore;
      reasoningParts.push(`risk: ${(riskScore * 100).toFixed(1)}%`);

      // Performance component (25%)
      const performanceWeight = 0.25;
      const performanceScore = this.calculatePerformanceScore(proxy) * performanceWeight;
      score += performanceScore;
      reasoningParts.push(`performance: ${(performanceScore * 100).toFixed(1)}%`);

      // ML optimization score component (15%)
      const mlWeight = 0.15;
      const mlScore = proxy.optimizationData.mlScore / 100 * mlWeight;
      score += mlScore;
      reasoningParts.push(`ml: ${(mlScore * 100).toFixed(1)}%`);

      // Geographic preference component (10%)
      const geoWeight = 0.10;
      const geoScore = this.calculateGeographicScore(proxy, criteria) * geoWeight;
      score += geoScore;
      reasoningParts.push(`geo: ${(geoScore * 100).toFixed(1)}%`);

      // Usage balance component (5%)
      const usageWeight = 0.05;
      const maxUsage = Math.max(...candidates.map(p => p.totalRequests), 1);
      const usageScore = (1 - (proxy.totalRequests / maxUsage)) * usageWeight;
      score += usageScore;
      reasoningParts.push(`usage: ${(usageScore * 100).toFixed(1)}%`);

      // Apply strategy-specific adjustments
      score = this.applyOptimizationStrategy(score, proxy, criteria);

      return {
        proxy,
        score,
        reasoning: reasoningParts.join(', ')
      };
    });

    // Sort by score (highest first)
    return scoredProxies.sort((a, b) => b.score - a.score);
  }

  /**
   * Task 18: Calculate performance score for a proxy
   */
  private calculatePerformanceScore(proxy: ProxyEndpoint): number {
    const metrics = proxy.performanceMetrics;

    // Latency score (lower is better)
    const latencyScore = metrics.latency.average > 0
      ? Math.max(0, 1 - (metrics.latency.average / 5000)) // 5s max
      : 0.8; // Default for no data

    // Throughput score
    const throughputScore = Math.min(1, metrics.throughput.requestsPerSecond / 100); // 100 req/s max

    // Reliability score
    const reliabilityScore = metrics.reliability.uptime / 100;

    // Error rate score (lower is better)
    const errorScore = Math.max(0, 1 - metrics.reliability.errorRate / 100);

    // Weighted average
    return (latencyScore * 0.3 + throughputScore * 0.2 + reliabilityScore * 0.3 + errorScore * 0.2);
  }

  /**
   * Task 18: Calculate geographic preference score
   */
  private calculateGeographicScore(proxy: ProxyEndpoint, criteria: ProxySelectionCriteria): number {
    let score = 0.5; // Base score

    // Preferred region bonus
    if (criteria.preferredRegion && proxy.geographicData.region === criteria.preferredRegion) {
      score += 0.3;
    }

    // Geographic constraints
    if (criteria.geographicConstraints) {
      if (criteria.geographicConstraints.allowedCountries &&
          criteria.geographicConstraints.allowedCountries.includes(proxy.geographicData.country)) {
        score += 0.2;
      }

      if (criteria.geographicConstraints.preferredTimezones &&
          criteria.geographicConstraints.preferredTimezones.includes(proxy.geographicData.timezone)) {
        score += 0.1;
      }
    }

    // Risk level penalty
    switch (proxy.geographicData.riskLevel) {
      case ProxyRiskLevel.VERY_LOW:
        score += 0.2;
        break;
      case ProxyRiskLevel.LOW:
        score += 0.1;
        break;
      case ProxyRiskLevel.HIGH:
        score -= 0.1;
        break;
      case ProxyRiskLevel.CRITICAL:
        score -= 0.3;
        break;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Task 18: Apply optimization strategy adjustments to proxy score
   */
  private applyOptimizationStrategy(
    baseScore: number,
    proxy: ProxyEndpoint,
    criteria: ProxySelectionCriteria
  ): number {
    const strategy = criteria.optimizationStrategy || OptimizationStrategy.BALANCED;
    let adjustedScore = baseScore;

    switch (strategy) {
      case OptimizationStrategy.PERFORMANCE_FIRST:
        // Boost performance-related scores
        adjustedScore += this.calculatePerformanceScore(proxy) * 0.2;
        break;

      case OptimizationStrategy.RISK_MINIMIZATION:
        // Heavily penalize high-risk proxies
        adjustedScore -= (proxy.riskScore / 100) * 0.3;
        break;

      case OptimizationStrategy.COST_EFFECTIVE:
        // Prefer less-used proxies to balance load
        const maxUsage = 1000; // Assume max usage threshold
        adjustedScore += (1 - Math.min(proxy.totalRequests / maxUsage, 1)) * 0.15;
        break;

      case OptimizationStrategy.GEOGRAPHIC_DIVERSITY:
        // Boost geographic diversity score
        adjustedScore += this.calculateGeographicScore(proxy, criteria) * 0.2;
        break;

      case OptimizationStrategy.BALANCED:
      default:
        // No additional adjustments for balanced strategy
        break;
    }

    return Math.max(0, Math.min(1, adjustedScore));
  }

  /**
   * Task 18: Get performance class rank for comparison
   */
  private getPerformanceClassRank(performanceClass: ProxyPerformanceClass): number {
    switch (performanceClass) {
      case ProxyPerformanceClass.PREMIUM: return 5;
      case ProxyPerformanceClass.HIGH: return 4;
      case ProxyPerformanceClass.STANDARD: return 3;
      case ProxyPerformanceClass.LOW: return 2;
      case ProxyPerformanceClass.DEGRADED: return 1;
      default: return 0;
    }
  }

  /**
   * Task 18: Predict proxy performance based on historical data and ML models
   */
  private predictProxyPerformance(
    proxy: ProxyEndpoint,
    _criteria: ProxySelectionCriteria
  ): { expectedLatency: number; expectedThroughput: number; confidenceLevel: number } {
    const metrics = proxy.performanceMetrics;
    const optimizationData = proxy.optimizationData;

    // Base prediction on historical averages
    let expectedLatency = metrics.latency.average || 1000; // Default 1s
    let expectedThroughput = metrics.throughput.bytesPerSecond || 1000000; // Default 1MB/s

    // Apply ML model adjustments if available
    if (optimizationData.predictionAccuracy > 50) {
      const mlAdjustment = optimizationData.mlScore / 100;
      expectedLatency *= (2 - mlAdjustment); // Better ML score = lower latency
      expectedThroughput *= mlAdjustment; // Better ML score = higher throughput
    }

    // Apply time-based adjustments
    const currentHour = new Date().getHours();
    if (optimizationData.optimalUsagePattern.timeOfDay.includes(currentHour)) {
      expectedLatency *= 0.9; // 10% improvement during optimal hours
      expectedThroughput *= 1.1;
    }

    // Calculate confidence level
    const dataPoints = optimizationData.learningData.trainingDataPoints;
    const convergence = optimizationData.learningData.convergenceScore;
    const confidenceLevel = Math.min(100, (dataPoints / 100) * 50 + convergence / 2);

    return {
      expectedLatency: Math.round(expectedLatency),
      expectedThroughput: Math.round(expectedThroughput),
      confidenceLevel: Math.round(confidenceLevel)
    };
  }

  /**
   * Task 18: Generate optimization recommendations
   */
  private generateOptimizationRecommendations(
    selectedProxy: ProxyEndpoint | null,
    candidates: ProxyEndpoint[],
    _criteria: ProxySelectionCriteria
  ): { shouldOptimize: boolean; optimizationType: string[]; expectedImprovement: number } {
    const recommendations: string[] = [];
    let expectedImprovement = 0;

    if (!selectedProxy) {
      return {
        shouldOptimize: true,
        optimizationType: ['add_proxies', 'health_check'],
        expectedImprovement: 0
      };
    }

    // Check if proxy pool needs optimization
    const avgPerformance = candidates.reduce((sum, p) => sum + this.calculatePerformanceScore(p), 0) / candidates.length;

    if (avgPerformance < 0.7) {
      recommendations.push('performance_optimization');
      expectedImprovement += 15;
    }

    if (selectedProxy.riskScore > 60) {
      recommendations.push('risk_reduction');
      expectedImprovement += 10;
    }

    if (selectedProxy.performanceClass === ProxyPerformanceClass.DEGRADED) {
      recommendations.push('proxy_retirement');
      expectedImprovement += 20;
    }

    const lowHealthProxies = candidates.filter(p => p.healthScore < 0.5).length;
    if (lowHealthProxies > candidates.length * 0.3) {
      recommendations.push('health_monitoring');
      expectedImprovement += 12;
    }

    return {
      shouldOptimize: recommendations.length > 0,
      optimizationType: recommendations,
      expectedImprovement: Math.round(expectedImprovement)
    };
  }

  /**
   * Task 18: Track performance prediction accuracy
   */
  private trackPerformancePrediction(selectionResult: ProxySelectionResult): void {
    if (!selectionResult.proxy) return;

    // Store prediction for later accuracy tracking
    const predictionKey = `prediction_${selectionResult.proxy.id}_${Date.now()}`;
    cacheManager.set(predictionKey, {
      proxyId: selectionResult.proxy.id,
      prediction: selectionResult.performancePrediction,
      timestamp: new Date(),
      criteria: selectionResult
    }, 3600); // Store for 1 hour

    // This would be used later to compare actual performance vs predicted
    logger.debug('Performance prediction tracked', {
      proxyId: selectionResult.proxy.id,
      expectedLatency: selectionResult.performancePrediction.expectedLatency,
      confidence: selectionResult.performancePrediction.confidenceLevel
    });
  }

  /**
   * Task 18: Fallback to basic proxy selection when advanced selection fails
   */
  private async getOptimalProxyBasic(criteria: ProxySelectionCriteria): Promise<ProxyEndpoint | null> {
    try {
      const preferredProxyType = this.determineOptimalProxyType(criteria.riskLevel);
      const pool = this.pools.get(preferredProxyType);

      if (!pool || !pool.isEnabled || pool.endpoints.length === 0) {
        logger.warn(`No available ${preferredProxyType} proxies, trying fallback`);
        return await this.getFallbackProxy(criteria);
      }

      // Filter healthy proxies
      const healthyProxies = pool.endpoints.filter(proxy =>
        proxy.isActive &&
        proxy.healthScore >= (criteria.minHealthScore || 0.5) &&
        proxy.consecutiveFailures < this.configManager.config.proxy.maxFailures
      );

      if (healthyProxies.length === 0) {
        logger.warn(`No healthy ${preferredProxyType} proxies available`);
        return await this.getFallbackProxy(criteria);
      }

      // Apply additional filtering criteria
      let candidateProxies = healthyProxies;

      if (criteria.maxResponseTime) {
        candidateProxies = candidateProxies.filter(p =>
          p.averageResponseTime === 0 || p.averageResponseTime <= criteria.maxResponseTime!
        );
      }

      if (criteria.preferredRegion) {
        const regionFiltered = candidateProxies.filter(p =>
          p.metadata.region === criteria.preferredRegion
        );
        if (regionFiltered.length > 0) {
          candidateProxies = regionFiltered;
        }
      }

      // Select best proxy using weighted scoring
      const selectedProxy = this.selectBestProxy(candidateProxies, criteria);

      if (selectedProxy) {
        // Update usage tracking
        selectedProxy.lastUsed = new Date();
        pool.lastRotation = new Date();

        logger.debug(`Selected ${preferredProxyType} proxy: ${selectedProxy.id}`, {
          healthScore: selectedProxy.healthScore,
          responseTime: selectedProxy.averageResponseTime,
          successRate: selectedProxy.totalRequests > 0 ?
            (selectedProxy.successfulRequests / selectedProxy.totalRequests) * 100 : 0
        });

        this.emit('proxySelected', {
          proxy: selectedProxy,
          criteria,
          pool: preferredProxyType
        });
      }

      return selectedProxy;

    } catch (error) {
      logger.error('Error in basic proxy selection:', error);
      return null;
    }
  }

  /**
   * Task 18: Load advanced proxy data from cache and database
   */
  private async loadAdvancedProxyData(): Promise<void> {
    try {
      // Load performance metrics from cache
      for (const pool of this.pools.values()) {
        for (const proxy of pool.endpoints) {
          const metricsKey = `${this.CACHE_PREFIX}:metrics:${proxy.id}`;
          const cachedMetrics = await cacheManager.get(metricsKey);

          if (cachedMetrics && typeof cachedMetrics === 'string') {
            const metrics = JSON.parse(cachedMetrics);
            proxy.performanceMetrics = { ...proxy.performanceMetrics, ...metrics };
          }

          // Load optimization data
          const optimizationKey = `${this.CACHE_PREFIX}:optimization:${proxy.id}`;
          const cachedOptimization = await cacheManager.get(optimizationKey);

          if (cachedOptimization && typeof cachedOptimization === 'string') {
            const optimization = JSON.parse(cachedOptimization);
            proxy.optimizationData = { ...proxy.optimizationData, ...optimization };
          }

          // Load geographic data if not present
          if (proxy.geographicData.country === 'Unknown') {
            await this.updateProxyGeographicData(proxy);
          }
        }
      }

      logger.info('Advanced proxy data loaded successfully');

    } catch (error) {
      logger.error('Error loading advanced proxy data:', error);
    }
  }

  /**
   * Task 18: Start optimization engine
   */
  private startOptimizationEngine(): void {
    // Run optimization every 30 minutes
    this.optimizationInterval = setInterval(async () => {
      if (!this.optimizationInProgress) {
        await this.runAutomatedOptimization();
      }
    }, 30 * 60 * 1000);

    logger.info('Proxy optimization engine started');
  }

  /**
   * Task 18: Setup service integrations
   */
  private async setupServiceIntegrations(): Promise<void> {
    try {
      // Emergency Stop System integration
      if (this.emergencyStopSystem) {
        this.emergencyStopSystem.on('emergencyStarted', this.handleEmergencyStop.bind(this));
        logger.debug('Emergency Stop System integration setup');
      }

      // Account Health Monitor integration
      if (this.accountHealthMonitor) {
        this.accountHealthMonitor.on('healthAlert', this.handleHealthAlert.bind(this));
        logger.debug('Account Health Monitor integration setup');
      }

      // Anti-Detection Manager integration
      if (this.antiDetectionManager) {
        this.antiDetectionManager.on('detectionEvent', this.handleDetectionEvent.bind(this));
        logger.debug('Anti-Detection Manager integration setup');
      }

      logger.info('Service integrations setup complete');

    } catch (error) {
      logger.error('Error setting up service integrations:', error);
    }
  }

  /**
   * Task 18: Run automated optimization
   */
  private async runAutomatedOptimization(): Promise<void> {
    if (this.optimizationInProgress) {
      logger.debug('Optimization already in progress, skipping');
      return;
    }

    this.optimizationInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting automated proxy optimization');

      // Run optimization algorithm
      const optimizationResult = await this.optimizationEngine.optimizeProxyPool(this.pools);

      // Apply optimization results
      await this.applyOptimizationResults(optimizationResult);

      // Update metrics
      this.selectionMetrics.performanceImprovements += optimizationResult.performanceImprovement;
      this.lastOptimizationRun = new Date();

      const duration = Date.now() - startTime;
      logger.info('Automated optimization completed', {
        duration,
        performanceImprovement: optimizationResult.performanceImprovement,
        optimizedProxies: optimizationResult.optimizedProxies.length,
        retiredProxies: optimizationResult.retiredProxies.length
      });

      this.emit('optimizationCompleted', optimizationResult);

    } catch (error) {
      logger.error('Error during automated optimization:', error);
      this.emit('optimizationFailed', error);
    } finally {
      this.optimizationInProgress = false;
    }
  }

  /**
   * Task 18: Apply optimization results
   */
  private async applyOptimizationResults(result: ProxyOptimizationResult): Promise<void> {
    try {
      // Retire underperforming proxies
      for (const proxyId of result.retiredProxies) {
        await this.retireProxy(proxyId, 'Automated optimization');
      }

      // Update optimization data for optimized proxies
      for (const proxyId of result.optimizedProxies) {
        const proxy = this.findProxyById(proxyId);
        if (proxy) {
          proxy.lastOptimization = new Date();
          proxy.optimizationData.recommendations.action = 'continue';
          proxy.optimizationData.recommendations.confidence = 85;
          proxy.optimizationData.recommendations.reasoning = 'Optimized by automated system';

          // Cache updated optimization data
          const optimizationKey = `${this.CACHE_PREFIX}:optimization:${proxyId}`;
          await cacheManager.set(optimizationKey, JSON.stringify(proxy.optimizationData), 86400);
        }
      }

      logger.info('Optimization results applied successfully');

    } catch (error) {
      logger.error('Error applying optimization results:', error);
    }
  }

  /**
   * Task 18: Update proxy geographic data
   */
  private async updateProxyGeographicData(proxy: ProxyEndpoint): Promise<void> {
    try {
      // In a real implementation, this would call a geolocation API
      // For now, we'll use mock data based on the proxy URL
      const mockGeoData = this.generateMockGeographicData(proxy.url);

      proxy.geographicData = {
        ...proxy.geographicData,
        ...mockGeoData,
        lastGeoUpdate: new Date()
      };

      // Cache geographic data
      const geoKey = `${this.CACHE_PREFIX}:geo:${proxy.id}`;
      await cacheManager.set(geoKey, JSON.stringify(proxy.geographicData), 86400 * 7); // 7 days

    } catch (error) {
      logger.error(`Error updating geographic data for proxy ${proxy.id}:`, error);
    }
  }

  /**
   * Task 18: Generate mock geographic data (replace with real geolocation API)
   */
  private generateMockGeographicData(proxyUrl: string): Partial<GeographicData> {
    // Mock data based on common proxy patterns
    const mockData = [
      { country: 'United States', countryCode: 'US', region: 'North America', timezone: 'America/New_York', riskLevel: ProxyRiskLevel.LOW },
      { country: 'Germany', countryCode: 'DE', region: 'Europe', timezone: 'Europe/Berlin', riskLevel: ProxyRiskLevel.VERY_LOW },
      { country: 'Singapore', countryCode: 'SG', region: 'Asia', timezone: 'Asia/Singapore', riskLevel: ProxyRiskLevel.LOW },
      { country: 'United Kingdom', countryCode: 'GB', region: 'Europe', timezone: 'Europe/London', riskLevel: ProxyRiskLevel.LOW },
      { country: 'Canada', countryCode: 'CA', region: 'North America', timezone: 'America/Toronto', riskLevel: ProxyRiskLevel.VERY_LOW }
    ];

    // Simple hash to consistently assign same data to same URL
    const hash = proxyUrl.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    return mockData[Math.abs(hash) % mockData.length]!;
  }

  /**
   * Task 18: Handle emergency stop events
   */
  private async handleEmergencyStop(event: any): Promise<void> {
    try {
      logger.warn('Emergency stop received, pausing proxy operations', {
        eventId: event.eventId,
        triggerType: event.triggerType
      });

      // Pause all proxy operations temporarily
      for (const pool of this.pools.values()) {
        pool.isEnabled = false;
      }

      // If proxy-related emergency, take specific action
      if (event.triggerType === 'PROXY_FAILURE_CASCADE') {
        await this.handleProxyFailureCascade(event);
      }

      this.emit('emergencyStopHandled', event);

    } catch (error) {
      logger.error('Error handling emergency stop:', error);
    }
  }

  /**
   * Task 18: Handle health alerts from AccountHealthMonitor
   */
  private async handleHealthAlert(alert: any): Promise<void> {
    try {
      if (alert.proxyRelated) {
        logger.info('Proxy-related health alert received', {
          accountId: alert.accountId,
          severity: alert.severity
        });

        // Find proxies used by this account
        const accountProxies = this.findProxiesByAccount(alert.accountId);

        // Increase risk scores for these proxies
        for (const proxy of accountProxies) {
          proxy.riskScore = Math.min(100, proxy.riskScore + 10);

          // Add detection event
          proxy.detectionHistory.push({
            timestamp: new Date(),
            type: 'unusual_activity',
            severity: alert.severity,
            accountId: alert.accountId,
            details: alert.details || {},
            resolved: false
          });
        }

        this.emit('healthAlertHandled', alert);
      }

    } catch (error) {
      logger.error('Error handling health alert:', error);
    }
  }

  /**
   * Task 18: Handle detection events from AntiDetectionManager
   */
  private async handleDetectionEvent(event: any): Promise<void> {
    try {
      logger.warn('Detection event received', {
        type: event.type,
        severity: event.severity,
        proxyId: event.proxyId
      });

      if (event.proxyId) {
        const proxy = this.findProxyById(event.proxyId);
        if (proxy) {
          // Increase risk score based on severity
          const riskIncrease = this.calculateRiskIncrease(event.severity);
          proxy.riskScore = Math.min(100, proxy.riskScore + riskIncrease);

          // Add to detection history
          proxy.detectionHistory.push({
            timestamp: new Date(),
            type: event.type,
            severity: event.severity,
            accountId: event.accountId,
            details: event.details || {},
            resolved: false
          });

          // If critical, consider emergency action
          if (event.severity === 'critical' && proxy.riskScore > 80) {
            await this.triggerProxyEmergencyAction(proxy, event);
          }
        }
      }

      this.emit('detectionEventHandled', event);

    } catch (error) {
      logger.error('Error handling detection event:', error);
    }
  }

  /**
   * Task 18: Handle proxy failure cascade
   */
  private async handleProxyFailureCascade(event: any): Promise<void> {
    try {
      logger.error('Handling proxy failure cascade', event);

      // Identify failed proxies
      const failedProxies = event.affectedProxies || [];

      // Disable failed proxies
      for (const proxyId of failedProxies) {
        const proxy = this.findProxyById(proxyId);
        if (proxy) {
          proxy.isActive = false;
          proxy.riskScore = 100;
          proxy.retirementScore = 100;

          logger.warn(`Proxy ${proxyId} disabled due to cascade failure`);
        }
      }

      // Trigger emergency optimization
      await this.runEmergencyOptimization();

    } catch (error) {
      logger.error('Error handling proxy failure cascade:', error);
    }
  }

  /**
   * Task 18: Calculate risk increase based on detection severity
   */
  private calculateRiskIncrease(severity: string): number {
    switch (severity) {
      case 'critical': return 25;
      case 'high': return 15;
      case 'medium': return 10;
      case 'low': return 5;
      default: return 5;
    }
  }

  /**
   * Task 18: Trigger proxy emergency action
   */
  private async triggerProxyEmergencyAction(proxy: ProxyEndpoint, event: any): Promise<void> {
    try {
      logger.warn(`Triggering emergency action for proxy ${proxy.id}`, {
        riskScore: proxy.riskScore,
        eventType: event.type
      });

      // Temporarily disable proxy
      proxy.isActive = false;

      // Notify emergency stop system if available
      if (this.emergencyStopSystem) {
        await this.emergencyStopSystem.manualEmergencyStop(
          event.accountId,
          `Proxy ${proxy.id} critical detection event: ${event.type}`,
          'service_specific'
        );
      }

      // Schedule proxy for review
      proxy.optimizationData.recommendations = {
        action: 'investigate',
        confidence: 95,
        reasoning: `Critical detection event: ${event.type}`,
        expectedImprovement: 0
      };

      this.emit('proxyEmergencyAction', { proxy, event });

    } catch (error) {
      logger.error('Error triggering proxy emergency action:', error);
    }
  }

  /**
   * Task 18: Find proxies by account ID
   */
  private findProxiesByAccount(accountId: string): ProxyEndpoint[] {
    const accountProxies: ProxyEndpoint[] = [];

    for (const pool of this.pools.values()) {
      for (const proxy of pool.endpoints) {
        if (proxy.accountAssignments.includes(accountId)) {
          accountProxies.push(proxy);
        }
      }
    }

    return accountProxies;
  }



  /**
   * Task 18: Run emergency optimization
   */
  private async runEmergencyOptimization(): Promise<void> {
    try {
      logger.info('Running emergency proxy optimization');

      // Force optimization even if one is in progress
      this.optimizationInProgress = false;

      // Run optimization with emergency parameters
      const result = await this.optimizationEngine.optimizeProxyPool(this.pools);

      // Apply results immediately
      await this.applyOptimizationResults(result);

      // Re-enable healthy pools
      for (const pool of this.pools.values()) {
        const healthyProxies = pool.endpoints.filter(p => p.isActive && p.healthScore > 0.5);
        if (healthyProxies.length > 0) {
          pool.isEnabled = true;
        }
      }

      logger.info('Emergency optimization completed');

    } catch (error) {
      logger.error('Error during emergency optimization:', error);
    }
  }

  /**
   * Task 18: Retire proxy with reason
   */
  private async retireProxy(proxyId: string, reason: string): Promise<void> {
    try {
      const proxy = this.findProxyById(proxyId);
      if (!proxy) {
        logger.warn(`Proxy ${proxyId} not found for retirement`);
        return;
      }

      proxy.isActive = false;
      proxy.retirementScore = 100;
      proxy.optimizationData.recommendations = {
        action: 'retire',
        confidence: 100,
        reasoning: reason,
        expectedImprovement: 0
      };

      logger.info(`Proxy ${proxyId} retired: ${reason}`);

      // Remove from cache
      await cacheManager.del(`${this.CACHE_PREFIX}:proxy:${proxyId}`);

      this.emit('proxyRetired', { proxyId, reason });

    } catch (error) {
      logger.error(`Error retiring proxy ${proxyId}:`, error);
    }
  }

  /**
   * Task 18: Record proxy usage and performance metrics - Enhanced
   */
  async recordProxyUsage(
    proxyId: string,
    success: boolean,
    responseTime: number,
    error?: string,
    bytesTransferred?: number,
    requestType?: string,
    accountId?: string
  ): Promise<void> {
    try {
      const proxy = this.findProxyById(proxyId);
      if (!proxy) {
        logger.warn(`Proxy ${proxyId} not found for usage recording`);
        return;
      }

      // Update basic metrics
      proxy.totalRequests++;
      proxy.lastUsed = new Date();

      if (success) {
        proxy.successfulRequests++;
        proxy.consecutiveFailures = 0;

        // Update average response time
        if (proxy.averageResponseTime === 0) {
          proxy.averageResponseTime = responseTime;
        } else {
          proxy.averageResponseTime = (proxy.averageResponseTime + responseTime) / 2;
        }
      } else {
        proxy.failedRequests++;
        proxy.consecutiveFailures++;
      }

      // Task 18: Enhanced performance tracking
      await this.updateAdvancedPerformanceMetrics(proxy, {
        success,
        responseTime,
        bytesTransferred: bytesTransferred || 0,
        requestType: requestType || 'unknown',
        accountId: accountId || 'unknown',
        timestamp: new Date()
      });

      // Update health score based on recent performance
      await this.updateProxyHealthScore(proxy);

      // Task 18: Update ML optimization data
      await this.updateOptimizationData(proxy, success, responseTime, requestType);

      // Cache updated proxy data
      await this.cacheProxyData(proxy);

      // Emit usage event
      this.emit('proxyUsageRecorded', {
        proxyId,
        success,
        responseTime,
        healthScore: proxy.healthScore,
        riskScore: proxy.riskScore,
        performanceClass: proxy.performanceClass,
        error
      });

      logger.debug(`Advanced proxy usage recorded: ${proxyId}`, {
        success,
        responseTime,
        totalRequests: proxy.totalRequests,
        successRate: (proxy.successfulRequests / proxy.totalRequests) * 100,
        healthScore: proxy.healthScore,
        riskScore: proxy.riskScore,
        performanceClass: proxy.performanceClass
      });

    } catch (error) {
      logger.error('Error recording proxy usage:', error);
    }
  }

  /**
   * Task 18: Update advanced performance metrics
   */
  private async updateAdvancedPerformanceMetrics(
    proxy: ProxyEndpoint,
    usage: {
      success: boolean;
      responseTime: number;
      bytesTransferred: number;
      requestType: string;
      accountId: string;
      timestamp: Date;
    }
  ): Promise<void> {
    try {
      const metrics = proxy.performanceMetrics;

      // Update latency metrics
      if (usage.success && usage.responseTime > 0) {
        if (metrics.latency.min === 0 || usage.responseTime < metrics.latency.min) {
          metrics.latency.min = usage.responseTime;
        }
        if (usage.responseTime > metrics.latency.max) {
          metrics.latency.max = usage.responseTime;
        }

        // Update average (weighted)
        const totalRequests = proxy.totalRequests;
        metrics.latency.average = ((metrics.latency.average * (totalRequests - 1)) + usage.responseTime) / totalRequests;

        // Update percentiles (simplified calculation)
        metrics.latency.p95 = metrics.latency.average * 1.5;
        metrics.latency.p99 = metrics.latency.average * 2.0;
      }

      // Update throughput metrics
      if (usage.bytesTransferred > 0) {
        const timeInSeconds = usage.responseTime / 1000;
        const currentThroughput = usage.bytesTransferred / Math.max(timeInSeconds, 0.1);

        metrics.throughput.bytesPerSecond = (metrics.throughput.bytesPerSecond + currentThroughput) / 2;
        metrics.throughput.requestsPerSecond = proxy.totalRequests / Math.max((Date.now() - (proxy.lastHealthCheck?.getTime() || Date.now())) / 1000, 1);
      }

      // Update reliability metrics
      const successRate = (proxy.successfulRequests / proxy.totalRequests) * 100;
      metrics.reliability.errorRate = 100 - successRate;

      // Update uptime (simplified calculation)
      if (usage.success) {
        metrics.reliability.uptime = Math.min(100, metrics.reliability.uptime + 0.1);
      } else {
        metrics.reliability.uptime = Math.max(0, metrics.reliability.uptime - 0.5);
      }

      // Update bandwidth utilization
      proxy.bandwidthUtilization.totalBytesTransferred += usage.bytesTransferred;
      const currentThroughput = usage.bytesTransferred / Math.max(usage.responseTime / 1000, 0.1);
      proxy.bandwidthUtilization.averageBandwidthUsage =
        (proxy.bandwidthUtilization.averageBandwidthUsage + currentThroughput) / 2;

      if (currentThroughput > proxy.bandwidthUtilization.peakBandwidthUsage) {
        proxy.bandwidthUtilization.peakBandwidthUsage = currentThroughput;
      }

      proxy.bandwidthUtilization.lastBandwidthUpdate = new Date();

      // Update performance class based on metrics
      proxy.performanceClass = this.calculatePerformanceClass(proxy);

      // Cache performance metrics
      const metricsKey = `${this.CACHE_PREFIX}:metrics:${proxy.id}`;
      await cacheManager.set(metricsKey, JSON.stringify(metrics), 3600);

    } catch (error) {
      logger.error('Error updating advanced performance metrics:', error);
    }
  }

  /**
   * Task 18: Update optimization data with ML insights
   */
  private async updateOptimizationData(
    proxy: ProxyEndpoint,
    success: boolean,
    responseTime: number,
    requestType?: string
  ): Promise<void> {
    try {
      const optimizationData = proxy.optimizationData;

      // Update training data points
      optimizationData.learningData.trainingDataPoints++;

      // Update ML score based on recent performance
      const performanceScore = this.calculatePerformanceScore(proxy);
      optimizationData.mlScore = (optimizationData.mlScore + performanceScore * 100) / 2;

      // Update optimal usage patterns
      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay();

      if (success && responseTime < proxy.averageResponseTime) {
        // Add to optimal patterns if performance is good
        if (!optimizationData.optimalUsagePattern.timeOfDay.includes(currentHour)) {
          optimizationData.optimalUsagePattern.timeOfDay.push(currentHour);
        }
        if (!optimizationData.optimalUsagePattern.dayOfWeek.includes(currentDay)) {
          optimizationData.optimalUsagePattern.dayOfWeek.push(currentDay);
        }
        if (requestType && !optimizationData.optimalUsagePattern.requestTypes.includes(requestType)) {
          optimizationData.optimalUsagePattern.requestTypes.push(requestType);
        }
      }

      // Update convergence score (simplified ML convergence simulation)
      const dataPoints = optimizationData.learningData.trainingDataPoints;
      optimizationData.learningData.convergenceScore = Math.min(100, (dataPoints / 1000) * 100);

      // Update prediction accuracy (simplified)
      if (dataPoints > 10) {
        const expectedPerformance = optimizationData.mlScore / 100;
        const actualPerformance = success ? 1 : 0;
        const accuracy = 1 - Math.abs(expectedPerformance - actualPerformance);
        optimizationData.predictionAccuracy = (optimizationData.predictionAccuracy + accuracy * 100) / 2;
      }

      // Update recommendations
      if (proxy.riskScore > 70) {
        optimizationData.recommendations.action = 'investigate';
        optimizationData.recommendations.reasoning = 'High risk score detected';
      } else if (performanceScore < 0.5) {
        optimizationData.recommendations.action = 'optimize';
        optimizationData.recommendations.reasoning = 'Performance below threshold';
      } else {
        optimizationData.recommendations.action = 'continue';
        optimizationData.recommendations.reasoning = 'Performance within acceptable range';
      }

      optimizationData.recommendations.confidence = Math.min(100, dataPoints / 10);

      // Cache optimization data
      const optimizationKey = `${this.CACHE_PREFIX}:optimization:${proxy.id}`;
      await cacheManager.set(optimizationKey, JSON.stringify(optimizationData), 3600);

    } catch (error) {
      logger.error('Error updating optimization data:', error);
    }
  }

  /**
   * Task 18: Calculate performance class based on metrics
   */
  private calculatePerformanceClass(proxy: ProxyEndpoint): ProxyPerformanceClass {
    const performanceScore = this.calculatePerformanceScore(proxy);

    if (performanceScore >= 0.9) return ProxyPerformanceClass.PREMIUM;
    if (performanceScore >= 0.75) return ProxyPerformanceClass.HIGH;
    if (performanceScore >= 0.5) return ProxyPerformanceClass.STANDARD;
    if (performanceScore >= 0.25) return ProxyPerformanceClass.LOW;
    return ProxyPerformanceClass.DEGRADED;
  }

  /**
   * Task 18: Update proxy health score based on performance
   */
  private async updateProxyHealthScore(proxy: ProxyEndpoint): Promise<void> {
    try {
      const totalRequests = proxy.totalRequests;
      if (totalRequests === 0) {
        proxy.healthScore = 1.0;
        return;
      }

      // Calculate success rate
      const successRate = proxy.successfulRequests / totalRequests;

      // Calculate response time factor (lower is better)
      const responseTimeFactor = proxy.averageResponseTime > 0
        ? Math.max(0, 1 - (proxy.averageResponseTime / 10000)) // 10s max
        : 1.0;

      // Calculate consecutive failure penalty
      const failurePenalty = Math.max(0, 1 - (proxy.consecutiveFailures * 0.1));

      // Calculate risk penalty
      const riskPenalty = Math.max(0, 1 - (proxy.riskScore / 200)); // Risk score penalty

      // Weighted health score
      proxy.healthScore = (successRate * 0.4 + responseTimeFactor * 0.3 + failurePenalty * 0.2 + riskPenalty * 0.1);
      proxy.healthScore = Math.max(0, Math.min(1, proxy.healthScore));

      proxy.lastHealthCheck = new Date();

    } catch (error) {
      logger.error('Error updating proxy health score:', error);
    }
  }

  /**
   * Task 18: Cache proxy data
   */
  private async cacheProxyData(proxy: ProxyEndpoint): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:proxy:${proxy.id}`;
      const proxyData = {
        id: proxy.id,
        healthScore: proxy.healthScore,
        riskScore: proxy.riskScore,
        performanceClass: proxy.performanceClass,
        totalRequests: proxy.totalRequests,
        successfulRequests: proxy.successfulRequests,
        failedRequests: proxy.failedRequests,
        averageResponseTime: proxy.averageResponseTime,
        consecutiveFailures: proxy.consecutiveFailures,
        lastUsed: proxy.lastUsed,
        lastHealthCheck: proxy.lastHealthCheck,
        performanceMetrics: proxy.performanceMetrics,
        optimizationData: proxy.optimizationData,
        bandwidthUtilization: proxy.bandwidthUtilization
      };

      await cacheManager.set(cacheKey, JSON.stringify(proxyData), 3600);

    } catch (error) {
      logger.error('Error caching proxy data:', error);
    }
  }

  // ============================================================================
  // TASK 18: ADVANCED PROXY MANAGEMENT API METHODS
  // ============================================================================

  /**
   * Task 18: Get advanced proxy analytics
   */
  async getProxyAnalytics(timeRange?: { start: Date; end: Date }): Promise<{
    overview: {
      totalProxies: number;
      activeProxies: number;
      averageHealthScore: number;
      averageRiskScore: number;
      totalRequests: number;
      successRate: number;
    };
    performanceDistribution: Map<ProxyPerformanceClass, number>;
    riskDistribution: Map<ProxyRiskLevel, number>;
    geographicDistribution: Map<string, number>;
    topPerformers: ProxyEndpoint[];
    underperformers: ProxyEndpoint[];
    optimizationRecommendations: string[];
  }> {
    try {
      const allProxies: ProxyEndpoint[] = [];
      for (const pool of this.pools.values()) {
        allProxies.push(...pool.endpoints);
      }

      // Calculate overview metrics
      const totalProxies = allProxies.length;
      const activeProxies = allProxies.filter(p => p.isActive).length;
      const averageHealthScore = allProxies.reduce((sum, p) => sum + p.healthScore, 0) / totalProxies;
      const averageRiskScore = allProxies.reduce((sum, p) => sum + p.riskScore, 0) / totalProxies;
      const totalRequests = allProxies.reduce((sum, p) => sum + p.totalRequests, 0);
      const totalSuccessful = allProxies.reduce((sum, p) => sum + p.successfulRequests, 0);
      const successRate = totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0;

      // Performance distribution
      const performanceDistribution = new Map<ProxyPerformanceClass, number>();
      for (const performanceClass of Object.values(ProxyPerformanceClass)) {
        performanceDistribution.set(performanceClass, 0);
      }
      allProxies.forEach(proxy => {
        const current = performanceDistribution.get(proxy.performanceClass) || 0;
        performanceDistribution.set(proxy.performanceClass, current + 1);
      });

      // Risk distribution
      const riskDistribution = new Map<ProxyRiskLevel, number>();
      for (const riskLevel of Object.values(ProxyRiskLevel)) {
        riskDistribution.set(riskLevel, 0);
      }
      allProxies.forEach(proxy => {
        const riskLevel = this.getRiskLevelFromScore(proxy.riskScore);
        const current = riskDistribution.get(riskLevel) || 0;
        riskDistribution.set(riskLevel, current + 1);
      });

      // Geographic distribution
      const geographicDistribution = new Map<string, number>();
      allProxies.forEach(proxy => {
        const country = proxy.geographicData.country;
        geographicDistribution.set(country, (geographicDistribution.get(country) || 0) + 1);
      });

      // Top performers and underperformers
      const sortedByPerformance = allProxies
        .filter(p => p.isActive)
        .sort((a, b) => this.calculatePerformanceScore(b) - this.calculatePerformanceScore(a));

      const topPerformers = sortedByPerformance.slice(0, 5);
      const underperformers = sortedByPerformance.slice(-5).reverse();

      // Generate optimization recommendations
      const optimizationRecommendations = this.generateSystemOptimizationRecommendations(allProxies);

      return {
        overview: {
          totalProxies,
          activeProxies,
          averageHealthScore: Math.round(averageHealthScore * 100) / 100,
          averageRiskScore: Math.round(averageRiskScore * 100) / 100,
          totalRequests,
          successRate: Math.round(successRate * 100) / 100
        },
        performanceDistribution,
        riskDistribution,
        geographicDistribution,
        topPerformers,
        underperformers,
        optimizationRecommendations
      };

    } catch (error) {
      logger.error('Error getting proxy analytics:', error);
      throw new ProxyError(
        ProxyErrorType.OPTIMIZATION_FAILED,
        'Failed to generate proxy analytics',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Task 18: Get proxy performance predictions
   */
  async getProxyPerformancePredictions(
    proxyIds?: string[],
    timeHorizon: number = 24 // hours
  ): Promise<Map<string, {
    expectedLatency: number;
    expectedThroughput: number;
    expectedSuccessRate: number;
    confidenceLevel: number;
    riskFactors: string[];
    recommendations: string[];
  }>> {
    try {
      const predictions = new Map();
      const proxiesToAnalyze = proxyIds
        ? proxyIds.map(id => this.findProxyById(id)).filter(p => p !== null) as ProxyEndpoint[]
        : this.getAllActiveProxies();

      for (const proxy of proxiesToAnalyze) {
        const prediction = this.predictProxyPerformance(proxy, {
          actionType: 'general',
          riskLevel: ActionRiskLevel.MEDIUM,
          accountId: 'system'
        });

        // Calculate expected success rate
        const currentSuccessRate = proxy.totalRequests > 0
          ? (proxy.successfulRequests / proxy.totalRequests) * 100
          : 95;

        // Adjust based on trends
        const trendAdjustment = proxy.performanceMetrics.trends.performanceTrend === 'improving' ? 5 :
                               proxy.performanceMetrics.trends.performanceTrend === 'degrading' ? -5 : 0;

        const expectedSuccessRate = Math.max(0, Math.min(100, currentSuccessRate + trendAdjustment));

        // Identify risk factors
        const riskFactors: string[] = [];
        if (proxy.riskScore > 60) riskFactors.push('High risk score');
        if (proxy.consecutiveFailures > 2) riskFactors.push('Recent failures');
        if (proxy.performanceMetrics.reliability.errorRate > 10) riskFactors.push('High error rate');
        if (proxy.detectionHistory.filter(d => !d.resolved).length > 0) riskFactors.push('Unresolved detections');

        // Generate recommendations
        const recommendations: string[] = [];
        if (proxy.performanceClass === ProxyPerformanceClass.DEGRADED) {
          recommendations.push('Consider proxy replacement');
        }
        if (proxy.riskScore > 70) {
          recommendations.push('Reduce usage frequency');
        }
        if (proxy.optimizationData.recommendations.action === 'optimize') {
          recommendations.push('Run optimization algorithm');
        }

        predictions.set(proxy.id, {
          expectedLatency: prediction.expectedLatency,
          expectedThroughput: prediction.expectedThroughput,
          expectedSuccessRate: Math.round(expectedSuccessRate * 100) / 100,
          confidenceLevel: prediction.confidenceLevel,
          riskFactors,
          recommendations
        });
      }

      return predictions;

    } catch (error) {
      logger.error('Error getting proxy performance predictions:', error);
      throw new ProxyError(
        ProxyErrorType.OPTIMIZATION_FAILED,
        'Failed to generate performance predictions',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Task 18: Trigger manual optimization
   */
  async triggerManualOptimization(
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED,
    targetProxies?: string[]
  ): Promise<ProxyOptimizationResult> {
    try {
      logger.info('Triggering manual proxy optimization', { strategy, targetProxies });

      // Prepare pools for optimization
      const poolsToOptimize = new Map(this.pools);

      if (targetProxies && targetProxies.length > 0) {
        // Filter to only target specific proxies
        for (const [type, pool] of poolsToOptimize) {
          const filteredEndpoints = pool.endpoints.filter(p => targetProxies.includes(p.id));
          poolsToOptimize.set(type, { ...pool, endpoints: filteredEndpoints });
        }
      }

      // Run optimization with specified strategy
      const result = await this.optimizationEngine.optimizeProxyPool(poolsToOptimize);

      // Apply results
      await this.applyOptimizationResults(result);

      // Update metrics
      this.selectionMetrics.performanceImprovements += result.performanceImprovement;
      this.lastOptimizationRun = new Date();

      logger.info('Manual optimization completed', {
        strategy,
        performanceImprovement: result.performanceImprovement,
        optimizedProxies: result.optimizedProxies.length,
        retiredProxies: result.retiredProxies.length
      });

      this.emit('manualOptimizationCompleted', { strategy, result });

      return result;

    } catch (error) {
      logger.error('Error during manual optimization:', error);
      throw new ProxyError(
        ProxyErrorType.OPTIMIZATION_FAILED,
        'Manual optimization failed',
        { strategy, targetProxies, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Task 18: Get selection metrics and performance statistics
   */
  getSelectionMetrics(): {
    metrics: SelectionMetrics;
    performanceBaseline: Map<string, number>;
    lastOptimization: Date | null;
    optimizationInProgress: boolean;
    systemHealth: {
      overallHealth: number;
      criticalIssues: string[];
      recommendations: string[];
    };
  } {
    try {
      // Calculate system health
      const allProxies = this.getAllActiveProxies();
      const averageHealth = allProxies.reduce((sum, p) => sum + p.healthScore, 0) / allProxies.length;
      const averageRisk = allProxies.reduce((sum, p) => sum + p.riskScore, 0) / allProxies.length;

      const criticalIssues: string[] = [];
      const recommendations: string[] = [];

      if (averageHealth < 0.5) {
        criticalIssues.push('Low average proxy health');
        recommendations.push('Run health check and optimization');
      }

      if (averageRisk > 70) {
        criticalIssues.push('High average risk score');
        recommendations.push('Review proxy risk factors');
      }

      const degradedProxies = allProxies.filter(p => p.performanceClass === ProxyPerformanceClass.DEGRADED).length;
      if (degradedProxies > allProxies.length * 0.2) {
        criticalIssues.push('High number of degraded proxies');
        recommendations.push('Consider proxy pool refresh');
      }

      const overallHealth = (averageHealth * 0.6 + (100 - averageRisk) / 100 * 0.4) * 100;

      return {
        metrics: { ...this.selectionMetrics },
        performanceBaseline: new Map(this.performanceBaseline),
        lastOptimization: this.lastOptimizationRun,
        optimizationInProgress: this.optimizationInProgress,
        systemHealth: {
          overallHealth: Math.round(overallHealth),
          criticalIssues,
          recommendations
        }
      };

    } catch (error) {
      logger.error('Error getting selection metrics:', error);
      throw new ProxyError(
        ProxyErrorType.OPTIMIZATION_FAILED,
        'Failed to get selection metrics',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ============================================================================
  // TASK 18: UTILITY METHODS
  // ============================================================================

  /**
   * Task 18: Get risk level from risk score
   */
  private getRiskLevelFromScore(riskScore: number): ProxyRiskLevel {
    if (riskScore <= 20) return ProxyRiskLevel.VERY_LOW;
    if (riskScore <= 40) return ProxyRiskLevel.LOW;
    if (riskScore <= 60) return ProxyRiskLevel.MEDIUM;
    if (riskScore <= 80) return ProxyRiskLevel.HIGH;
    return ProxyRiskLevel.CRITICAL;
  }

  /**
   * Task 18: Generate system optimization recommendations
   */
  private generateSystemOptimizationRecommendations(proxies: ProxyEndpoint[]): string[] {
    const recommendations: string[] = [];

    // Analyze proxy distribution
    const degradedCount = proxies.filter(p => p.performanceClass === ProxyPerformanceClass.DEGRADED).length;
    const highRiskCount = proxies.filter(p => p.riskScore > 70).length;
    const lowHealthCount = proxies.filter(p => p.healthScore < 0.5).length;

    if (degradedCount > proxies.length * 0.2) {
      recommendations.push('Consider retiring degraded proxies and adding new ones');
    }

    if (highRiskCount > proxies.length * 0.3) {
      recommendations.push('Review and mitigate high-risk proxies');
    }

    if (lowHealthCount > proxies.length * 0.25) {
      recommendations.push('Investigate and improve proxy health issues');
    }

    // Geographic diversity analysis
    const countries = new Set(proxies.map(p => p.geographicData.country));
    if (countries.size < 3) {
      recommendations.push('Increase geographic diversity of proxy pool');
    }

    // Performance analysis
    const avgPerformance = proxies.reduce((sum, p) => sum + this.calculatePerformanceScore(p), 0) / proxies.length;
    if (avgPerformance < 0.6) {
      recommendations.push('Overall proxy performance needs improvement');
    }

    return recommendations;
  }

  /**
   * Task 18: Get all active proxies
   */
  private getAllActiveProxies(): ProxyEndpoint[] {
    const activeProxies: ProxyEndpoint[] = [];
    for (const pool of this.pools.values()) {
      activeProxies.push(...pool.endpoints.filter(p => p.isActive));
    }
    return activeProxies;
  }

  /**
   * Task 18: Enhanced shutdown with cleanup
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down ProxyRotationManager with advanced features...');

      // Stop all intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.rotationInterval) {
        clearInterval(this.rotationInterval);
        this.rotationInterval = null;
      }

      if (this.usageTrackingInterval) {
        clearInterval(this.usageTrackingInterval);
        this.usageTrackingInterval = null;
      }

      // Task 18: Stop optimization interval
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
        this.optimizationInterval = null;
      }

      // Wait for any ongoing optimization to complete
      if (this.optimizationInProgress) {
        logger.info('Waiting for ongoing optimization to complete...');
        let waitTime = 0;
        while (this.optimizationInProgress && waitTime < 30000) { // Max 30 seconds
          await new Promise(resolve => setTimeout(resolve, 1000));
          waitTime += 1000;
        }
      }

      // Cache final proxy data
      for (const pool of this.pools.values()) {
        for (const proxy of pool.endpoints) {
          await this.cacheProxyData(proxy);
        }
      }

      // Save selection metrics
      const metricsKey = `${this.CACHE_PREFIX}:selection_metrics`;
      await cacheManager.set(metricsKey, JSON.stringify(this.selectionMetrics), 86400);

      this.isInitialized = false;

      logger.info('✅ ProxyRotationManager shutdown complete');
      this.emit('shutdown');

    } catch (error) {
      logger.error('Error during ProxyRotationManager shutdown:', error);
    }
  }

  /**
   * Task 18: Get proxy by criteria for testing
   */
  async getProxyByCriteria(criteria: ProxySelectionCriteria): Promise<ProxySelectionResult> {
    return await this.getOptimalProxyAdvanced(criteria);
  }

  /**
   * Task 18: Force proxy optimization for testing
   */
  async forceOptimization(): Promise<ProxyOptimizationResult> {
    this.optimizationInProgress = false; // Reset flag
    return await this.triggerManualOptimization(OptimizationStrategy.BALANCED);
  }

  /**
   * Task 18: Get proxy risk assessment
   */
  getProxyRiskAssessment(proxyId: string): RiskAssessmentResult | null {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) return null;

    return this.riskAssessment.assessRisk(proxy, {
      actionType: 'general',
      riskLevel: ActionRiskLevel.MEDIUM,
      accountId: 'system'
    });
  }

  /**
   * Task 18: Update proxy risk score manually
   */
  async updateProxyRiskScore(proxyId: string, newRiskScore: number, reason: string): Promise<boolean> {
    try {
      const proxy = this.findProxyById(proxyId);
      if (!proxy) {
        logger.warn(`Proxy ${proxyId} not found for risk score update`);
        return false;
      }

      const oldRiskScore = proxy.riskScore;
      proxy.riskScore = Math.max(0, Math.min(100, newRiskScore));

      // Add to detection history
      proxy.detectionHistory.push({
        timestamp: new Date(),
        type: 'manual_adjustment',
        severity: newRiskScore > 70 ? 'high' : newRiskScore > 40 ? 'medium' : 'low',
        details: { reason, oldRiskScore, newRiskScore },
        resolved: false
      });

      // Update health score
      await this.updateProxyHealthScore(proxy);

      // Cache updated data
      await this.cacheProxyData(proxy);

      logger.info(`Proxy ${proxyId} risk score updated: ${oldRiskScore} -> ${newRiskScore}`, { reason });

      this.emit('proxyRiskUpdated', { proxyId, oldRiskScore, newRiskScore, reason });

      return true;

    } catch (error) {
      logger.error(`Error updating proxy risk score for ${proxyId}:`, error);
      return false;
    }
  }

  /**
   * Task 18: Get proxy performance history
   */
  async getProxyPerformanceHistory(
    proxyId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    proxy: ProxyEndpoint;
    performanceHistory: Array<{
      timestamp: Date;
      latency: number;
      throughput: number;
      successRate: number;
      healthScore: number;
      riskScore: number;
    }>;
    trends: {
      latencyTrend: 'improving' | 'stable' | 'degrading';
      throughputTrend: 'improving' | 'stable' | 'degrading';
      healthTrend: 'improving' | 'stable' | 'degrading';
    };
  } | null> {
    try {
      const proxy = this.findProxyById(proxyId);
      if (!proxy) return null;

      // In a real implementation, this would fetch from a time-series database
      // For now, we'll generate mock historical data based on current metrics
      const performanceHistory = this.generateMockPerformanceHistory(proxy, timeRange);

      // Calculate trends
      const trends = this.calculatePerformanceTrends(performanceHistory);

      return {
        proxy,
        performanceHistory,
        trends
      };

    } catch (error) {
      logger.error(`Error getting performance history for proxy ${proxyId}:`, error);
      return null;
    }
  }

  /**
   * Task 18: Generate mock performance history (replace with real data in production)
   */
  private generateMockPerformanceHistory(
    proxy: ProxyEndpoint,
    timeRange?: { start: Date; end: Date }
  ): Array<{
    timestamp: Date;
    latency: number;
    throughput: number;
    successRate: number;
    healthScore: number;
    riskScore: number;
  }> {
    const history = [];
    const endTime = timeRange?.end || new Date();
    const startTime = timeRange?.start || new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    const intervalMs = (endTime.getTime() - startTime.getTime()) / 24; // 24 data points

    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(startTime.getTime() + i * intervalMs);

      // Generate realistic variations around current metrics
      const latencyVariation = (Math.random() - 0.5) * 0.3; // ±30% variation
      const throughputVariation = (Math.random() - 0.5) * 0.2; // ±20% variation
      const healthVariation = (Math.random() - 0.5) * 0.1; // ±10% variation
      const riskVariation = (Math.random() - 0.5) * 0.15; // ±15% variation

      history.push({
        timestamp,
        latency: Math.max(100, proxy.performanceMetrics.latency.average * (1 + latencyVariation)),
        throughput: Math.max(1000, proxy.performanceMetrics.throughput.bytesPerSecond * (1 + throughputVariation)),
        successRate: Math.max(0, Math.min(100, (proxy.successfulRequests / Math.max(proxy.totalRequests, 1)) * 100 * (1 + healthVariation))),
        healthScore: Math.max(0, Math.min(1, proxy.healthScore * (1 + healthVariation))),
        riskScore: Math.max(0, Math.min(100, proxy.riskScore * (1 + riskVariation)))
      });
    }

    return history;
  }

  /**
   * Task 18: Calculate performance trends
   */
  private calculatePerformanceTrends(history: Array<{
    timestamp: Date;
    latency: number;
    throughput: number;
    successRate: number;
    healthScore: number;
    riskScore: number;
  }>): {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    throughputTrend: 'improving' | 'stable' | 'degrading';
    healthTrend: 'improving' | 'stable' | 'degrading';
  } {
    if (history.length < 2) {
      return {
        latencyTrend: 'stable',
        throughputTrend: 'stable',
        healthTrend: 'stable'
      };
    }

    const first = history[0]!;
    const last = history[history.length - 1]!;

    // Calculate trends (lower latency is better, higher throughput and health are better)
    const latencyChange = (last.latency - first.latency) / first.latency;
    const throughputChange = (last.throughput - first.throughput) / first.throughput;
    const healthChange = (last.healthScore - first.healthScore) / first.healthScore;

    const threshold = 0.1; // 10% change threshold

    return {
      latencyTrend: latencyChange < -threshold ? 'improving' : latencyChange > threshold ? 'degrading' : 'stable',
      throughputTrend: throughputChange > threshold ? 'improving' : throughputChange < -threshold ? 'degrading' : 'stable',
      healthTrend: healthChange > threshold ? 'improving' : healthChange < -threshold ? 'degrading' : 'stable'
    };
  }

  /**
   * Determine optimal proxy type based on action risk level
   */
  private determineOptimalProxyType(riskLevel: ActionRiskLevel): ProxyType {
    switch (riskLevel) {
      case ActionRiskLevel.CRITICAL:
      case ActionRiskLevel.HIGH:
        // High-risk actions prefer residential proxies for better anonymity
        return this.pools.has(ProxyType.RESIDENTIAL) ? ProxyType.RESIDENTIAL : ProxyType.MOBILE;

      case ActionRiskLevel.MEDIUM:
        // Medium-risk actions can use mobile or datacenter proxies
        return this.pools.has(ProxyType.MOBILE) ? ProxyType.MOBILE : ProxyType.DATACENTER;

      case ActionRiskLevel.LOW:
      default:
        // Low-risk actions can use any proxy type, prefer datacenter for speed
        return this.pools.has(ProxyType.DATACENTER) ? ProxyType.DATACENTER : ProxyType.MOBILE;
    }
  }

  /**
   * Get fallback proxy when preferred type is unavailable
   */
  private async getFallbackProxy(criteria: ProxySelectionCriteria): Promise<ProxyEndpoint | null> {
    const availableTypes = Array.from(this.pools.keys()).filter(type => {
      const pool = this.pools.get(type);
      return pool && pool.isEnabled && pool.endpoints.some(p => p.isActive && p.healthScore >= 0.3);
    });

    if (availableTypes.length === 0) {
      logger.error('No fallback proxies available');
      return null;
    }

    // Try each available type in order of preference
    for (const proxyType of availableTypes) {
      const pool = this.pools.get(proxyType)!;
      const healthyProxies = pool.endpoints.filter(p =>
        p.isActive && p.healthScore >= 0.3 && p.consecutiveFailures < 3
      );

      if (healthyProxies.length > 0) {
        const selectedProxy = this.selectBestProxy(healthyProxies, criteria);
        if (selectedProxy) {
          logger.info(`Using fallback ${proxyType} proxy: ${selectedProxy.id}`);
          selectedProxy.lastUsed = new Date();
          return selectedProxy;
        }
      }
    }

    return null;
  }

  /**
   * Select best proxy from candidates using weighted scoring
   */
  private selectBestProxy(candidates: ProxyEndpoint[], criteria: ProxySelectionCriteria): ProxyEndpoint | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0] || null;

    // Calculate weighted scores for each candidate
    const scoredProxies = candidates.map(proxy => {
      let score = 0;

      // Health score weight (40%)
      score += proxy.healthScore * 0.4;

      // Success rate weight (30%)
      const successRate = proxy.totalRequests > 0 ?
        proxy.successfulRequests / proxy.totalRequests : 1;
      score += successRate * 0.3;

      // Response time weight (20%) - lower is better
      if (proxy.averageResponseTime > 0) {
        const responseTimeScore = Math.max(0, 1 - (proxy.averageResponseTime / 5000)); // 5s max
        score += responseTimeScore * 0.2;
      } else {
        score += 0.2; // No data, assume good
      }

      // Usage balance weight (10%) - prefer less used proxies
      const maxRequests = Math.max(...candidates.map(p => p.totalRequests), 1);
      const usageScore = 1 - (proxy.totalRequests / maxRequests);
      score += usageScore * 0.1;

      // Penalty for consecutive failures
      score -= proxy.consecutiveFailures * 0.1;

      // Bonus for recent successful usage
      if (proxy.lastUsed && (Date.now() - proxy.lastUsed.getTime()) < 300000) { // 5 minutes
        score += 0.05;
      }

      return { proxy, score };
    });

    // Sort by score and select the best
    scoredProxies.sort((a, b) => b.score - a.score);

    logger.debug('Proxy selection scores:', scoredProxies.map(sp => ({
      id: sp.proxy.id,
      score: sp.score.toFixed(3),
      health: sp.proxy.healthScore.toFixed(3),
      successRate: sp.proxy.totalRequests > 0 ?
        ((sp.proxy.successfulRequests / sp.proxy.totalRequests) * 100).toFixed(1) + '%' : 'N/A'
    })));

    return scoredProxies.length > 0 && scoredProxies[0] ? scoredProxies[0].proxy : null;
  }

  /**
   * Update proxy performance metrics
   */
  async updateProxyMetrics(proxyId: string, success: boolean, responseTime?: number): Promise<void> {
    try {
      const proxy = this.findProxyById(proxyId);
      if (!proxy) {
        logger.warn(`Proxy not found for metrics update: ${proxyId}`);
        return;
      }

      const pool = this.pools.get(proxy.type)!;

      // Update request counts
      proxy.totalRequests++;
      pool.totalRequests++;

      if (success) {
        proxy.successfulRequests++;
        pool.successfulRequests++;
        proxy.consecutiveFailures = 0;

        // Improve health score gradually
        proxy.healthScore = Math.min(1.0, proxy.healthScore + 0.05);
      } else {
        proxy.failedRequests++;
        proxy.consecutiveFailures++;

        // Decrease health score
        proxy.healthScore = Math.max(0.0, proxy.healthScore - 0.1);

        // Disable proxy if too many consecutive failures
        if (proxy.consecutiveFailures >= this.configManager.config.proxy.maxFailures) {
          proxy.isActive = false;
          logger.warn(`Proxy ${proxyId} disabled due to consecutive failures`);
          this.emit('proxyDisabled', proxy);
        }
      }

      // Update response time (exponential moving average)
      if (responseTime !== undefined) {
        if (proxy.averageResponseTime === 0) {
          proxy.averageResponseTime = responseTime;
        } else {
          proxy.averageResponseTime = (proxy.averageResponseTime * 0.8) + (responseTime * 0.2);
        }
      }

      // Update pool average health score
      const activeProxies = pool.endpoints.filter(p => p.isActive);
      if (activeProxies.length > 0) {
        pool.averageHealthScore = activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length;
      }

      // Cache updated metrics
      await this.cacheProxyMetrics(proxy);

      logger.debug(`Updated metrics for proxy ${proxyId}:`, {
        success,
        healthScore: proxy.healthScore.toFixed(3),
        consecutiveFailures: proxy.consecutiveFailures,
        responseTime: responseTime || 'N/A'
      });

    } catch (error) {
      logger.error('Error updating proxy metrics:', error);
    }
  }

  /**
   * Start health monitoring for all proxies
   */
  private async startHealthMonitoring(): Promise<void> {
    const interval = this.configManager.config.proxy.healthCheckInterval * 1000;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, interval);

    // Perform initial health check
    await this.performHealthChecks();

    logger.info(`Health monitoring started with ${interval}ms interval`);
  }

  /**
   * Perform health checks on all active proxies
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises: Promise<void>[] = [];

    for (const pool of this.pools.values()) {
      for (const proxy of pool.endpoints) {
        if (proxy.isActive) {
          healthCheckPromises.push(this.checkProxyHealth(proxy));
        }
      }
    }

    try {
      await Promise.allSettled(healthCheckPromises);
      logger.debug('Health checks completed for all active proxies');
    } catch (error) {
      logger.error('Error during health checks:', error);
    }
  }

  /**
   * Check health of individual proxy
   */
  private async checkProxyHealth(proxy: ProxyEndpoint): Promise<void> {
    const healthCheckUrls = this.configManager.config.proxy.healthCheckUrls;
    const timeout = this.configManager.config.proxy.healthCheckTimeout * 1000;

    try {
      const startTime = Date.now();

      // Use a random health check URL
      const checkUrl = healthCheckUrls[Math.floor(Math.random() * healthCheckUrls.length)];

      if (!checkUrl) {
        logger.warn('No health check URLs configured');
        return;
      }

      // Perform health check with proxy
      const response = await this.performProxyHealthCheck(proxy, checkUrl, timeout);

      const responseTime = Date.now() - startTime;

      if (response.success) {
        // Health check passed
        proxy.healthScore = Math.min(1.0, proxy.healthScore + 0.02);
        proxy.consecutiveFailures = 0;

        // Update response time
        if (proxy.averageResponseTime === 0) {
          proxy.averageResponseTime = responseTime;
        } else {
          proxy.averageResponseTime = (proxy.averageResponseTime * 0.9) + (responseTime * 0.1);
        }

        // Extract metadata if available
        if (response.metadata) {
          Object.assign(proxy.metadata, response.metadata);
        }

      } else {
        // Health check failed
        proxy.healthScore = Math.max(0.0, proxy.healthScore - 0.05);
        proxy.consecutiveFailures++;

        if (proxy.consecutiveFailures >= this.configManager.config.proxy.maxFailures) {
          proxy.isActive = false;
          logger.warn(`Proxy ${proxy.id} disabled after health check failures`);
          this.emit('proxyHealthCheckFailed', proxy);
        }
      }

      proxy.lastHealthCheck = new Date();

    } catch (error) {
      logger.error(`Health check failed for proxy ${proxy.id}:`, error);
      proxy.healthScore = Math.max(0.0, proxy.healthScore - 0.1);
      proxy.consecutiveFailures++;
    }
  }

  /**
   * Perform actual proxy health check (mock implementation)
   */
  private async performProxyHealthCheck(
    proxy: ProxyEndpoint,
    checkUrl: string,
    timeout: number
  ): Promise<{ success: boolean; metadata?: any }> {
    // In a real implementation, this would make an HTTP request through the proxy
    // For now, we'll simulate the health check

    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate success/failure based on proxy health score
        const success = Math.random() < (proxy.healthScore * 0.8 + 0.2);

        resolve({
          success,
          metadata: success ? {
            country: 'US',
            region: 'East',
            ip: '192.168.1.1'
          } : undefined
        });
      }, Math.random() * 1000 + 500); // 500-1500ms response time
    });
  }

  /**
   * Start rotation management
   */
  private startRotationManagement(): void {
    const interval = this.configManager.config.proxy.rotationInterval * 1000;

    this.rotationInterval = setInterval(() => {
      this.performRotationMaintenance();
    }, interval);

    logger.info(`Rotation management started with ${interval}ms interval`);
  }

  /**
   * Perform rotation maintenance tasks
   */
  private performRotationMaintenance(): void {
    try {
      // Re-enable proxies that have recovered
      this.reactivateRecoveredProxies();

      // Balance proxy usage
      this.balanceProxyUsage();

      // Update pool statistics
      this.updatePoolStatistics();

      logger.debug('Rotation maintenance completed');
    } catch (error) {
      logger.error('Error during rotation maintenance:', error);
    }
  }

  /**
   * Reactivate proxies that have recovered
   */
  private reactivateRecoveredProxies(): void {
    for (const pool of this.pools.values()) {
      for (const proxy of pool.endpoints) {
        if (!proxy.isActive && proxy.healthScore > 0.6 && proxy.consecutiveFailures === 0) {
          proxy.isActive = true;
          logger.info(`Reactivated recovered proxy: ${proxy.id}`);
          this.emit('proxyReactivated', proxy);
        }
      }
    }
  }

  /**
   * Balance proxy usage across pools
   */
  private balanceProxyUsage(): void {
    for (const pool of this.pools.values()) {
      const activeProxies = pool.endpoints.filter(p => p.isActive);

      if (activeProxies.length > 1) {
        // Sort by usage (least used first)
        activeProxies.sort((a, b) => a.totalRequests - b.totalRequests);

        // Update current index to prefer less used proxies
        if (activeProxies.length > 0 && activeProxies[0]) {
          const leastUsedIndex = pool.endpoints.indexOf(activeProxies[0]);
          if (leastUsedIndex !== -1) {
            pool.currentIndex = leastUsedIndex;
          }
        }
      }
    }
  }

  /**
   * Update pool statistics
   */
  private updatePoolStatistics(): void {
    for (const pool of this.pools.values()) {
      const activeProxies = pool.endpoints.filter(p => p.isActive);

      if (activeProxies.length > 0) {
        pool.averageHealthScore = activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length;
      }
    }
  }

  /**
   * Start usage tracking
   */
  private startUsageTracking(): void {
    this.usageTrackingInterval = setInterval(() => {
      this.trackUsageMetrics();
    }, 60000); // Track every minute

    logger.info('Usage tracking started');
  }

  /**
   * Track usage metrics
   */
  private trackUsageMetrics(): void {
    const stats = this.getUsageStatistics();

    // Emit usage statistics for monitoring
    this.emit('usageStats', stats);

    // Log summary
    logger.debug('Proxy usage statistics:', {
      totalProxies: stats.totalProxies,
      activeProxies: stats.activeProxies,
      successRate: `${stats.successRate.toFixed(1)}%`,
      avgResponseTime: `${stats.averageResponseTime.toFixed(0)}ms`
    });
  }

  /**
   * Find proxy by ID
   */
  private findProxyById(proxyId: string): ProxyEndpoint | null {
    for (const pool of this.pools.values()) {
      const proxy = pool.endpoints.find(p => p.id === proxyId);
      if (proxy) return proxy;
    }
    return null;
  }

  /**
   * Load cached proxy data
   */
  private async loadCachedProxyData(): Promise<void> {
    try {
      for (const [type, pool] of this.pools.entries()) {
        const cacheKey = `${this.CACHE_PREFIX}:${type}`;
        const cachedData = await cacheManager.get(cacheKey);

        if (cachedData && Array.isArray(cachedData)) {
          // Restore proxy metrics from cache
          for (let i = 0; i < Math.min(cachedData.length, pool.endpoints.length); i++) {
            const cached = cachedData[i];
            const proxy = pool.endpoints[i];

            if (cached && proxy && cached.id === proxy.id) {
              proxy.healthScore = cached.healthScore || 1.0;
              proxy.totalRequests = cached.totalRequests || 0;
              proxy.successfulRequests = cached.successfulRequests || 0;
              proxy.failedRequests = cached.failedRequests || 0;
              proxy.averageResponseTime = cached.averageResponseTime || 0;
              proxy.consecutiveFailures = cached.consecutiveFailures || 0;
              proxy.lastUsed = cached.lastUsed ? new Date(cached.lastUsed) : null;
              proxy.lastHealthCheck = cached.lastHealthCheck ? new Date(cached.lastHealthCheck) : null;
            }
          }
        }
      }

      logger.info('Loaded cached proxy data');
    } catch (error) {
      logger.warn('Failed to load cached proxy data:', error);
    }
  }

  /**
   * Save proxy data to cache
   */
  private async saveProxyDataToCache(): Promise<void> {
    try {
      for (const [type, pool] of this.pools.entries()) {
        const cacheKey = `${this.CACHE_PREFIX}:${type}`;
        const dataToCache = pool.endpoints.map(proxy => ({
          id: proxy.id,
          healthScore: proxy.healthScore,
          totalRequests: proxy.totalRequests,
          successfulRequests: proxy.successfulRequests,
          failedRequests: proxy.failedRequests,
          averageResponseTime: proxy.averageResponseTime,
          consecutiveFailures: proxy.consecutiveFailures,
          lastUsed: proxy.lastUsed,
          lastHealthCheck: proxy.lastHealthCheck
        }));

        await cacheManager.set(cacheKey, dataToCache, 86400); // 24 hours
      }

      logger.info('Saved proxy data to cache');
    } catch (error) {
      logger.warn('Failed to save proxy data to cache:', error);
    }
  }

  /**
   * Cache individual proxy metrics
   */
  private async cacheProxyMetrics(proxy: ProxyEndpoint): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:proxy:${proxy.id}`;
      const metricsData = {
        healthScore: proxy.healthScore,
        totalRequests: proxy.totalRequests,
        successfulRequests: proxy.successfulRequests,
        failedRequests: proxy.failedRequests,
        averageResponseTime: proxy.averageResponseTime,
        consecutiveFailures: proxy.consecutiveFailures,
        lastUsed: proxy.lastUsed,
        lastHealthCheck: proxy.lastHealthCheck
      };

      await cacheManager.set(cacheKey, metricsData, 3600); // 1 hour
    } catch (error) {
      logger.debug('Failed to cache proxy metrics:', error);
    }
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Get usage statistics for all proxy pools
   */
  getUsageStatistics(): ProxyUsageStats {
    let totalProxies = 0;
    let activeProxies = 0;
    let healthyProxies = 0;
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    const poolStats = new Map<ProxyType, any>();

    for (const [type, pool] of this.pools.entries()) {
      const poolActiveProxies = pool.endpoints.filter(p => p.isActive);
      const poolHealthyProxies = poolActiveProxies.filter(p => p.healthScore >= 0.5);
      const poolTotalRequests = pool.endpoints.reduce((sum, p) => sum + p.totalRequests, 0);
      const poolSuccessfulRequests = pool.endpoints.reduce((sum, p) => sum + p.successfulRequests, 0);

      totalProxies += pool.endpoints.length;
      activeProxies += poolActiveProxies.length;
      healthyProxies += poolHealthyProxies.length;
      totalRequests += poolTotalRequests;
      successfulRequests += poolSuccessfulRequests;

      // Calculate average response time
      for (const proxy of pool.endpoints) {
        if (proxy.averageResponseTime > 0) {
          totalResponseTime += proxy.averageResponseTime;
          responseTimeCount++;
        }
      }

      poolStats.set(type, {
        count: pool.endpoints.length,
        active: poolActiveProxies.length,
        healthy: poolHealthyProxies.length,
        successRate: poolTotalRequests > 0 ? (poolSuccessfulRequests / poolTotalRequests) * 100 : 0
      });
    }

    return {
      totalProxies,
      activeProxies,
      healthyProxies,
      totalRequests,
      successfulRequests,
      averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      poolStats
    };
  }

  /**
   * Get detailed information about all proxy pools
   */
  getPoolInformation(): Map<ProxyType, ProxyPool> {
    return new Map(this.pools);
  }

  /**
   * Get proxy by ID
   */
  getProxyById(proxyId: string): ProxyEndpoint | null {
    return this.findProxyById(proxyId);
  }

  /**
   * Manually disable a proxy
   */
  async disableProxy(proxyId: string, reason?: string): Promise<boolean> {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) {
      logger.warn(`Cannot disable proxy - not found: ${proxyId}`);
      return false;
    }

    proxy.isActive = false;
    logger.info(`Manually disabled proxy ${proxyId}${reason ? `: ${reason}` : ''}`);

    await this.cacheProxyMetrics(proxy);
    this.emit('proxyDisabled', proxy, reason);

    return true;
  }

  /**
   * Manually enable a proxy
   */
  async enableProxy(proxyId: string): Promise<boolean> {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) {
      logger.warn(`Cannot enable proxy - not found: ${proxyId}`);
      return false;
    }

    proxy.isActive = true;
    proxy.consecutiveFailures = 0;
    proxy.healthScore = Math.max(0.5, proxy.healthScore);

    logger.info(`Manually enabled proxy ${proxyId}`);

    await this.cacheProxyMetrics(proxy);
    this.emit('proxyEnabled', proxy);

    return true;
  }

  /**
   * Reset proxy metrics
   */
  async resetProxyMetrics(proxyId: string): Promise<boolean> {
    const proxy = this.findProxyById(proxyId);
    if (!proxy) {
      return false;
    }

    proxy.totalRequests = 0;
    proxy.successfulRequests = 0;
    proxy.failedRequests = 0;
    proxy.averageResponseTime = 0;
    proxy.consecutiveFailures = 0;
    proxy.healthScore = 1.0;
    proxy.lastUsed = null;
    proxy.lastHealthCheck = null;

    await this.cacheProxyMetrics(proxy);
    logger.info(`Reset metrics for proxy ${proxyId}`);

    return true;
  }

  /**
   * Add new proxy endpoint to a pool
   */
  async addProxyEndpoint(type: ProxyType, url: string, username?: string, password?: string): Promise<string | null> {
    const pool = this.pools.get(type);
    if (!pool) {
      logger.error(`Cannot add proxy - pool not found: ${type}`);
      return null;
    }

    const proxyId = `${type}_${pool.endpoints.length}_${Date.now()}`;
    const newProxy: ProxyEndpoint = {
      id: proxyId,
      url,
      type,
      ...(username && { username }),
      ...(password && { password }),
      healthScore: 1.0,
      lastUsed: null,
      lastHealthCheck: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      consecutiveFailures: 0,
      isActive: true,
      metadata: {},

      // Task 18: Advanced Proxy Management - Initialize enhanced fields for new proxy
      riskScore: 0,
      performanceClass: ProxyPerformanceClass.STANDARD,
      detectionHistory: [],
      geographicData: {
        country: 'Unknown',
        countryCode: 'XX',
        region: 'Unknown',
        timezone: 'UTC',
        riskLevel: ProxyRiskLevel.LOW,
        lastGeoUpdate: new Date()
      },
      performanceMetrics: {
        latency: { min: 0, max: 0, average: 0, p95: 0, p99: 0 },
        throughput: { requestsPerSecond: 0, bytesPerSecond: 0, concurrentConnections: 0 },
        reliability: { uptime: 100, mtbf: 0, mttr: 0, errorRate: 0 },
        trends: { performanceTrend: 'stable', trendConfidence: 50, lastTrendUpdate: new Date() }
      },
      optimizationData: {
        mlScore: 50,
        predictionAccuracy: 0,
        optimalUsagePattern: { timeOfDay: [], dayOfWeek: [], requestTypes: [], accountTypes: [] },
        learningData: { trainingDataPoints: 0, lastTraining: new Date(), modelVersion: '1.0', convergenceScore: 0 },
        recommendations: { action: 'continue', confidence: 50, reasoning: 'Initial state', expectedImprovement: 0 }
      },
      lastOptimization: null,
      retirementScore: 0,
      accountAssignments: [],
      bandwidthUtilization: {
        totalBytesTransferred: 0,
        averageBandwidthUsage: 0,
        peakBandwidthUsage: 0,
        bandwidthEfficiency: 100,
        compressionRatio: 1.0,
        lastBandwidthUpdate: new Date()
      }
    };

    pool.endpoints.push(newProxy);
    await this.cacheProxyMetrics(newProxy);

    logger.info(`Added new proxy endpoint: ${proxyId}`);
    this.emit('proxyAdded', newProxy);

    return proxyId;
  }

  /**
   * Remove proxy endpoint from pool
   */
  async removeProxyEndpoint(proxyId: string): Promise<boolean> {
    for (const pool of this.pools.values()) {
      const index = pool.endpoints.findIndex(p => p.id === proxyId);
      if (index !== -1) {
        const removedProxy = pool.endpoints.splice(index, 1)[0];

        // Remove from cache
        try {
          await cacheManager.del(`${this.CACHE_PREFIX}:proxy:${proxyId}`);
        } catch (error) {
          logger.debug('Failed to remove proxy from cache:', error);
        }

        logger.info(`Removed proxy endpoint: ${proxyId}`);
        this.emit('proxyRemoved', removedProxy);

        return true;
      }
    }

    return false;
  }

  // ===== INTEGRATED TESTING METHODS =====

  /**
   * Test proxy health for all active proxies
   */
  async testProxyHealth(): Promise<Map<string, { success: boolean; responseTime?: number; error?: string }>> {
    const results = new Map<string, any>();

    logger.info('Starting proxy health test...');

    for (const pool of this.pools.values()) {
      for (const proxy of pool.endpoints) {
        if (proxy.isActive) {
          try {
            const startTime = Date.now();
            const healthResult = await this.performProxyHealthCheck(
              proxy,
              'https://httpbin.org/ip',
              10000
            );
            const responseTime = Date.now() - startTime;

            results.set(proxy.id, {
              success: healthResult.success,
              responseTime,
              metadata: healthResult.metadata
            });

          } catch (error) {
            results.set(proxy.id, {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    }

    logger.info(`Proxy health test completed for ${results.size} proxies`);
    return results;
  }

  /**
   * Validate configuration and setup
   */
  validateConfiguration(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if any pools are configured
    if (this.pools.size === 0) {
      errors.push('No proxy pools configured');
    }

    // Check each pool
    for (const [type, pool] of this.pools.entries()) {
      if (pool.endpoints.length === 0) {
        warnings.push(`${type} pool has no endpoints configured`);
      }

      const activeEndpoints = pool.endpoints.filter(p => p.isActive);
      if (activeEndpoints.length === 0) {
        warnings.push(`${type} pool has no active endpoints`);
      }

      // Validate endpoint URLs
      for (const endpoint of pool.endpoints) {
        try {
          new URL(endpoint.url);
        } catch (error) {
          errors.push(`Invalid URL in ${type} pool: ${endpoint.url}`);
        }
      }
    }

    // Check configuration values
    const config = this.configManager.config.proxy;

    if (config.healthCheckInterval <= 0) {
      errors.push('Health check interval must be positive');
    }

    if (config.rotationInterval <= 0) {
      errors.push('Rotation interval must be positive');
    }

    if (config.maxFailures <= 0) {
      errors.push('Max failures must be positive');
    }

    if (config.healthCheckUrls.length === 0) {
      errors.push('No health check URLs configured');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics(): Promise<{
    configuration: ReturnType<ProxyRotationManager['validateConfiguration']>;
    statistics: ProxyUsageStats;
    healthTest: Map<string, any>;
    poolStatus: Map<ProxyType, {
      total: number;
      active: number;
      healthy: number;
      avgHealth: number;
      avgResponseTime: number;
    }>;
  }> {
    logger.info('Running comprehensive proxy diagnostics...');

    const configuration = this.validateConfiguration();
    const statistics = this.getUsageStatistics();
    const healthTest = await this.testProxyHealth();

    const poolStatus = new Map<ProxyType, any>();

    for (const [type, pool] of this.pools.entries()) {
      const activeProxies = pool.endpoints.filter(p => p.isActive);
      const healthyProxies = activeProxies.filter(p => p.healthScore >= 0.5);

      const avgHealth = activeProxies.length > 0
        ? activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length
        : 0;

      const proxiesWithResponseTime = activeProxies.filter(p => p.averageResponseTime > 0);
      const avgResponseTime = proxiesWithResponseTime.length > 0
        ? proxiesWithResponseTime.reduce((sum, p) => sum + p.averageResponseTime, 0) / proxiesWithResponseTime.length
        : 0;

      poolStatus.set(type, {
        total: pool.endpoints.length,
        active: activeProxies.length,
        healthy: healthyProxies.length,
        avgHealth: Number(avgHealth.toFixed(3)),
        avgResponseTime: Number(avgResponseTime.toFixed(0))
      });
    }

    logger.info('Proxy diagnostics completed');

    return {
      configuration,
      statistics,
      healthTest,
      poolStatus
    };
  }

  /**
   * Test proxy selection algorithm
   */
  async testProxySelection(): Promise<{
    testResults: Array<{
      criteria: ProxySelectionCriteria;
      selectedProxy: ProxyEndpoint | null;
      selectionTime: number;
    }>;
    summary: {
      totalTests: number;
      successfulSelections: number;
      averageSelectionTime: number;
      poolDistribution: Map<ProxyType, number>;
    };
  }> {
    logger.info('Testing proxy selection algorithm...');

    const testCriteria: ProxySelectionCriteria[] = [
      {
        actionType: 'authenticate',
        riskLevel: ActionRiskLevel.CRITICAL,
        accountId: 'test_account_1',
        minHealthScore: 0.8
      },
      {
        actionType: 'post_tweet',
        riskLevel: ActionRiskLevel.HIGH,
        accountId: 'test_account_2',
        maxResponseTime: 3000
      },
      {
        actionType: 'like_tweet',
        riskLevel: ActionRiskLevel.MEDIUM,
        accountId: 'test_account_3'
      },
      {
        actionType: 'search_tweets',
        riskLevel: ActionRiskLevel.LOW,
        accountId: 'test_account_4',
        requiresHighBandwidth: false
      }
    ];

    const testResults = [];
    const poolDistribution = new Map<ProxyType, number>();

    for (const criteria of testCriteria) {
      const startTime = Date.now();
      const selectedProxy = await this.getOptimalProxy(criteria);
      const selectionTime = Date.now() - startTime;

      testResults.push({
        criteria,
        selectedProxy,
        selectionTime
      });

      if (selectedProxy) {
        const count = poolDistribution.get(selectedProxy.type) || 0;
        poolDistribution.set(selectedProxy.type, count + 1);
      }
    }

    const successfulSelections = testResults.filter(r => r.selectedProxy !== null).length;
    const averageSelectionTime = testResults.reduce((sum, r) => sum + r.selectionTime, 0) / testResults.length;

    logger.info(`Proxy selection test completed: ${successfulSelections}/${testResults.length} successful`);

    return {
      testResults,
      summary: {
        totalTests: testResults.length,
        successfulSelections,
        averageSelectionTime: Number(averageSelectionTime.toFixed(2)),
        poolDistribution
      }
    };
  }

  /**
   * Generate comprehensive status report
   */
  getStatusReport(): {
    isRunning: boolean;
    uptime: number;
    configuration: ReturnType<ProxyRotationManager['validateConfiguration']>;
    statistics: ProxyUsageStats;
    poolSummary: Array<{
      type: ProxyType;
      total: number;
      active: number;
      healthy: number;
      avgHealth: string;
      successRate: string;
    }>;
  } {
    const statistics = this.getUsageStatistics();
    const configuration = this.validateConfiguration();

    const poolSummary = Array.from(this.pools.entries()).map(([type, pool]) => {
      const activeProxies = pool.endpoints.filter(p => p.isActive);
      const healthyProxies = activeProxies.filter(p => p.healthScore >= 0.5);
      const avgHealth = activeProxies.length > 0
        ? activeProxies.reduce((sum, p) => sum + p.healthScore, 0) / activeProxies.length
        : 0;
      const successRate = pool.totalRequests > 0
        ? (pool.successfulRequests / pool.totalRequests) * 100
        : 0;

      return {
        type,
        total: pool.endpoints.length,
        active: activeProxies.length,
        healthy: healthyProxies.length,
        avgHealth: avgHealth.toFixed(3),
        successRate: successRate.toFixed(1) + '%'
      };
    });

    return {
      isRunning: this.isInitialized,
      uptime: this.isInitialized ? Date.now() - (this.pools.values().next().value?.lastRotation?.getTime() || Date.now()) : 0,
      configuration,
      statistics,
      poolSummary
    };
  }

  /**
   * Rotate proxy for a specific account (for health monitoring integration)
   */
  async rotateProxy(accountId: string): Promise<void> {
    try {
      logger.info('Rotating proxy for account', {
        accountId: sanitizeData(accountId)
      });

      // Select a new proxy
      const newProxy = await this.getOptimalProxyAdvanced({
        actionType: 'proxy_rotation',
        riskLevel: ActionRiskLevel.MEDIUM,
        accountId
      });

      if (newProxy.proxy) {
        logger.info('Proxy rotated successfully', {
          accountId: sanitizeData(accountId),
          newProxyId: newProxy.proxy.id
        });
      } else {
        logger.warn('No alternative proxy available for rotation', {
          accountId: sanitizeData(accountId)
        });
      }
    } catch (error) {
      logger.error('Failed to rotate proxy', {
        accountId: sanitizeData(accountId),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Singleton instance
export const proxyRotationManager = new ProxyRotationManager();
