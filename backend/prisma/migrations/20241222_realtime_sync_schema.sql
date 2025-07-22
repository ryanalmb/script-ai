-- Real-Time Data Synchronization System Database Schema
-- Comprehensive enterprise-grade schema for real-time X/Twitter data sync

-- Account Synchronization Tracking
CREATE TABLE IF NOT EXISTS "AccountSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "syncType" TEXT NOT NULL CHECK ("syncType" IN ('full', 'incremental', 'metrics', 'health', 'profile')),
    "status" TEXT NOT NULL CHECK ("status" IN ('started', 'in_progress', 'completed', 'failed', 'retrying')),
    "startTime" TIMESTAMP NOT NULL,
    "endTime" TIMESTAMP,
    "duration" INTEGER, -- milliseconds
    "recordsProcessed" INTEGER DEFAULT 0,
    "recordsUpdated" INTEGER DEFAULT 0,
    "recordsInserted" INTEGER DEFAULT 0,
    "recordsDeleted" INTEGER DEFAULT 0,
    "errorCount" INTEGER DEFAULT 0,
    "errorDetails" JSONB DEFAULT '{}',
    "conflictsDetected" INTEGER DEFAULT 0,
    "conflictsResolved" INTEGER DEFAULT 0,
    "conflictDetails" JSONB DEFAULT '{}',
    "dataSnapshot" JSONB DEFAULT '{}', -- Before/after data for conflict resolution
    "syncVersion" INTEGER NOT NULL DEFAULT 1,
    "lastSyncHash" TEXT, -- Hash of synced data for change detection
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AccountSyncLog_accountId_syncType_idx" ON "AccountSyncLog"("accountId", "syncType");
CREATE INDEX IF NOT EXISTS "AccountSyncLog_status_startTime_idx" ON "AccountSyncLog"("status", "startTime");
CREATE INDEX IF NOT EXISTS "AccountSyncLog_createdAt_idx" ON "AccountSyncLog"("createdAt");

-- Real-Time Account Metrics
CREATE TABLE IF NOT EXISTS "AccountMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "timestamp" TIMESTAMP NOT NULL,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "tweetsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER DEFAULT 0,
    "listsCount" INTEGER DEFAULT 0,
    "mediaCount" INTEGER DEFAULT 0,
    "isVerified" BOOLEAN DEFAULT false,
    "isProtected" BOOLEAN DEFAULT false,
    "profileImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "website" TEXT,
    "joinDate" TIMESTAMP,
    "lastTweetDate" TIMESTAMP,
    "engagementRate" REAL DEFAULT 0.0,
    "growthRate" REAL DEFAULT 0.0,
    "activityScore" REAL DEFAULT 0.0,
    "influenceScore" REAL DEFAULT 0.0,
    "deltaFollowers" INTEGER DEFAULT 0, -- Change since last sync
    "deltaFollowing" INTEGER DEFAULT 0,
    "deltaTweets" INTEGER DEFAULT 0,
    "syncSource" TEXT NOT NULL DEFAULT 'api',
    "dataQuality" REAL DEFAULT 1.0, -- 0-1 quality score
    "isEstimated" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AccountMetrics_accountId_timestamp_idx" ON "AccountMetrics"("accountId", "timestamp");
CREATE INDEX IF NOT EXISTS "AccountMetrics_timestamp_idx" ON "AccountMetrics"("timestamp");
CREATE INDEX IF NOT EXISTS "AccountMetrics_engagementRate_idx" ON "AccountMetrics"("engagementRate");

-- Account Health Status Tracking
CREATE TABLE IF NOT EXISTS "AccountHealthStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "timestamp" TIMESTAMP NOT NULL,
    "status" TEXT NOT NULL CHECK ("status" IN ('active', 'suspended', 'limited', 'rate_limited', 'authentication_failed', 'unknown')),
    "previousStatus" TEXT,
    "statusDuration" INTEGER, -- seconds in current status
    "healthScore" REAL NOT NULL DEFAULT 1.0, -- 0-1 health score
    "riskLevel" TEXT NOT NULL CHECK ("riskLevel" IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    "lastSuccessfulAction" TIMESTAMP,
    "lastFailedAction" TIMESTAMP,
    "consecutiveFailures" INTEGER DEFAULT 0,
    "rateLimitResetTime" TIMESTAMP,
    "rateLimitRemaining" INTEGER,
    "authenticationIssues" JSONB DEFAULT '{}',
    "suspensionDetails" JSONB DEFAULT '{}',
    "limitationDetails" JSONB DEFAULT '{}',
    "recoveryActions" JSONB DEFAULT '{}',
    "alertsSent" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AccountHealthStatus_accountId_timestamp_idx" ON "AccountHealthStatus"("accountId", "timestamp");
CREATE INDEX IF NOT EXISTS "AccountHealthStatus_status_idx" ON "AccountHealthStatus"("status");
CREATE INDEX IF NOT EXISTS "AccountHealthStatus_riskLevel_idx" ON "AccountHealthStatus"("riskLevel");

-- Tweet Engagement Analytics
CREATE TABLE IF NOT EXISTS "TweetEngagementMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tweetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "timestamp" TIMESTAMP NOT NULL,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "retweetsCount" INTEGER NOT NULL DEFAULT 0,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "quotesCount" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER DEFAULT 0,
    "reach" INTEGER DEFAULT 0,
    "engagementRate" REAL DEFAULT 0.0,
    "viralityScore" REAL DEFAULT 0.0,
    "sentimentScore" REAL DEFAULT 0.0, -- -1 to 1
    "deltaLikes" INTEGER DEFAULT 0, -- Change since last measurement
    "deltaRetweets" INTEGER DEFAULT 0,
    "deltaReplies" INTEGER DEFAULT 0,
    "deltaQuotes" INTEGER DEFAULT 0,
    "deltaImpressions" INTEGER DEFAULT 0,
    "peakEngagementTime" TIMESTAMP,
    "engagementVelocity" REAL DEFAULT 0.0, -- Engagement per hour
    "audienceQuality" REAL DEFAULT 0.0, -- Quality of engaging users
    "contentCategory" TEXT,
    "hashtags" TEXT[],
    "mentions" TEXT[],
    "mediaTypes" TEXT[],
    "isPromoted" BOOLEAN DEFAULT false,
    "promotionMetrics" JSONB DEFAULT '{}',
    "syncSource" TEXT NOT NULL DEFAULT 'api',
    "dataQuality" REAL DEFAULT 1.0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TweetEngagementMetrics_tweetId_timestamp_idx" ON "TweetEngagementMetrics"("tweetId", "timestamp");
CREATE INDEX IF NOT EXISTS "TweetEngagementMetrics_accountId_timestamp_idx" ON "TweetEngagementMetrics"("accountId", "timestamp");
CREATE INDEX IF NOT EXISTS "TweetEngagementMetrics_engagementRate_idx" ON "TweetEngagementMetrics"("engagementRate");

-- Automation Performance Analytics
CREATE TABLE IF NOT EXISTS "AutomationPerformanceMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "timestamp" TIMESTAMP NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionCategory" TEXT NOT NULL CHECK ("actionCategory" IN ('posting', 'engagement', 'following', 'messaging', 'analytics')),
    "status" TEXT NOT NULL CHECK ("status" IN ('success', 'failure', 'partial', 'skipped', 'retried')),
    "executionTime" INTEGER NOT NULL, -- milliseconds
    "responseTime" INTEGER, -- API response time
    "retryCount" INTEGER DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorCategory" TEXT,
    "detectionRisk" REAL DEFAULT 0.0, -- 0-1 detection risk score
    "qualityScore" REAL DEFAULT 1.0, -- 0-1 action quality score
    "proxyId" TEXT REFERENCES "Proxy"("id"),
    "fingerprintId" TEXT REFERENCES "BrowserFingerprint"("id"),
    "behaviorPatternId" TEXT REFERENCES "BehaviorPattern"("id"),
    "sessionId" TEXT,
    "campaignId" TEXT,
    "targetData" JSONB DEFAULT '{}', -- Target user/tweet data
    "resultData" JSONB DEFAULT '{}', -- Action result data
    "contextData" JSONB DEFAULT '{}', -- Additional context
    "performanceMetrics" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AutomationPerformanceMetrics_accountId_timestamp_idx" ON "AutomationPerformanceMetrics"("accountId", "timestamp");
CREATE INDEX IF NOT EXISTS "AutomationPerformanceMetrics_actionType_status_idx" ON "AutomationPerformanceMetrics"("actionType", "status");
CREATE INDEX IF NOT EXISTS "AutomationPerformanceMetrics_campaignId_idx" ON "AutomationPerformanceMetrics"("campaignId");

-- Proxy Performance Analytics
CREATE TABLE IF NOT EXISTS "ProxyPerformanceMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proxyId" TEXT NOT NULL REFERENCES "Proxy"("id") ON DELETE CASCADE,
    "timestamp" TIMESTAMP NOT NULL,
    "accountId" TEXT REFERENCES "XAccount"("id"),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0, -- milliseconds
    "minResponseTime" INTEGER DEFAULT 0,
    "maxResponseTime" INTEGER DEFAULT 0,
    "timeoutCount" INTEGER DEFAULT 0,
    "errorCount" INTEGER DEFAULT 0,
    "detectionEvents" INTEGER DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 0.0,
    "reliabilityScore" REAL DEFAULT 0.0,
    "performanceScore" REAL DEFAULT 0.0,
    "geoConsistency" REAL DEFAULT 1.0,
    "bandwidthUsed" BIGINT DEFAULT 0, -- bytes
    "connectionErrors" JSONB DEFAULT '{}',
    "httpStatusCodes" JSONB DEFAULT '{}',
    "geolocationData" JSONB DEFAULT '{}',
    "qualityMetrics" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProxyPerformanceMetrics_proxyId_timestamp_idx" ON "ProxyPerformanceMetrics"("proxyId", "timestamp");
CREATE INDEX IF NOT EXISTS "ProxyPerformanceMetrics_successRate_idx" ON "ProxyPerformanceMetrics"("successRate");
CREATE INDEX IF NOT EXISTS "ProxyPerformanceMetrics_accountId_idx" ON "ProxyPerformanceMetrics"("accountId");

-- Fingerprint Performance Analytics
CREATE TABLE IF NOT EXISTS "FingerprintPerformanceMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprintId" TEXT NOT NULL REFERENCES "BrowserFingerprint"("id") ON DELETE CASCADE,
    "timestamp" TIMESTAMP NOT NULL,
    "accountId" TEXT REFERENCES "XAccount"("id"),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "detectionEvents" INTEGER DEFAULT 0,
    "suspicionScore" REAL DEFAULT 0.0, -- 0-1 suspicion level
    "effectivenessScore" REAL DEFAULT 1.0, -- 0-1 effectiveness
    "consistencyScore" REAL DEFAULT 1.0, -- 0-1 consistency
    "realismScore" REAL DEFAULT 1.0, -- 0-1 realism
    "ageInDays" INTEGER DEFAULT 0,
    "rotationRecommended" BOOLEAN DEFAULT false,
    "detectionPatterns" JSONB DEFAULT '{}',
    "performanceMetrics" JSONB DEFAULT '{}',
    "qualityAssessment" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "FingerprintPerformanceMetrics_fingerprintId_timestamp_idx" ON "FingerprintPerformanceMetrics"("fingerprintId", "timestamp");
CREATE INDEX IF NOT EXISTS "FingerprintPerformanceMetrics_effectivenessScore_idx" ON "FingerprintPerformanceMetrics"("effectivenessScore");
CREATE INDEX IF NOT EXISTS "FingerprintPerformanceMetrics_accountId_idx" ON "FingerprintPerformanceMetrics"("accountId");

-- Behavioral Analytics
CREATE TABLE IF NOT EXISTS "BehavioralAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "sessionId" TEXT,
    "timestamp" TIMESTAMP NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionTiming" INTEGER NOT NULL, -- milliseconds since last action
    "sessionDuration" INTEGER, -- total session duration in seconds
    "actionsInSession" INTEGER DEFAULT 0,
    "errorRate" REAL DEFAULT 0.0,
    "hesitationEvents" INTEGER DEFAULT 0,
    "correctionEvents" INTEGER DEFAULT 0,
    "pauseEvents" INTEGER DEFAULT 0,
    "humanLikenessScore" REAL DEFAULT 1.0, -- 0-1 human-like behavior score
    "patternConsistency" REAL DEFAULT 1.0, -- 0-1 pattern consistency
    "anomalyScore" REAL DEFAULT 0.0, -- 0-1 anomaly detection score
    "timingDistribution" JSONB DEFAULT '{}', -- Statistical timing analysis
    "behaviorPattern" TEXT,
    "contextFactors" JSONB DEFAULT '{}',
    "qualityMetrics" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BehavioralAnalytics_accountId_timestamp_idx" ON "BehavioralAnalytics"("accountId", "timestamp");
CREATE INDEX IF NOT EXISTS "BehavioralAnalytics_sessionId_idx" ON "BehavioralAnalytics"("sessionId");
CREATE INDEX IF NOT EXISTS "BehavioralAnalytics_humanLikenessScore_idx" ON "BehavioralAnalytics"("humanLikenessScore");

-- Campaign Performance Tracking
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL CHECK ("type" IN ('growth', 'engagement', 'content', 'research', 'testing')),
    "status" TEXT NOT NULL CHECK ("status" IN ('draft', 'active', 'paused', 'completed', 'cancelled')) DEFAULT 'draft',
    "startDate" TIMESTAMP,
    "endDate" TIMESTAMP,
    "targetMetrics" JSONB NOT NULL DEFAULT '{}',
    "budgetLimits" JSONB DEFAULT '{}',
    "accountIds" TEXT[] DEFAULT '{}',
    "contentStrategy" JSONB DEFAULT '{}',
    "automationRules" JSONB DEFAULT '{}',
    "complianceSettings" JSONB DEFAULT '{}',
    "createdBy" TEXT REFERENCES "User"("id"),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX IF NOT EXISTS "Campaign_type_idx" ON "Campaign"("type");
CREATE INDEX IF NOT EXISTS "Campaign_createdBy_idx" ON "Campaign"("createdBy");

-- Campaign Performance Metrics
CREATE TABLE IF NOT EXISTS "CampaignPerformanceMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
    "timestamp" TIMESTAMP NOT NULL,
    "accountId" TEXT REFERENCES "XAccount"("id"),
    "totalReach" INTEGER DEFAULT 0,
    "totalImpressions" INTEGER DEFAULT 0,
    "totalEngagements" INTEGER DEFAULT 0,
    "totalFollowersGained" INTEGER DEFAULT 0,
    "totalFollowersLost" INTEGER DEFAULT 0,
    "totalTweets" INTEGER DEFAULT 0,
    "totalLikes" INTEGER DEFAULT 0,
    "totalRetweets" INTEGER DEFAULT 0,
    "totalReplies" INTEGER DEFAULT 0,
    "totalMentions" INTEGER DEFAULT 0,
    "engagementRate" REAL DEFAULT 0.0,
    "growthRate" REAL DEFAULT 0.0,
    "conversionRate" REAL DEFAULT 0.0,
    "costPerEngagement" REAL DEFAULT 0.0,
    "costPerFollower" REAL DEFAULT 0.0,
    "roi" REAL DEFAULT 0.0,
    "qualityScore" REAL DEFAULT 0.0,
    "complianceScore" REAL DEFAULT 1.0,
    "riskScore" REAL DEFAULT 0.0,
    "participationRate" REAL DEFAULT 0.0, -- % of accounts actively participating
    "contentPerformance" JSONB DEFAULT '{}',
    "audienceInsights" JSONB DEFAULT '{}',
    "competitorComparison" JSONB DEFAULT '{}',
    "abTestResults" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CampaignPerformanceMetrics_campaignId_timestamp_idx" ON "CampaignPerformanceMetrics"("campaignId", "timestamp");
CREATE INDEX IF NOT EXISTS "CampaignPerformanceMetrics_accountId_idx" ON "CampaignPerformanceMetrics"("accountId");
CREATE INDEX IF NOT EXISTS "CampaignPerformanceMetrics_roi_idx" ON "CampaignPerformanceMetrics"("roi");

-- Real-Time Sync Configuration
CREATE TABLE IF NOT EXISTS "SyncConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "syncType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 30,
    "priority" INTEGER NOT NULL DEFAULT 1, -- 1=highest, 5=lowest
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffMs" INTEGER NOT NULL DEFAULT 1000,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "rateLimitPerMinute" INTEGER DEFAULT 60,
    "conflictResolution" TEXT NOT NULL CHECK ("conflictResolution" IN ('last_write_wins', 'merge', 'manual', 'skip')) DEFAULT 'last_write_wins',
    "dataValidation" JSONB DEFAULT '{}',
    "alertThresholds" JSONB DEFAULT '{}',
    "customSettings" JSONB DEFAULT '{}',
    "lastModified" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SyncConfiguration_accountId_syncType_idx" ON "SyncConfiguration"("accountId", "syncType");
CREATE INDEX IF NOT EXISTS "SyncConfiguration_isEnabled_priority_idx" ON "SyncConfiguration"("isEnabled", "priority");

-- Data Quality Monitoring
CREATE TABLE IF NOT EXISTS "DataQualityMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSource" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "timestamp" TIMESTAMP NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsValid" INTEGER NOT NULL DEFAULT 0,
    "recordsInvalid" INTEGER NOT NULL DEFAULT 0,
    "recordsMissing" INTEGER NOT NULL DEFAULT 0,
    "recordsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" REAL NOT NULL DEFAULT 0.0, -- 0-1 overall quality
    "completenessScore" REAL DEFAULT 0.0,
    "accuracyScore" REAL DEFAULT 0.0,
    "consistencyScore" REAL DEFAULT 0.0,
    "timelinessScore" REAL DEFAULT 0.0,
    "validationRules" JSONB DEFAULT '{}',
    "qualityIssues" JSONB DEFAULT '{}',
    "improvementSuggestions" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DataQualityMetrics_dataSource_timestamp_idx" ON "DataQualityMetrics"("dataSource", "timestamp");
CREATE INDEX IF NOT EXISTS "DataQualityMetrics_qualityScore_idx" ON "DataQualityMetrics"("qualityScore");

-- Real-Time Alerts
CREATE TABLE IF NOT EXISTS "RealTimeAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertType" TEXT NOT NULL CHECK ("alertType" IN ('sync_failure', 'data_quality', 'performance', 'security', 'compliance')),
    "severity" TEXT NOT NULL CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "accountId" TEXT REFERENCES "XAccount"("id"),
    "campaignId" TEXT REFERENCES "Campaign"("id"),
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "alertData" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL CHECK ("status" IN ('active', 'acknowledged', 'resolved', 'suppressed')) DEFAULT 'active',
    "acknowledgedBy" TEXT REFERENCES "User"("id"),
    "acknowledgedAt" TIMESTAMP,
    "resolvedBy" TEXT REFERENCES "User"("id"),
    "resolvedAt" TIMESTAMP,
    "resolutionNotes" TEXT,
    "notificationsSent" JSONB DEFAULT '{}',
    "escalationLevel" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RealTimeAlert_alertType_severity_idx" ON "RealTimeAlert"("alertType", "severity");
CREATE INDEX IF NOT EXISTS "RealTimeAlert_status_createdAt_idx" ON "RealTimeAlert"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RealTimeAlert_accountId_idx" ON "RealTimeAlert"("accountId");

-- Create views for common analytics queries
CREATE OR REPLACE VIEW "AccountMetricsSummary" AS
SELECT 
    am.accountId,
    xa.username,
    am.timestamp,
    am.followersCount,
    am.followingCount,
    am.tweetsCount,
    am.engagementRate,
    am.deltaFollowers,
    am.deltaTweets,
    ahs.status as healthStatus,
    ahs.healthScore,
    ahs.riskLevel
FROM "AccountMetrics" am
JOIN "XAccount" xa ON am.accountId = xa.id
LEFT JOIN "AccountHealthStatus" ahs ON ahs.accountId = am.accountId 
    AND ahs.timestamp = (
        SELECT MAX(timestamp) 
        FROM "AccountHealthStatus" 
        WHERE accountId = am.accountId
    )
WHERE am.timestamp = (
    SELECT MAX(timestamp) 
    FROM "AccountMetrics" 
    WHERE accountId = am.accountId
);

CREATE OR REPLACE VIEW "CampaignPerformanceSummary" AS
SELECT 
    c.id as campaignId,
    c.name as campaignName,
    c.type as campaignType,
    c.status as campaignStatus,
    cpm.timestamp,
    cpm.totalReach,
    cpm.totalEngagements,
    cpm.engagementRate,
    cpm.growthRate,
    cpm.roi,
    cpm.qualityScore,
    cpm.complianceScore,
    cpm.participationRate,
    array_length(c.accountIds, 1) as totalAccounts
FROM "Campaign" c
LEFT JOIN "CampaignPerformanceMetrics" cpm ON c.id = cpm.campaignId
    AND cpm.timestamp = (
        SELECT MAX(timestamp) 
        FROM "CampaignPerformanceMetrics" 
        WHERE campaignId = c.id
    );

-- Add triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaign_updated_at BEFORE UPDATE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sync_configuration_updated_at BEFORE UPDATE ON "SyncConfiguration" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
