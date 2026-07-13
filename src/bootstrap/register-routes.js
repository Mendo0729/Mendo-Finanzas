import { accountRouter } from '../modules/accounts/account.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { categoryRouter } from '../modules/categories/category.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { homeRouter } from '../modules/home/home.routes.js';
import { householdRouter } from '../modules/households/household.routes.js';
import { securityRouter } from '../modules/security/security.routes.js';

export function registerRoutes(app) {
  app.use('/', homeRouter);
  app.use('/auth', authRouter);
  app.use('/households', householdRouter);
  app.use('/accounts', accountRouter);
  app.use('/categories', categoryRouter);
  app.use('/security', securityRouter);
  app.use('/health', healthRouter);
}
