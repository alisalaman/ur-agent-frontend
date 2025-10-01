import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketMessage, WebSocketConnection, WebSocketConfig } from '../types/websocket';
import { WebSocketNotConnectedError, WebSocketConnectionError } from '../../server/types/errors';
import { withRetry, withExponentialBackoff } from '../../server/utils/retry';
import { retryConfigs } from '../../server/config/retry';

/**
 * WebSocket service for real-time communication with AI agents
 * Handles connection, reconnection, heartbeat, and message management
 */
export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private connection: WebSocketConnection | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Creates a new WebSocket service instance
   * @param config - WebSocket configuration options
   */
  constructor(config: WebSocketConfig) {
    super();
    this.config = config;
  }

  /**
   * Establishes a WebSocket connection with retry logic
   * @param sessionId - Unique session identifier
   * @param userId - User identifier
   * @returns Promise that resolves when connection is established
   * @throws {Error} If connection fails
   */
  async connect(sessionId: string, userId: string): Promise<void> {
    const retryableConnect = withExponentialBackoff(
      this.establishConnection.bind(this),
      retryConfigs.websocket
    );

    await retryableConnect(sessionId, userId);
  }

  private async establishConnection(sessionId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connection = {
          id: this.generateId(),
          sessionId,
          userId,
          status: 'connecting',
          lastActivity: new Date(),
          retryCount: 0,
        };

        this.ws = new WebSocket(this.config.url, {
          headers: {
            'X-Session-ID': sessionId,
            'X-User-ID': userId,
          },
          handshakeTimeout: this.config.timeout,
        });

        this.setupEventHandlers();

        this.ws.on('open', () => {
          this.connection!.status = 'connected';
          this.connection!.retryCount = 0;
          this.startHeartbeat();
          this.emit('connected', this.connection);
          resolve();
        });

        this.ws.on('error', (error) => {
          this.connection!.status = 'error';
          this.emit('error', error);
          reject(new WebSocketConnectionError(`WebSocket connection failed: ${error.message}`));
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reject(new WebSocketConnectionError(`WebSocket setup failed: ${errorMessage}`));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.connection!.lastActivity = new Date();
        this.emit('message', message);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.emit('error', new Error(`Failed to parse WebSocket message: ${errorMessage}`));
      }
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.connection!.status = 'disconnected';
      this.stopHeartbeat();
      this.emit('disconnected', { code, reason });
      this.handleReconnection();
    });

    this.ws.on('error', (error: Error) => {
      this.connection!.status = 'error';
      this.emit('error', error);
    });
  }

  /**
   * Sends a message through the WebSocket connection with retry logic
   * @param content - Message content to send
   * @param metadata - Optional metadata to include with the message
   * @throws {WebSocketNotConnectedError} If WebSocket is not connected
   */
  sendMessage(content: string, metadata?: Record<string, any>): void {
    if (!this.ws || this.connection?.status !== 'connected') {
      throw new WebSocketNotConnectedError();
    }

    const retryableSend = withRetry(this.performSend.bind(this), retryConfigs.websocket);

    retryableSend(content, metadata).catch((error) => {
      this.emit('error', new Error(`Failed to send message: ${error.message}`));
    });
  }

  private async performSend(content: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.ws || this.connection?.status !== 'connected') {
      throw new WebSocketNotConnectedError();
    }

    const message: WebSocketMessage = {
      id: this.generateId(),
      type: 'message',
      content,
      timestamp: new Date(),
      metadata: metadata || {},
    };

    return new Promise((resolve, reject) => {
      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(error);
        } else {
          this.connection!.lastActivity = new Date();
          resolve();
        }
      });
    });
  }

  private handleReconnection(): void {
    if (!this.connection || this.connection.retryCount >= this.config.reconnectAttempts) {
      this.emit('maxRetriesReached');
      return;
    }

    this.connection.status = 'reconnecting';
    this.connection.retryCount++;

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.connection!.sessionId, this.connection!.userId).catch(() => {
        // Reconnection will be handled by the close event
      });
    }, this.config.reconnectDelay * this.connection.retryCount);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.connection?.status === 'connected') {
        this.ws.ping();
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Disconnects the WebSocket and cleans up resources
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.connection) {
      this.connection.status = 'disconnected';
    }
  }

  /**
   * Gets the current connection status
   * @returns Current connection information or null if not connected
   */
  getConnectionStatus(): WebSocketConnection | null {
    return this.connection;
  }

  private generateId(): string {
    // Use crypto.randomBytes for secure ID generation
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
