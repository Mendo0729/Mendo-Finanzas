import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const baseEnvironment = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '3000',
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/finanzas',
  SESSION_SECRET: 'development-session-secret-with-more-than-32-characters',
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  RESEND_API_KEY: 're_test_api_key',
  EMAIL_FROM: 'SharedWallet <no-reply@mail.example.com>',
};

function runScript(source, environment = baseEnvironment) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: process.cwd(),
    env: environment,
    encoding: 'utf8',
  });
}

test('envía la verificación mediante la API de Resend cuando está configurada', () => {
  const result = runScript(`
    import assert from 'node:assert/strict';

    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ id: 'email_test_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const { sendEmailVerification } = await import('./src/core/email/email.service.js');
    await sendEmailVerification({
      recipient: 'usuario@example.com',
      verificationUrl: 'http://localhost:3000/auth/verify-email?token=abc&next=<dashboard>',
    });

    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer re_test_api_key');

    const body = JSON.parse(request.options.body);
    assert.equal(body.from, 'SharedWallet <no-reply@mail.example.com>');
    assert.deepEqual(body.to, ['usuario@example.com']);
    assert.match(body.subject, /SharedWallet/);
    assert.match(body.text, /token=abc&next=<dashboard>/);
    assert.match(body.html, /token=abc&amp;next=&lt;dashboard&gt;/);
  `);

  assert.equal(result.status, 0, result.stderr);
});

test('devuelve un error genérico cuando Resend rechaza el correo', () => {
  const result = runScript(`
    import assert from 'node:assert/strict';

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'invalid api key' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });

    const { sendEmailVerification } = await import('./src/core/email/email.service.js');
    await assert.rejects(
      sendEmailVerification({
        recipient: 'usuario@example.com',
        verificationUrl: 'http://localhost:3000/auth/verify-email?token=abc',
      }),
      /No se pudo enviar el correo de verificación/,
    );
  `);

  assert.equal(result.status, 0, result.stderr);
});

test('mantiene la simulación local cuando no hay proveedor configurado', () => {
  const result = runScript(
    `
      globalThis.fetch = async () => {
        throw new Error('fetch no debe ejecutarse');
      };

      const { sendEmailVerification } = await import('./src/core/email/email.service.js');
      await sendEmailVerification({
        recipient: 'usuario@example.com',
        verificationUrl: 'http://localhost:3000/auth/verify-email?token=abc',
      });
    `,
    {
      ...baseEnvironment,
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
    },
  );

  assert.equal(result.status, 0, result.stderr);
});
