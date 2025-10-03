import Hapi from '@hapi/hapi';

export const chatRoutes: Hapi.Plugin<{}> = {
  name: 'chat-routes',
  register: async (server: Hapi.Server): Promise<void> => {
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
        // In Phase 2, disable WebSocket connection for demo mode
        const wsUrl = process.env.AI_AGENT_WS_URL || 'demo-mode';

        return h.view('pages/chat', {
          sessionId,
          userId,
          wsUrl,
        });
      },
    });
  },
};
