import { getHealthStatus } from '../../core/services/health-status.js';
import { getDashboardData } from './home.service.js';

export async function showHome(_request, response) {
  const health = await getHealthStatus();
  const { currentHousehold } = response.locals;

  response.render('home', {
    pageTitle: currentHousehold ? 'Dashboard' : 'Inicio',
    databaseStatus: health.database,
    environment: health.environment,
    dashboard: currentHousehold ? await getDashboardData(currentHousehold) : null,
  });
}
