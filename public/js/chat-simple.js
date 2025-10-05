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
    
    // Simulate connection attempt
    setTimeout(() => {
      console.log('Simple WebSocket: Connection failed, using demo mode');
      this.emit('error', new Error('Connection failed'));
    }, 1000);
  }

  getConnectionStatus() {
    return { status: 'disconnected' };
  }

  disconnect() {
    console.log('Simple WebSocket: Disconnected');
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
      console.log('Simple ChatWindow: Attempting connection...');
      await this.wsService.connect(this.sessionId, this.userId);
    } catch (error) {
      console.log('Simple ChatWindow: Connection failed, using demo mode:', error);
      this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
      this.sendButton.disabled = false;
    }
  }

  handleConnected() {
    console.log('Simple ChatWindow: Connected');
    this.updateStatus('connected', 'Connected');
    this.sendButton.disabled = false;
  }

  handleDisconnected() {
    console.log('Simple ChatWindow: Disconnected');
    this.updateStatus('disconnected', 'Disconnected');
    this.sendButton.disabled = true;
  }

  handleMessage(message) {
    console.log('Simple ChatWindow: Message received:', message);
    this.addMessage(message.content, 'assistant');
  }

  handleError(error) {
    console.log('Simple ChatWindow: Error occurred:', error);
    this.updateStatus('demo', 'Demo Mode - AI Agent Unavailable');
    this.sendButton.disabled = false;
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

    // Simulate AI response in demo mode
    setTimeout(() => {
      this.addMessage('This is a demo response. The AI agent is not available.', 'assistant');
    }, 1000);
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
