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
  },
};
