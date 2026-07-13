function createSchemaError(path, message) {
  const error = new Error(message);
  error.issues = [{ path: [path], message }];
  return error;
}

export const mfaCodeSchema = Object.freeze({
  parse(value) {
    const token = typeof value?.token === 'string' ? value.token.replace(/\s+/g, '') : '';
    if (!/^\d{6}$/.test(token)) {
      throw createSchemaError('token', 'Ingresa el código de 6 dígitos de tu aplicación.');
    }
    return { token };
  },
});

export const passwordConfirmationSchema = Object.freeze({
  parse(value) {
    const password = typeof value?.password === 'string' ? value.password : '';
    if (password.length === 0 || password.length > 128) {
      throw createSchemaError('password', 'Ingresa tu contraseña actual.');
    }
    return { password };
  },
});
