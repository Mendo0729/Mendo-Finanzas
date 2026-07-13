import { Router } from 'express';

import { validate } from '../../core/middleware/validate.js';
import { verifyCsrfToken } from '../../core/security/csrf.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { requireAuthentication } from '../auth/auth.middleware.js';
import {
  createHousehold,
  selectHousehold,
  showCreateHousehold,
  showCurrentHousehold,
  showEditHousehold,
  showHouseholdSelection,
  updateHousehold,
} from './household.controller.js';
import {
  requireHouseholdMembership,
  requireHouseholdPermission,
  requireHouseholdScope,
} from './household.middleware.js';
import { HOUSEHOLD_PERMISSIONS } from './household.roles.js';
import {
  householdIdParamsSchema,
  householdSelectionSchema,
  householdWriteSchema,
} from './household.schemas.js';

export const householdRouter = Router();

householdRouter.use(requireAuthentication);

householdRouter.get('/select', asyncHandler(showHouseholdSelection));

householdRouter.post(
  '/select',
  verifyCsrfToken,
  validate({ body: householdSelectionSchema }),
  asyncHandler(selectHousehold),
);

householdRouter.get('/new', showCreateHousehold);

householdRouter.post(
  '/',
  verifyCsrfToken,
  validate({ body: householdWriteSchema }),
  asyncHandler(createHousehold),
);

householdRouter.get(
  '/current',
  requireHouseholdMembership,
  showCurrentHousehold,
);

householdRouter.get(
  '/:householdId/edit',
  requireHouseholdMembership,
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.HOUSEHOLD_UPDATE),
  validate({ params: householdIdParamsSchema }),
  requireHouseholdScope((request) => request.validated.params.householdId),
  asyncHandler(showEditHousehold),
);

householdRouter.post(
  '/:householdId',
  requireHouseholdMembership,
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.HOUSEHOLD_UPDATE),
  verifyCsrfToken,
  validate({ params: householdIdParamsSchema, body: householdWriteSchema }),
  requireHouseholdScope((request) => request.validated.params.householdId),
  asyncHandler(updateHousehold),
);
