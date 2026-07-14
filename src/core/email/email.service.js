import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const testOutbox = [];
let captureForTests = false;

export async function sendEmailVerification({ recipient, verificationUrl }) {
  if (captureForTests) {
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

export function enableTestEmailOutbox() {
  captureForTests = true;
  testOutbox.length = 0;
}

export function disableTestEmailOutbox() {
  captureForTests = false;
  testOutbox.length = 0;
}

export function readTestEmailOutbox() {
  return testOutbox.map((message) => ({ ...message }));
}

export function clearTestEmailOutbox() {
  testOutbox.length = 0;
}
