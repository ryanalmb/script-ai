/**
 * Production-Grade Database Models for X Marketing Platform
 * Comprehensive data models for enterprise deployment
 */

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// User Model - Core user management
class User extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
          len: [3, 50],
          isAlphanumeric: true
        }
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      telegram_id: {
        type: DataTypes.BIGINT,
        unique: true,
        allowNull: true
      },
      telegram_username: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      subscription_tier: {
        type: DataTypes.ENUM('free', 'pro', 'enterprise'),
        defaultValue: 'free'
      },
      subscription_expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      preferences: {
        type: DataTypes.JSONB,
        defaultValue: {
          automation_level: 'beginner',
          notification_settings: {
            email: true,
            telegram: true,
            push: false
          },
          ui_preferences: {
            theme: 'dark',
            language: 'en'
          }
        }
      },
      usage_stats: {
        type: DataTypes.JSONB,
        defaultValue: {
          total_commands: 0,
          total_campaigns: 0,
          total_content_generated: 0,
          last_active: null
        }
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      verification_token: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      reset_password_token: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['email'] },
        { fields: ['telegram_id'] },
        { fields: ['subscription_tier'] },
        { fields: ['is_active'] }
      ]
    });
  }

  // Instance methods
  async validatePassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  generateJWT() {
    return jwt.sign(
      { 
        id: this.id, 
        username: this.username, 
        subscription_tier: this.subscription_tier 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Static methods
  static async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  static associate(models) {
    User.hasMany(models.Conversation, { foreignKey: 'user_id', as: 'conversations' });
    User.hasMany(models.Campaign, { foreignKey: 'user_id', as: 'campaigns' });
    User.hasMany(models.XAccount, { foreignKey: 'user_id', as: 'x_accounts' });
    User.hasMany(models.ExecutionLog, { foreignKey: 'user_id', as: 'execution_logs' });
    User.hasMany(models.ApiKey, { foreignKey: 'user_id', as: 'api_keys' });
  }
}

// Conversation Model - Natural language conversation tracking
class Conversation extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      telegram_chat_id: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      context: {
        type: DataTypes.JSONB,
        defaultValue: {
          user_preferences: {},
          active_accounts: [],
          current_session: {},
          conversation_metadata: {}
        }
      },
      message_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      last_message_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'Conversation',
      tableName: 'conversations',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['telegram_chat_id'] },
        { fields: ['is_active'] },
        { fields: ['last_message_at'] }
      ]
    });
  }

  static associate(models) {
    Conversation.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Conversation.hasMany(models.Message, { foreignKey: 'conversation_id', as: 'messages' });
  }
}

// Message Model - Individual messages in conversations
class Message extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'conversations',
          key: 'id'
        }
      },
      role: {
        type: DataTypes.ENUM('user', 'assistant', 'system'),
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      intent_data: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      execution_data: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {
          processing_time: 0,
          model_used: null,
          confidence_score: 0,
          function_calls: []
        }
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'Message',
      tableName: 'messages',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['conversation_id'] },
        { fields: ['role'] },
        { fields: ['created_at'] }
      ]
    });
  }

  static associate(models) {
    Message.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
  }
}

// Campaign Model - Marketing campaigns
class Campaign extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      objective: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed', 'cancelled'),
        defaultValue: 'draft'
      },
      complexity: {
        type: DataTypes.ENUM('simple', 'moderate', 'complex', 'enterprise'),
        defaultValue: 'simple'
      },
      configuration: {
        type: DataTypes.JSONB,
        defaultValue: {
          target_audience: {},
          content_strategy: {},
          automation_settings: {},
          budget_allocation: {},
          success_metrics: {}
        }
      },
      schedule: {
        type: DataTypes.JSONB,
        defaultValue: {
          start_date: null,
          end_date: null,
          posting_schedule: {},
          automation_schedule: {}
        }
      },
      analytics: {
        type: DataTypes.JSONB,
        defaultValue: {
          impressions: 0,
          engagements: 0,
          clicks: 0,
          conversions: 0,
          roi: 0
        }
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'Campaign',
      tableName: 'campaigns',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['status'] },
        { fields: ['complexity'] },
        { fields: ['created_at'] }
      ]
    });
  }

  static associate(models) {
    Campaign.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Campaign.hasMany(models.Content, { foreignKey: 'campaign_id', as: 'content' });
    Campaign.hasMany(models.ExecutionLog, { foreignKey: 'campaign_id', as: 'execution_logs' });
  }
}

// X Account Model - Connected X/Twitter accounts
class XAccount extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      x_user_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      display_name: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      profile_image_url: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      access_token: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      refresh_token: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      permissions: {
        type: DataTypes.JSONB,
        defaultValue: {
          read: true,
          write: false,
          dm: false
        }
      },
      automation_settings: {
        type: DataTypes.JSONB,
        defaultValue: {
          auto_like: false,
          auto_follow: false,
          auto_comment: false,
          daily_limits: {
            likes: 100,
            follows: 50,
            comments: 20
          }
        }
      },
      analytics: {
        type: DataTypes.JSONB,
        defaultValue: {
          followers_count: 0,
          following_count: 0,
          tweets_count: 0,
          last_sync: null
        }
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'XAccount',
      tableName: 'x_accounts',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['x_user_id'] },
        { fields: ['username'] },
        { fields: ['is_active'] }
      ]
    });
  }

  static associate(models) {
    XAccount.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    XAccount.hasMany(models.Content, { foreignKey: 'x_account_id', as: 'content' });
    XAccount.hasMany(models.AutomationLog, { foreignKey: 'x_account_id', as: 'automation_logs' });
  }
}

// Content Model - Generated and scheduled content
class Content extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      campaign_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'campaigns',
          key: 'id'
        }
      },
      x_account_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'x_accounts',
          key: 'id'
        }
      },
      type: {
        type: DataTypes.ENUM('text', 'image', 'video', 'thread'),
        allowNull: false
      },
      content_text: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      media_urls: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      hashtags: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      mentions: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      generation_metadata: {
        type: DataTypes.JSONB,
        defaultValue: {
          model_used: null,
          prompt: null,
          generation_time: 0,
          quality_score: 0
        }
      },
      scheduling: {
        type: DataTypes.JSONB,
        defaultValue: {
          scheduled_for: null,
          timezone: 'UTC',
          auto_post: false
        }
      },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'posted', 'failed'),
        defaultValue: 'draft'
      },
      x_post_id: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      analytics: {
        type: DataTypes.JSONB,
        defaultValue: {
          impressions: 0,
          likes: 0,
          retweets: 0,
          replies: 0,
          clicks: 0
        }
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'Content',
      tableName: 'content',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['campaign_id'] },
        { fields: ['x_account_id'] },
        { fields: ['type'] },
        { fields: ['status'] },
        { fields: ['created_at'] }
      ]
    });
  }

  static associate(models) {
    Content.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Content.belongsTo(models.Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
    Content.belongsTo(models.XAccount, { foreignKey: 'x_account_id', as: 'x_account' });
  }
}

module.exports = {
  User,
  Conversation,
  Message,
  Campaign,
  XAccount,
  Content
};
