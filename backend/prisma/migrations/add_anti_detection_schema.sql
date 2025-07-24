-- Anti-Detection Schema Migration
-- This migration adds comprehensive anti-detection tables and relationships

-- 1. Create Identity Profiles table
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
    "languages" TEXT[] DEFAULT ARRAY['en-US', 'en'],
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

-- 2. Create Fingerprint Profiles table
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

-- 3. Create Behavior Patterns table
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

-- 4. Create Detection Events table
CREATE TABLE "detection_events" (
    "id" TEXT NOT NULL,
    "identityProfileId" TEXT,
    "sessionId" TEXT,
    "accountId" TEXT,
    "detectionType" TEXT NOT NULL,
    "detectionSource" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
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

-- 5. Create Identity Session Assignments table
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

-- Create unique constraints
CREATE UNIQUE INDEX "identity_profiles_profileName_key" ON "identity_profiles"("profileName");
CREATE UNIQUE INDEX "unique_active_session_assignment" ON "identity_session_assignments"("sessionId", "isActive");

-- Create foreign key constraints
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fingerprint_profiles" ADD CONSTRAINT "fingerprint_profiles_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "behavior_patterns" ADD CONSTRAINT "behavior_patterns_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "twikit_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "detection_events" ADD CONSTRAINT "detection_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "x_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_session_assignments" ADD CONSTRAINT "identity_session_assignments_identityProfileId_fkey" FOREIGN KEY ("identityProfileId") REFERENCES "identity_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity_session_assignments" ADD CONSTRAINT "identity_session_assignments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "twikit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create performance indexes for Identity Profiles
CREATE INDEX "idx_identity_profiles_name" ON "identity_profiles"("profileName");
CREATE INDEX "idx_identity_profiles_account_id" ON "identity_profiles"("accountId");
CREATE INDEX "idx_identity_profiles_type" ON "identity_profiles"("profileType");
CREATE INDEX "idx_identity_profiles_active" ON "identity_profiles"("isActive");
CREATE INDEX "idx_identity_profiles_last_used" ON "identity_profiles"("lastUsed");
CREATE INDEX "idx_identity_profiles_detection_score" ON "identity_profiles"("detectionScore");
CREATE INDEX "idx_identity_profiles_expires_at" ON "identity_profiles"("expiresAt");
CREATE INDEX "idx_identity_profiles_active_detection" ON "identity_profiles"("isActive", "detectionScore");
CREATE INDEX "idx_identity_profiles_type_device" ON "identity_profiles"("profileType", "deviceCategory");
CREATE INDEX "idx_identity_profiles_browser" ON "identity_profiles"("browserType", "browserVersion");

-- Create performance indexes for Fingerprint Profiles
CREATE INDEX "idx_fingerprint_profiles_identity_id" ON "fingerprint_profiles"("identityProfileId");
CREATE INDEX "idx_fingerprint_profiles_type" ON "fingerprint_profiles"("fingerprintType");
CREATE INDEX "idx_fingerprint_profiles_active" ON "fingerprint_profiles"("isActive");
CREATE INDEX "idx_fingerprint_profiles_last_generated" ON "fingerprint_profiles"("lastGenerated");
CREATE INDEX "idx_fingerprint_profiles_consistency_key" ON "fingerprint_profiles"("consistencyKey");
CREATE INDEX "idx_fingerprint_profiles_identity_type" ON "fingerprint_profiles"("identityProfileId", "fingerprintType");
CREATE INDEX "idx_fingerprint_profiles_type_active" ON "fingerprint_profiles"("fingerprintType", "isActive");

-- Create performance indexes for Behavior Patterns
CREATE INDEX "idx_behavior_patterns_identity_id" ON "behavior_patterns"("identityProfileId");
CREATE INDEX "idx_behavior_patterns_type" ON "behavior_patterns"("patternType");
CREATE INDEX "idx_behavior_patterns_name" ON "behavior_patterns"("patternName");
CREATE INDEX "idx_behavior_patterns_active" ON "behavior_patterns"("isActive");
CREATE INDEX "idx_behavior_patterns_priority" ON "behavior_patterns"("priority");
CREATE INDEX "idx_behavior_patterns_last_used" ON "behavior_patterns"("lastUsed");
CREATE INDEX "idx_behavior_patterns_identity_type" ON "behavior_patterns"("identityProfileId", "patternType");
CREATE INDEX "idx_behavior_patterns_type_active" ON "behavior_patterns"("patternType", "isActive");
CREATE INDEX "idx_behavior_patterns_time_day" ON "behavior_patterns"("timeOfDay", "dayOfWeek");

-- Create performance indexes for Detection Events
CREATE INDEX "idx_detection_events_identity_id" ON "detection_events"("identityProfileId");
CREATE INDEX "idx_detection_events_session_id" ON "detection_events"("sessionId");
CREATE INDEX "idx_detection_events_account_id" ON "detection_events"("accountId");
CREATE INDEX "idx_detection_events_type" ON "detection_events"("detectionType");
CREATE INDEX "idx_detection_events_source" ON "detection_events"("detectionSource");
CREATE INDEX "idx_detection_events_severity" ON "detection_events"("severity");
CREATE INDEX "idx_detection_events_timestamp" ON "detection_events"("timestamp");
CREATE INDEX "idx_detection_events_evaded" ON "detection_events"("wasEvaded");
CREATE INDEX "idx_detection_events_correlation_id" ON "detection_events"("correlationId");
CREATE INDEX "idx_detection_events_type_severity" ON "detection_events"("detectionType", "severity");
CREATE INDEX "idx_detection_events_timestamp_type" ON "detection_events"("timestamp", "detectionType");
CREATE INDEX "idx_detection_events_account_type" ON "detection_events"("accountId", "detectionType");
CREATE INDEX "idx_detection_events_identity_timestamp" ON "detection_events"("identityProfileId", "timestamp");

-- Create performance indexes for Identity Session Assignments
CREATE INDEX "idx_identity_session_assignment_identity_id" ON "identity_session_assignments"("identityProfileId");
CREATE INDEX "idx_identity_session_assignment_session_id" ON "identity_session_assignments"("sessionId");
CREATE INDEX "idx_identity_session_assignment_active" ON "identity_session_assignments"("isActive");
CREATE INDEX "idx_identity_session_assignment_assigned_at" ON "identity_session_assignments"("assignedAt");
CREATE INDEX "idx_identity_session_assignment_performance" ON "identity_session_assignments"("performanceScore");
CREATE INDEX "idx_identity_session_assignment_identity_active" ON "identity_session_assignments"("identityProfileId", "isActive");
CREATE INDEX "idx_identity_session_assignment_session_active" ON "identity_session_assignments"("sessionId", "isActive");

-- Insert default identity profiles for common configurations
INSERT INTO "identity_profiles" (
    "id", "profileName", "profileType", "deviceCategory", "operatingSystem", 
    "browserType", "browserVersion", "userAgent", "screenResolution", 
    "timezone", "language", "platform", "hardwareConcurrency", "deviceMemory"
) VALUES 
(
    'default_desktop_chrome',
    'Default Desktop Chrome',
    'HUMAN_LIKE',
    'DESKTOP',
    'Windows',
    'Chrome',
    '120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '1920x1080',
    'America/New_York',
    'en-US',
    'Win32',
    8,
    8
),
(
    'default_mobile_safari',
    'Default Mobile Safari',
    'MOBILE_USER',
    'MOBILE',
    'iOS',
    'Safari',
    '17.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    '390x844',
    'America/New_York',
    'en-US',
    'iPhone',
    6,
    4
),
(
    'default_power_user',
    'Default Power User',
    'POWER_USER',
    'DESKTOP',
    'macOS',
    'Chrome',
    '120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '2560x1440',
    'America/Los_Angeles',
    'en-US',
    'MacIntel',
    12,
    16
);

-- Insert default behavior patterns
INSERT INTO "behavior_patterns" (
    "id", "identityProfileId", "patternType", "patternName", "patternData",
    "minInterval", "maxInterval", "burstProbability", "fatigueRate", "attentionSpan", "engagementRate"
) VALUES
(
    'timing_casual_user',
    'default_desktop_chrome',
    'TIMING',
    'Casual User Timing',
    '{"distribution": "normal", "mean": 15000, "stddev": 5000}',
    5000,
    60000,
    0.05,
    0.08,
    1200,
    0.12
),
(
    'timing_power_user',
    'default_power_user',
    'TIMING',
    'Power User Timing',
    '{"distribution": "exponential", "lambda": 0.0001}',
    500,
    15000,
    0.2,
    0.03,
    3600,
    0.25
),
(
    'timing_mobile_user',
    'default_mobile_safari',
    'TIMING',
    'Mobile User Timing',
    '{"distribution": "gamma", "shape": 2, "scale": 10000}',
    2000,
    45000,
    0.08,
    0.1,
    900,
    0.1
);

-- Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_identity_profiles_updated_at BEFORE UPDATE ON "identity_profiles" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fingerprint_profiles_updated_at BEFORE UPDATE ON "fingerprint_profiles" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_behavior_patterns_updated_at BEFORE UPDATE ON "behavior_patterns" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_identity_session_assignments_updated_at BEFORE UPDATE ON "identity_session_assignments" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
