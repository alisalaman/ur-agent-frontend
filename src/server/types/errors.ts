/**
 * Custom error classes for better error handling and debugging
 */

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class WebSocketNotConnectedError extends Error {
  constructor() {
    super('WebSocket not connected');
    this.name = 'WebSocketNotConnectedError';
  }
}

export class InvalidSessionIdError extends Error {
  constructor(sessionId: string) {
    super(`Invalid session ID format: ${sessionId}`);
    this.name = 'InvalidSessionIdError';
  }
}

export class MessageValidationError extends Error {
  constructor(message: string) {
    super(`Message validation failed: ${message}`);
    this.name = 'MessageValidationError';
  }
}

export class RedisConnectionError extends Error {
  constructor(message: string) {
    super(`Redis connection error: ${message}`);
    this.name = 'RedisConnectionError';
  }
}
