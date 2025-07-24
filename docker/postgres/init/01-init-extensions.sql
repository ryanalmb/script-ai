-- PostgreSQL Extensions and Configuration for Twikit Integration
-- This script initializes the database with required extensions and optimizations

-- Enable required extensions for Twikit schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create additional schemas if needed
CREATE SCHEMA IF NOT EXISTS twikit;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Set up database-level configurations
ALTER DATABASE x_marketing_platform SET timezone TO 'UTC';
ALTER DATABASE x_marketing_platform SET log_statement TO 'all';
ALTER DATABASE x_marketing_platform SET log_duration TO 'on';
ALTER DATABASE x_marketing_platform SET log_min_duration_statement TO 1000;

-- Create custom types for Twikit integration
DO $$
BEGIN
    -- Session state enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_state_enum') THEN
        CREATE TYPE session_state_enum AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED');
    END IF;
    
    -- Rate limit action enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rate_limit_action_enum') THEN
        CREATE TYPE rate_limit_action_enum AS ENUM (
            'POST_TWEET', 'LIKE', 'RETWEET', 'FOLLOW', 'UNFOLLOW', 
            'REPLY', 'QUOTE', 'BOOKMARK', 'DM', 'SEARCH'
        );
    END IF;
    
    -- Interaction type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_type_enum') THEN
        CREATE TYPE interaction_type_enum AS ENUM (
            'LIKE', 'RETWEET', 'REPLY', 'QUOTE', 'FOLLOW', 'UNFOLLOW', 
            'BLOCK', 'MUTE', 'BOOKMARK', 'DM'
        );
    END IF;
    
    -- Content status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status_enum') THEN
        CREATE TYPE content_status_enum AS ENUM (
            'PENDING', 'PROCESSING', 'POSTED', 'FAILED', 'CANCELLED', 'SCHEDULED'
        );
    END IF;
    
    -- Health status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_status_enum') THEN
        CREATE TYPE health_status_enum AS ENUM (
            'HEALTHY', 'DEGRADED', 'UNHEALTHY', 'CRITICAL', 'UNKNOWN'
        );
    END IF;
END$$;

-- Create custom functions for Twikit operations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to generate correlation IDs
CREATE OR REPLACE FUNCTION generate_correlation_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'corr_' || extract(epoch from now())::bigint || '_' || substr(gen_random_uuid()::text, 1, 8);
END;
$$ language 'plpgsql';

-- Function to calculate rate limit windows
CREATE OR REPLACE FUNCTION calculate_rate_limit_window(window_duration INTEGER)
RETURNS TABLE(window_start TIMESTAMP, window_end TIMESTAMP) AS $$
BEGIN
    RETURN QUERY SELECT 
        date_trunc('minute', now()) - (extract(minute from now())::integer % (window_duration / 60)) * interval '1 minute' AS window_start,
        date_trunc('minute', now()) - (extract(minute from now())::integer % (window_duration / 60)) * interval '1 minute' + (window_duration || ' seconds')::interval AS window_end;
END;
$$ language 'plpgsql';

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- This will be called by Prisma, but we define it for manual cleanup if needed
    DELETE FROM twikit_sessions 
    WHERE expires_at < NOW() 
    AND session_state = 'EXPIRED';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
    likes INTEGER, 
    retweets INTEGER, 
    replies INTEGER, 
    views INTEGER DEFAULT NULL
)
RETURNS NUMERIC AS $$
BEGIN
    IF views IS NULL OR views = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND(((likes + retweets + replies)::NUMERIC / views::NUMERIC) * 100, 2);
END;
$$ language 'plpgsql';

-- Create indexes for performance optimization (will be created by Prisma, but defined here for reference)
-- These are examples of the types of indexes that will be created

-- Performance monitoring views
CREATE OR REPLACE VIEW twikit_performance_summary AS
SELECT 
    'database' as component,
    'PostgreSQL' as type,
    pg_database_size(current_database()) as size_bytes,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    (SELECT count(*) FROM pg_stat_activity) as total_connections,
    now() as last_updated;

-- Rate limiting summary view
CREATE OR REPLACE VIEW rate_limit_summary AS
SELECT 
    account_id,
    action,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE allowed = true) as allowed_requests,
    COUNT(*) FILTER (WHERE allowed = false) as denied_requests,
    ROUND(
        (COUNT(*) FILTER (WHERE allowed = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
        2
    ) as success_rate,
    MAX(timestamp) as last_request
FROM rate_limit_events 
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY account_id, action;

-- Session activity summary
CREATE OR REPLACE VIEW session_activity_summary AS
SELECT 
    account_id,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE session_state = 'ACTIVE') as active_sessions,
    COUNT(*) FILTER (WHERE session_state = 'EXPIRED') as expired_sessions,
    AVG(session_duration) as avg_session_duration,
    MAX(last_activity) as last_activity
FROM twikit_sessions
GROUP BY account_id;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA twikit TO postgres;
GRANT USAGE ON SCHEMA analytics TO postgres;
GRANT USAGE ON SCHEMA monitoring TO postgres;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Log successful initialization
INSERT INTO pg_stat_statements_info (dealloc) VALUES (0) ON CONFLICT DO NOTHING;

-- Create a simple health check table
CREATE TABLE IF NOT EXISTS db_health_check (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'healthy',
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB DEFAULT '{}'::jsonb
);

INSERT INTO db_health_check (status, details) VALUES (
    'initialized', 
    '{"extensions": ["uuid-ossp", "pg_trgm", "btree_gin", "btree_gist", "pg_stat_statements"], "schemas": ["twikit", "analytics", "monitoring"], "timestamp": "' || CURRENT_TIMESTAMP || '"}'::jsonb
) ON CONFLICT DO NOTHING;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Twikit PostgreSQL initialization completed successfully';
    RAISE NOTICE 'Extensions enabled: uuid-ossp, pg_trgm, btree_gin, btree_gist, pg_stat_statements';
    RAISE NOTICE 'Custom schemas created: twikit, analytics, monitoring';
    RAISE NOTICE 'Custom functions and views created for Twikit operations';
END$$;
