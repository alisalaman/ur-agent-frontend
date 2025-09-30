// tests/unit/server/index.test.ts
import { createServer } from '../../../src/server';

describe('Server', () => {
    test('should create server successfully', async () => {
        const server = await createServer();
        expect(server).toBeDefined();
        expect(server.info.port).toBe(3000);
    });
});
