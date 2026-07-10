import { getHealthStatus } from '../../core/services/health-status.js';

export async function showHealth(_request, response) {
  const { httpStatus, ...health } = await getHealthStatus();
  response.status(httpStatus).json(health);
}
