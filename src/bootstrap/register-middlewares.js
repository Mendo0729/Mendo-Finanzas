import compression from 'compression';
import express from 'express';
import helmet from 'helmet';

import { createSessionMiddleware } from '../config/session.js';
import { requestContext } from '../core/middleware/request-context.js';
import { exposeAuthenticatedCsrfToken } from '../core/security/csrf.js';
import { loadCurrentUser } from '../modules/auth/auth.middleware.js';
import { loadHouseholdContext } from '../modules/households/household.middleware.js';

function initializeViewLocals(_request, response, next) {
  response.locals.currentUser = null;
  response.locals.currentHousehold = null;
  response.locals.currentHouseholdRole = null;
  response.locals.householdPermissions = [];
  response.locals.csrfToken = null;
  next();
}

export function registerMiddlewares(app, { publicDirectory }) {
  app.use(requestContext);
  app.use(initializeViewLocals);
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
  app.use(express.static(publicDirectory));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(createSessionMiddleware());
  app.use(loadCurrentUser);
  app.use(loadHouseholdContext);
  app.use(exposeAuthenticatedCsrfToken);
}
