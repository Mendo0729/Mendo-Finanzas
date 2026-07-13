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
  createTransaction,
  listTransactions,
  showCreateTransaction,
} from './transaction.controller.js';
import { transactionBodySchema } from './transaction.schemas.js';

export const transactionRouter = Router();

transactionRouter.use(requireAuthentication, requireHouseholdMembership);

transactionRouter.get(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.TRANSACTIONS_VIEW),
  asyncHandler(listTransactions),
);
transactionRouter.get(
  '/new',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.TRANSACTIONS_MANAGE),
  asyncHandler(showCreateTransaction),
);
transactionRouter.post(
  '/',
  requireHouseholdPermission(HOUSEHOLD_PERMISSIONS.TRANSACTIONS_MANAGE),
  verifyCsrfToken,
  validate({ body: transactionBodySchema }),
  asyncHandler(createTransaction),
);
