import { CircuitBreakerService } from './circuit-breaker-service';
import { WebSocketService } from '../../client/services/websocket-service';
import { logger } from '../utils/logging';

export class AIAgentCircuitBreaker {
  private circuitBreakerService: CircuitBreakerService;
  private wsService: WebSocketService;
  private breaker: any;

  constructor(wsService: WebSocketService) {
    this.circuitBreakerService = new CircuitBreakerService();
    this.wsService = wsService;
    this.initializeBreaker();
  }

  private initializeBreaker(): void {
    this.breaker = this.circuitBreakerService.createBreaker(this.callAIAgent.bind(this), {
      name: 'ai-agent',
      timeout: 10000,
      errorThreshold: 50,
      resetTimeout: 30000,
      volumeThreshold: 5,
    });
  }

  async sendMessage(content: string, metadata?: Record<string, any>): Promise<any> {
    try {
      return await this.breaker.fire(content, metadata);
    } catch (error) {
      if (this.breaker.state === 'open') {
        logger.warn('AI Agent circuit breaker is open, using fallback', {
          error: error instanceof Error ? error.message : String(error),
          content: content.substring(0, 100),
        });
        return this.getFallbackResponse(content);
      }
      throw error;
    }
  }

  private async callAIAgent(content: string, metadata?: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AI Agent request timeout'));
      }, 8000);

      this.wsService.sendMessage(content, metadata);

      const messageHandler = (message: any) => {
        clearTimeout(timeout);
        this.wsService.off('message', messageHandler);
        resolve(message);
      };

      this.wsService.on('message', messageHandler);
      this.wsService.on('error', (error) => {
        clearTimeout(timeout);
        this.wsService.off('message', messageHandler);
        reject(error);
      });
    });
  }

  private getFallbackResponse(content: string): any {
    return {
      id: this.generateId(),
      type: 'response',
      content:
        "I apologize, but I'm currently experiencing technical difficulties. Please try again in a few moments, or contact support if the issue persists.",
      timestamp: new Date(),
      metadata: {
        fallback: true,
        reason: 'circuit-breaker-open',
        originalContent: content.substring(0, 100),
      },
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getStats(): any {
    return this.circuitBreakerService.getBreakerStats('ai-agent');
  }
}
