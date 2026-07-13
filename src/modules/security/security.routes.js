import { Router } from 'express';

import { createRateLimiter } from '../../core/middleware/rate-limit.js';
import { validate } from '../../core/middleware/validate.js';
import { verifyCsrfToken } from '../../core/security/csrf.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { requireAuthentication } from '../auth/auth.middleware.js';
import {
  confirmMfaSetup,
  disableMfa,
  regenerateRecoveryCodes,
  showMfaSetup,
  showSecurity,
} from './security.controller.js';
import { mfaCodeSchema, passwordConfirmationSchema } from './security.schemas.js';

const mfaConfirmationLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  keyGenerator: (request) => `${request.ip}:${request.context?.user?.id ?? 'anonymous'}`,
});

const mfaManagementLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (request) => `${request.ip}:${request.context?.user?.id ?? 'anonymous'}`,
});

export const securityRouter = Router();

securityRouter.use(requireAuthentication);
securityRouter.get('/', asyncHandler(showSecurity));
securityRouter.get('/mfa/setup', asyncHandler(showMfaSetup));
securityRouter.post(
  '/mfa/setup/confirm',
  verifyCsrfToken,
  mfaConfirmationLimiter,
  validate({ body: mfaCodeSchema }),
  asyncHandler(confirmMfaSetup),
);
securityRouter.post(
  '/mfa/disable',
  verifyCsrfToken,
  mfaManagementLimiter,
  validate({ body: passwordConfirmationSchema }),
  asyncHandler(disableMfa),
);
securityRouter.post(
  '/mfa/recovery-codes/regenerate',
  verifyCsrfToken,
  mfaManagementLimiter,
  validate({ body: passwordConfirmationSchema }),
  asyncHandler(regenerateRecoveryCodes),
);
