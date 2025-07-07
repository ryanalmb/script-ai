import { logger } from '../utils/logger';

export interface ContentRequest {
  topic?: string;
  tone?: 'bullish' | 'bearish' | 'neutral' | 'professional' | 'casual' | 'educational';
  type?: 'post' | 'thread' | 'comment' | 'dm' | 'poll';
  length?: 'short' | 'medium' | 'long';
  hashtags?: string[];
  mentions?: string[];
  includeEmojis?: boolean;
  targetAudience?: string;
  provider?: 'openai' | 'anthropic' | 'huggingface' | 'auto';
}

export interface GeneratedContent {
  id: string;
  content: string;
  type: string;
  quality: {
    score: number;
    compliance: number;
    sentiment: string;
    readability: number;
    engagement_prediction: number;
  };
  metadata: {
    topic: string;
    tone: string;
    length: string;
    character_count: number;
    word_count: number;
    hashtags: string[];
    mentions: string[];
    provider: string;
    generated_at: string;
  };
  suggestions: string[];
}

export interface ContentTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  variables: string[];
  description: string;
}

export class ContentGenerationService {
  private templates: Map<string, ContentTemplate> = new Map();
  private providers = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    huggingface: process.env.HUGGINGFACE_API_KEY
  };

  constructor() {
    this.initializeTemplates();
  }

  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    try {
      const provider = this.selectProvider(request.provider);
      logger.info('Generating content', { provider, request });

      let content: string;
      
      switch (provider) {
        case 'openai':
          content = await this.generateWithOpenAI(request);
          break;
        case 'anthropic':
          content = await this.generateWithAnthropic(request);
          break;
        case 'huggingface':
          content = await this.generateWithHuggingFace(request);
          break;
        default:
          content = await this.generateWithTemplate(request);
      }

      const quality = await this.analyzeQuality(content);
      const metadata = this.generateMetadata(content, request, provider);

      const result: GeneratedContent = {
        id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        type: request.type || 'post',
        quality,
        metadata,
        suggestions: this.generateSuggestions(content, quality)
      };

      logger.info('Content generated successfully', { 
        id: result.id, 
        provider, 
        qualityScore: quality.score 
      });

      return result;
    } catch (error) {
      logger.error('Error generating content:', error);
      throw new Error('Content generation failed');
    }
  }

  async generateThread(request: ContentRequest, threadLength: number = 5): Promise<GeneratedContent[]> {
    try {
      const thread: GeneratedContent[] = [];
      
      for (let i = 0; i < threadLength; i++) {
        const threadRequest = {
          ...request,
          type: 'thread' as const,
          topic: i === 0 ? request.topic : `${request.topic} - Part ${i + 1}`
        };

        const content = await this.generateContent(threadRequest);
        thread.push(content);
      }

      logger.info('Thread generated successfully', { 
        threadLength, 
        topic: request.topic 
      });

      return thread;
    } catch (error) {
      logger.error('Error generating thread:', error);
      throw new Error('Thread generation failed');
    }
  }

  async generatePoll(request: ContentRequest): Promise<{
    question: string;
    options: string[];
    metadata: any;
  }> {
    try {
      const pollRequest = { ...request, type: 'poll' as const };
      const content = await this.generateContent(pollRequest);
      
      // Parse poll content
      const lines = content.content.split('\n').filter(line => line.trim());
      const question = lines[0];
      const options = lines.slice(1, 5).map(line => line.replace(/^[•\-\d\.]\s*/, ''));

      return {
        question,
        options,
        metadata: content.metadata
      };
    } catch (error) {
      logger.error('Error generating poll:', error);
      throw new Error('Poll generation failed');
    }
  }

  getTemplates(category?: string): ContentTemplate[] {
    const templates = Array.from(this.templates.values());
    return category ? templates.filter(t => t.category === category) : templates;
  }

  async generateFromTemplate(templateId: string, variables: Record<string, string>): Promise<GeneratedContent> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      let content = template.template;
      
      // Replace variables
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`{${key}}`, 'g'), value);
      }

      const quality = await this.analyzeQuality(content);
      const metadata = {
        topic: variables.topic || 'template',
        tone: variables.tone || 'neutral',
        length: 'medium',
        character_count: content.length,
        word_count: content.split(' ').length,
        hashtags: this.extractHashtags(content),
        mentions: this.extractMentions(content),
        provider: 'template',
        generated_at: new Date().toISOString()
      };

      return {
        id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        type: 'post',
        quality,
        metadata,
        suggestions: this.generateSuggestions(content, quality)
      };
    } catch (error) {
      logger.error('Error generating from template:', error);
      throw new Error('Template generation failed');
    }
  }

  private selectProvider(requested?: string): string {
    if (requested && requested !== 'auto' && this.providers[requested as keyof typeof this.providers]) {
      return requested;
    }

    // Auto-select based on availability
    if (this.providers.openai) return 'openai';
    if (this.providers.anthropic) return 'anthropic';
    if (this.providers.huggingface) return 'huggingface';
    
    return 'template'; // Fallback to template-based generation
  }

  private async generateWithOpenAI(request: ContentRequest): Promise<string> {
    // Simulate OpenAI API call
    // In real implementation, this would call OpenAI's API
    const prompt = this.buildPrompt(request);
    
    // Simulated response
    return this.generateWithTemplate(request);
  }

  private async generateWithAnthropic(request: ContentRequest): Promise<string> {
    // Simulate Anthropic API call
    // In real implementation, this would call Anthropic's API
    const prompt = this.buildPrompt(request);
    
    // Simulated response
    return this.generateWithTemplate(request);
  }

  private async generateWithHuggingFace(request: ContentRequest): Promise<string> {
    // Simulate Hugging Face API call
    // In real implementation, this would call Hugging Face's API
    const prompt = this.buildPrompt(request);
    
    // Simulated response
    return this.generateWithTemplate(request);
  }

  private async generateWithTemplate(request: ContentRequest): Promise<string> {
    const topic = request.topic || 'cryptocurrency';
    const tone = request.tone || 'professional';
    const type = request.type || 'post';

    const templates = {
      bullish: [
        `${topic.charAt(0).toUpperCase() + topic.slice(1)} showing strong momentum today! 📈 Technical analysis suggests potential breakout. What are your thoughts?`,
        `Exciting developments in ${topic}! The fundamentals look solid and market sentiment is turning positive.`,
        `${topic.charAt(0).toUpperCase() + topic.slice(1)} breaking key resistance levels! This could be the start of a significant move upward.`
      ],
      bearish: [
        `${topic.charAt(0).toUpperCase() + topic.slice(1)} facing some headwinds today. Important to stay cautious and manage risk properly.`,
        `Market correction in ${topic} might present buying opportunities for patient investors. DYOR!`,
        `${topic.charAt(0).toUpperCase() + topic.slice(1)} testing support levels. Key to watch how it holds in the coming sessions.`
      ],
      neutral: [
        `Analyzing ${topic} market trends. Mixed signals suggest consolidation phase ahead.`,
        `${topic.charAt(0).toUpperCase() + topic.slice(1)} market update: Sideways movement continues as traders await catalyst.`,
        `Current ${topic} analysis shows balanced market conditions. Patience is key.`
      ],
      professional: [
        `Comprehensive ${topic} analysis reveals interesting market dynamics worth monitoring.`,
        `${topic.charAt(0).toUpperCase() + topic.slice(1)} market structure analysis indicates potential opportunities for strategic positioning.`,
        `Technical and fundamental analysis of ${topic} suggests measured approach recommended.`
      ]
    };

    const contentTemplates = templates[tone as keyof typeof templates] || templates.professional;
    let content = contentTemplates[Math.floor(Math.random() * contentTemplates.length)];

    // Add hashtags if requested
    if (request.hashtags && request.hashtags.length > 0) {
      content += ` ${request.hashtags.join(' ')}`;
    } else {
      // Add default hashtags based on topic
      const defaultHashtags = this.getDefaultHashtags(topic);
      content += ` ${defaultHashtags.join(' ')}`;
    }

    // Add mentions if requested
    if (request.mentions && request.mentions.length > 0) {
      content += ` ${request.mentions.join(' ')}`;
    }

    return content;
  }

  private buildPrompt(request: ContentRequest): string {
    const { topic, tone, type, length, targetAudience } = request;
    
    return `Generate a ${type} about ${topic} with a ${tone} tone. 
    Length: ${length}
    Target audience: ${targetAudience || 'crypto enthusiasts'}
    Include relevant hashtags and ensure compliance with social media guidelines.`;
  }

  private async analyzeQuality(content: string): Promise<GeneratedContent['quality']> {
    // Simulate quality analysis
    const wordCount = content.split(' ').length;
    const charCount = content.length;
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    
    const score = Math.min(0.95, Math.max(0.70, 0.85 + (wordCount / 100) * 0.1));
    const compliance = hashtagCount <= 5 ? 0.95 : 0.85;
    const readability = Math.min(0.95, Math.max(0.70, 0.90 - (charCount / 1000) * 0.1));
    
    return {
      score: Math.round(score * 100) / 100,
      compliance: Math.round(compliance * 100) / 100,
      sentiment: this.analyzeSentiment(content),
      readability: Math.round(readability * 100) / 100,
      engagement_prediction: Math.round((Math.random() * 0.15 + 0.75) * 100) / 100
    };
  }

  private analyzeSentiment(content: string): string {
    const positiveWords = ['bullish', 'positive', 'growth', 'opportunity', 'strong', 'exciting'];
    const negativeWords = ['bearish', 'negative', 'decline', 'risk', 'weak', 'concerning'];
    
    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private generateMetadata(content: string, request: ContentRequest, provider: string): GeneratedContent['metadata'] {
    return {
      topic: request.topic || 'general',
      tone: request.tone || 'professional',
      length: request.length || 'medium',
      character_count: content.length,
      word_count: content.split(' ').length,
      hashtags: this.extractHashtags(content),
      mentions: this.extractMentions(content),
      provider,
      generated_at: new Date().toISOString()
    };
  }

  private generateSuggestions(content: string, quality: GeneratedContent['quality']): string[] {
    const suggestions = [];
    
    if (quality.score < 0.8) {
      suggestions.push('Consider adding more specific data points');
    }
    
    if (quality.engagement_prediction < 0.8) {
      suggestions.push('Include a call-to-action for engagement');
    }
    
    if (content.length < 100) {
      suggestions.push('Consider expanding the content for better engagement');
    }
    
    if (!content.includes('#')) {
      suggestions.push('Add relevant trending hashtags');
    }
    
    suggestions.push('Optimize posting time for target audience');
    
    return suggestions;
  }

  private extractHashtags(content: string): string[] {
    const matches = content.match(/#\w+/g);
    return matches || [];
  }

  private extractMentions(content: string): string[] {
    const matches = content.match(/@\w+/g);
    return matches || [];
  }

  private getDefaultHashtags(topic: string): string[] {
    const hashtagMap: Record<string, string[]> = {
      bitcoin: ['#Bitcoin', '#BTC', '#Crypto'],
      ethereum: ['#Ethereum', '#ETH', '#DeFi'],
      cryptocurrency: ['#Crypto', '#Blockchain', '#Trading'],
      defi: ['#DeFi', '#Yield', '#Ethereum'],
      nft: ['#NFT', '#DigitalArt', '#Blockchain'],
      trading: ['#Trading', '#TechnicalAnalysis', '#Crypto']
    };
    
    return hashtagMap[topic.toLowerCase()] || ['#Crypto', '#Blockchain'];
  }

  private initializeTemplates(): void {
    const templates: ContentTemplate[] = [
      {
        id: 'market-analysis',
        name: 'Market Analysis',
        category: 'trading',
        template: '{asset} showing {trend} momentum! 📈 {analysis} What are your thoughts? {hashtags}',
        variables: ['asset', 'trend', 'analysis', 'hashtags'],
        description: 'Template for market analysis posts'
      },
      {
        id: 'defi-update',
        name: 'DeFi Update',
        category: 'defi',
        template: '{protocol} {update} looking {sentiment}. Current {metric}: {value}. DYOR! {hashtags}',
        variables: ['protocol', 'update', 'sentiment', 'metric', 'value', 'hashtags'],
        description: 'Template for DeFi protocol updates'
      },
      {
        id: 'news-thread',
        name: 'News Thread',
        category: 'news',
        template: 'Breaking: {headline} 🧵\n\n1/ {point1}\n2/ {point2}\n3/ {conclusion} {hashtags}',
        variables: ['headline', 'point1', 'point2', 'conclusion', 'hashtags'],
        description: 'Template for news thread posts'
      },
      {
        id: 'educational',
        name: 'Educational Content',
        category: 'education',
        template: 'Did you know? {fact}\n\n{explanation}\n\nThis is why {importance}. {hashtags}',
        variables: ['fact', 'explanation', 'importance', 'hashtags'],
        description: 'Template for educational content'
      },
      {
        id: 'poll-question',
        name: 'Poll Question',
        category: 'engagement',
        template: '{question}\n\n• {option1}\n• {option2}\n• {option3}\n• {option4}',
        variables: ['question', 'option1', 'option2', 'option3', 'option4'],
        description: 'Template for poll questions'
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }
}
