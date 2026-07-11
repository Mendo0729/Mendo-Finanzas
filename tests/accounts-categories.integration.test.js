import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { prisma } from '../src/config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../src/core/audit/audit.constants.js';
import * as accountService from '../src/modules/accounts/account.service.js';
import * as categoryService from '../src/modules/categories/category.service.js';

const suffix = Date.now().toString();
const emails = [`resources-a-${suffix}@test.local`, `resources-b-${suffix}@test.local`];
let userA;
let userB;
let householdA;
let householdB;

function actor(userId, householdId) {
  return { userId, householdId, ipAddress: '127.0.0.1', userAgent: 'node-test' };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map(({ id }) => id);
  if (ids.length > 0) {
    await prisma.household.deleteMany({ where: { createdBy: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

before(async () => {
  await cleanup();
  [userA, userB] = await Promise.all(
    emails.map((email, index) =>
      prisma.user.create({
        data: {
          name: `Usuario recursos ${index}`,
          email,
          passwordHash: 'TEST_ONLY_HASH',
          status: 1,
        },
      }),
    ),
  );

  [householdA, householdB] = await Promise.all([
    prisma.household.create({ data: { name: `Recursos A ${suffix}`, currency: 'USD', createdBy: userA.id } }),
    prisma.household.create({ data: { name: `Recursos B ${suffix}`, currency: 'USD', createdBy: userB.id } }),
  ]);

  await prisma.householdMember.createMany({
    data: [
      { householdId: householdA.id, userId: userA.id, role: 1 },
      { householdId: householdB.id, userId: userB.id, role: 1 },
    ],
  });
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test('las cuentas se aíslan por espacio y cada mutación genera auditoría', async () => {
  const created = await accountService.createAccount(
    householdA.id,
    {
      name: `Cuenta prueba ${suffix}`,
      accountType: 2,
      currency: 'USD',
      initialBalance: '125.50',
      creditLimit: null,
      closingDay: null,
      paymentDay: null,
    },
    actor(userA.id, householdA.id),
  );

  await assert.rejects(
    accountService.requireAccount(householdB.id, BigInt(created.id)),
    (error) => error.code === 'ACCOUNT_NOT_FOUND',
  );

  await accountService.setAccountActive(
    householdA.id,
    BigInt(created.id),
    false,
    actor(userA.id, householdA.id),
  );

  const logs = await prisma.auditLog.findMany({
    where: {
      householdId: householdA.id,
      entityType: AUDIT_ENTITY_TYPES.ACCOUNT,
      entityId: BigInt(created.id),
    },
    orderBy: { createdAt: 'asc' },
  });

  assert.deepEqual(
    logs.map(({ action }) => action),
    [AUDIT_ACTIONS.CREATE, AUDIT_ACTIONS.DEACTIVATE],
  );
  assert.equal(logs.every(({ userId }) => userId === userA.id), true);
});

test('las categorías respetan conflictos, uso y auditoría', async () => {
  const category = await categoryService.createCategory(
    householdA.id,
    { name: `Categoría prueba ${suffix}`, categoryType: 2, icon: 'test' },
    actor(userA.id, householdA.id),
  );

  await assert.rejects(
    categoryService.createCategory(
      householdA.id,
      { name: category.name, categoryType: 2, icon: null },
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'CATEGORY_NAME_CONFLICT',
  );

  const account = await prisma.account.create({
    data: {
      householdId: householdA.id,
      name: `Cuenta categoría ${suffix}`,
      accountType: 1,
      currency: 'USD',
      initialBalance: 0,
    },
  });
  await prisma.transaction.create({
    data: {
      householdId: householdA.id,
      accountId: account.id,
      categoryId: BigInt(category.id),
      createdBy: userA.id,
      transactionType: 2,
      amount: 10,
      description: 'Movimiento de prueba',
      transactionDate: new Date('2026-01-01'),
    },
  });

  await assert.rejects(
    categoryService.setCategoryActive(
      householdA.id,
      BigInt(category.id),
      false,
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'CATEGORY_IN_USE',
  );

  const createLog = await prisma.auditLog.findFirst({
    where: {
      householdId: householdA.id,
      entityType: AUDIT_ENTITY_TYPES.CATEGORY,
      entityId: BigInt(category.id),
      action: AUDIT_ACTIONS.CREATE,
    },
  });
  assert.ok(createLog);
});
