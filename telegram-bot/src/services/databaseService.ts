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

      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database tables:', error);
    } finally {
      client.release();
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

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, settings) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (telegram_id) 
         DO UPDATE SET 
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           last_activity = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [telegramId, username, firstName, lastName, {
          automation: {
            enabled: false,
            maxPostsPerDay: 10,
            maxLikesPerDay: 50,
            maxCommentsPerDay: 20,
            maxFollowsPerDay: 10,
            qualityThreshold: 0.8,
            emergencyStop: true
          },
          notifications: {
            telegram: true,
            email: false,
            discord: false,
            dailySummary: true
          },
          preferences: {
            language: 'en',
            timezone: 'UTC',
            theme: 'dark'
          }
        }]
      );

      return result.rows[0] as DatabaseUser;
    } catch (error) {
      logger.error('Error creating user:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async getUserByTelegramId(telegramId: number): Promise<DatabaseUser | null> {
    if (!await this.isHealthy()) return null;

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      return result.rows[0] as DatabaseUser || null;
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
        `SELECT a.* FROM accounts a 
         JOIN users u ON a.user_id = u.id 
         WHERE u.telegram_id = $1 
         ORDER BY a.created_at DESC`,
        [telegramId]
      );

      return result.rows as DatabaseAccount[];
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
}

export const databaseService = new DatabaseService();
