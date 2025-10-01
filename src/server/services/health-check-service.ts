import { createClient, RedisClientType } from 'redis';
import { WebSocketService } from '../../client/services/websocket-service';
import { logger } from '../utils/logging';

export class HealthCheckService {
  private redis: RedisClientType;
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    this.wsService = wsService;
  }

  async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Redis health check failed', { error: errorMessage });
      return false;
    }
  }

  async checkWebSocket(): Promise<boolean> {
    try {
      const connection = this.wsService.getConnectionStatus();
      return connection?.status === 'connected';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WebSocket health check failed', { error: errorMessage });
      return false;
    }
  }

  async checkAIAgent(): Promise<boolean> {
    try {
      // Send a ping message to AI agent
      this.wsService.sendMessage('ping', { type: 'health-check' });
      return true;
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
