import 'dotenv/config';

const requiredVariables = ['DATABASE_URL', 'SESSION_SECRET', 'MFA_ENCRYPTION_KEY'];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Falta la variable de entorno obligatoria: ${variableName}`);
  }
}

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const sessionSecret = process.env.SESSION_SECRET;
const mfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un número válido entre 1 y 65535.');
}

if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET debe contener al menos 32 caracteres.');
}

let decodedMfaKey;
try {
  decodedMfaKey = Buffer.from(mfaEncryptionKey, 'base64');
} catch {
  decodedMfaKey = null;
}

if (!decodedMfaKey || decodedMfaKey.length !== 32) {
  throw new Error('MFA_ENCRYPTION_KEY debe ser una clave de 32 bytes codificada en Base64.');
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  appUrl: process.env.APP_URL ?? `http://localhost:${port}`,
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret,
  mfaEncryptionKey,
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
});
