import Hapi from '@hapi/hapi';

export const healthRoutes: Hapi.Plugin<{}> = {
  name: 'health-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    server.route({
      method: 'GET',
      path: '/health',
      handler: (_request, h) => {
        return h
          .response({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
          })
          .code(200);
      },
    });
  },
};
