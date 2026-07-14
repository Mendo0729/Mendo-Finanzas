import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const testOutbox = [];
let captureForTests = false;

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildVerificationMessage(verificationUrl) {
  const safeVerificationUrl = escapeHtml(verificationUrl);

  return {
    subject: 'Verifica tu correo en SharedWallet',
    text: [
      'Bienvenido a SharedWallet.',
      '',
      'Verifica tu dirección de correo abriendo el siguiente enlace:',
      verificationUrl,
      '',
      'Este enlace caduca en 30 minutos.',
      '',
      'Si no creaste esta cuenta, puedes ignorar este mensaje.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #101828;">
        <h1 style="font-size: 24px;">Verifica tu correo</h1>
        <p>Bienvenido a <strong>SharedWallet</strong>.</p>
        <p>Para activar tu cuenta, confirma tu dirección de correo:</p>
        <p style="margin: 32px 0;">
          <a
            href="${safeVerificationUrl}"
            style="display: inline-block; padding: 12px 20px; background: #0aaa73; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: 700;"
          >
            Verificar mi correo
          </a>
        </p>
        <p>Este enlace caduca en 30 minutos.</p>
        <p style="font-size: 13px; color: #667085;">
          Si no creaste esta cuenta, puedes ignorar este mensaje.
        </p>
      </div>
    `,
  };
}

async function readProviderResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function sendEmailVerification({ recipient, verificationUrl }) {
  if (captureForTests) {
    testOutbox.push({ recipient, verificationUrl });
    return;
  }

  if (!env.resendApiKey || !env.emailFrom) {
    if (env.isDevelopment) {
      logger.info('Correo de verificación simulado para desarrollo.', {
        recipient,
        verificationUrl,
      });
      return;
    }

    throw new Error('El proveedor de correo no está configurado.');
  }

  const message = buildVerificationMessage(verificationUrl);
  let response;

  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [recipient],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
  } catch (error) {
    logger.error('No se pudo conectar con el proveedor de correo.', {
      recipient,
      provider: 'resend',
      error,
    });
    throw new Error('No se pudo enviar el correo de verificación.');
  }

  const providerResponse = await readProviderResponse(response);

  if (!response.ok || !providerResponse?.id) {
    logger.error('El proveedor rechazó el correo de verificación.', {
      recipient,
      provider: 'resend',
      statusCode: response.status,
      providerError: providerResponse?.message ?? 'Respuesta inválida del proveedor.',
    });
    throw new Error('No se pudo enviar el correo de verificación.');
  }

  logger.info('Correo de verificación enviado.', {
    recipient,
    provider: 'resend',
    messageId: providerResponse.id,
  });
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
