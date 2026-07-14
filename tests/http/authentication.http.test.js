import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';

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
  await prisma.rateLimitBucket.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

test('el registro requiere CSRF, guarda Argon2id y crea una sesión PostgreSQL', async () => {
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
  assert.equal(registered.headers.get('location'), '/');
  cookie = parseCookie(registered.headers.get('set-cookie')) ?? cookie;

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  assert.ok(user);
  assert.match(user.passwordHash, /^\$argon2id\$/);
  assert.notEqual(user.passwordHash, TEST_PASSWORD);

  const sessions = await prisma.session.findMany();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sess.userId, user.id.toString());

  const authenticatedHome = await request('/', { cookie });
  const authenticatedHtml = await authenticatedHome.text();
  assert.equal(authenticatedHome.headers.get('cache-control'), 'no-store');
  assert.match(authenticatedHtml, /Usuario de prueba/);

  const logoutToken = extractCsrfToken(authenticatedHtml);
  const loggedOut = await request('/auth/logout', {
    method: 'POST',
    cookie,
    form: { _csrf: logoutToken },
  });
  assert.equal(loggedOut.status, 303);

  const anonymousHome = await request('/', { cookie });
  assert.doesNotMatch(await anonymousHome.text(), /Sesión activa como/);
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
