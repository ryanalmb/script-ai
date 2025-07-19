-- X Marketing Platform Database Initialization
-- This script ensures the database is properly set up

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE x_marketing_platform'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'x_marketing_platform')\gexec

-- Connect to the database
\c x_marketing_platform;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create basic health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE(status text, "timestamp" timestamptz) AS $$
BEGIN
    RETURN QUERY SELECT 'healthy'::text, now();
END;
$$ LANGUAGE plpgsql;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'X Marketing Platform database initialized successfully at %', now();
END $$;
