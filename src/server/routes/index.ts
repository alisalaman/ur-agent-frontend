import Hapi from '@hapi/hapi';
import { chatRoutes } from './chat';
import { healthRoutes } from './health';
import { staticRoutes } from './static';

export async function registerRoutes(server: Hapi.Server): Promise<void> {
  await server.register([
    { plugin: chatRoutes },
    { plugin: healthRoutes },
    { plugin: staticRoutes },
  ]);
}
