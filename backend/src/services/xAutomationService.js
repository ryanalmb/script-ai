/**
 * X (Twitter) Automation Service
 * Handles quality-focused automation with regional compliance
 */

const { TwitterApi } = require('twitter-api-v2');
const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');
const redis = require('../config/redis');

const prisma = new PrismaClient();

class XAutomationService {
    constructor() {
        this.clients = new Map(); // Store Twitter clients for each account
        this.activeAutomations = new Map(); // Track active automation tasks
        this.qualityThresholds = {
            minQualityScore: 0.8,
            minComplianceScore: 0.9,
            maxPostsPerHour: 5,
            maxPostsPerDay: 50,
            minTimeBetweenPosts: 15 * 60 * 1000 // 15 minutes
        };
    }

    /**
     * Initialize Twitter client for an account
     */
    async initializeClient(accountId) {
        try {
            const account = await prisma.xAccount.findUnique({
                where: { id: accountId },
                include: { user: true }
            });

            if (!account || !account.accessToken || !account.accessTokenSecret) {
                throw new Error('Account credentials not found');
            }

            const client = new TwitterApi({
                appKey: process.env.X_API_KEY,
                appSecret: process.env.X_API_SECRET,
                accessToken: account.accessToken,
                accessSecret: account.accessTokenSecret,
            });

            // Verify credentials
            const user = await client.v2.me();
            
            // Update account info
            await prisma.xAccount.update({
                where: { id: accountId },
                data: {
                    username: user.data.username,
                    displayName: user.data.name,
                    isVerified: user.data.verified || false,
                    lastActivity: new Date()
                }
            });

            this.clients.set(accountId, client);
            logger.info(`Twitter client initialized for account ${accountId}`);
            
            return client;
        } catch (error) {
            logger.error(`Failed to initialize Twitter client for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Post content to X with quality checks
     */
    async postContent(accountId, content, options = {}) {
        try {
            // Get or initialize client
            let client = this.clients.get(accountId);
            if (!client) {
                client = await this.initializeClient(accountId);
            }

            // Quality and rate limiting checks
            const qualityCheck = await this.performQualityChecks(accountId, content);
            if (!qualityCheck.approved) {
                throw new Error(`Quality check failed: ${qualityCheck.reason}`);
            }

            // Rate limiting check
            const rateLimitCheck = await this.checkRateLimits(accountId);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Prepare tweet data
            const tweetData = {
                text: content.text
            };

            // Add media if provided
            if (content.mediaUrls && content.mediaUrls.length > 0) {
                const mediaIds = await this.uploadMedia(client, content.mediaUrls);
                tweetData.media = { media_ids: mediaIds };
            }

            // Add reply/thread info if provided
            if (options.replyToTweetId) {
                tweetData.reply = { in_reply_to_tweet_id: options.replyToTweetId };
            }

            // Post the tweet
            const tweet = await client.v2.tweet(tweetData);

            // Log the post
            const postRecord = await prisma.post.create({
                data: {
                    accountId: accountId,
                    content: content.text,
                    mediaUrls: content.mediaUrls || [],
                    hashtags: this.extractHashtags(content.text),
                    status: 'PUBLISHED',
                    publishedAt: new Date(),
                    tweetId: tweet.data.id,
                    metadata: {
                        qualityScore: qualityCheck.qualityScore,
                        complianceScore: qualityCheck.complianceScore,
                        automationType: options.automationType || 'manual'
                    }
                }
            });

            // Update rate limiting cache
            await this.updateRateLimitCache(accountId);

            // Log automation activity
            await this.logAutomationActivity(accountId, 'post_created', {
                postId: postRecord.id,
                tweetId: tweet.data.id,
                qualityScore: qualityCheck.qualityScore
            });

            logger.info(`Successfully posted content for account ${accountId}: ${tweet.data.id}`);
            
            return {
                success: true,
                tweetId: tweet.data.id,
                postId: postRecord.id,
                qualityScore: qualityCheck.qualityScore,
                complianceScore: qualityCheck.complianceScore
            };

        } catch (error) {
            logger.error(`Failed to post content for account ${accountId}:`, error);
            
            // Log failed attempt
            await this.logAutomationActivity(accountId, 'post_failed', {
                error: error.message,
                content: content.text?.substring(0, 100)
            });

            throw error;
        }
    }

    /**
     * Perform comprehensive quality checks
     */
    async performQualityChecks(accountId, content) {
        try {
            // Get content analysis from LLM service
            const analysisResponse = await fetch(`${process.env.LLM_SERVICE_URL}/api/content/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: content.text,
                    accountId: accountId
                })
            });

            const analysis = await analysisResponse.json();

            // Quality score check
            const qualityScore = analysis.qualityScore || 0;
            if (qualityScore < this.qualityThresholds.minQualityScore) {
                return {
                    approved: false,
                    reason: `Quality score too low: ${qualityScore}`,
                    qualityScore,
                    complianceScore: analysis.complianceScore || 0
                };
            }

            // Compliance score check
            const complianceScore = analysis.complianceScore || 0;
            if (complianceScore < this.qualityThresholds.minComplianceScore) {
                return {
                    approved: false,
                    reason: `Compliance score too low: ${complianceScore}`,
                    qualityScore,
                    complianceScore
                };
            }

            // Spam detection
            if (analysis.isSpam) {
                return {
                    approved: false,
                    reason: 'Content flagged as potential spam',
                    qualityScore,
                    complianceScore
                };
            }

            // Duplicate content check
            const isDuplicate = await this.checkDuplicateContent(accountId, content.text);
            if (isDuplicate) {
                return {
                    approved: false,
                    reason: 'Duplicate content detected',
                    qualityScore,
                    complianceScore
                };
            }

            return {
                approved: true,
                reason: 'All quality checks passed',
                qualityScore,
                complianceScore
            };

        } catch (error) {
            logger.error('Quality check failed:', error);
            return {
                approved: false,
                reason: `Quality check error: ${error.message}`,
                qualityScore: 0,
                complianceScore: 0
            };
        }
    }

    /**
     * Check rate limits for account
     */
    async checkRateLimits(accountId) {
        try {
            const now = Date.now();
            const hourKey = `rate_limit:${accountId}:${Math.floor(now / (60 * 60 * 1000))}`;
            const dayKey = `rate_limit:${accountId}:${Math.floor(now / (24 * 60 * 60 * 1000))}`;
            const lastPostKey = `last_post:${accountId}`;

            // Check hourly limit
            const hourlyCount = await redis.get(hourKey) || 0;
            if (parseInt(hourlyCount) >= this.qualityThresholds.maxPostsPerHour) {
                return {
                    allowed: false,
                    reason: `Hourly limit exceeded (${hourlyCount}/${this.qualityThresholds.maxPostsPerHour})`
                };
            }

            // Check daily limit
            const dailyCount = await redis.get(dayKey) || 0;
            if (parseInt(dailyCount) >= this.qualityThresholds.maxPostsPerDay) {
                return {
                    allowed: false,
                    reason: `Daily limit exceeded (${dailyCount}/${this.qualityThresholds.maxPostsPerDay})`
                };
            }

            // Check minimum time between posts
            const lastPostTime = await redis.get(lastPostKey);
            if (lastPostTime) {
                const timeSinceLastPost = now - parseInt(lastPostTime);
                if (timeSinceLastPost < this.qualityThresholds.minTimeBetweenPosts) {
                    const waitTime = Math.ceil((this.qualityThresholds.minTimeBetweenPosts - timeSinceLastPost) / 60000);
                    return {
                        allowed: false,
                        reason: `Must wait ${waitTime} minutes between posts`
                    };
                }
            }

            return {
                allowed: true,
                reason: 'Rate limits OK',
                hourlyCount: parseInt(hourlyCount),
                dailyCount: parseInt(dailyCount)
            };

        } catch (error) {
            logger.error('Rate limit check failed:', error);
            return {
                allowed: false,
                reason: `Rate limit check error: ${error.message}`
            };
        }
    }

    /**
     * Update rate limiting cache
     */
    async updateRateLimitCache(accountId) {
        const now = Date.now();
        const hourKey = `rate_limit:${accountId}:${Math.floor(now / (60 * 60 * 1000))}`;
        const dayKey = `rate_limit:${accountId}:${Math.floor(now / (24 * 60 * 60 * 1000))}`;
        const lastPostKey = `last_post:${accountId}`;

        // Increment counters
        await redis.incr(hourKey);
        await redis.expire(hourKey, 3600); // 1 hour
        
        await redis.incr(dayKey);
        await redis.expire(dayKey, 86400); // 24 hours
        
        // Update last post time
        await redis.set(lastPostKey, now.toString());
        await redis.expire(lastPostKey, 86400); // 24 hours
    }

    /**
     * Check for duplicate content
     */
    async checkDuplicateContent(accountId, text) {
        try {
            // Check recent posts for similar content
            const recentPosts = await prisma.post.findMany({
                where: {
                    accountId: accountId,
                    publishedAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                },
                select: { content: true }
            });

            // Simple similarity check (can be enhanced with more sophisticated algorithms)
            const similarity = this.calculateTextSimilarity(text, recentPosts.map(p => p.content));
            return similarity > 0.8; // 80% similarity threshold

        } catch (error) {
            logger.error('Duplicate content check failed:', error);
            return false;
        }
    }

    /**
     * Calculate text similarity
     */
    calculateTextSimilarity(text1, textArray) {
        if (!textArray.length) return 0;

        const words1 = text1.toLowerCase().split(/\s+/);
        let maxSimilarity = 0;

        for (const text2 of textArray) {
            const words2 = text2.toLowerCase().split(/\s+/);
            const intersection = words1.filter(word => words2.includes(word));
            const union = [...new Set([...words1, ...words2])];
            const similarity = intersection.length / union.length;
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        return maxSimilarity;
    }

    /**
     * Upload media to Twitter
     */
    async uploadMedia(client, mediaUrls) {
        const mediaIds = [];
        
        for (const url of mediaUrls) {
            try {
                // Download media
                const response = await fetch(url);
                const buffer = await response.buffer();
                
                // Upload to Twitter
                const mediaId = await client.v1.uploadMedia(buffer, { 
                    mimeType: response.headers.get('content-type') 
                });
                
                mediaIds.push(mediaId);
            } catch (error) {
                logger.error(`Failed to upload media ${url}:`, error);
            }
        }
        
        return mediaIds;
    }

    /**
     * Extract hashtags from text
     */
    extractHashtags(text) {
        const hashtagRegex = /#[\w]+/g;
        return text.match(hashtagRegex) || [];
    }

    /**
     * Log automation activity
     */
    async logAutomationActivity(accountId, action, details = {}) {
        try {
            await prisma.automationLog.create({
                data: {
                    accountId: accountId,
                    action: action,
                    details: details,
                    timestamp: new Date()
                }
            });
        } catch (error) {
            logger.error('Failed to log automation activity:', error);
        }
    }

    /**
     * Start automated posting for an account
     */
    async startAutomation(accountId, config) {
        try {
            // Validate account
            const account = await prisma.xAccount.findUnique({
                where: { id: accountId },
                include: { user: true }
            });

            if (!account) {
                throw new Error('Account not found');
            }

            // Initialize client
            await this.initializeClient(accountId);

            // Create automation record
            const automation = await prisma.automation.create({
                data: {
                    accountId: accountId,
                    type: 'content_posting',
                    status: 'ACTIVE',
                    config: config,
                    schedule: config.schedule || {},
                    nextExecution: this.calculateNextExecution(config.schedule)
                }
            });

            // Start automation loop
            this.activeAutomations.set(accountId, {
                automationId: automation.id,
                config: config,
                intervalId: setInterval(() => {
                    this.executeAutomation(accountId, automation.id);
                }, config.intervalMinutes * 60 * 1000)
            });

            logger.info(`Automation started for account ${accountId}`);
            
            return {
                success: true,
                automationId: automation.id,
                message: 'Automation started successfully'
            };

        } catch (error) {
            logger.error(`Failed to start automation for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Stop automation for an account
     */
    async stopAutomation(accountId) {
        try {
            const automation = this.activeAutomations.get(accountId);
            if (automation) {
                clearInterval(automation.intervalId);
                this.activeAutomations.delete(accountId);

                // Update database
                await prisma.automation.update({
                    where: { id: automation.automationId },
                    data: { status: 'INACTIVE' }
                });

                logger.info(`Automation stopped for account ${accountId}`);
                return { success: true, message: 'Automation stopped' };
            }

            return { success: false, message: 'No active automation found' };

        } catch (error) {
            logger.error(`Failed to stop automation for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Execute automation for an account
     */
    async executeAutomation(accountId, automationId) {
        try {
            // Get automation config
            const automation = await prisma.automation.findUnique({
                where: { id: automationId }
            });

            if (!automation || automation.status !== 'ACTIVE') {
                return;
            }

            // Generate content
            const contentResponse = await fetch(`${process.env.LLM_SERVICE_URL}/api/content/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: automation.config.topic || 'general update',
                    tone: automation.config.tone || 'professional',
                    type: automation.config.contentType || 'general',
                    platform: 'twitter',
                    accountId: accountId
                })
            });

            const contentResult = await contentResponse.json();

            if (contentResult.error) {
                throw new Error(`Content generation failed: ${contentResult.error}`);
            }

            // Post the content
            const postResult = await this.postContent(accountId, {
                text: contentResult.content
            }, {
                automationType: 'scheduled'
            });

            // Update automation
            await prisma.automation.update({
                where: { id: automationId },
                data: {
                    lastExecuted: new Date(),
                    nextExecution: this.calculateNextExecution(automation.schedule)
                }
            });

            logger.info(`Automation executed successfully for account ${accountId}`);

        } catch (error) {
            logger.error(`Automation execution failed for account ${accountId}:`, error);
            
            // Log the failure
            await this.logAutomationActivity(accountId, 'automation_failed', {
                automationId: automationId,
                error: error.message
            });
        }
    }

    /**
     * Calculate next execution time
     */
    calculateNextExecution(schedule) {
        const now = new Date();
        const intervalMinutes = schedule.intervalMinutes || 60;
        return new Date(now.getTime() + intervalMinutes * 60 * 1000);
    }

    /**
     * Get automation status for account
     */
    async getAutomationStatus(accountId) {
        try {
            const automation = await prisma.automation.findFirst({
                where: {
                    accountId: accountId,
                    status: 'ACTIVE'
                }
            });

            const isActive = this.activeAutomations.has(accountId);

            // Get recent activity
            const recentLogs = await prisma.automationLog.findMany({
                where: { accountId: accountId },
                orderBy: { timestamp: 'desc' },
                take: 10
            });

            // Get rate limit status
            const rateLimitStatus = await this.checkRateLimits(accountId);

            return {
                isActive: isActive,
                automation: automation,
                recentActivity: recentLogs,
                rateLimits: rateLimitStatus,
                qualityThresholds: this.qualityThresholds
            };

        } catch (error) {
            logger.error(`Failed to get automation status for account ${accountId}:`, error);
            throw error;
        }
    }

    // ============================================================================
    // COMPREHENSIVE X/TWITTER ACTION SUITE
    // ============================================================================

    /**
     * Automated liking with intelligent targeting
     */
    async automatedLiking(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            // Get targeting criteria
            const targetingConfig = {
                keywords: config.keywords || ['crypto', 'blockchain', 'bitcoin'],
                hashtags: config.hashtags || ['#crypto', '#bitcoin', '#blockchain'],
                userTargets: config.userTargets || [],
                minFollowers: config.minFollowers || 100,
                maxFollowers: config.maxFollowers || 100000,
                engagementRate: config.minEngagementRate || 0.02,
                contentQuality: config.minContentQuality || 0.7,
                likesPerHour: config.likesPerHour || 10,
                maxLikesPerDay: config.maxLikesPerDay || 100
            };

            // Check rate limits for liking
            const rateLimitCheck = await this.checkActionRateLimit(accountId, 'like', targetingConfig.likesPerHour);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Like rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Search for target tweets
            const targetTweets = await this.findTargetTweets(client, targetingConfig);

            const likedTweets = [];
            for (const tweet of targetTweets.slice(0, targetingConfig.likesPerHour)) {
                try {
                    // Quality check the tweet before liking
                    const qualityCheck = await this.assessTweetQuality(tweet);
                    if (qualityCheck.score < targetingConfig.contentQuality) {
                        continue;
                    }

                    // Check if already liked
                    const alreadyLiked = await this.checkIfAlreadyInteracted(accountId, tweet.id, 'like');
                    if (alreadyLiked) {
                        continue;
                    }

                    // Like the tweet
                    await client.v2.like(client.currentUserId, tweet.id);

                    // Log the action
                    await this.logInteraction(accountId, tweet.id, 'like', {
                        tweetAuthor: tweet.author_id,
                        tweetText: tweet.text?.substring(0, 100),
                        qualityScore: qualityCheck.score,
                        targetingReason: qualityCheck.targetingReason
                    });

                    likedTweets.push({
                        tweetId: tweet.id,
                        author: tweet.author_id,
                        qualityScore: qualityCheck.score
                    });

                    // Human-like delay between likes
                    await this.humanLikeDelay('like');

                } catch (error) {
                    logger.error(`Failed to like tweet ${tweet.id}:`, error);
                    continue;
                }
            }

            // Update rate limit cache
            await this.updateActionRateLimit(accountId, 'like', likedTweets.length);

            return {
                success: true,
                likedCount: likedTweets.length,
                likedTweets: likedTweets,
                targetingConfig: targetingConfig
            };

        } catch (error) {
            logger.error(`Automated liking failed for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Automated commenting with AI-generated contextual responses
     */
    async automatedCommenting(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            const commentConfig = {
                keywords: config.keywords || ['crypto', 'blockchain', 'bitcoin'],
                commentTypes: config.commentTypes || ['supportive', 'informative', 'question'],
                commentsPerHour: config.commentsPerHour || 5,
                maxCommentsPerDay: config.maxCommentsPerDay || 30,
                minTweetQuality: config.minTweetQuality || 0.8,
                responseStyle: config.responseStyle || 'professional',
                maxCommentLength: config.maxCommentLength || 200
            };

            // Check rate limits
            const rateLimitCheck = await this.checkActionRateLimit(accountId, 'comment', commentConfig.commentsPerHour);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Comment rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Find target tweets for commenting
            const targetTweets = await this.findTargetTweets(client, commentConfig);

            const commentedTweets = [];
            for (const tweet of targetTweets.slice(0, commentConfig.commentsPerHour)) {
                try {
                    // Quality check
                    const qualityCheck = await this.assessTweetQuality(tweet);
                    if (qualityCheck.score < commentConfig.minTweetQuality) {
                        continue;
                    }

                    // Check if already commented
                    const alreadyCommented = await this.checkIfAlreadyInteracted(accountId, tweet.id, 'comment');
                    if (alreadyCommented) {
                        continue;
                    }

                    // Generate contextual comment using AI
                    const comment = await this.generateContextualComment(tweet, commentConfig);
                    if (!comment || comment.length < 10) {
                        continue;
                    }

                    // Quality check the generated comment
                    const commentQualityCheck = await this.performQualityChecks(accountId, { text: comment });
                    if (!commentQualityCheck.approved) {
                        continue;
                    }

                    // Post the comment
                    const commentTweet = await client.v2.reply(comment, tweet.id);

                    // Log the interaction
                    await this.logInteraction(accountId, tweet.id, 'comment', {
                        commentId: commentTweet.data.id,
                        commentText: comment,
                        originalTweetAuthor: tweet.author_id,
                        qualityScore: commentQualityCheck.qualityScore,
                        responseType: commentConfig.responseStyle
                    });

                    commentedTweets.push({
                        originalTweetId: tweet.id,
                        commentId: commentTweet.data.id,
                        commentText: comment,
                        qualityScore: commentQualityCheck.qualityScore
                    });

                    // Human-like delay
                    await this.humanLikeDelay('comment');

                } catch (error) {
                    logger.error(`Failed to comment on tweet ${tweet.id}:`, error);
                    continue;
                }
            }

            await this.updateActionRateLimit(accountId, 'comment', commentedTweets.length);

            return {
                success: true,
                commentedCount: commentedTweets.length,
                commentedTweets: commentedTweets,
                config: commentConfig
            };

        } catch (error) {
            logger.error(`Automated commenting failed for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Automated retweeting with intelligent selection
     */
    async automatedRetweeting(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            const retweetConfig = {
                keywords: config.keywords || ['crypto', 'blockchain', 'bitcoin'],
                retweetsPerHour: config.retweetsPerHour || 3,
                maxRetweetsPerDay: config.maxRetweetsPerDay || 20,
                minTweetQuality: config.minTweetQuality || 0.85,
                minEngagement: config.minEngagement || 5,
                addComment: config.addComment || false,
                commentStyle: config.commentStyle || 'supportive'
            };

            // Check rate limits
            const rateLimitCheck = await this.checkActionRateLimit(accountId, 'retweet', retweetConfig.retweetsPerHour);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Retweet rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Find high-quality tweets to retweet
            const targetTweets = await this.findHighQualityTweets(client, retweetConfig);

            const retweetedTweets = [];
            for (const tweet of targetTweets.slice(0, retweetConfig.retweetsPerHour)) {
                try {
                    // Check if already retweeted
                    const alreadyRetweeted = await this.checkIfAlreadyInteracted(accountId, tweet.id, 'retweet');
                    if (alreadyRetweeted) {
                        continue;
                    }

                    let retweetResult;
                    if (retweetConfig.addComment) {
                        // Quote tweet with comment
                        const comment = await this.generateRetweetComment(tweet, retweetConfig.commentStyle);
                        retweetResult = await client.v2.quote(comment, tweet.id);
                    } else {
                        // Simple retweet
                        retweetResult = await client.v2.retweet(client.currentUserId, tweet.id);
                    }

                    // Log the interaction
                    await this.logInteraction(accountId, tweet.id, 'retweet', {
                        retweetId: retweetResult.data?.id,
                        originalAuthor: tweet.author_id,
                        withComment: retweetConfig.addComment,
                        engagementScore: tweet.public_metrics?.like_count || 0
                    });

                    retweetedTweets.push({
                        originalTweetId: tweet.id,
                        retweetId: retweetResult.data?.id,
                        withComment: retweetConfig.addComment
                    });

                    // Human-like delay
                    await this.humanLikeDelay('retweet');

                } catch (error) {
                    logger.error(`Failed to retweet ${tweet.id}:`, error);
                    continue;
                }
            }

            await this.updateActionRateLimit(accountId, 'retweet', retweetedTweets.length);

            return {
                success: true,
                retweetedCount: retweetedTweets.length,
                retweetedTweets: retweetedTweets,
                config: retweetConfig
            };

        } catch (error) {
            logger.error(`Automated retweeting failed for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Automated following with strategic targeting
     */
    async automatedFollowing(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            const followConfig = {
                targetKeywords: config.targetKeywords || ['crypto', 'blockchain', 'bitcoin'],
                followsPerHour: config.followsPerHour || 5,
                maxFollowsPerDay: config.maxFollowsPerDay || 30,
                minFollowers: config.minFollowers || 50,
                maxFollowers: config.maxFollowers || 50000,
                minTweetCount: config.minTweetCount || 10,
                accountAge: config.minAccountAge || 30, // days
                engagementRate: config.minEngagementRate || 0.01,
                followBackRate: config.expectedFollowBackRate || 0.3
            };

            // Check rate limits
            const rateLimitCheck = await this.checkActionRateLimit(accountId, 'follow', followConfig.followsPerHour);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Follow rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Find target users to follow
            const targetUsers = await this.findTargetUsers(client, followConfig);

            const followedUsers = [];
            for (const user of targetUsers.slice(0, followConfig.followsPerHour)) {
                try {
                    // Check if already following
                    const alreadyFollowing = await this.checkIfAlreadyInteracted(accountId, user.id, 'follow');
                    if (alreadyFollowing) {
                        continue;
                    }

                    // Assess user quality
                    const userQuality = await this.assessUserQuality(user, followConfig);
                    if (userQuality.score < 0.7) {
                        continue;
                    }

                    // Follow the user
                    await client.v2.follow(client.currentUserId, user.id);

                    // Log the interaction
                    await this.logInteraction(accountId, user.id, 'follow', {
                        username: user.username,
                        followerCount: user.public_metrics?.followers_count,
                        followingCount: user.public_metrics?.following_count,
                        qualityScore: userQuality.score,
                        targetingReason: userQuality.reason
                    });

                    followedUsers.push({
                        userId: user.id,
                        username: user.username,
                        qualityScore: userQuality.score
                    });

                    // Human-like delay
                    await this.humanLikeDelay('follow');

                } catch (error) {
                    logger.error(`Failed to follow user ${user.id}:`, error);
                    continue;
                }
            }

            await this.updateActionRateLimit(accountId, 'follow', followedUsers.length);

            return {
                success: true,
                followedCount: followedUsers.length,
                followedUsers: followedUsers,
                config: followConfig
            };

        } catch (error) {
            logger.error(`Automated following failed for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Automated unfollowing with strategic management
     */
    async automatedUnfollowing(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            const unfollowConfig = {
                unfollowsPerHour: config.unfollowsPerHour || 3,
                maxUnfollowsPerDay: config.maxUnfollowsPerDay || 20,
                followBackWaitDays: config.followBackWaitDays || 7,
                inactiveThresholdDays: config.inactiveThresholdDays || 30,
                unfollowInactive: config.unfollowInactive || true,
                unfollowNonFollowBacks: config.unfollowNonFollowBacks || true,
                keepHighValueFollows: config.keepHighValueFollows || true
            };

            // Check rate limits
            const rateLimitCheck = await this.checkActionRateLimit(accountId, 'unfollow', unfollowConfig.unfollowsPerHour);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Unfollow rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Get users to potentially unfollow
            const unfollowCandidates = await this.getUnfollowCandidates(accountId, unfollowConfig);

            const unfollowedUsers = [];
            for (const user of unfollowCandidates.slice(0, unfollowConfig.unfollowsPerHour)) {
                try {
                    // Unfollow the user
                    await client.v2.unfollow(client.currentUserId, user.userId);

                    // Log the interaction
                    await this.logInteraction(accountId, user.userId, 'unfollow', {
                        username: user.username,
                        reason: user.unfollowReason,
                        followedDate: user.followedDate,
                        daysSinceFollow: user.daysSinceFollow
                    });

                    unfollowedUsers.push({
                        userId: user.userId,
                        username: user.username,
                        reason: user.unfollowReason
                    });

                    // Human-like delay
                    await this.humanLikeDelay('unfollow');

                } catch (error) {
                    logger.error(`Failed to unfollow user ${user.userId}:`, error);
                    continue;
                }
            }

            await this.updateActionRateLimit(accountId, 'unfollow', unfollowedUsers.length);

            return {
                success: true,
                unfollowedCount: unfollowedUsers.length,
                unfollowedUsers: unfollowedUsers,
                config: unfollowConfig
            };

        } catch (error) {
            logger.error(`Automated unfollowing failed for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Automated direct messaging (compliance-safe)
     */
    async automatedDirectMessaging(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            const dmConfig = {
                messagesPerHour: config.messagesPerHour || 2,
                maxMessagesPerDay: config.maxMessagesPerDay || 10,
                messageType: config.messageType || 'welcome', // welcome, follow_up, value_add
                personalizeMessages: config.personalizeMessages || true,
                onlyToFollowers: config.onlyToFollowers || true,
                waitAfterFollow: config.waitAfterFollow || 24, // hours
                messageTemplates: config.messageTemplates || this.getDefaultDMTemplates()
            };

            // Check rate limits
            const rateLimitCheck = await this.checkActionRateLimit(accountId, 'dm', dmConfig.messagesPerHour);
            if (!rateLimitCheck.allowed) {
                throw new Error(`DM rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Get target users for DMs
            const dmTargets = await this.getDMTargets(accountId, dmConfig);

            const sentMessages = [];
            for (const target of dmTargets.slice(0, dmConfig.messagesPerHour)) {
                try {
                    // Generate personalized message
                    const message = await this.generatePersonalizedDM(target, dmConfig);
                    if (!message || message.length < 10) {
                        continue;
                    }

                    // Quality check the message
                    const messageQualityCheck = await this.performQualityChecks(accountId, { text: message });
                    if (!messageQualityCheck.approved) {
                        continue;
                    }

                    // Send the DM
                    const dmResult = await client.v1.sendDm({
                        recipient_id: target.userId,
                        text: message
                    });

                    // Log the interaction
                    await this.logInteraction(accountId, target.userId, 'dm', {
                        messageId: dmResult.id,
                        messageText: message.substring(0, 100),
                        messageType: dmConfig.messageType,
                        recipientUsername: target.username,
                        qualityScore: messageQualityCheck.qualityScore
                    });

                    sentMessages.push({
                        recipientId: target.userId,
                        recipientUsername: target.username,
                        messageId: dmResult.id,
                        messageType: dmConfig.messageType
                    });

                    // Human-like delay (longer for DMs)
                    await this.humanLikeDelay('dm');

                } catch (error) {
                    logger.error(`Failed to send DM to user ${target.userId}:`, error);
                    continue;
                }
            }

            await this.updateActionRateLimit(accountId, 'dm', sentMessages.length);

            return {
                success: true,
                sentCount: sentMessages.length,
                sentMessages: sentMessages,
                config: dmConfig
            };

        } catch (error) {
            logger.error(`Automated DM failed for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Automated poll voting and engagement
     */
    async automatedPollVoting(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            const pollConfig = {
                votesPerHour: config.votesPerHour || 5,
                maxVotesPerDay: config.maxVotesPerDay || 30,
                voteStrategy: config.voteStrategy || 'intelligent', // random, intelligent, contrarian
                targetKeywords: config.targetKeywords || ['crypto', 'blockchain'],
                minPollQuality: config.minPollQuality || 0.7,
                engageAfterVote: config.engageAfterVote || true
            };

            // Check rate limits
            const rateLimitCheck = await this.checkActionRateLimit(accountId, 'poll_vote', pollConfig.votesPerHour);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Poll vote rate limit exceeded: ${rateLimitCheck.reason}`);
            }

            // Find polls to vote on
            const targetPolls = await this.findTargetPolls(client, pollConfig);

            const votedPolls = [];
            for (const poll of targetPolls.slice(0, pollConfig.votesPerHour)) {
                try {
                    // Check if already voted
                    const alreadyVoted = await this.checkIfAlreadyInteracted(accountId, poll.id, 'poll_vote');
                    if (alreadyVoted) {
                        continue;
                    }

                    // Determine vote choice based on strategy
                    const voteChoice = await this.determinePollVote(poll, pollConfig.voteStrategy);

                    // Vote on the poll (Note: Twitter API v2 doesn't support poll voting directly)
                    // This would need to be implemented via web scraping or unofficial methods
                    // For now, we'll log the intended vote

                    await this.logInteraction(accountId, poll.id, 'poll_vote', {
                        pollQuestion: poll.text?.substring(0, 100),
                        voteChoice: voteChoice,
                        strategy: pollConfig.voteStrategy,
                        pollAuthor: poll.author_id
                    });

                    // If configured, engage with the poll tweet
                    if (pollConfig.engageAfterVote) {
                        await this.engageWithPoll(client, poll, accountId);
                    }

                    votedPolls.push({
                        pollId: poll.id,
                        voteChoice: voteChoice,
                        strategy: pollConfig.voteStrategy
                    });

                    await this.humanLikeDelay('poll_vote');

                } catch (error) {
                    logger.error(`Failed to vote on poll ${poll.id}:`, error);
                    continue;
                }
            }

            await this.updateActionRateLimit(accountId, 'poll_vote', votedPolls.length);

            return {
                success: true,
                votedCount: votedPolls.length,
                votedPolls: votedPolls,
                config: pollConfig
            };

        } catch (error) {
            logger.error(`Automated poll voting failed for account ${accountId}:`, error);
            throw error;
        }
    }

    /**
     * Automated thread creation and management
     */
    async automatedThreadManagement(accountId, config = {}) {
        try {
            const client = this.clients.get(accountId) || await this.initializeClient(accountId);

            const threadConfig = {
                threadsPerDay: config.threadsPerDay || 2,
                threadTopics: config.threadTopics || ['crypto education', 'market analysis'],
                threadLength: config.threadLength || 5, // number of tweets
                threadStyle: config.threadStyle || 'educational',
                includeImages: config.includeImages || false,
                engagementOptimized: config.engagementOptimized || true
            };

            // Check if we should create a thread today
            const shouldCreateThread = await this.shouldCreateThread(accountId, threadConfig);
            if (!shouldCreateThread) {
                return { success: true, message: 'No thread creation needed today' };
            }

            // Generate thread content
            const threadContent = await this.generateThreadContent(threadConfig);
            if (!threadContent || threadContent.length < 2) {
                throw new Error('Failed to generate thread content');
            }

            // Create the thread
            const createdThread = await this.createThread(client, accountId, threadContent, threadConfig);

            return {
                success: true,
                threadId: createdThread.threadId,
                tweetCount: createdThread.tweetCount,
                threadTopic: createdThread.topic,
                config: threadConfig
            };

        } catch (error) {
            logger.error(`Automated thread management failed for account ${accountId}:`, error);
            throw error;
        }
    }

    // ============================================================================
    // HELPER METHODS FOR AUTOMATION ACTIONS
    // ============================================================================

    /**
     * Find target tweets based on criteria
     */
    async findTargetTweets(client, config) {
        try {
            const searchQuery = this.buildSearchQuery(config);
            const tweets = await client.v2.search(searchQuery, {
                max_results: 50,
                'tweet.fields': ['author_id', 'created_at', 'public_metrics', 'context_annotations'],
                'user.fields': ['public_metrics', 'verified']
            });

            return tweets.data || [];
        } catch (error) {
            logger.error('Failed to find target tweets:', error);
            return [];
        }
    }

    /**
     * Find high-quality tweets for retweeting
     */
    async findHighQualityTweets(client, config) {
        try {
            const tweets = await this.findTargetTweets(client, config);

            // Filter for high engagement
            return tweets.filter(tweet => {
                const metrics = tweet.public_metrics;
                const totalEngagement = (metrics?.like_count || 0) +
                                      (metrics?.retweet_count || 0) +
                                      (metrics?.reply_count || 0);
                return totalEngagement >= config.minEngagement;
            });
        } catch (error) {
            logger.error('Failed to find high-quality tweets:', error);
            return [];
        }
    }

    /**
     * Find target users to follow
     */
    async findTargetUsers(client, config) {
        try {
            // Search for users based on keywords
            const searchQuery = config.targetKeywords.join(' OR ');
            const searchResults = await client.v2.search(searchQuery, {
                max_results: 100,
                'user.fields': ['public_metrics', 'created_at', 'verified', 'description']
            });

            const users = [];
            for (const tweet of searchResults.data || []) {
                if (tweet.author_id) {
                    const user = await client.v2.user(tweet.author_id, {
                        'user.fields': ['public_metrics', 'created_at', 'verified', 'description']
                    });
                    if (user.data) {
                        users.push(user.data);
                    }
                }
            }

            // Filter users based on criteria
            return users.filter(user => {
                const metrics = user.public_metrics;
                return metrics?.followers_count >= config.minFollowers &&
                       metrics?.followers_count <= config.maxFollowers &&
                       metrics?.tweet_count >= config.minTweetCount;
            });

        } catch (error) {
            logger.error('Failed to find target users:', error);
            return [];
        }
    }

    /**
     * Assess tweet quality for interaction decisions
     */
    async assessTweetQuality(tweet) {
        try {
            let score = 0.5; // Base score
            const reasons = [];

            // Check engagement metrics
            const metrics = tweet.public_metrics;
            if (metrics) {
                const engagementRate = (metrics.like_count + metrics.retweet_count + metrics.reply_count) /
                                     Math.max(metrics.impression_count || 1, 1);
                if (engagementRate > 0.05) {
                    score += 0.2;
                    reasons.push('high_engagement');
                }
            }

            // Check content quality using AI
            if (tweet.text) {
                const contentAnalysis = await fetch(`${process.env.LLM_SERVICE_URL}/api/sentiment/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: tweet.text })
                });

                const analysis = await contentAnalysis.json();
                if (analysis.primary_sentiment?.label === 'positive') {
                    score += 0.15;
                    reasons.push('positive_sentiment');
                }

                // Check for spam indicators
                if (!this.containsSpamIndicators(tweet.text)) {
                    score += 0.15;
                    reasons.push('not_spam');
                }
            }

            return {
                score: Math.min(score, 1.0),
                targetingReason: reasons.join(', ')
            };

        } catch (error) {
            logger.error('Failed to assess tweet quality:', error);
            return { score: 0.5, targetingReason: 'default' };
        }
    }

    /**
     * Assess user quality for following decisions
     */
    async assessUserQuality(user, config) {
        try {
            let score = 0.5;
            const reasons = [];

            const metrics = user.public_metrics;

            // Follower to following ratio
            const ratio = metrics?.followers_count / Math.max(metrics?.following_count || 1, 1);
            if (ratio > 0.5 && ratio < 5) {
                score += 0.2;
                reasons.push('good_follow_ratio');
            }

            // Account verification
            if (user.verified) {
                score += 0.1;
                reasons.push('verified');
            }

            // Bio quality
            if (user.description && user.description.length > 20) {
                score += 0.1;
                reasons.push('complete_bio');
            }

            // Account age (if available)
            if (user.created_at) {
                const accountAge = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
                if (accountAge > config.accountAge) {
                    score += 0.1;
                    reasons.push('mature_account');
                }
            }

            return {
                score: Math.min(score, 1.0),
                reason: reasons.join(', ')
            };

        } catch (error) {
            logger.error('Failed to assess user quality:', error);
            return { score: 0.5, reason: 'default' };
        }
    }

    /**
     * Generate contextual comment using AI
     */
    async generateContextualComment(tweet, config) {
        try {
            const response = await fetch(`${process.env.LLM_SERVICE_URL}/api/content/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a ${config.responseStyle} comment for this tweet: "${tweet.text}"`,
                    max_length: config.maxCommentLength,
                    tone: config.responseStyle,
                    type: 'comment'
                })
            });

            const result = await response.json();
            return result.content || '';

        } catch (error) {
            logger.error('Failed to generate contextual comment:', error);
            return '';
        }
    }

    /**
     * Check action-specific rate limits
     */
    async checkActionRateLimit(accountId, action, requestedCount) {
        try {
            const now = Date.now();
            const hourKey = `rate_limit:${accountId}:${action}:${Math.floor(now / (60 * 60 * 1000))}`;
            const dayKey = `rate_limit:${accountId}:${action}:${Math.floor(now / (24 * 60 * 60 * 1000))}`;

            const hourlyCount = await redis.get(hourKey) || 0;
            const dailyCount = await redis.get(dayKey) || 0;

            // Action-specific limits
            const limits = this.getActionLimits(action);

            if (parseInt(hourlyCount) + requestedCount > limits.hourly) {
                return {
                    allowed: false,
                    reason: `${action} hourly limit would be exceeded`
                };
            }

            if (parseInt(dailyCount) + requestedCount > limits.daily) {
                return {
                    allowed: false,
                    reason: `${action} daily limit would be exceeded`
                };
            }

            return { allowed: true };

        } catch (error) {
            logger.error('Action rate limit check failed:', error);
            return { allowed: false, reason: 'Rate limit check error' };
        }
    }

    /**
     * Get action-specific rate limits
     */
    getActionLimits(action) {
        const limits = {
            like: { hourly: 50, daily: 500 },
            comment: { hourly: 10, daily: 100 },
            retweet: { hourly: 20, daily: 200 },
            follow: { hourly: 10, daily: 100 },
            unfollow: { hourly: 10, daily: 100 },
            dm: { hourly: 5, daily: 50 },
            poll_vote: { hourly: 10, daily: 100 }
        };

        return limits[action] || { hourly: 10, daily: 100 };
    }

    /**
     * Human-like delays between actions
     */
    async humanLikeDelay(action) {
        const delays = {
            like: { min: 2000, max: 8000 },
            comment: { min: 10000, max: 30000 },
            retweet: { min: 5000, max: 15000 },
            follow: { min: 15000, max: 45000 },
            unfollow: { min: 10000, max: 30000 },
            dm: { min: 60000, max: 180000 },
            poll_vote: { min: 5000, max: 15000 }
        };

        const actionDelay = delays[action] || { min: 5000, max: 15000 };
        const delay = Math.random() * (actionDelay.max - actionDelay.min) + actionDelay.min;

        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Check if already interacted with content
     */
    async checkIfAlreadyInteracted(accountId, targetId, interactionType) {
        try {
            const interaction = await prisma.interaction.findFirst({
                where: {
                    accountId: accountId,
                    targetId: targetId,
                    type: interactionType,
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            });

            return !!interaction;

        } catch (error) {
            logger.error('Failed to check interaction history:', error);
            return false;
        }
    }

    /**
     * Log interaction for tracking
     */
    async logInteraction(accountId, targetId, type, metadata = {}) {
        try {
            await prisma.interaction.create({
                data: {
                    accountId: accountId,
                    targetId: targetId,
                    type: type,
                    metadata: metadata,
                    createdAt: new Date()
                }
            });
        } catch (error) {
            logger.error('Failed to log interaction:', error);
        }
    }

    /**
     * Build search query for finding target content
     */
    buildSearchQuery(config) {
        const keywords = config.keywords || [];
        const hashtags = config.hashtags || [];

        let query = '';

        if (keywords.length > 0) {
            query += keywords.join(' OR ');
        }

        if (hashtags.length > 0) {
            if (query) query += ' OR ';
            query += hashtags.join(' OR ');
        }

        query += ' -is:retweet -is:reply lang:en';

        return query || 'crypto OR blockchain';
    }

    /**
     * Get comprehensive automation status for all actions
     */
    async getComprehensiveAutomationStatus(accountId) {
        try {
            const baseStatus = await this.getAutomationStatus(accountId);

            const actionStats = {};
            const actions = ['like', 'comment', 'retweet', 'follow', 'unfollow', 'dm', 'poll_vote'];

            for (const action of actions) {
                const hourKey = `rate_limit:${accountId}:${action}:${Math.floor(Date.now() / (60 * 60 * 1000))}`;
                const dayKey = `rate_limit:${accountId}:${action}:${Math.floor(Date.now() / (24 * 60 * 60 * 1000))}`;

                const hourlyCount = await redis.get(hourKey) || 0;
                const dailyCount = await redis.get(dayKey) || 0;
                const limits = this.getActionLimits(action);

                actionStats[action] = {
                    hourlyCount: parseInt(hourlyCount),
                    dailyCount: parseInt(dailyCount),
                    hourlyLimit: limits.hourly,
                    dailyLimit: limits.daily,
                    hourlyRemaining: limits.hourly - parseInt(hourlyCount),
                    dailyRemaining: limits.daily - parseInt(dailyCount)
                };
            }

            return {
                ...baseStatus,
                actionStats: actionStats,
                totalActionsToday: Object.values(actionStats).reduce((sum, stat) => sum + stat.dailyCount, 0)
            };

        } catch (error) {
            logger.error('Failed to get comprehensive automation status:', error);
            throw error;
        }
    }
}

module.exports = XAutomationService;
