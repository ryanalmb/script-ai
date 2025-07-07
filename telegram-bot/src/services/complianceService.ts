import { logger } from '../utils/logger';

export interface ComplianceCheck {
  id: string;
  content: string;
  passed: boolean;
  score: number;
  violations: ComplianceViolation[];
  warnings: ComplianceWarning[];
  recommendations: string[];
  timestamp: Date;
}

export interface ComplianceViolation {
  type: 'spam' | 'harassment' | 'misinformation' | 'copyright' | 'financial_advice' | 'hate_speech' | 'privacy';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  regulation?: string;
  action: 'block' | 'flag' | 'review' | 'modify';
}

export interface ComplianceWarning {
  type: 'potential_spam' | 'unclear_disclosure' | 'promotional_content' | 'sensitive_topic';
  message: string;
  suggestion: string;
}

export interface ComplianceConfig {
  enableSpamDetection: boolean;
  enableFinancialAdviceDetection: boolean;
  enableCopyrightDetection: boolean;
  enableHateSpeechDetection: boolean;
  enablePrivacyProtection: boolean;
  maxPromotionalContent: number; // percentage
  requireDisclosures: boolean;
  blockedDomains: string[];
  sensitiveTopics: string[];
  allowedFinancialTerms: string[];
  requiredDisclosures: string[];
}

export class ComplianceService {
  private config: ComplianceConfig = {
    enableSpamDetection: true,
    enableFinancialAdviceDetection: true,
    enableCopyrightDetection: true,
    enableHateSpeechDetection: true,
    enablePrivacyProtection: true,
    maxPromotionalContent: 20,
    requireDisclosures: true,
    blockedDomains: ['scam-site.com', 'fake-crypto.net'],
    sensitiveTopics: ['financial advice', 'investment recommendations', 'guaranteed returns'],
    allowedFinancialTerms: ['analysis', 'opinion', 'research', 'educational', 'dyor'],
    requiredDisclosures: ['not financial advice', 'dyor', 'educational purposes only']
  };

  private complianceHistory: Map<string, ComplianceCheck[]> = new Map();
  private spamPatterns: RegExp[] = [
    /guaranteed\s+returns?/i,
    /get\s+rich\s+quick/i,
    /100%\s+profit/i,
    /risk\s*-?\s*free/i,
    /instant\s+money/i
  ];

  async checkCompliance(content: string, userId?: number): Promise<ComplianceCheck> {
    try {
      const checkId = `compliance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const violations = await this.detectViolations(content);
      const warnings = await this.detectWarnings(content);
      const recommendations = this.generateRecommendations(content, violations, warnings);
      const score = this.calculateComplianceScore(violations, warnings);
      const passed = this.determinePass(violations, score);

      const complianceCheck: ComplianceCheck = {
        id: checkId,
        content,
        passed,
        score,
        violations,
        warnings,
        recommendations,
        timestamp: new Date()
      };

      // Store in history
      if (userId) {
        const userHistory = this.complianceHistory.get(userId.toString()) || [];
        userHistory.push(complianceCheck);
        
        // Keep only last 100 checks per user
        if (userHistory.length > 100) {
          userHistory.shift();
        }
        
        this.complianceHistory.set(userId.toString(), userHistory);
      }

      logger.info('Compliance check completed', {
        checkId,
        passed,
        score,
        violationCount: violations.length,
        warningCount: warnings.length
      });

      return complianceCheck;
    } catch (error) {
      logger.error('Error in compliance check:', error);
      throw new Error('Compliance check failed');
    }
  }

  async batchCheckCompliance(contents: string[], userId?: number): Promise<ComplianceCheck[]> {
    try {
      const checks = await Promise.all(
        contents.map(content => this.checkCompliance(content, userId))
      );

      logger.info('Batch compliance check completed', {
        totalChecks: checks.length,
        passedChecks: checks.filter(c => c.passed).length,
        violationCount: checks.reduce((sum, c) => sum + c.violations.length, 0)
      });

      return checks;
    } catch (error) {
      logger.error('Error in batch compliance check:', error);
      throw new Error('Batch compliance check failed');
    }
  }

  updateConfig(newConfig: Partial<ComplianceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Compliance config updated', this.config);
  }

  getConfig(): ComplianceConfig {
    return { ...this.config };
  }

  getComplianceHistory(userId: number, limit: number = 10): ComplianceCheck[] {
    const history = this.complianceHistory.get(userId.toString()) || [];
    return history.slice(-limit).reverse();
  }

  getComplianceStats(userId?: number): {
    totalChecks: number;
    passedChecks: number;
    averageScore: number;
    violationsByType: { type: string; count: number }[];
    warningsByType: { type: string; count: number }[];
  } {
    let allChecks: ComplianceCheck[] = [];

    if (userId) {
      allChecks = this.complianceHistory.get(userId.toString()) || [];
    } else {
      for (const userChecks of this.complianceHistory.values()) {
        allChecks.push(...userChecks);
      }
    }

    const totalChecks = allChecks.length;
    const passedChecks = allChecks.filter(c => c.passed).length;
    const averageScore = totalChecks > 0 
      ? allChecks.reduce((sum, c) => sum + c.score, 0) / totalChecks 
      : 0;

    // Count violations by type
    const violationCount = new Map<string, number>();
    const warningCount = new Map<string, number>();

    allChecks.forEach(check => {
      check.violations.forEach(violation => {
        violationCount.set(violation.type, (violationCount.get(violation.type) || 0) + 1);
      });
      
      check.warnings.forEach(warning => {
        warningCount.set(warning.type, (warningCount.get(warning.type) || 0) + 1);
      });
    });

    const violationsByType = Array.from(violationCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const warningsByType = Array.from(warningCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalChecks,
      passedChecks,
      averageScore: Math.round(averageScore * 100) / 100,
      violationsByType,
      warningsByType
    };
  }

  private async detectViolations(content: string): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Spam detection
    if (this.config.enableSpamDetection) {
      const spamViolations = this.detectSpam(content);
      violations.push(...spamViolations);
    }

    // Financial advice detection
    if (this.config.enableFinancialAdviceDetection) {
      const financialViolations = this.detectFinancialAdvice(content);
      violations.push(...financialViolations);
    }

    // Copyright detection
    if (this.config.enableCopyrightDetection) {
      const copyrightViolations = this.detectCopyright(content);
      violations.push(...copyrightViolations);
    }

    // Hate speech detection
    if (this.config.enableHateSpeechDetection) {
      const hateSpeechViolations = this.detectHateSpeech(content);
      violations.push(...hateSpeechViolations);
    }

    // Privacy protection
    if (this.config.enablePrivacyProtection) {
      const privacyViolations = this.detectPrivacyIssues(content);
      violations.push(...privacyViolations);
    }

    return violations;
  }

  private async detectWarnings(content: string): Promise<ComplianceWarning[]> {
    const warnings: ComplianceWarning[] = [];

    // Check for potential spam patterns
    if (this.isPotentialSpam(content)) {
      warnings.push({
        type: 'potential_spam',
        message: 'Content may be flagged as spam',
        suggestion: 'Review promotional language and add value-focused content'
      });
    }

    // Check for promotional content
    if (this.isPromotionalContent(content)) {
      warnings.push({
        type: 'promotional_content',
        message: 'Content appears promotional',
        suggestion: 'Add educational value or clear disclosures'
      });
    }

    // Check for missing disclosures
    if (this.config.requireDisclosures && this.needsDisclosure(content)) {
      warnings.push({
        type: 'unclear_disclosure',
        message: 'Content may need disclosure statements',
        suggestion: 'Add appropriate disclaimers like "Not financial advice" or "DYOR"'
      });
    }

    // Check for sensitive topics
    if (this.containsSensitiveTopic(content)) {
      warnings.push({
        type: 'sensitive_topic',
        message: 'Content discusses sensitive financial topics',
        suggestion: 'Ensure proper disclaimers and educational framing'
      });
    }

    return warnings;
  }

  private detectSpam(content: string): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check against spam patterns
    this.spamPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        violations.push({
          type: 'spam',
          severity: 'high',
          message: 'Content matches spam pattern',
          action: 'block'
        });
      }
    });

    // Check for excessive capitalization
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.3) {
      violations.push({
        type: 'spam',
        severity: 'medium',
        message: 'Excessive use of capital letters',
        action: 'flag'
      });
    }

    // Check for excessive punctuation
    const punctuationRatio = (content.match(/[!?]{2,}/g) || []).length;
    if (punctuationRatio > 2) {
      violations.push({
        type: 'spam',
        severity: 'medium',
        message: 'Excessive punctuation usage',
        action: 'flag'
      });
    }

    return violations;
  }

  private detectFinancialAdvice(content: string): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Financial advice indicators
    const advicePatterns = [
      /you should (buy|sell|invest)/i,
      /guaranteed (profit|return)/i,
      /financial advice/i,
      /investment recommendation/i
    ];

    advicePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        // Check if proper disclaimers are present
        const hasDisclaimer = this.config.requiredDisclosures.some(disclaimer => 
          lowerContent.includes(disclaimer.toLowerCase())
        );

        if (!hasDisclaimer) {
          violations.push({
            type: 'financial_advice',
            severity: 'high',
            message: 'Content may constitute financial advice without proper disclaimers',
            regulation: 'Financial Services Regulation',
            action: 'modify'
          });
        }
      }
    });

    return violations;
  }

  private detectCopyright(content: string): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for blocked domains
    this.config.blockedDomains.forEach(domain => {
      if (content.includes(domain)) {
        violations.push({
          type: 'copyright',
          severity: 'high',
          message: `Content references blocked domain: ${domain}`,
          action: 'block'
        });
      }
    });

    return violations;
  }

  private detectHateSpeech(content: string): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    
    // Simple hate speech detection (in real implementation, use ML models)
    const hateSpeechPatterns = [
      /hate/i,
      /discriminat/i,
      /racist/i
    ];

    hateSpeechPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        violations.push({
          type: 'hate_speech',
          severity: 'critical',
          message: 'Content may contain hate speech',
          action: 'block'
        });
      }
    });

    return violations;
  }

  private detectPrivacyIssues(content: string): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for personal information patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;

    if (emailPattern.test(content)) {
      violations.push({
        type: 'privacy',
        severity: 'medium',
        message: 'Content contains email address',
        action: 'review'
      });
    }

    if (phonePattern.test(content)) {
      violations.push({
        type: 'privacy',
        severity: 'medium',
        message: 'Content contains phone number',
        action: 'review'
      });
    }

    return violations;
  }

  private isPotentialSpam(content: string): boolean {
    const spamIndicators = [
      'click here',
      'limited time',
      'act now',
      'free money',
      'no risk'
    ];

    return spamIndicators.some(indicator => 
      content.toLowerCase().includes(indicator)
    );
  }

  private isPromotionalContent(content: string): boolean {
    const promotionalWords = ['buy', 'sell', 'discount', 'offer', 'deal', 'promo'];
    const lowerContent = content.toLowerCase();
    
    const promotionalCount = promotionalWords.filter(word => 
      lowerContent.includes(word)
    ).length;

    return promotionalCount >= 2;
  }

  private needsDisclosure(content: string): boolean {
    const financialTerms = ['invest', 'buy', 'sell', 'profit', 'return', 'trading'];
    const lowerContent = content.toLowerCase();
    
    const hasFinancialTerms = financialTerms.some(term => 
      lowerContent.includes(term)
    );

    const hasDisclaimer = this.config.requiredDisclosures.some(disclaimer => 
      lowerContent.includes(disclaimer.toLowerCase())
    );

    return hasFinancialTerms && !hasDisclaimer;
  }

  private containsSensitiveTopic(content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    return this.config.sensitiveTopics.some(topic => 
      lowerContent.includes(topic.toLowerCase())
    );
  }

  private generateRecommendations(
    content: string, 
    violations: ComplianceViolation[], 
    warnings: ComplianceWarning[]
  ): string[] {
    const recommendations: string[] = [];

    if (violations.length === 0 && warnings.length === 0) {
      recommendations.push('Content meets all compliance requirements');
      return recommendations;
    }

    if (violations.some(v => v.type === 'financial_advice')) {
      recommendations.push('Add disclaimer: "This is not financial advice. DYOR."');
    }

    if (violations.some(v => v.type === 'spam')) {
      recommendations.push('Remove promotional language and focus on educational content');
    }

    if (warnings.some(w => w.type === 'promotional_content')) {
      recommendations.push('Balance promotional content with educational value');
    }

    if (warnings.some(w => w.type === 'sensitive_topic')) {
      recommendations.push('Add appropriate context and disclaimers for sensitive topics');
    }

    return recommendations;
  }

  private calculateComplianceScore(violations: ComplianceViolation[], warnings: ComplianceWarning[]): number {
    let score = 1.0;

    // Deduct points for violations
    violations.forEach(violation => {
      switch (violation.severity) {
        case 'critical':
          score -= 0.5;
          break;
        case 'high':
          score -= 0.3;
          break;
        case 'medium':
          score -= 0.2;
          break;
        case 'low':
          score -= 0.1;
          break;
      }
    });

    // Deduct smaller amounts for warnings
    warnings.forEach(() => {
      score -= 0.05;
    });

    return Math.max(0, Math.min(1, score));
  }

  private determinePass(violations: ComplianceViolation[], score: number): boolean {
    // Fail if there are critical or high severity violations
    const criticalViolations = violations.filter(v => 
      v.severity === 'critical' || v.severity === 'high'
    );

    if (criticalViolations.length > 0) {
      return false;
    }

    // Fail if score is below threshold
    return score >= 0.7;
  }
}
