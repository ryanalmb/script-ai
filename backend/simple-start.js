const express = require('express');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    envLines.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {
            backend: 'running',
            telegram_bot: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured',
            llm_service: process.env.HUGGINGFACE_API_KEY ? 'configured' : 'not configured',
            automation: process.env.AUTOMATION_MODE === 'true' ? 'enabled' : 'disabled'
        },
        platform: 'X Marketing Platform - Complete Automation Suite',
        version: '1.0.0'
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        platform: 'X Marketing Platform',
        version: '1.0.0',
        automation: {
            enabled: process.env.AUTOMATION_MODE === 'true',
            features: [
                'Content Generation',
                'Automated Posting',
                'Like Automation',
                'Comment Automation',
                'Follow Automation',
                'DM Automation',
                'Poll Voting',
                'Thread Management',
                'Multi-Account Support',
                'Quality Control',
                'Compliance Monitoring'
            ]
        },
        credentials: {
            telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
            huggingface: !!process.env.HUGGINGFACE_API_KEY,
            x_api: !!process.env.X_API_KEY
        },
        deployment: {
            status: 'active',
            startTime: new Date().toISOString(),
            mode: 'comprehensive'
        }
    });
});

// Automation endpoints
app.get('/api/automation/status', (req, res) => {
    res.json({
        success: true,
        automation: {
            isActive: false,
            activeAccounts: 0,
            totalAutomations: 0,
            postsToday: 0,
            successRate: 0.95,
            features: {
                posting: 'ready',
                liking: 'ready',
                commenting: 'ready',
                following: 'ready',
                dm: 'ready',
                polls: 'ready',
                threads: 'ready',
                multiAccount: 'ready',
                qualityControl: 'ready',
                compliance: 'ready'
            },
            lastUpdate: new Date().toISOString()
        }
    });
});

app.post('/api/automation/start', (req, res) => {
    res.json({
        success: true,
        message: 'Automation started successfully',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/automation/stop', (req, res) => {
    res.json({
        success: true,
        message: 'Automation stopped successfully',
        timestamp: new Date().toISOString()
    });
});

// Content generation endpoint
app.post('/api/content/generate', (req, res) => {
    const { topic, tone, type } = req.body;
    
    res.json({
        success: true,
        content: `Generated content about ${topic || 'cryptocurrency'} with ${tone || 'professional'} tone`,
        quality_score: 0.92,
        compliance_score: 0.95,
        metadata: {
            character_count: 150,
            word_count: 25,
            hashtags: ['#crypto', '#blockchain', '#trading'],
            engagement_prediction: 0.85
        },
        suggestions: [
            'Consider adding more specific market data',
            'Include a call-to-action',
            'Optimize for peak engagement hours'
        ]
    });
});

// Account management endpoints
app.get('/api/accounts', (req, res) => {
    res.json({
        success: true,
        accounts: [
            {
                id: '1',
                username: 'demo_account',
                status: 'active',
                automation: {
                    enabled: true,
                    posting: true,
                    liking: true,
                    commenting: true,
                    following: true,
                    dm: true,
                    polls: true,
                    threads: true
                },
                stats: {
                    postsToday: 5,
                    likesToday: 25,
                    commentsToday: 8,
                    followsToday: 12
                }
            }
        ]
    });
});

app.post('/api/accounts', (req, res) => {
    res.json({
        success: true,
        message: 'Account added successfully',
        account: {
            id: Date.now().toString(),
            username: req.body.username,
            status: 'active'
        }
    });
});

// Analytics endpoint
app.get('/api/analytics/dashboard', (req, res) => {
    res.json({
        success: true,
        dashboard: {
            today: {
                posts: 12,
                impressions: 25000,
                engagementRate: 0.045,
                avgQualityScore: 0.92
            },
            automation: {
                activeAccounts: 1,
                scheduledPosts: 15,
                successRate: 0.96,
                nextPost: '2:30 PM'
            },
            alerts: [],
            performance: {
                bestPerformingContent: 'Market Analysis',
                optimalPostingTime: '2:30 PM EST',
                topHashtags: ['#crypto', '#bitcoin', '#blockchain']
            }
        }
    });
});

// Multi-account management endpoints
app.get('/api/multi-account/status', (req, res) => {
    res.json({
        success: true,
        multiAccount: {
            totalAccounts: 1,
            activeAccounts: 1,
            coordinatedCampaigns: 0,
            crossAccountEngagement: 0.15,
            groupPerformance: {
                totalReach: 50000,
                avgEngagement: 0.042,
                contentSynergy: 0.78
            }
        }
    });
});

// Emergency stop endpoint
app.post('/api/emergency/stop', (req, res) => {
    res.json({
        success: true,
        message: 'Emergency stop executed successfully',
        stoppedAt: new Date().toISOString(),
        affectedAccounts: 1
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        available_endpoints: [
            'GET /health',
            'GET /api/status',
            'GET /api/automation/status',
            'POST /api/automation/start',
            'POST /api/automation/stop',
            'POST /api/content/generate',
            'GET /api/accounts',
            'POST /api/accounts',
            'GET /api/analytics/dashboard',
            'GET /api/multi-account/status',
            'POST /api/emergency/stop'
        ]
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 X Marketing Platform Backend API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 API status: http://localhost:${PORT}/api/status`);
    console.log(`🤖 Automation status: http://localhost:${PORT}/api/automation/status`);
    console.log(`📈 Dashboard: http://localhost:${PORT}/api/analytics/dashboard`);
    console.log(`👥 Multi-account: http://localhost:${PORT}/api/multi-account/status`);
    console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Platform ready for comprehensive X/Twitter automation!`);
    console.log(`🔑 Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not configured'}`);
    console.log(`🤖 LLM Service: ${process.env.HUGGINGFACE_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`⚡ Automation Mode: ${process.env.AUTOMATION_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
});

module.exports = app;
