import { buildAuditActor } from '../../core/audit/audit.constants.js';
import { TRANSACTION_TYPE_OPTIONS, TRANSACTION_TYPES } from './transaction.constants.js';
import * as transactionService from './transaction.service.js';

function formValues() {
  return {
    transactionType: TRANSACTION_TYPES.EXPENSE,
    accountId: '',
    categoryId: '',
    description: '',
    amount: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

export async function listTransactions(request, response) {
  response.render('transactions/index', {
    pageTitle: 'Movimientos',
    transactions: await transactionService.listTransactions(request.context.household.id),
  });
}

export async function showCreateTransaction(request, response) {
  const options = await transactionService.getTransactionFormOptions(request.context.household.id);
  response.render('transactions/form', {
    pageTitle: 'Nuevo movimiento',
    values: formValues(),
    transactionTypes: TRANSACTION_TYPE_OPTIONS,
    ...options,
  });
}

export async function createTransaction(request, response) {
  await transactionService.createTransaction(
    request.context.household.id,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, '/transactions');
}
