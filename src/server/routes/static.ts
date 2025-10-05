import Hapi from '@hapi/hapi';
import path from 'path';

export const staticRoutes: Hapi.Plugin<{}> = {
  name: 'static-routes',
  register: async (server: Hapi.Server): Promise<void> => {
    server.route({
      method: 'GET',
      path: '/css/{param*}',
      options: {
        auth: false,
      },
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
      options: {
        auth: false,
      },
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
      options: {
        auth: false,
      },
      handler: {
        directory: {
          path: path.join(__dirname, '../../../public/js'),
          index: false,
          listing: false,
        },
      },
    });

    // Debug route to check static file serving
    server.route({
      method: 'GET',
      path: '/debug/js-path',
      options: {
        auth: false,
      },
      handler: (_request, h) => {
        const jsPath = path.join(__dirname, '../../../public/js');
        const fs = require('fs');
        const exists = fs.existsSync(jsPath);
        const websocketPath = path.join(jsPath, 'services/websocket-service.js');
        const websocketExists = fs.existsSync(websocketPath);

        return h.response({
          __dirname,
          jsPath,
          jsPathExists: exists,
          websocketPath,
          websocketExists,
          files: exists ? fs.readdirSync(jsPath) : 'path does not exist',
        });
      },
    });

    // Serve GOV.UK Frontend JS directly from npm package
    server.route({
      method: 'GET',
      path: '/js/govuk-frontend.js',
      options: {
        auth: false,
      },
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
      options: {
        auth: false,
      },
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
      options: {
        auth: false,
      },
      handler: {
        directory: {
          path: path.join(__dirname, '../../../node_modules/govuk-frontend/dist/govuk/assets'),
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/manifest.json',
      options: {
        auth: false,
      },
      handler: {
        file: {
          path: path.join(__dirname, '../../../public/manifest.json'),
        },
      },
    });

    server.route({
      method: 'GET',
      path: '/favicon.ico',
      options: {
        auth: false,
      },
      handler: {
        file: {
          path: path.join(__dirname, '../../../public/favicon.ico'),
        },
      },
    });

    // Handle source map requests gracefully
    server.route({
      method: 'GET',
      path: '/js/{filename}.map',
      options: {
        auth: false,
      },
      handler: (_request, h) => {
        // Return 404 for source map requests since we don't need them in production
        return h.response().code(404);
      },
    });
  },
};
