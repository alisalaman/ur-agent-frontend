import { EventEmitter } from 'events';

export class MockWebSocketService extends EventEmitter {
    private connection: any = null;

    constructor() {
        super();
    }

    async connect(sessionId: string, userId: string): Promise<void> {
        this.connection = {
            id: 'mock-connection-id',
            sessionId,
            userId,
            status: 'connected',
            lastActivity: new Date(),
            retryCount: 0
        };
        this.emit('connected', this.connection);
    }

    sendMessage(content: string, metadata?: Record<string, any>): void {
        if (!this.connection) {
            throw new Error('WebSocket not connected');
        }
        // Simulate message sending
        setTimeout(() => {
            this.emit('message', {
                id: 'mock-message-id',
                type: 'response',
                content: `Echo: ${content}`,
                timestamp: new Date(),
                metadata
            });
        }, 100);
    }

    getConnectionStatus(): any {
        return this.connection;
    }

    disconnect(): void {
        if (this.connection) {
            this.connection.status = 'disconnected';
            this.emit('disconnected', { code: 1000, reason: 'Normal closure' });
        }
    }

    // Mock methods for testing
    simulateConnectionError(): void {
        this.emit('error', new Error('Mock connection error'));
    }

    simulateDisconnection(): void {
        if (this.connection) {
            this.connection.status = 'disconnected';
            this.emit('disconnected', { code: 1006, reason: 'Abnormal closure' });
        }
    }
}

