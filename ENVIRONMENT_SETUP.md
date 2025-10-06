# Environment Setup

This document describes the environment variables required for the ur-agent-frontend application.

## Required Environment Variables

### Production (Render)
```bash
NODE_ENV=production
# PORT is automatically set by Render
HOST=0.0.0.0
SESSION_SECRET=your-production-secret-key
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.gov.uk
AI_AGENT_WS_URL=wss://ur-agent.onrender.com/ws/synthetic-agents
MONITORING_ENABLED=true
```

### Development
```bash
NODE_ENV=development
PORT=3000
HOST=localhost
SESSION_SECRET=development-secret-key
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
AI_AGENT_WS_URL=wss://ur-agent.onrender.com/ws/synthetic-agents
MONITORING_ENABLED=false
```

## Setting up Environment Files

### For Local Development
Create `.env.development` in the project root:
```bash
cp ENVIRONMENT_SETUP.md .env.development
# Edit the file with your development values
```

### For Production
Set these environment variables in your Render service dashboard:
1. Go to your Render service
2. Navigate to Environment tab
3. Add the production environment variables listed above

## Important Notes

- **HOST**: Must be `0.0.0.0` for production deployments to accept external connections
- **PORT**: Automatically provided by Render in production
- **SESSION_SECRET**: Use a strong, unique secret for production
- **CORS_ORIGIN**: Update to match your actual domain
- **AI_AGENT_WS_URL**: Points to the ur-agent backend service
