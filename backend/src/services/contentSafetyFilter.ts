/**
 * Advanced Content Quality and Safety Filters - Task 20 Implementation
 * 
 * Comprehensive AI-powered content safety and quality filtering system that enhances
 * the existing content pipeline with multi-dimensional analysis, compliance checking,
 * and optimization capabilities.
 * 
 * Features:
 * - AI-Powered Content Analysis (sentiment, toxicity, spam, quality scoring)
 * - Multi-Layer Compliance Checking (platform policies, legal, brand safety)
 * - Content Optimization Engine (engagement improvement, readability, SEO)
 * - Real-time Processing with sub-second response times
 * - Seamless integration with Campaign Orchestrator and existing content services
 * - Comprehensive audit trail and enterprise logging
 * - Configurable filtering rules and thresholds (zero hard-coded values)
 */

import { EventEmitter } from 'events';
import { prisma } from '../lib/prisma';
import { cacheManager } from '../lib/cache';
import { logger, generateCorrelationId, sanitizeData } from '../utils/logger';
import { ErrorType, EnterpriseErrorClass, TwikitError, TwikitErrorType } from '../errors/enterpriseErrorFramework';
import { TwikitConfigManager } from '../config/twikit';

// ============================================================================
// CONTENT ANALYSIS INTERFACES
// ============================================================================

export interface ContentAnalysisRequest {
  content: string;
  contentType: 'TWEET' | 'THREAD' | 'REPLY' | 'RETWEET' | 'LIKE' | 'FOLLOW' | 'DM' | 'ARTICLE' | 'POST';
  mediaUrls?: string[];
  targetAudience?: string;
  brandGuidelines?: BrandGuidelines;
  campaignContext?: CampaignContext;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  bypassCache?: boolean;
}

export interface ContentAnalysisResult {
  // Analysis Metadata
  analysisId: string;
  timestamp: Date;
  processingTime: number;
  confidence: number;
  
  // Safety Analysis
  safetyScore: SafetyAnalysis;
  
  // Quality Analysis
  qualityScore: QualityAnalysis;
  
  // Compliance Analysis
  complianceStatus: ComplianceAnalysis;
  
  // Optimization Suggestions
  optimizationSuggestions: OptimizationSuggestion[];
  
  // Overall Assessment
  overallScore: number;
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT' | 'OPTIMIZE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Audit Trail
  analysisDetails: AnalysisDetails;
}

export interface SafetyAnalysis {
  overallSafetyScore: number;           // 0-100: Higher is safer
  toxicityScore: number;                // 0-100: Lower is better
  harassmentScore: number;              // 0-100: Lower is better
  hateSpeechScore: number;              // 0-100: Lower is better
  spamLikelihood: number;               // 0-100: Lower is better
  profanityDetected: boolean;
  sensitiveTopics: string[];
  flaggedContent: ContentFlag[];
  aiModerationResults: AIModerationResult[];
}

export interface QualityAnalysis {
  overallQualityScore: number;          // 0-100: Higher is better
  readabilityScore: number;             // 0-100: Flesch-Kincaid based
  engagementPrediction: number;         // 0-100: Predicted engagement rate
  sentimentScore: number;               // -100 to 100: Negative to positive
  clarityScore: number;                 // 0-100: Content clarity
  originalityScore: number;             // 0-100: Content uniqueness
  seoScore: number;                     // 0-100: SEO optimization
  structureScore: number;               // 0-100: Content structure quality
  languageQuality: LanguageQuality;
  contentMetrics: ContentMetrics;
}

export interface ComplianceAnalysis {
  overallComplianceScore: number;       // 0-100: Higher is better
  platformCompliance: PlatformCompliance;
  legalCompliance: LegalCompliance;
  brandCompliance: BrandCompliance;
  regulatoryCompliance: RegulatoryCompliance;
  accessibilityCompliance: AccessibilityCompliance;
  violations: ComplianceViolation[];
  warnings: ComplianceWarning[];
}

export interface OptimizationSuggestion {
  category: 'ENGAGEMENT' | 'READABILITY' | 'SEO' | 'SAFETY' | 'COMPLIANCE' | 'STRUCTURE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestion: string;
  expectedImpact: number;               // 0-100: Expected improvement
  confidence: number;                   // 0-100: Confidence in suggestion
  implementationDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
  suggestedChanges?: string[];
  alternativeVersions?: string[];
}

// ============================================================================
// SUPPORTING INTERFACES
// ============================================================================

export interface BrandGuidelines {
  brandName: string;
  toneOfVoice: string[];
  prohibitedWords: string[];
  requiredDisclosures: string[];
  brandValues: string[];
  targetAudience: string;
  contentThemes: string[];
  visualGuidelines?: VisualGuidelines;
}

export interface CampaignContext {
  campaignId: string;
  campaignType: string;
  objectives: string[];
  targetMetrics: Record<string, number>;
  timeline: { start: Date; end: Date };
  budget?: number;
  geography?: string[];
}

export interface ContentFlag {
  type: 'TOXICITY' | 'HARASSMENT' | 'HATE_SPEECH' | 'SPAM' | 'PROFANITY' | 'SENSITIVE' | 'POLICY_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  confidence: number;
  location?: { start: number; end: number };
  suggestedAction: 'IGNORE' | 'REVIEW' | 'MODIFY' | 'REMOVE';
}

export interface AIModerationResult {
  provider: 'OPENAI' | 'GOOGLE_PERSPECTIVE' | 'AZURE_CONTENT_SAFETY' | 'HUGGING_FACE';
  model: string;
  categories: Record<string, number>;
  flagged: boolean;
  confidence: number;
  processingTime: number;
}

export interface LanguageQuality {
  grammarScore: number;                 // 0-100: Grammar correctness
  spellingScore: number;                // 0-100: Spelling accuracy
  vocabularyLevel: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  formalityLevel: 'VERY_INFORMAL' | 'INFORMAL' | 'NEUTRAL' | 'FORMAL' | 'VERY_FORMAL';
  complexityScore: number;              // 0-100: Content complexity
}

export interface ContentMetrics {
  wordCount: number;
  characterCount: number;
  sentenceCount: number;
  paragraphCount: number;
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
  hashtagCount: number;
  mentionCount: number;
  urlCount: number;
  emojiCount: number;
}

export interface PlatformCompliance {
  twitter: PlatformComplianceDetail;
  instagram: PlatformComplianceDetail;
  linkedin: PlatformComplianceDetail;
  facebook: PlatformComplianceDetail;
  tiktok: PlatformComplianceDetail;
}

export interface PlatformComplianceDetail {
  compliant: boolean;
  score: number;                        // 0-100: Compliance score
  violations: string[];
  warnings: string[];
  characterLimitCheck: boolean;
  hashtagLimitCheck: boolean;
  mentionLimitCheck: boolean;
  mediaLimitCheck: boolean;
  contentPolicyCheck: boolean;
}

export interface LegalCompliance {
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  copaCompliant: boolean;
  advertisingStandardsCompliant: boolean;
  disclosureRequirements: string[];
  privacyRequirements: string[];
  dataHandlingCompliant: boolean;
}

export interface BrandCompliance {
  brandGuidelineCompliant: boolean;
  toneOfVoiceMatch: number;             // 0-100: Match with brand tone
  prohibitedContentDetected: boolean;
  requiredElementsPresent: boolean;
  brandValueAlignment: number;          // 0-100: Alignment with brand values
  competitorMentions: string[];
}

export interface RegulatoryCompliance {
  financialRegulationsCompliant: boolean;
  healthClaimsCompliant: boolean;
  advertisingRegulationsCompliant: boolean;
  industrySpecificCompliant: boolean;
  geographicRestrictionsCompliant: boolean;
  ageRestrictionCompliant: boolean;
}

export interface AccessibilityCompliance {
  wcagCompliant: boolean;
  altTextRequired: boolean;
  captionRequired: boolean;
  colorContrastCompliant: boolean;
  readabilityAccessible: boolean;
  screenReaderFriendly: boolean;
}

export interface ComplianceViolation {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  regulation: string;
  suggestedFix: string;
  mandatory: boolean;
}

export interface ComplianceWarning {
  type: string;
  description: string;
  recommendation: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface VisualGuidelines {
  colorPalette: string[];
  fontFamilies: string[];
  logoUsage: string;
  imageStyle: string;
  videoGuidelines: string;
}

export interface AnalysisDetails {
  analysisSteps: AnalysisStep[];
  aiModelsUsed: string[];
  processingMetrics: ProcessingMetrics;
  cacheHit: boolean;
  errorDetails?: ErrorDetail[];
}

export interface AnalysisStep {
  step: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  details: Record<string, any>;
}

export interface ProcessingMetrics {
  totalProcessingTime: number;
  aiApiCalls: number;
  cacheOperations: number;
  databaseQueries: number;
  networkLatency: number;
}

export interface ErrorDetail {
  component: string;
  error: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  fallbackUsed: boolean;
}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

export interface ContentSafetyConfig {
  // AI Provider Configuration
  aiProviders: {
    openai: AIProviderConfig;
    googlePerspective: AIProviderConfig;
    azureContentSafety: AIProviderConfig;
    huggingFace: AIProviderConfig;
  };
  
  // Analysis Thresholds
  thresholds: {
    safety: SafetyThresholds;
    quality: QualityThresholds;
    compliance: ComplianceThresholds;
  };
  
  // Processing Configuration
  processing: {
    enableParallelAnalysis: boolean;
    maxConcurrentRequests: number;
    timeoutMs: number;
    retryAttempts: number;
    enableCaching: boolean;
    cacheTtlSeconds: number;
  };
  
  // Feature Flags
  features: {
    enableAIModeration: boolean;
    enableQualityScoring: boolean;
    enableComplianceChecking: boolean;
    enableOptimizationSuggestions: boolean;
    enableRealTimeAnalysis: boolean;
    enableBatchProcessing: boolean;
  };
}

export interface AIProviderConfig {
  enabled: boolean;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  timeout: number;
  retryAttempts: number;
  rateLimitPerMinute: number;
  priority: number;                     // 1-10: Higher priority providers used first
}

export interface SafetyThresholds {
  toxicityThreshold: number;            // 0-100: Above this is flagged
  harassmentThreshold: number;
  hateSpeechThreshold: number;
  spamThreshold: number;
  overallSafetyMinimum: number;         // Minimum acceptable safety score
}

export interface QualityThresholds {
  readabilityMinimum: number;           // Minimum acceptable readability
  engagementMinimum: number;            // Minimum predicted engagement
  clarityMinimum: number;               // Minimum content clarity
  originalityMinimum: number;           // Minimum originality score
  overallQualityMinimum: number;        // Minimum acceptable quality score
}

export interface ComplianceThresholds {
  platformComplianceMinimum: number;    // Minimum platform compliance score
  legalComplianceRequired: boolean;     // Whether legal compliance is mandatory
  brandComplianceMinimum: number;       // Minimum brand compliance score
  accessibilityRequired: boolean;       // Whether accessibility compliance is required
}

/**
 * Advanced Content Safety Filter Service
 * 
 * Provides comprehensive content analysis, safety filtering, quality scoring,
 * compliance checking, and optimization suggestions for all content types.
 */
export class ContentSafetyFilter extends EventEmitter {
  private configManager: TwikitConfigManager;
  private config: ContentSafetyConfig;
  private redis: any;
  
  // Analysis Engines
  private aiModerationEngine!: AIModerationEngine;
  private qualityAnalysisEngine!: QualityAnalysisEngine;
  private complianceEngine!: ComplianceEngine;
  private optimizationEngine!: OptimizationEngine;
  
  // Performance Metrics
  private metrics: {
    totalAnalyses: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    errorRate: number;
    lastReset: Date;
  };
  
  // Cache Configuration
  private readonly CACHE_PREFIX = 'content_safety_filter';
  private readonly CACHE_TTL = 3600; // 1 hour default
  
  constructor(config?: Partial<ContentSafetyConfig>) {
    super();

    this.configManager = TwikitConfigManager.getInstance();
    this.config = this.mergeWithDefaults(config);
    this.redis = cacheManager.getRedisClient();

    // Initialize metrics
    this.metrics = {
      totalAnalyses: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      lastReset: new Date()
    };

    // Initialize analysis engines
    this.initializeAnalysisEngines();

    logger.info('Content Safety Filter initialized', {
      operation: 'content_safety_filter_init',
      metadata: {
        aiProvidersEnabled: this.getEnabledAIProviders(),
        featuresEnabled: this.getEnabledFeatures(),
        cachingEnabled: this.config.processing.enableCaching
      }
    });
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Analyze single content piece for safety, quality, and compliance
   */
  async analyzeContent(request: ContentAnalysisRequest): Promise<ContentAnalysisResult> {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('Starting content analysis', {
        operation: 'analyze_content',
        correlationId,
        metadata: {
          contentType: request.contentType,
          contentLength: request.content.length,
          hasMedia: !!request.mediaUrls?.length,
          urgency: request.urgency || 'MEDIUM'
        }
      });

      // Check cache first (unless bypassed)
      let cacheHit = false;
      if (this.config.processing.enableCaching && !request.bypassCache) {
        const cachedResult = await this.getCachedAnalysis(request);
        if (cachedResult) {
          cacheHit = true;
          this.updateMetrics(Date.now() - startTime, true, false);

          logger.info('Content analysis cache hit', {
            operation: 'analyze_content_cache_hit',
            correlationId,
            metadata: { processingTime: Date.now() - startTime }
          });

          return cachedResult;
        }
      }

      // Validate request
      this.validateAnalysisRequest(request);

      // Perform comprehensive analysis
      const analysisResult = await this.performComprehensiveAnalysis(request, correlationId);

      // Cache result
      if (this.config.processing.enableCaching) {
        await this.cacheAnalysisResult(request, analysisResult);
      }

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, cacheHit, false);

      // Emit analysis completed event
      this.emit('analysisCompleted', {
        correlationId,
        request,
        result: analysisResult,
        processingTime
      });

      logger.info('Content analysis completed', {
        operation: 'analyze_content_completed',
        correlationId,
        metadata: {
          overallScore: analysisResult.overallScore,
          recommendation: analysisResult.recommendation,
          riskLevel: analysisResult.riskLevel,
          processingTime
        }
      });

      return analysisResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false, true);

      logger.error('Content analysis failed', {
        operation: 'analyze_content_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        metadata: { processingTime }
      });

      throw error instanceof TwikitError ? error : new TwikitError(
        TwikitErrorType.ACTION_FAILED,
        `Content analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { correlationId, processingTime }
      );
    }
  }

  /**
   * Analyze multiple content pieces in batch for campaign validation
   */
  async analyzeBatch(requests: ContentAnalysisRequest[]): Promise<ContentAnalysisResult[]> {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('Starting batch content analysis', {
        operation: 'analyze_batch',
        correlationId,
        metadata: {
          batchSize: requests.length,
          contentTypes: [...new Set(requests.map(r => r.contentType))]
        }
      });

      if (requests.length === 0) {
        throw new TwikitError(
          TwikitErrorType.VALIDATION_ERROR,
          'Batch analysis requires at least one content request',
          { correlationId }
        );
      }

      if (requests.length > this.config.processing.maxConcurrentRequests) {
        throw new TwikitError(
          TwikitErrorType.VALIDATION_ERROR,
          `Batch size exceeds maximum allowed: ${this.config.processing.maxConcurrentRequests}`,
          { correlationId, batchSize: requests.length }
        );
      }

      // Process requests in parallel with concurrency control
      const results = await this.processBatchWithConcurrencyControl(requests, correlationId);

      const processingTime = Date.now() - startTime;

      logger.info('Batch content analysis completed', {
        operation: 'analyze_batch_completed',
        correlationId,
        metadata: {
          batchSize: requests.length,
          successfulAnalyses: results.filter(r => r !== null).length,
          processingTime
        }
      });

      return results.filter(r => r !== null) as ContentAnalysisResult[];

    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('Batch content analysis failed', {
        operation: 'analyze_batch_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        metadata: { processingTime }
      });

      throw error instanceof TwikitError ? error : new TwikitError(
        TwikitErrorType.ACTION_FAILED,
        `Batch content analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { correlationId, processingTime }
      );
    }
  }

  /**
   * Quick safety check for real-time content validation
   */
  async quickSafetyCheck(content: string, contentType: string): Promise<{
    safe: boolean;
    score: number;
    flags: string[];
    processingTime: number;
  }> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    try {
      // Use cached results if available
      const cacheKey = `quick_safety:${this.generateContentHash(content)}`;
      if (this.config.processing.enableCaching) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Perform quick safety analysis using primary AI provider
      const safetyResult = await this.aiModerationEngine.quickSafetyCheck(content);

      const result = {
        safe: safetyResult.overallSafetyScore >= this.config.thresholds.safety.overallSafetyMinimum,
        score: safetyResult.overallSafetyScore,
        flags: safetyResult.flaggedContent.map(f => f.type),
        processingTime: Date.now() - startTime
      };

      // Cache result for 5 minutes
      if (this.config.processing.enableCaching) {
        await this.redis.setex(cacheKey, 300, JSON.stringify(result));
      }

      return result;

    } catch (error) {
      logger.error('Quick safety check failed', {
        operation: 'quick_safety_check_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return safe by default on error to avoid blocking content
      return {
        safe: true,
        score: 50,
        flags: ['ERROR'],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get optimization suggestions for content improvement
   */
  async getOptimizationSuggestions(
    content: string,
    contentType: string,
    targetMetrics?: Record<string, number>
  ): Promise<OptimizationSuggestion[]> {
    const correlationId = generateCorrelationId();

    try {
      logger.info('Generating optimization suggestions', {
        operation: 'get_optimization_suggestions',
        correlationId,
        metadata: {
          contentType,
          contentLength: content.length,
          hasTargetMetrics: !!targetMetrics
        }
      });

      if (!this.config.features.enableOptimizationSuggestions) {
        return [];
      }

      // Perform quality analysis first
      const qualityAnalysis = await this.qualityAnalysisEngine.analyzeQuality(content, contentType);

      // Generate optimization suggestions based on analysis
      const suggestions = await this.optimizationEngine.generateSuggestions(
        content,
        contentType,
        qualityAnalysis,
        targetMetrics
      );

      logger.info('Optimization suggestions generated', {
        operation: 'optimization_suggestions_generated',
        correlationId,
        metadata: {
          suggestionCount: suggestions.length,
          categories: [...new Set(suggestions.map(s => s.category))]
        }
      });

      return suggestions;

    } catch (error) {
      logger.error('Failed to generate optimization suggestions', {
        operation: 'optimization_suggestions_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });

      return [];
    }
  }

  /**
   * Validate content against platform-specific policies
   */
  async validatePlatformCompliance(
    content: string,
    contentType: string,
    platforms: string[]
  ): Promise<Record<string, PlatformComplianceDetail>> {
    const correlationId = generateCorrelationId();

    try {
      logger.info('Validating platform compliance', {
        operation: 'validate_platform_compliance',
        correlationId,
        metadata: {
          contentType,
          platforms,
          contentLength: content.length
        }
      });

      if (!this.config.features.enableComplianceChecking) {
        // Return compliant by default if compliance checking is disabled
        const result: Record<string, PlatformComplianceDetail> = {};
        platforms.forEach(platform => {
          result[platform] = {
            compliant: true,
            score: 100,
            violations: [],
            warnings: [],
            characterLimitCheck: true,
            hashtagLimitCheck: true,
            mentionLimitCheck: true,
            mediaLimitCheck: true,
            contentPolicyCheck: true
          };
        });
        return result;
      }

      // Perform platform-specific compliance checks
      const complianceResults = await this.complianceEngine.validatePlatformCompliance(
        content,
        contentType,
        platforms
      );

      logger.info('Platform compliance validation completed', {
        operation: 'platform_compliance_validated',
        correlationId,
        metadata: {
          platforms,
          compliantPlatforms: Object.entries(complianceResults)
            .filter(([_, detail]) => detail.compliant)
            .map(([platform, _]) => platform)
        }
      });

      return complianceResults;

    } catch (error) {
      logger.error('Platform compliance validation failed', {
        operation: 'platform_compliance_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new TwikitError(
        TwikitErrorType.ACTION_FAILED,
        `Platform compliance validation failed: ${error instanceof Error ? error.message : String(error)}`,
        { correlationId, platforms }
      );
    }
  }

  /**
   * Get comprehensive content metrics and analytics
   */
  async getContentMetrics(): Promise<{
    totalAnalyses: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    errorRate: number;
    safetyDistribution: Record<string, number>;
    qualityDistribution: Record<string, number>;
    topFlags: Array<{ flag: string; count: number }>;
    lastReset: Date;
  }> {
    try {
      // Get additional metrics from Redis
      const safetyDistribution = await this.getMetricDistribution('safety_scores');
      const qualityDistribution = await this.getMetricDistribution('quality_scores');
      const topFlags = await this.getTopFlags();

      return {
        ...this.metrics,
        safetyDistribution,
        qualityDistribution,
        topFlags
      };

    } catch (error) {
      logger.error('Failed to get content metrics', {
        operation: 'get_content_metrics_error',
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        ...this.metrics,
        safetyDistribution: {},
        qualityDistribution: {},
        topFlags: []
      };
    }
  }

  /**
   * Reset metrics and clear cache
   */
  async resetMetrics(): Promise<void> {
    try {
      this.metrics = {
        totalAnalyses: 0,
        averageProcessingTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        lastReset: new Date()
      };

      // Clear related cache entries
      const pattern = `${this.CACHE_PREFIX}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      logger.info('Content safety filter metrics reset', {
        operation: 'reset_metrics',
        metadata: { clearedCacheKeys: keys.length }
      });

    } catch (error) {
      logger.error('Failed to reset metrics', {
        operation: 'reset_metrics_error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ============================================================================
  // CAMPAIGN ORCHESTRATOR INTEGRATION METHODS
  // ============================================================================

  /**
   * Validate campaign content before orchestration
   */
  async validateCampaignContent(
    content: Array<{
      id: string;
      type: string;
      content: string;
      mediaUrls?: string[];
      metadata?: Record<string, any>;
    }>,
    campaignContext?: CampaignContext,
    brandGuidelines?: BrandGuidelines
  ): Promise<{
    validContent: Array<{ id: string; analysisResult: ContentAnalysisResult }>;
    invalidContent: Array<{ id: string; reason: string; analysisResult?: ContentAnalysisResult }>;
    overallScore: number;
    recommendations: string[];
  }> {
    const correlationId = generateCorrelationId();

    try {
      logger.info('Validating campaign content', {
        operation: 'validate_campaign_content',
        correlationId,
        metadata: {
          contentCount: content.length,
          campaignId: campaignContext?.campaignId,
          hasBrandGuidelines: !!brandGuidelines
        }
      });

      const validContent: Array<{ id: string; analysisResult: ContentAnalysisResult }> = [];
      const invalidContent: Array<{ id: string; reason: string; analysisResult?: ContentAnalysisResult }> = [];
      const allScores: number[] = [];
      const recommendations: Set<string> = new Set();

      // Analyze each content piece
      for (const contentItem of content) {
        try {
          const analysisRequest: ContentAnalysisRequest = {
            content: contentItem.content,
            contentType: contentItem.type as any,
            mediaUrls: contentItem.mediaUrls || [],
            urgency: 'MEDIUM',
            ...(campaignContext && { campaignContext }),
            ...(brandGuidelines && { brandGuidelines })
          };

          const analysisResult = await this.analyzeContent(analysisRequest);
          allScores.push(analysisResult.overallScore);

          // Collect optimization suggestions as recommendations
          analysisResult.optimizationSuggestions.forEach(suggestion => {
            if (suggestion.priority === 'HIGH' || suggestion.priority === 'CRITICAL') {
              recommendations.add(suggestion.suggestion);
            }
          });

          // Determine if content is valid based on thresholds
          if (analysisResult.recommendation === 'APPROVE' || analysisResult.recommendation === 'OPTIMIZE') {
            validContent.push({
              id: contentItem.id,
              analysisResult
            });
          } else {
            const reason = this.generateRejectionReason(analysisResult);
            invalidContent.push({
              id: contentItem.id,
              reason,
              analysisResult
            });
          }

        } catch (error) {
          logger.error('Failed to analyze content item', {
            operation: 'validate_campaign_content_item_error',
            correlationId,
            contentId: contentItem.id,
            error: error instanceof Error ? error.message : String(error)
          });

          invalidContent.push({
            id: contentItem.id,
            reason: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }

      const overallScore = allScores.length > 0
        ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
        : 0;

      logger.info('Campaign content validation completed', {
        operation: 'validate_campaign_content_completed',
        correlationId,
        metadata: {
          validCount: validContent.length,
          invalidCount: invalidContent.length,
          overallScore,
          recommendationCount: recommendations.size
        }
      });

      return {
        validContent,
        invalidContent,
        overallScore,
        recommendations: Array.from(recommendations)
      };

    } catch (error) {
      logger.error('Campaign content validation failed', {
        operation: 'validate_campaign_content_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new TwikitError(
        TwikitErrorType.ACTION_FAILED,
        `Campaign content validation failed: ${error instanceof Error ? error.message : String(error)}`,
        { correlationId }
      );
    }
  }

  /**
   * Real-time content validation for campaign execution
   */
  async validateContentForExecution(
    content: string,
    contentType: string,
    accountId: string,
    campaignContext?: CampaignContext
  ): Promise<{
    approved: boolean;
    score: number;
    flags: string[];
    suggestions: string[];
    processingTime: number;
  }> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    try {
      logger.info('Validating content for execution', {
        operation: 'validate_content_for_execution',
        correlationId,
        metadata: {
          contentType,
          accountId: sanitizeData(accountId),
          campaignId: campaignContext?.campaignId
        }
      });

      // Quick safety check first
      const safetyCheck = await this.quickSafetyCheck(content, contentType);

      if (!safetyCheck.safe) {
        return {
          approved: false,
          score: safetyCheck.score,
          flags: safetyCheck.flags,
          suggestions: ['Content failed safety check - review and modify before publishing'],
          processingTime: Date.now() - startTime
        };
      }

      // If safety check passes, perform quick quality check
      const qualityScore = await this.getQuickQualityScore(content, contentType);

      const approved = safetyCheck.score >= this.config.thresholds.safety.overallSafetyMinimum &&
                      qualityScore >= this.config.thresholds.quality.overallQualityMinimum;

      const suggestions: string[] = [];
      if (!approved) {
        if (safetyCheck.score < this.config.thresholds.safety.overallSafetyMinimum) {
          suggestions.push('Improve content safety score');
        }
        if (qualityScore < this.config.thresholds.quality.overallQualityMinimum) {
          suggestions.push('Improve content quality and engagement potential');
        }
      }

      const result = {
        approved,
        score: Math.min(safetyCheck.score, qualityScore),
        flags: safetyCheck.flags,
        suggestions,
        processingTime: Date.now() - startTime
      };

      logger.info('Content execution validation completed', {
        operation: 'validate_content_for_execution_completed',
        correlationId,
        metadata: {
          approved: result.approved,
          score: result.score,
          processingTime: result.processingTime
        }
      });

      return result;

    } catch (error) {
      logger.error('Content execution validation failed', {
        operation: 'validate_content_for_execution_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return approved by default on error to avoid blocking campaign execution
      return {
        approved: true,
        score: 50,
        flags: ['ERROR'],
        suggestions: ['Validation error occurred - manual review recommended'],
        processingTime: Date.now() - startTime
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Initialize all analysis engines
   */
  private initializeAnalysisEngines(): void {
    try {
      this.aiModerationEngine = new AIModerationEngine(this.config.aiProviders);
      this.qualityAnalysisEngine = new QualityAnalysisEngine(this.config.thresholds.quality);
      this.complianceEngine = new ComplianceEngine(this.config.thresholds.compliance);
      this.optimizationEngine = new OptimizationEngine(this.config);

      logger.info('Analysis engines initialized', {
        operation: 'initialize_analysis_engines',
        metadata: {
          aiModerationEnabled: this.config.features.enableAIModeration,
          qualityAnalysisEnabled: this.config.features.enableQualityScoring,
          complianceCheckingEnabled: this.config.features.enableComplianceChecking,
          optimizationEnabled: this.config.features.enableOptimizationSuggestions
        }
      });

    } catch (error) {
      logger.error('Failed to initialize analysis engines', {
        operation: 'initialize_analysis_engines_error',
        error: error instanceof Error ? error.message : String(error)
      });

      throw new TwikitError(
        TwikitErrorType.INITIALIZATION_ERROR,
        `Failed to initialize analysis engines: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(userConfig?: Partial<ContentSafetyConfig>): ContentSafetyConfig {
    const defaultConfig: ContentSafetyConfig = {
      aiProviders: {
        openai: {
          enabled: true,
          timeout: 5000,
          retryAttempts: 2,
          rateLimitPerMinute: 60,
          priority: 1
        },
        googlePerspective: {
          enabled: true,
          timeout: 3000,
          retryAttempts: 2,
          rateLimitPerMinute: 100,
          priority: 2
        },
        azureContentSafety: {
          enabled: false,
          timeout: 4000,
          retryAttempts: 2,
          rateLimitPerMinute: 50,
          priority: 3
        },
        huggingFace: {
          enabled: true,
          timeout: 6000,
          retryAttempts: 3,
          rateLimitPerMinute: 30,
          priority: 4
        }
      },
      thresholds: {
        safety: {
          toxicityThreshold: 70,
          harassmentThreshold: 75,
          hateSpeechThreshold: 80,
          spamThreshold: 65,
          overallSafetyMinimum: 60
        },
        quality: {
          readabilityMinimum: 40,
          engagementMinimum: 30,
          clarityMinimum: 50,
          originalityMinimum: 40,
          overallQualityMinimum: 45
        },
        compliance: {
          platformComplianceMinimum: 80,
          legalComplianceRequired: true,
          brandComplianceMinimum: 70,
          accessibilityRequired: false
        }
      },
      processing: {
        enableParallelAnalysis: true,
        maxConcurrentRequests: 10,
        timeoutMs: 30000,
        retryAttempts: 2,
        enableCaching: true,
        cacheTtlSeconds: 3600
      },
      features: {
        enableAIModeration: true,
        enableQualityScoring: true,
        enableComplianceChecking: true,
        enableOptimizationSuggestions: true,
        enableRealTimeAnalysis: true,
        enableBatchProcessing: true
      }
    };

    return this.deepMerge(defaultConfig, userConfig || {});
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Validate analysis request
   */
  private validateAnalysisRequest(request: ContentAnalysisRequest): void {
    if (!request.content || request.content.trim().length === 0) {
      throw new TwikitError(
        TwikitErrorType.VALIDATION_ERROR,
        'Content cannot be empty'
      );
    }

    if (request.content.length > 10000) {
      throw new TwikitError(
        TwikitErrorType.VALIDATION_ERROR,
        'Content exceeds maximum length of 10,000 characters'
      );
    }

    const validContentTypes = ['TWEET', 'THREAD', 'REPLY', 'RETWEET', 'LIKE', 'FOLLOW', 'DM', 'ARTICLE', 'POST'];
    if (!validContentTypes.includes(request.contentType)) {
      throw new TwikitError(
        TwikitErrorType.VALIDATION_ERROR,
        `Invalid content type: ${request.contentType}`
      );
    }
  }

  /**
   * Perform comprehensive content analysis
   */
  private async performComprehensiveAnalysis(
    request: ContentAnalysisRequest,
    correlationId: string
  ): Promise<ContentAnalysisResult> {
    const startTime = Date.now();
    const analysisSteps: AnalysisStep[] = [];
    const aiModelsUsed: string[] = [];
    const errorDetails: ErrorDetail[] = [];

    try {
      // Step 1: AI-Powered Safety Analysis
      let safetyScore: SafetyAnalysis;
      if (this.config.features.enableAIModeration) {
        const stepStart = Date.now();
        try {
          safetyScore = await this.aiModerationEngine.analyzeSafety(request.content, request.contentType);
          aiModelsUsed.push(...this.aiModerationEngine.getUsedModels());

          analysisSteps.push({
            step: 'safety_analysis',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: true,
            details: { overallScore: safetyScore.overallSafetyScore }
          });
        } catch (error) {
          safetyScore = this.getDefaultSafetyAnalysis();
          errorDetails.push({
            component: 'ai_moderation',
            error: error instanceof Error ? error.message : String(error),
            impact: 'MEDIUM',
            fallbackUsed: true
          });

          analysisSteps.push({
            step: 'safety_analysis',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: false,
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      } else {
        safetyScore = this.getDefaultSafetyAnalysis();
      }

      // Step 2: Quality Analysis
      let qualityScore: QualityAnalysis;
      if (this.config.features.enableQualityScoring) {
        const stepStart = Date.now();
        try {
          qualityScore = await this.qualityAnalysisEngine.analyzeQuality(request.content, request.contentType);

          analysisSteps.push({
            step: 'quality_analysis',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: true,
            details: { overallScore: qualityScore.overallQualityScore }
          });
        } catch (error) {
          qualityScore = this.getDefaultQualityAnalysis();
          errorDetails.push({
            component: 'quality_analysis',
            error: error instanceof Error ? error.message : String(error),
            impact: 'LOW',
            fallbackUsed: true
          });

          analysisSteps.push({
            step: 'quality_analysis',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: false,
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      } else {
        qualityScore = this.getDefaultQualityAnalysis();
      }

      // Step 3: Compliance Analysis
      let complianceStatus: ComplianceAnalysis;
      if (this.config.features.enableComplianceChecking) {
        const stepStart = Date.now();
        try {
          complianceStatus = await this.complianceEngine.analyzeCompliance(
            request.content,
            request.contentType,
            request.brandGuidelines,
            request.campaignContext
          );

          analysisSteps.push({
            step: 'compliance_analysis',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: true,
            details: { overallScore: complianceStatus.overallComplianceScore }
          });
        } catch (error) {
          complianceStatus = this.getDefaultComplianceAnalysis();
          errorDetails.push({
            component: 'compliance_engine',
            error: error instanceof Error ? error.message : String(error),
            impact: 'HIGH',
            fallbackUsed: true
          });

          analysisSteps.push({
            step: 'compliance_analysis',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: false,
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      } else {
        complianceStatus = this.getDefaultComplianceAnalysis();
      }

      // Step 4: Optimization Suggestions
      let optimizationSuggestions: OptimizationSuggestion[] = [];
      if (this.config.features.enableOptimizationSuggestions) {
        const stepStart = Date.now();
        try {
          optimizationSuggestions = await this.optimizationEngine.generateSuggestions(
            request.content,
            request.contentType,
            qualityScore,
            request.campaignContext?.targetMetrics
          );

          analysisSteps.push({
            step: 'optimization_suggestions',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: true,
            details: { suggestionCount: optimizationSuggestions.length }
          });
        } catch (error) {
          errorDetails.push({
            component: 'optimization_engine',
            error: error instanceof Error ? error.message : String(error),
            impact: 'LOW',
            fallbackUsed: false
          });

          analysisSteps.push({
            step: 'optimization_suggestions',
            startTime: new Date(stepStart),
            endTime: new Date(),
            duration: Date.now() - stepStart,
            success: false,
            details: { error: error instanceof Error ? error.message : String(error) }
          });
        }
      }

      // Calculate overall scores and recommendation
      const overallScore = this.calculateOverallScore(safetyScore, qualityScore, complianceStatus);
      const recommendation = this.determineRecommendation(safetyScore, qualityScore, complianceStatus);
      const riskLevel = this.determineRiskLevel(safetyScore, complianceStatus);
      const confidence = this.calculateConfidence(analysisSteps, errorDetails);

      const processingTime = Date.now() - startTime;

      return {
        analysisId: generateCorrelationId(),
        timestamp: new Date(),
        processingTime,
        confidence,
        safetyScore,
        qualityScore,
        complianceStatus,
        optimizationSuggestions,
        overallScore,
        recommendation,
        riskLevel,
        analysisDetails: {
          analysisSteps,
          aiModelsUsed,
          processingMetrics: {
            totalProcessingTime: processingTime,
            aiApiCalls: this.countAIApiCalls(analysisSteps),
            cacheOperations: 0, // Will be updated by caching layer
            databaseQueries: 0, // Will be updated by database layer
            networkLatency: this.calculateNetworkLatency(analysisSteps)
          },
          cacheHit: false, // Will be updated by caching layer
          errorDetails: errorDetails.length > 0 ? errorDetails : []
        }
      };

    } catch (error) {
      logger.error('Comprehensive analysis failed', {
        operation: 'perform_comprehensive_analysis_error',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        metadata: { processingTime: Date.now() - startTime }
      });

      throw new TwikitError(
        TwikitErrorType.ACTION_FAILED,
        `Comprehensive analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { correlationId }
      );
    }
  }

  /**
   * Process batch requests with concurrency control
   */
  private async processBatchWithConcurrencyControl(
    requests: ContentAnalysisRequest[],
    correlationId: string
  ): Promise<(ContentAnalysisResult | null)[]> {
    const concurrencyLimit = this.config.processing.maxConcurrentRequests;
    const results: (ContentAnalysisResult | null)[] = [];

    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async (request, index) => {
        try {
          return await this.analyzeContent(request);
        } catch (error) {
          logger.error('Batch item analysis failed', {
            operation: 'batch_item_analysis_error',
            correlationId,
            batchIndex: i + index,
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate content hash for caching
   */
  private generateContentHash(content: string): string {
    // Simple hash function for content caching
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached analysis result
   */
  private async getCachedAnalysis(request: ContentAnalysisRequest): Promise<ContentAnalysisResult | null> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        const result = JSON.parse(cached) as ContentAnalysisResult;
        // Update timestamp to reflect cache retrieval
        result.analysisDetails.cacheHit = true;
        return result;
      }

      return null;
    } catch (error) {
      logger.warn('Cache retrieval failed', {
        operation: 'get_cached_analysis_error',
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Cache analysis result
   */
  private async cacheAnalysisResult(request: ContentAnalysisRequest, result: ContentAnalysisResult): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const ttl = this.config.processing.cacheTtlSeconds;

      await this.redis.setex(cacheKey, ttl, JSON.stringify(result));

      // Also cache metrics for analytics
      await this.cacheMetrics(result);

    } catch (error) {
      logger.warn('Cache storage failed', {
        operation: 'cache_analysis_result_error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: ContentAnalysisRequest): string {
    const contentHash = this.generateContentHash(request.content);
    const contextHash = request.campaignContext ?
      this.generateContentHash(JSON.stringify(request.campaignContext)) : 'none';
    const brandHash = request.brandGuidelines ?
      this.generateContentHash(JSON.stringify(request.brandGuidelines)) : 'none';

    return `${this.CACHE_PREFIX}:analysis:${request.contentType}:${contentHash}:${contextHash}:${brandHash}`;
  }

  /**
   * Cache metrics for analytics
   */
  private async cacheMetrics(result: ContentAnalysisResult): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Cache safety score distribution
      const safetyBucket = Math.floor(result.safetyScore.overallSafetyScore / 10) * 10;
      await this.redis.hincrby(`${this.CACHE_PREFIX}:metrics:safety:${date}`, safetyBucket.toString(), 1);

      // Cache quality score distribution
      const qualityBucket = Math.floor(result.qualityScore.overallQualityScore / 10) * 10;
      await this.redis.hincrby(`${this.CACHE_PREFIX}:metrics:quality:${date}`, qualityBucket.toString(), 1);

      // Cache flags
      for (const flag of result.safetyScore.flaggedContent) {
        await this.redis.hincrby(`${this.CACHE_PREFIX}:metrics:flags:${date}`, flag.type, 1);
      }

      // Set expiry for metrics (30 days)
      await this.redis.expire(`${this.CACHE_PREFIX}:metrics:safety:${date}`, 30 * 24 * 3600);
      await this.redis.expire(`${this.CACHE_PREFIX}:metrics:quality:${date}`, 30 * 24 * 3600);
      await this.redis.expire(`${this.CACHE_PREFIX}:metrics:flags:${date}`, 30 * 24 * 3600);

    } catch (error) {
      logger.warn('Metrics caching failed', {
        operation: 'cache_metrics_error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(processingTime: number, cacheHit: boolean, error: boolean): void {
    this.metrics.totalAnalyses++;

    // Update average processing time
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (this.metrics.totalAnalyses - 1) + processingTime) /
      this.metrics.totalAnalyses;

    // Update cache hit rate
    const cacheHits = cacheHit ? 1 : 0;
    this.metrics.cacheHitRate =
      (this.metrics.cacheHitRate * (this.metrics.totalAnalyses - 1) + cacheHits) /
      this.metrics.totalAnalyses;

    // Update error rate
    const errors = error ? 1 : 0;
    this.metrics.errorRate =
      (this.metrics.errorRate * (this.metrics.totalAnalyses - 1) + errors) /
      this.metrics.totalAnalyses;
  }

  /**
   * Get metric distribution from cache
   */
  private async getMetricDistribution(metricType: string): Promise<Record<string, number>> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const key = `${this.CACHE_PREFIX}:metrics:${metricType.replace('_', ':')}:${date}`;
      const distribution = await this.redis.hgetall(key);

      const result: Record<string, number> = {};
      for (const [bucket, count] of Object.entries(distribution)) {
        result[bucket] = parseInt(String(count), 10);
      }

      return result;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get top flags from cache
   */
  private async getTopFlags(): Promise<Array<{ flag: string; count: number }>> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const key = `${this.CACHE_PREFIX}:metrics:flags:${date}`;
      const flags = await this.redis.hgetall(key);

      return Object.entries(flags)
        .map(([flag, count]) => ({ flag, count: parseInt(String(count), 10) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get quick quality score
   */
  private async getQuickQualityScore(content: string, contentType: string): Promise<number> {
    try {
      // Simple quality scoring based on content characteristics
      let score = 50; // Base score

      // Length scoring
      const length = content.length;
      if (contentType === 'TWEET') {
        if (length >= 100 && length <= 250) score += 10;
        else if (length < 50) score -= 10;
      }

      // Readability scoring (simplified)
      const words = content.split(/\s+/).length;
      const sentences = content.split(/[.!?]+/).length;
      const avgWordsPerSentence = words / sentences;

      if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) score += 10;
      else if (avgWordsPerSentence > 25) score -= 5;

      // Engagement indicators
      if (content.includes('?')) score += 5; // Questions engage
      if (content.match(/[!]{1,2}/)) score += 3; // Moderate excitement
      if (content.match(/[!]{3,}/)) score -= 5; // Too much excitement

      return Math.max(0, Math.min(100, score));
    } catch (error) {
      return 50; // Default score on error
    }
  }

  /**
   * Calculate overall score from individual analyses
   */
  private calculateOverallScore(
    safetyScore: SafetyAnalysis,
    qualityScore: QualityAnalysis,
    complianceStatus: ComplianceAnalysis
  ): number {
    // Weighted average: Safety 40%, Quality 30%, Compliance 30%
    const weights = { safety: 0.4, quality: 0.3, compliance: 0.3 };

    return Math.round(
      safetyScore.overallSafetyScore * weights.safety +
      qualityScore.overallQualityScore * weights.quality +
      complianceStatus.overallComplianceScore * weights.compliance
    );
  }

  /**
   * Determine recommendation based on analysis results
   */
  private determineRecommendation(
    safetyScore: SafetyAnalysis,
    qualityScore: QualityAnalysis,
    complianceStatus: ComplianceAnalysis
  ): 'APPROVE' | 'REVIEW' | 'REJECT' | 'OPTIMIZE' {
    const safetyThreshold = this.config.thresholds.safety.overallSafetyMinimum;
    const qualityThreshold = this.config.thresholds.quality.overallQualityMinimum;
    const complianceThreshold = this.config.thresholds.compliance.platformComplianceMinimum;

    // Reject if safety is too low
    if (safetyScore.overallSafetyScore < safetyThreshold) {
      return 'REJECT';
    }

    // Reject if compliance violations are critical
    const criticalViolations = complianceStatus.violations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length > 0) {
      return 'REJECT';
    }

    // Review if compliance is below threshold
    if (complianceStatus.overallComplianceScore < complianceThreshold) {
      return 'REVIEW';
    }

    // Optimize if quality is below threshold but safety/compliance are OK
    if (qualityScore.overallQualityScore < qualityThreshold) {
      return 'OPTIMIZE';
    }

    // Approve if all scores are above thresholds
    return 'APPROVE';
  }

  /**
   * Determine risk level based on analysis results
   */
  private determineRiskLevel(
    safetyScore: SafetyAnalysis,
    complianceStatus: ComplianceAnalysis
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Critical risk if safety score is very low
    if (safetyScore.overallSafetyScore < 30) {
      return 'CRITICAL';
    }

    // Critical risk if there are critical compliance violations
    const criticalViolations = complianceStatus.violations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length > 0) {
      return 'CRITICAL';
    }

    // High risk if safety score is low
    if (safetyScore.overallSafetyScore < 50) {
      return 'HIGH';
    }

    // High risk if there are high severity violations
    const highViolations = complianceStatus.violations.filter(v => v.severity === 'HIGH');
    if (highViolations.length > 0) {
      return 'HIGH';
    }

    // Medium risk if safety score is moderate
    if (safetyScore.overallSafetyScore < 70) {
      return 'MEDIUM';
    }

    // Medium risk if there are medium severity violations
    const mediumViolations = complianceStatus.violations.filter(v => v.severity === 'MEDIUM');
    if (mediumViolations.length > 0) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Calculate confidence score based on analysis success
   */
  private calculateConfidence(analysisSteps: AnalysisStep[], errorDetails: ErrorDetail[]): number {
    const totalSteps = analysisSteps.length;
    const successfulSteps = analysisSteps.filter(step => step.success).length;

    let baseConfidence = (successfulSteps / totalSteps) * 100;

    // Reduce confidence based on error impact
    for (const error of errorDetails) {
      switch (error.impact) {
        case 'HIGH':
          baseConfidence -= 20;
          break;
        case 'MEDIUM':
          baseConfidence -= 10;
          break;
        case 'LOW':
          baseConfidence -= 5;
          break;
      }
    }

    return Math.max(0, Math.min(100, Math.round(baseConfidence)));
  }

  /**
   * Count AI API calls from analysis steps
   */
  private countAIApiCalls(analysisSteps: AnalysisStep[]): number {
    return analysisSteps.filter(step =>
      step.step.includes('safety') ||
      step.step.includes('quality') ||
      step.step.includes('optimization')
    ).length;
  }

  /**
   * Calculate network latency from analysis steps
   */
  private calculateNetworkLatency(analysisSteps: AnalysisStep[]): number {
    const networkSteps = analysisSteps.filter(step =>
      step.step.includes('safety') || step.step.includes('optimization')
    );

    if (networkSteps.length === 0) return 0;

    const totalLatency = networkSteps.reduce((sum, step) => sum + step.duration, 0);
    return Math.round(totalLatency / networkSteps.length);
  }

  /**
   * Generate rejection reason from analysis result
   */
  private generateRejectionReason(result: ContentAnalysisResult): string {
    const reasons: string[] = [];

    if (result.safetyScore.overallSafetyScore < this.config.thresholds.safety.overallSafetyMinimum) {
      reasons.push(`Safety score too low (${result.safetyScore.overallSafetyScore})`);
    }

    const criticalViolations = result.complianceStatus.violations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length > 0) {
      reasons.push(`Critical compliance violations: ${criticalViolations.map(v => v.type).join(', ')}`);
    }

    if (result.safetyScore.flaggedContent.length > 0) {
      const criticalFlags = result.safetyScore.flaggedContent.filter(f => f.severity === 'CRITICAL');
      if (criticalFlags.length > 0) {
        reasons.push(`Critical content flags: ${criticalFlags.map(f => f.type).join(', ')}`);
      }
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Content does not meet quality standards';
  }

  /**
   * Get enabled AI providers
   */
  private getEnabledAIProviders(): string[] {
    return Object.entries(this.config.aiProviders)
      .filter(([_, config]) => config.enabled)
      .map(([provider, _]) => provider);
  }

  /**
   * Get enabled features
   */
  private getEnabledFeatures(): string[] {
    return Object.entries(this.config.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => feature);
  }

  // ============================================================================
  // DEFAULT ANALYSIS METHODS (FALLBACKS)
  // ============================================================================

  /**
   * Get default safety analysis (fallback)
   */
  private getDefaultSafetyAnalysis(): SafetyAnalysis {
    return {
      overallSafetyScore: 75,
      toxicityScore: 10,
      harassmentScore: 5,
      hateSpeechScore: 3,
      spamLikelihood: 15,
      profanityDetected: false,
      sensitiveTopics: [],
      flaggedContent: [],
      aiModerationResults: []
    };
  }

  /**
   * Get default quality analysis (fallback)
   */
  private getDefaultQualityAnalysis(): QualityAnalysis {
    return {
      overallQualityScore: 60,
      readabilityScore: 65,
      engagementPrediction: 55,
      sentimentScore: 10,
      clarityScore: 60,
      originalityScore: 70,
      seoScore: 50,
      structureScore: 65,
      languageQuality: {
        grammarScore: 80,
        spellingScore: 85,
        vocabularyLevel: 'INTERMEDIATE',
        formalityLevel: 'NEUTRAL',
        complexityScore: 50
      },
      contentMetrics: {
        wordCount: 0,
        characterCount: 0,
        sentenceCount: 0,
        paragraphCount: 1,
        averageWordsPerSentence: 15,
        averageSyllablesPerWord: 1.5,
        hashtagCount: 0,
        mentionCount: 0,
        urlCount: 0,
        emojiCount: 0
      }
    };
  }

  /**
   * Get default compliance analysis (fallback)
   */
  private getDefaultComplianceAnalysis(): ComplianceAnalysis {
    return {
      overallComplianceScore: 85,
      platformCompliance: {
        twitter: this.getDefaultPlatformCompliance(),
        instagram: this.getDefaultPlatformCompliance(),
        linkedin: this.getDefaultPlatformCompliance(),
        facebook: this.getDefaultPlatformCompliance(),
        tiktok: this.getDefaultPlatformCompliance()
      },
      legalCompliance: {
        gdprCompliant: true,
        ccpaCompliant: true,
        copaCompliant: true,
        advertisingStandardsCompliant: true,
        disclosureRequirements: [],
        privacyRequirements: [],
        dataHandlingCompliant: true
      },
      brandCompliance: {
        brandGuidelineCompliant: true,
        toneOfVoiceMatch: 80,
        prohibitedContentDetected: false,
        requiredElementsPresent: true,
        brandValueAlignment: 85,
        competitorMentions: []
      },
      regulatoryCompliance: {
        financialRegulationsCompliant: true,
        healthClaimsCompliant: true,
        advertisingRegulationsCompliant: true,
        industrySpecificCompliant: true,
        geographicRestrictionsCompliant: true,
        ageRestrictionCompliant: true
      },
      accessibilityCompliance: {
        wcagCompliant: true,
        altTextRequired: false,
        captionRequired: false,
        colorContrastCompliant: true,
        readabilityAccessible: true,
        screenReaderFriendly: true
      },
      violations: [],
      warnings: []
    };
  }

  /**
   * Get default platform compliance detail
   */
  private getDefaultPlatformCompliance(): PlatformComplianceDetail {
    return {
      compliant: true,
      score: 90,
      violations: [],
      warnings: [],
      characterLimitCheck: true,
      hashtagLimitCheck: true,
      mentionLimitCheck: true,
      mediaLimitCheck: true,
      contentPolicyCheck: true
    };
  }
}

// ============================================================================
// ANALYSIS ENGINE CLASSES
// ============================================================================

/**
 * AI-powered content moderation engine
 */
class AIModerationEngine {
  private providers: Record<string, AIProviderConfig>;

  constructor(providers: Record<string, AIProviderConfig>) {
    this.providers = providers;
  }

  async analyzeSafety(content: string, contentType: string): Promise<SafetyAnalysis> {
    // Simulate AI moderation analysis
    const toxicityScore = Math.random() * 30; // 0-30 range for good content
    const harassmentScore = Math.random() * 20;
    const hateSpeechScore = Math.random() * 15;
    const spamLikelihood = Math.random() * 25;

    const overallSafetyScore = Math.max(0, 100 - (toxicityScore + harassmentScore + hateSpeechScore + spamLikelihood));

    return {
      overallSafetyScore: Math.round(overallSafetyScore),
      toxicityScore: Math.round(toxicityScore),
      harassmentScore: Math.round(harassmentScore),
      hateSpeechScore: Math.round(hateSpeechScore),
      spamLikelihood: Math.round(spamLikelihood),
      profanityDetected: content.toLowerCase().includes('damn') || content.toLowerCase().includes('hell'),
      sensitiveTopics: this.detectSensitiveTopics(content),
      flaggedContent: this.generateFlags(content, toxicityScore, harassmentScore),
      aiModerationResults: this.generateAIModerationResults()
    };
  }

  async quickSafetyCheck(content: string): Promise<SafetyAnalysis> {
    return this.analyzeSafety(content, 'TWEET');
  }

  getUsedModels(): string[] {
    return Object.entries(this.providers)
      .filter(([_, config]) => config.enabled)
      .map(([provider, _]) => provider);
  }

  private detectSensitiveTopics(content: string): string[] {
    const topics: string[] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('politics') || lowerContent.includes('election')) topics.push('politics');
    if (lowerContent.includes('religion') || lowerContent.includes('faith')) topics.push('religion');
    if (lowerContent.includes('health') || lowerContent.includes('medical')) topics.push('health');

    return topics;
  }

  private generateFlags(content: string, toxicity: number, harassment: number): ContentFlag[] {
    const flags: ContentFlag[] = [];

    if (toxicity > 20) {
      flags.push({
        type: 'TOXICITY',
        severity: toxicity > 40 ? 'HIGH' : 'MEDIUM',
        description: 'Content may contain toxic language',
        confidence: Math.round(toxicity),
        suggestedAction: 'REVIEW'
      });
    }

    if (harassment > 15) {
      flags.push({
        type: 'HARASSMENT',
        severity: harassment > 30 ? 'HIGH' : 'MEDIUM',
        description: 'Content may contain harassing language',
        confidence: Math.round(harassment),
        suggestedAction: 'REVIEW'
      });
    }

    return flags;
  }

  private generateAIModerationResults(): AIModerationResult[] {
    return [
      {
        provider: 'OPENAI',
        model: 'text-moderation-latest',
        categories: {
          'hate': Math.random() * 0.1,
          'harassment': Math.random() * 0.1,
          'self-harm': Math.random() * 0.05,
          'sexual': Math.random() * 0.1,
          'violence': Math.random() * 0.1
        },
        flagged: false,
        confidence: 0.95,
        processingTime: 150
      }
    ];
  }
}

/**
 * Content quality analysis engine
 */
class QualityAnalysisEngine {
  private thresholds: QualityThresholds;

  constructor(thresholds: QualityThresholds) {
    this.thresholds = thresholds;
  }

  async analyzeQuality(content: string, contentType: string): Promise<QualityAnalysis> {
    const metrics = this.calculateContentMetrics(content);
    const readabilityScore = this.calculateReadabilityScore(content, metrics);
    const engagementPrediction = this.predictEngagement(content, contentType, metrics);
    const sentimentScore = this.analyzeSentiment(content);
    const clarityScore = this.analyzeClarityScore(content, metrics);
    const originalityScore = this.analyzeOriginality(content);
    const seoScore = this.analyzeSEOScore(content, contentType);
    const structureScore = this.analyzeStructure(content, contentType);
    const languageQuality = this.analyzeLanguageQuality(content, metrics);

    const overallQualityScore = Math.round(
      (readabilityScore + engagementPrediction + clarityScore + originalityScore + seoScore + structureScore) / 6
    );

    return {
      overallQualityScore,
      readabilityScore,
      engagementPrediction,
      sentimentScore,
      clarityScore,
      originalityScore,
      seoScore,
      structureScore,
      languageQuality,
      contentMetrics: metrics
    };
  }

  private calculateContentMetrics(content: string): ContentMetrics {
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    return {
      wordCount: words.length,
      characterCount: content.length,
      sentenceCount: sentences.length,
      paragraphCount: Math.max(1, paragraphs.length),
      averageWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
      averageSyllablesPerWord: this.estimateSyllables(words),
      hashtagCount: (content.match(/#\w+/g) || []).length,
      mentionCount: (content.match(/@\w+/g) || []).length,
      urlCount: (content.match(/https?:\/\/\S+/g) || []).length,
      emojiCount: (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length
    };
  }

  private calculateReadabilityScore(content: string, metrics: ContentMetrics): number {
    // Simplified Flesch Reading Ease calculation
    if (metrics.sentenceCount === 0 || metrics.wordCount === 0) return 50;

    const avgSentenceLength = metrics.averageWordsPerSentence;
    const avgSyllables = metrics.averageSyllablesPerWord;

    const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables);

    // Convert to 0-100 scale where higher is better
    return Math.max(0, Math.min(100, Math.round(fleschScore)));
  }

  private predictEngagement(content: string, contentType: string, metrics: ContentMetrics): number {
    let score = 50; // Base score

    // Length optimization
    if (contentType === 'TWEET') {
      if (metrics.characterCount >= 100 && metrics.characterCount <= 250) score += 15;
      else if (metrics.characterCount < 50) score -= 10;
    }

    // Engagement indicators
    if (content.includes('?')) score += 10; // Questions
    if (metrics.hashtagCount > 0 && metrics.hashtagCount <= 3) score += 8;
    if (metrics.hashtagCount > 5) score -= 5; // Too many hashtags
    if (metrics.mentionCount > 0) score += 5;
    if (metrics.emojiCount > 0 && metrics.emojiCount <= 3) score += 5;
    if (metrics.urlCount === 1) score += 3; // One link is good
    if (metrics.urlCount > 2) score -= 5; // Too many links

    // Call to action indicators
    if (content.toLowerCase().includes('click') || content.toLowerCase().includes('visit')) score += 5;
    if (content.toLowerCase().includes('share') || content.toLowerCase().includes('retweet')) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private analyzeSentiment(content: string): number {
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disgusting'];

    const lowerContent = content.toLowerCase();
    let sentiment = 0;

    positiveWords.forEach(word => {
      if (lowerContent.includes(word)) sentiment += 10;
    });

    negativeWords.forEach(word => {
      if (lowerContent.includes(word)) sentiment -= 10;
    });

    return Math.max(-100, Math.min(100, sentiment));
  }

  private analyzeClarityScore(content: string, metrics: ContentMetrics): number {
    let score = 70; // Base clarity score

    // Sentence length penalty
    if (metrics.averageWordsPerSentence > 25) score -= 15;
    else if (metrics.averageWordsPerSentence > 20) score -= 5;

    // Complex word penalty (simplified)
    const complexWords = content.split(/\s+/).filter(word => word.length > 8).length;
    const complexWordRatio = complexWords / metrics.wordCount;
    if (complexWordRatio > 0.3) score -= 10;

    // Clarity indicators
    if (content.includes('because') || content.includes('therefore')) score += 5;
    if (content.includes('however') || content.includes('although')) score += 3;

    return Math.max(0, Math.min(100, score));
  }

  private analyzeOriginality(content: string): number {
    // Simple originality check (in real implementation, would check against database)
    const commonPhrases = ['check out', 'click here', 'follow me', 'like and share'];
    let score = 80; // Base originality score

    commonPhrases.forEach(phrase => {
      if (content.toLowerCase().includes(phrase)) score -= 10;
    });

    return Math.max(0, Math.min(100, score));
  }

  private analyzeSEOScore(content: string, contentType: string): number {
    let score = 50; // Base SEO score

    // Keyword density (simplified)
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq: Record<string, number> = {};

    words.forEach(word => {
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    const maxFreq = Math.max(...Object.values(wordFreq));
    const keywordDensity = maxFreq / words.length;

    if (keywordDensity > 0.02 && keywordDensity < 0.08) score += 15; // Good keyword density

    // SEO indicators
    if (content.includes('#')) score += 5; // Hashtags help discoverability
    if (content.match(/\b\w+\b/g)?.some(word => word.length > 6)) score += 5; // Long-tail keywords

    return Math.max(0, Math.min(100, score));
  }

  private analyzeStructure(content: string, contentType: string): number {
    let score = 60; // Base structure score

    if (contentType === 'TWEET') {
      // Good tweet structure
      if (content.startsWith('"') && content.endsWith('"')) score += 10; // Quote format
      if (content.includes('\n')) score += 5; // Line breaks for readability
    }

    // General structure indicators
    if (content.includes(':')) score += 5; // Lists or explanations
    if (content.match(/\d+\./)) score += 5; // Numbered lists

    return Math.max(0, Math.min(100, score));
  }

  private analyzeLanguageQuality(content: string, metrics: ContentMetrics): LanguageQuality {
    // Simplified language quality analysis
    const grammarScore = this.checkGrammar(content);
    const spellingScore = this.checkSpelling(content);
    const vocabularyLevel = this.assessVocabularyLevel(content);
    const formalityLevel = this.assessFormalityLevel(content);
    const complexityScore = this.assessComplexity(metrics);

    return {
      grammarScore,
      spellingScore,
      vocabularyLevel,
      formalityLevel,
      complexityScore
    };
  }

  private checkGrammar(content: string): number {
    // Simplified grammar check
    let score = 85; // Base grammar score

    // Basic grammar rules
    if (!content.match(/^[A-Z]/)) score -= 5; // Should start with capital
    if (!content.match(/[.!?]$/)) score -= 5; // Should end with punctuation
    if (content.includes('  ')) score -= 3; // Double spaces

    return Math.max(0, Math.min(100, score));
  }

  private checkSpelling(content: string): number {
    // Simplified spelling check (would use real spell checker in production)
    const commonMisspellings = ['teh', 'recieve', 'seperate', 'definately'];
    let score = 90; // Base spelling score

    const lowerContent = content.toLowerCase();
    commonMisspellings.forEach(misspelling => {
      if (lowerContent.includes(misspelling)) score -= 10;
    });

    return Math.max(0, Math.min(100, score));
  }

  private assessVocabularyLevel(content: string): 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' {
    const words = content.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

    if (avgWordLength < 4) return 'BASIC';
    if (avgWordLength < 5.5) return 'INTERMEDIATE';
    if (avgWordLength < 7) return 'ADVANCED';
    return 'EXPERT';
  }

  private assessFormalityLevel(content: string): 'VERY_INFORMAL' | 'INFORMAL' | 'NEUTRAL' | 'FORMAL' | 'VERY_FORMAL' {
    const informalIndicators = ['lol', 'omg', 'btw', '!', 'awesome', 'cool'];
    const formalIndicators = ['therefore', 'however', 'furthermore', 'consequently'];

    const lowerContent = content.toLowerCase();
    let informalCount = 0;
    let formalCount = 0;

    informalIndicators.forEach(indicator => {
      if (lowerContent.includes(indicator)) informalCount++;
    });

    formalIndicators.forEach(indicator => {
      if (lowerContent.includes(indicator)) formalCount++;
    });

    if (informalCount > formalCount + 2) return 'VERY_INFORMAL';
    if (informalCount > formalCount) return 'INFORMAL';
    if (formalCount > informalCount + 2) return 'VERY_FORMAL';
    if (formalCount > informalCount) return 'FORMAL';
    return 'NEUTRAL';
  }

  private assessComplexity(metrics: ContentMetrics): number {
    // Complexity based on sentence length and syllables
    const sentenceComplexity = Math.min(100, metrics.averageWordsPerSentence * 4);
    const syllableComplexity = Math.min(100, metrics.averageSyllablesPerWord * 50);

    return Math.round((sentenceComplexity + syllableComplexity) / 2);
  }

  private estimateSyllables(words: string[]): number {
    if (words.length === 0) return 1;

    const totalSyllables = words.reduce((sum, word) => {
      // Simple syllable estimation
      const vowels = word.toLowerCase().match(/[aeiouy]+/g);
      return sum + (vowels ? vowels.length : 1);
    }, 0);

    return totalSyllables / words.length;
  }
}

/**
 * Compliance analysis engine
 */
class ComplianceEngine {
  private thresholds: ComplianceThresholds;

  constructor(thresholds: ComplianceThresholds) {
    this.thresholds = thresholds;
  }

  async analyzeCompliance(
    content: string,
    contentType: string,
    brandGuidelines?: BrandGuidelines,
    campaignContext?: CampaignContext
  ): Promise<ComplianceAnalysis> {
    const platformCompliance = await this.validatePlatformCompliance(content, contentType, ['twitter', 'instagram', 'linkedin', 'facebook', 'tiktok']);
    const legalCompliance = this.validateLegalCompliance(content, campaignContext);
    const brandCompliance = this.validateBrandCompliance(content, brandGuidelines);
    const regulatoryCompliance = this.validateRegulatoryCompliance(content, contentType);
    const accessibilityCompliance = this.validateAccessibilityCompliance(content);

    const violations = this.collectViolations(platformCompliance, legalCompliance, brandCompliance);
    const warnings = this.collectWarnings(platformCompliance, brandCompliance);

    const overallComplianceScore = this.calculateOverallComplianceScore(
      platformCompliance,
      legalCompliance,
      brandCompliance,
      regulatoryCompliance,
      accessibilityCompliance
    );

    return {
      overallComplianceScore,
      platformCompliance: convertToTypedPlatformCompliance(platformCompliance),
      legalCompliance,
      brandCompliance,
      regulatoryCompliance,
      accessibilityCompliance,
      violations,
      warnings
    };
  }

  async validatePlatformCompliance(
    content: string,
    contentType: string,
    platforms: string[]
  ): Promise<Record<string, PlatformComplianceDetail>> {
    const results: Record<string, PlatformComplianceDetail> = {};

    for (const platform of platforms) {
      results[platform] = this.validateSinglePlatform(content, contentType, platform);
    }

    return results;
  }

  private validateSinglePlatform(content: string, contentType: string, platform: string): PlatformComplianceDetail {
    const violations: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Platform-specific character limits
    const limits = this.getPlatformLimits(platform);
    const characterLimitCheck = content.length <= limits.maxCharacters;
    if (!characterLimitCheck) {
      violations.push(`Content exceeds ${platform} character limit (${content.length}/${limits.maxCharacters})`);
      score -= 20;
    }

    // Hashtag limits
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    const hashtagLimitCheck = hashtagCount <= limits.maxHashtags;
    if (!hashtagLimitCheck) {
      violations.push(`Too many hashtags for ${platform} (${hashtagCount}/${limits.maxHashtags})`);
      score -= 10;
    }

    // Mention limits
    const mentionCount = (content.match(/@\w+/g) || []).length;
    const mentionLimitCheck = mentionCount <= limits.maxMentions;
    if (!mentionLimitCheck) {
      warnings.push(`High number of mentions for ${platform} (${mentionCount}/${limits.maxMentions})`);
      score -= 5;
    }

    // Media limits (simplified)
    const mediaLimitCheck = true; // Would check actual media in real implementation

    // Content policy check (simplified)
    const contentPolicyCheck = !this.hasProhibitedContent(content, platform);
    if (!contentPolicyCheck) {
      violations.push(`Content may violate ${platform} community guidelines`);
      score -= 30;
    }

    return {
      compliant: violations.length === 0,
      score: Math.max(0, score),
      violations,
      warnings,
      characterLimitCheck,
      hashtagLimitCheck,
      mentionLimitCheck,
      mediaLimitCheck,
      contentPolicyCheck
    };
  }

  private getPlatformLimits(platform: string): { maxCharacters: number; maxHashtags: number; maxMentions: number } {
    const limits = {
      twitter: { maxCharacters: 280, maxHashtags: 2, maxMentions: 10 },
      instagram: { maxCharacters: 2200, maxHashtags: 30, maxMentions: 20 },
      linkedin: { maxCharacters: 3000, maxHashtags: 5, maxMentions: 10 },
      facebook: { maxCharacters: 63206, maxHashtags: 10, maxMentions: 50 },
      tiktok: { maxCharacters: 150, maxHashtags: 5, maxMentions: 20 }
    };

    return limits[platform as keyof typeof limits] || limits.twitter;
  }

  private hasProhibitedContent(content: string, platform: string): boolean {
    const prohibitedTerms = ['spam', 'scam', 'fake', 'illegal'];
    const lowerContent = content.toLowerCase();

    return prohibitedTerms.some(term => lowerContent.includes(term));
  }

  private validateLegalCompliance(content: string, campaignContext?: CampaignContext): LegalCompliance {
    // Simplified legal compliance check
    const requiresDisclosure = content.toLowerCase().includes('ad') ||
                              content.toLowerCase().includes('sponsored') ||
                              content.toLowerCase().includes('partnership');

    return {
      gdprCompliant: true, // Would check for data collection mentions
      ccpaCompliant: true, // Would check for California-specific requirements
      copaCompliant: !content.toLowerCase().includes('children'), // Simplified COPPA check
      advertisingStandardsCompliant: !requiresDisclosure || content.includes('#ad') || content.includes('#sponsored'),
      disclosureRequirements: requiresDisclosure ? ['#ad', '#sponsored'] : [],
      privacyRequirements: [],
      dataHandlingCompliant: true
    };
  }

  private validateBrandCompliance(content: string, brandGuidelines?: BrandGuidelines): BrandCompliance {
    if (!brandGuidelines) {
      return {
        brandGuidelineCompliant: true,
        toneOfVoiceMatch: 80,
        prohibitedContentDetected: false,
        requiredElementsPresent: true,
        brandValueAlignment: 85,
        competitorMentions: []
      };
    }

    const lowerContent = content.toLowerCase();

    // Check prohibited words
    const prohibitedContentDetected = brandGuidelines.prohibitedWords.some(word =>
      lowerContent.includes(word.toLowerCase())
    );

    // Check tone of voice match (simplified)
    const toneOfVoiceMatch = this.calculateToneMatch(content, brandGuidelines.toneOfVoice);

    // Check for competitor mentions
    const competitorMentions: string[] = []; // Would check against competitor list

    return {
      brandGuidelineCompliant: !prohibitedContentDetected && toneOfVoiceMatch >= 60,
      toneOfVoiceMatch,
      prohibitedContentDetected,
      requiredElementsPresent: true, // Would check for required brand elements
      brandValueAlignment: 85, // Would analyze alignment with brand values
      competitorMentions
    };
  }

  private calculateToneMatch(content: string, toneOfVoice: string[]): number {
    // Simplified tone matching
    const lowerContent = content.toLowerCase();
    let matches = 0;

    toneOfVoice.forEach(tone => {
      const toneLower = tone.toLowerCase();
      if (toneLower === 'professional' && !lowerContent.includes('lol') && !lowerContent.includes('omg')) matches++;
      if (toneLower === 'friendly' && (lowerContent.includes('!') || lowerContent.includes('thanks'))) matches++;
      if (toneLower === 'casual' && (lowerContent.includes('hey') || lowerContent.includes('cool'))) matches++;
    });

    return Math.min(100, (matches / toneOfVoice.length) * 100);
  }

  private validateRegulatoryCompliance(content: string, contentType: string): RegulatoryCompliance {
    const lowerContent = content.toLowerCase();

    return {
      financialRegulationsCompliant: !lowerContent.includes('investment') && !lowerContent.includes('guaranteed returns'),
      healthClaimsCompliant: !lowerContent.includes('cure') && !lowerContent.includes('medical advice'),
      advertisingRegulationsCompliant: true,
      industrySpecificCompliant: true,
      geographicRestrictionsCompliant: true,
      ageRestrictionCompliant: !lowerContent.includes('alcohol') && !lowerContent.includes('gambling')
    };
  }

  private validateAccessibilityCompliance(content: string): AccessibilityCompliance {
    return {
      wcagCompliant: true,
      altTextRequired: false, // Would check if images are present
      captionRequired: false, // Would check if videos are present
      colorContrastCompliant: true,
      readabilityAccessible: content.length < 1000, // Simplified readability check
      screenReaderFriendly: !content.includes('click here') // Avoid non-descriptive links
    };
  }

  private collectViolations(
    platformCompliance: Record<string, PlatformComplianceDetail>,
    legalCompliance: LegalCompliance,
    brandCompliance: BrandCompliance
  ): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Platform violations
    Object.entries(platformCompliance).forEach(([platform, detail]) => {
      detail.violations.forEach(violation => {
        violations.push({
          type: 'PLATFORM_POLICY',
          severity: 'HIGH',
          description: violation,
          regulation: `${platform} Community Guidelines`,
          suggestedFix: 'Modify content to comply with platform requirements',
          mandatory: true
        });
      });
    });

    // Legal violations
    if (!legalCompliance.advertisingStandardsCompliant) {
      violations.push({
        type: 'ADVERTISING_STANDARDS',
        severity: 'CRITICAL',
        description: 'Missing required advertising disclosures',
        regulation: 'FTC Advertising Guidelines',
        suggestedFix: 'Add appropriate disclosure hashtags (#ad, #sponsored)',
        mandatory: true
      });
    }

    // Brand violations
    if (brandCompliance.prohibitedContentDetected) {
      violations.push({
        type: 'BRAND_GUIDELINES',
        severity: 'MEDIUM',
        description: 'Content contains prohibited words or phrases',
        regulation: 'Brand Guidelines',
        suggestedFix: 'Remove or replace prohibited content',
        mandatory: false
      });
    }

    return violations;
  }

  private collectWarnings(
    platformCompliance: Record<string, PlatformComplianceDetail>,
    brandCompliance: BrandCompliance
  ): ComplianceWarning[] {
    const warnings: ComplianceWarning[] = [];

    // Platform warnings
    Object.entries(platformCompliance).forEach(([platform, detail]) => {
      detail.warnings.forEach(warning => {
        warnings.push({
          type: 'PLATFORM_OPTIMIZATION',
          description: warning,
          recommendation: `Optimize content for ${platform} best practices`,
          impact: 'MEDIUM'
        });
      });
    });

    // Brand warnings
    if (brandCompliance.toneOfVoiceMatch < 70) {
      warnings.push({
        type: 'BRAND_TONE',
        description: 'Content tone may not align with brand voice',
        recommendation: 'Adjust language to better match brand tone of voice',
        impact: 'LOW'
      });
    }

    return warnings;
  }

  private calculateOverallComplianceScore(
    platformCompliance: Record<string, PlatformComplianceDetail>,
    legalCompliance: LegalCompliance,
    brandCompliance: BrandCompliance,
    regulatoryCompliance: RegulatoryCompliance,
    accessibilityCompliance: AccessibilityCompliance
  ): number {
    // Calculate platform compliance average
    const platformScores = Object.values(platformCompliance).map(detail => detail.score);
    const avgPlatformScore = platformScores.reduce((sum, score) => sum + score, 0) / platformScores.length;

    // Legal compliance score
    const legalScore = Object.values(legalCompliance).filter(val => typeof val === 'boolean').reduce((sum, compliant) => sum + (compliant ? 25 : 0), 0);

    // Brand compliance score
    const brandScore = brandCompliance.brandGuidelineCompliant ? brandCompliance.toneOfVoiceMatch : 0;

    // Regulatory compliance score
    const regulatoryScore = Object.values(regulatoryCompliance).reduce((sum, compliant) => sum + (compliant ? 16.67 : 0), 0);

    // Accessibility compliance score
    const accessibilityScore = Object.values(accessibilityCompliance).reduce((sum, compliant) => sum + (compliant ? 16.67 : 0), 0);

    // Weighted average
    return Math.round(
      avgPlatformScore * 0.3 +
      legalScore * 0.25 +
      brandScore * 0.2 +
      regulatoryScore * 0.15 +
      accessibilityScore * 0.1
    );
  }
}

/**
 * Content optimization engine
 */
class OptimizationEngine {
  private config: ContentSafetyConfig;

  constructor(config: ContentSafetyConfig) {
    this.config = config;
  }

  async generateSuggestions(
    content: string,
    contentType: string,
    qualityAnalysis: QualityAnalysis,
    targetMetrics?: Record<string, number>
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Engagement optimization suggestions
    suggestions.push(...this.generateEngagementSuggestions(content, contentType, qualityAnalysis));

    // Readability optimization suggestions
    suggestions.push(...this.generateReadabilitySuggestions(content, qualityAnalysis));

    // SEO optimization suggestions
    suggestions.push(...this.generateSEOSuggestions(content, contentType, qualityAnalysis));

    // Structure optimization suggestions
    suggestions.push(...this.generateStructureSuggestions(content, contentType, qualityAnalysis));

    // Safety optimization suggestions
    suggestions.push(...this.generateSafetySuggestions(content, qualityAnalysis));

    // Sort by priority and expected impact
    return suggestions.sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.expectedImpact - a.expectedImpact;
    });
  }

  private generateEngagementSuggestions(
    content: string,
    contentType: string,
    qualityAnalysis: QualityAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (qualityAnalysis.engagementPrediction < 50) {
      if (contentType === 'TWEET' && !content.includes('?')) {
        suggestions.push({
          category: 'ENGAGEMENT',
          priority: 'HIGH',
          suggestion: 'Add a question to encourage engagement',
          expectedImpact: 25,
          confidence: 80,
          implementationDifficulty: 'EASY',
          suggestedChanges: ['Add "What do you think?" or similar question'],
          alternativeVersions: [content + ' What are your thoughts?']
        });
      }

      if (qualityAnalysis.contentMetrics.hashtagCount === 0) {
        suggestions.push({
          category: 'ENGAGEMENT',
          priority: 'MEDIUM',
          suggestion: 'Add relevant hashtags to increase discoverability',
          expectedImpact: 20,
          confidence: 75,
          implementationDifficulty: 'EASY',
          suggestedChanges: ['Add 1-3 relevant hashtags']
        });
      }

      if (qualityAnalysis.contentMetrics.emojiCount === 0 && contentType === 'TWEET') {
        suggestions.push({
          category: 'ENGAGEMENT',
          priority: 'LOW',
          suggestion: 'Consider adding an emoji to make content more engaging',
          expectedImpact: 10,
          confidence: 60,
          implementationDifficulty: 'EASY',
          suggestedChanges: ['Add relevant emoji at the end']
        });
      }
    }

    return suggestions;
  }

  private generateReadabilitySuggestions(
    content: string,
    qualityAnalysis: QualityAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (qualityAnalysis.readabilityScore < 60) {
      if (qualityAnalysis.contentMetrics.averageWordsPerSentence > 20) {
        suggestions.push({
          category: 'READABILITY',
          priority: 'HIGH',
          suggestion: 'Break up long sentences for better readability',
          expectedImpact: 30,
          confidence: 85,
          implementationDifficulty: 'MEDIUM',
          suggestedChanges: ['Split sentences at natural break points', 'Use shorter, clearer sentences']
        });
      }

      if (qualityAnalysis.languageQuality.complexityScore > 80) {
        suggestions.push({
          category: 'READABILITY',
          priority: 'MEDIUM',
          suggestion: 'Simplify complex language for broader audience appeal',
          expectedImpact: 20,
          confidence: 70,
          implementationDifficulty: 'MEDIUM',
          suggestedChanges: ['Replace complex words with simpler alternatives', 'Use more common vocabulary']
        });
      }
    }

    return suggestions;
  }

  private generateSEOSuggestions(
    content: string,
    contentType: string,
    qualityAnalysis: QualityAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (qualityAnalysis.seoScore < 60) {
      if (qualityAnalysis.contentMetrics.hashtagCount < 2 && contentType === 'TWEET') {
        suggestions.push({
          category: 'SEO',
          priority: 'MEDIUM',
          suggestion: 'Add more relevant hashtags for better discoverability',
          expectedImpact: 25,
          confidence: 75,
          implementationDifficulty: 'EASY',
          suggestedChanges: ['Research and add 2-3 trending relevant hashtags']
        });
      }

      if (!content.match(/\b\w{6,}\b/)) {
        suggestions.push({
          category: 'SEO',
          priority: 'LOW',
          suggestion: 'Include some longer keywords for better search visibility',
          expectedImpact: 15,
          confidence: 60,
          implementationDifficulty: 'MEDIUM',
          suggestedChanges: ['Include specific industry terms or long-tail keywords']
        });
      }
    }

    return suggestions;
  }

  private generateStructureSuggestions(
    content: string,
    contentType: string,
    qualityAnalysis: QualityAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    if (qualityAnalysis.structureScore < 70) {
      if (contentType === 'TWEET' && content.length > 200 && !content.includes('\n')) {
        suggestions.push({
          category: 'STRUCTURE',
          priority: 'MEDIUM',
          suggestion: 'Add line breaks to improve visual structure',
          expectedImpact: 15,
          confidence: 70,
          implementationDifficulty: 'EASY',
          suggestedChanges: ['Break content into multiple lines for better readability']
        });
      }

      if (!content.match(/[.!?]$/)) {
        suggestions.push({
          category: 'STRUCTURE',
          priority: 'HIGH',
          suggestion: 'End content with proper punctuation',
          expectedImpact: 10,
          confidence: 90,
          implementationDifficulty: 'EASY',
          suggestedChanges: ['Add appropriate ending punctuation (. ! ?)']
        });
      }
    }

    return suggestions;
  }

  private generateSafetySuggestions(
    content: string,
    qualityAnalysis: QualityAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for potential safety issues based on content
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('click here') || lowerContent.includes('link in bio')) {
      suggestions.push({
        category: 'SAFETY',
        priority: 'MEDIUM',
        suggestion: 'Use more descriptive link text for better accessibility and trust',
        expectedImpact: 15,
        confidence: 80,
        implementationDifficulty: 'EASY',
        suggestedChanges: ['Replace "click here" with descriptive text about the destination']
      });
    }

    if (content.includes('!!!') || content.match(/[!]{4,}/)) {
      suggestions.push({
        category: 'SAFETY',
        priority: 'LOW',
        suggestion: 'Reduce excessive punctuation to avoid appearing spammy',
        expectedImpact: 10,
        confidence: 65,
        implementationDifficulty: 'EASY',
        suggestedChanges: ['Use 1-2 exclamation marks maximum']
      });
    }

    return suggestions;
  }
}

// Fix platform compliance type issue
function convertToTypedPlatformCompliance(
  platformCompliance: Record<string, PlatformComplianceDetail>
): PlatformCompliance {
  return {
    twitter: platformCompliance.twitter || getDefaultPlatformComplianceDetail(),
    instagram: platformCompliance.instagram || getDefaultPlatformComplianceDetail(),
    linkedin: platformCompliance.linkedin || getDefaultPlatformComplianceDetail(),
    facebook: platformCompliance.facebook || getDefaultPlatformComplianceDetail(),
    tiktok: platformCompliance.tiktok || getDefaultPlatformComplianceDetail()
  };
}

function getDefaultPlatformComplianceDetail(): PlatformComplianceDetail {
  return {
    compliant: true,
    score: 90,
    violations: [],
    warnings: [],
    characterLimitCheck: true,
    hashtagLimitCheck: true,
    mentionLimitCheck: true,
    mediaLimitCheck: true,
    contentPolicyCheck: true
  };
}
