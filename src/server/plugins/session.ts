import Hapi from '@hapi/hapi';
import Cookie from '@hapi/cookie';
import { SessionService } from '../services/session-service';

export const sessionPlugin: Hapi.Plugin<{}> = {
  name: 'session',
  register: async (server: Hapi.Server): Promise<void> => {
    await server.register(Cookie);

    const sessionService = new SessionService();

    server.auth.strategy('session', 'cookie', {
      cookie: {
        name: 'session',
        password: process.env.SESSION_SECRET || 'default-secret',
        isSecure: process.env.NODE_ENV === 'production',
        isHttpOnly: true,
        isSameSite: 'Lax',
        ttl: 24 * 60 * 60 * 1000, // 24 hours
      },
      validate: async (_request: any, session: any) => {
        if (!session || !session.userId) {
          return { valid: false };
        }
        return { valid: true, credentials: session };
      },
    });

    server.auth.default('session');

    // Make session service available to routes
    server.app.sessionService = sessionService;
  },
};
