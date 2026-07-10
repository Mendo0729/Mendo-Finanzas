export class AppError extends Error {
  constructor(
    message,
    { statusCode = 500, code = 'INTERNAL_ERROR', expose = false, details = null, cause } = {},
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
    this.details = details;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Los datos enviados no son válidos.', options = {}) {
    super(message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      expose: true,
      ...options,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Debes iniciar sesión para continuar.', options = {}) {
    super(message, {
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      expose: true,
      ...options,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta acción.', options = {}) {
    super(message, {
      statusCode: 403,
      code: 'FORBIDDEN',
      expose: true,
      ...options,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no existe.', options = {}) {
    super(message, {
      statusCode: 404,
      code: 'NOT_FOUND',
      expose: true,
      ...options,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'La operación entra en conflicto con el estado actual.', options = {}) {
    super(message, {
      statusCode: 409,
      code: 'CONFLICT',
      expose: true,
      ...options,
    });
  }
}
