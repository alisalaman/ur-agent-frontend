import { RetryConfig } from '../config/retry';
import { logger } from './logging';
import { BACKOFF_MULTIPLIER, JITTER_FACTOR, MAX_JITTER_FACTOR } from '../config/constants';
import { RetryableError, NonRetryableError } from '../types/errors';

export function withRetry<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry based on error type
        if (attempt === config.maxAttempts || !config.retryCondition(lastError)) {
          // Wrap error with appropriate type if needed
          if (lastError instanceof RetryableError || lastError instanceof NonRetryableError) {
            throw lastError;
          }

          // Determine if error should be retryable based on retry condition
          if (config.retryCondition(lastError)) {
            throw new RetryableError(lastError.message, 'RETRYABLE_ERROR', 500);
          } else {
            throw new NonRetryableError(lastError.message, 'NON_RETRYABLE_ERROR', 400);
          }
        }

        // Calculate delay
        let delay = config.baseDelay;
        if (config.jitter) {
          delay = delay * (JITTER_FACTOR + Math.random() * (MAX_JITTER_FACTOR - JITTER_FACTOR));
        }
        delay = Math.min(delay, config.maxDelay);

        logger.warn('Retry attempt failed', {
          attempt,
          error: lastError.message,
          retriesLeft: config.maxAttempts - attempt,
          nextRetryIn: delay,
          retryConfig: {
            maxAttempts: config.maxAttempts,
            baseDelay: config.baseDelay,
            maxDelay: config.maxDelay,
          },
        });

        if (config.onFailedAttempt) {
          config.onFailedAttempt(lastError);
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  };
}

export function withExponentialBackoff<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: RetryConfig
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry based on error type
        if (attempt === config.maxAttempts || !config.retryCondition(lastError)) {
          // Wrap error with appropriate type if needed
          if (lastError instanceof RetryableError || lastError instanceof NonRetryableError) {
            throw lastError;
          }

          // Determine if error should be retryable based on retry condition
          if (config.retryCondition(lastError)) {
            throw new RetryableError(lastError.message, 'RETRYABLE_ERROR', 500);
          } else {
            throw new NonRetryableError(lastError.message, 'NON_RETRYABLE_ERROR', 400);
          }
        }

        // Calculate exponential backoff delay
        let delay = config.baseDelay * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
        if (config.jitter) {
          delay = delay * (JITTER_FACTOR + Math.random() * (MAX_JITTER_FACTOR - JITTER_FACTOR));
        }
        delay = Math.min(delay, config.maxDelay);

        logger.warn('Exponential backoff retry failed', {
          attempt,
          error: lastError.message,
          retriesLeft: config.maxAttempts - attempt,
          nextRetryIn: delay,
        });

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  };
}
