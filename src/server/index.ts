import Hapi from '@hapi/hapi';
import { appConfig } from './config';
import { registerPlugins } from './plugins';
import { registerRoutes } from './routes';
import './types/server';

async function createServer(): Promise<Hapi.Server> {
  const server = Hapi.server({
    port: appConfig.server.port,
    host: appConfig.server.host,
    routes: {
      cors: appConfig.server.cors,
    },
  });

  await registerPlugins(server);
  await registerRoutes(server);

  return server;
}

async function startServer(): Promise<void> {
  try {
    const server = await createServer();
    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { createServer };
