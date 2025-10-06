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

        // Handle different message types from the backend
        if (message.type === 'welcome') {
            // Don't display welcome messages in the chat
            return;
        } else if (message.type === 'query_response' && message.responses) {
            // Display responses from all personas as separate messages with tags
            const personaConfig = {
                'BankRep': { name: 'Bank Representative', color: 'govuk-tag--blue' },
                'TradeBodyRep': { name: 'Trade Body Representative', color: 'govuk-tag--green' },
                'PaymentsEcosystemRep': { name: 'Payments Ecosystem Representative', color: 'govuk-tag--purple' }
            };

            Object.keys(message.responses).forEach(persona => {
                const config = personaConfig[persona] || { name: persona, color: 'govuk-tag--grey' };
                const response = message.responses[persona];

                // Create a message with the tag above the content
                this.addMessageWithTag(response, 'assistant', config.name, config.color);
            });
        } else if (message.type === 'echo') {
            // Handle echo messages - display the echoed content
            if (message.message) {
                this.addMessage(message.message, 'assistant');
            } else {
                this.addMessage('Echo received', 'assistant');
            }
        } else if (message.content) {
            // Fallback for other message formats
            this.addMessage(message.content, 'assistant');
        } else {
            // Fallback for unknown message formats
            this.addMessage(JSON.stringify(message), 'assistant');
        }
    }

    handleError(error) {
        console.log('Simple ChatWindow: Error occurred:', error);
        this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
        this.sendButton.disabled = false;
        this.messageInput.disabled = false;
    }

    updateStatus(status, message) {
        // Update the notification banner to use proper GOV.UK styling
        this.statusIndicator.className = 'govuk-notification-banner';

        // Update the title based on status
        const titleElement = this.statusIndicator.querySelector('.govuk-notification-banner__title');
        if (titleElement) {
            if (status === 'connected') {
                titleElement.textContent = 'Success';
                this.statusIndicator.classList.add('govuk-notification-banner--success');
            } else if (status === 'disconnected' || status === 'error') {
                titleElement.textContent = 'Important';
            } else if (status === 'connecting') {
                titleElement.textContent = 'Important';
            } else if (status === 'demo') {
                titleElement.textContent = 'Important';
            }
        }

        // Update the message content
        const messageElement = this.statusIndicator.querySelector('#connection-message');
        if (messageElement) {
            messageElement.textContent = message;
        }

        // Show or hide the banner based on status
        if (status === 'connected') {
            this.statusIndicator.style.display = 'none'; // Hide when connected
        } else {
            this.statusIndicator.style.display = 'block'; // Show for other states
        }
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
        // Hide placeholder message when first real message is added
        const placeholderMessage = document.getElementById('placeholder-message');
        if (placeholderMessage) {
            console.log('Hiding placeholder message');
            placeholderMessage.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `govuk-chat-message govuk-chat-message--${sender}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'govuk-body';

        // Convert markdown to HTML
        const htmlContent = this.convertMarkdownToHtml(content);
        messageContent.innerHTML = htmlContent;

        messageDiv.appendChild(messageContent);
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    addMessageWithTag(content, sender, tagText, tagColor) {
        // Hide placeholder message when first real message is added
        const placeholderMessage = document.getElementById('placeholder-message');
        if (placeholderMessage) {
            placeholderMessage.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `govuk-chat-message govuk-chat-message--${sender}`;

        // Create tag element
        const tagElement = document.createElement('strong');
        tagElement.className = `govuk-tag ${tagColor}`;
        tagElement.textContent = tagText;

        // Create message content
        const messageContent = document.createElement('div');
        messageContent.className = 'govuk-body';
        messageContent.style.marginTop = '10px'; // Add spacing between tag and content

        // Convert markdown to HTML
        const htmlContent = this.convertMarkdownToHtml(content);
        messageContent.innerHTML = htmlContent;

        // Add tag above the message content
        messageDiv.appendChild(tagElement);
        messageDiv.appendChild(messageContent);

        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    convertMarkdownToHtml(markdown) {
        // Simple markdown to HTML converter
        let html = markdown;

        // Convert **bold** to <strong>bold</strong>
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Convert *italic* to <em>italic</em>
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Convert numbered lists - first convert to list items
        html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');

        // Wrap consecutive <li> elements in <ol>
        html = html.replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/gs, (match) => {
            return `<ol>${match}</ol>`;
        });

        // Convert line breaks to <br> (but not inside list items)
        html = html.replace(/\n(?!<li>)/g, '<br>');

        return html;
    }

    disconnect() {
        this.wsService.disconnect();
    }
}

// Make ChatWindow available globally
window.ChatWindow = SimpleChatWindow;

console.log('Simple ChatWindow class loaded and available globally');
