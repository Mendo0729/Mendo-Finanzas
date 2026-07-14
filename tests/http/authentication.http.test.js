import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import {
  clearTestEmailOutbox,
  disableTestEmailOutbox,
  enableTestEmailOutbox,
  readTestEmailOutbox,
} from '../../src/core/email/email.service.js';

const TEST_EMAIL = `auth-${Date.now()}@mendofinanzas.local`;
const TEST_PASSWORD = 'Frase de contraseña segura 2026';

let server;
let baseUrl;

function parseCookie(setCookieHeader) {
  return setCookieHeader?.split(';', 1)[0] ?? null;
}

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, 'La página debe incluir un token CSRF.');
  return match[1];
}

function verificationTokenFromOutbox() {
  const messages = readTestEmailOutbox();
  assert.equal(messages.length, 1);
  const verificationUrl = new URL(messages[0].verificationUrl);
  const token = verificationUrl.searchParams.get('token');
  assert.ok(token);
  return token;
}

async function request(path, { cookie, form, method = 'GET', redirect = 'manual' } = {}) {
  const headers = {};
  let body;

  if (cookie) {
    headers.cookie = cookie;
  }

  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form);
  }

  return fetch(`${baseUrl}${path}`, { method, headers, body, redirect });
}

before(async () => {
  enableTestEmailOutbox();
  await prisma.rateLimitBucket.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  clearTestEmailOutbox();
  await prisma.rateLimitBucket.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  disableTestEmailOutbox();
  await prisma.$disconnect();
});

test('el registro exige verificar el correo antes de crear una sesión autenticada', async () => {
  const registerPage = await request('/auth/register');
  const registerHtml = await registerPage.text();
  let cookie = parseCookie(registerPage.headers.get('set-cookie'));
  const csrfToken = extractCsrfToken(registerHtml);

  assert.equal(registerPage.status, 200);
  assert.equal(registerPage.headers.get('cache-control'), 'no-store');
  assert.ok(cookie);

  const rejected = await request('/auth/register', {
    method: 'POST',
    cookie,
    form: {
      name: 'Usuario de prueba',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      passwordConfirmation: TEST_PASSWORD,
    },
  });
  assert.equal(rejected.status, 403);

  const registered = await request('/auth/register', {
    method: 'POST',
    cookie,
    form: {
      _csrf: csrfToken,
      name: 'Usuario de prueba',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      passwordConfirmation: TEST_PASSWORD,
    },
  });

  assert.equal(registered.status, 303);
  assert.equal(registered.headers.get('location'), '/auth/verify-email/pending');
  cookie = parseCookie(registered.headers.get('set-cookie')) ?? cookie;

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  assert.ok(user);
  assert.equal(user.emailVerifiedAt, null);
  assert.match(user.passwordHash, /^\$argon2id\$/);
  assert.notEqual(user.passwordHash, TEST_PASSWORD);

  const verificationToken = await prisma.authToken.findFirstOrThrow({
    where: { userId: user.id, tokenType: 1 },
  });
  assert.equal(verificationToken.tokenHash.length, 64);
  assert.equal(verificationToken.usedAt, null);
  const remainingMs = verificationToken.expiresAt.getTime() - Date.now();
  assert.ok(remainingMs > 29 * 60 * 1000 && remainingMs <= 30 * 60 * 1000);

  const guestSessions = await prisma.session.findMany();
  assert.equal(guestSessions.length, 1);
  assert.equal(guestSessions[0].sess.userId, undefined);

  const loginPage = await request('/auth/login', { cookie });
  const loginToken = extractCsrfToken(await loginPage.text());
  const unverifiedLogin = await request('/auth/login', {
    method: 'POST',
    cookie,
    form: {
      _csrf: loginToken,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    },
  });
  assert.equal(unverifiedLogin.status, 303);
  assert.equal(unverifiedLogin.headers.get('location'), '/auth/verify-email/pending');

  const rawToken = verificationTokenFromOutbox();
  assert.notEqual(verificationToken.tokenHash, rawToken);
  const verified = await request(`/auth/verify-email?token=${encodeURIComponent(rawToken)}`, {
    cookie,
  });
  const verifiedHtml = await verified.text();
  assert.equal(verified.status, 200);
  assert.match(verifiedHtml, /Correo verificado/);

  const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
  assert.ok(verifiedUser.emailVerifiedAt);
  const consumedToken = await prisma.authToken.findUniqueOrThrow({
    where: { id: verificationToken.id },
  });
  assert.ok(consumedToken.usedAt);
});

test('el login usa un mensaje genérico y regenera la sesión al autenticar', async () => {
  const loginPage = await request('/auth/login');
  const loginHtml = await loginPage.text();
  let cookie = parseCookie(loginPage.headers.get('set-cookie'));
  const firstToken = extractCsrfToken(loginHtml);

  assert.equal(loginPage.headers.get('cache-control'), 'no-store');

  const rejected = await request('/auth/login', {
    method: 'POST',
    cookie,
    form: {
      _csrf: firstToken,
      email: TEST_EMAIL,
      password: 'contraseña incorrecta',
    },
  });
  const rejectedHtml = await rejected.text();
  assert.equal(rejected.status, 401);
  assert.match(rejectedHtml, /Correo o contraseña incorrectos/);
  assert.doesNotMatch(rejectedHtml, /Usuario de prueba/);

  const retryPage = await request('/auth/login', { cookie });
  const retryHtml = await retryPage.text();
  cookie = parseCookie(retryPage.headers.get('set-cookie')) ?? cookie;
  const retryToken = extractCsrfToken(retryHtml);

  const loggedIn = await request('/auth/login', {
    method: 'POST',
    cookie,
    form: {
      _csrf: retryToken,
      email: TEST_EMAIL.toUpperCase(),
      password: TEST_PASSWORD,
    },
  });

  assert.equal(loggedIn.status, 303);
  assert.equal(loggedIn.headers.get('location'), '/');
  const authenticatedCookie = parseCookie(loggedIn.headers.get('set-cookie'));
  assert.ok(authenticatedCookie);
  assert.notEqual(authenticatedCookie, cookie);

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  assert.ok(user.lastLoginAt);
});
