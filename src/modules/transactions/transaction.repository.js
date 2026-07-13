import { prisma } from '../../config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../core/audit/audit.constants.js';
import { TRANSACTION_STATUSES, TRANSACTION_TYPES } from './transaction.constants.js';

const transactionSelect = Object.freeze({
  id: true,
  householdId: true,
  accountId: true,
  categoryId: true,
  createdBy: true,
  transactionType: true,
  amount: true,
  description: true,
  notes: true,
  transactionDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  account: { select: { name: true, currency: true } },
  category: { select: { name: true, icon: true } },
});

export function listTransactions(householdId) {
  return prisma.transaction.findMany({
    where: {
      householdId,
      status: TRANSACTION_STATUSES.CONFIRMED,
      deletedAt: null,
      transactionType: { in: [TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.EXPENSE] },
    },
    select: transactionSelect,
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });
}

export async function listFormOptions(householdId) {
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, active: true },
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      where: {
        householdId,
        active: true,
        categoryType: { in: [TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.EXPENSE] },
      },
      select: { id: true, name: true, categoryType: true },
      orderBy: [{ categoryType: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return { accounts, categories };
}

export function createTransaction(householdId, data, actor) {
  return prisma.$transaction(async (transaction) => {
    const account = await transaction.account.findFirst({
      where: { id: data.accountId, householdId, active: true },
      select: { id: true, name: true, currency: true },
    });
    if (!account) {
      return { error: 'ACCOUNT_NOT_FOUND' };
    }

    const category = await transaction.category.findFirst({
      where: {
        id: data.categoryId,
        householdId,
        active: true,
        categoryType: data.transactionType,
      },
      select: { id: true, name: true },
    });
    if (!category) {
      return { error: 'CATEGORY_NOT_FOUND' };
    }

    const created = await transaction.transaction.create({
      data: {
        householdId,
        accountId: account.id,
        categoryId: category.id,
        createdBy: actor.userId,
        transactionType: data.transactionType,
        amount: data.amount,
        description: data.description,
        notes: data.notes,
        transactionDate: data.transactionDate,
        status: TRANSACTION_STATUSES.CONFIRMED,
      },
      select: transactionSelect,
    });

    await transaction.auditLog.create({
      data: {
        ...actor,
        action: AUDIT_ACTIONS.CREATE,
        entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
        entityId: created.id,
        metadata: {
          after: {
            accountId: account.id.toString(),
            accountName: account.name,
            categoryId: category.id.toString(),
            categoryName: category.name,
            transactionType: created.transactionType,
            amount: created.amount.toString(),
            currency: account.currency,
            description: created.description,
            transactionDate: created.transactionDate.toISOString().slice(0, 10),
          },
        },
      },
    });

    return { transaction: created };
  });
}
