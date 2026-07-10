import { Router } from 'express';

import { checkDatabaseConnection } from '../config/database.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  try {
    await checkDatabaseConnection();

    return response.status(200).json({
      status: 'ok',
      database: 'up',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return response.status(503).json({
      status: 'degraded',
      database: 'down',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  }
});
