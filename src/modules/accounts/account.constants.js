export const ACCOUNT_TYPES = Object.freeze({
  CASH: 1,
  CHECKING: 2,
  SAVINGS: 3,
  CREDIT_CARD: 4,
  DIGITAL_WALLET: 5,
});

export const ACCOUNT_TYPE_OPTIONS = Object.freeze([
  { value: ACCOUNT_TYPES.CASH, label: 'Efectivo' },
  { value: ACCOUNT_TYPES.CHECKING, label: 'Cuenta corriente' },
  { value: ACCOUNT_TYPES.SAVINGS, label: 'Cuenta de ahorro' },
  { value: ACCOUNT_TYPES.CREDIT_CARD, label: 'Tarjeta de crédito' },
  { value: ACCOUNT_TYPES.DIGITAL_WALLET, label: 'Billetera digital' },
]);

export function isCreditCard(accountType) {
  return accountType === ACCOUNT_TYPES.CREDIT_CARD;
}

export function getAccountTypeLabel(accountType) {
  return ACCOUNT_TYPE_OPTIONS.find(({ value }) => value === accountType)?.label ?? 'Desconocida';
}
