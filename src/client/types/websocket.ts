export interface WebSocketMessage {
  id: string;
  type: 'message' | 'query' | 'response' | 'error' | 'status' | 'ping' | 'pong';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface WebSocketConnection {
  id: string;
  sessionId: string;
  userId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastActivity: Date;
  retryCount: number;
}

export interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  timeout: number;
  token?: string;
}
