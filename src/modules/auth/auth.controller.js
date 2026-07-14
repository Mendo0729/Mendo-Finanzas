import { sessionCookieName } from '../../config/session.js';
import { AuthenticationError, ConflictError } from '../../core/errors/app-error.js';
import { destroySession, regenerateSession, saveSession } from '../../core/utils/session.js';
import * as securityService from '../security/security.service.js';
import * as authService from './auth.service.js';

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_RESEND_NOTICE =
  'Si existe una cuenta pendiente de verificación, enviaremos un nuevo enlace.';

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

async function rememberPendingVerification(request, email, notice = null) {
  request.session.pendingVerificationEmail = email;
  if (notice) {
    request.session.pendingVerificationNotice = notice;
  }
  await saveSession(request);
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

export async function showVerificationPending(request, response) {
  const notice = request.session?.pendingVerificationNotice ?? null;
  if (request.session?.pendingVerificationNotice) {
    delete request.session.pendingVerificationNotice;
    await saveSession(request);
  }

  response.render('auth/verify-email-pending', {
    pageTitle: 'Verifica tu correo',
    values: { name: '', email: request.session?.pendingVerificationEmail ?? '' },
    fieldErrors: {},
    formError: null,
    notice,
  });
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
    await rememberPendingVerification(request, user.email);
    response.redirect(303, '/auth/verify-email/pending');
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

export async function resendVerification(request, response, next) {
  try {
    const { email } = request.validated.body;
    await authService.resendEmailVerification(email);
    await rememberPendingVerification(request, email, VERIFICATION_RESEND_NOTICE);
    response.redirect(303, '/auth/verify-email/pending');
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(request, response, next) {
  try {
    await authService.verifyEmail(request.query?.token);
    delete request.session.pendingVerificationEmail;
    delete request.session.pendingVerificationNotice;
    await saveSession(request);
    response.render('auth/verify-email-result', {
      pageTitle: 'Correo verificado',
      verified: true,
      message: 'Tu correo fue verificado correctamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    if (error?.code === 'EMAIL_VERIFICATION_INVALID') {
      response.status(error.statusCode).render('auth/verify-email-result', {
        pageTitle: 'Enlace no válido',
        verified: false,
        message: error.message,
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
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        await rememberPendingVerification(request, request.validated.body.email);
        response.redirect(303, '/auth/verify-email/pending');
        return;
      }

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
