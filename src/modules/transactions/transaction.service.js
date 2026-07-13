import { NotFoundError } from '../../core/errors/app-error.js';
import { getTransactionTypeLabel } from './transaction.constants.js';
import * as transactionRepository from './transaction.repository.js';

function mapTransaction(transaction) {
  return {
    ...transaction,
    id: transaction.id.toString(),
    householdId: transaction.householdId.toString(),
    accountId: transaction.accountId.toString(),
    categoryId: transaction.categoryId?.toString() ?? null,
    createdBy: transaction.createdBy.toString(),
    amount: transaction.amount.toFixed(2),
    transactionTypeLabel: getTransactionTypeLabel(transaction.transactionType),
    transactionDateValue: transaction.transactionDate.toISOString().slice(0, 10),
    transactionDateLabel: new Intl.DateTimeFormat('es-PA', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(transaction.transactionDate),
    createdAtLabel: new Intl.DateTimeFormat('es-PA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(transaction.createdAt),
    updatedAtLabel: new Intl.DateTimeFormat('es-PA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(transaction.updatedAt),
  };
}

function throwRepositoryError(error) {
  if (error === 'TRANSACTION_NOT_FOUND') {
    throw new NotFoundError('El movimiento solicitado no existe.', {
      code: 'TRANSACTION_NOT_FOUND',
    });
  }
  if (error === 'ACCOUNT_NOT_FOUND') {
    throw new NotFoundError('La cuenta seleccionada no existe o no está disponible.', {
      code: 'TRANSACTION_ACCOUNT_NOT_FOUND',
    });
  }
  if (error === 'CATEGORY_NOT_FOUND') {
    throw new NotFoundError('La categoría seleccionada no existe o no corresponde al movimiento.', {
      code: 'TRANSACTION_CATEGORY_NOT_FOUND',
    });
  }
}

export async function listTransactions(householdId) {
  return (await transactionRepository.listTransactions(householdId)).map(mapTransaction);
}

export async function requireTransaction(householdId, transactionId) {
  const transaction = await transactionRepository.findTransaction(householdId, transactionId);
  if (!transaction) {
    throwRepositoryError('TRANSACTION_NOT_FOUND');
  }
  return mapTransaction(transaction);
}

export async function getTransactionFormOptions(householdId) {
  const { accounts, categories } = await transactionRepository.listFormOptions(householdId);
  return {
    accounts: accounts.map((account) => ({ ...account, id: account.id.toString() })),
    categories: categories.map((category) => ({ ...category, id: category.id.toString() })),
  };
}

export async function createTransaction(householdId, data, actor) {
  const result = await transactionRepository.createTransaction(householdId, data, actor);
  if (result.error) {
    throwRepositoryError(result.error);
  }
  return mapTransaction(result.transaction);
}

export async function updateTransaction(householdId, transactionId, data, actor) {
  const result = await transactionRepository.updateTransaction(
    householdId,
    transactionId,
    data,
    actor,
  );
  if (result.error) {
    throwRepositoryError(result.error);
  }
  return mapTransaction(result.transaction);
}

export async function voidTransaction(householdId, transactionId, actor) {
  const result = await transactionRepository.voidTransaction(householdId, transactionId, actor);
  if (result.error) {
    throwRepositoryError(result.error);
  }
  return mapTransaction(result.transaction);
}
