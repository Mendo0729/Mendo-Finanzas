import { Prisma } from '@prisma/client';

import { prisma } from '../../config/database.js';

const TRANSACTION_TYPE = Object.freeze({
  INCOME: 1,
  EXPENSE: 2,
  TRANSFER_OUT: 3,
  TRANSFER_IN: 4,
});

const TRANSACTION_STATUS_CONFIRMED = 1;

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date, amount) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function decimal(value = 0) {
  return new Prisma.Decimal(value ?? 0);
}

function escapeDataAttributeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function percentageChange(current, previous) {
  if (previous.isZero()) {
    return null;
  }

  return current
    .minus(previous)
    .dividedBy(previous.abs())
    .times(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

function buildMonthlySeries(transactions, startDate, monthCount = 12, locale = 'es-PA') {
  const months = Array.from({ length: monthCount }, (_, index) => addMonths(startDate, index));
  const entries = new Map(
    months.map((date) => [
      `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
      { income: decimal(0), expense: decimal(0) },
    ]),
  );

  for (const transaction of transactions) {
    const date = new Date(transaction.transactionDate);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const entry = entries.get(key);

    if (!entry) continue;

    if (transaction.transactionType === TRANSACTION_TYPE.INCOME) {
      entry.income = entry.income.plus(transaction.amount);
    }

    if (transaction.transactionType === TRANSACTION_TYPE.EXPENSE) {
      entry.expense = entry.expense.plus(transaction.amount);
    }
  }

  return months.map((date) => {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const values = entries.get(key);

    return {
      label: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
        .format(date)
        .replace('.', ''),
      year: date.getUTCFullYear(),
      income: values.income.toFixed(2),
      expense: values.expense.toFixed(2),
    };
  });
}

export async function getDashboardData(household) {
  const now = new Date();
  const currentMonthStart = monthStart(now);
  const nextMonthStart = addMonths(currentMonthStart, 1);
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const historyStart = addMonths(currentMonthStart, -11);

  const baseTransactionFilter = {
    householdId: household.id,
    status: TRANSACTION_STATUS_CONFIRMED,
    deletedAt: null,
  };

  const [
    accounts,
    currentTotals,
    previousTotals,
    historyTransactions,
    recentTransactions,
    budgets,
  ] = await Promise.all([
    prisma.account.findMany({
      where: { householdId: household.id, active: true },
      select: { id: true, initialBalance: true },
    }),
    prisma.transaction.groupBy({
      by: ['transactionType'],
      where: {
        ...baseTransactionFilter,
        transactionDate: { gte: currentMonthStart, lt: nextMonthStart },
        transactionType: { in: [TRANSACTION_TYPE.INCOME, TRANSACTION_TYPE.EXPENSE] },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['transactionType'],
      where: {
        ...baseTransactionFilter,
        transactionDate: { gte: previousMonthStart, lt: currentMonthStart },
        transactionType: { in: [TRANSACTION_TYPE.INCOME, TRANSACTION_TYPE.EXPENSE] },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: {
        ...baseTransactionFilter,
        transactionDate: { gte: historyStart, lt: nextMonthStart },
        transactionType: { in: [TRANSACTION_TYPE.INCOME, TRANSACTION_TYPE.EXPENSE] },
      },
      select: { transactionType: true, amount: true, transactionDate: true },
    }),
    prisma.transaction.findMany({
      where: baseTransactionFilter,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        description: true,
        amount: true,
        transactionType: true,
        transactionDate: true,
        category: { select: { name: true, icon: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.budget.findMany({
      where: { householdId: household.id, monthStart: currentMonthStart, active: true },
      include: { category: { select: { id: true, name: true, icon: true } } },
      orderBy: { amount: 'desc' },
    }),
  ]);

  const allAccountTransactions = await prisma.transaction.groupBy({
    by: ['accountId', 'transactionType'],
    where: baseTransactionFilter,
    _sum: { amount: true },
  });

  const transactionByAccount = new Map();
  for (const row of allAccountTransactions) {
    const current = transactionByAccount.get(row.accountId.toString()) ?? decimal(0);
    const amount = decimal(row._sum.amount);
    const addsBalance = [TRANSACTION_TYPE.INCOME, TRANSACTION_TYPE.TRANSFER_IN].includes(
      row.transactionType,
    );
    transactionByAccount.set(
      row.accountId.toString(),
      addsBalance ? current.plus(amount) : current.minus(amount),
    );
  }

  const balance = accounts.reduce(
    (total, account) =>
      total.plus(account.initialBalance).plus(transactionByAccount.get(account.id.toString()) ?? 0),
    decimal(0),
  );

  function totalFor(rows, type) {
    return decimal(rows.find((row) => row.transactionType === type)?._sum.amount);
  }

  const income = totalFor(currentTotals, TRANSACTION_TYPE.INCOME);
  const expense = totalFor(currentTotals, TRANSACTION_TYPE.EXPENSE);
  const previousIncome = totalFor(previousTotals, TRANSACTION_TYPE.INCOME);
  const previousExpense = totalFor(previousTotals, TRANSACTION_TYPE.EXPENSE);

  const expenseByCategoryRows = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      ...baseTransactionFilter,
      transactionType: TRANSACTION_TYPE.EXPENSE,
      categoryId: { not: null },
      transactionDate: { gte: currentMonthStart, lt: nextMonthStart },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  const categoryIds = expenseByCategoryRows.map((row) => row.categoryId).filter(Boolean);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, householdId: household.id },
    select: { id: true, name: true, icon: true },
  });
  const categoryMap = new Map(categories.map((category) => [category.id.toString(), category]));

  const categoryExpenses = expenseByCategoryRows.slice(0, 5).map((row) => {
    const category = categoryMap.get(row.categoryId.toString());

    return {
      name: escapeDataAttributeText(category?.name ?? 'Sin categoría'),
      icon: category?.icon ? escapeDataAttributeText(category.icon) : null,
      amount: decimal(row._sum.amount).toFixed(2),
    };
  });

  const budgetCategoryIds = budgets.map((budget) => budget.categoryId);
  const budgetExpenses = budgetCategoryIds.length
    ? await prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          ...baseTransactionFilter,
          transactionType: TRANSACTION_TYPE.EXPENSE,
          categoryId: { in: budgetCategoryIds },
          transactionDate: { gte: currentMonthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      })
    : [];
  const budgetExpenseMap = new Map(
    budgetExpenses.map((row) => [row.categoryId.toString(), decimal(row._sum.amount)]),
  );

  const budgetProgress = budgets
    .map((budget) => {
      const spent = budgetExpenseMap.get(budget.categoryId.toString()) ?? decimal(0);
      const limit = decimal(budget.amount);
      const percentage = limit.isZero()
        ? 0
        : spent
            .times(100)
            .dividedBy(limit)
            .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
            .toNumber();
      return {
        name: budget.category.name,
        icon: budget.category.icon,
        spent: spent.toFixed(2),
        limit: limit.toFixed(2),
        percentage,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  return {
    currency: household.currency,
    balance: balance.toFixed(2),
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    incomeChange: percentageChange(income, previousIncome),
    expenseChange: percentageChange(expense, previousExpense),
    monthlySeries: buildMonthlySeries(historyTransactions, historyStart, 12),
    categoryExpenses,
    recentTransactions,
    budgetProgress,
    budgetAlert: budgetProgress.find((budget) => budget.percentage >= 80) ?? null,
  };
}
