import { checkDatabaseConnection } from '../../config/database.js';
import { env } from '../../config/env.js';

function environmentDetails() {
  return env.isProduction ? {} : { environment: env.nodeEnv };
}

export async function getHealthStatus() {
  try {
    await checkDatabaseConnection();

    return {
      httpStatus: 200,
      status: 'ok',
      database: 'up',
      ...environmentDetails(),
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      httpStatus: 503,
      status: 'degraded',
      database: 'down',
      ...environmentDetails(),
      timestamp: new Date().toISOString(),
    };
  }
}
