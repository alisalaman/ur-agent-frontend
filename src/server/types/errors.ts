export class ChatServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ChatServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export class WebSocketConnectionError extends ChatServiceError {
  constructor(message: string) {
    super(message, 'WEBSOCKET_CONNECTION_ERROR', 503, true);
    this.name = 'WebSocketConnectionError';
  }
}

export class SessionNotFoundError extends ChatServiceError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND', 404, false);
    this.name = 'SessionNotFoundError';
  }
}

export class MessageSendError extends ChatServiceError {
  constructor(message: string, isRetryable: boolean = true) {
    super(message, 'MESSAGE_SEND_ERROR', 500, isRetryable);
    this.name = 'MessageSendError';
  }
}

export class CircuitBreakerOpenError extends ChatServiceError {
  constructor(service: string) {
    super(`Circuit breaker for ${service} is open`, 'CIRCUIT_BREAKER_OPEN', 503, true);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class WebSocketNotConnectedError extends ChatServiceError {
  constructor() {
    super('WebSocket is not connected', 'WEBSOCKET_NOT_CONNECTED', 503, true);
    this.name = 'WebSocketNotConnectedError';
  }
}

export class RedisConnectionError extends ChatServiceError {
  constructor(message: string) {
    super(message, 'REDIS_CONNECTION_ERROR', 503, true);
    this.name = 'RedisConnectionError';
  }
}

export class ValidationError extends ChatServiceError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400, false);
    this.name = 'ValidationError';
    if (field) {
      this.message = `Validation error for field '${field}': ${message}`;
    }
  }
}

export class NetworkError extends ChatServiceError {
  constructor(message: string, isRetryable: boolean = true) {
    super(message, 'NETWORK_ERROR', 503, isRetryable);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ChatServiceError {
  constructor(message: string, timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR', 504, true);
    this.name = 'TimeoutError';
    this.message = `Operation timed out after ${timeoutMs}ms: ${message}`;
  }
}

export class RetryableError extends ChatServiceError {
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message, code, statusCode, true);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends ChatServiceError {
  constructor(message: string, code: string, statusCode: number = 400) {
    super(message, code, statusCode, false);
    this.name = 'NonRetryableError';
  }
}
