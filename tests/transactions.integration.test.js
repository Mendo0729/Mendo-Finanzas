import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { prisma } from '../src/config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../src/core/audit/audit.constants.js';
import * as transactionService from '../src/modules/transactions/transaction.service.js';

const suffix = Date.now().toString();
const emails = [`transactions-a-${suffix}@test.local`, `transactions-b-${suffix}@test.local`];
let userA;
let userB;
let householdA;
let householdB;
let accountA;
let accountB;
let expenseCategoryA;
let incomeCategoryA;
let expenseCategoryB;

function actor(userId, householdId) {
  return { userId, householdId, ipAddress: '127.0.0.1', userAgent: 'node-test' };
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map(({ id }) => id);
  if (ids.length === 0) {
    return;
  }

  await prisma.$executeRawUnsafe('ALTER TABLE "transactions" DISABLE TRIGGER USER');
  try {
    await prisma.household.deleteMany({ where: { createdBy: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "transactions" ENABLE TRIGGER USER');
  }
}

before(async () => {
  await cleanup();
  [userA, userB] = await Promise.all(
    emails.map((email, index) =>
      prisma.user.create({
        data: {
          name: `Usuario transacciones ${index}`,
          email,
          passwordHash: 'TEST_ONLY_HASH',
          status: 1,
        },
      }),
    ),
  );

  [householdA, householdB] = await Promise.all([
    prisma.household.create({
      data: { name: `Transacciones A ${suffix}`, currency: 'USD', createdBy: userA.id },
    }),
    prisma.household.create({
      data: { name: `Transacciones B ${suffix}`, currency: 'USD', createdBy: userB.id },
    }),
  ]);

  await prisma.householdMember.createMany({
    data: [
      { householdId: householdA.id, userId: userA.id, role: 1 },
      { householdId: householdB.id, userId: userB.id, role: 1 },
    ],
  });

  [accountA, accountB] = await Promise.all([
    prisma.account.create({
      data: {
        householdId: householdA.id,
        name: `Cuenta A ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.account.create({
      data: {
        householdId: householdB.id,
        name: `Cuenta B ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
  ]);

  [expenseCategoryA, incomeCategoryA, expenseCategoryB] = await Promise.all([
    prisma.category.create({
      data: {
        householdId: householdA.id,
        name: `Gasto A ${suffix}`,
        categoryType: 2,
      },
    }),
    prisma.category.create({
      data: {
        householdId: householdA.id,
        name: `Ingreso A ${suffix}`,
        categoryType: 1,
      },
    }),
    prisma.category.create({
      data: {
        householdId: householdB.id,
        name: `Gasto B ${suffix}`,
        categoryType: 2,
      },
    }),
  ]);
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test('crea un gasto y registra auditoría dentro del espacio activo', async () => {
  const created = await transactionService.createTransaction(
    householdA.id,
    {
      transactionType: 2,
      accountId: accountA.id,
      categoryId: expenseCategoryA.id,
      description: 'Compra de prueba',
      amount: '45.75',
      transactionDate: new Date('2026-07-13T00:00:00.000Z'),
      notes: 'Integración',
    },
    actor(userA.id, householdA.id),
  );

  assert.equal(created.amount, '45.75');
  assert.equal(created.transactionTypeLabel, 'Gasto');
  assert.equal(created.accountId, accountA.id.toString());

  const audit = await prisma.auditLog.findFirst({
    where: {
      householdId: householdA.id,
      entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
      entityId: BigInt(created.id),
      action: AUDIT_ACTIONS.CREATE,
    },
  });
  assert.ok(audit);
  assert.equal(audit.userId, userA.id);
});

test('rechaza cuentas y categorías ajenas o incompatibles', async () => {
  const baseData = {
    transactionType: 2,
    accountId: accountA.id,
    categoryId: expenseCategoryA.id,
    description: 'Intento aislado',
    amount: '10.00',
    transactionDate: new Date('2026-07-13T00:00:00.000Z'),
    notes: null,
  };

  await assert.rejects(
    transactionService.createTransaction(
      householdA.id,
      { ...baseData, accountId: accountB.id },
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'TRANSACTION_ACCOUNT_NOT_FOUND',
  );

  await assert.rejects(
    transactionService.createTransaction(
      householdA.id,
      { ...baseData, categoryId: expenseCategoryB.id },
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'TRANSACTION_CATEGORY_NOT_FOUND',
  );

  await assert.rejects(
    transactionService.createTransaction(
      householdA.id,
      { ...baseData, categoryId: incomeCategoryA.id },
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'TRANSACTION_CATEGORY_NOT_FOUND',
  );
});

test('el listado excluye movimientos anulados y otros espacios', async () => {
  await prisma.transaction.createMany({
    data: [
      {
        householdId: householdA.id,
        accountId: accountA.id,
        categoryId: expenseCategoryA.id,
        createdBy: userA.id,
        transactionType: 2,
        amount: 99,
        description: 'Movimiento anulado',
        transactionDate: new Date('2026-07-12T00:00:00.000Z'),
        deletedAt: new Date(),
      },
      {
        householdId: householdB.id,
        accountId: accountB.id,
        categoryId: expenseCategoryB.id,
        createdBy: userB.id,
        transactionType: 2,
        amount: 88,
        description: 'Movimiento externo',
        transactionDate: new Date('2026-07-12T00:00:00.000Z'),
      },
    ],
  });

  const transactions = await transactionService.listTransactions(householdA.id);
  assert.equal(
    transactions.some(({ description }) => description === 'Movimiento anulado'),
    false,
  );
  assert.equal(
    transactions.some(({ description }) => description === 'Movimiento externo'),
    false,
  );
  assert.equal(
    transactions.some(({ description }) => description === 'Compra de prueba'),
    true,
  );
});
