-- Anti-Detection System Database Schema
-- This migration adds comprehensive tables for enterprise-grade anti-detection

-- Proxy Management Tables
CREATE TABLE IF NOT EXISTS "Proxy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL CHECK ("type" IN ('residential', 'datacenter', 'mobile', 'isp')),
    "provider" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT,
    "password" TEXT, -- Encrypted
    "protocol" TEXT NOT NULL CHECK ("protocol" IN ('http', 'https', 'socks4', 'socks5')),
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP,
    "successRate" REAL NOT NULL DEFAULT 1.0,
    "responseTime" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "maxConcurrentConnections" INTEGER NOT NULL DEFAULT 10,
    "rotationInterval" INTEGER NOT NULL DEFAULT 300,
    "stickySession" BOOLEAN NOT NULL DEFAULT false,
    "sessionDuration" INTEGER NOT NULL DEFAULT 1800,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Proxy_type_country_idx" ON "Proxy"("type", "country");
CREATE INDEX IF NOT EXISTS "Proxy_isActive_successRate_idx" ON "Proxy"("isActive", "successRate");
CREATE INDEX IF NOT EXISTS "Proxy_provider_idx" ON "Proxy"("provider");

-- Proxy Pool Management
CREATE TABLE IF NOT EXISTS "ProxyPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('round_robin', 'weighted', 'least_connections', 'geographic', 'random')),
    "healthCheckInterval" INTEGER NOT NULL DEFAULT 300,
    "failoverThreshold" INTEGER NOT NULL DEFAULT 3,
    "loadBalancingStrategy" TEXT NOT NULL DEFAULT 'weighted',
    "geoTargeting" JSONB DEFAULT '{}',
    "qualityThresholds" JSONB DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Proxy Pool Assignments
CREATE TABLE IF NOT EXISTS "ProxyPoolAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL REFERENCES "ProxyPool"("id") ON DELETE CASCADE,
    "proxyId" TEXT NOT NULL REFERENCES "Proxy"("id") ON DELETE CASCADE,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("poolId", "proxyId")
);

-- Browser Fingerprint Management
CREATE TABLE IF NOT EXISTS "BrowserFingerprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAgent" TEXT NOT NULL,
    "acceptLanguage" TEXT NOT NULL,
    "acceptEncoding" TEXT NOT NULL,
    "accept" TEXT NOT NULL,
    "viewport" JSONB NOT NULL,
    "screen" JSONB NOT NULL,
    "timezone" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "cookieEnabled" BOOLEAN NOT NULL DEFAULT true,
    "doNotTrack" BOOLEAN NOT NULL DEFAULT false,
    "hardwareConcurrency" INTEGER NOT NULL,
    "deviceMemory" INTEGER NOT NULL,
    "webgl" JSONB NOT NULL,
    "canvas" JSONB NOT NULL,
    "audio" JSONB NOT NULL,
    "fonts" JSONB NOT NULL,
    "plugins" JSONB NOT NULL,
    "mimeTypes" JSONB NOT NULL,
    "webRTC" JSONB NOT NULL,
    "battery" JSONB NOT NULL,
    "geolocation" JSONB DEFAULT '{}',
    "quality" REAL NOT NULL DEFAULT 0.5,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BrowserFingerprint_quality_idx" ON "BrowserFingerprint"("quality");
CREATE INDEX IF NOT EXISTS "BrowserFingerprint_usageCount_idx" ON "BrowserFingerprint"("usageCount");
CREATE INDEX IF NOT EXISTS "BrowserFingerprint_platform_idx" ON "BrowserFingerprint"("platform");

-- Fingerprint Profiles
CREATE TABLE IF NOT EXISTS "FingerprintProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetCountry" TEXT NOT NULL,
    "targetOS" TEXT NOT NULL,
    "targetBrowser" TEXT NOT NULL,
    "rotationStrategy" TEXT NOT NULL CHECK ("rotationStrategy" IN ('random', 'sequential', 'weighted', 'time_based')),
    "rotationInterval" INTEGER NOT NULL DEFAULT 3600,
    "maxUsagePerFingerprint" INTEGER NOT NULL DEFAULT 50,
    "qualityThreshold" REAL NOT NULL DEFAULT 0.8,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Behavior Patterns
CREATE TABLE IF NOT EXISTS "BehaviorPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "actionIntervals" JSONB NOT NULL,
    "sessionPatterns" JSONB NOT NULL,
    "activityDistribution" JSONB NOT NULL,
    "errorSimulation" JSONB NOT NULL,
    "mouseMovement" JSONB NOT NULL,
    "keyboardTiming" JSONB NOT NULL,
    "scrollBehavior" JSONB NOT NULL,
    "quality" REAL NOT NULL DEFAULT 0.5,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BehaviorPattern_quality_idx" ON "BehaviorPattern"("quality");
CREATE INDEX IF NOT EXISTS "BehaviorPattern_name_idx" ON "BehaviorPattern"("name");

-- Behavior Sessions
CREATE TABLE IF NOT EXISTS "BehaviorSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "patternId" TEXT NOT NULL REFERENCES "BehaviorPattern"("id"),
    "startTime" TIMESTAMP NOT NULL,
    "plannedEndTime" TIMESTAMP NOT NULL,
    "actualEndTime" TIMESTAMP,
    "currentPhase" TEXT NOT NULL CHECK ("currentPhase" IN ('warmup', 'active', 'cooldown', 'break')),
    "actionsPerformed" INTEGER NOT NULL DEFAULT 0,
    "actionsPlanned" INTEGER NOT NULL DEFAULT 0,
    "sessionMetrics" JSONB DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BehaviorSession_accountId_idx" ON "BehaviorSession"("accountId");
CREATE INDEX IF NOT EXISTS "BehaviorSession_isActive_idx" ON "BehaviorSession"("isActive");

-- Anti-Detection Profiles
CREATE TABLE IF NOT EXISTS "AntiDetectionProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskLevel" TEXT NOT NULL CHECK ("riskLevel" IN ('low', 'medium', 'high', 'extreme')),
    "configuration" JSONB NOT NULL,
    "metrics" JSONB DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AntiDetectionProfile_accountId_idx" ON "AntiDetectionProfile"("accountId");
CREATE INDEX IF NOT EXISTS "AntiDetectionProfile_riskLevel_idx" ON "AntiDetectionProfile"("riskLevel");

-- Detection Events
CREATE TABLE IF NOT EXISTS "DetectionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "profileId" TEXT REFERENCES "AntiDetectionProfile"("id"),
    "type" TEXT NOT NULL CHECK ("type" IN ('captcha', 'rate_limit', 'suspension', 'unusual_activity', 'ip_block', 'fingerprint_flag')),
    "severity" TEXT NOT NULL CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
    "description" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DetectionEvent_accountId_idx" ON "DetectionEvent"("accountId");
CREATE INDEX IF NOT EXISTS "DetectionEvent_type_severity_idx" ON "DetectionEvent"("type", "severity");
CREATE INDEX IF NOT EXISTS "DetectionEvent_resolved_idx" ON "DetectionEvent"("resolved");
CREATE INDEX IF NOT EXISTS "DetectionEvent_createdAt_idx" ON "DetectionEvent"("createdAt");

-- Proxy Sessions
CREATE TABLE IF NOT EXISTS "ProxySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "proxyId" TEXT NOT NULL REFERENCES "Proxy"("id"),
    "startTime" TIMESTAMP NOT NULL,
    "endTime" TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "fingerprint" JSONB DEFAULT '{}',
    "isSticky" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProxySession_accountId_idx" ON "ProxySession"("accountId");
CREATE INDEX IF NOT EXISTS "ProxySession_proxyId_idx" ON "ProxySession"("proxyId");
CREATE INDEX IF NOT EXISTS "ProxySession_isActive_idx" ON "ProxySession"("isActive");

-- Action Queue for Behavior Simulation
CREATE TABLE IF NOT EXISTS "ActionQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "sessionId" TEXT REFERENCES "BehaviorSession"("id"),
    "actionType" TEXT NOT NULL,
    "actionData" JSONB NOT NULL,
    "scheduledTime" TIMESTAMP NOT NULL,
    "executedTime" TIMESTAMP,
    "status" TEXT NOT NULL CHECK ("status" IN ('queued', 'executing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ActionQueue_accountId_idx" ON "ActionQueue"("accountId");
CREATE INDEX IF NOT EXISTS "ActionQueue_status_scheduledTime_idx" ON "ActionQueue"("status", "scheduledTime");
CREATE INDEX IF NOT EXISTS "ActionQueue_priority_idx" ON "ActionQueue"("priority");

-- System Health Metrics
CREATE TABLE IF NOT EXISTS "SystemHealthMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "component" TEXT NOT NULL CHECK ("component" IN ('proxy_manager', 'fingerprint_manager', 'behavior_simulator', 'anti_detection_coordinator')),
    "metricType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SystemHealthMetric_component_timestamp_idx" ON "SystemHealthMetric"("component", "timestamp");
CREATE INDEX IF NOT EXISTS "SystemHealthMetric_metricType_idx" ON "SystemHealthMetric"("metricType");

-- Performance Analytics
CREATE TABLE IF NOT EXISTS "PerformanceAnalytic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "profileId" TEXT REFERENCES "AntiDetectionProfile"("id"),
    "sessionId" TEXT,
    "actionType" TEXT NOT NULL,
    "executionTime" INTEGER NOT NULL, -- milliseconds
    "success" BOOLEAN NOT NULL,
    "detectionRisk" REAL NOT NULL DEFAULT 0.0,
    "proxyId" TEXT REFERENCES "Proxy"("id"),
    "fingerprintId" TEXT REFERENCES "BrowserFingerprint"("id"),
    "metadata" JSONB DEFAULT '{}',
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PerformanceAnalytic_accountId_timestamp_idx" ON "PerformanceAnalytic"("accountId", "timestamp");
CREATE INDEX IF NOT EXISTS "PerformanceAnalytic_actionType_idx" ON "PerformanceAnalytic"("actionType");
CREATE INDEX IF NOT EXISTS "PerformanceAnalytic_success_idx" ON "PerformanceAnalytic"("success");

-- Configuration Settings
CREATE TABLE IF NOT EXISTS "AntiDetectionConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AntiDetectionConfig_category_idx" ON "AntiDetectionConfig"("category");
CREATE INDEX IF NOT EXISTS "AntiDetectionConfig_isActive_idx" ON "AntiDetectionConfig"("isActive");

-- Audit Log for Anti-Detection Actions
CREATE TABLE IF NOT EXISTS "AntiDetectionAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT REFERENCES "XAccount"("id") ON DELETE CASCADE,
    "action" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "result" TEXT NOT NULL CHECK ("result" IN ('success', 'failure', 'warning')),
    "executionTime" INTEGER, -- milliseconds
    "userId" TEXT REFERENCES "User"("id"),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AntiDetectionAuditLog_accountId_timestamp_idx" ON "AntiDetectionAuditLog"("accountId", "timestamp");
CREATE INDEX IF NOT EXISTS "AntiDetectionAuditLog_action_idx" ON "AntiDetectionAuditLog"("action");
CREATE INDEX IF NOT EXISTS "AntiDetectionAuditLog_result_idx" ON "AntiDetectionAuditLog"("result");

-- Update existing XAccount table to include anti-detection fields
ALTER TABLE "XAccount" ADD COLUMN IF NOT EXISTS "antiDetectionProfileId" TEXT REFERENCES "AntiDetectionProfile"("id");
ALTER TABLE "XAccount" ADD COLUMN IF NOT EXISTS "currentProxyId" TEXT REFERENCES "Proxy"("id");
ALTER TABLE "XAccount" ADD COLUMN IF NOT EXISTS "currentFingerprintId" TEXT REFERENCES "BrowserFingerprint"("id");
ALTER TABLE "XAccount" ADD COLUMN IF NOT EXISTS "detectionRiskScore" REAL DEFAULT 0.0;
ALTER TABLE "XAccount" ADD COLUMN IF NOT EXISTS "lastDetectionEvent" TIMESTAMP;
ALTER TABLE "XAccount" ADD COLUMN IF NOT EXISTS "automationPaused" BOOLEAN DEFAULT false;
ALTER TABLE "XAccount" ADD COLUMN IF NOT EXISTS "emergencyStop" BOOLEAN DEFAULT false;

-- Create indexes for new XAccount fields
CREATE INDEX IF NOT EXISTS "XAccount_antiDetectionProfileId_idx" ON "XAccount"("antiDetectionProfileId");
CREATE INDEX IF NOT EXISTS "XAccount_detectionRiskScore_idx" ON "XAccount"("detectionRiskScore");
CREATE INDEX IF NOT EXISTS "XAccount_automationPaused_idx" ON "XAccount"("automationPaused");

-- Insert default configuration values
INSERT INTO "AntiDetectionConfig" ("id", "key", "value", "description", "category") VALUES
('proxy_health_check_interval', 'proxy_health_check_interval', '300', 'Proxy health check interval in seconds', 'proxy_management'),
('fingerprint_rotation_interval', 'fingerprint_rotation_interval', '3600', 'Fingerprint rotation interval in seconds', 'fingerprint_management'),
('behavior_monitoring_interval', 'behavior_monitoring_interval', '60', 'Behavior monitoring interval in seconds', 'behavior_simulation'),
('detection_threshold_low', 'detection_threshold_low', '0.3', 'Low detection risk threshold', 'detection_thresholds'),
('detection_threshold_medium', 'detection_threshold_medium', '0.6', 'Medium detection risk threshold', 'detection_thresholds'),
('detection_threshold_high', 'detection_threshold_high', '0.8', 'High detection risk threshold', 'detection_thresholds'),
('emergency_stop_threshold', 'emergency_stop_threshold', '0.95', 'Emergency stop detection threshold', 'safety'),
('max_concurrent_sessions', 'max_concurrent_sessions', '100', 'Maximum concurrent anti-detection sessions', 'performance'),
('analytics_retention_days', 'analytics_retention_days', '30', 'Analytics data retention period in days', 'data_management'),
('audit_log_retention_days', 'audit_log_retention_days', '90', 'Audit log retention period in days', 'data_management')
ON CONFLICT ("key") DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW "ActiveAntiDetectionSessions" AS
SELECT 
    ads.accountId,
    ads.profileId,
    adp.name as profileName,
    adp.riskLevel,
    ps.proxyId,
    p.host as proxyHost,
    p.country as proxyCountry,
    bf.id as fingerprintId,
    bf.platform as fingerprintPlatform,
    bs.id as behaviorSessionId,
    bs.currentPhase as behaviorPhase,
    ads.startTime,
    ads.plannedEndTime
FROM "BehaviorSession" bs
JOIN "XAccount" xa ON bs.accountId = xa.id
LEFT JOIN "AntiDetectionProfile" adp ON xa.antiDetectionProfileId = adp.id
LEFT JOIN "ProxySession" ps ON ps.accountId = xa.id AND ps.isActive = true
LEFT JOIN "Proxy" p ON ps.proxyId = p.id
LEFT JOIN "BrowserFingerprint" bf ON xa.currentFingerprintId = bf.id
WHERE bs.isActive = true;

CREATE OR REPLACE VIEW "DetectionEventSummary" AS
SELECT 
    accountId,
    type,
    severity,
    COUNT(*) as eventCount,
    COUNT(CASE WHEN resolved = false THEN 1 END) as unresolvedCount,
    MAX(createdAt) as lastEventTime,
    AVG(CASE WHEN resolvedAt IS NOT NULL THEN EXTRACT(EPOCH FROM (resolvedAt - createdAt)) END) as avgResolutionTime
FROM "DetectionEvent"
WHERE createdAt >= NOW() - INTERVAL '24 hours'
GROUP BY accountId, type, severity;

CREATE OR REPLACE VIEW "ProxyPerformanceStats" AS
SELECT 
    p.id,
    p.host,
    p.country,
    p.type,
    p.successRate,
    p.responseTime,
    p.failureCount,
    COUNT(ps.id) as totalSessions,
    AVG(ps.avgResponseTime) as avgSessionResponseTime,
    SUM(ps.requestCount) as totalRequests,
    SUM(ps.successCount) as totalSuccesses
FROM "Proxy" p
LEFT JOIN "ProxySession" ps ON p.id = ps.proxyId
WHERE p.isActive = true
GROUP BY p.id, p.host, p.country, p.type, p.successRate, p.responseTime, p.failureCount;

-- Add triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_proxy_updated_at BEFORE UPDATE ON "Proxy" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_browser_fingerprint_updated_at BEFORE UPDATE ON "BrowserFingerprint" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_behavior_pattern_updated_at BEFORE UPDATE ON "BehaviorPattern" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_anti_detection_profile_updated_at BEFORE UPDATE ON "AntiDetectionProfile" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_behavior_session_updated_at BEFORE UPDATE ON "BehaviorSession" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proxy_session_updated_at BEFORE UPDATE ON "ProxySession" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_action_queue_updated_at BEFORE UPDATE ON "ActionQueue" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_anti_detection_config_updated_at BEFORE UPDATE ON "AntiDetectionConfig" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
