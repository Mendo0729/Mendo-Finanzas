import { getHealthStatus } from '../../core/services/health-status.js';

export async function showHome(_request, response) {
  const health = await getHealthStatus();

  response.render('home', {
    pageTitle: 'Inicio',
    databaseStatus: health.database,
    environment: health.environment,
  });
}
