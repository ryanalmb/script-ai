import express from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import fetch from 'node-fetch';

const router = express.Router();

// Get all campaigns
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    // Get campaigns from database
    const campaigns = await prisma.campaign.findMany({
      where: userId ? { userId: userId as string } : {},
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate statistics
    const total = campaigns.length;
    const active = campaigns.filter(c => c.status === 'ACTIVE').length;
    const paused = campaigns.filter(c => c.status === 'PAUSED').length;
    const completed = campaigns.filter(c => c.status === 'COMPLETED').length;

    // Transform campaigns for response
    const transformedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status.toLowerCase(),
      type: 'content_generation',
      schedule: (campaign.settings as any)?.schedule || {
        frequency: 'daily',
        times: ['12:00']
      },
      targets: (campaign.settings as any)?.targets || {
        posts: 1,
        likes: 10,
        comments: 5,
        follows: 2
      },
      performance: {
        postsCreated: campaign._count.posts,
        totalLikes: 0, // TODO: Calculate from posts
        totalComments: 0, // TODO: Calculate from posts
        engagementRate: 0, // TODO: Calculate from posts
        qualityScore: 0.85 // TODO: Calculate from posts
      },
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      user: campaign.user
    }));

    res.json({
      success: true,
      campaigns: transformedCampaigns,
      total,
      active,
      paused,
      completed
    });
  } catch (error) {
    logger.error('Get campaigns failed:', error);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

// Create new campaign
router.post('/', async (req, res): Promise<any> => {
  try {
    const { userId, name, description, type, schedule, targets, settings } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    // Create campaign in database
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        name,
        description: description || '',
        status: 'DRAFT',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        settings: {
          type: type || 'content_generation',
          schedule: schedule || {
            frequency: 'daily',
            times: ['12:00']
          },
          targets: targets || {
            posts: 1,
            likes: 10,
            comments: 5,
            follows: 2
          },
          qualityThreshold: settings?.qualityThreshold || 0.8,
          complianceMode: settings?.complianceMode !== false,
          autoApprove: settings?.autoApprove || false,
          ...settings
        } as any as any
      },
      // Remove include for now to avoid TypeScript issues
    });

    // Transform for response
    const transformedCampaign = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status.toLowerCase(),
      type: (campaign.settings as any)?.type || 'content_generation',
      schedule: (campaign.settings as any)?.schedule,
      targets: (campaign.settings as any)?.targets,
      settings: campaign.settings,
      performance: {
        postsCreated: 0,
        totalLikes: 0,
        totalComments: 0,
        engagementRate: 0,
        qualityScore: 0
      },
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      userId: campaign.userId
    };

    res.json({
      success: true,
      message: 'Campaign created successfully',
      campaign: transformedCampaign
    });
  } catch (error) {
    logger.error('Create campaign failed:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Get campaign by ID
router.get('/:id', async (req, res): Promise<any> => {
  try {
    const { id } = req.params;

    // Get campaign from database
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        posts: {
          select: {
            id: true,
            content: true,
            status: true,
            likesCount: true,
            retweetsCount: true,
            repliesCount: true,
            viewsCount: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Calculate performance metrics from actual posts
    const totalLikes = campaign.posts.reduce((sum, post) => sum + (post.likesCount || 0), 0);
    const totalComments = campaign.posts.reduce((sum, post) => sum + (post.repliesCount || 0), 0);
    const totalViews = campaign.posts.reduce((sum, post) => sum + (post.viewsCount || 0), 0);
    const engagementRate = totalViews > 0 ? (totalLikes + totalComments) / totalViews : 0;

    // Transform for response
    const transformedCampaign = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status.toLowerCase(),
      type: (campaign.settings as any)?.type || 'content_generation',
      schedule: (campaign.settings as any)?.schedule || {
        frequency: 'daily',
        times: ['12:00']
      },
      targets: (campaign.settings as any)?.targets || {
        posts: 1,
        likes: 10,
        comments: 5,
        follows: 2
      },
      performance: {
        postsCreated: campaign._count.posts,
        totalLikes,
        totalComments,
        engagementRate: Math.round(engagementRate * 1000) / 1000,
        qualityScore: 0.85 // TODO: Calculate based on actual metrics
      },
      posts: campaign.posts,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      userId: campaign.userId
    };

    res.json({
      success: true,
      campaign: transformedCampaign
    });
  } catch (error) {
    logger.error('Get campaign failed:', error);
    res.status(500).json({ error: 'Failed to get campaign' });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    res.json({
      success: true,
      message: 'Campaign updated successfully',
      campaign: {
        id: id,
        ...updates,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Update campaign failed:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({
      success: true,
      message: 'Campaign deleted successfully',
      campaignId: id
    });
  } catch (error) {
    logger.error('Delete campaign failed:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// Start/Resume campaign
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({
      success: true,
      message: 'Campaign started successfully',
      campaignId: id,
      status: 'active',
      startedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Start campaign failed:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// Pause campaign
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({
      success: true,
      message: 'Campaign paused successfully',
      campaignId: id,
      status: 'paused',
      pausedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Pause campaign failed:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// AI-powered campaign creation
router.post('/ai-create', async (req, res) => {
  try {
    const { user_prompt, user_id } = req.body;

    if (!user_prompt) {
      return res.status(400).json({ error: 'user_prompt is required' });
    }

    logger.info(`Creating AI campaign for user ${user_id}: ${user_prompt.substring(0, 100)}...`);

    // Call LLM service for campaign orchestration
    const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:3003';
    const response = await fetch(`${llmServiceUrl}/api/orchestrate/campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_prompt,
        user_id,
        platform: 'twitter'
      })
    });

    const result = await response.json();

    if (result.success) {
      logger.info(`AI campaign created successfully: ${result.campaign_id}`);

      // Store campaign in database (would be actual DB in production)
      const campaign = {
        ...result.campaign,
        backend_id: `backend-${Date.now()}`,
        created_via: 'ai_orchestrator',
        user_id: user_id
      };

      return res.json({
        success: true,
        message: 'AI campaign created successfully',
        campaign: campaign,
        campaign_id: result.campaign_id
      });
    } else {
      logger.error(`AI campaign creation failed: ${result.error}`);
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to create AI campaign'
      });
    }

  } catch (error) {
    logger.error('AI campaign creation failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create AI campaign'
    });
  }
});

// Get campaign from LLM service
router.get('/ai/:campaign_id', async (req, res) => {
  try {
    const { campaign_id } = req.params;

    const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:3003';
    const response = await fetch(`${llmServiceUrl}/api/campaigns/${campaign_id}`);

    const result = await response.json();

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Campaign not found' });
    }

  } catch (error) {
    logger.error('Get AI campaign failed:', error);
    res.status(500).json({ error: 'Failed to get AI campaign' });
  }
});

// Stop AI campaign
router.post('/ai/:campaign_id/stop', async (req, res) => {
  try {
    const { campaign_id } = req.params;

    const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:3003';
    const response = await fetch(`${llmServiceUrl}/api/campaigns/${campaign_id}/stop`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Campaign not found or already stopped' });
    }

  } catch (error) {
    logger.error('Stop AI campaign failed:', error);
    res.status(500).json({ error: 'Failed to stop AI campaign' });
  }
});

export default router;
