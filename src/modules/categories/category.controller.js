import { buildAuditActor } from '../../core/audit/audit.constants.js';
import { CATEGORY_TYPE_OPTIONS } from './category.constants.js';
import * as categoryService from './category.service.js';

function formValues(category = null) {
  return {
    name: category?.name ?? '',
    categoryType: category?.categoryType ?? CATEGORY_TYPE_OPTIONS[0].value,
    icon: category?.icon ?? '',
  };
}

export async function listCategories(request, response) {
  response.render('categories/index', {
    pageTitle: 'Categorías',
    categories: await categoryService.listCategories(request.context.household.id),
  });
}

export function showCreateCategory(_request, response) {
  response.render('categories/form', {
    pageTitle: 'Nueva categoría',
    category: null,
    values: formValues(),
    categoryTypes: CATEGORY_TYPE_OPTIONS,
    action: '/categories',
  });
}

export async function showEditCategory(request, response) {
  const category = await categoryService.requireCategory(
    request.context.household.id,
    request.validated.params.categoryId,
  );
  response.render('categories/form', {
    pageTitle: 'Editar categoría',
    category,
    values: formValues(category),
    categoryTypes: CATEGORY_TYPE_OPTIONS,
    action: `/categories/${category.id}`,
  });
}

export async function createCategory(request, response) {
  await categoryService.createCategory(
    request.context.household.id,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, '/categories');
}

export async function updateCategory(request, response) {
  await categoryService.updateCategory(
    request.context.household.id,
    request.validated.params.categoryId,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, '/categories');
}

export async function changeCategoryStatus(request, response) {
  await categoryService.setCategoryActive(
    request.context.household.id,
    request.validated.params.categoryId,
    request.validated.body.active,
    buildAuditActor(request),
  );
  response.redirect(303, '/categories');
}
