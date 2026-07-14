import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../errors/app-error.js';

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError('Ocurrió un error interno.', { cause: error });
}

function acceptsJson(request) {
  const acceptHeader = request.get('accept') ?? '';
  return request.path.startsWith('/api/') || acceptHeader.includes('application/json');
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const appError = normalizeError(error);
  const requestId = request.context?.requestId ?? response.locals.requestId ?? null;
  const requestPath = request.path;
  const logContext = {
    requestId,
    method: request.method,
    path: requestPath,
    statusCode: appError.statusCode,
    code: appError.code,
    error,
  };

  if (appError.statusCode >= 500) {
    logger.error('Error no controlado durante una solicitud HTTP.', logContext);
  } else {
    logger.warn('Solicitud HTTP rechazada por una regla de aplicación.', logContext);
  }

  const publicMessage = appError.expose ? appError.message : 'Ocurrió un error interno.';

  if (acceptsJson(request)) {
    response.status(appError.statusCode).json({
      error: {
        code: appError.code,
        message: publicMessage,
        ...(appError.details ? { details: appError.details } : {}),
        requestId,
      },
    });
    return;
  }

  if (appError.statusCode === 404) {
    response.status(404).render('errors/404', {
      pageTitle: 'Página no encontrada',
      requestedPath: requestPath,
      requestId,
    });
    return;
  }

  if (appError.statusCode >= 500) {
    response.status(appError.statusCode).render('errors/500', {
      pageTitle: 'Error interno',
      errorMessage: env.isDevelopment ? error.message : null,
      requestId,
    });
    return;
  }

  response.status(appError.statusCode).send(publicMessage);
}
