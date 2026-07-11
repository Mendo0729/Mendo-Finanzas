import { authRouter } from '../modules/auth/auth.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { homeRouter } from '../modules/home/home.routes.js';
import { householdRouter } from '../modules/households/household.routes.js';

export function registerRoutes(app) {
  app.use('/', homeRouter);
  app.use('/auth', authRouter);
  app.use('/households', householdRouter);
  app.use('/health', healthRouter);
}
