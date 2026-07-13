import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { prisma } from '../src/config/database.js';
import { transactionQuerySchema } from '../src/modules/transactions/transaction.schemas.js';
import * as transactionService from '../src/modules/transactions/transaction.service.js';

const suffix = Date.now().toString();
const emails = [`search-a-${suffix}@test.local`, `search-b-${suffix}@test.local`];
let userA;
let userB;
let householdA;
let householdB;
let accountA;
let accountB;
let externalAccount;
let expenseCategory;
let incomeCategory;
let externalCategory;

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
          name: `Usuario búsqueda ${index}`,
          email,
          passwordHash: 'TEST_ONLY_HASH',
          status: 1,
        },
      }),
    ),
  );

  [householdA, householdB] = await Promise.all([
    prisma.household.create({
      data: {
        name: `Búsqueda A ${suffix}`,
        currency: 'USD',
        createdBy: userA.id,
      },
    }),
    prisma.household.create({
      data: {
        name: `Búsqueda B ${suffix}`,
        currency: 'USD',
        createdBy: userB.id,
      },
    }),
  ]);

  await prisma.householdMember.createMany({
    data: [
      { householdId: householdA.id, userId: userA.id, role: 1 },
      { householdId: householdB.id, userId: userB.id, role: 1 },
    ],
  });

  [accountA, accountB, externalAccount] = await Promise.all([
    prisma.account.create({
      data: {
        householdId: householdA.id,
        name: `Cuenta gastos ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.account.create({
      data: {
        householdId: householdA.id,
        name: `Cuenta ingresos ${suffix}`,
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

  [expenseCategory, incomeCategory, externalCategory] = await Promise.all([
    prisma.category.create({
      data: {
        householdId: householdA.id,
        name: `Gastos ${suffix}`,
        categoryType: 2,
      },
    }),
    prisma.category.create({
      data: {
        householdId: householdA.id,
        name: `Ingresos ${suffix}`,
        categoryType: 1,
      },
    }),
    prisma.category.create({
      data: {
        householdId: householdB.id,
        name: `Externa ${suffix}`,
        categoryType: 2,
      },
    }),
  ]);

  await prisma.transaction.createMany({
    data: [
      ...Array.from({ length: 25 }, (_, index) => ({
        householdId: householdA.id,
        accountId: accountA.id,
        categoryId: expenseCategory.id,
        createdBy: userA.id,
        transactionType: 2,
        amount: `${index + 1}.00`,
        description: `Movimiento paginado ${String(index + 1).padStart(2, '0')}`,
        transactionDate: new Date(`2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
      })),
      {
        householdId: householdA.id,
        accountId: accountB.id,
        categoryId: incomeCategory.id,
        createdBy: userA.id,
        transactionType: 1,
        amount: '99.99',
        description: 'Ingreso Especial de prueba',
        transactionDate: new Date('2026-06-15T00:00:00.000Z'),
      },
      {
        householdId: householdB.id,
        accountId: externalAccount.id,
        categoryId: externalCategory.id,
        createdBy: userB.id,
        transactionType: 2,
        amount: '1000.00',
        description: 'Movimiento externo invisible',
        transactionDate: new Date('2026-06-30T00:00:00.000Z'),
      },
    ],
  });
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test('combina búsqueda y filtros sin revelar movimientos de otros espacios', async () => {
  const filters = transactionQuerySchema.parse({
    search: 'especial',
    fromDate: '2026-06-01',
    toDate: '2026-06-30',
    accountId: accountB.id.toString(),
    categoryId: incomeCategory.id.toString(),
    transactionType: '1',
    minAmount: '90.00',
    maxAmount: '100.00',
  });
  const result = await transactionService.searchTransactions(householdA.id, filters);

  assert.equal(result.pagination.total, 1);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].description, 'Ingreso Especial de prueba');
  assert.equal(result.transactions[0].householdId, householdA.id.toString());
  assert.equal(
    result.transactions.some(({ description }) => description === 'Movimiento externo invisible'),
    false,
  );
});

test('pagina veinte movimientos y conserva un orden determinista', async () => {
  const firstPage = await transactionService.searchTransactions(
    householdA.id,
    transactionQuerySchema.parse({ sort: 'amount_desc', page: '1' }),
  );
  const secondPage = await transactionService.searchTransactions(
    householdA.id,
    transactionQuerySchema.parse({ sort: 'amount_desc', page: '2' }),
  );

  assert.equal(firstPage.pagination.total, 26);
  assert.equal(firstPage.pagination.totalPages, 2);
  assert.equal(firstPage.transactions.length, 20);
  assert.equal(firstPage.transactions[0].description, 'Ingreso Especial de prueba');
  assert.equal(secondPage.transactions.length, 6);
  assert.equal(secondPage.pagination.currentPage, 2);
  assert.equal(secondPage.pagination.hasPreviousPage, true);
  assert.equal(secondPage.pagination.hasNextPage, false);
});

test('normaliza páginas fuera del total a la última página disponible', async () => {
  const result = await transactionService.searchTransactions(
    householdA.id,
    transactionQuerySchema.parse({ page: '999' }),
  );

  assert.equal(result.pagination.currentPage, 2);
  assert.equal(result.transactions.length, 6);
});
