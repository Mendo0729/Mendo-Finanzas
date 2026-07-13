export const BUDGET_PROGRESS_STATES = Object.freeze({
  NORMAL: 'normal',
  WARNING: 'warning',
  EXCEEDED: 'exceeded',
});

export const BUDGET_PROGRESS_LABELS = Object.freeze({
  [BUDGET_PROGRESS_STATES.NORMAL]: 'Normal',
  [BUDGET_PROGRESS_STATES.WARNING]: 'Advertencia',
  [BUDGET_PROGRESS_STATES.EXCEEDED]: 'Excedido',
});

export const EXPENSE_CATEGORY_TYPE = 2;
export const EXPENSE_TRANSACTION_TYPE = 2;
export const CONFIRMED_TRANSACTION_STATUS = 1;

export function getBudgetProgressState(spent, limit) {
  if (spent.greaterThanOrEqualTo(limit)) {
    return BUDGET_PROGRESS_STATES.EXCEEDED;
  }
  if (spent.times(100).greaterThanOrEqualTo(limit.times(80))) {
    return BUDGET_PROGRESS_STATES.WARNING;
  }
  return BUDGET_PROGRESS_STATES.NORMAL;
}
