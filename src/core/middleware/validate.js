import { ValidationError } from '../errors/app-error.js';

function parse(schema, value) {
  if (!schema) {
    return value;
  }

  if (typeof schema === 'function') {
    return schema(value);
  }

  if (typeof schema.parse === 'function') {
    return schema.parse(value);
  }

  throw new TypeError('El esquema debe ser una función o exponer un método parse().');
}

function extractDetails(error) {
  if (Array.isArray(error?.issues)) {
    return error.issues.map((issue) => ({
      path: Array.isArray(issue.path) ? issue.path.join('.') : '',
      message: issue.message,
    }));
  }

  return null;
}

export function validate({ body, params, query } = {}) {
  return function validationMiddleware(request, _response, next) {
    try {
      request.validated = {
        body: parse(body, request.body),
        params: parse(params, request.params),
        query: parse(query, request.query),
      };
      next();
    } catch (error) {
      next(
        new ValidationError('Los datos enviados no son válidos.', {
          details: extractDetails(error),
          cause: error,
        }),
      );
    }
  };
}
