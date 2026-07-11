export const CATEGORY_TYPES = Object.freeze({
  INCOME: 1,
  EXPENSE: 2,
});

export const CATEGORY_TYPE_OPTIONS = Object.freeze([
  { value: CATEGORY_TYPES.INCOME, label: 'Ingreso' },
  { value: CATEGORY_TYPES.EXPENSE, label: 'Gasto' },
]);

export function getCategoryTypeLabel(categoryType) {
  return CATEGORY_TYPE_OPTIONS.find(({ value }) => value === categoryType)?.label ?? 'Desconocida';
}
