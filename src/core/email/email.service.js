import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const testOutbox = [];

export async function sendEmailVerification({ recipient, verificationUrl }) {
  if (env.nodeEnv === 'test') {
    testOutbox.push({ recipient, verificationUrl });
    return;
  }

  if (env.isDevelopment) {
    logger.info('Correo de verificación simulado para desarrollo.', {
      recipient,
      verificationUrl,
    });
    return;
  }

  throw new Error('El proveedor de correo de producción todavía no está configurado.');
}

export function readTestEmailOutbox() {
  if (env.nodeEnv !== 'test') {
    throw new Error('El buzón de prueba solo está disponible con NODE_ENV=test.');
  }

  return testOutbox.map((message) => ({ ...message }));
}

export function clearTestEmailOutbox() {
  if (env.nodeEnv !== 'test') {
    throw new Error('El buzón de prueba solo está disponible con NODE_ENV=test.');
  }

  testOutbox.length = 0;
}
