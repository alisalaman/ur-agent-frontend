import { WebSocketService } from './websocket-service';

// Simple logger for client-side
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  debug: (message: string) => console.debug(`[DEBUG] ${message}`),
};

export class ResilienceManager {
  private wsService: WebSocketService;
  private messageQueue: any[] = [];
  private isOnline: boolean = navigator.onLine;
  private retryAttempts: number = 0;
  private maxRetryAttempts: number = 5;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Network status monitoring
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // WebSocket events
    this.wsService.on('connected', this.handleConnected.bind(this));
    this.wsService.on('disconnected', this.handleDisconnected.bind(this));
    this.wsService.on('error', this.handleError.bind(this));
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.retryAttempts = 0;
    this.processQueuedMessages();
    logger.info('Network connection restored');
  }

  private handleOffline(): void {
    this.isOnline = false;
    logger.warn('Network connection lost');
  }

  private handleConnected(): void {
    this.retryAttempts = 0;
    this.processQueuedMessages();
  }

  private handleDisconnected(): void {
    if (this.isOnline && this.retryAttempts < this.maxRetryAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error): void {
    logger.error(`WebSocket error: ${error.message}`);

    if (this.retryAttempts < this.maxRetryAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
    this.retryAttempts++;

    setTimeout(() => {
      if (this.isOnline) {
        this.wsService.connect(
          this.wsService.getConnectionStatus()?.sessionId || '',
          this.wsService.getConnectionStatus()?.userId || ''
        );
      }
    }, delay);
  }

  sendMessage(content: string, metadata?: Record<string, any>): void {
    if (this.wsService.getConnectionStatus()?.status === 'connected') {
      try {
        this.wsService.sendMessage(content);
      } catch (error) {
        this.queueMessage({ content, metadata, timestamp: new Date() });
      }
    } else {
      this.queueMessage({ content, metadata, timestamp: new Date() });
    }
  }

  private queueMessage(message: any): void {
    this.messageQueue.push(message);
    logger.info(`Message queued for later delivery. Queue size: ${this.messageQueue.length}`);
  }

  private async processQueuedMessages(): Promise<void> {
    if (
      this.messageQueue.length === 0 ||
      this.wsService.getConnectionStatus()?.status !== 'connected'
    ) {
      return;
    }

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        this.wsService.sendMessage(message.content);
        logger.info('Queued message sent successfully');
      } catch (error: unknown) {
        this.messageQueue.push(message);
        logger.error(
          `Failed to send queued message: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  getConnectionStatus(): any {
    return this.wsService.getConnectionStatus();
  }
}
