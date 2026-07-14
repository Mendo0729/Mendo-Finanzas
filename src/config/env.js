import 'dotenv/config';

const requiredVariables = ['DATABASE_URL', 'SESSION_SECRET', 'MFA_ENCRYPTION_KEY'];
const validNodeEnvironments = new Set(['development', 'test', 'production']);
const insecureProductionSessionSecrets = new Set([
  'change_this_with_a_random_secret_of_at_least_32_characters',
  'ci_only_session_secret_with_at_least_32_characters',
]);
const insecureProductionMfaKeys = new Set(['MDEyMzQ1Njc4OUFCQ0RFRjAxMjM0NTY3ODlBQkNERUY=']);

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Falta la variable de entorno obligatoria: ${variableName}`);
  }
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const sessionSecret = process.env.SESSION_SECRET;
const mfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY;
const rawAppUrl = process.env.APP_URL ?? `http://localhost:${port}`;
const resendApiKey = process.env.RESEND_API_KEY?.trim() || null;
const emailFrom = process.env.EMAIL_FROM?.trim() || null;

if (!validNodeEnvironments.has(nodeEnv)) {
  throw new Error('NODE_ENV debe ser development, test o production.');
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un número válido entre 1 y 65535.');
}

let parsedAppUrl;
try {
  parsedAppUrl = new URL(rawAppUrl);
} catch {
  throw new Error('APP_URL debe ser una URL válida.');
}

if (!['http:', 'https:'].includes(parsedAppUrl.protocol)) {
  throw new Error('APP_URL debe utilizar el protocolo http o https.');
}

if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET debe contener al menos 32 caracteres.');
}

const decodedMfaKey = Buffer.from(mfaEncryptionKey, 'base64');
if (decodedMfaKey.length !== 32) {
  throw new Error('MFA_ENCRYPTION_KEY debe ser una clave de 32 bytes codificada en Base64.');
}

if (Boolean(resendApiKey) !== Boolean(emailFrom)) {
  throw new Error('RESEND_API_KEY y EMAIL_FROM deben configurarse juntas.');
}

const isProduction = nodeEnv === 'production';
if (isProduction) {
  if (parsedAppUrl.protocol !== 'https:') {
    throw new Error('APP_URL debe utilizar HTTPS en producción.');
  }
  if (insecureProductionSessionSecrets.has(sessionSecret)) {
    throw new Error('SESSION_SECRET no puede utilizar un valor de ejemplo en producción.');
  }
  if (insecureProductionMfaKeys.has(mfaEncryptionKey)) {
    throw new Error('MFA_ENCRYPTION_KEY no puede utilizar una clave de ejemplo en producción.');
  }
  if (!resendApiKey || !emailFrom) {
    throw new Error('La configuración de correo es obligatoria en producción.');
  }
}

export const env = Object.freeze({
  nodeEnv,
  port,
  appUrl: parsedAppUrl.toString(),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret,
  mfaEncryptionKey,
  resendApiKey,
  emailFrom,
  isDevelopment: nodeEnv === 'development',
  isProduction,
});
