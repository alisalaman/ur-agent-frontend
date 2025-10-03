// Simple logger for client-side
const logger = {
    info: (message) => console.log(`[INFO] ${message}`),
    error: (message) => console.error(`[ERROR] ${message}`),
    warn: (message) => console.warn(`[WARN] ${message}`),
    debug: (message) => console.debug(`[DEBUG] ${message}`),
};
export class ResilienceManager {
    wsService;
    messageQueue = [];
    isOnline = navigator.onLine;
    retryAttempts = 0;
    maxRetryAttempts = 5;
    constructor(wsService) {
        this.wsService = wsService;
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Network status monitoring
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        // WebSocket events
        this.wsService.on('connected', this.handleConnected.bind(this));
        this.wsService.on('disconnected', this.handleDisconnected.bind(this));
        this.wsService.on('error', this.handleError.bind(this));
    }
    handleOnline() {
        this.isOnline = true;
        this.retryAttempts = 0;
        this.processQueuedMessages();
        logger.info('Network connection restored');
    }
    handleOffline() {
        this.isOnline = false;
        logger.warn('Network connection lost');
    }
    handleConnected() {
        this.retryAttempts = 0;
        this.processQueuedMessages();
    }
    handleDisconnected() {
        if (this.isOnline && this.retryAttempts < this.maxRetryAttempts) {
            this.scheduleReconnect();
        }
    }
    handleError(error) {
        logger.error(`WebSocket error: ${error.message}`);
        if (this.retryAttempts < this.maxRetryAttempts) {
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
        this.retryAttempts++;
        setTimeout(() => {
            if (this.isOnline) {
                this.wsService.connect(this.wsService.getConnectionStatus()?.sessionId || '', this.wsService.getConnectionStatus()?.userId || '');
            }
        }, delay);
    }
    sendMessage(content, metadata) {
        if (this.wsService.getConnectionStatus()?.status === 'connected') {
            try {
                this.wsService.sendMessage(content, metadata);
            }
            catch (error) {
                this.queueMessage({ content, metadata, timestamp: new Date() });
            }
        }
        else {
            this.queueMessage({ content, metadata, timestamp: new Date() });
        }
    }
    queueMessage(message) {
        this.messageQueue.push(message);
        logger.info(`Message queued for later delivery. Queue size: ${this.messageQueue.length}`);
    }
    async processQueuedMessages() {
        if (this.messageQueue.length === 0 ||
            this.wsService.getConnectionStatus()?.status !== 'connected') {
            return;
        }
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        for (const message of messages) {
            try {
                this.wsService.sendMessage(message.content, message.metadata);
                logger.info('Queued message sent successfully');
            }
            catch (error) {
                this.messageQueue.push(message);
                logger.error(`Failed to send queued message: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
    getQueueSize() {
        return this.messageQueue.length;
    }
    getConnectionStatus() {
        return this.wsService.getConnectionStatus();
    }
}
//# sourceMappingURL=resilience-manager.js.map