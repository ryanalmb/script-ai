import { logger } from '../utils/logger';

export interface QualityMetrics {
  overall: number;
  readability: number;
  engagement: number;
  originality: number;
  relevance: number;
  sentiment: number;
}

export interface QualityCheck {
  id: string;
  content: string;
  metrics: QualityMetrics;
  passed: boolean;
  issues: QualityIssue[];
  suggestions: string[];
  timestamp: Date;
}

export interface QualityIssue {
  type: 'grammar' | 'spelling' | 'readability' | 'length' | 'hashtags' | 'mentions' | 'sentiment';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
}

export interface QualityConfig {
  minOverallScore: number;
  minReadabilityScore: number;
  minEngagementScore: number;
  minOriginalityScore: number;
  minRelevanceScore: number;
  maxHashtags: number;
  maxMentions: number;
  minLength: number;
  maxLength: number;
  allowedSentiments: string[];
  blockedWords: string[];
  requiredWords: string[];
}

export class QualityControlService {
  private config: QualityConfig = {
    minOverallScore: 0.8,
    minReadabilityScore: 0.7,
    minEngagementScore: 0.6,
    minOriginalityScore: 0.8,
    minRelevanceScore: 0.7,
    maxHashtags: 5,
    maxMentions: 3,
    minLength: 50,
    maxLength: 280,
    allowedSentiments: ['positive', 'neutral'],
    blockedWords: ['scam', 'spam', 'fake', 'guaranteed', 'get rich quick'],
    requiredWords: []
  };

  private qualityHistory: Map<string, QualityCheck[]> = new Map();

  async checkQuality(content: string, userId?: number): Promise<QualityCheck> {
    try {
      const checkId = `quality-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const metrics = await this.calculateMetrics(content);
      const issues = this.identifyIssues(content, metrics);
      const suggestions = this.generateSuggestions(content, metrics, issues);
      const passed = this.determinePass(metrics, issues);

      const qualityCheck: QualityCheck = {
        id: checkId,
        content,
        metrics,
        passed,
        issues,
        suggestions,
        timestamp: new Date()
      };

      // Store in history
      if (userId) {
        const userHistory = this.qualityHistory.get(userId.toString()) || [];
        userHistory.push(qualityCheck);
        
        // Keep only last 100 checks per user
        if (userHistory.length > 100) {
          userHistory.shift();
        }
        
        this.qualityHistory.set(userId.toString(), userHistory);
      }

      logger.info('Quality check completed', {
        checkId,
        passed,
        overallScore: metrics.overall,
        issueCount: issues.length
      });

      return qualityCheck;
    } catch (error) {
      logger.error('Error in quality check:', error);
      throw new Error('Quality check failed');
    }
  }

  async batchCheckQuality(contents: string[], userId?: number): Promise<QualityCheck[]> {
    try {
      const checks = await Promise.all(
        contents.map(content => this.checkQuality(content, userId))
      );

      logger.info('Batch quality check completed', {
        totalChecks: checks.length,
        passedChecks: checks.filter(c => c.passed).length
      });

      return checks;
    } catch (error) {
      logger.error('Error in batch quality check:', error);
      throw new Error('Batch quality check failed');
    }
  }

  updateConfig(newConfig: Partial<QualityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Quality control config updated', this.config);
  }

  getConfig(): QualityConfig {
    return { ...this.config };
  }

  getQualityHistory(userId: number, limit: number = 10): QualityCheck[] {
    const history = this.qualityHistory.get(userId.toString()) || [];
    return history.slice(-limit).reverse();
  }

  getQualityStats(userId?: number): {
    totalChecks: number;
    passedChecks: number;
    averageScore: number;
    commonIssues: { type: string; count: number }[];
  } {
    let allChecks: QualityCheck[] = [];

    if (userId) {
      allChecks = this.qualityHistory.get(userId.toString()) || [];
    } else {
      for (const userChecks of this.qualityHistory.values()) {
        allChecks.push(...userChecks);
      }
    }

    const totalChecks = allChecks.length;
    const passedChecks = allChecks.filter(c => c.passed).length;
    const averageScore = totalChecks > 0 
      ? allChecks.reduce((sum, c) => sum + c.metrics.overall, 0) / totalChecks 
      : 0;

    // Count common issues
    const issueCount = new Map<string, number>();
    allChecks.forEach(check => {
      check.issues.forEach(issue => {
        issueCount.set(issue.type, (issueCount.get(issue.type) || 0) + 1);
      });
    });

    const commonIssues = Array.from(issueCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalChecks,
      passedChecks,
      averageScore: Math.round(averageScore * 100) / 100,
      commonIssues
    };
  }

  private async calculateMetrics(content: string): Promise<QualityMetrics> {
    const readability = this.calculateReadability(content);
    const engagement = this.calculateEngagement(content);
    const originality = this.calculateOriginality(content);
    const relevance = this.calculateRelevance(content);
    const sentiment = this.calculateSentiment(content);

    const overall = (readability + engagement + originality + relevance + sentiment) / 5;

    return {
      overall: Math.round(overall * 100) / 100,
      readability: Math.round(readability * 100) / 100,
      engagement: Math.round(engagement * 100) / 100,
      originality: Math.round(originality * 100) / 100,
      relevance: Math.round(relevance * 100) / 100,
      sentiment: Math.round(sentiment * 100) / 100
    };
  }

  private calculateReadability(content: string): number {
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).length;
    const characters = content.length;

    // Simple readability score based on length and complexity
    let score = 0.8;

    // Penalize very short or very long content
    if (words < 10) score -= 0.2;
    if (words > 50) score -= 0.1;

    // Penalize very long sentences
    const avgWordsPerSentence = words / sentences;
    if (avgWordsPerSentence > 20) score -= 0.1;

    // Bonus for proper punctuation
    if (content.includes('.') || content.includes('!') || content.includes('?')) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateEngagement(content: string): number {
    let score = 0.6;

    // Bonus for questions
    if (content.includes('?')) score += 0.1;

    // Bonus for emojis (but not too many)
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount > 0 && emojiCount <= 3) score += 0.1;
    if (emojiCount > 5) score -= 0.1;

    // Bonus for hashtags (but not too many)
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    if (hashtagCount > 0 && hashtagCount <= 3) score += 0.1;
    if (hashtagCount > 5) score -= 0.2;

    // Bonus for mentions (but not too many)
    const mentionCount = (content.match(/@\w+/g) || []).length;
    if (mentionCount > 0 && mentionCount <= 2) score += 0.05;
    if (mentionCount > 3) score -= 0.1;

    // Bonus for call-to-action words
    const ctaWords = ['what', 'how', 'why', 'thoughts', 'opinion', 'agree', 'think'];
    const hasCtaWords = ctaWords.some(word => content.toLowerCase().includes(word));
    if (hasCtaWords) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private calculateOriginality(content: string): number {
    // Simple originality check - in real implementation, this would check against a database
    // For now, penalize very common phrases
    const commonPhrases = [
      'to the moon',
      'diamond hands',
      'not financial advice',
      'dyor',
      'this is the way'
    ];

    let score = 0.9;
    const lowerContent = content.toLowerCase();

    commonPhrases.forEach(phrase => {
      if (lowerContent.includes(phrase)) {
        score -= 0.1;
      }
    });

    return Math.max(0.5, Math.min(1, score));
  }

  private calculateRelevance(content: string): number {
    // Check for relevant keywords based on context
    const cryptoKeywords = [
      'bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'nft',
      'trading', 'market', 'price', 'analysis', 'investment'
    ];

    const lowerContent = content.toLowerCase();
    const relevantKeywords = cryptoKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    );

    // Base score
    let score = 0.7;

    // Bonus for relevant keywords
    score += Math.min(0.3, relevantKeywords.length * 0.1);

    return Math.max(0, Math.min(1, score));
  }

  private calculateSentiment(content: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'bullish', 'positive', 'growth'];
    const negativeWords = ['bad', 'terrible', 'awful', 'bearish', 'negative', 'crash', 'dump'];

    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;

    // Neutral sentiment gets high score
    if (positiveCount === 0 && negativeCount === 0) return 0.8;

    // Positive sentiment
    if (positiveCount > negativeCount) return 0.9;

    // Negative sentiment (lower score but not necessarily bad)
    if (negativeCount > positiveCount) return 0.6;

    // Mixed sentiment
    return 0.7;
  }

  private identifyIssues(content: string, metrics: QualityMetrics): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check overall score
    if (metrics.overall < this.config.minOverallScore) {
      issues.push({
        type: 'readability',
        severity: 'high',
        message: 'Overall quality score is below threshold',
        suggestion: 'Review and improve content quality'
      });
    }

    // Check length
    if (content.length < this.config.minLength) {
      issues.push({
        type: 'length',
        severity: 'medium',
        message: 'Content is too short',
        suggestion: 'Add more detail or context'
      });
    }

    if (content.length > this.config.maxLength) {
      issues.push({
        type: 'length',
        severity: 'high',
        message: 'Content exceeds maximum length',
        suggestion: 'Shorten the content'
      });
    }

    // Check hashtags
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    if (hashtagCount > this.config.maxHashtags) {
      issues.push({
        type: 'hashtags',
        severity: 'medium',
        message: 'Too many hashtags',
        suggestion: `Reduce to ${this.config.maxHashtags} or fewer hashtags`
      });
    }

    // Check mentions
    const mentionCount = (content.match(/@\w+/g) || []).length;
    if (mentionCount > this.config.maxMentions) {
      issues.push({
        type: 'mentions',
        severity: 'medium',
        message: 'Too many mentions',
        suggestion: `Reduce to ${this.config.maxMentions} or fewer mentions`
      });
    }

    // Check blocked words
    const lowerContent = content.toLowerCase();
    this.config.blockedWords.forEach(word => {
      if (lowerContent.includes(word)) {
        issues.push({
          type: 'spelling',
          severity: 'high',
          message: `Contains blocked word: ${word}`,
          suggestion: 'Remove or replace the blocked word'
        });
      }
    });

    return issues;
  }

  private generateSuggestions(content: string, metrics: QualityMetrics, issues: QualityIssue[]): string[] {
    const suggestions: string[] = [];

    if (metrics.readability < 0.7) {
      suggestions.push('Simplify sentence structure for better readability');
    }

    if (metrics.engagement < 0.6) {
      suggestions.push('Add a question or call-to-action to increase engagement');
    }

    if (metrics.originality < 0.8) {
      suggestions.push('Make the content more unique and original');
    }

    if (!content.includes('?') && !content.includes('!')) {
      suggestions.push('Consider adding punctuation for better impact');
    }

    if (!(content.match(/#\w+/g) || []).length) {
      suggestions.push('Add relevant hashtags to increase discoverability');
    }

    if (issues.length === 0 && metrics.overall > 0.9) {
      suggestions.push('Excellent content quality! Consider this as a template for future posts');
    }

    return suggestions;
  }

  private determinePass(metrics: QualityMetrics, issues: QualityIssue[]): boolean {
    // Fail if there are high severity issues
    const highSeverityIssues = issues.filter(issue => issue.severity === 'high');
    if (highSeverityIssues.length > 0) {
      return false;
    }

    // Fail if overall score is below threshold
    if (metrics.overall < this.config.minOverallScore) {
      return false;
    }

    // Fail if readability is below threshold
    if (metrics.readability < this.config.minReadabilityScore) {
      return false;
    }

    return true;
  }
}
