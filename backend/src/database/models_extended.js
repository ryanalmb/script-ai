/**
 * Extended Production-Grade Database Models
 * Additional models for comprehensive enterprise functionality
 */

const { DataTypes, Model } = require('sequelize');

// Execution Log Model - Track all natural language executions
class ExecutionLog extends Model {
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
      conversation_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'conversations',
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
      execution_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      user_input: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      intent_data: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      execution_plan: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      execution_result: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      functions_executed: {
        type: DataTypes.JSONB,
        defaultValue: []
      },
      success: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      success_rate: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.0
      },
      execution_time: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: false
      },
      processing_time: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: false
      },
      error_details: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {
          model_used: null,
          complexity_level: null,
          ai_enhanced: false,
          confirmation_required: false
        }
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'ExecutionLog',
      tableName: 'execution_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['conversation_id'] },
        { fields: ['campaign_id'] },
        { fields: ['execution_id'] },
        { fields: ['success'] },
        { fields: ['created_at'] }
      ]
    });
  }

  static associate(models) {
    ExecutionLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    ExecutionLog.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
    ExecutionLog.belongsTo(models.Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
  }
}

// Automation Log Model - Track automation activities
class AutomationLog extends Model {
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
      x_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'x_accounts',
          key: 'id'
        }
      },
      automation_type: {
        type: DataTypes.ENUM('like', 'follow', 'unfollow', 'comment', 'retweet', 'dm'),
        allowNull: false
      },
      target_user_id: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      target_post_id: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      action_data: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      success: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      rate_limit_hit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'AutomationLog',
      tableName: 'automation_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['x_account_id'] },
        { fields: ['automation_type'] },
        { fields: ['success'] },
        { fields: ['created_at'] }
      ]
    });
  }

  static associate(models) {
    AutomationLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    AutomationLog.belongsTo(models.XAccount, { foreignKey: 'x_account_id', as: 'x_account' });
  }
}

// API Key Model - Manage API access
class ApiKey extends Model {
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
        type: DataTypes.STRING(100),
        allowNull: false
      },
      key_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      permissions: {
        type: DataTypes.JSONB,
        defaultValue: {
          read: true,
          write: false,
          admin: false
        }
      },
      rate_limit: {
        type: DataTypes.INTEGER,
        defaultValue: 1000
      },
      usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true
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
      modelName: 'ApiKey',
      tableName: 'api_keys',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['key_hash'] },
        { fields: ['is_active'] },
        { fields: ['expires_at'] }
      ]
    });
  }

  static associate(models) {
    ApiKey.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}

// System Log Model - System-wide logging
class SystemLog extends Model {
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      level: {
        type: DataTypes.ENUM('debug', 'info', 'warn', 'error', 'critical'),
        allowNull: false
      },
      service: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      component: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      correlation_id: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'SystemLog',
      tableName: 'system_logs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['level'] },
        { fields: ['service'] },
        { fields: ['user_id'] },
        { fields: ['correlation_id'] },
        { fields: ['created_at'] }
      ]
    });
  }

  static associate(models) {
    SystemLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}

// Analytics Model - Comprehensive analytics tracking
class Analytics extends Model {
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
      metric_type: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      metric_name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      value: {
        type: DataTypes.DECIMAL(15, 6),
        allowNull: false
      },
      dimensions: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    }, {
      sequelize,
      modelName: 'Analytics',
      tableName: 'analytics',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['metric_type'] },
        { fields: ['metric_name'] },
        { fields: ['timestamp'] },
        { fields: ['created_at'] }
      ]
    });
  }

  static associate(models) {
    Analytics.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}

module.exports = {
  ExecutionLog,
  AutomationLog,
  ApiKey,
  SystemLog,
  Analytics
};
