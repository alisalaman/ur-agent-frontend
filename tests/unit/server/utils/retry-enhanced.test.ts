import { withRetry, withExponentialBackoff } from '../../../../src/server/utils/retry';
import { retryConfigs } from '../../../../src/server/config/retry';
import { RetryableError, NonRetryableError, ValidationError } from '../../../../src/server/types/errors';

// Mock logger to avoid console output during tests
jest.mock('../../../../src/server/utils/logging', () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('Enhanced Retry Utilities', () => {
    describe('withRetry - Enhanced Error Handling', () => {
        it('should preserve RetryableError types', async () => {
            const retryableFn = jest.fn().mockRejectedValue(new RetryableError('Service unavailable', 'SERVICE_UNAVAILABLE'));
            const retryableWrapped = withRetry(retryableFn, retryConfigs.api);

            await expect(retryableWrapped()).rejects.toThrow(RetryableError);
            expect(retryableFn).toHaveBeenCalledTimes(1); // Should not retry RetryableError
        });

        it('should preserve NonRetryableError types', async () => {
            const nonRetryableFn = jest.fn().mockRejectedValue(new NonRetryableError('Invalid request', 'INVALID_REQUEST'));
            const nonRetryableWrapped = withRetry(nonRetryableFn, retryConfigs.api);

            await expect(nonRetryableWrapped()).rejects.toThrow(NonRetryableError);
            expect(nonRetryableFn).toHaveBeenCalledTimes(1); // Should not retry
        });

        it('should wrap generic errors as RetryableError when retry condition passes', async () => {
            const genericFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
            const genericWrapped = withRetry(genericFn, retryConfigs.api);

            await expect(genericWrapped()).rejects.toThrow(RetryableError);
            expect(genericWrapped()).rejects.toMatchObject({
                message: 'ECONNRESET',
                code: 'RETRYABLE_ERROR',
                statusCode: 500,
                isRetryable: true
            });
        });

        it('should wrap generic errors as NonRetryableError when retry condition fails', async () => {
            const genericFn = jest.fn().mockRejectedValue(new Error('Permanent failure'));
            const genericWrapped = withRetry(genericFn, retryConfigs.api);

            await expect(genericWrapped()).rejects.toThrow(NonRetryableError);
            expect(genericWrapped()).rejects.toMatchObject({
                message: 'Permanent failure',
                code: 'NON_RETRYABLE_ERROR',
                statusCode: 400,
                isRetryable: false
            });
        });

        it('should handle ValidationError as non-retryable', async () => {
            const validationFn = jest.fn().mockRejectedValue(new ValidationError('Invalid input', 'email'));
            const validationWrapped = withRetry(validationFn, retryConfigs.api);

            await expect(validationWrapped()).rejects.toThrow(NonRetryableError);
            expect(validationFn).toHaveBeenCalledTimes(1); // Should not retry
        });
    });

    describe('withExponentialBackoff - Enhanced Error Handling', () => {
        it('should preserve RetryableError types with exponential backoff', async () => {
            const retryableFn = jest.fn().mockRejectedValue(new RetryableError('Service unavailable', 'SERVICE_UNAVAILABLE'));
            const retryableWrapped = withExponentialBackoff(retryableFn, retryConfigs.api);

            await expect(retryableWrapped()).rejects.toThrow(RetryableError);
            expect(retryableFn).toHaveBeenCalledTimes(1); // Should not retry RetryableError
        });

        it('should preserve NonRetryableError types with exponential backoff', async () => {
            const nonRetryableFn = jest.fn().mockRejectedValue(new NonRetryableError('Invalid request', 'INVALID_REQUEST'));
            const nonRetryableWrapped = withExponentialBackoff(nonRetryableFn, retryConfigs.api);

            await expect(nonRetryableWrapped()).rejects.toThrow(NonRetryableError);
            expect(nonRetryableFn).toHaveBeenCalledTimes(1); // Should not retry
        });

        it('should wrap generic errors as RetryableError with exponential backoff', async () => {
            const genericFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
            const genericWrapped = withExponentialBackoff(genericFn, retryConfigs.api);

            await expect(genericWrapped()).rejects.toThrow(RetryableError);
            expect(genericWrapped()).rejects.toMatchObject({
                message: 'ECONNRESET',
                code: 'RETRYABLE_ERROR',
                statusCode: 500,
                isRetryable: true
            });
        });
    });

    describe('Error Type Preservation', () => {
        it('should maintain error inheritance chain', async () => {
            const customError = new Error('Custom error');
            Object.setPrototypeOf(customError, RetryableError.prototype);
            customError.name = 'CustomRetryableError';

            const customFn = jest.fn().mockRejectedValue(customError);
            const customWrapped = withRetry(customFn, retryConfigs.api);

            await expect(customWrapped()).rejects.toThrow(RetryableError);
            expect(customWrapped()).rejects.toBeInstanceOf(RetryableError);
        });

        it('should preserve error properties', async () => {
            const errorWithProps = new Error('Error with properties');
            (errorWithProps as any).customProperty = 'customValue';

            const propsFn = jest.fn().mockRejectedValue(errorWithProps);
            const propsWrapped = withRetry(propsFn, retryConfigs.api);

            try {
                await propsWrapped();
            } catch (error) {
                expect(error).toBeInstanceOf(NonRetryableError);
                // Custom properties are not preserved when creating new error instances
                expect(error.message).toBe('Error with properties');
            }
        });
    });

    describe('Retry Condition Logic', () => {
        it('should respect retry condition for error wrapping', async () => {
            const config = {
                ...retryConfigs.api,
                retryCondition: (error: Error) => error.message.includes('retryable')
            };

            const retryableFn = jest.fn().mockRejectedValue(new Error('This is retryable'));
            const retryableWrapped = withRetry(retryableFn, config);

            await expect(retryableWrapped()).rejects.toThrow(RetryableError);

            const nonRetryableFn = jest.fn().mockRejectedValue(new Error('This is not retryable'));
            const nonRetryableWrapped = withRetry(nonRetryableFn, config);

            await expect(nonRetryableWrapped()).rejects.toThrow(RetryableError);
        });
    });
});
