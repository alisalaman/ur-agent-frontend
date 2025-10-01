import { withRetry, withExponentialBackoff } from '../../../../src/server/utils/retry';
import { retryConfigs } from '../../../../src/server/config/retry';

describe('Retry Utilities', () => {
    test('withRetry should retry on failure', async () => {
        let callCount = 0;
        const failingFunction = async () => {
            callCount++;
            if (callCount < 3) {
                throw new Error('ECONNRESET');
            }
            return 'success';
        };

        const retryableFunction = withRetry(failingFunction, retryConfigs.api);

        const result = await retryableFunction();
        expect(result).toBe('success');
        expect(callCount).toBe(3);
    });

    test('withRetry should fail after max attempts', async () => {
        const failingFunction = async () => {
            throw new Error('Permanent failure');
        };

        const retryableFunction = withRetry(failingFunction, retryConfigs.api);

        await expect(retryableFunction()).rejects.toThrow('Permanent failure');
    });

    test('withExponentialBackoff should use exponential backoff', async () => {
        let callCount = 0;
        const startTime = Date.now();

        const failingFunction = async () => {
            callCount++;
            if (callCount < 2) {
                throw new Error('ECONNRESET');
            }
            return 'success';
        };

        const retryableFunction = withExponentialBackoff(failingFunction, retryConfigs.api);

        const result = await retryableFunction();
        const duration = Date.now() - startTime;

        expect(result).toBe('success');
        expect(callCount).toBe(2);
        // Should have some delay due to exponential backoff
        expect(duration).toBeGreaterThan(0);
    });

    test('should respect retry conditions', async () => {
        const failingFunction = async () => {
            throw new Error('ECONNRESET');
        };

        const retryableFunction = withRetry(failingFunction, retryConfigs.api);

        await expect(retryableFunction()).rejects.toThrow('ECONNRESET');
    });

    test('should not retry when condition is not met', async () => {
        const failingFunction = async () => {
            throw new Error('Validation error');
        };

        const retryableFunction = withRetry(failingFunction, retryConfigs.api);

        await expect(retryableFunction()).rejects.toThrow('Validation error');
    });
});
