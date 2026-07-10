import { env } from '../config/env.js';

export function errorHandler(error, _request, response, _next) {
  console.error('Error no controlado:', error);

  if (response.headersSent) {
    return;
  }

  response.status(500).render('errors/500', {
    pageTitle: 'Error interno',
    errorMessage: env.isDevelopment ? error.message : null,
  });
}
