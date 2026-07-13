import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { prisma } from '../src/config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../src/core/audit/audit.constants.js';
import * as budgetService from '../src/modules/budgets/budget.service.js';

const suffix = Date.now().toString();
const emails = [`budgets-a-${suffix}@test.local`, `budgets-b-${suffix}@test.local`];
const july = new Date('2026-07-01T00:00:00.000Z');
let userA;
let userB;
let householdA;
let householdB;
let accountA;
let accountB;
let expenseCategoryA;
let secondExpenseCategoryA;
let incomeCategoryA;
let expenseCategoryB;
let budgetA;

function actor(userId, householdId) {
  return { userId, householdId, ipAddress: '127.0.0.1', userAgent: 'node-test' };
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map(({ id }) => id);
  if (ids.length === 0) return;

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
          name: `Usuario presupuesto ${index}`,
          email,
          passwordHash: 'TEST_ONLY_HASH',
          status: 1,
        },
      }),
    ),
  );

  [householdA, householdB] = await Promise.all([
    prisma.household.create({
      data: { name: `Presupuestos A ${suffix}`, currency: 'USD', createdBy: userA.id },
    }),
    prisma.household.create({
      data: { name: `Presupuestos B ${suffix}`, currency: 'USD', createdBy: userB.id },
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
        name: `Cuenta presupuesto A ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
    prisma.account.create({
      data: {
        householdId: householdB.id,
        name: `Cuenta presupuesto B ${suffix}`,
        accountType: 2,
        currency: 'USD',
        initialBalance: 0,
      },
    }),
  ]);

  [expenseCategoryA, secondExpenseCategoryA, incomeCategoryA, expenseCategoryB] = await Promise.all([
    prisma.category.create({
      data: { householdId: householdA.id, name: `Alimentos ${suffix}`, categoryType: 2 },
    }),
    prisma.category.create({
      data: { householdId: householdA.id, name: `Transporte ${suffix}`, categoryType: 2 },
    }),
    prisma.category.create({
      data: { householdId: householdA.id, name: `Salario ${suffix}`, categoryType: 1 },
    }),
    prisma.category.create({
      data: { householdId: householdB.id, name: `Externo ${suffix}`, categoryType: 2 },
    }),
  ]);
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test('crea un presupuesto único y registra auditoría atómica', async () => {
  budgetA = await budgetService.createBudget(
    householdA.id,
    { categoryId: expenseCategoryA.id, monthStart: july, amount: '100.00' },
    actor(userA.id, householdA.id),
  );

  assert.equal(budgetA.amount, '100.00');
  assert.equal(budgetA.month, '2026-07');
  assert.equal(budgetA.active, true);

  const audit = await prisma.auditLog.findFirst({
    where: {
      householdId: householdA.id,
      entityType: AUDIT_ENTITY_TYPES.BUDGET,
      entityId: BigInt(budgetA.id),
      action: AUDIT_ACTIONS.CREATE,
    },
  });
  assert.ok(audit);
  assert.equal(audit.metadata.after.amount, '100');
});

test('rechaza duplicados y categorías incompatibles o ajenas', async () => {
  await assert.rejects(
    budgetService.createBudget(
      householdA.id,
      { categoryId: expenseCategoryA.id, monthStart: july, amount: '200.00' },
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'BUDGET_PERIOD_CONFLICT',
  );

  await assert.rejects(
    budgetService.createBudget(
      householdA.id,
      { categoryId: incomeCategoryA.id, monthStart: july, amount: '200.00' },
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'BUDGET_CATEGORY_NOT_FOUND',
  );

  await assert.rejects(
    budgetService.createBudget(
      householdA.id,
      { categoryId: expenseCategoryB.id, monthStart: july, amount: '200.00' },
      actor(userA.id, householdA.id),
    ),
    (error) => error.code === 'BUDGET_CATEGORY_NOT_FOUND',
  );
});

test('calcula gasto real por mes excluyendo anulados y otros espacios', async () => {
  await prisma.transaction.createMany({
    data: [
      {
        householdId: householdA.id,
        accountId: accountA.id,
        categoryId: expenseCategoryA.id,
        createdBy: userA.id,
        transactionType: 2,
        amount: '80.00',
        description: 'Gasto válido julio',
        transactionDate: new Date('2026-07-10T00:00:00.000Z'),
      },
      {
        householdId: householdA.id,
        accountId: accountA.id,
        categoryId: expenseCategoryA.id,
        createdBy: userA.id,
        transactionType: 2,
        amount: '50.00',
        description: 'Gasto anulado julio',
        transactionDate: new Date('2026-07-11T00:00:00.000Z'),
        status: 2,
        deletedAt: new Date(),
      },
      {
        householdId: householdA.id,
        accountId: accountA.id,
        categoryId: expenseCategoryA.id,
        createdBy: userA.id,
        transactionType: 2,
        amount: '10.00',
        description: 'Gasto agosto',
        transactionDate: new Date('2026-08-01T00:00:00.000Z'),
      },
      {
        householdId: householdB.id,
        accountId: accountB.id,
        categoryId: expenseCategoryB.id,
        createdBy: userB.id,
        transactionType: 2,
        amount: '500.00',
        description: 'Gasto externo',
        transactionDate: new Date('2026-07-10T00:00:00.000Z'),
      },
    ],
  });

  const overview = await budgetService.getBudgetOverview(householdA.id, july);
  const budget = overview.budgets.find(({ id }) => id === budgetA.id);

  assert.ok(budget);
  assert.equal(budget.spent, '80.00');
  assert.equal(budget.remaining, '20.00');
  assert.equal(budget.percentage, 80);
  assert.equal(budget.progressState, 'warning');
  assert.equal(overview.summary.totalSpent, '80.00');
});

test('edita y desactiva conservando auditoría y excluyendo totales activos', async () => {
  const second = await budgetService.createBudget(
    householdA.id,
    { categoryId: secondExpenseCategoryA.id, monthStart: july, amount: '50.00' },
    actor(userA.id, householdA.id),
  );
  const updated = await budgetService.updateBudget(
    householdA.id,
    BigInt(second.id),
    { categoryId: secondExpenseCategoryA.id, monthStart: july, amount: '75.00' },
    actor(userA.id, householdA.id),
  );
  assert.equal(updated.amount, '75.00');

  const inactive = await budgetService.setBudgetActive(
    householdA.id,
    BigInt(budgetA.id),
    false,
    actor(userA.id, householdA.id),
  );
  assert.equal(inactive.active, false);

  const overview = await budgetService.getBudgetOverview(householdA.id, july);
  assert.equal(overview.summary.activeCount, 1);
  assert.equal(overview.summary.totalLimit, '75.00');
  assert.equal(overview.summary.totalSpent, '0.00');

  const deactivateAudit = await prisma.auditLog.findFirst({
    where: {
      entityType: AUDIT_ENTITY_TYPES.BUDGET,
      entityId: BigInt(budgetA.id),
      action: AUDIT_ACTIONS.DEACTIVATE,
    },
  });
  assert.ok(deactivateAudit);
});
