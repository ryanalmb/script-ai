import express from 'express';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

const router = express.Router();

// Get all campaigns
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      campaigns: [
        {
          id: 'campaign-1',
          name: 'Crypto Market Analysis',
          status: 'active',
          type: 'content_generation',
          schedule: {
            frequency: 'daily',
            times: ['09:00', '15:00', '21:00']
          },
          targets: {
            posts: 3,
            likes: 50,
            comments: 20,
            follows: 10
          },
          performance: {
            postsCreated: 45,
            totalLikes: 1250,
            totalComments: 380,
            engagementRate: 0.045,
            qualityScore: 0.92
          },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: new Date().toISOString()
        }
      ],
      total: 1,
      active: 1,
      paused: 0,
      completed: 0
    });
  } catch (error) {
    logger.error('Get campaigns failed:', error);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

// Create new campaign
router.post('/', async (req, res) => {
  try {
    const { name, type, schedule, targets, settings } = req.body;
    
    const campaign = {
      id: `campaign-${Date.now()}`,
      name: name || 'New Campaign',
      status: 'draft',
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
      settings: settings || {
        qualityThreshold: 0.8,
        complianceMode: true,
        autoApprove: false
      },
      performance: {
        postsCreated: 0,
        totalLikes: 0,
        totalComments: 0,
        engagementRate: 0,
        qualityScore: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'Campaign created successfully',
      campaign: campaign
    });
  } catch (error) {
    logger.error('Create campaign failed:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Get campaign by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    res.json({
      success: true,
      campaign: {
        id: id,
        name: 'Crypto Market Analysis',
        status: 'active',
        type: 'content_generation',
        schedule: {
          frequency: 'daily',
          times: ['09:00', '15:00', '21:00']
        },
        targets: {
          posts: 3,
          likes: 50,
          comments: 20,
          follows: 10
        },
        performance: {
          postsCreated: 45,
          totalLikes: 1250,
          totalComments: 380,
          engagementRate: 0.045,
          qualityScore: 0.92
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: new Date().toISOString()
      }
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
