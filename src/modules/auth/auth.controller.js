import { sessionCookieName } from '../../config/session.js';
import { AuthenticationError, ConflictError } from '../../core/errors/app-error.js';
import { destroySession, regenerateSession, saveSession } from '../../core/utils/session.js';
import * as securityService from '../security/security.service.js';
import * as authService from './auth.service.js';

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;

function emptyFormState() {
  return {
    values: { name: '', email: '' },
    fieldErrors: {},
    formError: null,
  };
}

function pendingMfaUserId(request) {
  const userId = request.session?.pendingMfaUserId;
  const startedAt = Date.parse(request.session?.pendingMfaStartedAt ?? '');
  if (!userId || !Number.isFinite(startedAt) || Date.now() - startedAt > MFA_CHALLENGE_TTL_MS) {
    return null;
  }
  return userId;
}

async function establishAuthenticatedSession(request, user) {
  await regenerateSession(request);
  request.session.userId = user.id.toString();
  request.session.authenticatedAt = new Date().toISOString();
  await saveSession(request);
}

async function establishPendingMfaSession(request, user) {
  await regenerateSession(request);
  request.session.pendingMfaUserId = user.id.toString();
  request.session.pendingMfaStartedAt = new Date().toISOString();
  await saveSession(request);
}

export function showRegister(_request, response) {
  response.render('auth/register', { pageTitle: 'Crear cuenta', ...emptyFormState() });
}

export function showLogin(_request, response) {
  response.render('auth/login', { pageTitle: 'Iniciar sesión', ...emptyFormState() });
}

export function showMfaChallenge(request, response) {
  if (!pendingMfaUserId(request)) {
    response.redirect(303, '/auth/login');
    return;
  }

  response.render('auth/mfa', {
    pageTitle: 'Verificación en dos pasos',
    formError: null,
  });
}

export async function register(request, response, next) {
  try {
    const user = await authService.registerUser(request.validated.body);
    await establishAuthenticatedSession(request, user);
    response.redirect(303, '/');
  } catch (error) {
    if (error instanceof ConflictError) {
      response.status(error.statusCode).render('auth/register', {
        pageTitle: 'Crear cuenta',
        values: { name: request.validated.body.name, email: request.validated.body.email },
        fieldErrors: { email: error.message },
        formError: null,
      });
      return;
    }
    next(error);
  }
}

export async function login(request, response, next) {
  try {
    const user = await authService.authenticateUser(request.validated.body);
    if (user.mfaEnabled) {
      await establishPendingMfaSession(request, user);
      response.redirect(303, '/auth/mfa');
      return;
    }

    const completedUser = await authService.completeAuthenticatedLogin(user.id);
    await establishAuthenticatedSession(request, completedUser);
    response.redirect(303, '/');
  } catch (error) {
    if (error instanceof AuthenticationError) {
      response.status(error.statusCode).render('auth/login', {
        pageTitle: 'Iniciar sesión',
        values: { name: '', email: request.validated.body.email },
        fieldErrors: {},
        formError: error.message,
      });
      return;
    }
    next(error);
  }
}

async function completeMfaLogin(request, response, verifier) {
  const userId = pendingMfaUserId(request);
  if (!userId) {
    response.redirect(303, '/auth/login');
    return;
  }

  try {
    await verifier(userId);
    const user = await authService.completeAuthenticatedLogin(userId);
    await establishAuthenticatedSession(request, user);
    response.redirect(303, '/');
  } catch (error) {
    if (error instanceof AuthenticationError) {
      response.status(error.statusCode).render('auth/mfa', {
        pageTitle: 'Verificación en dos pasos',
        formError: error.message,
      });
      return;
    }
    throw error;
  }
}

export async function verifyMfaChallenge(request, response, next) {
  try {
    await completeMfaLogin(request, response, (userId) =>
      securityService.verifyMfaLogin(userId, request.validated.body.token),
    );
  } catch (error) {
    next(error);
  }
}

export async function verifyRecoveryChallenge(request, response, next) {
  try {
    await completeMfaLogin(request, response, (userId) =>
      securityService.verifyRecoveryCode(userId, request.validated.body.recoveryCode),
    );
  } catch (error) {
    next(error);
  }
}

export async function logout(request, response, next) {
  try {
    await destroySession(request);
    response.clearCookie(sessionCookieName, { path: '/' });
    response.redirect(303, '/');
  } catch (error) {
    next(error);
  }
}
