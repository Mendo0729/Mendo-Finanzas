import 'dotenv/config';

const requiredVariables = ['DATABASE_URL'];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Falta la variable de entorno obligatoria: ${variableName}`);
  }
}

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un número válido entre 1 y 65535.');
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  appUrl: process.env.APP_URL ?? `http://localhost:${port}`,
  databaseUrl: process.env.DATABASE_URL,
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
});
