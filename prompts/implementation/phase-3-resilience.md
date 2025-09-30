# Phase 3: Resilience Patterns
**Duration**: 2 weeks  
**Goal**: Implement comprehensive resilience patterns including retry logic, circuit breakers, graceful degradation, and monitoring

## Overview

This phase focuses on making the chat interface resilient to failures and external service disruptions. We'll implement retry strategies, circuit breakers, graceful degradation patterns, comprehensive error handling, and monitoring capabilities to ensure the system remains functional even when external dependencies fail.

## Prerequisites

- Phase 2 completed successfully
- Redis cluster available for testing
- AI agent backend with failure simulation capabilities
- Monitoring infrastructure (Prometheus/Grafana) for production

## Implementation Tasks

### 1. Retry Strategy Implementation

#### 1.1 Install Retry Dependencies
```bash
npm install p-retry@^6.2.0 @types/p-retry@^6.0.0
```

#### 1.2 Create Retry Configuration
```typescript
// src/server/config/retry.ts
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryCondition: (error: Error) => boolean;
  onFailedAttempt?: (error: Error) => void;
}

export const retryConfigs = {
  websocket: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    jitter: true,
    retryCondition: (error: Error) => {
      return error.name === 'WebSocketConnectionError' || 
             error.message.includes('timeout') ||
             error.message.includes('ECONNRESET');
    }
  },
  api: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    jitter: true,
    retryCondition: (error: Error) => {
      return error.message.includes('ECONNRESET') ||
             error.message.includes('ETIMEDOUT') ||
             error.message.includes('ENOTFOUND');
    }
  },
  database: {
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 10000,
    jitter: true,
    retryCondition: (error: Error) => {
      return error.message.includes('connection') ||
             error.message.includes('timeout') ||
             error.message.includes('ECONNREFUSED');
    }
  }
};
```

#### 1.3 Create Retry Decorator
```typescript
// src/server/utils/retry.ts
import pRetry from 'p-retry';
import { RetryConfig } from '../config/retry';
import { logger } from './logging';

export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig
): (...args: T) => Promise<R> {
  return pRetry(fn, {
    retries: config.maxAttempts - 1,
    minTimeout: config.baseDelay,
    maxTimeout: config.maxDelay,
    randomize: config.jitter,
    onFailedAttempt: (error) => {
      logger.warn('Retry attempt failed', {
        attempt: error.attemptNumber,
        error: error.message,
        retriesLeft: error.retriesLeft,
        retryConfig: {
          maxAttempts: config.maxAttempts,
          baseDelay: config.baseDelay,
          maxDelay: config.maxDelay
        }
      });
      
      if (config.onFailedAttempt) {
        config.onFailedAttempt(error);
      }
    }
  });
}

export function withExponentialBackoff<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig
): (...args: T) => Promise<R> {
  return pRetry(fn, {
    retries: config.maxAttempts - 1,
    minTimeout: config.baseDelay,
    maxTimeout: config.maxDelay,
    randomize: config.jitter,
    factor: 2,
    onFailedAttempt: (error) => {
      logger.warn('Exponential backoff retry failed', {
        attempt: error.attemptNumber,
        error: error.message,
        retriesLeft: error.retriesLeft,
        nextRetryIn: error.retriesLeft > 0 ? Math.min(config.baseDelay * Math.pow(2, error.attemptNumber - 1), config.maxDelay) : 0
      });
    }
  });
}
```

#### 1.4 Update WebSocket Service with Retry
```typescript
// src/client/services/websocket-service.ts (updated)
import { withRetry, withExponentialBackoff } from '../../server/utils/retry';
import { retryConfigs } from '../../server/config/retry';

export class WebSocketService extends EventEmitter {
  // ... existing code ...

  async connect(sessionId: string, userId: string): Promise<void> {
    const retryableConnect = withExponentialBackoff(
      this.establishConnection.bind(this),
      retryConfigs.websocket
    );

    return retryableConnect(sessionId, userId);
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
          retryCount: 0
        };

        this.ws = new WebSocket(this.config.url, {
          headers: {
            'X-Session-ID': sessionId,
            'X-User-ID': userId
          },
          handshakeTimeout: this.config.timeout
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
          reject(new Error(`WebSocket connection failed: ${error.message}`));
        });

      } catch (error) {
        reject(new Error(`WebSocket setup failed: ${error.message}`));
      }
    });
  }

  sendMessage(content: string, metadata?: Record<string, any>): void {
    if (!this.ws || this.connection?.status !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    const retryableSend = withRetry(
      this.performSend.bind(this),
      retryConfigs.websocket
    );

    retryableSend(content, metadata).catch((error) => {
      this.emit('error', new Error(`Failed to send message: ${error.message}`));
    });
  }

  private async performSend(content: string, metadata?: Record<string, any>): Promise<void> {
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
}
```

### 2. Circuit Breaker Implementation

#### 2.1 Install Circuit Breaker Dependencies
```bash
npm install opossum@^8.2.0 @types/opossum@^8.0.0
```

#### 2.2 Create Circuit Breaker Service
```typescript
// src/server/services/circuit-breaker-service.ts
import CircuitBreaker from 'opossum';
import { logger } from '../utils/logging';

export interface CircuitBreakerConfig {
  timeout: number;
  errorThreshold: number;
  resetTimeout: number;
  name: string;
  volumeThreshold?: number;
}

export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();

  createBreaker<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    config: CircuitBreakerConfig
  ): CircuitBreaker {
    const breaker = new CircuitBreaker(fn, {
      timeout: config.timeout,
      errorThresholdPercentage: config.errorThreshold,
      resetTimeout: config.resetTimeout,
      name: config.name,
      volumeThreshold: config.volumeThreshold || 10
    });

    this.setupEventHandlers(breaker, config.name);
    this.breakers.set(config.name, breaker);
    
    return breaker;
  }

  private setupEventHandlers(breaker: CircuitBreaker, name: string): void {
    breaker.on('open', () => {
      logger.warn('Circuit breaker opened', { 
        service: name,
        timestamp: new Date().toISOString()
      });
    });

    breaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open', { 
        service: name,
        timestamp: new Date().toISOString()
      });
    });

    breaker.on('close', () => {
      logger.info('Circuit breaker closed', { 
        service: name,
        timestamp: new Date().toISOString()
      });
    });

    breaker.on('failure', (error) => {
      logger.error('Circuit breaker failure', {
        service: name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });

    breaker.on('success', () => {
      logger.debug('Circuit breaker success', {
        service: name,
        timestamp: new Date().toISOString()
      });
    });
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getBreakerStats(name: string): any {
    const breaker = this.breakers.get(name);
    return breaker ? {
      state: breaker.state,
      stats: breaker.stats,
      name: breaker.name
    } : null;
  }

  getAllBreakerStats(): any[] {
    return Array.from(this.breakers.values()).map(breaker => ({
      state: breaker.state,
      stats: breaker.stats,
      name: breaker.name
    }));
  }
}
```

#### 2.3 Create Service-Specific Circuit Breakers
```typescript
// src/server/services/ai-agent-circuit-breaker.ts
import { CircuitBreakerService } from './circuit-breaker-service';
import { WebSocketService } from '../../client/services/websocket-service';
import { logger } from '../utils/logging';

export class AIAgentCircuitBreaker {
  private circuitBreakerService: CircuitBreakerService;
  private wsService: WebSocketService;
  private breaker: any;

  constructor(wsService: WebSocketService) {
    this.circuitBreakerService = new CircuitBreakerService();
    this.wsService = wsService;
    this.initializeBreaker();
  }

  private initializeBreaker(): void {
    this.breaker = this.circuitBreakerService.createBreaker(
      this.callAIAgent.bind(this),
      {
        name: 'ai-agent',
        timeout: 10000,
        errorThreshold: 50,
        resetTimeout: 30000,
        volumeThreshold: 5
      }
    );
  }

  async sendMessage(content: string, metadata?: Record<string, any>): Promise<any> {
    try {
      return await this.breaker.fire(content, metadata);
    } catch (error) {
      if (this.breaker.state === 'open') {
        logger.warn('AI Agent circuit breaker is open, using fallback', {
          error: error.message,
          content: content.substring(0, 100)
        });
        return this.getFallbackResponse(content);
      }
      throw error;
    }
  }

  private async callAIAgent(content: string, metadata?: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AI Agent request timeout'));
      }, 8000);

      this.wsService.sendMessage(content, metadata);
      
      const messageHandler = (message: any) => {
        clearTimeout(timeout);
        this.wsService.off('message', messageHandler);
        resolve(message);
      };

      this.wsService.on('message', messageHandler);
      this.wsService.on('error', (error) => {
        clearTimeout(timeout);
        this.wsService.off('message', messageHandler);
        reject(error);
      });
    });
  }

  private getFallbackResponse(content: string): any {
    return {
      id: this.generateId(),
      type: 'response',
      content: 'I apologize, but I\'m currently experiencing technical difficulties. Please try again in a few moments, or contact support if the issue persists.',
      timestamp: new Date(),
      metadata: {
        fallback: true,
        reason: 'circuit-breaker-open',
        originalContent: content.substring(0, 100)
      }
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getStats(): any {
    return this.circuitBreakerService.getBreakerStats('ai-agent');
  }
}
```

### 3. Graceful Degradation

#### 3.1 Create Degradation Service
```typescript
// src/server/services/graceful-degradation.ts
import { logger } from '../utils/logging';

export interface DegradationLevel {
  level: 'full' | 'limited' | 'offline';
  description: string;
  features: string[];
  fallbackActions: Record<string, () => any>;
}

export class GracefulDegradationService {
  private currentLevel: DegradationLevel;
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();

  constructor() {
    this.currentLevel = {
      level: 'full',
      description: 'All services operational',
      features: ['websocket', 'ai-agent', 'session-storage', 'real-time'],
      fallbackActions: {}
    };
  }

  registerHealthCheck(name: string, check: () => Promise<boolean>): void {
    this.healthChecks.set(name, check);
  }

  async assessSystemHealth(): Promise<DegradationLevel> {
    const healthStatus = await this.checkAllServices();
    
    if (healthStatus.websocket && healthStatus.aiAgent && healthStatus.sessionStorage) {
      this.currentLevel = {
        level: 'full',
        description: 'All services operational',
        features: ['websocket', 'ai-agent', 'session-storage', 'real-time'],
        fallbackActions: {}
      };
    } else if (healthStatus.sessionStorage && (healthStatus.websocket || healthStatus.aiAgent)) {
      this.currentLevel = {
        level: 'limited',
        description: 'Limited functionality - some services unavailable',
        features: ['session-storage', 'message-queue'],
        fallbackActions: {
          sendMessage: this.queueMessageForLater.bind(this),
          getMessages: this.getCachedMessages.bind(this)
        };
      };
    } else {
      this.currentLevel = {
        level: 'offline',
        description: 'System offline - maintenance mode',
        features: ['static-content'],
        fallbackActions: {
          sendMessage: this.showOfflineMessage.bind(this),
          getMessages: this.showOfflineMessage.bind(this)
        };
      };
    }

    logger.info('System degradation level assessed', {
      level: this.currentLevel.level,
      description: this.currentLevel.description,
      healthStatus
    });

    return this.currentLevel;
  }

  private async checkAllServices(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, check] of this.healthChecks) {
      try {
        results[name] = await check();
      } catch (error) {
        logger.warn('Health check failed', { service: name, error: error.message });
        results[name] = false;
      }
    }
    
    return results;
  }

  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  canUseFeature(feature: string): boolean {
    return this.currentLevel.features.includes(feature);
  }

  getFallbackAction(action: string): (() => any) | undefined {
    return this.currentLevel.fallbackActions[action];
  }

  private async queueMessageForLater(message: any): Promise<any> {
    // TODO: Implement message queuing for later processing
    logger.info('Message queued for later processing', { messageId: message.id });
    return {
      status: 'queued',
      message: 'Your message has been queued and will be processed when services are restored.'
    };
  }

  private async getCachedMessages(sessionId: string): Promise<any[]> {
    // TODO: Implement cached message retrieval
    logger.info('Retrieving cached messages', { sessionId });
    return [];
  }

  private showOfflineMessage(): any {
    return {
      status: 'offline',
      message: 'The service is currently offline for maintenance. Please try again later.'
    };
  }
}
```

#### 3.2 Create Health Check Service
```typescript
// src/server/services/health-check-service.ts
import { createClient, RedisClientType } from 'redis';
import { WebSocketService } from '../../client/services/websocket-service';
import { logger } from '../utils/logging';

export class HealthCheckService {
  private redis: RedisClientType;
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.wsService = wsService;
  }

  async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      return false;
    }
  }

  async checkWebSocket(): Promise<boolean> {
    try {
      const connection = this.wsService.getConnectionStatus();
      return connection?.status === 'connected';
    } catch (error) {
      logger.error('WebSocket health check failed', { error: error.message });
      return false;
    }
  }

  async checkAIAgent(): Promise<boolean> {
    try {
      // Send a ping message to AI agent
      this.wsService.sendMessage('ping', { type: 'health-check' });
      return true;
    } catch (error) {
      logger.error('AI Agent health check failed', { error: error.message });
      return false;
    }
  }

  async getSystemHealth(): Promise<any> {
    const [redis, websocket, aiAgent] = await Promise.all([
      this.checkRedis(),
      this.checkWebSocket(),
      this.checkAIAgent()
    ]);

    const overallHealth = redis && websocket && aiAgent ? 'healthy' : 'degraded';

    return {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      services: {
        redis: { status: redis ? 'healthy' : 'unhealthy' },
        websocket: { status: websocket ? 'healthy' : 'unhealthy' },
        aiAgent: { status: aiAgent ? 'healthy' : 'unhealthy' }
      },
      uptime: process.uptime()
    };
  }
}
```

### 4. Enhanced Error Handling

#### 4.1 Create Error Types
```typescript
// src/server/types/errors.ts
export class ChatServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;

  constructor(message: string, code: string, statusCode: number = 500, isRetryable: boolean = false) {
    super(message);
    this.name = 'ChatServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export class WebSocketConnectionError extends ChatServiceError {
  constructor(message: string) {
    super(message, 'WEBSOCKET_CONNECTION_ERROR', 503, true);
    this.name = 'WebSocketConnectionError';
  }
}

export class SessionNotFoundError extends ChatServiceError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND', 404, false);
    this.name = 'SessionNotFoundError';
  }
}

export class MessageSendError extends ChatServiceError {
  constructor(message: string, isRetryable: boolean = true) {
    super(message, 'MESSAGE_SEND_ERROR', 500, isRetryable);
    this.name = 'MessageSendError';
  }
}

export class CircuitBreakerOpenError extends ChatServiceError {
  constructor(service: string) {
    super(`Circuit breaker for ${service} is open`, 'CIRCUIT_BREAKER_OPEN', 503, true);
    this.name = 'CircuitBreakerOpenError';
  }
}
```

#### 4.2 Create Error Handler
```typescript
// src/server/utils/error-handler.ts
import { Request, ResponseToolkit } from '@hapi/hapi';
import { ChatServiceError } from '../types/errors';
import { logger } from './logging';

export function errorHandler(error: Error, request: Request, h: ResponseToolkit) {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    url: request.url.path,
    method: request.method,
    userAgent: request.headers['user-agent'],
    ip: request.info.remoteAddress
  });

  if (error instanceof ChatServiceError) {
    return h.response({
      error: {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable
      }
    }).code(error.statusCode);
  }

  // Handle Hapi validation errors
  if (error.name === 'ValidationError') {
    return h.response({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.message
      }
    }).code(400);
  }

  // Default error response
  return h.response({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred'
    }
  }).code(500);
}

export function createErrorResponse(error: Error): any {
  if (error instanceof ChatServiceError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable
      }
    };
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred'
    }
  };
}
```

### 5. Monitoring and Observability

#### 5.1 Install Monitoring Dependencies
```bash
npm install prom-client@^15.0.0 @types/prom-client@^15.0.0
npm install winston@^3.11.0 winston-daily-rotate-file@^4.7.1
```

#### 5.2 Create Metrics Service
```typescript
// src/server/services/metrics-service.ts
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../utils/logging';

export class MetricsService {
  private messageCounter: Counter<string>;
  private messageDuration: Histogram<string>;
  private activeConnections: Gauge<string>;
  private errorCounter: Counter<string>;
  private circuitBreakerState: Gauge<string>;

  constructor() {
    // Collect default metrics
    collectDefaultMetrics({ register });

    // Custom metrics
    this.messageCounter = new Counter({
      name: 'chat_messages_total',
      help: 'Total number of chat messages',
      labelNames: ['type', 'status']
    });

    this.messageDuration = new Histogram({
      name: 'chat_message_duration_seconds',
      help: 'Duration of message processing',
      labelNames: ['type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    this.activeConnections = new Gauge({
      name: 'chat_active_connections',
      help: 'Number of active WebSocket connections'
    });

    this.errorCounter = new Counter({
      name: 'chat_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'service']
    });

    this.circuitBreakerState = new Gauge({
      name: 'chat_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
      labelNames: ['service']
    });

    register.registerMetric(this.messageCounter);
    register.registerMetric(this.messageDuration);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.errorCounter);
    register.registerMetric(this.circuitBreakerState);
  }

  incrementMessageCounter(type: string, status: string): void {
    this.messageCounter.inc({ type, status });
  }

  recordMessageDuration(type: string, status: string, duration: number): void {
    this.messageDuration.observe({ type, status }, duration);
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  incrementErrorCounter(type: string, service: string): void {
    this.errorCounter.inc({ type, service });
  }

  setCircuitBreakerState(service: string, state: 'closed' | 'half-open' | 'open'): void {
    const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
    this.circuitBreakerState.set({ service }, stateValue);
  }

  getMetrics(): Promise<string> {
    return register.metrics();
  }

  getHealthCheck(): Promise<any> {
    return register.getSingleMetricAsString('up');
  }
}
```

#### 5.3 Create Logging Service
```typescript
// src/server/utils/logging.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'govuk-chat-frontend' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// Create child loggers for different services
export const createServiceLogger = (service: string) => {
  return logger.child({ service });
};
```

### 6. Resilience Plugin

#### 6.1 Create Resilience Plugin
```typescript
// src/server/plugins/resilience.ts
import Hapi from '@hapi/hapi';
import { CircuitBreakerService } from '../services/circuit-breaker-service';
import { GracefulDegradationService } from '../services/graceful-degradation';
import { HealthCheckService } from '../services/health-check-service';
import { MetricsService } from '../services/metrics-service';
import { errorHandler } from '../utils/error-handler';

export const resiliencePlugin: Hapi.Plugin<{}> = {
  name: 'resilience',
  register: async (server: Hapi.Server): Promise<void> => {
    // Initialize services
    const circuitBreakerService = new CircuitBreakerService();
    const degradationService = new GracefulDegradationService();
    const metricsService = new MetricsService();
    
    // Get WebSocket service from server
    const wsService = server.app.wsService;
    const healthCheckService = new HealthCheckService(wsService);
    
    // Register health checks
    degradationService.registerHealthCheck('redis', () => healthCheckService.checkRedis());
    degradationService.registerHealthCheck('websocket', () => healthCheckService.checkWebSocket());
    degradationService.registerHealthCheck('aiAgent', () => healthCheckService.checkAIAgent());
    
    // Make services available to routes
    server.decorate('server', 'circuitBreakerService', circuitBreakerService);
    server.decorate('server', 'degradationService', degradationService);
    server.decorate('server', 'metricsService', metricsService);
    server.decorate('server', 'healthCheckService', healthCheckService);
    
    // Set up error handling
    server.ext('onPreResponse', (request, h) => {
      const response = request.response;
      if (response instanceof Error) {
        return errorHandler(response, request, h);
      }
      return h.continue;
    });
    
    // Periodic health assessment
    setInterval(async () => {
      await degradationService.assessSystemHealth();
    }, 30000); // Every 30 seconds
    
    // Periodic metrics collection
    setInterval(() => {
      // Update active connections metric
      const connectionStatus = wsService.getConnectionStatus();
      metricsService.setActiveConnections(connectionStatus ? 1 : 0);
    }, 10000); // Every 10 seconds
  }
};
```

### 7. Enhanced Health Endpoints

#### 7.1 Create Comprehensive Health Routes
```typescript
// src/server/routes/health.ts (updated)
import Hapi from '@hapi/hapi';

export const healthRoutes: Hapi.Plugin<{}> = {
  name: 'health-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    // Basic health check
    server.route({
      method: 'GET',
      path: '/health',
      handler: async (request, h) => {
        const healthCheckService = server.app.healthCheckService;
        const health = await healthCheckService.getSystemHealth();
        
        return h.response(health).code(health.status === 'healthy' ? 200 : 503);
      }
    });

    // Detailed health check
    server.route({
      method: 'GET',
      path: '/health/detailed',
      handler: async (request, h) => {
        const healthCheckService = server.app.healthCheckService;
        const degradationService = server.app.degradationService;
        const circuitBreakerService = server.app.circuitBreakerService;
        
        const [health, degradationLevel, breakerStats] = await Promise.all([
          healthCheckService.getSystemHealth(),
          degradationService.assessSystemHealth(),
          Promise.resolve(circuitBreakerService.getAllBreakerStats())
        ]);
        
        return h.response({
          ...health,
          degradation: degradationLevel,
          circuitBreakers: breakerStats,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Metrics endpoint
    server.route({
      method: 'GET',
      path: '/metrics',
      handler: async (request, h) => {
        const metricsService = server.app.metricsService;
        const metrics = await metricsService.getMetrics();
        
        return h.response(metrics).type('text/plain');
      }
    });

    // Readiness probe
    server.route({
      method: 'GET',
      path: '/ready',
      handler: async (request, h) => {
        const degradationService = server.app.degradationService;
        const level = degradationService.getCurrentLevel();
        
        if (level.level === 'offline') {
          return h.response({ status: 'not ready', reason: 'system offline' }).code(503);
        }
        
        return h.response({ status: 'ready' });
      }
    });

    // Liveness probe
    server.route({
      method: 'GET',
      path: '/live',
      handler: (request, h) => {
        return h.response({ status: 'alive', uptime: process.uptime() });
      }
    });
  }
};
```

### 8. Frontend Resilience

#### 8.1 Create Resilience Manager
```typescript
// src/client/services/resilience-manager.ts
import { WebSocketService } from './websocket-service';
import { logger } from '../../server/utils/logging';

export class ResilienceManager {
  private wsService: WebSocketService;
  private messageQueue: any[] = [];
  private isOnline: boolean = navigator.onLine;
  private retryAttempts: number = 0;
  private maxRetryAttempts: number = 5;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Network status monitoring
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // WebSocket events
    this.wsService.on('connected', this.handleConnected.bind(this));
    this.wsService.on('disconnected', this.handleDisconnected.bind(this));
    this.wsService.on('error', this.handleError.bind(this));
  }

  private handleOnline(): void {
    this.isOnline = true;
    this.retryAttempts = 0;
    this.processQueuedMessages();
    logger.info('Network connection restored');
  }

  private handleOffline(): void {
    this.isOnline = false;
    logger.warn('Network connection lost');
  }

  private handleConnected(): void {
    this.retryAttempts = 0;
    this.processQueuedMessages();
  }

  private handleDisconnected(): void {
    if (this.isOnline && this.retryAttempts < this.maxRetryAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error): void {
    logger.error('WebSocket error', { error: error.message });
    
    if (this.retryAttempts < this.maxRetryAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
    this.retryAttempts++;
    
    setTimeout(() => {
      if (this.isOnline) {
        this.wsService.connect(this.wsService.getConnectionStatus()?.sessionId || '', 
                              this.wsService.getConnectionStatus()?.userId || '');
      }
    }, delay);
  }

  sendMessage(content: string, metadata?: Record<string, any>): void {
    if (this.wsService.getConnectionStatus()?.status === 'connected') {
      try {
        this.wsService.sendMessage(content, metadata);
      } catch (error) {
        this.queueMessage({ content, metadata, timestamp: new Date() });
      }
    } else {
      this.queueMessage({ content, metadata, timestamp: new Date() });
    }
  }

  private queueMessage(message: any): void {
    this.messageQueue.push(message);
    logger.info('Message queued for later delivery', { queueSize: this.messageQueue.length });
  }

  private async processQueuedMessages(): Promise<void> {
    if (this.messageQueue.length === 0 || 
        this.wsService.getConnectionStatus()?.status !== 'connected') {
      return;
    }

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        this.wsService.sendMessage(message.content, message.metadata);
        logger.info('Queued message sent successfully');
      } catch (error) {
        this.messageQueue.push(message);
        logger.error('Failed to send queued message', { error: error.message });
      }
    }
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  getConnectionStatus(): any {
    return this.wsService.getConnectionStatus();
  }
}
```

### 9. Testing Resilience Patterns

#### 9.1 Create Resilience Tests
```typescript
// tests/integration/resilience/circuit-breaker.test.ts
import { CircuitBreakerService } from '../../../../src/server/services/circuit-breaker-service';

describe('Circuit Breaker', () => {
  let circuitBreakerService: CircuitBreakerService;

  beforeEach(() => {
    circuitBreakerService = new CircuitBreakerService();
  });

  test('should open circuit breaker after error threshold', async () => {
    let callCount = 0;
    const failingFunction = async () => {
      callCount++;
      throw new Error('Service unavailable');
    };

    const breaker = circuitBreakerService.createBreaker(failingFunction, {
      name: 'test-service',
      timeout: 1000,
      errorThreshold: 50,
      resetTimeout: 5000,
      volumeThreshold: 3
    });

    // Make enough calls to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.fire();
      } catch (error) {
        // Expected to fail
      }
    }

    expect(breaker.state).toBe('open');
    expect(callCount).toBeGreaterThan(0);
  });

  test('should close circuit breaker after reset timeout', async (done) => {
    const breaker = circuitBreakerService.createBreaker(
      async () => 'success',
      {
        name: 'test-service',
        timeout: 1000,
        errorThreshold: 50,
        resetTimeout: 1000,
        volumeThreshold: 1
      }
    );

    // Open the breaker
    breaker.open();

    setTimeout(async () => {
      try {
        const result = await breaker.fire();
        expect(result).toBe('success');
        expect(breaker.state).toBe('closed');
        done();
      } catch (error) {
        done(error);
      }
    }, 1100);
  });
});
```

#### 9.2 Create Degradation Tests
```typescript
// tests/integration/resilience/graceful-degradation.test.ts
import { GracefulDegradationService } from '../../../../src/server/services/graceful-degradation';

describe('Graceful Degradation', () => {
  let degradationService: GracefulDegradationService;

  beforeEach(() => {
    degradationService = new GracefulDegradationService();
  });

  test('should assess full functionality when all services are healthy', async () => {
    degradationService.registerHealthCheck('service1', async () => true);
    degradationService.registerHealthCheck('service2', async () => true);

    const level = await degradationService.assessSystemHealth();

    expect(level.level).toBe('full');
    expect(level.features).toContain('websocket');
    expect(level.features).toContain('ai-agent');
  });

  test('should degrade to limited functionality when some services fail', async () => {
    degradationService.registerHealthCheck('websocket', async () => true);
    degradationService.registerHealthCheck('aiAgent', async () => false);
    degradationService.registerHealthCheck('sessionStorage', async () => true);

    const level = await degradationService.assessSystemHealth();

    expect(level.level).toBe('limited');
    expect(level.features).toContain('session-storage');
    expect(level.features).not.toContain('real-time');
  });

  test('should go offline when critical services fail', async () => {
    degradationService.registerHealthCheck('websocket', async () => false);
    degradationService.registerHealthCheck('aiAgent', async () => false);
    degradationService.registerHealthCheck('sessionStorage', async () => false);

    const level = await degradationService.assessSystemHealth();

    expect(level.level).toBe('offline');
    expect(level.features).toContain('static-content');
  });
});
```

## Validation Checklist

- [ ] Retry logic works for WebSocket connections
- [ ] Circuit breakers open and close correctly
- [ ] Graceful degradation handles service failures
- [ ] Error handling provides meaningful responses
- [ ] Metrics are collected and exposed
- [ ] Health checks detect service status
- [ ] Message queuing works during outages
- [ ] Frontend resilience handles network issues
- [ ] Monitoring dashboards show system health
- [ ] All resilience tests pass

## Deliverables

1. **Comprehensive retry strategies** with exponential backoff
2. **Circuit breaker implementation** for all external services
3. **Graceful degradation system** with multiple service levels
4. **Enhanced error handling** with proper error types
5. **Monitoring and metrics** collection
6. **Health check endpoints** for Kubernetes probes
7. **Frontend resilience** with offline support
8. **Comprehensive test suite** for resilience patterns

## Next Phase

Phase 4 will focus on production readiness including security hardening, performance optimization, comprehensive testing, and deployment automation.
