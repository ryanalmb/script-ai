-- Recommended Database Indexes for Performance Optimization

-- Posts table indexes
CREATE INDEX idx_posts_account_id ON posts(account_id);
CREATE INDEX idx_posts_campaign_id ON posts(campaign_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled_for ON posts(scheduled_for);

-- Analytics table indexes
CREATE INDEX idx_analytics_account_id ON analytics(account_id);
CREATE INDEX idx_analytics_post_id ON analytics(post_id);
CREATE INDEX idx_analytics_date ON analytics(date DESC);

-- X Accounts table indexes
CREATE INDEX idx_x_accounts_user_id ON x_accounts(user_id);
CREATE INDEX idx_x_accounts_status ON x_accounts(status);
CREATE INDEX idx_x_accounts_created_at ON x_accounts(created_at DESC);

-- Campaigns table indexes
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX idx_campaigns_end_date ON campaigns(end_date);

-- User Sessions table indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Composite indexes for common queries
CREATE INDEX idx_posts_account_status ON posts(account_id, status);
CREATE INDEX idx_analytics_account_date ON analytics(account_id, date DESC);
CREATE INDEX idx_campaigns_user_status ON campaigns(user_id, status);
