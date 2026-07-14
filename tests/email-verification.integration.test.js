import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, beforeEach, test } from 'node:test';

import { prisma } from '../src/config/database.js';
import {
  clearTestEmailOutbox,
  readTestEmailOutbox,
} from '../src/core/email/email.service.js';
import {
  registerUser,
  resendEmailVerification,
  verifyEmail,
} from '../src/modules/auth/auth.service.js';

const EMAIL_PREFIX = `email-verification-${Date.now()}`;
const TEST_PASSWORD = 'Frase de contraseña segura 2026';

function testEmail(label) {
  return `${EMAIL_PREFIX}-${label}-${randomUUID()}@mendofinanzas.local`;
}

function tokenFromOutbox() {
  const messages = readTestEmailOutbox();
  assert.equal(messages.length, 1);
  const token = new URL(messages[0].verificationUrl).searchParams.get('token');
  assert.ok(token);
  return token;
}

beforeEach(() => {
  clearTestEmailOutbox();
});

after(async () => {
  clearTestEmailOutbox();
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  await prisma.$disconnect();
});

test('un token vencido a los 30 minutos no verifica la cuenta', async () => {
  const email = testEmail('expired');
  await registerUser({ name: 'Token vencido', email, password: TEST_PASSWORD });
  const rawToken = tokenFromOutbox();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = await prisma.authToken.findFirstOrThrow({
    where: { userId: user.id, tokenType: 1 },
  });

  await prisma.authToken.update({
    where: { id: token.id },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });

  await assert.rejects(
    () => verifyEmail(rawToken),
    (error) => error.code === 'EMAIL_VERIFICATION_INVALID' && error.statusCode === 400,
  );

  const unchangedUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.equal(unchangedUser.emailVerifiedAt, null);
});

test('el reenvío invalida el token anterior y permite usar solamente el nuevo', async () => {
  const email = testEmail('resend');
  await registerUser({ name: 'Token reenviado', email, password: TEST_PASSWORD });
  const oldRawToken = tokenFromOutbox();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const oldToken = await prisma.authToken.findFirstOrThrow({
    where: { userId: user.id, tokenType: 1 },
  });

  clearTestEmailOutbox();
  assert.equal(await resendEmailVerification(email), true);
  const newRawToken = tokenFromOutbox();
  assert.notEqual(newRawToken, oldRawToken);

  const invalidatedOldToken = await prisma.authToken.findUniqueOrThrow({
    where: { id: oldToken.id },
  });
  assert.ok(invalidatedOldToken.usedAt);

  await assert.rejects(
    () => verifyEmail(oldRawToken),
    (error) => error.code === 'EMAIL_VERIFICATION_INVALID',
  );

  await verifyEmail(newRawToken);
  const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.ok(verifiedUser.emailVerifiedAt);
});

test('el reenvío mantiene una respuesta interna neutra para cuentas ausentes o verificadas', async () => {
  const missingEmail = testEmail('missing');
  assert.equal(await resendEmailVerification(missingEmail), false);
  assert.deepEqual(readTestEmailOutbox(), []);

  const verifiedEmail = testEmail('verified');
  await registerUser({ name: 'Cuenta verificada', email: verifiedEmail, password: TEST_PASSWORD });
  const rawToken = tokenFromOutbox();
  await verifyEmail(rawToken);

  clearTestEmailOutbox();
  assert.equal(await resendEmailVerification(verifiedEmail), false);
  assert.deepEqual(readTestEmailOutbox(), []);
});
