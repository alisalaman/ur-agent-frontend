# Phase 2: Core Chat Features
**Duration**: 2 weeks  
**Goal**: Implement core chat functionality including WebSocket connections, message handling, and session management

## Overview

This phase focuses on implementing the core chat functionality that enables real-time communication with AI agents. We'll build WebSocket client services, implement message handling, create session management, and develop the interactive chat interface components.

## Prerequisites

- Phase 1 completed successfully
- Redis running (for session storage)
- AI agent WebSocket endpoint available for testing

## Implementation Tasks

### 1. WebSocket Client Implementation

#### 1.1 Install WebSocket Dependencies
```bash
npm install ws@^8.18.0 @types/ws@^8.5.0
```

#### 1.2 Create WebSocket Types
```typescript
// src/client/types/websocket.ts
export interface WebSocketMessage {
  id: string;
  type: 'message' | 'response' | 'error' | 'status';
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
```

#### 1.3 Create WebSocket Service
```typescript
// src/client/services/websocket-service.ts
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketMessage, WebSocketConnection, WebSocketConfig } from '../types/websocket';

export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private connection: WebSocketConnection | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    super();
    this.config = config;
  }

  async connect(sessionId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connection = {
          id: this.generateId(),
          sessionId,
          userId,
          status: 'connecting',
          lastActivity: new Date(),
          retryCount: 0
        };

        this.ws = new WebSocket(this.config.url, {
          headers: {
            'X-Session-ID': sessionId,
            'X-User-ID': userId
          }
        });

        this.setupEventHandlers();
        
        this.ws.on('open', () => {
          this.connection!.status = 'connected';
          this.startHeartbeat();
          this.emit('connected', this.connection);
          resolve();
        });

        this.ws.on('error', (error) => {
          this.connection!.status = 'error';
          this.emit('error', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
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
        this.emit('error', new Error('Failed to parse WebSocket message'));
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

  sendMessage(content: string, metadata?: Record<string, any>): void {
    if (!this.ws || this.connection?.status !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    const message: WebSocketMessage = {
      id: this.generateId(),
      type: 'message',
      content,
      timestamp: new Date(),
      metadata
    };

    this.ws.send(JSON.stringify(message));
    this.connection.lastActivity = new Date();
  }

  private handleReconnection(): void {
    if (!this.connection || this.connection.retryCount >= this.config.reconnectAttempts) {
      this.emit('maxRetriesReached');
      return;
    }

    this.connection.status = 'reconnecting';
    this.connection.retryCount++;
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.connection!.sessionId, this.connection!.userId)
        .catch(() => {
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

  getConnectionStatus(): WebSocketConnection | null {
    return this.connection;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
```

### 2. Session Management

#### 2.1 Install Session Dependencies
```bash
npm install @hapi/cookie@^12.0.0 redis@^4.6.0 @types/redis@^4.0.0
```

#### 2.2 Create Session Types
```typescript
// src/server/types/session.ts
export interface ChatSession {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'archived';
  messages: ChatMessage[];
  metadata: SessionMetadata;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata: MessageMetadata;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  lastActivity?: Date;
  messageCount?: number;
}

export interface MessageMetadata {
  agentType?: 'BankRep' | 'TradeBodyRep' | 'PaymentsEcosystemRep';
  confidence?: number;
  processingTime?: number;
  error?: string;
}
```

#### 2.3 Create Session Service
```typescript
// src/server/services/session-service.ts
import { ChatSession, ChatMessage, SessionMetadata, MessageMetadata } from '../types/session';
import { createClient, RedisClientType } from 'redis';
import { appConfig } from '../config';

export class SessionService {
  private redis: RedisClientType;

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.redis.connect();
  }

  async createSession(userId: string, metadata: SessionMetadata): Promise<ChatSession> {
    const session: ChatSession = {
      id: this.generateId(),
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      messages: [],
      metadata: {
        ...metadata,
        lastActivity: new Date(),
        messageCount: 0
      }
    };

    await this.redis.setEx(
      `session:${session.id}`,
      appConfig.session.ttl,
      JSON.stringify(session)
    );

    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    };

    await this.redis.setEx(
      `session:${sessionId}`,
      appConfig.session.ttl,
      JSON.stringify(updatedSession)
    );
  }

  async addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const newMessage: ChatMessage = {
      ...message,
      id: this.generateId(),
      timestamp: new Date()
    };

    session.messages.push(newMessage);
    session.metadata.lastActivity = new Date();
    session.metadata.messageCount = session.messages.length;

    await this.redis.setEx(
      `session:${sessionId}`,
      appConfig.session.ttl,
      JSON.stringify(session)
    );

    return newMessage;
  }

  async getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    const messages = session.messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return limit ? messages.slice(-limit) : messages;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const keys = await this.redis.keys(`session:*`);
    const sessions: ChatSession[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session: ChatSession = JSON.parse(data);
        if (session.userId === userId) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
```

#### 2.4 Create Session Plugin
```typescript
// src/server/plugins/session.ts
import Hapi from '@hapi/hapi';
import Cookie from '@hapi/cookie';
import { SessionService } from '../services/session-service';

export const sessionPlugin: Hapi.Plugin<{}> = {
  name: 'session',
  register: async (server: Hapi.Server): Promise<void> => {
    await server.register(Cookie);
    
    const sessionService = new SessionService();
    
    server.auth.strategy('session', 'cookie', {
      cookie: {
        name: 'session',
        password: process.env.SESSION_SECRET || 'default-secret',
        isSecure: process.env.NODE_ENV === 'production',
        isHttpOnly: true,
        isSameSite: 'Lax',
        ttl: 24 * 60 * 60 * 1000 // 24 hours
      },
      validateFunc: async (request, session) => {
        if (!session || !session.userId) {
          return { valid: false };
        }
        return { valid: true, credentials: session };
      }
    });

    server.auth.default('session');
    
    // Make session service available to routes
    server.decorate('request', 'sessionService', sessionService);
  }
};
```

### 3. Chat API Routes

#### 3.1 Create Chat API Routes
```typescript
// src/server/routes/chat-api.ts
import Hapi from '@hapi/hapi';
import Joi from '@hapi/joi';
import { SessionService } from '../services/session-service';
import { WebSocketService } from '../../client/services/websocket-service';

const messageSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  metadata: Joi.object().optional()
});

const sessionSchema = Joi.object({
  userId: Joi.string().required(),
  metadata: Joi.object({
    userAgent: Joi.string().optional(),
    ipAddress: Joi.string().optional()
  }).optional()
});

export const chatApiRoutes: Hapi.Plugin<{}> = {
  name: 'chat-api',
  register: async (server: Hapi.Server): Promise<void> => {
    // Create new session
    server.route({
      method: 'POST',
      path: '/api/v1/sessions',
      options: {
        auth: false,
        validate: {
          payload: sessionSchema
        }
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { userId, metadata } = request.payload as any;
        
        const session = await sessionService.createSession(userId, metadata || {});
        
        return h.response({
          sessionId: session.id,
          status: 'created',
          createdAt: session.createdAt
        }).code(201);
      }
    });

    // Get session details
    server.route({
      method: 'GET',
      path: '/api/v1/sessions/{sessionId}',
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;
        
        const session = await sessionService.getSession(sessionId);
        if (!session) {
          return h.response({ error: 'Session not found' }).code(404);
        }
        
        return h.response(session);
      }
    });

    // Get session messages
    server.route({
      method: 'GET',
      path: '/api/v1/sessions/{sessionId}/messages',
      options: {
        validate: {
          query: Joi.object({
            limit: Joi.number().integer().min(1).max(100).optional()
          })
        }
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;
        const { limit } = request.query;
        
        const messages = await sessionService.getMessages(sessionId, limit);
        return h.response({ messages });
      }
    });

    // Send message
    server.route({
      method: 'POST',
      path: '/api/v1/sessions/{sessionId}/messages',
      options: {
        validate: {
          payload: messageSchema
        }
      },
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;
        const { content, metadata } = request.payload as any;
        
        // Add user message to session
        const userMessage = await sessionService.addMessage(sessionId, {
          sessionId,
          content,
          role: 'user',
          metadata: metadata || {},
          status: 'sent'
        });

        // TODO: Send to WebSocket service in Phase 3
        // For now, just return the message
        return h.response({
          message: userMessage,
          status: 'sent'
        });
      }
    });

    // Delete session
    server.route({
      method: 'DELETE',
      path: '/api/v1/sessions/{sessionId}',
      handler: async (request, h) => {
        const sessionService = request.server.app.sessionService as SessionService;
        const { sessionId } = request.params;
        
        await sessionService.deleteSession(sessionId);
        return h.response({ status: 'deleted' });
      }
    });
  }
};
```

### 4. Frontend Chat Components

#### 4.1 Create Chat Window Component
```typescript
// src/client/components/chat-window.ts
import { WebSocketService } from '../services/websocket-service';
import { ChatMessage } from '../../server/types/session';

export class ChatWindow {
  private container: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputForm: HTMLFormElement;
  private messageInput: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private statusIndicator: HTMLElement;
  private wsService: WebSocketService;
  private sessionId: string;
  private userId: string;

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
      await this.wsService.connect(this.sessionId, this.userId);
    } catch (error) {
      this.showError('Failed to connect to chat service');
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
        content,
        role: 'user',
        timestamp: new Date(),
        status: 'sent'
      });

      // Send via WebSocket
      this.wsService.sendMessage(content);
      
      // Also send via API for persistence
      await this.sendMessageViaAPI(content);
      
    } catch (error) {
      this.showError('Failed to send message');
    }
  }

  private async sendMessageViaAPI(content: string): Promise<void> {
    const response = await fetch(`/api/v1/sessions/${this.sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
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
      content: message.content,
      role: 'assistant',
      timestamp: new Date(message.timestamp),
      status: 'delivered',
      metadata: message.metadata
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
    
    const content = document.createElement('p');
    content.className = 'govuk-body';
    content.textContent = message.content;
    
    const timestamp = document.createElement('time');
    timestamp.className = 'govuk-chat-message__timestamp';
    timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
    
    messageDiv.appendChild(content);
    messageDiv.appendChild(timestamp);
    
    return messageDiv;
  }

  private updateStatus(status: string, text: string): void {
    if (this.statusIndicator) {
      this.statusIndicator.className = `govuk-chat-status govuk-chat-status--${status}`;
      this.statusIndicator.textContent = text;
    }
  }

  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'govuk-error-summary';
    errorDiv.innerHTML = `
      <div class="govuk-error-summary__body">
        <p class="govuk-body">${message}</p>
      </div>
    `;
    
    this.container.insertBefore(errorDiv, this.messagesContainer);
    
    // Remove error after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  disconnect(): void {
    this.wsService.disconnect();
  }
}
```

#### 4.2 Update Chat Template
```html
<!-- src/templates/pages/chat.njk -->
{% extends "layouts/default.njk" %}

{% block pageTitle %}Chat Interface{% endblock %}

{% block content %}
<div class="govuk-width-container">
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-full">
      <h1 class="govuk-heading-xl">Chat Interface</h1>
      
      <div id="connection-status" class="govuk-chat-status govuk-chat-status--connecting">
        Connecting...
      </div>
      
      <div id="chat-container" class="govuk-chat-container">
        <div id="chat-messages" class="govuk-chat-messages">
          <div class="govuk-chat-message govuk-chat-message--system">
            <p class="govuk-body">Welcome! How can I help you today?</p>
          </div>
        </div>
        
        <div id="chat-input-container" class="govuk-chat-input-container">
          <form id="chat-form" class="govuk-form">
            <div class="govuk-form-group">
              <label class="govuk-label" for="message-input">
                Your message
              </label>
              <textarea 
                class="govuk-textarea" 
                id="message-input" 
                name="message" 
                rows="3"
                placeholder="Type your message here..."
                required
                disabled
              ></textarea>
            </div>
            <button type="submit" class="govuk-button" data-module="govuk-button" disabled>
              Send message
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>
{% endblock %}

{% block scripts %}
<script>
  // Initialize chat when page loads
  document.addEventListener('DOMContentLoaded', function() {
    const sessionId = '{{ sessionId }}';
    const userId = '{{ userId }}';
    const wsConfig = {
      url: '{{ wsUrl }}',
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      timeout: 10000
    };
    
    const chatContainer = document.getElementById('chat-container');
    const chatWindow = new ChatWindow(chatContainer, sessionId, userId, wsConfig);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
      chatWindow.disconnect();
    });
  });
</script>
{% endblock %}
```

### 5. Enhanced Styling

#### 5.1 Update Application CSS
```css
/* public/css/application.css */
.govuk-chat-container {
  border: 1px solid #b1b4b6;
  border-radius: 4px;
  height: 600px;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}

.govuk-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #f8f8f8;
  border-bottom: 1px solid #b1b4b6;
}

.govuk-chat-message {
  margin-bottom: 15px;
  padding: 15px;
  border-radius: 8px;
  position: relative;
  max-width: 80%;
  word-wrap: break-word;
}

.govuk-chat-message--user {
  background-color: #1d70b8;
  color: white;
  margin-left: auto;
  margin-right: 0;
}

.govuk-chat-message--assistant {
  background-color: white;
  border: 1px solid #b1b4b6;
  margin-left: 0;
  margin-right: auto;
}

.govuk-chat-message--system {
  background-color: #f3f2f1;
  border: 1px solid #b1b4b6;
  text-align: center;
  font-style: italic;
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
}

.govuk-chat-message__timestamp {
  font-size: 12px;
  opacity: 0.7;
  display: block;
  margin-top: 5px;
}

.govuk-chat-input-container {
  padding: 20px;
  background-color: white;
  border-top: 1px solid #b1b4b6;
}

.govuk-chat-input-container .govuk-form-group {
  margin-bottom: 15px;
}

.govuk-chat-status {
  padding: 10px 15px;
  margin-bottom: 15px;
  border-radius: 4px;
  font-weight: bold;
}

.govuk-chat-status--connecting {
  background-color: #fef3cd;
  border: 1px solid #f0ad4e;
  color: #8a6d3b;
}

.govuk-chat-status--connected {
  background-color: #d4edda;
  border: 1px solid #28a745;
  color: #155724;
}

.govuk-chat-status--disconnected {
  background-color: #f8d7da;
  border: 1px solid #dc3545;
  color: #721c24;
}

.govuk-chat-status--error {
  background-color: #f8d7da;
  border: 1px solid #dc3545;
  color: #721c24;
}

/* Loading animation for messages */
.govuk-chat-message--loading {
  opacity: 0.7;
}

.govuk-chat-message--loading::after {
  content: '...';
  animation: dots 1.5s infinite;
}

@keyframes dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}

/* Responsive design */
@media (max-width: 768px) {
  .govuk-chat-container {
    height: 500px;
  }
  
  .govuk-chat-message {
    max-width: 95%;
  }
}
```

### 6. WebSocket Plugin for Server

#### 6.1 Create WebSocket Plugin
```typescript
// src/server/plugins/websocket.ts
import Hapi from '@hapi/hapi';
import { WebSocketService } from '../../client/services/websocket-service';

export const websocketPlugin: Hapi.Plugin<{}> = {
  name: 'websocket',
  register: async (server: Hapi.Server): Promise<void> => {
    const wsService = new WebSocketService({
      url: process.env.AI_AGENT_WS_URL || 'ws://localhost:8080/ws',
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      timeout: 10000
    });

    // Make WebSocket service available to routes
    server.decorate('server', 'wsService', wsService);
    
    // Handle WebSocket messages
    wsService.on('message', (message) => {
      // TODO: Process AI agent responses
      console.log('Received message from AI agent:', message);
    });

    wsService.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
};
```

### 7. Testing

#### 7.1 Create WebSocket Service Tests
```typescript
// tests/unit/client/services/websocket-service.test.ts
import { WebSocketService } from '../../../../src/client/services/websocket-service';

describe('WebSocketService', () => {
  let wsService: WebSocketService;
  const mockConfig = {
    url: 'ws://localhost:8080',
    reconnectAttempts: 3,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    timeout: 10000
  };

  beforeEach(() => {
    wsService = new WebSocketService(mockConfig);
  });

  afterEach(() => {
    wsService.disconnect();
  });

  test('should create WebSocket service instance', () => {
    expect(wsService).toBeDefined();
  });

  test('should handle connection events', (done) => {
    wsService.on('connected', () => {
      expect(true).toBe(true);
      done();
    });

    // Mock connection would be tested here
  });
});
```

#### 7.2 Create Session Service Tests
```typescript
// tests/unit/server/services/session-service.test.ts
import { SessionService } from '../../../../src/server/services/session-service';

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService();
  });

  test('should create session successfully', async () => {
    const session = await sessionService.createSession('user123', {});
    expect(session).toBeDefined();
    expect(session.userId).toBe('user123');
    expect(session.status).toBe('active');
  });

  test('should add message to session', async () => {
    const session = await sessionService.createSession('user123', {});
    const message = await sessionService.addMessage(session.id, {
      sessionId: session.id,
      content: 'Hello',
      role: 'user',
      metadata: {},
      status: 'sent'
    });

    expect(message).toBeDefined();
    expect(message.content).toBe('Hello');
    expect(message.role).toBe('user');
  });
});
```

## Validation Checklist

- [ ] WebSocket service connects successfully
- [ ] Session management working with Redis
- [ ] Chat messages persist to database
- [ ] Real-time message exchange functional
- [ ] Error handling for connection failures
- [ ] UI updates reflect connection status
- [ ] Message history loads correctly
- [ ] Responsive design works on mobile
- [ ] Unit tests pass
- [ ] Integration tests pass

## Deliverables

1. **WebSocket client service** with reconnection logic
2. **Session management system** with Redis persistence
3. **Interactive chat interface** with real-time updates
4. **API endpoints** for session and message management
5. **Enhanced UI components** following GOV.UK design patterns
6. **Comprehensive test suite** for core functionality

## Next Phase

Phase 3 will build resilience patterns including retry logic, circuit breakers, and graceful degradation to ensure the chat interface remains functional even when external services are unavailable.
