// PM2 Ecosystem Configuration for Local Development
module.exports = {
  apps: [
    {
      name: 'x-marketing-backend',
      script: 'npm',
      args: 'run dev',
      cwd: './backend',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        LOG_LEVEL: 'debug'
      },
      watch: ['src'],
      ignore_watch: ['node_modules', 'logs', 'dist'],
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'x-marketing-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false, // Next.js has its own hot reload
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'x-marketing-telegram',
      script: 'npm',
      args: 'run dev',
      cwd: './telegram-bot',
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        LOG_LEVEL: 'debug'
      },
      watch: ['src'],
      ignore_watch: ['node_modules', 'logs', 'dist'],
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      error_file: './logs/telegram-error.log',
      out_file: './logs/telegram-out.log',
      log_file: './logs/telegram-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'x-marketing-llm',
      script: 'python',
      args: 'app.py',
      cwd: './llm-service',
      env: {
        FLASK_ENV: 'development',
        FLASK_DEBUG: 'true',
        PORT: 3003,
        LOG_LEVEL: 'debug'
      },
      watch: ['*.py'],
      ignore_watch: ['__pycache__', 'logs', '*.pyc'],
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'python3',
      max_memory_restart: '400M',
      error_file: './logs/llm-error.log',
      out_file: './logs/llm-out.log',
      log_file: './logs/llm-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],

  deploy: {
    development: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/x-marketing-platform.git',
      path: '/var/www/x-marketing-platform',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development',
      'pre-setup': ''
    }
  }
};
