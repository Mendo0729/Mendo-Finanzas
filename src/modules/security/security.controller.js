import { AuthenticationError } from '../../core/errors/app-error.js';
import * as securityService from './security.service.js';

export async function showSecurity(request, response) {
  response.render('security/index', {
    pageTitle: 'Seguridad',
    mfa: await securityService.getMfaStatus(request.context.user.id),
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
