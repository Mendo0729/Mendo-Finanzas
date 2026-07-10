import { sessionCookieName } from '../../config/session.js';
import { AuthenticationError, ConflictError } from '../../core/errors/app-error.js';
import { destroySession, regenerateSession, saveSession } from '../../core/utils/session.js';
import * as authService from './auth.service.js';

function emptyFormState() {
  return {
    values: { name: '', email: '' },
    fieldErrors: {},
    formError: null,
  };
}

async function establishAuthenticatedSession(request, user) {
  await regenerateSession(request);
  request.session.userId = user.id.toString();
  request.session.authenticatedAt = new Date().toISOString();
  await saveSession(request);
}

export function showRegister(_request, response) {
  response.render('auth/register', {
    pageTitle: 'Crear cuenta',
    ...emptyFormState(),
  });
}

export function showLogin(_request, response) {
  response.render('auth/login', {
    pageTitle: 'Iniciar sesión',
    ...emptyFormState(),
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
        values: {
          name: request.validated.body.name,
          email: request.validated.body.email,
        },
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
    await establishAuthenticatedSession(request, user);
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

export async function logout(request, response, next) {
  try {
    await destroySession(request);
    response.clearCookie(sessionCookieName, { path: '/' });
    response.redirect(303, '/');
  } catch (error) {
    next(error);
  }
}
