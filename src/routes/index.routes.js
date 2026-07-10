import { Router } from 'express';

import { checkDatabaseConnection } from '../config/database.js';
import { env } from '../config/env.js';

export const indexRouter = Router();

indexRouter.get('/', async (_request, response) => {
  let databaseStatus = 'down';

  try {
    await checkDatabaseConnection();
    databaseStatus = 'up';
  } catch {
    databaseStatus = 'down';
  }

  response.render('home', {
    pageTitle: 'Inicio',
    databaseStatus,
    environment: env.nodeEnv,
  });
});
