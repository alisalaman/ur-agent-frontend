import Hapi from '@hapi/hapi';
import { appConfig } from './config';
import { registerPlugins } from './plugins';
import { registerRoutes } from './routes';
import { ConfigValidator } from './utils/config-validation';
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
    // Validate configuration before starting server
    const configValidation = ConfigValidator.validateAll();

    if (!configValidation.isValid) {
      console.error('Configuration validation failed:');
      configValidation.errors.forEach((error) => console.error(`  ❌ ${error}`));
      process.exit(1);
    }

    if (configValidation.warnings.length > 0) {
      console.warn('Configuration warnings:');
      configValidation.warnings.forEach((warning) => console.warn(`  ⚠️  ${warning}`));
    }

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
