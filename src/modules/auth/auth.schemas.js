const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class FormSchemaError extends Error {
  constructor(issues) {
    super('Los datos del formulario no son válidos.');
    this.name = 'FormSchemaError';
    this.issues = issues;
  }
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

export function normalizeEmail(value) {
  return text(value).trim().toLowerCase();
}

export const registerSchema = {
  parse(value) {
    const name = text(value?.name).trim().replace(/\s+/g, ' ');
    const email = normalizeEmail(value?.email);
    const password = text(value?.password);
    const passwordConfirmation = text(value?.passwordConfirmation);
    const issues = [];

    if (name.length < 2 || name.length > 100) {
      issues.push({ path: ['name'], message: 'El nombre debe tener entre 2 y 100 caracteres.' });
    }

    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      issues.push({ path: ['email'], message: 'Ingresa un correo electrónico válido.' });
    }

    if (password.length < 12 || password.length > 128) {
      issues.push({
        path: ['password'],
        message: 'La contraseña debe tener entre 12 y 128 caracteres.',
      });
    }

    if (password !== passwordConfirmation) {
      issues.push({
        path: ['passwordConfirmation'],
        message: 'Las contraseñas no coinciden.',
      });
    }

    if (issues.length > 0) {
      throw new FormSchemaError(issues);
    }

    return { name, email, password };
  },
};

export const loginSchema = {
  parse(value) {
    const email = normalizeEmail(value?.email);
    const password = text(value?.password);
    const issues = [];

    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      issues.push({ path: ['email'], message: 'Ingresa un correo electrónico válido.' });
    }

    if (password.length === 0 || password.length > 128) {
      issues.push({ path: ['password'], message: 'Ingresa tu contraseña.' });
    }

    if (issues.length > 0) {
      throw new FormSchemaError(issues);
    }

    return { email, password };
  },
};
