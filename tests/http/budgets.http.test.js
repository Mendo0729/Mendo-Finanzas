import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { app } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { hashPassword } from '../../src/core/security/password.js';
import { HOUSEHOLD_ROLES } from '../../src/modules/households/household.roles.js';

const suffix = Date.now().toString();
const password = 'Frase segura para presupuestos 2026';
const roleDefinitions = [
  ['owner', HOUSEHOLD_ROLES.OWNER],
  ['admin', HOUSEHOLD_ROLES.ADMIN],
  ['editor', HOUSEHOLD_ROLES.EDITOR],
  ['viewer', HOUSEHOLD_ROLES.VIEWER],
];
const emails = roleDefinitions.map(([key]) => `budgets-${key}-${suffix}@test.local`);
const outsiderEmail = `budgets-outsider-${suffix}@test.local`;
let server;
let baseUrl;
let users;
let outsiderUser;
let household;
let outsiderHousehold;
let account;
let category;
let secondCategory;
let outsiderBudget;

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

  if (cookie) headers.cookie = cookie;
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
  if (userIds.length === 0) return;

  await prisma.$executeRawUnsafe('ALTER TABLE "transactions" DISABLE TRIGGER USER');
  try {
    await prisma.household.deleteMany({ where: { createdBy: { in: userIds } } });
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
          name: `Usuario presupuesto ${key} ${suffix}`,
          email: `budgets-${key}-${suffix}@test.local`,
          passwordHash,
          status: 1,
          emailVerifiedAt: new Date(),
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  );
  outsiderUser = await prisma.user.create({
    data: {
      name: `Usuario presupuesto externo ${suffix}`,
      email: outsiderEmail,
      passwordHash,
      status: 1,
      emailVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
  });

  household = await prisma.household.create({
    data: { name: `Presupuestos HTTP ${suffix}`, currency: 'USD', createdBy: users[0].id },
  });
  outsiderHousehold = await prisma.household.create({
    data: {
      name: `Presupuestos externos HTTP ${suffix}`,
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

  [account, category, secondCategory] = await Promise.all([
    prisma.account.create({
      data: {
        householdId: household.id,
        name: `Cuenta presupuesto HTTP ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.category.create({
      data: { householdId: household.id, name: `Alimentos HTTP ${suffix}`, categoryType: 2 },
    }),
    prisma.category.create({
      data: { householdId: household.id, name: `Transporte HTTP ${suffix}`, categoryType: 2 },
    }),
  ]);

  const [outsiderCategory, outsiderAccount] = await Promise.all([
    prisma.category.create({
      data: {
        householdId: outsiderHousehold.id,
        name: `Categoría externa presupuesto ${suffix}`,
        categoryType: 2,
      },
    }),
    prisma.account.create({
      data: {
        householdId: outsiderHousehold.id,
        name: `Cuenta externa presupuesto ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
  ]);

  await prisma.budget.create({
    data: {
      householdId: household.id,
      categoryId: category.id,
      monthStart: new Date('2026-07-01T00:00:00.000Z'),
      amount: '100.00',
    },
  });
  outsiderBudget = await prisma.budget.create({
    data: {
      householdId: outsiderHousehold.id,
      categoryId: outsiderCategory.id,
      monthStart: new Date('2026-07-01T00:00:00.000Z'),
      amount: '500.00',
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        householdId: household.id,
        accountId: account.id,
        categoryId: category.id,
        createdBy: users[0].id,
        transactionType: 2,
        amount: '85.00',
        description: 'Gasto presupuesto HTTP',
        transactionDate: new Date('2026-07-10T00:00:00.000Z'),
      },
      {
        householdId: outsiderHousehold.id,
        accountId: outsiderAccount.id,
        categoryId: outsiderCategory.id,
        createdBy: outsiderUser.id,
        transactionType: 2,
        amount: '400.00',
        description: 'Gasto presupuesto externo',
        transactionDate: new Date('2026-07-10T00:00:00.000Z'),
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
  await cleanup();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

test('todos los roles consultan y solo roles de gestión abren creación', async () => {
  for (let index = 0; index < users.length; index += 1) {
    const cookie = await loginAndSelect(emails[index], household.id);
    const listResponse = await request('/budgets?month=2026-07', { cookie });
    assert.equal(listResponse.status, 200);

    const createResponse = await request('/budgets/new?month=2026-07', { cookie });
    const expectedStatus = roleDefinitions[index][1] === HOUSEHOLD_ROLES.VIEWER ? 403 : 200;
    assert.equal(createResponse.status, expectedStatus);
  }
});

test('muestra progreso real sin revelar presupuestos externos', async () => {
  const cookie = await loginAndSelect(emails[0], household.id);
  const response = await request('/budgets?month=2026-07', { cookie });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, new RegExp(category.name));
  assert.match(html, /85%/);
  assert.match(html, /Advertencia/);
  assert.doesNotMatch(html, /Categoría externa presupuesto/);
});

test('owner crea presupuesto y se protege contra CSRF', async () => {
  const cookie = await loginAndSelect(emails[0], household.id);
  const createPage = await request('/budgets/new?month=2026-07', { cookie });
  const createHtml = await createPage.text();
  const csrfToken = extractCsrfToken(createHtml);

  const created = await request('/budgets', {
    method: 'POST',
    cookie,
    form: {
      _csrf: csrfToken,
      categoryId: secondCategory.id.toString(),
      month: '2026-07',
      amount: '200.00',
    },
  });
  assert.equal(created.status, 303);
  assert.equal(created.headers.get('location'), '/budgets?month=2026-07');

  const missingCsrf = await request('/budgets', {
    method: 'POST',
    cookie,
    form: {
      categoryId: secondCategory.id.toString(),
      month: '2026-08',
      amount: '200.00',
    },
  });
  assert.equal(missingCsrf.status, 403);
});

test('viewer no administra y recursos externos devuelven 404', async () => {
  const viewerCookie = await loginAndSelect(emails[3], household.id);
  const listPage = await request('/budgets?month=2026-07', { cookie: viewerCookie });
  const listHtml = await listPage.text();
  const csrfToken = extractCsrfToken(listHtml);

  const denied = await request('/budgets', {
    method: 'POST',
    cookie: viewerCookie,
    form: {
      _csrf: csrfToken,
      categoryId: secondCategory.id.toString(),
      month: '2026-08',
      amount: '100.00',
    },
  });
  assert.equal(denied.status, 403);

  const ownerCookie = await loginAndSelect(emails[0], household.id);
  const externalEdit = await request(`/budgets/${outsiderBudget.id}/edit`, {
    cookie: ownerCookie,
  });
  assert.equal(externalEdit.status, 404);

  const invalidMonth = await request('/budgets?month=2026-13', { cookie: ownerCookie });
  assert.equal(invalidMonth.status, 400);
});
