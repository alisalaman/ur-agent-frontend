import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logging';

export class HealthCheckService {
  private redis: RedisClientType | null = null;

  constructor() {
    // Only create Redis client if REDIS_URL is provided
    if (process.env.REDIS_URL) {
      logger.info('Redis URL configured', { url: process.env.REDIS_URL });
      try {
        this.redis = createClient({
          url: process.env.REDIS_URL,
          socket: {
            connectTimeout: 5000, // 5 second timeout
          },
        });

        this.redis.on('error', (error) => {
          logger.warn('Redis connection error', { error: error.message });
          this.redis = null; // Mark as unavailable
        });

        this.redis.on('connect', () => {
          logger.info('Redis connected successfully');
        });

        this.redis.on('ready', () => {
          logger.info('Redis ready for commands');
        });

        this.redis.on('end', () => {
          logger.warn('Redis connection ended');
          this.redis = null;
        });

        // Try to connect
        this.redis.connect().catch((error) => {
          logger.warn('Redis connection failed', { error: error.message });
          this.redis = null; // Mark as unavailable
        });
      } catch (error) {
        logger.warn('Redis client creation failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.redis = null;
      }
    } else {
      logger.info('Redis not configured, health checks will return false');
    }
  }

  async checkRedis(): Promise<boolean> {
    if (!this.redis) {
      return false; // Redis not available
    }

    try {
      // Check if Redis is connected
      if (!this.redis.isOpen) {
        logger.warn('Redis client is not connected');
        return false;
      }

      // Send ping with timeout
      const result = await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 3000)),
      ]);

      logger.debug('Redis ping successful', { result });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Redis health check failed', { error: errorMessage });
      this.redis = null; // Mark as unavailable
      return false;
    }
  }

  async checkWebSocket(): Promise<boolean> {
    try {
      // For server-side health checks, we need to test the WebSocket endpoint directly
      // since the client-side WebSocket service isn't connected
      const wsUrl =
        process.env.AI_AGENT_WS_URL || 'wss://ur-agent.onrender.com/ws/synthetic-agents';

      // Test if the WebSocket endpoint is reachable by making an HTTP request to the health endpoint
      const healthUrl = wsUrl
        .replace('wss://', 'https://')
        .replace('/ws/synthetic-agents', '/health');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (fetchError) {
        logger.warn('WebSocket health check failed - endpoint not reachable', {
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          url: healthUrl,
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WebSocket health check failed', { error: errorMessage });
      return false;
    }
  }

  async checkAIAgent(): Promise<boolean> {
    try {
      // For server-side health checks, test the AI agent HTTP endpoint
      const wsUrl =
        process.env.AI_AGENT_WS_URL || 'wss://ur-agent.onrender.com/ws/synthetic-agents';
      const healthUrl = wsUrl
        .replace('wss://', 'https://')
        .replace('/ws/synthetic-agents', '/health');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (fetchError) {
        logger.warn('AI Agent health check failed - endpoint not reachable', {
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          url: healthUrl,
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('AI Agent health check failed', { error: errorMessage });
      return false;
    }
  }

  async getSystemHealth(): Promise<any> {
    const [redis, websocket, aiAgent] = await Promise.all([
      this.checkRedis(),
      this.checkWebSocket(),
      this.checkAIAgent(),
    ]);

    const overallHealth = redis && websocket && aiAgent ? 'healthy' : 'degraded';

    return {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services: {
        redis: { status: redis ? 'healthy' : 'unhealthy' },
        websocket: { status: websocket ? 'healthy' : 'unhealthy' },
        aiAgent: { status: aiAgent ? 'healthy' : 'unhealthy' },
      },
      uptime: process.uptime(),
    };
  }
}
