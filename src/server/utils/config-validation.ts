import { logger } from './logging';
import { LOG_LEVELS } from '../config/constants';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  static validateResilienceConfig(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required environment variables
    const requiredEnvVars = ['NODE_ENV', 'LOG_LEVEL'];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`);
      }
    }

    // Check optional but recommended environment variables
    const optionalEnvVars = ['REDIS_URL', 'AI_AGENT_URL'];

    for (const envVar of optionalEnvVars) {
      if (!process.env[envVar]) {
        warnings.push(`Optional environment variable not set: ${envVar} (using default)`);
      }
    }

    // Validate log level
    if (
      process.env.LOG_LEVEL &&
      !LOG_LEVELS.includes(process.env.LOG_LEVEL as (typeof LOG_LEVELS)[number])
    ) {
      errors.push(
        `Invalid LOG_LEVEL: ${process.env.LOG_LEVEL}. Must be one of: ${LOG_LEVELS.join(', ')}`
      );
    }

    // Validate Redis URL format if provided
    if (process.env.REDIS_URL) {
      try {
        new URL(process.env.REDIS_URL);
      } catch (error) {
        errors.push(`Invalid REDIS_URL format: ${process.env.REDIS_URL}`);
      }
    }

    const isValid = errors.length === 0;

    if (isValid) {
      logger.info('Configuration validation passed', {
        warnings: warnings.length,
        errors: errors.length,
      });
    } else {
      logger.error('Configuration validation failed', {
        errors,
        warnings,
      });
    }

    return {
      isValid,
      errors,
      warnings,
    };
  }

  static validateRetryConfig(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if retry configurations are reasonable
    const maxAttempts = parseInt(process.env.RETRY_MAX_ATTEMPTS || '5');
    if (maxAttempts < 1 || maxAttempts > 10) {
      warnings.push(`RETRY_MAX_ATTEMPTS should be between 1 and 10, got: ${maxAttempts}`);
    }

    const baseDelay = parseInt(process.env.RETRY_BASE_DELAY || '1000');
    if (baseDelay < 100 || baseDelay > 10000) {
      warnings.push(`RETRY_BASE_DELAY should be between 100ms and 10s, got: ${baseDelay}ms`);
    }

    const maxDelay = parseInt(process.env.RETRY_MAX_DELAY || '30000');
    if (maxDelay < 1000 || maxDelay > 300000) {
      warnings.push(`RETRY_MAX_DELAY should be between 1s and 5m, got: ${maxDelay}ms`);
    }

    if (baseDelay > maxDelay) {
      errors.push(
        `RETRY_BASE_DELAY (${baseDelay}ms) cannot be greater than RETRY_MAX_DELAY (${maxDelay}ms)`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateCircuitBreakerConfig(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const timeout = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000');
    if (timeout < 1000 || timeout > 60000) {
      warnings.push(`CIRCUIT_BREAKER_TIMEOUT should be between 1s and 60s, got: ${timeout}ms`);
    }

    const errorThreshold = parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50');
    if (errorThreshold < 10 || errorThreshold > 90) {
      warnings.push(
        `CIRCUIT_BREAKER_ERROR_THRESHOLD should be between 10% and 90%, got: ${errorThreshold}%`
      );
    }

    const resetTimeout = parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000');
    if (resetTimeout < 5000 || resetTimeout > 300000) {
      warnings.push(
        `CIRCUIT_BREAKER_RESET_TIMEOUT should be between 5s and 5m, got: ${resetTimeout}ms`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateAll(): ConfigValidationResult {
    const resilienceResult = this.validateResilienceConfig();
    const retryResult = this.validateRetryConfig();
    const circuitBreakerResult = this.validateCircuitBreakerConfig();

    const allErrors = [
      ...resilienceResult.errors,
      ...retryResult.errors,
      ...circuitBreakerResult.errors,
    ];

    const allWarnings = [
      ...resilienceResult.warnings,
      ...retryResult.warnings,
      ...circuitBreakerResult.warnings,
    ];

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}
