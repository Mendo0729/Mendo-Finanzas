export const TRANSACTION_TYPES = Object.freeze({
  INCOME: 1,
  EXPENSE: 2,
  TRANSFER_OUT: 3,
  TRANSFER_IN: 4,
});

export const TRANSACTION_STATUSES = Object.freeze({
  CONFIRMED: 1,
  VOIDED: 2,
});

export const TRANSACTION_PAGE_SIZE = 20;

export const TRANSACTION_SORTS = Object.freeze({
  DATE_DESC: 'date_desc',
  DATE_ASC: 'date_asc',
  AMOUNT_DESC: 'amount_desc',
  AMOUNT_ASC: 'amount_asc',
});

export const TRANSACTION_TYPE_OPTIONS = Object.freeze([
  { value: TRANSACTION_TYPES.INCOME, label: 'Ingreso' },
  { value: TRANSACTION_TYPES.EXPENSE, label: 'Gasto' },
]);

export const TRANSACTION_SORT_OPTIONS = Object.freeze([
  { value: TRANSACTION_SORTS.DATE_DESC, label: 'Fecha más reciente' },
  { value: TRANSACTION_SORTS.DATE_ASC, label: 'Fecha más antigua' },
  { value: TRANSACTION_SORTS.AMOUNT_DESC, label: 'Monto mayor' },
  { value: TRANSACTION_SORTS.AMOUNT_ASC, label: 'Monto menor' },
]);

export function getTransactionTypeLabel(transactionType) {
  return (
    TRANSACTION_TYPE_OPTIONS.find(({ value }) => value === transactionType)?.label ?? 'Movimiento'
  );
}

export function isEditableTransactionType(transactionType) {
  return TRANSACTION_TYPE_OPTIONS.some(({ value }) => value === transactionType);
}

export function isTransactionSort(sort) {
  return TRANSACTION_SORT_OPTIONS.some(({ value }) => value === sort);
}
