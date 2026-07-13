import { prisma } from '../../config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../core/audit/audit.constants.js';
import {
  TRANSACTION_PAGE_SIZE,
  TRANSACTION_SORTS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from './transaction.constants.js';

const editableTransactionTypes = [TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.EXPENSE];

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
  transferGroupId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  account: { select: { name: true, currency: true } },
  category: { select: { name: true, icon: true } },
  creator: { select: { name: true } },
});

function editableTransactionWhere(householdId, transactionId) {
  return {
    id: transactionId,
    householdId,
    status: TRANSACTION_STATUSES.CONFIRMED,
    deletedAt: null,
    transferGroupId: null,
    transactionType: { in: editableTransactionTypes },
  };
}

function transactionListWhere(householdId, filters) {
  const where = {
    householdId,
    status: TRANSACTION_STATUSES.CONFIRMED,
    deletedAt: null,
    transferGroupId: null,
    transactionType: filters.transactionType ?? {
      in: editableTransactionTypes,
    },
  };

  if (filters.search) {
    where.description = { contains: filters.search, mode: 'insensitive' };
  }
  if (filters.accountId) {
    where.accountId = filters.accountId;
  }
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters.fromDate || filters.toDate) {
    where.transactionDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.minAmount || filters.maxAmount) {
    where.amount = {
      ...(filters.minAmount ? { gte: filters.minAmount } : {}),
      ...(filters.maxAmount ? { lte: filters.maxAmount } : {}),
    };
  }

  return where;
}

function transactionOrderBy(sort) {
  switch (sort) {
    case TRANSACTION_SORTS.DATE_ASC:
      return [{ transactionDate: 'asc' }, { id: 'asc' }];
    case TRANSACTION_SORTS.AMOUNT_DESC:
      return [{ amount: 'desc' }, { transactionDate: 'desc' }, { id: 'desc' }];
    case TRANSACTION_SORTS.AMOUNT_ASC:
      return [{ amount: 'asc' }, { transactionDate: 'desc' }, { id: 'desc' }];
    default:
      return [{ transactionDate: 'desc' }, { id: 'desc' }];
  }
}

function auditSnapshot(transaction) {
  return {
    accountId: transaction.accountId.toString(),
    accountName: transaction.account.name,
    categoryId: transaction.categoryId?.toString() ?? null,
    categoryName: transaction.category?.name ?? null,
    transactionType: transaction.transactionType,
    amount: transaction.amount.toString(),
    currency: transaction.account.currency,
    description: transaction.description,
    notes: transaction.notes,
    transactionDate: transaction.transactionDate.toISOString().slice(0, 10),
    status: transaction.status,
    deletedAt: transaction.deletedAt?.toISOString() ?? null,
  };
}

async function findReferences(database, householdId, data) {
  const account = await database.account.findFirst({
    where: { id: data.accountId, householdId, active: true },
    select: { id: true, name: true, currency: true },
  });
  if (!account) {
    return { error: 'ACCOUNT_NOT_FOUND' };
  }

  const category = await database.category.findFirst({
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

  return { account, category };
}

export function listTransactions(householdId, filters) {
  return prisma.$transaction(async (database) => {
    const where = transactionListWhere(householdId, filters);
    const total = await database.transaction.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / TRANSACTION_PAGE_SIZE));
    const currentPage = Math.min(filters.page, totalPages);
    const transactions = await database.transaction.findMany({
      where,
      select: transactionSelect,
      orderBy: transactionOrderBy(filters.sort),
      skip: (currentPage - 1) * TRANSACTION_PAGE_SIZE,
      take: TRANSACTION_PAGE_SIZE,
    });

    return {
      transactions,
      total,
      currentPage,
      totalPages,
      pageSize: TRANSACTION_PAGE_SIZE,
    };
  });
}

export function findTransaction(householdId, transactionId) {
  return prisma.transaction.findFirst({
    where: editableTransactionWhere(householdId, transactionId),
    select: transactionSelect,
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
        categoryType: { in: editableTransactionTypes },
      },
      select: { id: true, name: true, categoryType: true },
      orderBy: [{ categoryType: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return { accounts, categories };
}

export function createTransaction(householdId, data, actor) {
  return prisma.$transaction(async (database) => {
    const references = await findReferences(database, householdId, data);
    if (references.error) {
      return references;
    }

    const created = await database.transaction.create({
      data: {
        householdId,
        accountId: references.account.id,
        categoryId: references.category.id,
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

    await database.auditLog.create({
      data: {
        ...actor,
        action: AUDIT_ACTIONS.CREATE,
        entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
        entityId: created.id,
        metadata: { after: auditSnapshot(created) },
      },
    });

    return { transaction: created };
  });
}

export function updateTransaction(householdId, transactionId, data, actor) {
  return prisma.$transaction(async (database) => {
    const before = await database.transaction.findFirst({
      where: editableTransactionWhere(householdId, transactionId),
      select: transactionSelect,
    });
    if (!before) {
      return { error: 'TRANSACTION_NOT_FOUND' };
    }

    const references = await findReferences(database, householdId, data);
    if (references.error) {
      return references;
    }

    const updated = await database.transaction.update({
      where: { id: before.id },
      data: {
        accountId: references.account.id,
        categoryId: references.category.id,
        transactionType: data.transactionType,
        amount: data.amount,
        description: data.description,
        notes: data.notes,
        transactionDate: data.transactionDate,
      },
      select: transactionSelect,
    });

    await database.auditLog.create({
      data: {
        ...actor,
        action: AUDIT_ACTIONS.UPDATE,
        entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
        entityId: updated.id,
        metadata: {
          before: auditSnapshot(before),
          after: auditSnapshot(updated),
        },
      },
    });

    return { transaction: updated };
  });
}

export function voidTransaction(householdId, transactionId, actor) {
  return prisma.$transaction(async (database) => {
    const before = await database.transaction.findFirst({
      where: editableTransactionWhere(householdId, transactionId),
      select: transactionSelect,
    });
    if (!before) {
      return { error: 'TRANSACTION_NOT_FOUND' };
    }

    const updated = await database.transaction.update({
      where: { id: before.id },
      data: {
        status: TRANSACTION_STATUSES.VOIDED,
        deletedAt: new Date(),
      },
      select: transactionSelect,
    });

    await database.auditLog.create({
      data: {
        ...actor,
        action: AUDIT_ACTIONS.VOID,
        entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
        entityId: updated.id,
        metadata: {
          before: auditSnapshot(before),
          after: auditSnapshot(updated),
        },
      },
    });

    return { transaction: updated };
  });
}
