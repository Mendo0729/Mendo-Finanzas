import { prisma } from '../../config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../core/audit/audit.constants.js';

const accountSelect = Object.freeze({
  id: true,
  householdId: true,
  name: true,
  accountType: true,
  currency: true,
  initialBalance: true,
  creditLimit: true,
  closingDay: true,
  paymentDay: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { transactions: true } },
});

export function listAccounts(householdId) {
  return prisma.account.findMany({
    where: { householdId },
    select: accountSelect,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
}

export function findAccount(householdId, accountId) {
  return prisma.account.findFirst({
    where: { id: accountId, householdId },
    select: accountSelect,
  });
}

function auditData(actor, action, entityId, metadata) {
  return {
    ...actor,
    action,
    entityType: AUDIT_ENTITY_TYPES.ACCOUNT,
    entityId,
    metadata,
  };
}

export function createAccount(householdId, data, actor) {
  return prisma.$transaction(async (transaction) => {
    const account = await transaction.account.create({
      data: { householdId, ...data },
      select: accountSelect,
    });

    await transaction.auditLog.create({
      data: auditData(actor, AUDIT_ACTIONS.CREATE, account.id, {
        after: {
          name: account.name,
          accountType: account.accountType,
          currency: account.currency,
          initialBalance: account.initialBalance.toString(),
          creditLimit: account.creditLimit?.toString() ?? null,
          closingDay: account.closingDay,
          paymentDay: account.paymentDay,
          active: account.active,
        },
      }),
    });

    return account;
  });
}

export function updateAccount(householdId, accountId, data, actor) {
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.account.findFirst({
      where: { id: accountId, householdId },
      select: accountSelect,
    });
    if (!before) {
      return null;
    }

    const account = await transaction.account.update({
      where: { id: accountId },
      data,
      select: accountSelect,
    });

    await transaction.auditLog.create({
      data: auditData(actor, AUDIT_ACTIONS.UPDATE, account.id, {
        before: {
          name: before.name,
          accountType: before.accountType,
          currency: before.currency,
          initialBalance: before.initialBalance.toString(),
          creditLimit: before.creditLimit?.toString() ?? null,
          closingDay: before.closingDay,
          paymentDay: before.paymentDay,
        },
        after: {
          name: account.name,
          accountType: account.accountType,
          currency: account.currency,
          initialBalance: account.initialBalance.toString(),
          creditLimit: account.creditLimit?.toString() ?? null,
          closingDay: account.closingDay,
          paymentDay: account.paymentDay,
        },
      }),
    });

    return account;
  });
}

export function setAccountActive(householdId, accountId, active, actor) {
  return prisma.$transaction(async (transaction) => {
    const account = await transaction.account.findFirst({
      where: { id: accountId, householdId },
      select: accountSelect,
    });
    if (!account) {
      return null;
    }
    if (account.active === active) {
      return account;
    }

    const updated = await transaction.account.update({
      where: { id: accountId },
      data: { active },
      select: accountSelect,
    });

    await transaction.auditLog.create({
      data: auditData(
        actor,
        active ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
        account.id,
        { before: { active: account.active }, after: { active } },
      ),
    });

    return updated;
  });
}
