import { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { getCategoryTypeLabel } from './category.constants.js';
import * as categoryRepository from './category.repository.js';

function mapCategory(category) {
  return {
    ...category,
    id: category.id.toString(),
    householdId: category.householdId.toString(),
    transactionCount: category._count.transactions,
    budgetCount: category._count.budgets,
    categoryTypeLabel: getCategoryTypeLabel(category.categoryType),
  };
}

function translateWriteError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('Ya existe una categoría con ese nombre y tipo.', {
      code: 'CATEGORY_NAME_CONFLICT',
    });
  }
  throw error;
}

export async function listCategories(householdId) {
  return (await categoryRepository.listCategories(householdId)).map(mapCategory);
}

export async function requireCategory(householdId, categoryId) {
  const category = await categoryRepository.findCategory(householdId, categoryId);
  if (!category) {
    throw new NotFoundError('La categoría solicitada no existe.', {
      code: 'CATEGORY_NOT_FOUND',
    });
  }
  return mapCategory(category);
}

export async function createCategory(householdId, data, actor) {
  try {
    return mapCategory(await categoryRepository.createCategory(householdId, data, actor));
  } catch (error) {
    translateWriteError(error);
  }
}

export async function updateCategory(householdId, categoryId, data, actor) {
  const current = await requireCategory(householdId, categoryId);
  if (current.isDefault && current.categoryType !== data.categoryType) {
    throw new ConflictError('No se puede cambiar el tipo de una categoría predeterminada.', {
      code: 'DEFAULT_CATEGORY_TYPE_LOCKED',
    });
  }

  try {
    const category = await categoryRepository.updateCategory(householdId, categoryId, data, actor);
    if (!category) {
      throw new NotFoundError('La categoría solicitada no existe.', {
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    return mapCategory(category);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    translateWriteError(error);
  }
}

export async function setCategoryActive(householdId, categoryId, active, actor) {
  const current = await requireCategory(householdId, categoryId);
  if (!active && current.isDefault) {
    throw new ConflictError('Las categorías predeterminadas no pueden desactivarse.', {
      code: 'DEFAULT_CATEGORY_DEACTIVATION_DENIED',
    });
  }
  if (!active && (current.transactionCount > 0 || current.budgetCount > 0)) {
    throw new ConflictError(
      'La categoría tiene movimientos o presupuestos asociados y no puede desactivarse.',
      { code: 'CATEGORY_IN_USE' },
    );
  }

  const category = await categoryRepository.setCategoryActive(
    householdId,
    categoryId,
    active,
    actor,
  );
  if (!category) {
    throw new NotFoundError('La categoría solicitada no existe.', {
      code: 'CATEGORY_NOT_FOUND',
    });
  }
  return mapCategory(category);
}
