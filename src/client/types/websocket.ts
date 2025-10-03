export interface WebSocketMessage {
  id: string;
  type: 'message' | 'query' | 'response' | 'error' | 'status';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
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
}
