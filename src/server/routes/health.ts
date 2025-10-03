import Hapi from '@hapi/hapi';

export const healthRoutes: Hapi.Plugin<{}> = {
  name: 'health-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    // Basic health check
    server.route({
      method: 'GET',
      path: '/health',
      options: {
        auth: false,
      },
      handler: async (_request, h) => {
        const healthCheckService = server.app.healthCheckService;
        const health = await healthCheckService.getSystemHealth();

        return h.response(health).code(health.status === 'healthy' ? 200 : 503);
      },
    });

    // Detailed health check
    server.route({
      method: 'GET',
      path: '/health/detailed',
      options: {
        auth: false,
      },
      handler: async (_request, h) => {
        const healthCheckService = server.app.healthCheckService;
        const degradationService = server.app.degradationService;
        const circuitBreakerService = server.app.circuitBreakerService;

        const [health, degradationLevel, breakerStats] = await Promise.all([
          healthCheckService.getSystemHealth(),
          degradationService.assessSystemHealth(),
          Promise.resolve(circuitBreakerService.getAllBreakerStats()),
        ]);

        return h.response({
          ...health,
          degradation: degradationLevel,
          circuitBreakers: breakerStats,
          timestamp: new Date().toISOString(),
        });
      },
    });

    // Metrics endpoint
    server.route({
      method: 'GET',
      path: '/metrics',
      options: {
        auth: false,
      },
      handler: async (_request, h) => {
        const metricsService = server.app.metricsService;
        const metrics = await metricsService.getMetrics();

        return h.response(metrics).type('text/plain');
      },
    });

    // Readiness probe
    server.route({
      method: 'GET',
      path: '/ready',
      options: {
        auth: false,
      },
      handler: async (_request, h) => {
        const degradationService = server.app.degradationService;
        const level = degradationService.getCurrentLevel();

        if (level.level === 'offline') {
          return h.response({ status: 'not ready', reason: 'system offline' }).code(503);
        }

        return h.response({ status: 'ready' });
      },
    });

    // Liveness probe
    server.route({
      method: 'GET',
      path: '/live',
      options: {
        auth: false,
      },
      handler: (_request, h) => {
        return h.response({ status: 'alive', uptime: process.uptime() });
      },
    });
  },
};
