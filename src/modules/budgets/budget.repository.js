import { prisma } from '../../config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../core/audit/audit.constants.js';
import {
  CONFIRMED_TRANSACTION_STATUS,
  EXPENSE_CATEGORY_TYPE,
  EXPENSE_TRANSACTION_TYPE,
} from './budget.constants.js';

const budgetSelect = Object.freeze({
  id: true,
  householdId: true,
  categoryId: true,
  monthStart: true,
  amount: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { name: true, icon: true, active: true, categoryType: true } },
});

function auditSnapshot(budget) {
  return {
    categoryId: budget.categoryId.toString(),
    categoryName: budget.category.name,
    month: budget.monthStart.toISOString().slice(0, 7),
    amount: budget.amount.toString(),
    active: budget.active,
  };
}

function auditData(actor, action, entityId, metadata) {
  return {
    ...actor,
    action,
    entityType: AUDIT_ENTITY_TYPES.BUDGET,
    entityId,
    metadata,
  };
}

async function findExpenseCategory(database, householdId, categoryId) {
  return database.category.findFirst({
    where: {
      id: categoryId,
      householdId,
      active: true,
      categoryType: EXPENSE_CATEGORY_TYPE,
    },
    select: { id: true, name: true },
  });
}

export function listExpenseCategories(householdId) {
  return prisma.category.findMany({
    where: { householdId, active: true, categoryType: EXPENSE_CATEGORY_TYPE },
    select: { id: true, name: true, icon: true },
    orderBy: { name: 'asc' },
  });
}

export function findBudget(householdId, budgetId) {
  return prisma.budget.findFirst({
    where: { id: budgetId, householdId },
    select: budgetSelect,
  });
}

export function listBudgetsForMonth(householdId, monthStart, nextMonthStart) {
  return prisma.$transaction(async (database) => {
    const budgets = await database.budget.findMany({
      where: { householdId, monthStart },
      select: budgetSelect,
      orderBy: [{ active: 'desc' }, { category: { name: 'asc' } }],
    });

    const categoryIds = budgets.map(({ categoryId }) => categoryId);
    const expenseRows =
      categoryIds.length === 0
        ? []
        : await database.transaction.groupBy({
            by: ['categoryId'],
            where: {
              householdId,
              categoryId: { in: categoryIds },
              transactionType: EXPENSE_TRANSACTION_TYPE,
              status: CONFIRMED_TRANSACTION_STATUS,
              deletedAt: null,
              transactionDate: { gte: monthStart, lt: nextMonthStart },
            },
            _sum: { amount: true },
          });

    return { budgets, expenseRows };
  });
}

export function createBudget(householdId, data, actor) {
  return prisma.$transaction(async (database) => {
    const category = await findExpenseCategory(database, householdId, data.categoryId);
    if (!category) {
      return { error: 'CATEGORY_NOT_FOUND' };
    }

    const budget = await database.budget.create({
      data: {
        householdId,
        categoryId: category.id,
        monthStart: data.monthStart,
        amount: data.amount,
        active: true,
      },
      select: budgetSelect,
    });

    await database.auditLog.create({
      data: auditData(actor, AUDIT_ACTIONS.CREATE, budget.id, {
        after: auditSnapshot(budget),
      }),
    });

    return { budget };
  });
}

export function updateBudget(householdId, budgetId, data, actor) {
  return prisma.$transaction(async (database) => {
    const before = await database.budget.findFirst({
      where: { id: budgetId, householdId },
      select: budgetSelect,
    });
    if (!before) {
      return { error: 'BUDGET_NOT_FOUND' };
    }

    const category = await findExpenseCategory(database, householdId, data.categoryId);
    if (!category) {
      return { error: 'CATEGORY_NOT_FOUND' };
    }

    const budget = await database.budget.update({
      where: { id: before.id },
      data: {
        categoryId: category.id,
        monthStart: data.monthStart,
        amount: data.amount,
      },
      select: budgetSelect,
    });

    await database.auditLog.create({
      data: auditData(actor, AUDIT_ACTIONS.UPDATE, budget.id, {
        before: auditSnapshot(before),
        after: auditSnapshot(budget),
      }),
    });

    return { budget };
  });
}

export function setBudgetActive(householdId, budgetId, active, actor) {
  return prisma.$transaction(async (database) => {
    const before = await database.budget.findFirst({
      where: { id: budgetId, householdId },
      select: budgetSelect,
    });
    if (!before) {
      return { error: 'BUDGET_NOT_FOUND' };
    }
    if (before.active === active) {
      return { budget: before };
    }

    const budget = await database.budget.update({
      where: { id: before.id },
      data: { active },
      select: budgetSelect,
    });

    await database.auditLog.create({
      data: auditData(
        actor,
        active ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
        budget.id,
        { before: auditSnapshot(before), after: auditSnapshot(budget) },
      ),
    });

    return { budget };
  });
}
