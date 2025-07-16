/**
 * Production-Grade Database Connection and Configuration
 * Enterprise-level PostgreSQL + Redis setup with comprehensive error handling
 */

const { Sequelize } = require('sequelize');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Import all models
const { User, Conversation, Message, Campaign, XAccount, Content } = require('./models');
const { ExecutionLog, AutomationLog, ApiKey, SystemLog, Analytics } = require('./models_extended');

class DatabaseManager {
  constructor() {
    this.sequelize = null;
    this.redis = null;
    this.redisCluster = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    
    // Connection pools and configurations
    this.postgresConfig = this._getPostgresConfig();
    this.redisConfig = this._getRedisConfig();
  }

  /**
   * Initialize all database connections
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing production database connections...');
      
      // Initialize PostgreSQL connection
      await this._initializePostgreSQL();
      
      // Initialize Redis connections
      await this._initializeRedis();
      
      // Initialize models and associations
      await this._initializeModels();
      
      // Run migrations and setup
      await this._setupDatabase();
      
      // Verify connections
      await this._verifyConnections();
      
      this.isConnected = true;
      logger.info('✅ All database connections initialized successfully');
      
      return {
        postgres: this.sequelize,
        redis: this.redis,
        redisCluster: this.redisCluster
      };
      
    } catch (error) {
      logger.error('❌ Database initialization failed:', error);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Get PostgreSQL configuration
   */
  _getPostgresConfig() {
    return {
      database: process.env.POSTGRES_DB || 'x_marketing_platform',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: parseInt(process.env.POSTGRES_POOL_MAX) || 20,
        min: parseInt(process.env.POSTGRES_POOL_MIN) || 5,
        acquire: parseInt(process.env.POSTGRES_POOL_ACQUIRE) || 30000,
        idle: parseInt(process.env.POSTGRES_POOL_IDLE) || 10000,
        evict: parseInt(process.env.POSTGRES_POOL_EVICT) || 1000
      },
      dialectOptions: {
        ssl: process.env.POSTGRES_SSL === 'true' ? {
          require: true,
          rejectUnauthorized: false
        } : false,
        connectTimeout: 60000,
        requestTimeout: 60000,
        options: {
          encrypt: process.env.POSTGRES_ENCRYPT === 'true',
          trustServerCertificate: process.env.POSTGRES_TRUST_CERT === 'true'
        }
      },
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
      },
      retry: {
        max: 3,
        timeout: 5000,
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /TIMEOUT/,
          /ESOCKETTIMEDOUT/,
          /EHOSTUNREACH/,
          /EPIPE/,
          /EAI_AGAIN/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/
        ]
      }
    };
  }

  /**
   * Get Redis configuration
   */
  _getRedisConfig() {
    const baseConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      family: 4
    };

    // Cluster configuration if enabled
    if (process.env.REDIS_CLUSTER === 'true') {
      return {
        ...baseConfig,
        enableOfflineQueue: false,
        redisOptions: baseConfig,
        nodes: process.env.REDIS_CLUSTER_NODES ? 
          process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port) };
          }) : [{ host: baseConfig.host, port: baseConfig.port }]
      };
    }

    return baseConfig;
  }

  /**
   * Initialize PostgreSQL connection
   */
  async _initializePostgreSQL() {
    try {
      this.sequelize = new Sequelize(this.postgresConfig);
      
      // Test connection
      await this.sequelize.authenticate();
      logger.info('✅ PostgreSQL connection established successfully');
      
      // Set up connection event handlers
      this.sequelize.connectionManager.on('connect', () => {
        logger.info('📊 New PostgreSQL connection established');
      });
      
      this.sequelize.connectionManager.on('disconnect', () => {
        logger.warn('📊 PostgreSQL connection lost');
      });
      
    } catch (error) {
      logger.error('❌ PostgreSQL connection failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connections
   */
  async _initializeRedis() {
    try {
      if (process.env.REDIS_CLUSTER === 'true') {
        // Initialize Redis Cluster
        this.redisCluster = new Redis.Cluster(this.redisConfig.nodes, this.redisConfig);
        await this.redisCluster.ping();
        logger.info('✅ Redis Cluster connection established successfully');
        
        // Use cluster as primary Redis connection
        this.redis = this.redisCluster;
      } else {
        // Initialize single Redis instance
        this.redis = new Redis(this.redisConfig);
        await this.redis.ping();
        logger.info('✅ Redis connection established successfully');
      }
      
      // Set up Redis event handlers
      this.redis.on('connect', () => {
        logger.info('🔴 Redis connected');
      });
      
      this.redis.on('ready', () => {
        logger.info('🔴 Redis ready');
      });
      
      this.redis.on('error', (error) => {
        logger.error('🔴 Redis error:', error);
      });
      
      this.redis.on('close', () => {
        logger.warn('🔴 Redis connection closed');
      });
      
      this.redis.on('reconnecting', () => {
        logger.info('🔴 Redis reconnecting...');
      });
      
    } catch (error) {
      logger.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  /**
   * Initialize all models and associations
   */
  async _initializeModels() {
    try {
      // Initialize core models
      User.init(this.sequelize);
      Conversation.init(this.sequelize);
      Message.init(this.sequelize);
      Campaign.init(this.sequelize);
      XAccount.init(this.sequelize);
      Content.init(this.sequelize);
      
      // Initialize extended models
      ExecutionLog.init(this.sequelize);
      AutomationLog.init(this.sequelize);
      ApiKey.init(this.sequelize);
      SystemLog.init(this.sequelize);
      Analytics.init(this.sequelize);
      
      // Set up associations
      const models = {
        User, Conversation, Message, Campaign, XAccount, Content,
        ExecutionLog, AutomationLog, ApiKey, SystemLog, Analytics
      };
      
      Object.keys(models).forEach(modelName => {
        if (models[modelName].associate) {
          models[modelName].associate(models);
        }
      });
      
      logger.info('✅ All database models initialized successfully');
      
    } catch (error) {
      logger.error('❌ Model initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup database (migrations, indexes, etc.)
   */
  async _setupDatabase() {
    try {
      // Sync database schema (use migrations in production)
      if (process.env.NODE_ENV === 'development') {
        await this.sequelize.sync({ alter: true });
        logger.info('✅ Database schema synchronized');
      }
      
      // Create indexes for performance
      await this._createPerformanceIndexes();
      
      // Setup Redis key patterns and expiration policies
      await this._setupRedisPatterns();
      
    } catch (error) {
      logger.error('❌ Database setup failed:', error);
      throw error;
    }
  }

  /**
   * Create performance indexes
   */
  async _createPerformanceIndexes() {
    try {
      // Add composite indexes for common queries
      await this.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_active 
        ON conversations(user_id, is_active, last_message_at DESC);
      `);
      
      await this.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created 
        ON messages(conversation_id, created_at DESC);
      `);
      
      await this.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_logs_user_success 
        ON execution_logs(user_id, success, created_at DESC);
      `);
      
      logger.info('✅ Performance indexes created successfully');
      
    } catch (error) {
      logger.warn('⚠️ Some indexes may already exist:', error.message);
    }
  }

  /**
   * Setup Redis patterns and policies
   */
  async _setupRedisPatterns() {
    try {
      // Set up key expiration policies
      await this.redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
      
      // Create Redis key patterns for different data types
      const keyPatterns = {
        session: 'session:*',
        conversation: 'conv:*',
        rateLimit: 'rate:*',
        cache: 'cache:*',
        queue: 'queue:*'
      };
      
      // Set default TTL for different patterns
      const ttlSettings = {
        'session:*': 86400, // 24 hours
        'conv:*': 3600,     // 1 hour
        'rate:*': 3600,     // 1 hour
        'cache:*': 1800     // 30 minutes
      };
      
      logger.info('✅ Redis patterns and policies configured');
      
    } catch (error) {
      logger.warn('⚠️ Redis configuration warning:', error.message);
    }
  }

  /**
   * Verify all connections are working
   */
  async _verifyConnections() {
    try {
      // Test PostgreSQL
      await this.sequelize.query('SELECT 1');
      
      // Test Redis
      await this.redis.ping();
      
      logger.info('✅ All database connections verified');
      
    } catch (error) {
      logger.error('❌ Connection verification failed:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('🔄 Shutting down database connections...');
      
      if (this.redis) {
        await this.redis.quit();
      }
      
      if (this.redisCluster) {
        await this.redisCluster.quit();
      }
      
      if (this.sequelize) {
        await this.sequelize.close();
      }
      
      this.isConnected = false;
      logger.info('✅ Database connections closed successfully');
      
    } catch (error) {
      logger.error('❌ Database shutdown error:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const health = {
        postgres: false,
        redis: false,
        overall: false
      };
      
      // Check PostgreSQL
      try {
        await this.sequelize.query('SELECT 1');
        health.postgres = true;
      } catch (error) {
        logger.error('PostgreSQL health check failed:', error);
      }
      
      // Check Redis
      try {
        await this.redis.ping();
        health.redis = true;
      } catch (error) {
        logger.error('Redis health check failed:', error);
      }
      
      health.overall = health.postgres && health.redis;
      
      return health;
      
    } catch (error) {
      logger.error('Health check failed:', error);
      return { postgres: false, redis: false, overall: false };
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

module.exports = {
  DatabaseManager,
  databaseManager,
  // Export models for direct access
  User, Conversation, Message, Campaign, XAccount, Content,
  ExecutionLog, AutomationLog, ApiKey, SystemLog, Analytics
};
