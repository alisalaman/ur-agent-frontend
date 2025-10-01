import { ConfigValidator } from '../../../../src/server/utils/config-validation';

describe('ConfigValidator', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('validateResilienceConfig', () => {
        test('should pass with valid configuration', () => {
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'info';
            process.env.REDIS_URL = 'redis://localhost:6379';
            process.env.WEBSOCKET_URL = 'ws://localhost:8080';

            const result = ConfigValidator.validateResilienceConfig();

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should fail with missing required environment variables', () => {
            delete process.env.NODE_ENV;
            delete process.env.LOG_LEVEL;

            const result = ConfigValidator.validateResilienceConfig();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required environment variable: NODE_ENV');
            expect(result.errors).toContain('Missing required environment variable: LOG_LEVEL');
        });

        test('should warn about missing optional environment variables', () => {
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'info';
            delete process.env.REDIS_URL;
            delete process.env.WEBSOCKET_URL;

            const result = ConfigValidator.validateResilienceConfig();

            expect(result.isValid).toBe(true);
            expect(result.warnings).toContain('Optional environment variable not set: REDIS_URL (using default)');
            expect(result.warnings).toContain('Optional environment variable not set: WEBSOCKET_URL (using default)');
        });

        test('should fail with invalid log level', () => {
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'invalid';

            const result = ConfigValidator.validateResilienceConfig();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid LOG_LEVEL: invalid. Must be one of: error, warn, info, debug');
        });

        test('should fail with invalid URL formats', () => {
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'info';
            process.env.REDIS_URL = 'invalid-url';
            process.env.WEBSOCKET_URL = 'not-a-url';

            const result = ConfigValidator.validateResilienceConfig();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid REDIS_URL format: invalid-url');
            expect(result.errors).toContain('Invalid WEBSOCKET_URL format: not-a-url');
        });
    });

    describe('validateRetryConfig', () => {
        test('should pass with valid retry configuration', () => {
            process.env.RETRY_MAX_ATTEMPTS = '3';
            process.env.RETRY_BASE_DELAY = '1000';
            process.env.RETRY_MAX_DELAY = '5000';

            const result = ConfigValidator.validateRetryConfig();

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should warn about extreme retry values', () => {
            process.env.RETRY_MAX_ATTEMPTS = '20';
            process.env.RETRY_BASE_DELAY = '50';
            process.env.RETRY_MAX_DELAY = '500000';

            const result = ConfigValidator.validateRetryConfig();

            expect(result.isValid).toBe(true);
            expect(result.warnings).toContain('RETRY_MAX_ATTEMPTS should be between 1 and 10, got: 20');
            expect(result.warnings).toContain('RETRY_BASE_DELAY should be between 100ms and 10s, got: 50ms');
            expect(result.warnings).toContain('RETRY_MAX_DELAY should be between 1s and 5m, got: 500000ms');
        });

        test('should fail when base delay is greater than max delay', () => {
            process.env.RETRY_BASE_DELAY = '10000';
            process.env.RETRY_MAX_DELAY = '5000';

            const result = ConfigValidator.validateRetryConfig();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('RETRY_BASE_DELAY (10000ms) cannot be greater than RETRY_MAX_DELAY (5000ms)');
        });
    });

    describe('validateCircuitBreakerConfig', () => {
        test('should pass with valid circuit breaker configuration', () => {
            process.env.CIRCUIT_BREAKER_TIMEOUT = '10000';
            process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD = '50';
            process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '30000';

            const result = ConfigValidator.validateCircuitBreakerConfig();

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should warn about extreme circuit breaker values', () => {
            process.env.CIRCUIT_BREAKER_TIMEOUT = '100';
            process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD = '5';
            process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '1000000';

            const result = ConfigValidator.validateCircuitBreakerConfig();

            expect(result.isValid).toBe(true);
            expect(result.warnings).toContain('CIRCUIT_BREAKER_TIMEOUT should be between 1s and 60s, got: 100ms');
            expect(result.warnings).toContain('CIRCUIT_BREAKER_ERROR_THRESHOLD should be between 10% and 90%, got: 5%');
            expect(result.warnings).toContain('CIRCUIT_BREAKER_RESET_TIMEOUT should be between 5s and 5m, got: 1000000ms');
        });
    });

    describe('validateAll', () => {
        test('should combine results from all validators', () => {
            process.env.NODE_ENV = 'test';
            process.env.LOG_LEVEL = 'info';
            process.env.RETRY_MAX_ATTEMPTS = '20';
            process.env.CIRCUIT_BREAKER_TIMEOUT = '100';

            const result = ConfigValidator.validateAll();

            expect(result.isValid).toBe(true); // No errors, only warnings
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings).toContain('RETRY_MAX_ATTEMPTS should be between 1 and 10, got: 20');
            expect(result.warnings).toContain('CIRCUIT_BREAKER_TIMEOUT should be between 1s and 60s, got: 100ms');
        });

        test('should fail if any validator fails', () => {
            delete process.env.NODE_ENV;
            process.env.RETRY_MAX_ATTEMPTS = '20';

            const result = ConfigValidator.validateAll();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing required environment variable: NODE_ENV');
            expect(result.warnings).toContain('RETRY_MAX_ATTEMPTS should be between 1 and 10, got: 20');
        });
    });
});
