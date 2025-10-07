import { WebSocketService } from '../services/websocket-service';
import { ChatMessage } from '../types/session';
import { WebSocketConfig } from '../types/websocket';

export class ChatWindow {
  private container: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputForm!: HTMLFormElement;
  private messageInput!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private statusIndicator!: HTMLElement;
  private wsService: WebSocketService;
  private sessionId: string;
  private userId: string;
  private jwtToken: string | null = null;
  private responseTimeouts: NodeJS.Timeout[] = [];

  // Constants for response simulation
  private static readonly MIN_RESPONSE_DELAY = 1000;
  private static readonly MAX_RESPONSE_DELAY = 2000;

  constructor(
    container: HTMLElement,
    sessionId: string,
    userId: string,
    wsConfig: WebSocketConfig,
    jwtToken?: string
  ) {
    this.container = container;
    this.sessionId = sessionId;
    this.userId = userId;
    this.jwtToken = jwtToken || null;
    this.wsService = new WebSocketService(wsConfig);
    this.initializeElements();
    this.setupEventListeners();
    this.updateStatus('connecting', 'Connecting...');
    this.connect();
  }

  private initializeElements(): void {
    this.messagesContainer = this.container.querySelector('#chat-messages') as HTMLElement;
    this.inputForm = this.container.querySelector('#chat-form') as HTMLFormElement;
    this.messageInput = this.container.querySelector('#message-input') as HTMLTextAreaElement;
    this.sendButton = this.container.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.statusIndicator = this.container.querySelector('#connection-status') as HTMLElement;
  }

  private setupEventListeners(): void {
    this.inputForm.addEventListener('submit', this.handleSubmit.bind(this));
    this.messageInput.addEventListener('keydown', this.handleKeyDown.bind(this));

    this.wsService.on('connected', this.handleConnected.bind(this));
    this.wsService.on('disconnected', this.handleDisconnected.bind(this));
    this.wsService.on('message', this.handleMessage.bind(this));
    this.wsService.on('error', this.handleError.bind(this));
  }

  private async connect(): Promise<void> {
    try {
      // In Phase 2, WebSocket connection is optional for demo purposes
      // Only connect if WebSocket URL is provided and not a placeholder
      const wsUrl = this.wsService.getConfig()?.url;
      console.log('Chat window WebSocket URL:', wsUrl);
      console.log('WebSocket service config:', this.wsService.getConfig());

      if (this.wsService && wsUrl && wsUrl !== 'demo-mode') {
        // Get JWT token if not already provided
        if (!this.jwtToken) {
          console.log('No JWT token provided, attempting to get one...');
          await this.getJWTToken();
        }
        // Try to connect to the AI agent service
        console.log('Attempting to connect to AI agent service:', wsUrl);
        console.log('Using JWT token:', this.jwtToken ? 'Yes' : 'No');
        console.log('JWT token value:', this.jwtToken);

        // Set a timeout for WebSocket connection attempts
        const connectionTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 5000); // 5 second timeout
        });

        try {
          await Promise.race([
            this.wsService.connect(this.sessionId, this.userId, this.jwtToken || undefined),
            connectionTimeout,
          ]);
        } catch (connectionError) {
          console.warn(
            'WebSocket connection failed or timed out, falling back to demo mode:',
            connectionError
          );
          this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
          this.sendButton.disabled = false;
          return;
        }
      } else {
        // Demo mode - simulate connection
        this.handleConnected();
        console.log('Running in demo mode - WebSocket connection disabled');
      }
    } catch (error) {
      console.warn('WebSocket connection failed, running in demo mode:', error);
      this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
      this.sendButton.disabled = false;
    }
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();
    const message = this.messageInput.value.trim();

    if (message) {
      this.sendMessage(message);
      this.messageInput.value = '';
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.inputForm.dispatchEvent(new Event('submit'));
    }
  }

  private async sendMessage(content: string): Promise<void> {
    try {
      // Add user message to UI immediately
      this.addMessageToUI({
        id: this.generateId(),
        sessionId: this.sessionId,
        content,
        role: 'user',
        timestamp: new Date(),
        metadata: {},
        status: 'sent',
      });

      // Send via WebSocket if connected
      if (this.wsService && this.wsService.getConnectionStatus()?.status === 'connected') {
        this.wsService.sendMessage(content);
      }

      // Always send via API for persistence
      await this.sendMessageViaAPI(content);

      // In demo mode, simulate an AI response
      if (!this.wsService || this.wsService.getConnectionStatus()?.status !== 'connected') {
        this.simulateAIResponse(content);
      }
    } catch (error) {
      this.showError('Failed to send message');
    }
  }

  private async sendMessageViaAPI(content: string): Promise<void> {
    const response = await fetch(`/api/v1/sessions/${this.sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message via API');
    }
  }

  private handleConnected(): void {
    // Check if we're in demo mode (no actual WebSocket connection)
    const wsUrl = (this.wsService as any).config?.url;
    const connectionStatus = this.wsService.getConnectionStatus();
    console.log('handleConnected - wsUrl:', wsUrl);
    console.log('handleConnected - connectionStatus:', connectionStatus);

    const isDemoMode =
      !wsUrl ||
      wsUrl.includes('localhost:8') ||
      wsUrl === 'demo-mode' ||
      !connectionStatus ||
      connectionStatus?.status !== 'connected';

    console.log('handleConnected - isDemoMode:', isDemoMode);

    if (isDemoMode) {
      this.updateStatus('demo', 'Demo Mode - Simulated Responses');
    } else {
      this.updateStatus('connected', 'Connected');
    }
    this.sendButton.disabled = false;
  }

  private handleDisconnected(): void {
    this.updateStatus('disconnected', 'Disconnected');
    this.sendButton.disabled = true;
  }

  private handleMessage(message: unknown): void {
    const msg = message as {
      id?: string;
      type: string;
      content?: string;
      message?: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    };

    // Handle different message types
    if (msg.type === 'connection' || msg.type === 'status') {
      // For connection/status messages, use the message property or content
      const messageContent = msg.message || msg.content || 'Connected';
      this.addMessageToUI({
        id: msg.id || this.generateId(),
        sessionId: this.sessionId,
        content: messageContent,
        role: 'system',
        timestamp: new Date(msg.timestamp),
        metadata: msg.metadata || {},
        status: 'delivered',
      });
    } else if (msg.type === 'message' || msg.type === 'response') {
      // For actual chat messages
      this.addMessageToUI({
        id: msg.id || this.generateId(),
        sessionId: this.sessionId,
        content: msg.content || '',
        role: 'assistant',
        timestamp: new Date(msg.timestamp),
        metadata: msg.metadata || {},
        status: 'delivered',
      });
    } else if (msg.type === 'error') {
      // For error messages
      this.addMessageToUI({
        id: msg.id || this.generateId(),
        sessionId: this.sessionId,
        content: msg.content || msg.message || 'An error occurred',
        role: 'system',
        timestamp: new Date(msg.timestamp),
        metadata: msg.metadata || {},
        status: 'delivered',
      });
    }
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error);

    // Check if this is a connection error that should trigger fallback to demo mode
    if (
      error.message.includes('Connection timeout') ||
      error.message.includes('WebSocket connection failed') ||
      error.message.includes('Failed to fetch')
    ) {
      this.showError(
        'AI agent is currently unavailable. Running in demo mode with simulated responses.'
      );
      this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
      this.sendButton.disabled = false;
    } else {
      this.showError(`Connection error: ${error.message}`);
    }
  }

  private addMessageToUI(message: ChatMessage): void {
    const messageElement = this.createMessageElement(message);
    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
  }

  private createMessageElement(message: ChatMessage): HTMLElement {
    const messageDiv = document.createElement('div');
    messageDiv.className = `govuk-chat-message govuk-chat-message--${message.role}`;
    messageDiv.setAttribute('role', 'article');
    messageDiv.setAttribute('aria-label', `Message from ${message.role}`);
    messageDiv.setAttribute('data-message-id', message.id);

    const content = document.createElement('p');
    content.className = 'govuk-body';
    content.textContent = message.content;

    const timestamp = document.createElement('time');
    timestamp.className = 'govuk-chat-message__timestamp';
    timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
    timestamp.setAttribute('datetime', message.timestamp.toISOString());

    messageDiv.appendChild(content);
    messageDiv.appendChild(timestamp);

    return messageDiv;
  }

  private updateStatus(status: string, text: string): void {
    if (this.statusIndicator) {
      this.statusIndicator.className = `govuk-chat-status govuk-chat-status--${status}`;
      this.statusIndicator.textContent = text;
      this.statusIndicator.setAttribute('aria-live', 'polite');
      this.statusIndicator.setAttribute('role', 'status');
    }
  }

  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'govuk-error-summary';

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'govuk-error-summary__body';

    const p = document.createElement('p');
    p.className = 'govuk-body';
    p.textContent = message;

    bodyDiv.appendChild(p);
    errorDiv.appendChild(bodyDiv);

    this.container.insertBefore(errorDiv, this.messagesContainer);

    // Remove error after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private simulateAIResponse(userMessage: string): void {
    // Simulate AI response after a short delay
    const delay =
      ChatWindow.MIN_RESPONSE_DELAY +
      Math.random() * (ChatWindow.MAX_RESPONSE_DELAY - ChatWindow.MIN_RESPONSE_DELAY);

    const timeout = setTimeout(() => {
      const responses = [
        "Thank you for your message. I'm here to help with your banking and payments questions.",
        "I understand you're asking about " +
          userMessage.toLowerCase() +
          '. Let me help you with that.',
        "That's an interesting question. In the context of banking and payments, I can provide some guidance.",
        "I'm a banking and payments AI assistant. How can I help you today?",
        "Your message has been received. I'm processing your request and will provide a detailed response.",
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      this.addMessageToUI({
        id: this.generateId(),
        sessionId: this.sessionId,
        content: randomResponse,
        role: 'assistant',
        timestamp: new Date(),
        metadata: { simulated: true },
        status: 'delivered',
      });
    }, delay);

    this.responseTimeouts.push(timeout);
  }

  private generateId(): string {
    // Use crypto.randomBytes for secure ID generation
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  disconnect(): void {
    // Clean up all pending timeouts
    this.responseTimeouts.forEach(clearTimeout);
    this.responseTimeouts = [];

    if (this.wsService) {
      this.wsService.disconnect();
    }
  }

  /**
   * Gets a JWT token for WebSocket authentication
   */
  private async getJWTToken(): Promise<void> {
    try {
      const response = await fetch('/api/v1/auth/websocket-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookie
        body: JSON.stringify({
          sessionId: this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.token) {
        this.jwtToken = data.token;
        console.log('JWT token obtained for WebSocket connection');
      } else {
        throw new Error('Failed to get JWT token');
      }
    } catch (error) {
      console.error('Failed to get JWT token:', error);
      // Fall back to demo mode if JWT token retrieval fails
      this.updateStatus('demo', 'Demo Mode - Authentication Failed');
    }
  }
}
