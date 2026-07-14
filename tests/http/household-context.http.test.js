import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { hashPassword } from '../../src/core/security/password.js';
import { HOUSEHOLD_ROLES } from '../../src/modules/households/household.roles.js';

const TEST_SUFFIX = `${Date.now()}`;
const MEMBER_EMAIL = `household-member-${TEST_SUFFIX}@mendofinanzas.local`;
const OUTSIDER_EMAIL = `household-outsider-${TEST_SUFFIX}@mendofinanzas.local`;
const TEST_PASSWORD = 'Frase segura para espacios 2026';

let server;
let baseUrl;
let memberUser;
let outsiderUser;
let memberHousehold;
let outsiderHousehold;

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

async function cleanupFixtures() {
  const users = await prisma.user.findMany({
    where: { email: { in: [MEMBER_EMAIL, OUTSIDER_EMAIL] } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);

  if (userIds.length > 0) {
    await prisma.household.deleteMany({ where: { createdBy: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function login(email) {
  const loginPage = await request('/auth/login');
  const loginHtml = await loginPage.text();
  const initialCookie = parseCookie(loginPage.headers.get('set-cookie'));
  const csrfToken = extractCsrfToken(loginHtml);

  const response = await request('/auth/login', {
    method: 'POST',
    cookie: initialCookie,
    form: {
      _csrf: csrfToken,
      email,
      password: TEST_PASSWORD,
    },
  });

  assert.equal(response.status, 303);
  return parseCookie(response.headers.get('set-cookie'));
}

before(async () => {
  await prisma.session.deleteMany();
  await cleanupFixtures();

  const passwordHash = await hashPassword(TEST_PASSWORD);
  [memberUser, outsiderUser] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Miembro autorizado',
        email: MEMBER_EMAIL,
        passwordHash,
        status: 1,
        emailVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: 'Usuario externo',
        email: OUTSIDER_EMAIL,
        passwordHash,
        status: 1,
        emailVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    }),
  ]);

  [memberHousehold, outsiderHousehold] = await Promise.all([
    prisma.household.create({
      data: {
        name: `Espacio autorizado ${TEST_SUFFIX}`,
        currency: 'USD',
        createdBy: memberUser.id,
      },
    }),
    prisma.household.create({
      data: {
        name: `Espacio privado ${TEST_SUFFIX}`,
        currency: 'USD',
        createdBy: outsiderUser.id,
      },
    }),
  ]);

  await prisma.householdMember.createMany({
    data: [
      {
        householdId: memberHousehold.id,
        userId: memberUser.id,
        role: HOUSEHOLD_ROLES.OWNER,
      },
      {
        householdId: outsiderHousehold.id,
        userId: outsiderUser.id,
        role: HOUSEHOLD_ROLES.OWNER,
      },
    ],
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await prisma.session.deleteMany();
  await cleanupFixtures();

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

test('la selección solo muestra membresías y rechaza espacios ajenos', async () => {
  let cookie = await login(MEMBER_EMAIL);
  assert.ok(cookie);

  const selectionPage = await request('/households/select', { cookie });
  const selectionHtml = await selectionPage.text();
  cookie = parseCookie(selectionPage.headers.get('set-cookie')) ?? cookie;
  const csrfToken = extractCsrfToken(selectionHtml);

  assert.equal(selectionPage.status, 200);
  assert.match(selectionHtml, new RegExp(memberHousehold.name));
  assert.doesNotMatch(selectionHtml, new RegExp(outsiderHousehold.name));

  const denied = await request('/households/select', {
    method: 'POST',
    cookie,
    form: {
      _csrf: csrfToken,
      householdId: outsiderHousehold.id.toString(),
    },
  });
  const deniedBody = await denied.text();

  assert.equal(denied.status, 403);
  assert.match(deniedBody, /No puedes acceder al espacio financiero seleccionado/);
  assert.doesNotMatch(deniedBody, new RegExp(outsiderHousehold.name));

  const sessionAfterDenial = (await prisma.session.findMany()).find(
    ({ sess }) => sess.userId === memberUser.id.toString(),
  );
  assert.ok(sessionAfterDenial);
  assert.equal(sessionAfterDenial.sess.householdId, undefined);
});

test('el espacio autorizado persiste y una sesión manipulada se invalida', async () => {
  let cookie = await login(MEMBER_EMAIL);
  assert.ok(cookie);

  const selectionPage = await request('/households/select', { cookie });
  const selectionHtml = await selectionPage.text();
  cookie = parseCookie(selectionPage.headers.get('set-cookie')) ?? cookie;
  const csrfToken = extractCsrfToken(selectionHtml);

  const selected = await request('/households/select', {
    method: 'POST',
    cookie,
    form: {
      _csrf: csrfToken,
      householdId: memberHousehold.id.toString(),
    },
  });

  assert.equal(selected.status, 303);
  assert.equal(selected.headers.get('location'), '/households/current');
  cookie = parseCookie(selected.headers.get('set-cookie')) ?? cookie;

  const activePage = await request('/households/current', { cookie });
  const activeHtml = await activePage.text();
  assert.equal(activePage.status, 200);
  assert.match(activeHtml, new RegExp(memberHousehold.name));
  assert.match(activeHtml, /Propietario/);
  assert.doesNotMatch(activeHtml, new RegExp(outsiderHousehold.name));

  const sessionRecord = (await prisma.session.findMany()).find(
    ({ sess }) =>
      sess.userId === memberUser.id.toString() &&
      sess.householdId === memberHousehold.id.toString(),
  );
  assert.ok(sessionRecord);

  await prisma.session.update({
    where: { sid: sessionRecord.sid },
    data: {
      sess: {
        ...sessionRecord.sess,
        householdId: outsiderHousehold.id.toString(),
      },
    },
  });

  const tamperedRequest = await request('/households/current', { cookie });
  assert.equal(tamperedRequest.status, 303);
  assert.equal(tamperedRequest.headers.get('location'), '/households/select');

  const sanitizedSession = await prisma.session.findUnique({
    where: { sid: sessionRecord.sid },
  });
  assert.ok(sanitizedSession);
  assert.equal(sanitizedSession.sess.householdId, undefined);
});
