import { buildAuditActor } from '../../core/audit/audit.constants.js';
import { TRANSACTION_TYPE_OPTIONS, TRANSACTION_TYPES } from './transaction.constants.js';
import * as transactionService from './transaction.service.js';

function formValues(transaction = null) {
  return {
    transactionType: transaction?.transactionType ?? TRANSACTION_TYPES.EXPENSE,
    accountId: transaction?.accountId ?? '',
    categoryId: transaction?.categoryId ?? '',
    description: transaction?.description ?? '',
    amount: transaction?.amount ?? '',
    transactionDate: transaction?.transactionDateValue ?? new Date().toISOString().slice(0, 10),
    notes: transaction?.notes ?? '',
  };
}

async function renderTransactionForm(response, householdId, transaction = null) {
  response.render('transactions/form', {
    pageTitle: transaction ? 'Editar movimiento' : 'Nuevo movimiento',
    values: formValues(transaction),
    transactionTypes: TRANSACTION_TYPE_OPTIONS,
    action: transaction ? `/transactions/${transaction.id}` : '/transactions',
    submitLabel: transaction ? 'Guardar cambios' : 'Guardar movimiento',
    ...(await transactionService.getTransactionFormOptions(householdId)),
  });
}

export async function listTransactions(request, response) {
  response.render('transactions/index', {
    pageTitle: 'Movimientos',
    transactions: await transactionService.listTransactions(request.context.household.id),
  });
}

export async function showTransaction(request, response) {
  response.render('transactions/detail', {
    pageTitle: 'Detalle del movimiento',
    transaction: await transactionService.requireTransaction(
      request.context.household.id,
      request.validated.params.transactionId,
    ),
  });
}

export async function showCreateTransaction(request, response) {
  await renderTransactionForm(response, request.context.household.id);
}

export async function showEditTransaction(request, response) {
  const transaction = await transactionService.requireTransaction(
    request.context.household.id,
    request.validated.params.transactionId,
  );
  await renderTransactionForm(response, request.context.household.id, transaction);
}

export async function createTransaction(request, response) {
  await transactionService.createTransaction(
    request.context.household.id,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, '/transactions');
}

export async function updateTransaction(request, response) {
  const transaction = await transactionService.updateTransaction(
    request.context.household.id,
    request.validated.params.transactionId,
    request.validated.body,
    buildAuditActor(request),
  );
  response.redirect(303, `/transactions/${transaction.id}`);
}

export async function voidTransaction(request, response) {
  await transactionService.voidTransaction(
    request.context.household.id,
    request.validated.params.transactionId,
    buildAuditActor(request),
  );
  response.redirect(303, '/transactions');
}
