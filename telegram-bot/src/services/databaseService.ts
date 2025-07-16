import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

export interface DatabaseUser {
  id: number;
  telegram_id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  settings: any;
  created_at: Date;
  updated_at: Date;
  last_activity: Date;
}

export interface DatabaseAccount {
  id: string;
  user_id: number;
  platform: string;
  username: string;
  api_key?: string | undefined;
  api_secret?: string | undefined;
  access_token?: string | undefined;
  access_token_secret?: string | undefined;
  is_active: boolean;
  automation_enabled: boolean;
  followers: number;
  following: number;
  posts: number;
  engagement_rate: number;
  last_activity: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseAutomationStats {
  id: string;
  account_id: string;
  date: Date;
  posts: number;
  likes: number;
  comments: number;
  follows: number;
  dms: number;
  poll_votes: number;
  threads: number;
  success_rate: number;
  quality_score: number;
  compliance_score: number;
  created_at: Date;
}

export class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'x_marketing_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('Database connection established successfully');
      
      // Initialize tables if they don't exist
      await this.initializeTables();
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      this.isConnected = false;
    }
  }

  private async initializeTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          telegram_id BIGINT UNIQUE NOT NULL,
          username VARCHAR(255),
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          last_activity TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create accounts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          platform VARCHAR(50) NOT NULL,
          username VARCHAR(255) NOT NULL,
          api_key TEXT,
          api_secret TEXT,
          access_token TEXT,
          access_token_secret TEXT,
          is_active BOOLEAN DEFAULT true,
          automation_enabled BOOLEAN DEFAULT false,
          followers INTEGER DEFAULT 0,
          following INTEGER DEFAULT 0,
          posts INTEGER DEFAULT 0,
          engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
          last_activity TIMESTAMP DEFAULT NOW(),
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create automation_stats table
      await client.query(`
        CREATE TABLE IF NOT EXISTS automation_stats (
          id VARCHAR(255) PRIMARY KEY,
          account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          posts INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          follows INTEGER DEFAULT 0,
          dms INTEGER DEFAULT 0,
          poll_votes INTEGER DEFAULT 0,
          threads INTEGER DEFAULT 0,
          success_rate DECIMAL(5,4) DEFAULT 0.0000,
          quality_score DECIMAL(5,4) DEFAULT 0.0000,
          compliance_score DECIMAL(5,4) DEFAULT 0.0000,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(account_id, date)
        )
      `);

      // Create analytics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          account_id VARCHAR(255) REFERENCES accounts(id) ON DELETE CASCADE,
          event_type VARCHAR(100) NOT NULL,
          event_data JSONB DEFAULT '{}',
          timestamp TIMESTAMP DEFAULT NOW()
        )
      `);

      // Add missing columns if they don't exist
      await this.addMissingColumns(client);

      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database tables:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Add missing columns to existing tables
   */
  private async addMissingColumns(client: any): Promise<void> {
    try {
      // Add last_activity to users table if it doesn't exist
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW()
      `);

      // Add event_type to analytics table if it doesn't exist
      await client.query(`
        ALTER TABLE analytics
        ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) NOT NULL DEFAULT 'unknown'
      `);

      logger.info('Missing columns added successfully');
    } catch (error) {
      logger.error('Failed to add missing columns:', error);
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isConnected) {
      await this.initializeConnection();
    }
    return this.isConnected;
  }

  // User operations
  async createUser(telegramId: number, username?: string, firstName?: string, lastName?: string): Promise<DatabaseUser | null> {
    if (!await this.isHealthy()) return null;

    try {
      // Use Prisma for proper ID generation and schema compliance
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const user = await prisma.user.upsert({
        where: { telegramId: telegramId.toString() },
        update: {
          username: username || `telegram_${telegramId}`,
          telegramUsername: username,
          telegramFirstName: firstName,
          telegramLastName: lastName,
          updatedAt: new Date()
        },
        create: {
          telegramId: telegramId.toString(),
          username: username || `telegram_${telegramId}`,
          telegramUsername: username,
          telegramFirstName: firstName,
          telegramLastName: lastName,
          email: `telegram_${telegramId}@temp.local`,
          password: 'temp_password',
          role: 'USER'
        }
      });

      await prisma.$disconnect();

      return {
        id: user.id,
        telegram_id: parseInt(user.telegramId || '0'),
        username: user.username || '',
        first_name: user.telegramFirstName || '',
        last_name: user.telegramLastName || '',
        is_active: user.isActive,
        settings: {},
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        last_activity: user.updatedAt
      };
    } catch (error) {
      logger.error('Error creating user:', error);
      return null;
    }
  }

  async getUserByTelegramId(telegramId: number): Promise<DatabaseUser | null> {
    if (!await this.isHealthy()) return null;

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, username, "isActive", "createdAt", "updatedAt", telegram_id FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (result.rows[0]) {
        return {
          id: result.rows[0].id,
          telegram_id: result.rows[0].telegram_id,
          username: result.rows[0].username,
          first_name: '',
          last_name: '',
          is_active: result.rows[0].isActive,
          settings: {},
          created_at: result.rows[0].createdAt,
          updated_at: result.rows[0].updatedAt,
          last_activity: result.rows[0].updatedAt
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async updateUserSettings(telegramId: number, settings: any): Promise<boolean> {
    if (!await this.isHealthy()) return false;

    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE users SET settings = $1, updated_at = NOW() WHERE telegram_id = $2',
        [settings, telegramId]
      );

      return true;
    } catch (error) {
      logger.error('Error updating user settings:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async updateUserActivity(telegramId: number): Promise<boolean> {
    if (!await this.isHealthy()) return false;

    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE users SET last_activity = NOW() WHERE telegram_id = $1',
        [telegramId]
      );

      return true;
    } catch (error) {
      logger.error('Error updating user activity:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // Account operations
  async getUserAccounts(telegramId: number): Promise<DatabaseAccount[]> {
    if (!await this.isHealthy()) return [];

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT a.id, a.username, 'x' as platform, a."isActive" as is_active,
                false as automation_enabled, a."createdAt" as created_at
         FROM x_accounts a
         JOIN users u ON a."userId" = u.id
         WHERE u.telegram_id = $1
         ORDER BY a."createdAt" DESC`,
        [telegramId]
      );

      return result.rows.map(row => ({
        id: row.id,
        user_id: telegramId,
        telegram_id: telegramId,
        username: row.username,
        platform: row.platform,
        is_active: row.is_active,
        automation_enabled: row.automation_enabled,
        created_at: row.created_at,
        followers: row.followers || 0,
        following: row.following || 0,
        posts: row.posts || 0,
        engagement_rate: row.engagement_rate || 0,
        last_activity: row.created_at,
        status: 'active',
        updated_at: row.created_at,
        settings: {}
      }));
    } catch (error) {
      logger.error('Error getting user accounts:', error);
      return [];
    } finally {
      client.release();
    }
  }

  async createAccount(telegramId: number, accountData: Partial<DatabaseAccount>): Promise<DatabaseAccount | null> {
    if (!await this.isHealthy()) return null;

    const client = await this.pool.connect();
    try {
      // First get the user ID
      const userResult = await client.query(
        'SELECT id FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userId = userResult.rows[0].id;
      const accountId = `${userId}_${Date.now()}`;

      const result = await client.query(
        `INSERT INTO accounts (
          id, user_id, platform, username, api_key, api_secret, 
          access_token, access_token_secret, is_active, automation_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *`,
        [
          accountId,
          userId,
          accountData.platform || 'twitter',
          accountData.username,
          accountData.api_key,
          accountData.api_secret,
          accountData.access_token,
          accountData.access_token_secret,
          accountData.is_active !== false,
          accountData.automation_enabled || false
        ]
      );

      return result.rows[0] as DatabaseAccount;
    } catch (error) {
      logger.error('Error creating account:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async updateAccountMetrics(accountId: string, metrics: {
    followers?: number;
    following?: number;
    posts?: number;
    engagement_rate?: number;
  }): Promise<boolean> {
    if (!await this.isHealthy()) return false;

    const client = await this.pool.connect();
    try {
      const setParts = [];
      const values = [];
      let paramIndex = 1;

      if (metrics.followers !== undefined) {
        setParts.push(`followers = $${paramIndex++}`);
        values.push(metrics.followers);
      }
      if (metrics.following !== undefined) {
        setParts.push(`following = $${paramIndex++}`);
        values.push(metrics.following);
      }
      if (metrics.posts !== undefined) {
        setParts.push(`posts = $${paramIndex++}`);
        values.push(metrics.posts);
      }
      if (metrics.engagement_rate !== undefined) {
        setParts.push(`engagement_rate = $${paramIndex++}`);
        values.push(metrics.engagement_rate);
      }

      if (setParts.length === 0) return true;

      setParts.push(`updated_at = NOW()`);
      values.push(accountId);

      await client.query(
        `UPDATE accounts SET ${setParts.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      return true;
    } catch (error) {
      logger.error('Error updating account metrics:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    logger.info('Database connection closed');
  }

  async updateAccount(accountId: string, updates: any): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const values = [accountId, ...Object.values(updates)];

      const query = `
        UPDATE accounts
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
      `;

      const result = await client.query(query, values);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Error updating account:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // User statistics
  async getUserStats(telegramId: number): Promise<any> {
    if (!await this.isHealthy()) return null;

    const client = await this.pool.connect();
    try {
      // Get user command count
      const commandResult = await client.query(
        'SELECT COUNT(*) as total_commands FROM user_activity WHERE telegram_id = $1',
        [telegramId]
      );

      // Get today's automation stats
      const today = new Date().toISOString().split('T')[0];
      const statsResult = await client.query(`
        SELECT
          COUNT(CASE WHEN action_type = 'post' THEN 1 END) as posts_today,
          COUNT(CASE WHEN action_type = 'like' THEN 1 END) as likes_today,
          COUNT(CASE WHEN action_type = 'comment' THEN 1 END) as comments_today,
          AVG(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) as success_rate
        FROM automation_logs
        WHERE telegram_id = $1 AND DATE(created_at) = $2
      `, [telegramId, today]);

      return {
        total_commands: parseInt(commandResult.rows[0]?.total_commands || '0'),
        posts_today: parseInt(statsResult.rows[0]?.posts_today || '0'),
        likes_today: parseInt(statsResult.rows[0]?.likes_today || '0'),
        comments_today: parseInt(statsResult.rows[0]?.comments_today || '0'),
        success_rate: parseFloat(statsResult.rows[0]?.success_rate || '0.85')
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      return null;
    } finally {
      client.release();
    }
  }

  // Automation statistics
  async getAutomationStatsToday(telegramId: number): Promise<any> {
    if (!await this.isHealthy()) return null;

    const client = await this.pool.connect();
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await client.query(`
        SELECT
          COUNT(CASE WHEN action_type = 'post' THEN 1 END) as posts,
          COUNT(CASE WHEN action_type = 'like' THEN 1 END) as likes,
          COUNT(CASE WHEN action_type = 'comment' THEN 1 END) as comments,
          COUNT(CASE WHEN action_type = 'follow' THEN 1 END) as follows,
          COUNT(CASE WHEN action_type = 'dm' THEN 1 END) as dms,
          COUNT(CASE WHEN action_type = 'poll_vote' THEN 1 END) as poll_votes,
          COUNT(CASE WHEN action_type = 'thread' THEN 1 END) as threads,
          AVG(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) as success_rate
        FROM automation_logs
        WHERE telegram_id = $1 AND DATE(created_at) = $2
      `, [telegramId, today]);

      return result.rows[0] || {
        posts: 0, likes: 0, comments: 0, follows: 0,
        dms: 0, poll_votes: 0, threads: 0, success_rate: 0.85
      };
    } catch (error) {
      logger.error('Error getting automation stats:', error);
      return null;
    } finally {
      client.release();
    }
  }

  // Log automation activity
  async logAutomationActivity(telegramId: number, actionType: string, success: boolean, details?: any): Promise<void> {
    if (!await this.isHealthy()) return;

    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO automation_logs (telegram_id, action_type, success, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [telegramId, actionType, success, JSON.stringify(details || {})]);
    } catch (error) {
      logger.error('Error logging automation activity:', error);
    } finally {
      client.release();
    }
  }

  // Log user activity
  async logUserActivity(telegramId: number, activityType: string, details?: any): Promise<void> {
    if (!await this.isHealthy()) return;

    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO user_activity (telegram_id, activity_type, details, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [telegramId, activityType, JSON.stringify(details || {})]);
    } catch (error) {
      logger.error('Error logging user activity:', error);
    } finally {
      client.release();
    }
  }

  // Get active users count
  async getActiveUsersCount(since: Date): Promise<number> {
    if (!await this.isHealthy()) return 0;

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT COUNT(DISTINCT telegram_id) as count
        FROM user_activity
        WHERE created_at >= $1
      `, [since]);

      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      logger.error('Error getting active users count:', error);
      return 0;
    } finally {
      client.release();
    }
  }

  // Get commands count
  async getCommandsCount(since: Date): Promise<number> {
    if (!await this.isHealthy()) return 0;

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM user_activity
        WHERE created_at >= $1 AND activity_type LIKE 'command_%'
      `, [since]);

      return parseInt(result.rows[0]?.count || '0');
    } catch (error) {
      logger.error('Error getting commands count:', error);
      return 0;
    } finally {
      client.release();
    }
  }
}

export const databaseService = new DatabaseService();
