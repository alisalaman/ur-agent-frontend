import { WebSocketService } from '../../../../src/client/services/websocket-service';

describe('WebSocketService', () => {
    let wsService: WebSocketService;
    const mockConfig = {
        url: 'ws://localhost:8080',
        reconnectAttempts: 3,
        reconnectDelay: 1000,
        heartbeatInterval: 30000,
        timeout: 10000
    };

    beforeEach(() => {
        wsService = new WebSocketService(mockConfig);
    });

    afterEach(() => {
        wsService.disconnect();
    });

    test('should create WebSocket service instance', () => {
        expect(wsService).toBeDefined();
    });

    test('should handle connection events', () => {
        // Test event listener registration
        const mockCallback = jest.fn();
        wsService.on('connected', mockCallback);

        // Simulate connection event
        wsService.emit('connected', { id: 'test', status: 'connected' });

        expect(mockCallback).toHaveBeenCalled();
    });

    test('should generate unique IDs', () => {
        const id1 = (wsService as any).generateId();
        const id2 = (wsService as any).generateId();

        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
    });

    test('should handle disconnection', () => {
        const status = wsService.getConnectionStatus();
        expect(status).toBeNull();
    });
});
