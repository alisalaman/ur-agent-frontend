# Phase 4: Production Readiness
**Duration**: 2 weeks  
**Goal**: Prepare the application for production deployment with security hardening, performance optimization, comprehensive testing, and deployment automation

## Overview

This final phase focuses on making the chat interface production-ready by implementing security best practices, optimizing performance, creating comprehensive test coverage, and automating deployment processes. The application will be hardened against common security vulnerabilities and optimized for high availability and scalability.

## Prerequisites

- Phase 3 completed successfully
- Production infrastructure available
- Security scanning tools configured
- CI/CD pipeline infrastructure ready
- Performance testing tools available

## Implementation Tasks

### 1. Security Hardening

#### 1.1 Install Security Dependencies
```bash
npm install helmet@^7.1.0 rate-limiter-flexible@^4.0.0
npm install express-rate-limit@^7.1.0 @types/express-rate-limit@^7.0.0
npm install express-validator@^7.0.0 @types/express-validator@^7.0.0
npm install bcrypt@^5.1.0 @types/bcrypt@^5.0.0
npm install jsonwebtoken@^9.0.0 @types/jsonwebtoken@^9.0.0
npm install express-slow-down@^2.0.0 @types/express-slow-down@^2.0.0
```

#### 1.2 Create Security Configuration
```typescript
// src/server/config/security.ts
export interface SecurityConfig {
  helmet: {
    contentSecurityPolicy: {
      directives: Record<string, string[]>;
    };
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
    };
    noSniff: boolean;
    xssFilter: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
  cors: {
    origin: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  session: {
    secret: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
  };
}

export const securityConfig: SecurityConfig = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true
    },
    noSniff: true,
    xssFilter: true
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-User-ID']
  },
  session: {
    secret: process.env.SESSION_SECRET || 'default-secret',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

#### 1.3 Create Security Middleware
```typescript
// src/server/middleware/security.ts
import { Request, ResponseToolkit } from '@hapi/hapi';
import { securityConfig } from '../config/security';
import { logger } from '../utils/logging';

export function securityHeaders(request: Request, h: ResponseToolkit) {
  const response = h.continue;
  
  // Security headers
  response.header('X-Content-Type-Options', 'nosniff');
  response.header('X-Frame-Options', 'DENY');
  response.header('X-XSS-Protection', '1; mode=block');
  response.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  return response;
}

export function rateLimitMiddleware(request: Request, h: ResponseToolkit) {
  const ip = request.info.remoteAddress;
  const userAgent = request.headers['user-agent'];
  
  // Basic rate limiting logic
  // In production, use Redis-based rate limiting
  logger.info('Rate limit check', { ip, userAgent });
  
  return h.continue;
}

export function inputValidation(request: Request, h: ResponseToolkit) {
  // Validate input data
  if (request.payload) {
    const payload = request.payload as any;
    
    // Check for potential XSS
    if (typeof payload === 'string' && /<script|javascript:|on\w+=/i.test(payload)) {
      logger.warn('Potential XSS attempt detected', {
        ip: request.info.remoteAddress,
        payload: payload.substring(0, 100)
      });
      
      return h.response({
        error: 'Invalid input detected'
      }).code(400);
    }
  }
  
  return h.continue;
}

export function auditLogging(request: Request, h: ResponseToolkit) {
  const startTime = Date.now();
  
  request.events.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: request.method,
      path: request.url.path,
      statusCode: request.response?.statusCode,
      duration,
      ip: request.info.remoteAddress,
      userAgent: request.headers['user-agent']
    });
  });
  
  return h.continue;
}
```

#### 1.4 Create Authentication Service
```typescript
// src/server/services/auth-service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logging';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export class AuthService {
  private jwtSecret: string;
  private saltRounds: number = 12;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret';
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      this.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      logger.warn('Invalid JWT token', { error: error.message });
      return null;
    }
  }

  async authenticateUser(email: string, password: string): Promise<AuthResult> {
    try {
      // In production, this would query a database
      const user = await this.findUserByEmail(email);
      
      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      const isValidPassword = await this.verifyPassword(password, user.passwordHash);
      
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Update last login
      user.lastLogin = new Date();
      
      const token = this.generateToken(user);
      
      logger.info('User authenticated successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      logger.error('Authentication error', { error: error.message });
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    // TODO: Implement database lookup
    // This is a placeholder for production implementation
    return null;
  }

  validateSession(session: any): boolean {
    if (!session || !session.userId) {
      return false;
    }

    // Check session expiry
    const now = new Date();
    const sessionAge = now.getTime() - new Date(session.createdAt).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    return sessionAge < maxAge;
  }
}
```

#### 1.5 Create Security Plugin
```typescript
// src/server/plugins/security.ts
import Hapi from '@hapi/hapi';
import { securityConfig } from '../config/security';
import { securityHeaders, rateLimitMiddleware, inputValidation, auditLogging } from '../middleware/security';
import { AuthService } from '../services/auth-service';

export const securityPlugin: Hapi.Plugin<{}> = {
  name: 'security',
  register: async (server: Hapi.Server): Promise<void> => {
    // Security headers
    server.ext('onPreResponse', securityHeaders);
    
    // Rate limiting
    server.ext('onPreHandler', rateLimitMiddleware);
    
    // Input validation
    server.ext('onPreHandler', inputValidation);
    
    // Audit logging
    server.ext('onRequest', auditLogging);
    
    // Initialize auth service
    const authService = new AuthService();
    server.decorate('server', 'authService', authService);
    
    // Security routes
    server.route({
      method: 'POST',
      path: '/api/v1/auth/login',
      options: {
        auth: false,
        validate: {
          payload: {
            email: Joi.string().email().required(),
            password: Joi.string().min(8).required()
          }
        }
      },
      handler: async (request, h) => {
        const { email, password } = request.payload as any;
        const result = await authService.authenticateUser(email, password);
        
        if (result.success) {
          return h.response({
            token: result.token,
            user: {
              id: result.user!.id,
              email: result.user!.email,
              role: result.user!.role
            }
          });
        }
        
        return h.response({
          error: result.error
        }).code(401);
      }
    });
  }
};
```

### 2. Performance Optimization

#### 2.1 Install Performance Dependencies
```bash
npm install compression@^1.7.4 @types/compression@^1.7.0
npm install express-cache-controller@^1.0.0 @types/express-cache-controller@^1.0.0
npm install cluster@^0.7.7 @types/cluster@^0.7.7
```

#### 2.2 Create Performance Service
```typescript
// src/server/services/performance-service.ts
import { logger } from '../utils/logging';

export class PerformanceService {
  private static instance: PerformanceService;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  getMetricStats(name: string): any {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics) {
      result[name] = this.getMetricStats(name);
    }
    
    return result;
  }

  startTimer(name: string): () => void {
    const start = process.hrtime.bigint();
    
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      this.recordMetric(name, duration);
    };
  }
}
```

#### 2.3 Create Caching Service
```typescript
// src/server/services/cache-service.ts
import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logging';

export class CacheService {
  private redis: RedisClientType;
  private localCache: Map<string, { value: any; expiry: number }> = new Map();
  private defaultTTL: number = 300; // 5 minutes

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.redis.connect();
    
    // Clean up expired local cache entries
    setInterval(() => {
      this.cleanupLocalCache();
    }, 60000); // Every minute
  }

  async get(key: string): Promise<any> {
    try {
      // Try local cache first
      const localEntry = this.localCache.get(key);
      if (localEntry && localEntry.expiry > Date.now()) {
        return localEntry.value;
      }

      // Try Redis
      const value = await this.redis.get(key);
      if (value) {
        const parsed = JSON.parse(value);
        
        // Store in local cache
        this.localCache.set(key, {
          value: parsed,
          expiry: Date.now() + (this.defaultTTL * 1000)
        });
        
        return parsed;
      }

      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const expiry = ttl || this.defaultTTL;
      
      // Store in Redis
      await this.redis.setEx(key, expiry, JSON.stringify(value));
      
      // Store in local cache
      this.localCache.set(key, {
        value,
        expiry: Date.now() + (expiry * 1000)
      });
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.localCache.delete(key);
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushAll();
      this.localCache.clear();
    } catch (error) {
      logger.error('Cache clear error', { error: error.message });
    }
  }

  private cleanupLocalCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.localCache) {
      if (entry.expiry <= now) {
        this.localCache.delete(key);
      }
    }
  }
}
```

#### 2.4 Create Performance Plugin
```typescript
// src/server/plugins/performance.ts
import Hapi from '@hapi/hapi';
import { PerformanceService } from '../services/performance-service';
import { CacheService } from '../services/cache-service';

export const performancePlugin: Hapi.Plugin<{}> = {
  name: 'performance',
  register: async (server: Hapi.Server): Promise<void> => {
    const performanceService = PerformanceService.getInstance();
    const cacheService = new CacheService();
    
    // Make services available
    server.decorate('server', 'performanceService', performanceService);
    server.decorate('server', 'cacheService', cacheService);
    
    // Performance monitoring middleware
    server.ext('onRequest', (request, h) => {
      const timer = performanceService.startTimer('request_duration');
      request.app.requestTimer = timer;
      return h.continue;
    });
    
    server.ext('onPreResponse', (request, h) => {
      if (request.app.requestTimer) {
        request.app.requestTimer();
      }
      return h.continue;
    });
    
    // Performance metrics endpoint
    server.route({
      method: 'GET',
      path: '/api/v1/performance/metrics',
      handler: (request, h) => {
        const metrics = performanceService.getAllMetrics();
        return h.response(metrics);
      }
    });
  }
};
```

### 3. Comprehensive Testing

#### 3.1 Install Testing Dependencies
```bash
npm install -D jest@^29.7.0 @types/jest@^29.5.0
npm install -D supertest@^6.3.0 @types/supertest@^6.0.0
npm install -D @testing-library/jest-dom@^6.0.0
npm install -D @testing-library/user-event@^14.0.0
npm install -D playwright@^1.40.0
npm install -D artillery@^2.0.0
```

#### 3.2 Create Test Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000
};
```

#### 3.3 Create E2E Tests
```typescript
// tests/e2e/chat-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Interface E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('should display chat interface', async ({ page }) => {
    await expect(page.locator('#chat-container')).toBeVisible();
    await expect(page.locator('#message-input')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should send and receive messages', async ({ page }) => {
    const messageInput = page.locator('#message-input');
    const sendButton = page.locator('button[type="submit"]');
    
    await messageInput.fill('Hello, AI agent!');
    await sendButton.click();
    
    // Wait for message to appear
    await expect(page.locator('.govuk-chat-message--user')).toContainText('Hello, AI agent!');
    
    // Wait for AI response (mock)
    await expect(page.locator('.govuk-chat-message--assistant')).toBeVisible();
  });

  test('should handle connection errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/v1/sessions/*/messages', route => route.abort());
    
    const messageInput = page.locator('#message-input');
    const sendButton = page.locator('button[type="submit"]');
    
    await messageInput.fill('Test message');
    await sendButton.click();
    
    // Should show error message
    await expect(page.locator('.govuk-error-summary')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.locator('#chat-container')).toBeVisible();
    await expect(page.locator('#message-input')).toBeVisible();
  });
});
```

#### 3.4 Create Load Tests
```yaml
# tests/load/chat-load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60s
      arrivalRate: 10
      name: "Warm up"
    - duration: 120s
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 300s
      arrivalRate: 100
      name: "Sustained load"
    - duration: 60s
      arrivalRate: 200
      name: "Peak load"
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Chat session flow"
    weight: 70
    flow:
      - post:
          url: "/api/v1/sessions"
          json:
            userId: "user-{{ $randomString() }}"
            metadata:
              userAgent: "Load Test Agent"
      - post:
          url: "/api/v1/sessions/{{ sessionId }}/messages"
          json:
            content: "Hello, this is a load test message"
      - get:
          url: "/api/v1/sessions/{{ sessionId }}/messages"

  - name: "Health check"
    weight: 30
    flow:
      - get:
          url: "/health"
```

### 4. Deployment Automation

#### 4.1 Create Docker Production Configuration
```dockerfile
# docker/Dockerfile.prod
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server/index.js"]
```

#### 4.2 Create Kubernetes Manifests
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: govuk-chat
  labels:
    name: govuk-chat
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: govuk-chat-config
  namespace: govuk-chat
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  HOST: "0.0.0.0"
---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: govuk-chat-secrets
  namespace: govuk-chat
type: Opaque
data:
  SESSION_SECRET: <base64-encoded-secret>
  JWT_SECRET: <base64-encoded-jwt-secret>
  REDIS_URL: <base64-encoded-redis-url>
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: govuk-chat-frontend
  namespace: govuk-chat
  labels:
    app: govuk-chat-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: govuk-chat-frontend
  template:
    metadata:
      labels:
        app: govuk-chat-frontend
    spec:
      containers:
      - name: chat-app
        image: govuk-chat-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: govuk-chat-config
              key: NODE_ENV
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: govuk-chat-secrets
              key: SESSION_SECRET
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: govuk-chat-secrets
              key: REDIS_URL
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: govuk-chat-service
  namespace: govuk-chat
spec:
  selector:
    app: govuk-chat-frontend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: govuk-chat-ingress
  namespace: govuk-chat
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - chat.your-domain.gov.uk
    secretName: govuk-chat-tls
  rules:
  - host: chat.your-domain.gov.uk
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: govuk-chat-service
            port:
              number: 80
```

#### 4.3 Create CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run tests
      run: npm test
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level moderate
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./docker/Dockerfile.prod
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'latest'
    
    - name: Configure kubectl
      run: |
        echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
    
    - name: Deploy to Kubernetes
      run: |
        kubectl apply -f k8s/
        kubectl rollout status deployment/govuk-chat-frontend -n govuk-chat
```

### 5. Monitoring and Alerting

#### 5.1 Create Monitoring Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'govuk-chat-frontend'
    static_configs:
      - targets: ['govuk-chat-frontend:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
---
# monitoring/alert_rules.yml
groups:
- name: govuk-chat-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(chat_errors_total[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"
  
  - alert: CircuitBreakerOpen
    expr: chat_circuit_breaker_state > 1
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Circuit breaker is open"
      description: "Circuit breaker for {{ $labels.service }} is open"
  
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(chat_message_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }} seconds"
  
  - alert: ServiceDown
    expr: up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service is down"
      description: "{{ $labels.instance }} is down"
```

#### 5.2 Create Grafana Dashboard
```json
{
  "dashboard": {
    "title": "GOV.UK Chat Interface",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(chat_messages_total[5m])",
            "legendFormat": "Messages/sec"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(chat_message_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(chat_errors_total[5m])",
            "legendFormat": "Errors/sec"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "chat_active_connections",
            "legendFormat": "Connections"
          }
        ]
      }
    ]
  }
}
```

### 6. Documentation

#### 6.1 Create API Documentation
```yaml
# docs/api/openapi.yml
openapi: 3.0.0
info:
  title: GOV.UK Chat Interface API
  version: 1.0.0
  description: API for the GOV.UK Chat Interface

paths:
  /api/v1/sessions:
    post:
      summary: Create a new chat session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                userId:
                  type: string
                  description: User identifier
                metadata:
                  type: object
                  description: Session metadata
      responses:
        '201':
          description: Session created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessionId:
                    type: string
                  status:
                    type: string
                  createdAt:
                    type: string
                    format: date-time
        '400':
          description: Bad request
        '500':
          description: Internal server error

  /api/v1/sessions/{sessionId}/messages:
    post:
      summary: Send a message
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                content:
                  type: string
                  description: Message content
                metadata:
                  type: object
                  description: Message metadata
      responses:
        '200':
          description: Message sent successfully
        '404':
          description: Session not found
        '500':
          description: Internal server error
```

#### 6.2 Create Deployment Guide
```markdown
# docs/deployment/production-deployment.md

## Production Deployment Guide

### Prerequisites

1. Kubernetes cluster (v1.24+)
2. Redis cluster
3. Domain name and SSL certificates
4. Monitoring stack (Prometheus, Grafana)

### Deployment Steps

1. **Configure secrets**
   ```bash
   kubectl create secret generic govuk-chat-secrets \
     --from-literal=SESSION_SECRET=your-session-secret \
     --from-literal=JWT_SECRET=your-jwt-secret \
     --from-literal=REDIS_URL=redis://your-redis-cluster:6379
   ```

2. **Deploy application**
   ```bash
   kubectl apply -f k8s/
   ```

3. **Verify deployment**
   ```bash
   kubectl get pods -n govuk-chat
   kubectl get services -n govuk-chat
   ```

4. **Check logs**
   ```bash
   kubectl logs -f deployment/govuk-chat-frontend -n govuk-chat
   ```

### Monitoring

- Access Grafana dashboard at `https://grafana.your-domain.gov.uk`
- View Prometheus metrics at `https://prometheus.your-domain.gov.uk`
- Check application health at `https://chat.your-domain.gov.uk/health`

### Troubleshooting

Common issues and solutions:

1. **Pod not starting**: Check resource limits and secrets
2. **Connection errors**: Verify Redis connectivity
3. **High memory usage**: Check for memory leaks in logs
4. **Slow responses**: Review performance metrics
```

## Validation Checklist

- [ ] Security headers properly configured
- [ ] Rate limiting working correctly
- [ ] Authentication and authorization implemented
- [ ] Performance optimizations applied
- [ ] Caching strategy implemented
- [ ] Comprehensive test coverage achieved
- [ ] E2E tests passing
- [ ] Load tests completed successfully
- [ ] Docker images building correctly
- [ ] Kubernetes manifests validated
- [ ] CI/CD pipeline working
- [ ] Monitoring and alerting configured
- [ ] Documentation complete
- [ ] Security audit passed
- [ ] Performance benchmarks met

## Deliverables

1. **Security-hardened application** with proper authentication
2. **Performance-optimized system** with caching and monitoring
3. **Comprehensive test suite** with 80%+ coverage
4. **Production-ready Docker images** with proper security
5. **Kubernetes deployment manifests** for scalable deployment
6. **CI/CD pipeline** with automated testing and deployment
7. **Monitoring and alerting** setup with Grafana dashboards
8. **Complete documentation** for deployment and maintenance

## Final Validation

Before considering the project complete, ensure:

- [ ] All security vulnerabilities addressed
- [ ] Performance meets requirements under load
- [ ] System handles failures gracefully
- [ ] Monitoring provides adequate visibility
- [ ] Deployment process is fully automated
- [ ] Documentation is complete and accurate
- [ ] Team is trained on operations and maintenance

This completes the production readiness phase, delivering a robust, secure, and scalable chat interface ready for government use.
