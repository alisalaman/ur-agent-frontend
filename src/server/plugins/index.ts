import Hapi from '@hapi/hapi';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import path from 'path';
import { sessionPlugin } from './session';
import { websocketPlugin } from './websocket';
import { resiliencePlugin } from './resilience';

export async function registerPlugins(server: Hapi.Server): Promise<void> {
  // Register Inert first
  await server.register(Inert);

  // Register Vision
  await server.register(Vision);

  // Register session plugin
  await server.register(sessionPlugin);

  // Register WebSocket plugin
  await server.register(websocketPlugin);

  // Register resilience plugin
  await server.register(resiliencePlugin);

  // Configure views after Vision is registered
  // From dist/server/plugins, go up to project root, then into src/templates
  const templatesPath = path.join(__dirname, '../../../src/templates');
  const govukTemplatesPath = path.join(
    __dirname,
    '../../../node_modules/govuk-frontend/dist/govuk'
  );

  server.views({
    engines: {
      njk: {
        compile: (src: string) => {
          const nunjucks = require('nunjucks');
          console.log('Templates path:', templatesPath);
          console.log('GOV.UK templates path:', govukTemplatesPath);
          console.log('Paths exist:', {
            templates: require('fs').existsSync(templatesPath),
            govuk: require('fs').existsSync(govukTemplatesPath),
          });
          const nunjucksEnv = nunjucks.configure([templatesPath, govukTemplatesPath], {
            autoescape: true,
            throwOnUndefined: false,
            trimBlocks: false,
            lstripBlocks: false,
          });
          const template = nunjucks.compile(src, nunjucksEnv);
          return (context: any) => template.render(context);
        },
      },
    },
    path: templatesPath,
    compileOptions: {
      noCache: process.env.NODE_ENV === 'development',
    },
  });
}
