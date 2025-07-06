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
}

module.exports = XAutomationService;
