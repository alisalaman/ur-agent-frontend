import { config } from 'dotenv';
import { AppConfig } from './types';

const environment = process.env.NODE_ENV || 'development';
config({ path: `.env.${environment}` });

export const appConfig: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    // Bind to 0.0.0.0 for production deployments (like Render) to accept external connections
    host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'),
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  },
  session: {
    secret: process.env.SESSION_SECRET || 'default-secret',
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};
