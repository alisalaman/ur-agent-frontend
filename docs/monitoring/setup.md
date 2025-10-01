# Monitoring Setup Guide

This guide explains how to set up monitoring for the GOV.UK Chat Frontend resilience patterns.

## Overview

The application exposes metrics in Prometheus format and provides comprehensive health checks for monitoring system health and resilience patterns.

## Metrics Endpoints

### Health Endpoints

- **`/health`** - Basic health check
- **`/health/detailed`** - Detailed health information including degradation level and circuit breaker status
- **`/ready`** - Readiness probe for Kubernetes
- **`/live`** - Liveness probe for Kubernetes
- **`/metrics`** - Prometheus metrics

### Example Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "redis": { "status": "healthy" },
    "websocket": { "status": "healthy" },
    "aiAgent": { "status": "healthy" }
  },
  "uptime": 3600,
  "degradation": {
    "level": "full",
    "description": "All services operational",
    "features": ["websocket", "ai-agent", "session-storage", "real-time"]
  },
  "circuitBreakers": [
    {
      "name": "ai-agent",
      "state": "closed",
      "stats": { "successes": 100, "failures": 2 }
    }
  ]
}
```

## Prometheus Metrics

The application exposes the following metrics:

### Custom Metrics

- `chat_messages_total` - Total number of chat messages (with type and status labels)
- `chat_message_duration_seconds` - Duration of message processing (histogram)
- `chat_active_connections` - Number of active WebSocket connections (gauge)
- `chat_errors_total` - Total number of errors (with type and service labels)
- `chat_circuit_breaker_state` - Circuit breaker state (0=closed, 1=half-open, 2=open)

### Default Metrics

- `process_*` - Process metrics (CPU, memory, etc.)
- `nodejs_*` - Node.js specific metrics

## Prometheus Configuration

### prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "chat_alerts.yml"

scrape_configs:
  - job_name: 'chat-frontend'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s
    scrape_timeout: 5s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Alert Rules (chat_alerts.yml)

```yaml
groups:
  - name: chat_frontend
    rules:
      - alert: ChatServiceDown
        expr: up{job="chat-frontend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Chat frontend service is down"
          description: "The chat frontend service has been down for more than 1 minute"

      - alert: HighErrorRate
        expr: rate(chat_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: CircuitBreakerOpen
        expr: chat_circuit_breaker_state == 2
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Circuit breaker is open"
          description: "Circuit breaker for {{ $labels.service }} is open"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(chat_message_duration_seconds_bucket[5m])) > 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"

      - alert: ServiceDegradation
        expr: chat_degradation_level != 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Service degradation detected"
          description: "Service is running in degraded mode"
```

## Grafana Dashboard

### Dashboard JSON

```json
{
  "dashboard": {
    "title": "GOV.UK Chat Frontend",
    "panels": [
      {
        "title": "Service Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"chat-frontend\"}",
            "legendFormat": "Service Status"
          }
        ]
      },
      {
        "title": "Message Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(chat_messages_total[5m])",
            "legendFormat": "Messages/sec"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(chat_errors_total[5m])",
            "legendFormat": "Errors/sec"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(chat_message_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(chat_message_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Circuit Breaker Status",
        "type": "graph",
        "targets": [
          {
            "expr": "chat_circuit_breaker_state",
            "legendFormat": "{{ service }}"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "chat_active_connections",
            "legendFormat": "Active Connections"
          }
        ]
      }
    ]
  }
}
```

## Docker Compose Setup

### docker-compose.monitoring.yml

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./chat_alerts.yml:/etc/prometheus/chat_alerts.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  grafana-storage:
```

## Kubernetes Monitoring

### ServiceMonitor for Prometheus Operator

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: chat-frontend
  labels:
    app: chat-frontend
spec:
  selector:
    matchLabels:
      app: chat-frontend
  endpoints:
  - port: http
    path: /metrics
    interval: 5s
```

### PodMonitor for Direct Pod Monitoring

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: chat-frontend
  labels:
    app: chat-frontend
spec:
  selector:
    matchLabels:
      app: chat-frontend
  podMetricsEndpoints:
  - port: http
    path: /metrics
    interval: 5s
```

## Health Check Probes

### Kubernetes Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-frontend
spec:
  template:
    spec:
      containers:
      - name: chat-frontend
        image: chat-frontend:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Environment Variables

Configure the following environment variables for monitoring:

```bash
# Logging
LOG_LEVEL=info

# Metrics
METRICS_ENABLED=true
METRICS_PORT=3000

# Health Checks
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Retry Configuration
RETRY_MAX_ATTEMPTS=5
RETRY_BASE_DELAY=1000
RETRY_MAX_DELAY=30000
```

## Troubleshooting

### Common Issues

1. **Metrics not appearing**: Check that the `/metrics` endpoint is accessible
2. **Health checks failing**: Verify all external dependencies are available
3. **Circuit breaker not opening**: Check error threshold and volume threshold settings
4. **High memory usage**: Monitor Prometheus memory usage and adjust retention settings

### Debug Commands

```bash
# Check metrics endpoint
curl http://localhost:3000/metrics

# Check health status
curl http://localhost:3000/health/detailed

# Check specific service health
curl http://localhost:3000/health

# Test readiness probe
curl http://localhost:3000/ready

# Test liveness probe
curl http://localhost:3000/live
```
