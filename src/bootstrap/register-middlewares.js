import compression from 'compression';
import express from 'express';
import helmet from 'helmet';

import { requestContext } from '../core/middleware/request-context.js';

export function registerMiddlewares(app, { publicDirectory }) {
  app.use(requestContext);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(publicDirectory));
}
