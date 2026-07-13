import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { prisma } from '../src/config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../src/core/audit/audit.constants.js';
import { TRANSACTION_STATUSES } from '../src/modules/transactions/transaction.constants.js';
import * as transactionService from '../src/modules/transactions/transaction.service.js';

const suffix = Date.now().toString();
const emails = [`lifecycle-a-${suffix}@test.local`, `lifecycle-b-${suffix}@test.local`];
let userA;
let userB;
let householdA;
let householdB;
let accountA;
let secondAccountA;
let accountB;
let expenseCategoryA;
let incomeCategoryA;

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

async function createExpense(description) {
  return transactionService.createTransaction(
    householdA.id,
    {
      transactionType: 2,
      accountId: accountA.id,
      categoryId: expenseCategoryA.id,
      description,
      amount: '25.00',
      transactionDate: new Date('2026-07-13T00:00:00.000Z'),
      notes: 'Movimiento para pruebas de ciclo de vida',
    },
    actor(userA.id, householdA.id),
  );
}

before(async () => {
  await cleanup();
  [userA, userB] = await Promise.all(
    emails.map((email, index) =>
      prisma.user.create({
        data: {
          name: `Usuario ciclo ${index}`,
          email,
          passwordHash: 'TEST_ONLY_HASH',
          status: 1,
        },
      }),
    ),
  );

  [householdA, householdB] = await Promise.all([
    prisma.household.create({
      data: { name: `Ciclo A ${suffix}`, currency: 'USD', createdBy: userA.id },
    }),
    prisma.household.create({
      data: { name: `Ciclo B ${suffix}`, currency: 'USD', createdBy: userB.id },
    }),
  ]);

  await prisma.householdMember.createMany({
    data: [
      { householdId: householdA.id, userId: userA.id, role: 1 },
      { householdId: householdB.id, userId: userB.id, role: 1 },
    ],
  });

  [accountA, secondAccountA, accountB] = await Promise.all([
    prisma.account.create({
      data: {
        householdId: householdA.id,
        name: `Cuenta principal ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.account.create({
      data: {
        householdId: householdA.id,
        name: `Cuenta secundaria ${suffix}`,
        accountType: 1,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.account.create({
      data: {
        householdId: householdB.id,
        name: `Cuenta externa ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
  ]);

  [expenseCategoryA, incomeCategoryA] = await Promise.all([
    prisma.category.create({
      data: {
        householdId: householdA.id,
        name: `Gasto ciclo ${suffix}`,
        categoryType: 2,
      },
    }),
    prisma.category.create({
      data: {
        householdId: householdA.id,
        name: `Ingreso ciclo ${suffix}`,
        categoryType: 1,
      },
    }),
  ]);
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test(
  'consulta el detalle sin revelar movimientos de otros espacios ni transferencias',
  async () => {
    const created = await createExpense(`Detalle ${suffix}`);
    const detail = await transactionService.requireTransaction(householdA.id, BigInt(created.id));

    assert.equal(detail.id, created.id);
    assert.equal(detail.account.name, accountA.name);
    assert.equal(detail.creator.name, userA.name);

    await assert.rejects(
      transactionService.requireTransaction(householdB.id, BigInt(created.id)),
      (error) => error.code === 'TRANSACTION_NOT_FOUND',
    );

    const transfer = await prisma.transaction.create({
      data: {
        householdId: householdA.id,
        accountId: accountA.id,
        categoryId: null,
        createdBy: userA.id,
        transactionType: 3,
        amount: 10,
        description: 'Transferencia reservada',
        transactionDate: new Date('2026-07-13T00:00:00.000Z'),
        transferGroupId: randomUUID(),
      },
    });

    await assert.rejects(
      transactionService.requireTransaction(householdA.id, transfer.id),
      (error) => error.code === 'TRANSACTION_NOT_FOUND',
    );
  },
);

test('edita un movimiento y conserva valores anteriores y nuevos en auditoría', async () => {
  const created = await createExpense(`Editar ${suffix}`);
  const updated = await transactionService.updateTransaction(
    householdA.id,
    BigInt(created.id),
    {
      transactionType: 1,
      accountId: secondAccountA.id,
      categoryId: incomeCategoryA.id,
      description: `Ingreso editado ${suffix}`,
      amount: '80.50',
      transactionDate: new Date('2026-07-14T00:00:00.000Z'),
      notes: 'Cambio controlado',
    },
    actor(userA.id, householdA.id),
  );

  assert.equal(updated.transactionType, 1);
  assert.equal(updated.amount, '80.50');
  assert.equal(updated.accountId, secondAccountA.id.toString());
  assert.equal(updated.categoryId, incomeCategoryA.id.toString());

  const audit = await prisma.auditLog.findFirst({
    where: {
      householdId: householdA.id,
      entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
      entityId: BigInt(created.id),
      action: AUDIT_ACTIONS.UPDATE,
    },
  });

  assert.ok(audit);
  assert.equal(Number(audit.metadata.before.amount), 25);
  assert.equal(Number(audit.metadata.after.amount), 80.5);
  assert.equal(audit.metadata.before.transactionType, 2);
  assert.equal(audit.metadata.after.transactionType, 1);

  await assert.rejects(
    transactionService.updateTransaction(
      householdB.id,
      BigInt(created.id),
      {
        transactionType: 2,
        accountId: accountB.id,
        categoryId: expenseCategoryA.id,
        description: 'Intento externo',
        amount: '1.00',
        transactionDate: new Date('2026-07-14T00:00:00.000Z'),
        notes: null,
      },
      actor(userB.id, householdB.id),
    ),
    (error) => error.code === 'TRANSACTION_NOT_FOUND',
  );
});

test('anula lógicamente el movimiento, lo excluye del listado y registra auditoría', async () => {
  const created = await createExpense(`Anular ${suffix}`);
  const voided = await transactionService.voidTransaction(
    householdA.id,
    BigInt(created.id),
    actor(userA.id, householdA.id),
  );

  assert.equal(voided.status, TRANSACTION_STATUSES.VOIDED);
  assert.ok(voided.deletedAt);

  const stored = await prisma.transaction.findUnique({ where: { id: BigInt(created.id) } });
  assert.equal(stored.status, TRANSACTION_STATUSES.VOIDED);
  assert.ok(stored.deletedAt);

  const listed = await transactionService.listTransactions(householdA.id);
  assert.equal(listed.some(({ id }) => id === created.id), false);

  await assert.rejects(
    transactionService.requireTransaction(householdA.id, BigInt(created.id)),
    (error) => error.code === 'TRANSACTION_NOT_FOUND',
  );

  const audit = await prisma.auditLog.findFirst({
    where: {
      householdId: householdA.id,
      entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
      entityId: BigInt(created.id),
      action: AUDIT_ACTIONS.VOID,
    },
  });

  assert.ok(audit);
  assert.equal(audit.metadata.before.status, TRANSACTION_STATUSES.CONFIRMED);
  assert.equal(audit.metadata.after.status, TRANSACTION_STATUSES.VOIDED);
  assert.ok(audit.metadata.after.deletedAt);
});
