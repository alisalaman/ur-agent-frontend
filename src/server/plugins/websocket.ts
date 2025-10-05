import Hapi from '@hapi/hapi';
import { WebSocketService } from '../../client/services/websocket-service';

export const websocketPlugin: Hapi.Plugin<{}> = {
  name: 'websocket',
  register: async (server: Hapi.Server): Promise<void> => {
    const wsService = new WebSocketService({
      url: process.env.AI_AGENT_WS_URL || 'ws://localhost:8080/ws',
      reconnectAttempts: 1,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      timeout: 2000,
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
  },
};
