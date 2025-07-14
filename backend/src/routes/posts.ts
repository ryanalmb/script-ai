import express from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { PostStatus } from '@prisma/client';

const router = express.Router();

// Get all posts
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, account } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Build where clause
    const whereClause: any = {
      account: {
        userId: userId
      }
    };

    // Add status filter if provided
    if (status && Object.values(PostStatus).includes(status as PostStatus)) {
      whereClause.status = status as PostStatus;
    }

    // Add account filter if provided
    if (account) {
      whereClause.account = {
        ...whereClause.account,
        username: account as string
      };
    }

    // Get posts from database
    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        account: {
          select: {
            username: true,
            displayName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string)
    });

    // Get total count for pagination
    const total = await prisma.post.count({
      where: whereClause
    });

    // Get stats
    const stats = await prisma.post.groupBy({
      by: ['status'],
      where: {
        account: {
          userId: userId
        }
      },
      _count: {
        status: true
      }
    });

    const statsObj = stats.reduce((acc: any, stat: any) => {
      acc[stat.status.toLowerCase()] = stat._count.status;
      return acc;
    }, {} as any);

    return res.json({
      success: true,
      posts: posts.map((post: any) => ({
        id: post.id,
        content: post.content,
        status: post.status,
        account: post.account?.username,
        platform: 'x', // All posts are X posts in this system
        scheduledAt: post.scheduledFor,
        publishedAt: post.publishedAt,
        metrics: {
          views: post.viewsCount,
          likes: post.likesCount,
          retweets: post.retweetsCount,
          comments: post.repliesCount,
          engagementRate: post.viewsCount > 0 ? (post.likesCount + post.retweetsCount + post.repliesCount) / post.viewsCount : 0
        },
        hashtags: post.hashtags,
        mentions: post.mentions,
        media: post.mediaUrls,
        createdAt: post.createdAt
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      },
      stats: {
        total,
        published: statsObj.published || 0,
        scheduled: statsObj.scheduled || 0,
        draft: statsObj.draft || 0,
        failed: statsObj.failed || 0
      }
    });
  } catch (error) {
    logger.error('Get posts failed:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to get posts' 
    });
  }
});

// Create new post
router.post('/', async (req, res) => {
  try {
    const { content, accountId, scheduledFor, hashtags, mentions, mediaUrls } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!content || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'Content and account ID are required'
      });
    }

    // Verify the account belongs to the user
    const account = await prisma.xAccount.findFirst({
      where: {
        id: accountId,
        userId: userId
      }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or not accessible'
      });
    }

    // Create the post
    const post = await prisma.post.create({
      data: {
        content,
        accountId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        hashtags: hashtags || [],
        mentions: mentions || [],
        mediaUrls: mediaUrls || [],
        status: scheduledFor ? PostStatus.SCHEDULED : PostStatus.DRAFT
      },
      include: {
        account: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      post: {
        id: post.id,
        content: post.content,
        status: post.status,
        account: post.account?.username,
        platform: 'x',
        scheduledAt: post.scheduledFor,
        publishedAt: post.publishedAt,
        metrics: {
          views: post.viewsCount,
          likes: post.likesCount,
          retweets: post.retweetsCount,
          comments: post.repliesCount,
          engagementRate: 0
        },
        hashtags: post.hashtags,
        mentions: post.mentions,
        media: post.mediaUrls,
        createdAt: post.createdAt
      }
    });
  } catch (error) {
    logger.error('Create post failed:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to create post' 
    });
  }
});

// Get post by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const post = await prisma.post.findFirst({
      where: {
        id: id,
        account: {
          userId: userId
        }
      },
      include: {
        account: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    return res.json({
      success: true,
      post: {
        id: post.id,
        content: post.content,
        status: post.status,
        account: post.account?.username,
        platform: 'x',
        scheduledAt: post.scheduledFor,
        publishedAt: post.publishedAt,
        metrics: {
          views: post.viewsCount,
          likes: post.likesCount,
          retweets: post.retweetsCount,
          comments: post.repliesCount,
          engagementRate: post.viewsCount > 0 ? (post.likesCount + post.retweetsCount + post.repliesCount) / post.viewsCount : 0
        },
        hashtags: post.hashtags,
        mentions: post.mentions,
        media: post.mediaUrls,
        createdAt: post.createdAt
      }
    });
  } catch (error) {
    logger.error('Get post failed:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to get post' 
    });
  }
});

// Update post
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, scheduledFor, hashtags, mentions, mediaUrls, status } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify the post belongs to the user
    const existingPost = await prisma.post.findFirst({
      where: {
        id: id,
        account: {
          userId: userId
        }
      }
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Update the post
    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(content && { content }),
        ...(scheduledFor && { scheduledFor: new Date(scheduledFor) }),
        ...(hashtags && { hashtags }),
        ...(mentions && { mentions }),
        ...(mediaUrls && { mediaUrls }),
        ...(status && Object.values(PostStatus).includes(status as PostStatus) && { status: status as PostStatus })
      },
      include: {
        account: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    });

    return res.json({
      success: true,
      post: {
        id: post.id,
        content: post.content,
        status: post.status,
        account: post.account?.username,
        platform: 'x',
        scheduledAt: post.scheduledFor,
        publishedAt: post.publishedAt,
        metrics: {
          views: post.viewsCount,
          likes: post.likesCount,
          retweets: post.retweetsCount,
          comments: post.repliesCount,
          engagementRate: post.viewsCount > 0 ? (post.likesCount + post.retweetsCount + post.repliesCount) / post.viewsCount : 0
        },
        hashtags: post.hashtags,
        mentions: post.mentions,
        media: post.mediaUrls,
        createdAt: post.createdAt
      }
    });
  } catch (error) {
    logger.error('Update post failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update post'
    });
  }
});

// Delete post
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify the post belongs to the user
    const existingPost = await prisma.post.findFirst({
      where: {
        id: id,
        account: {
          userId: userId
        }
      }
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Delete the post
    await prisma.post.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    logger.error('Delete post failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete post'
    });
  }
});

export default router;
