export class WebSocketNotConnectedError extends Error {
  constructor(message = 'WebSocket is not connected') {
    super(message);
    this.name = 'WebSocketNotConnectedError';
  }
}

export class WebSocketConnectionError extends Error {
  constructor(message = 'WebSocket connection failed') {
    super(message);
    this.name = 'WebSocketConnectionError';
  }
}
