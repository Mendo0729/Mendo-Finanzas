import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const validProductionEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '3000',
  APP_URL: 'https://finanzas.example.com',
  DATABASE_URL: 'postgresql://user:password@database.example.com:5432/finanzas',
  SESSION_SECRET: 'production-session-secret-with-more-than-32-characters',
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  RESEND_API_KEY: 're_test_api_key',
  EMAIL_FROM: 'SharedWallet <no-reply@mail.example.com>',
};

function runModule(modulePath, environment) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import('${modulePath}')`],
    {
      cwd: process.cwd(),
      env: environment,
      encoding: 'utf8',
    },
  );
}

test('acepta una configuración productiva válida', () => {
  const result = runModule('./src/config/env.js', validProductionEnvironment);
  assert.equal(result.status, 0, result.stderr);
});

test('rechaza HTTP y secretos de ejemplo en producción', () => {
  const insecureUrl = runModule('./src/config/env.js', {
    ...validProductionEnvironment,
    APP_URL: 'http://finanzas.example.com',
  });
  assert.notEqual(insecureUrl.status, 0);
  assert.match(insecureUrl.stderr, /HTTPS en producción/);

  const insecureSecret = runModule('./src/config/env.js', {
    ...validProductionEnvironment,
    SESSION_SECRET: 'change_this_with_a_random_secret_of_at_least_32_characters',
  });
  assert.notEqual(insecureSecret.status, 0);
  assert.match(insecureSecret.stderr, /valor de ejemplo/);
});

test('requiere la configuración completa de correo en producción', () => {
  const missingEmailConfiguration = runModule('./src/config/env.js', {
    ...validProductionEnvironment,
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
  });
  assert.notEqual(missingEmailConfiguration.status, 0);
  assert.match(missingEmailConfiguration.stderr, /correo es obligatoria en producción/);

  const partialEmailConfiguration = runModule('./src/config/env.js', {
    ...validProductionEnvironment,
    EMAIL_FROM: '',
  });
  assert.notEqual(partialEmailConfiguration.status, 0);
  assert.match(partialEmailConfiguration.stderr, /deben configurarse juntas/);
});

test('rechaza valores desconocidos de NODE_ENV', () => {
  const result = runModule('./src/config/env.js', {
    ...validProductionEnvironment,
    NODE_ENV: 'prod',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /development, test o production/);
});

test('el seed se bloquea en producción antes de conectarse a la base de datos', () => {
  const result = runModule('./prisma/seed-runner.js', validProductionEnvironment);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /solo puede ejecutarse en entornos development o test/);
});
