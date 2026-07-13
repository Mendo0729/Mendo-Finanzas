import { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { BUDGET_PROGRESS_LABELS, getBudgetProgressState } from './budget.constants.js';
import * as budgetRepository from './budget.repository.js';

function decimal(value = 0) {
  return new Prisma.Decimal(value ?? 0);
}

export function currentMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonths(date, amount) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

export function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function monthLabel(date) {
  const label = new Intl.DateTimeFormat('es-PA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function mapBudget(budget, spentValue = 0) {
  const limit = decimal(budget.amount);
  const spent = decimal(spentValue);
  const remaining = limit.minus(spent);
  const progressState = getBudgetProgressState(spent, limit);
  const percentage = limit.isZero()
    ? 0
    : spent
        .times(100)
        .dividedBy(limit)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();

  return {
    ...budget,
    id: budget.id.toString(),
    householdId: budget.householdId.toString(),
    categoryId: budget.categoryId.toString(),
    amount: limit.toFixed(2),
    spent: spent.toFixed(2),
    remaining: remaining.toFixed(2),
    exceeded: remaining.isNegative(),
    exceededAmount: remaining.isNegative() ? remaining.abs().toFixed(2) : '0.00',
    percentage,
    progressState,
    progressLabel: BUDGET_PROGRESS_LABELS[progressState],
    month: monthKey(budget.monthStart),
    monthLabel: monthLabel(budget.monthStart),
    createdAtLabel: new Intl.DateTimeFormat('es-PA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(budget.createdAt),
    updatedAtLabel: new Intl.DateTimeFormat('es-PA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(budget.updatedAt),
  };
}

function throwRepositoryError(error) {
  if (error === 'BUDGET_NOT_FOUND') {
    throw new NotFoundError('El presupuesto solicitado no existe.', {
      code: 'BUDGET_NOT_FOUND',
    });
  }
  if (error === 'CATEGORY_NOT_FOUND') {
    throw new NotFoundError('La categoría seleccionada no existe o no es una categoría de gasto activa.', {
      code: 'BUDGET_CATEGORY_NOT_FOUND',
    });
  }
}

function translateWriteError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('Ya existe un presupuesto para esa categoría y ese mes.', {
      code: 'BUDGET_PERIOD_CONFLICT',
    });
  }
  throw error;
}

export async function getBudgetOverview(householdId, requestedMonth = null) {
  const selectedMonth = requestedMonth ?? currentMonthStart();
  const nextMonth = addMonths(selectedMonth, 1);
  const { budgets, expenseRows } = await budgetRepository.listBudgetsForMonth(
    householdId,
    selectedMonth,
    nextMonth,
  );
  const expenseMap = new Map(
    expenseRows.map((row) => [row.categoryId.toString(), decimal(row._sum.amount)]),
  );
  const mappedBudgets = budgets.map((budget) =>
    mapBudget(budget, expenseMap.get(budget.categoryId.toString()) ?? 0),
  );

  const activeBudgets = mappedBudgets.filter(({ active }) => active);
  const totalLimit = activeBudgets.reduce(
    (total, budget) => total.plus(budget.amount),
    decimal(0),
  );
  const totalSpent = activeBudgets.reduce(
    (total, budget) => total.plus(budget.spent),
    decimal(0),
  );
  const totalRemaining = totalLimit.minus(totalSpent);

  return {
    budgets: mappedBudgets,
    selectedMonth,
    month: monthKey(selectedMonth),
    monthLabel: monthLabel(selectedMonth),
    previousMonth: monthKey(addMonths(selectedMonth, -1)),
    nextMonth: monthKey(nextMonth),
    summary: {
      activeCount: activeBudgets.length,
      totalLimit: totalLimit.toFixed(2),
      totalSpent: totalSpent.toFixed(2),
      totalRemaining: totalRemaining.toFixed(2),
      exceeded: totalRemaining.isNegative(),
    },
  };
}

export async function getBudgetFormOptions(householdId) {
  const categories = await budgetRepository.listExpenseCategories(householdId);
  return {
    categories: categories.map((category) => ({
      ...category,
      id: category.id.toString(),
    })),
  };
}

export async function requireBudget(householdId, budgetId) {
  const budget = await budgetRepository.findBudget(householdId, budgetId);
  if (!budget) {
    throwRepositoryError('BUDGET_NOT_FOUND');
  }
  return mapBudget(budget);
}

export async function createBudget(householdId, data, actor) {
  try {
    const result = await budgetRepository.createBudget(householdId, data, actor);
    if (result.error) {
      throwRepositoryError(result.error);
    }
    return mapBudget(result.budget);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    translateWriteError(error);
  }
}

export async function updateBudget(householdId, budgetId, data, actor) {
  try {
    const result = await budgetRepository.updateBudget(householdId, budgetId, data, actor);
    if (result.error) {
      throwRepositoryError(result.error);
    }
    return mapBudget(result.budget);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    translateWriteError(error);
  }
}

export async function setBudgetActive(householdId, budgetId, active, actor) {
  const result = await budgetRepository.setBudgetActive(householdId, budgetId, active, actor);
  if (result.error) {
    throwRepositoryError(result.error);
  }
  return mapBudget(result.budget);
}
