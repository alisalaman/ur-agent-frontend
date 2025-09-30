import Hapi from '@hapi/hapi';
import nunjucks from 'nunjucks';
import path from 'path';

export const nunjucksPlugin: Hapi.Plugin<{}> = {
  name: 'nunjucks',
  register: async (server: Hapi.Server): Promise<void> => {
    const templatesPath = path.join(__dirname, '../../templates');
    const govukTemplatesPath = path.join(__dirname, '../../../node_modules/govuk-frontend');

    const nunjucksEnv = nunjucks.configure([templatesPath, govukTemplatesPath], {
      autoescape: true,
      throwOnUndefined: false,
      trimBlocks: false,
      lstripBlocks: false,
    });

    // Configure Vision with Nunjucks
    server.views({
      engines: {
        njk: {
          compile: (src: string) => {
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
  },
};
