import Hapi from '@hapi/hapi';
import path from 'path';

export const staticRoutes: Hapi.Plugin<{}> = {
  name: 'static-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    server.route({
      method: 'GET',
      path: '/css/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../../public/css'),
        },
      },
    });

    // Serve GOV.UK Frontend CSS directly from npm package
    server.route({
      method: 'GET',
      path: '/css/govuk-frontend.css',
      handler: {
        file: {
          path: path.join(
            __dirname,
            '../../../node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.css'
          ),
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/js/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../../public/js'),
        },
      },
    });

    // Serve GOV.UK Frontend JS directly from npm package
    server.route({
      method: 'GET',
      path: '/js/govuk-frontend.js',
      handler: {
        file: {
          path: path.join(
            __dirname,
            '../../../node_modules/govuk-frontend/dist/govuk/all.bundle.js'
          ),
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/images/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../../public/images'),
        },
      },
    });

    // Serve GOV.UK Frontend assets directly from npm package
    server.route({
      method: 'GET',
      path: '/assets/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../../node_modules/govuk-frontend/dist/govuk/assets'),
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/manifest.json',
      handler: {
        file: {
          path: path.join(__dirname, '../../../public/manifest.json'),
        },
      },
    });
  },
};
