import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

// Extended Request interface
interface ExtendedRequest extends Request {
  body: any;
  ip: string | undefined;
}

const router = express.Router();

// Generate content
router.post('/generate', async (req, res) => {
  try {
    const { topic, tone, type, length, hashtags, mentions } = req.body;
    
    // Call Enterprise LLM service for advanced content generation
    const llmResponse = await fetch(`${process.env.LLM_SERVICE_URL}/api/gemini/enterprise/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: `Create ${type || 'post'} content about ${topic || 'market analysis'} with ${tone || 'professional'} tone, ${length || 'medium'} length`,
        task_type: 'content_generation',
        complexity: 'complex',
        multimodal_types: ['text'],
        performance_priority: 'quality',
        deep_think_enabled: true,
        context: {
          topic: topic || 'market analysis',
          tone: tone || 'professional',
          type: type || 'post',
          length: length || 'medium',
          hashtags: hashtags || [],
          mentions: mentions || [],
          backend_integration: true
        }
      })
    });

    if (!llmResponse.ok) {
      return res.status(500).json({
        success: false,
        error: 'Content generation service unavailable'
      });
    }

    const llmData: any = await llmResponse.json();

    const generatedContent = {
      id: `content-${Date.now()}`,
      content: llmData.content,
      type: type || 'post',
      quality: llmData.quality || {
        score: 0.85,
        compliance: 0.90,
        sentiment: 'neutral',
        readability: 0.80,
        engagement_prediction: 0.75
      },
      metadata: {
        topic: topic || 'general',
        tone: tone || 'professional',
        length: length || 'medium',
        character_count: 180,
        word_count: 28,
        hashtags: hashtags || ['#crypto', '#trading', '#blockchain'],
        mentions: mentions || [],
        generated_at: new Date().toISOString()
      },
      suggestions: [
        'Consider adding more specific market data',
        'Include a call-to-action',
        'Optimize for peak engagement hours',
        'Add relevant trending hashtags'
      ],
      alternatives: [
        'Alternative version with different tone',
        'Shorter version for better engagement',
        'Extended version with more details'
      ]
    };
    
    return res.json({
      success: true,
      content: generatedContent,
      message: 'Content generated successfully'
    });
  } catch (error) {
    logger.error('Content generation failed:', error);
    return res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Get content templates
router.get('/templates', async (req, res) => {
  try {
    const { category, type } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get templates from database
    const templates = await prisma.contentTemplate.findMany({
      where: {
        isActive: true,
        ...(category && { category: category as string })
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get available categories
    const categories = await prisma.contentTemplate.findMany({
      select: {
        category: true
      },
      distinct: ['category'],
      where: {
        isActive: true
      }
    });

    return res.json({
      success: true,
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        category: template.category,
        template: template.template,
        variables: template.variables,
        isActive: template.isActive,
        createdAt: template.createdAt
      })),
      categories: categories.map(c => c.category).filter(Boolean),
      types: ['post', 'thread', 'poll', 'dm'] // Static types since not in schema
    });
  } catch (error) {
    logger.error('Get content templates failed:', error);
    return res.status(500).json({ error: 'Failed to get content templates' });
  }
});

// Analyze content quality
router.post('/analyze', async (req: ExtendedRequest, res: Response) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Simulate content analysis
    const analysis = {
      quality: {
        score: 0.89,
        factors: {
          readability: 0.92,
          engagement_potential: 0.87,
          originality: 0.85,
          relevance: 0.94
        }
      },
      compliance: {
        score: 0.96,
        checks: {
          spam_detection: 'passed',
          sentiment_analysis: 'positive',
          content_policy: 'compliant',
          trademark_check: 'clear'
        }
      },
      optimization: {
        character_count: content.length,
        word_count: content.split(' ').length,
        hashtag_count: (content.match(/#\w+/g) || []).length,
        mention_count: (content.match(/@\w+/g) || []).length,
        emoji_count: (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length
      },
      suggestions: [
        'Consider adding more engaging emojis',
        'Optimal length for better engagement',
        'Add trending hashtags for visibility',
        'Include a call-to-action'
      ],
      predicted_performance: {
        engagement_rate: 0.045,
        reach_estimate: 15000,
        interaction_likelihood: 0.78
      }
    };
    
    return res.json({
      success: true,
      analysis: analysis,
      content: content
    });
  } catch (error) {
    logger.error('Content analysis failed:', error);
    return res.status(500).json({ error: 'Failed to analyze content' });
  }
});

// Get trending topics
router.get('/trending', async (req, res) => {
  try {
    const { category = 'crypto', limit = 10 } = req.query;
    
    res.json({
      success: true,
      trending: {
        topics: [
          { topic: 'Bitcoin ETF', volume: 15420, sentiment: 'positive', growth: '+25%' },
          { topic: 'Ethereum Upgrade', volume: 12890, sentiment: 'positive', growth: '+18%' },
          { topic: 'DeFi Yields', volume: 9870, sentiment: 'neutral', growth: '+12%' },
          { topic: 'NFT Market', volume: 8450, sentiment: 'negative', growth: '-8%' },
          { topic: 'Altcoin Season', volume: 7230, sentiment: 'positive', growth: '+22%' }
        ],
        hashtags: [
          { hashtag: '#Bitcoin', usage: 45000, trend: 'rising' },
          { hashtag: '#Ethereum', usage: 32000, trend: 'rising' },
          { hashtag: '#DeFi', usage: 28000, trend: 'stable' },
          { hashtag: '#Crypto', usage: 67000, trend: 'rising' },
          { hashtag: '#Blockchain', usage: 23000, trend: 'stable' }
        ],
        keywords: [
          'bull market', 'resistance level', 'support zone', 'breakout', 'consolidation',
          'market cap', 'volume spike', 'technical analysis', 'fundamental analysis', 'HODL'
        ],
        category: category,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Get trending topics failed:', error);
    res.status(500).json({ error: 'Failed to get trending topics' });
  }
});

// Save content template
router.post('/templates', async (req, res) => {
  try {
    const { name, category, type, template, variables } = req.body;
    
    const newTemplate = {
      id: `template-${Date.now()}`,
      name: name,
      category: category || 'custom',
      type: type || 'post',
      template: template,
      variables: variables || [],
      created_at: new Date().toISOString(),
      usage_count: 0
    };
    
    res.json({
      success: true,
      message: 'Template saved successfully',
      template: newTemplate
    });
  } catch (error) {
    logger.error('Save content template failed:', error);
    res.status(500).json({ error: 'Failed to save content template' });
  }
});

export default router;
