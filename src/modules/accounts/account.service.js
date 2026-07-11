import { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { getAccountTypeLabel } from './account.constants.js';
import * as accountRepository from './account.repository.js';

function mapAccount(account) {
  return {
    ...account,
    id: account.id.toString(),
    householdId: account.householdId.toString(),
    initialBalance: account.initialBalance.toFixed(2),
    creditLimit: account.creditLimit?.toFixed(2) ?? null,
    transactionCount: account._count.transactions,
    accountTypeLabel: getAccountTypeLabel(account.accountType),
  };
}

function translateWriteError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('Ya existe una cuenta con ese nombre en el espacio financiero.', {
      code: 'ACCOUNT_NAME_CONFLICT',
    });
  }
  throw error;
}

export async function listAccounts(householdId) {
  return (await accountRepository.listAccounts(householdId)).map(mapAccount);
}

export async function requireAccount(householdId, accountId) {
  const account = await accountRepository.findAccount(householdId, accountId);
  if (!account) {
    throw new NotFoundError('La cuenta solicitada no existe.', { code: 'ACCOUNT_NOT_FOUND' });
  }
  return mapAccount(account);
}

export async function createAccount(householdId, data, actor) {
  try {
    return mapAccount(await accountRepository.createAccount(householdId, data, actor));
  } catch (error) {
    translateWriteError(error);
  }
}

export async function updateAccount(householdId, accountId, data, actor) {
  try {
    const account = await accountRepository.updateAccount(householdId, accountId, data, actor);
    if (!account) {
      throw new NotFoundError('La cuenta solicitada no existe.', { code: 'ACCOUNT_NOT_FOUND' });
    }
    return mapAccount(account);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    translateWriteError(error);
  }
}

export async function setAccountActive(householdId, accountId, active, actor) {
  const account = await accountRepository.setAccountActive(householdId, accountId, active, actor);
  if (!account) {
    throw new NotFoundError('La cuenta solicitada no existe.', { code: 'ACCOUNT_NOT_FOUND' });
  }
  return mapAccount(account);
}
