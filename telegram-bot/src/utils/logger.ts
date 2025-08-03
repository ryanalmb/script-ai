import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Add file transports only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  try {
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }));
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    }));
  } catch (error) {
    console.warn('Could not initialize file logging:', error instanceof Error ? error.message : String(error));
  }
}

export { logger };
