import Hapi from '@hapi/hapi';

export const chatRoutes: Hapi.Plugin<{}> = {
  name: 'chat-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    server.route({
      method: 'GET',
      path: '/',
      handler: (_request, h) => {
        return h.view('pages/index');
      },
    });

    server.route({
      method: 'GET',
      path: '/chat',
      handler: (_request, h) => {
        return h.view('pages/chat');
      },
    });
  },
};
