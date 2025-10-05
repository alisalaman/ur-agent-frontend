// Simple bundled chat interface without complex imports
console.log('Simple chat interface loaded');

// Simple WebSocket service implementation
class SimpleWebSocketService {
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.connected = false;
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    async connect(sessionId, userId) {
        console.log('Simple WebSocket: Attempting to connect...');

        // Check if we have a valid WebSocket URL
        if (!this.config.url || this.config.url === 'demo-mode') {
            console.log('Simple WebSocket: No WebSocket URL configured, using demo mode');
            this.emit('error', new Error('No WebSocket URL configured'));
            return;
        }

        try {
            console.log('Simple WebSocket: Connecting to', this.config.url);
            this.ws = new WebSocket(this.config.url);

            this.ws.onopen = () => {
                console.log('Simple WebSocket: Connected successfully');
                this.connected = true;
                this.emit('connected', { sessionId, userId });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('Simple WebSocket: Message received', message);
                    this.emit('message', message);
                } catch (error) {
                    console.error('Simple WebSocket: Failed to parse message', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('Simple WebSocket: Connection closed', event.code, event.reason);
                this.connected = false;
                this.emit('disconnected', { code: event.code, reason: event.reason });
            };

            this.ws.onerror = (error) => {
                console.error('Simple WebSocket: Connection error', error);
                this.connected = false;
                this.emit('error', new Error('WebSocket connection failed'));
            };

        } catch (error) {
            console.error('Simple WebSocket: Failed to create connection', error);
            this.emit('error', new Error('Failed to create WebSocket connection'));
        }
    }

    sendMessage(content, metadata = {}) {
        if (!this.ws || !this.connected) {
            throw new Error('WebSocket not connected');
        }

        const message = {
            id: this.generateId(),
            type: 'query',
            content,
            timestamp: new Date().toISOString(),
            metadata
        };

        this.ws.send(JSON.stringify(message));
    }

    getConnectionStatus() {
        return {
            status: this.connected ? 'connected' : 'disconnected',
            connected: this.connected
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        console.log('Simple WebSocket: Disconnected');
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
}

// Simple ChatWindow implementation
class SimpleChatWindow {
    constructor(container, sessionId, userId, wsConfig) {
        this.container = container;
        this.sessionId = sessionId;
        this.userId = userId;
        this.wsService = new SimpleWebSocketService(wsConfig);
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
        // The status indicator is outside the chat container, so look in document
        this.statusIndicator = document.querySelector('#connection-status');
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
            console.log('Simple ChatWindow: Attempting connection...');
            await this.wsService.connect(this.sessionId, this.userId);
        } catch (error) {
            console.log('Simple ChatWindow: Connection failed, using demo mode:', error);
            this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
            this.sendButton.disabled = false;
            this.messageInput.disabled = false;
        }
    }

    handleConnected() {
        console.log('Simple ChatWindow: Connected');
        this.updateStatus('connected', 'Connected');
        this.sendButton.disabled = false;
        this.messageInput.disabled = false;
    }

    handleDisconnected() {
        console.log('Simple ChatWindow: Disconnected');
        this.updateStatus('disconnected', 'Disconnected');
        this.sendButton.disabled = true;
        this.messageInput.disabled = true;
    }

    handleMessage(message) {
        console.log('Simple ChatWindow: Message received:', message);
        this.addMessage(message.content, 'assistant');
    }

    handleError(error) {
        console.log('Simple ChatWindow: Error occurred:', error);
        this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
        this.sendButton.disabled = false;
        this.messageInput.disabled = false;
    }

    updateStatus(status, message) {
        this.statusIndicator.className = `govuk-chat-status govuk-chat-status--${status}`;
        this.statusIndicator.textContent = message;
    }

    handleSubmit(event) {
        event.preventDefault();
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.messageInput.value = '';

        // Try to send via WebSocket if connected, otherwise show demo response
        if (this.wsService.connected) {
            try {
                this.wsService.sendMessage(message, {
                    sessionId: this.sessionId,
                    userId: this.userId
                });
            } catch (error) {
                console.error('Failed to send message via WebSocket:', error);
                this.addMessage('Failed to send message. Please try again.', 'assistant');
            }
        } else {
            // Demo mode response
            setTimeout(() => {
                this.addMessage('This is a demo response. The AI agent is not available.', 'assistant');
            }, 1000);
        }
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSubmit(event);
        }
    }

    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `govuk-chat-message govuk-chat-message--${sender}`;

        const messageContent = document.createElement('p');
        messageContent.className = 'govuk-body';
        messageContent.textContent = content;

        messageDiv.appendChild(messageContent);
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    disconnect() {
        this.wsService.disconnect();
    }
}

// Make ChatWindow available globally
window.ChatWindow = SimpleChatWindow;

console.log('Simple ChatWindow class loaded and available globally');
