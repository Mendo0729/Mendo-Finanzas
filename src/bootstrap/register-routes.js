import { healthRouter } from '../modules/health/health.routes.js';
import { homeRouter } from '../modules/home/home.routes.js';

export function registerRoutes(app) {
  app.use('/', homeRouter);
  app.use('/health', healthRouter);
}
