declare module 'opossum' {
  export interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    name?: string;
    volumeThreshold?: number;
  }

  export interface CircuitBreakerStats {
    fires: number;
    successes: number;
    failures: number;
    timeouts: number;
    rejects: number;
    fallbacks: number;
    semaphoreRejections: number;
    percentiles: {
      '0': number;
      '0.5': number;
      '0.9': number;
      '0.95': number;
      '0.99': number;
      '0.995': number;
    };
    latencyTimes: number[];
    latencyMean: number;
  }

  export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  export default class CircuitBreaker {
    constructor(fn: Function, options?: CircuitBreakerOptions);

    fire(...args: any[]): Promise<any>;
    fallback(fn: Function): CircuitBreaker;
    open(): void;
    close(): void;
    halfOpen(): void;

    get state(): CircuitBreakerState;
    get stats(): CircuitBreakerStats;
    get name(): string;

    on(
      event: 'open' | 'close' | 'halfOpen' | 'failure' | 'success',
      listener: (...args: any[]) => void
    ): CircuitBreaker;
    off(
      event: 'open' | 'close' | 'halfOpen' | 'failure' | 'success',
      listener: (...args: any[]) => void
    ): CircuitBreaker;
  }
}
