import { randomBytes, timingSafeEqual } from 'node:crypto';

import { AuthorizationError } from '../errors/app-error.js';

const TOKEN_BYTES = 32;

function createToken() {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

function tokensMatch(expected, received) {
  if (typeof expected !== 'string' || typeof received !== 'string') {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function exposeCsrfToken(request, response, next) {
  if (!request.session.csrfToken) {
    request.session.csrfToken = createToken();
  }

  response.locals.csrfToken = request.session.csrfToken;
  next();
}

export function exposeAuthenticatedCsrfToken(request, response, next) {
  if (!request.context?.user) {
    response.locals.csrfToken = null;
    next();
    return;
  }

  exposeCsrfToken(request, response, next);
}

export function verifyCsrfToken(request, _response, next) {
  const submittedToken = request.body?._csrf ?? request.get('x-csrf-token');

  if (!tokensMatch(request.session?.csrfToken, submittedToken)) {
    next(
      new AuthorizationError(
        'La sesión del formulario expiró. Recarga la página e inténtalo nuevamente.',
        {
          code: 'CSRF_INVALID',
        },
      ),
    );
    return;
  }

  next();
}
