import { MockWebSocketService } from './websocket-service.mock';
import { MockRedisClient } from './redis.mock';

export class MockHealthCheckService {
    private wsService: MockWebSocketService;
    private redis: MockRedisClient;
    private mockResults: Record<string, boolean> = {
        redis: true,
        websocket: true,
        aiAgent: true
    };

    constructor(wsService: MockWebSocketService, redis: MockRedisClient) {
        this.wsService = wsService;
        this.redis = redis;
    }

    async checkRedis(): Promise<boolean> {
        try {
            await this.redis.ping();
            return this.mockResults.redis;
        } catch (error) {
            return false;
        }
    }

    async checkWebSocket(): Promise<boolean> {
        try {
            const connection = this.wsService.getConnectionStatus();
            return this.mockResults.websocket && connection?.status === 'connected';
        } catch (error) {
            return false;
        }
    }

    async checkAIAgent(): Promise<boolean> {
        try {
            this.wsService.sendMessage('ping', { type: 'health-check' });
            return this.mockResults.aiAgent;
        } catch (error) {
            return false;
        }
    }

    async getSystemHealth(): Promise<any> {
        const [redis, websocket, aiAgent] = await Promise.all([
            this.checkRedis(),
            this.checkWebSocket(),
            this.checkAIAgent()
        ]);

        const overallHealth = redis && websocket && aiAgent ? 'healthy' : 'degraded';

        return {
            status: overallHealth,
            timestamp: new Date().toISOString(),
            services: {
                redis: { status: redis ? 'healthy' : 'unhealthy' },
                websocket: { status: websocket ? 'healthy' : 'unhealthy' },
                aiAgent: { status: aiAgent ? 'healthy' : 'unhealthy' }
            },
            uptime: process.uptime()
        };
    }

    // Mock methods for testing
    setMockResult(service: string, result: boolean): void {
        this.mockResults[service] = result;
    }

    resetMockResults(): void {
        this.mockResults = {
            redis: true,
            websocket: true,
            aiAgent: true
        };
    }
}

