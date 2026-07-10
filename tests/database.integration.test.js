import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRANSACTION_TYPES = Object.freeze({
  INCOME: 1,
  EXPENSE: 2,
  TRANSFER_OUT: 3,
  TRANSFER_IN: 4,
});

const TRANSACTION_STATUS = Object.freeze({
  PENDING: 0,
  CONFIRMED: 1,
});

const CATEGORY_TYPES = Object.freeze({
  INCOME: 1,
  EXPENSE: 2,
});

function decimal(value) {
  return new Prisma.Decimal(value);
}

function currentMonthDate(day) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
}

async function getSeedContext() {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'demo@mendofinanzas.local' },
  });
  const household = await prisma.household.findUniqueOrThrow({
    where: {
      createdBy_name: {
        createdBy: user.id,
        name: 'Finanzas personales',
      },
    },
  });
  const accounts = await prisma.account.findMany({ where: { householdId: household.id } });
  const categories = await prisma.category.findMany({ where: { householdId: household.id } });

  return {
    user,
    household,
    accounts: new Map(accounts.map((account) => [account.name, account])),
    categories: new Map(categories.map((category) => [category.name, category])),
  };
}

async function createFixture() {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      name: 'Usuario de prueba',
      email: `database-test-${suffix}@mendofinanzas.local`,
      passwordHash: 'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH',
      status: 1,
    },
  });
  const household = await prisma.household.create({
    data: {
      name: `Pruebas ${suffix}`,
      currency: 'USD',
      createdBy: user.id,
    },
  });

  await prisma.householdMember.create({
    data: {
      householdId: household.id,
      userId: user.id,
      role: 1,
    },
  });

  const [checking, savings] = await Promise.all([
    prisma.account.create({
      data: {
        householdId: household.id,
        name: 'Cuenta principal',
        accountType: 2,
        currency: 'USD',
        initialBalance: decimal('1000.00'),
      },
    }),
    prisma.account.create({
      data: {
        householdId: household.id,
        name: 'Cuenta secundaria',
        accountType: 3,
        currency: 'USD',
        initialBalance: decimal('500.00'),
      },
    }),
  ]);
  const [incomeCategory, expenseCategory] = await Promise.all([
    prisma.category.create({
      data: {
        householdId: household.id,
        name: 'Ingreso de prueba',
        categoryType: CATEGORY_TYPES.INCOME,
      },
    }),
    prisma.category.create({
      data: {
        householdId: household.id,
        name: 'Gasto de prueba',
        categoryType: CATEGORY_TYPES.EXPENSE,
      },
    }),
  ]);

  return {
    user,
    household,
    checking,
    savings,
    incomeCategory,
    expenseCategory,
  };
}

after(async () => {
  await prisma.$disconnect();
});

test('el seed es completo, consistente e idempotente', async () => {
  const { user, household, accounts, categories } = await getSeedContext();
  const membership = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId: household.id,
        userId: user.id,
      },
    },
  });
  const budgets = await prisma.budget.findMany({
    where: {
      householdId: household.id,
      monthStart: currentMonthDate(1),
    },
    include: { category: true },
  });
  const seedTransactions = await prisma.transaction.findMany({
    where: {
      householdId: household.id,
      description: { startsWith: '[SEED]' },
      deletedAt: null,
    },
  });

  assert.equal(membership?.role, 1);
  assert.equal(accounts.size, 5);
  assert.equal(categories.size, 16);
  assert.equal(budgets.length, 5);
  assert.equal(seedTransactions.length, 20);
  assert.equal(
    seedTransactions.filter(({ status }) => status === TRANSACTION_STATUS.PENDING).length,
    1,
  );

  const budgetAmounts = new Map(
    budgets.map(({ amount, category }) => [category.name, amount.toFixed(2)]),
  );

  assert.deepEqual(
    budgetAmounts,
    new Map([
      ['Alimentación', '450.00'],
      ['Transporte', '180.00'],
      ['Servicios', '250.00'],
      ['Entretenimiento', '120.00'],
      ['Suscripciones', '80.00'],
    ]),
  );
});

test('la transferencia del seed contiene dos movimientos equivalentes y opuestos', async () => {
  const { household } = await getSeedContext();
  const transfers = await prisma.transaction.findMany({
    where: {
      householdId: household.id,
      transactionType: {
        in: [TRANSACTION_TYPES.TRANSFER_OUT, TRANSACTION_TYPES.TRANSFER_IN],
      },
      deletedAt: null,
    },
    orderBy: { transactionType: 'asc' },
  });

  assert.equal(transfers.length, 2);
  assert.ok(transfers[0].transferGroupId);
  assert.equal(transfers[0].transferGroupId, transfers[1].transferGroupId);
  assert.equal(transfers[0].amount.toFixed(2), transfers[1].amount.toFixed(2));
  assert.notEqual(transfers[0].accountId, transfers[1].accountId);
  assert.deepEqual(
    transfers.map(({ transactionType }) => transactionType),
    [TRANSACTION_TYPES.TRANSFER_OUT, TRANSACTION_TYPES.TRANSFER_IN],
  );
});

test('las transacciones respetan monto, categoría, membresía y aislamiento por espacio', async () => {
  const seed = await getSeedContext();
  const fixture = await createFixture();
  const baseData = {
    householdId: seed.household.id,
    accountId: seed.accounts.get('Cuenta corriente').id,
    categoryId: seed.categories.get('Alimentación').id,
    createdBy: seed.user.id,
    transactionType: TRANSACTION_TYPES.EXPENSE,
    amount: decimal('10.00'),
    description: '[TEST] Integridad',
    transactionDate: currentMonthDate(21),
    status: TRANSACTION_STATUS.CONFIRMED,
  };

  await assert.rejects(() =>
    prisma.transaction.create({
      data: { ...baseData, amount: decimal('0.00') },
    }),
  );
  await assert.rejects(() =>
    prisma.transaction.create({
      data: { ...baseData, categoryId: null },
    }),
  );
  await assert.rejects(() =>
    prisma.transaction.create({
      data: { ...baseData, categoryId: seed.categories.get('Salario').id },
    }),
  );
  await assert.rejects(() =>
    prisma.transaction.create({
      data: { ...baseData, accountId: fixture.checking.id },
    }),
  );
  await assert.rejects(() =>
    prisma.transaction.create({
      data: { ...baseData, categoryId: fixture.expenseCategory.id },
    }),
  );
  await assert.rejects(() =>
    prisma.transaction.create({
      data: { ...baseData, createdBy: fixture.user.id },
    }),
  );
});

test('los presupuestos solo aceptan categorías de gasto del mismo espacio y primer día del mes', async () => {
  const seed = await getSeedContext();
  const fixture = await createFixture();
  const baseData = {
    householdId: seed.household.id,
    categoryId: seed.categories.get('Otros gastos').id,
    monthStart: currentMonthDate(1),
    amount: decimal('25.00'),
  };

  await assert.rejects(() =>
    prisma.budget.create({
      data: { ...baseData, monthStart: currentMonthDate(2) },
    }),
  );
  await assert.rejects(() =>
    prisma.budget.create({
      data: { ...baseData, categoryId: seed.categories.get('Salario').id },
    }),
  );
  await assert.rejects(() =>
    prisma.budget.create({
      data: { ...baseData, categoryId: fixture.expenseCategory.id },
    }),
  );
});

test('las transferencias se crean y eliminan lógicamente como una pareja atómica', async () => {
  const fixture = await createFixture();
  const transactionDate = currentMonthDate(22);
  const singleGroupId = randomUUID();
  const mismatchGroupId = randomUUID();
  const validGroupId = randomUUID();
  const baseData = {
    householdId: fixture.household.id,
    categoryId: null,
    createdBy: fixture.user.id,
    amount: decimal('75.00'),
    transactionDate,
    status: TRANSACTION_STATUS.CONFIRMED,
  };

  await assert.rejects(() =>
    prisma.transaction.create({
      data: {
        ...baseData,
        accountId: fixture.checking.id,
        transactionType: TRANSACTION_TYPES.TRANSFER_OUT,
        description: '[TEST] Transferencia incompleta',
        transferGroupId: singleGroupId,
      },
    }),
  );

  await assert.rejects(() =>
    prisma.transaction.createMany({
      data: [
        {
          ...baseData,
          accountId: fixture.checking.id,
          transactionType: TRANSACTION_TYPES.TRANSFER_OUT,
          description: '[TEST] Transferencia inconsistente salida',
          transferGroupId: mismatchGroupId,
        },
        {
          ...baseData,
          accountId: fixture.savings.id,
          transactionType: TRANSACTION_TYPES.TRANSFER_IN,
          amount: decimal('74.99'),
          description: '[TEST] Transferencia inconsistente entrada',
          transferGroupId: mismatchGroupId,
        },
      ],
    }),
  );

  await prisma.transaction.createMany({
    data: [
      {
        ...baseData,
        accountId: fixture.checking.id,
        transactionType: TRANSACTION_TYPES.TRANSFER_OUT,
        description: '[TEST] Transferencia válida salida',
        transferGroupId: validGroupId,
      },
      {
        ...baseData,
        accountId: fixture.savings.id,
        transactionType: TRANSACTION_TYPES.TRANSFER_IN,
        description: '[TEST] Transferencia válida entrada',
        transferGroupId: validGroupId,
      },
    ],
  });

  const transferRows = await prisma.transaction.findMany({
    where: { transferGroupId: validGroupId },
    orderBy: { transactionType: 'asc' },
  });

  assert.equal(transferRows.length, 2);
  await assert.rejects(() =>
    prisma.transaction.update({
      where: { id: transferRows[0].id },
      data: { deletedAt: new Date() },
    }),
  );

  const deletedAt = new Date();
  await prisma.transaction.updateMany({
    where: { transferGroupId: validGroupId },
    data: { deletedAt },
  });

  assert.equal(
    await prisma.transaction.count({
      where: { transferGroupId: validGroupId, deletedAt: null },
    }),
    0,
  );
});

test('las transacciones no permiten borrado físico y las categorías usadas quedan protegidas', async () => {
  const seed = await getSeedContext();
  const transaction = await prisma.transaction.create({
    data: {
      householdId: seed.household.id,
      accountId: seed.accounts.get('Efectivo').id,
      categoryId: seed.categories.get('Otros gastos').id,
      createdBy: seed.user.id,
      transactionType: TRANSACTION_TYPES.EXPENSE,
      amount: decimal('5.00'),
      description: '[TEST] Eliminación lógica',
      transactionDate: currentMonthDate(23),
      status: TRANSACTION_STATUS.CONFIRMED,
    },
  });

  await assert.rejects(() =>
    prisma.transaction.delete({
      where: { id: transaction.id },
    }),
  );

  const deletedAt = new Date();
  const softDeleted = await prisma.transaction.update({
    where: { id: transaction.id },
    data: { deletedAt },
  });

  assert.ok(softDeleted.deletedAt);
  await assert.rejects(() =>
    prisma.category.delete({
      where: { id: seed.categories.get('Alimentación').id },
    }),
  );
});
