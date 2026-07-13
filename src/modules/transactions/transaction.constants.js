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

export const TRANSACTION_TYPE_OPTIONS = Object.freeze([
  { value: TRANSACTION_TYPES.INCOME, label: 'Ingreso' },
  { value: TRANSACTION_TYPES.EXPENSE, label: 'Gasto' },
]);

export function getTransactionTypeLabel(transactionType) {
  return (
    TRANSACTION_TYPE_OPTIONS.find(({ value }) => value === transactionType)?.label ?? 'Movimiento'
  );
}

export function isEditableTransactionType(transactionType) {
  return TRANSACTION_TYPE_OPTIONS.some(({ value }) => value === transactionType);
}
