import {
    ChatServiceError,
    WebSocketConnectionError,
    SessionNotFoundError,
    MessageSendError,
    CircuitBreakerOpenError
} from '../../../../src/server/types/errors';

describe('Error Types', () => {
    test('ChatServiceError should have correct properties', () => {
        const error = new ChatServiceError('Test error', 'TEST_ERROR', 400, true);

        expect(error.message).toBe('Test error');
        expect(error.code).toBe('TEST_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.isRetryable).toBe(true);
        expect(error.name).toBe('ChatServiceError');
    });

    test('WebSocketConnectionError should have correct defaults', () => {
        const error = new WebSocketConnectionError('Connection failed');

        expect(error.message).toBe('Connection failed');
        expect(error.code).toBe('WEBSOCKET_CONNECTION_ERROR');
        expect(error.statusCode).toBe(503);
        expect(error.isRetryable).toBe(true);
        expect(error.name).toBe('WebSocketConnectionError');
    });

    test('SessionNotFoundError should have correct defaults', () => {
        const error = new SessionNotFoundError('session-123');

        expect(error.message).toBe('Session session-123 not found');
        expect(error.code).toBe('SESSION_NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.isRetryable).toBe(false);
        expect(error.name).toBe('SessionNotFoundError');
    });

    test('MessageSendError should have correct defaults', () => {
        const error = new MessageSendError('Send failed');

        expect(error.message).toBe('Send failed');
        expect(error.code).toBe('MESSAGE_SEND_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.isRetryable).toBe(true);
        expect(error.name).toBe('MessageSendError');
    });

    test('MessageSendError should allow custom retryable setting', () => {
        const error = new MessageSendError('Send failed', false);

        expect(error.isRetryable).toBe(false);
    });

    test('CircuitBreakerOpenError should have correct defaults', () => {
        const error = new CircuitBreakerOpenError('ai-agent');

        expect(error.message).toBe('Circuit breaker for ai-agent is open');
        expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
        expect(error.statusCode).toBe(503);
        expect(error.isRetryable).toBe(true);
        expect(error.name).toBe('CircuitBreakerOpenError');
    });
});
