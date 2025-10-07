import { EventEmitter } from 'events';
import { WebSocketMessage, WebSocketConnection, WebSocketConfig } from '../types/websocket';
import { WebSocketNotConnectedError, WebSocketConnectionError } from '../types/errors';
import { withExponentialBackoff, retryConfigs } from '../utils/retry';

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
   * Get the WebSocket configuration
   * @returns WebSocket configuration
   */
  getConfig(): WebSocketConfig {
    return this.config;
  }

  /**
   * Establishes a WebSocket connection with retry logic
   * @param sessionId - Unique session identifier
   * @param userId - User identifier
   * @param token - Optional JWT token for authentication
   * @returns Promise that resolves when connection is established
   * @throws {Error} If connection fails
   */
  async connect(sessionId: string, userId: string, token?: string): Promise<void> {
    const retryableConnect = await withExponentialBackoff(
      this.establishConnection.bind(this),
      retryConfigs.websocket
    );

    await retryableConnect(sessionId, userId, token);
  }

  private async establishConnection(
    sessionId: string,
    userId: string,
    token?: string
  ): Promise<void> {
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

        // Build WebSocket URL with token if provided
        let wsUrl = this.config.url;
        const tokenToUse = token || this.config.token;
        if (tokenToUse) {
          const separator = wsUrl.includes('?') ? '&' : '?';
          wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(tokenToUse)}`;
          console.log('WebSocket URL with token:', wsUrl);
        } else {
          console.log('No token provided for WebSocket connection');
        }

        console.log('Final WebSocket URL:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.setupEventHandlers();

        this.ws.onopen = () => {
          this.connection!.status = 'connected';
          this.connection!.retryCount = 0;
          this.startHeartbeat();
          this.emit('connected', this.connection);
          resolve();
        };

        this.ws.onerror = (error) => {
          this.connection!.status = 'error';
          this.emit('error', error);
          reject(new WebSocketConnectionError(`WebSocket connection failed: ${error}`));
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reject(new WebSocketConnectionError(`WebSocket setup failed: ${errorMessage}`));
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.connection!.lastActivity = new Date();
        this.emit('message', message);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.emit('error', new Error(`Failed to parse WebSocket message: ${errorMessage}`));
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.connection!.status = 'disconnected';
      this.stopHeartbeat();
      this.emit('disconnected', { code: event.code, reason: event.reason });
      this.handleReconnection();
    };

    this.ws.onerror = (error: Event) => {
      this.connection!.status = 'error';
      this.emit('error', error);
    };
  }

  /**
   * Sends a message through the WebSocket connection with retry logic
   * @param content - Message content to send
   * @throws {WebSocketNotConnectedError} If WebSocket is not connected
   */
  sendMessage(content: string): void {
    if (!this.ws || this.connection?.status !== 'connected') {
      throw new WebSocketNotConnectedError();
    }

    try {
      this.performSend(content);
    } catch (error) {
      this.emit('error', new Error(`Failed to send message: ${error}`));
    }
  }

  private performSend(content: string): void {
    if (!this.ws || this.connection?.status !== 'connected') {
      throw new WebSocketNotConnectedError();
    }

    // Format message according to backend expectations
    const message = {
      type: 'query',
      query: content,
      persona_type: 'BankRep', // Use a valid persona type
    };

    this.ws.send(JSON.stringify(message));
    this.connection!.lastActivity = new Date();
  }

  private handleReconnection(): void {
    if (!this.connection || this.connection.retryCount >= this.config.reconnectAttempts) {
      this.emit('maxRetriesReached');
      return;
    }

    this.connection.status = 'reconnecting';
    this.connection.retryCount++;

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.connection!.sessionId, this.connection!.userId, this.config.token).catch(
        () => {
          // Reconnection will be handled by the close event
        }
      );
    }, this.config.reconnectDelay * this.connection.retryCount);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.connection?.status === 'connected') {
        // Browser WebSocket doesn't have ping method, send a ping message instead
        this.ws.send(JSON.stringify({ type: 'ping' }));
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
