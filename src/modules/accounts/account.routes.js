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
  changeAccountStatus,
  createAccount,
  listAccounts,
  showCreateAccount,
  showEditAccount,
  updateAccount,
} from './account.controller.js';
import { accountBodySchema, accountIdSchema, accountStatusSchema } from './account.schemas.js';

export const accountRouter = Router();

accountRouter.use(requireAuthentication, requireHouseholdMembership);

accountRouter.get(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_VIEW),
  asyncHandler(listAccounts),
);
accountRouter.get(
  '/new',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE),
  showCreateAccount,
);
accountRouter.post(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE),
  verifyCsrfToken,
  validate({ body: accountBodySchema }),
  asyncHandler(createAccount),
);
accountRouter.get(
  '/:accountId/edit',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE),
  validate({ params: accountIdSchema }),
  asyncHandler(showEditAccount),
);
accountRouter.post(
  '/:accountId',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE),
  verifyCsrfToken,
  validate({ params: accountIdSchema, body: accountBodySchema }),
  asyncHandler(updateAccount),
);
accountRouter.post(
  '/:accountId/status',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.ACCOUNTS_MANAGE),
  verifyCsrfToken,
  validate({ params: accountIdSchema, body: accountStatusSchema }),
  asyncHandler(changeAccountStatus),
);
