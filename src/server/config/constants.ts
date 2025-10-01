// Configuration constants for resilience patterns
export const RETRY_CONFIG_LIMITS = {
  MIN_ATTEMPTS: 1,
  MAX_ATTEMPTS: 10,
  MIN_DELAY: 100,
  MAX_DELAY: 10000,
  DEFAULT_BASE_DELAY: 1000,
  DEFAULT_MAX_DELAY: 30000,
} as const;

export const CIRCUIT_BREAKER_LIMITS = {
  MIN_TIMEOUT: 1000,
  MAX_TIMEOUT: 30000,
  MIN_ERROR_THRESHOLD: 1,
  MAX_ERROR_THRESHOLD: 100,
  MIN_RESET_TIMEOUT: 1000,
  MAX_RESET_TIMEOUT: 60000,
  MIN_VOLUME_THRESHOLD: 1,
  MAX_VOLUME_THRESHOLD: 1000,
} as const;

export const HEALTH_CHECK_LIMITS = {
  DEFAULT_TIMEOUT: 5000,
  MAX_TIMEOUT: 30000,
  MIN_INTERVAL: 1000,
  MAX_INTERVAL: 60000,
} as const;

export const BACKOFF_MULTIPLIER = 2;
export const JITTER_FACTOR = 0.5;
export const MAX_JITTER_FACTOR = 1.0;

export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export const DEGRADATION_LEVELS = ['full', 'limited', 'offline'] as const;

export const DEFAULT_REDIS_URL = 'redis://localhost:6379';
export const DEFAULT_WEBSOCKET_URL = 'ws://localhost:8080';
export const DEFAULT_AI_AGENT_URL = 'http://localhost:3001';
