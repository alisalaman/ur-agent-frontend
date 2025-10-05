import { WebSocketService } from '../services/websocket-service';
export class ChatWindow {
    container;
    messagesContainer;
    inputForm;
    messageInput;
    sendButton;
    statusIndicator;
    wsService;
    sessionId;
    userId;
    responseTimeouts = [];
    // Constants for response simulation
    static MIN_RESPONSE_DELAY = 1000;
    static MAX_RESPONSE_DELAY = 2000;
    constructor(container, sessionId, userId, wsConfig) {
        this.container = container;
        this.sessionId = sessionId;
        this.userId = userId;
        this.wsService = new WebSocketService(wsConfig);
        this.initializeElements();
        this.setupEventListeners();
        this.updateStatus('connecting', 'Connecting...');
        this.connect();
    }
    initializeElements() {
        this.messagesContainer = this.container.querySelector('#chat-messages');
        this.inputForm = this.container.querySelector('#chat-form');
        this.messageInput = this.container.querySelector('#message-input');
        this.sendButton = this.container.querySelector('button[type="submit"]');
        this.statusIndicator = this.container.querySelector('#connection-status');
    }
    setupEventListeners() {
        this.inputForm.addEventListener('submit', this.handleSubmit.bind(this));
        this.messageInput.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.wsService.on('connected', this.handleConnected.bind(this));
        this.wsService.on('disconnected', this.handleDisconnected.bind(this));
        this.wsService.on('message', this.handleMessage.bind(this));
        this.wsService.on('error', this.handleError.bind(this));
    }
    async connect() {
        try {
            // In Phase 2, WebSocket connection is optional for demo purposes
            // Only connect if WebSocket URL is provided and not a placeholder
            const wsUrl = this.wsService.config?.url;
            if (this.wsService && wsUrl && !wsUrl.includes('localhost:8080') && wsUrl !== 'demo-mode') {
                // Set a timeout for WebSocket connection attempts
                const connectionTimeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Connection timeout')), 2000); // 2 second timeout
                });
                try {
                    await Promise.race([
                        this.wsService.connect(this.sessionId, this.userId),
                        connectionTimeout,
                    ]);
                }
                catch (connectionError) {
                    console.warn('WebSocket connection failed or timed out, falling back to demo mode:', connectionError);
                    this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
                    this.sendButton.disabled = false;
                    return;
                }
            }
            else {
                // Demo mode - simulate connection
                this.handleConnected();
                console.log('Running in demo mode - WebSocket connection disabled');
            }
        }
        catch (error) {
            console.warn('WebSocket connection failed, running in demo mode:', error);
            this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
            this.sendButton.disabled = false;
        }
    }
    handleSubmit(event) {
        event.preventDefault();
        const message = this.messageInput.value.trim();
        if (message) {
            this.sendMessage(message);
            this.messageInput.value = '';
        }
    }
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.inputForm.dispatchEvent(new Event('submit'));
        }
    }
    async sendMessage(content) {
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
        }
        catch (error) {
            this.showError('Failed to send message');
        }
    }
    async sendMessageViaAPI(content) {
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
    handleConnected() {
        // Check if we're in demo mode (no actual WebSocket connection)
        const wsUrl = this.wsService.config?.url;
        const isDemoMode = !wsUrl ||
            wsUrl.includes('localhost:8080') ||
            wsUrl === 'demo-mode' ||
            !this.wsService.getConnectionStatus() ||
            this.wsService.getConnectionStatus()?.status !== 'connected';
        if (isDemoMode) {
            this.updateStatus('demo', 'Demo Mode - Simulated Responses');
        }
        else {
            this.updateStatus('connected', 'Connected');
        }
        this.sendButton.disabled = false;
    }
    handleDisconnected() {
        this.updateStatus('disconnected', 'Disconnected');
        this.sendButton.disabled = true;
    }
    handleMessage(message) {
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
    handleError(error) {
        console.error('WebSocket error:', error);
        // Check if this is a connection error that should trigger fallback to demo mode
        if (error.message.includes('Connection timeout') ||
            error.message.includes('WebSocket connection failed') ||
            error.message.includes('Failed to fetch')) {
            this.showError('AI agent is currently unavailable. Running in demo mode with simulated responses.');
            this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
            this.sendButton.disabled = false;
        }
        else {
            this.showError(`Connection error: ${error.message}`);
        }
    }
    addMessageToUI(message) {
        const messageElement = this.createMessageElement(message);
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }
    createMessageElement(message) {
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
    updateStatus(status, text) {
        if (this.statusIndicator) {
            this.statusIndicator.className = `govuk-chat-status govuk-chat-status--${status}`;
            this.statusIndicator.textContent = text;
            this.statusIndicator.setAttribute('aria-live', 'polite');
            this.statusIndicator.setAttribute('role', 'status');
        }
    }
    showError(message) {
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
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    simulateAIResponse(userMessage) {
        // Simulate AI response after a short delay
        const delay = ChatWindow.MIN_RESPONSE_DELAY +
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
    generateId() {
        // Use crypto.randomBytes for secure ID generation
        const array = new Uint8Array(8);
        crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    disconnect() {
        // Clean up all pending timeouts
        this.responseTimeouts.forEach(clearTimeout);
        this.responseTimeouts = [];
        if (this.wsService) {
            this.wsService.disconnect();
        }
    }
}
//# sourceMappingURL=chat-window.js.map