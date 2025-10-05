import CircuitBreaker from 'opossum';
import { logger } from '../utils/logging';

export interface CircuitBreakerConfig {
  timeout: number;
  errorThreshold: number;
  resetTimeout: number;
  name: string;
  volumeThreshold?: number;
}

export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();

  createBreaker<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    config: CircuitBreakerConfig
  ): CircuitBreaker {
    const breaker = new CircuitBreaker(fn, {
      timeout: config.timeout,
      errorThresholdPercentage: config.errorThreshold,
      resetTimeout: config.resetTimeout,
      name: config.name,
      volumeThreshold: config.volumeThreshold || 10,
    });

    this.setupEventHandlers(breaker, config.name);
    this.breakers.set(config.name, breaker);

    return breaker;
  }

  private setupEventHandlers(breaker: CircuitBreaker, name: string): void {
    breaker.on('open', () => {
      logger.warn('Circuit breaker opened', {
        service: name,
        timestamp: new Date().toISOString(),
      });
    });

    breaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open', {
        service: name,
        timestamp: new Date().toISOString(),
      });
    });

    breaker.on('close', () => {
      logger.info('Circuit breaker closed', {
        service: name,
        timestamp: new Date().toISOString(),
      });
    });

    breaker.on('failure', (error: any) => {
      logger.error('Circuit breaker failure', {
        service: name,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    });

    breaker.on('success', () => {
      logger.debug('Circuit breaker success', {
        service: name,
        timestamp: new Date().toISOString(),
      });
    });
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getBreakerStats(name: string): any {
    const breaker = this.breakers.get(name);
    return breaker
      ? {
          stats: breaker.stats,
          name: breaker.name,
        }
      : null;
  }

  getAllBreakerStats(): any[] {
    return Array.from(this.breakers.values()).map((breaker) => ({
      stats: breaker.stats,
      name: breaker.name,
    }));
  }
}
