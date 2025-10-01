export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryCondition: (error: Error) => boolean;
  onFailedAttempt?: (error: Error) => void;
}

export const retryConfigs = {
  websocket: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    jitter: true,
    retryCondition: (error: Error) => {
      return (
        error.name === 'WebSocketConnectionError' ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET')
      );
    },
  },
  api: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    jitter: true,
    retryCondition: (error: Error) => {
      return (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')
      );
    },
  },
  database: {
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 10000,
    jitter: true,
    retryCondition: (error: Error) => {
      return (
        error.message.includes('connection') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED')
      );
    },
  },
};
