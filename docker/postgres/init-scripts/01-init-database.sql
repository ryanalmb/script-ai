-- PostgreSQL Initialization Script for Script AI
-- This script sets up the database with optimizations for the application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create application-specific schemas
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set up database-level configurations
ALTER DATABASE script_ai SET timezone TO 'UTC';
ALTER DATABASE script_ai SET log_statement TO 'mod';
ALTER DATABASE script_ai SET log_min_duration_statement TO 1000;

-- Create indexes for performance optimization
-- These will be created after Prisma migrations run

-- Create monitoring views
CREATE OR REPLACE VIEW monitoring.database_stats AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables;

CREATE OR REPLACE VIEW monitoring.connection_stats AS
SELECT 
    state,
    count(*) as connection_count,
    max(now() - state_change) as max_duration
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state;

CREATE OR REPLACE VIEW monitoring.slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE calls > 10
ORDER BY mean_time DESC;

-- Create function for database maintenance
CREATE OR REPLACE FUNCTION monitoring.maintenance_info()
RETURNS TABLE(
    table_name text,
    size_pretty text,
    tuple_count bigint,
    dead_tuple_count bigint,
    last_vacuum timestamp with time zone,
    last_analyze timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
        n_live_tup as tuple_count,
        n_dead_tup as dead_tuple_count,
        last_vacuum,
        last_analyze
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function for performance monitoring
CREATE OR REPLACE FUNCTION monitoring.performance_summary()
RETURNS TABLE(
    metric text,
    value text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Total Connections'::text, count(*)::text FROM pg_stat_activity
    UNION ALL
    SELECT 'Active Connections'::text, count(*)::text FROM pg_stat_activity WHERE state = 'active'
    UNION ALL
    SELECT 'Database Size'::text, pg_size_pretty(pg_database_size(current_database()))
    UNION ALL
    SELECT 'Cache Hit Ratio'::text, 
           round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2)::text || '%'
    FROM pg_stat_database WHERE datname = current_database()
    UNION ALL
    SELECT 'Transactions/sec'::text,
           round(sum(xact_commit + xact_rollback) / extract(epoch from (now() - stats_reset)), 2)::text
    FROM pg_stat_database WHERE datname = current_database();
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            new_values,
            user_name,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(NEW),
            current_user,
            now()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            old_values,
            new_values,
            user_name,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(OLD),
            row_to_json(NEW),
            current_user,
            now()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log (
            table_name,
            operation,
            old_values,
            user_name,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            row_to_json(OLD),
            current_user,
            now()
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit.audit_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_name TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_timestamp 
ON audit.audit_log (table_name, timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp 
ON audit.audit_log (timestamp);

-- Create analytics aggregation tables
CREATE TABLE IF NOT EXISTS analytics.daily_metrics (
    date DATE PRIMARY KEY,
    total_accounts INTEGER DEFAULT 0,
    active_accounts INTEGER DEFAULT 0,
    total_tweets INTEGER DEFAULT 0,
    total_engagements INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
    total_followers_gained INTEGER DEFAULT 0,
    total_campaigns INTEGER DEFAULT 0,
    active_campaigns INTEGER DEFAULT 0,
    system_uptime_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics.hourly_metrics (
    hour TIMESTAMP WITH TIME ZONE PRIMARY KEY,
    accounts_synced INTEGER DEFAULT 0,
    tweets_posted INTEGER DEFAULT 0,
    engagements_performed INTEGER DEFAULT 0,
    api_requests INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    websocket_connections INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON analytics.daily_metrics (date);
CREATE INDEX IF NOT EXISTS idx_hourly_metrics_hour ON analytics.hourly_metrics (hour);

-- Create function to update daily metrics
CREATE OR REPLACE FUNCTION analytics.update_daily_metrics()
RETURNS void AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
BEGIN
    INSERT INTO analytics.daily_metrics (date, updated_at)
    VALUES (current_date, now())
    ON CONFLICT (date) 
    DO UPDATE SET updated_at = now();
    
    -- This function will be called by the application to update metrics
    -- The actual metric calculations will be done in the application layer
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old data
CREATE OR REPLACE FUNCTION monitoring.cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Clean up old audit logs (keep 1 year)
    DELETE FROM audit.audit_log 
    WHERE timestamp < now() - interval '1 year';
    
    -- Clean up old hourly metrics (keep 3 months)
    DELETE FROM analytics.hourly_metrics 
    WHERE hour < now() - interval '3 months';
    
    -- Vacuum and analyze tables
    VACUUM ANALYZE audit.audit_log;
    VACUUM ANALYZE analytics.hourly_metrics;
    VACUUM ANALYZE analytics.daily_metrics;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA analytics TO postgres;
GRANT USAGE ON SCHEMA monitoring TO postgres;
GRANT USAGE ON SCHEMA audit TO postgres;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA monitoring TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO postgres;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA monitoring TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO postgres;

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'Script AI database initialization completed successfully';
END $$;
