-- Twikit Monitoring Dashboard Schema Migration - Task 25
-- 
-- This migration adds comprehensive monitoring tables for the Twikit monitoring dashboard.
-- It includes tables for metrics storage, alert rules, alert channels, escalation policies,
-- and active/historical alerts.
--
-- Tables added:
-- - twikit_metrics: Comprehensive metrics storage
-- - twikit_alert_rules: Alert rules configuration
-- - twikit_alert_channels: Alert channels configuration
-- - twikit_escalation_policies: Escalation policies for alert management
-- - twikit_alerts: Active and historical alerts
--
-- Migration Date: 2024-12-28
-- Task: 25 - Implement Comprehensive Twikit Monitoring Dashboard Service

-- ============================================================================
-- TWIKIT METRICS TABLE
-- ============================================================================

-- Comprehensive metrics storage for Twikit monitoring dashboard
CREATE TABLE IF NOT EXISTS "twikit_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}'
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "twikit_metrics_metric_timestamp_idx" ON "twikit_metrics"("metric", "timestamp");
CREATE INDEX IF NOT EXISTS "twikit_metrics_timestamp_idx" ON "twikit_metrics"("timestamp");
CREATE INDEX IF NOT EXISTS "twikit_metrics_metric_idx" ON "twikit_metrics"("metric");

-- ============================================================================
-- TWIKIT ALERT RULES TABLE
-- ============================================================================

-- Alert rules configuration for intelligent alerting
CREATE TABLE IF NOT EXISTS "twikit_alert_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "severity" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "twikit_alert_rules_enabled_idx" ON "twikit_alert_rules"("enabled");
CREATE INDEX IF NOT EXISTS "twikit_alert_rules_metric_idx" ON "twikit_alert_rules"("metric");
CREATE INDEX IF NOT EXISTS "twikit_alert_rules_severity_idx" ON "twikit_alert_rules"("severity");

-- ============================================================================
-- TWIKIT ALERT CHANNELS TABLE
-- ============================================================================

-- Alert channels configuration for multi-channel notifications
CREATE TABLE IF NOT EXISTS "twikit_alert_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "twikit_alert_channels_enabled_idx" ON "twikit_alert_channels"("enabled");
CREATE INDEX IF NOT EXISTS "twikit_alert_channels_type_idx" ON "twikit_alert_channels"("type");
CREATE INDEX IF NOT EXISTS "twikit_alert_channels_priority_idx" ON "twikit_alert_channels"("priority");

-- ============================================================================
-- TWIKIT ESCALATION POLICIES TABLE
-- ============================================================================

-- Escalation policies for alert management
CREATE TABLE IF NOT EXISTS "twikit_escalation_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "triggers" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "twikit_escalation_policies_enabled_idx" ON "twikit_escalation_policies"("enabled");

-- ============================================================================
-- TWIKIT ALERTS TABLE
-- ============================================================================

-- Active and historical alerts
CREATE TABLE IF NOT EXISTS "twikit_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "currentValue" REAL NOT NULL,
    "threshold" REAL NOT NULL,
    "condition" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP,
    "acknowledgedAt" TIMESTAMP,
    "acknowledgedBy" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    
    -- Foreign key constraint
    CONSTRAINT "twikit_alerts_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "twikit_alert_rules"("id") ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "twikit_alerts_status_idx" ON "twikit_alerts"("status");
CREATE INDEX IF NOT EXISTS "twikit_alerts_severity_idx" ON "twikit_alerts"("severity");
CREATE INDEX IF NOT EXISTS "twikit_alerts_ruleId_idx" ON "twikit_alerts"("ruleId");
CREATE INDEX IF NOT EXISTS "twikit_alerts_createdAt_idx" ON "twikit_alerts"("createdAt");
CREATE INDEX IF NOT EXISTS "twikit_alerts_status_createdAt_idx" ON "twikit_alerts"("status", "createdAt");

-- ============================================================================
-- DEFAULT DATA INSERTION
-- ============================================================================

-- Insert default alert channels
INSERT INTO "twikit_alert_channels" ("id", "type", "name", "config", "enabled", "priority") VALUES
    ('system_log', 'system_log', 'System Log', '{}', true, 'medium')
ON CONFLICT ("id") DO NOTHING;

-- Insert default escalation policy
INSERT INTO "twikit_escalation_policies" ("id", "name", "triggers", "actions", "enabled") VALUES
    ('default', 'Default Escalation', 
     '{"severity": ["critical"], "duration": 5, "conditions": []}',
     '{"channels": ["system_log"], "autoResolve": false, "suppressDuplicates": true}',
     true)
ON CONFLICT ("id") DO NOTHING;

-- Insert default alert rules
INSERT INTO "twikit_alert_rules" ("id", "name", "description", "metric", "condition", "threshold", "severity", "duration", "enabled", "tags", "channels") VALUES
    ('session_success_rate_low', 'Session Success Rate Low', 'Session success rate has dropped below 80%', 'sessions.successRate', 'lt', 80, 'warning', 5, true, ARRAY['sessions', 'performance'], ARRAY['system_log']),
    ('proxy_health_critical', 'Proxy Health Critical', 'Average proxy health score is critically low', 'proxies.averageHealthScore', 'lt', 50, 'critical', 2, true, ARRAY['proxies', 'health'], ARRAY['system_log']),
    ('rate_limit_utilization_high', 'Rate Limit Utilization High', 'Rate limit utilization is above 90%', 'rateLimiting.utilizationPercentage', 'gt', 90, 'warning', 3, true, ARRAY['rate_limiting', 'capacity'], ARRAY['system_log']),
    ('anti_detection_score_low', 'Anti-Detection Score Low', 'Anti-detection effectiveness score is below threshold', 'antiDetection.overallScore', 'lt', 70, 'error', 5, true, ARRAY['anti_detection', 'security'], ARRAY['system_log']),
    ('account_health_degraded', 'Account Health Degraded', 'Average account health score is degraded', 'accountHealth.averageHealthScore', 'lt', 75, 'warning', 10, true, ARRAY['accounts', 'health'], ARRAY['system_log']),
    ('emergency_system_active', 'Emergency System Active', 'Emergency stop system has been activated', 'emergencySystem.isActive', 'eq', 1, 'critical', 0, true, ARRAY['emergency', 'system'], ARRAY['system_log'])
ON CONFLICT ("id") DO NOTHING;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Additional composite indexes for better query performance
CREATE INDEX IF NOT EXISTS "twikit_metrics_metric_value_timestamp_idx" ON "twikit_metrics"("metric", "value", "timestamp");
CREATE INDEX IF NOT EXISTS "twikit_alert_rules_enabled_severity_idx" ON "twikit_alert_rules"("enabled", "severity");
CREATE INDEX IF NOT EXISTS "twikit_alerts_ruleId_status_idx" ON "twikit_alerts"("ruleId", "status");
CREATE INDEX IF NOT EXISTS "twikit_alerts_severity_status_idx" ON "twikit_alerts"("severity", "status");

-- ============================================================================
-- DATA RETENTION TRIGGERS
-- ============================================================================

-- Function to clean up old metrics (called by monitoring service)
CREATE OR REPLACE FUNCTION cleanup_old_twikit_metrics()
RETURNS void AS $$
BEGIN
    -- Delete detailed metrics older than retention period
    DELETE FROM "twikit_metrics" 
    WHERE "timestamp" < NOW() - INTERVAL '30 days'
    AND "tags"->>'type' = 'individual';
    
    -- Delete comprehensive metrics older than aggregated retention period
    DELETE FROM "twikit_metrics" 
    WHERE "timestamp" < NOW() - INTERVAL '365 days'
    AND "tags"->>'type' = 'comprehensive';
    
    -- Delete resolved alerts older than 90 days
    DELETE FROM "twikit_alerts" 
    WHERE "status" = 'resolved' 
    AND "resolvedAt" < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for recent metrics summary
CREATE OR REPLACE VIEW "twikit_metrics_summary" AS
SELECT 
    "metric",
    COUNT(*) as "total_records",
    AVG("value") as "avg_value",
    MIN("value") as "min_value",
    MAX("value") as "max_value",
    MAX("timestamp") as "last_updated"
FROM "twikit_metrics"
WHERE "timestamp" > NOW() - INTERVAL '24 hours'
GROUP BY "metric"
ORDER BY "last_updated" DESC;

-- View for active alerts summary
CREATE OR REPLACE VIEW "twikit_active_alerts_summary" AS
SELECT 
    "severity",
    COUNT(*) as "alert_count",
    MIN("createdAt") as "oldest_alert",
    MAX("createdAt") as "newest_alert"
FROM "twikit_alerts"
WHERE "status" = 'active'
GROUP BY "severity"
ORDER BY 
    CASE "severity"
        WHEN 'critical' THEN 1
        WHEN 'error' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'info' THEN 4
    END;

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

-- Log migration completion
INSERT INTO "twikit_metrics" ("id", "metric", "value", "timestamp", "tags", "metadata") VALUES
    (
        'migration_' || extract(epoch from now())::text,
        'system.migration_completed',
        1,
        NOW(),
        '{"type": "system", "migration": "twikit_monitoring_dashboard"}',
        '{"migration_date": "2024-12-28", "task": "25", "description": "Twikit Monitoring Dashboard Schema"}'
    );

-- Migration completed successfully
-- Task 25: Comprehensive Twikit Monitoring Dashboard Service
-- Tables created: 5
-- Indexes created: 15+
-- Default data inserted: 8 records
-- Views created: 2
-- Functions created: 1
