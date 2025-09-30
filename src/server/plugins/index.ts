import Hapi from '@hapi/hapi';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import path from 'path';

export async function registerPlugins(server: Hapi.Server): Promise<void> {
  // Register Inert first
  await server.register(Inert);

  // Register Vision
  await server.register(Vision);

  // Configure views after Vision is registered
  const templatesPath = path.join(__dirname, '../../templates');
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
