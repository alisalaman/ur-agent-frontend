import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsService {
  private messageCounter: Counter<string>;
  private messageDuration: Histogram<string>;
  private activeConnections: Gauge<string>;
  private errorCounter: Counter<string>;
  private circuitBreakerState: Gauge<string>;

  constructor() {
    // Collect default metrics
    collectDefaultMetrics({ register });

    // Custom metrics
    this.messageCounter = new Counter({
      name: 'chat_messages_total',
      help: 'Total number of chat messages',
      labelNames: ['type', 'status'],
    });

    this.messageDuration = new Histogram({
      name: 'chat_message_duration_seconds',
      help: 'Duration of message processing',
      labelNames: ['type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.activeConnections = new Gauge({
      name: 'chat_active_connections',
      help: 'Number of active WebSocket connections',
    });

    this.errorCounter = new Counter({
      name: 'chat_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'service'],
    });

    this.circuitBreakerState = new Gauge({
      name: 'chat_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
      labelNames: ['service'],
    });

    register.registerMetric(this.messageCounter);
    register.registerMetric(this.messageDuration);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.errorCounter);
    register.registerMetric(this.circuitBreakerState);
  }

  incrementMessageCounter(type: string, status: string): void {
    this.messageCounter.inc({ type, status });
  }

  recordMessageDuration(type: string, status: string, duration: number): void {
    this.messageDuration.observe({ type, status }, duration);
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  incrementErrorCounter(type: string, service: string): void {
    this.errorCounter.inc({ type, service });
  }

  setCircuitBreakerState(service: string, state: 'closed' | 'half-open' | 'open'): void {
    const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
    this.circuitBreakerState.set({ service }, stateValue);
  }

  getMetrics(): Promise<string> {
    return register.metrics();
  }

  getHealthCheck(): Promise<any> {
    return register.getSingleMetricAsString('up');
  }
}
