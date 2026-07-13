import { prisma } from '../../config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../core/audit/audit.constants.js';
import { DEFAULT_HOUSEHOLD_CATEGORIES } from './household.constants.js';
import { HOUSEHOLD_ROLES } from './household.roles.js';

const householdSelect = Object.freeze({
  id: true,
  name: true,
  currency: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export function listMembershipsForUser(userId) {
  return prisma.householdMember.findMany({
    where: { userId },
    include: { household: true },
    orderBy: [{ joinedAt: 'asc' }, { householdId: 'asc' }],
  });
}

export function findMembershipForUser(userId, householdId) {
  return prisma.householdMember.findUnique({
    where: {
      householdId_userId: {
        householdId,
        userId,
      },
    },
    include: { household: true },
  });
}

function auditData(actor, action, entityId, metadata) {
  return {
    ...actor,
    action,
    entityType: AUDIT_ENTITY_TYPES.HOUSEHOLD,
    entityId,
    metadata,
  };
}

export function createHousehold(userId, data, actor) {
  return prisma.$transaction(async (transaction) => {
    const household = await transaction.household.create({
      data: {
        name: data.name,
        currency: data.currency,
        createdBy: userId,
      },
      select: householdSelect,
    });

    await transaction.householdMember.create({
      data: {
        householdId: household.id,
        userId,
        role: HOUSEHOLD_ROLES.OWNER,
      },
    });

    await transaction.category.createMany({
      data: DEFAULT_HOUSEHOLD_CATEGORIES.map((category) => ({
        householdId: household.id,
        ...category,
        isDefault: true,
        active: true,
      })),
    });

    await transaction.auditLog.create({
      data: auditData(
        { ...actor, householdId: household.id },
        AUDIT_ACTIONS.CREATE,
        household.id,
        {
          after: {
            name: household.name,
            currency: household.currency,
            ownerUserId: userId.toString(),
            defaultCategoryCount: DEFAULT_HOUSEHOLD_CATEGORIES.length,
          },
        },
      ),
    });

    return household;
  });
}

export function findHouseholdForUpdate(userId, householdId) {
  return prisma.household.findFirst({
    where: {
      id: householdId,
      members: {
        some: { userId },
      },
    },
    select: householdSelect,
  });
}

export function updateHousehold(userId, householdId, data, actor) {
  return prisma.$transaction(async (transaction) => {
    const membership = await transaction.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId,
          userId,
        },
      },
      include: { household: true },
    });

    if (!membership) {
      return null;
    }

    const before = membership.household;
    const household = await transaction.household.update({
      where: { id: householdId },
      data,
      select: householdSelect,
    });

    await transaction.auditLog.create({
      data: auditData(actor, AUDIT_ACTIONS.UPDATE, household.id, {
        before: {
          name: before.name,
          currency: before.currency,
        },
        after: {
          name: household.name,
          currency: household.currency,
        },
      }),
    });

    return household;
  });
}
