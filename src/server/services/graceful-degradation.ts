import { logger } from '../utils/logging';

export interface DegradationLevel {
  level: 'full' | 'limited' | 'offline';
  description: string;
  features: string[];
  fallbackActions: Record<string, () => any>;
}

export class GracefulDegradationService {
  private currentLevel: DegradationLevel;
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();

  constructor() {
    this.currentLevel = {
      level: 'full',
      description: 'All services operational',
      features: ['websocket', 'ai-agent', 'session-storage', 'real-time'],
      fallbackActions: {},
    };
  }

  registerHealthCheck(name: string, check: () => Promise<boolean>): void {
    this.healthChecks.set(name, check);
  }

  async assessSystemHealth(): Promise<DegradationLevel> {
    const healthStatus = await this.checkAllServices();

    // Check if core services are available (redis, websocket, aiAgent)
    if (healthStatus.redis && healthStatus.websocket && healthStatus.aiAgent) {
      this.currentLevel = {
        level: 'full',
        description: 'All services operational',
        features: ['websocket', 'ai-agent', 'session-storage', 'real-time'],
        fallbackActions: {},
      };
    } else if (healthStatus.redis && (healthStatus.websocket || healthStatus.aiAgent)) {
      this.currentLevel = {
        level: 'limited',
        description: 'Limited functionality - some services unavailable',
        features: ['session-storage', 'message-queue'],
        fallbackActions: {
          sendMessage: () => this.queueMessageForLater({}),
          getMessages: () => this.getCachedMessages(''),
        },
      };
    } else {
      this.currentLevel = {
        level: 'offline',
        description: 'System offline - maintenance mode',
        features: ['static-content'],
        fallbackActions: {
          sendMessage: () => this.showOfflineMessage(),
          getMessages: () => this.showOfflineMessage(),
        },
      };
    }

    logger.info('System degradation level assessed', {
      level: this.currentLevel.level,
      description: this.currentLevel.description,
      healthStatus,
    });

    return this.currentLevel;
  }

  private async checkAllServices(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, check] of this.healthChecks) {
      try {
        results[name] = await check();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Health check failed', { service: name, error: errorMessage });
        results[name] = false;
      }
    }

    return results;
  }

  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  canUseFeature(feature: string): boolean {
    return this.currentLevel.features.includes(feature);
  }

  getFallbackAction(action: string): (() => any) | undefined {
    return this.currentLevel.fallbackActions[action];
  }

  private async queueMessageForLater(message: any): Promise<any> {
    // TODO: Implement message queuing for later processing
    logger.info('Message queued for later processing', { messageId: message.id });
    return {
      status: 'queued',
      message: 'Your message has been queued and will be processed when services are restored.',
    };
  }

  private async getCachedMessages(sessionId: string): Promise<any[]> {
    // TODO: Implement cached message retrieval
    logger.info('Retrieving cached messages', { sessionId });
    return [];
  }

  private showOfflineMessage(): any {
    return {
      status: 'offline',
      message: 'The service is currently offline for maintenance. Please try again later.',
    };
  }
}
