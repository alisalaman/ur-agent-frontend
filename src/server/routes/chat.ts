import Hapi from '@hapi/hapi';
import { JWTService } from '../services/jwt-service';

export const chatRoutes: Hapi.Plugin<{}> = {
  name: 'chat-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    const jwtService = new JWTService();
    server.route({
      method: 'GET',
      path: '/',
      options: {
        auth: false,
      },
      handler: (_request, h) => {
        return h.view('pages/index');
      },
    });

    server.route({
      method: 'GET',
      path: '/chat',
      options: {
        auth: false,
      },
      handler: (_request, h) => {
        // Generate a temporary session ID and user ID for demo purposes
        const sessionId = Math.random().toString(36).substr(2, 9);
        const userId = 'demo-user';
        // Use the AI agent WebSocket URL from environment
        const wsUrl = process.env.AI_AGENT_WS_URL || 'demo-mode';

        // Generate JWT token for WebSocket authentication
        let jwtToken = null;
        try {
          const user = {
            id: userId,
            email: 'demo@example.com',
            name: 'Demo User',
            role: 'user',
          };
          jwtToken = jwtService.generateAccessToken(user, sessionId);
        } catch (error) {
          console.error('Failed to generate JWT token:', error);
        }

        return h.view('pages/chat', {
          sessionId,
          userId,
          wsUrl,
          jwtToken,
          timestamp: Date.now(),
        });
      },
    });
  },
};
