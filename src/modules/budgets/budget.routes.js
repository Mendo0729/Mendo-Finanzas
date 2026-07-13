import { Router } from 'express';

import { validate } from '../../core/middleware/validate.js';
import { verifyCsrfToken } from '../../core/security/csrf.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { requireAuthentication } from '../auth/auth.middleware.js';
import {
  requireHouseholdMembership,
  requireHouseholdPermission,
} from '../households/household.middleware.js';
import { HOUSEHOLD_PERMISSIONS } from '../households/household.roles.js';
import {
  changeBudgetStatus,
  createBudget,
  listBudgets,
  showCreateBudget,
  showEditBudget,
  updateBudget,
} from './budget.controller.js';
import {
  budgetBodySchema,
  budgetIdSchema,
  budgetQuerySchema,
  budgetStatusSchema,
} from './budget.schemas.js';

export const budgetRouter = Router();

budgetRouter.use(requireAuthentication, requireHouseholdMembership);

budgetRouter.get(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.BUDGETS_VIEW),
  validate({ query: budgetQuerySchema }),
  asyncHandler(listBudgets),
);
budgetRouter.get(
  '/new',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.BUDGETS_MANAGE),
  validate({ query: budgetQuerySchema }),
  asyncHandler(showCreateBudget),
);
budgetRouter.post(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.BUDGETS_MANAGE),
  verifyCsrfToken,
  validate({ body: budgetBodySchema }),
  asyncHandler(createBudget),
);
budgetRouter.get(
  '/:budgetId/edit',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.BUDGETS_MANAGE),
  validate({ params: budgetIdSchema }),
  asyncHandler(showEditBudget),
);
budgetRouter.post(
  '/:budgetId',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.BUDGETS_MANAGE),
  verifyCsrfToken,
  validate({ params: budgetIdSchema, body: budgetBodySchema }),
  asyncHandler(updateBudget),
);
budgetRouter.post(
  '/:budgetId/status',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.BUDGETS_MANAGE),
  verifyCsrfToken,
  validate({ params: budgetIdSchema, body: budgetStatusSchema }),
  asyncHandler(changeBudgetStatus),
);
