-- Setup essential PostgreSQL extensions for enterprise performance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Verify extensions are installed
SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_stat_statements', 'pg_trgm', 'btree_gin', 'btree_gist');
