#!/usr/bin/env node
/**
 * Database Initialization Script for X Marketing Platform
 * Divine setup for production-ready database with comprehensive data
 */

const { databaseManager } = require('../database/connection');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    logger.info('🚀 Initializing X Marketing Platform Database...');
    
    // Initialize database connections
    await databaseManager.initialize();
    
    // Create sample data for testing
    await createSampleData();
    
    logger.info('✅ Database initialization completed successfully!');
    
    // Show status
    const health = await databaseManager.healthCheck();
    logger.info('Database Health:', health);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function createSampleData() {
  try {
    const { User, Conversation, Message, Campaign, XAccount, Content } = require('../database/connection');
    
    logger.info('Creating sample data...');
    
    // Create sample user
    const sampleUser = await User.findOrCreate({
      where: { telegram_id: 123456789 },
      defaults: {
        username: 'demo_user',
        email: 'demo@xmarketing.ai',
        password_hash: await User.hashPassword('demo_password'),
        telegram_id: 123456789,
        telegram_username: 'demo_user',
        subscription_tier: 'enterprise',
        preferences: {
          automation_level: 'advanced',
          notification_settings: {
            email: true,
            telegram: true,
            push: true
          },
          ui_preferences: {
            theme: 'dark',
            language: 'en'
          }
        },
        usage_stats: {
          total_commands: 0,
          total_campaigns: 0,
          total_content_generated: 0,
          last_active: new Date()
        },
        is_verified: true
      }
    });
    
    logger.info(`✅ Sample user created: ${sampleUser[0].username}`);
    
    // Create sample X account
    const sampleXAccount = await XAccount.findOrCreate({
      where: { user_id: sampleUser[0].id, x_user_id: 'demo_x_user' },
      defaults: {
        user_id: sampleUser[0].id,
        x_user_id: 'demo_x_user',
        username: 'demo_x_account',
        display_name: 'Demo X Account',
        profile_image_url: 'https://placeholder.com/profile.jpg',
        access_token: 'demo_access_token',
        permissions: {
          read: true,
          write: true,
          dm: true
        },
        automation_settings: {
          auto_like: false,
          auto_follow: false,
          auto_comment: false,
          daily_limits: {
            likes: 100,
            follows: 50,
            comments: 20
          }
        },
        analytics: {
          followers_count: 1000,
          following_count: 500,
          tweets_count: 250,
          last_sync: new Date()
        }
      }
    });
    
    logger.info(`✅ Sample X account created: ${sampleXAccount[0].username}`);
    
    // Create sample campaign
    const sampleCampaign = await Campaign.findOrCreate({
      where: { user_id: sampleUser[0].id, name: 'Demo AI Campaign' },
      defaults: {
        user_id: sampleUser[0].id,
        name: 'Demo AI Campaign',
        description: 'A comprehensive AI-powered marketing campaign showcasing the platform capabilities',
        objective: 'brand_awareness',
        status: 'active',
        complexity: 'enterprise',
        configuration: {
          target_audience: {
            demographics: 'tech professionals aged 25-45',
            interests: ['AI', 'technology', 'innovation', 'marketing'],
            platforms: ['twitter', 'linkedin']
          },
          content_strategy: {
            tone: 'professional yet engaging',
            frequency: 'twice daily',
            content_types: ['text', 'image', 'video', 'thread']
          },
          automation_settings: {
            auto_post: true,
            auto_engage: true,
            scheduling: 'intelligent'
          },
          budget_allocation: {
            content_creation: 0.4,
            advertising: 0.4,
            analytics: 0.2
          },
          success_metrics: {
            engagement_rate: 0.05,
            reach: 50000,
            conversions: 500
          }
        },
        schedule: {
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          posting_schedule: {
            monday: ['09:00', '15:00'],
            tuesday: ['09:00', '15:00'],
            wednesday: ['09:00', '15:00'],
            thursday: ['09:00', '15:00'],
            friday: ['09:00', '15:00']
          },
          automation_schedule: {
            engagement_hours: ['09:00-17:00'],
            rest_periods: ['22:00-08:00']
          }
        },
        analytics: {
          impressions: 25000,
          engagements: 1250,
          clicks: 500,
          conversions: 25,
          roi: 2.5
        }
      }
    });
    
    logger.info(`✅ Sample campaign created: ${sampleCampaign[0].name}`);
    
    // Create sample content
    const contentPieces = [
      {
        type: 'text',
        content_text: '🚀 Excited to share our latest AI breakthrough! The future of marketing automation is here. #AI #Innovation #MarketingTech',
        hashtags: ['AI', 'Innovation', 'MarketingTech'],
        status: 'posted'
      },
      {
        type: 'text',
        content_text: '💡 Did you know? AI-powered content generation can increase engagement by up to 300%. Here\'s how we\'re revolutionizing social media marketing...',
        hashtags: ['AI', 'ContentMarketing', 'SocialMedia'],
        status: 'scheduled'
      },
      {
        type: 'image',
        content_text: 'Visual representation of our AI marketing platform capabilities',
        media_urls: ['https://placeholder.com/ai-marketing-infographic.jpg'],
        hashtags: ['AIMarketing', 'Infographic', 'TechTrends'],
        status: 'draft'
      }
    ];
    
    for (const contentData of contentPieces) {
      await Content.findOrCreate({
        where: { 
          user_id: sampleUser[0].id, 
          campaign_id: sampleCampaign[0].id,
          content_text: contentData.content_text
        },
        defaults: {
          user_id: sampleUser[0].id,
          campaign_id: sampleCampaign[0].id,
          x_account_id: sampleXAccount[0].id,
          type: contentData.type,
          content_text: contentData.content_text,
          media_urls: contentData.media_urls || [],
          hashtags: contentData.hashtags || [],
          generation_metadata: {
            model_used: 'gemini-2.5-pro',
            generation_time: Date.now(),
            quality_score: 0.9,
            source: 'sample_data'
          },
          status: contentData.status,
          analytics: {
            impressions: Math.floor(Math.random() * 10000),
            likes: Math.floor(Math.random() * 500),
            retweets: Math.floor(Math.random() * 100),
            replies: Math.floor(Math.random() * 50),
            clicks: Math.floor(Math.random() * 200)
          }
        }
      });
    }
    
    logger.info(`✅ Sample content created: ${contentPieces.length} pieces`);
    
    // Create sample conversation
    const sampleConversation = await Conversation.findOrCreate({
      where: { user_id: sampleUser[0].id, telegram_chat_id: 123456789 },
      defaults: {
        user_id: sampleUser[0].id,
        telegram_chat_id: 123456789,
        title: 'Natural Language Demo Conversation',
        context: {
          user_preferences: sampleUser[0].preferences,
          active_accounts: [sampleXAccount[0].id],
          current_session: {
            start_time: new Date().toISOString(),
            message_count: 0
          },
          conversation_metadata: {
            demo_mode: true,
            initialized: true
          }
        },
        message_count: 0
      }
    });
    
    logger.info(`✅ Sample conversation created for user: ${sampleUser[0].username}`);
    
    // Create sample messages
    const sampleMessages = [
      {
        role: 'user',
        content: 'Hello! I want to create a marketing campaign for my AI startup.'
      },
      {
        role: 'assistant',
        content: 'Great! I\'d be happy to help you create a comprehensive marketing campaign for your AI startup. Let me gather some information and create a tailored strategy for you.',
        intent_data: {
          category: 'campaign_management',
          complexity: 'moderate',
          confidence_score: 0.95
        }
      },
      {
        role: 'user',
        content: 'Can you generate some tweets about AI technology trends?'
      },
      {
        role: 'assistant',
        content: 'Absolutely! I\'ll generate some engaging tweets about AI technology trends for you. Here are several options that align with current industry discussions.',
        intent_data: {
          category: 'content_creation',
          complexity: 'simple',
          confidence_score: 0.98
        }
      }
    ];
    
    for (const messageData of sampleMessages) {
      await Message.create({
        conversation_id: sampleConversation[0].id,
        role: messageData.role,
        content: messageData.content,
        intent_data: messageData.intent_data || null,
        metadata: {
          processing_time: Math.random() * 2,
          model_used: messageData.role === 'assistant' ? 'gemini-2.5-pro' : null,
          confidence_score: messageData.intent_data?.confidence_score || null
        }
      });
    }
    
    logger.info(`✅ Sample messages created: ${sampleMessages.length} messages`);
    
    logger.info('🎉 Sample data creation completed successfully!');
    
  } catch (error) {
    logger.error('❌ Sample data creation failed:', error);
    throw error;
  }
}

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase, createSampleData };
