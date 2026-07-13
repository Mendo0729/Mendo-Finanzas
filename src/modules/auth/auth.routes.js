import { Router } from 'express';

import { createRateLimiter } from '../../core/middleware/rate-limit.js';
import { validate } from '../../core/middleware/validate.js';
import { exposeCsrfToken, verifyCsrfToken } from '../../core/security/csrf.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import {
  login,
  logout,
  register,
  showLogin,
  showMfaChallenge,
  showRegister,
  verifyMfaChallenge,
  verifyRecoveryChallenge,
} from './auth.controller.js';
import { requireAuthentication, requireGuest } from './auth.middleware.js';
import {
  loginSchema,
  mfaTokenSchema,
  normalizeEmail,
  recoveryCodeSchema,
  registerSchema,
} from './auth.schemas.js';
import { validateAuthForm } from './auth.validation.js';

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (request) => `${request.ip}:${normalizeEmail(request.body?.email)}`,
});

const registrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
});

const mfaLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  keyGenerator: (request) => `${request.ip}:${request.session?.pendingMfaUserId ?? 'none'}`,
});

export const authRouter = Router();

authRouter.get('/register', requireGuest, exposeCsrfToken, showRegister);
authRouter.post(
  '/register',
  requireGuest,
  exposeCsrfToken,
  verifyCsrfToken,
  registrationLimiter,
  validateAuthForm({
    schema: registerSchema,
    view: 'auth/register',
    pageTitle: 'Crear cuenta',
  }),
  asyncHandler(register),
);

authRouter.get('/login', requireGuest, exposeCsrfToken, showLogin);
authRouter.post(
  '/login',
  requireGuest,
  exposeCsrfToken,
  verifyCsrfToken,
  loginLimiter,
  validateAuthForm({
    schema: loginSchema,
    view: 'auth/login',
    pageTitle: 'Iniciar sesión',
  }),
  asyncHandler(login),
);

authRouter.get('/mfa', requireGuest, exposeCsrfToken, showMfaChallenge);
authRouter.post(
  '/mfa',
  requireGuest,
  exposeCsrfToken,
  verifyCsrfToken,
  mfaLimiter,
  validate({ body: mfaTokenSchema }),
  asyncHandler(verifyMfaChallenge),
);
authRouter.post(
  '/mfa/recovery',
  requireGuest,
  exposeCsrfToken,
  verifyCsrfToken,
  mfaLimiter,
  validate({ body: recoveryCodeSchema }),
  asyncHandler(verifyRecoveryChallenge),
);

authRouter.post(
  '/logout',
  requireAuthentication,
  exposeCsrfToken,
  verifyCsrfToken,
  asyncHandler(logout),
);
