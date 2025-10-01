import {
    ValidationError,
    NetworkError,
    TimeoutError,
    RetryableError,
    NonRetryableError
} from '../../../../src/server/types/errors';

describe('Extended Error Types', () => {
    describe('ValidationError', () => {
        it('should create validation error with message only', () => {
            const error = new ValidationError('Invalid input');

            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('Invalid input');
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.statusCode).toBe(400);
            expect(error.isRetryable).toBe(false);
        });

        it('should create validation error with field', () => {
            const error = new ValidationError('Required field', 'email');

            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe("Validation error for field 'email': Required field");
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.statusCode).toBe(400);
            expect(error.isRetryable).toBe(false);
        });
    });

    describe('NetworkError', () => {
        it('should create retryable network error by default', () => {
            const error = new NetworkError('Connection failed');

            expect(error.name).toBe('NetworkError');
            expect(error.message).toBe('Connection failed');
            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.statusCode).toBe(503);
            expect(error.isRetryable).toBe(true);
        });

        it('should create non-retryable network error when specified', () => {
            const error = new NetworkError('Invalid endpoint', false);

            expect(error.name).toBe('NetworkError');
            expect(error.message).toBe('Invalid endpoint');
            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.statusCode).toBe(503);
            expect(error.isRetryable).toBe(false);
        });
    });

    describe('TimeoutError', () => {
        it('should create timeout error with timeout duration', () => {
            const error = new TimeoutError('Operation failed', 5000);

            expect(error.name).toBe('TimeoutError');
            expect(error.message).toBe('Operation timed out after 5000ms: Operation failed');
            expect(error.code).toBe('TIMEOUT_ERROR');
            expect(error.statusCode).toBe(504);
            expect(error.isRetryable).toBe(true);
        });
    });

    describe('RetryableError', () => {
        it('should create retryable error with custom code', () => {
            const error = new RetryableError('Service unavailable', 'SERVICE_UNAVAILABLE', 503);

            expect(error.name).toBe('RetryableError');
            expect(error.message).toBe('Service unavailable');
            expect(error.code).toBe('SERVICE_UNAVAILABLE');
            expect(error.statusCode).toBe(503);
            expect(error.isRetryable).toBe(true);
        });

        it('should use default status code when not provided', () => {
            const error = new RetryableError('Temporary failure', 'TEMP_FAILURE');

            expect(error.statusCode).toBe(500);
        });
    });

    describe('NonRetryableError', () => {
        it('should create non-retryable error with custom code', () => {
            const error = new NonRetryableError('Invalid request', 'INVALID_REQUEST', 400);

            expect(error.name).toBe('NonRetryableError');
            expect(error.message).toBe('Invalid request');
            expect(error.code).toBe('INVALID_REQUEST');
            expect(error.statusCode).toBe(400);
            expect(error.isRetryable).toBe(false);
        });

        it('should use default status code when not provided', () => {
            const error = new NonRetryableError('Bad request', 'BAD_REQUEST');

            expect(error.statusCode).toBe(400);
        });
    });
});
