export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export const retryConfigs = {
  websocket: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  api: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },
};

export async function withRetry<T, A extends any[]>(
  fn: (...args: A) => Promise<T>,
  config: RetryConfig = retryConfigs.api
): Promise<(...args: A) => Promise<T>> {
  return async (...args: A): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;

        if (attempt === config.maxAttempts) {
          throw lastError;
        }

        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  };
}

export async function withExponentialBackoff<T, A extends any[]>(
  fn: (...args: A) => Promise<T>,
  config: RetryConfig = retryConfigs.api
): Promise<(...args: A) => Promise<T>> {
  return withRetry(fn, config);
}
