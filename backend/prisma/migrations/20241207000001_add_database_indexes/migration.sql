-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "user_activities_userId_idx" ON "user_activities"("userId");

-- CreateIndex
CREATE INDEX "user_activities_createdAt_idx" ON "user_activities"("createdAt");

-- CreateIndex
CREATE INDEX "user_activities_action_idx" ON "user_activities"("action");

-- CreateIndex
CREATE INDEX "x_accounts_userId_idx" ON "x_accounts"("userId");

-- CreateIndex
CREATE INDEX "x_accounts_isActive_idx" ON "x_accounts"("isActive");

-- CreateIndex
CREATE INDEX "x_accounts_createdAt_idx" ON "x_accounts"("createdAt");

-- CreateIndex
CREATE INDEX "x_accounts_lastActivity_idx" ON "x_accounts"("lastActivity");

-- CreateIndex
CREATE INDEX "x_accounts_userId_isActive_idx" ON "x_accounts"("userId", "isActive");

-- CreateIndex
CREATE INDEX "campaigns_userId_idx" ON "campaigns"("userId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_startDate_idx" ON "campaigns"("startDate");

-- CreateIndex
CREATE INDEX "campaigns_endDate_idx" ON "campaigns"("endDate");

-- CreateIndex
CREATE INDEX "campaigns_userId_status_idx" ON "campaigns"("userId", "status");

-- CreateIndex
CREATE INDEX "automations_accountId_idx" ON "automations"("accountId");

-- CreateIndex
CREATE INDEX "automations_status_idx" ON "automations"("status");

-- CreateIndex
CREATE INDEX "automations_type_idx" ON "automations"("type");

-- CreateIndex
CREATE INDEX "automations_nextRun_idx" ON "automations"("nextRun");

-- CreateIndex
CREATE INDEX "automations_accountId_status_idx" ON "automations"("accountId", "status");

-- CreateIndex
CREATE INDEX "automation_logs_automationId_idx" ON "automation_logs"("automationId");

-- CreateIndex
CREATE INDEX "automation_logs_status_idx" ON "automation_logs"("status");

-- CreateIndex
CREATE INDEX "automation_logs_executedAt_idx" ON "automation_logs"("executedAt");

-- CreateIndex
CREATE INDEX "posts_accountId_idx" ON "posts"("accountId");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt");

-- CreateIndex
CREATE INDEX "posts_scheduledFor_idx" ON "posts"("scheduledFor");

-- CreateIndex
CREATE INDEX "posts_publishedAt_idx" ON "posts"("publishedAt");

-- CreateIndex
CREATE INDEX "posts_accountId_status_idx" ON "posts"("accountId", "status");

-- CreateIndex
CREATE INDEX "posts_accountId_createdAt_idx" ON "posts"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "engagements_accountId_idx" ON "engagements"("accountId");

-- CreateIndex
CREATE INDEX "engagements_type_idx" ON "engagements"("type");

-- CreateIndex
CREATE INDEX "engagements_status_idx" ON "engagements"("status");

-- CreateIndex
CREATE INDEX "engagements_createdAt_idx" ON "engagements"("createdAt");

-- CreateIndex
CREATE INDEX "engagements_accountId_type_idx" ON "engagements"("accountId", "type");

-- CreateIndex
CREATE INDEX "analytics_accountId_idx" ON "analytics"("accountId");

-- CreateIndex
CREATE INDEX "analytics_postId_idx" ON "analytics"("postId");

-- CreateIndex
CREATE INDEX "analytics_date_idx" ON "analytics"("date");

-- CreateIndex
CREATE INDEX "analytics_createdAt_idx" ON "analytics"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_accountId_date_idx" ON "analytics"("accountId", "date");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE INDEX "api_keys_lastUsed_idx" ON "api_keys"("lastUsed");

-- CreateIndex
CREATE INDEX "api_keys_expiresAt_idx" ON "api_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "content_templates_category_idx" ON "content_templates"("category");

-- CreateIndex
CREATE INDEX "content_templates_isActive_idx" ON "content_templates"("isActive");

-- CreateIndex
CREATE INDEX "content_templates_category_isActive_idx" ON "content_templates"("category", "isActive");

-- CreateIndex
CREATE INDEX "trending_hashtags_volume_idx" ON "trending_hashtags"("volume");

-- CreateIndex
CREATE INDEX "trending_hashtags_category_idx" ON "trending_hashtags"("category");

-- CreateIndex
CREATE INDEX "trending_hashtags_updatedAt_idx" ON "trending_hashtags"("updatedAt");
