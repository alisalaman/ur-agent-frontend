import { SessionService } from '../services/session-service';
import { CircuitBreakerService } from '../services/circuit-breaker-service';
import { GracefulDegradationService } from '../services/graceful-degradation';
import { HealthCheckService } from '../services/health-check-service';
import { MetricsService } from '../services/metrics-service';
import { WebSocketService } from '../../client/services/websocket-service';

declare module '@hapi/hapi' {
  interface ServerApplicationState {
    sessionService: SessionService;
    circuitBreakerService: CircuitBreakerService;
    degradationService: GracefulDegradationService;
    healthCheckService: HealthCheckService;
    metricsService: MetricsService;
    wsService: WebSocketService;
  }
}
