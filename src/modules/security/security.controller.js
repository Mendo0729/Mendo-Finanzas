import { AuthenticationError } from '../../core/errors/app-error.js';
import * as securityService from './security.service.js';

function securityMessage(request) {
  if (request.query?.mfa === 'disabled') {
    return 'La autenticación en dos pasos fue desactivada.';
  }
  if (request.query?.recovery === 'regenerated') {
    return 'Se generaron nuevos códigos de recuperación.';
  }
  return null;
}

export async function showSecurity(request, response) {
  response.render('security/index', {
    pageTitle: 'Seguridad',
    mfa: await securityService.getMfaStatus(request.context.user.id),
    successMessage: securityMessage(request),
    formError: null,
  });
}

export async function showMfaSetup(request, response) {
  const setup = await securityService.beginMfaSetup(
    request.context.user.id,
    request.context.user.email,
  );

  response.render('security/mfa-setup', {
    pageTitle: 'Configurar autenticación en dos pasos',
    setup,
    fieldError: null,
  });
}

export async function confirmMfaSetup(request, response, next) {
  try {
    const recoveryCodes = await securityService.confirmMfaSetup(
      request.context.user.id,
      request.validated.body.token,
    );

    response.render('security/recovery-codes', {
      pageTitle: 'Códigos de recuperación',
      recoveryCodes,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      const setup = await securityService.getPendingMfaSetup(
        request.context.user.id,
        request.context.user.email,
      );
      response.status(error.statusCode).render('security/mfa-setup', {
        pageTitle: 'Configurar autenticación en dos pasos',
        setup,
        fieldError: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function disableMfa(request, response, next) {
  try {
    await securityService.disableMfa(request.context.user.id, request.validated.body.password);
    response.redirect(303, '/security?mfa=disabled');
  } catch (error) {
    if (error instanceof AuthenticationError) {
      response.status(error.statusCode).render('security/index', {
        pageTitle: 'Seguridad',
        mfa: await securityService.getMfaStatus(request.context.user.id),
        successMessage: null,
        formError: error.message,
      });
      return;
    }

    next(error);
  }
}

export async function regenerateRecoveryCodes(request, response, next) {
  try {
    const recoveryCodes = await securityService.regenerateRecoveryCodes(
      request.context.user.id,
      request.validated.body.password,
    );
    response.render('security/recovery-codes', {
      pageTitle: 'Nuevos códigos de recuperación',
      recoveryCodes,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      response.status(error.statusCode).render('security/index', {
        pageTitle: 'Seguridad',
        mfa: await securityService.getMfaStatus(request.context.user.id),
        successMessage: null,
        formError: error.message,
      });
      return;
    }

    next(error);
  }
}
