// Test setup file
import 'jest';

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    // Suppress expected error logs during tests
    console.error = (...args: any[]) => {
        if (args[0]?.includes?.('Configuration validation failed')) {
            return; // Suppress expected validation errors
        }
        originalConsoleError(...args);
    };

    console.warn = (...args: any[]) => {
        if (args[0]?.includes?.('Retry attempt failed') ||
            args[0]?.includes?.('Exponential backoff retry failed')) {
            return; // Suppress expected retry warnings
        }
        originalConsoleWarn(...args);
    };
});

afterAll(() => {
    // Restore original console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

