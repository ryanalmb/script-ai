/**
 * Content Safety Filter Integration Examples
 * 
 * Demonstrates how the Advanced Content Quality and Safety Filters (Task 20)
 * integrate seamlessly with the Campaign Orchestrator (Task 19) and existing
 * content management infrastructure.
 */

import { ContentSafetyFilter, ContentAnalysisRequest, BrandGuidelines, CampaignContext } from '../services/contentSafetyFilter';
import { CampaignOrchestrator, CampaignContent, CampaignAccount, CampaignSchedule } from '../services/campaignOrchestrator';
import { logger } from '../utils/logger';

// ============================================================================
// INTEGRATION EXAMPLE 1: CAMPAIGN CONTENT VALIDATION
// ============================================================================

/**
 * Example: Validate all content before campaign orchestration
 */
export async function validateCampaignContentExample() {
  // Initialize Content Safety Filter
  const contentSafetyFilter = new ContentSafetyFilter({
    features: {
      enableAIModeration: true,
      enableQualityScoring: true,
      enableComplianceChecking: true,
      enableOptimizationSuggestions: true,
      enableRealTimeAnalysis: true,
      enableBatchProcessing: true
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
    }
  });

  // Sample campaign content
  const campaignContent = [
    {
      id: 'content-1',
      type: 'TWEET',
      content: 'Excited to announce our new product launch! 🚀 What features would you like to see next? #innovation #tech',
      mediaUrls: ['https://example.com/image1.jpg']
    },
    {
      id: 'content-2',
      type: 'TWEET',
      content: 'Join our webinar tomorrow at 2 PM EST to learn about industry trends and best practices.',
      mediaUrls: []
    },
    {
      id: 'content-3',
      type: 'TWEET',
      content: 'Check out this amazing article about the future of technology! Link in bio.',
      mediaUrls: []
    }
  ];

  // Brand guidelines
  const brandGuidelines: BrandGuidelines = {
    brandName: 'TechCorp',
    toneOfVoice: ['professional', 'friendly', 'innovative'],
    prohibitedWords: ['competitor', 'cheap', 'spam'],
    requiredDisclosures: ['#ad', '#sponsored'],
    brandValues: ['innovation', 'quality', 'customer-first'],
    targetAudience: 'tech professionals',
    contentThemes: ['technology', 'innovation', 'industry insights']
  };

  // Campaign context
  const campaignContext: CampaignContext = {
    campaignId: 'campaign-123',
    campaignType: 'product_launch',
    objectives: ['brand_awareness', 'engagement', 'lead_generation'],
    targetMetrics: {
      engagement_rate: 5.0,
      reach: 10000,
      clicks: 500
    },
    timeline: {
      start: new Date('2024-01-15T09:00:00Z'),
      end: new Date('2024-01-20T18:00:00Z')
    },
    geography: ['US', 'CA', 'UK']
  };

  try {
    // Validate campaign content
    const validationResult = await contentSafetyFilter.validateCampaignContent(
      campaignContent,
      campaignContext,
      brandGuidelines
    );

    logger.info('Campaign content validation completed', {
      operation: 'campaign_content_validation_example',
      metadata: {
        totalContent: campaignContent.length,
        validContent: validationResult.validContent.length,
        invalidContent: validationResult.invalidContent.length,
        overallScore: validationResult.overallScore,
        recommendationCount: validationResult.recommendations.length
      }
    });

    // Process validation results
    if (validationResult.invalidContent.length > 0) {
      console.log('❌ Invalid Content Found:');
      validationResult.invalidContent.forEach(item => {
        console.log(`  - ${item.id}: ${item.reason}`);
      });
    }

    if (validationResult.recommendations.length > 0) {
      console.log('💡 Optimization Recommendations:');
      validationResult.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }

    console.log(`✅ Valid Content: ${validationResult.validContent.length}/${campaignContent.length}`);
    console.log(`📊 Overall Score: ${validationResult.overallScore}/100`);

    return validationResult;

  } catch (error) {
    logger.error('Campaign content validation failed', {
      operation: 'campaign_content_validation_example_error',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// ============================================================================
// INTEGRATION EXAMPLE 2: ENHANCED CAMPAIGN ORCHESTRATOR
// ============================================================================

/**
 * Enhanced Campaign Orchestrator with Content Safety Integration
 */
export class EnhancedCampaignOrchestrator extends CampaignOrchestrator {
  private contentSafetyFilter: ContentSafetyFilter;

  constructor(options?: any) {
    super(options);
    
    // Initialize Content Safety Filter with campaign-optimized settings
    this.contentSafetyFilter = new ContentSafetyFilter({
      features: {
        enableAIModeration: true,
        enableQualityScoring: true,
        enableComplianceChecking: true,
        enableOptimizationSuggestions: true,
        enableRealTimeAnalysis: true,
        enableBatchProcessing: true
      },
      processing: {
        enableParallelAnalysis: true,
        maxConcurrentRequests: 20, // Higher for campaign processing
        timeoutMs: 15000, // Faster timeout for real-time validation
        retryAttempts: 2,
        enableCaching: true,
        cacheTtlSeconds: 1800 // 30 minutes for campaign content
      }
    });
  }

  /**
   * Enhanced campaign orchestration with content safety validation
   */
  async createEnhancedCampaignOrchestration(
    campaignId: string,
    accounts: CampaignAccount[],
    content: CampaignContent[],
    schedule: CampaignSchedule,
    options: {
      name: string;
      description?: string;
      priority?: any;
      antiDetectionConfig?: any;
      createdBy: string;
      brandGuidelines?: BrandGuidelines;
      enableContentOptimization?: boolean;
    }
  ) {
    try {
      logger.info('Starting enhanced campaign orchestration with content safety validation', {
        operation: 'enhanced_campaign_orchestration',
        metadata: {
          campaignId,
          contentCount: content.length,
          accountCount: accounts.length,
          enableContentOptimization: options.enableContentOptimization || false
        }
      });

      // Step 1: Validate and optimize content before orchestration
      const campaignContext: CampaignContext = {
        campaignId,
        campaignType: 'social_media_campaign',
        objectives: ['engagement', 'reach'],
        targetMetrics: {},
        timeline: {
          start: schedule.startTime,
          end: schedule.endTime || new Date(schedule.startTime.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      };

      // Convert CampaignContent to validation format
      const contentForValidation = content.map(item => ({
        id: item.id,
        type: item.type,
        content: item.content,
        mediaUrls: item.mediaUrls || [],
        metadata: item.metadata || {}
      }));

      // Validate all content
      const validationResult = await this.contentSafetyFilter.validateCampaignContent(
        contentForValidation,
        campaignContext,
        options.brandGuidelines
      );

      // Filter out invalid content
      const validContentIds = new Set(validationResult.validContent.map(item => item.id));
      const validatedContent = content.filter(item => validContentIds.has(item.id));

      if (validatedContent.length === 0) {
        throw new Error('No valid content remaining after safety validation');
      }

      // Apply optimization suggestions if enabled
      if (options.enableContentOptimization) {
        await this.applyContentOptimizations(validatedContent, validationResult);
      }

      logger.info('Content safety validation completed', {
        operation: 'content_safety_validation_completed',
        metadata: {
          originalCount: content.length,
          validCount: validatedContent.length,
          invalidCount: validationResult.invalidContent.length,
          overallScore: validationResult.overallScore
        }
      });

      // Step 2: Proceed with standard campaign orchestration using validated content
      return await this.createCampaignOrchestration(
        campaignId,
        accounts,
        validatedContent,
        schedule,
        options
      );

    } catch (error) {
      logger.error('Enhanced campaign orchestration failed', {
        operation: 'enhanced_campaign_orchestration_error',
        error: error instanceof Error ? error.message : String(error),
        metadata: { campaignId }
      });
      throw error;
    }
  }

  /**
   * Real-time content validation during execution
   */
  async executeContentActionWithSafetyCheck(
    content: CampaignContent,
    context: any
  ): Promise<void> {
    try {
      // Perform real-time safety check before execution
      const safetyCheck = await this.contentSafetyFilter.validateContentForExecution(
        content.content,
        content.type,
        content.targetAccounts?.[0] || 'unknown',
        {
          campaignId: context.orchestrationPlan.campaignId,
          campaignType: 'social_media_campaign',
          objectives: ['engagement'],
          targetMetrics: {},
          timeline: {
            start: new Date(),
            end: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        }
      );

      if (!safetyCheck.approved) {
        logger.warn('Content execution blocked by safety check', {
          operation: 'content_execution_blocked',
          metadata: {
            contentId: content.id,
            score: safetyCheck.score,
            flags: safetyCheck.flags,
            suggestions: safetyCheck.suggestions
          }
        });

        // Skip execution or apply suggestions
        if (safetyCheck.suggestions.length > 0) {
          logger.info('Content safety suggestions available', {
            operation: 'content_safety_suggestions',
            metadata: {
              contentId: content.id,
              suggestions: safetyCheck.suggestions
            }
          });
        }
        return;
      }

      // Proceed with standard content execution
      await (this as any).executeContentAction(content, context);

    } catch (error) {
      logger.error('Content execution with safety check failed', {
        operation: 'content_execution_safety_check_error',
        error: error instanceof Error ? error.message : String(error),
        metadata: { contentId: content.id }
      });
      throw error;
    }
  }

  /**
   * Apply content optimizations based on suggestions
   */
  private async applyContentOptimizations(
    content: CampaignContent[],
    validationResult: any
  ): Promise<void> {
    for (const validContent of validationResult.validContent) {
      const contentItem = content.find(item => item.id === validContent.id);
      if (!contentItem) continue;

      const suggestions = validContent.analysisResult.optimizationSuggestions;
      const highPrioritySuggestions = suggestions.filter((s: any) =>
        s.priority === 'HIGH' || s.priority === 'CRITICAL'
      );

      if (highPrioritySuggestions.length > 0) {
        logger.info('Applying content optimizations', {
          operation: 'apply_content_optimizations',
          metadata: {
            contentId: contentItem.id,
            suggestionCount: highPrioritySuggestions.length
          }
        });

        // Apply simple optimizations (in production, would use more sophisticated logic)
        for (const suggestion of highPrioritySuggestions) {
          if (suggestion.alternativeVersions && suggestion.alternativeVersions.length > 0) {
            contentItem.content = suggestion.alternativeVersions[0];
            break; // Apply first alternative
          }
        }
      }
    }
  }
}

// ============================================================================
// INTEGRATION EXAMPLE 3: REAL-TIME CONTENT FILTERING
// ============================================================================

/**
 * Example: Real-time content filtering for live content creation
 */
export async function realTimeContentFilteringExample() {
  const contentSafetyFilter = new ContentSafetyFilter();

  const testContent = [
    "Excited to share our latest innovation! What do you think? 🚀 #tech #innovation",
    "This is the best product ever!!! Click here now!!!",
    "Join our webinar to learn about industry best practices and trends.",
    "Check out this spam content with lots of promotional links!!!"
  ];

  console.log('🔍 Real-time Content Filtering Results:');
  console.log('=' .repeat(60));

  for (let i = 0; i < testContent.length; i++) {
    const content = testContent[i];
    
    try {
      // Quick safety check
      const safetyCheck = await contentSafetyFilter.quickSafetyCheck(content || '', 'TWEET');

      // Get optimization suggestions
      const suggestions = await contentSafetyFilter.getOptimizationSuggestions(content || '', 'TWEET');
      
      console.log(`\nContent ${i + 1}: "${content}"`);
      console.log(`Safety: ${safetyCheck.safe ? '✅ SAFE' : '❌ UNSAFE'} (Score: ${safetyCheck.score})`);
      console.log(`Processing Time: ${safetyCheck.processingTime}ms`);
      
      if (safetyCheck.flags.length > 0) {
        console.log(`Flags: ${safetyCheck.flags.join(', ')}`);
      }
      
      if (suggestions.length > 0) {
        console.log('Suggestions:');
        suggestions.slice(0, 2).forEach(suggestion => {
          console.log(`  - ${suggestion.suggestion} (Impact: ${suggestion.expectedImpact}%)`);
        });
      }
      
    } catch (error) {
      console.log(`❌ Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Run all integration examples
 */
export async function runAllExamples() {
  console.log('🚀 Content Safety Filter Integration Examples');
  console.log('=' .repeat(60));

  try {
    // Example 1: Campaign Content Validation
    console.log('\n📋 Example 1: Campaign Content Validation');
    await validateCampaignContentExample();

    // Example 2: Real-time Content Filtering
    console.log('\n⚡ Example 2: Real-time Content Filtering');
    await realTimeContentFilteringExample();

    console.log('\n✅ All examples completed successfully!');

  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}
