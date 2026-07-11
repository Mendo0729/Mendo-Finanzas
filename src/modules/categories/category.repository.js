import { prisma } from '../../config/database.js';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../core/audit/audit.constants.js';

const categorySelect = Object.freeze({
  id: true,
  householdId: true,
  name: true,
  categoryType: true,
  icon: true,
  isDefault: true,
  active: true,
  createdAt: true,
  _count: { select: { transactions: true, budgets: true } },
});

export function listCategories(householdId) {
  return prisma.category.findMany({
    where: { householdId },
    select: categorySelect,
    orderBy: [{ active: 'desc' }, { categoryType: 'asc' }, { name: 'asc' }],
  });
}

export function findCategory(householdId, categoryId) {
  return prisma.category.findFirst({
    where: { id: categoryId, householdId },
    select: categorySelect,
  });
}

function auditData(actor, action, entityId, metadata) {
  return {
    ...actor,
    action,
    entityType: AUDIT_ENTITY_TYPES.CATEGORY,
    entityId,
    metadata,
  };
}

export function createCategory(householdId, data, actor) {
  return prisma.$transaction(async (transaction) => {
    const category = await transaction.category.create({
      data: { householdId, ...data, isDefault: false },
      select: categorySelect,
    });

    await transaction.auditLog.create({
      data: auditData(actor, AUDIT_ACTIONS.CREATE, category.id, {
        after: {
          name: category.name,
          categoryType: category.categoryType,
          icon: category.icon,
          active: category.active,
        },
      }),
    });

    return category;
  });
}

export function updateCategory(householdId, categoryId, data, actor) {
  return prisma.$transaction(async (transaction) => {
    const before = await transaction.category.findFirst({
      where: { id: categoryId, householdId },
      select: categorySelect,
    });
    if (!before) {
      return null;
    }

    const category = await transaction.category.update({
      where: { id: categoryId },
      data,
      select: categorySelect,
    });

    await transaction.auditLog.create({
      data: auditData(actor, AUDIT_ACTIONS.UPDATE, category.id, {
        before: {
          name: before.name,
          categoryType: before.categoryType,
          icon: before.icon,
        },
        after: {
          name: category.name,
          categoryType: category.categoryType,
          icon: category.icon,
        },
      }),
    });

    return category;
  });
}

export function setCategoryActive(householdId, categoryId, active, actor) {
  return prisma.$transaction(async (transaction) => {
    const category = await transaction.category.findFirst({
      where: { id: categoryId, householdId },
      select: categorySelect,
    });
    if (!category) {
      return null;
    }
    if (category.active === active) {
      return category;
    }

    const updated = await transaction.category.update({
      where: { id: categoryId },
      data: { active },
      select: categorySelect,
    });

    await transaction.auditLog.create({
      data: auditData(
        actor,
        active ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.DEACTIVATE,
        category.id,
        { before: { active: category.active }, after: { active } },
      ),
    });

    return updated;
  });
}
