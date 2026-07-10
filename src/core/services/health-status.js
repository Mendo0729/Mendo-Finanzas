import { checkDatabaseConnection } from '../../config/database.js';
import { env } from '../../config/env.js';

export async function getHealthStatus() {
  try {
    await checkDatabaseConnection();

    return {
      httpStatus: 200,
      status: 'ok',
      database: 'up',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      httpStatus: 503,
      status: 'degraded',
      database: 'down',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    };
  }
}
