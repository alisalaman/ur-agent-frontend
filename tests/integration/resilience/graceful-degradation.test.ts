import { GracefulDegradationService } from '../../../src/server/services/graceful-degradation';

describe('Graceful Degradation', () => {
    let degradationService: GracefulDegradationService;

    beforeEach(() => {
        degradationService = new GracefulDegradationService();
    });

    test('should assess full functionality when all services are healthy', async () => {
        degradationService.registerHealthCheck('websocket', async () => true);
        degradationService.registerHealthCheck('aiAgent', async () => true);
        degradationService.registerHealthCheck('sessionStorage', async () => true);

        const level = await degradationService.assessSystemHealth();

        expect(level.level).toBe('full');
        expect(level.features).toContain('websocket');
        expect(level.features).toContain('ai-agent');
        expect(level.features).toContain('real-time');
    });

    test('should degrade to limited functionality when some services fail', async () => {
        degradationService.registerHealthCheck('websocket', async () => true);
        degradationService.registerHealthCheck('aiAgent', async () => false);
        degradationService.registerHealthCheck('sessionStorage', async () => true);

        const level = await degradationService.assessSystemHealth();

        expect(level.level).toBe('limited');
        expect(level.features).toContain('session-storage');
        expect(level.features).toContain('message-queue');
        expect(level.features).not.toContain('real-time');
    });

    test('should go offline when critical services fail', async () => {
        degradationService.registerHealthCheck('websocket', async () => false);
        degradationService.registerHealthCheck('aiAgent', async () => false);
        degradationService.registerHealthCheck('sessionStorage', async () => false);

        const level = await degradationService.assessSystemHealth();

        expect(level.level).toBe('offline');
        expect(level.features).toContain('static-content');
        expect(level.features).not.toContain('websocket');
        expect(level.features).not.toContain('ai-agent');
    });

    test('should check if feature is available', async () => {
        degradationService.registerHealthCheck('websocket', async () => true);
        degradationService.registerHealthCheck('aiAgent', async () => true);
        degradationService.registerHealthCheck('sessionStorage', async () => true);

        await degradationService.assessSystemHealth();

        expect(degradationService.canUseFeature('websocket')).toBe(true);
        expect(degradationService.canUseFeature('ai-agent')).toBe(true);
        expect(degradationService.canUseFeature('nonexistent')).toBe(false);
    });

    test('should provide fallback actions for limited functionality', async () => {
        degradationService.registerHealthCheck('websocket', async () => false);
        degradationService.registerHealthCheck('aiAgent', async () => false);
        degradationService.registerHealthCheck('sessionStorage', async () => true);

        await degradationService.assessSystemHealth();

        const sendMessageFallback = degradationService.getFallbackAction('sendMessage');
        const getMessagesFallback = degradationService.getFallbackAction('getMessages');

        expect(sendMessageFallback).toBeDefined();
        expect(getMessagesFallback).toBeDefined();
        expect(typeof sendMessageFallback).toBe('function');
        expect(typeof getMessagesFallback).toBe('function');
    });

    test('should handle health check failures gracefully', async () => {
        degradationService.registerHealthCheck('failing-service', async () => {
            throw new Error('Health check failed');
        });

        const level = await degradationService.assessSystemHealth();

        expect(level.level).toBe('offline');
    });
});
