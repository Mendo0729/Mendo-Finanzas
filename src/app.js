import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { registerMiddlewares } from './bootstrap/register-middlewares.js';
import { registerRoutes } from './bootstrap/register-routes.js';
import { errorHandler } from './core/middleware/error-handler.js';
import { notFoundHandler } from './core/middleware/not-found.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  registerMiddlewares(app, {
    publicDirectory: path.join(__dirname, 'public'),
  });
  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
