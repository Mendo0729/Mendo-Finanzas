import { Router } from 'express';

import { validate } from '../../core/middleware/validate.js';
import { verifyCsrfToken } from '../../core/security/csrf.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { requireAuthentication } from '../auth/auth.middleware.js';
import {
  selectHousehold,
  showCurrentHousehold,
  showHouseholdSelection,
} from './household.controller.js';
import { requireHouseholdMembership } from './household.middleware.js';
import { householdSelectionSchema } from './household.schemas.js';

export const householdRouter = Router();

householdRouter.get('/select', requireAuthentication, asyncHandler(showHouseholdSelection));

householdRouter.post(
  '/select',
  requireAuthentication,
  verifyCsrfToken,
  validate({ body: householdSelectionSchema }),
  asyncHandler(selectHousehold),
);

householdRouter.get(
  '/current',
  requireAuthentication,
  requireHouseholdMembership,
  showCurrentHousehold,
);
