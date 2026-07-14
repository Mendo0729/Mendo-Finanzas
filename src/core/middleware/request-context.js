import { randomUUID } from 'node:crypto';

import { logger } from '../../config/logger.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,100}$/;

function resolveRequestId(request) {
  const providedRequestId = request.get('x-request-id');

  if (providedRequestId && REQUEST_ID_PATTERN.test(providedRequestId)) {
    return providedRequestId;
  }

  return randomUUID();
}

export function requestContext(request, response, next) {
  const requestId = resolveRequestId(request);
  const startedAt = process.hrtime.bigint();

  request.context = {
    ...(request.context ?? {}),
    requestId,
  };
  response.locals.requestId = requestId;
  response.setHeader('X-Request-ID', requestId);

  response.on('finish', () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNanoseconds) / 1_000_000;

    logger.info('Solicitud HTTP completada.', {
      requestId,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}
