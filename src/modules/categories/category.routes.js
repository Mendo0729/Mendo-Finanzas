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
  changeCategoryStatus,
  createCategory,
  listCategories,
  showCreateCategory,
  showEditCategory,
  updateCategory,
} from './category.controller.js';
import { categoryBodySchema, categoryIdSchema, categoryStatusSchema } from './category.schemas.js';

export const categoryRouter = Router();

categoryRouter.use(requireAuthentication, requireHouseholdMembership);

categoryRouter.get(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.CATEGORIES_VIEW),
  asyncHandler(listCategories),
);
categoryRouter.get(
  '/new',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.CATEGORIES_MANAGE),
  showCreateCategory,
);
categoryRouter.post(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.CATEGORIES_MANAGE),
  verifyCsrfToken,
  validate({ body: categoryBodySchema }),
  asyncHandler(createCategory),
);
categoryRouter.get(
  '/:categoryId/edit',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.CATEGORIES_MANAGE),
  validate({ params: categoryIdSchema }),
  asyncHandler(showEditCategory),
);
categoryRouter.post(
  '/:categoryId',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.CATEGORIES_MANAGE),
  verifyCsrfToken,
  validate({ params: categoryIdSchema, body: categoryBodySchema }),
  asyncHandler(updateCategory),
);
categoryRouter.post(
  '/:categoryId/status',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.CATEGORIES_MANAGE),
  verifyCsrfToken,
  validate({ params: categoryIdSchema, body: categoryStatusSchema }),
  asyncHandler(changeCategoryStatus),
);
