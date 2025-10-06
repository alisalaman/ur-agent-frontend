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
    // Debug environment variables for Render
    console.log('=== RENDER DEPLOYMENT DEBUG ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);
    console.log('HOST:', process.env.HOST);
    console.log('===============================');

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

    console.log('=== SERVER STARTUP SUCCESS ===');
    console.log(`Server running at: ${server.info.uri}`);
    console.log(`Server port: ${server.info.port}`);
    console.log(`Server host: ${server.info.host}`);
    console.log(`Server address: ${server.info.address}`);
    console.log(`WebSocket endpoint available at: ${server.info.uri}/ws/synthetic-agents`);
    console.log('===============================');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { createServer };
