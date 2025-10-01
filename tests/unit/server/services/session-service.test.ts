import { SessionService } from '../../../../src/server/services/session-service';

// Mock Redis client
const mockRedis = {
    connect: jest.fn().mockResolvedValue(undefined),
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    on: jest.fn()
};

jest.mock('redis', () => ({
    createClient: jest.fn(() => mockRedis)
}));

describe('SessionService', () => {
    let sessionService: SessionService;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        sessionService = new SessionService();
    });

    test('should create session successfully', async () => {
        mockRedis.setEx.mockResolvedValue('OK');

        const session = await sessionService.createSession('user123', {});
        expect(session).toBeDefined();
        expect(session.userId).toBe('user123');
        expect(session.status).toBe('active');
        expect(mockRedis.setEx).toHaveBeenCalledTimes(1);
    });

    test('should add message to session', async () => {
        // Mock the get method to return a session
        mockRedis.get.mockResolvedValue(JSON.stringify({
            id: 'test-session',
            userId: 'user123',
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
            messages: [],
            metadata: { lastActivity: new Date(), messageCount: 0 }
        }));
        mockRedis.setEx.mockResolvedValue('OK');

        const message = await sessionService.addMessage('test-session', {
            sessionId: 'test-session',
            content: 'Hello',
            role: 'user',
            metadata: {},
            status: 'sent'
        });

        expect(message).toBeDefined();
        expect(message.content).toBe('Hello');
        expect(message.role).toBe('user');
        expect(mockRedis.setEx).toHaveBeenCalledTimes(1);
    });

    test('should generate unique IDs', () => {
        const id1 = (sessionService as any).generateId();
        const id2 = (sessionService as any).generateId();

        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
    });
});
