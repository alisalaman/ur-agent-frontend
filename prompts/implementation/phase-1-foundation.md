# Phase 1: Foundation Setup
**Duration**: 2 weeks  
**Goal**: Establish the basic project structure, server setup, and GOV.UK Frontend integration

## Overview

This phase focuses on creating the foundational infrastructure for the GOV.UK Frontend Chat Interface. We'll set up the project structure, configure the Hapi server, integrate GOV.UK Frontend components, and establish basic templating with Nunjucks.

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- Docker (for Redis in development)
- Git

## Implementation Tasks

### 1. Project Initialization

#### 1.1 Create Project Structure
```bash
mkdir govuk-chat-frontend
cd govuk-chat-frontend
npm init -y
```

#### 1.2 Install Core Dependencies
```bash
# Core server dependencies
npm install @hapi/hapi@^21.2.0 @hapi/joi@^17.12.0 @hapi/inert@^7.1.0 @hapi/vision@^7.0.0
npm install nunjucks@^3.3.5 govuk-frontend@^5.12.0
npm install dotenv@^16.4.0 helmet@^7.1.0 sass@^1.93.2

# Development dependencies
npm install -D @types/node@^22.0.0 @types/nunjucks@^3.2.0 typescript@^5.5.0
npm install -D ts-node@^10.9.0 nodemon@^3.0.0
npm install -D eslint@^8.57.0 prettier@^3.3.0 husky@^9.0.0 lint-staged@^15.2.0
npm install -D @typescript-eslint/eslint-plugin@^6.0.0 @typescript-eslint/parser@^6.0.0
npm install -D jest@^29.0.0 ts-jest@^29.0.0 @types/jest@^29.0.0
```

#### 1.3 Create Directory Structure
```bash
mkdir -p src/{server/{plugins,routes,services,models,utils,config},client/{components,services,utils,types},templates/{layouts,pages,components},scss}
mkdir -p public/{css,js,assets/{images,fonts}}
mkdir -p tests/{unit/{services,models,utils},integration/{api,websocket,resilience},e2e}
mkdir -p docker docs/{api,deployment,development}
```

### 2. TypeScript Configuration

#### 2.1 Create tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### 2.2 Create .eslintrc.js
```javascript
module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

#### 2.3 Create .prettierrc
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 3. Environment Configuration

#### 3.1 Create Configuration Types
```typescript
// src/server/config/types.ts
export interface AppConfig {
  server: {
    port: number;
    host: string;
    cors: {
      origin: string[];
      credentials: boolean;
    };
  };
  session: {
    secret: string;
    ttl: number;
  };
  monitoring: {
    enabled: boolean;
    logLevel: string;
  };
}

export interface EnvironmentConfig {
  development: AppConfig;
  production: AppConfig;
  test: AppConfig;
}
```

#### 3.2 Create Environment Files
```bash
# .env.development
NODE_ENV=development
PORT=3000
HOST=localhost
SESSION_SECRET=your-development-secret-key
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
```

```bash
# .env.production
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=your-production-secret-key
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.gov.uk
```

#### 3.3 Create Configuration Service
```typescript
// src/server/config/index.ts
import { config } from 'dotenv';
import { AppConfig } from './types';

const environment = process.env.NODE_ENV || 'development';
config({ path: `.env.${environment}` });

export const appConfig: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  },
  session: {
    secret: process.env.SESSION_SECRET || 'default-secret',
    ttl: 24 * 60 * 60 * 1000 // 24 hours
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};
```

### 4. Hapi Server Setup

#### 4.1 Create Basic Server
```typescript
// src/server/index.ts
import Hapi from '@hapi/hapi';
import { appConfig } from './config';
import { registerPlugins } from './plugins';
import { registerRoutes } from './routes';

async function createServer(): Promise<Hapi.Server> {
  const server = Hapi.server({
    port: appConfig.server.port,
    host: appConfig.server.host,
    routes: {
      cors: appConfig.server.cors
    }
  });

  await registerPlugins(server);
  await registerRoutes(server);

  return server;
}

async function startServer(): Promise<void> {
  try {
    const server = await createServer();
    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { createServer };
```

#### 4.2 Create Plugin Registration
```typescript
// src/server/plugins/index.ts
import Hapi from '@hapi/hapi';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import { nunjucksPlugin } from './nunjucks';

export async function registerPlugins(server: Hapi.Server): Promise<void> {
  await server.register([
    Inert,
    Vision,
    nunjucksPlugin
  ]);
}
```

#### 4.3 Create Nunjucks Plugin
```typescript
// src/server/plugins/nunjucks.ts
import Hapi from '@hapi/hapi';
import nunjucks from 'nunjucks';
import path from 'path';

export const nunjucksPlugin: Hapi.Plugin<{}> = {
  name: 'nunjucks',
  register: async (server: Hapi.Server): Promise<void> => {
    const templatesPath = path.join(__dirname, '../../templates');
    
    const nunjucksEnv = nunjucks.configure(templatesPath, {
      autoescape: true,
      throwOnUndefined: false,
      trimBlocks: false,
      lstripBlocks: false
    });

    server.views({
      engines: {
        njk: {
          compile: (src: string, options: any) => {
            const template = nunjucks.compile(src, nunjucksEnv);
            return (context: any) => template.render(context);
          }
        }
      },
      path: templatesPath,
      compileOptions: {
        noCache: process.env.NODE_ENV === 'development'
      }
    });
  }
};
```

### 5. GOV.UK Frontend Integration

#### 5.1 Copy GOV.UK Frontend Assets
```bash
# Copy images and fonts from node_modules to public directory
cp -r node_modules/govuk-frontend/dist/govuk/assets/images/* public/assets/images/
cp -r node_modules/govuk-frontend/dist/govuk/assets/fonts/* public/assets/fonts/

# Copy JavaScript file
cp node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.js public/js/govuk-frontend.js

# Copy GOV.UK Frontend components for Nunjucks templates
mkdir -p src/templates/govuk/{components,macros}
cp -r node_modules/govuk-frontend/dist/govuk/components/* src/templates/govuk/components/
cp -r node_modules/govuk-frontend/dist/govuk/macros/* src/templates/govuk/macros/
```

#### 5.2 Create SCSS Configuration
```scss
/* src/scss/application.scss */
// Import GOV.UK Frontend
@import "../../node_modules/govuk-frontend/dist/govuk/index";
```

#### 5.3 Update Nunjucks Configuration
```typescript
// src/server/plugins/nunjucks.ts
import Hapi from '@hapi/hapi';
import nunjucks from 'nunjucks';
import path from 'path';

export const nunjucksPlugin: Hapi.Plugin<{}> = {
  name: 'nunjucks',
  register: async (server: Hapi.Server): Promise<void> => {
    const templatesPath = path.join(__dirname, '../../templates');
    const govukTemplatesPath = path.join(__dirname, '../../../node_modules/govuk-frontend');

    const nunjucksEnv = nunjucks.configure([templatesPath, govukTemplatesPath], {
      autoescape: true,
      throwOnUndefined: false,
      trimBlocks: false,
      lstripBlocks: false
    });

    server.views({
      engines: {
        njk: {
          compile: (src: string, _options: any) => {
            const template = nunjucks.compile(src, nunjucksEnv);
            return (context: any) => template.render(context);
          }
        }
      },
      path: templatesPath,
      compileOptions: {
        noCache: process.env.NODE_ENV === 'development'
      }
    });
  }
};
```

#### 5.4 Create Base Layout Template
```html
<!-- src/templates/layouts/default.njk -->
<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
  <meta charset="utf-8">
  <title>
    {% block pageTitle %}
      {% if title %}
        {{ title }} -
      {% endif %}Chat Interface - GOV.UK{% endblock %}
  </title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#1d70b8">
  <link rel="icon" sizes="48x48" href="/assets/images/favicon.ico">
  <link rel="icon" sizes="any" href="/assets/images/favicon.svg" type="image/svg+xml">
  <link rel="mask-icon" href="/assets/images/govuk-icon-mask.svg" color="#1d70b8">
  <link rel="apple-touch-icon" href="/assets/images/govuk-icon-180.png">
  <link rel="manifest" href="/assets/manifest.json">
  <link rel="stylesheet" href="/css/application.css">
  {% block head %}{% endblock %}
</head>

<body class="govuk-template__body">
  <script>
    document.body.className += ' js-enabled' + (
      'noModule' in HTMLScriptElement.prototype
        ? ' govuk-frontend-supported'
        : ''
    );
  </script>
  <a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>
  
  {% block header %}
    {% from "govuk/components/header/macro.njk" import govukHeader %}
    {{ govukHeader({
      homepageUrl: "/"
    }) }}
  {% endblock %}
  
  {% block main %}
    <div class="govuk-width-container">
      {% block phaseBanner %}
        {% from "govuk/components/phase-banner/macro.njk" import govukPhaseBanner %}
        {{ govukPhaseBanner({
          tag: {
            text: "Alpha"
          },
          html: 'This is a new service. Help us improve it and <a class="govuk-link" href="#">give your feedback by email</a>.'
        }) }}
      {% endblock %}
      {% block beforeContent %}{% endblock %}
      <main class="govuk-main-wrapper" id="main-content" role="main">
        <div class="govuk-grid-row">
          <div class="govuk-grid-column-two-thirds">
            {% block content %}
              <h1 class="govuk-heading-xl">Default Page Heading</h1>
              <p class="govuk-body">This is the default layout. Create a new Nunjucks file and extend this layout to add your own content.</p>
            {% endblock %}
          </div>
        </div>
      </main>
    </div>
  {% endblock %}
  
  {% block footer %}
    <footer class="govuk-footer">
      <div class="govuk-width-container">
        <div class="govuk-footer__meta">
          <div class="govuk-footer__meta-item govuk-footer__meta-item--grow">
            <h2 class="govuk-visually-hidden">Support links</h2>
            <ul class="govuk-footer__inline-list">
              <li class="govuk-footer__inline-list-item">
                <a class="govuk-footer__link" href="/cookies">Cookies</a>
              </li>
              <li class="govuk-footer__inline-list-item">
                <a class="govuk-footer__link" href="/privacy-policy">Privacy policy</a>
              </li>
              <li class="govuk-footer__inline-list-item">
                <a class="govuk-footer__link" href="/accessibility-statement">Accessibility statement</a>
              </li>
            </ul>
            <svg role="presentation" focusable="false" class="govuk-footer__licence-logo" xmlns="http://www.w3.org/2000/svg" viewbox="0 0 483.2 195.7" height="17" width="41">
              <path fill="currentColor" d="M421.5 142.8V.1l-50.7 32.3v161.1h112.4v-50.7zm-122.3-9.6A47.12 47.12 0 0 1 221 97.8c0-26 21.1-47.1 47.1-47.1 16.7 0 31.4 8.7 39.7 21.8l42.7-27.2A97.63 97.63 0 0 0 268.1 0c-36.5 0-68.3 20.1-85.1 49.7A98 98 0 0 0 97.8 0C44.9 0 0 44.9 0 97.8s44.9 97.8 97.8 97.8 36.4-8 53-22.5l-42.7-27.2a47.12 47.12 0 0 1-39.7 21.8c-26 0-47.1-21.1-47.1-47.1 0-26 21.1-47.1 47.1-47.1 16.7 0 31.4 8.7 39.7 21.8l42.7-27.2a97.63 97.63 0 0 0-39.7-21.8c-26 0-47.1 21.1-47.1 47.1 0 26 21.1 47.1 47.1 47.1 16.7 0 31.4-8.7 39.7-21.8l42.7 27.2c-16.7 14.5-36.4 22.5-53 22.5z"/>
            </svg>
            <span class="govuk-footer__licence-description">
              All content is available under the
              <a class="govuk-footer__link" href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="license">Open Government Licence v3.0</a>, except where otherwise stated
            </span>
          </div>
          <div class="govuk-footer__meta-item">
            <a class="govuk-footer__link govuk-footer__copyright-logo" href="https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/">© Crown copyright</a>
          </div>
        </div>
      </div>
    </footer>
  {% endblock %}
  
  {% block bodyEnd %}
    <script src="/js/govuk-frontend.js"></script>
    <script src="/js/application.js"></script>
  {% endblock %}
</body>
</html>
```

#### 5.2 Create Home Page Template
```html
<!-- src/templates/pages/index.njk -->
{% extends "layouts/default.njk" %}

{% block pageTitle %}Welcome to GOV.UK Chat Interface{% endblock %}

{% block content %}
<div class="govuk-width-container">
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-two-thirds">
      <h1 class="govuk-heading-xl">Welcome to the Chat Interface</h1>
      
      <p class="govuk-body-l">
        This is a government-compliant chat interface for interacting with AI agents.
      </p>
      
      <div class="govuk-inset-text">
        <p>This service is currently in development. Please use the chat interface below to interact with our AI agents.</p>
      </div>
      
      <div class="govuk-button-group">
        <a href="/chat" role="button" draggable="false" class="govuk-button govuk-button--start" data-module="govuk-button">
          Start chatting
          <svg class="govuk-button__start-icon" xmlns="http://www.w3.org/2000/svg" width="17.5" height="19" viewBox="0 0 33 40" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z"/>
          </svg>
        </a>
      </div>
    </div>
  </div>
</div>
{% endblock %}
```

#### 5.3 Create Basic Chat Template
```html
<!-- src/templates/pages/chat.njk -->
{% extends "layouts/default.njk" %}

{% block pageTitle %}Chat Interface{% endblock %}

{% block content %}
<div class="govuk-width-container">
  <div class="govuk-grid-row">
    <div class="govuk-grid-column-full">
      <h1 class="govuk-heading-xl">Chat Interface</h1>
      
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
              ></textarea>
            </div>
            <button type="submit" class="govuk-button" data-module="govuk-button">
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
  // Basic chat functionality will be added in Phase 2
  document.getElementById('chat-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const message = document.getElementById('message-input').value;
    if (message.trim()) {
      console.log('Message:', message);
      // TODO: Implement message sending in Phase 2
    }
  });
</script>
{% endblock %}
```

### 6. Basic Routing

#### 6.1 Create Route Registration
```typescript
// src/server/routes/index.ts
import Hapi from '@hapi/hapi';
import { chatRoutes } from './chat';
import { healthRoutes } from './health';

export async function registerRoutes(server: Hapi.Server): Promise<void> {
  await server.register([
    chatRoutes,
    healthRoutes
  ]);
}
```

#### 6.2 Create Chat Routes
```typescript
// src/server/routes/chat.ts
import Hapi from '@hapi/hapi';

export const chatRoutes: Hapi.Plugin<{}> = {
  name: 'chat-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    server.route({
      method: 'GET',
      path: '/',
      handler: (request, h) => {
        return h.view('pages/index');
      }
    });

    server.route({
      method: 'GET',
      path: '/chat',
      handler: (request, h) => {
        return h.view('pages/chat');
      }
    });
  }
};
```

#### 6.3 Create Health Routes
```typescript
// src/server/routes/health.ts
import Hapi from '@hapi/hapi';

export const healthRoutes: Hapi.Plugin<{}> = {
  name: 'health-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    server.route({
      method: 'GET',
      path: '/health',
      handler: (request, h) => {
        return h.response({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }).code(200);
      }
    });
  }
};
```

### 7. Static Asset Setup

#### 7.1 Create Static File Routes
```typescript
// src/server/routes/static.ts
import Hapi from '@hapi/hapi';
import path from 'path';

export const staticRoutes: Hapi.Plugin<{}> = {
  name: 'static-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    server.route({
      method: 'GET',
      path: '/css/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../public/css')
        }
      }
    });

    server.route({
      method: 'GET',
      path: '/js/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../public/js')
        }
      }
    });

    server.route({
      method: 'GET',
      path: '/assets/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../public/assets')
        }
      }
    });

    server.route({
      method: 'GET',
      path: '/manifest.json',
      handler: {
        file: {
          path: path.join(__dirname, '../../public/manifest.json')
        }
      }
    });
  }
};
```

#### 7.2 Create Application CSS
```css
/* public/css/application.css */
.govuk-chat-container {
  border: 1px solid #b1b4b6;
  border-radius: 4px;
  height: 500px;
  display: flex;
  flex-direction: column;
}

.govuk-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #f8f8f8;
}

.govuk-chat-message {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 4px;
}

.govuk-chat-message--user {
  background-color: #1d70b8;
  color: white;
  margin-left: 20%;
}

.govuk-chat-message--assistant {
  background-color: white;
  border: 1px solid #b1b4b6;
  margin-right: 20%;
}

.govuk-chat-message--system {
  background-color: #f3f2f1;
  border: 1px solid #b1b4b6;
  text-align: center;
  font-style: italic;
}

.govuk-chat-input-container {
  padding: 20px;
  background-color: white;
  border-top: 1px solid #b1b4b6;
}

.govuk-chat-input-container .govuk-form-group {
  margin-bottom: 15px;
}
```

#### 7.3 Create Application JavaScript
```javascript
// public/js/application.js
// Basic application JavaScript
console.log('GOV.UK Chat Interface loaded');

// Initialize GOV.UK Frontend components
if (typeof window.GOVUKFrontend !== 'undefined') {
  window.GOVUKFrontend.initAll();
}
```

#### 7.4 Create Manifest File
```json
// public/manifest.json
{
  "name": "GOV.UK Chat Interface",
  "short_name": "GOV.UK Chat",
  "description": "Government-compliant chat interface for AI agents",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1d70b8",
  "icons": [
    {
      "src": "/assets/images/govuk-icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/images/govuk-icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 8. Package.json Scripts

#### 8.1 Update package.json
```json
{
  "scripts": {
    "build": "npm run build:css && tsc",
    "build:css": "sass src/scss/application.scss public/css/application.css",
    "start": "node dist/server/index.js",
    "dev": "npm run build:css && nodemon --exec ts-node src/server/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "type-check": "tsc --noEmit",
    "prepare": "husky"
  }
}
```

### 9. Docker Setup

#### 9.1 Create Dockerfile
```dockerfile
# docker/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["npm", "start"]
```

#### 9.2 Create docker-compose.yml
```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    volumes:
      - ../src:/app/src
      - ../public:/app/public
      - ../templates:/app/templates

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 10. Testing Setup

#### 10.1 Create Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
```

#### 10.2 Create Basic Tests
```typescript
// tests/unit/server/index.test.ts
import { createServer } from '../../../src/server';

describe('Server', () => {
  test('should create server successfully', async () => {
    const server = await createServer();
    expect(server).toBeDefined();
    expect(server.info.port).toBe(3000);
  });
});
```

## Validation Checklist

- [ ] Project structure created correctly
- [ ] TypeScript configuration working
- [ ] Hapi server starts without errors
- [ ] GOV.UK Frontend assets copied to public directory
- [ ] SCSS compilation working with GOV.UK Frontend styles
- [ ] Nunjucks configured to find GOV.UK components
- [ ] Templates rendering correctly with GOV.UK components
- [ ] Phase banner properly centered
- [ ] Header component rendering correctly
- [ ] Basic routing functional
- [ ] Static assets served correctly
- [ ] Docker container builds successfully
- [ ] Basic tests pass
- [ ] Linting and formatting working

## Deliverables

1. **Working Hapi server** with GOV.UK Frontend integration
2. **Basic templating system** with Nunjucks
3. **Project structure** following the architectural plan
4. **Development environment** with Docker support
5. **Basic testing framework** setup
6. **Code quality tools** (ESLint, Prettier, Husky)

## Next Phase

Phase 2 will build upon this foundation to implement the core chat functionality, including WebSocket connections, message handling, and session management.
