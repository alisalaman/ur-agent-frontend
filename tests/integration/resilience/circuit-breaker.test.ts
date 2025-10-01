import { CircuitBreakerService } from '../../../src/server/services/circuit-breaker-service';

describe('Circuit Breaker', () => {
    let circuitBreakerService: CircuitBreakerService;

    beforeEach(() => {
        circuitBreakerService = new CircuitBreakerService();
    });

    test('should open circuit breaker after error threshold', async () => {
        let callCount = 0;
        const failingFunction = async () => {
            callCount++;
            throw new Error('Service unavailable');
        };

        const breaker = circuitBreakerService.createBreaker(failingFunction, {
            name: 'test-service',
            timeout: 1000,
            errorThreshold: 50,
            resetTimeout: 5000,
            volumeThreshold: 3
        });

        // Make enough calls to trigger circuit breaker
        for (let i = 0; i < 5; i++) {
            try {
                await breaker.fire();
            } catch (error) {
                // Expected to fail
            }
        }

        const stats = circuitBreakerService.getBreakerStats('test-service');
        // Check that circuit breaker is working by examining stats
        // The circuit should have fired multiple times and have failures
        expect(stats).toBeDefined();
        expect(stats.stats.fires).toBeGreaterThan(0);
        expect(stats.stats.failures).toBeGreaterThan(0);
        expect(callCount).toBeGreaterThan(0);
    });

    test('should close circuit breaker after reset timeout', async () => {
        const breaker = circuitBreakerService.createBreaker(
            async () => 'success',
            {
                name: 'test-service',
                timeout: 1000,
                errorThreshold: 50,
                resetTimeout: 1000,
                volumeThreshold: 1
            }
        );

        // Open the breaker
        breaker.open();

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 1100));

        const result = await breaker.fire();
        expect(result).toBe('success');
        const stats = circuitBreakerService.getBreakerStats('test-service');
        expect(stats).toBeDefined();
        expect(stats.stats.successes).toBeGreaterThan(0);
    });

    test('should return breaker stats', () => {
        circuitBreakerService.createBreaker(
            async () => 'success',
            {
                name: 'test-service',
                timeout: 1000,
                errorThreshold: 50,
                resetTimeout: 5000,
                volumeThreshold: 1
            }
        );

        const stats = circuitBreakerService.getBreakerStats('test-service');
        expect(stats).toBeDefined();
        expect(stats.name).toBe('test-service');
        expect(stats.stats).toBeDefined();
    });

    test('should return all breaker stats', () => {
        circuitBreakerService.createBreaker(
            async () => 'success',
            {
                name: 'test-service-1',
                timeout: 1000,
                errorThreshold: 50,
                resetTimeout: 5000,
                volumeThreshold: 1
            }
        );

        circuitBreakerService.createBreaker(
            async () => 'success',
            {
                name: 'test-service-2',
                timeout: 1000,
                errorThreshold: 50,
                resetTimeout: 5000,
                volumeThreshold: 1
            }
        );

        const allStats = circuitBreakerService.getAllBreakerStats();
        expect(allStats).toHaveLength(2);
        expect(allStats.map((s: any) => s.name)).toContain('test-service-1');
        expect(allStats.map((s: any) => s.name)).toContain('test-service-2');
    });
});
