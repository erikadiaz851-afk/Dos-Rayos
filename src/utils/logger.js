import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';

if (!existsSync('./logs')) mkdirSync('./logs');

const fmt = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp }) =>
    `${timestamp} [${level}]: ${message}`
  )
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: fmt,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: winston.format.uncolorize() }),
    new winston.transports.File({ filename: 'logs/app.log', format: winston.format.uncolorize() }),
  ],
});

export default logger;
