import { NotFoundError } from '../errors/app-error.js';

export function notFoundHandler(request, _response, next) {
  next(
    new NotFoundError('La página solicitada no existe.', {
      details: { path: request.originalUrl },
    }),
  );
}
