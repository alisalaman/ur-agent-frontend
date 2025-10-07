import Hapi from '@hapi/hapi';
import { authRoutes } from './auth';
import { chatRoutes } from './chat';
import { chatApiRoutes } from './chat-api';
import { healthRoutes } from './health';
import { staticRoutes } from './static';

export async function registerRoutes(server: Hapi.Server): Promise<void> {
  await server.register([
    { plugin: authRoutes },
    { plugin: chatRoutes },
    { plugin: chatApiRoutes },
    { plugin: healthRoutes },
    { plugin: staticRoutes },
  ]);
}
