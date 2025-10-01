import { WebSocketService } from '../services/websocket-service';
import { ChatMessage } from '../../server/types/session';

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
  private responseTimeouts: NodeJS.Timeout[] = [];

  // Constants for response simulation
  private static readonly MIN_RESPONSE_DELAY = 1000;
  private static readonly MAX_RESPONSE_DELAY = 2000;

  constructor(container: HTMLElement, sessionId: string, userId: string, wsConfig: any) {
    this.container = container;
    this.sessionId = sessionId;
    this.userId = userId;
    this.wsService = new WebSocketService(wsConfig);
    this.initializeElements();
    this.setupEventListeners();
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
      const wsUrl = (this.wsService as any).config?.url;
      if (this.wsService && wsUrl && !wsUrl.includes('localhost:8080') && wsUrl !== 'demo-mode') {
        await this.wsService.connect(this.sessionId, this.userId);
      } else {
        // Demo mode - simulate connection
        this.handleConnected();
        console.log('Running in demo mode - WebSocket connection disabled');
      }
    } catch (error) {
      console.warn('WebSocket connection failed, running in demo mode:', error);
      this.handleConnected(); // Still enable the interface
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
    this.updateStatus('connected', 'Connected');
    this.sendButton.disabled = false;
  }

  private handleDisconnected(): void {
    this.updateStatus('disconnected', 'Disconnected');
    this.sendButton.disabled = true;
  }

  private handleMessage(message: any): void {
    this.addMessageToUI({
      id: message.id,
      sessionId: this.sessionId,
      content: message.content,
      role: 'assistant',
      timestamp: new Date(message.timestamp),
      metadata: message.metadata || {},
      status: 'delivered',
    });
  }

  private handleError(error: Error): void {
    this.showError(`Connection error: ${error.message}`);
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
}
