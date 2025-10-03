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
export async function withRetry(fn, config = retryConfigs.api) {
    return async (...args) => {
        let lastError;
        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            try {
                return await fn(...args);
            }
            catch (error) {
                lastError = error;
                if (attempt === config.maxAttempts) {
                    throw lastError;
                }
                const delay = Math.min(config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1), config.maxDelay);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    };
}
export async function withExponentialBackoff(fn, config = retryConfigs.api) {
    return withRetry(fn, config);
}
//# sourceMappingURL=retry.js.map