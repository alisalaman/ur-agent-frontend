export class MockRedisClient {
    private isConnected: boolean = true;
    private data: Map<string, any> = new Map();

    async ping(): Promise<string> {
        if (!this.isConnected) {
            throw new Error('Redis connection lost');
        }
        return 'PONG';
    }

    async get(key: string): Promise<string | null> {
        if (!this.isConnected) {
            throw new Error('Redis connection lost');
        }
        return this.data.get(key) || null;
    }

    async set(key: string, value: string): Promise<string> {
        if (!this.isConnected) {
            throw new Error('Redis connection lost');
        }
        this.data.set(key, value);
        return 'OK';
    }

    async del(key: string): Promise<number> {
        if (!this.isConnected) {
            throw new Error('Redis connection lost');
        }
        return this.data.delete(key) ? 1 : 0;
    }

    // Mock methods for testing
    simulateConnectionLoss(): void {
        this.isConnected = false;
    }

    simulateConnectionRestore(): void {
        this.isConnected = true;
    }

    clear(): void {
        this.data.clear();
    }
}

