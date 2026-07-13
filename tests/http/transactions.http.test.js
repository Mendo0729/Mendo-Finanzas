import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { hashPassword } from '../../src/core/security/password.js';
import { HOUSEHOLD_ROLES } from '../../src/modules/households/household.roles.js';

const suffix = Date.now().toString();
const password = 'Frase segura para movimientos 2026';
const roleDefinitions = [
  ['owner', HOUSEHOLD_ROLES.OWNER],
  ['admin', HOUSEHOLD_ROLES.ADMIN],
  ['editor', HOUSEHOLD_ROLES.EDITOR],
  ['viewer', HOUSEHOLD_ROLES.VIEWER],
];
const emails = roleDefinitions.map(([key]) => `transactions-${key}-${suffix}@test.local`);
const outsiderEmail = `transactions-outsider-${suffix}@test.local`;
let server;
let baseUrl;
let users;
let outsiderUser;
let household;
let outsiderHousehold;
let account;
let category;
let outsiderTransaction;

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

async function cleanup() {
  await prisma.session.deleteMany();
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: [...emails, outsiderEmail] } },
    select: { id: true },
  });
  const userIds = existingUsers.map(({ id }) => id);
  if (userIds.length === 0) {
    return;
  }

  await prisma.$executeRawUnsafe('ALTER TABLE "transactions" DISABLE TRIGGER USER');
  try {
    await prisma.household.deleteMany({
      where: { createdBy: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "transactions" ENABLE TRIGGER USER');
  }
}

async function loginAndSelect(email, householdId) {
  const loginPage = await request('/auth/login');
  const loginHtml = await loginPage.text();
  let cookie = parseCookie(loginPage.headers.get('set-cookie'));
  const loginCsrf = extractCsrfToken(loginHtml);

  const loginResponse = await request('/auth/login', {
    method: 'POST',
    cookie,
    form: { _csrf: loginCsrf, email, password },
  });
  assert.equal(loginResponse.status, 303);
  cookie = parseCookie(loginResponse.headers.get('set-cookie')) ?? cookie;

  const selectionPage = await request('/households/select', { cookie });
  const selectionHtml = await selectionPage.text();
  cookie = parseCookie(selectionPage.headers.get('set-cookie')) ?? cookie;
  const selectionCsrf = extractCsrfToken(selectionHtml);

  const selected = await request('/households/select', {
    method: 'POST',
    cookie,
    form: { _csrf: selectionCsrf, householdId: householdId.toString() },
  });
  assert.equal(selected.status, 303);
  return parseCookie(selected.headers.get('set-cookie')) ?? cookie;
}

before(async () => {
  await cleanup();
  const passwordHash = await hashPassword(password);
  users = await Promise.all(
    roleDefinitions.map(([key]) =>
      prisma.user.create({
        data: {
          name: `Usuario ${key} ${suffix}`,
          email: `transactions-${key}-${suffix}@test.local`,
          passwordHash,
          status: 1,
        },
      }),
    ),
  );
  outsiderUser = await prisma.user.create({
    data: {
      name: `Usuario externo ${suffix}`,
      email: outsiderEmail,
      passwordHash,
      status: 1,
    },
  });

  household = await prisma.household.create({
    data: {
      name: `Movimientos HTTP ${suffix}`,
      currency: 'USD',
      createdBy: users[0].id,
    },
  });
  outsiderHousehold = await prisma.household.create({
    data: {
      name: `Movimientos externos ${suffix}`,
      currency: 'USD',
      createdBy: outsiderUser.id,
    },
  });

  await prisma.householdMember.createMany({
    data: [
      ...users.map((user, index) => ({
        householdId: household.id,
        userId: user.id,
        role: roleDefinitions[index][1],
      })),
      {
        householdId: outsiderHousehold.id,
        userId: outsiderUser.id,
        role: HOUSEHOLD_ROLES.OWNER,
      },
    ],
  });

  [account, category] = await Promise.all([
    prisma.account.create({
      data: {
        householdId: household.id,
        name: `Cuenta HTTP ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.category.create({
      data: {
        householdId: household.id,
        name: `Categoría HTTP ${suffix}`,
        categoryType: 2,
      },
    }),
  ]);

  const [outsiderAccount, outsiderCategory] = await Promise.all([
    prisma.account.create({
      data: {
        householdId: outsiderHousehold.id,
        name: `Cuenta externa HTTP ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.category.create({
      data: {
        householdId: outsiderHousehold.id,
        name: `Categoría externa HTTP ${suffix}`,
        categoryType: 2,
      },
    }),
  ]);

  await prisma.transaction.createMany({
    data: [
      {
        householdId: household.id,
        accountId: account.id,
        categoryId: category.id,
        createdBy: users[0].id,
        transactionType: 2,
        amount: '42.50',
        description: 'HTTP objetivo filtrado',
        transactionDate: new Date('2026-07-10T00:00:00.000Z'),
      },
      {
        householdId: household.id,
        accountId: account.id,
        categoryId: category.id,
        createdBy: users[0].id,
        transactionType: 2,
        amount: '10.00',
        description: 'HTTP movimiento no coincidente',
        transactionDate: new Date('2026-07-09T00:00:00.000Z'),
      },
    ],
  });

  outsiderTransaction = await prisma.transaction.create({
    data: {
      householdId: outsiderHousehold.id,
      accountId: outsiderAccount.id,
      categoryId: outsiderCategory.id,
      createdBy: outsiderUser.id,
      transactionType: 2,
      amount: '500.00',
      description: 'HTTP movimiento externo',
      transactionDate: new Date('2026-07-10T00:00:00.000Z'),
    },
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await cleanup();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

test('todos los roles pueden consultar y solo los roles de gestión pueden abrir creación', async () => {
  for (let index = 0; index < users.length; index += 1) {
    const cookie = await loginAndSelect(emails[index], household.id);
    const listResponse = await request('/transactions', { cookie });
    assert.equal(listResponse.status, 200);

    const createResponse = await request('/transactions/new', { cookie });
    const expectedStatus = roleDefinitions[index][1] === HOUSEHOLD_ROLES.VIEWER ? 403 : 200;
    assert.equal(createResponse.status, expectedStatus);
  }
});

test('aplica filtros validados y no muestra movimientos externos', async () => {
  const cookie = await loginAndSelect(emails[0], household.id);
  const response = await request(
    `/transactions?search=objetivo&accountId=${account.id}&categoryId=${category.id}&transactionType=2&minAmount=40&maxAmount=50&fromDate=2026-07-01&toDate=2026-07-31&sort=amount_desc`,
    { cookie },
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /HTTP objetivo filtrado/);
  assert.doesNotMatch(html, /HTTP movimiento no coincidente/);
  assert.doesNotMatch(html, /HTTP movimiento externo/);
  assert.match(html, /1 movimiento/);
});

test('rechaza consultas inválidas y accesos a movimientos de otro espacio', async () => {
  const cookie = await loginAndSelect(emails[0], household.id);
  const invalidQuery = await request('/transactions?page=0', { cookie });
  assert.equal(invalidQuery.status, 400);

  const externalDetail = await request(`/transactions/${outsiderTransaction.id}`, { cookie });
  assert.equal(externalDetail.status, 404);
});

test('viewer no puede crear y una mutación sin CSRF es rechazada', async () => {
  const viewerCookie = await loginAndSelect(emails[3], household.id);
  const viewerList = await request('/transactions', { cookie: viewerCookie });
  const viewerHtml = await viewerList.text();
  const viewerCsrf = extractCsrfToken(viewerHtml);
  const denied = await request('/transactions', {
    method: 'POST',
    cookie: viewerCookie,
    form: {
      _csrf: viewerCsrf,
      transactionType: '2',
      accountId: account.id.toString(),
      categoryId: category.id.toString(),
      description: 'Intento viewer',
      amount: '1.00',
      transactionDate: '2026-07-13',
      notes: '',
    },
  });
  assert.equal(denied.status, 403);

  const ownerCookie = await loginAndSelect(emails[0], household.id);
  const missingCsrf = await request('/transactions', {
    method: 'POST',
    cookie: ownerCookie,
    form: {
      transactionType: '2',
      accountId: account.id.toString(),
      categoryId: category.id.toString(),
      description: 'Intento sin CSRF',
      amount: '1.00',
      transactionDate: '2026-07-13',
      notes: '',
    },
  });
  assert.equal(missingCsrf.status, 403);
});
