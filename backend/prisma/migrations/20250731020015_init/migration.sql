-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enterprise UUID Generation using PostgreSQL 15+ built-in function
-- No extension required - gen_random_uuid() is built into PostgreSQL 13+
-- CREATE EXTENSION IF NOT EXISTS "uuid_ossp"; -- Replaced with built-in gen_random_uuid()

-- AlterTable
ALTER TABLE "automation_logs" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "action" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "accountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "automationRules" JSONB,
ADD COLUMN     "budgetLimits" JSONB,
ADD COLUMN     "complianceSettings" JSONB,
ADD COLUMN     "contentStrategy" JSONB,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "targetMetrics" JSONB,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "quotesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "text" TEXT;

-- AlterTable
ALTER TABLE "proxies" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "failureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastUsed" TIMESTAMP(3),
ADD COLUMN     "maxConcurrentConnections" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "protocol" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "proxyPoolId" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "responseTime" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rotationInterval" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "sessionDuration" INTEGER NOT NULL DEFAULT 1800,
ADD COLUMN     "stickySession" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "x_accounts" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "telegram_bots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "telegramBotId" TEXT,
    "telegramUsername" TEXT,
    "botToken" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" TIMESTAMP(3),
    "endpoint" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_metrics" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "tweetsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "deltaFollowers" INTEGER NOT NULL DEFAULT 0,
    "deltaTweets" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "growthRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "profileImageUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "joinDate" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tweet_engagement_metrics" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "retweetsCount" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "quotesCount" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tweet_engagement_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_performance_metrics" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actionType" TEXT,
    "actionCategory" TEXT,
    "responseTime" INTEGER,
    "retryCount" INTEGER,
    "status" TEXT NOT NULL,
    "executionTime" INTEGER NOT NULL DEFAULT 0,
    "detectionRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_performance_metrics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalReach" INTEGER NOT NULL DEFAULT 0,
    "totalEngagements" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_analytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_sync_log" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "syncType" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "syncVersion" INTEGER,
    "recordsProcessed" INTEGER,
    "recordsUpdated" INTEGER,
    "recordsInserted" INTEGER,
    "recordsDeleted" INTEGER,
    "errorCount" INTEGER,
    "errorDetails" JSONB,
    "metadata" JSONB,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anti_detection_audit_log" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "correlationId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anti_detection_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_time_alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "accountId" TEXT,
    "alertData" JSONB,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "real_time_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_activity_log" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "endpoint" TEXT,
    "method" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_configuration" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffMs" INTEGER NOT NULL DEFAULT 1000,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "conflictResolution" TEXT NOT NULL DEFAULT 'merge',
    "dataValidation" JSONB NOT NULL DEFAULT '{}',
    "alertThresholds" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastModified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_health_status" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "previousStatus" TEXT,
    "statusDuration" INTEGER,
    "healthScore" DOUBLE PRECISION,
    "riskLevel" TEXT,
    "lastSuccessfulAction" TIMESTAMP(3),
    "consecutiveFailures" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_health_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_performance_metrics" (
    "id" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseTime" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tweets" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tweets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "authCookies" JSONB,
    "sessionState" TEXT NOT NULL DEFAULT 'INACTIVE',
    "lastActivity" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockoutUntil" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "proxyId" TEXT,
    "fingerprintId" TEXT,
    "sessionMetadata" JSONB NOT NULL DEFAULT '{}',
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "authenticationMethod" TEXT,
    "lastAuthenticationAt" TIMESTAMP(3),
    "sessionDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twikit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "twikitUserId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "profileImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "tweetsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "listsCount" INTEGER NOT NULL DEFAULT 0,
    "joinDate" TIMESTAMP(3),
    "birthDate" TIMESTAMP(3),
    "accountType" TEXT NOT NULL DEFAULT 'PERSONAL',
    "subscriptionTier" TEXT,
    "rateLimitTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "apiAccessLevel" TEXT NOT NULL DEFAULT 'BASIC',
    "lastProfileUpdate" TIMESTAMP(3),
    "profileSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncInterval" INTEGER NOT NULL DEFAULT 3600,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twikit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_session_history" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventDetails" JSONB,
    "sessionDuration" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "proxyId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twikit_session_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_proxy_assignments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignmentReason" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "stickySession" BOOLEAN NOT NULL DEFAULT false,
    "maxDuration" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_proxy_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT,
    "city" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'HTTP',
    "authMethod" TEXT NOT NULL DEFAULT 'USER_PASS',
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 10,
    "rotationInterval" INTEGER NOT NULL DEFAULT 300,
    "healthCheckInterval" INTEGER NOT NULL DEFAULT 60,
    "healthCheckUrl" TEXT NOT NULL DEFAULT 'https://httpbin.org/ip',
    "healthCheckTimeout" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "costPerRequest" DOUBLE PRECISION,
    "monthlyLimit" INTEGER,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_usage_logs" (
    "id" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "proxyPoolId" TEXT,
    "sessionId" TEXT,
    "accountId" TEXT,
    "requestUrl" TEXT,
    "requestMethod" TEXT,
    "responseStatus" INTEGER,
    "responseTime" INTEGER,
    "bytesTransferred" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "proxyIpAddress" TEXT,
    "geolocation" JSONB,
    "requestHeaders" JSONB,
    "responseHeaders" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_rotation_schedules" (
    "id" TEXT NOT NULL,
    "proxyPoolId" TEXT NOT NULL,
    "accountId" TEXT,
    "sessionId" TEXT,
    "rotationType" TEXT NOT NULL DEFAULT 'TIME_BASED',
    "intervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "requestThreshold" INTEGER,
    "failureThreshold" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "nextRotationAt" TIMESTAMP(3),
    "lastRotationAt" TIMESTAMP(3),
    "rotationCount" INTEGER NOT NULL DEFAULT 0,
    "successfulRotations" INTEGER NOT NULL DEFAULT 0,
    "failedRotations" INTEGER NOT NULL DEFAULT 0,
    "currentProxyId" TEXT,
    "backupProxyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rotationStrategy" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_rotation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_health_metrics" (
    "id" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "proxyPoolId" TEXT,
    "healthStatus" TEXT NOT NULL,
    "responseTime" INTEGER,
    "successRate" DOUBLE PRECISION,
    "errorRate" DOUBLE PRECISION,
    "uptime" DOUBLE PRECISION,
    "throughput" DOUBLE PRECISION,
    "concurrentConnections" INTEGER,
    "lastSuccessfulRequest" TIMESTAMP(3),
    "lastFailedRequest" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "totalSuccesses" INTEGER NOT NULL DEFAULT 0,
    "totalFailures" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "minResponseTime" INTEGER,
    "maxResponseTime" INTEGER,
    "geolocation" JSONB,
    "isp" TEXT,
    "asn" TEXT,
    "checkType" TEXT NOT NULL DEFAULT 'HTTP',
    "checkUrl" TEXT,
    "checkInterval" INTEGER NOT NULL DEFAULT 60,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "rateLimitType" TEXT NOT NULL,
    "limitValue" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "windowDuration" INTEGER NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "deniedReason" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "source" TEXT NOT NULL DEFAULT 'TWIKIT',
    "instanceId" TEXT,
    "requestMetadata" JSONB,
    "responseTime" INTEGER,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "distributedLock" BOOLEAN NOT NULL DEFAULT false,
    "retryAfter" INTEGER,
    "quotaRemaining" INTEGER,
    "quotaReset" TIMESTAMP(3),
    "violationLevel" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_rate_limit_profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "twikitAccountId" TEXT,
    "profileName" TEXT NOT NULL DEFAULT 'DEFAULT',
    "accountType" TEXT NOT NULL DEFAULT 'STANDARD',
    "tierLevel" TEXT NOT NULL DEFAULT 'BASIC',
    "customLimits" JSONB NOT NULL DEFAULT '{}',
    "globalMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "burstAllowance" INTEGER NOT NULL DEFAULT 0,
    "cooldownPeriod" INTEGER NOT NULL DEFAULT 0,
    "priorityBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "adaptiveLimits" BOOLEAN NOT NULL DEFAULT false,
    "learningMode" BOOLEAN NOT NULL DEFAULT false,
    "violationThreshold" INTEGER NOT NULL DEFAULT 5,
    "suspensionThreshold" INTEGER NOT NULL DEFAULT 10,
    "resetInterval" INTEGER NOT NULL DEFAULT 3600,
    "lastViolation" TIMESTAMP(3),
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "suspensionCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuspension" TIMESTAMP(3),
    "suspensionDuration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedUntil" TIMESTAMP(3),
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "lastOptimization" TIMESTAMP(3),
    "optimizationScore" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_rate_limit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_violations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "profileId" TEXT,
    "eventId" TEXT,
    "violationType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "limitExceeded" INTEGER NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "excessAmount" INTEGER NOT NULL,
    "windowDuration" INTEGER NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "autoResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolutionAction" TEXT,
    "resolutionDuration" INTEGER,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "patternDetected" BOOLEAN NOT NULL DEFAULT false,
    "patternType" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringCount" INTEGER NOT NULL DEFAULT 0,
    "firstOccurrence" TIMESTAMP(3),
    "lastOccurrence" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_analytics" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "profileId" TEXT,
    "timeWindow" TEXT NOT NULL DEFAULT 'HOURLY',
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "allowedRequests" INTEGER NOT NULL DEFAULT 0,
    "deniedRequests" INTEGER NOT NULL DEFAULT 0,
    "allowanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "peakRequestsPerMinute" INTEGER NOT NULL DEFAULT 0,
    "uniqueActions" INTEGER NOT NULL DEFAULT 0,
    "topActions" JSONB NOT NULL DEFAULT '[]',
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "criticalViolations" INTEGER NOT NULL DEFAULT 0,
    "adaptiveAdjustments" INTEGER NOT NULL DEFAULT 0,
    "efficiencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "utilizationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "burstEvents" INTEGER NOT NULL DEFAULT 0,
    "throttleEvents" INTEGER NOT NULL DEFAULT 0,
    "cacheHitRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "distributedLockUsage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "crossInstanceEvents" INTEGER NOT NULL DEFAULT 0,
    "optimizationSuggestions" JSONB NOT NULL DEFAULT '[]',
    "performanceMetrics" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tweet_cache" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "accountId" TEXT,
    "twikitAccountId" TEXT,
    "authorId" TEXT,
    "authorUsername" TEXT,
    "authorDisplayName" TEXT,
    "content" TEXT NOT NULL,
    "htmlContent" TEXT,
    "language" TEXT,
    "createdAt" TIMESTAMP(3),
    "isRetweet" BOOLEAN NOT NULL DEFAULT false,
    "isQuoteTweet" BOOLEAN NOT NULL DEFAULT false,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "retweetCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER,
    "bookmarkCount" INTEGER,
    "isVerifiedAuthor" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inReplyToTweetId" TEXT,
    "inReplyToUserId" TEXT,
    "quotedTweetId" TEXT,
    "retweetedTweetId" TEXT,
    "conversationId" TEXT,
    "source" TEXT,
    "coordinates" JSONB,
    "placeId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "engagementRate" DOUBLE PRECISION,
    "sentimentScore" DOUBLE PRECISION,
    "topicCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "spamScore" DOUBLE PRECISION,
    "cacheReason" TEXT NOT NULL DEFAULT 'MANUAL',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tweet_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "twikitAccountId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "profileImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "isBusinessAccount" BOOLEAN NOT NULL DEFAULT false,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "tweetsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "listsCount" INTEGER NOT NULL DEFAULT 0,
    "joinDate" TIMESTAMP(3),
    "birthDate" TIMESTAMP(3),
    "pinnedTweetId" TEXT,
    "profileCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timeZone" TEXT,
    "isFollowing" BOOLEAN,
    "isFollowedBy" BOOLEAN,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "relationshipStatus" TEXT,
    "lastTweetAt" TIMESTAMP(3),
    "avgTweetsPerDay" DOUBLE PRECISION,
    "engagementRate" DOUBLE PRECISION,
    "influenceScore" DOUBLE PRECISION,
    "activityScore" DOUBLE PRECISION,
    "spamScore" DOUBLE PRECISION,
    "botScore" DOUBLE PRECISION,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "cacheReason" TEXT NOT NULL DEFAULT 'MANUAL',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncInterval" INTEGER NOT NULL DEFAULT 3600,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_logs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "twikitAccountId" TEXT,
    "sessionId" TEXT,
    "interactionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetUsername" TEXT,
    "tweetId" TEXT,
    "content" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "responseTime" INTEGER,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "campaignId" TEXT,
    "automationRuleId" TEXT,
    "proxyId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "geolocation" JSONB,
    "deviceInfo" JSONB,
    "contextData" JSONB,
    "engagementMetrics" JSONB,
    "sentimentScore" DOUBLE PRECISION,
    "spamScore" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "isUndone" BOOLEAN NOT NULL DEFAULT false,
    "undoneAt" TIMESTAMP(3),
    "undoneReason" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_queue" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "twikitAccountId" TEXT,
    "sessionId" TEXT,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastAttempt" TIMESTAMP(3),
    "nextAttempt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "postedTweetId" TEXT,
    "failureReason" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "campaignId" TEXT,
    "automationRuleId" TEXT,
    "parentTweetId" TEXT,
    "threadPosition" INTEGER,
    "threadId" TEXT,
    "isThreadStart" BOOLEAN NOT NULL DEFAULT false,
    "isThreadEnd" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "contentScore" DOUBLE PRECISION,
    "sentimentScore" DOUBLE PRECISION,
    "spamScore" DOUBLE PRECISION,
    "engagementPrediction" DOUBLE PRECISION,
    "optimalPostTime" TIMESTAMP(3),
    "audienceTargeting" JSONB,
    "geoTargeting" JSONB,
    "languageCode" TEXT,
    "contentCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdBy" TEXT,
    "lastModifiedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_operation_logs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "sessionId" TEXT,
    "operationType" TEXT NOT NULL,
    "operationCategory" TEXT NOT NULL DEFAULT 'INTERACTION',
    "method" TEXT,
    "endpoint" TEXT,
    "requestData" JSONB,
    "responseData" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "duration" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimited" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitReason" TEXT,
    "proxyId" TEXT,
    "proxyIpAddress" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "instanceId" TEXT,
    "processId" TEXT,
    "threadId" TEXT,
    "correlationId" TEXT,
    "parentOperationId" TEXT,
    "operationDepth" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL DEFAULT 'TWIKIT',
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "version" TEXT,
    "buildId" TEXT,
    "deploymentId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twikit_operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricCategory" TEXT NOT NULL DEFAULT 'SYSTEM',
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "metricUnit" TEXT NOT NULL DEFAULT 'COUNT',
    "aggregationType" TEXT NOT NULL DEFAULT 'INSTANT',
    "timeWindow" TEXT,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "accountId" TEXT,
    "sessionId" TEXT,
    "instanceId" TEXT,
    "componentName" TEXT,
    "operationType" TEXT,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "threshold" DOUBLE PRECISION,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "alertLevel" TEXT,
    "alertMessage" TEXT,
    "previousValue" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "trend" TEXT,
    "anomalyScore" DOUBLE PRECISION,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "correlatedMetrics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorCategory" TEXT NOT NULL DEFAULT 'APPLICATION',
    "errorCode" TEXT,
    "errorMessage" TEXT NOT NULL,
    "errorStack" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "source" TEXT NOT NULL DEFAULT 'TWIKIT',
    "component" TEXT,
    "method" TEXT,
    "fileName" TEXT,
    "lineNumber" INTEGER,
    "accountId" TEXT,
    "sessionId" TEXT,
    "operationId" TEXT,
    "correlationId" TEXT,
    "instanceId" TEXT,
    "processId" TEXT,
    "threadId" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestUrl" TEXT,
    "requestMethod" TEXT,
    "requestHeaders" JSONB,
    "requestBody" JSONB,
    "responseStatus" INTEGER,
    "responseHeaders" JSONB,
    "responseBody" JSONB,
    "contextData" JSONB,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "version" TEXT,
    "buildId" TEXT,
    "deploymentId" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringCount" INTEGER NOT NULL DEFAULT 1,
    "firstOccurrence" TIMESTAMP(3),
    "lastOccurrence" TIMESTAMP(3),
    "impactLevel" TEXT,
    "affectedUsers" INTEGER NOT NULL DEFAULT 0,
    "affectedSessions" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_health" (
    "id" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentType" TEXT NOT NULL DEFAULT 'SERVICE',
    "healthStatus" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "availability" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "responseTime" INTEGER,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "throughput" DOUBLE PRECISION,
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "diskUsage" DOUBLE PRECISION,
    "networkLatency" INTEGER,
    "activeConnections" INTEGER,
    "queueSize" INTEGER,
    "lastSuccessfulCheck" TIMESTAMP(3),
    "lastFailedCheck" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSuccesses" INTEGER NOT NULL DEFAULT 0,
    "checkInterval" INTEGER NOT NULL DEFAULT 60,
    "nextCheckAt" TIMESTAMP(3),
    "alertThresholds" JSONB NOT NULL DEFAULT '{}',
    "isAlerting" BOOLEAN NOT NULL DEFAULT false,
    "alertLevel" TEXT,
    "alertMessage" TEXT,
    "alertsSent" INTEGER NOT NULL DEFAULT 0,
    "lastAlertAt" TIMESTAMP(3),
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dependents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" TEXT,
    "buildId" TEXT,
    "deploymentId" TEXT,
    "instanceId" TEXT,
    "region" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "tags" JSONB NOT NULL DEFAULT '{}',
    "customMetrics" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_profiles" (
    "id" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "accountId" TEXT,
    "profileType" TEXT NOT NULL DEFAULT 'HUMAN_LIKE',
    "deviceCategory" TEXT NOT NULL DEFAULT 'DESKTOP',
    "operatingSystem" TEXT NOT NULL DEFAULT 'Windows',
    "browserType" TEXT NOT NULL DEFAULT 'Chrome',
    "browserVersion" TEXT NOT NULL DEFAULT '120.0.0.0',
    "userAgent" TEXT NOT NULL,
    "screenResolution" TEXT NOT NULL DEFAULT '1920x1080',
    "colorDepth" INTEGER NOT NULL DEFAULT 24,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "languages" TEXT[] DEFAULT ARRAY['en-US', 'en']::TEXT[],
    "platform" TEXT NOT NULL DEFAULT 'Win32',
    "hardwareConcurrency" INTEGER NOT NULL DEFAULT 8,
    "deviceMemory" INTEGER NOT NULL DEFAULT 8,
    "maxTouchPoints" INTEGER NOT NULL DEFAULT 0,
    "cookieEnabled" BOOLEAN NOT NULL DEFAULT true,
    "doNotTrack" TEXT DEFAULT '1',
    "plugins" JSONB NOT NULL DEFAULT '[]',
    "mimeTypes" JSONB NOT NULL DEFAULT '[]',
    "geolocation" JSONB,
    "connectionType" TEXT,
    "effectiveType" TEXT,
    "downlink" DOUBLE PRECISION,
    "rtt" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "detectionScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "profileConsistency" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "agingFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "identity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fingerprint_profiles" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "fingerprintType" TEXT NOT NULL,
    "fingerprintData" JSONB NOT NULL,
    "spoofingMethod" TEXT NOT NULL,
    "consistencyKey" TEXT,
    "generationSeed" TEXT,
    "validityPeriod" INTEGER NOT NULL DEFAULT 86400,
    "lastGenerated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "detectionEvents" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fingerprint_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavior_patterns" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "patternName" TEXT NOT NULL,
    "patternData" JSONB NOT NULL,
    "timeOfDay" TEXT,
    "dayOfWeek" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minInterval" INTEGER NOT NULL DEFAULT 1000,
    "maxInterval" INTEGER NOT NULL DEFAULT 60000,
    "burstProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "fatigueRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "attentionSpan" INTEGER NOT NULL DEFAULT 1800,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "scrollSpeed" JSONB NOT NULL DEFAULT '{}',
    "mouseMovement" JSONB NOT NULL DEFAULT '{}',
    "typingSpeed" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "lastUsed" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "behavior_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_events" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT,
    "sessionId" TEXT,
    "accountId" TEXT,
    "detectionType" TEXT NOT NULL,
    "detectionSource" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidence" DOUBLE PRECISION DEFAULT 0.0,
    "detectionMethod" TEXT,
    "detectionData" JSONB,
    "responseAction" TEXT,
    "wasEvaded" BOOLEAN NOT NULL DEFAULT false,
    "evasionMethod" TEXT,
    "impactScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "recoveryTime" INTEGER,
    "falsePositive" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "proxyId" TEXT,
    "url" TEXT,
    "requestHeaders" JSONB,
    "responseHeaders" JSONB,
    "responseBody" TEXT,
    "correlationId" TEXT,
    "instanceId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_session_assignments" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignmentReason" TEXT,
    "consistency" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "deviationCount" INTEGER NOT NULL DEFAULT 0,
    "lastDeviation" TIMESTAMP(3),
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_session_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_triggers" (
    "id" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "thresholds" JSONB NOT NULL DEFAULT '{}',
    "stopLevel" TEXT NOT NULL DEFAULT 'GRACEFUL',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "targetServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notificationChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "accountId" TEXT,
    "stopLevel" TEXT NOT NULL,
    "triggerData" JSONB NOT NULL DEFAULT '{}',
    "affectedServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correlationId" TEXT NOT NULL,
    "executionStartTime" TIMESTAMP(3) NOT NULL,
    "executionEndTime" TIMESTAMP(3),
    "executionDuration" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "recoveryStartTime" TIMESTAMP(3),
    "recoveryEndTime" TIMESTAMP(3),
    "recoveryDuration" INTEGER,
    "recoverySuccess" BOOLEAN NOT NULL DEFAULT false,
    "recoveryErrorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_procedures" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "procedureType" TEXT NOT NULL,
    "targetServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steps" JSONB NOT NULL DEFAULT '[]',
    "prerequisites" JSONB NOT NULL DEFAULT '{}',
    "validationChecks" JSONB NOT NULL DEFAULT '[]',
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 300,
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryDelaySeconds" INTEGER NOT NULL DEFAULT 30,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgExecutionTime" INTEGER NOT NULL DEFAULT 0,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "successfulExecutions" INTEGER NOT NULL DEFAULT 0,
    "failedExecutions" INTEGER NOT NULL DEFAULT 0,
    "lastExecuted" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_metrics" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "twikit_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_alert_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twikit_alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_alert_channels" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twikit_alert_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_escalation_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggers" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twikit_escalation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twikit_alerts" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "twikit_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_audit_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "complianceFramework" TEXT NOT NULL,
    "userId" TEXT,
    "accountId" TEXT,
    "sessionId" TEXT,
    "sourceIp" TEXT,
    "userAgent" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "complianceRelevant" BOOLEAN NOT NULL DEFAULT true,
    "retentionUntil" TIMESTAMP(3),
    "hashSignature" TEXT NOT NULL,
    "previousHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reports" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "complianceFramework" TEXT NOT NULL,
    "reportPeriod" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "reportData" JSONB NOT NULL DEFAULT '{}',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "violations" JSONB NOT NULL DEFAULT '{}',
    "recommendations" JSONB NOT NULL DEFAULT '{}',
    "generatedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "filePath" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "complianceFramework" TEXT NOT NULL,
    "retentionPeriod" INTEGER NOT NULL,
    "purgeMethod" TEXT NOT NULL DEFAULT 'SOFT_DELETE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "legalBasis" TEXT,
    "dataCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exceptions" JSONB NOT NULL DEFAULT '{}',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastReviewed" TIMESTAMP(3),
    "nextReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_violations" (
    "id" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "complianceFramework" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedUsers" INTEGER NOT NULL DEFAULT 0,
    "affectedRecords" INTEGER NOT NULL DEFAULT 0,
    "dataTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rootCause" TEXT,
    "remediation" TEXT,
    "preventiveMeasures" TEXT,
    "reportedBy" TEXT,
    "assignedTo" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "regulatoryReported" BOOLEAN NOT NULL DEFAULT false,
    "regulatoryReportDate" TIMESTAMP(3),
    "fineAmount" DECIMAL(65,30),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "complianceFramework" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "userId" TEXT,
    "requestorEmail" TEXT NOT NULL,
    "requestorName" TEXT,
    "verificationMethod" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "dataSubject" TEXT,
    "requestDetails" JSONB NOT NULL DEFAULT '{}',
    "dataInventory" JSONB NOT NULL DEFAULT '{}',
    "actionsPerformed" JSONB NOT NULL DEFAULT '{}',
    "responseData" JSONB NOT NULL DEFAULT '{}',
    "rejectionReason" TEXT,
    "processedBy" TEXT,
    "reviewedBy" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "responseDelivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveryMethod" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_jobs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourcePath" TEXT,
    "destinationPath" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "compressionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "encryptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "encryptionKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "notificationChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_executions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "backupSize" BIGINT,
    "compressedSize" BIGINT,
    "compressionRatio" DOUBLE PRECISION,
    "backupPath" TEXT,
    "checksum" TEXT,
    "errorMessage" TEXT,
    "errorDetails" JSONB DEFAULT '{}',
    "recoveryTested" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "testResults" JSONB DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "backup_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_recovery_plans" (
    "id" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rtoMinutes" INTEGER NOT NULL,
    "rpoMinutes" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "recoveryPhases" JSONB NOT NULL DEFAULT '{}',
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prerequisites" JSONB NOT NULL DEFAULT '{}',
    "notificationChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalationPolicy" JSONB NOT NULL DEFAULT '{}',
    "lastTestedAt" TIMESTAMP(3),
    "testResults" JSONB DEFAULT '{}',
    "testFrequencyDays" INTEGER NOT NULL DEFAULT 90,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disaster_recovery_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_recovery_executions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "currentPhase" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "actualRto" INTEGER,
    "actualRpo" INTEGER,
    "dataLoss" BOOLEAN NOT NULL DEFAULT false,
    "dataLossAmount" TEXT,
    "successRate" DOUBLE PRECISION,
    "phaseResults" JSONB NOT NULL DEFAULT '{}',
    "errorMessages" JSONB NOT NULL DEFAULT '{}',
    "rollbackRequired" BOOLEAN NOT NULL DEFAULT false,
    "rollbackCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lessonsLearned" TEXT,
    "improvements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disaster_recovery_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replication_configs" (
    "id" TEXT NOT NULL,
    "configName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceEndpoint" TEXT NOT NULL,
    "targetEndpoint" TEXT NOT NULL,
    "replicationType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoFailover" BOOLEAN NOT NULL DEFAULT false,
    "failoverThreshold" INTEGER NOT NULL DEFAULT 300,
    "replicationLag" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "syncFrequency" INTEGER NOT NULL DEFAULT 60,
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthCheck" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replication_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replication_events" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventStatus" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "replicationLag" INTEGER,
    "dataSize" BIGINT,
    "duration" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replication_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failover_configs" (
    "id" TEXT NOT NULL,
    "configName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "primaryEndpoint" TEXT NOT NULL,
    "secondaryEndpoint" TEXT NOT NULL,
    "healthCheckUrl" TEXT,
    "healthCheckInterval" INTEGER NOT NULL DEFAULT 30,
    "failoverThreshold" INTEGER NOT NULL DEFAULT 3,
    "autoFailover" BOOLEAN NOT NULL DEFAULT true,
    "autoFailback" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentPrimary" TEXT NOT NULL,
    "lastFailover" TIMESTAMP(3),
    "failoverCount" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "notificationChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failover_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failover_events" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromEndpoint" TEXT NOT NULL,
    "toEndpoint" TEXT NOT NULL,
    "triggerReason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "downtime" INTEGER,
    "errorMessage" TEXT,
    "rollbackRequired" BOOLEAN NOT NULL DEFAULT false,
    "affectedUsers" INTEGER,
    "dataLoss" BOOLEAN NOT NULL DEFAULT false,
    "serviceImpact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failover_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_telegramBotId_key" ON "telegram_bots"("telegramBotId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_telegramUsername_key" ON "telegram_bots"("telegramUsername");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_botToken_key" ON "telegram_bots"("botToken");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_apiKey_key" ON "telegram_bots"("apiKey");

-- CreateIndex
CREATE INDEX "idx_account_metrics_account_id" ON "account_metrics"("accountId");

-- CreateIndex
CREATE INDEX "idx_account_metrics_user_id" ON "account_metrics"("userId");

-- CreateIndex
CREATE INDEX "idx_account_metrics_created_at" ON "account_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "idx_tweet_engagement_tweet_id" ON "tweet_engagement_metrics"("tweetId");

-- CreateIndex
CREATE INDEX "idx_tweet_engagement_post_id" ON "tweet_engagement_metrics"("postId");

-- CreateIndex
CREATE INDEX "idx_tweet_engagement_account_id" ON "tweet_engagement_metrics"("accountId");

-- CreateIndex
CREATE INDEX "idx_tweet_engagement_created_at" ON "tweet_engagement_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "idx_automation_performance_automation_id" ON "automation_performance_metrics"("automationId");

-- CreateIndex
CREATE INDEX "idx_automation_performance_account_id" ON "automation_performance_metrics"("accountId");

-- CreateIndex
CREATE INDEX "idx_automation_performance_status" ON "automation_performance_metrics"("status");

-- CreateIndex
CREATE INDEX "idx_automation_performance_created_at" ON "automation_performance_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "idx_campaign_performance_campaign_id" ON "campaign_performance_metrics"("campaignId");

-- CreateIndex
CREATE INDEX "idx_campaign_performance_user_id" ON "campaign_performance_metrics"("userId");

-- CreateIndex
CREATE INDEX "idx_campaign_performance_created_at" ON "campaign_performance_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "idx_behavioral_analytics_user_id" ON "behavioral_analytics"("userId");

-- CreateIndex
CREATE INDEX "idx_behavioral_analytics_account_id" ON "behavioral_analytics"("accountId");

-- CreateIndex
CREATE INDEX "idx_behavioral_analytics_action_type" ON "behavioral_analytics"("actionType");

-- CreateIndex
CREATE INDEX "idx_behavioral_analytics_created_at" ON "behavioral_analytics"("createdAt");

-- CreateIndex
CREATE INDEX "idx_account_sync_log_account_id" ON "account_sync_log"("accountId");

-- CreateIndex
CREATE INDEX "idx_account_sync_log_status" ON "account_sync_log"("status");

-- CreateIndex
CREATE INDEX "idx_account_sync_log_created_at" ON "account_sync_log"("createdAt");

-- CreateIndex
CREATE INDEX "idx_anti_detection_audit_log_account_id" ON "anti_detection_audit_log"("accountId");

-- CreateIndex
CREATE INDEX "idx_anti_detection_audit_log_action" ON "anti_detection_audit_log"("action");

-- CreateIndex
CREATE INDEX "idx_anti_detection_audit_log_risk_score" ON "anti_detection_audit_log"("riskScore");

-- CreateIndex
CREATE INDEX "idx_anti_detection_audit_log_created_at" ON "anti_detection_audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "idx_real_time_alert_user_id" ON "real_time_alert"("userId");

-- CreateIndex
CREATE INDEX "idx_real_time_alert_alert_type" ON "real_time_alert"("alertType");

-- CreateIndex
CREATE INDEX "idx_real_time_alert_severity" ON "real_time_alert"("severity");

-- CreateIndex
CREATE INDEX "idx_real_time_alert_status" ON "real_time_alert"("status");

-- CreateIndex
CREATE INDEX "idx_real_time_alert_created_at" ON "real_time_alert"("createdAt");

-- CreateIndex
CREATE INDEX "idx_bot_activity_log_bot_id" ON "bot_activity_log"("botId");

-- CreateIndex
CREATE INDEX "idx_bot_activity_log_action" ON "bot_activity_log"("action");

-- CreateIndex
CREATE INDEX "idx_bot_activity_log_created_at" ON "bot_activity_log"("createdAt");

-- CreateIndex
CREATE INDEX "idx_sync_configuration_account_id" ON "sync_configuration"("accountId");

-- CreateIndex
CREATE INDEX "idx_sync_configuration_sync_type" ON "sync_configuration"("syncType");

-- CreateIndex
CREATE INDEX "idx_account_health_status_account_id" ON "account_health_status"("accountId");

-- CreateIndex
CREATE INDEX "idx_account_health_status_status" ON "account_health_status"("status");

-- CreateIndex
CREATE INDEX "idx_proxy_performance_metrics_proxy_id" ON "proxy_performance_metrics"("proxyId");

-- CreateIndex
CREATE INDEX "idx_proxy_performance_metrics_timestamp" ON "proxy_performance_metrics"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "tweets_tweetId_key" ON "tweets"("tweetId");

-- CreateIndex
CREATE INDEX "idx_tweet_tweet_id" ON "tweets"("tweetId");

-- CreateIndex
CREATE INDEX "idx_tweet_account_id" ON "tweets"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "twikit_sessions_sessionToken_key" ON "twikit_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_account_id" ON "twikit_sessions"("accountId");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_state" ON "twikit_sessions"("sessionState");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_last_activity" ON "twikit_sessions"("lastActivity");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_expires_at" ON "twikit_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_authenticated" ON "twikit_sessions"("isAuthenticated");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_proxy_id" ON "twikit_sessions"("proxyId");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_ip_address" ON "twikit_sessions"("ipAddress");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_account_state" ON "twikit_sessions"("accountId", "sessionState");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_state_activity" ON "twikit_sessions"("sessionState", "lastActivity");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_auth_expires" ON "twikit_sessions"("isAuthenticated", "expiresAt");

-- CreateIndex
CREATE INDEX "idx_twikit_sessions_proxy_state" ON "twikit_sessions"("proxyId", "sessionState");

-- CreateIndex
CREATE UNIQUE INDEX "twikit_accounts_accountId_key" ON "twikit_accounts"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "twikit_accounts_twikitUserId_key" ON "twikit_accounts"("twikitUserId");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_account_id" ON "twikit_accounts"("accountId");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_twikit_user_id" ON "twikit_accounts"("twikitUserId");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_username" ON "twikit_accounts"("username");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_verified" ON "twikit_accounts"("isVerified");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_type" ON "twikit_accounts"("accountType");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_rate_limit_tier" ON "twikit_accounts"("rateLimitTier");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_last_update" ON "twikit_accounts"("lastProfileUpdate");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_type_tier" ON "twikit_accounts"("accountType", "rateLimitTier");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_verified_type" ON "twikit_accounts"("isVerified", "accountType");

-- CreateIndex
CREATE INDEX "idx_twikit_accounts_sync_config" ON "twikit_accounts"("profileSyncEnabled", "autoSyncInterval");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_session_id" ON "twikit_session_history"("sessionId");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_account_id" ON "twikit_session_history"("accountId");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_event" ON "twikit_session_history"("event");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_timestamp" ON "twikit_session_history"("timestamp");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_success" ON "twikit_session_history"("success");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_proxy_id" ON "twikit_session_history"("proxyId");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_account_event" ON "twikit_session_history"("accountId", "event");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_event_success" ON "twikit_session_history"("event", "success");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_timestamp_event" ON "twikit_session_history"("timestamp", "event");

-- CreateIndex
CREATE INDEX "idx_twikit_session_history_session_timestamp" ON "twikit_session_history"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_session_id" ON "session_proxy_assignments"("sessionId");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_proxy_id" ON "session_proxy_assignments"("proxyId");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_active" ON "session_proxy_assignments"("isActive");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_assigned_at" ON "session_proxy_assignments"("assignedAt");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_last_used" ON "session_proxy_assignments"("lastUsed");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_session_active" ON "session_proxy_assignments"("sessionId", "isActive");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_proxy_active" ON "session_proxy_assignments"("proxyId", "isActive");

-- CreateIndex
CREATE INDEX "idx_session_proxy_assignment_active_priority" ON "session_proxy_assignments"("isActive", "priority");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_provider" ON "proxy_pools"("provider");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_region" ON "proxy_pools"("region");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_country" ON "proxy_pools"("country");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_active" ON "proxy_pools"("isActive");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_health_status" ON "proxy_pools"("healthStatus");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_priority" ON "proxy_pools"("priority");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_last_health_check" ON "proxy_pools"("lastHealthCheck");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_active_priority" ON "proxy_pools"("isActive", "priority");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_provider_region" ON "proxy_pools"("provider", "region");

-- CreateIndex
CREATE INDEX "idx_proxy_pools_health_active" ON "proxy_pools"("healthStatus", "isActive");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_proxy_id" ON "proxy_usage_logs"("proxyId");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_pool_id" ON "proxy_usage_logs"("proxyPoolId");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_session_id" ON "proxy_usage_logs"("sessionId");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_account_id" ON "proxy_usage_logs"("accountId");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_timestamp" ON "proxy_usage_logs"("timestamp");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_success" ON "proxy_usage_logs"("success");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_response_status" ON "proxy_usage_logs"("responseStatus");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_proxy_timestamp" ON "proxy_usage_logs"("proxyId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_proxy_success" ON "proxy_usage_logs"("proxyId", "success");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_timestamp_success" ON "proxy_usage_logs"("timestamp", "success");

-- CreateIndex
CREATE INDEX "idx_proxy_usage_log_pool_timestamp" ON "proxy_usage_logs"("proxyPoolId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_pool_id" ON "proxy_rotation_schedules"("proxyPoolId");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_account_id" ON "proxy_rotation_schedules"("accountId");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_session_id" ON "proxy_rotation_schedules"("sessionId");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_active" ON "proxy_rotation_schedules"("isActive");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_next_rotation" ON "proxy_rotation_schedules"("nextRotationAt");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_type" ON "proxy_rotation_schedules"("rotationType");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_active_next" ON "proxy_rotation_schedules"("isActive", "nextRotationAt");

-- CreateIndex
CREATE INDEX "idx_proxy_rotation_schedule_pool_active" ON "proxy_rotation_schedules"("proxyPoolId", "isActive");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_proxy_id" ON "proxy_health_metrics"("proxyId");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_pool_id" ON "proxy_health_metrics"("proxyPoolId");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_status" ON "proxy_health_metrics"("healthStatus");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_timestamp" ON "proxy_health_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_response_time" ON "proxy_health_metrics"("responseTime");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_success_rate" ON "proxy_health_metrics"("successRate");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_proxy_timestamp" ON "proxy_health_metrics"("proxyId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_status_timestamp" ON "proxy_health_metrics"("healthStatus", "timestamp");

-- CreateIndex
CREATE INDEX "idx_proxy_health_metrics_pool_status" ON "proxy_health_metrics"("proxyPoolId", "healthStatus");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_account_id" ON "rate_limit_events"("accountId");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_session_id" ON "rate_limit_events"("sessionId");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_action" ON "rate_limit_events"("action");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_type" ON "rate_limit_events"("rateLimitType");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_timestamp" ON "rate_limit_events"("timestamp");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_allowed" ON "rate_limit_events"("allowed");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_window_start" ON "rate_limit_events"("windowStart");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_window_end" ON "rate_limit_events"("windowEnd");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_account_action" ON "rate_limit_events"("accountId", "action");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_account_timestamp" ON "rate_limit_events"("accountId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_action_allowed" ON "rate_limit_events"("action", "allowed");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_type_timestamp" ON "rate_limit_events"("rateLimitType", "timestamp");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_allowed_timestamp" ON "rate_limit_events"("allowed", "timestamp");

-- CreateIndex
CREATE INDEX "idx_rate_limit_events_window_range" ON "rate_limit_events"("windowStart", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "account_rate_limit_profiles_accountId_key" ON "account_rate_limit_profiles"("accountId");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_account_id" ON "account_rate_limit_profiles"("accountId");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_twikit_account_id" ON "account_rate_limit_profiles"("twikitAccountId");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_account_type" ON "account_rate_limit_profiles"("accountType");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_tier_level" ON "account_rate_limit_profiles"("tierLevel");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_active" ON "account_rate_limit_profiles"("isActive");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_suspended" ON "account_rate_limit_profiles"("isSuspended");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_suspended_until" ON "account_rate_limit_profiles"("suspendedUntil");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_last_violation" ON "account_rate_limit_profiles"("lastViolation");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_type_tier" ON "account_rate_limit_profiles"("accountType", "tierLevel");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_active_suspended" ON "account_rate_limit_profiles"("isActive", "isSuspended");

-- CreateIndex
CREATE INDEX "idx_account_rate_limit_profile_violations" ON "account_rate_limit_profiles"("violationCount", "suspensionCount");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_account_id" ON "rate_limit_violations"("accountId");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_profile_id" ON "rate_limit_violations"("profileId");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_event_id" ON "rate_limit_violations"("eventId");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_type" ON "rate_limit_violations"("violationType");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_action" ON "rate_limit_violations"("action");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_severity" ON "rate_limit_violations"("severity");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_timestamp" ON "rate_limit_violations"("timestamp");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_auto_resolved" ON "rate_limit_violations"("autoResolved");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_recurring" ON "rate_limit_violations"("isRecurring");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_account_type" ON "rate_limit_violations"("accountId", "violationType");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_severity_timestamp" ON "rate_limit_violations"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_action_severity" ON "rate_limit_violations"("action", "severity");

-- CreateIndex
CREATE INDEX "idx_rate_limit_violations_recurring_count" ON "rate_limit_violations"("isRecurring", "recurringCount");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_account_id" ON "rate_limit_analytics"("accountId");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_profile_id" ON "rate_limit_analytics"("profileId");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_time_window" ON "rate_limit_analytics"("timeWindow");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_window_start" ON "rate_limit_analytics"("windowStart");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_window_end" ON "rate_limit_analytics"("windowEnd");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_created_at" ON "rate_limit_analytics"("createdAt");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_account_window" ON "rate_limit_analytics"("accountId", "timeWindow");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_window_start_time" ON "rate_limit_analytics"("timeWindow", "windowStart");

-- CreateIndex
CREATE INDEX "idx_rate_limit_analytics_window_range" ON "rate_limit_analytics"("windowStart", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "tweet_cache_tweetId_key" ON "tweet_cache"("tweetId");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_tweet_id" ON "tweet_cache"("tweetId");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_account_id" ON "tweet_cache"("accountId");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_twikit_account_id" ON "tweet_cache"("twikitAccountId");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_author_id" ON "tweet_cache"("authorId");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_author_username" ON "tweet_cache"("authorUsername");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_created_at" ON "tweet_cache"("createdAt");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_cached_at" ON "tweet_cache"("cachedAt");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_expires_at" ON "tweet_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_last_accessed" ON "tweet_cache"("lastAccessed");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_reason" ON "tweet_cache"("cacheReason");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_is_retweet" ON "tweet_cache"("isRetweet");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_has_media" ON "tweet_cache"("hasMedia");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_author_created" ON "tweet_cache"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_account_cached" ON "tweet_cache"("accountId", "cachedAt");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_reason_cached" ON "tweet_cache"("cacheReason", "cachedAt");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_expires_cached" ON "tweet_cache"("expiresAt", "cachedAt");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_hashtags" ON "tweet_cache"("hashtags");

-- CreateIndex
CREATE INDEX "idx_tweet_cache_topics" ON "tweet_cache"("topicCategories");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_cache_userId_key" ON "user_profile_cache"("userId");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_user_id" ON "user_profile_cache"("userId");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_account_id" ON "user_profile_cache"("accountId");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_twikit_account_id" ON "user_profile_cache"("twikitAccountId");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_username" ON "user_profile_cache"("username");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_verified" ON "user_profile_cache"("isVerified");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_protected" ON "user_profile_cache"("isProtected");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_followers" ON "user_profile_cache"("followersCount");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_cached_at" ON "user_profile_cache"("cachedAt");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_expires_at" ON "user_profile_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_last_accessed" ON "user_profile_cache"("lastAccessed");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_reason" ON "user_profile_cache"("cacheReason");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_relationship" ON "user_profile_cache"("relationshipStatus");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_account_relationship" ON "user_profile_cache"("accountId", "relationshipStatus");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_reason_cached" ON "user_profile_cache"("cacheReason", "cachedAt");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_verified_followers" ON "user_profile_cache"("isVerified", "followersCount");

-- CreateIndex
CREATE INDEX "idx_user_profile_cache_sync_config" ON "user_profile_cache"("syncEnabled", "lastSyncAt");

-- CreateIndex
CREATE INDEX "idx_interaction_log_account_id" ON "interaction_logs"("accountId");

-- CreateIndex
CREATE INDEX "idx_interaction_log_twikit_account_id" ON "interaction_logs"("twikitAccountId");

-- CreateIndex
CREATE INDEX "idx_interaction_log_session_id" ON "interaction_logs"("sessionId");

-- CreateIndex
CREATE INDEX "idx_interaction_log_type" ON "interaction_logs"("interactionType");

-- CreateIndex
CREATE INDEX "idx_interaction_log_target_type" ON "interaction_logs"("targetType");

-- CreateIndex
CREATE INDEX "idx_interaction_log_target_id" ON "interaction_logs"("targetId");

-- CreateIndex
CREATE INDEX "idx_interaction_log_target_user_id" ON "interaction_logs"("targetUserId");

-- CreateIndex
CREATE INDEX "idx_interaction_log_tweet_id" ON "interaction_logs"("tweetId");

-- CreateIndex
CREATE INDEX "idx_interaction_log_timestamp" ON "interaction_logs"("timestamp");

-- CreateIndex
CREATE INDEX "idx_interaction_log_success" ON "interaction_logs"("success");

-- CreateIndex
CREATE INDEX "idx_interaction_log_rate_limited" ON "interaction_logs"("rateLimited");

-- CreateIndex
CREATE INDEX "idx_interaction_log_source" ON "interaction_logs"("source");

-- CreateIndex
CREATE INDEX "idx_interaction_log_campaign_id" ON "interaction_logs"("campaignId");

-- CreateIndex
CREATE INDEX "idx_interaction_log_scheduled_for" ON "interaction_logs"("scheduledFor");

-- CreateIndex
CREATE INDEX "idx_interaction_log_executed_at" ON "interaction_logs"("executedAt");

-- CreateIndex
CREATE INDEX "idx_interaction_log_account_type" ON "interaction_logs"("accountId", "interactionType");

-- CreateIndex
CREATE INDEX "idx_interaction_log_account_timestamp" ON "interaction_logs"("accountId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_interaction_log_type_success" ON "interaction_logs"("interactionType", "success");

-- CreateIndex
CREATE INDEX "idx_interaction_log_timestamp_success" ON "interaction_logs"("timestamp", "success");

-- CreateIndex
CREATE INDEX "idx_interaction_log_source_timestamp" ON "interaction_logs"("source", "timestamp");

-- CreateIndex
CREATE INDEX "idx_interaction_log_campaign_timestamp" ON "interaction_logs"("campaignId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_content_queue_account_id" ON "content_queue"("accountId");

-- CreateIndex
CREATE INDEX "idx_content_queue_twikit_account_id" ON "content_queue"("twikitAccountId");

-- CreateIndex
CREATE INDEX "idx_content_queue_session_id" ON "content_queue"("sessionId");

-- CreateIndex
CREATE INDEX "idx_content_queue_content_type" ON "content_queue"("contentType");

-- CreateIndex
CREATE INDEX "idx_content_queue_scheduled_for" ON "content_queue"("scheduledFor");

-- CreateIndex
CREATE INDEX "idx_content_queue_status" ON "content_queue"("status");

-- CreateIndex
CREATE INDEX "idx_content_queue_priority" ON "content_queue"("priority");

-- CreateIndex
CREATE INDEX "idx_content_queue_next_attempt" ON "content_queue"("nextAttempt");

-- CreateIndex
CREATE INDEX "idx_content_queue_posted_at" ON "content_queue"("postedAt");

-- CreateIndex
CREATE INDEX "idx_content_queue_campaign_id" ON "content_queue"("campaignId");

-- CreateIndex
CREATE INDEX "idx_content_queue_thread_id" ON "content_queue"("threadId");

-- CreateIndex
CREATE INDEX "idx_content_queue_approval_required" ON "content_queue"("approvalRequired");

-- CreateIndex
CREATE INDEX "idx_content_queue_is_draft" ON "content_queue"("isDraft");

-- CreateIndex
CREATE INDEX "idx_content_queue_is_template" ON "content_queue"("isTemplate");

-- CreateIndex
CREATE INDEX "idx_content_queue_created_at" ON "content_queue"("createdAt");

-- CreateIndex
CREATE INDEX "idx_content_queue_status_scheduled" ON "content_queue"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "idx_content_queue_status_priority" ON "content_queue"("status", "priority");

-- CreateIndex
CREATE INDEX "idx_content_queue_account_status" ON "content_queue"("accountId", "status");

-- CreateIndex
CREATE INDEX "idx_content_queue_scheduled_priority" ON "content_queue"("scheduledFor", "priority");

-- CreateIndex
CREATE INDEX "idx_content_queue_thread_position" ON "content_queue"("threadId", "threadPosition");

-- CreateIndex
CREATE INDEX "idx_content_queue_campaign_scheduled" ON "content_queue"("campaignId", "scheduledFor");

-- CreateIndex
CREATE INDEX "idx_content_queue_approval_status" ON "content_queue"("approvalRequired", "status");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_account_id" ON "twikit_operation_logs"("accountId");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_session_id" ON "twikit_operation_logs"("sessionId");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_operation_type" ON "twikit_operation_logs"("operationType");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_category" ON "twikit_operation_logs"("operationCategory");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_success" ON "twikit_operation_logs"("success");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_severity" ON "twikit_operation_logs"("severity");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_timestamp" ON "twikit_operation_logs"("timestamp");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_rate_limited" ON "twikit_operation_logs"("rateLimited");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_instance_id" ON "twikit_operation_logs"("instanceId");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_correlation_id" ON "twikit_operation_logs"("correlationId");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_parent_operation_id" ON "twikit_operation_logs"("parentOperationId");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_type_success" ON "twikit_operation_logs"("operationType", "success");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_timestamp_severity" ON "twikit_operation_logs"("timestamp", "severity");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_account_type" ON "twikit_operation_logs"("accountId", "operationType");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_session_timestamp" ON "twikit_operation_logs"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_twikit_operation_log_correlation_timestamp" ON "twikit_operation_logs"("correlationId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_type" ON "performance_metrics"("metricType");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_category" ON "performance_metrics"("metricCategory");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_name" ON "performance_metrics"("metricName");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_timestamp" ON "performance_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_account_id" ON "performance_metrics"("accountId");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_session_id" ON "performance_metrics"("sessionId");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_instance_id" ON "performance_metrics"("instanceId");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_is_alert" ON "performance_metrics"("isAlert");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_is_anomaly" ON "performance_metrics"("isAnomaly");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_component" ON "performance_metrics"("componentName");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_name_timestamp" ON "performance_metrics"("metricName", "timestamp");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_type_category" ON "performance_metrics"("metricType", "metricCategory");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_account_type" ON "performance_metrics"("accountId", "metricType");

-- CreateIndex
CREATE INDEX "idx_performance_metrics_window_range" ON "performance_metrics"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "idx_error_log_type" ON "error_logs"("errorType");

-- CreateIndex
CREATE INDEX "idx_error_log_category" ON "error_logs"("errorCategory");

-- CreateIndex
CREATE INDEX "idx_error_log_severity" ON "error_logs"("severity");

-- CreateIndex
CREATE INDEX "idx_error_log_source" ON "error_logs"("source");

-- CreateIndex
CREATE INDEX "idx_error_log_timestamp" ON "error_logs"("timestamp");

-- CreateIndex
CREATE INDEX "idx_error_log_account_id" ON "error_logs"("accountId");

-- CreateIndex
CREATE INDEX "idx_error_log_session_id" ON "error_logs"("sessionId");

-- CreateIndex
CREATE INDEX "idx_error_log_operation_id" ON "error_logs"("operationId");

-- CreateIndex
CREATE INDEX "idx_error_log_correlation_id" ON "error_logs"("correlationId");

-- CreateIndex
CREATE INDEX "idx_error_log_instance_id" ON "error_logs"("instanceId");

-- CreateIndex
CREATE INDEX "idx_error_log_resolved" ON "error_logs"("isResolved");

-- CreateIndex
CREATE INDEX "idx_error_log_recurring" ON "error_logs"("isRecurring");

-- CreateIndex
CREATE INDEX "idx_error_log_impact_level" ON "error_logs"("impactLevel");

-- CreateIndex
CREATE INDEX "idx_error_log_type_severity" ON "error_logs"("errorType", "severity");

-- CreateIndex
CREATE INDEX "idx_error_log_timestamp_severity" ON "error_logs"("timestamp", "severity");

-- CreateIndex
CREATE INDEX "idx_error_log_account_type" ON "error_logs"("accountId", "errorType");

-- CreateIndex
CREATE INDEX "idx_error_log_recurring_count" ON "error_logs"("isRecurring", "recurringCount");

-- CreateIndex
CREATE INDEX "idx_error_log_component_type" ON "error_logs"("component", "errorType");

-- CreateIndex
CREATE INDEX "idx_system_health_component_name" ON "system_health"("componentName");

-- CreateIndex
CREATE INDEX "idx_system_health_component_type" ON "system_health"("componentType");

-- CreateIndex
CREATE INDEX "idx_system_health_status" ON "system_health"("healthStatus");

-- CreateIndex
CREATE INDEX "idx_system_health_score" ON "system_health"("healthScore");

-- CreateIndex
CREATE INDEX "idx_system_health_timestamp" ON "system_health"("timestamp");

-- CreateIndex
CREATE INDEX "idx_system_health_instance_id" ON "system_health"("instanceId");

-- CreateIndex
CREATE INDEX "idx_system_health_alerting" ON "system_health"("isAlerting");

-- CreateIndex
CREATE INDEX "idx_system_health_next_check" ON "system_health"("nextCheckAt");

-- CreateIndex
CREATE INDEX "idx_system_health_environment" ON "system_health"("environment");

-- CreateIndex
CREATE INDEX "idx_system_health_component_status" ON "system_health"("componentName", "healthStatus");

-- CreateIndex
CREATE INDEX "idx_system_health_status_timestamp" ON "system_health"("healthStatus", "timestamp");

-- CreateIndex
CREATE INDEX "idx_system_health_type_status" ON "system_health"("componentType", "healthStatus");

-- CreateIndex
CREATE INDEX "idx_system_health_alerting_level" ON "system_health"("isAlerting", "alertLevel");

-- CreateIndex
CREATE UNIQUE INDEX "identity_profiles_profileName_key" ON "identity_profiles"("profileName");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_name" ON "identity_profiles"("profileName");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_account_id" ON "identity_profiles"("accountId");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_type" ON "identity_profiles"("profileType");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_active" ON "identity_profiles"("isActive");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_last_used" ON "identity_profiles"("lastUsed");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_detection_score" ON "identity_profiles"("detectionScore");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_expires_at" ON "identity_profiles"("expiresAt");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_active_detection" ON "identity_profiles"("isActive", "detectionScore");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_type_device" ON "identity_profiles"("profileType", "deviceCategory");

-- CreateIndex
CREATE INDEX "idx_identity_profiles_browser" ON "identity_profiles"("browserType", "browserVersion");

-- CreateIndex
CREATE INDEX "idx_fingerprint_profiles_identity_id" ON "fingerprint_profiles"("identityProfileId");

-- CreateIndex
CREATE INDEX "idx_fingerprint_profiles_type" ON "fingerprint_profiles"("fingerprintType");

-- CreateIndex
CREATE INDEX "idx_fingerprint_profiles_active" ON "fingerprint_profiles"("isActive");

-- CreateIndex
CREATE INDEX "idx_fingerprint_profiles_last_generated" ON "fingerprint_profiles"("lastGenerated");

-- CreateIndex
CREATE INDEX "idx_fingerprint_profiles_consistency_key" ON "fingerprint_profiles"("consistencyKey");

-- CreateIndex
CREATE INDEX "idx_fingerprint_profiles_identity_type" ON "fingerprint_profiles"("identityProfileId", "fingerprintType");

-- CreateIndex
CREATE INDEX "idx_fingerprint_profiles_type_active" ON "fingerprint_profiles"("fingerprintType", "isActive");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_identity_id" ON "behavior_patterns"("identityProfileId");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_type" ON "behavior_patterns"("patternType");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_name" ON "behavior_patterns"("patternName");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_active" ON "behavior_patterns"("isActive");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_priority" ON "behavior_patterns"("priority");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_last_used" ON "behavior_patterns"("lastUsed");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_identity_type" ON "behavior_patterns"("identityProfileId", "patternType");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_type_active" ON "behavior_patterns"("patternType", "isActive");

-- CreateIndex
CREATE INDEX "idx_behavior_patterns_time_day" ON "behavior_patterns"("timeOfDay", "dayOfWeek");

-- CreateIndex
CREATE INDEX "idx_detection_events_identity_id" ON "detection_events"("identityProfileId");

-- CreateIndex
CREATE INDEX "idx_detection_events_session_id" ON "detection_events"("sessionId");

-- CreateIndex
CREATE INDEX "idx_detection_events_account_id" ON "detection_events"("accountId");

-- CreateIndex
CREATE INDEX "idx_detection_events_type" ON "detection_events"("detectionType");

-- CreateIndex
CREATE INDEX "idx_detection_events_source" ON "detection_events"("detectionSource");

-- CreateIndex
CREATE INDEX "idx_detection_events_severity" ON "detection_events"("severity");

-- CreateIndex
CREATE INDEX "idx_detection_events_timestamp" ON "detection_events"("timestamp");

-- CreateIndex
CREATE INDEX "idx_detection_events_evaded" ON "detection_events"("wasEvaded");

-- CreateIndex
CREATE INDEX "idx_detection_events_correlation_id" ON "detection_events"("correlationId");

-- CreateIndex
CREATE INDEX "idx_detection_events_type_severity" ON "detection_events"("detectionType", "severity");

-- CreateIndex
CREATE INDEX "idx_detection_events_timestamp_type" ON "detection_events"("timestamp", "detectionType");

-- CreateIndex
CREATE INDEX "idx_detection_events_account_type" ON "detection_events"("accountId", "detectionType");

-- CreateIndex
CREATE INDEX "idx_detection_events_identity_timestamp" ON "detection_events"("identityProfileId", "timestamp");

-- CreateIndex
CREATE INDEX "idx_identity_session_assignment_identity_id" ON "identity_session_assignments"("identityProfileId");

-- CreateIndex
CREATE INDEX "idx_identity_session_assignment_session_id" ON "identity_session_assignments"("sessionId");

-- CreateIndex
CREATE INDEX "idx_identity_session_assignment_active" ON "identity_session_assignments"("isActive");

-- CreateIndex
CREATE INDEX "idx_identity_session_assignment_assigned_at" ON "identity_session_assignments"("assignedAt");

-- CreateIndex
CREATE INDEX "idx_identity_session_assignment_performance" ON "identity_session_assignments"("performanceScore");

-- CreateIndex
CREATE INDEX "idx_identity_session_assignment_identity_active" ON "identity_session_assignments"("identityProfileId", "isActive");

-- CreateIndex
CREATE INDEX "idx_identity_session_assignment_session_active" ON "identity_session_assignments"("sessionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "identity_session_assignments_sessionId_isActive_key" ON "identity_session_assignments"("sessionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_triggers_triggerId_key" ON "emergency_triggers"("triggerId");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_trigger_id" ON "emergency_triggers"("triggerId");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_type" ON "emergency_triggers"("triggerType");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_account_id" ON "emergency_triggers"("accountId");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_active" ON "emergency_triggers"("isActive");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_priority" ON "emergency_triggers"("priority");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_last_triggered" ON "emergency_triggers"("lastTriggered");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_active_priority" ON "emergency_triggers"("isActive", "priority");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_type_active" ON "emergency_triggers"("triggerType", "isActive");

-- CreateIndex
CREATE INDEX "idx_emergency_triggers_account_active" ON "emergency_triggers"("accountId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_events_eventId_key" ON "emergency_events"("eventId");

-- CreateIndex
CREATE INDEX "idx_emergency_events_event_id" ON "emergency_events"("eventId");

-- CreateIndex
CREATE INDEX "idx_emergency_events_trigger_id" ON "emergency_events"("triggerId");

-- CreateIndex
CREATE INDEX "idx_emergency_events_trigger_type" ON "emergency_events"("triggerType");

-- CreateIndex
CREATE INDEX "idx_emergency_events_account_id" ON "emergency_events"("accountId");

-- CreateIndex
CREATE INDEX "idx_emergency_events_stop_level" ON "emergency_events"("stopLevel");

-- CreateIndex
CREATE INDEX "idx_emergency_events_success" ON "emergency_events"("success");

-- CreateIndex
CREATE INDEX "idx_emergency_events_execution_start" ON "emergency_events"("executionStartTime");

-- CreateIndex
CREATE INDEX "idx_emergency_events_created_at" ON "emergency_events"("createdAt");

-- CreateIndex
CREATE INDEX "idx_emergency_events_trigger_success" ON "emergency_events"("triggerId", "success");

-- CreateIndex
CREATE INDEX "idx_emergency_events_type_success" ON "emergency_events"("triggerType", "success");

-- CreateIndex
CREATE INDEX "idx_emergency_events_account_success" ON "emergency_events"("accountId", "success");

-- CreateIndex
CREATE INDEX "idx_emergency_events_execution_success" ON "emergency_events"("executionStartTime", "success");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_procedures_procedureId_key" ON "recovery_procedures"("procedureId");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_procedure_id" ON "recovery_procedures"("procedureId");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_type" ON "recovery_procedures"("procedureType");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_active" ON "recovery_procedures"("isActive");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_priority" ON "recovery_procedures"("priority");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_success_rate" ON "recovery_procedures"("successRate");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_last_executed" ON "recovery_procedures"("lastExecuted");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_active_priority" ON "recovery_procedures"("isActive", "priority");

-- CreateIndex
CREATE INDEX "idx_recovery_procedures_type_active" ON "recovery_procedures"("procedureType", "isActive");

-- CreateIndex
CREATE INDEX "twikit_metrics_metric_timestamp_idx" ON "twikit_metrics"("metric", "timestamp");

-- CreateIndex
CREATE INDEX "twikit_metrics_timestamp_idx" ON "twikit_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "twikit_metrics_metric_idx" ON "twikit_metrics"("metric");

-- CreateIndex
CREATE INDEX "twikit_alert_rules_enabled_idx" ON "twikit_alert_rules"("enabled");

-- CreateIndex
CREATE INDEX "twikit_alert_rules_metric_idx" ON "twikit_alert_rules"("metric");

-- CreateIndex
CREATE INDEX "twikit_alert_rules_severity_idx" ON "twikit_alert_rules"("severity");

-- CreateIndex
CREATE INDEX "twikit_alert_channels_enabled_idx" ON "twikit_alert_channels"("enabled");

-- CreateIndex
CREATE INDEX "twikit_alert_channels_type_idx" ON "twikit_alert_channels"("type");

-- CreateIndex
CREATE INDEX "twikit_alert_channels_priority_idx" ON "twikit_alert_channels"("priority");

-- CreateIndex
CREATE INDEX "twikit_escalation_policies_enabled_idx" ON "twikit_escalation_policies"("enabled");

-- CreateIndex
CREATE INDEX "twikit_alerts_status_idx" ON "twikit_alerts"("status");

-- CreateIndex
CREATE INDEX "twikit_alerts_severity_idx" ON "twikit_alerts"("severity");

-- CreateIndex
CREATE INDEX "twikit_alerts_ruleId_idx" ON "twikit_alerts"("ruleId");

-- CreateIndex
CREATE INDEX "twikit_alerts_createdAt_idx" ON "twikit_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "twikit_alerts_status_createdAt_idx" ON "twikit_alerts"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_audit_events_eventId_key" ON "compliance_audit_events"("eventId");

-- CreateIndex
CREATE INDEX "compliance_audit_events_eventType_idx" ON "compliance_audit_events"("eventType");

-- CreateIndex
CREATE INDEX "compliance_audit_events_eventCategory_idx" ON "compliance_audit_events"("eventCategory");

-- CreateIndex
CREATE INDEX "compliance_audit_events_complianceFramework_idx" ON "compliance_audit_events"("complianceFramework");

-- CreateIndex
CREATE INDEX "compliance_audit_events_userId_idx" ON "compliance_audit_events"("userId");

-- CreateIndex
CREATE INDEX "compliance_audit_events_accountId_idx" ON "compliance_audit_events"("accountId");

-- CreateIndex
CREATE INDEX "compliance_audit_events_createdAt_idx" ON "compliance_audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "compliance_audit_events_complianceRelevant_idx" ON "compliance_audit_events"("complianceRelevant");

-- CreateIndex
CREATE INDEX "compliance_audit_events_retentionUntil_idx" ON "compliance_audit_events"("retentionUntil");

-- CreateIndex
CREATE INDEX "compliance_audit_events_riskLevel_idx" ON "compliance_audit_events"("riskLevel");

-- CreateIndex
CREATE INDEX "compliance_reports_reportType_idx" ON "compliance_reports"("reportType");

-- CreateIndex
CREATE INDEX "compliance_reports_complianceFramework_idx" ON "compliance_reports"("complianceFramework");

-- CreateIndex
CREATE INDEX "compliance_reports_status_idx" ON "compliance_reports"("status");

-- CreateIndex
CREATE INDEX "compliance_reports_periodStart_periodEnd_idx" ON "compliance_reports"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "compliance_reports_createdAt_idx" ON "compliance_reports"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_policyName_key" ON "data_retention_policies"("policyName");

-- CreateIndex
CREATE INDEX "data_retention_policies_dataType_idx" ON "data_retention_policies"("dataType");

-- CreateIndex
CREATE INDEX "data_retention_policies_complianceFramework_idx" ON "data_retention_policies"("complianceFramework");

-- CreateIndex
CREATE INDEX "data_retention_policies_isActive_idx" ON "data_retention_policies"("isActive");

-- CreateIndex
CREATE INDEX "data_retention_policies_nextReview_idx" ON "data_retention_policies"("nextReview");

-- CreateIndex
CREATE INDEX "compliance_violations_violationType_idx" ON "compliance_violations"("violationType");

-- CreateIndex
CREATE INDEX "compliance_violations_complianceFramework_idx" ON "compliance_violations"("complianceFramework");

-- CreateIndex
CREATE INDEX "compliance_violations_severity_idx" ON "compliance_violations"("severity");

-- CreateIndex
CREATE INDEX "compliance_violations_status_idx" ON "compliance_violations"("status");

-- CreateIndex
CREATE INDEX "compliance_violations_reportedAt_idx" ON "compliance_violations"("reportedAt");

-- CreateIndex
CREATE INDEX "compliance_violations_dueDate_idx" ON "compliance_violations"("dueDate");

-- CreateIndex
CREATE INDEX "compliance_violations_regulatoryReported_idx" ON "compliance_violations"("regulatoryReported");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_requests_requestId_key" ON "privacy_requests"("requestId");

-- CreateIndex
CREATE INDEX "privacy_requests_requestType_idx" ON "privacy_requests"("requestType");

-- CreateIndex
CREATE INDEX "privacy_requests_complianceFramework_idx" ON "privacy_requests"("complianceFramework");

-- CreateIndex
CREATE INDEX "privacy_requests_status_idx" ON "privacy_requests"("status");

-- CreateIndex
CREATE INDEX "privacy_requests_userId_idx" ON "privacy_requests"("userId");

-- CreateIndex
CREATE INDEX "privacy_requests_submittedAt_idx" ON "privacy_requests"("submittedAt");

-- CreateIndex
CREATE INDEX "privacy_requests_dueDate_idx" ON "privacy_requests"("dueDate");

-- CreateIndex
CREATE INDEX "privacy_requests_responseDelivered_idx" ON "privacy_requests"("responseDelivered");

-- CreateIndex
CREATE UNIQUE INDEX "backup_jobs_jobName_key" ON "backup_jobs"("jobName");

-- CreateIndex
CREATE INDEX "backup_jobs_jobType_idx" ON "backup_jobs"("jobType");

-- CreateIndex
CREATE INDEX "backup_jobs_sourceType_idx" ON "backup_jobs"("sourceType");

-- CreateIndex
CREATE INDEX "backup_jobs_isActive_idx" ON "backup_jobs"("isActive");

-- CreateIndex
CREATE INDEX "backup_jobs_priority_idx" ON "backup_jobs"("priority");

-- CreateIndex
CREATE INDEX "backup_jobs_createdAt_idx" ON "backup_jobs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "backup_executions_executionId_key" ON "backup_executions"("executionId");

-- CreateIndex
CREATE INDEX "backup_executions_jobId_idx" ON "backup_executions"("jobId");

-- CreateIndex
CREATE INDEX "backup_executions_status_idx" ON "backup_executions"("status");

-- CreateIndex
CREATE INDEX "backup_executions_startedAt_idx" ON "backup_executions"("startedAt");

-- CreateIndex
CREATE INDEX "backup_executions_completedAt_idx" ON "backup_executions"("completedAt");

-- CreateIndex
CREATE INDEX "backup_executions_recoveryTested_idx" ON "backup_executions"("recoveryTested");

-- CreateIndex
CREATE UNIQUE INDEX "disaster_recovery_plans_planName_key" ON "disaster_recovery_plans"("planName");

-- CreateIndex
CREATE INDEX "disaster_recovery_plans_planType_idx" ON "disaster_recovery_plans"("planType");

-- CreateIndex
CREATE INDEX "disaster_recovery_plans_priority_idx" ON "disaster_recovery_plans"("priority");

-- CreateIndex
CREATE INDEX "disaster_recovery_plans_isActive_idx" ON "disaster_recovery_plans"("isActive");

-- CreateIndex
CREATE INDEX "disaster_recovery_plans_lastTestedAt_idx" ON "disaster_recovery_plans"("lastTestedAt");

-- CreateIndex
CREATE INDEX "disaster_recovery_plans_nextReviewDate_idx" ON "disaster_recovery_plans"("nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "disaster_recovery_executions_executionId_key" ON "disaster_recovery_executions"("executionId");

-- CreateIndex
CREATE INDEX "disaster_recovery_executions_planId_idx" ON "disaster_recovery_executions"("planId");

-- CreateIndex
CREATE INDEX "disaster_recovery_executions_status_idx" ON "disaster_recovery_executions"("status");

-- CreateIndex
CREATE INDEX "disaster_recovery_executions_triggerType_idx" ON "disaster_recovery_executions"("triggerType");

-- CreateIndex
CREATE INDEX "disaster_recovery_executions_startedAt_idx" ON "disaster_recovery_executions"("startedAt");

-- CreateIndex
CREATE INDEX "disaster_recovery_executions_completedAt_idx" ON "disaster_recovery_executions"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "replication_configs_configName_key" ON "replication_configs"("configName");

-- CreateIndex
CREATE INDEX "replication_configs_sourceType_idx" ON "replication_configs"("sourceType");

-- CreateIndex
CREATE INDEX "replication_configs_isActive_idx" ON "replication_configs"("isActive");

-- CreateIndex
CREATE INDEX "replication_configs_healthStatus_idx" ON "replication_configs"("healthStatus");

-- CreateIndex
CREATE INDEX "replication_configs_lastHealthCheck_idx" ON "replication_configs"("lastHealthCheck");

-- CreateIndex
CREATE INDEX "replication_events_configId_idx" ON "replication_events"("configId");

-- CreateIndex
CREATE INDEX "replication_events_eventType_idx" ON "replication_events"("eventType");

-- CreateIndex
CREATE INDEX "replication_events_eventStatus_idx" ON "replication_events"("eventStatus");

-- CreateIndex
CREATE INDEX "replication_events_createdAt_idx" ON "replication_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "failover_configs_configName_key" ON "failover_configs"("configName");

-- CreateIndex
CREATE INDEX "failover_configs_serviceType_idx" ON "failover_configs"("serviceType");

-- CreateIndex
CREATE INDEX "failover_configs_isActive_idx" ON "failover_configs"("isActive");

-- CreateIndex
CREATE INDEX "failover_configs_autoFailover_idx" ON "failover_configs"("autoFailover");

-- CreateIndex
CREATE INDEX "failover_configs_lastFailover_idx" ON "failover_configs"("lastFailover");

-- CreateIndex
CREATE INDEX "failover_events_configId_idx" ON "failover_events"("configId");

-- CreateIndex
CREATE INDEX "failover_events_eventType_idx" ON "failover_events"("eventType");

-- CreateIndex
CREATE INDEX "failover_events_status_idx" ON "failover_events"("status");

-- CreateIndex
CREATE INDEX "failover_events_startedAt_idx" ON "failover_events"("startedAt");

-- CreateIndex
CREATE INDEX "failover_events_completedAt_idx" ON "failover_events"("completedAt");

-- CreateIndex
CREATE INDEX "idx_analytics_event" ON "analytics"("event");

-- CreateIndex
CREATE INDEX "idx_analytics_user_date" ON "analytics"("userId", "date");

-- CreateIndex
CREATE INDEX "idx_analytics_post_date" ON "analytics"("postId", "date");

-- CreateIndex
CREATE INDEX "idx_analytics_telegram_event" ON "analytics"("telegram_id", "event");

-- CreateIndex
CREATE INDEX "idx_analytics_telegram_date" ON "analytics"("telegram_id", "date");

-- CreateIndex
CREATE INDEX "idx_analytics_event_date" ON "analytics"("event", "date");

-- CreateIndex
CREATE INDEX "idx_analytics_user_date_event" ON "analytics"("userId", "date", "event");

-- CreateIndex
CREATE INDEX "idx_analytics_account_date_event" ON "analytics"("accountId", "date", "event");

-- CreateIndex
CREATE INDEX "idx_analytics_date_event_telegram" ON "analytics"("date", "event", "telegram_id");

-- CreateIndex
CREATE INDEX "idx_analytics_metrics" ON "analytics" USING GIN ("metrics");

-- CreateIndex
CREATE INDEX "idx_analytics_data" ON "analytics" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_automations_campaign_id" ON "automations"("campaignId");

-- CreateIndex
CREATE INDEX "idx_automations_last_run" ON "automations"("lastRun");

-- CreateIndex
CREATE INDEX "idx_automations_created_at" ON "automations"("createdAt");

-- CreateIndex
CREATE INDEX "idx_automations_updated_at" ON "automations"("updatedAt");

-- CreateIndex
CREATE INDEX "idx_automations_status_next_run" ON "automations"("status", "nextRun");

-- CreateIndex
CREATE INDEX "idx_automations_type_status" ON "automations"("type", "status");

-- CreateIndex
CREATE INDEX "idx_automations_campaign_status" ON "automations"("campaignId", "status");

-- CreateIndex
CREATE INDEX "idx_automations_account_type_status" ON "automations"("accountId", "type", "status");

-- CreateIndex
CREATE INDEX "idx_automations_schedule_status_type" ON "automations"("nextRun", "status", "type");

-- CreateIndex
CREATE INDEX "idx_campaigns_created_at" ON "campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "idx_campaigns_updated_at" ON "campaigns"("updatedAt");

-- CreateIndex
CREATE INDEX "idx_campaigns_status_start" ON "campaigns"("status", "startDate");

-- CreateIndex
CREATE INDEX "idx_campaigns_status_end" ON "campaigns"("status", "endDate");

-- CreateIndex
CREATE INDEX "idx_campaigns_user_status_created" ON "campaigns"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_campaigns_date_range_status" ON "campaigns"("startDate", "endDate", "status");

-- CreateIndex
CREATE INDEX "idx_campaigns_search" ON "campaigns"("name", "description");

-- CreateIndex
CREATE INDEX "idx_posts_campaign_id" ON "posts"("campaignId");

-- CreateIndex
CREATE INDEX "idx_posts_updated_at" ON "posts"("updatedAt");

-- CreateIndex
CREATE INDEX "idx_posts_tweet_id" ON "posts"("tweetId");

-- CreateIndex
CREATE INDEX "idx_posts_campaign_status" ON "posts"("campaignId", "status");

-- CreateIndex
CREATE INDEX "idx_posts_status_scheduled" ON "posts"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "idx_posts_status_published" ON "posts"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "idx_posts_account_status_created" ON "posts"("accountId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_posts_campaign_status_created" ON "posts"("campaignId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_posts_likes_count" ON "posts"("likesCount");

-- CreateIndex
CREATE INDEX "idx_posts_retweets_count" ON "posts"("retweetsCount");

-- CreateIndex
CREATE INDEX "idx_posts_views_count" ON "posts"("viewsCount");

-- CreateIndex
CREATE INDEX "idx_posts_engagement_metrics" ON "posts"("likesCount", "retweetsCount", "viewsCount");

-- CreateIndex
CREATE INDEX "idx_posts_content_search" ON "posts"("content");

-- CreateIndex
CREATE INDEX "idx_posts_hashtags" ON "posts"("hashtags");

-- CreateIndex
CREATE INDEX "idx_posts_mentions" ON "posts"("mentions");

-- CreateIndex
CREATE INDEX "idx_security_events_ip_address" ON "security_events"("ipAddress");

-- CreateIndex
CREATE INDEX "idx_security_events_event_success" ON "security_events"("event", "success");

-- CreateIndex
CREATE INDEX "idx_security_events_event_timestamp" ON "security_events"("event", "timestamp");

-- CreateIndex
CREATE INDEX "idx_security_events_ip_timestamp" ON "security_events"("ipAddress", "timestamp");

-- CreateIndex
CREATE INDEX "idx_security_events_user_event_timestamp" ON "security_events"("userId", "event", "timestamp");

-- CreateIndex
CREATE INDEX "idx_security_events_event_success_timestamp" ON "security_events"("event", "success", "timestamp");

-- CreateIndex
CREATE INDEX "idx_security_events_success_timestamp_event" ON "security_events"("success", "timestamp", "event");

-- CreateIndex
CREATE INDEX "idx_security_events_ip_event_success" ON "security_events"("ipAddress", "event", "success");

-- CreateIndex
CREATE INDEX "idx_user_activities_ip_address" ON "user_activities"("ipAddress");

-- CreateIndex
CREATE INDEX "idx_user_activities_user_action" ON "user_activities"("userId", "action");

-- CreateIndex
CREATE INDEX "idx_user_activities_user_created" ON "user_activities"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_user_activities_action_created" ON "user_activities"("action", "createdAt");

-- CreateIndex
CREATE INDEX "idx_user_activities_user_action_created" ON "user_activities"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "idx_user_activities_ip_created" ON "user_activities"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "idx_user_activities_details" ON "user_activities" USING GIN ("details");

-- CreateIndex
CREATE INDEX "idx_user_sessions_refresh_token" ON "user_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "idx_user_sessions_created_at" ON "user_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "idx_user_sessions_user_expires" ON "user_sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "idx_user_sessions_expires_created" ON "user_sessions"("expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_telegram_id" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "idx_users_username" ON "users"("username");

-- CreateIndex
CREATE INDEX "idx_users_active_role" ON "users"("isActive", "role");

-- CreateIndex
CREATE INDEX "idx_users_created_at" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "idx_users_updated_at" ON "users"("updatedAt");

-- CreateIndex
CREATE INDEX "idx_users_telegram_username" ON "users"("telegram_username");

-- CreateIndex
CREATE INDEX "idx_users_role_active_created" ON "users"("role", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "idx_users_telegram_active" ON "users"("telegram_id", "isActive");

-- CreateIndex
CREATE INDEX "idx_users_search" ON "users"("username", "telegram_username", "firstName", "lastName");

-- AddForeignKey
ALTER TABLE "proxies" ADD CONSTRAINT "proxies_proxyPoolId_fkey" FOREIGN KEY ("proxyPoolId") REFERENCES "proxy_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_metrics" ADD CONSTRAINT "account_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_metrics" ADD CONSTRAINT "account_metrics_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweet_engagement_metrics" ADD CONSTRAINT "tweet_engagement_metrics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweet_engagement_metrics" ADD CONSTRAINT "tweet_engagement_metrics_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_performance_metrics" ADD CONSTRAINT "automation_performance_metrics_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_performance_metrics" ADD CONSTRAINT "campaign_performance_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_performance_metrics" ADD CONSTRAINT "campaign_performance_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_analytics" ADD CONSTRAINT "behavioral_analytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_analytics" ADD CONSTRAINT "behavioral_analytics_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_sync_log" ADD CONSTRAINT "account_sync_log_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anti_detection_audit_log" ADD CONSTRAINT "anti_detection_audit_log_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_time_alert" ADD CONSTRAINT "real_time_alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_activity_log" ADD CONSTRAINT "bot_activity_log_botId_fkey" FOREIGN KEY ("botId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_configuration" ADD CONSTRAINT "sync_configuration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_health_status" ADD CONSTRAINT "account_health_status_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_performance_metrics" ADD CONSTRAINT "proxy_performance_metrics_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twikit_sessions" ADD CONSTRAINT "twikit_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twikit_sessions" ADD CONSTRAINT "twikit_sessions_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twikit_sessions" ADD CONSTRAINT "twikit_sessions_fingerprintId_fkey" FOREIGN KEY ("fingerprintId") REFERENCES "fingerprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twikit_accounts" ADD CONSTRAINT "twikit_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twikit_session_history" ADD CONSTRAINT "twikit_session_history_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "twikit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_proxy_assignments" ADD CONSTRAINT "session_proxy_assignments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "twikit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_proxy_assignments" ADD CONSTRAINT "session_proxy_assignments_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_usage_logs" ADD CONSTRAINT "proxy_usage_logs_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_usage_logs" ADD CONSTRAINT "proxy_usage_logs_proxyPoolId_fkey" FOREIGN KEY ("proxyPoolId") REFERENCES "proxy_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_rotation_schedules" ADD CONSTRAINT "proxy_rotation_schedules_proxyPoolId_fkey" FOREIGN KEY ("proxyPoolId") REFERENCES "proxy_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_health_metrics" ADD CONSTRAINT "proxy_health_metrics_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_health_metrics" ADD CONSTRAINT "proxy_health_metrics_proxyPoolId_fkey" FOREIGN KEY ("proxyPoolId") REFERENCES "proxy_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_rate_limit_profiles" ADD CONSTRAINT "account_rate_limit_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_rate_limit_profiles" ADD CONSTRAINT "account_rate_limit_profiles_twikitAccountId_fkey" FOREIGN KEY ("twikitAccountId") REFERENCES "twikit_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_violations" ADD CONSTRAINT "rate_limit_violations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_violations" ADD CONSTRAINT "rate_limit_violations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "account_rate_limit_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_violations" ADD CONSTRAINT "rate_limit_violations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "rate_limit_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_analytics" ADD CONSTRAINT "rate_limit_analytics_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_analytics" ADD CONSTRAINT "rate_limit_analytics_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "account_rate_limit_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweet_cache" ADD CONSTRAINT "tweet_cache_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tweet_cache" ADD CONSTRAINT "tweet_cache_twikitAccountId_fkey" FOREIGN KEY ("twikitAccountId") REFERENCES "twikit_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile_cache" ADD CONSTRAINT "user_profile_cache_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile_cache" ADD CONSTRAINT "user_profile_cache_twikitAccountId_fkey" FOREIGN KEY ("twikitAccountId") REFERENCES "twikit_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_twikitAccountId_fkey" FOREIGN KEY ("twikitAccountId") REFERENCES "twikit_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweet_cache"("tweetId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user_profile_cache"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_queue" ADD CONSTRAINT "content_queue_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_queue" ADD CONSTRAINT "content_queue_twikitAccountId_fkey" FOREIGN KEY ("twikitAccountId") REFERENCES "twikit_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twikit_operation_logs" ADD CONSTRAINT "twikit_operation_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "twikit_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fingerprint_profiles" ADD CONSTRAINT "fingerprint_profiles_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavior_patterns" ADD CONSTRAINT "behavior_patterns_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "twikit_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_session_assignments" ADD CONSTRAINT "identity_session_assignments_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_session_assignments" ADD CONSTRAINT "identity_session_assignments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "twikit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "emergency_triggers"("triggerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twikit_alerts" ADD CONSTRAINT "twikit_alerts_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "twikit_alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_events" ADD CONSTRAINT "compliance_audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_events" ADD CONSTRAINT "compliance_audit_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_executions" ADD CONSTRAINT "backup_executions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "backup_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_recovery_executions" ADD CONSTRAINT "disaster_recovery_executions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "disaster_recovery_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replication_events" ADD CONSTRAINT "replication_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES "replication_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failover_events" ADD CONSTRAINT "failover_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES "failover_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "analytics_accountId_date_idx" RENAME TO "idx_analytics_account_date";

-- RenameIndex
ALTER INDEX "analytics_accountId_idx" RENAME TO "idx_analytics_account_id";

-- RenameIndex
ALTER INDEX "analytics_createdAt_idx" RENAME TO "idx_analytics_created_at";

-- RenameIndex
ALTER INDEX "analytics_date_idx" RENAME TO "idx_analytics_date";

-- RenameIndex
ALTER INDEX "analytics_postId_idx" RENAME TO "idx_analytics_post_id";

-- RenameIndex
ALTER INDEX "analytics_telegram_id_idx" RENAME TO "idx_analytics_telegram_id";

-- RenameIndex
ALTER INDEX "analytics_userId_idx" RENAME TO "idx_analytics_user_id";

-- RenameIndex
ALTER INDEX "automations_accountId_idx" RENAME TO "idx_automations_account_id";

-- RenameIndex
ALTER INDEX "automations_accountId_status_idx" RENAME TO "idx_automations_account_status";

-- RenameIndex
ALTER INDEX "automations_nextRun_idx" RENAME TO "idx_automations_next_run";

-- RenameIndex
ALTER INDEX "automations_status_idx" RENAME TO "idx_automations_status";

-- RenameIndex
ALTER INDEX "automations_type_idx" RENAME TO "idx_automations_type";

-- RenameIndex
ALTER INDEX "campaigns_endDate_idx" RENAME TO "idx_campaigns_end_date";

-- RenameIndex
ALTER INDEX "campaigns_startDate_idx" RENAME TO "idx_campaigns_start_date";

-- RenameIndex
ALTER INDEX "campaigns_status_idx" RENAME TO "idx_campaigns_status";

-- RenameIndex
ALTER INDEX "campaigns_userId_idx" RENAME TO "idx_campaigns_user_id";

-- RenameIndex
ALTER INDEX "campaigns_userId_status_idx" RENAME TO "idx_campaigns_user_status";

-- RenameIndex
ALTER INDEX "posts_accountId_createdAt_idx" RENAME TO "idx_posts_account_created";

-- RenameIndex
ALTER INDEX "posts_accountId_idx" RENAME TO "idx_posts_account_id";

-- RenameIndex
ALTER INDEX "posts_accountId_status_idx" RENAME TO "idx_posts_account_status";

-- RenameIndex
ALTER INDEX "posts_createdAt_idx" RENAME TO "idx_posts_created_at";

-- RenameIndex
ALTER INDEX "posts_publishedAt_idx" RENAME TO "idx_posts_published_at";

-- RenameIndex
ALTER INDEX "posts_scheduledFor_idx" RENAME TO "idx_posts_scheduled_for";

-- RenameIndex
ALTER INDEX "posts_status_idx" RENAME TO "idx_posts_status";

-- RenameIndex
ALTER INDEX "security_events_event_idx" RENAME TO "idx_security_events_event";

-- RenameIndex
ALTER INDEX "security_events_success_idx" RENAME TO "idx_security_events_success";

-- RenameIndex
ALTER INDEX "security_events_timestamp_idx" RENAME TO "idx_security_events_timestamp";

-- RenameIndex
ALTER INDEX "security_events_userId_event_idx" RENAME TO "idx_security_events_user_event";

-- RenameIndex
ALTER INDEX "security_events_userId_idx" RENAME TO "idx_security_events_user_id";

-- RenameIndex
ALTER INDEX "security_events_userId_timestamp_idx" RENAME TO "idx_security_events_user_timestamp";

-- RenameIndex
ALTER INDEX "user_activities_action_idx" RENAME TO "idx_user_activities_action";

-- RenameIndex
ALTER INDEX "user_activities_createdAt_idx" RENAME TO "idx_user_activities_created_at";

-- RenameIndex
ALTER INDEX "user_activities_userId_idx" RENAME TO "idx_user_activities_user_id";

-- RenameIndex
ALTER INDEX "user_sessions_expiresAt_idx" RENAME TO "idx_user_sessions_expires_at";

-- RenameIndex
ALTER INDEX "user_sessions_userId_idx" RENAME TO "idx_user_sessions_user_id";
