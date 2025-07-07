const http = require('http');
const url = require('url');
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

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'demo_token';
const PORT = process.env.TELEGRAM_BOT_PORT || 3002;

console.log(`🤖 Telegram Bot Token: ${TOKEN !== 'demo_token' ? 'Configured' : 'Not configured'}`);

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle OPTIONS request
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check endpoint
    if (pathname === '/health' && method === 'GET') {
        const healthData = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: 'Telegram Bot',
            version: '1.0.0',
            bot_configured: TOKEN !== 'demo_token',
            features: [
                'X/Twitter Automation Control',
                'Multi-Account Management',
                'Content Generation',
                'Analytics Dashboard',
                'Campaign Management',
                'Real-Time Monitoring',
                'Emergency Controls',
                'Quality Assurance',
                'Compliance Monitoring',
                'Performance Optimization'
            ]
        };

        res.writeHead(200);
        res.end(JSON.stringify(healthData, null, 2));
        return;
    }

    // Bot status endpoint
    if (pathname === '/api/bot/status' && method === 'GET') {
        const botStatus = {
            success: true,
            bot: {
                configured: TOKEN !== 'demo_token',
                status: TOKEN !== 'demo_token' ? 'active' : 'demo_mode',
                commands: [
                    '/start - Initialize bot',
                    '/help - Show help menu',
                    '/status - System status',
                    '/accounts - Manage X accounts',
                    '/campaigns - Campaign management',
                    '/automation - Automation controls',
                    '/analytics - View analytics',
                    '/content - Content generation',
                    '/settings - Bot settings',
                    '/emergency - Emergency stop'
                ],
                features: {
                    posting: 'available',
                    liking: 'available',
                    commenting: 'available',
                    following: 'available',
                    dm: 'available',
                    polls: 'available',
                    threads: 'available',
                    multiAccount: 'available',
                    qualityControl: 'available',
                    compliance: 'available'
                }
            }
        };

        res.writeHead(200);
        res.end(JSON.stringify(botStatus, null, 2));
        return;
    }

    // Webhook endpoint for Telegram
    if (pathname === '/webhook/telegram' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const update = JSON.parse(body);
                console.log('Telegram webhook received:', update);
                
                // Simulate bot response
                if (update.message) {
                    const chatId = update.message.chat.id;
                    const text = update.message.text;
                    
                    console.log(`Message from ${chatId}: ${text}`);
                    
                    // In a real implementation, this would send responses back to Telegram
                    // For now, we just log the interaction
                }
                
                res.writeHead(200);
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                console.error('Error processing webhook:', error);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Commands endpoint
    if (pathname === '/api/commands' && method === 'GET') {
        const commands = {
            success: true,
            commands: [
                {
                    command: '/start',
                    description: 'Initialize X Marketing Platform bot',
                    response: '🚀 Welcome to X Marketing Platform! Complete automation suite for X/Twitter marketing.'
                },
                {
                    command: '/help',
                    description: 'Show all available commands',
                    response: '📚 X Marketing Platform Commands - Full automation control at your fingertips.'
                },
                {
                    command: '/status',
                    description: 'Show system status and health',
                    response: '📊 System Status: All services operational. Automation active with 96% success rate.'
                },
                {
                    command: '/accounts',
                    description: 'Manage X accounts',
                    response: '👥 Account Management: 2 active accounts with automation enabled.'
                },
                {
                    command: '/automation',
                    description: 'Automation control center',
                    response: '🤖 Automation Status: Active - Posts: 12, Likes: 156, Comments: 34 today.'
                },
                {
                    command: '/analytics',
                    description: 'View performance analytics',
                    response: '📊 Analytics: 4.8% engagement rate, 92% quality score, 25K impressions today.'
                },
                {
                    command: '/content',
                    description: 'AI content generation',
                    response: '🤖 Content Generation: AI-powered posts with quality control and compliance checking.'
                },
                {
                    command: '/emergency',
                    description: 'Emergency stop all automation',
                    response: '🚨 EMERGENCY STOP: All automation stopped immediately for safety.'
                }
            ]
        };

        res.writeHead(200);
        res.end(JSON.stringify(commands, null, 2));
        return;
    }

    // 404 handler
    const notFound = {
        error: 'Route not found',
        path: pathname,
        available_endpoints: [
            'GET /health',
            'GET /api/bot/status',
            'GET /api/commands',
            'POST /webhook/telegram'
        ]
    };

    res.writeHead(404);
    res.end(JSON.stringify(notFound, null, 2));
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Telegram Bot Service running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Bot status: http://localhost:${PORT}/api/bot/status`);
    console.log(`📋 Commands: http://localhost:${PORT}/api/commands`);
    console.log(`🤖 Bot configured: ${TOKEN !== 'demo_token' ? 'Yes' : 'No (demo mode)'}`);
    console.log(`✅ Telegram Bot Service ready!`);
    
    // Display available bot commands
    console.log('\n🤖 Bot Commands Available:');
    console.log('/start - Initialize bot');
    console.log('/help - Show help menu');
    console.log('/status - System status');
    console.log('/accounts - Manage X accounts');
    console.log('/campaigns - Campaign management');
    console.log('/automation - Automation controls');
    console.log('/analytics - View analytics');
    console.log('/content - Content generation');
    console.log('/settings - Bot settings');
    console.log('/emergency - Emergency stop');
    
    if (TOKEN !== 'demo_token') {
        console.log('\n🔗 Configure webhook URL in Telegram:');
        console.log(`http://localhost:${PORT}/webhook/telegram`);
    } else {
        console.log('\n⚠️  Configure TELEGRAM_BOT_TOKEN in .env.local for full functionality');
    }
});

module.exports = server;
